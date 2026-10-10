// 规则: 通配符与正则标志 / 订阅过滤 / 来源标记 / 优先级 / 导入与同步头 / 一键屏蔽选项 / 校验与解包
// 命名规则: 规则-三位序号: 描述; (对照) 为语义标记
// 分区: 一、核心行为 / 二、修复回归
(async () => {
const fs = require('fs');
const path = require('path');

const scriptDir = path.join(__dirname, '..');
const scriptFiles = fs.readdirSync(scriptDir).filter((name) => name.endsWith('.js') && !name.toLowerCase().includes('lite')).sort();
if (!scriptFiles.length) throw new Error('no .js script found in ' + scriptDir);
const file = path.join(scriptDir, scriptFiles[0]);
console.log('Testing', file);
const src = fs.readFileSync(file, 'utf8');

const SERH_RAW_EXTRACT = (text, fnName) => {
  const marker = `function ${fnName}(`;
  let idx = text.indexOf(marker);
  if (idx === -1) throw new Error('fn not found: ' + fnName);
  const open = text.indexOf('{', idx);
  let depth = 0;
  let i = open;
  for (; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') { depth--; if (depth === 0) break; }
  }
  return text.slice(idx, i + 1);
};
const SERH_FN_DEPS = ((text) => {
  const consts = text.match(/const (?:RULE_PREFIX_RE|RULE_PREFIX_REGEX_RE|RULE_LEADING_REGEX_RE|REGEX_CTX_A|REGEX_CTX_B|REGEX_CTX_C|RULE_REGEX_LIT_RE) = [^\n]+;/g).join('\n').replace(/\bconst\b/g, 'var');
  return consts + '\n' + ['findBalancedParenEnd', 'isBadRegexTail', 'scanRuleString', 'encodeNonAscii'].map((n) => SERH_RAW_EXTRACT(text, n)).join('\n');
})(src);
const SERH_FLAG_HELPERS = ['isUniqueFlagsStr', 'isFlagsCandidateError'].map((n) => SERH_RAW_EXTRACT(src, n)).join('\n');
const SERH_EL_HELPERS = ['isCondExprCore', 'looksLikeCondExpr', 'isScriptRuleLine', 'isElementRuleLine'].map((n) => SERH_RAW_EXTRACT(src, n)).join('\n');
const SERH_DEPS_RE = /scanRuleString\(|RULE_PREFIX_RE|RULE_PREFIX_REGEX_RE|RULE_LEADING_REGEX_RE|REGEX_CTX_[AB]\b|encodeNonAscii\(|isUniqueFlagsStr\(|isFlagsCandidateError\(|isElementRuleLine\(/;
function extractFn(text, fnName) {
  const body = SERH_RAW_EXTRACT(text, fnName);
  return SERH_DEPS_RE.test(body) ? SERH_FN_DEPS + '\n' + SERH_FLAG_HELPERS + '\n' + SERH_EL_HELPERS + '\n' + body : body;
}


let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? '  => ' + JSON.stringify(extra) : '')); }
}
function assert(name, cond, extra) { check(name, cond, extra); }



// ==== 一、核心行为 ====

// ---- 规则-001~093: 通配符与正则标志 ----
await (async () => {
const fns = ['hostLabelToASCII', 'toASCIIHostname', 'escapeWildcardPart', 'wildcardToRegex', 'parsePrefixedRegexRule', 'ruleToRegex', 'compileRuleRegex', 'safeRegexTest']
  .map((n) => extractFn(src, n));

const api = new Function(`
${fns.join('\n')}
return { escapeWildcardPart, wildcardToRegex, parsePrefixedRegexRule, ruleToRegex, compileRuleRegex, safeRegexTest };
`)();


function match(rule, url) {
  const compiled = api.compileRuleRegex(rule);
  return api.safeRegexTest(compiled.regex, url);
}

// ---- 通配符元字符转义 ----
// (同构矩阵精简: 保留 a+b/{2}/a$b 代表项, 删除 a*b/(x)/[x]/a|b/a^b 中间同构项)
assert('规则-001: a+b 匹配字面量 a+b', match('*://example.com/a+b/*', 'https://example.com/a+b/'));
assert('规则-005: {2} 匹配字面量 {2}', match('*://example.com/a{2}/*', 'https://example.com/a{2}/'));
assert('规则-008: a$b 匹配字面量 a$b', match('*://example.com/a$b/*', 'https://example.com/a$b/'));
assert('规则-009: 路径点号转义(file.txt 不匹配 filextxt)', !match('*://example.com/file.txt', 'https://example.com/filextxt'));
assert('规则-010: 路径点号正常匹配(file.txt)', match('*://example.com/file.txt', 'https://example.com/file.txt'));

// 原有规则回退
assert('规则-011: *.example.com 匹配子域', match('*://*.example.com/*', 'https://foo.example.com/x'));
assert('规则-012: example.com 不匹配 exampleXcom', !match('*://example.com/*', 'https://exampleXcom/'));
assert('规则-013: 星号仍为通配', match('*://example.com/a/*/b', 'https://example.com/a/xyz/b'));
assert('规则-014: 问号为字面量', match('*://example.com/a?b', 'https://example.com/a?b'));
assert('规则-015: 问号不是单字符通配', !match('*://example.com/a?b', 'https://example.com/axb'));
assert('规则-016: 保留用户转义点', match('*://example\\.com/*', 'https://example.com/'));
assert('规则-017: 显式 scheme 可用', match('https://example.com/*', 'https://example.com/x'));
assert('规则-018: 无斜杠模式点号转义', !api.safeRegexTest(new RegExp(api.wildcardToRegex('example.com')), 'exampleXcom'));
assert('规则-019: 中文域名通配匹配 punycode', match('*://*.例子.com/*', 'https://xn--fsqu00a.com/x'));

assert('审查8-W2(对照): 等价写法 * 与 *://*.*/* 命中', match('*', 'https://www.example.com/x') && match('*://*.*/*', 'https://www.example.com/x'));

// 锚定与通配范围
assert('规则-022: 路径模式匹配自身', match('*://example.com/path/*', 'https://example.com/path/x'));
assert('规则-023: 路径模式匹配 http', match('*://example.com/path/*', 'http://example.com/path/x'));
assert('规则-024: 路径模式不匹配 query 中的伪 URL', !match('*://example.com/path/*', 'https://evil.com/?u=example.com/path/'));
assert('规则-025: 路径模式不匹配前缀域名', !match('*://example.com/path/*', 'https://evil.com/example.com/path/x'));
assert('规则-026: 主机通配不跨越路径', !match('*://*.example.com/path/*', 'https://evil.com/x.example.com/path/'));
assert('规则-027: 主机通配仍匹配多级子域', match('*://*.example.com/path/*', 'https://a.b.example.com/path/x'));
assert('规则-028: 显式 scheme 不匹配其他 scheme', !match('https://example.com/*', 'http://example.com/'));
assert('规则-029: 无 scheme 通配仍可用', match('*example*', 'https://any.example.org/x'));

// 裸域匹配(apex)
assert('规则-030: 裸域名规则匹配裸域', match('example.com', 'https://example.com/'));
assert('规则-031: 裸域名规则匹配子域', match('example.com', 'https://www.example.com/'));
assert('规则-032: *.路径模式匹配裸域', match('*://*.example.com/path/*', 'https://example.com/path/x'));
assert('规则-035: 精确域名规则不匹配子域', !match('*://example.com/*', 'https://www.example.com/'));

// 无scheme主机语义与无路径边界
assert('规则-036: 无scheme *.域 匹配子域', match('*.example.com', 'https://foo.example.com/x'));
assert('规则-037: 无scheme *.域 匹配裸域', match('*.example.com', 'https://example.com/'));
assert('规则-038: 无scheme *.域 不匹配前缀域名', !match('*.example.com', 'https://notexample.com/'));
assert('规则-039: 无scheme *.域 不匹配其他站路径', !match('*.example.com', 'https://evil.com/?u=example.com'));
assert('规则-040: 无scheme *.域 直接匹配域名输入', match('*.example.com', 'sub.example.com'));
assert('规则-041: 无路径规则匹配自身', match('*://example.com', 'https://example.com/'));
assert('规则-042: 无路径规则匹配子路径', match('*://example.com', 'https://example.com/path/x'));
assert('规则-043: 无路径规则不匹配后缀域名', !match('*://example.com', 'https://example.com.evil.com/'));
assert('规则-044: 无路径规则匹配子域与端口', match('*://*.example.com', 'https://a.example.com:8080/'));
assert('规则-047: 显式指定端口的路径规则匹配同端口', match('*://example.com:8080/path/*', 'https://example.com:8080/path/test'));
assert('规则-048: 显式指定端口的路径规则不匹配不同端口', !match('*://example.com:8080/path/*', 'https://example.com:9000/path/test'));
assert('规则-049: 显式指定端口的路径规则不匹配无端口', !match('*://example.com:8080/path/*', 'https://example.com/path/test'));
assert('规则-050: 无scheme 路径规则按主机匹配首段', match('*.example.com/path/*', 'https://sub.example.com/path/x'));
assert('规则-052: 精确路径模式不误匹配同名前缀路径', !match('*://example.com/test', 'https://example.com/testing-other'));
assert('规则-053: 精确路径模式匹配自身及子路径', match('*://example.com/test', 'https://example.com/test') && match('*://example.com/test', 'https://example.com/test/sub'));

// ---- 正则 s 标志 ----
assert('规则-054: title 转义点 + s 正常匹配', match('title/example\\.com/s', 'example.com'));
assert('规则-056: s 使点号匹配换行', match('title/foo.bar/s', 'foo\nbar'));
assert('规则-057: 无 s 时点号不匹配换行', !match('title/foo.bar/', 'foo\nbar'));
assert('规则-058: 字符类内点号保持字面量', match('title/[.]com/s', 'a.com'));
assert('规则-059: 转义点不匹配任意字符', !match('title/a\\.b/s', 'axb'));
assert('规则-060: s 标志保留', (() => {
  const parsed = api.parsePrefixedRegexRule('title/foo/s', 6);
  return parsed.flags === 's' && parsed.pattern === 'foo';
})());
assert('规则-061: 多标志保留', (() => {
  const compiled = api.compileRuleRegex('title/foo/is');
  return compiled.regex.flags.includes('i') && compiled.regex.flags.includes('s');
})());
assert('规则-063: 尾部非flag斜杠路径保持完整', (() => {
  const parsed = api.parsePrefixedRegexRule('title/something/is/other', 6);
  return parsed.flags === '' && parsed.pattern === 'something/is/other';
})());
assert('规则-064: 转义斜杠不被误识别为flag分隔符', (() => {
  const parsed = api.parsePrefixedRegexRule('title/https:\\/\\/foo\\/i', 6);
  return parsed.flags === '' && parsed.pattern === 'https:\\/\\/foo\\/i';
})());
assert('规则-065: 正常末尾未转义斜杠正确提取flags', (() => {
  const parsed = api.parsePrefixedRegexRule('title/https:\\/\\/foo/i', 6);
  return parsed.flags === 'i' && parsed.pattern === 'https:\\/\\/foo';
})());
assert('规则-066: 偶数个反斜杠末尾斜杠正常剥离定界符', (() => {
  const parsed = api.parsePrefixedRegexRule('title/foo\\\\/', 6);
  return parsed.flags === '' && parsed.pattern === 'foo\\\\';
})());
assert('规则-067: 奇数个反斜杠末尾斜杠作为转义斜杠保留', (() => {
  const parsed = api.parsePrefixedRegexRule('title/foo\\/', 6);
  return parsed.flags === '' && parsed.pattern === 'foo\\/';
})());
assert('规则-068: 旧式 (?s) 前缀仍可用', match('title/(?s)foo.bar/', 'foo\nbar'));
assert('规则-069: 大写I当作i', (() => {
  const parsed = api.parsePrefixedRegexRule('title/foo/I', 6);
  return parsed.flags === 'i' && parsed.pattern === 'foo';
})());
assert('规则-071: /pattern/I 编译不抛错', (() => {
  const compiled = api.compileRuleRegex('/FOO/I');
  return compiled.regex.flags.includes('i') && compiled.regex.test('foo');
})());
assert('规则-072: 尾部非flag字母组合保持为pattern', (() => {
  const parsed = api.parsePrefixedRegexRule('title/abc/def', 6);
  return parsed.flags === '' && parsed.pattern === 'abc/def';
})());
assert('规则-075: 编译过滤保留合法flags去除非法', (() => {
  const flags = api.compileRuleRegex('/foo/gyi').regex.flags;
  return flags.includes('i') && !flags.includes('g') && !flags.includes('y');
})());
assert('规则-076: 未闭合正则 /foo 编译报错(与校验口径一致)', (() => {
  try { api.compileRuleRegex('/foo'); return false; } catch (e) { return true; }
})());

// ---- 审查11-R2: 修复回归(尾点FQDN正则路径与快路径口径一致; R1/R3 本轮未修复, 留档项已清理) ----
assert('审查11-R2(已修复): 带路径通配规则对尾点FQDN example.com. 正常匹配', (() => {
  const ta = new Function(extractFn(src, 'hostLabelToASCII') + '\n' + extractFn(src, 'toASCIIHostname') + '\nreturn toASCIIHostname;')();
  return ta('example.com.') === 'example.com' && match('*://*.example.com/path/*', 'https://example.com./path/x');
})());

// 主机非前缀星号不跨点（*.example.* 只匹配到二级+顶级域）
assert('规则-077: *.example.* 匹配主域', match('*://*.example.*/*', 'https://example.com/'));
assert('规则-078: *.example.* 匹配子域', match('*://*.example.*/*', 'https://a.example.com/'));
assert('规则-079: *.example.* 带路径不匹配多段后缀', !match('*://*.example.*/*', 'https://example.com.evil.net/'));
assert('规则-081: example.* 不匹配多段后缀', !match('*://example.*/*', 'https://example.com.evil.net/'));
assert('规则-082: 中部主机星号不跨点', !match('*://mail.*.com/*', 'https://mail.a.b.com/') && match('*://mail.*.com/*', 'https://mail.a.com/'));
assert('规则-083: 整体主机星号匹配多标签主机但不跨路径', match('*://*/x/*', 'https://any.host.com/x/1') && match('*://*/x/*', 'https://host/x/1') && !match('*://*/x/*', 'https://any.host.com/y/1'));
assert('规则-085: 端口通配不跨越路径', !match('*://example.com:*/y', 'https://example.com:80/x/y'));
assert('规则-086: 端口通配匹配端口段内容', match('*://example.com:*/y', 'https://example.com:8080/y'));
assert('规则-088: 端口通配不跨越冒号至主机', !match('*://example.com:*/y', 'https://example.com/x/y'));
assert('规则-089: *.example.* 匹配二段后缀(co.uk)', match('*://*.example.*/*', 'https://www.example.co.uk/page'));
assert('规则-091: example.* 尾部星号匹配二段后缀', match('*://example.*/*', 'https://example.com.au/x'));
assert('规则-092: *.example.* 不匹配三段后缀', !match('*://*.example.*/*', 'https://example.a.b.c/'));
})();

// ---- 规则-094~105: 订阅规则过滤 ----
await (async () => {
const fns = [
  'hostLabelToASCII', 'toASCIIHostname', 'toASCIIUrl', 'safeRegexTest', 'stripRuleComment', 'parseRulesetContent', 'extractYamlRuleItems', 'getInvalidRegexFlags', 'parseConditionPart',
  'tokenizeCondExpr', 'parseCondExprTokens', 'analyzeCondExpr', 'foldCondExpr',
  'evalDynamicLeaf', 'evalCondAST', 'extractBalancedParens', 'findIfOccurrences',
  'stripIfConditions', 'isCondExprCore', 'looksLikeCondExpr', 'isScriptRuleLine', 'isElementRuleLine',
  'absorbStandaloneExpr', 'parseRuleWithConditions', 'extractIfConditions', 'validateCondition',
  'analyzeRule', 'validateRule', 'parsePrefixedRegexRule', 'escapeWildcardPart', 'wildcardToRegex',
  'ruleToRegex', 'validateUrlWildcard', 'evaluateCondition', 'collectSubscriptionRules',
].map((n) => extractFn(src, n));

const consts = src.match(/const SUPPORTED_REGEX_FLAGS = 'imsu';/)[0];
const langMatch = src.match(/const LANG_TEXTS = \{[\s\S]*?\n  \};/)[0];

const moduleBody = `
${consts}
${langMatch}
const window = { location: { hostname: 'www.google.com', pathname: '/search', search: '?q=x', href: 'https://www.google.com/search?q=x' } };
function getSearchEngine() { return 'google'; }
function getSearchCategory() { return 'web'; }
const currentConfig = { debug: false };
function t(key, params = {}) {
  const texts = LANG_TEXTS['zh-CN'] || {};
  let text = texts[key] || key;
  for (const [k, v] of Object.entries(params)) text = text.replaceAll('{' + k + '}', v);
  return text;
}
${fns.join('\n')}
return { collectSubscriptionRules, parseRulesetContent, isScriptRuleLine, isElementRuleLine, validateRule, validateUrlWildcard };
`;
const api = new Function(moduleBody)();



// ---- 元素规则判定(uBO DOM 规则) ----
// (同构矩阵精简: 保留 ##/空host/#$#/#?#嵌套/#%# 各代表形态)
const elementRules = [
  'example.com##.ad',
  '##.ad',
  'example.com#$#alert(1)',
  'example.com#?#div:has(> span)',
  'example.com#%#window.x=1',
];
elementRules.forEach((rule, i) => {
  assert(`规则-094-${i + 1}: 元素规则跳过 ${rule}`, api.isElementRuleLine(rule) === true);
});

const scriptRules = [
  '/foo##bar/',
  '*://example.com/##x',
  '@*://example.com/*',
  '*://*.example.com/*',
];
scriptRules.forEach((rule, i) => {
  assert(`规则-095-${i + 1}: 脚本规则保留 ${rule}`, api.isElementRuleLine(rule) === false);
});

// ---- 订阅规则过滤(保留) ----
// (同构矩阵精简: 保留 条件/括号或/普通URL/@N白名单/嵌套@if/尾注释 各代表形态)
const keep = [
  '!scheme="https"',
  '!(title *= "x" | url *= "y")',
  '*://*.example.com/*',
  '@1*://example.com/*',
  '*://x.com/* @if(title *= "@if(y)")',
  '*://x.com/* # comment',
];
keep.forEach((line, i) => {
  assert(`规则-096-${i + 1}: 订阅保留 ${line}`, api.collectSubscriptionRules([line]).length === 1);
});

// ---- 订阅规则过滤(丢弃) ----
const drop = [
  '! comment',
  '[Adblock Plus 2.0]',
  'example.com##.ad',
  '*://bad domain/*',
];
drop.forEach((line, i) => {
  assert(`规则-097-${i + 1}: 订阅跳过 ${line}`, api.collectSubscriptionRules([line]).length === 0);
});

// ---- uBO 网络过滤规则拒绝(回归) ----
const networkDrop = [
  '||example.com^',
];
networkDrop.forEach((line, i) => {
  assert(`规则-098-${i + 1}: 跳过uBO网络规则 ${line}`, api.collectSubscriptionRules([line]).length === 0);
  assert(`规则-099-${i + 1}: 校验拒绝 ${line}`, api.validateUrlWildcard(line) === false && api.validateRule(line) === false);
});

const networkKeep = [
  '*://example.com/a|b/*',
  'example.com',
];
networkKeep.forEach((line, i) => {
  assert(`规则-100-${i + 1}: 管道符路径仍有效 ${line}`, api.validateRule(line) === true);
});

// ---- frontmatter 剥离 ----
const content = '---\nname: Test\n---\n# c\n!scheme="https"\n*://*.example.com/*\n';
const { lines, meta } = api.parseRulesetContent(content);
const collected = api.collectSubscriptionRules(lines.map((l) => l.trim()));
assert('规则-101: frontmatter 剥离', meta.name === 'Test');
assert('规则-102: 组合过滤结果', JSON.stringify(collected) === JSON.stringify(['!scheme="https"', '*://*.example.com/*']));

// YAML 订阅端到端：提取+过滤
const yParsed = api.parseRulesetContent('name: Y List\nrules:\n  - example.com\n  - \'*://*.example.com/*\'\n  - example.com##.ad\n  - @@||blocked.com^\n  - ||ubo.com^\n');
const yCollected = api.collectSubscriptionRules(yParsed.lines.map((l) => l.trim()));
assert('规则-103: YAML订阅提取与过滤', yParsed.meta.name === 'Y List' && JSON.stringify(yCollected) === JSON.stringify(['example.com', '*://*.example.com/*']));
const yWl = api.parseRulesetContent('name: Mix\nblacklist:\n  - ads.com\nrules:\n  - extra.com\nwhitelist:\n  - good.com\n  - "*://ok.com/*"\n');
const yWlCollected = api.collectSubscriptionRules(yWl.lines.map((l) => l.trim()));
assert('规则-104: YAML多段+whitelist加@', JSON.stringify(yWlCollected) === JSON.stringify(['ads.com', 'extra.com', '@good.com', '@*://ok.com/*']));
assert('规则-105: 无引号中文@if可订阅', api.collectSubscriptionRules(['*://*.example.com/* @if(title *= 广告)']).length === 1);
const yCondParsed = api.parseRulesetContent('name: Cond List\nrules:\n  - title: /广告/\n  - host: bad.com\n  - category: news\n  - !host $= ".spam.com"\n  - title *= "推广"\n');
const yCondCollected = api.collectSubscriptionRules(yCondParsed.lines.map((l) => l.trim()));
assert('规则-105-2: YAML映射形项丢弃、操作符条件保留', JSON.stringify(yCondCollected) === JSON.stringify(['!host $= ".spam.com"', 'title *= "推广"']));
})();

// ---- 规则-106~127: 规则来源标记 ----
await (async () => {
const fns = [
  'hostLabelToASCII', 'toASCIIHostname', 'toASCIIUrl', 'safeRegexTest', 'safeDecodeURIComponent', 'stripRuleComment', 'getInvalidRegexFlags', 'parseConditionPart',
  'tokenizeCondExpr', 'parseCondExprTokens', 'analyzeCondExpr', 'foldCondExpr',
  'evalDynamicLeaf', 'evalCondAST', 'extractBalancedParens', 'findIfOccurrences', 'stripIfConditions',
  'evaluateCondition', 'isCondExprCore', 'looksLikeCondExpr', 'absorbStandaloneExpr',
  'parseRuleWithConditions', 'validateUrlWildcard', 'ruleToRegex', 'parsePrefixedRegexRule',
  'escapeWildcardPart', 'wildcardToRegex', 'normalizeHostCandidate', 'matchWildcardDomainPattern', 'extractSimpleWhitelistDomain', 'matchSimpleDomain',
  'compileRuleRegex', 'checkDynamicConditions', 'matchDomainEntryType', 'buildRuleIndex', 'newCompiledRules',
  'extractIfConditions', 'validateCondition', 'analyzeRule', 'validateRule',
  'checkRuleMatchOptimized', 'isLocalEntry',
].map((n) => extractFn(src, n));

const consts = src.match(/const SUPPORTED_REGEX_FLAGS = 'imsu';/)[0];
const langMatch = src.match(/const LANG_TEXTS = \{[\s\S]*?\n  \};/)[0];

const moduleBody = `
${consts}
${langMatch}
let compiledRules;
const validationCache = new Map();
const subdomainCache = new Map();
let currentEngine = 'google';
let currentSite = 'www.google.com';
let currentCategory = 'web';
const window = { location: { get hostname() { return currentSite; } } };
function getSearchEngine() { return currentEngine; }
function getSearchCategory() { return currentCategory; }
function t(key, params = {}) {
  const texts = LANG_TEXTS['zh-CN'] || {};
  let text = texts[key] || key;
  for (const [k, v] of Object.entries(params)) text = text.replaceAll('{' + k + '}', v);
  return text;
}
const currentConfig = { rules: [], debug: false };
let subscriptions = [];
function getSubscriptions() { return subscriptions; }
function getAllSubscriptionRules() {
  const rules = [];
  subscriptions.filter(s => s.enabled).forEach(s => {
    if (s.rules && Array.isArray(s.rules)) rules.push(...s.rules);
  });
  return rules;
}
${fns.join('\n')}
return {
  buildRuleIndex,
  checkRuleMatchOptimized,
  getCR: () => compiledRules,
  setState: (rules, subs) => { currentConfig.rules = rules; subscriptions = subs; },
};
`;

const api = new Function(moduleBody)();


[false, true].forEach((subscription, si) => {
  ['', ' @if(title *= "t")'].forEach((suffix, zi) => {
    ['', '@'].forEach((prefix, pi) => {
      const rules = (prefix === '@' ? ['*://example.com/*'] : []).concat(prefix + '/^example[.]com$/' + suffix);
      api.setState(subscription ? [] : rules, subscription ? [{ enabled: true, rules }] : []);
      api.buildRuleIndex();
      const result = api.checkRuleMatchOptimized('https://example.com/x', 'example.com', 't', '', ['example.com']);
      assert(`规则-106-${si * 6 + zi * 3 + pi + 1}: URL正则不补测域名 ${subscription}/${prefix}/${suffix}`, prefix === '@' ? result.blocked === true : !result);
    });
  });
});

// 本地与订阅重复规则：来源必须按位置区分
api.setState(
  ['@*://*.example.com/*', '*://*.example.com/*'],
  [{ url: 's1', enabled: true, rules: ['@*://*.example.com/*'] }],
);
api.buildRuleIndex();
let cr = api.getCR();
const wl = cr.whitelistDomains.get('example.com') || [];
assert('规则-107: 本地白名单标记为本地来源', wl.some(e => e.source === '本地规则'));
assert('规则-108: 订阅白名单标记为订阅来源', wl.some(e => e.source === '订阅1'));
const bl = cr.domains.get('example.com') || [];
assert('规则-109: 本地黑名单标记为本地来源', bl.some(e => e.source === '本地规则'));
const r4 = api.checkRuleMatchOptimized('https://example.com/', 'example.com', 't', null, ['example.com']);
assert('规则-110: 重复规则不再丢失本地白名单优先级', !r4 || r4.blocked !== true);

// 本地/订阅各自独有规则
api.setState(['*://*.local.com/*'], [{ url: 's1', enabled: true, rules: ['*://*.sub.com/*'] }]);
api.buildRuleIndex();
cr = api.getCR();
assert('规则-111: 本地独有规则来源正确', cr.domains.get('local.com')[0].source === '本地规则');
assert('规则-112: 订阅独有规则来源正确', cr.domains.get('sub.com')[0].source === '订阅1');

// 禁用订阅跳过，标签保留原始序号
api.setState([], [
  { url: 's1', enabled: false, rules: ['*://*.off.com/*'] },
  { url: 's2', enabled: true, rules: ['*://*.on.com/*'] },
]);
api.buildRuleIndex();
cr = api.getCR();
assert('规则-113: 禁用订阅不加载', !cr.domains.has('off.com'));
assert('规则-114: 启用订阅保留原始序号标签', cr.domains.get('on.com')[0].source === '订阅2');

// @N+白名单组合同时编译为高亮和白名单
api.setState(['@1 @*://*.bad.com/*', '@2 @host $= ".bad2.com"', '@3 *://*.good.com/*'], []);
api.buildRuleIndex();
cr = api.getCR();
assert('规则-115: 高亮+白名单同时编译', cr.highlightDomains.has('bad.com') && cr.whitelistDomains.has('bad.com') && cr.highlightConditionalRules.some(e => e.N === 2) && cr.whitelistConditionalRules.length === 1);
assert('规则-116: 正常高亮域名规则不受影响', cr.highlightDomains.has('good.com'));

// @N 前缀需要分隔符：@数字后紧跟字母视为白名单域名规则
api.setState(['@2fast.com'], []);
api.buildRuleIndex();
cr = api.getCR();
assert('规则-117: @2fast.com 不再误判为高亮', !cr.highlightDomains.has('fast.com'));
assert('规则-118: @2fast.com 按白名单域名解析', cr.whitelistDomains.has('2fast.com'));
api.setState(['@2 fast.com'], []);
api.buildRuleIndex();
cr = api.getCR();
assert('规则-119: @2 fast.com 仍为高亮', cr.highlightDomains.has('fast.com'));
api.setState(['@7example.com'], []);
api.buildRuleIndex();
cr = api.getCR();
assert('规则-121: @N 高亮 N 越界仍跳过', (() => {
  api.setState(['@9 fast9.com'], []);
  api.buildRuleIndex();
  const c = api.getCR();
  return !c.highlightDomains.has('fast9.com');
})());

// 修复H: @Ntitle/@Ntext 无空格识别为高亮
api.setState(['@1title/abc/', '@2text/x.*/i'], []);
api.buildRuleIndex();
cr = api.getCR();
assert('修复H-1: @1title/ 无空格识别为标题高亮', cr.highlightTitles.length === 1 && cr.whitelistUrlPatterns.length === 0 && cr.whitelistTitlePatterns.length === 0);
assert('修复H-2: @2text/ 无空格识别为摘要高亮', cr.highlightTexts.length === 1);
api.setState(['@1 title/abc/'], []);
api.buildRuleIndex();
cr = api.getCR();
assert('修复H-3: 带空格写法行为不变', cr.highlightTitles.length === 1);

// 修复回归: 索引入口跳过校验无效规则(校验与匹配口径统一)
api.setState(['*://**.com/*', 'title/foo/gi', '/abc/gi', '/foo'], []);
api.buildRuleIndex();
cr = api.getCR();
assert('规则-122: *://**.com/* 不再被索引(误屏蔽所有.com)', cr.urls.length === 0 && cr.titles.length === 0);
assert('规则-123: title/foo/gi 不再被索引(字面量误匹配)', cr.urls.length === 0 && cr.titles.length === 0);
assert('规则-124: /abc/gi 不再被索引(非法flags静默清洗)', cr.urls.length === 0 && cr.titles.length === 0);
assert('规则-125: /foo 不再被索引(未闭合正则)', cr.urls.length === 0 && cr.titles.length === 0);
api.setState(['*://*.good-v.com/*', '@2 /^blocked[.]com$/'], []);
api.buildRuleIndex();
cr = api.getCR();
assert('规则-126: 同批合法规则不受影响', cr.domains.has('good-v.com'));
assert('规则-127: 同批合法高亮规则不受影响', cr.highlightUrls.length === 1);
})();

// ---- 规则-128~154: 优先级 ----
await (async () => {
const fns = ['safeRegexTest', 'matchDomainEntryType', 'checkDynamicConditions', 'toASCIIHostname', 'hostLabelToASCII', 'isLocalEntry']
  .map((n) => extractFn(src, n));

const crmMarker = 'function checkRuleMatchOptimized(';
const crmStart = src.indexOf(crmMarker);
const crmOpen = src.indexOf('{', crmStart);
let depth = 0, crmEnd = crmOpen;
for (let i = crmOpen; i < src.length; i++) {
  if (src[i] === '{') depth++;
  else if (src[i] === '}') { depth--; if (depth === 0) { crmEnd = i + 1; break; } }
}
const checkFn = src.slice(crmStart, crmEnd);

const langMatch = src.match(/const LANG_TEXTS = \{[\s\S]*?\n  \};/)[0];

// Build module: all functions share the same scope with `compiledRules` via closure
const moduleBody = `
let compiledRules;
${fns.join('\n')}
${checkFn}
${langMatch}
const t = (key) => (LANG_TEXTS['zh-CN'] || {})[key] || key;
return { safeRegexTest, matchDomainEntryType, checkDynamicConditions, checkRuleMatchOptimized, t, setCR: (cr) => { compiledRules = cr; } };
`;

const env = new Function(moduleBody)();

function doCheck(cr, url, host, title, snippet, sl) {
  env.setCR(cr);
  return env.checkRuleMatchOptimized(url, host, title, snippet, sl);
}


function makeCR() {
  return {
    domains: new Map(), urls: [], titles: [], texts: [],
    whitelistDomains: new Map(), whitelistUrlPatterns: [], whitelistTitlePatterns: [], whitelistTextPatterns: [],
    whitelistConditionalDomains: new Map(), whitelistConditionalRules: [],
    conditionalRules: [], conditionalDomains: new Map(),
    highlightDomains: new Map(), highlightUrls: [], highlightTitles: [], highlightTexts: [],
    highlightConditionalRules: [], highlightConditionalDomains: new Map(),
  };
}

function isBlocked(r) { return r && r.blocked === true; }
function getSrc(r) { return r ? r.source : null; }

function addWlDomain(cr, domain, type) {
  if (!cr.whitelistDomains.has(domain)) cr.whitelistDomains.set(domain, []);
  cr.whitelistDomains.get(domain).push({type, source: '本地规则'});
}
function addWlDomainSub(cr, domain, type) {
  if (!cr.whitelistDomains.has(domain)) cr.whitelistDomains.set(domain, []);
  cr.whitelistDomains.get(domain).push({type, source: '订阅规则1'});
}
function addWlUrl(cr, pattern) {
  cr.whitelistUrlPatterns.push({regex: new RegExp(pattern), source: '本地规则'});
}
function addWlUrlSub(cr, pattern) {
  cr.whitelistUrlPatterns.push({regex: new RegExp(pattern), source: '订阅规则1'});
}
function addBlDomain(cr, domain, type, rule, source) {
  if (!cr.domains.has(domain)) cr.domains.set(domain, []);
  cr.domains.get(domain).push({type, originalRule: rule, source});
}
function addBlUrl(cr, pattern, rule, source) {
  cr.urls.push({regex: new RegExp(pattern), originalRule: rule, source});
}
function addBlTitle(cr, pattern, rule, source) {
  cr.titles.push({regex: new RegExp(pattern), originalRule: rule, source});
}
function addBlText(cr, pattern, rule, source) {
  cr.texts.push({regex: new RegExp(pattern), originalRule: rule, source});
}

const host = 'www.example.com';
const url = 'https://www.example.com/page';
const sl = ['www.example.com', 'example.com'];

let cr, r;

// ==================== 基础 ====================
cr = makeCR();
assert('规则-128: 无规则 → 不屏蔽', !isBlocked(doCheck(cr, url, host, 'title', null, sl)));

// ==================== 核心优先级 ====================
cr = makeCR();
addWlDomain(cr, 'example.com', 'wildcard');
addBlDomain(cr, 'example.com', 'wildcard', 'example.com', '本地规则');
assert('规则-131: 本地白名单 > 本地黑名单', !isBlocked(doCheck(cr, url, host, 'title', null, sl)));

cr = makeCR();
addBlDomain(cr, 'example.com', 'wildcard', 'example.com', '本地规则');
addWlDomainSub(cr, 'example.com', 'wildcard');
assert('规则-132: 本地黑名单 > 订阅白名单', isBlocked(doCheck(cr, url, host, 'title', null, sl)));

cr = makeCR();
addWlDomain(cr, 'example.com', 'wildcard');
addBlDomain(cr, 'example.com', 'wildcard', 'example.com', '订阅规则1');
assert('规则-133: 白名单 > 订阅黑名单', !isBlocked(doCheck(cr, url, host, 'title', null, sl)));

// ==================== URL pattern ====================
cr = makeCR();
addWlUrl(cr, 'example\\.com');
addBlUrl(cr, 'example\\.com', 'example.com', '本地规则');
assert('规则-134: URL白名单 > URL本地黑名单', !isBlocked(doCheck(cr, url, host, 'title', null, sl)));

cr = makeCR();
addBlUrl(cr, 'example\\.com', 'example.com', '本地规则');
addWlUrlSub(cr, 'example\\.com');
r = doCheck(cr, url, host, 'title', null, sl);
assert('规则-135: URL本地黑名单 > URL订阅白名单', isBlocked(r) && getSrc(r) === '本地规则');

// ==================== 不同域名 ====================
cr = makeCR();
addBlDomain(cr, 'example.com', 'wildcard', 'example.com', '本地规则');
addWlDomain(cr, 'other.com', 'wildcard');
assert('规则-137: 不匹配的白名单不影响本地黑名单', isBlocked(doCheck(cr, url, host, 'title', null, sl)));

// ==================== 订阅黑名单（阶段5）====================
cr = makeCR();
addBlDomain(cr, 'example.com', 'wildcard', 'example.com', '订阅规则1');
r = doCheck(cr, url, host, 'title', null, sl);
assert('规则-138: 订阅黑名单 → 屏蔽', isBlocked(r) && getSrc(r) === '订阅规则1');

// ==================== 本地黑名单正常阶段3处理 ====================
cr = makeCR();
addBlDomain(cr, 'example.com', 'wildcard', 'example.com', '本地规则');
r = doCheck(cr, url, host, 'title', null, sl);
assert('规则-141: 本地黑名单正常屏蔽（阶段3）', isBlocked(r) && getSrc(r) === '本地规则');

// ==================== 标题/文本规则 ====================
cr = makeCR();
addBlTitle(cr, 'blocked', '标题规则', '本地规则');
assert('规则-142: 本地标题黑名单 → 屏蔽', isBlocked(doCheck(cr, url, host, 'blocked title', null, sl)));

cr = makeCR();
addBlText(cr, 'blocked', '文本规则', '本地规则');
assert('规则-144: 本地文本黑名单 → 屏蔽', isBlocked(doCheck(cr, url, host, 'title', 'blocked snippet', sl)));

cr = makeCR();
addBlText(cr, 'blocked', '文本规则', '订阅规则1');
r = doCheck(cr, url, host, 'title', 'blocked snippet', sl);
assert('规则-145: 订阅文本黑名单 → 屏蔽', isBlocked(r) && getSrc(r) === '订阅规则1');

// ==================== 混合来源：本地 + 订阅同时存在 ====================
cr = makeCR();
addBlDomain(cr, 'example.com', 'wildcard', 'local-domain', '本地规则');
addBlDomain(cr, 'example.com', 'wildcard', 'sub-domain', '订阅规则1');
r = doCheck(cr, url, host, 'title', null, sl);
assert('规则-146: 本地和订阅都匹配时，返回本地规则（阶段3优先）', isBlocked(r) && getSrc(r) === '本地规则');

// ==================== 阶段5仅匹配订阅，不再重复匹配本地 ====================
cr = makeCR();
addBlUrl(cr, 'example\\.com/page', 'example.com/page', '订阅规则1');
r = doCheck(cr, url, host, 'title', null, sl);
assert('规则-147: 仅订阅URL黑名单可独立屏蔽（阶段5订阅路径）', isBlocked(r) && getSrc(r) === '订阅规则1');

// ==================== 订阅白名单可以阻止订阅黑名单 ====================
cr = makeCR();
addWlUrlSub(cr, 'example\\.com');
addBlUrl(cr, 'example\\.com', 'example.com', '订阅规则1');
assert('规则-148: 订阅白名单 > 订阅黑名单', !isBlocked(doCheck(cr, url, host, 'title', null, sl)));

// ==================== exact 类型域名匹配 ====================
// exact 类型只精确匹配 level === lowerDomain，不跨子域
cr = makeCR();
addBlDomain(cr, 'www.example.com', 'exact', 'www.example.com', '订阅规则1');
r = doCheck(cr, url, host, 'title', null, ['www.example.com', 'example.com']);
assert('规则-149: 订阅精确域名(exact)匹配自身 → 屏蔽', isBlocked(r) && getSrc(r) === '订阅规则1');

cr = makeCR();
addBlDomain(cr, 'other.com', 'exact', 'other.com', '订阅规则1');
r = doCheck(cr, url, host, 'title', null, ['www.example.com', 'example.com']);
assert('规则-150: 订阅精确域名(exact)不匹配其他域名', !isBlocked(r));

// ==================== 空 snippet 不触发文本匹配 ====================
cr = makeCR();
addBlText(cr, 'something', 'text-rule', '订阅规则1');
assert('规则-151: snippet为空时不匹配文本规则', !isBlocked(doCheck(cr, url, host, 'title', null, sl)));

// ==================== 高亮与屏蔽共存 ====================
cr = makeCR();
cr.highlightDomains.set('example.com', [{N: 2, type: 'wildcard'}]);
addBlDomain(cr, 'example.com', 'wildcard', 'example.com', '本地规则');
r = doCheck(cr, url, host, 'title', null, sl);
assert('规则-152: 高亮+屏蔽同时返回', r && r.highlight === 2 && r.blocked === true);

cr = makeCR();
cr.highlightDomains.set('example.com', [{N: 3, type: 'wildcard'}]);
r = doCheck(cr, url, host, 'title', null, sl);
assert('规则-153: 仅高亮无屏蔽', r && r.highlight === 3 && !r.blocked);

cr = makeCR();
cr.conditionalRules.push({
  type: 'expr',
  originalRule: 'host $= ".example.com"',
  source: env.t('localRule'),
  isLocal: false,
  conditions: [],
});
r = doCheck(cr, url, host, 'title', null, sl);
assert('规则-154: 订阅条件黑名单用isLocal不看语言文案', isBlocked(r) && r.source === env.t('localRule'));
})();

// ---- 规则-155~167 + 审查3-T*: 导入取消 / TXT导入读取# ScriptConfig头 ----
await (async () => {
const parseSyncHeaderFn = extractFn(src, 'parseSyncHeader');
const getSyncSettingsFn = extractFn(src, 'getSyncSettings');
const importRulesFromFileFn = extractFn(src, 'importRulesFromFile');
const pickTextFileFn = extractFn(src, 'pickTextFile');
const cfgDefaults = src.match(/const CFG_DEFAULTS = \{[^\n]+\};/)[0];
const defHl = src.match(/const DEFAULT_HIGHLIGHT_COLORS = \{[^\n]+\};/)[0];
const normalizeConfigFn = extractFn(src, 'normalizeConfig');


function createEnv() {
  const env = {
    bodyChildren: [],
    windowListeners: {},
    textarea: { value: '' },
    hooks: { updateLineNumbersCalls: 0, written: [] },
    input: null,
  };

  const fakeInput = {
    type: '',
    accept: '',
    style: {},
    files: [],
    parentElement: null,
    onchange: null,
    listeners: {},
    addEventListener(type, fn) {
      (this.listeners[type] = this.listeners[type] || []).push(fn);
    },
    remove() {
      const idx = env.bodyChildren.indexOf(this);
      if (idx !== -1) env.bodyChildren.splice(idx, 1);
      this.parentElement = null;
    },
    click() {},
  };
  env.input = fakeInput;

  const documentStub = {
    body: {
      appendChild(el) {
        el.parentElement = documentStub.body;
        env.bodyChildren.push(el);
        return el;
      },
    },
    createElement(tag) { return tag === 'input' ? fakeInput : {}; },
    getElementById(id) { return id === 'serh-rules' ? env.textarea : null; },
  };

  const windowStub = {
    addEventListener(type, fn) {
      (env.windowListeners[type] = env.windowListeners[type] || []).push(fn);
    },
    removeEventListener(type, fn) {
      const arr = env.windowListeners[type] || [];
      const idx = arr.indexOf(fn);
      if (idx !== -1) arr.splice(idx, 1);
    },
  };

  class FakeFileReader {
    readAsText(fileToRead) {
      this.result = fileToRead._content;
      if (this.onload) this.onload({ target: this });
    }
  }

  const factory = new Function('document', 'window', 'FileReader', 'currentConfig', 'hooks', `
    let preventPanelClose = false;
    ${parseSyncHeaderFn}
    ${getSyncSettingsFn}
    ${pickTextFileFn}
    function updateLineNumbers() { hooks.updateLineNumbersCalls++; }
    function GM_setValue(key, val) { hooks.written.push({ key, val }); }
    function filterValidRuleLines(lines) { return lines.map(line => line.trim()).filter(line => line.length > 0); }
    function forceReprocessAll() { hooks.reprocessCalls = (hooks.reprocessCalls || 0) + 1; }
    function getDefaultConfig() { return { rules: [], enabled: true, language: 'zh-CN', showBubble: true, bubbleSize: 30, debug: false, subscriptionAutoUpdate: false, exportConfig: false, highlightColors: {1:'#CE2029', 2:'#FF8C00', 3:'#FFD700', 4:'#228B22', 5:'#1E90FF'} }; }
    function persistConfig(mark) { hooks.persistCalls = (hooks.persistCalls || 0) + 1; hooks.persistMark = mark; GM_setValue('searchfilter_blocker', currentConfig); }
    function applyConfigToMainPanel() { hooks.applyCalls = (hooks.applyCalls || 0) + 1; }
    const SELECTORS_KEY = 'searchfilter_selectors';
    let _selectorStoreSignature = null;
    function getSelectorStoreSignature() { return 'sig'; }
    function resetSelectorCache() { hooks.resetSelectorCalls = (hooks.resetSelectorCalls || 0) + 1; }
    function refreshEngineSite() { hooks.refreshCalls = (hooks.refreshCalls || 0) + 1; }
    ${cfgDefaults}
    ${defHl}
    ${normalizeConfigFn}
    ${importRulesFromFileFn}
    return {
      importRulesFromFile,
      isPreventPanelClose: () => preventPanelClose,
    };
  `);

  const api = factory(documentStub, windowStub, FakeFileReader, { debug: false, subscriptionAutoUpdate: true, highlightColors: {1:'#112233', 2:'#FF8C00'} }, env.hooks);
  return { env, api, fakeInput };
}

await (async () => {
  // 1. 浏览器触发 cancel 事件
  {
    const { env, api, fakeInput } = createEnv();
    api.importRulesFromFile();
    assert('规则-155: 打开选择器后锁定面板关闭', api.isPreventPanelClose() === true);
    fakeInput.listeners.cancel[0]();
    assert('规则-157: cancel 事件后解锁', api.isPreventPanelClose() === false);
  }

  // 2. 老浏览器无 cancel 事件，靠窗口焦点回落兜底
  {
    const { env, api, fakeInput } = createEnv();
    api.importRulesFromFile();
    env.windowListeners.focus[0]();
    await new Promise((resolve) => setTimeout(resolve, 350));
    assert('规则-159: 焦点回落后解锁', api.isPreventPanelClose() === false);
  }

  // 3. 正常选择文件
  {
    const { env, api, fakeInput } = createEnv();
    api.importRulesFromFile();
    fakeInput.files = [{ _content: 'rule1\nrule2' }];
    fakeInput.onchange({ target: fakeInput });
    assert('规则-161: 文件内容写入编辑区', env.textarea.value === 'rule1\nrule2');
    assert('规则-162: 读取完成后解锁', api.isPreventPanelClose() === false);
  }

  // 4. onchange 但未选中文件
  {
    const { env, api, fakeInput } = createEnv();
    api.importRulesFromFile();
    fakeInput.onchange({ target: { files: [] } });
    assert('规则-165: 未选择文件时解锁', api.isPreventPanelClose() === false);
  }

  // 6. TXT导入读取 # ScriptConfig 头并应用设置
  {
    const { env, api, fakeInput } = createEnv();
    api.importRulesFromFile();
    fakeInput.files = [{ _content: '# ScriptConfig: {"language":"en-US","showBubble":false,"syncedAt":123,"rulesSyncedAt":456,"bubbleState":{"x":1},"bubbleSize":99,"selectors":{"bing":{"match":"a"}}}\nrule1' }];
    fakeInput.onchange({ target: fakeInput });
    assert('审查3-T1(新功能): TXT导入只覆盖头里出现的键; 时间戳/气泡本地态/气泡尺寸/选择器不随导入, 未出现的订阅自动更新保持原值, 正文规则同时落盘', env.hooks.written.length === 1 && env.hooks.written[0].val.language === 'en-US' && env.hooks.written[0].val.showBubble === false && env.hooks.written[0].val.subscriptionAutoUpdate === true && env.hooks.written[0].val.enabled === true && env.hooks.written[0].val.bubbleAction === 'openPanel' && env.hooks.written[0].val.syncedAt === undefined && env.hooks.written[0].val.rulesSyncedAt === undefined && env.hooks.written[0].val.bubbleState === undefined && env.hooks.written[0].val.bubbleSize === undefined && env.hooks.written[0].val.selectors === undefined && Array.isArray(env.hooks.written[0].val.rules) && env.hooks.written[0].val.rules.join() === 'rule1');
    assert('审查3-T2(新功能): 头行剥离后规则写入编辑区并立即保存, 面板刷新与重处理各一次', env.textarea.value === 'rule1' && env.hooks.persistCalls === 1 && env.hooks.persistMark === true && env.hooks.applyCalls === 1 && env.hooks.reprocessCalls === 1 && env.hooks.updateLineNumbersCalls === 1);
  }

  // 7. 头行仅含剥离字段时不触发设置应用
  {
    const { env, api, fakeInput } = createEnv();
    api.importRulesFromFile();
    fakeInput.files = [{ _content: '# ScriptConfig: {"syncedAt":123}\nrule1' }];
    fakeInput.onchange({ target: fakeInput });
    assert('审查3-T3(新功能): 头内无可应用设置时不改设置字段, 正文规则仍立即落盘', env.hooks.written.length === 1 && env.hooks.written[0].val.rules.join() === 'rule1' && env.hooks.written[0].val.language === undefined && env.hooks.persistCalls === 1 && env.hooks.applyCalls === 1 && env.textarea.value === 'rule1');
  }

  // 8. 导出配置再导入会把默认的订阅自动更新写回 false
  {
    const { env, api, fakeInput } = createEnv();
    api.importRulesFromFile();
    const header = JSON.stringify({ language: 'zh-CN', showBubble: true, exportConfig: true, highlightColors: {1:'#112233'} });
    fakeInput.files = [{ _content: '# ScriptConfig:' + header + '\nrule1' }];
    fakeInput.onchange({ target: fakeInput });
    const saved = env.hooks.written[0] && env.hooks.written[0].val;
    assert('审查3-T4: 导入只覆盖头里出现的键，未出现的订阅自动更新保持本地开启，颜色按键合并', !!saved && saved.subscriptionAutoUpdate === true && saved.exportConfig === true && saved.highlightColors[1] === '#112233' && saved.highlightColors[2] === '#FF8C00' && saved.rules.join() === 'rule1', saved);
  }

  // 9. TXT导入读取 # Selectors 头并应用选择器
  {
    const { env, api, fakeInput } = createEnv();
    api.importRulesFromFile();
    fakeInput.files = [{ _content: '# Selectors: {"bing":{"containers":".x"}}\n# ScriptConfig: {"language":"en-US"}\nrule1' }];
    fakeInput.onchange({ target: fakeInput });
    assert('修复IM-1: TXT导入应用# Selectors头选择器并刷新引擎, ScriptConfig设置照常落盘', env.hooks.written.length === 2 && env.hooks.written[0].key === 'searchfilter_selectors' && env.hooks.written[0].val.bing.containers === '.x' && env.hooks.written[1].val.language === 'en-US' && env.hooks.refreshCalls === 1);
  }

  // 10. 仅 ScriptConfig 内嵌 selectors(无# Selectors行)仍不随导入
  {
    const { env, api, fakeInput } = createEnv();
    api.importRulesFromFile();
    fakeInput.files = [{ _content: '# ScriptConfig: {"selectors":{"bing":{"match":"a"}}}\nrule1' }];
    fakeInput.onchange({ target: fakeInput });
    assert('修复IM-2(对照): 无# Selectors行时内嵌selectors不应用, 行为同修复IM-1前', env.hooks.written.length === 1 && env.hooks.written[0].key === 'searchfilter_blocker' && env.hooks.refreshCalls === undefined);
  }

})();
})();

// ---- 规则-168~175: 同步头解析(仅剥离同步头行, 其余#注释保留) ----
await (async () => {
  const parseSyncHeaderFn = extractFn(src, 'parseSyncHeader');
  const run = (content) => new Function('currentConfig', 'console', `
    ${parseSyncHeaderFn}
    return parseSyncHeader;
  `)({ debug: false }, { warn: () => {} })(content);

  let r = run('# uBlacklist backup rules\n# exported 2026-01-01\n# ScriptConfig: {"a":1}\nrule1');
  assert('规则-168: 头前用户注释保留', r.restLines.join('\n') === '# uBlacklist backup rules\n# exported 2026-01-01\nrule1');
  assert('规则-169: ScriptConfig 头仍被解析', !!r.config && r.config.a === 1);

  r = run('# ScriptConfig: {"a":1}\n# 我的分组注释\n# Selectors: []\nrule1');
  assert('规则-170: 两头之间的注释保留', r.restLines.join('\n') === '# 我的分组注释\nrule1');
  assert('规则-171: Selectors 头解析并合入 config', Array.isArray(r.config.selectors));
  r = run('# Selectors: {"bing":{"containers":".x"}}\nrule1');
  assert('审查C1-2: 合法选择器头照常解析并合入 config', !!r.rawSelectors && r.config.selectors.bing.containers === '.x' && r.restLines.join('\n') === 'rule1');
  r = run('# Selectors: {"foo":1}\nrule1');
  assert('审查C1-3: 非法选择器头整行剔除且 rawSelectors 置空', r.rawSelectors === null && !(r.config && r.config.selectors) && r.restLines.join('\n') === 'rule1');
  r = run('# Selectors: {"bing":{"disabled":"true"}}\nrule1');
  assert('审查C1-4: disabled 非布尔的选择器头同样剔除', r.rawSelectors === null && r.restLines.join('\n') === 'rule1');

  r = run('# 注释\nrule1\n# ScriptConfig: {"a":1}');
  assert('规则-172: 规则行后的头行不吞(按规则保留)', r.restLines.join('\n') === '# 注释\nrule1\n# ScriptConfig: {"a":1}');

  r = run('# ScriptConfig: {"a":1}\n# ScriptConfig: {"b":2}\nrule1');
  assert('规则-173(已修复): 重复头取首个, 后部伪头按注释保留正文', r.config.a === 1 && r.config.b === undefined && r.restLines.join('\n') === '# ScriptConfig: {"b":2}\nrule1');

  r = run('\uFEFF# title: my rules\n# author: me\n*://bad.example.com/*');
  assert('规则-174: 无头纯注释文件原样保留(BOM)', r.restLines.join('\n') === '# title: my rules\n# author: me\n*://bad.example.com/*' && !r.config);
})();

// ---- 规则-176~192: 一键屏蔽规则选项构建(域名/精确/白名单) ----
await (async () => {
  const consts = src.match(/const COMMON_HOST_PREFIXES = new Set\(\[[^\]]*\]\);/)[0] + '\n' +
    src.match(/const PUBLIC_SUFFIX_2LD = new Set\([\s\S]*?\}\)\);/)[0];
  const build = new Function(
    consts + '\n' + extractFn(src, 'isPublicSuffixBase') + '\n' + extractFn(src, 'buildBlockRuleOptions') + '\nreturn buildBlockRuleOptions;'
  )();

  let o = build('abc.example.com');
  assert('规则-176: 非www子域不回退主域', o.isIP === false && o.domainRule === '*://*.abc.example.com/*');
  assert('规则-177: 精确选项为完整主机', o.exactRule === '*://abc.example.com/*');

  o = build('www.example.com');
  assert('规则-179: www前缀回退主域', o.domainRule === '*://*.example.com/*' && o.exactRule === '*://www.example.com/*');

  o = build('example.com');
  assert('规则-180: 裸域域名选项', o.domainRule === '*://*.example.com/*' && o.exactRule === '*://example.com/*');

  o = build('1.2.3.4');
  assert('规则-181: IP精确与域名同规则', o.isIP === true && o.domainRule === '*://1.2.3.4/*' && o.exactRule === '*://1.2.3.4/*' && o.whitelistRule === '@*://1.2.3.4/*');

  o = build('1.2.3.256');
  assert('规则-182: 越界IP按域名处理', o.isIP === false);

  o = build('01.02.03.04');
  assert('规则-183: 前导零IP按域名处理', o.isIP === false);

  o = build('');
  assert('规则-184: 空域名不崩溃', !!o && o.isIP === false && typeof o.exactRule === 'string');

  o = build('news.bbc.co.uk');
  assert('规则-185: 多级子域不回退主域', o.domainRule === '*://*.news.bbc.co.uk/*');
  o = build('www.news.bbc.co.uk');
  assert('规则-187: 仅剥离最外层www', o.domainRule === '*://*.news.bbc.co.uk/*');

  o = build('www.com');
  assert('规则-188: www单标签回退完整主机且不再标记TLD级', o.tldWide === false && o.domainRule === '*://*.www.com/*');
})();

