// 读取上一级目录的 *.*.*.user.js 或 Lite.user.js
// 规则逻辑 / 优先级 / 统计 / 一键屏蔽 / 去除重定向 / 修复回归
// 命名：规则-序号: 描述
// 忽略：ipv6识别(ipv6刷新频繁屏蔽无实际意义)、错误flags静默、正则与flags间空格、切换语言不重建主面板

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
  const redirDeps = /\bunwrapRedirectUrl\b|\bisOpaqueRedirectUrl\b|\bdecodeRedirectOnce\b/.test(body) ? 'var _redirectSpecsCache = new Map();\n' + (text.match(/const REDIRECT_CODECS = \{[\s\S]*?\n  \};/) || [''])[0].replace('const REDIRECT_CODECS', 'var REDIRECT_CODECS') + '\n' + ['redirectsEnabled', 'getRedirectSpecs', 'decodeRedirectOnce', 'unwrapRedirectUrl', 'hasRedirectSpec', 'isOpaqueRedirectUrl'].map((n) => SERH_RAW_EXTRACT(text, n)).join('\n') + '\n' : '';
  return (SERH_DEPS_RE.test(body) ? SERH_FN_DEPS + '\n' + SERH_FLAG_HELPERS + '\n' + SERH_EL_HELPERS + '\n' : '') + redirDeps + body;
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
const ENGINE_HOST_SRC = String.raw`
const ENGINE_HOSTS = {
  bing: /^https?:\/\/(?:[a-z0-9-]+\.)*bing\.(?:com|[a-z]{2,3}(?:\.[a-z]{2})?)(?:[\/?#]|$)/i,
  google: /^https?:\/\/(?:(?:www|images|video|videos|search|encrypted|m)\.)?google\.[a-z0-9.-]+(?:[\/?#]|$)/i,
  google_scholar: /^https?:\/\/(?:www\.)?scholar\.google\.[a-z0-9.-]+(?:[\/?#]|$)/i,
  duckduckgo: /^https?:\/\/(?:(?:www|html|start|m|safe|noai)\.)?(?:duckduckgo\.com|ddg\.gg)(?:[\/?#]|$)/i,
  yahoo: /^https?:\/\/(?:[a-z0-9-]+\.)*(?:(?:images|video|videos|news)\.)?(?:r\.)?search\.yahoo\.(?:com|[a-z]{2,3}(?:\.[a-z]{2})?)(?:[\/?#]|$)/i,
  yahoo_japan: /^https?:\/\/(?:[a-z0-9-]+\.)*(?:(?:search|rd|rds|rdsig|ard)\.yahoo\.co\.jp|news\.yahoo\.co\.jp)(?:[\/?#]|$)/i,
  so360: /^https?:\/\/(?:[a-z0-9-]+\.)*so\.com(?:[\/?#]|$)/i,
  sogou: /^https?:\/\/(?:[a-z0-9-]+\.)*sogou\.com(?:[\/?#]|$)/i,
  toutiao: /^https?:\/\/(?:[a-z0-9-]+\.)*toutiao\.com(?:[\/?#]|$)/i
};
function isEngineHost(engine, host) { const re = ENGINE_HOSTS[engine]; return !!re && re.test(String(host || '')); }
function getSelectors() {
  return {
    bing: { includeRegex: ENGINE_HOSTS.bing, link: { redirects: [{ path: /^\/ck\/a/, params: ['u'], codec: 'base64url', stripPrefix: /^a[01]/i }] } },
    google: { includeRegex: ENGINE_HOSTS.google, link: { redirects: [{ path: /^\/(?:url|goto)\/?$/, params: ['q', 'url', 'u'], codec: 'url' }, { path: /^(?:\/aclk|\/imgres|\/translate|\/pagead\/aclk)(?:\/|\?|$)/, params: ['adurl', 'imgurl', 'url', 'u', 'dest'], codec: 'url' }] } },
    google_scholar: { includeRegex: ENGINE_HOSTS.google_scholar, link: { redirects: [{ path: /\/scholar_url\/?$/, params: ['url'], codec: 'url' }] } },
    duckduckgo: { includeRegex: ENGINE_HOSTS.duckduckgo, link: { redirects: [{ path: /^\/l\/?$/, params: ['uddg'], codec: 'url' }] } },
    yahoo: { includeRegex: ENGINE_HOSTS.yahoo, link: { redirects: [{ path: /^\/(?:r|rd)(?:\/|$)|ru=|\/\*/i, pathValue: /(?:^|\/)RU=([\s\S]*?)(?=(?:\/(?:rk|rs|rv|ro|re|rh|rt|_ylt|_ylu)=|\/$|$))/i, hrefSuffix: /\/\*+-?(https?(?::|%3A)[\s\S]*)$/i, params: ['u', 'url', 'target', 'dest', 'dst', 'r', 'ru'], codec: 'pattern' }] } },
    yahoo_japan: { includeRegex: ENGINE_HOSTS.yahoo_japan, link: { redirects: [{ path: /^\/(?:r|rd)(?:\/|$)|ru=|\/\*/i, pathValue: /(?:^|\/)RU=([\s\S]*?)(?=(?:\/(?:rk|rs|rv|ro|re|rh|rt|_ylt|_ylu)=|\/$|$))/i, hrefSuffix: /\/\*+-?(https?(?::|%3A)[\s\S]*)$/i, params: ['u', 'url', 'target', 'dest', 'dst', 'r', 'ru'], codec: 'pattern' }] } },
    toutiao: { includeRegex: ENGINE_HOSTS.toutiao, link: { redirects: [{ path: /^\/search\/jump\/?$/, params: ['url'], codec: 'url' }] } },
    so360: { includeRegex: ENGINE_HOSTS.so360, link: { redirects: [{ path: /^\/jump\/?$/, params: ['u', 'url'], codec: 'url' }, { path: /(?:\/tc\b|\/link\b)/, params: ['url'], codec: 'url' }] } },
    sogou: { includeRegex: ENGINE_HOSTS.sogou, link: { redirects: [{ path: /(?:\/tc\b|\/jump\b|\/link\b)/, params: ['url'], codec: 'url' }] } }
  };
}`;

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
  const fns = ['hostLabelToASCII', 'toASCIIHostname', 'punycodeDecodeLabel', 'toUnicodeHostname', 'toASCIIUrl', 'safeRegexTest', 'safeDecodeURIComponent', 'decodeUrlForMatch', 'redirectsEnabled', 'stripRuleComment', 'getInvalidRegexFlags', 'parseConditionPart',
    'tokenizeCondExpr', 'parseCondExprTokens', 'analyzeCondExpr', 'foldCondExpr',
    'evalDynamicLeaf', 'evalCondAST', 'extractBalancedParens', 'findIfOccurrences', 'stripIfConditions',
    'evaluateCondition', 'isCondExprCore', 'looksLikeCondExpr', 'absorbStandaloneExpr',
    'parseRuleWithConditions', 'validateUrlWildcard', 'ruleToRegex', 'parsePrefixedRegexRule',
    'escapeWildcardPart', 'wildcardToRegex', 'normalizeHostCandidate', 'matchWildcardDomainPattern',
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
const currentConfig = { rules: [], debug: false, highlightWhitelist: false };
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
  setConfig: (cfg) => Object.assign(currentConfig, cfg),
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
    'dbgWarn', 'dbg', 'dbgError',
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
  return new Function(`${ENGINE_HOST_SRC}\nfunction resolvePageDef(engine) { return engine === 'so360' || engine === 'sogou' ? { link: { directAttrs: ['data-mdurl', 'data-url', 'linkurl'], directScope: '.res-list, .vrwrap, .reactResult' } } : {}; }\n` + ['tryUrl', 'decodeRedirectTarget', 'cmdB64Text', 'decodeBase64UrlTarget', 'unwrapRedirectUrl', 'isOpaqueRedirectUrl', 'getCleanUrl', 'isEngineHost'].map((n) => extractFn(src, n)).join('\n') + '\nreturn getCleanUrl;')();
}

