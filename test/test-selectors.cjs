// 选择器与引擎: 合并/覆盖/序列化/校验 / 导入 / DOM扫描 / 装配拆卸与同步 / 引擎检测与门控 / 跨标签页锁 / 修复回归
// 命名规则: 选择器-三位序号: 描述
(async () => {
const fs = require('fs');
const path = require('path');
const scriptDir = path.join(__dirname, '..');
const scriptFiles = fs.readdirSync(scriptDir).filter((name) => name.endsWith('.js') && !name.toLowerCase().includes('lite')).sort();
if (!scriptFiles.length) throw new Error('no .js script found in ' + scriptDir);
const file = path.join(scriptDir, scriptFiles[0]);
console.log('Testing', file);
const src = fs.readFileSync(file, 'utf8');
const readRepoFile = (rel) => fs.readFileSync(['', 'Other', '文档'].map((d) => path.join(scriptDir, d, rel)).find((p) => fs.existsSync(p)), 'utf8');

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
    if (/scanRuleString\(|RULE_PREFIX_RE|RULE_PREFIX_REGEX_RE|RULE_LEADING_REGEX_RE|REGEX_CTX_[A-D]\b/.test(fn)) prelude.push(text.split('\n').filter((l) => /^\s*const (?:RULE_\w+|REGEX_CTX_[A-D]) =/.test(l)).map((l) => l.replace('const ', 'var ')).join('\n'), rawExtract(text, 'findBalancedParenEnd'), rawExtract(text, 'scanRuleString'), rawExtract(text, 'isBadRegexTail'), rawExtract(text, 'regexCloseAhead'));
    if (/encodeNonAscii\(/.test(fn)) prelude.push(rawExtract(text, 'encodeNonAscii'));
    if (/isUniqueFlagsStr\(|isFlagsCandidateError\(/.test(fn)) prelude.push(['isUniqueFlagsStr', 'isFlagsCandidateError'].map((n) => rawExtract(text, n)).join('\n'));
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
const storeRef = { current: undefined };
function GM_getValue(key, defaultValue) { return key === 'searchfilter_selectors' ? (storeRef.current === undefined ? defaultValue : storeRef.current) : defaultValue; }
const badCss = new Set(['div>>>', 'a[[', 'p:unknownpseudo(']);
global.document = { querySelector(selector) { if (badCss.has(selector)) { const e = new Error('invalid selector'); e.name = 'SyntaxError'; throw e; } return null; } };
const fns = ['normalizeSelectorList', 'mergeSelectorDef', 'getUserSelectors', 'getSelectors', 'resetSelectorCache', 'getSearchEngine', 'getSearchCategory', 'isBingImagesPage', 'isEngineSite', 'getContainerSelector', 'isValidCssSelector', 'hasPseudoElement', 'validateUserSelectors', 'getInvalidRegexFlags', 'regexSourceToLiteralText', 'escapeJsString', 'matchDefToParts', 'serializeSelectors', 'normalizeMatchLiteral', 'parseSelectorText', 'sameSelectorDef', 'diffSelectorDefFields', 'diffUserSelectors', 'pruneUserSelectors'].map((n) => extractFn(src, n));
const builtinSelectorOfLine = src.match(/const builtinSelectorOf = .+?;/);
if (!builtinSelectorOfLine) throw new Error('builtinSelectorOf not found');
const body = `
const WEBDAV_SYNC_SELECTORS_KEY = 'searchfilter_webdav_sync_selectors'; const SELECTORS_KEY = 'searchfilter_selectors';
const SUPPORTED_REGEX_FLAGS = 'imsu';
const SELECTORS = ${selectorsObjectText}; let activeSelectors = null; let _engineCacheHost = null;
${builtinSelectorOfLine[0]} let _engineCacheResult = 'other'; let _observedSelector = '';
const window = { location: { get hostname() { return currentHost; }, get href() { return currentHref; } } }; let currentHost = 'www.google.com'; let currentHref = 'https://www.google.com/';
function t(key, params = {}) { let text = key; for (const [k, v] of Object.entries(params || {})) text += ':' + v; return text; } function GM_setValue(key, value) { if (key === 'searchfilter_selectors') storeRef.current = value; }
${fns.join('\n')}
return { getSelectors, getUserSelectors, getSearchEngine, isEngineSite, getContainerSelector, validateUserSelectors, resetSelectorCache, normalizeSelectorList, serializeSelectors, parseSelectorText, diffUserSelectors, pruneUserSelectors, sameSelectorDef,
  setHost: (h) => { currentHost = h; currentHref = 'https://' + h + '/'; }, setHref: (h) => { currentHref = h; }, setStore: (obj) => { storeRef.current = obj; resetSelectorCache(); } };
`;
const api = new Function('GM_getValue', 'storeRef', body)(GM_getValue, storeRef);
const CUSTOM = { mysearx: { match: '(?:^|\\.)searx\\.example\\.com$', containers: '.result', titles: ['h3'], snippets: ['.content'], links: 'a[href]' } };

check('选择器-001: getContainerSelector 内置', api.getContainerSelector('bing') === 'li.b_algo, div.b_algo');
api.setStore({ google: { match: '(?:^|\\.)google\\.', containers: 'div.myg', titles: ['h3'], snippets: ['.s'], links: 'a[href]' } });
check('选择器-002: 覆盖后生效且未覆盖引擎不受影响', api.getContainerSelector('google') === 'div.myg' && api.getContainerSelector('bing') === 'li.b_algo, div.b_algo');
check('选择器-003: match 被编译为 RegExp', api.getSelectors().google.match instanceof RegExp);
api.setStore({ broken: { match: '([', containers: '.x', titles: [], snippets: [], links: 'a[href]' } });
api.setHost('broken.example');
check('选择器-004: 非法match不崩溃且不激活', api.getSearchEngine() === 'other' && api.getSelectors().broken.match === null);
api.setStore(CUSTOM);
api.setHost('searx.example.com');
check('选择器-005: setStore 后缓存失效重新合并', api.getSearchEngine() === 'mysearx');
check('选择器-006: 自定义引擎 isEngineSite 为真', api.isEngineSite() === true);
api.setStore({});
api.setHost('www.google.com');
api.setHref('https://www.google.com/search?q=x.bing.com');
check('选择器-007: 内置引擎不因URL尾部误判', api.getSearchEngine() === 'google');
api.setHost(''); api.setHref('');
check('选择器-008: 空href/hostname不误判为引擎站', api.getSearchEngine() === 'other' && api.isEngineSite() === false);
api.setStore(CUSTOM);
api.setHost('other.com');
api.setHref('https://other.com/?u=x.searx.example.com');
check('选择器-009: 自定义hostname正则不因URL尾部误判', api.getSearchEngine() === 'other');
api.setStore({ urlengine: { match: '^https://search\\.example\\.com/web', containers: '.r' } });
api.setHost('search.example.com');
api.setHref('https://search.example.com/web?q=1');
check('选择器-010: 自定义URL模式回退匹配href', api.getSearchEngine() === 'urlengine');
api.setHref('https://search.example.com/images?q=1');
check('选择器-011: URL模式未命中则回退other', api.getSearchEngine() === 'other');
check('选择器-012: 合法配置通过', api.validateUserSelectors(CUSTOM).length === 0);
check('选择器-013: 保留键报错', api.validateUserSelectors({ other: { match: 'a', containers: 'b' } }).some((m) => m.includes('other')));
check('选择器-014: 非法正则报错', api.validateUserSelectors({ e1: { match: '([', containers: '.x' } }).some((m) => m.includes('e1')));
check('选择器-015: 缺 containers/match 报错', api.validateUserSelectors({ e2: { match: 'a' } }).some((m) => m.includes('containers')) && api.validateUserSelectors({ e3: { containers: '.x' } }).some((m) => m.includes('match')));
check('选择器-016: 非法 CSS 报错', api.validateUserSelectors({ e4: { match: 'a', containers: 'div>>>', titles: ['a[['] } }).length === 2);
check('选择器-017: 非对象配置报错', api.validateUserSelectors([1, 2]).length === 1 && api.validateUserSelectors('x').length === 1);
check('选择器-018: containers 伪元素被拒且引号内不误报', api.validateUserSelectors({ e7: { match: 'a', containers: 'div::after' } }).length === 1 && api.validateUserSelectors({ e8: { match: 'a', containers: '[data-x="a::b"]' } }).length === 0);
check('选择器-019: titles/snippets/links 伪元素被拒且引号内不误报', api.validateUserSelectors({ p1: { match: 'a', containers: '.x', titles: ['h3::after'] } }).length === 1 && api.validateUserSelectors({ p2: { match: 'a', containers: '.x', snippets: ['.c::before'] } }).length === 1 && api.validateUserSelectors({ p3: { match: 'a', containers: '.x', links: 'a::after' } }).length === 1 && api.validateUserSelectors({ p4: { match: 'a', containers: '.x', titles: ['[data-k="a::b"]'] } }).length === 0);
check('选择器-020: 对象match非法flags报错且合法通过', api.validateUserSelectors({ e11: { match: { source: 'a', flags: 'q' }, containers: '.x' } }).length === 1 && api.validateUserSelectors({ e12: { match: { source: 'a', flags: 'i' }, containers: '.x' } }).length === 0);
check('选择器-021: 字符串match写成/re/g被拒且合法字面量通过', api.validateUserSelectors({ f1: { match: '/a/g', containers: '.x' } }).some((m) => m.includes('invalidRegexFlags')) && api.validateUserSelectors({ f2: { match: '/a/i', containers: '.x' } }).length === 0);
check('选择器-022: titles字符串简写合法且links非法类型报错', api.validateUserSelectors({ e5: { match: 'a', containers: '.x', titles: 'h3', snippets: '.c' } }).length === 0 && api.validateUserSelectors({ e6: { match: 'a', containers: '.x', links: 123 } }).length === 1);
const P1 = api.serializeSelectors();
const R1 = api.parseSelectorText(P1);
check('选择器-023: 序列化→解析往返一致', /bing:\s*\{/.test(P1) && /match: \//.test(P1) && !R1.errors.length && !!R1.config && R1.config.bing.match === api.getSelectors().bing.match.source && R1.config.google.containers === 'div.g, div.MjjYud');
const R3 = api.parseSelectorText('{"e9":{"match":"a","containers":".x"}}');
check('选择器-024: 兼容旧JSON', !R3.errors.length && !!R3.config && R3.config.e9.match === 'a');
const R4 = api.parseSelectorText('e8: { match: /a[/ }');
const R5 = api.parseSelectorText('e7: { match: /a/q }');
check('选择器-025: 未闭合正则/非法flags解析报错', R4.config === null && R4.errors.length === 1 && R5.config === null && R5.errors.length === 1);
api.setStore({ flg: { match: { source: 'a\\/b', flags: 'i' }, containers: '.x', titles: [], snippets: [], links: 'a[href]' } });
const P2 = api.serializeSelectors();
const R9 = api.parseSelectorText(P2);
check('选择器-026: match flags 序列化→解析往返保留并过校验', P2.includes('match: /a\\/b/i') && !R9.errors.length && R9.config.flg.match.source === 'a\\/b' && R9.config.flg.match.flags === 'i' && api.validateUserSelectors(R9.config).length === 0);
const R9u = api.parseSelectorText('z3: { match: /abc/I, containers: ".x" }');
check('选择器-027: 解析时大写flags归一为小写', !R9u.errors.length && R9u.config.z3.match.flags === 'i' && api.validateUserSelectors(R9u.config).length === 0);
api.setStore({ 'my-engine': { match: { source: 'a', flags: '' }, containers: '.r', titles: [], snippets: [], links: 'a[href]' } });
const P4 = api.serializeSelectors();
const R15 = api.parseSelectorText(P4);
check('选择器-028: 连字符键输出带引号且为合法JS字面量', P4.includes("'my-engine': {") && (() => { try { const o = new Function('const SELECTORS = {' + P4 + '}; return SELECTORS;')(); return !!(o && o['my-engine'] && o.bing); } catch (e) { return false; } })());
check('选择器-029: 连字符键往返一致且过校验', !R15.errors.length && !!R15.config && !!R15.config['my-engine'] && R15.config['my-engine'].containers === '.r' && api.validateUserSelectors(R15.config).length === 0);
api.setHost('www.bing.com');
api.setStore({ bing: { match: '(?:^|\\.)bing\\.', containers: 'div.my-bing', titles: ['h2'], snippets: ['.s'], links: 'a[href]' } });
check('选择器-030: 同ID覆盖:容器使用用户选择器', api.getContainerSelector('bing') === 'div.my-bing');
api.setStore({ google: { match: '(?:^|\\.)google\\.', containers: 'div.g' }, google_scholar: { match: '(?:^|\\.)scholar\\.google\\.', containers: 'div.gs_r' } });
api.setHost('scholar.google.com');
check('选择器-031: 用户同时配置google与google_scholar时学者优先', api.getSearchEngine() === 'google_scholar');
api.setStore({});
const allBuiltins = {};
for (const k of ['bing', 'google', 'duckduckgo', 'yandex', 'brave', 'yahoo']) {
  const m = api.getSelectors()[k];
  allBuiltins[k] = { match: m.match.source, containers: m.containers, titles: m.titles.slice(), snippets: m.snippets.slice(), links: m.links };
}
const bingCopy = allBuiltins.bing;
check('选择器-032: 未改动键丢弃/改动键保留/新增键保留', !('bing' in api.diffUserSelectors(allBuiltins)) && 'bing' in api.diffUserSelectors(Object.assign({}, allBuiltins, { bing: Object.assign({}, bingCopy, { containers: '.x' }) })) && 'myx' in api.diffUserSelectors(Object.assign({}, allBuiltins, { myx: { match: 'a', containers: '.x' } })));
check('选择器-033: 缺失内置键视为未改动/other始终丢弃/空配置无disabled', !('yahoo' in api.diffUserSelectors({ bing: bingCopy })) && !('other' in api.diffUserSelectors(Object.assign({}, allBuiltins, { other: { match: 'a', containers: '.x' } }))) && Object.keys(api.diffUserSelectors({})).length === 0);
check('选择器-034: 显式 disabled 标记被保留', (() => { const d = api.diffUserSelectors(Object.assign({}, allBuiltins, { yahoo: Object.assign({}, allBuiltins.yahoo, { disabled: true }) })); return d.yahoo && d.yahoo.disabled === true; })());
api.setStore({ yahoo: { disabled: true } });
check('选择器-035: disabled 内置引擎不被加载也不匹配站点', api.getSelectors().yahoo.disabled === true && (() => { api.setHost('search.yahoo.com'); const r = api.getSearchEngine() === 'other'; api.setHost('www.google.com'); return r; })());
const P3 = api.serializeSelectors();
const R10 = api.parseSelectorText(P3);
check('选择器-036: disabled 序列化往返保留定义与标记且校验通过', /yahoo:\s*\{/.test(P3) && P3.includes('disabled: true') && !R10.errors.length && R10.config.yahoo.disabled === true && api.validateUserSelectors(R10.config).length === 0);
check('选择器-037: 禁用块/别名解析且校验通过', (() => { const r1 = api.parseSelectorText('z1: { disabled: true }'); const r2 = api.parseSelectorText('z7: { disable: true }'); return !r1.errors.length && r1.config.z1.disabled === true && !r2.errors.length && r2.config.z7.disable === true; })());
check('选择器-038: disabled:false 单独为显式恢复不报错, 完整定义仍按普通校验', api.validateUserSelectors({ z2: { disabled: false } }).length === 0 && api.validateUserSelectors({ z6: { disabled: false, containers: '.x' } }).some((m) => m.includes('match')));
check('选择器-039: sameSelectorDef 兼容字符串/RegExp/对象形态且flags参与比较', api.sameSelectorDef({ match: 'a.b', containers: '.x', titles: [], snippets: [], links: 'a[href]' }, { match: /a.b/, containers: '.x', titles: [], snippets: [], links: 'a[href]' }) && api.sameSelectorDef({ match: { source: 'a.b', flags: '' }, containers: '.x', titles: [], snippets: [], links: 'a[href]' }, { match: /a.b/, containers: '.x', titles: [], snippets: [], links: 'a[href]' }) && !api.sameSelectorDef({ match: { source: 'a.b', flags: 'i' }, containers: '.x', titles: [], snippets: [], links: 'a[href]' }, { match: /a.b/, containers: '.x', titles: [], snippets: [], links: 'a[href]' }));
check('选择器-040: disable:true 别名校验通过且 disabled/disable 非布尔被拒', api.validateUserSelectors({ z4: { disable: true } }).length === 0 && api.validateUserSelectors({ z10: { match: 'a', containers: '.x', disabled: 'true' } }).some((m) => m.includes('disabled')) && api.validateUserSelectors({ z11: { match: 'a', containers: '.x', disable: 'false' } }).some((m) => m.includes('disable')));
api.setStore({ bing: { disabled: 'false' } });
check('选择器-041: 存储里 disabled 为字符串 false 不误禁用引擎', api.getSelectors().bing.disabled !== true);
check('选择器-042: diff disable:true 归一为 disabled 且 disable:false 被丢弃', api.diffUserSelectors({ bing: { disable: true } }).bing.disabled === true && Object.keys(api.diffUserSelectors({ bing: { disable: false } })).length === 0);
api.setStore({ bing: { disable: true } });
check('选择器-043: disable:true 引擎被停用且 disable:false 空覆盖不破坏内置', (() => { api.setHost('www.bing.com'); const r = api.getSearchEngine() === 'other'; api.setStore({ bing: { disable: false } }); return r && api.getSearchEngine() === 'bing' && api.getContainerSelector('bing') === 'li.b_algo, div.b_algo'; })());
api.setStore({});
storeRef.current = { bing: JSON.parse(JSON.stringify(bingCopy)), myse: { match: 'a', containers: '.x' } };
api.resetSelectorCache();
api.pruneUserSelectors();
check('选择器-044: 旧版固化的内置副本被清理', storeRef.current && !('bing' in storeRef.current) && !!storeRef.current.myse);
const extraDef = { ...CUSTOM.mysearx, extraElements: ['+ .summary', '~ .metadata'] };
api.setStore({ customExtra: extraDef });
const extraRoundTrip = api.parseSelectorText(api.serializeSelectors());
check('选择器-045: 关联选择器合并保留且往返一致且校验通过', JSON.stringify(api.getSelectors().customExtra.extraElements) === JSON.stringify(extraDef.extraElements) && !extraRoundTrip.errors.length && api.sameSelectorDef(extraRoundTrip.config.customExtra, extraDef) && api.validateUserSelectors({ customExtra: extraDef }).length === 0);
for (const value of ['+ tr', ['+ tr, body'], ['+ tr::after']]) check(`选择器-046: 非法关联配置被拒 ${JSON.stringify(value)}`, api.validateUserSelectors({ customExtra: { ...extraDef, extraElements: value } }).some((e) => e.includes('extraElements')));
check('选择器-047: disabled配置仍校验关联CSS且禁用分支往返保留', api.validateUserSelectors({ customExtra: { disabled: true, extraElements: ['+ tr, body'] } }).length === 1 && (() => { api.setStore({ customExtra: { ...extraDef, disabled: true } }); const r = api.parseSelectorText(api.serializeSelectors()); api.setStore({}); return r.config.customExtra.disabled && api.sameSelectorDef(r.config.customExtra, { ...extraDef, disabled: true }); })());
const liteDef = api.getSelectors().duckduckgo_lite;
check('选择器-048: 清空关联配置属有效修改/缺省与空相等/覆盖可清空内置关联', !!api.diffUserSelectors({ duckduckgo_lite: { ...liteDef, extraElements: [] } }).duckduckgo_lite && api.sameSelectorDef(CUSTOM.mysearx, { ...CUSTOM.mysearx, extraElements: [] }) && (() => { api.setStore({ duckduckgo_lite: { ...liteDef, match: liteDef.match.source, extraElements: [] } }); const r = api.getSelectors().duckduckgo_lite.extraElements.length === 0; api.setStore({}); return r; })());
const parseCondition = new Function(extractFn(src, 'hostLabelToASCII') + extractFn(src, 'toASCIIHostname') + extractFn(src, 'parseConditionPart') + '; return parseConditionPart;')();
check('选择器-049: 主站条件不匹配Lite且Lite条件匹配专有ID', parseCondition('$site=duckduckgo', 'duckduckgo_lite', 'lite.duckduckgo.com').static === false && parseCondition('$site=duckduckgo_lite', 'duckduckgo_lite', 'lite.duckduckgo.com').static === true && parseCondition('$site=duckduckgo_lite', 'duckduckgo', 'duckduckgo.com').static === false);
})();

// ---- 选择器导入 ----
await (async () => {
function createEnv() {
  const env = { bodyChildren: [], events: [], input: null };
  const fakeInput = {
    type: '', accept: '', style: {}, files: [], parentElement: null, onchange: null, listeners: {},
    addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); },
    remove() { const idx = env.bodyChildren.indexOf(this); if (idx !== -1) env.bodyChildren.splice(idx, 1); this.parentElement = null; },
    click() {},
  };
  env.input = fakeInput;
  const documentStub = { body: { appendChild(el) { el.parentElement = documentStub.body; env.bodyChildren.push(el); return el; } }, createElement: (tag) => (tag === 'input' ? fakeInput : {}) };
  class FakeFileReader {
    readAsText(f) { if (f._error) { if (this.onerror) this.onerror(new Error('read fail')); return; } this.result = f._content; if (this.onload) this.onload({ target: this }); }
  }
  const textarea = { _value: '', get value() { return this._value; }, set value(v) { this._value = v; env.events.push('value'); } };
  const windowStub = {
    listeners: {},
    addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); },
    removeEventListener(type, fn) { const arr = this.listeners[type]; if (!arr) return; const idx = arr.indexOf(fn); if (idx !== -1) arr.splice(idx, 1); },
  };  const factory = new Function('document', 'FileReader', 'textarea', 'window', `
    let preventPanelClose = false; const t = (key) => key;
    const toasts = []; function showToast(msg, type) { toasts.push([msg, type]); }
    ${extractFn(src, 'pickTextFile')}
    ${extractFn(src, 'importSelectorsFromFile')}
    return { importSelectorsFromFile, isPreventPanelClose: () => preventPanelClose, toasts };
  `);
  return { env, api: factory(documentStub, FakeFileReader, textarea, windowStub), fakeInput, textarea, window: windowStub };
}
{
  const { env, api, fakeInput, textarea } = createEnv();
  api.importSelectorsFromFile(textarea, () => env.events.push('loaded:' + textarea.value));
  assert('选择器-050: 打开文件选择后锁定面板关闭', api.isPreventPanelClose() === true);
  fakeInput.files = [{ _content: 'myx: {}' }];
  fakeInput.onchange({ target: fakeInput });
  assert('选择器-051: 文件内容写入编辑区且回调在写入后触发', textarea.value === 'myx: {}' && env.events.join('|') === 'value|loaded:myx: {}');
}
{
  const { env, api, fakeInput } = createEnv();
  api.importSelectorsFromFile(null, () => {});
  fakeInput.listeners.cancel[0]();
  assert('选择器-052: cancel 后解锁并移除 input', api.isPreventPanelClose() === false && !env.bodyChildren.includes(fakeInput));
}
{
  const { env, api, fakeInput } = createEnv();
  api.importSelectorsFromFile(null, () => {});
  fakeInput.onchange({ target: { files: [] } });
  assert('选择器-053: 未选择文件时解锁并移除 input', api.isPreventPanelClose() === false && !env.bodyChildren.includes(fakeInput));
}
{
  const { env, api, fakeInput } = createEnv();
  api.importSelectorsFromFile(null, () => env.events.push('loaded'));
  fakeInput.files = [{ _error: true }];
  fakeInput.onchange({ target: fakeInput });
  assert('选择器-054: 读取失败解锁且不触发回调并弹错误通知', api.isPreventPanelClose() === false && !env.bodyChildren.includes(fakeInput) && env.events.length === 0 && api.toasts.length === 1 && api.toasts[0][0] === 'fileImportFailed' && api.toasts[0][1] === 'error');
}
{
  const { api, fakeInput, textarea } = createEnv();
  api.importSelectorsFromFile(textarea);
  fakeInput.files = [{ _content: 'x: {}' }];
  fakeInput.onchange({ target: fakeInput });
  assert('选择器-055: 未传回调时仍写入并解锁', textarea.value === 'x: {}' && api.isPreventPanelClose() === false);
}
{
  const { env, api, fakeInput, window } = createEnv();
  api.importSelectorsFromFile(null, () => env.events.push('loaded'));
  window.listeners.focus.forEach((fn) => fn());
  await new Promise((r) => setTimeout(r, 350));
  assert('选择器-056: 焦点回落无文件时兜底解锁并解绑', api.isPreventPanelClose() === false && !env.bodyChildren.includes(fakeInput) && window.listeners.focus.length === 0);
}
assert('选择器-057: 面板导入回调刷新行号', /importSelectorsFromFile\(textarea, \(\) => \{\s*showError\(\[\]\);\s*updateLineNumbers\('selectors'\);/.test(src));
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
    function getSearchEngine() { return 'test'; } function getContainerSelector() { return currentSelector; }
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
  const a2 = makeEl('li', 'a', false);
  makeEl('div', 'b', false);
  api.queryUnobserved('.a, .b');
  check('选择器-058: :is 包裹整组选择器且已观察元素不重复命中', env.queries.includes(':is(.a, .b):not([data-observed])') && !a1.observeCount);
  api.scanNewResults();
  check('选择器-059: 初始扫描观察新元素并保留已观察', a2.observed && a2.observeCount === 1 && a1.unobserveCount === 0);
  api.resetSelectorCache();
  api.setSelector('.a');
  api.scanNewResults();
  check('选择器-060: 收窄选择器清理不再匹配元素并保留仍匹配元素', b1.observed === false && b1.unobserveCount === 1 && b1.resetCount === 1 && a1.observed === true && a1.unobserveCount === 0);
  api.setEnabled(false);
  api.scanNewResults();
  check('选择器-061: 禁用时清空观察集合并复位记录', env.elements.every((e) => !e.observed) && api.getObservedSelector() === '');
}
{
  const { api, makeEl } = createEnv();
  const stale = makeEl('div', 'x', true);
  const btn = { removed: 0, remove() { this.removed++; } };
  stale.quickBtn = btn;
  api.clearStaleObserved('.a');
  check('选择器-062: 清理陈旧元素移除快捷屏蔽按钮', btn.removed === 1 && stale.observed === false && stale.resetCount === 1);
  const bad = makeEl('div', 'y', true);
  bad.matches = () => { throw new Error('bad selector'); };
  api.clearStaleObserved('.a');
  check('选择器-063: matches 异常按陈旧处理且不崩溃', bad.observed === false && bad.unobserveCount === 1);
}
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
  check('选择器-064: 聚合块外层自带独立链接时保留评估', kept.includes(outer) && kept.includes(sub1) && kept.includes(sub2) && kept.includes(plain));
  const wrapLink = { id: 'wrap-link' };
  const wsub = makeNode([], [wrapLink]);
  const wrapper = makeNode([wsub], [wrapLink]);
  const kept2 = filterFn([wrapper, wsub], 'div.g');
  check('选择器-065: 纯包装外层仍被丢弃', !kept2.includes(wrapper) && kept2.includes(wsub));
  const weird = { querySelector() { throw new Error('bad'); }, querySelectorAll() { throw new Error('bad'); }, contains() { return false; } };
  check('选择器-066: 选择器异常时不崩溃', filterFn([weird], 'div.g').length === 1);
}
})();

// ---- 引擎站装配拆卸与跨页同步 ----
await (async () => {
const refreshEngineSiteFn = extractFn(src, 'refreshEngineSite');
const getSelectorStoreSignatureFn = extractFn(src, 'getSelectorStoreSignature');
const checkExternalSelectorChangeFn = extractFn(src, 'checkExternalSelectorChange');

function createStyleEnv(returnValue) {
  const styleEl = { removeCalls: 0, remove() { this.removeCalls++; } };
  const stats = { addStyleCalls: 0, widgetCalls: 0 };
  const state = { engine: 'google' };
  function GM_addStyle() { stats.addStyleCalls++; return returnValue; }
  function injectWidgetStyles() { stats.widgetCalls++; }
  const api = new Function('GM_addStyle', 'injectWidgetStyles', 'state', `
    const LAYOUT_CSS = 'body{}'; const SELECTORS = { google: {}, bing: {} };
    let _globalStyleEl = null; function getSearchEngine() { return state.engine; }
    ${extractFn(src, 'injectGlobalStyles')}
    ${extractFn(src, 'removeGlobalStyles')}
    return { injectGlobalStyles, removeGlobalStyles, getStyleEl: () => _globalStyleEl, setEngine: (e) => { state.engine = e; } };
  `)(GM_addStyle, injectWidgetStyles, state);
  return { api, stats, styleEl };
}
{
  const styleEl = { removeCalls: 0, remove() { this.removeCalls++; } };
  const env = createStyleEnv(styleEl);
  env.api.injectGlobalStyles();
  check('选择器-067: 首次注入记录样式句柄且重复注入不重复添加', env.stats.addStyleCalls === 1 && env.stats.widgetCalls === 1 && env.api.getStyleEl() === styleEl);
  env.api.removeGlobalStyles();
  check('选择器-068: 移除后释放句柄并调用 remove', styleEl.removeCalls === 1 && env.api.getStyleEl() === null);
}
{
  const { api, stats } = createStyleEnv(undefined);
  let threw = false;
  try { api.injectGlobalStyles(); api.removeGlobalStyles(); api.injectGlobalStyles(); } catch (e) { threw = true; }
  check('选择器-069: GM_addStyle 无返回值时不崩溃', !threw && stats.addStyleCalls === 2 && api.getStyleEl() === null);
}
{
  const styleEl = { removeCalls: 0, remove() { this.removeCalls++; } };
  const env = createStyleEnv(styleEl);
  env.api.setEngine('mysearx');
  env.api.injectGlobalStyles();
  check('选择器-070: 自定义引擎不注入布局样式但注入组件样式', env.stats.addStyleCalls === 0 && env.stats.widgetCalls === 1 && env.api.getStyleEl() === null);
  env.api.setEngine('google');
  env.api.injectGlobalStyles();
  check('选择器-071: 自定义切内置时重新注入布局样式', env.stats.addStyleCalls === 1 && env.api.getStyleEl() === styleEl);
}

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
  const state = api.state();
  check('选择器-072: teardown 复位装配状态并终止残留批处理', state.setup === false && state.observer === null && observer.disconnectCalls === 1 && state.batchId === 6);
  check('选择器-073: teardown 清理已观察元素并复位显示与选择器记录', observed[0].unobserved === 1 && observed[0].removeAttributeCalls === 1 && state.showHidden === false && state.observedSelector === '');
  check('选择器-074: teardown 移除悬浮球与全局样式', statusEl.removed === 1 && counters.removeGlobalCalls === 1);
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
  check('选择器-076: 相同输入签名一致且空值按空串处理', sigApi.buildContentSignature('https://a.com/', 't', 's') === sigApi.buildContentSignature('https://a.com/', 't', 's') && sigApi.buildContentSignature(null, undefined, '') === sigApi.buildContentSignature('', '', ''));
  check('选择器-077: 内容变化导致签名变化', sigApi.buildContentSignature('https://a.com/', 't1', 's') !== sigApi.buildContentSignature('https://a.com/', 't2', 's') && sigApi.buildContentSignature('https://a.com/1', 't', 's') !== sigApi.buildContentSignature('https://a.com/2', 't', 's'));
  const c = { link: { href: 'https://a.com/x' }, title: '标题', snippet: '摘要' };
  const before = sigApi.getResultContentSignature(c);
  check('选择器-078: 结果签名包含 url/title/snippet', before === sigApi.buildContentSignature('https://a.com/x', '标题', '摘要'));
  c.title = '广告新标题';
  c.link = null;
  check('选择器-079: 容器变化后签名不同且链接缺失时url段为空', sigApi.getResultContentSignature(c) !== before && sigApi.getResultContentSignature(c) === sigApi.buildContentSignature('', '广告新标题', '摘要'));
  const bad = { link: { get href() { throw new Error('boom'); } }, title: 't', snippet: 's' };
  check('选择器-080: 提取异常返回 null 而不崩溃', sigApi.getResultContentSignature(bad) === null);
}

// reprocessContainer
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
    const { calls, api } = makeFactory("el.setAttribute('data-blocker-processed', 'true'); return true;");
    const el = makeContainer();
    el.staleBtn = { removed: 0, remove() { this.removed++; } };
    api.reprocessContainer(el);
    check('选择器-081: 重处理清理旧按钮并复位后重新判定且成功后不再重观察', el.staleBtn.removed === 1 && calls.reset === 1 && calls.process === 1 && calls.observe === 0 && el.getAttribute('data-observed') === 'true');
  }
  {
    const { calls, api } = makeFactory('return false;');
    const el2 = makeContainer();
    api.reprocessContainer(el2);
    check('选择器-082: 未标记完成时重新观察', calls.observe === 1 && el2.hasAttribute('data-observed') === false);
  }
  {
    const { calls, api } = makeFactory("throw new Error('boom');");
    const el = makeContainer();
    api.reprocessContainer(el);
    check('选择器-083: 重处理异常不标记完成且转交观察器重试', el.hasAttribute('data-blocker-processed') === false && calls.observe === 1);
    const gone = makeContainer(false);
    api.reprocessContainer(gone);
    check('选择器-084: 已脱离文档的容器不触发重处理', calls.process === 1);
  }
}

// scheduleResultRetry 有限次重试
{
  const retryFn = extractFn(src, 'scheduleResultRetry');
  const limitMatch = src.match(/const RESULT_RETRY_LIMIT = (\d+)/);
  const delayMatch = src.match(/RESULT_RETRY_DELAY = (\d+)/);
  check('选择器-085: 重试常量存在', !!limitMatch && !!delayMatch);
  function makeRetryEnv() {
    const timers = [];
    const api = new Function('resultObserver', 'timers', `
      let _engineSiteSetup = true; let _resultRetryCounts = new WeakMap();
      const RESULT_RETRY_LIMIT = ${limitMatch ? limitMatch[1] : 3};
      const RESULT_RETRY_DELAY = ${delayMatch ? delayMatch[1] : 200}; const setTimeout = (fn, ms) => { timers.push({ fn, ms }); return timers.length; };
      ${retryFn}
      return { scheduleResultRetry, hasCount: (el) => _resultRetryCounts.has(el) };
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
    check('选择器-086: 首次异常安排延迟重试且重试后保持 data-observed 不变量', timers.length === 1 && timers[0].ms === Number(delayMatch[1]) && (() => { timers[0].fn(); return el.observeCount === 1 && el.hasAttribute('data-observed') === true && api.hasCount(el); })());
  }
  {
    const { api, timers } = makeRetryEnv();
    const el = makeRetryEl();
    api.scheduleResultRetry(el);
    el.setAttribute('data-blocker-processed', 'true');
    timers[0].fn();
    check('选择器-087: 重试前已成功处理则不再重试', el.observeCount === undefined && !api.hasCount(el));
  }
  {
    const { api, timers } = makeRetryEnv();
    const el = makeRetryEl();
    el.isConnected = false;
    api.scheduleResultRetry(el);
    timers[0].fn();
    check('选择器-088: 结果脱离文档后放弃重试', !api.hasCount(el));
  }
  {
    const { api, timers } = makeRetryEnv();
    const el = makeRetryEl();
    api.scheduleResultRetry(el); api.scheduleResultRetry(el); api.scheduleResultRetry(el); api.scheduleResultRetry(el);
    check('选择器-089: 连续异常达到上限前不标记完成且超限后彻底放手', timers.length === 3 && el.hasAttribute('data-blocker-processed') === false && el.hasAttribute('data-observed') === false && el.unobserveCount === 1 && !api.hasCount(el));
  }
}

// 结果观察回调只保留一处重试调度(计数翻倍致永不达上限)
{
  const roStart = src.indexOf('const resultObserver = new IntersectionObserver(');
  const roSrc = src.slice(roStart, src.indexOf('function scheduleResultRetry', roStart));
  const liteRoSrc0 = readRepoFile('Lite.user.js');
  const liteRoStart = liteRoSrc0.indexOf('const resultObserver = new IntersectionObserver(');
  const liteRoSrc = liteRoSrc0.slice(liteRoStart, liteRoSrc0.indexOf('function scheduleResultRetry', liteRoStart));
  check('选择器-090: 回调内只保留一处 scheduleResultRetry(主版与Lite同步)', (roSrc.match(/scheduleResultRetry\(/g) || []).length === 1 && liteRoStart !== -1 && (liteRoSrc.match(/scheduleResultRetry\(/g) || []).length === 1);
}

// ensureEngineSiteSetup / refreshEngineSite
{
  function createEnsureEnv(engine) {
    const calls = { start: 0, inject: 0, build: 0, status: 0, scan: 0 };
    const api = new Function('calls', 'engine', `
      let _engineSiteSetup = false; let _domObserver = null;
      let _observedSelector = ''; let _searchForm = null;
      let _searchFormHandler = null; let _urlChangeHandler = null;
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
      let _engineSiteSetup = setup; function isEngineSite() { return engine; }
      function ensureEngineSiteSetup() { if (_engineSiteSetup) return; _engineSiteSetup = true; calls.ensure++; } function forceReprocessAll() { calls.force++; }
      function teardownEngineSite() { if (!_engineSiteSetup) return; _engineSiteSetup = false; calls.teardown++; } function injectGlobalStyles() { calls.layout++; }
      ${refreshEngineSiteFn}
      return { refreshEngineSite, getSetup: () => _engineSiteSetup };
    `)(calls, engine, setup);
    return { api, calls };
  }
  const { api, calls } = createEnsureEnv(true);
  api.ensureEngineSiteSetup();
  check('选择器-091: 引擎站装配不启动全站后台同步且重复装配幂等', calls.start === 0 && calls.inject === 1 && calls.scan === 1 && api.state().setup === true && (() => { api.ensureEngineSiteSetup(); return calls.scan === 1; })());
  const env2 = createEnsureEnv(false);
  env2.api.ensureEngineSiteSetup();
  check('选择器-092: 非引擎站不装配也不启动同步', env2.calls.start === 0 && env2.calls.inject === 0 && env2.api.state().setup === false);
  const a = createRefreshEnv(true, false); a.api.refreshEngineSite();
  const b = createRefreshEnv(false, true); b.api.refreshEngineSite();
  const c = createRefreshEnv(false, false); c.api.refreshEngineSite();
  check('选择器-093: 站点身份变化正确装配/拆卸/无操作', a.calls.ensure === 1 && a.calls.force === 1 && a.api.getSetup() === true && b.calls.teardown === 1 && b.api.getSetup() === false && c.calls.force === 0 && c.calls.teardown === 0);
}

// 跨标签页选择器变更检测
function createExternalEnv() {
  const state = { store: { a: 1 }, throwMode: false };
  const counters = { reset: 0, refresh: 0 };
  function GM_getValue() { if (state.throwMode) throw new Error('read fail'); return state.store; }
  const api = new Function('GM_getValue', 'counters', `
    const SELECTORS_KEY = 'searchfilter_selectors'; let _selectorStoreSignature = null;
    function resetSelectorCache() { counters.reset++; } function refreshEngineSite() { counters.refresh++; }
    ${getSelectorStoreSignatureFn}
    ${checkExternalSelectorChangeFn}
    return { checkExternalSelectorChange };
  `)(GM_getValue, counters);
  return { api, state, counters };
}
{
  const { api, state, counters } = createExternalEnv();
  check('选择器-094: 首次调用仅建立基线且未变化不重装配且变化后重装配', api.checkExternalSelectorChange() === false && (() => { const r = api.checkExternalSelectorChange() === false; state.store = { a: 2 }; return r && api.checkExternalSelectorChange() === true && counters.reset === 1 && counters.refresh === 1; })());
  check('选择器-095: 重装配后不重复且读取失败不误判为变更且恢复后继续检测', api.checkExternalSelectorChange() === false && (() => { state.throwMode = true; const r1 = api.checkExternalSelectorChange() === false && counters.reset === 1; state.throwMode = false; state.store = { a: 3 }; return r1 && api.checkExternalSelectorChange() === true && counters.reset === 2 && counters.refresh === 2; })());
}
})();

// ---- 引擎检测与全站门控 ----
await (async () => {
const header = src.slice(0, src.indexOf('==/UserScript=='));
const matchLines = [...header.matchAll(/^\/\/\s*@match\s+(\S+)/gm)].map((m) => m[1]);
const selectors = eval(`(${getSelectorsObjectText()})`);
const fnBody = extractFn(src, 'getSearchEngine');
const factory = new Function('window', 'SELECTORS', `let _engineCacheHost = null; let _engineCacheResult = 'other';
function getSelectors() { return SELECTORS; }
${fnBody}
${extractFn(src, 'getSearchCategory')}
return { getSearchEngine, getSearchCategory };`);
const gateFactory = new Function('window', 'SELECTORS', `let _engineCacheHost = null; let _engineCacheResult = 'other';
function getSelectors() { return SELECTORS; }
${fnBody}
${extractFn(src, 'isEngineSite')}
return isEngineSite;`);

// 每引擎保留代表与别名/TLD形态, 边界保留 wwwN上限/前缀不命中/后缀攻击/子域服务排除
const cases = [
  ['www.bing.com', 'bing'], ['www5.bing.com', 'other'],
  ['duckduckgo.com', 'duckduckgo'], ['ddg.gg', 'duckduckgo'],
  ['lite.duckduckgo.com', 'duckduckgo_lite'], ['lite.ddg.gg', 'other'],
  ['google.com', 'google'], ['www.google.co.jp', 'google'], ['google.events', 'google'],
  ['scholar.google.com', 'google_scholar'], ['mail.google.com', 'other'],
  ['yandex.ru', 'yandex'], ['search.brave.com', 'brave'],
  ['www.ecosia.org', 'ecosia'], ['ecosia.org.evil.com', 'other'],
  ['www.startpage.com', 'startpage'], ['app.startpage.com', 'other'], ['startpage.com.evil.com', 'other'],
  ['search.yahoo.com', 'yahoo'], ['example.com', 'other'], ['notgoogle.com', 'other'],
];
for (const [i, [host, expected]] of cases.entries()) assert(`选择器-096-${i + 1}: ${host} -> ${expected}`, factory({ location: { hostname: host } }, selectors).getSearchEngine() === expected);

{
  const cacheWin = { location: { hostname: 'www.google.com', href: 'https://www.google.com/' } };
  const cacheEnv = factory(cacheWin, selectors);
  const first = cacheEnv.getSearchEngine();
  cacheWin.location.hostname = 'www.bing.com';
  cacheWin.location.href = 'https://www.bing.com/';
  assert('选择器-097: 缓存命中且cacheKey变化后重新计算', first === 'google' && cacheEnv.getSearchEngine() === 'bing');
}

// 搜索分类检测(每引擎保留代表)
const catCases = [
  [{ hostname: 'www.google.com', pathname: '/search', search: '?q=x' }, 'web'],
  [{ hostname: 'www.google.com', pathname: '/search', search: '?udm=7' }, 'videos'],
  [{ hostname: 'www.bing.com', pathname: '/images/search', search: '?q=x' }, 'images'],
  [{ hostname: 'duckduckgo.com', pathname: '/', search: '?iax=images' }, 'images'],
  [{ hostname: 'images.search.yahoo.com', pathname: '/search/images', search: '?p=x' }, 'images'],
  [{ hostname: 'search.yahoo.co.jp', pathname: '/image/search', search: '?p=x' }, 'images'],
  [{ hostname: 'www.startpage.com', pathname: '/sp/search', search: '?query=x&cat=images' }, 'images'],
  [{ hostname: 'www.startpage.com', pathname: '/sp/search', search: '?query=x&category=images' }, 'web'],
  [{ hostname: 'so.toutiao.com', pathname: '/search', search: '?keyword=x&pd=video' }, 'videos'],
  [{ hostname: 'so.toutiao.com', pathname: '/search', search: '?keyword=x&pd=synthesis' }, 'web'],
];
for (const [i, [loc, expected]] of catCases.entries()) assert(`选择器-098-${i + 1}: category ${loc.hostname}${loc.pathname}${loc.search} -> ${expected}`, factory({ location: loc }, selectors).getSearchCategory(loc) === expected);
{
  const liteCat = new Function(extractFn(readRepoFile('Lite.user.js'), 'getSearchCategory') + '\nreturn getSearchCategory;')();
  const bad = catCases.filter(([loc, expected]) => liteCat(loc) !== expected);
  assert('选择器-099: Lite 分类口径与主脚本一致', bad.length === 0, bad.map(([loc, expected]) => loc.hostname + loc.pathname + loc.search + '=>' + liteCat(loc)));
}
assert('选择器-100: 头部包含 @match *://*/* (全站注入)', matchLines.includes('*://*/*'));
{
  function detectEngine(host) {
    for (const name of Object.keys(selectors)) { const def = selectors[name]; if (def && def.match && def.match.test(host)) return name; }
    return 'other';
  }
  const hosts = ['www.bing.com', 'ddg.gg', 'bing.com.evil.com', 'brave.com', 'app.startpage.com', 'www.ecosia.org'];
  for (const [i, host] of hosts.entries()) {
    const eng = detectEngine(host);
    const gated = gateFactory({ location: { hostname: host } }, selectors)();
    assert(`选择器-101-${i + 1}: ${host}: 引擎判定与门控一致`, gated === (eng !== 'other'));
  }
}
})();

// ---- 跨标签页同步锁 / 菜单 / 摘要后备 / 解析边界 ----
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
  `)((key, defaultValue) => (lockStore.has(key) ? lockStore.get(key) : defaultValue), (key, value) => lockStore.set(key, value), 'test_lock_', ttl, tabId);
}
{
  const tab1 = createLockEnv('tab-1');
  const tab2 = createLockEnv('tab-2');
  check('选择器-102: 首次抢占成功且他页抢占失败', tab1.tryAcquireSyncLock('t') === true && tab1.readSyncLock('t').owner === 'tab-1' && tab2.tryAcquireSyncLock('t') === false);
  lockStore.set('test_lock_t', { owner: 'tab-dead', expires: Date.now() - 1 });
  check('选择器-103: 过期锁可被抢占', tab2.tryAcquireSyncLock('t') === true && tab2.readSyncLock('t').owner === 'tab-2');
  check('选择器-104: 非持锁页续租失败且持锁页续租成功', tab1.renewSyncLock('t') === false && tab2.renewSyncLock('t') === true);
  tab1.releaseSyncLock('t');
  check('选择器-105: 非持锁页释放无效且持锁页释放清空', tab2.readSyncLock('t').owner === 'tab-2' && (() => { tab2.releaseSyncLock('t'); return tab2.readSyncLock('t') === null; })());
}
{
  const tab1 = createLockEnv('tab-a');
  const tab2 = createLockEnv('tab-b');
  let ran1 = 0, ran2 = 0;
  const p1 = tab1.runWithSyncLock('race', async () => { ran1++; await new Promise((r) => setTimeout(r, 30)); });
  const p2 = tab2.runWithSyncLock('race', async () => { ran2++; await new Promise((r) => setTimeout(r, 30)); });
  await Promise.all([p1, p2]);
  check('选择器-106: 并发抢占仅一个执行者且完成后锁释放', ran1 + ran2 === 1 && tab1.readSyncLock('race') === null && tab2.readSyncLock('race') === null);
  let ran3 = 0;
  await tab1.runWithSyncLock('race', async () => { ran3++; });
  check('选择器-107: 释放后他页可再次执行', ran3 === 1);
}
{
  const tab = createLockEnv('tab-c');
  let threw = false;
  try { await tab.runWithSyncLock('fail', async () => { throw new Error('boom'); }); } catch (e) { threw = true; }
  check('选择器-108: 任务异常仍释放锁', threw === true && tab.readSyncLock('fail') === null);
}
{
  const regMenuFn = extractFn(src, 'registerMenu');
  const registered = [];
  const menuEnv = new Function('registered', 'GM_registerMenuCommand', 't', 'showConfigPanel', 'showSelectorPanel', 'showHighlightColorPanel', `let _menuCommandIds = []; ${regMenuFn} registerMenu(); return registered;`);
  const menus = menuEnv(registered, (label) => { registered.push(label); }, (k) => k, () => {}, () => {}, () => {});
  check('选择器-109: 注册3个菜单项且首项为打开面板', menus.length === 3 && menus[0] === 'menuOpenPanel');
}

// 结果摘要后备提取: 相对选择器不得抛异常中断结果处理
await (async () => {
  const selectorsDecl = src.match(/const SELECTORS = \{[\s\S]*?\n  \};/)[0];
  const getResultSnippet = new Function('GM_getValue', 'let activeSelectors = null;\nconst SELECTORS_KEY = \'searchfilter_selectors\';\n' + selectorsDecl + '\n' + ['normalizeSelectorList', 'getUserSelectors', 'getSelectors', 'getResultText', 'getResultExtraElements', 'getResultSnippet'].map((n) => extractFn(src, n)).join('\n') + '\nreturn getResultSnippet;')(() => undefined);
  const throwIfRel = (fn) => (sel) => { if (sel.startsWith('+')) { const e = new Error(sel + ' is not a valid selector'); e.name = 'SyntaxError'; throw e; } return fn(sel); };
  let threw = false, out = '';
  const extraRow = { textContent: '  extra text  ', matches: throwIfRel(() => false), querySelector: throwIfRel(() => null), contains: () => false };
  const resultEl = { textContent: '', querySelector: throwIfRel(() => null), parentElement: null };
  resultEl.parentElement = { children: [resultEl, extraRow], querySelectorAll: (sel) => (String(sel).includes(':nth-child(1)') ? [extraRow] : []) };
  try { out = getResultSnippet(resultEl, 'duckduckgo_lite'); } catch (e) { threw = true; }
  check('选择器-110: 相对选择器后备提取不抛异常', threw === false && out === '');
  const selfSnippet = { textContent: ' self text ', matches: throwIfRel((sel) => sel === '.result-snippet'), querySelector: throwIfRel(() => null), contains: () => false };
  resultEl.parentElement = { children: [resultEl, selfSnippet], querySelectorAll: (sel) => (String(sel).includes(':nth-child(1)') ? [selfSnippet] : []) };
  out = ''; threw = false;
  try { out = getResultSnippet(resultEl, 'duckduckgo_lite'); } catch (e) { threw = true; }
  check('选择器-111: 后备元素自我命中有效选择器仍返回文本', threw === false && out === 'self text');
  const primaryEl = { textContent: ' primary ' };
  const resultWithPrimary = { textContent: '', querySelector: (sel) => (sel === '.result-snippet' ? primaryEl : null), parentElement: { children: [], querySelectorAll: () => [] } };
  out = ''; threw = false;
  try { out = getResultSnippet(resultWithPrimary, 'duckduckgo_lite'); } catch (e) { threw = true; }
  check('选择器-112: 主摘要选择器路径不受影响', threw === false && out === 'primary');
})();

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
  const apiM = mkApi(src), apiL = mkApi(readRepoFile('Lite.user.js'));
  const R13 = apiM.parseSelectorText('{"e13":{"match":"a","containers":"div\\u002Eresult"}}');
  check('选择器-113: JSON \\uXXXX 转义正常解码为字面字符', !!R13.config && R13.config.e13.containers === 'div.result');
  const R14 = apiM.parseSelectorText('__proto__: { match: "a", containers: ".x" }');
  const protoJson = apiM.parseSelectorText('{"__proto__":{"containers":".x","match":"x"}}');
  check('选择器-114: __proto__ 键单独输入解析失败且不污染对象(两种路径)', R14.config === null && R14.errors.length > 0 && protoJson.config === null && protoJson.errors.length > 0 && !Object.hasOwn(R14.config || {}, '__proto__'));
  const DEF = '123abc: { match: /(?:^|\\.)search\\.example\\.com$/, containers: ".result" }';
  const RM = apiM.parseSelectorText(DEF);
  check('选择器-115: 数字开头引擎ID裸键直接解析并过校验', !RM.errors.length && !!RM.config && !!RM.config['123abc'] && RM.config['123abc'].match === '(?:^|\\.)search\\.example\\.com$' && apiM.validateUserSelectors(RM.config).length === 0);
  const RMix = apiM.parseSelectorText(DEF + ", '456def': { match: /b/, containers: '.s' }, xyz: { match: /c/, containers: '.t' }");
  check('选择器-116: 数字键/引号键/字母键混写共存', !RMix.errors.length && JSON.stringify(Object.keys(RMix.config)) === JSON.stringify(['123abc', '456def', 'xyz']));
  check('选择器-117: 垃圾输入仍拒绝', apiM.parseSelectorText('123abc').config === null && apiM.parseSelectorText('123: 456').config === null);
  const RL = apiL.parseSelectorText(DEF);
  check('选择器-118: Lite 版同步修复(裸键数字开头解析且过校验)', !RL.errors.length && !!RL.config['123abc'] && apiL.validateUserSelectors(RL.config).length === 0);
  const apiSer = new Function(`
    const SELECTORS = {};
    ${extractFn(src, 'normalizeSelectorList')}
    ${extractFn(src, 'regexSourceToLiteralText')}
    ${extractFn(src, 'escapeJsString')}
    ${extractFn(src, 'matchDefToParts')}
    ${extractFn(src, 'serializeSelectors')}
    return serializeSelectors;
  `)();
  const PK = apiSer({ '123abc': { match: '(?:^|\\.)x\\.example\\.com$', containers: '.r', titles: [], snippets: [], links: 'a[href]' } });
  const RRT = apiM.parseSelectorText(PK);
  check('选择器-119: 序列化往返无损(数字开头键自动加引号)', PK.includes("'123abc':") && !RRT.errors.length && !!RRT.config && !!RRT.config['123abc'] && RRT.config['123abc'].match === '(?:^|\\.)x\\.example\\.com$');
  const otherRes = apiM.parseSelectorText('other: {containers: ".x", match: /x/}');
  check('选择器-120: 保留键other单独输入解析失败不清空存储', otherRes.config === null && otherRes.errors.length > 0);
  const mixedOther = apiM.parseSelectorText('{"myse":{"match":"/x/","containers":".r"},"other":{"match":"y"}}');
  const explicitEmpty = apiM.parseSelectorText('{}');
  check('选择器-121: 混合输入中other被忽略且显式{}仍为合法空配置', !!mixedOther.config && !!mixedOther.config.myse && !('other' in mixedOther.config) && !mixedOther.errors.length && !!explicitEmpty.config && Object.keys(explicitEmpty.config).length === 0 && !explicitEmpty.errors.length);
})();
})();