// ---- 规则-193~211: 校验空正则与DDG重定向解包 ----
await (async () => {
  const fnsToExtract = [
    'hostLabelToASCII', 'toASCIIHostname', 'toASCIIUrl', 'safeRegexTest', 'stripRuleComment', 'getInvalidRegexFlags', 'parseConditionPart',
    'tokenizeCondExpr', 'parseCondExprTokens', 'analyzeCondExpr', 'foldCondExpr',
    'evalDynamicLeaf', 'evalCondAST', 'extractBalancedParens', 'findIfOccurrences', 'stripIfConditions',
    'evaluateCondition', 'isCondExprCore', 'looksLikeCondExpr', 'absorbStandaloneExpr',
    'parseRuleWithConditions', 'validateUrlWildcard', 'ruleToRegex', 'parsePrefixedRegexRule',
    'escapeWildcardPart', 'wildcardToRegex', 'normalizeHostCandidate', 'matchWildcardDomainPattern', 'extractSimpleWhitelistDomain',
    'validateCondition', 'analyzeRule'
  ];
  const langMatch = src.match(/const LANG_TEXTS = \{[\s\S]*?\n  \};/)[0];
  const consts = src.match(/const SUPPORTED_REGEX_FLAGS = 'imsu';/)[0];

  const analyzeRule = new Function(
    `${consts}\n${langMatch}\n` +
    `function t(key, params = {}) {
      const texts = LANG_TEXTS['zh-CN'] || {};
      let text = texts[key] || key;
      for (const [k, v] of Object.entries(params)) text = text.replaceAll('{' + k + '}', v);
      return text;
    }\n` +
    fnsToExtract.map(n => extractFn(src, n)).join('\n') +
    '\nreturn analyzeRule;'
  )();

  assert('规则-193: 空正则 // 判定无效', analyzeRule('//').valid === false);
  assert('规则-195: 空白正则 /   / 判定无效', analyzeRule('/   /').valid === false);
  assert('规则-196: 正常正则 /abc/ 有有效结果', analyzeRule('/abc/').valid === true);
  assert('规则-197: **:// 前缀判定无效', analyzeRule('**://example.com/*').valid === false);
  assert('规则-198: 路径尾部/**不误伤', analyzeRule('*://*.example.com/**').valid === true);
  assert('规则-199: *://**.x 仍判定无效', analyzeRule('*://**.example.com/*').valid === false);
  assert('修复F-1: 重复flags title/x/ii 判定无效', analyzeRule('title/x/ii').valid === false);
  assert('修复F-2: 重复flags text/x/uu 判定无效', analyzeRule('text/x/uu').valid === false);
  assert('修复F-3(对照): 合法flags title/x/iu 仍有效', analyzeRule('title/x/iu').valid === true);

  const getCleanUrl = new Function(
    extractFn(src, 'decodeRedirectTarget') + '\n' +
    extractFn(src, 'decodeBingCkTarget') + '\n' +
    extractFn(src, 'unwrapRedirectUrl') + '\n' +
    extractFn(src, 'getCleanUrl') + '\nreturn getCleanUrl;'
  )();

  const ddgLink = { href: 'https://duckduckgo.com/l/?uddg=https%3A%2F%2Ftarget.example.com%2Fpath%3Fa%3D1&rut=xxx' };
  const cleanUrl = getCleanUrl(ddgLink);
  assert('规则-200: 解码 uddg 重定向', cleanUrl === 'https://target.example.com/path?a=1');
  assert('规则-201: 只读不回写 DOM link.href', ddgLink.href === 'https://duckduckgo.com/l/?uddg=https%3A%2F%2Ftarget.example.com%2Fpath%3Fa%3D1&rut=xxx');
  const ddgNoSlash = { href: 'https://duckduckgo.com/l?uddg=https%3A%2F%2Ftarget.example.com%2Fx' };
  assert('规则-202: /l 无尾斜杠也解包', getCleanUrl(ddgNoSlash) === 'https://target.example.com/x');
  const scholarLink = { href: 'https://scholar.google.com/scholar_url?url=https%3A%2F%2Farxiv.org%2Fabs%2F1234&hl=en' };
  assert('规则-203: scholar_url 解包', getCleanUrl(scholarLink) === 'https://arxiv.org/abs/1234');
  const gUrl = { href: 'https://www.google.com/url?q=https%3A%2F%2Fexample.com%2Fa' };
  assert('规则-205: google /url 解包', getCleanUrl(gUrl) === 'https://example.com/a');
  const yahooTw = { href: 'https://tw.search.yahoo.com/r/RU=https%3A%2F%2Fexample.com%2Fy/RK=2' };
  const yahooHk = { href: 'https://search.yahoo.com.hk/r/RU=https%3A%2F%2Fexample.com%2Fhk/RK=2' };
  const yahooComplex = { href: 'https://search.yahoo.com/r/_ylt=Awr9Il1j/RU=https%3A%2F%2Fexample.com%2Fnested%2Fpath/RK=2/RS=abc123xyz' };
  const yahooDoubleEnc = { href: 'https://tw.search.yahoo.com/r/RU=https%253A%252F%252Fexample.com%252Fpath%253Fk%253Dv/RK=2' };
  const yahooJpStar = { href: 'https://rd.yahoo.co.jp/search/web/result/*https://example.jp/page' };
  const yahooJpParam = { href: 'https://search.yahoo.co.jp/rd?url=https%3A%2F%2Fstore.yahoo.co.jp%2Fitem' };
  const yahooQueryRu = { href: 'https://search.yahoo.com/search?ru=https%3A%2F%2Fexample.org%2Fwiki' };
  assert('规则-206: yahoo 地区站 RU= 解包', getCleanUrl(yahooTw) === 'https://example.com/y' && getCleanUrl(yahooHk) === 'https://example.com/hk');
  assert('规则-207: yahoo 复杂路径 /RK= 截断与路径保留', getCleanUrl(yahooComplex) === 'https://example.com/nested/path');
  assert('规则-208: yahoo 双重编码解码', getCleanUrl(yahooDoubleEnc) === 'https://example.com/path?k=v');
  assert('规则-209: yahoo japan 星号与参数解包', getCleanUrl(yahooJpStar) === 'https://example.jp/page' && getCleanUrl(yahooJpParam) === 'https://store.yahoo.co.jp/item');
  assert('规则-210: yahoo query ru= 参数解包', getCleanUrl(yahooQueryRu) === 'https://example.org/wiki');
  const yahooRdsig = { href: 'https://rdsig.yahoo.co.jp/RU=https%3A%2F%2Fexample.jp%2Fpage/RK=2' };
  assert('规则-210b: yahoo japan rdsig RU= 解包', getCleanUrl(yahooRdsig) === 'https://example.jp/page');
  const yahooJpStar2 = { href: 'https://rd.yahoo.co.jp/search/web/result/**-https%3A%2F%2Fexample.jp%2Fpage' };
  assert('修复R-1: yahoo japan 双星/**-解包', getCleanUrl(yahooJpStar2) === 'https://example.jp/page');
  const customEngineLink = { href: 'https://scholar.google.com/scholar_url?url=https%3A%2F%2Fpapers.example.com%2Fx' };
  assert('规则-211: 不依赖引擎ID仍解包', getCleanUrl(customEngineLink) === 'https://papers.example.com/x');
})();

