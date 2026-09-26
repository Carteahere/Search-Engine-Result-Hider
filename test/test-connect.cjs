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
function assert(name, cond, extra) {
  if (cond) { pass++; console.log('PASS', name); }
  else { fail++; console.log('FAIL', name, extra !== undefined ? JSON.stringify(extra) : ''); }
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

const baseSyncFns = [
  'getRuleKey', 'filterValidRuleLines', 'getSubscriptionSyncSnapshot', 'setSubscriptionSyncSnapshot',
  'getRuleSyncSnapshot', 'setRuleSyncSnapshot', 'mergeRules3Way',
  'stripRuleComment', 'isHttpsUrl', 'getWebDAVRequest', 'ensureWebDAVFolder', 'isHtmlResponse', 'isInvalidSyncResponse', 'parseSyncHeader', 'isNonRuleTextResponse',
  'buildUploadContent', 'gmPutWebDAV',
  'getSelectorSyncSnapshot', 'setSelectorSyncSnapshot', 'selectorsEqual', 'mergeSelectors3Way',
  'firstSuccess', 'parseHttpDateHeader', 'queryNetworkTimeEndpoint', 'getNetworkTimeOffset', 'getTrustedNow',
  'extractValidCloudTimes', 'applyConfigToMainPanel',
  'buildSyncPayload', 'applyCloudSubscriptions', 'adoptStoredConfigIfNewer', 'getDefaultConfig',
  'checkExternalConfigChange', 'triggerWebDAVSyncDelayed', 'performAutoWebDAVSync', 'performWebDAVDownload',
];
const ruleValidateFns = [
  'hostLabelToASCII', 'toASCIIHostname', 'punycodeDecodeLabel', 'toUnicodeHostname', 'safeRegexTest', 'safeDecodeURIComponent',
  'getInvalidRegexFlags', 'parseConditionPart', 'tokenizeCondExpr', 'parseCondExprTokens', 'analyzeCondExpr', 'foldCondExpr',
  'evalDynamicLeaf', 'evalCondAST', 'extractBalancedParens', 'findIfOccurrences', 'stripIfConditions', 'evaluateCondition',
  'isCondExprCore', 'looksLikeCondExpr', 'absorbStandaloneExpr', 'parseRuleWithConditions', 'extractIfConditions',
  'validateUrlWildcard', 'ruleToRegex', 'parsePrefixedRegexRule', 'escapeWildcardPart', 'wildcardToRegex',
  'matchWildcardDomainPattern', 'extractSimpleWhitelistDomain', 'matchSimpleDomain', 'compileRuleRegex',
  'validateCondition', 'analyzeRule', 'validateRule',
];
const syncFns = [...new Set(baseSyncFns.concat(ruleValidateFns))].map((n) => extractFn(src, n));
const langTextsSrc = src.match(/const LANG_TEXTS = \{[\s\S]*?\n  \};/)[0];

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
    function getUserSelectors() { return GM_getValue(SELECTORS_KEY, {}) || {}; }
    function getSelectorStoreSignature() { return null; }
    function resetSelectorCache() {}
    function refreshEngineSite() {}
    let currentConfig;
    const document = { getElementById: () => null };
    const SUPPORTED_REGEX_FLAGS = 'imsu';
    const window = { location: { hostname: 'www.google.com' } };
    function getSearchEngine() { return 'google'; }
    function getSearchCategory() { return 'web'; }
    const validationCache = new Map();
    const subdomainCache = new Map();

    ${netTimePrelude}
    ${syncFns.join('\n')}
    ${langTextsSrc}
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

    const base3 = ['# 注释1', '规则1', '# 注释2', '规则2'];
    const local3 = ['# 注释1', '规则1', '规则3', '# 注释2', '规则2'];
    const cloud3 = ['# 注释1', '规则1', '# 注释2', '规则2'];
    const res3 = merge3(base3, local3, cloud3);
    assert('同步-054b: 分组内新增保持原位置', JSON.stringify(res3) === JSON.stringify(['# 注释1', '规则1', '规则3', '# 注释2', '规则2']));

    const base4 = ['# 注释1', '规则1 # 旧', '# 注释2', '规则2'];
    const local4 = ['# 注释2', '规则2', '# 注释1', '规则1 # 新备注'];
    const cloud4 = ['# 注释1', '规则1 # 旧', '# 注释2', '规则2'];
    const res4 = merge3(base4, local4, cloud4);
    assert('同步-054c: 仅重排与改注释时保留本地顺序和注释', JSON.stringify(res4) === JSON.stringify(['# 注释2', '规则2', '# 注释1', '规则1 # 新备注']));

    const base5 = ['# 广告', 'ad.com', '# 购物', 'shop.com'];
    const local5 = ['# 购物', 'shop.com', '# 广告', 'ad.com'];
    const cloud5 = ['# 广告', 'ad.com', '# 购物', 'shop.com', 'new.com'];
    const res5 = merge3(base5, local5, cloud5);
    assert('同步-054d: 本地重排后云端新增仍落在原锚点之后', JSON.stringify(res5) === JSON.stringify(['# 购物', 'shop.com', '# 广告', 'ad.com', 'new.com']));

    const base6 = ['# 注释1', '规则1', '# 注释2', '规则2'];
    const local6 = ['# 注释1', '规则1', '规则3', '# 注释2', '规则2'];
    const cloud6 = ['# 注释1', '规则1', '# 注释2', '规则2', '规则4'];
    const res6 = merge3(base6, local6, cloud6);
    assert('同步-054e: 双方在不同锚点新增互不挤位', JSON.stringify(res6) === JSON.stringify(['# 注释1', '规则1', '规则3', '# 注释2', '规则2', '规则4']));

    const base7 = ['# 注释1', '规则1', '# 注释2', '规则2'];
    const local7 = ['# 注释1', '规则1 # 新', '# 注释2', '规则2'];
    const cloud7 = ['# 注释1', '规则1 # 旧', '# 注释2', '规则2'];
    const res7 = merge3(base7, local7, cloud7);
    assert('同步-054f: 仅改注释且顺序未变时保留本地注释', JSON.stringify(res7) === JSON.stringify(local7));

    const base8 = ['# 注释1', '规则1', '# 注释2', '规则2'];
    const local8 = ['# 注释1', '规则1', '# 注释2', '规则2'];
    const cloud8 = ['# 注释1', '规则1', '规则5', '# 注释2', '规则2'];
    const res8 = merge3(base8, local8, cloud8);
    assert('同步-054g: 云端在分组内新增时本地未改也保持该位置', JSON.stringify(res8) === JSON.stringify(cloud8));
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

// 订阅重命名撞上已占用URL时，被跳过的行也必须清掉自己的原URL，避免幽灵订阅残留并随同步扩散。
{
  const mkCollect = (rows) => new Function('container', 'subscriptions', 't', `
    ${extractFn(src, 'collectSubscriptionsFromRows')}
    return collectSubscriptionsFromRows;
  `)({ querySelectorAll: () => rows }, [], k => k);
  const makeRow = (url, origUrl) => ({
    dataset: { originalUrl: origUrl },
    querySelector: sel => sel === '.serh-subscription-url' ? { value: url } :
      sel === '.serh-subscription-enable-toggle' ? { checked: true } : {}
  });
  const A = 'https://a/rules';
  const B = 'https://b/rules';
  const C = 'https://c/rules';
  const subsAB = [
    { url: A, enabled: true, lastUpdate: 1, rules: ['a.example'] },
    { url: B, enabled: true, lastUpdate: 2, rules: ['b.example'] }
  ];
  let out = mkCollect([makeRow(B, B), makeRow(B, A)])(subsAB).newSubs;
  assert('同步-147: 重命名撞已占用URL时旧订阅不残留', out.length === 1 && out[0].url === B && out[0].rules[0] === 'b.example');
  out = mkCollect([makeRow(B, A), makeRow(B, B)])(subsAB).newSubs;
  assert('同步-148: 重命名在前时正常替换不重复', out.length === 1 && out[0].url === B);
  out = mkCollect([makeRow(C, C), makeRow(C, '')])([{ url: C, enabled: true, rules: ['c.example'] }]).newSubs;
  assert('同步-149: 重复URL的新增行不误删原有订阅', out.length === 1 && out[0].rules[0] === 'c.example');
  out = mkCollect([makeRow(C, A), makeRow(C, B)])(subsAB).newSubs;
  assert('同步-150: 多行改名为同一URL仅保留一份且旧条目清除', out.length === 1 && out[0].url === C);
  // P1-2 修复回归: 两行互换URL(各自改名为对方原URL)时必须两条订阅都保留, 不得因幽灵删除丢失一方(连同其已抓取规则)。
  out = mkCollect([makeRow(B, A), makeRow(A, B)])(subsAB).newSubs;
  assert('同步-153: 两行互换URL时两条订阅均保留', out.length === 2 && out.some(s => s.url === A && s.rules[0] === 'a.example') && out.some(s => s.url === B && s.rules[0] === 'b.example'));
}

// ❌删除按钮: 未持久化的新增行(原URL为空)不得把输入值记为已删URL, 否则同URL真实订阅被静默删除。
{
  const realUrl = 'https://x/rules';
  const makeRow = (inputVal, origUrl) => {
    const row = {
      dataset: { originalUrl: origUrl },
      input: { value: inputVal },
      removed: false,
      closest: () => row,
      querySelector: (sel) => sel === '.serh-subscription-url' ? row.input : null,
      remove: () => { row.removed = true; }
    };
    return row;
  };
  const deleteRow = (row) => {
    const deletedUrls = new Set();
    const btn = { onclick: null, closest: () => row };
    const container = { querySelectorAll: () => [btn] };
    const bind = new Function('container', 'deletedUrls', 'reindexRows', 'persistCurrentSubscriptions', 'showToast', 'forceReprocessAll', 't', `
      ${extractFn(src, 'bindDeleteEvents')}
      return bindDeleteEvents;
    `)(container, deletedUrls, () => {}, () => true, () => {}, () => {}, (k) => k);
    bind();
    btn.onclick({ stopPropagation() {} });
    return { deletedUrls, row };
  };
  const r1 = deleteRow(makeRow(realUrl, ''));
  assert('同步-151: 删除未持久化新增行不记录已删URL', r1.row.removed && r1.deletedUrls.size === 0);
  const r2 = deleteRow(makeRow('https://edited/rules', realUrl));
  assert('同步-152: 删除已存在行按原URL记录且不含改后的输入值', r2.deletedUrls.size === 1 && r2.deletedUrls.has(realUrl));
}

// 面板外点击关闭：按下起点在面板内时（如textarea拖选、取色拖拽），拖出面板松开产生的合成click不应误关面板。
{
  const docListeners = {};
  const doc = {
    addEventListener: (type, fn) => { (docListeners[type] = docListeners[type] || []).push(fn); },
    removeEventListener: (type, fn) => { docListeners[type] = (docListeners[type] || []).filter(f => f !== fn); },
    fire: (type, e) => { (docListeners[type] || []).slice().forEach(fn => fn(e)); }
  };
  const inside = { id: 'inside' };
  const outside = { id: 'outside' };
  const makePanel = () => {
    const state = { removed: false, beforeClose: false };
    const p = {
      isConnected: true,
      classList: { remove: () => {} },
      addEventListener: () => {},
      remove: () => { state.removed = true; },
      contains: (el) => el === inside,
      _cleanupClick: null
    };
    return { p, state };
  };
  const calls = { sub: 0, dav: 0 };
  const factory = new Function('document', 'panel', 'preventPanelClose', 'setTimeout', 'isSerhPanelOpen', 'checkAutoSubscription', 'checkAutoWebDAV', `
    ${extractFn(src, 'fadeOutAndRemovePanel')}
    ${extractFn(src, 'bindOutsideClickClose')}
    return bindOutsideClickClose;
  `);
  const deps = [() => false, () => { calls.sub++; }, () => { calls.dav++; }];
  const first = makePanel();
  factory(doc, first.p, false, (fn) => fn(), ...deps)(first.p, () => { first.state.beforeClose = true; });
  doc.fire('pointerdown', { target: inside });
  doc.fire('mousedown', { target: inside });
  doc.fire('click', { target: outside });
  assert('面板-001: 面板内按下拖出面板松开不误关面板', !first.state.removed && !first.state.beforeClose);
  doc.fire('pointerdown', { target: outside });
  doc.fire('click', { target: outside });
  assert('面板-002: 面板外按下点击外部仍正常关闭', first.state.removed && first.state.beforeClose);
  assert('面板-005: 面板关闭后恢复后台同步检查', calls.sub === 1 && calls.dav === 1);
  assert('面板-003: 关闭后外部监听全部移除', (docListeners.click || []).length === 0 && (docListeners.pointerdown || []).length === 0 && (docListeners.mousedown || []).length === 0 && first.p._cleanupClick === null);
  const second = makePanel();
  factory(doc, second.p, false, (fn) => fn(), ...deps)(second.p, () => { second.state.beforeClose = true; });
  doc.fire('click', { target: outside });
  assert('面板-004: 无按下记录时外部点击仍关闭', second.state.removed);
  const openDeps = [() => true, () => { calls.sub++; }, () => { calls.dav++; }];
  const subBefore = calls.sub, davBefore = calls.dav;
  const third = makePanel();
  factory(doc, third.p, false, (fn) => fn(), ...openDeps)(third.p, () => { third.state.beforeClose = true; });
  doc.fire('click', { target: outside });
  assert('面板-006: 其他面板仍打开时不恢复同步', third.state.removed && calls.sub === subBefore && calls.dav === davBefore);
}

// P1-1 修复回归: 主面板外点关闭过滤合成事件(永页机等自动翻页脚本拼接页面派发的合成click不再误关面板),
// 并记录按下起点(面板内拖选文本/拖滑块到面板外松开不再误关, 未保存编辑不丢失)。
assert('面板-007: 主面板closeHandler与pressHandler均过滤合成事件(isTrusted===false)', (src.match(/e\.isTrusted === false/g) || []).length === 2);
assert('面板-008: 主面板外点关闭带按下起点防护且关闭时同步移除监听', src.includes('const closeZoneSelector') && src.includes('window._panelPressHandler') && src.includes("removeEventListener('pointerdown', window._panelPressHandler)"));

// P2-3 修复回归: 引擎自身域名守卫仅拦截新建屏蔽, 被屏蔽结果的删除规则/白名单入口不再被拦截。
assert('面板-009: 屏蔽按钮的引擎域名守卫位于!isBlocked分支内', /if \(!isBlocked\) \{\s*const currentHost = String\(window\.location\.hostname/.test(src));

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

// ==== [审查D-1~15] 授时回退 / 选择器三方合并 / 同步头构造 / 订阅拉取容错 ====
// 审查D-1: 授时端点全部失败时 getTrustedNow 回退本地时间且不抛错
{
  const api = new Function(`
    ${netTimePrelude}
    async function gmRequest() { throw new Error('network down'); }
    ${extractFn(src, 'firstSuccess')}
    ${extractFn(src, 'queryNetworkTimeEndpoint')}
    ${extractFn(src, 'getNetworkTimeOffset')}
    ${extractFn(src, 'getTrustedNow')}
    return getTrustedNow;
  `)();
  const before = Date.now();
  const v = await api();
  assert('审查D-1: 授时全失败时回退本地时间不抛错', typeof v === 'number' && v >= before - 100 && v <= Date.now() + 100);
}

// ==== [授时源N1~N3] timeapi.io/akamai 高精度解析与竞速回退 ====
{
  const fixedMs = Date.UTC(2026, 8, 23, 17, 46, 48, 888);
  const body = JSON.stringify({ dateTime: '2026-09-23T17:46:48.888298', milliSeconds: 888 });
  const getOffset = new Function(`
    ${netTimePrelude}
    async function gmRequest(method, url) {
      if (url.startsWith('https://timeapi.io/')) return { responseText: ${JSON.stringify(body)} };
      throw new Error('endpoint down');
    }
    ${extractFn(src, 'firstSuccess')}
    ${extractFn(src, 'queryNetworkTimeEndpoint')}
    ${extractFn(src, 'getNetworkTimeOffset')}
    return getNetworkTimeOffset;
  `)();
  const offset = await getOffset();
  const expect = fixedMs - Date.now();
  assert('授时N1: timeapi.io dateTime 无时区后缀按UTC解析且保留毫秒', typeof offset === 'number' && offset !== null && Math.abs(offset - expect) < 1000);
}
{
  const sec = Math.floor(Date.now() / 1000) + 3;
  const getOffset = new Function(`
    ${netTimePrelude}
    async function gmRequest(method, url) {
      if (url.startsWith('https://time.akamai.com/')) return { responseText: ${JSON.stringify(String(sec) + '.856')} };
      throw new Error('endpoint down');
    }
    ${extractFn(src, 'firstSuccess')}
    ${extractFn(src, 'queryNetworkTimeEndpoint')}
    ${extractFn(src, 'getNetworkTimeOffset')}
    return getNetworkTimeOffset;
  `)();
  const offset = await getOffset();
  const expect = sec * 1000 + 856 - Date.now();
  assert('授时N2: akamai ?ms 浮点秒解析为毫秒时间戳', typeof offset === 'number' && offset !== null && Math.abs(offset - expect) < 1000);
}
{
  const getOffset = new Function(`
    ${netTimePrelude}
    async function gmRequest(method, url) {
      if (url.startsWith('https://timeapi.io/') || url.startsWith('https://time.akamai.com/')) throw new Error('down');
      if (url.startsWith('https://cloudflare.com/')) return { responseText: 'fl=x\\nts=1790185623.000\\nloc=CN' };
      throw new Error('unexpected ' + url);
    }
    ${extractFn(src, 'firstSuccess')}
    ${extractFn(src, 'queryNetworkTimeEndpoint')}
    ${extractFn(src, 'getNetworkTimeOffset')}
    return getNetworkTimeOffset;
  `)();
  const offset = await getOffset();
  const expect = 1790185623000 - Date.now();
  assert('授时N3: 前两源失败时回退cloudflare ts解析', typeof offset === 'number' && offset !== null && Math.abs(offset - expect) < 1000);
}

// 审查D-2/3: firstSuccess 首个成功值优先, 全部失败才拒绝
{
  const firstSuccess = new Function(`
    ${extractFn(src, 'firstSuccess')}
    return firstSuccess;
  `)();
  const v = await firstSuccess([
    Promise.reject(new Error('a')),
    new Promise((r) => setTimeout(() => r(12345), 10)),
    Promise.reject(new Error('b')),
  ]);
  assert('审查D-2: firstSuccess 取首个成功值', v === 12345);
  let rejected = false;
  try { await firstSuccess([Promise.reject(new Error('a')), Promise.reject(new Error('b'))]); } catch (_) { rejected = true; }
  assert('审查D-3: firstSuccess 全部失败时拒绝', rejected);
}

// 审查D-4~6: mergeSelectors3Way 三方合并(双方修改本地优先/双方独有保留/删除传播)
{
  const merge = new Function(`
    ${extractFn(src, 'mergeSelectors3Way')}
    return mergeSelectors3Way;
  `)();
  const base = { bing: { containers: '.old', titles: ['h2 a'] }, yahoo: { containers: '.y' } };
  const local = { bing: { containers: '.new-local', titles: ['h2 a'] }, yahoo: { containers: '.y' }, localOnly: { containers: '.l' } };
  const cloud = { bing: { containers: '.new-cloud', titles: ['h2 a'] }, yahoo: { containers: '.y' }, cloudOnly: { containers: '.c' } };
  const r1 = merge(base, local, cloud);
  assert('审查D-4: 双方都修改时本地优先', r1.bing.containers === '.new-local');
  assert('审查D-5: 双方独有选择器都保留', !!r1.localOnly && !!r1.cloudOnly);
  const r2 = merge(base, local, { bing: cloud.bing, cloudOnly: cloud.cloudOnly });
  assert('审查D-6: 云端删除的选择器传播删除', !r2.yahoo);
}

// 审查D-17: 云端头没有选择器字段时不三方合并, 保留本地并上传
{
  const localSelectors = { bing: { containers: 'li.b_algo' } };
  const cloud = { enabled: true, syncedAt: 500 };
  const cloudText = '# ScriptConfig:' + JSON.stringify(cloud) + '\n*://same.example.com/*';
  const env = makeSyncEnv({
    cloudText,
    localRules: ['*://same.example.com/*'],
    localTime: 1000,
    storedConfig: { rules: ['*://same.example.com/*'], enabled: true }
  });
  env.store.set(KEYS.WEBDAV_SYNC_SELECTORS_KEY, true);
  env.store.set(KEYS.SELECTORS_KEY, localSelectors);
  env.store.set(KEYS.WEBDAV_LAST_SYNC_SELECTORS_KEY, localSelectors);
  env.store.set(KEYS.WEBDAV_SYNC_SNAPSHOT_KEY, ['*://same.example.com/*']);
  env.setCurrent({ rules: ['*://same.example.com/*'], enabled: true });
  await env.run(syncCfg);
  const put = env.calls.find((c) => c.method === 'PUT');
  assert('审查D-17: 缺选择器字段时不把本地选择器当成云端全删', JSON.stringify(env.store.get(KEYS.SELECTORS_KEY)) === JSON.stringify(localSelectors));
  assert('审查D-18: 缺选择器字段时仍上传本地选择器', !!put && put.data.includes('# Selectors:') && put.data.includes('li.b_algo'));
}

// 审查D-7/8: selectorsEqual 与键序无关
{
  const eq = new Function(`
    ${extractFn(src, 'selectorsEqual')}
    return selectorsEqual;
  `)();
  assert('审查D-7: 键序不同视为相等', eq({ a: 1, b: { x: 1, y: 2 } }, { b: { y: 2, x: 1 }, a: 1 }));
  assert('审查D-8: 内容不同不相等', !eq({ a: 1 }, { a: 2 }));
}

// 审查D-9~11: buildSyncPayload 排除本地态字段并携带订阅摘要与时间戳
{
  const store = new Map();
  store.set(KEYS.CONFIG_KEY, { rules: ['*://r/*'], bubbleState: { top: '1' }, bubbleSize: 42, selectors: { bing: {} }, enabled: true, language: 'en' });
  const build = new Function('store', `
    const CONFIG_KEY = ${JSON.stringify(KEYS.CONFIG_KEY)};
    const GM_getValue = (k, d) => (store.has(k) ? store.get(k) : d);
    function getSubscriptions() { return [{ url: 'https://s/x', name: 'X', enabled: false, rules: ['r1'], lastUpdate: 9 }]; }
    ${extractFn(src, 'buildSyncPayload')}
    return buildSyncPayload;
  `)(store);
  const p = build(7777);
  assert('审查D-9: 同步头排除规则与气泡本地态', p.rules === undefined && p.bubbleState === undefined && p.bubbleSize === undefined && p.selectors === undefined);
  assert('审查D-10: 同步头保留设置并附订阅摘要(不含规则)', p.enabled === true && p.language === 'en' && Array.isArray(p.subscriptions) && p.subscriptions[0].url === 'https://s/x' && p.subscriptions[0].rules === undefined);
  assert('审查D-11: syncedAt 采用传入时间', p.syncedAt === 7777);
}

// 审查D-12: getWebDAVRequest 文件名子路径按段编码且凭据为 Basic 头
{
  const getReq = new Function(`
    ${extractFn(src, 'isHttpsUrl')}
    ${extractFn(src, 'safeBase64Encode')}
    function t(k) { return k; }
    ${extractFn(src, 'getWebDAVRequest')}
    return getWebDAVRequest;
  `)();
  const r = getReq({ url: 'https://dav.example.com/dav/', username: 'u', password: 'p', filename: 'sub dir/my rules.txt' });
  assert('审查D-12: 子路径与文件名分别编码', r.fullUrl === 'https://dav.example.com/dav/sub%20dir/my%20rules.txt' && r.folderUrl === 'https://dav.example.com/dav/sub%20dir/');
  const trav = getReq({ url: 'https://dav.example.com/dav/', username: 'u', password: 'p', filename: '../rules.txt' });
  assert('审查D-12b(已知问题): 文件名含../段未过滤可逃逸配置目录', trav.fullUrl === 'https://dav.example.com/dav/../rules.txt' && trav.folderUrl === 'https://dav.example.com/dav/../');
}

// 头部扫描跳过空白行: 首行为空白行时头仍可解析且头行从 restLines 剔除
{
  const parse = new Function(
    extractFn(src, 'parseSyncHeader') + '\nreturn parseSyncHeader;'
  )();
  const blank = parse('\n# ScriptConfig: {"syncedAt":7777}\n*://a.com/*');
  assert('同步-072b: 首行空行时 ScriptConfig 头仍解析', blank.config && blank.config.syncedAt === 7777);
  assert('同步-072c: 首行空行时头行从 restLines 剔除', !blank.restLines.some((l) => l.indexOf('# ScriptConfig:') === 0) && blank.restLines.join('\n') === '\n*://a.com/*');
  const midBlank = parse('# ScriptConfig: {"syncedAt":8888}\n\n# Selectors: {"a":1}\n*://b.com/*');
  assert('同步-072d: 头部间空行不打断后续头解析', midBlank.config && midBlank.config.syncedAt === 8888 && !!midBlank.config.selectors);
}

// 审查D-13/14: 订阅拉取解析为空规则集时抛错且不覆盖既有规则
{
  let saved = null;
  const subs = [{ url: 'https://sub/x', enabled: true, rules: ['old.example'], lastUpdate: 5 }];
  const api = new Function('getSubscriptions', 'saveSubscriptions', 'gmRequest', `
    const parseRulesetContent = (c) => ({ lines: String(c).split('\\n'), meta: {} });
    const collectSubscriptionRules = () => [];
    const isHtmlResponse = () => false;
    const t = (k) => k;
    ${extractFn(src, 'performSubscriptionForUrl')}
    return performSubscriptionForUrl;
  `)(
    () => subs.map((s) => ({ ...s })),
    (v) => { saved = v; },
    async () => ({ responseText: '# 只有注释\n' })
  );
  let threw = false;
  try { await api('https://sub/x', false); } catch (_) { threw = true; }
  assert('审查D-13: 空规则集拉取按失败处理', threw);
  assert('审查D-14: 失败时不覆盖既有订阅规则', saved === null && subs[0].rules[0] === 'old.example' && subs[0].lastUpdate === 5);
}

// 审查D-15: 三方快照下云端删除的订阅传播到本地, 本地规则保留且启用状态按云端仲裁
{
  let subs = [
    { url: 'https://keep/x', enabled: true, rules: ['k1'], lastUpdate: 3, name: 'K' },
    { url: 'https://cloud-deleted/x', enabled: true, rules: ['d1'], lastUpdate: 4 }
  ];
  const baseSubs = [
    { url: 'https://keep/x', name: 'K', enabled: true },
    { url: 'https://cloud-deleted/x', name: 'D', enabled: true }
  ];
  const cloudSubs = [{ url: 'https://keep/x', name: 'K', enabled: false }];
  const api = new Function('getSubscriptions', 'saveSubscriptions', 'getSubscriptionSyncSnapshot', 'checkAutoSubscription', `
    const SUBSCRIPTION_SYNC_SNAPSHOT_KEY = 'snap';
    ${extractFn(src, 'applyCloudSubscriptions')}
    return applyCloudSubscriptions;
  `)(
    () => subs.map((s) => ({ ...s })),
    (v) => { subs = v; },
    () => baseSubs,
    () => {}
  );
  const out = api(cloudSubs, false);
  assert('审查D-15: 云端删除的订阅传播到本地', Array.isArray(out) && !out.some((s) => s.url === 'https://cloud-deleted/x') && subs.length === 1);
  assert('审查D-16: 本地规则保留且启用状态按云端仲裁', out[0].rules[0] === 'k1' && out[0].enabled === false);
  const localOff = [
    { url: 'https://keep/x', enabled: false, rules: ['k1'], lastUpdate: 3, name: 'K' }
  ];
  const baseOn = [{ url: 'https://keep/x', name: 'K', enabled: true }];
  const cloudOn = [{ url: 'https://keep/x', name: 'K', enabled: true }];
  subs = localOff.map((s) => ({ ...s }));
  const apiField = new Function('getSubscriptions', 'saveSubscriptions', 'getSubscriptionSyncSnapshot', 'checkAutoSubscription', `
    const SUBSCRIPTION_SYNC_SNAPSHOT_KEY = 'snap';
    ${extractFn(src, 'applyCloudSubscriptions')}
    return applyCloudSubscriptions;
  `)(
    () => subs.map((s) => ({ ...s })),
    (v) => { subs = v; },
    () => baseOn,
    () => {}
  );
  const keptOff = apiField(cloudOn, false);
  assert('修复3-1: 仅本地关闭订阅时不被较新云端设置重新打开', keptOff[0].enabled === false && keptOff[0].rules[0] === 'k1');
  subs = [{ url: 'https://keep/x', enabled: true, rules: ['k1'], lastUpdate: 3, name: 'Local' }];
  const apiRename = new Function('getSubscriptions', 'saveSubscriptions', 'getSubscriptionSyncSnapshot', 'checkAutoSubscription', `
    const SUBSCRIPTION_SYNC_SNAPSHOT_KEY = 'snap';
    ${extractFn(src, 'applyCloudSubscriptions')}
    return applyCloudSubscriptions;
  `)(
    () => subs.map((s) => ({ ...s })),
    (v) => { subs = v; },
    () => [{ url: 'https://keep/x', name: 'Base', enabled: true }],
    () => {}
  );
  const renamed = apiRename([{ url: 'https://keep/x', name: 'Base', enabled: true }], false);
  assert('修复3-2: 仅本地改名时不被云端旧名覆盖', renamed && renamed[0] && renamed[0].name === 'Local' && renamed[0].enabled === true, renamed);
}

// ==== [修复D] 订阅自动更新开关变更推进本地时间戳并触发防抖同步 ====
{
  const m = src.match(/autoUpdateSwitch\.addEventListener\('change'[\s\S]{0,300}?}\);/);
  const handlerSrc = m ? m[0] : '';
  assert('修复D-1: 开关变更使用persistConfig(true)', /persistConfig\(\s*true\s*\)/.test(handlerSrc));
  assert('修复D-2: 开关变更不再使用persistConfig(false)', handlerSrc !== '' && !/persistConfig\(\s*false\s*\)/.test(handlerSrc));
}

// ==== [修复M3] 悬浮球持久化位置应用时按当前视口夹紧(窗口变矮/手机转屏后不再永久移出屏幕) ====
{
  const posFn = extractFn(src, 'applyBubbleStatePosition');
  const sizeFn = extractFn(src, 'getBubbleSize');
  const run = (bubbleState, innerHeight, offsetHeight) => {
    const el = { offsetHeight, style: {} };
    new Function('window', 'currentConfig', 'el',
      sizeFn + '\n' + posFn + '\napplyBubbleStatePosition(el);\nreturn el.style;'
    )({ innerHeight }, { bubbleState, bubbleSize: 30 }, el);
    return el.style;
  };
  assert('修复M3-1: 视口变矮后top夹紧到innerHeight-h-5', run({ top: '2000px', left: '5px' }, 600, 30).top === '565px');
  assert('修复M3-2: top过小夹紧到最小5px', run({ top: '3px', left: '5px' }, 600, 30).top === '5px');
  assert('修复M3-3(对照): 视口内位置不改动', run({ top: '100px', left: '5px' }, 600, 30).top === '100px');
  assert('修复M3-4: 极小视口夹紧到不小于0', run({ top: '1000px', left: '5px' }, 20, 30).top === '0px');
  const st = run({ top: 'auto', left: 'auto', right: '5px' }, 600, 30);
  assert('修复M3-5(对照): 非px的top与left/right/bottom/transform行为不变', st.top === 'auto' && st.right === '5px' && st.bottom === 'auto' && st.transform === 'none');
  assert('修复M3-6(对照): 无bubbleState为空操作', !run(null, 600, 30).top);
}

// ==== [修复H1/M1/M2] 手动上传快照一致性 / 授时失败回退WebDAV Date头 / 保存合并保留注释行 ====
// 修复H1: 上传锁外冻结content, PUT后快照必须取自该content而非实时数组, 否则窗口期内的本地编辑
//         会因"快照含它但云端不含它"被下一轮三方合并判定为云端删除而回滚并传播
{
  const upStart = src.indexOf("getElementById('serh-webdav-upload')");
  const upEnd = src.indexOf("getElementById('serh-webdav-auto-sync')");
  const upSrc = upStart >= 0 && upEnd > upStart ? src.slice(upStart, upEnd) : '';
  assert('修复H1-1: 上传快照以实际上传内容content为准', upSrc.includes('setRuleSyncSnapshot(content.split'));
  assert('修复H1-2: 上传快照不再读取实时currentConfig.rules', upSrc !== '' && !upSrc.includes('setRuleSyncSnapshot(currentConfig.rules)'));
}
// 修复M1: 自动同步授时失败时按文档回退远程WebDAV Date头, 时钟偏差>5min且授时点全挂时不再退化为恒"本地新"
{
  const gtn = new Function(`
    ${netTimePrelude}
    async function gmRequest() { throw new Error('network down'); }
    ${extractFn(src, 'firstSuccess')}
    ${extractFn(src, 'queryNetworkTimeEndpoint')}
    ${extractFn(src, 'getNetworkTimeOffset')}
    ${extractFn(src, 'getTrustedNow')}
    return getTrustedNow;
  `)();
  const v = await gtn(1234567890123);
  assert('修复M1-1: 授时失败时回退传入的服务器Date时间', v === 1234567890123);
  const before = Date.now();
  const v2 = await gtn();
  assert('修复M1-2(对照): 无参调用仍回退本地时间', typeof v2 === 'number' && v2 >= before - 100 && v2 <= Date.now() + 100);
  const offset = await new Function(`
    ${netTimePrelude}
    async function gmRequest() { throw new Error('network down'); }
    ${extractFn(src, 'firstSuccess')}
    ${extractFn(src, 'queryNetworkTimeEndpoint')}
    ${extractFn(src, 'getNetworkTimeOffset')}
    return getNetworkTimeOffset;
  `)()();
  assert('修复M1-3(对照): 授时全失败时优先级仍为偏移量>Date头>本地', offset === null && typeof v === 'number');
  const autoSrc = extractFn(src, 'performAutoWebDAVSync');
  assert('修复M1-4: 自动同步方向仲裁传入Date头作可信时间回退', autoSrc.includes('getTrustedNow(parseHttpDateHeader(resp.responseHeaders))'));
}
// 修复M2: 面板打开期间后台同步写入的注释行此前在保存时被排除丢弃, 并经下轮同步上传后永久丢失
{
  const sc = extractFn(src, 'saveConfig');
  assert('修复M2-1: 保存合并不再排除#注释行', sc !== '' && !sc.includes("startsWith('#')"));
  assert('修复M2-2(对照): 合并仍按initialKeySet/userKeySet去重', sc.includes('initialKeySet.has(k)') && sc.includes('userKeySet.has(k)'));
}

// ==== [同步-145/146] 导出文件名包含年份 / 云端合并路径强制拉取订阅绕过自动更新开关 ====
{
  const tfn = new Function(`${extractFn(src, 'timestampFilename')}\nreturn timestampFilename;`)();
  const name = tfn('rules', 'txt');
  assert('同步-145: 导出文件名包含年份(rules-YYYY-MM-DD-HHMMSS.txt)', /^rules-\d{4}-\d{2}-\d{2}-\d{6}\.txt$/.test(name), name);
  const cas = extractFn(src, 'checkAutoSubscription');
  assert('同步-146(已知问题): force路径绕过订阅自动更新开关且空rules订阅恒为到期(死链订阅每小时自动同步时被强制重拉)', cas.includes('!force && !currentConfig.subscriptionAutoUpdate') && cas.includes('s.rules.length === 0'));
}

// ==== [复审W-*/UI-*] 第二轮审查留档 (W-1/W-3/W-4 已修复, 断言转为修复后契约; 其余仍为当前行为对照) ====
// 修复W-1: 设置方向仲裁与订阅preferLocal改用独立设置时钟cloudSettingsTime(仅取syncedAt), 规则-only上传推进的rulesSyncedAt不再参与;
// 本地设置较新且开启配置同步时触发设置维度上传
{
  const cloud = { enabled: false, language: 'en', syncedAt: 1000, rulesSyncedAt: 9000 };
  const cloudText = '# ScriptConfig:' + JSON.stringify(cloud) + '\n*://same.example.com/*';
  const env = makeSyncEnv({ cloudText, localRules: ['*://same.example.com/*'], localTime: 5000, syncConfig: true, initialSnapshot: ['*://same.example.com/*'] });
  env.setCurrent({ rules: ['*://same.example.com/*'], enabled: true, language: 'zh-CN' });
  await env.run(syncCfg);
  const cur = env.getCurrent();
  assert('修复W1-1: rulesSyncedAt(9000)>localTime(5000)但设置syncedAt(1000)更旧时, 云端旧设置不再被采纳(enabled/language保持本地)', cur.enabled === true && cur.language === 'zh-CN');
  const put = env.calls.find((c) => c.method === 'PUT');
  assert('修复W1-2: 本地设置较新时触发设置维度上传, 上传头携带本地较新设置', !!put && put.data.includes('"enabled":true'));
  const env2 = makeSyncEnv({ cloudText: '# ScriptConfig:' + JSON.stringify({ enabled: false, language: 'en', syncedAt: 9000, rulesSyncedAt: 9000 }) + '\n*://same.example.com/*', localRules: ['*://same.example.com/*'], localTime: 5000, syncConfig: true, initialSnapshot: ['*://same.example.com/*'] });
  env2.setCurrent({ rules: ['*://same.example.com/*'], enabled: true, language: 'zh-CN' });
  await env2.run(syncCfg);
  assert('修复W1-3(对照): 设置syncedAt(9000)确实较新时云端设置仍被正常采纳', env2.getCurrent().enabled === false && env2.getCurrent().language === 'en');
}
// 修复1: 自动同步遇到 200 空文件或仅配置头时跳过，不把空列表当成云端全删；手动下载仍允许空文件覆盖
{
  const kept = ['*://a.example.com/*', '*://b.example.com/*'];
  const env = makeSyncEnv({ cloudText: '', localRules: kept, localTime: 0, syncConfig: false, initialSnapshot: kept.slice() });
  env.setCurrent({ rules: kept.slice(), enabled: true });
  await env.run(syncCfg);
  const cur = env.getCurrent();
  assert('修复1-1: 自动同步遇到空文件时保留本地规则且不上传', JSON.stringify(cur.rules) === JSON.stringify(kept) && env.calls.filter((c) => c.method === 'PUT').length === 0);
  assert('修复1-2: 空文件跳过时不推进规则快照', JSON.stringify(env.store.get(KEYS.WEBDAV_SYNC_SNAPSHOT_KEY)) === JSON.stringify(kept));
  const headerOnly = '# ScriptConfig:' + JSON.stringify({ syncedAt: 1000, enabled: false });
  const envHeader = makeSyncEnv({ cloudText: headerOnly, localRules: kept, localTime: 0, syncConfig: true, initialSnapshot: kept.slice() });
  envHeader.setCurrent({ rules: kept.slice(), enabled: true });
  await envHeader.run(syncCfg);
  assert('修复1-3: 自动同步遇到仅配置头的空规则文件时同样跳过', JSON.stringify(envHeader.getCurrent().rules) === JSON.stringify(kept) && envHeader.getCurrent().enabled === true);
  const commentOnly = '# ScriptConfig:' + JSON.stringify({ syncedAt: 1000 }) + '\n# group';
  const envComment = makeSyncEnv({ cloudText: commentOnly, localRules: kept, localTime: 0, syncConfig: false, initialSnapshot: kept.slice() });
  envComment.setCurrent({ rules: kept.slice(), enabled: true });
  await envComment.run(syncCfg);
  assert('修复1-4: 仅有注释行的云端文件仍参与合并', envComment.getCurrent().rules.includes('# group'));
}
// 修复4(复审4): 云端空文件不再永久停摆——本地非空且较新时推送上传; 本地较旧/相等时跳过但记录同步时间避免重试震荡
{
  const kept = ['*://a.example.com/*', '*://b.example.com/*'];
  const headerOnly = '# ScriptConfig:' + JSON.stringify({ syncedAt: 1000, enabled: false });
  const envPush = makeSyncEnv({ cloudText: headerOnly, localRules: kept, localTime: 5000, syncConfig: true, initialSnapshot: kept.slice() });
  envPush.setCurrent({ rules: kept.slice(), enabled: true });
  await envPush.run(syncCfg);
  const pushPut = envPush.calls.find((c) => c.method === 'PUT');
  assert('修复4-1: 仅头行空云端+本地规则较新时推送上传(停摆解除)', !!pushPut && pushPut.data.includes('*://a.example.com/*') && JSON.stringify(envPush.getCurrent().rules) === JSON.stringify(kept));
  assert('修复4-2: 推送上传后规则快照前移且记录同步时间', JSON.stringify(envPush.store.get(KEYS.WEBDAV_SYNC_SNAPSHOT_KEY)) === JSON.stringify(kept) && envPush.store.get(KEYS.WEBDAV_LAST_SYNC_KEY) > 0);
  const envSkip = makeSyncEnv({ cloudText: headerOnly, localRules: kept, localTime: 0, syncConfig: true, initialSnapshot: kept.slice() });
  envSkip.setCurrent({ rules: kept.slice(), enabled: true });
  await envSkip.run(syncCfg);
  assert('修复4-3(对照): 仅头行空云端+本地较旧时仍跳过且设置不被采纳(修复1-3语义保持)', JSON.stringify(envSkip.getCurrent().rules) === JSON.stringify(kept) && envSkip.getCurrent().enabled === true && envSkip.calls.filter((c) => c.method === 'PUT').length === 0);
  const envEmpty = makeSyncEnv({ cloudText: '', localRules: kept, localTime: 0, syncConfig: false, initialSnapshot: kept.slice() });
  envEmpty.setCurrent({ rules: kept.slice(), enabled: true });
  await envEmpty.run(syncCfg);
  assert('修复4-4: 完全空文件+本地较旧/相等时仍跳过(修复1-1语义保持)且记录同步时间避免每小时重试', JSON.stringify(envEmpty.getCurrent().rules) === JSON.stringify(kept) && envEmpty.calls.filter((c) => c.method === 'PUT').length === 0 && envEmpty.store.get(KEYS.WEBDAV_LAST_SYNC_KEY) > 0);
}
// 修复W-3: 内容变更判定改为顺序敏感(纯重排视为有效变更触发一次上传), 基线与云端随之对齐, 不再奇偶震荡;
// 同名注释行在合并输出中按行键去重坍缩为一组(复审W-6 留档, 未修复)
{
  const merge3 = new Function(
    extractFn(src, 'stripRuleComment') + '\n' + extractFn(src, 'getRuleKey') + '\n' + extractFn(src, 'mergeRules3Way') + '\nreturn mergeRules3Way;'
  )();
  const A = '*://a.example.com/*', B = '*://b.example.com/*';
  const round1 = merge3([A, B], [B, A], [A, B]);
  assert('修复W3-0(对照): 三方合并仍保留本地移动顺序(合并器语义不变)', JSON.stringify(round1) === JSON.stringify([B, A]));
  const env = makeSyncEnv({ cloudText: '# ScriptConfig:{"syncedAt":1000}\n' + A + '\n' + B, localRules: [B, A], localTime: 2000, syncConfig: false, initialSnapshot: [A, B] });
  env.setCurrent({ rules: [B, A], enabled: true });
  await env.run(syncCfg);
  const put = env.calls.find((c) => c.method === 'PUT');
  const putRules = put ? put.data.split('\n').filter((l) => l && l.indexOf('#') !== 0).join('|') : '';
  assert('修复W3-1: 纯重排在规则-only同步下触发一次上传且上传内容保持本地顺序', !!put && putRules === [B, A].join('|'));
  const round2LocalTime = env.store.get(KEYS.LOCAL_LAST_MODIFIED_KEY);
  const env2 = makeSyncEnv({ cloudText: put.data, localRules: [B, A], localTime: round2LocalTime, syncConfig: false, initialSnapshot: [B, A] });
  env2.setCurrent({ rules: [B, A], enabled: true });
  await env2.run(syncCfg);
  assert('修复W3-2: 上传对齐后下一轮无重复上传且本地顺序保持(奇偶震荡消除)', env2.calls.filter((c) => c.method === 'PUT').length === 0 && JSON.stringify(env2.getCurrent().rules) === JSON.stringify([B, A]));
  const dup = ['# g', A, '# g', B];
  const mergedDup = merge3(dup, dup.slice(), dup.slice());
  assert('复审W-6(新发现): 同名注释行三方合并后坍缩为一组(第二个分组标题丢失)', mergedDup.filter((l) => l === '# g').length === 1 && mergedDup.length === 3);
}
// 修复W-4: 自动同步/手动下载增加整体拒绝兜底——非空正文若不含任何合法规则行或注释行, 视为错误文本整体拒绝(不并入不回传);
// 词表白名单本身未扩(复审W-4 留档: "Too Many Requests"等不在isInvalidSyncResponse词表内, 拒绝由下游兜底承担)
{
  const isInvalid = new Function(
    extractFn(src, 'isHtmlResponse') + '\n' + extractFn(src, 'isInvalidSyncResponse') + '\nreturn isInvalidSyncResponse;'
  )();
  assert('复审W-4(留档): "Too Many Requests"等词表外错误体不在isInvalidSyncResponse词表内', isInvalid('Too Many Requests') === false);
  assert('复审W-4(对照): 词表内错误体仍被拒绝', isInvalid('Not Found') === true);
  const env = makeSyncEnv({ cloudText: 'Too Many Requests', localRules: ['*://keep.example.com/*'], localTime: 1000, syncConfig: false });
  env.setCurrent({ rules: ['*://keep.example.com/*'], enabled: true });
  await env.run(syncCfg);
  assert('修复W4-1: 自动同步对不含任何合法规则行的非空正文整体拒绝(不并入规则库也不回传)', JSON.stringify(env.getCurrent().rules) === JSON.stringify(['*://keep.example.com/*']) && env.calls.filter((c) => c.method === 'PUT').length === 0);
  const mixed = makeSyncEnv({ cloudText: 'Too Many Requests\n*://cloud.example.com/*', localRules: ['*://keep.example.com/*'], localTime: 1000, syncConfig: false, initialSnapshot: ['*://keep.example.com/*'] });
  mixed.setCurrent({ rules: ['*://keep.example.com/*'], enabled: true });
  await mixed.run(syncCfg);
  assert('修复W4-2(对照): 含至少一条合法规则行的混合正文仍正常合并云端规则', mixed.getCurrent().rules.includes('*://cloud.example.com/*') === true);
  const dl = makeSyncEnv({ cloudText: 'Too Many Requests', localRules: ['*://keep.example.com/*'], localTime: 1000, syncConfig: false });
  dl.setCurrent({ rules: ['*://keep.example.com/*'], enabled: true });
  let threw = false;
  try { await dl.download(syncCfg); } catch (_) { threw = true; }
  assert('修复W4-3: 手动下载对非规则文本整体拒绝(抛错且不落地覆盖本地)', threw === true && JSON.stringify(dl.getCurrent().rules) === JSON.stringify(['*://keep.example.com/*']));
  const htmlLead = '# nginx error\n<html><body>502</body></html>\n*://bad.example.com/*';
  const envHtml = makeSyncEnv({ cloudText: htmlLead, localRules: ['*://keep.example.com/*'], localTime: 1000, syncConfig: false, initialSnapshot: ['*://keep.example.com/*'], responseHeaders: 'content-type: text/html' });
  envHtml.setCurrent({ rules: ['*://keep.example.com/*'], enabled: true });
  await envHtml.run(syncCfg);
  assert('修复1-5: 以#开头的HTML错误页自动同步整份拒绝且不回传', JSON.stringify(envHtml.getCurrent().rules) === JSON.stringify(['*://keep.example.com/*']) && envHtml.calls.filter((c) => c.method === 'PUT').length === 0);
  const dlHtml = makeSyncEnv({ cloudText: htmlLead, localRules: ['*://keep.example.com/*'], localTime: 1000, syncConfig: false, responseHeaders: 'content-type: text/html' });
  dlHtml.setCurrent({ rules: ['*://keep.example.com/*'], enabled: true });
  let htmlThrew = false;
  try { await dlHtml.download(syncCfg); } catch (_) { htmlThrew = true; }
  assert('修复1-6: 以#开头的HTML错误页手动下载抛错且不覆盖', htmlThrew === true && JSON.stringify(dlHtml.getCurrent().rules) === JSON.stringify(['*://keep.example.com/*']));
}
// 复审W-5: 合法JSON但非对象(数组)的ScriptConfig头被当作真值config, 解构后数字键可污染设置并随buildSyncPayload回传
{
  const parse = new Function(extractFn(src, 'parseSyncHeader') + '\nreturn parseSyncHeader;')();
  const p = parse('# ScriptConfig:[1,2]\n*://a.example.com/*');
  assert('复审W-5(新发现): 数组形ScriptConfig头解析为真值config(Array)且头行被剥离', Array.isArray(p.config) === true);
  const ok = parse('# ScriptConfig: {"enabled":true}\nr');
  assert('复审W-5(对照): 正常对象头仍解析为对象', !!ok.config && !Array.isArray(ok.config) && ok.config.enabled === true);
}
// 复审W-7: 文件名/子路径无条件encodeURIComponent, 已编码名被二次编码(%20→%2520)指向不存在的文件
{
  const getReq = new Function(`
    ${extractFn(src, 'isHttpsUrl')}
    ${extractFn(src, 'safeBase64Encode')}
    function t(k) { return k; }
    ${extractFn(src, 'getWebDAVRequest')}
    return getWebDAVRequest;
  `)();
  const r = getReq({ url: 'https://dav.example.com/dav/', username: 'u', password: 'p', filename: 'My%20Rules.txt' });
  assert('复审W-7(新发现): 已编码文件名被二次编码指向错误路径(404后触发初始上传, 旧文件脱离同步)', r.fullUrl.includes('My%2520Rules.txt'));
}
// 复审UI-1/UI-2: bindOutsideClickClose 不豁免屏蔽确认弹窗 / 面板淡出未过滤 transitionend 事件来源
// (复审UI-1已随P1-1修复更新: 主面板closeHandler改用closeZoneSelector统一豁免子面板与确认弹窗)
{
  const biSrc = extractFn(src, 'bindOutsideClickClose');
  const mainPanelExemptsConfirmDialog = /const closeZoneSelector = '[^']*#serh-block-confirm-dialog/.test(src);
  assert('复审UI-1(已更新): bindOutsideClickClose未豁免#serh-block-confirm-dialog(仅主面板closeHandler经closeZoneSelector豁免, 弹窗内点单选会关闭其他未保存面板)', !biSrc.includes('serh-block-confirm-dialog') && mainPanelExemptsConfirmDialog);
  const foSrc = extractFn(src, 'fadeOutAndRemovePanel');
  assert('复审UI-2(新发现): 面板transitionend未过滤事件来源(子元素过渡冒泡会提前截断淡出动画)', foSrc.includes('transitionend') && !foSrc.includes('e.target'));
}

// ==== [同步-154~158] 复审V: <tag>规则行误判HTML / 头行-only判空 / YAML flow项丢弃 / ---分隔丢弃 / 混淆前缀碰撞 (审查新发现, 以当前行为为准) ====
{
  const consts = src.match(/const SUPPORTED_REGEX_FLAGS = 'imsu';/)[0];
  const fns = ['hostLabelToASCII', 'toASCIIHostname', 'punycodeDecodeLabel', 'toUnicodeHostname', 'safeRegexTest', 'safeDecodeURIComponent', 'stripRuleComment', 'getInvalidRegexFlags', 'parseConditionPart', 'tokenizeCondExpr', 'parseCondExprTokens', 'analyzeCondExpr', 'foldCondExpr', 'evalDynamicLeaf', 'evalCondAST', 'extractBalancedParens', 'findIfOccurrences', 'stripIfConditions', 'evaluateCondition', 'isCondExprCore', 'looksLikeCondExpr', 'absorbStandaloneExpr', 'parseRuleWithConditions', 'extractIfConditions', 'validateUrlWildcard', 'ruleToRegex', 'parsePrefixedRegexRule', 'escapeWildcardPart', 'wildcardToRegex', 'matchWildcardDomainPattern', 'extractSimpleWhitelistDomain', 'matchSimpleDomain', 'compileRuleRegex', 'validateCondition', 'analyzeRule', 'validateRule', 'isScriptRuleLine', 'isElementRuleLine', 'getRuleKey', 'isHtmlResponse', 'isNonRuleTextResponse', 'parseSyncHeader', 'extractYamlRuleItems', 'parseRulesetContent', 'webdavB64ToBytes', 'webdavXorBytes', 'deobfuscateWebDAVPassword'].map((n) => extractFn(src, n));
  const api = new Function(
    consts + '\n' +
    `function t(key) { return key; }
    const window = { location: { hostname: 'www.google.com' } };
    function getSearchEngine() { return 'google'; }
    function getSearchCategory() { return 'web'; }
    const currentConfig = { rules: [], debug: false };
    const validationCache = new Map();
    const subdomainCache = new Map();
    ` + fns.join('\n') + '\nreturn { validateRule, isNonRuleTextResponse, parseSyncHeader, extractYamlRuleItems, parseRulesetContent, deobfuscateWebDAVPassword };'
  )();
  assert('同步-154(修复1验证): 含<tag>的合法规则行不再整文件误判HTML; 纯HTML/错误文本仍整体拒绝', api.validateRule('title *= "<b>"') === true && api.isNonRuleTextResponse(['title *= "<b>"']) === false && api.isNonRuleTextResponse(['text/<div[^>]*>/']) === false && api.isNonRuleTextResponse(['# 注释含 <b> 标签', '*://example.com/*']) === false && api.isNonRuleTextResponse(['# 注释含 <b> 标签']) === true && api.isNonRuleTextResponse(['<html><body>502</body></html>']) === true && api.isNonRuleTextResponse(['Too Many Requests']) === true && api.isNonRuleTextResponse(['*://example.com/*']) === false);
  const headerOnly = api.parseSyncHeader('# ScriptConfig: {"rulesSyncedAt":123}\n');
  assert('同步-155(复审新发现): 合法清空传播后云端仅剩头行→restLines为空→自动同步"云端为空"守卫连本地上传一并跳过(新规则永不上传)', headerOnly.restLines.filter((l) => l.trim()).length === 0);
  const yamlItems = api.extractYamlRuleItems(['rules:', "- ['ads1.com','ads2.com']", '- block.com']);
  assert('同步-156(复审新发现): YAML块序列中的flow项([- x,y])被当字典项静默丢弃', !!yamlItems && yamlItems.items.includes('block.com') === true && yamlItems.items.some((i) => /ads1\.com/.test(i)) === false);
  const dash = api.parseRulesetContent('---\n*://a.com/*\n---\n*://b.com/*');
  assert('同步-157(复审新发现): 无name:的---分隔块被当front matter整块丢弃', dash.lines.join('\n').includes('a.com') === false && dash.lines.join('\n').includes('b.com') === true);
  assert('同步-158(复审新发现): 恰以serhx1:开头的旧明文密码被当混淆格式解码损坏(返回单字节乱码而非原文; 对照: 正常混淆往返无损)', api.deobfuscateWebDAVPassword('serhx1:AA:BB') !== 'serhx1:AA:BB' && api.deobfuscateWebDAVPassword('serhx1:AA:BB').length <= 2);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
})();
