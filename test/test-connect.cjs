// 同步: 跨域权限 / WebDAV 同步仲裁 / 订阅 / 错误响应防护 / 跨页锁
// 命名规则: 同步-三位序号: 描述; 循环组为 同步-序号-用例号
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
// ==== [同步-001~005] 跨域权限声明 ====
function assert(name, cond) {
  if (cond) { pass++; console.log('PASS', name); }
  else { fail++; console.log('FAIL', name); }
}

assert('同步-001: 声明了 @connect', connectLines.length > 0);
assert('同步-002: 允许任意主机', connectLines.includes('*'));
assert('同步-003: 订阅主机放行', connectAllows('raw.githubusercontent.com'));
assert('同步-004: 坚果云 WebDAV 放行', connectAllows('dav.jianguoyun.com'));
assert('同步-005: 其他 WebDAV 主机放行', connectAllows('webdav.example.com'));

// ==== [同步-006~130] 自动同步方向仲裁(云端较新才应用云端设置; 本地较新或有独有规则时上传) ====
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
  WEBDAV_SYNC_SNAPSHOT_KEY: 'searchfilter_webdav_sync_snapshot',
  SUBSCRIPTION_SYNC_SNAPSHOT_KEY: 'searchfilter_subscription_sync_snapshot',
  WEBDAV_LAST_SYNC_SELECTORS_KEY: 'searchfilter_webdav_last_sync_selectors'
};

const syncFns = [
  'getRuleKey', 'filterValidRuleLines', 'getSubscriptionSyncSnapshot', 'setSubscriptionSyncSnapshot',
  'getRuleSyncSnapshot', 'setRuleSyncSnapshot', 'mergeRules3Way',
  'stripRuleComment', 'isHttpsUrl', 'getWebDAVRequest', 'ensureWebDAVFolder', 'isHtmlResponse', 'isInvalidSyncResponse', 'parseSyncHeader',
  'buildUploadContent', 'gmPutWebDAV',
  'getSelectorSyncSnapshot', 'setSelectorSyncSnapshot', 'selectorsEqual', 'mergeSelectors3Way',
  'firstSuccess', 'parseHttpDateHeader', 'queryNetworkTimeEndpoint', 'getNetworkTimeOffset', 'getTrustedNow',
  'extractValidCloudTimes', 'applyConfigToMainPanel',
  'buildSyncPayload', 'applyCloudSubscriptions', 'adoptStoredConfigIfNewer', 'getDefaultConfig',
  'checkExternalConfigChange', 'triggerWebDAVSyncDelayed', 'performAutoWebDAVSync', 'performWebDAVDownload',
].map((n) => extractFn(src, n));

const netTimePrelude = `
    const WEBDAV_LAST_SYNC_SELECTORS_KEY = ${JSON.stringify(KEYS.WEBDAV_LAST_SYNC_SELECTORS_KEY)};
    const WEBDAV_TIME_TOLERANCE = 5 * 60 * 1000;
    const NET_TIME_CACHE_TTL = 30 * 60 * 1000;
    const NET_TIME_FAIL_TTL = 10 * 60 * 1000;
    let _netTimeOffset = null;
    let _netTimeCheckedAt = 0;
    let _netTimeQuerying = null;
`;