// ==== 二、修复回归 ====

// ---- 规则-245~260: 公共后缀回退 / 墓碑数量上限 / 规则键互异 ----
await (async () => {
  const consts = src.match(/const COMMON_HOST_PREFIXES = new Set\(\[[^\]]*\]\);/)[0] + '\n' +
    src.match(/const PUBLIC_SUFFIX_2LD = new Set\([\s\S]*?\}\)\);/)[0];
  const build = new Function(
    consts + '\n' + extractFn(src, 'isPublicSuffixBase') + '\n' + extractFn(src, 'buildBlockRuleOptions') + '\nreturn buildBlockRuleOptions;'
  )();

  let o = build('www.co.uk');
  assert('规则-245: www.co.uk 域名选项回退完整主机', o.domainRule === '*://*.www.co.uk/*');
  assert('规则-247: www.co.uk 标记后缀回退', o.suffixLike === true);
  o = build('www.co.jp');
  assert('规则-250: www.co.jp 回退完整主机', o.domainRule === '*://*.www.co.jp/*');
  o = build('www.foo.bar');
  assert('规则-251: 可注册双标签不回退', o.domainRule === '*://*.foo.bar/*' && o.suffixLike === false);
  o = build('www.example.com');
  assert('规则-252: 常规www主机不受影响', o.domainRule === '*://*.example.com/*' && o.suffixLike === false);
  o = build('example.co.uk');
  assert('规则-253: 裸域co.uk不回退', o.domainRule === '*://*.example.co.uk/*' && o.suffixLike === false);
  o = build('www.foo.co.uk');
  assert('规则-254: www+多级主体按注册域剥离', o.domainRule === '*://*.foo.co.uk/*');
  o = build('1.2.3.4');
  assert('规则-255: IP不触发后缀回退', o.suffixLike === false && o.domainRule === '*://1.2.3.4/*');
  o = build('com');
  assert('规则-256: 裸单标签TLD仍标记TLD级', o.tldWide === true && o.domainRule === '*://*.com/*');

  const getRuleKey = new Function(
    extractFn(src, 'stripRuleComment') + '\n' + extractFn(src, 'getRuleKey') + '\nreturn getRuleKey;'
  )();
  assert('规则-257: 黑名单与白名单键互异', getRuleKey('@*://a.com/*') !== getRuleKey('*://a.com/*'));
  assert('规则-258: 黑名单与高亮键互异', getRuleKey('@1 *://a.com/*') !== getRuleKey('*://a.com/*'));
  assert('规则-259: 不同颜色高亮键互异', getRuleKey('@1 *://a.com/*') !== getRuleKey('@2 *://a.com/*'));
  assert('规则-260: 尾注释剥离后键一致', getRuleKey('*://a.com/* #+ note') === getRuleKey('*://a.com/*'));
})();