// ==== 一、核心行为 ====

// ---- 规则-001~009: 通配符与正则标志 ----
{
const api = makeWcApi();
const match = (rule, url) => { const c = api.compileRuleRegex(rule); return api.safeRegexTest(c.regex, url); };

// 通配符元字符转义与IDN
assert('规则-001: 点号转义不误吞且中文域名通配匹配punycode', !match('*://example.com/file.txt', 'https://example.com/filextxt') && !match('*://example.com/*', 'https://exampleXcom/') && match('*://*.例子.com/*', 'https://xn--fsqu00a.com/x'));
// 忽略该问题: 通配符与正则匹配极端规则可长时间占用主线程，极罕见问题无修复意义

// 锚定与通配范围
assert('规则-002: 路径与主机通配不跨界且显式scheme不匹配其他scheme', !match('*://example.com/path/*', 'https://evil.com/?u=example.com/path/') && !match('*://*.example.com/path/*', 'https://evil.com/x.example.com/path/') && !match('https://example.com/*', 'http://example.com/'));

// 裸域与无scheme
assert('规则-003: 无scheme与裸域规则不匹配前缀伪URL与后缀域名', !match('*.example.com', 'https://notexample.com/') && !match('*.example.com', 'https://evil.com/?u=example.com') && !match('*://example.com', 'https://example.com.evil.com/'));

// 端口
assert('规则-004: 显式端口匹配同端口且端口通配不跨越冒号至主机与路径', match('*://example.com:8080/path/*', 'https://example.com:8080/path/test') && !match('*://example.com:*/y', 'https://example.com/x/y') && !match('*://example.com:*/y', 'https://example.com:80/x/y'));

// 主机中部/尾部星号不跨点
assert('规则-005: 中部星号不跨点且*.example.*不匹配三段后缀', !match('*://mail.*.com/*', 'https://mail.a.b.com/') && match('*://mail.*.com/*', 'https://mail.a.com/') && match('*://*.example.*/*', 'https://www.example.co.uk/page') && !match('*://*.example.*/*', 'https://example.a.b.c/'));

// 正则 flags 边界
assert('规则-006: 尾部非flag斜杠路径保持完整且正常斜杠正确提取flags', (() => {
  const a = api.parsePrefixedRegexRule('title/something/is/other', 6);
  const b = api.parsePrefixedRegexRule('title/https:\\/\\/foo/i', 6);
  return a.flags === '' && a.pattern === 'something/is/other' && b.flags === 'i' && b.pattern === 'https:\\/\\/foo';
})());
assert('规则-007: 编译过滤非法flags且未闭合正则编译报错', (() => {
  const flags = api.compileRuleRegex('/foo/gyi').regex.flags;
  try { api.compileRuleRegex('/foo'); return false; } catch (e) { return flags.includes('i') && !flags.includes('g') && !flags.includes('y'); }
})());

// 修复回归: 路径前缀匹配族
assert('规则-008: 普通字符结尾不越界且分隔符结尾按前缀匹配并命中后续查询串', (() => {
  const c = api.compileRuleRegex('*://example.com/release');
  return !api.safeRegexTest(c.regex, 'https://example.com/releasex')
    && match('*://*.example.com/download/', 'https://a.example.com/download/file.zip') && match('example.com/', 'https://example.com/abc') && match('*://example.com/search?q=', 'https://example.com/search?q=abc')
    && match('*://x.com/*?a=b', 'https://x.com/z?a=b&c=d')
    && match('*://example.com/page', 'https://example.com/page?utm_source=x') && match('*://*.example.com/*.pdf', 'https://a.example.com/a.pdf?dl=1');
})());

// 非ASCII路径百分号编码
assert('规则-009: 中文路径通配命中百分号编码URL且原样UnicodeURL不直接命中(subject侧归一兜底)', match('*://example.com/中文/*', 'https://example.com/%E4%B8%AD%E6%96%87/x') === true && match('*://example.com/中文/*', 'https://example.com/中文/x') === false);
}

