// 选择器与引擎: 合并/覆盖/序列化/校验 / 选择器导入 / DOM增量扫描 / 引擎站装配拆卸与跨页同步 / 引擎检测与全站门控 / 跨标签页同步锁
// 由功能相近的测试文件合并而成: test-selectors.cjs, test-selector-import.cjs, test-dom-scan.cjs, test-engine-lifecycle.cjs, test-engine.cjs
// 测试项统一命名: "选择器-###: 描述", 序号按文件出现顺序 001 起连续递增;
// 已知问题标记为 "选择器-###(已知问题)", 循环组为 "选择器-###-N: 描述 区分信息"
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
    return 'function restoreResultExtraElements() {}\nfunction reconcileHiddenParents() {}\nfunction restoreAllHiddenParents() {}\n' + fn;
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

// ==== [选择器-001~096] 默认合并/覆盖/序列化/校验/关联选择器 (来源: test-selectors.cjs) ====
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

const fns = ['normalizeSelectorList', 'mergeSelectorDef', 'getUserSelectors', 'getSelectors', 'resetSelectorCache', 'getSearchEngine', 'isEngineSite', 'getContainerSelector', 'isValidCssSelector', 'hasPseudoElement', 'validateUserSelectors', 'getInvalidRegexFlags', 'regexSourceToLiteralText', 'escapeJsString', 'matchDefToParts', 'serializeSelectors', 'parseSelectorText', 'sameSelectorDef', 'diffUserSelectors', 'pruneUserSelectors'].map((n) => extractFn(src, n));

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
check('选择器-002: 内置键序在前', Object.keys(api.getSelectors()).join(',') === ['bing', 'google_scholar', 'google', 'duckduckgo_lite', 'duckduckgo', 'yandex', 'brave', 'yahoo', 'other'].join(','));
check('选择器-003: getContainerSelector 内置', api.getContainerSelector('bing') === 'li.b_algo, div.b_algo');

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
api.setHost('sub.searx.example.com');
check('选择器-010: 子域名同样命中', api.getSearchEngine() === 'mysearx');

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

// ---- 同引擎用户优先(同ID覆盖与新增重叠键均用用户选择器) ----
api.setHost('www.bing.com');
api.setStore({ bing: { match: '(?:^|\\.)bing\\.', containers: 'div.my-bing', titles: ['h2'], snippets: ['.s'], links: 'a[href]' } });
check('选择器-041: 同ID覆盖:容器使用用户选择器', api.getContainerSelector('bing') === 'div.my-bing');
check('选择器-042: 同ID覆盖:引擎识别正常', api.getSearchEngine() === 'bing');
check('选择器-043: 同ID覆盖:用户键合并后排在内置之前', Object.keys(api.getSelectors())[0] === 'bing');
api.setStore({
  bing: { match: '(?:^|\\.)bing\\.', containers: 'div.my-bing', titles: ['h2'], snippets: ['.s'], links: 'a[href]' },
  mybrave: { match: '^search\\.brave\\.com$', containers: '.r' }
});
api.setHost('search.brave.com');
check('选择器-044: 新增键与内置主机重叠时用户优先', api.getSearchEngine() === 'mybrave');
check('选择器-045: 新增键排在内置同名站点引擎之前', Object.keys(api.getSelectors()).indexOf('mybrave') < Object.keys(api.getSelectors()).indexOf('brave'));
api.setHost('www.google.com');
check('选择器-046: 未覆盖内置回退正常', api.getSearchEngine() === 'google');
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
check('选择器-061: 仅含自定义引擎的片段不禁用内置', Object.keys(api.diffUserSelectors({ mysearx: CUSTOM.mysearx })).join(',') === 'mysearx');
api.setStore({ yahoo: { disabled: true } });
check('选择器-062: disabled 的内置引擎不被加载', api.getSelectors().yahoo && api.getSelectors().yahoo.disabled === true);
api.setHost('search.yahoo.com');
check('选择器-063: disabled 的内置引擎不匹配站点', api.getSearchEngine() === 'other');

