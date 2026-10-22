// 规则逻辑 / 优先级 / 统计 / 一键屏蔽 / 去除重定向 / 修复回归
// 命名规则: 规则-三位序号: 描述
// 读取上一级目录的 *.*.*.user.js 或 Lite.user.js

(async () => {
const fs = require('fs');
const path = require('path');

const scriptDir = path.join(__dirname, '..');
const scriptFiles = fs.readdirSync(scriptDir).filter((name) => /^\S+\.\S+\.\S+\.user\.js$/.test(name) || name === 'Lite.user.js').sort();
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
  const consts = text.match(/const (?:RULE_PREFIX_RE|RULE_PREFIX_REGEX_RE|RULE_LEADING_REGEX_RE|REGEX_CTX_A|REGEX_CTX_B|REGEX_CTX_C|REGEX_CTX_D|RULE_REGEX_LIT_RE) = [^\n]+;/g).join('\n').replace(/\bconst\b/g, 'var');
  return consts + '\n' + ['findBalancedParenEnd', 'regexCloseAhead', 'regexStartAhead', 'isBadRegexTail', 'scanRuleString', 'encodeNonAscii'].map((n) => SERH_RAW_EXTRACT(text, n)).join('\n');
})(src);
const SERH_FLAG_HELPERS = ['isUniqueFlagsStr', 'isFlagsCandidateError'].map((n) => SERH_RAW_EXTRACT(src, n)).join('\n');
const SERH_EL_HELPERS = ['isCondExprCore', 'looksLikeCondExpr', 'isScriptRuleLine', 'isElementRuleLine'].map((n) => SERH_RAW_EXTRACT(src, n)).join('\n');
const SERH_DEPS_RE = /scanRuleString\(|RULE_PREFIX_RE|RULE_PREFIX_REGEX_RE|RULE_LEADING_REGEX_RE|REGEX_CTX_[A-D]\b|encodeNonAscii\(|isUniqueFlagsStr\(|isFlagsCandidateError\(|isElementRuleLine\(/;
function extractFn(text, fnName) {
  const body = SERH_RAW_EXTRACT(text, fnName);
  return SERH_DEPS_RE.test(body) ? SERH_FN_DEPS + '\n' + SERH_FLAG_HELPERS + '\n' + SERH_EL_HELPERS + '\n' + body : body;
}

const SERH_CONSTS = {
  flags: src.match(/const SUPPORTED_REGEX_FLAGS = 'imsu';/)[0],
  lang: src.match(/const LANG_TEXTS = \{[\s\S]*?\n  \};/)[0],
  hostPrefixes: src.match(/const COMMON_HOST_PREFIXES = new Set\(\[[^\]]*\]\);/)[0],
  pubSuffix: src.match(/const PUBLIC_SUFFIX_2LD = new Set\([\s\S]*?\}\)\);/)[0],
};
const SERH_T_FN = `function t(key, params = {}) {
  const texts = LANG_TEXTS['zh-CN'] || {};
  let text = texts[key] || key;
  for (const [k, v] of Object.entries(params)) text = text.replaceAll('{' + k + '}', v);
  return text;
}`;
const ENGINE_HOST_SRC = src.match(/const ENGINE_HOST_REGEXES = \{[\s\S]*?\n  \};/)[0];

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? '  => ' + JSON.stringify(extra) : '')); }
}
function assert(name, cond, extra) { check(name, cond, extra); }

// 规则编译/匹配沙箱
function makeWcApi() {
  return new Function(['hostLabelToASCII', 'toASCIIHostname', 'escapeWildcardPart', 'wildcardToRegex', 'parsePrefixedRegexRule', 'ruleToRegex', 'compileRuleRegex', 'safeRegexTest']
    .map((n) => extractFn(src, n)).join('\n') + '\nreturn { escapeWildcardPart, wildcardToRegex, parsePrefixedRegexRule, ruleToRegex, compileRuleRegex, safeRegexTest };')();
}
// 规则索引/校验沙箱, setCR 用于手工构造索引
function makeRulesApi() {
  const fns = ['hostLabelToASCII', 'toASCIIHostname', 'toASCIIUrl', 'safeRegexTest', 'safeDecodeURIComponent', 'stripRuleComment', 'getInvalidRegexFlags', 'parseConditionPart',
    'tokenizeCondExpr', 'parseCondExprTokens', 'analyzeCondExpr', 'foldCondExpr',
    'evalDynamicLeaf', 'evalCondAST', 'extractBalancedParens', 'findIfOccurrences', 'stripIfConditions',
    'evaluateCondition', 'isCondExprCore', 'looksLikeCondExpr', 'absorbStandaloneExpr',
    'parseRuleWithConditions', 'validateUrlWildcard', 'ruleToRegex', 'parsePrefixedRegexRule',
    'escapeWildcardPart', 'wildcardToRegex', 'normalizeHostCandidate', 'matchWildcardDomainPattern', 'matchSimpleDomain',
    'compileRuleRegex', 'checkDynamicConditions', 'matchDomainEntryType', 'buildRuleIndex', 'newCompiledRules',
    'extractIfConditions', 'validateCondition', 'analyzeRule', 'validateRule', 'cachedAnalyzeRule',
    'checkRuleMatchOptimized', 'isLocalEntry', 'isEngineHost',
  ].map((n) => extractFn(src, n));
  return new Function(`${SERH_CONSTS.flags}\n${SERH_CONSTS.lang}\n${SERH_T_FN}\nlet compiledRules;
${ENGINE_HOST_SRC}
const validationCache = new Map();
const subdomainCache = new Map();
let currentEngine = 'google', currentSite = 'www.google.com', currentCategory = 'web';
const window = { location: { get hostname() { return currentSite; } } };
function getSearchEngine() { return currentEngine; }
function getSearchCategory() { return currentCategory; }
const currentConfig = { rules: [], debug: false };
let subscriptions = [];
function getSubscriptions() { return subscriptions; }
function getAllSubscriptionRules() { const r = []; subscriptions.filter(s => s.enabled).forEach(s => { if (s.rules && Array.isArray(s.rules)) r.push(...s.rules); }); return r; }
let _subscriptionStoreSignature = 'test';
let _testRulesRev = 0;
function getRulesModifiedTime() { return _testRulesRev; }
${fns.join('\n')}
return {
  buildRuleIndex, checkRuleMatchOptimized, analyzeRule, validateRule, validateUrlWildcard,
  getCR: () => compiledRules, setCR: (cr) => { compiledRules = cr; },
  setState: (rules, subs) => { currentConfig.rules = rules; subscriptions = subs || []; _testRulesRev++; _subscriptionStoreSignature = 'test' + _testRulesRev; },
};`)();
}
// 订阅规则过滤沙箱
function makeFilterApi() {
  const fns = ['hostLabelToASCII', 'toASCIIHostname', 'toASCIIUrl', 'safeRegexTest', 'stripRuleComment', 'parseRulesetContent', 'extractYamlRuleItems', 'getInvalidRegexFlags', 'parseConditionPart',
    'tokenizeCondExpr', 'parseCondExprTokens', 'analyzeCondExpr', 'foldCondExpr',
    'evalDynamicLeaf', 'evalCondAST', 'extractBalancedParens', 'findIfOccurrences',
    'stripIfConditions', 'isCondExprCore', 'looksLikeCondExpr', 'isScriptRuleLine', 'isElementRuleLine',
    'absorbStandaloneExpr', 'parseRuleWithConditions', 'extractIfConditions', 'validateCondition',
    'analyzeRule', 'validateRule', 'parsePrefixedRegexRule', 'escapeWildcardPart', 'wildcardToRegex',
    'ruleToRegex', 'validateUrlWildcard', 'evaluateCondition', 'collectSubscriptionRules',
  ].map((n) => extractFn(src, n));
  return new Function(`${SERH_CONSTS.flags}\n${SERH_CONSTS.lang}\n${SERH_T_FN}\nconst window = { location: { hostname: 'www.google.com', pathname: '/search', search: '?q=x', href: 'https://www.google.com/search?q=x' } };
function getSearchEngine() { return 'google'; }
function getSearchCategory() { return 'web'; }
const currentConfig = { debug: false };
${fns.join('\n')}
return { collectSubscriptionRules, parseRulesetContent, isScriptRuleLine, isElementRuleLine, validateRule, validateUrlWildcard };`)();
}
// 重定向解包沙箱
function makeCleanUrlApi() {
  return new Function(`${ENGINE_HOST_SRC}\n` + ['decodeRedirectTarget', 'decodeBingCkTarget', 'unwrapRedirectUrl', 'isOpaqueRedirectUrl', 'getCleanUrl', 'isEngineHost'].map((n) => extractFn(src, n)).join('\n') + '\nreturn getCleanUrl;')();
}

// ==== 一、核心行为 ====