// ---- 规则-261~271: 通配转义字母元序列按字面 / 删除规则同步_initialRules ----
await (async () => {
  const wcApi = new Function(
    'hostLabelToASCII', 'toASCIIHostname',
    extractFn(src, 'escapeWildcardPart') + '\n' + extractFn(src, 'wildcardToRegex') + '\nreturn { escapeWildcardPart, wildcardToRegex };'
  )((s) => s, (s) => s);
  const wcMatch = (rule, url) => new RegExp(wcApi.wildcardToRegex(rule), 'i').test(url);

  assert('规则-261: \\b 不再透传为单词边界', wcMatch('*://x.com/a\\b/*', 'https://x.com/a/b/c') === false);
  assert('规则-263: \\b 按字面反斜杠编译', wcApi.wildcardToRegex('*://x.com/a\\b/*').includes('\\\\b'));
  assert('规则-264: \\. 仍转义为字面点', wcMatch('example\\.com', 'example.com') === true && wcMatch('example\\.com', 'exampleXcom') === false);
  assert('规则-265: \\* 仍为字面星号', wcApi.wildcardToRegex('*://x.com/a\\*b/*').includes('\\*'));
  assert('规则-266: 端口段 \\d 按字面处理', wcApi.wildcardToRegex('*://x.com:80\\d0/*').includes('\\\\d'));
  assert('规则-267: 普通通配语义不受影响', wcMatch('*://*.example.com/*', 'https://a.example.com/p') === true && wcMatch('*://*.example.com/*', 'https://a.example.com.evil.com/') === false);

  const textareaStub = { value: 'example.com\nother.com\nfoo.com' };
  const panelStub = { _initialRules: ['example.com', 'other.com'] };
  const docStub = { 'serh-rules': textareaStub, 'serh-panel': panelStub };
  const removeRulesFromTextarea = new Function(
    'document', 'updateLineNumbers',
    extractFn(src, 'stripRuleComment') + '\n' + extractFn(src, 'removeRulesFromTextarea') + '\nreturn removeRulesFromTextarea;'
  )({ getElementById: (id) => docStub[id] || null }, () => {});
  removeRulesFromTextarea(['example.com']);
  assert('规则-268: 删除规则同步 textarea', !textareaStub.value.includes('example.com') && textareaStub.value.includes('other.com'));
  assert('规则-269: 删除规则同步 _initialRules', Array.isArray(panelStub._initialRules) && !panelStub._initialRules.includes('example.com') && panelStub._initialRules.length === 1);
  removeRulesFromTextarea(['foo.com']);
  assert('规则-270: _initialRules 无该键时保持不变', panelStub._initialRules.length === 1 && panelStub._initialRules[0] === 'other.com');

  const compiledRulesDef = src.match(/function newCompiledRules\(\) \{[\s\S]*?\n\s*\};/);
  assert('规则-271: 顶层 compiledRules 经 newCompiledRules 初始化, 含白名单条件结构', compiledRulesDef && compiledRulesDef[0].includes('whitelistConditionalDomains: new Map()') && compiledRulesDef[0].includes('whitelistConditionalRules: []') && /let compiledRules = newCompiledRules\(\);/.test(src));
})();

// ---- 规则-272~289: 常见主机前缀剥离 + 轻量后缀表 ----
await (async () => {
  const consts = src.match(/const COMMON_HOST_PREFIXES = new Set\(\[[^\]]*\]\);/)[0] + '\n' +
    src.match(/const PUBLIC_SUFFIX_2LD = new Set\([\s\S]*?\}\)\);/)[0];
  const api = new Function(
    consts + '\n' + extractFn(src, 'isPublicSuffixBase') + '\n' + extractFn(src, 'buildBlockRuleOptions') + '\nreturn { buildBlockRuleOptions, isPublicSuffixBase };'
  )();

  let o = api.buildBlockRuleOptions('m.example.com');
  assert('规则-272: m前缀回退主域', o.domainRule === '*://*.example.com/*' && o.exactRule === '*://m.example.com/*');
  o = api.buildBlockRuleOptions('www3.example.com');
  assert('规则-276: wwwN前缀回退主域', o.domainRule === '*://*.example.com/*');
  o = api.buildBlockRuleOptions('M.Example.com');
  assert('规则-277: 前缀匹配忽略大小写', o.domainRule === '*://*.Example.com/*');

  o = api.buildBlockRuleOptions('m.news.bbc.co.uk');
  assert('规则-278: 前缀剥离后保留多级主体', o.domainRule === '*://*.news.bbc.co.uk/*');
  o = api.buildBlockRuleOptions('m.example.co.uk');
  assert('规则-279: m+co.uk主体回退注册域', o.domainRule === '*://*.example.co.uk/*' && o.suffixLike === false);
  o = api.buildBlockRuleOptions('m.co.uk');
  assert('规则-280: 剥后为裸后缀则回退完整主机', o.domainRule === '*://*.m.co.uk/*' && o.suffixLike === true);
  o = api.buildBlockRuleOptions('m.www.example.com');
  assert('规则-281: 连续前缀逐级剥离', o.domainRule === '*://*.example.com/*');
  o = api.buildBlockRuleOptions('abc.example.com');
  assert('规则-282: 非常见前缀不剥离', o.domainRule === '*://*.abc.example.com/*');

  assert('规则-284: sch.uk 识别为公共后缀', api.isPublicSuffixBase('sch.uk') === true);
  assert('规则-286: 裸域注册域与三级主体判定', api.isPublicSuffixBase('example.co.uk') === false && api.isPublicSuffixBase('com.example.co.uk') === false);

  o = api.buildBlockRuleOptions('www.mysite.co.za');
  assert('规则-287: www+co.za注册域剥离', o.domainRule === '*://*.mysite.co.za/*');
  o = api.buildBlockRuleOptions('www.co.ke');
  assert('规则-289(对照): 非常用后缀不在表内按普通注册域剥离', o.domainRule === '*://*.co.ke/*' && o.suffixLike === false);
})();

// ---- 规则-290~293: yahoo传统/*-http://星号解包 ----
{
  const getCleanUrl = new Function(
    extractFn(src, 'decodeRedirectTarget') + '\n' +
    extractFn(src, 'decodeBingCkTarget') + '\n' +
    extractFn(src, 'unwrapRedirectUrl') + '\n' +
    extractFn(src, 'getCleanUrl') + '\nreturn getCleanUrl;'
  )();
  const yahooDashStar = { href: 'https://r.search.yahoo.com/_ylt=abc;_ylu=xyz/RV=2/RE=1/RO=2/*-http://example.com/a' };
  assert('规则-290: yahoo 传统 /*-http:// 解包', getCleanUrl(yahooDashStar) === 'http://example.com/a');
  const yahooDashDouble = { href: 'https://tw.search.yahoo.com/r/RK=2/*-https%3A%2F%2Fexample.com%2Fpath%3Fk%3Dv' };
  assert('规则-292: yahoo /*-https%3A 编码变体解包', getCleanUrl(yahooDashDouble) === 'https://example.com/path?k=v');
  const yahooNested = { href: 'https://r.search.yahoo.com/_ylt=A/RV=1/RU=https%3A%2F%2Fr.search.yahoo.com%2FRV%3D2%2FRU%3Dhttps%253A%252F%252Fexample.com%252Fpage%2FRK%3D2/RK=2/RS=x' };
  assert('规则-293: yahoo 套 yahoo 解到最终结果', getCleanUrl(yahooNested) === 'https://example.com/page');
  const bingYahoo = { href: 'https://www.bing.com/ck/a?!&&u=a1' + Buffer.from('https://r.search.yahoo.com/_ylt=A/RU=https%3A%2F%2Fexample.com%2Fpage/RK=2/RS=x').toString('base64url') };
  assert('规则-295: bing ck 套 yahoo RU= 解到最终结果', getCleanUrl(bingYahoo) === 'https://example.com/page');
  const plain = { href: 'https://example.com/page?ru=https%3A%2F%2Fother.example%2Fx' };
  assert('规则-296(对照): 非跳转域查询参数不解包', getCleanUrl(plain) === plain.href);
}

// ---- 规则-330~337: 360/搜狗/头条 新增引擎真实链接解析 ----
{
  const getCleanUrl = new Function(
    extractFn(src, 'decodeRedirectTarget') + '\n' +
    extractFn(src, 'decodeBingCkTarget') + '\n' +
    extractFn(src, 'unwrapRedirectUrl') + '\n' +
    extractFn(src, 'getCleanUrl') + '\nreturn getCleanUrl;'
  )();

  const toutiaoJump = { href: 'https://so.toutiao.com/search/jump?aid=1455&jtoken=abc&url=https%3A%2F%2Farticle.zlink.toutiao.com%2FJ4dQM%3Falert%3D0%26h5_url%3Dhttps%253A%252F%252Ftoutiao.com%252Fgroup%252F7154219334058213923%252F%253Fchannel%253Dsearch_tab' };
  assert('规则-330: 头条 /search/jump 经中间页 h5_url 解到真实地址', getCleanUrl(toutiaoJump) === 'https://toutiao.com/group/7154219334058213923/?channel=search_tab', getCleanUrl(toutiaoJump));

  const toutiaoDirect = { href: 'https://so.toutiao.com/search/jump?aid=1455&url=https%3A%2F%2Fwww.toutiao.com%2Farticle%2F123' };
  assert('规则-331: 头条中间页无 h5_url 时退到 url 参数目标', getCleanUrl(toutiaoDirect) === 'https://www.toutiao.com/article/123', getCleanUrl(toutiaoDirect));

  const sogouMobile = { href: 'https://m.sogou.com/web/id=e59202fd/sec=abc/tc?rcer=1&url=https%3A%2F%2Fview.inews.qq.com%2FhotEvent%2FUTR123%3Fscene%3Dqqsearch' };
  assert('规则-332: 搜狗移动端 /tc?...&url= 解包', getCleanUrl(sogouMobile) === 'https://view.inews.qq.com/hotEvent/UTR123?scene=qqsearch', getCleanUrl(sogouMobile));

  const sogouDesktop = { href: 'https://www.sogou.com/link?url=hedJjaC291NBjk-U0pOwZCVdPXHFjFJWK3IugmTcTDZkKTX9NwhPuTHXobRRcRtF' };
  assert('规则-333(对照): 搜狗桌面 /link?url= 不可解密 token 保持原样', getCleanUrl(sogouDesktop) === sogouDesktop.href, getCleanUrl(sogouDesktop));

  const so360 = { href: 'https://www.so.com/link?m=wv7C9', getAttribute: (n) => (n === 'data-mdurl' ? 'https://www.speedtest.cn/' : null) };
  assert('规则-334: 360 data-mdurl 属性取真实地址', getCleanUrl(so360) === 'https://www.speedtest.cn/', getCleanUrl(so360));

  const sogouLinkurl = { href: 'https://www.sogou.com/link?url=hedJjaC291NBjk', getAttribute: (n) => (n === 'linkurl' ? '//www.speedtest.cn/' : null) };
  assert('规则-335: 搜狗 linkurl 协议相对属性补全 https', getCleanUrl(sogouLinkurl) === 'https://www.speedtest.cn/', getCleanUrl(sogouLinkurl));

  const so360Plain = { href: 'https://www.so.com/link?m=wv7C9' };
  assert('规则-336(对照): 360 无 data-mdurl 的裸链接对象行为不变', getCleanUrl(so360Plain) === so360Plain.href, getCleanUrl(so360Plain));

  const so360Query = { href: 'https://www.so.com/s?q=%E9%80%9F%E6%B5%8B&src=srp' };
  assert('规则-337(对照): 360 普通搜索页不误触解包', getCleanUrl(so360Query) === so360Query.href, getCleanUrl(so360Query));

  const mockLink = (href, direct, box) => ({
    href,
    getAttribute: (n) => (direct && n in direct ? direct[n] : null),
    closest: () => ({ querySelector: () => (box ? { getAttribute: (n) => (n in box ? box[n] : null) } : null) }),
  });

  const so360Jump = { href: 'https://m.so.com/jump?u=http%3A%2F%2Fwww.yz5555.com%2F&m=563145&from=m.so.com' };
  assert('规则-338: 360 移动端 /jump?u= 解包', getCleanUrl(so360Jump) === 'http://www.yz5555.com/', getCleanUrl(so360Jump));

  const sogouBox = mockLink('https://www.sogou.com/link?url=hedJjaC291NXL', null, { 'data-url': 'https://www.speedtest.cn/article/1K2dmMXZd2no' });
  assert('规则-339: 搜狗桌面读取结果容器 data-url 真实地址', getCleanUrl(sogouBox) === 'https://www.speedtest.cn/article/1K2dmMXZd2no', getCleanUrl(sogouBox));

  const so360Box = mockLink('https://m.so.com/link?m=wv7C9', null, { 'data-url': 'https://m.so.com/jump?u=https%3A%2F%2Fwww.speedtest.cn%2F&m=957ae3&from=m.so.com' });
  assert('规则-340: 360 容器 data-url 为 jump 链接时继续解到真实地址', getCleanUrl(so360Box) === 'https://www.speedtest.cn/', getCleanUrl(so360Box));

  const sogouNoBox = mockLink('https://www.sogou.com/link?url=hedJjaC291NXL', null, null);
  assert('规则-341(对照): 容器内无 data-url 时保持原样', getCleanUrl(sogouNoBox) === sogouNoBox.href, getCleanUrl(sogouNoBox));

  // 规则-342~344: 搜狗 wap 子域(QQ浏览器搜索页)链接解析(真实快照URL格式)
  const sogouWapTc = { href: 'https://wap.sogou.com/web/id=f0731226/keyword=%E6%B5%8B%E8%AF%95/sec=abc/entryTime=1791029890720/vr=70375301/tc?rcer=Q9PEmkcIRez-VigfV&&title=%E6%B5%8B%E8%AF%95&dp=1&bid=sogou-mobb-x&is_per=0&pno=1&clk=1&url=https%3A%2F%2Fview.inews.qq.com%2FhotEvent%2FUTR2026061211099300%3Fscene%3Dqqsearch&vrid=70375301&wml=1&linkid=title' };
  assert('规则-342: 搜狗 wap(QQ浏览器) /tc?...&url= 解包', getCleanUrl(sogouWapTc) === 'https://view.inews.qq.com/hotEvent/UTR2026061211099300?scene=qqsearch', getCleanUrl(sogouWapTc));

  const sogouWapSearchList = { href: 'https://wap.sogou.com/web/searchList.jsp?oldQuery=%E6%B5%8B%E8%AF%95&keyword=%E5%BF%83%E7%90%86%E6%B5%8B%E8%AF%95&s_from=hint_middle&dp=1' };
  assert('规则-343(对照): 搜狗 wap 站内搜索列表链接无 url 参数保持原样', getCleanUrl(sogouWapSearchList) === sogouWapSearchList.href, getCleanUrl(sogouWapSearchList));

  const sogouWapWeixin = { href: 'https://wap.sogou.com/web/id=x/vr=11002601/tc?clk=1&url=https%3A%2F%2Fmp.weixin.qq.com%2Fs%3Fsrc%3D11%26timestamp%3D1&vrid=11002601&wml=1' };
  assert('规则-344: 搜狗 wap 跳微信公众号链接解包', getCleanUrl(sogouWapWeixin) === 'https://mp.weixin.qq.com/s?src=11&timestamp=1', getCleanUrl(sogouWapWeixin));
}

// ---- 修复A: 非ASCII路径通配规则命中百分号编码URL ----
{
  const wcApi = new Function(
    ['hostLabelToASCII', 'toASCIIHostname', 'escapeWildcardPart', 'wildcardToRegex', 'parsePrefixedRegexRule', 'ruleToRegex', 'compileRuleRegex', 'safeRegexTest'].map((n) => extractFn(src, n)).join('\n') +
    '\nreturn { compileRuleRegex, safeRegexTest };'
  )();
  const wcm = (rule, url) => { const c = wcApi.compileRuleRegex(rule); return wcApi.safeRegexTest(c.regex, url); };
  assert('修复A-1: 中文路径通配规则命中百分号编码URL', wcm('*://example.com/中文/*', 'https://example.com/%E4%B8%AD%E6%96%87/x') === true);
  assert('修复A-2: 中文查询串通配规则命中百分号编码URL', wcm('*://example.com/*q=中文*', 'https://example.com/search?q=%E4%B8%AD%E6%96%87') === true);
  assert('修复A-3: 中文主机通配仍命中punycode主机(ASCII路径不受影响)', wcm('*://*.例子.com/path/*', 'https://xn--fsqu00a.com/path/x') === true);
  assert('修复A-4: 通配符与中文混合路径命中', wcm('*://example.com/中*/*', 'https://example.com/%E4%B8%AD%E6%96%87abc/x') === true);
  assert('修复A-5(对照): 规则编译后为百分号编码形式, 直接对原样UnicodeURL不再命中(subject侧由resolveUrlDomain归一兜底)', wcm('*://example.com/中文/*', 'https://example.com/中文/x') === false);
  assert('修复A-6(对照): 纯ASCII路径规则行为不变', wcm('*://example.com/path/*', 'https://example.com/path/x') === true && wcm('*://example.com/path/*', 'https://example.com/other/x') === false);
  assert('修复A-7: title规则不受百分号编码影响', wcm('title/中文/', '中文标题') === true);
  assert('修复A-8: text规则不受百分号编码影响', wcm('text/中文/', '摘要含中文内容') === true);
  assert('修复A-12: 非BMP字符(emoji)路径通配按码点百分号编码命中(原逐UTF-16码元编码抛URIError)', wcm('*://example.com/😀/*', 'https://example.com/%F0%9F%98%80/x') === true);
  assert('修复A-13: 非BMP字符查询串通配命中编码URL', wcm('*://example.com/*q=😀*', 'https://example.com/search?q=%F0%9F%98%80') === true);
  assert('修复A-14(对照): 非BMP原样URL不直接命中(subject侧由resolveUrlDomain归一兜底)', wcm('*://example.com/😀/*', 'https://example.com/😀/x') === false);
}

// ---- 修复A: resolveUrlDomain 对残留非ASCII的URL做百分号编码归一 ----
{
  const rudApi = new Function(
    ['decodeRedirectTarget', 'decodeBingCkTarget', 'unwrapRedirectUrl', 'getCleanUrl', 'toASCIIUrl', 'resolveUrlDomain'].map((n) => extractFn(src, n)).join('\n') +
    '\nconst toASCIIHostname = (h) => h;\nconst currentConfig = { removeRedirects: true };\nreturn { resolveUrlDomain };'
  )();
  const viaRedirect = rudApi.resolveUrlDomain({ href: 'https://www.google.com/url?q=https%3A%2F%2Fexample.com%2F%E4%B8%AD%E6%96%87%2Fx' });
  assert('修复A-9: 重定向解包后URL路径归一为百分号编码', viaRedirect.url === 'https://example.com/%E4%B8%AD%E6%96%87/x' && viaRedirect.domain === 'example.com');
  const nativeEncoded = rudApi.resolveUrlDomain({ href: 'https://example.com/%E4%B8%AD%E6%96%87/x' });
  assert('修复A-10: 原生百分号编码href保持不变', nativeEncoded.url === 'https://example.com/%E4%B8%AD%E6%96%87/x');
  const asciiUrl = rudApi.resolveUrlDomain({ href: 'https://example.com/path/x' });
  assert('修复A-11: 纯ASCII URL不受归一化影响', asciiUrl.url === 'https://example.com/path/x');
  const rawEmoji = rudApi.resolveUrlDomain({ href: 'https://example.com/search?q=😀&x=1' });
  assert('修复A-15: 含非BMP字符的URL按码点编码不抛URIError且域名正常提取', rawEmoji.url === 'https://example.com/search?q=%F0%9F%98%80&x=1' && rawEmoji.domain === 'example.com');
  const encodedEmoji = rudApi.resolveUrlDomain({ href: 'https://example.com/search?q=%F0%9F%98%80&x=1' });
  assert('修复A-16(对照): 已编码非BMP的URL保持不变', encodedEmoji.url === 'https://example.com/search?q=%F0%9F%98%80&x=1');

  // 规则-345~346: 全链路(unwrap→resolveUrlDomain)对新增引擎跳转链的域名解析
  const toutiaoJumpDomain = rudApi.resolveUrlDomain({ href: 'https://so.toutiao.com/search/jump?aid=1455&jtoken=abc123&url=https%3A%2F%2Fm.speedtest.cn%2Fcareer&log=%7B%22event%22%3A%22search_result_click%22%7D&t_urls=%5B%5D' });
  assert('规则-345: 头条 /search/jump 全链路解包域名为目标站', toutiaoJumpDomain.domain === 'm.speedtest.cn' && toutiaoJumpDomain.url === 'https://m.speedtest.cn/career', toutiaoJumpDomain);

  const sogouWapDomain = rudApi.resolveUrlDomain({ href: 'https://wap.sogou.com/web/id=x/vr=70375301/tc?clk=1&url=https%3A%2F%2Fwww.51testing.com%2Fbbs%2F%3Fa%3D1&vrid=70375301' });
  assert('规则-346: 搜狗 wap /tc 全链路解包域名为目标站', sogouWapDomain.domain === 'www.51testing.com', sogouWapDomain);
}