// ==== 二、修复回归 ====

// ---- 父容器隐藏/恢复状态机 + bing cite回退 ----
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
      for (const k of Object.keys(this.attrs)) { const m = k.match(/^data-([a-z-]+)$/); if (m) ds[m[1].replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = this.attrs[k]; }
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
    check('选择器-122: 部分子项屏蔽时父容器不隐藏', P.style.display === '' && !P.hasAttribute('data-blocker-google-parent'));
    blockEl(fns, g2);
    fns.hideParentIfNoVisibleSiblings(P, P.querySelectorAll('div.g'), 'data-blocker-google-parent');
    check('选择器-123: 全部屏蔽后父隐藏且保存原display', P.style.display === 'none' && P.getAttribute('data-blocker-google-parent') === 'true' && P.getAttribute('data-serh-orig-display') === '');
    fns.resetResultStyles(g1);
    check('选择器-124: 解除其一后父保持隐藏(其余仍屏蔽)', P.style.display === 'none' && P.hasAttribute('data-blocker-google-parent') && g1.style.display === '');
    fns.reconcileHiddenParents();
    check('选择器-125: reconcile恢复存在可见未屏蔽子项的父容器', P.style.display === '' && !P.hasAttribute('data-blocker-google-parent') && !P.hasAttribute('data-serh-orig-display'));
  }
  {
    const { root, fns } = makeParentEnv(false);
    const li = makeTreeEl('li', '', root);
    li.style.display = 'block';
    const o1 = makeTreeEl('div', 'Organic', li);
    const o2 = makeTreeEl('div', 'Organic', li);
    blockEl(fns, o1); blockEl(fns, o2);
    fns.hideParentIfNoVisibleSiblings(li, li.children, 'data-blocker-yandex-parent');
    fns.resetResultStyles(o1);
    check('选择器-126: reset未清空全部子项时父仍隐藏', li.style.display === 'none' && li.getAttribute('data-blocker-yandex-parent') === 'true');
    fns.resetResultStyles(o2);
    check('选择器-127: 最后一个子项reset后父恢复原display', li.style.display === 'block' && !li.hasAttribute('data-blocker-yandex-parent') && !li.hasAttribute('data-serh-orig-display'));
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
    const g1 = makeTreeEl('div', 'g', P);
    const sibling = makeTreeEl('div', 'tF2Cxc', P);
    blockEl(fns, g1);
    fns.hideParentIfNoVisibleSiblings(P, fns.googleResultBlocks(P), 'data-blocker-google-parent');
    check('选择器-129: 仅div.g被屏蔽时未命中的tF2Cxc不触发父隐藏', P.style.display === '' && !P.hasAttribute('data-blocker-google-parent'));
    blockEl(fns, sibling);
    fns.hideParentIfNoVisibleSiblings(P, fns.googleResultBlocks(P), 'data-blocker-google-parent');
    check('选择器-130: div.g与tF2Cxc都屏蔽后父容器隐藏', P.style.display === 'none' && P.hasAttribute('data-blocker-google-parent'));
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
    const linkApi = new Function('SELECTORS', `
      function toASCIIHostname(h) { return h; }
      function toASCIIUrl(u) { return u; }
      function getSelectors() { return SELECTORS; }
      const window = { location: { hostname: 'www.bing.com', href: 'https://www.bing.com/search?q=x' } };
      let _engineCacheHost = null; let _engineCacheResult = 'other';
      ${extractFn(src, 'getSearchEngine')}
      ${extractFn(src, 'getSearchCategory')}
      ${extractFn(src, 'isBingImagesPage')}
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
  const selectorsObj = eval(`(${getSelectorsObjectText()})`);
  const pruneProbe = new Function('SELECTORS', `${extractFn(src, 'normalizeSelectorList')}\n${extractFn(src, 'matchDefToParts')}\n${extractFn(src, 'sameSelectorDef')}\nreturn { sameSelectorDef };`)(selectorsObj);
  const builtinBing = selectorsObj.bing;
  check('选择器-133: 仅多disabled:true判为不同且无disabled副本判为相同', pruneProbe.sameSelectorDef(Object.assign({}, builtinBing, { disabled: true }), builtinBing) === false && pruneProbe.sameSelectorDef(Object.assign({}, builtinBing), builtinBing) === true);

  const selStore = { current: undefined };
  const selFns = ['normalizeSelectorList', 'mergeSelectorDef', 'getUserSelectors', 'getSelectors', 'resetSelectorCache', 'getInvalidRegexFlags', 'regexSourceToLiteralText', 'escapeJsString', 'matchDefToParts', 'serializeSelectors', 'normalizeMatchLiteral', 'parseSelectorText', 'sameSelectorDef', 'diffSelectorDefFields', 'diffUserSelectors'].map((n) => extractFn(src, n));
  const selApi = new Function('GM_getValue', 'storeRef', `
const SELECTORS_KEY = 'searchfilter_selectors';
const SUPPORTED_REGEX_FLAGS = 'imsu';
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
  const jsRes = selApi.parseSelectorText('{"bing": true}');
  check('选择器-134: JSON路径非对象def保留交校验层', !!jsRes.config && jsRes.config.bing === true);
  const mergedAll = selApi.getSelectors();
  const diff = selApi.diffUserSelectors(Object.assign({}, mergedAll, { bing: Object.assign({}, mergedAll.bing, { containers: 'div.custom' }) }));
  const pinningFields = ['match', 'titles', 'snippets', 'links'].filter((k) => k in (diff.bing || {}));
  check('选择器-135: 仅改一个字段时diff只保留该字段(升级内置可跟随)', 'bing' in diff && pinningFields.length === 0 && diff.bing.containers === 'div.custom');

  const fixApi = new Function(`
const SELECTORS_KEY = 'searchfilter_selectors';
const SELECTORS = ${getSelectorsObjectText()};
let activeSelectors = null; let _engineCacheHost = null; let _engineCacheResult = 'other'; let _observedSelector = '';
let stored = undefined;
const GM_getValue = (key, def) => (key === SELECTORS_KEY && stored !== undefined ? stored : def);
const GM_setValue = (key, val) => { if (key === SELECTORS_KEY) stored = val; };
const t = (key) => key;
const isValidCssSelector = () => true;
const hasPseudoElement = (s) => /::/.test(String(s));
${['normalizeSelectorList', 'getInvalidRegexFlags', 'matchDefToParts', 'resetSelectorCache', 'getUserSelectors', 'parseSelectorText', 'validateUserSelectors', 'sameSelectorDef', 'pruneUserSelectors'].map((n) => extractFn(src, n)).join('\n')}
return { parseSelectorText, validateUserSelectors, pruneUserSelectors, SELECTORS, getStored: () => stored, setStored: (v) => { stored = v; } };
  `)();
  const parsedTrue = fixApi.parseSelectorText('{"bing": true}');
  check('选择器-136: {"bing": true} 端到端被校验拦截, 不以空配置覆盖存储', 'bing' in parsedTrue.config && fixApi.validateUserSelectors(parsedTrue.config).length > 0);
  fixApi.setStored({ bing: Object.assign({}, fixApi.SELECTORS.bing, { disabled: true }), myse: { match: 'a', containers: '.x' } });
  fixApi.pruneUserSelectors();
  check('选择器-137: prune保留禁用配置', (() => { const s = fixApi.getStored(); return !!s.bing && s.bing.disabled === true && !!s.myse; })());
  fixApi.setStored({ bing: Object.assign({}, fixApi.SELECTORS.bing) });
  fixApi.pruneUserSelectors();
  check('选择器-138: 无disabled的全量内置副本仍被prune清理', !!fixApi.getStored() && !('bing' in fixApi.getStored()));
}

// ---- 屏蔽按钮按容器注入 / 设置开关 / 标签注入 ----
{
  let appended = null;
  const fakeBtn = { className: '', innerHTML: '', style: {}, addEventListener() {}, onclick: null };
  const api = new Function('document', 'window', `
function getSearchEngine() { return 'other'; }
function getSearchCategory() { return 'web'; }
function isBingImagesPage(engine) { return engine === 'bing' && getSearchCategory() === 'images'; }
${extractFn(src, 'ensurePositioned')}
${extractFn(src, 'injectBlockButton')}
return { injectBlockButton };
`)({ createElement: () => fakeBtn }, { getComputedStyle: () => ({ position: 'relative' }) });
  const container = { classList: { contains: () => false }, closest: () => null, querySelector: () => null, getAttribute: () => null, appendChild(el) { appended = el; } };
  api.injectBlockButton(container, 'other', 'example.com');
  check('选择器-139: 无标题元素容器仍注入屏蔽按钮且锚定容器', !!appended && appended.className === 'serh-quick-block');

  const cfgDefaultsLine = src.match(/const CFG_DEFAULTS = \{[^}]+\};/)[0];
  const hlLine = src.match(/const DEFAULT_HIGHLIGHT_COLORS = \{[^}]+\};/)[0];
  const defApi = new Function(`${cfgDefaultsLine}\n${hlLine}\n${extractFn(src, 'getDefaultConfig')}\nreturn { getDefaultConfig };`)();
  const normApi = new Function(`${cfgDefaultsLine}\n${hlLine}\n${extractFn(src, 'normalizeConfig')}\nreturn { normalizeConfig };`)();
  check('选择器-140: showMatchedSource默认开启且显式false被保留', defApi.getDefaultConfig().showMatchedSource === true && normApi.normalizeConfig({ rules: [], showMatchedSource: false }).showMatchedSource === false);

  let labelAppended = null;
  const labelEl = { className: '', textContent: '' };
  const fakeResult = { dataset: { matchedRule: '*://*.example.com/*', matchedSource: 'local' }, querySelector: () => null, appendChild: (el) => { labelAppended = el; } };
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
  const onState = labelAppended === labelEl && labelEl.className === 'serh-matched-rule' && labelEl.textContent === 'local: *://*.example.com/*';
  labelAppended = null;
  labelApi.setConfig({ showMatchedSource: false });
  labelApi.run(fakeResult);
  check('选择器-141: 显示来源开关控制命中规则标签注入', onState && labelAppended === null);
}