// ---- 规则-001~05x: 通配符与正则标志 ----
{
const api = makeWcApi();
const match = (rule, url) => { const c = api.compileRuleRegex(rule); return api.safeRegexTest(c.regex, url); };

// 通配符元字符转义
assert('规则-001: a+b 匹配字面量 a+b', match('*://example.com/a+b/*', 'https://example.com/a+b/'));
assert('规则-002: {2} 匹配字面量 {2}', match('*://example.com/a{2}/*', 'https://example.com/a{2}/'));
assert('规则-003: a$b 匹配字面量 a$b', match('*://example.com/a$b/*', 'https://example.com/a$b/'));
assert('规则-004: 路径点号转义(file.txt 不匹配 filextxt)', !match('*://example.com/file.txt', 'https://example.com/filextxt'));
assert('规则-005: 路径点号正常匹配', match('*://example.com/file.txt', 'https://example.com/file.txt'));
assert('规则-006: *.example.com 匹配子域', match('*://*.example.com/*', 'https://foo.example.com/x'));
assert('规则-007: example.com 不匹配 exampleXcom', !match('*://example.com/*', 'https://exampleXcom/'));
assert('规则-008: 星号仍为通配', match('*://example.com/a/*/b', 'https://example.com/a/xyz/b'));
assert('规则-009: 问号为字面量不是单字符通配', match('*://example.com/a?b', 'https://example.com/a?b') && !match('*://example.com/a?b', 'https://example.com/axb'));
assert('规则-010: 中文域名通配匹配 punycode', match('*://*.例子.com/*', 'https://xn--fsqu00a.com/x'));
assert('规则-011: 等价写法 * 与 *://*.*/* 命中', match('*', 'https://www.example.com/x') && match('*://*.*/*', 'https://www.example.com/x'));
// 忽略该问题: 通配符与正则匹配极端规则可长时间占用主线程，极罕见问题无修复意义

// 锚定与通配范围
assert('规则-012: 路径模式匹配自身与 http', match('*://example.com/path/*', 'https://example.com/path/x') && match('*://example.com/path/*', 'http://example.com/path/x'));
assert('规则-013: 路径模式不匹配 query 中的伪 URL', !match('*://example.com/path/*', 'https://evil.com/?u=example.com/path/'));
assert('规则-014: 主机通配不跨越路径', !match('*://*.example.com/path/*', 'https://evil.com/x.example.com/path/'));
assert('规则-015: 主机通配仍匹配多级子域与裸域', match('*://*.example.com/path/*', 'https://a.b.example.com/path/x') && match('*://*.example.com/path/*', 'https://example.com/path/x'));
assert('规则-016: 显式 scheme 不匹配其他 scheme', !match('https://example.com/*', 'http://example.com/'));

// 裸域与无scheme
assert('规则-017: 裸域名规则匹配裸域与子域', match('example.com', 'https://example.com/') && match('example.com', 'https://www.example.com/'));
assert('规则-018: 精确域名规则不匹配子域', !match('*://example.com/*', 'https://www.example.com/'));
assert('规则-019: 无scheme *.域 匹配子域与裸域', match('*.example.com', 'https://foo.example.com/x') && match('*.example.com', 'https://example.com/'));
assert('规则-020: 无scheme *.域 不匹配前缀域名与伪URL', !match('*.example.com', 'https://notexample.com/') && !match('*.example.com', 'https://evil.com/?u=example.com'));
assert('规则-021: 无路径规则匹配自身与子路径', match('*://example.com', 'https://example.com/') && match('*://example.com', 'https://example.com/path/x'));
assert('规则-022: 无路径规则不匹配后缀域名', !match('*://example.com', 'https://example.com.evil.com/'));

// 端口
assert('规则-023: 显式端口规则匹配同端口', match('*://example.com:8080/path/*', 'https://example.com:8080/path/test'));
assert('规则-024: 显式端口规则不匹配不同端口与无端口', !match('*://example.com:8080/path/*', 'https://example.com:9000/path/test') && !match('*://example.com:8080/path/*', 'https://example.com/path/test'));
assert('规则-025: 端口通配匹配端口段内容', match('*://example.com:*/y', 'https://example.com:8080/y'));
assert('规则-026: 端口通配不跨越冒号至主机与路径', !match('*://example.com:*/y', 'https://example.com/x/y') && !match('*://example.com:*/y', 'https://example.com:80/x/y'));

// 主机中部/尾部星号不跨点
assert('规则-027: *.example.* 带路径不匹配多段后缀', !match('*://*.example.*/*', 'https://example.com.evil.net/'));
assert('规则-028: 中部主机星号不跨点', !match('*://mail.*.com/*', 'https://mail.a.b.com/') && match('*://mail.*.com/*', 'https://mail.a.com/'));
assert('规则-029: *.example.* 匹配二段后缀不匹配三段后缀', match('*://*.example.*/*', 'https://www.example.co.uk/page') && !match('*://*.example.*/*', 'https://example.a.b.c/'));

// 正则 flags 边界
assert('规则-030: s 使点号匹配换行; 无 s 不匹配', match('title/foo.bar/s', 'foo\nbar') && !match('title/foo.bar/', 'foo\nbar'));
assert('规则-031: 转义点不匹配任意字符', match('title/[.]com/s', 'a.com') && !match('title/a\\.b/s', 'axb'));
assert('规则-032: s/i 多标志保留', (() => {
  const parsed = api.parsePrefixedRegexRule('title/foo/s', 6);
  const compiled = api.compileRuleRegex('title/foo/is');
  return parsed.flags === 's' && parsed.pattern === 'foo' && compiled.regex.flags.includes('i') && compiled.regex.flags.includes('s');
})());
assert('规则-033: 尾部非flag斜杠路径保持完整', (() => {
  const parsed = api.parsePrefixedRegexRule('title/something/is/other', 6);
  return parsed.flags === '' && parsed.pattern === 'something/is/other';
})());
assert('规则-034: 转义斜杠不被误识别为flag分隔符', (() => {
  const parsed = api.parsePrefixedRegexRule('title/https:\\/\\/foo\\/i', 6);
  return parsed.flags === '' && parsed.pattern === 'https:\\/\\/foo\\/i';
})());
assert('规则-035: 正常末尾未转义斜杠正确提取flags', (() => {
  const parsed = api.parsePrefixedRegexRule('title/https:\\/\\/foo/i', 6);
  return parsed.flags === 'i' && parsed.pattern === 'https:\\/\\/foo';
})());
assert('规则-036: 奇数反斜杠末尾斜杠作为转义保留', (() => {
  const parsed = api.parsePrefixedRegexRule('title/foo\\/', 6);
  return parsed.flags === '' && parsed.pattern === 'foo\\/';
})());
assert('规则-037: 大写I当作i', (() => {
  const parsed = api.parsePrefixedRegexRule('title/foo/I', 6);
  return parsed.flags === 'i' && parsed.pattern === 'foo';
})());
assert('规则-038: 尾部非flag字母组合保持为pattern', (() => {
  const parsed = api.parsePrefixedRegexRule('title/abc/def', 6);
  return parsed.flags === '' && parsed.pattern === 'abc/def';
})());
assert('规则-039: 编译过滤保留合法flags去除非法', (() => {
  const flags = api.compileRuleRegex('/foo/gyi').regex.flags;
  return flags.includes('i') && !flags.includes('g') && !flags.includes('y');
})());
assert('规则-040: 未闭合正则 /foo 编译报错', (() => {
  try { api.compileRuleRegex('/foo'); return false; } catch (e) { return true; }
})());

// 修复回归
assert('规则-041: 带路径通配规则对尾点FQDN正常匹配', match('*://*.example.com/path/*', 'https://example.com./path/x'));
assert('规则-042: 主机星号不跨点但匹配同标签', (() => {
  const c = api.compileRuleRegex('*://*example.com/*');
  return !api.safeRegexTest(c.regex, 'https://exa.mple.com/') && api.safeRegexTest(c.regex, 'https://badexample.com/');
})());
assert('规则-043: 主机中部星号仍匹配同标签', (() => {
  const c = api.compileRuleRegex('*://ex*mple.com/*');
  return api.safeRegexTest(c.regex, 'https://example.com/');
})());
assert('规则-044: IDN部分标签通配按整标签punycode命中', (() => {
  const c = api.compileRuleRegex('*://例*.com/*');
  return api.safeRegexTest(c.regex, 'https://xn--*-kb7a.com/') && !/例/.test(c.regex.source);
})());
assert('规则-045: 规则路径后的普通字符不越界', (() => {
  const c = api.compileRuleRegex('*://example.com/release');
  return !api.safeRegexTest(c.regex, 'https://example.com/releasex');
})());
assert('规则-083: 查询参数规则命中后续参数', match('*://x.com/*?a=b', 'https://x.com/z?a=b&c=d'));
assert('规则-084: 查询参数规则不匹配更长的参数值', !match('*://x.com/*?a=b', 'https://x.com/z?a=bc'));

// 尾部转义星号末尾锚定
const wcMatch = (rule, url) => new RegExp(api.wildcardToRegex(rule), 'i').test(url);
assert('规则-046: 尾部转义星号补末尾锚定', wcMatch('*://x.com/a\\*', 'https://x.com/a*') === true && wcMatch('*://x.com/a\\*', 'https://x.com/a*tracking=1') === false);
assert('规则-047: 普通通配结尾仍不加锚; 中段转义星号不受影响', wcMatch('*://x.com/a/*', 'https://x.com/a/b/c') === true && wcMatch('*://x.com/a\\*b/*', 'https://x.com/a*b/c') === true);
assert('规则-048: \\b 按字面反斜杠编译不透传', wcMatch('*://x.com/a\\b/*', 'https://x.com/a/b/c') === false && api.wildcardToRegex('*://x.com/a\\b/*').includes('\\\\b'));
assert('规则-049: 普通通配语义不受影响', wcMatch('*://*.example.com/*', 'https://a.example.com/p') === true && wcMatch('*://*.example.com/*', 'https://a.example.com.evil.com/') === false);

// 非ASCII路径百分号编码
assert('规则-050: 中文路径通配命中百分号编码URL', match('*://example.com/中文/*', 'https://example.com/%E4%B8%AD%E6%96%87/x') === true);
assert('规则-051: 非BMP字符(emoji)路径按码点编码命中', match('*://example.com/😀/*', 'https://example.com/%F0%9F%98%80/x') === true);
assert('规则-052: 对原样UnicodeURL不直接命中(subject侧归一兜底)', match('*://example.com/中文/*', 'https://example.com/中文/x') === false);
}

