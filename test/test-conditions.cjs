// 读取上一级目录的 *.*.*.user.js 或 Lite.user.js
// 条件表达式 / YAML检测 / 修复回归
// 命名：条件-序号: 描述

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

const constsStr = src.match(/const SUPPORTED_REGEX_FLAGS = 'imsu';/)[0];
const langTexts = src.match(/const LANG_TEXTS = \{[\s\S]*?\n  \};/)[0];
const ALL_FNS = [
  'hostLabelToASCII', 'toASCIIHostname', 'toASCIIUrl', 'safeRegexTest', 'safeDecodeURIComponent', 'decodeUrlForMatch', 'stripRuleComment',
  'parseRulesetContent', 'extractYamlRuleItems', 'getInvalidRegexFlags', 'parseConditionPart', 'tokenizeCondExpr',
  'parseCondExprTokens', 'analyzeCondExpr', 'foldCondExpr', 'evalDynamicLeaf', 'evalCondAST', 'isCondExprCore',
  'looksLikeCondExpr', 'isScriptRuleLine', 'isElementRuleLine', 'punycodeDecodeLabel', 'toUnicodeHostname',
  'parsePrefixedRegexRule', 'validateUrlWildcard', 'ruleToRegex', 'escapeWildcardPart', 'splitHostAndPort',
  'escapeHostPart', 'wildcardToRegex', 'normalizeHostCandidate', 'matchWildcardDomainPattern',
  'matchSimpleDomain', 'compileRuleRegex', 'extractBalancedParens', // extractSimpleWhitelistDomain 已并入 matchSimpleDomain
  'findIfOccurrences', 'stripIfConditions', 'extractIfConditions', 'evaluateCondition', 'absorbStandaloneExpr',
  'parseRuleWithConditions', 'validateCondition', 'analyzeRule', 'validateRule', 'checkDynamicConditions',
  'getSubdomainLevels', 'matchDomainEntryType', 'isLocalEntry', 'checkRuleMatchOptimized', 'hasBareRegexSlash',
].map((n) => extractFn(src, n));
const makeEnv = () => new Function(
  constsStr + '\n' + langTexts + '\n' + ALL_FNS.join('\n') + `
let currentEngine = 'google';
let currentSite = 'www.google.com';
let currentCategory = 'web';
const window = { location: { get hostname() { return currentSite; }, pathname: '/search', search: '?q=x', href: 'https://www.google.com/search?q=x' } };
function getSearchEngine() { return currentEngine; }
function getSearchCategory() { return currentCategory; }
function t(key, params = {}) {
  const texts = LANG_TEXTS['zh-CN'] || {};
  let text = texts[key] || key;
  for (const [k, v] of Object.entries(params)) text = text.replaceAll('{' + k + '}', v);
  return text;
}
const currentConfig = { rules: [], debug: false };
let compiledRules;
const validationCache = new Map();
const subdomainCache = new Map();
return { analyzeCondExpr, foldCondExpr, evalDynamicLeaf, evalCondAST, tokenizeCondExpr, stripRuleComment,
  parseRulesetContent, extractBalancedParens, findIfOccurrences, extractIfConditions, stripIfConditions,
  parseRuleWithConditions, parsePrefixedRegexRule, analyzeRule, validateRule, checkDynamicConditions,
  checkRuleMatchOptimized, toUnicodeHostname, looksLikeCondExpr,
  setCR: (cr) => { compiledRules = cr; },
  setEnv: (e, s, c) => { currentEngine = e; if (s) currentSite = s; if (c) currentCategory = c; } };`
)();
const m = makeEnv();

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? '  => ' + JSON.stringify(extra) : '')); }
}
function assert(name, cond, extra) { check(name, cond, extra); }

function condExpr(str, engine = 'google', siteHost = 'www.google.com', category = 'web') {
  const { ast, errors } = m.analyzeCondExpr(str, engine, siteHost, category);
  if (errors.length) return { errors: errors.map((e) => e.kind + (e.part ? ':' + e.part : '')) };
  const folded = m.foldCondExpr(ast);
  return folded.type === 'const' ? { const: folded.value } : { ast: folded };
}
function ev(folded, title, url) {
  if (folded.const !== undefined) return folded.const;
  return m.evalCondAST(folded.ast, title, url);
}