function makeSyncEnv({ cloudStatus = 200, cloudText = '', localRules = [], localTime = 0, localSubs = [], storedConfig = undefined, syncConfig = true, responseHeaders = '', putFailures = 0, initialSnapshot = undefined, initialSubSnapshot = undefined }) {
  const store = new Map();
  store.set(KEYS.WEBDAV_SYNC_CONFIG_KEY, syncConfig);
  store.set(KEYS.WEBDAV_SYNC_SELECTORS_KEY, false);
  store.set(KEYS.LOCAL_LAST_MODIFIED_KEY, localTime);
  store.set(KEYS.WEBDAV_LAST_SYNC_KEY, 0);
  store.set('subs', localSubs);
  if (initialSnapshot !== undefined) store.set(KEYS.WEBDAV_SYNC_SNAPSHOT_KEY, initialSnapshot);
  if (initialSubSnapshot !== undefined) store.set(KEYS.SUBSCRIPTION_SYNC_SNAPSHOT_KEY, initialSubSnapshot);
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
    const WEBDAV_SYNC_SNAPSHOT_KEY = ${JSON.stringify(KEYS.WEBDAV_SYNC_SNAPSHOT_KEY)};
    const SUBSCRIPTION_SYNC_SNAPSHOT_KEY = ${JSON.stringify(KEYS.SUBSCRIPTION_SYNC_SNAPSHOT_KEY)};
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
      store.set(CONFIG_KEY, currentConfig);
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
    const document = { getElementById: () => null };

    ${netTimePrelude}
    ${syncFns.join('\n')}
    return {
      run: (cfg) => performAutoWebDAVSync(cfg),
      download: (cfg) => performWebDAVDownload(cfg, false),
      getCurrent: () => currentConfig,
      setCurrent: (c) => { currentConfig = c; store.set(CONFIG_KEY, c); },
      getRequest: (cfg) => getWebDAVRequest(cfg),
      calls,
      store,
      state
    };
  `);
  return factory(store, calls, state, {
    status: cloudStatus,
    responseText: cloudText,
    responseHeaders
  });
}

const syncCfg = { url: 'https://dav.example.com/dav/', username: '', password: '', filename: 'rules.txt' };

// 云端较新 -> 应用云端设置 + 规则集合智能合并(保留两端独有规则) + 本地订阅与云端订阅双向合并
{
  const cloud = { enabled: false, language: 'en', syncedAt: 2000, subscriptions: [{ url: 'https://sub/x.txt', enabled: true, lastUpdate: 9 }] };
  const cloudText = '# ScriptConfig:' + JSON.stringify(cloud) + '\n*://cloud.example.com/*';
  const localSubs = [{ url: 'https://sub/x.txt', enabled: true, lastUpdate: 1, rules: ['title/foo/'], name: 'localname' }];
  const env = makeSyncEnv({ cloudText, localRules: ['*://local-old.example.com/*'], localTime: 1000, localSubs });
  env.setCurrent({ rules: ['*://local-old.example.com/*'], enabled: true, language: 'zh-CN' });
  await env.run(syncCfg);
  const cur = env.getCurrent();
  assert('同步-006: 云端较新时应用云端设置', cur.enabled === false && cur.language === 'en');
  assert('同步-007: 智能合并云端与本地规则', cur.rules.includes('*://cloud.example.com/*') && cur.rules.includes('*://local-old.example.com/*') && cur.rules.length === 2);
  assert('同步-008: 本地订阅规则与其下载时间一起保留', env.store.get('subs')[0].rules[0] === 'title/foo/' && env.store.get('subs')[0].lastUpdate === 1);
  assert('同步-009: 合并产生新内容时上传合并结果', env.calls.some((c) => c.method === 'PUT'));
  assert('同步-010: 对齐本地修改时间戳', env.store.get(KEYS.LOCAL_LAST_MODIFIED_KEY) >= 2000);
}

// 本地较新 -> 保留本地设置 + 合并上传两端规则(头含本地配置与删除标记)
{
  const cloud = { enabled: false, syncedAt: 500 };
  const cloudText = '# ScriptConfig:' + JSON.stringify(cloud) + '\n*://cloud.example.com/*';
  const localConfig = { rules: ['*://local.example.com/*'], enabled: true, language: 'zh-CN' };
  const env = makeSyncEnv({ cloudText, localRules: ['*://local.example.com/*'], localTime: 1000, storedConfig: localConfig });
  env.setCurrent({ ...localConfig });
  await env.run(syncCfg);
  const cur = env.getCurrent();
  assert('同步-011: 本地较新时保留本地设置', cur.enabled === true && cur.language === 'zh-CN');
  const put = env.calls.find((c) => c.method === 'PUT');
  assert('同步-012: 本地较新时合并上传两端规则', !!put && put.data.includes('*://local.example.com/*') && put.data.includes('*://cloud.example.com/*'));
  const header = JSON.parse(put.data.split('\n')[0].substring('# ScriptConfig:'.length));
  assert('同步-013: 上传头含本地配置', header.enabled === true && header.language === 'zh-CN');
  assert('同步-014: 更新本地修改时间戳与上传时间戳对齐', env.store.get(KEYS.LOCAL_LAST_MODIFIED_KEY) >= 1000);
}

// 412 冲突 -> 重新同步后成功
{
  const cloud = { syncedAt: 500 };
  const cloudText = '# ScriptConfig:' + JSON.stringify(cloud) + '\n*://cloud.example.com/*';
  const env = makeSyncEnv({ cloudText, localRules: ['*://local.example.com/*'], localTime: 1000, putFailures: 1 });
  env.setCurrent({ rules: ['*://local.example.com/*'] });
  await env.run(syncCfg);
  const puts = env.calls.filter((c) => c.method === 'PUT').length;
  assert('同步-015: 412冲突后重新同步并成功上传', puts === 2 && env.store.get(KEYS.LOCAL_LAST_MODIFIED_KEY) >= 1000);
}

// 412 持续冲突 -> 重试有上限，不会无限循环
{
  const cloud = { syncedAt: 500 };
  const cloudText = '# ScriptConfig:' + JSON.stringify(cloud) + '\n*://cloud.example.com/*';
  const env = makeSyncEnv({ cloudText, localRules: ['*://local.example.com/*'], localTime: 1000, putFailures: 99 });
  env.setCurrent({ rules: ['*://local.example.com/*'] });
  await env.run(syncCfg);
  const puts = env.calls.filter((c) => c.method === 'PUT').length;
  assert('同步-016: 412持续冲突最多重试3次后放弃', puts === 4);
}

// 时间戳相等且规则一致 -> 无操作
{
  const cloud = { enabled: false, syncedAt: 1000 };
  const cloudText = '# ScriptConfig:' + JSON.stringify(cloud) + '\n*://same.example.com/*';
  const env = makeSyncEnv({ cloudText, localRules: ['*://same.example.com/*'], localTime: 1000, storedConfig: { rules: ['*://same.example.com/*'], enabled: true } });
  env.setCurrent({ rules: ['*://same.example.com/*'], enabled: true });
  await env.run(syncCfg);
  assert('同步-017: 时间戳相等时无操作', env.calls.filter((c) => c.method === 'PUT').length === 0 && env.getCurrent().enabled === true);
}

// 云端404 -> 上传本地规则
{
  const env = makeSyncEnv({ cloudStatus: 404, cloudText: '', localRules: ['*://a.example.com/*', '*://b.example.com/*'], localTime: 1000 });
  env.setCurrent({ rules: ['*://a.example.com/*', '*://b.example.com/*'], enabled: true });
  await env.run(syncCfg);
  const put = env.calls.find((c) => c.method === 'PUT');
  assert('同步-018: 云端404时上传本地规则', !!put && put.data.includes('*://a.example.com/*') && put.data.includes('*://b.example.com/*'));
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
  assert('同步-019: HTML响应不覆盖本地规则', cur.rules[0] === '*://keep.example.com/*');
  assert('同步-020: HTML响应不上传', env.calls.filter((c) => c.method === 'PUT').length === 0);
}

// 多标签页感知 checkExternalConfigChange
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
  assert('同步-021: 存储配置较新时采纳', changed === true && env.current() === stored && env.state.reprocess === 1);
}
{
  const stored = { rules: ['a', 'b'], enabled: false };
  const memory = { rules: ['a'], enabled: true };
  const env = makeAdoptEnv({ storedConfig: stored, memoryConfig: memory, panelOpen: true });
  const changed = env.check();
  assert('同步-022: 主面板打开时不采纳', changed === false && env.current() === memory && env.state.reprocess === 0);
}
{
  const same = { rules: ['a'], enabled: true };
  const env = makeAdoptEnv({ storedConfig: same, memoryConfig: { rules: ['a'], enabled: true }, panelOpen: false });
  assert('同步-023: 配置一致时不重复处理', env.check() === false && env.state.reprocess === 0);
}

// persistConfig 默认不更新时间戳，仅在显式传入 true 时更新
{
  const store = new Map();
  store.set(KEYS.LOCAL_LAST_MODIFIED_KEY, 12345);
  let currentConfig = { rules: ['a'], bubbleSize: 30 };
  const persistConfigFn = new Function('store', 'CONFIG_KEY', 'LOCAL_LAST_MODIFIED_KEY', 'currentConfig', `
    const GM_setValue = (k, v) => { store.set(k, v); };
    const GM_getValue = (k, d) => (store.has(k) ? store.get(k) : d);
    ${extractFn(src, 'markLocalModifiedTime')}
    ${extractFn(src, 'persistConfig')}
    return persistConfig;
  `)(store, KEYS.CONFIG_KEY, KEYS.LOCAL_LAST_MODIFIED_KEY, currentConfig);

  persistConfigFn(); // 默认未传参（非规则变更）
  assert('同步-024: persistConfig 默认不修改本地时间戳', store.get(KEYS.LOCAL_LAST_MODIFIED_KEY) === 12345);

  persistConfigFn(false); // 显式传 false
  assert('同步-025: persistConfig(false) 不修改本地时间戳', store.get(KEYS.LOCAL_LAST_MODIFIED_KEY) === 12345);

  persistConfigFn(true); // 规则变更显式传 true
  assert('同步-026: persistConfig(true) 刷新本地时间戳', store.get(KEYS.LOCAL_LAST_MODIFIED_KEY) > 12345);

  // saveConfig 逻辑模拟：仅当 rules 实质改变时传入 true
  const saveMock = (prevRules, newRules) => {
    const rulesChanged = JSON.stringify(prevRules) !== JSON.stringify(newRules);
    persistConfigFn(rulesChanged);
  };
  store.set(KEYS.LOCAL_LAST_MODIFIED_KEY, 12345);
  saveMock(['a', 'b'], ['a', 'b']); // 规则未变
  assert('同步-027: saveConfig 在规则未变时不更新时间戳', store.get(KEYS.LOCAL_LAST_MODIFIED_KEY) === 12345);
  saveMock(['a', 'b'], ['a', 'b', 'c']); // 规则改变
  assert('同步-028: saveConfig 在规则改变时更新时间戳', store.get(KEYS.LOCAL_LAST_MODIFIED_KEY) > 12345);
}

// 未开启配置同步 + Last-Modified秒级时间戳 + 内容一致 -> 不重复上传(死循环回归)
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
  assert('同步-029: 内容一致且仅时间戳精度差异时不重复上传', env.calls.filter((c) => c.method === 'PUT').length === 0);
  assert('同步-030: 本地时间戳对齐为云端Last-Modified', env.store.get(KEYS.LOCAL_LAST_MODIFIED_KEY) === cloudTimeMs);
  assert('同步-031: 本地规则未被改动', JSON.stringify(env.getCurrent().rules) === JSON.stringify(rules));
}

// 未开启配置同步 + 内容确实不同 -> 仍正常合并并上传
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
  assert('同步-032: 内容不同时仍触发上传', !!put && put.data.includes('*://local.example.com/*') && put.data.includes('*://cloud.example.com/*'));
}

// BOM + 前5行以外的配置头仍可解析 (#6 回归)
{
  const cloud = { enabled: false, syncedAt: 3000 };
  const cloudText = '\uFEFF# c1\n# c2\n# c3\n# c4\n# c5\n# ScriptConfig:' + JSON.stringify(cloud) + '\n*://bom.example.com/*';
  const env = makeSyncEnv({ cloudText, localRules: [], localTime: 0 });
  env.setCurrent({ rules: [], enabled: true });
  await env.run(syncCfg);
  assert('同步-033: BOM+多行注释后仍解析配置头', env.getCurrent().enabled === false);
  assert('同步-034: 规则正确提取且头前注释行保留(不吞注释)', env.getCurrent().rules.includes('*://bom.example.com/*') && env.getCurrent().rules.some((r) => r.includes('# c1')));
}

// 未开启配置同步时本地设置不被云端覆盖
{
  const now = Date.now();
  const remote = { enabled: false, language: 'en', syncedAt: now - 2000 };
  const cloudText = '# ScriptConfig:' + JSON.stringify(remote) + '\n*://cloud.example.com/*';
  const env = makeSyncEnv({ cloudText, localRules: ['*://local.example.com/*'], localTime: now - 1000, syncConfig: false });
  env.setCurrent({ rules: ['*://local.example.com/*'], enabled: true });
  await env.run(syncCfg);
  const put = env.calls.find((c) => c.method === 'PUT');
  assert('同步-035: 内容变化时上传', !!put);
  assert('同步-036: 云端设置被保留', !put.data.includes('"enabled":true'));
  assert('同步-037: 未开启配置同步时本地设置不被云端覆盖', env.getCurrent().enabled === true);
}

// 云端订阅缺 enabled 时保留本地启用状态; 本地独有订阅不被丢弃 (#7 回归)
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
  assert('同步-038: 缺省 enabled 的云端订阅保持启用', !!a && a.enabled === true && a.rules[0] === 'title/foo/');
  assert('同步-039: 本地独有订阅保留', !!b && b.rules[0] === 'title/bar/');
}

// 非 https 地址被拒绝 (#3 回归)
{
  const env = makeSyncEnv({});
  let threw = false;
  try {
    env.getRequest({ url: 'http://dav.example.com/dav/', username: '', password: '', filename: 'rules.txt' });
  } catch (e) { threw = true; }
  assert('同步-040: http 地址被拒绝', threw);
  const ok = env.getRequest({ url: 'https://dav.example.com/dav/', username: '', password: '', filename: 'rules.txt' });
  assert('同步-041: https 地址正常拼接', ok.fullUrl === 'https://dav.example.com/dav/rules.txt');
}

// 订阅面板保存不再抛错且按原URL保留规则 (#1 回归)
{
  const csrFactory = new Function('container', 'subscriptions', 't', 'MAX_SUBSCRIPTIONS', `
    ${extractFn(src, 'collectSubscriptionsFromRows')}
    return collectSubscriptionsFromRows;
  `);
  const makeRow = (url, origUrl, enabled) => ({
    querySelector: (sel) => {
      if (sel === '.serh-subscription-url') return { value: url };
      if (sel === '.serh-subscription-enable-toggle') return { checked: enabled };
      if (sel === '.serh-subscription-status-message') return { textContent: '', className: '' };
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
  assert('同步-042: 收集订阅不抛错', Array.isArray(result.newSubs) && result.newSubs.length === 2);
  assert('同步-043: 未修改行保留规则与时间', result.newSubs[0].rules[0] === 'title/a/' && result.newSubs[0].lastUpdate === 7);
  assert('同步-044: URL 编辑后按原 URL 保留规则', result.newSubs[1].url === 'https://new/x.txt' && result.newSubs[1].rules[0] === 'title/old/');
}

// 3-Way 快照同步能够防止已删除的本地订阅死而复生
{
  const now = Date.now();
  const cloud = {
    syncedAt: now,
    subscriptions: [{ url: 'https://remain/x.txt', enabled: true, lastUpdate: now - 5000 }]
  };
  const cloudText = '# ScriptConfig:' + JSON.stringify(cloud) + '\n*://r.example.com/*';
  const baseSubs = [
    { url: 'https://remain/x.txt', enabled: true },
    { url: 'https://deleted/x.txt', enabled: true }
  ];
  const localSubs = [
    { url: 'https://remain/x.txt', enabled: true, lastUpdate: now - 5000, rules: ['r1'] },
    // 本地删除了 https://deleted/x.txt
    { url: 'https://truly-local/x.txt', enabled: true, lastUpdate: now - 1000, rules: ['r3'] }
  ];
  const env = makeSyncEnv({ cloudText, localRules: [], localTime: now - 10000, localSubs, initialSubSnapshot: baseSubs });
  env.setCurrent({ rules: [], enabled: true });
  await env.run(syncCfg);
  const subs = env.store.get('subs');
  assert('同步-045: 3-Way快照清除已删除本地订阅', !subs.some(s => s.url === 'https://deleted/x.txt'));
  assert('同步-046: 未被删除的本地独有订阅仍安全保留', subs.some(s => s.url === 'https://truly-local/x.txt'));
}

// 0缩进YAML与带字典项YAML规则解析 (Bug 7 & Bug 9 回归)
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
    ${extractFn(src, 'isCondExprCore')}
    ${extractFn(src, 'looksLikeCondExpr')}
    ${extractFn(src, 'extractYamlRuleItems')}
    ${extractFn(src, 'parseRulesetContent')}
    return parseRulesetContent;
  `)()(yamlWithZeroIndentAndDict);
  assert('同步-047: 0缩进YAML列表正常提取', Array.isArray(parsed.lines) && parsed.lines.length >= 2);
  assert('同步-048: 字典项跳过且后续规则未被截断', parsed.lines.includes('example.com') && parsed.lines.includes('*://*.test.com/*') && parsed.lines.includes('regular.com'));
}

