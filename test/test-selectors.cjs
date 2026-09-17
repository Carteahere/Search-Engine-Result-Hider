// 选择器与引擎: 合并/覆盖/序列化/校验 / 选择器导入 / DOM增量扫描 / 引擎站装配拆卸与跨页同步 / 引擎检测与全站门控
// 由功能相近的测试文件合并而成: test-selectors.cjs, test-selector-import.cjs, test-dom-scan.cjs, test-engine-lifecycle.cjs, test-engine.cjs
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
  const fn = text.slice(idx, i + 1);
  if (['scanNewResults', 'teardownEngineSite'].includes(fnName)) {
    return 'function restoreResultExtraElements() {}\n' + fn;
  }
  return fn;
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

// ==== 来源: test-selectors.cjs ====
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

const fns = ['normalizeSelectorList', 'getUserSelectors', 'getSelectors', 'resetSelectorCache', 'getSearchEngine', 'isEngineSite', 'getContainerSelector', 'isValidCssSelector', 'hasPseudoElement', 'validateUserSelectors', 'getInvalidRegexFlags', 'regexSourceToLiteralText', 'escapeJsString', 'matchDefToParts', 'serializeSelectors', 'parseSelectorText', 'sameSelectorDef', 'diffUserSelectors', 'pruneUserSelectors'].map((n) => extractFn(src, n));