// ==== 一、条件表达式解析与识别 ====

let r = condExpr('$site = "google"', 'google');
assert('条件-001: $site静态命中->恒真', r.const === true);
r = condExpr('$site = "google"', 'bing');
r = condExpr('title *= 关键词', 'google');
assert('条件-003: 无引号中文title包含', !r.errors && ev(r, '含关键词的标题', 'https://x.com/') === true && ev(r, 'other', 'https://x.com/') === false);
r = condExpr('path *= "/%E4%B8%8B%E8%BD%BD/"', 'google');
r = condExpr('title *= "kw1" | title *= "kw2"', 'google');
r = condExpr('$site = "google" | title *= "x"', 'google');
r = condExpr('$site = "google" | title *= "x"', 'bing');
r = condExpr('site("google.com.hk")', 'google', 'www.google.com.hk');
r = condExpr('site = "例子.com"', 'google', 'xn--fsqu00a.com');
assert('条件-011: IDN归一(Unicode条件匹配punycode站点)', r.const === true);
r = condExpr('site = "xn--fsqu00a.com"', 'google', '例子.com');
r = condExpr('title =~ /kw1|kw2/', 'google');
assert('条件-013: 正则内|不被切分', !r.errors && r.ast.type === 'leaf' && ev(r, 'kw1 hit', 'https://x.com/') === true);
r = condExpr('title =~ /a\\/b|c/i', 'google');
r = condExpr('title *= "a" & title *= "b"', 'google');
assert('条件-015: AND', !r.errors && ev(r, 'a and b', 'https://x/') === true && ev(r, 'only a', 'https://x/') === false);
r = condExpr('!title *= "a"', 'google');
assert('条件-016: !前缀叶子', !r.errors && r.ast.type === 'not' && ev(r, '', 'https://x/') === true && ev(r, 'aaa', 'https://x/') === false);
r = condExpr('!(title *= "a" | title *= "b")', 'google');
r = condExpr('title *= "a" & !(url *= "ads")', 'google');
r = condExpr('title *= "a" | title *= "b" & url *= "c"', 'google');
assert('条件-020: 优先级&>|', !r.errors && r.ast.type === 'or' && ev(r, 'bbb', 'https://x/') === false);
r = condExpr('(title *= "a" | title *= "b") & !($site = "google")', 'google');
r = condExpr('(title *= "a" | title *= "b") & !($site = "bing")', 'google');
assert('条件-023: 括号组&!($site=bing)剩动态', !r.const && ev(r, 'aaa', 'https://x/') === true && ev(r, 'ccc', 'https://x/') === false);
r = condExpr('title *= "x" & ($site = "bing" | !($site = "yandex"))', 'google');
r = condExpr('!!title *= "a"', 'google');

// ---- 错误检测 ----
r = condExpr('foo', 'google');
assert('条件-026: 未知条件', r.errors && r.errors[0].startsWith('unknown'));
r = condExpr('title *= "a" &', 'google');
r = condExpr('title *= "a" && title *= "b"', 'google');
r = condExpr('title *= "a" & title *= "b" & title *= "c"', 'google');
r = condExpr('(title *= "a" | title *= "b"', 'google');
assert('条件-030: 括号未闭合', r.errors && r.errors.some((e) => e.startsWith('syntax')));
r = condExpr('title *= "a")', 'google');
r = condExpr('& title *= "a"', 'google');
r = condExpr('', 'google');
r = condExpr('title =~ /x/g', 'google');
assert('条件-034: flags含g报错', r.errors && r.errors[0].startsWith('flags:g'));
r = condExpr('title =~ /(/)', 'google');
assert('条件-035: 无效正则报错', r.errors && r.errors[0].startsWith('regex'));
r = condExpr('title =~ /a\\', 'google');
r = condExpr('title//', 'google');
r = condExpr('host =~ /ABC/', 'google');
r = condExpr('host =~ /ABC/i', 'google');
r = condExpr('$site = "DDG"', 'duckduckgo');
r = condExpr('$site = google', 'google');

