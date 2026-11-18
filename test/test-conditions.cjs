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
  'parseRulesetContent', 'extractYamlRuleItems', 'getInvalidRegexFlags', 'normalizeSiteList', 'siteAliasMap', 'siteKey', 'parseConditionPart', 'tokenizeCondExpr',
  'parseCondExprTokens', 'analyzeCondExpr', 'foldCondExpr', 'evalDynamicLeaf', 'evalCondAST', 'isCondExprCore',
  'looksLikeCondExpr', 'isScriptRuleLine', 'isElementRuleLine', 'punycodeDecodeLabel', 'toUnicodeHostname',
  'parsePrefixedRegexRule', 'validateUrlWildcard', 'ruleToRegex', 'escapeWildcardPart', 'splitHostAndPort',
  'escapeHostPart', 'wildcardToRegex', 'normalizeHostCandidate', 'matchWildcardDomainPattern',
  'compileRuleRegex', 'extractBalancedParens', // extractSimpleWhitelistDomain 已并入 matchWildcardDomainPattern
  'dbg', 'dbgWarn', 'dbgError',
  'findIfOccurrences', 'stripIfConditions', 'extractIfConditions', 'evaluateCondition', 'absorbStandaloneExpr',
  'parseRuleWithConditions', 'validateCondition', 'analyzeRule', 'validateRule', 'checkDynamicConditions',
  'getSubdomainLevels', 'matchDomainEntryType', 'isLocalEntry', 'checkRuleMatchOptimized', 'hasBareRegexSlash',
].map((n) => extractFn(src, n));
const makeEnv = () => new Function(
  constsStr + '\n' + langTexts + '\n' + ALL_FNS.join('\n') + `
let _siteAliasMap = null;
function getSelectors() { return {}; }
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
function ev(folded, title, url, snippet) {
  if (folded.const !== undefined) return folded.const;
  return m.evalCondAST(folded.ast, title, url, snippet);
}

// ==== 一、条件表达式解析与识别 ====

let r = condExpr('$site = "google"', 'google');
const siteHit = r.const === true;
r = condExpr('$site = "foo"', 'google');
assert('条件-001: $site静态命中恒真且未知站点静态假不报错', siteHit && r.const === false && !r.errors);
r = condExpr('title *= 关键词', 'google');
assert('条件-002: 无引号中文title包含', !r.errors && ev(r, '含关键词的标题', 'https://x.com/') === true && ev(r, 'other', 'https://x.com/') === false);
r = condExpr('site = "例子.com"', 'google', 'xn--fsqu00a.com');
assert('条件-003: IDN归一(Unicode条件匹配punycode站点)', r.const === true);
r = condExpr('title =~ /kw1|kw2/', 'google');
assert('条件-004: 正则内|不被切分', !r.errors && r.ast.type === 'leaf' && ev(r, 'kw1 hit', 'https://x.com/') === true);
r = condExpr('title *= "a" & title *= "b"', 'google');
const andHit = !r.errors && ev(r, 'a and b', 'https://x/') === true && ev(r, 'only a', 'https://x/') === false;
r = condExpr('!title *= "a"', 'google');
const notHit = !r.errors && r.ast.type === 'not' && ev(r, '', 'https://x/') === true && ev(r, 'aaa', 'https://x/') === false;
r = condExpr('title *= "a" | title *= "b" & url *= "c"', 'google');
assert('条件-005: AND与NOT叶子及优先级&>|', andHit && notHit && !r.errors && r.ast.type === 'or' && ev(r, 'bbb', 'https://x/') === false);
r = condExpr('(title *= "a" | title *= "b") & !($site = "bing")', 'google');
assert('条件-006: 括号组&!($site=bing)剩动态', !r.const && ev(r, 'aaa', 'https://x/') === true && ev(r, 'ccc', 'https://x/') === false);

// ---- 错误检测 ----
const e1 = condExpr('foo', 'google');
const e2 = condExpr('(title *= "a" | title *= "b"', 'google');
const e3 = condExpr('title =~ /x/g', 'google');
const e4 = condExpr('title =~ /(/)', 'google');
assert('条件-007: 未知条件/括号未闭合/非法flags/无效正则均报错', e1.errors && e1.errors[0].startsWith('unknown') && e2.errors && e2.errors.some((x) => x.startsWith('syntax')) && e3.errors && e3.errors[0].startsWith('flags:g') && e4.errors && e4.errors[0].startsWith('regex'));

// ---- url 条件 ----
r = condExpr('url $= ".pdf"', 'google');
const urlSuffix = ev(r, 't', 'https://x.com/a.pdf') === true && ev(r, 't', 'https://x.com/a.txt') === false;
r = condExpr('path $= ".pdf"', 'google');
assert('条件-008: url后缀命中且非法url求值为假', urlSuffix && ev(r, 't', 'not a url') === false);
r = condExpr('url/example\\.(com|net)/', 'google');
assert('条件-009: url简写正则内括号与|整吞', !r.errors && ev(r, 't', 'https://example.com/') === true && ev(r, 't', 'https://example.net/') === true && ev(r, 't', 'https://other.net/') === false);
assert('条件-010: text条件按正文匹配', (() => {
  const a = condExpr('text *= "广告"', 'google'); const b = condExpr('text =~ /spam/i', 'google'); const c = condExpr('text/推广/', 'google');
  return !a.errors && !b.errors && !c.errors && ev(a, '', 'https://x/', '页面广告内容') === true && ev(a, '', 'https://x/', '正常内容') === false && ev(b, '', 'https://x/', 'SPAM here') === true && ev(c, '', 'https://x/', '推广信息') === true;
})());

// ---- 行尾 # 注释剥离 ----
assert('条件-011: 引号内#保留行尾注释剥离且@if正则内括号配平', m.stripRuleComment('*://x.com/* @if(title *= "a # b") # note') === '*://x.com/* @if(title *= "a # b")' && m.stripRuleComment('*://x.com/* @if(title =~ /a)b/) # x') === '*://x.com/* @if(title =~ /a)b/)');

// ---- host / path / scheme ----
const h1 = condExpr('host $= ".example.com"', 'google');
const h2 = condExpr('host ^= "www."', 'google');
const h3 = condExpr('host *= "www."', 'google');
const h4 = condExpr('host =~ /(^|\\.)example\\.com$/i', 'google');
assert('条件-012: host后缀前缀包含与正则匹配及尾点边界', ev(h1, 't', 'https://www.example.com/') === true && ev(h1, 't', 'https://example.com/') === true && ev(h2, 't', 'https://www.example.com/') === true && ev(h2, 't', 'https://wwwfoo.com/') === false && ev(h3, 't', 'https://www.example.com/') === true && ev(h3, 't', 'https://wwwhost.com/') === false && !h4.errors && ev(h4, 't', 'https://example.com/') === true && ev(h4, 't', 'https://badexample.com/') === false);
const pth = condExpr('path/download/', 'google');
const combo = condExpr('host $= ".example.com" & path *= "/download/" & scheme = "https"', 'google');
assert('条件-013: path简写与host&path&scheme组合', !pth.errors && ev(pth, 't', 'https://x.com/download/setup') === true && ev(combo, 't', 'https://dl.example.com/download/x') === true && ev(combo, 't', 'http://dl.example.com/download/x') === false);
r = condExpr('title *= "KW" i', 'google');
const iMod = !r.errors && ev(r, 'contains kw', 'https://x/') === true && ev(r, 'nothing', 'https://x/') === false;
r = condExpr('title =~ /x/I', 'google');
assert('条件-014: i修饰命中且大写I不报错', iMod && !r.errors && ev(r, 'X', 'https://x/') === true && ev(r, 'y', 'https://x/') === false);
r = condExpr('$site = "google" & $category = "images"', 'google', 'www.google.com', 'web');
const catMiss = r.const === false;
r = condExpr('$category = "Images"', 'google', 'www.google.com', 'Images');
assert('条件-015: $category折叠与大写自定义分类命中', catMiss && r.const === true);

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
assert('条件-016: 条件表达式全部识别', condTrueCases.every((rule) => m.looksLikeCondExpr(rule) === true));
const condFalseCases = [
  'https://example.com/?url=x',
  '*://*.example.com/*',
  '/example\\.com/',
  'title/foo/i',
  'example.com',
  'https://example.com/',
  '! Title: Some List',
  '! URL: https://x',
];
assert('条件-017: 非条件表达式与Adblock元数据全部排除', condFalseCases.every((rule) => m.looksLikeCondExpr(rule) === false));

// ==== 二、@if 条件提取与URL路径冲突 ====

// ---- @if提取边界 ----
const tightConds = m.extractIfConditions('*://x.com/*@if(title *= "kw")');
const pathIf = m.extractIfConditions('*://example.com/api/@if(test)/*');
assert('条件-018: 紧贴@if识别出条件且路径体@if不误判', tightConds.length === 1 && tightConds[0] === 'title *= "kw"' && pathIf.length === 0);
const escParen = m.extractIfConditions('*://x/* @if(title =~ /\\(a/)');
const inQuote = m.stripIfConditions('*://x.com/* @if(title *= "@if(y)")');
const inRegex = m.stripIfConditions('title/foo@if(bar)/');
assert('条件-019: 转义括号条件完整且引号与正则体内@if不误剥离且未闭合@if报错', escParen.length === 1 && escParen[0] === 'title =~ /\\(a/' && inQuote.coreRule === '*://x.com/*' && inQuote.staticPass === true && inRegex.coreRule === 'title/foo@if(bar)/' && m.validateRule('*://x.com/* @if((title *= "a")') === false);

// ==== 三、独立表达式 ====

let p = m.parseRuleWithConditions('host $= ".example.com"');
const bareDomain = m.parseRuleWithConditions('example.com');
const siteFold = m.parseRuleWithConditions('$site = "google"');
assert('条件-020: host裸域命中且普通域名不吸收且$site折叠恒真', m.evalCondAST(p.dynamicConditions[0], 't', 'https://example.com/') === true && bareDomain.coreRule === 'example.com' && bareDomain.dynamicConditions.length === 0 && bareDomain.staticPass && siteFold.coreRule === '' && siteFold.staticPass && siteFold.dynamicConditions.length === 0);
m.setEnv('bing', 'www.bing.com');
m.setEnv('google', 'www.google.com');

assert('条件-021: 高亮越界回退@1且@0仍报错', m.analyzeRule('@9 host $= ".example.com"').valid === true && m.analyzeRule('@0 host $= ".example.com"').valid === false);
assert('条件-022: 损坏的@if全部报错并丢弃', [
  'title/x/ @if(foo $= "bar")',
  'title/x/ @if(title =~ /bad(/)',
  '@1 /x/ @if(unknownfield = "v")',
].every((rule) => { const a = m.analyzeRule(rule); const pr = m.parseRuleWithConditions(rule); return a.valid === false && a.errors.length > 0 && pr.staticPass === false; }));

// ---- 匹配引擎与优先级 ----
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
const hostBlocked = isBlocked(doCheck(cr, urlEx, 'www.example.com', 't', null, slEx));
cr = makeCR();
cr.whitelistConditionalRules.push({ type: 'expr', conditions: m.parseRuleWithConditions('@host $= ".example.com"').dynamicConditions, source: '本地规则' });
cr.domains.set('example.com', [{ type: 'wildcard', originalRule: 'example.com', source: '本地规则' }]);
assert('条件-023: 独立host屏蔽且表达式白名单放行', hostBlocked && !isBlocked(doCheck(cr, urlEx, 'www.example.com', 't', null, slEx)));
cr = makeCR();
cr.whitelistConditionalRules.push({ type: 'expr', conditions: m.parseRuleWithConditions('@path *= "/safe/"').dynamicConditions, source: '本地规则' });
addExpr(cr, 'host $= ".example.com"');
const pathWl = !isBlocked(doCheck(cr, 'https://www.example.com/safe/a', 'www.example.com', 't', null, slEx));
cr = makeCR();
addWlExpr(cr, '@host $= ".example.com"');
addExpr(cr, 'host $= ".example.com"');
const localWlWin = !isBlocked(doCheck(cr, urlEx, 'www.example.com', 't', null, slEx));
cr = makeCR();
addExpr(cr, 'host $= ".example.com"');
addWlExpr(cr, '@host $= ".example.com"', '订阅规则1');
const subWl = doCheck(cr, urlEx, 'www.example.com', 't', null, slEx);
assert('条件-024: 路径白名单压过host黑名单且本地表达式白名单优先于本地黑名单与订阅白名单', pathWl && localWlWin && isBlocked(subWl) && subWl.source === '本地规则');

// ---- IDN与百分号编码归一 ----
p = m.parseRuleWithConditions('path/案例/');
const urlCn = m.parseRuleWithConditions('url *= "下载"').dynamicConditions[0];
const urlPct = m.parseRuleWithConditions('url *= "%E4%B8%8B%E8%BD%BD"').dynamicConditions[0];
const evU = (rule, url) => m.evalCondAST(m.parseRuleWithConditions(rule).dynamicConditions[0], 't', url);
assert('条件-025: path与url条件中文百分号及IDN形态互通', m.evalCondAST(p.dynamicConditions[0], 't', 'https://x.com/%E6%A1%88%E4%BE%8B') === true && m.evalCondAST(urlCn, 't', 'https://example.com/%E4%B8%8B%E8%BD%BD') === true && m.evalCondAST(urlPct, 't', 'https://example.com/下载') === true && evU('url =~ /下载/', 'https://example.com/%E4%B8%8B%E8%BD%BD') === true && evU('url =~ /%E4%B8%8B%E8%BD%BD/', 'https://example.com/%E4%B8%8B%E8%BD%BD') === true && evU('url =~ /例子/', 'https://xn--fsqu00a.com/') === true && evU('url =~ /xn--fsqu00a/', 'https://xn--fsqu00a.com/') === true);

// ==== 四、修复回归 ====

// ---- @if内正则编译 ----
const q1 = m.parseRuleWithConditions('*://*.example.com/* @if(url=/ab/)');
const q1c = q1.dynamicConditions[0];
assert('条件-026: @if内url=/re/按正则编译', q1.staticPass === true && q1c && q1c.type === 'leaf' && q1c.cond.op === '=~' && m.evalCondAST(q1c, 't', 'https://sub.example.com/ab/') === true);

// ---- @if单等号正则括号平衡 ----
const ruleF4 = '@if(title=/\\)$/) example.com';
const hitF4 = (title) => m.checkDynamicConditions(m.parseRuleWithConditions(ruleF4).dynamicConditions, title, 'https://example.com/x');
assert('条件-027: 单等号正则含不成对括号不误杀', m.analyzeRule(ruleF4).valid === true && hitF4('报告(2024)') === true && hitF4('报告 2024') === false);

// ---- 空串比较值守卫 ----
const ev14 = (cond, title, url) => m.evalDynamicLeaf(cond, title, url);
assert('条件-028: title空串比较值一律不命中', ev14({ type: 'title', op: '$=', val: '' }, '标题', 'https://x.com') === false && ev14({ type: 'title', op: '^=', val: '' }, '标题', 'https://x.com') === false && ev14({ type: 'title', op: '*=', val: '' }, '标题', 'https://x.com') === false && ev14({ type: 'title', op: '=', val: '' }, '标题', 'https://x.com') === false);

// ---- 深嵌套与编辑器兜底 ----
assert('条件-029: 3000层括号返回valid=false而非抛RangeError', (() => { try { return m.validateRule('@if(' + '('.repeat(3000) + 'title *= "a"' + ')'.repeat(3000) + ')') === false; } catch (e) { return false; } })());

// 忽略该问题: 未闭合flow序列逐字符重扫
const c7 = m.extractIfConditions('*://x.com/* @if(path *= /a)b/)');
assert('条件-030: *= 后 /…/ 含右括号不截断且修复后可校验求值', c7.length === 1 && c7[0] === 'path *= /a)b/' && m.validateRule('*://x.com/* @if(path *= /a)b/)') === true && m.checkDynamicConditions(m.parseRuleWithConditions('*://x.com/* @if(path *= /a)b/)').dynamicConditions, 't', 'https://x.com/a)b/c') === true && m.checkDynamicConditions(m.parseRuleWithConditions('*://x.com/* @if(path *= /a)b/)').dynamicConditions, 't', 'https://x.com/a') === false);

// ---- 条件-031: =接裸正则flags判定修复留档(主/Lite) ----
{
const liteSrc = fs.readFileSync(['', 'other'].map((d) => path.join(scriptDir, d, 'Lite.user.js')).find((p) => fs.existsSync(p)), 'utf8');
const mkPcp = (text) => new Function(constsStr + '\n' + 'var _siteAliasMap = null; function getSelectors(){ return {}; }' + extractFn(text, 'normalizeSiteList') + '\n' + extractFn(text, 'siteAliasMap') + '\n' + extractFn(text, 'siteKey') + '\n' + extractFn(text, 'getInvalidRegexFlags') + '\n' + extractFn(text, 'parseConditionPart') + '\nreturn parseConditionPart;')();
const pcp = mkPcp(src); const pcpLite = mkPcp(liteSrc);
// 修复留档: =接裸正则flags判断原依赖RegExp.$2会被辅助函数test覆写, 改为显式捕获, 重复/非法flags不再回落为字符串语义
const ok197 = (api) => api('title = /foo/g', 'google', 'www.google.com', 'web').matched === false && api('title = /foo/ii', 'google', 'www.google.com', 'web').matched === false && (() => { const r = api('title = "/foo/ii"', 'google', 'www.google.com', 'web'); return r.matched === true && r.dynamic.op === '=' && r.dynamic.val === '/foo/ii'; })();
assert('条件-031: =接裸正则flags错误, =".../ii"仍按字面量字符串(主/Lite)', ok197(pcp) && ok197(pcpLite));
}

// 易错: stripIfConditions 需按位置降序裁剪, 优先级 !>&>| 且默认忽略大小写

// ---- 条件-032: YAML文档标记内rules保留(修复留档) ----
assert('条件-032: YAML文档标记内rules保留且与正文合并', (() => {
  const r1 = m.parseRulesetContent('---\nname: Test\nrules:\n  - example.com\n  - title/.*广告.*/i\n---\n');
  const r2 = m.parseRulesetContent('---\nname: X\nrules:\n  - a.com\n---\n*://b.com/*\n');
  return r1.meta.name === 'Test' && r1.lines.filter(Boolean).join('|') === 'example.com|title/.*广告.*/i' && r2.lines.filter(Boolean).join('|') === 'a.com|*://b.com/*';
})());

// ---- 条件-033: path条件query百分号编码归一(修复留档, 主/Lite) ----
{
  const hit = (rule, u) => m.evalCondAST(m.parseRuleWithConditions(rule).dynamicConditions[0], 't', u);
  assert('条件-033: path条件中文query与百分号query互通, 路径解码与正则值不受影响',
    hit('*://x.com/* @if(path *= "关键词")', 'https://x.com/s?q=%E5%85%B3%E9%94%AE%E8%AF%8D') === true
    && hit('*://x.com/* @if(path *= "%E5%85%B3")', 'https://x.com/s?q=%E5%85%B3%E9%94%AE%E8%AF%8D') === true
    && hit('*://x.com/* @if(path $= "关键词")', 'https://x.com/s?q=%E5%85%B3%E9%94%AE%E8%AF%8D') === true
    && hit('*://x.com/* @if(path = "/s?q=关键词")', 'https://x.com/s?q=%E5%85%B3%E9%94%AE%E8%AF%8D') === true
    && hit('*://x.com/* @if(path *= "下载")', 'https://x.com/%E4%B8%8B%E8%BD%BD?q=1') === true
    && hit('*://x.com/* @if(path *= "关键词")', 'https://x.com/s?q=abc') === false
    && hit('*://x.com/* @if(url *= "关键词")', 'https://x.com/s?q=%E5%85%B3%E9%94%AE%E8%AF%8D') === true);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

})();