const body = `
const WEBDAV_SYNC_SELECTORS_KEY = 'searchfilter_webdav_sync_selectors';
const SELECTORS_KEY = 'searchfilter_selectors';
const SUPPORTED_REGEX_FLAGS = 'imsu';
const SELECTORS = ${selectorsObjectText};
let activeSelectors = null;
let _engineCacheHost = null;
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
check('D1 默认无用户配置时返回内置', api.getSelectors().google.containers === 'div.g, div.MjjYud');
check('D2 内置键序在前', Object.keys(api.getSelectors()).join(',') === ['bing', 'google_scholar', 'google', 'duckduckgo_lite', 'duckduckgo', 'yandex', 'brave', 'yahoo', 'other'].join(','));
check('D3 getContainerSelector 内置', api.getContainerSelector('bing') === 'li.b_algo, div.b_algo');

// ---- 覆盖内置 ----
api.setStore({ google: { match: '(?:^|\\.)google\\.', containers: 'div.myg', titles: ['h3'], snippets: ['.s'], links: 'a[href]' } });
check('O1 覆盖后 containers 生效', api.getContainerSelector('google') === 'div.myg');
check('O2 未覆盖引擎不受影响', api.getContainerSelector('bing') === 'li.b_algo, div.b_algo');
check('O3 match 被编译为 RegExp', api.getSelectors().google.match instanceof RegExp);

// ---- 新增引擎 ----
api.setStore(CUSTOM);
api.setHost('searx.example.com');
check('A1 自定义引擎被识别', api.getSearchEngine() === 'mysearx');
check('A2 自定义引擎 isEngineSite 为真', api.isEngineSite() === true);
check('A3 自定义引擎容器选择器', api.getContainerSelector('mysearx') === '.result');
api.setHost('sub.searx.example.com');
check('A4 子域名同样命中', api.getSearchEngine() === 'mysearx');

// ---- other 保留键 ----
api.setStore({ other: { match: '.*', containers: 'body' } });
api.setHost('random.site.org');
check('R1 other 保留键被忽略', api.getSearchEngine() === 'other' && api.isEngineSite() === false);

// ---- 防御:非法 match 静默置空 ----
api.setStore({ broken: { match: '([', containers: '.x', titles: [], snippets: [], links: 'a[href]' } });
api.setHost('broken.example');
check('B1 非法match不崩溃且不激活', api.getSearchEngine() === 'other' && api.getSelectors().broken.match === null);

// ---- 缓存失效 ----
api.setStore(CUSTOM);
api.setHost('searx.example.com');
check('C1 setStore 后缓存失效重新合并', api.getSearchEngine() === 'mysearx');

// ---- validateUserSelectors ----
check('V1 合法配置通过', api.validateUserSelectors(CUSTOM).length === 0);
check('V2 保留键报错', api.validateUserSelectors({ other: { match: 'a', containers: 'b' } }).some(m => m.includes('other')));
check('V3 非法键名报错', api.validateUserSelectors({ 'bad key!': { match: 'a', containers: 'b' } }).length === 1);
check('V4 非法正则报错', api.validateUserSelectors({ e1: { match: '([', containers: '.x' } }).some(m => m.includes('e1')));
check('V5 缺 containers 报错', api.validateUserSelectors({ e2: { match: 'a' } }).some(m => m.includes('containers')));
check('V6 缺 match 报错', api.validateUserSelectors({ e3: { containers: '.x' } }).some(m => m.includes('match')));
check('V7 非法 CSS 报错', api.validateUserSelectors({ e4: { match: 'a', containers: 'div>>>', titles: ['a[['] } }).length === 2);
check('V8 非对象配置报错', api.validateUserSelectors([1, 2]).length === 1 && api.validateUserSelectors('x').length === 1);
check('V9 titles 字符串简写合法', api.validateUserSelectors({ e5: { match: 'a', containers: '.x', titles: 'h3', snippets: '.c', links: ['a', '.b'] } }).length === 0);
check('V10 links 非法类型报错', api.validateUserSelectors({ e6: { match: 'a', containers: '.x', links: 123 } }).length === 1);
check('V11 containers 伪元素被拒且引号内不误报', api.validateUserSelectors({ e7: { match: 'a', containers: 'div::after' } }).length === 1 && api.validateUserSelectors({ e8: { match: 'a', containers: '[data-x="a::b"]' } }).length === 0);
check('V12 对象match校验: 非法flags报错且合法通过', api.validateUserSelectors({ e11: { match: { source: 'a', flags: 'q' }, containers: '.x' } }).length === 1 && api.validateUserSelectors({ e12: { match: { source: 'a', flags: 'i' }, containers: '.x' } }).length === 0);

// ---- normalizeSelectorList ----
check('N1 数组过滤非字符串', JSON.stringify(api.normalizeSelectorList(['a', 1, '', 'b'])) === '["a","b"]');
check('N2 字符串转单元素数组', JSON.stringify(api.normalizeSelectorList('h3')) === '["h3"]');
check('N3 空值转空数组', JSON.stringify(api.normalizeSelectorList(null)) === '[]');

// ---- JS 字面量序列化与解析 ----
const P1 = api.serializeSelectors();
check('S1 序列化为JS字面量', /bing:\s*\{/.test(P1) && /match: \//.test(P1) && P1.includes("'li.b_algo, div.b_algo'"));
const R1 = api.parseSelectorText(P1);
check('S2 序列化→解析往返一致', !R1.errors.length && !!R1.config && R1.config.bing.match === api.getSelectors().bing.match.source && R1.config.google.containers === 'div.g, div.MjjYud');
const R2 = api.parseSelectorText('const SELECTORS = {' + P1 + '};');
check('S3 支持 const 包裹', !R2.errors.length && !!R2.config && !!R2.config.duckduckgo && R2.config.google.titles.length > 0);
const R3 = api.parseSelectorText('{"e9":{"match":"a","containers":".x"}}');
check('S4 兼容旧JSON', !R3.errors.length && !!R3.config && R3.config.e9.match === 'a');
const R4 = api.parseSelectorText('e8: { match: /a[/ }');
check('S5 未闭合正则报错', R4.config === null && R4.errors.length === 1);
const R5 = api.parseSelectorText('e7: { match: /a/q }');
check('S6 非法flags报错', R5.config === null && R5.errors.length === 1);
const R6 = api.parseSelectorText('myx: { match: /(?:^|\\.)x\\.com$/, containers: ".r", titles: ["h3", \'a\'] }');
check('S7 自定义引擎解析并过校验', !R6.errors.length && R6.config.myx.match === '(?:^|\\.)x\\.com$' && api.validateUserSelectors(R6.config).length === 0);
const R7 = api.parseSelectorText('other: { match: /a/, containers: "b" }, z9: { match: /c/, containers: "d" }');
check('S8 other 保留键被解析器丢弃', !R7.errors.length && !!R7.config && !R7.config.other && !!R7.config.z9);
api.setStore({ flg: { match: { source: 'a\\/b', flags: 'i' }, containers: '.x', titles: [], snippets: [], links: 'a[href]' } });
const P2 = api.serializeSelectors();
const R9 = api.parseSelectorText(P2);
check('S9 match flags 序列化→解析往返保留并过校验', P2.includes('match: /a\\/b/i') && !R9.errors.length && R9.config.flg.match.source === 'a\\/b' && R9.config.flg.match.flags === 'i' && api.validateUserSelectors(R9.config).length === 0);
api.setStore({ flg2: { match: { source: 'a', flags: 'I' }, containers: '.x', titles: [], snippets: [], links: 'a[href]' } });
const P2u = api.serializeSelectors();
check('S17 大写flags序列化归一为小写', P2u.includes('match: /a/i'));
check('S18 大写flags编译保留i', api.getSelectors().flg2.match.flags === 'i');
const R9u = api.parseSelectorText('z3: { match: /abc/I, containers: ".x" }');
check('S19 解析时大写flags归一为小写且校验通过', !R9u.errors.length && R9u.config.z3.match.flags === 'i' && api.validateUserSelectors(R9u.config).length === 0);

// ---- 同引擎用户优先(同ID覆盖与新增重叠键均用用户选择器) ----
api.setHost('www.bing.com');
api.setStore({ bing: { match: '(?:^|\\.)bing\\.', containers: 'div.my-bing', titles: ['h2'], snippets: ['.s'], links: 'a[href]' } });
check('U1 同ID覆盖:容器使用用户选择器', api.getContainerSelector('bing') === 'div.my-bing');
check('U2 同ID覆盖:引擎识别正常', api.getSearchEngine() === 'bing');
check('U3 同ID覆盖:用户键合并后排在内置之前', Object.keys(api.getSelectors())[0] === 'bing');
api.setStore({
  bing: { match: '(?:^|\\.)bing\\.', containers: 'div.my-bing', titles: ['h2'], snippets: ['.s'], links: 'a[href]' },
  mybrave: { match: '^search\\.brave\\.com$', containers: '.r' }
});
api.setHost('search.brave.com');
check('U4 新增键与内置主机重叠时用户优先', api.getSearchEngine() === 'mybrave');
check('U5 新增键排在内置同名站点引擎之前', Object.keys(api.getSelectors()).indexOf('mybrave') < Object.keys(api.getSelectors()).indexOf('brave'));
api.setHost('www.google.com');
check('U6 未覆盖内置回退正常', api.getSearchEngine() === 'google');
api.setStore({
  google: { match: '(?:^|\\.)google\\.', containers: 'div.g' },
  google_scholar: { match: '(?:^|\\.)scholar\\.google\\.', containers: 'div.gs_r' }
});
api.setHost('scholar.google.com');
check('U7 用户同时配置google和google_scholar时学者优先', api.getSearchEngine() === 'google_scholar');

// ---- href 回退: 内置与自定义hostname模式不参与, 仅自定义路径/URL模式回退 ----
api.setStore({});
api.setHost('www.google.com');
api.setHref('https://www.google.com/search?q=x.bing.com');
check('H1 内置引擎不因URL尾部误判(google查询含.bing.com)', api.getSearchEngine() === 'google');
api.setHost('example.com');
api.setHref('https://example.com/?ref=x.bing.com');
check('H2 普通站URL尾部含引擎域不误判', api.getSearchEngine() === 'other');
api.setHost('');
api.setHref('');
check('H2b 空href/hostname不误判为引擎站', api.getSearchEngine() === 'other' && api.isEngineSite() === false);
api.setStore(CUSTOM);
api.setHost('other.com');
api.setHref('https://other.com/?u=x.searx.example.com');
check('H3 自定义hostname正则不因URL尾部误判', api.getSearchEngine() === 'other');
api.setStore({ urlengine: { match: '^https://search\\.example\\.com/web', containers: '.r' } });
api.setHost('search.example.com');
api.setHref('https://search.example.com/web?q=1');
check('H4 自定义URL模式仍回退匹配href', api.getSearchEngine() === 'urlengine');
api.setHref('https://search.example.com/images?q=1');
check('H5 自定义URL模式未命中href则回退other', api.getSearchEngine() === 'other');

// ---- diffUserSelectors 保存diff(不固化未改动的内置) ----
api.setStore({});
const allBuiltins = {};
for (const k of ['bing', 'google', 'duckduckgo', 'yandex', 'brave', 'yahoo']) {
  const m = api.getSelectors()[k];
  allBuiltins[k] = { match: m.match.source, containers: m.containers, titles: m.titles.slice(), snippets: m.snippets.slice(), links: m.links };
}
const bingCopy = allBuiltins.bing;
check('W1 与内置完全相同的键被丢弃', !('bing' in api.diffUserSelectors(allBuiltins)));
check('W2 改动过的键保留', 'bing' in api.diffUserSelectors(Object.assign({}, allBuiltins, { bing: Object.assign({}, bingCopy, { containers: '.x' }) })));
check('W3 新增自定义键保留', 'myx' in api.diffUserSelectors(Object.assign({}, allBuiltins, { myx: { match: 'a', containers: '.x' } })));
check('W4 other始终丢弃', !('other' in api.diffUserSelectors(Object.assign({}, allBuiltins, { other: { match: 'a', containers: '.x' } }))));
check('W4b 缺失内置键视为未改动(删除=恢复跟随内置)', !('yahoo' in api.diffUserSelectors({ bing: bingCopy })));
const w4b2 = api.diffUserSelectors(Object.assign({}, allBuiltins, { yahoo: Object.assign({}, allBuiltins.yahoo, { disabled: true }) }));
check('W4b2 显式 disabled 标记被保留', w4b2.yahoo && w4b2.yahoo.disabled === true);
check('W4b3 空配置(重置)不产生任何disabled', Object.keys(api.diffUserSelectors({})).length === 0);
check('W4b4 仅含自定义引擎的片段不禁用内置', Object.keys(api.diffUserSelectors({ mysearx: CUSTOM.mysearx })).join(',') === 'mysearx');
api.setStore({ yahoo: { disabled: true } });
check('W4c disabled 的内置引擎不被加载', api.getSelectors().yahoo && api.getSelectors().yahoo.disabled === true);
api.setHost('search.yahoo.com');
check('W4d disabled 的内置引擎不匹配站点', api.getSearchEngine() === 'other');

// ---- disabled 引擎编辑器往返 ----
const P3 = api.serializeSelectors();
check('S10 disabled 引擎序列化保留内置定义与标记', /yahoo:\s*\{/.test(P3) && P3.includes('disabled: true') && P3.includes("'.sw-Card.Algo, li.b_algo, div.b_algo, #web .algo, .algo-sr, .richAlgo'"));
const R10 = api.parseSelectorText(P3);
check('S11 disabled 往返解析无误且校验通过', !R10.errors.length && !!R10.config && R10.config.yahoo.disabled === true && api.validateUserSelectors(R10.config).length === 0);
check('S12 disabled 往返后 diff 仍保留标记', api.diffUserSelectors(R10.config).yahoo && api.diffUserSelectors(R10.config).yahoo.disabled === true);
const R11 = api.parseSelectorText('z1: { disabled: true }');
check('S13 自定义禁用块解析且校验通过', !R11.errors.length && !!R11.config && R11.config.z1.disabled === true && api.validateUserSelectors(R11.config).length === 0);
check('S14 disabled:false 单独为显式恢复不报错, 完整定义仍按普通校验', api.validateUserSelectors({ z2: { disabled: false } }).length === 0 && api.validateUserSelectors({ z6: { disabled: false, containers: '.x' } }).some(m => m.includes('match')));
api.setStore({});
check('W5 sameSelectorDef 兼容字符串/RegExp/对象形态且flags参与比较',
  api.sameSelectorDef({ match: 'a.b', containers: '.x', titles: [], snippets: [], links: 'a[href]' }, { match: /a.b/, containers: '.x', titles: [], snippets: [], links: 'a[href]' }) &&
  api.sameSelectorDef({ match: { source: 'a.b', flags: '' }, containers: '.x', titles: [], snippets: [], links: 'a[href]' }, { match: /a.b/, containers: '.x', titles: [], snippets: [], links: 'a[href]' }) &&
  !api.sameSelectorDef({ match: { source: 'a.b', flags: 'i' }, containers: '.x', titles: [], snippets: [], links: 'a[href]' }, { match: /a.b/, containers: '.x', titles: [], snippets: [], links: 'a[href]' }));

// ---- disable 别名字段 ----
check('DIS-D1 disable:true 别名校验通过', api.validateUserSelectors({ z4: { disable: true } }).length === 0);
check('DIS-D2 disable:false 单独视为显式恢复', api.validateUserSelectors({ z5: { disable: false } }).length === 0);
{
  const out = api.diffUserSelectors({ bing: { disable: true } });
  check('DIS-D3 diff disable:true 归一为 disabled:true', out.bing && out.bing.disabled === true && out.bing.disable === undefined);
}
check('DIS-D4 diff disable:false 单独被丢弃', Object.keys(api.diffUserSelectors({ bing: { disable: false } })).length === 0);
check('DIS-D5 diff disabled:false 单独被丢弃(恢复内置)', Object.keys(api.diffUserSelectors({ bing: { disabled: false } })).length === 0);
check('DIS-D6 diff 完整定义+disable:false 与内置相同被丢弃', !('bing' in api.diffUserSelectors({ bing: Object.assign({ disable: false }, bingCopy) })));
{
  const out = api.diffUserSelectors({ bing: Object.assign({ disable: false }, bingCopy, { containers: '.x' }) });
  check('DIS-D7 diff 完整定义+disable:false 改动被保留且别名剥离', out.bing && out.bing.containers === '.x' && out.bing.disable === undefined);
}
api.setStore({ bing: { disable: true } });
api.setHost('www.bing.com');
check('DIS-D8 disable:true 引擎被停用', api.getSearchEngine() === 'other');
api.setStore({ bing: { disable: false } });
api.setHost('www.bing.com');
check('DIS-D9 disable:false 空覆盖不破坏内置引擎', api.getSearchEngine() === 'bing' && api.getContainerSelector('bing') === 'li.b_algo, div.b_algo');
api.setStore({});
api.setHost('www.bing.com');
check('DIS-D10 清空后恢复', api.getSearchEngine() === 'bing');
{
  const R12 = api.parseSelectorText('z7: { disable: true }');
  check('DIS-D11 解析器接受 disable 别名', !R12.errors.length && !!R12.config && R12.config.z7.disable === true && api.validateUserSelectors(R12.config).length === 0);
}

// ---- pruneUserSelectors 清理旧版固化的内置副本 ----
storeRef.current = { bing: JSON.parse(JSON.stringify(bingCopy)), myse: { match: 'a', containers: '.x' } };
api.resetSelectorCache();
api.pruneUserSelectors();
check('W6 旧版固化的内置副本被清理', storeRef.current && !('bing' in storeRef.current) && !!storeRef.current.myse);
// extraElements participates in validation, merge, editor round trips and diff.
const extraDef = { ...CUSTOM.mysearx, extraElements: ['+ .summary', '~ .metadata'] };
api.setStore({ customExtra: extraDef });
check('EX1 普通分支保留关联选择器', JSON.stringify(api.getSelectors().customExtra.extraElements) === JSON.stringify(extraDef.extraElements));
check('EX2 相对CSS配置校验通过', api.validateUserSelectors({ customExtra: extraDef }).length === 0);
const extraRoundTrip = api.parseSelectorText(api.serializeSelectors());
check('EX3 序列化解析保留关联配置', !extraRoundTrip.errors.length && api.sameSelectorDef(extraRoundTrip.config.customExtra, extraDef));
for (const value of ['+ tr', null, [1], [''], ['+ tr, body'], ['+ tr::after']]) {
  check('EX4 非法关联配置被拒 ' + JSON.stringify(value), api.validateUserSelectors({ customExtra: { ...extraDef, extraElements: value } }).some(e => e.includes('extraElements')));
}
check('EX5 disabled配置仍校验关联CSS', api.validateUserSelectors({ customExtra: { disabled: true, extraElements: ['+ tr, body'] } }).length === 1);
api.setStore({ customExtra: { ...extraDef, disabled: true } });
check('EX6 禁用分支保留关联配置', JSON.stringify(api.getSelectors().customExtra.extraElements) === JSON.stringify(extraDef.extraElements));
const disabledExtra = api.parseSelectorText(api.serializeSelectors());
check('EX7 禁用配置往返保留关联配置', disabledExtra.config.customExtra.disabled && api.sameSelectorDef(disabledExtra.config.customExtra, extraDef));
api.setStore({ duckduckgo_lite: { disabled: true } });
const disabledLite = api.parseSelectorText(api.serializeSelectors());
check('EX8 禁用内置Lite往返保留关联配置', disabledLite.config.duckduckgo_lite.extraElements.length === 3);
api.setHost('lite.duckduckgo.com');
check('EX9 禁用Lite不回退普通DDG', api.getSearchEngine() === 'other');
api.setStore({});
const liteDef = api.getSelectors().duckduckgo_lite;
check('EX10 未改动Lite不固化', !api.diffUserSelectors({ duckduckgo_lite: liteDef }).duckduckgo_lite);
check('EX11 清空关联配置属于有效修改', !!api.diffUserSelectors({ duckduckgo_lite: { ...liteDef, extraElements: [] } }).duckduckgo_lite);
check('EX12 缺省与空关联相等', api.sameSelectorDef(CUSTOM.mysearx, { ...CUSTOM.mysearx, extraElements: [] }));
api.setStore({ duckduckgo_lite: { ...liteDef, match: liteDef.match.source, extraElements: [] } });
check('EX13 覆盖可清空内置关联', api.getSelectors().duckduckgo_lite.extraElements.length === 0);
const parseCondition = new Function(extractFn(src, 'parseConditionPart') + '; return parseConditionPart;')();
for (const id of ['duckduckgo', 'ddg', 'duckduckgo_lite']) {
  check('EX14 Lite条件匹配 ' + id, parseCondition('$site=' + id, 'duckduckgo_lite', 'lite.duckduckgo.com').static === true);
}
check('EX15 专有ID不匹配普通DDG', parseCondition('$site=duckduckgo_lite', 'duckduckgo', 'duckduckgo.com').static === false);
})();

// ==== 来源: test-selector-import.cjs ====
await (async () => {
const importSelectorsFromFileFn = extractFn(src, 'importSelectorsFromFile');


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
    ${importSelectorsFromFileFn}
    return {
      importSelectorsFromFile,
      isPreventPanelClose: () => preventPanelClose,
    };
  `);
  const api = factory(documentStub, FakeFileReader, textarea, windowStub);
  return { env, api, fakeInput, textarea, window: windowStub };
}