// ---- url 条件 ----
r = condExpr('url = "https://ex.com/"', 'google');
r = condExpr('url ^= "https://ex"', 'google');
r = condExpr('url $= ".pdf"', 'google');
assert('条件-044: url后缀', ev(r, 't', 'https://x.com/a.pdf') === true && ev(r, 't', 'https://x.com/a.txt') === false);
r = condExpr('url =~ /\\.(pdf|doc)$/', 'google');
r = condExpr('url =~ /\\.pdf$/i', 'google');
r = condExpr('title=~/广告|推广/', 'google');
r = condExpr('url*=~/ads/', 'google');
assert('条件-048: 运算符后接=~显式报错', !!r.errors);
r = condExpr('title=~/未闭合', 'google');
r = condExpr('url/example\\.(com|net)/', 'google');
assert('条件-050: url简写正则内括号与|整吞', !r.errors && ev(r, 't', 'https://example.com/') === true && ev(r, 't', 'https://example.net/') === true && ev(r, 't', 'https://other.net/') === false);
r = condExpr('url/example\\.net/i', 'google');
r = condExpr('url/example\\.com/ | title *= "kw"', 'google');
r = condExpr('!(url $= ".pdf")', 'google');
r = condExpr('url ^= "https://ex.com"', 'google');
r = condExpr('!(url ^= "https://ex.com")', 'google');
r = condExpr('url =~ /[/]/', 'google');
assert('条件-056: 字符类内裸斜杠合法', !r.errors && ev(r, 't', 'https://example.com/a/b') === true);

// ---- $site 变量 ----
r = condExpr('$site : "yandex"', 'yandex');
r = condExpr('$site = "google" & title *= "x"', 'google');
r = condExpr('$site = "google" | $site = "bing"', 'google');
r = condExpr('$site = "google" | $site = "bing"', 'yandex');
r = condExpr('$site = "foo"', 'google');
assert('条件-061: 未知站点值->静态假不报错', r.const === false && !r.errors);

// ---- 行尾 # 注释剥离 ----
assert('条件-064: 引号内#与行尾注释', m.stripRuleComment('*://x.com/* @if(title *= "a # b") # note') === '*://x.com/* @if(title *= "a # b")');
assert('条件-065: @if正则内括号配平', m.stripRuleComment('*://x.com/* @if(title =~ /a)b/) # x') === '*://x.com/* @if(title =~ /a)b/)');

// ---- host / path / scheme ----
r = condExpr('host $= ".example.com"', 'google');
assert('条件-070: host后缀-子域与裸域', ev(r, 't', 'https://www.example.com/') === true && ev(r, 't', 'https://example.com/') === true);
r = condExpr('host = "www.example.com"', 'google');
r = condExpr('host =~ /(^|\\.)example\\.com$/i', 'google');
assert('条件-073: host正则', !r.errors && ev(r, 't', 'https://example.com/') === true && ev(r, 't', 'https://badexample.com/') === false);
r = condExpr('host $= ".例子.com"', 'google');
r = condExpr('path/download/', 'google');
assert('条件-075: path简写', !r.errors && ev(r, 't', 'https://x.com/download/setup') === true);
r = condExpr('scheme = "https"', 'google');
r = condExpr('host $= ".example.com" & path *= "/download/" & scheme = "https"', 'google');
assert('条件-077: host&path&scheme组合', ev(r, 't', 'https://dl.example.com/download/x') === true && ev(r, 't', 'http://dl.example.com/download/x') === false);
r = condExpr('path $= ".pdf"', 'google');
assert('条件-078: 非法url->假', ev(r, 't', 'not a url') === false);
r = condExpr('title =~ /x/I', 'google');
assert('条件-079: 大写I当作i不报错', !r.errors && ev(r, 'X', 'https://x/') === true && ev(r, 'y', 'https://x/') === false);
r = condExpr('title =~ /\\u{4E2D}/u', 'google');