// ---- 修复T: 头条一键屏蔽显示 toutiao.com/so.toutiao.com ----
// 背景: 1) 相关搜索/大家都在搜卡片唯一链接是站内搜索链, 被 a[href] 兜底选中后域名显示 so.toutiao.com
//       2) 头条号/自营文章真实落地在父域 toutiao.com/group/<id>, 旧守卫按"当前站是目标域子域"一律拒绝,
//          一键屏蔽弹出"无法屏蔽当前搜索引擎自身域名"成为死路
{
  const rudT = new Function(
    ['decodeRedirectTarget', 'decodeBingCkTarget', 'unwrapRedirectUrl', 'getCleanUrl', 'toASCIIUrl', 'resolveUrlDomain'].map((n) => extractFn(src, n)).join('\n') +
    '\nconst toASCIIHostname = (h) => h;\nconst currentConfig = { removeRedirects: true };\nreturn { resolveUrlDomain };'
  )();
  // 线上快照中 CSDN 头条号文章的真实 jump 链形态(article.zlink 中转 + h5_url 落到 toutiao.com/group)
  const selfArticle = rudT.resolveUrlDomain({ href: 'https://so.toutiao.com/search/jump?aid=1455&jtoken=abc&url=https%3A%2F%2Farticle.zlink.toutiao.com%2FJ4dQM%3Falert%3D0%26article.zlink%3D1%26h5_url%3Dhttps%253A%252F%252Ftoutiao.com%252Fgroup%252F7691212389744525860%252F%253Fchannel%253Dsearch_tab' });
  assert('规则-347: 头条号自营文章解包域名落地 toutiao.com(引擎父域)', selfArticle.domain === 'toutiao.com' && selfArticle.url === 'https://toutiao.com/group/7691212389744525860/?channel=search_tab', selfArticle);

  const makeGuard = (host, engine) => new Function(
    extractFn(src, 'isEngineSelfDomain') + '\n' +
    'const window = { location: { hostname: ' + JSON.stringify(host) + ' } };\n' +
    'function getSearchEngine() { return ' + JSON.stringify(engine) + '; }\n' +
    'function getSelectors() { return {\n' +
    '  toutiao: { match: /^so\\.toutiao\\.com$/ },\n' +
    '  bing: { match: /^(?:(?:www[2-4]?|cn|global|m)\\.)?bing\\.(?:com|[a-z]{2,3}(?:\\.[a-z]{2})?)$/ },\n' +
    '  google: { match: /^(?:(?:www|images|video|videos|search|encrypted|m)\\.)?google\\.(?:[a-z]{2,3}(?:\\.[a-z]{2})?|[a-z]{4,})$/ }\n' +
    '}; }\n' +
    'return { isEngineSelfDomain };'
  )();

  const tt = makeGuard('so.toutiao.com', 'toutiao').isEngineSelfDomain;
  assert('规则-348(修复): so.toutiao.com 上允许屏蔽父域 toutiao.com', tt('toutiao.com') === false, tt('toutiao.com'));
  assert('规则-349: so.toutiao.com 上仍禁止屏蔽 so.toutiao.com', tt('so.toutiao.com') === true, tt('so.toutiao.com'));
  assert('规则-350: so.toutiao.com 上禁止屏蔽其子域', tt('abc.so.toutiao.com') === true, tt('abc.so.toutiao.com'));
  assert('规则-351: so.toutiao.com 上无关域名不误拦', tt('example.com') === false, tt('example.com'));

  const tg = makeGuard('www.bing.com', 'bing').isEngineSelfDomain;
  assert('规则-352: www.bing.com 上禁止屏蔽引擎主机 bing.com/cn.bing.com', tg('bing.com') === true && tg('cn.bing.com') === true, [tg('bing.com'), tg('cn.bing.com')]);
  assert('规则-353: www.bing.com 上允许屏蔽普通站点', tg('microsoft.com') === false, tg('microsoft.com'));

  const tgg = makeGuard('www.google.com', 'google').isEngineSelfDomain;
  assert('规则-354: www.google.com 上禁止屏蔽 google.com', tgg('google.com') === true, tgg('google.com'));

  assert('规则-355(对照): 空目标域名不触发守卫', tt('') === false);

  // 规则-356~361: "去除重定向"关闭时, 落在引擎自家主机上的跳转链仍解包到真实落地域名。
  // 否则域名停在引擎自身域名(如今日头条 so.toutiao.com), 一键屏蔽被 isEngineSelfDomain 拦成
  // "无法屏蔽当前搜索引擎自身域名" 死路, 规则匹配也永远命不中。
  const makeKeepRawApi = (host, engine, removeRedirects) => new Function(
    ['decodeRedirectTarget', 'decodeBingCkTarget', 'unwrapRedirectUrl', 'getCleanUrl', 'toASCIIUrl', 'resolveUrlDomain', 'isEngineSelfDomain'].map((n) => extractFn(src, n)).join('\n') +
    '\nconst toASCIIHostname = (h) => h;\n' +
    'const currentConfig = { removeRedirects: ' + JSON.stringify(removeRedirects) + ' };\n' +
    'const window = { location: { hostname: ' + JSON.stringify(host) + ' } };\n' +
    'function getSearchEngine() { return ' + JSON.stringify(engine) + '; }\n' +
    'function getSelectors() { return {\n' +
    '  toutiao: { match: /^so\\.toutiao\\.com$/ },\n' +
    '  bing: { match: /^(?:(?:www[2-4]?|cn|global|m)\\.)?bing\\.(?:com|[a-z]{2,3}(?:\\.[a-z]{2})?)$/ }\n' +
    '}; }\n' +
    'return { resolveUrlDomain, isEngineSelfDomain };'
  )();

  const keepRawTT = makeKeepRawApi('so.toutiao.com', 'toutiao', false);
  const jumpKeepRaw = keepRawTT.resolveUrlDomain({ href: 'https://so.toutiao.com/search/jump?aid=1455&jtoken=abc&url=https%3A%2F%2Fwww.csdn.net%2F' });
  assert('规则-356(修复): 去除重定向关闭时头条 /search/jump 仍解包为真实落地域名', jumpKeepRaw.domain === 'www.csdn.net' && jumpKeepRaw.url === 'https://www.csdn.net/', jumpKeepRaw);
  assert('规则-357(修复): 解包域名不再被 isEngineSelfDomain 拦成死路', keepRawTT.isEngineSelfDomain(jumpKeepRaw.domain) === false, jumpKeepRaw.domain);

  const selfSearchKeepRaw = keepRawTT.resolveUrlDomain({ href: 'https://so.toutiao.com/search?keyword=csdn' });
  assert('规则-358(对照): 真正的站内搜索链不误解包, 仍为 so.toutiao.com', selfSearchKeepRaw.domain === 'so.toutiao.com', selfSearchKeepRaw);

  const normalKeepRaw = keepRawTT.resolveUrlDomain({ href: 'https://www.csdn.net/article/1' });
  assert('规则-359(对照): 非引擎主机的普通链接尊重"去除重定向"设置保持原样', normalKeepRaw.domain === 'www.csdn.net' && normalKeepRaw.url === 'https://www.csdn.net/article/1', normalKeepRaw);

  const keepRawBing = makeKeepRawApi('www.bing.com', 'bing', false);
  const bingKeepRaw = keepRawBing.resolveUrlDomain({ href: 'https://www.bing.com/ck/a?u=a1aHR0cHM6Ly93d3cubWljcm9zb2Z0LmNvbS8%3D&ntb=1' });
  assert('规则-360(修复): 去除重定向关闭时必应 /ck/a 同样解包, 不再显示 www.bing.com', bingKeepRaw.domain === 'www.microsoft.com' && keepRawBing.isEngineSelfDomain(bingKeepRaw.domain) === false, bingKeepRaw);

  const unwrapOnTT = makeKeepRawApi('so.toutiao.com', 'toutiao', true);
  const jumpOn = unwrapOnTT.resolveUrlDomain({ href: 'https://so.toutiao.com/search/jump?aid=1455&url=https%3A%2F%2Fm.speedtest.cn%2Fcareer' });
  assert('规则-361(对照): 去除重定向开启时解包行为不变', jumpOn.domain === 'm.speedtest.cn' && jumpOn.url === 'https://m.speedtest.cn/career', jumpOn);
}

// ---- 修复H1/M1/L3/L4: 订阅YAML识别回归(matches段/元数据键/flow序列/映射项) ----
{
  const yamlFns = ['hostLabelToASCII', 'toASCIIHostname', 'toASCIIUrl', 'safeRegexTest', 'safeDecodeURIComponent', 'stripRuleComment', 'getInvalidRegexFlags', 'parseConditionPart', 'tokenizeCondExpr', 'parseCondExprTokens', 'analyzeCondExpr', 'foldCondExpr', 'evalDynamicLeaf', 'evalCondAST', 'extractBalancedParens', 'findIfOccurrences', 'stripIfConditions', 'evaluateCondition', 'isCondExprCore', 'looksLikeCondExpr', 'absorbStandaloneExpr', 'parseRuleWithConditions', 'validateUrlWildcard', 'ruleToRegex', 'parsePrefixedRegexRule', 'escapeWildcardPart', 'wildcardToRegex', 'normalizeHostCandidate', 'matchWildcardDomainPattern', 'extractSimpleWhitelistDomain', 'matchSimpleDomain', 'compileRuleRegex', 'checkDynamicConditions', 'matchDomainEntryType', 'buildRuleIndex', 'newCompiledRules', 'extractIfConditions', 'validateCondition', 'analyzeRule', 'validateRule', 'checkRuleMatchOptimized', 'isLocalEntry', 'extractYamlRuleItems', 'parseRulesetContent', 'collectSubscriptionRules', 'isElementRuleLine', 'isScriptRuleLine', 'filterValidRuleLines'].map((n) => extractFn(src, n));
  const consts2 = src.match(/const SUPPORTED_REGEX_FLAGS = 'imsu';/)[0];
  const lang2 = src.match(/const LANG_TEXTS = \{[\s\S]*?\n  \};/)[0];
  const yApi = new Function(consts2 + '\n' + lang2 + `
let compiledRules;
const validationCache = new Map();
const subdomainCache = new Map();
let currentEngine = 'google', currentSite = 'www.google.com', currentCategory = 'web';
const window = { location: { get hostname() { return currentSite; } } };
function getSearchEngine() { return currentEngine; }
function getSearchCategory() { return currentCategory; }
function t(key) { return key; }
const currentConfig = { rules: [], debug: false };
let subscriptions = [];
function getSubscriptions() { return subscriptions; }
function getAllSubscriptionRules() { const r = []; subscriptions.filter((s) => s.enabled).forEach((s) => { if (s.rules && Array.isArray(s.rules)) r.push(...s.rules); }); return r; }
${yamlFns.join('\n')}
return { buildRuleIndex, checkRuleMatchOptimized, parseRulesetContent, collectSubscriptionRules, setState: (rules, subs) => { currentConfig.rules = rules; subscriptions = subs; } };
`)();

  const collect = (content) => {
    const parsed = yApi.parseRulesetContent(content);
    return { meta: parsed.meta, rules: yApi.collectSubscriptionRules(parsed.lines.map((l) => l.trim())) };
  };

  const h1 = collect('name: Test\nmatches:\n  - https://www.google.com/search?*\n  - https://www.bing.com/search?*\nrules:\n  - example.com\n');
  assert('修复H1-1(修复2回归): matches段与rules段同等保留且保持原顺序', JSON.stringify(h1.rules) === JSON.stringify(['https://www.google.com/search?*', 'https://www.bing.com/search?*', 'example.com']));
  yApi.setState([], [{ url: 's1', enabled: true, name: 'S1', rules: h1.rules }]);
  yApi.buildRuleIndex();
  const h1b = yApi.checkRuleMatchOptimized('https://www.google.com/search?q=t', 'www.google.com', 'T', null, ['www.google.com']);
  assert('修复H1-2(反转): matches规则现按黑名单生效, 搜索页URL被屏蔽', !!(h1b && h1b.blocked));
  const h1c = yApi.checkRuleMatchOptimized('https://example.com/x', 'example.com', 'T', null, ['example.com']);
  assert('修复H1-3(对照): 正常规则仍生效', !!(h1c && h1c.blocked));
  const h1d = collect('matches: [https://www.google.com/search?*]\nrules:\n  - flow.com\n');
  assert('修复H1-4(修复2回归): matches flow序列同样保留', JSON.stringify(h1d.rules) === JSON.stringify(['https://www.google.com/search?*', 'flow.com']));
  const h1e = collect('title: A\nmatches:\n  - *://*.b.com/*\n');
  assert('修复H1-5(修复2回归): 仅matches段的文件导入为非空规则集', JSON.stringify(h1e.rules) === JSON.stringify(['*://*.b.com/*']));

  const m1 = collect('description: Some list\nname: Some list\nrules:\n  - example.com\n');
  assert('修复M1-1: description开头文件正常进YAML', JSON.stringify(m1.rules) === JSON.stringify(['example.com']) && m1.meta.name === 'Some list');
  const m1b = collect('\n\n---\nname: My List\n---\nrules:\n  - a.com\n');
  assert('修复M1-2: frontmatter前导空行容忍', m1b.meta.name === 'My List' && JSON.stringify(m1b.rules) === JSON.stringify(['a.com']));
  const m1c = collect('homepage: https://x\nversion: 2\nrules:\n  - meta-first.com\n');
  assert('修复M1-3: 任意元数据键开头均可识别', JSON.stringify(m1c.rules) === JSON.stringify(['meta-first.com']));
  const m1d = collect('name: Flow\nrules: [a.com, b.com]\n');
  assert('修复M1-4: 单行flow序列解析', JSON.stringify(m1d.rules) === JSON.stringify(['a.com', 'b.com']));
  const m1e = yApi.parseRulesetContent("rules: ['x.com/a{2,3}', \"y.com\", z.com]");
  assert('修复M1-5: flow引号项含逗号/花括号不被拆坏', JSON.stringify(m1e.lines) === JSON.stringify(['x.com/a{2,3}', 'y.com', 'z.com']));
  const m1f = collect('whitelist: [keep.com, ok.com]\n');
  assert('修复M1-6: flow whitelist自动加@', JSON.stringify(m1f.rules) === JSON.stringify(['@keep.com', '@ok.com']));

  const m1g = collect('blacklist:\n  -\n    *://*.example.com/* # 注释\n');
  assert('修复Y-1: 块序列下一行条目去行内注释', JSON.stringify(m1g.rules) === JSON.stringify(['*://*.example.com/*']), m1g.rules);

  const l3 = collect('rules:\n  - localhost:8080/*\n  - user:pass@host/page\n');
  assert('修复L3: 无空格冒号键形标量保留', JSON.stringify(l3.rules) === JSON.stringify(['localhost:8080/*', 'user:pass@host/page']));

  const l4 = collect('blacklist:\n  - url: https://example.com\n  - real.com\n');
  assert('修复L4-1: 映射形项不再导入为激活规则', JSON.stringify(l4.rules) === JSON.stringify(['real.com']));
  yApi.setState([], [{ url: 's2', enabled: true, name: 'S2', rules: l4.rules }]);
  yApi.buildRuleIndex();
  const l4b = yApi.checkRuleMatchOptimized('https://example.com', 'example.com', 'T', null, ['example.com']);
  assert('修复L4-2: 映射形项不产生实际屏蔽', !(l4b && l4b.blocked));

  const fold = collect('rules:\n  - example.com\n  - >\n    *://folded.example.com/*\n  - kept.com\n');
  assert('修复2-1: 折叠标量整段保留且后续项不丢', JSON.stringify(fold.rules) === JSON.stringify(['example.com', '*://folded.example.com/*', 'kept.com']), fold.rules);
  const flowLines = yApi.parseRulesetContent('rules: [\n  a.com,\n  b.com\n]\n');
  assert('修复2-2: 跨行flow序列不把右括号当规则', JSON.stringify(flowLines.lines) === JSON.stringify(['a.com', 'b.com']));
  const inline = collect('rules:\n  - { url: "*://skip.com/*" }\n  - real.com\n');
  assert('修复2-3: 行内映射跳过且不生成恒不匹配规则', JSON.stringify(inline.rules) === JSON.stringify(['real.com']));
}

// ---- 修复4/修复5: 旧配置enabled回填 / 索引签名跳过重建 + 正则编译记忆化 ----
{
  const cfgDefaults = src.match(/const CFG_DEFAULTS = \{[^}]*\};/)[0];
  const fillBlank = new Function(cfgDefaults + '\nconst currentConfig = {};\nfor (const k in CFG_DEFAULTS) if (currentConfig[k] === undefined) currentConfig[k] = CFG_DEFAULTS[k];\nreturn currentConfig;');
  assert('修复4-1: 损坏/旧配置回填后 enabled=true', fillBlank().enabled === true);
  const fillKept = new Function(cfgDefaults + '\nconst currentConfig = { enabled: false };\nfor (const k in CFG_DEFAULTS) if (currentConfig[k] === undefined) currentConfig[k] = CFG_DEFAULTS[k];\nreturn currentConfig;');
  assert('修复4-2: 已有 enabled=false 不被覆盖', fillKept().enabled === false);
  assert('修复4-3: 默认配置含 enabled: true', /function getDefaultConfig\(\) \{[\s\S]*?enabled: true/.test(src));

  const fns5 = [
    'hostLabelToASCII', 'toASCIIHostname', 'toASCIIUrl', 'safeRegexTest', 'safeDecodeURIComponent', 'stripRuleComment', 'getInvalidRegexFlags', 'parseConditionPart',
    'tokenizeCondExpr', 'parseCondExprTokens', 'analyzeCondExpr', 'foldCondExpr',
    'evalDynamicLeaf', 'evalCondAST', 'extractBalancedParens', 'findIfOccurrences', 'stripIfConditions',
    'evaluateCondition', 'isCondExprCore', 'looksLikeCondExpr', 'absorbStandaloneExpr',
    'parseRuleWithConditions', 'validateUrlWildcard', 'ruleToRegex', 'parsePrefixedRegexRule',
    'escapeWildcardPart', 'wildcardToRegex', 'normalizeHostCandidate', 'matchWildcardDomainPattern', 'extractSimpleWhitelistDomain', 'matchSimpleDomain',
    'compileRuleRegex', 'checkDynamicConditions', 'matchDomainEntryType', 'buildRuleIndex', 'newCompiledRules',
    'extractIfConditions', 'validateCondition', 'analyzeRule', 'validateRule',
    'checkRuleMatchOptimized', 'isLocalEntry',
  ].map((n) => extractFn(src, n));
  const consts5 = src.match(/const SUPPORTED_REGEX_FLAGS = 'imsu';/)[0];
  const lang5 = src.match(/const LANG_TEXTS = \{[\s\S]*?\n  \};/)[0];
  const api = new Function(consts5 + '\n' + lang5 + `
let compiledRules;
const validationCache = new Map();
const subdomainCache = new Map();
let currentEngine = 'google';
let currentSite = 'www.google.com';
let currentCategory = 'web';
const window = { location: { get hostname() { return currentSite; } } };
function getSearchEngine() { return currentEngine; }
function getSearchCategory() { return currentCategory; }
function t(key, params = {}) {
  const texts = LANG_TEXTS['zh-CN'] || {};
  let text = texts[key] || key;
  for (const [k, v] of Object.entries(params)) text = text.replaceAll('{' + k + '}', v);
  return text;
}
const currentConfig = { rules: [], debug: false };
let subscriptions = [];
function getSubscriptions() { return subscriptions; }
function getAllSubscriptionRules() {
  const rules = [];
  subscriptions.filter(s => s.enabled).forEach(s => {
    if (s.rules && Array.isArray(s.rules)) rules.push(...s.rules);
  });
  return rules;
}
${fns5.join('\n')}
return {
  buildRuleIndex,
  checkRuleMatchOptimized,
  ruleToRegex,
  parsePrefixedRegexRule,
  compileRuleRegex,
  getCR: () => compiledRules,
  setState: (rules, subs) => { currentConfig.rules = rules; subscriptions = subs; },
  setCtx: (engine, site, category) => {
    if (engine !== undefined) currentEngine = engine;
    if (site !== undefined) currentSite = site;
    if (category !== undefined) currentCategory = category;
  },
};
`)();

  api.setState(['*://example.com/*'], []);
  api.setCtx('google', 'www.google.com', 'web');
  api.buildRuleIndex();
  const crA = api.getCR();
  crA.__marker = 'keep';
  api.buildRuleIndex();
  assert('修复5-1: 相同规则与页面上下文跳过重建', api.getCR() === crA && crA.__marker === 'keep');

  api.setState(['*://example.org/*'], []);
  api.buildRuleIndex();
  const crB = api.getCR();
  assert('修复5-2: 规则变化触发重建且无残留标记', api.getCR() !== crA && crB.__marker === undefined);
  const blockedOrg = api.checkRuleMatchOptimized('https://example.org/x', 'example.org', 't', '', ['example.org']);
  assert('修复5-3: 重建后新规则生效', !!(blockedOrg && blockedOrg.blocked));

  api.setCtx('bing', 'www.bing.com', 'web');
  api.buildRuleIndex();
  const crBing = api.getCR();
  assert('修复5-4: 页面上下文变化触发重建', crBing !== crB);
  api.setCtx('google', 'www.google.com', 'web');
  api.buildRuleIndex();
  const crC = api.getCR();
  crC.__marker = 'keep2';

  api.setState(['*://example.org/*'], [{ url: 's1', enabled: true, name: 'S1', rules: ['*://example.net/*'] }]);
  api.buildRuleIndex();
  assert('修复5-5: 订阅变化触发重建', api.getCR() !== crC);
  const crD = api.getCR();
  crD.__marker = 'keep3';
  api.buildRuleIndex();
  assert('修复5-6: 订阅不变时同样跳过重建', api.getCR() === crD && crD.__marker === 'keep3');

  api.setState(['*://example.org/*'], [{ url: 's1', enabled: false, name: 'S1', rules: ['*://example.net/*'] }]);
  api.buildRuleIndex();
  const crOff = api.getCR();
  assert('修复5-7: 订阅启用状态变化触发重建', crOff !== crD);

  const rr1 = api.ruleToRegex('/abc/i');
  const rr2 = api.ruleToRegex('/abc/i');
  assert('修复5-8: ruleToRegex 同输入复用结果', rr1 === rr2 && rr1.pattern === 'abc' && rr1.flags === 'i');
  const pp1 = api.parsePrefixedRegexRule('title/abc/i', 6);
  const pp2 = api.parsePrefixedRegexRule('title/abc/i', 6);
  assert('修复5-9: parsePrefixedRegexRule 同输入复用结果', pp1 === pp2 && pp1.pattern === 'abc' && pp1.flags === 'i');
  const cc1 = api.compileRuleRegex('/abc/i');
  const cc2 = api.compileRuleRegex('/abc/i');
  assert('修复5-10: compileRuleRegex 同输入复用编译产物', cc1 === cc2 && cc1.type === 'regex' && cc1.regex instanceof RegExp);
  const cc3 = api.compileRuleRegex('/abd/i');
  assert('修复5-11: 不同输入不误复用', cc3 !== cc1 && cc3.regex.source !== cc1.regex.source);
  const rw1 = api.ruleToRegex('example.com');
  assert('修复5-12: 通配规则结果与既有一致', rw1.pattern.indexOf('example') !== -1);

  // 修复18: 裸域简写只看主机段, 路径/查询里的*不再跳过子域展开; 主机段含*仍不套简写。
  const fix18Re = (rule) => { const r = api.ruleToRegex(rule); return new RegExp(r.pattern, r.flags); };
  assert('修复18-1: 裸域路径含*仍展开为子域简写(命中www子域)', fix18Re('example.com/path/*').test('https://www.example.com/path/x'));
  assert('修复18-2: 查询含*同样展开(命中根路径查询)', fix18Re('example.com?q=*page*').test('https://example.com/?q=abcpage2'));
  assert('修复18-3(对照): 无*的裸域路径简写行为不变', fix18Re('example.com/path').test('https://www.example.com/path'));
  assert('修复18-4(对照): 主机段含*不套简写(无*.*双重前缀且子域命中)', fix18Re('*.example.com/path/*').test('https://sub.example.com/path/x') && api.ruleToRegex('*.example.com/path/*').pattern.indexOf('*.*') === -1);
  assert('修复18-5(对照): 裸域路径规则不误命中无关主机', !fix18Re('example.com/path/*').test('https://other.example.net/path/x'));
  const lite18 = fs.readFileSync([path.join(scriptDir, 'Lite.user.js'), path.join(scriptDir, 'Other', 'Lite.user.js')].find((p) => fs.existsSync(p)), 'utf8');
  const liteR2R = new Function(['encodeNonAscii', 'hostLabelToASCII', 'toASCIIHostname', 'escapeWildcardPart', 'wildcardToRegex', 'parsePrefixedRegexRule', 'ruleToRegex'].map((n) => SERH_RAW_EXTRACT(lite18, n)).join('\n') + '\nreturn ruleToRegex;')();
  const lite18Re = (rule) => { const r = liteR2R(rule); return new RegExp(r.pattern, r.flags); };
  assert('修复18-6: Lite版ruleToRegex同步放宽(路径含*仍子域简写, 主机含*仍不套简写)', lite18Re('example.com/path/*').test('https://www.example.com/path/x') && lite18Re('*.example.com/path/*').test('https://sub.example.com/path/x') && liteR2R('*.example.com/path/*').pattern.indexOf('*.*') === -1);
}

