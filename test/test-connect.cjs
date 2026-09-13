(async () => {
const fs = require('fs');
const path = require('path');

const scriptDir = path.join(__dirname, '..');
const scriptFiles = fs.readdirSync(scriptDir).filter((name) => name.endsWith('.js')).sort();
if (!scriptFiles.length) throw new Error('no .js script found in ' + scriptDir);
const file = path.join(scriptDir, scriptFiles[0]);
console.log('Testing', file);
const src = fs.readFileSync(file, 'utf8');

const header = src.slice(0, src.indexOf('==/UserScript=='));
const connectLines = [...header.matchAll(/^\/\/\s*@connect\s+(\S+)/gm)].map((m) => m[1]);

function connectAllows(host) {
  return connectLines.some((p) => p === '*' || host === p || host.endsWith('.' + p));
}

let pass = 0;
let fail = 0;
function assert(name, cond) {
  if (cond) { pass++; console.log('PASS', name); }
  else { fail++; console.log('FAIL', name); }
}

assert('N1: 声明了 @connect', connectLines.length > 0);
assert('N2: 允许任意主机', connectLines.includes('*'));
assert('N3: 订阅主机放行', connectAllows('raw.githubusercontent.com'));
assert('N4: 坚果云 WebDAV 放行', connectAllows('dav.jianguoyun.com'));
assert('N5: 其他 WebDAV 主机放行', connectAllows('webdav.example.com'));

// ==== 自动同步方向仲裁(云端较新才应用云端设置; 本地较新或有独有规则时上传) ====
function extractFn(text, fnName) {
  let marker = 'async function ' + fnName + '(';
  let idx = text.indexOf(marker);
  if (idx === -1) { marker = 'function ' + fnName + '('; idx = text.indexOf(marker); }
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

const KEYS = {
  CONFIG_KEY: 'searchfilter_blocker',
  WEBDAV_SYNC_CONFIG_KEY: 'searchfilter_webdav_sync_config',
  WEBDAV_SYNC_SELECTORS_KEY: 'searchfilter_webdav_sync_selectors',
  SELECTORS_KEY: 'searchfilter_selectors',
  LOCAL_LAST_MODIFIED_KEY: 'searchfilter_local_last_modified',
  WEBDAV_LAST_SYNC_KEY: 'searchfilter_webdav_last_sync',
};

const syncFns = [
  'stripRuleComment', 'getWebDAVRequest', 'isHtmlResponse', 'parseSyncHeader', 'buildUploadContent',
  'buildSyncPayload', 'applyCloudSubscriptions', 'adoptStoredConfigIfNewer',
  'checkExternalConfigChange', 'performAutoWebDAVSync',
].map((n) => extractFn(src, n));

function makeSyncEnv({ cloudStatus = 200, cloudText = '', localRules = [], localTime = 0, localSubs = [], storedConfig = undefined, syncConfig = true, responseHeaders = '' }) {
  const store = new Map();
  store.set(KEYS.WEBDAV_SYNC_CONFIG_KEY, syncConfig);
  store.set(KEYS.WEBDAV_SYNC_SELECTORS_KEY, false);
  store.set(KEYS.LOCAL_LAST_MODIFIED_KEY, localTime);
  store.set(KEYS.WEBDAV_LAST_SYNC_KEY, 0);
  store.set('subs', localSubs);
  if (storedConfig !== undefined) store.set(KEYS.CONFIG_KEY, storedConfig);
  const calls = [];
  const state = { reprocess: 0 };
  const factory = new Function('store', 'calls', 'state', 'mockResponse', `
    const console = { log: () => {}, warn: () => {} };
    const CONFIG_KEY = ${JSON.stringify(KEYS.CONFIG_KEY)};
    const WEBDAV_SYNC_CONFIG_KEY = ${JSON.stringify(KEYS.WEBDAV_SYNC_CONFIG_KEY)};
    const WEBDAV_SYNC_SELECTORS_KEY = ${JSON.stringify(KEYS.WEBDAV_SYNC_SELECTORS_KEY)};
    const SELECTORS_KEY = ${JSON.stringify(KEYS.SELECTORS_KEY)};
    const LOCAL_LAST_MODIFIED_KEY = ${JSON.stringify(KEYS.LOCAL_LAST_MODIFIED_KEY)};
    const WEBDAV_LAST_SYNC_KEY = ${JSON.stringify(KEYS.WEBDAV_LAST_SYNC_KEY)};
    const MAX_SUBSCRIPTIONS = 100;
    const GM_getValue = (k, d) => (store.has(k) ? store.get(k) : d);
    const GM_setValue = (k, v) => { store.set(k, v); };
    async function gmRequest(method, url, opts = {}) {
      calls.push({ method, url, data: opts.data });
      if (method === 'GET') return mockResponse;
      return { status: 200 };
    }
    function forceReprocessAll() { state.reprocess++; }
    function persistConfig(updateModifiedTime = true) {
      GM_setValue(CONFIG_KEY, currentConfig);
      if (updateModifiedTime) GM_setValue(LOCAL_LAST_MODIFIED_KEY, Date.now());
    }
    function getSubscriptions() { return store.get('subs') || []; }
    function saveSubscriptions(subs) { store.set('subs', subs); }
    function getUserSelectors() { return {}; }
    function getSelectorStoreSignature() { return null; }
    function resetSelectorCache() {}
    function refreshEngineSite() {}
    let currentConfig;
    ${syncFns.join('\n')}
    return {
      setCurrent: (c) => { currentConfig = c; },
      getCurrent: () => currentConfig,
      run: (cfg) => performAutoWebDAVSync(cfg),
      store,
      calls,
      state,
    };
  `);
  return factory(store, calls, state, { status: cloudStatus, responseText: cloudText, responseHeaders });
}

const syncCfg = { url: 'https://dav.example.com/dav/', username: '', password: '', filename: 'rules.txt' };

// T1: 云端较新 -> 应用云端设置与规则 + 保留本地订阅规则数组 + 不上传
{
  const cloud = { enabled: false, language: 'en', syncedAt: 2000, subscriptions: [{ url: 'https://sub/x.txt', enabled: true, lastUpdate: 9 }] };
  const cloudText = '# ScriptConfig:' + JSON.stringify(cloud) + '\n*://cloud.example.com/*';
  const localSubs = [{ url: 'https://sub/x.txt', enabled: true, lastUpdate: 1, rules: ['title/foo/'], name: 'localname' }];
  const env = makeSyncEnv({ cloudText, localRules: ['*://local-old.example.com/*'], localTime: 1000, localSubs });
  env.setCurrent({ rules: ['*://local-old.example.com/*'], enabled: true, language: 'zh-CN' });
  await env.run(syncCfg);
  const cur = env.getCurrent();
  assert('T1: 云端较新时应用云端设置', cur.enabled === false && cur.language === 'en');
  assert('T1b: 采纳云端规则', cur.rules.includes('*://cloud.example.com/*') && !cur.rules.includes('*://local-old.example.com/*') && cur.rules.length === 1);
  assert('T1c: 本地订阅规则数组保留', env.store.get('subs')[0].rules[0] === 'title/foo/' && env.store.get('subs')[0].lastUpdate === 9);
  assert('T1d: 云新时不上传', env.calls.length === 1 && env.calls[0].method === 'GET');
  assert('T1e: 对齐本地修改时间戳为云端时间戳', env.store.get(KEYS.LOCAL_LAST_MODIFIED_KEY) === 2000);
}

// T2: 本地较新 -> 保留本地设置 + 上传本地规则(头含本地配置)
{
  const cloud = { enabled: false, syncedAt: 500 };
  const cloudText = '# ScriptConfig:' + JSON.stringify(cloud) + '\n*://cloud.example.com/*';
  const localConfig = { rules: ['*://local.example.com/*'], enabled: true, language: 'zh-CN' };
  const env = makeSyncEnv({ cloudText, localRules: ['*://local.example.com/*'], localTime: 1000, storedConfig: localConfig });
  env.setCurrent({ ...localConfig });
  await env.run(syncCfg);
  const cur = env.getCurrent();
  assert('T2: 本地较新时保留本地设置', cur.enabled === true && cur.language === 'zh-CN');
  const put = env.calls.find((c) => c.method === 'PUT');
  assert('T2b: 本地较新时上传本地规则', !!put && put.data.includes('*://local.example.com/*') && !put.data.includes('*://cloud.example.com/*'));
  const header = JSON.parse(put.data.split('\n')[0].substring('# ScriptConfig:'.length));
  assert('T2c: 上传头含本地配置', header.enabled === true && header.language === 'zh-CN');
  assert('T2d: 更新本地修改时间戳与上传时间戳对齐', env.store.get(KEYS.LOCAL_LAST_MODIFIED_KEY) >= 1000);
}

// T3: 时间戳相等且规则一致 -> 无操作
{
  const cloud = { enabled: false, syncedAt: 1000 };
  const cloudText = '# ScriptConfig:' + JSON.stringify(cloud) + '\n*://same.example.com/*';
  const env = makeSyncEnv({ cloudText, localRules: ['*://same.example.com/*'], localTime: 1000, storedConfig: { rules: ['*://same.example.com/*'], enabled: true } });
  env.setCurrent({ rules: ['*://same.example.com/*'], enabled: true });
  await env.run(syncCfg);
  assert('T3: 时间戳相等时无操作', env.calls.filter((c) => c.method === 'PUT').length === 0 && env.getCurrent().enabled === true);
}

// T4: 云端404 -> 上传本地规则
{
  const env = makeSyncEnv({ cloudStatus: 404, cloudText: '', localRules: ['*://a.example.com/*', '*://b.example.com/*'], localTime: 1000 });
  env.setCurrent({ rules: ['*://a.example.com/*', '*://b.example.com/*'], enabled: true });
  await env.run(syncCfg);
  const put = env.calls.find((c) => c.method === 'PUT');
  assert('T4: 云端404时上传本地规则', !!put && put.data.includes('*://a.example.com/*') && put.data.includes('*://b.example.com/*'));
}

{
  const env = makeSyncEnv({
    cloudText: '<!DOCTYPE html><html><body>login</body></html>',
    localRules: ['*://keep.example.com/*'],
    localTime: 1000,
  });
  env.setCurrent({ rules: ['*://keep.example.com/*'], enabled: true });
  await env.run(syncCfg);
  const cur = env.getCurrent();
  assert('T5: HTML响应不覆盖本地规则', cur.rules[0] === '*://keep.example.com/*');
  assert('T5b: HTML响应不上传', env.calls.filter((c) => c.method === 'PUT').length === 0);
}

// T6: 多标签页感知 checkExternalConfigChange
function makeAdoptEnv({ storedConfig, memoryConfig, panelOpen }) {
  const store = new Map([[KEYS.CONFIG_KEY, storedConfig]]);
  const state = { reprocess: 0 };
  const factory = new Function('store', 'state', 'document', 'memory', `
    const CONFIG_KEY = ${JSON.stringify(KEYS.CONFIG_KEY)};
    const GM_getValue = (k, d) => (store.has(k) ? store.get(k) : d);
    function forceReprocessAll() { state.reprocess++; }
    let currentConfig = memory;
    ${extractFn(src, 'adoptStoredConfigIfNewer')}
    ${extractFn(src, 'checkExternalConfigChange')}
    return { check: () => checkExternalConfigChange(), current: () => currentConfig, state };
  `);
  return factory(store, state, { getElementById: () => (panelOpen ? {} : null) }, memoryConfig);
}
{
  const stored = { rules: ['a', 'b'], enabled: false };
  const env = makeAdoptEnv({ storedConfig: stored, memoryConfig: { rules: ['a'], enabled: true }, panelOpen: false });
  const changed = env.check();
  assert('T6: 存储配置较新时采纳', changed === true && env.current() === stored && env.state.reprocess === 1);
}
{
  const stored = { rules: ['a', 'b'], enabled: false };
  const memory = { rules: ['a'], enabled: true };
  const env = makeAdoptEnv({ storedConfig: stored, memoryConfig: memory, panelOpen: true });
  const changed = env.check();
  assert('T6b: 主面板打开时不采纳', changed === false && env.current() === memory && env.state.reprocess === 0);
}
{
  const same = { rules: ['a'], enabled: true };
  const env = makeAdoptEnv({ storedConfig: same, memoryConfig: { rules: ['a'], enabled: true }, panelOpen: false });
  assert('T6c: 配置一致时不重复处理', env.check() === false && env.state.reprocess === 0);
}

// T7: persistConfig 默认不更新时间戳，仅在显式传入 true 时更新
{
  const store = new Map();
  store.set(KEYS.LOCAL_LAST_MODIFIED_KEY, 12345);
  let currentConfig = { rules: ['a'], bubbleSize: 30 };
  const persistConfigFn = new Function('store', 'CONFIG_KEY', 'LOCAL_LAST_MODIFIED_KEY', 'currentConfig', `
    const GM_setValue = (k, v) => { store.set(k, v); };
    ${extractFn(src, 'persistConfig')}
    return persistConfig;
  `)(store, KEYS.CONFIG_KEY, KEYS.LOCAL_LAST_MODIFIED_KEY, currentConfig);

  persistConfigFn(); // 默认未传参（非规则变更）
  assert('T7: persistConfig 默认不修改本地时间戳', store.get(KEYS.LOCAL_LAST_MODIFIED_KEY) === 12345);

  persistConfigFn(false); // 显式传 false
  assert('T7b: persistConfig(false) 不修改本地时间戳', store.get(KEYS.LOCAL_LAST_MODIFIED_KEY) === 12345);

  persistConfigFn(true); // 规则变更显式传 true
  assert('T7c: persistConfig(true) 刷新本地时间戳', store.get(KEYS.LOCAL_LAST_MODIFIED_KEY) > 12345);

  // T7d: saveConfig 逻辑模拟：仅当 rules 实质改变时传入 true
  const saveMock = (prevRules, newRules) => {
    const rulesChanged = JSON.stringify(prevRules) !== JSON.stringify(newRules);
    persistConfigFn(rulesChanged);
  };
  store.set(KEYS.LOCAL_LAST_MODIFIED_KEY, 12345);
  saveMock(['a', 'b'], ['a', 'b']); // 规则未变
  assert('T7d: saveConfig 在规则未变时不更新时间戳', store.get(KEYS.LOCAL_LAST_MODIFIED_KEY) === 12345);
  saveMock(['a', 'b'], ['a', 'b', 'c']); // 规则改变
  assert('T7e: saveConfig 在规则改变时更新时间戳', store.get(KEYS.LOCAL_LAST_MODIFIED_KEY) > 12345);
}

// T8: 未开启配置同步 + Last-Modified秒级时间戳 + 内容一致 -> 不重复上传(死循环回归)
{
  const rules = ['*://same.example.com/*'];
  const lastMod = 'Mon, 14 Sep 2026 08:00:00 GMT';
  const cloudTimeMs = Date.parse(lastMod);
  const env = makeSyncEnv({
    cloudText: rules.join('\n'),
    localRules: [...rules],
    localTime: cloudTimeMs + 456, // 毫秒级本地时间戳
    syncConfig: false,
    responseHeaders: `last-modified: ${lastMod}`,
  });
  env.setCurrent({ rules: [...rules], enabled: true });
  await env.run(syncCfg);
  assert('T8: 内容一致且仅时间戳精度差异时不重复上传', env.calls.filter((c) => c.method === 'PUT').length === 0);
  assert('T8b: 本地时间戳对齐为云端Last-Modified', env.store.get(KEYS.LOCAL_LAST_MODIFIED_KEY) === cloudTimeMs);
  assert('T8c: 本地规则未被改动', JSON.stringify(env.getCurrent().rules) === JSON.stringify(rules));
}

// T9: 未开启配置同步 + 内容确实不同 -> 仍正常上传
{
  const lastMod = 'Mon, 14 Sep 2026 08:00:00 GMT';
  const env = makeSyncEnv({
    cloudText: '*://cloud.example.com/*',
    localRules: ['*://local.example.com/*'],
    localTime: Date.parse(lastMod) + 456,
    syncConfig: false,
    responseHeaders: `last-modified: ${lastMod}`,
  });
  env.setCurrent({ rules: ['*://local.example.com/*'], enabled: true });
  await env.run(syncCfg);
  const put = env.calls.find((c) => c.method === 'PUT');
  assert('T9: 内容不同时仍触发上传', !!put && put.data === '*://local.example.com/*');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
})();
