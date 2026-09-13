// 规则: 通配符转义与正则标志 / 规则过滤 / 规则来源标记 / 优先级 / 导入取消
// 由功能相近的测试文件合并而成: test-regex.cjs, test-rule-filter.cjs, test-rule-source.cjs, test-priority.cjs, test-import-cancel.cjs
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

// ==== 来源: test-regex.cjs ====
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
assert('W1: a+b 匹配字面量 a+b', match('*://example.com/a+b/*', 'https://example.com/a+b/'));
assert('W2: a+b 不匹配 ab', !match('*://example.com/a+b/*', 'https://example.com/ab/'));
assert('W3: (x) 匹配字面量 (x)', match('*://example.com/(x)/*', 'https://example.com/(x)/'));
assert('W4: [x] 匹配字面量 [x]', match('*://example.com/[x]/*', 'https://example.com/[x]/'));
assert('W5: {2} 匹配字面量 {2}', match('*://example.com/a{2}/*', 'https://example.com/a{2}/'));
assert('W6: a|b 匹配字面量 a|b', match('*://example.com/a|b/*', 'https://example.com/a|b/'));
assert('W7: a^b 匹配字面量 a^b', match('*://example.com/a^b/*', 'https://example.com/a^b/'));
assert('W8: a$b 匹配字面量 a$b', match('*://example.com/a$b/*', 'https://example.com/a$b/'));
assert('W9: 路径点号转义(file.txt 不匹配 filextxt)', !match('*://example.com/file.txt', 'https://example.com/filextxt'));
assert('W10: 路径点号正常匹配(file.txt)', match('*://example.com/file.txt', 'https://example.com/file.txt'));

// 原有规则回退
assert('W11: *.example.com 匹配子域', match('*://*.example.com/*', 'https://foo.example.com/x'));
assert('W12: example.com 不匹配 exampleXcom', !match('*://example.com/*', 'https://exampleXcom/'));
assert('W13: 星号仍为通配', match('*://example.com/a/*/b', 'https://example.com/a/xyz/b'));
assert('W14: 问号为字面量', match('*://example.com/a?b', 'https://example.com/a?b'));
assert('W15: 问号不是单字符通配', !match('*://example.com/a?b', 'https://example.com/axb'));
assert('W16: 保留用户转义点', match('*://example\\.com/*', 'https://example.com/'));
assert('W17: 显式 scheme 可用', match('https://example.com/*', 'https://example.com/x'));
assert('W18: 无斜杠模式点号转义', !api.safeRegexTest(new RegExp(api.wildcardToRegex('example.com')), 'exampleXcom'));
assert('W18a: 中文域名通配匹配 punycode', match('*://*.例子.com/*', 'https://xn--fsqu00a.com/x'));
assert('W18b: 中文域名简写匹配 punycode', match('例子.com', 'https://xn--fsqu00a.com/'));
assert('W18c: 中文域名路径规则匹配 punycode', match('*://*.例子.com/path/*', 'https://xn--fsqu00a.com/path/x'));

// 锚定与通配范围
assert('W19: 路径模式匹配自身', match('*://example.com/path/*', 'https://example.com/path/x'));
assert('W20: 路径模式匹配 http', match('*://example.com/path/*', 'http://example.com/path/x'));
assert('W21: 路径模式不匹配 query 中的伪 URL', !match('*://example.com/path/*', 'https://evil.com/?u=example.com/path/'));
assert('W22: 路径模式不匹配前缀域名', !match('*://example.com/path/*', 'https://evil.com/example.com/path/x'));
assert('W23: 主机通配不跨越路径', !match('*://*.example.com/path/*', 'https://evil.com/x.example.com/path/'));
assert('W24: 主机通配仍匹配多级子域', match('*://*.example.com/path/*', 'https://a.b.example.com/path/x'));
assert('W25: 显式 scheme 不匹配其他 scheme', !match('https://example.com/*', 'http://example.com/'));
assert('W26: 无 scheme 通配仍可用', match('*example*', 'https://any.example.org/x'));