// ---- 规则-060~08x: 订阅规则过滤 ----
{
const api = makeFilterApi();

// uBO 元素规则判定
const elementRuleLines = ['example.com##.ad', '##.ad', 'example.com#$#alert(1)', 'example.com#?#div:has(> span)', 'example.com#%#window.x=1'];
const scriptRuleLines = ['/foo##bar/', '*://example.com/##x', '*://*.example.com/*'];
assert('规则-060: 元素规则被识别且脚本规则不误判', elementRuleLines.every((rule) => api.isElementRuleLine(rule) === true) && scriptRuleLines.every((rule) => api.isElementRuleLine(rule) === false));

// 订阅保留/丢弃
const keepLines = ['!scheme="https"', '!(title *= "x" | url *= "y")', '*://*.example.com/*', '@1*://example.com/*', '*://x.com/* @if(title *= "@if(y)")', '*://x.com/* # comment', '!title:ad', '!url =~ /spam/', '!url:https://bad.example/', '!path: /x/'];
const skipLines = ['! comment', '[Adblock Plus 2.0]', 'example.com##.ad', '*://bad domain/*', '!site = example.com', '! Title: ads', '!site:example.com', '! Last modified: x', '!version: 2'];
assert('规则-062: 合法订阅行全部保留', keepLines.every((line) => api.collectSubscriptionRules([line]).length === 1));
assert('规则-063: 注释/元数据/元素规则全部跳过', skipLines.every((line) => api.collectSubscriptionRules([line]).length === 0));

// uBO 网络过滤规则拒绝
assert('规则-064: uBO网络规则被过滤与校验拒绝', api.collectSubscriptionRules(['||example.com^']).length === 0 && api.validateUrlWildcard('||example.com^') === false && api.validateRule('||example.com^') === false);
assert('规则-065: 管道符路径与裸域仍有效', api.validateRule('*://example.com/a|b/*') === true && api.validateRule('example.com') === true);

// frontmatter 与 YAML 端到端
const { lines, meta } = api.parseRulesetContent('---\nname: Test\n---\n# c\n!scheme="https"\n*://*.example.com/*\n');
assert('规则-066: frontmatter 剥离', meta.name === 'Test');
assert('规则-067: 组合过滤结果', JSON.stringify(api.collectSubscriptionRules(lines.map((l) => l.trim()))) === JSON.stringify(['!scheme="https"', '*://*.example.com/*']));

const yParsed = api.parseRulesetContent('name: Y List\nrules:\n  - example.com\n  - \'*://*.example.com/*\'\n  - example.com##.ad\n  - ||ubo.com^\n');
assert('规则-068: YAML订阅提取与过滤', yParsed.meta.name === 'Y List' && JSON.stringify(api.collectSubscriptionRules(yParsed.lines.map((l) => l.trim()))) === JSON.stringify(['example.com', '*://*.example.com/*']));
const yWl = api.parseRulesetContent('name: Mix\nblacklist:\n  - ads.com\nrules:\n  - extra.com\nwhitelist:\n  - good.com\n  - "*://ok.com/*"\n');
assert('规则-069: YAML多段+whitelist加@', JSON.stringify(api.collectSubscriptionRules(yWl.lines.map((l) => l.trim()))) === JSON.stringify(['ads.com', 'extra.com', '@good.com', '@*://ok.com/*']));
const yCond = api.parseRulesetContent('name: Cond List\nrules:\n  - title: /广告/\n  - !host $= ".spam.com"\n  - title *= "推广"\n');
assert('规则-070: YAML映射形项丢弃、操作符条件保留', JSON.stringify(api.collectSubscriptionRules(yCond.lines.map((l) => l.trim()))) === JSON.stringify(['!host $= ".spam.com"', 'title *= "推广"']));

const collect = (content) => api.collectSubscriptionRules(api.parseRulesetContent(content).lines.map((l) => l.trim()));
assert('规则-071: matches段与rules段同等保留且保持原顺序', (() => {
  const h1 = collect('name: Test\nmatches:\n  - https://www.google.com/search?*\nrules:\n  - example.com\n');
  return JSON.stringify(h1) === JSON.stringify(['https://www.google.com/search?*', 'example.com']);
})());
assert('规则-072: matches flow序列同样保留', JSON.stringify(collect('matches: [https://www.google.com/search?*]\nrules:\n  - flow.com\n')) === JSON.stringify(['https://www.google.com/search?*', 'flow.com']));
assert('规则-073: 单行flow序列解析', JSON.stringify(api.parseRulesetContent('name: Flow\nrules: [a.com, b.com]\n').lines) === JSON.stringify(['a.com', 'b.com']));
assert('规则-074: flow引号项含逗号/花括号不被拆坏', JSON.stringify(api.parseRulesetContent("rules: ['x.com/a{2,3}', \"y.com\", z.com]").lines) === JSON.stringify(['x.com/a{2,3}', 'y.com', 'z.com']));
assert('规则-075: 跨行flow序列不把右括号当规则', JSON.stringify(api.parseRulesetContent('rules: [\n  a.com,\n  b.com\n]\n').lines) === JSON.stringify(['a.com', 'b.com']));
assert('规则-076: frontmatter前导空行容忍', (() => {
  const m = api.parseRulesetContent('\n\n---\nname: My List\n---\nrules:\n  - a.com\n');
  return m.meta.name === 'My List' && m.lines.includes('a.com');
})());
assert('规则-077: 任意元数据键开头均可识别', JSON.stringify(collect('homepage: https://x\nversion: 2\nrules:\n  - meta-first.com\n')) === JSON.stringify(['meta-first.com']));
assert('规则-078: 映射形项不再导入为激活规则', JSON.stringify(collect('blacklist:\n  - url: https://example.com\n  - real.com\n')) === JSON.stringify(['real.com']));
assert('规则-079: 折叠标量整段保留且后续项不丢', JSON.stringify(collect('rules:\n  - example.com\n  - >\n    *://folded.example.com/*\n  - kept.com\n')) === JSON.stringify(['example.com', '*://folded.example.com/*', 'kept.com']));
assert('规则-080: flow whitelist自动加@', JSON.stringify(collect('whitelist: [keep.com, ok.com]\n')) === JSON.stringify(['@keep.com', '@ok.com']));
assert('规则-080a: whitelist块标量逐行加@', JSON.stringify(collect('whitelist: |\n  keep.com\n  ok.com\n')) === JSON.stringify(['@keep.com', '@ok.com']));
assert('规则-080b: rules块标量逐行导入', JSON.stringify(collect('rules: |-\n  a.com\n  b.com\n')) === JSON.stringify(['a.com', 'b.com']));
assert('规则-080c: frontmatter含matches时正文规则保留', JSON.stringify(collect('---\nname: X\nmatches:\n  - "*://www.google.com/search*"\n---\n*://*.example.com/*\n')) === JSON.stringify(['*://www.google.com/search*', '*://*.example.com/*']));
assert('规则-080d: frontmatter含rules段时正文规则保留', JSON.stringify(collect('---\nname: X\nrules:\n  - head.com\n---\nbody.com\n')) === JSON.stringify(['head.com', 'body.com']));
assert('规则-081: 无空格冒号键形标量保留', JSON.stringify(collect('rules:\n  - localhost:8080/*\n  - user:pass@host/page\n')) === JSON.stringify(['localhost:8080/*', 'user:pass@host/page']));

// YAML 容错
let threw = false, res;
try { res = api.parseRulesetContent('name: "My list\nrules:\n  - *://a.com/*\n'); } catch (_) { threw = true; }
assert('规则-082: YAML name行引号不配对时容错提取且不抛错', threw === false && res.meta.name === 'My list' && res.lines.length === 1);
assert('规则-257: 空YAML规则段解析为空且---不成为规则', api.parseRulesetContent('name: E\nrules: []\n').lines.length === 0 && collect('rules: []\n').length === 0 && collect('---\n').length === 0);
}

// ---- 规则-090~10x: 来源标记 ----
{
const api = makeRulesApi();

api.setState(['@*://*.example.com/*', '*://*.example.com/*'], [{ url: 's1', enabled: true, rules: ['@*://*.example.com/*'] }]);
api.buildRuleIndex();
const cr = api.getCR();
const wl = cr.whitelistDomains.get('example.com') || [];
const bl = cr.domains.get('example.com') || [];
assert('规则-090: 本地白名单标记为本地来源', wl.some(e => e.source === '本地规则'));
assert('规则-091: 订阅白名单标记为订阅来源', wl.some(e => e.source === '订阅1'));
assert('规则-092: 本地黑名单标记为本地来源', bl.some(e => e.source === '本地规则'));
assert('规则-093: 重复规则不再丢失本地白名单优先级', (() => {
  const r = api.checkRuleMatchOptimized('https://example.com/', 'example.com', 't', null, ['example.com']);
  return !r || r.blocked !== true;
})());

api.setState(['*://*.local.com/*'], [{ url: 's1', enabled: true, rules: ['*://*.sub.com/*'] }]);
api.buildRuleIndex();
let cr2 = api.getCR();
assert('规则-094: 本地/订阅独有规则来源正确', cr2.domains.get('local.com')[0].source === '本地规则' && cr2.domains.get('sub.com')[0].source === '订阅1');

api.setState([], [
  { url: 's1', enabled: false, rules: ['*://*.off.com/*'] },
  { url: 's2', enabled: true, rules: ['*://*.on.com/*'] },
]);
api.buildRuleIndex();
cr2 = api.getCR();
assert('规则-095: 禁用订阅不加载, 启用订阅保留原始序号标签', !cr2.domains.has('off.com') && cr2.domains.get('on.com')[0].source === '订阅2');

api.setState(['@1 @*://*.bad.com/*', '@2 @host $= ".bad2.com"', '@3 *://*.good.com/*'], []);
api.buildRuleIndex();
cr2 = api.getCR();
assert('规则-096: 高亮+白名单同时编译', cr2.highlightDomains.has('bad.com') && cr2.whitelistDomains.has('bad.com') && cr2.highlightConditionalRules.some(e => e.N === 2) && cr2.whitelistConditionalRules.length === 1);

assert('规则-097: @N前缀需要分隔符', (() => {
  api.setState(['@2fast.com'], []); api.buildRuleIndex();
  const c = api.getCR();
  return !c.highlightDomains.has('fast.com') && c.whitelistDomains.has('2fast.com');
})());
assert('规则-098: @Ntitle/@Ntext 无空格识别为高亮', (() => {
  api.setState(['@1title/abc/', '@2text/x.*/i'], []); api.buildRuleIndex();
  const c = api.getCR();
  return c.highlightTitles.length === 1 && c.highlightTexts.length === 1 && c.whitelistTitlePatterns.length === 0;
})());

api.setState(['*://**.com/*', 'title/foo/gi', '/abc/gi', '/foo'], []);
api.buildRuleIndex();
cr2 = api.getCR();
assert('规则-099: 无效规则均不进索引', cr2.urls.length === 0 && cr2.titles.length === 0 && !cr2.domains.has('**.com'));
}