// ---- 规则-300~314 + 修复1/5/6/2: title-text尾段flags / 畸形scheme / 紧贴@N / IDN通配 / Yahoo RU / host端口 ----
await (async () => {
const consts = src.match(/const SUPPORTED_REGEX_FLAGS = 'imsu';/)[0];
const langMatch = src.match(/const LANG_TEXTS = \{[\s\S]*?\n  \};/)[0];
const coreFns = [
  'hostLabelToASCII', 'toASCIIHostname', 'toASCIIUrl', 'safeRegexTest', 'safeDecodeURIComponent', 'stripRuleComment',
  'getInvalidRegexFlags', 'parseConditionPart', 'tokenizeCondExpr', 'parseCondExprTokens', 'analyzeCondExpr',
  'foldCondExpr', 'evalDynamicLeaf', 'evalCondAST', 'extractBalancedParens', 'findIfOccurrences',
  'stripIfConditions', 'evaluateCondition', 'isCondExprCore', 'looksLikeCondExpr', 'absorbStandaloneExpr',
  'parseRuleWithConditions', 'validateUrlWildcard', 'ruleToRegex', 'parsePrefixedRegexRule',
  'escapeWildcardPart', 'wildcardToRegex', 'normalizeHostCandidate', 'matchWildcardDomainPattern', 'extractSimpleWhitelistDomain', 'matchSimpleDomain',
  'validateCondition', 'analyzeRule', 'validateRule',
].map((n) => extractFn(src, n));

const analyzeApi = new Function(
  `${consts}\n${langMatch}\n` +
  `const window = { location: { hostname: 'www.google.com', pathname: '/search', search: '?q=x', href: 'https://www.google.com/search?q=x' } };\n` +
  `function getSearchEngine() { return 'google'; }\n` +
  `function getSearchCategory() { return 'web'; }\n` +
  `function t(key, params = {}) { return key; }\n` +
  coreFns.join('\n') +
  '\nreturn { analyzeRule, validateRule, validateUrlWildcard };'
)();

check('规则-300: text/…/images/png 尾段不再误报flags', analyzeApi.validateRule('text/example.com/images/png') === true);
check('规则-302: title/…/gr 尾段不再误报flags', analyzeApi.validateRule('title/foo/gr') === true);
check('规则-304: title/…/g 非法flags仍拒绝', analyzeApi.validateRule('title/abc/g') === false);
check('规则-306: title/…/gi 混合尾段仍按flags拒绝(对照规则-235)', analyzeApi.validateRule('title/x/gi') === false);
check('规则-307: 1*://… 畸形scheme拒绝', analyzeApi.validateRule('1*://example.com/*') === false);
check('规则-308: http*://… 畸形scheme拒绝', analyzeApi.validateRule('http*://example.com/*') === false);
check('规则-309: https://… 具体scheme仍有效', analyzeApi.validateRule('https://example.com/*') === true);

const idxFns = [
  'hostLabelToASCII', 'toASCIIHostname', 'toASCIIUrl', 'safeRegexTest', 'safeDecodeURIComponent', 'stripRuleComment', 'getInvalidRegexFlags', 'parseConditionPart',
  'tokenizeCondExpr', 'parseCondExprTokens', 'analyzeCondExpr', 'foldCondExpr',
  'evalDynamicLeaf', 'evalCondAST', 'extractBalancedParens', 'findIfOccurrences', 'stripIfConditions',
  'evaluateCondition', 'isCondExprCore', 'looksLikeCondExpr', 'absorbStandaloneExpr',
  'parseRuleWithConditions', 'validateUrlWildcard', 'ruleToRegex', 'parsePrefixedRegexRule',
  'escapeWildcardPart', 'wildcardToRegex', 'normalizeHostCandidate', 'matchWildcardDomainPattern', 'extractSimpleWhitelistDomain', 'matchSimpleDomain',
  'compileRuleRegex', 'checkDynamicConditions', 'matchDomainEntryType', 'buildRuleIndex', 'newCompiledRules',
  'extractIfConditions', 'validateCondition', 'analyzeRule', 'validateRule',
  'checkRuleMatchOptimized', 'isLocalEntry',
].map((n) => extractFn(src, n));

const api = new Function(
`${consts}
${langMatch}
let compiledRules;
const validationCache = new Map();
const subdomainCache = new Map();
let currentEngine = 'google';
let currentSite = 'www.google.com';
let currentCategory = 'web';
const window = { location: { get hostname() { return currentSite; } } };
function getSearchEngine() { return currentEngine; }
function getSearchCategory() { return currentCategory; }
function t(key, params = {}) {
  const texts = LANG_TEXTS['zh-CN'] || {};
  let text = texts[key] || key;
  for (const [k, v] of Object.entries(params)) text = text.replaceAll('{' + k + '}', v);
  return text;
}
const currentConfig = { rules: [], debug: false };
let subscriptions = [];
function getSubscriptions() { return subscriptions; }
function getAllSubscriptionRules() {
  const rules = [];
  subscriptions.filter(s => s.enabled).forEach(s => {
    if (s.rules && Array.isArray(s.rules)) rules.push(...s.rules);
  });
  return rules;
}
${idxFns.join('\n')}
return {
  buildRuleIndex,
  checkRuleMatchOptimized,
  escapeWildcardPart,
  getCR: () => compiledRules,
  setState: (rules, subs) => { currentConfig.rules = rules; subscriptions = subs; },
};
`)();

api.setState(['@1*://example.com/*'], []);
api.buildRuleIndex();
let cr = api.getCR();
const hlR = api.checkRuleMatchOptimized('https://example.com/x', 'example.com', 't', '', ['example.com']);
check('规则-311: 紧贴@N*:// 高亮命中且不屏蔽', !!hlR && hlR.highlight === 1 && !hlR.blocked);

api.setState(['@2*://*.example.com/* @if(title *= "t")'], []);
api.buildRuleIndex();
cr = api.getCR();
const hlC = api.checkRuleMatchOptimized('https://a.example.com/x', 'a.example.com', 't', '', ['a.example.com', 'example.com']);
check('规则-313: 紧贴@N与@if组合仍为条件高亮', (cr.highlightConditionalRules.length === 1 || cr.highlightConditionalDomains.size === 1) && !!hlC && hlC.highlight === 2);

// ---- 规则-362~365: @N+@if 高亮条件规则的编译与命中(并入原 repro-hl-conditional.cjs) ----
// 校验由 buildRuleIndex 内的 validateRule 兜底: 规则无效则不会入索引, 下面 362/363 必然失败
const HL_COND_RULE = '@1 *://*.example.com/* @if(title *= "测试")';
api.setState([HL_COND_RULE], []);
api.buildRuleIndex();
cr = api.getCR();
const hlCondList = cr.highlightConditionalDomains.get('example.com') || [];
check('规则-362: 编译进 highlightConditionalDomains(域名+级别1+原始规则+来源本地)',
  cr.highlightDomains.size === 0 && hlCondList.length === 1 && hlCondList[0].N === 1 &&
  hlCondList[0].originalRule === HL_COND_RULE && hlCondList[0].source === '本地规则' && hlCondList[0].isLocal === true,
  JSON.stringify(hlCondList));
const HL_COND_LEVELS = ['sub.example.com', 'example.com', 'com'];
const hlCondHit = api.checkRuleMatchOptimized('https://sub.example.com/page?q=x', 'sub.example.com', '这是一个测试页面', '', HL_COND_LEVELS);
check('规则-363: 标题命中条件时高亮并带 hlRule/hlSource(高亮规则可进统计)',
  !!(hlCondHit && hlCondHit.highlight === 1 && hlCondHit.hlRule === HL_COND_RULE && hlCondHit.hlSource === '本地规则' && !hlCondHit.blocked),
  hlCondHit);
check('规则-364: 标题不命中条件时不高亮', api.checkRuleMatchOptimized('https://sub.example.com/page?q=x', 'sub.example.com', '无关标题', '', HL_COND_LEVELS) === false);

api.setState(['@1 *://*.example.com/*'], []);
api.buildRuleIndex();
const hlPlainCr = api.getCR();
const hlPlainHit = api.checkRuleMatchOptimized('https://sub.example.com/page?q=x', 'sub.example.com', '任意标题', '', HL_COND_LEVELS);
check('规则-365(对照): 无@if 时走 highlightDomains 静态命中',
  hlPlainCr.highlightDomains.has('example.com') && hlPlainCr.highlightConditionalDomains.size === 0 && !!hlPlainHit && hlPlainHit.highlight === 1,
  [...hlPlainCr.highlightDomains.keys()]);

// ==== [修复-问题1/5/6] IDN中文通配符转ASCII / Yahoo重定向RU截断 / host端口条件匹配 ====
{
  // 问题1: escapeWildcardPart / toASCIIHostname 中文域名通配
  assert('修复1-1: 中文泛域名带星号通配正确编译为Punycode正则片段', api.escapeWildcardPart('*.例子*.com', true) === '(?:[^/]*\\.)?xn--[^./]*-kb7ap09a\\.com');
  const wcm = (rule, u) => {
    api.setState([rule], []);
    api.buildRuleIndex();
    const domain = new URL(u).hostname;
    return !!api.checkRuleMatchOptimized(u, domain, '', '', [domain]);
  };
  assert('修复1-2: 中文泛域名带星号通配匹配Punycode URL', wcm('*://*.例子*.com/*', 'https://a.xn--*-kb7ap09a.com/test'));
}
{
  // 问题5: Yahoo 重定向 RU= 在目标 URL 含两个字母加等号时不被提前截断
  const gcu = new Function(
    extractFn(src, 'decodeRedirectTarget') + '\n' +
    extractFn(src, 'decodeBingCkTarget') + '\n' +
    extractFn(src, 'unwrapRedirectUrl') + '\n' +
    extractFn(src, 'getCleanUrl') + '\nreturn getCleanUrl;'
  )();
  const yahooWithParam = { href: 'https://search.yahoo.com/r/RU=https%3A%2F%2Fexample.com%2Fapi%2Fno=123/RK=2/RS=abc123xyz' };
  assert('修复5-1b: Yahoo RU= 参数含 2 字母等号时不被截断', gcu(yahooWithParam) === 'https://example.com/api/no=123');
}
{
  // 问题6: evalDynamicLeaf host 表达式支持端口
  const condEvalHost = new Function(
    ['hostLabelToASCII', 'toASCIIHostname', 'toASCIIUrl', 'safeRegexTest', 'safeDecodeURIComponent', 'stripRuleComment', 'getInvalidRegexFlags', 'parseConditionPart',
     'tokenizeCondExpr', 'parseCondExprTokens', 'analyzeCondExpr', 'foldCondExpr', 'evalDynamicLeaf', 'evalCondAST'].map(n => extractFn(src, n)).join('\n') +
    '\nreturn { evalDynamicLeaf };'
  )();
  assert('修复6-1: host = "localhost:8080" 匹配带端口URL', condEvalHost.evalDynamicLeaf({ type: 'host', op: '=', val: 'localhost:8080' }, '', 'http://localhost:8080/x') === true);
  assert('修复6-2: host = "localhost:8080" 不匹配其他端口URL', condEvalHost.evalDynamicLeaf({ type: 'host', op: '=', val: 'localhost:8080' }, '', 'http://localhost:9090/x') === false);
  assert('修复6-4: host $= ".example.com:8080" 后缀匹配子域加端口URL', condEvalHost.evalDynamicLeaf({ type: 'host', op: '$=', val: '.example.com:8080' }, '', 'http://sub.example.com:8080/x') === true);
  assert('修复6-5: host 无端口条件兼容带端口URL的hostname匹配', condEvalHost.evalDynamicLeaf({ type: 'host', op: '=', val: 'localhost' }, '', 'http://localhost:8080/x') === true);
}
{
  const wcApi = new Function(`
${extractFn(src, 'hostLabelToASCII')}
${extractFn(src, 'toASCIIHostname')}
${extractFn(src, 'escapeWildcardPart')}
${extractFn(src, 'wildcardToRegex')}
${extractFn(src, 'parsePrefixedRegexRule')}
${extractFn(src, 'ruleToRegex')}
${extractFn(src, 'compileRuleRegex')}
${extractFn(src, 'safeRegexTest')}
return { compileRuleRegex, safeRegexTest };
`)();
  const reA = wcApi.compileRuleRegex('*://example.com/release');
  assert('规则-316(对照): 规则路径后的普通字符不越界(releasex 不命中)', !wcApi.safeRegexTest(reA.regex, 'https://example.com/releasex'));
}
{
  const wcApi2 = new Function(`
${extractFn(src, 'hostLabelToASCII')}
${extractFn(src, 'toASCIIHostname')}
${extractFn(src, 'escapeWildcardPart')}
${extractFn(src, 'wildcardToRegex')}
${extractFn(src, 'parsePrefixedRegexRule')}
${extractFn(src, 'ruleToRegex')}
${extractFn(src, 'compileRuleRegex')}
${extractFn(src, 'safeRegexTest')}
return { compileRuleRegex, safeRegexTest };
`)();
  const reF = wcApi2.compileRuleRegex('*://*example.com/*');
  assert('修复2-1b: 主机星号不跨点(*example.com 不命中 exa.mple.com)', !wcApi2.safeRegexTest(reF.regex, 'https://exa.mple.com/'));
  assert('修复2-2b: 主机星号仍匹配同标签(*example.com 命中 badexample.com 与 wwwexample.com)', wcApi2.safeRegexTest(reF.regex, 'https://badexample.com/') && wcApi2.safeRegexTest(reF.regex, 'https://wwwexample.com/'));
  const reG = wcApi2.compileRuleRegex('*://ex*mple.com/*');
  assert('修复2-4: 主机中部星号仍匹配同标签(ex*mple.com 命中 example.com)', wcApi2.safeRegexTest(reG.regex, 'https://example.com/'));
  const reH = wcApi2.compileRuleRegex('*://例*.com/*');
  assert('修复6-6: IDN部分标签通配按整标签punycode命中(例*.com 命中 xn--*-kb7a.com)', wcApi2.safeRegexTest(reH.regex, 'https://xn--*-kb7a.com/'));
  assert('修复6-7: IDN部分标签通配不把星号留在汉字里(例*.com 不再要求URL含「例」)', !/例/.test(reH.regex.source));
  const reI = wcApi2.compileRuleRegex('*://*.例子*.com/*');
  assert('修复6-8: 前缀*.与IDN标签内星号同时按punycode命中', wcApi2.safeRegexTest(reI.regex, 'https://a.xn--*-kb7ap09a.com/test') && wcApi2.safeRegexTest(reI.regex, 'https://xn--*-kb7ap09a.com/'));
}
})();

// ---- 修复R-2: YAML name行引号不配对时容错提取 ----
{
  const pc = new Function(
    extractFn(src, 'extractYamlRuleItems') + '\n' + extractFn(src, 'parseRulesetContent') + '\nreturn parseRulesetContent;'
  )();
  let threw = false;
  let res;
  try { res = pc('name: "My list\nrules:\n  - *://a.com/*\n'); } catch (_) { threw = true; }
  assert('修复R-2: YAML name行引号不配对时容错提取且不抛错', threw === false && res.meta.name === 'My list' && res.lines.length === 1);
}

// ---- 复核: *://*.tld/*(单标签父域)经regex回退路径正常生效 ----
{
  const langV = src.match(/const LANG_TEXTS = \{[\s\S]*?\n  \};/)[0];
  const envV = new Function(
    src.match(/const SUPPORTED_REGEX_FLAGS = 'imsu';/)[0] + '\n' + langV + '\n' +
    ['hostLabelToASCII', 'toASCIIHostname', 'toASCIIUrl', 'safeRegexTest', 'safeDecodeURIComponent', 'stripRuleComment', 'getInvalidRegexFlags', 'parseConditionPart',
     'tokenizeCondExpr', 'parseCondExprTokens', 'analyzeCondExpr', 'foldCondExpr', 'evalDynamicLeaf', 'evalCondAST', 'extractBalancedParens', 'findIfOccurrences', 'stripIfConditions',
     'evaluateCondition', 'isCondExprCore', 'looksLikeCondExpr', 'absorbStandaloneExpr', 'parseRuleWithConditions', 'extractIfConditions', 'validateCondition', 'analyzeRule', 'validateRule',
     'validateUrlWildcard', 'parsePrefixedRegexRule', 'escapeWildcardPart', 'wildcardToRegex', 'ruleToRegex', 'normalizeHostCandidate', 'matchWildcardDomainPattern', 'extractSimpleWhitelistDomain', 'matchSimpleDomain',
     'compileRuleRegex', 'checkDynamicConditions', 'matchDomainEntryType', 'buildRuleIndex', 'newCompiledRules', 'checkRuleMatchOptimized', 'isLocalEntry'
    ].map((n) => extractFn(src, n)).join('\n') +
    `\nconst validationCache = new Map(); const subdomainCache = new Map(); let compiledRules;
const window = { location: { hostname: 'www.google.com' } };
function getSearchEngine() { return 'google'; } function getSearchCategory() { return 'web'; }
const currentConfig = { rules: [], debug: false, language: 'zh-CN' }; let subscriptions = [];
function getSubscriptions() { return subscriptions; }
function getAllSubscriptionRules() { const r = []; subscriptions.filter(s => s.enabled).forEach(s => { if (Array.isArray(s.rules)) r.push(...s.rules); }); return r; }
${src.match(/function t\(key, params = \{\}\) \{[\s\S]*?\n  \}/)[0]}
return { buildRuleIndex, checkRuleMatchOptimized, getCR: () => compiledRules, setState: (rules, subs) => { currentConfig.rules = rules; subscriptions = subs; } };`
  )();
  envV.setState(['*://*.com/*'], []); envV.buildRuleIndex();
  const vBl = envV.checkRuleMatchOptimized('https://example.com/x', 'example.com', 't', '', ['example.com']);
  assert('审查V-1(复核): *://*.com/* 黑名单经regex回退命中带点域名', vBl && vBl.blocked === true);
  envV.setState(['@*://*.com/*'], [{ enabled: true, url: 's1', rules: ['ads.com'] }]); envV.buildRuleIndex();
  const vWl = envV.checkRuleMatchOptimized('https://example.com/x', 'example.com', 't', '', ['example.com', 'ads.com']);
  assert('审查V-2(复核): @*://*.com/* 白名单经regex回退放行(文档2.6示例)', !vWl || vWl.blocked !== true);
  envV.setState(['@1 *://*.io/*'], []); envV.buildRuleIndex();
  const vHl = envV.checkRuleMatchOptimized('https://x.io/y', 'x.io', 't', '', ['x.io']);
  assert('审查V-3(复核): @1 *://*.io/* 高亮经regex回退命中', vHl && vHl.highlight === 1);
}

// ---- 已修复: userinfo规则不进域名快路径, 走通配正则命中 ----
{
  const lang5 = src.match(/const LANG_TEXTS = \{[\s\S]*?\n  \};/)[0];
  const env5 = new Function(
    src.match(/const SUPPORTED_REGEX_FLAGS = 'imsu';/)[0] + '\n' + lang5 + '\n' +
    ['hostLabelToASCII', 'toASCIIHostname', 'toASCIIUrl', 'safeRegexTest', 'safeDecodeURIComponent', 'stripRuleComment', 'getInvalidRegexFlags', 'parseConditionPart',
     'tokenizeCondExpr', 'parseCondExprTokens', 'analyzeCondExpr', 'foldCondExpr', 'evalDynamicLeaf', 'evalCondAST', 'extractBalancedParens', 'findIfOccurrences', 'stripIfConditions',
     'evaluateCondition', 'isCondExprCore', 'looksLikeCondExpr', 'absorbStandaloneExpr', 'parseRuleWithConditions', 'extractIfConditions', 'validateCondition', 'analyzeRule', 'validateRule',
     'validateUrlWildcard', 'parsePrefixedRegexRule', 'escapeWildcardPart', 'wildcardToRegex', 'ruleToRegex', 'normalizeHostCandidate', 'matchWildcardDomainPattern', 'extractSimpleWhitelistDomain', 'matchSimpleDomain',
     'compileRuleRegex', 'checkDynamicConditions', 'getSubdomainLevels', 'matchDomainEntryType', 'buildRuleIndex', 'newCompiledRules', 'checkRuleMatchOptimized', 'isLocalEntry'
    ].map((n) => extractFn(src, n)).join('\n') +
    `\nconst validationCache = new Map(); const subdomainCache = new Map(); let compiledRules;
const window = { location: { hostname: 'www.google.com' } };
function getSearchEngine() { return 'google'; } function getSearchCategory() { return 'web'; }
const currentConfig = { rules: [], debug: false, language: 'zh-CN' };
function getSubscriptions() { return []; } function getAllSubscriptionRules() { return []; }
${src.match(/function t\(key, params = \{\}\) \{[\s\S]*?\n  \}/)[0]}
return { buildRuleIndex, checkRuleMatchOptimized, compileRuleRegex, safeRegexTest, matchSimpleDomain, analyzeRule, getCR: () => compiledRules, setRules: (rules) => { currentConfig.rules = rules; } };`
  )();
  env5.setRules(['*://user@example.com/*']); env5.buildRuleIndex();
  const cr = env5.getCR();
  const missed = env5.checkRuleMatchOptimized('https://user@example.com/page', 'example.com', '', '');
  assert('审查5-R1(已修复): *://user@example.com/* 不进域名快路径, 走通配正则后命中带账号URL, 无账号同主机不命中', env5.analyzeRule('*://user@example.com/*').valid === true && !cr.domains.has('user@example.com') && missed && missed.blocked === true && env5.checkRuleMatchOptimized('https://example.com/page', 'example.com', '', '') === false);
  env5.setRules(['@*://user@example.com/*', 'example.com']); env5.buildRuleIndex();
  const wlHit = env5.checkRuleMatchOptimized('https://user@example.com/page', 'example.com', '', '');
  const bareStill = env5.checkRuleMatchOptimized('https://example.com/page', 'example.com', '', '');
  assert('审查5-R1b(已修复): 白名单 @*://user@example.com/* 放行带账号URL, 无账号同主机仍被黑名单屏蔽', !env5.getCR().whitelistDomains.has('user@example.com') && (!wlHit || wlHit.blocked !== true) && bareStill && bareStill.blocked === true);
}