// 裸域匹配(apex)
assert('W27: 裸域名规则匹配裸域', match('example.com', 'https://example.com/'));
assert('W28: 裸域名规则匹配子域', match('example.com', 'https://www.example.com/'));
assert('W29: *.路径模式匹配裸域', match('*://*.example.com/path/*', 'https://example.com/path/x'));
assert('W30: *.无路径模式匹配裸域', match('*://*.example.com/*', 'https://example.com/'));
assert('W31: *.顶级域通配匹配裸域', match('*://*.example.*', 'https://example.com/'));
assert('W32: 精确域名规则不匹配子域', !match('*://example.com/*', 'https://www.example.com/'));

// 无scheme主机语义与无路径边界
assert('W33: 无scheme *.域 匹配子域', match('*.example.com', 'https://foo.example.com/x'));
assert('W34: 无scheme *.域 匹配裸域', match('*.example.com', 'https://example.com/'));
assert('W35: 无scheme *.域 不匹配前缀域名', !match('*.example.com', 'https://notexample.com/'));
assert('W36: 无scheme *.域 不匹配其他站路径', !match('*.example.com', 'https://evil.com/?u=example.com'));
assert('W37: 无scheme *.域 直接匹配域名输入', match('*.example.com', 'sub.example.com'));
assert('W38: 无路径规则匹配自身', match('*://example.com', 'https://example.com/'));
assert('W39: 无路径规则匹配子路径', match('*://example.com', 'https://example.com/path/x'));
assert('W40: 无路径规则不匹配后缀域名', !match('*://example.com', 'https://example.com.evil.com/'));
assert('W41: 无路径规则匹配子域与端口', match('*://*.example.com', 'https://a.example.com:8080/'));
assert('W42: 无scheme 路径规则按主机匹配首段', match('*.example.com/path/*', 'https://sub.example.com/path/x'));
assert('W43: 无scheme 路径规则不匹配其他站路径', !match('*.example.com/path/*', 'https://evil.com/x/example.com/path/y'));
assert('W44: 精确路径模式不误匹配同名前缀路径', !match('*://example.com/test', 'https://example.com/testing-other'));
assert('W45: 精确路径模式匹配自身及子路径', match('*://example.com/test', 'https://example.com/test') && match('*://example.com/test', 'https://example.com/test/sub'));

// ---- 正则 s 标志 ----
assert('S1: title 转义点 + s 正常匹配', match('title/example\\.com/s', 'example.com'));
assert('S2: text 转义点 + s 正常匹配', match('text/example\\.com/s', 'example.com'));
assert('S3: s 使点号匹配换行', match('title/foo.bar/s', 'foo\nbar'));
assert('S4: 无 s 时点号不匹配换行', !match('title/foo.bar/', 'foo\nbar'));
assert('S5: 字符类内点号保持字面量', match('title/[.]com/s', 'a.com'));
assert('S6: 转义点不匹配任意字符', !match('title/a\\.b/s', 'axb'));
assert('S7: s 标志保留', (() => {
  const parsed = api.parsePrefixedRegexRule('title/foo/s', 6);
  return parsed.flags === 's' && parsed.pattern === 'foo';
})());
assert('S8: 多标志保留', (() => {
  const compiled = api.compileRuleRegex('title/foo/is');
  return compiled.regex.flags.includes('i') && compiled.regex.flags.includes('s');
})());
assert('S10: 尾部重复flag字符不被识别为flag', (() => {
  const parsed = api.parsePrefixedRegexRule('title/path/ii', 6);
  return parsed.flags === '' && parsed.pattern === 'path/ii';
})());
assert('S11: 尾部非flag斜杠路径保持完整', (() => {
  const parsed = api.parsePrefixedRegexRule('title/something/is/other', 6);
  return parsed.flags === '' && parsed.pattern === 'something/is/other';
})());
assert('S12: 转义斜杠不被误识别为flag分隔符', (() => {
  const parsed = api.parsePrefixedRegexRule('title/https:\\/\\/foo\\/i', 6);
  return parsed.flags === '' && parsed.pattern === 'https:\\/\\/foo\\/i';
})());
assert('S13: 正常末尾未转义斜杠正确提取flags', (() => {
  const parsed = api.parsePrefixedRegexRule('title/https:\\/\\/foo/i', 6);
  return parsed.flags === 'i' && parsed.pattern === 'https:\\/\\/foo';
})());
assert('S14: 偶数个反斜杠末尾斜杠正常剥离定界符', (() => {
  const parsed = api.parsePrefixedRegexRule('title/foo\\\\/', 6);
  return parsed.flags === '' && parsed.pattern === 'foo\\\\';
})());
assert('S15: 奇数个反斜杠末尾斜杠作为转义斜杠保留', (() => {
  const parsed = api.parsePrefixedRegexRule('title/foo\\/', 6);
  return parsed.flags === '' && parsed.pattern === 'foo\\/';
})());
assert('S9: 旧式 (?s) 前缀仍可用', match('title/(?s)foo.bar/', 'foo\nbar'));
assert('S16: 大写I当作i', (() => {
  const parsed = api.parsePrefixedRegexRule('title/foo/I', 6);
  return parsed.flags === 'i' && parsed.pattern === 'foo';
})());
assert('S17: 大写I可编译且忽略大小写', match('title/FOO/I', 'foo'));
assert('S18: /pattern/I 编译不抛错', (() => {
  const compiled = api.compileRuleRegex('/FOO/I');
  return compiled.regex.flags.includes('i') && compiled.regex.test('foo');
})());
})();