// ---- 规则-110~13x: 优先级矩阵 ----
{
const api = makeRulesApi();
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
const isBlocked = (r) => !!(r && r.blocked === true);
const getSrc = (r) => (r ? r.source : null);
function addWlDomain(cr, domain, type, source, rule) {
  if (!cr.whitelistDomains.has(domain)) cr.whitelistDomains.set(domain, []);
  cr.whitelistDomains.get(domain).push({ type, source: source || '本地规则', originalRule: rule });
}
function addWlUrl(cr, pattern, source) {
  cr.whitelistUrlPatterns.push({ regex: new RegExp(pattern), source: source || '本地规则' });
}
function addBlDomain(cr, domain, type, rule, source) {
  if (!cr.domains.has(domain)) cr.domains.set(domain, []);
  cr.domains.get(domain).push({ type, originalRule: rule, source });
}
function addBlUrl(cr, pattern, rule, source) {
  cr.urls.push({ regex: new RegExp(pattern), originalRule: rule, source });
}
function addBlTitle(cr, pattern, rule, source) { cr.titles.push({ regex: new RegExp(pattern), originalRule: rule, source }); }
function addBlText(cr, pattern, rule, source) { cr.texts.push({ regex: new RegExp(pattern), originalRule: rule, source }); }

const host = 'www.example.com';
const url = 'https://www.example.com/page';
const sl = ['www.example.com', 'example.com'];
const doCheck = (cr, u, h, title, snippet) => { api.setCR(cr); return api.checkRuleMatchOptimized(u || url, h || host, title, snippet, sl); };

assert('规则-110: 无规则 → 不屏蔽', !isBlocked(doCheck(makeCR(), url, host, 'title')));
assert('规则-111: 本地白名单 > 本地黑名单', (() => {
  const cr = makeCR(); addWlDomain(cr, 'example.com', 'wildcard'); addBlDomain(cr, 'example.com', 'wildcard', 'example.com', '本地规则');
  return !isBlocked(doCheck(cr, url, host, 'title'));
})());
assert('规则-112: 本地黑名单 > 订阅白名单', (() => {
  const cr = makeCR(); addBlDomain(cr, 'example.com', 'wildcard', 'example.com', '本地规则'); addWlDomain(cr, 'example.com', 'wildcard', '订阅规则1');
  return isBlocked(doCheck(cr, url, host, 'title'));
})());
assert('规则-113: 白名单 > 订阅黑名单', (() => {
  const cr = makeCR(); addWlDomain(cr, 'example.com', 'wildcard'); addBlDomain(cr, 'example.com', 'wildcard', 'example.com', '订阅规则1');
  return !isBlocked(doCheck(cr, url, host, 'title'));
})());
assert('规则-114: URL白名单 > URL本地黑名单', (() => {
  const cr = makeCR(); addWlUrl(cr, 'example\\.com'); addBlUrl(cr, 'example\\.com', 'example.com', '本地规则');
  return !isBlocked(doCheck(cr, url, host, 'title'));
})());
assert('规则-115: URL本地黑名单 > URL订阅白名单', (() => {
  const cr = makeCR(); addBlUrl(cr, 'example\\.com', 'example.com', '本地规则'); addWlUrl(cr, 'example\\.com', '订阅规则1');
  const r = doCheck(cr, url, host, 'title');
  return isBlocked(r) && getSrc(r) === '本地规则';
})());
assert('规则-116: 订阅白名单 > 订阅黑名单(URL)', (() => {
  const cr = makeCR(); addWlUrl(cr, 'example\\.com', '订阅规则1'); addBlUrl(cr, 'example\\.com', 'example.com', '订阅规则1');
  return !isBlocked(doCheck(cr, url, host, 'title'));
})());
assert('规则-117: 不匹配的白名单不影响本地黑名单', (() => {
  const cr = makeCR(); addBlDomain(cr, 'example.com', 'wildcard', 'example.com', '本地规则'); addWlDomain(cr, 'other.com', 'wildcard');
  return isBlocked(doCheck(cr, url, host, 'title'));
})());
assert('规则-118: 订阅黑名单 → 屏蔽且来源为订阅', (() => {
  const cr = makeCR(); addBlDomain(cr, 'example.com', 'wildcard', 'example.com', '订阅规则1');
  const r = doCheck(cr, url, host, 'title');
  return isBlocked(r) && getSrc(r) === '订阅规则1';
})());
assert('规则-119: 本地黑名单正常屏蔽', (() => {
  const cr = makeCR(); addBlDomain(cr, 'example.com', 'wildcard', 'example.com', '本地规则');
  const r = doCheck(cr, url, host, 'title');
  return isBlocked(r) && getSrc(r) === '本地规则';
})());
assert('规则-120: 本地和订阅黑名单都匹配时返回本地规则', (() => {
  const cr = makeCR(); addBlDomain(cr, 'example.com', 'wildcard', 'local-domain', '本地规则'); addBlDomain(cr, 'example.com', 'wildcard', 'sub-domain', '订阅规则1');
  const r = doCheck(cr, url, host, 'title');
  return isBlocked(r) && getSrc(r) === '本地规则';
})());
assert('规则-120b: 本地父域白名单优先于订阅更深层白名单', (() => {
  const cr = makeCR();
  addWlDomain(cr, 'good.example.com', 'wildcard', '本地规则');
  addWlDomain(cr, 'sub.good.example.com', 'wildcard', '订阅规则1');
  addBlDomain(cr, 'example.com', 'wildcard', 'example.com', '本地规则');
  const h = 'sub.good.example.com'; api.setCR(cr);
  const r = api.checkRuleMatchOptimized('https://sub.good.example.com/x', h, 'title', '', ['sub.good.example.com', 'good.example.com', 'example.com']);
  return !isBlocked(r) && r.whitelisted === true && getSrc(r) === '本地规则';
})());
assert('规则-120c: 仅订阅白名单时仍取更深层域名', (() => {
  const cr = makeCR();
  addWlDomain(cr, 'good.example.com', 'wildcard', '订阅规则1', 'shallow');
  addWlDomain(cr, 'sub.good.example.com', 'wildcard', '订阅规则1', 'deep');
  const h = 'sub.good.example.com'; api.setCR(cr);
  const r = api.checkRuleMatchOptimized('https://sub.good.example.com/x', h, 'title', '', ['sub.good.example.com', 'good.example.com', 'example.com']);
  return r.whitelisted === true && r.rule === 'deep';
})());
assert('规则-120d: 本地父域条件白名单优先于订阅更深层条件白名单', (() => {
  const cr = makeCR(); const lv = ['sub.good.example.com', 'good.example.com', 'example.com'];
  cr.whitelistConditionalDomains.set('good.example.com', [{ domainType: 'wildcard', conditions: [], source: '本地规则', originalRule: 'lw' }]);
  cr.whitelistConditionalDomains.set('sub.good.example.com', [{ domainType: 'wildcard', conditions: [], source: '订阅规则1', originalRule: 'sw' }]);
  cr.conditionalDomains.set('example.com', [{ domainType: 'wildcard', conditions: [], source: '本地规则', originalRule: 'lb' }]);
  api.setCR(cr);
  const r = api.checkRuleMatchOptimized('https://sub.good.example.com/x', 'sub.good.example.com', 'title', '', lv);
  return !isBlocked(r) && r.whitelisted === true && r.rule === 'lw';
})());
assert('规则-121: 仅订阅URL黑名单可独立屏蔽', (() => {
  const cr = makeCR(); addBlUrl(cr, 'example\\.com/page', 'example.com/page', '订阅规则1');
  const r = doCheck(cr, url, host, 'title');
  return isBlocked(r) && getSrc(r) === '订阅规则1';
})());
assert('规则-122: 本地标题/文本黑名单屏蔽; 订阅文本黑名单屏蔽', (() => {
  const crT = makeCR(); addBlTitle(crT, 'blocked', '标题规则', '本地规则');
  const crX = makeCR(); addBlText(crX, 'blocked', '文本规则', '订阅规则1');
  return isBlocked(doCheck(crT, url, host, 'blocked title')) && isBlocked(doCheck(crX, url, host, 'title', 'blocked snippet')) && getSrc(doCheck(crX, url, host, 'title', 'blocked snippet')) === '订阅规则1';
})());
assert('规则-123: snippet为空时不匹配文本规则', (() => {
  const cr = makeCR(); addBlText(cr, 'something', 'text-rule', '订阅规则1');
  return !isBlocked(doCheck(cr, url, host, 'title', null));
})());
assert('规则-124: 订阅精确域名(exact)匹配自身不匹配其他', (() => {
  const crA = makeCR(); addBlDomain(crA, 'www.example.com', 'exact', 'www.example.com', '订阅规则1');
  const crB = makeCR(); addBlDomain(crB, 'other.com', 'exact', 'other.com', '订阅规则1');
  return isBlocked(doCheck(crA)) && !isBlocked(doCheck(crB));
})());
assert('规则-125: 高亮与屏蔽同时返回; 仅高亮无屏蔽', (() => {
  const crA = makeCR(); crA.highlightDomains.set('example.com', [{ N: 2, type: 'wildcard' }]); addBlDomain(crA, 'example.com', 'wildcard', 'example.com', '本地规则');
  const crB = makeCR(); crB.highlightDomains.set('example.com', [{ N: 3, type: 'wildcard' }]);
  const rA = doCheck(crA), rB = doCheck(crB);
  return rA && rA.highlight === 2 && rA.blocked === true && rB && rB.highlight === 3 && !rB.blocked;
})());
assert('规则-126: 订阅条件黑名单不受语言文案影响', (() => {
  const cr = makeCR();
  cr.conditionalRules.push({ type: 'expr', originalRule: 'host $= ".example.com"', source: '本地文案', isLocal: false, conditions: [] });
  const r = doCheck(cr, url, host, 'title');
  return isBlocked(r) && r.source === '本地文案';
})());
assert('规则-127: 裸域父域TLD级规则经regex回退命中黑名单与白名单', (() => {
  api.setState(['*://*.com/*'], []);
  api.buildRuleIndex();
  const blHit = api.checkRuleMatchOptimized('https://example.com/x', 'example.com', 't', '', ['example.com']);
  api.setState(['@*://*.com/*'], [{ enabled: true, url: 's1', rules: ['ads.com'] }]);
  api.buildRuleIndex();
  const wlHit = api.checkRuleMatchOptimized('https://example.com/x', 'example.com', 't', '', ['example.com', 'ads.com']);
  return blHit && blHit.blocked === true && (!wlHit || wlHit.blocked !== true);
})());
}

// ---- 规则-130~15x: 一键屏蔽规则选项构建 ----
{
const build = new Function(
  SERH_CONSTS.hostPrefixes + '\n' + SERH_CONSTS.pubSuffix + '\n' +
  extractFn(src, 'isPublicSuffixBase') + '\n' + extractFn(src, 'buildBlockRuleOptions') + '\nreturn { buildBlockRuleOptions, isPublicSuffixBase };'
)();
const b = (h) => build.buildBlockRuleOptions(h);

let o = b('abc.example.com');
assert('规则-130: 非常见前缀子域不回退主域', o.isIP === false && o.domainRule === '*://*.abc.example.com/*' && o.exactRule === '*://abc.example.com/*');
o = b('www.example.com');
assert('规则-131: www前缀回退主域', o.domainRule === '*://*.example.com/*' && o.exactRule === '*://www.example.com/*' && o.suffixLike === false);
o = b('m.example.com');
assert('规则-132: m前缀回退主域且忽略大小写', b('M.Example.com').domainRule === '*://*.Example.com/*');
o = b('www3.example.com');
assert('规则-133: wwwN前缀回退主域', o.domainRule === '*://*.example.com/*');
o = b('m.www.example.com');
assert('规则-134: 连续前缀逐级剥离', o.domainRule === '*://*.example.com/*');
o = b('example.com');
assert('规则-135: 裸域域名选项', o.domainRule === '*://*.example.com/*' && o.exactRule === '*://example.com/*');
o = b('1.2.3.4');
assert('规则-136: IP精确与域名同规则', o.isIP === true && o.domainRule === '*://1.2.3.4/*' && o.exactRule === '*://1.2.3.4/*' && o.whitelistRule === '@*://1.2.3.4/*' && o.suffixLike === false);
o = b('1.2.3.256');
assert('规则-137: 越界IP与前导零IP按域名处理', o.isIP === false && b('01.02.03.04').isIP === false);
o = b('');
assert('规则-138: 空域名不崩溃', !!o && o.isIP === false && typeof o.exactRule === 'string');

// 公共后缀回退
o = b('news.bbc.co.uk');
assert('规则-139: 多级子域不回退主域, 仅剥离最外层www', o.domainRule === '*://*.news.bbc.co.uk/*' && b('www.news.bbc.co.uk').domainRule === '*://*.news.bbc.co.uk/*');
o = b('www.co.uk');
assert('规则-140: www.co.uk 域名选项回退完整主机并标记后缀回退', o.domainRule === '*://*.www.co.uk/*' && o.suffixLike === true);
assert('规则-141: www.co.jp 回退完整主机', b('www.co.jp').domainRule === '*://*.www.co.jp/*');
o = b('www.foo.bar');
assert('规则-142: 可注册双标签不回退', o.domainRule === '*://*.foo.bar/*' && o.suffixLike === false);
assert('规则-143: 裸域co.uk不回退', b('example.co.uk').domainRule === '*://*.example.co.uk/*' && b('example.co.uk').suffixLike === false);
assert('规则-144: www+多级主体按注册域剥离', b('www.foo.co.uk').domainRule === '*://*.foo.co.uk/*');
o = b('com');
assert('规则-145: 裸单标签TLD仍标记TLD级', o.tldWide === true && o.domainRule === '*://*.com/*');
o = b('www.com');
assert('规则-146: www单标签回退完整主机且不再标记TLD级', o.tldWide === false && o.domainRule === '*://*.www.com/*');
o = b('m.co.uk');
assert('规则-147: 剥后为裸后缀则回退完整主机', o.domainRule === '*://*.m.co.uk/*' && o.suffixLike === true);
assert('规则-148: m+co.uk主体回退注册域', b('m.example.co.uk').domainRule === '*://*.example.co.uk/*' && b('m.example.co.uk').suffixLike === false);
o = b('www.mysite.co.za');
assert('规则-149: www+co.za注册域剥离', o.domainRule === '*://*.mysite.co.za/*');
assert('规则-150: 非常用后缀不在表内按普通注册域剥离', b('www.co.ke').domainRule === '*://*.co.ke/*' && b('www.co.ke').suffixLike === false);
assert('规则-151: sch.uk 识别为公共后缀', build.isPublicSuffixBase('sch.uk') === true);

// 规则键互异
const getRuleKey = new Function(extractFn(src, 'stripRuleComment') + '\n' + extractFn(src, 'getRuleKey') + '\nreturn getRuleKey;')();
assert('规则-152: 黑名单/白名单/高亮键互异, 尾注释剥离后键一致', getRuleKey('@*://a.com/*') !== getRuleKey('*://a.com/*') && getRuleKey('@1 *://a.com/*') !== getRuleKey('*://a.com/*') && getRuleKey('@1 *://a.com/*') !== getRuleKey('@2 *://a.com/*') && getRuleKey('*://a.com/* #+ note') === getRuleKey('*://a.com/*'));
}

