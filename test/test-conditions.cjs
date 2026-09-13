// 条件表达式: 解析与识别 / @if条件提取与URL路径冲突 / 独立表达式
// 由功能相近的测试文件合并而成: test-cond-expr.cjs, test-if-cond.cjs, test-standalone-expr.cjs
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

// ==== 来源: test-cond-expr.cjs ====
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
].map((n) => extractFn(src, n));

  const consts = src.match(/const SUPPORTED_REGEX_FLAGS = 'imsu';/)[0];
const factory = new Function(
  consts + '\n' + fns.join('\n') + `\nreturn { safeRegexTest, getInvalidRegexFlags, parseConditionPart, tokenizeCondExpr, parseCondExprTokens, analyzeCondExpr, foldCondExpr, evalDynamicLeaf, evalCondAST, stripRuleComment, parseRulesetContent, isCondExprCore, looksLikeCondExpr };`,
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
assert('旧1: $site静态真->恒真', r.const === true);

r = condExpr('$site = "google"', 'bing');
assert('旧2: $site静态假->恒假', r.const === false);

r = condExpr('$site = "bing"', 'bing');
assert('旧2b: $site bing@bing 真', r.const === true);

r = condExpr('Google', 'google');
assert('旧2c: 裸引擎名已移除->unknown', r.errors && r.errors[0].startsWith('unknown'));
r = condExpr('Bing', 'bing');

r = condExpr('title *= 关键词', 'google');
assert('旧2d: 无引号中文title包含', !r.errors && ev(r, '含关键词的标题', 'https://x.com/') === true && ev(r, 'other', 'https://x.com/') === false);
r = condExpr('title*=关键词', 'google');
assert('旧2e: 无空格无引号中文', !r.errors && ev(r, '关键词', 'https://x.com/') === true);
r = condExpr('path *= /a%20b/', 'google');
assert('旧2f: 无引号含百分号路径', !r.errors && ev(r, 't', 'https://x.com/a%20b/c') === true);
r = condExpr('path *= "/下载/"', 'google');
assert('旧2g: 中文path解码比对', !r.errors && ev(r, 't', 'https://x.com/下载/list') === true && ev(r, 't', 'https://x.com/other') === false);
r = condExpr('path ^= "/分类/"', 'google');
assert('旧2h: 中文path前缀', !r.errors && ev(r, 't', 'https://x.com/分类/1') === true);
r = condExpr('path *= "/%E4%B8%8B%E8%BD%BD/"', 'google');
assert('旧2i: 编码形式path仍命中', !r.errors && ev(r, 't', 'https://x.com/下载/') === true);

r = condExpr('title *= "kw1" | title *= "kw2"', 'google');
assert('旧3: 纯或->动态AST', !r.errors && !r.const && r.ast.type === 'or');
assert('旧3a: kw1命中', ev(r, 'has kw1 here', 'https://x.com/') === true);
assert('旧3b: kw2命中', ev(r, 'kw2 page', 'https://x.com/') === true);
assert('旧3c: 都不含->false', ev(r, 'nothing', 'https://x.com/') === false);
assert('旧3d: 无标题->false', ev(r, '', 'https://x.com/') === false);

r = condExpr('$site = "google" | title *= "x"', 'google');
assert('旧4: 静态or命中->无条件恒真', r.const === true);

r = condExpr('$site = "google" | title *= "x"', 'bing');
assert('旧4b: 静态or未命中->剩动态', !r.const && r.ast.type === 'leaf');
assert('旧4c: 标题含x', ev(r, 'xxx', 'https://x.com/') === true);
assert('旧4d: 标题不含x', ev(r, 'yyy', 'https://x.com/') === false);

r = condExpr('title = "AbC"', 'google');
assert('旧5: 标题精确(默认忽略大小写)', ev(r, 'abc', 'https://x.com/') === true && ev(r, 'abd', 'https://x.com/') === false);

r = condExpr('site = "google.com.hk"', 'google', 'www.google.com.hk');
assert('旧6: site静态命中', r.const === true);
r = condExpr('site = "google.com.hk"', 'google', 'www.bing.com');
assert('旧6b: site静态未命中', r.const === false);
r = condExpr('site("google.com.hk")', 'google', 'www.google.com.hk');
assert('旧6c: site(...) 旧括号形式兼容', r.const === true);

r = condExpr('title =~ /kw1|kw2/', 'google');
assert('旧7: 标题正则(正则内|不被切分)', !r.errors && r.ast.type === 'leaf');
assert('旧7a: kw1命中', ev(r, 'kw1 hit', 'https://x.com/') === true);
assert('旧7b: kw2命中', ev(r, 'xx kw2 xx', 'https://x.com/') === true);
assert('旧7c: 都不含', ev(r, 'kk', 'https://x.com/') === false);

r = condExpr('title =~ /a\\/b|c/i', 'google');
assert('旧8: 正则转义斜杠保留', !r.errors && ev(r, 'A/B', 'https://x.com/') === true);

r = condExpr('url *= "test"', 'google');
assert('旧9: url包含', ev(r, 't', 'https://ex.com/test/') === true && ev(r, 't', 'https://ex.com/other') === false);

// 多@if = AND: 两条 AST 需全部为真
r1 = condExpr('title *= "a"', 'google');
r2 = condExpr('!($site = "google")', 'bing');
assert('旧10: 多@if与(engine场景)', ev(r1, 'a t', 'https://x/') === true && r2.const === true);

// ---- 新语法 & ! ( ) ----
r = condExpr('title *= "a" & title *= "b"', 'google');
assert('新1: AND', !r.errors && ev(r, 'a and b', 'https://x/') === true && ev(r, 'only a', 'https://x/') === false);

r = condExpr('!title *= "a"', 'google');
assert('新2: !前缀叶子', !r.errors && r.ast.type === 'not');
assert('新2a: 无标题->取反命中', ev(r, '', 'https://x/') === true);
assert('新2b: 标题非a', ev(r, 'bbb', 'https://x/') === true);
assert('新2c: 标题含a->不命中', ev(r, 'aaa', 'https://x/') === false);

r = condExpr('!(title *= "a" | title *= "b")', 'google');
assert('新3: !(A|B)', !r.errors);
assert('新3a', ev(r, 'ccc', 'https://x/') === true);
assert('新3b', ev(r, 'bbb', 'https://x/') === false);

r = condExpr('title *= "a" & !(url *= "ads")', 'google');
assert('新4: 混合', ev(r, 'a t', 'https://x/page') === true && ev(r, 'a t', 'https://x/ads/1') === false);

r = condExpr('title *= "a" | title *= "b" & url *= "c"', 'google');
assert('新5: 优先级 & > |', !r.errors && r.ast.type === 'or');
assert('新5a: b含但url无c->false(&优先于|)', ev(r, 'bbb', 'https://x/') === false);
assert('新5b: b且url含c', ev(r, 'bbb', 'https://x/c/') === true);
assert('新5c: a即true', ev(r, 'aaa', 'https://x/') === true);

r = condExpr('(title *= "a" | title *= "b") & !($site = "google")', 'google');
assert('新6: 括号组与!()', !r.errors && r.const === false);

r = condExpr('(title *= "a" | title *= "b") & !($site = "bing")', 'google');
assert('新6b: 括号组&!($site=bing)在google', !r.const && ev(r, 'aaa', 'https://x/') === true && ev(r, 'ccc', 'https://x/') === false);

r = condExpr('!($site = "bing")', 'google');
assert('新7: 静态取反', r.const === true);
r = condExpr('!($site = "bing")', 'bing');
assert('新7b: 静态取反2', r.const === false);

r = condExpr('title *= "x" & ($site = "bing" | !($site = "google"))', 'google');
assert('新8: 复杂嵌套折叠(bing|!google 在google: false|false=false)', r.const === false);
r = condExpr('title *= "x" & ($site = "bing" | !($site = "yandex"))', 'google');
assert('新8b: 同上在google: false|true=true->剩title条件', !r.const && r.ast.type === 'leaf');

r = condExpr('!!title *= "a"', 'google');
assert('新9: 双重否定', !r.errors && r.ast.type === 'not');

// ---- 错误检测 ----
r = condExpr('foo', 'google');
assert('错1: 未知条件', r.errors && r.errors[0].startsWith('unknown'));
r = condExpr('title *= "a" &', 'google');
assert('错2: &缺右操作数', r.errors && r.errors.some((e) => e.startsWith('syntax')));
r = condExpr('title *= "a" && title *= "b"', 'google');
assert('错3: 连续&', r.errors && r.errors.some((e) => e.startsWith('syntax')));
r = condExpr('(title *= "a" | title *= "b"', 'google');
assert('错4: 括号未闭合', r.errors && r.errors.some((e) => e.startsWith('syntax')));
r = condExpr('title *= "a")', 'google');
assert('错5: 多余右括号', r.errors && r.errors.some((e) => e.startsWith('syntax')));
r = condExpr('& title *= "a"', 'google');
assert('错6: &开头', r.errors && r.errors.some((e) => e.startsWith('syntax')));
r = condExpr('title *= "a" |', 'google');
assert('错7: |结尾', r.errors && r.errors.some((e) => e.startsWith('syntax')));
r = condExpr('', 'google');
assert('错8: 空串', r.errors);
r = condExpr('   ', 'google');
assert('错9: 全空白', r.errors);
r = condExpr('title =~ /x/g', 'google');
assert('错10: flags含g', r.errors && r.errors[0].startsWith('flags:g'));
r = condExpr('title =~ /(/)', 'google');
assert('错11: 正则无效', r.errors && r.errors[0].startsWith('regex'));
r = condExpr('title =~ /a\\', 'google');
assert('错12: 正则未闭合(tail转义)', r.errors);

// 引擎别名 ddg($site 值归一)
r = condExpr('$site = "DDG"', 'duckduckgo');
assert('旧11: DDG别名(大写)', r.const === true);

// ---- url 表达式系列(@if 内)----
r = condExpr('url = "https://ex.com/"', 'google');
assert('U1: url精确', !r.errors && ev(r, 't', 'https://ex.com/') === true && ev(r, 't', 'https://ex.com/x') === false);

r = condExpr('url = "HTTPS://EX.COM/"', 'google');
assert('U2: url精确忽略大小写', ev(r, 't', 'https://ex.com/') === true);

r = condExpr('url ^= "https://ex"', 'google');
assert('U3: url前缀', ev(r, 't', 'https://example.com/') === true && ev(r, 't', 'http://ex.com/') === false);

r = condExpr('url $= ".pdf"', 'google');
assert('U4: url后缀', ev(r, 't', 'https://x.com/a.pdf') === true && ev(r, 't', 'https://x.com/a.txt') === false);

r = condExpr('url =~ /\\.(pdf|doc)$/', 'google');
assert('U5: url正则(=~)', !r.errors && ev(r, 't', 'https://x.com/a.pdf') === true && ev(r, 't', 'https://x.com/a.doc') === true && ev(r, 't', 'https://x.com/a.txt') === false);
assert('U5b: url正则默认大小写敏感', ev(r, 't', 'https://x.com/a.PDF') === false);
r = condExpr('url =~ /\\.pdf$/i', 'google');
assert('U5c: 加i忽略大小写', ev(r, 't', 'https://x.com/a.PDF') === true);

r = condExpr('url/example\\.(com|net)/', 'google');
assert('U6: url简写(正则内括号与|整吞)', !r.errors && ev(r, 't', 'https://example.com/') === true && ev(r, 't', 'https://example.net/') === true && ev(r, 't', 'https://other.net/') === false);

r = condExpr('url/a&b|c/', 'google');
assert('U7: url简写(正则内&与|不切分)', !r.errors && ev(r, 't', 'https://x/a&b') === true && ev(r, 't', 'https://x/zzc') === true);

r = condExpr('url/example\\.net/i', 'google');
assert('U8: url简写带flags', !r.errors && ev(r, 't', 'https://EXAMPLE.NET/') === true);

r = condExpr('title/example/i', 'google');
assert('U9: title简写带flags', !r.errors && ev(r, 'EXAMPLE!', 'https://x/') === true && ev(r, 'other', 'https://x/') === false);

r = condExpr('title *= "a/b"', 'google');
assert('U10: 引号内斜杠不受正则判定影响', !r.errors && ev(r, 'a/b title', 'https://x/') === true);

r = condExpr('url/example\\.com/ | title *= "kw"', 'google');
assert('U11: url简写与或组合', ev(r, 'plain', 'https://example.com/') === true && ev(r, 'has kw', 'https://other.com/') === true && ev(r, 'none', 'https://other.com/') === false);

r = condExpr('url ^= "https://mp.weixin.qq.com" & !(title *= "ad")', 'google');
assert('U12: url前缀&取反组合', ev(r, 'normal', 'https://mp.weixin.qq.com/s/x') === true && ev(r, 'ads here', 'https://mp.weixin.qq.com/s/x') === false);

r = condExpr('!(url $= ".pdf")', 'google');
assert('U13: !取反url条件', !r.errors && ev(r, 't', 'https://x.com/a.html') === true && ev(r, 't', 'https://x.com/a.pdf') === false);

r = condExpr('url ^= "https://ex.com"', 'google');
assert('U14: url缺失->条件假', ev(r, 't', undefined) === false);
r = condExpr('!(url ^= "https://ex.com")', 'google');
assert('U14b: 取反后url缺失->真', ev(r, 't', undefined) === true);

r = condExpr('url =~ /x/g', 'google');
assert('U15: url正则非法flags(g)', r.errors && r.errors[0].startsWith('flags:g'));
r = condExpr('url/x/g', 'google');
r = condExpr('url/example/g', 'google');
r = condExpr('title/x/g', 'google');
assert('U15d: title简写非法flags', r.errors && r.errors[0].startsWith('flags:g'));
r = condExpr('url =~ /[/]/', 'google');
assert('U16c: url正则字符类内裸斜杠合法', !r.errors && ev(r, 't', 'https://example.com/a/b') === true);
r = condExpr('url =~ /\\//', 'google');
assert('U16b: url正则转义斜杠合法', !r.errors && ev(r, 't', 'https://example.com/a/b') === true);
r = condExpr('url =~ /(/)', 'google');
assert('U16: url正则无效', r.errors && r.errors[0].startsWith('regex'));
r = condExpr('url ^= "https://ex" & url $= "/s/"', 'google');
assert('U17: 双url条件AND', ev(r, 't', 'https://ex.com/s/') === true && ev(r, 't', 'https://ex.com/other/') === false);

r = condExpr('url = ~"x"', 'google');
assert('U18: 乱写归unknown', r.errors && r.errors[0].startsWith('unknown'));

// ---- $site 变量(uBlacklist 引擎属性)----
r = condExpr('$site = "google"', 'google');
assert('S1: $site命中', r.const === true);
r = condExpr('$site = "google"', 'bing');
assert('S2: $site未命中', r.const === false);
r = condExpr('$site = "BING"', 'bing');
assert('S3: $site忽略大小写', r.const === true);
r = condExpr('$site = "ddg"', 'duckduckgo');
assert('S4: $site ddg别名', r.const === true);
r = condExpr('$site : "yandex"', 'yandex');
assert('S5: $site冒号形式', r.const === true);
r = condExpr('$site = "google" & title *= "x"', 'google');
assert('S6: $site与动态组合(google)', !r.const && ev(r, 'xx', 'https://x/') === true && ev(r, 'yy', 'https://x/') === false);
r = condExpr('$site = "google" & title *= "x"', 'bing');
assert('S6b: 组合在bing折叠恒假', r.const === false);
r = condExpr('$site = "google" | $site = "bing"', 'google');
assert('S7: $site多引擎或(google)', r.const === true);
r = condExpr('$site = "google" | $site = "bing"', 'bing');
assert('S7b: 多引擎或(bing)', r.const === true);
r = condExpr('$site = "google" | $site = "bing"', 'yandex');
assert('S7c: 多引擎或(yandex恒假)', r.const === false);
r = condExpr('$site = "foo"', 'google');
assert('S8: 未知站点值->静态假(不报错)', r.const === false && !r.errors);
r = condExpr('$site = google', 'google');
assert('S9: 值未加引号正常识别为合法值', r.const === true);
r = condExpr('!($site = "yandex")', 'google');
assert('S10: $site取反', r.const === true);
r = condExpr('$site = "bing" | $site = "yandex"', 'yandex');
assert('S11: $site多值或', r.const === true);
r = condExpr('$site = "yahoo-japan"', 'yahoo');
assert('S12: $site yahoo-japan别名命中', r.const === true);
r = condExpr('$site = "yahoo-japan"', 'google');
assert('S13: $site yahoo-japan非yahoo恒假', r.const === false);
r = condExpr('$site = "yahoo"', 'yahoo');
assert('S14: $site yahoo原值仍可用', r.const === true);
r = condExpr('$site = "ddg"', 'ddg');
assert('S15: $site ddg 同名自定义引擎可命中', r.const === true);
r = condExpr('$site = "yahoo-japan"', 'yahoo-japan');
assert('S16: $site yahoo-japan 同名自定义引擎可命中', r.const === true);
r = condExpr('$site = "mysearx"', 'MySearx');
assert('S17: $site 自定义引擎ID忽略大小写(规则小写)', r.const === true);
r = condExpr('$site = "MySearx"', 'mysearx');
assert('S18: $site 自定义引擎ID忽略大小写(规则大写)', r.const === true);

// ---- 行尾 # 注释剥离 ----
assert('C1: URL规则行尾注释', m.stripRuleComment('*://x.com/* # 注释') === '*://x.com/*');
assert('C2: 整行注释', m.stripRuleComment('# 注释') === '');
assert('C3: 空白+#注释', m.stripRuleComment('   # x') === '');
assert('C4: 正则内#保留', m.stripRuleComment('/a#b/') === '/a#b/');
assert('C5: 正则行尾注释', m.stripRuleComment('/a#b/ # note') === '/a#b/');
assert('C6: title正则内#保留+行尾注释', m.stripRuleComment('title/.*#.*/ # note') === 'title/.*#.*/');
assert('C7: text正则', m.stripRuleComment('text/a #b/') === 'text/a #b/');
assert('C8: 引号内#与行尾注释', m.stripRuleComment('*://x.com/* @if(title *= "a # b") # note') === '*://x.com/* @if(title *= "a # b")');
assert('C9: @if正则内括号配平', m.stripRuleComment('*://x.com/* @if(title =~ /a)b/) # x') === '*://x.com/* @if(title =~ /a)b/)');
assert('C10: site(...)括号计数', m.stripRuleComment('*://x.com/* @if(site("x.com") & title *= "y") # x') === '*://x.com/* @if(site("x.com") & title *= "y")');
assert('C11: 白名单注释', m.stripRuleComment('@*://x.com/* # 放行') === '@*://x.com/*');
assert('C12: 高亮@N注释', m.stripRuleComment('@1 /a#b/ # note') === '@1 /a#b/');
assert('C13: URL内非空白#保留', m.stripRuleComment('*://x.com/a#b') === '*://x.com/a#b');
assert('C14: 无注释原样', m.stripRuleComment('*://x.com/* @if(Google)') === '*://x.com/* @if(Google)');
assert('C16: @if后带空格', m.stripRuleComment('*://x.com/* @if (title *= "a") # c') === '*://x.com/* @if (title *= "a")');
assert('C17: 嵌套@if括号', m.stripRuleComment('*://x.com/* @if((title *= "a" | title *= "b") & !(url *= "c")) # x') === '*://x.com/* @if((title *= "a" | title *= "b") & !(url *= "c"))');
assert('C18: 引号内转义引号', m.stripRuleComment('*://x.com/* @if(title *= "a\\"b # c") # x') === '*://x.com/* @if(title *= "a\\"b # c")');
assert('C19: @if内部正则含空格和#不被截断', m.stripRuleComment('*://x.com/* @if(url =~ /foo # bar/) # note') === '*://x.com/* @if(url =~ /foo # bar/)');
assert('C20: 高亮域名注释', m.stripRuleComment('@1 *://x.com/* # c') === '@1 *://x.com/*');

// ---- host / path / scheme 变量 ----
r = condExpr('host $= ".example.com"', 'google');
assert('H1: host后缀-子域', !r.errors && ev(r, 't', 'https://www.example.com/') === true);
assert('H2: host后缀-裸域兼容', ev(r, 't', 'https://example.com/') === true);
assert('H3: host后缀-负例', ev(r, 't', 'https://example.net/') === false && ev(r, 't', 'https://badexample.com/') === false);

r = condExpr('host $= "example.com"', 'google');
assert('H4: host后缀无点前缀', ev(r, 't', 'https://www.example.com/') === true && ev(r, 't', 'https://example.com/') === true);

r = condExpr('host = "www.example.com"', 'google');
assert('H5: host精确', ev(r, 't', 'https://www.example.com/x') === true && ev(r, 't', 'https://example.com/') === false);

r = condExpr('host ^= "www"', 'google');
assert('H6: host前缀', ev(r, 't', 'https://www.example.com/') === true && ev(r, 't', 'https://api.example.com/') === false);

r = condExpr('host *= "example"', 'google');
assert('H7: host包含', ev(r, 't', 'https://www.example.com/') === true);

r = condExpr('host =~ /(^|\\.)example\\.com$/i', 'google');
assert('H8: host正则', !r.errors && ev(r, 't', 'https://example.com/') === true && ev(r, 't', 'https://badexample.com/') === false);

r = condExpr('host/\\.example\\.com$/i', 'google');
assert('H9: host简写(正则含|不切分)', !r.errors && ev(r, 't', 'https://www.example.com/') === true && ev(r, 't', 'https://example.net/') === false);

r = condExpr('host $= ".example.com"', 'google');
assert('H10: 忽略大小写', ev(r, 't', 'https://WWW.EXAMPLE.COM/') === true);

r = condExpr('host $= ".例子.com"', 'google');
assert('H11: 中文域名后缀匹配 punycode URL', !r.errors && ev(r, 't', 'https://xn--fsqu00a.com/') === true);
assert('H12: 中文域名后缀匹配 Unicode URL', ev(r, 't', 'https://例子.com/') === true);
assert('H13: 中文域名不误伤其他站', ev(r, 't', 'https://example.com/') === false);

r = condExpr('path *= "/download/"', 'google');
assert('P1: path包含', !r.errors && ev(r, 't', 'https://x.com/download/setup.exe') === true && ev(r, 't', 'https://x.com/dl/x') === false);

r = condExpr('path $= ".pdf"', 'google');
assert('P2: path后缀', ev(r, 't', 'https://x.com/a/file.pdf') === true);

r = condExpr('path ^= "/download"', 'google');
assert('P3: path前缀', ev(r, 't', 'https://x.com/download/setup.exe') === true);

r = condExpr('path = "/download/"', 'google');
assert('P4: path精确', ev(r, 't', 'https://x.com/download/') === true && ev(r, 't', 'https://x.com/download/x') === false);

r = condExpr('path =~ /^\\/download\\//i', 'google');
assert('P5: path正则(=~)', !r.errors && ev(r, 't', 'https://x.com/Download/a') === true);

r = condExpr('path/download/', 'google');
assert('P6: path简写', !r.errors && ev(r, 't', 'https://x.com/download/setup') === true);

r = condExpr('path *= "/dl/" & path *= ".zip"', 'google');
assert('P7: path双条件AND', ev(r, 't', 'https://x.com/a/dl/b.zip') === true && ev(r, 't', 'https://x.com/a/dl/b.rar') === false);

r = condExpr('path *= "/a%20b/"', 'google');
assert('P8: path含编码空格值(原样比较)', !r.errors && ev(r, 't', 'https://x.com/a%20b/c') === true && ev(r, 't', 'https://x.com/ab/c') === false);

r = condExpr('scheme = "https"', 'google');
assert('SC1: scheme精确', !r.errors && ev(r, 't', 'https://x.com/') === true && ev(r, 't', 'http://x.com/') === false);

r = condExpr('scheme = "HTTP"', 'google');
assert('SC2: scheme忽略大小写', ev(r, 't', 'http://x.com/') === true);

r = condExpr('scheme ^= "http"', 'google');
assert('SC3: scheme前缀', ev(r, 't', 'https://x.com/') === true);

r = condExpr('host $= ".example.com" & path *= "/download/" & scheme = "https"', 'google');
assert('M1: host&path&scheme组合', ev(r, 't', 'https://dl.example.com/download/x') === true && ev(r, 't', 'http://dl.example.com/download/x') === false);

r = condExpr('!(host $= ".example.com")', 'google');
assert('M2: host取反', ev(r, 't', 'https://other.com/') === true && ev(r, 't', 'https://example.com/') === false);

r = condExpr('host $= ".example.com"', 'google');
assert('M3: url缺失->假', ev(r, 't', undefined) === false);
r = condExpr('!(host $= ".example.com")', 'google');
assert('M3b: 取反后url缺失->真', ev(r, 't', undefined) === true);

r = condExpr('path $= ".pdf"', 'google');
assert('M4: 非法url->假', ev(r, 't', 'not a url') === false);

r = condExpr('host =~ /x/g', 'google');
assert('M5: host正则非法flags', r.errors && r.errors[0].startsWith('flags:g'));
r = condExpr('title =~ /x/I', 'google');
assert('M5b: 大写I当作i不报错', !r.errors && ev(r, 'X', 'https://x/') === true && ev(r, 'y', 'https://x/') === false);
r = condExpr('host =~ /WWW/I', 'google');
assert('M5c: host大写I可编译', !r.errors && ev(r, 't', 'https://www.example.com/') === true);
r = condExpr('path/x/g', 'google');

r = condExpr('scheme = "https" | host $= ".org"', 'google');
assert('M6: 与或组合', ev(r, 't', 'https://anything/') === true && ev(r, 't', 'http://x.org/') === true && ev(r, 't', 'http://x.com/') === false);

// ---- P0-3: flags u / P1-3: 订阅 frontmatter ----
r = condExpr('title =~ /\\u{4E2D}/u', 'google');
assert('F1: title =~ 支持u flag', !r.errors && ev(r, '中文字', 'https://x/') === true);
r = condExpr('url/example/u', 'google');
assert('F2: url简写支持u flag', !r.errors && ev(r, 't', 'https://example.com/') === true);
r = condExpr('title =~ /x/u', 'google');
assert('F3: flags预检不再拒u', !r.errors);

const stripEmpty = (ls) => ls.map(l => l.trim()).filter(l => l);
const pc1 = m.parseRulesetContent('---\nname: My Rules\n---\n*://*.example.com/*\n');
assert('R1: 标准frontmatter剥离', pc1.meta.name === 'My Rules' && stripEmpty(pc1.lines).length === 1 && stripEmpty(pc1.lines)[0] === '*://*.example.com/*');
const pc2 = m.parseRulesetContent('---\nname: "Quoted List"\n---\n/a#b/\n');
assert('R2: 引号name', pc2.meta.name === 'Quoted List' && stripEmpty(pc2.lines).length === 1);
const pc3 = m.parseRulesetContent('---\nname: X\n# comment in head\n---\n*://a.com/*\n*://b.com/*\n');
assert('R3: 多规则+头内注释行', pc3.meta.name === 'X' && stripEmpty(pc3.lines).length === 2);
const pc4 = m.parseRulesetContent('*://a.com/*\n---\nname: x\n---\n');
assert('R4: 非frontmatter开头(原样)', pc4.meta.name === undefined && stripEmpty(pc4.lines).length === 4);
const pc5 = m.parseRulesetContent('---\nname: Unclosed\n*://a.com/*\n');
assert('R5: frontmatter未闭合(原样处理)', pc5.meta.name === undefined && stripEmpty(pc5.lines).length === 3);
const pc6 = m.parseRulesetContent('---\n---\n*://a.com/*\n');
assert('R6: 空frontmatter', pc6.meta.name === undefined && stripEmpty(pc6.lines).length === 1);
const pc7 = m.parseRulesetContent('---\nother: value\nname: Multi List\nversion: 2\n---\n*://a.com/*\n');
assert('R7: name位于多键中间', pc7.meta.name === 'Multi List' && stripEmpty(pc7.lines).length === 1);
const pc8 = m.parseRulesetContent('name: UB List\nrules:\n  - example.com\n  - \'*://*.example.com/*\'\n  - title/.*ad.*/i\n');
assert('R8: YAML rules列表提取', pc8.meta.name === 'UB List' && pc8.lines.length === 3 && pc8.lines[0] === 'example.com' && pc8.lines[1] === '*://*.example.com/*' && pc8.lines[2] === 'title/.*ad.*/i');
const pc9 = m.parseRulesetContent('rules:\n  - /a/i # trailing\n  # full comment\n  - example.com\n');
assert('R9: YAML注释跳过', pc9.lines.length === 2 && pc9.lines[0] === '/a/i # trailing' && pc9.lines[1] === 'example.com');
const pc10 = m.parseRulesetContent('blacklist:\n  - *.example.com\nsubscriptions:\n  - url: https://x\n    enabled: true\n');
assert('R10: blacklist键+后续段截断', pc10.lines.length === 1 && pc10.lines[0] === '*.example.com');
const pc11 = m.parseRulesetContent('*://a.com/*\nrules:\n');
assert('R11: 无列表项不启用YAML模式', stripEmpty(pc11.lines).length === 2);
const pc12 = m.parseRulesetContent('name: Q\nrules:\n  - "*://x.com/*"\n  - \'host $= ".x.com"\'\n');
assert('R12: 双引号与单引号项', pc12.meta.name === 'Q' && pc12.lines[0] === '*://x.com/*' && pc12.lines[1] === 'host $= ".x.com"');
const pc13 = m.parseRulesetContent('name: WL\nblacklist:\n  - ads.example.com\nwhitelist:\n  - good.example.com\n  - "@*://keep.example.com/*"\n');
assert('R13: whitelist段导入并自动加@', pc13.meta.name === 'WL' && pc13.lines.length === 3 && pc13.lines[0] === 'ads.example.com' && pc13.lines[1] === '@good.example.com' && pc13.lines[2] === '@*://keep.example.com/*');
const pc14 = m.parseRulesetContent('blacklist:\n  - a.com\nrules:\n  - b.com\n');
assert('R14: 连续两个list键均提取', pc14.lines.length === 2 && pc14.lines[0] === 'a.com' && pc14.lines[1] === 'b.com');
const pc15 = m.parseRulesetContent('---\nname: Block Sample\nhomepage: https://x\n---\ntitle: A\nurl: https://www.a.com/\nmatches:\n  - *://*.a.com/*\n\ntitle: B\nmatches:\n  - /re\\.com/\n');
assert('R15: uBlacklist matches段提取', pc15.meta.name === 'Block Sample' && pc15.lines.length === 2 && pc15.lines[0] === '*://*.a.com/*' && pc15.lines[1] === '/re\\.com/');
const pc16 = m.parseRulesetContent('title: A\nmatches:\n  - *://*.b.com/*\n');
assert('R16: matches段不残留垃圾行', pc16.lines.length === 1 && pc16.lines[0] === '*://*.b.com/*');

// ---- uBlacklist 独立 i 修饰符兼容(默认仍忽略大小写)----
r = condExpr('title *= "KW" i', 'google');
assert('I1: title包含+i修饰', !r.errors && ev(r, 'contains kw', 'https://x/') === true && ev(r, 'nothing', 'https://x/') === false);
r = condExpr('title $= "Domain" I', 'google');
r = condExpr('title = "AbC" i', 'google');
assert('I3: title精确+i', !r.errors && ev(r, 'abc', 'https://x/') === true && ev(r, 'abd', 'https://x/') === false);
r = condExpr('url $= ".PDF" i', 'google');
r = condExpr('host $= ".example.com" i', 'google');
assert('I5: host后缀+i', !r.errors && ev(r, 't', 'https://www.EXAMPLE.COM/') === true);
r = condExpr('path ^= "/DO" i', 'google');
r = condExpr('scheme = "HTTPS" i', 'google');
r = condExpr('$site = "GOOGLE" i', 'google');
assert('I8: $site+i', r.const === true);
r = condExpr('site = "GOOGLE.COM.HK" i', 'google', 'www.google.com.hk');
r = condExpr('site("GOOGLE.COM.HK") i', 'google', 'www.google.com.hk');
r = condExpr('title *= "a"i', 'google');
assert('I11: 紧贴无空格i', !r.errors && ev(r, 'xa', 'https://x/') === true);
r = condExpr('title *= "a" ix', 'google');
assert('I12: i后多余字符->unknown', r.errors && r.errors[0].startsWith('unknown'));
r = condExpr('title *= "a" i | title *= "b" i', 'google');
assert('I13: 多条件带i或', !r.errors && ev(r, 'xx a', 'https://x/') === true && ev(r, 'zz', 'https://x/') === false);
r = condExpr('title *= "a" i & !(url *= "ads")', 'google');
r = condExpr('url *= "example"', 'google');
assert('I15: 无i修饰回归(默认忽略大小写)', !r.errors && ev(r, 't', 'https://EXAMPLE.com/') === true);

// ---- $category 静态折叠 ----
r = condExpr('$category = "web"', 'google', 'www.google.com', 'web');
assert('CAT1: web页命中', r.const === true);
r = condExpr('$category = "images"', 'google', 'www.google.com', 'web');
assert('CAT2: web页images条件恒假', r.const === false);
r = condExpr('$category = "images"', 'google', 'www.google.com', 'images');
assert('CAT3: 图片页命中', r.const === true);
r = condExpr('$category : "videos"', 'google', 'www.google.com', 'videos');
assert('CAT4: 冒号形式', r.const === true);
r = condExpr('$category = "NEWS" i', 'google', 'www.google.com', 'news');
assert('CAT5: 忽略大小写+i修饰', r.const === true);
r = condExpr('$category = "images" & title *= "x"', 'google', 'www.google.com', 'web');
assert('CAT6: 与动态组合在web折叠恒假', r.const === false);
r = condExpr('$category = "images" & title *= "x"', 'google', 'www.google.com', 'images');
assert('CAT6b: 图片页剩title条件', !r.const && ev(r, 'xx', 'https://x/') === true && ev(r, 'yy', 'https://x/') === false);
r = condExpr('$category = "web" | $category = "images"', 'google', 'www.google.com', 'web');
assert('CAT7: 多类型或(web)', r.const === true);
r = condExpr('$category = "images" | $category = "videos"', 'google', 'www.google.com', 'web');
assert('CAT7b: 多类型或未命中恒假', r.const === false);
r = condExpr('!($category = "images")', 'google', 'www.google.com', 'web');
assert('CAT8: 取反(非图片页)', r.const === true);
r = condExpr('$category = "foo"', 'google', 'www.google.com', 'web');
assert('CAT9: 未知类型值->静态假(不报错)', r.const === false && !r.errors);
r = condExpr('$category = images', 'google');
assert('CAT10: 值未加引号正常识别为合法值', r.const === false && !r.errors);
r = condExpr('$site = "google" & $category = "images"', 'google', 'www.google.com', 'images');
assert('CAT11: $site与$category同时命中', r.const === true);
r = condExpr('$site = "google" & $category = "images"', 'google', 'www.google.com', 'web');
assert('CAT11b: $site命中但category不命中', r.const === false);

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
for (const rule of condTrueCases) {
  assert(`D: 条件表达式识别 ${rule}`, m.looksLikeCondExpr(rule) === true);
}

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
for (const rule of condFalseCases) {
  assert(`D: 非条件表达式 ${rule}`, m.looksLikeCondExpr(rule) === false);
}
})();