// ---- 高亮只附加边框, 不改变屏蔽的隐藏结果 ----
{
  const paint = (matchResult, presetDisplay) => {
    const result = { attrs: {}, style: { display: presetDisplay || '', outline: '', outlineOffset: '' }, classes: new Set(), dataset: {}, children: [] };
    result.setAttribute = (k, v) => { result.attrs[k] = String(v); };
    result.getAttribute = (k) => (k in result.attrs ? result.attrs[k] : null);
    result.removeAttribute = (k) => { delete result.attrs[k]; };
    result.hasAttribute = (k) => k in result.attrs;
    result.classList = { add: (c) => result.classes.add(c), remove: (c) => result.classes.delete(c) };
    result.querySelector = () => null;
    result.matches = () => false;
    result.closest = () => null;
    const link = { href: 'https://example.com/page' };
    new Function('result', 'link', 'matchResult', `
      const showHiddenResults = false;
      function blockedShown() { return showHiddenResults; }
      const currentConfig = { enabled: true, showBlockBtn: false, highlightColors: { 2: '#123456' } };
      function getSearchEngine() { return 'other'; }
      function getResultLink() { return link; }
      function resolveUrlDomain() { return { url: link.href, domain: 'example.com' }; }
      function getResultTitle() { return ''; }
      function getResultSnippet() { return ''; }
      function buildContentSignature() { return ''; }
      function getSubdomainLevels() { return ['example.com']; }
      function checkRuleMatchOptimized() { return matchResult; }
      const _hrefUrlCache = { set() {} }, _resultContentCache = { set() {} }, _resultRetryCounts = { delete() {} };
      function saveOriginalDisplay(el) { if (el._orig === undefined) el._orig = el.style.display; }
      function restoreOriginalDisplay(el) { el.style.display = el._orig !== undefined ? el._orig : ''; }
      function setResultExtraElementsVisible() {}
      function clearMatchedData() {}
      function injectBlockButton() {}
      ${extractFn(src, 'processSingleResult')}
      return processSingleResult(result);
    `)(result, link, matchResult);
    return result;
  };
  const both = paint({ highlight: 2, blocked: true, rule: 'example.com', source: '本地规则' });
  const only = paint({ highlight: 2 });
  assert('高亮附加: 同时屏蔽时仍隐藏且保留边框', both.getAttribute('data-is-blocked') === 'true' && both.style.display === 'none' && both.style.outline === '2px solid #123456' && both.getAttribute('data-highlight-n') === '2');
  assert('高亮附加(对照): 仅高亮时不隐藏', only.getAttribute('data-is-blocked') === null && only.style.display === '' && only.style.outline === '2px solid #123456');
  // 审查修复1: 仅高亮命中时按原始display还原, 不强制显示站点内联隐藏元素
  const ghost = paint({ highlight: 2 }, 'none');
  assert('审查修复1(已修复): 仅高亮命中恢复原始display(内联none不强制显示)', ghost.style.display === 'none' && ghost.getAttribute('data-is-highlighted') === 'true');
}

// ---- 已修复: 悬浮球"显示被屏蔽结果"按data-serh-orig-display还原 ----
{
  const mkParent = (orig) => { const p = { attrs: orig !== null ? { 'data-serh-orig-display': orig } : {}, style: { display: 'none' } }; p.getAttribute = (k) => (k in p.attrs ? p.attrs[k] : null); return p; };
  const run = (parent) => new Function('parent', `
    let showHiddenResults = false;
    const document = { querySelectorAll: (sel) => (sel.indexOf('data-is-blocked') !== -1 ? [] : [parent]), getElementById: () => null };
    ${extractFn(src, 'saveOriginalDisplay')}
    ${extractFn(src, 'restoreOriginalDisplay')}
    ${extractFn(src, 'toggleHiddenResults')}
    toggleHiddenResults();
    return parent.style.display;
  `)(parent);
  check('审查4-1(已修复): 父容器原内联 display:flex 被隐藏后, 切换显示时按 data-serh-orig-display 还原(此前被置空致布局塌陷)', run(mkParent('flex')) === 'flex' && run(mkParent(null)) === '');
}

// ---- 已修复: 悬浮球收起分支重新隐藏Google图片网格单元格 ----
{
  const runGrid = (scriptText) => {
    const grid = { style: { display: '' } };
    const yandex = { style: { display: '' }, children: [] };
    const bySel = {
      '[data-blocker-google-parent], [data-blocker-yandex-parent], [data-serh-grid-item-hidden]': [grid],
      '[data-blocker-yandex-parent]': [yandex],
      '[data-blocker-google-parent]': [],
      '[data-serh-grid-item-hidden]': [grid]
    };
    return new Function('bySel', `
      let showHiddenResults = true;
      const document = { querySelectorAll: (sel) => (bySel[sel] || []), getElementById: () => null };
      const currentConfig = {};
      const blockedShown = () => false;
      function hideParentIfNoVisibleSiblings() {}
      function googleResultBlocks() { return []; }
      ${extractFn(scriptText, 'saveOriginalDisplay')}
      ${extractFn(scriptText, 'restoreOriginalDisplay')}
      ${extractFn(scriptText, 'toggleHiddenResults')}
      toggleHiddenResults();
      const grid2 = bySel['[data-serh-grid-item-hidden]'][0]; const yandex2 = bySel['[data-blocker-yandex-parent]'][0];
      return { grid: grid2.style.display, yandex: yandex2.style.display };
    `)(bySel);
  };
  const liteSrcG = fs.readFileSync([path.join(scriptDir, 'Lite.user.js'), path.join(scriptDir, 'Other', 'Lite.user.js')].find((p) => fs.existsSync(p)), 'utf8');
  assert('审查G-1(已修复): 收起分支重新隐藏data-serh-grid-item-hidden单元格(此前留空白占位格)', runGrid(src).grid === 'none');
  assert('审查G-2: Lite版收起分支同步重隐藏', runGrid(liteSrcG).grid === 'none');
  assert('审查G-3(对照): yandex/google父容器收起路径不受影响', runGrid(src).yandex === '' && runGrid(liteSrcG).yandex === '');
}

// ---- 已修复: @@if不再编译成白名单条件 ----
{
  const lang62 = src.match(/const LANG_TEXTS = \{[\s\S]*?\n  \};/)[0];
  const env62 = new Function(
    src.match(/const SUPPORTED_REGEX_FLAGS = 'imsu';/)[0] + '\n' + lang62 + '\n' +
    ['hostLabelToASCII', 'toASCIIHostname', 'toASCIIUrl', 'encodeNonAscii', 'safeRegexTest', 'safeDecodeURIComponent', 'stripRuleComment', 'getInvalidRegexFlags', 'parseConditionPart',
     'tokenizeCondExpr', 'parseCondExprTokens', 'analyzeCondExpr', 'foldCondExpr', 'evalDynamicLeaf', 'evalCondAST', 'extractBalancedParens', 'findIfOccurrences', 'stripIfConditions',
     'evaluateCondition', 'isCondExprCore', 'looksLikeCondExpr', 'absorbStandaloneExpr', 'parseRuleWithConditions', 'extractIfConditions', 'validateCondition', 'analyzeRule', 'validateRule',
     'validateUrlWildcard', 'parsePrefixedRegexRule', 'escapeWildcardPart', 'wildcardToRegex', 'ruleToRegex', 'normalizeHostCandidate', 'matchWildcardDomainPattern', 'extractSimpleWhitelistDomain', 'matchSimpleDomain',
     'compileRuleRegex', 'checkDynamicConditions', 'getSubdomainLevels', 'matchDomainEntryType', 'buildRuleIndex', 'newCompiledRules', 'checkRuleMatchOptimized', 'isLocalEntry'
    ].map((n) => extractFn(src, n)).join('\n') +
    `\nconst validationCache = new Map(); const subdomainCache = new Map(); let compiledRules;
const window = { location: { hostname: 'www.google.com' } };
function getSearchEngine() { return 'google'; } function getSearchCategory() { return 'web'; }
const currentConfig = { rules: ['@@if(title *= "a")', 'example.com'], debug: false, language: 'zh-CN' };
function getSubscriptions() { return []; } function getAllSubscriptionRules() { return []; }
${src.match(/function t\(key, params = \{\}\) \{[\s\S]*?\n  \}/)[0]}
return { buildRuleIndex, checkRuleMatchOptimized, getSubdomainLevels, getCR: () => compiledRules };`
  )();
  env62.buildRuleIndex();
  const lv = env62.getSubdomainLevels('example.com');
  const titled = env62.checkRuleMatchOptimized('https://example.com/a', 'example.com', 'a news', '', lv);
  const other = env62.checkRuleMatchOptimized('https://example.com/a', 'example.com', 'b news', '', lv);
  const wl = env62.getCR().whitelistConditionalRules;
  assert('审查6-2(已修复): @@if(title *= "a") 不进入白名单条件, 标题含a仍被 example.com 屏蔽', titled && titled.blocked === true && (!wl || wl.length === 0));
  assert('审查6-2(对照): 标题不含a同样屏蔽', other && other.blocked === true);
}

// ---- 规则-213~243: 同步容错与解析契约(错误响应/同步头剔除/选择器继承/白名单前缀) ----
await (async () => {

  // 含 userinfo 的 URL 正常匹配(host 通配正则识别 user@ 前缀)
  {
    const api = new Function(
      ['hostLabelToASCII', 'toASCIIHostname', 'escapeWildcardPart', 'wildcardToRegex', 'parsePrefixedRegexRule', 'ruleToRegex', 'compileRuleRegex', 'safeRegexTest']
        .map(n => extractFn(src, n)).join('\n') +
      '\nreturn { compileRuleRegex, safeRegexTest };'
    )();
    const match = (rule, url) => { const c = api.compileRuleRegex(rule); return api.safeRegexTest(c.regex, url); };
    check('规则-213: *://*.example.com/* 正常匹配 https://user@example.com/', match('*://*.example.com/*', 'https://user@example.com/') === true);
    check('规则-213-3: *://user:pass@example.com:8080/* 规则正常编译与匹配', match('*://user:pass@example.com:8080/*', 'https://user:pass@example.com:8080/page') === true);
  }

  // YAML 双引号项含非标准转义时跳过坏项并保留其余规则
  {
    const parseRulesetContent = new Function('currentConfig',
      extractFn(src, 'extractYamlRuleItems') + '\n' + extractFn(src, 'parseRulesetContent') + '\nreturn parseRulesetContent;'
    )({ debug: false });
    let threw = false;
    try { parseRulesetContent('name: t\nrules:\n  - "bad \\q escape"\n  - example.com'); } catch (e) { threw = true; }
  check('规则-214: 单个坏转义项跳过且保留其他规则', threw === false && parseRulesetContent('name: t\nrules:\n  - "bad \\q escape"\n  - example.com').lines.includes('example.com'));
  const flowFirst = parseRulesetContent('name: t\nblacklist: [a.com,\n  b.com]');
  check('规则-216(已修复): 跨行flow首行[后带首元素正常解析', flowFirst.lines.length === 2 && flowFirst.lines.includes('a.com') && flowFirst.lines.includes('b.com') && flowFirst.meta.name === 't');
  }

  // text/html 响应头的自家格式内容不再误判无效
  {
    const isInvalidSyncResponse = new Function(
      extractFn(src, 'isHtmlResponse') + '\n' + extractFn(src, 'isInvalidSyncResponse') + '\nreturn isInvalidSyncResponse;'
    )();
    const good = '# ScriptConfig: {"t":1}\n*://example.com/*';
    check('规则-215: 合法规则内容 + text/html CT 仍可用', isInvalidSyncResponse(good, 'content-type: text/html; charset=utf-8') === false);
  }

  // 前 50 行内 JSON 解析失败的 # ScriptConfig: 行自动剔除 (修复2)
  {
    const parseSyncHeaderFn = extractFn(src, 'parseSyncHeader');
    const run = (content) => new Function('currentConfig', 'console', `${parseSyncHeaderFn}\nreturn parseSyncHeader;`)({ debug: false }, { warn: () => {} })(content);
    const r2 = run('# ScriptConfig:{"syncedAt":12\nrule1');
    check('规则-217(修复2): JSON 截断(缺后括号})头行剔除出 restLines 且不重发, 不再被当规则合并', r2.config === null && r2.rawScriptConfig === null && r2.restLines.join('\n') === 'rule1');
  }

  // 部分覆盖内置引擎时 match 继承内置
  {
    const selectorsDecl = src.match(/const SELECTORS = \{[\s\S]*?\n  \};/)[0];
    const builtinSelectorOfDecl = src.match(/const builtinSelectorOf = .+?;/)[0];
    const makeGetSelectors = (gmGetValue) => new Function(
      'GM_getValue',
      'let activeSelectors = null;\n' +
      "const SELECTORS_KEY = 'searchfilter_selectors';\n" +
      selectorsDecl + '\n' + builtinSelectorOfDecl + '\n' +
      ['normalizeSelectorList', 'mergeSelectorDef', 'getUserSelectors', 'getSelectors'].map(n => extractFn(src, n)).join('\n') +
      '\nreturn getSelectors;'
    )(gmGetValue);
    const merged = makeGetSelectors(() => ({ bing: { snippets: ['.my-snip'] } }))();
    check('规则-218: 部分覆盖选择器时继承内置 bing match', merged.bing.match instanceof RegExp && merged.bing.snippets[0] === '.my-snip');
    const ok = makeGetSelectors(() => ({ bing: { match: 'bing\\.com', containers: 'li.b_algo' } }))();
    check('规则-219(对照): 提供 match 时正常编译为 RegExp', ok.bing.match instanceof RegExp);
  }

  // KI-G/H: 双重白名单前缀和uBO元数据注释的回归
  {
    const fnsToExtract = [
      'hostLabelToASCII', 'toASCIIHostname', 'toASCIIUrl', 'safeRegexTest', 'safeDecodeURIComponent', 'stripRuleComment',
      'getInvalidRegexFlags', 'parseConditionPart', 'tokenizeCondExpr', 'parseCondExprTokens', 'analyzeCondExpr',
      'foldCondExpr', 'evalDynamicLeaf', 'evalCondAST', 'extractBalancedParens', 'findIfOccurrences',
      'stripIfConditions', 'evaluateCondition', 'isCondExprCore', 'looksLikeCondExpr', 'absorbStandaloneExpr',
      'parseRuleWithConditions', 'validateUrlWildcard', 'ruleToRegex', 'parsePrefixedRegexRule',
      'escapeWildcardPart', 'wildcardToRegex', 'splitHostAndPort', 'escapeHostPart',
      'normalizeHostCandidate', 'matchWildcardDomainPattern', 'extractSimpleWhitelistDomain', 'matchSimpleDomain',
      'validateCondition', 'analyzeRule', 'validateRule', 'isScriptRuleLine', 'isElementRuleLine',
      'collectSubscriptionRules'
    ];
    const langMatch = src.match(/const LANG_TEXTS = \{[\s\S]*?\n  \};/)[0];
    const consts = src.match(/const SUPPORTED_REGEX_FLAGS = 'imsu';/)[0];
    const api = new Function(
      `${consts}\n${langMatch}\n` +
      `const window = { location: { hostname: 'www.google.com' } };\n` +
      `function getSearchEngine() { return 'google'; }\n` +
      `function getSearchCategory() { return 'web'; }\n` +
      `function t(key, params = {}) { return key; }\n` +
      `const currentConfig = { debug: false };\n` +
      fnsToExtract.map(n => extractFn(src, n)).join('\n') +
      '\nreturn { analyzeRule, validateRule, validateUrlWildcard, extractSimpleWhitelistDomain, matchWildcardDomainPattern, looksLikeCondExpr, collectSubscriptionRules, parseRuleWithConditions };'
    )();
    check('规则-220: @@example.com 被语法拒绝', api.analyzeRule('@@example.com').valid === false);
    check('规则-222: uBO注释 !site = example.com 被过滤', api.collectSubscriptionRules(['!site = example.com']).length === 0);

    const wlGuard = (rule) => {
      const parsed = api.parseRuleWithConditions(rule);
      return parsed.staticPass && parsed.coreRule.startsWith('@') && !parsed.coreRule.startsWith('@@')
        && (parsed.coreRule.length > 1 || parsed.standaloneExpr || parsed.dynamicConditions.length > 0);
    };
    const hlGuard = (rule) => {
      const hlBody = rule.replace(/^@\d+\s*/, '');
      const parsed = api.parseRuleWithConditions(hlBody);
      return parsed.staticPass && !parsed.coreRule.startsWith('@@');
    };
    check('规则-224: @@规则不再计入白名单(与编译器跳过一致)', wlGuard('@@example.com') === false);
    check('规则-225(对照): 正常白名单仍计入', wlGuard('@*://*.example.com/*') === true);
    check('规则-226(对照): @+条件表达式白名单仍计入', wlGuard('@host $= ".example.com"') === true);
    check('规则-227: @N+白名单组合计入高亮', hlGuard('@1 @example.com') === true);
    check('规则-228(对照): 正常高亮仍计入', hlGuard('@1 example.com') === true);
  }


  // title/text 尾部非法flags(g/y)在 analyzeRule 报 invalidRegexFlags(与 /regex/ 路径一致)
  {
    const parsePrefixedRegexRule = new Function(
      extractFn(src, 'parsePrefixedRegexRule') + '\nreturn parsePrefixedRegexRule;'
    )();

    const fnsToExtract = [
      'hostLabelToASCII', 'toASCIIHostname', 'toASCIIUrl', 'safeRegexTest', 'safeDecodeURIComponent', 'stripRuleComment',
      'getInvalidRegexFlags', 'parseConditionPart', 'tokenizeCondExpr', 'parseCondExprTokens', 'analyzeCondExpr',
      'foldCondExpr', 'evalDynamicLeaf', 'evalCondAST', 'extractBalancedParens', 'findIfOccurrences',
      'stripIfConditions', 'evaluateCondition', 'isCondExprCore', 'looksLikeCondExpr', 'absorbStandaloneExpr',
      'parseRuleWithConditions', 'validateUrlWildcard', 'ruleToRegex', 'parsePrefixedRegexRule',
      'escapeWildcardPart', 'wildcardToRegex', 'splitHostAndPort', 'escapeHostPart',
      'normalizeHostCandidate', 'matchWildcardDomainPattern', 'extractSimpleWhitelistDomain', 'matchSimpleDomain',
      'validateCondition', 'analyzeRule', 'validateRule', 'isScriptRuleLine', 'isElementRuleLine',
      'collectSubscriptionRules'
    ];
    const langMatch = src.match(/const LANG_TEXTS = \{[\s\S]*?\n  \};/)[0];
    const consts = src.match(/const SUPPORTED_REGEX_FLAGS = 'imsu';/)[0];
    const analyzeRule = new Function(
      `${consts}\n${langMatch}\n` +
      `function t(key, params = {}) { return key; }\n` +
      fnsToExtract.map(n => extractFn(src, n)).join('\n') +
      '\nreturn analyzeRule;'
    )();
    const flagsErrorOf = (rule) => {
      const a = analyzeRule(rule);
      return (a.errors.find(e => e.indexOf('invalidRegexFlags') === 0) || '').includes('g');
    };
    check('规则-233: title/…/gi 判定无效并报flags错误', analyzeRule('title/.*广告.*/gi').valid === false && flagsErrorOf('title/.*广告.*/gi'));
    check('规则-236: 行尾注释剥离后仍检测', analyzeRule('title/abc/gi # 注释').valid === false);
    check('规则-237: 对照 字面路径def仍有效', analyzeRule('title/abc/def').valid === true);
    check('审查R-1: 无空格 @1@*:// 仍报通配无效', analyzeRule('@1@*://*.example.com/*').valid === false && analyzeRule('@1@*://*.example.com/*').errors.indexOf('hlWhitelistConflict') === -1);
    check('审查R-1(对照): 中间有空格的 @1 @*:// 不再报高亮与白名单冲突', analyzeRule('@1 @*://*.example.com/*').valid === true && analyzeRule('@1 @*://*.example.com/*').errors.indexOf('hlWhitelistConflict') === -1);
    check('审查R-1(对照): 紧贴 @1*:// 仍是合法高亮', analyzeRule('@1*://*.example.com/*').valid === true);
    check('规则-241(已修复): 全转义斜杠=无闭合界定符, 按未闭合直接报错(不再整段静默沦为字面pattern)', analyzeRule('title/https:\\/\\/foo\\/i').valid === false);
    check('规则-241(对照): 转义斜杠+闭合界定符正常有效', analyzeRule('title/https:\\/\\/foo\\/i/').valid === true);
  }


  // YAML 块序列 "-" 换行后的缩进标量回归
  {
    const parseRulesetContent = new Function(
      extractFn(src, 'extractYamlRuleItems') + '\n' + extractFn(src, 'parseRulesetContent') + '\nreturn parseRulesetContent;'
    )();
    const r = parseRulesetContent('name: mix\nwhitelist:\n  -\n    good.example.com\nblacklist:\n  - ads.example.com');
    check('规则-243: whitelist 的 "-\\n    good.example.com" 项被保留', r.lines.includes('@good.example.com') && r.lines.includes('ads.example.com'));
  }

})();