// 1. 正常导入并刷新
{
  const { env, api, fakeInput, textarea } = createEnv();
  api.importSelectorsFromFile(textarea, () => env.events.push('loaded:' + textarea.value));
  assert('I1 打开文件选择后锁定面板关闭', api.isPreventPanelClose() === true);
  assert('I2 input 已加入 DOM', env.bodyChildren.includes(fakeInput));
  fakeInput.files = [{ _content: 'myx: {}' }];
  fakeInput.onchange({ target: fakeInput });
  assert('I3 文件内容写入编辑区', textarea.value === 'myx: {}');
  assert('I4 导入回调在写入后触发', env.events.join('|') === 'value|loaded:myx: {}');
  assert('I5 读取完成后解锁', api.isPreventPanelClose() === false);
  assert('I6 读取完成后移除 input', !env.bodyChildren.includes(fakeInput));
}

// 2. 取消选择
{
  const { env, api, fakeInput, textarea } = createEnv();
  api.importSelectorsFromFile(textarea, () => env.events.push('loaded'));
  fakeInput.listeners.cancel[0]();
  assert('I7 cancel 后解锁并移除 input', api.isPreventPanelClose() === false && !env.bodyChildren.includes(fakeInput));
  assert('I8 cancel 不触发导入回调', env.events.length === 0);
}

