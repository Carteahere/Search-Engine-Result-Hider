// 读取上一级目录的 *.*.*.user.js 或 Lite.user.js
// 选择器 / 引擎 / 跨页锁 / 修复回归
// 命名：选择器-序号: 描述

(async () => {
const fs = require('fs');
const path = require('path');
const scriptDir = path.join(__dirname, '..');
const scriptFiles = fs.readdirSync(scriptDir).filter((name) => /^\S+\.\S+\.\S+\.user\.js$/.test(name) || name === 'Lite.user.js').sort();
if (!scriptFiles.length) throw new Error('no .js script found in ' + scriptDir);
const file = path.join(scriptDir, scriptFiles[0]);
console.log('Testing', file);
const src = fs.readFileSync(file, 'utf8');
const readRepoFile = (rel) => fs.readFileSync(['', 'other', '文档'].map((d) => path.join(scriptDir, d, rel)).find((p) => fs.existsSync(p)), 'utf8');

// 函数体括号配对提取
function extractFn(text, fnName) {
  const marker = `function ${fnName}(`;
  const idx = text.indexOf(marker);
  if (idx === -1) throw new Error('fn not found: ' + fnName);
  const open = text.indexOf('{', idx);
  let depth = 0, i = open;
  for (; i < text.length; i++) { if (text[i] === '{') depth++; else if (text[i] === '}') { depth--; if (depth === 0) break; } }
  const rawExtract = (t, name) => { const ridx = t.indexOf('function ' + name + '('); const ropen = t.indexOf('{', t.indexOf(') {', ridx)); let d = 0, ri = ropen; for (; ri < t.length; ri++) { if (t[ri] === '{') d++; else if (t[ri] === '}') { d--; if (d === 0) break; } } return t.slice(ridx, ri + 1); };
  const fn = text.slice(idx, i + 1);
  const prelude = [];
  if (!['findBalancedParenEnd', 'scanRuleString', 'encodeNonAscii'].includes(fnName)) {
    if (/scanRuleString\(|RULE_PREFIX_RE|RULE_PREFIX_REGEX_RE|RULE_LEADING_REGEX_RE|REGEX_CTX_[A-D]\b/.test(fn)) prelude.push(text.split('\n').filter((l) => /^\s*const (?:RULE_\w+|REGEX_CTX_[A-D]) =/.test(l)).map((l) => l.replace('const ', 'var ')).join('\n'), rawExtract(text, 'findBalancedParenEnd'), rawExtract(text, 'scanRuleString'), rawExtract(text, 'isBadRegexTail'), rawExtract(text, 'regexCloseAhead'), rawExtract(text, 'regexStartAhead'));
    if (/encodeNonAscii\(/.test(fn)) prelude.push(rawExtract(text, 'encodeNonAscii'));
    if (/isUniqueFlagsStr\(|isFlagsCandidateError\(/.test(fn)) prelude.push(['isUniqueFlagsStr', 'isFlagsCandidateError'].map((n) => rawExtract(text, n)).join('\n'));
    if (/parseTopLevelAt\(/.test(fn)) prelude.push(rawExtract(text, 'parseTopLevelAt'));
    if (!['parseTitleSpec', 'parseLinkSpec'].includes(fnName) && /\bparseTitleSpec\b|\bparseLinkSpec\b/.test(fn)) prelude.push(rawExtract(text, 'parseTopLevelAt'), rawExtract(text, 'parseLinkSpec'), rawExtract(text, 'parseTitleSpec'));
    if (/yandexResultBlocks\(/.test(fn)) prelude.push('function getContainerSelector() { return \'div.Organic\'; }', rawExtract(text, 'yandexResultBlocks'));
  }
  if (['scanNewResults', 'teardownEngineSite'].includes(fnName)) prelude.push('function restoreResultExtraElements() {}\nfunction reconcileHiddenParents() {}\nfunction restoreAllHiddenParents() {}');
  return prelude.concat([fn]).join('\n');
}

let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS ' + name); } else { fail++; console.log('FAIL ' + name + (extra !== undefined ? '  => ' + JSON.stringify(extra) : '')); } }
function assert(name, cond, extra) { check(name, cond, extra); }

// 对象字面量括号配对提取(不依赖注释)
function extractObjectLiteral(text, openIdx) {
  let depth = 0, inSQ = false, inDQ = false, inRE = false, inReClass = false;
  for (let i = openIdx; i < text.length; i++) {
    const ch = text[i];
    if (inSQ) { if (ch === '\\') i++; else if (ch === "'") inSQ = false; continue; }
    if (inDQ) { if (ch === '\\') i++; else if (ch === '"') inDQ = false; continue; }
    if (inRE) {
      if (ch === '\\') { i++; continue; }
      if (inReClass) { if (ch === ']') inReClass = false; continue; }
      if (ch === '[') { inReClass = true; continue; }
      if (ch === '/') inRE = false;
      continue;
    }
    if (ch === "'") { inSQ = true; continue; }
    if (ch === '"') { inDQ = true; continue; }
    if (ch === '/') { inRE = true; continue; }
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) return i; }
  }
  throw new Error('unbalanced SELECTORS object literal');
}
const getSelectorsObjectText = () => {
  const start = src.indexOf('const SELECTORS = {');
  if (start === -1) throw new Error('SELECTORS block not found');
  const open = src.indexOf('{', start);
  return src.slice(open, extractObjectLiteral(src, open) + 1);
};

// ==== 一、选择器与引擎核心 ====

// ---- 默认合并/覆盖/序列化/校验 ----
await (async () => {
const selectorsObjectText = getSelectorsObjectText();
const selectors = eval(`(${selectorsObjectText})`);
const storeRef = { current: undefined }; const subStoreRef = { current: undefined };
function GM_getValue(key, defaultValue) {
  if (key === 'searchfilter_selectors') return storeRef.current === undefined ? defaultValue : storeRef.current;
  if (key === 'searchfilter_engine_subscriptions') return subStoreRef.current === undefined ? defaultValue : subStoreRef.current;
  return defaultValue;
}
const badCss = new Set(['div>>>', 'a[[', 'p:unknownpseudo(']);
global.document = { querySelector(selector) { if (badCss.has(selector)) { const e = new Error('invalid selector'); e.name = 'SyntaxError'; throw e; } return null; } };
const fns = ['normalizeSelectorList', 'hasTopLevelComma', 'normalizeCategoryMap', 'mergeSelectorDef', 'getUserSelectors', 'getEngineSubscriptions', 'saveEngineSubscriptions', 'parseSelectorMatch', 'coerceSelectorDef', 'coerceCategoryMatch', 'getSubscribedSelectors', 'getBaseSelectors', 'getSelectors', 'resetSelectorCache', 'getSearchEngine', 'getSearchCategory', 'resolveCategoryDef', 'isEngineSite', 'getContainerSelector', 'isValidCssSelector', 'hasPseudoElement', 'validateUserSelectors', 'getInvalidRegexFlags', 'regexSourceToLiteralText', 'escapeJsString', 'matchDefToParts', 'serializeSelectors', 'normalizeMatchLiteral', 'parseSelectorText', 'sameSelectorDef', 'diffSelectorDefFields', 'diffUserSelectors', 'pruneUserSelectors', 'parseLinkSpec', 'parseTitleSpec'].map((n) => extractFn(src, n));
const builtinSelectorOfLine = src.match(/const builtinSelectorOf = .+?;/);
if (!builtinSelectorOfLine) throw new Error('builtinSelectorOf not found');
const body = `
const ENGINE_SUBSCRIPTIONS_KEY = 'searchfilter_engine_subscriptions'; const BUILTIN_ENGINE_SUB_URL = 'https://raw.githubusercontent.com/Carteahere/Search-Engine-Result-Hider/main/Other/SELECTORS.js'; const SELECTORS_KEY = 'searchfilter_selectors';
const SUPPORTED_REGEX_FLAGS = 'imsu';
const SELECTORS = ${selectorsObjectText}; let activeSelectors = null; let _engineCacheHost = null; let _categoryCacheHref = null; let _categoryCacheResult = 'web'; let _categoryCacheEngine = null; let _catDefCacheKey = null; let _catDefCache = null;
const CATEGORY_FIELDS = ['containers', 'titles', 'snippets', 'links', 'extraElements', 'button', 'match'];
${src.match(/const ENGINE_HOST_REGEXES = \{[\s\S]*?\n  \};/)[0]}
function isEngineHost(engine, host) { const re = ENGINE_HOST_REGEXES[engine]; return !!re && re.test(String(host || '')); }
${builtinSelectorOfLine[0]} let _engineCacheResult = 'other'; let _observedSelector = '';
const window = { location: { get hostname() { return currentHost; }, get href() { return currentHref; } } }; let currentHost = 'www.google.com'; let currentHref = 'https://www.google.com/';
function t(key, params = {}) { let text = key; for (const [k, v] of Object.entries(params || {})) text += ':' + v; return text; } function GM_setValue(key, value) { if (key === 'searchfilter_selectors') storeRef.current = value; }
${fns.join('\n')}
return { getSelectors, getUserSelectors, getSearchEngine, getSearchCategory, isEngineSite, getContainerSelector, validateUserSelectors, resetSelectorCache, normalizeSelectorList, serializeSelectors, parseSelectorText, diffUserSelectors, pruneUserSelectors, sameSelectorDef,
  setHost: (h) => { currentHost = h; currentHref = 'https://' + h + '/'; }, setHref: (h) => { currentHref = h; }, setStore: (obj) => { storeRef.current = obj; resetSelectorCache(); }, setSubStore: (obj) => { subStoreRef.current = obj; resetSelectorCache(); } };
`;
const api = new Function('GM_getValue', 'storeRef', 'subStoreRef', body)(GM_getValue, storeRef, subStoreRef);
const CUSTOM = { mysearx: { match: '(?:^|\\.)searx\\.example\\.com$', containers: '.result', titles: ['h3'], snippets: ['.content'], links: 'a[href]' } };

api.setStore({ google: { match: '(?:^|\\.)google\\.', containers: 'div.myg', titles: ['h3'], snippets: ['.s'], links: 'a[href]' } });
api.setStore({ broken: { match: '([', containers: '.x', titles: [], snippets: [], links: 'a[href]' } });
api.setHost('broken.example');
check('选择器-004: 非法match不崩溃且不激活', api.getSearchEngine() === 'other' && api.getSelectors().broken.match === null);
api.setStore(CUSTOM);
api.setHost('searx.example.com');
api.setStore({});
api.setHost('www.google.com');
api.setHref('https://www.google.com/search?q=x.bing.com');
api.setHost(''); api.setHref('');
api.setStore(CUSTOM);
api.setHost('other.com');
api.setHref('https://other.com/?u=x.searx.example.com');
check('选择器-009: 自定义hostname正则不因URL尾部误判', api.getSearchEngine() === 'other');
api.setStore({ urlengine: { match: '^https://search\\.example\\.com/web', containers: '.r' } });
api.setHost('search.example.com');
api.setHref('https://search.example.com/web?q=1');
api.setHref('https://search.example.com/images?q=1');
api.setHost('www.google.com');
api.setStore({ myuser: { match: '(?:^|\\.)google\\.com$', containers: 'div.user', titles: ['h3'] } });
api.setSubStore([{ url: 'https://example.com/subs.js', enabled: true, selectors: { mysub: { match: '(?:^|\\.)google\\.com$', containers: 'div.sub', titles: ['h3'] } } }]);
check('选择器-011c: 站点重叠时自定义引擎优先于订阅与内置', api.getSearchEngine() === 'myuser' && api.getContainerSelector('myuser') === 'div.user');
api.setStore({});
api.setSubStore([]);
check('选择器-011e: 无自定义与订阅时回退内置引擎', api.getSearchEngine() === 'google' && api.getContainerSelector('google') === 'div.g, div.MjjYud');
api.setHost('www.bing.com'); api.setHref('https://www.bing.com/images/search?q=x');
api.setStore({ bing: { containers: 'div.custom-bing' } });
// 留档观察: 图片搜索容器按分类优先(设计), 顶层containers覆盖仅在分类未定义containers时生效
check('011f: custom image containers win', api.getContainerSelector('bing') === 'li:has(div.iuscp), div.iuscp, div.imgpt');
api.setStore({});
api.setSubStore([{ url: 'https://sub/y.js', enabled: true, selectors: { bing: { containers: 'div.sub-bing' } } }]);
check('011g: subscribed image containers win', api.getContainerSelector('bing') === 'li:has(div.iuscp), div.iuscp, div.imgpt');
api.setSubStore([]); api.setHost('www.google.com'); api.setHref('https://www.google.com/');
api.setHref('https://www.google.com/search?q=x&tbm=vid'); const gVideoCont = api.getContainerSelector('google');
api.setHref('https://www.google.com/search?q=x&tbm=nws'); const gNewsCont = api.getContainerSelector('google');
api.setHost('www.bing.com');
api.setHref('https://www.bing.com/videos/search?q=x'); const bVideoCont = api.getContainerSelector('bing');
api.setHref('https://www.bing.com/news/search?q=x'); const bNewsCont = api.getContainerSelector('bing');
check('选择器-211: 视频/新闻按真实卡片容器返回', gVideoCont === 'div.PmEWq' && gNewsCont === 'a.aJWbwf, [data-news-cluster-id]' && bVideoCont === 'div.mc_vtvc' && bNewsCont === 'div.news-card, .newscard');
api.setHost('www.google.com');
api.setSubStore([{ url: 'https://example.com/subs.js', enabled: true, selectors: { yahoo: { match: '^(?:[a-z]{1,6}\\.)?(?:search\\.)?yahoo\\.co\\.jp$', containers: '.sub-y' }, yahoo_japan: { match: '^search\\.yahoo\\.co\\.jp$', containers: '.sub-yj' } } }]);
api.setHost('search.yahoo.co.jp');
const yahooPick = api.getSearchEngine();
api.setSubStore([]); api.setHost('www.google.com');
check('选择器-207: 订阅yahoo含co.jp时仍优先专有yahoo_japan', yahooPick === 'yahoo_japan');
check('选择器-019: titles/snippets/links 伪元素(含单冒号)被拒且引号内不误报', api.validateUserSelectors({ p1: { match: 'a', containers: '.x', titles: ['h3::after'] } }).length === 1 && api.validateUserSelectors({ p2: { match: 'a', containers: '.x', snippets: ['.c::before'] } }).length === 1 && api.validateUserSelectors({ p3: { match: 'a', containers: '.x', links: 'a::after' } }).length === 1 && api.validateUserSelectors({ s1: { match: 'a', containers: 'div:before' } }).length === 1 && api.validateUserSelectors({ s2: { match: 'a', containers: '.x', titles: ['h3:first-line'] } }).length === 1 && api.validateUserSelectors({ s3: { match: 'a', containers: '.x', links: 'a:first-letter' } }).length === 1 && api.validateUserSelectors({ p4: { match: 'a', containers: '.x', titles: ['[data-k="a::b"]'] } }).length === 0);
// 修复留档: extraElements 的逗号需按括号深度判断
check('选择器-020: 对象match非法flags报错且合法通过', api.validateUserSelectors({ e11: { match: { source: 'a', flags: 'q' }, containers: '.x' } }).length === 1 && api.validateUserSelectors({ e12: { match: { source: 'a', flags: 'i' }, containers: '.x' } }).length === 0);
check('选择器-021: 字符串match写成/re/g被拒且合法字面量通过', api.validateUserSelectors({ f1: { match: '/a/g', containers: '.x' } }).some((m) => m.includes('invalidRegexFlags')) && api.validateUserSelectors({ f2: { match: '/a/i', containers: '.x' } }).length === 0);
const P1 = api.serializeSelectors();
const R1 = api.parseSelectorText(P1);
// 修复留档: parseSelectorText将带flags正则字面量归一化为{source,flags}对象, 断言取.source与026/039同口径
check('选择器-023: 序列化→解析往返一致', /bing:\s*\{/.test(P1) && /match: \//.test(P1) && !R1.errors.length && !!R1.config && R1.config.bing.match.source === api.getSelectors().bing.match.source && R1.config.google.containers === 'div.g, div.MjjYud');
const R4 = api.parseSelectorText('e8: { match: /a[/ }');
const R5 = api.parseSelectorText('e7: { match: /a/q }');
check('选择器-025: 未闭合正则/非法flags解析报错', R4.config === null && R4.errors.length === 1 && R5.config === null && R5.errors.length === 1);
const RC = api.parseSelectorText('// head\nmysite: {\n  /* a */ match: /(?:^|\\.)x\\.com$/, // b\n  containers: ".r"\n} // tail');
check('选择器-025b: 解析器跳过行/块注释与首尾注释', !RC.errors.length && !!RC.config && RC.config.mysite.containers === '.r' && RC.config.mysite.match === '(?:^|\\.)x\\.com$');
api.setStore({ flg: { match: { source: 'a\\/b', flags: 'i' }, containers: '.x', titles: [], snippets: [], links: 'a[href]' } });
const P2 = api.serializeSelectors();
const R9 = api.parseSelectorText(P2);
check('选择器-026: match flags 序列化→解析往返保留并过校验', P2.includes('match: /a\\/b/i') && !R9.errors.length && R9.config.flg.match.source === 'a\\/b' && R9.config.flg.match.flags === 'i' && api.validateUserSelectors(R9.config).length === 0);
api.setStore({ 'my-engine': { match: { source: 'a', flags: '' }, containers: '.r', titles: [], snippets: [], links: 'a[href]' } });
const P4 = api.serializeSelectors();
const R15 = api.parseSelectorText(P4);
check('选择器-028: 连字符键输出带引号, 为合法JS字面量且往返一致', P4.includes("'my-engine': {") && (() => { try { const o = new Function('const SELECTORS = {' + P4 + '}; return SELECTORS;')(); return !!(o && o['my-engine'] && o.bing); } catch (e) { return false; } })() && !R15.errors.length && !!R15.config && !!R15.config['my-engine'] && R15.config['my-engine'].containers === '.r' && api.validateUserSelectors(R15.config).length === 0);
api.setStore({ google: { match: '(?:^|\\.)google\\.', containers: 'div.g' }, google_scholar: { match: '(?:^|\\.)scholar\\.google\\.', containers: 'div.gs_r' } });
api.setHost('scholar.google.com');
check('选择器-031: 用户同时配置google与google_scholar时学者优先', api.getSearchEngine() === 'google_scholar');
api.setStore({});
const allBuiltins = {};
// 修复留档: 内置副本fixture须保留match flags, 裸源串无隐式i与内置语义不同(218/039)
for (const k of ['bing', 'google', 'duckduckgo', 'yandex', 'brave', 'yahoo']) {
  const m = api.getSelectors()[k];
  allBuiltins[k] = { match: { source: m.match.source, flags: m.match.flags }, containers: m.containers, titles: m.titles.slice(), snippets: m.snippets.slice(), links: m.links };
}
const bingCopy = allBuiltins.bing;
check('选择器-032: 未改动键丢弃/改动键保留/新增键保留', !('bing' in api.diffUserSelectors(allBuiltins)) && 'bing' in api.diffUserSelectors(Object.assign({}, allBuiltins, { bing: Object.assign({}, bingCopy, { containers: '.x' }) })) && 'myx' in api.diffUserSelectors(Object.assign({}, allBuiltins, { myx: { match: 'a', containers: '.x' } })));
api.setStore({ yahoo: { disabled: true } });
check('选择器-035: disabled 内置引擎不被加载也不匹配站点', api.getSelectors().yahoo.disabled === true && (() => { api.setHost('search.yahoo.com'); const r = api.getSearchEngine() === 'other'; api.setHost('www.google.com'); return r; })());
const P3 = api.serializeSelectors();
const R10 = api.parseSelectorText(P3);
check('选择器-036: disabled 序列化往返保留定义与标记且校验通过', /yahoo:\s*\{/.test(P3) && P3.includes('disabled: true') && !R10.errors.length && R10.config.yahoo.disabled === true && api.validateUserSelectors(R10.config).length === 0);
check('选择器-039: sameSelectorDef 兼容字符串/RegExp/对象形态且flags参与比较', api.sameSelectorDef({ match: 'a.b', containers: '.x', titles: [], snippets: [], links: 'a[href]' }, { match: /a.b/, containers: '.x', titles: [], snippets: [], links: 'a[href]' }) && api.sameSelectorDef({ match: { source: 'a.b', flags: '' }, containers: '.x', titles: [], snippets: [], links: 'a[href]' }, { match: /a.b/, containers: '.x', titles: [], snippets: [], links: 'a[href]' }) && !api.sameSelectorDef({ match: { source: 'a.b', flags: 'i' }, containers: '.x', titles: [], snippets: [], links: 'a[href]' }, { match: /a.b/, containers: '.x', titles: [], snippets: [], links: 'a[href]' }));
api.setStore({ bing: { disabled: 'false' } });
check('选择器-041: 存储里 disabled 为字符串 false 不误禁用引擎', api.getSelectors().bing.disabled !== true);
api.setStore({ bing: { disable: true } });
check('选择器-043: disable:true 引擎被停用且 disable:false 空覆盖不破坏内置', (() => { api.setHost('www.bing.com'); const r = api.getSearchEngine() === 'other'; api.setStore({ bing: { disable: false } }); return r && api.getSearchEngine() === 'bing' && api.getContainerSelector('bing') === 'li.b_algo, div.b_algo'; })());
api.setStore({});
const bingSnapshot = api.getSelectors().bing;
// 修复留档: 旧版固化副本fixture同032保留match flags
storeRef.current = { bing: { ...bingSnapshot, match: { source: bingSnapshot.match.source, flags: bingSnapshot.match.flags } }, myse: { match: 'a', containers: '.x' } };
api.resetSelectorCache();
api.pruneUserSelectors();
check('选择器-044: 旧版固化的内置副本被清理', storeRef.current && !('bing' in storeRef.current) && !!storeRef.current.myse);
// 修复留档: regexSourceToLiteralText需跟踪字符类使类内/不转义, 否则google含[/?#]的内置match被序列化成[\/?#]回读多一个反斜杠, 未改动引擎被判已修改并固化副本(主/Lite)
api.setStore({});
const Pfull = api.serializeSelectors();
const Rfull = api.parseSelectorText(Pfull);
check('选择器-191: 内置serialize→parse零diff且类内/?#不再被转义', Pfull.includes('[/?#]') && !Pfull.includes('[\\\\/?#]') && !Rfull.errors.length && !!Rfull.config && Object.keys(api.diffUserSelectors(Rfull.config)).length === 0);
// 修复留档: so360摘要补.res-list-summary, sogou容器.reactResult加:has约束
check('选择器-219: so360摘要含.res-list-summary且sogou容器reactResult带:has约束', selectors.so360.snippets.includes('.res-list-summary') && selectors.sogou.containers.includes('div.reactResult:has(h3)') && selectors.sogou.containers.includes('div.reactResult:has(.vr-title)') && !/(?:^|,)\s*\.reactResult\s*,/.test(selectors.sogou.containers));
// 修复留档: 夸克补quark.cn, Yahoo新闻补标题链接, Yahoo日本新闻/视频补分类选择器, 头条图集逐图容器
check('选择器-224: 夸克/Yahoo/头条选择器修复生效', selectors.quark.match.source.includes('quark\\.cn') && selectors.yahoo.links.includes('.s-title a') && selectors.yahoo_japan.links.includes('a.sw-Card__titleInner[href]') && selectors.yahoo_japan.categories.news.containers.includes('li:has(a[href*="/articles/"])') && selectors.yahoo_japan.categories.videos.match.test('https://search.yahoo.co.jp/video/search?p=x') && selectors.toutiao.categories.images.containers === '.l-waterfallY-item' && selectors.toutiao.categories.images.links.includes('a[href*="/search/jump"]'));
api.setStore({}); api.setHost('www.quark.cn'); api.setHref('https://www.quark.cn/s?q=x'); const qPc = api.getSearchEngine() === 'quark';
api.setHost('news.yahoo.co.jp'); api.setHref('https://news.yahoo.co.jp/search/?p=x'); const yNews = api.getSearchEngine() === 'yahoo_japan';
const yNewsCat = api.getSearchCategory() === 'news' && api.getContainerSelector('yahoo_japan').includes('articles');
api.setHref('https://news.yahoo.co.jp/articles/x'); const yArticle = api.getSearchEngine() === 'other';
api.setHost('search.yahoo.co.jp'); api.setHref('https://search.yahoo.co.jp/video/search?p=x'); const yVideo = api.getSearchCategory() === 'videos';
api.setStore({}); api.setHost('www.google.com'); api.setHref('https://www.google.com/search?q=x');
check('选择器-226: 夸克PC与Yahoo日本新闻/视频入口识别', qPc && yNews && yNewsCat && yArticle && yVideo);
const extraDef = { ...CUSTOM.mysearx, extraElements: ['+ .summary', '~ .metadata'] };
api.setStore({ customExtra: extraDef });
const extraRoundTrip = api.parseSelectorText(api.serializeSelectors());
// 修复留档: 裸字符串match默认补i后往返规范化为/source/i, 对照采用规范化形态(主/Lite)
check('选择器-045: 关联选择器合并保留且往返一致且校验通过', JSON.stringify(api.getSelectors().customExtra.extraElements) === JSON.stringify(extraDef.extraElements) && !extraRoundTrip.errors.length && api.sameSelectorDef(extraRoundTrip.config.customExtra, { ...extraDef, match: { source: extraDef.match, flags: 'i' } }) && api.validateUserSelectors({ customExtra: extraDef }).length === 0);
for (const value of ['+ tr', ['+ tr, body'], ['+ tr::after']]) check(`选择器-046: 非法关联配置被拒 ${JSON.stringify(value)}`, api.validateUserSelectors({ customExtra: { ...extraDef, extraElements: value } }).some((e) => e.includes('extraElements')));
const catNameCases = [['my-shop', true], ['Cat_2-x', true], ['ca t', false], ['cat!', false]];
for (const [name, ok] of catNameCases) check(`选择器-047: 自定义分类名 ${name} ${ok ? '通过' : '被拒'}`, (api.validateUserSelectors({ c1: { match: 'a', containers: '.x', categories: { [name]: { match: 'b', containers: '.y' } } } }).length === 0) === ok);
api.setStore({ catname: { match: '(?:^|\\.)cat\\.example$', categories: { 'my-shop': { match: /[?&]shop=1/, containers: 'div.shop-card', titles: ['h3'], links: 'a[href]' } } } });
api.setHost('cat.example'); api.setHref('https://cat.example/search?q=x&shop=1');
check('选择器-048: 自定义分类按match识别且容器生效', api.getSearchEngine() === 'catname' && api.getSearchCategory() === 'my-shop' && api.getContainerSelector('catname') === 'div.shop-card');
api.setStore({}); api.setHost('www.bing.com'); api.setHref('https://www.bing.com/search?q=example.com/images/');
check('选择器-048b: Bing网页查询串含/images/不被误判为图片分类', api.getSearchCategory() === 'web');
api.setHref('https://www.bing.com/images/search?q=test');
check('选择器-048c: Bing图片路径仍识别为图片分类', api.getSearchCategory() === 'images');
check('选择器-048d: 顶层links/titles的@json/@attr不再被CSS校验误拒', api.validateUserSelectors({ ex: { match: 'a', containers: '.x', links: ['a@json:data.url', 'a[href]'], titles: ['img@attr:alt'] } }).length === 0);
api.setHost('www.google.com'); api.setHref('https://www.google.com/');
const parseCondition = new Function(extractFn(src, 'hostLabelToASCII') + extractFn(src, 'toASCIIHostname') + extractFn(src, 'parseConditionPart') + '; return parseConditionPart;')();
check('选择器-049: duckduckgo/ddg 为 Lite 别名', parseCondition('$site=duckduckgo', 'duckduckgo_lite', 'lite.duckduckgo.com').static === true && parseCondition('$site=ddg', 'duckduckgo_lite', 'lite.duckduckgo.com').static === true && parseCondition('$site=duckduckgo_lite', 'duckduckgo_lite', 'lite.duckduckgo.com').static === true && parseCondition('$site=duckduckgo', 'duckduckgo', 'duckduckgo.com').static === true);
check('选择器-049b: yahoo 不与 yahoo_japan 互别名且支持 yahoo-japan', parseCondition('$site=yahoo', 'yahoo', 'search.yahoo.com').static === true && parseCondition('$site=yahoo_japan', 'yahoo_japan', 'search.yahoo.co.jp').static === true && parseCondition('$site=yahoo-japan', 'yahoo_japan', 'search.yahoo.co.jp').static === true && parseCondition('$site=yahooJapan', 'yahoo_japan', 'search.yahoo.co.jp').static === false && parseCondition('$site=yahoo', 'yahoo_japan', 'search.yahoo.co.jp').static === false && parseCondition('$site=yahoo_japan', 'yahoo', 'search.yahoo.com').static === false);
})();


// ---- DOM增量扫描 ----
await (async () => {
function createEnv() {
  const elements = [], queries = [];
  function makeEl(tag, cls, observed) {
    const el = {
      tag, cls, observed: !!observed, observeCount: 0, unobserveCount: 0, resetCount: 0, quickBtn: null, attrs: {},
      matches(sel) {
        return String(sel).split(',').map((s) => s.trim()).filter(Boolean).some((part) => {
          const m = part.match(/^([a-zA-Z]+)?(?:\.([\w-]+))?$/);
          if (!m) return false;
          if (m[1] && this.tag !== m[1]) return false;
          if (m[2] && this.cls !== m[2]) return false;
          return true;
        });
      },
      setAttribute(k) { this.attrs[k] = true; if (k === 'data-observed') this.observed = true; },
      removeAttribute(k) { delete this.attrs[k]; if (k === 'data-observed') this.observed = false; },
      contains() { return false; },
      querySelector(sel) { return sel === '.serh-quick-block' ? this.quickBtn : null; },
    };
    elements.push(el);
    return el;
  }
  const documentStub = {
    querySelectorAll(sel) {
      queries.push(sel);
      if (sel === '[data-observed]') return elements.filter((e) => e.observed);
      if (sel === '[data-blocker-processed], [data-observed]') return elements.filter((e) => e.observed || e.attrs['data-blocker-processed']);
      const m = sel.match(/^:is\(([\s\S]+)\):not\(\[data-observed\]\)$/);
      if (m) { const groups = m[1].split(',').map((s) => s.trim()); return elements.filter((e) => !e.observed && groups.some((g) => e.matches(g))); }
      return [];
    },
  };
  const resultObserver = { observe(el) { el.observeCount++; }, unobserve(el) { el.unobserveCount++; } };
  const factory = new Function('document', 'resultObserver', `
    let currentConfig = { enabled: true, debug: false }; let showHiddenResults = false;
    let _observedSelector = ''; let currentSelector = '.a, .b';
    let activeSelectors = null; let _engineCacheHost = '';
    function getSearchEngine() { return 'test'; } function getSearchCategory() { return 'web'; } function getContainerSelector() { return currentSelector; }
    function resetResultStyles(el) { el.resetCount++; }
    ${extractFn(src, 'resetSelectorCache')}
    ${extractFn(src, 'filterNestedContainers')}
    ${extractFn(src, 'clearStaleObserved')}
    ${extractFn(src, 'syncObservedSelector')}
    ${extractFn(src, 'queryUnobserved')}
    ${extractFn(src, 'scanNewResults')}
    return { scanNewResults, queryUnobserved, clearStaleObserved, syncObservedSelector, resetSelectorCache, setSelector: (s) => { currentSelector = s; }, setEnabled: (v) => { currentConfig.enabled = v; }, getObservedSelector: () => _observedSelector };
  `);
  return { env: { elements, queries }, api: factory(documentStub, resultObserver), makeEl };
}
{
  const { env, api, makeEl } = createEnv();
  const a1 = makeEl('li', 'a', true);
  const b1 = makeEl('div', 'b', true);
  makeEl('li', 'a', false);
  makeEl('div', 'b', false);
  api.queryUnobserved('.a, .b');
  api.scanNewResults();
  api.resetSelectorCache();
  api.setSelector('.a');
  api.scanNewResults();
  check('选择器-060: 收窄选择器清理不再匹配元素并保留仍匹配元素', b1.observed === false && b1.unobserveCount === 1 && b1.resetCount === 1 && a1.observed === true && a1.unobserveCount === 0);
  api.setEnabled(false);
  api.scanNewResults();
}
{
  const { api, makeEl } = createEnv();
  const stale = makeEl('div', 'x', true);
  const btn = { removed: 0, remove() { this.removed++; } };
  stale.quickBtn = btn;
  api.clearStaleObserved('.a');
  const bad = makeEl('div', 'y', true);
  bad.matches = () => { throw new Error('bad selector'); };
  api.clearStaleObserved('.a');
  check('选择器-111: clearStaleObserved 清理失配元素且坏选择器不抛错', stale.observed === false && stale.unobserveCount === 1 && btn.removed === 1 && stale.resetCount === 1 && bad.observed === false && bad.unobserveCount === 1);
}
{
  const filterFn = new Function(`function getSearchCategory() { return 'web'; } function getSearchEngine() { return 'test'; }\n${extractFn(src, 'filterNestedContainers')}\nreturn filterNestedContainers;`)();
  function makeNode(children, links) {
    const node = { children: children || [], links: links || [] };
    node.querySelectorAll = (sel) => (sel === 'a[href]' ? node.links : []);
    node.querySelector = () => null;
    node.contains = (other) => other !== node && (node.links.includes(other) || node.children.some((c) => c === other || c.contains(other)));
    return node;
  }
  const wrapLink = { id: 'wrap-link' };
  const wsub = makeNode([], [wrapLink]);
  const wrapper = makeNode([wsub], [wrapLink]);
  const kept = filterFn([wrapper, wsub], 'div.g');
  check('选择器-112: filterNestedContainers 丢弃与子项共享链接的外层容器', kept.length === 1 && kept[0] === wsub);
}
{
  const bingFilter = new Function(`function getSearchCategory() { return 'images'; } function getSearchEngine() { return 'bing'; } function getResultLink(el) { return el.link; }\n${extractFn(src, 'filterNestedContainers')}\nreturn filterNestedContainers;`)();
  const mk = (iusc) => ({ iusc, querySelectorAll: () => [], querySelector: (sel) => (sel === 'a.iusc' ? iusc : null), contains: () => false });
  const shared = { id: 'iusc-1' }, otherIusc = { id: 'iusc-2' };
  const outer = mk(shared), inner = mk(shared), other = mk(otherIusc);
  const kept = bingFilter([outer, inner, other], 'div.g');
  check('选择器-067: Bing图片同一卡片的嵌套容器按 a.iusc 文档序去重', kept.length === 2 && kept[0] === outer && kept[1] === other);
  check('选择器-176: Bing图片同来源页的不同图片不被去重', bingFilter([mk({ id: 'i1' }), mk({ id: 'i2' })], 'div.g').length === 2);
}
})();

// ---- 引擎站装配 / 拆卸 / 刷新 ----
await (async () => {
const refreshEngineSiteFn = extractFn(src, 'refreshEngineSite');


function createTeardownEnv() {
  const observed = [{ removeAttributeCalls: 0, unobserved: 0, reset: 0, removeAttribute() { this.removeAttributeCalls++; } }];
  const statusEl = { removed: 0, remove() { this.removed++; } };
  const observer = { disconnectCalls: 0, disconnect() { this.disconnectCalls++; } };
  const counters = { removeGlobalCalls: 0, stopSyncCalls: 0 };
  const documentStub = { querySelectorAll: (sel) => (sel === '[data-observed]' ? observed : []), getElementById: (id) => (id === 'serh-status' ? statusEl : null) };
  const resultObserver = { unobserve(el) { el.unobserved++; } };
  const api = new Function('document', 'resultObserver', 'statusEl', 'observer', 'counters', `
    let _engineSiteSetup = true; let _domObserver = observer;
    let _hrefUrlCache = new WeakMap(); const _hrefChangedContainers = new Set();
    const _contentChangedContainers = new Set(); let _resultContentCache = new WeakMap();
    let _resultRetryCounts = new WeakMap();
    _contentChangedContainers.add({});
    _resultRetryCounts.set({}, 1); let showHiddenResults = true;
    let _observedSelector = '.a'; let forceReprocessBatchId = 5;
    let _searchForm = null; let _searchFormHandler = null;
    let _blockConfirmOutsideHandler = null; function resetResultStyles(el) { el.reset++; }
    function clearTimeout() {} function removeGlobalStyles() { counters.removeGlobalCalls++; }
    function stopBackgroundSync() { counters.stopSyncCalls++; }
    ${extractFn(src, 'teardownEngineSite')}
    return { teardownEngineSite, state: () => ({ setup: _engineSiteSetup, observer: _domObserver, showHidden: showHiddenResults, observedSelector: _observedSelector, batchId: forceReprocessBatchId }) };
  `)(documentStub, resultObserver, statusEl, observer, counters);
  return { api, counters, statusEl, observer, observed };
}
{
  const { api, counters, statusEl, observer, observed } = createTeardownEnv();
  api.teardownEngineSite();
  api.teardownEngineSite();
  check('选择器-075: 重复 teardown 不重复执行', counters.removeGlobalCalls === 1 && statusEl.removed === 1);
}

// 内容快照签名
{
  const sigApi = new Function(`
    function getSearchEngine() { return 'test'; } function getResultLink(container) { return container.link; }
    function resolveUrlDomain(link) { return { url: link.href, domain: 'example.com' }; } function getResultTitle(container) { return container.title; }
    function getResultSnippet(container) { return container.snippet; }
    ${extractFn(src, 'buildContentSignature')}
    ${extractFn(src, 'getResultContentSignature')}
    return { buildContentSignature, getResultContentSignature };
  `)();
  const bad = { link: { get href() { throw new Error('boom'); } }, title: 't', snippet: 's' };
  check('选择器-080: 提取异常返回 null 而不崩溃', sigApi.getResultContentSignature(bad) === null);
}

// reprocessContainer: processSingleResult 以 data-blocker-processed 短路, 重处理前须先清除
{
  const reprocessFn = extractFn(src, 'reprocessContainer');
  function makeFactory(processImpl) {
    const calls = { process: 0, reset: 0, reconcile: 0, observe: 0 };
    const api = new Function('calls', 'resultObserver', `
      const currentConfig = { debug: false }; function resetResultStyles(el) { calls.reset++; }
      function processSingleResult(el) { calls.process++; ${processImpl} } function reconcileHiddenParents() { calls.reconcile++; }
      ${reprocessFn}
      return { reprocessContainer };
    `)(calls, { observe() { calls.observe++; } });
    return { calls, api };
  }
  function makeContainer(connected) {
    return {
      isConnected: connected !== false, attrs: {}, staleBtn: null,
      setAttribute(n, v) { this.attrs[n] = String(v); },
      getAttribute(n) { return Object.prototype.hasOwnProperty.call(this.attrs, n) ? this.attrs[n] : null; },
      hasAttribute(n) { return Object.prototype.hasOwnProperty.call(this.attrs, n); },
      removeAttribute(n) { delete this.attrs[n]; },
      querySelector(sel) { return sel === '.serh-quick-block' ? this.staleBtn : null; },
    };
  }
  {
    const { calls, api } = makeFactory("throw new Error('boom');");
    const el = makeContainer();
    api.reprocessContainer(el);
    check('选择器-083: 重处理异常不标记完成且转交观察器重试', el.hasAttribute('data-blocker-processed') === false && calls.observe === 1);
    const gone = makeContainer(false);
    api.reprocessContainer(gone);
  }
}

// scheduleResultRetry 有限次重试
{
  const retryFn = extractFn(src, 'scheduleResultRetry');
  const limitMatch = src.match(/const RESULT_RETRY_LIMIT = (\d+)/);
  const delayMatch = src.match(/RESULT_RETRY_DELAY = (\d+)/);
  function makeRetryEnv() {
    const timers = [];
    const api = new Function('resultObserver', 'timers', `
      let _engineSiteSetup = true; let _resultRetryCounts = new WeakMap();
      let _resultContentCache = new WeakMap(); function getResultContentSignature() { return 'sig'; }
      const RESULT_RETRY_LIMIT = ${limitMatch ? limitMatch[1] : 3};
      const RESULT_RETRY_DELAY = ${delayMatch ? delayMatch[1] : 200}; const setTimeout = (fn, ms) => { timers.push({ fn, ms }); return timers.length; };
      ${retryFn}
      return { scheduleResultRetry, hasCount: (el) => _resultRetryCounts.has(el), hasCached: (el) => _resultContentCache.has(el) };
    `)({ observe(el) { el.observeCount = (el.observeCount || 0) + 1; }, unobserve(el) { el.unobserveCount = (el.unobserveCount || 0) + 1; } }, timers);
    return { api, timers };
  }
  function makeRetryEl() {
    return {
      isConnected: true, attrs: {},
      setAttribute(n, v) { this.attrs[n] = String(v); },
      hasAttribute(n) { return Object.prototype.hasOwnProperty.call(this.attrs, n); },
      removeAttribute(n) { delete this.attrs[n]; },
    };
  }
  {
    const { api, timers } = makeRetryEnv();
    const el = makeRetryEl();
    api.scheduleResultRetry(el);
    check('选择器-086: 首次异常安排延迟重试且重试后保持 data-observed 不变量', timers.length === 1 && timers[0].ms === Number(delayMatch[1]) && (() => { timers[0].fn(); return el.observeCount === 1 && el.hasAttribute('data-observed') === true && el.hasAttribute('data-retry-exhausted') === false && api.hasCount(el); })());
  }
  {
    const { api, timers } = makeRetryEnv();
    const el = makeRetryEl();
    api.scheduleResultRetry(el); timers[0].fn();
    api.scheduleResultRetry(el); timers[1].fn();
    api.scheduleResultRetry(el); timers[2].fn();
    api.scheduleResultRetry(el);
    check('选择器-089: 超限后保留 data-observed 并标记待正文变化复活', timers.length === 3 && el.hasAttribute('data-observed') === true && el.hasAttribute('data-retry-exhausted') === true && api.hasCached(el) && el.unobserveCount === 1 && !api.hasCount(el));
  }
}

// URL 监听独立注册, 自定义 URL 引擎可从站内 SPA 进入搜索页装配
{
  const listeners = {}; const calls = { refresh: 0, reset: 0 };
  const history = { pushState() {}, replaceState() {} };
  const location = { href: 'https://start.example.com/' };
  const windowStub = { addEventListener: (n, fn) => { (listeners[n] = listeners[n] || []).push(fn); }, dispatchEvent: () => {} };
  const api = new Function('window', 'location', 'history', 'Event', 'getSearchCategory', 'refreshEngineSite', 'resetSelectorCache', `
    let _urlChangeHandler = null;
    ${extractFn(src, 'ensureUrlWatcher')}
    return { ensureUrlWatcher };
  `)(windowStub, location, history, class {}, () => 'web', () => { calls.refresh++; }, () => { calls.reset++; });
  api.ensureUrlWatcher();
  const registered = ['popstate', 'hashchange', 'serh:locationchange'].every((n) => Array.isArray(listeners[n]) && listeners[n].length === 1);
  location.href = 'https://start.example.com/search?q=x';
  listeners.popstate[0]();
  check('选择器-107: URL监听注册popstate/hashchange/自定义事件且路径变化触发重置与刷新', registered && calls.reset === 1 && calls.refresh === 1);
}

// ensureEngineSiteSetup / refreshEngineSite
{
  function createEnsureEnv(engine) {
    const calls = { start: 0, inject: 0, build: 0, status: 0, scan: 0 };
    const api = new Function('calls', 'engine', `
      let _engineSiteSetup = false; let _domObserver = null; let _observedBody = null; let _hiddenParentCount = 0;
      let _observedSelector = ''; let _searchForm = null;
      let _searchFormHandler = null; let _urlChangeHandler = null;
      function bindSearchForm() {} function syncBodyBindings() {} function applyDarkModeClass() {} function applyCollapseMode() {}
      function isEngineSite() { return engine; } function injectGlobalStyles() { calls.inject++; }
      function buildRuleIndex() { calls.build++; } function updateStatus() { calls.status++; }
      function scanNewResults() { calls.scan++; } function startBackgroundSync() { calls.start++; }
      function exposeDebugApi() {} function forceReprocessAll() {}
      function getSearchCategory() { return 'web'; } function resetSelectorCache() {}
      function refreshEngineSite() {} const location = { href: 'https://www.google.com' };
      const history = { pushState() {}, replaceState() {} }; const window = { addEventListener() {}, dispatchEvent() {} };
      const document = { body: {}, querySelector() { return null; } }; class MutationObserver { observe() {} disconnect() {} }
      ${extractFn(src, 'ensureEngineSiteSetup')}
      return { ensureEngineSiteSetup, state: () => ({ setup: _engineSiteSetup }) };
    `)(calls, engine);
    return { api, calls };
  }
  function createRefreshEnv(engine, setup) {
    const calls = { ensure: 0, force: 0, teardown: 0, layout: 0 };
    const api = new Function('calls', 'engine', 'setup', `
      let _engineSiteSetup = setup; function isEngineSite() { return engine; } function syncBodyBindings() {}
      function ensureEngineSiteSetup() { if (_engineSiteSetup) return; _engineSiteSetup = true; calls.ensure++; } function forceReprocessAll() { calls.force++; }
      function teardownEngineSite() { if (!_engineSiteSetup) return; _engineSiteSetup = false; calls.teardown++; } function injectGlobalStyles() { calls.layout++; }
      ${refreshEngineSiteFn}
      return { refreshEngineSite, getSetup: () => _engineSiteSetup };
    `)(calls, engine, setup);
    return { api, calls };
  }
  const { api, calls } = createEnsureEnv(true);
  api.ensureEngineSiteSetup();
  const env2 = createEnsureEnv(false);
  env2.api.ensureEngineSiteSetup();
  const a = createRefreshEnv(true, false); a.api.refreshEngineSite();
  const b = createRefreshEnv(false, true); b.api.refreshEngineSite();
  const c = createRefreshEnv(false, false); c.api.refreshEngineSite();
  check('选择器-093: 站点身份变化正确装配/拆卸/无操作', a.calls.ensure === 1 && a.calls.force === 1 && a.api.getSetup() === true && b.calls.teardown === 1 && b.api.getSetup() === false && c.calls.force === 0 && c.calls.teardown === 0);
  // 修复留档: body替换后重放主题/折叠并继续观察
  {
    const calls = { dark: 0, collapse: 0, form: 0, status: 0 };
    const doc = { body: { id: 'new' }, querySelectorAll: () => [] };
    const bodyApi = new Function('document', 'applyDarkModeClass', 'applyCollapseMode', 'bindSearchForm', 'updateStatus', `
      let _engineSiteSetup = true; let _observedBody = { id: 'old' }; let _hiddenParentCount = 3;
      ${extractFn(src, 'syncBodyBindings')}
      return { syncBodyBindings, state: () => ({ count: _hiddenParentCount, same: _observedBody === document.body }) };
    `)(doc, () => calls.dark++, () => calls.collapse++, () => calls.form++, () => calls.status++);
    bodyApi.syncBodyBindings();
    const st = bodyApi.state();
    check('选择器-109: body替换后同步绑定重放主题/折叠并重置隐藏计数', st.count === 0 && st.same === true && calls.dark === 1 && calls.collapse === 1 && calls.form === 1 && calls.status === 1);
  }
}

// 跨标签页选择器变更检测已由 test-connect 的同步锁用例覆盖, 此处不再重复
})();

// ---- 引擎检测与全站门控 ----
await (async () => {
const selectors = eval(`(${getSelectorsObjectText()})`);
const fnBody = extractFn(src, 'getSearchEngine');
const factory = new Function('window', 'SELECTORS', `let _engineCacheHost = null; let _engineCacheResult = 'other';
function getSelectors() { return SELECTORS; }
${fnBody}
${extractFn(src, 'getSearchCategory')}
return { getSearchEngine, getSearchCategory };`);

// 每引擎保留代表域名, 边界保留前缀不命中与仿冒后缀
const cases = [
  ['www.bing.com', 'bing'], ['www5.bing.com', 'other'],
  ['duckduckgo.com', 'duckduckgo'], ['lite.duckduckgo.com', 'duckduckgo_lite'],
  ['search.yahoo.com', 'yahoo'], ['search.yahoo.co.jp', 'yahoo_japan'], ['r.search.yahoo.co.jp', 'yahoo_japan'],
  ['news.search.yahoo.com', 'yahoo'], ['www.search.yahoo.co.jp', 'yahoo_japan'], ['rd.yahoo.co.jp', 'other'], ['search.yahoo.com.evil.com', 'other'], ['search.yahoo.co.jp.evil.com', 'other'],
  ['scholar.google.com', 'google_scholar'], ['mail.google.com', 'other'],
  ['www.ecosia.org', 'ecosia'], ['ecosia.org.evil.com', 'other'],
  ['example.com', 'other'],
];
for (const [i, [host, expected, href]] of cases.entries()) assert(`选择器-096-${i + 1}: ${host} -> ${expected}`, factory({ location: href ? { hostname: host, href } : { hostname: host } }, selectors).getSearchEngine() === expected);
check('选择器-208: yahoo 不含 co.jp 且日文站由 yahoo_japan 独占', !/co\.jp/.test(selectors.yahoo.match.source) && Object.keys(selectors).indexOf('yahoo_japan') < Object.keys(selectors).indexOf('yahoo') && selectors.yahoo_japan.match.test('search.yahoo.co.jp') && !selectors.yahoo_japan.match.test('search.yahoo.com'));

const googlePages = [
  ['https://www.google.com/search?q=x', 'google'],
  ['https://www.google.com/', 'google'],
  ['https://www.google.co.jp/search?q=x', 'google'],
  ['https://www.google.com/maps', 'other'],
  ['https://www.google.com/url?q=https://a.com', 'other'],
  ['https://news.google.com/', 'other'],
  ['https://www.google.com.evil.com/', 'other'],
];
for (const [i, [href, expected]] of googlePages.entries()) {
  const host = new URL(href).hostname;
  assert(`选择器-096d-${i + 1}: ${href} -> ${expected}`, factory({ location: { hostname: host, href } }, selectors).getSearchEngine() === expected);
}

const pageCases = [
  [{ hostname: 'github.com', href: 'https://github.com/Carteahere/Search-Engine-Result-Hider' }, 'other'],
  [{ hostname: 'github.com', href: 'https://github.com/search?q=123&type=repositories' }, 'github'],
  [{ hostname: 'greasyfork.org', href: 'https://greasyfork.org/zh-CN/scripts/552394' }, 'other'],
  [{ hostname: 'greasyfork.org', href: 'https://greasyfork.org/zh-CN/scripts?q=123' }, 'greasyfork'],
];
for (const [i, [location, expected]] of pageCases.entries()) assert(`选择器-096b-${i + 1}: ${location.href} -> ${expected}`, factory({ location }, selectors).getSearchEngine() === expected);

// 搜索分类检测(每引擎保留代表) — loc.href 与真实 location 同口径, 由 hostname/pathname/search 拼出
const catCases = [
  [{ hostname: 'www.google.com', pathname: '/search', search: '?udm=7', href: 'https://www.google.com/search?udm=7' }, 'videos'],
  [{ hostname: 'www.google.com', pathname: '/search', search: '?q=x&udm=vids', href: 'https://www.google.com/search?q=x&udm=vids' }, 'videos'],
  [{ hostname: 'www.google.com', pathname: '/search', search: '?q=x&tbm=vids', href: 'https://www.google.com/search?q=x&tbm=vids' }, 'videos'],
  [{ hostname: 'www.bing.com', pathname: '/images/search', search: '?q=x', href: 'https://www.bing.com/images/search?q=x' }, 'images'],
  [{ hostname: 'duckduckgo.com', pathname: '/', search: '?iax=images', href: 'https://duckduckgo.com/?iax=images' }, 'images'],
  [{ hostname: 'www.startpage.com', pathname: '/sp/search', search: '?query=x&category=images', href: 'https://www.startpage.com/sp/search?query=x&category=images' }, 'web'],
  [{ hostname: 'so.toutiao.com', pathname: '/search', search: '?keyword=x&pd=video', href: 'https://so.toutiao.com/search?keyword=x&pd=video' }, 'videos'],
];
for (const [i, [loc, expected]] of catCases.entries()) assert(`选择器-098-${i + 1}: category ${loc.hostname}${loc.pathname}${loc.search} -> ${expected}`, factory({ location: loc }, selectors).getSearchCategory(loc) === expected);
})();

// ---- 跨标签页同步锁 / 摘要后备 ----
await (async () => {
const lockFnNames = ['delay', 'readSyncLock', 'writeSyncLock', 'tryAcquireSyncLock', 'acquireSyncLock', 'renewSyncLock', 'releaseSyncLock', 'runWithSyncLock', 'runBackgroundSync'];
const lockFns = lockFnNames.map((n) => {
  const body = extractFn(src, n);
  const idx = src.indexOf(`function ${n}(`);
  return src.slice(idx - 6, idx) === 'async ' ? `async ${body}` : body;
});
const lockStore = new Map();
function createLockEnv(tabId, ttl = 2000) {
  return new Function('GM_getValue', 'GM_setValue', 'SYNC_LOCK_KEY_PREFIX', 'SYNC_LOCK_TTL', 'SYNC_TAB_ID', `
    ${lockFns.join('\n')}
    const _syncLocalChains = new Map();
    return { readSyncLock, tryAcquireSyncLock, acquireSyncLock, renewSyncLock, releaseSyncLock, runWithSyncLock, runBackgroundSync };
  `)((key, defaultValue) => (lockStore.has(key) ? lockStore.get(key) : defaultValue), (key, value) => lockStore.set(key, value), 'test_lock_', ttl, tabId);
}
{
  const tab1 = createLockEnv('tab-a');
  const tab2 = createLockEnv('tab-b');
  let ran1 = 0, ran2 = 0;
  const p1 = tab1.runWithSyncLock('race', async () => { ran1++; await new Promise((r) => setTimeout(r, 30)); });
  const p2 = tab2.runWithSyncLock('race', async () => { ran2++; await new Promise((r) => setTimeout(r, 30)); });
  await Promise.all([p1, p2]);
  check('选择器-106: 并发抢占仅一个执行者且完成后锁释放', ran1 + ran2 === 1 && tab1.readSyncLock('race') === null && tab2.readSyncLock('race') === null);
}
{
  const tab = createLockEnv('tab-c');
  let threw = false;
  try { await tab.runWithSyncLock('fail', async () => { throw new Error('boom'); }); } catch (e) { threw = true; }
  check('选择器-108: 任务异常仍释放锁', threw === true && tab.readSyncLock('fail') === null);
}

// 结果摘要后备提取遇到相对选择器不得抛异常
await (async () => {
  const selectorsDecl = src.match(/const SELECTORS = \{[\s\S]*?\n  \};/)[0];
  const getResultSnippet = new Function('GM_getValue', 'let activeSelectors = null;\nconst SELECTORS_KEY = \'searchfilter_selectors\'; const ENGINE_SUBSCRIPTIONS_KEY = \'searchfilter_engine_subscriptions\'; const BUILTIN_ENGINE_SUB_URL = \'https://raw.githubusercontent.com/Carteahere/Search-Engine-Result-Hider/main/Other/SELECTORS.js\'; function t(key) { return key; } function resetSelectorCache() { activeSelectors = null; }\nconst CATEGORY_FIELDS = [\'containers\', \'titles\', \'snippets\', \'links\', \'extraElements\', \'button\', \'match\'];\nlet _catDefCacheKey = null; let _catDefCache = null; let _categoryCacheHref = null; let _categoryCacheResult = \'web\'; let _categoryCacheEngine = null;\nfunction getSearchCategory() { return \'web\'; }\n' + selectorsDecl + '\n' + src.match(/const builtinSelectorOf = .+?;/)[0] + '\n' + ['normalizeSelectorList', 'hasTopLevelComma', 'normalizeCategoryMap', 'mergeSelectorDef', 'getUserSelectors', 'getEngineSubscriptions', 'saveEngineSubscriptions', 'parseSelectorMatch', 'coerceSelectorDef', 'coerceCategoryMatch', 'getSubscribedSelectors', 'getBaseSelectors', 'getSelectors', 'resolveCategoryDef', 'queryResultSelector', 'getResultText', 'getResultExtraElements', 'getResultSnippet'].map((n) => extractFn(src, n)).join('\n') + '\nreturn getResultSnippet;')(() => undefined);
  const throwIfRel = (fn) => (sel) => { if (sel.startsWith('+')) { const e = new Error(sel + ' is not a valid selector'); e.name = 'SyntaxError'; throw e; } return fn(sel); };
  let threw = false, out = '';
  const extraRow = { textContent: '  extra text  ', matches: throwIfRel(() => false), querySelector: throwIfRel(() => null), contains: () => false };
  const resultEl = { textContent: '', querySelector: throwIfRel(() => null), parentElement: null };
  resultEl.parentElement = { children: [resultEl, extraRow], querySelectorAll: (sel) => (String(sel).includes(':nth-child(1)') ? [extraRow] : []) };
  try { out = getResultSnippet(resultEl, 'duckduckgo_lite'); } catch (e) { threw = true; }
  check('选择器-110: 相对选择器后备提取不抛异常', threw === false && out === '');
})();

// 修复回归: 顶层逗号判定 / 折叠CSS按引擎限域
{
  const mkComma = (srcText) => new Function(extractFn(srcText, 'hasTopLevelComma') + '\nreturn hasTopLevelComma;')();
  const commaMain = mkComma(src), commaLite = mkComma(readRepoFile('Lite.user.js'));
  check('选择器-181: 引号与括号内逗号不算顶层逗号(主版+Lite)', commaMain('[data-x="a,b"]') === false && commaMain(':is(.a,.b)') === false && commaMain('.a, .b') === true && commaLite('[data-x="a,b"]') === false && commaLite('.a, .b') === true);
}

// 修复回归: Google图片结果自身是网格项时不得越级隐藏祖先
{
  const mkEl = (tag, cls) => ({ tagName: tag, className: cls, style: { display: '' }, attrs: {}, children: [], parentElement: null, grid: false,
    setAttribute(k, v) { this.attrs[k] = v; }, getAttribute(k) { return this.attrs[k] ?? null; },
    querySelectorAll(sel) { const out = []; const walk = (n) => { for (const c of n.children) { if (sel === 'div.isv-r, div.ivg-i' && (c.className === 'isv-r' || c.className === 'ivg-i')) out.push(c); walk(c); } }; walk(this); return out; } });
  const add = (p, c) => { c.parentElement = p; p.children.push(c); return c; };
  const mkMark = (srcText) => new Function('getComputedStyle', `
    let _hiddenParentCount = 0;
    ${extractFn(srcText, 'getGridLeaves')}
    ${extractFn(srcText, 'gridLeafBlocked')}
    ${extractFn(srcText, 'hideGridCell')}
    ${extractFn(srcText, 'markResultGridSlot')}
    return markResultGridSlot;
  `)((e) => ({ display: e.grid ? 'grid' : '' }));
  const selfCase = (mark) => {
    const body = mkEl('BODY', ''); const rcnt = add(body, mkEl('DIV', 'rcnt')); rcnt.grid = true;
    const center = add(rcnt, mkEl('DIV', 'center_col')); const grid = add(center, mkEl('DIV', 'rso')); grid.grid = true;
    const tile = add(grid, mkEl('div', 'isv-r')); tile.style.display = 'none'; tile.setAttribute('data-is-blocked', 'true');
    mark(tile, 'google'); return { center, grid };
  };
  const wrapCase = (mark, withVisible) => {
    const body = mkEl('BODY', ''); const rcnt = add(body, mkEl('DIV', 'rcnt')); rcnt.grid = true;
    const center = add(rcnt, mkEl('DIV', 'center_col')); const grid = add(center, mkEl('DIV', 'rso')); grid.grid = true;
    const wrap = add(grid, mkEl('DIV', 'wrap')); const t1 = add(wrap, mkEl('div', 'isv-r')); t1.style.display = 'none'; t1.setAttribute('data-is-blocked', 'true');
    if (withVisible) add(wrap, mkEl('div', 'isv-r'));
    mark(t1, 'google'); return { center, wrap };
  };
  const mainMark = mkMark(src), liteMark = mkMark(readRepoFile('Lite.user.js'));
  const s = selfCase(mainMark), sLite = selfCase(liteMark), a = wrapCase(mainMark, false), b = wrapCase(mainMark, true), c = wrapCase(liteMark, false);
  check('选择器-183: Google图片结果自身为网格项时不越级隐藏(主版+Lite)', s.center.style.display === '' && s.grid.style.display === '' && sLite.center.style.display === '' && a.center.style.display === '' && a.wrap.style.display === 'none' && b.center.style.display === '' && b.wrap.style.display === '' && c.wrap.style.display === 'none');
}

// JSON 转义 / __proto__ / 数字开头键 / 序列化往返
await (async () => {
  const mkApi = (srcText) => new Function(`
    const SUPPORTED_REGEX_FLAGS = 'imsu'; const t = (key) => key;
    function isValidCssSelector() { return true; } function hasPseudoElement() { return false; }
    ${extractFn(srcText, 'normalizeSelectorList')}
    ${extractFn(srcText, 'getInvalidRegexFlags')}
    ${extractFn(srcText, 'normalizeMatchLiteral')}
    ${extractFn(srcText, 'parseSelectorText')}
    ${extractFn(srcText, 'validateUserSelectors')}
    return { parseSelectorText, validateUserSelectors };
  `)();
  const apiM = mkApi(src);
  const R14 = apiM.parseSelectorText('__proto__: { match: "a", containers: ".x" }');
  const protoJson = apiM.parseSelectorText('{"__proto__":{"containers":".x","match":"x"}}');
  check('选择器-114: __proto__ 键单独输入解析失败且不污染对象(两种路径)', R14.config === null && R14.errors.length > 0 && protoJson.config === null && protoJson.errors.length > 0 && !Object.hasOwn(R14.config || {}, '__proto__'));
  const apiSer = new Function(`
    const SELECTORS = {};
    const CATEGORY_FIELDS = ['containers', 'titles', 'snippets', 'links', 'extraElements', 'button', 'match'];
    ${extractFn(src, 'normalizeSelectorList')}
    ${extractFn(src, 'normalizeCategoryMap')}
    ${extractFn(src, 'regexSourceToLiteralText')}
    ${extractFn(src, 'escapeJsString')}
    ${extractFn(src, 'matchDefToParts')}
    ${extractFn(src, 'serializeSelectors')}
    return serializeSelectors;
  `)();
  const PK = apiSer({ '123abc': { match: '(?:^|\\.)x\\.example\\.com$', containers: '.r', titles: [], snippets: [], links: 'a[href]' } });
  const RRT = apiM.parseSelectorText(PK);
  check('选择器-119: 序列化往返无损(数字开头键自动加引号)', PK.includes("'123abc':") && !RRT.errors.length && !!RRT.config && !!RRT.config['123abc'] && RRT.config['123abc'].match === '(?:^|\\.)x\\.example\\.com$');
})();
})();

// ==== 二、修复回归 ====

// ---- 父容器隐藏/恢复状态机 + bing cite回退 ----
{
  function matchesSel(el, sel) {
    return String(sel).split(',').some((s) => {
      s = s.trim(); let m;
      if ((m = s.match(/^([a-zA-Z][\w-]*)\.([\w-]+)$/))) return el.tag === m[1] && el.cls === m[2];
      if ((m = s.match(/^([a-zA-Z][\w-]*)\[([\w-]+)="([^"]*)"\]$/))) return el.tag === m[1] && el.attrs[m[2]] === m[3];
      if ((m = s.match(/^\.([\w-]+)$/))) return el.cls === m[1];
      if ((m = s.match(/^\[([\w-]+)\]$/))) return el.attrs[m[1]] !== undefined;
      if ((m = s.match(/^\[([\w-]+)="([^"]*)"\]$/))) return el.attrs[m[1]] === m[2];
      return /^[a-zA-Z][\w-]*$/.test(s) && el.tag === s;
    });
  }
  function makeTreeEl(tag, cls, parent) {
    const el = {
      tag, cls: cls || '', attrs: {}, style: { display: '', outline: '', outlineOffset: '' },
      classes: new Set(), children: [], parentElement: parent || null,
      setAttribute(k, v) { this.attrs[k] = String(v); },
      getAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null; },
      hasAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attrs, k); },
      removeAttribute(k) { delete this.attrs[k]; },
      matches(sel) { return matchesSel(this, sel); },
      closest(sel) { let cur = this; while (cur) { if (matchesSel(cur, sel)) return cur; cur = cur.parentElement; } return null; },
      walk() { const out = []; const rec = (n) => n.children.forEach((c) => { out.push(c); rec(c); }); rec(this); return out; },
      querySelector(sel) { return this.querySelectorAll(sel)[0] || null; },
      querySelectorAll(sel) { return this.walk().filter((e) => matchesSel(e, sel)); },
    };
    el.classList = { add: (c) => el.classes.add(c), remove: (c) => el.classes.delete(c), contains: (c) => el.classes.has(c) };
    Object.defineProperty(el, 'dataset', { get() {
      const ds = {};
      for (const k of Object.keys(this.attrs)) { const m = k.match(/^data-([a-z-]+)$/); if (m) ds[m[1].replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = this.attrs[k]; }
      return ds;
    } });
    if (parent) parent.children.push(el);
    return el;
  }
  function makeParentEnv(showHidden, srcText = src) {
    const root = makeTreeEl('body', '');
    const s = srcText;
    const fns = new Function('doc', `
      let showHiddenResults = ${!!showHidden};
      let _hiddenParentCount = 0;
      function blockedShown() { return showHiddenResults; }
      const _hrefUrlCache = new WeakMap(), _resultContentCache = new WeakMap(), _resultRetryCounts = new WeakMap();
      const map_resultExtraElements = new WeakMap();
      function getResultExtraElements() { return []; }
      ${extractFn(s, 'saveOriginalDisplay')}
      ${extractFn(s, 'googleResultBlocks')}
      ${extractFn(s, 'visibleUnblocked')}
      ${extractFn(s, 'getGridLeaves')}
      ${extractFn(s, 'gridLeafBlocked')}
      ${extractFn(s, 'hideGridCell')}
      ${extractFn(s, 'hideParentIfNoVisibleSiblings')}
      ${extractFn(s, 'markResultGridSlot')}
      ${extractFn(s, 'resetResultStyles')}
      ${extractFn(s, 'restoreParentDisplay')}
      ${extractFn(s, 'restoreAllHiddenParents')}
      ${extractFn(s, 'reconcileHiddenParents')}
      ${extractFn(s, 'clearMatchedData')}
      ${extractFn(s, 'removeMatchedRuleLabel')}
      ${extractFn(s, 'restoreResultExtraElements')}
      ${extractFn(s, 'restoreResultCollapse')}
      const document = { querySelectorAll: (s) => doc.querySelectorAll(s) };
      return { saveOriginalDisplay, googleResultBlocks, visibleUnblocked, hideParentIfNoVisibleSiblings, markResultGridSlot, hideGridCell, resetResultStyles, restoreParentDisplay, restoreAllHiddenParents, reconcileHiddenParents, getCount: () => _hiddenParentCount };
    `)(root);
    return { root, fns };
  }
  const blockEl = (fns, el) => { fns.saveOriginalDisplay(el); el.style.display = 'none'; el.setAttribute('data-is-blocked', 'true'); };
  {
    const { root, fns } = makeParentEnv(false);
    const P = makeTreeEl('div', 'MjjYud', root);
    const g1 = makeTreeEl('div', 'g', P);
    const g2 = makeTreeEl('div', 'g', P);
    blockEl(fns, g1);
    fns.hideParentIfNoVisibleSiblings(P, P.querySelectorAll('div.g'), 'data-blocker-google-parent');
    blockEl(fns, g2);
    fns.hideParentIfNoVisibleSiblings(P, P.querySelectorAll('div.g'), 'data-blocker-google-parent');
    check('选择器-123: 全部屏蔽后父隐藏且保存原display', P.style.display === 'none' && P.getAttribute('data-blocker-google-parent') === 'true' && P.getAttribute('data-serh-orig-display') === '');
    fns.resetResultStyles(g1);
    fns.reconcileHiddenParents();
    check('选择器-125: reconcile恢复存在可见未屏蔽子项的父容器', P.style.display === '' && !P.hasAttribute('data-blocker-google-parent') && !P.hasAttribute('data-serh-orig-display'));
  }
  {
    const { root, fns } = makeParentEnv(true);
    const P = makeTreeEl('div', 'MjjYud', root); P.style.display = 'flex';
    blockEl(fns, makeTreeEl('div', 'g', P)); blockEl(fns, makeTreeEl('div', 'g', P));
    fns.hideParentIfNoVisibleSiblings(P, P.querySelectorAll('div.g'), 'data-blocker-google-parent');
    check('选择器-128: 展开模式下父容器标记但内联flex被保留', P.style.display === 'flex' && P.getAttribute('data-blocker-google-parent') === 'true' && P.getAttribute('data-serh-orig-display') === 'flex');
  }
  {
    const { root, fns } = makeParentEnv(false);
    const P = makeTreeEl('div', 'MjjYud', root);
    const g = makeTreeEl('div', 'g', P);
    makeTreeEl('div', 'tF2Cxc', g);
    blockEl(fns, g);
    fns.hideParentIfNoVisibleSiblings(P, fns.googleResultBlocks(P), 'data-blocker-google-parent');
    check('选择器-130b: 嵌套tF2Cxc不再把已屏蔽的div.g误判为可见，父容器隐藏', P.style.display === 'none' && P.getAttribute('data-blocker-google-parent') === 'true' && fns.googleResultBlocks(P).length === 1);
    fns.resetResultStyles(g);
  }
  {
    const { root, fns } = makeParentEnv(false);
    const li = makeTreeEl('li', '', root);
    const iuscp = makeTreeEl('div', 'iuscp', li);
    const imgpt = makeTreeEl('div', 'imgpt', iuscp);
    blockEl(fns, iuscp); blockEl(fns, imgpt);
    li.style.display = 'none'; li.setAttribute('data-serh-grid-item-hidden', 'true');
    fns.resetResultStyles(iuscp);
    check('选择器-131: bing图片li槽位解除屏蔽后经closest标记恢复', li.style.display === '' && !li.hasAttribute('data-serh-grid-item-hidden') && iuscp.style.display === '' && iuscp.getAttribute('data-is-blocked') === null);
  }
  {
    const { root, fns } = makeParentEnv(false);
    const li = makeTreeEl('li', '', root);
    const iuscp = makeTreeEl('div', 'iuscp', li);
    const imgpt = makeTreeEl('div', 'imgpt', iuscp);
    makeTreeEl('a', 'iusc', imgpt);
    blockEl(fns, iuscp); fns.hideGridCell(li, 'data-serh-grid-item-hidden');
    fns.reconcileHiddenParents();
    const mainHidden = li.style.display === 'none' && li.getAttribute('data-serh-grid-item-hidden') === 'true';
    const lite = makeParentEnv(false, readRepoFile('Lite.user.js'));
    const liteLi = makeTreeEl('li', '', lite.root); const liteIuscp = makeTreeEl('div', 'iuscp', liteLi); const liteImgpt = makeTreeEl('div', 'imgpt', liteIuscp);
    makeTreeEl('a', 'iusc', liteImgpt); blockEl(lite.fns, liteIuscp); lite.fns.hideGridCell(liteLi, 'data-serhl-grid-item-hidden');
    lite.fns.reconcileHiddenParents();
    check('选择器-206: bing图片内层imgpt无标记但祖先iuscp已屏蔽时不恢复空槽位(主/Lite)', mainHidden && liteLi.style.display === 'none' && liteLi.getAttribute('data-serhl-grid-item-hidden') === 'true');
  }
  // 修复留档: 隐藏网格槽位后新增可见结果或子项被移除需恢复, 避免槽位永久空白
  {
    const { root, fns } = makeParentEnv(false);
    const cell = makeTreeEl('div', '', root);
    const c1 = makeTreeEl('div', '', cell); c1.setAttribute('data-attrid', 'images universal'); blockEl(fns, c1);
    fns.hideGridCell(cell, 'data-serh-grid-item-hidden'); fns.reconcileHiddenParents();
    makeTreeEl('div', '', cell).setAttribute('data-attrid', 'images universal');
    fns.reconcileHiddenParents();
    check('选择器-201: Google槽位新增可见data-attrid结果后恢复', cell.style.display === '' && !cell.hasAttribute('data-serh-grid-item-hidden'));
  }
  // 修复留档: 再次打开已存在面板只聚焦不销毁, 防止未保存规则和待同步丢失
  {
    const mkOpen = (srcText) => new Function('document', 'injectWidgetStyles', 'createPanel', 'bindOutsideClickClose', `${(srcText.match(/function openPanel\([\s\S]*?\n  \}\n/) || [''])[0]}\nreturn openPanel;`);
    const run = (srcText) => {
      let removed = 0, cleaned = 0, closed = 0;
      const existing = { _fading: false, _cleanupClick() { cleaned++; }, _beforeClose() { closed++; }, remove() { removed++; } };
      const openPanel = mkOpen(srcText)({ getElementById: () => existing }, () => {}, () => ({ panel: {} }), () => () => {});
      const ret = openPanel('serh-panel');
      return ret === null && removed === 0 && cleaned === 0 && closed === 0;
    };
    check('选择器-203: 再次打开已存在面板只聚焦不销毁未保存编辑(主/Lite)', run(src) && run(readRepoFile('Lite.user.js')));
  }
  {
    const linkApi = new Function('SELECTORS', `
      function toASCIIHostname(h) { return h; }
      function toASCIIUrl(u) { return u; }
      function getSelectors() { return SELECTORS; }
      const window = { location: { hostname: 'www.bing.com', href: 'https://www.bing.com/search?q=x' } };
      let _engineCacheHost = null; let _engineCacheResult = 'other'; let _categoryCacheHref = null; let _categoryCacheResult = 'web'; let _categoryCacheEngine = null; let _catDefCacheKey = null; let _catDefCache = null;
      function getSearchCategory() { return 'web'; }
      ${src.match(/const ENGINE_HOST_REGEXES = \{[\s\S]*?\n  \};/)[0]}
      function isEngineHost(engine, host) { const re = ENGINE_HOST_REGEXES[engine]; return !!re && re.test(String(host || '')); }
      ${extractFn(src, 'getSearchEngine')}
      ${extractFn(src, 'mergeSelectorDef')}
      ${extractFn(src, 'resolveCategoryDef')}
      ${extractFn(src, 'parseLinkSpec')}
      ${extractFn(src, 'extractLinkFromElement')}
      ${extractFn(src, 'decodeRedirectTarget')}
      ${extractFn(src, 'decodeBingCkTarget')}
      ${extractFn(src, 'isOpaqueRedirectUrl')}
      ${extractFn(src, 'unwrapRedirectUrl')}
      ${extractFn(src, 'getResultLink')}
      return { getResultLink };
    `)(eval(`(${getSelectorsObjectText()})`));
    function bingResult(href, citeText) {
      return { querySelector(sel) { if (sel === '.b_attribution, .b_algoheader cite, cite') return citeText ? { textContent: citeText } : null; return sel === 'h2 a[href]' ? { href } : null; } };
    }
    const badCk = 'https://www.bing.com/ck/a?!&u=a1!!!!';
    const goodCk = 'https://www.bing.com/ck/a?!&u=a1' + Buffer.from('https://example.org/page').toString('base64');
    const l1 = linkApi.getResultLink(bingResult(badCk, 'www.example.com'), 'bing');
    const l2 = linkApi.getResultLink(bingResult(badCk, 'www.bing.com'), 'bing');
    const l3 = linkApi.getResultLink(bingResult(goodCk, 'https://nope.example'), 'bing');
    check('选择器-132: bing解码失败回退cite裸域且cite为自身域名不回退且解码成功不回退', !!l1 && l1.href === 'https://www.example.com/' && !!l2 && l2.href === badCk && !!l3 && l3.href === goodCk);
  }
}

// ---- sameSelectorDef 比较 disabled / 字段级diff / 端到端校验与prune ----
{
  const selStore = { current: undefined };
  const selFns = ['normalizeSelectorList', 'normalizeCategoryMap', 'mergeSelectorDef', 'getUserSelectors', 'getEngineSubscriptions', 'saveEngineSubscriptions', 'parseSelectorMatch', 'coerceSelectorDef', 'coerceCategoryMatch', 'getSubscribedSelectors', 'getBaseSelectors', 'getSelectors', 'resetSelectorCache', 'getInvalidRegexFlags', 'regexSourceToLiteralText', 'escapeJsString', 'matchDefToParts', 'serializeSelectors', 'normalizeMatchLiteral', 'parseSelectorText', 'sameSelectorDef', 'diffSelectorDefFields', 'diffUserSelectors'].map((n) => extractFn(src, n));
  const selApi = new Function('GM_getValue', 'storeRef', `
const SELECTORS_KEY = 'searchfilter_selectors'; const ENGINE_SUBSCRIPTIONS_KEY = 'searchfilter_engine_subscriptions'; const BUILTIN_ENGINE_SUB_URL = 'https://raw.githubusercontent.com/Carteahere/Search-Engine-Result-Hider/main/Other/SELECTORS.js';
const SUPPORTED_REGEX_FLAGS = 'imsu';
const CATEGORY_FIELDS = ['containers', 'titles', 'snippets', 'links', 'extraElements', 'button', 'match'];
const SELECTORS = ${getSelectorsObjectText()};
let activeSelectors = null;
let _engineCacheHost = null;
${src.match(/const builtinSelectorOf = .+?;/)[0]}
let _engineCacheResult = 'other';
const window = { location: { hostname: 'www.google.com', href: 'https://www.google.com/' } };
function t(key) { return key; }
${selFns.join('\n')}
return { getSelectors, parseSelectorText, diffUserSelectors };
`)((key, def) => (key === 'searchfilter_selectors' ? (selStore.current === undefined ? def : selStore.current) : def), selStore);
  const mergedAll = selApi.getSelectors();
  const diff = selApi.diffUserSelectors(Object.assign({}, mergedAll, { bing: Object.assign({}, mergedAll.bing, { containers: 'div.custom' }) }));
  const pinningFields = ['match', 'titles', 'snippets', 'links'].filter((k) => k in (diff.bing || {}));
  check('选择器-135: 仅改一个字段时diff只保留该字段(升级内置可跟随)', 'bing' in diff && pinningFields.length === 0 && diff.bing.containers === 'div.custom');

  const fixApi = new Function(`
const SELECTORS_KEY = 'searchfilter_selectors'; const ENGINE_SUBSCRIPTIONS_KEY = 'searchfilter_engine_subscriptions'; const BUILTIN_ENGINE_SUB_URL = 'https://raw.githubusercontent.com/Carteahere/Search-Engine-Result-Hider/main/Other/SELECTORS.js';
const SELECTORS = ${getSelectorsObjectText()};
let activeSelectors = null; let _engineCacheHost = null; let _engineCacheResult = 'other'; let _observedSelector = '';
let stored = undefined;
const GM_getValue = (key, def) => (key === SELECTORS_KEY && stored !== undefined ? stored : def);
const GM_setValue = (key, val) => { if (key === SELECTORS_KEY) stored = val; };
const t = (key) => key;
const isValidCssSelector = () => true;
const hasPseudoElement = (s) => /::/.test(String(s));
const builtinSelectorOf = (key) => (SELECTORS[key] && typeof SELECTORS[key] === 'object') ? SELECTORS[key] : {};
${['normalizeSelectorList', 'normalizeCategoryMap', 'getInvalidRegexFlags', 'matchDefToParts', 'resetSelectorCache', 'getUserSelectors', 'getEngineSubscriptions', 'saveEngineSubscriptions', 'parseSelectorMatch', 'coerceSelectorDef', 'coerceCategoryMatch', 'getSubscribedSelectors', 'getBaseSelectors', 'parseSelectorText', 'validateUserSelectors', 'sameSelectorDef', 'pruneUserSelectors'].map((n) => extractFn(src, n)).join('\n')}
return { parseSelectorText, validateUserSelectors, pruneUserSelectors, SELECTORS, getStored: () => stored, setStored: (v) => { stored = v; } };
  `)();
  const parsedTrue = fixApi.parseSelectorText('{"bing": true}');
  check('选择器-136: {"bing": true} 端到端被校验拦截, 不以空配置覆盖存储', 'bing' in parsedTrue.config && fixApi.validateUserSelectors(parsedTrue.config).length > 0);
}



// ---- Google goto 包裹回退 ----
{
  const linkApiG = new Function('SELECTORS', `
    function toASCIIHostname(h) { return h; }
    function toASCIIUrl(u) { return u; }
    function getSelectors() { return SELECTORS; }
    const window = { location: { hostname: 'www.google.com', href: 'https://www.google.com/search?q=x', origin: 'https://www.google.com' } };
    const location = window.location;
    let _engineCacheHost = null; let _engineCacheResult = 'other'; let _categoryCacheHref = null; let _categoryCacheResult = 'web'; let _categoryCacheEngine = null; let _catDefCacheKey = null; let _catDefCache = null;
    function getSearchCategory() { return 'web'; }
    ${src.match(/const ENGINE_HOST_REGEXES = \{[\s\S]*?\n  \};/)[0]}
    function isEngineHost(engine, host) { const re = ENGINE_HOST_REGEXES[engine]; return !!re && re.test(String(host || '')); }
    const isNotGoogleHost = (h) => !!h && !isEngineHost('google', h);
    ${extractFn(src, 'getSearchEngine')}
    ${extractFn(src, 'mergeSelectorDef')}
    ${extractFn(src, 'resolveCategoryDef')}
    ${extractFn(src, 'parseLinkSpec')}
    ${extractFn(src, 'extractLinkFromElement')}
    ${extractFn(src, 'decodeRedirectTarget')}
    ${extractFn(src, 'decodeBingCkTarget')}
    ${extractFn(src, 'isOpaqueRedirectUrl')}
    ${extractFn(src, 'unwrapRedirectUrl')}
    ${extractFn(src, 'getResultLink')}
    return { getResultLink };
  `)(eval(`(${getSelectorsObjectText()})`));
  const PILL = '.lJQCTe, .XVWGNd, .R8BTeb, span.ob9lvb, .eip8Bb';
  const gotoUrl = 'https://www.google.com/goto?url=CAESAb1_-Ab1_-Ab1_-Ab1_-Ab1_-Ab1_-Ab1_-Ab1_-Ab1_-Ab1_-Ab1_-';
  const citeText = 'https://blog.hubspot.com › Website';
  const citeEl = { textContent: citeText };
  const pillEl = { textContent: '› Website', closest: (sel) => (sel === 'cite' ? citeEl : null) };
  const gotoEl = () => ({ href: gotoUrl, getAttribute: () => null, setAttribute: () => {} });
  const resGoto = {
    querySelector(sel) { return sel === PILL ? pillEl : gotoEl(); },
    querySelectorAll(sel) { return sel === 'cite' ? [citeEl] : []; }
  };
  const g5 = linkApiG.getResultLink(resGoto, 'google');
  check('选择器-163: goto包裹经pill→cite完整文本恢复可见域名', !!g5 && g5.href === 'https://blog.hubspot.com');
}

// ---- 顶层 links 字符串提取 / 容器自身标题 ----
{
  const linkApiS = new Function('SELECTORS', `
    function toASCIIHostname(h) { return h; }
    function toASCIIUrl(u) { return u; }
    function getSelectors() { return SELECTORS; }
    const window = { location: { hostname: 'search.example.com', href: 'https://search.example.com/', origin: 'https://search.example.com' } };
    const location = window.location;
    let _engineCacheHost = null; let _engineCacheResult = 'other'; let _categoryCacheHref = null; let _categoryCacheResult = 'web'; let _categoryCacheEngine = null; let _catDefCacheKey = null; let _catDefCache = null;
    function getSearchCategory() { return 'web'; }
    ${src.match(/const ENGINE_HOST_REGEXES = \{[\s\S]*?\n  \};/)[0]}
    function isEngineHost(engine, host) { const re = ENGINE_HOST_REGEXES[engine]; return !!re && re.test(String(host || '')); }
    const isNotGoogleHost = (h) => !!h && !isEngineHost('google', h);
    ${extractFn(src, 'getSearchEngine')}
    ${extractFn(src, 'mergeSelectorDef')}
    ${extractFn(src, 'resolveCategoryDef')}
    ${extractFn(src, 'parseLinkSpec')}
    ${extractFn(src, 'extractLinkFromElement')}
    ${extractFn(src, 'decodeRedirectTarget')}
    ${extractFn(src, 'decodeBingCkTarget')}
    ${extractFn(src, 'isOpaqueRedirectUrl')}
    ${extractFn(src, 'unwrapRedirectUrl')}
    ${extractFn(src, 'getResultLink')}
    return { getResultLink };
  `)({ test: { match: /search\.example\.com/, containers: '.r', titles: [], snippets: [], links: 'a.thumb@json:data.url' } });
  const thumb = { getAttribute: (a) => a === 'data' ? '{"url":"https://example.com/x"}' : null, setAttribute() {} };
  const res = { matches: () => false, querySelector: (s) => s === 'a.thumb' ? thumb : null };
  const l = linkApiS.getResultLink(res, 'test');
  check('选择器-214: 顶层links字符串@json提取生效', !!l && l.href === 'https://example.com/x');
}
{
  const titleApi = new Function(`
    function resolveCategoryDef() { return { titles: ['a.result'], snippets: ['.snip'] }; }
    ${extractFn(src, 'queryResultSelector')}
    ${extractFn(src, 'getResultText')}
    ${extractFn(src, 'parseTitleSpec')}
    ${extractFn(src, 'getResultTextFromSpec')}
    ${extractFn(src, 'getResultTitle')}
    ${extractFn(src, 'getResultTitleElement')}
    return { getResultTitle, getResultTitleElement, getResultText };
  `)();
  const res = { textContent: 'Example title', matches: (s) => s === 'a.result' || s === '.snip', querySelector: () => null };
  check('选择器-215: 结果容器自身作为标题/摘要时仍可提取', titleApi.getResultTitle(res, 'test') === 'Example title' && titleApi.getResultText(res, ['.snip']) === 'Example title' && titleApi.getResultTitleElement(res, 'test') === res);
}

// ---- 图片/视频/新闻真实卡片容器取链接 ----
{
  const linkApiC = new Function('SELECTORS', `
    function toASCIIHostname(h) { return h; }
    function toASCIIUrl(u) { return u; }
    function getSelectors() { return SELECTORS; }
    let currentHref = 'https://www.google.com/search?q=x&tbm=isch';
    const window = { location: { get hostname() { return new URL(currentHref).hostname; }, get href() { return currentHref; }, get origin() { return new URL(currentHref).origin; } } };
    const location = window.location;
    let _engineCacheHost = null; let _engineCacheResult = 'other'; let _categoryCacheHref = null; let _categoryCacheResult = 'web'; let _categoryCacheEngine = null; let _catDefCacheKey = null; let _catDefCache = null;
    const CATEGORY_FIELDS = ['containers', 'titles', 'snippets', 'links', 'extraElements', 'button', 'match'];
    ${src.match(/const ENGINE_HOST_REGEXES = \{[\s\S]*?\n  \};/)[0]}
    function isEngineHost(engine, host) { const re = ENGINE_HOST_REGEXES[engine]; return !!re && re.test(String(host || '')); }
    const isNotGoogleHost = (h) => !!h && !isEngineHost('google', h);
    ${extractFn(src, 'getSearchEngine')}
    ${extractFn(src, 'getSearchCategory')}
    ${extractFn(src, 'normalizeSelectorList')}
    ${extractFn(src, 'normalizeCategoryMap')}
    ${extractFn(src, 'mergeSelectorDef')}
    ${extractFn(src, 'resolveCategoryDef')}
    ${extractFn(src, 'parseLinkSpec')}
    ${extractFn(src, 'extractLinkFromElement')}
    ${extractFn(src, 'decodeRedirectTarget')}
    ${extractFn(src, 'decodeBingCkTarget')}
    ${extractFn(src, 'isOpaqueRedirectUrl')}
    ${extractFn(src, 'unwrapRedirectUrl')}
    ${extractFn(src, 'getResultLink')}
    return { getResultLink, setHref: (h) => { currentHref = h; } };
  `)(eval(`(${getSelectorsObjectText()})`));
  const selfAttr = (name, value) => { const el = { tagName: 'DIV', getAttribute: (a) => a === name ? value : null, setAttribute() {}, querySelector: (s) => (s === `[${name}]` ? el : null) }; return el; };
  const childAttr = (sel, name, value) => ({ tagName: 'DIV', getAttribute: () => null, setAttribute() {}, querySelector: (s) => s === sel ? selfAttr(name, value) : null });
  const gImg = linkApiC.getResultLink(selfAttr('data-lpage', 'https://img.example.com/page'), 'google');
  linkApiC.setHref('https://www.google.com/search?q=x&tbm=vid');
  const gVid = linkApiC.getResultLink(childAttr('[data-curl]', 'data-curl', 'https://www.youtube.com/watch?v=abc'), 'google');
  linkApiC.setHref('https://www.google.com/search?q=x&tbm=nws');
  const gNewsEl = { tagName: 'A', href: 'https://www.google.com/goto?url=abc', getAttribute: () => null, setAttribute() {}, querySelector: (sel) => (sel === ':scope[href]' || sel === 'a[href]' ? gNewsEl : null) };
  const gNews = linkApiC.getResultLink(gNewsEl, 'google');
  linkApiC.setHref('https://www.bing.com/videos/search?q=x');
  const bVid = linkApiC.getResultLink(childAttr('[ourl]', 'ourl', 'https://video.example.com/v'), 'bing');
  linkApiC.setHref('https://www.bing.com/news/search?q=x');
  const bNewsEl = { tagName: 'DIV', getAttribute: () => null, setAttribute() {}, querySelector: (s) => s === 'a.title[href]' ? { href: 'https://news.example.com/a' } : null };
  const bNews = linkApiC.getResultLink(bNewsEl, 'bing');
  check('选择器-212: Google图片自身data-lpage/视频data-curl/新闻卡片链接', gImg.href === 'https://img.example.com/page' && gVid.href === 'https://www.youtube.com/watch?v=abc' && gNews === gNewsEl);
  const selfNews = { tagName: 'A', href: 'https://news.example.com/x', getAttribute: () => null, setAttribute() {}, matches: (s) => s === ':scope[href]', querySelector: () => null };
  linkApiC.setHref('https://www.google.com/search?q=x&tbm=nws');
  const gNewsSelf = linkApiC.getResultLink(selfNews, 'google');
  check('选择器-212b: Google新闻容器自身为a时仍能取到href', gNewsSelf === selfNews);
  check('选择器-213: Bing视频ourl/新闻a.title链接', bVid.href === 'https://video.example.com/v' && bNews.href === 'https://news.example.com/a');
}

// ---- match字符串字面量与引擎同口径 ----
{
  const mkEnv = (srcText) => new Function(`
    const SUPPORTED_REGEX_FLAGS = 'imsu';
    const CATEGORY_FIELDS = ['containers', 'titles', 'snippets', 'links', 'extraElements', 'button', 'match'];
    function t(key, params = {}) { let text = key; for (const [k, v] of Object.entries(params || {})) text += ':' + v; return text; }
    function isValidCssSelector() { return true; } function hasPseudoElement() { return false; }
    ${extractFn(srcText, 'normalizeSelectorList')}
    ${extractFn(srcText, 'normalizeCategoryMap')}
    ${extractFn(srcText, 'getInvalidRegexFlags')}
    ${extractFn(srcText, 'matchDefToParts')}
    ${extractFn(srcText, 'sameSelectorDef')}
    ${extractFn(srcText, 'validateUserSelectors')}
    return { matchDefToParts, sameSelectorDef, validateUserSelectors };
  `)();
  const apiM2 = mkEnv(src);
  const base = { containers: '.x', titles: [], snippets: [], links: 'a[href]' };
  check('选择器-160: 字符串字面量与RegExp/对象在sameSelectorDef下等价', apiM2.sameSelectorDef({ ...base, match: '/foo/i' }, { ...base, match: /foo/i }) && apiM2.sameSelectorDef({ ...base, match: '/foo/i' }, { ...base, match: { source: 'foo', flags: 'i' } }) && !apiM2.sameSelectorDef({ ...base, match: '/foo/i' }, { ...base, match: '/foo/g' }));
}

// ---- 选择器-170/204: teardown 守卫与纯删除型变更 ----
{
  const liteSrc = readRepoFile('Lite.user.js');
  // 后台用 setTimeout, 前台用 rAF 且积压超限折叠为全量重扫
  function makeObserverEnv(hidden, fnSrc) {
    const calls = { raf: 0, timeouts: [], scan: 0, closest: 0, reconcile: 0 };
    const body = { closest() { calls.closest++; return null; } };
    const documentStub = { hidden, body, querySelector() { return null; } };
    let moCb = null;
    class MutationObserver { constructor(cb) { moCb = cb; } observe() {} disconnect() {} }
    const api = new Function('document', 'MutationObserver', 'requestAnimationFrame', 'setTimeout', 'calls', `
      let _engineSiteSetup = false; let _domObserver = null; let _observedBody = null; let _hiddenParentCount = 0; let _observedSelector = '';
      let _searchForm = null; let _searchFormHandler = null; let _urlChangeHandler = null;
      function bindSearchForm() {} function syncBodyBindings() {} function applyDarkModeClass() {} function applyCollapseMode() {}
      let _hrefUrlCache = new WeakMap(); const _hrefChangedContainers = new Set();
      const _contentChangedContainers = new Set(); let _resultContentCache = new WeakMap();
      let _resultRetryCounts = new WeakMap(); let showHiddenResults = false; let forceReprocessBatchId = 0;
      const currentConfig = { enabled: true, debug: false, collapseMode: false };
      function isEngineSite() { return true; } function injectGlobalStyles() {}
      function buildRuleIndex() {} function exposeDebugApi() {} function updateStatus() {}
      function scanNewResults() { calls.scan++; } function startBackgroundSync() {}
      function reconcileHiddenParents() { calls.reconcile++; }
      function forceReprocessAll() {} function resetSelectorCache() {} function refreshEngineSite() {}
      function getSearchEngine() { return 'test'; } function getContainerSelector() { return '.x'; }
      function getSearchCategory() { return 'web'; }
      function peekResultUrl() { return ''; } function reprocessContainer() {} function getResultContentSignature() { return null; }
      const location = { href: 'https://www.google.com/search?q=x' };
      const history = { pushState() {}, replaceState() {} };
      const window = { addEventListener() {}, dispatchEvent() {} }; const Event = class {};
      ${fnSrc}
      return { ensureEngineSiteSetup };
    `)(documentStub, MutationObserver, () => { calls.raf++; }, (fn, ms) => { calls.timeouts.push({ fn, ms }); return calls.timeouts.length; }, calls);
    api.ensureEngineSiteSetup();
    return { calls, moCb, body };
  }
  {
    const { calls: callsR, moCb: moCbR, body: bodyR } = makeObserverEnv(true, extractFn(src, 'ensureEngineSiteSetup'));
    moCbR([{ type: 'childList', target: bodyR, removedNodes: [1] }]); callsR.timeouts[0].fn();
    const liteObs = makeObserverEnv(true, extractFn(readRepoFile('Lite.user.js'), 'ensureEngineSiteSetup'));
    liteObs.moCb([{ type: 'childList', target: liteObs.body, removedNodes: [1] }]); liteObs.calls.timeouts[0].fn();
    check('选择器-204: 纯删除型变更也触发reconcile恢复隐藏槽位(主版+Lite)', callsR.scan === 1 && callsR.reconcile === 1 && liteObs.calls.scan === 1 && liteObs.calls.reconcile === 1);
  }
  // teardown 后迟到回调不处理
  function makeGuardApi(fnSrc, setup) {
    const counter = { link: 0 };
    const fn = new Function('counter', `
      let _engineSiteSetup = ${setup}; const currentConfig = { enabled: true, debug: false };
      function getSearchEngine() { return 'other'; }
      function getResultLink() { counter.link++; return null; }
      ${fnSrc}
      return processSingleResult;
    `)(counter);
    return { fn, counter };
  }
  const stubResult = { closest: () => null, hasAttribute: () => false };
  const guardM = makeGuardApi(extractFn(src, 'processSingleResult'), false);
  const guardL = makeGuardApi(extractFn(liteSrc, 'processSingleResult'), false);
  check('选择器-170: teardown 后 processSingleResult 直接拒绝且不提取链接(主版+Lite)', guardM.fn(stubResult) === false && guardM.counter.link === 0 && guardL.fn(stubResult) === false && guardL.counter.link === 0);
}

// ---- 选择器-173: 等长正文变化仍按完整签名重处理 ----
{
  function makeContentFlushEnv(fnSrcText = src, hasAttr = () => true) {
    const calls = { reprocess: 0, status: 0, scan: 0, raf: 0, timeouts: [] };
    const container = { isConnected: true, sig: 'new-sig', hasAttribute: hasAttr, closest: () => container };
    let moCb = null;
    class MutationObserver { constructor(cb) { moCb = cb; } observe() {} disconnect() {} }
    const documentStub = { hidden: true, body: {}, querySelector: () => null, querySelectorAll: () => [] };
    const api = new Function('document', 'MutationObserver', 'requestAnimationFrame', 'setTimeout', 'calls', 'container', `
      let _engineSiteSetup = false; let _domObserver = null; let _observedBody = null; let _hiddenParentCount = 0; let _observedSelector = '';
      let _searchForm = null; let _searchFormHandler = null; let _urlChangeHandler = null;
      function bindSearchForm() {} function syncBodyBindings() {} function applyDarkModeClass() {} function applyCollapseMode() {}
      let _hrefUrlCache = new WeakMap(); const _hrefChangedContainers = new Set();
      const _contentChangedContainers = new Set(); let _resultContentCache = new WeakMap();
      let _resultRetryCounts = new WeakMap(); let showHiddenResults = false; let forceReprocessBatchId = 0;
      const currentConfig = { enabled: true, debug: false, collapseMode: false };
      function isEngineSite() { return true; } function injectGlobalStyles() {}
      function buildRuleIndex() {} function exposeDebugApi() {} function updateStatus() { calls.status++; }
      function scanNewResults() { calls.scan++; } function startBackgroundSync() {}
      function forceReprocessAll() {} function resetSelectorCache() {} function refreshEngineSite() {}
      function getSearchEngine() { return 'test'; } function getContainerSelector() { return '.x'; }
      function getSearchCategory() { return 'web'; }
      function peekResultUrl() { return ''; } function reprocessContainer() { calls.reprocess++; }
      function getResultContentSignature() { return container.sig; }
      function peekResultTextLen() { return 4; }
      const location = { href: 'https://www.google.com/search?q=x' };
      const history = { pushState() {}, replaceState() {} };
      const window = { addEventListener() {}, dispatchEvent() {} }; const Event = class {};
      ${extractFn(fnSrcText, 'ensureEngineSiteSetup')}
      return { ensureEngineSiteSetup, setCache: (v) => _resultContentCache.set(container, v) };
    `)(documentStub, MutationObserver, () => { calls.raf++; }, (fn, ms) => { calls.timeouts.push({ fn, ms }); return calls.timeouts.length; }, calls, container);
    api.ensureEngineSiteSetup();
    return { api, calls, container, get moCb() { return moCb; } };
  }
  const env = makeContentFlushEnv();
  env.api.setCache({ textLen: 4, sig: 'old-sig' });
  env.moCb([{ type: 'childList', target: env.container, addedNodes: [1] }]);
  env.calls.timeouts[0].fn();
  check('选择器-173: 等长正文变化仍按完整签名重处理(主版)', env.calls.reprocess === 1);
}

// ---- 选择器-189: 订阅 match 非法时回退 base.match ----
{
  const parseSelectorMatchFn = new Function(extractFn(src, 'parseSelectorMatch') + '\nreturn parseSelectorMatch;')();
  assert('选择器-189: 订阅match正则非法时回退base.match不致引擎失效', (() => {
    const back = parseSelectorMatchFn({ match: '/(unclosed/' }, { match: /^ok\.base$/i });
    const fresh = parseSelectorMatchFn({ match: '/x.*/i' }, { match: /^base$/ });
    const none = parseSelectorMatchFn({ match: '/(bad/' }, null);
    const empty = parseSelectorMatchFn({}, { match: /^kept$/ });
    return back instanceof RegExp && back.source === '^ok\\.base$' && back.ignoreCase === true && fresh.source === 'x.*' && none === null && empty.source === '^kept$';
  })());
}


// 留档观察: Google已不渲染div.g(2026-10实测仅扁平MjjYud), 网格槽位回归测试保留以防布局回退(主/Lite共有)
// 留档观察: github/greasyfork/google的match为完整URL正则, getSearchEngine对含://的源回退测href(设计)
// 留档观察: 图片搜索容器(bing/google/ddg/yandex/brave images)硬编码绕过订阅/自定义containers, 配套专用链接解包(设计)
// 留档观察: Lite与正式版共享CONFIG_KEY, 同启时Lite启动清理会删正式版同步/订阅存储键, 勿双开
// 修复留档: reconcileHiddenParents在blockedShown期间摘除yandex/google父容器标记致再隐藏留白, 已补!blockedShown()守卫(主/Lite)
// 修复留档(主/Lite): forceReprocessAll分批对脱离DOM节点跳过, 防止污染计数与_hiddenParentCount
{
  const liteCat = new Function(`
    const SELECTORS = { other: {} };
    function getSelectors() { return { cat: { categories: { shop: { match: { source: '[?&]shop=1', flags: 'i' } } } } }; }
    function getSearchEngine() { return 'cat'; }
    let _categoryCacheHref = null, _categoryCacheResult = 'web', _categoryCacheEngine = null;
    ${extractFn(readRepoFile('Lite.user.js'), 'getSearchCategory')}
    return getSearchCategory;
  `)();
  check('选择器-209: Lite分类match对象{source,flags}可生效', liteCat({ href: 'https://cat.example/?shop=1' }) === 'shop');
}
// ---- 选择器-216/217: @提取指令顶层@解析 / match字符串默认i / yandex父隐藏按容器过滤 ----
{
  // 修复留档: yandex父隐藏须按结果容器过滤children, 广告位等可见兄弟误判为未屏蔽致父容器不隐藏(主/Lite)
  const liteSrc = fs.readFileSync(path.join(scriptDir, 'Lite.user.js'), 'utf8');
  const mkYx = (srcText) => new Function(`
    let _hiddenParentCount = 0;
    let showHiddenResults = false;
    const currentConfig = { collapseMode: false };
    function blockedShown() { return showHiddenResults || currentConfig.collapseMode === true; }
    function getContainerSelector() { return 'div.Organic'; }
    ${extractFn(srcText, 'yandexResultBlocks')}
    ${extractFn(srcText, 'visibleUnblocked')}
    ${extractFn(srcText, 'saveOriginalDisplay')}
    ${extractFn(srcText, 'hideParentIfNoVisibleSiblings')}
    return { hideParentIfNoVisibleSiblings, yandexResultBlocks, getCount: () => _hiddenParentCount };
  `)();
  for (const [label, s] of [['主版', src], ['Lite', liteSrc]]) {
    const fns = mkYx(s);
    const li = { children: [], style: { display: '' }, attrs: {}, setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return this.attrs[k] || null; }, hasAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attrs, k); }, removeAttribute(k) { delete this.attrs[k]; } };
    const organic = { matches: (sel) => sel === 'div.Organic', style: { display: 'none' }, attrs: { 'data-is-blocked': 'true' }, getAttribute(k) { return this.attrs[k] || null; }, setAttribute() {} };
    const ad = { matches: (sel) => sel !== 'div.Organic', style: { display: 'block' }, attrs: {}, getAttribute(k) { return this.attrs[k] || null; }, setAttribute() {} };
    li.children.push(organic, ad);
    fns.hideParentIfNoVisibleSiblings(li, fns.yandexResultBlocks(li), 'data-blocker-yandex-parent');
    check(`选择器-216: yandex父隐藏忽略广告位兄弟仅按结果容器判定(${label})`, li.style.display === 'none' && li.getAttribute('data-blocker-yandex-parent') === 'true');
  }
}
{
  // 修复留档: @提取指令须匹配引号外顶层@, 属性值含@attr字样的合法选择器不再被贪婪截断(主/Lite)
  const liteSrc = fs.readFileSync(path.join(scriptDir, 'Lite.user.js'), 'utf8');
  for (const [label, s] of [['主版', src], ['Lite', liteSrc]]) {
    const apiAt = new Function(`
      ${extractFn(s, 'parseTopLevelAt')}
      ${extractFn(s, 'parseLinkSpec')}
      ${extractFn(s, 'parseTitleSpec')}
      return { parseLinkSpec, parseTitleSpec };
    `)();
    const quoted = apiAt.parseLinkSpec('a[data-x="v@attr:y"]');
    const normal = apiAt.parseLinkSpec('a.iusc@json:m.purl');
    const titleQuoted = apiAt.parseTitleSpec('img[title="a@json:x.y"]');
    const titleNormal = apiAt.parseTitleSpec('a.iusc@json:m.t');
    check(`选择器-217: 引号内@attr不误截/正常@指令仍解析(${label})`, quoted === null && !!normal && normal.mode === 'json' && normal.css === 'a.iusc' && titleQuoted === null && !!titleNormal && titleNormal.mode === 'json' && titleNormal.css === 'a.iusc');
  }
}
// 裸字符串 match 默认忽略大小写; 显式 /.../flags 形态不强制追加 i
{
  const parseSelectorMatch = new Function(extractFn(src, 'parseSelectorMatch') + '\nreturn parseSelectorMatch;')();
  const plain = parseSelectorMatch({ match: 'WWW\\.Example\\.Com' }, null);
  const explicit = parseSelectorMatch({ match: { source: 'ABC', flags: '' } }, null);
  check('选择器-218: 裸字符串match默认忽略大小写, 显式flags不强制追加i', plain instanceof RegExp && plain.ignoreCase === true && explicit instanceof RegExp && explicit.ignoreCase === false);
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

})();