// ==== 来源: test-if-cond.cjs ====
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
assert('P1: 双引号内右括号不截断', !!p1 && p1.content === 'title *= "a)b"');
assert('P2: endIndex 到真正的右括号', !!p1 && p1.endIndex === src1.length);

const p3 = api.extractBalancedParens("@if(title *= 'a)b')", 3);
assert('P3: 单引号内右括号不截断', !!p3 && p3.content === "title *= 'a)b'");

const c4 = api.extractIfConditions('*://x/* @if(title =~ /\\(a/)');
assert('P4: 转义左括号条件完整', c4.length === 1 && c4[0] === 'title =~ /\\(a/');

const c5 = api.extractIfConditions('*://x/* @if(title =~ /a\\)b/)');
assert('P5: 转义右括号不提前闭合', c5.length === 1 && c5[0] === 'title =~ /a\\)b/');

const c6 = api.extractIfConditions('*://x/* @if(title =~ /[(]a[)]/)');
assert('P6: 正则字符类内括号忽略', c6.length === 1 && c6[0] === 'title =~ /[(]a[)]/');

const c7 = api.extractIfConditions('*://x/* @if((title *= "a") | (title *= "b)"))');
assert('P7: 引号与分组混合', c7.length === 1 && c7[0] === '(title *= "a") | (title *= "b)")');