// WebDAV 上传失败时绝不更新 WEBDAV_LAST_SYNC_KEY 避免死锁1小时
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
    const WEBDAV_SYNC_SNAPSHOT_KEY = ${JSON.stringify(KEYS.WEBDAV_SYNC_SNAPSHOT_KEY)};
    const SUBSCRIPTION_SYNC_SNAPSHOT_KEY = ${JSON.stringify(KEYS.SUBSCRIPTION_SYNC_SNAPSHOT_KEY)};
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
    ${netTimePrelude}
    ${syncFns.join('\n')}
    return {
      run: (cfg) => performAutoWebDAVSync(cfg),
      store
    };
  `);
  const failingEnv = failingEnvFactory(env.store, customCalls, {});
  await failingEnv.run(syncCfg);
  assert('同步-049: 上传失败不更新最后同步时间戳', env.store.get(KEYS.WEBDAV_LAST_SYNC_KEY) === 0);
}

// 手动下载 - 规则/设置强制覆盖为云端状态; 并更新快照
{
  const now = Date.now();
  const cloud = {
    syncedAt: now - 5000,
    rules: ['*://valid.com/*', '*://deleted-by-local.com/*']
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
    const WEBDAV_SYNC_SNAPSHOT_KEY = ${JSON.stringify(KEYS.WEBDAV_SYNC_SNAPSHOT_KEY)};
    const SUBSCRIPTION_SYNC_SNAPSHOT_KEY = ${JSON.stringify(KEYS.SUBSCRIPTION_SYNC_SNAPSHOT_KEY)};
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

    ${netTimePrelude}
    ${syncFns.join('\n')}
    return {
      download: (cfg) => performWebDAVDownload(cfg, false),
      current: () => currentConfig,
      store
    };
  `);
  const store = new Map();
  store.set(KEYS.WEBDAV_SYNC_CONFIG_KEY, false);

  const env = dlFactory({ rules: [] }, store, cloudText);
  await env.download(syncCfg);
  const finalRules = env.current().rules;
  assert('同步-050: 手动下载保留有效规则', finalRules.includes('*://valid.com/*'));
  assert('同步-051: 真覆盖采纳全部云端规则(本地未同步删除不再拦截)', finalRules.includes('*://deleted-by-local.com/*'));
  assert('同步-052: 下载后更新快照', Array.isArray(env.store.get(KEYS.WEBDAV_SYNC_SNAPSHOT_KEY)) && env.store.get(KEYS.WEBDAV_SYNC_SNAPSHOT_KEY).length === 2);

  // 3-Way Merge 单元测试
  {
    const merge3 = new Function(
      extractFn(src, 'stripRuleComment') + '\n' + extractFn(src, 'getRuleKey') + '\n' + extractFn(src, 'mergeRules3Way') + '\nreturn mergeRules3Way;'
    )();
    // 场景1：本地删除了 R2，云端新增了 R3
    const base1 = ['*://r1.com/*', '*://r2.com/*'];
    const local1 = ['*://r1.com/*'];
    const cloud1 = ['*://r1.com/*', '*://r2.com/*', '*://r3.com/*'];
    const res1 = merge3(base1, local1, cloud1);
    assert('同步-053: 3-way本地删除生效且云端新增保留', res1.includes('*://r1.com/*') && !res1.includes('*://r2.com/*') && res1.includes('*://r3.com/*'));

    // 场景2：云端删除了 R1，本地新增了 R4
    const base2 = ['*://r1.com/*', '*://r2.com/*'];
    const local2 = ['*://r1.com/*', '*://r2.com/*', '*://r4.com/*'];
    const cloud2 = ['*://r2.com/*'];
    const res2 = merge3(base2, local2, cloud2);
    assert('同步-054: 3-way云端删除生效且本地新增保留', !res2.includes('*://r1.com/*') && res2.includes('*://r2.com/*') && res2.includes('*://r4.com/*'));
  }
}

