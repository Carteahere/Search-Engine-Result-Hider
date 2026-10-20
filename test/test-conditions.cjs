// 条件表达式 / YAML检测 / 修复回归
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

const constsStr = src.match(/const SUPPORTED_REGEX_FLAGS = 'imsu';/)[0];
const langTexts = src.match(/const LANG_TEXTS = \{[\s\S]*?\n  \};/)[0];
const ALL_FNS = [
  'hostLabelToASCII', 'toASCIIHostname', 'toASCIIUrl', 'safeRegexTest', 'safeDecodeURIComponent', 'stripRuleComment',
  'parseRulesetContent', 'extractYamlRuleItems', 'getInvalidRegexFlags', 'parseConditionPart', 'tokenizeCondExpr',
  'parseCondExprTokens', 'analyzeCondExpr', 'foldCondExpr', 'evalDynamicLeaf', 'evalCondAST', 'isCondExprCore',
  'looksLikeCondExpr', 'isScriptRuleLine', 'isElementRuleLine', 'punycodeDecodeLabel', 'toUnicodeHostname',
  'parsePrefixedRegexRule', 'validateUrlWildcard', 'ruleToRegex', 'escapeWildcardPart', 'splitHostAndPort',
  'escapeHostPart', 'wildcardToRegex', 'normalizeHostCandidate', 'matchWildcardDomainPattern',
  'matchSimpleDomain', 'compileRuleRegex', 'extractBalancedParens', // extractSimpleWhitelistDomain 已并入 matchSimpleDomain
  'findIfOccurrences', 'stripIfConditions', 'extractIfConditions', 'evaluateCondition', 'absorbStandaloneExpr',
  'parseRuleWithConditions', 'validateCondition', 'analyzeRule', 'validateRule', 'checkDynamicConditions',
  'getSubdomainLevels', 'matchDomainEntryType', 'isLocalEntry', 'checkRuleMatchOptimized',
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
assert('条件-002: $site未命中->恒假', r.const === false);
r = condExpr('title *= 关键词', 'google');
assert('条件-003: 无引号中文title包含', !r.errors && ev(r, '含关键词的标题', 'https://x.com/') === true && ev(r, 'other', 'https://x.com/') === false);
r = condExpr('path *= "/%E4%B8%8B%E8%BD%BD/"', 'google');
assert('条件-004: 编码形式path命中解码路径', !r.errors && ev(r, 't', 'https://x.com/下载/') === true);
r = condExpr('title *= "kw1" | title *= "kw2"', 'google');
assert('条件-005: 纯或->动态AST', !r.errors && !r.const && r.ast.type === 'or');
assert('条件-006: 纯或都不含->false', ev(r, 'nothing', 'https://x.com/') === false);
r = condExpr('$site = "google" | title *= "x"', 'google');
assert('条件-007: 静态or命中->恒真', r.const === true);
r = condExpr('$site = "google" | title *= "x"', 'bing');
assert('条件-008: 静态or未命中->剩动态', !r.const && r.ast.type === 'leaf');
assert('条件-009: 剩动态标题命中', ev(r, 'xxx', 'https://x.com/') === true);
r = condExpr('site("google.com.hk")', 'google', 'www.google.com.hk');
assert('条件-010: site(...)旧括号形式兼容', r.const === true);
r = condExpr('site = "例子.com"', 'google', 'xn--fsqu00a.com');
assert('条件-011: IDN归一(Unicode条件匹配punycode站点)', r.const === true);
r = condExpr('site = "xn--fsqu00a.com"', 'google', '例子.com');
assert('条件-012: IDN归一(punycode条件匹配Unicode站点)', r.const === true);
r = condExpr('title =~ /kw1|kw2/', 'google');
assert('条件-013: 正则内|不被切分', !r.errors && r.ast.type === 'leaf' && ev(r, 'kw1 hit', 'https://x.com/') === true);
r = condExpr('title =~ /a\\/b|c/i', 'google');
assert('条件-014: 正则转义斜杠保留', !r.errors && ev(r, 'A/B', 'https://x.com/') === true);
r = condExpr('title *= "a" & title *= "b"', 'google');
assert('条件-015: AND', !r.errors && ev(r, 'a and b', 'https://x/') === true && ev(r, 'only a', 'https://x/') === false);
r = condExpr('!title *= "a"', 'google');
assert('条件-016: !前缀叶子', !r.errors && r.ast.type === 'not' && ev(r, '', 'https://x/') === true && ev(r, 'aaa', 'https://x/') === false);
r = condExpr('!(title *= "a" | title *= "b")', 'google');
assert('条件-018: !(A|B)', !r.errors && ev(r, 'ccc', 'https://x/') === true);
r = condExpr('title *= "a" & !(url *= "ads")', 'google');
assert('条件-019: 混合', ev(r, 'a t', 'https://x/page') === true && ev(r, 'a t', 'https://x/ads/1') === false);
r = condExpr('title *= "a" | title *= "b" & url *= "c"', 'google');
assert('条件-020: 优先级&>|', !r.errors && r.ast.type === 'or' && ev(r, 'bbb', 'https://x/') === false);
r = condExpr('(title *= "a" | title *= "b") & !($site = "google")', 'google');
assert('条件-022: 括号组与!()', !r.errors && r.const === false);
r = condExpr('(title *= "a" | title *= "b") & !($site = "bing")', 'google');
assert('条件-023: 括号组&!($site=bing)剩动态', !r.const && ev(r, 'aaa', 'https://x/') === true && ev(r, 'ccc', 'https://x/') === false);
r = condExpr('title *= "x" & ($site = "bing" | !($site = "yandex"))', 'google');
assert('条件-024: 嵌套折叠(bing|!yandex在google->true)', !r.const && r.ast.type === 'leaf');
r = condExpr('!!title *= "a"', 'google');
assert('条件-025: 双重否定', !r.errors && r.ast.type === 'not');

// ---- 错误检测 ----
r = condExpr('foo', 'google');
assert('条件-026: 未知条件', r.errors && r.errors[0].startsWith('unknown'));
r = condExpr('title *= "a" &', 'google');
assert('条件-027: &缺右操作数', r.errors && r.errors.some((e) => e.startsWith('syntax')));
r = condExpr('title *= "a" && title *= "b"', 'google');
assert('条件-028: 连续&&报错', r.errors && r.errors.some((e) => e.startsWith('syntax')));
r = condExpr('title *= "a" & title *= "b" & title *= "c"', 'google');
assert('条件-029: 连续单&仍合法', !r.errors);
r = condExpr('(title *= "a" | title *= "b"', 'google');
assert('条件-030: 括号未闭合', r.errors && r.errors.some((e) => e.startsWith('syntax')));
r = condExpr('title *= "a")', 'google');
assert('条件-031: 多余右括号', r.errors && r.errors.some((e) => e.startsWith('syntax')));
r = condExpr('& title *= "a"', 'google');
assert('条件-032: &开头报错', r.errors && r.errors.some((e) => e.startsWith('syntax')));
r = condExpr('', 'google');
assert('条件-033: 空串报错', r.errors);
r = condExpr('title =~ /x/g', 'google');
assert('条件-034: flags含g报错', r.errors && r.errors[0].startsWith('flags:g'));
r = condExpr('title =~ /(/)', 'google');
assert('条件-035: 无效正则报错', r.errors && r.errors[0].startsWith('regex'));
r = condExpr('title =~ /a\\', 'google');
assert('条件-036: 正则未闭合(tail转义)', r.errors);
r = condExpr('title//', 'google');
assert('条件-037: 空正则简写报错', r.errors && r.errors.some((e) => e.startsWith('unknown')));
r = condExpr('host =~ /ABC/', 'google');
assert('条件-038: host正则无i大小写敏感', !r.errors && ev(r, 't', 'https://abc.com/') === false);
r = condExpr('host =~ /ABC/i', 'google');
assert('条件-039: host正则加i忽略大小写', !r.errors && ev(r, 't', 'https://abc.com/') === true);
r = condExpr('$site = "DDG"', 'duckduckgo');
assert('条件-040: DDG别名归一', r.const === true);
r = condExpr('$site = google', 'google');
assert('条件-041: $site值未加引号合法', r.const === true);

// ---- url 条件 ----
r = condExpr('url = "https://ex.com/"', 'google');
assert('条件-042: url精确', !r.errors && ev(r, 't', 'https://ex.com/') === true && ev(r, 't', 'https://ex.com/x') === false);
r = condExpr('url ^= "https://ex"', 'google');
assert('条件-043: url前缀', ev(r, 't', 'https://example.com/') === true && ev(r, 't', 'http://ex.com/') === false);
r = condExpr('url $= ".pdf"', 'google');
assert('条件-044: url后缀', ev(r, 't', 'https://x.com/a.pdf') === true && ev(r, 't', 'https://x.com/a.txt') === false);
r = condExpr('url =~ /\\.(pdf|doc)$/', 'google');
assert('条件-045: url正则默认大小写敏感', !r.errors && ev(r, 't', 'https://x.com/a.pdf') === true && ev(r, 't', 'https://x.com/a.PDF') === false);
r = condExpr('url =~ /\\.pdf$/i', 'google');
assert('条件-046: url正则加i忽略大小写', ev(r, 't', 'https://x.com/a.PDF') === true);
r = condExpr('title=~/广告|推广/', 'google');
assert('条件-047: 紧凑=~识别为正则', !r.errors && ev(r, '广告页', 'https://x/') === true && ev(r, '正常页', 'https://x/') === false);
r = condExpr('url*=~/ads/', 'google');
assert('条件-048: 运算符后接=~显式报错', !!r.errors);
r = condExpr('title=~/未闭合', 'google');
assert('条件-049: 未闭合紧凑正则报错', !!r.errors);
r = condExpr('url/example\\.(com|net)/', 'google');
assert('条件-050: url简写正则内括号与|整吞', !r.errors && ev(r, 't', 'https://example.com/') === true && ev(r, 't', 'https://example.net/') === true && ev(r, 't', 'https://other.net/') === false);
r = condExpr('url/example\\.net/i', 'google');
assert('条件-051: url简写带flags', !r.errors && ev(r, 't', 'https://EXAMPLE.NET/') === true);
r = condExpr('url/example\\.com/ | title *= "kw"', 'google');
assert('条件-052: url简写与或组合', ev(r, 'plain', 'https://example.com/') === true && ev(r, 'has kw', 'https://other.com/') === true && ev(r, 'none', 'https://other.com/') === false);
r = condExpr('!(url $= ".pdf")', 'google');
assert('条件-053: !取反url条件', !r.errors && ev(r, 't', 'https://x.com/a.html') === true && ev(r, 't', 'https://x.com/a.pdf') === false);
r = condExpr('url ^= "https://ex.com"', 'google');
assert('条件-054: url缺失->条件假', ev(r, 't', undefined) === false);
r = condExpr('!(url ^= "https://ex.com")', 'google');
assert('条件-055: 取反后url缺失->真', ev(r, 't', undefined) === true);
r = condExpr('url =~ /[/]/', 'google');
assert('条件-056: 字符类内裸斜杠合法', !r.errors && ev(r, 't', 'https://example.com/a/b') === true);

// ---- $site 变量 ----
r = condExpr('$site : "yandex"', 'yandex');
assert('条件-057: $site冒号形式', r.const === true);
r = condExpr('$site = "google" & title *= "x"', 'google');
assert('条件-058: $site与动态组合', !r.const && ev(r, 'xx', 'https://x/') === true && ev(r, 'yy', 'https://x/') === false);
r = condExpr('$site = "google" | $site = "bing"', 'google');
assert('条件-059: $site多引擎或恒真', r.const === true);
r = condExpr('$site = "google" | $site = "bing"', 'yandex');
assert('条件-060: $site多引擎或恒假', r.const === false);
r = condExpr('$site = "foo"', 'google');
assert('条件-061: 未知站点值->静态假不报错', r.const === false && !r.errors);

// ---- 行尾 # 注释剥离 ----
assert('条件-062: URL规则行尾注释', m.stripRuleComment('*://x.com/* # 注释') === '*://x.com/*');
assert('条件-063: 整行注释', m.stripRuleComment('# 注释') === '');
assert('条件-064: 引号内#与行尾注释', m.stripRuleComment('*://x.com/* @if(title *= "a # b") # note') === '*://x.com/* @if(title *= "a # b")');
assert('条件-065: @if正则内括号配平', m.stripRuleComment('*://x.com/* @if(title =~ /a)b/) # x') === '*://x.com/* @if(title =~ /a)b/)');
assert('条件-066: URL内非空白#保留', m.stripRuleComment('*://x.com/a#b') === '*://x.com/a#b');
assert('条件-067: @if后带空格', m.stripRuleComment('*://x.com/* @if (title *= "a") # c') === '*://x.com/* @if (title *= "a")');
assert('条件-068: 引号内转义引号', m.stripRuleComment('*://x.com/* @if(title *= "a\\"b # c") # x') === '*://x.com/* @if(title *= "a\\"b # c")');
assert('条件-069: 行首@if正则含#不截断', m.stripRuleComment('@if(url =~ /foo # bar/) *://x/*') === '@if(url =~ /foo # bar/) *://x/*');

// ---- host / path / scheme ----
r = condExpr('host $= ".example.com"', 'google');
assert('条件-070: host后缀-子域与裸域', ev(r, 't', 'https://www.example.com/') === true && ev(r, 't', 'https://example.com/') === true);
assert('条件-071: host后缀-负例', ev(r, 't', 'https://example.net/') === false && ev(r, 't', 'https://badexample.com/') === false);
r = condExpr('host = "www.example.com"', 'google');
assert('条件-072: host精确', ev(r, 't', 'https://www.example.com/x') === true && ev(r, 't', 'https://example.com/') === false);
r = condExpr('host =~ /(^|\\.)example\\.com$/i', 'google');
assert('条件-073: host正则', !r.errors && ev(r, 't', 'https://example.com/') === true && ev(r, 't', 'https://badexample.com/') === false);
r = condExpr('host $= ".例子.com"', 'google');
assert('条件-074: 中文域名后缀匹配punycode URL', !r.errors && ev(r, 't', 'https://xn--fsqu00a.com/') === true);
r = condExpr('path/download/', 'google');
assert('条件-075: path简写', !r.errors && ev(r, 't', 'https://x.com/download/setup') === true);
r = condExpr('scheme = "https"', 'google');
assert('条件-076: scheme精确', !r.errors && ev(r, 't', 'https://x.com/') === true && ev(r, 't', 'http://x.com/') === false);
r = condExpr('host $= ".example.com" & path *= "/download/" & scheme = "https"', 'google');
assert('条件-077: host&path&scheme组合', ev(r, 't', 'https://dl.example.com/download/x') === true && ev(r, 't', 'http://dl.example.com/download/x') === false);
r = condExpr('path $= ".pdf"', 'google');
assert('条件-078: 非法url->假', ev(r, 't', 'not a url') === false);
r = condExpr('title =~ /x/I', 'google');
assert('条件-079: 大写I当作i不报错', !r.errors && ev(r, 'X', 'https://x/') === true && ev(r, 'y', 'https://x/') === false);
r = condExpr('title =~ /\\u{4E2D}/u', 'google');
assert('条件-080: 支持u flag', !r.errors && ev(r, '中文字', 'https://x/') === true);

// ---- i 修饰 ----
r = condExpr('title *= "KW" i', 'google');
assert('条件-081: title包含+i修饰', !r.errors && ev(r, 'contains kw', 'https://x/') === true && ev(r, 'nothing', 'https://x/') === false);
r = condExpr('title *= "a" ix', 'google');
assert('条件-082: i后多余字符->unknown', r.errors && r.errors[0].startsWith('unknown'));

// ---- $category 折叠 ----
r = condExpr('$category = "images"', 'google', 'www.google.com', 'web');
assert('条件-083: web页images条件恒假', r.const === false);
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
assert('条件-087: @if组后title/正则体首字符为转义斜杠不截断', m.validateRule('@if(site=x.com) title/' + zzb2 + '/foo #bar/') === true);
assert('条件-088: 前缀正则体内#不剥离', m.stripRuleComment('title/a/b # c/') === 'title/a/b # c/');
assert('条件-089: @if简写正则尾段含g即报flags错, 合法flags仍合法', m.validateRule('@if(title/abc/gim)') === false && m.validateRule('@if(title/abc/im)') === true);

// ---- 规则与@if之间空格可省略 ----
const tightConds = m.extractIfConditions('*://x.com/*@if(title *= "kw")');
assert('条件-090: 紧贴@if识别出条件', tightConds.length === 1 && tightConds[0] === 'title *= "kw"');
assert('条件-091: 紧贴@if剥离后只剩核心规则', m.stripIfConditions('*://x.com/*@if(title *= "kw")').coreRule === '*://x.com/*');
assert('条件-092: 路径中@if后跟路径体不误判', m.extractIfConditions('*://example.com/api/@if(test)/*').length === 0);

// ---- Lite版同步 ----
const litePath = [path.join(scriptDir, 'Lite.user.js'), path.join(scriptDir, 'other', 'Lite.user.js')].find((p) => fs.existsSync(p));
const liteSrc = fs.readFileSync(litePath, 'utf8');
const liteM2 = new Function(
  liteSrc.match(/const (?:RULE_PREFIX_RE|RULE_PREFIX_REGEX_RE|RULE_LEADING_REGEX_RE|REGEX_CTX_A|REGEX_CTX_B|REGEX_CTX_C|REGEX_CTX_D|RULE_REGEX_LIT_RE) = [^\n]+;/g).join('\n').replace(/\bconst\b/g, 'var') + '\n' +
  ['findBalancedParenEnd', 'regexCloseAhead', 'regexStartAhead', 'isBadRegexTail', 'scanRuleString', 'encodeNonAscii', 'isCondExprCore', 'looksLikeCondExpr', 'isScriptRuleLine', 'isUniqueFlagsStr', 'isFlagsCandidateError', 'stripRuleComment', 'findIfOccurrences', 'extractBalancedParens', 'stripIfConditions', 'extractIfConditions'].map((n) => SERH_RAW_EXTRACT(liteSrc, n)).join('\n') +
  '\nreturn { stripIfConditions, extractIfConditions };'
)();
assert('条件-093: Lite版同步支持@if前空格省略', liteM2.stripIfConditions('*://x.com/*@if(title *= "kw")').coreRule === '*://x.com/*' && liteM2.extractIfConditions('*://x.com/*@if(title *= "kw")').length === 1);

// ---- @if括号配平 ----
const p1 = m.extractBalancedParens('@if(title *= "a)b")', 3);
assert('条件-094: 双引号内右括号不截断', !!p1 && p1.content === 'title *= "a)b"');
const c4 = m.extractIfConditions('*://x/* @if(title =~ /\\(a/)');
assert('条件-095: 转义左括号条件完整', c4.length === 1 && c4[0] === 'title =~ /\\(a/');
const c5 = m.extractIfConditions('*://x/* @if(title =~ /a\\)b/)');
assert('条件-096: 转义右括号不提前闭合', c5.length === 1 && c5[0] === 'title =~ /a\\)b/');
const c6 = m.extractIfConditions('*://x/* @if(title =~ /[(]a[)]/)');
assert('条件-097: 正则字符类内括号忽略', c6.length === 1 && c6[0] === 'title =~ /[(]a[)]/');
assert('条件-098: 真正不闭合返回null', m.extractBalancedParens('@if((title *= "a")', 3) === null);
const sQ = m.stripIfConditions('*://x.com/* @if(title *= "@if(y)")');
const cQ = m.extractIfConditions('*://x.com/* @if(title *= "@if(y)")');
assert('条件-099: 引号内@if不产生伪剥离', sQ.coreRule === '*://x.com/*' && sQ.staticPass === true);
assert('条件-100: 引号内@if不产生伪条件', cQ.length === 1 && cQ[0] === 'title *= "@if(y)"');
assert('条件-101: title正则体内@if不剥离', m.stripIfConditions('title/foo@if(bar)/').coreRule === 'title/foo@if(bar)/');
assert('条件-102: URL路径内@if(不误判剥离', m.stripIfConditions('*://example.com/api/@if(test)/*').coreRule === '*://example.com/api/@if(test)/*');
assert('条件-103: 条件正则体内@if不伪剥离', m.stripIfConditions('*://x.com/* @if(title =~ /a@if(b)/)').coreRule === '*://x.com/*');
const noOccCases = ['url/foo@if(bar)/', '@1 title/foo@if(bar)/i'];
assert('条件-104: 行首简写正则体内@if不产生伪条件', noOccCases.every((rule) => m.findIfOccurrences(rule).length === 0));

// ---- URL路径含关键字段不误吞@if ----
const pathConflictCases = [
  '*://x.com/title/y @if(title *= "a")',
  '*://x.com/a/title/b/url/c @if(url *= "q")',
];
assert('条件-105: @if检测不受路径关键字段干扰', pathConflictCases.every((rule) => m.findIfOccurrences(rule).length === 1));
assert('条件-106: 剥离@if后保留核心规则', pathConflictCases.every((rule) => { const stripped = m.stripIfConditions(rule); return stripped.coreRule === rule.replace(/ @if\(.*\)$/, '') && stripped.staticPass === true; }));
const sM = m.stripIfConditions('*://x.com/url/* @if(title *= "a") @if($site = "google")');
assert('条件-107: 多@if与路径冲突同时剥离', sM.coreRule === '*://x.com/url/*' && sM.staticPass === true);
assert('条件-108: 未闭合@if报错', m.validateRule('*://x.com/* @if((title *= "a")') === false);

// ==== 三、独立表达式 ====

assert('条件-109: 取反像表达式', m.looksLikeCondExpr('!title *= "ad"') === true);
assert('条件-110: 取反冒号条件可识别', m.looksLikeCondExpr('!title:foo') === true && m.looksLikeCondExpr('!url:https://x') === true);
assert('条件-111: Adblock元数据仍被排除', m.looksLikeCondExpr('! Title: Some List') === false && m.looksLikeCondExpr('! URL: https://x') === false);

let p = m.parseRuleWithConditions('host $= ".example.com"');
assert('条件-112: 独立host无core', p.coreRule === '' && p.staticPass === true && p.dynamicConditions.length === 1);
assert('条件-113: host裸域命中', m.evalCondAST(p.dynamicConditions[0], 't', 'https://example.com/') === true);
p = m.parseRuleWithConditions('host $= ".example.com" & path *= "/download/"');
assert('条件-114: 组合表达式', p.coreRule === '' && p.staticPass && p.dynamicConditions.length === 1);
p = m.parseRuleWithConditions('@host $= ".example.com"');
assert('条件-115: 白名单独立表达式', p.coreRule === '@' && p.staticPass && p.dynamicConditions.length === 1);
p = m.parseRuleWithConditions('host $= ".example.com" @if(title *= "kw")');
assert('条件-116: 独立表达式+@if', p.coreRule === '' && p.staticPass && p.dynamicConditions.length === 2);
p = m.parseRuleWithConditions('example.com');
assert('条件-117: 普通域名不吸收', p.coreRule === 'example.com' && p.dynamicConditions.length === 0 && p.staticPass);
p = m.parseRuleWithConditions('*://*.example.com/* @if(title *= "kw")');
assert('条件-118: 旧复合规则仍剥离@if', p.coreRule === '*://*.example.com/*' && p.dynamicConditions.length === 1);
p = m.parseRuleWithConditions('@if(host $= ".example.com")');
assert('条件-119: 仅@if行视为表达式', p.coreRule === '' && p.staticPass && p.dynamicConditions.length === 1);
p = m.parseRuleWithConditions('!title *= "ad"');
assert('条件-120: 独立取反', p.coreRule === '' && p.staticPass);
p = m.parseRuleWithConditions('$site = "google"');
assert('条件-121: $site命中折叠恒真', p.coreRule === '' && p.staticPass && p.dynamicConditions.length === 0);
m.setEnv('bing', 'www.bing.com');
p = m.parseRuleWithConditions('$site = "google"');
assert('条件-122: $site未命中静态丢弃', p.staticPass === false);
m.setEnv('google', 'www.google.com');

assert('条件-123: 残缺表达式无效', m.analyzeRule('host $= ').valid === false);
assert('条件-124: 空@if无效', m.analyzeRule('@if()').valid === false);
assert('条件-125: 高亮越界无效', m.analyzeRule('@9 host $= ".example.com"').valid === false);
assert('条件-126: 复合旧写法有效', m.analyzeRule('*://*.example.com/* @if(title *= "kw")').valid === true);
assert('条件-127: $category独立表达式有效', m.analyzeRule('$category = "images"').valid === true);
p = m.parseRuleWithConditions('/example\\.(com|net)/ @if(title *= "kw")');
assert('条件-128: 编译保留1个动态条件', p.staticPass === true && p.dynamicConditions.length === 1);
p = m.parseRuleWithConditions('/foo@if(bar)/');
assert('条件-129: 正则体内@if不提取', p.staticPass === true && p.dynamicConditions.length === 0 && p.coreRule === '/foo@if(bar)/');
p = m.parseRuleWithConditions('x.com @if(title =~ /a(b)c/)');
assert('条件-130: 条件值内括号的合法正则正常提取', p.staticPass === true && p.dynamicConditions.length === 1 && p.coreRule === 'x.com');
assert('条件-131: 损坏的@if全部报错并丢弃', [
  'title/x/ @if(foo $= "bar")',
  'title/x/ @if(title =~ /bad(/)',
  '@1 /x/ @if(unknownfield = "v")',
].every((rule) => { const a = m.analyzeRule(rule); const pr = m.parseRuleWithConditions(rule); return a.valid === false && a.errors.length > 0 && pr.staticPass === false; }));

// ---- 匹配引擎 ----
const slEx = ['www.example.com', 'example.com'];
const urlEx = 'https://www.example.com/download/setup.exe';
const urlOther = 'https://other.net/page';
const slOther = ['other.net'];
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
assert('条件-133: 独立host不误伤', !isBlocked(doCheck(cr, urlOther, 'other.net', 't', null, slOther)));
cr = makeCR();
cr.whitelistConditionalRules.push({ type: 'expr', conditions: m.parseRuleWithConditions('@host $= ".example.com"').dynamicConditions, source: '本地规则' });
cr.domains.set('example.com', [{ type: 'wildcard', originalRule: 'example.com', source: '本地规则' }]);
assert('条件-134: 独立表达式白名单放行', !isBlocked(doCheck(cr, urlEx, 'www.example.com', 't', null, slEx)));
cr = makeCR();
cr.whitelistConditionalRules.push({ type: 'expr', conditions: m.parseRuleWithConditions('@path *= "/safe/"').dynamicConditions, source: '本地规则' });
addExpr(cr, 'host $= ".example.com"');
assert('条件-135: 路径白名单压过host黑名单', !isBlocked(doCheck(cr, 'https://www.example.com/safe/a', 'www.example.com', 't', null, slEx)));
assert('条件-136: 非安全路径仍屏蔽', isBlocked(doCheck(cr, urlEx, 'www.example.com', 't', null, slEx)));
cr = makeCR();
addExpr(cr, 'host $= ".example.com" @if(title *= "kw")');
assert('条件-137: 独立表达式与@if同时生效', isBlocked(doCheck(cr, urlEx, 'www.example.com', 'has kw', null, slEx)));
assert('条件-138: @if不满足不屏蔽', !isBlocked(doCheck(cr, urlEx, 'www.example.com', 'plain', null, slEx)));

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
cr = makeCR();
addExpr(cr, 'host $= ".example.com"');
cr.whitelistDomains.set('example.com', [{ type: 'wildcard', source: '订阅规则1' }]);
r = doCheck(cr, urlEx, 'www.example.com', 't', null, slEx);
assert('条件-141: 本地黑名单 > 订阅域名白名单', isBlocked(r) && r.source === '本地规则');
cr = makeCR();
addExpr(cr, 'host $= ".example.com"');
cr.highlightDomains.set('example.com', [{ N: 3, type: 'wildcard' }]);
r = doCheck(cr, urlEx, 'www.example.com', 't', null, slEx);
assert('条件-142: 高亮+黑名单两者都返回', r && r.highlight === 3 && r.blocked === true);
cr = makeCR();
addWlExpr(cr, '@host $= ".other.com"');
addExpr(cr, 'host $= ".example.com"');
assert('条件-143: 未命中的表达式白名单不放行', isBlocked(doCheck(cr, urlEx, 'www.example.com', 't', null, slEx)));

// ---- path 正则大小写与解码回归 ----
p = m.parseRuleWithConditions('path/search/');
assert('条件-144: path正则默认大小写敏感', m.evalCondAST(p.dynamicConditions[0], 't', 'https://x.com/SEARCH') === false);
assert('条件-145: path正则匹配原文小写', m.evalCondAST(p.dynamicConditions[0], 't', 'https://x.com/search') === true);
p = m.parseRuleWithConditions('path/案例/');
assert('条件-146: path正则匹配percent解码变体', m.evalCondAST(p.dynamicConditions[0], 't', 'https://x.com/%E6%A1%88%E4%BE%8B') === true);
assert('条件-147: 白名单/高亮前缀保留在规则键中', m.stripRuleComment('@example.com') === '@example.com' && m.stripRuleComment('@2 fast.com') === '@2 fast.com' && m.stripRuleComment('example.com') === 'example.com');

// ==== 四、修复回归 ====

// ---- @if组后独立正则的上下文恢复 ----
assert('条件-148: @if组后独立正则内#不截断', m.stripRuleComment('@if(site("x.com")) /ab[ #]cd/') === '@if(site("x.com")) /ab[ #]cd/');
assert('条件-149: URL通配符中字面@if(不被当条件组', m.stripRuleComment('*://example.com/api/@if(test)/* # c') === '*://example.com/api/@if(test)/*');
assert('条件-150: 连续@if组后正则上下文恢复', m.stripRuleComment('@if(a) @if(b) /ab[ #]cd/ # note') === '@if(a) @if(b) /ab[ #]cd/');
assert('条件-151: @if组后正则体内@if(不剥离为条件', m.stripIfConditions('@if(engine=google) /x[ @if(y)]z/').coreRule === '/x[ @if(y)]z/');
assert('条件-152: @if组后正则体内@if(不产生伪条件', m.findIfOccurrences('@if(a) /x@if(b)y/').length === 1);
assert('条件-153: @if组后紧邻无空格正则同样恢复', m.findIfOccurrences('@if(a)/x[ @if(b)]y/').length === 1);

// ---- 多斜杠裸值 ----
assert('条件-154: 单斜杠裸值无语法错误', m.analyzeCondExpr('path ^= /search', 'google', 'www.google.com', 'web').errors.length === 0);
assert('条件-155: 元数据行"! host:"不误判为条件', m.looksLikeCondExpr('! host: a.com') === false);
r = condExpr('path ^= /en/us');
assert('条件-156: 多斜杠裸值前缀命中真实路径', !r.errors && ev(r, 't', 'https://x.com/en/us/list') === true);
assert('条件-157: 未发生/enus/式破坏', !r.errors && ev(r, 't', 'https://x.com/enus/list') === false);
r = condExpr('path = /a/b');
assert('条件-158: 双斜杠裸值精确匹配', !r.errors && ev(r, 't', 'https://x.com/a/b') === true && ev(r, 't', 'https://x.com/a/b/c') === false);
r = condExpr('path ^= /en/us & title *= "x"');
assert('条件-159: 多斜杠值后逻辑组合正常切分', !r.errors && r.ast.type === 'and' && ev(r, 'x', 'https://x.com/en/us/1') === true && ev(r, 'y', 'https://x.com/en/us/1') === false);

// ---- YAML自动检测 ----
const nz = (ls) => ls.map((l) => l.trim()).filter((l) => l);
const pbug = m.parseRulesetContent('example.com\nmatches:\n- foo.com\nbad.com');
assert('条件-160: 首行为规则的纯文本不进YAML', nz(pbug.lines).length === 4 && nz(pbug.lines)[0] === 'example.com' && nz(pbug.lines)[3] === 'bad.com');
const pbug2 = m.parseRulesetContent('*://a.com/*\nrules:\n  - b.com\ntext/广告/\n');
assert('条件-161: 首行URL规则+杂rules段保持原样', nz(pbug2.lines).length === 4 && nz(pbug2.lines)[2] === '- b.com');
const pyaml = m.parseRulesetContent('# header comment\nname: X\nrules:\n  - a.com\n');
assert('条件-162: 注释后首键name仍进YAML', pyaml.meta.name === 'X' && pyaml.lines.length === 1 && pyaml.lines[0] === 'a.com');
const pcond = m.parseRulesetContent('host $= ".example.com"\nmatches:\n- x.com\n');
assert('条件-163: 首行独立条件表达式按纯文本保留', nz(pcond.lines).length === 3 && nz(pcond.lines)[0] === 'host $= ".example.com"');

// ---- host端口条件 ----
const portCond = m.parseRuleWithConditions('host $= "example.com:8080"').dynamicConditions[0];
assert('条件-164: 端口条件保持点号边界', m.evalCondAST(portCond, 't', 'http://badexample.com:8080/') === false);
assert('条件-165: 纯端口条件命中任意带端口URL', m.evalCondAST(m.parseRuleWithConditions('host $= ":8080"').dynamicConditions[0], 't', 'http://badexample.com:8080/') === true);
assert('条件-166: ":80"对显式默认端口与省略端口都不命中', m.evalCondAST(m.parseRuleWithConditions('host $= ":80"').dynamicConditions[0], 't', 'http://example.com:80/') === false && m.evalCondAST(m.parseRuleWithConditions('host $= ":80"').dynamicConditions[0], 't', 'http://example.com/') === false);

// ---- IDN与非BMP字符 ----
m.setEnv('duckduckgo_lite', 'lite.duckduckgo.com');
const liteRule = m.parseRuleWithConditions('*://*.example.com/* @if($site = "duckduckgo")');
assert('条件-167: $site主站别名不命中lite站点', liteRule.staticPass === false && liteRule.dynamicConditions.length === 0);
m.setEnv('google', 'www.google.com');
const urlCond = m.parseRuleWithConditions('url *= "例子.com"').dynamicConditions[0];
assert('条件-168: url条件同样做IDN归一命中punycode URL', m.evalCondAST(urlCond, 't', 'https://xn--fsqu00a.com/') === true);
const urlPath = m.parseRuleWithConditions('url *= "下载"').dynamicConditions[0];
const urlPct = m.parseRuleWithConditions('url *= "%E4%B8%8B%E8%BD%BD"').dynamicConditions[0];
assert('条件-169: url条件中文路径与百分号路径互通', m.evalCondAST(urlPath, 't', 'https://example.com/%E4%B8%8B%E8%BD%BD') === true && m.evalCondAST(urlPct, 't', 'https://example.com/下载') === true);
const emojiCond = m.parseRuleWithConditions('url *= "😀"').dynamicConditions[0];
let emojiErr = null;
let emojiHit = null;
try { emojiHit = m.evalCondAST(emojiCond, 't', 'https://example.com/article'); } catch (e) { emojiErr = String(e); }
assert('条件-170: 非BMP字符url条件不抛URIError且不误命中', emojiHit === false && emojiErr === null);
assert('条件-171: punycode非法字符回退原文', m.toUnicodeHostname('xn--a_b') === 'xn--a_b' && m.toUnicodeHostname('xn--a+b') === 'xn--a+b' && m.toUnicodeHostname('xn--fsqu00a.com') === '例子.com');

// ---- 元数据行识别 ----
const peD = m.parseRuleWithConditions('!Title: EasyList');
assert('条件-172: 大写无空格元数据行不编译为取反条件', m.looksLikeCondExpr('!Title: EasyList') === false && peD.standaloneExpr === false && peD.dynamicConditions.length === 0);

// ---- @if内正则编译 / 静态@if / 未闭合报错 ----
const q1 = m.parseRuleWithConditions('*://*.example.com/* @if(url=/ab/)');
const q1c = q1.dynamicConditions[0];
assert('条件-173: @if内url=/re/按正则编译', q1.staticPass === true && q1c && q1c.type === 'leaf' && q1c.cond.op === '=~' && m.evalCondAST(q1c, 't', 'https://sub.example.com/ab/') === true);
m.setEnv('bing', 'www.bing.com');
const q2 = m.parseRuleWithConditions('@if($site=bing)');
assert('条件-174: 命中的纯静态独立@if保留为全匹配表达式', q2.staticPass === true && q2.coreRule === '' && q2.standaloneExpr === true && q2.dynamicConditions.length === 0);
const aC3 = m.analyzeRule('title/abc #def');
assert('条件-175: 未闭合title/前缀正则报错', aC3.valid === false && aC3.errors.length > 0 && m.parsePrefixedRegexRule('title/abc #def', 6).unclosed === true && m.analyzeRule('title/abc/ #def').valid === true, aC3);
m.setEnv('google', 'www.google.com');

// ---- url =~ 的百分号/IDN归一 ----
const evU = (rule, url) => m.evalCondAST(m.parseRuleWithConditions(rule).dynamicConditions[0], 't', url);
assert('条件-176: url =~同时测原文与归一形态', evU('url =~ /下载/', 'https://example.com/%E4%B8%8B%E8%BD%BD') === true && evU('url =~ /%E4%B8%8B%E8%BD%BD/', 'https://example.com/%E4%B8%8B%E8%BD%BD') === true && evU('url =~ /例子/', 'https://xn--fsqu00a.com/') === true && evU('url =~ /xn--fsqu00a/', 'https://xn--fsqu00a.com/') === true);

// ---- 订阅YAML: matches段 ----
const pM7 = m.parseRulesetContent('name: X\nmatches:\n- foo.com\n');
assert('条件-177: 仅matches段的uBlacklist订阅正常解析', nz(pM7.lines).length === 1 && nz(pM7.lines)[0] === 'foo.com' && pM7.meta.name === 'X');

// ---- @if单等号正则括号平衡 ----
const ruleF4 = '@if(title=/\\)$/) example.com';
const hitF4 = (title) => m.checkDynamicConditions(m.parseRuleWithConditions(ruleF4).dynamicConditions, title, 'https://example.com/x');
assert('条件-178: 单等号正则含不成对括号不误杀', m.analyzeRule(ruleF4).valid === true && hitF4('报告(2024)') === true && hitF4('报告 2024') === false);

// ---- host条件值归一为空串的恒真守卫 ----
const hitF13 = (cond) => m.checkDynamicConditions(m.parseRuleWithConditions(cond).dynamicConditions, '标题', 'https://example.com/x');
assert('条件-179: host归一为空串时^=/*=不恒真', hitF13('@if(host ^= .) x.com') === false && hitF13('@if(host ^= ".") x.com') === false && hitF13('@if(host *= .) x.com') === false);

// ---- 空串比较值守卫 ----
const ev14 = (cond, title, url) => m.evalDynamicLeaf(cond, title, url);
assert('条件-180: title空串比较值一律不命中', ev14({ type: 'title', op: '$=', val: '' }, '标题', 'https://x.com') === false && ev14({ type: 'title', op: '^=', val: '' }, '标题', 'https://x.com') === false && ev14({ type: 'title', op: '*=', val: '' }, '标题', 'https://x.com') === false && ev14({ type: 'title', op: '=', val: '' }, '标题', 'https://x.com') === false);
assert('条件-181: url/path/scheme空串比较值不命中', ev14({ type: 'url', op: '^=', val: '' }, 't', 'https://x.com/a') === false && ev14({ type: 'path', op: '*=', val: '' }, 't', 'https://x.com/a') === false && ev14({ type: 'scheme', op: '^=', val: '' }, 't', 'https://x.com/a') === false);

// ---- 深嵌套与编辑器兜底 ----
assert('条件-182: 3000层括号返回valid=false而非抛RangeError', (() => { try { return m.validateRule('@if(' + '('.repeat(3000) + 'title *= "a"' + ')'.repeat(3000) + ')') === false; } catch (e) { return false; } })());

// ---- @if简写与独立规则对齐 ----
assert('条件-184: @if简写未转义斜杠与独立规则一致接受', m.validateRule('@if(title/a/b/)') === true && m.validateRule('title/a/b/') === true);
assert('条件-185: @if简写重复flags与独立规则一致报错', m.validateRule('@if(title/abc/ii)') === false && m.validateRule('title/abc/ii') === false);

// ---- YAML flow注释剥离 / @if值内括号扫描 ----
const flowC1 = m.parseRulesetContent('rules: [a.com, b.com] # 参考 [来源]\n');
assert('条件-186: 单行flow行尾注释含]不污染末项', nz(flowC1.lines).join(',') === 'a.com,b.com');
const flowC2 = m.parseRulesetContent('rules: [\n  a.com, # 注释, 含逗号\n  b.com # 参考 [1]\n]\n');
assert('条件-187: 多行flow行内注释剥离且注释逗号不注入规则', nz(flowC2.lines).join(',') === 'a.com,b.com');
const flowC3 = m.parseRulesetContent('matches: [\n  a.com # 参考 [1]\n]\n');
assert('条件-188: matches多行flow注释行末项完整', nz(flowC3.lines).join(',') === 'a.com');
const flowC4 = m.parseRulesetContent('rules: [a.com # c]\n');
assert('条件-189: 注释先于]的旧容错提取不回归', nz(flowC4.lines).join(',') === 'a.com');
const c7 = m.extractIfConditions('*://x.com/* @if(path *= /a)b/)');
assert('条件-190: *= 后 /…/ 含右括号不截断条件', c7.length === 1 && c7[0] === 'path *= /a)b/');
const c8 = m.extractIfConditions('*://x.com/* @if(host ^= /a(b/)');
assert('条件-191: ^= 后 /…/ 含左括号不误配平', c8.length === 1 && c8[0] === 'host ^= /a(b/');
const c9 = m.extractIfConditions('*://x.com/* @if(title *= /re/)');
const c10 = m.extractIfConditions('*://x.com/* @if(path *= /usr)');
assert('条件-192: 常规值与无闭合斜杠的值扫描结果不变', c9.length === 1 && c9[0] === 'title *= /re/' && c10.length === 1 && c10[0] === 'path *= /usr');
assert('条件-193: 修复后规则可校验且值仍按字面量求值', m.validateRule('*://x.com/* @if(path *= /a)b/)') === true && m.checkDynamicConditions(m.parseRuleWithConditions('*://x.com/* @if(path *= /a)b/)').dynamicConditions, 't', 'https://x.com/a)b/c') === true && m.checkDynamicConditions(m.parseRuleWithConditions('*://x.com/* @if(path *= /a)b/)').dynamicConditions, 't', 'https://x.com/a') === false);
assert('条件-194: Lite版同步 /…/ 值括号配平不截断', liteM2.extractIfConditions('*://x.com/* @if(path *= /a)b/)')[0] === 'path *= /a)b/' && liteM2.extractIfConditions('*://x.com/* @if(host ^= /a(b/)')[0] === 'host ^= /a(b/');

// ---- 条件-195: @N 与 @if 紧贴写法修复留档(与规则-254/255同步) ----
assert('条件-195: @N@if(...) 无空格紧贴写法可校验且高亮N前缀被剥离', m.analyzeRule('@2@if(title *= "kw")').valid === true && m.analyzeRule('@2 @if(title *= "kw")').valid === true && m.analyzeRule('@1@*://*.example.com/*').valid === false);

// 易错: stripIfConditions 需按位置降序裁剪, 优先级 !>&>| 且默认忽略大小写
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

})();