const p8 = api.extractBalancedParens('@if(title *= "a(b")', 3);
assert('P8: 引号内左括号不增加深度', !!p8 && p8.content === 'title *= "a(b"');

assert('P9: 真正不闭合返回 null', api.extractBalancedParens('@if((title *= "a")', 3) === null);

const s1 = api.stripIfConditions('*://x/* @if(title *= "a)b")');
assert('P10: 剥离后核心规则与条件通过', s1.coreRule === '*://x/*' && s1.staticPass === true);

const s2 = api.stripIfConditions('*://x/* @if(title =~ /\\(a/)');
assert('P11: 转义括号条件可剥离', s2.coreRule === '*://x/*' && s2.staticPass === true);

const s3 = api.stripIfConditions('*://x/* @if(title *= "a)b") @if(url *= "x")');
assert('P12: 多个 @if 均正确剥离', s3.coreRule === '*://x/*');

// ---- 引号/正则体内 @if 扫描 ----
let s = api.stripIfConditions('*://x.com/* @if(title *= "@if(y)")');
assert('Q1: 引号内 @if 不产生伪剥离', s.coreRule === '*://x.com/*' && s.staticPass === true);
let c = api.extractIfConditions('*://x.com/* @if(title *= "@if(y)")');
assert('Q2: 引号内 @if 不产生伪条件', c.length === 1 && c[0] === 'title *= "@if(y)"');
assert('Q3: 引号内 @if 规则校验通过', api.validateRule('*://x.com/* @if(title *= "@if(y)")') === true);