// 3. onchange 但未选中文件
{
  const { env, api, fakeInput, textarea } = createEnv();
  api.importSelectorsFromFile(textarea, () => env.events.push('loaded'));
  fakeInput.onchange({ target: { files: [] } });
  assert('I9 未选择文件时解锁并移除 input', api.isPreventPanelClose() === false && !env.bodyChildren.includes(fakeInput));
  assert('I10 未选择文件不触发导入回调', env.events.length === 0);
}

// 4. 读取失败
{
  const { env, api, fakeInput, textarea } = createEnv();
  api.importSelectorsFromFile(textarea, () => env.events.push('loaded'));
  fakeInput.files = [{ _error: true }];
  fakeInput.onchange({ target: fakeInput });
  assert('I11 读取失败时解锁并移除 input', api.isPreventPanelClose() === false && !env.bodyChildren.includes(fakeInput));
  assert('I12 读取失败不触发导入回调', env.events.length === 0);
}

// 5. 未传回调
{
  const { env, api, fakeInput, textarea } = createEnv();
  api.importSelectorsFromFile(textarea);
  fakeInput.files = [{ _content: 'x: {}' }];
  fakeInput.onchange({ target: fakeInput });
  assert('I13 未传回调时仍写入并解锁', textarea.value === 'x: {}' && api.isPreventPanelClose() === false);
}