// ---- i 修饰 ----
r = condExpr('title *= "KW" i', 'google');
assert('条件-081: title包含+i修饰', !r.errors && ev(r, 'contains kw', 'https://x/') === true && ev(r, 'nothing', 'https://x/') === false);
r = condExpr('title *= "a" ix', 'google');

// ---- $category 折叠 ----
r = condExpr('$category = "images"', 'google', 'www.google.com', 'web');
r = condExpr('$site = "google" & $category = "images"', 'google', 'www.google.com', 'web');
assert('条件-084: $site命中但category不命中', r.const === false);

// ---- 条件表达式识别(行级判定) ----
const condTrueCases = [
  'host $= ".example.com"',
  'title *= "关键词"',
  'url =~ /example\\.(com|net)/',
  'host/\\.example\\.com$/i',
  '$category = "images"',
  '!scheme = "https"',
  '(host $= "a" | title *= "b")',
  'host = example.com',
  'title*=关键词',
];
assert('条件-085: 条件表达式全部识别', condTrueCases.every((rule) => m.looksLikeCondExpr(rule) === true));
const condFalseCases = [
  'https://example.com/?url=x',
  '*://*.example.com/*',
  '/example\\.com/',
  'title/foo/i',
  'example.com',
  'https://example.com/',
];
assert('条件-086: 非条件表达式全部排除', condFalseCases.every((rule) => m.looksLikeCondExpr(rule) === false));

// ==== 二、@if 条件提取与URL路径冲突 ====

const zzb2 = String.fromCharCode(92);

// ---- 规则与@if之间空格可省略 ----
const tightConds = m.extractIfConditions('*://x.com/*@if(title *= "kw")');
assert('条件-090: 紧贴@if识别出条件', tightConds.length === 1 && tightConds[0] === 'title *= "kw"');
assert('条件-092: 路径中@if后跟路径体不误判', m.extractIfConditions('*://example.com/api/@if(test)/*').length === 0);

// ---- @if括号配平 ----
const c4 = m.extractIfConditions('*://x/* @if(title =~ /\\(a/)');
assert('条件-095: 转义左括号条件完整', c4.length === 1 && c4[0] === 'title =~ /\\(a/');
const sQ = m.stripIfConditions('*://x.com/* @if(title *= "@if(y)")');
assert('条件-099: 引号内@if不产生伪剥离', sQ.coreRule === '*://x.com/*' && sQ.staticPass === true);
assert('条件-101: title正则体内@if不剥离', m.stripIfConditions('title/foo@if(bar)/').coreRule === 'title/foo@if(bar)/');

// ---- URL路径含关键字段不误吞@if ----
const pathConflictCases = [
  '*://x.com/title/y @if(title *= "a")',
  '*://x.com/a/title/b/url/c @if(url *= "q")',
];
assert('条件-105: @if检测不受路径关键字段干扰', pathConflictCases.every((rule) => m.findIfOccurrences(rule).length === 1));
assert('条件-108: 未闭合@if报错', m.validateRule('*://x.com/* @if((title *= "a")') === false);

// ==== 三、独立表达式 ====

assert('条件-111: Adblock元数据仍被排除', m.looksLikeCondExpr('! Title: Some List') === false && m.looksLikeCondExpr('! URL: https://x') === false);

let p = m.parseRuleWithConditions('host $= ".example.com"');
assert('条件-113: host裸域命中', m.evalCondAST(p.dynamicConditions[0], 't', 'https://example.com/') === true);
p = m.parseRuleWithConditions('example.com');
assert('条件-117: 普通域名不吸收', p.coreRule === 'example.com' && p.dynamicConditions.length === 0 && p.staticPass);
p = m.parseRuleWithConditions('$site = "google"');
assert('条件-121: $site命中折叠恒真', p.coreRule === '' && p.staticPass && p.dynamicConditions.length === 0);
m.setEnv('bing', 'www.bing.com');
m.setEnv('google', 'www.google.com');

