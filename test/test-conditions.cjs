// 条件表达式: 解析与识别 / @if条件提取与URL路径冲突 / 独立表达式
// 命名规则: 条件-三位序号: 描述; (对照) 为语义标记
// 分区: 一、核心解析 / 二、修复回归
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


// ==== 一、核心解析 ====

// ---- 条件-001~226: 条件表达式解析与识别 ----
await (async () => {
const fns = [
  'hostLabelToASCII',
  'toASCIIHostname',
  'toASCIIUrl',
  'safeRegexTest',
  'safeDecodeURIComponent',
  'stripRuleComment',
  'parseRulesetContent',
  'extractYamlRuleItems',
  'getInvalidRegexFlags',
  'parseConditionPart',
  'tokenizeCondExpr',
  'parseCondExprTokens',
  'analyzeCondExpr',
  'foldCondExpr',
  'evalDynamicLeaf',
  'evalCondAST',
  'isCondExprCore',
  'looksLikeCondExpr',
  // validateRule依赖闭包 (parseRulesetContent YAML探测的"合法规则行"停扫判定)
  'punycodeDecodeLabel',
  'toUnicodeHostname',
  'parsePrefixedRegexRule',
  'validateUrlWildcard',
  'ruleToRegex',
  'escapeWildcardPart',
  'splitHostAndPort',
  'escapeHostPart',
  'wildcardToRegex',
  'matchWildcardDomainPattern',
  'extractSimpleWhitelistDomain',
  'matchSimpleDomain',
  'compileRuleRegex',
  'extractBalancedParens',
  'findIfOccurrences',
  'stripIfConditions',
  'evaluateCondition',
  'absorbStandaloneExpr',
  'parseRuleWithConditions',
  'validateCondition',
  'analyzeRule',
  'validateRule',
].map((n) => extractFn(src, n));

  const consts = src.match(/const SUPPORTED_REGEX_FLAGS = 'imsu';/)[0];
  const langTexts = src.match(/const LANG_TEXTS = \{[\s\S]*?\n  \};/)[0];
const factory = new Function(
  consts + '\n' + langTexts + '\n' + fns.join('\n') + `
const window = { location: { hostname: 'www.google.com', pathname: '/search', search: '?q=x', href: 'https://www.google.com/search?q=x' } };
function getSearchEngine() { return 'google'; }
function getSearchCategory() { return 'web'; }
function t(key, params = {}) { return key; }
const currentConfig = { rules: [], debug: false };
let compiledRules;
const validationCache = new Map();
const subdomainCache = new Map();
` + `\nreturn { safeRegexTest, getInvalidRegexFlags, parseConditionPart, tokenizeCondExpr, parseCondExprTokens, analyzeCondExpr, foldCondExpr, evalDynamicLeaf, evalCondAST, stripRuleComment, parseRulesetContent, isCondExprCore, looksLikeCondExpr, validateRule };`,
);
const m = factory();

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


// ---- 旧语法等价性 ----
let r = condExpr('$site = "google"', 'google');
assert('条件-001: $site静态真->恒真', r.const === true);

r = condExpr('$site = "google"', 'bing');
assert('条件-002: $site静态假->恒假', r.const === false);
// 注: $site命中/未命中的其余变形(条件-003/108/109/110/111)与本条同路径, 合并删除; 别名/大小写见 条件-077/122/125/127

r = condExpr('Google', 'google');
assert('条件-004: 裸引擎名已移除->unknown', r.errors && r.errors[0].startsWith('unknown'));

r = condExpr('title *= 关键词', 'google');
assert('条件-005: 无引号中文title包含', !r.errors && ev(r, '含关键词的标题', 'https://x.com/') === true && ev(r, 'other', 'https://x.com/') === false);
r = condExpr('path *= /a%20b/', 'google');
assert('条件-007: 无引号含百分号路径', !r.errors && ev(r, 't', 'https://x.com/a%20b/c') === true);
r = condExpr('path *= "/下载/"', 'google');
assert('条件-008: 中文path解码比对', !r.errors && ev(r, 't', 'https://x.com/下载/list') === true && ev(r, 't', 'https://x.com/other') === false);
r = condExpr('path *= "/%E4%B8%8B%E8%BD%BD/"', 'google');
assert('条件-010: 编码形式path仍命中', !r.errors && ev(r, 't', 'https://x.com/下载/') === true);

r = condExpr('title *= "kw1" | title *= "kw2"', 'google');
assert('条件-011: 纯或->动态AST', !r.errors && !r.const && r.ast.type === 'or');
assert('条件-012: kw1命中', ev(r, 'has kw1 here', 'https://x.com/') === true);
assert('条件-014: 都不含->false', ev(r, 'nothing', 'https://x.com/') === false);
assert('条件-015: 无标题->false', ev(r, '', 'https://x.com/') === false);

r = condExpr('$site = "google" | title *= "x"', 'google');
assert('条件-016: 静态or命中->无条件恒真', r.const === true);

r = condExpr('$site = "google" | title *= "x"', 'bing');
assert('条件-017: 静态or未命中->剩动态', !r.const && r.ast.type === 'leaf');
assert('条件-018: 标题含x', ev(r, 'xxx', 'https://x.com/') === true);

r = condExpr('title = "AbC"', 'google');
assert('条件-020: 标题精确(默认忽略大小写)', ev(r, 'abc', 'https://x.com/') === true && ev(r, 'abd', 'https://x.com/') === false);

r = condExpr('site = "google.com.hk"', 'google', 'www.google.com.hk');
assert('条件-021: site静态命中', r.const === true);
r = condExpr('site = "google.com.hk"', 'google', 'www.bing.com');
assert('条件-022: site静态未命中', r.const === false);
r = condExpr('site("google.com.hk")', 'google', 'www.google.com.hk');
assert('条件-023: site(...) 旧括号形式兼容', r.const === true);

r = condExpr('site = "例子.com"', 'google', 'xn--fsqu00a.com');
assert('条件-024: site条件IDN归一化(Unicode条件匹配punycode站点)', r.const === true);
r = condExpr('site = "xn--fsqu00a.com"', 'google', '例子.com');
assert('条件-025: site条件IDN归一化(punycode条件匹配Unicode站点)', r.const === true);
r = condExpr('site = "例子.com"', 'google', 'www.例子.com');
assert('条件-026: site条件IDN子域后缀匹配', r.const === true);

r = condExpr('title =~ /kw1|kw2/', 'google');
assert('条件-027: 标题正则(正则内|不被切分)', !r.errors && r.ast.type === 'leaf');
assert('条件-028: kw1命中', ev(r, 'kw1 hit', 'https://x.com/') === true);
assert('条件-030: 都不含', ev(r, 'kk', 'https://x.com/') === false);

r = condExpr('title =~ /a\\/b|c/i', 'google');
assert('条件-031: 正则转义斜杠保留', !r.errors && ev(r, 'A/B', 'https://x.com/') === true);

r = condExpr('url *= "test"', 'google');
assert('条件-032: url包含', ev(r, 't', 'https://ex.com/test/') === true && ev(r, 't', 'https://ex.com/other') === false);

// 多@if = AND: 两条 AST 需全部为真
r1 = condExpr('title *= "a"', 'google');
r2 = condExpr('!($site = "google")', 'bing');
assert('条件-033: 多@if与(engine场景)', ev(r1, 'a t', 'https://x/') === true && r2.const === true);

// ---- 新语法 & ! ( ) ----
r = condExpr('title *= "a" & title *= "b"', 'google');
assert('条件-034: AND', !r.errors && ev(r, 'a and b', 'https://x/') === true && ev(r, 'only a', 'https://x/') === false);

r = condExpr('!title *= "a"', 'google');
assert('条件-035: !前缀叶子', !r.errors && r.ast.type === 'not');
assert('条件-036: 无标题->取反命中', ev(r, '', 'https://x/') === true);
assert('条件-038: 标题含a->不命中', ev(r, 'aaa', 'https://x/') === false);

r = condExpr('!(title *= "a" | title *= "b")', 'google');
assert('条件-039: !(A|B)', !r.errors);
assert('条件-040: 新3a', ev(r, 'ccc', 'https://x/') === true);

r = condExpr('title *= "a" & !(url *= "ads")', 'google');
assert('条件-042: 混合', ev(r, 'a t', 'https://x/page') === true && ev(r, 'a t', 'https://x/ads/1') === false);

r = condExpr('title *= "a" | title *= "b" & url *= "c"', 'google');
assert('条件-043: 优先级 & > |', !r.errors && r.ast.type === 'or');
assert('条件-044: b含但url无c->false(&优先于|)', ev(r, 'bbb', 'https://x/') === false);

r = condExpr('(title *= "a" | title *= "b") & !($site = "google")', 'google');
assert('条件-047: 括号组与!()', !r.errors && r.const === false);

r = condExpr('(title *= "a" | title *= "b") & !($site = "bing")', 'google');
assert('条件-048: 括号组&!($site=bing)在google', !r.const && ev(r, 'aaa', 'https://x/') === true && ev(r, 'ccc', 'https://x/') === false);

r = condExpr('!($site = "bing")', 'google');
assert('条件-049: 静态取反', r.const === true);
r = condExpr('!($site = "bing")', 'bing');
assert('条件-050: 静态取反2', r.const === false);

r = condExpr('title *= "x" & ($site = "bing" | !($site = "google"))', 'google');
assert('条件-051: 复杂嵌套折叠(bing|!google 在google: false|false=false)', r.const === false);
r = condExpr('title *= "x" & ($site = "bing" | !($site = "yandex"))', 'google');
assert('条件-052: 同上在google: false|true=true->剩title条件', !r.const && r.ast.type === 'leaf');

r = condExpr('!!title *= "a"', 'google');
assert('条件-053: 双重否定', !r.errors && r.ast.type === 'not');

// ---- 错误检测 ----
r = condExpr('foo', 'google');
assert('条件-054: 未知条件', r.errors && r.errors[0].startsWith('unknown'));
r = condExpr('title *= "a" &', 'google');
assert('条件-055: &缺右操作数', r.errors && r.errors.some((e) => e.startsWith('syntax')));
r = condExpr('title *= "a" && title *= "b"', 'google');
assert('条件-056: 连续&', r.errors && r.errors.some((e) => e.startsWith('syntax')));
r = condExpr('title *= "a" & title *= "b" & title *= "c"', 'google');
assert('条件-059: 连续单&仍合法', !r.errors);
r = condExpr('(title *= "a" | title *= "b"', 'google');
assert('条件-060: 括号未闭合', r.errors && r.errors.some((e) => e.startsWith('syntax')));
r = condExpr('title *= "a")', 'google');
assert('条件-061: 多余右括号', r.errors && r.errors.some((e) => e.startsWith('syntax')));
r = condExpr('& title *= "a"', 'google');
assert('条件-062: &开头', r.errors && r.errors.some((e) => e.startsWith('syntax')));
r = condExpr('', 'google');
assert('条件-064: 空串', r.errors);
r = condExpr('title =~ /x/g', 'google');
assert('条件-066: flags含g', r.errors && r.errors[0].startsWith('flags:g'));
r = condExpr('title =~ /(/)', 'google');
assert('条件-067: 正则无效', r.errors && r.errors[0].startsWith('regex'));
r = condExpr('title =~ /a\\', 'google');
assert('条件-068: 正则未闭合(tail转义)', r.errors);

r = condExpr('title//', 'google');
assert('条件-069: 空正则简写报错(不再恒匹配)', r.errors && r.errors.some((e) => e.startsWith('unknown')));
r = condExpr('title/ /', 'google');
assert('条件-071: 空白pattern正则同样报错', r.errors && r.errors.some((e) => e.startsWith('unknown')));

r = condExpr('host =~ /ABC/', 'google');
assert('条件-073: host正则无i大小写敏感(不再强制加i)', !r.errors && ev(r, 't', 'https://abc.com/') === false);
r = condExpr('host =~ /ABC/i', 'google');
assert('条件-074: host正则加i忽略大小写', !r.errors && ev(r, 't', 'https://abc.com/') === true);
r = condExpr('scheme = "HTTPS"', 'google');
assert('条件-075: scheme字符串比较仍忽略大小写', !r.errors && ev(r, 't', 'https://x.com/') === true);


// 引擎别名 ddg($site 值归一)
r = condExpr('$site = "DDG"', 'duckduckgo');
assert('条件-077: DDG别名(大写)', r.const === true);

// ---- url 表达式系列(@if 内)----
r = condExpr('url = "https://ex.com/"', 'google');
assert('条件-078: url精确', !r.errors && ev(r, 't', 'https://ex.com/') === true && ev(r, 't', 'https://ex.com/x') === false);

r = condExpr('url ^= "https://ex"', 'google');
assert('条件-080: url前缀', ev(r, 't', 'https://example.com/') === true && ev(r, 't', 'http://ex.com/') === false);

r = condExpr('url $= ".pdf"', 'google');
assert('条件-081: url后缀', ev(r, 't', 'https://x.com/a.pdf') === true && ev(r, 't', 'https://x.com/a.txt') === false);

r = condExpr('url =~ /\\.(pdf|doc)$/', 'google');
assert('条件-082: url正则(=~)', !r.errors && ev(r, 't', 'https://x.com/a.pdf') === true && ev(r, 't', 'https://x.com/a.doc') === true && ev(r, 't', 'https://x.com/a.txt') === false);
assert('条件-083: url正则默认大小写敏感', ev(r, 't', 'https://x.com/a.PDF') === false);
r = condExpr('url =~ /\\.pdf$/i', 'google');
assert('条件-084: 加i忽略大小写', ev(r, 't', 'https://x.com/a.PDF') === true);

r = condExpr('title=~/广告|推广/', 'google');
assert('条件-085: 紧凑=~/无空格识别为正则(旧代码静默变字面比较)', !r.errors && ev(r, '广告页', 'https://x/') === true && ev(r, '正常页', 'https://x/') === false);
r = condExpr('url=~/ads/', 'google');
r = condExpr('url*=~/ads/', 'google');
assert('条件-088: 运算符后接=~为显式报错(旧代码静默字面比较)', !!r.errors);
r = condExpr('title=~/未闭合', 'google');
assert('条件-089: 未闭合紧凑正则报错而非字面比较', !!r.errors);
r = condExpr('title *= "~波浪线"', 'google');
assert('条件-090: 引号内~开头的字面值不受影响', !r.errors && ev(r, '~波浪线', 'https://x/') === true);

r = condExpr('url/example\\.(com|net)/', 'google');
assert('条件-091: url简写(正则内括号与|整吞)', !r.errors && ev(r, 't', 'https://example.com/') === true && ev(r, 't', 'https://example.net/') === true && ev(r, 't', 'https://other.net/') === false);

r = condExpr('url/example\\.net/i', 'google');
assert('条件-093: url简写带flags', !r.errors && ev(r, 't', 'https://EXAMPLE.NET/') === true);

r = condExpr('title *= "a/b"', 'google');
assert('条件-095: 引号内斜杠不受正则判定影响', !r.errors && ev(r, 'a/b title', 'https://x/') === true);

r = condExpr('url/example\\.com/ | title *= "kw"', 'google');
assert('条件-096: url简写与或组合', ev(r, 'plain', 'https://example.com/') === true && ev(r, 'has kw', 'https://other.com/') === true && ev(r, 'none', 'https://other.com/') === false);

r = condExpr('url ^= "https://mp.weixin.qq.com" & !(title *= "ad")', 'google');
assert('条件-097: url前缀&取反组合', ev(r, 'normal', 'https://mp.weixin.qq.com/s/x') === true && ev(r, 'ads here', 'https://mp.weixin.qq.com/s/x') === false);

r = condExpr('!(url $= ".pdf")', 'google');
assert('条件-098: !取反url条件', !r.errors && ev(r, 't', 'https://x.com/a.html') === true && ev(r, 't', 'https://x.com/a.pdf') === false);

r = condExpr('url ^= "https://ex.com"', 'google');
assert('条件-099: url缺失->条件假', ev(r, 't', undefined) === false);
r = condExpr('!(url ^= "https://ex.com")', 'google');
assert('条件-100: 取反后url缺失->真', ev(r, 't', undefined) === true);

r = condExpr('url =~ /x/g', 'google');
assert('条件-101: url正则非法flags(g)', r.errors && r.errors[0].startsWith('flags:g'));
r = condExpr('url =~ /[/]/', 'google');
assert('条件-103: url正则字符类内裸斜杠合法', !r.errors && ev(r, 't', 'https://example.com/a/b') === true);
r = condExpr('url ^= "https://ex" & url $= "/s/"', 'google');

// ---- $site 变量 (条件-108~111 与 001/002/077 同路径, 合并删除) ----
r = condExpr('$site : "yandex"', 'yandex');
assert('条件-112: $site冒号形式', r.const === true);
r = condExpr('$site = "google" & title *= "x"', 'google');
assert('条件-113: $site与动态组合(google)', !r.const && ev(r, 'xx', 'https://x/') === true && ev(r, 'yy', 'https://x/') === false);
r = condExpr('$site = "google" | $site = "bing"', 'google');
assert('条件-115: $site多引擎或(google)', r.const === true);
r = condExpr('$site = "google" | $site = "bing"', 'yandex');
assert('条件-117: 多引擎或(yandex恒假)', r.const === false);
r = condExpr('$site = "foo"', 'google');
assert('条件-118: 未知站点值->静态假(不报错)', r.const === false && !r.errors);
r = condExpr('$site = google', 'google');
assert('条件-119: 值未加引号正常识别为合法值', r.const === true);
r = condExpr('$site = "yahoo-japan"', 'yahoo');
assert('条件-122: $site yahoo-japan别名命中', r.const === true);
r = condExpr('$site = "yahoo"', 'yahoo');
assert('条件-124: $site yahoo原值仍可用', r.const === true);
r = condExpr('$site = "ddg"', 'ddg');
assert('条件-125: $site ddg 同名自定义引擎可命中', r.const === true);
r = condExpr('$site = "mysearx"', 'MySearx');
assert('条件-127: $site 自定义引擎ID忽略大小写(规则小写)', r.const === true);

// ---- 行尾 # 注释剥离 ----
assert('条件-129: URL规则行尾注释', m.stripRuleComment('*://x.com/* # 注释') === '*://x.com/*');
assert('条件-130: 整行注释', m.stripRuleComment('# 注释') === '');
assert('条件-132: 正则内#保留', m.stripRuleComment('/a#b/') === '/a#b/');
assert('条件-133: 正则行尾注释', m.stripRuleComment('/a#b/ # note') === '/a#b/');
assert('条件-136: 引号内#与行尾注释', m.stripRuleComment('*://x.com/* @if(title *= "a # b") # note') === '*://x.com/* @if(title *= "a # b")');
assert('条件-137: @if正则内括号配平', m.stripRuleComment('*://x.com/* @if(title =~ /a)b/) # x') === '*://x.com/* @if(title =~ /a)b/)');
assert('条件-139: 白名单注释', m.stripRuleComment('@*://x.com/* # 放行') === '@*://x.com/*');
assert('条件-141: URL内非空白#保留', m.stripRuleComment('*://x.com/a#b') === '*://x.com/a#b');
assert('条件-142: 无注释原样', m.stripRuleComment('*://x.com/* @if(Google)') === '*://x.com/* @if(Google)');
assert('条件-143: @if后带空格', m.stripRuleComment('*://x.com/* @if (title *= "a") # c') === '*://x.com/* @if (title *= "a")');
assert('条件-144: 嵌套@if括号', m.stripRuleComment('*://x.com/* @if((title *= "a" | title *= "b") & !(url *= "c")) # x') === '*://x.com/* @if((title *= "a" | title *= "b") & !(url *= "c"))');
assert('条件-145: 引号内转义引号', m.stripRuleComment('*://x.com/* @if(title *= "a\\"b # c") # x') === '*://x.com/* @if(title *= "a\\"b # c")');
assert('条件-148: 行首@if内部#不截断', m.stripRuleComment('@if(title *= "a # b")') === '@if(title *= "a # b")');
assert('条件-149: 行首@if行尾注释', m.stripRuleComment('@if(title *= "a") # note') === '@if(title *= "a")');
assert('条件-150: 行首@if正则含#不截断', m.stripRuleComment('@if(url =~ /foo # bar/) *://x/*') === '@if(url =~ /foo # bar/) *://x/*');

// ---- host / path / scheme 变量 ----
r = condExpr('host $= ".example.com"', 'google');
assert('条件-151: host后缀-子域', !r.errors && ev(r, 't', 'https://www.example.com/') === true);
assert('条件-152: host后缀-裸域兼容', ev(r, 't', 'https://example.com/') === true);
assert('条件-153: host后缀-负例', ev(r, 't', 'https://example.net/') === false && ev(r, 't', 'https://badexample.com/') === false);

r = condExpr('host $= "example.com"', 'google');
assert('条件-154: host后缀无点前缀', ev(r, 't', 'https://www.example.com/') === true && ev(r, 't', 'https://example.com/') === true);

r = condExpr('host = "www.example.com"', 'google');
assert('条件-155: host精确', ev(r, 't', 'https://www.example.com/x') === true && ev(r, 't', 'https://example.com/') === false);

r = condExpr('host ^= "www"', 'google');
assert('条件-156: host前缀', ev(r, 't', 'https://www.example.com/') === true && ev(r, 't', 'https://api.example.com/') === false);

r = condExpr('host *= "example"', 'google');
assert('条件-157: host包含', ev(r, 't', 'https://www.example.com/') === true);

r = condExpr('host =~ /(^|\\.)example\\.com$/i', 'google');
assert('条件-158: host正则', !r.errors && ev(r, 't', 'https://example.com/') === true && ev(r, 't', 'https://badexample.com/') === false);

r = condExpr('host $= ".example.com"', 'google');
assert('条件-160: 忽略大小写', ev(r, 't', 'https://WWW.EXAMPLE.COM/') === true);

r = condExpr('host $= ".例子.com"', 'google');
assert('条件-161: 中文域名后缀匹配 punycode URL', !r.errors && ev(r, 't', 'https://xn--fsqu00a.com/') === true);
assert('条件-162: 中文域名后缀匹配 Unicode URL', ev(r, 't', 'https://例子.com/') === true);
assert('条件-163: 中文域名不误伤其他站', ev(r, 't', 'https://example.com/') === false);

r = condExpr('path *= "/download/"', 'google');
assert('条件-164: path包含', !r.errors && ev(r, 't', 'https://x.com/download/setup.exe') === true && ev(r, 't', 'https://x.com/dl/x') === false);

r = condExpr('path $= ".pdf"', 'google');
assert('条件-165: path后缀', ev(r, 't', 'https://x.com/a/file.pdf') === true);

r = condExpr('path/download/', 'google');
assert('条件-169: path简写', !r.errors && ev(r, 't', 'https://x.com/download/setup') === true);

r = condExpr('path *= "/a%20b/"', 'google');
assert('条件-171: path含编码空格值(原样比较)', !r.errors && ev(r, 't', 'https://x.com/a%20b/c') === true && ev(r, 't', 'https://x.com/ab/c') === false);

r = condExpr('scheme = "https"', 'google');
assert('条件-172: scheme精确', !r.errors && ev(r, 't', 'https://x.com/') === true && ev(r, 't', 'http://x.com/') === false);

r = condExpr('host $= ".example.com" & path *= "/download/" & scheme = "https"', 'google');
assert('条件-175: host&path&scheme组合', ev(r, 't', 'https://dl.example.com/download/x') === true && ev(r, 't', 'http://dl.example.com/download/x') === false);

r = condExpr('path $= ".pdf"', 'google');
assert('条件-179: 非法url->假', ev(r, 't', 'not a url') === false);
r = condExpr('title =~ /x/I', 'google');
assert('条件-181: 大写I当作i不报错', !r.errors && ev(r, 'X', 'https://x/') === true && ev(r, 'y', 'https://x/') === false);

// ---- P0-3: flags u / P1-3: 订阅 frontmatter ----
r = condExpr('title =~ /\\u{4E2D}/u', 'google');
assert('条件-184: title =~ 支持u flag', !r.errors && ev(r, '中文字', 'https://x/') === true);
r = condExpr('title =~ /x/u', 'google');
assert('条件-186: flags预检不再拒u', !r.errors);

const stripEmpty = (ls) => ls.map(l => l.trim()).filter(l => l);
const pc1 = m.parseRulesetContent('---\nname: My Rules\n---\n*://*.example.com/*\n');
assert('条件-187: 标准frontmatter剥离', pc1.meta.name === 'My Rules' && stripEmpty(pc1.lines).length === 1 && stripEmpty(pc1.lines)[0] === '*://*.example.com/*');
// 注: 条件-188/189 (引号name/头内注释行变形) 与本条同路径, 合并删除
const pc4 = m.parseRulesetContent('*://a.com/*\n---\nname: x\n---\n');
assert('条件-190: 非frontmatter开头(原样)', pc4.meta.name === undefined && stripEmpty(pc4.lines).length === 4);
const pc5 = m.parseRulesetContent('---\nname: Unclosed\n*://a.com/*\n');
assert('条件-191: frontmatter未闭合(原样处理)', pc5.meta.name === undefined && stripEmpty(pc5.lines).length === 3);
const pc6 = m.parseRulesetContent('---\n---\n*://a.com/*\n');
assert('条件-192: 空frontmatter', pc6.meta.name === undefined && stripEmpty(pc6.lines).length === 1);
const pc7 = m.parseRulesetContent('---\nother: value\nname: Multi List\nversion: 2\n---\n*://a.com/*\n');
assert('条件-193: name位于多键中间', pc7.meta.name === 'Multi List' && stripEmpty(pc7.lines).length === 1);
const pc8 = m.parseRulesetContent('name: UB List\nrules:\n  - example.com\n  - \'*://*.example.com/*\'\n  - title/.*ad.*/i\n');
assert('条件-194: YAML rules列表提取', pc8.meta.name === 'UB List' && pc8.lines.length === 3 && pc8.lines[0] === 'example.com' && pc8.lines[1] === '*://*.example.com/*' && pc8.lines[2] === 'title/.*ad.*/i');
const pc9 = m.parseRulesetContent('rules:\n  - /a/i # trailing\n  # full comment\n  - example.com\n');
assert('条件-195(已修复): YAML块序列项的行尾注释剥离', pc9.lines.length === 2 && pc9.lines[0] === '/a/i' && pc9.lines[1] === 'example.com', pc9.lines);
const pc9b = m.parseRulesetContent('rules:\n  - "a # b"\n  - c.com\n');
assert('条件-195b: 块序列项引号内的#是内容不被剥', JSON.stringify(pc9b.lines) === JSON.stringify(['a # b', 'c.com']), pc9b.lines);
const pc9c = m.parseRulesetContent('whitelist:\n  - keep.com # allow\n');
assert('条件-195c: 白名单块序列项剥注释后再加@', JSON.stringify(pc9c.lines) === JSON.stringify(['@keep.com']), pc9c.lines);
const pc9d = m.parseRulesetContent("rules:\n  - 'x # y' # note\n");
assert('条件-195d: 单引号项注释剥离且引号内#保留', JSON.stringify(pc9d.lines) === JSON.stringify(['x # y']), pc9d.lines);
const pc10 = m.parseRulesetContent('blacklist:\n  - *.example.com\nsubscriptions:\n  - url: https://x\n    enabled: true\n');
assert('条件-196: blacklist键+后续段截断', pc10.lines.length === 1 && pc10.lines[0] === '*.example.com');
const pc11 = m.parseRulesetContent('*://a.com/*\nrules:\n');
assert('条件-197: 无列表项不启用YAML模式', stripEmpty(pc11.lines).length === 2);
const pc13 = m.parseRulesetContent('name: WL\nblacklist:\n  - ads.example.com\nwhitelist:\n  - good.example.com\n  - "@*://keep.example.com/*"\n');
assert('条件-199: whitelist段导入并自动加@', pc13.meta.name === 'WL' && pc13.lines.length === 3 && pc13.lines[0] === 'ads.example.com' && pc13.lines[1] === '@good.example.com' && pc13.lines[2] === '@*://keep.example.com/*');
const pc14 = m.parseRulesetContent('blacklist:\n  - a.com\nrules:\n  - b.com\n');
assert('条件-200: 连续两个list键均提取', pc14.lines.length === 2 && pc14.lines[0] === 'a.com' && pc14.lines[1] === 'b.com');
const pc15 = m.parseRulesetContent('---\nname: Block Sample\nhomepage: https://x\n---\ntitle: A\nurl: https://www.a.com/\nmatches:\n  - *://*.a.com/*\n\ntitle: B\nmatches:\n  - /re\\.com/\n');
assert('条件-201(修复1/2回归): uBlacklist matches段与rules段同等导入', pc15.meta.name === 'Block Sample' && pc15.lines.length === 2 && pc15.lines[0] === '*://*.a.com/*' && pc15.lines[1] === '/re\\.com/');
const pcCrlf = m.parseRulesetContent('name: X\r\nrules: [\r\n  a.com,\r\n  b.com\r\n]\r\n');
assert('条件-201b(修复Y): CRLF多行flow正常解析', pcCrlf.meta.name === 'X' && pcCrlf.lines.length === 2 && pcCrlf.lines[0] === 'a.com' && pcCrlf.lines[1] === 'b.com');
const pcCrlf2 = m.parseRulesetContent('rules: [a.com, b.com] # c\r\n');
assert('条件-201c(修复Y): CRLF单行flow带尾注释', pcCrlf2.lines.length === 2 && pcCrlf2.lines[0] === 'a.com' && pcCrlf2.lines[1] === 'b.com');
// 注: 条件-198(引号列表项变形)/202(matches段无frontmatter变形) 与 条件-194/201 同路径, 合并删除

r = condExpr('title *= "KW" i', 'google');
assert('条件-203: title包含+i修饰', !r.errors && ev(r, 'contains kw', 'https://x/') === true && ev(r, 'nothing', 'https://x/') === false);
// 注: i修饰的按键变形矩阵(条件-203b/204/204b/205b/205c/206b/206c/209/209b)与 203/205/206 同路径, 合并删除
r = condExpr('host $= ".example.com" i', 'google');
assert('条件-205: host后缀+i', !r.errors && ev(r, 't', 'https://www.EXAMPLE.COM/') === true);
r = condExpr('$site = "GOOGLE" i', 'google');
assert('条件-206: $site+i', r.const === true);
r = condExpr('title *= "a"i', 'google');
assert('条件-207: 紧贴无空格i', !r.errors && ev(r, 'xa', 'https://x/') === true);
r = condExpr('title *= "a" ix', 'google');
assert('条件-208: i后多余字符->unknown', r.errors && r.errors[0].startsWith('unknown'));
r = condExpr('url *= "example"', 'google');
assert('条件-210: 无i修饰回归(默认忽略大小写)', !r.errors && ev(r, 't', 'https://EXAMPLE.com/') === true);

// ---- $category 静态折叠 (注: 按键变形矩阵 条件-213/215~223 与 $site 系列同路径, 合并删除) ----
r = condExpr('$category = "web"', 'google', 'www.google.com', 'web');
assert('条件-211: web页命中', r.const === true);
r = condExpr('$category = "images"', 'google', 'www.google.com', 'web');
assert('条件-212: web页images条件恒假', r.const === false);
r = condExpr('$category : "videos"', 'google', 'www.google.com', 'videos');
assert('条件-214: 冒号形式', r.const === true);
r = condExpr('$site = "google" & $category = "images"', 'google', 'www.google.com', 'web');
assert('条件-224: $site命中但category不命中', r.const === false);

// ---- 条件表达式识别(行级判定) ----
const condTrueCases = [
  'host $= ".example.com"',
  'path *= "/download/"',
  'title *= "关键词"',
  'title ^= "关键词"',
  'url =~ /example\\.(com|net)/',
  'host/\\.example\\.com$/i',
  'scheme = "https"',
  '$site = "google"',
  '$category = "images"',
  'site = "google.com.hk"',
  '!scheme = "https"',
  '(host $= "a" | title *= "b")',
  'host $= ".example.com" & path *= "/download/"',
  'title *= "example" i | title *= "domain" i',
  'host = example.com',
  'title *= 关键词',
  'title*=关键词',
];
condTrueCases.forEach((rule, i) => {
  assert(`条件-225-${i + 1}: 条件表达式识别 ${rule}`, m.looksLikeCondExpr(rule) === true);
});

const condFalseCases = [
  'https://example.com/?url=x',
  'https://example.com/?a=1&title=x',
  'https://example.com/?url="x"',
  '*://*.example.com/*',
  '/example\\.com/',
  'title/foo/i',
  'text/ad/',
  'example.com',
  'https://example.com/',
];
condFalseCases.forEach((rule, i) => {
  assert(`条件-226-${i + 1}: 非条件表达式 ${rule}`, m.looksLikeCondExpr(rule) === false);
});
})();