// 6. 不支持 cancel 事件的浏览器: 焦点回落且未选择文件时兜底解锁
{
  const { env, api, fakeInput, textarea, window } = createEnv();
  api.importSelectorsFromFile(textarea, () => env.events.push('loaded'));
  assert('I14 焦点兜底监听已注册', window.listeners.focus && window.listeners.focus.length === 1);
  window.listeners.focus.forEach((fn) => fn());
  await new Promise((r) => setTimeout(r, 350));
  assert('I15 焦点回落无文件时解锁并移除 input', api.isPreventPanelClose() === false && !env.bodyChildren.includes(fakeInput));
  assert('I16 焦点兜底触发后解绑', window.listeners.focus.length === 0);
}

// 7. 面板接线: 导入后刷新行号
assert('I17 面板导入回调刷新行号', /importSelectorsFromFile\(textarea, \(\) => \{\s*showError\(\[\]\);\s*updateSelLineNumbers\(\);/.test(src));
})();

// ==== 来源: test-dom-scan.cjs ====
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
  check('Q1 :is 包裹整组选择器', env.queries.includes(':is(.a, .b):not([data-observed])'), env.queries);
  check('Q2 已观察元素不会重复命中查询', !a1.observeCount && !b1.observeCount);

  // ---- 初始扫描: 已观察集合按当前选择器保留 ----
  api.scanNewResults();
  check('SCAN-S1 初始扫描保留匹配的已观察元素', a1.unobserveCount === 0 && b1.unobserveCount === 0);
  check('SCAN-S2 初始扫描观察新元素', a2.observed && b2.observed && a2.observeCount === 1 && b2.observeCount === 1);

  // ---- 选择器收窄: 清理陈旧元素 ----
  api.resetSelectorCache();
  api.setSelector('.a');
  api.scanNewResults();
  check('SCAN-S3 收窄选择器清理不再匹配元素', b1.observed === false && b1.unobserveCount === 1 && b1.resetCount === 1);
  check('SCAN-S4 收窄选择器保留仍匹配元素', a1.observed === true && a1.unobserveCount === 0);
  check('SCAN-S5 清理后已观察集合全部匹配当前选择器', env.elements.filter((e) => e.observed).every((e) => e.matches('.a')));

  const before = { a1: a1.unobserveCount, b1: b1.unobserveCount, b2: b2.unobserveCount };
  api.scanNewResults();
  check('SCAN-S6 选择器未变化不重复清理', a1.unobserveCount === before.a1 && b1.unobserveCount === before.b1 && b2.unobserveCount === before.b2);

  // ---- 禁用时清空观察集合 ----
  api.setEnabled(false);
  api.scanNewResults();
  check('SCAN-S7 禁用时清空观察集合并重置记录', env.elements.every((e) => !e.observed) && api.getObservedSelector() === '');
  check('SCAN-S8 禁用时关闭隐藏结果显示', api.getShowHidden() === false);
}

// ---- clearStaleObserved 细节 ----
{
  const { api, makeEl } = createEnv();
  const stale = makeEl('div', 'x', true);
  const btn = { removed: 0, remove() { this.removed++; } };
  stale.quickBtn = btn;
  api.clearStaleObserved('.a');
  check('STALE-C1 清理陈旧元素移除快捷屏蔽按钮', btn.removed === 1 && stale.observed === false && stale.resetCount === 1);

  const bad = makeEl('div', 'y', true);
  bad.matches = () => { throw new Error('bad selector'); };
  api.clearStaleObserved('.a');
  check('STALE-C2 matches 异常按陈旧处理且不崩溃', bad.observed === false && bad.unobserveCount === 1);
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
  check('NEST-N1 聚合块外层自带独立链接时保留评估', kept.includes(outer) && kept.includes(sub1) && kept.includes(sub2) && kept.includes(plain));

  const wrapLink = { id: 'wrap-link' };
  const wsub = makeNode([], [wrapLink]);
  const wrapper = makeNode([wsub], [wrapLink]);
  const kept2 = filterFn([wrapper, wsub], 'div.g');
  check('NEST-N2 纯包装外层(链接全属内层)仍被丢弃', !kept2.includes(wrapper) && kept2.includes(wsub));

  const weird = { querySelector() { throw new Error('bad'); }, querySelectorAll() { throw new Error('bad'); }, contains() { return false; } };
  check('NEST-N3 选择器异常时不崩溃', filterFn([weird], 'div.g').length === 1);

  const obsLink = { id: 'obs-link' };
  const obsInner = makeNode([], [obsLink]);
  const outerOnly = makeNode([obsInner], [makeNode([], []), { id: 'o2' }]);
  const kept3 = filterFn([outerOnly], 'div.g');
  check('NEST-N4 内层不在批次时外层按自身链接判断', kept3.includes(outerOnly));

  // 已观察内层不在增量候选中，但仍属于外层的后代结果。
  wrapper.querySelectorAll = sel => sel === 'a[href]' ? [wrapLink] : [wsub];
  wrapper.querySelector = () => wsub;
  check('NEST-N5 仅剩外层候选时仍排除纯包装', filterFn([wrapper], 'div.g').length === 0);
  check('NEST-N6 多候选增量扫描也排除纯包装', !filterFn([wrapper, plain], 'div.g').includes(wrapper));
  wrapper.querySelectorAll = sel => sel === 'a[href]' ? [wrapLink, ownLink] : [wsub];
  check('NEST-N7 增量扫描保留真正独立链接', filterFn([wrapper], 'div.g').includes(wrapper));
}
})();

