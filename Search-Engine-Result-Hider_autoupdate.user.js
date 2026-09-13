// ==UserScript==
// @name         搜索引擎结果屏蔽器
// @name:zh-CN   搜索引擎结果屏蔽器
// @name:en      Search Engine Result Hider
// @namespace    https://github.com/SadYuyuko
// @version      8.2.2
// @description        支持正则的搜索结果屏蔽工具。
// @description:zh-CN  支持正则的搜索结果屏蔽工具。
// @description:en     A search result blocking tool that supports regular expressions.
// @icon         data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjQgNCAxNiAxNiIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjMmM1MjgyIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgc3R5bGU9Im92ZXJmbG93OnZpc2libGUhaW1wb3J0YW50OyI+PGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iNyI+PC9jaXJjbGU+PGxpbmUgeDE9IjcuNDUiIHkxPSI3LjQ1IiB4Mj0iMTYuNTUiIHkyPSIxNi41NSI+PC9saW5lPjwvc3ZnPg==
// @author       南雪莲
// @homepageURL  https://greasyfork.org/zh-CN/scripts/552394
// @homepageURL  https://github.com/SadYuyuko/Search-Engine-Result-Hider
// @license       GPL-3.0
// @match        *://*/*
// @connect      *
// @connect      raw.githubusercontent.com
// @connect      dav.jianguoyun.com
// @noframes
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// @downloadURL  https://raw.githubusercontent.com/SadYuyuko/Search-Engine-Result-Hider/main/Search-Engine-Result-Hider_autoupdate.user.js
// @updateURL    https://raw.githubusercontent.com/SadYuyuko/Search-Engine-Result-Hider/main/Search-Engine-Result-Hider_autoupdate.user.js
// ==/UserScript==

