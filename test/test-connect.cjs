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
  TOMBSTONES_KEY: 'searchfilter_rule_tombstones',
};

const syncFns = [
  'getRuleKey', 'getLocalRuleAddedTimes', 'recordRuleAddedTimes', 'getLocalTombstones', 'recordRuleDeletions', 'pruneTombstones', 'mergeRulesWithTombstones',
  'getSubscriptionTombstones', 'recordSubscriptionDeletions',
  'stripRuleComment', 'isHttpsUrl', 'getWebDAVRequest', 'ensureWebDAVFolder', 'isHtmlResponse', 'isInvalidSyncResponse', 'parseSyncHeader', 'parseRemoteConfig', 'mergeTimeMaps',
  'buildMetadataConfigPayload', 'buildUploadContent',
  'buildSyncPayload', 'applyCloudSubscriptions', 'adoptStoredConfigIfNewer',
  'checkExternalConfigChange', 'triggerWebDAVSyncDelayed', 'performAutoWebDAVSync', 'performWebDAVDownload',
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
    const t = (k) => k;
    const CONFIG_KEY = ${JSON.stringify(KEYS.CONFIG_KEY)};
    const WEBDAV_SYNC_CONFIG_KEY = ${JSON.stringify(KEYS.WEBDAV_SYNC_CONFIG_KEY)};
    const WEBDAV_SYNC_SELECTORS_KEY = ${JSON.stringify(KEYS.WEBDAV_SYNC_SELECTORS_KEY)};
    const SELECTORS_KEY = ${JSON.stringify(KEYS.SELECTORS_KEY)};
    const LOCAL_LAST_MODIFIED_KEY = ${JSON.stringify(KEYS.LOCAL_LAST_MODIFIED_KEY)};
    const WEBDAV_LAST_SYNC_KEY = ${JSON.stringify(KEYS.WEBDAV_LAST_SYNC_KEY)};
    const TOMBSTONES_KEY = ${JSON.stringify(KEYS.TOMBSTONES_KEY)};
    const SUBSCRIPTION_TOMBSTONES_KEY = 'searchfilter_subscription_tombstones';
    const LOCAL_RULE_ADDED_KEY = 'searchfilter_rule_added_times';
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
      getRequest: (cfg) => getWebDAVRequest(cfg),
      store,
      calls,
      state,
    };
  `);
  return factory(store, calls, state, { status: cloudStatus, responseText: cloudText, responseHeaders });
}

const syncCfg = { url: 'https://dav.example.com/dav/', username: '', password: '', filename: 'rules.txt' };

// T1: 云端较新 -> 应用云端设置 + 规则集合智能合并(保留两端独有规则) + 本地订阅与云端订阅双向合并
{
  const cloud = { enabled: false, language: 'en', syncedAt: 2000, subscriptions: [{ url: 'https://sub/x.txt', enabled: true, lastUpdate: 9 }] };
  const cloudText = '# ScriptConfig:' + JSON.stringify(cloud) + '\n*://cloud.example.com/*';
  const localSubs = [{ url: 'https://sub/x.txt', enabled: true, lastUpdate: 1, rules: ['title/foo/'], name: 'localname' }];
  const env = makeSyncEnv({ cloudText, localRules: ['*://local-old.example.com/*'], localTime: 1000, localSubs });
  env.setCurrent({ rules: ['*://local-old.example.com/*'], enabled: true, language: 'zh-CN' });
  await env.run(syncCfg);
  const cur = env.getCurrent();
  assert('T1: 云端较新时应用云端设置', cur.enabled === false && cur.language === 'en');
  assert('T1b: 智能合并云端与本地规则', cur.rules.includes('*://cloud.example.com/*') && cur.rules.includes('*://local-old.example.com/*') && cur.rules.length === 2);
  assert('T1c: 本地订阅规则数组保留', env.store.get('subs')[0].rules[0] === 'title/foo/' && env.store.get('subs')[0].lastUpdate === 9);
  assert('T1d: 合并产生新内容时上传合并结果', env.calls.some((c) => c.method === 'PUT'));
  assert('T1e: 对齐本地修改时间戳', env.store.get(KEYS.LOCAL_LAST_MODIFIED_KEY) >= 2000);
}

// T2: 本地较新 -> 保留本地设置 + 合并上传两端规则(头含本地配置与删除标记)
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
  assert('T2b: 本地较新时合并上传两端规则', !!put && put.data.includes('*://local.example.com/*') && put.data.includes('*://cloud.example.com/*'));
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

// T9: 未开启配置同步 + 内容确实不同 -> 仍正常合并并上传
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
  assert('T9: 内容不同时仍触发上传', !!put && put.data.includes('*://local.example.com/*') && put.data.includes('*://cloud.example.com/*'));
}

// T10: BOM + 前5行以外的配置头仍可解析 (#6 回归)
{
  const cloud = { enabled: false, syncedAt: 3000 };
  const cloudText = '\uFEFF# c1\n# c2\n# c3\n# c4\n# c5\n# ScriptConfig:' + JSON.stringify(cloud) + '\n*://bom.example.com/*';
  const env = makeSyncEnv({ cloudText, localRules: [], localTime: 0 });
  env.setCurrent({ rules: [], enabled: true });
  await env.run(syncCfg);
  assert('T10: BOM+多行注释后仍解析配置头', env.getCurrent().enabled === false);
  assert('T10b: 规则正确提取且头前注释行保留(不吞注释)', env.getCurrent().rules.includes('*://bom.example.com/*') && env.getCurrent().rules.some((r) => r.includes('# c1')));
}

// T11: 未开启配置同步时仍写入/合并墓碑 (#5 回归)
{
  const now = Date.now();
  const remote = { enabled: false, language: 'en', syncedAt: now - 2000, tombstones: { '*://old.example.com/*': now - 5000 } };
  const cloudText = '# ScriptConfig:' + JSON.stringify(remote) + '\n*://cloud.example.com/*';
  const env = makeSyncEnv({ cloudText, localRules: ['*://local.example.com/*'], localTime: now - 1000, syncConfig: false });
  env.store.set(KEYS.TOMBSTONES_KEY, { '*://deleted.example.com/*': now - 4000 });
  env.setCurrent({ rules: ['*://local.example.com/*'], enabled: true });
  await env.run(syncCfg);
  const put = env.calls.find((c) => c.method === 'PUT');
  assert('T11: 内容变化时上传', !!put);
  const header = JSON.parse(put.data.split('\n')[0].substring('# ScriptConfig:'.length));
  assert('T11b: 本地墓碑写入云端头', header.tombstones['*://deleted.example.com/*'] === now - 4000);
  assert('T11c: 云端墓碑被保留', header.tombstones['*://old.example.com/*'] === now - 5000);
  assert('T11d: 云端设置被保留', header.enabled === false && header.language === 'en');
  assert('T11e: 未开启配置同步时本地设置不被云端覆盖', env.getCurrent().enabled === true);
}

// T12: 云端订阅缺 enabled 时保留本地启用状态; 本地独有订阅不被丢弃 (#7 回归)
{
  const cloud = { syncedAt: 5000, subscriptions: [{ url: 'https://a/x.txt' }] };
  const cloudText = '# ScriptConfig:' + JSON.stringify(cloud) + '\n*://r.example.com/*';
  const localSubs = [
    { url: 'https://a/x.txt', enabled: true, lastUpdate: 1, rules: ['title/foo/'] },
    { url: 'https://b/y.txt', enabled: true, lastUpdate: 2, rules: ['title/bar/'] }
  ];
  const env = makeSyncEnv({ cloudText, localRules: [], localTime: 1000, localSubs });
  env.setCurrent({ rules: [], enabled: true });
  await env.run(syncCfg);
  const subs = env.store.get('subs');
  const a = subs.find((s) => s.url === 'https://a/x.txt');
  const b = subs.find((s) => s.url === 'https://b/y.txt');
  assert('T12: 缺省 enabled 的云端订阅保持启用', !!a && a.enabled === true && a.rules[0] === 'title/foo/');
  assert('T12b: 本地独有订阅保留', !!b && b.rules[0] === 'title/bar/');
}

// T13: 非 https 地址被拒绝 (#3 回归)
{
  const env = makeSyncEnv({});
  let threw = false;
  try {
    env.getRequest({ url: 'http://dav.example.com/dav/', username: '', password: '', filename: 'rules.txt' });
  } catch (e) { threw = true; }
  assert('T13: http 地址被拒绝', threw);
  const ok = env.getRequest({ url: 'https://dav.example.com/dav/', username: '', password: '', filename: 'rules.txt' });
  assert('T13b: https 地址正常拼接', ok.fullUrl === 'https://dav.example.com/dav/rules.txt');
}

// T14: 订阅面板保存不再抛错且按原URL保留规则 (#1 回归)
{
  const csrFactory = new Function('container', 'subscriptions', 't', 'MAX_SUBSCRIPTIONS', `
    ${extractFn(src, 'collectSubscriptionsFromRows')}
    return collectSubscriptionsFromRows;
  `);
  const makeRow = (url, origUrl, enabled) => ({
    querySelector: (sel) => {
      if (sel === '.subscription-url') return { value: url };
      if (sel === '.subscription-enable-toggle') return { checked: enabled };
      if (sel === '.subscription-status-message') return { textContent: '', className: '' };
      return null;
    },
    dataset: { originalUrl: origUrl }
  });
  const container = { querySelectorAll: () => [makeRow('https://a/x.txt', 'https://a/x.txt', true), makeRow('https://new/x.txt', 'https://old/x.txt', true)] };
  const subs = [
    { url: 'https://a/x.txt', enabled: true, lastUpdate: 7, rules: ['title/a/'], name: 'A' },
    { url: 'https://old/x.txt', enabled: true, lastUpdate: 8, rules: ['title/old/'], name: 'Old' }
  ];
  const result = csrFactory(container, subs, (k) => k, 100)();
  assert('T14: 收集订阅不抛错', Array.isArray(result.newSubs) && result.newSubs.length === 2);
  assert('T14b: 未修改行保留规则与时间', result.newSubs[0].rules[0] === 'title/a/' && result.newSubs[0].lastUpdate === 7);
  assert('T14c: URL 编辑后按原 URL 保留规则', result.newSubs[1].url === 'https://new/x.txt' && result.newSubs[1].rules[0] === 'title/old/');
}

// T15: 上传/保存路径共用规则差异记录 (#2 回归)
{
  const deleted = [];
  const added = [];
  const diffFactory = new Function('recordRuleDeletions', 'recordRuleAddedTimes', 'getRuleKey', `
    ${extractFn(src, 'applyRuleDiff')}
    return applyRuleDiff;
  `);
  const getRuleKeyFn = new Function(`
    ${extractFn(src, 'stripRuleComment')}
    ${extractFn(src, 'getRuleKey')}
    return getRuleKey;
  `)();
  const diff = diffFactory((rules) => deleted.push(...rules), (rules) => added.push(...rules), getRuleKeyFn);
  const changed = diff(['*://a/*', '*://b/*'], ['*://b/*', '*://c/*']);
  assert('T15: 检测到规则变化', changed === true);
  assert('T15b: 记录删除', deleted.length === 1 && deleted[0] === '*://a/*');
  assert('T15c: 记录新增', added.length === 1 && added[0] === '*://c/*');
  assert('T15d: 规则未变不记录', diff(['*://a/*'], ['*://a/*']) === false);
}

// T16: 订阅墓碑能够防止已删除的本地订阅死而复生 (Bug 3 回归)
{
  const now = Date.now();
  const cloud = {
    syncedAt: now,
    subscriptions: [{ url: 'https://remain/x.txt', enabled: true, lastUpdate: now - 5000 }],
    subscriptionTombstones: { 'https://deleted/x.txt': now - 2000 }
  };
  const cloudText = '# ScriptConfig:' + JSON.stringify(cloud) + '\n*://r.example.com/*';
  const localSubs = [
    { url: 'https://remain/x.txt', enabled: true, lastUpdate: now - 5000, rules: ['r1'] },
    { url: 'https://deleted/x.txt', enabled: true, lastUpdate: now - 3000, rules: ['r2'] }, // 早于墓碑时间，应被清理
    { url: 'https://truly-local/x.txt', enabled: true, lastUpdate: now - 1000, rules: ['r3'] } // 无墓碑，应保留
  ];
  const env = makeSyncEnv({ cloudText, localRules: [], localTime: now - 10000, localSubs });
  env.setCurrent({ rules: [], enabled: true });
  await env.run(syncCfg);
  const subs = env.store.get('subs');
  assert('T16: 云端墓碑清理已删除本地订阅', !subs.some(s => s.url === 'https://deleted/x.txt'));
  assert('T16b: 未被删除的本地独有订阅仍安全保留', subs.some(s => s.url === 'https://truly-local/x.txt'));
}

// T17: 0缩进YAML与带字典项YAML规则解析 (Bug 7 & Bug 9 回归)
{
  const yamlWithZeroIndentAndDict = `name: Advanced List