s = api.stripIfConditions('title/foo@if(bar)/');
assert('Q5: title 正则体内 @if 不被剥离', s.coreRule === 'title/foo@if(bar)/');
assert('Q6: title 正则体内 @if 规则校验通过', api.validateRule('title/foo@if(bar)/') === true);

s = api.stripIfConditions('*://example.com/api/@if(test)/*');
assert('Q5b: URL路径内 @if( 不被误判剥离', s.coreRule === '*://example.com/api/@if(test)/*');
assert('Q6b: URL路径内 @if( 规则校验通过', api.validateRule('*://example.com/api/@if(test)/*') === true);

s = api.stripIfConditions('*://x.com/* @if(title =~ /a@if(b)/)');
assert('Q7: 条件正则体内 @if 不产生伪剥离', s.coreRule === '*://x.com/*');
c = api.extractIfConditions('*://x.com/* @if(title =~ /a@if(b)/)');
assert('Q8: 条件正则体内 @if 不产生伪条件', c.length === 1 && c[0] === 'title =~ /a@if(b)/');

s = api.stripIfConditions('*://x.com/* @if(title *= "@if(y)") @if($site="google")');
assert('Q10: 混合多条件核心规则正确', s.coreRule === '*://x.com/*' && s.staticPass === true);
c = api.extractIfConditions('*://x.com/* @if(title *= "@if(y)") @if($site="google")');
assert('Q11: 混合多条件数量正确', c.length === 2 && c[0] === 'title *= "@if(y)"' && c[1] === '$site="google"');

