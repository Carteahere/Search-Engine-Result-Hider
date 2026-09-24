// 规则: 通配符转义与正则标志 / 规则过滤 / 规则来源标记 / 优先级 / 导入取消
// 由功能相近的测试文件合并而成: test-regex.cjs, test-rule-filter.cjs, test-rule-source.cjs, test-priority.cjs, test-import-cancel.cjs
// 命名规则: 规则-三位序号: 描述; 循环组为 规则-序号-用例号; (已知问题)/(对照) 为语义标记
(async () => {
const fs = require('fs');
const path = require('path');

const scriptDir = path.join(__dirname, '..');
const scriptFiles = fs.readdirSync(scriptDir).filter((name) => name.endsWith('.js')).sort();
if (!scriptFiles.length) throw new Error('no .js script found in ' + scriptDir);
const file = path.join(scriptDir, scriptFiles[0]);
console.log('Testing', file);
const src = fs.readFileSync(file, 'utf8');

function extractFn(text, fnName) {
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
}


let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? '  => ' + JSON.stringify(extra) : '')); }
}
function assert(name, cond, extra) { check(name, cond, extra); }

// ==== [规则-001~093] 通配符与正则标志 (来源: test-regex.cjs) ====
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
assert('规则-001: a+b 匹配字面量 a+b', match('*://example.com/a+b/*', 'https://example.com/a+b/'));
assert('规则-002: a+b 不匹配 ab', !match('*://example.com/a+b/*', 'https://example.com/ab/'));
assert('规则-003: (x) 匹配字面量 (x)', match('*://example.com/(x)/*', 'https://example.com/(x)/'));
assert('规则-004: [x] 匹配字面量 [x]', match('*://example.com/[x]/*', 'https://example.com/[x]/'));
assert('规则-005: {2} 匹配字面量 {2}', match('*://example.com/a{2}/*', 'https://example.com/a{2}/'));
assert('规则-006: a|b 匹配字面量 a|b', match('*://example.com/a|b/*', 'https://example.com/a|b/'));
assert('规则-007: a^b 匹配字面量 a^b', match('*://example.com/a^b/*', 'https://example.com/a^b/'));
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
assert('规则-020: 中文域名简写匹配 punycode', match('例子.com', 'https://xn--fsqu00a.com/'));
assert('规则-021: 中文域名路径规则匹配 punycode', match('*://*.例子.com/path/*', 'https://xn--fsqu00a.com/path/x'));

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
assert('规则-033: *.无路径模式匹配裸域', match('*://*.example.com/*', 'https://example.com/'));
assert('规则-034: *.顶级域通配匹配裸域', match('*://*.example.*', 'https://example.com/'));
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
assert('规则-045: 带路径URL通配匹配带端口URL', match('*://*.example.com/path/*', 'https://sub.example.com:8080/path/test'));
assert('规则-046: 路径URL通配规则匹配同端口URL', match('*://example.com/abc/*', 'https://example.com:8080/abc/xyz'));
assert('规则-047: 显式指定端口的路径规则匹配同端口', match('*://example.com:8080/path/*', 'https://example.com:8080/path/test'));
assert('规则-048: 显式指定端口的路径规则不匹配不同端口', !match('*://example.com:8080/path/*', 'https://example.com:9000/path/test'));
assert('规则-049: 显式指定端口的路径规则不匹配无端口', !match('*://example.com:8080/path/*', 'https://example.com/path/test'));
assert('规则-050: 无scheme 路径规则按主机匹配首段', match('*.example.com/path/*', 'https://sub.example.com/path/x'));
assert('规则-051: 无scheme 路径规则不匹配其他站路径', !match('*.example.com/path/*', 'https://evil.com/x/example.com/path/y'));
assert('规则-052: 精确路径模式不误匹配同名前缀路径', !match('*://example.com/test', 'https://example.com/testing-other'));
assert('规则-053: 精确路径模式匹配自身及子路径', match('*://example.com/test', 'https://example.com/test') && match('*://example.com/test', 'https://example.com/test/sub'));

