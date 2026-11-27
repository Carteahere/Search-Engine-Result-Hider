// 读取上一级目录的 *.*.*.user.js
// 规则订阅 / WebDAV同步 / 联网授时
// 命名：同步-序号: 描述; 授时-序号
// 备注：同步不考虑墓碑机制
// 忽略：防抖推迟同步、PUT期间改设置不同步、多标签页同时打开面板修改数据冲突、三方合并错槽、规则尾接注释（分块判断麻烦不再维护）、ublacklist极少使用的订阅项（如<all_urls>）、面板取消/关闭不回退开关状态

(async () => {
const fs = require('fs');
const path = require('path');

const scriptDir = path.join(__dirname, '..');
const scriptFiles = fs.readdirSync(scriptDir).filter((name) => /^\S+\.\S+\.\S+\.user\.js$/.test(name)).sort();
if (!scriptFiles.length) throw new Error('no .js script found in ' + scriptDir);
const file = path.join(scriptDir, scriptFiles[0]);
console.log('Testing', file);
const src = fs.readFileSync(file, 'utf8');

let pass = 0;
let fail = 0;

function assert(name, cond, extra) {
  if (cond) { pass++; console.log('PASS', name); }
  else { fail++; console.log('FAIL', name, extra !== undefined ? JSON.stringify(extra) : ''); }
}

function extractFn(text, fnName) {
  let marker = 'async function ' + fnName + '(';
  let idx = text.indexOf(marker);
  if (idx === -1) { marker = 'function ' + fnName + '('; idx = text.indexOf(marker); }
  if (idx === -1) throw new Error('fn not found: ' + fnName);
  const signatureEnd = text.indexOf(') {', idx); const open = text.indexOf('{', signatureEnd);
  let depth = 0;
  let i = open;
  for (; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') { depth--; if (depth === 0) break; }
  }
  const rawExtract = (t, name) => { const ridx = t.indexOf('function ' + name + '('); const ropen = t.indexOf('{', t.indexOf(') {', ridx)); let rdepth = 0; let ri = ropen; for (; ri < t.length; ri++) { if (t[ri] === '{') rdepth++; else if (t[ri] === '}') { rdepth--; if (rdepth === 0) break; } } return t.slice(ridx, ri + 1); };
  const body = text.slice(idx, i + 1);
  const dependencies = { stripRuleComment: ['scanRuleString'], findIfOccurrences: ['scanRuleString'], extractBalancedParens: ['findBalancedParenEnd'], scanRuleString: ['findBalancedParenEnd', 'isBadRegexTail'], buildSyncPayload: ['getSyncSettings', 'getEngineSubscriptions'], getTrustedNow: ['noteDavClock', 'loadDavClockCache'], getRuleSyncSnapshot: ['snapshotHelpers'], setRuleSyncSnapshot: ['snapshotHelpers'], getSelectorSyncSnapshot: ['snapshotHelpers'], setSelectorSyncSnapshot: ['snapshotHelpers'], getSubscriptionSyncSnapshot: ['snapshotHelpers'], setSubscriptionSyncSnapshot: ['snapshotHelpers'], getEngineSubSyncSnapshot: ['snapshotHelpers'], setEngineSubSyncSnapshot: ['snapshotHelpers'] };
  const snapshotHelpers = () => ['snapshotIsArray', 'snapshotIsObject', 'makeSyncSnapshot'].map((n) => rawExtract(text, n)).join('\n') + '\n';
  const scanDeps = !['findBalancedParenEnd', 'scanRuleString'].includes(fnName) && /scanRuleString\(|RULE_PREFIX_RE|RULE_PREFIX_REGEX_RE|RULE_LEADING_REGEX_RE|REGEX_CTX_[A-D]\b/.test(body);
  const consts = text.split('\n').filter(line => /^\s*const (?:RULE_\w+|REGEX_CTX_[A-D]) =/.test(line)).map(line => line.replace('const ', 'var ')).join('\n') + '\n';
  const prelude = (scanDeps ? consts + rawExtract(text, 'findBalancedParenEnd') + '\n' + rawExtract(text, 'scanRuleString') + '\n' + rawExtract(text, 'isBadRegexTail') + '\n' + rawExtract(text, 'regexCloseAhead') + '\n' + rawExtract(text, 'regexStartAhead') + '\n' : '') + (fnName !== 'encodeNonAscii' && /encodeNonAscii\(/.test(body) ? rawExtract(text, 'encodeNonAscii') + '\n' : '') + (!['isUniqueFlagsStr', 'isFlagsCandidateError'].includes(fnName) && /isUniqueFlagsStr\(|isFlagsCandidateError\(/.test(body) ? ['isUniqueFlagsStr', 'isFlagsCandidateError'].map(n => rawExtract(text, n)).join('\n') + '\n' : '') + (!['parseTitleSpec', 'parseLinkSpec'].includes(fnName) && /\bparseTitleSpec\b|\bparseLinkSpec\b/.test(body) ? rawExtract(text, 'parseTopLevelAt') + '\n' + rawExtract(text, 'parseLinkSpec') + '\n' + rawExtract(text, 'parseTitleSpec') + '\n' : '');
  return prelude + (dependencies[fnName] || []).map(n => n === 'snapshotHelpers' ? snapshotHelpers() : extractFn(text, n)).join('\n') + '\n' + body;
}

const KEYS = {
  CONFIG_KEY: 'searchfilter_blocker',
  WEBDAV_SYNC_CONFIG_KEY: 'searchfilter_webdav_sync_config',
  WEBDAV_SYNC_SELECTORS_KEY: 'searchfilter_webdav_sync_selectors',
  SELECTORS_KEY: 'searchfilter_selectors',
  LOCAL_LAST_MODIFIED_KEY: 'searchfilter_local_last_modified',
  SETTINGS_LAST_MODIFIED_KEY: 'searchfilter_settings_last_modified',
  WEBDAV_LAST_SYNC_KEY: 'searchfilter_webdav_last_sync',
  WEBDAV_DIRTY_KEY: 'searchfilter_webdav_dirty',
  WEBDAV_RETRY_COUNT_KEY: 'searchfilter_webdav_retry_count',
  WEBDAV_SYNC_SNAPSHOT_KEY: 'searchfilter_webdav_sync_snapshot',
  SUBSCRIPTION_SYNC_SNAPSHOT_KEY: 'searchfilter_subscription_sync_snapshot',
  WEBDAV_LAST_SYNC_SELECTORS_KEY: 'searchfilter_webdav_last_sync_selectors',
  SELECTORS_LAST_MODIFIED_KEY: 'searchfilter_selectors_last_modified',
  SUB_VERSION_KEY: 'searchfilter_sub_version'
};

const baseSyncFns = [
  'scanRuleString', 'findBalancedParenEnd', 'getSyncSettings', 'getCloudModifiedTime',
  'subscriptionsSignature', 'buildDavPutHeaders', 'persistSyncSnapshots', 'putWebDAVRules',
  'getRuleKey', 'filterValidRuleLines', 'hasEffectiveRules', 'findYamlFrontmatterRange', 'getYamlFrontmatterLines', 'splitYamlFrontmatter', 'getSubscriptionSyncSnapshot', 'setSubscriptionSyncSnapshot',
  'getRuleSyncSnapshot', 'setRuleSyncSnapshot', 'webdavTargetId', 'mergeRules3Way', 'makeSyncSnapshot',
  'stripRuleComment', 'hasTopLevelComma', 'isHttpsUrl', 'getWebDAVRequest', 'ensureWebDAVFolder', 'isHtmlResponse', 'isInvalidSyncResponse', 'parseRegexLiteral', 'sanitizeRegexFlags', 'isRegexLiteralStr', 'parseSyncHeader', 'isNonRuleTextResponse',
  'buildUploadContent', 'gmPutWebDAV', 'putWebDAVBackup',
  'getSelectorSyncSnapshot', 'setSelectorSyncSnapshot', 'selectorsEqual', 'mergeSelectors3Way',
  'firstSuccess', 'parseHttpDateHeader', 'queryNetworkTimeEndpoint', 'getNetworkTimeOffset', 'getTrustedNow',
  'extractValidCloudTimes', 'applyConfigToMainPanel',
  'buildSyncPayload', 'applyCloudSubscriptions', 'adoptStoredConfigIfNewer', 'getDefaultConfig', 'normalizeConfig',
  'getEngineSubscriptions', 'saveEngineSubscriptions', 'applyCloudEngineSubscriptions', 'getEngineSubSyncSnapshot', 'setEngineSubSyncSnapshot',
  'checkExternalConfigChange', 'triggerWebDAVSyncDelayed', 'performAutoWebDAVSync', 'performWebDAVDownload', 'markWebDAVSyncFailure', 'markWebDAVSyncSuccess',
];
const ruleValidateFns = [
  'hostLabelToASCII', 'toASCIIHostname', 'punycodeDecodeLabel', 'toUnicodeHostname', 'safeRegexTest', 'safeDecodeURIComponent', 'decodeUrlForMatch',
  'getInvalidRegexFlags', 'parseConditionPart', 'tokenizeCondExpr', 'parseCondExprTokens', 'analyzeCondExpr', 'foldCondExpr',
  'evalDynamicLeaf', 'evalCondAST', 'extractBalancedParens', 'findIfOccurrences', 'stripIfConditions', 'evaluateCondition',
  'isCondExprCore', 'looksLikeCondExpr', 'absorbStandaloneExpr', 'parseRuleWithConditions', 'extractIfConditions',
  'validateUrlWildcard', 'ruleToRegex', 'parsePrefixedRegexRule', 'escapeWildcardPart', 'wildcardToRegex',
  'normalizeHostCandidate', 'matchWildcardDomainPattern', 'compileRuleRegex', 'dbg', 'dbgWarn', 'dbgError',
  'validateCondition', 'analyzeRule', 'validateRule', 'isScriptRuleLine', 'isElementRuleLine',
];
const syncFns = [...new Set(baseSyncFns.concat(ruleValidateFns))].map((n) => extractFn(src, n));
const settingsTimePrelude = `const SETTINGS_LAST_MODIFIED_KEY = ${JSON.stringify(KEYS.SETTINGS_LAST_MODIFIED_KEY)};\n${extractFn(src, 'getSettingsModifiedTime')}\nfunction getSelectorsModifiedTime(){ const t = GM_getValue(${JSON.stringify(KEYS.SELECTORS_LAST_MODIFIED_KEY)}, 0); return typeof t === 'number' && t > 0 ? t : getSettingsModifiedTime(); }`;
const syncEnvPrelude = src.match(/const CFG_DEFAULTS = \{[^\n]+\};/)[0] + '\n' + src.match(/const DEFAULT_HIGHLIGHT_COLORS = \{[^\n]+\};/)[0] + '\n' + settingsTimePrelude + '\nfunction loadWebDAVConfig(){ return { url: "https://dav.example.com/dav/", username: "", password: "", filename: "rules.txt" }; }'; // 测试环境桩: 与 syncCfg 一致, 使快照目标标识可计算
const langTextsSrc = src.match(/const LANG_TEXTS = \{[\s\S]*?\n  \};/)[0];

const netTimePrelude = `
    const WEBDAV_LAST_SYNC_SELECTORS_KEY = ${JSON.stringify(KEYS.WEBDAV_LAST_SYNC_SELECTORS_KEY)};
    const WEBDAV_TIME_TOLERANCE = 5 * 60 * 1000;
    const NET_TIME_CACHE_TTL = 30 * 60 * 1000;
    const NET_TIME_FAIL_TTL = 10 * 60 * 1000;
    const WEBDAV_CLOCK_CACHE_TTL = 24 * 60 * 60 * 1000;
    let _netTimeOffset = null;
    let _netTimeCheckedAt = 0;
    let _netTimeQuerying = null;
    let _davClockOffset = null;
    let _davClockCheckedAt = 0;
    let _webdavRetryTimer = null;
    function scheduleWebDAVSyncRetry() {}
`;

function makeSyncEnv({ cloudStatus = 200, cloudText = '', localRules = [], localTime = 0, localSettingsTime, localSubs = [], storedConfig = undefined, syncConfig = true, syncSelectors = false, localSelectors, initialSelectorSnapshot, responseHeaders = '', putFailures = 0, initialSnapshot = undefined, initialSubSnapshot = undefined, onPut = null }) {
  const store = new Map();
  store.set(KEYS.WEBDAV_SYNC_CONFIG_KEY, syncConfig);
  store.set(KEYS.WEBDAV_SYNC_SELECTORS_KEY, syncSelectors);
  if (localSettingsTime !== undefined) store.set(KEYS.SETTINGS_LAST_MODIFIED_KEY, localSettingsTime);
  else if (localTime > 0) store.set(KEYS.SETTINGS_LAST_MODIFIED_KEY, localTime);
  if (localSelectors !== undefined) store.set(KEYS.SELECTORS_KEY, localSelectors);
  if (initialSelectorSnapshot !== undefined) store.set(KEYS.WEBDAV_LAST_SYNC_SELECTORS_KEY, initialSelectorSnapshot);
  store.set(KEYS.LOCAL_LAST_MODIFIED_KEY, localTime);
  store.set(KEYS.WEBDAV_LAST_SYNC_KEY, 0);
  store.set('subs', localSubs);
  if (initialSnapshot !== undefined) store.set(KEYS.WEBDAV_SYNC_SNAPSHOT_KEY, Array.isArray(initialSnapshot) ? { target: 'https://dav.example.com/dav/rules.txt', rules: initialSnapshot } : initialSnapshot);
  if (initialSubSnapshot !== undefined) store.set(KEYS.SUBSCRIPTION_SYNC_SNAPSHOT_KEY, Array.isArray(initialSubSnapshot) ? { target: 'https://dav.example.com/dav/rules.txt', subs: initialSubSnapshot } : initialSubSnapshot);
  if (storedConfig !== undefined) store.set(KEYS.CONFIG_KEY, storedConfig);
  const calls = [];
  const state = { reprocess: 0, putFailures, ui: 0 };
  const factory = new Function('store', 'calls', 'state', 'mockResponse', 'onPut', `
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
    const WEBDAV_DIRTY_KEY = ${JSON.stringify(KEYS.WEBDAV_DIRTY_KEY)};
    const WEBDAV_RETRY_COUNT_KEY = ${JSON.stringify(KEYS.WEBDAV_RETRY_COUNT_KEY)};
    const WEBDAV_SYNC_SNAPSHOT_KEY = ${JSON.stringify(KEYS.WEBDAV_SYNC_SNAPSHOT_KEY)};
    const SUBSCRIPTION_SYNC_SNAPSHOT_KEY = ${JSON.stringify(KEYS.SUBSCRIPTION_SYNC_SNAPSHOT_KEY)};
    const ENGINE_SUBSCRIPTIONS_KEY = 'searchfilter_engine_subscriptions';
    const ENGINE_SUBS_SYNC_SNAPSHOT_KEY = 'searchfilter_engine_subs_sync_snapshot';
    const BUILTIN_ENGINE_SUB_URL = 'https://raw.githubusercontent.com/Carteahere/Search-Engine-Result-Hider/main/Other/Selectors.js';
    const isBuiltinEngineSub = (s) => !!s && (!!s.builtin || s.url === BUILTIN_ENGINE_SUB_URL);
    const MAX_SUBSCRIPTIONS = 100;
    const GM_getValue = (k, d) => (store.has(k) ? store.get(k) : d);
    const GM_setValue = (k, v) => { store.set(k, v); };
    async function gmRequest(method, url, opts = {}) {
      calls.push({ method, url, data: opts.data });
      if (method === 'GET') return mockResponse;
      if (onPut) onPut(url, opts);
      if (state.putFailures > 0) { state.putFailures--; throw new Error('HTTP 412'); }
      return { status: 200 };
    }
    function forceReprocessAll() { state.reprocess++; }
    const confirm = () => true;
    function persistConfig(updateModifiedTime = true) {
      store.set(CONFIG_KEY, currentConfig);
      if (updateModifiedTime) GM_setValue(LOCAL_LAST_MODIFIED_KEY, Date.now());
    }
    function getSubscriptions() { return store.get('subs') || []; }
    function saveSubscriptions(subs) { store.set('subs', subs); }
    function checkAutoSubscription() {}
    function checkAutoEngineSubscription() {}
    function getUserSelectors() { return GM_getValue(SELECTORS_KEY, {}) || {}; }
    function getSelectorStoreSignature() { return null; }
    function resetSelectorCache() {}
    function refreshEngineSite() {}
    function applyUiScale() {}
    function applyDarkModeClass() {}
    function applyCollapseMode() {}
    function applyGlobalConfigUi() { state.ui++; }
    function registerMenu() { state.menu = (state.menu || 0) + 1; }
    let currentConfig;
    const document = { getElementById: () => null };
    const SUPPORTED_REGEX_FLAGS = 'imsu';
    const window = { location: { hostname: 'www.google.com' } };
    function getSearchEngine() { return 'google'; }
    function getSearchCategory() { return 'web'; }
    const validationCache = new Map();
    const subdomainCache = new Map();

    ${netTimePrelude}
    ${syncEnvPrelude}
    ${syncFns.join('\n')}
    ${extractFn(src, 'applyBuiltinEngineSubEnabled')}
    ${langTextsSrc}
    return {
      run: (cfg) => performAutoWebDAVSync(cfg),
      download: (cfg) => performWebDAVDownload(cfg, false),
      getCurrent: () => currentConfig,
      setCurrent: (c) => { currentConfig = c; store.set(CONFIG_KEY, c); },
      getRequest: (cfg) => getWebDAVRequest(cfg),
      put: putWebDAVRules, parse: parseSyncHeader, settingsTime: getSettingsModifiedTime, response: mockResponse,
      calls,
      store,
      state
    };
  `);
  return factory(store, calls, state, {
    status: cloudStatus,
    responseText: cloudText,
    responseHeaders
  }, onPut);
}

const syncCfg = { url: 'https://dav.example.com/dav/', username: '', password: '', filename: 'rules.txt' };

// ---- 同步-001~004: 时间戳决策与412冲突重试 ----
{
  const cloud = { enabled: false, language: 'en', syncedAt: 2000, subscriptions: [{ url: 'https://sub/x.txt', enabled: true, lastUpdate: 9 }] };
  const cloudText = '# ScriptConfig:' + JSON.stringify(cloud) + '\n*://cloud.example.com/*';
  const localSubs = [{ url: 'https://sub/x.txt', enabled: true, lastUpdate: 1, rules: ['title/foo/'], name: 'localname' }];
  const env = makeSyncEnv({ cloudText, localRules: ['*://local-old.example.com/*'], localTime: 1000, localSubs });
  env.setCurrent({ rules: ['*://local-old.example.com/*'], enabled: true, language: 'zh-CN' });
  await env.run(syncCfg);
  const cur = env.getCurrent();
  assert('同步-001: 云端较新时应用云端设置且智能合并规则并对齐时间戳', cur.enabled === false && cur.language === 'en' && cur.rules.includes('*://cloud.example.com/*') && cur.rules.includes('*://local-old.example.com/*') && cur.rules.length === 2 && env.store.get(KEYS.LOCAL_LAST_MODIFIED_KEY) >= 2000);
}
{
  const cloud = { enabled: false, syncedAt: 500 };
  const cloudText = '# ScriptConfig:' + JSON.stringify(cloud) + '\n*://cloud.example.com/*';
  const localConfig = { rules: ['*://local.example.com/*'], enabled: true, language: 'zh-CN' };
  const env = makeSyncEnv({ cloudText, localRules: ['*://local.example.com/*'], localTime: 1000, storedConfig: localConfig });
  env.setCurrent({ ...localConfig });
  await env.run(syncCfg);
  const cur = env.getCurrent();
  const put = env.calls.find((c) => c.method === 'PUT' && !c.url.endsWith('.bak'));
  assert('同步-002: 本地较新时保留本地设置且合并上传两端规则', cur.enabled === true && cur.language === 'zh-CN' && !!put && put.data.includes('*://local.example.com/*') && put.data.includes('*://cloud.example.com/*'));
}
{
  const cloud = { enabled: false, syncedAt: 1000 };
  const cloudText = '# ScriptConfig:' + JSON.stringify(cloud) + '\n*://same.example.com/*';
  const env = makeSyncEnv({ cloudText, localRules: ['*://same.example.com/*'], localTime: 1000, storedConfig: { rules: ['*://same.example.com/*'], enabled: true } });
  env.setCurrent({ rules: ['*://same.example.com/*'], enabled: true });
  await env.run(syncCfg);
  assert('同步-003: 时间戳相等时无操作', env.calls.filter((c) => c.method === 'PUT').length === 0 && env.getCurrent().enabled === true);
}
{
  const run412 = async (putFailures, bakFiltered) => {
    const cloudText = '# ScriptConfig:' + JSON.stringify({ syncedAt: 500 }) + '\n*://cloud.example.com/*';
    const env = makeSyncEnv({ cloudText, localRules: ['*://local.example.com/*'], localTime: 1000, putFailures });
    env.setCurrent({ rules: ['*://local.example.com/*'] });
    await env.run(syncCfg);
    return env.calls.filter((c) => c.method === 'PUT' && (!bakFiltered || !c.url.endsWith('.bak'))).length;
  };
  assert('同步-004: 412冲突后重新同步成功且持续冲突最多重试3次后放弃', await run412(1, false) === 2 && await run412(99, true) === 4);
}

// ---- 同步-005~008: 垃圾响应识别与下载防护 ----
{
  const isInvalid = new Function(
    extractFn(src, 'isHtmlResponse') + '\n' + extractFn(src, 'isInvalidSyncResponse') + '\nreturn isInvalidSyncResponse;'
  )();
  assert('同步-005: JSON错误体与HTML注释开头响应均拒绝', isInvalid('{"error":"Not Found","status":404}', '') === true && isInvalid('<!-- SSO portal -->\n<html><body>login</body></html>', '') === true);
}
{
  const localConfig = { rules: ['*://local.example.com/*'], enabled: true };
  const env = makeSyncEnv({ cloudStatus: 200, cloudText: '{"error":"Not Found"}', localRules: ['*://local.example.com/*'], localTime: 1000, storedConfig: localConfig });
  env.setCurrent({ ...localConfig });
  await env.run(syncCfg);
  assert('同步-006: 自动同步遇到错误响应不合并也不上传且记录时间防立即重试', env.getCurrent().rules.join('|') === '*://local.example.com/*' && !env.calls.some((c) => c.method === 'PUT') && (env.store.get(KEYS.WEBDAV_LAST_SYNC_KEY) || 0) > 0);
}
{
  const localConfig = { rules: ['*://local.example.com/*'], enabled: true };
  const env = makeSyncEnv({ cloudStatus: 200, cloudText: '', localRules: ['*://local.example.com/*'], localTime: 1000, storedConfig: localConfig, responseHeaders: 'last-modified: Wed, 01 Jan 2025 00:00:00 GMT' });
  env.setCurrent({ ...localConfig });
  await env.run(syncCfg);
  const put = env.calls.find((c) => c.method === 'PUT' && c.url.endsWith('rules.txt'));
  assert('同步-007: 空云端mtime较新时仍上传本地规则', !!put && String(put.data || '').includes('*://local.example.com/*'));
}
{
  const garbageBodies = [
    '{"error":"Not Found","status":404}',
    'Not Found',
    '<?xml version="1.0" encoding="UTF-8"?><Error><Code>NoSuchKey</Code></Error>'
  ];
  let rejected = 0;
  let polluted = 0;
  for (let gi = 0; gi < garbageBodies.length; gi++) {
    const body = garbageBodies[gi];
    const env = makeSyncEnv({ cloudStatus: 200, cloudText: body, localRules: ['*://local.example.com/*'], localTime: 1000, syncConfig: false, responseHeaders: 'content-type: text/plain' });
    env.setCurrent({ rules: ['*://local.example.com/*'], enabled: true });
    try { await env.download(syncCfg); } catch (_) { rejected++; }
    if (env.getCurrent().rules.join('|') !== '*://local.example.com/*') polluted++;
  }
  assert('同步-008: JSON/纯文本/XML三类错误响应下载均被拒绝且本地规则未被污染', rejected === garbageBodies.length && polluted === 0);
}

// ---- 同步-009~011: 跨标签页同步锁与订阅收集防护 ----
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
  const tabA2 = makeLockEnv('tabA');
  const tabB = makeLockEnv('tabB');
  const first = tabA.tryAcquire() === true && tabA2.tryAcquire() === false && tabB.tryAcquire() === false;
  const lock = tabA.read();
  lock.expires = Date.now() - 1;
  store.set('searchfilter_sync_lock_webdav', lock);
  assert('同步-009: 首次获取成功同页重入与异页持锁失败且过期后可重新获取', first && tabB.tryAcquire() === true);
}
{
  const mkCollect = (rows) => new Function('container', 'subscriptions', 't', `
    ${extractFn(src, 'collectSubscriptionsFromRows')}
    return collectSubscriptionsFromRows;
  `)({ querySelectorAll: () => rows }, [], k => k);
  const makeRow = (url, origUrl) => ({
    dataset: { originalUrl: origUrl },
    classList: { add() {}, remove() {} },
    querySelector: sel => sel === '.serh-subscription-url' ? { value: url } :
      sel === '.serh-subscription-enable-toggle' ? { checked: true } : {}
  });
  const A = 'https://a/rules';
  const B = 'https://b/rules';
  const subsAB = [
    { url: A, enabled: true, lastUpdate: 1, rules: ['a.example'] },
    { url: B, enabled: true, lastUpdate: 2, rules: ['b.example'] }
  ];
  const renamed = mkCollect([makeRow(B, B), makeRow(B, A)])(subsAB).newSubs;
  const swapped = mkCollect([makeRow(B, A), makeRow(A, B)])(subsAB).newSubs;
  assert('同步-010: 重命名撞已占用URL时旧订阅不残留且两行互换URL时两条均保留', renamed.length === 1 && renamed[0].url === B && renamed[0].rules[0] === 'b.example' && swapped.length === 2 && swapped.some((s) => s.url === A && s.rules[0] === 'a.example') && swapped.some((s) => s.url === B && s.rules[0] === 'b.example'));
}
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
  assert('同步-011: 迟到响应不恢复已删除订阅且保留删除墓碑', result.cancelled === true && subs.length === 0 && tombstones[url] === 123);
// 忽略该问题: 远端合法rules为空的订阅不清空旧规则，此为故意设计
}

// ---- 同步-012: parseSyncHeader 头解析与损坏头剔除 ----
{
  const parse = new Function(
    'function dbg() {} function dbgWarn() {} function dbgError() {}\n' + extractFn(src, 'hasTopLevelComma') + '\n' + extractFn(src, 'findYamlFrontmatterRange') + '\n' + extractFn(src, 'parseSyncHeader') + '\nreturn parseSyncHeader;'
  )();
  const broken = parse('# ScriptConfig:{broken-json}\n*://a.com/*');
  const brokenSel = parse('# ScriptConfig: {"syncedAt":1}\n# Selectors:{bad\n*://a.com/*');
  assert('同步-012: 损坏ScriptConfig与Selectors头行剔除出正文且好头不受影响', broken.restLines.length === 1 && broken.restLines[0] === '*://a.com/*' && broken.rawScriptConfig === null && broken.config === null && brokenSel.restLines.join('|') === '*://a.com/*' && brokenSel.rawSelectors === null && brokenSel.config.syncedAt === 1);
}
// 忽略该问题: 深层嵌套递归溢出，极罕见情况无修复意义



// ---- 同步-013~015: buildUploadContent 选择器头保留与删除传播 ----
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
    function getSelectorsModifiedTime() { return 0; }
    ${extractFn(src, 'findYamlFrontmatterRange')}
    ${extractFn(src, 'buildUploadContent')}
    return { build: (content, at, preserved) => buildUploadContent(content, at, preserved) };
  `);
  const env2 = f(store);
  const remoteRaw = '# ScriptConfig:' + JSON.stringify({ enabled: false });
  const out = env2.build('*://a.com/*', 9000, { rawScriptConfig: remoteRaw, rawSelectors: '# Selectors: {"foo":1}' });
  const lines = out.split('\n');
  assert('同步-013: 关闭配置同步时保留云端其他字段', lines[0].startsWith('# ScriptConfig:') && lines[0].includes('"enabled":false') && lines[0].includes('"rulesSyncedAt":9000'));
}
{
  const store = new Map();
  store.set(KEYS.WEBDAV_SYNC_CONFIG_KEY, true);
  const f = new Function('store', `
    const WEBDAV_SYNC_CONFIG_KEY = ${JSON.stringify(KEYS.WEBDAV_SYNC_CONFIG_KEY)};
    const WEBDAV_SYNC_SELECTORS_KEY = ${JSON.stringify(KEYS.WEBDAV_SYNC_SELECTORS_KEY)};
    const WEBDAV_LAST_SYNC_SELECTORS_KEY = ${JSON.stringify(KEYS.WEBDAV_LAST_SYNC_SELECTORS_KEY)};
    const GM_getValue = (k, d) => (store.has(k) ? store.get(k) : d);
    function getUserSelectors() { return store.get('sel') || {}; }
    function getSelectorsModifiedTime() { return store.get('selTime') || 0; }
    function getSettingsModifiedTime() { return 0; }
    function buildSyncPayload() { return {}; }
    function getSelectorSyncSnapshot() { const v = store.get(WEBDAV_LAST_SYNC_SELECTORS_KEY); return (v && typeof v === 'object' && !Array.isArray(v)) ? v : null; }
    ${extractFn(src, 'findYamlFrontmatterRange')}
    ${extractFn(src, 'selectorsEqual')}
    ${extractFn(src, 'buildUploadContent')}
    return { build: (content, at, preserved) => buildUploadContent(content, at, preserved) };
  `);
  const env3 = f(store);
  const noHead = !env3.build('r', 1000, {}).includes('# Selectors:');
  const withHead = env3.build('r', 1000, { rawSelectors: '# Selectors: {}' }).includes('# Selectors:{');
  store.set('sel', { mine: { match: '/x/', containers: '.r' } });
  const published = env3.build('r', 1000, {}).includes('"mine"');
  assert('同步-014: 空选择器按云端有无头决定发布与删除传播且本地非空时发布修复丢头', noHead && withHead && published);
  const headerTime = (out) => JSON.parse(out.split('\n')[0].slice('# ScriptConfig:'.length)).selectorsSyncedAt;
  const remoteHeader = '# ScriptConfig:' + JSON.stringify({ selectorsSyncedAt: 500 });
  store.set(KEYS.WEBDAV_LAST_SYNC_SELECTORS_KEY, { mine: { match: '/x/', containers: '.r' } });
  store.set('selTime', 700);
  const holdTime = headerTime(env3.build('r', 1000, { rawScriptConfig: remoteHeader })) === 500;
  store.set('sel', { mine: { match: '/x/', containers: '.new' } });
  const advTime = headerTime(env3.build('r', 1000, { rawScriptConfig: remoteHeader })) === 1000;
  assert('同步-015: 选择器未变化不推进selectorsSyncedAt且变化时推进', holdTime && advTime);
}

// ---- 同步-016~018: mergeRules3Way 三方合并 ----
{
  const merge3 = new Function(
    extractFn(src, 'stripRuleComment') + '\n' + extractFn(src, 'getRuleKey') + '\n' + extractFn(src, 'findYamlFrontmatterRange') + '\n' + extractFn(src, 'splitYamlFrontmatter') + '\n' + extractFn(src, 'mergeRules3Way') + '\nreturn mergeRules3Way;'
  )();
  const res1 = merge3(['*://r1.com/*', '*://r2.com/*'], ['*://r1.com/*'], ['*://r1.com/*', '*://r2.com/*', '*://r3.com/*']);
  const res6 = merge3(['*://a.com/* @if(title *= "x")', '*://b.com/*'], ['*://a.com/* @if(title *= "y")', '*://b.com/*'], ['*://a.com/* @if(title *= "z")', '*://b.com/*']);
  assert('同步-016: 本地删除生效云端新增保留且双方编辑同一条规则只保留本地变体', res1.includes('*://r1.com/*') && !res1.includes('*://r2.com/*') && res1.includes('*://r3.com/*') && JSON.stringify(res6) === JSON.stringify(['*://a.com/* @if(title *= "y")', '*://b.com/*']));
  // 双方都改同一基线且替换组有交集时并集保留双方新增, 替换组完全不同时按修改时间择一
  const res8 = merge3(['A', 'B', 'C'], ['A', 'X', 'Y', 'C'], ['A', 'X', 'C'], true);
  assert('同步-017: 双方都改同一基线时不得丢失双方都存在的规则且改写为不同规则时按修改时间择一', JSON.stringify(res8) === JSON.stringify(['A', 'X', 'Y', 'C']) && JSON.stringify(merge3(['a', 'b'], ['a2', 'b'], ['a3', 'b'], false)) === JSON.stringify(['a3', 'b']) && JSON.stringify(merge3(['a', 'b'], ['a2', 'b'], ['a3', 'b'], true)) === JSON.stringify(['a2', 'b']));
  // 修复留档: 共享规则被映射到不同槽时, 两侧都要进入同槽组, 不得在组级择一中丢失
  const res13 = merge3(['A', 'B'], ['C'], ['C', 'A', 'D'], false);
  const res14 = merge3(['A', 'B'], ['C'], ['C', 'A', 'D'], true);
  assert('同步-018: 双方共有的替换规则不因槽位映射丢失且同槽替换同时另一侧新增时保留新增(修复留档)', JSON.stringify(res13) === JSON.stringify(['C', 'D']) && JSON.stringify(res14) === JSON.stringify(['C', 'D']) && JSON.stringify(merge3(['*://a.com/*'], ['*://a2.com/*'], ['*://a3.com/*', '*://b.com/*'], true)) === JSON.stringify(['*://a2.com/*', '*://b.com/*']));
  // 易错留档: 双方编辑同一规则文本(如行尾注释)时 pickLine 恒取本地, 不随 preferLocal 倾斜
}

// ---- 同步-019~020: mergeSelectors3Way 三方合并与删除vs修改仲裁 ----
{
  const merge = new Function(`
    ${extractFn(src, 'mergeSelectors3Way')}
    return mergeSelectors3Way;
  `)();
  const base = { bing: { containers: '.old', titles: ['h2 a'] }, yahoo: { containers: '.y' } };
  const local = { bing: { containers: '.new-local', titles: ['h2 a'] }, yahoo: { containers: '.y' }, localOnly: { containers: '.l' } };
  const cloud = { bing: { containers: '.new-cloud', titles: ['h2 a'] }, yahoo: { containers: '.y' }, cloudOnly: { containers: '.c' } };
  const r1 = merge(base, local, cloud);
  const r2 = merge(base, local, { bing: cloud.bing, cloudOnly: cloud.cloudOnly });
  assert('同步-019: 双方都修改时本地优先且云端删除的选择器传播删除', r1.bing.containers === '.new-local' && !r2.yahoo);
  const b1 = { bing: { containers: '.old' } };
  assert('同步-020: 本地删除与云端修改按时间仲裁且快照缺失本地较旧时采用云端', merge(b1, {}, { bing: { containers: '.new-cloud' } }, true).bing === undefined && merge(b1, {}, { bing: { containers: '.new-cloud' } }, false).bing.containers === '.new-cloud' && merge(null, { bing: { containers: '.old-local' } }, { bing: { containers: '.new-cloud' } }, false).bing.containers === '.new-cloud');
}

// ---- 同步-021: applyCloudSubscriptions 删除传播 ----
{
  const mkApi = (getSnapshot) => new Function('getSubscriptions', 'saveSubscriptions', 'getSubscriptionSyncSnapshot', 'checkAutoSubscription', `
    const SUBSCRIPTION_SYNC_SNAPSHOT_KEY = 'snap';
    ${extractFn(src, 'applyCloudSubscriptions')}
    return applyCloudSubscriptions;
  `);
  let subs = [
    { url: 'https://keep/x', enabled: true, rules: ['k1'], lastUpdate: 3, name: 'K' },
    { url: 'https://cloud-deleted/x', enabled: true, rules: ['d1'], lastUpdate: 4 }
  ];
  const baseSubs = [
    { url: 'https://keep/x', name: 'K', enabled: true },
    { url: 'https://cloud-deleted/x', name: 'D', enabled: true }
  ];
  const api = mkApi()(
    () => subs.map((s) => ({ ...s })),
    (v) => { subs = v; },
    () => baseSubs,
    () => {}
  );
  const out = api([{ url: 'https://keep/x', name: 'K', enabled: false }], false);
  const cloudDelGone = Array.isArray(out) && !out.some((s) => s.url === 'https://cloud-deleted/x') && subs.length === 1;
  subs = [{ url: 'https://keep/x', enabled: false, rules: ['k1'], lastUpdate: 3, name: 'K' }];
  const apiField = mkApi()(
    () => subs.map((s) => ({ ...s })),
    (v) => { subs = v; },
    () => [{ url: 'https://keep/x', name: 'K', enabled: true }],
    () => {}
  );
  const keptOff = apiField([{ url: 'https://keep/x', name: 'K', enabled: true }], false);
  assert('同步-021: 云端删除的订阅传播到本地且仅本地关闭时不被较新云端重新打开', cloudDelGone && keptOff[0].enabled === false && keptOff[0].rules[0] === 'k1');
}


// ---- 同步-022: 覆盖非空云端前备份为 .bak ----
{
  // 自动同步首次上传(无备份时间记录) -> 先备份云端旧内容再覆盖
  const cloudRules = ['*://cloud.example.com/*', '*://cloud2.example.com/*'];
  const cloudText = '# ScriptConfig:' + JSON.stringify({ syncedAt: 500 }) + '\n' + cloudRules.join('\n');
  const env = makeSyncEnv({ cloudText, localRules: [], localTime: 1000, storedConfig: { rules: [], enabled: true }, initialSnapshot: cloudRules });
  env.setCurrent({ rules: [], enabled: true });
  await env.run(syncCfg);
  const bakPut = env.calls.find((c) => c.method === 'PUT' && c.url.endsWith('.bak'));
  const finalPut = env.calls.find((c) => c.method === 'PUT' && !c.url.endsWith('.bak'));
  const bakIdx = env.calls.indexOf(bakPut);
  assert('同步-022: 上传前先PUT备份云端旧内容为rules.txt.bak且置空上传不含旧规则', !!bakPut && !!finalPut && bakPut.url.endsWith('rules.txt.bak') && String(bakPut.data || '').includes('*://cloud.example.com/*') && finalPut.url.endsWith('rules.txt') && bakIdx !== -1 && bakIdx < env.calls.indexOf(finalPut) && !String(finalPut.data || '').includes('*://cloud.example.com/*'));
}

// ---- 同步-035: 自动同步备份按小时间隔且每日备份延迟到次日写入前一天内容 ----
{
  const cloudRules = ['*://cloud.example.com/*'];
  const cloudText = '# ScriptConfig:' + JSON.stringify({ syncedAt: 500 }) + '\n' + cloudRules.join('\n');
  const dayKey = (t) => { const d = new Date(t); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
  const runBackups = async (hourTs, dayTs, pending) => {
    const env = makeSyncEnv({ cloudText, localRules: [], localTime: 1000, storedConfig: { rules: [], enabled: true }, initialSnapshot: cloudRules });
    env.store.set('searchfilter_webdav_bak_hour', hourTs);
    env.store.set('searchfilter_webdav_bak_day', dayTs);
    env.store.set('searchfilter_webdav_bak_pending', pending);
    env.setCurrent({ rules: [], enabled: true });
    await env.run(syncCfg);
    const bakCalls = env.calls.filter((c) => c.method === 'PUT' && c.url.endsWith('.bak'));
    return { urls: bakCalls.map((c) => c.url), daily: bakCalls.find((c) => c.url.endsWith('.daily.bak')), env };
  };
  const now = Date.now(); const today = dayKey(now);
  const first = await runBackups(0, '', '');
  const none = await runBackups(now, today, '*://pending.example.com/*');
  const hourly = await runBackups(now - 2 * 60 * 60 * 1000, today, '*://pending.example.com/*');
  const both = await runBackups(now - 2 * 60 * 60 * 1000, '2000-1-1', '*://pending.example.com/*');
  assert('同步-035: 自动同步一小时内不重复备份、跨小时生成rules.txt.bak；每日备份次日才写入前一天内容，当天首次运行不写', first.urls.length === 1 && first.urls[0].endsWith('rules.txt.bak') && none.urls.length === 0 && hourly.urls.length === 1 && hourly.urls[0].endsWith('rules.txt.bak') && both.urls.some((u) => u.endsWith('rules.txt.bak')) && !!both.daily && String(both.daily.data || '') === '*://pending.example.com/*' && both.env.store.get('searchfilter_webdav_bak_pending') === cloudText && both.env.store.get('searchfilter_webdav_bak_day') === today);
}

// ---- 同步-036: WebDAV同步保留YAML frontmatter(自动合并与手动下载) ----
{
  const fm = ['---', 'name: 云端规则集', 'title: 测试', '---'];
  const cloudBody = ['*://cloud.example.com/*'];
  const cloudText = fm.concat(['# ScriptConfig:' + JSON.stringify({ syncedAt: 500 })], cloudBody).join('\n');
  const localRules = ['*://cloud.example.com/*', '*://local.example.com/*'];

  const env = makeSyncEnv({ cloudText, localRules, localTime: 1000, storedConfig: { rules: localRules, enabled: true }, initialSnapshot: cloudBody });
  env.setCurrent({ rules: localRules, enabled: true });
  await env.run(syncCfg);
  const put = env.calls.find((c) => c.method === 'PUT' && c.url.endsWith('rules.txt'));
  const uploaded = String((put && put.data) || '');
  const synced = env.getCurrent().rules;
  const ulines = uploaded.split('\n');
  const fmClose = ulines.indexOf('---', 1);
  const cfgIdx = ulines.findIndex((l) => l.startsWith('# ScriptConfig:'));
  const reParsed = env.parse(uploaded);
  const orderOk = ulines[0] === '---' && fmClose !== -1 && cfgIdx > fmClose;
  const reparseOk = !!reParsed.rawScriptConfig && !reParsed.restLines.includes('---') && !reParsed.restLines.some((l) => l.startsWith('name:')) && reParsed.restLines.includes('*://local.example.com/*');
  const autoOk = synced[0] === '---' && synced.includes('name: 云端规则集') && synced.includes('title: 测试') && synced.includes('*://cloud.example.com/*') && synced.includes('*://local.example.com/*') && uploaded.includes('name: 云端规则集') && uploaded.includes('title: 测试') && uploaded.includes('*://local.example.com/*') && orderOk && reparseOk;

  const dlEnv = makeSyncEnv({ cloudText, localRules: ['*://local.example.com/*'], localTime: 1000, syncConfig: false });
  dlEnv.setCurrent({ rules: ['*://local.example.com/*'], enabled: true });
  await dlEnv.download(syncCfg);
  const dl = dlEnv.getCurrent().rules;
  const downloadOk = dl[0] === '---' && dl.includes('name: 云端规则集') && dl.includes('title: 测试') && dl.includes('*://cloud.example.com/*');

  assert('同步-036: 自动同步合并上传与手动下载均保留规则文件开头的YAML frontmatter', autoOk && downloadOk, { synced, uploaded, dl });
}


// ---- 授时-001~006: 授时回退链与自动同步预检 ----
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
  const withDate = await api(1234567890123);
  assert('授时-001: 授时端点全失败时无参回退本地时间且传入Date回退该值', typeof v === 'number' && v >= before - 100 && v <= Date.now() + 100 && withDate === 1234567890123);
}
{
  const getOffset = new Function(`
    ${netTimePrelude}
    async function gmRequest(method, url) {
      if (url.startsWith('https://timeapi.io/')) throw new Error('down');
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
  assert('授时-002: timeapi失败时回退cloudflare ts解析', typeof offset === 'number' && offset !== null && Math.abs(offset - expect) < 1000);
}
{
  const store = new Map([['searchfilter_net_time_cache', { offset: 5000, checkedAt: Date.now() }]]);
  const state = { calls: 0 };
  const getOffset = new Function('GM_getValue', 'GM_setValue', 'state', `
    ${netTimePrelude}
    async function gmRequest() { state.calls++; throw new Error('network down'); }
    ${extractFn(src, 'firstSuccess')}
    ${extractFn(src, 'queryNetworkTimeEndpoint')}
    ${extractFn(src, 'getNetworkTimeOffset')}
    return getNetworkTimeOffset;
  `)((k, d) => store.has(k) ? store.get(k) : d, (k, v) => store.set(k, v), state);
  const offset = await getOffset();
  assert('授时-003: 刷新后复用持久化授时缓存且不发请求', offset === 5000 && state.calls === 0);
}

// 修复留档: 同步时间基准统一为WebDAV Date头(getTrustedNow缓存dav时钟offset), 仅Date头与缓存均不可得才回退本地钟
{
  const store = new Map();
  const getTN = new Function('GM_getValue', 'GM_setValue', `
    var currentConfig = { timeCalibration: false };
    ${netTimePrelude}
    async function gmRequest() { throw new Error('network down'); }
    ${extractFn(src, 'firstSuccess')}
    ${extractFn(src, 'queryNetworkTimeEndpoint')}
    ${extractFn(src, 'getNetworkTimeOffset')}
    ${extractFn(src, 'getTrustedNow')}
    return getTrustedNow;
  `)((k, d) => store.has(k) ? store.get(k) : d, (k, v) => store.set(k, v));
  const dav = Date.now() - 600000; // 服务器钟比本地慢10min
  const withDate = await getTN(dav);
  const cached = store.get('searchfilter_dav_time_cache');
  await new Promise((r) => setTimeout(r, 15));
  const fromCache = await getTN();
  assert('授时-004: 校准关时Date头生效写入dav缓存且缓存有效时按服务器基准换算', withDate === dav && !!cached && Math.abs(cached.offset + 600000) < 100 && Math.abs(fromCache - (Date.now() - 600000)) < 100);
}
{
  // 场景: 本地钟比服务器快10min, 修改时间戳应向下校正到服务器基准
  const store = new Map([['searchfilter_dav_time_cache', { offset: -600000, checkedAt: Date.now() }]]);
  const markFn = new Function('GM_getValue', 'GM_setValue', 'loadWebDAVConfig', 'isHttpsUrl', `
    const LOCAL_LAST_MODIFIED_KEY = 'searchfilter_local_last_modified';
    var currentConfig = { timeCalibration: false };
    ${netTimePrelude}
    async function gmRequest() { throw new Error('network down'); }
    ${extractFn(src, 'firstSuccess')}
    ${extractFn(src, 'queryNetworkTimeEndpoint')}
    ${extractFn(src, 'getNetworkTimeOffset')}
    ${extractFn(src, 'getTrustedNow')}
    ${extractFn(src, 'markLocalModifiedTime')}
    return markLocalModifiedTime;
  `)((k, d) => (store.has(k) ? store.get(k) : d), (k, v) => store.set(k, v), () => ({ url: 'https://dav.example.com/dav/' }), (u) => /^https:/.test(u));
  const localNow = Date.now();
  markFn();
  await new Promise((r) => setTimeout(r, 20));
  const stamped = store.get('searchfilter_local_last_modified');
  assert('授时-005: 修改时间戳校正到服务器Date基准(本地钟偏快时向下校正)', typeof stamped === 'number' && stamped > 0 && stamped < localNow && Math.abs(stamped - (Date.now() - 600000)) < 100);
}

// 修复留档: checkAutoWebDAV预检统一走getTrustedNow按云端授时优先Date头与本地钟回退判定, 原本地钟预检与受信LAST_SYNC混用致钟慢超1min时自动同步周期退化
{
  const run = (lastSync, offset, dirty = false, retry = 0) => { let called = 0;
    const fn = new Function('GM_getValue', 'loadWebDAVConfig', 'isHttpsUrl', 'isSerhPanelOpen', 'getTrustedNow', 'runBackgroundSync', `
      const WEBDAV_AUTO_SYNC_KEY = 'searchfilter_webdav_auto_sync';
      const WEBDAV_DIRTY_KEY = ${JSON.stringify(KEYS.WEBDAV_DIRTY_KEY)};
      const WEBDAV_RETRY_COUNT_KEY = ${JSON.stringify(KEYS.WEBDAV_RETRY_COUNT_KEY)};
      const WEBDAV_LAST_SYNC_KEY = ${JSON.stringify(KEYS.WEBDAV_LAST_SYNC_KEY)};
      const WEBDAV_AUTO_SYNC_INTERVAL = 3600000, AUTO_SYNC_TOLERANCE = 60000, WEBDAV_TIME_TOLERANCE = 300000;
      ${extractFn(src, 'hasPendingLocalChange')}
      ${extractFn(src, 'getWebDAVSyncWait')}
      ${extractFn(src, 'checkAutoWebDAV')}
      return checkAutoWebDAV;
    `)((k, d) => (k === 'searchfilter_webdav_auto_sync' ? true : k === KEYS.WEBDAV_DIRTY_KEY ? dirty : k === KEYS.WEBDAV_RETRY_COUNT_KEY ? retry : k === KEYS.WEBDAV_LAST_SYNC_KEY ? lastSync : d), () => ({ url: 'https://dav.example.com/dav/' }), (u) => /^https:/.test(u), () => false, async () => Date.now() + offset, async () => { called++; });
    return fn().then(() => called);
  };
  assert('授时-006: 受信基准到期60min触发同步且未到期30min不触发且本地有修改立即触发且未到退避时间不重复', await run(Date.now() - 50 * 60000, 600000) === 1 && await run(Date.now() - 20 * 60000, 600000) === 0 && await run(Date.now() - 10 * 1000, 0, true) === 1 && await run(Date.now() - 10 * 1000, 0, true, 1) === 0);
}

// ---- 同步-023: 选择器快照目标校验(修复留档) ----
{
  const mkSel = (n) => ({ match: `/(?:^|\\.)${n}\\.example\\.com$/`, containers: `.${n}` });
  const localSel = { xEngine: mkSel('x'), yEngine: mkSel('y') };
  const cloudText = '# ScriptConfig:' + JSON.stringify({ rulesSyncedAt: 5000, selectorsSyncedAt: 5000 }) + '\n# Selectors:' + JSON.stringify({ zEngine: mkSel('z') }) + '\n*://x.example.com/*';
  const env = makeSyncEnv({ cloudText, localRules: ['*://x.example.com/*'], localTime: 1000, localSelectors: localSel, initialSelectorSnapshot: localSel });
  env.setCurrent({ rules: ['*://x.example.com/*'], enabled: true });
  await env.run(syncCfg);
  const kept = env.store.get(KEYS.SELECTORS_KEY);
  const snap = env.store.get(KEYS.WEBDAV_LAST_SYNC_SELECTORS_KEY);
  assert('同步-023: 旧格式快照无target视为无基线本地引擎不被清空且同步后快照带target', !!(kept && kept.xEngine && kept.yEngine && kept.zEngine) && !!(snap && snap.target === 'https://dav.example.com/dav/rules.txt' && snap.selectors && snap.selectors.xEngine));
}


// 修复留档: PUT期间本地新增规则不得进入同步快照
{
  const ctx = { rules: ['*://snap.example.com/*'], fullUrl: 'u', folderUrl: 'f', headers: {} };
  let snapshot = null;
  const put = new Function('GM_getValue', 'WEBDAV_SYNC_CONFIG_KEY', 'getSyncSettings', 'getUserSelectors', 'buildUploadContent', 'gmPutWebDAV', 'persistSyncSnapshots', 'getSettingsModifiedTime', `
    ${extractFn(src, 'putWebDAVRules')}
    return putWebDAVRules;
  `)(() => false, 'k', () => ({}), () => ({}), (content) => String(content), async () => { ctx.rules.push('*://during.example.com/*'); return { status: 200 }; }, (rules) => { snapshot = rules; }, () => 0);
  await put(ctx, '*://snap.example.com/*', 1000, null, {});
  assert('同步-024: PUT期间新增规则不进入快照', JSON.stringify(snapshot) === JSON.stringify(['*://snap.example.com/*']) && ctx.rules.includes('*://during.example.com/*'));
}

// 修复留档: 订阅快照须带target, 换目标后旧快照不得当作基线
{
  const store = new Map(); let target = 'https://dav.example.com/dav/rules.txt';
  const api = new Function('store', 'getTarget', `
    const SUBSCRIPTION_SYNC_SNAPSHOT_KEY = ${JSON.stringify(KEYS.SUBSCRIPTION_SYNC_SNAPSHOT_KEY)};
    const GM_getValue = (k, d) => (store.has(k) ? store.get(k) : d);
    const GM_setValue = (k, v) => { store.set(k, v); };
    const loadWebDAVConfig = () => ({ url: getTarget() });
    function webdavTargetId(cfg) { return (cfg && cfg.target) || getTarget(); }
    ${extractFn(src, 'makeSyncSnapshot')}
    ${extractFn(src, 'snapshotIsArray')}
    ${extractFn(src, 'getSubscriptionSyncSnapshot')}
    ${extractFn(src, 'setSubscriptionSyncSnapshot')}
    return { get: getSubscriptionSyncSnapshot, set: setSubscriptionSyncSnapshot };
  `)(store, () => target);
  api.set([{ url: 'https://a/rules', name: 'A', enabled: true }]);
  const raw = store.get(KEYS.SUBSCRIPTION_SYNC_SNAPSHOT_KEY);
  const basic = !!(raw && raw.target === target && raw.subs && raw.subs.length === 1 && api.get() && api.get()[0].url === 'https://a/rules');
  api.set([{ url: 'https://a/rules', name: 'A', enabled: true }], { target: 'https://dav.example.com/dav/explicit.txt' });
  const explicit = store.get(KEYS.SUBSCRIPTION_SYNC_SNAPSHOT_KEY).target === 'https://dav.example.com/dav/explicit.txt';
  target = 'https://dav.example.com/dav/other.txt';
  const mismatch = api.get() === null;
  store.set(KEYS.SUBSCRIPTION_SYNC_SNAPSHOT_KEY, raw.subs);
  target = 'https://dav.example.com/dav/rules.txt';
  const oldFormat = api.get() === null;
  assert('同步-025: 订阅快照带target同目标可读且目标优先取调用方config且换目标与旧数组格式视为无基线', basic && explicit && mismatch && oldFormat);
}

// 修复留档: 订阅快照target不匹配时按无基线并集, 匹配时才传播云端删除
{
  const X = { url: 'https://a/rules', name: 'A', enabled: true, rules: ['*://a.com/*'] };
  const Y = { url: 'https://b/rules', name: 'B', enabled: true, rules: ['*://b.com/*'] };
  const cloudText = '# ScriptConfig:' + JSON.stringify({ syncedAt: 500, rulesSyncedAt: 500, subscriptions: [Y] }) + '\n*://cloud.example.com/*';
  const runCase = async (initialSubSnapshot) => {
    const env = makeSyncEnv({ cloudText, localRules: ['*://local.example.com/*'], localTime: 1000, localSubs: [X], storedConfig: { rules: ['*://local.example.com/*'], enabled: true }, initialSubSnapshot });
    env.setCurrent({ rules: ['*://local.example.com/*'], enabled: true });
    await env.run(syncCfg);
    return env.store.get('subs') || [];
  };
  const oldTarget = await runCase({ target: 'https://dav.example.com/dav/other.txt', subs: [X] });
  const sameTarget = await runCase({ target: 'https://dav.example.com/dav/rules.txt', subs: [X] });
  assert('同步-026: 旧目标订阅快照不当作基线本地与云端取并集且同目标快照仍传播云端删除', oldTarget.some(s => s.url === X.url) && oldTarget.some(s => s.url === Y.url) && sameTarget.length === 1 && sameTarget[0].url === Y.url);
}

// 易错: 三方合并依赖快照, 成功同步后须更新快照且仅自动同步走合并

// 留档观察: parseSyncHeader只扫描前10行, 属故意设计
// 留档观察: mergeSelectors3Way用>而mergeRules3Way用>=, 相等时间戳时preferLocal倾向不同, 无数据错误(设计取舍)
// 修复留档(主/Lite): 坏ScriptConfig头行(解析失败且非JSON形态)剔除出正文, 重复伪头保留正文的语义不变
{
  const parse = new Function(
    'function dbg() {} function dbgWarn() {} function dbgError() {}\n' + extractFn(src, 'hasTopLevelComma') + '\n' + extractFn(src, 'findYamlFrontmatterRange') + '\n' + extractFn(src, 'parseSyncHeader') + '\nreturn parseSyncHeader;'
  )();
  const garbage = parse('# ScriptConfig:损坏数据\n*://a.com/*');
  const liteSrc = fs.readFileSync(['', 'other'].map((d) => path.join(scriptDir, d, 'Lite.user.js')).find((p) => fs.existsSync(p)), 'utf8');
  const parseLite = new Function(extractFn(liteSrc, 'parseRegexLiteral') + '\n' + extractFn(liteSrc, 'selectorPatchOk') + '\n' + extractFn(liteSrc, 'findYamlFrontmatterRange') + '\n' + extractFn(liteSrc, 'parseConfigHeader') + '\nreturn parseConfigHeader;')();
  const liteGarbage = parseLite(['# ScriptConfig:损坏数据', '*://a.com/*']);
  const liteGood = parseLite(['# ScriptConfig: {"syncedAt":1}', '*://a.com/*']);
  assert('同步-027: 主/Lite坏ScriptConfig行剔除出正文且好头不受影响', garbage.restLines.join('|') === '*://a.com/*' && garbage.config === null && liteGarbage.rest.join('|') === '*://a.com/*' && liteGarbage.settings === null && liteGood.settings.syncedAt === 1 && liteGood.rest.join('|') === '*://a.com/*');
}
{
  const store = new Map(); const saved = [];
  const run = new Function('GM_getValue', 'GM_setValue', 'getEngineSubscriptions', 'saveEngineSubscriptions', 'getEngineSubSyncSnapshot', 'setEngineSubSyncSnapshot', 'checkAutoEngineSubscription', 'loadWebDAVConfig', 'webdavTargetId', 'isBuiltinEngineSub', extractFn(src, 'applyCloudEngineSubscriptions') + '\nreturn applyCloudEngineSubscriptions;')((k, d) => (store.has(k) ? store.get(k) : d), (k, v) => store.set(k, v), () => [{ url: 'https://a/s.js', enabled: true, lastUpdate: 0, lastAttempt: 0, selectors: null }], (subs) => saved.push(subs), () => null, () => {}, () => {}, () => ({ url: 'https://dav/' }), () => 't1', (s) => !!s && (!!s.builtin || s.url === 'https://builtin/x.js'));
  const out = run([{ url: 'https://a/s.js', name: 'A', enabled: false }, { url: 'https://b/x.js', name: 'B', enabled: true }]);
  assert('同步-028: 引擎订阅无快照合并=并集, 保留本地运行时字段并采纳云端状态', out.length === 2 && out[0].enabled === false && out[0].selectors === null && 'lastUpdate' in out[0] && out[1].url === 'https://b/x.js' && saved.length === 1);
}
// 修复留档: 三方仲裁剔除builtin, 旧快照含builtin/云端不含时本地builtin不再被误删(主版)
{
  const BUILTIN = 'https://builtin/x.js'; const saved = [];
  const run = new Function('GM_getValue', 'GM_setValue', 'getEngineSubscriptions', 'saveEngineSubscriptions', 'getEngineSubSyncSnapshot', 'setEngineSubSyncSnapshot', 'checkAutoEngineSubscription', 'loadWebDAVConfig', 'webdavTargetId', 'isBuiltinEngineSub', extractFn(src, 'applyCloudEngineSubscriptions') + '\nreturn applyCloudEngineSubscriptions;')((k, d) => d, () => {}, () => [{ url: BUILTIN, builtin: true, name: 'B', enabled: false, lastUpdate: 9, lastAttempt: 9, selectors: {} }, { url: 'https://a/s.js', name: 'A', enabled: true, lastUpdate: 0, lastAttempt: 0, selectors: null }], (subs) => saved.push(subs), () => [{ url: BUILTIN, name: 'B', enabled: false }, { url: 'https://a/s.js', name: 'A', enabled: true }], () => {}, () => {}, () => ({ url: 'https://dav/' }), () => 't1', (s) => !!s && (!!s.builtin || s.url === BUILTIN));
  run([{ url: 'https://a/s.js', name: 'A', enabled: true }]);
  assert('同步-029: 云端不含builtin时仲裁保留本地builtin及开关', saved.length === 1 && saved[0][0].url === BUILTIN && saved[0][0].enabled === false && saved[0][0].lastUpdate === 9 && saved[0].length === 2 && saved[0][1].url === 'https://a/s.js');
}
// 修复留档: WebDAV同步失败按2/4/8/16/32min退避重试, 第6次失败清DIRTY推迟1h, 成功重置计数(主版)
{
  const store = new Map(); const GM_getValue = (k, d) => (store.has(k) ? store.get(k) : d); const GM_setValue = (k, v) => { store.set(k, v); };
  const { failure, success } = new Function('GM_getValue', 'GM_setValue', 'WEBDAV_DIRTY_KEY', 'WEBDAV_RETRY_COUNT_KEY', 'WEBDAV_LAST_SYNC_KEY', 'let _webdavRetryTimer = null; function scheduleWebDAVSyncRetry() {}\n' + extractFn(src, 'markWebDAVSyncFailure') + '\n' + extractFn(src, 'markWebDAVSyncSuccess') + '\nreturn { failure: markWebDAVSyncFailure, success: markWebDAVSyncSuccess };')(GM_getValue, GM_setValue, KEYS.WEBDAV_DIRTY_KEY, KEYS.WEBDAV_RETRY_COUNT_KEY, KEYS.WEBDAV_LAST_SYNC_KEY);
  const waits = [];
  for (let i = 1; i <= 6; i++) { failure(1000 * i); const c = store.get(KEYS.WEBDAV_RETRY_COUNT_KEY); waits.push(c > 0 ? Math.min(2 ** c, 32) * 60000 : 3600000); }
  success(7000);
  const reset = store.get(KEYS.WEBDAV_DIRTY_KEY) === false && store.get(KEYS.WEBDAV_RETRY_COUNT_KEY) === 0 && store.get(KEYS.WEBDAV_LAST_SYNC_KEY) === 7000;
  assert('同步-030: 同步失败退避2/4/8/16/32min后第6次失败推迟1h, 成功重置计数', JSON.stringify(waits) === JSON.stringify([120000, 240000, 480000, 960000, 1920000, 3600000]) && reset);
}
// 修复留档: 备份PUT窗口内新增规则不得进入快照, 否则下轮被判云端删除而本地云端同时丢失
{
  const cloudRules = ['*://cloud.example.com/*'];
  const cloudText = '# ScriptConfig:' + JSON.stringify({ syncedAt: 500, rulesSyncedAt: 500 }) + '\n' + cloudRules.join('\n');
  let env = null, injected = false;
  env = makeSyncEnv({
    cloudText, localRules: ['*://local.example.com/*'], localTime: 1000,
    storedConfig: { rules: ['*://local.example.com/*'], enabled: true }, initialSnapshot: cloudRules,
    onPut: (url) => { if (!injected && url.endsWith('.bak')) { injected = true; env.getCurrent().rules.push('*://during.example.com/*'); } }
  });
  env.setCurrent({ rules: ['*://local.example.com/*'], enabled: true });
  await env.run(syncCfg);
  const uploadedDuring = env.calls.filter((c) => c.method === 'PUT').some((c) => String(c.data || '').includes('during.example.com'));
  const rawSnap = env.store.get(KEYS.WEBDAV_SYNC_SNAPSHOT_KEY);
  const snapRules = Array.isArray(rawSnap) ? rawSnap : (rawSnap && rawSnap.rules) || [];
  const snapDuring = snapRules.some((r) => String(r).includes('during.example.com'));
  const kept = env.getCurrent().rules.includes('*://during.example.com/*');
  await env.run(syncCfg);
  const secondPut = env.calls.filter((c) => c.method === 'PUT' && !c.url.endsWith('.bak')).map((c) => String(c.data || '')).filter((d) => d.includes('during.example.com')).length;
  assert('同步-031: 备份PUT窗口内新增规则不进快照且不随本轮上传并于下轮补传', injected && !uploadedDuring && !snapDuring && kept && secondPut > 0 && env.getCurrent().rules.includes('*://during.example.com/*'));
}
// 修复留档(主/Lite): 导入两条ScriptConfig头时均取首个且第二条按注释保留正文
{
  const parseMain = new Function(
    'function dbg() {} function dbgWarn() {} function dbgError() {}\n' + extractFn(src, 'hasTopLevelComma') + '\n' + extractFn(src, 'findYamlFrontmatterRange') + '\n' + extractFn(src, 'parseSyncHeader') + '\nreturn parseSyncHeader;'
  )();
  const liteSrc = fs.readFileSync(['', 'other'].map((d) => path.join(scriptDir, d, 'Lite.user.js')).find((p) => fs.existsSync(p)), 'utf8');
  const parseLite = new Function(extractFn(liteSrc, 'parseRegexLiteral') + '\n' + extractFn(liteSrc, 'selectorPatchOk') + '\n' + extractFn(liteSrc, 'findYamlFrontmatterRange') + '\n' + extractFn(liteSrc, 'parseConfigHeader') + '\nreturn parseConfigHeader;')();
  const content = '# ScriptConfig: {"a":1}\n# ScriptConfig: {"b":2}\n*://a.com/*';
  const main = parseMain(content), lite = parseLite(content.split('\n'));
  const rest = '# ScriptConfig: {"b":2}|*://a.com/*';
  assert('同步-032: 主/Lite重复ScriptConfig头均取首个且第二条保留正文', main.config.a === 1 && main.config.b === undefined && main.restLines.join('|') === rest && lite.settings.a === 1 && lite.settings.b === undefined && lite.rest.join('|') === rest);
}
// 修复留档: 脚本版本变化时重置订阅时间戳供启动检查无视12h间隔立即拉取一次, 缓存保留至拉取成功(主版)
{
  const store = new Map(); const savedSubs = []; const savedEngine = [];
  const run = new Function('GM_getValue', 'GM_setValue', 'GM_info', 'SUB_VERSION_KEY', 'getSubscriptions', 'saveSubscriptions', 'getEngineSubscriptions', 'saveEngineSubscriptions', extractFn(src, 'refreshSubscriptionsOnVersionChange') + '\nreturn refreshSubscriptionsOnVersionChange;')(
    (k, d) => (store.has(k) ? store.get(k) : d), (k, v) => store.set(k, v), { script: { version: '8.9.3' } }, KEYS.SUB_VERSION_KEY,
    () => [{ url: 'https://r/1.txt', enabled: true, lastUpdate: 111, lastAttempt: 222, rules: ['*://a.com/*'] }],
    (s) => savedSubs.push(s),
    () => [{ url: 'https://b/b.js', builtin: true, name: 'B', enabled: true, lastUpdate: 333, lastAttempt: 444, selectors: { google: {} } }, { url: 'https://e/e.js', name: 'E', enabled: true, lastUpdate: 555, lastAttempt: 666, selectors: {} }],
    (s) => savedEngine.push(s)
  );
  run();
  const reset = store.get(KEYS.SUB_VERSION_KEY) === '8.9.3' && savedSubs.length === 1 && savedSubs[0][0].lastUpdate === 0 && savedSubs[0][0].lastAttempt === 0 && savedSubs[0][0].rules.length === 1 && savedEngine.length === 1 && savedEngine[0][0].lastUpdate === 0 && savedEngine[0][0].lastAttempt === 0 && savedEngine[0][1].lastUpdate === 0 && savedEngine[0][1].lastAttempt === 0 && savedEngine[0][0].builtin === true && savedEngine[0][0].selectors.google !== undefined;
  run();
  assert('同步-033: 版本变化重置规则与引擎订阅lastUpdate/lastAttempt且保留缓存字段, 同版本不重复重置', reset && savedSubs.length === 1 && savedEngine.length === 1);
}
// 修复留档(主/Lite): 配置头检测跳过YAML frontmatter并从其后首行开始计数, frontmatter元数据不落入正文
{
  const mainParse = new Function(
    'function dbg() {} function dbgWarn() {} function dbgError() {}\n' + extractFn(src, 'hasTopLevelComma') + '\n' + extractFn(src, 'findYamlFrontmatterRange') + '\n' + extractFn(src, 'parseSyncHeader') + '\nreturn parseSyncHeader;'
  )();
  const liteSrc = fs.readFileSync(['', 'other'].map((d) => path.join(scriptDir, d, 'Lite.user.js')).find((p) => fs.existsSync(p)), 'utf8');
  const liteParse = new Function(extractFn(liteSrc, 'parseRegexLiteral') + '\n' + extractFn(liteSrc, 'selectorPatchOk') + '\n' + extractFn(liteSrc, 'findYamlFrontmatterRange') + '\n' + extractFn(liteSrc, 'parseConfigHeader') + '\nreturn parseConfigHeader;')();
  const content = '---\ntitle: 推荐规则\ndate: 2026-11-26\ndraft: false\nnote: 可能含大量误杀 仅供参考\n---\n# c\n# c\n# ScriptConfig:{"syncedAt":1}\n# Selectors:{"s":{"containers":".x"}}\n*://a.com/*';
  const main = mainParse(content), lite = liteParse(content.split('\n'));
  const rest = '# c|# c|*://a.com/*';
  assert('同步-034: 主/Lite配置头检测从YAML frontmatter之后开始计数且元数据不落入正文', main.config && main.config.syncedAt === 1 && main.rawSelectors && main.restLines.join('|') === rest && lite.settings && lite.settings.syncedAt === 1 && lite.selectors && lite.selectors.s && lite.rest.join('|') === rest);
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
})();