// 垃圾响应识别单元测试(网关 200 + JSON/纯文本错误页)
{
  const isInvalid = new Function(
    extractFn(src, 'isHtmlResponse') + '\n' + extractFn(src, 'isInvalidSyncResponse') + '\nreturn isInvalidSyncResponse;'
  )();
  assert('同步-055: JSON错误体拒绝', isInvalid('{"error":"Not Found","status":404}', '') === true);
  assert('同步-056: 纯文本状态行拒绝', isInvalid('404 Not Found', '') === true);
  assert('同步-057: 纯文本短语拒绝', isInvalid('Not Found', '') === true);
  assert('同步-058: XML错误拒绝', isInvalid('<?xml version="1.0"?><Error/>', '') === true);
  assert('同步-059: JSON content-type 拒绝', isInvalid('[1,2', 'content-type: application/json\r\n') === true);
  assert('同步-060: HTML标记拒绝', isInvalid('<html><body>x</body></html>', '') === true);
  assert('同步-061: 正常规则放行', isInvalid('*://a.com/*\n*://b.com/*', 'content-type: text/plain; charset=utf-8') === false);
  assert('同步-062: 带同步头文件放行', isInvalid('# ScriptConfig: {"syncedAt":1}\n*://a.com/*', 'content-type: text/plain') === false);
  assert('同步-063: 空文件放行', isInvalid('', '') === false);
  assert('同步-064: YAML段落文件放行', isInvalid('[Section]\nname: x', 'text/plain') === false);
  assert('同步-065: 合法规则不因 text/html 类型拒绝', isInvalid('*://a.com/*', 'content-type: text/html; charset=utf-8') === false);
  assert('同步-066: HTML注释开头拒绝', isInvalid('<!-- SSO portal -->\n<html><body>login</body></html>', '') === true);
  assert('同步-067: 任意标签开头拒绝', isInvalid('<div>gateway error</div>', '') === true);
  assert('同步-068: 截断JSON拒绝', isInvalid('{"error":"Not Fou', '') === true);
  assert('同步-069: 合法JSON数组体仍拒绝', isInvalid('[1,2]', '') === true);
}