// ---- 条件-227~268: @if条件提取与URL路径冲突 ----
await (async () => {
const fns = [
  'hostLabelToASCII', 'toASCIIHostname', 'toASCIIUrl', 'safeRegexTest', 'safeDecodeURIComponent', 'stripRuleComment', 'getInvalidRegexFlags', 'parseConditionPart',
  'tokenizeCondExpr', 'parseCondExprTokens', 'analyzeCondExpr', 'foldCondExpr',
  'evalDynamicLeaf', 'evalCondAST', 'extractBalancedParens', 'findIfOccurrences',
  'stripIfConditions', 'isCondExprCore', 'looksLikeCondExpr', 'absorbStandaloneExpr',
  'parseRuleWithConditions', 'extractIfConditions', 'validateCondition', 'analyzeRule', 'validateRule',
  'validateUrlWildcard', 'ruleToRegex', 'parsePrefixedRegexRule', 'escapeWildcardPart',
  'wildcardToRegex', 'evaluateCondition',
].map((n) => extractFn(src, n));

const consts = src.match(/const SUPPORTED_REGEX_FLAGS = 'imsu';/)[0];
const langMatch = src.match(/const LANG_TEXTS = \{[\s\S]*?\n  \};/)[0];

const moduleBody = `
${consts}
${langMatch}
const window = { location: { hostname: 'www.google.com', pathname: '/search', search: '?q=x', href: 'https://www.google.com/search?q=x' } };
function getSearchEngine() { return 'google'; }
function getSearchCategory() { return 'web'; }
function t(key, params = {}) {
  const texts = LANG_TEXTS['zh-CN'] || {};
  let text = texts[key] || key;
  for (const [k, v] of Object.entries(params)) text = text.replaceAll('{' + k + '}', v);
  return text;
}
${fns.join('\n')}
return { findIfOccurrences, extractIfConditions, stripIfConditions, extractBalancedParens, validateRule, stripRuleComment, analyzeRule };
`;
const api = new Function(moduleBody)();

const zzb2 = String.fromCharCode(92);
assert('条件-430(修复SC): @if组后title/正则体首字符为转义斜杠不再错位截断', api.validateRule('@if(site=x.com) title/' + zzb2 + '/foo #bar/') === true);
assert('条件-431(修复SC): 前缀正则体内#注释不剥离(对齐解析器最后斜杠语义)', api.stripRuleComment('title/a/b # c/') === 'title/a/b # c/');
assert('条件-432(修复SC对照): 前缀正则行尾注释仍剥离', api.stripRuleComment('title/abc/ # 注释') === 'title/abc/');
assert('条件-433(修复SC对照): 带flags前缀正则行尾注释仍剥离', api.stripRuleComment('title/abc/i # note') === 'title/abc/i');
assert('条件-434(修复SC对照): 注释含斜杠仍剥离', api.stripRuleComment('title/abc/ # 注释 /x/') === 'title/abc/' && api.stripRuleComment('title/abc/ # https://x.com/a') === 'title/abc/');
assert('条件-435(修复SC): @if组后体内#前缀正则保留', api.stripRuleComment('@if(x) title/a/b # c/') === '@if(x) title/a/b # c/' && api.validateRule('title/a/b # c/') === true);
assert('条件-436(对照): @if简写正则3字符flags(gim)识别为合法条件', api.validateRule('@if(title/abc/gim)') === true && api.validateRule('@if(title/abc/im)') === true);

// ---- 审查A2: @N 与规则之间可省略空格 ----
const a2eq = (a, b) => JSON.stringify(api.analyzeRule(a)) === JSON.stringify(api.analyzeRule(b));
assert('审查A2-0(对照): @N带空格条件表达式本身合法', api.analyzeRule('@1 path $= ".pdf"').valid === true);
assert('审查A2-1: @N后无空格的条件/正则/URL写法与带空格同构', a2eq('@1path $= ".pdf"', '@1 path $= ".pdf"') && a2eq('@1host $= ".example.com"', '@1 host $= ".example.com"') && a2eq('@1/abc/i', '@1 /abc/i') && a2eq('@1https://x.com/*', '@1 https://x.com/*'));
const a2parts = src.split(String.fromCharCode(10)).filter((l) => l.indexOf('.match(/^@(') !== -1).map((l) => l.slice(l.indexOf('/^@('), l.lastIndexOf('/)') + 1));
assert('审查A2-2: analyzeRule 与 buildRuleIndex 的 @N 前瞻字面一致', a2parts.length === 2 && a2parts[0] === a2parts[1], a2parts);
const a2re = new RegExp(a2parts[0].slice(1, -1));
assert('审查A2-3(对照): 裸域名无空格仍不进高亮前瞻', a2re.test('@1path $= ".pdf"') && a2re.test('@1/abc/i') && !a2re.test('@1example.com') && !a2re.test('@2fast.com') && !a2re.test('@1path.com'));


// ---- @if 括号提取 ----
const src1 = '@if(title *= "a)b")';
const p1 = api.extractBalancedParens(src1, 3);
assert('条件-227: 双引号内右括号不截断', !!p1 && p1.content === 'title *= "a)b"');

const p3 = api.extractBalancedParens("@if(title *= 'a)b')", 3);
assert('条件-229: 单引号内右括号不截断', !!p3 && p3.content === "title *= 'a)b'");

const c4 = api.extractIfConditions('*://x/* @if(title =~ /\\(a/)');
assert('条件-230: 转义左括号条件完整', c4.length === 1 && c4[0] === 'title =~ /\\(a/');

const c5 = api.extractIfConditions('*://x/* @if(title =~ /a\\)b/)');
assert('条件-231: 转义右括号不提前闭合', c5.length === 1 && c5[0] === 'title =~ /a\\)b/');

const c6 = api.extractIfConditions('*://x/* @if(title =~ /[(]a[)]/)');
assert('条件-232: 正则字符类内括号忽略', c6.length === 1 && c6[0] === 'title =~ /[(]a[)]/');

const c7 = api.extractIfConditions('*://x/* @if((title *= "a") | (title *= "b)"))');
assert('条件-233: 引号与分组混合', c7.length === 1 && c7[0] === '(title *= "a") | (title *= "b)")');

assert('条件-235: 真正不闭合返回 null', api.extractBalancedParens('@if((title *= "a")', 3) === null);

const s1 = api.stripIfConditions('*://x/* @if(title *= "a)b")');
assert('条件-236: 剥离后核心规则与条件通过', s1.coreRule === '*://x/*' && s1.staticPass === true);

const s3 = api.stripIfConditions('*://x/* @if(title *= "a)b") @if(url *= "x")');
assert('条件-238: 多个 @if 均正确剥离', s3.coreRule === '*://x/*');

// ---- 引号/正则体内 @if 扫描 ----
let s = api.stripIfConditions('*://x.com/* @if(title *= "@if(y)")');
assert('条件-239: 引号内 @if 不产生伪剥离', s.coreRule === '*://x.com/*' && s.staticPass === true);
let c = api.extractIfConditions('*://x.com/* @if(title *= "@if(y)")');
assert('条件-240: 引号内 @if 不产生伪条件', c.length === 1 && c[0] === 'title *= "@if(y)"');

s = api.stripIfConditions('title/foo@if(bar)/');
assert('条件-242: title 正则体内 @if 不被剥离', s.coreRule === 'title/foo@if(bar)/');

s = api.stripIfConditions('*://example.com/api/@if(test)/*');
assert('条件-244: URL路径内 @if( 不被误判剥离', s.coreRule === '*://example.com/api/@if(test)/*');

s = api.stripIfConditions('*://x.com/* @if(title =~ /a@if(b)/)');
assert('条件-246: 条件正则体内 @if 不产生伪剥离', s.coreRule === '*://x.com/*');
c = api.extractIfConditions('*://x.com/* @if(title *= "@if(y)") @if($site="google")');
assert('条件-249: 混合多条件数量正确', c.length === 2 && c[0] === 'title *= "@if(y)"' && c[1] === '$site="google"');

s = api.stripIfConditions('title/.*示例.*/ @if($site = "google")');
assert('条件-250: 前导正则后的 @if 正常剥离', s.coreRule === 'title/.*示例.*/' && s.staticPass === true);

s = api.stripIfConditions('*://x.com/?q=~/foo @if(title *= "x")');
assert('条件-252: URL查询含=~/不误判正则', s.coreRule === '*://x.com/?q=~/foo' && s.staticPass === true);
s = api.stripIfConditions('example.com/?q=~/foo @if(title *= "x")');
assert('条件-253: 无协议URL含=~/仍识别@if', s.coreRule === 'example.com/?q=~/foo' && s.staticPass === true);

assert('条件-255: 未闭合条件仍报错', api.validateRule('*://x.com/* @if((title *= "a")') === false);

// ---- URL 路径含关键字段不误吞 @if(回归) ----
const pathConflictCases = [
  '*://x.com/title/y @if(title *= "a")',
  '*://x.com/a/title/b/url/c @if(url *= "q")',
];
pathConflictCases.forEach((rule, i) => {
  const occ = api.findIfOccurrences(rule);
  assert(`条件-257-${i + 1}: @if检测 ${rule}`, occ.length === 1);
  const stripped = api.stripIfConditions(rule);
  const expectedCore = rule.replace(/ @if\(.*\)$/, '');
  assert(`条件-258-${i + 1}: 剥离后保留核心 ${rule}`, stripped.coreRule === expectedCore && stripped.staticPass === true);
});

s = api.stripIfConditions('*://x.com/url/* @if(title *= "a") @if($site = "google")');
assert('条件-260: 多@if与路径冲突同时剥离', s.coreRule === '*://x.com/url/*' && s.staticPass === true);

const noOccCases = [
  'url/foo@if(bar)/',
  '@1 title/foo@if(bar)/i',
];
noOccCases.forEach((rule, i) => {
  assert(`条件-261-${i + 1}: 行首简写正则体内 @if 不产生伪条件 ${rule}`, api.findIfOccurrences(rule).length === 0);
});

s = api.stripIfConditions('scheme/https?\\/\\// @if(title *= "x")');
assert('条件-262: 行首 scheme 简写正则后的 @if 正常剥离', s.coreRule === 'scheme/https?\\/\\//' && s.staticPass === true);

s = api.stripIfConditions('*://x/* @if(url/foo@if(bar)/)');
assert('条件-264: 条件内 url 简写正则含 @if 文本正常', s.coreRule === '*://x/*' && s.staticPass === true);
c = api.extractIfConditions('*://x/* @if(url/foo@if(bar)/)');
assert('条件-265: 条件完整提取', c.length === 1 && c[0] === 'url/foo@if(bar)/');
})();

