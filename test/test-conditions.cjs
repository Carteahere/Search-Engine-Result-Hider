// 条件表达式: 解析与识别 / @if条件提取与URL路径冲突 / 独立表达式
// 由功能相近的测试文件合并而成: test-cond-expr.cjs, test-if-cond.cjs, test-standalone-expr.cjs
// 命名规则: 条件-三位序号: 描述; 循环组为 条件-序号-用例号; (已知问题)/(对照) 为语义标记
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

// ==== [条件-001~226] 条件表达式解析与识别 (来源: test-cond-expr.cjs) ====
await (async () => {
const fns = [
  'hostLabelToASCII',
  'toASCIIHostname',
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

r = condExpr('$site = "bing"', 'bing');
assert('条件-003: $site bing@bing 真', r.const === true);

r = condExpr('Google', 'google');
assert('条件-004: 裸引擎名已移除->unknown', r.errors && r.errors[0].startsWith('unknown'));

r = condExpr('title *= 关键词', 'google');
assert('条件-005: 无引号中文title包含', !r.errors && ev(r, '含关键词的标题', 'https://x.com/') === true && ev(r, 'other', 'https://x.com/') === false);
r = condExpr('title*=关键词', 'google');
assert('条件-006: 无空格无引号中文', !r.errors && ev(r, '关键词', 'https://x.com/') === true);
r = condExpr('path *= /a%20b/', 'google');
assert('条件-007: 无引号含百分号路径', !r.errors && ev(r, 't', 'https://x.com/a%20b/c') === true);
r = condExpr('path *= "/下载/"', 'google');
assert('条件-008: 中文path解码比对', !r.errors && ev(r, 't', 'https://x.com/下载/list') === true && ev(r, 't', 'https://x.com/other') === false);
r = condExpr('path ^= "/分类/"', 'google');
assert('条件-009: 中文path前缀', !r.errors && ev(r, 't', 'https://x.com/分类/1') === true);
r = condExpr('path *= "/%E4%B8%8B%E8%BD%BD/"', 'google');
assert('条件-010: 编码形式path仍命中', !r.errors && ev(r, 't', 'https://x.com/下载/') === true);

r = condExpr('title *= "kw1" | title *= "kw2"', 'google');
assert('条件-011: 纯或->动态AST', !r.errors && !r.const && r.ast.type === 'or');
assert('条件-012: kw1命中', ev(r, 'has kw1 here', 'https://x.com/') === true);
assert('条件-013: kw2命中', ev(r, 'kw2 page', 'https://x.com/') === true);
assert('条件-014: 都不含->false', ev(r, 'nothing', 'https://x.com/') === false);
assert('条件-015: 无标题->false', ev(r, '', 'https://x.com/') === false);

r = condExpr('$site = "google" | title *= "x"', 'google');
assert('条件-016: 静态or命中->无条件恒真', r.const === true);

r = condExpr('$site = "google" | title *= "x"', 'bing');
assert('条件-017: 静态or未命中->剩动态', !r.const && r.ast.type === 'leaf');
assert('条件-018: 标题含x', ev(r, 'xxx', 'https://x.com/') === true);
assert('条件-019: 标题不含x', ev(r, 'yyy', 'https://x.com/') === false);

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
assert('条件-029: kw2命中', ev(r, 'xx kw2 xx', 'https://x.com/') === true);
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
assert('条件-037: 标题非a', ev(r, 'bbb', 'https://x/') === true);
assert('条件-038: 标题含a->不命中', ev(r, 'aaa', 'https://x/') === false);

r = condExpr('!(title *= "a" | title *= "b")', 'google');
assert('条件-039: !(A|B)', !r.errors);
assert('条件-040: 新3a', ev(r, 'ccc', 'https://x/') === true);
assert('条件-041: 新3b', ev(r, 'bbb', 'https://x/') === false);

r = condExpr('title *= "a" & !(url *= "ads")', 'google');
assert('条件-042: 混合', ev(r, 'a t', 'https://x/page') === true && ev(r, 'a t', 'https://x/ads/1') === false);

r = condExpr('title *= "a" | title *= "b" & url *= "c"', 'google');
assert('条件-043: 优先级 & > |', !r.errors && r.ast.type === 'or');
assert('条件-044: b含但url无c->false(&优先于|)', ev(r, 'bbb', 'https://x/') === false);
assert('条件-045: b且url含c', ev(r, 'bbb', 'https://x/c/') === true);
assert('条件-046: a即true', ev(r, 'aaa', 'https://x/') === true);

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
r = condExpr('title *= "a" || title *= "b"', 'google');
assert('条件-057: 连续|', r.errors && r.errors.some((e) => e.startsWith('syntax')));
r = condExpr('title *= "a" &&& title *= "b"', 'google');
assert('条件-058: 三连&', r.errors && r.errors.some((e) => e.startsWith('syntax')));
r = condExpr('title *= "a" & title *= "b" & title *= "c"', 'google');
assert('条件-059: 连续单&仍合法', !r.errors);
r = condExpr('(title *= "a" | title *= "b"', 'google');
assert('条件-060: 括号未闭合', r.errors && r.errors.some((e) => e.startsWith('syntax')));
r = condExpr('title *= "a")', 'google');
assert('条件-061: 多余右括号', r.errors && r.errors.some((e) => e.startsWith('syntax')));
r = condExpr('& title *= "a"', 'google');
assert('条件-062: &开头', r.errors && r.errors.some((e) => e.startsWith('syntax')));
r = condExpr('title *= "a" |', 'google');
assert('条件-063: |结尾', r.errors && r.errors.some((e) => e.startsWith('syntax')));
r = condExpr('', 'google');
assert('条件-064: 空串', r.errors);
r = condExpr('   ', 'google');
assert('条件-065: 全空白', r.errors);
r = condExpr('title =~ /x/g', 'google');
assert('条件-066: flags含g', r.errors && r.errors[0].startsWith('flags:g'));
r = condExpr('title =~ /(/)', 'google');
assert('条件-067: 正则无效', r.errors && r.errors[0].startsWith('regex'));
r = condExpr('title =~ /a\\', 'google');
assert('条件-068: 正则未闭合(tail转义)', r.errors);

r = condExpr('title//', 'google');
assert('条件-069: 空正则简写报错(不再恒匹配)', r.errors && r.errors.some((e) => e.startsWith('unknown')));
r = condExpr('url =~ //', 'google');
assert('条件-070: =~空正则报错(不再恒匹配)', r.errors && r.errors.some((e) => e.startsWith('unknown')));
r = condExpr('title/ /', 'google');
assert('条件-071: 空白pattern正则同样报错', r.errors && r.errors.some((e) => e.startsWith('unknown')));
r = condExpr('host//', 'google');
assert('条件-072: host空正则报错', r.errors && r.errors.some((e) => e.startsWith('unknown')));

r = condExpr('host =~ /ABC/', 'google');
assert('条件-073: host正则无i大小写敏感(不再强制加i)', !r.errors && ev(r, 't', 'https://abc.com/') === false);
r = condExpr('host =~ /ABC/i', 'google');
assert('条件-074: host正则加i忽略大小写', !r.errors && ev(r, 't', 'https://abc.com/') === true);
r = condExpr('scheme = "HTTPS"', 'google');
assert('条件-075: scheme字符串比较仍忽略大小写', !r.errors && ev(r, 't', 'https://x.com/') === true);
r = condExpr('host $= ".EXAMPLE.COM"', 'google');
assert('条件-076: host字符串比较仍忽略大小写', ev(r, 't', 'https://www.example.com/') === true);


// 引擎别名 ddg($site 值归一)
r = condExpr('$site = "DDG"', 'duckduckgo');
assert('条件-077: DDG别名(大写)', r.const === true);

// ---- url 表达式系列(@if 内)----
r = condExpr('url = "https://ex.com/"', 'google');
assert('条件-078: url精确', !r.errors && ev(r, 't', 'https://ex.com/') === true && ev(r, 't', 'https://ex.com/x') === false);

r = condExpr('url = "HTTPS://EX.COM/"', 'google');
assert('条件-079: url精确忽略大小写', ev(r, 't', 'https://ex.com/') === true);

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
r = condExpr('title =~/x/', 'google');
assert('条件-086: 空格在=~与/之间仍为正则', !r.errors && ev(r, 'xxx', 'https://x/') === true);
r = condExpr('url=~/ads/', 'google');
assert('条件-087: url紧凑=~/正则', !r.errors && ev(r, 't', 'https://x.com/ads/1') === true && ev(r, 't', 'https://x.com/clean/') === false);
r = condExpr('url*=~/ads/', 'google');
assert('条件-088: 运算符后接=~为显式报错(旧代码静默字面比较)', !!r.errors);
r = condExpr('title=~/未闭合', 'google');
assert('条件-089: 未闭合紧凑正则报错而非字面比较', !!r.errors);
r = condExpr('title *= "~波浪线"', 'google');
assert('条件-090: 引号内~开头的字面值不受影响', !r.errors && ev(r, '~波浪线', 'https://x/') === true);

r = condExpr('url/example\\.(com|net)/', 'google');
assert('条件-091: url简写(正则内括号与|整吞)', !r.errors && ev(r, 't', 'https://example.com/') === true && ev(r, 't', 'https://example.net/') === true && ev(r, 't', 'https://other.net/') === false);

r = condExpr('url/a&b|c/', 'google');
assert('条件-092: url简写(正则内&与|不切分)', !r.errors && ev(r, 't', 'https://x/a&b') === true && ev(r, 't', 'https://x/zzc') === true);

r = condExpr('url/example\\.net/i', 'google');
assert('条件-093: url简写带flags', !r.errors && ev(r, 't', 'https://EXAMPLE.NET/') === true);

r = condExpr('title/example/i', 'google');
assert('条件-094: title简写带flags', !r.errors && ev(r, 'EXAMPLE!', 'https://x/') === true && ev(r, 'other', 'https://x/') === false);

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
r = condExpr('title/x/g', 'google');
assert('条件-102: title简写非法flags', r.errors && r.errors[0].startsWith('flags:g'));
r = condExpr('url =~ /[/]/', 'google');
assert('条件-103: url正则字符类内裸斜杠合法', !r.errors && ev(r, 't', 'https://example.com/a/b') === true);
r = condExpr('url =~ /\\//', 'google');
assert('条件-104: url正则转义斜杠合法', !r.errors && ev(r, 't', 'https://example.com/a/b') === true);
r = condExpr('url =~ /(/)', 'google');
assert('条件-105: url正则无效', r.errors && r.errors[0].startsWith('regex'));
r = condExpr('url ^= "https://ex" & url $= "/s/"', 'google');
assert('条件-106: 双url条件AND', ev(r, 't', 'https://ex.com/s/') === true && ev(r, 't', 'https://ex.com/other/') === false);

r = condExpr('url = ~"x"', 'google');
assert('条件-107: 乱写归unknown', r.errors && r.errors[0].startsWith('unknown'));

// ---- $site 变量----
r = condExpr('$site = "google"', 'google');
assert('条件-108: $site命中', r.const === true);
r = condExpr('$site = "google"', 'bing');
assert('条件-109: $site未命中', r.const === false);
r = condExpr('$site = "BING"', 'bing');
assert('条件-110: $site忽略大小写', r.const === true);
r = condExpr('$site = "ddg"', 'duckduckgo');
assert('条件-111: $site ddg别名', r.const === true);
r = condExpr('$site : "yandex"', 'yandex');
assert('条件-112: $site冒号形式', r.const === true);
r = condExpr('$site = "google" & title *= "x"', 'google');
assert('条件-113: $site与动态组合(google)', !r.const && ev(r, 'xx', 'https://x/') === true && ev(r, 'yy', 'https://x/') === false);
r = condExpr('$site = "google" & title *= "x"', 'bing');
assert('条件-114: 组合在bing折叠恒假', r.const === false);
r = condExpr('$site = "google" | $site = "bing"', 'google');
assert('条件-115: $site多引擎或(google)', r.const === true);
r = condExpr('$site = "google" | $site = "bing"', 'bing');
assert('条件-116: 多引擎或(bing)', r.const === true);
r = condExpr('$site = "google" | $site = "bing"', 'yandex');
assert('条件-117: 多引擎或(yandex恒假)', r.const === false);
r = condExpr('$site = "foo"', 'google');
assert('条件-118: 未知站点值->静态假(不报错)', r.const === false && !r.errors);
r = condExpr('$site = google', 'google');
assert('条件-119: 值未加引号正常识别为合法值', r.const === true);
r = condExpr('!($site = "yandex")', 'google');
assert('条件-120: $site取反', r.const === true);
r = condExpr('$site = "bing" | $site = "yandex"', 'yandex');
assert('条件-121: $site多值或', r.const === true);
r = condExpr('$site = "yahoo-japan"', 'yahoo');
assert('条件-122: $site yahoo-japan别名命中', r.const === true);
r = condExpr('$site = "yahoo-japan"', 'google');
assert('条件-123: $site yahoo-japan非yahoo恒假', r.const === false);
r = condExpr('$site = "yahoo"', 'yahoo');
assert('条件-124: $site yahoo原值仍可用', r.const === true);
r = condExpr('$site = "ddg"', 'ddg');
assert('条件-125: $site ddg 同名自定义引擎可命中', r.const === true);
r = condExpr('$site = "yahoo-japan"', 'yahoo-japan');
assert('条件-126: $site yahoo-japan 同名自定义引擎可命中', r.const === true);
r = condExpr('$site = "mysearx"', 'MySearx');
assert('条件-127: $site 自定义引擎ID忽略大小写(规则小写)', r.const === true);
r = condExpr('$site = "MySearx"', 'mysearx');
assert('条件-128: $site 自定义引擎ID忽略大小写(规则大写)', r.const === true);

// ---- 行尾 # 注释剥离 ----
assert('条件-129: URL规则行尾注释', m.stripRuleComment('*://x.com/* # 注释') === '*://x.com/*');
assert('条件-130: 整行注释', m.stripRuleComment('# 注释') === '');
assert('条件-131: 空白+#注释', m.stripRuleComment('   # x') === '');
assert('条件-132: 正则内#保留', m.stripRuleComment('/a#b/') === '/a#b/');
assert('条件-133: 正则行尾注释', m.stripRuleComment('/a#b/ # note') === '/a#b/');
assert('条件-134: title正则内#保留+行尾注释', m.stripRuleComment('title/.*#.*/ # note') === 'title/.*#.*/');
assert('条件-135: text正则', m.stripRuleComment('text/a #b/') === 'text/a #b/');
assert('条件-136: 引号内#与行尾注释', m.stripRuleComment('*://x.com/* @if(title *= "a # b") # note') === '*://x.com/* @if(title *= "a # b")');
assert('条件-137: @if正则内括号配平', m.stripRuleComment('*://x.com/* @if(title =~ /a)b/) # x') === '*://x.com/* @if(title =~ /a)b/)');
assert('条件-138: site(...)括号计数', m.stripRuleComment('*://x.com/* @if(site("x.com") & title *= "y") # x') === '*://x.com/* @if(site("x.com") & title *= "y")');
assert('条件-139: 白名单注释', m.stripRuleComment('@*://x.com/* # 放行') === '@*://x.com/*');
assert('条件-140: 高亮@N注释', m.stripRuleComment('@1 /a#b/ # note') === '@1 /a#b/');
assert('条件-141: URL内非空白#保留', m.stripRuleComment('*://x.com/a#b') === '*://x.com/a#b');
assert('条件-142: 无注释原样', m.stripRuleComment('*://x.com/* @if(Google)') === '*://x.com/* @if(Google)');
assert('条件-143: @if后带空格', m.stripRuleComment('*://x.com/* @if (title *= "a") # c') === '*://x.com/* @if (title *= "a")');
assert('条件-144: 嵌套@if括号', m.stripRuleComment('*://x.com/* @if((title *= "a" | title *= "b") & !(url *= "c")) # x') === '*://x.com/* @if((title *= "a" | title *= "b") & !(url *= "c"))');
assert('条件-145: 引号内转义引号', m.stripRuleComment('*://x.com/* @if(title *= "a\\"b # c") # x') === '*://x.com/* @if(title *= "a\\"b # c")');
assert('条件-146: @if内部正则含空格和#不被截断', m.stripRuleComment('*://x.com/* @if(url =~ /foo # bar/) # note') === '*://x.com/* @if(url =~ /foo # bar/)');
assert('条件-147: 高亮域名注释', m.stripRuleComment('@1 *://x.com/* # c') === '@1 *://x.com/*');
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

r = condExpr('host/\\.example\\.com$/i', 'google');
assert('条件-159: host简写(正则含|不切分)', !r.errors && ev(r, 't', 'https://www.example.com/') === true && ev(r, 't', 'https://example.net/') === false);

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

r = condExpr('path ^= "/download"', 'google');
assert('条件-166: path前缀', ev(r, 't', 'https://x.com/download/setup.exe') === true);

r = condExpr('path = "/download/"', 'google');
assert('条件-167: path精确', ev(r, 't', 'https://x.com/download/') === true && ev(r, 't', 'https://x.com/download/x') === false);

r = condExpr('path =~ /^\\/download\\//i', 'google');
assert('条件-168: path正则(=~)', !r.errors && ev(r, 't', 'https://x.com/Download/a') === true);

r = condExpr('path/download/', 'google');
assert('条件-169: path简写', !r.errors && ev(r, 't', 'https://x.com/download/setup') === true);

r = condExpr('path *= "/dl/" & path *= ".zip"', 'google');
assert('条件-170: path双条件AND', ev(r, 't', 'https://x.com/a/dl/b.zip') === true && ev(r, 't', 'https://x.com/a/dl/b.rar') === false);

r = condExpr('path *= "/a%20b/"', 'google');
assert('条件-171: path含编码空格值(原样比较)', !r.errors && ev(r, 't', 'https://x.com/a%20b/c') === true && ev(r, 't', 'https://x.com/ab/c') === false);

r = condExpr('scheme = "https"', 'google');
assert('条件-172: scheme精确', !r.errors && ev(r, 't', 'https://x.com/') === true && ev(r, 't', 'http://x.com/') === false);

r = condExpr('scheme = "HTTP"', 'google');
assert('条件-173: scheme忽略大小写', ev(r, 't', 'http://x.com/') === true);

r = condExpr('scheme ^= "http"', 'google');
assert('条件-174: scheme前缀', ev(r, 't', 'https://x.com/') === true);

r = condExpr('host $= ".example.com" & path *= "/download/" & scheme = "https"', 'google');
assert('条件-175: host&path&scheme组合', ev(r, 't', 'https://dl.example.com/download/x') === true && ev(r, 't', 'http://dl.example.com/download/x') === false);

r = condExpr('!(host $= ".example.com")', 'google');
assert('条件-176: host取反', ev(r, 't', 'https://other.com/') === true && ev(r, 't', 'https://example.com/') === false);

r = condExpr('host $= ".example.com"', 'google');
assert('条件-177: url缺失->假', ev(r, 't', undefined) === false);
r = condExpr('!(host $= ".example.com")', 'google');
assert('条件-178: 取反后url缺失->真', ev(r, 't', undefined) === true);

r = condExpr('path $= ".pdf"', 'google');
assert('条件-179: 非法url->假', ev(r, 't', 'not a url') === false);

r = condExpr('host =~ /x/g', 'google');
assert('条件-180: host正则非法flags', r.errors && r.errors[0].startsWith('flags:g'));
r = condExpr('title =~ /x/I', 'google');
assert('条件-181: 大写I当作i不报错', !r.errors && ev(r, 'X', 'https://x/') === true && ev(r, 'y', 'https://x/') === false);
r = condExpr('host =~ /WWW/I', 'google');
assert('条件-182: host大写I可编译', !r.errors && ev(r, 't', 'https://www.example.com/') === true);

r = condExpr('scheme = "https" | host $= ".org"', 'google');
assert('条件-183: 与或组合', ev(r, 't', 'https://anything/') === true && ev(r, 't', 'http://x.org/') === true && ev(r, 't', 'http://x.com/') === false);

// ---- P0-3: flags u / P1-3: 订阅 frontmatter ----
r = condExpr('title =~ /\\u{4E2D}/u', 'google');
assert('条件-184: title =~ 支持u flag', !r.errors && ev(r, '中文字', 'https://x/') === true);
r = condExpr('url/example/u', 'google');
assert('条件-185: url简写支持u flag', !r.errors && ev(r, 't', 'https://example.com/') === true);
r = condExpr('title =~ /x/u', 'google');
assert('条件-186: flags预检不再拒u', !r.errors);

const stripEmpty = (ls) => ls.map(l => l.trim()).filter(l => l);
const pc1 = m.parseRulesetContent('---\nname: My Rules\n---\n*://*.example.com/*\n');
assert('条件-187: 标准frontmatter剥离', pc1.meta.name === 'My Rules' && stripEmpty(pc1.lines).length === 1 && stripEmpty(pc1.lines)[0] === '*://*.example.com/*');
const pc2 = m.parseRulesetContent('---\nname: "Quoted List"\n---\n/a#b/\n');
assert('条件-188: 引号name', pc2.meta.name === 'Quoted List' && stripEmpty(pc2.lines).length === 1);
const pc3 = m.parseRulesetContent('---\nname: X\n# comment in head\n---\n*://a.com/*\n*://b.com/*\n');
assert('条件-189: 多规则+头内注释行', pc3.meta.name === 'X' && stripEmpty(pc3.lines).length === 2);
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
assert('条件-195: YAML注释跳过', pc9.lines.length === 2 && pc9.lines[0] === '/a/i # trailing' && pc9.lines[1] === 'example.com');
const pc10 = m.parseRulesetContent('blacklist:\n  - *.example.com\nsubscriptions:\n  - url: https://x\n    enabled: true\n');
assert('条件-196: blacklist键+后续段截断', pc10.lines.length === 1 && pc10.lines[0] === '*.example.com');
const pc11 = m.parseRulesetContent('*://a.com/*\nrules:\n');
assert('条件-197: 无列表项不启用YAML模式', stripEmpty(pc11.lines).length === 2);
const pc12 = m.parseRulesetContent('name: Q\nrules:\n  - "*://x.com/*"\n  - \'host $= ".x.com"\'\n');
assert('条件-198: 双引号与单引号项', pc12.meta.name === 'Q' && pc12.lines[0] === '*://x.com/*' && pc12.lines[1] === 'host $= ".x.com"');
const pc13 = m.parseRulesetContent('name: WL\nblacklist:\n  - ads.example.com\nwhitelist:\n  - good.example.com\n  - "@*://keep.example.com/*"\n');
assert('条件-199: whitelist段导入并自动加@', pc13.meta.name === 'WL' && pc13.lines.length === 3 && pc13.lines[0] === 'ads.example.com' && pc13.lines[1] === '@good.example.com' && pc13.lines[2] === '@*://keep.example.com/*');
const pc14 = m.parseRulesetContent('blacklist:\n  - a.com\nrules:\n  - b.com\n');
assert('条件-200: 连续两个list键均提取', pc14.lines.length === 2 && pc14.lines[0] === 'a.com' && pc14.lines[1] === 'b.com');
const pc15 = m.parseRulesetContent('---\nname: Block Sample\nhomepage: https://x\n---\ntitle: A\nurl: https://www.a.com/\nmatches:\n  - *://*.a.com/*\n\ntitle: B\nmatches:\n  - /re\\.com/\n');
assert('条件-201: uBlacklist matches段丢弃(仅元数据返回)', pc15.meta.name === 'Block Sample' && pc15.lines.length === 0);
const pc16 = m.parseRulesetContent('title: A\nmatches:\n  - *://*.b.com/*\n');
assert('条件-202: matches段不残留垃圾行', pc16.lines.length === 0);

r = condExpr('title *= "KW" i', 'google');
assert('条件-203: title包含+i修饰', !r.errors && ev(r, 'contains kw', 'https://x/') === true && ev(r, 'nothing', 'https://x/') === false);
r = condExpr('title $= "Domain" I', 'google');
r = condExpr('title = "AbC" i', 'google');
assert('条件-204: title精确+i', !r.errors && ev(r, 'abc', 'https://x/') === true && ev(r, 'abd', 'https://x/') === false);
r = condExpr('url $= ".PDF" i', 'google');
r = condExpr('host $= ".example.com" i', 'google');
assert('条件-205: host后缀+i', !r.errors && ev(r, 't', 'https://www.EXAMPLE.COM/') === true);
r = condExpr('path ^= "/DO" i', 'google');
r = condExpr('scheme = "HTTPS" i', 'google');
r = condExpr('$site = "GOOGLE" i', 'google');
assert('条件-206: $site+i', r.const === true);
r = condExpr('site = "GOOGLE.COM.HK" i', 'google', 'www.google.com.hk');
r = condExpr('site("GOOGLE.COM.HK") i', 'google', 'www.google.com.hk');
r = condExpr('title *= "a"i', 'google');
assert('条件-207: 紧贴无空格i', !r.errors && ev(r, 'xa', 'https://x/') === true);
r = condExpr('title *= "a" ix', 'google');
assert('条件-208: i后多余字符->unknown', r.errors && r.errors[0].startsWith('unknown'));
r = condExpr('title *= "a" i | title *= "b" i', 'google');
assert('条件-209: 多条件带i或', !r.errors && ev(r, 'xx a', 'https://x/') === true && ev(r, 'zz', 'https://x/') === false);
r = condExpr('title *= "a" i & !(url *= "ads")', 'google');
r = condExpr('url *= "example"', 'google');
assert('条件-210: 无i修饰回归(默认忽略大小写)', !r.errors && ev(r, 't', 'https://EXAMPLE.com/') === true);

// ---- $category 静态折叠 ----
r = condExpr('$category = "web"', 'google', 'www.google.com', 'web');
assert('条件-211: web页命中', r.const === true);
r = condExpr('$category = "images"', 'google', 'www.google.com', 'web');
assert('条件-212: web页images条件恒假', r.const === false);
r = condExpr('$category = "images"', 'google', 'www.google.com', 'images');
assert('条件-213: 图片页命中', r.const === true);
r = condExpr('$category : "videos"', 'google', 'www.google.com', 'videos');
assert('条件-214: 冒号形式', r.const === true);
r = condExpr('$category = "NEWS" i', 'google', 'www.google.com', 'news');
assert('条件-215: 忽略大小写+i修饰', r.const === true);
r = condExpr('$category = "images" & title *= "x"', 'google', 'www.google.com', 'web');
assert('条件-216: 与动态组合在web折叠恒假', r.const === false);
r = condExpr('$category = "images" & title *= "x"', 'google', 'www.google.com', 'images');
assert('条件-217: 图片页剩title条件', !r.const && ev(r, 'xx', 'https://x/') === true && ev(r, 'yy', 'https://x/') === false);
r = condExpr('$category = "web" | $category = "images"', 'google', 'www.google.com', 'web');
assert('条件-218: 多类型或(web)', r.const === true);
r = condExpr('$category = "images" | $category = "videos"', 'google', 'www.google.com', 'web');
assert('条件-219: 多类型或未命中恒假', r.const === false);
r = condExpr('!($category = "images")', 'google', 'www.google.com', 'web');
assert('条件-220: 取反(非图片页)', r.const === true);
r = condExpr('$category = "foo"', 'google', 'www.google.com', 'web');
assert('条件-221: 未知类型值->静态假(不报错)', r.const === false && !r.errors);
r = condExpr('$category = images', 'google');
assert('条件-222: 值未加引号正常识别为合法值', r.const === false && !r.errors);
r = condExpr('$site = "google" & $category = "images"', 'google', 'www.google.com', 'images');
assert('条件-223: $site与$category同时命中', r.const === true);
r = condExpr('$site = "google" & $category = "images"', 'google', 'www.google.com', 'web');
assert('条件-224: $site命中但category不命中', r.const === false);

// ---- 条件表达式识别(行级判定) ----
const condTrueCases = [
  'host $= ".example.com"',
  'path *= "/download/"',
  'title *= "关键词"',
  'title ^= "关键词"',
  'title $= "关键词"',
  'title = "关键词"',
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
  'scheme = https',
  'title *= keyword',
  'title *= 关键词',
  'title*=关键词',
];
condTrueCases.forEach((rule, i) => {
  assert(`条件-225-${i + 1}: 条件表达式识别 ${rule}`, m.looksLikeCondExpr(rule) === true);
});

const condFalseCases = [
  'https://example.com/?url=x',
  'https://example.com/?a=1&title=x',
  'https://example.com/path?host=x',
  'https://example.com/?site=x',
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

// ==== [条件-227~268] @if条件提取与路径冲突 (来源: test-if-cond.cjs) ====
await (async () => {
const fns = [
  'hostLabelToASCII', 'toASCIIHostname', 'safeRegexTest', 'safeDecodeURIComponent', 'stripRuleComment', 'getInvalidRegexFlags', 'parseConditionPart',
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
return { findIfOccurrences, extractIfConditions, stripIfConditions, extractBalancedParens, validateRule };
`;
const api = new Function(moduleBody)();


// ---- @if 括号提取 ----
const src1 = '@if(title *= "a)b")';
const p1 = api.extractBalancedParens(src1, 3);
assert('条件-227: 双引号内右括号不截断', !!p1 && p1.content === 'title *= "a)b"');
assert('条件-228: endIndex 到真正的右括号', !!p1 && p1.endIndex === src1.length);

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

const p8 = api.extractBalancedParens('@if(title *= "a(b")', 3);
assert('条件-234: 引号内左括号不增加深度', !!p8 && p8.content === 'title *= "a(b"');

assert('条件-235: 真正不闭合返回 null', api.extractBalancedParens('@if((title *= "a")', 3) === null);

const s1 = api.stripIfConditions('*://x/* @if(title *= "a)b")');
assert('条件-236: 剥离后核心规则与条件通过', s1.coreRule === '*://x/*' && s1.staticPass === true);

const s2 = api.stripIfConditions('*://x/* @if(title =~ /\\(a/)');
assert('条件-237: 转义括号条件可剥离', s2.coreRule === '*://x/*' && s2.staticPass === true);

const s3 = api.stripIfConditions('*://x/* @if(title *= "a)b") @if(url *= "x")');
assert('条件-238: 多个 @if 均正确剥离', s3.coreRule === '*://x/*');

// ---- 引号/正则体内 @if 扫描 ----
let s = api.stripIfConditions('*://x.com/* @if(title *= "@if(y)")');
assert('条件-239: 引号内 @if 不产生伪剥离', s.coreRule === '*://x.com/*' && s.staticPass === true);
let c = api.extractIfConditions('*://x.com/* @if(title *= "@if(y)")');
assert('条件-240: 引号内 @if 不产生伪条件', c.length === 1 && c[0] === 'title *= "@if(y)"');
assert('条件-241: 引号内 @if 规则校验通过', api.validateRule('*://x.com/* @if(title *= "@if(y)")') === true);

s = api.stripIfConditions('title/foo@if(bar)/');
assert('条件-242: title 正则体内 @if 不被剥离', s.coreRule === 'title/foo@if(bar)/');
assert('条件-243: title 正则体内 @if 规则校验通过', api.validateRule('title/foo@if(bar)/') === true);

s = api.stripIfConditions('*://example.com/api/@if(test)/*');
assert('条件-244: URL路径内 @if( 不被误判剥离', s.coreRule === '*://example.com/api/@if(test)/*');
assert('条件-245: URL路径内 @if( 规则校验通过', api.validateRule('*://example.com/api/@if(test)/*') === true);

s = api.stripIfConditions('*://x.com/* @if(title =~ /a@if(b)/)');
assert('条件-246: 条件正则体内 @if 不产生伪剥离', s.coreRule === '*://x.com/*');
c = api.extractIfConditions('*://x.com/* @if(title =~ /a@if(b)/)');
assert('条件-247: 条件正则体内 @if 不产生伪条件', c.length === 1 && c[0] === 'title =~ /a@if(b)/');

s = api.stripIfConditions('*://x.com/* @if(title *= "@if(y)") @if($site="google")');
assert('条件-248: 混合多条件核心规则正确', s.coreRule === '*://x.com/*' && s.staticPass === true);
c = api.extractIfConditions('*://x.com/* @if(title *= "@if(y)") @if($site="google")');
assert('条件-249: 混合多条件数量正确', c.length === 2 && c[0] === 'title *= "@if(y)"' && c[1] === '$site="google"');

s = api.stripIfConditions('title/.*示例.*/ @if($site = "google")');
assert('条件-250: 前导正则后的 @if 正常剥离', s.coreRule === 'title/.*示例.*/' && s.staticPass === true);

s = api.stripIfConditions('host/\\.example\\.com$/i @if(title *= "x")');
assert('条件-251: 表达式正则后的 @if 正常剥离', s.coreRule === 'host/\\.example\\.com$/i' && s.staticPass === true);

s = api.stripIfConditions('*://x.com/?q=~/foo @if(title *= "x")');
assert('条件-252: URL查询含=~/不误判正则', s.coreRule === '*://x.com/?q=~/foo' && s.staticPass === true);
s = api.stripIfConditions('example.com/?q=~/foo @if(title *= "x")');
assert('条件-253: 无协议URL含=~/仍识别@if', s.coreRule === 'example.com/?q=~/foo' && s.staticPass === true);
s = api.stripIfConditions('*://x.com/* @if(url =~ /ad/) @if(title *= "x")');
assert('条件-254: URL模式后合法=~正则条件不受影响', s.coreRule === '*://x.com/*' && s.staticPass === true);

assert('条件-255: 未闭合条件仍报错', api.validateRule('*://x.com/* @if((title *= "a")') === false);
assert('条件-256: 未闭合条件不剥离', api.stripIfConditions('*://x.com/* @if((title *= "a")').coreRule === '*://x.com/* @if((title *= "a")');

// ---- URL 路径含关键字段不误吞 @if(回归) ----
const pathConflictCases = [
  '*://x.com/title/y @if(title *= "a")',
  '*://x.com/a/url/y @if(title *= "a")',
  '*://x.com/scheme/y @if(title *= "a")',
  '*://x.com/a/title/b/url/c @if(url *= "q")',
];
pathConflictCases.forEach((rule, i) => {
  const occ = api.findIfOccurrences(rule);
  assert(`条件-257-${i + 1}: @if检测 ${rule}`, occ.length === 1);
  const stripped = api.stripIfConditions(rule);
  const expectedCore = rule.replace(/ @if\(.*\)$/, '');
  assert(`条件-258-${i + 1}: 剥离后保留核心 ${rule}`, stripped.coreRule === expectedCore && stripped.staticPass === true);
  assert(`条件-259-${i + 1}: 规则校验通过 ${rule}`, api.validateRule(rule) === true);
});

s = api.stripIfConditions('*://x.com/url/* @if(title *= "a") @if($site = "google")');
assert('条件-260: 多@if与路径冲突同时剥离', s.coreRule === '*://x.com/url/*' && s.staticPass === true);

const noOccCases = [
  'url/foo@if(bar)/',
  '@url/foo@if(bar)/i',
  'title/foo@if(bar)/',
  '@1 title/foo@if(bar)/i',
];
noOccCases.forEach((rule, i) => {
  assert(`条件-261-${i + 1}: 行首简写正则体内 @if 不产生伪条件 ${rule}`, api.findIfOccurrences(rule).length === 0);
});

s = api.stripIfConditions('scheme/https?\\/\\// @if(title *= "x")');
assert('条件-262: 行首 scheme 简写正则后的 @if 正常剥离', s.coreRule === 'scheme/https?\\/\\//' && s.staticPass === true);
s = api.stripIfConditions('path/\\/download/ @if(title *= "x")');
assert('条件-263: 行首 path 简写正则后的 @if 正常剥离', s.coreRule === 'path/\\/download/' && s.staticPass === true);

s = api.stripIfConditions('*://x/* @if(url/foo@if(bar)/)');
assert('条件-264: 条件内 url 简写正则含 @if 文本正常', s.coreRule === '*://x/*' && s.staticPass === true);
c = api.extractIfConditions('*://x/* @if(url/foo@if(bar)/)');
assert('条件-265: 条件完整提取', c.length === 1 && c[0] === 'url/foo@if(bar)/');
assert('条件-266: 规则校验通过', api.validateRule('*://x/* @if(url/foo@if(bar)/)') === true);

s = api.stripIfConditions('*://x/* @if(title/foo@if(bar)/)');
assert('条件-267: 条件内 title 简写正则含 @if 文本正常', s.coreRule === '*://x/*' && s.staticPass === true);
assert('条件-268: 规则校验通过', api.validateRule('*://x/* @if(title/foo@if(bar)/)') === true);
})();

// ==== [条件-269~383] 独立表达式 (来源: test-standalone-expr.cjs) ====
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

// ---- 识别 ----
assert('条件-269: host后缀像表达式', m.looksLikeCondExpr('host $= ".example.com"') === true);
assert('条件-270: path包含像表达式', m.looksLikeCondExpr('path *= "/download/"') === true);
assert('条件-271: 组合像表达式', m.looksLikeCondExpr('host $= ".example.com" & path *= "/download/"') === true);
assert('条件-272: 取反像表达式', m.looksLikeCondExpr('!title *= "ad"') === true);
assert('条件-273: 域名不像表达式', m.looksLikeCondExpr('example.com') === false);
assert('条件-274: URL通配不像表达式', m.looksLikeCondExpr('*://*.example.com/*') === false);
assert('条件-275: title/正则不像表达式', m.looksLikeCondExpr('title/foo/i') === false);
assert('条件-276: text/不像表达式', m.looksLikeCondExpr('text/ad/') === false);
assert('条件-277: 裸正则不像表达式', m.looksLikeCondExpr('/example\\.com/') === false);
assert('条件-278: host简写正则像表达式', m.looksLikeCondExpr('host/\\.example\\.com$/i') === true);
assert('条件-279: 取反冒号条件', m.looksLikeCondExpr('!title:foo') === true && m.looksLikeCondExpr('!url:https://x') === true);
assert('条件-280: Adblock元数据仍被排除', m.looksLikeCondExpr('! Title: Some List') === false && m.looksLikeCondExpr('! URL: https://x') === false);

// ---- 解析 ----
let p = m.parseRuleWithConditions('host $= ".example.com"');
assert('条件-281: 独立host无core', p.coreRule === '' && p.staticPass === true && p.dynamicConditions.length === 1);
assert('条件-282: host裸域命中', m.evalCondAST(p.dynamicConditions[0], 't', 'https://example.com/') === true);

p = m.parseRuleWithConditions('path *= "/download/"');
assert('条件-283: 独立path', p.coreRule === '' && p.staticPass && p.dynamicConditions.length === 1);
assert('条件-284: path命中', m.evalCondAST(p.dynamicConditions[0], 't', 'https://x.com/download/a') === true);

p = m.parseRuleWithConditions('host $= ".example.com" & path *= "/download/"');
assert('条件-285: 组合表达式', p.coreRule === '' && p.staticPass && p.dynamicConditions.length === 1);
assert('条件-286: 双条件命中', m.evalCondAST(p.dynamicConditions[0], 't', 'https://dl.example.com/download/x') === true);

p = m.parseRuleWithConditions('@host $= ".example.com"');
assert('条件-287: 白名单独立表达式', p.coreRule === '@' && p.staticPass && p.dynamicConditions.length === 1);

p = m.parseRuleWithConditions('host $= ".example.com" @if(title *= "kw")');
assert('条件-288: 独立表达式+@if', p.coreRule === '' && p.staticPass && p.dynamicConditions.length === 2);
assert('条件-289: 双条件都真', m.checkDynamicConditions(p.dynamicConditions, 'has kw', 'https://example.com/') === true);

p = m.parseRuleWithConditions('example.com');
assert('条件-290: 普通域名不吸收', p.coreRule === 'example.com' && p.dynamicConditions.length === 0 && p.staticPass);

p = m.parseRuleWithConditions('*://*.example.com/*');
assert('条件-291: URL通配不吸收', p.coreRule === '*://*.example.com/*' && p.dynamicConditions.length === 0);

p = m.parseRuleWithConditions('title/foo/i');
assert('条件-292: title正则不吸收', p.coreRule === 'title/foo/i' && p.dynamicConditions.length === 0);

p = m.parseRuleWithConditions('*://*.example.com/* @if(title *= "kw")');
assert('条件-293: 旧复合规则仍剥离@if', p.coreRule === '*://*.example.com/*' && p.dynamicConditions.length === 1);

p = m.parseRuleWithConditions('@if(host $= ".example.com")');
assert('条件-294: 仅@if行视为表达式', p.coreRule === '' && p.staticPass && p.dynamicConditions.length === 1);

p = m.parseRuleWithConditions(m.stripRuleComment('host $= ".example.com" # note'));
assert('条件-295: 注释剥离后解析', p.coreRule === '' && p.staticPass && p.dynamicConditions.length === 1);

p = m.parseRuleWithConditions('title *= "kw" | url $= ".pdf"');
assert('条件-296: 标题或url后缀', p.coreRule === '' && p.staticPass);
assert('条件-297: 标题命中', m.evalCondAST(p.dynamicConditions[0], 'has kw', 'https://x.com/a.html') === true);
assert('条件-298: url命中', m.evalCondAST(p.dynamicConditions[0], 'plain', 'https://x.com/a.pdf') === true);

p = m.parseRuleWithConditions('host/\\.example\\.com$/i');
assert('条件-299: host简写正则', p.coreRule === '' && p.staticPass);

p = m.parseRuleWithConditions('!title *= "ad"');
assert('条件-300: 独立取反', p.coreRule === '' && p.staticPass);
assert('条件-301: 无ad命中', m.evalCondAST(p.dynamicConditions[0], 'normal', 'https://x.com/') === true);

p = m.parseRuleWithConditions('$site = "google"');
assert('条件-302: $site在google折叠恒真', p.coreRule === '' && p.staticPass && p.dynamicConditions.length === 0);

m.setEngine('bing', 'www.bing.com');
p = m.parseRuleWithConditions('$site = "google"');
assert('条件-303: $site在bing静态丢弃', p.staticPass === false);
m.setEngine('google', 'www.google.com');

p = m.parseRuleWithConditions('scheme = "https"');
assert('条件-304: scheme独立', p.coreRule === '' && p.staticPass);
assert('条件-305: https命中', m.evalCondAST(p.dynamicConditions[0], 't', 'https://x.com/') === true);

p = m.parseRuleWithConditions('host $= ".example.com" i');
assert('条件-306: 独立表达式兼容i修饰', p.coreRule === '' && p.staticPass);

// ---- 校验 ----
assert('条件-307: host独立规则有效', m.analyzeRule('host $= ".example.com"').valid === true);
assert('条件-308: 白名单独立有效', m.analyzeRule('@host $= ".example.com"').valid === true);
assert('条件-309: 高亮独立有效', m.analyzeRule('@1 path $= ".pdf"').valid === true);
assert('条件-310: 域名规则仍有效', m.analyzeRule('example.com').valid === true);
assert('条件-311: URL通配仍有效', m.analyzeRule('*://*.example.com/*').valid === true);
assert('条件-312: 残缺表达式无效', m.analyzeRule('host $= ').valid === false);
assert('条件-313: 未知字段无效', m.analyzeRule('foo $= "bar"').valid === false);
assert('条件-314: 独立+行尾注释有效', m.analyzeRule('host $= ".example.com" # x').valid === true);
assert('条件-315: 仅@if行有效', m.analyzeRule('@if(path *= "/download/")').valid === true);
assert('条件-316: 空@if仍无效', m.analyzeRule('@if()').valid === false);
assert('条件-317: title包含独立有效', m.analyzeRule('title *= "广告"').valid === true);
assert('条件-318: 高亮越界仍无效', m.analyzeRule('@9 host $= ".example.com"').valid === false);
assert('条件-319: 复合旧写法仍有效', m.analyzeRule('*://*.example.com/* @if(title *= "kw")').valid === true);
assert('条件-320: $category规则有效', m.analyzeRule('*://*.amazon.com/* @if($category = "images")').valid === true);
assert('条件-321: $category独立表达式有效', m.analyzeRule('$category = "images"').valid === true);
assert('条件-322: 高亮+白名单组合无效', m.analyzeRule('@1 @*://*.example.com/*').valid === false);
assert('条件-323: 高亮+白名单表达式无效', m.analyzeRule('@1 @host $= ".example.com"').valid === false);
assert('条件-324: 高亮+@if仍有效', m.analyzeRule('@1 path $= ".pdf" @if($site = "google")').valid === true);

// ---- @if 检测范围扩大回归(regex/title/text 前缀同样校验) ----
const exValidCases = [
  ['E1', '/example\\.(com|net)/ @if(title *= "kw")'],
  ['E2', '/example\\.com/i @if($site = "google")'],
  ['E3', 'title/.*kw.*/ @if(title *= "x")'],
  ['E4', 'title/.*kw.*/i @if($site = "google")'],
  ['E5', 'text/.*ad.*/ @if($site = "google" | $site = "bing")'],
  ['E6', '@1 title/.*demo.*/ @if(path *= "/download/")'],
  ['E7', '@2 /example/ @if(title *= "x" & !(url *= "y"))'],
  ['E8', '/foo@if(bar)/'],
  ['E9', 'title/a@if(b)/i'],
  ['E10', 'title/a[/@if(b)]c/ @if(title *= "x")'],
  ['E11', 'title/a\\/b/ @if(title *= "x")'],
  ['E12', 'title/x/i @if(url ^= "https")'],
  ['E13', '@3 text/x/ @if($category = "images")'],
  ['E14', '@title/.*kw.*/ @if(title *= "x")'],
  ['E15', 'title/x/ @if($site = "bing")'],
  ['E16', 'text/x/ @if(host $= ".example.com")'],
];
exValidCases.forEach(([name, rule]) => {
  const a = m.analyzeRule(rule);
  assert(name + ': 合法规则不误杀(' + rule + ')', a.valid === true, a.errors);
});
const pc1 = m.parseRuleWithConditions('/example\\.(com|net)/ @if(title *= "kw")');
assert('条件-325: 编译保留1个动态条件', pc1.staticPass === true && pc1.dynamicConditions.length === 1);
const pc2 = m.parseRuleWithConditions('/example\\.com/i @if($site = "google")');
assert('条件-326: $site静态真折叠', pc2.staticPass === true && pc2.dynamicConditions.length === 0 && pc2.coreRule === '/example\\.com/i');
const pc3 = m.parseRuleWithConditions('title/.*kw.*/ @if(title *= "x")');
assert('条件-327: title规则@if动态条件', pc3.staticPass === true && pc3.dynamicConditions.length === 1);
const pc4 = m.parseRuleWithConditions('/foo@if(bar)/');
assert('条件-328: 正则体内@if不提取', pc4.staticPass === true && pc4.dynamicConditions.length === 0 && pc4.coreRule === '/foo@if(bar)/');
const pc5 = m.parseRuleWithConditions('title/a@if(b)/i');
assert('条件-329: title正则体内@if不提取', pc5.staticPass === true && pc5.dynamicConditions.length === 0 && pc5.coreRule === 'title/a@if(b)/i');
const pc6 = m.parseRuleWithConditions('title/x/ @if($site = "bing")');
assert('条件-330: 静态假$site编译丢弃', pc6.staticPass === false && pc6.dynamicConditions.length === 0);

const exInvalidCases = [
  ['F1', 'title/x/ @if(foo $= "bar")'],
  ['F2', '/x/ @if(title *= "a" | )'],
  ['F3', 'title/x/ @if(title =~ /bad(/)'],
  ['F4', 'text/x/ @if()'],
  ['F5', 'title/x/ @if(title *= "a" & )'],
  ['F6', '@1 /x/ @if(unknownfield = "v")'],
];
exInvalidCases.forEach(([name, rule]) => {
  const a = m.analyzeRule(rule);
  assert(name + ': 损坏的@if报错(' + rule + ')', a.valid === false && a.errors.length > 0);
  const pr = m.parseRuleWithConditions(rule);
  assert(name + 'b: 编译路径同样丢弃', pr.staticPass === false);
});

m.setEngine('google', 'www.google.com', 'web');
p = m.parseRuleWithConditions('*://*.amazon.com/* @if($category = "images")');
assert('条件-331: web页$category=images静态丢弃', p.staticPass === false);
m.setEngine('google', 'www.google.com', 'images');
p = m.parseRuleWithConditions('*://*.amazon.com/* @if($category = "images")');
assert('条件-332: 图片页$category通过且无动态条件', p.staticPass === true && p.coreRule === '*://*.amazon.com/*' && p.dynamicConditions.length === 0);
m.setEngine('google', 'www.google.com', 'web');

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
assert('条件-335: 裸域也屏蔽', isBlocked(doCheck(cr, 'https://example.com/', 'example.com', 't', null, ['example.com'])));

cr = makeCR();
addExpr(cr, 'path *= "/download/"');
assert('条件-336: 独立path屏蔽', isBlocked(doCheck(cr, urlEx, 'www.example.com', 't', null, slEx)));

cr = makeCR();
addExpr(cr, 'host $= ".example.com" & path *= "/download/"');
assert('条件-337: 组合命中', isBlocked(doCheck(cr, urlEx, 'www.example.com', 't', null, slEx)));

cr = makeCR();
addExpr(cr, 'title *= "广告"');
assert('条件-338: 独立title屏蔽', isBlocked(doCheck(cr, urlOther, 'other.net', '含广告标题', null, slOther)));

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

cr = makeCR();
addExpr(cr, 'host $= ".example.com"', '订阅规则1');
r = doCheck(cr, urlEx, 'www.example.com', 't', null, slEx);
assert('条件-341: 订阅独立表达式可屏蔽', isBlocked(r) && r.source === '订阅规则1');

cr = makeCR();
addExpr(cr, 'url $= ".pdf"');
assert('条件-342: 独立url后缀', isBlocked(doCheck(cr, 'https://x.com/a.pdf', 'x.com', 't', null, ['x.com'])));

cr = makeCR();
addExpr(cr, 'scheme = "http"');
assert('条件-343: 独立http协议', isBlocked(doCheck(cr, 'http://x.com/', 'x.com', 't', null, ['x.com'])));

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
addWlExpr(cr, '@host $= ".example.com"');
cr.domains.set('example.com', [{type: 'wildcard', originalRule: 'example.com', source: '订阅规则1'}]);
assert('条件-351: 本地表达式白名单 > 订阅域名黑名单', !isBlocked(doCheck(cr, urlEx, 'www.example.com', 't', null, slEx)));

cr = makeCR();
addWlExpr(cr, '@host $= ".example.com"', '订阅规则1');
addExpr(cr, 'host $= ".example.com"', '订阅规则1');
assert('条件-352: 订阅表达式白名单 > 订阅表达式黑名单', !isBlocked(doCheck(cr, urlEx, 'www.example.com', 't', null, slEx)));

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

cr = makeCR();
addWlExpr(cr, '@path *= "/safe/"', '订阅规则1');
addExpr(cr, 'host $= ".example.com"', '订阅规则1');
assert('条件-362: 订阅路径白名单 > 订阅host黑名单', !isBlocked(doCheck(cr, 'https://www.example.com/safe/a', 'www.example.com', 't', null, slEx)));
assert('条件-363: 订阅路径白名单未命中则订阅host仍屏蔽', isBlocked(doCheck(cr, urlEx, 'www.example.com', 't', null, slEx)));

cr = makeCR();
addWlExpr(cr, '@host $= ".example.com"');
addExpr(cr, 'path *= "/download/"', '订阅规则1');
assert('条件-364: 本地host白名单压过订阅path黑名单', !isBlocked(doCheck(cr, urlEx, 'www.example.com', 't', null, slEx)));

cr = makeCR();
addExpr(cr, 'path *= "/download/"');
addWlExpr(cr, '@host $= ".example.com"', '订阅规则1');
r = doCheck(cr, urlEx, 'www.example.com', 't', null, slEx);
assert('条件-365: 本地path黑名单压过订阅host白名单', isBlocked(r) && r.source === '本地规则');

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

// ---- 修复回归: @if(...) 组后独立正则的上下文恢复 ----
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
  assert('条件-374: @if组后title/前缀正则内#保留', sr('@if(a) title/ab[ #]cd/') === '@if(a) title/ab[ #]cd/');
  assert('条件-375: URL通配符中字面@if(不被当条件组', sr('*://example.com/api/@if(test)/* # c') === '*://example.com/api/@if(test)/*');
  assert('条件-376(对照): @前缀简写规则注释剥离不受影响', sr('@ *://x/* # c') === '@ *://x/*');
  assert('条件-377(对照): @@前缀注释剥离不受影响', sr('@@example.com # c') === '@@example.com');
  assert('条件-378(对照): @N前缀注释剥离不受影响', sr('@1 *://example.com/* # note') === '@1 *://example.com/*');
  assert('条件-379: 连续@if组后正则上下文恢复', sr('@if(a) @if(b) /ab[ #]cd/ # note') === '@if(a) @if(b) /ab[ #]cd/');
  assert('条件-380: @if组后正则体内@if(...)不被剥离为条件', api.stripIfConditions('@if(engine=google) /x[ @if(y)]z/').coreRule === '/x[ @if(y)]z/');
  assert('条件-381: @if组后正则体内@if(不产生伪条件', api.findIfOccurrences('@if(a) /x@if(b)y/').length === 1);
  assert('条件-382: @if组后text/正则体内@if(不产生伪条件', api.findIfOccurrences('@if(a) text/x[ @if(b)]y/').length === 1);
  assert('条件-383(对照): 无@if正则行为不变', sr('/ab[ #]cd/ # note') === '/ab[ #]cd/');
}

// ==== [条件-384~391] 修复回归: path/host 单斜杠裸值 / 订阅!独立条件识别 ====
{
  const consts2 = src.match(/const SUPPORTED_REGEX_FLAGS = 'imsu';/)[0];
  const env = new Function(
    consts2 + '\n' + ['safeRegexTest', 'safeDecodeURIComponent', 'getInvalidRegexFlags', 'parseConditionPart', 'tokenizeCondExpr', 'parseCondExprTokens', 'analyzeCondExpr', 'foldCondExpr', 'evalDynamicLeaf', 'evalCondAST', 'isCondExprCore', 'looksLikeCondExpr'].map((n) => extractFn(src, n)).join('\n') +
    '\nreturn { analyzeCondExpr, looksLikeCondExpr };'
  )();
  const errs = (s) => env.analyzeCondExpr(s, 'google', 'www.google.com', 'web').errors.length;
  assert('条件-384: path ^= /search 正常解析为字符串比较无语法错误', errs('path ^= /search') === 0);
  assert('条件-385: host ^= /x 同样正常解析', errs('host ^= /x') === 0);
  assert('条件-386(对照): 加引号后正常', errs('path ^= "/search"') === 0);
  assert('条件-387(对照): 裸值恰含第二个斜杠时正常', errs('path *= /download/') === 0);
  assert('条件-388(对照): "! url: x" 被当作uBlock元数据过滤', env.looksLikeCondExpr('! url: a.com') === false);
  assert('条件-389(对照): "! title: x" 同样被过滤', env.looksLikeCondExpr('! title: a') === false);
  assert('条件-390(已修复): "! host: a.com" 元数据行不再误判为条件', env.looksLikeCondExpr('! host: a.com') === false);
  assert('条件-391(对照): 无空格的 "!site: x" 可识别', env.looksLikeCondExpr('!site: a.com') === true);
}

// ==== [条件-392~400] 复核: 多斜杠裸值词法完整性 / 裸值内未配对括号 ====
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

  // 疑点: 词法器 canStartRegex 前瞻闭合斜杠与实际闭合斜杠不一致导致值被破坏(/en/us -> /enus/)
  let tk = env2.tokenizeCondExpr('path ^= /en/us');
  assert('条件-392: 多斜杠裸值token完整不被破坏', !tk.error && tk.tokens.length === 1 && tk.tokens[0] === 'path ^= /en/us', tk.tokens);
  let r = cond2('path ^= /en/us');
  assert('条件-393: 多斜杠裸值前缀命中真实路径', !r.errors && ev2(r, 't', 'https://x.com/en/us/list') === true);
  assert('条件-394: 未发生/enus/式破坏(该误值不命中)', !r.errors && ev2(r, 't', 'https://x.com/enus/list') === false);
  r = cond2('path ^= /en/us/');
  assert('条件-395: 尾斜杠多级裸值前缀命中', !r.errors && ev2(r, 't', 'https://x.com/en/us/list') === true);
  r = cond2('path = /a/b');
  assert('条件-396: 双斜杠裸值精确匹配', !r.errors && ev2(r, 't', 'https://x.com/a/b') === true && ev2(r, 't', 'https://x.com/a/b/c') === false);
  r = cond2('path ^= /en/us & title *= "x"');
  assert('条件-397: 多斜杠值后逻辑组合正常切分', !r.errors && r.ast && r.ast.type === 'and' && ev2(r, 'x', 'https://x.com/en/us/1') === true && ev2(r, 'y', 'https://x.com/en/us/1') === false);
  tk = env2.tokenizeCondExpr('path ^= /a & b/ & title *= "y"');
  assert('条件-398(对照): 裸值内空格与&被正则态保留且后续组合正确', !tk.error && tk.tokens.length === 3 && tk.tokens[0] === 'path ^= /a & b/', tk.tokens);

  // 疑点: 裸值内未配对括号被 @if 结构括号计数误判(引号内不受影响)
  const bp = env2.extractBalancedParens;
  assert('条件-399(已知问题): 裸值内未配对(致@if括号提取失败', bp('@if(path=/a(b/)', 3) === null);
  assert('条件-400(对照): 引号值内括号不参与结构计数', bp('@if(path="/a(b")', 3) && bp('@if(path="/a(b")', 3).content === 'path="/a(b"');
}

// ==== [条件-401~405] 订阅YAML格式自动检测回归 (段键优先进入YAML; 首个合法规则行判定为纯文本并停止扫描; 纯文本不被杂键截断) ====
await (async () => {
const src2 = src;
const fns2 = ['hostLabelToASCII', 'toASCIIHostname', 'punycodeDecodeLabel', 'toUnicodeHostname', 'safeRegexTest', 'safeDecodeURIComponent', 'stripRuleComment', 'getInvalidRegexFlags', 'parseConditionPart', 'tokenizeCondExpr', 'parseCondExprTokens', 'analyzeCondExpr', 'foldCondExpr', 'evalDynamicLeaf', 'evalCondAST', 'extractBalancedParens', 'findIfOccurrences', 'stripIfConditions', 'evaluateCondition', 'isCondExprCore', 'looksLikeCondExpr', 'absorbStandaloneExpr', 'parseRuleWithConditions', 'validateUrlWildcard', 'ruleToRegex', 'parsePrefixedRegexRule', 'escapeWildcardPart', 'splitHostAndPort', 'escapeHostPart', 'wildcardToRegex', 'matchWildcardDomainPattern', 'extractSimpleWhitelistDomain', 'matchSimpleDomain', 'compileRuleRegex', 'checkDynamicConditions', 'getSubdomainLevels', 'matchDomainEntryType', 'extractYamlRuleItems', 'parseRulesetContent', 'extractIfConditions', 'validateCondition', 'analyzeRule', 'validateRule'].map((n) => extractFn(src2, n));
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

const pblock = pc('title: A\nurl: https://www.a.com/\nmatches:\n  - *://*.a.com/*\n');
assert('条件-404: 无frontmatter旧版title块进YAML但matches项不导入', pblock.lines.length === 0);

const pcond = pc('host $= ".example.com"\nmatches:\n- x.com\n');
assert('条件-405: 首行独立条件表达式按纯文本保留', nonEmpty(pcond.lines).length === 3 && nonEmpty(pcond.lines)[0] === 'host $= ".example.com"');
})();

// ==== [审查A] 已知问题留档: 小写"!字段:"元数据行被当作取反独立条件 (条件-390设计取舍的碰撞风险, 仅断言当前行为) ====
{
  const envA = new Function(
    src.match(/const SUPPORTED_REGEX_FLAGS = 'imsu';/)[0] + '\n' +
    ['hostLabelToASCII', 'toASCIIHostname', 'punycodeDecodeLabel', 'toUnicodeHostname', 'safeRegexTest', 'safeDecodeURIComponent', 'getInvalidRegexFlags', 'parseConditionPart', 'tokenizeCondExpr', 'parseCondExprTokens', 'analyzeCondExpr', 'foldCondExpr', 'evalDynamicLeaf', 'evalCondAST', 'extractBalancedParens', 'findIfOccurrences', 'stripIfConditions', 'evaluateCondition', 'isCondExprCore', 'looksLikeCondExpr', 'absorbStandaloneExpr', 'parseRuleWithConditions'].map((n) => extractFn(src, n)).join('\n') +
    '\nconst window = { location: { hostname: "www.google.com" } };' +
    '\nfunction getSearchEngine() { return "google"; }' +
    '\nfunction getSearchCategory() { return "web"; }' +
    '\nreturn { parseRuleWithConditions, evalCondAST };'
  )();
  const pa = envA.parseRuleWithConditions('! host: example.com');
  assert('审查A-4(已修复): 小写"! host:"元数据行不再被解析为取反独立条件', pa.dynamicConditions.length === 0 && pa.standaloneExpr === false);
}

// ==== [条件-406~410] host $= 端口条件点号边界回归 / 已知问题留档: 独立表达式不识别site(...) / *= 正则裸值遭行内注释截断 (仅断言当前行为) ====
{
  const envC = new Function(
    src.match(/const SUPPORTED_REGEX_FLAGS = 'imsu';/)[0] + '\n' +
    ['hostLabelToASCII', 'toASCIIHostname', 'punycodeDecodeLabel', 'toUnicodeHostname', 'safeRegexTest', 'safeDecodeURIComponent', 'getInvalidRegexFlags', 'parseConditionPart', 'tokenizeCondExpr', 'parseCondExprTokens', 'analyzeCondExpr', 'foldCondExpr', 'evalDynamicLeaf', 'evalCondAST', 'extractBalancedParens', 'findIfOccurrences', 'stripIfConditions', 'evaluateCondition', 'isCondExprCore', 'looksLikeCondExpr', 'absorbStandaloneExpr', 'parseRuleWithConditions', 'stripRuleComment'].map((n) => extractFn(src, n)).join('\n') +
    '\nconst window = { location: { hostname: "www.google.com" } };' +
    '\nfunction getSearchEngine() { return "google"; }' +
    '\nfunction getSearchCategory() { return "web"; }' +
    '\nreturn { parseRuleWithConditions, evalCondAST, looksLikeCondExpr, stripRuleComment };'
  )();
  const portCond = envC.parseRuleWithConditions('host $= "example.com:8080"');
  assert('条件-406-1: host $= "example.com:8080" 保持点号边界(badexample.com:8080 不命中)', envC.evalCondAST(portCond.dynamicConditions[0], 't', 'http://badexample.com:8080/') === false);
  assert('条件-406-2(对照): host $= "example.com:8080" 仍命中裸域与子域', envC.evalCondAST(portCond.dynamicConditions[0], 't', 'http://example.com:8080/') === true && envC.evalCondAST(portCond.dynamicConditions[0], 't', 'http://sub.example.com:8080/') === true);
  assert('条件-406-3(对照): host $= ":8080" 纯端口条件仍命中任意带端口URL', envC.evalCondAST(envC.parseRuleWithConditions('host $= ":8080"').dynamicConditions[0], 't', 'http://badexample.com:8080/') === true);
  assert('条件-407(对照): 无端口时点号边界正常(badexample.com 不命中 example.com)', envC.evalCondAST(envC.parseRuleWithConditions('host $= "example.com"').dynamicConditions[0], 't', 'http://badexample.com/') === false);
  assert('条件-408(已知问题): 独立表达式不识别site(...)括号形式(与@if内行为不一致)', envC.looksLikeCondExpr('site("google.com.hk") & path *= "/download/"') === false);
  assert('条件-409(已知问题): 独立条件*=正则裸值遇" # "被行内注释截断且截断后静默合法', envC.stripRuleComment('url *= /a # b/') === 'url *= /a');
  assert('条件-410(对照): =~形式正则裸值受保护不被注释截断', envC.stripRuleComment('url =~ /a # b/') === 'url =~ /a # b/');
  assert('条件-411(已知问题): host =~ /:8080$/ 正则不感知端口(与字符串op不一致)', envC.evalCondAST(envC.parseRuleWithConditions('host =~ /:8080$/').dynamicConditions[0], 't', 'http://sub.example.com:8080/') === false);
  assert('条件-412(已知问题): 空字符串 url *= "" 命中所有URL(与正则空模式被拒不一致)', envC.evalCondAST(envC.parseRuleWithConditions('url *= ""').dynamicConditions[0], 't', 'https://example.com/') === true);
}

// ==== [复审C-*] 第二轮审查新发现留档 (仅断言当前行为) ====
{
  const envD = new Function(
    src.match(/const SUPPORTED_REGEX_FLAGS = 'imsu';/)[0] + '\n' +
    ['hostLabelToASCII', 'toASCIIHostname', 'punycodeDecodeLabel', 'toUnicodeHostname', 'safeRegexTest', 'safeDecodeURIComponent', 'getInvalidRegexFlags', 'parseConditionPart', 'tokenizeCondExpr', 'parseCondExprTokens', 'analyzeCondExpr', 'foldCondExpr', 'evalDynamicLeaf', 'evalCondAST', 'extractBalancedParens', 'findIfOccurrences', 'stripIfConditions', 'evaluateCondition', 'isCondExprCore', 'looksLikeCondExpr', 'absorbStandaloneExpr', 'parseRuleWithConditions'].map((n) => extractFn(src, n)).join('\n') +
    '\nconst window = { location: { hostname: "lite.duckduckgo.com" } };' +
    '\nfunction getSearchEngine() { return "duckduckgo_lite"; }' +
    '\nfunction getSearchCategory() { return "web"; }' +
    '\nreturn { parseRuleWithConditions, evalCondAST };'
  )();
  const liteRule = envD.parseRuleWithConditions('*://*.example.com/* @if($site = "duckduckgo")');
  assert('复审C-1(新发现): $site = "duckduckgo"在duckduckgo_lite站点静态命中(与"lite使用独立ID"文档相悖, 无法表达仅主站)', liteRule.staticPass === true && liteRule.dynamicConditions.length === 0);
  const urlCond = envD.parseRuleWithConditions('url *= "例子.com"').dynamicConditions[0];
  const hostCond = envD.parseRuleWithConditions('host $= ".例子.com"').dynamicConditions[0];
  assert('复审C-2(新发现): url条件不做IDN/punycode归一, 中文域名字面条件对punycode URL静默漏命中', envD.evalCondAST(urlCond, 't', 'https://xn--fsqu00a.com/') === false);
  assert('复审C-2(对照): host条件对同一URL命中(README 2.2 IDN视为同一主机)', envD.evalCondAST(hostCond, 't', 'https://xn--fsqu00a.com/') === true);
}

// ==== [条件-413~415] 复审V: host字符串值斜杠开头静默恒假 / site带端口恒假 / punycode非法字符 (审查新发现, 以当前行为为准) ====
{
  const consts = src.match(/const SUPPORTED_REGEX_FLAGS = 'imsu';/)[0];
  const envV = new Function(
    consts + '\n' +
    ['hostLabelToASCII', 'toASCIIHostname', 'punycodeDecodeLabel', 'toUnicodeHostname', 'safeRegexTest', 'safeDecodeURIComponent', 'getInvalidRegexFlags', 'parseConditionPart', 'tokenizeCondExpr', 'parseCondExprTokens', 'analyzeCondExpr', 'foldCondExpr', 'evalDynamicLeaf', 'evalCondAST', 'extractBalancedParens', 'findIfOccurrences', 'stripIfConditions', 'evaluateCondition', 'isCondExprCore', 'looksLikeCondExpr', 'absorbStandaloneExpr', 'parseRuleWithConditions'].map((n) => extractFn(src, n)).join('\n') +
    '\nconst window = { location: { hostname: "www.bing.com" } };' +
    '\nfunction getSearchEngine() { return "bing"; }' +
    '\nfunction getSearchCategory() { return "web"; }' +
    '\nreturn { parseRuleWithConditions, evalCondAST, toUnicodeHostname };'
  )();
  const hostSlash = envV.parseRuleWithConditions('host $= /x');
  const hostStr = envV.parseRuleWithConditions('host $= "x"');
  assert('条件-413(复审新发现): host $= /x 被当字符串值静默编译且永不命中(对比 host $= "x" 可命中, 校验无报错)', hostSlash.dynamicConditions.length === 1 && envV.evalCondAST(hostSlash.dynamicConditions[0], 't', 'https://sub.x/') === false && envV.evalCondAST(hostStr.dynamicConditions[0], 't', 'https://sub.x/') === true);
  const sitePort = envV.parseRuleWithConditions('*://x.com/* @if(site = "bing.com:8080")');
  const siteNoPort = envV.parseRuleWithConditions('*://x.com/* @if(site = "bing.com")');
  assert('条件-414(复审新发现): site = "域名:端口" 因hostname不含端口而静态恒假(整条规则被静默丢弃; 对比无端口可命中)', sitePort.staticPass === false && siteNoPort.staticPass === true);
  assert('条件-415(修复10验证): punycode标签含非法字符(_/+)时回退原文而非错误解码', envV.toUnicodeHostname('xn--a_b') === 'xn--a_b' && envV.toUnicodeHostname('xn--a+b') === 'xn--a+b' && envV.toUnicodeHostname('xn--fsqu00a.com') === '例子.com');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

})();