// ---- 取色预览色块快速填入 ----
{
  const seg = src.slice(src.indexOf('function updatePreview'), src.indexOf("document.getElementById('serh-hlcolor-save')"));
  const els = {};
  const mk = (id, v) => { els[id] = { value: v || '', textContent: '#aabbcc', style: {}, handlers: {}, addEventListener(ev, fn) { this.handlers[ev] = fn; } }; };
  for (let i = 1; i <= 5; i++) { mk(`serh-hlcolor-input-${i}`, i === 3 ? '#112233' : ''); mk(`serh-hlcolor-preview-${i}`); }
  mk('serh-hlcolor-code-text');
  new Function('document', seg)({ getElementById: (id) => els[id] || null });
  els['serh-hlcolor-preview-3'].handlers.click();
  const ok = els['serh-hlcolor-input-3'].value === '#aabbcc' && els['serh-hlcolor-preview-3'].style.background === '#aabbcc';
  els['serh-hlcolor-code-text'].textContent = 'nope';
  els['serh-hlcolor-preview-4'].handlers.click();
  check('选择器-142: 点击预览色块填入取色hex且非法hex不填入', ok && els['serh-hlcolor-input-4'].value === '');
}

// ---- 统计: 来源键语言无关 ----
{
  const mkFn = (lang) => new Function(`
    const t = (k) => ({ localRule: '${lang === 'en' ? 'Local Rule' : '本地规则'}', subscription: '${lang === 'en' ? 'Sub' : '订阅'}' }[k]);
    ${extractFn(src, 'statSourceKey')}
    return statSourceKey;
  `)();
  const keyEn = mkFn('en'), keyZh = mkFn('zh');
  check('选择器-143: 来源键中英混排归一为语言无关键', keyEn('本地规则') === 'local' && keyEn('订阅2') === 'sub:2' && keyZh('Local Rule') === 'local' && keyZh('Sub3') === 'sub:3' && keyEn('whatever') === '');
}