// ---- 条件-269~383: 独立表达式 ----
await (async () => {
function extractNamed(text, marker) {
  const idx = text.indexOf(marker);
  if (idx === -1) throw new Error('not found: ' + marker);
  const open = text.indexOf('{', idx);
  let depth = 0;
  let end = open;
  for (let i = open; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') {
      depth--;
      if (depth === 0) { end = i + 1; break; }
    }
  }
  return text.slice(idx, end);
}

const fns = [
  'hostLabelToASCII',
  'toASCIIHostname',
  'toASCIIUrl',
  'safeRegexTest',
  'safeDecodeURIComponent',
  'stripRuleComment',
  'getInvalidRegexFlags',
  'parseConditionPart',
  'tokenizeCondExpr',
  'parseCondExprTokens',
  'analyzeCondExpr',
  'foldCondExpr',
  'evalDynamicLeaf',
  'evalCondAST',
  'extractBalancedParens',
  'findIfOccurrences',
  'stripIfConditions',
  'evaluateCondition',
  'isCondExprCore',
  'looksLikeCondExpr',
  'absorbStandaloneExpr',
  'parseRuleWithConditions',
  'extractIfConditions',
  'validateCondition',
  'analyzeRule',
  'validateUrlWildcard',
  'ruleToRegex',
  'parsePrefixedRegexRule',
  'escapeWildcardPart',
  'wildcardToRegex',
  'checkDynamicConditions',
  'matchDomainEntryType',
  'isLocalEntry',
].map((n) => extractFn(src, n));

const checkFn = extractNamed(src, 'function checkRuleMatchOptimized(');
const consts = src.match(/const SUPPORTED_REGEX_FLAGS = 'imsu';/)[0];
const langMatch = src.match(/const LANG_TEXTS = \{[\s\S]*?\n  \};/)[0];

const moduleBody = `
${consts}
${langMatch}
let compiledRules;
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
${fns.join('\n')}
${checkFn}
return {
  safeRegexTest, stripRuleComment, parseRuleWithConditions, analyzeRule, looksLikeCondExpr,
  isCondExprCore, evalCondAST, checkDynamicConditions, checkRuleMatchOptimized, t,
  setEngine: (e, s, c) => { currentEngine = e; if (s) currentSite = s; if (c) currentCategory = c; },
  setCR: (cr) => { compiledRules = cr; },
};
`;

const m = new Function(moduleBody)();

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


m.setEngine('google', 'www.google.com');

// ---- 识别 (注: 条件-269~271/273~278 与第1节 条件-225/226 完全同输入, 合并删除; 保留本节独有的 272/279/280) ----
assert('条件-272: 取反像表达式', m.looksLikeCondExpr('!title *= "ad"') === true);
assert('条件-279: 取反冒号条件', m.looksLikeCondExpr('!title:foo') === true && m.looksLikeCondExpr('!url:https://x') === true);
assert('条件-280: Adblock元数据仍被排除', m.looksLikeCondExpr('! Title: Some List') === false && m.looksLikeCondExpr('! URL: https://x') === false);

// ---- 解析 ----
let p = m.parseRuleWithConditions('host $= ".example.com"');
assert('条件-281: 独立host无core', p.coreRule === '' && p.staticPass === true && p.dynamicConditions.length === 1);
assert('条件-282: host裸域命中', m.evalCondAST(p.dynamicConditions[0], 't', 'https://example.com/') === true);

p = m.parseRuleWithConditions('path *= "/download/"');
assert('条件-283: 独立path', p.coreRule === '' && p.staticPass && p.dynamicConditions.length === 1);

p = m.parseRuleWithConditions('host $= ".example.com" & path *= "/download/"');
assert('条件-285: 组合表达式', p.coreRule === '' && p.staticPass && p.dynamicConditions.length === 1);

p = m.parseRuleWithConditions('@host $= ".example.com"');
assert('条件-287: 白名单独立表达式', p.coreRule === '@' && p.staticPass && p.dynamicConditions.length === 1);

p = m.parseRuleWithConditions('host $= ".example.com" @if(title *= "kw")');
assert('条件-288: 独立表达式+@if', p.coreRule === '' && p.staticPass && p.dynamicConditions.length === 2);

p = m.parseRuleWithConditions('example.com');
assert('条件-290: 普通域名不吸收', p.coreRule === 'example.com' && p.dynamicConditions.length === 0 && p.staticPass);
// 注: 条件-291/292 (URL通配/title正则不吸收变形) 与本条同路径且已被 条件-226-6/8 覆盖, 合并删除

p = m.parseRuleWithConditions('*://*.example.com/* @if(title *= "kw")');
assert('条件-293: 旧复合规则仍剥离@if', p.coreRule === '*://*.example.com/*' && p.dynamicConditions.length === 1);

p = m.parseRuleWithConditions('@if(host $= ".example.com")');
assert('条件-294: 仅@if行视为表达式', p.coreRule === '' && p.staticPass && p.dynamicConditions.length === 1);

p = m.parseRuleWithConditions('title *= "kw" | url $= ".pdf"');
assert('条件-296: 标题或url后缀', p.coreRule === '' && p.staticPass);

p = m.parseRuleWithConditions('!title *= "ad"');
assert('条件-300: 独立取反', p.coreRule === '' && p.staticPass);

p = m.parseRuleWithConditions('$site = "google"');
assert('条件-302: $site在google折叠恒真', p.coreRule === '' && p.staticPass && p.dynamicConditions.length === 0);

m.setEngine('bing', 'www.bing.com');
p = m.parseRuleWithConditions('$site = "google"');
assert('条件-303: $site在bing静态丢弃', p.staticPass === false);
m.setEngine('google', 'www.google.com');

p = m.parseRuleWithConditions('scheme = "https"');
assert('条件-304: scheme独立', p.coreRule === '' && p.staticPass);

// ---- 校验 ----
assert('条件-307: host独立规则有效', m.analyzeRule('host $= ".example.com"').valid === true);
assert('条件-308: 白名单独立有效', m.analyzeRule('@host $= ".example.com"').valid === true);
assert('条件-310: 域名规则仍有效', m.analyzeRule('example.com').valid === true);
assert('条件-312: 残缺表达式无效', m.analyzeRule('host $= ').valid === false);
assert('条件-315: 仅@if行有效', m.analyzeRule('@if(path *= "/download/")').valid === true);
assert('条件-316: 空@if仍无效', m.analyzeRule('@if()').valid === false);
assert('条件-318: 高亮越界仍无效', m.analyzeRule('@9 host $= ".example.com"').valid === false);
assert('条件-318b(修复H): @1title/ 无空格自检有效', m.analyzeRule('@1title/abc/').valid === true);
assert('条件-318c(修复H): @9text/ 越界仍无效', m.analyzeRule('@9text/abc/').valid === false);
assert('条件-319: 复合旧写法仍有效', m.analyzeRule('*://*.example.com/* @if(title *= "kw")').valid === true);
assert('条件-321: $category独立表达式有效', m.analyzeRule('$category = "images"').valid === true);
assert('条件-323: 高亮+白名单表达式有效', m.analyzeRule('@1 @host $= ".example.com"').valid === true);
assert('条件-324: 高亮+@if仍有效', m.analyzeRule('@1 path $= ".pdf" @if($site = "google")').valid === true);

// ---- @if 检测范围扩大回归(regex/title/text 前缀同样校验) ----
const exValidCases = [
  ['E1', '/example\\.(com|net)/ @if(title *= "kw")'],
  ['E8', '/foo@if(bar)/'],
  ['E10', 'title/a[/@if(b)]c/ @if(title *= "x")'],
  ['E14', '@title/.*kw.*/ @if(title *= "x")'],
  ['E16', 'text/x/ @if(host $= ".example.com")'],
];
exValidCases.forEach(([name, rule]) => {
  const a = m.analyzeRule(rule);
  assert(name + ': 合法规则不误杀(' + rule + ')', a.valid === true, a.errors);
});
const pc1 = m.parseRuleWithConditions('/example\\.(com|net)/ @if(title *= "kw")');
assert('条件-325: 编译保留1个动态条件', pc1.staticPass === true && pc1.dynamicConditions.length === 1);
// 注: 条件-326/327/329/330 与 条件-302/303/325/328 同路径, 合并删除
const pc4 = m.parseRuleWithConditions('/foo@if(bar)/');
assert('条件-328: 正则体内@if不提取', pc4.staticPass === true && pc4.dynamicConditions.length === 0 && pc4.coreRule === '/foo@if(bar)/');
const pcParen = m.parseRuleWithConditions('x.com @if(title =~ /a(b)c/)');
assert('条件-417(修复9验证): 条件值内含括号的合法正则正常提取校验(括号不再污染配对深度)', pcParen.staticPass === true && pcParen.dynamicConditions.length === 1 && pcParen.coreRule === 'x.com');

const exInvalidCases = [
  ['F1', 'title/x/ @if(foo $= "bar")'],
  ['F3', 'title/x/ @if(title =~ /bad(/)'],
  ['F6', '@1 /x/ @if(unknownfield = "v")'],
];
exInvalidCases.forEach(([name, rule]) => {
  const a = m.analyzeRule(rule);
  assert(name + ': 损坏的@if报错(' + rule + ')', a.valid === false && a.errors.length > 0);
  const pr = m.parseRuleWithConditions(rule);
  assert(name + 'b: 编译路径同样丢弃', pr.staticPass === false);
});

// 注: 条件-331/332 ($category @if编译静态丢弃/通过) 与 条件-302/303 同路径, 合并删除

// ---- 匹配引擎 ----
const slEx = ['www.example.com', 'example.com'];
const urlEx = 'https://www.example.com/download/setup.exe';
const urlOther = 'https://other.net/page';
const slOther = ['other.net'];

function addExpr(cr, rule, source) {
  const parsed = m.parseRuleWithConditions(m.stripRuleComment(rule));
  if (!parsed.staticPass) return parsed;
  cr.conditionalRules.push({
    type: 'expr',
    originalRule: rule,
    source: source || '本地规则',
    conditions: parsed.dynamicConditions,
  });
  return parsed;
}

function addWlExpr(cr, rule, source) {
  const parsed = m.parseRuleWithConditions(m.stripRuleComment(rule));
  if (!parsed.staticPass) return parsed;
  cr.whitelistConditionalRules.push({
    type: 'expr',
    conditions: parsed.dynamicConditions,
    source: source || '本地规则',
  });
  return parsed;
}

let cr = makeCR();
addExpr(cr, 'host $= ".example.com"');
assert('条件-333: 独立host屏蔽', isBlocked(doCheck(cr, urlEx, 'www.example.com', 't', null, slEx)));
assert('条件-334: 独立host不误伤', !isBlocked(doCheck(cr, urlOther, 'other.net', 't', null, slOther)));
// 注: 条件-335/336/337/338/342/343 (裸域/path/组合/title/url/scheme 的引擎侧按键变形) 与 条件-333 同一 conditionalRules 机制, 合并删除

cr = makeCR();
{
  const parsed = m.parseRuleWithConditions('@host $= ".example.com"');
  cr.whitelistConditionalRules.push({ type: 'expr', conditions: parsed.dynamicConditions, source: '本地规则' });
  cr.domains.set('example.com', [{ type: 'wildcard', originalRule: 'example.com', source: '本地规则' }]);
}
assert('条件-339: 独立表达式白名单放行', !isBlocked(doCheck(cr, urlEx, 'www.example.com', 't', null, slEx)));

cr = makeCR();
{
  const parsed = m.parseRuleWithConditions('path $= ".pdf"');
  cr.highlightConditionalRules.push({ type: 'expr', conditions: parsed.dynamicConditions, N: 2 });
}
let r = doCheck(cr, 'https://x.com/a.pdf', 'x.com', 't', null, ['x.com']);
assert('条件-340: 独立表达式高亮', r && r.highlight === 2 && !r.blocked);
r = doCheck(cr, 'https://x.com/a.txt', 'x.com', 't', null, ['x.com']);
assert('条件-340b: 非pdf不高亮', !isBlocked(r) && !(r && r.highlight));

cr = makeCR();
addExpr(cr, 'host $= ".example.com"', '订阅规则1');
r = doCheck(cr, urlEx, 'www.example.com', 't', null, slEx);
assert('条件-341: 订阅独立表达式可屏蔽', isBlocked(r) && r.source === '订阅规则1');

cr = makeCR();
{
  const parsed = m.parseRuleWithConditions('@path *= "/safe/"');
  cr.whitelistConditionalRules.push({ type: 'expr', conditions: parsed.dynamicConditions, source: '本地规则' });
  addExpr(cr, 'host $= ".example.com"');
}
assert('条件-344: 路径白名单压过host黑名单', !isBlocked(doCheck(cr, 'https://www.example.com/safe/a', 'www.example.com', 't', null, slEx)));
assert('条件-345: 非安全路径仍屏蔽', isBlocked(doCheck(cr, urlEx, 'www.example.com', 't', null, slEx)));

cr = makeCR();
addExpr(cr, 'host $= ".example.com" @if(title *= "kw")');
assert('条件-346: 独立表达式与@if同时生效', isBlocked(doCheck(cr, urlEx, 'www.example.com', 'has kw', null, slEx)));
assert('条件-347: @if不满足不屏蔽', !isBlocked(doCheck(cr, urlEx, 'www.example.com', 'plain', null, slEx)));

// ---- 白名单 × 独立表达式优先级 ----
cr = makeCR();
addWlExpr(cr, '@host $= ".example.com"');
addExpr(cr, 'host $= ".example.com"');
assert('条件-348: 本地表达式白名单 > 本地表达式黑名单', !isBlocked(doCheck(cr, urlEx, 'www.example.com', 't', null, slEx)));

cr = makeCR();
addExpr(cr, 'host $= ".example.com"');
addWlExpr(cr, '@host $= ".example.com"', '订阅规则1');
r = doCheck(cr, urlEx, 'www.example.com', 't', null, slEx);
assert('条件-349: 本地表达式黑名单 > 订阅表达式白名单', isBlocked(r) && r.source === '本地规则');

cr = makeCR();
cr.whitelistDomains.set('example.com', [{type: 'wildcard', source: '本地规则'}]);
addExpr(cr, 'path *= "/download/"');
assert('条件-350: 本地域名白名单 > 本地表达式黑名单', !isBlocked(doCheck(cr, urlEx, 'www.example.com', 't', null, slEx)));

cr = makeCR();
addExpr(cr, 'host $= ".example.com"');
cr.whitelistDomains.set('example.com', [{type: 'wildcard', source: '订阅规则1'}]);
r = doCheck(cr, urlEx, 'www.example.com', 't', null, slEx);
assert('条件-353: 本地表达式黑名单 > 订阅域名白名单', isBlocked(r) && r.source === '本地规则');

cr = makeCR();
cr.whitelistUrlPatterns.push({regex: /example\.com/, source: '本地规则'});
addExpr(cr, 'path *= "/download/"');
assert('条件-354: 本地URL白名单 > 本地表达式黑名单', !isBlocked(doCheck(cr, urlEx, 'www.example.com', 't', null, slEx)));

cr = makeCR();
addWlExpr(cr, '@host $= ".example.com"');
cr.highlightDomains.set('example.com', [{N: 2, type: 'wildcard'}]);
r = doCheck(cr, urlEx, 'www.example.com', 't', null, slEx);
assert('条件-355: 高亮+本地表达式白名单 → 仅高亮', r && r.highlight === 2 && !r.blocked);

cr = makeCR();
addExpr(cr, 'host $= ".example.com"');
cr.highlightDomains.set('example.com', [{N: 3, type: 'wildcard'}]);
r = doCheck(cr, urlEx, 'www.example.com', 't', null, slEx);
assert('条件-356: 高亮+本地表达式黑名单 → 两者都返回', r && r.highlight === 3 && r.blocked === true);

cr = makeCR();
addWlExpr(cr, '@host $= ".other.com"');
addExpr(cr, 'host $= ".example.com"');
assert('条件-357: 未命中的表达式白名单不放行', isBlocked(doCheck(cr, urlEx, 'www.example.com', 't', null, slEx)));

p = m.parseRuleWithConditions('@if(host $= ".example.com")');
assert('条件-358: 仅@if行是黑名单表达式', p.coreRule === '' && p.standaloneExpr && !p.coreRule.startsWith('@'));
p = m.parseRuleWithConditions('@host $= ".example.com"');
assert('条件-359: @host 是白名单表达式', p.coreRule === '@' && p.standaloneExpr);

cr = makeCR();
addWlExpr(cr, '@title *= "官方"');
addExpr(cr, 'host $= ".example.com"');
assert('条件-360: 标题白名单放行同源host黑名单', !isBlocked(doCheck(cr, urlEx, 'www.example.com', '官方站点', null, slEx)));
assert('条件-361: 标题不匹配则host黑名单仍生效', isBlocked(doCheck(cr, urlEx, 'www.example.com', '普通标题', null, slEx)));
// 注: 条件-362~365 (白名单×黑名单的 订阅×订阅 / 本地×订阅 交叉变形) 与 条件-348/349/353 同优先级路径, 合并删除

// ---- 修复回归: path 正则大小写敏感 + 规则键前缀保留 ----
{
  const pc = m.parseRuleWithConditions('path/search/');
  assert('条件-366: path正则默认大小写敏感(大写URL不命中)', m.evalCondAST(pc.dynamicConditions[0], 't', 'https://x.com/SEARCH') === false);
  assert('条件-367: path正则匹配原文小写', m.evalCondAST(pc.dynamicConditions[0], 't', 'https://x.com/search') === true);
  const pd = m.parseRuleWithConditions('path/案例/');
  assert('条件-368: path正则仍匹配percent解码变体', m.evalCondAST(pd.dynamicConditions[0], 't', 'https://x.com/%E6%A1%88%E4%BE%8B') === true);
  assert('条件-369: 白名单/高亮前缀保留在规则键中', m.stripRuleComment('@example.com') === '@example.com' && m.stripRuleComment('@2 fast.com') === '@2 fast.com' && m.stripRuleComment('example.com') === 'example.com');
}
})();