// ==== 来源: test-engine-lifecycle.cjs ====
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
  check('G1 首次注入记录样式句柄', env.stats.addStyleCalls === 1 && env.stats.widgetCalls === 1 && env.api.getStyleEl() === styleEl);
  env.api.injectGlobalStyles();
  check('G2 重复注入不重复添加全局样式', env.stats.addStyleCalls === 1 && env.stats.widgetCalls === 2);
  env.api.removeGlobalStyles();
  check('G3 移除后释放句柄并调用 remove', styleEl.removeCalls === 1 && env.api.getStyleEl() === null);
  env.api.injectGlobalStyles();
  check('G4 移除后可再次注入', env.stats.addStyleCalls === 2);
}

{
  const { api, stats } = createStyleEnv(undefined);
  let threw = false;
  try {
    api.injectGlobalStyles();
    api.removeGlobalStyles();
    api.injectGlobalStyles();
  } catch (e) { threw = true; }
  check('G5 GM_addStyle 无返回值时不崩溃', !threw && stats.addStyleCalls === 2 && api.getStyleEl() === null);
}

{
  const styleEl = { removeCalls: 0, remove() { this.removeCalls++; } };
  const env = createStyleEnv(styleEl);
  env.api.setEngine('mysearx');
  env.api.injectGlobalStyles();
  check('G6 自定义引擎不注入布局样式但注入组件样式', env.stats.addStyleCalls === 0 && env.stats.widgetCalls === 1 && env.api.getStyleEl() === null);
}

{
  const styleEl = { removeCalls: 0, remove() { this.removeCalls++; } };
  const env = createStyleEnv(styleEl);
  env.api.injectGlobalStyles();
  env.api.setEngine('mysearx');
  env.api.injectGlobalStyles();
  check('G7 内置切自定义时移除布局样式', env.stats.addStyleCalls === 1 && styleEl.removeCalls === 1 && env.api.getStyleEl() === null);
}