(function() {
  'use strict';

  // 顶层页面运行
  if (window.top !== window.self) return;

  let preventPanelClose = false;
  let yandexParentTimeouts = new Set();
  let _engineSiteSetup = false;
  let _domObserver = null;
  let _observedSelector = '';
  let _searchForm = null;
  let _searchFormHandler = null;
  let _urlChangeHandler = null;
  let _syncIntervalIds = [];
  let _syncInitialTimeout = null;

  // 配置存储键
  const CONFIG_KEY = 'searchfilter_blocker';
  const WEBDAV_KEY = 'searchfilter_webdav';
  const SUBSCRIPTION_URL_KEY = 'searchfilter_subscription_url';
  const SUBSCRIPTION_LAST_UPDATE_KEY = 'searchfilter_subscription_last_update';
  const SUBSCRIPTION_RULES_KEY = 'searchfilter_subscription_rules';
  const SUBSCRIPTIONS_KEY = 'searchfilter_subscriptions';
  const WEBDAV_LAST_SYNC_KEY = 'searchfilter_webdav_last_sync';
  const LOCAL_LAST_MODIFIED_KEY = 'searchfilter_local_last_modified';
  const WEBDAV_AUTO_SYNC_KEY = 'searchfilter_webdav_auto_sync';
  const WEBDAV_SYNC_CONFIG_KEY = 'searchfilter_webdav_sync_config';
  const WEBDAV_SYNC_SELECTORS_KEY = 'searchfilter_webdav_sync_selectors';
  const SELECTORS_KEY = 'searchfilter_selectors';
  const HL_STATS_REGEX = /^@\d+/;
  const MAX_SUBSCRIPTIONS = 100;
  const AUTO_UPDATE_INTERVAL = 12 * 60 * 60 * 1000;

  // 默认配置
  let currentConfig = GM_getValue(CONFIG_KEY, {
    rules: ['*://*.example.com/*'],
    enabled: true,
    showCount: false,
    bubbleSize: 30,
    debug: false,
    showBlockBtn: false,
    blockDomain: false,
    blockConfirm: true,
    showBubble: true,
    bubbleState: null,
    panelCentered: true,
    bubbleAction: 'openPanel',
    language: 'zh-CN',
    highlightColors: {1:'#CE2029', 2:'#FF8C00', 3:'#FFD700', 4:'#228B22', 5:'#1E90FF'},
    subscriptionAutoUpdate: false,
    errorDetection: true
  });

  // 兼容旧配置
  if (currentConfig.showBlockBtn === undefined) currentConfig.showBlockBtn = false;
  if (currentConfig.blockDomain === undefined) currentConfig.blockDomain = false;
  if (currentConfig.blockConfirm === undefined) currentConfig.blockConfirm = true;
  if (currentConfig.showBubble === undefined) currentConfig.showBubble = true;
  if (currentConfig.panelCentered === undefined) currentConfig.panelCentered = true;
  if (currentConfig.bubbleAction === undefined) currentConfig.bubbleAction = 'openPanel';
  if (currentConfig.language === undefined) currentConfig.language = 'zh-CN';
  const DEFAULT_HIGHLIGHT_COLORS = {1:'#CE2029', 2:'#FF8C00', 3:'#FFD700', 4:'#228B22', 5:'#1E90FF'};
  if (!currentConfig.highlightColors || typeof currentConfig.highlightColors !== 'object') {
    currentConfig.highlightColors = {...DEFAULT_HIGHLIGHT_COLORS};
  } else {
    currentConfig.highlightColors = Object.assign({}, DEFAULT_HIGHLIGHT_COLORS, currentConfig.highlightColors);
  }
  if (currentConfig.subscriptionAutoUpdate === undefined) currentConfig.subscriptionAutoUpdate = false;
  if (currentConfig.errorDetection === undefined) currentConfig.errorDetection = true;
  let showHiddenResults = false;

  // 选择器
  const SELECTORS = {
    bing: {
      match: /^(?:(?:www|cn|www2|global|m)\.)?bing\.(?:com|[a-z]{2,3}(?:\.[a-z]{2})?)$/,
      containers: 'li.b_algo, div.b_algo',
      titles: ['h2 a', 'a h2', '.b_title'],
      snippets: ['.b_caption p', '.b_snippet', '.b_paractl p', '.b_lineclamp2'],
      links: 'a[href]',
    },
    google_scholar: {
      match: /^(?:www\.)?scholar\.google\.(?:[a-z]{2,3}(?:\.[a-z]{2})?|[a-z]{4,})$/,
      containers: 'div.gs_r.gs_or.gs_scl',
      titles: ['h3.gs_rt a', 'h3.gs_rt', '.gs_rt'],
      snippets: ['.gs_rs'],
      links: ['h3.gs_rt a[href]', 'a[href]'],
    },
    google: {
      match: /^(?:(?:www|images|video|videos|search|encrypted|m)\.)?google\.(?:[a-z]{2,3}(?:\.[a-z]{2})?|[a-z]{4,})$/,
      containers: 'div.g, div.MjjYud',
      titles: ['h3', 'div[role="heading"]', '.LC20lb', '.DKV0Md', '.sXLaOe', '.c9DxTc', 'a h3'],
      snippets: ['.st', '.VwiC3b', '.s3v9rd', '.IsZvec', '.lyLwlc', '.yXK7lf'],
      links: 'a[href]',
    },
    duckduckgo: {
      match: /^(?:(?:www|html|start|lite|m|safe)\.)?(?:duckduckgo\.com|ddg\.gg)$/,
      containers: '[data-testid="result"], .result, .web-result, .tile, .tile--ad',
      titles: ['a[data-testid="result-title-a"]', '.result__title', '.tile__title', '.tile--title__title', 'h2 a', 'a h2'],
      snippets: ['[data-testid="result-snippet"]', '[data-result="snippet"]', '.result__snippet'],
      links: ['a[data-testid="result-extras-url-link"]', 'a[data-testid="result-title-a"]', '.result__url', '.tile--title__domain', 'a[href]'],
    },
    yandex: {
      match: /^(?:www\.)?(?:ya\.ru|yandex\.(?:[a-z]{2,3}(?:\.[a-z]{2})?|[a-z]{4,}))$/,
      containers: 'div.Organic',
      titles: ['.OrganicTitle'],
      snippets: ['.OrganicText'],
      links: ['.OrganicTitle a', '.Path-Item a', 'a.Link', 'a[href]'],
    },
    brave: {
      match: /^search\.brave\.com$/,
      containers: '.snippet[data-type="web"], .snippet[data-type="news"], .snippet[data-type="videos"], .image-wrapper',
      titles: ['.title', '.snippet-title', '.img-title'],
      snippets: ['.generic-snippet .content', '.generic-snippet', '.line-clamp-dynamic', '.snippet-description', '.description'],
      links: ['a[href]'],
    },
    yahoo: {
      match: /^(?:[a-z]{2,6}\.)?(?:(?:images|video|videos|news)\.)?(?:r\.)?search\.yahoo\.(?:com|[a-z]{2,3}(?:\.[a-z]{2})?)$/,
      containers: '.sw-Card.Algo, li.b_algo, div.b_algo, #web .algo, .algo-sr, .richAlgo',
      titles: ['h3', '.s-title', 'h2 a', 'a h2', '.b_title', '.title'],
      snippets: ['.sw-Card__description', '.sw-Card__snippet', '.sw-Text__body', 'p', '.b_caption p', '.b_snippet', '.b_paractl p'],
      links: ['h3 a', '.s-title', '.sw-Card__title a', 'a[data-ylk*="slk:title"]', 'a.ac-algo', 'a[data-y-link-id]'],
    },
    other: {
      containers: '',
      titles: [],
      snippets: [],
      links: 'a[href]',
    }
  };

  // 自定义选择器
  let activeSelectors = null;
  let _selectorStoreSignature = null;

  function normalizeSelectorList(value) {
    if (Array.isArray(value)) return value.filter(s => typeof s === 'string' && s);
    if (typeof value === 'string' && value) return [value];
    return [];
  }

  function getUserSelectors() {
    const raw = GM_getValue(SELECTORS_KEY);
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    return raw;
  }

  function getSelectors() {
    if (activeSelectors) return activeSelectors;
    const merged = {};
    const user = getUserSelectors();
    const userKeys = Object.keys(user).filter(k => k !== 'other');
    for (const key of userKeys) {
      const def = user[key];
      if (!def || typeof def !== 'object' || Array.isArray(def)) continue;
      if (def.disabled || def.disable) {
        merged[key] = { disabled: true };
        continue;
      }
      const defContentKeys = Object.keys(def).filter(k => k !== 'disabled' && k !== 'disable' && def[k] !== undefined && def[k] !== null && def[k] !== '');
      if (!defContentKeys.length) {
        if (SELECTORS[key]) merged[key] = SELECTORS[key];
        continue;
      }
      let match = null;
      try {
        if (typeof def.match === 'string' && def.match) {
          match = new RegExp(def.match);
        } else if (def.match && typeof def.match === 'object' && typeof def.match.source === 'string' && def.match.source) {
          match = new RegExp(def.match.source, String(def.match.flags || '').toLowerCase().replace(/[^imsu]/g, ''));
        }
      } catch (e) { match = null; }
      merged[key] = {
        match,
        containers: typeof def.containers === 'string' ? def.containers : '',
        titles: normalizeSelectorList(def.titles),
        snippets: normalizeSelectorList(def.snippets),
        links: Array.isArray(def.links) ? normalizeSelectorList(def.links)
          : (typeof def.links === 'string' && def.links ? def.links : 'a[href]'),
      };
    }
    for (const key of Object.keys(SELECTORS)) {
      if (!(key in merged)) merged[key] = SELECTORS[key];
    }
    const keys = Object.keys(merged);
    const gIdx = keys.indexOf('google');
    const gsIdx = keys.indexOf('google_scholar');
    if (gIdx !== -1 && gsIdx !== -1 && gIdx < gsIdx) {
      const fixed = {};
      for (const k of keys) {
        if (k === 'google') {
          fixed['google_scholar'] = merged['google_scholar'];
          fixed['google'] = merged['google'];
        } else if (k !== 'google_scholar') {
          fixed[k] = merged[k];
        }
      }
      activeSelectors = fixed;
      return fixed;
    }
    activeSelectors = merged;
    return merged;
  }

  function resetSelectorCache() {
    activeSelectors = null;
    _engineCacheHost = null;
    _engineCacheResult = 'other';
    _observedSelector = '';
  }

  // 引擎检测
  let _engineCacheHost = null;
  let _engineCacheResult = 'other';
  function getSearchEngine() {
    const loc = window.location || {};
    const hostname = String(loc.hostname || '');
    const href = String(loc.href || '');
    const cacheKey = href || hostname;
    if (_engineCacheHost === cacheKey) return _engineCacheResult;
    _engineCacheHost = cacheKey;
    const defs = getSelectors();
    for (const name of Object.keys(defs)) {
      const def = defs[name];
      if (!def || def.disabled || !def.match) continue;
      if (def.match.test(hostname)) return (_engineCacheResult = name);
      if (def !== SELECTORS[name] && href && def.match.source.includes('/') && def.match.test(href)) {
        return (_engineCacheResult = name);
      }
    }
    return (_engineCacheResult = 'other');
  }

  function getSearchCategory(loc) {
    loc = loc || window.location;
    if (!loc) return 'web';
    let path = String(loc.pathname || '').toLowerCase();
    let search = String(loc.search || '').toLowerCase();
    const host = String(loc.hostname || '').toLowerCase();
    if ((!path || !search) && loc.href) {
      try {
        const u = new URL(loc.href);
        if (!path) path = u.pathname.toLowerCase();
        if (!search) search = u.search.toLowerCase();
      } catch (e) { /* ignore */ }
    }
    if (/^images\./.test(host) || /(?:^|\/)images(?:\/|$)/.test(path) || /[?&](?:tbm=isch|udm=2|iax?=images)(?:&|$)/.test(search)) return 'images';
    if (/^videos?\./.test(host) || /(?:^|\/)videos?(?:\/|$)/.test(path) || /[?&](?:tbm=vid|udm=7|iax?=videos)(?:&|$)/.test(search)) return 'videos';
    if (/^news\./.test(host) || /(?:^|\/)news(?:\/|$)/.test(path) || /[?&](?:tbm=nws|udm=12|iax?=news)(?:&|$)/.test(search)) return 'news';
    return 'web';
  }

  function getContainerSelector(engine) {
    return (getSelectors()[engine] || SELECTORS.other).containers;
  }

  // 判断引擎站点
  function isEngineSite() {
    return getSearchEngine() !== 'other';
  }

  // 文本映射
  const LANG_TEXTS = {
    'zh-CN': {
      enableBlock: '启用屏蔽',
      showCount: '显示数量',
      debugMode: '调试模式',
      oneClickBlock: '一键屏蔽',
      blockDomain: '屏蔽域名',
      doubleConfirm: '二次确认',
      bubbleSize: '悬浮球大小:',
      blockRules: '屏蔽规则:',
      sync: '同步',
      import: '导入',
      export: '导出',
      save: '保存',
      stats: '统计',
      close: '关闭',
      cancel: '取消',
      placeholder: '每行一个规则',
      panelTitle: '订阅管理',
      addSubscription: '添加订阅',
      webdavTitle: 'WebDAV',
      webdavUrl: '地址',
      webdavUser: '账号',
      webdavPass: '密码',
      filename: '文件名',
      upload: '上传',
      download: '下载',
      matchedRule: '规则',
      localRule: '本地规则',
      subscription: '订阅',
      urlRule: 'URL规则',
      titleRule: '标题规则',
      textRule: '正文规则',
      regexRule: '正则规则',
      statsCompound: '复合规则',
      noMatch: '无匹配项',
      whitelistRules: '白名单规则',
      menuOpenPanel: '⚙️ 打开配置面板',
      menuEnable: '屏蔽功能',
      menuErrorDetection: '错误检测',
      menuCenter: '面板居中',
      menuBubble: '悬浮球状态',
      menuBubbleAction: '悬浮球功能',
      menuLang: 'Language: 中文',
      menuLangEn: 'Language: English',
      subscriptionSuccess: '订阅成功！已更新 {count} 条规则。',
      saved: '已保存',
      importDone: '导入操作完成',
      uploadSuccess: '上传成功！',
      downloadSuccess: '下载成功！规则已加载到编辑区，保存生效',
      noRulesExport: '没有规则可导出',
      confirmBlock: '确定要屏蔽并添加规则 [ {rule} ] 吗？',
      bcDomain: '域名',
      bcExact: '精确',
      bcWhitelist: '白名单',
      bcDelete: '删除',
      bcDeleteSub: '订阅规则无法删除',
      bcConfirm: '确认',
      cannotBlockCurrentSite: '无法屏蔽当前搜索引擎自身域名: {domain}',
      statsErrors: '发现 {count} 个规则错误: ',
      matchedCountLabel: '匹配',
      matchedCountUnit: '条',
      menuBubbleStateShow: '显示',
      menuBubbleStateHide: '隐藏',
      menuBubbleActionOpen: '打开面板',
      menuBubbleActionToggle: '显示隐藏结果',
      stateEnabled: '启用',
      stateDisabled: '关闭',
      subLinkEmpty: '链接为空',
      subImportSuccess: '导入成功',
      subImportFailed: '导入失败，请检查链接或网络状态',
      maxSubscriptions: '最多只能添加100条订阅',
      webdavUploading: '正在上传...',
      webdavDownloading: '正在下载...',
      webdavUploadFailed: '上传失败: ',
      webdavDownloadFailed: '下载失败: ',
      webdavHttpsRequired: '安全起见，WebDAV地址必须使用https',
      networkError: '网络错误',
      requestTimeout: '请求超时',
      subLinkInvalid: '链接错误',
      importing: '导入中',
      autoSync: '自动同步',
      syncScriptConfig: '同步配置',
      webdavUrlEmpty: 'WebDAV地址为空',
      highlightRules: '高亮规则',
      menuHighlightColor: '🎨 高亮颜色设置',
      hlColorTitle: '高亮颜色设置',
      hlColorReset: '重置',
      autoUpdate: '自动更新',
      errorWord: '错误',
      warningWord: '警告',
      statsWarnings: '发现 {count} 个规则警告: ',
      duplicateRules: '重复规则',
      invalidRule: '规则无效',
      hlColorError: '高亮级别需在 1-5 之间',
      hlWhitelistConflict: '高亮规则不能与白名单组合',
      ifParenError: '@if(...) 括号未闭合',
      condRegexError: '条件正则无效: {part}',
      regexError: '正则表达式无效',
      urlError: 'URL规则无效',
      ruleDuplicate: '重复了 {count} 次',
      emptyPrefixRule: '规则前缀后缺少内容',
      invalidRegexFlags: '正则 flags 无效: {flags}',
      emptyIfCondition: '@if() 条件不能为空',
      unknownIfCondition: '未知 @if 条件: {part}',
      condExprError: '@if 表达式语法错误: {part}',
      invalidUrlWildcard: 'URL 通配符格式无效: {rule}',
      menuCustomSelectors: '🖋️ 自定义选择器',
      selectorPanelTitle: '选择器',
      selectorHint: '如果不知道有什么用，请勿修改。',
      selectorJsonError: '解析失败，请检查格式',
      selectorReservedKey: '保留键不可使用: {key}',
      selectorInvalidKey: '引擎ID仅允许字母/数字/_/-: {key}',
      selectorInvalidRegex: 'match 正则无效: {key}',
      selectorInvalidCss: 'CSS 选择器无效: {key}.{field}: {value}',
      selectorFieldRequired: '字段必填: {key}.{field}',
    },
    'en': {
      enableBlock: 'Block',
      showCount: 'Count',
      debugMode: 'Debug',
      oneClickBlock: 'Button',
      blockDomain: 'Domain',
      doubleConfirm: 'Confirm',
      bubbleSize: 'Bubble Size:',
      blockRules: 'Block Rules:',
      sync: 'Sync',
      import: 'Import',
      export: 'Export',
      save: 'Save',
      stats: 'Stats',
      close: 'Close',
      cancel: 'Cancel',
      placeholder: 'One rule per line',
      panelTitle: 'Subscription Manager',
      addSubscription: 'Add Subscription',
      webdavTitle: 'WebDAV',
      webdavUrl: 'URL',
      webdavUser: 'Username',
      webdavPass: 'Password',
      filename: 'Filename',
      upload: 'Upload',
      download: 'Download',
      matchedRule: 'Rule',
      localRule: 'Local Rule',
      subscription: 'Sub',
      urlRule: 'URL Rule',
      titleRule: 'Title Rule',
      textRule: 'Text Rule',
      regexRule: 'Regex Rule',
      statsCompound: 'Compound Rule',
      noMatch: 'No matches',
      whitelistRules: 'Whitelist Rules',
      menuOpenPanel: '⚙️ Open Panel',
      menuEnable: 'Block',
      menuErrorDetection: 'Error Detection',
      menuCenter: 'Center Panel',
      menuBubble: 'Bubble',
      menuBubbleAction: 'Bubble Action',
      menuLang: 'Language: 中文',
      menuLangEn: 'Language: English',
      subscriptionSuccess: 'Subscription successful! Updated {count} rules.',
      saved: 'Saved',
      importDone: 'Import completed',
      uploadSuccess: 'Upload successful!',
      downloadSuccess: 'Download successful! Rules loaded into editor, save to apply.',
      noRulesExport: 'No rules to export',
      confirmBlock: 'Add block rule [ {rule} ] ?',
      bcDomain: 'Domain',
      bcExact: 'Exact',
      bcWhitelist: 'Whitelist',
      bcDelete: 'Delete',
      bcDeleteSub: 'Subscription rules cannot be deleted',
      bcConfirm: 'Confirm',
      cannotBlockCurrentSite: 'Cannot block search engine own domain: {domain}',
      statsErrors: 'Found {count} rule errors:',
      matchedCountLabel: 'Hits',
      matchedCountUnit: 'Rule',
      menuBubbleStateShow: 'Show',
      menuBubbleStateHide: 'Hide',
      menuBubbleActionOpen: 'Open Panel',
      menuBubbleActionToggle: 'Toggle Results',
      stateEnabled: 'Enabled',
      stateDisabled: 'Disabled',
      subLinkEmpty: 'URL is empty',
      subImportSuccess: 'Import success',
      subImportFailed: 'Import failed, check URL or network',
      maxSubscriptions: 'Maximum 100 subscriptions allowed',
      webdavUploading: 'Uploading...',
      webdavDownloading: 'Downloading...',
      webdavUploadFailed: 'Upload failed: ',
      webdavDownloadFailed: 'Download failed: ',
      webdavHttpsRequired: 'For security, WebDAV server must use HTTPS',
      networkError: 'Network error',
      requestTimeout: 'Request timeout',
      subLinkInvalid: 'Invalid URL',
      importing: 'Importing',
      autoSync: 'Auto Sync',
      syncScriptConfig: 'Sync Config',
      webdavUrlEmpty: 'WebDAV URL is empty',
      highlightRules: 'Highlight Rules',
      menuHighlightColor: '🎨 Highlight Colors',
      hlColorTitle: 'Highlight Color Settings',
      hlColorReset: 'Reset',
      autoUpdate: 'Auto Update',
      errorWord: 'Error',
      warningWord: 'Warning',
      statsWarnings: 'Found {count} rule warnings: ',
      duplicateRules: 'Duplicate Rules',
      invalidRule: 'Invalid rule',
      hlColorError: 'Highlight level must be 1-5',
      hlWhitelistConflict: 'Highlight rules cannot be combined with whitelist',
      ifParenError: 'Unbalanced @if(...) parentheses',
      condRegexError: 'Invalid condition regex: {part}',
      regexError: 'Invalid regex',
      urlError: 'Invalid URL rule',
      ruleDuplicate: 'duplicated {count} times',
      emptyPrefixRule: 'Missing content after rule prefix',
      invalidRegexFlags: 'Invalid regular expression flags: {flags}',
      emptyIfCondition: '@if() condition cannot be empty',
      unknownIfCondition: 'Unknown @if condition: {part}',
      condExprError: 'Syntax error in @if expression: {part}',
      invalidUrlWildcard: 'Invalid URL wildcard format: {rule}',
      menuCustomSelectors: '🖋️ Custom Selectors',
      selectorPanelTitle: 'Selectors',
      selectorHint: 'If you don\'t know what it is for, do not modify it.',
      selectorJsonError: 'Failed to parse, check the format',
      selectorReservedKey: 'Reserved key not allowed: {key}',
      selectorInvalidKey: 'Engine id allows letters/digits/_/- only: {key}',
      selectorInvalidRegex: 'Invalid match regex: {key}',
      selectorInvalidCss: 'Invalid CSS selector: {key}.{field}: {value}',
      selectorFieldRequired: 'Required field: {key}.{field}',
    }
  };

  // Map
  let compiledRules = {
    domains: new Map(),
    urls: [],
    titles: [],
    texts: [],
    whitelistDomains: new Map(),
    whitelistUrlPatterns: [],
    whitelistTitlePatterns: [],
    whitelistTextPatterns: [],
    conditionalRules: [],
    conditionalDomains: new Map(),
    highlightDomains: new Map(),
    highlightUrls: [],
    highlightTitles: [],
    highlightTexts: [],
    highlightConditionalRules: [],
    highlightConditionalDomains: new Map()
  };

  const validationCache = new Map();
  const subdomainCache = new Map();
  let cachedSubscriptionRules = null;
  let _lineDebounceTimer = null;
  let forceReprocessBatchId = 0;

  // 语言
  function t(key, params = {}) {
    const lang = currentConfig.language;
    const texts = LANG_TEXTS[lang] || LANG_TEXTS['zh-CN'];
    let text = texts[key] || key;
    for (const [k, v] of Object.entries(params)) {
      text = text.replaceAll(`{${k}}`, v);
    }
    return text;
  }

  function hostLabelToASCII(label) {
    const s = String(label || '');
    if (!s || s === '*' || /^[a-z0-9_-]*$/i.test(s)) return s;
    try {
      const ascii = new URL('http://' + s + '.invalid').hostname;
      if (ascii.toLowerCase().endsWith('.invalid')) return ascii.slice(0, -8);
    } catch (e) {}
    return s;
  }

  function toASCIIHostname(host) {
    const raw = String(host || '').replace(/\.$/, '').trim().toLowerCase();
    if (!raw) return '';
    if (/^[\x00-\x7F]*$/.test(raw)) return raw;
    return raw.split('.').map(label => label ? hostLabelToASCII(label) : label).join('.');
  }

  function toASCIIUrl(url) {
    const raw = String(url || '');
    if (!raw || /^[\x00-\x7F]*$/.test(raw)) return raw;
    try {
      const abs = raw.startsWith('//') ? 'http:' + raw : raw;
      const u = new URL(abs);
      const asciiHost = toASCIIHostname(u.hostname);
      if (asciiHost && asciiHost !== u.hostname) u.hostname = asciiHost;
      return raw.startsWith('//') ? u.href.replace(/^https?:/i, '') : u.href;
    } catch (e) {
      return raw;
    }
  }

  function safeRegexTest(regex, value) {
    if (!regex) return false;
    regex.lastIndex = 0;
    const matched = regex.test(String(value ?? ''));
    regex.lastIndex = 0;
    return matched;
  }

  function safeDecodeURIComponent(str) {
    try {
      return decodeURIComponent(String(str ?? ''));
    } catch (e) {
      return String(str ?? '');
    }
  }

  // 规则处理
  function filterValidRuleLines(lines) {
    return lines
      .map(line => line.trim())
      .filter(line => line.length > 0);
  }

  // 剥离行尾注释
  function stripRuleComment(line) {
    const n = line.length;
    let i = 0;
    while (i < n && /\s/.test(line[i])) i++;
    if (line[i] === '@') {
      i++;
      while (i < n && /\d/.test(line[i])) i++;
      while (i < n && /\s/.test(line[i])) i++;
    }
    const body = line.slice(i);
    const prefixRegexMatch = body.match(/^(?:title|text|host|path|url|scheme)\/(?:[^/\\]|\\.)*\//i);
    let inRE = false;
    if (/^\/(?:[^/\\]|\\.)*\//.test(body)) {
      i += 1;
      inRE = true;
    } else if (prefixRegexMatch) {
      const prefix = body.match(/^(?:title|text|host|path|url|scheme)\//i)[0];
      i += prefix.length;
      inRE = true;
    }
    let inReClass = false;
    let inSQ = false;
    let inDQ = false;
    let ifDepth = 0;
    let atIf = false;
    for (; i < n; i++) {
      const ch = line[i];
      if (inSQ) {
        if (ch === '\\') i++;
        else if (ch === "'") inSQ = false;
        continue;
      }
      if (inDQ) {
        if (ch === '\\') i++;
        else if (ch === '"') inDQ = false;
        continue;
      }
      if (inRE) {
        if (ch === '\\') { i++; continue; }
        if (inReClass) {
          if (ch === ']') inReClass = false;
          continue;
        }
        if (ch === '[') { inReClass = true; continue; }
        if (ch === '/') inRE = false;
        continue;
      }
      if (atIf) {
        if (ch === '(') { ifDepth = 1; atIf = false; continue; }
        if (!/\s/.test(ch)) atIf = false;
        continue;
      }
      if (ch === "'") { inSQ = true; continue; }
      if (ch === '"') { inDQ = true; continue; }
      if (ch === '/' && !inRE) {
        const prev = line.slice(0, i).trimEnd();
        if (/(?:=~|~)$/.test(prev) || (/(?:^|[\s(&|!])(?:title|url|host|path|scheme)$/i.test(prev) && !prev.includes('://'))) {
          inRE = true;
          continue;
        }
      }
      if (ch === '@' && line.substr(i, 3).toLowerCase() === '@if') { atIf = true; i += 2; continue; }
      if (ch === '(' && ifDepth > 0) { ifDepth++; continue; }
      if (ch === ')' && ifDepth > 0) { ifDepth--; continue; }
      if (ch === '#') {
        if (ifDepth === 0) {
          const prev = line[i - 1];
          if (prev === undefined || /\s/.test(prev)) {
            let end = i;
            while (end > 0 && /\s/.test(line[end - 1])) end--;
            return line.slice(0, end);
          }
        }
      }
    }
    return line;
  }

  // 条件表达式
  function tokenizeCondExpr(str) {
    const tokens = [];
    let leaf = '';
    let i = 0;
    const n = str.length;
    let inSQ = false;
    let inDQ = false;
    let inRE = false;
    let inReClass = false;
    let leafParens = 0;

    const flushLeaf = () => {
      const s = leaf.trim();
      if (s) tokens.push(s);
      leaf = '';
    };
    const pushChar = (ch) => { leaf += ch; };
    const canStartRegex = () => {
      const s = leaf.trim();
      return s === '' || /(?:=~|~)$/.test(s) || /^(url|title|host|path|scheme)$/i.test(s);
    };

    while (i < n) {
      const ch = str[i];

      if (inSQ) {
        if (ch === '\\') { pushChar(ch); if (i + 1 < n) pushChar(str[i + 1]); i += 2; continue; }
        pushChar(ch);
        if (ch === "'") inSQ = false;
        i++;
        continue;
      }
      if (inDQ) {
        if (ch === '\\') { pushChar(ch); if (i + 1 < n) pushChar(str[i + 1]); i += 2; continue; }
        pushChar(ch);
        if (ch === '"') inDQ = false;
        i++;
        continue;
      }
      if (inRE) {
        if (ch === '\\') { pushChar(ch); if (i + 1 < n) pushChar(str[i + 1]); i += 2; continue; }
        if (inReClass) {
          pushChar(ch);
          if (ch === ']') inReClass = false;
          i++;
          continue;
        }
        if (ch === '[') { inReClass = true; pushChar(ch); i++; continue; }
        pushChar(ch);
        if (ch === '/') inRE = false;
        i++;
        continue;
      }

      if (ch === "'") { inSQ = true; pushChar(ch); i++; continue; }
      if (ch === '"') { inDQ = true; pushChar(ch); i++; continue; }
      if (ch === '\\') { pushChar(ch); if (i + 1 < n) pushChar(str[i + 1]); i += 2; continue; }
      if (ch === '/') {
        if (canStartRegex()) { inRE = true; pushChar(ch); i++; continue; }
        pushChar(ch); i++; continue;
      }

      if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') { pushChar(ch); i++; continue; }

      if (ch === '&' || ch === '|') {
        if (leafParens === 0) {
          flushLeaf();
          tokens.push(ch);
          i++;
          continue;
        }
        pushChar(ch);
        i++;
        continue;
      }

      if (ch === '!') {
        if (leaf.trim() === '' && leafParens === 0) {
          flushLeaf();
          tokens.push('!');
          i++;
          continue;
        }
        pushChar(ch); i++; continue;
      }

      if (ch === '(') {
        if (leaf.trim() === '' && leafParens === 0) {
          flushLeaf();
          tokens.push('(');
          i++;
          continue;
        }
        leafParens++;
        pushChar(ch); i++;
        continue;
      }

      if (ch === ')') {
        if (leafParens > 0) {
          leafParens--;
          pushChar(ch);
          i++;
          continue;
        }
        flushLeaf();
        tokens.push(')');
        i++;
        continue;
      }

      pushChar(ch);
      i++;
    }

    flushLeaf();
    if (inSQ || inDQ || inRE || leafParens !== 0) return { error: true, tokens };
    return { error: false, tokens };
  }

  // 递归下降解析
  function parseCondExprTokens(tokens, leafParser, errors) {
    let pos = 0;
    const peek = () => tokens[pos];
    const next = () => tokens[pos++];
    const syntaxError = () => {
      errors.push({ kind: 'syntax' });
      return { type: 'const', value: false };
    };

    function parseOr() {
      const children = [parseAnd()];
      while (peek() === '|') { next(); children.push(parseAnd()); }
      return children.length === 1 ? children[0] : { type: 'or', children };
    }
    function parseAnd() {
      const children = [parseNot()];
      while (peek() === '&') { next(); children.push(parseNot()); }
      return children.length === 1 ? children[0] : { type: 'and', children };
    }
    function parseNot() {
      if (peek() === '!') { next(); return { type: 'not', child: parseNot() }; }
      return parsePrimary();
    }
    function parsePrimary() {
      const t = peek();
      if (t === undefined) return syntaxError();
      if (t === '(') {
        next();
        const inner = parseOr();
        if (peek() !== ')') return syntaxError();
        next();
        return inner;
      }
      if (t === ')' || t === '&' || t === '|' || t === '!') { next(); return syntaxError(); }
      next();
      return leafParser(t);
    }

    const ast = parseOr();
    if (peek() !== undefined) return syntaxError();
    return ast;
  }

  // 分析@if条件
  function analyzeCondExpr(condStr, engine, site, category) {
    if (engine === undefined) {
      engine = getSearchEngine();
      site = window.location.hostname;
      if (category === undefined) category = getSearchCategory();
    }
    if (category === undefined) category = 'web';
    const errors = [];
    const tokRes = tokenizeCondExpr(condStr);
    if (tokRes.error || !tokRes.tokens.length) return { ast: null, errors: [{ kind: 'syntax' }] };
    const leafParser = (text) => {
      const trimmed = text.trim();
      const regexLeafFlags = (() => {
        const m = trimmed.match(/^(?:title|url|host|path|scheme)\s*(?:=\~\s*)?\/((?:[^/\\\[]|\\.|\[(?:[^\]\\]|\\.)*\])*)\/([a-z]*)$/i);
        return m ? m[2] : null;
      })();
      if (regexLeafFlags !== null && getInvalidRegexFlags(regexLeafFlags)) {
        errors.push({ kind: 'flags', part: regexLeafFlags });
        return { type: 'const', value: false };
      }
      try {
        const parsed = parseConditionPart(trimmed, engine, site, category);
        if (!parsed.matched) {
          errors.push({ kind: 'unknown', part: trimmed });
          return { type: 'const', value: false };
        }
        if (parsed.static !== undefined) return { type: 'const', value: parsed.static };
        return { type: 'leaf', cond: parsed.dynamic };
      } catch (e) {
        errors.push({ kind: 'regex', part: trimmed });
        return { type: 'const', value: false };
      }
    };
    const ast = parseCondExprTokens(tokRes.tokens, leafParser, errors);
    return { ast, errors };
  }

  // 常量折叠
  function foldCondExpr(node) {
    if (node.type === 'const' || node.type === 'leaf') return node;
    if (node.type === 'not') {
      const child = foldCondExpr(node.child);
      if (child.type === 'const') return { type: 'const', value: !child.value };
      return { type: 'not', child };
    }
    const isAnd = node.type === 'and';
    const kids = node.children.map(foldCondExpr);
    if (isAnd && kids.some(k => k.type === 'const' && !k.value)) return { type: 'const', value: false };
    if (!isAnd && kids.some(k => k.type === 'const' && k.value)) return { type: 'const', value: true };
    const rest = kids.filter(k => k.type !== 'const');
    if (!rest.length) return { type: 'const', value: isAnd };
    return rest.length === 1 ? rest[0] : { type: isAnd ? 'and' : 'or', children: rest };
  }

  // 动态条件求值
  function evalDynamicLeaf(cond, title, url) {
    if (cond.type === 'title') {
      if (!title) return false;
      const lowerTitle = title.toLowerCase();
      if (cond.op === '=') return lowerTitle === cond.val;
      if (cond.op === '^=') return lowerTitle.startsWith(cond.val);
      if (cond.op === '$=') return lowerTitle.endsWith(cond.val);
      if (cond.op === '*=') return lowerTitle.includes(cond.val);
      if (cond.op === '=~') return safeRegexTest(cond.regex, title);
      return false;
    }
    if (cond.type === 'url') {
      if (!url) return false;
      const lowerUrl = url.toLowerCase();
      if (cond.op === '=') return lowerUrl === cond.val;
      if (cond.op === '^=') return lowerUrl.startsWith(cond.val);
      if (cond.op === '$=') return lowerUrl.endsWith(cond.val);
      if (cond.op === '*=') return lowerUrl.includes(cond.val);
      if (cond.op === '=~') return safeRegexTest(cond.regex, url);
      return false;
    }
    if (cond.type === 'host' || cond.type === 'path' || cond.type === 'scheme') {
      if (!url) return false;
      let u;
      try {
        const isAbsolute = /^[a-z][a-z0-9+.-]*:\/\//i.test(url) || url.startsWith('//');
        if (isAbsolute) {
          u = new URL(url.startsWith('//') ? 'http:' + url : url);
        } else {
          if (cond.type === 'scheme' || cond.type === 'host') {
            const m = url.match(/^([a-z][a-z0-9+.-]*):(?:\/\/)?/i);
            if (!m) return false;
          }
          u = new URL(url, 'http://localhost');
        }
      } catch (e) {
        return false;
      }
      const raw = cond.type === 'host' ? toASCIIHostname(u.hostname)
        : cond.type === 'path' ? (u.pathname + u.search)
        : u.protocol.slice(0, -1);
      const value = raw.toLowerCase();
      const cmpVal = cond.type === 'host' ? toASCIIHostname(cond.val) : cond.val;
      let altValue = value;
      let altCmpVal = cmpVal;
      if (cond.type === 'path') {
        altValue = safeDecodeURIComponent(raw).toLowerCase();
        altCmpVal = safeDecodeURIComponent(cmpVal);
      }
      if (cond.op === '=') return value === cmpVal || altValue === altCmpVal;
      if (cond.op === '^=') return value.startsWith(cmpVal) || altValue.startsWith(altCmpVal);
      if (cond.op === '$=') {
        if (cond.type === 'host') {
          const target = cmpVal.replace(/^\.+|\.+$/g, '');
          return value === target || value.endsWith(`.${target}`);
        }
        return value.endsWith(cmpVal) || altValue.endsWith(altCmpVal);
      }
      if (cond.op === '*=') return value.includes(cmpVal) || altValue.includes(altCmpVal);
      if (cond.op === '=~') {
        if (cond.type === 'host') {
          return safeRegexTest(cond.regex, raw) || safeRegexTest(cond.regex, u.hostname);
        }
        return safeRegexTest(cond.regex, raw) || safeRegexTest(cond.regex, altValue);
      }
      return false;
    }
    return false;
  }

  // 运行求值
  function evalCondAST(ast, title, url) {
    if (!ast) return true;
    if (ast.type === 'and') {
      for (let i = 0; i < ast.children.length; i++) {
        if (!evalCondAST(ast.children[i], title, url)) return false;
      }
      return true;
    }
    if (ast.type === 'or') {
      for (let i = 0; i < ast.children.length; i++) {
        if (evalCondAST(ast.children[i], title, url)) return true;
      }
      return false;
    }
    if (ast.type === 'not') return !evalCondAST(ast.child, title, url);
    if (ast.type === 'leaf') return evalDynamicLeaf(ast.cond, title, url);
    return !!ast.value;
  }

  // 解析条件片段
  function parseConditionPart(trimmed, currentEngine, currentSite, currentCategory) {
    const stripQuotes = (str) => {
      const s = String(str || '').trim();
      if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
        return s.slice(1, -1);
      }
      return s;
    };

    const enginePropMatch = trimmed.match(/^\$site\s*[=:]\s*(?:['"](.*?)['"]|([^\s\)]+))\s*i?\s*$/i);
    if (enginePropMatch) {
      const raw = (enginePropMatch[1] !== undefined ? enginePropMatch[1] : enginePropMatch[2]).trim().toLowerCase();
      const target = raw.replace(/^ddg$/, 'duckduckgo').replace(/^yahoo-japan$/, 'yahoo');
      const engine = String(currentEngine || '').toLowerCase();
      return { matched: true, static: engine === target || engine === raw };
    }

    const categoryMatch = trimmed.match(/^\$category\s*[=:]\s*(?:['"](.*?)['"]|([^\s\)]+))\s*i?\s*$/i);
    if (categoryMatch) {
      const target = (categoryMatch[1] !== undefined ? categoryMatch[1] : categoryMatch[2]).trim().toLowerCase();
      return { matched: true, static: (currentCategory || 'web') === target };
    }

    let siteMatch = trimmed.match(/^site\s*[=:]\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|([^\s\)]+))\s*i?\s*$/i);
    if (!siteMatch) siteMatch = trimmed.match(/^site\s*\(\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|([^\s\)]+))\s*\)\s*i?\s*$/i);
    if (siteMatch) {
      const rawVal = (siteMatch[1] !== undefined ? siteMatch[1] : (siteMatch[2] !== undefined ? siteMatch[2] : siteMatch[3]));
      const target = rawVal.trim().toLowerCase().replace(/^\.+|\.+$/g, '');
      const curSite = String(currentSite || '').toLowerCase();
      return { matched: true, static: curSite === target || curSite.endsWith(`.${target}`) };
    }

    const strMatch = trimmed.match(/^(title|url|host|path|scheme)\s*(\^=|\$=|\*=|=|:)\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|([^\s"']+))\s*i?\s*$/i);
    if (strMatch) {
      const op = strMatch[2] === ':' ? '=' : strMatch[2];
      const rawVal = (strMatch[3] !== undefined ? strMatch[3] : (strMatch[4] !== undefined ? strMatch[4] : strMatch[5]));
      let val = rawVal.replace(/\\(["'])/g, '$1').toLowerCase();
      const condType = strMatch[1].toLowerCase();
      if (condType === 'host') val = toASCIIHostname(val);
      return { matched: true, dynamic: { type: condType, op, val } };
    }

    const reMatch = trimmed.match(/^(title|url|host|path|scheme)\s*(?:=\~\s*)?\/((?:[^/\\\[]|\\.|\[(?:[^\]\\]|\\.)*\])*)\/([a-z]*)$/i);
    if (reMatch) {
      const condType = reMatch[1].toLowerCase();
      let flags = String(reMatch[3] || '').toLowerCase();
      if (getInvalidRegexFlags(flags)) return { matched: false };
      if ((condType === 'host' || condType === 'scheme') && !flags.includes('i')) {
        flags += 'i';
      }
      return { matched: true, dynamic: { type: condType, op: '=~', regex: new RegExp(reMatch[2], flags) } };
    }

    return { matched: false };
  }

  const SUPPORTED_REGEX_FLAGS = 'imsu';

  function getInvalidRegexFlags(flags) {
    const invalid = [];
    const seen = new Set();
    for (const flag of flags.toLowerCase()) {
      if (!SUPPORTED_REGEX_FLAGS.includes(flag) || seen.has(flag)) invalid.push(flag);
      seen.add(flag);
    }
    return [...new Set(invalid)].join('');
  }

  function validateUrlWildcard(rule) {
    if (!rule || /[<>"']/.test(rule) || /\s/.test(rule)) return false;
    if (rule.startsWith('|') || rule.startsWith('@@')) return false;
    if (/^\*:\/\/\*\*+/.test(rule) || /\*{3,}/.test(rule)) return false;
    if (rule.startsWith('*://') && !/^\*:\/\/[^/]+(?:\/.*)?$/.test(rule)) return false;
    return true;
  }

  function evaluateCondition(condStr, dynamicConditionsList) {
    const { ast, errors } = analyzeCondExpr(condStr);
    if (errors.length || !ast) return false;
    const folded = foldCondExpr(ast);
    if (folded.type === 'const') return folded.value;
    dynamicConditionsList.push(folded);
    return true;
  }

  function extractBalancedParens(str, startIndex) {
    if (str[startIndex] !== '(') return null;
    let depth = 0;
    let inSQ = false;
    let inDQ = false;
    let inRE = false;
    let inReClass = false;
    for (let i = startIndex; i < str.length; i++) {
      const ch = str[i];
      if (inSQ) {
        if (ch === '\\') { i++; continue; }
        if (ch === "'") inSQ = false;
        continue;
      }
      if (inDQ) {
        if (ch === '\\') { i++; continue; }
        if (ch === '"') inDQ = false;
        continue;
      }
      if (inRE) {
        if (ch === '\\') { i++; continue; }
        if (inReClass) {
          if (ch === ']') inReClass = false;
          continue;
        }
        if (ch === '[') { inReClass = true; continue; }
        if (ch === '/') inRE = false;
        continue;
      }
      if (ch === '\\') { i++; continue; }
      if (ch === "'") { inSQ = true; continue; }
      if (ch === '"') { inDQ = true; continue; }
      if (ch === '/') {
        const prev = str.slice(0, i).trimEnd();
        if (/(?:=~|~)$/.test(prev) || (/(?:^|[\s(&|!])(?:title|url|host|path|scheme)$/i.test(prev) && !prev.includes('://'))) {
          inRE = true;
          continue;
        }
      }
      if (ch === '(') depth++;
      else if (ch === ')') {
        depth--;
        if (depth === 0) {
          return {
            content: str.substring(startIndex + 1, i),
            endIndex: i + 1
          };
        }
      }
    }
    return null;
  }

  function findIfOccurrences(ruleStr) {
    const occurrences = [];
    const n = ruleStr.length;
    let start = 0;
    if (ruleStr[start] === '@') {
      start++;
      while (start < n && /\d/.test(ruleStr[start])) start++;
      while (start < n && /\s/.test(ruleStr[start])) start++;
    }
    let i = 0;
    let inRE = false;
    let inReClass = false;
    let inSQ = false;
    let inDQ = false;
    const prefixRegexMatch = /^(?:url|host|path|scheme|title|text)\/(?:[^/\\]|\\.)*\//i.exec(ruleStr.slice(start));
    if (ruleStr[start] === '/' && /^\/(?:[^/\\]|\\.)*\//.test(ruleStr.slice(start))) {
      inRE = true;
      i = start + 1;
    } else if (prefixRegexMatch) {
      const prefix = /^(?:url|host|path|scheme|title|text)\//i.exec(ruleStr.slice(start))[0];
      inRE = true;
      i = start + prefix.length;
    }
    for (; i < n; i++) {
      const ch = ruleStr[i];
      if (inSQ) {
        if (ch === '\\') i++;
        else if (ch === "'") inSQ = false;
        continue;
      }
      if (inDQ) {
        if (ch === '\\') i++;
        else if (ch === '"') inDQ = false;
        continue;
      }
      if (inRE) {
        if (ch === '\\') { i++; continue; }
        if (inReClass) {
          if (ch === ']') inReClass = false;
          continue;
        }
        if (ch === '[') { inReClass = true; continue; }
        if (ch === '/') inRE = false;
        continue;
      }
      if (ch === "'") { inSQ = true; continue; }
      if (ch === '"') { inDQ = true; continue; }
      if (ch === '@' && ruleStr.substr(i, 3).toLowerCase() === '@if') {
        const prevChar = i > 0 ? ruleStr[i - 1] : '';
        const isBoundary = i === 0 || /\s/.test(prevChar) || prevChar === '@' || prevChar === '(';
        if (!isBoundary) {
          continue;
        }
        let j = i + 3;
        while (j < n && /\s/.test(ruleStr[j])) j++;
        if (ruleStr[j] === '(') {
          occurrences.push({ index: i, condStart: j });
          const parenResult = extractBalancedParens(ruleStr, j);
          if (parenResult) i = parenResult.endIndex - 1;
        }
        continue;
      }
    }
    return occurrences;
  }

  // 剥离@if条件
  function stripIfConditions(ruleStr, evaluateCond) {
    let coreRule = ruleStr.trim();
    let staticPass = true;

    const ranges = [];

    for (const occ of findIfOccurrences(coreRule)) {
      const parenResult = extractBalancedParens(coreRule, occ.condStart);
      if (!parenResult) continue;

      const cond = parenResult.content.trim();

      ranges.push({
        start: occ.index,
        end: parenResult.endIndex
      });

      if (evaluateCond && !evaluateCond(cond)) staticPass = false;
    }

    ranges.sort((a, b) => b.start - a.start);

    for (const r of ranges) {
      coreRule = coreRule.slice(0, r.start) + coreRule.slice(r.end);
    }

    coreRule = coreRule.trim();

    if (coreRule.startsWith('{') && coreRule.endsWith('}') && coreRule.length > 1) {
      coreRule = coreRule.slice(1, -1).trim();
    }

    return {
      coreRule,
      staticPass
    };
  }

  function isCondExprCore(str) {
    if (!str) return false;
    return !str.startsWith('/') && !/^title\//i.test(str) && !/^text\//i.test(str) && !str.startsWith('*://') && !/^[a-z][a-z0-9+.-]*:\/\//i.test(str);
  }

  function looksLikeCondExpr(str) {
    if (!isCondExprCore(str)) return false;
    return /(?:^|[\s(&|!])(?:\$site|\$category|site|title|url|host|path|scheme)\s*(?:(?:=~|\^=|\$=|\*=|=|:)\s*\S|\/)/i.test(str)
      || /^\s*!\s*(?:(?:\$site|\$category|site|title|url|host|path|scheme)\b|\()/i.test(str);
  }

  // 判断规则行
  function isScriptRuleLine(line) {
    const s = line.trim();
    if (!s) return false;
    if (s.startsWith('/') || s.startsWith('*://') || /^[a-z][a-z0-9+.-]*:\/\//i.test(s)) return true;
    if (/^title\//i.test(s) || /^text\//i.test(s)) return true;
    if (s.startsWith('@')) return true;
    return looksLikeCondExpr(s);
  }

  // uBO元素判定
  function isElementRuleLine(line) {
    if (!/(?:##|#@#|#(?:@)?[$?%]#)/.test(line)) return false;
    return !isScriptRuleLine(line);
  }

  function absorbStandaloneExpr(coreRule, dynamicConditions) {
    if (!looksLikeCondExpr(coreRule)) return null;
    const { ast, errors } = analyzeCondExpr(coreRule);
    if (errors.length || !ast) return null;
    const folded = foldCondExpr(ast);
    if (folded.type === 'const') return { staticPass: folded.value };
    dynamicConditions.push(folded);
    return { staticPass: true };
  }

  function parseRuleWithConditions(ruleStr) {
    const dynamicConditions = [];
    let { coreRule, staticPass } = stripIfConditions(ruleStr, (cond) => evaluateCondition(cond, dynamicConditions));

    let whitelist = false;
    if (coreRule.startsWith('@')) {
      whitelist = true;
      coreRule = coreRule.substring(1).trim();
    }

    const absorbed = absorbStandaloneExpr(coreRule, dynamicConditions);
    if (absorbed) {
      staticPass = staticPass && absorbed.staticPass;
      coreRule = '';
    }

    const standaloneExpr = !!absorbed || (!coreRule && dynamicConditions.length > 0);
    if (whitelist) coreRule = '@' + coreRule;
    return {
      coreRule,
      staticPass,
      dynamicConditions,
      standaloneExpr
    };
  }

  // 处理@if条件
  function extractIfConditions(ruleStr) {
    const conds = [];
    for (const occ of findIfOccurrences(ruleStr)) {
      const parenResult = extractBalancedParens(ruleStr, occ.condStart);
      if (parenResult) conds.push(parenResult.content.trim());
    }
    return conds;
  }

  // 校验@if条件语法
  function validateCondition(condStr) {
    const errors = [];
    const warnings = [];
    const { errors: rawErrors } = analyzeCondExpr(condStr);
    for (const e of rawErrors) {
      if (e.kind === 'unknown') {
        errors.push(t('unknownIfCondition', { part: e.part }));
      } else if (e.kind === 'regex') {
        errors.push(t('condRegexError', { part: e.part }));
      } else if (e.kind === 'flags') {
        errors.push(t('invalidRegexFlags', { flags: e.part }));
      } else {
        const display = condStr.length > 60 ? condStr.slice(0, 60) + '…' : condStr;
        errors.push(t('condExprError', { part: display }));
      }
    }
    return { errors, warnings };
  }

  // 规则语法分析
  function analyzeRule(rule) {
    if (!rule || rule.trim() === '') return { valid: true, errors: [], warnings: [] };

    let ruleToCheck = rule.trim();
    if (ruleToCheck.startsWith('#')) return { valid: true, errors: [], warnings: [] };
    ruleToCheck = stripRuleComment(ruleToCheck);
    if (!ruleToCheck) return { valid: true, errors: [], warnings: [] };
    const errors = [];
    const warnings = [];

    let hlN = null;
    const hlValMatch = ruleToCheck.match(/^@(\d+)/);
    if (hlValMatch) {
      const N = parseInt(hlValMatch[1]);
      if (N < 1 || N > 5) {
        return { valid: false, errors: [t('hlColorError')], warnings };
      }
      hlN = N;
      ruleToCheck = ruleToCheck.substring(hlValMatch[0].length).trim();
      if (!ruleToCheck) return { valid: false, errors: [t('emptyPrefixRule')], warnings };
    }

    // @if条件语法检查
    if (/@if\s*\(/i.test(ruleToCheck)) {
        let unbalanced = false;
        for (const occ of findIfOccurrences(ruleToCheck)) {
          if (!extractBalancedParens(ruleToCheck, occ.condStart)) { unbalanced = true; break; }
        }
        if (unbalanced) return { valid: false, errors: [t('ifParenError')], warnings };
        for (const cond of extractIfConditions(ruleToCheck)) {
          if (!cond.trim()) {
            errors.push(t('emptyIfCondition'));
            continue;
          }
          const r = validateCondition(cond);
          errors.push(...r.errors);
          warnings.push(...r.warnings);
        }
    }

    const stripped = stripIfConditions(ruleToCheck);
    ruleToCheck = stripped.coreRule;

    // 白名单规则
    if (ruleToCheck.startsWith('@')) {
      if (hlN !== null) {
        errors.push(t('hlWhitelistConflict'));
        return { valid: false, errors, warnings };
      }
      ruleToCheck = ruleToCheck.substring(1).trim();
      if (!ruleToCheck) return { valid: false, errors: [t('emptyPrefixRule')], warnings };
    }

    if (!ruleToCheck) {
      return { valid: errors.length === 0, errors, warnings };
    }

    if (looksLikeCondExpr(ruleToCheck)) {
      const r = validateCondition(ruleToCheck);
      errors.push(...r.errors);
      warnings.push(...r.warnings);
      return { valid: errors.length === 0, errors, warnings };
    }

    // 未闭合正则提示
    if (ruleToCheck.startsWith('/') && ruleToCheck.lastIndexOf('/') === 0) {
      errors.push(t('regexError'));
    }

    try {
      if (ruleToCheck.startsWith('/') && ruleToCheck.lastIndexOf('/') > 0) {
        const { pattern, flags } = ruleToRegex(ruleToCheck);
        if (!pattern.trim()) {
          errors.push(t('regexError'));
          return { valid: false, errors, warnings };
        }
        const invalidFlags = getInvalidRegexFlags(flags);
        if (invalidFlags) {
          errors.push(t('invalidRegexFlags', { flags: invalidFlags }));
          return { valid: false, errors, warnings };
        }
        new RegExp(pattern, String(flags || '').toLowerCase());
      } else if (ruleToCheck.startsWith('text/') || ruleToCheck.startsWith('title/')) {
        const prefixLen = ruleToCheck.startsWith('title/') ? 6 : 5;
        const { pattern, flags } = parsePrefixedRegexRule(ruleToCheck, prefixLen);
        if (!pattern.trim()) {
          errors.push(t('emptyPrefixRule'));
          return { valid: false, errors, warnings };
        }
        const invalidFlags = getInvalidRegexFlags(flags);
        if (invalidFlags) {
          errors.push(t('invalidRegexFlags', { flags: invalidFlags }));
          return { valid: false, errors, warnings };
        }
        new RegExp(pattern, String(flags || '').toLowerCase());
      } else {
        if (!validateUrlWildcard(ruleToCheck)) {
          errors.push(t('invalidUrlWildcard', { rule: ruleToCheck }));
          return { valid: false, errors, warnings };
        }
        new RegExp(wildcardToRegex(ruleToCheck), 'i');
      }
    } catch (e) {
      errors.push((ruleToCheck.startsWith('/') || ruleToCheck.startsWith('text/') || ruleToCheck.startsWith('title/')) ? t('regexError') : t('urlError'));
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  // 语法检查
  function validateRule(rule) {
    return analyzeRule(rule).valid;
  }

  function parsePrefixedRegexRule(rawRule, prefixLen) {
    let remaining = rawRule.substring(prefixLen);
    let pattern, flags = '';
    let lastSlashIndex = -1;
    for (let i = remaining.length - 1; i >= 0; i--) {
      if (remaining[i] === '/') {
        let backslashCount = 0;
        let j = i - 1;
        while (j >= 0 && remaining[j] === '\\') {
          backslashCount++;
          j--;
        }
        if (backslashCount % 2 === 0) {
          lastSlashIndex = i;
          break;
        }
      }
    }
    if (lastSlashIndex !== -1 && lastSlashIndex < remaining.length - 1) {
      const possibleFlags = remaining.substring(lastSlashIndex + 1);
      const isUniqueFlags = (str) => {
        const lower = str.toLowerCase();
        return /^[imsu]+$/.test(lower) && new Set(lower).size === lower.length;
      };
      if (isUniqueFlags(possibleFlags)) {
        flags = possibleFlags.toLowerCase();
        pattern = remaining.substring(0, lastSlashIndex);
      } else {
        pattern = remaining;
      }
    } else {
      pattern = remaining;
    }
    if (!flags && remaining.endsWith('/')) {
      let backslashCount = 0;
      let j = remaining.length - 2;
      while (j >= 0 && remaining[j] === '\\') {
        backslashCount++;
        j--;
      }
      if (backslashCount % 2 === 0) {
        pattern = remaining.slice(0, -1);
      }
    }
    if (!flags) {
      const oldFlagMatch = pattern.match(/^\(\?([imsu]+)\)/i);
      if (oldFlagMatch) {
        flags = oldFlagMatch[1].toLowerCase();
        pattern = pattern.substring(oldFlagMatch[0].length);
      }
    }
    return { pattern, flags: String(flags || '').toLowerCase() };
  }

  // 通配符片段转正则
  function escapeWildcardPart(part, isHost) {
    const starPattern = isHost ? '[^/]*' : '.*';
    if (isHost && part && !/^[\x00-\x7F]*$/.test(part)) {
      part = part.split('.').map(label => {
        if (!label || label === '*' || label.includes('*') || label.includes('\\') || /^[\x00-\x7F]*$/.test(label)) return label;
        return hostLabelToASCII(label);
      }).join('.');
    }
    let out = '';
    let i = 0;
    if (isHost && part.startsWith('*.')) {
      out += '(?:[^/]*\\.)?';
      i = 2;
    }
    for (; i < part.length; i++) {
      const ch = part[i];
      if (ch === '\\' && i + 1 < part.length) {
        out += ch + part[i + 1];
        i++;
        continue;
      }
      if (ch === '*') { out += starPattern; continue; }
      if (ch === '?') { out += '\\?'; continue; }
      if ('.+^${}()|[]\\'.includes(ch)) { out += '\\' + ch; continue; }
      out += ch;
    }
    return out;
  }

  function wildcardToRegex(pattern) {
    function splitHostAndPort(part) {
      if (part.startsWith('[')) {
        const bracketEnd = part.indexOf(']');
        if (bracketEnd !== -1 && part.charCodeAt(bracketEnd + 1) === 58) {
          return { host: part.slice(0, bracketEnd + 1), port: part.slice(bracketEnd + 1), hasPort: true };
        }
        return { host: part, port: '', hasPort: false };
      }
      const lastColon = part.lastIndexOf(':');
      if (lastColon !== -1) {
        return { host: part.slice(0, lastColon), port: part.slice(lastColon), hasPort: true };
      }
      return { host: part, port: '', hasPort: false };
    }

    function escapeHostPart(part) {
      const { host, port, hasPort } = splitHostAndPort(part);
      const escapedHost = escapeWildcardPart(host, true);
      if (hasPort) {
        return escapedHost + escapeWildcardPart(port, false);
      }
      return escapedHost + '(?::\\d+)?';
    }

    let prefix = '^';
    let hostIsFirst = false;
    if (pattern.startsWith('*://')) {
      prefix += 'https?:\\/\\/';
      pattern = pattern.substring(4);
      hostIsFirst = true;
    } else {
      const schemeMatch = pattern.match(/^([a-z][a-z0-9+.-]*):\/\//i);
      if (schemeMatch) {
        prefix += escapeWildcardPart(schemeMatch[1], false) + ':\\/\\/';
        pattern = pattern.substring(schemeMatch[0].length);
        hostIsFirst = true;
      } else {
        prefix += '(?:https?:\\/\\/)?';
        hostIsFirst = true;
      }
    }
    if (pattern.includes('/')) {
      const regexStr = prefix + pattern.split('/')
        .map((part, index) => {
          if (hostIsFirst && index === 0) {
            return escapeHostPart(part);
          }
          return escapeWildcardPart(part, false);
        })
        .join('\\/');
      return pattern.endsWith('*') ? regexStr : regexStr + '(?:[\\/?#:]|$)';
    }
    return prefix + (hostIsFirst ? escapeHostPart(pattern) : escapeWildcardPart(pattern, false)) + '(?:[\\/?#:]|$)';
  }

  function ruleToRegex(rule) {
    if (!rule.startsWith('/') && !rule.startsWith('title/') && !rule.startsWith('text/') &&
      !rule.includes('*') && !rule.includes('://') && !rule.startsWith('.')) {
      if (rule.includes('.') && !rule.includes('/') && !/\s/.test(rule)) {
        rule = '*://*.' + rule + '/*';
      }
    }

    if (rule.startsWith('/') && rule.lastIndexOf('/') > 0) {
      const lastSlash = rule.lastIndexOf('/');
      const pattern = rule.slice(1, lastSlash);
      const flags = rule.slice(lastSlash + 1).toLowerCase();
      return {
        pattern,
        flags
      };
    }

    if (rule.startsWith('title/')) {
      return parsePrefixedRegexRule(rule, 6);
    }

    if (rule.startsWith('text/')) {
      return parsePrefixedRegexRule(rule, 5);
    }

    // URL规则
    return {
      pattern: wildcardToRegex(rule),
      flags: 'i'
    };
  }

  // 域名检查
  function matchWildcardDomainPattern(pattern) {
    if (pattern.includes(':') && !pattern.startsWith('*://')) return null;
    const bareWildcard = pattern.match(/^\*\.([^\/\*\s:]+)$/);
    if (bareWildcard && bareWildcard[1].includes('.')) {
      return { domain: toASCIIHostname(bareWildcard[1]), domainType: 'wildcard' };
    }
    if (!pattern.startsWith('/') && !pattern.startsWith('title/') && !pattern.startsWith('text/') &&
      !pattern.includes('*') && !pattern.includes('://') && !pattern.startsWith('.')) {
      if (pattern.includes('.') && !/\s/.test(pattern) && !pattern.includes('/') && !pattern.includes(':')) {
        return { domain: toASCIIHostname(pattern), domainType: 'wildcard' };
      }
    }
    const wildcardMatch = pattern.match(/^\*:\/\/\*\.([^\/\*:]+)\/\*$/);
    if (wildcardMatch && wildcardMatch[1].includes('.')) return { domain: toASCIIHostname(wildcardMatch[1]), domainType: 'wildcard' };
    const exactMatch = pattern.match(/^\*:\/\/([^\/\*:]+)\/\*$/);
    if (exactMatch) return { domain: toASCIIHostname(exactMatch[1]), domainType: 'exact' };
    return null;
  }

  function extractSimpleWhitelistDomain(rule) {
    const m = matchWildcardDomainPattern(rule.substring(1));
    if (!m) return null;
    return { domain: m.domain, type: m.domainType };
  }

  function matchSimpleDomain(coreRule) {
    return matchWildcardDomainPattern(coreRule);
  }

  // 辅助分类正则
  function compileRuleRegex(coreRule) {
    let type = 'url';
    let pattern = '';
    let flags = '';
    if (coreRule.startsWith('/') && coreRule.lastIndexOf('/') > 0) {
      type = 'regex';
      const r = ruleToRegex(coreRule);
      pattern = r.pattern;
      flags = r.flags;
    } else if (coreRule.startsWith('title/')) {
      type = 'title';
      const r = ruleToRegex(coreRule);
      pattern = r.pattern;
      flags = r.flags;
    } else if (coreRule.startsWith('text/')) {
      type = 'text';
      const r = parsePrefixedRegexRule(coreRule, 5);
      pattern = r.pattern;
      flags = r.flags;
    } else {
      type = 'url';
      const r = ruleToRegex(coreRule);
      pattern = r.pattern;
      flags = r.flags;
    }
    if (!pattern || !pattern.trim()) {
      throw new Error('Empty regex pattern');
    }
    return { type, regex: new RegExp(pattern, String(flags || '').toLowerCase()) };
  }

  function isLocalEntry(entry) {
    if (!entry) return false;
    if (entry.isLocal !== undefined) return entry.isLocal;
    return entry.source === t('localRule') || entry.source === '本地规则' || entry.source === 'Local Rule';
  }

  // 预编译规则索引
  function buildRuleIndex() {
    validationCache.clear();
    subdomainCache.clear();
    compiledRules = {
      domains: new Map(),
      urls: [],
      titles: [],
      texts: [],
      whitelistDomains: new Map(),
      whitelistUrlPatterns: [],
      whitelistTitlePatterns: [],
      whitelistTextPatterns: [],
      whitelistConditionalDomains: new Map(),
      whitelistConditionalRules: [],
      conditionalRules: [],
      conditionalDomains: new Map(),
      highlightDomains: new Map(),
      highlightUrls: [],
      highlightTitles: [],
      highlightTexts: [],
      highlightConditionalRules: [],
      highlightConditionalDomains: new Map()
    };
    const subscriptionRules = getAllSubscriptionRules();
    const allRules = currentConfig.rules.concat(subscriptionRules);
    const subscriptions = getSubscriptions();
    const localRuleCount = currentConfig.rules.length;
    const subscriptionSources = [];
    subscriptions.forEach((sub, idx) => {
      if (sub.enabled && sub.rules && Array.isArray(sub.rules)) {
        for (let i = 0; i < sub.rules.length; i++) {
          subscriptionSources.push(`${t('subscription')}${idx + 1}`);
        }
      }
    });

    allRules.forEach((rule, ruleIndex) => {
      rule = stripRuleComment(rule.trim());
      if (!rule) return;

      // @N高亮规则
      const hlMatch = rule.match(/^@(\d+)/);
      if (hlMatch) {
        const N = parseInt(hlMatch[1]);
        if (N < 1 || N > 5) return;
        let hlRule = rule.substring(hlMatch[0].length).trim();
        if (!hlRule) return;
        let parsed;
        try {
          parsed = parseRuleWithConditions(hlRule);
        } catch (e) {
          if (currentConfig.debug) console.warn('高亮规则解析失败:', hlRule, e);
          return;
        }
        if (!parsed.staticPass) return;
        let coreRule = parsed.coreRule;
        if (coreRule.startsWith('@')) {
          if (currentConfig.debug) console.warn('高亮+白名单组合规则无效，已跳过:', hlRule);
          return;
        }

        if (!coreRule && (parsed.standaloneExpr || parsed.dynamicConditions.length)) {
          compiledRules.highlightConditionalRules.push({type: 'expr', conditions: parsed.dynamicConditions, N});
          return;
        }
        if (!coreRule) return;

        const dm = matchSimpleDomain(coreRule);
        if (dm) {
          if (!parsed.dynamicConditions.length) {
            if (!compiledRules.highlightDomains.has(dm.domain))
              compiledRules.highlightDomains.set(dm.domain, []);
            compiledRules.highlightDomains.get(dm.domain).push({N, type: dm.domainType});
          } else {
            const hlCondRule = {type: 'domain', domain: dm.domain, N, conditions: parsed.dynamicConditions, domainType: dm.domainType};
            if (!compiledRules.highlightConditionalDomains.has(dm.domain))
              compiledRules.highlightConditionalDomains.set(dm.domain, []);
            compiledRules.highlightConditionalDomains.get(dm.domain).push(hlCondRule);
          }
          return;
        }

        try {
          const compiled = compileRuleRegex(coreRule);
          const ruleObj = {type: compiled.type, regex: compiled.regex, conditions: parsed.dynamicConditions, N};
          if (!parsed.dynamicConditions.length) {
            if (compiled.type === 'url' || compiled.type === 'regex') compiledRules.highlightUrls.push({regex: compiled.regex, N});
            else if (compiled.type === 'title') compiledRules.highlightTitles.push({regex: compiled.regex, N});
            else if (compiled.type === 'text') compiledRules.highlightTexts.push({regex: compiled.regex, N});
          } else {
            compiledRules.highlightConditionalRules.push(ruleObj);
          }
        } catch (e) {
          if (currentConfig.debug) console.warn('高亮规则编译失败:', hlRule, e);
        }
        return;
      }

      if (!rule || rule.trim() === '' || rule.startsWith('#')) return;

      const isLocal = ruleIndex < localRuleCount;
      const source = isLocal
        ? t('localRule')
        : (subscriptionSources[ruleIndex - localRuleCount] || t('localRule'));

      let parsed;
      try {
        parsed = parseRuleWithConditions(rule);
      } catch (e) {
        if (currentConfig.debug) console.warn('规则解析失败:', rule, e);
        return;
      }
      if (!parsed.staticPass) return;

      const coreRule = parsed.coreRule;
      const hasDynamic = parsed.dynamicConditions.length > 0;

      // 白名单处理
      if (coreRule.startsWith('@')) {
        const simpleDomain = extractSimpleWhitelistDomain(coreRule);
        if (simpleDomain) {
          if (!hasDynamic) {
            if (!compiledRules.whitelistDomains.has(simpleDomain.domain))
              compiledRules.whitelistDomains.set(simpleDomain.domain, []);
            compiledRules.whitelistDomains.get(simpleDomain.domain).push({type: simpleDomain.type, source, isLocal});
          } else {
            if (!compiledRules.whitelistConditionalDomains.has(simpleDomain.domain))
              compiledRules.whitelistConditionalDomains.set(simpleDomain.domain, []);
            compiledRules.whitelistConditionalDomains.get(simpleDomain.domain).push({type: simpleDomain.type, conditions: parsed.dynamicConditions, source, isLocal});
          }
        } else {
          const whitelistRule = coreRule.substring(1).trim();
          if (!whitelistRule) {
            if (parsed.standaloneExpr || hasDynamic) {
              compiledRules.whitelistConditionalRules.push({type: 'expr', conditions: parsed.dynamicConditions, source, isLocal});
            }
            return;
          }
          try {
            const compiled = compileRuleRegex(whitelistRule);
            if (!hasDynamic) {
              if (compiled.type === 'title') {
                compiledRules.whitelistTitlePatterns.push({regex: compiled.regex, source, isLocal});
              } else if (compiled.type === 'text') {
                compiledRules.whitelistTextPatterns.push({regex: compiled.regex, source, isLocal});
              } else {
                compiledRules.whitelistUrlPatterns.push({regex: compiled.regex, source, isLocal});
              }
            } else {
              compiledRules.whitelistConditionalRules.push({type: compiled.type, regex: compiled.regex, conditions: parsed.dynamicConditions, source, isLocal});
            }
          } catch (e) {
            if (currentConfig.debug) console.warn('白名单规则预编译失败:', rule, e);
          }
        }
        return;
      }

      let ruleObj = {
        originalRule: rule,
        source: source,
        isLocal: isLocal,
        conditions: parsed.dynamicConditions
      };

      if (!coreRule) {
        if (parsed.standaloneExpr || hasDynamic) {
          ruleObj.type = 'expr';
          compiledRules.conditionalRules.push(ruleObj);
        }
        return;
      }

      // 处理域名规则
      if (!coreRule.startsWith('/') && !coreRule.startsWith('text/') && !coreRule.startsWith('title/')) {
        const dm = matchSimpleDomain(coreRule);
        if (dm) {
          ruleObj.type = 'domain';
          ruleObj.domain = dm.domain;
          ruleObj.domainType = dm.domainType;
          if (!hasDynamic) {
            if (!compiledRules.domains.has(dm.domain))
              compiledRules.domains.set(dm.domain, []);
            compiledRules.domains.get(dm.domain).push({type: dm.domainType, originalRule: rule, source, isLocal});
          } else {
            if (!compiledRules.conditionalDomains.has(dm.domain))
              compiledRules.conditionalDomains.set(dm.domain, []);
            compiledRules.conditionalDomains.get(dm.domain).push(ruleObj);
          }
          return;
        }
      }

      // 预编译正则
      try {
        const compiled = compileRuleRegex(coreRule);
        ruleObj.type = compiled.type;
        ruleObj.regex = compiled.regex;
        if (!hasDynamic) {
          if (compiled.type === 'text') compiledRules.texts.push({regex: compiled.regex, originalRule: rule, source, isLocal});
          else if (compiled.type === 'title') compiledRules.titles.push({regex: compiled.regex, originalRule: rule, source, isLocal});
          else compiledRules.urls.push({regex: compiled.regex, originalRule: rule, source, isLocal});
        } else {
          compiledRules.conditionalRules.push(ruleObj);
        }
      } catch (e) {
        if (currentConfig.debug) console.warn('规则预编译失败:', rule, e);
      }
    });
  }

  function cachedAnalyzeRule(rule) {
    if (!validationCache.has(rule)) {
      validationCache.set(rule, analyzeRule(rule));
    }
    return validationCache.get(rule);
  }

  // 条件运行求值
  function checkDynamicConditions(conditions, title, url) {
    if (!conditions || !conditions.length) return true;
    for (let i = 0; i < conditions.length; i++) {
      if (!evalCondAST(conditions[i], title, url)) return false;
    }
    return true;
  }

  function getSubdomainLevels(domain) {
    const lower = toASCIIHostname(domain);
    if (subdomainCache.has(lower)) return subdomainCache.get(lower);
    const levels = [];
    let d = lower;
    while (d) {
      levels.push(d);
      const dot = d.indexOf('.');
      if (dot === -1) break;
      d = d.substring(dot + 1);
    }
    subdomainCache.set(lower, levels);
    return levels;
  }

  function matchDomainEntryType(entryType, level, lowerDomain) {
    return entryType === 'wildcard' || (entryType === 'exact' && level === lowerDomain);
  }

  // 规则优先级
  function checkRuleMatchOptimized(url, domain, title, snippet, subdomainLevels) {
    if (!subdomainLevels) subdomainLevels = getSubdomainLevels(domain);
    const isLocalEntry = (entry) => {
      if (!entry) return false;
      if (entry.isLocal !== undefined) return entry.isLocal;
      return entry.source === t('localRule') || entry.source === '本地规则' || entry.source === 'Local Rule';
    };
    const lowerDomain = domain.toLowerCase();
    let whitelisted = false;
    let highlightN = 0;
    let blockedInfo = null;

    for (const level of subdomainLevels) {
      const hlEntries = compiledRules.highlightDomains.get(level);
      if (hlEntries) {
        for (const hlData of hlEntries) {
          if (matchDomainEntryType(hlData.type, level, lowerDomain)) {
            highlightN = hlData.N; break;
          }
        }
        if (highlightN) break;
      }
    }
    if (!highlightN) {
      for (let {regex, N} of compiledRules.highlightUrls) {
        if (safeRegexTest(regex, url) || safeRegexTest(regex, domain)) { highlightN = N; break; }
      }
    }
    if (!highlightN && title) {
      for (let {regex, N} of compiledRules.highlightTitles) {
        if (safeRegexTest(regex, title)) { highlightN = N; break; }
      }
    }
    if (!highlightN && snippet) {
      for (let {regex, N} of compiledRules.highlightTexts) {
        if (safeRegexTest(regex, snippet)) { highlightN = N; break; }
      }
    }
    if (!highlightN) {
      for (const level of subdomainLevels) {
        const rules = compiledRules.highlightConditionalDomains.get(level);
        if (rules) {
          for (const item of rules) {
            if (matchDomainEntryType(item.domainType, level, lowerDomain) && checkDynamicConditions(item.conditions, title, url)) {
              highlightN = item.N; break;
            }
          }
          if (highlightN) break;
        }
      }
    }
    if (!highlightN) {
      for (let item of compiledRules.highlightConditionalRules) {
        if (!checkDynamicConditions(item.conditions, title, url)) continue;
        if (item.type === 'expr') { highlightN = item.N; break; }
        if (item.type === 'url' || item.type === 'regex') {
          if (safeRegexTest(item.regex, url) || safeRegexTest(item.regex, domain)) { highlightN = item.N; break; }
        } else if (item.type === 'title' && title) {
          if (safeRegexTest(item.regex, title)) { highlightN = item.N; break; }
        } else if (item.type === 'text' && snippet) {
          if (safeRegexTest(item.regex, snippet)) { highlightN = item.N; break; }
        }
      }
    }

    for (const level of subdomainLevels) {
      const types = compiledRules.whitelistDomains.get(level);
      if (types) {
        for (const entry of types) {
          if (isLocalEntry(entry) && matchDomainEntryType(entry.type, level, lowerDomain)) { whitelisted = true; break; }
        }
        if (whitelisted) break;
      }
    }
    if (!whitelisted) {
      for (let i = 0; i < compiledRules.whitelistUrlPatterns.length; i++) {
        const entry = compiledRules.whitelistUrlPatterns[i];
        if (!isLocalEntry(entry)) continue;
        if (safeRegexTest(entry.regex, url) || safeRegexTest(entry.regex, domain)) { whitelisted = true; break; }
      }
    }
    if (!whitelisted && title) {
      for (let i = 0; i < compiledRules.whitelistTitlePatterns.length; i++) {
        const entry = compiledRules.whitelistTitlePatterns[i];
        if (!isLocalEntry(entry)) continue;
        if (safeRegexTest(entry.regex, title)) { whitelisted = true; break; }
      }
    }
    if (!whitelisted && snippet) {
      for (let i = 0; i < compiledRules.whitelistTextPatterns.length; i++) {
        const entry = compiledRules.whitelistTextPatterns[i];
        if (!isLocalEntry(entry)) continue;
        if (safeRegexTest(entry.regex, snippet)) { whitelisted = true; break; }
      }
    }
    if (!whitelisted) {
      for (const level of subdomainLevels) {
        const wlRules = compiledRules.whitelistConditionalDomains.get(level);
        if (wlRules) {
          for (const item of wlRules) {
            if (isLocalEntry(item) && matchDomainEntryType(item.type, level, lowerDomain) && checkDynamicConditions(item.conditions, title, url)) { whitelisted = true; break; }
          }
          if (whitelisted) break;
        }
      }
    }
    if (!whitelisted) {
      for (let i = 0; i < compiledRules.whitelistConditionalRules.length; i++) {
        const item = compiledRules.whitelistConditionalRules[i];
        if (!isLocalEntry(item)) continue;
        if (!checkDynamicConditions(item.conditions, title, url)) continue;
        if (item.type === 'expr') { whitelisted = true; break; }
        if (item.type === 'url' || item.type === 'regex') {
          if (safeRegexTest(item.regex, url) || safeRegexTest(item.regex, domain)) { whitelisted = true; break; }
        } else if (item.type === 'title' && title) {
          if (safeRegexTest(item.regex, title)) { whitelisted = true; break; }
        } else if (item.type === 'text' && snippet) {
          if (safeRegexTest(item.regex, snippet)) { whitelisted = true; break; }
        }
      }
    }

    if (!whitelisted) {
      for (const level of subdomainLevels) {
        const entries = compiledRules.domains.get(level);
        if (entries) {
          for (const dm of entries) {
            if (!isLocalEntry(dm)) continue;
            if (matchDomainEntryType(dm.type, level, lowerDomain)) { blockedInfo = {rule: dm.originalRule, source: dm.source}; break; }
          }
          if (blockedInfo) break;
        }
      }
      if (!blockedInfo) {
        for (let i = 0; i < compiledRules.urls.length; i++) {
          const item = compiledRules.urls[i];
          if (!isLocalEntry(item)) continue;
          if (safeRegexTest(item.regex, url) || safeRegexTest(item.regex, domain)) { blockedInfo = {rule: item.originalRule, source: item.source}; break; }
        }
      }
      if (!blockedInfo && title) {
        for (let i = 0; i < compiledRules.titles.length; i++) {
          const item = compiledRules.titles[i];
          if (!isLocalEntry(item)) continue;
          if (safeRegexTest(item.regex, title)) { blockedInfo = {rule: item.originalRule, source: item.source}; break; }
        }
      }
      if (!blockedInfo && snippet) {
        for (let i = 0; i < compiledRules.texts.length; i++) {
          const item = compiledRules.texts[i];
          if (!isLocalEntry(item)) continue;
          if (safeRegexTest(item.regex, snippet)) { blockedInfo = {rule: item.originalRule, source: item.source}; break; }
        }
      }
      if (!blockedInfo) {
        for (const level of subdomainLevels) {
          const rules = compiledRules.conditionalDomains.get(level);
          if (rules) {
            for (const item of rules) {
              if (!isLocalEntry(item)) continue;
              if (matchDomainEntryType(item.domainType, level, lowerDomain) && checkDynamicConditions(item.conditions, title, url)) { blockedInfo = {rule: item.originalRule, source: item.source}; break; }
            }
            if (blockedInfo) break;
          }
        }
      }
      if (!blockedInfo) {
        for (let i = 0; i < compiledRules.conditionalRules.length; i++) {
          const item = compiledRules.conditionalRules[i];
          if (!isLocalEntry(item)) continue;
          if (!checkDynamicConditions(item.conditions, title, url)) continue;
          if (item.type === 'expr') { blockedInfo = {rule: item.originalRule, source: item.source}; break; }
          if (item.type === 'url' || item.type === 'regex') {
            if (safeRegexTest(item.regex, url) || safeRegexTest(item.regex, domain)) { blockedInfo = {rule: item.originalRule, source: item.source}; break; }
          } else if (item.type === 'title' && title) {
            if (safeRegexTest(item.regex, title)) { blockedInfo = {rule: item.originalRule, source: item.source}; break; }
          } else if (item.type === 'text' && snippet) {
            if (safeRegexTest(item.regex, snippet)) { blockedInfo = {rule: item.originalRule, source: item.source}; break; }
          }
        }
      }
    }

    if (!whitelisted && !blockedInfo) {
      for (const level of subdomainLevels) {
        const types = compiledRules.whitelistDomains.get(level);
        if (types) {
          for (const entry of types) {
            if (!isLocalEntry(entry) && matchDomainEntryType(entry.type, level, lowerDomain)) { whitelisted = true; break; }
          }
          if (whitelisted) break;
        }
      }
    }
    if (!whitelisted && !blockedInfo) {
      for (let i = 0; i < compiledRules.whitelistUrlPatterns.length; i++) {
        const entry = compiledRules.whitelistUrlPatterns[i];
        if (isLocalEntry(entry)) continue;
        if (safeRegexTest(entry.regex, url) || safeRegexTest(entry.regex, domain)) { whitelisted = true; break; }
      }
    }
    if (!whitelisted && !blockedInfo && title) {
      for (let i = 0; i < compiledRules.whitelistTitlePatterns.length; i++) {
        const entry = compiledRules.whitelistTitlePatterns[i];
        if (isLocalEntry(entry)) continue;
        if (safeRegexTest(entry.regex, title)) { whitelisted = true; break; }
      }
    }
    if (!whitelisted && !blockedInfo && snippet) {
      for (let i = 0; i < compiledRules.whitelistTextPatterns.length; i++) {
        const entry = compiledRules.whitelistTextPatterns[i];
        if (isLocalEntry(entry)) continue;
        if (safeRegexTest(entry.regex, snippet)) { whitelisted = true; break; }
      }
    }
    if (!whitelisted && !blockedInfo) {
      for (const level of subdomainLevels) {
        const wlRules = compiledRules.whitelistConditionalDomains.get(level);
        if (wlRules) {
          for (const item of wlRules) {
            if (!isLocalEntry(item) && matchDomainEntryType(item.type, level, lowerDomain) && checkDynamicConditions(item.conditions, title, url)) { whitelisted = true; break; }
          }
          if (whitelisted) break;
        }
      }
    }
    if (!whitelisted && !blockedInfo) {
      for (let i = 0; i < compiledRules.whitelistConditionalRules.length; i++) {
        const item = compiledRules.whitelistConditionalRules[i];
        if (isLocalEntry(item)) continue;
        if (!checkDynamicConditions(item.conditions, title, url)) continue;
        if (item.type === 'expr') { whitelisted = true; break; }
        if (item.type === 'url' || item.type === 'regex') {
          if (safeRegexTest(item.regex, url) || safeRegexTest(item.regex, domain)) { whitelisted = true; break; }
        } else if (item.type === 'title' && title) {
          if (safeRegexTest(item.regex, title)) { whitelisted = true; break; }
        } else if (item.type === 'text' && snippet) {
          if (safeRegexTest(item.regex, snippet)) { whitelisted = true; break; }
        }
      }
    }

    if (!whitelisted && !blockedInfo) {
      for (const level of subdomainLevels) {
        const entries = compiledRules.domains.get(level);
        if (entries) {
          for (const dm of entries) {
            if (isLocalEntry(dm)) continue;
            if (matchDomainEntryType(dm.type, level, lowerDomain)) { blockedInfo = {rule: dm.originalRule, source: dm.source}; break; }
          }
          if (blockedInfo) break;
        }
      }
      if (!blockedInfo) {
        for (let i = 0; i < compiledRules.urls.length; i++) {
          const item = compiledRules.urls[i];
          if (isLocalEntry(item)) continue;
          if (safeRegexTest(item.regex, url) || safeRegexTest(item.regex, domain)) { blockedInfo = {rule: item.originalRule, source: item.source}; break; }
        }
      }
      if (!blockedInfo && title) {
        for (let i = 0; i < compiledRules.titles.length; i++) {
          const item = compiledRules.titles[i];
          if (isLocalEntry(item)) continue;
          if (safeRegexTest(item.regex, title)) { blockedInfo = {rule: item.originalRule, source: item.source}; break; }
        }
      }
      if (!blockedInfo && snippet) {
        for (let i = 0; i < compiledRules.texts.length; i++) {
          const item = compiledRules.texts[i];
          if (isLocalEntry(item)) continue;
          if (safeRegexTest(item.regex, snippet)) { blockedInfo = {rule: item.originalRule, source: item.source}; break; }
        }
      }
      if (!blockedInfo) {
        for (const level of subdomainLevels) {
          const rules = compiledRules.conditionalDomains.get(level);
          if (rules) {
            for (const ruleObj of rules) {
              if (isLocalEntry(ruleObj)) continue;
              if (matchDomainEntryType(ruleObj.domainType, level, lowerDomain) && checkDynamicConditions(ruleObj.conditions, title, url)) {
                blockedInfo = {rule: ruleObj.originalRule, source: ruleObj.source}; break;
              }
            }
            if (blockedInfo) break;
          }
        }
      }
      if (!blockedInfo) {
        for (let i = 0; i < compiledRules.conditionalRules.length; i++) {
          const ruleObj = compiledRules.conditionalRules[i];
          if (isLocalEntry(ruleObj)) continue;
          if (!checkDynamicConditions(ruleObj.conditions, title, url)) continue;
          if (ruleObj.type === 'expr') { blockedInfo = {rule: ruleObj.originalRule, source: ruleObj.source}; break; }
          if (ruleObj.type === 'url' || ruleObj.type === 'regex') {
            if (safeRegexTest(ruleObj.regex, url) || safeRegexTest(ruleObj.regex, domain)) { blockedInfo = {rule: ruleObj.originalRule, source: ruleObj.source}; break; }
          } else if (ruleObj.type === 'title' && title) {
            if (safeRegexTest(ruleObj.regex, title)) { blockedInfo = {rule: ruleObj.originalRule, source: ruleObj.source}; break; }
          } else if (ruleObj.type === 'text' && snippet) {
            if (safeRegexTest(ruleObj.regex, snippet)) { blockedInfo = {rule: ruleObj.originalRule, source: ruleObj.source}; break; }
          }
        }
      }
    }

    if (highlightN && blockedInfo) return {highlight: highlightN, blocked: true, rule: blockedInfo.rule, source: blockedInfo.source};
    if (highlightN) return {highlight: highlightN};
    if (blockedInfo) return {blocked: true, rule: blockedInfo.rule, source: blockedInfo.source};
    return false;
  }

  function decodeRedirectTarget(raw) {
    if (!raw) return '';
    let value = String(raw);
    try { value = decodeURIComponent(value); } catch (_) {}
    return /^https?:\/\//i.test(value) ? value : '';
  }

  function decodeBingCkTarget(u) {
    if (!u || !u.startsWith('a1')) return '';
    let base64 = u.slice(2).replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) base64 += '=';
    let realUrl = '';
    try {
      if (typeof atob === 'function') {
        const bin = atob(base64);
        if (typeof TextDecoder !== 'undefined') {
          const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
          realUrl = new TextDecoder('utf-8').decode(bytes);
        } else {
          realUrl = decodeURIComponent(escape(bin));
        }
      } else {
        realUrl = Buffer.from(base64, 'base64').toString('utf8');
      }
    } catch (_) { return ''; }
    return /^https?:\/\//i.test(realUrl) ? realUrl : '';
  }

  // 去除重定向
  function unwrapRedirectUrl(url) {
    if (!url) return '';
    try {
      const urlObj = new URL(url);
      const host = urlObj.hostname;
      const path = urlObj.pathname;
      if (/(?:^|\.)bing\.(?:com|[a-z]{2,3}(?:\.[a-z]{2})?)$/i.test(host) && path.startsWith('/ck/a')) {
        const realUrl = decodeBingCkTarget(urlObj.searchParams.get('u'));
        if (realUrl) return realUrl;
      }
      if (/(?:^|\.)scholar\.google\.(?:[a-z]{2,3}(?:\.[a-z]{2})?|[a-z]{4,})$/i.test(host) && /\/scholar_url\/?$/i.test(path)) {
        const realUrl = decodeRedirectTarget(urlObj.searchParams.get('url'));
        if (realUrl) return realUrl;
      }
      if (/(?:^|\.)google\.(?:[a-z]{2,3}(?:\.[a-z]{2})?|[a-z]{4,})$/i.test(host) && path === '/url') {
        const realUrl = decodeRedirectTarget(urlObj.searchParams.get('q') || urlObj.searchParams.get('url'));
        if (realUrl) return realUrl;
      }
      if (/(?:^|\.)(?:duckduckgo\.com|ddg\.gg)$/i.test(host) && /^\/l\/?$/i.test(path)) {
        const realUrl = decodeRedirectTarget(urlObj.searchParams.get('uddg'));
        if (realUrl) return realUrl;
      }
      if (/(?:^|\.)(?:[a-z]{2,3}\.)?(?:r\.)?search\.yahoo\.(?:com|[a-z]{2,3}(?:\.[a-z]{2})?)$/i.test(host)) {
        for (const part of path.split('/')) {
          if (part.startsWith('RU=')) {
            const realUrl = decodeRedirectTarget(part.substring(3));
            if (realUrl) return realUrl;
            break;
          }
        }
      }
    } catch (_) {}
    return url;
  }

  function getCleanUrlAndFixDOM(link) {
    if (!link || !link.href) return '';
    const realUrl = unwrapRedirectUrl(link.href);
    if (realUrl && realUrl !== link.href) link.href = realUrl;
    return realUrl || link.href;
  }

  // 提取链接
  function resolveUrlDomain(link) {
    const rawUrl = getCleanUrlAndFixDOM(link);
    const url = toASCIIUrl(rawUrl) || rawUrl;
    let domain = '';
    try {
      domain = toASCIIHostname(new URL(url).hostname);
    } catch (e) {}
    return { url, domain };
  }

  // 选择器适配
  function getResultText(result, selectors) {
    if (!Array.isArray(selectors)) return '';
    for (let selector of selectors) {
      const elem = result.querySelector(selector);
      if (elem && elem.textContent) return elem.textContent.trim();
    }
    return '';
  }

  function getResultSnippet(result, engine) {
    return getResultText(result, (getSelectors()[engine] || SELECTORS.other).snippets);
  }

  function getResultLink(result, engine) {
    const linkSelectors = (getSelectors()[engine] || SELECTORS.other).links;
    if (Array.isArray(linkSelectors)) {
      for (let selector of linkSelectors) {
        const el = result.querySelector(selector);
        if (el && el.href) return el;
      }
    } else if (typeof linkSelectors === 'string') {
      const el = result.querySelector(linkSelectors);
      if (el && el.href) return el;
    }
    return result.querySelector('a[href]');
  }

  function getResultTitle(result, engine) {
    return getResultText(result, (getSelectors()[engine] || SELECTORS.other).titles);
  }

  function ensurePositioned(el) {
    if (window.getComputedStyle(el).position === 'static') el.style.position = 'relative';
  }

  // 一键屏蔽规则
  function buildBlockRuleOptions(domain) {
    const d = String(domain || '');
    const ipParts = d.split('.');
    const isIP = ipParts.length === 4 && ipParts.every(p => {
      const n = parseInt(p, 10);
      return n >= 0 && n <= 255 && String(n) === p;
    });
    const baseDomain = (!isIP && d.startsWith('www.')) ? d.substring(4) : d;
    const exactRule = `*://${d}/*`;
    const domainRule = isIP ? exactRule : `*://*.${baseDomain}/*`;
    const whitelistRule = `@${exactRule}`;
    return { isIP, domainRule, exactRule, whitelistRule };
  }

  // 添加屏蔽规则
  function applyBlockRule(result, newRule) {
    const stored = GM_getValue(CONFIG_KEY);
    if (stored && Array.isArray(stored.rules)) {
      currentConfig.rules = stored.rules;
    }
    const cleanRule = stripRuleComment(newRule.trim());
    if (!currentConfig.rules.some(rule => stripRuleComment(rule.trim()) === cleanRule)) {
      currentConfig.rules.push(newRule);
      persistConfig(true);
      syncRulesTextarea();
      forceReprocessAll();
    } else {
      result.style.display = 'none';
      result.setAttribute('data-is-blocked', 'true');
      const totalBlocked = document.querySelectorAll('[data-is-blocked="true"]').length;
      updateStatus(totalBlocked);
    }
  }

  // 二次确认面板
  let _blockConfirmOutsideHandler = null;
  function showBlockConfirmPanel(anchor, domain, onConfirm, customOptions = null) {
    injectWidgetStyles();
    if (_blockConfirmOutsideHandler) {
      document.removeEventListener('click', _blockConfirmOutsideHandler, true);
      _blockConfirmOutsideHandler = null;
    }
    const existing = document.getElementById('searchfilter-block-confirm-dialog');
    if (existing) existing.remove();

    const opts = buildBlockRuleOptions(domain);
    const options = customOptions || (opts.isIP
      ? [
          { label: t('bcExact'), rule: opts.exactRule },
          { label: t('bcWhitelist'), rule: opts.whitelistRule }
        ]
          : [
              { label: t('bcDomain'), rule: opts.domainRule },
              { label: t('bcExact'), rule: opts.exactRule },
              { label: t('bcWhitelist'), rule: opts.whitelistRule }
            ]);
    const firstEnabledIdx = options.findIndex(o => !o.disabled);

    const panel = document.createElement('div');
    panel.id = 'searchfilter-block-confirm-dialog';
    panel.innerHTML = `
      <div class="sfb-confirm-domain">${escHtml(domain)}</div>
      ${options.map((o, i) => `
        <label class="sfb-confirm-option${o.disabled ? ' sfb-confirm-option-disabled' : ''}">
          <input type="radio" name="sfb-confirm-rule" value="${i}" ${o.disabled ? 'disabled' : ''} ${i === firstEnabledIdx ? 'checked' : ''}>
          <span class="sfb-confirm-label">${escHtml(o.label)}</span>
          <input type="text" class="sfb-confirm-rule" data-idx="${i}" value="${escHtml(o.rule)}" spellcheck="false" ${o.disabled ? 'disabled' : ''}>
        </label>`).join('')}
      <div class="sfb-confirm-btns">
        <button id="sfb-confirm-ok" class="searchfilter-button searchfilter-button-primary">${t('bcConfirm')}</button>
        <button id="sfb-confirm-cancel" class="searchfilter-button searchfilter-button-secondary">${t('cancel')}</button>
      </div>`;
    document.body.appendChild(panel);

    const rect = anchor.getBoundingClientRect();
    const pw = panel.offsetWidth;
    const ph = panel.offsetHeight;
    let left = Math.min(Math.max(8, rect.right - pw), window.innerWidth - pw - 8);
    if (left < 8) left = 8;
    let top = rect.bottom + 6;
    if (top + ph > window.innerHeight - 8) top = Math.max(8, rect.top - ph - 6);
    panel.style.left = left + 'px';
    panel.style.top = top + 'px';

    const close = () => {
      if (_blockConfirmOutsideHandler) {
        document.removeEventListener('click', _blockConfirmOutsideHandler, true);
        _blockConfirmOutsideHandler = null;
      }
      panel.remove();
    };
    const outsideHandler = (e) => {
      if (!panel.contains(e.target)) close();
    };
    _blockConfirmOutsideHandler = outsideHandler;
    setTimeout(() => {
      if (_blockConfirmOutsideHandler === outsideHandler) {
        document.addEventListener('click', outsideHandler, true);
      }
    }, 200);

    panel.querySelectorAll('.sfb-confirm-rule').forEach(inp => {
      inp.addEventListener('focus', () => {
        const radio = panel.querySelector(`input[type="radio"][value="${inp.getAttribute('data-idx')}"]`);
        if (radio) radio.checked = true;
      });
      inp.addEventListener('click', (e) => e.stopPropagation());
    });

    panel.querySelector('#sfb-confirm-cancel').onclick = (e) => {
      e.stopPropagation();
      close();
    };
    panel.querySelector('#sfb-confirm-ok').onclick = (e) => {
      e.stopPropagation();
      const checked = panel.querySelector('input[type="radio"]:checked');
      const idx = checked ? parseInt(checked.value, 10) : 0;
      const ruleInput = panel.querySelector(`.sfb-confirm-rule[data-idx="${idx}"]`);
      const rule = (ruleInput ? ruleInput.value : '').trim();
      if (!rule) { close(); return; }
      if (!validateRule(rule)) {
        showToast(t('invalidRule'), 'error');
        return;
      }
      const selectedOption = options[idx];
      if (selectedOption && selectedOption.disabled) { close(); return; }
      close();
      onConfirm(rule, selectedOption);
    };
  }

  // 一键屏蔽
  function injectBlockButton(result, engine, url, domain) {
    if (!domain) return;
    if (result.closest('header, [role="navigation"], [role="tablist"], [role="search"], g-scrolling-carousel, #hdtb, #appbar, #searchform, #top_nav')) return;
    if (engine === 'google') {
      if (result.classList.contains('isv-r') || result.querySelector('g-img')) {
        if (!result.querySelector('h3')) return;
      }
      if (!result.closest('#center_col')) return;
    }
    if (engine === 'yandex') {
      if (!result.closest('.main__content, .content, [class*="z6OLDwO9"]')) return;
    }
    const title = getResultTitle(result, engine);
    if (!title) return;
    if (result.querySelector('.searchfilter-quick-block')) return;

    const isBlocked = result.getAttribute('data-is-blocked') === 'true';
    const btn = document.createElement('div');
    btn.className = 'searchfilter-quick-block';

    // 屏蔽按钮
    const iconColor = isBlocked ? '#3182ce' : 'currentColor';
    btn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="${iconColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>`;

    ensurePositioned(result);
    if (engine === 'bing' || engine === 'yandex' || engine === 'brave' || engine === 'yahoo') {
      btn.style.right = '5px';
      btn.style.top = '10px';
    } else {
      btn.style.right = '35px';
      btn.style.top = '10px';
    }

    const stopNavEvents = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };
    btn.addEventListener('mousedown', stopNavEvents, true);
    btn.addEventListener('pointerdown', stopNavEvents, true);
    btn.addEventListener('auxclick', stopNavEvents, true);

    btn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();

      // 误屏蔽确认
      const currentHost = String(window.location.hostname || '').toLowerCase();
      const targetDomain = String(domain || '').toLowerCase();
      if (targetDomain && (currentHost === targetDomain || currentHost.endsWith('.' + targetDomain) || targetDomain.endsWith('.' + currentHost))) {
        showToast(t('cannotBlockCurrentSite', { domain: targetDomain }), 'error');
        return;
      }

      // 取消屏蔽
      if (isBlocked) {
        const opts = buildBlockRuleOptions(domain);
        const whitelistRule = '@' + (currentConfig.blockDomain ? opts.domainRule : opts.exactRule);
        const matchedRule = (result.dataset.matchedRule || '').trim();

        if (currentConfig.blockConfirm) {
          const unblockOptions = [];
          if (matchedRule) {
            const matchedSource = (result.dataset.matchedSource || '').trim();
            const isSubRule = !isLocalEntry({ source: matchedSource });
            unblockOptions.push({ label: isSubRule ? t('bcDeleteSub') : t('bcDelete'), rule: matchedRule, action: 'delete', disabled: isSubRule });
          }
          unblockOptions.push({ label: t('bcWhitelist'), rule: whitelistRule, action: 'whitelist' });

          showBlockConfirmPanel(btn, domain, (chosenRule, selectedOption) => {
            const action = (selectedOption && selectedOption.action) || 'whitelist';
            if (action === 'delete') {
              const cleanTarget = stripRuleComment(chosenRule.trim());
              currentConfig.rules = currentConfig.rules.filter(rule => stripRuleComment(rule.trim()) !== cleanTarget);
            } else {
              if (!currentConfig.rules.some(rule => stripRuleComment(rule.trim()) === chosenRule)) {
                currentConfig.rules.push(chosenRule);
              }
            }
            persistConfig(true);
            syncRulesTextarea();
            forceReprocessAll();
          }, unblockOptions);
          return;
        }

        if (!currentConfig.rules.some(rule => stripRuleComment(rule.trim()) === whitelistRule)) {
          currentConfig.rules.push(whitelistRule);
        }
        persistConfig(true);
        syncRulesTextarea();
        forceReprocessAll();
        return;
      }

      // 添加规则
      const opts = buildBlockRuleOptions(domain);
      if (currentConfig.blockConfirm) {
        showBlockConfirmPanel(btn, domain, (chosenRule) => applyBlockRule(result, chosenRule));
        return;
      }
      applyBlockRule(result, currentConfig.blockDomain ? opts.domainRule : opts.exactRule);
    };
    result.appendChild(btn);
  }

  // 移除标签
  function removeMatchedRuleLabel(result) {
    const label = result.querySelector('.searchfilter-matched-rule');
    if (label) label.remove();
  }

  function clearMatchedData(result) {
    result.removeAttribute('data-matched-rule');
    result.removeAttribute('data-matched-source');
  }

  function resetResultStyles(result) {
    result.removeAttribute('data-blocker-processed');
    result.removeAttribute('data-is-blocked');
    result.removeAttribute('data-is-highlighted');
    result.removeAttribute('data-highlight-n');
    clearMatchedData(result);
    result.classList.remove('searchfilter-blocked-visible');
    result.style.outline = '';
    result.style.outlineOffset = '';
    result.style.display = '';
    removeMatchedRuleLabel(result);
  }

  // 添加标签
  function addMatchedRuleLabel(result) {
    if (!result.dataset.matchedRule) return;
    removeMatchedRuleLabel(result);
    const label = document.createElement('div');
    label.className = 'searchfilter-matched-rule';
    const sourceText = result.dataset.matchedSource || t('matchedRule');
    const ruleText = result.dataset.matchedRule;
    label.textContent = `${sourceText}: ${ruleText}`;
    ensurePositioned(result);
    result.appendChild(label);
  }

  // 屏蔽过滤
  function processSingleResult(result) {
    if (result.closest('.sys_algo_rs, .AlsoTry_M, [data-yga*="sugg"]')) return false;

    if (result.hasAttribute('data-blocker-processed')) {
      return result.getAttribute('data-is-blocked') === 'true';
    }

    if (!currentConfig.enabled) return false;

    const engine = getSearchEngine();
    const link = getResultLink(result, engine);
    if (!link || !link.href) {
      if (currentConfig.debug) {
        console.warn('[屏蔽] 未找到链接，跳过结果:', result.tagName, result.className, result.innerHTML.substring(0, 200));
      }
      return false;
    }

    const { url, domain } = resolveUrlDomain(link);

    const title = getResultTitle(result, engine);
    const snippet = getResultSnippet(result, engine);

    const lowerDomain = domain.toLowerCase();
    const subdomainLevels = getSubdomainLevels(domain);

    const matchResult = checkRuleMatchOptimized(url, domain, title, snippet, subdomainLevels);

    // 黑名单＞高亮
    if (matchResult && matchResult.blocked) {
      result.style.display = showHiddenResults ? '' : 'none';
      result.setAttribute('data-blocker-processed', 'true');
      result.setAttribute('data-is-blocked', 'true');

      // 清除yandex空白条
      if (engine === 'yandex') {
        const timeoutId = setTimeout(() => {
          yandexParentTimeouts.delete(timeoutId);
          const parent = result.parentElement;
          if (parent) {
            const hasVisibleSiblings = Array.from(parent.children).some(sibling => {
              return sibling !== result &&
                sibling.style.display !== 'none' &&
                sibling.getAttribute('data-is-blocked') !== 'true';
            });
            if (!hasVisibleSiblings) {
              parent.style.display = 'none';
              parent.dataset.blockerYandexParent = 'true';
            }
          }
        }, 50);
        yandexParentTimeouts.add(timeoutId);
      }

      result.dataset.matchedRule = matchResult.rule || '';
      result.dataset.matchedSource = matchResult.source || '';
      if (showHiddenResults) {
        result.classList.add('searchfilter-blocked-visible');
        if (currentConfig.showBlockBtn) injectBlockButton(result, engine, url, domain);
        addMatchedRuleLabel(result);
      }
      return true;
    }

    if (matchResult && matchResult.highlight) {
      const matchHL = matchResult.highlight;
      const color = currentConfig.highlightColors[matchHL] || '#CE2029';
      result.style.display = '';
      result.style.outline = `2px solid ${color}`;
      result.style.outlineOffset = '-2px';
      result.classList.remove('searchfilter-blocked-visible');
      result.setAttribute('data-blocker-processed', 'true');
      result.setAttribute('data-is-highlighted', 'true');
      result.setAttribute('data-highlight-n', matchHL);
      result.removeAttribute('data-is-blocked');
      clearMatchedData(result);
      if (currentConfig.showBlockBtn) {
        injectBlockButton(result, engine, url, domain);
      }
      return false;
    }

    clearMatchedData(result);
    result.setAttribute('data-blocker-processed', 'true');
    if (currentConfig.showBlockBtn) injectBlockButton(result, engine, url, domain);
    return false;
  }

  // 视口观察器
  const resultObserver = new IntersectionObserver((entries, observer) => {
    let newlyBlocked = 0;
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const result = entry.target;
        let blocked = false;
        try {
          blocked = processSingleResult(result);
        } catch (e) {
          if (currentConfig.debug) {
            console.error('[屏蔽] 处理结果时出错:', result, e);
          }
          result.setAttribute('data-blocker-processed', 'true');
        }
        if (blocked) newlyBlocked++;
        if (result.hasAttribute('data-blocker-processed')) {
          observer.unobserve(result);
        } else {
          result.removeAttribute('data-observed');
          observer.unobserve(result);
        }
      }
    });

    if (newlyBlocked > 0) {
      const totalBlocked = document.querySelectorAll('[data-is-blocked="true"]').length;
      updateStatus(totalBlocked);
    }
  }, {
    root: null,
    rootMargin: '1000px 0px',
    threshold: 0
  });

  function clearStaleObserved(selector) {
    document.querySelectorAll('[data-observed]').forEach(result => {
      let stillMatches = false;
      try { stillMatches = result.matches(selector); } catch (e) { stillMatches = false; }
      if (stillMatches) return;
      resultObserver.unobserve(result);
      const quickBtn = result.querySelector('.searchfilter-quick-block');
      if (quickBtn) quickBtn.remove();
      resetResultStyles(result);
      result.removeAttribute('data-observed');
    });
  }

  function syncObservedSelector(selector) {
    if (_observedSelector === selector) return;
    _observedSelector = selector;
    clearStaleObserved(selector);
  }

  function filterNestedContainers(nodes) {
    if (!nodes || nodes.length <= 1) return Array.from(nodes || []);
    const arr = Array.from(nodes);
    return arr.filter(el => !arr.some(other => other !== el && other.contains(el)));
  }

  function queryUnobserved(selector) {
    try {
      const nodes = document.querySelectorAll(`:is(${selector}):not([data-observed])`);
      return filterNestedContainers(nodes);
    } catch (e) {
      try {
        const out = [];
        document.querySelectorAll(selector).forEach(el => {
          if (!el.hasAttribute('data-observed')) out.push(el);
        });
        return filterNestedContainers(out);
      } catch (err) {
        return [];
      }
    }
  }

  // 增量扫描
  function scanNewResults() {
    if (!currentConfig.enabled) {
      document.querySelectorAll('[data-blocker-processed], [data-observed]').forEach(result => {
        resultObserver.unobserve(result);
        resetResultStyles(result);
        result.removeAttribute('data-observed');
      });
      showHiddenResults = false;
      _observedSelector = '';
      return;
    }

    const engine = getSearchEngine();
    const selector = getContainerSelector(engine);
    if (!selector) return;
    syncObservedSelector(selector);

    // 调试1
    if (currentConfig.debug) {
      const allMatches = document.querySelectorAll(selector);
      console.log(`[屏蔽] 引擎: ${engine}, 选择器: "${selector}", 匹配数量: ${allMatches.length}`);
      if (allMatches.length > 0) {
        console.log('[屏蔽] 第一个匹配元素:', allMatches[0]);
        console.log('[屏蔽] 第一个元素的 href:', allMatches[0].querySelector('a[href]')?.href);
      } else {
        console.log('[屏蔽] 选择器未匹配到任何元素');
        console.log('[屏蔽] 页面中所有 li:', document.querySelectorAll('li').length);
        console.log('[屏蔽] 页面中所有 article:', document.querySelectorAll('article').length);
        const lis = document.querySelectorAll('li');
        const classes = new Set();
        lis.forEach(li => {
          if (li.className && typeof li.className === 'string') classes.add(li.className);
        });
        console.log('[屏蔽] li 的 class 列表:', [...classes].slice(0, 30));
      }
    }

    const newResults = queryUnobserved(selector);

    if (currentConfig.debug) {
      console.log(`[屏蔽] 未处理的新结果数量: ${newResults.length}`);
    }

    newResults.forEach(result => {
      result.setAttribute('data-observed', 'true');
      resultObserver.observe(result);
    });
  }

  function exposeDebugApi() {
    try {
      if (currentConfig.debug) {
        window.__SERH_DEBUG__ = {
          get config() { return currentConfig; },
          get compiledRules() { return compiledRules; },
          getSearchEngine,
          getSearchCategory,
          getContainerSelector,
          getSubdomainLevels,
          checkRuleMatchOptimized,
          forceReprocessAll
        };
      } else if (window.__SERH_DEBUG__) {
        delete window.__SERH_DEBUG__;
      }
    } catch (_) {}
  }

  function forceReprocessAll() {
    if (!isEngineSite()) return;
    yandexParentTimeouts.forEach(id => clearTimeout(id));
    yandexParentTimeouts.clear();
    buildRuleIndex();
    exposeDebugApi();

    const engine = getSearchEngine();
    const selector = getContainerSelector(engine);
    if (!selector) return;
    syncObservedSelector(selector);

    // 调试2
    if (currentConfig.debug) {
      console.log(`[屏蔽] 引擎: ${engine}, 选择器: "${selector}"`);
      console.log(`[屏蔽] 规则数量: domains=${compiledRules.domains.size}, urls=${compiledRules.urls.length}, titles=${compiledRules.titles.length}, texts=${compiledRules.texts.length}`);
    }

    document.querySelectorAll('.searchfilter-quick-block').forEach(btn => btn.remove());
    document.querySelectorAll('[data-blocker-yandex-parent]').forEach(el => {
      el.style.display = '';
      el.removeAttribute('data-blocker-yandex-parent');
    });

    const newResults = queryUnobserved(selector);
    newResults.forEach(r => r.setAttribute('data-observed', 'true'));

    const batchId = ++forceReprocessBatchId;
    let totalBlocked = 0;
    const allResults = document.querySelectorAll('[data-observed]');
    let processIdx = 0;

    function processBatch() {
      if (batchId !== forceReprocessBatchId) return;
      const batchSize = 30;
      const end = Math.min(processIdx + batchSize, allResults.length);
      for (; processIdx < end; processIdx++) {
        const result = allResults[processIdx];
        resetResultStyles(result);
        try {
          if (processSingleResult(result)) totalBlocked++;
        } catch (e) {
          if (currentConfig.debug) {
            console.error('[屏蔽] 处理结果时出错:', result, e);
          }
          result.setAttribute('data-blocker-processed', 'true');
        }
        if (!result.hasAttribute('data-blocker-processed')) {
          result.removeAttribute('data-observed');
          resultObserver.observe(result);
        }
      }
      if (processIdx < allResults.length) {
        requestAnimationFrame(processBatch);
      } else {
        if (currentConfig.debug) {
          console.log(`[屏蔽] 共屏蔽 ${totalBlocked} 个结果`);
        }
        updateStatus(totalBlocked);
      }
    }
    requestAnimationFrame(processBatch);
  }

  // UI
  const LAYOUT_CSS = `
        /* 预留翻页高度 */
        body { min-height: 101vh !important; }
        #rcnt, #rso { min-height: 60vh; }
  `;

  let widgetStylesInjected = false;
  let _globalStyleEl = null;

  // 组件样式
  function injectWidgetStyles() {
    if (widgetStylesInjected) return;
    widgetStylesInjected = true;
    GM_addStyle(`
        /* 强隔离样式 */
        [id^="searchfilter-"]:not(button) {
            text-align: left !important;
            letter-spacing: normal !important;
            word-spacing: normal !important;
            text-transform: none !important;
            text-indent: 0 !important;
            text-shadow: none !important;
            text-decoration: none !important;
            direction: ltr !important;
            font-style: normal !important;
            font-variant: normal !important;
        }

        #searchfilter-panel, #searchfilter-webdav-panel, #searchfilter-subscription-panel, #searchfilter-selector-panel {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
            font-size: 13px !important;
            box-sizing: border-box !important;
            background: white !important;
            border: 1px solid #e2e8f0 !important;
            border-radius: 8px !important;
            box-shadow: 0 4px 12px rgba(0,0,0,0.08) !important;
            transition: all 0.3s ease;
        }

        /* 强隔离按钮 */
        [id^="searchfilter-"] button,
        .searchfilter-button {
            border: none !important;
            border-radius: 4px !important;
            cursor: pointer !important;
            box-sizing: border-box !important;
            line-height: normal !important;
            letter-spacing: normal !important;
            text-transform: none !important;
            white-space: nowrap !important;
            vertical-align: middle !important;
            appearance: none !important;
            -webkit-appearance: none !important;
            background-image: none !important;
            box-shadow: none !important;
            margin: 0 !important;
            outline: none !important;
            text-shadow: none !important;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
            transition: background-color 0.2s;
        }

        /* 次级小按钮 */
        [id^="searchfilter-"] button:not(.action-button),
        .searchfilter-button:not(.action-button) {
            font-size: 11px !important;
            padding: 4px 8px !important;
            height: auto !important;
            min-height: 0 !important;
            width: auto !important;
            min-width: 0 !important;
            max-width: none !important;
        }
        .searchfilter-button-primary { background: #2c5282 !important; color: #ffffff !important; }
        .searchfilter-button-primary:hover { background: #1a365d !important; color: #ffffff !important; }
        .searchfilter-button-primary:active, .searchfilter-button-primary:focus, .searchfilter-button-primary:focus-visible { background: #15294a !important; color: #ffffff !important; }

        .searchfilter-button-secondary { background: #4a5568 !important; color: #ffffff !important; }
        .searchfilter-button-secondary:hover { background: #2d3748 !important; color: #ffffff !important; }
        .searchfilter-button-secondary:active, .searchfilter-button-secondary:focus, .searchfilter-button-secondary:focus-visible { background: #1a202c !important; color: #ffffff !important; }

        .searchfilter-button-success { background: #276749 !important; color: #ffffff !important; }
        .searchfilter-button-success:hover { background: #22543d !important; color: #ffffff !important; }
        .searchfilter-button-success:active, .searchfilter-button-success:focus, .searchfilter-button-success:focus-visible { background: #1c4532 !important; color: #ffffff !important; }

        .searchfilter-button-danger { background: #c53030 !important; color: #ffffff !important; }
        .searchfilter-button-danger:hover { background: #9b2c2c !important; color: #ffffff !important; }
        .searchfilter-button-danger:active, .searchfilter-button-danger:focus, .searchfilter-button-danger:focus-visible { background: #742a2a !important; color: #ffffff !important; }

        .option-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 10px;
            flex-wrap: wrap;
        }
        .option-label {
            font-size: 12px;
            color: #4a5568;
            white-space: nowrap;
            margin-bottom: 4px;
        }
        .option-buttons {
            display: flex;
            gap: 4px;
            flex-wrap: wrap;
        }
        .option-button {
            padding: 3px 8px;
            font-size: 11px;
            background: #f7fafc;
            border: 1px solid #e2e8f0;
            border-radius: 4px;
            cursor: pointer;
            color: #4a5568;
            box-sizing: border-box;
        }
        .option-button.active {
            background: #2c5282;
            color: white;
            border-color: #2c5282;
        }
        .compact-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
        }
        .action-button {
            padding: 7px 12px !important;
            font-size: 12px !important;
            font-weight: 500 !important;
            box-sizing: border-box !important;
            height: 32px !important;
            min-height: 32px !important;
            line-height: 1 !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            text-align: center !important;
        }

        /* 规则栏输入 */
        .rules-container {
            display: flex;
            border: 1px solid #e2e8f0;
            border-radius: 4px;
            background: #f8fafc;
            height: 190px;
            margin-bottom: 3px;
            position: relative;
            overflow: hidden;
        }

        /* 行号排版锁定 */
        #searchfilter-line-numbers,
        #searchfilter-sel-line-numbers {
            min-width: 20px;
            padding: 8px 4px 8px 2px !important;
            background: #edf2f7;
            border-right: 1px solid #e2e8f0;
            text-align: right !important;
            color: #a0aec0;
            font-family: 'Consolas', 'Monaco', 'Courier New', monospace !important;
            font-size: 11px !important;
            line-height: 15.4px !important;
            white-space: nowrap !important;
            overflow: hidden !important;
            user-select: none !important;
            flex-shrink: 0;
            box-sizing: border-box !important;
        }

        #searchfilter-rules,
        #searchfilter-sel-rules {
            flex: 1;
            height: 100% !important;
            min-height: 0 !important;
            max-height: none !important;
            font-size: 11px !important;
            padding: 8px !important;
            margin: 0 !important;
            border: none !important;
            resize: none !important;
            background: transparent !important;
            box-sizing: border-box !important;
            font-family: 'Consolas', 'Monaco', 'Courier New', monospace !important;
            line-height: 15.4px !important;
            white-space: pre !important;
            overflow-x: auto !important;
            overflow-y: auto !important;
            outline: none !important;
            box-shadow: none !important;
        }

        #searchfilter-rules::-webkit-scrollbar, #searchfilter-sel-rules::-webkit-scrollbar { width: 6px; height: 0px; }
        #searchfilter-rules::-webkit-scrollbar-track, #searchfilter-sel-rules::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 3px; }
        #searchfilter-rules::-webkit-scrollbar-thumb, #searchfilter-sel-rules::-webkit-scrollbar-thumb { background: #c1c1c1; border-radius: 3px; }
        #searchfilter-rules::-webkit-scrollbar-thumb:hover, #searchfilter-sel-rules::-webkit-scrollbar-thumb:hover { background: #a8a8a8; }

        /* 统计面板 */
        #searchfilter-stats-panel {
            position: absolute;
            top: 10px;
            left: 15px;
            right: 15px;
            bottom: 50px;
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.05);
            z-index: 10;
            display: none;
            flex-direction: column;
            overflow: hidden;
            box-sizing: border-box;
        }

        #searchfilter-stats-content {
            padding: 12px;
            overflow-y: auto;
            flex: 1;
            scrollbar-width: thin;
        }

        #searchfilter-stats-content::-webkit-scrollbar { width: 6px; }
        #searchfilter-stats-content::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 3px; }
        #searchfilter-stats-content::-webkit-scrollbar-thumb { background: #c1c1c1; border-radius: 3px; }
        #searchfilter-stats-content::-webkit-scrollbar-thumb:hover { background: #a8a8a8; }

        /* 屏蔽按钮 */
        .searchfilter-quick-block {
            position: absolute;
            cursor: pointer;
            z-index: 99;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
            background: transparent;
            user-select: none;
            color: #2c5282; 
            transition: transform 0.2s;
        }

        .searchfilter-quick-block:hover {
            transform: scale(1.1);
        }

        @media (prefers-color-scheme: dark) {
            .searchfilter-quick-block {
                color: #ffffff;
            }
        }

        /* 屏蔽确认面板 */
        #searchfilter-block-confirm-dialog {
            position: fixed;
            z-index: 10002;
            display: flex;
            flex-direction: column;
            gap: 6px;
            width: 250px;
            max-width: calc(100vw - 16px);
            padding: 8px 10px;
            background: #ffffff;
            color: #2d3748;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 12px;
            text-align: left;
            line-height: 1.4;
            box-sizing: border-box;
        }
        #searchfilter-block-confirm-dialog .sfb-confirm-domain {
            font-size: 11px;
            color: #718096;
            word-break: break-all;
            margin-bottom: 2px;
        }
        #searchfilter-block-confirm-dialog .sfb-confirm-option {
            display: flex;
            align-items: center;
            gap: 6px;
            cursor: pointer;
            margin: 0;
            padding: 0;
            border: none;
            background: transparent;
            font-weight: normal;
            white-space: nowrap;
        }
        /* 开关控件防污染 */
        #searchfilter-block-confirm-dialog .sfb-confirm-option input[type="radio"] {
            margin: 0 !important;
            padding: 0 !important;
            flex-shrink: 0 !important;
            accent-color: #2c5282 !important;
            cursor: pointer !important;
            width: auto !important;
            height: auto !important;
            min-width: 0 !important;
            appearance: auto !important;
            -webkit-appearance: auto !important;
            display: inline-block !important;
        }
        #searchfilter-block-confirm-dialog .sfb-confirm-option-disabled {
            cursor: not-allowed;
            opacity: 0.6;
        }
        #searchfilter-block-confirm-dialog .sfb-confirm-option-disabled input[type="radio"] {
            cursor: not-allowed !important;
        }
        #searchfilter-block-confirm-dialog .sfb-confirm-option-disabled .sfb-confirm-rule {
            background: #edf2f7;
            color: #a0aec0;
        }

        .searchfilter-switch input[type="checkbox"] {
            opacity: 0 !important;
            width: 0 !important;
            height: 0 !important;
            min-width: 0 !important;
            max-width: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            position: absolute !important;
            pointer-events: none !important;
            appearance: none !important;
            -webkit-appearance: none !important;
            border: none !important;
        }
        #searchfilter-block-confirm-dialog .sfb-confirm-label {
            flex-shrink: 0;
            min-width: 36px;
            white-space: nowrap;
            font-size: 12px;
        }
        #searchfilter-block-confirm-dialog .sfb-confirm-rule {
            flex: 1;
            min-width: 0;
            padding: 3px 6px;
            border: 1px solid #e2e8f0;
            border-radius: 4px;
            font-size: 11px;
            font-family: 'Consolas', 'Monaco', monospace;
            background: #f7fafc;
            color: #2d3748;
            outline: none;
            box-shadow: none;
            height: auto;
            box-sizing: border-box;
        }
        #searchfilter-block-confirm-dialog .sfb-confirm-rule:focus {
            border-color: #3182ce;
            background: #ffffff;
        }
        #searchfilter-block-confirm-dialog .sfb-confirm-btns {
            display: flex;
            gap: 6px;
            justify-content: flex-end;
            margin-top: 4px;
        }
        #searchfilter-block-confirm-dialog .sfb-confirm-btns .searchfilter-button {
            height: 24px;
            padding: 0 10px;
            font-size: 11px;
        }
        @media (prefers-color-scheme: dark) {
            #searchfilter-block-confirm-dialog {
                background: #171717;
                color: #f3f4f6;
                border-color: #374151;
                box-shadow: 0 4px 12px rgba(0,0,0,0.5);
            }
            #searchfilter-block-confirm-dialog .sfb-confirm-rule {
                background: #374151;
                border-color: #4b5563;
                color: #f3f4f6;
            }
            #searchfilter-block-confirm-dialog .sfb-confirm-rule:focus {
                border-color: #60a5fa;
                background: #374151;
            }
            #searchfilter-block-confirm-dialog .sfb-confirm-option-disabled .sfb-confirm-rule {
                background: #1f2937;
                color: #6b7280;
            }
        }

        /* 快速滑动按钮 */
        .searchfilter-scroll-btn {
            position: absolute;
            right: 7px;
            cursor: pointer;
            opacity: 0.5;
            font-size: 18px !important;
            line-height: 1 !important;
            user-select: none !important;
            transition: opacity 0.2s, transform 0.2s;
            background: transparent !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
            z-index: 10;
        }

        .searchfilter-scroll-btn:hover { opacity: 1; transform: scale(1.2); }
        .searchfilter-quick-block:hover { transform: scale(1.1); opacity: 1; }

        /* 非正文区域隐藏按钮 */
        .isv-r .searchfilter-quick-block, 
        .image-section .searchfilter-quick-block,
        g-img .searchfilter-quick-block,
        .is-extra-container .searchfilter-quick-block { display: none !important; }
        header .searchfilter-quick-block,
        [role="navigation"] .searchfilter-quick-block,
        [role="tablist"] .searchfilter-quick-block,
        [role="search"] .searchfilter-quick-block,
        g-scrolling-carousel .searchfilter-quick-block,
        #hdtb .searchfilter-quick-block,
        #appbar .searchfilter-quick-block,
        #searchform .searchfilter-quick-block,
        #top_nav .searchfilter-quick-block,
        #extabar .searchfilter-quick-block { display: none !important; }

        /* 面板隔离 */
        #searchfilter-webdav-panel,
        #searchfilter-subscription-panel {
            height: 332px;
            overflow: visible;
        }

        #searchfilter-webdav-panel #searchfilter-toast-container,
        #searchfilter-subscription-panel #searchfilter-toast-container,
        #searchfilter-selector-panel #searchfilter-toast-container {
            max-width: none;
            width: auto;
            left: 0;
            right: 0;
        }

        #searchfilter-panel,
        #searchfilter-webdav-panel,
        #searchfilter-subscription-panel,
        #searchfilter-hlcolor-panel {
        box-sizing: border-box !important;
        background: #ffffff !important;
        color: #2d3748 !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        border: 1px solid #e2e8f0 !important;
        border-radius: 8px !important;
        box-shadow: 0 4px 12px rgba(0,0,0,0.08) !important;
        text-align: left !important;
        line-height: 1.5 !important;
        }

        #searchfilter-panel *,
        #searchfilter-webdav-panel *,
        #searchfilter-subscription-panel *,
        #searchfilter-selector-panel *,
        #searchfilter-hlcolor-panel * {
        box-sizing: border-box !important;
        }

        /* 主面板深色 */
        @media (prefers-color-scheme: dark) {
        #searchfilter-panel {
        background: #171717 !important; 
        color: #f3f4f6 !important; 
        border-color: #374151 !important;
        box-shadow: 0 4px 12px rgba(0,0,0,0.5) !important;
        }

        #searchfilter-panel .option-label,
        #searchfilter-panel .compact-row span {
            color: #9ca3af !important;
        }

        #searchfilter-panel .rules-container,
        #searchfilter-selector-panel .rules-container {
            border-color: #4b5563 !important;
            background: #1E1F21 !important;
        }

        #searchfilter-line-numbers,
        #searchfilter-sel-line-numbers {
            background: #222629 !important;
            border-right-color: #4b5563 !important;
            color: #9ca3af !important;
        }

        #searchfilter-rules,
        #searchfilter-sel-rules {
            background: #1E1F21 !important;
            color: #f3f4f6 !important;
        }

        #searchfilter-rules::placeholder {
            color: #6b7280 !important;
        }

        /* 统计面板深色 */
        #searchfilter-stats-panel {
            background: #171717 !important;
            border-color: #374151 !important;
        }
        #searchfilter-stats-content {
            color: #f3f4f6 !important;
        }

        #searchfilter-panel .compact-row button.searchfilter-button {
            height: auto !important;
            min-height: 0 !important;
            width: auto !important;
            min-width: 0 !important;
            flex: 0 0 auto !important;
            line-height: normal !important;
            padding: 3px 8px !important;
            font-size: 11px !important;
            margin: 0 !important;
        }
        }

        #searchfilter-webdav-panel *,
        #searchfilter-subscription-panel * {
            box-sizing: border-box !important;
        }

        #searchfilter-webdav-panel h3,
        #searchfilter-subscription-panel h3,
        #searchfilter-hlcolor-panel h3 {
            margin: 0 0 8px 0 !important;
            font-size: 14px !important;
            color: inherit !important;
            font-weight: 600 !important;
            padding: 0 !important;
            border: none !important;
            background: transparent !important;
            letter-spacing: normal !important;
        }

        #searchfilter-selector-panel h3 {
            margin: 0 !important;
            font-size: 14px !important;
            color: inherit !important;
            font-weight: 600 !important;
            padding: 0 !important;
            border: none !important;
            background: transparent !important;
            letter-spacing: normal !important;
            line-height: 1.2 !important;
        }

        #searchfilter-webdav-panel .webdav-row {
            margin-bottom: 8px !important;
            padding: 0 !important;
            border: none !important;
            background: transparent !important;
            display: block !important;
        }

        #searchfilter-webdav-panel label,
        #searchfilter-subscription-panel label {
            display: block !important;
            margin: 0 0 4px 0 !important;
            color: #4a5568 !important;
            font-size: 12px !important;
            font-weight: normal !important;
            line-height: 1.2 !important;
        }

        #searchfilter-webdav-panel input[type="text"],
        #searchfilter-webdav-panel input[type="password"],
        #searchfilter-subscription-panel input[type="text"] {
            width: 100% !important;
            padding: 6px 8px !important;
            margin: 0 !important;
            border: 1px solid #e2e8f0 !important;
            border-radius: 4px !important;
            font-size: 13px !important;
            background: #ffffff !important;
            color: #2d3748 !important;
            height: 30px !important;
            line-height: normal !important;
            box-shadow: none !important;
            outline: none !important;
            display: block !important;
        }

        #searchfilter-webdav-panel input:focus,
        #searchfilter-subscription-panel input:focus {
            border-color: #3182ce !important;
        }

        #searchfilter-webdav-panel .webdav-btn-group {
            display: flex !important;
            gap: 8px !important;
            justify-content: flex-end !important;
            margin-top: 12px !important;
        }

        #searchfilter-webdav-panel .searchfilter-button,
        #searchfilter-subscription-panel .searchfilter-button,
        #searchfilter-hlcolor-panel .searchfilter-button,
        #searchfilter-panel .action-button,
        #searchfilter-selector-panel .action-button {
            height: 30px !important;
            min-height: 30px !important;
            max-height: 30px !important;
            padding: 0 12px !important;
            font-size: 13px !important;
            font-weight: 500 !important;
            box-sizing: border-box !important;
            margin: 0 !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            text-align: center !important;
            line-height: 1 !important;
            border: none !important;
            border-radius: 4px !important;
            appearance: none !important;
            -webkit-appearance: none !important;
            box-shadow: none !important;
            background-image: none !important;
        }
        
        #searchfilter-webdav-panel .searchfilter-button {
            flex: 1 !important;
        }

        /* Webdav订阅面板深色 */
        @media (prefers-color-scheme: dark) {
            #searchfilter-webdav-panel,
            #searchfilter-subscription-panel,
            #searchfilter-selector-panel,
            #searchfilter-hlcolor-panel {
                background: #171717 !important;
                color: #f3f4f6 !important;
                border-color: #374151 !important;
                box-shadow: 0 4px 12px rgba(0,0,0,0.5) !important;
            }

            #searchfilter-webdav-panel label,
            #searchfilter-subscription-panel label,
            #searchfilter-hlcolor-panel .hlcolor-row label {
                color: #9ca3af !important; 
            }

            #searchfilter-webdav-panel input[type="text"],
            #searchfilter-webdav-panel input[type="password"],
            #searchfilter-subscription-panel input[type="text"],
            #searchfilter-hlcolor-panel .hlcolor-row input {
                background: #374151 !important;
                border-color: #4b5563 !important;
                color: #f3f4f6 !important;
            }

            #searchfilter-webdav-panel input:focus,
            #searchfilter-subscription-panel input:focus,
            #searchfilter-hlcolor-panel .hlcolor-row input:focus {
                border-color: #60a5fa !important;
            }
            #searchfilter-hlcolor-panel .hlcolor-row .hlcolor-preview {
                border-color: #4b5563 !important;
            }
            #hlcolor-current-preview {
                border-color: #4b5563 !important;
            }
            #hlcolor-sv-canvas, #hlcolor-hue-canvas {
                border-color: #4b5563 !important;
            }
            #searchfilter-hlcolor-panel .hlcolor-current-code {
                background: #374151 !important;
                border-color: #4b5563 !important;
                color: #f3f4f6 !important;
            }
        }

        /* 面板渐入渐出动画 */
        .searchfilter-panel-fade {
            opacity: 0;
            transform: translate(-50%, -48%);
            transition: opacity 0.1s ease, transform 0.1s ease;
        }
        .searchfilter-panel-fade.show {
            opacity: 1;
            transform: translate(-50%, -50%);
        }

        #searchfilter-panel:not(.searchfilter-panel-fade) {
            transition: opacity 0.1s ease;
        }
        #searchfilter-webdav-panel:not(.searchfilter-panel-fade) {
            transition: opacity 0.1s ease;
        }
        #searchfilter-subscription-panel:not(.searchfilter-panel-fade) {
            transition: opacity 0.1s ease;
        }
        #searchfilter-hlcolor-panel:not(.searchfilter-panel-fade) {
            transition: opacity 0.1s ease;
        }

        /* 订阅布局 */
        .subscription-panel-header {
            flex-shrink: 0;
        }
        .subscription-panel-header h3 {
            margin: 0 !important;
        }
        #subscription-rows-container {
            flex: 1;
            min-height: 0;
            overflow-y: auto;
            overflow-x: hidden;
            scrollbar-width: thin;
            padding-right: 2px;
        }
        #subscription-rows-container::-webkit-scrollbar { width: 6px; }
        #subscription-rows-container::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 3px; }
        #subscription-rows-container::-webkit-scrollbar-thumb { background: #c1c1c1; border-radius: 3px; }
        #subscription-rows-container::-webkit-scrollbar-thumb:hover { background: #a8a8a8; }
        .subscription-row {
            display: flex;
            flex-direction: column;
            margin-bottom: 0;
        }
        .subscription-meta-row {
            display: flex;
            align-items: center;
            margin: 2px 0 2px 0;
            min-height: 14px;
        }
        .subscription-index {
            font-size: 12px;
            color: #4a5568;
            flex-shrink: 0;
            line-height: 1.2;
        }
        .subscription-info {
            font-size: 11px;
            color: #718096;
            white-space: nowrap;
            line-height: 1.2;
            margin-left: auto;
            margin-right: 40px;
        }
        .subscription-input-row {
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .subscription-input-row input {
            flex: 1;
            margin: 0;
        }
        .delete-subscription-btn {
            background: none;
            border: none;
            font-size: 16px;
            cursor: pointer;
            color: #c53030;
            padding: 0 4px;
            opacity: 0.7;
            transition: opacity 0.2s;
        }
        .delete-subscription-btn:hover {
            opacity: 1;
        }
        .subscription-status-message {
            font-size: 11px;
            color: #4a5568;
            margin-left: 8px;
            line-height: 1.2;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .subscription-status-message.success {
            color: #276749;
        }
        .subscription-status-message.error {
            color: #c53030;
        }
        .subscription-btn-group {
            display: flex;
            gap: 8px;
            justify-content: flex-end;
            margin-top: 12px;
            flex-shrink: 0;
        }
        .subscription-btn-group .searchfilter-button {
            flex: 1 !important;
        }
        @media (prefers-color-scheme: dark) {
            .subscription-index {
                color: #9ca3af;
            }
            .subscription-info {
                color: #9ca3af;
            }
        }

        /* 屏蔽结果灰底 */
        .searchfilter-blocked-visible,
        .g.searchfilter-blocked-visible,
        .MjjYud.searchfilter-blocked-visible {
            background-color: #d1d5db !important;
            border-radius: 8px !important;
            padding: 8px !important;
            transition: background 0.2s;
        }

        @media (prefers-color-scheme: dark) {
            .searchfilter-blocked-visible,
            .g.searchfilter-blocked-visible,
            .MjjYud.searchfilter-blocked-visible {
                background-color: #374151 !important; 
            }
        }

        .searchfilter-blocked-visible div,
        .searchfilter-blocked-visible .yuRUbf,
        .searchfilter-blocked-visible div[data-sokoban-container],
        .searchfilter-blocked-visible div[data-snc] {
            background-color: transparent !important;
            background: transparent !important;
            background-image: none !important;
        }

        .bubble-number {
        color: #000000 !important;
        }

        /* 匹配规则标签 */
        .searchfilter-matched-rule {
            position: absolute;
            top: 2px;
            left: 50%;
            transform: translateX(-50%);
            max-width: calc(100% - 70px);
            background: rgba(0, 0, 0, 0.2);
            color: #000000;
            font-size: 12px;
            padding: 2px 8px;
            border-radius: 4px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            z-index: 98;
            pointer-events: none;
            font-family: monospace;
            backdrop-filter: blur(2px);
            box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        }
        @media (prefers-color-scheme: dark) {
            .searchfilter-matched-rule {
                background: rgba(0, 160, 0, 0.9);
                color: #fff;
            }
        }

        /* 高亮边框 */
        #searchfilter-hlcolor-panel .hlcolor-row {
            margin-bottom: 2px !important;
            padding: 0 !important;
            border: none !important;
            background: transparent !important;
            display: flex !important;
            align-items: center !important;
            gap: 4px !important;
        }
        #searchfilter-hlcolor-panel .hlcolor-row label {
            min-width: 20px !important;
            font-size: 12px !important;
            color: #4a5568 !important;
            font-weight: 600 !important;
            margin: 0 !important;
            line-height: 1.2 !important;
        }
        #searchfilter-hlcolor-panel .hlcolor-row .hlcolor-preview {
            width: 12px !important;
            height: 12px !important;
            border-radius: 2px !important;
            border: 1px solid #e2e8f0 !important;
            flex-shrink: 0 !important;
        }
        #searchfilter-hlcolor-panel .hlcolor-row input {
            width: 70px !important;
            flex: none !important;
            padding: 2px 4px !important;
            margin: 0 !important;
            border: 1px solid #e2e8f0 !important;
            border-radius: 3px !important;
            font-size: 11px !important;
            font-family: 'Consolas', monospace !important;
            background: #ffffff !important;
            color: #2d3748 !important;
            height: 20px !important;
            line-height: normal !important;
            box-shadow: none !important;
            outline: none !important;
        }
        #searchfilter-hlcolor-panel .hlcolor-row input:focus {
            border-color: #3182ce !important;
        }
        #searchfilter-hlcolor-panel .hlcolor-picker-wrapper {
            display: flex !important;
            align-items: stretch !important;
            margin: 0 !important;
        }
        #hlcolor-sv-canvas, #hlcolor-hue-canvas {
            cursor: crosshair !important;
            border-radius: 3px !important;
            border: 1px solid #e2e8f0 !important;
        }
        #searchfilter-hlcolor-panel .hlcolor-current-code {
            font-size: 12px !important;
            font-family: 'Consolas', monospace !important;
            padding: 2px 4px !important;
            user-select: text !important;
            text-align: center !important;
            background: #f7fafc !important;
            border-radius: 3px !important;
            border: 1px solid #e2e8f0 !important;
            margin-bottom: 2px !important;
        }
        #hlcolor-current-preview {
            flex-shrink: 0 !important;
        }

        /* 开关样式 */
        .searchfilter-switch {
            position: relative;
            display: inline-block;
            width: 28px;
            height: 16px;
            margin-right: 6px;
            flex-shrink: 0;
        }

        .searchfilter-switch input {
            opacity: 0;
            width: 0;
            height: 0;
            position: absolute;
        }

        .searchfilter-slider {
            position: absolute;
            cursor: pointer;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: #cbd5e0;
            transition: .2s;
            border-radius: 16px;
        }

        .searchfilter-slider:before {
            position: absolute;
            content: "";
            height: 12px;
            width: 12px;
            left: 2px;
            bottom: 2px;
            background-color: white;
            transition: .2s;
            border-radius: 50%;
        }

        .searchfilter-switch input:checked + .searchfilter-slider {
            background-color: #2c5282;
        }

        .searchfilter-switch input:checked + .searchfilter-slider:before {
            transform: translateX(12px);
        }

        /* 暗色模式适配 */
        @media (prefers-color-scheme: dark) {
            .searchfilter-slider {
                background-color: #4b5563;
            }
            .searchfilter-switch input:checked + .searchfilter-slider {
                background-color: #2c5282;
            }
        }

        /* 悬浮球大小滑条 */
        #searchfilter-bubble-size-slider::-webkit-slider-thumb {
            -webkit-appearance: none;
            width: 14px;
            height: 14px;
            border-radius: 50%;
            background: #2c5282;
            cursor: pointer;
        }
        #searchfilter-bubble-size-slider::-moz-range-thumb {
            width: 14px;
            height: 14px;
            border-radius: 50%;
            background: #2c5282;
            cursor: pointer;
            border: none;
        }

        /* 悬浮通知 */
        #searchfilter-toast-container {
            position: fixed;
            top: 15px;
            right: 15px;
            z-index: 2147483647;
            display: flex;
            flex-direction: column;
            align-items: stretch;
            gap: 8px;
            pointer-events: none;
            max-width: min(320px, calc(100vw - 16px));
        }

        .searchfilter-toast {
            pointer-events: auto;
            box-sizing: border-box;
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-left: 3px solid #2c5282;
            border-radius: 6px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.12);
            color: #2d3748;
            font-size: 12px;
            line-height: 1.4;
            padding: 8px 12px;
            word-break: break-all;
            cursor: pointer;
            opacity: 0;
            transform: translateY(8px);
            transition: opacity 0.25s ease, transform 0.25s ease;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .searchfilter-toast.show {
            opacity: 1;
            transform: translateY(0);
        }

        @media (prefers-color-scheme: dark) {
            .searchfilter-toast {
                background: #171717 !important;
                color: #f3f4f6 !important;
                border-color: #374151;
            }
        }

        .searchfilter-toast-success { border-left-color: #276749; }
        .searchfilter-toast-error { border-left-color: #c53030; }
        .searchfilter-toast-info { border-left-color: #2c5282; }
    `);
  }

  // 仅内置引擎注入布局
  function injectGlobalStyles() {
    const engine = getSearchEngine();
    const applyLayout = engine !== 'other' && !!SELECTORS[engine];
    if (applyLayout) {
      if (!_globalStyleEl) {
        const el = GM_addStyle(LAYOUT_CSS);
        if (el && typeof el.remove === 'function') _globalStyleEl = el;
      }
    } else if (_globalStyleEl) {
      _globalStyleEl.remove();
      _globalStyleEl = null;
    }
    injectWidgetStyles();
  }

  function removeGlobalStyles() {
    if (_globalStyleEl) {
      _globalStyleEl.remove();
      _globalStyleEl = null;
    }
  }

  // 悬浮球样式
  function applyBubbleStyle(element) {
    element.style.cssText = `
            position: fixed;
            background: transparent;
            color: #2c5282;
            border-radius: 4px;
            z-index: 10000;
            cursor: grab;
            font-weight: bold;
            user-select: none;
            transition: opacity 0.2s, text-shadow 0.2s, transform 0.2s;
            opacity: 0.8;
            font-family: Arial, sans-serif;
            text-align: center;
            box-sizing: border-box;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
  }

  // 悬浮球大小
  function getBubbleSize() {
    let size = 20;
    if (typeof currentConfig.bubbleSize === 'number') {
      size = currentConfig.bubbleSize;
    } else {
      switch (currentConfig.bubbleSize) {
        case 'medium': size = 18; break;
        case 'large': size = 20; break;
        case 'larger': size = 22; break;
        case 'xlarge': size = 26; break;
        default:
          const parsed = parseInt(currentConfig.bubbleSize);
          size = isNaN(parsed) ? 20 : parsed;
      }
    }
    return Math.max(15, Math.min(40, size));
  }

  function applyBubbleSize(element) {
    const size = getBubbleSize();
    element.style.fontSize = size + 'px';
    element.style.padding = '5px 5px';
    element.style.lineHeight = (1 + (size - 12) * 0.015).toFixed(2);
  }

  // 悬浮球内容
  function updateBubbleContent(statusBtn, blocked) {
    const isLeft = currentConfig.bubbleState ? currentConfig.bubbleState.isLeftHalf : false;
    const isToggleMode = currentConfig.bubbleAction === 'toggleHidden';

    const bubbleIcon = (inner) => `<span style="display: inline-block; width: 1em; height: 1em; vertical-align: -0.15em; flex-shrink: 0; line-height: 0;"><svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg></span>`;
    const icon = isToggleMode
      ? bubbleIcon('<circle cx="12" cy="12" r="10"/>')
      : bubbleIcon('<circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>');

    let newHtml;
    if (currentConfig.showCount) {
      if (isLeft) {
        newHtml = `${icon} <span class="bubble-number">${blocked}</span>`;
      } else {
        newHtml = `<span class="bubble-number">${blocked}</span> ${icon}`;
      }
    } else {
      newHtml = icon;
    }
    if (statusBtn._lastHtml !== newHtml) {
      statusBtn.innerHTML = newHtml;
      statusBtn._lastHtml = newHtml;
    }
  }

  // 拖动与边缘吸附
  function updateStatus(blocked) {
    if (!isEngineSite()) return;
    function applyBubbleStatePosition(el) {
      if (!currentConfig.bubbleState) return;
      el.style.top = currentConfig.bubbleState.top || 'auto';
      el.style.left = currentConfig.bubbleState.left || 'auto';
      el.style.right = currentConfig.bubbleState.right || 'auto';
      el.style.bottom = 'auto';
    }
    if (!currentConfig.showBubble) {
      const status = document.getElementById('searchfilter-status');
      if (status) status.remove();
      return;
    }

    let status = document.getElementById('searchfilter-status');
    if (!status) {
      status = document.createElement('div');
      status.id = 'searchfilter-status';
      applyBubbleStyle(status);

      let isDragging = false;
      let startX, startY, initialLeft, initialTop;
      let dragStartTime = 0;

      // 长按定时器
      let longPressTimer = null;
      let hasLongPressed = false;

      status.addEventListener('mousedown', startDrag);
      status.addEventListener('touchstart', startDrag, {
        passive: false
      });

      function startDrag(e) {
        if (e.type === 'touchstart') {
          e.preventDefault();
          e.stopPropagation();
        }
        if (e.type === 'mousedown' && e.button !== 0) return;

        isDragging = false;
        hasLongPressed = false;
        dragStartTime = Date.now();

        if (longPressTimer) clearTimeout(longPressTimer);

        const clientX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
        const clientY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;
        startX = clientX;
        startY = clientY;
        const rect = status.getBoundingClientRect();
        initialLeft = rect.left;
        initialTop = rect.top;
        status.style.transition = 'none';
        status.style.cursor = 'grabbing';
        status.style.bottom = 'auto';
        status.style.right = 'auto';
        status.style.top = initialTop + 'px';
        status.style.left = initialLeft + 'px';
        document.addEventListener('mousemove', onDrag);
        document.addEventListener('mouseup', endDrag);
        document.addEventListener('touchmove', onDrag, {
          passive: false
        });
        document.addEventListener('touchend', endDrag);

        // 判断长按触发
        if (currentConfig.bubbleAction === 'toggleHidden') {
          longPressTimer = setTimeout(() => {
            if (!isDragging) {
              hasLongPressed = true;
              status.style.transform = 'scale(1.15)';
              setTimeout(() => {
                status.style.transform = 'scale(1)';
              }, 200);

              showConfigPanel();
            }
          }, 600);
        }
      }

      function onDrag(e) {
        if (hasLongPressed) return;

        const clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
        const clientY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;
        const dx = clientX - startX;
        const dy = clientY - startY;

        if (!isDragging && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
          isDragging = true;
          if (longPressTimer) clearTimeout(longPressTimer);
        }

        if (isDragging) {
          if (e.type === 'touchmove') e.preventDefault();
          let newLeft = initialLeft + dx;
          let newTop = initialTop + dy;
          newLeft = Math.max(0, Math.min(window.innerWidth - status.offsetWidth, newLeft));
          newTop = Math.max(0, Math.min(window.innerHeight - status.offsetHeight, newTop));
          status.style.left = newLeft + 'px';
          status.style.top = newTop + 'px';
        }
      }

      function endDrag(e) {
        if (longPressTimer) clearTimeout(longPressTimer);

        if (e.type === 'touchend') e.preventDefault();
        document.removeEventListener('mousemove', onDrag);
        document.removeEventListener('mouseup', endDrag);
        document.removeEventListener('touchmove', onDrag);
        document.removeEventListener('touchend', endDrag);
        status.style.cursor = 'grab';
        status.style.transition = 'opacity 0.2s, text-shadow 0.2s, transform 0.2s, left 0.3s ease, right 0.3s ease, top 0.3s ease, color 0.2s';

        if (isDragging) {
          const rect = status.getBoundingClientRect();
          const centerX = rect.left + rect.width / 2;
          const isLeftHalf = centerX < window.innerWidth / 2;
          if (isLeftHalf) {
            status.style.left = '5px';
            status.style.right = 'auto';
          } else {
            status.style.left = 'auto';
            status.style.right = '5px';
          }
          let newTop = rect.top;
          if (newTop < 5) newTop = 5;
          if (newTop + rect.height > window.innerHeight - 5) newTop = window.innerHeight - rect.height - 5;
          status.style.top = newTop + 'px';
          currentConfig.bubbleState = {
            top: status.style.top,
            left: status.style.left,
            right: status.style.right,
            isLeftHalf
          };
          persistConfig();
          updateBubbleContent(status, parseInt(status.dataset.blockedCount || 0));
        } else {
          applyBubbleStatePosition(status);

          // 判断短按点击
          if (!hasLongPressed && Date.now() - dragStartTime < 300) {
            if (currentConfig.bubbleAction === 'openPanel') {
              setTimeout(() => {
                showConfigPanel();
              }, 50);
            } else {
              toggleHiddenResults();
            }
          }
        }
      }

      document.body.appendChild(status);

      if (currentConfig.bubbleState) {
        applyBubbleStatePosition(status);
      } else {
        status.style.top = (window.innerHeight - 60) + 'px';
        status.style.right = '5px';
        status.style.left = 'auto';
        status.style.bottom = 'auto';
      }
    }

    applyBubbleSize(status);
    status.dataset.blockedCount = blocked;
    updateBubbleContent(status, blocked);
  }

  // 悬浮球切换
  function toggleHiddenResults() {
    showHiddenResults = !showHiddenResults;
    document.querySelectorAll('[data-is-blocked="true"]').forEach(el => {
      el.style.display = showHiddenResults ? '' : 'none';
      if (showHiddenResults) {
        if (el.parentElement && el.parentElement.style.display === 'none') {
          el.parentElement.style.display = '';
        }
        el.classList.add('searchfilter-blocked-visible');
        const engine = getSearchEngine();
        const link = getResultLink(el, engine);
        if (link && link.href && currentConfig.showBlockBtn) {
          const { url, domain } = resolveUrlDomain(link);
          if (!el.querySelector('.searchfilter-quick-block')) {
            injectBlockButton(el, engine, url, domain);
          }
        }
        addMatchedRuleLabel(el);
      } else {
        el.classList.remove('searchfilter-blocked-visible');
        removeMatchedRuleLabel(el);
      }
    });
    const status = document.getElementById('searchfilter-status');
    if (status) {
      updateBubbleContent(status, parseInt(status.dataset.blockedCount || 0));
    }
  }

  // 行号与语法检查
  let _lineUpdatePending = false;
  let _lineUpdateDirty = false;
  let _lineChunkToken = 0;
  const LINE_NUM_CHUNK = 200;

  function updateLineNumbersIncremental() {
    const textarea = document.getElementById('searchfilter-rules');
    const lineNums = document.getElementById('searchfilter-line-numbers');
    if (!textarea || !lineNums) {
      _lineUpdatePending = false;
      return;
    }

    const lines = textarea.value.split('\n');
    const len = lines.length;
    const token = ++_lineChunkToken;

    lineNums.style.minWidth = `max(20px, calc(${String(len).length}ch + 8px))`;

    let index = 0;
    const step = () => {
      if (token !== _lineChunkToken) return;
      if (!lineNums.isConnected) {
        _lineUpdatePending = false;
        _lineUpdateDirty = false;
        return;
      }

      const children = lineNums.children;
      while (children.length > len) {
        lineNums.removeChild(children[children.length - 1]);
      }

      const end = Math.min(index + LINE_NUM_CHUNK, len);
      const frag = document.createDocumentFragment();
      for (let i = index; i < end; i++) {
        let node = children[i];
        if (!node) {
          node = document.createElement('div');
          node.style.position = 'relative';
          node.style.color = '#a0aec0';
          node.style.height = '1.4em';
          frag.appendChild(node);
        }
        const analysis = currentConfig.errorDetection !== false ? cachedAnalyzeRule(lines[i]) : { valid: true, errors: [], warnings: [] };
        const valid = analysis.valid;
        const errMsg = valid ? '' : analysis.errors.join(' | ');
        const html = `${i + 1}${valid ? '' : `<span class="searchfilter-line-error" title="${escHtml(errMsg)}" data-error="${escHtml(errMsg)}" style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); font-size: 10px; background: #edf2f7; z-index: 1; cursor: pointer;">⚠️</span>`}`;
        if (node.dataset.v !== html) {
          node.innerHTML = html;
          node.dataset.v = html;
        }
      }
      if (frag.childNodes.length > 0) {
        lineNums.appendChild(frag);
      }

      index = end;
      if (index < len) {
        requestAnimationFrame(step);
        return;
      }

      if (_lineUpdateDirty) {
        _lineUpdateDirty = false;
        requestAnimationFrame(updateLineNumbersIncremental);
      } else {
        _lineUpdatePending = false;
      }
    };
    requestAnimationFrame(step);
  }

  function scheduleLineNumbersUpdate() {
    if (_lineDebounceTimer) clearTimeout(_lineDebounceTimer);
    _lineDebounceTimer = setTimeout(() => {
      _lineDebounceTimer = null;
      updateLineNumbers();
    }, 100);
  }

  function updateLineNumbers() {
    if (_lineUpdatePending) {
      _lineUpdateDirty = true;
      return;
    }
    _lineUpdatePending = true;
    updateLineNumbersIncremental();
  }

  function escHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // 配置持久化
  function persistConfig(updateModifiedTime = false) {
    GM_setValue(CONFIG_KEY, currentConfig);
    if (updateModifiedTime) GM_setValue(LOCAL_LAST_MODIFIED_KEY, Date.now());
  }

  function syncRulesTextarea() {
    const textarea = document.getElementById('searchfilter-rules');
    if (textarea) {
      textarea.value = currentConfig.rules.join('\n');
      updateLineNumbers();
    }
  }

  // 悬浮通知
  function showToast(message, type = 'info', duration = 3000) {
    let container = document.getElementById('searchfilter-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'searchfilter-toast-container';
      document.body.appendChild(container);
    }

    const panel = document.getElementById('searchfilter-webdav-panel') ||
      document.getElementById('searchfilter-subscription-panel') ||
      document.getElementById('searchfilter-hlcolor-panel') ||
      document.getElementById('searchfilter-selector-panel') ||
      document.getElementById('searchfilter-panel');
    if (panel) {
      if (container.parentElement !== panel) {
        panel.appendChild(container);
      }
      container.style.position = 'absolute';
      container.style.top = 'calc(100% + 4px)';
      container.style.left = '0';
      container.style.right = '0';
      container.style.bottom = '';
      container.style.width = 'auto';
      container.style.maxWidth = 'none';
    } else {
      if (container.parentElement !== document.body) {
        document.body.appendChild(container);
      }
      container.style.position = '';
      container.style.top = '';
      container.style.right = '';
      container.style.left = '';
      container.style.bottom = '';
      container.style.width = '';
    }

    const toast = document.createElement('div');
    toast.className = `searchfilter-toast searchfilter-toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));

    let timer = null;
    const dismiss = () => {
      if (!toast.parentElement) return;
      clearTimeout(timer);
      toast.classList.remove('show');
      toast.addEventListener('transitionend', () => toast.remove(), { once: true });
      setTimeout(() => toast.remove(), 400);
    };
    toast.addEventListener('click', dismiss);
    timer = setTimeout(dismiss, duration);
    return { dismiss };
  }

  // 统计面板
  function hideStatsPanel() {
    const statsPanel = document.getElementById('searchfilter-stats-panel');
    if (statsPanel) statsPanel.style.display = 'none';
  }

  function toggleStatsPanel() {
    const statsPanel = document.getElementById('searchfilter-stats-panel');
    if (!statsPanel) return;

    if (statsPanel.style.display === 'flex') {
      statsPanel.style.display = 'none';
      return;
    }

    updateStatsContent();
    statsPanel.style.display = 'flex';
  }

  // 统计分类
  function updateStatsContent() {
    const statsContent = document.getElementById('searchfilter-stats-content');
    if (!statsContent) return;

    const textarea = document.getElementById('searchfilter-rules');
    const rulesText = textarea ? textarea.value : currentConfig.rules.join('\n');
    const rawLines = rulesText.split('\n');
    const localRules = filterValidRuleLines(rawLines);
    const activeRules = localRules
      .filter(rule => !rule.startsWith('#'))
      .map(rule => stripRuleComment(rule))
      .filter(rule => rule.length > 0);

    // 静态语法
    const ruleErrors = {};
    const ruleWarnings = {};
    const ruleCounts = new Map();
    activeRules.forEach(rule => {
      if (currentConfig.errorDetection !== false) {
        const analysis = cachedAnalyzeRule(rule);
        if (!analysis.valid) ruleErrors[rule] = analysis.errors.length ? analysis.errors : [t('invalidRule')];
        if (analysis.warnings.length) ruleWarnings[rule] = analysis.warnings;
      }
      ruleCounts.set(rule, (ruleCounts.get(rule) || 0) + 1);
    });
    const duplicateRules = [...ruleCounts.entries()].filter(([, c]) => c > 1);

    const whitelistRules = [];
    const highlightRules = [];
    activeRules.forEach(rule => {
      const hlMatch = rule.match(/^@(\d+)/);
      if (hlMatch) {
        const N = parseInt(hlMatch[1]);
        const hlBody = rule.substring(hlMatch[0].length).trim();
        if (N >= 1 && N <= 5 && hlBody) {
          try {
            if (parseRuleWithConditions(hlBody).staticPass) highlightRules.push(rule);
          } catch (e) {
            if (currentConfig.debug) console.warn('统计高亮规则解析失败:', rule, e);
          }
        }
        return;
      }
      if (!rule.startsWith('@')) return;
      try {
        const parsed = parseRuleWithConditions(rule);
        const isWhitelist = parsed.staticPass
          && parsed.coreRule.startsWith('@')
          && (parsed.coreRule.length > 1 || parsed.standaloneExpr || parsed.dynamicConditions.length > 0);
        if (isWhitelist) whitelistRules.push(rule);
      } catch (e) {
        if (currentConfig.debug) console.warn('统计白名单规则解析失败:', rule, e);
      }
    });

    const engine = getSearchEngine();
    const selector = getContainerSelector(engine);
    const results = selector ? document.querySelectorAll(selector) : [];
    const statsBySource = new Map();

    results.forEach(result => {
      const matchedRule = result.dataset.matchedRule;
      const matchedSource = result.dataset.matchedSource;
      if (!matchedRule || !matchedSource) return;

      if (!statsBySource.has(matchedSource)) {
        statsBySource.set(matchedSource, {
          total: 0,
          rules: new Map()
        });
      }
      const sourceStats = statsBySource.get(matchedSource);
      sourceStats.total++;
      const ruleMap = sourceStats.rules;
      ruleMap.set(matchedRule, (ruleMap.get(matchedRule) || 0) + 1);
    });

    const ruleErrorsArray = Object.entries(ruleErrors).map(([rule, errors]) => ({
      rule,
      msg: errors.join(', ')
    }));
    const ruleWarningsArray = Object.entries(ruleWarnings).map(([rule, warnings]) => ({
      rule,
      msg: warnings.join(', ')
    }));
    let resultHTML = '';

    // 统计面板复用
    function issueBlockHtml(title, accent, bg, wordKey, rows) {
      if (!rows.length) return '';
      let html = `<div style="color: ${accent}; background: ${bg}; padding: 8px; border-radius: 4px; margin-bottom: 12px;"><strong>${title}</strong><br>`;
      for (const row of rows) {
        html += `<div style="margin: 4px 0; font-size: 11px;"><div style="color: #2d3748;"><strong>${t('matchedRule')}: </strong>${escHtml(row.rule)}</div><div style="color: ${accent};"><strong>${t(wordKey)}: </strong>${escHtml(row.msg)}</div></div>`;
      }
      return html + '</div>';
    }

    function statsSectionStartHtml(title, badge) {
      return `<div style="margin-top: 12px; padding-top: 8px; border-top: 1px solid #e2e8f0;"><div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; padding-bottom: 4px; border-bottom: 1px solid #cbd5e0;"><span style="font-weight: bold; color: #2d3748; font-size: 14px;">${title}</span><span style="background: #2c5282; color: white; padding: 2px 10px; border-radius: 12px; font-size: 12px;">${badge}</span></div>`;
    }

    if (ruleErrorsArray.length > 0) {
      resultHTML += issueBlockHtml(t('statsErrors', {count: ruleErrorsArray.length}), '#c53030', '#fff5f5', 'errorWord', ruleErrorsArray);
    }

    if (ruleWarningsArray.length > 0) {
      resultHTML += issueBlockHtml(t('statsWarnings', {count: ruleWarningsArray.length}), '#b7791f', '#fffff0', 'warningWord', ruleWarningsArray);
    }

    // 匹配规则
    const sourceOrder = getSubscriptions().map((_, i) => `${t('subscription')}${i + 1}`).concat(t('localRule'));
    let hasMatches = false;

    sourceOrder.forEach(source => {
      const sourceStats = statsBySource.get(source);
      if (!sourceStats || sourceStats.total === 0) return;
      hasMatches = true;

      resultHTML += `<div style="margin-bottom: 16px;">`;
      resultHTML += `<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; padding-bottom: 4px; border-bottom: 1px solid #cbd5e0;">`;
      resultHTML += `<span style="font-weight: bold; color: #2d3748; font-size: 14px;">${source}</span>`;
      resultHTML += `<span style="background: #2c5282; color: white; padding: 2px 10px; border-radius: 12px; font-size: 12px;">${t('matchedCountLabel')} ${sourceStats.total} ${t('matchedCountUnit')}</span>`;
      resultHTML += `</div>`;

      const sortedRules = Array.from(sourceStats.rules.entries()).sort((a, b) => b[1] - a[1]);

      sortedRules.forEach(([rule, count]) => {
        let ruleType = t('urlRule');
        if (HL_STATS_REGEX.test(rule)) {
          ruleType = t('highlightRules');
        } else if (/@if\s*\(/i.test(rule) || looksLikeCondExpr(rule.replace(/^@\d+\s+/, '').replace(/^@/, ''))) {
          ruleType = t('statsCompound');
        } else if (rule.startsWith('title/')) {
          ruleType = t('titleRule');
        } else if (rule.startsWith('text/')) {
          ruleType = t('textRule');
        } else if (rule.startsWith('/')) {
          ruleType = t('regexRule');
        }

        resultHTML += `<div style="margin: 6px 0; padding: 6px 8px; background: #f7fafc; border-radius: 4px;">`;
        resultHTML += `<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">`;
        resultHTML += `<span style="font-size: 11px; color: #718096;">${ruleType}</span>`;
        resultHTML += `<span style="font-size: 11px; color: #38a169; font-weight: bold;">${t('matchedCountLabel')}: ${count} ${t('matchedCountUnit')}</span>`;
        resultHTML += `</div>`;
        resultHTML += `<div style="font-size: 12px; color: #2d3748; word-break: break-all; font-family: 'Consolas', monospace;">${escHtml(rule)}</div>`;
        resultHTML += `</div>`;
      });

      resultHTML += `</div>`;
    });

    if (!hasMatches && ruleErrorsArray.length === 0) {
      resultHTML = `<div style="color: #38a169; padding: 10px; border-radius: 4px; font-size: 12px; background: #f0fff4; text-align: center;">${t('noMatch')}</div>`;
    }

    if (whitelistRules.length > 0) {
      resultHTML += statsSectionStartHtml(t('whitelistRules'), `${t('stateEnabled')} ${whitelistRules.length} ${t('matchedCountUnit')}`);
      whitelistRules.forEach(rule => {
        resultHTML += `<div style="font-size: 11px; color: #4a5568; word-break: break-all; font-family: 'Consolas', monospace;">${escHtml(rule)}</div>`;
      });
      resultHTML += `</div>`;
    }

    if (highlightRules.length > 0) {
      resultHTML += statsSectionStartHtml(t('highlightRules'), `${t('stateEnabled')} ${highlightRules.length} ${t('matchedCountUnit')}`);
      highlightRules.forEach(rule => {
        resultHTML += `<div style="font-size: 11px; color: #4a5568; word-break: break-all; font-family: 'Consolas', monospace;">${escHtml(rule)}</div>`;
      });
      resultHTML += `</div>`;
    }

    if (duplicateRules.length > 0) {
      resultHTML += statsSectionStartHtml(t('duplicateRules'), `${duplicateRules.length} ${t('matchedCountUnit')}`);
      duplicateRules.forEach(([rule, count]) => {
        resultHTML += `<div style="font-size: 11px; color: #4a5568; word-break: break-all; font-family: 'Consolas', monospace;">${escHtml(rule)} <span style="color:#c53030;">${t('ruleDuplicate', {count})}</span></div>`;
      });
      resultHTML += `</div>`;
    }

    statsContent.innerHTML = resultHTML;
  }

  // 面板定位
  function getPanelPositionStyles() {
    const statusBtn = document.getElementById('searchfilter-status');
    if (currentConfig.panelCentered) {
      return `top: 60%; left: 50%; transform: translate(-50%, -50%);`;
    }

    let rect;
    if (statusBtn) {
      rect = statusBtn.getBoundingClientRect();
    } else {
      rect = {
        left: window.innerWidth - 50,
        right: window.innerWidth - 10,
        top: window.innerHeight - 50,
        bottom: window.innerHeight - 10,
        width: 40,
        height: 40
      };
    }
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const isLeft = centerX < window.innerWidth / 2;
    const isTop = centerY < window.innerHeight / 2;

    if (isLeft && isTop) return 'top: 10px; left: 10px; transform: none;';
    if (!isLeft && isTop) return 'top: 10px; right: 10px; transform: none;';
    if (isLeft && !isTop) return 'bottom: 10px; left: 10px; transform: none;';
    return 'bottom: 10px; right: 10px; transform: none;';
  }

  // 创建面板
  function createPanel(id, width = '320px', padding = '15px') {
    const panel = document.createElement('div');
    panel.id = id;
    panel.classList.add('searchfilter-panel-fade');
    panel.style.cssText = `
        position: fixed;
        ${getPanelPositionStyles()}
        width: ${width};
        z-index: 10001;
        padding: ${padding};
        display: flex;
        flex-direction: column;
    `;
    document.body.appendChild(panel);
    requestAnimationFrame(() => panel.classList.add('show'));
    return panel;
  }

  // 面板淡出移除
  function fadeOutAndRemovePanel(panel, onClosed) {
    panel.classList.remove('show');
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      panel.remove();
      if (onClosed) onClosed();
    };
    panel.addEventListener('transitionend', finish, { once: true });
    setTimeout(finish, 350);
  }

  // 点击面板外关闭
  function bindOutsideClickClose(panel, onBeforeClose) {
    const closeHandler = (e) => {
      if (preventPanelClose) return;
      if (!panel.contains(e.target)) closePanel();
    };
    const closePanel = () => {
      if (typeof onBeforeClose === 'function') onBeforeClose();
      document.removeEventListener('click', closeHandler);
      panel._cleanupClick = null;
      fadeOutAndRemovePanel(panel);
    };
    panel._cleanupClick = () => {
      document.removeEventListener('click', closeHandler);
    };
    setTimeout(() => {
      if (panel.isConnected) document.addEventListener('click', closeHandler);
    }, 200);
    return closePanel;
  }

  // 主面板样式
  function showConfigPanel() {
    injectWidgetStyles();
    const existingPanel = document.getElementById('searchfilter-panel');
    if (existingPanel) {
      if (window._panelCloseHandler) {
        document.removeEventListener('click', window._panelCloseHandler);
        window._panelCloseHandler = null;
      }
      existingPanel.remove();
      return;
    }

    if (window._panelCloseHandler) {
      document.removeEventListener('click', window._panelCloseHandler);
      window._panelCloseHandler = null;
    }

    const panel = createPanel('searchfilter-panel');

    // 兼容旧悬浮球设置
    const initialSize = getBubbleSize();

    panel.innerHTML = `
            <div style="display: flex; gap: 8px; margin-top: 0px; margin-bottom: 8px;">
                <label style="display: flex; align-items: center; flex: 1; justify-content: space-between; white-space: nowrap; cursor: pointer; font-size: 12px; color: #4a5568;">
                    <span style="display: flex; align-items: center;">
                        <span class="searchfilter-switch">
                            <input type="checkbox" id="searchfilter-enabled" ${currentConfig.enabled ? 'checked' : ''}>
                            <span class="searchfilter-slider"></span>
                        </span>
                        <span>${t('enableBlock')}</span>
                    </span>
                </label>
                <label style="display: flex; align-items: center; flex: 1; justify-content: space-between; white-space: nowrap; cursor: pointer; font-size: 12px; color: #4a5568;">
                    <span style="display: flex; align-items: center;">
                        <span class="searchfilter-switch">
                            <input type="checkbox" id="searchfilter-show-count" ${currentConfig.showCount ? 'checked' : ''}>
                            <span class="searchfilter-slider"></span>
                        </span>
                        <span>${t('showCount')}</span>
                    </span>
                </label>
                <label style="display: flex; align-items: center; flex: 1; justify-content: space-between; white-space: nowrap; cursor: pointer; font-size: 12px; color: #4a5568;">
                    <span style="display: flex; align-items: center;">
                        <span class="searchfilter-switch">
                            <input type="checkbox" id="searchfilter-debug" ${currentConfig.debug ? 'checked' : ''}>
                            <span class="searchfilter-slider"></span>
                        </span>
                        <span>${t('debugMode')}</span>
                    </span>
                </label>
            </div>
            
            <div style="display: flex; gap: 8px; margin-bottom: 12px;">
                <label style="display: flex; align-items: center; flex: 1; justify-content: space-between; white-space: nowrap; cursor: pointer; font-size: 12px; color: #4a5568;">
                    <span style="display: flex; align-items: center;">
                        <span class="searchfilter-switch">
                            <input type="checkbox" id="searchfilter-show-block-btn" ${currentConfig.showBlockBtn ? 'checked' : ''}>
                            <span class="searchfilter-slider"></span>
                        </span>
                        <span>${t('oneClickBlock')}</span>
                    </span>
                </label>
                <label style="display: flex; align-items: center; flex: 1; justify-content: space-between; white-space: nowrap; cursor: pointer; font-size: 12px; color: #4a5568;">
                    <span style="display: flex; align-items: center;">
                        <span class="searchfilter-switch">
                            <input type="checkbox" id="searchfilter-block-domain" ${currentConfig.blockDomain ? 'checked' : ''}>
                            <span class="searchfilter-slider"></span>
                        </span>
                        <span>${t('blockDomain')}</span>
                    </span>
                </label>
                <label style="display: flex; align-items: center; flex: 1; justify-content: space-between; white-space: nowrap; cursor: pointer; font-size: 12px; color: #4a5568;">
                    <span style="display: flex; align-items: center;">
                        <span class="searchfilter-switch">
                            <input type="checkbox" id="searchfilter-block-confirm" ${currentConfig.blockConfirm ? 'checked' : ''}>
                            <span class="searchfilter-slider"></span>
                        </span>
                        <span>${t('doubleConfirm')}</span>
                    </span>
                </label>
            </div>
            
            <div class="option-row" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; gap: 8px;">
                <span class="option-label" style="margin-bottom: 0;">${t('bubbleSize')} <span id="searchfilter-bubble-size-val">${initialSize}px</span></span>
                <input type="range" id="searchfilter-bubble-size-slider" min="15" max="40" value="${initialSize}" style="flex: 1; margin-left: 5px; height: 4px; background: #cbd5e0; border-radius: 2px; outline: none; -webkit-appearance: none; cursor: pointer;">
            </div>
            
            <div style="margin-bottom: 0px;">
                <div class="compact-row">
                    <span style="font-size: 12px; color: #4a5568;">${t('blockRules')}</span>
                    <div style="display: flex; gap: 4px; flex: 0 0 auto;">
                        <button id="searchfilter-subscribe" class="searchfilter-button searchfilter-button-secondary" style="padding: 3px 8px; border: 1px solid transparent; min-width: 0 !important; width: auto !important; flex: 0 0 auto !important;">${t('subscription')}</button>
                        <button id="searchfilter-sync" class="searchfilter-button searchfilter-button-success" style="padding: 3px 8px; border: 1px solid transparent; min-width: 0 !important; width: auto !important; flex: 0 0 auto !important;">${t('sync')}</button>
                        <button id="searchfilter-import-file" class="searchfilter-button searchfilter-button-secondary" style="padding: 3px 8px; border: 1px solid transparent; min-width: 0 !important; width: auto !important; flex: 0 0 auto !important;">${t('import')}</button>
                        <button id="searchfilter-export-file" class="searchfilter-button searchfilter-button-success" style="padding: 3px 8px; border: 1px solid transparent; min-width: 0 !important; width: auto !important; flex: 0 0 auto !important;">${t('export')}</button>
                    </div>
                </div>
                <div class="rules-container">
                    <div id="searchfilter-line-numbers"></div>
                    <textarea id="searchfilter-rules" placeholder="${t('placeholder')}" wrap="off">${escHtml(currentConfig.rules.join('\n'))}</textarea>
                    <div id="searchfilter-scroll-top" class="searchfilter-scroll-btn" style="top: 2px;">⬆️</div>
                    <div id="searchfilter-scroll-bottom" class="searchfilter-scroll-btn" style="bottom: 1px;">⬇️</div>
                </div>
            </div>
            
            <div style="display: flex; gap: 6px; margin-top: 8px;" id="searchfilter-panel-footer">
                <button id="searchfilter-save" class="searchfilter-button searchfilter-button-primary action-button" style="flex: 2;">${t('save')}</button>
                <button id="searchfilter-test" class="searchfilter-button searchfilter-button-secondary action-button" style="flex: 1;">${t('stats')}</button>
                <button id="searchfilter-close" class="searchfilter-button searchfilter-button-danger action-button" style="flex: 1;">${t('close')}</button>
            </div>
            
            <div id="searchfilter-stats-panel">
                <div id="searchfilter-stats-content"></div>
            </div>
        `;

    updateLineNumbers();

    const textarea = document.getElementById('searchfilter-rules');
    const lineNums = document.getElementById('searchfilter-line-numbers');

    textarea.addEventListener('input', scheduleLineNumbersUpdate);
    textarea.addEventListener('scroll', () => {
      lineNums.scrollTop = textarea.scrollTop;
    });
    lineNums.addEventListener('click', (e) => {
      const errorEl = e.target.closest('.searchfilter-line-error');
      if (errorEl) showToast(errorEl.getAttribute('data-error') || t('invalidRule'), 'error');
    });

    const closePanel = () => {
      fadeOutAndRemovePanel(panel, () => {
        document.removeEventListener('click', window._panelCloseHandler);
        window._panelCloseHandler = null;

        const savedConfig = GM_getValue(CONFIG_KEY, currentConfig);
        currentConfig = savedConfig;
      });
      const toastContainer = document.getElementById('searchfilter-toast-container');
      if (toastContainer) toastContainer.remove();
    };

    document.getElementById('searchfilter-save').onclick = () => {
      hideStatsPanel();
      saveConfig();
      showToast(t('saved'), 'success');
    };
    document.getElementById('searchfilter-test').onclick = toggleStatsPanel;
    document.getElementById('searchfilter-close').onclick = (e) => {
      e.stopPropagation();
      closePanel();
    };
    document.getElementById('searchfilter-subscribe').onclick = showSubscriptionPanel;
    document.getElementById('searchfilter-sync').onclick = showWebDAVPanel;
    document.getElementById('searchfilter-import-file').onclick = importRulesFromFile;
    document.getElementById('searchfilter-export-file').onclick = exportRulesToFile;

    const COMMENT_HEADING_REGEX = /^\s*#\s+\S+/;

    // 快速跳转
    function findCommentLineIndices(lines) {
      const indices = [];
      for (let i = 0; i < lines.length; i++) {
        if (COMMENT_HEADING_REGEX.test(lines[i])) {
          indices.push(i);
        }
      }
      return indices;
    }

    function jumpToComment(direction) {
      const text = textarea.value;
      const lines = text.split('\n');
      const commentIndices = findCommentLineIndices(lines);
      if (!commentIndices.length) return;

      const cursorPos = textarea.selectionStart || 0;
      let currentLineIndex = text.substring(0, cursorPos).split('\n').length - 1;

      let targetLineIndex = -1;
      if (direction === 'prev') {
        if (currentLineIndex === 0) {
          targetLineIndex = lines.length - 1;
        } else {
          for (let i = commentIndices.length - 1; i >= 0; i--) {
            if (commentIndices[i] < currentLineIndex) {
              targetLineIndex = commentIndices[i];
              break;
            }
          }
          if (targetLineIndex === -1) {
            targetLineIndex = lines.length - 1;
          }
        }
      } else {
        for (let i = 0; i < commentIndices.length; i++) {
          if (commentIndices[i] > currentLineIndex) {
            targetLineIndex = commentIndices[i];
            break;
          }
        }
        if (targetLineIndex === -1) {
          targetLineIndex = commentIndices[0];
        }
      }

      if (targetLineIndex === -1) return;

      let targetPos = 0;
      for (let i = 0; i < targetLineIndex; i++) {
        targetPos += lines[i].length + 1;
      }

      if (document.activeElement === textarea) {
        textarea.focus({ preventScroll: true });
      }
      textarea.setSelectionRange(targetPos, targetPos);

      const computedLineHeight = parseFloat(window.getComputedStyle(textarea).lineHeight) || 15.4;
      const targetScrollTop = Math.max(0, targetLineIndex * computedLineHeight - (textarea.clientHeight / 2) + computedLineHeight);
      textarea.scrollTo({
        top: targetScrollTop,
        behavior: 'smooth'
      });
      lineNums.scrollTo({
        top: targetScrollTop,
        behavior: 'smooth'
      });
    }

    const bindScrollBtn = (id, direction) => {
      const btn = document.getElementById(id);
      if (!btn) return;
      let lastTouchTime = 0;
      const handleJump = (e) => {
        if (e) {
          if (e.cancelable) e.preventDefault();
          e.stopPropagation();
        }
        jumpToComment(direction);
      };
      btn.addEventListener('touchstart', (e) => {
        if (e.cancelable) e.preventDefault();
        e.stopPropagation();
        lastTouchTime = Date.now();
        handleJump(e);
      }, { passive: false });
      btn.addEventListener('mousedown', (e) => {
        if (e.cancelable) e.preventDefault();
        e.stopPropagation();
      });
      btn.onclick = (e) => {
        if (Date.now() - lastTouchTime < 400) return;
        handleJump(e);
      };
    };
    bindScrollBtn('searchfilter-scroll-top', 'prev');
    bindScrollBtn('searchfilter-scroll-bottom', 'next');

    // 悬浮球大小滑条
    const sizeSlider = panel.querySelector('#searchfilter-bubble-size-slider');
    const sizeValueDisplay = panel.querySelector('#searchfilter-bubble-size-val');
    if (sizeSlider) {
      sizeSlider.addEventListener('input', function() {
        const value = parseInt(this.value);
        currentConfig.bubbleSize = value;
        if (sizeValueDisplay) {
          sizeValueDisplay.textContent = `${value}px`;
        }
        const statusBtn = document.getElementById('searchfilter-status');
        if (statusBtn) applyBubbleSize(statusBtn);
        persistConfig();
      });
    }

    // 滑块开关
    const switchDefs = [
      { id: 'searchfilter-enabled', key: 'enabled', apply: () => { forceReprocessAll(); } },
      { id: 'searchfilter-show-count', key: 'showCount', apply: () => { const s = document.getElementById('searchfilter-status'); if (s) updateBubbleContent(s, parseInt(s.dataset.blockedCount || 0)); } },
      { id: 'searchfilter-debug', key: 'debug', apply: () => { exposeDebugApi(); } },
      { id: 'searchfilter-show-block-btn', key: 'showBlockBtn', apply: () => { forceReprocessAll(); } },
      { id: 'searchfilter-block-domain', key: 'blockDomain', apply: null },
      { id: 'searchfilter-block-confirm', key: 'blockConfirm', apply: null },
    ];
    switchDefs.forEach(sw => {
      const el = document.getElementById(sw.id);
      if (el) {
        el.addEventListener('change', function() {
          currentConfig[sw.key] = this.checked;
          persistConfig();
          if (sw.apply) sw.apply();
        });
      }
    });

    const closeHandler = (e) => {
      if (preventPanelClose) return;
      if (!panel.contains(e.target) && !e.target.closest('#searchfilter-status') && !e.target.closest('#searchfilter-webdav-panel') && !e.target.closest('#searchfilter-subscription-panel') && !e.target.closest('#searchfilter-hlcolor-panel') && !e.target.closest('#searchfilter-hlcolor-popup') && !e.target.closest('#searchfilter-selector-panel')) {
        closePanel();
      }
    };
    window._panelCloseHandler = closeHandler;
    setTimeout(() => document.addEventListener('click', closeHandler), 200);
  }

  // 保存配置
  function saveConfig() {
    const rulesText = document.getElementById('searchfilter-rules').value;
    const enabled = document.getElementById('searchfilter-enabled').checked;
    const showCount = document.getElementById('searchfilter-show-count').checked;
    const debug = document.getElementById('searchfilter-debug').checked;
    const showBlockBtn = document.getElementById('searchfilter-show-block-btn').checked;
    const blockDomain = document.getElementById('searchfilter-block-domain').checked;
    const blockConfirm = document.getElementById('searchfilter-block-confirm').checked;

    const rawLines = rulesText.split('\n');
    const userRules = filterValidRuleLines(rawLines);

    const prevRules = Array.isArray(currentConfig.rules) ? currentConfig.rules : [];
    const rulesChanged = JSON.stringify(prevRules) !== JSON.stringify(userRules);

    currentConfig.rules = userRules;

    currentConfig.enabled = enabled;
    currentConfig.showCount = showCount;
    currentConfig.debug = debug;
    currentConfig.showBlockBtn = showBlockBtn;
    currentConfig.blockDomain = blockDomain;
    currentConfig.blockConfirm = blockConfirm;

    persistConfig(rulesChanged);

    showHiddenResults = false;
    forceReprocessAll();

  }

  // 高亮面板
  function showHighlightColorPanel() {
    const existing = document.getElementById('searchfilter-hlcolor-panel');
    if (existing) {
      if (typeof existing._cleanupClick === 'function') existing._cleanupClick();
      existing.remove();
      return;
    }

    function hsvToRgb(h, s, v) {
      h /= 360;
      let r, g, b;
      const i = Math.floor(h * 6);
      const f = h * 6 - i;
      const p = v * (1 - s);
      const q = v * (1 - f * s);
      const t = v * (1 - (1 - f) * s);
      switch (i % 6) {
        case 0: r=v; g=t; b=p; break;
        case 1: r=q; g=v; b=p; break;
        case 2: r=p; g=v; b=t; break;
        case 3: r=p; g=q; b=v; break;
        case 4: r=t; g=p; b=v; break;
        case 5: r=v; g=p; b=q; break;
      }
      return [Math.round(r*255), Math.round(g*255), Math.round(b*255)];
    }

    function rgbToHsv(r, g, b) {
      r /= 255; g /= 255; b /= 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      const d = max - min;
      let h = 0;
      if (d !== 0) {
        if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
        else if (max === g) h = ((b - r) / d + 2) * 60;
        else h = ((r - g) / d + 4) * 60;
      }
      return [Math.round(h), max === 0 ? 0 : d / max, max];
    }

    function hexToRgb(hex) {
      return [parseInt(hex.slice(1,3), 16), parseInt(hex.slice(3,5), 16), parseInt(hex.slice(5,7), 16)];
    }

    function rgbToHex(r, g, b) {
      return '#' + [r,g,b].map(x => x.toString(16).padStart(2,'0').toUpperCase()).join('');
    }

    const panel = createPanel('searchfilter-hlcolor-panel', 'auto; max-width: 350px');

    const colors = currentConfig.highlightColors || {};
    const sanitizeHex = (val, fallback) => (/^#[0-9A-Fa-f]{6}$/.test(String(val || '')) ? String(val).toUpperCase() : fallback);
    let rowsHtml = '';
    for (let i = 1; i <= 5; i++) {
      const hex = sanitizeHex(colors[i], '#CE2029');
      rowsHtml += `<div class="hlcolor-row">
        <label>@${i}</label>
        <span class="hlcolor-preview" id="hlcolor-preview-${i}" style="background:${escHtml(hex)}"></span>
        <input type="text" id="hlcolor-input-${i}" value="${escHtml(hex)}" placeholder="#RRGGBB" maxlength="7">
      </div>`;
    }

    const defaultHex = sanitizeHex(colors[1], '#CE2029');
    const [ir, ig, ib] = hexToRgb(defaultHex);
    let [currentHue, currentSat, currentVal] = rgbToHsv(ir, ig, ib);

    panel.innerHTML = `
      <h3 style="margin:0 0 3px;font-size:13px;color:#2d3748;font-weight:600;">${escHtml(t('hlColorTitle'))}</h3>
      <div style="display:flex;gap:2px;align-items:stretch;">
        <div id="hlcolor-left" style="flex:0 0 auto;display:flex;flex-direction:column;height:132px;">
          ${rowsHtml}
          <div style="display:flex;align-items:center;gap:4px;margin-top:1px;">
            <span style="min-width:20px;font-size:12px;color:#4a5568;font-weight:600;">🎨</span>
            <span id="hlcolor-current-preview" style="width:12px;height:12px;border-radius:2px;border:1px solid #e2e8f0;background:${escHtml(defaultHex)};flex-shrink:0;"></span>
            <span id="hlcolor-code-text" style="font-size:11px;font-family:'Consolas',monospace;padding:2px 4px;background:#f7fafc;border-radius:3px;border:1px solid #e2e8f0;width:70px;flex:none;text-align:center;">${escHtml(defaultHex)}</span>
          </div>
        </div>
        <div class="hlcolor-picker-wrapper" style="display:flex;gap:2px;align-items:stretch;flex-shrink:0;">
          <canvas id="hlcolor-sv-canvas"></canvas>
          <canvas id="hlcolor-hue-canvas" width="22"></canvas>
        </div>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:5px;">
        <button id="hlcolor-save" class="searchfilter-button searchfilter-button-primary" style="flex:1;">${escHtml(t('save'))}</button>
        <button id="hlcolor-reset" class="searchfilter-button searchfilter-button-secondary" style="flex:1;">${escHtml(t('hlColorReset'))}</button>
        <button id="hlcolor-cancel" class="searchfilter-button searchfilter-button-secondary" style="flex:1;">${escHtml(t('cancel'))}</button>
      </div>
    `;

    function resizeCanvasToMatch() {
      const left = document.getElementById('hlcolor-left');
      const svCanvas = document.getElementById('hlcolor-sv-canvas');
      const hueCanvas = document.getElementById('hlcolor-hue-canvas');
      if (!left || !svCanvas || !hueCanvas) return;
      svCanvas.width = svCanvas.height = left.clientHeight;
      hueCanvas.height = left.clientHeight;
      drawSVCanvas(currentHue);
      drawHueCanvas();
    }
    requestAnimationFrame(() => {
      resizeCanvasToMatch();
      updatePickedColor();
    });

    function drawSVCanvas(hue) {
      const canvas = document.getElementById('hlcolor-sv-canvas');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const w = canvas.width, h = canvas.height;
      const imageData = ctx.createImageData(w, h);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const s = x / w, v = 1 - y / h;
          const [r, g, b] = hsvToRgb(hue, s, v);
          const idx = (y * w + x) * 4;
          imageData.data[idx] = r;
          imageData.data[idx+1] = g;
          imageData.data[idx+2] = b;
          imageData.data[idx+3] = 255;
        }
      }
      ctx.putImageData(imageData, 0, 0);
    }

    function drawHueCanvas() {
      const canvas = document.getElementById('hlcolor-hue-canvas');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const w = canvas.width, h = canvas.height;
      for (let y = 0; y < h; y++) {
        const [r, g, b] = hsvToRgb((y / h) * 360, 1, 1);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(0, y, w, 1);
      }
    }

    function updatePickedColor() {
      const [r, g, b] = hsvToRgb(currentHue, currentSat, currentVal);
      const hex = rgbToHex(r, g, b);
      const el = document.getElementById('hlcolor-code-text');
      if (el) el.textContent = hex;
      const preview = document.getElementById('hlcolor-current-preview');
      if (preview) preview.style.background = hex;
    }

    const svCanvas = document.getElementById('hlcolor-sv-canvas');

    function onSVMove(clientX, clientY) {
      const rect = svCanvas.getBoundingClientRect();
      const x = Math.max(0, Math.min(svCanvas.width, clientX - rect.left));
      const y = Math.max(0, Math.min(svCanvas.height, clientY - rect.top));
      currentSat = x / svCanvas.width;
      currentVal = 1 - y / svCanvas.height;
      updatePickedColor();
    }

    svCanvas.addEventListener('mousedown', (e) => {
      onSVMove(e.clientX, e.clientY);
      const onSVMouseMove = (me) => onSVMove(me.clientX, me.clientY);
      const onSVMouseUp = () => {
        document.removeEventListener('mousemove', onSVMouseMove);
        document.removeEventListener('mouseup', onSVMouseUp);
      };
      document.addEventListener('mousemove', onSVMouseMove);
      document.addEventListener('mouseup', onSVMouseUp);
    });

    svCanvas.addEventListener('touchstart', (e) => {
      if (!e.touches || !e.touches[0]) return;
      e.preventDefault();
      onSVMove(e.touches[0].clientX, e.touches[0].clientY);
      const onSVTouchMove = (te) => {
        if (!te.touches || !te.touches[0]) return;
        te.preventDefault();
        onSVMove(te.touches[0].clientX, te.touches[0].clientY);
      };
      const onSVTouchEnd = () => {
        document.removeEventListener('touchmove', onSVTouchMove);
        document.removeEventListener('touchend', onSVTouchEnd);
        document.removeEventListener('touchcancel', onSVTouchEnd);
      };
      document.addEventListener('touchmove', onSVTouchMove, { passive: false });
      document.addEventListener('touchend', onSVTouchEnd);
      document.addEventListener('touchcancel', onSVTouchEnd);
    }, { passive: false });

    const hueCanvas = document.getElementById('hlcolor-hue-canvas');

    function onHueMove(clientY) {
      const rect = hueCanvas.getBoundingClientRect();
      const y = Math.max(0, Math.min(hueCanvas.height, clientY - rect.top));
      currentHue = (y / hueCanvas.height) * 360;
      drawSVCanvas(currentHue);
      updatePickedColor();
    }

    hueCanvas.addEventListener('mousedown', (e) => {
      onHueMove(e.clientY);
      const onHueMouseMove = (me) => onHueMove(me.clientY);
      const onHueMouseUp = () => {
        document.removeEventListener('mousemove', onHueMouseMove);
        document.removeEventListener('mouseup', onHueMouseUp);
      };
      document.addEventListener('mousemove', onHueMouseMove);
      document.addEventListener('mouseup', onHueMouseUp);
    });

    hueCanvas.addEventListener('touchstart', (e) => {
      if (!e.touches || !e.touches[0]) return;
      e.preventDefault();
      onHueMove(e.touches[0].clientY);
      const onHueTouchMove = (te) => {
        if (!te.touches || !te.touches[0]) return;
        te.preventDefault();
        onHueMove(te.touches[0].clientY);
      };
      const onHueTouchEnd = () => {
        document.removeEventListener('touchmove', onHueTouchMove);
        document.removeEventListener('touchend', onHueTouchEnd);
        document.removeEventListener('touchcancel', onHueTouchEnd);
      };
      document.addEventListener('touchmove', onHueTouchMove, { passive: false });
      document.addEventListener('touchend', onHueTouchEnd);
      document.addEventListener('touchcancel', onHueTouchEnd);
    }, { passive: false });

    function updatePreview(i) {
      const input = document.getElementById(`hlcolor-input-${i}`);
      const preview = document.getElementById(`hlcolor-preview-${i}`);
      if (input && preview && /^#[0-9a-fA-F]{6}$/.test(input.value)) {
        preview.style.background = input.value;
      }
    }

    for (let i = 1; i <= 5; i++) {
      document.getElementById(`hlcolor-input-${i}`).addEventListener('input', () => updatePreview(i));
    }

    document.getElementById('hlcolor-save').onclick = () => {
      const newColors = {...currentConfig.highlightColors};
      let hasError = false;
      for (let i = 1; i <= 5; i++) {
        const input = document.getElementById(`hlcolor-input-${i}`);
        const val = input.value.trim();
        if (val === '') continue;
        if (!/^#[0-9a-fA-F]{6}$/.test(val)) {
          const saveBtn = document.getElementById('hlcolor-save');
          const originalText = saveBtn.textContent;
          saveBtn.textContent = t('errorWord');
          saveBtn.style.backgroundColor = '#c53030';
          setTimeout(() => {
            saveBtn.textContent = originalText;
            saveBtn.style.backgroundColor = '';
          }, 1500);
          hasError = true;
          break;
        }
        newColors[i] = val;
      }
      if (hasError) return;
      currentConfig.highlightColors = newColors;
      persistConfig();
      forceReprocessAll();
      showToast(t('saved'), 'success');
    };

    document.getElementById('hlcolor-reset').onclick = () => {
      const defaults = {1:'#CE2029', 2:'#FF8C00', 3:'#FFD700', 4:'#228B22', 5:'#1E90FF'};
      for (let i = 1; i <= 5; i++) {
        document.getElementById(`hlcolor-input-${i}`).value = defaults[i];
        document.getElementById(`hlcolor-preview-${i}`).style.background = defaults[i];
      }
      const [r, g, b] = hexToRgb('#CE2029');
      [currentHue, currentSat, currentVal] = rgbToHsv(r, g, b);
      drawSVCanvas(currentHue);
      updatePickedColor();
    };

    const closePanel = bindOutsideClickClose(panel);

    document.getElementById('hlcolor-cancel').onclick = (e) => {
      e.stopPropagation();
      closePanel();
    };
  }

  // 选择器正则转入
  function regexSourceToLiteralText(source) {
    let out = '';
    for (let i = 0; i < source.length; i++) {
      const ch = source[i];
      if (ch === '\\') { out += ch + (source[i + 1] || ''); i++; continue; }
      if (ch === '/') out += '\\/';
      else out += ch;
    }
    return out;
  }

  function escapeJsString(text) {
    let out = '';
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '\\') out += '\\\\';
      else if (ch === '\'') out += '\\\'';
      else if (ch === '\n') out += '\\n';
      else if (ch === '\r') out += '\\r';
      else if (ch === '\t') out += '\\t';
      else out += ch;
    }
    return out;
  }

  // 选择器序列化
  function serializeSelectors() {
    const merged = getSelectors();
    const parts = [];
    const defToText = (def, disabled) => {
      const links = Array.isArray(def.links)
        ? `[${(def.links || []).map(s => `'${escapeJsString(s)}'`).join(', ')}]`
        : `'${escapeJsString(def.links || 'a[href]')}'`;
      const m = matchDefToParts(def.match);
      return `{\n` +
        `  match: /${regexSourceToLiteralText(m.source)}/${m.flags},\n` +
        `  containers: '${escapeJsString(def.containers || '')}',\n` +
        `  titles: [${(def.titles || []).map(s => `'${escapeJsString(s)}'`).join(', ')}],\n` +
        `  snippets: [${(def.snippets || []).map(s => `'${escapeJsString(s)}'`).join(', ')}],\n` +
        `  links: ${links},\n` +
        (disabled ? `  disabled: true,\n` : '') +
        `}`;
    };
    for (const key of Object.keys(merged)) {
      if (key === 'other') continue;
      const def = merged[key];
      if (def && def.disabled) {
        const builtin = SELECTORS[key];
        parts.push(`${key}: ${builtin ? defToText(builtin, true) : `{\n  disabled: true,\n}`}`);
        continue;
      }
      parts.push(`${key}: ${defToText(def, false)}`);
    }
    return parts.join(',\n');
  }

  function isValidCssSelector(selector) {
    try {
      document.querySelector(selector);
      return true;
    } catch (e) {
      return false;
    }
  }

  function hasPseudoElement(selector) {
    return /::/.test(String(selector).replace(/(["'])(?:\\.|(?!\1).)*\1/g, ''));
  }

  // 选择器配置校验
  function validateUserSelectors(config) {
    if (!config || typeof config !== 'object' || Array.isArray(config)) return [t('selectorJsonError')];
    const errors = [];
    for (const key of Object.keys(config)) {
      const def = config[key];
      if (key === 'other') { errors.push(t('selectorReservedKey', { key })); continue; }
      if (!/^[A-Za-z0-9_-]+$/.test(key)) { errors.push(t('selectorInvalidKey', { key })); continue; }
      if (!def || typeof def !== 'object' || Array.isArray(def)) { errors.push(t('selectorFieldRequired', { key, field: 'match' })); continue; }
      if (def.disabled === true || def.disable === true) continue;
      if ((def.disabled === false || def.disable === false) && Object.keys(def).every(k => k === 'disabled' || k === 'disable')) continue;
      if (typeof def.match === 'string' && def.match) {
        try { new RegExp(def.match); } catch (e) { errors.push(t('selectorInvalidRegex', { key })); }
      } else if (def.match && typeof def.match === 'object' && typeof def.match.source === 'string' && def.match.source) {
        try { new RegExp(def.match.source, String(def.match.flags || '').toLowerCase().replace(/[^imsu]/g, '')); } catch (e) { errors.push(t('selectorInvalidRegex', { key })); }
        const badFlags = getInvalidRegexFlags(String(def.match.flags || ''));
        if (badFlags) errors.push(t('invalidRegexFlags', { flags: badFlags }));
      } else {
        errors.push(t('selectorFieldRequired', { key, field: 'match' }));
      }
      if (typeof def.containers !== 'string' || !def.containers.trim()) {
        errors.push(t('selectorFieldRequired', { key, field: 'containers' }));
      } else if (!isValidCssSelector(def.containers) || hasPseudoElement(def.containers)) {
        errors.push(t('selectorInvalidCss', { key, field: 'containers', value: def.containers }));
      }
      for (const field of ['titles', 'snippets']) {
        const value = def[field];
        if (value === undefined || value === null) continue;
        if (!Array.isArray(value) && typeof value !== 'string') {
          errors.push(t('selectorFieldRequired', { key, field }));
          continue;
        }
        for (const s of normalizeSelectorList(value)) {
          if (!isValidCssSelector(s)) errors.push(t('selectorInvalidCss', { key, field, value: s }));
        }
      }
      if (def.links === undefined || def.links === null) continue;
      if (typeof def.links === 'string') {
        if (def.links && !isValidCssSelector(def.links)) errors.push(t('selectorInvalidCss', { key, field: 'links', value: def.links }));
      } else if (Array.isArray(def.links)) {
        for (const s of normalizeSelectorList(def.links)) {
          if (!isValidCssSelector(s)) errors.push(t('selectorInvalidCss', { key, field: 'links', value: s }));
        }
      } else {
        errors.push(t('selectorFieldRequired', { key, field: 'links' }));
      }
    }
    return errors;
  }

  function matchDefToParts(match) {
    if (typeof match === 'string') return { source: match, flags: '' };
    if (match instanceof RegExp) return { source: match.source, flags: match.flags || '' };
    if (match && typeof match === 'object' && typeof match.source === 'string') return { source: match.source, flags: String(match.flags || '').toLowerCase() };
    return { source: '', flags: '' };
  }

  function sameSelectorDef(a, b) {
    if (!a || !b) return false;
    const aM = matchDefToParts(a.match);
    const bM = matchDefToParts(b.match);
    if (aM.source !== bM.source || aM.flags !== bM.flags) return false;
    if ((a.containers || '') !== (b.containers || '')) return false;
    const norm = (v) => JSON.stringify(normalizeSelectorList(v));
    if (norm(a.titles) !== norm(b.titles)) return false;
    if (norm(a.snippets) !== norm(b.snippets)) return false;
    if (norm(a.links) !== norm(b.links)) return false;
    return true;
  }

  function diffUserSelectors(config) {
    const out = {};
    if (!config || typeof config !== 'object' || Array.isArray(config)) return out;
    for (const key of Object.keys(config)) {
      if (key === 'other') continue;
      const def = config[key];
      if (!def || typeof def !== 'object' || Array.isArray(def)) continue;
      if (def.disabled === true || def.disable === true) { out[key] = { disabled: true }; continue; }
      const rest = { ...def };
      if (rest.disable !== undefined) {
        if (rest.disabled === undefined) rest.disabled = rest.disable;
        delete rest.disable;
      }
      if (rest.disabled === false && Object.keys(rest).every(k => k === 'disabled')) continue;
      const builtin = SELECTORS[key];
      if (!builtin) { out[key] = rest; continue; }
      if (!sameSelectorDef(rest, builtin)) out[key] = rest;
    }
    return out;
  }

  // 恢复更新
  function pruneUserSelectors() {
    const user = getUserSelectors();
    let changed = false;
    const next = {};
    for (const key of Object.keys(user)) {
      const def = user[key];
      if (key !== 'other' && SELECTORS[key] && sameSelectorDef(def, SELECTORS[key])) { changed = true; continue; }
      next[key] = def;
    }
    if (changed) {
      GM_setValue(SELECTORS_KEY, next);
      resetSelectorCache();
    }
  }

  // 解析编辑器JS
  function parseSelectorText(text) {
    const fail = () => ({ config: null, errors: [t('selectorJsonError')] });
    let s = String(text == null ? '' : text).trim();
    if (!s) return fail();
    s = s.replace(/^const\s+SELECTORS\s*=\s*/i, '').replace(/;\s*$/, '').trim();
    if (s.startsWith('{') && s.endsWith('}')) s = s.slice(1, -1);
    const n = s.length;
    let i = 0;
    const skipWs = () => { while (i < n && /\s/.test(s[i])) i++; };
    const readString = () => {
      const quote = s[i];
      let j = i + 1, val = '';
      while (j < n) {
        const ch = s[j];
        if (ch === '\\') {
          const nx = s[j + 1];
          if (nx === '\\' || nx === quote) { val += nx; j += 2; continue; }
          val += ch + (nx || ''); j += 2; continue;
        }
        if (ch === quote) { i = j + 1; return val; }
        val += ch; j++;
      }
      return null;
    };
    const config = {};
    const readKey = () => {
      if (s[i] === '\'' || s[i] === '"') return readString();
      const m = /^[A-Za-z_$][\w$-]*/.exec(s.slice(i));
      if (!m) return null;
      i += m[0].length;
      return m[0];
    };
    while (true) {
      skipWs();
      if (i >= n) break;
      if (s[i] === ',' || s[i] === ';') { i++; continue; }
      const key = readKey();
      if (key === null) return fail();
      skipWs();
      if (s[i] !== ':') return fail();
      i++;
      skipWs();
      if (s[i] !== '{') return fail();
      i++;
      const def = {};
      while (true) {
        skipWs();
        if (i >= n) return fail();
        if (s[i] === ',') { i++; continue; }
        if (s[i] === '}') { i++; break; }
        const field = readKey();
        if (field === null) return fail();
        skipWs();
        if (s[i] !== ':') return fail();
        i++;
        skipWs();
        if (s[i] === '/') {
          let j = i + 1, src = '', inClass = false, closed = false;
          while (j < n) {
            const ch = s[j];
            if (ch === '\\') { src += ch + (s[j + 1] || ''); j += 2; continue; }
            if (inClass) { if (ch === ']') inClass = false; src += ch; j++; continue; }
            if (ch === '[') { inClass = true; src += ch; j++; continue; }
            if (ch === '/') { closed = true; j++; break; }
            src += ch; j++;
          }
          if (!closed) return fail();
          let k = j;
          while (k < n && /[a-z]/i.test(s[k])) k++;
          const flags = s.slice(j, k);
          if (flags && getInvalidRegexFlags(flags)) return { config: null, errors: [t('invalidRegexFlags', { flags })] };
          i = k;
          if (field !== 'match') return fail();
          def[field] = flags ? { source: src, flags: flags.toLowerCase() } : src;
        } else if (s[i] === '\'' || s[i] === '"') {
          const val = readString();
          if (val === null) return fail();
          def[field] = val;
        } else if (s[i] === '[') {
          i++;
          const arr = [];
          while (true) {
            skipWs();
            if (i >= n) return fail();
            if (s[i] === ',') { i++; continue; }
            if (s[i] === ']') { i++; break; }
            if (s[i] === '\'' || s[i] === '"') {
              const val = readString();
              if (val === null) return fail();
              arr.push(val);
            } else return fail();
          }
          def[field] = arr;
        } else if (s.startsWith('true', i) && !/[\w$]/.test(s[i + 4] || '')) {
          def[field] = true;
          i += 4;
        } else if (s.startsWith('false', i) && !/[\w$]/.test(s[i + 5] || '')) {
          def[field] = false;
          i += 5;
        } else return fail();
      }
      if (key === 'other') continue;
      config[key] = def;
    }
    return { config, errors: [] };
  }

  // 选择器文件导入
  function importSelectorsFromFile(textarea, onLoaded) {
    preventPanelClose = true;
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.js,.json,application/javascript,application/json';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);

    let cleanedUp = false;
    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      window.removeEventListener('focus', onWindowFocus);
      fileInput.remove();
      preventPanelClose = false;
    };
    const onWindowFocus = () => {
      setTimeout(() => {
        if (!fileInput.files || fileInput.files.length === 0) cleanup();
      }, 300);
    };

    fileInput.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) {
        cleanup();
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        textarea.value = String(ev.target.result || '');
        if (onLoaded) onLoaded();
        cleanup();
      };
      reader.onerror = cleanup;
      reader.readAsText(file, 'UTF-8');
    };
    fileInput.addEventListener('cancel', cleanup);
    window.addEventListener('focus', onWindowFocus);
    fileInput.click();
  }

  // 自定义选择器面板
  function showSelectorPanel() {
    injectWidgetStyles();
    hideStatsPanel();
    const existing = document.getElementById('searchfilter-selector-panel');
    if (existing) {
      if (typeof existing._cleanupClick === 'function') existing._cleanupClick();
      existing.remove();
      return;
    }

    const panel = createPanel('searchfilter-selector-panel', '320px', '15px');
    const syncSelectorsEnabled = GM_getValue(WEBDAV_SYNC_SELECTORS_KEY, false);

    panel.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                <h3 style="margin:0;font-size:14px;line-height:1.2;">${t('selectorPanelTitle')}</h3>
                <div style="display:flex;align-items:center;gap:6px;">
                    <label style="display:flex !important;align-items:center;font-size:12px;color:#4a5568;cursor:pointer;margin:0;white-space:nowrap;line-height:1;">
                        <span class="searchfilter-switch">
                            <input type="checkbox" id="searchfilter-selector-sync" ${syncSelectorsEnabled ? 'checked' : ''}>
                            <span class="searchfilter-slider"></span>
                        </span>
                        <span style="line-height:1;">${t('syncScriptConfig')}</span>
                    </label>
                    <button id="searchfilter-selector-import" class="searchfilter-button searchfilter-button-secondary" style="padding: 3px 8px; border: 1px solid transparent;">${t('import')}</button>
                    <button id="searchfilter-selector-export" class="searchfilter-button searchfilter-button-success" style="padding: 3px 8px; border: 1px solid transparent;">${t('export')}</button>
                </div>
            </div>
            <div style="font-size:11px;color:#718096;margin-bottom:6px;">${t('selectorHint')}</div>
            <div class="rules-container" style="height:255px;">
                <div id="searchfilter-sel-line-numbers"></div>
                <textarea id="searchfilter-sel-rules" spellcheck="false" wrap="off">${escHtml(serializeSelectors())}</textarea>
            </div>
            <div style="display:flex;gap:6px;margin-top:8px;">
                <button id="searchfilter-selector-save" class="searchfilter-button searchfilter-button-primary action-button" style="flex:2;">${t('save')}</button>
                <button id="searchfilter-selector-reset" class="searchfilter-button searchfilter-button-danger action-button" style="flex:1;">${t('hlColorReset')}</button>
                <button id="searchfilter-selector-cancel" class="searchfilter-button searchfilter-button-secondary action-button" style="flex:1;">${t('cancel')}</button>
            </div>
        `;

    const closePanel = bindOutsideClickClose(panel);
    const textarea = document.getElementById('searchfilter-sel-rules');
    const lineNums = document.getElementById('searchfilter-sel-line-numbers');

    const updateSelLineNumbers = () => {
      if (!textarea || !lineNums || !lineNums.isConnected) return;
      const lines = textarea.value.split('\n');
      lineNums.style.minWidth = `max(20px, calc(${String(lines.length).length}ch + 8px))`;
      let html = '';
      for (let i = 1; i <= lines.length; i++) {
        html += `<div style="position:relative;height:1.4em;">${i}</div>`;
      }
      lineNums.innerHTML = html;
    };
    updateSelLineNumbers();

    textarea.addEventListener('input', updateSelLineNumbers);
    textarea.addEventListener('scroll', () => {
      lineNums.scrollTop = textarea.scrollTop;
    });

    const applyUserSelectors = (config) => {
      GM_setValue(SELECTORS_KEY, diffUserSelectors(config));
      _selectorStoreSignature = getSelectorStoreSignature();
      resetSelectorCache();
      refreshEngineSite();
    };

    const showError = (messages) => {
      if (!messages || !messages.length) return;
      showToast(messages.join('\n'), 'error', 5000);
    };

    document.getElementById('searchfilter-selector-sync').onchange = (e) => {
      GM_setValue(WEBDAV_SYNC_SELECTORS_KEY, e.target.checked);
    };

    document.getElementById('searchfilter-selector-import').onclick = () => {
      importSelectorsFromFile(textarea, () => {
        showError([]);
        updateSelLineNumbers();
      });
    };

    document.getElementById('searchfilter-selector-export').onclick = () => {
      preventPanelClose = true;
      const content = textarea.value;
      if (!content.trim()) {
        preventPanelClose = false;
        showToast(t('noRulesExport'), 'error');
        return;
      }
      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const filename = `selectors-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.js`;
      const blob = new Blob([content], {
        type: 'application/json;charset=utf-8'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      preventPanelClose = false;
    };

    document.getElementById('searchfilter-selector-save').onclick = () => {
      const parsed = parseSelectorText(textarea.value);
      if (!parsed.config || parsed.errors.length) {
        showError(parsed.errors.length ? parsed.errors : [t('selectorJsonError')]);
        return;
      }
      const errors = validateUserSelectors(parsed.config);
      if (errors.length) {
        showError(errors);
        return;
      }
      applyUserSelectors(parsed.config);
      showToast(t('saved'), 'success');
    };

    document.getElementById('searchfilter-selector-reset').onclick = () => {
      applyUserSelectors({});
      textarea.value = serializeSelectors();
      showError([]);
      updateSelLineNumbers();
    };

    document.getElementById('searchfilter-selector-cancel').onclick = (e) => {
      e.stopPropagation();
      closePanel();
    };
  }

  function migrateSubscriptions() {
    if (GM_getValue(SUBSCRIPTIONS_KEY) !== undefined) return;
    const oldUrl = GM_getValue(SUBSCRIPTION_URL_KEY);
    const oldRules = GM_getValue(SUBSCRIPTION_RULES_KEY, []);
    const oldLastUpdate = GM_getValue(SUBSCRIPTION_LAST_UPDATE_KEY, 0);
    const subscriptions = [];
    if (oldUrl) {
      subscriptions.push({
        url: oldUrl,
        enabled: true,
        lastUpdate: oldLastUpdate,
        rules: oldRules
      });
    }
    GM_setValue(SUBSCRIPTIONS_KEY, subscriptions);
  }

  function getSubscriptions() {
    return GM_getValue(SUBSCRIPTIONS_KEY, []);
  }

  function saveSubscriptions(subscriptions) {
    cachedSubscriptionRules = null;
    GM_setValue(SUBSCRIPTIONS_KEY, subscriptions);
  }

  function getAllSubscriptionRules() {
    if (cachedSubscriptionRules) return cachedSubscriptionRules;
    const subs = getSubscriptions();
    const rules = [];
    subs.filter(s => s.enabled).forEach(s => {
      if (s.rules && Array.isArray(s.rules)) rules.push(...s.rules);
    });
    cachedSubscriptionRules = rules;
    return rules;
  }

  // 应用云端订阅
  function applyCloudSubscriptions(subscriptions) {
    if (!Array.isArray(subscriptions)) return;
    const existing = getSubscriptions();
    const merged = subscriptions.map(s => {
      if (!s || typeof s !== 'object') return s;
      const local = existing.find(e => e && e.url === s.url);
      return {
        ...s,
        rules: Array.isArray(local && local.rules) ? local.rules : (Array.isArray(s.rules) ? s.rules : []),
        name: s.name !== undefined ? s.name : (local && local.name)
      };
    });
    saveSubscriptions(merged.slice(0, MAX_SUBSCRIPTIONS));
  }

  // 订阅管理
  function gmRequest(method, url, { headers, data, allow404 = false, timeout = 30000 } = {}) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method,
        url,
        headers,
        data,
        timeout,
        onload: (resp) => {
          if (resp.status >= 200 && resp.status < 300) resolve(resp);
          else if (allow404 && resp.status === 404) resolve(resp);
          else reject(new Error(`HTTP ${resp.status}`));
        },
        onerror: () => reject(new Error(t('networkError'))),
        ontimeout: () => reject(new Error(t('requestTimeout')))
      });
    });
  }

  // 同步配置处理
  function buildSyncPayload(syncedAt = Date.now()) {
    const stored = GM_getValue(CONFIG_KEY);
    const base = (stored && typeof stored === 'object' && !Array.isArray(stored)) ? stored : currentConfig;
    const { rules, bubbleState, bubbleSize, ...settings } = base;
    const payload = {
      ...settings,
      subscriptions: getSubscriptions().map(s => ({ url: s.url, enabled: s.enabled, lastUpdate: s.lastUpdate })),
      syncedAt
    };
    if (GM_getValue(WEBDAV_SYNC_SELECTORS_KEY, false)) {
      payload.selectors = getUserSelectors();
    }
    return payload;
  }

  function isHtmlResponse(content) {
    return /^\s*<!DOCTYPE\s+html|^\s*<html[\s>]/i.test(String(content || ''));
  }

  function parseSyncHeader(content) {
    const lines = content.split('\n');
    if (lines.length > 0 && lines[0].startsWith('# ScriptConfig:')) {
      let config = null;
      try {
        config = JSON.parse(lines[0].substring('# ScriptConfig:'.length));
      } catch (e) {
        if (currentConfig.debug) console.warn('[WebDAV] 配置头解析失败:', e);
      }
      return { config, restLines: lines.slice(1) };
    }
    return { config: null, restLines: lines };
  }

  function safeBase64Encode(str) {
    try {
      const bytes = new TextEncoder().encode(str);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return btoa(binary);
    } catch (e) {
      return btoa(unescape(encodeURIComponent(str)));
    }
  }

  // WebDAV请求
  function getWebDAVRequest(config) {
    const headers = {};
    if (config.username) headers['Authorization'] = 'Basic ' + safeBase64Encode(`${config.username}:${config.password}`);
    return {
      fullUrl: config.url.replace(/\/$/, '') + '/' + config.filename,
      headers
    };
  }

  // 配置头上传
  function buildUploadContent(content, syncedAt = Date.now()) {
    return GM_getValue(WEBDAV_SYNC_CONFIG_KEY, false)
      ? '# ScriptConfig:' + JSON.stringify(buildSyncPayload(syncedAt)) + '\n' + content
      : content;
  }

  // 提取YAML
  function extractYamlRuleItems(lines) {
    let hasSection = false;
    let inSection = false;
    let sectionKind = '';
    let name;
    const items = [];
    const stripQ = (raw) => {
      const s = raw.trim();
      if (s.length > 1 &&
          ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'")))) {
        return s.slice(1, -1).trim();
      }
      return s;
    };
    const listKeyOf = (line) => {
      const m = line.match(/^\s*(rules|blacklist|whitelist|matches)\s*:\s*(?:#.*)?$/i);
      return m ? m[1].toLowerCase() : '';
    };
    for (const line of lines) {
      const listKey = listKeyOf(line);
      if (listKey) {
        hasSection = true;
        inSection = true;
        sectionKind = listKey;
        continue;
      }
      if (!inSection) {
        if (name === undefined) {
          const nm = line.match(/^\s*name\s*:\s*(.+?)\s*$/);
          if (nm) name = stripQ(nm[1]);
        }
        continue;
      }
      const s = line.trim();
      if (!s || s.startsWith('#')) continue;
      if (/^-\s+/.test(s)) {
        let rawItem = s.replace(/^-\s+/, '').trim();
        const qMatch = rawItem.match(/^((?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'))(?:\s*#.*)?$/);
        if (qMatch) {
          rawItem = qMatch[1].slice(1, -1);
        } else if ((rawItem.startsWith('"') && rawItem.endsWith('"')) || (rawItem.startsWith("'") && rawItem.endsWith("'"))) {
          rawItem = rawItem.slice(1, -1);
        }
        let item = rawItem.trim();
        if (sectionKind === 'whitelist' && item && !item.startsWith('@')) item = '@' + item;
        if (item) items.push(item);
        continue;
      }
      if (s === '-') continue;
      if (!/^\s/.test(line)) {
        inSection = false;
        sectionKind = '';
      }
    }
    if (!hasSection || !items.length) return null;
    return { items, name };
  }

  // 解析订阅
  function parseRulesetContent(content) {
    let lines = content.split('\n');
    let meta = {};
    if (lines.length > 0 && lines[0].trim() === '---') {
      const endIndex = lines.findIndex((l, i) => i > 0 && l.trim() === '---');
      if (endIndex !== -1) {
        const head = lines.slice(1, endIndex).join('\n');
        const nameMatch = head.match(/^name\s*:\s*(.+?)\s*$/m);
        if (nameMatch) {
          const raw = nameMatch[1].trim();
          const quoted = (raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"));
          meta.name = quoted ? raw.slice(1, -1) : raw;
        }
        lines = lines.slice(endIndex + 1);
      }
    }
    const yaml = extractYamlRuleItems(lines);
    if (yaml) {
      if (meta.name === undefined && yaml.name) meta.name = yaml.name;
      return { lines: yaml.items, meta };
    }
    return { lines, meta };
  }

function collectSubscriptionRules(lines) {
  const validRules = [];
  for (let line of lines) {
    if (line.length === 0) continue;
    if (line.startsWith('!') && !looksLikeCondExpr(line)) continue;
    if (line.startsWith('[') && line.endsWith(']')) continue;
    if (line.startsWith('@@')) continue;
    if (isElementRuleLine(line)) continue;
    if (line.startsWith('#')) continue;

    const cleanLine = stripRuleComment(line);
    if (cleanLine && validateRule(cleanLine)) {
      validRules.push(cleanLine);
    } else if (currentConfig.debug) {
      console.warn('[订阅] 无效规则已跳过:', line);
    }
  }
  return validRules;
}

async function performSubscriptionForUrl(url, showAlerts = true) {
  const resp = await gmRequest('GET', url);
  const content = resp.responseText;

  const { lines: contentLines, meta } = parseRulesetContent(content);
  const lines = contentLines.map(line => line.trim());
  const validRules = collectSubscriptionRules(lines);

  const subs = getSubscriptions();
  const existing = subs.find(s => s.url === url);

  if (isHtmlResponse(content) || validRules.length === 0) {
    throw new Error(t('subImportFailed'));
  }

  const existingIndex = subs.findIndex(s => s.url === url);
  const subData = {
    url,
    enabled: true,
    lastUpdate: Date.now(),
    rules: validRules
  };
  if (meta.name) subData.name = meta.name;
  else if (existing && existing.name) subData.name = existing.name;

  if (existingIndex >= 0) subs[existingIndex] = subData;
  else if (subs.length < MAX_SUBSCRIPTIONS) subs.push(subData);
  saveSubscriptions(subs.slice(0, MAX_SUBSCRIPTIONS));

    if (showAlerts) alert(t('subscriptionSuccess', {
      count: validRules.length
    }));
    return {
      success: true,
      count: validRules.length
    };
  }

  function showSubscriptionPanel() {
    hideStatsPanel();
    const existing = document.getElementById('searchfilter-subscription-panel');
    if (existing) {
      if (typeof existing._cleanupClick === 'function') existing._cleanupClick();
      existing.remove();
      return;
    }

    const panel = createPanel('searchfilter-subscription-panel', '320px', '20px');

    let subscriptions = getSubscriptions();

    function createSubscriptionRow(url = '') {
      const row = document.createElement('div');
      row.className = 'subscription-row';
      row.innerHTML = `<div class="subscription-meta-row"><span class="subscription-index"></span><div class="subscription-status-message"></div><span class="subscription-info"></span></div><div class="subscription-input-row"><input type="text" class="subscription-url" placeholder="https://example.com/rules.txt"><button class="delete-subscription-btn">❌</button></div>`;
      row.querySelector('.subscription-url').value = url;
      return row;
    }

    panel.innerHTML = `
            <div class="subscription-panel-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0;">
                <h3 style="margin:0;font-size:16px;color:#2d3748;line-height:1;">${t('panelTitle')}</h3>
                <label style="display:flex !important;align-items:center;font-size:12px;color:#4a5568;cursor:pointer;margin:0;white-space:nowrap;line-height:1;">
                    <span class="searchfilter-switch">
                        <input type="checkbox" id="subscription-auto-update" ${currentConfig.subscriptionAutoUpdate ? 'checked' : ''}>
                        <span class="searchfilter-slider"></span>
                    </span>
                    <span style="line-height:1;">${t('autoUpdate')}</span>
                </label>
            </div>
            <div id="subscription-rows-container"></div>
            <div class="subscription-btn-group">
                <button id="subscription-import" class="searchfilter-button searchfilter-button-primary">${t('import')}</button>
                <button id="subscription-add" class="searchfilter-button searchfilter-button-success">+</button>
                <button id="subscription-cancel" class="searchfilter-button searchfilter-button-secondary">${t('cancel')}</button>
            </div>
        `;

    const container = document.getElementById('subscription-rows-container');
    subscriptions.forEach(sub => {
      container.appendChild(createSubscriptionRow(sub.url || ''));
    });

    const addBtn = document.getElementById('subscription-add');
    const autoUpdateSwitch = document.getElementById('subscription-auto-update');
    if (autoUpdateSwitch) {
      autoUpdateSwitch.addEventListener('change', function() {
        currentConfig.subscriptionAutoUpdate = this.checked;
        persistConfig();
      });
    }

    function reindexRows() {
      const rows = container.querySelectorAll('.subscription-row');
      rows.forEach((row, index) => {
        row.querySelector('.subscription-index').textContent = `${t('subscription')}${index + 1}`;
        const infoEl = row.querySelector('.subscription-info');
        const sub = subscriptions[index];
        if (sub && sub.lastUpdate) {
          const d = new Date(sub.lastUpdate);
          const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          const ruleCount = Array.isArray(sub.rules) ? sub.rules.length : 0;
          infoEl.textContent = `${dateStr} - ${ruleCount}`;
        } else {
          infoEl.textContent = '';
        }
      });
    }

    function updateAddButtonState() {
      addBtn.disabled = container.querySelectorAll('.subscription-row').length >= MAX_SUBSCRIPTIONS;
    }

    function collectSubscriptionsFromRows() {
      const newSubs = [];
      let hasError = false;
      container.querySelectorAll('.subscription-row').forEach(row => {
        const input = row.querySelector('.subscription-url');
        const url = input.value.trim();
        const msgDiv = row.querySelector('.subscription-status-message');
        if (!url) {
          msgDiv.textContent = '';
          msgDiv.className = 'subscription-status-message';
          return;
        }
        if (!/^https?:\/\//i.test(url)) {
          msgDiv.textContent = t('subLinkInvalid');
          msgDiv.className = 'subscription-status-message error';
          hasError = true;
          return;
        }
        const existingSub = subscriptions.find(s => s.url === url);
        newSubs.push({
          url,
          enabled: true,
          lastUpdate: existingSub ? existingSub.lastUpdate : 0,
          rules: existingSub ? existingSub.rules : [],
          name: existingSub ? existingSub.name : undefined
        });
      });
      return { newSubs, hasError };
    }

    function persistCurrentSubscriptions() {
      const { newSubs, hasError } = collectSubscriptionsFromRows();
      if (hasError) return false;
      saveSubscriptions(newSubs.filter(s => s.url).slice(0, MAX_SUBSCRIPTIONS));
      subscriptions = getSubscriptions();
      return true;
    }

    function bindDeleteEvents() {
      container.querySelectorAll('.delete-subscription-btn').forEach(btn => {
        btn.onclick = (e) => {
          e.stopPropagation();
          btn.closest('.subscription-row').remove();
          reindexRows();
          updateAddButtonState();
          if (persistCurrentSubscriptions()) {
            showToast(t('saved'), 'success');
            forceReprocessAll();
          }
        };
      });
    }

    addBtn.onclick = () => {
      if (container.querySelectorAll('.subscription-row').length >= MAX_SUBSCRIPTIONS) {
        showToast(t('maxSubscriptions'), 'error');
        return;
      }
      container.appendChild(createSubscriptionRow());
      reindexRows();
      updateAddButtonState();
      bindDeleteEvents();
      container.scrollTop = container.scrollHeight;
    };

    reindexRows();
    updateAddButtonState();
    bindDeleteEvents();

    const closePanel = bindOutsideClickClose(panel);

    document.getElementById('subscription-import').onclick = async () => {
      const rows = Array.from(container.querySelectorAll('.subscription-row'));
      if (!persistCurrentSubscriptions()) return;
      showToast(t('importing'), 'info');
      for (const row of rows) {
        const input = row.querySelector('.subscription-url');
        const url = input.value.trim();
        const msgDiv = row.querySelector('.subscription-status-message');
        if (!url) {
          msgDiv.textContent = t('subLinkEmpty');
          msgDiv.className = 'subscription-status-message error';
          continue;
        }
        if (!/^https?:\/\//i.test(url)) {
          msgDiv.textContent = t('subLinkInvalid');
          msgDiv.className = 'subscription-status-message error';
          continue;
        }
        try {
          const result = await performSubscriptionForUrl(url, false);
          msgDiv.textContent = t('subImportSuccess');
          msgDiv.className = 'subscription-status-message success';
          const rowIndex = rows.indexOf(row);
          const updatedSubs = getSubscriptions();
          const sub = updatedSubs[rowIndex];
          const infoEl = row.querySelector('.subscription-info');
          if (sub && sub.lastUpdate) {
            const d = new Date(sub.lastUpdate);
            const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            const ruleCount = Array.isArray(sub.rules) ? sub.rules.length : 0;
            infoEl.textContent = `${dateStr} - ${ruleCount}`;
          }
        } catch (err) {
          console.error(`导入失败 [${url}]:`, err);
          msgDiv.textContent = t('subImportFailed');
          msgDiv.className = 'subscription-status-message error';
        }
      }
      subscriptions = getSubscriptions();
      forceReprocessAll();
      const hasErrors = rows.some(r => r.querySelector('.subscription-status-message.error'));
      if (hasErrors) {
        showToast(t('subImportFailed'), 'error');
      } else {
        showToast(t('saved'), 'success');
      }
    };

    document.getElementById('subscription-cancel').onclick = (e) => {
      e.stopPropagation();
      closePanel();
    };

  }

  function showWebDAVPanel() {
    hideStatsPanel();
    const existing = document.getElementById('searchfilter-webdav-panel');
    if (existing) {
      if (typeof existing._cleanupClick === 'function') existing._cleanupClick();
      existing.remove();
      return;
    }

    const webdavConfig = GM_getValue(WEBDAV_KEY, {
      url: '',
      username: '',
      password: '',
      filename: 'rules.txt'
    });

    const panel = createPanel('searchfilter-webdav-panel', '320px', '20px');

    const autoSyncEnabled = GM_getValue(WEBDAV_AUTO_SYNC_KEY, false);
    const syncConfigEnabled = GM_getValue(WEBDAV_SYNC_CONFIG_KEY, false);

    // webdav面板布局
    panel.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0;">
        <h3 style="margin:0;font-size:16px;color:#2d3748;line-height:1;">${t('webdavTitle')}</h3>
        <div style="display:flex;align-items:center;gap:8px;">
            <label style="display:flex !important;align-items:center;font-size:12px;color:#4a5568;cursor:pointer;margin:0;white-space:nowrap;line-height:1;">
                <span class="searchfilter-switch">
                    <input type="checkbox" id="webdav-sync-config" ${syncConfigEnabled ? 'checked' : ''}>
                    <span class="searchfilter-slider"></span>
                </span>
                <span style="line-height:1;">${t('syncScriptConfig')}</span>
            </label>
            <label style="display:flex !important;align-items:center;font-size:12px;color:#4a5568;cursor:pointer;margin:0;white-space:nowrap;line-height:1;">
                <span class="searchfilter-switch">
                    <input type="checkbox" id="webdav-auto-sync" ${autoSyncEnabled ? 'checked' : ''}>
                    <span class="searchfilter-slider"></span>
                </span>
                <span style="line-height:1;">${t('autoSync')}</span>
            </label>
        </div>
    </div>
    <div class="webdav-row"><label>${t('webdavUrl')}</label><input id="webdav-url" type="text" placeholder="https://example.com/dav/files/"></div>
    <div class="webdav-row"><label>${t('webdavUser')}</label><input id="webdav-username" type="text"></div>
    <div class="webdav-row">
        <label>${t('webdavPass')}</label>
        <div style="position: relative; display: flex; align-items: center;">
            <input id="webdav-password" type="password" style="padding-right: 35px !important;">
            <button id="webdav-toggle-password" type="button" style="position: absolute; right: 4px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; padding: 4px; font-size: 16px; line-height: 1; color: #718096; display: flex; align-items: center; justify-content: center; z-index: 1;">🐵</button>
        </div>
    </div>
    <div class="webdav-row"><label>${t('filename')}</label><input id="webdav-filename" type="text" placeholder="rules.txt"></div>
    <div class="webdav-btn-group">
        <button id="webdav-upload" class="searchfilter-button searchfilter-button-success">${t('upload')}</button>
        <button id="webdav-download" class="searchfilter-button searchfilter-button-primary">${t('download')}</button>
        <button id="webdav-cancel" class="searchfilter-button searchfilter-button-secondary">${t('cancel')}</button>
    </div>
`;

    // 获取输入
    const urlInput = document.getElementById('webdav-url');
    const usernameInput = document.getElementById('webdav-username');
    const passwordInput = document.getElementById('webdav-password');
    const filenameInput = document.getElementById('webdav-filename');
    urlInput.value = webdavConfig.url || '';
    usernameInput.value = webdavConfig.username || '';
    passwordInput.value = webdavConfig.password || '';
    filenameInput.value = webdavConfig.filename || 'rules.txt';

    // 密码显隐
    const togglePasswordBtn = document.getElementById('webdav-toggle-password');
    if (togglePasswordBtn && passwordInput) {
      togglePasswordBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const type = passwordInput.type === 'password' ? 'text' : 'password';
        passwordInput.type = type;
        togglePasswordBtn.textContent = type === 'password' ? '🐵' : '🙈';
      });
    }

    function saveWebDAVConfig() {
      const config = {
        url: urlInput.value.trim(),
        username: usernameInput.value.trim(),
        password: passwordInput.value,
        filename: filenameInput.value.trim() || 'rules.txt'
      };
      GM_setValue(WEBDAV_KEY, config);
      return config;
    }

    // 校验面板输入
    function getValidatedWebDAVConfig() {
      const url = urlInput.value.trim();
      if (!url) {
        showToast(t('webdavUrlEmpty'), 'error');
        return null;
      }
      if (!url.toLowerCase().startsWith('https://')) {
        showToast(t('webdavHttpsRequired'), 'error');
        return null;
      }
      return saveWebDAVConfig();
    }

    const closePanel = bindOutsideClickClose(panel);

    // webdav上传
    document.getElementById('webdav-upload').onclick = async () => {
      const config = getValidatedWebDAVConfig();
      if (!config) return;
      const textarea = document.getElementById('searchfilter-rules');
      if (textarea) {
        currentConfig.rules = filterValidRuleLines(textarea.value.split('\n'));
        persistConfig(false);
      }
      let content = textarea ? textarea.value : currentConfig.rules.join('\n');
      content = buildUploadContent(content);
      const loadingToast = showToast(t('webdavUploading'), 'info', 10000);
      try {
        const { fullUrl, headers } = getWebDAVRequest(config);
        const uploadedTime = Date.now();
        await gmRequest('PUT', fullUrl, { headers, data: content });
        GM_setValue(LOCAL_LAST_MODIFIED_KEY, uploadedTime);
        GM_setValue(WEBDAV_LAST_SYNC_KEY, uploadedTime);
        loadingToast.dismiss();
        showToast(t('uploadSuccess'), 'success');
      } catch (err) {
        loadingToast.dismiss();
        showToast(t('webdavUploadFailed') + err.message, 'error', 5000);
      }
    };

    document.getElementById('webdav-auto-sync').onchange = (e) => {
      GM_setValue(WEBDAV_AUTO_SYNC_KEY, e.target.checked);
    };
    document.getElementById('webdav-sync-config').onchange = (e) => {
      GM_setValue(WEBDAV_SYNC_CONFIG_KEY, e.target.checked);
    };

    // webdav下载
    document.getElementById('webdav-download').onclick = async () => {
      const config = getValidatedWebDAVConfig();
      if (!config) return;
      const loadingToast = showToast(t('webdavDownloading'), 'info', 10000);
      try {
        await performWebDAVDownload(config, true);
        loadingToast.dismiss();
        showToast(t('downloadSuccess'), 'success');
      } catch (err) {
        loadingToast.dismiss();
        showToast(t('webdavDownloadFailed') + err.message, 'error', 5000);
      }
    };

    document.getElementById('webdav-cancel').onclick = (e) => {
      e.stopPropagation();
      closePanel();
    };

  }

  async function performWebDAVDownload(config, showAlerts = true) {
    const { fullUrl, headers } = getWebDAVRequest(config);
    const resp = await gmRequest('GET', fullUrl, { headers });
    const content = resp.responseText;
    if (isHtmlResponse(content)) throw new Error(t('subImportFailed'));
    const parsedHeader = parseSyncHeader(content);
    if (parsedHeader.config && GM_getValue(WEBDAV_SYNC_CONFIG_KEY, false)) {
      const { syncedAt, subscriptions, bubbleState, bubbleSize, selectors, ...settings } = parsedHeader.config;
      Object.assign(currentConfig, settings);
      GM_setValue(CONFIG_KEY, currentConfig);
      if (subscriptions) applyCloudSubscriptions(subscriptions);
      if (selectors && typeof selectors === 'object' && !Array.isArray(selectors) && GM_getValue(WEBDAV_SYNC_SELECTORS_KEY, false)) {
        GM_setValue(SELECTORS_KEY, selectors);
        _selectorStoreSignature = getSelectorStoreSignature();
        resetSelectorCache();
        refreshEngineSite();
      }
    }
    const newRules = parsedHeader.restLines.map(r => r.trim()).filter(r => r);
    currentConfig.rules = newRules;
    persistConfig(false);
    let cloudTime = 0;
    if (parsedHeader.config && typeof parsedHeader.config.syncedAt === 'number') {
      cloudTime = parsedHeader.config.syncedAt;
    } else {
      const lastModHeader = resp.responseHeaders && resp.responseHeaders.match(/last-modified:\s*(.+)$/im);
      if (lastModHeader) {
        const parsed = Date.parse(lastModHeader[1].trim());
        if (!isNaN(parsed)) cloudTime = parsed;
      }
    }
    if (cloudTime > 0) {
      GM_setValue(LOCAL_LAST_MODIFIED_KEY, cloudTime);
    }
    const textarea = document.getElementById('searchfilter-rules');
    if (textarea) {
      textarea.value = newRules.join('\n');
      updateLineNumbers();
    }
    forceReprocessAll();
    GM_setValue(WEBDAV_LAST_SYNC_KEY, Date.now());
  }

  // 同步逻辑
  async function performAutoWebDAVSync(config) {
    adoptStoredConfigIfNewer();
    const { fullUrl, headers } = getWebDAVRequest(config);

    const resp = await gmRequest('GET', fullUrl, { headers, allow404: true });

    let cloudRules = [];
    let cloudConfig = null;
    let cloudTime = 0;
    let cloudETag = '';
    let cloudLastMod = '';
    if (resp.status !== 404) {
      const content = resp.responseText;
      if (isHtmlResponse(content)) {
        console.warn('[自动 WebDAV] 云端返回 HTML，已跳过');
        return;
      }
      const parsedHeader = parseSyncHeader(content);
      if (parsedHeader.config && GM_getValue(WEBDAV_SYNC_CONFIG_KEY, false)) {
        cloudConfig = parsedHeader.config;
      }
      cloudRules = parsedHeader.restLines.map(r => r.trim()).filter(r => r);
      let headerTime = 0;
      if (parsedHeader.config && typeof parsedHeader.config.syncedAt === 'number') {
        headerTime = parsedHeader.config.syncedAt;
      }
      let lastModTime = 0;
      if (resp.responseHeaders && typeof resp.responseHeaders === 'string') {
        const lastModMatch = resp.responseHeaders.match(/last-modified:\s*(.*)/i);
        if (lastModMatch) {
          cloudLastMod = lastModMatch[1].trim();
          lastModTime = Date.parse(cloudLastMod) || 0;
        }
        const etagMatch = resp.responseHeaders.match(/etag:\s*(.*)/i);
        if (etagMatch) {
          cloudETag = etagMatch[1].trim();
        }
      }
      cloudTime = headerTime || lastModTime || 0;
      if (isNaN(cloudTime)) cloudTime = 0;
    }

    const localTime = GM_getValue(LOCAL_LAST_MODIFIED_KEY, 0);
    const localRules = currentConfig.rules || [];

    if (cloudTime > localTime) {
      if (cloudConfig) {
        const { syncedAt, subscriptions, bubbleState, bubbleSize, selectors, ...settings } = cloudConfig;
        Object.assign(currentConfig, settings);
        if (subscriptions) applyCloudSubscriptions(subscriptions);
        if (selectors && typeof selectors === 'object' && !Array.isArray(selectors) && GM_getValue(WEBDAV_SYNC_SELECTORS_KEY, false)) {
          GM_setValue(SELECTORS_KEY, selectors);
          _selectorStoreSignature = getSelectorStoreSignature();
          resetSelectorCache();
          refreshEngineSite();
        }
      }
      currentConfig.rules = cloudRules;
      persistConfig(false);
      if (cloudTime > 0) {
        GM_setValue(LOCAL_LAST_MODIFIED_KEY, cloudTime);
      }
    } else if (localTime > cloudTime || resp.status === 404) {
      const localContent = localRules.join('\n');
      const cloudContent = cloudRules.join('\n');
      if (resp.status !== 404 && localContent === cloudContent) {
        if (cloudTime > 0) {
          GM_setValue(LOCAL_LAST_MODIFIED_KEY, cloudTime);
        }
      } else {
        console.log('[自动 WebDAV] 本地配置较新，上传中...');
        const uploadedTime = Math.max(Date.now(), cloudTime + 1);
        const uploadData = buildUploadContent(localContent, uploadedTime);
        const putHeaders = { ...headers };
        if (resp.status !== 404) {
          if (cloudETag && !cloudETag.startsWith('W/')) putHeaders['If-Match'] = cloudETag;
          else if (cloudLastMod) putHeaders['If-Unmodified-Since'] = cloudLastMod;
        }
        try {
          await gmRequest('PUT', fullUrl, { headers: putHeaders, data: uploadData });
          GM_setValue(LOCAL_LAST_MODIFIED_KEY, uploadedTime);
        } catch (err) {
          console.warn('[自动 WebDAV] 上传冲突或失败:', err.message);
          return;
        }
      }
    }

    forceReprocessAll();
    GM_setValue(WEBDAV_LAST_SYNC_KEY, Date.now());
  }

  function checkAutoWebDAV() {
    if (!GM_getValue(WEBDAV_AUTO_SYNC_KEY, false)) return;
    const config = GM_getValue(WEBDAV_KEY);
    if (!config || !config.url) return;
    if (Date.now() - GM_getValue(WEBDAV_LAST_SYNC_KEY, 0) < AUTO_UPDATE_INTERVAL) return;
    if (document.getElementById('searchfilter-panel')) return;
    runWithSyncLock('webdav', async () => {
      if (Date.now() - GM_getValue(WEBDAV_LAST_SYNC_KEY, 0) < AUTO_UPDATE_INTERVAL) return;
      await performAutoWebDAVSync(config);
    }).catch(err => console.error('[自动 WebDAV] 同步失败:', err.message));
  }

  // TXT导入
  function importRulesFromFile() {
    preventPanelClose = true;
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.txt,text/plain';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);

    let cleanedUp = false;
    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      window.removeEventListener('focus', onWindowFocus);
      fileInput.remove();
      preventPanelClose = false;
    };
    const onWindowFocus = () => {
      setTimeout(() => {
        if (!fileInput.files || fileInput.files.length === 0) cleanup();
      }, 300);
    };

    fileInput.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) {
        cleanup();
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        let content = event.target.result;
        content = parseSyncHeader(content).restLines.join('\n');
        const textarea = document.getElementById('searchfilter-rules');
        if (textarea) {
          textarea.value = content;
          updateLineNumbers();
        }
        cleanup();
      };
      reader.onerror = cleanup;
      reader.readAsText(file, 'UTF-8');
    };
    fileInput.addEventListener('cancel', cleanup);
    window.addEventListener('focus', onWindowFocus);
    fileInput.click();
  }

  // TXT导出
  function exportRulesToFile() {
    preventPanelClose = true;
    const textarea = document.getElementById('searchfilter-rules');
    const content = textarea.value;
    if (!content.trim()) {
      alert(t('noRulesExport'));
      preventPanelClose = false;
      return;
    }
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const filename = `rules-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.txt`;
    const blob = new Blob([content], {
      type: 'text/plain;charset=utf-8'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    preventPanelClose = false;
  }

  // 管理器菜单
  function registerToggleMenu(labelKey, isOn, onText, offText, markerOn, markerOff, apply) {
    const on = isOn();
    GM_registerMenuCommand((on ? markerOn : markerOff) + t(labelKey) + (on ? `: ${t(onText)}` : `: ${t(offText)}`), () => {
      apply();
      persistConfig();
      location.reload();
    });
  }

  function registerMenu() {
    GM_registerMenuCommand(t('menuOpenPanel'), () => showConfigPanel());
    registerToggleMenu('menuErrorDetection', () => currentConfig.errorDetection !== false, 'stateEnabled', 'stateDisabled', '🟢 ', '🔴 ', () => {
      currentConfig.errorDetection = currentConfig.errorDetection === false ? true : false;
    });
    registerToggleMenu('menuCenter', () => currentConfig.panelCentered, 'stateEnabled', 'stateDisabled', '🟢 ', '🔴 ', () => {
      currentConfig.panelCentered = !currentConfig.panelCentered;
    });
    registerToggleMenu('menuBubble', () => currentConfig.showBubble, 'menuBubbleStateShow', 'menuBubbleStateHide', '🟢 ', '🔴 ', () => {
      currentConfig.showBubble = !currentConfig.showBubble;
    });
    registerToggleMenu('menuBubbleAction', () => currentConfig.bubbleAction === 'openPanel', 'menuBubbleActionOpen', 'menuBubbleActionToggle', '🟢 ', '🔵 ', () => {
      currentConfig.bubbleAction = currentConfig.bubbleAction === 'openPanel' ? 'toggleHidden' : 'openPanel';
    });
    const langDisplay = currentConfig.language === 'zh-CN' ? t('menuLang') : t('menuLangEn');
    GM_registerMenuCommand((currentConfig.language === 'zh-CN' ? '🟢 ' : '🔵 ') + langDisplay, () => {
      currentConfig.language = currentConfig.language === 'zh-CN' ? 'en' : 'zh-CN';
      persistConfig();
      location.reload();
    });
    GM_registerMenuCommand(t('menuHighlightColor'), () => showHighlightColorPanel());
  }

  // 跨标签页同步锁
  const SYNC_LOCK_KEY_PREFIX = 'searchfilter_sync_lock_';
  const SYNC_LOCK_TTL = 2 * 60 * 1000;
  const SYNC_TAB_ID = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function readSyncLock(task) {
    const raw = GM_getValue(SYNC_LOCK_KEY_PREFIX + task);
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    return raw;
  }

  function writeSyncLock(task, lock) {
    GM_setValue(SYNC_LOCK_KEY_PREFIX + task, lock);
  }

  function tryAcquireSyncLock(task, ttl = SYNC_LOCK_TTL) {
    const now = Date.now();
    const held = readSyncLock(task);
    if (held && held.owner !== SYNC_TAB_ID && held.expires > now) return false;
    writeSyncLock(task, { owner: SYNC_TAB_ID, expires: now + ttl });
    return true;
  }

  async function acquireSyncLock(task, ttl = SYNC_LOCK_TTL) {
    if (!tryAcquireSyncLock(task, ttl)) return false;
    await delay(120 + Math.floor(Math.random() * 180));
    const held = readSyncLock(task);
    return !!held && held.owner === SYNC_TAB_ID && held.expires > Date.now();
  }

  function renewSyncLock(task, ttl = SYNC_LOCK_TTL) {
    const held = readSyncLock(task);
    if (!held || held.owner !== SYNC_TAB_ID) return false;
    writeSyncLock(task, { owner: SYNC_TAB_ID, expires: Date.now() + ttl });
    return true;
  }

  function releaseSyncLock(task) {
    const held = readSyncLock(task);
    if (held && held.owner === SYNC_TAB_ID) GM_setValue(SYNC_LOCK_KEY_PREFIX + task, null);
  }

  async function runWithSyncLock(task, fn) {
    if (!(await acquireSyncLock(task))) return;
    const renewTimer = setInterval(() => renewSyncLock(task), Math.max(5000, Math.floor(SYNC_LOCK_TTL / 3)));
    try {
      await fn();
    } finally {
      clearInterval(renewTimer);
      releaseSyncLock(task);
    }
  }

  // 订阅
  function checkAutoSubscription() {
    if (!currentConfig.subscriptionAutoUpdate) return;
    const subs = getSubscriptions();
    if (!subs || subs.length === 0) return;
    const now = Date.now();
    if (!subs.some(s => s.enabled && now - s.lastUpdate >= AUTO_UPDATE_INTERVAL)) return;
    runWithSyncLock('subscription', async () => {
      const pending = getSubscriptions().filter(s => s.enabled && Date.now() - s.lastUpdate >= AUTO_UPDATE_INTERVAL);
      if (!pending.length) return;
      for (const sub of pending) {
        console.log(`[订阅] 开始更新: ${sub.url}`);
        try {
          await performSubscriptionForUrl(sub.url, false);
        } catch (err) {
          console.error(`[订阅] 更新失败: ${sub.url}`, err.message);
        }
      }
      forceReprocessAll();
    }).catch(err => console.error('[订阅] 更新失败:', err.message));
  }

  // 同步定时器
  function startBackgroundSync() {
    if (_syncIntervalIds.length) return;
    _syncIntervalIds = [
      setInterval(checkAutoSubscription, 60 * 60 * 1000),
      setInterval(checkAutoWebDAV, 60 * 60 * 1000)
    ];
    _syncInitialTimeout = setTimeout(() => {
      _syncInitialTimeout = null;
      checkAutoSubscription();
      checkAutoWebDAV();
    }, 5000 + Math.floor(Math.random() * 5000));
  }

  // 站点运行环境
  function ensureEngineSiteSetup() {
    if (_engineSiteSetup || !isEngineSite()) return;
    _engineSiteSetup = true;
    injectGlobalStyles();
    buildRuleIndex();
    exposeDebugApi();
    updateStatus(0);
    scanNewResults();

    let _scanPending = false;
    _domObserver = new MutationObserver((mutations) => {
      if (mutations.some(m => m.addedNodes.length > 0)) {
        if (_scanPending) return;
        _scanPending = true;
        requestAnimationFrame(() => {
          _scanPending = false;
          scanNewResults();
        });
      }
    });
    _domObserver.observe(document.body, {
      childList: true,
      subtree: true
    });

    const searchForm = document.querySelector('form[role="search"], form[name="search"], form[action*="search"]');
    if (searchForm) {
      _searchForm = searchForm;
      _searchFormHandler = () => setTimeout(forceReprocessAll, 800);
      searchForm.addEventListener('submit', _searchFormHandler);
    }

    // 切换感知
    if (!_urlChangeHandler) {
      let lastHref = location.href;
      let lastCategory = getSearchCategory();
      _urlChangeHandler = () => {
        const currentHref = location.href;
        const currentCat = getSearchCategory();
        if (currentHref !== lastHref || currentCat !== lastCategory) {
          lastHref = currentHref;
          lastCategory = currentCat;
          resetSelectorCache();
          refreshEngineSite();
        }
      };
      window.addEventListener('popstate', _urlChangeHandler);
      window.addEventListener('hashchange', _urlChangeHandler);

      const wrapHistoryMethod = (method) => {
        const orig = history[method];
        if (typeof orig === 'function') {
          history[method] = function(...args) {
            const ret = orig.apply(this, args);
            try {
              window.dispatchEvent(new Event('searchfilter:locationchange'));
            } catch (e) {}
            return ret;
          };
        }
      };
      wrapHistoryMethod('pushState');
      wrapHistoryMethod('replaceState');
      window.addEventListener('searchfilter:locationchange', _urlChangeHandler);
    }
  }

  function teardownEngineSite() {
    if (!_engineSiteSetup) return;
    _engineSiteSetup = false;
    forceReprocessBatchId++;
    if (_domObserver) {
      _domObserver.disconnect();
      _domObserver = null;
    }
    yandexParentTimeouts.forEach(clearTimeout);
    yandexParentTimeouts.clear();
    if (_searchForm && _searchFormHandler) {
      _searchForm.removeEventListener('submit', _searchFormHandler);
    }
    _searchForm = null;
    _searchFormHandler = null;
    document.querySelectorAll('.searchfilter-quick-block').forEach(btn => btn.remove());
    const confirmPanel = document.getElementById('searchfilter-block-confirm-dialog');
    if (confirmPanel) confirmPanel.remove();
    document.querySelectorAll('[data-blocker-yandex-parent]').forEach(el => {
      el.style.display = '';
      el.removeAttribute('data-blocker-yandex-parent');
    });
    document.querySelectorAll('[data-observed]').forEach(el => {
      resultObserver.unobserve(el);
      el.removeAttribute('data-observed');
      resetResultStyles(el);
    });
    showHiddenResults = false;
    _observedSelector = '';
    const status = document.getElementById('searchfilter-status');
    if (status) status.remove();
    removeGlobalStyles();
  }

  function refreshEngineSite() {
    const wasEngine = _engineSiteSetup;
    if (isEngineSite()) {
      ensureEngineSiteSetup();
      if (wasEngine) injectGlobalStyles();
      forceReprocessAll();
    } else if (wasEngine) {
      teardownEngineSite();
    }
  }

  function getSelectorStoreSignature() {
    try {
      return JSON.stringify(GM_getValue(SELECTORS_KEY) ?? null);
    } catch (e) {
      return null;
    }
  }

  function checkExternalSelectorChange() {
    const signature = getSelectorStoreSignature();
    if (signature === null) return false;
    if (_selectorStoreSignature === signature) return false;
    const isBaseline = _selectorStoreSignature === null;
    _selectorStoreSignature = signature;
    if (isBaseline) return false;
    resetSelectorCache();
    refreshEngineSite();
    return true;
  }

  function adoptStoredConfigIfNewer() {
    const stored = GM_getValue(CONFIG_KEY);
    if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return false;
    try {
      if (JSON.stringify(stored) === JSON.stringify(currentConfig)) return false;
    } catch (e) {
      return false;
    }
    currentConfig = stored;
    return true;
  }

  // 多标签页感知
  function checkExternalConfigChange() {
    if (document.getElementById('searchfilter-panel')) return false;
    if (!adoptStoredConfigIfNewer()) return false;
    forceReprocessAll();
    return true;
  }

  function init() {
    migrateSubscriptions();
    pruneUserSelectors();
    _selectorStoreSignature = getSelectorStoreSignature();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        checkExternalSelectorChange();
        checkExternalConfigChange();
      }
    });

    startBackgroundSync();

    if (isEngineSite()) {
      ensureEngineSiteSetup();
    }
    exposeDebugApi();

    registerMenu();
    GM_registerMenuCommand(t('menuCustomSelectors'), showSelectorPanel);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else setTimeout(init, 1000);
})();