// 订阅面板取消必须放弃未持久化的编辑(不触发保存/上传)
{
  assert('同步-070: 取消按钮先置放弃标记再关闭', /cancelDiscardsEdits = true;[\s\S]{0,120}closePanel\(\);/.test(src));
  assert('同步-071: 关闭回调仅在非取消路径持久化', /if \(!cancelDiscardsEdits\) persistCurrentSubscriptions\(\);/.test(src));
}

// G12-G13: 损坏同步头必须保留原始注释，合法头才从规则正文移除
{
  const parse = new Function(
    extractFn(src, 'parseSyncHeader') + '\nreturn parseSyncHeader;'
  )();
  const broken = parse('# ScriptConfig:{broken-json}\n*://a.com/*');
  assert('同步-072: 损坏 ScriptConfig 头保留', broken.restLines[0] === '# ScriptConfig:{broken-json}');
  const valid = parse('# ScriptConfig: {"syncedAt":1}\n*://a.com/*');
  assert('同步-073: 合法 ScriptConfig 头移除', valid.restLines[0] === '*://a.com/*' && valid.config.syncedAt === 1);
}

// 网关 200 + JSON/纯文本错误页不被当作规则写入本地, 也不回传云端
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
      ${netTimePrelude}
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
    assert(`同步-074-${gi + 1}: 错误响应被拒绝(${body.slice(0, 24)}...)`, threw);
    assert(`同步-075-${gi + 1}: 本地规则未被污染`, env.current().rules.join('|') === '*://local.example.com/*');
    assert(`同步-076-${gi + 1}: 拒绝后不回写云端`, !env.calls.includes('PUT'));
  }
}

// 自动同步遇到网关错误响应时跳过, 不合并也不上传覆盖云端
{
  const localConfig = { rules: ['*://local.example.com/*'], enabled: true };
  const env = makeSyncEnv({ cloudStatus: 200, cloudText: '{"error":"Not Found"}', localRules: ['*://local.example.com/*'], localTime: 1000, storedConfig: localConfig });
  env.setCurrent({ ...localConfig });
  await env.run(syncCfg);
  assert('同步-077: 自动同步遇到错误响应不合并', env.getCurrent().rules.join('|') === '*://local.example.com/*');
  assert('同步-078: 自动同步遇到错误响应不上传覆盖云端', !env.calls.some((c) => c.method === 'PUT'));
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
  assert('同步-079: GET期间新增规则不丢失', env.store.get(KEYS.CONFIG_KEY).rules.includes('new.example'));
  assert('同步-080: GET期间修改设置不回滚', env.store.get(KEYS.CONFIG_KEY).enabled === false);
}