rules:
- example.com
- description: some note
- site: google
- '*://*.test.com/*'
- regular.com
`;
  const parsed = new Function(`
    ${extractFn(src, 'extractYamlRuleItems')}
    ${extractFn(src, 'parseRulesetContent')}
    return parseRulesetContent;
  `)()(yamlWithZeroIndentAndDict);
  assert('T17: 0缩进YAML列表正常提取', Array.isArray(parsed.lines) && parsed.lines.length >= 2);
  assert('T17b: 字典项跳过且后续规则未被截断', parsed.lines.includes('example.com') && parsed.lines.includes('*://*.test.com/*') && parsed.lines.includes('regular.com'));
}

// T18: WebDAV 上传失败时绝不更新 WEBDAV_LAST_SYNC_KEY 避免死锁1小时
{
  const localConfig = { rules: ['*://fail.example.com/*'], enabled: true };
  const env = makeSyncEnv({ cloudStatus: 200, cloudText: '*://remote.example.com/*', localRules: ['*://fail.example.com/*'], localTime: 1000, storedConfig: localConfig });
  env.setCurrent({ ...localConfig });
  // Mock gmRequest PUT 抛出网络错误
  const oldRun = env.run;
  let customCalls = [];
  const failingEnvFactory = new Function('store', 'calls', 'state', `
    const console = { log: () => {}, warn: () => {} };
    const t = (k) => k;
    const CONFIG_KEY = ${JSON.stringify(KEYS.CONFIG_KEY)};
    const WEBDAV_SYNC_CONFIG_KEY = ${JSON.stringify(KEYS.WEBDAV_SYNC_CONFIG_KEY)};
    const WEBDAV_SYNC_SELECTORS_KEY = ${JSON.stringify(KEYS.WEBDAV_SYNC_SELECTORS_KEY)};
    const SELECTORS_KEY = ${JSON.stringify(KEYS.SELECTORS_KEY)};
    const LOCAL_LAST_MODIFIED_KEY = ${JSON.stringify(KEYS.LOCAL_LAST_MODIFIED_KEY)};
    const WEBDAV_LAST_SYNC_KEY = ${JSON.stringify(KEYS.WEBDAV_LAST_SYNC_KEY)};
    const TOMBSTONES_KEY = ${JSON.stringify(KEYS.TOMBSTONES_KEY)};
    const SUBSCRIPTION_TOMBSTONES_KEY = 'searchfilter_subscription_tombstones';
    const LOCAL_RULE_ADDED_KEY = 'searchfilter_rule_added_times';
    const MAX_SUBSCRIPTIONS = 100;
    const GM_getValue = (k, d) => (store.has(k) ? store.get(k) : d);
    const GM_setValue = (k, v) => { store.set(k, v); };
    async function gmRequest(method, url, opts = {}) {
      if (method === 'GET') return { status: 200, responseText: '*://remote.example.com/*' };
      if (method === 'PUT') throw new Error('Network Timeout');
      return { status: 200 };
    }
    function forceReprocessAll() {}
    function persistConfig(updateModifiedTime = true) {
      GM_setValue(CONFIG_KEY, currentConfig);
      if (updateModifiedTime) GM_setValue(LOCAL_LAST_MODIFIED_KEY, Date.now());
    }
    function getSubscriptions() { return []; }
    function saveSubscriptions(subs) {}
    function getUserSelectors() { return {}; }
    function getSelectorStoreSignature() { return null; }
    function resetSelectorCache() {}
    function refreshEngineSite() {}
    let currentConfig = ${JSON.stringify(localConfig)};
    ${syncFns.join('\n')}
    return {
      run: (cfg) => performAutoWebDAVSync(cfg),
      store
    };
  `);
  const failingEnv = failingEnvFactory(env.store, customCalls, {});
  await failingEnv.run(syncCfg);
  assert('T18: 上传失败不更新最后同步时间戳', env.store.get(KEYS.WEBDAV_LAST_SYNC_KEY) === 0);
}

// T19: 手动下载忽略墓碑强制覆盖云端规则并清理对应墓碑
{
  const now = Date.now();
  const cloud = {
    syncedAt: now - 5000,
    tombstones: { '*://deleted-by-cloud.com/*': now - 6000 }
  };
  const cloudText = '# ScriptConfig:' + JSON.stringify(cloud) + '\n*://valid.com/*\n*://deleted-by-local.com/*';
  
  const dlFactory = new Function('currentConfig', 'store', `
    const console = { log: () => {}, warn: () => {} };
    const t = (k) => k;
    const CONFIG_KEY = ${JSON.stringify(KEYS.CONFIG_KEY)};
    const WEBDAV_SYNC_CONFIG_KEY = ${JSON.stringify(KEYS.WEBDAV_SYNC_CONFIG_KEY)};
    const WEBDAV_SYNC_SELECTORS_KEY = ${JSON.stringify(KEYS.WEBDAV_SYNC_SELECTORS_KEY)};
    const SELECTORS_KEY = ${JSON.stringify(KEYS.SELECTORS_KEY)};
    const LOCAL_LAST_MODIFIED_KEY = ${JSON.stringify(KEYS.LOCAL_LAST_MODIFIED_KEY)};
    const WEBDAV_LAST_SYNC_KEY = ${JSON.stringify(KEYS.WEBDAV_LAST_SYNC_KEY)};
    const TOMBSTONES_KEY = ${JSON.stringify(KEYS.TOMBSTONES_KEY)};
    const SUBSCRIPTION_TOMBSTONES_KEY = 'searchfilter_subscription_tombstones';
    const LOCAL_RULE_ADDED_KEY = 'searchfilter_rule_added_times';
    const GM_getValue = (k, d) => (store.has(k) ? store.get(k) : d);
    const GM_setValue = (k, v) => { store.set(k, v); };
    async function gmRequest(method, url, opts = {}) {
      return { status: 200, responseText: ${JSON.stringify(cloudText)}, responseHeaders: '' };
    }
    function forceReprocessAll() {}
    function persistConfig() {}
    function applyCloudSubscriptions() {}
    function getSelectorStoreSignature() { return null; }
    function resetSelectorCache() {}
    function refreshEngineSite() {}
    function updateLineNumbers() {}
    const document = { getElementById: () => null };

    ${syncFns.join('\n')}
    return {
      download: (cfg) => performWebDAVDownload(cfg, false),
      current: () => currentConfig,
      store
    };
  `);
  const store = new Map();
  store.set(KEYS.WEBDAV_SYNC_CONFIG_KEY, false);
  store.set(KEYS.TOMBSTONES_KEY, { '*://deleted-by-local.com/*': now - 4000 });
  store.set(KEYS.LOCAL_RULE_ADDED_KEY, { '*://deleted-by-local.com/*': now - 10000 });
  
  const env = dlFactory({ rules: [] }, store);
  await env.download(syncCfg);
  const finalRules = env.current().rules;
  assert('T19: 手动下载正确保留有效规则', finalRules.includes('*://valid.com/*'));
  assert('T19b: 手动下载强制覆盖保留云端存在的规则(即使本地曾有墓碑)', finalRules.includes('*://deleted-by-local.com/*'));
  assert('T19c: 手动下载清理了覆盖规则的本地墓碑', !env.store.get(KEYS.TOMBSTONES_KEY)['*://deleted-by-local.com/*']);
}

// G: 垃圾响应识别单元测试(网关 200 + JSON/纯文本错误页)
{
  const isInvalid = new Function(
    extractFn(src, 'isHtmlResponse') + '\n' + extractFn(src, 'isInvalidSyncResponse') + '\nreturn isInvalidSyncResponse;'
  )();
  assert('G1: JSON错误体拒绝', isInvalid('{"error":"Not Found","status":404}', '') === true);
  assert('G2: 纯文本状态行拒绝', isInvalid('404 Not Found', '') === true);
  assert('G3: 纯文本短语拒绝', isInvalid('Not Found', '') === true);
  assert('G4: XML错误拒绝', isInvalid('<?xml version="1.0"?><Error/>', '') === true);
  assert('G5: JSON content-type 拒绝', isInvalid('[1,2', 'content-type: application/json\r\n') === true);
  assert('G6: HTML标记拒绝', isInvalid('<html><body>x</body></html>', '') === true);
  assert('G7: 正常规则放行', isInvalid('*://a.com/*\n*://b.com/*', 'content-type: text/plain; charset=utf-8') === false);
  assert('G8: 带同步头文件放行', isInvalid('# ScriptConfig: {"syncedAt":1}\n*://a.com/*', 'content-type: text/plain') === false);
  assert('G9: 空文件放行', isInvalid('', '') === false);
  assert('G10: YAML段落文件放行', isInvalid('[Section]\nname: x', 'text/plain') === false);
}

// T20: 网关 200 + JSON/纯文本错误页不被当作规则写入本地, 也不回传云端
{
  const garbageBodies = [
    '{"error":"Not Found","status":404}',
    '{"message":"Unauthorized"}',
    '404 Not Found',
    'Not Found',
    '<?xml version="1.0" encoding="UTF-8"?><Error><Code>NoSuchKey</Code></Error>'
  ];
  for (let gi = 0; gi < garbageBodies.length; gi++) {
    const body = garbageBodies[gi];
    const factory = new Function('currentConfig', 'store', `
      const console = { log: () => {}, warn: () => {} };
      const t = (k) => k;
      const CONFIG_KEY = ${JSON.stringify(KEYS.CONFIG_KEY)};
      const WEBDAV_SYNC_CONFIG_KEY = ${JSON.stringify(KEYS.WEBDAV_SYNC_CONFIG_KEY)};
      const WEBDAV_SYNC_SELECTORS_KEY = ${JSON.stringify(KEYS.WEBDAV_SYNC_SELECTORS_KEY)};
      const SELECTORS_KEY = ${JSON.stringify(KEYS.SELECTORS_KEY)};
      const LOCAL_LAST_MODIFIED_KEY = ${JSON.stringify(KEYS.LOCAL_LAST_MODIFIED_KEY)};
      const WEBDAV_LAST_SYNC_KEY = ${JSON.stringify(KEYS.WEBDAV_LAST_SYNC_KEY)};
      const TOMBSTONES_KEY = ${JSON.stringify(KEYS.TOMBSTONES_KEY)};
      const SUBSCRIPTION_TOMBSTONES_KEY = 'searchfilter_subscription_tombstones';
      const LOCAL_RULE_ADDED_KEY = 'searchfilter_rule_added_times';
      const GM_getValue = (k, d) => (store.has(k) ? store.get(k) : d);
      const GM_setValue = (k, v) => { store.set(k, v); };
      const calls = [];
      async function gmRequest(method, url, opts = {}) {
        calls.push(method);
        if (method === 'GET') return { status: 200, responseText: ${JSON.stringify(body)}, responseHeaders: 'content-type: text/plain' };
        return { status: 200 };
      }
      function forceReprocessAll() {}
      function persistConfig() {}
      function applyCloudSubscriptions() {}
      function getSelectorStoreSignature() { return null; }
      function resetSelectorCache() {}
      function refreshEngineSite() {}
      function updateLineNumbers() {}
      const document = { getElementById: () => null };
      ${syncFns.join('\n')}
      return {
        download: (cfg) => performWebDAVDownload(cfg, false),
        calls,
        current: () => currentConfig,
        store
      };
    `);
    const store = new Map();
    store.set(KEYS.WEBDAV_SYNC_CONFIG_KEY, false);
    const env = factory({ rules: ['*://local.example.com/*'] }, store);
    let threw = false;
    try { await env.download(syncCfg); } catch (_) { threw = true; }
    assert(`T20.${gi + 1}: 错误响应被拒绝(${body.slice(0, 24)}...)`, threw);
    assert(`T20.${gi + 1}b: 本地规则未被污染`, env.current().rules.join('|') === '*://local.example.com/*');
    assert(`T20.${gi + 1}c: 拒绝后不回写云端`, !env.calls.includes('PUT'));
  }
}

// T21: 自动同步遇到网关错误响应时跳过, 不合并也不上传覆盖云端
{
  const localConfig = { rules: ['*://local.example.com/*'], enabled: true };
  const env = makeSyncEnv({ cloudStatus: 200, cloudText: '{"error":"Not Found"}', localRules: ['*://local.example.com/*'], localTime: 1000, storedConfig: localConfig });
  env.setCurrent({ ...localConfig });
  await env.run(syncCfg);
  assert('T21: 自动同步遇到错误响应不合并', env.getCurrent().rules.join('|') === '*://local.example.com/*');
  assert('T21b: 自动同步遇到错误响应不上传覆盖云端', !env.calls.some((c) => c.method === 'PUT'));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
})();