// ---- 规则-010~015: 订阅规则过滤 ----
{
const api = makeFilterApi();

// uBO 元素规则判定
const elementRuleLines = ['example.com##.ad', '##.ad', 'example.com#$#alert(1)', 'example.com#?#div:has(> span)', 'example.com#%#window.x=1'];
const scriptRuleLines = ['/foo##bar/', '*://example.com/##x', '*://*.example.com/*'];
assert('规则-010: 元素规则被识别且脚本规则不误判', elementRuleLines.every((rule) => api.isElementRuleLine(rule) === true) && scriptRuleLines.every((rule) => api.isElementRuleLine(rule) === false));

// 订阅保留/丢弃
const keepLines = ['!scheme="https"', '!(title *= "x" | url *= "y")', '*://*.example.com/*', '@1*://example.com/*', '*://x.com/* @if(title *= "@if(y)")', '*://x.com/* # comment', '!title:ad', '!url =~ /spam/', '!url:https://bad.example/', '!path: /x/'];
assert('规则-011: 合法订阅行全部保留且uBO网络规则被过滤与校验拒绝', keepLines.every((line) => api.collectSubscriptionRules([line]).length === 1) && api.collectSubscriptionRules(['||example.com^']).length === 0 && api.validateUrlWildcard('||example.com^') === false && api.validateRule('||example.com^') === false);

// frontmatter 与 YAML 端到端
// 易错留档: parseRulesetContent检测键白名单无title等元数据键, 无前导---的frontmatter写title加无空格单词值时该行被validateRule判为合法条件规则并中断检测, 整文件按纯文本导入混入幽灵屏蔽规则(主版)
// 易错留档: 裸---行可过validateRule, 无前导---且含未识别键的rules键体订阅在检测循环被---截断误判纯文本, 0条规则通过校验致导入失败且自动更新重复失败(主版)
const { lines } = api.parseRulesetContent('---\nname: Test\n---\n# c\n!scheme="https"\n*://*.example.com/*\n');
const yParsed = api.parseRulesetContent('name: Y List\nrules:\n  - example.com\n  - \'*://*.example.com/*\'\n  - example.com##.ad\n  - ||ubo.com^\n');
assert('规则-012: frontmatter组合过滤与YAML订阅提取过滤', JSON.stringify(api.collectSubscriptionRules(lines.map((l) => l.trim()))) === JSON.stringify(['!scheme="https"', '*://*.example.com/*']) && yParsed.meta.name === 'Y List' && JSON.stringify(api.collectSubscriptionRules(yParsed.lines.map((l) => l.trim()))) === JSON.stringify(['example.com', '*://*.example.com/*']));
const yWl = api.parseRulesetContent('name: Mix\nblacklist:\n  - ads.com\nrules:\n  - extra.com\nwhitelist:\n  - good.com\n  - "*://ok.com/*"\n');
assert('规则-013: YAML多段+whitelist加@', JSON.stringify(api.collectSubscriptionRules(yWl.lines.map((l) => l.trim()))) === JSON.stringify(['ads.com', 'extra.com', '@good.com', '@*://ok.com/*']));

const collect = (content) => api.collectSubscriptionRules(api.parseRulesetContent(content).lines.map((l) => l.trim()));
assert('规则-014: 折叠标量整段保留后续项不丢且无空格冒号键形标量保留', JSON.stringify(collect('rules:\n  - example.com\n  - >\n    *://folded.example.com/*\n  - kept.com\n')) === JSON.stringify(['example.com', '*://folded.example.com/*', 'kept.com']) && JSON.stringify(collect('rules:\n  - localhost:8080/*\n  - user:pass@host/page\n')) === JSON.stringify(['localhost:8080/*', 'user:pass@host/page']));
assert('规则-015: YAML matches段不导入为屏蔽规则且空规则段与---不成为规则', JSON.stringify(collect('name: M\nmatches:\n  - "*://www.google.com/search*"\n  - "https://x.com/*"\nrules:\n  - keep.com\n')) === JSON.stringify(['keep.com']) && collect('matches: ["*://a.com/*"]\n').length === 0 && api.parseRulesetContent('name: E\nrules: []\n').lines.length === 0 && collect('rules: []\n').length === 0 && collect('---\n').length === 0);
}

// ---- 规则-016~017: 来源标记 ----
{
const api = makeRulesApi();

api.setState(['*://*.local.com/*'], [{ url: 's1', enabled: true, rules: ['*://*.sub.com/*'] }]);
api.buildRuleIndex();
const cr2 = api.getCR();
assert('规则-016: 本地/订阅独有规则来源正确', cr2.domains.get('local.com')[0].source === '本地规则' && cr2.domains.get('sub.com')[0].source === '订阅1');

api.setState(['@1 @*://*.bad.com/*', '@2 @host $= ".bad2.com"', '@3 *://*.good.com/*'], []);
api.buildRuleIndex();
const cr3 = api.getCR();
const bothCompiled = cr3.highlightDomains.has('bad.com') && cr3.whitelistDomains.has('bad.com') && cr3.highlightConditionalRules.some(e => e.N === 2) && cr3.whitelistConditionalRules.length === 1;
api.setState(['@9 *://*.over.com/*'], []); api.buildRuleIndex();
assert('规则-017: 高亮+白名单同时编译且高亮级别>5回退@1', bothCompiled && api.getCR().highlightDomains.get('over.com')?.[0]?.N === 1);
}

// ---- 规则-018~021: 优先级矩阵 ----
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
function addBlDomain(cr, domain, type, rule, source) {
  if (!cr.domains.has(domain)) cr.domains.set(domain, []);
  cr.domains.get(domain).push({ type, originalRule: rule, source });
}

const host = 'www.example.com';
const url = 'https://www.example.com/page';
const sl = ['www.example.com', 'example.com'];
const doCheck = (cr, u, h, title, snippet) => { api.setCR(cr); return api.checkRuleMatchOptimized(u || url, h || host, title, snippet, sl); };