// ---- disabled 引擎编辑器往返 ----
const P3 = api.serializeSelectors();
check('选择器-064: disabled 引擎序列化保留内置定义与标记', /yahoo:\s*\{/.test(P3) && P3.includes('disabled: true') && P3.includes("'.sw-Card.Algo, li.b_algo, div.b_algo, #web .algo, .algo-sr, .richAlgo'"));
const R10 = api.parseSelectorText(P3);
check('选择器-065: disabled 往返解析无误且校验通过', !R10.errors.length && !!R10.config && R10.config.yahoo.disabled === true && api.validateUserSelectors(R10.config).length === 0);
check('选择器-066: disabled 往返后 diff 仍保留标记', api.diffUserSelectors(R10.config).yahoo && api.diffUserSelectors(R10.config).yahoo.disabled === true);
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
for (const [i, value] of ['+ tr', null, [1], [''], ['+ tr, body'], ['+ tr::after']].entries()) {
  check(`选择器-085-${i + 1}: 非法关联配置被拒 ${JSON.stringify(value)}`, api.validateUserSelectors({ customExtra: { ...extraDef, extraElements: value } }).some(e => e.includes('extraElements')));
}
check('选择器-086: disabled配置仍校验关联CSS', api.validateUserSelectors({ customExtra: { disabled: true, extraElements: ['+ tr, body'] } }).length === 1);
api.setStore({ customExtra: { ...extraDef, disabled: true } });
check('选择器-087: 禁用分支保留关联配置', JSON.stringify(api.getSelectors().customExtra.extraElements) === JSON.stringify(extraDef.extraElements));
const disabledExtra = api.parseSelectorText(api.serializeSelectors());
check('选择器-088: 禁用配置往返保留关联配置', disabledExtra.config.customExtra.disabled && api.sameSelectorDef(disabledExtra.config.customExtra, extraDef));
api.setStore({ duckduckgo_lite: { disabled: true } });
const disabledLite = api.parseSelectorText(api.serializeSelectors());
check('选择器-089: 禁用内置Lite往返保留关联配置', disabledLite.config.duckduckgo_lite.extraElements.length === 3);
api.setHost('lite.duckduckgo.com');
check('选择器-090: 禁用Lite不回退普通DDG', api.getSearchEngine() === 'other');
api.setStore({});
const liteDef = api.getSelectors().duckduckgo_lite;
check('选择器-091: 未改动Lite不固化', !api.diffUserSelectors({ duckduckgo_lite: liteDef }).duckduckgo_lite);
check('选择器-092: 清空关联配置属于有效修改', !!api.diffUserSelectors({ duckduckgo_lite: { ...liteDef, extraElements: [] } }).duckduckgo_lite);
check('选择器-093: 缺省与空关联相等', api.sameSelectorDef(CUSTOM.mysearx, { ...CUSTOM.mysearx, extraElements: [] }));
api.setStore({ duckduckgo_lite: { ...liteDef, match: liteDef.match.source, extraElements: [] } });
check('选择器-094: 覆盖可清空内置关联', api.getSelectors().duckduckgo_lite.extraElements.length === 0);
const parseCondition = new Function(extractFn(src, 'hostLabelToASCII') + extractFn(src, 'toASCIIHostname') + extractFn(src, 'parseConditionPart') + '; return parseConditionPart;')();
for (const [i, id] of ['duckduckgo', 'ddg', 'duckduckgo_lite'].entries()) {
  check(`选择器-095-${i + 1}: Lite条件匹配 ${id}`, parseCondition('$site=' + id, 'duckduckgo_lite', 'lite.duckduckgo.com').static === true);
}
check('选择器-096: 专有ID不匹配普通DDG', parseCondition('$site=duckduckgo_lite', 'duckduckgo', 'duckduckgo.com').static === false);
})();

// ==== [选择器-097~114] 选择器导入 (来源: test-selector-import.cjs) ====
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
  assert('选择器-098: input 已加入 DOM', env.bodyChildren.includes(fakeInput));
  fakeInput.files = [{ _content: 'myx: {}' }];
  fakeInput.onchange({ target: fakeInput });
  assert('选择器-099: 文件内容写入编辑区', textarea.value === 'myx: {}');
  assert('选择器-100: 导入回调在写入后触发', env.events.join('|') === 'value|loaded:myx: {}');
  assert('选择器-101: 读取完成后解锁', api.isPreventPanelClose() === false);
  assert('选择器-102: 读取完成后移除 input', !env.bodyChildren.includes(fakeInput));
}

// 2. 取消选择
{
  const { env, api, fakeInput, textarea } = createEnv();
  api.importSelectorsFromFile(textarea, () => env.events.push('loaded'));
  fakeInput.listeners.cancel[0]();
  assert('选择器-103: cancel 后解锁并移除 input', api.isPreventPanelClose() === false && !env.bodyChildren.includes(fakeInput));
  assert('选择器-104: cancel 不触发导入回调', env.events.length === 0);
}