// 旧面板只提交编辑，不覆盖最新订阅内容或未显示的条目。
{
  const a = 'https://a/rules';
  const b = 'https://b/rules';
  const row = {
    dataset: { originalUrl: a, originalEnabled: 'true' },
    querySelector: sel => sel === '.serh-subscription-url' ? { value: a } :
      sel === '.serh-subscription-enable-toggle' ? { checked: true } : {}
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
  assert('同步-081: 旧面板保留最新规则和时间', result[0].rules[0] === 'new.example' && result[0].lastUpdate === 20);
  assert('同步-082: 保留其他页面新增订阅', result.some(s => s.url === b));
  assert('同步-083: 未编辑的开关保留最新状态', result[0].enabled === false);
  assert('同步-084: 旧行不恢复已删除订阅', collect([latest[1]]).newSubs.length === 1);
  row.dataset.originalEnabled = 'false';
  assert('同步-085: 明确编辑的开关正常保存', collect(latest).newSubs[0].enabled === true);
  const emptyCollect = new Function('container', 'subscriptions', 't', `
    ${extractFn(src, 'collectSubscriptionsFromRows')}
    return collectSubscriptionsFromRows;
  `)({ querySelectorAll: () => [] }, [], k => k);
  assert('同步-086: 显式删除仅移除目标订阅', emptyCollect(latest, [a]).newSubs.map(s => s.url).join() === b);
}

// 正则/条件内部的 # 不能当作行尾注释参与去重。
{
  const key = new Function(`${extractFn(src, 'stripRuleComment')}\n${extractFn(src, 'getRuleKey')}\nreturn getRuleKey;`)();
  assert('同步-087: 正则中的空格#保留', key('title/foo #one/') === 'title/foo #one/');
  assert('同步-088: 不同正则不碰撞', key('title/foo #one/') !== key('title/foo #two/'));
  assert('同步-089: 条件字符串中的#保留', key('title = "foo #one"') === 'title = "foo #one"');
  assert('同步-090: 真正行尾注释仍剥离', key('title/foo/ # comment') === 'title/foo/');
  const env = makeSyncEnv({ cloudText: '', syncConfig: false });
  env.setCurrent({ rules: ['title/foo #one/', 'title/foo #two/'] });
  await env.run(syncCfg);
  assert('同步-091: 同步合并保留两条不同正则', env.getCurrent().rules.length === 2);
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
  assert('同步-092: 迟到响应不恢复已删除订阅', result.cancelled === true && subs.length === 0);
  assert('同步-093: 迟到响应保留删除墓碑', tombstones[url] === 123);
  subs = [{ url, enabled: false, rules: [] }];
  const retry = update(url, false);
  resolveResponse({ responseText: 'new.example' });
  const success = await retry;
  assert('同步-094: 已保存的新订阅可以正常导入', success.success && subs[0].rules[0] === 'new.example');
  assert('同步-095: 正常更新保留禁用状态', subs[0].enabled === false);
}

// WebDAV 保存密码不得进入 DOM，复用必须同时匹配地址与用户名，存储须混淆。
{
  const saved = { url: 'https://dav.example/a/', username: 'alice', password: 'secret', filename: 'rules.txt' };
  const api = new Function(`
    ${extractFn(src, 'hasMatchingWebDAVCredentials')}
    ${extractFn(src, 'resolveWebDAVPanelConfig')}
    return { resolve: resolveWebDAVPanelConfig };
  `)();
  const values = { ...saved, password: '' };
  assert('同步-096: 双参数匹配才复用密码', api.resolve(saved, values).password === 'secret');
  assert('同步-097: 更改地址拒绝复用', api.resolve(saved, { ...values, url: 'https://dav.example/b/' }) === null);
  assert('同步-098: 同服务商不同用户名拒绝复用', api.resolve(saved, { ...values, username: 'bob' }) === null);
  assert('同步-099: 用户名大小写不混用', api.resolve(saved, { ...values, username: 'Alice' }) === null);
  assert('同步-100: 新密码可用于新账号', api.resolve(saved, { ...values, username: 'bob', password: 'new' }).password === 'new');
  assert('同步-101: 修改文件名仍可复用', api.resolve(saved, { ...values, filename: 'other.txt' }).password === 'secret');
  const passwordInput = { value: '', type: 'password' };
  const togglePasswordBtn = { style: {}, textContent: '🐵' };
  const urlInput = { value: saved.url };
  const usernameInput = { value: saved.username };
  let stored = { ...saved };
  const ui = new Function('passwordInput', 'togglePasswordBtn', 'urlInput', 'usernameInput', 'GM_getValue', 'GM_setValue', `
    const WEBDAV_KEY = 'webdav';
    const t = k => k === 'webdavPasswordSaved' ? '已保存密码，输入以更换' : k;
    ${extractFn(src, 'webdavRandomBytes')}
    ${extractFn(src, 'webdavBytesToB64')}
    ${extractFn(src, 'webdavB64ToBytes')}
    ${extractFn(src, 'webdavXorBytes')}
    ${extractFn(src, 'obfuscateWebDAVPassword')}
    ${extractFn(src, 'deobfuscateWebDAVPassword')}
    ${extractFn(src, 'loadWebDAVConfig')}
    ${extractFn(src, 'hasMatchingWebDAVCredentials')}
    ${extractFn(src, 'updateWebDAVPasswordState')}
    ${extractFn(src, 'saveSuccessfulWebDAVConfig')}
    return { update: updateWebDAVPasswordState, save: saveSuccessfulWebDAVConfig, load: loadWebDAVConfig, obf: obfuscateWebDAVPassword, deobf: deobfuscateWebDAVPassword };
  `)(passwordInput, togglePasswordBtn, urlInput, usernameInput, () => stored, (key, value) => { stored = value; });
  ui.update();
  assert('同步-102: 已保存密码仅显示占位提示', passwordInput.value === '' && passwordInput.placeholder === '已保存密码，输入以更换');
  assert('同步-103: 空密码框隐藏显隐按钮', togglePasswordBtn.style.display === 'none');
  passwordInput.value = 'replacement';
  ui.update();
  assert('同步-104: 输入后显示显隐按钮', togglePasswordBtn.style.display === 'flex');
  passwordInput.type = 'text';
  ui.save({ ...saved, password: 'replacement' });
  assert('同步-105: 成功保存并清空输入', stored.password !== 'replacement' && passwordInput.value === '');
  assert('同步-108: 密码以混淆形式存储', typeof stored.password === 'string' && stored.password.indexOf('serhx1:') === 0);
  assert('同步-109: 混淆值可还原为明文', ui.deobf(stored.password) === 'replacement');
  assert('同步-110: 读取配置自动还原密码', ui.load().password === 'replacement');
  assert('同步-106: 保存后重置显隐状态', passwordInput.type === 'password' && togglePasswordBtn.style.display === 'none');
  usernameInput.value = 'bob';
  ui.update();
  assert('同步-107: 切换账号移除已保存提示', passwordInput.placeholder === '');
  const firstObf = stored.password;
  ui.save({ ...saved, password: 'replacement' });
  assert('同步-111: 随机密钥每次混淆结果不同', stored.password !== firstObf && ui.deobf(stored.password) === 'replacement');
  stored.password = 'legacy-plain';
  assert('同步-112: 兼容未混淆的旧明文', ui.load().password === 'legacy-plain');
  assert('同步-113: 空密码混淆为空', ui.obf('') === '' && ui.deobf('') === '');
  const unicode = ui.obf('密碼pass🔐');
  assert('同步-114: 非ASCII密码往返一致', ui.deobf(unicode) === '密碼pass🔐');
}

// 白名单/高亮前缀变体与同主体黑名单规则互不冲突
{
  const cloud = { syncedAt: 500 };
  const cloudText = '# ScriptConfig:' + JSON.stringify(cloud) + '\n@good.com';
  const env = makeSyncEnv({ cloudText, localRules: ['good.com', '@good.com', '@2 fast.com', 'fast.com'], localTime: 1000 });
  env.setCurrent({ rules: ['good.com', '@good.com', '@2 fast.com', 'fast.com'] });
  await env.run(syncCfg);
  const cur = env.getCurrent();
  assert('同步-108: 黑名单与白名单变体合并共存', cur.rules.includes('good.com') && cur.rules.includes('@good.com'));
  assert('同步-109: 高亮规则与黑名单变体合并共存', cur.rules.includes('@2 fast.com') && cur.rules.includes('fast.com'));
  assert('同步-110: 前缀变体去重后仅保留一份', cur.rules.filter((r) => r === '@good.com').length === 1);
}

// 同步锁互斥（含同页重入禁止与TTL过期）
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
  assert('同步-111: 首次获取锁成功', tabA.tryAcquire() === true);
  const tabA2 = makeLockEnv('tabA');
  assert('同步-112: 同页持锁期间不允许重入', tabA2.tryAcquire() === false);
  const tabB = makeLockEnv('tabB');
  assert('同步-113: 他页持锁期间获取失败', tabB.tryAcquire() === false);
  const lock = tabA.read();
  lock.expires = Date.now() - 1;
  store.set('searchfilter_sync_lock_webdav', lock);
  assert('同步-114: 锁过期后可重新获取', tabB.tryAcquire() === true);
}