// ==== 来源: test-rule-filter.cjs ====
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
for (const rule of elementRules) {
  assert(`E: 元素规则跳过 ${rule}`, api.isElementRuleLine(rule) === true);
}

const scriptRules = [
  '/foo##bar/',
  'title/.*##.*/',
  '*://example.com/##x',
  '@*://example.com/*',
  '@title/.*##.*/',
  '*://*.example.com/*',
];
for (const rule of scriptRules) {
  assert(`E: 脚本规则保留 ${rule}`, api.isElementRuleLine(rule) === false);
}

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
for (const line of keep) {
  assert(`F: 保留 ${line}`, api.collectSubscriptionRules([line]).length === 1);
}

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
for (const line of drop) {
  assert(`F: 跳过 ${line}`, api.collectSubscriptionRules([line]).length === 0);
}

// ---- uBO 网络过滤规则拒绝(回归) ----
const networkDrop = [
  '||example.com^',
  '|https://example.com/ad',
];
for (const line of networkDrop) {
  assert(`N: 跳过uBO网络规则 ${line}`, api.collectSubscriptionRules([line]).length === 0);
  assert(`N: 校验拒绝 ${line}`, api.validateUrlWildcard(line) === false && api.validateRule(line) === false);
}

const networkKeep = [
  '*://example.com/a|b/*',
  '*://example.com/?x=a|b',
  'example.com',
];
for (const line of networkKeep) {
  assert(`N: 管道符路径仍有效 ${line}`, api.validateRule(line) === true);
}

// ---- frontmatter 剥离 ----
const content = '---\nname: Test\n---\n# c\n!scheme="https"\n*://*.example.com/*\n';
const { lines, meta } = api.parseRulesetContent(content);
const collected = api.collectSubscriptionRules(lines.map((l) => l.trim()));
assert('F1: frontmatter 剥离', meta.name === 'Test');
assert('F2: 组合过滤结果', JSON.stringify(collected) === JSON.stringify(['!scheme="https"', '*://*.example.com/*']));

// YAML 订阅端到端：提取+过滤
const yParsed = api.parseRulesetContent('name: Y List\nrules:\n  - example.com\n  - \'*://*.example.com/*\'\n  - example.com##.ad\n  - @@||blocked.com^\n  - ||ubo.com^\n');
const yCollected = api.collectSubscriptionRules(yParsed.lines.map((l) => l.trim()));
assert('Y1: YAML订阅提取与过滤', yParsed.meta.name === 'Y List' && JSON.stringify(yCollected) === JSON.stringify(['example.com', '*://*.example.com/*']));
const yWl = api.parseRulesetContent('name: Mix\nblacklist:\n  - ads.com\nrules:\n  - extra.com\nwhitelist:\n  - good.com\n  - "*://ok.com/*"\n');
const yWlCollected = api.collectSubscriptionRules(yWl.lines.map((l) => l.trim()));
assert('Y2: YAML多段+whitelist加@', JSON.stringify(yWlCollected) === JSON.stringify(['ads.com', 'extra.com', '@good.com', '@*://ok.com/*']));
assert('Y3: 无引号中文@if可订阅', api.collectSubscriptionRules(['*://*.example.com/* @if(title *= 广告)']).length === 1);
})();