// 3. onchange 但未选中文件
{
  const { env, api, fakeInput, textarea } = createEnv();
  api.importSelectorsFromFile(textarea, () => env.events.push('loaded'));
  fakeInput.onchange({ target: { files: [] } });
  assert('选择器-105: 未选择文件时解锁并移除 input', api.isPreventPanelClose() === false && !env.bodyChildren.includes(fakeInput));
  assert('选择器-106: 未选择文件不触发导入回调', env.events.length === 0);
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
  assert('选择器-111: 焦点兜底监听已注册', window.listeners.focus && window.listeners.focus.length === 1);
  window.listeners.focus.forEach((fn) => fn());
  await new Promise((r) => setTimeout(r, 350));
  assert('选择器-112: 焦点回落无文件时解锁并移除 input', api.isPreventPanelClose() === false && !env.bodyChildren.includes(fakeInput));
  assert('选择器-113: 焦点兜底触发后解绑', window.listeners.focus.length === 0);
}

// 7. 面板接线: 导入后刷新行号
assert('选择器-114: 面板导入回调刷新行号', /importSelectorsFromFile\(textarea, \(\) => \{\s*showError\(\[\]\);\s*updateSelLineNumbers\(\);/.test(src));
})();

// ==== [选择器-115~133] DOM增量扫描 (来源: test-dom-scan.cjs) ====
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
  check('选择器-121: 清理后已观察集合全部匹配当前选择器', env.elements.filter((e) => e.observed).every((e) => e.matches('.a')));

  const before = { a1: a1.unobserveCount, b1: b1.unobserveCount, b2: b2.unobserveCount };
  api.scanNewResults();
  check('选择器-122: 选择器未变化不重复清理', a1.unobserveCount === before.a1 && b1.unobserveCount === before.b1 && b2.unobserveCount === before.b2);

  // ---- 禁用时清空观察集合 ----
  api.setEnabled(false);
  api.scanNewResults();
  check('选择器-123: 禁用时清空观察集合并重置记录', env.elements.every((e) => !e.observed) && api.getObservedSelector() === '');
  check('选择器-124: 禁用时关闭隐藏结果显示', api.getShowHidden() === false);
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
  check('选择器-132: 多候选增量扫描也排除纯包装', !filterFn([wrapper, plain], 'div.g').includes(wrapper));
  wrapper.querySelectorAll = sel => sel === 'a[href]' ? [wrapLink, ownLink] : [wsub];
  check('选择器-133: 增量扫描保留真正独立链接', filterFn([wrapper], 'div.g').includes(wrapper));
}
})();

// ==== [选择器-134~183] 引擎站装配拆卸与跨页同步 (来源: test-engine-lifecycle.cjs) ====
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
  env.api.injectGlobalStyles();
  check('选择器-137: 移除后可再次注入', env.stats.addStyleCalls === 2);
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

