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
        if (/\bcommandSelectors\b/.test(fn)) prelude.push(rawExtract(text, 'commandSelectors'));
    if (/\brecheckGroupRoot\b|\bresetResultStyles\b|\breconcileHiddenParents\b/.test(fn)) prelude.push(rawExtract(text, 'resultGroupMembers'), rawExtract(text, 'hideParentIfNoVisibleSiblings'), rawExtract(text, 'recheckGroupRoot'));
    if (/\brecheckGridCell\b|\bresetResultStyles\b|\breconcileHiddenParents\b/.test(fn)) prelude.push(rawExtract(text, 'recheckGridCell'), rawExtract(text, 'getGridLeaves'), rawExtract(text, 'gridLeafBlocked'));
    const helperRe = /\bnormalizeSelectorAliases\b|\bsameSelectorDef\b|\bdiffSelectorDefFields\b|\bmergeSelectorDef\b|\bcleanPage\b|\bnormalizePageMap\b|\bmergePageObjects\b|\bpickProps?\b|\bsimpleToCommand\b|\bisCommandArray\b|\bnormalizeLink\b|\bpageMapKey\b|\bcoerceSelectorDef\b|\bcoercePageMatch\b|\bparseSelectorMatch\b|\bselectorMatchValue\b|\bresolvePageDef\b|\bfindPageByCategory\b|\bnormalizeButton\b|\bsplitTopLevelSelectorList\b|\bnormalizePreserveSpace\b|\bnormalizeCssRules\b|\bnormalizeSiteList\b|\bnormalizeMatchPatterns\b/;
    if (helperRe.test(fnName) || helperRe.test(fn)) prelude.push("var CMD_TYPES = new Set(['or', 'attribute', 'property', 'text', 'const', 'regexInclude', 'regexExclude', 'regexSubstitute', 'domainToUrl', 'domainToURL', 'rejectEngineHost', 'normalizeUrl', 'rejectOpaqueRedirect', 'unwrapRedirect', 'jsonPath', 'queryParam', 'json', 'base64Url']);\n" + ['isCommandArray', 'simpleToCommand', 'normalizeLink', 'redirectsEnabled', 'splitTopLevelSelectorList', 'normalizeButton', 'normalizeCssRules', 'normalizeSiteList', 'normalizeMatchPatterns', 'normalizePreserveSpace', 'cleanPage', 'normalizePageMap', 'mergePageObjects', 'pickProp', 'pickProps', 'normalizeSelectorAliases', 'matchDefToParts', 'jsonKey', 'jsonKey', 'pageMapKey', 'findPageByCategory', 'selectorMatchValue', 'parseSelectorMatch', 'coercePageMatch'].map((n) => rawExtract(text, n)).join('\n'));
    if (/\bmap_groupMembers\b/.test(fn)) prelude.push('var map_groupMembers = new WeakMap();');
    if (/\bmap_gridConfig\b/.test(fn)) prelude.push('var map_gridConfig = new WeakMap();');
    if (/\bhideNames\b|\bhideSel\b|\bGRID_HIDE_ATTR\b|\bGROUP_HIDE_ATTR\b/.test(fn)) { const hm = text.match(/const (GRID_HIDE_ATTR = '[^']+', GROUP_HIDE_ATTR = '[^']+');/); prelude.push((hm ? 'var ' + hm[1] + ';' : '') + 'var _hideNamesCache = null; var __hideSelectorsData = null; function getSelectors() { return __hideSelectorsData || {}; }', rawExtract(text, 'hideNames'), rawExtract(text, 'hideSel')); }
    if (/\bunwrapRedirectUrl\b|\bisOpaqueRedirectUrl\b|\bdecodeRedirectOnce\b|\bgetRedirectSpecs\b|\bisOpaqueRedirectValue\b/.test(fn)) prelude.push("var _redirectSpecsCache = new Map();\n" + (text.match(/const REDIRECT_CODECS = \{[\s\S]*?\n  \};/) || [''])[0].replace('const REDIRECT_CODECS', 'var REDIRECT_CODECS') + '\n' + ['redirectsEnabled', 'getRedirectSpecs', 'decodeRedirectOnce', 'unwrapRedirectUrl', 'hasRedirectSpec', 'isOpaqueRedirectUrl', 'tryUrl'].map((n) => rawExtract(text, n)).join('\n'));
    if (/\brunCmdValue\b|\bmakeResultLink\b|\bisOpaqueRedirectValue\b/.test(fn)) prelude.push("var _cmdReCache = new Map();\n" + ['cmdRe', 'cmdQueryEl', 'runCmdEl', 'cmdText', 'cmdAttr', 'cmdPath', 'cmdDomain', 'cmdOrigin', 'cmdAbsUrl', 'isOpaqueRedirectValue', 'runCmdValue', 'makeResultLink'].map((n) => rawExtract(text, n)).join('\n'));
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
const fns = ['parseRegexLiteral', 'sanitizeRegexFlags', 'isRegexLiteralStr', 'normalizeSelectorList', 'isCommandArray', 'simpleToCommand', 'hasTopLevelComma', 'normalizeLink', 'cleanPage', 'normalizePageMap', 'mergePageObjects', 'pickProp', 'pickProps', 'mergeSelectorDef', 'getUserSelectors', 'getEngineSubscriptions', 'saveEngineSubscriptions', 'selectorMatchValue', 'coerceRegexValue', 'parseSelectorMatch', 'coerceSelectorDef', 'coercePageMatch', 'getSubscribedSelectors', 'getBaseSelectors', 'getSelectors', 'resetSelectorCache', 'getSearchEngine', 'getSearchCategory', 'resolvePageDef', 'isEngineSite', 'getRootSelector', 'getRootCommand', 'rootAnchorSelector', 'rootHasUpward', 'rootCommandKey', 'isValidCssSelector', 'hasPseudoElement', 'validateUserSelectors', 'getInvalidRegexFlags', 'regexSourceToLiteralText', 'escapeJsString', 'matchDefToParts', 'jsonKey', 'serializeSelectors', 'normalizeMatchLiteral', 'parseSelectorText', 'normalizeSelectorAliases', 'pageMapKey', 'sameSelectorDef', 'diffSelectorDefFields', 'diffUserSelectors', 'selectorStoreValue', 'pruneUserSelectors', 'selectorMatchValue', 'normalizeMatchPatterns', 'matchPatternToRegex', 'matchPatternsTest'].map((n) => extractFn(src, n));
const builtinSelectorOfLine = src.match(/const builtinSelectorOf = .+?;/);
if (!builtinSelectorOfLine) throw new Error('builtinSelectorOf not found');
const body = `
const ENGINE_SUBSCRIPTIONS_KEY = 'searchfilter_engine_subscriptions'; const BUILTIN_ENGINE_SUB_URL = 'https://raw.githubusercontent.com/Carteahere/Search-Engine-Result-Hider/main/Other/SELECTORS.js'; const SELECTORS_KEY = 'searchfilter_selectors';
const SUPPORTED_REGEX_FLAGS = 'imsu';
const SELECTORS = ${selectorsObjectText}; var DEFAULT_CATEGORY = 'web'; let activeSelectors = null; let _redirectSpecsCache = new Map(); let _engineCacheHost = null; let _categoryCacheHref = null; let _categoryCacheResult = 'web'; let _categoryCacheEngine = null; let _catDefCacheKey = null; let _catDefCache = null; let _hideNamesCache = null; let _matchPatternCache = new Map();
var CMD_TYPES = new Set(['or', 'attribute', 'property', 'text', 'const', 'regexInclude', 'regexExclude', 'regexSubstitute', 'domainToUrl', 'domainToURL', 'rejectEngineHost', 'normalizeUrl', 'rejectOpaqueRedirect', 'unwrapRedirect', 'jsonPath', 'queryParam', 'json', 'base64Url']);
const PAGE_FIELDS = ['root', 'url', 'title', 'snippet', 'extraSelector', 'button', 'skip', 'group', 'grid', 'dedupeBy', 'link', 'blockedCss', 'site'];
${extractFn(src, 'isEngineHost')}
${builtinSelectorOfLine[0]} let _engineCacheResult = 'other'; let _observedSelector = ''; let _engineStyleEl = null;
const window = { location: { get hostname() { return currentHost; }, get href() { return currentHref; } } }; let currentHost = 'www.google.com'; let currentHref = 'https://www.google.com/';
function t(key, params = {}) { let text = key; for (const [k, v] of Object.entries(params || {})) text += ':' + v; return text; } function GM_setValue(key, value) { if (key === 'searchfilter_selectors') storeRef.current = value; }
${fns.join('\n')}
return { getSelectors, getUserSelectors, getSearchEngine, getSearchCategory, isEngineSite, getRootSelector, getRootCommand, rootAnchorSelector, rootHasUpward, rootCommandKey, resolvePageDef, validateUserSelectors, resetSelectorCache, normalizeSelectorList, serializeSelectors, parseSelectorText, diffUserSelectors, selectorStoreValue, pruneUserSelectors, sameSelectorDef, isCommandArray, simpleToCommand, CMD_TYPES, matchPatternToRegex, matchPatternsTest, isEngineHost,
  setHost: (h) => { currentHost = h; currentHref = 'https://' + h + '/'; }, setHref: (h) => { currentHref = h; }, setStore: (obj) => { storeRef.current = obj; resetSelectorCache(); }, setSubStore: (obj) => { subStoreRef.current = obj; resetSelectorCache(); } };
`;
const api = new Function('GM_getValue', 'storeRef', 'subStoreRef', body)(GM_getValue, storeRef, subStoreRef);
const CUSTOM = { mysearx: { match: '(?:^|\\.)searx\\.example\\.com$', root: '.result', title: ['text', 'h3'], snippet: ['text', '.content'], url: ['attribute', 'href', 'a[href]'] } };
api.setStore({ broken: { match: '([', root: '.x', url: ['attribute', 'href', 'a[href]'] } });
api.setHost('broken.example');
const badMatch = api.getSearchEngine() === 'other' && api.getSelectors().broken.includeRegex === null;
api.setStore(CUSTOM);
api.setHost('other.com');
api.setHref('https://other.com/?u=x.searx.example.com');
// 设计变更: includeRegex对齐SERPINFO按整条URL匹配, 主机名尾部形正则可被查询参数命中
check('选择器-001: 非法match不崩溃不激活且includeRegex按主机名与整条URL匹配(SERPINFO做法)', badMatch && api.getSearchEngine() === 'mysearx');
api.setStore({ myuser: { match: '^https?:\\/\\/(?:[^\\/?#]*\\.)?google\\.com(?:[\\/?#]|$)', root: 'div.user', title: ['text', 'h3'] } });
api.setSubStore([{ url: 'https://example.com/subs.js', enabled: true, selectors: { mysub: { match: '(?:^|\\.)google\\.com$', root: 'div.sub', title: ['text', 'h3'] } } }]);
api.setHost('www.google.com'); api.setHref('https://www.google.com/search?q=x');
const userPriority = api.getSearchEngine() === 'myuser' && api.getRootSelector('myuser') === 'div.user';
api.setStore({});
api.setSubStore([]);
check('选择器-002: 自定义引擎优先于订阅与内置且无自定义订阅时回退内置引擎', userPriority && api.getSearchEngine() === 'google' && api.getRootSelector('google') === 'div.g, div.MjjYud:not(:has(#m-x-content)):not(:has(span.mgAbYb)):has(a[href])');
api.setHost('www.bing.com'); api.setHref('https://www.bing.com/images/search?q=x');
api.setStore({ bing: { root: 'div.custom-bing' } });
const customTop = api.getRootSelector('bing') === 'li:has(div.iuscp), div.iuscp, div.imgpt';
api.setStore({});
api.setSubStore([{ url: 'https://sub/y.js', enabled: true, selectors: { bing: { root: 'div.sub-bing' } } }]);
const subTop = api.getRootSelector('bing') === 'li:has(div.iuscp), div.iuscp, div.imgpt';
// 留档观察: 图片搜索容器按分类优先(设计), 顶层containers覆盖仅在分类未定义containers时生效
check('选择器-003: 自定义与订阅顶层containers均不覆盖图片分类容器', customTop && subTop);
api.setSubStore([]); api.setHost('www.google.com'); api.setHref('https://www.google.com/');
api.setHref('https://www.google.com/search?q=x&tbm=vid'); const gVideoCont = api.getRootSelector('google');
api.setHref('https://www.google.com/search?q=x&tbm=nws'); const gNewsCont = api.getRootSelector('google');
api.setHost('www.bing.com');
api.setHref('https://www.bing.com/videos/search?q=x'); const bVideoCont = api.getRootSelector('bing');
api.setHref('https://www.bing.com/news/search?q=x'); const bNewsCont = api.getRootSelector('bing');
check('选择器-004: 视频/新闻按真实卡片容器返回', gVideoCont === 'div.PmEWq, div.MjjYud:has(a[href]):not(:has(div.PmEWq))' && gNewsCont === 'a.aJWbwf, [data-news-cluster-id]' && bVideoCont === 'div.mc_vtvc' && bNewsCont === 'div.news-card, .newscard');
api.setHost('www.google.com');
api.setSubStore([{ url: 'https://example.com/subs.js', enabled: true, selectors: { yahoo: { match: '^https?:\\/\\/(?:[^\\/?#]*\\.)?search\\.yahoo\\.co\\.jp(?:[\\/?#]|$)', root: '.sub-y' }, yahoo_japan: { match: '^https?:\\/\\/search\\.yahoo\\.co\\.jp(?:[\\/?#]|$)', root: '.sub-yj' } } }]);
api.setHost('search.yahoo.co.jp');
const yahooPick = api.getSearchEngine();
api.setSubStore([]); api.setHost('www.google.com');
check('选择器-005: 订阅yahoo含co.jp时仍优先专有yahoo_japan', yahooPick === 'yahoo_japan');
check('选择器-006: title/snippet/url 命令内伪元素(含单冒号)被拒且引号内不误报', api.validateUserSelectors({ p1: { match: 'a', root: '.x', title: ['text', 'h3::after'] } }).length === 1 && api.validateUserSelectors({ p2: { match: 'a', root: '.x', snippet: ['text', '.c::before'] } }).length === 1 && api.validateUserSelectors({ p3: { match: 'a', root: '.x', url: ['attribute', 'href', 'a::after'] } }).length === 1 && api.validateUserSelectors({ s1: { match: 'a', root: 'div:before' } }).length === 1 && api.validateUserSelectors({ s2: { match: 'a', root: '.x', title: ['text', 'h3:first-line'] } }).length === 1 && api.validateUserSelectors({ s3: { match: 'a', root: '.x', url: ['attribute', 'href', 'a:first-letter'] } }).length === 1 && api.validateUserSelectors({ p4: { match: 'a', root: '.x', title: ['text', '[data-k="a::b"]'] } }).length === 0);
// 修复留档: extraSelector 的逗号需按括号深度判断
check('选择器-007: 对象与字符串match非法flags报错且合法通过', api.validateUserSelectors({ e11: { match: { source: 'a', flags: 'q' }, root: '.x' } }).length === 1 && api.validateUserSelectors({ e12: { match: { source: 'a', flags: 'i' }, root: '.x' } }).length === 0 && api.validateUserSelectors({ f1: { match: '/a/g', root: '.x' } }).some((m) => m.includes('invalidRegexFlags')) && api.validateUserSelectors({ f2: { match: '/a/i', root: '.x' } }).length === 0);
const P1 = api.serializeSelectors();
const R1 = api.parseSelectorText(P1);
// 修复留档: parseSelectorText将带flags正则字面量归一化为{source,flags}对象, 断言取.source与选择器-010/013同口径
check('选择器-008: 序列化→解析往返一致', /bing:\s*\{/.test(P1) && /includeRegex: \//.test(P1) && !R1.errors.length && !!R1.config && R1.config.bing.includeRegex.source === api.getSelectors().bing.includeRegex.source && R1.config.google.root === 'div.g, div.MjjYud:not(:has(#m-x-content)):not(:has(span.mgAbYb)):has(a[href])');
const R4 = api.parseSelectorText('e8: { match: /a[/ }');
const R5 = api.parseSelectorText('e7: { match: /a/q }');
const RC = api.parseSelectorText('// head\nmysite: {\n  /* a */ match: /(?:^|\\.)x\\.com$/, // b\n  root: ".r"\n} // tail');
check('选择器-009: 未闭合正则与非法flags解析报错且解析器跳过行块注释与首尾注释', R4.config === null && R4.errors.length === 1 && R5.config === null && R5.errors.length === 1 && !RC.errors.length && !!RC.config && RC.config.mysite.root === '.r' && RC.config.mysite.includeRegex.source === '(?:^|\\.)x\\.com$' && RC.config.mysite.includeRegex.flags === '');
api.setStore({ flg: { match: { source: 'a\\/b', flags: 'i' }, root: '.x', url: ['attribute', 'href', 'a[href]'] } });
const P2 = api.serializeSelectors();
const R9 = api.parseSelectorText(P2);
check('选择器-010: match flags 序列化→解析往返保留并过校验', P2.includes('includeRegex: /a\\/b/i') && !R9.errors.length && R9.config.flg.includeRegex.source === 'a\\/b' && R9.config.flg.includeRegex.flags === 'i' && api.validateUserSelectors(R9.config).length === 0);
api.setStore({ caseLit: { match: '/Case\\.Sensitive/', root: '.x', url: ['attribute', 'href', 'a[href]'] } });
const P5 = api.serializeSelectors(); const R16 = api.parseSelectorText(P5); const re5 = api.getSelectors().caseLit.includeRegex;
api.setStore({ bareLit: { match: 'Case\\.Sensitive', root: '.x', url: ['attribute', 'href', 'a[href]'] } });
const P6 = api.serializeSelectors(); const R17 = api.parseSelectorText(P6);
check('选择器-011: 显式无flags正则保存仍大小写敏感且裸字符串match保留隐式i', P5.includes('includeRegex: /Case\\.Sensitive/') && !P5.includes('includeRegex: /Case\\.Sensitive/i') && !R16.errors.length && R16.config.caseLit.includeRegex.source === 'Case\\.Sensitive' && R16.config.caseLit.includeRegex.flags === '' && re5 instanceof RegExp && re5.ignoreCase === false && P6.includes('includeRegex: /Case\\.Sensitive/i') && !R17.errors.length && R17.config.bareLit.includeRegex.flags === 'i');
api.setStore({});
const allBuiltins = {};
// 修复留档: 内置副本fixture须保留正则flags, 裸源串无隐式i与内置语义不同(选择器-088/013); 012/017沿用旧match键以覆盖includeRegex兼容映射
for (const k of ['bing', 'google', 'duckduckgo', 'yandex', 'brave', 'yahoo']) {
  const m = api.getSelectors()[k];
  allBuiltins[k] = { match: { source: m.includeRegex.source, flags: m.includeRegex.flags }, root: m.root, title: m.title, snippet: m.snippet, url: m.url };
}
const bingCopy = allBuiltins.bing;
check('选择器-012: 未改动键丢弃/改动键保留/新增键保留', !('bing' in api.diffUserSelectors(allBuiltins)) && 'bing' in api.diffUserSelectors(Object.assign({}, allBuiltins, { bing: Object.assign({}, bingCopy, { root: '.x' }) })) && 'myx' in api.diffUserSelectors(Object.assign({}, allBuiltins, { myx: { match: 'a', root: '.x' } })));
api.setStore({ yahoo: { disabled: true } });
const yahooDisabled = api.getSelectors().yahoo.disabled === true && (() => { api.setHost('search.yahoo.com'); const r = api.getSearchEngine() === 'other'; api.setHost('www.google.com'); return r; })();
check('选择器-013: sameSelectorDef 兼容字符串/RegExp/对象形态且flags参与比较', api.sameSelectorDef({ match: 'a.b', root: '.x', url: ['attribute', 'href', 'a[href]'] }, { match: /a.b/, root: '.x', url: ['attribute', 'href', 'a[href]'] }) && api.sameSelectorDef({ match: { source: 'a.b', flags: '' }, root: '.x', url: ['attribute', 'href', 'a[href]'] }, { match: /a.b/, root: '.x', url: ['attribute', 'href', 'a[href]'] }) && !api.sameSelectorDef({ match: { source: 'a.b', flags: 'i' }, root: '.x', url: ['attribute', 'href', 'a[href]'] }, { match: /a.b/, root: '.x', url: ['attribute', 'href', 'a[href]'] }));
api.setStore({ bing: { disabled: 'false' } });
const strFalse = api.getSelectors().bing.disabled !== true;
api.setStore({ bing: { disabled: true } });
const disabledTrue = (() => { api.setHost('www.bing.com'); const r = api.getSearchEngine() === 'other'; api.setStore({ bing: { disabled: false } }); return r && api.getSearchEngine() === 'bing' && api.getRootSelector('bing') === 'li.b_algo, div.b_algo'; })();
check('选择器-014: disabled内置引擎不被加载且字符串false不误禁用且true停用false覆盖不破坏内置', yahooDisabled && strFalse && disabledTrue);
api.setStore({});
const bingSnapshot = api.getSelectors().bing;
// 修复留档: 旧版固化副本fixture同选择器-012保留match flags
storeRef.current = { bing: { ...bingSnapshot, match: { source: bingSnapshot.includeRegex.source, flags: bingSnapshot.includeRegex.flags } }, myse: { match: 'a', root: '.x' } };
api.resetSelectorCache();
api.pruneUserSelectors();
check('选择器-015: 旧版固化的内置副本被清理', storeRef.current && !('bing' in storeRef.current) && !!storeRef.current.myse);
// 修复留档: regexSourceToLiteralText需跟踪字符类使类内/不转义, 否则google含[/?#]的内置match被序列化成[\/?#]回读多一个反斜杠, 未改动引擎被判已修改并固化副本(主/Lite)
api.setStore({});
const Pfull = api.serializeSelectors();
const Rfull = api.parseSelectorText(Pfull);
check('选择器-016: 内置serialize→parse零diff且类内/?#不再被转义', Pfull.includes('[/?#]') && !Pfull.includes('[\\\\/?#]') && !Rfull.errors.length && !!Rfull.config && Object.keys(api.diffUserSelectors(Rfull.config)).length === 0, { a: Pfull.includes('[/?#]'), b: !Pfull.includes('[\\\\/?#]'), c: !Rfull.errors.length, d: !!Rfull.config, e: Object.keys(api.diffUserSelectors(Rfull.config)).length });

api.setStore({ dtest: { match: '^https?:\\/\\/dtest\\.example(?:[\\/?#]|$)', root: '.r', url: ['attribute', 'href', 'a[href]'], delay: true, pages: { images: { match: /\/img/, delay: 800 } } } });
api.setHost('dtest.example'); api.setHref('https://dtest.example/');
const delayEngine = api.resolvePageDef('dtest').delay === true;
api.setHref('https://dtest.example/img?q=x');
const delayCat = api.resolvePageDef('dtest').delay === 800;
const delayValid = api.validateUserSelectors({ dtest: { match: 'a', root: '.x', delay: 500 } }).length === 0 && api.validateUserSelectors({ dtest: { match: 'a', root: '.x', delay: false } }).length === 0 && api.validateUserSelectors({ dtest: { match: 'a', root: '.x', delay: -1 } }).length > 0 && api.validateUserSelectors({ dtest: { match: 'a', root: '.x', delay: 'x' } }).length > 0;
const Pdelay = api.serializeSelectors(); const Rdelay = api.parseSelectorText(Pdelay);
check('选择器-017: delay引擎级生效分类级覆盖校验与序列化往返及diff比较', delayEngine && delayCat && delayValid && /delay: true/.test(Pdelay) && /delay: 800/.test(Pdelay) && !Rdelay.errors.length && api.validateUserSelectors(Rdelay.config).length === 0 && Rdelay.config.dtest.delay === true && Rdelay.config.dtest.pages.images.delay === 800 && !api.sameSelectorDef({ match: 'a', root: '.x', url: ['attribute', 'href', 'a[href]'], delay: true }, { match: 'a', root: '.x', url: ['attribute', 'href', 'a[href]'] }) && 'bing' in api.diffUserSelectors(Object.assign({}, allBuiltins, { bing: Object.assign({}, bingCopy, { delay: 300 }) })));
api.setStore({}); api.setHost('www.google.com'); api.setHref('https://www.google.com/search?q=x');
// 修复留档: so360摘要与sogou容器约束及夸克Yahoo日本头条选择器修复生效
check('选择器-018: so360摘要sogou容器与夸克Yahoo头条选择器修复生效', JSON.stringify(selectors.so360.snippet).includes('.res-list-summary') && selectors.sogou.root.includes('div.reactResult:has(h3)') && selectors.sogou.root.includes('div.reactResult:has(.vr-title)') && !/(?:^|,)\s*\.reactResult\s*,/.test(selectors.sogou.root) && selectors.quark.includeRegex.source.includes('quark\\.cn') && JSON.stringify(selectors.yahoo.url).includes('.s-title a') && JSON.stringify(selectors.yahoo_japan.url).includes('sw-Card__titleInner') && selectors.yahoo_japan.pages.news.root.includes('articles') && selectors.yahoo_japan.pages.videos.includeRegex.test('https://search.yahoo.co.jp/video/search?p=x') && selectors.toutiao.pages.images.root === '.l-waterfallY-item' && JSON.stringify(selectors.toutiao.pages.images.url).includes('search/jump'));
api.setStore({}); api.setHost('www.quark.cn'); api.setHref('https://www.quark.cn/s?q=x'); const qPc = api.getSearchEngine() === 'quark';
api.setHost('news.yahoo.co.jp'); api.setHref('https://news.yahoo.co.jp/search/?p=x'); const yNews = api.getSearchEngine() === 'yahoo_japan';
const yNewsCat = api.getSearchCategory() === 'news' && api.getRootSelector('yahoo_japan').includes('articles');
api.setHref('https://news.yahoo.co.jp/articles/x'); const yArticle = api.getSearchEngine() === 'other';
api.setHost('search.yahoo.co.jp'); api.setHref('https://search.yahoo.co.jp/video/search?p=x'); const yVideo = api.getSearchCategory() === 'videos';
api.setStore({}); api.setHost('www.google.com'); api.setHref('https://www.google.com/search?q=x');
check('选择器-019: 夸克PC与Yahoo日本新闻/视频入口识别', qPc && yNews && yNewsCat && yArticle && yVideo);
const extraDef = { ...CUSTOM.mysearx, extraSelector: ['+ .summary', '~ .metadata'] };
api.setStore({ customExtra: extraDef });
const extraRoundTrip = api.parseSelectorText(api.serializeSelectors());
// 修复留档: 裸字符串match默认补i后往返规范化为/source/i, 对照采用规范化形态(主/Lite)
check('选择器-020: 关联选择器合并保留往返一致校验通过且非法关联配置被拒字符串关联通过', JSON.stringify(api.getSelectors().customExtra.extraSelector) === JSON.stringify(extraDef.extraSelector) && !extraRoundTrip.errors.length && api.sameSelectorDef(extraRoundTrip.config.customExtra, { ...extraDef, match: { source: extraDef.match, flags: 'i' } }) && api.validateUserSelectors({ customExtra: extraDef }).length === 0 && [['+ tr, body'], ['+ tr::after']].every((value) => api.validateUserSelectors({ customExtra: { ...extraDef, extraSelector: value } }).some((e) => e.includes('extraSelector'))) && api.validateUserSelectors({ customExtra: { ...extraDef, extraSelector: '+ tr' } }).length === 0);
const catNameCases = [['my-shop', true], ['Cat_2-x', true], ['ca t', false], ['cat!', false]];
for (const [name, ok] of catNameCases) check(`选择器-021: 自定义分类名 ${name} ${ok ? '通过' : '被拒'}`, (api.validateUserSelectors({ c1: { match: 'a', root: '.x', pages: { [name]: { match: 'b', root: '.y' } } } }).length === 0) === ok);
api.setStore({ catname: { match: '^https?:\\/\\/(?:[^\\/?#]*\\.)?cat\\.example(?:[\\/?#]|$)', pages: { 'my-shop': { match: /[?&]shop=1/, root: 'div.shop-card', title: ['text', 'h3'], url: ['attribute', 'href', 'a[href]'] } } } });
api.setHost('cat.example'); api.setHref('https://cat.example/search?q=x&shop=1');
const catMatch = api.getSearchEngine() === 'catname' && api.getSearchCategory() === 'my-shop' && api.getRootSelector('catname') === 'div.shop-card';
api.setStore({}); api.setHost('www.bing.com'); api.setHref('https://www.bing.com/search?q=example.com/images/');
const bingQ = api.getSearchCategory() === 'web' && (() => { api.setHref('https://www.bing.com/images/search?q=test'); const r = api.getSearchCategory() === 'images'; api.setHref('https://www.bing.com/search?q=example.com/images/'); return r; })();
check('选择器-022: 自定义分类按match识别容器生效且Bing查询串含/images/不误判', catMatch && bingQ);
api.setHost('www.google.com'); api.setHref('https://www.google.com/');
const parseCondition = new Function('getSelectors', 'var _siteAliasMap = null;' + extractFn(src, 'normalizeSiteList') + extractFn(src, 'siteAliasMap') + extractFn(src, 'siteKey') + extractFn(src, 'hostLabelToASCII') + extractFn(src, 'toASCIIHostname') + extractFn(src, 'parseConditionPart') + '; return parseConditionPart;')(() => api.getSelectors());
check('选择器-023: duckduckgo/ddg为Lite别名且yahoo与yahoo_japan不互别名支持yahoo-japan', parseCondition('$site=duckduckgo', 'duckduckgo_lite', 'lite.duckduckgo.com').static === true && parseCondition('$site=ddg', 'duckduckgo_lite', 'lite.duckduckgo.com').static === true && parseCondition('$site=duckduckgo_lite', 'duckduckgo_lite', 'lite.duckduckgo.com').static === true && parseCondition('$site=duckduckgo', 'duckduckgo', 'duckduckgo.com').static === true && parseCondition('$site=yahoo', 'yahoo', 'search.yahoo.com').static === true && parseCondition('$site=yahoo_japan', 'yahoo_japan', 'search.yahoo.co.jp').static === true && parseCondition('$site=yahoo-japan', 'yahoo_japan', 'search.yahoo.co.jp').static === true && parseCondition('$site=yahooJapan', 'yahoo_japan', 'search.yahoo.co.jp').static === false && parseCondition('$site=yahoo', 'yahoo_japan', 'search.yahoo.co.jp').static === false && parseCondition('$site=yahoo_japan', 'yahoo', 'search.yahoo.com').static === false);

  // ---- SERPINFO 形状：pages 对象 + commonProps + serh + & 关联选择器 + button 元组 ----
  const pageCfg = {
    neweng: {
      name: 'New Engine',
      match: '^https?:\\/\\/(?:[^\\/?#]*\\.)?neweng\\.example(?:[\\/?#]|$)',
      root: '.base',
      url: ['attribute', 'href', 'a[href]'],
      title: ['text', 'h3'],
      button: ['inset', { top: '8px', right: '6px' }],
      pages: {
        web: {},
        shopping: { match: /[?&]shop=1/, root: '.shop', title: ['text', '.t'], serh: { dedupeBy: 'a[href]' } },
      },
    },
  };
  api.setStore(pageCfg);
  api.setHost('www.neweng.example'); api.setHref('https://www.neweng.example/search?q=x');
  const newBaseRoot = api.getRootSelector('neweng'); const newBaseCat = api.getSearchCategory(); const newBaseDef = api.resolvePageDef('neweng');
  api.setHref('https://www.neweng.example/search?q=x&shop=1');
  const newShopCat = api.getSearchCategory(); const newShopRoot = api.getRootSelector('neweng');
  const Pnew = api.serializeSelectors(); const Rnew = api.parseSelectorText(Pnew);
  check('选择器-024: pages对象平铺根节点分类生效且序列化含pages对象不重复commonProps/results', api.validateUserSelectors(pageCfg).length === 0 && newBaseRoot === '.base' && newBaseCat === 'web' && JSON.stringify(newBaseDef.title) === '["text","h3"]' && newBaseDef.url[0] === 'attribute' && newShopCat === 'shopping' && newShopRoot === '.shop' && /pages: \{/.test(Pnew) && !/results: \[/.test(Pnew) && !Pnew.includes('$category') && !Rnew.errors.length && api.validateUserSelectors(Rnew.config).length === 0 && api.sameSelectorDef(Rnew.config.neweng, { ...pageCfg.neweng, match: { source: pageCfg.neweng.match, flags: 'i' } }));
  api.setStore({ oldeng: { match: '(?:^|\\.)oldeng\\.example$', containers: '.base', links: 'a[href]', titles: ['h3', '.title'] } });
  api.setHost('www.oldeng.example'); api.setHref('https://www.oldeng.example/search?q=x');
  const oldDef = api.getSelectors().oldeng;
  const legacy = api.getRootSelector('oldeng') === '.base' && JSON.stringify(oldDef.url) === '["attribute","href","a[href]"]' && JSON.stringify(oldDef.title) === '["or",[["text","h3"],["text",".title"]]]' && oldDef.snippet === undefined && oldDef.pages === undefined;
  api.setStore({ ign: { match: 'ign\\.example', root: '.x', props: { title: ['text', 'h3'] }, pages: [{ name: 'images', match: /\/images\// }] } });
  api.setHost('www.ign.example'); api.setHref('https://www.ign.example/images/?q=x');
  const ignDef = api.getSelectors().ign;
  check('选择器-025: 旧版containers/titles/links仍可读取且props字段忽略pages数组写法生效', legacy && ignDef.title === undefined && !!ignDef.pages && !!ignDef.pages.images && ignDef.pages.images.commonProps.$category === 'images' && api.getSearchCategory() === 'images');
  api.setStore({}); api.setHost('www.google.com'); api.setHref('https://www.google.com/');
  const ampCfg = { ampx: { match: 'a', root: '.x', extraSelector: '& + tr, & .summary' } };
  const ampErrors = api.validateUserSelectors(ampCfg); api.setStore(ampCfg);
  check('选择器-026: &形式extraSelector可校验并归一化', ampErrors.length === 0 && JSON.stringify(api.getSelectors().ampx.extraSelector) === JSON.stringify(['+ tr', '.summary']));
  api.setStore({ btnx: { match: 'a', root: '.x', button: ['inset', { top: '8px', right: '6px', zIndex: 10 }] } });
  const btnObj = api.getSelectors().btnx.button;
  const btnObjOk = !!btnObj && btnObj.inset && btnObj.inset.top === '8px' && btnObj.inset.right === '6px' && btnObj.zIndex === 10;
  api.setStore({ btnicon: { match: 'a', root: '.x', button: ['icon', { style: 'top: 12px; right: 8px; z-index: 3; --ub-icon-size: 16px;' }, '.m'] } });
  const iconBtn = api.getSelectors().btnicon.button;
  const iconText = api.serializeSelectors(); const iconRT = api.parseSelectorText(iconText);
  const iconOk = !!iconBtn && iconBtn.inset.top === '12px' && iconBtn.inset.right === '8px' && iconBtn.zIndex === '3' && iconBtn.style === '--ub-icon-size: 16px' && iconBtn.mount === '.m' && !iconRT.errors.length && api.validateUserSelectors({ btnicon: api.getUserSelectors().btnicon }).length === 0;
  api.setStore({ btntext: { match: 'a', root: '.x', button: ['text', { position: 'afterend', style: 'top: 4px' }, ['upward', 1]] } });
  const textBtn = api.getSelectors().btntext.button;
  const textOk = !!textBtn && textBtn.inset.top === '4px' && Array.isArray(textBtn.mount) && textBtn.mount[0] === 'upward' && api.validateUserSelectors({ btntext: api.getUserSelectors().btntext }).length === 0;
  check('选择器-027: button元组归一化icon按钮style解析text按钮mount元素命令且domainToURL同为合法命令', btnObjOk && iconOk && textOk && api.isCommandArray(['domainToURL', ['text', 'cite']]) && api.isCommandArray(['domainToUrl', ['text', 'cite']]) && api.validateUserSelectors({ cmdAlias: { match: 'a', root: '.x', url: ['domainToURL', ['text', 'cite']] } }).length === 0);
  const deepCmd = ['or', [
    ['jsonPath', '0.original_page_url', ['jsonPath', '', ['queryParam', 'preload', ['queryParam', 'url', ['attribute', 'href', 'a[href*="/search/jump"]']]]]],
    ['attribute', 'href', 'a[href*="/search/jump"]'],
    ['attribute', 'href', 'a[href]']
  ]];
  api.setStore({ deepor: { match: 'a', root: '.x', url: deepCmd } });
  const deepText = api.serializeSelectors(); const deepRT = api.parseSelectorText(deepText);
  const deepOk = !deepRT.errors.length && !!deepRT.config && JSON.stringify(deepRT.config.deepor.url) === JSON.stringify(deepCmd);
  api.setStore({});
  const simpleText = api.serializeSelectors();
  const simpleOk = /title: \['h3\.gs_rt a', 'h3\.gs_rt', '\.gs_rt'\]/.test(simpleText) && !/title: \['text'/.test(simpleText) && /url: 'a\[href\]'/.test(simpleText) && /url: \['h3\.gs_rt a\[href\]', 'a\[href\]'\]/.test(simpleText) && !/url: \['attribute', 'href'/.test(simpleText);
  api.setStore({ myeng: { match: '(?:^|\\.)myeng\\.example$', root: '.r', title: ['text', 'h3'], url: ['attribute', 'href', 'a[href]'] } });
  const keptUser = api.getUserSelectors().myeng;
  check('选择器-028: 深嵌套or命令往返保持结构与等价命令数组回简单写法且用户覆盖保留输入简单写法', deepOk && simpleOk && JSON.stringify(keptUser.title) === '["text","h3"]' && JSON.stringify(keptUser.url) === '["attribute","href","a[href]"]' && JSON.stringify(api.getSelectors().myeng.title) === '["text","h3"]');
  api.setStore({});
  // ---- blockedCss 全链路：合并 / 分类覆盖 / 序列化 / 校验 / 差异 ----
  api.setHost('www.google.com'); api.setHref('https://www.google.com/search?q=x');
  const gDef = api.getSelectors().google;
  const gBlocked = Array.isArray(gDef.blockedCss) && gDef.blockedCss.some((s) => s.includes('serh-blocked-visible')) && JSON.stringify(api.resolvePageDef('google').blockedCss) === JSON.stringify(gDef.blockedCss);

  const cssCfg = {
    csseng: {
      match: '^https?:\\/\\/(?:[^\\/?#]*\\.)?csseng\\.example(?:[\\/?#]|$)',
      root: '.r',
      url: ['attribute', 'href', 'a[href]'],
      command: { blockedCss: ['.r { min-height: 10px; }'] },
      pages: {
        images: { match: /\/images\//, root: '.img', command: { blockedCss: ['.img { min-height: 20px; }'] } },
      },
    },
  };
  api.setStore(cssCfg);
  api.setHost('www.csseng.example'); api.setHref('https://www.csseng.example/search?q=x');
  const cssTopDef = api.resolvePageDef('csseng');
  api.setHref('https://www.csseng.example/images/?q=x');
  const cssImgDef = api.resolvePageDef('csseng');
  check('选择器-029: 内置blockedCss不被合并丢弃且顶层合并且分类可覆盖', gBlocked && JSON.stringify(api.getSelectors().csseng.blockedCss) === JSON.stringify(['.r { min-height: 10px; }']) && JSON.stringify(cssTopDef.blockedCss) === JSON.stringify(['.r { min-height: 10px; }']) && api.getSearchCategory() === 'images' && JSON.stringify(cssImgDef.blockedCss) === JSON.stringify(['.img { min-height: 20px; }']));
  const cssText = api.serializeSelectors();
  const cssRT = api.parseSelectorText(cssText);
  const cssDiff = api.diffUserSelectors({ csseng: cssCfg.csseng });
  check('选择器-030: blockedCss序列化往返一致校验拒绝非法值且参与差异比较与分类差异可感知', /command: \{[^\n]*blockedCss: \['\.r \{ min-height: 10px; \}'\]/.test(cssText) && /blockedCss: \['\.img \{ min-height: 20px; \}'\]/.test(cssText) && !cssRT.errors.length && api.sameSelectorDef(cssRT.config.csseng, { ...cssCfg.csseng, match: { source: cssCfg.csseng.match, flags: 'i' } }) && api.validateUserSelectors({ cssok: { match: 'a', root: '.x', command: { blockedCss: ['.x{color:red}'] } } }).length === 0 && api.validateUserSelectors({ cssok2: { match: 'a', root: '.x', blockedCss: '.x{color:red}' } }).length === 0 && api.validateUserSelectors({ cssbad: { match: 'a', root: '.x', command: { blockedCss: ['  '] } } }).length > 0 && api.validateUserSelectors({ cssbad2: { match: 'a', root: '.x', command: { blockedCss: [1] } } }).length > 0 && cssDiff.csseng && JSON.stringify(cssDiff.csseng.blockedCss) === JSON.stringify(cssCfg.csseng.blockedCss) && !api.sameSelectorDef({ match: 'a', root: '.x', blockedCss: ['.a'] }, { match: 'a', root: '.x', blockedCss: ['.b'] }) && !api.sameSelectorDef({ match: 'a', root: '.x', blockedCss: ['.a'], pages: { images: { match: 'b', root: '.i' } } }, { match: 'a', root: '.x', blockedCss: ['.a'], pages: { images: { match: 'b', root: '.i', blockedCss: ['.j'] } } }));
  // ---- site 别名 ----
  api.setStore({ siteeng: { match: '(?:^|\\.)siteeng\\.example$', root: '.r', site: 'alias1, alias2', title: ['text', 'h3'] } });
  const siteText = api.serializeSelectors(); const siteRT = api.parseSelectorText(siteText);
  const siteOk = JSON.stringify(api.getSelectors().siteeng.site) === JSON.stringify(['alias1', 'alias2']) && /site: \['alias1', 'alias2'\]/.test(siteText) && !siteRT.errors.length && api.sameSelectorDef(siteRT.config.siteeng, { ...api.getUserSelectors().siteeng, match: { source: api.getUserSelectors().siteeng.match, flags: 'i' } }) && api.validateUserSelectors({ siteok: { match: 'a', root: '.x', site: ['x', 'y'] } }).length === 0 && api.validateUserSelectors({ sitebad: { match: 'a', root: '.x', site: [1] } }).length > 0 && api.validateUserSelectors({ sitebad2: { match: 'a', root: '.x', site: '  ' } }).length > 0;
  check('选择器-031: site别名归一化往返校验与内置别名迁移到site字段', siteOk && JSON.stringify(api.getSelectors().duckduckgo.site) === JSON.stringify(['ddg', 'duckduckgo_lite']) && JSON.stringify(api.getSelectors().yahoo_japan.site) === JSON.stringify(['yahoo-japan']));
  // ---- root 命令 ----
  api.setStore({ rootcmd: { match: '(?:^|\\.)rootcmd\\.example$', root: ['upward', 1, '.item'], url: ['attribute', 'href', 'a[href]'] } });
  const rootText = api.serializeSelectors(); const rootRT = api.parseSelectorText(rootText);
  const rootOk = JSON.stringify(api.getRootCommand('rootcmd')) === '["upward",1,".item"]' && api.getRootSelector('rootcmd') === '.item' && api.rootAnchorSelector(api.getRootCommand('rootcmd')) === '.item' && api.rootHasUpward(api.getRootCommand('rootcmd')) === true && api.validateUserSelectors({ rootcmd: api.getUserSelectors().rootcmd }).length === 0 && /root: \['upward', 1, '\.item'\]/.test(rootText) && !rootRT.errors.length && api.sameSelectorDef(rootRT.config.rootcmd, { ...api.getUserSelectors().rootcmd, match: { source: api.getUserSelectors().rootcmd.match, flags: 'i' } }) && api.validateUserSelectors({ r1: { match: 'a', root: ['upward', 'div>>>', '.i'], url: ['attribute', 'href', 'a[href]'] } }).length > 0 && api.validateUserSelectors({ r2: { match: 'a', root: ['bad', 1, '.i'], url: ['attribute', 'href', 'a[href]'] } }).length > 0 && api.validateUserSelectors({ r3: { match: 'a', root: ['upward', 1, 'div>>>'], url: ['attribute', 'href', 'a[href]'] } }).length > 0 && api.validateUserSelectors({ r4: { match: 'a', root: ['upward', '.wrap', '.i'], url: ['attribute', 'href', 'a[href]'] } }).length === 0;
  check('选择器-032: root命令校验序列化兼容入口且非法root命令被拒', rootOk);
  api.setStore({ matchesonly: { matches: '*://myse.example.com/search*', root: '.r', url: ['attribute', 'href', 'a[href]'] } });
  const matchesOk = api.isEngineHost('matchesonly', 'myse.example.com') === true && api.isEngineHost('matchesonly', 'other.com') === false;
  api.setStore({ pathonly: { includeRegex: '^https?://pathonly\\.example/search', root: '.r', url: ['attribute', 'href', 'a[href]'] } });
  api.setHost('pathonly.example'); api.setHref('https://pathonly.example/search?q=1');
  check('选择器-033: matches与includeRegex形态引擎isEngineHost可用', matchesOk && api.isEngineHost('pathonly', 'pathonly.example') === true && api.isEngineHost('pathonly', 'other.com') === false);
  api.setStore({}); api.setHost('www.google.com'); api.setHref('https://www.google.com/search?q=x'); const gSearch = api.getSearchEngine();
  api.setHref('https://www.google.com/maps'); const gMaps = api.getSearchEngine();
  api.setHref('https://www.google.com/search?q=x&tbm=isch'); const gCat = api.getSearchCategory();
  check('选择器-034: google拆分include/exclude后搜索页识别不变', gSearch === 'google' && gMaps === 'other' && gCat === 'images');
  api.setStore({ linkdirect: { match: 'a', root: '.x', url: ['attribute', 'href', 'a[href]'], command: { link: { directAttrs: 'data-href' } } } });
  const ldText = api.serializeSelectors(); const ldRT = api.parseSelectorText(ldText);
  const ldOk = !/redirects: null/.test(ldText) && !ldRT.errors.length && api.validateUserSelectors(ldRT.config).length === 0 && !(ldRT.config.linkdirect.command.link && 'redirects' in ldRT.config.linkdirect.command.link);
  const redirDiff = api.diffUserSelectors({ redir: { match: 'a', root: '.x', command: { link: { redirects: [{ path: /^\/r/, params: ['u'], codec: 'url' }] } } } });
  const storedRedir = api.selectorStoreValue(redirDiff); const redirPath = storedRedir.redir.command.link.redirects[0].path;
  check('选择器-035: link无redirects往返可保存button.inset数值校验且redirects落库归一化source/flags与仅disabled覆盖可保存', ldOk && api.validateUserSelectors({ btnnum: { match: 'a', root: '.x', button: { inset: { top: 8, right: 3 }, zIndex: 4 } } }).length === 0 && redirPath.source === '^\\/r' && redirPath.flags === '' && !(redirPath instanceof RegExp) && JSON.parse(JSON.stringify(storedRedir)).redir.command.link.redirects[0].path.source === '^\\/r' && api.validateUserSelectors({ bing: { disabled: true }, google: { disabled: false } }).length === 0 && api.validateUserSelectors({ bing: { root: '.x', button: true } }).length === 0 && api.validateUserSelectors({ newe: { root: '.r', url: 'a[href]' } }).some((e) => e.includes('includeRegex/matches')) && api.validateUserSelectors({ newe2: { root: '.r', url: 'a[href]', includeRegex: /x/ } }).length === 0);
  const rootApi = new Function('document', extractFn(src, 'rootAnchorSelector') + extractFn(src, 'rootHasUpward') + extractFn(src, 'queryRootCommand') + extractFn(src, 'findRootContainer') + 'return { queryRootCommand, findRootContainer };')({ body: {}, documentElement: {} });
  const rootParent = { id: 'parent', contains: () => false }; const rootAnchor = { id: 'anchor', parentElement: rootParent, closest: (sel) => sel === '.item' ? rootAnchor : null };
  const rootScope = { querySelectorAll: (sel) => sel === '.item' ? [rootAnchor] : [] };
  const wrapGrand = { id: 'grand' };
  const wrapNode = { id: 'wrap', parentElement: wrapGrand, closest: (sel) => (sel === '.wrap' ? wrapGrand : null) };
  const leafNode = { id: 'leaf', parentElement: wrapNode, closest: (sel) => (sel === '.item' ? leafNode : (sel === '.wrap' ? wrapGrand : null)) };
  const wrapScope = { querySelectorAll: (sel) => (sel === '.item' ? [leafNode] : []) };
  check('选择器-036: root upward数值与选择器串查询及容器定位', rootApi.queryRootCommand(['upward', 1, '.item'], rootScope)[0] === rootParent && rootApi.queryRootCommand(['selector', '.item'], rootScope)[0] === rootAnchor && rootApi.findRootContainer({ closest: () => rootAnchor }, ['upward', 1, '.item']) === rootParent && rootApi.queryRootCommand(['upward', '.wrap', '.item'], wrapScope)[0] === wrapGrand && rootApi.findRootContainer(leafNode, ['upward', '.wrap', '.item']) === wrapGrand);
  // ---- button.exclude / 分类禁用按钮 / 选择器驱动的重定向参数 ----
  api.setStore({});
  api.setHost('www.google.com'); api.setHref('https://www.google.com/search?q=x');
  const btnCfg = { btnx2: { match: 'a', root: '.x', button: { inset: { top: '8px' }, exclude: '.ad, header' } } };
  api.setStore(btnCfg);
  const btnDef = api.getSelectors().btnx2;
  const btnText = api.serializeSelectors();
  const btnRT = api.parseSelectorText(btnText);
  check('选择器-037: button.exclude序列化往返一致且非法exclude被校验拒绝', btnDef.button && btnDef.button.exclude === '.ad, header' && !api.validateUserSelectors(btnCfg).length && /exclude: '\.ad, header'/.test(btnText) && !btnRT.errors.length && api.sameSelectorDef(btnRT.config.btnx2, { ...btnCfg.btnx2, match: { source: btnCfg.btnx2.match, flags: 'i' } }) && api.validateUserSelectors({ btnbad: { match: 'a', root: '.x', button: { exclude: 'div>>>' } } }).some((e) => e.includes('exclude')));
  // ---- button 分组: 对象形态为规范, 门控与mount内联 ----
  const grpCfg = { btngrp: { match: 'a', root: '.x', button: { inset: { right: '5px' }, mount: '.m', scope: '.sc', require: '.rq', requireSelf: '.rs', exclude: '.ex' } } };
  api.setStore(grpCfg);
  const grpText = api.serializeSelectors();
  const grpRT = api.parseSelectorText(grpText);
  check('选择器-038: button对象形态门控与mount归一化往返一致且非法mount被校验拒绝', (() => {
    const d = api.getSelectors().btngrp.button;
    const ok = d && d.mount === '.m' && d.scope === '.sc' && d.inset && d.inset.right === '5px' && !grpRT.errors.length && /\{ inset: \{ right: '5px' \}, mount: '\.m', scope: '\.sc'/.test(grpText) && api.sameSelectorDef(grpRT.config.btngrp, { ...grpCfg.btngrp, match: { source: 'a', flags: 'i' } }) && api.validateUserSelectors({ btnbad2: { match: 'a', root: '.x', button: { mount: 'div>>>' } } }).some((e) => e.includes('mount'));
    api.setStore({});
    return ok;
  })());
  const gWebBtn = api.resolvePageDef('google').button;
  api.setHref('https://www.google.com/imghp');
  const gImgBtn = api.resolvePageDef('google').button;
  api.setStore({ pbtn: { match: '^https?:\\/\\/(?:[^\\/?#]*\\.)?pbtn\\.example(?:[\\/?#]|$)', root: '.r', url: ['attribute', 'href', 'a[href]'], pages: { images: { match: /\/images\//, button: false } } } });
  api.setHost('www.pbtn.example'); api.setHref('https://www.pbtn.example/images/?q=x');
  const btnFalse = gWebBtn && typeof gWebBtn === 'object' && gWebBtn.exclude.includes('#hdtb') && gImgBtn === false && api.resolvePageDef('pbtn').button === false;
  api.setStore({});
  // 按钮默认inset与exclude单源于other.button 引擎表只保留偏离值
  const otherDefaults = api.resolvePageDef('other').button.inset.top === '10px' && api.resolvePageDef('other').button.inset.right === '35px' && api.resolvePageDef('other').button.exclude.includes('[role="search"]') && api.getSelectors().ecosia.button === undefined && api.getSelectors().google.button.inset === undefined && api.getSelectors().bing.button.inset.right === '5px';
  check('选择器-039: 内置与自定义分类均可用button:false禁用按钮且按钮默认值单源于other', btnFalse && otherDefaults);
  // pages支持数组形式 name为键并派生$category 无name项回退commonProps$category 都缺则忽略
  const arrPages = [ { name: 'images', match: /\/img\//, root: '.img' }, { name: 'gallery', commonProps: { $category: 'images' }, root: '.gal' }, { commonProps: { $category: 'videos' }, root: '.vid' }, { root: '.noname' } ];
  api.setStore({ arpeng: { match: 'a', root: '.x', url: ['attribute', 'href', 'a[href]'], pages: arrPages } });
  const arrP = api.getSelectors().arpeng.pages;
  const arrOk = !!arrP && Object.keys(arrP).length === 3 && arrP.images.commonProps.$category === 'images' && arrP.gallery.commonProps.$category === 'images' && arrP.videos.commonProps.$category === 'videos' && !arrP['0'] && api.sameSelectorDef({ match: 'a', root: '.x', url: ['attribute', 'href', 'a[href]'], pages: arrPages }, { match: 'a', root: '.x', url: ['attribute', 'href', 'a[href]'], pages: { images: { match: /\/img\//, root: '.img' }, gallery: { commonProps: { $category: 'images' }, root: '.gal' }, videos: { commonProps: { $category: 'videos' }, root: '.vid' } } }) && api.validateUserSelectors({ badp: { match: 'a', root: '.x', pages: [{ root: '.y' }] } }).some((e) => e.includes('name')) && !api.validateUserSelectors({ okp: { match: 'a', root: '.x', url: ['attribute', 'href', 'a[href]'], pages: arrPages.slice(0, 3) } }).length;
  api.setStore({ btnt: { match: 'a', root: '.x', button: ['inset', { top: '8px' }, '.m'] } });
  const btntBtn = api.getSelectors().btnt.button;
  check('选择器-040: pages数组归一化sameSelectorDef等价缺name报错且button元组第三参归一化为mount', arrOk && !!btntBtn && btntBtn.mount === '.m' && !!btntBtn.inset && btntBtn.inset.top === '8px');
  api.setStore({});
  const prioritySpecs = new Function('getSelectors', 'isEngineHost', `var _redirectSpecsCache = new Map(); ${extractFn(src, 'getRedirectSpecs')}\nreturn getRedirectSpecs;`)(() => ({ low: { match: /x/, priority: 1, link: { redirects: [{ codec: 'url', params: ['a'] }] } }, high: { match: /x/, priority: 10, link: { redirects: [{ codec: 'url', params: ['b'] }] } } }), () => true);
  check('选择器-041: 重定向规格按 priority 选择', prioritySpecs('h.example')[0].engine === 'high');
  // excludeRegex 引擎级命中整条URL跳过该引擎按优先级回退; page级命中该分类不采用并回退web
  api.setStore({
    exlo: { match: '^https?:\\/\\/(?:[^\\/?#]*\\.)?ex\\.example(?:[\\/?#]|$)', root: '.lo', url: ['attribute', 'href', 'a[href]'] },
    exhi: { match: '^https?:\\/\\/(?:[^\\/?#]*\\.)?ex\\.example(?:[\\/?#]|$)', priority: 5, excludeRegex: '/imgres/', root: '.hi', url: ['attribute', 'href', 'a[href]'] }
  });
  api.setHost('www.ex.example');
  api.setHref('https://www.ex.example/search?q=x');
  const exHi = api.getSearchEngine();
  api.setHref('https://www.ex.example/imgres?q=x');
  const exFall = api.getSearchEngine();
  api.setStore({ expg: { match: '^https?:\\/\\/(?:[^\\/?#]*\\.)?ex\\.example(?:[\\/?#]|$)', root: '.r', url: ['attribute', 'href', 'a[href]'], pages: { images: { match: /\/images\//, excludeRegex: /exclude=1/, root: '.img' }, videos: { match: /\/videos\//, root: '.vid' } } } });
  api.setHref('https://www.ex.example/images/?q=x');
  const pgImg = api.getSearchCategory();
  api.setHref('https://www.ex.example/images/?exclude=1');
  const pgImgEx = api.getSearchCategory();
  api.setHref('https://www.ex.example/videos/?q=x');
  const pgVid = api.getSearchCategory();
  check('选择器-042: 引擎级excludeRegex命中跳过并按优先级回退且page级命中该分类回退web', exHi === 'exhi' && exFall === 'exlo' && pgImg === 'images' && pgImgEx === 'web' && pgVid === 'videos');
  const bingSel = api.getSelectors().bing;
  const bingLike = { ...bingSel, match: { source: bingSel.includeRegex.source, flags: bingSel.includeRegex.flags } };
  check('选择器-043: excludeRegex字面量过校验非法flags被拒且参与sameSelectorDef与diff', api.validateUserSelectors({ vx1: { match: 'a', excludeRegex: '/x?/', root: '.r' } }).length === 0 && api.validateUserSelectors({ vx2: { match: 'a', excludeRegex: '/x/q', root: '.r' } }).some((m) => m.includes('invalidRegexFlags')) && api.sameSelectorDef(bingLike, bingSel) === true && api.sameSelectorDef({ ...bingLike, excludeRegex: '/x/' }, bingSel) === false && (api.diffUserSelectors({ bing: { excludeRegex: '/x/' } }).bing || {}).excludeRegex !== undefined);
  // ---- includeRegex 新字段 / matches 通配 / excludeMatches 排除 / 旧 match 键兼容 ----
  api.setStore({});
  api.setStore({ inregex: { includeRegex: '^https?:\\/\\/(?:[^\\/?#]*\\.)?inregex\\.example(?:[\\/?#]|$)', root: '.r', url: ['attribute', 'href', 'a[href]'] } });
  api.setHost('www.inregex.example');
  const inclOk = api.getSearchEngine() === 'inregex';
  api.setStore({ oldkey: { match: '^https?:\\/\\/(?:[^\\/?#]*\\.)?oldkey\\.example(?:[\\/?#]|$)', root: '.r', url: ['attribute', 'href', 'a[href]'] } });
  api.setHost('www.oldkey.example');
  check('选择器-044: includeRegex新字段直接生效且旧match键兼容映射为includeRegex', inclOk && api.getSearchEngine() === 'oldkey' && api.getSelectors().oldkey.includeRegex instanceof RegExp);
  api.setStore({ mgeng: { match: '^https?:\\/\\/(?:[^\\/?#]*\\.)?mgpath\\.example(?:[\\/?#]|$)', matches: ['*://*.mgpath.example/search*'], root: '.r', url: ['attribute', 'href', 'a[href]'] } });
  api.setHost('www.mgpath.example'); api.setHref('https://www.mgpath.example/search?q=x');
  const mgBoth = api.getSearchEngine();
  api.setHref('https://www.mgpath.example/other');
  const mgPathMiss = api.getSearchEngine();
  api.setHost('sub.mgpath.example'); api.setHref('https://sub.mgpath.example/search?q=x');
  const mgHit = api.getSearchEngine();
  api.setStore({ mgpg: { match: '^https?:\\/\\/(?:[^\\/?#]*\\.)?mg\\.example(?:[\\/?#]|$)', root: '.r', url: ['attribute', 'href', 'a[href]'], pages: { images: { matches: ['*://*.mg.example/img*'], root: '.img' } } } });
  api.setHost('www.mg.example'); api.setHref('https://www.mg.example/search?q=x');
  const mgWebCat = api.getSearchCategory();
  api.setHref('https://www.mg.example/img?q=x');
  const mgImgCat = api.getSearchCategory();
  check('选择器-045: matches与includeRegex同时存在需同时命中且页级matches识别分类', mgBoth === 'mgeng' && mgPathMiss === 'other' && mgHit === 'mgeng' && mgWebCat === 'web' && mgImgCat === 'images' && api.getRootSelector('mgpg') === '.img');
  const exmCfg = { exmeng: { match: '^https?:\\/\\/(?:[^\\/?#]*\\.)?exm\\.example(?:[\\/?#]|$)', root: '.r', url: ['attribute', 'href', 'a[href]'], excludeMatches: ['*://*/excluded*'] } };
  api.setStore(exmCfg);
  api.setHost('www.exm.example'); api.setHref('https://www.exm.example/search?q=x');
  const exmKeep = api.getSearchEngine();
  api.setHref('https://www.exm.example/excluded?q=x');
  const exmDrop = api.getSearchEngine();
  const exmEngineOk = exmKeep === 'exmeng' && exmDrop === 'other' && !api.validateUserSelectors(exmCfg).length;
  api.setStore({ exmpg: { match: '^https?:\\/\\/(?:[^\\/?#]*\\.)?exm\\.example(?:[\\/?#]|$)', root: '.r', url: ['attribute', 'href', 'a[href]'], pages: { images: { match: /\/img\//, excludeMatches: ['*://*/img/hidden*'], root: '.img' } } } });
  api.setHost('www.exm.example'); api.setHref('https://www.exm.example/img/?q=x');
  const exmImgCat = api.getSearchCategory();
  api.setHref('https://www.exm.example/img/hidden?q=x');
  const exmWebCat = api.getSearchCategory();
  check('选择器-046: 引擎级与页级excludeMatches按整条URL排除回退web且非法值被拒', exmEngineOk && exmImgCat === 'images' && exmWebCat === 'web' && api.validateUserSelectors({ exmbad: { match: 'a', root: '.x', url: ['attribute', 'href', 'a[href]'], excludeMatches: [123] } }).length > 0);
  // 修复留档: matches与includeRegex二选一为文档合法写法, 识别守卫与序列化空includeRegex行此前使matches-only引擎静默失效
  api.setStore({ matchOnly: { matches: '*://monly.example.com/s*', root: '.r', url: ['attribute', 'href', 'a[href]'] } });
  api.setHost('monly.example.com'); api.setHref('https://monly.example.com/s?q=1');
  const monlyOk = api.getSearchEngine() === 'matchOnly' && (() => { api.setHref('https://monly.example.com/other'); const r = api.getSearchEngine() === 'other'; api.setHref('https://monly.example.com/s?q=1'); return r; })();
  const Pmo = api.serializeSelectors(); const Rmo = api.parseSelectorText(Pmo);
  check('选择器-047: matches-only引擎被识别且序列化省略空includeRegex行往返校验通过', monlyOk && !Pmo.includes("includeRegex: ''") && !Rmo.errors.length && !!Rmo.config && !!Rmo.config.matchOnly && api.validateUserSelectors({ matchOnly: Rmo.config.matchOnly }).length === 0);
  api.setStore({});
  api.setHost('www.google.com'); api.setHref('https://www.google.com/search?q=x');
  // ---- SERPINFO match pattern 语义: scheme白名单/裸域命中/path锚定含query不含fragment/大小写敏感 ----
  const mpCases = [
    ['*://*.example.com/*', 'https://example.com/a', true],
    ['*://*.example.com/*', 'https://a.b.example.com/a', true],
    ['*://*.example.com/*', 'https://notexample.com/a', false],
    ['https://example.com/*', 'https://example.com/a', true],
    ['https://example.com/*', 'http://example.com/a', false],
    ['*://example.com/search*pond*', 'https://example.com/search?a=pond&b=1', true],
    ['*://example.com/search', 'https://example.com/search?q=1', false],
    ['*://example.com/*', 'https://example.com/a#frag', true],
    ['*://example.com/*', 'https://example.com:8080/a', true],
    ['file://example.com/*', 'https://example.com/a', false],
    ['<all_urls>', 'https://example.com/a', true],
    ['<all_urls>', 'file:///C:/x', false],
  ];
  for (const [i, [p, u, ok]] of mpCases.entries()) check(`选择器-048-${i + 1}: match pattern ${p} vs ${u}`, api.matchPatternsTest([p], u) === ok);
  check('选择器-049: 结构非法match pattern被校验拒绝且合法通过', api.validateUserSelectors({ mpbad2: { matches: ['*://a.*.b/*'], root: '.r' } }).length > 0 && api.validateUserSelectors({ mpbad3: { matches: ['example.com/*'], root: '.r' } }).length > 0 && api.validateUserSelectors({ mpok: { matches: ['*://a.example.com/*', '<all_urls>'], root: '.r' } }).length === 0);
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
    function dbg() {} function dbgWarn() {} function dbgError() {}
    var DEFAULT_CATEGORY = 'web'; let _observedSelector = ''; let currentSelector = '.a, .b';
    let activeSelectors = null; let _redirectSpecsCache = new Map(); let _engineCacheHost = ''; let _engineStyleEl = null;
    function getSearchEngine() { return 'test'; } function getSearchCategory() { return 'web'; } function getRootSelector() { return currentSelector; } function getRootCommand() { return currentSelector; }
    function resetResultStyles(el) { el.resetCount++; }
    ${extractFn(src, 'rootAnchorSelector')}
    ${extractFn(src, 'rootHasUpward')}
    ${extractFn(src, 'rootCommandKey')}
    ${extractFn(src, 'queryRootCommand')}
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
  const envA = createEnv();
  const a1 = envA.makeEl('li', 'a', true);
  const b1 = envA.makeEl('div', 'b', true);
  envA.makeEl('li', 'a', false);
  envA.makeEl('div', 'b', false);
  envA.api.queryUnobserved('.a, .b');
  envA.api.scanNewResults();
  envA.api.resetSelectorCache();
  envA.api.setSelector('.a');
  envA.api.scanNewResults();
  const narrow = b1.observed === false && b1.unobserveCount === 1 && b1.resetCount === 1 && a1.observed === true && a1.unobserveCount === 0;
  const envB = createEnv();
  const stale = envB.makeEl('div', 'x', true);
  const btn = { removed: 0, remove() { this.removed++; } };
  stale.quickBtn = btn;
  envB.api.clearStaleObserved('.a');
  const bad = envB.makeEl('div', 'y', true);
  bad.matches = () => { throw new Error('bad selector'); };
  envB.api.clearStaleObserved('.a');
  check('选择器-050: 收窄选择器清理失配元素保留仍匹配且clearStaleObserved清理并坏选择器不抛错', narrow && stale.observed === false && stale.unobserveCount === 1 && btn.removed === 1 && stale.resetCount === 1 && bad.observed === false && bad.unobserveCount === 1);
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
  check('选择器-051: filterNestedContainers 丢弃与子项共享链接的外层容器', kept.length === 1 && kept[0] === wsub);
}
{
  const bingFilter = new Function(`function getSearchCategory() { return 'images'; } function getSearchEngine() { return 'bing'; } function getResultLink(el) { return el.link; } function resolvePageDef() { return { dedupeBy: 'a.iusc' }; }\n${extractFn(src, 'filterNestedContainers')}\nreturn filterNestedContainers;`)();
  const mk = (iusc) => ({ iusc, querySelectorAll: () => [], querySelector: (sel) => (sel === 'a.iusc' ? iusc : null), contains: () => false });
  const shared = { id: 'iusc-1' }, otherIusc = { id: 'iusc-2' };
  const outer = mk(shared), inner = mk(shared), other = mk(otherIusc);
  const kept = bingFilter([outer, inner, other], 'div.g');
  const distinct = bingFilter([mk({ id: 'i1' }), mk({ id: 'i2' })], 'div.g');
  check('选择器-052: Bing图片同一卡片嵌套容器按a.iusc文档序去重且不同图片不去重', kept.length === 2 && kept[0] === outer && kept[1] === other && distinct.length === 2);
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
  check('选择器-053: 重复 teardown 不重复执行', counters.removeGlobalCalls === 1 && statusEl.removed === 1);
}

// reprocessContainer: processSingleResult 以 data-blocker-processed 短路, 重处理前须先清除
{
  const reprocessFn = extractFn(src, 'reprocessContainer');
  function makeFactory(processImpl) {
    const calls = { process: 0, reset: 0, reconcile: 0, observe: 0 };
    const api = new Function('calls', 'resultObserver', `
      const currentConfig = { debug: false }; function resetResultStyles(el) { calls.reset++; }
      function dbg() {} function dbgWarn() {} function dbgError() {}
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
    check('选择器-054: 重处理异常不标记完成且转交观察器重试', el.hasAttribute('data-blocker-processed') === false && calls.observe === 1);
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
    const firstOk = timers.length === 1 && timers[0].ms === Number(delayMatch[1]);
    timers[0].fn();
    const invariantOk = el.observeCount === 1 && el.hasAttribute('data-observed') === true && el.hasAttribute('data-retry-exhausted') === false && api.hasCount(el);
    const { api: api2, timers: timers2 } = makeRetryEnv();
    const el2 = makeRetryEl();
    api2.scheduleResultRetry(el2); timers2[0].fn();
    api2.scheduleResultRetry(el2); timers2[1].fn();
    api2.scheduleResultRetry(el2); timers2[2].fn();
    api2.scheduleResultRetry(el2);
    check('选择器-055: 首次异常安排延迟重试重试后保持data-observed不变量且超限后标记待正文变化复活', firstOk && invariantOk && timers2.length === 3 && el2.hasAttribute('data-observed') === true && el2.hasAttribute('data-retry-exhausted') === true && api2.hasCached(el2) && el2.unobserveCount === 1 && !api2.hasCount(el2));
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
  check('选择器-056: URL监听注册popstate/hashchange/自定义事件且路径变化触发重置与刷新', registered && calls.reset === 1 && calls.refresh === 1);
}

// ensureEngineSiteSetup / refreshEngineSite
{
  function createEnsureEnv(engine, engineDelay) {
    const calls = { start: 0, inject: 0, build: 0, status: 0, scan: 0 };
    const api = new Function('calls', 'engine', 'engineDelay', `
      let _engineSiteSetup = false; let _domObserver = null; let _observedBody = null; let _hiddenParentCount = 0;
      let _observedSelector = ''; let _searchForm = null;
      let _searchFormHandler = null; let _urlChangeHandler = null;
      function bindSearchForm() {} function syncBodyBindings() {} function applyDarkModeClass() {} function applyCollapseMode() {}
      function isEngineSite() { return engine; } function injectGlobalStyles() { calls.inject++; }
      function buildRuleIndex() { calls.build++; } function updateStatus() { calls.status++; }
      function scanNewResults() { calls.scan++; } function startBackgroundSync() { calls.start++; }
      function exposeDebugApi() {} function forceReprocessAll() {}
      function getSearchCategory() { return 'web'; } function resetSelectorCache() {}
      function resolvePageDef() { return { delay: engineDelay }; } function getSearchEngine() { return 'google'; }
      function refreshEngineSite() {} const location = { href: 'https://www.google.com' };
      const history = { pushState() {}, replaceState() {} }; const window = { addEventListener() {}, dispatchEvent() {} };
      const document = { body: {}, querySelector() { return null; } }; class MutationObserver { observe() {} disconnect() {} }
      ${extractFn(src, 'scheduleInitialScan')}
      ${extractFn(src, 'ensureEngineSiteSetup')}
      return { ensureEngineSiteSetup, state: () => ({ setup: _engineSiteSetup }) };
    `)(calls, engine, engineDelay);
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
  const env3 = createEnsureEnv(true, true);
  env3.api.ensureEngineSiteSetup();
  check('选择器-057: 未声明delay立即扫描且声明delay等待load', calls.scan === 1 && env3.calls.scan === 0);
  const a = createRefreshEnv(true, false); a.api.refreshEngineSite();
  const b = createRefreshEnv(false, true); b.api.refreshEngineSite();
  const c = createRefreshEnv(false, false); c.api.refreshEngineSite();
  check('选择器-058: 站点身份变化正确装配/拆卸/无操作', a.calls.ensure === 1 && a.calls.force === 1 && a.api.getSetup() === true && b.calls.teardown === 1 && b.api.getSetup() === false && c.calls.force === 0 && c.calls.teardown === 0);
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
    check('选择器-059: body替换后同步绑定重放主题/折叠并重置隐藏计数', st.count === 0 && st.same === true && calls.dark === 1 && calls.collapse === 1 && calls.form === 1 && calls.status === 1);
  }
}

// 跨标签页选择器变更检测已由 test-connect 的同步锁用例覆盖, 此处不再重复
})();

// ---- 引擎检测与全站门控 ----
await (async () => {
const selectors = eval(`(${getSelectorsObjectText()})`);
const fnBody = extractFn(src, 'getSearchEngine');
const factory = new Function('window', 'SELECTORS', `var DEFAULT_CATEGORY = 'web'; let _engineCacheHost = null; let _engineCacheResult = 'other'; let _matchPatternCache = new Map();
function getSelectors() { return SELECTORS; }
${extractFn(src, 'parseRegexLiteral')}
${extractFn(src, 'sanitizeRegexFlags')}
${extractFn(src, 'isRegexLiteralStr')}
${extractFn(src, 'coerceRegexValue')}
${extractFn(src, 'matchPatternToRegex')}
${extractFn(src, 'matchPatternsTest')}
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
  ['news.so.com', 'so360'], ['news.sogou.com', 'sogou'],
  ['example.com', 'other'],
];
for (const [i, [host, expected, href]] of cases.entries()) assert(`选择器-060-${i + 1}: ${host} -> ${expected}`, factory({ location: { hostname: host, href: href || 'https://' + host + '/' } }, selectors).getSearchEngine() === expected);
check('选择器-061: yahoo 不含 co.jp 且日文站由 yahoo_japan 独占', !/co\.jp/.test(selectors.yahoo.includeRegex.source) && Object.keys(selectors).indexOf('yahoo_japan') < Object.keys(selectors).indexOf('yahoo') && selectors.yahoo_japan.includeRegex.test('https://search.yahoo.co.jp/') && !selectors.yahoo_japan.includeRegex.test('https://search.yahoo.com/'));

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
  assert(`选择器-062-${i + 1}: ${href} -> ${expected}`, factory({ location: { hostname: host, href } }, selectors).getSearchEngine() === expected);
}

const pageCases = [
  [{ hostname: 'github.com', href: 'https://github.com/Carteahere/Search-Engine-Result-Hider' }, 'other'],
  [{ hostname: 'github.com', href: 'https://github.com/search?q=123&type=repositories' }, 'github'],
  [{ hostname: 'greasyfork.org', href: 'https://greasyfork.org/zh-CN/scripts/552394' }, 'other'],
  [{ hostname: 'greasyfork.org', href: 'https://greasyfork.org/zh-CN/scripts?q=123' }, 'greasyfork'],
];
for (const [i, [location, expected]] of pageCases.entries()) assert(`选择器-063-${i + 1}: ${location.href} -> ${expected}`, factory({ location }, selectors).getSearchEngine() === expected);

// 搜索分类检测(每引擎保留代表) — loc.href 与真实 location 同口径, 由 hostname/pathname/search 拼出
const catCases = [
  [{ hostname: 'www.google.com', pathname: '/search', search: '?udm=7', href: 'https://www.google.com/search?udm=7' }, 'videos'],
  [{ hostname: 'www.google.com', pathname: '/search', search: '?q=x&udm=vids', href: 'https://www.google.com/search?q=x&udm=vids' }, 'videos'],
  [{ hostname: 'www.google.com', pathname: '/search', search: '?q=x&tbm=vids', href: 'https://www.google.com/search?q=x&tbm=vids' }, 'videos'],
  [{ hostname: 'www.bing.com', pathname: '/images/search', search: '?q=x', href: 'https://www.bing.com/images/search?q=x' }, 'images'],
  [{ hostname: 'duckduckgo.com', pathname: '/', search: '?iax=images', href: 'https://duckduckgo.com/?iax=images' }, 'images'],
  [{ hostname: 'www.startpage.com', pathname: '/sp/search', search: '?query=x&category=images', href: 'https://www.startpage.com/sp/search?query=x&category=images' }, 'web'],
  [{ hostname: 'so.toutiao.com', pathname: '/search', search: '?keyword=x&pd=video', href: 'https://so.toutiao.com/search?keyword=x&pd=video' }, 'videos'],
  [{ hostname: 'www.google.com', pathname: '/search', search: '?q=/imgres', href: 'https://www.google.com/search?q=/imgres' }, 'web'],
  [{ hostname: 'www.google.com', pathname: '/search', search: '?q=https://example.com/videohp', href: 'https://www.google.com/search?q=https://example.com/videohp' }, 'web'],
  [{ hostname: 'www.google.com', pathname: '/imghp', search: '', href: 'https://www.google.com/imghp' }, 'images'],
  [{ hostname: 'search.yahoo.co.jp', pathname: '/image/search', search: '?p=cat', href: 'https://search.yahoo.co.jp/image/search?p=cat' }, 'images'],
  [{ hostname: 'search.yahoo.co.jp', pathname: '/search', search: '?p=/image/search', href: 'https://search.yahoo.co.jp/search?p=/image/search' }, 'web'],
  [{ hostname: 'search.yahoo.com', pathname: '/search/images', search: '?p=cat', href: 'https://search.yahoo.com/search/images?p=cat' }, 'images'],
  [{ hostname: 'search.yahoo.com', pathname: '/search', search: '?p=/search/images', href: 'https://search.yahoo.com/search?p=/search/images' }, 'web'],
];
for (const [i, [loc, expected]] of catCases.entries()) assert(`选择器-064-${i + 1}: category ${loc.hostname}${loc.pathname}${loc.search} -> ${expected}`, factory({ location: loc }, selectors).getSearchCategory(loc) === expected);
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
  const raceOk = ran1 + ran2 === 1 && tab1.readSyncLock('race') === null && tab2.readSyncLock('race') === null;
  const tab = createLockEnv('tab-c');
  let threw = false;
  try { await tab.runWithSyncLock('fail', async () => { throw new Error('boom'); }); } catch (e) { threw = true; }
  check('选择器-065: 并发抢占仅一个执行者完成释放锁且任务异常仍释放锁', raceOk && threw === true && tab.readSyncLock('fail') === null);
}

// 结果摘要后备提取遇到相对选择器不得抛异常
await (async () => {
  const selectorsDecl = 'const SELECTORS = ' + getSelectorsObjectText() + ';';
  const getResultSnippet = new Function('GM_getValue', 'let activeSelectors = null; let _redirectSpecsCache = new Map();\nconst SELECTORS_KEY = \'searchfilter_selectors\'; const ENGINE_SUBSCRIPTIONS_KEY = \'searchfilter_engine_subscriptions\'; const BUILTIN_ENGINE_SUB_URL = \'https://raw.githubusercontent.com/Carteahere/Search-Engine-Result-Hider/main/Other/SELECTORS.js\'; function t(key) { return key; } function resetSelectorCache() { activeSelectors = null; }\nconst PAGE_FIELDS = [\'root\', \'url\', \'title\', \'snippet\', \'extraSelector\', \'button\', \'skip\', \'group\', \'grid\', \'dedupeBy\', \'link\'];\nlet _catDefCacheKey = null; let _catDefCache = null; let _categoryCacheHref = null; let _categoryCacheResult = \'web\'; let _categoryCacheEngine = null;\nfunction getSearchCategory() { return \'web\'; }\n' + selectorsDecl + '\n' + src.match(/const builtinSelectorOf = .+?;/)[0] + '\n' + ['normalizeSelectorList', 'hasTopLevelComma', 'splitTopLevelSelectorList', 'normalizeButton', 'normalizePageMap', 'mergeSelectorDef', 'pickProp', 'pickProps', 'getUserSelectors', 'getEngineSubscriptions', 'saveEngineSubscriptions', 'selectorMatchValue', 'coerceRegexValue', 'parseSelectorMatch', 'coerceSelectorDef', 'coercePageMatch', 'getSubscribedSelectors', 'getBaseSelectors', 'getSelectors', 'resolvePageDef', 'findPageByCategory', 'getResultExtraElements', 'getResultSnippet'].map((n) => extractFn(src, n)).join('\n') + '\nreturn getResultSnippet;')(() => undefined);
  const throwIfRel = (fn) => (sel) => { if (sel.startsWith('+')) { const e = new Error(sel + ' is not a valid selector'); e.name = 'SyntaxError'; throw e; } return fn(sel); };
  let threw = false, out = '';
  const extraRow = { textContent: '  extra text  ', matches: throwIfRel(() => false), querySelector: throwIfRel(() => null), contains: () => false };
  const resultEl = { textContent: '', querySelector: throwIfRel(() => null), parentElement: null };
  resultEl.parentElement = { children: [resultEl, extraRow], querySelectorAll: (sel) => (String(sel).includes(':nth-child(1)') ? [extraRow] : []) };
  try { out = getResultSnippet(resultEl, 'duckduckgo_lite'); } catch (e) { threw = true; }
  check('选择器-066: 相对选择器后备提取不抛异常', threw === false && out === '');
})();

// 修复回归: 顶层逗号判定 / 折叠CSS按引擎限域
{
  const mkComma = (srcText) => new Function(extractFn(srcText, 'hasTopLevelComma') + '\nreturn hasTopLevelComma;')();
  const commaMain = mkComma(src), commaLite = mkComma(readRepoFile('Lite.user.js'));
  check('选择器-067: 引号与括号内逗号不算顶层逗号(主版+Lite)', commaMain('[data-x="a,b"]') === false && commaMain(':is(.a,.b)') === false && commaMain('.a, .b') === true && commaLite('[data-x="a,b"]') === false && commaLite('.a, .b') === true);
}

// 修复回归: Google图片结果自身是网格项时不得越级隐藏祖先
{
  const mkEl = (tag, cls) => ({ tagName: tag, className: cls, style: { display: '' }, attrs: {}, children: [], parentElement: null, grid: false,
    setAttribute(k, v) { this.attrs[k] = v; }, getAttribute(k) { return this.attrs[k] ?? null; },
    querySelectorAll(sel) { const out = []; const walk = (n) => { for (const c of n.children) { if (sel === 'div.isv-r, div.ivg-i' && (c.className === 'isv-r' || c.className === 'ivg-i')) out.push(c); walk(c); } }; walk(this); return out; } });
  const add = (p, c) => { c.parentElement = p; p.children.push(c); return c; };
  const mkMark = (srcText) => new Function('getComputedStyle', `
    let _hiddenParentCount = 0;
    function resolvePageDef() { return { grid: { anchor: 'grid', items: ['div.isv-r, div.ivg-i'] } }; }
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
  check('选择器-068: Google图片结果自身为网格项时不越级隐藏(主版+Lite)', s.center.style.display === '' && s.grid.style.display === '' && sLite.center.style.display === '' && a.center.style.display === '' && a.wrap.style.display === 'none' && b.center.style.display === '' && b.wrap.style.display === '' && c.wrap.style.display === 'none');
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
  const R14 = apiM.parseSelectorText('__proto__: { match: "a", root: ".x" }');
  const protoJson = apiM.parseSelectorText('{"__proto__":{"containers":".x","match":"x"}}');
  const protoOk = R14.config === null && R14.errors.length > 0 && protoJson.config === null && protoJson.errors.length > 0 && !Object.hasOwn(R14.config || {}, '__proto__');
  const apiSer = new Function(`
    const SELECTORS = {};
    const PAGE_FIELDS = ['root', 'url', 'title', 'snippet', 'extraSelector', 'button', 'skip', 'group', 'grid', 'dedupeBy', 'link', 'blockedCss', 'site'];
    ${extractFn(src, 'normalizeSelectorList')}
    ${extractFn(src, 'normalizePageMap')}
    ${extractFn(src, 'regexSourceToLiteralText')}
    ${extractFn(src, 'escapeJsString')}
    ${extractFn(src, 'parseRegexLiteral')}
    ${extractFn(src, 'isRegexLiteralStr')}
    ${extractFn(src, 'matchDefToParts')}
    ${extractFn(src, 'serializeSelectors')}
    return serializeSelectors;
  `)();
  const PK = apiSer({ '123abc': { match: '(?:^|\\.)x\\.example\\.com$', root: '.r', url: ['attribute', 'href', 'a[href]'] } });
  const RRT = apiM.parseSelectorText(PK);
  check('选择器-069: __proto__键不污染对象且数字开头键序列化往返无损', protoOk && PK.includes("'123abc':") && !RRT.errors.length && !!RRT.config && !!RRT.config['123abc'] && RRT.config['123abc'].includeRegex.source === '(?:^|\\.)x\\.example\\.com$' && RRT.config['123abc'].includeRegex.flags === 'i');

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
      ${extractFn(s, 'resultGroupMembers')}
      function googleResultBlocks(parent) { return resultGroupMembers(parent, 'div.g, div.tF2Cxc, div.MjjYud'); }
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
      return { saveOriginalDisplay, googleResultBlocks, visibleUnblocked, hideParentIfNoVisibleSiblings, markResultGridSlot, hideGridCell, resetResultStyles, restoreParentDisplay, restoreAllHiddenParents, reconcileHiddenParents, getCount: () => _hiddenParentCount, setHideData: (v) => { __hideSelectorsData = v; _hideNamesCache = null; } };
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
    const hidden = P.style.display === 'none' && P.getAttribute('data-blocker-google-parent') === 'true' && P.getAttribute('data-serh-orig-display') === '';
    fns.resetResultStyles(g1);
    fns.reconcileHiddenParents();
    check('选择器-070: 全部屏蔽后父隐藏保存原display且reconcile恢复存在可见未屏蔽子项的父容器', hidden && P.style.display === '' && !P.hasAttribute('data-blocker-google-parent') && !P.hasAttribute('data-serh-orig-display'));
  }
  {
    const { root, fns } = makeParentEnv(false);
    const P = makeTreeEl('div', 'MjjYud', root);
    const g = makeTreeEl('div', 'g', P);
    makeTreeEl('div', 'tF2Cxc', g);
    blockEl(fns, g);
    fns.hideParentIfNoVisibleSiblings(P, fns.googleResultBlocks(P), 'data-blocker-google-parent');
    check('选择器-071: 嵌套tF2Cxc不再把已屏蔽的div.g误判为可见，父容器隐藏', P.style.display === 'none' && P.getAttribute('data-blocker-google-parent') === 'true' && fns.googleResultBlocks(P).length === 1);
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
    const restore = li.style.display === '' && !li.hasAttribute('data-serh-grid-item-hidden') && iuscp.style.display === '' && iuscp.getAttribute('data-is-blocked') === null;
    const { root: root2, fns: fns2 } = makeParentEnv(false);
    const li2 = makeTreeEl('li', '', root2);
    const iuscp2 = makeTreeEl('div', 'iuscp', li2);
    const imgpt2 = makeTreeEl('div', 'imgpt', iuscp2);
    makeTreeEl('a', 'iusc', imgpt2);
    blockEl(fns2, iuscp2); fns2.hideGridCell(li2, 'data-serh-grid-item-hidden');
    fns2.reconcileHiddenParents();
    const mainKeep = li2.style.display === 'none' && li2.getAttribute('data-serh-grid-item-hidden') === 'true';
    const lite = makeParentEnv(false, readRepoFile('Lite.user.js'));
    const liteLi = makeTreeEl('li', '', lite.root); const liteIuscp = makeTreeEl('div', 'iuscp', liteLi); const liteImgpt = makeTreeEl('div', 'imgpt', liteIuscp);
    makeTreeEl('a', 'iusc', liteImgpt); blockEl(lite.fns, liteIuscp); lite.fns.hideGridCell(liteLi, 'data-serhl-grid-item-hidden');
    lite.fns.reconcileHiddenParents();
    check('选择器-072: bing图片li槽位解除屏蔽后经closest标记恢复且内层imgpt无标记祖先已屏蔽时不恢复空槽位(主/Lite)', restore && mainKeep && liteLi.style.display === 'none' && liteLi.getAttribute('data-serhl-grid-item-hidden') === 'true');
  }
  // 修复留档: 隐藏网格槽位后新增可见结果或子项被移除需恢复, 避免槽位永久空白
  {
    const { root, fns } = makeParentEnv(false);
    const cell = makeTreeEl('div', '', root);
    const c1 = makeTreeEl('div', '', cell); c1.setAttribute('data-attrid', 'images universal'); blockEl(fns, c1);
    fns.hideGridCell(cell, 'data-serh-grid-item-hidden'); fns.reconcileHiddenParents();
    makeTreeEl('div', '', cell).setAttribute('data-attrid', 'images universal');
    fns.reconcileHiddenParents();
    check('选择器-073: Google槽位新增可见data-attrid结果后恢复', cell.style.display === '' && !cell.hasAttribute('data-serh-grid-item-hidden'));
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
    check('选择器-074: 再次打开已存在面板只聚焦不销毁未保存编辑(主/Lite)', run(src) && run(readRepoFile('Lite.user.js')));
  }
  {
    const linkApi = new Function('SELECTORS', 'REDIRECT_CODECS', `
      function toASCIIHostname(h) { return h; }
      function toASCIIUrl(u) { return u; }
      ${extractFn(src, 'splitTopLevelSelectorList')}
      ${extractFn(src, 'normalizeSelectorList')}
      ${extractFn(src, 'normalizeButton')}
      ${extractFn(src, 'cleanPage')}
      ${extractFn(src, 'normalizePageMap')}
      const SELECTORS_NORM = {}; for (const k of Object.keys(SELECTORS)) { const d = { ...SELECTORS[k] }; const pages = normalizePageMap(d.pages); SELECTORS_NORM[k] = pages ? { ...cleanPage(d), pages } : cleanPage(d); }
      function getSelectors() { return SELECTORS_NORM; }
      const window = { location: { hostname: 'www.bing.com', href: 'https://www.bing.com/search?q=x' } };
      let _engineCacheHost = null; let _engineCacheResult = 'other'; let _categoryCacheHref = null; let _categoryCacheResult = 'web'; let _categoryCacheEngine = null; let _catDefCacheKey = null; let _catDefCache = null;
      function getSearchCategory() { return 'web'; }
      ${extractFn(src, 'isEngineHost')}
      ${extractFn(src, 'parseRegexLiteral')}
      ${extractFn(src, 'sanitizeRegexFlags')}
      ${extractFn(src, 'isRegexLiteralStr')}
      ${extractFn(src, 'coerceRegexValue')}
      ${extractFn(src, 'getSearchEngine')}
      ${extractFn(src, 'matchPatternToRegex')}
      ${extractFn(src, 'matchPatternsTest')}
      ${extractFn(src, 'splitTopLevelSelectorList')}
      ${extractFn(src, 'normalizeButton')}
      ${extractFn(src, 'cleanPage')}
      ${extractFn(src, 'normalizePageMap')}
      ${extractFn(src, 'pickProp')}
      ${extractFn(src, 'pickProps')}
      ${extractFn(src, 'mergeSelectorDef')}
      ${extractFn(src, 'resolvePageDef')}
      ${extractFn(src, 'findPageByCategory')}
      ${extractFn(src, 'tryUrl')}
      ${extractFn(src, 'decodeRedirectTarget')}
      ${extractFn(src, 'decodeBase64UrlTarget')}
      ${extractFn(src, 'isOpaqueRedirectUrl')}
      ${extractFn(src, 'unwrapRedirectUrl')}
      ${['tryUrl', 'cmdRe', 'cmdQueryEl', 'runCmdEl', 'cmdText', 'cmdAttr', 'cmdPath', 'cmdDomain', 'cmdOrigin', 'cmdAbsUrl', 'isOpaqueRedirectValue', 'redirectsEnabled', 'getRedirectSpecs', 'decodeRedirectOnce', 'hasRedirectSpec', 'runCmdValue', 'makeResultLink'].map((n) => extractFn(src, n)).join('\n')}
      ${extractFn(src, 'getResultLink')}
      return { getResultLink, unwrapRedirectUrl, runCmdValue, selectors: SELECTORS_NORM };
    `)(eval(`(${getSelectorsObjectText()})`), src.match(/const REDIRECT_CODECS = \{[\s\S]*?\n  \};/)[0].replace('const REDIRECT_CODECS', 'var REDIRECT_CODECS') + '\nvar _redirectSpecsCache = new Map();');
    function bingResult(href, citeText) {
      return { querySelector(sel) { if (sel === '.b_attribution, .b_algoheader cite, cite') return citeText ? { textContent: citeText } : null; return /h2 a/.test(sel) ? { href } : null; } };
    }
    const badCk = 'https://www.bing.com/ck/a?!&u=a1!!!!';
    const goodCk = 'https://www.bing.com/ck/a?!&u=a1' + Buffer.from('https://example.org/page').toString('base64');
    const l1 = linkApi.getResultLink(bingResult(badCk, 'www.example.com'), 'bing');
    const l2 = linkApi.getResultLink(bingResult(badCk, 'www.bing.com'), 'bing');
    const l3 = linkApi.getResultLink(bingResult(goodCk, 'https://nope.example'), 'bing');
    const douyin = 'https://www.douyin.com/search/%E7%9B%90%E6%B4%A5%E8%99%BE%E6%A2%97';
    const l4 = linkApi.getResultLink(bingResult(douyin, 'https://www.douyin.com \u203a search \u203a x'), 'bing');
    check('选择器-075: bing解码失败回退cite裸域且cite为自身域名与解码成功不回退且a>h2标题取完整链接', !!l1 && l1.href === 'https://www.example.com/' && !!l2 && l2.href === badCk && !!l3 && l3.href === goodCk && !!l4 && l4.href === douyin);
    const yRU = 'https://r.search.yahoo.com/_ylt=A/RU=' + encodeURIComponent('https://example.com/jp') + '/RK=2/RS=x';
    const yStar = 'https://r.search.yahoo.com/_ylt=A/*-https://example.com/star';
    check('选择器-076: yahoo pathValue按选择器数据正则解包RU且hrefSuffix解包尾缀', linkApi.unwrapRedirectUrl(yRU) === 'https://example.com/jp' && linkApi.unwrapRedirectUrl(yStar) === 'https://example.com/star');
  }
}

// ---- sameSelectorDef 比较 disabled / 字段级diff / 端到端校验与prune ----
{
  const selStore = { current: undefined };
  const selFns = ['parseRegexLiteral', 'sanitizeRegexFlags', 'isRegexLiteralStr', 'normalizeSelectorList', 'isCommandArray', 'simpleToCommand', 'normalizeLink', 'cleanPage', 'normalizePageMap', 'mergePageObjects', 'pickProp', 'pickProps', 'mergeSelectorDef', 'getUserSelectors', 'getEngineSubscriptions', 'saveEngineSubscriptions', 'selectorMatchValue', 'coerceRegexValue', 'parseSelectorMatch', 'coerceSelectorDef', 'coercePageMatch', 'getSubscribedSelectors', 'getBaseSelectors', 'getSelectors', 'resetSelectorCache', 'getInvalidRegexFlags', 'regexSourceToLiteralText', 'escapeJsString', 'matchDefToParts', 'jsonKey', 'serializeSelectors', 'normalizeMatchLiteral', 'parseSelectorText', 'normalizeSelectorAliases', 'pageMapKey', 'sameSelectorDef', 'diffSelectorDefFields', 'diffUserSelectors'].map((n) => extractFn(src, n));
  const selApi = new Function('GM_getValue', 'storeRef', `
const SELECTORS_KEY = 'searchfilter_selectors'; const ENGINE_SUBSCRIPTIONS_KEY = 'searchfilter_engine_subscriptions'; const BUILTIN_ENGINE_SUB_URL = 'https://raw.githubusercontent.com/Carteahere/Search-Engine-Result-Hider/main/Other/SELECTORS.js';
const SUPPORTED_REGEX_FLAGS = 'imsu';
const PAGE_FIELDS = ['root', 'url', 'title', 'snippet', 'extraSelector', 'button', 'skip', 'group', 'grid', 'dedupeBy', 'link', 'blockedCss', 'site'];
const SELECTORS = ${getSelectorsObjectText()};
let activeSelectors = null; let _redirectSpecsCache = new Map();
let _engineCacheHost = null;
${src.match(/const builtinSelectorOf = .+?;/)[0]}
let _engineCacheResult = 'other';
const window = { location: { hostname: 'www.google.com', href: 'https://www.google.com/' } };
function t(key) { return key; }
${selFns.join('\n')}
return { getSelectors, parseSelectorText, diffUserSelectors, mergeSelectorDef };
`)((key, def) => (key === 'searchfilter_selectors' ? (selStore.current === undefined ? def : selStore.current) : def), selStore);
  const mergedAll = selApi.getSelectors();
  const diff = selApi.diffUserSelectors(Object.assign({}, mergedAll, { bing: Object.assign({}, mergedAll.bing, { root: 'div.custom' }) }));
  const pinningFields = ['match', 'url'].filter((k) => k in (diff.bing || {}));
  const fieldOk = 'bing' in diff && pinningFields.length === 0 && diff.bing.root === 'div.custom';
  const pageCfg = Object.assign({}, mergedAll, { bing: Object.assign({}, mergedAll.bing, { pages: Object.assign({}, mergedAll.bing.pages, { images: Object.assign({}, mergedAll.bing.pages.images, { root: 'div.custom-img' }) }) }) });
  const pageDiff = selApi.diffUserSelectors(pageCfg); const pd = pageDiff.bing && pageDiff.bing.pages;
  const upgradedBase = Object.assign({}, mergedAll.bing, { pages: Object.assign({}, mergedAll.bing.pages, { videos: Object.assign({}, mergedAll.bing.pages.videos, { root: 'div.NEW_VIDEO' }) }) });
  const rem = selApi.mergeSelectorDef(pageDiff.bing, upgradedBase);
  const pageOk = !!pd && Object.keys(pd).join(',') === 'images' && Object.keys(pd.images).join(',') === 'root' && pd.images.root === 'div.custom-img' && rem.pages.images.root === 'div.custom-img' && rem.pages.images.url === mergedAll.bing.pages.images.url && rem.pages.videos.root === 'div.NEW_VIDEO';
  const rxBase = mergedAll.bing.pages.images.includeRegex;
  const rxCfg = Object.assign({}, mergedAll, { bing: Object.assign({}, mergedAll.bing, { pages: Object.assign({}, mergedAll.bing.pages, { images: Object.assign({}, mergedAll.bing.pages.images, { includeRegex: /imagesonly/i }) }) }) });
  const rxDiff = selApi.diffUserSelectors(rxCfg);
  const rxOk = !!rxDiff.bing && !!rxDiff.bing.pages && Object.keys(rxDiff.bing.pages).join(',') === 'images' && Object.keys(rxDiff.bing.pages.images).join(',') === 'includeRegex' && rxBase instanceof RegExp && rxDiff.bing.pages.images.includeRegex instanceof RegExp && rxDiff.bing.pages.images.includeRegex.source === 'imagesonly';
  check('选择器-077: 字段级diff只保留改动字段且pages只存该页该字段未改页跟随内置升级且分类页includeRegex只保留该页该字段', fieldOk && pageOk && rxOk);

  const fixApi = new Function(`
const SELECTORS_KEY = 'searchfilter_selectors'; const ENGINE_SUBSCRIPTIONS_KEY = 'searchfilter_engine_subscriptions'; const BUILTIN_ENGINE_SUB_URL = 'https://raw.githubusercontent.com/Carteahere/Search-Engine-Result-Hider/main/Other/SELECTORS.js';
const SELECTORS = ${getSelectorsObjectText()};
let activeSelectors = null; let _redirectSpecsCache = new Map(); let _engineCacheHost = null; let _engineCacheResult = 'other'; let _observedSelector = ''; let _engineStyleEl = null;
let stored = undefined;
const GM_getValue = (key, def) => (key === SELECTORS_KEY && stored !== undefined ? stored : def);
const GM_setValue = (key, val) => { if (key === SELECTORS_KEY) stored = val; };
const t = (key) => key;
const isValidCssSelector = () => true;
const hasPseudoElement = (s) => /::/.test(String(s));
const builtinSelectorOf = (key) => (SELECTORS[key] && typeof SELECTORS[key] === 'object') ? SELECTORS[key] : {};
${['normalizeSelectorList', 'normalizePageMap', 'getInvalidRegexFlags', 'matchDefToParts', 'jsonKey', 'resetSelectorCache', 'getUserSelectors', 'getEngineSubscriptions', 'saveEngineSubscriptions', 'selectorMatchValue', 'coerceRegexValue', 'parseSelectorMatch', 'coerceSelectorDef', 'coercePageMatch', 'getSubscribedSelectors', 'getBaseSelectors', 'parseSelectorText', 'validateUserSelectors', 'sameSelectorDef', 'pruneUserSelectors'].map((n) => extractFn(src, n)).join('\n')}
return { parseSelectorText, validateUserSelectors, pruneUserSelectors, SELECTORS, getStored: () => stored, setStored: (v) => { stored = v; } };
  `)();
  const parsedTrue = fixApi.parseSelectorText('{"bing": true}');
  check('选择器-078: {"bing": true} 端到端被校验拦截, 不以空配置覆盖存储', 'bing' in parsedTrue.config && fixApi.validateUserSelectors(parsedTrue.config).length > 0);
}



// ---- Google goto 包裹回退 ----
{
  const linkApiG = new Function('SELECTORS', 'REDIRECT_CODECS', `
    function toASCIIHostname(h) { return h; }
    function toASCIIUrl(u) { return u; }
    ${extractFn(src, 'splitTopLevelSelectorList')}
    ${extractFn(src, 'normalizeSelectorList')}
    ${extractFn(src, 'normalizeButton')}
    ${extractFn(src, 'cleanPage')}
    ${extractFn(src, 'normalizePageMap')}
    const SELECTORS_NORM = {}; for (const k of Object.keys(SELECTORS)) { const d = { ...SELECTORS[k] }; const pages = normalizePageMap(d.pages); SELECTORS_NORM[k] = pages ? { ...cleanPage(d), pages } : cleanPage(d); }
    function getSelectors() { return SELECTORS_NORM; }
    const window = { location: { hostname: 'www.google.com', href: 'https://www.google.com/search?q=x', origin: 'https://www.google.com' } };
    const location = window.location;
    let _engineCacheHost = null; let _engineCacheResult = 'other'; let _categoryCacheHref = null; let _categoryCacheResult = 'web'; let _categoryCacheEngine = null; let _catDefCacheKey = null; let _catDefCache = null;
    function getSearchCategory() { return 'web'; }
    ${extractFn(src, 'isEngineHost')}
    const isNotGoogleHost = (h) => !!h && !isEngineHost('google', h);
    ${extractFn(src, 'parseRegexLiteral')}
    ${extractFn(src, 'sanitizeRegexFlags')}
    ${extractFn(src, 'isRegexLiteralStr')}
    ${extractFn(src, 'coerceRegexValue')}
    ${extractFn(src, 'getSearchEngine')}
    ${extractFn(src, 'matchPatternToRegex')}
    ${extractFn(src, 'matchPatternsTest')}
    ${extractFn(src, 'mergeSelectorDef')}
    ${extractFn(src, 'resolvePageDef')}
    ${extractFn(src, 'decodeRedirectTarget')}
    ${extractFn(src, 'decodeBase64UrlTarget')}
    ${extractFn(src, 'isOpaqueRedirectUrl')}
    ${extractFn(src, 'unwrapRedirectUrl')}
    ${['tryUrl', 'cmdRe', 'cmdQueryEl', 'runCmdEl', 'cmdText', 'cmdAttr', 'cmdPath', 'cmdDomain', 'cmdOrigin', 'cmdAbsUrl', 'isOpaqueRedirectValue', 'redirectsEnabled', 'getRedirectSpecs', 'decodeRedirectOnce', 'hasRedirectSpec', 'runCmdValue', 'makeResultLink'].map((n) => extractFn(src, n)).join('\n')}
    ${extractFn(src, 'getResultLink')}
    return { getResultLink };
  `)(eval(`(${getSelectorsObjectText()})`), src.match(/const REDIRECT_CODECS = \{[\s\S]*?\n  \};/)[0].replace('const REDIRECT_CODECS', 'var REDIRECT_CODECS') + '\nvar _redirectSpecsCache = new Map();');
  const PILL = '.lJQCTe, .XVWGNd, .R8BTeb, span.ob9lvb, .eip8Bb';
  const gotoUrl = 'https://www.google.com/goto?url=CAESAb1_-Ab1_-Ab1_-Ab1_-Ab1_-Ab1_-Ab1_-Ab1_-Ab1_-Ab1_-Ab1_-';
  const citeText = 'https://blog.hubspot.com › Website';
  const citeEl = { textContent: citeText };
  const pillEl = { textContent: '› Website', closest: (sel) => (sel === 'cite' ? citeEl : null) };
  const gotoEl = () => ({ href: gotoUrl, getAttribute: () => null, setAttribute: () => {} });
  const resGoto = {
    querySelector(sel) { return sel === PILL ? pillEl : sel === 'cite' ? citeEl : gotoEl(); },
    querySelectorAll(sel) { return sel === 'cite' ? [citeEl] : []; }
  };
  const g5 = linkApiG.getResultLink(resGoto, 'google');
  check('选择器-079: goto包裹经pill→cite完整文本恢复可见域名', !!g5 && g5.href === 'https://blog.hubspot.com');
  const rt = new Function('getSelectors', 'REDIRECT_CODECS', `
    function toASCIIHostname(h) { return h; }
    function toASCIIUrl(u) { return u; }
    const window = { location: { hostname: 'www.google.com', href: 'https://www.google.com/search?q=x', origin: 'https://www.google.com' } };
    const location = window.location;
    let _engineCacheHost = null; let _engineCacheResult = 'other'; let _categoryCacheHref = null; let _categoryCacheResult = 'web'; let _categoryCacheEngine = null; let _catDefCacheKey = null; let _catDefCache = null;
    function getSearchCategory() { return 'web'; }
    ${extractFn(src, 'isEngineHost')}
    ${extractFn(src, 'getSearchEngine')}
    ${extractFn(src, 'matchPatternToRegex')}
    ${extractFn(src, 'matchPatternsTest')}
    const currentConfig = { removeRedirects: true };
    ${extractFn(src, 'decodeRedirectTarget')}
    ${extractFn(src, 'decodeBase64UrlTarget')}
    ${['tryUrl', 'cmdRe', 'cmdQueryEl', 'runCmdEl', 'cmdText', 'cmdAttr', 'cmdPath', 'cmdDomain', 'cmdOrigin', 'cmdAbsUrl', 'isOpaqueRedirectValue', 'redirectsEnabled', 'getRedirectSpecs', 'decodeRedirectOnce', 'unwrapRedirectUrl', 'hasRedirectSpec', 'runCmdValue', 'getCleanUrl', 'resolveUrlDomain'].map((n) => extractFn(src, n)).join('\n')}
    return { runCmdValue, getCleanUrl, resolveUrlDomain, currentConfig };
  `)(() => eval(`(${getSelectorsObjectText()})`), src.match(/const REDIRECT_CODECS = \{[\s\S]*?\n  \};/)[0].replace('const REDIRECT_CODECS', 'var REDIRECT_CODECS') + '\nvar _redirectSpecsCache = new Map();');
  const imgHref = 'https://www.google.com/imgres?imgurl=https%3A%2F%2Fcdn.example.net%2Fpic.jpg&tbnid=x';
  const mkEl = (sel) => ({ getAttribute: (n) => (n === 'href' && sel === 'a[href*="/imgres"]' ? imgHref : null), textContent: '', href: imgHref, matches: () => false, querySelector: () => null });
  const imgRoot = { querySelector: (sel) => (/imgres/.test(sel) ? mkEl('a[href*="/imgres"]') : null), matches: () => false, getAttribute: () => null, textContent: '' };
  const qpCmd = ['queryParam', 'imgurl', ['attribute', 'href', 'a[href*="/imgres"]']];
  const onVal = (rt.runCmdValue(imgRoot, qpCmd, 'link') || {}).value;
  rt.currentConfig.removeRedirects = false;
  const offVal = rt.runCmdValue(imgRoot, qpCmd, 'link');
  const linkEl = { href: 'https://www.google.com/url?q=https%3A%2F%2Fblog.example.com%2Fa', getAttribute: () => null, closest: () => null };
  const cleanOff = rt.getCleanUrl(linkEl, 'google');
  rt.currentConfig.removeRedirects = true;
  const cleanOn = rt.getCleanUrl(linkEl, 'google');
  check('选择器-080: 关闭去除重定向后 queryParam 不再解包且回退原链接', onVal === 'https://cdn.example.net/pic.jpg' && offVal === null && cleanOff === linkEl.href && cleanOn === linkEl.href);
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
    ${extractFn(src, 'isEngineHost')}
    const isNotGoogleHost = (h) => !!h && !isEngineHost('google', h);
    ${extractFn(src, 'parseRegexLiteral')}
    ${extractFn(src, 'sanitizeRegexFlags')}
    ${extractFn(src, 'isRegexLiteralStr')}
    ${extractFn(src, 'coerceRegexValue')}
    ${extractFn(src, 'getSearchEngine')}
    ${extractFn(src, 'matchPatternToRegex')}
    ${extractFn(src, 'matchPatternsTest')}
    ${extractFn(src, 'mergeSelectorDef')}
    ${extractFn(src, 'resolvePageDef')}
    ${extractFn(src, 'decodeRedirectTarget')}
    ${extractFn(src, 'decodeBase64UrlTarget')}
    ${extractFn(src, 'isOpaqueRedirectUrl')}
    ${extractFn(src, 'unwrapRedirectUrl')}
    ${extractFn(src, 'getResultLink')}
    return { getResultLink };
  `)({ test: { match: /search\.example\.com/, root: '.r', url: ['json', 'data', 'url', 'a.thumb'] } });
  const thumb = { getAttribute: (a) => a === 'data' ? '{"url":"https://example.com/x"}' : null, setAttribute() {} };
  const res = { matches: () => false, querySelector: (s) => s === 'a.thumb' ? thumb : null };
  const l = linkApiS.getResultLink(res, 'test');
  check('选择器-081: 顶层links字符串@json提取生效', !!l && l.href === 'https://example.com/x');
}
{
  const titleApi = new Function(`
    function resolvePageDef() { return { title: ['text', 'a.result'], snippet: ['text', '.snip'] }; }
    ${extractFn(src, 'getResultTitle')}
    ${extractFn(src, 'getResultTitleElement')}
    return { getResultTitle, getResultTitleElement };
  `)();
  const res = { textContent: 'Example title', matches: (s) => s === 'a.result' || s === '.snip', querySelector: () => null };
  check('选择器-082: 结果容器自身作为标题/摘要时仍可提取', titleApi.getResultTitle(res, 'test') === 'Example title' && titleApi.getResultTitleElement(res, 'test') === res);
}

// ---- 图片/视频/新闻真实卡片容器取链接 ----
{
  const linkApiC = new Function('SELECTORS', `
    function toASCIIHostname(h) { return h; }
    function toASCIIUrl(u) { return u; }
    let __coercedSelectors = null;
    function getSelectors() { if (__coercedSelectors) return __coercedSelectors; __coercedSelectors = {}; for (const k of Object.keys(SELECTORS)) __coercedSelectors[k] = coerceSelectorDef(SELECTORS[k], {}); return __coercedSelectors; }
    let currentHref = 'https://www.google.com/search?q=x&tbm=isch';
    const window = { location: { get hostname() { return new URL(currentHref).hostname; }, get href() { return currentHref; }, get origin() { return new URL(currentHref).origin; } } };
    const location = window.location;
    let _engineCacheHost = null; let _engineCacheResult = 'other'; let _categoryCacheHref = null; let _categoryCacheResult = 'web'; let _categoryCacheEngine = null; let _catDefCacheKey = null; let _catDefCache = null;
    const PAGE_FIELDS = ['root', 'url', 'title', 'snippet', 'extraSelector', 'button', 'skip', 'group', 'grid', 'dedupeBy', 'link', 'blockedCss', 'site'];
    ${extractFn(src, 'isEngineHost')}
    const isNotGoogleHost = (h) => !!h && !isEngineHost('google', h);
    ${extractFn(src, 'parseRegexLiteral')}
    ${extractFn(src, 'sanitizeRegexFlags')}
    ${extractFn(src, 'isRegexLiteralStr')}
    ${extractFn(src, 'coerceRegexValue')}
    ${extractFn(src, 'getSearchEngine')}
    ${extractFn(src, 'matchPatternToRegex')}
    ${extractFn(src, 'matchPatternsTest')}
    ${extractFn(src, 'getSearchCategory')}
    ${extractFn(src, 'normalizeSelectorList')}
    ${extractFn(src, 'normalizePageMap')}
    ${extractFn(src, 'mergeSelectorDef')}
    ${extractFn(src, 'coerceSelectorDef')}
    ${extractFn(src, 'resolvePageDef')}
    ${extractFn(src, 'decodeRedirectTarget')}
    ${extractFn(src, 'decodeBase64UrlTarget')}
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
  const gNewsHref = 'https://www.google.com/goto?url=abc';
  const gNewsEl = { tagName: 'A', href: gNewsHref, getAttribute: (a) => a === 'href' ? gNewsHref : null, setAttribute() {}, querySelector: (sel) => (sel === ':scope[href]' || sel === 'a[href]' ? gNewsEl : null) };
  const gNews = linkApiC.getResultLink(gNewsEl, 'google');
  linkApiC.setHref('https://www.bing.com/videos/search?q=x');
  const bVid = linkApiC.getResultLink(childAttr('[ourl]', 'ourl', 'https://video.example.com/v'), 'bing');
  linkApiC.setHref('https://www.bing.com/news/search?q=x');
  const bNewsEl = { tagName: 'DIV', getAttribute: () => null, setAttribute() {}, querySelector: (s) => s === 'a.title[href]' ? { href: 'https://news.example.com/a', getAttribute: (a) => a === 'href' ? 'https://news.example.com/a' : null } : null };
  const bNews = linkApiC.getResultLink(bNewsEl, 'bing');
  const cardOk = gImg.href === 'https://img.example.com/page' && gVid.href === 'https://www.youtube.com/watch?v=abc' && gNews && gNews.href === gNewsEl.href && bVid.href === 'https://video.example.com/v' && bNews.href === 'https://news.example.com/a';
  const selfNews = { tagName: 'A', href: 'https://news.example.com/x', getAttribute: (a) => a === 'href' ? 'https://news.example.com/x' : null, setAttribute() {}, matches: (s) => s === ':scope[href]', querySelector: () => null };
  linkApiC.setHref('https://www.google.com/search?q=x&tbm=nws');
  const gNewsSelf = linkApiC.getResultLink(selfNews, 'google');
  check('选择器-083: Google图片视频新闻与Bing视频新闻卡片容器取链接且容器自身为a时仍取到href', cardOk && gNewsSelf && gNewsSelf.href === selfNews.href);
}

// ---- 选择器-084: teardown 守卫与纯删除型变更 ----
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
      function getSearchEngine() { return 'test'; } function getRootSelector() { return '.x'; } function getRootCommand() { return '.x'; }
      ${extractFn(src, 'rootAnchorSelector')}
      ${extractFn(src, 'rootHasUpward')}
      ${extractFn(src, 'rootCommandKey')}
      ${extractFn(src, 'queryRootCommand')}
      ${extractFn(src, 'findRootContainer')}
      function getSearchCategory() { return 'web'; }
      function resolvePageDef() { return {}; }
      function peekResultUrl() { return ''; } function reprocessContainer() {} function getResultContentSignature() { return null; }
      const location = { href: 'https://www.google.com/search?q=x' };
      const history = { pushState() {}, replaceState() {} };
      const window = { addEventListener() {}, dispatchEvent() {} }; const Event = class {};
      ${extractFn(src, 'scheduleInitialScan')}
      ${fnSrc}
      return { ensureEngineSiteSetup };
    `)(documentStub, MutationObserver, () => { calls.raf++; }, (fn, ms) => { calls.timeouts.push({ fn, ms }); return calls.timeouts.length; }, calls);
    api.ensureEngineSiteSetup();
    return { calls, moCb, body };
  }
  const pureDelete = (() => {
    const { calls: callsR, moCb: moCbR, body: bodyR } = makeObserverEnv(true, extractFn(src, 'ensureEngineSiteSetup'));
    moCbR([{ type: 'childList', target: bodyR, removedNodes: [1] }]); callsR.timeouts[0].fn();
    const liteObs = makeObserverEnv(true, extractFn(readRepoFile('Lite.user.js'), 'ensureEngineSiteSetup'));
    liteObs.moCb([{ type: 'childList', target: liteObs.body, removedNodes: [1] }]); liteObs.calls.timeouts[0].fn();
    return callsR.scan === 1 && callsR.reconcile === 1 && liteObs.calls.scan === 1 && liteObs.calls.reconcile === 1;
  })();
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
  check('选择器-084: teardown后processSingleResult直接拒绝不提取链接且纯删除型变更触发reconcile恢复槽位(主版+Lite)', guardM.fn(stubResult) === false && guardM.counter.link === 0 && guardL.fn(stubResult) === false && guardL.counter.link === 0 && pureDelete);
}

// ---- 选择器-085: 等长正文变化仍按完整签名重处理 ----
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
      function getSearchEngine() { return 'test'; } function getRootSelector() { return '.x'; } function getRootCommand() { return '.x'; }
      ${extractFn(src, 'rootAnchorSelector')}
      ${extractFn(src, 'rootHasUpward')}
      ${extractFn(src, 'rootCommandKey')}
      ${extractFn(src, 'queryRootCommand')}
      ${extractFn(src, 'findRootContainer')}
      function getSearchCategory() { return 'web'; }
      function resolvePageDef() { return {}; }
      function peekResultUrl() { return ''; } function reprocessContainer() { calls.reprocess++; }
      function getResultContentSignature() { return container.sig; }
      function peekResultTextLen() { return 4; }
      const location = { href: 'https://www.google.com/search?q=x' };
      const history = { pushState() {}, replaceState() {} };
      const window = { addEventListener() {}, dispatchEvent() {} }; const Event = class {};
      ${extractFn(src, 'scheduleInitialScan')}
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
  check('选择器-085: 等长正文变化仍按完整签名重处理(主版)', env.calls.reprocess === 1);
}

// ---- 选择器-086: 订阅 match 非法时回退 base.match ----
{
  const parseSelectorMatchFn = new Function(extractFn(src, 'parseRegexLiteral') + '\n' + extractFn(src, 'sanitizeRegexFlags') + '\n' + extractFn(src, 'isRegexLiteralStr') + '\n' + extractFn(src, 'selectorMatchValue') + '\n' + extractFn(src, 'coerceRegexValue') + '\n' + extractFn(src, 'parseSelectorMatch') + '\nreturn parseSelectorMatch;')();
  assert('选择器-086: 订阅match正则非法时回退base.match不致引擎失效', (() => {
    const back = parseSelectorMatchFn({ match: '/(unclosed/' }, { match: /^ok\.base$/i });
    const fresh = parseSelectorMatchFn({ match: '/x.*/i' }, { match: /^base$/ });
    const none = parseSelectorMatchFn({ match: '/(bad/' }, null);
    const empty = parseSelectorMatchFn({}, { match: /^kept$/ });
    return back instanceof RegExp && back.source === '^ok\\.base$' && back.ignoreCase === true && fresh.source === 'x.*' && none === null && empty.source === '^kept$';
  })());
}


// 留档观察: Google已不渲染div.g(2026-10实测仅扁平MjjYud), 网格槽位回归测试保留以防布局回退(主/Lite共有)
// 留档观察: github/greasyfork/google/yahoo_japan的match为完整URL正则, getSearchEngine对主机名与整条URL匹配(SERPINFO做法)
// 留档观察: 图片搜索容器(bing/google/ddg/yandex/brave images)硬编码绕过订阅/自定义containers, 配套专用链接解包(设计)
// 留档观察: Lite与正式版共享CONFIG_KEY, 规则与共有设置互通, 双开后写覆盖先写, 勿双开
// 修复留档: reconcileHiddenParents在blockedShown期间摘除yandex/google父容器标记致再隐藏留白, 已补!blockedShown()守卫(主/Lite)
// 修复留档(主/Lite): forceReprocessAll分批对脱离DOM节点跳过, 防止污染计数与_hiddenParentCount
// ---- 选择器-087~094: match默认i与yandex父隐藏及主/Lite/Selectors.js选择器同步 ----
{
  // 修复留档: yandex父隐藏须按结果容器过滤children, 广告位等可见兄弟误判为未屏蔽致父容器不隐藏(主/Lite)
  const liteSrc = readRepoFile('Lite.user.js');
  const mkYx = (srcText) => new Function(`
    let _hiddenParentCount = 0;
    let showHiddenResults = false;
    const currentConfig = { collapseMode: false };
    function blockedShown() { return showHiddenResults || currentConfig.collapseMode === true; }
    function getRootSelector() { return 'div.Organic'; }
    function yandexResultBlocks(parent) { const sel = 'div.Organic'; return Array.from(parent.children || []).filter((el) => el.matches && el.matches(sel)); }
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
    check(`选择器-087: yandex父隐藏忽略广告位兄弟仅按结果容器判定(${label})`, li.style.display === 'none' && li.getAttribute('data-blocker-yandex-parent') === 'true');
  }
}
// 裸字符串 match 默认忽略大小写; 显式 /.../flags 形态不强制追加 i
{
  const parseSelectorMatch = new Function(extractFn(src, 'parseRegexLiteral') + '\n' + extractFn(src, 'sanitizeRegexFlags') + '\n' + extractFn(src, 'isRegexLiteralStr') + '\n' + extractFn(src, 'selectorMatchValue') + '\n' + extractFn(src, 'coerceRegexValue') + '\n' + extractFn(src, 'parseSelectorMatch') + '\nreturn parseSelectorMatch;')();
  const plain = parseSelectorMatch({ match: 'WWW\\.Example\\.Com' }, null);
  const explicit = parseSelectorMatch({ match: { source: 'ABC', flags: '' } }, null);
  check('选择器-088: 裸字符串match默认忽略大小写, 显式flags不强制追加i', plain instanceof RegExp && plain.ignoreCase === true && explicit instanceof RegExp && explicit.ignoreCase === false);
}
{
  const sel = eval(`(${getSelectorsObjectText()})`);
  const cmdApi = new Function('location', `
    ${['cmdRe', 'cmdQueryEl', 'runCmdEl', 'cmdText', 'cmdAttr', 'cmdPath', 'cmdDomain', 'cmdOrigin', 'isOpaqueRedirectValue', 'runCmdValue', 'makeResultLink'].map((n) => extractFn(src, n)).join('\n')}
    return { runCmdValue };
  `)({ origin: 'https://so.toutiao.com' });
  const preload = JSON.stringify([{ original_page_url: 'http://blog.sina.cn/x', text: 'cat title' }]);
  const inner = 'https://tsearch.toutiaoapi.com/s/magic_frame?preload=' + encodeURIComponent(preload);
  const href = 'https://so.toutiao.com/search/jump?url=' + encodeURIComponent(inner);
  const result = { querySelector: (s) => (s === 'a[href*="/search/jump"]' ? { href } : null) };
  const img = sel.toutiao.pages.images;
  check('选择器-089: Toutiao图片preload还原标题与来源URL', (cmdApi.runCmdValue(result, img.url, 'link') || {}).value === 'http://blog.sina.cn/x' && (cmdApi.runCmdValue(result, img.title, 'text') || {}).value === 'cat title');
}
{
  const sel = eval(`(${getSelectorsObjectText()})`);
  check('选择器-090: GitHub优先.search-title a', JSON.stringify(sel.github.title).includes('.search-title a') && JSON.stringify(sel.github.url).includes('.search-title a[href]'));
}
{
  const liteSrc = readRepoFile('Lite.user.js');
  const start = liteSrc.indexOf('const SELECTORS = {'); const open = liteSrc.indexOf('{', start);
  const liteSel = eval(`(${liteSrc.slice(open, extractObjectLiteral(liteSrc, open) + 1)})`);
  const liteCmdApi = new Function('location', `
    ${['cmdRe', 'cmdQueryEl', 'runCmdEl', 'cmdText', 'cmdAttr', 'cmdPath', 'cmdDomain', 'cmdOrigin', 'isOpaqueRedirectValue', 'runCmdValue', 'makeResultLink'].map((n) => extractFn(liteSrc, n)).join('\n')}
    return { runCmdValue };
  `)({ origin: 'https://so.toutiao.com' });
  const preload = JSON.stringify([{ original_page_url: 'http://blog.sina.cn/x', text: 'cat title' }]);
  const href = 'https://so.toutiao.com/search/jump?url=' + encodeURIComponent('https://tsearch.toutiaoapi.com/s/magic_frame?preload=' + encodeURIComponent(preload));
  const liteResult = { querySelector: (s) => (s === 'a[href*="/search/jump"]' ? { href } : null) };
  const liteImg = liteSel.toutiao.pages.images;
  const litePreload = (liteCmdApi.runCmdValue(liteResult, liteImg.url, 'link') || {}).value === 'http://blog.sina.cn/x' && (liteCmdApi.runCmdValue(liteResult, liteImg.title, 'text') || {}).value === 'cat title';
  check('选择器-091: Lite同步GitHub子域Google分类修复且Toutiao图片preload还原标题与来源URL', JSON.stringify(liteSel.github.title).includes('.search-title a') && JSON.stringify(liteSel.github.url).includes('.search-title a[href]') && liteSel.so360.includeRegex.test('https://news.so.com/') && liteSel.sogou.includeRegex.test('https://news.sogou.com/') && !liteSel.google.pages.images.includeRegex.test('https://www.google.com/search?q=/imgres') && litePreload);
}
{
  const upstream = eval(`({${readRepoFile('Selectors.js')}})`);
  check('选择器-092: Selectors.js同步GitHub/子域/Google/Yahoo分类修复', JSON.stringify(upstream.github.title).includes('.search-title a') && JSON.stringify(upstream.github.url).includes('.search-title a[href]') && upstream.so360.includeRegex.test('https://news.so.com/') && upstream.sogou.includeRegex.test('https://news.sogou.com/') && !upstream.google.pages.images.includeRegex.test('https://www.google.com/search?q=/imgres') && upstream.yahoo_japan.pages.images.includeRegex.test('https://search.yahoo.co.jp/image/search?p=cat'));
}
{
  const liteSrc = readRepoFile('Lite.user.js');
  const liteStart = liteSrc.indexOf('const SELECTORS = {'); const liteOpen = liteSrc.indexOf('{', liteStart);
  const all = [eval(`(${getSelectorsObjectText()})`), eval(`(${liteSrc.slice(liteOpen, extractObjectLiteral(liteSrc, liteOpen) + 1)})`), eval(`({${readRepoFile('Selectors.js')}})`)]; const ok = (s) => {
    const ids = Object.keys(s).filter((id) => s[id] && s[id].pages && s[id].pages.images);
    return ids.length >= 8 && ids.every((id) => s[id].pages.images.button === false) && s.google.button.exclude.includes('#hdtb') && s.google.excludeRegex instanceof RegExp && s.google.excludeRegex.test('https://www.google.com/maps') && !s.google.excludeRegex.test('https://www.google.com/search?q=x') && s.bing.command.link.redirects[0].params[0] === 'u' && s.yahoo.command.link.redirects[0].params.includes('dest') && s.toutiao.command.link.redirects[0].codec === 'url';
  };
  check('选择器-093: 主版/Lite/Selectors.js 按钮排除与重定向参数同步', all.every(ok));
}
// 修复留档(Lite): 全局serh改serhl时orig-display读写点与blocked类名增删点须同步改名 漏改致解除屏蔽后display不恢复灰底残留
{
  const liteSrc = readRepoFile('Lite.user.js');
  const fakeEl = () => { const attrs = new Map(); const classes = new Set(); return { style: { display: 'flex', position: '', outline: '', outlineOffset: '' }, classes, classList: { remove: (c) => classes.delete(c), add: (c) => classes.add(c) }, getAttribute: (k) => (attrs.has(k) ? attrs.get(k) : null), setAttribute: (k, v) => attrs.set(k, String(v)), removeAttribute: (k) => attrs.delete(k), hasAttribute: (k) => attrs.has(k), closest: () => null, querySelector: () => null }; };
  const stubs = 'const restoreResultExtraElements=()=>{};const restoreResultCollapse=()=>{};const _hrefUrlCache={delete(){}};const _resultContentCache={delete(){}};const _resultRetryCounts={delete(){}};const _peekUrlCache={delete(){}};const removeMatchedRuleLabel=()=>{};let _hiddenParentCount=0;let showHiddenResults=true;const currentConfig={collapseMode:false};';
  const api = new Function(stubs + extractFn(liteSrc, 'clearMatchedData') + '\n' + extractFn(liteSrc, 'saveOriginalDisplay') + '\n' + extractFn(liteSrc, 'restoreOriginalDisplay') + '\n' + extractFn(liteSrc, 'resetResultStyles') + '\n' + extractFn(liteSrc, 'visibleUnblocked') + '\n' + extractFn(liteSrc, 'blockedShown') + '\n' + extractFn(liteSrc, 'hideParentIfNoVisibleSiblings') + '\n' + extractFn(liteSrc, 'restoreParentDisplay') + '\nreturn { save: saveOriginalDisplay, reset: resetResultStyles, hide: hideParentIfNoVisibleSiblings, restore: restoreParentDisplay };')();
  const result = fakeEl(); api.save(result); result.classList.add('serhl-blocked-visible'); result.classList.add('serhl-blocked-collapsed'); result.style.display = 'none'; api.reset(result);
  const resetOk = result.style.display === 'flex' && !result.classes.has('serhl-blocked-visible') && !result.classes.has('serhl-blocked-collapsed') && !result.hasAttribute('data-serhl-orig-display');
  const parent = fakeEl(); parent.style.display = 'grid'; const kids = [fakeEl(), fakeEl()]; kids.forEach((k) => k.setAttribute('data-is-blocked', 'true')); api.hide(parent, kids, 'data-serh-group-hidden'); api.restore(parent);
  check('选择器-094: Lite解除屏蔽恢复原display清serhl类与orig属性且组父容器保存读回还原内联display', resetOk && parent.style.display === 'grid' && !parent.hasAttribute('data-serhl-orig-display'));
}
// ---- includeRegex/base64Url/regex大小写/redirect字符串path 移除自动i后的行为 ----
{
  const cmdApi = new Function(`
    function redirectsEnabled() { return true; }
    ${['cmdRe', 'cmdQueryEl', 'runCmdEl', 'cmdText', 'cmdAttr', 'cmdPath', 'cmdDomain', 'cmdOrigin', 'cmdAbsUrl', 'runCmdValue', 'makeResultLink'].map((n) => extractFn(src, n)).join('\n')}
    return { runCmdValue };
  `)();
  const el = (attrs) => ({ attrs, getAttribute: (k) => (attrs[k] !== undefined ? attrs[k] : null) });
  const noAttrs = cmdApi.runCmdValue(el({}), ['base64Url', 'img.x'], 'link');
  const withAttrs = cmdApi.runCmdValue(el({ 'data-u': 'u/aHR0cHM6Ly9leGFtcGxlLmNvbS9h' }), ['base64Url', 'data-u'], 'link');
  const cs = cmdApi.runCmdValue(el({ href: 'abc' }), ['regexInclude', 'ABC', ['attribute', 'href']], 'link');
  const ci = cmdApi.runCmdValue(el({ href: 'abc' }), ['regexInclude', /ABC/i, ['attribute', 'href']], 'link');
  const objFlags = cmdApi.runCmdValue(el({ href: 'abc' }), ['regexInclude', { source: 'ABC', flags: 'i' }, ['attribute', 'href']], 'link');
  check('选择器-095: base64Url须显式属性且regexInclude字符串区分大小写RegExp与对象保留flags', noAttrs === null && !!withAttrs && withAttrs.value === 'https://example.com/a' && cs === null && !!ci && ci.value === 'abc' && !!objFlags && objFlags.value === 'abc');
  const propEl = { href: 'https://example.com/p', textContent: 'T', getAttribute: (k) => (k === 'href' ? '/rel' : null) };
  const propRoot = { querySelector: (s) => (s === 'a.link' ? propEl : null), matches: () => false, getAttribute: () => null };
  const propVal = cmdApi.runCmdValue(propRoot, ['property', 'href', 'a.link'], 'link');
  const propMissing = cmdApi.runCmdValue(propRoot, ['property', 'missing', 'a.link'], 'link');
  const orVal = cmdApi.runCmdValue(propRoot, ['or', [['attribute', 'href', 'a.none'], ['property', 'textContent']], 'a.link'], 'text');
  const orNoEl = cmdApi.runCmdValue(propRoot, ['or', [['const', 'x']], 'a.none'], 'text');
  const liteSrc2 = readRepoFile('Lite.user.js');
  const liteCmd = new Function(`
    function redirectsEnabled() { return true; }
    ${['cmdRe', 'cmdQueryEl', 'runCmdEl', 'cmdText', 'cmdAttr', 'cmdPath', 'cmdDomain', 'cmdOrigin', 'isOpaqueRedirectValue', 'runCmdValue', 'makeResultLink'].map((n) => extractFn(liteSrc2, n)).join('\n')}
    return { runCmdValue };
  `)();
  const litePropEl = { href: 'https://example.com/l', textContent: 'L', getAttribute: () => null };
  const liteRoot2 = { querySelector: (s) => (s === 'a.link' ? litePropEl : null), matches: () => false };
  const liteProp = liteCmd.runCmdValue(liteRoot2, ['property', 'href', 'a.link'], 'link');
  const liteOr = liteCmd.runCmdValue(liteRoot2, ['or', [['property', 'textContent']], 'a.link'], 'text');
  check('选择器-096: property取元素JS属性缺元素为空且or第三参限定取值元素且Lite同步生效', !!propVal && propVal.value === 'https://example.com/p' && propMissing === null && !!orVal && orVal.value === 'T' && orNoEl === null && !!liteProp && liteProp.value === 'https://example.com/l' && !!liteOr && liteOr.value === 'L');
}
{
  const strPathApi = new Function('getSelectors', `
    var _redirectSpecsCache = new Map(); let currentConfig = {};
    function redirectsEnabled() { return currentConfig.removeRedirects !== false; }
    function isEngineHost() { return true; }
    ${src.match(/const REDIRECT_CODECS = \{[\s\S]*?\n  \};/)[0].replace('const REDIRECT_CODECS', 'var REDIRECT_CODECS')}
    ${['decodeRedirectTarget', 'tryUrl', 'getRedirectSpecs', 'decodeRedirectOnce', 'hasRedirectSpec'].map((n) => extractFn(src, n)).join('\n')}
    return { decodeRedirectOnce, hasRedirectSpec };
  `)(() => ({ sp: { match: /x/, link: { redirects: [{ path: '/JUMP/', params: ['u'], codec: 'url' }] } } }));
  const caseOk = strPathApi.hasRedirectSpec('https://h.example/jump/?u=https%3A%2F%2Fa.example%2Fb') === false && strPathApi.decodeRedirectOnce('https://h.example/JUMP/?u=https%3A%2F%2Fa.example%2Fb') === 'https://a.example/b';
  const rtApi = new Function(`
    var _redirectSpecsCache = new Map(); let currentConfig = {};
    function redirectsEnabled() { return currentConfig.removeRedirects !== false; }
    function isEngineHost() { return true; }
    ${src.match(/const REDIRECT_CODECS = \{[\s\S]*?\n  \};/)[0].replace('const REDIRECT_CODECS', 'var REDIRECT_CODECS')}
    ${['decodeRedirectTarget', 'tryUrl', 'getRedirectSpecs', 'decodeRedirectOnce', 'hasRedirectSpec', 'normalizeLink'].map((n) => extractFn(src, n)).join('\n')}
    const stored = JSON.parse(JSON.stringify({ path: { source: '^\\/jump\\/?$', flags: '' }, params: ['u'], codec: 'url' }));
    const link = normalizeLink({ redirects: [stored] });
    function getSelectors() { return { rt: { match: /x/, link } }; }
    return { decodeRedirectOnce, hasRedirectSpec, rebuilt: link.redirects[0].path instanceof RegExp };
  `)();
  check('选择器-097: redirect path字符串区分大小写不自动加i且订阅source/flags落库读取侧重建RegExp解链', caseOk && rtApi.rebuilt && rtApi.hasRedirectSpec('https://h.example/jump/?u=https%3A%2F%2Fa.example%2Fb') === true && rtApi.decodeRedirectOnce('https://h.example/jump/?u=https%3A%2F%2Fa.example%2Fb') === 'https://a.example/b');
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

})();
