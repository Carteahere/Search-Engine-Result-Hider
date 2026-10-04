// 选择器与引擎: 合并/覆盖/序列化/校验 / 选择器导入 / DOM增量扫描 / 引擎站装配拆卸与跨页同步 / 引擎检测与全站门控 / 跨标签页同步锁
// 命名规则: 选择器-三位序号: 描述; (对照) 为语义标记
// 分区: 一、选择器与引擎核心 / 二、修复回归
(async () => {
const fs = require('fs');
const path = require('path');

const scriptDir = path.join(__dirname, '..');
const scriptFiles = fs.readdirSync(scriptDir).filter((name) => name.endsWith('.js') && !name.toLowerCase().includes('lite')).sort();
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
  const rawExtract = (t, name) => { const ridx = t.indexOf('function ' + name + '('); const ropen = t.indexOf('{', t.indexOf(') {', ridx)); let rdepth = 0; let ri = ropen; for (; ri < t.length; ri++) { if (t[ri] === '{') rdepth++; else if (t[ri] === '}') { rdepth--; if (rdepth === 0) break; } } return t.slice(ridx, ri + 1); };
  const fn = text.slice(idx, i + 1);
  const prelude = [];
  if (!['findBalancedParenEnd', 'scanRuleString', 'encodeNonAscii'].includes(fnName)) {
    if (/scanRuleString\(|RULE_PREFIX_RE|RULE_PREFIX_REGEX_RE|RULE_LEADING_REGEX_RE|REGEX_CTX_[AB]\b/.test(fn)) {
      prelude.push(text.split('\n').filter(line => /^\s*const (?:RULE_\w+|REGEX_CTX_[AB]) =/.test(line)).map(line => line.replace('const ', 'var ')).join('\n'), rawExtract(text, 'findBalancedParenEnd'), rawExtract(text, 'scanRuleString'), rawExtract(text, 'isBadRegexTail'));
    }
    if (/encodeNonAscii\(/.test(fn)) prelude.push(rawExtract(text, 'encodeNonAscii'));
    if (/isUniqueFlagsStr\(|isFlagsCandidateError\(/.test(fn)) prelude.push(['isUniqueFlagsStr', 'isFlagsCandidateError'].map(n => rawExtract(text, n)).join('\n'));
  }
  if (['scanNewResults', 'teardownEngineSite'].includes(fnName)) {
    prelude.push('function restoreResultExtraElements() {}\nfunction reconcileHiddenParents() {}\nfunction restoreAllHiddenParents() {}');
  }
  return prelude.concat([fn]).join('\n');
}


let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? '  => ' + JSON.stringify(extra) : '')); }
}
function assert(name, cond, extra) { check(name, cond, extra); }

// SELECTORS 常量块(括号配对提取，不依赖注释)
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



// ==== 一、选择器与引擎核心 ====

// ---- 选择器-001~096: 默认合并/覆盖/序列化/校验/关联选择器 ----
await (async () => {
const selectorsStart = src.indexOf('const SELECTORS = {');
if (selectorsStart === -1) throw new Error('SELECTORS block not found');
const selectorsOpen = src.indexOf('{', selectorsStart);
const selectorsClose = extractObjectLiteral(src, selectorsOpen);
const selectorsObjectText = src.slice(selectorsOpen, selectorsClose + 1);
const selectors = eval(`(${selectorsObjectText})`);

// GM_getValue 桩 + document.querySelector 桩(仅对已知非法选择器抛错)
const storeRef = { current: undefined };
function GM_getValue(key, defaultValue) {
  if (key === 'searchfilter_selectors') return storeRef.current === undefined ? defaultValue : storeRef.current;
  return defaultValue;
}
const badCss = new Set(['div>>>', 'a[[', 'p:unknownpseudo(']);
global.document = {
  querySelector(selector) {
    if (badCss.has(selector)) { const e = new Error('invalid selector'); e.name = 'SyntaxError'; throw e; }
    return null;
  }
};

const fns = ['normalizeSelectorList', 'mergeSelectorDef', 'getUserSelectors', 'getSelectors', 'resetSelectorCache', 'getSearchEngine', 'isEngineSite', 'getContainerSelector', 'isValidCssSelector', 'hasPseudoElement', 'validateUserSelectors', 'getInvalidRegexFlags', 'regexSourceToLiteralText', 'escapeJsString', 'matchDefToParts', 'serializeSelectors', 'normalizeMatchLiteral', 'parseSelectorText', 'sameSelectorDef', 'diffSelectorDefFields', 'diffUserSelectors', 'pruneUserSelectors'].map((n) => extractFn(src, n));

// builtinSelectorOf 为 const 箭头函数, extractFn 提取不到, 按行原样提取以跟随源码
const builtinSelectorOfLine = src.match(/const builtinSelectorOf = .+?;/);
if (!builtinSelectorOfLine) throw new Error('builtinSelectorOf not found');

const body = `
const WEBDAV_SYNC_SELECTORS_KEY = 'searchfilter_webdav_sync_selectors';
const SELECTORS_KEY = 'searchfilter_selectors';
const SUPPORTED_REGEX_FLAGS = 'imsu';
const SELECTORS = ${selectorsObjectText};
let activeSelectors = null;
let _engineCacheHost = null;
${builtinSelectorOfLine[0]}
let _engineCacheResult = 'other';
let _observedSelector = '';
const window = { location: { get hostname() { return currentHost; }, get href() { return currentHref; } } };
let currentHost = 'www.google.com';
let currentHref = 'https://www.google.com/';
function t(key, params = {}) {
  let text = key;
  for (const [k, v] of Object.entries(params || {})) text += ':' + v;
  return text;
}
function GM_setValue(key, value) { if (key === 'searchfilter_selectors') storeRef.current = value; }
${fns.join('\n')}
return { getSelectors, getUserSelectors, getSearchEngine, isEngineSite, getContainerSelector, validateUserSelectors, resetSelectorCache, normalizeSelectorList, serializeSelectors, parseSelectorText, diffUserSelectors, pruneUserSelectors, sameSelectorDef,
  setHost: (h) => { currentHost = h; currentHref = 'https://' + h + '/'; },
  setHref: (h) => { currentHref = h; },
  setStore: (obj) => { storeRef.current = obj; resetSelectorCache(); },
};
`;
const api = new Function('GM_getValue', 'storeRef', body)(GM_getValue, storeRef);


const CUSTOM = {
  mysearx: {
    match: '(?:^|\\.)searx\\.example\\.com$',
    containers: '.result',
    titles: ['h3'],
    snippets: ['.content'],
    links: 'a[href]'
  }
};

// ---- 默认合并 ----
check('选择器-001: 默认无用户配置时返回内置', api.getSelectors().google.containers === 'div.g, div.MjjYud');
check('选择器-002: 内置键序在前', Object.keys(api.getSelectors()).join(',') === ['bing', 'google_scholar', 'google', 'duckduckgo_lite', 'duckduckgo', 'yandex', 'brave', 'yahoo', 'so360', 'sogou', 'toutiao', 'quark', 'other'].join(','));
check('选择器-003: getContainerSelector 内置', api.getContainerSelector('bing') === 'li.b_algo, div.b_algo');
check('选择器-003a(修复T): 头条链接兜底排除站内搜索链(相关搜索/大家都在搜卡不再显示 so.toutiao.com)', (() => {
  const links = api.getSelectors().toutiao.links;
  const arr = Array.isArray(links) ? links : [links];
  return arr[arr.length - 1] === 'a[href]:not([href*="/search?"])' && !arr.includes('a[href]');
})());

// ---- 覆盖内置 ----
api.setStore({ google: { match: '(?:^|\\.)google\\.', containers: 'div.myg', titles: ['h3'], snippets: ['.s'], links: 'a[href]' } });
check('选择器-004: 覆盖后 containers 生效', api.getContainerSelector('google') === 'div.myg');
check('选择器-005: 未覆盖引擎不受影响', api.getContainerSelector('bing') === 'li.b_algo, div.b_algo');
check('选择器-006: match 被编译为 RegExp', api.getSelectors().google.match instanceof RegExp);

// ---- 新增引擎 ----
api.setStore(CUSTOM);
api.setHost('searx.example.com');
check('选择器-007: 自定义引擎被识别', api.getSearchEngine() === 'mysearx');
check('选择器-008: 自定义引擎 isEngineSite 为真', api.isEngineSite() === true);
check('选择器-009: 自定义引擎容器选择器', api.getContainerSelector('mysearx') === '.result');

// ---- other 保留键 ----
api.setStore({ other: { match: '.*', containers: 'body' } });
api.setHost('random.site.org');
check('选择器-011: other 保留键被忽略', api.getSearchEngine() === 'other' && api.isEngineSite() === false);

// ---- 防御:非法 match 静默置空 ----
api.setStore({ broken: { match: '([', containers: '.x', titles: [], snippets: [], links: 'a[href]' } });
api.setHost('broken.example');
check('选择器-012: 非法match不崩溃且不激活', api.getSearchEngine() === 'other' && api.getSelectors().broken.match === null);

// ---- 缓存失效 ----
api.setStore(CUSTOM);
api.setHost('searx.example.com');
check('选择器-013: setStore 后缓存失效重新合并', api.getSearchEngine() === 'mysearx');

// ---- validateUserSelectors ----
check('选择器-014: 合法配置通过', api.validateUserSelectors(CUSTOM).length === 0);
check('选择器-015: 保留键报错', api.validateUserSelectors({ other: { match: 'a', containers: 'b' } }).some(m => m.includes('other')));
check('选择器-016: 非法键名报错', api.validateUserSelectors({ 'bad key!': { match: 'a', containers: 'b' } }).length === 1);
check('选择器-017: 非法正则报错', api.validateUserSelectors({ e1: { match: '([', containers: '.x' } }).some(m => m.includes('e1')));
check('选择器-018: 缺 containers 报错', api.validateUserSelectors({ e2: { match: 'a' } }).some(m => m.includes('containers')));
check('选择器-019: 缺 match 报错', api.validateUserSelectors({ e3: { containers: '.x' } }).some(m => m.includes('match')));
check('选择器-020: 非法 CSS 报错', api.validateUserSelectors({ e4: { match: 'a', containers: 'div>>>', titles: ['a[['] } }).length === 2);
check('选择器-021: 非对象配置报错', api.validateUserSelectors([1, 2]).length === 1 && api.validateUserSelectors('x').length === 1);
check('选择器-022: titles 字符串简写合法', api.validateUserSelectors({ e5: { match: 'a', containers: '.x', titles: 'h3', snippets: '.c', links: ['a', '.b'] } }).length === 0);
check('选择器-023: links 非法类型报错', api.validateUserSelectors({ e6: { match: 'a', containers: '.x', links: 123 } }).length === 1);
check('选择器-024: containers 伪元素被拒且引号内不误报', api.validateUserSelectors({ e7: { match: 'a', containers: 'div::after' } }).length === 1 && api.validateUserSelectors({ e8: { match: 'a', containers: '[data-x="a::b"]' } }).length === 0);
check('修复P-1: titles/snippets/links 伪元素被拒且引号内不误报', api.validateUserSelectors({ p1: { match: 'a', containers: '.x', titles: ['h3::after'] } }).length === 1 && api.validateUserSelectors({ p2: { match: 'a', containers: '.x', snippets: ['.c::before'] } }).length === 1 && api.validateUserSelectors({ p3: { match: 'a', containers: '.x', links: 'a::after' } }).length === 1 && api.validateUserSelectors({ p4: { match: 'a', containers: '.x', links: ['a', 'b::after'] } }).length === 1 && api.validateUserSelectors({ p5: { match: 'a', containers: '.x', titles: ['[data-k="a::b"]'] } }).length === 0);
check('选择器-025: 对象match校验: 非法flags报错且合法通过', api.validateUserSelectors({ e11: { match: { source: 'a', flags: 'q' }, containers: '.x' } }).length === 1 && api.validateUserSelectors({ e12: { match: { source: 'a', flags: 'i' }, containers: '.x' } }).length === 0);

// ---- normalizeSelectorList ----
check('选择器-026: 数组过滤非字符串', JSON.stringify(api.normalizeSelectorList(['a', 1, '', 'b'])) === '["a","b"]');
check('选择器-027: 字符串转单元素数组', JSON.stringify(api.normalizeSelectorList('h3')) === '["h3"]');
check('选择器-028: 空值转空数组', JSON.stringify(api.normalizeSelectorList(null)) === '[]');

// ---- JS 字面量序列化与解析 ----
const P1 = api.serializeSelectors();
check('选择器-029: 序列化为JS字面量', /bing:\s*\{/.test(P1) && /match: \//.test(P1) && P1.includes("'li.b_algo, div.b_algo'"));
const R1 = api.parseSelectorText(P1);
check('选择器-030: 序列化→解析往返一致', !R1.errors.length && !!R1.config && R1.config.bing.match === api.getSelectors().bing.match.source && R1.config.google.containers === 'div.g, div.MjjYud');
const R2 = api.parseSelectorText('const SELECTORS = {' + P1 + '};');
check('选择器-031: 支持 const 包裹', !R2.errors.length && !!R2.config && !!R2.config.duckduckgo && R2.config.google.titles.length > 0);
const R3 = api.parseSelectorText('{"e9":{"match":"a","containers":".x"}}');
check('选择器-032: 兼容旧JSON', !R3.errors.length && !!R3.config && R3.config.e9.match === 'a');
const R4 = api.parseSelectorText('e8: { match: /a[/ }');
check('选择器-033: 未闭合正则报错', R4.config === null && R4.errors.length === 1);
const R5 = api.parseSelectorText('e7: { match: /a/q }');
check('选择器-034: 非法flags报错', R5.config === null && R5.errors.length === 1);
const R6 = api.parseSelectorText('myx: { match: /(?:^|\\.)x\\.com$/, containers: ".r", titles: ["h3", \'a\'] }');
check('选择器-035: 自定义引擎解析并过校验', !R6.errors.length && R6.config.myx.match === '(?:^|\\.)x\\.com$' && api.validateUserSelectors(R6.config).length === 0);
const R7 = api.parseSelectorText('other: { match: /a/, containers: "b" }, z9: { match: /c/, containers: "d" }');
check('选择器-036: other 保留键被解析器丢弃', !R7.errors.length && !!R7.config && !R7.config.other && !!R7.config.z9);
api.setStore({ flg: { match: { source: 'a\\/b', flags: 'i' }, containers: '.x', titles: [], snippets: [], links: 'a[href]' } });
const P2 = api.serializeSelectors();
const R9 = api.parseSelectorText(P2);
check('选择器-037: match flags 序列化→解析往返保留并过校验', P2.includes('match: /a\\/b/i') && !R9.errors.length && R9.config.flg.match.source === 'a\\/b' && R9.config.flg.match.flags === 'i' && api.validateUserSelectors(R9.config).length === 0);
api.setStore({ flg2: { match: { source: 'a', flags: 'I' }, containers: '.x', titles: [], snippets: [], links: 'a[href]' } });
const P2u = api.serializeSelectors();
check('选择器-038: 大写flags序列化归一为小写', P2u.includes('match: /a/i'));
check('选择器-039: 大写flags编译保留i', api.getSelectors().flg2.match.flags === 'i');
const R9u = api.parseSelectorText('z3: { match: /abc/I, containers: ".x" }');
check('选择器-040: 解析时大写flags归一为小写且校验通过', !R9u.errors.length && R9u.config.z3.match.flags === 'i' && api.validateUserSelectors(R9u.config).length === 0);

// ---- 修复S-1: 连字符引擎ID序列化为带引号键(导出文件为合法JS字面量) ----
api.setStore({ 'my-engine': { match: { source: 'a', flags: '' }, containers: '.r', titles: [], snippets: [], links: 'a[href]' } });
const P4 = api.serializeSelectors();
check('修复S-1: 连字符引擎ID输出带引号键', P4.includes("'my-engine': {"));
check('修复S-2: 含连字符键的序列化结果为合法JS对象字面量', (() => { try { const o = new Function('const SELECTORS = {' + P4 + '}; return SELECTORS;')(); return !!(o && o['my-engine'] && o.bing); } catch (e) { return false; } })());
const R15 = api.parseSelectorText(P4);
check('修复S-3: 带引号连字符键往返一致且过校验', !R15.errors.length && !!R15.config && !!R15.config['my-engine'] && R15.config['my-engine'].containers === '.r' && api.validateUserSelectors(R15.config).length === 0);
check('修复S-4(对照): 普通键仍不加引号', P4.includes('bing: {') && P4.includes('google_scholar: {'));

// ---- 同引擎用户优先(同ID覆盖与新增重叠键均用用户选择器) ----
api.setHost('www.bing.com');
api.setStore({ bing: { match: '(?:^|\\.)bing\\.', containers: 'div.my-bing', titles: ['h2'], snippets: ['.s'], links: 'a[href]' } });
check('选择器-041: 同ID覆盖:容器使用用户选择器', api.getContainerSelector('bing') === 'div.my-bing');
check('选择器-043: 同ID覆盖:用户键合并后排在内置之前', Object.keys(api.getSelectors())[0] === 'bing');
api.setStore({
  bing: { match: '(?:^|\\.)bing\\.', containers: 'div.my-bing', titles: ['h2'], snippets: ['.s'], links: 'a[href]' },
  mybrave: { match: '^search\\.brave\\.com$', containers: '.r' }
});
api.setHost('search.brave.com');
check('选择器-044: 新增键与内置主机重叠时用户优先', api.getSearchEngine() === 'mybrave');
api.setStore({
  google: { match: '(?:^|\\.)google\\.', containers: 'div.g' },
  google_scholar: { match: '(?:^|\\.)scholar\\.google\\.', containers: 'div.gs_r' }
});
api.setHost('scholar.google.com');
check('选择器-047: 用户同时配置google和google_scholar时学者优先', api.getSearchEngine() === 'google_scholar');

// ---- href 回退: 内置与自定义hostname模式不参与, 仅自定义路径/URL模式回退 ----
api.setStore({});
api.setHost('www.google.com');
api.setHref('https://www.google.com/search?q=x.bing.com');
check('选择器-048: 内置引擎不因URL尾部误判(google查询含.bing.com)', api.getSearchEngine() === 'google');
api.setHost('example.com');
api.setHref('https://example.com/?ref=x.bing.com');
check('选择器-049: 普通站URL尾部含引擎域不误判', api.getSearchEngine() === 'other');
api.setHost('');
api.setHref('');
check('选择器-050: 空href/hostname不误判为引擎站', api.getSearchEngine() === 'other' && api.isEngineSite() === false);
api.setStore(CUSTOM);
api.setHost('other.com');
api.setHref('https://other.com/?u=x.searx.example.com');
check('选择器-051: 自定义hostname正则不因URL尾部误判', api.getSearchEngine() === 'other');
api.setStore({ urlengine: { match: '^https://search\\.example\\.com/web', containers: '.r' } });
api.setHost('search.example.com');
api.setHref('https://search.example.com/web?q=1');
check('选择器-052: 自定义URL模式仍回退匹配href', api.getSearchEngine() === 'urlengine');
api.setHref('https://search.example.com/images?q=1');
check('选择器-053: 自定义URL模式未命中href则回退other', api.getSearchEngine() === 'other');

// ---- diffUserSelectors 保存diff(不固化未改动的内置) ----
api.setStore({});
const allBuiltins = {};
for (const k of ['bing', 'google', 'duckduckgo', 'yandex', 'brave', 'yahoo']) {
  const m = api.getSelectors()[k];
  allBuiltins[k] = { match: m.match.source, containers: m.containers, titles: m.titles.slice(), snippets: m.snippets.slice(), links: m.links };
}
const bingCopy = allBuiltins.bing;
check('选择器-054: 与内置完全相同的键被丢弃', !('bing' in api.diffUserSelectors(allBuiltins)));
check('选择器-055: 改动过的键保留', 'bing' in api.diffUserSelectors(Object.assign({}, allBuiltins, { bing: Object.assign({}, bingCopy, { containers: '.x' }) })));
check('选择器-056: 新增自定义键保留', 'myx' in api.diffUserSelectors(Object.assign({}, allBuiltins, { myx: { match: 'a', containers: '.x' } })));
check('选择器-057: other始终丢弃', !('other' in api.diffUserSelectors(Object.assign({}, allBuiltins, { other: { match: 'a', containers: '.x' } }))));
check('选择器-058: 缺失内置键视为未改动(删除=恢复跟随内置)', !('yahoo' in api.diffUserSelectors({ bing: bingCopy })));
const w4b2 = api.diffUserSelectors(Object.assign({}, allBuiltins, { yahoo: Object.assign({}, allBuiltins.yahoo, { disabled: true }) }));
check('选择器-059: 显式 disabled 标记被保留', w4b2.yahoo && w4b2.yahoo.disabled === true);
check('选择器-060: 空配置(重置)不产生任何disabled', Object.keys(api.diffUserSelectors({})).length === 0);
api.setStore({ yahoo: { disabled: true } });
check('选择器-062: disabled 的内置引擎不被加载', api.getSelectors().yahoo && api.getSelectors().yahoo.disabled === true);
api.setHost('search.yahoo.com');
check('选择器-063: disabled 的内置引擎不匹配站点', api.getSearchEngine() === 'other');

// ---- disabled 引擎编辑器往返 ----
const P3 = api.serializeSelectors();
check('选择器-064: disabled 引擎序列化保留内置定义与标记', /yahoo:\s*\{/.test(P3) && P3.includes('disabled: true') && P3.includes("'.sw-Card.Algo, li.b_algo, div.b_algo, #web .algo, .algo-sr, .richAlgo'"));
const R10 = api.parseSelectorText(P3);
check('选择器-065: disabled 往返解析无误且校验通过', !R10.errors.length && !!R10.config && R10.config.yahoo.disabled === true && api.validateUserSelectors(R10.config).length === 0);
const R11 = api.parseSelectorText('z1: { disabled: true }');
check('选择器-067: 自定义禁用块解析且校验通过', !R11.errors.length && !!R11.config && R11.config.z1.disabled === true && api.validateUserSelectors(R11.config).length === 0);
check('选择器-068: disabled:false 单独为显式恢复不报错, 完整定义仍按普通校验', api.validateUserSelectors({ z2: { disabled: false } }).length === 0 && api.validateUserSelectors({ z6: { disabled: false, containers: '.x' } }).some(m => m.includes('match')));
api.setStore({});
check('选择器-069: sameSelectorDef 兼容字符串/RegExp/对象形态且flags参与比较',
  api.sameSelectorDef({ match: 'a.b', containers: '.x', titles: [], snippets: [], links: 'a[href]' }, { match: /a.b/, containers: '.x', titles: [], snippets: [], links: 'a[href]' }) &&
  api.sameSelectorDef({ match: { source: 'a.b', flags: '' }, containers: '.x', titles: [], snippets: [], links: 'a[href]' }, { match: /a.b/, containers: '.x', titles: [], snippets: [], links: 'a[href]' }) &&
  !api.sameSelectorDef({ match: { source: 'a.b', flags: 'i' }, containers: '.x', titles: [], snippets: [], links: 'a[href]' }, { match: /a.b/, containers: '.x', titles: [], snippets: [], links: 'a[href]' }));

// ---- disable 别名字段 ----
check('选择器-070: disable:true 别名校验通过', api.validateUserSelectors({ z4: { disable: true } }).length === 0);
check('选择器-071: disable:false 单独视为显式恢复', api.validateUserSelectors({ z5: { disable: false } }).length === 0);
{
  const out = api.diffUserSelectors({ bing: { disable: true } });
  check('选择器-072: diff disable:true 归一为 disabled:true', out.bing && out.bing.disabled === true && out.bing.disable === undefined);
}
check('选择器-073: diff disable:false 单独被丢弃', Object.keys(api.diffUserSelectors({ bing: { disable: false } })).length === 0);
check('选择器-074: diff disabled:false 单独被丢弃(恢复内置)', Object.keys(api.diffUserSelectors({ bing: { disabled: false } })).length === 0);
check('选择器-075: diff 完整定义+disable:false 与内置相同被丢弃', !('bing' in api.diffUserSelectors({ bing: Object.assign({ disable: false }, bingCopy) })));
{
  const out = api.diffUserSelectors({ bing: Object.assign({ disable: false }, bingCopy, { containers: '.x' }) });
  check('选择器-076: diff 完整定义+disable:false 改动被保留且别名剥离', out.bing && out.bing.containers === '.x' && out.bing.disable === undefined);
}
api.setStore({ bing: { disable: true } });
api.setHost('www.bing.com');
check('选择器-077: disable:true 引擎被停用', api.getSearchEngine() === 'other');
api.setStore({ bing: { disable: false } });
api.setHost('www.bing.com');
check('选择器-078: disable:false 空覆盖不破坏内置引擎', api.getSearchEngine() === 'bing' && api.getContainerSelector('bing') === 'li.b_algo, div.b_algo');
api.setStore({});
api.setHost('www.bing.com');
check('选择器-079: 清空后恢复', api.getSearchEngine() === 'bing');
{
  const R12 = api.parseSelectorText('z7: { disable: true }');
  check('选择器-080: 解析器接受 disable 别名', !R12.errors.length && !!R12.config && R12.config.z7.disable === true && api.validateUserSelectors(R12.config).length === 0);
}

// ---- pruneUserSelectors 清理旧版固化的内置副本 ----
storeRef.current = { bing: JSON.parse(JSON.stringify(bingCopy)), myse: { match: 'a', containers: '.x' } };
api.resetSelectorCache();
api.pruneUserSelectors();
check('选择器-081: 旧版固化的内置副本被清理', storeRef.current && !('bing' in storeRef.current) && !!storeRef.current.myse);
// extraElements participates in validation, merge, editor round trips and diff.
const extraDef = { ...CUSTOM.mysearx, extraElements: ['+ .summary', '~ .metadata'] };
api.setStore({ customExtra: extraDef });
check('选择器-082: 普通分支保留关联选择器', JSON.stringify(api.getSelectors().customExtra.extraElements) === JSON.stringify(extraDef.extraElements));
check('选择器-083: 相对CSS配置校验通过', api.validateUserSelectors({ customExtra: extraDef }).length === 0);
const extraRoundTrip = api.parseSelectorText(api.serializeSelectors());
check('选择器-084: 序列化解析保留关联配置', !extraRoundTrip.errors.length && api.sameSelectorDef(extraRoundTrip.config.customExtra, extraDef));
// 同构组精简: 保留首(裸相对)/最特殊(混入绝对选择器)/末(伪元素); 删除 null/[1]/[''] 变形(同一 extraElements 校验分支)
for (const [num, value] of [[1, '+ tr'], [5, ['+ tr, body']], [6, ['+ tr::after']]]) {
  check(`选择器-085-${num}: 非法关联配置被拒 ${JSON.stringify(value)}`, api.validateUserSelectors({ customExtra: { ...extraDef, extraElements: value } }).some(e => e.includes('extraElements')));
}
check('选择器-086: disabled配置仍校验关联CSS', api.validateUserSelectors({ customExtra: { disabled: true, extraElements: ['+ tr, body'] } }).length === 1);
api.setStore({ customExtra: { ...extraDef, disabled: true } });
check('选择器-087: 禁用分支保留关联配置', JSON.stringify(api.getSelectors().customExtra.extraElements) === JSON.stringify(extraDef.extraElements));
const disabledExtra = api.parseSelectorText(api.serializeSelectors());
check('选择器-088: 禁用配置往返保留关联配置', disabledExtra.config.customExtra.disabled && api.sameSelectorDef(disabledExtra.config.customExtra, { ...extraDef, disabled: true }));
api.setStore({ duckduckgo_lite: { disabled: true } });
const disabledLite = api.parseSelectorText(api.serializeSelectors());
check('选择器-089: 禁用内置Lite往返保留关联配置', disabledLite.config.duckduckgo_lite.extraElements.length === 3);
api.setHost('lite.duckduckgo.com');
check('选择器-090: 禁用Lite不回退普通DDG', api.getSearchEngine() === 'other');
api.setStore({});
const liteDef = api.getSelectors().duckduckgo_lite;
check('选择器-092: 清空关联配置属于有效修改', !!api.diffUserSelectors({ duckduckgo_lite: { ...liteDef, extraElements: [] } }).duckduckgo_lite);
check('选择器-093: 缺省与空关联相等', api.sameSelectorDef(CUSTOM.mysearx, { ...CUSTOM.mysearx, extraElements: [] }));
api.setStore({ duckduckgo_lite: { ...liteDef, match: liteDef.match.source, extraElements: [] } });
check('选择器-094: 覆盖可清空内置关联', api.getSelectors().duckduckgo_lite.extraElements.length === 0);
const parseCondition = new Function(extractFn(src, 'hostLabelToASCII') + extractFn(src, 'toASCIIHostname') + extractFn(src, 'parseConditionPart') + '; return parseConditionPart;')();
for (const [i, id] of ['duckduckgo', 'ddg'].entries()) {
  check(`选择器-095-${i + 1}: 主站条件不匹配Lite ${id}`, parseCondition('$site=' + id, 'duckduckgo_lite', 'lite.duckduckgo.com').static === false);
}
check('选择器-095-3: Lite条件匹配专有ID', parseCondition('$site=duckduckgo_lite', 'duckduckgo_lite', 'lite.duckduckgo.com').static === true);
check('选择器-096: 专有ID不匹配普通DDG', parseCondition('$site=duckduckgo_lite', 'duckduckgo', 'duckduckgo.com').static === false);
})();

// ---- 选择器-097~114: 选择器导入 ----
await (async () => {
const importSelectorsFromFileFn = extractFn(src, 'importSelectorsFromFile');
const pickTextFileFn = extractFn(src, 'pickTextFile');


function createEnv() {
  const env = {
    bodyChildren: [],
    events: [],
    input: null,
  };

  const fakeInput = {
    type: '',
    accept: '',
    style: {},
    files: [],
    parentElement: null,
    onchange: null,
    listeners: {},
    addEventListener(type, fn) {
      (this.listeners[type] = this.listeners[type] || []).push(fn);
    },
    remove() {
      const idx = env.bodyChildren.indexOf(this);
      if (idx !== -1) env.bodyChildren.splice(idx, 1);
      this.parentElement = null;
    },
    click() {},
  };
  env.input = fakeInput;

  const documentStub = {
    body: {
      appendChild(el) {
        el.parentElement = documentStub.body;
        env.bodyChildren.push(el);
        return el;
      },
    },
    createElement(tag) { return tag === 'input' ? fakeInput : {}; },
  };

  class FakeFileReader {
    readAsText(fileToRead) {
      if (fileToRead._error) {
        if (this.onerror) this.onerror(new Error('read fail'));
        return;
      }
      this.result = fileToRead._content;
      if (this.onload) this.onload({ target: this });
    }
  }

  const textarea = {
    _value: '',
    get value() { return this._value; },
    set value(v) {
      this._value = v;
      env.events.push('value');
    },
  };

  const windowStub = {
    listeners: {},
    addEventListener(type, fn) {
      (this.listeners[type] = this.listeners[type] || []).push(fn);
    },
    removeEventListener(type, fn) {
      const arr = this.listeners[type];
      if (!arr) return;
      const idx = arr.indexOf(fn);
      if (idx !== -1) arr.splice(idx, 1);
    },
  };

  const factory = new Function('document', 'FileReader', 'textarea', 'window', `
    let preventPanelClose = false;
    const t = (key) => key;
    const toasts = [];
    function showToast(msg, type) { toasts.push([msg, type]); }
    ${pickTextFileFn}
    ${importSelectorsFromFileFn}
    return {
      importSelectorsFromFile,
      isPreventPanelClose: () => preventPanelClose,
      toasts,
    };
  `);
  const api = factory(documentStub, FakeFileReader, textarea, windowStub);
  return { env, api, fakeInput, textarea, window: windowStub };
}

// 1. 正常导入并刷新
{
  const { env, api, fakeInput, textarea } = createEnv();
  api.importSelectorsFromFile(textarea, () => env.events.push('loaded:' + textarea.value));
  assert('选择器-097: 打开文件选择后锁定面板关闭', api.isPreventPanelClose() === true);
  fakeInput.files = [{ _content: 'myx: {}' }];
  fakeInput.onchange({ target: fakeInput });
  assert('选择器-099: 文件内容写入编辑区', textarea.value === 'myx: {}');
  assert('选择器-100: 导入回调在写入后触发', env.events.join('|') === 'value|loaded:myx: {}');
}

// 2. 取消选择
{
  const { env, api, fakeInput, textarea } = createEnv();
  api.importSelectorsFromFile(textarea, () => env.events.push('loaded'));
  fakeInput.listeners.cancel[0]();
  assert('选择器-103: cancel 后解锁并移除 input', api.isPreventPanelClose() === false && !env.bodyChildren.includes(fakeInput));
}

// 3. onchange 但未选中文件
{
  const { env, api, fakeInput, textarea } = createEnv();
  api.importSelectorsFromFile(textarea, () => env.events.push('loaded'));
  fakeInput.onchange({ target: { files: [] } });
  assert('选择器-105: 未选择文件时解锁并移除 input', api.isPreventPanelClose() === false && !env.bodyChildren.includes(fakeInput));
}

// 4. 读取失败
{
  const { env, api, fakeInput, textarea } = createEnv();
  api.importSelectorsFromFile(textarea, () => env.events.push('loaded'));
  fakeInput.files = [{ _error: true }];
  fakeInput.onchange({ target: fakeInput });
  assert('选择器-107: 读取失败时解锁并移除 input', api.isPreventPanelClose() === false && !env.bodyChildren.includes(fakeInput));
  assert('选择器-108: 读取失败不触发导入回调', env.events.length === 0);
  assert('选择器-109: 读取失败弹出导入失败通知', api.toasts.length === 1 && api.toasts[0][0] === 'subImportFailed' && api.toasts[0][1] === 'error');
}

// 5. 未传回调
{
  const { env, api, fakeInput, textarea } = createEnv();
  api.importSelectorsFromFile(textarea);
  fakeInput.files = [{ _content: 'x: {}' }];
  fakeInput.onchange({ target: fakeInput });
  assert('选择器-110: 未传回调时仍写入并解锁', textarea.value === 'x: {}' && api.isPreventPanelClose() === false);
}

// 6. 不支持 cancel 事件的浏览器: 焦点回落且未选择文件时兜底解锁
{
  const { env, api, fakeInput, textarea, window } = createEnv();
  api.importSelectorsFromFile(textarea, () => env.events.push('loaded'));
  window.listeners.focus.forEach((fn) => fn());
  await new Promise((r) => setTimeout(r, 350));
  assert('选择器-112: 焦点回落无文件时解锁并移除 input', api.isPreventPanelClose() === false && !env.bodyChildren.includes(fakeInput));
  assert('选择器-113: 焦点兜底触发后解绑', window.listeners.focus.length === 0);
}

// 7. 面板接线: 导入后刷新行号
assert('选择器-114: 面板导入回调刷新行号', /importSelectorsFromFile\(textarea, \(\) => \{\s*showError\(\[\]\);\s*updateLineNumbers\('selectors'\);/.test(src));
})();

// ---- 选择器-115~133: DOM增量扫描 ----
await (async () => {
function createEnv() {
  const elements = [];
  const queries = [];

  function makeEl(tag, cls, observed) {
    const el = {
      tag,
      cls,
      observed: !!observed,
      observeCount: 0,
      unobserveCount: 0,
      resetCount: 0,
      quickBtn: null,
      attrs: {},
      matches(sel) {
        return String(sel).split(',').map((s) => s.trim()).filter(Boolean).some((part) => {
          const m = part.match(/^([a-zA-Z]+)?(?:\.([\w-]+))?$/);
          if (!m) return false;
          if (m[1] && this.tag !== m[1]) return false;
          if (m[2] && this.cls !== m[2]) return false;
          return true;
        });
      },
      setAttribute(k) {
        this.attrs[k] = true;
        if (k === 'data-observed') this.observed = true;
      },
      removeAttribute(k) {
        delete this.attrs[k];
        if (k === 'data-observed') this.observed = false;
      },
      contains(other) {
        return false;
      },
      querySelector(sel) {
        return sel === '.serh-quick-block' ? this.quickBtn : null;
      },
    };
    elements.push(el);
    return el;
  }

  const documentStub = {
    querySelectorAll(sel) {
      queries.push(sel);
      if (sel === '[data-observed]') return elements.filter((e) => e.observed);
      if (sel === '[data-blocker-processed], [data-observed]') {
        return elements.filter((e) => e.observed || e.attrs['data-blocker-processed']);
      }
      const m = sel.match(/^:is\(([\s\S]+)\):not\(\[data-observed\]\)$/);
      if (m) {
        const groups = m[1].split(',').map((s) => s.trim());
        return elements.filter((e) => !e.observed && groups.some((g) => e.matches(g)));
      }
      return [];
    },
  };

  const resultObserver = {
    observe(el) { el.observeCount++; },
    unobserve(el) { el.unobserveCount++; },
  };

  const factory = new Function('document', 'resultObserver', `
    let currentConfig = { enabled: true, debug: false };
    let showHiddenResults = false;
    let _observedSelector = '';
    let currentSelector = '.a, .b';
    let activeSelectors = null;
    let _engineCacheHost = '';
    function getSearchEngine() { return 'test'; }
    function getContainerSelector() { return currentSelector; }
    function resetResultStyles(el) { el.resetCount++; }
    ${extractFn(src, 'resetSelectorCache')}
    ${extractFn(src, 'filterNestedContainers')}
    ${extractFn(src, 'clearStaleObserved')}
    ${extractFn(src, 'syncObservedSelector')}
    ${extractFn(src, 'queryUnobserved')}
    ${extractFn(src, 'scanNewResults')}
    return {
      scanNewResults,
      queryUnobserved,
      clearStaleObserved,
      syncObservedSelector,
      resetSelectorCache,
      setSelector: (s) => { currentSelector = s; },
      setEnabled: (v) => { currentConfig.enabled = v; },
      getObservedSelector: () => _observedSelector,
      getShowHidden: () => showHiddenResults,
    };
  `);
  const api = factory(documentStub, resultObserver);
  return { env: { elements, queries }, api, makeEl };
}

// ---- :is 包裹整组选择器 (逗号列表修复) ----
{
  const { env, api, makeEl } = createEnv();
  const a1 = makeEl('li', 'a', true);
  const b1 = makeEl('div', 'b', true);
  const a2 = makeEl('li', 'a', false);
  const b2 = makeEl('div', 'b', false);

  api.queryUnobserved('.a, .b');
  check('选择器-115: :is 包裹整组选择器', env.queries.includes(':is(.a, .b):not([data-observed])'), env.queries);
  check('选择器-116: 已观察元素不会重复命中查询', !a1.observeCount && !b1.observeCount);

  // ---- 初始扫描: 已观察集合按当前选择器保留 ----
  api.scanNewResults();
  check('选择器-117: 初始扫描保留匹配的已观察元素', a1.unobserveCount === 0 && b1.unobserveCount === 0);
  check('选择器-118: 初始扫描观察新元素', a2.observed && b2.observed && a2.observeCount === 1 && b2.observeCount === 1);

  // ---- 选择器收窄: 清理陈旧元素 ----
  api.resetSelectorCache();
  api.setSelector('.a');
  api.scanNewResults();
  check('选择器-119: 收窄选择器清理不再匹配元素', b1.observed === false && b1.unobserveCount === 1 && b1.resetCount === 1);
  check('选择器-120: 收窄选择器保留仍匹配元素', a1.observed === true && a1.unobserveCount === 0);

  const before = { a1: a1.unobserveCount, b1: b1.unobserveCount, b2: b2.unobserveCount };
  api.scanNewResults();
  check('选择器-122: 选择器未变化不重复清理', a1.unobserveCount === before.a1 && b1.unobserveCount === before.b1 && b2.unobserveCount === before.b2);

  // ---- 禁用时清空观察集合 ----
  api.setEnabled(false);
  api.scanNewResults();
  check('选择器-123: 禁用时清空观察集合并重置记录', env.elements.every((e) => !e.observed) && api.getObservedSelector() === '');
}

// ---- clearStaleObserved 细节 ----
{
  const { api, makeEl } = createEnv();
  const stale = makeEl('div', 'x', true);
  const btn = { removed: 0, remove() { this.removed++; } };
  stale.quickBtn = btn;
  api.clearStaleObserved('.a');
  check('选择器-125: 清理陈旧元素移除快捷屏蔽按钮', btn.removed === 1 && stale.observed === false && stale.resetCount === 1);

  const bad = makeEl('div', 'y', true);
  bad.matches = () => { throw new Error('bad selector'); };
  api.clearStaleObserved('.a');
  check('选择器-126: matches 异常按陈旧处理且不崩溃', bad.observed === false && bad.unobserveCount === 1);
}

// ---- filterNestedContainers: 嵌套容器外层自带链接时保留评估 ----
{
  const filterFn = new Function(`${extractFn(src, 'filterNestedContainers')}\nreturn filterNestedContainers;`)();
  function makeNode(children, links) {
    const node = { children: children || [], links: links || [] };
    node.querySelectorAll = (sel) => (sel === 'a[href]' ? node.links : []);
    node.querySelector = () => null;
    node.contains = (other) => other !== node && (node.links.includes(other) || node.children.some((c) => c === other || c.contains(other)));
    return node;
  }
  const innerLink = { id: 'inner-link' };
  const ownLink = { id: 'own-link' };
  const sub1 = makeNode([], [innerLink]);
  const sub2 = makeNode([], []);
  const outer = makeNode([sub1, sub2], [ownLink]);
  const plain = makeNode([], []);
  const kept = filterFn([outer, sub1, sub2, plain], 'div.g, div.MjjYud');
  check('选择器-127: 聚合块外层自带独立链接时保留评估', kept.includes(outer) && kept.includes(sub1) && kept.includes(sub2) && kept.includes(plain));

  const wrapLink = { id: 'wrap-link' };
  const wsub = makeNode([], [wrapLink]);
  const wrapper = makeNode([wsub], [wrapLink]);
  const kept2 = filterFn([wrapper, wsub], 'div.g');
  check('选择器-128: 纯包装外层(链接全属内层)仍被丢弃', !kept2.includes(wrapper) && kept2.includes(wsub));

  const weird = { querySelector() { throw new Error('bad'); }, querySelectorAll() { throw new Error('bad'); }, contains() { return false; } };
  check('选择器-129: 选择器异常时不崩溃', filterFn([weird], 'div.g').length === 1);

  const obsLink = { id: 'obs-link' };
  const obsInner = makeNode([], [obsLink]);
  const outerOnly = makeNode([obsInner], [makeNode([], []), { id: 'o2' }]);
  const kept3 = filterFn([outerOnly], 'div.g');
  check('选择器-130: 内层不在批次时外层按自身链接判断', kept3.includes(outerOnly));

  // 已观察内层不在增量候选中，但仍属于外层的后代结果。
  wrapper.querySelectorAll = sel => sel === 'a[href]' ? [wrapLink] : [wsub];
  wrapper.querySelector = () => wsub;
  check('选择器-131: 仅剩外层候选时仍排除纯包装', filterFn([wrapper], 'div.g').length === 0);
  wrapper.querySelectorAll = sel => sel === 'a[href]' ? [wrapLink, ownLink] : [wsub];
  check('选择器-133: 增量扫描保留真正独立链接', filterFn([wrapper], 'div.g').includes(wrapper));
}
})();

// ---- 选择器-134~183: 引擎站装配拆卸与跨页同步 ----
await (async () => {
const injectGlobalStylesFn = extractFn(src, 'injectGlobalStyles');
const removeGlobalStylesFn = extractFn(src, 'removeGlobalStyles');
const teardownEngineSiteFn = extractFn(src, 'teardownEngineSite');
const refreshEngineSiteFn = extractFn(src, 'refreshEngineSite');
const getSelectorStoreSignatureFn = extractFn(src, 'getSelectorStoreSignature');
const checkExternalSelectorChangeFn = extractFn(src, 'checkExternalSelectorChange');


// ---- 全局样式句柄: 注入一次, teardown 可移除; 布局样式仅内置引擎 ----
function createStyleEnv(returnValue) {
  const styleEl = { removeCalls: 0, remove() { this.removeCalls++; } };
  const stats = { addStyleCalls: 0, widgetCalls: 0 };
  const state = { engine: 'google' };
  function GM_addStyle() { stats.addStyleCalls++; return returnValue; }
  function injectWidgetStyles() { stats.widgetCalls++; }
  const api = new Function('GM_addStyle', 'injectWidgetStyles', 'state', `
    const LAYOUT_CSS = 'body{}';
    const SELECTORS = { google: {}, bing: {} };
    let _globalStyleEl = null;
    function getSearchEngine() { return state.engine; }
    ${injectGlobalStylesFn}
    ${removeGlobalStylesFn}
    return { injectGlobalStyles, removeGlobalStyles, getStyleEl: () => _globalStyleEl, setEngine: (e) => { state.engine = e; } };
  `)(GM_addStyle, injectWidgetStyles, state);
  return { api, stats, styleEl };
}

{
  const styleEl = { removeCalls: 0, remove() { this.removeCalls++; } };
  const env = createStyleEnv(styleEl);
  env.api.injectGlobalStyles();
  check('选择器-134: 首次注入记录样式句柄', env.stats.addStyleCalls === 1 && env.stats.widgetCalls === 1 && env.api.getStyleEl() === styleEl);
  env.api.injectGlobalStyles();
  check('选择器-135: 重复注入不重复添加全局样式', env.stats.addStyleCalls === 1 && env.stats.widgetCalls === 2);
  env.api.removeGlobalStyles();
  check('选择器-136: 移除后释放句柄并调用 remove', styleEl.removeCalls === 1 && env.api.getStyleEl() === null);
}

{
  const { api, stats } = createStyleEnv(undefined);
  let threw = false;
  try {
    api.injectGlobalStyles();
    api.removeGlobalStyles();
    api.injectGlobalStyles();
  } catch (e) { threw = true; }
  check('选择器-138: GM_addStyle 无返回值时不崩溃', !threw && stats.addStyleCalls === 2 && api.getStyleEl() === null);
}

{
  const styleEl = { removeCalls: 0, remove() { this.removeCalls++; } };
  const env = createStyleEnv(styleEl);
  env.api.setEngine('mysearx');
  env.api.injectGlobalStyles();
  check('选择器-139: 自定义引擎不注入布局样式但注入组件样式', env.stats.addStyleCalls === 0 && env.stats.widgetCalls === 1 && env.api.getStyleEl() === null);
}

{
  const styleEl = { removeCalls: 0, remove() { this.removeCalls++; } };
  const env = createStyleEnv(styleEl);
  env.api.injectGlobalStyles();
  env.api.setEngine('mysearx');
  env.api.injectGlobalStyles();
  check('选择器-140: 内置切自定义时移除布局样式', env.stats.addStyleCalls === 1 && styleEl.removeCalls === 1 && env.api.getStyleEl() === null);
}


// ---- teardownEngineSite: 移除全局样式并复位状态 ----
function createTeardownEnv() {
  const observed = [{ removeAttributeCalls: 0, unobserved: 0, reset: 0, removeAttribute() { this.removeAttributeCalls++; } }];
  const statusEl = { removed: 0, remove() { this.removed++; } };
  const observer = { disconnectCalls: 0, disconnect() { this.disconnectCalls++; } };
  const counters = { removeGlobalCalls: 0, stopSyncCalls: 0 };
  const documentStub = {
    querySelectorAll(sel) {
      if (sel === '[data-observed]') return observed;
      return [];
    },
    getElementById(id) { return id === 'serh-status' ? statusEl : null; },
  };
  const resultObserver = { unobserve(el) { el.unobserved++; } };
  const api = new Function('document', 'resultObserver', 'statusEl', 'observer', 'counters', `
    let _engineSiteSetup = true;
    let _domObserver = observer;
    let _hrefUrlCache = new WeakMap();
    const _hrefChangedContainers = new Set();
    const _contentChangedContainers = new Set();
    let _resultContentCache = new WeakMap();
    let _resultRetryCounts = new WeakMap();
    _contentChangedContainers.add({});
    _resultRetryCounts.set({}, 1);
    let showHiddenResults = true;
    let _observedSelector = '.a';
    let forceReprocessBatchId = 5;
    let _searchForm = null;
    let _searchFormHandler = null;
    let _blockConfirmOutsideHandler = null;
    function resetResultStyles(el) { el.reset++; }
    function clearTimeout() {}
    function removeGlobalStyles() { counters.removeGlobalCalls++; }
    function stopBackgroundSync() { counters.stopSyncCalls++; }
    ${teardownEngineSiteFn}
    return {
      teardownEngineSite,
      state: () => ({ setup: _engineSiteSetup, observer: _domObserver, showHidden: showHiddenResults, observedSelector: _observedSelector, batchId: forceReprocessBatchId, contentSetSize: _contentChangedContainers.size }),
    };
  `)(documentStub, resultObserver, statusEl, observer, counters);
  return { api, counters, statusEl, observer, observed };
}

{
  const { api, counters, statusEl, observer, observed } = createTeardownEnv();
  api.teardownEngineSite();
  const state = api.state();
  check('选择器-142: teardown 复位装配状态并终止残留批处理', state.setup === false && state.observer === null && observer.disconnectCalls === 1 && state.batchId === 6);
  check('选择器-143: teardown 清理已观察元素', observed[0].unobserved === 1 && observed[0].removeAttributeCalls === 1 && observed[0].reset === 1);
  check('选择器-144: teardown 复位显示与选择器记录', state.showHidden === false && state.observedSelector === '');
  check('选择器-145: teardown 移除悬浮球与全局样式', statusEl.removed === 1 && counters.removeGlobalCalls === 1);
  check('选择器-146: teardown 不停止全站后台同步', counters.stopSyncCalls === 0);
  api.teardownEngineSite();
  check('选择器-147: 重复 teardown 不重复执行', counters.removeGlobalCalls === 1 && statusEl.removed === 1 && counters.stopSyncCalls === 0);
}

// ---- 内容快照签名: buildContentSignature / getResultContentSignature ----
{
  const sigApi = new Function(`
    function getSearchEngine() { return 'test'; }
    function getResultLink(container) { return container.link; }
    function resolveUrlDomain(link) { return { url: link.href, domain: 'example.com' }; }
    function getResultTitle(container) { return container.title; }
    function getResultSnippet(container) { return container.snippet; }
    ${extractFn(src, 'buildContentSignature')}
    ${extractFn(src, 'getResultContentSignature')}
    return { buildContentSignature, getResultContentSignature };
  `)();

  check('选择器-148: 相同 url/title/snippet 生成相同签名', sigApi.buildContentSignature('https://a.com/', 't', 's') === sigApi.buildContentSignature('https://a.com/', 't', 's'));
  check('选择器-149: 标题变化导致签名变化', sigApi.buildContentSignature('https://a.com/', 't1', 's') !== sigApi.buildContentSignature('https://a.com/', 't2', 's'));
  check('选择器-150: URL变化导致签名变化', sigApi.buildContentSignature('https://a.com/1', 't', 's') !== sigApi.buildContentSignature('https://a.com/2', 't', 's'));
  check('选择器-151: 摘要变化导致签名变化', sigApi.buildContentSignature('u', 't', 's1') !== sigApi.buildContentSignature('u', 't', 's2'));
  check('选择器-152: 空值部分按空串处理', sigApi.buildContentSignature(null, undefined, '') === sigApi.buildContentSignature('', '', ''));

  const c = { link: { href: 'https://a.com/x' }, title: '标题', snippet: '摘要' };
  const before = sigApi.getResultContentSignature(c);
  check('选择器-153: 结果签名包含 url/title/snippet', before === sigApi.buildContentSignature('https://a.com/x', '标题', '摘要'));
  c.title = '广告新标题';
  check('选择器-154: 容器内容变化后签名不同', sigApi.getResultContentSignature(c) !== before);
  c.link = null;
  check('选择器-155: 链接缺失时签名的 url 段为空且可用', sigApi.getResultContentSignature(c) === sigApi.buildContentSignature('', '广告新标题', '摘要'));
  const bad = { link: { get href() { throw new Error('boom'); } }, title: 't', snippet: 's' };
  check('选择器-156: 提取异常返回 null 而不崩溃', sigApi.getResultContentSignature(bad) === null);
}

// ---- reprocessContainer: href/内容变化共用的重处理核心 ----
{
  const reprocessFn = extractFn(src, 'reprocessContainer');
  function makeFactory(processImpl) {
    const calls = { process: 0, reset: 0, reconcile: 0, observe: 0 };
    const api = new Function('calls', 'resultObserver', `
      const currentConfig = { debug: false };
      function resetResultStyles(el) { calls.reset++; }
      function processSingleResult(el) { calls.process++; ${processImpl} }
      function reconcileHiddenParents() { calls.reconcile++; }
      ${reprocessFn}
      return { reprocessContainer };
    `)(calls, { observe() { calls.observe++; } });
    return { calls, api };
  }
  function makeContainer(connected) {
    return {
      isConnected: connected !== false,
      attrs: {},
      staleBtn: null,
      setAttribute(n, v) { this.attrs[n] = String(v); },
      getAttribute(n) { return Object.prototype.hasOwnProperty.call(this.attrs, n) ? this.attrs[n] : null; },
      hasAttribute(n) { return Object.prototype.hasOwnProperty.call(this.attrs, n); },
      removeAttribute(n) { delete this.attrs[n]; },
      querySelector(sel) { return sel === '.serh-quick-block' ? this.staleBtn : null; },
    };
  }

  {
    const { calls, api } = makeFactory("el.setAttribute('data-blocker-processed', 'true'); return true;");
    const el = makeContainer();
    el.staleBtn = { removed: 0, remove() { this.removed++; } };
    api.reprocessContainer(el);
    check('选择器-157: 重处理清理旧按钮并复位后重新判定', el.staleBtn.removed === 1 && calls.reset === 1 && calls.process === 1 && calls.reconcile === 1);
    check('选择器-158: 重处理成功后不再重新观察', calls.observe === 0 && el.getAttribute('data-observed') === 'true');
  }
  {
    const { calls, api } = makeFactory('return false;');
    const el2 = makeContainer();
    api.reprocessContainer(el2);
    check('选择器-159: 未标记完成时重新观察结果', calls.observe === 1 && el2.hasAttribute('data-observed') === false);
  }
  {
    const { calls, api } = makeFactory("throw new Error('boom');");
    const el = makeContainer();
    api.reprocessContainer(el);
    check('选择器-160: 重处理异常不标记 data-blocker-processed 且转交观察器重试', el.hasAttribute('data-blocker-processed') === false && calls.observe === 1);
    const gone = makeContainer(false);
    api.reprocessContainer(gone);
    check('选择器-161: 已脱离文档的容器不触发重处理', calls.process === 1);
  }
}

// ---- KI: 修复验证 ----
check('选择器-162: map_resultExtraElements 为 WeakMap', /const map_resultExtraElements = new WeakMap\(\)/.test(src));

// ---- scheduleResultRetry: 处理异常后的有限次重试 ----
{
  const retryFn = extractFn(src, 'scheduleResultRetry');
  const limitMatch = src.match(/const RESULT_RETRY_LIMIT = (\d+)/);
  const delayMatch = src.match(/RESULT_RETRY_DELAY = (\d+)/);
  check('选择器-163: 重试常量存在', !!limitMatch && !!delayMatch);
  function makeRetryEnv() {
    const timers = [];
    const api = new Function('resultObserver', 'timers', `
      let _engineSiteSetup = true;
      let _resultRetryCounts = new WeakMap();
      const RESULT_RETRY_LIMIT = ${limitMatch ? limitMatch[1] : 3};
      const RESULT_RETRY_DELAY = ${delayMatch ? delayMatch[1] : 200};
      const setTimeout = (fn, ms) => { timers.push({ fn, ms }); return timers.length; };
      ${retryFn}
      return { scheduleResultRetry, hasCount: (el) => _resultRetryCounts.has(el) };
    `)({ observe(el) { el.observeCount = (el.observeCount || 0) + 1; }, unobserve(el) { el.unobserveCount = (el.unobserveCount || 0) + 1; } }, timers);
    return { api, timers };
  }
  function makeRetryEl() {
    return {
      isConnected: true,
      attrs: {},
      setAttribute(n, v) { this.attrs[n] = String(v); },
      hasAttribute(n) { return Object.prototype.hasOwnProperty.call(this.attrs, n); },
      removeAttribute(n) { delete this.attrs[n]; },
    };
  }

  {
    const { api, timers } = makeRetryEnv();
    const el = makeRetryEl();
    api.scheduleResultRetry(el);
    check('选择器-164: 首次异常安排一次延迟重试', timers.length === 1 && timers[0].ms === Number(delayMatch[1]));
    timers[0].fn();
    check('选择器-165(已修复): 重试触发后重新观察且保持 data-observed 不变量', el.observeCount === 1 && el.hasAttribute('data-observed') === true);
    check('选择器-166: 重试计数保留用于升级', api.hasCount(el));
  }
  {
    const { api, timers } = makeRetryEnv();
    const el = makeRetryEl();
    api.scheduleResultRetry(el);
    el.setAttribute('data-blocker-processed', 'true');
    timers[0].fn();
    check('选择器-167: 重试前已成功处理则不再重试', el.observeCount === undefined && !api.hasCount(el));
  }
  {
    const { api, timers } = makeRetryEnv();
    const el = makeRetryEl();
    el.isConnected = false;
    api.scheduleResultRetry(el);
    timers[0].fn();
    check('选择器-168: 结果脱离文档后放弃重试', !api.hasCount(el));
  }
  {
    const { api, timers } = makeRetryEnv();
    const el = makeRetryEl();
    api.scheduleResultRetry(el);
    api.scheduleResultRetry(el);
    api.scheduleResultRetry(el);
    check('选择器-169: 连续异常达到上限前不标记完成', timers.length === 3 && el.hasAttribute('data-blocker-processed') === false);
    api.scheduleResultRetry(el);
    check('选择器-170(已修复): 超过上限停止重试并彻底放手(不再伪装成功, 交回扫描重试)', timers.length === 3 && el.hasAttribute('data-blocker-processed') === false && el.hasAttribute('data-observed') === false && el.unobserveCount === 1 && !api.hasCount(el));
  }
}

// ---- ensureEngineSiteSetup: 装配时启动后台同步 ----
function createEnsureEnv(engine) {
  const calls = { start: 0, inject: 0, build: 0, status: 0, scan: 0 };
  const api = new Function('calls', 'engine', `
    let _engineSiteSetup = false;
    let _domObserver = null;
    let _observedSelector = '';
    let _searchForm = null;
    let _searchFormHandler = null;
    let _urlChangeHandler = null;
    function isEngineSite() { return engine; }
    function injectGlobalStyles() { calls.inject++; }
    function buildRuleIndex() { calls.build++; }
    function updateStatus() { calls.status++; }
    function scanNewResults() { calls.scan++; }
    function startBackgroundSync() { calls.start++; }
    function exposeDebugApi() {}
    function forceReprocessAll() {}
    function getSearchCategory() { return 'web'; }
    function resetSelectorCache() {}
    function refreshEngineSite() {}
    const location = { href: 'https://www.google.com' };
    const history = { pushState() {}, replaceState() {} };
    const window = { addEventListener() {}, dispatchEvent() {} };
    const document = { body: {}, querySelector() { return null; } };
    class MutationObserver { observe() {} disconnect() {} }
    ${extractFn(src, 'ensureEngineSiteSetup')}
    return { ensureEngineSiteSetup, state: () => ({ setup: _engineSiteSetup, observer: _domObserver }) };
  `)(calls, engine);
  return { api, calls };
}

{
  const { api, calls } = createEnsureEnv(true);
  api.ensureEngineSiteSetup();
  check('选择器-171: 引擎站装配不再启动全站后台同步', calls.start === 0 && calls.inject === 1 && calls.scan === 1 && api.state().setup === true);
  api.ensureEngineSiteSetup();
  check('选择器-172: 重复装配不重复启动同步', calls.start === 0);
}
{
  const { api, calls } = createEnsureEnv(false);
  api.ensureEngineSiteSetup();
  check('选择器-173: 非引擎站不装配也不启动同步', calls.start === 0 && calls.inject === 0 && api.state().setup === false);
}

// ---- refreshEngineSite: 按站点身份装配/拆卸 ----
function createRefreshEnv(engine, setup) {
  const calls = { ensure: 0, force: 0, teardown: 0, layout: 0 };
  const api = new Function('calls', 'engine', 'setup', `
    let _engineSiteSetup = setup;
    function isEngineSite() { return engine; }
    function ensureEngineSiteSetup() { if (_engineSiteSetup) return; _engineSiteSetup = true; calls.ensure++; }
    function forceReprocessAll() { calls.force++; }
    function teardownEngineSite() { if (!_engineSiteSetup) return; _engineSiteSetup = false; calls.teardown++; }
    function injectGlobalStyles() { calls.layout++; }
    ${refreshEngineSiteFn}
    return { refreshEngineSite, getSetup: () => _engineSiteSetup };
  `)(calls, engine, setup);
  return { api, calls };
}

{
  const { api, calls } = createRefreshEnv(true, false);
  api.refreshEngineSite();
  check('选择器-174: 普通站变引擎站时装配并重扫', calls.ensure === 1 && calls.force === 1 && calls.teardown === 0 && api.getSetup() === true);
}
{
  const { api, calls } = createRefreshEnv(true, true);
  api.refreshEngineSite();
  check('选择器-175: 已是引擎站时重扫并重算布局样式', calls.ensure === 0 && calls.force === 1 && calls.teardown === 0 && calls.layout === 1);
}
{
  const { api, calls } = createRefreshEnv(false, true);
  api.refreshEngineSite();
  check('选择器-176: 引擎站变普通站时拆卸', calls.ensure === 0 && calls.force === 0 && calls.teardown === 1 && api.getSetup() === false);
}
{
  const { api, calls } = createRefreshEnv(false, false);
  api.refreshEngineSite();
  check('选择器-177: 普通站保持普通站时无操作', calls.ensure === 0 && calls.force === 0 && calls.teardown === 0);
}

// ---- 跨标签页选择器变更检测 ----
function createExternalEnv() {
  const state = { store: { a: 1 }, throwMode: false };
  const counters = { reset: 0, refresh: 0 };
  function GM_getValue() {
    if (state.throwMode) throw new Error('read fail');
    return state.store;
  }
  const api = new Function('GM_getValue', 'counters', `
    const SELECTORS_KEY = 'searchfilter_selectors';
    let _selectorStoreSignature = null;
    function resetSelectorCache() { counters.reset++; }
    function refreshEngineSite() { counters.refresh++; }
    ${getSelectorStoreSignatureFn}
    ${checkExternalSelectorChangeFn}
    return { checkExternalSelectorChange, signature: () => _selectorStoreSignature };
  `)(GM_getValue, counters);
  return { api, state, counters };
}

{
  const { api, state, counters } = createExternalEnv();
  check('选择器-178: 首次调用仅建立基线', api.checkExternalSelectorChange() === false && counters.reset === 0 && counters.refresh === 0);
  check('选择器-179: 存储未变化不重装配', api.checkExternalSelectorChange() === false && counters.reset === 0 && counters.refresh === 0);
  state.store = { a: 2 };
  check('选择器-180: 其它标签页修改后重装配', api.checkExternalSelectorChange() === true && counters.reset === 1 && counters.refresh === 1);
  check('选择器-181: 重装配后再次调用不重复', api.checkExternalSelectorChange() === false && counters.reset === 1 && counters.refresh === 1);
  state.throwMode = true;
  check('选择器-182: 读取失败不误判为变更', api.checkExternalSelectorChange() === false && counters.reset === 1 && counters.refresh === 1);
  state.throwMode = false;
  state.store = { a: 3 };
  check('选择器-183: 读取恢复后继续检测变更', api.checkExternalSelectorChange() === true && counters.reset === 2 && counters.refresh === 2);
}
})();

// ---- 选择器-184~193: 引擎检测与全站门控 ----
await (async () => {
// 头部 @match(8.0.0 起全站注入)
const header = src.slice(0, src.indexOf('==/UserScript=='));
const matchLines = [...header.matchAll(/^\/\/\s*@match\s+(\S+)/gm)].map((m) => m[1]);

// SELECTORS + getSearchEngine/getSearchCategory (括号配对提取，不依赖注释)
const selectorsStart = src.indexOf('const SELECTORS = {');
if (selectorsStart === -1) throw new Error('SELECTORS block not found');
const selectorsOpen = src.indexOf('{', selectorsStart);
const selectorsClose = extractObjectLiteral(src, selectorsOpen);
const selectorsObjectText = src.slice(selectorsOpen, selectorsClose + 1);

const fnBody = extractFn(src, 'getSearchEngine');
const catBody = extractFn(src, 'getSearchCategory');
const gateBody = extractFn(src, 'isEngineSite');
const factory = new Function(
  'window',
  'SELECTORS',
  `let _engineCacheHost = null;
let _engineCacheResult = 'other';
function getSelectors() { return SELECTORS; }
${fnBody}
${catBody}
return { getSearchEngine, getSearchCategory };`,
);
const gateFactory = new Function(
  'window',
  'SELECTORS',
  `let _engineCacheHost = null;
let _engineCacheResult = 'other';
function getSelectors() { return SELECTORS; }
${fnBody}
${gateBody}
return isEngineSite;`,
);
const selectors = eval(`(${selectorsObjectText})`);

function detectEngine(host) {
  for (const name of Object.keys(selectors)) {
    const def = selectors[name];
    if (def && def.match && def.match.test(host)) return name;
  }
  return 'other';
}


// ---- 引擎检测 ----
// 每引擎保留代表与别名/特殊TLD形态, 边界保留 wwwN上限/别名不命中/前缀不命中/后缀攻击/子域服务排除
const cases = [
  ['www.bing.com', 'bing'],
  ['www5.bing.com', 'other'],
  ['duckduckgo.com', 'duckduckgo'],
  ['ddg.gg', 'duckduckgo'],
  ['lite.duckduckgo.com', 'duckduckgo_lite'],
  ['lite.ddg.gg', 'other'],
  ['google.com', 'google'],
  ['www.google.co.jp', 'google'],
  ['google.events', 'google'],
  ['scholar.google.com', 'google_scholar'],
  ['yandex.ru', 'yandex'],
  ['search.brave.com', 'brave'],
  ['search.yahoo.com', 'yahoo'],
  ['example.com', 'other'],
  ['bing.com.evil.com', 'other'],
  ['notgoogle.com', 'other'],
  ['mail.google.com', 'other'],
];

for (const [i, [host, expected]] of cases.entries()) {
  const w = { location: { hostname: host } };
  const got = factory(w, selectors).getSearchEngine();
  assert(`选择器-184-${i + 1}: ${host} -> ${expected}`, got === expected);
}

{
  const cacheWin = { location: { hostname: 'www.google.com', href: 'https://www.google.com/' } };
  const cacheEnv = factory(cacheWin, selectors);
  const first = cacheEnv.getSearchEngine();
  assert('选择器-186: 缓存:同location二次调用命中缓存且结果一致', first === 'google' && cacheEnv.getSearchEngine() === first);
  cacheWin.location.hostname = 'www.bing.com';
  cacheWin.location.href = 'https://www.bing.com/';
  assert('选择器-186b: 缓存:cacheKey变化后重新计算', cacheEnv.getSearchEngine() === 'bing');
}

// ---- 搜索分类检测 ----
// 保留 web基准/google udm参数/bing路径/ddg纯参数/yahoo路径 各一
const catCases = [
  [{ hostname: 'www.google.com', pathname: '/search', search: '?q=x' }, 'web'],
  [{ hostname: 'www.google.com', pathname: '/search', search: '?udm=7' }, 'videos'],
  [{ hostname: 'www.bing.com', pathname: '/images/search', search: '?q=x' }, 'images'],
  [{ hostname: 'duckduckgo.com', pathname: '/', search: '?iax=images' }, 'images'],
  [{ hostname: 'images.search.yahoo.com', pathname: '/search/images', search: '?p=x' }, 'images'],
];
for (const [i, [loc, expected]] of catCases.entries()) {
  const got = factory({ location: loc }, selectors).getSearchCategory(loc);
  assert(`选择器-191-${i + 1}: category ${loc.hostname}${loc.pathname}${loc.search} -> ${expected}`, got === expected);
}

// 审查11-S1(Yahoo Japan /image 单数路径)本项留档已清理, 待后续修复后补回归

// ---- 全站注入与引擎站门控一致性 ----
// 引擎站/别名站命中与普通站/攻击域不命中 各留代表
const hosts = [
  'www.bing.com', 'ddg.gg', 'bing.com.evil.com', 'brave.com',
];

assert('选择器-192: 头部包含 @match *://*/* (全站注入)', matchLines.includes('*://*/*'));

for (const [i, host] of hosts.entries()) {
  const eng = detectEngine(host);
  const gated = gateFactory({ location: { hostname: host } }, selectors)();
  assert(`选择器-193-${i + 1}: ${host}: 引擎判定(${eng})与门控(${gated})一致`, gated === (eng !== 'other'));
}
})();

// ---- 选择器-194~220: 跨标签页同步锁 / 菜单注册 / 结果摘要后备提取 / 214~220修复回归 ----
await (async () => {
const lockFnNames = ['delay', 'readSyncLock', 'writeSyncLock', 'tryAcquireSyncLock', 'acquireSyncLock', 'renewSyncLock', 'releaseSyncLock', 'runWithSyncLock'];
const lockFns = lockFnNames.map((n) => {
  const body = extractFn(src, n);
  const idx = src.indexOf(`function ${n}(`);
  return src.slice(idx - 6, idx) === 'async ' ? `async ${body}` : body;
});
const lockStore = new Map();
function createLockEnv(tabId, ttl = 2000) {
  return new Function('GM_getValue', 'GM_setValue', 'SYNC_LOCK_KEY_PREFIX', 'SYNC_LOCK_TTL', 'SYNC_TAB_ID', `
    ${lockFns.join('\n')}
    return { readSyncLock, tryAcquireSyncLock, acquireSyncLock, renewSyncLock, releaseSyncLock, runWithSyncLock };
  `)(
    (key, defaultValue) => (lockStore.has(key) ? lockStore.get(key) : defaultValue),
    (key, value) => lockStore.set(key, value),
    'test_lock_',
    ttl,
    tabId,
  );
}

{
  const tab1 = createLockEnv('tab-1');
  const tab2 = createLockEnv('tab-2');
  check('选择器-194: 首次抢占成功', tab1.tryAcquireSyncLock('t') === true && tab1.readSyncLock('t').owner === 'tab-1');
  check('选择器-195: 他页持锁时抢占失败', tab2.tryAcquireSyncLock('t') === false);
  check('选择器-196: 过期锁可被抢占', (() => {
    lockStore.set('test_lock_t', { owner: 'tab-dead', expires: Date.now() - 1 });
    return tab2.tryAcquireSyncLock('t') === true && tab2.readSyncLock('t').owner === 'tab-2';
  })());
  check('选择器-197: 非持锁页续租失败', tab1.renewSyncLock('t') === false);
  check('选择器-198: 持锁页续租成功', tab2.renewSyncLock('t') === true);
  tab1.releaseSyncLock('t');
  check('选择器-199: 非持锁页释放无效', tab2.readSyncLock('t').owner === 'tab-2');
  tab2.releaseSyncLock('t');
  check('选择器-200: 持锁页释放清空', tab2.readSyncLock('t') === null);
}

// 并发抢占: 后写入者回读校验通过, 先写入者回读失败退出
{
  const tab1 = createLockEnv('tab-a');
  const tab2 = createLockEnv('tab-b');
  let ran1 = 0, ran2 = 0;
  const p1 = tab1.runWithSyncLock('race', async () => { ran1++; await new Promise((r) => setTimeout(r, 30)); });
  const p2 = tab2.runWithSyncLock('race', async () => { ran2++; await new Promise((r) => setTimeout(r, 30)); });
  await Promise.all([p1, p2]);
  check('选择器-201: 并发抢占仅一个执行者', ran1 + ran2 === 1, { ran1, ran2 });
  check('选择器-202: 执行完成后锁释放', tab1.readSyncLock('race') === null && tab2.readSyncLock('race') === null);
  let ran3 = 0;
  await tab1.runWithSyncLock('race', async () => { ran3++; });
  check('选择器-203: 释放后他页可再次执行', ran3 === 1);
}

// 任务失败也必须释放锁
{
  const tab = createLockEnv('tab-c');
  let threw = false;
  try {
    await tab.runWithSyncLock('fail', async () => { throw new Error('boom'); });
  } catch (e) { threw = true; }
  check('选择器-204: 任务异常仍释放锁', threw === true && tab.readSyncLock('fail') === null);
}

// ---- 菜单注册测试 (注册3项) ----
{
  const regMenuFn = extractFn(src, 'registerMenu');
  function runMenuTest() {
    const registered = [];
    const GM_registerMenuCommand = (label, cb) => { registered.push(label); };
    const t = (k) => k;
    const menuEnv = new Function(
      'registered', 'GM_registerMenuCommand', 't', 'showConfigPanel', 'showSelectorPanel', 'showHighlightColorPanel',
      `let _menuCommandIds = [];
       ${regMenuFn}
       registerMenu();
       return registered;`
    );
    return menuEnv(registered, GM_registerMenuCommand, t, () => {}, () => {}, () => {});
  }

  const menus = runMenuTest();
  check('选择器-205: 注册3个菜单项', menus.length === 3);
  check('选择器-206: 包含打开面板', menus[0] === 'menuOpenPanel');
}

// ---- 结果摘要后备提取: 相对选择器(extraElements)不得抛异常中断结果处理 ----
await (async () => {
  const selectorsDecl = src.match(/const SELECTORS = \{[\s\S]*?\n  \};/)[0];
  const getResultSnippet = new Function('GM_getValue',
    'let activeSelectors = null;\nconst SELECTORS_KEY = \'searchfilter_selectors\';\n' +
    selectorsDecl + '\n' +
    ['normalizeSelectorList', 'getUserSelectors', 'getSelectors', 'getResultText', 'getResultExtraElements', 'getResultSnippet'].map(n => extractFn(src, n)).join('\n') +
    '\nreturn getResultSnippet;'
  )(() => undefined);

  const throwIfRel = (fn) => (sel) => {
    if (sel.startsWith('+')) { const e = new Error(sel + ' is not a valid selector'); e.name = 'SyntaxError'; throw e; }
    return fn(sel);
  };

  let threw = false, out = '';

  const extraRow = {
    textContent: '  extra text  ',
    matches: throwIfRel(() => false),
    querySelector: throwIfRel(() => null),
    contains: () => false,
  };
  const resultEl = {
    textContent: '',
    querySelector: throwIfRel(() => null),
    parentElement: null,
  };
  resultEl.parentElement = {
    children: [resultEl, extraRow],
    querySelectorAll: (sel) => (String(sel).includes(':nth-child(1)') ? [extraRow] : []),
  };
  try { out = getResultSnippet(resultEl, 'duckduckgo_lite'); } catch (e) { threw = true; }
  check('选择器-211: 相对选择器后备提取不抛异常(旧代码SyntaxError致整结果漏处理)', threw === false && out === '');

  const selfSnippet = {
    textContent: ' self text ',
    matches: throwIfRel((sel) => sel === '.result-snippet'),
    querySelector: throwIfRel(() => null),
    contains: () => false,
  };
  resultEl.parentElement = {
    children: [resultEl, selfSnippet],
    querySelectorAll: (sel) => (String(sel).includes(':nth-child(1)') ? [selfSnippet] : []),
  };
  out = ''; threw = false;
  try { out = getResultSnippet(resultEl, 'duckduckgo_lite'); } catch (e) { threw = true; }
  check('选择器-212: 后备元素自我命中有效选择器仍返回文本', threw === false && out === 'self text');

  const primaryEl = { textContent: ' primary ' };
  const resultWithPrimary = {
    textContent: '',
    querySelector: (sel) => (sel === '.result-snippet' ? primaryEl : null),
    parentElement: null,
  };
  resultWithPrimary.parentElement = { children: [resultWithPrimary], querySelectorAll: () => [] };
  out = ''; threw = false;
  try { out = getResultSnippet(resultWithPrimary, 'duckduckgo_lite'); } catch (e) { threw = true; }
  check('选择器-213: 主摘要选择器路径不受影响', threw === false && out === 'primary');
})();

// ==== [选择器-214~215] 修复回归: JSON 自动检测与 \uXXXX 转义解码 / __proto__ 键处理 ====
await (async () => {
  const parseSelectorText = new Function(
    "const SUPPORTED_REGEX_FLAGS = 'imsu';\n" +
    "function t(key, params = {}) { return key; }\n" +
    extractFn(src, 'getInvalidRegexFlags') + '\n' + extractFn(src, 'normalizeMatchLiteral') + '\n' + extractFn(src, 'parseSelectorText') +
    '\nreturn parseSelectorText;'
  )();
  // JSON 风格 \uXXXX 转义正常解码
  const R13 = parseSelectorText('{"e13":{"match":"a","containers":"div\\u002Eresult"}}');
  check('选择器-214: JSON \\uXXXX 转义正常解码为字面字符', !!R13.config && R13.config.e13.containers === 'div.result');
  // __proto__ 键安全跳过不污染原型
  const R14 = parseSelectorText('__proto__: { match: "a", containers: ".x" }');
  check('选择器-215(修复5后行为): __proto__ 键单独输入解析失败且不污染对象(拒绝保存, 原型零污染)', R14.config === null && R14.errors.length > 0 && !Object.hasOwn(R14.config || {}, '__proto__'));
})();

// ==== [选择器-216~220] 修复回归: 悬浮球拖拽 touchcancel / 文件读取失败通知 / bubble-number 前缀隔离 ====
(() => {
  const bindIdx = src.indexOf("document.addEventListener('touchmove', onDrag");
  const unbindIdx = src.indexOf("document.removeEventListener('touchmove', onDrag)");
  check('选择器-216: 拖拽绑定 touchcancel(触摸取消后监听不残留)', bindIdx > -1 && src.slice(bindIdx, bindIdx + 400).includes("document.addEventListener('touchcancel', endDrag)"));
  check('选择器-217: 拖拽解绑 touchcancel(与绑定对称)', unbindIdx > -1 && src.slice(unbindIdx, unbindIdx + 300).includes("document.removeEventListener('touchcancel', endDrag)"));
  const pick = extractFn(src, 'pickTextFile');
  check('选择器-218: 文件读取失败弹出导入失败通知', pick.includes("showToast(t('subImportFailed')") && !/reader\.onerror\s*=\s*cleanup\s*;/.test(pick));
  check('选择器-219: 悬浮球数字类名已加 serh- 前缀', src.includes('.serh-bubble-number') && src.includes('class="serh-bubble-number"') && !src.includes('class="bubble-number"') && !/(^|[^\w-])\.bubble-number\s*\{/.test(src));
  const selectorsStart = src.indexOf('const SELECTORS = {');
  const selectorsOpen = src.indexOf('{', selectorsStart);
  const selectorsClose = extractObjectLiteral(src, selectorsOpen);
  const selectorsObj = eval(`(${src.slice(selectorsOpen, selectorsClose + 1)})`);
  check('选择器-220: Bing links 首选主标题 a[href]', Array.isArray(selectorsObj.bing.links) && selectorsObj.bing.links[0] === 'h2 a[href]');
})();
})();

// ==== 二、修复回归 ====

// ---- 选择器-221: 祖先容器不认领后代自有链接(嵌套结果漏处理修复回归) ----
{
  const filterFn = new Function(`${extractFn(src, 'filterNestedContainers')}\nreturn filterNestedContainers;`)();
  function makeNodeX(children, links) {
    const node = { children: children || [], links: links || [] };
    node.querySelectorAll = (sel) => (sel === 'a[href]' ? node.links : node.children);
    node.querySelector = () => null;
    node.contains = (other) => other !== node && (node.links.includes(other) || node.children.some((c) => c === other || c.contains(other)));
    return node;
  }
  const gInnerLink = { id: 'g2-link' };
  const gInner = makeNodeX([], [gInnerLink]);
  const gOwnLink = { id: 'g-own-link' };
  const gOuter = makeNodeX([gInner], [gOwnLink]);
  const mjj = makeNodeX([gOuter], []);
  const keptX = filterFn([mjj, gOuter, gInner], 'div.g, div.MjjYud');
  check('选择器-221: 祖先容器不认领后代自有链接(嵌套对保留)', keptX.includes(gOuter) && keptX.includes(gInner) && !keptX.includes(mjj), keptX.length);

  const wSubLink = { id: 'w-sub-link' };
  const wSub = makeNodeX([], [wSubLink]);
  const wOwn = makeNodeX([wSub], [wSubLink]);
  const keptY = filterFn([wOwn, wSub], 'div.g');
  check('选择器-222: 纯包装外层链接仍被内层认领而丢弃', !keptY.includes(wOwn) && keptY.includes(wSub), keptY.length);
}

// ---- 审查B: 父容器隐藏/恢复状态机 + bing cite回退(回归) ----
{
  function matchesSel(el, sel) {
    return String(sel).split(',').some((s) => {
      s = s.trim(); let m;
      if ((m = s.match(/^([a-zA-Z][\w-]*)\.([\w-]+)$/))) return el.tag === m[1] && el.cls === m[2];
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
      for (const k of Object.keys(this.attrs)) {
        const m = k.match(/^data-([a-z-]+)$/);
        if (m) ds[m[1].replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = this.attrs[k];
      }
      return ds;
    } });
    if (parent) parent.children.push(el);
    return el;
  }
  function makeParentEnv(showHidden) {
    const root = makeTreeEl('body', '');
    const fns = new Function('doc', `
      let showHiddenResults = ${!!showHidden};
      function blockedShown() { return showHiddenResults; }
      const _hrefUrlCache = new WeakMap(), _resultContentCache = new WeakMap(), _resultRetryCounts = new WeakMap();
      const map_resultExtraElements = new WeakMap();
      function getResultExtraElements() { return []; }
      ${extractFn(src, 'saveOriginalDisplay')}
      ${extractFn(src, 'googleResultBlocks')}
      ${extractFn(src, 'visibleUnblocked')}
      ${extractFn(src, 'hideParentIfNoVisibleSiblings')}
      ${extractFn(src, 'resetResultStyles')}
      ${extractFn(src, 'restoreParentDisplay')}
      ${extractFn(src, 'restoreAllHiddenParents')}
      ${extractFn(src, 'reconcileHiddenParents')}
      ${extractFn(src, 'clearMatchedData')}
      ${extractFn(src, 'removeMatchedRuleLabel')}
      ${extractFn(src, 'restoreResultExtraElements')}
      ${extractFn(src, 'restoreResultCollapse')}
      const document = { querySelectorAll: (s) => doc.querySelectorAll(s) };
      return { saveOriginalDisplay, googleResultBlocks, visibleUnblocked, hideParentIfNoVisibleSiblings, resetResultStyles, restoreParentDisplay, restoreAllHiddenParents, reconcileHiddenParents };
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
    check('审查B-1: 部分子项屏蔽时父容器不隐藏', P.style.display === '' && !P.hasAttribute('data-blocker-google-parent'));
    blockEl(fns, g2);
    fns.hideParentIfNoVisibleSiblings(P, P.querySelectorAll('div.g'), 'data-blocker-google-parent');
    check('审查B-2: 全部屏蔽后父隐藏且保存原display', P.style.display === 'none' && P.getAttribute('data-blocker-google-parent') === 'true' && P.getAttribute('data-serh-orig-display') === '');
    fns.resetResultStyles(g1);
    check('审查B-3: 解除其一后父保持隐藏(其余仍屏蔽)', P.style.display === 'none' && P.hasAttribute('data-blocker-google-parent') && g1.style.display === '' && g1.getAttribute('data-is-blocked') === null);
    fns.reconcileHiddenParents();
    check('审查B-4: reconcile恢复存在可见未屏蔽子项的父容器', P.style.display === '' && !P.hasAttribute('data-blocker-google-parent') && !P.hasAttribute('data-serh-orig-display'));
  }
  {
    const { root, fns } = makeParentEnv(false);
    const li = makeTreeEl('li', '', root);
    li.style.display = 'block';
    const o1 = makeTreeEl('div', 'Organic', li);
    const o2 = makeTreeEl('div', 'Organic', li);
    blockEl(fns, o1); blockEl(fns, o2);
    fns.hideParentIfNoVisibleSiblings(li, li.children, 'data-blocker-yandex-parent');
    check('审查B-5: yandex父隐藏并保存原display', li.style.display === 'none' && li.getAttribute('data-serh-orig-display') === 'block');
    fns.resetResultStyles(o1);
    fns.resetResultStyles(o2);
    check('审查B-7: 最后一个子项reset后父恢复原display', li.style.display === 'block' && !li.hasAttribute('data-blocker-yandex-parent') && !li.hasAttribute('data-serh-orig-display'));
  }
  {
    const { root, fns } = makeParentEnv(true);
    const P = makeTreeEl('div', 'MjjYud', root);
    const g1 = makeTreeEl('div', 'g', P);
    const g2 = makeTreeEl('div', 'g', P);
    fns.saveOriginalDisplay(g1); g1.setAttribute('data-is-blocked', 'true');
    fns.saveOriginalDisplay(g2); g2.setAttribute('data-is-blocked', 'true');
    fns.hideParentIfNoVisibleSiblings(P, P.querySelectorAll('div.g'), 'data-blocker-google-parent');
    check('审查B-8: 展开模式下父容器标记但display置空', P.style.display === '' && P.getAttribute('data-blocker-google-parent') === 'true');
    fns.resetResultStyles(g1);
    check('审查B-9: 展开模式解除任一子项父立即恢复', !P.hasAttribute('data-blocker-google-parent') && !P.hasAttribute('data-serh-orig-display'));
  }
  {
    const { root, fns } = makeParentEnv(false);
    const P = makeTreeEl('div', 'MjjYud', root);
    const g1 = makeTreeEl('div', 'g', P);
    const sibling = makeTreeEl('div', 'tF2Cxc', P);
    blockEl(fns, g1);
    fns.hideParentIfNoVisibleSiblings(P, fns.googleResultBlocks(P), 'data-blocker-google-parent');
    check('审查B-13: 仅一个div.g被屏蔽时，未命中的tF2Cxc不隐藏父容器', P.style.display === '' && !P.hasAttribute('data-blocker-google-parent') && sibling.getAttribute('data-is-blocked') !== 'true');
    blockEl(fns, sibling);
    fns.hideParentIfNoVisibleSiblings(P, fns.googleResultBlocks(P), 'data-blocker-google-parent');
    check('审查B-14: div.g与tF2Cxc都屏蔽后父容器隐藏', P.style.display === 'none' && P.hasAttribute('data-blocker-google-parent'));
    fns.resetResultStyles(sibling);
    fns.reconcileHiddenParents();
  }
  {
    const sStart = src.indexOf('const SELECTORS = {');
    const sOpen = src.indexOf('{', sStart);
    const sClose = extractObjectLiteral(src, sOpen);
    const selectorsObj = eval(`(${src.slice(sOpen, sClose + 1)})`);
    const linkApi = new Function('SELECTORS', `
      function toASCIIHostname(h) { return h; }
      function toASCIIUrl(u) { return u; }
      function getSelectors() { return SELECTORS; }
      ${extractFn(src, 'decodeRedirectTarget')}
      ${extractFn(src, 'decodeBingCkTarget')}
      ${extractFn(src, 'unwrapRedirectUrl')}
      ${extractFn(src, 'getResultLink')}
      return { getResultLink };
    `)(selectorsObj);
    function anchorEl(href) { return { href }; }
    function bingResult(href, citeText) {
      return {
        querySelector(sel) {
          if (sel === '.b_attribution, .b_algoheader cite, cite') return citeText ? { textContent: citeText } : null;
          return sel === 'h2 a[href]' ? anchorEl(href) : null;
        },
      };
    }
    const badCk = 'https://www.bing.com/ck/a?!&u=a1!!!!';
    const l1 = linkApi.getResultLink(bingResult(badCk, 'www.example.com'), 'bing');
    check('审查B-10: bing解码失败回退cite裸域', !!l1 && l1.href === 'https://www.example.com/', l1 && l1.href);
    const l2 = linkApi.getResultLink(bingResult(badCk, 'www.bing.com'), 'bing');
    check('审查B-11: cite为bing自身域名不回退', !!l2 && l2.href === badCk, l2 && l2.href);
    const goodCk = 'https://www.bing.com/ck/a?!&u=a1' + Buffer.from('https://example.org/page').toString('base64');
    const l3 = linkApi.getResultLink(bingResult(goodCk, 'https://nope.example'), 'bing');
    check('审查B-12: 解码成功的bing跳转链接不触发cite回退', !!l3 && l3.href === goodCk, l3 && l3.href);
  }
}

// ---- 选择器-223(已修复): sameSelectorDef比较disabled, prune不再误剔禁用配置 ----
{
  const sStartE = src.indexOf('const SELECTORS = {');
  const sOpenE = src.indexOf('{', sStartE);
  const sCloseE = extractObjectLiteral(src, sOpenE);
  const selectorsObjE = eval(`(${src.slice(sOpenE, sCloseE + 1)})`);
  const pruneProbe = new Function('SELECTORS', `
    ${extractFn(src, 'normalizeSelectorList')}
    ${extractFn(src, 'matchDefToParts')}
    ${extractFn(src, 'sameSelectorDef')}
    return { sameSelectorDef };
  `)(selectorsObjE);
  const builtinBing = selectorsObjE.bing;
  const fullDisabledBing = Object.assign({}, builtinBing, { disabled: true });
  check('选择器-223(已修复): 全量内置副本仅多disabled:true时判为不同(prune不再误删禁用配置)', pruneProbe.sameSelectorDef(fullDisabledBing, builtinBing) === false);
  check('选择器-223(对照): 无disabled的内置全量副本仍判为相同(prune照常清理)', pruneProbe.sameSelectorDef(Object.assign({}, builtinBing), builtinBing) === true);
  check('选择器-223(对照): 禁用态与内置disabled:false副本判为不同', pruneProbe.sameSelectorDef(fullDisabledBing, Object.assign({}, builtinBing, { disabled: false })) === false);
}

// ---- 选择器-224~226: JSON非对象def保留交校验层 / 字段级diff固化内置副本 ----
{
  const selStart = src.indexOf('const SELECTORS = {');
  const selOpen = src.indexOf('{', selStart);
  const selClose = extractObjectLiteral(src, selOpen);
  const selectorsText = src.slice(selOpen, selClose + 1);
  const builtinSelectorOfLine2 = src.match(/const builtinSelectorOf = .+?;/)[0];
  const selStore = { current: undefined };
  const gmGet = (key, defaultValue) => (key === 'searchfilter_selectors' ? (selStore.current === undefined ? defaultValue : selStore.current) : defaultValue);
  const selFns = ['normalizeSelectorList', 'mergeSelectorDef', 'getUserSelectors', 'getSelectors', 'resetSelectorCache', 'getInvalidRegexFlags', 'regexSourceToLiteralText', 'escapeJsString', 'matchDefToParts', 'serializeSelectors', 'normalizeMatchLiteral', 'parseSelectorText', 'sameSelectorDef', 'diffSelectorDefFields', 'diffUserSelectors'].map(n => extractFn(src, n));
  const selApi = new Function('GM_getValue', 'storeRef', `
const SELECTORS_KEY = 'searchfilter_selectors';
const SUPPORTED_REGEX_FLAGS = 'imsu';
const SELECTORS = ${selectorsText};
let activeSelectors = null;
let _engineCacheHost = null;
${builtinSelectorOfLine2}
let _engineCacheResult = 'other';
const window = { location: { hostname: 'www.google.com', href: 'https://www.google.com/' } };
function t(key) { return key; }
${selFns.join('\n')}
return { getSelectors, parseSelectorText, diffUserSelectors };
`)(gmGet, selStore);
  const jsRes = selApi.parseSelectorText('{"bing": true}');
  check('选择器-224(已修复): JSON路径非对象def不再静默丢弃({"bing": true} 保留原文交校验层)', !!jsRes.config && jsRes.config.bing === true);
  const mixedRes = selApi.parseSelectorText('{"bing": true, "example": {"match": "/x/", "containers": ".r"}}');
  check('选择器-224(已修复): 混合场景合法def照常解析、非法def保留报错', !!mixedRes.config && mixedRes.config.example && mixedRes.config.bing === true);
  const otherRes = selApi.parseSelectorText('other: {containers: ".x", match: /x/}');
  check('选择器-226(已修复): 保留键other单独输入不再产生合法空配置(JS路径解析失败, 保存层报错退出不清空存储)', otherRes.config === null && otherRes.errors.length > 0);
  const otherOnlyJson = selApi.parseSelectorText('{"other":{"containers":".x","match":"x"}}');
  check('修复5-01: JSON路径other单独输入同样解析失败(不落盘)', otherOnlyJson.config === null && otherOnlyJson.errors.length > 0);
  const protoOnly = selApi.parseSelectorText('{"__proto__":{"containers":".x","match":"x"}}');
  check('修复5-02: __proto__单独输入同样失败(安全保留)', protoOnly.config === null && protoOnly.errors.length > 0);
  const mixedOther = selApi.parseSelectorText('{"myse":{"match":"/x/","containers":".r"},"other":{"match":"y"}}');
  check('修复5-03: 混合输入中other被直接忽略且有效键照常保留', !!mixedOther.config && !!mixedOther.config.myse && !('other' in mixedOther.config) && !mixedOther.errors.length);
  const explicitEmpty = selApi.parseSelectorText('{}');
  check('修复5-04(对照): 显式{}仍为合法空配置(清空全部自定义语义不变)', !!explicitEmpty.config && Object.keys(explicitEmpty.config).length === 0 && !explicitEmpty.errors.length);
  // 面板文本=serializeSelectors全量序列化; 保存时diffUserSelectors按字段级提取差异 → 仅存改动字段, 其余跟随内置(文档2.9: 升级内置后未改动字段可跟随更新)
  const mergedAll = selApi.getSelectors();
  const editedBing = Object.assign({}, mergedAll.bing, { containers: 'div.custom' });
  const diff = selApi.diffUserSelectors(Object.assign({}, mergedAll, { bing: editedBing }));
  const pinningFields = ['match', 'titles', 'snippets', 'links'].filter(k => k in (diff.bing || {}));
  check('选择器-225: 仅改一个字段时diff只保留该字段(未改动内置不再固化, 升级内置可跟随)', 'bing' in diff && pinningFields.length === 0 && diff.bing.containers === 'div.custom' && diff.bing.match === undefined, pinningFields.join(','));
}

// ---- 审查3-S1(修复回归): JSON保存清空全部选择器 / prune误删禁用配置 ----
{
  const sStartF = src.indexOf('const SELECTORS = {');
  const sOpenF = src.indexOf('{', sStartF);
  const sCloseF = extractObjectLiteral(src, sOpenF);
  const fixApi = new Function(`
const SELECTORS_KEY = 'searchfilter_selectors';
const SELECTORS = ${src.slice(sOpenF, sCloseF + 1)};
let activeSelectors = null; let _engineCacheHost = null; let _engineCacheResult = 'other'; let _observedSelector = '';
let stored = undefined;
const GM_getValue = (key, def) => (key === SELECTORS_KEY && stored !== undefined ? stored : def);
const GM_setValue = (key, val) => { if (key === SELECTORS_KEY) stored = val; };
const t = (key) => key;
const isValidCssSelector = () => true;
const hasPseudoElement = (s) => /::/.test(String(s));
${extractFn(src, 'normalizeSelectorList')}
${extractFn(src, 'getInvalidRegexFlags')}
${extractFn(src, 'matchDefToParts')}
${extractFn(src, 'resetSelectorCache')}
${extractFn(src, 'getUserSelectors')}
${extractFn(src, 'parseSelectorText')}
${extractFn(src, 'validateUserSelectors')}
${extractFn(src, 'sameSelectorDef')}
${extractFn(src, 'pruneUserSelectors')}
return { parseSelectorText, validateUserSelectors, pruneUserSelectors, SELECTORS, getStored: () => stored, setStored: (v) => { stored = v; } };
  `)();
  const parsedTrue = fixApi.parseSelectorText('{"bing": true}');
  const saveErrors = fixApi.validateUserSelectors(parsedTrue.config);
  check('审查3-S1(修复224验证): {"bing": true} 端到端被校验拦截, 不再以空配置覆盖存储', 'bing' in parsedTrue.config && saveErrors.length > 0);
  const parsedMixed = fixApi.parseSelectorText('{"bing": true, "example": {"match": "/x/", "containers": ".r"}}');
  const mixedErrors = fixApi.validateUserSelectors(parsedMixed.config);
  check('审查3-S1(修复224对照): 混合场景整体报错, 合法def与非法def都不落盘(用户可改后重存)', mixedErrors.length > 0 && Object.keys(parsedMixed.config).length === 2);
  fixApi.parseSelectorText('{}');
  check('审查3-S1(对照): 空对象仍为合法配置(语义=清空全部自定义, 需显式输入)', fixApi.validateUserSelectors({}).length === 0);
  const bingDisabledCopy = Object.assign({}, fixApi.SELECTORS.bing, { disabled: true });
  fixApi.setStored({ bing: bingDisabledCopy, myse: { match: 'a', containers: '.x' } });
  fixApi.pruneUserSelectors();
  const afterPrune = fixApi.getStored();
  check('审查3-S1(修复223验证): prune保留「内置全量副本+disabled:true」(禁用状态不丢)', !!afterPrune.bing && afterPrune.bing.disabled === true && !!afterPrune.myse);
  fixApi.setStored({ bing: Object.assign({}, fixApi.SELECTORS.bing) });
  fixApi.pruneUserSelectors();
  check('审查3-S1(修复223对照): 无disabled的全量内置副本仍被prune照常清理', !!fixApi.getStored() && !('bing' in fixApi.getStored()));
}

// ---- 审查4-S2: 新增设置项"显示来源开关"(一键屏蔽分类, 默认开启) ----
{
  const cfgDefaultsLine = src.match(/const CFG_DEFAULTS = \{[^}]+\};/)[0];
  const hlLine = src.match(/const DEFAULT_HIGHLIGHT_COLORS = \{[^}]+\};/)[0];
  const defApi = new Function(`
${cfgDefaultsLine}
${hlLine}
${extractFn(src, 'getDefaultConfig')}
return { getDefaultConfig };
`)();
  check('审查4-S2-1: 默认配置含 showMatchedSource=true', defApi.getDefaultConfig().showMatchedSource === true);
  const normApi = new Function(`
${cfgDefaultsLine}
${hlLine}
${extractFn(src, 'normalizeConfig')}
return { normalizeConfig };
`)();
  check('审查4-S2-2: 旧配置缺键回填 true(默认开启)', normApi.normalizeConfig({ rules: [] }).showMatchedSource === true);
  check('审查4-S2-3: 显式 false 被保留(关闭态持久化)', normApi.normalizeConfig({ rules: [], showMatchedSource: false }).showMatchedSource === false);
  const panelSrc = extractFn(src, 'showSettingsPanel');
  const secBlock = panelSrc.indexOf('settingsSecBlock'); const swIdx = panelSrc.indexOf("serh-set-show-source"); const secUI = panelSrc.indexOf('settingsSecUI');
  check('审查4-S2-4: 开关位于一键屏蔽分类内(doubleConfirm 行, 界面分类之前)', secBlock !== -1 && secBlock < swIdx && swIdx < secUI && /serh-set-show-source', labelKey: 'showMatchedSource', checked: currentConfig\.showMatchedSource !== false/.test(panelSrc));
  check('审查4-S2-5: settingsDefs 绑定 showMatchedSource 且 apply 按显示态移除/回填标签', /id: 'serh-set-show-source', key: 'showMatchedSource'/.test(panelSrc) && /apply: \(\) => \{[^}]*removeMatchedRuleLabel\(el\); else if \(showHiddenResults\) addMatchedRuleLabel\(el\);/.test(panelSrc));
  let appended = null;
  const labelEl = { className: '', textContent: '' };
  const fakeResult = { dataset: { matchedRule: '*://*.example.com/*', matchedSource: 'local' }, querySelector: () => null, appendChild: (el) => { appended = el; } };
  const labelApi = new Function('document', `
let currentConfig = {};
const t = (k) => k;
function ensurePositioned() {}
${extractFn(src, 'removeMatchedRuleLabel')}
${extractFn(src, 'addMatchedRuleLabel')}
return { setConfig: (v) => { currentConfig = v; }, run: (r) => addMatchedRuleLabel(r) };
  `)({ createElement: () => labelEl });
  labelApi.setConfig({ showMatchedSource: true });
  labelApi.run(fakeResult);
  check('审查4-S2-6: 开关开启时注入命中规则标签(来源: 规则文本)', appended === labelEl && labelEl.className === 'serh-matched-rule' && labelEl.textContent === 'local: *://*.example.com/*');
  appended = null;
  labelApi.setConfig({ showMatchedSource: false });
  labelApi.run(fakeResult);
  check('审查4-S2-7: 开关关闭时不注入标签', appended === null);
}

// ---- 选择器-229~230: 屏蔽按钮改为按容器注入(不再依赖标题选择器) ----
(() => {
  const injFn = extractFn(src, 'injectBlockButton');
  check('选择器-229: 注入函数不再调用getResultTitle门控, 且标题提取仍保留用于规则匹配', !/getResultTitle/.test(injFn) && /function getResultTitle/.test(src));
  let appended = null;
  const fakeBtn = { className: '', innerHTML: '', style: {}, addEventListener() {}, onclick: null };
  const api = new Function('document', 'window', `
${extractFn(src, 'ensurePositioned')}
${injFn}
return { injectBlockButton };
`)(
    { createElement: () => fakeBtn },
    { getComputedStyle: () => ({ position: 'relative' }) }
  );
  const container = {
    classList: { contains: () => false },
    closest: () => null,
    querySelector: () => null,
    getAttribute: () => null,
    appendChild(el) { appended = el; }
  };
  api.injectBlockButton(container, 'other', 'example.com');
  check('选择器-230: 无标题元素容器仍注入屏蔽按钮且锚定容器', !!appended && appended.className === 'serh-quick-block');
})();

// ---- 复审S: 取色路径与颜色重置(已修复转契约) ----
{
  const upSrc = extractFn(src, 'updatePickedColor');
  check('复审S-1(已由修复1解决): 画布取色updatePickedColor仍只写展示元素(code-text/current-preview), 缺陷"取色结果无法进入配置"经修复1的预览色块点击填入路径解决', upSrc.includes('serh-hlcolor-code-text') && upSrc.includes('serh-hlcolor-current-preview') && !upSrc.includes('hlcolor-input'));
  const rIdx = src.indexOf("getElementById('serh-hlcolor-reset')");
  const resetSrc = rIdx >= 0 ? src.slice(rIdx, src.indexOf("getElementById('serh-hlcolor-cancel')")) : '';
  check('复审S-2(已修复): 颜色重置仅回填输入框/预览与画布, 不直接persistConfig/forceReprocessAll(保存才落盘, 取消可放弃)', resetSrc.includes('defaults[i]') && !resetSrc.includes('persistConfig') && !resetSrc.includes('forceReprocessAll') && !resetSrc.includes('highlightColors ='));
  check('复审S-3(已修复): 颜色/选择器两处重置仅回填面板态并提示保存后生效, 选择器重置不再直接applyUserSelectors落盘', (src.match(/showToast\(t\('resetPending'\)/g) || []).length === 2 && !/serh-selector-reset'\)\.onclick[\s\S]{0,120}applyUserSelectors/.test(src) && src.includes('serializeSelectors(SELECTORS)'));
}

// ---- 修复1: 取色后点击@1~5预览色块自动填入输入框并刷新预览 ----
{
  const seg = src.slice(src.indexOf('function updatePreview'), src.indexOf("document.getElementById('serh-hlcolor-save')"));
  const els = {};
  const mk = (id, v) => { els[id] = { value: v || '', textContent: '#aabbcc', style: {}, handlers: {}, addEventListener(ev, fn) { this.handlers[ev] = fn; } }; };
  for (let i = 1; i <= 5; i++) { mk(`serh-hlcolor-input-${i}`, i === 3 ? '#112233' : ''); mk(`serh-hlcolor-preview-${i}`); }
  mk('serh-hlcolor-code-text');
  new Function('document', seg)({ getElementById: (id) => els[id] || null });
  els['serh-hlcolor-preview-3'].handlers.click();
  check('修复1-1: 点击@3预览色块把取色器当前hex填入输入框并刷新该行预览', els['serh-hlcolor-input-3'].value === '#aabbcc' && els['serh-hlcolor-preview-3'].style.background === '#aabbcc');
  els['serh-hlcolor-code-text'].textContent = 'nope';
  els['serh-hlcolor-preview-4'].handlers.click();
  check('修复1-2(对照): 取色值非合法hex时不填入', els['serh-hlcolor-input-4'].value === '');
  check('修复1-3(对照): 未点击的行输入框不受影响', els['serh-hlcolor-input-1'].value === '' && els['serh-hlcolor-input-5'].value === '');
  check('修复1-4: 预览色块CSS含pointer光标提示可点击', /#serh-hlcolor-panel \.serh-hlcolor-row \.serh-hlcolor-preview \{[^}]*cursor: pointer/.test(src));
  const hintSeg = src.slice(src.indexOf("t('hlColorTitle')"), src.indexOf('serh-hlcolor-left'));
  check('修复1-5: 高亮颜色标题下方有"点击色块快速保存"小字, 字体11px/颜色#718096与引擎选择器selectorHint一致, 文案走t()双语', /hlColorHint/.test(hintSeg) && /font-size:11px;color:#718096/.test(hintSeg) && /hlColorHint: '点击色块快速保存'/.test(src) && /hlColorHint: 'Click a swatch to apply it quickly\.'/.test(src));
  const dotSeg = src.slice(src.indexOf('serh-hlcolor-picker-wrapper'), src.indexOf('function resizeCanvasToMatch'));
  const upSrc2 = extractFn(src, 'updateIndicators') + src.slice(src.indexOf('function onSVMove'), src.indexOf('const bindCanvasDrag'));
  check('修复1-6: 取色板含sv圆圈指示器+右侧色相条含hue滑块, wrapper相对定位, 拖动/初始resize/重置三路径均同步指示器位置', /id="serh-hlcolor-sv-dot"/.test(dotSeg) && /id="serh-hlcolor-hue-dot"/.test(dotSeg) && /position:relative/.test(dotSeg) && /#serh-hlcolor-sv-dot \{ width: 13px !important; height: 13px !important; border-radius: 50% !important; \}/.test(src) && /#serh-hlcolor-hue-dot \{ width: 30px !important; height: 6px !important; border-radius: 3px !important; \}/.test(src) && /pointer-events: none !important/.test(src) && (upSrc2.match(/updateIndicators\(\)/g) || []).length >= 4 && /drawHueCanvas\(\); updateIndicators\(\)/.test(src) && /updatePickedColor\(\); updateIndicators\(\); showToast/.test(src));
  check('修复1-7: 取色器初始与重置后均回到#66CCFF(不再跟随高亮色1), 画布取色点/当前预览/code-text一致', /const defaultHex = '#66CCFF';/.test(src) && !src.includes("hexToRgb('#CE2029')") && /hexToRgb\(defaultHex\)/.test(src));
}

// ---- 统计-001~005(修复7验证): 统计来源键语言无关 ----
{
  const mkFn = (lang) => new Function(`
    const t = (k) => ({ localRule: '${lang === 'en' ? 'Local Rule' : '本地规则'}', subscription: '${lang === 'en' ? 'Sub' : '订阅'}' }[k]);
    ${extractFn(src, 'statSourceKey')}
    return statSourceKey;
  `)();
  const keyEn = mkFn('en'), keyZh = mkFn('zh');
  check('统计-001(修复7): 当前语言为en时, zh时代写入的"本地规则/订阅2"仍归一为local/sub:2', keyEn('本地规则') === 'local' && keyEn('订阅2') === 'sub:2');
  check('统计-002(修复7): 当前语言为zh时, en时代写入的"Local Rule/Sub3"仍归一为local/sub:3', keyZh('Local Rule') === 'local' && keyZh('Sub3') === 'sub:3');
  check('统计-003: 未知来源归一为空串(保留跳过语义)', keyEn('whatever') === '' && keyEn('') === '' && keyEn('sub:') === '' && keyEn('local') === '');
  const mix = ['本地规则', 'Local Rule', '订阅1', 'Sub2', '本地规则'];
  const agg = new Map();
  mix.forEach((s) => { const k = keyEn(s); agg.set(k, (agg.get(k) || 0) + 1); });
  const sourceOrder = ['', ''].map((_, i) => `sub:${i + 1}`).concat('local');
  check('统计-004(修复7): 中英混排来源dataset聚合后全部落入sourceOrder键(修复前zh→en切换后3/4行消失)', sourceOrder.includes('sub:1') && sourceOrder.includes('sub:2') && agg.get('local') === 3 && agg.get('sub:1') === 1 && agg.get('sub:2') === 1);
  const usSrc = extractFn(src, 'updateStatsContent');
  check('统计-005(修复7): 聚合走statSourceKey归一, sourceOrder为[key,label]对且展示用sourceLabel', usSrc.includes('statSourceKey(matchedSource)') && usSrc.includes("['local', t('localRule')]") && usSrc.includes('${sourceLabel}'));
}

// ---- 选择器-233~234: 关闭回调恒假守卫死代码移除 / no-op调用清理 ----
  check('选择器-233(修复17验证): showConfigPanel关闭回调恒假守卫死代码已移除, fadeOutAndRemovePanel无回调直调', !src.includes('window._panelCloseHandler !== closeHandler') && src.includes('fadeOutAndRemovePanel(panel);'));
  check('选择器-234(死代码清理): restoreResultExtraElements三处无参no-op调用已移除(仅保留resetResultStyles内的带参调用)', !src.includes('restoreResultExtraElements()') && /restoreResultExtraElements\(result\)/.test(src));

// ---- 选择器-235(修复PK): 设置面板复选框映射补齐3键, 远程配置应用后开关同步刷新 ----
  check('选择器-235(修复PK): SETTINGS_PANEL_CHECKBOXES含show-source/show-sub-btn/show-sync-btn三键', /'serh-set-show-source':\s*'showMatchedSource'/.test(src) && /'serh-set-show-sub-btn':\s*'showSubBtn'/.test(src) && /'serh-set-show-sync-btn':\s*'showSyncBtn'/.test(src));
  check('选择器-236(修复PK): applyConfigToMainPanel末尾调用applySubSyncBtnVisibility使按钮可见性同步', /applyDarkModeClass\(\);(?: applyCollapseMode\(\);)? applySubSyncBtnVisibility\(\);/.test(src));

// ---- 选择器-237~242: 折叠模式只保留标题路径(新版Bing布局下来源链接块/描述/深层链接全部隐藏) ----
{
  function matchSimple(el, s) { return s === el.tag || (s.startsWith('.') && (el.cls === s.slice(1) || el._classes.has(s.slice(1)))) || (el.cls && s === el.tag + '.' + el.cls); }
  function mkCollapseEl(tag, cls, parent, text) {
    const el = {
      tag, cls: cls || '', children: [], parentElement: parent || null, _classes: new Set(),
      textContent: text || '',
      contains(other) { if (other === this) return true; return this.children.some((c) => c.contains(other)); },
      walk() { const out = []; const rec = (n) => n.children.forEach((c) => { out.push(c); rec(c); }); rec(this); return out; },
      querySelector(sel) { return this.querySelectorAll(sel)[0] || null; },
      querySelectorAll(sel) {
        const parts = String(sel).trim().split(/\s+/);
        return this.walk().filter((e) => {
          let node = e;
          for (let i = parts.length - 1; i >= 0; i--) {
            if (!node || !matchSimple(node, parts[i])) return false;
            node = node.parentElement;
          }
          return true;
        });
      }
    };
    el.classList = { add: (c) => el._classes.add(c), remove: (c) => el._classes.delete(c), contains: (c) => el._classes.has(c) };
    if (parent) parent.children.push(el);
    return el;
  }
  const collapseEnv = new Function(`
    const SELECTORS = { other: { titles: [] } };
    function getSelectors() {
      return { bing: { titles: ['h2 a', 'a h2', '.b_title'], snippets: ['.b_caption p'] }, lite: { titles: ['.result-link'] }, other: SELECTORS.other };
    }
    ${extractFn(src, 'getResultTitleElement')}
    ${extractFn(src, 'applyResultCollapse')}
    ${extractFn(src, 'restoreResultCollapse')}
    return { getResultTitleElement, applyResultCollapse, restoreResultCollapse };
  `)();

  // 新版Bing布局: li.b_algo > div.b_tpcn(来源链接块) + h2 > a > strong(标题) + div.b_caption > p(描述)
  const li = mkCollapseEl('li', 'b_algo');
  const tpcn = mkCollapseEl('div', 'b_tpcn', li, 'Githubhttps://github.com');
  const h2 = mkCollapseEl('h2', '', li);
  const a = mkCollapseEl('a', '', h2, 'GitHub keeps you ahead');
  mkCollapseEl('strong', '', a, 'GitHub');
  const cap = mkCollapseEl('div', 'b_caption', li);
  mkCollapseEl('p', 'b_lineclamp2', cap, '2026年8月24日 · Whether you are scaling');

  check('选择器-237: getResultTitleElement按titles顺序返回首个非空标题元素(h2 a)', collapseEnv.getResultTitleElement(li, 'bing') === a);
  collapseEnv.applyResultCollapse(li, 'bing');
  check('选择器-238: 折叠后仅标题路径外的兄弟子树(来源链接块/描述)被打隐藏标记, 标题路径与容器自身不打标', tpcn._classes.has('serh-collapse-hide') && cap._classes.has('serh-collapse-hide') && !h2._classes.has('serh-collapse-hide') && !a._classes.has('serh-collapse-hide') && !li._classes.has('serh-collapse-hide'));
  collapseEnv.restoreResultCollapse(li);
  check('选择器-239: 还原后容器内所有隐藏标记移除', !tpcn._classes.has('serh-collapse-hide') && !cap._classes.has('serh-collapse-hide'));

  const noTitle = mkCollapseEl('div', 'other');
  const noTitleChild = mkCollapseEl('div', 'inner', noTitle);
  collapseEnv.applyResultCollapse(noTitle, 'bing');
  check('选择器-240(对照): 找不到标题元素时不打任何标记(由snippet/extra隐藏规则兜底)', !noTitleChild._classes.has('serh-collapse-hide') && !noTitle._classes.has('serh-collapse-hide'));

  const li2 = mkCollapseEl('li', 'b_algo');
  const tpcn2 = mkCollapseEl('div', 'b_tpcn', li2, 'example.comhttps://example.com');
  const title2 = mkCollapseEl('a', 'result-link', li2, '示例标题');
  collapseEnv.applyResultCollapse(li2, 'lite');
  check('选择器-241: 标题为容器直接子级时, 其余同级子树同样隐藏', tpcn2._classes.has('serh-collapse-hide') && !title2._classes.has('serh-collapse-hide'));

  check('选择器-242: 折叠CSS含serh-collapse-hide规则; processSingleResult折叠分支与toggleHiddenResults收起分支调用applyResultCollapse, 展开/复位路径调用restoreResultCollapse', /body\.serh-collapse-on \.serh-blocked-collapsed \.serh-collapse-hide \{ display: none !important; \}/.test(src) && /result\.classList\.add\('serh-blocked-collapsed'\);\s*applyResultCollapse\(result, engine\);/.test(src) && /applyResultCollapse\(el, getSearchEngine\(\)\);/.test(src) && (src.match(/restoreResultCollapse\(/g) || []).length >= 5);
}

// ---- 修复W: 搜狗 wap 子域(QQ浏览器搜索页)未识别为引擎站, 屏蔽按钮与规则在该站点整体失效(回归) ----
{
  const wSelStart = src.indexOf('const SELECTORS = {');
  const wSelObject = src.slice(src.indexOf('{', wSelStart), extractObjectLiteral(src, src.indexOf('{', wSelStart)) + 1);
  const wFns = ['normalizeSelectorList', 'mergeSelectorDef', 'getUserSelectors', 'getSelectors', 'resetSelectorCache', 'getSearchEngine', 'isEngineSite', 'getContainerSelector'].map((n) => extractFn(src, n)).join('\n');
  const wBuiltin = src.match(/const builtinSelectorOf = .+?;/)[0];
  const apiW = new Function('storeRef', `
    const SELECTORS_KEY = 'searchfilter_selectors';
    const SELECTORS = ${wSelObject};
    let activeSelectors = null;
    let _engineCacheHost = null; let _engineCacheResult = 'other'; let _observedSelector = '';
    ${wBuiltin}
    let currentHost = 'www.google.com';
    let currentHref = 'https://www.google.com/';
    const window = { location: { get hostname() { return currentHost; }, get href() { return currentHref; } } };
    function GM_getValue(key, defaultValue) { return storeRef.current === undefined ? defaultValue : storeRef.current; }
    ${wFns}
    return { getSearchEngine, isEngineSite, getContainerSelector, resetSelectorCache,
      setHost: (h) => { currentHost = h; currentHref = 'https://' + h + '/'; },
      setHref: (h) => { currentHref = h; } };
  `)({ current: undefined });

  apiW.setHost('wap.sogou.com');
  apiW.setHref('https://wap.sogou.com/web/sl?bid=sogou-mobb-a5ee6457150a2d96&keyword=%E6%B5%8B%E8%AF%95');
  check('修复W-1: wap.sogou.com 识别为搜狗引擎站', apiW.getSearchEngine() === 'sogou' && apiW.isEngineSite() === true, apiW.getSearchEngine());
  check('修复W-2: 搜狗容器选择器覆盖移动端 .reactResult 卡片', /reactResult/.test(apiW.getContainerSelector('sogou')), apiW.getContainerSelector('sogou'));
  apiW.setHost('m.sogou.com');
  check('修复W-3(对照): m.sogou.com 仍识别为搜狗', apiW.getSearchEngine() === 'sogou', apiW.getSearchEngine());
  apiW.setHost('www.sogou.com');
  check('修复W-4(对照): www.sogou.com 仍识别为搜狗', apiW.getSearchEngine() === 'sogou', apiW.getSearchEngine());
  apiW.setHost('sogou.com');
  check('修复W-5(对照): 裸域 sogou.com 识别为搜狗', apiW.getSearchEngine() === 'sogou', apiW.getSearchEngine());
  apiW.setHost('notsogou.com');
  check('修复W-6(对照): 含sogou字样的其他域不误判', apiW.getSearchEngine() === 'other', apiW.getSearchEngine());

  const wContainerSel = apiW.getContainerSelector('sogou');
  check('修复W-7: 搜狗容器选择器覆盖移动端普通结果容器 div.vrResult', /(?:^|,)\s*div\.vrResult\s*$/.test(wContainerSel.trim()), wContainerSel);
  check('修复W-8(对照): 桌面版容器 div.vrwrap:has(h3) 限定保留', /div\.vrwrap:has\(h3\)/.test(wContainerSel), wContainerSel);
  check('修复W-9(对照): 大家还在搜(per-hint)不作为结果容器', !/per-hint/.test(wContainerSel), wContainerSel);

  // 修复W-10: 用真实 wap 页快照固件回归 — 页面内所有 sogou_vr_* 结果容器的 class 都必须被容器选择器覆盖
  const wFixtureHtml = fs.readFileSync(path.join(__dirname, 'fixtures', 'sogou-wap.html'), 'utf8');
  const wDivRe = /<div\b([^>]*)>/g;
  const wContainerClasses = new Map();
  let wdm;
  while ((wdm = wDivRe.exec(wFixtureHtml))) {
    if (!/\bid="sogou_vr_/.test(wdm[1])) continue;
    const clsM = wdm[1].match(/\bclass="([^"]*)"/);
    const cls = clsM ? clsM[1].trim().split(/\s+/).filter(Boolean) : [];
    const key = cls.join(' ');
    wContainerClasses.set(key, (wContainerClasses.get(key) || 0) + 1);
  }
  const wHasVrResult = [...wContainerClasses.keys()].some((k) => k.split(' ').includes('vrResult') && !k.split(' ').includes('vr-topic'));
  const wHasReact = [...wContainerClasses.keys()].some((k) => k.split(' ').includes('reactResult'));
  check('修复W-10a: 固件快照包含 vrResult 普通结果与 reactResult 卡片', wHasVrResult && wHasReact, [...wContainerClasses.keys()].join(' | '));
  const wParts = wContainerSel.split(',').map((s) => s.trim());
  const wCoveredBy = (clsArr) => wParts.some((part) => {
    const m = part.match(/^(?:([a-zA-Z]+))?(?:\.([\w-]+))?(?::[\w-]+(?:\([^)]*\))?)?$/);
    if (!m || (!m[1] && !m[2])) return false;
    if (m[1] && m[1] !== 'div') return false;
    if (m[2] && !clsArr.includes(m[2])) return false;
    return true;
  });
  const wUncovered = [...wContainerClasses.keys()].filter((k) => !wCoveredBy(k.split(' ')));
  check('修复W-10b: 固件内每个 sogou_vr_* 容器 class 都被容器选择器覆盖', wUncovered.length === 0, wUncovered.join(' | '));

  // 修复W-11: Lite 版脚本同步修复
  const liteSrc = fs.readFileSync(path.join(__dirname, '..', 'Lite.user.js'), 'utf8');
  check('修复W-11: Lite 版搜狗容器选择器同步覆盖 div.vrResult', /containers: 'div\.vrwrap:has\(h3\), \.reactResult, div\.vrResult'/.test(liteSrc));
}

// ---- 适配S: 神马搜索(sm.cn, 夸克系渲染)识别与选择器 ----
{
  const sSelStart = src.indexOf('const SELECTORS = {');
  const sSelObject = src.slice(src.indexOf('{', sSelStart), extractObjectLiteral(src, src.indexOf('{', sSelStart)) + 1);
  const sFns = ['normalizeSelectorList', 'mergeSelectorDef', 'getUserSelectors', 'getSelectors', 'resetSelectorCache', 'getSearchEngine', 'isEngineSite', 'getContainerSelector'].map((n) => extractFn(src, n)).join('\n');
  const sBuiltin = src.match(/const builtinSelectorOf = .+?;/)[0];
  const apiS = new Function('storeRef', `
    const SELECTORS_KEY = 'searchfilter_selectors';
    const SELECTORS = ${sSelObject};
    let activeSelectors = null;
    let _engineCacheHost = null; let _engineCacheResult = 'other'; let _observedSelector = '';
    ${sBuiltin}
    let currentHost = 'www.google.com';
    let currentHref = 'https://www.google.com/';
    const window = { location: { get hostname() { return currentHost; }, get href() { return currentHref; } } };
    function GM_getValue(key, defaultValue) { return storeRef.current === undefined ? defaultValue : storeRef.current; }
    ${sFns}
    return { getSelectors, getSearchEngine, isEngineSite, getContainerSelector, resetSelectorCache,
      setHost: (h) => { currentHost = h; currentHref = 'https://' + h + '/'; },
      setHref: (h) => { currentHref = h; } };
  `)({ current: undefined });

  apiS.setHost('m.sm.cn');
  apiS.setHref('https://m.sm.cn/s?q=%E6%B5%8B%E8%AF%95');
  check('适配S-1: m.sm.cn 识别为神马引擎站', apiS.getSearchEngine() === 'quark' && apiS.isEngineSite() === true, apiS.getSearchEngine());
  apiS.setHost('www.sm.cn');
  check('适配S-2(对照): www.sm.cn 识别为神马', apiS.getSearchEngine() === 'quark', apiS.getSearchEngine());
  apiS.setHost('yz.m.sm.cn');
  check('适配S-2b: yz.m.sm.cn 识别为神马', apiS.getSearchEngine() === 'quark', apiS.getSearchEngine());
  apiS.setHost('quark.sm.cn');
  check('适配S-2c: quark.sm.cn(夸克网页版,同构)识别为神马', apiS.getSearchEngine() === 'quark', apiS.getSearchEngine());
  apiS.setHost('page.sm.cn');
  check('适配S-2d(对照): page.sm.cn内容页不作为引擎站', apiS.getSearchEngine() === 'other', apiS.getSearchEngine());
  apiS.setHost('sm.cn');
  check('适配S-3(对照): 裸域 sm.cn 识别为神马', apiS.getSearchEngine() === 'quark', apiS.getSearchEngine());
  apiS.setHost('api.m.sm.cn');
  check('适配S-4(对照): 深层子域 api.m.sm.cn 不误判', apiS.getSearchEngine() === 'other', apiS.getSearchEngine());
  apiS.setHost('notsm.cn');
  check('适配S-5(对照): 含sm字样的其他域不误判', apiS.getSearchEngine() === 'other', apiS.getSearchEngine());
  apiS.resetSelectorCache();
  apiS.setHost('m.sm.cn');

  const sContainerSel = apiS.getContainerSelector('quark');
  check('适配S-6: 神马容器选择器覆盖夸克系结果卡 div.qk-card', /(?:^|,)\s*div\.qk-card\s*$/.test(sContainerSel.trim()), sContainerSel);
  check('适配S-7(对照): 广告卡 cpc-card 不作为结果容器', !/cpc-card/.test(sContainerSel), sContainerSel);
  const sDef = apiS.getSelectors().quark;
  check('适配S-8: 标题选择器含 qk-title-text, 摘要含 qk-paragraph-text, 链接优先取标题链接', sDef.titles[0] === '.qk-title-text' && sDef.snippets[0] === '.qk-paragraph-text' && sDef.links[0] === 'a.qk-title a[href]', JSON.stringify({ titles: sDef.titles, snippets: sDef.snippets, links: sDef.links }));

  const sLiteSrc = fs.readFileSync(path.join(__dirname, '..', 'Lite.user.js'), 'utf8');
  check('适配S-9: Lite 版神马选择器同步', /quark: \{\s*\n\s*match: \/\^\(\?:\(\?:quark\|yz\)\\\.\)\?\(\?:\(\?:www\|m\)\\\.\)\?sm\\\.cn\$\/,\s*\n\s*containers: 'div\.qk-card'/.test(sLiteSrc));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

})();