// ==== 二、修复回归 ====

// ---- @if(...)组后独立正则的上下文恢复 ----
{
  const api = new Function(
    ['stripRuleComment', 'extractBalancedParens', 'findIfOccurrences', 'stripIfConditions'].map((n) => extractFn(src, n)).join('\n') +
    '\nreturn { stripRuleComment, findIfOccurrences, stripIfConditions };'
  )();
  const sr = api.stripRuleComment;
  assert('条件-370: @if组后独立正则内#不再截断', sr('@if(site("x.com")) /ab[ #]cd/') === '@if(site("x.com")) /ab[ #]cd/');
  assert('条件-371: @if组后独立正则+行尾注释正确剥离', sr('@if(title *= "a") /ab[ #]cd/ # note') === '@if(title *= "a") /ab[ #]cd/');
  assert('条件-372: @N + @if组后正则', sr('@1 @if(engine=bing) /ab[ #]cd/ # note') === '@1 @if(engine=bing) /ab[ #]cd/');
  assert('条件-373: @if组后text/前缀正则内#保留', sr('@if(a) text/ab[ #]cd/') === '@if(a) text/ab[ #]cd/');
  assert('条件-375: URL通配符中字面@if(不被当条件组', sr('*://example.com/api/@if(test)/* # c') === '*://example.com/api/@if(test)/*');
  assert('条件-376(对照): @前缀简写规则注释剥离不受影响', sr('@ *://x/* # c') === '@ *://x/*');
  assert('条件-378(对照): @N前缀注释剥离不受影响', sr('@1 *://example.com/* # note') === '@1 *://example.com/*');
  assert('条件-379: 连续@if组后正则上下文恢复', sr('@if(a) @if(b) /ab[ #]cd/ # note') === '@if(a) @if(b) /ab[ #]cd/');
  assert('条件-380: @if组后正则体内@if(...)不被剥离为条件', api.stripIfConditions('@if(engine=google) /x[ @if(y)]z/').coreRule === '/x[ @if(y)]z/');
  assert('条件-381: @if组后正则体内@if(不产生伪条件', api.findIfOccurrences('@if(a) /x@if(b)y/').length === 1);
  assert('条件-382: @if组后text/正则体内@if(不产生伪条件', api.findIfOccurrences('@if(a) text/x[ @if(b)]y/').length === 1);
  assert('条件-416(修复9验证): @if组后紧邻无空格的正则上下文同样恢复', api.findIfOccurrences('@if(a)/x[ @if(b)]y/').length === 1);
}

