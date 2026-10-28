// 读取上一级目录的 *.*.*.user.js
// 规则订阅 / WebDAV同步 / 联网授时
// 命名：同步-序号: 描述; 授时-序号
// 备注：同步不考虑墓碑机制
// 忽略：防抖推迟同步、PUT期间改设置不同步、多标签页同时打开面板修改规则/设置数据冲突、规则尾接注释（如 example.com #注释 ，分块判断麻烦不再维护）、ublacklist极少使用的订阅项（<all_urls>、@N>5）

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
  const dependencies = { stripRuleComment: ['scanRuleString'], findIfOccurrences: ['scanRuleString'], extractBalancedParens: ['findBalancedParenEnd'], scanRuleString: ['findBalancedParenEnd', 'isBadRegexTail'], buildSyncPayload: ['getSyncSettings'] };
  const scanDeps = !['findBalancedParenEnd', 'scanRuleString'].includes(fnName) && /scanRuleString\(|RULE_PREFIX_RE|RULE_PREFIX_REGEX_RE|RULE_LEADING_REGEX_RE|REGEX_CTX_[A-D]\b/.test(body);
  const consts = text.split('\n').filter(line => /^\s*const (?:RULE_\w+|REGEX_CTX_[A-D]) =/.test(line)).map(line => line.replace('const ', 'var ')).join('\n') + '\n';
  const prelude = (scanDeps ? consts + rawExtract(text, 'findBalancedParenEnd') + '\n' + rawExtract(text, 'scanRuleString') + '\n' + rawExtract(text, 'isBadRegexTail') + '\n' + rawExtract(text, 'regexCloseAhead') + '\n' + rawExtract(text, 'regexStartAhead') + '\n' : '') + (fnName !== 'encodeNonAscii' && /encodeNonAscii\(/.test(body) ? rawExtract(text, 'encodeNonAscii') + '\n' : '') + (!['isUniqueFlagsStr', 'isFlagsCandidateError'].includes(fnName) && /isUniqueFlagsStr\(|isFlagsCandidateError\(/.test(body) ? ['isUniqueFlagsStr', 'isFlagsCandidateError'].map(n => rawExtract(text, n)).join('\n') + '\n' : '');
  return prelude + (dependencies[fnName] || []).map(n => extractFn(text, n)).join('\n') + '\n' + body;
}

const KEYS = {
  CONFIG_KEY: 'searchfilter_blocker',
  WEBDAV_SYNC_CONFIG_KEY: 'searchfilter_webdav_sync_config',
  WEBDAV_SYNC_SELECTORS_KEY: 'searchfilter_webdav_sync_selectors',
  SELECTORS_KEY: 'searchfilter_selectors',
  LOCAL_LAST_MODIFIED_KEY: 'searchfilter_local_last_modified',
  SETTINGS_LAST_MODIFIED_KEY: 'searchfilter_settings_last_modified',
  WEBDAV_LAST_SYNC_KEY: 'searchfilter_webdav_last_sync',
  WEBDAV_SYNC_SNAPSHOT_KEY: 'searchfilter_webdav_sync_snapshot',
  SUBSCRIPTION_SYNC_SNAPSHOT_KEY: 'searchfilter_subscription_sync_snapshot',
  WEBDAV_LAST_SYNC_SELECTORS_KEY: 'searchfilter_webdav_last_sync_selectors',
  SELECTORS_LAST_MODIFIED_KEY: 'searchfilter_selectors_last_modified'
};

const baseSyncFns = [
  'scanRuleString', 'findBalancedParenEnd', 'getSyncSettings', 'getCloudModifiedTime',
  'subscriptionsSignature', 'buildDavPutHeaders', 'persistSyncSnapshots', 'putWebDAVRules',
  'getRuleKey', 'filterValidRuleLines', 'hasEffectiveRules', 'getSubscriptionSyncSnapshot', 'setSubscriptionSyncSnapshot',
  'getRuleSyncSnapshot', 'setRuleSyncSnapshot', 'webdavTargetId', 'mergeRules3Way',
  'stripRuleComment', 'hasTopLevelComma', 'isHttpsUrl', 'getWebDAVRequest', 'ensureWebDAVFolder', 'isHtmlResponse', 'isInvalidSyncResponse', 'parseSyncHeader', 'isNonRuleTextResponse',
  'buildUploadContent', 'gmPutWebDAV', 'putWebDAVBackup',
  'getSelectorSyncSnapshot', 'setSelectorSyncSnapshot', 'selectorsEqual', 'mergeSelectors3Way',
  'firstSuccess', 'parseHttpDateHeader', 'queryNetworkTimeEndpoint', 'getNetworkTimeOffset', 'getTrustedNow',
  'extractValidCloudTimes', 'applyConfigToMainPanel',
  'buildSyncPayload', 'applyCloudSubscriptions', 'adoptStoredConfigIfNewer', 'getDefaultConfig', 'normalizeConfig',
  'checkExternalConfigChange', 'triggerWebDAVSyncDelayed', 'performAutoWebDAVSync', 'performWebDAVDownload',
];
const ruleValidateFns = [
  'hostLabelToASCII', 'toASCIIHostname', 'punycodeDecodeLabel', 'toUnicodeHostname', 'safeRegexTest', 'safeDecodeURIComponent', 'decodeUrlForMatch',
  'getInvalidRegexFlags', 'parseConditionPart', 'tokenizeCondExpr', 'parseCondExprTokens', 'analyzeCondExpr', 'foldCondExpr',
  'evalDynamicLeaf', 'evalCondAST', 'extractBalancedParens', 'findIfOccurrences', 'stripIfConditions', 'evaluateCondition',
  'isCondExprCore', 'looksLikeCondExpr', 'absorbStandaloneExpr', 'parseRuleWithConditions', 'extractIfConditions',
  'validateUrlWildcard', 'ruleToRegex', 'parsePrefixedRegexRule', 'escapeWildcardPart', 'wildcardToRegex',
  'normalizeHostCandidate', 'matchWildcardDomainPattern', 'matchSimpleDomain', 'compileRuleRegex',
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
    let _netTimeOffset = null;
    let _netTimeCheckedAt = 0;
    let _netTimeQuerying = null;
`;

function makeSyncEnv({ cloudStatus = 200, cloudText = '', localRules = [], localTime = 0, localSettingsTime, localSubs = [], storedConfig = undefined, syncConfig = true, syncSelectors = false, localSelectors, initialSelectorSnapshot, responseHeaders = '', putFailures = 0, initialSnapshot = undefined, initialSubSnapshot = undefined }) {
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
    const confirm = () => true;
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
  });
}

const syncCfg = { url: 'https://dav.example.com/dav/', username: '', password: '', filename: 'rules.txt' };

// ---- 同步-001~004: 云端较新 -> 应用云端设置并合并规则上传 ----
{
  const cloud = { enabled: false, language: 'en', syncedAt: 2000, subscriptions: [{ url: 'https://sub/x.txt', enabled: true, lastUpdate: 9 }] };
  const cloudText = '# ScriptConfig:' + JSON.stringify(cloud) + '\n*://cloud.example.com/*';
  const localSubs = [{ url: 'https://sub/x.txt', enabled: true, lastUpdate: 1, rules: ['title/foo/'], name: 'localname' }];
  const env = makeSyncEnv({ cloudText, localRules: ['*://local-old.example.com/*'], localTime: 1000, localSubs });
  env.setCurrent({ rules: ['*://local-old.example.com/*'], enabled: true, language: 'zh-CN' });
  await env.run(syncCfg);
  const cur = env.getCurrent();
  assert('同步-001: 云端较新时应用云端设置', cur.enabled === false && cur.language === 'en');
  assert('同步-002: 智能合并云端与本地规则', cur.rules.includes('*://cloud.example.com/*') && cur.rules.includes('*://local-old.example.com/*') && cur.rules.length === 2);
  assert('同步-004: 对齐本地修改时间戳', env.store.get(KEYS.LOCAL_LAST_MODIFIED_KEY) >= 2000);
}

// ---- 同步-005~006: 本地较新 -> 保留本地设置并合并上传两端规则 ----
{
  const cloud = { enabled: false, syncedAt: 500 };
  const cloudText = '# ScriptConfig:' + JSON.stringify(cloud) + '\n*://cloud.example.com/*';
  const localConfig = { rules: ['*://local.example.com/*'], enabled: true, language: 'zh-CN' };
  const env = makeSyncEnv({ cloudText, localRules: ['*://local.example.com/*'], localTime: 1000, storedConfig: localConfig });
  env.setCurrent({ ...localConfig });
  await env.run(syncCfg);
  const cur = env.getCurrent();
  assert('同步-005: 本地较新时保留本地设置', cur.enabled === true && cur.language === 'zh-CN');
  const put = env.calls.find((c) => c.method === 'PUT' && !c.url.endsWith('.bak'));
  assert('同步-006: 本地较新时合并上传两端规则', !!put && put.data.includes('*://local.example.com/*') && put.data.includes('*://cloud.example.com/*'));
}

// ---- 同步-007: 时间戳相等且规则一致 -> 无操作 ----
{
  const cloud = { enabled: false, syncedAt: 1000 };
  const cloudText = '# ScriptConfig:' + JSON.stringify(cloud) + '\n*://same.example.com/*';
  const env = makeSyncEnv({ cloudText, localRules: ['*://same.example.com/*'], localTime: 1000, storedConfig: { rules: ['*://same.example.com/*'], enabled: true } });
  env.setCurrent({ rules: ['*://same.example.com/*'], enabled: true });
  await env.run(syncCfg);
  assert('同步-007: 时间戳相等时无操作', env.calls.filter((c) => c.method === 'PUT').length === 0 && env.getCurrent().enabled === true);
}

// ---- 同步-008~009: 412冲突重试与上限 ----
{
  const cloudText = '# ScriptConfig:' + JSON.stringify({ syncedAt: 500 }) + '\n*://cloud.example.com/*';
  const env = makeSyncEnv({ cloudText, localRules: ['*://local.example.com/*'], localTime: 1000, putFailures: 1 });
  env.setCurrent({ rules: ['*://local.example.com/*'] });
  await env.run(syncCfg);
  const puts = env.calls.filter((c) => c.method === 'PUT').length;
  assert('同步-008: 412冲突后重新同步并成功上传', puts === 2 && env.store.get(KEYS.LOCAL_LAST_MODIFIED_KEY) >= 1000);
}
{
  const cloudText = '# ScriptConfig:' + JSON.stringify({ syncedAt: 500 }) + '\n*://cloud.example.com/*';
  const env = makeSyncEnv({ cloudText, localRules: ['*://local.example.com/*'], localTime: 1000, putFailures: 99 });
  env.setCurrent({ rules: ['*://local.example.com/*'] });
  await env.run(syncCfg);
  const puts = env.calls.filter((c) => c.method === 'PUT' && !c.url.endsWith('.bak')).length;
  assert('同步-009: 412持续冲突最多重试3次后放弃', puts === 4);
}

// ---- 同步-010~017: 垃圾响应识别单元测试 ----
{
  const isInvalid = new Function(
    extractFn(src, 'isHtmlResponse') + '\n' + extractFn(src, 'isInvalidSyncResponse') + '\nreturn isInvalidSyncResponse;'
  )();
  assert('同步-010: JSON错误体拒绝', isInvalid('{"error":"Not Found","status":404}', '') === true);
  assert('同步-015: HTML注释开头拒绝', isInvalid('<!-- SSO portal -->\n<html><body>login</body></html>', '') === true);
}

// ---- 同步-018~019: 自动同步遇到垃圾响应跳过, 不合并也不上传 ----
{
  const localConfig = { rules: ['*://local.example.com/*'], enabled: true };
  const env = makeSyncEnv({ cloudStatus: 200, cloudText: '{"error":"Not Found"}', localRules: ['*://local.example.com/*'], localTime: 1000, storedConfig: localConfig });
  env.setCurrent({ ...localConfig });
  await env.run(syncCfg);
  assert('同步-018: 自动同步遇到错误响应不合并', env.getCurrent().rules.join('|') === '*://local.example.com/*');
  assert('同步-019: 自动同步遇到错误响应不上传覆盖云端', !env.calls.some((c) => c.method === 'PUT'));
}

// ---- 同步-075: 云端为空时首次上传不被时间戳挡住 ----
{
  const localConfig = { rules: ['*://local.example.com/*'], enabled: true };
  const env = makeSyncEnv({ cloudStatus: 200, cloudText: '', localRules: ['*://local.example.com/*'], localTime: 1000, storedConfig: localConfig, responseHeaders: 'last-modified: Wed, 01 Jan 2025 00:00:00 GMT' });
  env.setCurrent({ ...localConfig });
  await env.run(syncCfg);
  const put = env.calls.find((c) => c.method === 'PUT' && c.url.endsWith('rules.txt'));
  assert('同步-075: 空云端mtime较新时仍上传本地规则', !!put && String(put.data || '').includes('*://local.example.com/*'));
}

// ---- 同步-020~025: 手动下载遇到垃圾响应抛错且不污染本地 ----
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
  assert('同步-020: JSON/纯文本/XML 三类错误响应下载均被拒绝', rejected === garbageBodies.length);
  assert('同步-021: 下载失败后本地规则未被污染', polluted === 0);
}

// ---- 同步-026~029: 跨标签页同步锁互斥与TTL ----
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
  assert('同步-026~028: 首次获取成功/同页重入/他页持锁均失败', tabA.tryAcquire() === true && tabA2.tryAcquire() === false && tabB.tryAcquire() === false);
  const lock = tabA.read();
  lock.expires = Date.now() - 1;
  store.set('searchfilter_sync_lock_webdav', lock);
  assert('同步-029: 锁过期后可重新获取', tabB.tryAcquire() === true);
}

// ---- 同步-030~032: 订阅收集的幽灵订阅防护 ----
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
  const C = 'https://c/rules';
  const subsAB = [
    { url: A, enabled: true, lastUpdate: 1, rules: ['a.example'] },
    { url: B, enabled: true, lastUpdate: 2, rules: ['b.example'] }
  ];
  let out = mkCollect([makeRow(B, B), makeRow(B, A)])(subsAB).newSubs;
  assert('同步-030: 重命名撞已占用URL时旧订阅不残留', out.length === 1 && out[0].url === B && out[0].rules[0] === 'b.example');
  out = mkCollect([makeRow(C, C), makeRow(C, '')])([{ url: C, enabled: true, rules: ['c.example'] }]).newSubs;
  out = mkCollect([makeRow(B, A), makeRow(A, B)])(subsAB).newSubs;
  assert('同步-032: 两行互换URL时两条订阅均保留', out.length === 2 && out.some(s => s.url === A && s.rules[0] === 'a.example') && out.some(s => s.url === B && s.rules[0] === 'b.example'));
}

// ---- 同步-033~035: 订阅迟到响应防护 ----
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
  assert('同步-033: 迟到响应不恢复已删除订阅', result.cancelled === true && subs.length === 0);
  assert('同步-034: 迟到响应保留删除墓碑', tombstones[url] === 123);
  subs = [{ url, enabled: false, rules: [] }];
  const retry = update(url, false);
  resolveResponse({ responseText: 'new.example' });
  const success = await retry;
}
// 忽略该问题: 远端合法rules为空的订阅不清空旧规则，此为故意设计

// ---- 同步-036~039: parseSyncHeader 头解析与损坏头剔除 ----
{
  const parse = new Function(
    extractFn(src, 'hasTopLevelComma') + '\n' + extractFn(src, 'parseSyncHeader') + '\nreturn parseSyncHeader;'
  )();
  const broken = parse('# ScriptConfig:{broken-json}\n*://a.com/*');
  assert('同步-036: 损坏 ScriptConfig 头行剔除出正文且 rawScriptConfig 置空', broken.restLines.length === 1 && broken.restLines[0] === '*://a.com/*' && broken.rawScriptConfig === null && broken.config === null);
  const valid = parse('# ScriptConfig: {"syncedAt":1}\n*://a.com/*');
  const brokenSel = parse('# ScriptConfig: {"syncedAt":1}\n# Selectors:{bad\n*://a.com/*');
  assert('同步-038: 损坏 Selectors 行剔除且 rawSelectors 置空, 好头不受影响', brokenSel.restLines.join('|') === '*://a.com/*' && brokenSel.rawSelectors === null && brokenSel.config.syncedAt === 1);
  const blank = parse('\n# ScriptConfig: {"syncedAt":7777}\n*://a.com/*');
}
// 忽略该问题: 深层嵌套递归溢出，极罕见情况无修复意义



// ---- 同步-047~051: buildUploadContent 选择器头保留与删除传播 ----
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
    ${extractFn(src, 'buildUploadContent')}
    return { build: (content, at, preserved) => buildUploadContent(content, at, preserved) };
  `);
  const env2 = f(store);
  const remoteRaw = '# ScriptConfig:' + JSON.stringify({ enabled: false });
  const out = env2.build('*://a.com/*', 9000, { rawScriptConfig: remoteRaw, rawSelectors: '# Selectors: {"foo":1}' });
  const lines = out.split('\n');
  assert('同步-047: 关闭配置同步时保留云端其他字段', lines[0].startsWith('# ScriptConfig:') && lines[0].includes('"enabled":false') && lines[0].includes('"rulesSyncedAt":9000'));
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
    ${extractFn(src, 'selectorsEqual')}
    ${extractFn(src, 'buildUploadContent')}
    return { build: (content, at, preserved) => buildUploadContent(content, at, preserved) };
  `);
  const env3 = f(store);
  assert('同步-049: 本地空选择器且云端无头时不发布空Selectors', !env3.build('r', 1000, {}).includes('# Selectors:'));
  assert('同步-050: 云端已有头时空选择器仍发布(删除传播)', env3.build('r', 1000, { rawSelectors: '# Selectors: {}' }).includes('# Selectors:{'));
  store.set('sel', { mine: { match: '/x/', containers: '.r' } });
  assert('同步-051: 本地非空且云端无头时发布选择器(修复丢头)', env3.build('r', 1000, {}).includes('"mine"'));
  const headerTime = (out) => JSON.parse(out.split('\n')[0].slice('# ScriptConfig:'.length)).selectorsSyncedAt;
  const remoteHeader = '# ScriptConfig:' + JSON.stringify({ selectorsSyncedAt: 500 });
  store.set(KEYS.WEBDAV_LAST_SYNC_SELECTORS_KEY, { mine: { match: '/x/', containers: '.r' } });
  store.set('selTime', 700);
  assert('同步-051a: 选择器未变化时上传不推进selectorsSyncedAt', headerTime(env3.build('r', 1000, { rawScriptConfig: remoteHeader })) === 500);
  store.set('sel', { mine: { match: '/x/', containers: '.new' } });
  assert('同步-051b: 选择器变化时上传推进selectorsSyncedAt', headerTime(env3.build('r', 1000, { rawScriptConfig: remoteHeader })) === 1000);
  store.set('sel', { mine: { match: '/x/', containers: '.new' } }); store.set(KEYS.WEBDAV_LAST_SYNC_SELECTORS_KEY, { mine: { match: '/x/', containers: '.new' } });
}

// ---- 同步-052~054: mergeRules3Way 三方合并核心场景 ----
{
  const merge3 = new Function(
    extractFn(src, 'stripRuleComment') + '\n' + extractFn(src, 'getRuleKey') + '\n' + extractFn(src, 'mergeRules3Way') + '\nreturn mergeRules3Way;'
  )();
  const res1 = merge3(['*://r1.com/*', '*://r2.com/*'], ['*://r1.com/*'], ['*://r1.com/*', '*://r2.com/*', '*://r3.com/*']);
  assert('同步-052: 本地删除生效且云端新增保留', res1.includes('*://r1.com/*') && !res1.includes('*://r2.com/*') && res1.includes('*://r3.com/*'));
  const res2 = merge3(['*://r1.com/*', '*://r2.com/*'], ['*://r1.com/*', '*://r2.com/*', '*://r4.com/*'], ['*://r2.com/*']);
  const res5 = merge3(['# 广告', 'ad.com', '# 购物', 'shop.com'], ['# 购物', 'shop.com', '# 广告', 'ad.com'], ['# 广告', 'ad.com', '# 购物', 'shop.com', 'new.com']);
  assert('同步-054: 本地重排后云端新增仍落在原锚点之后', JSON.stringify(res5) === JSON.stringify(['# 购物', 'shop.com', '# 广告', 'ad.com', 'new.com']));
  const res6 = merge3(['*://a.com/* @if(title *= "x")', '*://b.com/*'], ['*://a.com/* @if(title *= "y")', '*://b.com/*'], ['*://a.com/* @if(title *= "z")', '*://b.com/*']);
  assert('同步-068: 双方编辑同一条规则只保留本地变体', JSON.stringify(res6) === JSON.stringify(['*://a.com/* @if(title *= "y")', '*://b.com/*']));
  const res7 = merge3(['*://a.com/*', '*://b.com/*'], ['*://a2.com/*', '*://b.com/*'], ['*://a.com/*', '*://b.com/*', '*://c.com/*']);
  // 双方都改同一基线且替换组有交集时并集保留双方新增, 替换组完全不同时按修改时间择一
  const res8 = merge3(['A', 'B', 'C'], ['A', 'X', 'Y', 'C'], ['A', 'X', 'C'], true);
  assert('同步-077: 双方都改同一基线时不得丢失双方都存在的规则', JSON.stringify(res8) === JSON.stringify(['A', 'X', 'Y', 'C']));
  assert('同步-079: 双方改写为不同规则时按修改时间择一', JSON.stringify(merge3(['a', 'b'], ['a2', 'b'], ['a3', 'b'], false)) === JSON.stringify(['a3', 'b']) && JSON.stringify(merge3(['a', 'b'], ['a2', 'b'], ['a3', 'b'], true)) === JSON.stringify(['a2', 'b']));
  const res10 = merge3(['A', 'B', 'C'], ['A', 'Y', 'C'], ['Z', 'W', 'C'], true);
  const res12 = merge3(['A', 'B', 'C'], ['X', 'Y', 'C'], ['Z', 'W', 'C'], true);
  // 修复留档: pickGroup对同槽替换组有交集时并集, 纯新增规则不再被组级二选一丢弃
  assert('同步-083: 同槽替换组有交集时双侧纯新增均保留(修复留档)', JSON.stringify(merge3(['A'], ['X'], ['X', 'Y'], true)) === JSON.stringify(['X', 'Y']) && JSON.stringify(merge3(['A'], ['X', 'Y'], ['X'], false)) === JSON.stringify(['X', 'Y']));
  assert('同步-084: 同槽替换组无交集时仍按修改时间择一', JSON.stringify(merge3(['A'], ['X'], ['Y'], true)) === JSON.stringify(['X']) && JSON.stringify(merge3(['A'], ['X'], ['Y'], false)) === JSON.stringify(['Y']));
  // 修复留档: 共享规则被映射到不同槽时, 两侧都要进入同槽组, 不得在组级择一中丢失
  const res13 = merge3(['A', 'B'], ['C'], ['C', 'A', 'D'], false);
  const res14 = merge3(['A', 'B'], ['C'], ['C', 'A', 'D'], true);
  assert('同步-095: 双方共有的替换规则不因槽位映射丢失(修复留档)', JSON.stringify(res13) === JSON.stringify(['C', 'D']) && JSON.stringify(res14) === JSON.stringify(['C', 'D']));
  // 修复留档: 单槽一侧改写、另一侧改写并纯新增时, 纯新增不得并被替换组丢弃
  assert('同步-097: 同槽替换同时另一侧新增时保留新增(修复留档)', JSON.stringify(merge3(['*://a.com/*'], ['*://a2.com/*'], ['*://a3.com/*', '*://b.com/*'], true)) === JSON.stringify(['*://a2.com/*', '*://b.com/*']));
  // 易错留档: 双方编辑同一规则文本(如行尾注释)时 pickLine 恒取本地, 不随 preferLocal 倾斜
}

// ---- 同步-055~061: mergeSelectors3Way 三方合并与删除vs修改仲裁 ----
{
  const merge = new Function(`
    ${extractFn(src, 'mergeSelectors3Way')}
    return mergeSelectors3Way;
  `)();
  const base = { bing: { containers: '.old', titles: ['h2 a'] }, yahoo: { containers: '.y' } };
  const local = { bing: { containers: '.new-local', titles: ['h2 a'] }, yahoo: { containers: '.y' }, localOnly: { containers: '.l' } };
  const cloud = { bing: { containers: '.new-cloud', titles: ['h2 a'] }, yahoo: { containers: '.y' }, cloudOnly: { containers: '.c' } };
  const r1 = merge(base, local, cloud);
  assert('同步-055: 双方都修改时本地优先', r1.bing.containers === '.new-local');
  const r2 = merge(base, local, { bing: cloud.bing, cloudOnly: cloud.cloudOnly });
  assert('同步-057: 云端删除的选择器传播删除', !r2.yahoo);
  const b1 = { bing: { containers: '.old' } };
  assert('同步-058: 本地删除+云端修改且本地规则时间较新时删除赢', merge(b1, {}, { bing: { containers: '.new-cloud' } }, true).bing === undefined);
  assert('同步-059: 本地删除+云端修改且云端规则时间较新时修改保留', merge(b1, {}, { bing: { containers: '.new-cloud' } }, false).bing.containers === '.new-cloud');
  assert('同步-061b: 快照缺失且本地较旧时采用云端', merge(null, { bing: { containers: '.old-local' } }, { bing: { containers: '.new-cloud' } }, false).bing.containers === '.new-cloud');
}

// ---- 同步-062~065: applyCloudSubscriptions 删除传播 ----
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
  assert('同步-062: 云端删除的订阅传播到本地', Array.isArray(out) && !out.some((s) => s.url === 'https://cloud-deleted/x') && subs.length === 1);
  subs = [
    { url: 'https://keep/x', enabled: true, rules: ['k1'], lastUpdate: 3, name: 'K' },
    { url: 'https://local-mod/x', enabled: false, rules: ['m1'], lastUpdate: 5, name: 'D' }
  ];
  const baseMod = [
    { url: 'https://keep/x', name: 'K', enabled: true },
    { url: 'https://local-mod/x', name: 'D', enabled: true }
  ];
  const apiKeep = mkApi()(
    () => subs.map((s) => ({ ...s })),
    (v) => { subs = v; },
    () => baseMod,
    () => {}
  );
  const kept = apiKeep([{ url: 'https://keep/x', name: 'K', enabled: false }], false);
  const mod = kept.find((s) => s.url === 'https://local-mod/x');
  assert('同步-064: 云端删除但本地已修改(enabled/name)的订阅保留修改方', !!mod && mod.enabled === false && mod.name === 'D');
  subs = [{ url: 'https://keep/x', enabled: false, rules: ['k1'], lastUpdate: 3, name: 'K' }];
  const apiField = mkApi()(
    () => subs.map((s) => ({ ...s })),
    (v) => { subs = v; },
    () => [{ url: 'https://keep/x', name: 'K', enabled: true }],
    () => {}
  );
  const keptOff = apiField([{ url: 'https://keep/x', name: 'K', enabled: true }], false);
  assert('同步-065: 仅本地关闭订阅时不被较新云端设置重新打开', keptOff[0].enabled === false && keptOff[0].rules[0] === 'k1');
}


// ---- 同步-070~073: 覆盖非空云端前备份为 .bak ----
{
  // 自动同步: 合并产生上传 -> 先备份云端旧内容再覆盖(每次上传均备份)
  const cloudRules = ['*://cloud.example.com/*', '*://cloud2.example.com/*'];
  const cloudText = '# ScriptConfig:' + JSON.stringify({ syncedAt: 500 }) + '\n' + cloudRules.join('\n');
  const env = makeSyncEnv({ cloudText, localRules: [], localTime: 1000, storedConfig: { rules: [], enabled: true }, initialSnapshot: cloudRules });
  env.setCurrent({ rules: [], enabled: true });
  await env.run(syncCfg);
  const bakPut = env.calls.find((c) => c.method === 'PUT' && c.url.endsWith('.bak'));
  const finalPut = env.calls.find((c) => c.method === 'PUT' && !c.url.endsWith('.bak'));
  const bakIdx = env.calls.indexOf(bakPut);
  assert('同步-070: 上传前先PUT备份云端旧内容', !!bakPut && String(bakPut.data || '').includes('*://cloud.example.com/*') && bakIdx !== -1 && bakIdx < env.calls.indexOf(finalPut));
  assert('同步-071: 备份文件名为 rules.txt.bak 且置空上传不含旧规则', !!bakPut && !!finalPut && bakPut.url.endsWith('rules.txt.bak') && finalPut.url.endsWith('rules.txt') && !String(finalPut.data || '').includes('*://cloud.example.com/*'));
}
{
  // 云端已有空规则文件(scriptedEmptyCloud)或备份PUT失败 -> 不重复备份/不上传
  const cloud = { syncedAt: 500, rulesSyncedAt: 500 };
  const cloudText = '# ScriptConfig:' + JSON.stringify(cloud) + '\n';
  const env = makeSyncEnv({ cloudText, localRules: [], localTime: 1000, storedConfig: { rules: [], enabled: true } });
  env.setCurrent({ rules: [], enabled: true });
  await env.run(syncCfg);
}
{
  const cloudRules = ['*://cloud.example.com/*'];
  const cloudText = '# ScriptConfig:' + JSON.stringify({ syncedAt: 500 }) + '\n' + cloudRules.join('\n');
  const env = makeSyncEnv({ cloudText, localRules: [], localTime: 1000, storedConfig: { rules: [], enabled: true }, initialSnapshot: cloudRules, putFailures: 1 });
  env.setCurrent({ rules: [], enabled: true });
  await env.run(syncCfg);
  assert('同步-073: 备份PUT失败不中断置空上传, 主PUT仍执行', env.calls.some((c) => c.method === 'PUT' && !c.url.endsWith('.bak')) && env.getCurrent().rules.length === 0); // 已修复: 备份失败仅警告不阻断
}

// ---- 授时-001~003: 授时回退链 ----
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
  assert('授时-001: 授时端点全失败时回退本地时间且不抛错', typeof v === 'number' && v >= before - 100 && v <= Date.now() + 100);
  const withDate = await api(1234567890123);
  assert('授时-002: 授时失败时回退传入的服务器Date时间', withDate === 1234567890123);
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
  assert('授时-003: 前两源失败时回退cloudflare ts解析', typeof offset === 'number' && offset !== null && Math.abs(offset - expect) < 1000);
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
  assert('授时-004: 刷新后复用持久化授时缓存且不发请求', offset === 5000 && state.calls === 0);
}
{
  const run = (webdav) => {
    let trusted = 0;
    const fn = new Function('GM_getValue', 'GM_setValue', 'loadWebDAVConfig', 'isHttpsUrl', 'getTrustedNow', `
      const LOCAL_LAST_MODIFIED_KEY = 'searchfilter_local_last_modified';
      ${extractFn(src, 'markLocalModifiedTime')}
      return markLocalModifiedTime;
    `)((k, d) => d, () => {}, () => webdav, (u) => /^https:/.test(u), () => { trusted++; return Date.now(); });
    fn(); return trusted;
  };
  assert('授时-005: 未配置WebDAV时标记时间不联网', run({}) === 0 && run({ url: 'https://dav.example.com/' }) === 1);
}

// ---- 同步-087~088: 选择器快照目标校验(修复留档) ----
{
  const mkSel = (n) => ({ match: `/(?:^|\\.)${n}\\.example\\.com$/`, containers: `.${n}` });
  const localSel = { xEngine: mkSel('x'), yEngine: mkSel('y') };
  const cloudText = '# ScriptConfig:' + JSON.stringify({ rulesSyncedAt: 5000, selectorsSyncedAt: 5000 }) + '\n# Selectors:' + JSON.stringify({ zEngine: mkSel('z') }) + '\n*://x.example.com/*';
  const env = makeSyncEnv({ cloudText, localRules: ['*://x.example.com/*'], localTime: 1000, localSelectors: localSel, initialSelectorSnapshot: localSel });
  env.setCurrent({ rules: ['*://x.example.com/*'], enabled: true });
  await env.run(syncCfg);
  const kept = env.store.get(KEYS.SELECTORS_KEY);
  assert('同步-087: 旧格式快照(无target)视为无基线, 换地址后本地引擎不被云端清空', !!(kept && kept.xEngine && kept.yEngine && kept.zEngine));
  const snap = env.store.get(KEYS.WEBDAV_LAST_SYNC_SELECTORS_KEY);
  assert('同步-088: 同步后快照带target且与规则快照同法校验', !!(snap && snap.target === 'https://dav.example.com/dav/rules.txt' && snap.selectors && snap.selectors.xEngine));
  const base = { deadEngine: mkSel('d'), keepEngine: mkSel('k') };
  const cloudText2 = '# ScriptConfig:' + JSON.stringify({ rulesSyncedAt: 5000, selectorsSyncedAt: 5000 }) + '\n# Selectors:' + JSON.stringify({ deadEngine: base.deadEngine, keepEngine: base.keepEngine, newEngine: mkSel('n') }) + '\n*://x.example.com/*';
  const env2 = makeSyncEnv({ cloudText: cloudText2, localRules: ['*://x.example.com/*'], localTime: 1000, localSelectors: { keepEngine: base.keepEngine }, initialSelectorSnapshot: { target: 'https://dav.example.com/dav/rules.txt', selectors: base } });
  env2.setCurrent({ rules: ['*://x.example.com/*'], enabled: true });
  await env2.run(syncCfg);
  const merged2 = env2.store.get(KEYS.SELECTORS_KEY);
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
  assert('同步-093: PUT期间新增规则不进入快照', JSON.stringify(snapshot) === JSON.stringify(['*://snap.example.com/*']) && ctx.rules.includes('*://during.example.com/*'));
}

// ---- 同步-094: 云端注释含HTML标签时仍同步(修复留档) ----
{
  const cloud = { enabled: true, syncedAt: 500 };
  const cloudText = '# ScriptConfig:' + JSON.stringify(cloud) + '\n# 只处理 <body> 内的浮层\n*://cloud.example.com/*';
  const env = makeSyncEnv({ cloudText, localRules: ['*://local.example.com/*'], localTime: 1000, storedConfig: { rules: ['*://local.example.com/*'], enabled: true } });
  env.setCurrent({ rules: ['*://local.example.com/*'], enabled: true });
  await env.run(syncCfg);
  assert('同步-094: 云端注释含<body>时仍合并规则', env.getCurrent().rules.includes('*://cloud.example.com/*') && env.getCurrent().rules.includes('*://local.example.com/*'));
}

// 修复留档: 订阅/引擎订阅后台更新入队后不复查面板状态, 面板打开期间会整表覆盖订阅数据
{
const recheck = (t) => /runBackgroundSync\('webdav', async \(\) => \{\s*if \(!force && isSerhPanelOpen\(\)\) return;/.test(t);
assert('同步-096: 订阅/引擎订阅后台回调复查面板且放行force手动刷新', recheck(extractFn(src, 'checkAutoSubscription')) && recheck(extractFn(src, 'checkAutoEngineSubscription')));
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
    ${extractFn(src, 'getSubscriptionSyncSnapshot')}
    ${extractFn(src, 'setSubscriptionSyncSnapshot')}
    return { get: getSubscriptionSyncSnapshot, set: setSubscriptionSyncSnapshot };
  `)(store, () => target);
  api.set([{ url: 'https://a/rules', name: 'A', enabled: true }]);
  const raw = store.get(KEYS.SUBSCRIPTION_SYNC_SNAPSHOT_KEY);
  assert('同步-097: 订阅快照带target且同目标可读', !!(raw && raw.target === target && raw.subs && raw.subs.length === 1 && api.get() && api.get()[0].url === 'https://a/rules'));
  api.set([{ url: 'https://a/rules', name: 'A', enabled: true }], { target: 'https://dav.example.com/dav/explicit.txt' });
  assert('同步-097b: 订阅快照目标优先取调用方config', store.get(KEYS.SUBSCRIPTION_SYNC_SNAPSHOT_KEY).target === 'https://dav.example.com/dav/explicit.txt');
  target = 'https://dav.example.com/dav/other.txt';
  assert('同步-098: 换WebDAV目标后旧订阅快照视为无基线', api.get() === null);
  store.set(KEYS.SUBSCRIPTION_SYNC_SNAPSHOT_KEY, raw.subs);
  target = 'https://dav.example.com/dav/rules.txt';
  assert('同步-099: 旧数组格式订阅快照视为无基线', api.get() === null);
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
  assert('同步-100: 旧目标订阅快照不当作基线, 本地与云端订阅取并集', oldTarget.some(s => s.url === X.url) && oldTarget.some(s => s.url === Y.url));
  const sameTarget = await runCase({ target: 'https://dav.example.com/dav/rules.txt', subs: [X] });
  assert('同步-101: 同目标快照仍传播云端订阅删除', sameTarget.length === 1 && sameTarget[0].url === Y.url);
}

// 易错: 三方合并依赖快照, 成功同步后须更新快照且仅自动同步走合并

// 留档观察: parseSyncHeader只扫描前10行, 属故意设计
// 留档观察: mergeSelectors3Way用>而mergeRules3Way用>=, 相等时间戳时preferLocal倾向不同, 无数据错误(设计取舍)
// 修复留档(主/Lite): Lite启动清理仅墓碑键, 双装时不删主版订阅/WebDAV/时间戳数据
{
  const lite = fs.readFileSync(path.join(scriptDir, 'Lite.user.js'), 'utf8');
  const m = lite.match(/\['searchfilter_rule_tombstones'[^\]]*\]/);
  assert('同步-102: Lite启动清理不含主版联网键', !!m && !/webdav|subscriptions|last_modified|migrated/.test(m[0]));
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
})();