// ---- 编辑区成对括号显示 ----
{
  const bracketApi = new Function(['isJsRegexAllowed', 'buildBracketMatchMap', 'findBracketPairAt', 'findEnclosingBracketAt'].map((n) => extractFn(src, n)).join('\n') + `
return { isJsRegexAllowed, buildBracketMatchMap, findBracketPairAt, findEnclosingBracketAt };`)();
  const obj = '{\n  a: f(1, [2]),\n  b: \'x)y\'\n}';
  const objMap = bracketApi.buildBracketMatchMap(obj, 'js');
  check('选择器-144: 对象字面量括号成对且字符串内括号不配对', objMap[obj.indexOf('{')] === obj.lastIndexOf('}') && objMap[obj.indexOf('(')] === obj.indexOf(')') && objMap[obj.indexOf('[')] === obj.indexOf(']') && objMap[obj.indexOf('y') - 1] === -1);
  const tpl = 'x = `a)b${c(1)}`';
  const tplMap = bracketApi.buildBracketMatchMap(tpl, 'js');
  check('选择器-145: 模板字符串文本括号不配对且插值成对', tplMap[tpl.indexOf(')')] === -1 && tplMap[tpl.indexOf('${') + 1] === tpl.indexOf('}', tpl.indexOf('${')));
  const cmt = '/* ( */ // )\ny = (1)';
  const cmtMap = bracketApi.buildBracketMatchMap(cmt, 'js');
  check('选择器-146: 注释内括号不配对', cmtMap[cmt.indexOf('(')] === -1 && cmtMap[cmt.indexOf(')')] === -1 && cmtMap[cmt.lastIndexOf('(')] === cmt.lastIndexOf(')'));
  const re = 're = /a(b)c/; z = (1)';
  const reMap = bracketApi.buildBracketMatchMap(re, 'js');
  check('选择器-147: 正则字面量内括号不配对且除法斜杠不误判', reMap[re.indexOf('(')] === -1 && (() => { const div = 'v = a / b + (c)'; const dm = bracketApi.buildBracketMatchMap(div, 'js'); return dm[div.indexOf('(')] === div.lastIndexOf(')'); })());
}