s = api.stripIfConditions('title/.*示例.*/ @if($site = "google")');
assert('Q12: 前导正则后的 @if 正常剥离', s.coreRule === 'title/.*示例.*/' && s.staticPass === true);

s = api.stripIfConditions('host/\\.example\\.com$/i @if(title *= "x")');
assert('Q14: 表达式正则后的 @if 正常剥离', s.coreRule === 'host/\\.example\\.com$/i' && s.staticPass === true);

s = api.stripIfConditions('*://x.com/?q=~/foo @if(title *= "x")');
assert('Q15: URL查询含=~/不误判正则', s.coreRule === '*://x.com/?q=~/foo' && s.staticPass === true);

assert('Q16: 未闭合条件仍报错', api.validateRule('*://x.com/* @if((title *= "a")') === false);
assert('Q17: 未闭合条件不剥离', api.stripIfConditions('*://x.com/* @if((title *= "a")').coreRule === '*://x.com/* @if((title *= "a")');

// ---- URL 路径含关键字段不误吞 @if(回归) ----
const pathConflictCases = [
  '*://x.com/title/y @if(title *= "a")',
  '*://x.com/a/url/y @if(title *= "a")',
  '*://x.com/scheme/y @if(title *= "a")',
  '*://x.com/a/title/b/url/c @if(url *= "q")',
];
for (const rule of pathConflictCases) {
  const occ = api.findIfOccurrences(rule);
  assert(`X1: @if检测 ${rule}`, occ.length === 1);
  const stripped = api.stripIfConditions(rule);
  const expectedCore = rule.replace(/ @if\(.*\)$/, '');
  assert(`X1b: 剥离后保留核心 ${rule}`, stripped.coreRule === expectedCore && stripped.staticPass === true);
  assert(`X1c: 规则校验通过 ${rule}`, api.validateRule(rule) === true);
}