// ---- 规则-160~17x: 校验(空正则/畸形scheme/flags) ----
{
const api = makeRulesApi();
assert('规则-160: 空正则与空白正则判定无效', api.analyzeRule('//').valid === false && api.analyzeRule('/   /').valid === false);
assert('规则-161: 正常正则有效', api.analyzeRule('/abc/').valid === true);
assert('规则-162: **:// 与 *://**.x 判定无效; 路径尾部/**不误伤', api.analyzeRule('**://example.com/*').valid === false && api.analyzeRule('*://**.example.com/*').valid === false && api.analyzeRule('*://*.example.com/**').valid === true);
assert('规则-163: 重复flags判定无效; 合法flags有效', api.analyzeRule('title/x/ii').valid === false && api.analyzeRule('text/x/uu').valid === false && api.analyzeRule('title/x/iu').valid === true);
assert('规则-164: 任意长度尾段含g/y不再静默并入正则', api.analyzeRule('title/x/gim').valid === false && api.analyzeRule('text/x/gyi').valid === false && api.analyzeRule('title/a/b').valid === true);
assert('规则-165: 畸形scheme拒绝; 具体scheme有效', api.analyzeRule('1*://example.com/*').valid === false && api.analyzeRule('http*://example.com/*').valid === false && api.analyzeRule('https://example.com/*').valid === true);
assert('规则-166: title/…/g 非法flags仍拒绝', api.analyzeRule('title/abc/g').valid === false && api.analyzeRule('title/x/gi').valid === false);
assert('规则-167: @@规则被语法拒绝', api.analyzeRule('@@example.com').valid === false);
assert('规则-168: title/…/gi 判定无效并报flags错误; 行尾注释剥离后仍检测', (() => {
  const a = api.analyzeRule('title/.*广告.*/gi');
  const b = api.analyzeRule('title/abc/gi # 注释');
  const err = (a.errors.find((e) => /flags/.test(e)) || '').includes('g');
  return a.valid === false && err && b.valid === false;
})());
assert('规则-169: 全转义斜杠=无闭合界定符按未闭合报错; 带闭合界定符有效', api.analyzeRule('title/https:\\/\\/foo\\/i').valid === false && api.analyzeRule('title/https:\\/\\/foo\\/i/').valid === true);
assert('规则-170: 无空格 @1@*:// 仍报通配无效; 紧贴 @1*:// 仍是合法高亮', api.analyzeRule('@1@*://*.example.com/*').valid === false && api.analyzeRule('@1*://*.example.com/*').valid === true);
assert('规则-171: title/无尾斜杠(含吞@if形态)直接报错', api.analyzeRule('title/abc @if(title *= "x")').valid === false && api.analyzeRule('title/abc/ @if(title *= "x")').valid === true);
assert('规则-172: text尾段误报flags修复', api.analyzeRule('text/example.com/images/png').valid === true);
assert('规则-173: @if 单= 正则带 g flags 报错, 合法 flags 正则仍生效', (() => {
  const bad = api.analyzeRule('*://example.com/* @if(url = /x/g)');
  const good = api.analyzeRule('*://example.com/* @if(url = /x/i)');
  return bad.valid === false && bad.errors.some((e) => /flags/.test(e)) && good.valid === true;
})());
assert('规则-174: @if 单= 重复 flags 与 =~ 未知 flags 均报错而非当字面量', (() => {
  const bad = api.analyzeRule('*://example.com/* @if(title = /foo/ii)');
  const bad2 = api.analyzeRule('*://example.com/* @if(title =~ /foo/z)');
  return bad.valid === false && bad.errors.some((e) => /flags/.test(e)) && bad2.valid === false && bad2.errors.some((e) => /flags/.test(e));
})());
assert('规则-175: 尾部普通字母组合不再误报 flags', api.analyzeRule('title/foo/news').valid === true);
}

// ---- 规则-244~245: @N 前缀大小写与脚本规则后行内注释 ----
{
const api = makeRulesApi();
assert('规则-244: @N 高亮前缀大小写不敏感', (() => {
  api.setState(['@1TITLE/abc/', '@2Text/def/']); api.buildRuleIndex(); const cr = api.getCR();
  return cr.highlightTitles.length === 1 && cr.highlightTexts.length === 1;
})());
assert('规则-245: 脚本规则后的行内##注释被截断, 裸域元素规则不受影响', (() => {
  const strip = new Function(extractFn(src, 'stripRuleComment') + '\nreturn stripRuleComment;')();
  return strip('title/x/ ## n') === 'title/x/' && strip('example.com ##.ad') === 'example.com ##.ad';
})());
// stripRuleComment 保留 @/@N 前缀, 避免误删同核心的白名单/高亮规则
assert('规则-246: stripRuleComment 保留@/@N前缀, @2/@白名单与同核心屏蔽规则不混淆', (() => {
  const strip = new Function(extractFn(src, 'stripRuleComment') + '\nreturn stripRuleComment;')();
  return strip('@2 *://x.com/*') === '@2 *://x.com/*' && strip('@*://x.com/*') === '@*://x.com/*' && strip('*://x.com/*') === '*://x.com/*';
})());
}