{
  const styleEl = { removeCalls: 0, remove() { this.removeCalls++; } };
  const env = createStyleEnv(styleEl);
  env.api.setEngine('other');
  env.api.injectGlobalStyles();
  check('选择器-141: other 引擎不注入布局样式', env.stats.addStyleCalls === 0 && env.api.getStyleEl() === null);
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

// ---- KI: 已知问题修复验证 ----
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
    `)({ observe(el) { el.observeCount = (el.observeCount || 0) + 1; } }, timers);
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
    check('选择器-165: 重试触发后重新观察结果', el.observeCount === 1 && el.hasAttribute('data-observed') === false);
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
    check('选择器-170: 超过上限停止重试并标记完成', timers.length === 3 && el.hasAttribute('data-blocker-processed') === true && !api.hasCount(el));
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

// ==== [选择器-184~193] 引擎检测与全站门控 (来源: test-engine.cjs) ====
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

for (const [i, [host, expected]] of cases.entries()) {
  const w = { location: { hostname: host } };
  const got = factory(w, selectors).getSearchEngine();
  assert(`选择器-184-${i + 1}: ${host} -> ${expected}`, got === expected);
}

assert('选择器-185: SELECTORS键序为引擎检测顺序', JSON.stringify(Object.keys(selectors)) === JSON.stringify(['bing', 'google_scholar', 'google', 'duckduckgo_lite', 'duckduckgo', 'yandex', 'brave', 'yahoo', 'other']));
assert('选择器-186: 缓存:同hostname二次调用返回相同结果', factory({ location: { hostname: 'www.google.com' } }, selectors).getSearchEngine() === 'google');
assert('选择器-187: 内置引擎不因URL尾部误判(google查询含.bing.com)', factory({ location: { hostname: 'www.google.com', href: 'https://www.google.com/search?q=x.bing.com' } }, selectors).getSearchEngine() === 'google');
assert('选择器-188: 内置引擎不因URL尾部误判(普通站查询含.bing.com)', factory({ location: { hostname: 'example.com', href: 'https://example.com/?ref=x.bing.com' } }, selectors).getSearchEngine() === 'other');
assert('选择器-189: 空href/hostname返回other而非缓存哨兵', factory({ location: { hostname: '', href: '' } }, selectors).getSearchEngine() === 'other');
assert('选择器-190: 空href/hostname门控为普通站', gateFactory({ location: { hostname: '', href: '' } }, selectors)() === false);

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
for (const [i, [loc, expected]] of catCases.entries()) {
  const got = factory({ location: loc }, selectors).getSearchCategory(loc);
  assert(`选择器-191-${i + 1}: category ${loc.hostname}${loc.pathname}${loc.search} -> ${expected}`, got === expected);
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

assert('选择器-192: 头部包含 @match *://*/* (全站注入)', matchLines.includes('*://*/*'));

for (const [i, host] of hosts.entries()) {
  const eng = detectEngine(host);
  const gated = gateFactory({ location: { hostname: host } }, selectors)();
  assert(`选择器-193-${i + 1}: ${host}: 引擎判定(${eng})与门控(${gated})一致`, gated === (eng !== 'other'));
}
})();

// ==== [选择器-194~213] 跨标签页同步锁 / 菜单注册 / 结果摘要后备提取 ====
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
  check('选择器-205: 非引擎站点仅显示4个菜单项', nonEngineMenus.length === 4);
  check('选择器-206: 非引擎站点包含打开面板', nonEngineMenus[0] === 'menuOpenPanel');
  check('选择器-207: 非引擎站点包含自定义选择器', nonEngineMenus[1] === 'menuCustomSelectors');
  check('选择器-208: 非引擎站点包含自定义颜色', nonEngineMenus[2] === 'menuHighlightColor');
  check('选择器-209: 非引擎站点包含语言切换', nonEngineMenus[3].includes('menuLang'));

  const engineMenus = runMenuTest(true);
  check('选择器-210: 引擎站点显示全部8个菜单项', engineMenus.length === 8);
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
    extractFn(src, 'getInvalidRegexFlags') + '\n' + extractFn(src, 'parseSelectorText') +
    '\nreturn parseSelectorText;'
  )();
  // JSON 风格 \uXXXX 转义正常解码
  const R13 = parseSelectorText('{"e13":{"match":"a","containers":"div\\u002Eresult"}}');
  check('选择器-214: JSON \\uXXXX 转义正常解码为字面字符', !!R13.config && R13.config.e13.containers === 'div.result');
  // __proto__ 键安全跳过不污染原型
  const R14 = parseSelectorText('__proto__: { match: "a", containers: ".x" }');
  check('选择器-215: __proto__ 键安全过滤且不污染对象', !R14.errors.length && !!R14.config && !Object.hasOwn(R14.config, '__proto__') && Object.keys(R14.config).length === 0);
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

// ==== [选择器-221] 祖先容器不认领后代自有链接(嵌套结果漏处理修复回归) ====
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

// ==== [审查B-1~12] 回归: 父容器隐藏/恢复状态机 + bing cite 回退 ====
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
      const _hrefUrlCache = new WeakMap(), _resultContentCache = new WeakMap(), _resultRetryCounts = new WeakMap();
      const map_resultExtraElements = new WeakMap();
      function getResultExtraElements() { return []; }
      ${extractFn(src, 'saveOriginalDisplay')}
      ${extractFn(src, 'hideParentIfNoVisibleSiblings')}
      ${extractFn(src, 'resetResultStyles')}
      ${extractFn(src, 'restoreParentDisplay')}
      ${extractFn(src, 'restoreAllHiddenParents')}
      ${extractFn(src, 'reconcileHiddenParents')}
      ${extractFn(src, 'clearMatchedData')}
      ${extractFn(src, 'removeMatchedRuleLabel')}
      ${extractFn(src, 'restoreResultExtraElements')}
      const document = { querySelectorAll: (s) => doc.querySelectorAll(s) };
      return { saveOriginalDisplay, hideParentIfNoVisibleSiblings, resetResultStyles, restoreParentDisplay, restoreAllHiddenParents, reconcileHiddenParents };
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
    check('审查B-6: reset后父保持隐藏(另一子项仍屏蔽隐藏)', li.style.display === 'none' && li.hasAttribute('data-blocker-yandex-parent'));
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

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

})();