assert('条件-125: 高亮越界无效', m.analyzeRule('@9 host $= ".example.com"').valid === false);
assert('条件-131: 损坏的@if全部报错并丢弃', [
  'title/x/ @if(foo $= "bar")',
  'title/x/ @if(title =~ /bad(/)',
  '@1 /x/ @if(unknownfield = "v")',
].every((rule) => { const a = m.analyzeRule(rule); const pr = m.parseRuleWithConditions(rule); return a.valid === false && a.errors.length > 0 && pr.staticPass === false; }));

// ---- 匹配引擎 ----
const slEx = ['www.example.com', 'example.com'];
const urlEx = 'https://www.example.com/download/setup.exe';
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
function doCheck(cr, url, host, title, snippet, sl) {
  m.setCR(cr);
  return m.checkRuleMatchOptimized(url, host, title, snippet, sl);
}
function isBlocked(r) { return r && r.blocked === true; }
function addExpr(cr, rule, source) {
  const parsed = m.parseRuleWithConditions(m.stripRuleComment(rule));
  if (!parsed.staticPass) return parsed;
  cr.conditionalRules.push({ type: 'expr', originalRule: rule, source: source || '本地规则', conditions: parsed.dynamicConditions });
  return parsed;
}
function addWlExpr(cr, rule, source) {
  const parsed = m.parseRuleWithConditions(m.stripRuleComment(rule));
  if (!parsed.staticPass) return parsed;
  cr.whitelistConditionalRules.push({ type: 'expr', conditions: parsed.dynamicConditions, source: source || '本地规则' });
  return parsed;
}

let cr = makeCR();
addExpr(cr, 'host $= ".example.com"');
assert('条件-132: 独立host屏蔽', isBlocked(doCheck(cr, urlEx, 'www.example.com', 't', null, slEx)));
cr = makeCR();
cr.whitelistConditionalRules.push({ type: 'expr', conditions: m.parseRuleWithConditions('@host $= ".example.com"').dynamicConditions, source: '本地规则' });
cr.domains.set('example.com', [{ type: 'wildcard', originalRule: 'example.com', source: '本地规则' }]);
assert('条件-134: 独立表达式白名单放行', !isBlocked(doCheck(cr, urlEx, 'www.example.com', 't', null, slEx)));
cr = makeCR();
cr.whitelistConditionalRules.push({ type: 'expr', conditions: m.parseRuleWithConditions('@path *= "/safe/"').dynamicConditions, source: '本地规则' });
addExpr(cr, 'host $= ".example.com"');
assert('条件-135: 路径白名单压过host黑名单', !isBlocked(doCheck(cr, 'https://www.example.com/safe/a', 'www.example.com', 't', null, slEx)));
cr = makeCR();
addExpr(cr, 'host $= ".example.com" @if(title *= "kw")');

// ---- 白名单 × 独立表达式优先级 ----
cr = makeCR();
addWlExpr(cr, '@host $= ".example.com"');
addExpr(cr, 'host $= ".example.com"');
assert('条件-139: 本地表达式白名单 > 本地黑名单', !isBlocked(doCheck(cr, urlEx, 'www.example.com', 't', null, slEx)));
cr = makeCR();
addExpr(cr, 'host $= ".example.com"');
addWlExpr(cr, '@host $= ".example.com"', '订阅规则1');
r = doCheck(cr, urlEx, 'www.example.com', 't', null, slEx);
assert('条件-140: 本地黑名单 > 订阅白名单', isBlocked(r) && r.source === '本地规则');

// ---- path 正则大小写与解码回归 ----
p = m.parseRuleWithConditions('path/案例/');
assert('条件-146: path正则匹配percent解码变体', m.evalCondAST(p.dynamicConditions[0], 't', 'https://x.com/%E6%A1%88%E4%BE%8B') === true);

// ==== 四、修复回归 ====

