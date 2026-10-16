// 同步: WebDAV同步仲裁 / 412重试 / 垃圾响应防护 / 跨页锁 / 订阅面板防护 / 头解析 / 密码混淆 / 三方合并 / 授时回退
// 命名规则: 同步-三位序号: 描述; 授时项用 授时-前缀
(async () => {
const fs = require('fs');
const path = require('path');

const scriptDir = path.join(__dirname, '..');
const scriptFiles = fs.readdirSync(scriptDir).filter((name) => name.endsWith('.js') && !name.toLowerCase().includes('lite')).sort();
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
  const prelude = (scanDeps ? consts + rawExtract(text, 'findBalancedParenEnd') + '\n' + rawExtract(text, 'scanRuleString') + '\n' + rawExtract(text, 'isBadRegexTail') + '\n' + rawExtract(text, 'regexCloseAhead') + '\n' : '') + (fnName !== 'encodeNonAscii' && /encodeNonAscii\(/.test(body) ? rawExtract(text, 'encodeNonAscii') + '\n' : '') + (!['isUniqueFlagsStr', 'isFlagsCandidateError'].includes(fnName) && /isUniqueFlagsStr\(|isFlagsCandidateError\(/.test(body) ? ['isUniqueFlagsStr', 'isFlagsCandidateError'].map(n => rawExtract(text, n)).join('\n') + '\n' : '');
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
  'getRuleKey', 'filterValidRuleLines', 'getSubscriptionSyncSnapshot', 'setSubscriptionSyncSnapshot',
  'getRuleSyncSnapshot', 'setRuleSyncSnapshot', 'mergeRules3Way',
  'stripRuleComment', 'isHttpsUrl', 'getWebDAVRequest', 'ensureWebDAVFolder', 'isHtmlResponse', 'isInvalidSyncResponse', 'parseSyncHeader', 'isNonRuleTextResponse',
  'buildUploadContent', 'gmPutWebDAV',
  'getSelectorSyncSnapshot', 'setSelectorSyncSnapshot', 'selectorsEqual', 'mergeSelectors3Way',
  'firstSuccess', 'parseHttpDateHeader', 'queryNetworkTimeEndpoint', 'getNetworkTimeOffset', 'getTrustedNow',
  'extractValidCloudTimes', 'applyConfigToMainPanel',
  'buildSyncPayload', 'applyCloudSubscriptions', 'adoptStoredConfigIfNewer', 'getDefaultConfig', 'normalizeConfig',
  'checkExternalConfigChange', 'triggerWebDAVSyncDelayed', 'performAutoWebDAVSync', 'performWebDAVDownload',
];
const ruleValidateFns = [
  'hostLabelToASCII', 'toASCIIHostname', 'punycodeDecodeLabel', 'toUnicodeHostname', 'safeRegexTest', 'safeDecodeURIComponent',
  'getInvalidRegexFlags', 'parseConditionPart', 'tokenizeCondExpr', 'parseCondExprTokens', 'analyzeCondExpr', 'foldCondExpr',
  'evalDynamicLeaf', 'evalCondAST', 'extractBalancedParens', 'findIfOccurrences', 'stripIfConditions', 'evaluateCondition',
  'isCondExprCore', 'looksLikeCondExpr', 'absorbStandaloneExpr', 'parseRuleWithConditions', 'extractIfConditions',
  'validateUrlWildcard', 'ruleToRegex', 'parsePrefixedRegexRule', 'escapeWildcardPart', 'wildcardToRegex',
  'normalizeHostCandidate', 'matchWildcardDomainPattern', 'extractSimpleWhitelistDomain', 'matchSimpleDomain', 'compileRuleRegex',
  'validateCondition', 'analyzeRule', 'validateRule', 'isScriptRuleLine', 'isElementRuleLine',
];
const syncFns = [...new Set(baseSyncFns.concat(ruleValidateFns))].map((n) => extractFn(src, n));
const settingsTimePrelude = `const SETTINGS_LAST_MODIFIED_KEY = ${JSON.stringify(KEYS.SETTINGS_LAST_MODIFIED_KEY)};\n${extractFn(src, 'getSettingsModifiedTime')}\nfunction getSelectorsModifiedTime(){ const t = GM_getValue(${JSON.stringify(KEYS.SELECTORS_LAST_MODIFIED_KEY)}, 0); return typeof t === 'number' && t > 0 ? t : getSettingsModifiedTime(); }`;
const syncEnvPrelude = src.match(/const CFG_DEFAULTS = \{[^\n]+\};/)[0] + '\n' + src.match(/const DEFAULT_HIGHLIGHT_COLORS = \{[^\n]+\};/)[0] + '\n' + settingsTimePrelude;
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
  assert('同步-003: 合并产生新内容时上传合并结果', env.calls.some((c) => c.method === 'PUT'));
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
  const put = env.calls.find((c) => c.method === 'PUT');
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
  const puts = env.calls.filter((c) => c.method === 'PUT').length;
  assert('同步-009: 412持续冲突最多重试3次后放弃', puts === 4);
}

// ---- 同步-010~017: 垃圾响应识别单元测试(网关 200 + JSON/HTML/纯文本错误页) ----
{
  const isInvalid = new Function(
    extractFn(src, 'isHtmlResponse') + '\n' + extractFn(src, 'isInvalidSyncResponse') + '\nreturn isInvalidSyncResponse;'
  )();
  assert('同步-010: JSON错误体拒绝', isInvalid('{"error":"Not Found","status":404}', '') === true);
  assert('同步-011: 纯文本状态行拒绝', isInvalid('404 Not Found', '') === true);
  assert('同步-012: XML错误拒绝', isInvalid('<?xml version="1.0"?><Error/>', '') === true);
  assert('同步-013: JSON content-type 拒绝', isInvalid('[1,2', 'content-type: application/json\r\n') === true);
  assert('同步-014: HTML标记拒绝', isInvalid('<html><body>x</body></html>', '') === true);
  assert('同步-015: HTML注释开头拒绝', isInvalid('<!-- SSO portal -->\n<html><body>login</body></html>', '') === true);
  assert('同步-016: YAML段落文件放行', isInvalid('[Section]\nname: x', 'text/plain') === false);
  assert('同步-017: 合法规则不因 text/html 类型拒绝', isInvalid('*://a.com/*', 'content-type: text/html; charset=utf-8') === false);
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

// ---- 同步-020~025: 手动下载遇到垃圾响应抛错且不污染本地 ----
{
  const garbageBodies = [
    '{"error":"Not Found","status":404}',
    'Not Found',
    '<?xml version="1.0" encoding="UTF-8"?><Error><Code>NoSuchKey</Code></Error>'
  ];
  for (let gi = 0; gi < garbageBodies.length; gi++) {
    const body = garbageBodies[gi];
    const env = makeSyncEnv({ cloudStatus: 200, cloudText: body, localRules: ['*://local.example.com/*'], localTime: 1000, syncConfig: false, responseHeaders: 'content-type: text/plain' });
    env.setCurrent({ rules: ['*://local.example.com/*'], enabled: true });
    let threw = false;
    try { await env.download(syncCfg); } catch (_) { threw = true; }
    assert(`同步-020-${gi + 1}: 错误响应下载被拒绝(${body.slice(0, 24)}...)`, threw);
    assert(`同步-021-${gi + 1}: 本地规则未被污染`, env.getCurrent().rules.join('|') === '*://local.example.com/*');
  }
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
  assert('同步-026: 首次获取锁成功', tabA.tryAcquire() === true);
  const tabA2 = makeLockEnv('tabA');
  assert('同步-027: 同页持锁期间不允许重入', tabA2.tryAcquire() === false);
  const tabB = makeLockEnv('tabB');
  assert('同步-028: 他页持锁期间获取失败', tabB.tryAcquire() === false);
  const lock = tabA.read();
  lock.expires = Date.now() - 1;
  store.set('searchfilter_sync_lock_webdav', lock);
  assert('同步-029: 锁过期后可重新获取', tabB.tryAcquire() === true);
}

// ---- 同步-030~032: 订阅面板收集的幽灵订阅防护(重命名撞URL/重复URL/互换URL) ----
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
  assert('同步-030: 重命名撞已占用URL时旧订阅不残留', out.length === 1 && out[0].url === B && out[0].rules[0] === 'b.example');
  out = mkCollect([makeRow(C, C), makeRow(C, '')])([{ url: C, enabled: true, rules: ['c.example'] }]).newSubs;
  assert('同步-031: 重复URL的新增行不误删原有订阅', out.length === 1 && out[0].rules[0] === 'c.example');
  out = mkCollect([makeRow(B, A), makeRow(A, B)])(subsAB).newSubs;
  assert('同步-032: 两行互换URL时两条订阅均保留', out.length === 2 && out.some(s => s.url === A && s.rules[0] === 'a.example') && out.some(s => s.url === B && s.rules[0] === 'b.example'));
}

// ---- 同步-033~035: 订阅迟到响应防护(不复活已删除订阅/不清墓碑/正常导入) ----
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
  assert('同步-035: 已保存的新订阅可以正常导入', success.success && subs[0].rules[0] === 'new.example');
}

// ---- 同步-036~039: parseSyncHeader 头解析与损坏头剔除 ----
{
  const parse = new Function(
    extractFn(src, 'parseSyncHeader') + '\nreturn parseSyncHeader;'
  )();
  const broken = parse('# ScriptConfig:{broken-json}\n*://a.com/*');
  assert('同步-036: 损坏 ScriptConfig 头行剔除出正文且 rawScriptConfig 置空', broken.restLines.length === 1 && broken.restLines[0] === '*://a.com/*' && broken.rawScriptConfig === null && broken.config === null);
  const valid = parse('# ScriptConfig: {"syncedAt":1}\n*://a.com/*');
  assert('同步-037: 合法 ScriptConfig 头解析并移除', valid.restLines[0] === '*://a.com/*' && valid.config.syncedAt === 1);
  const brokenSel = parse('# ScriptConfig: {"syncedAt":1}\n# Selectors:{bad\n*://a.com/*');
  assert('同步-038: 损坏 Selectors 行剔除且 rawSelectors 置空, 好头不受影响', brokenSel.restLines.join('|') === '*://a.com/*' && brokenSel.rawSelectors === null && brokenSel.config.syncedAt === 1);
  const blank = parse('\n# ScriptConfig: {"syncedAt":7777}\n*://a.com/*');
  assert('同步-039: 首行空行时头仍可解析', blank.config && blank.config.syncedAt === 7777);
}

// ---- 同步-040~042: WebDAV 凭据匹配 ----
{
  const saved = { url: 'https://dav.example/a/', username: 'alice', password: 'secret', filename: 'rules.txt' };
  const api = new Function(`
    ${extractFn(src, 'hasMatchingWebDAVCredentials')}
    ${extractFn(src, 'resolveWebDAVPanelConfig')}
    return { resolve: resolveWebDAVPanelConfig };
  `)();
  const values = { ...saved, password: '' };
  assert('同步-040: 双参数匹配才复用密码', api.resolve(saved, values).password === 'secret');
  assert('同步-041: 更改地址拒绝复用', api.resolve(saved, { ...values, url: 'https://dav.example/b/' }) === null);
  assert('同步-042: 新密码可用于新账号', api.resolve(saved, { ...values, username: 'bob', password: 'new' }).password === 'new');
}

// ---- 同步-043~046: WebDAV 密码混淆存储与读取还原 ----
{
  const saved = { url: 'https://dav.example/a/', username: 'alice', password: 'secret', filename: 'rules.txt' };
  const passwordInput = { value: '', type: 'password' };
  const togglePasswordBtn = { style: {}, textContent: '🐵' };
  const urlInput = { value: saved.url };
  const usernameInput = { value: saved.username };
  let stored = { ...saved };
  const ui = new Function('passwordInput', 'togglePasswordBtn', 'urlInput', 'usernameInput', 'GM_getValue', 'GM_setValue', `
    const WEBDAV_KEY = 'webdav';
    const t = k => k === 'webdavPasswordSaved' ? '已保存密码，输入新密码以替换' : k;
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
  passwordInput.value = 'replacement';
  passwordInput.type = 'text';
  ui.save({ ...saved, password: 'replacement' });
  assert('同步-043: 密码以混淆形式存储', typeof stored.password === 'string' && stored.password.indexOf('serhx1:') === 0);
  assert('同步-044: 读取配置自动还原密码', ui.load().password === 'replacement');
  stored.password = 'legacy-plain';
  assert('同步-045: 兼容未混淆的旧明文', ui.load().password === 'legacy-plain');
  const unicode = ui.obf('密碼pass🔐');
  assert('同步-046: 非ASCII密码往返一致', ui.deobf(unicode) === '密碼pass🔐');
}

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
  assert('同步-048: 未开启选择器同步时原样保留云端选择器头', out.includes('# Selectors: {"foo":1}'));
}
{
  const store = new Map();
  store.set(KEYS.WEBDAV_SYNC_SELECTORS_KEY, true);
  const f = new Function('store', `
    const WEBDAV_SYNC_CONFIG_KEY = ${JSON.stringify(KEYS.WEBDAV_SYNC_CONFIG_KEY)};
    const WEBDAV_SYNC_SELECTORS_KEY = ${JSON.stringify(KEYS.WEBDAV_SYNC_SELECTORS_KEY)};
    const GM_getValue = (k, d) => (store.has(k) ? store.get(k) : d);
    function getUserSelectors() { return store.get('sel') || {}; }
    function getSelectorsModifiedTime() { return 0; }
    ${extractFn(src, 'buildUploadContent')}
    return { build: (content, at, preserved) => buildUploadContent(content, at, preserved) };
  `);
  const env3 = f(store);
  assert('同步-049: 本地空选择器且云端无头时不发布空Selectors', !env3.build('r', 1000, {}).includes('# Selectors:'));
  assert('同步-050: 云端已有头时空选择器仍发布(删除传播)', env3.build('r', 1000, { rawSelectors: '# Selectors: {}' }).includes('# Selectors:{'));
  store.set('sel', { mine: { match: '/x/', containers: '.r' } });
  assert('同步-051: 本地非空且云端无头时发布选择器(修复丢头)', env3.build('r', 1000, {}).includes('"mine"'));
}

// ---- 同步-052~054: mergeRules3Way 三方合并核心场景 ----
{
  const merge3 = new Function(
    extractFn(src, 'stripRuleComment') + '\n' + extractFn(src, 'getRuleKey') + '\n' + extractFn(src, 'mergeRules3Way') + '\nreturn mergeRules3Way;'
  )();
  const res1 = merge3(['*://r1.com/*', '*://r2.com/*'], ['*://r1.com/*'], ['*://r1.com/*', '*://r2.com/*', '*://r3.com/*']);
  assert('同步-052: 本地删除生效且云端新增保留', res1.includes('*://r1.com/*') && !res1.includes('*://r2.com/*') && res1.includes('*://r3.com/*'));
  const res2 = merge3(['*://r1.com/*', '*://r2.com/*'], ['*://r1.com/*', '*://r2.com/*', '*://r4.com/*'], ['*://r2.com/*']);
  assert('同步-053: 云端删除生效且本地新增保留', !res2.includes('*://r1.com/*') && res2.includes('*://r2.com/*') && res2.includes('*://r4.com/*'));
  const res5 = merge3(['# 广告', 'ad.com', '# 购物', 'shop.com'], ['# 购物', 'shop.com', '# 广告', 'ad.com'], ['# 广告', 'ad.com', '# 购物', 'shop.com', 'new.com']);
  assert('同步-054: 本地重排后云端新增仍落在原锚点之后', JSON.stringify(res5) === JSON.stringify(['# 购物', 'shop.com', '# 广告', 'ad.com', 'new.com']));
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
  assert('同步-056: 双方独有选择器都保留', !!r1.localOnly && !!r1.cloudOnly);
  const r2 = merge(base, local, { bing: cloud.bing, cloudOnly: cloud.cloudOnly });
  assert('同步-057: 云端删除的选择器传播删除', !r2.yahoo);
  const b1 = { bing: { containers: '.old' } };
  assert('同步-058: 本地删除+云端修改且本地规则时间较新时删除赢', merge(b1, {}, { bing: { containers: '.new-cloud' } }, true).bing === undefined);
  assert('同步-059: 本地删除+云端修改且云端规则时间较新时修改保留', merge(b1, {}, { bing: { containers: '.new-cloud' } }, false).bing.containers === '.new-cloud');
  assert('同步-060: 云端删除+本地修改且本地规则时间较新时修改保留', merge(b1, { bing: { containers: '.new-local' } }, {}, true).bing.containers === '.new-local');
  assert('同步-061: 云端删除+本地修改且云端规则时间较新时删除赢', merge(b1, { bing: { containers: '.new-local' } }, {}, false).bing === undefined);
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
  assert('同步-063: 本地规则保留且启用状态按云端仲裁', out[0].rules[0] === 'k1' && out[0].enabled === false);
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

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
})();