const crWl = makeCR(); addWlDomain(crWl, 'example.com', 'wildcard'); addBlDomain(crWl, 'example.com', 'wildcard', 'example.com', '本地规则');
const crBl = makeCR(); addBlDomain(crBl, 'example.com', 'wildcard', 'example.com', '本地规则'); addWlDomain(crBl, 'example.com', 'wildcard', '订阅规则1');
const crSub = makeCR(); addBlDomain(crSub, 'example.com', 'wildcard', 'example.com', '订阅规则1');
const rSub = doCheck(crSub, url, host, 'title');
assert('规则-018: 本地白名单>本地黑名单且本地黑名单>订阅白名单且订阅黑名单屏蔽来源为订阅', !isBlocked(doCheck(crWl, url, host, 'title')) && isBlocked(doCheck(crBl, url, host, 'title')) && isBlocked(rSub) && getSrc(rSub) === '订阅规则1');
assert('规则-019: 高亮与屏蔽同时返回仅高亮无屏蔽且多个高亮取最高N', (() => {
  const crA = makeCR(); crA.highlightDomains.set('example.com', [{ N: 2, type: 'wildcard' }]); addBlDomain(crA, 'example.com', 'wildcard', 'example.com', '本地规则');
  const crB = makeCR(); crB.highlightDomains.set('example.com', [{ N: 1, type: 'wildcard' }, { N: 3, type: 'wildcard' }]);
  const rA = doCheck(crA); const r1 = doCheck(crB);
  crB.highlightTitles.push({ N: 5, regex: /title/ });
  const r2 = doCheck(crB, url, host, 'title');
  return rA && rA.highlight === 2 && rA.blocked === true && r1 && r1.highlight === 3 && !r1.blocked && r2 && r2.highlight === 5;
})());
assert('规则-020: 空域名回退白名单@+命中规则可解订阅屏蔽死局(修复留档, 主/Lite)', (() => {
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
assert('规则-021: 高亮白名单开启后高亮命中不再屏蔽', (() => {
  const cr = makeCR(); cr.highlightDomains.set('example.com', [{ N: 2, type: 'wildcard', isLocal: true }]); addBlDomain(cr, 'example.com', 'wildcard', 'example.com', '本地规则');
  api.setConfig({ highlightWhitelist: false }); const off = doCheck(cr);
  api.setConfig({ highlightWhitelist: true }); const on = doCheck(cr); api.setConfig({ highlightWhitelist: false });
  return off && off.blocked === true && off.highlight === 2 && on && on.blocked !== true && on.whitelisted === true && on.highlight === 2;
})());
}

// ---- 规则-022~023: 一键屏蔽规则选项构建 ----
{
const build = new Function(
  SERH_CONSTS.hostPrefixes + '\n' + SERH_CONSTS.pubSuffix + '\n' +
  extractFn(src, 'isPublicSuffixBase') + '\n' + extractFn(src, 'buildBlockRuleOptions') + '\nreturn { buildBlockRuleOptions, isPublicSuffixBase };'
)();
const b = (h) => build.buildBlockRuleOptions(h);

const optionCases = [
  ['abc.example.com', (o) => o.isIP === false && o.domainRule === '*://*.abc.example.com/*' && o.exactRule === '*://abc.example.com/*'],
  ['www.example.com', (o) => o.domainRule === '*://*.example.com/*' && o.exactRule === '*://www.example.com/*' && o.suffixLike === false],
  ['example.com', (o) => o.domainRule === '*://*.example.com/*' && o.exactRule === '*://example.com/*'],
  ['1.2.3.4', (o) => o.isIP === true && o.domainRule === '*://1.2.3.4/*' && o.exactRule === '*://1.2.3.4/*' && o.whitelistRule === '@*://1.2.3.4/*' && o.suffixLike === false],
  ['www.co.uk', (o) => o.domainRule === '*://*.www.co.uk/*' && o.suffixLike === true],
];
assert('规则-022: 一键屏蔽选项构建含www前缀回退IP与公共后缀回退', optionCases.every(([h, ok]) => ok(b(h))));

// 规则键互异
const getRuleKey = new Function(extractFn(src, 'stripRuleComment') + '\n' + extractFn(src, 'getRuleKey') + '\nreturn getRuleKey;')();
assert('规则-023: 黑名单/白名单/高亮键互异, 尾注释剥离后键一致', getRuleKey('@*://a.com/*') !== getRuleKey('*://a.com/*') && getRuleKey('@1 *://a.com/*') !== getRuleKey('*://a.com/*') && getRuleKey('@1 *://a.com/*') !== getRuleKey('@2 *://a.com/*') && getRuleKey('*://a.com/* #+ note') === getRuleKey('*://a.com/*'));
}

// ---- 规则-024~025: 校验(空正则/畸形scheme/flags) ----
{
const api = makeRulesApi();
const invalidRules = ['//', '/   /', '**://example.com/*', '*://**.example.com/*', 'title/x/ii', 'text/x/uu', 'title/x/gim', 'text/x/gyi', '1*://example.com/*', 'http*://example.com/*', 'title/https:\\/\\/foo\\/i', 'title/abc @if(title *= "x")', '///', '////', '/a/b/'];
const validRules = ['*://*.example.com/**', 'title/x/iu', 'title/a/b', 'https://example.com/*', 'title/https:\\/\\/foo\\/i/', 'title/abc/ @if(title *= "x")', 'title/@if(foo)/'];
assert('规则-024: 空正则重复flags畸形scheme与类外裸斜杠判无效且合法形态有效', invalidRules.every((r) => api.analyzeRule(r).valid === false) && validRules.every((r) => api.analyzeRule(r).valid === true));
assert('规则-025: 目录白名单以/结尾放行子路径', (() => {
  api.setState(['*://*.example.com/*', '@*://example.com/docs/']); api.buildRuleIndex();
  const r = api.checkRuleMatchOptimized('https://example.com/docs/intro', 'example.com', 't', '', ['example.com', 'com']);
  return !!r && r.whitelisted === true;
})());
}

// ---- 规则-026: @N 前缀大小写与脚本规则后行内注释 ----
{
const api = makeRulesApi();
const strip = new Function(extractFn(src, 'stripRuleComment') + '\nreturn stripRuleComment;')();
assert('规则-026: @N高亮前缀大小写不敏感且脚本规则后行内##注释被截断裸域元素规则不受影响', (() => {
  api.setState(['@1TITLE/abc/', '@2Text/def/']); api.buildRuleIndex(); const cr = api.getCR();
  return cr.highlightTitles.length === 1 && cr.highlightTexts.length === 1 && strip('title/x/ ## n') === 'title/x/' && strip('example.com ##.ad') === 'example.com ##.ad';
})());
// stripRuleComment 保留 @/@N 前缀, 避免误删同核心的白名单/高亮规则
}
// 易错留档: 前缀规则模式含未转义/且注释以/结尾时, scanRuleString 的 isBadRegexTail 保护会跳过注释剥离, 注释混入正则致规则静默失效
// 修复留档: 撇号视为纯字符(scanRuleString不再置位inSQ), URL含撇号时注释剥离与@if识别恢复, @if内单引号保护由findBalancedParenEnd承担(主/Lite)
{
  const strip = new Function(extractFn(src, 'stripRuleComment') + '\nreturn stripRuleComment;')();
  const scan = new Function(extractFn(src, 'scanRuleString') + '\nreturn scanRuleString;')();
  const liteSrc = fs.readFileSync(['', 'other'].map((d) => path.join(scriptDir, d, 'Lite.user.js')).find((p) => fs.existsSync(p)), 'utf8');
  const liteStrip = new Function(extractFn(liteSrc, 'stripRuleComment') + '\nreturn stripRuleComment;')();
  const liteScan = new Function(extractFn(liteSrc, 'scanRuleString') + '\nreturn scanRuleString;')();
  const filterApi = makeFilterApi();
  assert('规则-027: URL撇号注释剥离与@if识别及单引号配平和通配校验放行(主/Lite)', strip("@*://example.com/it's # note") === "@*://example.com/it's" && liteStrip("@*://example.com/it's # note") === "@*://example.com/it's" && scan("*://x.com/a'b @if(title *= \"a\")", 'scan').occurrences.length === 1 && liteScan("*://x.com/a'b @if(title *= \"a\")", 'scan').occurrences.length === 1 && filterApi.validateUrlWildcard("https://example.com/it's") === true && filterApi.validateUrlWildcard('https://example.com/a<b') === false && filterApi.validateUrlWildcard('https://example.com/a"b') === false && (() => { const o = scan("*://x.com/* @if(site = 'a)b')", 'scan').occurrences; const ol = liteScan("*://x.com/* @if(site = 'a)b')", 'scan').occurrences; return o.length === 1 && o[0].endIndex === 28 && ol.length === 1 && ol[0].endIndex === 28; })());
}

// ---- 规则-028~034: 重定向解包 ----
{
const getCleanUrl = makeCleanUrlApi();
assert('规则-028: 解码 uddg 重定向且只读不回写', (() => {
  const link = { href: 'https://duckduckgo.com/l/?uddg=https%3A%2F%2Ftarget.example.com%2Fpath%3Fa%3D1&rut=xxx' };
  const out = getCleanUrl(link);
  return out === 'https://target.example.com/path?a=1' && link.href.indexOf('uddg=') !== -1;
})());
assert('规则-029: yahoo与yahoo_japan解包RU=且/RK=截断并保留路径', getCleanUrl({ href: 'https://search.yahoo.com/r/_ylt=Awr9Il1j/RU=https%3A%2F%2Fexample.com%2Fnested%2Fpath/RK=2/RS=abc123xyz' }) === 'https://example.com/nested/path' && getCleanUrl({ href: 'https://r.search.yahoo.co.jp/_ylt=A/RU=https%3A%2F%2Fexample.com%2Fjp%2Fpath/RK=2/RS=x' }) === 'https://example.com/jp/path');
assert('规则-030: yahoo套yahoo与bing ck套yahoo解到最终结果', (() => {
  const bingYahoo = { href: 'https://www.bing.com/ck/a?!&&u=a1' + Buffer.from('https://r.search.yahoo.com/_ylt=A/RU=https%3A%2F%2Fexample.com%2Fpage/RK=2/RS=x').toString('base64url') };
  return getCleanUrl({ href: 'https://r.search.yahoo.com/_ylt=A/RV=1/RU=https%3A%2F%2Fr.search.yahoo.com%2FRV%3D2%2FRU%3Dhttps%253A%252F%252Fexample.com%252Fpage%2FRK%3D2/RK=2/RS=x' }) === 'https://example.com/page' && getCleanUrl(bingYahoo) === 'https://example.com/page';
})());
assert('规则-031: data-url仅360/搜狗读取, 自定义引擎用href', getCleanUrl({ href: 'https://target.example/a', getAttribute: (n) => n === 'data-url' ? 'https://cdn.example/x' : null }, 'example') === 'https://target.example/a' && getCleanUrl({ href: 'https://m.so.com/link?m=x', getAttribute: (n) => n === 'data-mdurl' ? 'https://target.example/a' : null }, 'so360') === 'https://target.example/a');
const unwrap = new Function(`${ENGINE_HOST_SRC}\nvar _redirectSpecsCache = new Map();\n` + ['tryUrl', 'decodeRedirectTarget', 'getRedirectSpecs', 'decodeRedirectOnce', 'cmdB64Text', 'decodeBase64UrlTarget', 'unwrapRedirectUrl', 'isEngineHost'].map((n) => extractFn(src, n)).join('\n') + '\nreturn unwrapRedirectUrl;')();
assert('规则-032: /aclk?adurl 与 /pagead/aclk 解包', unwrap('https://www.google.com/aclk?sa=l&adurl=https%3A%2F%2Fads.example.com%2Fx') === 'https://ads.example.com/x' && unwrap('https://www.google.com/pagead/aclk?adurl=https%3A%2F%2Fads.example.com%2Fy') === 'https://ads.example.com/y');
const opaque = new Function(`${ENGINE_HOST_SRC}\nvar _redirectSpecsCache = new Map();\n` + ['tryUrl', 'decodeRedirectTarget', 'getRedirectSpecs', 'hasRedirectSpec', 'isOpaqueRedirectUrl', 'isEngineHost'].map((n) => extractFn(src, n)).join('\n') + '\nreturn isOpaqueRedirectUrl;')();
const realGotoToken = 'CAESdwHrOzAVviBTh0oG5HfKYOFhyRtw29uZRfju1ROpYoFN1tfC6B8zJfQueB8aSNp2eVjuHmYa_7JCnfQZ1yvAwsuCdGJ7aZ9Xzjl_kWh6hOo4Q_HrKX1C4fqKyX-fE5A1ehwz3w0ml64RCxA8QFWwLII6XEe1HIgI';
const realGoto = 'https://www.google.com/goto?url=' + realGotoToken;
assert('规则-033: goto CAES原样返回判为不透明且/url无目标参数判为不透明而明文参数不判', unwrap(realGoto) === realGoto && opaque(realGoto) === true && unwrap('https://www.google.com/url?sa=t') === 'https://www.google.com/url?sa=t' && opaque('https://www.google.com/url?sa=t') === true && opaque('https://www.google.com/url?q=https%3A%2F%2Fexample.com%2Fa') === false);
// 易错留档: so360 /jump 真实参数为明文u(2026-10移动端m.so.com实测), PC端/link?m=为加密串不可解, url仅作兜底
assert('规则-034: so360 /jump明文u解链且url兜底, /link?m=原样保留(修复留档, 主/Lite)', unwrap('https://m.so.com/jump?u=https://www.so.com/&m=0755c0&from=m.so.com') === 'https://www.so.com/' && unwrap('https://www.so.com/jump?url=https%3A%2F%2Fexample.com%2Fa') === 'https://example.com/a' && unwrap('https://www.so.com/link?m=xxx') === 'https://www.so.com/link?m=xxx');
}

// ==== 二、修复回归 ====

// ---- 规则-035~040: ScriptConfig头 / 垃圾文本拒绝 / 空文件确认 ----
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
    ${extractFn(src, 'parseRegexLiteral')}
    ${extractFn(src, 'sanitizeRegexFlags')}
    ${extractFn(src, 'isRegexLiteralStr')}
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


// TXT导入读取 # ScriptConfig 头并应用设置
{
  const { env, api, fakeInput } = createEnv();
  api.importRulesFromFile();
  fakeInput.files = [{ _content: '# ScriptConfig: {"language":"en-US","showBubble":false,"syncedAt":123,"rulesSyncedAt":456,"bubbleState":{"x":1},"bubbleSize":99,"selectors":{"bing":{"match":"a"}}}\nrule1' }];
  fakeInput.onchange({ target: fakeInput });
  const saved = env.hooks.written[0] && env.hooks.written[0].val;
  assert('规则-035: TXT导入只覆盖头里出现的键且时间戳气泡本地态选择器不随导入且头行剥离后规则落盘保存刷新重处理各一次', env.hooks.written.length === 1 && saved.language === 'en-US' && saved.showBubble === false && saved.subscriptionAutoUpdate === true && saved.enabled === true && saved.bubbleAction === 'openPanel' && saved.syncedAt === undefined && saved.rulesSyncedAt === undefined && saved.bubbleState === undefined && saved.bubbleSize === 30 && saved.selectors === undefined && saved.rules.join() === 'rule1' && env.textarea.value === 'rule1' && env.hooks.persistCalls === 1 && env.hooks.persistMark === true && env.hooks.applyCalls === 1 && env.hooks.reprocessCalls === 1 && env.hooks.updateLineNumbersCalls === 1);
}


// # Selectors 头
{
  const { env, api, fakeInput } = createEnv();
  api.importRulesFromFile();
  fakeInput.files = [{ _content: '# Selectors: {"bing":{"containers":".x"}}\n# ScriptConfig: {"language":"en-US"}\nrule1' }];
  fakeInput.onchange({ target: fakeInput });
  assert('规则-036: TXT导入应用# Selectors头选择器并标记选择器修改时间', env.hooks.written.length === 3 && env.hooks.written[0].key === 'searchfilter_selectors' && env.hooks.written[0].val.bing.containers === '.x' && env.hooks.written[1].key === 'searchfilter_selectors_last_modified' && env.hooks.written[2].key === 'searchfilter_blocker' && env.hooks.written[2].val.language === 'en-US' && env.hooks.refreshCalls === 1);
}

// 垃圾文本导入拒绝
{
  const run = (content) => {
    const { env, api, fakeInput } = createEnv();
    api.importRulesFromFile();
    fakeInput.files = [{ _content: content }];
    fakeInput.onchange({ target: fakeInput });
    return env;
  };
  const noHead = run('Lorem ipsum dolor sit amet\nConsectetur adipiscing elit');
  const withHead = run('# ScriptConfig: {"language":"en-US"}\nLorem ipsum dolor sit amet\nConsectetur adipiscing elit');
  assert('规则-037: 有无配置头的垃圾文本导入均被拒绝', noHead.textarea.value === '' && noHead.hooks.written.length === 0 && noHead.hooks.persistCalls === undefined && withHead.textarea.value === '' && withHead.hooks.written.length === 0 && withHead.hooks.applyCalls === undefined);
}

// 空links选择器头可导入且坏头不触发清空确认(修复留档)
{
  const run = (content) => {
    const { env, api, fakeInput } = createEnv(['old.com']);
    api.importRulesFromFile();
    fakeInput.files = [{ _content: content }];
    fakeInput.onchange({ target: fakeInput });
    return env;
  };
  const good = run('# Selectors:{"bing":{"url":["attr","href","a[href]"]}}');
  const bad = run('# Selectors:{"bing":{"containers":""}}');
  assert('规则-038: 新格式选择器头可导入不清空本地规则且无效选择器头不触发确认不改配置', (() => {
    const sel = good.hooks.written.find((w) => w.key === 'searchfilter_selectors');
    const cfg = good.hooks.written.find((w) => w.key === 'searchfilter_blocker');
    return !!(sel && sel.val.bing.url[1] === 'href') && good.hooks.getConfirmCalls() === 0 && !!cfg && cfg.val.rules.join() === 'old.com' && bad.hooks.getConfirmCalls() === 0 && bad.hooks.written.length === 0 && bad.textarea.value === '';
  })());
}

// 空规则文件导入清空前需确认(修复留档)
{
  const { env, api, fakeInput } = createEnv(['old.com']);
  api.importRulesFromFile();
  env.hooks.setConfirmAnswer(false);
  fakeInput.files = [{ _content: '\n\n' }];
  fakeInput.onchange({ target: fakeInput });
  assert('规则-039: 本地有规则时导入无规则文件弹确认且取消不动配置', env.hooks.getConfirmCalls() === 1 && env.hooks.written.length === 0 && env.hooks.persistCalls === undefined && env.textarea.value === '' && api.isPreventPanelClose() === false);
}
{
  const run = (content) => {
    const { env, api, fakeInput } = createEnv(['old.com']);
    api.importRulesFromFile();
    fakeInput.files = [{ _content: content }];
    fakeInput.onchange({ target: fakeInput });
    return env.hooks;
  };
  const blocker = (h) => h.written.find((w) => w.key === 'searchfilter_blocker');
  const cfg = run('# ScriptConfig: {"language":"en-US"}');
  const sel = run('# Selectors: {"bing":{"containers":".x"}}');
  const sub = run('# ScriptConfig: {"subscriptions":[{"url":"https://s/1","name":"S1"}]}');
  assert('规则-040: 仅设置/选择器/订阅头文件不弹清空确认, 对应导入生效且本地规则保留',
    cfg.getConfirmCalls() === 0 && !!blocker(cfg) && blocker(cfg).val.language === 'en-US' && blocker(cfg).val.rules.join() === 'old.com'
    && sel.getConfirmCalls() === 0 && sel.written.some((w) => w.key === 'searchfilter_selectors' && w.val.bing.containers === '.x') && !!blocker(sel) && blocker(sel).val.rules.join() === 'old.com'
    && sub.getConfirmCalls() === 0 && !!blocker(sub) && blocker(sub).val.rules.join() === 'old.com' && !!sub.subsSaved && sub.subsSaved.some((s) => s.url === 'https://s/1'));
}

// 同步头解析(仅剥离头行, 其余#注释保留)
{
  const run = (content) => new Function('currentConfig', 'console', `function dbgWarn() {}\nfunction dbg() {}\nfunction dbgError() {}\n${parseSyncHeaderFn}\nreturn parseSyncHeader;`)({ debug: false }, { warn: () => {} })(content);
  const dup = run('# ScriptConfig: {"a":1}\n# ScriptConfig: {"b":2}\nrule1');
  const trunc = run('# ScriptConfig:{"syncedAt":12\nrule1');
  assert('规则-041: 重复头取首个后部伪头按注释保留正文且JSON截断头行剔除不重发', dup.config.a === 1 && dup.config.b === undefined && dup.restLines.join('\n') === '# ScriptConfig: {"b":2}\nrule1' && trunc.config === null && trunc.rawScriptConfig === null && trunc.restLines.join('\n') === 'rule1');
  const selOk = run('# Selectors:{"bing":{"url":["attribute","href","a[href]"],"title":["text","h3"]}}\nrule1');
  const selBad = run('# Selectors:{"bing":{"containers":""}}\nrule1');
  assert('规则-042: 新格式命令选择器头可解析且无效选择器头标记invalidSelectors不丢正文', !!(selOk.rawSelectors && selOk.config && selOk.config.selectors && selOk.config.selectors.bing.url[1] === 'href' && selOk.config.selectors.bing.title[1] === 'h3') && selOk.invalidSelectors === false && selOk.restLines.join('\n') === 'rule1' && selBad.invalidSelectors === true && selBad.rawSelectors === null && selBad.restLines.join('\n') === 'rule1');
}
// 修复留档: 同步/导入选择器头对titles/links先剥离@attr/@json等提取语法再验CSS, 含提取语法的补丁不再静默丢弃(主/Lite)
{
  const badCss = (s) => { const n = (ch) => s.split(ch).length - 1; return n('[') !== n(']') || n('(') !== n(')') || n('{') !== n('}'); };
  const doc = { querySelector: (s) => { if (badCss(String(s).replace(/(["'])(?:\\.|(?!\1).)*\1/g, ''))) throw new SyntaxError('bad css'); return null; } };
  const specRun = (content) => new Function('currentConfig', 'console', 'document', `${extractFn(src, 'parseRegexLiteral')}\n${extractFn(src, 'sanitizeRegexFlags')}\n${parseSyncHeaderFn}\nreturn parseSyncHeader;`)({ debug: false }, { warn: () => {} }, doc)(content);
  const rOk = specRun('# Selectors:' + JSON.stringify({ bing: { match: '/^www\\.bing\\.com$/i', root: 'li.b_algo', title: ['attribute', 'alt', 'img'], url: ['queryParam', 'imgurl', ['attribute', 'href', 'a[href*="/imgres"]']] } }) + '\nrule1');
  const rRootCmd = specRun('# Selectors:' + JSON.stringify({ bing: { root: ['upward', 1, '.item'], url: ['attribute', 'href', 'a[href]'] } }) + '\nrule1');
  const rRootSel = specRun('# Selectors:' + JSON.stringify({ bing: { root: ['selector', '.result'], url: ['attribute', 'href', 'a[href]'] } }) + '\nrule1');
  const rBad = specRun('# Selectors:' + JSON.stringify({ bing: { containers: 'li[' } }) + '\nrule1');
  assert('规则-043: 命令式title/url与数组root及selector选择器头合法被采纳且非法CSS仍标记invalidSelectors', !!(rOk.rawSelectors && rOk.config && rOk.config.selectors && rOk.config.selectors.bing.title[1] === 'alt' && rOk.config.selectors.bing.url[0] === 'queryParam') && rOk.invalidSelectors === false && !!(rRootCmd.rawSelectors && rRootCmd.config && rRootCmd.config.selectors && JSON.stringify(rRootCmd.config.selectors.bing.root) === '["upward",1,".item"]') && rRootCmd.invalidSelectors === false && rRootCmd.restLines.join('\n') === 'rule1' && !!(rRootSel.rawSelectors && rRootSel.config && rRootSel.config.selectors && rRootSel.config.selectors.bing.root[0] === 'selector') && rRootSel.invalidSelectors === false && rBad.rawSelectors === null && rBad.config === null && rBad.invalidSelectors === true && rBad.restLines.join('\n') === 'rule1');
}
})();

// ---- 规则-044: 三方合并 ----
{
const mergeApi = new Function(SERH_FN_DEPS + '\n' + SERH_RAW_EXTRACT(src, 'stripRuleComment') + '\n' + SERH_RAW_EXTRACT(src, 'getRuleKey') + '\n' + SERH_RAW_EXTRACT(src, 'mergeRules3Way') + '\nreturn mergeRules3Way;')();
const B_OLD = '*://b.com/* # old', B_NEW = '*://b.com/* # new';
assert('规则-044: 一方移动+删规则他方仅改行尾注释修改保留且单方插入新规则锚定原位', JSON.stringify(mergeApi(['A', B_OLD, 'C'], ['C', 'A'], ['A', B_NEW, 'C'])) === JSON.stringify(['C', 'A', B_NEW]) && JSON.stringify(mergeApi(['A', 'B', 'C'], ['A', 'X', 'B', 'C'], ['A', 'B', 'C'])) === JSON.stringify(['A', 'X', 'B', 'C']));
}

// ---- 规则-045: 订阅规则类型守卫 / YAML探测回退 ----
{
const api = makeRulesApi();

const plainApi = new Function('function t(k) { return k; }\nconst currentConfig = { debug: false };\n' +
  extractFn(src, 'extractYamlRuleItems') + '\n' + extractFn(src, 'parseRulesetContent') + '\nreturn parseRulesetContent;')();
// 标量引号仅在起始处生效, 中部撇号不吞注释与后续段
assert('规则-045: flow值中部撇号+尾注释不吞后文段落', (() => {
  const r = plainApi("rules: [bob's.com, x.com] # don't\nwhitelist:\n  - d.com\n...\n@@|https://x.com/p[1]\n");
  return JSON.stringify(r.lines) === JSON.stringify(["bob's.com", 'x.com', '@d.com']);
})());
}

// ---- 规则-046: @N 与 @if 紧贴写法修复留档 ----
{
const api = makeRulesApi();
api.setState(['@2@if(title *= "kw")', '@1 @if(title *= "x")'], []); api.buildRuleIndex();
const cr = api.getCR();
assert('规则-046: @N@if(...) 无空格与有空格等价, 归入高亮条件表达式而非被整条拒绝', cr.highlightConditionalRules.some(e => e.N === 2 && e.type === 'expr' && e.conditions.length === 1) && cr.whitelistConditionalRules.length === 0 && api.validateRule('@2@if(title *= "kw")') === true);
}

// ---- 规则-047: 引擎自身域名保护对协议前缀match生效(修复留档, 主/Lite) ----
{
const makeSelfDomain = (host, engineId) => new Function(
  'const window = { location: { hostname: ' + JSON.stringify(host) + ' } };\n' +
  'const SELECTORS_MOCK = { google: { match: /^https?:\\/\\/(?:www\\.)?google\\.(?:[a-z]{2,3}(?:\\.[a-z]{2})?|[a-z]{4,})(?::\\d+)?\\//i }, bing: { match: /^(?:(?:www|m)\\.)?bing\\.(?:com|[a-z]{2,3})$/ } };\n' +
  'const getSelectors = () => SELECTORS_MOCK;\n' +
  'const getSearchEngine = () => ' + JSON.stringify(engineId) + ';\n' +
  extractFn(src, 'isEngineSelfDomain') + '\nreturn isEngineSelfDomain;'
)();
assert('规则-047: google父域保护生效且非引擎域不误拦', makeSelfDomain('www.google.com', 'google')('google.com') === true && makeSelfDomain('www.google.com', 'google')('example.com') === false);
}

// ---- 规则-048: YAML嵌套节回退(主版) ----
{
const api = makeFilterApi();
// 修复留档: 嵌套子节后平铺列表项沿用嵌套节kind致屏蔽/放行反转, 以节栈按缩进回落回退外层节(对齐uBlacklist语义)
const nested = api.parseRulesetContent('name: N\nrules:\n  - keep1.com\n  - sub.com:\n      whitelist:\n        - ok.com\n  - keep2.com\n  - keep3.com\n');
assert('规则-048: 嵌套whitelist子节结束后平铺项回退rules不再误加@', JSON.stringify(nested.lines) === JSON.stringify(['keep1.com', 'sub.com:', '@ok.com', 'keep2.com', 'keep3.com']));
}

// ---- 规则-049: 合法正则含HTML标签不误判(修复留档, 主/Lite) ----
{
const api = makeFilterApi();
assert('规则-049: 合法正则含<body>时放行且真实HTML错误页仍拒绝', api.isNonRuleTextResponse(['/<body/i'], false) === false && api.isNonRuleTextResponse(['<html><body>login</body></html>'], false) === true);
}

// ---- 规则-050: Lite保存三方合并(修复留档) ----
{
const liteSrc = fs.readFileSync(['', 'other'].map((d) => path.join(scriptDir, d, 'Lite.user.js')).find((p) => fs.existsSync(p)), 'utf8');
const liteMerge = new Function(SERH_FN_DEPS + '\n' + SERH_RAW_EXTRACT(liteSrc, 'stripRuleComment') + '\n' + SERH_RAW_EXTRACT(liteSrc, 'getRuleKey') + '\n' + SERH_RAW_EXTRACT(liteSrc, 'mergeRules3Way') + '\nreturn mergeRules3Way;')();
// 修复留档: Lite saveConfig原为追加式合并, 他侧删除的规则会随保存复活, 已对齐主版mergeRules3Way
assert('规则-050: Lite三方合并他侧删除不复活且纯新增保留', JSON.stringify(liteMerge(['*://r.com/*'], ['*://r.com/*'], [], true)) === '[]' && JSON.stringify(liteMerge([], [], ['*://n.com/*'], true)) === JSON.stringify(['*://n.com/*']));
}

// ---- 规则-051: Lite导入# Selectors头(修复留档) ----
{
  const liteSrc = fs.readFileSync(['', 'other'].map((d) => path.join(scriptDir, d, 'Lite.user.js')).find((p) => fs.existsSync(p)), 'utf8');
  const liteParse = new Function(`const document = { querySelector: () => true };
    ${SERH_RAW_EXTRACT(liteSrc, 'parseRegexLiteral')}
    ${SERH_RAW_EXTRACT(liteSrc, 'isRegexLiteralStr')}
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
  const emptyLinks = liteParse(['# Selectors:' + JSON.stringify({ bing: { url: ['attribute', 'href', 'a[href]'] } }), '*://a.com/*']);
  const badSel = liteParse(['# Selectors:{"bing":{"containers":""}}']);
  const specLite = liteParse(['# Selectors:' + JSON.stringify({ bing: { root: 'li.b_algo', title: ['attribute', 'alt', 'img'], url: ['queryParam', 'u', ['attribute', 'href', 'a']] } }), '*://a.com/*']);
  const specLiteRoot = liteParse(['# Selectors:' + JSON.stringify({ bing: { root: ['upward', 1, '.item'], url: ['attribute', 'href', 'a[href]'] } }), '*://a.com/*']);
  assert('规则-051: Lite导入识别# Selectors头且坏ScriptConfig行剔除且新格式命令式与数组root选择器头合法', !!(parsed.selectors && parsed.selectors.example && parsed.selectors.example.containers === '.result, .result2') && JSON.stringify(parsed.rest) === JSON.stringify(['*://a.com/*']) && JSON.stringify(bad.rest) === JSON.stringify(['*://a.com/*']) && cfgBad.settings === null && JSON.stringify(cfgBad.rest) === JSON.stringify(['*://a.com/*']) && !!(emptyLinks.selectors && emptyLinks.selectors.bing.url[1] === 'href') && badSel.invalidSelectors === true && !!(specLite.selectors && specLite.selectors.bing && specLite.selectors.bing.title[1] === 'alt') && specLite.invalidSelectors !== true && !!(specLiteRoot.selectors && specLiteRoot.selectors.bing && JSON.stringify(specLiteRoot.selectors.bing.root) === '["upward",1,".item"]') && specLiteRoot.invalidSelectors !== true);
}

// ---- 规则-052: URL规则解码匹配(修复留档) ----
{
  const api = makeRulesApi(); api.setState(['example.com/中文', 'example.com/路径 @if(title *= "x")'], []); api.buildRuleIndex();
  const chk = (u, title) => api.checkRuleMatchOptimized(u, 'www.example.com', title, '', ['www.example.com', 'example.com']);
  const r = chk('https://www.example.com/%E4%B8%AD%E6%96%87');
  const r2 = chk('https://www.example.com/%E8%B7%AF%E5%BE%84', 'x');
  const r3 = chk('https://www.example.com/%E8%B7%AF%E5%BE%84', 'y');
  assert('规则-052: 普通及带@if的URL规则都按解码后的百分号编码路径命中', !!(r && r.blocked === true) && !!(r2 && r2.blocked === true) && !(r3 && r3.blocked === true));
}
{
  const api = makeRulesApi(); api.setState(['/example\\.com\\/admin/i'], []); api.buildRuleIndex();
  const chk = (u) => api.checkRuleMatchOptimized(u, 'evil.com', '', '', ['evil.com', 'com']);
  const query = chk('https://evil.com/?u=https%3A%2F%2Fexample.com%2Fadmin');
  const frag = chk('https://evil.com/#https%3A%2F%2Fexample.com%2Fadmin');
  const path = chk('https://evil.com/path/https%3A%2F%2Fexample.com%2Fadmin');
  assert('规则-053: URL正则不解码query与fragment中的编码URL仍按解码pathname匹配', !(query && query.blocked) && !(frag && frag.blocked) && !!(path && path.blocked));
}

// 易错: 优先级依赖规则拼接顺序, getRuleKey 以去注释正文为键会合并重复行
// 留档: 主机含@的裸规则(如@1@x.com忘加空格)会被静默接受为永不命中的白名单死规则
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

})();