// 手动下载网络错误空文件防护 + 云端0规则真覆盖 + 配置同步开启时按默认+云端整体替换
{
  const makeDl = (cloudText, localRules, syncConfig = false, responseHeaders = '', localConfigOverrides = {}) => {
    const store = new Map();
    store.set(KEYS.WEBDAV_SYNC_CONFIG_KEY, syncConfig);
    const f = new Function('currentConfig', 'store', 'cloudText', 'responseHeaders', `
      const console = { log: () => {}, warn: () => {} };
      const t = (k) => k;
      const CONFIG_KEY = ${JSON.stringify(KEYS.CONFIG_KEY)};
      const WEBDAV_SYNC_CONFIG_KEY = ${JSON.stringify(KEYS.WEBDAV_SYNC_CONFIG_KEY)};
      const WEBDAV_SYNC_SELECTORS_KEY = ${JSON.stringify(KEYS.WEBDAV_SYNC_SELECTORS_KEY)};
      const SELECTORS_KEY = ${JSON.stringify(KEYS.SELECTORS_KEY)};
      const LOCAL_LAST_MODIFIED_KEY = ${JSON.stringify(KEYS.LOCAL_LAST_MODIFIED_KEY)};
      const WEBDAV_LAST_SYNC_KEY = ${JSON.stringify(KEYS.WEBDAV_LAST_SYNC_KEY)};
      const WEBDAV_SYNC_SNAPSHOT_KEY = ${JSON.stringify(KEYS.WEBDAV_SYNC_SNAPSHOT_KEY)};
      const GM_getValue = (k, d) => (store.has(k) ? store.get(k) : d);
      const GM_setValue = (k, v) => { store.set(k, v); };
      async function gmRequest() {
        return { status: 200, responseText: cloudText, responseHeaders };
      }
      function forceReprocessAll() {}
      function persistConfig() {}
      function getSubscriptions() { return []; }
      function saveSubscriptions(s) {}
      function checkAutoSubscription() {}
      function getSelectorStoreSignature() { return null; }
      function resetSelectorCache() {}
      function refreshEngineSite() {}
      function updateLineNumbers() {}
      const document = { getElementById: () => null };
      ${netTimePrelude}
      ${syncFns.join('\n')}
      return {
        download: (cfg) => performWebDAVDownload(cfg, false),
        current: () => currentConfig,
        store
      };
    `);
    return f({ rules: localRules, enabled: true, staleLocalKey: 5, bubbleSize: 42, ...localConfigOverrides }, store, cloudText, responseHeaders);
  };
  const dlCfg = { url: 'https://dav.example.com/dav/', username: '', password: '', filename: 'rules.txt' };

  const emptyEnv = makeDl('', ['*://local.example.com/*']);
  const emptyResult = await emptyEnv.download(dlCfg);
  assert('同步-115: 空正文非错误页视为真实空文件并清空本地规则', emptyResult !== 'skipped' && emptyEnv.current().rules.length === 0);

  const headerOnly = '# ScriptConfig:' + JSON.stringify({ syncedAt: 100, enabled: false });
  const emptyRulesEnv = makeDl(headerOnly, ['*://local.example.com/*']);
  const emptyRulesResult = await emptyRulesEnv.download(dlCfg);
  assert('同步-116: 云端0规则且本地>0真覆盖清空本地规则', emptyRulesResult !== 'skipped' && emptyRulesEnv.current().rules.length === 0);

  const cloudFull = '# ScriptConfig:' + JSON.stringify({ syncedAt: 100, enabled: false, language: 'en' }) + '\n*://cloud.example.com/*';
  const replaceEnv = makeDl(cloudFull, ['*://local.example.com/*'], true);
  await replaceEnv.download(dlCfg);
  const replaced = replaceEnv.current();
  assert('同步-117: 整体替换为默认+云端并移除本地残留键', replaced.enabled === false && replaced.language === 'en' && replaced.staleLocalKey === undefined && replaced.showCount === false && replaced.panelCentered === true);
  assert('同步-118: 替换保留本地气泡尺寸并采纳云端规则', replaced.bubbleSize === 42 && replaced.rules.join('|') === '*://cloud.example.com/*');

  const metaEnv = makeDl('', ['*://local.example.com/*'], false, 'etag: "d41d8cd98f00b204e9800998ecf8427e"\nlast-modified: Mon, 14 Sep 2026 08:00:00 GMT');
  const metaResult = await metaEnv.download(dlCfg);
  assert('同步-119: 带服务器元数据的真实空文件允许覆盖清空', metaResult !== 'skipped' && metaEnv.current().rules.length === 0);

  const truncEnv = makeDl('', ['*://local.example.com/*'], false, 'content-length: 5\nlast-modified: Mon, 14 Sep 2026 08:00:00 GMT');
  const truncResult = await truncEnv.download(dlCfg);
  assert('同步-120: content-length>0但正文为空仍按强制覆盖清空本地规则', truncResult !== 'skipped' && truncEnv.current().rules.length === 0);

  const tsOnlyEnv = makeDl('# ScriptConfig:' + JSON.stringify({ syncedAt: 0, rulesSyncedAt: 12345 }) + '\n*://cloud.example.com/*', ['*://local.example.com/*'], true, '', { language: 'en', showCount: true });
  await tsOnlyEnv.download(dlCfg);
  const tsOnly = tsOnlyEnv.current();
  assert('同步-121: 仅时间戳头不重置本地设置', tsOnly.language === 'en' && tsOnly.showCount === true);
  assert('同步-122: 仅时间戳头仍强制覆盖规则', tsOnly.rules.join('|') === '*://cloud.example.com/*');

  const noTimeEnv = makeDl('', ['*://local.example.com/*']);
  await noTimeEnv.download(dlCfg);
  const noTimeLocal = noTimeEnv.store.get(KEYS.LOCAL_LAST_MODIFIED_KEY);
  assert('同步-123: 旧配置无时间戳时本地时间戳回退为当前时间', typeof noTimeLocal === 'number' && noTimeLocal > Date.now() - 60000);
}

// 强制上传为真覆盖 - 正文整体替换并保留选择器
{
  const store = new Map();
  store.set(KEYS.WEBDAV_SYNC_CONFIG_KEY, false);
  store.set(KEYS.WEBDAV_SYNC_SELECTORS_KEY, false);
  const f = new Function('store', `
    const WEBDAV_SYNC_CONFIG_KEY = ${JSON.stringify(KEYS.WEBDAV_SYNC_CONFIG_KEY)};
    const WEBDAV_SYNC_SELECTORS_KEY = ${JSON.stringify(KEYS.WEBDAV_SYNC_SELECTORS_KEY)};
    const GM_getValue = (k, d) => (store.has(k) ? store.get(k) : d);
    const GM_setValue = (k, v) => { store.set(k, v); };
    function getUserSelectors() { return {}; }
    ${extractFn(src, 'buildUploadContent')}
    return { build: (content, at, preserved) => buildUploadContent(content, at, preserved) };
  `);
  const env2 = f(store);
  const remoteRaw = '# ScriptConfig:' + JSON.stringify({ enabled: false });
  const out = env2.build('*://a.com/*', 9000, { rawScriptConfig: remoteRaw, rawSelectors: '# Selectors: {"foo":1}' });
  const lines = out.split('\n');
  assert('同步-124: 关闭配置同步时保留云端其他字段', lines[0].startsWith('# ScriptConfig:') && lines[0].includes('"enabled":false') && lines[0].includes('"rulesSyncedAt":9000'));
  assert('同步-125: 未开启选择器同步时原样保留云端选择器头', out.includes('# Selectors: {"foo":1}'));
  assert('同步-126: 正文为本地规则整体替换', lines[lines.length - 1] === '*://a.com/*');
}