s = api.stripIfConditions('*://x.com/url/* @if(title *= "a") @if($site = "google")');
assert('X2: 多@if与路径冲突同时剥离', s.coreRule === '*://x.com/url/*' && s.staticPass === true);

const noOccCases = [
  'url/foo@if(bar)/',
  '@url/foo@if(bar)/i',
  'title/foo@if(bar)/',
  '@1 title/foo@if(bar)/i',
];
for (const rule of noOccCases) {
  assert(`X3: 行首简写正则体内 @if 不产生伪条件 ${rule}`, api.findIfOccurrences(rule).length === 0);
}

s = api.stripIfConditions('scheme/https?\\/\\// @if(title *= "x")');
assert('X4: 行首 scheme 简写正则后的 @if 正常剥离', s.coreRule === 'scheme/https?\\/\\//' && s.staticPass === true);
s = api.stripIfConditions('path/\\/download/ @if(title *= "x")');
assert('X5: 行首 path 简写正则后的 @if 正常剥离', s.coreRule === 'path/\\/download/' && s.staticPass === true);

s = api.stripIfConditions('*://x/* @if(url/foo@if(bar)/)');
assert('X6: 条件内 url 简写正则含 @if 文本正常', s.coreRule === '*://x/*' && s.staticPass === true);
c = api.extractIfConditions('*://x/* @if(url/foo@if(bar)/)');
assert('X6b: 条件完整提取', c.length === 1 && c[0] === 'url/foo@if(bar)/');
assert('X6c: 规则校验通过', api.validateRule('*://x/* @if(url/foo@if(bar)/)') === true);

s = api.stripIfConditions('*://x/* @if(title/foo@if(bar)/)');
assert('X7: 条件内 title 简写正则含 @if 文本正常', s.coreRule === '*://x/*' && s.staticPass === true);
assert('X7b: 规则校验通过', api.validateRule('*://x/* @if(title/foo@if(bar)/)') === true);
})();

// ==== 来源: test-standalone-expr.cjs ====
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
assert('L1: host后缀像表达式', m.looksLikeCondExpr('host $= ".example.com"') === true);
assert('L2: path包含像表达式', m.looksLikeCondExpr('path *= "/download/"') === true);
assert('L3: 组合像表达式', m.looksLikeCondExpr('host $= ".example.com" & path *= "/download/"') === true);
assert('L4: 取反像表达式', m.looksLikeCondExpr('!title *= "ad"') === true);
assert('L5: 域名不像表达式', m.looksLikeCondExpr('example.com') === false);
assert('L6: URL通配不像表达式', m.looksLikeCondExpr('*://*.example.com/*') === false);
assert('L7: title/正则不像表达式', m.looksLikeCondExpr('title/foo/i') === false);
assert('L8: text/不像表达式', m.looksLikeCondExpr('text/ad/') === false);
assert('L9: 裸正则不像表达式', m.looksLikeCondExpr('/example\\.com/') === false);
assert('L10: host简写正则像表达式', m.looksLikeCondExpr('host/\\.example\\.com$/i') === true);

// ---- 解析 ----
let p = m.parseRuleWithConditions('host $= ".example.com"');
assert('P1: 独立host无core', p.coreRule === '' && p.staticPass === true && p.dynamicConditions.length === 1);
assert('P1a: host裸域命中', m.evalCondAST(p.dynamicConditions[0], 't', 'https://example.com/') === true);

p = m.parseRuleWithConditions('path *= "/download/"');
assert('P2: 独立path', p.coreRule === '' && p.staticPass && p.dynamicConditions.length === 1);
assert('P2a: path命中', m.evalCondAST(p.dynamicConditions[0], 't', 'https://x.com/download/a') === true);

p = m.parseRuleWithConditions('host $= ".example.com" & path *= "/download/"');
assert('P3: 组合表达式', p.coreRule === '' && p.staticPass && p.dynamicConditions.length === 1);
assert('P3a: 双条件命中', m.evalCondAST(p.dynamicConditions[0], 't', 'https://dl.example.com/download/x') === true);

p = m.parseRuleWithConditions('@host $= ".example.com"');
assert('P4: 白名单独立表达式', p.coreRule === '@' && p.staticPass && p.dynamicConditions.length === 1);

p = m.parseRuleWithConditions('host $= ".example.com" @if(title *= "kw")');
assert('P5: 独立表达式+@if', p.coreRule === '' && p.staticPass && p.dynamicConditions.length === 2);
assert('P5a: 双条件都真', m.checkDynamicConditions(p.dynamicConditions, 'has kw', 'https://example.com/') === true);

p = m.parseRuleWithConditions('example.com');
assert('P6: 普通域名不吸收', p.coreRule === 'example.com' && p.dynamicConditions.length === 0 && p.staticPass);