// ---- 规则-322: title/无尾斜杠(含吞@if形态)直接报错不再静默吞条件 ----
{
  const langMatch = src.match(/const LANG_TEXTS = \{[\s\S]*?\n  \};/)[0];
  const consts = src.match(/const SUPPORTED_REGEX_FLAGS = 'imsu';/)[0];
  const fns = ['hostLabelToASCII', 'toASCIIHostname', 'punycodeDecodeLabel', 'toUnicodeHostname', 'safeRegexTest', 'safeDecodeURIComponent', 'stripRuleComment', 'getInvalidRegexFlags', 'parseConditionPart', 'tokenizeCondExpr', 'parseCondExprTokens', 'analyzeCondExpr', 'foldCondExpr', 'evalDynamicLeaf', 'evalCondAST', 'extractBalancedParens', 'findIfOccurrences', 'stripIfConditions', 'evaluateCondition', 'isCondExprCore', 'looksLikeCondExpr', 'absorbStandaloneExpr', 'parseRuleWithConditions', 'extractIfConditions', 'validateUrlWildcard', 'ruleToRegex', 'parsePrefixedRegexRule', 'escapeWildcardPart', 'wildcardToRegex', 'normalizeHostCandidate', 'matchWildcardDomainPattern', 'extractSimpleWhitelistDomain', 'matchSimpleDomain', 'compileRuleRegex', 'validateCondition', 'analyzeRule'].map((n) => extractFn(src, n));
  const api = new Function(
    consts + '\n' + langMatch + '\n' +
    `function t(key, params = {}) {
      const texts = LANG_TEXTS['zh-CN'] || {};
      let text = texts[key] || key;
      for (const [k, v] of Object.entries(params)) text = text.replaceAll('{' + k + '}', v);
      return text;
    }
    const window = { location: { hostname: 'www.google.com' } };
    function getSearchEngine() { return 'google'; }
    function getSearchCategory() { return 'web'; }
    const currentConfig = { rules: [], debug: false };
    const validationCache = new Map();
    const subdomainCache = new Map();
    ` + fns.join('\n') + '\nreturn { analyzeRule, findIfOccurrences, compileRuleRegex, safeRegexTest, toASCIIHostname, matchSimpleDomain };'
  )();
  const match = (rule, url) => { const compiled = api.compileRuleRegex(rule); return api.safeRegexTest(compiled.regex, url); };
  assert('规则-322(已修复): title/前缀正则无尾斜杠(含吞@if形态)直接报错不再静默吞条件(此前@if被吞入pattern致规则永不命中且校验通过)', api.analyzeRule('title/abc @if(title *= "x")').valid === false && api.analyzeRule('title/abc @if(title *= "x")').errors.length > 0 && api.analyzeRule('title/abc/ @if(title *= "x")').valid === true);
  assert('规则-322(对照): 带尾斜杠形态正常提取@if', api.findIfOccurrences('title/abc/ @if(title *= "x")').length === 1);
}

// ---- 编辑器注释行跳转契约 / 白名单与屏蔽写入的去重口径 ----
{
  const panelSrc = src.slice(src.indexOf('function showConfigPanel'), src.indexOf('function saveConfig'));
  const jumpSrc = panelSrc.slice(panelSrc.indexOf('const COMMENT_HEADING_REGEX'), panelSrc.indexOf('const bindScrollBtn'));
  const jumpTo = (text, cursor, dir) => {
    const textarea = { value: text, selectionStart: cursor, setSelectionRange(pos) { this.sel = pos; }, scrollTo() {}, clientHeight: 200, focus() {} };
    new Function('textarea', 'lineNums', 'window', 'document', jumpSrc + '\nreturn jumpToComment;')(
      textarea, { scrollTo() {} }, { getComputedStyle: () => ({ lineHeight: '15.4' }) }, { activeElement: null }
    )(dir);
    const lines = text.split('\n');
    let acc = 0;
    for (let i = 0; i < lines.length; i++) {
      if (acc === textarea.sel) return lines[i];
      acc += lines[i].length + 1;
    }
    return null;
  };
  const posOf = (text, n) => text.split('\n').slice(0, n).reduce((p, line) => p + line.length + 1, 0);
  const grouped = ['*://a.com/*', '# group A', 'rule-a', '# group B', 'rule-b'].join('\n');
  assert('审查候选-注释⬆️(对照): 光标在规则行时移到上一个注释行', jumpTo(grouped, posOf(grouped, 2), 'prev') === '# group A');
  assert('审查候选-注释⬇️(对照): 光标在规则行时移到下一个注释行', jumpTo(grouped, posOf(grouped, 2), 'next') === '# group B');
  assert('审查候选-注释⬆️(对照): 第一个注释行或第一行时⬆️跳到最后一行', jumpTo(grouped, posOf(grouped, 1), 'prev') === 'rule-b' && jumpTo(grouped, 0, 'prev') === 'rule-b');

  const strip = new Function(extractFn(src, 'stripRuleComment') + '\nreturn stripRuleComment;')();
  const whitelistAdd = (rules, chosen) => {
    if (!rules.some((rule) => strip(rule.trim()) === chosen)) rules.push(chosen);
    return rules;
  };
  const blockAdd = (rules, chosen) => {
    const clean = strip(chosen.trim());
    if (!rules.some((rule) => strip(rule.trim()) === clean)) rules.push(chosen);
    return rules;
  };
  assert('审查候选-白名单去重(对照): 屏蔽写入 applyBlockRule 会剥掉尾注释, 同一规则不重复', JSON.stringify(blockAdd(['@*://abc.example.com/*'], '@*://abc.example.com/* # extra')) === JSON.stringify(['@*://abc.example.com/*']));
  assert('审查候选-白名单去重(对照): 已有带尾注释的白名单时, 裸规则不再重复写入', JSON.stringify(whitelistAdd(['@*://abc.example.com/* # keep'], '@*://abc.example.com/*')) === JSON.stringify(['@*://abc.example.com/* # keep']));
}

// ---- 审查8修复回归: 装配容错 / 定时器实参修复 / YAML探测回退 ----
await (async () => {
  // 审查8-1: ensureEngineSiteSetup 先置位后建索引, 建索引抛错时装配中断 → init() 不再执行 registerMenu
  const ees = extractFn(src, 'ensureEngineSiteSetup');
  const initSrc = extractFn(src, 'init');
  const guardIdx = ees.indexOf('_engineSiteSetup = true;'), buildIdx = ees.indexOf('buildRuleIndex()');
  const callIdx = initSrc.indexOf('ensureEngineSiteSetup()'), menuIdx = initSrc.indexOf('registerMenu()');
  assert('审查8-1(修复1回归): registerMenu/exposeDebugApi 先于 ensureEngineSiteSetup 执行且装配调用被 try/catch 包住 → 建索引抛错不再吃掉菜单入口',
    guardIdx !== -1 && buildIdx !== -1 && guardIdx < buildIdx && callIdx !== -1 && menuIdx !== -1 && menuIdx < callIdx && /try\s*\{[^}]*ensureEngineSiteSetup\(\)/.test(initSrc));

  // 审查8-2: 非字符串订阅规则使 buildRuleIndex 中断, 但 indexSignature 已先落位, 索引残缺且签名不回滚
  const fns8 = ['hostLabelToASCII', 'toASCIIHostname', 'toASCIIUrl', 'safeRegexTest', 'safeDecodeURIComponent', 'stripRuleComment', 'getInvalidRegexFlags',
    'parseConditionPart', 'tokenizeCondExpr', 'parseCondExprTokens', 'analyzeCondExpr', 'foldCondExpr', 'evalDynamicLeaf', 'evalCondAST',
    'extractBalancedParens', 'findIfOccurrences', 'stripIfConditions', 'evaluateCondition', 'isCondExprCore', 'looksLikeCondExpr', 'absorbStandaloneExpr',
    'parseRuleWithConditions', 'validateUrlWildcard', 'ruleToRegex', 'parsePrefixedRegexRule', 'escapeWildcardPart', 'wildcardToRegex', 'normalizeHostCandidate',
    'matchWildcardDomainPattern', 'extractSimpleWhitelistDomain', 'matchSimpleDomain', 'compileRuleRegex', 'checkDynamicConditions', 'matchDomainEntryType',
    'buildRuleIndex', 'newCompiledRules', 'extractIfConditions', 'validateCondition', 'analyzeRule', 'validateRule'].map((n) => extractFn(src, n));
  const consts8 = src.match(/const SUPPORTED_REGEX_FLAGS = 'imsu';/)[0];
  const lang8 = src.match(/const LANG_TEXTS = \{[\s\S]*?\n  \};/)[0];
  const makeEnv8 = (subs) => new Function(consts8 + '\n' + lang8 + `
let compiledRules = newCompiledRules();
const validationCache = new Map();
const subdomainCache = new Map();
const window = { location: { hostname: 'www.google.com' } };
function getSearchEngine() { return 'google'; }
function getSearchCategory() { return 'web'; }
function t(key) { return key; }
const currentConfig = { rules: ['*://local.example.com/*'], debug: false, language: 'zh-CN' };
const SUBS = ${JSON.stringify(subs)};
function getSubscriptions() { return SUBS; }
function getAllSubscriptionRules() { const r = []; SUBS.filter(s => s.enabled).forEach(s => { if (s.rules && Array.isArray(s.rules)) r.push(...s.rules); }); return r; }
${fns8.join('\n')}
return { buildRuleIndex, getCR: () => compiledRules };`)();
  const bad = makeEnv8([{ enabled: true, url: 'https://x/y.yaml', rules: [123, 'ok.com'] }]);
  let threw8 = null;
  try { bad.buildRuleIndex(); } catch (e) { threw8 = e; }
  const cr8 = bad.getCR();
  assert('审查8-2(修复1回归): 非字符串规则项被类型守卫跳过(不再抛错), 后续订阅规则正常入库, 索引完整',
    threw8 === null && cr8.domains.has('local.example.com') === true && cr8.domains.has('ok.com') === true && typeof cr8.indexSignature === 'string');

  // 审查8-3: checkAutoSubscription 第1参 force 被 setInterval 的定时器ID顶成真值 → 绕过订阅自动更新开关
  const casSrc = extractFn(src, 'checkAutoSubscription');
  const startSrc = extractFn(src, 'startBackgroundSync');
  assert('审查8-3(修复7回归): setInterval 不再把定时器ID当 force 传入, 改由箭头函数无实参调用 → 开关关闭时不拉取',
    /setInterval\(\s*\(\s*\)\s*=>\s*checkAutoSubscription\(\)\s*,/.test(startSrc) && casSrc.includes('if (!force && !currentConfig.subscriptionAutoUpdate) return;'));


  // 审查8-5: 纯文本订阅首行是 name:/title:/url: 时不再被 YAML 探测误判清空 (修复3)
  const plainApi = new Function('function t(k) { return k; }\nconst currentConfig = { debug: false };\n' +
    extractFn(src, 'extractYamlRuleItems') + '\n' + extractFn(src, 'parseRulesetContent') + '\nreturn parseRulesetContent;')();
  const plainName = plainApi('name: My personal list\n*://*.ads.com/*\nexample.com\n');
  const plainTitle = plainApi('title: My list\n*://*.ads.com/*\n');
  const plainUrl = plainApi('url: https://example.com\n*://*.ads.com/*\n');
  assert('审查8-5(修复3回归): YAML探测命中但未解析出任何列表段时回退纯文本, name:/title:/url: 开头的纯文本清单规则不再被整份清空',
    plainName.lines.filter((l) => l.trim()).length === 3 && plainTitle.lines.filter((l) => l.trim()).length === 2 && plainUrl.lines.filter((l) => l.trim()).length === 2);
})();

// ==== 审查9: 修复回归(三方合并顺序与幸存键 / yaml转义 / 单=正则flags / 元素规则) ====
await (async () => {
const mergeApi = new Function(SERH_FN_DEPS + '\n' + SERH_RAW_EXTRACT(src, 'stripRuleComment') + '\n' + SERH_RAW_EXTRACT(src, 'getRuleKey') + '\n' + SERH_RAW_EXTRACT(src, 'mergeRules3Way') + '\nreturn mergeRules3Way;')();
const B_OLD = '*://b.com/* # old', B_NEW = '*://b.com/* # new';
assert('审查9-1(修复回归): 一方移动+删规则, 他方仅改其行尾注释 → 修改保留且追加尾部不乱序',
  JSON.stringify(mergeApi(['A', B_OLD, 'C'], ['C', 'A'], ['A', B_NEW, 'C'])) === JSON.stringify(['C', 'A', B_NEW]));
assert('审查9-2(修复回归): 单方移动 → 合并保持移动方顺序',
  JSON.stringify(mergeApi(['A', 'B', 'C', 'D'], ['C', 'A', 'B', 'D'], ['A', 'B', 'C', 'D'])) === JSON.stringify(['C', 'A', 'B', 'D']));
assert('审查9-3(修复回归): 单方插入 → 新规则锚定原位',
  JSON.stringify(mergeApi(['A', 'B', 'C'], ['A', 'X', 'B', 'C'], ['A', 'B', 'C'])) === JSON.stringify(['A', 'X', 'B', 'C']));
assert('审查9-4(修复回归): 无移动 → 他方修改在原位保留',
  JSON.stringify(mergeApi(['A', B_OLD, 'C'], ['A', 'C'], ['A', B_NEW, 'C'])) === JSON.stringify(['A', B_NEW, 'C']));

const yamlApi = new Function('function t(k) { return k; }\nconst currentConfig = { debug: false };\n' +
  extractFn(src, 'extractYamlRuleItems') + '\n' + extractFn(src, 'parseRulesetContent') + '\nreturn parseRulesetContent;')();
assert('审查9-5(修复回归): flow 双引号含反斜杠规则保留',
  JSON.stringify(yamlApi('name: t\nrules: ["title/\\.com/i"]\n').lines) === JSON.stringify(['title/\\.com/i']));
assert('审查9-6(修复回归): 块式双引号含反斜杠规则保留',
  JSON.stringify(yamlApi('name: t\nrules:\n  - "title/\\.com/i"\n').lines) === JSON.stringify(['title/\\.com/i']));
assert('审查9-7(修复回归): yaml 合法转义(\\" → ")行为不变',
  JSON.stringify(yamlApi('name: t\nrules: ["title/a\\"b.com/i"]\n').lines) === JSON.stringify(['title/a"b.com/i']));

const fns9 = [
  'hostLabelToASCII', 'toASCIIHostname', 'toASCIIUrl', 'safeRegexTest', 'safeDecodeURIComponent', 'stripRuleComment', 'getInvalidRegexFlags', 'parseConditionPart',
  'tokenizeCondExpr', 'parseCondExprTokens', 'analyzeCondExpr', 'foldCondExpr',
  'evalDynamicLeaf', 'evalCondAST', 'extractBalancedParens', 'findIfOccurrences',
  'stripIfConditions', 'isCondExprCore', 'looksLikeCondExpr', 'isScriptRuleLine', 'isElementRuleLine',
  'absorbStandaloneExpr', 'parseRuleWithConditions', 'extractIfConditions', 'validateCondition',
  'analyzeRule', 'validateRule', 'parsePrefixedRegexRule', 'escapeWildcardPart', 'wildcardToRegex',
  'ruleToRegex', 'validateUrlWildcard',
].map((n) => extractFn(src, n));
const api9 = new Function(`${src.match(/const SUPPORTED_REGEX_FLAGS = 'imsu';/)[0]}
${src.match(/const LANG_TEXTS = \{[\s\S]*?\n  \};/)[0]}
const window = { location: { hostname: 'www.google.com', pathname: '/search', search: '?q=x', href: 'https://www.google.com/search?q=x' } };
function getSearchEngine() { return 'google'; }
function getSearchCategory() { return 'web'; }
const currentConfig = { debug: false };
function t(key, params = {}) { const texts = LANG_TEXTS['zh-CN'] || {}; let text = texts[key] || key; for (const [k, v] of Object.entries(params)) text = text.replaceAll('{' + k + '}', v); return text; }
${fns9.join('\n')}
return { analyzeRule };`)();
assert('审查9-8(修复回归): @if 单= 正则带 g flags 报错(不再静默降级字符串比较)',
  api9.analyzeRule('*://example.com/* @if(url = /x/g)').errors.some((e) => /flags 无效/.test(e)));
assert('审查9-9(修复回归): @if 单= 合法 flags 正则仍生效',
  api9.analyzeRule('*://example.com/* @if(url = /x/i)').valid === true);
assert('审查9-10(修复回归): 多斜杠裸值字符串语义保留(条件-396, 不误伤为flags错误)',
  api9.analyzeRule('*://example.com/* @if(path = /a/b)').valid === true);
assert('审查9-11(修复回归): @if 字符串条件不受影响',
  api9.analyzeRule('*://example.com/* @if(title *= "关键词")').valid === true);
assert('审查9-12(修复回归): @if =~ 合法形式行为不变',
  api9.analyzeRule('*://example.com/* @if(url =~ /x/i)').valid === true);
assert('审查9-13(修复回归): @if =~ 带 g flags 仍报错',
  api9.analyzeRule('*://example.com/* @if(url =~ /x/g)').valid === false);
assert('审查9-14(修复回归): 手动元素规则报错',
  api9.analyzeRule('example.com##div.x').errors[0] === '不支持元素规则');
assert('审查9-15(修复回归): 含##的脚本URL规则不受影响',
  api9.analyzeRule('*://example.com/page##x').valid === true);
assert('审查9-16(修复回归): 正则含##不受影响',
  api9.analyzeRule('title/.*##.*/i').valid === true);
})();

// ---- 规则-366~381: 规则/自定义引擎输入区成对括号显示 ----
await (async () => {
const bracketNames = ['isJsRegexAllowed', 'buildBracketMatchMap', 'findBracketPairAt', 'findEnclosingBracketAt', 'buildLineStartOffsets', 'lineIndexAt'];
const bracketApi = new Function(bracketNames.map((n) => extractFn(src, n)).join('\n') + `
return { buildBracketMatchMap, findBracketPairAt, findEnclosingBracketAt, buildLineStartOffsets, lineIndexAt };`)();

const ruleLine = '*://a.com/* @if(title *= "示例(x)" && path =~ /a(b)cd/) # 尾注释 (';
const ruleMap = bracketApi.buildBracketMatchMap(ruleLine, 'rules');
const ifOpen = ruleLine.indexOf('(');
const ifClose = ruleLine.lastIndexOf(')');
const regexParen = ruleLine.indexOf('(', ruleLine.indexOf('path'));
const stringParen = ruleLine.indexOf('(', ruleLine.indexOf('示例'));

assert('规则-366: @if 括号成对命中', ruleMap[ifOpen] === ifClose && ruleMap[ifClose] === ifOpen, [ruleMap[ifOpen], ifClose]);
const regexParenClose = ruleLine.indexOf(')', regexParen);
assert('规则-367: =~ 正则内的括号参与配对', ruleMap[regexParen] === regexParenClose, [regexParen, ruleMap[regexParen], regexParenClose]);
assert('规则-368: 条件字符串内的括号不参与配对', ruleMap[stringParen] === -1, [stringParen, ruleMap[stringParen]]);
assert('规则-369: 尾注释内的括号不参与配对', ruleMap[ruleLine.lastIndexOf('(')] === -1, ruleMap[ruleLine.lastIndexOf('(')]);
const pairLeft = bracketApi.findBracketPairAt(ruleMap, ifOpen + 1);
const pairRight = bracketApi.findBracketPairAt(ruleMap, ifClose);
assert('规则-370: 光标紧贴左/右括号均给出同一配对区间', !!pairLeft && !!pairRight && pairLeft.a === ifOpen && pairLeft.b === ifClose && pairRight.a === ifOpen && pairRight.b === ifClose, { pairLeft, pairRight });
assert('规则-371: 未配对括号旁无相邻配对结果', bracketApi.findBracketPairAt(ruleMap, ruleLine.length) === null, bracketApi.findBracketPairAt(ruleMap, ruleLine.length));
const enclosing = bracketApi.findEnclosingBracketAt(ruleMap, ruleLine.indexOf('title'), null);
assert('规则-372: 给出光标所在的最内层包围括号', !!enclosing && enclosing.a === ifOpen && enclosing.b === ifClose, enclosing);
assert('规则-373: 已命中的相邻配对不再计入包围括号', bracketApi.findEnclosingBracketAt(ruleMap, ifOpen + 1, pairLeft) === null, bracketApi.findEnclosingBracketAt(ruleMap, ifOpen + 1, pairLeft));
assert('规则-374: 注释之后不存在包围括号', bracketApi.findEnclosingBracketAt(ruleMap, ruleLine.length, null) === null, bracketApi.findEnclosingBracketAt(ruleMap, ruleLine.length, null));

const twoLines = '@if(title *= "a"\n*://b.com/*)';
const twoMap = bracketApi.buildBracketMatchMap(twoLines, 'rules');
assert('规则-375: 规则按行独立, 括号不跨行配对', twoMap[twoLines.indexOf('(')] === -1 && twoMap[twoLines.indexOf(')')] === -1, [twoMap[twoLines.indexOf('(')], twoMap[twoLines.indexOf(')')]]);

const leading = '/a(b)c/i';
const prefixed = 'title/.*(.*)/i';
const look = 'title/^(?=.*A)(?=.*(?:B)).*/i';
const textPre = 'text/(示例A|示例B)与内容/i';
const mLeading = bracketApi.buildBracketMatchMap(leading, 'rules');
const mPrefixed = bracketApi.buildBracketMatchMap(prefixed, 'rules');
const mLook = bracketApi.buildBracketMatchMap(look, 'rules');
const mTextPre = bracketApi.buildBracketMatchMap(textPre, 'rules');
const l1 = look.indexOf('(');
const l2 = look.indexOf('(', l1 + 1);
const l3 = look.indexOf('(', l2 + 1);
assert('规则-376: 行首正则内的括号参与配对', mLeading[leading.indexOf('(')] === leading.indexOf(')'), Array.from(mLeading));
assert('规则-377: 前缀正则内的括号参与配对', mPrefixed[prefixed.indexOf('(')] === prefixed.indexOf(')'), Array.from(mPrefixed));
assert('规则-377b: title 前缀正则嵌套分组括号逐层配对', mLook[l1] === look.indexOf(')') && mLook[l2] === look.lastIndexOf(')') && mLook[l3] === look.indexOf(')', l3 + 1), [mLook[l1], mLook[l2], mLook[l3]]);
assert('规则-377c: text 前缀正则内的括号参与配对', mTextPre[textPre.indexOf('(')] === textPre.indexOf(')'), Array.from(mTextPre));
const stray = '*://a.com/* @if(title =~ /a)b/)';
const mStray = bracketApi.buildBracketMatchMap(stray, 'rules');
assert('规则-377d: 正则内多余右括号不影响 @if 括号配对', mStray[stray.indexOf('(')] === stray.lastIndexOf(')'), Array.from(mStray));

const hashUrl = 'example.com/path#frag (a)';
const mHash = bracketApi.buildBracketMatchMap(hashUrl, 'rules');
assert('规则-378: URL 中的 # 不当作注释分隔', mHash[hashUrl.indexOf('(')] === hashUrl.indexOf(')'), [mHash[hashUrl.indexOf('(')], hashUrl.indexOf(')')]);

const lineStarts = bracketApi.buildLineStartOffsets('a\nbb\nccc');
assert('规则-379: 行起点偏移表', lineStarts.join() === '0,2,5', lineStarts);
assert('规则-380: 按偏移表定位行号', bracketApi.lineIndexAt(lineStarts, 0) === 0 && bracketApi.lineIndexAt(lineStarts, 4) === 1 && bracketApi.lineIndexAt(lineStarts, 6) === 2, lineStarts);

assert('规则-381: 规则面板挂载成对括号高亮', /setupBracketHighlight\(textarea, 'rules'\)/.test(src));
})();

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

})();