// ---- 条件-384~391: path/host 单斜杠裸值 / 订阅"!"独立条件识别 ----
{
  const consts2 = src.match(/const SUPPORTED_REGEX_FLAGS = 'imsu';/)[0];
  const env = new Function(
    consts2 + '\n' + ['safeRegexTest', 'safeDecodeURIComponent', 'getInvalidRegexFlags', 'parseConditionPart', 'tokenizeCondExpr', 'parseCondExprTokens', 'analyzeCondExpr', 'foldCondExpr', 'evalDynamicLeaf', 'evalCondAST', 'isCondExprCore', 'looksLikeCondExpr'].map((n) => extractFn(src, n)).join('\n') +
    '\nreturn { analyzeCondExpr, looksLikeCondExpr };'
  )();
  const errs = (s) => env.analyzeCondExpr(s, 'google', 'www.google.com', 'web').errors.length;
  assert('条件-384: path ^= /search 正常解析为字符串比较无语法错误', errs('path ^= /search') === 0);
  assert('条件-387(对照): 裸值恰含第二个斜杠时正常', errs('path *= /download/') === 0);
  assert('条件-388(对照): "! url: x" 被当作uBlock元数据过滤', env.looksLikeCondExpr('! url: a.com') === false);
  assert('条件-390(已修复): "! host: a.com" 元数据行不再误判为条件', env.looksLikeCondExpr('! host: a.com') === false);
  assert('条件-391(对照): 无空格的 "!site: x" 可识别', env.looksLikeCondExpr('!site: a.com') === true);
}