{
  const styleEl = { removeCalls: 0, remove() { this.removeCalls++; } };
  const env = createStyleEnv(styleEl);
  env.api.setEngine('other');
  env.api.injectGlobalStyles();
  check('G8 other 引擎不注入布局样式', env.stats.addStyleCalls === 0 && env.api.getStyleEl() === null);
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
    let showHiddenResults = true;
    let _observedSelector = '.a';
    let forceReprocessBatchId = 5;
    let _searchForm = null;
    let _searchFormHandler = null;
    function resetResultStyles(el) { el.reset++; }
    function clearTimeout() {}
    function removeGlobalStyles() { counters.removeGlobalCalls++; }
    function stopBackgroundSync() { counters.stopSyncCalls++; }
    ${teardownEngineSiteFn}
    return {
      teardownEngineSite,
      state: () => ({ setup: _engineSiteSetup, observer: _domObserver, showHidden: showHiddenResults, observedSelector: _observedSelector, batchId: forceReprocessBatchId }),
    };
  `)(documentStub, resultObserver, statusEl, observer, counters);
  return { api, counters, statusEl, observer, observed };
}

{
  const { api, counters, statusEl, observer, observed } = createTeardownEnv();
  api.teardownEngineSite();
  const state = api.state();
  check('T1 teardown 复位装配状态并终止残留批处理', state.setup === false && state.observer === null && observer.disconnectCalls === 1 && state.batchId === 6);
  check('T2 teardown 清理已观察元素', observed[0].unobserved === 1 && observed[0].removeAttributeCalls === 1 && observed[0].reset === 1);
  check('T3 teardown 复位显示与选择器记录', state.showHidden === false && state.observedSelector === '');
  check('T4 teardown 移除悬浮球与全局样式', statusEl.removed === 1 && counters.removeGlobalCalls === 1);
  check('T6 teardown 不停止全站后台同步', counters.stopSyncCalls === 0);
  api.teardownEngineSite();
  check('T5 重复 teardown 不重复执行', counters.removeGlobalCalls === 1 && statusEl.removed === 1 && counters.stopSyncCalls === 0);
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
  check('E7 引擎站装配不再启动全站后台同步', calls.start === 0 && calls.inject === 1 && calls.scan === 1 && api.state().setup === true);
  api.ensureEngineSiteSetup();
  check('E8 重复装配不重复启动同步', calls.start === 0);
}
{
  const { api, calls } = createEnsureEnv(false);
  api.ensureEngineSiteSetup();
  check('E9 非引擎站不装配也不启动同步', calls.start === 0 && calls.inject === 0 && api.state().setup === false);
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
  check('R1 普通站变引擎站时装配并重扫', calls.ensure === 1 && calls.force === 1 && calls.teardown === 0 && api.getSetup() === true);
}
{
  const { api, calls } = createRefreshEnv(true, true);
  api.refreshEngineSite();
  check('R2 已是引擎站时重扫并重算布局样式', calls.ensure === 0 && calls.force === 1 && calls.teardown === 0 && calls.layout === 1);
}
{
  const { api, calls } = createRefreshEnv(false, true);
  api.refreshEngineSite();
  check('R3 引擎站变普通站时拆卸', calls.ensure === 0 && calls.force === 0 && calls.teardown === 1 && api.getSetup() === false);
}
{
  const { api, calls } = createRefreshEnv(false, false);
  api.refreshEngineSite();
  check('R4 普通站保持普通站时无操作', calls.ensure === 0 && calls.force === 0 && calls.teardown === 0);
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
  check('E1 首次调用仅建立基线', api.checkExternalSelectorChange() === false && counters.reset === 0 && counters.refresh === 0);
  check('E2 存储未变化不重装配', api.checkExternalSelectorChange() === false && counters.reset === 0 && counters.refresh === 0);
  state.store = { a: 2 };
  check('E3 其它标签页修改后重装配', api.checkExternalSelectorChange() === true && counters.reset === 1 && counters.refresh === 1);
  check('E4 重装配后再次调用不重复', api.checkExternalSelectorChange() === false && counters.reset === 1 && counters.refresh === 1);
  state.throwMode = true;
  check('E5 读取失败不误判为变更', api.checkExternalSelectorChange() === false && counters.reset === 1 && counters.refresh === 1);
  state.throwMode = false;
  state.store = { a: 3 };
  check('E6 读取恢复后继续检测变更', api.checkExternalSelectorChange() === true && counters.reset === 2 && counters.refresh === 2);
}
})();

// ==== 来源: test-engine.cjs ====
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
const cases = [
  ['www.bing.com', 'bing'],
  ['cn.bing.com', 'bing'],
  ['global.bing.com', 'bing'],
  ['m.bing.com', 'bing'],
  ['bing.com.hk', 'bing'],
  ['www.bing.com.hk', 'bing'],
  ['www.bing.com.tw', 'bing'],
  ['www.bing.com.au', 'bing'],
  ['www2.bing.com', 'bing'],
  ['www3.bing.com', 'bing'],
  ['www4.bing.com', 'bing'],
  ['www5.bing.com', 'other'],
  ['noai.duckduckgo.com', 'duckduckgo'],
  ['start.duckduckgo.com', 'duckduckgo'],
  ['lite.duckduckgo.com', 'duckduckgo_lite'],
  ['lite.ddg.gg', 'other'],
  ['google.com', 'google'],
  ['m.google.com', 'google'],
  ['www.google.co.jp', 'google'],
  ['google.events', 'google'],
  ['duckduckgo.com', 'duckduckgo'],
  ['m.duckduckgo.com', 'duckduckgo'],
  ['safe.duckduckgo.com', 'duckduckgo'],
  ['ddg.gg', 'duckduckgo'],
  ['yandex.ru', 'yandex'],
  ['ya.ru', 'yandex'],
  ['www.yandex.com.tr', 'yandex'],
  ['search.brave.com', 'brave'],
  ['search.yahoo.com', 'yahoo'],
  ['search.yahoo.com.hk', 'yahoo'],
  ['search.yahoo.com.tw', 'yahoo'],
  ['r.search.yahoo.com', 'yahoo'],
  ['scholar.google.com', 'google_scholar'],
  ['scholar.google.co.jp', 'google_scholar'],
  ['www.google.com', 'google'],
  ['images.google.com', 'google'],
  ['encrypted.google.com', 'google'],
  ['search.yahoo.co.jp', 'yahoo'],
  ['japan.search.yahoo.co.jp', 'yahoo'],
  ['jp.search.yahoo.com', 'yahoo'],
  ['images.search.yahoo.com', 'yahoo'],
  ['html.duckduckgo.com', 'duckduckgo'],
  ['www.duckduckgo.com', 'duckduckgo'],
  ['example.com', 'other'],
  ['bing.com.evil.com', 'other'],
  ['notgoogle.com', 'other'],
  ['yahoo.com.evil.net', 'other'],
  ['mail.google.com', 'other'],
  ['drive.google.com', 'other'],
  ['docs.google.com', 'other'],
  ['maps.google.com', 'other'],
  ['accounts.google.com', 'other'],
  ['mail.yahoo.com', 'other'],
  ['news.yahoo.co.jp', 'other'],
  ['brave.com', 'other'],
  ['www.brave.com', 'other'],
];

for (const [host, expected] of cases) {
  const w = { location: { hostname: host } };
  const got = factory(w, selectors).getSearchEngine();
  assert(`${host} -> ${expected}`, got === expected);
}

assert('SELECTORS键序为引擎检测顺序', JSON.stringify(Object.keys(selectors)) === JSON.stringify(['bing', 'google_scholar', 'google', 'duckduckgo_lite', 'duckduckgo', 'yandex', 'brave', 'yahoo', 'other']));
assert('缓存:同hostname二次调用返回相同结果', factory({ location: { hostname: 'www.google.com' } }, selectors).getSearchEngine() === 'google');
assert('内置引擎不因URL尾部误判(google查询含.bing.com)', factory({ location: { hostname: 'www.google.com', href: 'https://www.google.com/search?q=x.bing.com' } }, selectors).getSearchEngine() === 'google');
assert('内置引擎不因URL尾部误判(普通站查询含.bing.com)', factory({ location: { hostname: 'example.com', href: 'https://example.com/?ref=x.bing.com' } }, selectors).getSearchEngine() === 'other');
assert('空href/hostname返回other而非缓存哨兵', factory({ location: { hostname: '', href: '' } }, selectors).getSearchEngine() === 'other');
assert('空href/hostname门控为普通站', gateFactory({ location: { hostname: '', href: '' } }, selectors)() === false);

// ---- 搜索分类检测 ----
const catCases = [
  [{ hostname: 'www.google.com', pathname: '/search', search: '?q=x' }, 'web'],
  [{ hostname: 'www.google.com', pathname: '/search', search: '?q=x&tbm=isch' }, 'images'],
  [{ hostname: 'www.google.com', pathname: '/search', search: '?udm=7' }, 'videos'],
  [{ hostname: 'www.google.com', pathname: '/search', search: '?udm=12' }, 'news'],
  [{ hostname: 'www.bing.com', pathname: '/images/search', search: '?q=x' }, 'images'],
  [{ hostname: 'www.bing.com', pathname: '/videos/search', search: '?q=x' }, 'videos'],
  [{ hostname: 'www.bing.com', pathname: '/search', search: '?q=x' }, 'web'],
  [{ hostname: 'duckduckgo.com', pathname: '/', search: '?q=x&ia=images' }, 'images'],
  [{ hostname: 'duckduckgo.com', pathname: '/', search: '?iax=images' }, 'images'],
  [{ hostname: 'search.brave.com', pathname: '/images', search: '?q=x' }, 'images'],
  [{ hostname: 'images.search.yahoo.com', pathname: '/search/images', search: '?p=x' }, 'images'],
];
for (const [loc, expected] of catCases) {
  const got = factory({ location: loc }, selectors).getSearchCategory(loc);
  assert(`category ${loc.hostname}${loc.pathname}${loc.search} -> ${expected}`, got === expected);
}

// ---- 全站注入与引擎站门控一致性 ----
const hosts = [
  'www.bing.com', 'm.bing.com', 'www.bing.com.hk', 'google.co.jp', 'm.google.com',
  'duckduckgo.com', 'm.duckduckgo.com', 'safe.duckduckgo.com', 'ddg.gg',
  'yandex.ru', 'ya.ru', 'www.yandex.com.tr',
  'search.brave.com', 'search.yahoo.co.jp', 'search.yahoo.com.hk',
  'scholar.google.com',
  'example.com', 'bing.com.evil.com',
  'mail.google.com', 'mail.yahoo.com', 'brave.com',
];

assert('头部包含 @match *://*/* (全站注入)', matchLines.includes('*://*/*'));

for (const host of hosts) {
  const eng = detectEngine(host);
  const gated = gateFactory({ location: { hostname: host } }, selectors)();
  assert(`${host}: 引擎判定(${eng})与门控(${gated})一致`, gated === (eng !== 'other'));
}
})();

// ==== 跨标签页同步锁 ====
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
  check('L1 首次抢占成功', tab1.tryAcquireSyncLock('t') === true && tab1.readSyncLock('t').owner === 'tab-1');
  check('L2 他页持锁时抢占失败', tab2.tryAcquireSyncLock('t') === false);
  check('L3 过期锁可被抢占', (() => {
    lockStore.set('test_lock_t', { owner: 'tab-dead', expires: Date.now() - 1 });
    return tab2.tryAcquireSyncLock('t') === true && tab2.readSyncLock('t').owner === 'tab-2';
  })());
  check('L4 非持锁页续租失败', tab1.renewSyncLock('t') === false);
  check('L5 持锁页续租成功', tab2.renewSyncLock('t') === true);
  tab1.releaseSyncLock('t');
  check('L6 非持锁页释放无效', tab2.readSyncLock('t').owner === 'tab-2');
  tab2.releaseSyncLock('t');
  check('L7 持锁页释放清空', tab2.readSyncLock('t') === null);
}

// 并发抢占: 后写入者回读校验通过, 先写入者回读失败退出
{
  const tab1 = createLockEnv('tab-a');
  const tab2 = createLockEnv('tab-b');
  let ran1 = 0, ran2 = 0;
  const p1 = tab1.runWithSyncLock('race', async () => { ran1++; await new Promise((r) => setTimeout(r, 30)); });
  const p2 = tab2.runWithSyncLock('race', async () => { ran2++; await new Promise((r) => setTimeout(r, 30)); });
  await Promise.all([p1, p2]);
  check('L8 并发抢占仅一个执行者', ran1 + ran2 === 1, { ran1, ran2 });
  check('L9 执行完成后锁释放', tab1.readSyncLock('race') === null && tab2.readSyncLock('race') === null);
  let ran3 = 0;
  await tab1.runWithSyncLock('race', async () => { ran3++; });
  check('L10 释放后他页可再次执行', ran3 === 1);
}

// 任务失败也必须释放锁
{
  const tab = createLockEnv('tab-c');
  let threw = false;
  try {
    await tab.runWithSyncLock('fail', async () => { throw new Error('boom'); });
  } catch (e) { threw = true; }
  check('L11 任务异常仍释放锁', threw === true && tab.readSyncLock('fail') === null);
}

// ---- 菜单注册测试 (非引擎站仅注册4项) ----
{
  const regMenuFn = extractFn(src, 'registerMenu');
  const regToggleFn = extractFn(src, 'registerToggleMenu');
  function runMenuTest(isEngine) {
    const registered = [];
    const GM_registerMenuCommand = (label, cb) => { registered.push(label); };
    const t = (k) => k;
    const currentConfig = { language: 'zh-CN', errorDetection: true, panelCentered: false, showBubble: true, bubbleAction: 'openPanel' };
    const isEngineSite = () => isEngine;
    const showConfigPanel = () => {};
    const showSelectorPanel = () => {};
    const showHighlightColorPanel = () => {};
    const persistConfig = () => {};
    const menuEnv = new Function(
      'registered', 'GM_registerMenuCommand', 't', 'currentConfig', 'isEngineSite', 'showConfigPanel', 'showSelectorPanel', 'showHighlightColorPanel', 'persistConfig',
      `${regToggleFn}
       ${regMenuFn}
       registerMenu();
       return registered;`
    );
    return menuEnv(registered, GM_registerMenuCommand, t, currentConfig, isEngineSite, showConfigPanel, showSelectorPanel, showHighlightColorPanel, persistConfig);
  }

  const nonEngineMenus = runMenuTest(false);
  check('M1 非引擎站点仅显示4个菜单项', nonEngineMenus.length === 4);
  check('M2 非引擎站点包含打开面板', nonEngineMenus[0] === 'menuOpenPanel');
  check('M3 非引擎站点包含自定义选择器', nonEngineMenus[1] === 'menuCustomSelectors');
  check('M4 非引擎站点包含自定义颜色', nonEngineMenus[2] === 'menuHighlightColor');
  check('M5 非引擎站点包含语言切换', nonEngineMenus[3].includes('menuLang'));

  const engineMenus = runMenuTest(true);
  check('M6 引擎站点显示全部8个菜单项', engineMenus.length === 8);
}
})();

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

})();