// ==== 来源: test-rule-source.cjs ====
await (async () => {
const fns = [
  'hostLabelToASCII', 'toASCIIHostname', 'safeRegexTest', 'stripRuleComment', 'getInvalidRegexFlags', 'parseConditionPart',
  'tokenizeCondExpr', 'parseCondExprTokens', 'analyzeCondExpr', 'foldCondExpr',
  'evalDynamicLeaf', 'evalCondAST', 'extractBalancedParens', 'findIfOccurrences', 'stripIfConditions',
  'evaluateCondition', 'isCondExprCore', 'looksLikeCondExpr', 'absorbStandaloneExpr',
  'parseRuleWithConditions', 'validateUrlWildcard', 'ruleToRegex', 'parsePrefixedRegexRule',
  'escapeWildcardPart', 'wildcardToRegex', 'matchWildcardDomainPattern', 'extractSimpleWhitelistDomain', 'matchSimpleDomain',
  'compileRuleRegex', 'checkDynamicConditions', 'matchDomainEntryType', 'buildRuleIndex',
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


// 本地与订阅重复规则：来源必须按位置区分
api.setState(
  ['@*://*.example.com/*', '*://*.example.com/*'],
  [{ url: 's1', enabled: true, rules: ['@*://*.example.com/*'] }],
);
api.buildRuleIndex();
let cr = api.getCR();
const wl = cr.whitelistDomains.get('example.com') || [];
assert('R1: 本地白名单标记为本地来源', wl.some(e => e.source === '本地规则'));
assert('R2: 订阅白名单标记为订阅来源', wl.some(e => e.source === '订阅1'));
const bl = cr.domains.get('example.com') || [];
assert('R3: 本地黑名单标记为本地来源', bl.some(e => e.source === '本地规则'));
const r4 = api.checkRuleMatchOptimized('https://example.com/', 'example.com', 't', null, ['example.com']);
assert('R4: 重复规则不再丢失本地白名单优先级', !r4 || r4.blocked !== true);

// 本地/订阅各自独有规则
api.setState(['*://*.local.com/*'], [{ url: 's1', enabled: true, rules: ['*://*.sub.com/*'] }]);
api.buildRuleIndex();
cr = api.getCR();
assert('R5: 本地独有规则来源正确', cr.domains.get('local.com')[0].source === '本地规则');
assert('R6: 订阅独有规则来源正确', cr.domains.get('sub.com')[0].source === '订阅1');

// 禁用订阅跳过，标签保留原始序号
api.setState([], [
  { url: 's1', enabled: false, rules: ['*://*.off.com/*'] },
  { url: 's2', enabled: true, rules: ['*://*.on.com/*'] },
]);
api.buildRuleIndex();
cr = api.getCR();
assert('R7: 禁用订阅不加载', !cr.domains.has('off.com'));
assert('R8: 启用订阅保留原始序号标签', cr.domains.get('on.com')[0].source === '订阅2');

// @N+白名单组合：编译期必须跳过（否则成为惰性规则）
api.setState(['@1 @*://*.bad.com/*', '@2 @host $= ".bad2.com"', '@3 *://*.good.com/*'], []);
api.buildRuleIndex();
cr = api.getCR();
assert('B1: 高亮+白名单组合不编译', cr.highlightUrls.length === 0 && cr.highlightConditionalRules.length === 0);
assert('B2: 正常高亮域名规则不受影响', cr.highlightDomains.has('good.com'));
})();

// ==== 来源: test-priority.cjs ====
await (async () => {
const fns = ['safeRegexTest', 'matchDomainEntryType', 'checkDynamicConditions']
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
assert('无规则 → 不屏蔽', !isBlocked(doCheck(cr, url, host, 'title', null, sl)));

cr = makeCR();
addBlDomain(cr, 'example.com', 'wildcard', 'example.com', '本地规则');
assert('仅本地黑名单 → 屏蔽', isBlocked(doCheck(cr, url, host, 'title', null, sl)));

cr = makeCR();
addWlDomain(cr, 'example.com', 'wildcard');
assert('仅白名单 → 不屏蔽', !isBlocked(doCheck(cr, url, host, 'title', null, sl)));

// ==================== 核心优先级 ====================
cr = makeCR();
addWlDomain(cr, 'example.com', 'wildcard');
addBlDomain(cr, 'example.com', 'wildcard', 'example.com', '本地规则');
assert('T1:本地白名单 > 本地黑名单', !isBlocked(doCheck(cr, url, host, 'title', null, sl)));

cr = makeCR();
addBlDomain(cr, 'example.com', 'wildcard', 'example.com', '本地规则');
addWlDomainSub(cr, 'example.com', 'wildcard');
assert('T2:本地黑名单 > 订阅白名单', isBlocked(doCheck(cr, url, host, 'title', null, sl)));

cr = makeCR();
addWlDomain(cr, 'example.com', 'wildcard');
addBlDomain(cr, 'example.com', 'wildcard', 'example.com', '订阅规则1');
assert('T3:白名单 > 订阅黑名单', !isBlocked(doCheck(cr, url, host, 'title', null, sl)));

// ==================== URL pattern ====================
cr = makeCR();
addWlUrl(cr, 'example\\.com');
addBlUrl(cr, 'example\\.com', 'example.com', '本地规则');
assert('T4:URL白名单 > URL本地黑名单', !isBlocked(doCheck(cr, url, host, 'title', null, sl)));

cr = makeCR();
addBlUrl(cr, 'example\\.com', 'example.com', '本地规则');
addWlUrlSub(cr, 'example\\.com');
r = doCheck(cr, url, host, 'title', null, sl);
assert('T5:URL本地黑名单 > URL订阅白名单', isBlocked(r) && getSrc(r) === '本地规则');

// ==================== 不同域名 ====================
cr = makeCR();
addBlDomain(cr, 'other.com', 'wildcard', 'other.com', '本地规则');
assert('T6:不匹配的本地黑名单不影响其他引擎', !isBlocked(doCheck(cr, url, host, 'title', null, sl)));

cr = makeCR();
addBlDomain(cr, 'example.com', 'wildcard', 'example.com', '本地规则');
addWlDomain(cr, 'other.com', 'wildcard');
assert('T7:不匹配的白名单不影响本地黑名单', isBlocked(doCheck(cr, url, host, 'title', null, sl)));

// ==================== 订阅黑名单（阶段5）====================
cr = makeCR();
addBlDomain(cr, 'example.com', 'wildcard', 'example.com', '订阅规则1');
r = doCheck(cr, url, host, 'title', null, sl);
assert('T8:订阅黑名单 → 屏蔽', isBlocked(r) && getSrc(r) === '订阅规则1');

cr = makeCR();
addBlUrl(cr, 'example\\.com', 'example.com', '订阅规则1');
r = doCheck(cr, url, host, 'title', null, sl);
assert('T9:订阅URL黑名单 → 屏蔽', isBlocked(r) && getSrc(r) === '订阅规则1');

// ==================== 订阅黑名单 + 本地白名单 优先级 ====================
cr = makeCR();
addWlDomain(cr, 'example.com', 'wildcard');
addBlDomain(cr, 'example.com', 'wildcard', 'example.com', '订阅规则1');
assert('T10:本地白名单 > 订阅黑名单', !isBlocked(doCheck(cr, url, host, 'title', null, sl)));

// ==================== 本地黑名单正常阶段3处理 ====================
cr = makeCR();
addBlDomain(cr, 'example.com', 'wildcard', 'example.com', '本地规则');
r = doCheck(cr, url, host, 'title', null, sl);
assert('T11:本地黑名单正常屏蔽（阶段3）', isBlocked(r) && getSrc(r) === '本地规则');

// ==================== 标题/文本规则 ====================
cr = makeCR();
addBlTitle(cr, 'blocked', '标题规则', '本地规则');
assert('T12:本地标题黑名单 → 屏蔽', isBlocked(doCheck(cr, url, host, 'blocked title', null, sl)));

cr = makeCR();
addBlTitle(cr, 'blocked', '标题规则', '订阅规则1');
r = doCheck(cr, url, host, 'blocked title', null, sl);
assert('T13:订阅标题黑名单 → 屏蔽', isBlocked(r) && getSrc(r) === '订阅规则1');

cr = makeCR();
addBlText(cr, 'blocked', '文本规则', '本地规则');
assert('T14:本地文本黑名单 → 屏蔽', isBlocked(doCheck(cr, url, host, 'title', 'blocked snippet', sl)));

cr = makeCR();
addBlText(cr, 'blocked', '文本规则', '订阅规则1');
r = doCheck(cr, url, host, 'title', 'blocked snippet', sl);
assert('T15:订阅文本黑名单 → 屏蔽', isBlocked(r) && getSrc(r) === '订阅规则1');

// ==================== 混合来源：本地 + 订阅同时存在 ====================
cr = makeCR();
addBlDomain(cr, 'example.com', 'wildcard', 'local-domain', '本地规则');
addBlDomain(cr, 'example.com', 'wildcard', 'sub-domain', '订阅规则1');
r = doCheck(cr, url, host, 'title', null, sl);
assert('T16:本地和订阅都匹配时，返回本地规则（阶段3优先）', isBlocked(r) && getSrc(r) === '本地规则');

// ==================== 阶段5仅匹配订阅，不再重复匹配本地 ====================
cr = makeCR();
addBlUrl(cr, 'example\\.com/page', 'example.com/page', '订阅规则1');
r = doCheck(cr, url, host, 'title', null, sl);
assert('T17:仅订阅URL黑名单可独立屏蔽（阶段5订阅路径）', isBlocked(r) && getSrc(r) === '订阅规则1');

// ==================== 订阅白名单可以阻止订阅黑名单 ====================
cr = makeCR();
addWlUrlSub(cr, 'example\\.com');
addBlUrl(cr, 'example\\.com', 'example.com', '订阅规则1');
assert('T18:订阅白名单 > 订阅黑名单', !isBlocked(doCheck(cr, url, host, 'title', null, sl)));

// ==================== exact 类型域名匹配 ====================
// exact 类型只精确匹配 level === lowerDomain，不跨子域
cr = makeCR();
addBlDomain(cr, 'www.example.com', 'exact', 'www.example.com', '订阅规则1');
r = doCheck(cr, url, host, 'title', null, ['www.example.com', 'example.com']);
assert('T19a:订阅精确域名(exact)匹配自身 → 屏蔽', isBlocked(r) && getSrc(r) === '订阅规则1');

cr = makeCR();
addBlDomain(cr, 'other.com', 'exact', 'other.com', '订阅规则1');
r = doCheck(cr, url, host, 'title', null, ['www.example.com', 'example.com']);
assert('T19b:订阅精确域名(exact)不匹配其他域名', !isBlocked(r));

// ==================== 空 snippet 不触发文本匹配 ====================
cr = makeCR();
addBlText(cr, 'something', 'text-rule', '订阅规则1');
assert('T20:snippet为空时不匹配文本规则', !isBlocked(doCheck(cr, url, host, 'title', null, sl)));

// ==================== 高亮与屏蔽共存 ====================
cr = makeCR();
cr.highlightDomains.set('example.com', [{N: 2, type: 'wildcard'}]);
addBlDomain(cr, 'example.com', 'wildcard', 'example.com', '本地规则');
r = doCheck(cr, url, host, 'title', null, sl);
assert('T21:高亮+屏蔽同时返回', r && r.highlight === 2 && r.blocked === true);

cr = makeCR();
cr.highlightDomains.set('example.com', [{N: 3, type: 'wildcard'}]);
r = doCheck(cr, url, host, 'title', null, sl);
assert('T22:仅高亮无屏蔽', r && r.highlight === 3 && !r.blocked);

cr = makeCR();
cr.conditionalRules.push({
  type: 'expr',
  originalRule: 'host $= ".example.com"',
  source: env.t('localRule'),
  isLocal: false,
  conditions: [],
});
r = doCheck(cr, url, host, 'title', null, sl);
assert('T23:订阅条件黑名单用isLocal不看语言文案', isBlocked(r) && r.source === env.t('localRule'));
})();

// ==== 来源: test-import-cancel.cjs ====
await (async () => {
const parseSyncHeaderFn = extractFn(src, 'parseSyncHeader');
const importRulesFromFileFn = extractFn(src, 'importRulesFromFile');


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
    getElementById(id) { return id === 'searchfilter-rules' ? env.textarea : null; },
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
    assert('C1: 打开选择器后锁定面板关闭', api.isPreventPanelClose() === true);
    assert('C2: input 已加入 DOM', env.bodyChildren.includes(fakeInput));
    fakeInput.listeners.cancel[0]();
    assert('C3: cancel 事件后解锁', api.isPreventPanelClose() === false);
    assert('C4: cancel 事件后移除 input', !env.bodyChildren.includes(fakeInput));
  }

  // 2. 老浏览器无 cancel 事件，靠窗口焦点回落兜底
  {
    const { env, api, fakeInput } = createEnv();
    api.importRulesFromFile();
    env.windowListeners.focus[0]();
    await new Promise((resolve) => setTimeout(resolve, 350));
    assert('C5: 焦点回落后解锁', api.isPreventPanelClose() === false);
    assert('C6: 焦点回落后移除 input', !env.bodyChildren.includes(fakeInput));
  }

  // 3. 正常选择文件
  {
    const { env, api, fakeInput } = createEnv();
    api.importRulesFromFile();
    fakeInput.files = [{ _content: 'rule1\nrule2' }];
    fakeInput.onchange({ target: fakeInput });
    assert('C7: 文件内容写入编辑区', env.textarea.value === 'rule1\nrule2');
    assert('C8: 读取完成后解锁', api.isPreventPanelClose() === false);
    assert('C9: 读取完成后移除 input', !env.bodyChildren.includes(fakeInput));
    assert('C10: 更新行号被调用', env.hooks.updateLineNumbersCalls === 1);
  }

  // 4. onchange 但未选中文件
  {
    const { env, api, fakeInput } = createEnv();
    api.importRulesFromFile();
    fakeInput.onchange({ target: { files: [] } });
    assert('C11: 未选择文件时解锁', api.isPreventPanelClose() === false);
    assert('C12: 未选择文件时移除 input', !env.bodyChildren.includes(fakeInput));
  }

  // 5. 同步配置头被剥离
  {
    const { env, api, fakeInput } = createEnv();
    api.importRulesFromFile();
    fakeInput.files = [{ _content: '# ScriptConfig: {"a":1}\nrule1\nrule2' }];
    fakeInput.onchange({ target: fakeInput });
    assert('C13: 同步配置头被剥离', env.textarea.value === 'rule1\nrule2');
  }

})();