// ---- 条件-392~400: 多斜杠裸值词法完整性 / 裸值内未配对括号 ----
{
  const env2 = new Function(
    src.match(/const SUPPORTED_REGEX_FLAGS = 'imsu';/)[0] + '\n' +
    ['safeRegexTest', 'safeDecodeURIComponent', 'getInvalidRegexFlags', 'parseConditionPart', 'tokenizeCondExpr', 'parseCondExprTokens', 'analyzeCondExpr', 'foldCondExpr', 'evalDynamicLeaf', 'evalCondAST', 'isCondExprCore', 'looksLikeCondExpr', 'extractBalancedParens'].map((n) => extractFn(src, n)).join('\n') +
    '\nreturn { analyzeCondExpr, foldCondExpr, evalCondAST, tokenizeCondExpr, extractBalancedParens };'
  )();
  const cond2 = (s, engine = 'google', site = 'www.google.com', category = 'web') => {
    const { ast, errors } = env2.analyzeCondExpr(s, engine, site, category);
    if (errors.length) return { errors: errors.map((e) => e.kind + (e.part ? ':' + e.part : '')) };
    const folded = env2.foldCondExpr(ast);
    return folded.type === 'const' ? { const: folded.value } : { ast: folded };
  };
  const ev2 = (f, title, url) => (f.const !== undefined ? f.const : env2.evalCondAST(f.ast, title, url));

  // 多斜杠裸值: 前瞻闭合斜杠与实际闭合斜杠一致, 不发生/enus/式破坏
  let tk;
  let r = cond2('path ^= /en/us');
  assert('条件-393: 多斜杠裸值前缀命中真实路径', !r.errors && ev2(r, 't', 'https://x.com/en/us/list') === true);
  assert('条件-394: 未发生/enus/式破坏(该误值不命中)', !r.errors && ev2(r, 't', 'https://x.com/enus/list') === false);
  r = cond2('path = /a/b');
  assert('条件-396: 双斜杠裸值精确匹配', !r.errors && ev2(r, 't', 'https://x.com/a/b') === true && ev2(r, 't', 'https://x.com/a/b/c') === false);
  r = cond2('path ^= /en/us & title *= "x"');
  assert('条件-397: 多斜杠值后逻辑组合正常切分', !r.errors && r.ast && r.ast.type === 'and' && ev2(r, 'x', 'https://x.com/en/us/1') === true && ev2(r, 'y', 'https://x.com/en/us/1') === false);
  tk = env2.tokenizeCondExpr('path ^= /a & b/ & title *= "y"');
  assert('条件-398(对照): 裸值内空格与&被正则态保留且后续组合正确', !tk.error && tk.tokens.length === 3 && tk.tokens[0] === 'path ^= /a & b/', tk.tokens);

  const bp = env2.extractBalancedParens;
  assert('条件-400(对照): 引号值内括号不参与结构计数', bp('@if(path="/a(b")', 3) && bp('@if(path="/a(b")', 3).content === 'path="/a(b"');
}

// ---- 条件-401~405: 订阅YAML格式自动检测回归 ----
await (async () => {
const src2 = src;
const fns2 = ['hostLabelToASCII', 'toASCIIHostname', 'toASCIIUrl', 'punycodeDecodeLabel', 'toUnicodeHostname', 'safeRegexTest', 'safeDecodeURIComponent', 'stripRuleComment', 'getInvalidRegexFlags', 'parseConditionPart', 'tokenizeCondExpr', 'parseCondExprTokens', 'analyzeCondExpr', 'foldCondExpr', 'evalDynamicLeaf', 'evalCondAST', 'extractBalancedParens', 'findIfOccurrences', 'stripIfConditions', 'evaluateCondition', 'isCondExprCore', 'looksLikeCondExpr', 'absorbStandaloneExpr', 'parseRuleWithConditions', 'validateUrlWildcard', 'ruleToRegex', 'parsePrefixedRegexRule', 'escapeWildcardPart', 'splitHostAndPort', 'escapeHostPart', 'wildcardToRegex', 'normalizeHostCandidate', 'matchWildcardDomainPattern', 'extractSimpleWhitelistDomain', 'matchSimpleDomain', 'compileRuleRegex', 'checkDynamicConditions', 'getSubdomainLevels', 'matchDomainEntryType', 'extractYamlRuleItems', 'parseRulesetContent', 'extractIfConditions', 'validateCondition', 'analyzeRule', 'validateRule'].map((n) => extractFn(src2, n));
const consts3 = src2.match(/const SUPPORTED_REGEX_FLAGS = 'imsu';/)[0];
const lang3 = src2.match(/const LANG_TEXTS = \{[\s\S]*?\n  \};/)[0];
const env3 = new Function(consts3 + '\n' + lang3 + '\n' + fns2.join('\n') + `
const window = { location: { hostname: 'www.google.com' } };
function getSearchEngine() { return 'google'; }
function getSearchCategory() { return 'web'; }
function t(key) { return key; }
const currentConfig = { rules: [], debug: false };
const validationCache = new Map();
const subdomainCache = new Map();
let compiledRules;
return { parseRulesetContent };
`)();
const pc = env3.parseRulesetContent;
const nonEmpty = (ls) => ls.map((l) => l.trim()).filter((l) => l);

const bugFile = 'example.com\nmatches:\n- foo.com\nbad.com';
const pbug = pc(bugFile);
assert('条件-401: 首行为规则的纯文本不进YAML(杂键不截断)', nonEmpty(pbug.lines).length === 4 && nonEmpty(pbug.lines)[0] === 'example.com' && nonEmpty(pbug.lines)[3] === 'bad.com');

const pbug2 = pc('*://a.com/*\nrules:\n  - b.com\ntext/广告/\n');
assert('条件-402: 首行URL规则+杂rules段保持原样', nonEmpty(pbug2.lines).length === 4 && nonEmpty(pbug2.lines)[2] === '- b.com');

const pyaml = pc('# header comment\nname: X\nrules:\n  - a.com\n');
assert('条件-403: 注释后首键name仍进YAML', pyaml.meta.name === 'X' && pyaml.lines.length === 1 && pyaml.lines[0] === 'a.com');

const pcond = pc('host $= ".example.com"\nmatches:\n- x.com\n');
assert('条件-405: 首行独立条件表达式按纯文本保留', nonEmpty(pcond.lines).length === 3 && nonEmpty(pcond.lines)[0] === 'host $= ".example.com"');
})();

// ---- 小写"!字段:"元数据行不再误判为取反独立条件 ----
{
  const envA = new Function(
    src.match(/const SUPPORTED_REGEX_FLAGS = 'imsu';/)[0] + '\n' +
    ['hostLabelToASCII', 'toASCIIHostname', 'toASCIIUrl', 'punycodeDecodeLabel', 'toUnicodeHostname', 'safeRegexTest', 'safeDecodeURIComponent', 'getInvalidRegexFlags', 'parseConditionPart', 'tokenizeCondExpr', 'parseCondExprTokens', 'analyzeCondExpr', 'foldCondExpr', 'evalDynamicLeaf', 'evalCondAST', 'extractBalancedParens', 'findIfOccurrences', 'stripIfConditions', 'evaluateCondition', 'isCondExprCore', 'looksLikeCondExpr', 'absorbStandaloneExpr', 'parseRuleWithConditions'].map((n) => extractFn(src, n)).join('\n') +
    '\nconst window = { location: { hostname: "www.google.com" } };' +
    '\nfunction getSearchEngine() { return "google"; }' +
    '\nfunction getSearchCategory() { return "web"; }' +
    '\nreturn { parseRuleWithConditions, evalCondAST };'
  )();
  const pa = envA.parseRuleWithConditions('! host: example.com');
  assert('审查A-4(已修复): 小写"! host:"元数据行不再被解析为取反独立条件', pa.dynamicConditions.length === 0 && pa.standaloneExpr === false);
}