// ---- 悬浮球图标 / 拖拽与类名契约 ----
{
  const mkBubbleHtml = (text, action) => {
    const fn = new Function('currentConfig', extractFn(text, 'updateBubbleContent') + '\nreturn updateBubbleContent;')({ bubbleAction: action, showCount: false, bubbleState: null });
    const btn = {}; fn(btn, 0); return btn.innerHTML;
  };
  const statsM = mkBubbleHtml(src, 'openStats'), panelM = mkBubbleHtml(src, 'openPanel');
  const statsL = mkBubbleHtml(readRepoFile('Lite.user.js'), 'openStats');
  check('选择器-148: 打开统计模式斜杠翻转(主版与Lite同步)且与面板图标可区分', statsM.includes('x1="19.07" y1="4.93" x2="4.93" y2="19.07"') && !statsM.includes('x1="4.93" y1="4.93"') && statsL.includes('x1="19.07"') && statsM !== panelM && panelM.includes('x1="4.93" y1="4.93" x2="19.07" y2="19.07"'));
  const bindIdx = src.indexOf("document.addEventListener('touchmove', onDrag");
  const unbindIdx = src.indexOf("document.removeEventListener('touchmove', onDrag)");
  check('选择器-149: 拖拽绑定并解绑 touchcancel', bindIdx > -1 && src.slice(bindIdx, bindIdx + 400).includes("document.addEventListener('touchcancel', endDrag)") && unbindIdx > -1 && src.slice(unbindIdx, unbindIdx + 300).includes("document.removeEventListener('touchcancel', endDrag)"));
  check('选择器-150: 悬浮球数字类名已加 serh- 前缀', src.includes('.serh-bubble-number') && src.includes('class="serh-bubble-number"') && !src.includes('class="bubble-number"') && !/(^|[^\w-])\.bubble-number\s*\{/.test(src));
  check('选择器-151: Bing links 首选主标题 a[href]', (() => { const o = eval(`(${getSelectorsObjectText()})`); return Array.isArray(o.bing.links) && o.bing.links[0] === 'h2 a[href]'; })());
  check('选择器-152: map_resultExtraElements 为 WeakMap', /const map_resultExtraElements = new WeakMap\(\)/.test(src));
  check('选择器-153: no-op 死代码已清理', !src.includes('restoreResultExtraElements()') && /restoreResultExtraElements\(result\)/.test(src) && !src.includes('window._panelCloseHandler !== closeHandler'));
}

// ---- Google回退: 域名+路径裸文本 与 /url?u= ----
{
  const linkApiG = new Function('SELECTORS', `
    function toASCIIHostname(h) { return h; }
    function toASCIIUrl(u) { return u; }
    function getSelectors() { return SELECTORS; }
    const window = { location: { hostname: 'www.google.com', href: 'https://www.google.com/search?q=x', origin: 'https://www.google.com' } };
    const location = window.location;
    let _engineCacheHost = null; let _engineCacheResult = 'other';
    ${extractFn(src, 'getSearchEngine')}
    ${extractFn(src, 'getSearchCategory')}
    ${extractFn(src, 'isBingImagesPage')}
    ${extractFn(src, 'decodeRedirectTarget')}
    ${extractFn(src, 'decodeBingCkTarget')}
    ${extractFn(src, 'isOpaqueRedirectUrl')}
    ${extractFn(src, 'unwrapRedirectUrl')}
    ${extractFn(src, 'getResultLink')}
    return { getResultLink };
  `)(eval(`(${getSelectorsObjectText()})`));
  const PILL = '.lJQCTe, .XVWGNd, .R8BTeb, span.ob9lvb, .eip8Bb';
  function googleResult(href, pillText) {
    const linkEl = { href, getAttribute: () => null, setAttribute: () => {} };
    return { querySelector(sel) { return sel === PILL ? (pillText ? { textContent: pillText } : null) : linkEl; } };
  }
  const noQ = 'https://www.google.com/url?sa=t';
  const g1 = linkApiG.getResultLink(googleResult(noQ, 'www.example.com/path'), 'google');
  check('选择器-154: Google回退对域名+路径裸文本解析出域名', !!g1 && g1.href === 'https://www.example.com/');
  const g2 = linkApiG.getResultLink(googleResult(noQ, 'www.example.com › path'), 'google');
  check('选择器-155: 面包屑文本仍按逐段拼接', !!g2 && g2.href === 'https://www.example.com/path');
  const g3 = linkApiG.getResultLink(googleResult(noQ, 'search-results'), 'google');
  check('选择器-156: 非域名文本不回退(仍用原链接)', !!g3 && g3.href === noQ);
  const uUrl = 'https://www.google.com/url?u=' + encodeURIComponent('https://target.example/x');
  const g4 = linkApiG.getResultLink(googleResult(uUrl, 'www.decoy.example'), 'google');
  check('选择器-157: /url?u= 可解包时不用可疑文本回退', !!g4 && g4.href === uUrl);
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
  const resGoto2 = { querySelector() { return gotoEl(); }, querySelectorAll() { return []; } };
  const g6 = linkApiG.getResultLink(resGoto2, 'google');
  check('选择器-164: 无法恢复时保留原始goto链接', !!g6 && g6.href === gotoUrl);
}

// ---- match字符串字面量与引擎同口径 ----
{
  const mkEnv = (srcText) => new Function(`
    const SUPPORTED_REGEX_FLAGS = 'imsu';
    function t(key, params = {}) { let text = key; for (const [k, v] of Object.entries(params || {})) text += ':' + v; return text; }
    function isValidCssSelector() { return true; } function hasPseudoElement() { return false; }
    ${extractFn(srcText, 'normalizeSelectorList')}
    ${extractFn(srcText, 'getInvalidRegexFlags')}
    ${extractFn(srcText, 'matchDefToParts')}
    ${extractFn(srcText, 'sameSelectorDef')}
    ${extractFn(srcText, 'validateUserSelectors')}
    return { matchDefToParts, sameSelectorDef, validateUserSelectors };
  `)();
  const apiM2 = mkEnv(src), apiL2 = mkEnv(readRepoFile('Lite.user.js'));
  const base = { containers: '.x', titles: [], snippets: [], links: 'a[href]' };
  const p1 = apiM2.matchDefToParts('/foo\\.bar/i');
  check('选择器-158: matchDefToParts 对 /re/flags 字符串按正则语义解析', p1.source === 'foo\\.bar' && p1.flags === 'i');
  check('选择器-159: 非字面量字符串仍整体作source', apiM2.matchDefToParts('foo\\.bar').source === 'foo\\.bar' && apiM2.matchDefToParts('foo\\.bar').flags === '' && apiM2.matchDefToParts('/foo\\.bar').source === '/foo\\.bar');
  check('选择器-160: 字符串字面量与RegExp/对象在sameSelectorDef下等价', apiM2.sameSelectorDef({ ...base, match: '/foo/i' }, { ...base, match: /foo/i }) && apiM2.sameSelectorDef({ ...base, match: '/foo/i' }, { ...base, match: { source: 'foo', flags: 'i' } }) && !apiM2.sameSelectorDef({ ...base, match: '/foo/i' }, { ...base, match: '/foo/g' }));
  check('选择器-161: 字面量match校验与引擎同口径且非法源可检出', apiM2.validateUserSelectors({ ok: { match: '/foo\\.bar/i', ...base } }).length === 0 && apiM2.validateUserSelectors({ rb: { match: '/\\/i', ...base } }).some((m2) => m2.includes('rb')));
  const pL = apiL2.matchDefToParts('/foo\\.bar/i');
  check('选择器-162: Lite版同步字面量解析与校验口径', pL.source === 'foo\\.bar' && pL.flags === 'i' && apiL2.sameSelectorDef({ ...base, match: '/foo/i' }, { ...base, match: /foo/i }) && apiL2.validateUserSelectors({ ok: { match: '/foo\\.bar/i', ...base } }).length === 0);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

})();