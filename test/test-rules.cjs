// 读取上一级目录的 *.*.*.user.js 或 Lite.user.js
// 规则逻辑 / 优先级 / 统计 / 一键屏蔽 / 去除重定向 / 修复回归
// 命名：规则-序号: 描述
// 忽略：ipv6屏蔽识别(ipv6刷新频繁屏蔽无实际意义)、错误flags静默、正则与flags间空格、切换语言不重建主面板

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
  const fns = ['hostLabelToASCII', 'toASCIIHostname', 'toASCIIUrl', 'safeRegexTest', 'safeDecodeURIComponent', 'decodeUrlForMatch', 'stripRuleComment', 'getInvalidRegexFlags', 'parseConditionPart',
    'tokenizeCondExpr', 'parseCondExprTokens', 'analyzeCondExpr', 'foldCondExpr',
    'evalDynamicLeaf', 'evalCondAST', 'extractBalancedParens', 'findIfOccurrences', 'stripIfConditions',
    'evaluateCondition', 'isCondExprCore', 'looksLikeCondExpr', 'absorbStandaloneExpr',
    'parseRuleWithConditions', 'validateUrlWildcard', 'ruleToRegex', 'parsePrefixedRegexRule',
    'escapeWildcardPart', 'wildcardToRegex', 'normalizeHostCandidate', 'matchWildcardDomainPattern', 'matchSimpleDomain',
    'compileRuleRegex', 'checkDynamicConditions', 'matchDomainEntryType', 'buildRuleIndex', 'newCompiledRules',
    'extractIfConditions', 'validateCondition', 'analyzeRule', 'validateRule', 'cachedAnalyzeRule',
    'checkRuleMatchOptimized', 'isLocalEntry', 'isEngineHost', 'hasBareRegexSlash',
  ].map((n) => extractFn(src, n));
  return new Function(`${SERH_CONSTS.flags}\n${SERH_CONSTS.lang}\n${SERH_T_FN}\nlet compiledRules; let _rulesRevision = 0; let _rulesFingerprint = '[]';
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
    'ruleToRegex', 'validateUrlWildcard', 'evaluateCondition', 'collectSubscriptionRules', 'isNonRuleTextResponse', 'hasBareRegexSlash',
  ].map((n) => extractFn(src, n));
  return new Function(`${SERH_CONSTS.flags}\n${SERH_CONSTS.lang}\n${SERH_T_FN}\nconst window = { location: { hostname: 'www.google.com', pathname: '/search', search: '?q=x', href: 'https://www.google.com/search?q=x' } };
function getSearchEngine() { return 'google'; }
function getSearchCategory() { return 'web'; }
const currentConfig = { debug: false };
${fns.join('\n')}
return { collectSubscriptionRules, parseRulesetContent, isNonRuleTextResponse, isScriptRuleLine, isElementRuleLine, validateRule, validateUrlWildcard };`)();
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
assert('规则-004: 路径点号转义(file.txt 不匹配 filextxt)', !match('*://example.com/file.txt', 'https://example.com/filextxt'));
assert('规则-007: example.com 不匹配 exampleXcom', !match('*://example.com/*', 'https://exampleXcom/'));
assert('规则-010: 中文域名通配匹配 punycode', match('*://*.例子.com/*', 'https://xn--fsqu00a.com/x'));
// 忽略该问题: 通配符与正则匹配极端规则可长时间占用主线程，极罕见问题无修复意义

// 锚定与通配范围
assert('规则-013: 路径模式不匹配 query 中的伪 URL', !match('*://example.com/path/*', 'https://evil.com/?u=example.com/path/'));
assert('规则-014: 主机通配不跨越路径', !match('*://*.example.com/path/*', 'https://evil.com/x.example.com/path/'));
assert('规则-016: 显式 scheme 不匹配其他 scheme', !match('https://example.com/*', 'http://example.com/'));

// 裸域与无scheme
assert('规则-020: 无scheme *.域 不匹配前缀域名与伪URL', !match('*.example.com', 'https://notexample.com/') && !match('*.example.com', 'https://evil.com/?u=example.com'));
assert('规则-022: 无路径规则不匹配后缀域名', !match('*://example.com', 'https://example.com.evil.com/'));

// 端口
assert('规则-023: 显式端口规则匹配同端口', match('*://example.com:8080/path/*', 'https://example.com:8080/path/test'));
assert('规则-026: 端口通配不跨越冒号至主机与路径', !match('*://example.com:*/y', 'https://example.com/x/y') && !match('*://example.com:*/y', 'https://example.com:80/x/y'));

// 主机中部/尾部星号不跨点
assert('规则-028: 中部主机星号不跨点', !match('*://mail.*.com/*', 'https://mail.a.b.com/') && match('*://mail.*.com/*', 'https://mail.a.com/'));
assert('规则-029: *.example.* 匹配二段后缀不匹配三段后缀', match('*://*.example.*/*', 'https://www.example.co.uk/page') && !match('*://*.example.*/*', 'https://example.a.b.c/'));

// 正则 flags 边界
assert('规则-033: 尾部非flag斜杠路径保持完整', (() => {
  const parsed = api.parsePrefixedRegexRule('title/something/is/other', 6);
  return parsed.flags === '' && parsed.pattern === 'something/is/other';
})());
assert('规则-035: 正常末尾未转义斜杠正确提取flags', (() => {
  const parsed = api.parsePrefixedRegexRule('title/https:\\/\\/foo/i', 6);
  return parsed.flags === 'i' && parsed.pattern === 'https:\\/\\/foo';
})());
assert('规则-039: 编译过滤保留合法flags去除非法', (() => {
  const flags = api.compileRuleRegex('/foo/gyi').regex.flags;
  return flags.includes('i') && !flags.includes('g') && !flags.includes('y');
})());
assert('规则-040: 未闭合正则 /foo 编译报错', (() => {
  try { api.compileRuleRegex('/foo'); return false; } catch (e) { return true; }
})());

// 修复回归
assert('规则-044: IDN部分标签通配按整标签punycode命中', (() => {
  const c = api.compileRuleRegex('*://例*.com/*');
  return api.safeRegexTest(c.regex, 'https://xn--*-kb7a.com/') && !/例/.test(c.regex.source);
})());
assert('规则-045: 规则路径后的普通字符不越界', (() => {
  const c = api.compileRuleRegex('*://example.com/release');
  return !api.safeRegexTest(c.regex, 'https://example.com/releasex');
})());
assert('规则-282: 路径规则以分隔符结尾时按前缀匹配', match('*://*.example.com/download/', 'https://a.example.com/download/file.zip') && match('example.com/', 'https://example.com/abc') && match('*://example.com/search?q=', 'https://example.com/search?q=abc') && !match('*://example.com/release', 'https://example.com/releasex'));
assert('规则-083: 查询参数规则命中后续参数', match('*://x.com/*?a=b', 'https://x.com/z?a=b&c=d'));

// 尾部转义星号末尾锚定
const wcMatch = (rule, url) => new RegExp(api.wildcardToRegex(rule), 'i').test(url);
assert('规则-046: 尾部转义星号补末尾锚定', wcMatch('*://x.com/a\\*', 'https://x.com/a*') === true && wcMatch('*://x.com/a\\*', 'https://x.com/a*tracking=1') === false);

// 非ASCII路径百分号编码
assert('规则-050: 中文路径通配命中百分号编码URL', match('*://example.com/中文/*', 'https://example.com/%E4%B8%AD%E6%96%87/x') === true);
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

// uBO 网络过滤规则拒绝
assert('规则-064: uBO网络规则被过滤与校验拒绝', api.collectSubscriptionRules(['||example.com^']).length === 0 && api.validateUrlWildcard('||example.com^') === false && api.validateRule('||example.com^') === false);

// frontmatter 与 YAML 端到端
const { lines, meta } = api.parseRulesetContent('---\nname: Test\n---\n# c\n!scheme="https"\n*://*.example.com/*\n');
assert('规则-067: 组合过滤结果', JSON.stringify(api.collectSubscriptionRules(lines.map((l) => l.trim()))) === JSON.stringify(['!scheme="https"', '*://*.example.com/*']));

const yParsed = api.parseRulesetContent('name: Y List\nrules:\n  - example.com\n  - \'*://*.example.com/*\'\n  - example.com##.ad\n  - ||ubo.com^\n');
assert('规则-068: YAML订阅提取与过滤', yParsed.meta.name === 'Y List' && JSON.stringify(api.collectSubscriptionRules(yParsed.lines.map((l) => l.trim()))) === JSON.stringify(['example.com', '*://*.example.com/*']));
const yWl = api.parseRulesetContent('name: Mix\nblacklist:\n  - ads.com\nrules:\n  - extra.com\nwhitelist:\n  - good.com\n  - "*://ok.com/*"\n');
assert('规则-069: YAML多段+whitelist加@', JSON.stringify(api.collectSubscriptionRules(yWl.lines.map((l) => l.trim()))) === JSON.stringify(['ads.com', 'extra.com', '@good.com', '@*://ok.com/*']));
const yCond = api.parseRulesetContent('name: Cond List\nrules:\n  - title: /广告/\n  - !host $= ".spam.com"\n  - title *= "推广"\n');

const collect = (content) => api.collectSubscriptionRules(api.parseRulesetContent(content).lines.map((l) => l.trim()));
assert('规则-074: flow引号项含逗号/花括号不被拆坏', JSON.stringify(api.parseRulesetContent("rules: ['x.com/a{2,3}', \"y.com\", z.com]").lines) === JSON.stringify(['x.com/a{2,3}', 'y.com', 'z.com']));
assert('规则-078: 映射形项不再导入为激活规则', JSON.stringify(collect('blacklist:\n  - url: https://example.com\n  - real.com\n')) === JSON.stringify(['real.com']));
assert('规则-079: 折叠标量整段保留且后续项不丢', JSON.stringify(collect('rules:\n  - example.com\n  - >\n    *://folded.example.com/*\n  - kept.com\n')) === JSON.stringify(['example.com', '*://folded.example.com/*', 'kept.com']));
assert('规则-081: 无空格冒号键形标量保留', JSON.stringify(collect('rules:\n  - localhost:8080/*\n  - user:pass@host/page\n')) === JSON.stringify(['localhost:8080/*', 'user:pass@host/page']));
assert('规则-070: YAML matches 段不导入为屏蔽规则', JSON.stringify(collect('name: M\nmatches:\n  - "*://www.google.com/search*"\n  - "https://x.com/*"\nrules:\n  - keep.com\n')) === JSON.stringify(['keep.com']) && collect('matches: ["*://a.com/*"]\n').length === 0);

// YAML 容错
let threw = false, res;
try { res = api.parseRulesetContent('name: "My list\nrules:\n  - *://a.com/*\n'); } catch (_) { threw = true; }
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

api.setState(['@1 @*://*.bad.com/*', '@2 @host $= ".bad2.com"', '@3 *://*.good.com/*'], []);
api.buildRuleIndex();
cr2 = api.getCR();
assert('规则-096: 高亮+白名单同时编译', cr2.highlightDomains.has('bad.com') && cr2.whitelistDomains.has('bad.com') && cr2.highlightConditionalRules.some(e => e.N === 2) && cr2.whitelistConditionalRules.length === 1);

assert('规则-097: @N前缀需要分隔符', (() => {
  api.setState(['@2fast.com'], []); api.buildRuleIndex();
  const c = api.getCR();
  return !c.highlightDomains.has('fast.com') && c.whitelistDomains.has('2fast.com');
})());

api.setState(['*://**.com/*', 'title/foo/gi', '/abc/gi', '/foo'], []);
api.buildRuleIndex();
cr2 = api.getCR();
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

assert('规则-111: 本地白名单 > 本地黑名单', (() => {
  const cr = makeCR(); addWlDomain(cr, 'example.com', 'wildcard'); addBlDomain(cr, 'example.com', 'wildcard', 'example.com', '本地规则');
  return !isBlocked(doCheck(cr, url, host, 'title'));
})());
assert('规则-112: 本地黑名单 > 订阅白名单', (() => {
  const cr = makeCR(); addBlDomain(cr, 'example.com', 'wildcard', 'example.com', '本地规则'); addWlDomain(cr, 'example.com', 'wildcard', '订阅规则1');
  return isBlocked(doCheck(cr, url, host, 'title'));
})());
assert('规则-118: 订阅黑名单 → 屏蔽且来源为订阅', (() => {
  const cr = makeCR(); addBlDomain(cr, 'example.com', 'wildcard', 'example.com', '订阅规则1');
  const r = doCheck(cr, url, host, 'title');
  return isBlocked(r) && getSrc(r) === '订阅规则1';
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
assert('规则-125: 高亮与屏蔽同时返回; 仅高亮无屏蔽', (() => {
  const crA = makeCR(); crA.highlightDomains.set('example.com', [{ N: 2, type: 'wildcard' }]); addBlDomain(crA, 'example.com', 'wildcard', 'example.com', '本地规则');
  const crB = makeCR(); crB.highlightDomains.set('example.com', [{ N: 3, type: 'wildcard' }]);
  const rA = doCheck(crA), rB = doCheck(crB);
  return rA && rA.highlight === 2 && rA.blocked === true && rB && rB.highlight === 3 && !rB.blocked;
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
assert('规则-128: 空域名回退白名单@+命中规则可解订阅屏蔽死局(修复留档, 主/Lite)', (() => {
  const sub = ['*://*.example.com/*', '/evil\\d+/', 'title/.*广告.*/', 'host $= ".example.net"', '*://*.commented.com/* # 备注'];
  const wl = ['@*://*.example.com/*', '@/evil\\d+/', '@title/.*广告.*/', '@host $= ".example.net"', '@*://*.commented.com/*'];
  if (!wl.every((r) => api.validateRule(r) === true)) return false;
  const cases = [
    ['https://a.example.com/x', 'a.example.com', 't', '', ['a.example.com', 'example.com']],
    ['https://x.com/evil1', 'x.com', 't', '', ['x.com']],
    ['https://x.com/y', 'x.com', '前方广告投放', '', ['x.com']],
    ['https://www.example.net/z', 'www.example.net', 't', '', ['www.example.net', 'example.net']],
    ['https://b.commented.com/q', 'b.commented.com', 't', '', ['b.commented.com', 'commented.com']],
  ];
  api.setState([], [{ enabled: true, url: 's1', rules: sub }]);
  api.buildRuleIndex();
  if (!cases.every((c) => { const r = api.checkRuleMatchOptimized(...c); return r && r.blocked === true; })) return false;
  api.setState(wl, [{ enabled: true, url: 's1', rules: sub }]);
  api.buildRuleIndex();
  return cases.every((c) => { const r = api.checkRuleMatchOptimized(...c); return !r || r.blocked !== true; });
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
o = b('www3.example.com');
o = b('m.www.example.com');
o = b('example.com');
assert('规则-135: 裸域域名选项', o.domainRule === '*://*.example.com/*' && o.exactRule === '*://example.com/*');
o = b('1.2.3.4');
assert('规则-136: IP精确与域名同规则', o.isIP === true && o.domainRule === '*://1.2.3.4/*' && o.exactRule === '*://1.2.3.4/*' && o.whitelistRule === '@*://1.2.3.4/*' && o.suffixLike === false);
o = b('1.2.3.256');
o = b('');

// 公共后缀回退
o = b('news.bbc.co.uk');
o = b('www.co.uk');
assert('规则-140: www.co.uk 域名选项回退完整主机并标记后缀回退', o.domainRule === '*://*.www.co.uk/*' && o.suffixLike === true);
o = b('www.foo.bar');
o = b('com');
o = b('www.com');
o = b('m.co.uk');

// 规则键互异
const getRuleKey = new Function(extractFn(src, 'stripRuleComment') + '\n' + extractFn(src, 'getRuleKey') + '\nreturn getRuleKey;')();
assert('规则-152: 黑名单/白名单/高亮键互异, 尾注释剥离后键一致', getRuleKey('@*://a.com/*') !== getRuleKey('*://a.com/*') && getRuleKey('@1 *://a.com/*') !== getRuleKey('*://a.com/*') && getRuleKey('@1 *://a.com/*') !== getRuleKey('@2 *://a.com/*') && getRuleKey('*://a.com/* #+ note') === getRuleKey('*://a.com/*'));
}

// ---- 规则-160~17x: 校验(空正则/畸形scheme/flags) ----
{
const api = makeRulesApi();
assert('规则-160: 空正则与空白正则判定无效', api.analyzeRule('//').valid === false && api.analyzeRule('/   /').valid === false);
assert('规则-162: **:// 与 *://**.x 判定无效; 路径尾部/**不误伤', api.analyzeRule('**://example.com/*').valid === false && api.analyzeRule('*://**.example.com/*').valid === false && api.analyzeRule('*://*.example.com/**').valid === true);
assert('规则-163: 重复flags判定无效; 合法flags有效', api.analyzeRule('title/x/ii').valid === false && api.analyzeRule('text/x/uu').valid === false && api.analyzeRule('title/x/iu').valid === true);
assert('规则-164: 任意长度尾段含g/y不再静默并入正则', api.analyzeRule('title/x/gim').valid === false && api.analyzeRule('text/x/gyi').valid === false && api.analyzeRule('title/a/b').valid === true);
assert('规则-165: 畸形scheme拒绝; 具体scheme有效', api.analyzeRule('1*://example.com/*').valid === false && api.analyzeRule('http*://example.com/*').valid === false && api.analyzeRule('https://example.com/*').valid === true);
assert('规则-169: 全转义斜杠=无闭合界定符按未闭合报错; 带闭合界定符有效', api.analyzeRule('title/https:\\/\\/foo\\/i').valid === false && api.analyzeRule('title/https:\\/\\/foo\\/i/').valid === true);
assert('规则-171: title/无尾斜杠(含吞@if形态)直接报错', api.analyzeRule('title/abc @if(title *= "x")').valid === false && api.analyzeRule('title/abc/ @if(title *= "x")').valid === true);
assert('规则-283: 目录白名单以/结尾放行子路径', (() => {
  api.setState(['*://*.example.com/*', '@*://example.com/docs/']); api.buildRuleIndex();
  const r = api.checkRuleMatchOptimized('https://example.com/docs/intro', 'example.com', 't', '', ['example.com', 'com']);
  return !!r && r.whitelisted === true;
})());
assert('规则-284: 紧贴未闭合@if判无效', api.analyzeRule('*://x.com/*@if(scheme=https').valid === false && api.analyzeRule('@*://*.x.com/*@if(scheme=https').valid === false);
assert('规则-285: 正则/字符串内@if(不误判', api.analyzeRule('title/@if(foo)/').valid === true);
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
}
// 易错留档: 前缀规则模式含未转义/且注释以/结尾时, scanRuleString 的 isBadRegexTail 保护会跳过注释剥离, 注释混入正则致规则静默失效

// ---- 规则-180~19x: 重定向解包 ----
{
const getCleanUrl = makeCleanUrlApi();
assert('规则-180: 解码 uddg 重定向且只读不回写', (() => {
  const link = { href: 'https://duckduckgo.com/l/?uddg=https%3A%2F%2Ftarget.example.com%2Fpath%3Fa%3D1&rut=xxx' };
  const out = getCleanUrl(link);
  return out === 'https://target.example.com/path?a=1' && link.href.indexOf('uddg=') !== -1;
})());
assert('规则-185: yahoo 复杂路径 /RK= 截断与路径保留', getCleanUrl({ href: 'https://search.yahoo.com/r/_ylt=Awr9Il1j/RU=https%3A%2F%2Fexample.com%2Fnested%2Fpath/RK=2/RS=abc123xyz' }) === 'https://example.com/nested/path');
assert('规则-185b: yahoo_japan 解包 RU= 且保留路径', getCleanUrl({ href: 'https://r.search.yahoo.co.jp/_ylt=A/RU=https%3A%2F%2Fexample.com%2Fjp%2Fpath/RK=2/RS=x' }) === 'https://example.com/jp/path');
assert('规则-191: yahoo 套 yahoo 解到最终结果', getCleanUrl({ href: 'https://r.search.yahoo.com/_ylt=A/RV=1/RU=https%3A%2F%2Fr.search.yahoo.com%2FRV%3D2%2FRU%3Dhttps%253A%252F%252Fexample.com%252Fpage%2FRK%3D2/RK=2/RS=x' }) === 'https://example.com/page');
assert('规则-192: bing ck 套 yahoo RU= 解到最终结果', (() => {
  const bingYahoo = { href: 'https://www.bing.com/ck/a?!&&u=a1' + Buffer.from('https://r.search.yahoo.com/_ylt=A/RU=https%3A%2F%2Fexample.com%2Fpage/RK=2/RS=x').toString('base64url') };
  return getCleanUrl(bingYahoo) === 'https://example.com/page';
})());
assert('规则-286: data-url仅360/搜狗读取, 自定义引擎用href', getCleanUrl({ href: 'https://target.example/a', getAttribute: (n) => n === 'data-url' ? 'https://cdn.example/x' : null }, 'example') === 'https://target.example/a' && getCleanUrl({ href: 'https://m.so.com/link?m=x', getAttribute: (n) => n === 'data-mdurl' ? 'https://target.example/a' : null }, 'so360') === 'https://target.example/a');
const unwrap = new Function(`${ENGINE_HOST_SRC}\n` + ['decodeRedirectTarget', 'decodeBingCkTarget', 'unwrapRedirectUrl', 'isEngineHost'].map((n) => extractFn(src, n)).join('\n') + '\nreturn unwrapRedirectUrl;')();
assert('规则-194: /aclk?adurl 与 /pagead/aclk 解包', unwrap('https://www.google.com/aclk?sa=l&adurl=https%3A%2F%2Fads.example.com%2Fx') === 'https://ads.example.com/x' && unwrap('https://www.google.com/pagead/aclk?adurl=https%3A%2F%2Fads.example.com%2Fy') === 'https://ads.example.com/y');
const opaque = new Function(`${ENGINE_HOST_SRC}\n` + ['decodeRedirectTarget', 'isOpaqueRedirectUrl', 'isEngineHost'].map((n) => extractFn(src, n)).join('\n') + '\nreturn isOpaqueRedirectUrl;')();
const resolveDomain = new Function(`${ENGINE_HOST_SRC}\n` + ['decodeRedirectTarget', 'decodeBingCkTarget', 'unwrapRedirectUrl', 'isOpaqueRedirectUrl', 'getCleanUrl', 'resolveUrlDomain', 'isEngineHost'].map((n) => extractFn(src, n)).join('\n') + '\nconst currentConfig = { removeRedirects: true };\nfunction toASCIIUrl(u) { return u; }\nfunction toASCIIHostname(h) { return h; }\nreturn resolveUrlDomain;')();
const realGotoToken = 'CAESdwHrOzAVviBTh0oG5HfKYOFhyRtw29uZRfju1ROpYoFN1tfC6B8zJfQueB8aSNp2eVjuHmYa_7JCnfQZ1yvAwsuCdGJ7aZ9Xzjl_kWh6hOo4Q_HrKX1C4fqKyX-fE5A1ehwz3w0ml64RCxA8QFWwLII6XEe1HIgI';
const realGoto = 'https://www.google.com/goto?url=' + realGotoToken;
assert('规则-195: goto CAES 原样返回且判为不透明', unwrap(realGoto) === realGoto && opaque(realGoto) === true);
assert('规则-196: /url 无目标参数判为不透明而明文参数不判', unwrap('https://www.google.com/url?sa=t') === 'https://www.google.com/url?sa=t' && opaque('https://www.google.com/url?sa=t') === true && opaque('https://www.google.com/url?q=https%3A%2F%2Fexample.com%2Fa') === false);
// 易错留档: so360 /jump 真实参数为明文u(2026-10移动端m.so.com实测), PC端/link?m=为加密串不可解, url仅作兜底
assert('规则-199: so360 /jump明文u解链且url兜底, /link?m=原样保留(修复留档, 主/Lite)', unwrap('https://m.so.com/jump?u=https://www.so.com/&m=0755c0&from=m.so.com') === 'https://www.so.com/' && unwrap('https://www.so.com/jump?url=https%3A%2F%2Fexample.com%2Fa') === 'https://example.com/a' && unwrap('https://www.so.com/link?m=xxx') === 'https://www.so.com/link?m=xxx' && SERH_RAW_EXTRACT(src, 'unwrapRedirectUrl') === SERH_RAW_EXTRACT(fs.readFileSync(path.join(scriptDir, 'Lite.user.js'), 'utf8'), 'unwrapRedirectUrl'));
}

// ==== 二、修复回归 ====

// ---- 规则-203~221: ScriptConfig头 / 垃圾文本拒绝 / 空文件确认 ----
await (async () => {
const parseSyncHeaderFn = extractFn(src, 'hasTopLevelComma') + '\n' + extractFn(src, 'parseSyncHeader');
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
    function registerMenu() {}
    function t(key) { return key; }
    let confirmAnswer = null; let confirmCalls = 0; hooks.confirmMessages = hooks.confirmMessages || [];
    function confirm(msg) { confirmCalls++; hooks.confirmMessages.push(msg); return confirmAnswer === null ? true : confirmAnswer; }
    hooks.getConfirmCalls = () => confirmCalls; hooks.setConfirmAnswer = (v) => { confirmAnswer = v; };
    function validateRule(rule) { const s = String(rule).trim(); return s.length > 0 && !/\\s/.test(s); }
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
  fakeInput.listeners.cancel[0]();
}

// 正常选择文件
{
  const { env, api, fakeInput } = createEnv();
  api.importRulesFromFile();
  fakeInput.files = [{ _content: 'rule1\nrule2' }];
  fakeInput.onchange({ target: fakeInput });
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
  fakeInput.files = [{ _content: '# ScriptConfig: {"language":"en-US"}' }];
  fakeInput.onchange({ target: fakeInput });
  const saved = env.hooks.written.find((w) => w.key === 'searchfilter_blocker');
  assert('规则-221b: 仅设置头文件不弹清空确认, 设置导入且本地规则保留', env.hooks.getConfirmCalls() === 0 && !!saved && saved.val.language === 'en-US' && saved.val.rules.join() === 'old.com');
}
{
  const { env, api, fakeInput } = createEnv(['old.com']);
  api.importRulesFromFile();
  fakeInput.files = [{ _content: '# Selectors: {"bing":{"containers":".x"}}' }];
  fakeInput.onchange({ target: fakeInput });
  const saved = env.hooks.written.find((w) => w.key === 'searchfilter_blocker');
  assert('规则-221c: 仅引擎头文件不弹清空确认, 选择器导入且本地规则保留', env.hooks.getConfirmCalls() === 0 && env.hooks.written.some((w) => w.key === 'searchfilter_selectors' && w.val.bing.containers === '.x') && !!saved && saved.val.rules.join() === 'old.com');
}
{
  const { env, api, fakeInput } = createEnv(['old.com']);
  api.importRulesFromFile();
  fakeInput.files = [{ _content: '# ScriptConfig: {"subscriptions":[{"url":"https://s/1","name":"S1"}]}' }];
  fakeInput.onchange({ target: fakeInput });
  const saved = env.hooks.written.find((w) => w.key === 'searchfilter_blocker');
  assert('规则-221d: 仅订阅头文件不弹清空确认, 订阅导入且本地规则保留', env.hooks.getConfirmCalls() === 0 && !!saved && saved.val.rules.join() === 'old.com' && !!env.hooks.subsSaved && env.hooks.subsSaved.some((s) => s.url === 'https://s/1'));
}
{
  const { env, api, fakeInput } = createEnv(['old.com']);
  api.importRulesFromFile();
  env.hooks.setConfirmAnswer(true);
  fakeInput.files = [{ _content: '' }];
  fakeInput.onchange({ target: fakeInput });
  const saved = env.hooks.written[0] && env.hooks.written[0].val;
}
{
  const { env, api, fakeInput } = createEnv([]);
  api.importRulesFromFile();
  fakeInput.files = [{ _content: '' }];
  fakeInput.onchange({ target: fakeInput });
}
{
  const { env, api, fakeInput } = createEnv(['old.com']);
  api.importRulesFromFile();
  env.hooks.setConfirmAnswer(false);
  fakeInput.files = [{ _content: '# title: my rules\n# author: me' }];
  fakeInput.onchange({ target: fakeInput });
}

// 订阅随脚本配置导出/导入
{
  const { api } = createEnv();
  api.setSubscriptions([{ url: 'https://a/x', name: 'A', enabled: true, rules: ['r1'], lastUpdate: 5 }]);
  const added = api.applyImportedSubscriptions([{ url: 'https://a/x', name: 'A2' }, { url: 'https://b/y', enabled: false }]);
  const subs = api.getSubscriptions();
}
{
  const { env, api, fakeInput } = createEnv();
  api.importRulesFromFile();
  fakeInput.files = [{ _content: '# ScriptConfig: {"language":"en-US","subscriptions":[{"url":"https://s/1","name":"S1","enabled":true}]}\nrule1' }];
  fakeInput.onchange({ target: fakeInput });
}

// 同步头解析(仅剥离头行, 其余#注释保留)
{
  const run = (content) => new Function('currentConfig', 'console', `${parseSyncHeaderFn}\nreturn parseSyncHeader;`)({ debug: false }, { warn: () => {} })(content);
  let r = run('# uBlacklist backup rules\n# ScriptConfig: {"a":1}\nrule1');
  r = run('# ScriptConfig: {"a":1}\n# 我的分组注释\n# Selectors: []\nrule1');
  r = run('# ScriptConfig: {"a":1}\n# Selectors: {"bing":{"match":"a","containers":".x","extraElements":["[data-e=\\"a,b\\"]"]}}\nrule1');
  r = run('# ScriptConfig: {"a":1}\n# ScriptConfig: {"b":2}\nrule1');
  assert('规则-214: 重复头取首个, 后部伪头按注释保留正文', r.config.a === 1 && r.config.b === undefined && r.restLines.join('\n') === '# ScriptConfig: {"b":2}\nrule1');
  r = run('# ScriptConfig:{"syncedAt":12\nrule1');
  assert('规则-215: JSON截断头行剔除出 restLines 且不重发', r.config === null && r.rawScriptConfig === null && r.restLines.join('\n') === 'rule1');
  r = run('\uFEFF# title: my rules\n# author: me\n*://bad.example.com/*');
}
})();

// ---- 规则-230~24x: 三方合并 ----
{
const mergeApi = new Function(SERH_FN_DEPS + '\n' + SERH_RAW_EXTRACT(src, 'stripRuleComment') + '\n' + SERH_RAW_EXTRACT(src, 'getRuleKey') + '\n' + SERH_RAW_EXTRACT(src, 'mergeRules3Way') + '\nreturn mergeRules3Way;')();
const B_OLD = '*://b.com/* # old', B_NEW = '*://b.com/* # new';
assert('规则-230: 一方移动+删规则, 他方仅改其行尾注释 → 修改保留且追加尾部不乱序', JSON.stringify(mergeApi(['A', B_OLD, 'C'], ['C', 'A'], ['A', B_NEW, 'C'])) === JSON.stringify(['C', 'A', B_NEW]));
assert('规则-232: 单方插入 → 新规则锚定原位', JSON.stringify(mergeApi(['A', 'B', 'C'], ['A', 'X', 'B', 'C'], ['A', 'B', 'C'])) === JSON.stringify(['A', 'X', 'B', 'C']));
}

// ---- 规则-240~24x: 元素规则与注释剥离边界 ----
{
const api = makeRulesApi();
assert('规则-240: 带空格元素规则不被截断成裸域且报不支持', (() => {
  const stripped = api.analyzeRule('example.com ##.ad');
  return stripped.valid === false && stripped.errors.some((e) => /元素规则/.test(e));
})());
}

// ---- 规则-250~25x: 订阅规则类型守卫 / YAML探测回退 ----
{
const api = makeRulesApi();

const plainApi = new Function('function t(k) { return k; }\nconst currentConfig = { debug: false };\n' +
  extractFn(src, 'extractYamlRuleItems') + '\n' + extractFn(src, 'parseRulesetContent') + '\nreturn parseRulesetContent;')();
// 标量引号仅在起始处生效, 中部撇号不吞注释与后续段
assert('规则-252: flow值中部撇号+尾注释不吞后文段落', (() => {
  const r = plainApi("rules: [bob's.com, x.com] # don't\nwhitelist:\n  - d.com\n...\n@@|https://x.com/p[1]\n");
  return JSON.stringify(r.lines) === JSON.stringify(["bob's.com", 'x.com', '@d.com']);
})());
}

// ---- 规则-254~25x: @N 与 @if 紧贴写法修复留档 ----
{
const api = makeRulesApi();
api.setState(['@2@if(title *= "kw")', '@1 @if(title *= "x")'], []); api.buildRuleIndex();
const cr = api.getCR();
assert('规则-254: @N@if(...) 无空格与有空格等价, 归入高亮条件表达式而非被整条拒绝', cr.highlightConditionalRules.some(e => e.N === 2 && e.type === 'expr' && e.conditions.length === 1) && cr.whitelistConditionalRules.length === 0 && api.validateRule('@2@if(title *= "kw")') === true);
}

// ---- 规则-265: 引擎自身域名保护对协议前缀match生效(修复留档, 主/Lite) ----
{
const makeSelfDomain = (host, engineId) => new Function(
  'const window = { location: { hostname: ' + JSON.stringify(host) + ' } };\n' +
  'const SELECTORS_MOCK = { google: { match: /^https?:\\/\\/(?:www\\.)?google\\.(?:[a-z]{2,3}(?:\\.[a-z]{2})?|[a-z]{4,})(?::\\d+)?\\//i }, bing: { match: /^(?:(?:www|m)\\.)?bing\\.(?:com|[a-z]{2,3})$/ } };\n' +
  'const getSelectors = () => SELECTORS_MOCK;\n' +
  'const getSearchEngine = () => ' + JSON.stringify(engineId) + ';\n' +
  extractFn(src, 'isEngineSelfDomain') + '\nreturn isEngineSelfDomain;'
)();
assert('规则-265: google父域保护生效且非引擎域不误拦', makeSelfDomain('www.google.com', 'google')('google.com') === true && makeSelfDomain('www.google.com', 'google')('example.com') === false);
}

// ---- 规则-267: ///类外裸斜杠正则修复留档(主/Lite) ----
{
const api = makeRulesApi();
// 修复留档: 裸正则按末斜杠取pattern, 校验须拒绝类外未转义裸/, 否则///会被编译为匹配所有URL的规则且自检无告警(对齐uBlacklist语法)
assert('规则-267: ///与////等类外裸斜杠正则判定无效', api.analyzeRule('///').valid === false && api.analyzeRule('////').valid === false && api.analyzeRule('/a/b/').valid === false);
}

// ---- 规则-269: YAML嵌套节回退(主版) ----
{
const api = makeFilterApi();
// 修复留档: 嵌套子节后平铺列表项沿用嵌套节kind致屏蔽/放行反转, 以节栈按缩进回落回退外层节(对齐uBlacklist语义)
const nested = api.parseRulesetContent('name: N\nrules:\n  - keep1.com\n  - sub.com:\n      whitelist:\n        - ok.com\n  - keep2.com\n  - keep3.com\n');
assert('规则-269: 嵌套whitelist子节结束后平铺项回退rules不再误加@', JSON.stringify(nested.lines) === JSON.stringify(['keep1.com', 'sub.com:', '@ok.com', 'keep2.com', 'keep3.com']));
}

// ---- 规则-277: 合法正则含HTML标签不误判(修复留档, 主/Lite) ----
{
const api = makeFilterApi();
assert('规则-277: 合法正则含<body>时放行且真实HTML错误页仍拒绝', api.isNonRuleTextResponse(['/<body/i'], false) === false && api.isNonRuleTextResponse(['<html><body>login</body></html>'], false) === true);
}

// ---- 规则-278: Lite保存三方合并(修复留档) ----
{
const liteSrc = fs.readFileSync(path.join(scriptDir, 'Lite.user.js'), 'utf8');
const liteMerge = new Function(SERH_FN_DEPS + '\n' + SERH_RAW_EXTRACT(liteSrc, 'stripRuleComment') + '\n' + SERH_RAW_EXTRACT(liteSrc, 'getRuleKey') + '\n' + SERH_RAW_EXTRACT(liteSrc, 'mergeRules3Way') + '\nreturn mergeRules3Way;')();
// 修复留档: Lite saveConfig原为追加式合并, 他侧删除的规则会随保存复活, 已对齐主版mergeRules3Way
assert('规则-278: Lite mergeRules3Way与主版逐字节一致, 他侧删除不复活且纯新增保留', SERH_RAW_EXTRACT(src, 'mergeRules3Way') === SERH_RAW_EXTRACT(liteSrc, 'mergeRules3Way') && JSON.stringify(liteMerge(['*://r.com/*'], ['*://r.com/*'], [], true)) === '[]' && JSON.stringify(liteMerge([], [], ['*://n.com/*'], true)) === JSON.stringify(['*://n.com/*']));
}

// ---- 规则-281: Lite导入# Selectors头(修复留档) ----
{
  const liteSrc = fs.readFileSync(path.join(scriptDir, 'Lite.user.js'), 'utf8');
  const liteParse = new Function(`const document = { querySelector: () => true };
    ${SERH_RAW_EXTRACT(liteSrc, 'hasTopLevelComma')}
    ${SERH_RAW_EXTRACT(liteSrc, 'hasPseudoElement')}
    ${SERH_RAW_EXTRACT(liteSrc, 'isValidCssSelector')}
    ${SERH_RAW_EXTRACT(liteSrc, 'selectorPatchOk')}
    ${SERH_RAW_EXTRACT(liteSrc, 'parseConfigHeader')}
    return parseConfigHeader;`)();
  // 修复留档: Lite导入须识别# Selectors头并从正文剔除, 与主版parseSyncHeader同口径
  const header = '# Selectors:' + JSON.stringify({ example: { containers: '.result, .result2', match: '/^example\\.com$/' } });
  const parsed = liteParse([header, '*://a.com/*']);
  const bad = liteParse(['# Selectors:{bad', '*://a.com/*']);
  const cfgBad = liteParse(['# ScriptConfig:{bad', '*://a.com/*']);
  assert('281b: Lite drops malformed ScriptConfig header', cfgBad.settings === null && JSON.stringify(cfgBad.rest) === JSON.stringify(['*://a.com/*']));
  assert('规则-281: Lite导入识别# Selectors头且不把该行当规则', !!(parsed.selectors && parsed.selectors.example && parsed.selectors.example.containers === '.result, .result2') && JSON.stringify(parsed.rest) === JSON.stringify(['*://a.com/*']) && JSON.stringify(bad.rest) === JSON.stringify(['*://a.com/*']));
}

// ---- 规则-279/280: URL规则解码匹配 / 通配校验撇号(修复留档) ----
{
  const api = makeFilterApi();
  assert('规则-279: URL通配允许撇号且仍拒绝尖括号与双引号', api.validateUrlWildcard("https://example.com/it's") === true && api.validateUrlWildcard('https://example.com/a<b') === false && api.validateUrlWildcard('https://example.com/a"b') === false);
}
{
  const api = makeRulesApi(); api.setState(['example.com/中文', 'example.com/路径 @if(title *= "x")'], []); api.buildRuleIndex();
  const chk = (u, title) => api.checkRuleMatchOptimized(u, 'www.example.com', title, '', ['www.example.com', 'example.com']);
  const r = chk('https://www.example.com/%E4%B8%AD%E6%96%87');
  const r2 = chk('https://www.example.com/%E8%B7%AF%E5%BE%84', 'x');
  const r3 = chk('https://www.example.com/%E8%B7%AF%E5%BE%84', 'y');
  assert('规则-280: 普通及带@if的URL规则都按解码后的百分号编码路径命中', !!(r && r.blocked === true) && !!(r2 && r2.blocked === true) && !(r3 && r3.blocked === true));
}

// 易错: 优先级依赖规则拼接顺序, getRuleKey 以去注释正文为键会合并重复行
// 留档: 主机含@的裸规则(如@1@x.com忘加空格)会被静默接受为永不命中的白名单死规则
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

})();