// ---- 条件-406/407: host $= 端口条件点号边界 / 默认端口 ----
{
  const envC = new Function(
    src.match(/const SUPPORTED_REGEX_FLAGS = 'imsu';/)[0] + '\n' +
    ['hostLabelToASCII', 'toASCIIHostname', 'toASCIIUrl', 'punycodeDecodeLabel', 'toUnicodeHostname', 'safeRegexTest', 'safeDecodeURIComponent', 'getInvalidRegexFlags', 'parseConditionPart', 'tokenizeCondExpr', 'parseCondExprTokens', 'analyzeCondExpr', 'foldCondExpr', 'evalDynamicLeaf', 'evalCondAST', 'extractBalancedParens', 'findIfOccurrences', 'stripIfConditions', 'evaluateCondition', 'isCondExprCore', 'looksLikeCondExpr', 'absorbStandaloneExpr', 'parseRuleWithConditions', 'stripRuleComment'].map((n) => extractFn(src, n)).join('\n') +
    '\nconst window = { location: { hostname: "www.google.com" } };' +
    '\nfunction getSearchEngine() { return "google"; }' +
    '\nfunction getSearchCategory() { return "web"; }' +
    '\nreturn { parseRuleWithConditions, evalCondAST, looksLikeCondExpr, stripRuleComment };'
  )();
  const portCond = envC.parseRuleWithConditions('host $= "example.com:8080"');
  assert('条件-406-1: host $= "example.com:8080" 保持点号边界(badexample.com:8080 不命中)', envC.evalCondAST(portCond.dynamicConditions[0], 't', 'http://badexample.com:8080/') === false);
  assert('条件-406-2(对照): host $= "example.com:8080" 仍命中裸域与子域', envC.evalCondAST(portCond.dynamicConditions[0], 't', 'http://example.com:8080/') === true && envC.evalCondAST(portCond.dynamicConditions[0], 't', 'http://sub.example.com:8080/') === true);
  assert('条件-406-3(对照): host $= ":8080" 纯端口条件仍命中任意带端口URL', envC.evalCondAST(envC.parseRuleWithConditions('host $= ":8080"').dynamicConditions[0], 't', 'http://badexample.com:8080/') === true);
  assert('审查A-5: host $= ":80" 对显式默认端口和省略端口都不命中(URL.host不含:80)', envC.evalCondAST(envC.parseRuleWithConditions('host $= ":80"').dynamicConditions[0], 't', 'http://example.com:80/') === false && envC.evalCondAST(envC.parseRuleWithConditions('host $= ":80"').dynamicConditions[0], 't', 'http://example.com/') === false);
  assert('条件-407(对照): 无端口时点号边界正常(badexample.com 不命中 example.com)', envC.evalCondAST(envC.parseRuleWithConditions('host $= "example.com"').dynamicConditions[0], 't', 'http://badexample.com/') === false);
  assert('条件-410(对照): =~形式正则裸值受保护不被注释截断', envC.stripRuleComment('url =~ /a # b/') === 'url =~ /a # b/');
}

// ---- IDN与非BMP字符条件的归一命中 ----
{
  const envD = new Function(
    src.match(/const SUPPORTED_REGEX_FLAGS = 'imsu';/)[0] + '\n' +
    ['hostLabelToASCII', 'toASCIIHostname', 'toASCIIUrl', 'punycodeDecodeLabel', 'toUnicodeHostname', 'safeRegexTest', 'safeDecodeURIComponent', 'getInvalidRegexFlags', 'parseConditionPart', 'tokenizeCondExpr', 'parseCondExprTokens', 'analyzeCondExpr', 'foldCondExpr', 'evalDynamicLeaf', 'evalCondAST', 'extractBalancedParens', 'findIfOccurrences', 'stripIfConditions', 'evaluateCondition', 'isCondExprCore', 'looksLikeCondExpr', 'absorbStandaloneExpr', 'parseRuleWithConditions'].map((n) => extractFn(src, n)).join('\n') +
    '\nconst window = { location: { hostname: "lite.duckduckgo.com" } };' +
    '\nfunction getSearchEngine() { return "duckduckgo_lite"; }' +
    '\nfunction getSearchCategory() { return "web"; }' +
    '\nreturn { parseRuleWithConditions, evalCondAST };'
  )();
  const liteRule = envD.parseRuleWithConditions('*://*.example.com/* @if($site = "duckduckgo")');
  assert('复审C-1(已修复): $site = "duckduckgo"在duckduckgo_lite站点不再命中(仅匹配主站)', liteRule.staticPass === false && liteRule.dynamicConditions.length === 0);
  const urlCond = envD.parseRuleWithConditions('url *= "例子.com"').dynamicConditions[0];
  const hostCond = envD.parseRuleWithConditions('host $= ".例子.com"').dynamicConditions[0];
  assert('复审C-2(已修复): url条件与host同样做IDN/punycode归一, 中文域名字面条件命中punycode URL', envD.evalCondAST(urlCond, 't', 'https://xn--fsqu00a.com/') === true);
  const urlPath = envD.parseRuleWithConditions('url *= "下载"').dynamicConditions[0];
  const urlPct = envD.parseRuleWithConditions('url *= "%E4%B8%8B%E8%BD%BD"').dynamicConditions[0];
  assert('复审C-2b(已修复): url条件的中文路径与百分号路径互通', envD.evalCondAST(urlPath, 't', 'https://example.com/%E4%B8%8B%E8%BD%BD') === true && envD.evalCondAST(urlPct, 't', 'https://example.com/下载') === true);
  assert('复审C-2(对照): host条件对同一URL命中(README 2.2 IDN视为同一主机)', envD.evalCondAST(hostCond, 't', 'https://xn--fsqu00a.com/') === true);
  const emojiCond = envD.parseRuleWithConditions('url *= "😀"').dynamicConditions[0];
  let emojiErr = null;
  const tryEmoji = (url) => { try { return envD.evalCondAST(emojiCond, 't', url); } catch (e) { emojiErr = String(e); return null; } };
  assert('修复1-01: 含非BMP字符的url条件执行不抛URIError且不命中普通URL', tryEmoji('https://example.com/article') === false && emojiErr === null);
  assert('修复1-02(对照): URL含非BMP百分号编码形态时命中', emojiErr === null && envD.evalCondAST(emojiCond, 't', 'https://example.com/%F0%9F%98%80') === true);
  assert('修复1-03(对照): URL含非BMP原样字符时按码点编码归一命中', envD.evalCondAST(emojiCond, 't', 'https://example.com/😀') === true);
}

// ---- 条件-415: punycode非法字符回退 ----
{
  const consts = src.match(/const SUPPORTED_REGEX_FLAGS = 'imsu';/)[0];
  const envV = new Function(
    consts + '\n' +
    ['hostLabelToASCII', 'toASCIIHostname', 'toASCIIUrl', 'punycodeDecodeLabel', 'toUnicodeHostname', 'safeRegexTest', 'safeDecodeURIComponent', 'getInvalidRegexFlags', 'parseConditionPart', 'tokenizeCondExpr', 'parseCondExprTokens', 'analyzeCondExpr', 'foldCondExpr', 'evalDynamicLeaf', 'evalCondAST', 'extractBalancedParens', 'findIfOccurrences', 'stripIfConditions', 'evaluateCondition', 'isCondExprCore', 'looksLikeCondExpr', 'absorbStandaloneExpr', 'parseRuleWithConditions'].map((n) => extractFn(src, n)).join('\n') +
    '\nconst window = { location: { hostname: "www.bing.com" } };' +
    '\nfunction getSearchEngine() { return "bing"; }' +
    '\nfunction getSearchCategory() { return "web"; }' +
    '\nreturn { parseRuleWithConditions, evalCondAST, toUnicodeHostname };'
  )();
  assert('条件-415(修复10验证): punycode标签含非法字符(_/+)时回退原文而非错误解码', envV.toUnicodeHostname('xn--a_b') === 'xn--a_b' && envV.toUnicodeHostname('xn--a+b') === 'xn--a+b' && envV.toUnicodeHostname('xn--fsqu00a.com') === '例子.com');
}

// ---- 大写无空格"!字段:"元数据行不再编译为取反独立条件 ----
{
  const envE = new Function(
    src.match(/const SUPPORTED_REGEX_FLAGS = 'imsu';/)[0] + '\n' +
    ['hostLabelToASCII', 'toASCIIHostname', 'toASCIIUrl', 'punycodeDecodeLabel', 'toUnicodeHostname', 'safeRegexTest', 'safeDecodeURIComponent', 'getInvalidRegexFlags', 'parseConditionPart', 'tokenizeCondExpr', 'parseCondExprTokens', 'analyzeCondExpr', 'foldCondExpr', 'evalDynamicLeaf', 'evalCondAST', 'extractBalancedParens', 'findIfOccurrences', 'stripIfConditions', 'evaluateCondition', 'isCondExprCore', 'looksLikeCondExpr', 'absorbStandaloneExpr', 'parseRuleWithConditions'].map((n) => extractFn(src, n)).join('\n') +
    '\nconst window = { location: { hostname: "www.google.com" } };' +
    '\nfunction getSearchEngine() { return "google"; }' +
    '\nfunction getSearchCategory() { return "web"; }' +
    '\nreturn { parseRuleWithConditions, evalCondAST, looksLikeCondExpr };'
  )();
  // 大写无空格元数据行转入URL通配校验报错(错误可见); 小写无空格冒号取反为既有设计(条件-279)
  const pe = envE.parseRuleWithConditions('!Title: EasyList');
  assert('审查D-2(已修复): 大写无空格元数据行 "!Title: EasyList" 不再编译为取反独立条件', envE.looksLikeCondExpr('!Title: EasyList') === false && pe.standaloneExpr === false && pe.dynamicConditions.length === 0);
  assert('审查D-2b(设计保持): 小写无空格冒号取反仍识别; 其余大写无空格元数据键同样被过滤', envE.looksLikeCondExpr('!title:foo') === true && envE.looksLikeCondExpr('!Expires: 5 days') === false && envE.looksLikeCondExpr('!Homepage:https://x') === false);
}

// ---- @if内url=/re/按正则编译 / 纯静态独立@if保留 / 未闭合title/报错 ----
{
  const env2 = new Function(
    src.match(/const SUPPORTED_REGEX_FLAGS = 'imsu';/)[0] + '\n' +
    ['hostLabelToASCII', 'toASCIIHostname', 'toASCIIUrl', 'punycodeDecodeLabel', 'toUnicodeHostname', 'safeRegexTest', 'safeDecodeURIComponent', 'getInvalidRegexFlags', 'parseConditionPart', 'tokenizeCondExpr', 'parseCondExprTokens', 'analyzeCondExpr', 'foldCondExpr', 'evalDynamicLeaf', 'evalCondAST', 'extractBalancedParens', 'findIfOccurrences', 'stripIfConditions', 'evaluateCondition', 'isCondExprCore', 'looksLikeCondExpr', 'absorbStandaloneExpr', 'parseRuleWithConditions', 'stripRuleComment', 'extractIfConditions', 'validateCondition', 'analyzeRule', 'parsePrefixedRegexRule', 'ruleToRegex', 'escapeWildcardPart', 'wildcardToRegex', 'normalizeHostCandidate', 'matchWildcardDomainPattern', 'extractSimpleWhitelistDomain', 'matchSimpleDomain', 'compileRuleRegex', 'validateUrlWildcard'].map((n) => extractFn(src, n)).join('\n') +
    '\nconst window = { location: { hostname: "www.bing.com" } };' +
    '\nfunction getSearchEngine() { return "bing"; }' +
    '\nfunction getSearchCategory() { return "web"; }' +
    '\nfunction t(key) { return key; }' +
    '\nconst currentConfig = { rules: [], debug: false };' +
    '\nreturn { parseRuleWithConditions, evalCondAST, stripRuleComment, analyzeRule, parsePrefixedRegexRule };'
  )();
  const q1 = env2.parseRuleWithConditions('*://*.example.com/* @if(url=/ab/)');
  const c1 = q1.dynamicConditions[0];
  assert('审查2-C1(已修复): @if(url=/ab/) 按正则编译并命中路径, 不再退化成含斜杠的精确等值', q1.staticPass === true && c1 && c1.type === 'leaf' && c1.cond.op === '=~' && env2.evalCondAST(c1, 't', 'https://sub.example.com/ab/') === true);
  const q2 = env2.parseRuleWithConditions('@if($site=bing)');
  const q2b = env2.parseRuleWithConditions('$site=bing');
  assert('审查2-C2(已修复): 命中的纯静态独立@if与裸写$site=bing一样进入全匹配表达式, 不再静默丢弃', q2.staticPass === true && q2.coreRule === '' && q2.standaloneExpr === true && q2.dynamicConditions.length === 0 && q2b.standaloneExpr === true);
  const a1 = env2.analyzeRule('title/abc #def');
  assert('审查2-C3(已修复): 未闭合title/前缀正则直接报错(valid=false+regexError), 不再静默吞注释/条件偏离本意; 带闭合斜杠形态不受影响(注释正常剥离+校验通过)', a1.valid === false && a1.errors.includes('regexError') && env2.parsePrefixedRegexRule('title/abc #def', 6).unclosed === true && env2.parsePrefixedRegexRule('title/abc/', 6).unclosed === false && env2.stripRuleComment('title/abc/ #def') === 'title/abc/' && env2.analyzeRule('title/abc/ #def').valid === true);
}