p = m.parseRuleWithConditions('*://*.example.com/*');
assert('P7: URL通配不吸收', p.coreRule === '*://*.example.com/*' && p.dynamicConditions.length === 0);

p = m.parseRuleWithConditions('title/foo/i');
assert('P8: title正则不吸收', p.coreRule === 'title/foo/i' && p.dynamicConditions.length === 0);

p = m.parseRuleWithConditions('*://*.example.com/* @if(title *= "kw")');
assert('P9: 旧复合规则仍剥离@if', p.coreRule === '*://*.example.com/*' && p.dynamicConditions.length === 1);

p = m.parseRuleWithConditions('@if(host $= ".example.com")');
assert('P10: 仅@if行视为表达式', p.coreRule === '' && p.staticPass && p.dynamicConditions.length === 1);

p = m.parseRuleWithConditions(m.stripRuleComment('host $= ".example.com" # note'));
assert('P11: 注释剥离后解析', p.coreRule === '' && p.staticPass && p.dynamicConditions.length === 1);

p = m.parseRuleWithConditions('title *= "kw" | url $= ".pdf"');
assert('P12: 标题或url后缀', p.coreRule === '' && p.staticPass);
assert('P12a: 标题命中', m.evalCondAST(p.dynamicConditions[0], 'has kw', 'https://x.com/a.html') === true);
assert('P12b: url命中', m.evalCondAST(p.dynamicConditions[0], 'plain', 'https://x.com/a.pdf') === true);

p = m.parseRuleWithConditions('host/\\.example\\.com$/i');
assert('P13: host简写正则', p.coreRule === '' && p.staticPass);

p = m.parseRuleWithConditions('!title *= "ad"');
assert('P14: 独立取反', p.coreRule === '' && p.staticPass);
assert('P14a: 无ad命中', m.evalCondAST(p.dynamicConditions[0], 'normal', 'https://x.com/') === true);

p = m.parseRuleWithConditions('$site = "google"');
assert('P15: $site在google折叠恒真', p.coreRule === '' && p.staticPass && p.dynamicConditions.length === 0);

m.setEngine('bing', 'www.bing.com');
p = m.parseRuleWithConditions('$site = "google"');
assert('P16: $site在bing静态丢弃', p.staticPass === false);
m.setEngine('google', 'www.google.com');

p = m.parseRuleWithConditions('scheme = "https"');
assert('P17: scheme独立', p.coreRule === '' && p.staticPass);
assert('P17a: https命中', m.evalCondAST(p.dynamicConditions[0], 't', 'https://x.com/') === true);

p = m.parseRuleWithConditions('host $= ".example.com" i');
assert('P18: 独立表达式兼容i修饰', p.coreRule === '' && p.staticPass);

// ---- 校验 ----
assert('V1: host独立规则有效', m.analyzeRule('host $= ".example.com"').valid === true);
assert('V4: 白名单独立有效', m.analyzeRule('@host $= ".example.com"').valid === true);
assert('V5: 高亮独立有效', m.analyzeRule('@1 path $= ".pdf"').valid === true);
assert('V6: 域名规则仍有效', m.analyzeRule('example.com').valid === true);
assert('V7: URL通配仍有效', m.analyzeRule('*://*.example.com/*').valid === true);
assert('V8: 残缺表达式无效', m.analyzeRule('host $= ').valid === false);
assert('V9: 未知字段无效', m.analyzeRule('foo $= "bar"').valid === false);
assert('V10: 独立+行尾注释有效', m.analyzeRule('host $= ".example.com" # x').valid === true);
assert('V11: 仅@if行有效', m.analyzeRule('@if(path *= "/download/")').valid === true);
assert('V12: 空@if仍无效', m.analyzeRule('@if()').valid === false);
assert('V13: title包含独立有效', m.analyzeRule('title *= "广告"').valid === true);
assert('V14: 高亮越界仍无效', m.analyzeRule('@9 host $= ".example.com"').valid === false);
assert('V15: 复合旧写法仍有效', m.analyzeRule('*://*.example.com/* @if(title *= "kw")').valid === true);
assert('V16: $category规则有效', m.analyzeRule('*://*.amazon.com/* @if($category = "images")').valid === true);
assert('V17: $category独立表达式有效', m.analyzeRule('$category = "images"').valid === true);
assert('V18: 高亮+白名单组合无效', m.analyzeRule('@1 @*://*.example.com/*').valid === false);
assert('V19: 高亮+白名单表达式无效', m.analyzeRule('@1 @host $= ".example.com"').valid === false);
assert('V20: 高亮+@if仍有效', m.analyzeRule('@1 path $= ".pdf" @if($site = "google")').valid === true);

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
assert('E1b: 编译保留1个动态条件', pc1.staticPass === true && pc1.dynamicConditions.length === 1);
const pc2 = m.parseRuleWithConditions('/example\\.com/i @if($site = "google")');
assert('E2b: $site静态真折叠', pc2.staticPass === true && pc2.dynamicConditions.length === 0 && pc2.coreRule === '/example\\.com/i');
const pc3 = m.parseRuleWithConditions('title/.*kw.*/ @if(title *= "x")');
assert('E3b: title规则@if动态条件', pc3.staticPass === true && pc3.dynamicConditions.length === 1);
const pc4 = m.parseRuleWithConditions('/foo@if(bar)/');
assert('E8b: 正则体内@if不提取', pc4.staticPass === true && pc4.dynamicConditions.length === 0 && pc4.coreRule === '/foo@if(bar)/');
const pc5 = m.parseRuleWithConditions('title/a@if(b)/i');
assert('E9b: title正则体内@if不提取', pc5.staticPass === true && pc5.dynamicConditions.length === 0 && pc5.coreRule === 'title/a@if(b)/i');
const pc6 = m.parseRuleWithConditions('title/x/ @if($site = "bing")');
assert('E15b: 静态假$site编译丢弃', pc6.staticPass === false && pc6.dynamicConditions.length === 0);

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
assert('P19: web页$category=images静态丢弃', p.staticPass === false);
m.setEngine('google', 'www.google.com', 'images');
p = m.parseRuleWithConditions('*://*.amazon.com/* @if($category = "images")');
assert('P20: 图片页$category通过且无动态条件', p.staticPass === true && p.coreRule === '*://*.amazon.com/*' && p.dynamicConditions.length === 0);
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
assert('M1: 独立host屏蔽', isBlocked(doCheck(cr, urlEx, 'www.example.com', 't', null, slEx)));
assert('M1b: 独立host不误伤', !isBlocked(doCheck(cr, urlOther, 'other.net', 't', null, slOther)));
assert('M1c: 裸域也屏蔽', isBlocked(doCheck(cr, 'https://example.com/', 'example.com', 't', null, ['example.com'])));

cr = makeCR();
addExpr(cr, 'path *= "/download/"');
assert('M2: 独立path屏蔽', isBlocked(doCheck(cr, urlEx, 'www.example.com', 't', null, slEx)));

cr = makeCR();
addExpr(cr, 'host $= ".example.com" & path *= "/download/"');
assert('M3: 组合命中', isBlocked(doCheck(cr, urlEx, 'www.example.com', 't', null, slEx)));

cr = makeCR();
addExpr(cr, 'title *= "广告"');
assert('M4: 独立title屏蔽', isBlocked(doCheck(cr, urlOther, 'other.net', '含广告标题', null, slOther)));

cr = makeCR();
{
  const parsed = m.parseRuleWithConditions('@host $= ".example.com"');
  cr.whitelistConditionalRules.push({ type: 'expr', conditions: parsed.dynamicConditions, source: '本地规则' });
  cr.domains.set('example.com', [{ type: 'wildcard', originalRule: 'example.com', source: '本地规则' }]);
}
assert('M5: 独立表达式白名单放行', !isBlocked(doCheck(cr, urlEx, 'www.example.com', 't', null, slEx)));