// ---- 规则-180~19x: 重定向解包 ----
{
const getCleanUrl = makeCleanUrlApi();
assert('规则-180: 解码 uddg 重定向且只读不回写', (() => {
  const link = { href: 'https://duckduckgo.com/l/?uddg=https%3A%2F%2Ftarget.example.com%2Fpath%3Fa%3D1&rut=xxx' };
  const out = getCleanUrl(link);
  return out === 'https://target.example.com/path?a=1' && link.href.indexOf('uddg=') !== -1;
})());
assert('规则-181: /l 无尾斜杠也解包', getCleanUrl({ href: 'https://duckduckgo.com/l?uddg=https%3A%2F%2Ftarget.example.com%2Fx' }) === 'https://target.example.com/x');
assert('规则-182: scholar_url 解包', getCleanUrl({ href: 'https://scholar.google.com/scholar_url?url=https%3A%2F%2Farxiv.org%2Fabs%2F1234&hl=en' }) === 'https://arxiv.org/abs/1234');
assert('规则-183: google /url 解包', getCleanUrl({ href: 'https://www.google.com/url?q=https%3A%2F%2Fexample.com%2Fa' }) === 'https://example.com/a');
assert('规则-184: yahoo 地区站 RU= 解包', getCleanUrl({ href: 'https://tw.search.yahoo.com/r/RU=https%3A%2F%2Fexample.com%2Fy/RK=2' }) === 'https://example.com/y');
assert('规则-185: yahoo 复杂路径 /RK= 截断与路径保留', getCleanUrl({ href: 'https://search.yahoo.com/r/_ylt=Awr9Il1j/RU=https%3A%2F%2Fexample.com%2Fnested%2Fpath/RK=2/RS=abc123xyz' }) === 'https://example.com/nested/path');
assert('规则-187: yahoo japan 星号与参数解包', getCleanUrl({ href: 'https://rd.yahoo.co.jp/search/web/result/*https://example.jp/page' }) === 'https://example.jp/page' && getCleanUrl({ href: 'https://search.yahoo.co.jp/rd?url=https%3A%2F%2Fstore.yahoo.co.jp%2Fitem' }) === 'https://store.yahoo.co.jp/item');
assert('规则-188: yahoo RU= 参数含 2 字母等号时不被截断', getCleanUrl({ href: 'https://search.yahoo.com/r/RU=https%3A%2F%2Fexample.com%2Fapi%2Fno=123/RK=2/RS=abc123xyz' }) === 'https://example.com/api/no=123');
assert('规则-189: yahoo japan 双星/**-解包', getCleanUrl({ href: 'https://rd.yahoo.co.jp/search/web/result/**-https%3A%2F%2Fexample.jp%2Fpage' }) === 'https://example.jp/page');
assert('规则-190: yahoo 传统 /*-http:// 解包', getCleanUrl({ href: 'https://r.search.yahoo.com/_ylt=abc;_ylu=xyz/RV=2/RE=1/RO=2/*-http://example.com/a' }) === 'http://example.com/a');
assert('规则-191: yahoo 套 yahoo 解到最终结果', getCleanUrl({ href: 'https://r.search.yahoo.com/_ylt=A/RV=1/RU=https%3A%2F%2Fr.search.yahoo.com%2FRV%3D2%2FRU%3Dhttps%253A%252F%252Fexample.com%252Fpage%2FRK%3D2/RK=2/RS=x' }) === 'https://example.com/page');
assert('规则-192: bing ck 套 yahoo RU= 解到最终结果', (() => {
  const bingYahoo = { href: 'https://www.bing.com/ck/a?!&&u=a1' + Buffer.from('https://r.search.yahoo.com/_ylt=A/RU=https%3A%2F%2Fexample.com%2Fpage/RK=2/RS=x').toString('base64url') };
  return getCleanUrl(bingYahoo) === 'https://example.com/page';
})());
assert('规则-193: 非跳转域查询参数不解包', (() => {
  const plain = { href: 'https://example.com/page?ru=https%3A%2F%2Fother.example%2Fx' };
  return getCleanUrl(plain) === plain.href;
})());
const unwrap = new Function(`${ENGINE_HOST_SRC}\n` + ['decodeRedirectTarget', 'decodeBingCkTarget', 'unwrapRedirectUrl', 'isEngineHost'].map((n) => extractFn(src, n)).join('\n') + '\nreturn unwrapRedirectUrl;')();
assert('规则-194: /aclk?adurl 与 /pagead/aclk 解包', unwrap('https://www.google.com/aclk?sa=l&adurl=https%3A%2F%2Fads.example.com%2Fx') === 'https://ads.example.com/x' && unwrap('https://www.google.com/pagead/aclk?adurl=https%3A%2F%2Fads.example.com%2Fy') === 'https://ads.example.com/y');
const opaque = new Function(`${ENGINE_HOST_SRC}\n` + ['decodeRedirectTarget', 'isOpaqueRedirectUrl', 'isEngineHost'].map((n) => extractFn(src, n)).join('\n') + '\nreturn isOpaqueRedirectUrl;')();
const resolveDomain = new Function(`${ENGINE_HOST_SRC}\n` + ['decodeRedirectTarget', 'decodeBingCkTarget', 'unwrapRedirectUrl', 'isOpaqueRedirectUrl', 'getCleanUrl', 'resolveUrlDomain', 'isEngineHost'].map((n) => extractFn(src, n)).join('\n') + '\nconst currentConfig = { removeRedirects: true };\nfunction toASCIIUrl(u) { return u; }\nfunction toASCIIHostname(h) { return h; }\nreturn resolveUrlDomain;')();
const realGotoToken = 'CAESdwHrOzAVviBTh0oG5HfKYOFhyRtw29uZRfju1ROpYoFN1tfC6B8zJfQueB8aSNp2eVjuHmYa_7JCnfQZ1yvAwsuCdGJ7aZ9Xzjl_kWh6hOo4Q_HrKX1C4fqKyX-fE5A1ehwz3w0ml64RCxA8QFWwLII6XEe1HIgI';
const realGoto = 'https://www.google.com/goto?url=' + realGotoToken;
assert('规则-195: goto CAES 原样返回且判为不透明', unwrap(realGoto) === realGoto && opaque(realGoto) === true);
assert('规则-196: /url 无目标参数判为不透明而明文参数不判', unwrap('https://www.google.com/url?sa=t') === 'https://www.google.com/url?sa=t' && opaque('https://www.google.com/url?sa=t') === true && opaque('https://www.google.com/url?q=https%3A%2F%2Fexample.com%2Fa') === false);
assert('规则-197: goto 明文参数仍解包且非不透明', unwrap('https://www.google.com/goto?url=https%3A%2F%2Fexample.com%2Fpage') === 'https://example.com/page' && opaque('https://www.google.com/goto?url=https%3A%2F%2Fexample.com%2Fpage') === false && opaque('https://example.com/?u=https%3A%2F%2Fother.example%2F') === false);
assert('规则-198: 不透明重定向域名置空且可解包链接域名保留', (() => {
  const a = resolveDomain({ href: realGoto });
  const b = resolveDomain({ href: 'https://www.google.com/url?q=https%3A%2F%2Fexample.com%2Fa' });
  return a.domain === '' && a.url.indexOf('goto?url=CAES') !== -1 && b.domain === 'example.com';
})());
}

// ==== 二、修复回归 ====

// ---- 规则-200~22x: 导入取消 / ScriptConfig头 / 垃圾文本拒绝 ----
await (async () => {
const parseSyncHeaderFn = extractFn(src, 'parseSyncHeader');
const getSyncSettingsFn = extractFn(src, 'getSyncSettings');
const importRulesFromFileFn = extractFn(src, 'importRulesFromFile');
const pickTextFileFn = extractFn(src, 'pickTextFile');
const cfgDefaults = src.match(/const CFG_DEFAULTS = \{[^\n]+\};/)[0];
const defHl = src.match(/const DEFAULT_HIGHLIGHT_COLORS = \{[^\n]+\};/)[0];
const normalizeConfigFn = extractFn(src, 'normalizeConfig');
const stripRuleCommentFn = extractFn(src, 'stripRuleComment');
function createEnv(initRules) {
  const env = { bodyChildren: [], windowListeners: {}, textarea: { value: '' }, hooks: { updateLineNumbersCalls: 0, written: [] } };
  const fakeInput = {
    type: '', accept: '', style: {}, files: [], parentElement: null, onchange: null, listeners: {},
    addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); },
    remove() { const idx = env.bodyChildren.indexOf(this); if (idx !== -1) env.bodyChildren.splice(idx, 1); this.parentElement = null; },
    click() {},
  };
  const documentStub = {
    body: { appendChild(el) { el.parentElement = documentStub.body; env.bodyChildren.push(el); return el; } },
    createElement(tag) { return tag === 'input' ? fakeInput : {}; },
    getElementById(id) { return id === 'serh-rules' ? env.textarea : null; },
  };
  const windowStub = {
    addEventListener(type, fn) { (env.windowListeners[type] = env.windowListeners[type] || []).push(fn); },
    removeEventListener(type, fn) { const arr = env.windowListeners[type] || []; const idx = arr.indexOf(fn); if (idx !== -1) arr.splice(idx, 1); },
  };
  class FakeFileReader {
    readAsText(f) { this.result = f._content; if (this.onload) this.onload({ target: this }); }
  }
  const factory = new Function('document', 'window', 'FileReader', 'currentConfig', 'hooks', `
    let preventPanelClose = false;
    ${parseSyncHeaderFn}
    ${getSyncSettingsFn}
    ${extractFn(src, 'isNonRuleTextResponse')}
    ${extractFn(src, 'isCondExprCore')}
    ${extractFn(src, 'looksLikeCondExpr')}
    function showToast() {}
    function t(key) { return key; }
    let confirmAnswer = null; let confirmCalls = 0; hooks.confirmMessages = hooks.confirmMessages || [];
    function confirm(msg) { confirmCalls++; hooks.confirmMessages.push(msg); return confirmAnswer === null ? true : confirmAnswer; }
    hooks.getConfirmCalls = () => confirmCalls; hooks.setConfirmAnswer = (v) => { confirmAnswer = v; };
    function validateRule(rule) { const s = String(rule).trim(); return s.length > 0 && !/\s/.test(s); }
    function filterValidRuleLines(lines) { return lines.map((l) => l.trim()).filter((l) => l.length > 0); }
    ${stripRuleCommentFn}
    ${extractFn(src, 'hasEffectiveRules')}
    ${pickTextFileFn}
    function updateLineNumbers() { hooks.updateLineNumbersCalls++; }
    function GM_setValue(key, val) { hooks.written.push({ key, val }); }
    function forceReprocessAll() { hooks.reprocessCalls = (hooks.reprocessCalls || 0) + 1; }
    function getDefaultConfig() { return { rules: [], enabled: true, language: 'zh-CN', showBubble: true, bubbleSize: 30, debug: false, subscriptionAutoUpdate: false, bubbleAction: 'openPanel', highlightColors: {} }; }
    function persistConfig(mark) { hooks.persistCalls = (hooks.persistCalls || 0) + 1; hooks.persistMark = mark; GM_setValue('searchfilter_blocker', currentConfig); }
    function applyConfigToMainPanel() { hooks.applyCalls = (hooks.applyCalls || 0) + 1; }
    const SELECTORS_KEY = 'searchfilter_selectors';
    const SELECTORS_LAST_MODIFIED_KEY = 'searchfilter_selectors_last_modified';
    function markLocalModifiedTime(key) { GM_setValue(key || 'searchfilter_local_last_modified', 1000000); }
    function getSelectorsModifiedTime() { return 0; }
    let _selectorStoreTime = null;
    function getSelectorStoreSignature() { return 'sig'; }
    function resetSelectorCache() { hooks.resetSelectorCalls = (hooks.resetSelectorCalls || 0) + 1; }
    function refreshEngineSite() { hooks.refreshCalls = (hooks.refreshCalls || 0) + 1; }
    ${cfgDefaults}
    ${defHl}
    ${normalizeConfigFn}
    ${extractFn(src, 'exportSubscriptionList')}
    ${extractFn(src, 'applyImportedSubscriptions')}
    let subscriptionStore = [];
    function getSubscriptions() { return subscriptionStore; }
    function saveSubscriptions(subs) { subscriptionStore = subs; hooks.subsSaved = subs; }
    function setSubscriptionSyncSnapshot(subs) { hooks.subsSnapshot = subs.map((s) => ({ url: s.url, name: s.name, enabled: s.enabled !== false })); }
    function checkAutoSubscription() { hooks.autoSub = (hooks.autoSub || 0) + 1; }
    ${importRulesFromFileFn}
    return { importRulesFromFile, exportSubscriptionList, applyImportedSubscriptions, setSubscriptions: (s) => { subscriptionStore = s; }, getSubscriptions, isPreventPanelClose: () => preventPanelClose };
  `);
  const api = factory(documentStub, windowStub, FakeFileReader, { debug: false, subscriptionAutoUpdate: true, rules: initRules || [], highlightColors: {1:'#112233', 2:'#FF8C00'} }, env.hooks);
  return { env, api, fakeInput };
}

// cancel 事件与焦点回落解锁
{
  const { env, api, fakeInput } = createEnv();
  api.importRulesFromFile();
  assert('规则-200: 打开选择器后锁定面板关闭', api.isPreventPanelClose() === true);
  fakeInput.listeners.cancel[0]();
  assert('规则-201: cancel 事件后解锁', api.isPreventPanelClose() === false);
}

// 正常选择文件
{
  const { env, api, fakeInput } = createEnv();
  api.importRulesFromFile();
  fakeInput.files = [{ _content: 'rule1\nrule2' }];
  fakeInput.onchange({ target: fakeInput });
  assert('规则-202: 文件内容写入编辑区并解锁', env.textarea.value === 'rule1\nrule2' && api.isPreventPanelClose() === false);
}