// ==== 一键屏蔽规则选项构建(域名/精确/白名单) ====
await (async () => {
  const build = new Function(
    extractFn(src, 'buildBlockRuleOptions') + '\nreturn buildBlockRuleOptions;'
  )();

  let o = build('abc.example.com');
  assert('K1: 非www子域不回退主域', o.isIP === false && o.domainRule === '*://*.abc.example.com/*');
  assert('K2: 精确选项为完整主机', o.exactRule === '*://abc.example.com/*');
  assert('K3: 白名单选项为精确加@', o.whitelistRule === '@*://abc.example.com/*');

  o = build('www.example.com');
  assert('K4: www前缀回退主域', o.domainRule === '*://*.example.com/*' && o.exactRule === '*://www.example.com/*');

  o = build('example.com');
  assert('K5: 裸域域名选项', o.domainRule === '*://*.example.com/*' && o.exactRule === '*://example.com/*');

  o = build('1.2.3.4');
  assert('K6: IP精确与域名同规则', o.isIP === true && o.domainRule === '*://1.2.3.4/*' && o.exactRule === '*://1.2.3.4/*' && o.whitelistRule === '@*://1.2.3.4/*');

  o = build('1.2.3.256');
  assert('K7: 越界IP按域名处理', o.isIP === false);

  o = build('01.02.03.04');
  assert('K8: 前导零IP按域名处理', o.isIP === false);

  o = build('');
  assert('K9: 空域名不崩溃', !!o && o.isIP === false && typeof o.exactRule === 'string');

  o = build('news.bbc.co.uk');
  assert('K10: 多级子域不回退主域', o.domainRule === '*://*.news.bbc.co.uk/*');
  o = build('example.co.uk');
  assert('K11: 裸域域名选项不误剥', o.domainRule === '*://*.example.co.uk/*');
  o = build('www.news.bbc.co.uk');
  assert('K12: 仅剥离最外层www', o.domainRule === '*://*.news.bbc.co.uk/*');
})();