cr = makeCR();
{
  const parsed = m.parseRuleWithConditions('path $= ".pdf"');
  cr.highlightConditionalRules.push({ type: 'expr', conditions: parsed.dynamicConditions, N: 2 });
}
let r = doCheck(cr, 'https://x.com/a.pdf', 'x.com', 't', null, ['x.com']);
assert('M6: 独立表达式高亮', r && r.highlight === 2 && !r.blocked);
r = doCheck(cr, 'https://x.com/a.txt', 'x.com', 't', null, ['x.com']);

cr = makeCR();
addExpr(cr, 'host $= ".example.com"', '订阅规则1');
r = doCheck(cr, urlEx, 'www.example.com', 't', null, slEx);
assert('M7: 订阅独立表达式可屏蔽', isBlocked(r) && r.source === '订阅规则1');

cr = makeCR();
addExpr(cr, 'url $= ".pdf"');
assert('M8: 独立url后缀', isBlocked(doCheck(cr, 'https://x.com/a.pdf', 'x.com', 't', null, ['x.com'])));

cr = makeCR();
addExpr(cr, 'scheme = "http"');
assert('M9: 独立http协议', isBlocked(doCheck(cr, 'http://x.com/', 'x.com', 't', null, ['x.com'])));

cr = makeCR();
{
  const parsed = m.parseRuleWithConditions('@path *= "/safe/"');
  cr.whitelistConditionalRules.push({ type: 'expr', conditions: parsed.dynamicConditions, source: '本地规则' });
  addExpr(cr, 'host $= ".example.com"');
}
assert('M10: 路径白名单压过host黑名单', !isBlocked(doCheck(cr, 'https://www.example.com/safe/a', 'www.example.com', 't', null, slEx)));
assert('M10b: 非安全路径仍屏蔽', isBlocked(doCheck(cr, urlEx, 'www.example.com', 't', null, slEx)));

cr = makeCR();
addExpr(cr, 'host $= ".example.com" @if(title *= "kw")');
assert('M11: 独立表达式与@if同时生效', isBlocked(doCheck(cr, urlEx, 'www.example.com', 'has kw', null, slEx)));
assert('M11b: @if不满足不屏蔽', !isBlocked(doCheck(cr, urlEx, 'www.example.com', 'plain', null, slEx)));

// ---- 白名单 × 独立表达式优先级 ----
cr = makeCR();
addWlExpr(cr, '@host $= ".example.com"');
addExpr(cr, 'host $= ".example.com"');
assert('W1: 本地表达式白名单 > 本地表达式黑名单', !isBlocked(doCheck(cr, urlEx, 'www.example.com', 't', null, slEx)));

cr = makeCR();
addExpr(cr, 'host $= ".example.com"');
addWlExpr(cr, '@host $= ".example.com"', '订阅规则1');
r = doCheck(cr, urlEx, 'www.example.com', 't', null, slEx);
assert('W2: 本地表达式黑名单 > 订阅表达式白名单', isBlocked(r) && r.source === '本地规则');

cr = makeCR();
cr.whitelistDomains.set('example.com', [{type: 'wildcard', source: '本地规则'}]);
addExpr(cr, 'path *= "/download/"');
assert('W3: 本地域名白名单 > 本地表达式黑名单', !isBlocked(doCheck(cr, urlEx, 'www.example.com', 't', null, slEx)));

cr = makeCR();
addWlExpr(cr, '@host $= ".example.com"');
cr.domains.set('example.com', [{type: 'wildcard', originalRule: 'example.com', source: '订阅规则1'}]);
assert('W4: 本地表达式白名单 > 订阅域名黑名单', !isBlocked(doCheck(cr, urlEx, 'www.example.com', 't', null, slEx)));

cr = makeCR();
addWlExpr(cr, '@host $= ".example.com"', '订阅规则1');
addExpr(cr, 'host $= ".example.com"', '订阅规则1');
assert('W5: 订阅表达式白名单 > 订阅表达式黑名单', !isBlocked(doCheck(cr, urlEx, 'www.example.com', 't', null, slEx)));

cr = makeCR();
addExpr(cr, 'host $= ".example.com"');
cr.whitelistDomains.set('example.com', [{type: 'wildcard', source: '订阅规则1'}]);
r = doCheck(cr, urlEx, 'www.example.com', 't', null, slEx);
assert('W6: 本地表达式黑名单 > 订阅域名白名单', isBlocked(r) && r.source === '本地规则');

cr = makeCR();
cr.whitelistUrlPatterns.push({regex: /example\.com/, source: '本地规则'});
addExpr(cr, 'path *= "/download/"');
assert('W7: 本地URL白名单 > 本地表达式黑名单', !isBlocked(doCheck(cr, urlEx, 'www.example.com', 't', null, slEx)));

cr = makeCR();
addWlExpr(cr, '@host $= ".example.com"');
cr.highlightDomains.set('example.com', [{N: 2, type: 'wildcard'}]);
r = doCheck(cr, urlEx, 'www.example.com', 't', null, slEx);
assert('W8: 高亮+本地表达式白名单 → 仅高亮', r && r.highlight === 2 && !r.blocked);

cr = makeCR();
addExpr(cr, 'host $= ".example.com"');
cr.highlightDomains.set('example.com', [{N: 3, type: 'wildcard'}]);
r = doCheck(cr, urlEx, 'www.example.com', 't', null, slEx);
assert('W9: 高亮+本地表达式黑名单 → 两者都返回', r && r.highlight === 3 && r.blocked === true);

cr = makeCR();
addWlExpr(cr, '@host $= ".other.com"');
addExpr(cr, 'host $= ".example.com"');
assert('W10: 未命中的表达式白名单不放行', isBlocked(doCheck(cr, urlEx, 'www.example.com', 't', null, slEx)));

p = m.parseRuleWithConditions('@if(host $= ".example.com")');
assert('W11a: 仅@if行是黑名单表达式', p.coreRule === '' && p.standaloneExpr && !p.coreRule.startsWith('@'));
p = m.parseRuleWithConditions('@host $= ".example.com"');
assert('W11b: @host 是白名单表达式', p.coreRule === '@' && p.standaloneExpr);

cr = makeCR();
addWlExpr(cr, '@title *= "官方"');
addExpr(cr, 'host $= ".example.com"');
assert('W12: 标题白名单放行同源host黑名单', !isBlocked(doCheck(cr, urlEx, 'www.example.com', '官方站点', null, slEx)));
assert('W12b: 标题不匹配则host黑名单仍生效', isBlocked(doCheck(cr, urlEx, 'www.example.com', '普通标题', null, slEx)));

cr = makeCR();
addWlExpr(cr, '@path *= "/safe/"', '订阅规则1');
addExpr(cr, 'host $= ".example.com"', '订阅规则1');
assert('W13: 订阅路径白名单 > 订阅host黑名单', !isBlocked(doCheck(cr, 'https://www.example.com/safe/a', 'www.example.com', 't', null, slEx)));
assert('W13b: 订阅路径白名单未命中则订阅host仍屏蔽', isBlocked(doCheck(cr, urlEx, 'www.example.com', 't', null, slEx)));

cr = makeCR();
addWlExpr(cr, '@host $= ".example.com"');
addExpr(cr, 'path *= "/download/"', '订阅规则1');
assert('W14: 本地host白名单压过订阅path黑名单', !isBlocked(doCheck(cr, urlEx, 'www.example.com', 't', null, slEx)));

cr = makeCR();
addExpr(cr, 'path *= "/download/"');
addWlExpr(cr, '@host $= ".example.com"', '订阅规则1');
r = doCheck(cr, urlEx, 'www.example.com', 't', null, slEx);
assert('W15: 本地path黑名单压过订阅host白名单', isBlocked(r) && r.source === '本地规则');
})();

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

})();