// TXT导入读取 # ScriptConfig 头并应用设置
{
  const { env, api, fakeInput } = createEnv();
  api.importRulesFromFile();
  fakeInput.files = [{ _content: '# ScriptConfig: {"language":"en-US","showBubble":false,"syncedAt":123,"rulesSyncedAt":456,"bubbleState":{"x":1},"bubbleSize":99,"selectors":{"bing":{"match":"a"}}}\nrule1' }];
  fakeInput.onchange({ target: fakeInput });
  const saved = env.hooks.written[0] && env.hooks.written[0].val;
  assert('规则-203: TXT导入只覆盖头里出现的键, 时间戳/气泡本地态/选择器不随导入, 正文规则同时落盘', env.hooks.written.length === 1 && saved.language === 'en-US' && saved.showBubble === false && saved.subscriptionAutoUpdate === true && saved.enabled === true && saved.bubbleAction === 'openPanel' && saved.syncedAt === undefined && saved.rulesSyncedAt === undefined && saved.bubbleState === undefined && saved.bubbleSize === 30 && saved.selectors === undefined && saved.rules.join() === 'rule1');
  assert('规则-204: 头行剥离后规则写入编辑区并立即保存, 面板刷新与重处理各一次', env.textarea.value === 'rule1' && env.hooks.persistCalls === 1 && env.hooks.persistMark === true && env.hooks.applyCalls === 1 && env.hooks.reprocessCalls === 1 && env.hooks.updateLineNumbersCalls === 1);
}

// 颜色按键合并
{
  const { env, api, fakeInput } = createEnv();
  api.importRulesFromFile();
  const header = JSON.stringify({ language: 'zh-CN', showBubble: true, exportConfig: true, highlightColors: {1:'#112233'} });
  fakeInput.files = [{ _content: '# ScriptConfig:' + header + '\nrule1' }];
  fakeInput.onchange({ target: fakeInput });
  const saved = env.hooks.written[0] && env.hooks.written[0].val;
  assert('规则-206: 导入只覆盖头里出现的键, 颜色按键合并', !!saved && saved.subscriptionAutoUpdate === true && saved.exportConfig === true && saved.highlightColors[1] === '#112233' && saved.highlightColors[2] === '#FF8C00' && saved.rules.join() === 'rule1');
}

// # Selectors 头
{
  const { env, api, fakeInput } = createEnv();
  api.importRulesFromFile();
  fakeInput.files = [{ _content: '# Selectors: {"bing":{"containers":".x"}}\n# ScriptConfig: {"language":"en-US"}\nrule1' }];
  fakeInput.onchange({ target: fakeInput });
  assert('规则-207: TXT导入应用# Selectors头选择器并标记选择器修改时间', env.hooks.written.length === 3 && env.hooks.written[0].key === 'searchfilter_selectors' && env.hooks.written[0].val.bing.containers === '.x' && env.hooks.written[1].key === 'searchfilter_selectors_last_modified' && env.hooks.written[2].key === 'searchfilter_blocker' && env.hooks.written[2].val.language === 'en-US' && env.hooks.refreshCalls === 1);
}
{
  const { env, api, fakeInput } = createEnv();
  api.importRulesFromFile();
  fakeInput.files = [{ _content: '# ScriptConfig: {"selectors":{"bing":{"match":"a"}}}\nrule1' }];
  fakeInput.onchange({ target: fakeInput });
  assert('规则-208: 无# Selectors行时内嵌selectors不应用', env.hooks.written.length === 1 && env.hooks.written[0].key === 'searchfilter_blocker' && env.hooks.refreshCalls === undefined);
}

// 垃圾文本导入拒绝
{
  const { env, api, fakeInput } = createEnv();
  api.importRulesFromFile();
  fakeInput.files = [{ _content: 'Lorem ipsum dolor sit amet\nConsectetur adipiscing elit' }];
  fakeInput.onchange({ target: fakeInput });
  assert('规则-209: 无头垃圾文本导入被拒绝', env.textarea.value === '' && env.hooks.written.length === 0 && env.hooks.persistCalls === undefined);
}
{
  const { env, api, fakeInput } = createEnv();
  api.importRulesFromFile();
  fakeInput.files = [{ _content: '<!DOCTYPE html><html><body>Cloud Error</body></html>' }];
  fakeInput.onchange({ target: fakeInput });
  assert('规则-210: HTML备份文件导入被拒绝', env.textarea.value === '' && env.hooks.written.length === 0);
}
{
  const { env, api, fakeInput } = createEnv();
  api.importRulesFromFile();
  fakeInput.files = [{ _content: '# ScriptConfig: {"language":"en-US"}\nLorem ipsum dolor sit amet\nConsectetur adipiscing elit' }];
  fakeInput.onchange({ target: fakeInput });
  assert('规则-211: 有配置头但正文全是垃圾文本也被拒绝', env.textarea.value === '' && env.hooks.written.length === 0 && env.hooks.applyCalls === undefined);
}

// 空规则文件导入清空前需确认(修复留档)
{
  const { env, api, fakeInput } = createEnv(['old.com']);
  api.importRulesFromFile();
  env.hooks.setConfirmAnswer(false);
  fakeInput.files = [{ _content: '\n\n' }];
  fakeInput.onchange({ target: fakeInput });
  assert('规则-221: 本地有规则时导入无规则文件弹确认且取消不动配置', env.hooks.getConfirmCalls() === 1 && env.hooks.written.length === 0 && env.hooks.persistCalls === undefined && env.textarea.value === '' && api.isPreventPanelClose() === false);
}
{
  const { env, api, fakeInput } = createEnv(['old.com']);
  api.importRulesFromFile();
  env.hooks.setConfirmAnswer(true);
  fakeInput.files = [{ _content: '' }];
  fakeInput.onchange({ target: fakeInput });
  const saved = env.hooks.written[0] && env.hooks.written[0].val;
  assert('规则-222: 确认后空规则文件清空本地规则并落盘', env.hooks.getConfirmCalls() === 1 && env.hooks.persistCalls === 1 && saved.rules.length === 0);
}
{
  const { env, api, fakeInput } = createEnv([]);
  api.importRulesFromFile();
  fakeInput.files = [{ _content: '' }];
  fakeInput.onchange({ target: fakeInput });
  assert('规则-223: 本地无规则时导入空文件不再弹确认', env.hooks.getConfirmCalls() === 0 && env.hooks.persistCalls === 1);
}
{
  const { env, api, fakeInput } = createEnv(['old.com']);
  api.importRulesFromFile();
  env.hooks.setConfirmAnswer(false);
  fakeInput.files = [{ _content: '# title: my rules\n# author: me' }];
  fakeInput.onchange({ target: fakeInput });
  assert('规则-256: 纯注释文件导入按无有效规则处理并弹清空确认', env.hooks.getConfirmCalls() === 1 && env.hooks.written.length === 0 && env.hooks.persistCalls === undefined);
}

// 订阅随脚本配置导出/导入
{
  const { api } = createEnv();
  api.setSubscriptions([{ url: 'https://a/x', name: 'A', enabled: true, rules: ['r1'], lastUpdate: 5 }]);
  assert('规则-218: 导出配置携带订阅清单且不含本地规则', JSON.stringify(api.exportSubscriptionList()) === JSON.stringify([{ url: 'https://a/x', name: 'A', enabled: true }]));
  const added = api.applyImportedSubscriptions([{ url: 'https://a/x', name: 'A2' }, { url: 'https://b/y', enabled: false }]);
  const subs = api.getSubscriptions();
  assert('规则-219: 导入合并订阅保留本地规则并记录新增数', added === 1 && subs.length === 2 && subs.find((s) => s.url === 'https://a/x').rules.join() === 'r1' && subs.find((s) => s.url === 'https://a/x').name === 'A2' && subs.find((s) => s.url === 'https://b/y').enabled === false);
}
{
  const { env, api, fakeInput } = createEnv();
  api.importRulesFromFile();
  fakeInput.files = [{ _content: '# ScriptConfig: {"language":"en-US","subscriptions":[{"url":"https://s/1","name":"S1","enabled":true}]}\nrule1' }];
  fakeInput.onchange({ target: fakeInput });
  assert('规则-220: TXT导入脚本配置内的订阅被恢复', !!env.hooks.subsSaved && env.hooks.subsSaved.length === 1 && env.hooks.subsSaved[0].url === 'https://s/1' && env.textarea.value === 'rule1');
}

// 同步头解析(仅剥离头行, 其余#注释保留)
{
  const run = (content) => new Function('currentConfig', 'console', `${parseSyncHeaderFn}\nreturn parseSyncHeader;`)({ debug: false }, { warn: () => {} })(content);
  let r = run('# uBlacklist backup rules\n# ScriptConfig: {"a":1}\nrule1');
  assert('规则-212: 头前用户注释保留且头仍被解析', r.restLines.join('\n') === '# uBlacklist backup rules\nrule1' && !!r.config && r.config.a === 1);
  r = run('# ScriptConfig: {"a":1}\n# 我的分组注释\n# Selectors: []\nrule1');
  assert('规则-213: 两头之间的注释保留, Selectors 头解析并合入', r.restLines.join('\n') === '# 我的分组注释\nrule1' && Array.isArray(r.config.selectors));
  r = run('# ScriptConfig: {"a":1}\n# Selectors: {"bing":{"match":"a","containers":".x","extraElements":["[data-e=\\"a,b\\"]"]}}\nrule1');
  assert('规则-213b: Selectors头允许引号内逗号', !!r.config && r.config.selectors.bing.extraElements[0] === '[data-e="a,b"]');
  r = run('# ScriptConfig: {"a":1}\n# ScriptConfig: {"b":2}\nrule1');
  assert('规则-214: 重复头取首个, 后部伪头按注释保留正文', r.config.a === 1 && r.config.b === undefined && r.restLines.join('\n') === '# ScriptConfig: {"b":2}\nrule1');
  r = run('# ScriptConfig:{"syncedAt":12\nrule1');
  assert('规则-215: JSON截断头行剔除出 restLines 且不重发', r.config === null && r.rawScriptConfig === null && r.restLines.join('\n') === 'rule1');
  r = run('\uFEFF# title: my rules\n# author: me\n*://bad.example.com/*');
  assert('规则-216: 无头纯注释文件原样保留(BOM)', r.restLines.join('\n') === '# title: my rules\n# author: me\n*://bad.example.com/*' && !r.config);
}
})();

// ---- 规则-230~24x: 三方合并 ----
{
const mergeApi = new Function(SERH_FN_DEPS + '\n' + SERH_RAW_EXTRACT(src, 'stripRuleComment') + '\n' + SERH_RAW_EXTRACT(src, 'getRuleKey') + '\n' + SERH_RAW_EXTRACT(src, 'mergeRules3Way') + '\nreturn mergeRules3Way;')();
const B_OLD = '*://b.com/* # old', B_NEW = '*://b.com/* # new';
assert('规则-230: 一方移动+删规则, 他方仅改其行尾注释 → 修改保留且追加尾部不乱序', JSON.stringify(mergeApi(['A', B_OLD, 'C'], ['C', 'A'], ['A', B_NEW, 'C'])) === JSON.stringify(['C', 'A', B_NEW]));
assert('规则-231: 单方移动 → 合并保持移动方顺序', JSON.stringify(mergeApi(['A', 'B', 'C', 'D'], ['C', 'A', 'B', 'D'], ['A', 'B', 'C', 'D'])) === JSON.stringify(['C', 'A', 'B', 'D']));
assert('规则-232: 单方插入 → 新规则锚定原位', JSON.stringify(mergeApi(['A', 'B', 'C'], ['A', 'X', 'B', 'C'], ['A', 'B', 'C'])) === JSON.stringify(['A', 'X', 'B', 'C']));
assert('规则-233: 无移动 → 他方修改在原位保留', JSON.stringify(mergeApi(['A', B_OLD, 'C'], ['A', 'C'], ['A', B_NEW, 'C'])) === JSON.stringify(['A', B_NEW, 'C']));
}

