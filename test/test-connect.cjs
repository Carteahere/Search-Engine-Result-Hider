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
  'getRuleKey', 'getLocalRuleAddedTimes', 'recordRuleAddedTimes', 'filterRulesForDownloadStamp', 'getLocalTombstones', 'recordRuleDeletions', 'pruneTombstones', 'mergeRulesWithTombstones',
  'getSubscriptionTombstones', 'recordSubscriptionDeletions',
  'stripRuleComment', 'isHttpsUrl', 'getWebDAVRequest', 'ensureWebDAVFolder', 'isHtmlResponse', 'isInvalidSyncResponse', 'parseSyncHeader', 'parseRemoteConfig', 'mergeTimeMaps',
  'buildMetadataConfigPayload', 'buildUploadContent', 'gmPutWebDAV',
  'buildSyncPayload', 'applyCloudSubscriptions', 'adoptStoredConfigIfNewer',
  'checkExternalConfigChange', 'triggerWebDAVSyncDelayed', 'performAutoWebDAVSync', 'performWebDAVDownload',
].map((n) => extractFn(src, n));

function makeSyncEnv({ cloudStatus = 200, cloudText = '', localRules = [], localTime = 0, localSubs = [], storedConfig = undefined, syncConfig = true, responseHeaders = '', putFailures = 0 }) {
  const store = new Map();
  store.set(KEYS.WEBDAV_SYNC_CONFIG_KEY, syncConfig);
  store.set(KEYS.WEBDAV_SYNC_SELECTORS_KEY, false);
  store.set(KEYS.LOCAL_LAST_MODIFIED_KEY, localTime);
  store.set(KEYS.WEBDAV_LAST_SYNC_KEY, 0);
  store.set('subs', localSubs);
  if (storedConfig !== undefined) store.set(KEYS.CONFIG_KEY, storedConfig);
  const calls = [];
  const state = { reprocess: 0, putFailures };
  const factory = new Function('store', 'calls', 'state', 'mockResponse', `
    const console = { log: () => {}, warn: () => {} };
    const t = (k) => k;
    const WEBDAV_SYNC_MAX_RETRIES = 3;
    const WEBDAV_SYNC_RETRY_DELAY = 1;
    function delay(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
    const CONFIG_KEY = ${JSON.stringify(KEYS.CONFIG_KEY)};
    const WEBDAV_SYNC_CONFIG_KEY = ${JSON.stringify(KEYS.WEBDAV_SYNC_CONFIG_KEY)};
    const WEBDAV_SYNC_SELECTORS_KEY = ${JSON.stringify(KEYS.WEBDAV_SYNC_SELECTORS_KEY)};
    const SELECTORS_KEY = ${JSON.stringify(KEYS.SELECTORS_KEY)};
    const LOCAL_LAST_MODIFIED_KEY = ${JSON.stringify(KEYS.LOCAL_LAST_MODIFIED_KEY)};
    const WEBDAV_LAST_SYNC_KEY = ${JSON.stringify(KEYS.WEBDAV_LAST_SYNC_KEY)};
    const TOMBSTONES_KEY = ${JSON.stringify(KEYS.TOMBSTONES_KEY)};
    const TOMBSTONE_MAX_ENTRIES = 1000;
    const SUBSCRIPTION_TOMBSTONES_KEY = 'searchfilter_subscription_tombstones';
    const LOCAL_RULE_ADDED_KEY = 'searchfilter_rule_added_times';
    const MAX_SUBSCRIPTIONS = 100;
    const GM_getValue = (k, d) => (store.has(k) ? store.get(k) : d);
    const GM_setValue = (k, v) => { store.set(k, v); };
    async function gmRequest(method, url, opts = {}) {
      calls.push({ method, url, data: opts.data });
      if (method === 'GET') return mockResponse;
      if (state.putFailures > 0) { state.putFailures--; throw new Error('HTTP 412'); }
      return { status: 200 };
    }
    function forceReprocessAll() { state.reprocess++; }
    function persistConfig(updateModifiedTime = true) {
      GM_setValue(CONFIG_KEY, currentConfig);
      if (updateModifiedTime) GM_setValue(LOCAL_LAST_MODIFIED_KEY, Date.now());
    }
    function getSubscriptions() { return store.get('subs') || []; }
    function saveSubscriptions(subs) { store.set('subs', subs); }
    function checkAutoSubscription() {}
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
  assert('T1c: 本地订阅规则与其下载时间一起保留', env.store.get('subs')[0].rules[0] === 'title/foo/' && env.store.get('subs')[0].lastUpdate === 1);
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

// T2e: 412 冲突 -> 重新同步后成功
{
  const cloud = { syncedAt: 500 };
  const cloudText = '# ScriptConfig:' + JSON.stringify(cloud) + '\n*://cloud.example.com/*';
  const env = makeSyncEnv({ cloudText, localRules: ['*://local.example.com/*'], localTime: 1000, putFailures: 1 });
  env.setCurrent({ rules: ['*://local.example.com/*'] });
  await env.run(syncCfg);
  const puts = env.calls.filter((c) => c.method === 'PUT').length;
  assert('T2e: 412冲突后重新同步并成功上传', puts === 2 && env.store.get(KEYS.LOCAL_LAST_MODIFIED_KEY) >= 1000);
}

// T2f: 412 持续冲突 -> 重试有上限，不会无限循环
{
  const cloud = { syncedAt: 500 };
  const cloudText = '# ScriptConfig:' + JSON.stringify(cloud) + '\n*://cloud.example.com/*';
  const env = makeSyncEnv({ cloudText, localRules: ['*://local.example.com/*'], localTime: 1000, putFailures: 99 });
  env.setCurrent({ rules: ['*://local.example.com/*'] });
  await env.run(syncCfg);
  const puts = env.calls.filter((c) => c.method === 'PUT').length;
  assert('T2f: 412持续冲突最多重试3次后放弃', puts === 4);
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
    const TOMBSTONE_MAX_ENTRIES = 1000;
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
  
  const dlFactory = new Function('currentConfig', 'store', 'cloudText', `
    const console = { log: () => {}, warn: () => {} };
    const t = (k) => k;
    const CONFIG_KEY = ${JSON.stringify(KEYS.CONFIG_KEY)};
    const WEBDAV_SYNC_CONFIG_KEY = ${JSON.stringify(KEYS.WEBDAV_SYNC_CONFIG_KEY)};
    const WEBDAV_SYNC_SELECTORS_KEY = ${JSON.stringify(KEYS.WEBDAV_SYNC_SELECTORS_KEY)};
    const SELECTORS_KEY = ${JSON.stringify(KEYS.SELECTORS_KEY)};
    const LOCAL_LAST_MODIFIED_KEY = ${JSON.stringify(KEYS.LOCAL_LAST_MODIFIED_KEY)};
    const WEBDAV_LAST_SYNC_KEY = ${JSON.stringify(KEYS.WEBDAV_LAST_SYNC_KEY)};
    const TOMBSTONES_KEY = ${JSON.stringify(KEYS.TOMBSTONES_KEY)};
    const TOMBSTONE_MAX_ENTRIES = 1000;
    const SUBSCRIPTION_TOMBSTONES_KEY = 'searchfilter_subscription_tombstones';
    const LOCAL_RULE_ADDED_KEY = 'searchfilter_rule_added_times';
    const GM_getValue = (k, d) => (store.has(k) ? store.get(k) : d);
    const GM_setValue = (k, v) => { store.set(k, v); };
    async function gmRequest(method, url, opts = {}) {
      return { status: 200, responseText: cloudText, responseHeaders: '' };
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
  
  const env = dlFactory({ rules: [] }, store, cloudText);
  await env.download(syncCfg);
  const finalRules = env.current().rules;
  assert('T19: 手动下载正确保留有效规则', finalRules.includes('*://valid.com/*'));
  assert('T19b: 手动下载强制覆盖保留云端存在的规则(即使本地曾有墓碑)', finalRules.includes('*://deleted-by-local.com/*'));
  assert('T19c: 手动下载清理了覆盖规则的本地墓碑', !env.store.get(KEYS.TOMBSTONES_KEY)['*://deleted-by-local.com/*']);

  const cloudAdded = now - 60000;
  const cloudText2 = '# ScriptConfig:' + JSON.stringify({
    syncedAt: now - 5000,
    ruleAddedTimes: { '*://kept.com/*': cloudAdded }
  }) + '\n*://kept.com/*\n*://fresh.com/*';
  const store2 = new Map();
  store2.set(KEYS.WEBDAV_SYNC_CONFIG_KEY, false);
  const env2 = dlFactory({ rules: [] }, store2, cloudText2);
  await env2.download(syncCfg);
  const times2 = env2.store.get('searchfilter_rule_added_times');
  assert('T20: 云端已有 ruleAddedTimes 的下载规则不被本机时间覆盖', times2['*://kept.com/*'] === cloudAdded);
  assert('T20b: 云端无时间戳的下载规则仍盖本机时间', typeof times2['*://fresh.com/*'] === 'number' && times2['*://fresh.com/*'] >= now - 2000);
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
  assert('G11: 合法规则不因 text/html 类型拒绝', isInvalid('*://a.com/*', 'content-type: text/html; charset=utf-8') === false);
  assert('G14: HTML注释开头拒绝', isInvalid('<!-- SSO portal -->\n<html><body>login</body></html>', '') === true);
  assert('G15: 任意标签开头拒绝', isInvalid('<div>gateway error</div>', '') === true);
  assert('G16: 截断JSON拒绝', isInvalid('{"error":"Not Fou', '') === true);
  assert('G17: 合法JSON数组体仍拒绝', isInvalid('[1,2]', '') === true);
}

// SUB-CANCEL: 订阅面板取消必须放弃未持久化的编辑(不触发保存/上传)
{
  assert('SUB-CANCEL1: 取消按钮先置放弃标记再关闭', /cancelDiscardsEdits = true;[\s\S]{0,120}closePanel\(\);/.test(src));
  assert('SUB-CANCEL2: 关闭回调仅在非取消路径持久化', /if \(!cancelDiscardsEdits\) persistCurrentSubscriptions\(\);/.test(src));
}

// G12-G13: 损坏同步头必须保留原始注释，合法头才从规则正文移除
{
  const parse = new Function(
    extractFn(src, 'parseSyncHeader') + '\nreturn parseSyncHeader;'
  )();
  const broken = parse('# ScriptConfig:{broken-json}\n*://a.com/*');
  assert('G12: 损坏 ScriptConfig 头保留', broken.restLines[0] === '# ScriptConfig:{broken-json}');
  const valid = parse('# ScriptConfig: {"syncedAt":1}\n*://a.com/*');
  assert('G13: 合法 ScriptConfig 头移除', valid.restLines[0] === '*://a.com/*' && valid.config.syncedAt === 1);
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
    const TOMBSTONE_MAX_ENTRIES = 1000;
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

// 网络等待期间另一页保存规则，提交必须使用最新本地正文。
{
  const original = { rules: ['a.example'], enabled: true };
  const env = makeSyncEnv({ cloudText: 'a.example', storedConfig: original, localTime: 1, syncConfig: false });
  env.setCurrent(structuredClone(original));
  const pending = env.run(syncCfg);
  env.store.set(KEYS.CONFIG_KEY, { rules: ['a.example', 'new.example'], enabled: false });
  env.store.set(KEYS.LOCAL_LAST_MODIFIED_KEY, 2);
  await pending;
  assert('R2: GET期间新增规则不丢失', env.store.get(KEYS.CONFIG_KEY).rules.includes('new.example'));
  assert('R2b: GET期间修改设置不回滚', env.store.get(KEYS.CONFIG_KEY).enabled === false);
}

// 旧面板只提交编辑，不覆盖最新订阅内容或未显示的条目。
{
  const a = 'https://a/rules';
  const b = 'https://b/rules';
  const row = {
    dataset: { originalUrl: a, originalEnabled: 'true' },
    querySelector: sel => sel === '.subscription-url' ? { value: a } :
      sel === '.subscription-enable-toggle' ? { checked: true } : {}
  };
  const collect = new Function('container', 'subscriptions', 't', `
    ${extractFn(src, 'collectSubscriptionsFromRows')}
    return collectSubscriptionsFromRows;
  `)({ querySelectorAll: () => [row] }, [{ url: a, rules: ['old.example'] }], k => k);
  const latest = [
    { url: a, enabled: false, rules: ['new.example'], lastUpdate: 20, name: 'New' },
    { url: b, enabled: true, rules: ['b.example'] }
  ];
  const result = collect(latest).newSubs;
  assert('R3: 旧面板保留最新规则和时间', result[0].rules[0] === 'new.example' && result[0].lastUpdate === 20);
  assert('R3b: 保留其他页面新增订阅', result.some(s => s.url === b));
  assert('R3c: 未编辑的开关保留最新状态', result[0].enabled === false);
  assert('R3d: 旧行不恢复已删除订阅', collect([latest[1]]).newSubs.length === 1);
  row.dataset.originalEnabled = 'false';
  assert('R3e: 明确编辑的开关正常保存', collect(latest).newSubs[0].enabled === true);
  const emptyCollect = new Function('container', 'subscriptions', 't', `
    ${extractFn(src, 'collectSubscriptionsFromRows')}
    return collectSubscriptionsFromRows;
  `)({ querySelectorAll: () => [] }, [], k => k);
  assert('R3f: 显式删除仅移除目标订阅', emptyCollect(latest, [a]).newSubs.map(s => s.url).join() === b);
}

// 正则/条件内部的 # 不能当作行尾注释参与去重。
{
  const key = new Function(`${extractFn(src, 'stripRuleComment')}\n${extractFn(src, 'getRuleKey')}\nreturn getRuleKey;`)();
  assert('R6: 正则中的空格#保留', key('title/foo #one/') === 'title/foo #one/');
  assert('R6b: 不同正则不碰撞', key('title/foo #one/') !== key('title/foo #two/'));
  assert('R6c: 条件字符串中的#保留', key('title = "foo #one"') === 'title = "foo #one"');
  assert('R6d: 真正行尾注释仍剥离', key('title/foo/ # comment') === 'title/foo/');
  const env = makeSyncEnv({ cloudText: '', syncConfig: false });
  env.setCurrent({ rules: ['title/foo #one/', 'title/foo #two/'] });
  await env.run(syncCfg);
  assert('R6e: 同步合并保留两条不同正则', env.getCurrent().rules.length === 2);
}

// 请求结束后已删除的订阅不能重建，也不能清除删除墓碑。
{
  const url = 'https://sub/rules';
  let subs = [{ url, enabled: false, rules: ['old.example'] }];
  let tombstones = {};
  let resolveResponse;
  const update = new Function('getSubscriptions', 'getSubscriptionTombstones', 'saveSubscriptions', 'gmRequest', 'GM_setValue', `
    const SUBSCRIPTION_TOMBSTONES_KEY = 'tombstones';
    const parseRulesetContent = content => ({ lines: [content], meta: {} });
    const collectSubscriptionRules = lines => lines;
    const isHtmlResponse = () => false;
    const t = k => k;
    ${extractFn(src, 'performSubscriptionForUrl')}
    return performSubscriptionForUrl;
  `)(() => structuredClone(subs), () => ({ ...tombstones }), value => { subs = value; },
    () => new Promise(resolve => { resolveResponse = resolve; }),
    (key, value) => { tombstones = value; });
  const pending = update(url, false);
  subs = [];
  tombstones[url] = 123;
  resolveResponse({ responseText: 'new.example' });
  const result = await pending;
  assert('R7: 迟到响应不恢复已删除订阅', result.cancelled === true && subs.length === 0);
  assert('R7b: 迟到响应保留删除墓碑', tombstones[url] === 123);
  subs = [{ url, enabled: false, rules: [] }];
  const retry = update(url, false);
  resolveResponse({ responseText: 'new.example' });
  const success = await retry;
  assert('R7c: 已保存的新订阅可以正常导入', success.success && subs[0].rules[0] === 'new.example');
  assert('R7d: 正常更新保留禁用状态', subs[0].enabled === false);
}

// WebDAV 保存密码不得进入 DOM，复用必须同时匹配地址与用户名。
{
  const saved = { url: 'https://dav.example/a/', username: 'alice', password: 'secret', filename: 'rules.txt' };
  const api = new Function(`
    ${extractFn(src, 'hasMatchingWebDAVCredentials')}
    ${extractFn(src, 'resolveWebDAVPanelConfig')}
    return { resolve: resolveWebDAVPanelConfig };
  `)();
  const values = { ...saved, password: '' };
  assert('CRED1: 双参数匹配才复用密码', api.resolve(saved, values).password === 'secret');
  assert('CRED2: 更改地址拒绝复用', api.resolve(saved, { ...values, url: 'https://dav.example/b/' }) === null);
  assert('CRED3: 同服务商不同用户名拒绝复用', api.resolve(saved, { ...values, username: 'bob' }) === null);
  assert('CRED4: 用户名大小写不混用', api.resolve(saved, { ...values, username: 'Alice' }) === null);
  assert('CRED5: 新密码可用于新账号', api.resolve(saved, { ...values, username: 'bob', password: 'new' }).password === 'new');
  assert('CRED6: 修改文件名仍可复用', api.resolve(saved, { ...values, filename: 'other.txt' }).password === 'secret');
  const passwordInput = { value: '', type: 'password' };
  const togglePasswordBtn = { style: {}, textContent: '🐵' };
  const urlInput = { value: saved.url };
  const usernameInput = { value: saved.username };
  let stored = { ...saved };
  const ui = new Function('passwordInput', 'togglePasswordBtn', 'urlInput', 'usernameInput', 'GM_getValue', 'GM_setValue', `
    const WEBDAV_KEY = 'webdav';
    const t = k => k === 'webdavPasswordSaved' ? '已保存密码，输入以更换' : k;
    ${extractFn(src, 'hasMatchingWebDAVCredentials')}
    ${extractFn(src, 'updateWebDAVPasswordState')}
    ${extractFn(src, 'saveSuccessfulWebDAVConfig')}
    return { update: updateWebDAVPasswordState, save: saveSuccessfulWebDAVConfig };
  `)(passwordInput, togglePasswordBtn, urlInput, usernameInput, () => stored, (key, value) => { stored = value; });
  ui.update();
  assert('CRED7: 已保存密码仅显示占位提示', passwordInput.value === '' && passwordInput.placeholder === '已保存密码，输入以更换');
  assert('CRED8: 空密码框隐藏显隐按钮', togglePasswordBtn.style.display === 'none');
  passwordInput.value = 'replacement';
  ui.update();
  assert('CRED9: 输入后显示显隐按钮', togglePasswordBtn.style.display === 'flex');
  passwordInput.type = 'text';
  ui.save({ ...saved, password: 'replacement' });
  assert('CRED10: 成功保存并清空输入', stored.password === 'replacement' && passwordInput.value === '');
  assert('CRED11: 保存后重置显隐状态', passwordInput.type === 'password' && togglePasswordBtn.style.display === 'none');
  usernameInput.value = 'bob';
  ui.update();
  assert('CRED12: 切换账号移除已保存提示', passwordInput.placeholder === '');
}

// 相同正文也必须传播重新添加时间，且下一轮应收敛。
{
  const now = Date.now();
  const rule = 'readded.example';
  const cloud = { syncedAt: now - 3000, ruleAddedTimes: { [rule]: now - 5000 } };
  const env = makeSyncEnv({ cloudText: '# ScriptConfig:' + JSON.stringify(cloud) + '\n' + rule, syncConfig: false });
  env.setCurrent({ rules: [rule] });
  env.store.set('searchfilter_rule_added_times', { [rule]: now });
  await env.run(syncCfg);
  const put = env.calls.find(c => c.method === 'PUT');
  assert('META1: 正文相同仍上传新添加时间', !!put && JSON.parse(put.data.split('\n')[0].slice('# ScriptConfig:'.length)).ruleAddedTimes[rule] === now);
  const next = makeSyncEnv({ cloudText: put.data, syncConfig: false });
  next.setCurrent({ rules: [rule] });
  next.store.set('searchfilter_rule_added_times', { [rule]: now });
  await next.run(syncCfg);
  assert('META2: 元数据一致不重复上传', !next.calls.some(c => c.method === 'PUT'));
  const replica = makeSyncEnv({ cloudText: put.data, syncConfig: false });
  replica.setCurrent({ rules: [] });
  replica.store.set(KEYS.TOMBSTONES_KEY, { [rule]: now - 1000 });
  await replica.run(syncCfg);
  assert('META3: 新添加时间胜过另一设备旧删除', replica.getCurrent().rules.includes(rule));
  const deletion = makeSyncEnv({ cloudText: rule, syncConfig: false });
  deletion.setCurrent({ rules: [rule] });
  deletion.store.set(KEYS.TOMBSTONES_KEY, { 'absent.example': now });
  await deletion.run(syncCfg);
  assert('META4: 仅删除元数据变化也上传', deletion.calls.some(c => c.method === 'PUT'));
}

// 普通下载不能抵消删除；云端下载时间不代表本地缓存的新鲜程度。
{
  const now = Date.now();
  const url = 'https://sub/example';
  const makeCloud = subscriptions => '# ScriptConfig:' + JSON.stringify({
    syncedAt: now, subscriptions, subscriptionTombstones: { [url]: now - 1000 }
  }) + '\nexample.com';
  for (const remote of [[], [{ url, lastUpdate: now + 1 }]]) {
    const env = makeSyncEnv({ cloudText: makeCloud(remote), localSubs: [{ url, lastUpdate: now + 1, rules: ['old.example'] }] });
    env.setCurrent({ rules: ['example.com'] });
    await env.run(syncCfg);
    assert('SUBDEL1: 刷新时间晚于删除也不能复活', env.store.get('subs').length === 0);
  }
  const readded = makeSyncEnv({ cloudText: makeCloud([{ url, addedAt: now }]), localSubs: [{ url, addedAt: now, lastUpdate: 1, rules: ['old.example'] }] });
  readded.setCurrent({ rules: ['example.com'] });
  await readded.run(syncCfg);
  assert('SUBDEL2: 显式重新添加可以胜过旧删除', readded.store.get('subs')[0].addedAt === now);
  const staleTime = now - 13 * 60 * 60 * 1000;
  const fresh = makeSyncEnv({ cloudText: '# ScriptConfig:' + JSON.stringify({ syncedAt: now, subscriptions: [{ url, lastUpdate: now }] }) + '\nexample.com',
    localSubs: [{ url, lastUpdate: staleTime, rules: ['old.example'] }] });
  fresh.setCurrent({ rules: ['example.com'] });
  await fresh.run(syncCfg);
  assert('SUBTIME1: 旧规则保留旧下载时间仍然到期', fresh.store.get('subs')[0].lastUpdate === staleTime);
}

// T9: 白名单/高亮前缀变体与同主体黑名单规则互不冲突
{
  const cloud = { syncedAt: 500 };
  const cloudText = '# ScriptConfig:' + JSON.stringify(cloud) + '\n@good.com';
  const env = makeSyncEnv({ cloudText, localRules: ['good.com', '@good.com', '@2 fast.com', 'fast.com'], localTime: 1000 });
  env.setCurrent({ rules: ['good.com', '@good.com', '@2 fast.com', 'fast.com'] });
  await env.run(syncCfg);
  const cur = env.getCurrent();
  assert('T9: 黑名单与白名单变体合并共存', cur.rules.includes('good.com') && cur.rules.includes('@good.com'));
  assert('T9b: 高亮规则与黑名单变体合并共存', cur.rules.includes('@2 fast.com') && cur.rules.includes('fast.com'));
  assert('T9c: 前缀变体去重后仅保留一份', cur.rules.filter((r) => r === '@good.com').length === 1);
}

// T10: 删除白名单变体不误删黑名单主体（墓碑键保留前缀）
{
  const store = new Map();
  const factory = new Function('store', `
    const TOMBSTONES_KEY = ${JSON.stringify(KEYS.TOMBSTONES_KEY)};
    const TOMBSTONE_MAX_ENTRIES = 1000;
    const LOCAL_RULE_ADDED_KEY = 'searchfilter_rule_added_times';
    const GM_getValue = (k, d) => (store.has(k) ? store.get(k) : d);
    const GM_setValue = (k, v) => { store.set(k, v); };
    ${extractFn(src, 'stripRuleComment')}
    ${extractFn(src, 'getRuleKey')}
    ${extractFn(src, 'getLocalTombstones')}
    ${extractFn(src, 'recordRuleDeletions')}
    ${extractFn(src, 'pruneTombstones')}
    ${extractFn(src, 'getLocalRuleAddedTimes')}
    ${extractFn(src, 'recordRuleAddedTimes')}
    ${extractFn(src, 'mergeRulesWithTombstones')}
    return { del: (rules) => recordRuleDeletions(rules), merge: (l, c, lt, ct) => mergeRulesWithTombstones(l, c, lt, ct, {}, {}) };
  `);
  const env2 = factory(store);
  env2.del(['@good.com']);
  const { mergedRules } = env2.merge(['good.com', '@good.com'], ['good.com'], 1000, 900);
  assert('T10: 删除白名单变体不误删黑名单主体', mergedRules.includes('good.com') && !mergedRules.includes('@good.com'));
}

// L: 同步锁互斥（含同页重入禁止与TTL过期）
{
  const store = new Map();
  const makeLockEnv = (myTab) => {
    const f = new Function('store', 'myTab', `
      const SYNC_LOCK_KEY_PREFIX = 'searchfilter_sync_lock_';
      const SYNC_TAB_ID = myTab;
      const SYNC_LOCK_TTL = 120000;
      const GM_getValue = (k, d) => (store.has(k) ? store.get(k) : d);
      const GM_setValue = (k, v) => { store.set(k, v); };
      ${extractFn(src, 'readSyncLock')}
      ${extractFn(src, 'writeSyncLock')}
      ${extractFn(src, 'tryAcquireSyncLock')}
      return { tryAcquire: (ttl) => tryAcquireSyncLock('webdav', ttl), read: () => GM_getValue(SYNC_LOCK_KEY_PREFIX + 'webdav') };
    `);
    return f(store, myTab);
  };
  const tabA = makeLockEnv('tabA');
  assert('L1: 首次获取锁成功', tabA.tryAcquire() === true);
  const tabA2 = makeLockEnv('tabA');
  assert('L2: 同页持锁期间不允许重入', tabA2.tryAcquire() === false);
  const tabB = makeLockEnv('tabB');
  assert('L3: 他页持锁期间获取失败', tabB.tryAcquire() === false);
  const lock = tabA.read();
  lock.expires = Date.now() - 1;
  store.set('searchfilter_sync_lock_webdav', lock);
  assert('L4: 锁过期后可重新获取', tabB.tryAcquire() === true);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
})();