// ---- 多斜杠裸值 ----
r = condExpr('path = /a/b');
assert('条件-158: 双斜杠裸值精确匹配', !r.errors && ev(r, 't', 'https://x.com/a/b') === true && ev(r, 't', 'https://x.com/a/b/c') === false);

// ---- host端口条件 ----
assert('条件-166: ":80"对显式默认端口与省略端口都不命中', m.evalCondAST(m.parseRuleWithConditions('host $= ":80"').dynamicConditions[0], 't', 'http://example.com:80/') === false && m.evalCondAST(m.parseRuleWithConditions('host $= ":80"').dynamicConditions[0], 't', 'http://example.com/') === false);

// ---- IDN与非BMP字符 ----
const urlPath = m.parseRuleWithConditions('url *= "下载"').dynamicConditions[0];
const urlPct = m.parseRuleWithConditions('url *= "%E4%B8%8B%E8%BD%BD"').dynamicConditions[0];
assert('条件-169: url条件中文路径与百分号路径互通', m.evalCondAST(urlPath, 't', 'https://example.com/%E4%B8%8B%E8%BD%BD') === true && m.evalCondAST(urlPct, 't', 'https://example.com/下载') === true);
// ---- @if内正则编译 / 静态@if / 未闭合报错 ----
const q1 = m.parseRuleWithConditions('*://*.example.com/* @if(url=/ab/)');
const q1c = q1.dynamicConditions[0];
assert('条件-173: @if内url=/re/按正则编译', q1.staticPass === true && q1c && q1c.type === 'leaf' && q1c.cond.op === '=~' && m.evalCondAST(q1c, 't', 'https://sub.example.com/ab/') === true);

// ---- url =~ 的百分号/IDN归一 ----
const evU = (rule, url) => m.evalCondAST(m.parseRuleWithConditions(rule).dynamicConditions[0], 't', url);
assert('条件-176: url =~同时测原文与归一形态', evU('url =~ /下载/', 'https://example.com/%E4%B8%8B%E8%BD%BD') === true && evU('url =~ /%E4%B8%8B%E8%BD%BD/', 'https://example.com/%E4%B8%8B%E8%BD%BD') === true && evU('url =~ /例子/', 'https://xn--fsqu00a.com/') === true && evU('url =~ /xn--fsqu00a/', 'https://xn--fsqu00a.com/') === true);

// ---- @if单等号正则括号平衡 ----
const ruleF4 = '@if(title=/\\)$/) example.com';
const hitF4 = (title) => m.checkDynamicConditions(m.parseRuleWithConditions(ruleF4).dynamicConditions, title, 'https://example.com/x');
assert('条件-178: 单等号正则含不成对括号不误杀', m.analyzeRule(ruleF4).valid === true && hitF4('报告(2024)') === true && hitF4('报告 2024') === false);

// ---- 空串比较值守卫 ----
const ev14 = (cond, title, url) => m.evalDynamicLeaf(cond, title, url);
assert('条件-180: title空串比较值一律不命中', ev14({ type: 'title', op: '$=', val: '' }, '标题', 'https://x.com') === false && ev14({ type: 'title', op: '^=', val: '' }, '标题', 'https://x.com') === false && ev14({ type: 'title', op: '*=', val: '' }, '标题', 'https://x.com') === false && ev14({ type: 'title', op: '=', val: '' }, '标题', 'https://x.com') === false);

// ---- 深嵌套与编辑器兜底 ----
assert('条件-182: 3000层括号返回valid=false而非抛RangeError', (() => { try { return m.validateRule('@if(' + '('.repeat(3000) + 'title *= "a"' + ')'.repeat(3000) + ')') === false; } catch (e) { return false; } })());