// ==== 校验空正则与 DDG 重定向解包测试 ====
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

  assert('R_EMPTY1: 空正则 // 判定无效', analyzeRule('//').valid === false);
  assert('R_EMPTY2: 空正则 //i 判定无效', analyzeRule('//i').valid === false);
  assert('R_EMPTY3: 空白正则 /   / 判定无效', analyzeRule('/   /').valid === false);
  assert('R_VALID_RE: 正常正则 /abc/ 有有效结果', analyzeRule('/abc/').valid === true);

  const getCleanUrlAndFixDOM = new Function(
    extractFn(src, 'decodeRedirectTarget') + '\n' +
    extractFn(src, 'decodeBingCkTarget') + '\n' +
    extractFn(src, 'unwrapRedirectUrl') + '\n' +
    extractFn(src, 'getCleanUrlAndFixDOM') + '\nreturn getCleanUrlAndFixDOM;'
  )();

  const ddgLink = { href: 'https://duckduckgo.com/l/?uddg=https%3A%2F%2Ftarget.example.com%2Fpath%3Fa%3D1&rut=xxx' };
  const cleanUrl = getCleanUrlAndFixDOM(ddgLink);
  assert('DDG1: 解码 uddg 重定向', cleanUrl === 'https://target.example.com/path?a=1');
  assert('DDG2: 同步修改 DOM link.href', ddgLink.href === 'https://target.example.com/path?a=1');
  const ddgNoSlash = { href: 'https://duckduckgo.com/l?uddg=https%3A%2F%2Ftarget.example.com%2Fx' };
  assert('DDG3: /l 无尾斜杠也解包', getCleanUrlAndFixDOM(ddgNoSlash) === 'https://target.example.com/x');
  const scholarLink = { href: 'https://scholar.google.com/scholar_url?url=https%3A%2F%2Farxiv.org%2Fabs%2F1234&hl=en' };
  assert('SCH1: scholar_url 解包', getCleanUrlAndFixDOM(scholarLink) === 'https://arxiv.org/abs/1234');
  const scholarJp = { href: 'https://scholar.google.co.jp/scholar_url?url=https%3A%2F%2Fexample.com%2Fpaper' };
  assert('SCH2: scholar 地区站解包', getCleanUrlAndFixDOM(scholarJp) === 'https://example.com/paper');
  const gUrl = { href: 'https://www.google.com/url?q=https%3A%2F%2Fexample.com%2Fa' };
  assert('G1: google /url 解包', getCleanUrlAndFixDOM(gUrl) === 'https://example.com/a');
  const yahooTw = { href: 'https://tw.search.yahoo.com/r/RU=https%3A%2F%2Fexample.com%2Fy/RK=2' };
  const yahooHk = { href: 'https://search.yahoo.com.hk/r/RU=https%3A%2F%2Fexample.com%2Fhk/RK=2' };
  assert('Y1: yahoo 地区站 RU= 解包', getCleanUrlAndFixDOM(yahooTw) === 'https://example.com/y' && getCleanUrlAndFixDOM(yahooHk) === 'https://example.com/hk');
  const customEngineLink = { href: 'https://scholar.google.com/scholar_url?url=https%3A%2F%2Fpapers.example.com%2Fx' };
  assert('C1: 不依赖引擎ID仍解包', getCleanUrlAndFixDOM(customEngineLink) === 'https://papers.example.com/x');
})();

})();

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

})();