// ---- 规则-240~24x: 元素规则与注释剥离边界 ----
{
const api = makeRulesApi();
assert('规则-240: 带空格元素规则不被截断成裸域且报不支持', (() => {
  const stripped = api.analyzeRule('example.com ##.ad');
  return stripped.valid === false && stripped.errors.some((e) => /元素规则/.test(e));
})());
assert('规则-241: 含##的脚本URL与正则规则仍有效', api.analyzeRule('*://example.com/page##x').valid === true && api.analyzeRule('title/.*##.*/i').valid === true);
assert('规则-242: 行尾注释剥离与引号内#不受影响', (() => {
  const strip = new Function(extractFn(src, 'stripRuleComment') + '\nreturn stripRuleComment;')();
  return strip('example.com # 注释') === 'example.com' && strip('example.com # ##x') === 'example.com' && strip('*://x.com/* @if(title *= "a # b") # note') === '*://x.com/* @if(title *= "a # b")' && strip('example.com ##.ad') === 'example.com ##.ad';
})());
assert('规则-243: 带空格元素规则不产生整站屏蔽, 裸域规则仍屏蔽', (() => {
  const blocked = (rules) => {
    api.setState(rules); api.buildRuleIndex();
    const hit = api.checkRuleMatchOptimized('https://example.com/page', 'example.com', '任意标题', '摘要', ['example.com']);
    return !!(hit && hit.blocked === true);
  };
  return blocked(['example.com ##.ad']) === false && blocked(['example.com']) === true;
})());
}

// ---- 规则-250~25x: 订阅规则类型守卫 / YAML探测回退 ----
{
const api = makeRulesApi();
api.setState(['*://local.example.com/*'], [{ enabled: true, url: 'https://x/y.yaml', rules: [123, 'ok.com'] }]);
let threw = null;
try { api.buildRuleIndex(); } catch (e) { threw = e; }
const cr = api.getCR();
assert('规则-250: 非字符串规则项被类型守卫跳过, 后续订阅规则正常入库', threw === null && cr.domains.has('local.example.com') === true && cr.domains.has('ok.com') === true && typeof cr.indexSignature === 'string');

const plainApi = new Function('function t(k) { return k; }\nconst currentConfig = { debug: false };\n' +
  extractFn(src, 'extractYamlRuleItems') + '\n' + extractFn(src, 'parseRulesetContent') + '\nreturn parseRulesetContent;')();
assert('规则-251: YAML探测命中但未解析出列表段时回退纯文本', (() => {
  const a = plainApi('name: My personal list\n*://*.ads.com/*\nexample.com\n');
  const b = plainApi('title: My list\n*://*.ads.com/*\n');
  return a.lines.filter((l) => l.trim()).length === 3 && b.lines.filter((l) => l.trim()).length === 2;
})());
// 标量引号仅在起始处生效, 中部撇号不吞注释与后续段
assert('规则-252: flow值中部撇号+尾注释不吞后文段落', (() => {
  const r = plainApi("rules: [bob's.com, x.com] # don't\nwhitelist:\n  - d.com\n...\n@@|https://x.com/p[1]\n");
  return JSON.stringify(r.lines) === JSON.stringify(["bob's.com", 'x.com', '@d.com']);
})());
assert('规则-253: 引号包裹#的项保留且中部撇号项按逗号拆分', (() => {
  const r = plainApi('rules: ["a # b", c\'s.com]\n');
  return JSON.stringify(r.lines) === JSON.stringify(['a # b', "c's.com"]);
})());
}

// ---- 规则-254~25x: @N 与 @if 紧贴写法修复留档 ----
{
const api = makeRulesApi();
api.setState(['@2@if(title *= "kw")', '@1 @if(title *= "x")'], []); api.buildRuleIndex();
const cr = api.getCR();
assert('规则-254: @N@if(...) 无空格与有空格等价, 归入高亮条件表达式而非被整条拒绝', cr.highlightConditionalRules.some(e => e.N === 2 && e.type === 'expr' && e.conditions.length === 1) && cr.whitelistConditionalRules.length === 0 && api.validateRule('@2@if(title *= "kw")') === true);
assert('规则-255: @N@*:// 无空格仍被拒绝(设计保留, 见规则-170), @N*:// 不受影响', api.analyzeRule('@1@*://*.example.com/*').valid === false && api.analyzeRule('@1*://*.example.com/*').valid === true);
}

// ---- 规则-258~261: Lite 导出/导入脚本配置 ----
{
const liteSrc = fs.readFileSync(path.join(scriptDir, 'Lite.user.js'), 'utf8');
const liteDefaults = liteSrc.match(/const CFG_DEFAULTS = \{[^\n]+\};/)[0];
const liteColors = liteSrc.match(/const DEFAULT_HIGHLIGHT_COLORS = \{[^\n]+\};/)[0];
const liteCfgApi = new Function(`
${liteDefaults}
${liteColors}
let currentConfig = normalizeConfig({ rules: ['*://local.example.com/*'], enabled: true, language: 'zh-CN' });
${SERH_RAW_EXTRACT(liteSrc, 'normalizeConfig')}
${SERH_RAW_EXTRACT(liteSrc, 'parseConfigHeader')}
${SERH_RAW_EXTRACT(liteSrc, 'applyImportedSettings')}
${SERH_RAW_EXTRACT(liteSrc, 'getExportSettings')}
return { parse: parseConfigHeader, apply: applyImportedSettings, exportSettings: getExportSettings, get: () => currentConfig };
`)();
const parsed = liteCfgApi.parse(['# ScriptConfig:{"language":"en","enabled":false,"rules":["ignored"]}', '*://x/*']);
assert('规则-258: Lite 配置头被剥离且正文规则保留', parsed.settings.language === 'en' && parsed.rest.join('\n') === '*://x/*');
liteCfgApi.apply(parsed.settings);
const applied = liteCfgApi.get();
assert('规则-259: Lite 导入只应用白名单设置且不覆盖本地规则', applied.language === 'en' && applied.enabled === false && applied.rules.join('|') === '*://local.example.com/*');
// 忽略该问题: Lite导入主版配置时残留 # Selectors 头行，此为保留设计
const exported = liteCfgApi.exportSettings({ ...applied, rules: ['r'], bubbleSize: 40, bubbleState: {}, selectors: {} });
assert('规则-260: Lite 导出设置剔除规则/气泡/选择器', exported.rules === undefined && exported.bubbleSize === undefined && exported.bubbleState === undefined && exported.selectors === undefined && exported.language === 'en');
let downloaded = '';
const liteExport = new Function('currentConfig', 'document', 'downloadTextFile', 't', 'showToast', 'timestampFilename', `
let preventPanelClose = false;
${SERH_RAW_EXTRACT(liteSrc, 'getExportSettings')}
${SERH_RAW_EXTRACT(liteSrc, 'exportRulesToFile')}
return exportRulesToFile;
`)({ exportConfig: true, rules: ['*://x/*'], language: 'en' }, { getElementById: () => ({ value: '*://x/*' }) }, (name, content) => { downloaded = content; }, (k) => k, () => {}, () => 'rules.txt');
liteExport();
assert('规则-261: Lite 导出配置开关生效且配置头不含规则', downloaded.startsWith('# ScriptConfig:{"') && downloaded.includes('"language":"en"') && downloaded.endsWith('\n*://x/*') && !downloaded.slice(0, downloaded.indexOf('\n')).includes('*://x/*'));
}

// ---- 规则-262~263: Lite 导入垃圾文本拒绝 ----
{
const liteSrc = fs.readFileSync(path.join(scriptDir, 'Lite.user.js'), 'utf8');
const config = { rules: ['*://local.example.com/*'], enabled: true };
let picked = null, persisted = 0, toasts = [];
const importFn = new Function('currentConfig', 'pickTextFile', 'document', 'showToast', 't', 'confirm', 'persistConfig', 'applyConfigToMainPanel', 'forceReprocessAll', 'updateLineNumbers', `
  function validateRule(rule) { const s = String(rule).trim(); return /^[\\x21-\\x7E]+$/.test(s) && /[:@|./]/.test(s) && !/\\s/.test(s); }
  function looksLikeCondExpr() { return false; }
  function stripRuleComment(line) { return String(line).replace(/\\s+#.*$/, ''); }
  function hasEffectiveRules(lines) { return lines.some(l => l.trim() && !l.trim().startsWith('#')); }
  function filterValidRuleLines(lines) { return lines.map(l => l.trim()).filter(l => l.length > 0); }
  ${SERH_RAW_EXTRACT(liteSrc, 'isNonRuleTextResponse')}
  ${SERH_RAW_EXTRACT(liteSrc, 'parseConfigHeader')}
  function applyImportedSettings() {}
  ${SERH_RAW_EXTRACT(liteSrc, 'importRulesFromFile')}
  return importRulesFromFile;
`)(config, (accept, cb) => { picked = cb; }, { getElementById: (id) => id === 'serh-rules' ? { value: '' } : null }, (msg, type) => toasts.push([msg, type]), (k) => k, () => true, () => { persisted++; }, () => {}, () => {}, () => {});
importFn(); picked('这是一段普通说明文字，不是规则。');
assert('规则-262: Lite 导入垃圾文本不静默清空规则', config.rules.length === 1 && persisted === 0 && toasts.length === 1, { rules: config.rules, persisted, toasts });
importFn(); picked('*://example.com/*');
assert('规则-263: Lite 正常规则文本仍可导入', config.rules.join('|') === '*://example.com/*' && persisted === 1, { rules: config.rules, persisted });
}

// 易错: 优先级依赖规则拼接顺序, getRuleKey 以去注释正文为键会合并重复行

// 忽略该问题: 面板关闭会连带 Toast ，此为故意设计
// 留档: ⬆️在第一行/第一个注释行时跳到最后一行是文档(README 1.5-3)原有设计, 非bug; 最后一个注释行即最后一个规则行, 不会误报
console.log('[存档] 忽略该问题: 面板关闭会连带 Toast ，此为故意设计');
console.log('[存档] ⬆️回绕到最后一行是文档原有设计, 最后一个注释行即最后一个规则行');
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

})();