{
  const fn = new Function(`
    const WEBDAV_TIME_TOLERANCE = 5 * 60 * 1000;
    ${extractFn(src, 'extractValidCloudTimes')}
    return extractValidCloudTimes;
  `)();
  const now = Date.now();
  const times = fn({ syncedAt: now - 1000, rulesSyncedAt: now - 500 }, now);
  assert('同步-127: 双时间戳可取较新者', times.length === 2 && Math.max(...times) === now - 500);
  const futureTimes = fn({ syncedAt: now + 60 * 60 * 1000, rulesSyncedAt: now - 500 }, now);
  assert('同步-128: 时钟错误设备的未来时间戳被剔除且保留有效字段', futureTimes.length === 1 && futureTimes[0] === now - 500);
  const allFuture = fn({ syncedAt: now + 60 * 60 * 1000, rulesSyncedAt: now + 60 * 60 * 1000 }, now);
  assert('同步-129: 双字段全部非法时返回空并回退Last-Modified', allFuture.length === 0);
  const zeroIgnored = fn({ syncedAt: 0, rulesSyncedAt: now - 500 }, now);
  assert('同步-130: 0值字段被忽略', zeroIgnored.length === 1 && zeroIgnored[0] === now - 500);
}

// ==== [同步-131~137] 云端头缺 subscriptions 字段不得误判为"云端全部删除" ====
// 自动同步跳过缺 subscriptions 字段的云端头, 本地订阅与订阅快照均保留
{
  const cloudText = '# ScriptConfig:' + JSON.stringify({ syncedAt: 0, rulesSyncedAt: 2000 }) + '\n*://cloud.example.com/*';
  const localSubs = [{ url: 'https://sub/x.txt', enabled: true, name: 'A', rules: ['title/foo/'], lastUpdate: 1 }];
  const env = makeSyncEnv({
    cloudText,
    localRules: ['*://a.example.com/*'],
    localTime: 1000,
    localSubs,
    initialSubSnapshot: [{ url: 'https://sub/x.txt', name: 'A', enabled: true }]
  });
  env.setCurrent({ rules: ['*://a.example.com/*'] });
  await env.run(syncCfg);
  assert('同步-131: 云端头缺 subscriptions 时本地订阅保留', env.store.get('subs').length === 1 && env.store.get('subs')[0].url === 'https://sub/x.txt');
  assert('同步-132: 订阅快照保留不被清空', (env.store.get(KEYS.SUBSCRIPTION_SYNC_SNAPSHOT_KEY) || []).length === 1);
  const put = env.calls.find((c) => c.method === 'PUT');
  assert('同步-133: 本地订阅补传至云端(下次 GET 头含 subscriptions)', !!put && String(put.data).includes('https://sub/x.txt'));
}
// 快照提交在 PUT 成功之后, 上传失败时删除记录保留(曾为 KI-W)
// PUT 全部失败(412 重试耗尽): 被删规则不复活, 快照基线未前移; 后续成功同步把删除传播到云端
{
  const env = makeSyncEnv({
    cloudText: '*://r.example.com/*',
    localRules: ['*://keep.example.com/*'],
    localTime: 3000,
    putFailures: 99,
    initialSnapshot: ['*://r.example.com/*', '*://keep.example.com/*']
  });
  env.setCurrent({ rules: ['*://keep.example.com/*'] });
  await env.run(syncCfg);
  const snap = env.store.get(KEYS.WEBDAV_SYNC_SNAPSHOT_KEY) || [];
  assert('同步-134: PUT 全部失败后本地已删规则不复活', !env.getCurrent().rules.includes('*://r.example.com/*'));
  assert('同步-135: PUT 失败后快照保留删除记录(基线未前移)', snap.includes('*://r.example.com/*') && snap.includes('*://keep.example.com/*'));
  env.state.putFailures = 0;
  await env.run(syncCfg);
  const lastPut = [...env.calls].reverse().find((c) => c.method === 'PUT');
  assert('同步-136: 后续成功同步把删除传播到云端(上传内容不含已删规则)', !!lastPut && !String(lastPut.data).includes('*://r.example.com/*'));
  assert('同步-137: 删除传播成功后快照与云端对齐', !env.store.get(KEYS.WEBDAV_SYNC_SNAPSHOT_KEY).includes('*://r.example.com/*'));
}

// ==== [同步-138~140] grant 声明与订阅面板时间戳回归 ====
assert('同步-138: 声明了 @grant GM_deleteValue(旧键清理可执行)', /@grant\s+GM_deleteValue/.test(header));
(() => {
  const persist = extractFn(src, 'persistCurrentSubscriptions');
  assert('同步-139: 订阅面板零变化关闭不推进同步时间戳', persist.includes('subsChanged') && /if\s*\(subsChanged\)\s*\{[^}]*markLocalModifiedTime\(\)/.test(persist));
  assert('同步-140: 订阅签名口径与同步仲裁一致(url/name/enabled)', persist.includes('s.enabled !== false') && persist.includes('.sort((a, b) => a[0] < b[0]'));
})();

// ==== [同步-141~143] 本地修改时间戳: 单调写+可信时间回正(慢钟设备设置不被云端回滚) ====
await (async () => {
  const fakeDate = { now: () => 500 };
  const store = new Map();
  store.set(KEYS.LOCAL_LAST_MODIFIED_KEY, 0);
  const mark = new Function('store', 'LOCAL_LAST_MODIFIED_KEY', 'Date', `
    const GM_setValue = (k, v) => { store.set(k, v); };
    const GM_getValue = (k, d) => (store.has(k) ? store.get(k) : d);
    async function getTrustedNow() { return 900000; }
    ${extractFn(src, 'markLocalModifiedTime')}
    return markLocalModifiedTime;
  `)(store, KEYS.LOCAL_LAST_MODIFIED_KEY, fakeDate);
  mark();
  await new Promise((r) => setTimeout(r, 20));
  assert('同步-141: 慢钟本地时间被可信时间异步回正', store.get(KEYS.LOCAL_LAST_MODIFIED_KEY) === 900000);

  const future = 900000 + 10 * 24 * 3600 * 1000;
  store.set(KEYS.LOCAL_LAST_MODIFIED_KEY, future);
  mark();
  await new Promise((r) => setTimeout(r, 20));
  assert('同步-142: 快钟/未来时间戳不被本地时间或可信时间回写倒退', store.get(KEYS.LOCAL_LAST_MODIFIED_KEY) === future);

  store.set(KEYS.LOCAL_LAST_MODIFIED_KEY, 0);
  const markNoNet = new Function('store', 'LOCAL_LAST_MODIFIED_KEY', 'Date', `
    const GM_setValue = (k, v) => { store.set(k, v); };
    const GM_getValue = (k, d) => (store.has(k) ? store.get(k) : d);
    async function getTrustedNow() { throw new Error('network down'); }
    ${extractFn(src, 'markLocalModifiedTime')}
    return markLocalModifiedTime;
  `)(store, KEYS.LOCAL_LAST_MODIFIED_KEY, fakeDate);
  let threw = false;
  try { markNoNet(); } catch (e) { threw = true; }
  await new Promise((r) => setTimeout(r, 20));
  assert('同步-143: 可信时间获取失败时保留本地时间写入且不抛未捕获异常', !threw && store.get(KEYS.LOCAL_LAST_MODIFIED_KEY) === 500);
})();

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
})();