// 忽略该问题: 未闭合flow序列逐字符重扫
const c7 = m.extractIfConditions('*://x.com/* @if(path *= /a)b/)');
assert('条件-190: *= 后 /…/ 含右括号不截断条件', c7.length === 1 && c7[0] === 'path *= /a)b/');
assert('条件-193: 修复后规则可校验且值仍按字面量求值', m.validateRule('*://x.com/* @if(path *= /a)b/)') === true && m.checkDynamicConditions(m.parseRuleWithConditions('*://x.com/* @if(path *= /a)b/)').dynamicConditions, 't', 'https://x.com/a)b/c') === true && m.checkDynamicConditions(m.parseRuleWithConditions('*://x.com/* @if(path *= /a)b/)').dynamicConditions, 't', 'https://x.com/a') === false);

// ---- 条件-195: @N 与 @if 紧贴写法修复留档(与规则-254/255同步) ----
assert('条件-195: @N@if(...) 无空格紧贴写法可校验且高亮N前缀被剥离', m.analyzeRule('@2@if(title *= "kw")').valid === true && m.analyzeRule('@2 @if(title *= "kw")').valid === true && m.analyzeRule('@1@*://*.example.com/*').valid === false);
assert('条件-196: 非ASCII主机含端口的相对条件值命中且无端口/ASCII路径不受影响(修复留档, 主/Lite)', m.checkDynamicConditions(m.parseRuleWithConditions('*://x.com/* @if(url $= "bücher.com:8080/x")').dynamicConditions, 't', 'http://xn--bcher-kva.com:8080/x') === true && m.checkDynamicConditions(m.parseRuleWithConditions('*://x.com/* @if(url $= "bücher.com/x")').dynamicConditions, 't', 'http://xn--bcher-kva.com/x') === true && m.checkDynamicConditions(m.parseRuleWithConditions('*://x.com/* @if(url $= "xn--bcher-kva.com:8080/x")').dynamicConditions, 't', 'http://xn--bcher-kva.com:8080/x') === true);

// ---- 条件-197: =接裸正则flags判定修复留档(主/Lite) ----
{
const liteSrc = fs.readFileSync(path.join(scriptDir, 'Lite.user.js'), 'utf8');
const mkPcp = (text) => new Function(constsStr + '\n' + extractFn(text, 'getInvalidRegexFlags') + '\n' + extractFn(text, 'parseConditionPart') + '\nreturn parseConditionPart;')();
const pcp = mkPcp(src); const pcpLite = mkPcp(liteSrc);
// 修复留档: =接裸正则flags判断原依赖RegExp.$2会被辅助函数test覆写, 改为显式捕获, 重复/非法flags不再回落为字符串语义
assert('条件-197: =/foo/g与=/foo/ii判定flag错误, ="/foo/ii"仍按字面量字符串, 主/Lite提取一致', pcp('title = /foo/g', 'google', 'www.google.com', 'web').matched === false && pcp('title = /foo/ii', 'google', 'www.google.com', 'web').matched === false && (() => { const r = pcp('title = "/foo/ii"', 'google', 'www.google.com', 'web'); return r.matched === true && r.dynamic.op === '=' && r.dynamic.val === '/foo/ii'; })() && SERH_RAW_EXTRACT(src, 'parseConditionPart') === SERH_RAW_EXTRACT(liteSrc, 'parseConditionPart'));
}

// 易错: stripIfConditions 需按位置降序裁剪, 优先级 !>&>| 且默认忽略大小写

// 修复留档(主/Lite): @if内=接未配对括号裸正则不再截断, regexStartAhead对CTX_C回退regexCloseAhead
{
  const consts = src.split('\n').filter(l => /const (RULE_REGEX_LIT_RE|REGEX_CTX_[A-D]) =/.test(l)).map(l => l.replace('const ', 'var ')).join('\n');
  const s = new Function(consts + '\n' + extractFn(src, 'regexCloseAhead') + '\n' + extractFn(src, 'regexStartAhead') + '\nreturn regexStartAhead;')();
  const t = (rule) => { const p = rule.indexOf('=', rule.indexOf('@if')) + 2; return s(rule, p); };
  assert('条件-198: =接未配对括号正则进正则态不截断', t('*://x.com/* @if(title = /a)b/)') === true);
  assert('条件-199: =接字符串值a/b不进正则态', t('*://x.com/* @if(title = a/b)') === false);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

})();