// ---- 正则 s 标志 ----
assert('规则-054: title 转义点 + s 正常匹配', match('title/example\\.com/s', 'example.com'));
assert('规则-055: text 转义点 + s 正常匹配', match('text/example\\.com/s', 'example.com'));
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
assert('规则-062: 尾部重复flag字符不再识别为flags', (() => {
  const parsed = api.parsePrefixedRegexRule('title/path/ii', 6);
  return parsed.flags === '' && parsed.pattern === 'path/ii';
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
assert('规则-070: 大写I可编译且忽略大小写', match('title/FOO/I', 'foo'));
assert('规则-071: /pattern/I 编译不抛错', (() => {
  const compiled = api.compileRuleRegex('/FOO/I');
  return compiled.regex.flags.includes('i') && compiled.regex.test('foo');
})());
assert('规则-072: 尾部非flag字母组合保持为pattern', (() => {
  const parsed = api.parsePrefixedRegexRule('title/abc/def', 6);
  return parsed.flags === '' && parsed.pattern === 'abc/def';
})());
assert('规则-073: 多段路径尾部字母保持为pattern', (() => {
  const parsed = api.parsePrefixedRegexRule('text/example.com/path/sub', 5);
  return parsed.flags === '' && parsed.pattern === 'example.com/path/sub';
})());
assert('规则-074: 订阅式非法flags(y)编译时被过滤', (() => {
  const compiled = api.compileRuleRegex('/foo/y');
  return compiled.regex.flags === '' && api.safeRegexTest(compiled.regex, 'bar foo');
})());
assert('规则-075: 编译过滤保留合法flags去除非法', (() => {
  const flags = api.compileRuleRegex('/foo/gyi').regex.flags;
  return flags.includes('i') && !flags.includes('g') && !flags.includes('y');
})());
assert('规则-076: 未闭合正则 /foo 编译报错(与校验口径一致)', (() => {
  try { api.compileRuleRegex('/foo'); return false; } catch (e) { return true; }
})());

// 主机非前缀星号不跨点（*.example.* 只匹配到二级+顶级域）
assert('规则-077: *.example.* 匹配主域', match('*://*.example.*/*', 'https://example.com/'));
assert('规则-078: *.example.* 匹配子域', match('*://*.example.*/*', 'https://a.example.com/'));
assert('规则-079: *.example.* 带路径不匹配多段后缀', !match('*://*.example.*/*', 'https://example.com.evil.net/'));
assert('规则-080: *.example.* 无路径不匹配多段后缀', !match('*://*.example.*', 'https://example.com.evil.net/'));
assert('规则-081: example.* 不匹配多段后缀', !match('*://example.*/*', 'https://example.com.evil.net/'));
assert('规则-082: 中部主机星号不跨点', !match('*://mail.*.com/*', 'https://mail.a.b.com/') && match('*://mail.*.com/*', 'https://mail.a.com/'));
assert('规则-083: 整体主机星号仍匹配任意主机', match('*://*/x/*', 'https://any.host.com/x/1'));
assert('规则-084: *example* 宽松语义保留', match('*example*', 'https://any.example.org/x'));
assert('规则-085: 端口通配不跨越路径', !match('*://example.com:*/y', 'https://example.com:80/x/y'));
assert('规则-086: 端口通配匹配端口段内容', match('*://example.com:*/y', 'https://example.com:8080/y'));
assert('规则-087: 端口通配不匹配端口外其他路径', !match('*://example.com:*/y', 'https://example.com:80/other/y'));
assert('规则-088: 端口通配不跨越冒号至主机', !match('*://example.com:*/y', 'https://example.com/x/y'));
assert('规则-089: *.example.* 匹配二段后缀(co.uk)', match('*://*.example.*/*', 'https://www.example.co.uk/page'));
assert('规则-090: *.example.* 匹配裸域二段后缀', match('*://*.example.*/*', 'https://example.co.uk/'));
assert('规则-091: example.* 尾部星号匹配二段后缀', match('*://example.*/*', 'https://example.com.au/x'));
assert('规则-092: *.example.* 不匹配三段后缀', !match('*://*.example.*/*', 'https://example.a.b.c/'));
assert('规则-093: 尾部星号二段语义不影响中部星号(回归)', !match('*://mail.*.com/*', 'https://mail.a.b.com/') && match('*://mail.*.com/*', 'https://mail.a.com/'));
})();

// ==== [规则-094~105] 订阅规则过滤 (来源: test-rule-filter.cjs) ====
await (async () => {
const fns = [
  'hostLabelToASCII', 'toASCIIHostname', 'safeRegexTest', 'stripRuleComment', 'parseRulesetContent', 'extractYamlRuleItems', 'getInvalidRegexFlags', 'parseConditionPart',
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
const elementRules = [
  'example.com##.ad',
  '##.ad',
  '~example.com##.ad',
  'example.com,foo.com##.ad',
  'example.com##div[title="x"]',
  'example.com#@#.ad',
  'example.com#$#alert(1)',
  'example.com#@$#alert(1)',
  'example.com#?#div:has(> span)',
  'example.com#%#window.x=1',
];
elementRules.forEach((rule, i) => {
  assert(`规则-094-${i + 1}: 元素规则跳过 ${rule}`, api.isElementRuleLine(rule) === true);
});

const scriptRules = [
  '/foo##bar/',
  'title/.*##.*/',
  '*://example.com/##x',
  '@*://example.com/*',
  '@title/.*##.*/',
  '*://*.example.com/*',
];
scriptRules.forEach((rule, i) => {
  assert(`规则-095-${i + 1}: 脚本规则保留 ${rule}`, api.isElementRuleLine(rule) === false);
});

// ---- 订阅规则过滤(保留) ----
const keep = [
  '!scheme="https"',
  '! title *= "ad"',
  '!host $= ".example.com"',
  '!(title *= "x" | url *= "y")',
  '*://*.example.com/*',
  '@*://example.com/*',
  '@1*://example.com/*',
  '*://x.com/* @if(title *= "@if(y)")',
  '*://x.com/* # comment',
  '*://example.com/a|b/*',
  'path $= "x|y"',
  '*://*.google.com/url/* @if(title *= "x")',
];
keep.forEach((line, i) => {
  assert(`规则-096-${i + 1}: 订阅保留 ${line}`, api.collectSubscriptionRules([line]).length === 1);
});

// ---- 订阅规则过滤(丢弃) ----
const drop = [
  '! comment',
  '! Title: Some List',
  '[Adblock Plus 2.0]',
  '@@||example.com^',
  'example.com##.ad',
  '# comment',
  '*://bad domain/*',
];
drop.forEach((line, i) => {
  assert(`规则-097-${i + 1}: 订阅跳过 ${line}`, api.collectSubscriptionRules([line]).length === 0);
});

// ---- uBO 网络过滤规则拒绝(回归) ----
const networkDrop = [
  '||example.com^',
  '|https://example.com/ad',
];
networkDrop.forEach((line, i) => {
  assert(`规则-098-${i + 1}: 跳过uBO网络规则 ${line}`, api.collectSubscriptionRules([line]).length === 0);
  assert(`规则-099-${i + 1}: 校验拒绝 ${line}`, api.validateUrlWildcard(line) === false && api.validateRule(line) === false);
});

const networkKeep = [
  '*://example.com/a|b/*',
  '*://example.com/?x=a|b',
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

// ==== [规则-106~127] 规则来源标记 (来源: test-rule-source.cjs) ====
await (async () => {
const fns = [
  'hostLabelToASCII', 'toASCIIHostname', 'safeRegexTest', 'safeDecodeURIComponent', 'stripRuleComment', 'getInvalidRegexFlags', 'parseConditionPart',
  'tokenizeCondExpr', 'parseCondExprTokens', 'analyzeCondExpr', 'foldCondExpr',
  'evalDynamicLeaf', 'evalCondAST', 'extractBalancedParens', 'findIfOccurrences', 'stripIfConditions',
  'evaluateCondition', 'isCondExprCore', 'looksLikeCondExpr', 'absorbStandaloneExpr',
  'parseRuleWithConditions', 'validateUrlWildcard', 'ruleToRegex', 'parsePrefixedRegexRule',
  'escapeWildcardPart', 'wildcardToRegex', 'matchWildcardDomainPattern', 'extractSimpleWhitelistDomain', 'matchSimpleDomain',
  'compileRuleRegex', 'checkDynamicConditions', 'matchDomainEntryType', 'buildRuleIndex',
  'extractIfConditions', 'validateCondition', 'analyzeRule', 'validateRule',
  'checkRuleMatchOptimized',
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
    ['', '@', '@2 '].forEach((prefix, pi) => {
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

// @N+白名单组合：编译期必须跳过（否则成为惰性规则）
api.setState(['@1 @*://*.bad.com/*', '@2 @host $= ".bad2.com"', '@3 *://*.good.com/*'], []);
api.buildRuleIndex();
cr = api.getCR();
assert('规则-115: 高亮+白名单组合不编译', cr.highlightUrls.length === 0 && cr.highlightConditionalRules.length === 0);
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
assert('规则-120: @7example.com 按白名单域名解析', cr.whitelistDomains.has('7example.com'));
assert('规则-121: @N 高亮 N 越界仍跳过', (() => {
  api.setState(['@9 fast9.com'], []);
  api.buildRuleIndex();
  const c = api.getCR();
  return !c.highlightDomains.has('fast9.com');
})());

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

// ==== [规则-128~154] 优先级 (来源: test-priority.cjs) ====
await (async () => {
const fns = ['safeRegexTest', 'matchDomainEntryType', 'checkDynamicConditions', 'toASCIIHostname', 'hostLabelToASCII']
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

cr = makeCR();
addBlDomain(cr, 'example.com', 'wildcard', 'example.com', '本地规则');
assert('规则-129: 仅本地黑名单 → 屏蔽', isBlocked(doCheck(cr, url, host, 'title', null, sl)));

cr = makeCR();
addWlDomain(cr, 'example.com', 'wildcard');
assert('规则-130: 仅白名单 → 不屏蔽', !isBlocked(doCheck(cr, url, host, 'title', null, sl)));

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
addBlDomain(cr, 'other.com', 'wildcard', 'other.com', '本地规则');
assert('规则-136: 不匹配的本地黑名单不影响其他引擎', !isBlocked(doCheck(cr, url, host, 'title', null, sl)));

cr = makeCR();
addBlDomain(cr, 'example.com', 'wildcard', 'example.com', '本地规则');
addWlDomain(cr, 'other.com', 'wildcard');
assert('规则-137: 不匹配的白名单不影响本地黑名单', isBlocked(doCheck(cr, url, host, 'title', null, sl)));

// ==================== 订阅黑名单（阶段5）====================
cr = makeCR();
addBlDomain(cr, 'example.com', 'wildcard', 'example.com', '订阅规则1');
r = doCheck(cr, url, host, 'title', null, sl);
assert('规则-138: 订阅黑名单 → 屏蔽', isBlocked(r) && getSrc(r) === '订阅规则1');

cr = makeCR();
addBlUrl(cr, 'example\\.com', 'example.com', '订阅规则1');
r = doCheck(cr, url, host, 'title', null, sl);
assert('规则-139: 订阅URL黑名单 → 屏蔽', isBlocked(r) && getSrc(r) === '订阅规则1');

// ==================== 订阅黑名单 + 本地白名单 优先级 ====================
cr = makeCR();
addWlDomain(cr, 'example.com', 'wildcard');
addBlDomain(cr, 'example.com', 'wildcard', 'example.com', '订阅规则1');
assert('规则-140: 本地白名单 > 订阅黑名单', !isBlocked(doCheck(cr, url, host, 'title', null, sl)));

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
addBlTitle(cr, 'blocked', '标题规则', '订阅规则1');
r = doCheck(cr, url, host, 'blocked title', null, sl);
assert('规则-143: 订阅标题黑名单 → 屏蔽', isBlocked(r) && getSrc(r) === '订阅规则1');

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

// ==== [规则-155~167] 导入取消 (来源: test-import-cancel.cjs) ====
await (async () => {
const parseSyncHeaderFn = extractFn(src, 'parseSyncHeader');
const importRulesFromFileFn = extractFn(src, 'importRulesFromFile');
const pickTextFileFn = extractFn(src, 'pickTextFile');


function createEnv() {
  const env = {
    bodyChildren: [],
    windowListeners: {},
    textarea: { value: '' },
    hooks: { updateLineNumbersCalls: 0 },
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
    ${pickTextFileFn}
    function updateLineNumbers() { hooks.updateLineNumbersCalls++; }
    ${importRulesFromFileFn}
    return {
      importRulesFromFile,
      isPreventPanelClose: () => preventPanelClose,
    };
  `);

  const api = factory(documentStub, windowStub, FakeFileReader, { debug: false }, env.hooks);
  return { env, api, fakeInput };
}

await (async () => {
  // 1. 浏览器触发 cancel 事件
  {
    const { env, api, fakeInput } = createEnv();
    api.importRulesFromFile();
    assert('规则-155: 打开选择器后锁定面板关闭', api.isPreventPanelClose() === true);
    assert('规则-156: input 已加入 DOM', env.bodyChildren.includes(fakeInput));
    fakeInput.listeners.cancel[0]();
    assert('规则-157: cancel 事件后解锁', api.isPreventPanelClose() === false);
    assert('规则-158: cancel 事件后移除 input', !env.bodyChildren.includes(fakeInput));
  }

  // 2. 老浏览器无 cancel 事件，靠窗口焦点回落兜底
  {
    const { env, api, fakeInput } = createEnv();
    api.importRulesFromFile();
    env.windowListeners.focus[0]();
    await new Promise((resolve) => setTimeout(resolve, 350));
    assert('规则-159: 焦点回落后解锁', api.isPreventPanelClose() === false);
    assert('规则-160: 焦点回落后移除 input', !env.bodyChildren.includes(fakeInput));
  }

  // 3. 正常选择文件
  {
    const { env, api, fakeInput } = createEnv();
    api.importRulesFromFile();
    fakeInput.files = [{ _content: 'rule1\nrule2' }];
    fakeInput.onchange({ target: fakeInput });
    assert('规则-161: 文件内容写入编辑区', env.textarea.value === 'rule1\nrule2');
    assert('规则-162: 读取完成后解锁', api.isPreventPanelClose() === false);
    assert('规则-163: 读取完成后移除 input', !env.bodyChildren.includes(fakeInput));
    assert('规则-164: 更新行号被调用', env.hooks.updateLineNumbersCalls === 1);
  }

  // 4. onchange 但未选中文件
  {
    const { env, api, fakeInput } = createEnv();
    api.importRulesFromFile();
    fakeInput.onchange({ target: { files: [] } });
    assert('规则-165: 未选择文件时解锁', api.isPreventPanelClose() === false);
    assert('规则-166: 未选择文件时移除 input', !env.bodyChildren.includes(fakeInput));
  }

  // 5. 同步配置头被剥离
  {
    const { env, api, fakeInput } = createEnv();
    api.importRulesFromFile();
    fakeInput.files = [{ _content: '# ScriptConfig: {"a":1}\nrule1\nrule2' }];
    fakeInput.onchange({ target: fakeInput });
    assert('规则-167: 同步配置头被剥离', env.textarea.value === 'rule1\nrule2');
  }

})();

// ==== [规则-168~175] 同步头解析: 仅剥离两种同步头行, 其余 # 注释保留 ====
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

  r = run('# 注释\nrule1\n# ScriptConfig: {"a":1}');
  assert('规则-172: 规则行后的头行不吞(按规则保留)', r.restLines.join('\n') === '# 注释\nrule1\n# ScriptConfig: {"a":1}');

  r = run('# ScriptConfig: {"a":1}\n# ScriptConfig: {"b":2}\nrule1');
  assert('规则-173: 重复头取后者且均被剥离', r.config.b === 2 && r.restLines.join('\n') === 'rule1');

  r = run('\uFEFF# title: my rules\n# author: me\n*://bad.example.com/*');
  assert('规则-174: 无头纯注释文件原样保留(BOM)', r.restLines.join('\n') === '# title: my rules\n# author: me\n*://bad.example.com/*' && !r.config);

  r = run('# ScriptConfig: {"a":1}\nrule1\n# 尾注释');
  assert('规则-175: 头后内容完整保留', r.restLines.join('\n') === 'rule1\n# 尾注释');
})();

// ==== [规则-176~192] 一键屏蔽规则选项构建(域名/精确/白名单) ====
await (async () => {
  const consts = src.match(/const COMMON_HOST_PREFIXES = new Set\(\[[^\]]*\]\);/)[0] + '\n' +
    src.match(/const PUBLIC_SUFFIX_2LD = new Set\([\s\S]*?\}\)\);/)[0];
  const build = new Function(
    consts + '\n' + extractFn(src, 'isPublicSuffixBase') + '\n' + extractFn(src, 'buildBlockRuleOptions') + '\nreturn buildBlockRuleOptions;'
  )();

  let o = build('abc.example.com');
  assert('规则-176: 非www子域不回退主域', o.isIP === false && o.domainRule === '*://*.abc.example.com/*');
  assert('规则-177: 精确选项为完整主机', o.exactRule === '*://abc.example.com/*');
  assert('规则-178: 白名单选项为精确加@', o.whitelistRule === '@*://abc.example.com/*');

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
  o = build('example.co.uk');
  assert('规则-186: 裸域域名选项不误剥', o.domainRule === '*://*.example.co.uk/*');
  o = build('www.news.bbc.co.uk');
  assert('规则-187: 仅剥离最外层www', o.domainRule === '*://*.news.bbc.co.uk/*');

  o = build('www.com');
  assert('规则-188: www单标签回退完整主机且不再标记TLD级', o.tldWide === false && o.domainRule === '*://*.www.com/*');
  o = build('www.io');
  assert('规则-189: www单标签gTLD回退完整主机', o.tldWide === false && o.domainRule === '*://*.www.io/*');
  o = build('com');
  assert('规则-190: 裸单标签标记TLD级', o.tldWide === true);
  o = build('www.example.com');
  assert('规则-191: 正常www不标记TLD级', o.tldWide === false);
  o = build('1.2.3.4');
  assert('规则-192: IP不标记TLD级', o.tldWide === false);
})();

// ==== [规则-193~211] 校验空正则与 DDG 重定向解包 ====
await (async () => {
  const fnsToExtract = [
    'hostLabelToASCII', 'toASCIIHostname', 'safeRegexTest', 'stripRuleComment', 'getInvalidRegexFlags', 'parseConditionPart',
    'tokenizeCondExpr', 'parseCondExprTokens', 'analyzeCondExpr', 'foldCondExpr',
    'evalDynamicLeaf', 'evalCondAST', 'extractBalancedParens', 'findIfOccurrences', 'stripIfConditions',
    'evaluateCondition', 'isCondExprCore', 'looksLikeCondExpr', 'absorbStandaloneExpr',
    'parseRuleWithConditions', 'validateUrlWildcard', 'ruleToRegex', 'parsePrefixedRegexRule',
    'escapeWildcardPart', 'wildcardToRegex', 'matchWildcardDomainPattern', 'extractSimpleWhitelistDomain',
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
  assert('规则-194: 空正则 //i 判定无效', analyzeRule('//i').valid === false);
  assert('规则-195: 空白正则 /   / 判定无效', analyzeRule('/   /').valid === false);
  assert('规则-196: 正常正则 /abc/ 有有效结果', analyzeRule('/abc/').valid === true);
  assert('规则-197: **:// 前缀判定无效', analyzeRule('**://example.com/*').valid === false);
  assert('规则-198: 路径尾部/**不误伤', analyzeRule('*://*.example.com/**').valid === true);
  assert('规则-199: *://**.x 仍判定无效', analyzeRule('*://**.example.com/*').valid === false);

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
  const scholarJp = { href: 'https://scholar.google.co.jp/scholar_url?url=https%3A%2F%2Fexample.com%2Fpaper' };
  assert('规则-204: scholar 地区站解包', getCleanUrl(scholarJp) === 'https://example.com/paper');
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
  const customEngineLink = { href: 'https://scholar.google.com/scholar_url?url=https%3A%2F%2Fpapers.example.com%2Fx' };
  assert('规则-211: 不依赖引擎ID仍解包', getCleanUrl(customEngineLink) === 'https://papers.example.com/x');
})();

// ==== [规则-212~244] 已知问题复现(修复对应问题后应反转断言) ====
await (async () => {
  // 用户/订阅正则无灾难性回溯防护(safeRegexTest 无超时/无静态检查)
  {
    const fnsToExtract = [
      'hostLabelToASCII', 'toASCIIHostname', 'safeRegexTest', 'stripRuleComment', 'getInvalidRegexFlags', 'parseConditionPart',
      'tokenizeCondExpr', 'parseCondExprTokens', 'analyzeCondExpr', 'foldCondExpr',
      'evalDynamicLeaf', 'evalCondAST', 'extractBalancedParens', 'findIfOccurrences', 'stripIfConditions',
      'evaluateCondition', 'isCondExprCore', 'looksLikeCondExpr', 'absorbStandaloneExpr',
      'parseRuleWithConditions', 'validateUrlWildcard', 'ruleToRegex', 'parsePrefixedRegexRule',
      'escapeWildcardPart', 'wildcardToRegex', 'matchWildcardDomainPattern', 'extractSimpleWhitelistDomain',
      'validateCondition', 'analyzeRule'
    ];
    const langMatch = src.match(/const LANG_TEXTS = \{[\s\S]*?\n  \};/)[0];
    const consts = src.match(/const SUPPORTED_REGEX_FLAGS = 'imsu';/)[0];
    const analyzeRule = new Function(
      `${consts}\n${langMatch}\n` +
      `function t(key, params = {}) { return key; }\n` +
      fnsToExtract.map(n => extractFn(src, n)).join('\n') +
      '\nreturn analyzeRule;'
    )();
    check('规则-212(已知问题): 嵌套量词正则 (a+)+$ 通过校验(热路径存在卡死风险)', analyzeRule('/(a+)+$/').valid === true);
  }

  // 含 userinfo 的 URL 正常匹配(host 通配正则识别 user@ 前缀)
  {
    const api = new Function(
      ['hostLabelToASCII', 'toASCIIHostname', 'escapeWildcardPart', 'wildcardToRegex', 'parsePrefixedRegexRule', 'ruleToRegex', 'compileRuleRegex', 'safeRegexTest']
        .map(n => extractFn(src, n)).join('\n') +
      '\nreturn { compileRuleRegex, safeRegexTest };'
    )();
    const match = (rule, url) => { const c = api.compileRuleRegex(rule); return api.safeRegexTest(c.regex, url); };
    check('规则-213: *://*.example.com/* 正常匹配 https://user@example.com/', match('*://*.example.com/*', 'https://user@example.com/') === true);
    check('规则-213-2: *://user:pass@example.com/* 规则正常编译与匹配', match('*://user:pass@example.com/*', 'https://user:pass@example.com/page') === true);
    check('规则-213-3: *://user:pass@example.com:8080/* 规则正常编译与匹配', match('*://user:pass@example.com:8080/*', 'https://user:pass@example.com:8080/page') === true);
  }

  // YAML 双引号项含非标准转义时单行错误毒化整份订阅
  {
    const parseRulesetContent = new Function('currentConfig',
      extractFn(src, 'extractYamlRuleItems') + '\n' + extractFn(src, 'parseRulesetContent') + '\nreturn parseRulesetContent;'
    )({ debug: false });
    let threw = false;
    try { parseRulesetContent('name: t\nrules:\n  - "bad \\q escape"\n  - example.com'); } catch (e) { threw = true; }
  check('规则-214: 单个坏转义项跳过且保留其他规则', threw === false && parseRulesetContent('name: t\nrules:\n  - "bad \\q escape"\n  - example.com').lines.includes('example.com'));
  }

  // Content-Type 误判 —— 自家格式的合法内容因响应头 text/html 被判无效
  {
    const isInvalidSyncResponse = new Function(
      extractFn(src, 'isHtmlResponse') + '\n' + extractFn(src, 'isInvalidSyncResponse') + '\nreturn isInvalidSyncResponse;'
    )();
    const good = '# ScriptConfig: {"t":1}\n*://example.com/*';
    check('规则-215: 合法规则内容 + text/html CT 仍可用', isInvalidSyncResponse(good, 'content-type: text/html; charset=utf-8') === false);
  }

  // 前 50 行内 JSON 解析失败的 # ScriptConfig: 行仍被剥离(规则注释丢失)
  {
    const parseSyncHeaderFn = extractFn(src, 'parseSyncHeader');
    const run = (content) => new Function('currentConfig', 'console', `${parseSyncHeaderFn}\nreturn parseSyncHeader;`)({ debug: false }, { warn: () => {} })(content);
    const r = run('# ScriptConfig: 我的分组说明\nrule1');
    check('规则-216: 坏头行作为注释保留', r.config === null && r.restLines.join('\n') === '# ScriptConfig: 我的分组说明\nrule1');
    // JSON 截断的坏头行同样留在 restLines, 自动同步会把它当规则合并进本地并回传云端(无法自愈)
    const r2 = run('# ScriptConfig:{"syncedAt":12\nrule1');
    check('规则-217(已知问题): JSON 截断头行留在 restLines 被当规则合并', r2.config === null && r2.restLines.join('\n') === '# ScriptConfig:{"syncedAt":12\nrule1');
  }

  // 部分覆盖内置引擎时 match 丢失(WebDAV 选择器下行未校验即写入可触发)
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
      'hostLabelToASCII', 'toASCIIHostname', 'safeRegexTest', 'safeDecodeURIComponent', 'stripRuleComment',
      'getInvalidRegexFlags', 'parseConditionPart', 'tokenizeCondExpr', 'parseCondExprTokens', 'analyzeCondExpr',
      'foldCondExpr', 'evalDynamicLeaf', 'evalCondAST', 'extractBalancedParens', 'findIfOccurrences',
      'stripIfConditions', 'evaluateCondition', 'isCondExprCore', 'looksLikeCondExpr', 'absorbStandaloneExpr',
      'parseRuleWithConditions', 'validateUrlWildcard', 'ruleToRegex', 'parsePrefixedRegexRule',
      'escapeWildcardPart', 'wildcardToRegex', 'splitHostAndPort', 'escapeHostPart',
      'matchWildcardDomainPattern', 'extractSimpleWhitelistDomain', 'matchSimpleDomain',
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
    check('规则-221: @@example.com 不生成白名单索引键', api.extractSimpleWhitelistDomain('@@example.com') === null);
    check('规则-222: uBO注释 !site = example.com 被过滤', api.collectSubscriptionRules(['!site = example.com']).length === 0);
    check('规则-223(对照): 普通 ! 注释仍被过滤', api.collectSubscriptionRules(['! 普通注释说明']).length === 0);

    const wlGuard = (rule) => {
      const parsed = api.parseRuleWithConditions(rule);
      return parsed.staticPass && parsed.coreRule.startsWith('@') && !parsed.coreRule.startsWith('@@')
        && (parsed.coreRule.length > 1 || parsed.standaloneExpr || parsed.dynamicConditions.length > 0);
    };
    const hlGuard = (rule) => {
      const hlBody = rule.replace(/^@\d+\s*/, '');
      const parsed = api.parseRuleWithConditions(hlBody);
      return parsed.staticPass && !parsed.coreRule.startsWith('@');
    };
    check('规则-224: @@规则不再计入白名单(与编译器跳过一致)', wlGuard('@@example.com') === false);
    check('规则-225(对照): 正常白名单仍计入', wlGuard('@*://*.example.com/*') === true);
    check('规则-226(对照): @+条件表达式白名单仍计入', wlGuard('@ $site = "google"') === true);
    check('规则-227: @N+白名单组合不再计入高亮(与编译器拒绝一致)', hlGuard('@1 @example.com') === false);
    check('规则-228(对照): 正常高亮仍计入', hlGuard('@1 example.com') === true);
  }

  // title/…//gi 等非法标志段被静默吞进模式(与 /regex/ 路径的报错行为不一致)
  {
    const parsePrefixedRegexRule = new Function(
      extractFn(src, 'parsePrefixedRegexRule') + '\nreturn parsePrefixedRegexRule;'
    )();
    const r = parsePrefixedRegexRule('title/abc/gi', 6);
  check('规则-229: title/abc/gi 尾部非法flags保留为pattern', r.pattern === 'abc/gi' && r.flags === '');
  }

  // title/text 尾部非法flags(g/y)在 analyzeRule 报 invalidRegexFlags(与 /regex/ 路径一致)
  {
    const parsePrefixedRegexRule = new Function(
      extractFn(src, 'parsePrefixedRegexRule') + '\nreturn parsePrefixedRegexRule;'
    )();
    check('规则-230: 非法尾部段经 flagsCandidate 透出', parsePrefixedRegexRule('title/abc/gi', 6).flagsCandidate === 'gi');
    check('规则-231: 合法flags时无candidate', parsePrefixedRegexRule('title/foo/s', 6).flagsCandidate === '');
    check('规则-232: 字面路径段仍作为candidate保留', parsePrefixedRegexRule('title/abc/def', 6).flagsCandidate === 'def');

    const fnsToExtract = [
      'hostLabelToASCII', 'toASCIIHostname', 'safeRegexTest', 'safeDecodeURIComponent', 'stripRuleComment',
      'getInvalidRegexFlags', 'parseConditionPart', 'tokenizeCondExpr', 'parseCondExprTokens', 'analyzeCondExpr',
      'foldCondExpr', 'evalDynamicLeaf', 'evalCondAST', 'extractBalancedParens', 'findIfOccurrences',
      'stripIfConditions', 'evaluateCondition', 'isCondExprCore', 'looksLikeCondExpr', 'absorbStandaloneExpr',
      'parseRuleWithConditions', 'validateUrlWildcard', 'ruleToRegex', 'parsePrefixedRegexRule',
      'escapeWildcardPart', 'wildcardToRegex', 'splitHostAndPort', 'escapeHostPart',
      'matchWildcardDomainPattern', 'extractSimpleWhitelistDomain', 'matchSimpleDomain',
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
    check('规则-234: text/…/gi 判定无效', analyzeRule('text/foo/gi').valid === false);
    check('规则-235: 高亮+title/…/gi 判定无效', analyzeRule('@1 title/x/gi').valid === false);
    check('规则-236: 行尾注释剥离后仍检测', analyzeRule('title/abc/gi # 注释').valid === false);
    check('规则-237: 对照 字面路径def仍有效', analyzeRule('title/abc/def').valid === true);
    check('规则-238: 对照 重复ii仍有效', analyzeRule('title/path/ii').valid === true);
    check('规则-239: 对照 合法s仍有效', analyzeRule('title/foo/s').valid === true);
    check('规则-240: 对照 多段路径仍有效', analyzeRule('text/example.com/path/sub').valid === true);
    check('规则-241: 对照 转义斜杠路径含i字样不误报', analyzeRule('title/https:\\/\\/foo\\/i').valid === true);
  }

  // 规则含未配对单引号时行尾注释不被剥离(注释并入规则致匹配失效)
  {
    const stripRuleComment = new Function(extractFn(src, 'stripRuleComment') + '\nreturn stripRuleComment;')();
    check('规则-242(已知问题): don\'t-example.com # comment 注释未剥离', stripRuleComment("don't-example.com # comment").includes('# comment') === true);
  }

  // YAML 块序列 "-" 换行后的缩进标量回归
  {
    const parseRulesetContent = new Function(
      extractFn(src, 'extractYamlRuleItems') + '\n' + extractFn(src, 'parseRulesetContent') + '\nreturn parseRulesetContent;'
    )();
    const r = parseRulesetContent('name: mix\nwhitelist:\n  -\n    good.example.com\nblacklist:\n  - ads.example.com');
    check('规则-243: whitelist 的 "-\\n    good.example.com" 项被保留', r.lines.includes('@good.example.com') && r.lines.includes('ads.example.com'));
  }

  // xn-- 空主体标签解码为空(域名标签被吞)
  {
    const toUnicodeHostname = new Function(
      extractFn(src, 'punycodeDecodeLabel') + '\n' + extractFn(src, 'toUnicodeHostname') + '\nreturn toUnicodeHostname;'
    )();
    check('规则-244(已知问题): xn-- 空主体解码为空标签(a.xn-- → a.)', toUnicodeHostname('a.xn--') === 'a.');
  }
})();

// ==== [规则-245~260] 修复回归: 公共后缀回退 / 墓碑数量上限 / 规则键互异 ====
await (async () => {
  const consts = src.match(/const COMMON_HOST_PREFIXES = new Set\(\[[^\]]*\]\);/)[0] + '\n' +
    src.match(/const PUBLIC_SUFFIX_2LD = new Set\([\s\S]*?\}\)\);/)[0];
  const build = new Function(
    consts + '\n' + extractFn(src, 'isPublicSuffixBase') + '\n' + extractFn(src, 'buildBlockRuleOptions') + '\nreturn buildBlockRuleOptions;'
  )();

  let o = build('www.co.uk');
  assert('规则-245: www.co.uk 域名选项回退完整主机', o.domainRule === '*://*.www.co.uk/*');
  assert('规则-246: www.co.uk 精确选项不变', o.exactRule === '*://www.co.uk/*');
  assert('规则-247: www.co.uk 标记后缀回退', o.suffixLike === true);
  o = build('www.com.pl');
  assert('规则-248: www.com.pl 回退完整主机', o.domainRule === '*://*.www.com.pl/*');
  o = build('www.com.cn');
  assert('规则-249: www.com.cn 回退完整主机', o.domainRule === '*://*.www.com.cn/*');
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

// ==== [规则-261~271] 修复回归: 通配转义字母元序列按字面 / 删除规则同步 _initialRules ====
await (async () => {
  const wcApi = new Function(
    'hostLabelToASCII', 'toASCIIHostname',
    extractFn(src, 'escapeWildcardPart') + '\n' + extractFn(src, 'wildcardToRegex') + '\nreturn { escapeWildcardPart, wildcardToRegex };'
  )((s) => s, (s) => s);
  const wcMatch = (rule, url) => new RegExp(wcApi.wildcardToRegex(rule), 'i').test(url);

  assert('规则-261: \\b 不再透传为单词边界', wcMatch('*://x.com/a\\b/*', 'https://x.com/a/b/c') === false);
  assert('规则-262: \\d 不再透传为数字类', wcMatch('*://x.com/a\\d/*', 'https://x.com/a/1/') === false);
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

  const compiledRulesDef = src.match(/let\s+compiledRules\s*=\s*\{[\s\S]*?\n\s*\};/);
  assert('规则-271: 顶层 compiledRules 包含白名单条件结构', compiledRulesDef && compiledRulesDef[0].includes('whitelistConditionalDomains: new Map()') && compiledRulesDef[0].includes('whitelistConditionalRules: []'));
})();

// ==== [规则-272~286] 修复回归: 常见主机前缀剥离 + 轻量后缀表 ====
await (async () => {
  const consts = src.match(/const COMMON_HOST_PREFIXES = new Set\(\[[^\]]*\]\);/)[0] + '\n' +
    src.match(/const PUBLIC_SUFFIX_2LD = new Set\([\s\S]*?\}\)\);/)[0];
  const api = new Function(
    consts + '\n' + extractFn(src, 'isPublicSuffixBase') + '\n' + extractFn(src, 'buildBlockRuleOptions') + '\nreturn { buildBlockRuleOptions, isPublicSuffixBase };'
  )();

  let o = api.buildBlockRuleOptions('m.example.com');
  assert('规则-272: m前缀回退主域', o.domainRule === '*://*.example.com/*' && o.exactRule === '*://m.example.com/*');
  o = api.buildBlockRuleOptions('mobile.example.com');
  assert('规则-273: mobile前缀回退主域', o.domainRule === '*://*.example.com/*');
  o = api.buildBlockRuleOptions('wap.example.com');
  assert('规则-274: wap前缀回退主域', o.domainRule === '*://*.example.com/*');
  o = api.buildBlockRuleOptions('touch.example.com');
  assert('规则-275: touch前缀回退主域', o.domainRule === '*://*.example.com/*');
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
  o = api.buildBlockRuleOptions('m.io');
  assert('规则-283: 剥后为单标签不剥离', o.domainRule === '*://*.m.io/*' && o.suffixLike === true);

  assert('规则-284: sch.uk 识别为公共后缀', api.isPublicSuffixBase('sch.uk') === true);
  assert('规则-285: co.za/foo.com.au 识别为公共后缀', api.isPublicSuffixBase('co.za') === true && api.isPublicSuffixBase('com.au') === true);
  assert('规则-286: 裸域注册域与三级主体判定', api.isPublicSuffixBase('example.co.uk') === false && api.isPublicSuffixBase('com.example.co.uk') === false);

  o = api.buildBlockRuleOptions('www.mysite.co.za');
  assert('规则-287: www+co.za注册域剥离', o.domainRule === '*://*.mysite.co.za/*');
  o = api.buildBlockRuleOptions('www.x.edu.cn');
  assert('规则-288: www+edu.cn注册域剥离', o.domainRule === '*://*.x.edu.cn/*');
  o = api.buildBlockRuleOptions('www.co.ke');
  assert('规则-289(对照): 非常用后缀不在表内按普通注册域剥离', o.domainRule === '*://*.co.ke/*' && o.suffixLike === false);
})();

// ==== [规则-290~291] yahoo 传统 /*-http:// 星号解包(修复回归) ====
{
  const getCleanUrl = new Function(
    extractFn(src, 'decodeRedirectTarget') + '\n' +
    extractFn(src, 'decodeBingCkTarget') + '\n' +
    extractFn(src, 'unwrapRedirectUrl') + '\n' +
    extractFn(src, 'getCleanUrl') + '\nreturn getCleanUrl;'
  )();
  const yahooDashStar = { href: 'https://r.search.yahoo.com/_ylt=abc;_ylu=xyz/RV=2/RE=1/RO=2/*-http://example.com/a' };
  assert('规则-290: yahoo 传统 /*-http:// 解包', getCleanUrl(yahooDashStar) === 'http://example.com/a');
  const yahooStarPlain = { href: 'https://rd.yahoo.co.jp/search/web/result/*https://example.jp/page' };
  assert('规则-291(对照): 无连字符星号解包不受影响', getCleanUrl(yahooStarPlain) === 'https://example.jp/page');
  const yahooDashDouble = { href: 'https://tw.search.yahoo.com/r/RK=2/*-https%3A%2F%2Fexample.com%2Fpath%3Fk%3Dv' };
  assert('规则-292: yahoo /*-https%3A 编码变体解包', getCleanUrl(yahooDashDouble) === 'https://example.com/path?k=v');
  const yahooNested = { href: 'https://r.search.yahoo.com/_ylt=A/RV=1/RU=https%3A%2F%2Fr.search.yahoo.com%2FRV%3D2%2FRU%3Dhttps%253A%252F%252Fexample.com%252Fpage%2FRK%3D2/RK=2/RS=x' };
  assert('规则-293: yahoo 套 yahoo 解到最终结果', getCleanUrl(yahooNested) === 'https://example.com/page');
  const ddgGoogle = { href: 'https://duckduckgo.com/l/?uddg=' + encodeURIComponent('https://www.google.com/url?q=' + encodeURIComponent('https://example.com/page')) };
  assert('规则-294: ddg 套 google /url 解到最终结果', getCleanUrl(ddgGoogle) === 'https://example.com/page');
  const bingYahoo = { href: 'https://www.bing.com/ck/a?!&&u=a1' + Buffer.from('https://r.search.yahoo.com/_ylt=A/RU=https%3A%2F%2Fexample.com%2Fpage/RK=2/RS=x').toString('base64url') };
  assert('规则-295: bing ck 套 yahoo RU= 解到最终结果', getCleanUrl(bingYahoo) === 'https://example.com/page');
  const plain = { href: 'https://example.com/page?ru=https%3A%2F%2Fother.example%2Fx' };
  assert('规则-296(对照): 非跳转域查询参数不解包', getCleanUrl(plain) === plain.href);
}

// ==== [修复A] 非ASCII路径通配规则命中百分号编码URL (修复后行为) ====
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
}

// ==== [修复A] resolveUrlDomain 对残留非ASCII的URL做百分号编码归一 ====
{
  const rudApi = new Function(
    ['decodeRedirectTarget', 'decodeBingCkTarget', 'unwrapRedirectUrl', 'getCleanUrl', 'toASCIIUrl', 'resolveUrlDomain'].map((n) => extractFn(src, n)).join('\n') +
    '\nconst toASCIIHostname = (h) => h;\nreturn { resolveUrlDomain };'
  )();
  const viaRedirect = rudApi.resolveUrlDomain({ href: 'https://www.google.com/url?q=https%3A%2F%2Fexample.com%2F%E4%B8%AD%E6%96%87%2Fx' });
  assert('修复A-9: 重定向解包后URL路径归一为百分号编码', viaRedirect.url === 'https://example.com/%E4%B8%AD%E6%96%87/x' && viaRedirect.domain === 'example.com');
  const nativeEncoded = rudApi.resolveUrlDomain({ href: 'https://example.com/%E4%B8%AD%E6%96%87/x' });
  assert('修复A-10: 原生百分号编码href保持不变', nativeEncoded.url === 'https://example.com/%E4%B8%AD%E6%96%87/x');
  const asciiUrl = rudApi.resolveUrlDomain({ href: 'https://example.com/path/x' });
  assert('修复A-11: 纯ASCII URL不受归一化影响', asciiUrl.url === 'https://example.com/path/x');
}

// ==== [修复H1/M1/L3/L4] 订阅YAML: matches段丢弃 / 识别机制(description等元数据键开头、frontmatter前导空行、单行flow序列) / 映射形列表项丢弃 / 无空格冒号键形标量保留 ====
{
  const yamlFns = ['hostLabelToASCII', 'toASCIIHostname', 'safeRegexTest', 'safeDecodeURIComponent', 'stripRuleComment', 'getInvalidRegexFlags', 'parseConditionPart', 'tokenizeCondExpr', 'parseCondExprTokens', 'analyzeCondExpr', 'foldCondExpr', 'evalDynamicLeaf', 'evalCondAST', 'extractBalancedParens', 'findIfOccurrences', 'stripIfConditions', 'evaluateCondition', 'isCondExprCore', 'looksLikeCondExpr', 'absorbStandaloneExpr', 'parseRuleWithConditions', 'validateUrlWildcard', 'ruleToRegex', 'parsePrefixedRegexRule', 'escapeWildcardPart', 'wildcardToRegex', 'matchWildcardDomainPattern', 'extractSimpleWhitelistDomain', 'matchSimpleDomain', 'compileRuleRegex', 'checkDynamicConditions', 'matchDomainEntryType', 'buildRuleIndex', 'extractIfConditions', 'validateCondition', 'analyzeRule', 'validateRule', 'checkRuleMatchOptimized', 'extractYamlRuleItems', 'parseRulesetContent', 'collectSubscriptionRules', 'isElementRuleLine', 'isScriptRuleLine', 'filterValidRuleLines'].map((n) => extractFn(src, n));
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
  assert('修复H1-1: matches段整段丢弃、rules段保留', JSON.stringify(h1.rules) === JSON.stringify(['example.com']));
  yApi.setState([], [{ url: 's1', enabled: true, name: 'S1', rules: h1.rules }]);
  yApi.buildRuleIndex();
  const h1b = yApi.checkRuleMatchOptimized('https://www.google.com/search?q=t', 'www.google.com', 'T', null, ['www.google.com']);
  assert('修复H1-2: 搜索页URL不再被matches规则屏蔽', !(h1b && h1b.blocked));
  const h1c = yApi.checkRuleMatchOptimized('https://example.com/x', 'example.com', 'T', null, ['example.com']);
  assert('修复H1-3(对照): 正常规则仍生效', !!(h1c && h1c.blocked));
  const h1d = collect('matches: [https://www.google.com/search?*]\nrules:\n  - flow.com\n');
  assert('修复H1-4: matches flow序列同样丢弃', JSON.stringify(h1d.rules) === JSON.stringify(['flow.com']));
  const h1e = collect('title: A\nmatches:\n  - *://*.b.com/*\n');
  assert('修复H1-5: 仅matches段的文件导入为空', h1e.rules.length === 0);

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

  const l3 = collect('rules:\n  - localhost:8080/*\n  - user:pass@host/page\n');
  assert('修复L3: 无空格冒号键形标量保留', JSON.stringify(l3.rules) === JSON.stringify(['localhost:8080/*', 'user:pass@host/page']));

  const l4 = collect('blacklist:\n  - url: https://example.com\n  - real.com\n');
  assert('修复L4-1: 映射形项不再导入为激活规则', JSON.stringify(l4.rules) === JSON.stringify(['real.com']));
  yApi.setState([], [{ url: 's2', enabled: true, name: 'S2', rules: l4.rules }]);
  yApi.buildRuleIndex();
  const l4b = yApi.checkRuleMatchOptimized('https://example.com', 'example.com', 'T', null, ['example.com']);
  assert('修复L4-2: 映射形项不产生实际屏蔽', !(l4b && l4b.blocked));
}

// ==== [修复4/修复5] 旧配置 enabled 回填 / 索引签名跳过重建 + 正则编译记忆化 ====
{
  const cfgDefaults = src.match(/const CFG_DEFAULTS = \{[^}]*\};/)[0];
  const fillBlank = new Function(cfgDefaults + '\nconst currentConfig = {};\nfor (const k in CFG_DEFAULTS) if (currentConfig[k] === undefined) currentConfig[k] = CFG_DEFAULTS[k];\nreturn currentConfig;');
  assert('修复4-1: 损坏/旧配置回填后 enabled=true', fillBlank().enabled === true);
  const fillKept = new Function(cfgDefaults + '\nconst currentConfig = { enabled: false };\nfor (const k in CFG_DEFAULTS) if (currentConfig[k] === undefined) currentConfig[k] = CFG_DEFAULTS[k];\nreturn currentConfig;');
  assert('修复4-2: 已有 enabled=false 不被覆盖', fillKept().enabled === false);
  assert('修复4-3: 默认配置含 enabled: true', /function getDefaultConfig\(\) \{[\s\S]*?enabled: true/.test(src));

  const fns5 = [
    'hostLabelToASCII', 'toASCIIHostname', 'safeRegexTest', 'safeDecodeURIComponent', 'stripRuleComment', 'getInvalidRegexFlags', 'parseConditionPart',
    'tokenizeCondExpr', 'parseCondExprTokens', 'analyzeCondExpr', 'foldCondExpr',
    'evalDynamicLeaf', 'evalCondAST', 'extractBalancedParens', 'findIfOccurrences', 'stripIfConditions',
    'evaluateCondition', 'isCondExprCore', 'looksLikeCondExpr', 'absorbStandaloneExpr',
    'parseRuleWithConditions', 'validateUrlWildcard', 'ruleToRegex', 'parsePrefixedRegexRule',
    'escapeWildcardPart', 'wildcardToRegex', 'matchWildcardDomainPattern', 'extractSimpleWhitelistDomain', 'matchSimpleDomain',
    'compileRuleRegex', 'checkDynamicConditions', 'matchDomainEntryType', 'buildRuleIndex',
    'extractIfConditions', 'validateCondition', 'analyzeRule', 'validateRule',
    'checkRuleMatchOptimized',
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
}

})();

// ==== [规则-300~314] 修复回归: title/text 尾段误报flags / 畸形scheme拒绝 / 紧贴@N高亮识别 ====
await (async () => {
const consts = src.match(/const SUPPORTED_REGEX_FLAGS = 'imsu';/)[0];
const langMatch = src.match(/const LANG_TEXTS = \{[\s\S]*?\n  \};/)[0];
const coreFns = [
  'hostLabelToASCII', 'toASCIIHostname', 'safeRegexTest', 'safeDecodeURIComponent', 'stripRuleComment',
  'getInvalidRegexFlags', 'parseConditionPart', 'tokenizeCondExpr', 'parseCondExprTokens', 'analyzeCondExpr',
  'foldCondExpr', 'evalDynamicLeaf', 'evalCondAST', 'extractBalancedParens', 'findIfOccurrences',
  'stripIfConditions', 'evaluateCondition', 'isCondExprCore', 'looksLikeCondExpr', 'absorbStandaloneExpr',
  'parseRuleWithConditions', 'validateUrlWildcard', 'ruleToRegex', 'parsePrefixedRegexRule',
  'escapeWildcardPart', 'wildcardToRegex', 'matchWildcardDomainPattern', 'extractSimpleWhitelistDomain', 'matchSimpleDomain',
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
check('规则-301: text/…/path/img 尾段不再误报flags', analyzeApi.validateRule('text/example.com/path/img') === true);
check('规则-302: title/…/gr 尾段不再误报flags', analyzeApi.validateRule('title/foo/gr') === true);
check('规则-303: text/…/style 尾段不再误报flags', analyzeApi.validateRule('text/example.com/style') === true);
check('规则-304: title/…/g 非法flags仍拒绝', analyzeApi.validateRule('title/abc/g') === false);
check('规则-305: title/…/gy 非法flags仍拒绝', analyzeApi.validateRule('title/abc/gy') === false);
check('规则-306: title/…/gi 混合尾段仍按flags拒绝(对照规则-235)', analyzeApi.validateRule('title/x/gi') === false);
check('规则-307: 1*://… 畸形scheme拒绝', analyzeApi.validateRule('1*://example.com/*') === false);
check('规则-308: http*://… 畸形scheme拒绝', analyzeApi.validateRule('http*://example.com/*') === false);
check('规则-309: https://… 具体scheme仍有效', analyzeApi.validateRule('https://example.com/*') === true);

const idxFns = [
  'hostLabelToASCII', 'toASCIIHostname', 'safeRegexTest', 'safeDecodeURIComponent', 'stripRuleComment', 'getInvalidRegexFlags', 'parseConditionPart',
  'tokenizeCondExpr', 'parseCondExprTokens', 'analyzeCondExpr', 'foldCondExpr',
  'evalDynamicLeaf', 'evalCondAST', 'extractBalancedParens', 'findIfOccurrences', 'stripIfConditions',
  'evaluateCondition', 'isCondExprCore', 'looksLikeCondExpr', 'absorbStandaloneExpr',
  'parseRuleWithConditions', 'validateUrlWildcard', 'ruleToRegex', 'parsePrefixedRegexRule',
  'escapeWildcardPart', 'wildcardToRegex', 'matchWildcardDomainPattern', 'extractSimpleWhitelistDomain', 'matchSimpleDomain',
  'compileRuleRegex', 'checkDynamicConditions', 'matchDomainEntryType', 'buildRuleIndex',
  'extractIfConditions', 'validateCondition', 'analyzeRule', 'validateRule',
  'checkRuleMatchOptimized',
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
check('规则-310: 紧贴@N*:// 识别为高亮(编译入索引)', cr.highlightUrls.length === 1 || cr.highlightDomains.has('example.com'));
const hlR = api.checkRuleMatchOptimized('https://example.com/x', 'example.com', 't', '', ['example.com']);
check('规则-311: 紧贴@N*:// 高亮命中且不屏蔽', !!hlR && hlR.highlight === 1 && !hlR.blocked);

api.setState(['@1example.com'], []);
api.buildRuleIndex();
cr = api.getCR();
check('规则-312: @1example.com 保留白名单解析不识别高亮', !cr.highlightDomains.has('example.com') && cr.whitelistDomains.has('1example.com'));

api.setState(['@2*://*.example.com/* @if(title *= "t")'], []);
api.buildRuleIndex();
cr = api.getCR();
const hlC = api.checkRuleMatchOptimized('https://a.example.com/x', 'a.example.com', 't', '', ['a.example.com', 'example.com']);
check('规则-313: 紧贴@N与@if组合仍为条件高亮', (cr.highlightConditionalRules.length === 1 || cr.highlightConditionalDomains.size === 1) && !!hlC && hlC.highlight === 2);

api.setState(['@7*://fast7.com/*'], []);
api.buildRuleIndex();
cr = api.getCR();
check('规则-314: 紧贴@N越界N仍跳过', cr.highlightUrls.length === 0 && cr.highlightDomains.size === 0);

// ==== [修复-问题1/5/6] IDN中文通配符转ASCII / Yahoo重定向RU截断 / host端口条件匹配 ====
{
  // 问题1: escapeWildcardPart / toASCIIHostname 中文域名通配
  assert('修复1-1: 中文泛域名带星号通配正确编译为Punycode正则片段', api.escapeWildcardPart('*.例子*.com', true) === '(?:[^/]*\\.)?xn--[^/]*-kb7ap09a\\.com');
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
  assert('修复5-1: Yahoo RU= 参数含 2 字母等号时不被截断', gcu(yahooWithParam) === 'https://example.com/api/no=123');
}
{
  // 问题6: evalDynamicLeaf host 表达式支持端口
  const condEvalHost = new Function(
    ['hostLabelToASCII', 'toASCIIHostname', 'safeRegexTest', 'safeDecodeURIComponent', 'stripRuleComment', 'getInvalidRegexFlags', 'parseConditionPart',
     'tokenizeCondExpr', 'parseCondExprTokens', 'analyzeCondExpr', 'foldCondExpr', 'evalDynamicLeaf', 'evalCondAST'].map(n => extractFn(src, n)).join('\n') +
    '\nreturn { evalDynamicLeaf };'
  )();
  assert('修复6-1: host = "localhost:8080" 匹配带端口URL', condEvalHost.evalDynamicLeaf({ type: 'host', op: '=', val: 'localhost:8080' }, '', 'http://localhost:8080/x') === true);
  assert('修复6-2: host = "localhost:8080" 不匹配其他端口URL', condEvalHost.evalDynamicLeaf({ type: 'host', op: '=', val: 'localhost:8080' }, '', 'http://localhost:9090/x') === false);
  assert('修复6-3: host $= ":8080" 后缀匹配带端口URL', condEvalHost.evalDynamicLeaf({ type: 'host', op: '$=', val: ':8080' }, '', 'http://localhost:8080/x') === true);
  assert('修复6-4: host $= ".example.com:8080" 后缀匹配子域加端口URL', condEvalHost.evalDynamicLeaf({ type: 'host', op: '$=', val: '.example.com:8080' }, '', 'http://sub.example.com:8080/x') === true);
  assert('修复6-5: host 无端口条件兼容带端口URL的hostname匹配', condEvalHost.evalDynamicLeaf({ type: 'host', op: '=', val: 'localhost' }, '', 'http://localhost:8080/x') === true);
}
// ==== [规则-315~317] 已知问题留档: 路径尾冒号被当规则边界 / 行尾转义星号丢失右边界 (仅断言当前行为) ====
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
  assert('规则-315(已知问题): 路径尾冒号被当作规则边界(/release:2024 误命中规则 /release)', wcApi.safeRegexTest(reA.regex, 'https://example.com/release:2024') === true);
  assert('规则-316(对照): 规则路径后的普通字符不越界(releasex 不命中)', !wcApi.safeRegexTest(reA.regex, 'https://example.com/releasex'));
  const reB = wcApi.compileRuleRegex('*://example.com/file\\*');
  assert('规则-317(已知问题): 行尾转义星号\\*丢失右边界(file*abc 误命中规则 file\\*)', wcApi.safeRegexTest(reB.regex, 'https://example.com/file*abc') === true);
}
// ==== [规则-318~321] 本轮子代理审查新增已知问题留档: 主机点前星号跨界 / IDN部分标签通配失效 / 条件关键字形URL规则被静默吸收 (仅断言当前行为) ====
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
  assert('规则-318(已知问题): 主机点前星号跨点且可后缀劫持(*example.com 误命中 badexample.com)', wcApi2.safeRegexTest(reF.regex, 'https://badexample.com/') === true);
  const reG = wcApi2.compileRuleRegex('*://ex*mple.com/*');
  assert('规则-319(已知问题): 主机中部星号跨点(ex*mple.com 误命中 exa.mple.com, 与 www.*.com 不跨点语义不一致)', wcApi2.safeRegexTest(reG.regex, 'https://exa.mple.com/') === true);
  const reH = wcApi2.compileRuleRegex('*://例*.com/*');
  assert('规则-320(已知问题): IDN部分标签通配编译产物无法命中punycode主机且校验仍valid(例*.com 静默漏屏蔽)', !wcApi2.safeRegexTest(reH.regex, 'https://xn--fsqu00a.com/'));
}
{
  const condConsts = `
const HL_STATS_REGEX = /^@(\\d+)/;
function t(k, p) { return k; }
const DEFAULT_SELECTORS = {};
function isLocalEntry(e) { return e && e.source !== 'sub'; }
function getSearchEngine() { return 'other'; }
function getSearchCategory() { return 'web'; }
const window = { location: { hostname: 'www.google.com', href: 'https://www.google.com/search?q=x' } };
`;
  const condNames = ['hostLabelToASCII', 'toASCIIHostname', 'safeRegexTest', 'safeDecodeURIComponent', 'stripRuleComment', 'getInvalidRegexFlags', 'parseConditionPart', 'tokenizeCondExpr', 'parseCondExprTokens', 'analyzeCondExpr', 'foldCondExpr', 'evalDynamicLeaf', 'evalCondAST', 'validateUrlWildcard', 'evaluateCondition', 'extractBalancedParens', 'findIfOccurrences', 'stripIfConditions', 'isCondExprCore', 'looksLikeCondExpr', 'isScriptRuleLine', 'isElementRuleLine', 'absorbStandaloneExpr', 'parseRuleWithConditions', 'extractIfConditions', 'validateCondition', 'analyzeRule', 'parsePrefixedRegexRule', 'escapeWildcardPart', 'wildcardToRegex', 'ruleToRegex', 'compileRuleRegex', 'validateRule', 'matchWildcardDomainPattern', 'extractSimpleWhitelistDomain', 'matchSimpleDomain', 'filterValidRuleLines', 'getRuleKey'].map(n => extractFn(src, n));
  const condApi = new Function(condConsts + '\n' + condNames.join('\n') + '\nreturn { parseRuleWithConditions, analyzeRule };')();
  const absorbed = condApi.parseRuleWithConditions('host:8080');
  assert('规则-321(已知问题): 条件关键字形URL规则被静默吸收为永假条件且校验valid(host:8080 无报错且永不屏蔽)', absorbed.coreRule === '' && absorbed.standaloneExpr === true && absorbed.dynamicConditions.length === 1 && condApi.analyzeRule('host:8080').valid === true);
}
})();

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

})();