// ---- url =~ 的百分号/IDN归一(已修复) ----
{
  const envU = new Function(
    src.match(/const SUPPORTED_REGEX_FLAGS = 'imsu';/)[0] + '\n' +
    ['hostLabelToASCII', 'toASCIIHostname', 'toASCIIUrl', 'punycodeDecodeLabel', 'toUnicodeHostname', 'safeRegexTest', 'safeDecodeURIComponent', 'getInvalidRegexFlags', 'parseConditionPart', 'tokenizeCondExpr', 'parseCondExprTokens', 'analyzeCondExpr', 'foldCondExpr', 'evalDynamicLeaf', 'evalCondAST', 'extractBalancedParens', 'findIfOccurrences', 'stripIfConditions', 'evaluateCondition', 'isCondExprCore', 'looksLikeCondExpr', 'absorbStandaloneExpr', 'parseRuleWithConditions'].map((n) => extractFn(src, n)).join('\n') +
    `\nconst window = { location: { hostname: 'www.google.com' } };
function getSearchEngine() { return 'google'; } function getSearchCategory() { return 'web'; }
return { parseRuleWithConditions, evalCondAST };`
  )();
  const ev = (rule, url) => envU.evalCondAST(envU.parseRuleWithConditions(rule).dynamicConditions[0], 't', url);
  assert('审查5-C1(已修复): url =~ 同时测原文与foldUrl, 中文正则命中百分号URL, 百分号正则仍命中原文, punycode主机同样命中', ev('url =~ /下载/', 'https://example.com/%E4%B8%8B%E8%BD%BD') === true && ev('url =~ /%E4%B8%8B%E8%BD%BD/', 'https://example.com/%E4%B8%8B%E8%BD%BD') === true && ev('url =~ /例子/', 'https://xn--fsqu00a.com/') === true && ev('url =~ /xn--fsqu00a/', 'https://xn--fsqu00a.com/') === true);
}

// ---- 订阅YAML: matches段解析 / 多行flow闭合(已修复) ----
{
  const env7c = new Function(
    src.match(/const SUPPORTED_REGEX_FLAGS = 'imsu';/)[0] + '\n' +
    ['hostLabelToASCII', 'toASCIIHostname', 'toASCIIUrl', 'punycodeDecodeLabel', 'toUnicodeHostname', 'safeRegexTest', 'safeDecodeURIComponent', 'stripRuleComment', 'getInvalidRegexFlags', 'parseConditionPart', 'tokenizeCondExpr', 'parseCondExprTokens', 'analyzeCondExpr', 'foldCondExpr', 'evalDynamicLeaf', 'evalCondAST', 'extractBalancedParens', 'findIfOccurrences', 'stripIfConditions', 'evaluateCondition', 'isCondExprCore', 'looksLikeCondExpr', 'absorbStandaloneExpr', 'parseRuleWithConditions', 'validateUrlWildcard', 'ruleToRegex', 'parsePrefixedRegexRule', 'escapeWildcardPart', 'splitHostAndPort', 'escapeHostPart', 'wildcardToRegex', 'normalizeHostCandidate', 'matchWildcardDomainPattern', 'extractSimpleWhitelistDomain', 'matchSimpleDomain', 'compileRuleRegex', 'checkDynamicConditions', 'getSubdomainLevels', 'matchDomainEntryType', 'extractYamlRuleItems', 'parseRulesetContent', 'extractIfConditions', 'validateCondition', 'analyzeRule', 'validateRule'].map((n) => extractFn(src, n)).join('\n') + `
const window = { location: { hostname: 'www.google.com' } };
function getSearchEngine() { return 'google'; } function getSearchCategory() { return 'web'; }
function t(key) { return key; }
const currentConfig = { rules: [], debug: false };
const validationCache = new Map(); const subdomainCache = new Map();
let compiledRules;
return { parseRulesetContent };`
  )();
  const pc7 = env7c.parseRulesetContent;
  const nz7 = (ls) => ls.map((l) => l.trim()).filter((l) => l);
  const pM7 = pc7('name: X\nmatches:\n- foo.com\n');
  assert('审查7-C4(修复2回归): 仅含matches:的合法uBlacklist订阅正常解析出规则集(不再按导入失败处理)', nz7(pM7.lines).length === 1 && nz7(pM7.lines)[0] === 'foo.com' && pM7.meta.name === 'X');
  const pF7 = pc7('name: X\nrules: [\n  a.com,\n  b.com]\n');
  assert('审查7-C5(已修复): 多行flow列表闭合]与末元素同行, 正确解析为rules列表', pF7.meta.name === 'X' && nz7(pF7.lines).length === 2 && nz7(pF7.lines)[0] === 'a.com' && nz7(pF7.lines)[1] === 'b.com');
}

// ---- @if 单等号正则: 括号平衡(修复4) ----
{
  const envF4 = new Function(
    src.match(/const SUPPORTED_REGEX_FLAGS = 'imsu';/)[0] + '\n' +
    ['hostLabelToASCII', 'toASCIIHostname', 'toASCIIUrl', 'punycodeDecodeLabel', 'toUnicodeHostname', 'safeRegexTest', 'safeDecodeURIComponent', 'stripRuleComment', 'getInvalidRegexFlags', 'parseConditionPart', 'tokenizeCondExpr', 'parseCondExprTokens', 'analyzeCondExpr', 'foldCondExpr', 'evalDynamicLeaf', 'evalCondAST', 'extractBalancedParens', 'findIfOccurrences', 'stripIfConditions', 'evaluateCondition', 'isCondExprCore', 'looksLikeCondExpr', 'absorbStandaloneExpr', 'parseRuleWithConditions', 'validateUrlWildcard', 'ruleToRegex', 'parsePrefixedRegexRule', 'escapeWildcardPart', 'splitHostAndPort', 'escapeHostPart', 'wildcardToRegex', 'normalizeHostCandidate', 'matchWildcardDomainPattern', 'extractSimpleWhitelistDomain', 'matchSimpleDomain', 'compileRuleRegex', 'checkDynamicConditions', 'getSubdomainLevels', 'matchDomainEntryType', 'extractYamlRuleItems', 'parseRulesetContent', 'extractIfConditions', 'validateCondition', 'analyzeRule', 'validateRule'].map((n) => extractFn(src, n)).join('\n') + `
const window = { location: { hostname: 'www.google.com' } };
function getSearchEngine() { return 'google'; } function getSearchCategory() { return 'web'; }
function t(key) { return key; }
const currentConfig = { rules: [], debug: false };
const validationCache = new Map(); const subdomainCache = new Map();
let compiledRules;
return { analyzeRule, parseRuleWithConditions, checkDynamicConditions, stripRuleComment };`
  )();
  const ruleF4 = '@if(title=/\\)$/) example.com';
  const hitF4 = (title) => envF4.checkDynamicConditions(envF4.parseRuleWithConditions(ruleF4).dynamicConditions, title, 'https://example.com/x');
  assert('修复4-1: @if(title=/\\)$/) 单等号正则含不成对括号不再误杀, 语义为标题以)结尾', envF4.analyzeRule(ruleF4).valid === true && hitF4('报告(2024)') === true && hitF4('报告 2024') === false);
  assert('修复4-2: 裸值字符串条件不误入正则态, url=/foo 与 site=x/y 及多斜杠URL体仍valid', envF4.analyzeRule('@if(url=/foo) *://x.com/a/b/*').valid === true && envF4.analyzeRule('@if(site=x/y) x.com').valid === true);
  assert('修复4-3: =~/简写/独立单等号三写法行为不变', envF4.analyzeRule('@if(title=~ /\\)$/) example.com').valid === true && envF4.analyzeRule('@if(title/\\)$/) example.com').valid === true && envF4.analyzeRule('title=/\\)$/ ').valid === true);
  assert('修复4-4: strip注释剥离与嵌套括号组不受影响', envF4.stripRuleComment(ruleF4 + ' # 注释') === ruleF4 && envF4.analyzeRule('@if(title=/((a))/) x.com').valid === true && envF4.checkDynamicConditions(envF4.parseRuleWithConditions('@if(title=/((a))/) x.com').dynamicConditions, '(a)', 'https://x.com') === true);
  // 修复13: host条件值归一为空串后^=/*=恒真
  const liteSrc13 = fs.readFileSync([path.join(scriptDir, 'Lite.user.js'), path.join(scriptDir, 'Other', 'Lite.user.js')].find((p) => fs.existsSync(p)), 'utf8');
  const hitF13 = (cond) => envF4.checkDynamicConditions(envF4.parseRuleWithConditions(cond).dynamicConditions, '标题', 'https://example.com/x');
  assert('修复13-1: host条件值经toASCIIHostname归一为空串时^=/*=不再恒真, host ^= . 与 host *= . 均不命中', hitF13('@if(host ^= .) x.com') === false && hitF13('@if(host ^= ".") x.com') === false && hitF13('@if(host *= .) x.com') === false);
  assert('修复13-2(对照): host常规前缀/后缀/包含/全点值语义不变', hitF13('@if(host ^= ex) x.com') === true && hitF13('@if(host $= .com) x.com') === true && hitF13('@if(host *= xa) x.com') === true && hitF13('@if(host ^= ..) x.com') === false);
  assert('修复13-3: Lite版evalDynamicLeaf同步空值守卫', extractFn(liteSrc13, 'evalDynamicLeaf').includes('!cmpVal'));
}

// ---- 修复14: @if空串比较值守卫扩展到title/url/path/scheme ----
{
  const env14 = new Function(
    src.match(/const SUPPORTED_REGEX_FLAGS = 'imsu';/)[0] + '\n' +
    ['hostLabelToASCII', 'toASCIIHostname', 'toASCIIUrl', 'punycodeDecodeLabel', 'toUnicodeHostname', 'encodeNonAscii', 'safeRegexTest', 'safeDecodeURIComponent', 'getInvalidRegexFlags', 'parseConditionPart', 'tokenizeCondExpr', 'parseCondExprTokens', 'analyzeCondExpr', 'foldCondExpr', 'evalDynamicLeaf', 'evalCondAST'].map((n) => extractFn(src, n)).join('\n') +
    '\nreturn { evalDynamicLeaf };'
  )();
  const ev14 = (cond, title, url) => env14.evalDynamicLeaf(cond, title, url);
  assert('修复14-1: title $= ""/^= ""/*= ""/= "" 空串比较值不再恒真或漏判, 一律不命中', ev14({ type: 'title', op: '$=', val: '' }, '标题', 'https://x.com') === false && ev14({ type: 'title', op: '^=', val: '' }, '标题', 'https://x.com') === false && ev14({ type: 'title', op: '*=', val: '' }, '标题', 'https://x.com') === false && ev14({ type: 'title', op: '=', val: '' }, '标题', 'https://x.com') === false);
  assert('修复14-2: url ^= "" / path *= "" / scheme ^= "" 空串比较值不命中', ev14({ type: 'url', op: '^=', val: '' }, 't', 'https://x.com/a') === false && ev14({ type: 'path', op: '*=', val: '' }, 't', 'https://x.com/a') === false && ev14({ type: 'scheme', op: '^=', val: '' }, 't', 'https://x.com/a') === false);
  assert('修复14-3(对照): 非空值与 =~ 及 host 后缀语义不变', ev14({ type: 'title', op: '*=', val: '题' }, '标题', 'https://x.com') === true && ev14({ type: 'path', op: '*=', val: '/a' }, 't', 'https://x.com/a') === true && ev14({ type: 'url', op: '=~', regex: /x\.com/ }, 't', 'https://x.com/a') === true && ev14({ type: 'host', op: '$=', val: '.com' }, '', 'https://x.com') === true);
  const liteSrc14 = fs.readFileSync([path.join(scriptDir, 'Lite.user.js'), path.join(scriptDir, 'Other', 'Lite.user.js')].find((p) => fs.existsSync(p)), 'utf8');
  assert('修复14-4: Lite版evalDynamicLeaf同步空串守卫(title/url双路径)', (() => { const f = extractFn(liteSrc14, 'evalDynamicLeaf'); return f.includes("!cond.val") && f.split("!cond.val").length === 3; })());
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

})();
