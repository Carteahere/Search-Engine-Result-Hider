// ==UserScript==
// @name         搜索引擎结果屏蔽器 Lite
// @name:zh-CN   搜索引擎结果屏蔽器 Lite
// @name:en      Search Engine Result Hider Lite
// @namespace    https://github.com/Carteahere
// @version      8.6.7
// @description        支持正则的搜索结果屏蔽工具。Lite版移除了所有规则订阅/webdav相关内容。
// @description:zh-CN  支持正则的搜索结果屏蔽工具。Lite版移除了所有规则订阅/webdav相关内容。
// @description:en     A search result blocking tool that supports regular expressions. The Lite version has removed all content related to Rule Subscriptions and WebDAV.
// @icon         data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjQgNCAxNiAxNiIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjMmM1MjgyIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgc3R5bGU9Im92ZXJmbG93OnZpc2libGUhaW1wb3J0YW50OyI+PGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iNyI+PC9jaXJjbGU+PGxpbmUgeDE9IjcuNDUiIHkxPSI3LjQ1IiB4Mj0iMTYuNTUiIHkyPSIxNi41NSI+PC9saW5lPjwvc3ZnPg==
// @author       南雪莲
// @homepageURL  https://greasyfork.org/zh-CN/scripts/552394
// @homepageURL  https://github.com/Carteahere/Search-Engine-Result-Hider
// @license      GPL-3.0
// @match        *://*/*
// @noframes
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @grant        GM_deleteValue
// @run-at       document-idle
// @downloadURL  https://raw.githubusercontent.com/Carteahere/Search-Engine-Result-Hider/main/Other/Lite.user.js
// @updateURL    https://raw.githubusercontent.com/Carteahere/Search-Engine-Result-Hider/main/Other/Lite.user.js
// ==/UserScript==

(function() {
  'use strict';

  if (window.top !== window.self) return; let preventPanelClose = false, _engineSiteSetup = false, _domObserver = null, _observedSelector = '';
  let _searchForm = null, _searchFormHandler = null, _urlChangeHandler = null;
  let _hrefUrlCache = new WeakMap(), _resultContentCache = new WeakMap(), _resultRetryCounts = new WeakMap(); const _hrefChangedContainers = new Set(), _contentChangedContainers = new Set();

  const CONFIG_KEY = 'searchfilter_blocker', SELECTORS_KEY = 'searchfilter_selectors';
  const HL_STATS_REGEX = /^@\d+/;
  const RESULT_RETRY_LIMIT = 3, RESULT_RETRY_DELAY = 200;

  const CFG_DEFAULTS = { enabled: true, showBlockBtn: false, blockDomain: false, blockConfirm: true, showMatchedSource: true, showBubble: true, panelCentered: true, bubbleAction: 'openPanel', autoDark: true, exportConfig: false, collapseMode: false, removeRedirects: true, bracketHighlight: true, language: 'zh-CN' };
  const DEFAULT_HIGHLIGHT_COLORS = {1:'#CE2029', 2:'#FF8C00', 3:'#FFD700', 4:'#228B22', 5:'#1E90FF'};
  function getDefaultConfig() {
    return {
      rules: ['*://*.example.com/*'],
      showCount: false,
      bubbleSize: 30,
      debug: false,
      bubbleState: null,
      errorDetection: true,
      ...CFG_DEFAULTS,
      highlightColors: { ...DEFAULT_HIGHLIGHT_COLORS }
    };
  }
  function normalizeConfig(cfg) {
    if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) cfg = {};
    if (!Array.isArray(cfg.rules)) cfg.rules = []; cfg.rules = cfg.rules.filter(rule => typeof rule === 'string');
    for (const k in CFG_DEFAULTS) if (cfg[k] === undefined) cfg[k] = CFG_DEFAULTS[k];
    if (!cfg.highlightColors || typeof cfg.highlightColors !== 'object') cfg.highlightColors = {...DEFAULT_HIGHLIGHT_COLORS};
    else cfg.highlightColors = Object.assign({}, DEFAULT_HIGHLIGHT_COLORS, cfg.highlightColors);
    return cfg;
  }
  let currentConfig = normalizeConfig(GM_getValue(CONFIG_KEY, getDefaultConfig()));
  ['searchfilter_rule_tombstones', 'searchfilter_subscription_tombstones', 'searchfilter_rule_added_times'].forEach(k => {
    if (typeof GM_deleteValue === 'function') GM_deleteValue(k);
  });
  if (currentConfig && typeof currentConfig === 'object') {
    delete currentConfig.tombstones; delete currentConfig.ruleAddedTimes; delete currentConfig.subscriptionTombstones;
  }
  let showHiddenResults = false;

  const SELECTORS = {
    bing: {
      match: /^(?:(?:www[2-4]?|cn|global|m)\.)?bing\.(?:com|[a-z]{2,3}(?:\.[a-z]{2})?)$/,
      containers: 'li.b_algo, div.b_algo',
      titles: ['h2 a', 'a h2', '.b_title'],
      snippets: ['.b_caption p', '.b_snippet', '.b_paractl p', '.b_lineclamp2'],
      links: ['h2 a[href]', '.b_title a[href]', '.b_algoheader a[href]', 'h3 a[href]', 'div[role="heading"] a[href]', 'a[href]'],
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
    duckduckgo_lite: {
      match: /^lite\.duckduckgo\.com$/,
      containers: 'tr:has(.result-link)',
      titles: ['.result-link'],
      snippets: ['.result-snippet'],
      links: ['a.result-link[href]'],
      extraElements: ['+ tr:not(:has(.result-link))', '+ tr:not(:has(.result-link)) + tr:not(:has(.result-link))', '+ tr:not(:has(.result-link)) + tr:not(:has(.result-link)) + tr:not(:has(.result-link))'],
    },
    duckduckgo: {
      match: /^(?:(?:www|html|start|m|safe|noai)\.)?(?:duckduckgo\.com|ddg\.gg)$/,
      containers: '[data-testid="result"], [data-testid="web-vertical"] li > article, .result, .web-result, .tile',
      titles: ['a[data-testid="result-title-a"]', '.result__title', '.tile__title', '.tile--title__title', 'h2 a', 'a h2', 'h2'],
      snippets: ['[data-testid="result-snippet"]', '[data-result="snippet"]', '.result__snippet'],
      links: ['a[data-testid="result-extras-url-link"]', 'a[data-testid="result-title-a"]', 'h2 > a', '.result__url', 'a[href]'],
    },
    yandex: {
      match: /^(?:(?:www|m)\.)?(?:ya\.ru|yandex\.(?:[a-z]{2,3}(?:\.[a-z]{2})?|[a-z]{4,}))$/,
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
    ecosia: {
      match: /^(?:(?:www|m)\.)?ecosia\.org$/,
      containers: 'article[data-test-id="organic-result"], article[data-test-id="videos-result"], article[data-test-id="news-result"], article[data-test-id="images-result"]',
      titles: ['h2[data-test-id="result-title"]', '.result-title__heading', 'h2.image-result__details-title', 'h2'],
      snippets: ['[data-test-id="web-result-description"]', '[data-test-id="news-result-description"]', '.web-result__description', '.news-result__description', '.video-result__description', '.result__description'],
      links: ['a[data-test-id="result-link"][href]', 'a.image-result__details-link[href]', 'a.image-result__link[href]', 'a[href]'],
    },
    startpage: {
      match: /^(?:(?:www|eu|m)\.)?startpage\.com$/,
      containers: 'div.result, .w-gl__result',
      titles: ['a.result-link', 'h2.wgl-title', 'a.wgl-site-title', '.w-gl__result-title'],
      snippets: ['p.description', '.result__main > p', '.w-gl__description'],
      links: ['a.result-link[href]', 'a.wgl-site-title[href]', 'a.wgl-display-url[href]', 'a.display-url[href]', '.w-gl__result-title[href]', 'a[href]'],
    },
    yahoo: {
      match: /^(?:[a-z]{2,6}\.)?(?:(?:images|video|videos|news)\.)?(?:r\.)?search\.yahoo\.(?:com|[a-z]{2,3}(?:\.[a-z]{2})?)$/,
      containers: '.sw-Card.Algo, li.b_algo, div.b_algo, #web .algo, .algo-sr, .richAlgo',
      titles: ['h3', '.s-title', 'h2 a', 'a h2', '.b_title', '.title'],
      snippets: ['.sw-Card__description', '.sw-Card__snippet', '.sw-Text__body', 'p', '.b_caption p', '.b_snippet', '.b_paractl p'],
      links: ['h3 a', '.s-title', '.sw-Card__title a', 'a[data-ylk*="slk:title"]', 'a.ac-algo', 'a[data-y-link-id]'],
    },
    so360: {
      match: /^(?:www\.|m\.)?so\.com$/,
      containers: 'li.res-list, div.res-list',
      titles: ['h3.res-title a', 'h3 a', '.res-title', '.g-title a', '.g-title'],
      snippets: ['.res-desc', '.mh-desc', '.summary'],
      links: ['h3 a[href]', 'a.alink[href]', '.g-linkinfo a[href]', 'a[href]'],
    },
    sogou: {
      match: /^(?:www\.|m\.|wap\.)?sogou\.com$/,
      containers: 'div.vrwrap:has(h3), .reactResult, div.vrResult',
      titles: ['h3.vr-title a', '.vr-title a', 'a[class*="saTitle"]', '.vr-title', 'h3.vr-tit', 'h3 a', 'h3'],
      snippets: ['.space-txt', '.star-wiki', '.str_info', 'p.sa-text-clamp3', '[class*="saText"]'],
      links: ['h3.vr-title a[href]', '.vr-title a[href]', 'a[class*="saTitle"][href]', 'h3 a[href]', 'a.citeLinkClass[href]', 'a[href]'],
    },
    toutiao: {
      match: /^so\.toutiao\.com$/,
      containers: '.result-content',
      titles: ['.l-card-title a', '.l-card-title', '.cs-header a', 'a[href*="/search/jump"]'],
      snippets: ['.l-paragraph', '.cs-card-content .text-regular', '.l-source', '.cs-source'],
      links: ['a.l-card-title[href]', '.cs-header a[href]', 'a[href*="/search/jump"]', 'a[href]:not([href*="/search?"])'],
    },
    quark: {
      match: /^(?:(?:quark|yz)\.)?(?:(?:www|m)\.)?sm\.cn$/,
      containers: 'div.qk-card',
      titles: ['.qk-title-text', '.qk-title', 'a.qk-link-wrapper'],
      snippets: ['.qk-paragraph-text', '.qk-paragraph'],
      links: ['a.qk-title a[href]', '.qk-title a[href]', 'a.qk-link-wrapper[href]', 'a[href]'],
    },
    other: {
      containers: '',
      titles: [],
      snippets: [],
      links: 'a[href]',
    }
  };

  let activeSelectors = null; let _selectorStoreSignature = null;

  function normalizeSelectorList(value) {
    if (Array.isArray(value)) return value.filter(s => typeof s === 'string' && s); if (typeof value === 'string' && value) return [value]; return [];
  }

  const builtinSelectorOf = (key) => (SELECTORS[key] && typeof SELECTORS[key] === 'object') ? SELECTORS[key] : {};
  function mergeSelectorDef(def, base) {
    const links = def.links !== undefined ? (Array.isArray(def.links) ? normalizeSelectorList(def.links) : (typeof def.links === 'string' && def.links ? def.links : 'a[href]')) : (base.links || 'a[href]');
    return {
      containers: typeof def.containers === 'string' ? def.containers : (base.containers || ''),
      titles: def.titles !== undefined ? normalizeSelectorList(def.titles) : (base.titles || []),
      snippets: def.snippets !== undefined ? normalizeSelectorList(def.snippets) : (base.snippets || []),
      extraElements: def.extraElements !== undefined ? normalizeSelectorList(def.extraElements) : (base.extraElements || []),
      links: links.length ? links : 'a[href]'
    };
  }

  function getUserSelectors() {
    const raw = GM_getValue(SELECTORS_KEY); if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}; return raw;
  }

  function getSelectors() {
    if (activeSelectors) return activeSelectors; const merged = {}; const user = getUserSelectors(); const userKeys = Object.keys(user).filter(k => k !== 'other');
    for (const key of userKeys) {
      const def = user[key]; if (!def || typeof def !== 'object' || Array.isArray(def)) continue;
      if (def.disabled === true || def.disable === true) {
        const base = builtinSelectorOf(key); merged[key] = { ...mergeSelectorDef(def, base), match: def.match !== undefined ? def.match : base.match, disabled: true }; continue;
      }
      const defContentKeys = Object.keys(def).filter(k => k !== 'disabled' && k !== 'disable' && def[k] !== undefined && def[k] !== null && def[k] !== '');
      if (!defContentKeys.length) {
        if (SELECTORS[key]) merged[key] = SELECTORS[key]; continue;
      }
      const base = builtinSelectorOf(key); let match = base.match || null;
      try {
        if (typeof def.match === 'string' && def.match) {
          match = new RegExp(def.match);
        } else if (def.match && typeof def.match === 'object' && typeof def.match.source === 'string' && def.match.source) {
          match = new RegExp(def.match.source, String(def.match.flags || '').toLowerCase().replace(/[^imsu]/g, ''));
        }
      } catch (e) { match = null; }
      merged[key] = { ...mergeSelectorDef(def, base), match };
    }
    for (const key of Object.keys(SELECTORS)) {
      if (!(key in merged)) merged[key] = SELECTORS[key];
    }
    const keys = Object.keys(merged); const gIdx = keys.indexOf('google'); const gsIdx = keys.indexOf('google_scholar');
    if (gIdx !== -1 && gsIdx !== -1 && gIdx < gsIdx) {
      const fixed = {};
      for (const k of keys) {
        if (k === 'google') {
          fixed['google_scholar'] = merged['google_scholar']; fixed['google'] = merged['google'];
        } else if (k !== 'google_scholar') {
          fixed[k] = merged[k];
        }
      }
      activeSelectors = fixed; return fixed;
    }
    activeSelectors = merged; return merged;
  }

  function resetSelectorCache() {
    activeSelectors = null; _engineCacheHost = null; _engineCacheResult = 'other'; _observedSelector = '';
  }

  let _engineCacheHost = null; let _engineCacheResult = 'other';
  function getSearchEngine() {
    const loc = window.location || {}; const hostname = String(loc.hostname || ''); const href = String(loc.href || ''); const cacheKey = href || hostname;
    if (_engineCacheHost === cacheKey) return _engineCacheResult; _engineCacheHost = cacheKey; const defs = getSelectors();
    for (const name of Object.keys(defs)) {
      const def = defs[name]; if (!def || def.disabled || !def.match) continue; if (def.match.test(hostname)) return (_engineCacheResult = name);
      if (def !== SELECTORS[name] && href && /:(?:\\?\/){2}/i.test(def.match.source) && def.match.test(href)) {
        return (_engineCacheResult = name);
      }
    }
    return (_engineCacheResult = 'other');
  }

  function getSearchCategory(loc) {
    loc = loc || window.location; if (!loc) return 'web'; let path = String(loc.pathname || '').toLowerCase(); let search = String(loc.search || '').toLowerCase();
    const host = String(loc.hostname || '').toLowerCase();
    if ((!path || !search) && loc.href) {
      try {
        const u = new URL(loc.href); if (!path) path = u.pathname.toLowerCase(); if (!search) search = u.search.toLowerCase();
      } catch (e) {}
    }
    if (/^images\./.test(host) || /(?:^|\/)images?(?:\/|$)/.test(path) || /[?&](?:tbm=isch|udm=2|iax?=images)(?:&|$)/.test(search)) return 'images';
    if (/^videos?\./.test(host) || /(?:^|\/)videos?(?:\/|$)/.test(path) || /[?&](?:tbm=vid|udm=7|iax?=videos)(?:&|$)/.test(search)) return 'videos';
    if (/^news\./.test(host) || /(?:^|\/)news(?:\/|$)/.test(path) || /[?&](?:tbm=nws|udm=12|iax?=news)(?:&|$)/.test(search)) return 'news';
    if (/(?:^|\.)toutiao\.com$/.test(host)) {
      const pd = (search.match(/[?&]pd=([a-z_]+)(?:&|$)/) || [])[1] || '';
      if (pd === 'atlas') return 'images'; if (pd === 'information') return 'news'; if (pd.indexOf('video') !== -1) return 'videos';
    }
    if (/(?:^|\.)startpage\.com$/.test(host)) {
      const cat = (search.match(/[?&]cat=([a-z]+)(?:&|$)/) || [])[1] || '';
      if (cat === 'images' || cat === 'video' || cat === 'news') return cat === 'video' ? 'videos' : cat;
    }
    return 'web';
  }

  function isBingImagesPage(engine) {
    return engine === 'bing' && getSearchCategory() === 'images';
  }

  function getContainerSelector(engine) {
    if (isBingImagesPage(engine)) return 'li:has(div.iuscp), div.iuscp, div.imgpt';
    if (engine === 'google' && getSearchCategory() === 'images') return 'div[data-attrid="images universal"], div.isv-r';
    if (engine === 'duckduckgo' && getSearchCategory() === 'images') return 'li:has(> figure), figure';
    if (engine === 'yandex' && getSearchCategory() === 'images') return '.JustifierRowLayout-Item, div.SerpItem';
    if (engine === 'brave' && getSearchCategory() === 'images') return 'button.image-result, .image-wrapper';
    return (getSelectors()[engine] || SELECTORS.other).containers;
  }

  function isEngineSite() {
    return getSearchEngine() !== 'other';
  }

  const LANG_TEXTS = {
    'zh-CN': {
      disableBlock: '临时禁用', showCount: '显示数量', debugMode: '调试模式',
      enableFeature: '启用功能', blockDomain: '屏蔽域名', doubleConfirm: '二次确认', showMatchedSource: '来源显示',
      autoDark: '自动深色', exportConfig: '导出配置', collapseMode: '折叠模式', collapseModeHint: '开启后屏蔽结果只显示标题',
      bracketHighlight: '括号高亮',
      settingsBtn: '设置', settingsPanelTitle: '脚本设置',
      settingsSecBlock: '一键屏蔽', settingsSecUI: '界面显示', settingsSecOther: '其他设置', removeRedirects: '去除重定向',
      bubbleSize: '悬浮球:', blockRules: '规则：',
      import: '导入', export: '导出', save: '保存',
      stats: '统计', close: '关闭', cancel: '取消',
      placeholder: '每行一个规则',
      matchedRule: '规则', localRule: '本地规则',
      urlRule: 'URL规则', titleRule: '标题规则', textRule: '正文规则',
      regexRule: '正则规则', statsCompound: '复合规则', noMatch: '无匹配项',
      whitelistRules: '白名单规则',
      menuOpenPanel: '⚙️ 打开面板', menuErrorDetection: '规则自检',
      menuCenter: '面板居中', menuBubble: '显示悬浮球', menuBubbleAction: '悬浮球功能', menuLanguage: 'Language',
      saved: '已保存',
      noRulesExport: '没有规则可导出',
      bcDomain: '域名', bcExact: '精确', bcWhitelist: '白名单',
      bcDelete: '删除', bcConfirm: '确认',
      cannotBlockCurrentSite: '无法屏蔽当前搜索引擎自身域名: {domain}',
      statsErrors: '发现 {count} 个规则错误: ',
      matchedCountLabel: '匹配', matchedCountUnit: '条',
      menuBubbleStateShow: '显示', menuBubbleStateHide: '隐藏',
      menuBubbleActionOpen: '打开面板', menuBubbleActionStats: '打开统计', menuBubbleActionToggle: '显隐结果',
      bubbleStatsHint: '点击打开统计，长按打开面板',
      bubbleToggleHint: '点击显示/隐藏屏蔽结果，长按打开面板',
      stateEnabled: '启用', stateDisabled: '关闭',
      subImportFailed: '导入失败，请检查链接或网络状态',
      highlightRules: '高亮规则', menuHighlightColor: '🎨 高亮颜色',
      hlColorTitle: '高亮颜色', hlColorReset: '重置', resetPending: '已重置，保存后生效', hlColorHint: '点击色块快速保存',
      errorWord: '错误', warningWord: '警告',
      statsWarnings: '发现 {count} 个规则警告: ',
      duplicateRules: '重复规则', invalidRule: '规则无效',
      hlColorError: '高亮级别需在 1-5 之间',
      ifParenError: '@if(...) 括号未闭合',
      condRegexError: '条件正则无效: {part}',
      regexError: '正则表达式无效', urlError: 'URL规则无效',
      ruleDuplicate: '重复了 {count} 次', emptyPrefixRule: '规则前缀后缺少内容',
      invalidRegexFlags: '正则 flags 无效: {flags}',
      emptyIfCondition: '@if() 条件不能为空', unknownIfCondition: '未知 @if 条件: {part}',
      condExprError: '@if 表达式语法错误: {part}',
      invalidUrlWildcard: 'URL 通配符格式无效: {rule}', elementRuleUnsupported: '不支持元素规则',
      menuCustomSelectors: '🖋️ 自定义引擎', selectorPanelTitle: '引擎选择器',
      selectorHint: '如果不知道有什么用，请勿修改。',
      selectorJsonError: '解析失败，请检查格式',
      selectorReservedKey: '保留键不可使用: {key}',
      selectorInvalidKey: '引擎ID仅允许字母/数字/_/-: {key}',
      selectorInvalidRegex: 'match 正则无效: {key}',
      selectorInvalidCss: 'CSS 选择器无效: {key}.{field}: {value}',
      selectorFieldRequired: '字段必填: {key}.{field}',
      selectorInvalidBool: '字段必须为布尔值: {key}.{field}',
    },
    'en': {
      disableBlock: 'Disable Block', showCount: 'Show Count', debugMode: 'Debug Mode',
      enableFeature: 'Enable Feature', blockDomain: 'Block Domain', doubleConfirm: 'Double Confirm', showMatchedSource: 'Show Source',
      autoDark: 'Auto Dark', exportConfig: 'Export Config', collapseMode: 'Collapse Mode', collapseModeHint: 'Blocked results will show titles only',
      bracketHighlight: 'Highlight Bracket',
      settingsBtn: 'Settings', settingsPanelTitle: 'Script Settings',
      settingsSecBlock: 'One-click Block', settingsSecUI: 'Interface', settingsSecOther: 'Other', removeRedirects: 'Remove redirects',
      bubbleSize: 'Bubble:', blockRules: 'Rules:',
      import: 'Import', export: 'Export', save: 'Save',
      stats: 'Stats', close: 'Close', cancel: 'Cancel',
      placeholder: 'One rule per line',
      matchedRule: 'Rule', localRule: 'Local Rule',
      urlRule: 'URL Rule', titleRule: 'Title Rule', textRule: 'Text Rule',
      regexRule: 'Regex Rule', statsCompound: 'Compound Rule', noMatch: 'No matches',
      whitelistRules: 'Whitelist Rules',
      menuOpenPanel: '⚙️ Open Panel', menuErrorDetection: 'Rules Detection',
      menuCenter: 'Center Panel', menuBubble: 'Show Bubble', menuBubbleAction: 'Bubble Action', menuLanguage: 'Language',
      saved: 'Saved',
      noRulesExport: 'No rules to export',
      bcDomain: 'Domain', bcExact: 'Exact', bcWhitelist: 'Whitelist',
      bcDelete: 'Delete', bcConfirm: 'Confirm',
      cannotBlockCurrentSite: 'Cannot block search engine own domain: {domain}',
      statsErrors: 'Found {count} rule errors:',
      matchedCountLabel: 'Hits', matchedCountUnit: 'Rule',
      menuBubbleStateShow: 'Show', menuBubbleStateHide: 'Hide',
      menuBubbleActionOpen: 'Open Panel', menuBubbleActionStats: 'Open Stats', menuBubbleActionToggle: 'Show Results',
      bubbleStatsHint: 'Click to open stats, long-press to open panel',
      bubbleToggleHint: 'Click to show/hide blocked results, long-press to open panel',
      stateEnabled: 'Enabled', stateDisabled: 'Disabled',
      subImportFailed: 'Import failed, check URL or network',
      highlightRules: 'Highlight Rules', menuHighlightColor: '🎨 Highlight Colors',
      hlColorTitle: 'Highlight Colors', hlColorReset: 'Reset', resetPending: 'Reset, takes effect after saving', hlColorHint: 'Click a swatch to apply it quickly.',
      errorWord: 'Error', warningWord: 'Warning',
      statsWarnings: 'Found {count} rule warnings: ',
      duplicateRules: 'Duplicate Rules', invalidRule: 'Invalid rule',
      hlColorError: 'Highlight level must be 1-5',
      ifParenError: 'Unbalanced @if(...) parentheses',
      condRegexError: 'Invalid condition regex: {part}',
      regexError: 'Invalid regex', urlError: 'Invalid URL rule',
      ruleDuplicate: 'duplicated {count} times', emptyPrefixRule: 'Missing content after rule prefix',
      invalidRegexFlags: 'Invalid regular expression flags: {flags}',
      emptyIfCondition: '@if() condition cannot be empty', unknownIfCondition: 'Unknown @if condition: {part}',
      condExprError: 'Syntax error in @if expression: {part}',
      invalidUrlWildcard: 'Invalid URL wildcard format: {rule}', elementRuleUnsupported: 'Element rules are not supported',
      menuCustomSelectors: '🖋️ Custom Engine', selectorPanelTitle: 'Engine Selectors',
      selectorHint: 'If you don\'t know what it is for, do not modify it.',
      selectorJsonError: 'Failed to parse, check the format',
      selectorReservedKey: 'Reserved key not allowed: {key}',
      selectorInvalidKey: 'Engine id allows letters/digits/_/- only: {key}',
      selectorInvalidRegex: 'Invalid match regex: {key}',
      selectorInvalidCss: 'Invalid CSS selector: {key}.{field}: {value}',
      selectorFieldRequired: 'Required field: {key}.{field}',
      selectorInvalidBool: 'Field must be a boolean: {key}.{field}',
    }
  };

  function newCompiledRules() {
    return {
      domains: new Map(), urls: [], titles: [], texts: [],
      whitelistDomains: new Map(), whitelistUrlPatterns: [], whitelistTitlePatterns: [], whitelistTextPatterns: [],
      whitelistConditionalDomains: new Map(), whitelistConditionalRules: [],
      conditionalRules: [], conditionalDomains: new Map(),
      highlightDomains: new Map(), highlightUrls: [], highlightTitles: [], highlightTexts: [],
      highlightConditionalRules: [], highlightConditionalDomains: new Map()
    };
  }
  let compiledRules = newCompiledRules();

  const validationCache = new Map(); const subdomainCache = new Map(); let forceReprocessBatchId = 0;
  function t(key, params = {}) {
    const lang = currentConfig.language; const texts = LANG_TEXTS[lang] || LANG_TEXTS['zh-CN']; let text = texts[key] || key;
    for (const [k, v] of Object.entries(params)) {
      text = text.replaceAll(`{${k}}`, () => v);
    }
    return text;
  }

  function escHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function showToast(message, type = 'info', duration = 3000) {
    let container = document.getElementById('serh-toast-container');
    if (!container) {
      container = document.createElement('div'); container.id = 'serh-toast-container'; document.body.appendChild(container);
    }

    const panel = document.getElementById('serh-hlcolor-panel') ||
      document.getElementById('serh-selector-panel') ||
      document.getElementById('serh-settings-panel') ||
      document.getElementById('serh-panel');
    if (panel) {
      if (container.parentElement !== panel) {
        panel.appendChild(container);
      }
      const anchoredBottom = !!(panel.style && panel.style.bottom && panel.style.bottom !== 'auto'); container.style.position = 'absolute';
      if (anchoredBottom) {
        container.style.top = 'auto'; container.style.bottom = 'calc(100% + 4px)';
      } else {
        container.style.top = 'calc(100% + 4px)'; container.style.bottom = '';
      }
      container.style.left = '0'; container.style.right = '0'; container.style.width = 'auto'; container.style.maxWidth = 'none';
    } else {
      if (container.parentElement !== document.body) {
        document.body.appendChild(container);
      }
      container.style.position = ''; container.style.top = ''; container.style.right = ''; container.style.left = ''; container.style.bottom = ''; container.style.width = '';
    }

    const toast = document.createElement('div');
    toast.className = `serh-toast serh-toast-${type}`;
    toast.textContent = message; container.appendChild(toast); requestAnimationFrame(() => toast.classList.add('show'));

    let timer = null;
    const dismiss = () => {
      if (!toast.parentElement) return; clearTimeout(timer); toast.classList.remove('show'); toast.addEventListener('transitionend', () => toast.remove(), { once: true });
      setTimeout(() => toast.remove(), 400);
    };
    toast.addEventListener('click', dismiss); timer = setTimeout(dismiss, duration); return { dismiss };
  }

  const RULE_PREFIX_RE = /^(?:title|text|host|path|url|scheme)\//i;
  const RULE_PREFIX_REGEX_RE = /^(?:title|text|host|path|url|scheme)\/(?:[^/\\]|\\.)*\//i;
  const RULE_LEADING_REGEX_RE = /^\/(?:[^/\\]|\\.)*\//;
  const REGEX_CTX_A = /(?:^|[\s(&|!])(?:title|url|host|path|scheme)\s*=~$/i;
  const REGEX_CTX_B = /(?:^|[\s(&|!])(?:title|url|host|path|scheme)$/i;
  const REGEX_CTX_C = /(?:^|[\s(&|!])(?:title|url|host|path|scheme)\s*=$/i;
  const RULE_REGEX_LIT_RE = /^\/(?:[^/\\[\]()]|\\.|\[(?:[^\]\\]|\\.)*\]|\((?:[^/\\[\]()]|\\.)*\))+\//;

  function isBadRegexTail(s) {
    if (!RULE_PREFIX_REGEX_RE.test(s)) return false;
    let last = -1;
    for (let j = RULE_PREFIX_RE.exec(s)[0].length; j < s.length; j++) { if (s[j] === '\\') { j++; continue; } if (s[j] === '/') last = j; }
    const tail = last === -1 ? '' : s.slice(last + 1);
    return tail !== '' && !/^[imsu]*$/i.test(tail);
  }

  function scanRuleString(str, mode) {
    const strip = mode === 'strip';
    const n = str.length;
    let i = 0;
    while (i < n && /\s/.test(str[i])) i++;
    if (str[i] === '@' && str.substr(i + 1, 2).toLowerCase() !== 'if') {
      i++; while (i < n && /\d/.test(str[i])) i++; while (i < n && /\s/.test(str[i])) i++;
    }
    let inRE = false, inReClass = false, inSQ = false, inDQ = false;
    let ifDepth = 0, atIf = false, justClosedIf = false, pfxStart = -1;
    const body = str.slice(i);
    if (RULE_LEADING_REGEX_RE.test(body)) { i += 1; inRE = true; }
    else if (RULE_PREFIX_REGEX_RE.test(body)) { pfxStart = i; i += RULE_PREFIX_RE.exec(body)[0].length; inRE = true; }
    const occurrences = [];
    for (; i < n; i++) {
      const ch = str[i];
      if (inSQ) { if (ch === '\\') i++; else if (ch === "'") inSQ = false; continue; }
      if (inDQ) { if (ch === '\\') i++; else if (ch === '"') inDQ = false; continue; }
      if (inRE) {
        if (ch === '\\') { i++; continue; }
        if (inReClass) { if (ch === ']') inReClass = false; continue; }
        if (ch === '[') { inReClass = true; continue; }
        if (ch === '/') inRE = false;
        continue;
      }
      if (strip && atIf) {
        if (ch === '(') { ifDepth = 1; atIf = false; continue; }
        if (!/\s/.test(ch)) atIf = false;
        continue;
      }
      if (ch === "'") { inSQ = true; continue; }
      if (ch === '"') { inDQ = true; continue; }
      if (ch === '/' && !inRE) {
        const prev = str.slice(0, i).trimEnd();
        if (REGEX_CTX_A.test(prev) || REGEX_CTX_B.test(prev) || (REGEX_CTX_C.test(prev) && RULE_REGEX_LIT_RE.test(str.slice(i)))) { inRE = true; continue; }
      }
      if (justClosedIf) {
        if (/\s/.test(ch)) continue;
        justClosedIf = false;
        if (ch === '/') { inRE = true; continue; }
        const prefixM = RULE_PREFIX_RE.exec(str.slice(i));
        if (prefixM) { pfxStart = i; i += prefixM[0].length - 1; inRE = true; continue; }
      }
      if (ch === '@' && str.substr(i, 3).toLowerCase() === '@if') {
        const prevChar = i > 0 ? str[i - 1] : '';
        const isBoundary = i === 0 || /\s/.test(prevChar) || prevChar === '@' || prevChar === '(' || prevChar === ')';
        if (strip) {
          if (isBoundary) atIf = true;
          i += 2; continue;
        }
        if (isBoundary) {
          let j = i + 3; while (j < n && /\s/.test(str[j])) j++;
          if (str[j] === '(') {
            const end = findBalancedParenEnd(str, j);
            occurrences.push({ index: i, condStart: j, endIndex: end });
            if (end !== -1) { i = end; justClosedIf = true; }
          }
        }
        continue;
      }
      if (strip) {
        if (ch === '(' && ifDepth > 0) { ifDepth++; continue; }
        if (ch === ')' && ifDepth > 0) { ifDepth--; if (ifDepth === 0) justClosedIf = true; continue; }
        if (ch === '#' && ifDepth === 0) {
          const prev = str[i - 1];
          if (prev === undefined || /\s/.test(prev)) {
            let end = i; while (end > 0 && /\s/.test(str[end - 1])) end--;
            if (pfxStart !== -1 && isBadRegexTail(str.slice(pfxStart, end)) && !isBadRegexTail(str.slice(pfxStart))) continue;
            return { stripped: str.slice(0, end), occurrences };
          }
        }
      }
    }
    return { stripped: str, occurrences };
  }

  function findBalancedParenEnd(str, openIdx) {
    let depth = 0; let inSQ = false; let inDQ = false; let inRE = false; let inReClass = false;
    for (let i = openIdx; i < str.length; i++) {
      const ch = str[i];
      if (inSQ) { if (ch === '\\') i++; else if (ch === "'") inSQ = false; continue; }
      if (inDQ) { if (ch === '\\') i++; else if (ch === '"') inDQ = false; continue; }
      if (inRE) {
        if (ch === '\\') { i++; continue; }
        if (inReClass) { if (ch === ']') inReClass = false; continue; }
        if (ch === '[') { inReClass = true; continue; }
        if (ch === '/') { inRE = false; continue; }
        continue;
      }
      if (ch === "'") { inSQ = true; continue; }
      if (ch === '"') { inDQ = true; continue; }
      if (ch === '/') {
        const prev = str.slice(0, i).trimEnd();
        if (REGEX_CTX_A.test(prev) || REGEX_CTX_B.test(prev) || (REGEX_CTX_C.test(prev) && RULE_REGEX_LIT_RE.test(str.slice(i)))) { inRE = true; continue; }
      }
      if (ch === '(') depth++;
      else if (ch === ')') { depth--; if (depth === 0) return i; }
    }
    return -1;
  }

  function extractBalancedParens(str, startIndex) {
    if (str[startIndex] !== '(') return null;
    const end = findBalancedParenEnd(str, startIndex);
    return end === -1 ? null : { content: str.substring(startIndex + 1, end), endIndex: end + 1 };
  }

  function stripRuleComment(line) {
    return scanRuleString(String(line), 'strip').stripped;
  }

  function findIfOccurrences(ruleStr) {
    return scanRuleString(ruleStr, 'scan').occurrences.map(o => ({ index: o.index, condStart: o.condStart }));
  }

  const LINE_NUM_CHUNK = 200;
  const lineNumTargets = {
    rules: { textareaId: 'serh-rules', lineNumsId: 'serh-line-numbers', syntaxCheck: true, pending: false, dirty: false, token: 0, timer: null },
    selectors: { textareaId: 'serh-sel-rules', lineNumsId: 'serh-sel-line-numbers', syntaxCheck: false, pending: false, dirty: false, token: 0, timer: null }
  };

  function updateLineNumbersIncremental(key) {
    const target = lineNumTargets[key || 'rules'];
    const textarea = document.getElementById(target.textareaId); const lineNums = document.getElementById(target.lineNumsId);
    if (!textarea || !lineNums) {
      target.pending = false; return;
    }

    const lines = textarea.value.split('\n'); const len = lines.length; const token = ++target.token;
    lineNums.style.minWidth = `max(20px, calc(${String(len).length}ch + 8px))`;

    let index = 0;
    const step = () => {
      if (token !== target.token) return;
      if (!lineNums.isConnected) {
        target.pending = false; target.dirty = false; return;
      }

      const children = lineNums.children;
      while (children.length > len) {
        lineNums.removeChild(children[children.length - 1]);
      }

      const end = Math.min(index + LINE_NUM_CHUNK, len); const frag = document.createDocumentFragment();
      for (let i = index; i < end; i++) {
        let node = children[i];
        if (!node) {
          node = document.createElement('div'); node.style.position = 'relative'; node.style.color = '#a0aec0'; node.style.height = '1.4em'; frag.appendChild(node);
        }
        const analysis = target.syntaxCheck && currentConfig.errorDetection !== false ? cachedAnalyzeRule(lines[i]) : { valid: true, errors: [], warnings: [] }; const valid = analysis.valid;
        const errMsg = valid ? '' : analysis.errors.join(' | ');
        const html = `${i + 1}${valid ? '' : `<span class="serh-line-error" title="${escHtml(errMsg)}" data-error="${escHtml(errMsg)}" style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); font-size: 10px; background: #edf2f7; z-index: 1; cursor: pointer;">⚠️</span>`}`;
        if (node.dataset.v !== html) {
          node.innerHTML = html; node.dataset.v = html;
        }
      }
      if (frag.childNodes.length > 0) {
        lineNums.appendChild(frag);
      }

      index = end;
      if (index < len) {
        requestAnimationFrame(step); return;
      }

      if (target.dirty) {
        target.dirty = false; requestAnimationFrame(() => updateLineNumbersIncremental(key));
      } else {
        target.pending = false;
      }
    };
    requestAnimationFrame(step);
  }

  function scheduleLineNumbersUpdate(key = 'rules') {
    const target = lineNumTargets[key];
    if (target.timer) clearTimeout(target.timer);
    target.timer = setTimeout(() => {
      target.timer = null; updateLineNumbers(key);
    }, 100);
  }

  function updateLineNumbers(key = 'rules') {
    const target = lineNumTargets[key];
    if (target.pending) {
      target.dirty = true; return;
    }
    target.pending = true; updateLineNumbersIncremental(key);
  }

  function isJsRegexAllowed(text, idx) {
    let k = idx - 1;
    while (k >= 0 && /\s/.test(text[k])) k--;
    if (k < 0) return true;
    const prev = text[k];
    if ('(,;:=!&|?+-*%<>~^{}[]'.indexOf(prev) !== -1) return true;
    if (!/[\w$]/.test(prev)) return false;
    let s = k;
    while (s >= 0 && /[\w$]/.test(text[s])) s--;
    return /^(?:return|typeof|instanceof|in|of|new|delete|void|do|else|case|yield|await|throw)$/.test(text.slice(s + 1, k + 1));
  }

  function buildBracketMatchMap(text, lang) {
    const n = text.length;
    const map = new Int32Array(n);
    map.fill(-1);
    const PAIRS = '()[]{}';
    const stack = [];
    const closeAt = (i) => {
      const top = stack.length ? stack[stack.length - 1] : -1;
      const ci = PAIRS.indexOf(text[i]);
      if (top === -1 || ci < 1 || text[top] !== PAIRS[ci - 1]) return -1;
      map[top] = i; map[i] = top; stack.pop(); return top;
    };
    let i = 0;

    if (lang === 'js') {
      const modes = ['code'];
      const tplBraces = new Set();
      while (i < n) {
        const ch = text[i];
        if (modes[modes.length - 1] === 'template') {
          if (ch === '\\') { i += 2; continue; }
          if (ch === '`') { modes.pop(); i++; continue; }
          if (ch === '$' && PAIRS.indexOf(text[i + 1]) === 4) { tplBraces.add(i + 1); stack.push(i + 1); modes.push('code'); i += 2; continue; }
          i++; continue;
        }
        if (ch === '/' && text[i + 1] === '/') { const e = text.indexOf('\n', i); i = e === -1 ? n : e; continue; }
        if (ch === '/' && text[i + 1] === '*') { const e = text.indexOf('*/', i + 2); i = e === -1 ? n : e + 2; continue; }
        if (ch === "'" || ch === '"') {
          i++;
          while (i < n && text[i] !== ch && text[i] !== '\n') { if (text[i] === '\\') i++; i++; }
          i++; continue;
        }
        if (ch === '`') { modes.push('template'); i++; continue; }
        if (ch === '/' && isJsRegexAllowed(text, i)) {
          i++;
          let inClass = false;
          while (i < n && text[i] !== '\n') {
            const c = text[i];
            if (c === '\\') { i += 2; continue; }
            if (inClass) { if (c === ']') inClass = false; i++; continue; }
            if (c === '[') { inClass = true; i++; continue; }
            if (c === '/') { i++; break; }
            i++;
          }
          continue;
        }
        const oi = PAIRS.indexOf(ch);
        if (oi !== -1) {
          if (oi % 2 === 1) {
            const top = closeAt(i);
            if (top !== -1 && tplBraces.has(top)) { tplBraces.delete(top); modes.pop(); }
          } else { stack.push(i); }
          i++; continue;
        }
        i++;
      }
      return map;
    }

    const scanRegexLiteral = (open, to) => {
      const opens = [], paired = [];
      let cls = false;
      for (let k = open + 1; k < to; k++) {
        const ch = text[k];
        if (ch === '\\') { k++; continue; }
        if (cls) {
          if (ch === ']') { cls = false; const top = opens.pop(); if (top !== undefined) paired.push([top, k]); }
          continue;
        }
        if (ch === '[') { cls = true; opens.push(k); continue; }
        if (ch === '/') { paired.forEach(([a, b]) => { map[a] = b; map[b] = a; }); return k; }
        const oi = PAIRS.indexOf(ch);
        if (oi !== -1) {
          if (oi % 2 === 1) { const top = opens.pop(); if (top !== undefined && text[top] === PAIRS[oi - 1]) paired.push([top, k]); }
          else opens.push(k);
        }
      }
      return -1;
    };
    while (i < n) {
      const lineEnd = text.indexOf('\n', i); const end = lineEnd === -1 ? n : lineEnd;
      let j = i;
      while (j < end && /\s/.test(text[j])) j++;
      if (text[j] === '@' && text.substr(j + 1, 2).toLowerCase() !== 'if') {
        j++; while (j < end && /\d/.test(text[j])) j++; while (j < end && /\s/.test(text[j])) j++;
      }
      const body = text.slice(j, end);
      let inRe = false, inClass = false;
      const leadingRe = RULE_LEADING_REGEX_RE.test(body);
      if (leadingRe || RULE_PREFIX_REGEX_RE.test(body)) {
        const reEnd = scanRegexLiteral(leadingRe ? j : j + RULE_PREFIX_RE.exec(body)[0].length - 1, end);
        j = reEnd !== -1 ? reEnd + 1 : end;
      }
      while (j < end) {
        const ch = text[j];
        if (inRe) {
          if (ch === '\\') { j += 2; continue; }
          if (inClass) { if (ch === ']') inClass = false; j++; continue; }
          if (ch === '[') { inClass = true; j++; continue; }
          if (ch === '/') { inRe = false; }
          j++; continue;
        }
        if (ch === "'" || ch === '"') {
          j++;
          while (j < end && text[j] !== ch) { if (text[j] === '\\') j++; j++; }
          j++; continue;
        }
        if (ch === '#') {
          const prevCh = j > 0 ? text[j - 1] : '';
          if (prevCh === '' || /\s/.test(prevCh)) break;
          j++; continue;
        }
        if (ch === '/') {
          const prev = text.slice(Math.max(0, j - 64), j).trimEnd();
          if (REGEX_CTX_A.test(prev) || REGEX_CTX_B.test(prev) || (REGEX_CTX_C.test(prev) && RULE_REGEX_LIT_RE.test(text.slice(j, Math.min(n, j + 4096))))) {
            const reEnd = scanRegexLiteral(j, end);
            if (reEnd !== -1) { j = reEnd + 1; continue; }
            inRe = true; inClass = false;
          }
          j++; continue;
        }
        const oi = PAIRS.indexOf(ch);
        if (oi !== -1) { if (oi % 2 === 1) closeAt(j); else stack.push(j); }
        j++;
      }
      stack.length = 0;
      i = end + 1;
    }
    return map;
  }

  function findBracketPairAt(map, pos) {
    const tries = [pos - 1, pos];
    for (let k = 0; k < 2; k++) {
      const p = tries[k];
      if (p < 0 || p >= map.length || map[p] === -1) continue;
      return p < map[p] ? { a: p, b: map[p] } : { a: map[p], b: p };
    }
    return null;
  }

  function findEnclosingBracketAt(map, pos, exclude) {
    for (let i = pos - 1; i >= 0; i--) {
      const m = map[i];
      if (m === -1 || m <= pos) continue;
      if (exclude && (i === exclude.a || i === exclude.b || m === exclude.a || m === exclude.b)) continue;
      return { a: i, b: m };
    }
    return null;
  }

  function buildLineStartOffsets(text) {
    const starts = [0];
    for (let i = 0; i < text.length; i++) {
      if (text.charCodeAt(i) === 10) starts.push(i + 1);
    }
    return starts;
  }

  function lineIndexAt(starts, idx) {
    let lo = 0; let hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid] <= idx) lo = mid; else hi = mid - 1;
    }
    return lo;
  }

  function setupBracketHighlight(textarea, lang) {
    const container = textarea ? textarea.parentElement : null;
    if (!container || container.dataset.bracketLayer) return;
    container.dataset.bracketLayer = '1';
    const layer = document.createElement('div'); layer.className = 'serh-bracket-layer';
    const mirror = document.createElement('div'); mirror.className = 'serh-bracket-mirror'; layer.appendChild(mirror);
    const markerPool = [], hits = [];
    for (let i = 0; i < 4; i++) { const m = document.createElement('span'); markerPool.push(m); mirror.appendChild(m); }
    for (let i = 0; i < 4; i++) { const hit = document.createElement('i'); hit.className = `serh-bracket-hit ${i < 2 ? 'serh-bracket-pair' : 'serh-bracket-enclosing'}`; layer.appendChild(hit); hits.push(hit); }
    container.insertBefore(layer, container.firstChild);

    let cache = { text: null, map: null }, mkText = null, mkIdxs = '', styleKey = null;
    const hide = () => { for (const hit of hits) hit.style.display = 'none'; };
    const STYLE_PROPS = ['fontStyle', 'fontVariant', 'fontWeight', 'fontStretch', 'fontSize', 'fontSizeAdjust', 'lineHeight', 'fontFamily', 'fontKerning', 'fontVariantLigatures', 'textRendering', 'letterSpacing', 'wordSpacing', 'whiteSpace', 'tabSize', 'textTransform', 'direction', 'overflowWrap', 'wordBreak', 'textAlign', 'textIndent'];

    const syncMirrorStyle = (cs, contentWidth) => {
      const vals = STYLE_PROPS.map((p) => cs[p]);
      const key = vals.join('|') + '|' + contentWidth;
      if (key === styleKey) return;
      styleKey = key;
      const set = (el, p, v) => el.style.setProperty(p.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase()), v, 'important');
      set(mirror, 'all', 'unset');
      [['display', 'block'], ['position', 'absolute'], ['top', '0'], ['left', '0'], ['visibility', 'hidden'], ['pointerEvents', 'none'], ['-webkit-text-size-adjust', '100%'], ['text-size-adjust', '100%']].forEach((e) => set(mirror, e[0], e[1]));
      const targets = [mirror, ...markerPool];
      STYLE_PROPS.forEach((p, i) => targets.forEach((el) => { el.style[p] = vals[i]; set(el, p, vals[i]); }));
      mirror.style.width = `${contentWidth}px`;
    };

    const buildMirror = (text, idxs) => {
      const idxKey = idxs.join(',');
      if (mkText === text && mkIdxs === idxKey) return;
      mkText = text; mkIdxs = idxKey;
      mirror.textContent = '';
      let at = 0;
      idxs.forEach((idx, k) => {
        if (idx > at) mirror.appendChild(document.createTextNode(text.slice(at, idx)));
        markerPool[k].textContent = text[idx] || '\u200b'; mirror.appendChild(markerPool[k]);
        at = idx + 1;
      });
      if (at < text.length) mirror.appendChild(document.createTextNode(text.slice(at)));
    };

    const refresh = () => {
      if (currentConfig.bracketHighlight === false || !textarea.isConnected || document.activeElement !== textarea) { hide(); return; }
      const text = textarea.value;
      const pos = Math.min(Math.max(textarea.selectionEnd || 0, 0), text.length);
      if (cache.text !== text) cache = { text, map: buildBracketMatchMap(text, lang) };
      const pair = findBracketPairAt(cache.map, pos);
      const enclosing = findEnclosingBracketAt(cache.map, pos, pair);
      if (!pair && !enclosing) { hide(); return; }
      const cs = getComputedStyle(textarea);
      const padL = parseFloat(cs.paddingLeft) || 0, padR = parseFloat(cs.paddingRight) || 0, padT = parseFloat(cs.paddingTop) || 0;
      syncMirrorStyle(cs, Math.max(0, textarea.clientWidth - padL - padR));
      layer.style.left = `${textarea.offsetLeft}px`; layer.style.top = `${textarea.offsetTop}px`;
      const scrollL = textarea.scrollLeft, scrollT = textarea.scrollTop;
      const idxs = [...new Set([pair, enclosing].flatMap((range) => range ? [range.a, range.b] : []))].sort((a, b) => a - b);
      buildMirror(text, idxs);
      const metrics = new Map(idxs.map((idx, k) => { const m = markerPool[k]; return [idx, [padL + m.offsetLeft - scrollL, padT + m.offsetTop - scrollT, m.offsetWidth, m.offsetHeight]]; }));
      const place = (range, first) => {
        if (!range) { hits[first].style.display = 'none'; hits[first + 1].style.display = 'none'; return; }
        [range.a, range.b].forEach((idx, k) => {
          const [x, y, w, h] = metrics.get(idx); const hit = hits[first + k];
          hit.style.left = `${x}px`; hit.style.top = `${y}px`; hit.style.width = `${w}px`; hit.style.height = `${h}px`; hit.style.display = 'block';
        });
      };
      place(pair, 0); place(enclosing, 2);
    };

    ['input', 'keyup', 'click', 'mouseup', 'select', 'focus', 'scroll'].forEach((ev) => textarea.addEventListener(ev, refresh));
    textarea.addEventListener('blur', hide);
  }

  function getPanelPositionStyles() {
    const statusBtn = document.getElementById('serh-status');
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
    const centerX = rect.left + rect.width / 2; const centerY = rect.top + rect.height / 2; const isLeft = centerX < window.innerWidth / 2; const isTop = centerY < window.innerHeight / 2;

    if (isLeft && isTop) return 'top: 10px; left: 10px; transform: none;'; if (!isLeft && isTop) return 'top: 10px; right: 10px; transform: none;';
    if (isLeft && !isTop) return 'bottom: 10px; left: 10px; transform: none;'; return 'bottom: 10px; right: 10px; transform: none;';
  }

  function createPanel(id, width = '320px', padding = '15px') {
    const panel = document.createElement('div'); panel.id = id; panel.classList.add('serh-panel-fade', 'serh-window');
    panel.style.cssText = `
        position: fixed;
        ${getPanelPositionStyles()}
        width: ${width};
        z-index: 10001;
        padding: ${padding};
        display: flex;
        flex-direction: column;
    `;    document.body.appendChild(panel);
    requestAnimationFrame(() => requestAnimationFrame(() => panel.classList.add('show'))); return panel;
  }

  function fadeOutAndRemovePanel(panel, onClosed) {
    panel.classList.remove('show'); panel._fading = true; let done = false;
    const finish = () => {
      if (done) return; done = true; panel.remove(); if (onClosed) onClosed();
    };
    panel.addEventListener('transitionend', finish, { once: true }); setTimeout(finish, 350);
  }

  function bindOutsideClickClose(panel, onBeforeClose) {
    let pressStartedInside = false;
    const pressHandler = (e) => {
      if (e.isTrusted === false) return; pressStartedInside = panel.contains(e.target);
    };
    const closeHandler = (e) => {
      if (preventPanelClose) return; if (e.isTrusted === false) return;
      if (pressStartedInside) {
        pressStartedInside = false; return;
      }
      if (currentConfig.bubbleAction !== 'toggleHidden' && e.target && e.target.closest && e.target.closest('#serh-status')) return;
      if (!panel.contains(e.target)) closePanel();
    };
    const closePanel = () => {
      try {
        if (typeof onBeforeClose === 'function') onBeforeClose();
      } catch (err) {
        console.error('[面板] 关闭前回调失败:', err);
      }
      document.removeEventListener('click', closeHandler); document.removeEventListener('pointerdown', pressHandler); document.removeEventListener('mousedown', pressHandler);
      panel._cleanupClick = null; fadeOutAndRemovePanel(panel);
    };
    panel._cleanupClick = () => {
      document.removeEventListener('click', closeHandler); document.removeEventListener('pointerdown', pressHandler); document.removeEventListener('mousedown', pressHandler);
    };
    setTimeout(() => {
      if (panel.isConnected) {
        document.addEventListener('pointerdown', pressHandler); document.addEventListener('mousedown', pressHandler); document.addEventListener('click', closeHandler);
      }
    }, 200);
    return closePanel;
  }

  function openPanel(id, { width = '320px', padding = '15px', beforeClose = null, onExisting = null, bindClose = true } = {}) {
    injectWidgetStyles();
    const existing = document.getElementById(id);
    if (existing && !existing._fading) {
      if (typeof existing._cleanupClick === 'function') existing._cleanupClick();
      if (typeof existing._beforeClose === 'function') { try { existing._beforeClose(); } catch (err) { console.error('[面板] 关闭前回调失败:', err); } existing._beforeClose = null; }
      if (onExisting) onExisting(existing);
      existing.remove();
      return null;
    }
    if (existing) existing.remove();
    const panel = createPanel(id, width, padding);
    panel._beforeClose = typeof beforeClose === 'function' ? beforeClose : null;
    return { panel, closePanel: bindClose ? bindOutsideClickClose(panel, beforeClose) : null };
  }

  function openSerhPanels() { return Array.from(document.querySelectorAll('.serh-window')).filter(p => !p._fading); }
  function closeAllSerhPanels() {
    if (window._panelCloseTimer) { clearTimeout(window._panelCloseTimer); window._panelCloseTimer = null; }
    if (window._panelCloseHandler) { document.removeEventListener('click', window._panelCloseHandler); window._panelCloseHandler = null; }
    if (window._panelPressHandler) { document.removeEventListener('pointerdown', window._panelPressHandler); document.removeEventListener('mousedown', window._panelPressHandler); window._panelPressHandler = null; }
    openSerhPanels().forEach(p => {
      if (typeof p._cleanupClick === 'function') p._cleanupClick();
      if (typeof p._beforeClose === 'function') { try { p._beforeClose(); } catch (err) { console.error('[面板] 关闭前回调失败:', err); } p._beforeClose = null; }
      fadeOutAndRemovePanel(p);
    });
    const toastContainer = document.getElementById('serh-toast-container'); if (toastContainer) toastContainer.remove();
  }
  function resolveBubblePanelAction() {
    if (preventPanelClose) return 'none';
    const mainPanel = document.getElementById('serh-panel');
    const statsPanel = document.getElementById('serh-stats-panel');
    const mainAlive = !!(mainPanel && !mainPanel._fading);
    if (statsPanel && mainAlive && statsPanel.style.display === 'flex') return 'closeAll';
    if (currentConfig.bubbleAction === 'openStats' && mainAlive) return 'stats';
    if (openSerhPanels().length) return 'closeAll';
    return currentConfig.bubbleAction === 'openStats' ? 'stats' : 'panel';
  }

  function hostLabelToASCII(label) {
    const s = String(label || ''); if (!s || s === '*' || /^[a-z0-9_-]*$/i.test(s)) return s;
    try {
      const ascii = new URL('http://' + s + '.invalid').hostname; if (ascii.toLowerCase().endsWith('.invalid')) return ascii.slice(0, -8);
    } catch (e) {}
    return s;
  }

  function toASCIIHostname(host) {
    const raw = String(host || '').replace(/\.$/, '').trim().toLowerCase(); if (!raw) return ''; const colonIdx = raw.indexOf(':');
    if (colonIdx !== -1) {
      const h = raw.slice(0, colonIdx); const p = raw.slice(colonIdx); return (h ? toASCIIHostname(h) : '') + p;
    }
    if (/^[\x00-\x7F]*$/.test(raw)) return raw; return raw.split('.').map(label => label ? hostLabelToASCII(label) : label).join('.');
  }

  function punycodeDecodeLabel(label) {
    const s = String(label || '').toLowerCase(); if (!s.startsWith('xn--')) return label; const body = s.slice(4);
    const base = 36, tmin = 1, tmax = 26, skew = 38, damp = 700, initialBias = 72, initialN = 128; let n = initialN, i = 0, bias = initialBias; const output = [];
    const delimPos = body.lastIndexOf('-'); let pos = 0;
    if (delimPos > 0) {
      for (; pos < delimPos; ++pos) {
        output.push(body.charCodeAt(pos));
      }
      pos++;
    } else if (delimPos === 0) {
      pos++;
    }
    const adapt = (delta, numPoints, firstTime) => {
      let k = 0; delta = firstTime ? Math.floor(delta / damp) : delta >> 1; delta += Math.floor(delta / numPoints);
      while (delta > ((base - tmin) * tmax) >> 1) {
        delta = Math.floor(delta / (base - tmin)); k += base;
      }
      return k + Math.floor(((base - tmin + 1) * delta) / (delta + skew));
    };
    while (pos < body.length) {
      const oldi = i; let w = 1;
      for (let k = base; ; k += base) {
        if (pos >= body.length) return label; const ch = body.charCodeAt(pos++); const digit = ch >= 48 && ch < 58 ? ch - 22 : ch >= 65 && ch < 91 ? ch - 65 : ch >= 97 && ch < 123 ? ch - 97 : base;
        if (digit >= base) return label; i += digit * w; const t = k <= bias ? tmin : k >= bias + tmax ? tmax : k - bias; if (digit < t) break; w *= base - t;
      }
      const outLen = output.length + 1; bias = adapt(i - oldi, outLen, oldi === 0); n += Math.floor(i / outLen); i %= outLen; output.splice(i, 0, n); i++;
    }
    return String.fromCodePoint(...output);
  }

  function toUnicodeHostname(host) {
    const raw = String(host || '').replace(/\.$/, '').trim(); if (!raw || !raw.toLowerCase().includes('xn--')) return raw;
    return raw.split('.').map(label => {
      if (label && label.toLowerCase().startsWith('xn--')) {
        try {
          return punycodeDecodeLabel(label);
        } catch (_) {
          return label;
        }
      }
      return label;
    }).join('.');
  }

  function toASCIIUrl(url) {
    const raw = String(url || ''); if (!raw || /^[\x00-\x7F]*$/.test(raw)) return raw;
    try {
      const abs = raw.startsWith('//') ? 'http:' + raw : raw; const u = new URL(abs); const want = toASCIIHostname(u.hostname);
      if (want && want !== u.hostname) {
        const auth = u.username ? u.username + (u.password ? ':' + u.password : '') + '@' : '';
        const port = u.port ? ':' + u.port : ''; u.href = u.protocol + '//' + auth + want + port + u.pathname + u.search + u.hash;
      }
      return raw.startsWith('//') ? u.href.replace(/^https?:/i, '') : u.href;
    } catch (e) {
      return raw;
    }
  }

  function safeRegexTest(regex, value) {
    if (!regex) return false; regex.lastIndex = 0; const matched = regex.test(String(value ?? '')); regex.lastIndex = 0; return matched;
  }

  function safeDecodeURIComponent(str) {
    try {
      return decodeURIComponent(String(str ?? ''));
    } catch (e) {
      return String(str ?? '');
    }
  }

  function encodeNonAscii(str) {
    const s = String(str ?? ''); return /[^\x00-\x7F]/.test(s) ? s.replace(/[^\x00-\x7F]/gu, ch => encodeURIComponent(ch)) : s;
  }

  function filterValidRuleLines(lines) {
    return lines
      .map(line => line.trim())
      .filter(line => line.length > 0);
  }

  function getRuleKey(r) {
    if (!r || typeof r !== 'string') return ''; const trimmed = r.trim(); if (trimmed.startsWith('#')) return trimmed; const stripped = stripRuleComment(trimmed); return stripped.trim();
  }

  function tokenizeCondExpr(str) {
    const tokens = []; let leaf = ''; let i = 0; const n = str.length; let inSQ = false; let inDQ = false; let inRE = false; let inReClass = false; let leafParens = 0;

    const flushLeaf = () => {
      const s = leaf.trim(); if (s) tokens.push(s); leaf = '';
    };
    const pushChar = (ch) => { leaf += ch; };
    const canStartRegex = (pos) => {
      const s = leaf.trim(); if (s === '' || /(?:=~|~)$/.test(s)) return true;
      if (/(?:=|\^=|\$=|\*=|:)$/.test(s) || /^(url|title|host|path|scheme)$/i.test(s)) {
        let j = pos + 1, inC = false;
        while (j < n) {
          const c = str[j];
          if (c === '\\') { j += 2; continue; }
          if (inC) { if (c === ']') inC = false; j++; continue; }
          if (c === '[') { inC = true; j++; continue; }
          if (c === '/') {
            let k = j + 1; while (k < n && /[a-z]/i.test(str[k])) k++; if (k >= n || /[\s)&|]/.test(str[k])) return true;
          }
          j++;
        }
        return false;
      }
      return false;
    };

    while (i < n) {
      const ch = str[i];

      if (inSQ) {
        if (ch === '\\') { pushChar(ch); if (i + 1 < n) pushChar(str[i + 1]); i += 2; continue; }
        pushChar(ch); if (ch === "'") inSQ = false; i++; continue;
      }
      if (inDQ) {
        if (ch === '\\') { pushChar(ch); if (i + 1 < n) pushChar(str[i + 1]); i += 2; continue; }
        pushChar(ch); if (ch === '"') inDQ = false; i++; continue;
      }
      if (inRE) {
        if (ch === '\\') { pushChar(ch); if (i + 1 < n) pushChar(str[i + 1]); i += 2; continue; }
        if (inReClass) {
          pushChar(ch); if (ch === ']') inReClass = false; i++; continue;
        }
        if (ch === '[') { inReClass = true; pushChar(ch); i++; continue; }
        pushChar(ch); if (ch === '/') inRE = false; i++; continue;
      }

      if (ch === "'") { inSQ = true; pushChar(ch); i++; continue; }
      if (ch === '"') { inDQ = true; pushChar(ch); i++; continue; }
      if (ch === '\\') { pushChar(ch); if (i + 1 < n) pushChar(str[i + 1]); i += 2; continue; }
      if (ch === '/') {
        if (canStartRegex(i)) { inRE = true; pushChar(ch); i++; continue; }
        pushChar(ch); i++; continue;
      }

      if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') { pushChar(ch); i++; continue; }

      if (ch === '&' || ch === '|') {
        if (leafParens === 0) {
          if (i + 1 < n && str[i + 1] === ch) {
            return { error: true, tokens };
          }
          flushLeaf(); tokens.push(ch); i++; continue;
        }
        pushChar(ch); i++; continue;
      }

      if (ch === '!') {
        if (leaf.trim() === '' && leafParens === 0) {
          flushLeaf(); tokens.push('!'); i++; continue;
        }
        pushChar(ch); i++; continue;
      }

      if (ch === '(') {
        if (leaf.trim() === '' && leafParens === 0) {
          flushLeaf(); tokens.push('('); i++; continue;
        }
        leafParens++; pushChar(ch); i++; continue;
      }

      if (ch === ')') {
        if (leafParens > 0) {
          leafParens--; pushChar(ch); i++; continue;
        }
        flushLeaf(); tokens.push(')'); i++; continue;
      }

      pushChar(ch); i++;
    }

    flushLeaf(); if (inSQ || inDQ || inRE || leafParens !== 0) return { error: true, tokens }; return { error: false, tokens };
  }

  function parseCondExprTokens(tokens, leafParser, errors) {
    let pos = 0; const peek = () => tokens[pos]; const next = () => tokens[pos++];
    const syntaxError = () => {
      errors.push({ kind: 'syntax' }); return { type: 'const', value: false };
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
      const t = peek(); if (t === undefined) return syntaxError();
      if (t === '(') {
        next(); const inner = parseOr(); if (peek() !== ')') return syntaxError(); next(); return inner;
      }
      if (t === ')' || t === '&' || t === '|' || t === '!') { next(); return syntaxError(); }
      next(); return leafParser(t);
    }

    const ast = parseOr(); if (peek() !== undefined) return syntaxError(); return ast;
  }

  function analyzeCondExpr(condStr, engine, site, category) {
    if (engine === undefined) {
      engine = getSearchEngine(); site = window.location.hostname; if (category === undefined) category = getSearchCategory();
    }
    if (category === undefined) category = 'web'; const errors = []; const tokRes = tokenizeCondExpr(condStr);
    if (tokRes.error || !tokRes.tokens.length) return { ast: null, errors: [{ kind: 'syntax' }] };
    const leafParser = (text) => {
      const trimmed = text.trim();
      const regexLeafFlags = (() => {
        const m = trimmed.match(/^(?:title|url|host|path|scheme)\s*(?:=\~\s*|=\s*)?\/((?:[^/\\\[]|\\.|\[(?:[^\]\\]|\\.)*\])*)\/([a-z]*)$/i); if (!m) return null;
        const seg = m[2] || ''; return isUniqueFlagsStr(seg) ? seg.toLowerCase() : (isFlagsCandidateError(seg) ? seg : '');
      })();
      if (regexLeafFlags && getInvalidRegexFlags(regexLeafFlags)) {
        errors.push({ kind: 'flags', part: regexLeafFlags }); return { type: 'const', value: false };
      }
      try {
        const parsed = parseConditionPart(trimmed, engine, site, category);
        if (!parsed.matched) {
          errors.push({ kind: 'unknown', part: trimmed }); return { type: 'const', value: false };
        }
        if (parsed.static !== undefined) return { type: 'const', value: parsed.static }; return { type: 'leaf', cond: parsed.dynamic };
      } catch (e) {
        errors.push({ kind: 'regex', part: trimmed }); return { type: 'const', value: false };
      }
    };
    const ast = parseCondExprTokens(tokRes.tokens, leafParser, errors); return { ast, errors };
  }

  function foldCondExpr(node) {
    if (node.type === 'const' || node.type === 'leaf') return node;
    if (node.type === 'not') {
      const child = foldCondExpr(node.child); if (child.type === 'const') return { type: 'const', value: !child.value }; return { type: 'not', child };
    }
    const isAnd = node.type === 'and'; const kids = node.children.map(foldCondExpr); if (isAnd && kids.some(k => k.type === 'const' && !k.value)) return { type: 'const', value: false };
    if (!isAnd && kids.some(k => k.type === 'const' && k.value)) return { type: 'const', value: true }; const rest = kids.filter(k => k.type !== 'const');
    if (!rest.length) return { type: 'const', value: isAnd }; return rest.length === 1 ? rest[0] : { type: isAnd ? 'and' : 'or', children: rest };
  }

  function evalDynamicLeaf(cond, title, url) {
    if (cond.type === 'title') {
      if (!title || (cond.op !== '=~' && !cond.val)) return false; const lowerTitle = title.toLowerCase(); if (cond.op === '=') return lowerTitle === cond.val; if (cond.op === '^=') return lowerTitle.startsWith(cond.val);
      if (cond.op === '$=') return lowerTitle.endsWith(cond.val); if (cond.op === '*=') return lowerTitle.includes(cond.val); if (cond.op === '=~') return safeRegexTest(cond.regex, title);
      return false;
    }
    if (cond.type === 'url') {
      if (!url || (cond.op !== '=~' && !cond.val)) return false; const lowerUrl = url.toLowerCase();
      const foldUrl = (value) => {
        const raw = String(value || ''); if (!raw) return '';
        const abs = /:\/\//.test(raw) || raw.startsWith('//'); let out = raw;
        if (abs) out = toASCIIUrl(raw) || raw;
        else if (/[^\x00-\x7F]/.test(raw) && /^[^/?#\s]+\.[^/?#\s]+/.test(raw)) {
          const host = raw.split(/[/?#]/)[0]; const ascii = toASCIIHostname(host.replace(/:\d+$/, ''));
          if (ascii && ascii !== host) out = ascii + raw.slice(host.length);
        }
        out = encodeNonAscii(out); return out.toLowerCase();
      };
      const cmpUrl = foldUrl(cond.op === '=~' ? '' : cond.val); const urlHit = (pred) => pred(lowerUrl) || pred(foldUrl(url));
      if (cond.op === '=') return urlHit(v => v === cmpUrl); if (cond.op === '^=') return urlHit(v => v.startsWith(cmpUrl));
      if (cond.op === '$=') return urlHit(v => v.endsWith(cmpUrl)); if (cond.op === '*=') return urlHit(v => v.includes(cmpUrl));
      if (cond.op === '=~') {
        if (safeRegexTest(cond.regex, url)) return true;
        let folded = '';
        try {
          const abs = /^[a-z][a-z0-9+.-]*:\/\//i.test(url) || url.startsWith('//');
          if (!abs) folded = safeDecodeURIComponent(url);
          else {
            const u = new URL(url.startsWith('//') ? 'http:' + url : url);
            const host = toUnicodeHostname(u.hostname);
            const auth = u.username ? u.username + (u.password ? ':' + u.password : '') + '@' : '';
            const port = u.port ? ':' + u.port : '';
            const tail = safeDecodeURIComponent(u.pathname + u.search) + safeDecodeURIComponent(u.hash);
            folded = (url.startsWith('//') ? '//' : u.protocol + '//') + auth + host + port + tail;
          }
        } catch (_) { folded = safeDecodeURIComponent(url); }
        return folded !== url && safeRegexTest(cond.regex, folded);
      }
      return false;
    }
    if (cond.type === 'host' || cond.type === 'path' || cond.type === 'scheme') {
      if (!url) return false; let u;
      try {
        const isAbsolute = /^[a-z][a-z0-9+.-]*:\/\//i.test(url) || url.startsWith('//');
        if (isAbsolute) {
          u = new URL(url.startsWith('//') ? 'http:' + url : url);
        } else {
          if (cond.type === 'scheme' || cond.type === 'host') {
            const m = url.match(/^([a-z][a-z0-9+.-]*):(?:\/\/)?/i); if (!m) return false;
          }
          u = new URL(url, 'http://localhost');
        }
      } catch (e) {
        return false;
      }
      const cmpVal = cond.type === 'host' ? toASCIIHostname(cond.val) : cond.val; if (cond.op !== '=~' && !cmpVal) return false; const hasPortInCond = cond.type === 'host' && cmpVal.includes(':');
      const raw = cond.type === 'host' ? (hasPortInCond ? toASCIIHostname(u.host || u.hostname) : toASCIIHostname(u.hostname))
        : cond.type === 'path' ? (u.pathname + u.search)
        : u.protocol.slice(0, -1); const value = raw.toLowerCase(); let altValue = value; let altCmpVal = cmpVal;
      if (cond.type === 'path') {
        altValue = safeDecodeURIComponent(raw).toLowerCase(); altCmpVal = safeDecodeURIComponent(cmpVal).toLowerCase();
      }
      if (cond.op === '=') return value === cmpVal || altValue === altCmpVal; if (cond.op === '^=') return value.startsWith(cmpVal) || altValue.startsWith(altCmpVal);
      if (cond.op === '$=') {
        if (cond.type === 'host') {
          const target = cmpVal.replace(/^\.+|\.+$/g, ''); if (target.startsWith(':')) return value.endsWith(target);
          return value === target || value.endsWith(`.${target}`);
        }
        return value.endsWith(cmpVal) || altValue.endsWith(altCmpVal);
      }
      if (cond.op === '*=') return value.includes(cmpVal) || altValue.includes(altCmpVal);
      if (cond.op === '=~') {
        if (cond.type === 'host') {
          const uHost = u.hostname; let unicodeHost = uHost;
          try {
            if (typeof toUnicodeHostname === 'function') {
              unicodeHost = toUnicodeHostname(uHost);
            }
          } catch (_) {}
          return safeRegexTest(cond.regex, raw) || safeRegexTest(cond.regex, uHost) || safeRegexTest(cond.regex, unicodeHost);
        }
        return safeRegexTest(cond.regex, raw) || safeRegexTest(cond.regex, safeDecodeURIComponent(raw));
      }
      return false;
    }
    return false;
  }

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
    if (ast.type === 'not') return !evalCondAST(ast.child, title, url); if (ast.type === 'leaf') return evalDynamicLeaf(ast.cond, title, url); return !!ast.value;
  }

  function parseConditionPart(trimmed, currentEngine, currentSite, currentCategory) {
    const enginePropMatch = trimmed.match(/^(?:\$site|engine)\s*[=:]\s*(?:['"](.*?)['"]|([^\s\)]+))\s*i?\s*$/i);
    if (enginePropMatch) {
      const raw = (enginePropMatch[1] !== undefined ? enginePropMatch[1] : enginePropMatch[2]).trim().toLowerCase();
      const target = raw.replace(/^ddg$/, 'duckduckgo').replace(/^yahoo-japan$/, 'yahoo'); const engine = String(currentEngine || '').toLowerCase();
      return { matched: true, static: engine === target || engine === raw };
    }

    const categoryMatch = trimmed.match(/^(?:\$category|category)\s*[=:]\s*(?:['"](.*?)['"]|([^\s\)]+))\s*i?\s*$/i);
    if (categoryMatch) {
      const target = (categoryMatch[1] !== undefined ? categoryMatch[1] : categoryMatch[2]).trim().toLowerCase(); return { matched: true, static: (currentCategory || 'web') === target };
    }

    let siteMatch = trimmed.match(/^site\s*[=:]\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|([^\s\)]+))\s*i?\s*$/i);
    if (!siteMatch) siteMatch = trimmed.match(/^site\s*\(\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|([^\s\)]+))\s*\)\s*i?\s*$/i);
    if (siteMatch) {
      const rawVal = (siteMatch[1] !== undefined ? siteMatch[1] : (siteMatch[2] !== undefined ? siteMatch[2] : siteMatch[3])); const target = toASCIIHostname(rawVal.trim().replace(/^\.+|\.+$/g, ''));
      const curSite = toASCIIHostname(String(currentSite || ''));
      return { matched: true, static: curSite === target || curSite.endsWith(`.${target}`) };
    }

    const eqRe = trimmed.match(/^(title|url|host|path|scheme)\s*(?:=\~\s*|=\s*)?\/((?:[^/\\\[]|\\.|\[(?:[^\]\\]|\\.)*\])*)\/([a-z]*)$/i);
    const eqSeg = eqRe ? String(eqRe[3] || '') : ''; const eqFlags = eqRe && isUniqueFlagsStr(eqSeg) ? eqSeg.toLowerCase() : '';
    const eqReOk = eqRe && !getInvalidRegexFlags(eqFlags) && (eqFlags || !eqSeg || (!/^(title|url|host|path|scheme)\s*=/i.test(trimmed) && !isFlagsCandidateError(eqSeg))) && (String(eqRe[2] || '').trim() || eqSeg);
    const strMatch = eqReOk ? null : trimmed.match(/^(title|url|host|path|scheme)\s*(\^=|\$=|\*=|=|:)\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|([^\s"']+))\s*i?\s*$/i);
    if (strMatch) {
      if (strMatch[5] !== undefined && strMatch[5].startsWith('~')) return { matched: false }; const op = strMatch[2] === ':' ? '=' : strMatch[2];
      const rawVal = (strMatch[3] !== undefined ? strMatch[3] : (strMatch[4] !== undefined ? strMatch[4] : strMatch[5])); let val = rawVal.replace(/\\(["'])/g, '$1').toLowerCase();
      const condType = strMatch[1].toLowerCase(); if (condType === 'host') val = val.startsWith('/') ? val : toASCIIHostname(val); return { matched: true, dynamic: { type: condType, op, val } };
    }

    const reMatch = trimmed.match(/^(title|url|host|path|scheme)\s*(?:=\~\s*|=\s*)?\/((?:[^/\\\[]|\\.|\[(?:[^\]\\]|\\.)*\])*)\/([a-z]*)$/i);
    if (reMatch) {
      const condType = reMatch[1].toLowerCase(); const seg = String(reMatch[3] || ''); const flags = isUniqueFlagsStr(seg) ? seg.toLowerCase() : '';
      const shorthand = !/^(title|url|host|path|scheme)\s*=/i.test(trimmed);
      if (flags) { if (getInvalidRegexFlags(flags)) return { matched: false }; }
      else if (shorthand ? isFlagsCandidateError(seg) : seg !== '') return { matched: false };
      if (!String(reMatch[2] || '').trim()) return { matched: false };
      return { matched: true, dynamic: { type: condType, op: '=~', regex: new RegExp(flags || !seg ? reMatch[2] : reMatch[2] + '/' + seg, flags) } };
    }

    return { matched: false };
  }

  const SUPPORTED_REGEX_FLAGS = 'imsu';
  function getInvalidRegexFlags(flags) {
    const invalid = []; const seen = new Set();
    for (const flag of flags.toLowerCase()) {
      if (!SUPPORTED_REGEX_FLAGS.includes(flag) || seen.has(flag)) invalid.push(flag); seen.add(flag);
    }
    return [...new Set(invalid)].join('');
  }
  function isUniqueFlagsStr(seg) { const s = String(seg || '').toLowerCase(); return /^[imsu]+$/.test(s) && new Set(s).size === s.length; }
  function isFlagsCandidateError(seg) { seg = String(seg || ''); return /^[gy]+$/i.test(seg) || (seg.length <= 2 && /^[gyimsu]+$/i.test(seg) && /[gy]/i.test(seg)); }

  function validateUrlWildcard(rule) {
    if (!rule || /[<>"']/.test(rule) || /\s/.test(rule)) return false; if (rule.startsWith('|') || rule.startsWith('@@')) return false; if (rule.includes('^')) return false;
    if (rule.includes('://')) {
      const scheme = rule.split('://')[0]; if (scheme !== '*' && !/^[a-z][a-z0-9+.-]*$/.test(scheme.toLowerCase())) return false;
    }
    const hostPart = rule.includes('://') ? (rule.split('/')[2] || '') : rule.split('/')[0]; if (/[$~]/.test(hostPart)) return false;
    if (/^\*:\/\/\*\*+/.test(rule) || /^\*{2,}:\//.test(rule) || /\*{3,}/.test(rule)) return false; if (rule.startsWith('*://') && !/^\*:\/\/[^/]+(?:\/.*)?$/.test(rule)) return false; return true;
  }

  function evaluateCondition(condStr, dynamicConditionsList) {
    const { ast, errors } = analyzeCondExpr(condStr); if (errors.length || !ast) return false; const folded = foldCondExpr(ast); if (folded.type === 'const') return folded.value;
    dynamicConditionsList.push(folded); return true;
  }

  function stripIfConditions(ruleStr, evaluateCond) {
    let coreRule = ruleStr.trim(); let staticPass = true;

    const ranges = [];
    for (const occ of findIfOccurrences(coreRule)) {
      const parenResult = extractBalancedParens(coreRule, occ.condStart); if (!parenResult) continue;

      const cond = parenResult.content.trim();
      const rangeStart = occ.index;
      ranges.push({
        start: rangeStart,
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
    if (!str) return false; return !str.startsWith('/') && !/^title\//i.test(str) && !/^text\//i.test(str) && !str.startsWith('*://') && !/^[a-z][a-z0-9+.-]*:\/\//i.test(str);
  }

  function looksLikeCondExpr(str) {
    if (!isCondExprCore(str)) return false; if (/^\s*!\s*(?:[A-Z][a-zA-Z0-9_-]*)\s*:\s*\S/.test(str)) return false;
    if (/^\s*!\s+(?:title|url|description|version|expires|homepage|host|site|path|scheme)\s*:\s*\S/i.test(str)) return false;
    if (!/^\s*(?:!|\(|\$site\b|\$category\b|engine\b|category\b|(?:site|title|url|host|path|scheme)\s*(?:=~|\^=|\$=|\*=|=|:|\/))/i.test(str)) return false;
    return /(?:^|[\s(&|!])(?:\$site|\$category|engine|category|site|title|url|host|path|scheme)\s*(?:(?:=~|\^=|\$=|\*=|=|:)\s+\S|(?:=~|\^=|\$=|\*=|=|:)\S|\/)/i.test(str)
      || /^\s*!\s*(?:(?:\$site|\$category|engine|category|site|title|url|host|path|scheme)\b|\()/i.test(str);
  }

  function isScriptRuleLine(line) {
    const s = line.trim(); if (!s) return false; if (s.startsWith('/') || s.startsWith('*://') || /^[a-z][a-z0-9+.-]*:\/\//i.test(s)) return true;
    if (/^title\//i.test(s) || /^text\//i.test(s)) return true; if (s.startsWith('@')) return true; return looksLikeCondExpr(s);
  }

  function isElementRuleLine(line) {
    if (!/(?:##|#@#|#(?:@)?[$?%]{1,2}#)/.test(line)) return false; return !isScriptRuleLine(line);
  }

  function absorbStandaloneExpr(coreRule, dynamicConditions) {
    if (!looksLikeCondExpr(coreRule)) return null; const { ast, errors } = analyzeCondExpr(coreRule); if (errors.length || !ast) return null; const folded = foldCondExpr(ast);
    if (folded.type === 'const') return { staticPass: folded.value }; dynamicConditions.push(folded); return { staticPass: true };
  }

  function parseRuleWithConditions(ruleStr) {
    const dynamicConditions = []; let { coreRule, staticPass } = stripIfConditions(ruleStr, (cond) => evaluateCondition(cond, dynamicConditions));

    let whitelist = false;
    if (coreRule.startsWith('@')) {
      whitelist = true; coreRule = coreRule.substring(1).trim();
    }

    const absorbed = absorbStandaloneExpr(coreRule, dynamicConditions);
    if (absorbed) {
      staticPass = staticPass && absorbed.staticPass; coreRule = '';
    }
    const staticMatchAll = !absorbed && !coreRule && staticPass && !dynamicConditions.length && /@if\s*\(/i.test(ruleStr);

    const standaloneExpr = !!absorbed || staticMatchAll || (!coreRule && dynamicConditions.length > 0); if (whitelist) coreRule = '@' + coreRule; if (coreRule === '@' && /@@if\s*\(/i.test(ruleStr)) coreRule = '@@';
    return {
      coreRule,
      staticPass,
      dynamicConditions,
      standaloneExpr
    };
  }

  function extractIfConditions(ruleStr) {
    const conds = [];
    for (const occ of findIfOccurrences(ruleStr)) {
      const parenResult = extractBalancedParens(ruleStr, occ.condStart); if (parenResult) conds.push(parenResult.content.trim());
    }
    return conds;
  }

  function validateCondition(condStr) {
    const errors = []; const warnings = []; const { errors: rawErrors } = analyzeCondExpr(condStr);
    for (const e of rawErrors) {
      if (e.kind === 'unknown') {
        errors.push(t('unknownIfCondition', { part: e.part }));
      } else if (e.kind === 'regex') {
        errors.push(t('condRegexError', { part: e.part }));
      } else if (e.kind === 'flags') {
        errors.push(t('invalidRegexFlags', { flags: e.part }));
      } else {
        const display = condStr.length > 60 ? condStr.slice(0, 60) + '…' : condStr; errors.push(t('condExprError', { part: display }));
      }
    }
    return { errors, warnings };
  }

  function analyzeRule(rule) {
    if (!rule || rule.trim() === '') return { valid: true, errors: [], warnings: [] };

    let ruleToCheck = rule.trim(); if (ruleToCheck.startsWith('#')) return { valid: true, errors: [], warnings: [] }; ruleToCheck = stripRuleComment(ruleToCheck);
    if (!ruleToCheck) return { valid: true, errors: [], warnings: [] }; const errors = []; const warnings = [];
    let hlN = null; const hlValMatch = ruleToCheck.match(/^@(\d+)(?=\s|$|\*:\/\/|https?:\/\/|\/|title\/|text\/|(?:title|text|host|path|url|scheme|site|engine|category|\$site|\$category)\s*(?:=~|\^=|\$=|\*=|=|:|\/)|[(!])/);
    if (hlValMatch) {
      const N = parseInt(hlValMatch[1]);
      if (N < 1 || N > 5) {
        return { valid: false, errors: [t('hlColorError')], warnings };
      }
      hlN = N; ruleToCheck = ruleToCheck.substring(hlValMatch[0].length).trim(); if (!ruleToCheck) return { valid: false, errors: [t('emptyPrefixRule')], warnings };
    }

    if (/^@@if\b/i.test(ruleToCheck)) return { valid: false, errors: [t('invalidUrlWildcard', { rule: ruleToCheck })], warnings };
    const hasIfCond = /@if\s*\(/i.test(ruleToCheck);
    if (hasIfCond) {
        let unbalanced = false;
        for (const occ of findIfOccurrences(ruleToCheck)) {
          if (!extractBalancedParens(ruleToCheck, occ.condStart)) { unbalanced = true; break; }
        }
        if (unbalanced) return { valid: false, errors: [t('ifParenError')], warnings };
        for (const cond of extractIfConditions(ruleToCheck)) {
          if (!cond.trim()) {
            errors.push(t('emptyIfCondition')); continue;
          }
          const r = validateCondition(cond); errors.push(...r.errors); warnings.push(...r.warnings);
        }
    }

    const stripped = stripIfConditions(ruleToCheck); ruleToCheck = stripped.coreRule;
    if (ruleToCheck.startsWith('@')) {
      if (ruleToCheck.startsWith('@@')) {
        errors.push(t('invalidUrlWildcard', { rule: ruleToCheck })); return { valid: false, errors, warnings };
      }
      ruleToCheck = ruleToCheck.substring(1).trim();
      if (!ruleToCheck) {
        if (hasIfCond) return { valid: errors.length === 0, errors, warnings }; return { valid: false, errors: [t('emptyPrefixRule')], warnings };
      }
    }

    if (!ruleToCheck) {
      return { valid: errors.length === 0, errors, warnings };
    }

    if (isElementRuleLine(ruleToCheck)) { errors.push(t('elementRuleUnsupported')); return { valid: false, errors, warnings }; }
    if (looksLikeCondExpr(ruleToCheck)) {
      const r = validateCondition(ruleToCheck); errors.push(...r.errors); warnings.push(...r.warnings); return { valid: errors.length === 0, errors, warnings };
    }

    if (ruleToCheck.startsWith('/') && ruleToCheck.lastIndexOf('/') === 0) {
      errors.push(t('regexError'));
    }

    try {
      if (ruleToCheck.startsWith('/') && ruleToCheck.lastIndexOf('/') > 0) {
        const { pattern, flags } = ruleToRegex(ruleToCheck);
        if (!pattern.trim()) {
          errors.push(t('regexError')); return { valid: false, errors, warnings };
        }
        const invalidFlags = getInvalidRegexFlags(flags);
        if (invalidFlags) {
          errors.push(t('invalidRegexFlags', { flags: invalidFlags })); return { valid: false, errors, warnings };
        }
        new RegExp(pattern, String(flags || '').toLowerCase());
      } else if (/^(?:text|title)\//i.test(ruleToCheck)) {
        const prefixLen = /^title\//i.test(ruleToCheck) ? 6 : 5; const { pattern, flags, flagsCandidate, unclosed } = parsePrefixedRegexRule(ruleToCheck, prefixLen);
        if (unclosed) {
          errors.push(t('regexError')); return { valid: false, errors, warnings };
        }
        if (!pattern.trim()) {
          errors.push(t('emptyPrefixRule')); return { valid: false, errors, warnings };
        }
        const invalidFlags = getInvalidRegexFlags(flags);
        if (invalidFlags) {
          errors.push(t('invalidRegexFlags', { flags: invalidFlags })); return { valid: false, errors, warnings };
        }
        if (flagsCandidate && (isFlagsCandidateError(flagsCandidate) || (flagsCandidate.length <= 2 && /^[gyimsu]+$/i.test(flagsCandidate) && getInvalidRegexFlags(flagsCandidate)))) {
          errors.push(t('invalidRegexFlags', { flags: getInvalidRegexFlags(flagsCandidate) })); return { valid: false, errors, warnings };
        }
        new RegExp(pattern, String(flags || '').toLowerCase());
      } else {
        if (!validateUrlWildcard(ruleToCheck)) {
          errors.push(t('invalidUrlWildcard', { rule: ruleToCheck })); return { valid: false, errors, warnings };
        }
        new RegExp(wildcardToRegex(ruleToCheck), 'i');
      }
    } catch (e) {
      errors.push((ruleToCheck.startsWith('/') || /^(?:text|title)\//i.test(ruleToCheck)) ? t('regexError') : t('urlError'));
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  function validateRule(rule) {
    return analyzeRule(rule).valid;
  }

  function parsePrefixedRegexRule(rawRule, prefixLen) {
    let memo = parsePrefixedRegexRule._memo; if (!memo) memo = parsePrefixedRegexRule._memo = new Map(); const memoKey = prefixLen + '\u0000' + rawRule;
    if (memo.has(memoKey)) return memo.get(memoKey); let remaining = rawRule.substring(prefixLen); let pattern, flags = ''; let flagsCandidate = ''; let lastSlashIndex = -1; let unclosed = false;
    for (let i = remaining.length - 1; i >= 0; i--) {
      if (remaining[i] === '/') {
        let backslashCount = 0; let j = i - 1;
        while (j >= 0 && remaining[j] === '\\') {
          backslashCount++; j--;
        }
        if (backslashCount % 2 === 0) {
          lastSlashIndex = i; break;
        }
      }
    }
    if (lastSlashIndex !== -1 && lastSlashIndex < remaining.length - 1) {
      const possibleFlags = remaining.substring(lastSlashIndex + 1);
      const isUniqueFlags = (str) => {
        const lower = str.toLowerCase(); return /^[imsu]+$/.test(lower) && new Set(lower).size === lower.length;
      };
        if (isUniqueFlags(possibleFlags)) {
        flags = possibleFlags.toLowerCase(); pattern = remaining.substring(0, lastSlashIndex);
      } else {
        pattern = remaining; flagsCandidate = possibleFlags;
      }
    } else {
      pattern = remaining; unclosed = lastSlashIndex === -1;
    }
    if (!flags && remaining.endsWith('/')) {
      let backslashCount = 0; let j = remaining.length - 2;
      while (j >= 0 && remaining[j] === '\\') {
        backslashCount++; j--;
      }
      if (backslashCount % 2 === 0) {
        pattern = remaining.slice(0, -1);
      }
    }
    if (!flags) {
      const oldFlagMatch = pattern.match(/^\(\?([imsu]+)\)/i);
      if (oldFlagMatch) {
        flags = oldFlagMatch[1].toLowerCase(); pattern = pattern.substring(oldFlagMatch[0].length);
      }
    }
    const parsed = { pattern, flags: String(flags || '').toLowerCase(), flagsCandidate, unclosed }; memo.set(memoKey, parsed); return parsed;
  }

  function escapeWildcardPart(part, isHost) {
    const starPattern = isHost ? '[^/]*' : '.*';
    if (isHost && part && !/^[\x00-\x7F]*$/.test(part)) {
      part = part.split('.').map(label => {
        if (!label || label === '*' || label.includes('\\') || /^[\x00-\x7F]*$/.test(label)) return label; return hostLabelToASCII(label);
      }).join('.');
    }
    if (!isHost) part = encodeNonAscii(part);
    let out = ''; let i = 0;
    if (isHost && part.startsWith('*.')) {
      out += '(?:[^/]*\\.)?'; i = 2;
    }
    for (; i < part.length; i++) {
      const ch = part[i];
      if (ch === '\\' && i + 1 < part.length) {
        const nxt = part[i + 1]; if (/[a-z0-9]/i.test(nxt)) out += '\\\\' + nxt; else out += ch + nxt; i++; continue;
      }
      if (ch === '*') {
        if (isHost && i > 0 && part[i - 1] === '.') {
          out += (i === part.length - 1) ? '[^./]*(?:\\.[^./]*)?' : '[^./]*';
        } else if (isHost) {
          out += part === '*' ? '[^/]*' : '[^./]*';
        } else {
          out += starPattern;
        }
        continue;
      }
      if (ch === '?') { out += '\\?'; continue; }
      if ('.+^${}()|[]\\'.includes(ch)) { out += '\\' + ch; continue; }
      out += ch;
    }
    return out;
  }

  function wildcardToRegex(pattern) {
    function splitHostAndPort(part) {
      let auth = ''; const atIdx = part.lastIndexOf('@');
      if (atIdx !== -1) {
        auth = part.slice(0, atIdx + 1); part = part.slice(atIdx + 1);
      }
      if (part.startsWith('[')) {
        const bracketEnd = part.indexOf(']');
        if (bracketEnd !== -1 && part.charCodeAt(bracketEnd + 1) === 58) {
          return { host: auth + part.slice(0, bracketEnd + 1), port: part.slice(bracketEnd + 1), hasPort: true };
        }
        return { host: auth + part, port: '', hasPort: false };
      }
      const lastColon = part.lastIndexOf(':');
      if (lastColon !== -1) {
        return { host: auth + part.slice(0, lastColon), port: part.slice(lastColon), hasPort: true };
      }
      return { host: auth + part, port: '', hasPort: false };
    }

    function escapeHostPart(part) {
      const { host, port, hasPort } = splitHostAndPort(part); const escapedHost = escapeWildcardPart(host, true);
      const dotTolerant = host.endsWith('*') ? '' : '\\.?';
      if (hasPort) {
        let out = '';
        for (let i = 0; i < port.length; i++) {
          const ch = port[i];
          if (ch === '\\' && i + 1 < port.length) {
            const nxt = port[i + 1]; if (/[a-z0-9]/i.test(nxt)) out += '\\\\' + nxt; else out += ch + nxt; i++; continue;
          }
          if (ch === '*') { out += '[^/:]*'; continue; }
          if (ch === '?') { out += '\\?'; continue; }
          if ('.+^${}()|[]\\'.includes(ch)) { out += '\\' + ch; continue; }
          out += ch;
        }
        return escapedHost + dotTolerant + out;
      }
      return escapedHost + dotTolerant + '(?::\\d+)?';
    }

    let prefix = '^'; let hostIsFirst = false;
    if (pattern.startsWith('*://')) {
      prefix += 'https?:\\/\\/(?:[^\\/@:]+(?::[^\\/@:]*)?@)?'; pattern = pattern.substring(4); hostIsFirst = true;
    } else {
      const schemeMatch = pattern.match(/^([a-z][a-z0-9+.-]*):\/\//i);
      if (schemeMatch) {
        prefix += escapeWildcardPart(schemeMatch[1], false) + ':\\/\\/(?:[^\\/@:]+(?::[^\\/@:]*)?@)?'; pattern = pattern.substring(schemeMatch[0].length); hostIsFirst = true;
      } else {
        prefix += '(?:https?:\\/\\/(?:[^\\/@:]+(?::[^\\/@:]*)?@)?)?'; hostIsFirst = pattern.includes('/') || pattern.includes('.');
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
        .join('\\/'); return pattern.endsWith('*') ? regexStr : regexStr + '(?:[\\/?#:]|$)';
    }
    return prefix + (hostIsFirst ? escapeHostPart(pattern) : escapeWildcardPart(pattern, false)) + '(?:[\\/?#:]|$)';
  }

  function ruleToRegex(rule) {
    let memo = ruleToRegex._memo; if (!memo) memo = ruleToRegex._memo = new Map(); if (memo.has(rule)) return memo.get(rule); let out; if (rule.startsWith('.')) rule = '*' + rule;
    if (!rule.startsWith('/') && !/^title\//i.test(rule) && !/^text\//i.test(rule) &&
      !rule.includes('://') && !rule.startsWith('.')) {
      const restMatch = rule.match(/^([^\/?#]+)([\/?#].*)?$/);
      if (restMatch && restMatch[1].includes('.') && !restMatch[1].includes('*') && !/\s/.test(rule)) {
        rule = restMatch[2] ? '*://*.' + restMatch[1] + (restMatch[2].startsWith('/') ? restMatch[2] : '/' + restMatch[2]) : '*://*.' + rule + '/*';
      }
    }

    if (rule.startsWith('/') && rule.lastIndexOf('/') > 0) {
      const lastSlash = rule.lastIndexOf('/'); const pattern = rule.slice(1, lastSlash); const flags = rule.slice(lastSlash + 1).toLowerCase(); out = { pattern, flags }; memo.set(rule, out);
      return out;
    }

    if (/^title\//i.test(rule)) {
      out = parsePrefixedRegexRule(rule, 6); memo.set(rule, out); return out;
    }

    if (/^text\//i.test(rule)) {
      out = parsePrefixedRegexRule(rule, 5); memo.set(rule, out); return out;
    }

    out = {
      pattern: wildcardToRegex(rule),
      flags: 'i'
    };
    memo.set(rule, out); return out;
  }

  function normalizeHostCandidate(host) {
    const domain = toASCIIHostname(String(host || '').replace(/^\.+/, '').replace(/\\/g, ''));
    return /^[a-z0-9_-]+(?:\.[a-z0-9_-]+)+$/.test(domain) ? domain : null;
  }

  function matchWildcardDomainPattern(pattern) {
    if (pattern.startsWith('.')) pattern = '*' + pattern; if (pattern.includes(':') && !pattern.startsWith('*://')) return null; const bareWildcard = pattern.match(/^\*\.([^\/\*\s:?#]+)$/);
    if (bareWildcard) {
      const domain = normalizeHostCandidate(bareWildcard[1]); if (domain) return { domain, domainType: 'wildcard' };
    }
    if (!pattern.startsWith('/') && !/^title\//i.test(pattern) && !/^text\//i.test(pattern) &&
      !pattern.includes('*') && !pattern.includes('://') && !pattern.startsWith('.')) {
      if (pattern.includes('.') && !/\s/.test(pattern) && !pattern.includes('/') &&
        !pattern.includes(':') && !pattern.includes('?') && !pattern.includes('#')) {
        const domain = normalizeHostCandidate(pattern); if (domain) return { domain, domainType: 'wildcard' };
      }
    }
    const wildcardMatch = pattern.match(/^\*:\/\/\*\.([^\/\*:@]+)\/\*$/);
    if (wildcardMatch) {
      const domain = normalizeHostCandidate(wildcardMatch[1]); if (domain) return { domain, domainType: 'wildcard' };
    }
    const exactMatch = pattern.match(/^\*:\/\/([^\/\*:@]+)\/\*$/);
    if (exactMatch) {
      const domain = normalizeHostCandidate(exactMatch[1]); if (domain) return { domain, domainType: 'exact' };
    }
    return null;
  }

  function extractSimpleWhitelistDomain(rule) {
    if (!rule || !rule.startsWith('@') || rule.startsWith('@@')) return null; const m = matchWildcardDomainPattern(rule.substring(1)); if (!m) return null;
    return { domain: m.domain, type: m.domainType };
  }

  function matchSimpleDomain(coreRule) {
    return matchWildcardDomainPattern(coreRule);
  }

  function compileRuleRegex(coreRule) {
    let memo = compileRuleRegex._memo; if (!memo) memo = compileRuleRegex._memo = new Map(); if (memo.has(coreRule)) return memo.get(coreRule); let type = 'url'; let pattern = ''; let flags = '';
    if (coreRule.startsWith('/') && coreRule.lastIndexOf('/') === 0) {
      throw new Error('Unbalanced regex');
    }
    if (coreRule.startsWith('/') && coreRule.lastIndexOf('/') > 0) {
      type = 'regex'; const r = ruleToRegex(coreRule); pattern = r.pattern; flags = r.flags;
    } else if (/^title\//i.test(coreRule)) {
      type = 'title'; const r = ruleToRegex(coreRule); if (r.unclosed) throw new Error('Unbalanced regex'); pattern = r.pattern; flags = r.flags;
    } else if (/^text\//i.test(coreRule)) {
      type = 'text'; const r = parsePrefixedRegexRule(coreRule, 5); if (r.unclosed) throw new Error('Unbalanced regex'); pattern = r.pattern; flags = r.flags;
    } else {
      type = 'url'; const r = ruleToRegex(coreRule); pattern = r.pattern; flags = r.flags;
    }
    if (!pattern || !pattern.trim()) {
      throw new Error('Empty regex pattern');
    }
    const sanitizedFlags = Array.from(new Set(String(flags || '').toLowerCase().split('')))
      .filter(f => 'imsu'.includes(f))
      .join(''); const compiled = { type, regex: new RegExp(pattern, sanitizedFlags) }; memo.set(coreRule, compiled); return compiled;
  }

  function buildRuleIndex() {
    let pageContext = ''
    try {
      pageContext = getSearchEngine() + '|' + getSearchCategory() + '|' + String(window.location.hostname || '');
    } catch (e) {}
    const signature = JSON.stringify([currentConfig.rules, currentConfig.language, pageContext]); if (compiledRules && compiledRules.indexSignature === signature) return;
    validationCache.clear(); subdomainCache.clear(); if (ruleToRegex._memo) ruleToRegex._memo.clear(); if (parsePrefixedRegexRule._memo) parsePrefixedRegexRule._memo.clear();
    if (compileRuleRegex._memo) compileRuleRegex._memo.clear();
    compiledRules = newCompiledRules();
    const allRules = currentConfig.rules;

    allRules.forEach((rule, ruleIndex) => {
      if (typeof rule !== 'string') { if (currentConfig.debug) console.warn('非字符串规则项, 已跳过:', rule); return; }
      rule = stripRuleComment(rule.trim()); if (!rule) return; let ruleValid = true;
      try {
        ruleValid = validateRule(rule);
      } catch (e) {
        ruleValid = false;
      }
      if (!ruleValid) {
        if (currentConfig.debug) console.warn('规则校验未通过, 已跳过:', rule); return;
      }

      const isLocal = true;
      const source = t('localRule');

      const hlMatch = rule.match(/^@(\d+)(?=\s|$|\*:\/\/|https?:\/\/|\/|title\/|text\/|(?:title|text|host|path|url|scheme|site|engine|category|\$site|\$category)\s*(?:=~|\^=|\$=|\*=|=|:|\/)|[(!])/);
      if (hlMatch) {
        const N = parseInt(hlMatch[1]); if (N < 1 || N > 5) return; let hlRule = rule.substring(hlMatch[0].length).trim(); if (!hlRule) return; let parsed;
        try {
          parsed = parseRuleWithConditions(hlRule);
        } catch (e) {
          if (currentConfig.debug) console.warn('高亮规则解析失败:', hlRule, e); return;
        }
        if (!parsed.staticPass) return; let coreRule = parsed.coreRule;
        const highlightWhitelist = coreRule.startsWith('@') && !coreRule.startsWith('@@');
        if (highlightWhitelist) coreRule = coreRule.substring(1).trim();

        if (!coreRule && (parsed.standaloneExpr || parsed.dynamicConditions.length)) {
          compiledRules.highlightConditionalRules.push({type: 'expr', conditions: parsed.dynamicConditions, originalRule: rule, N, source, isLocal});
          if (!highlightWhitelist) return;
        } else if (coreRule) {
          const dm = matchSimpleDomain(coreRule);
          if (dm) {
            if (!parsed.dynamicConditions.length) {
              if (!compiledRules.highlightDomains.has(dm.domain))
                compiledRules.highlightDomains.set(dm.domain, []); compiledRules.highlightDomains.get(dm.domain).push({N, type: dm.domainType, originalRule: rule, source, isLocal});
            } else {
              const hlCondRule = {type: 'domain', domain: dm.domain, N, conditions: parsed.dynamicConditions, domainType: dm.domainType, originalRule: rule, source, isLocal};
              if (!compiledRules.highlightConditionalDomains.has(dm.domain))
                compiledRules.highlightConditionalDomains.set(dm.domain, []); compiledRules.highlightConditionalDomains.get(dm.domain).push(hlCondRule);
            }
          } else {
            try {
              const compiled = compileRuleRegex(coreRule); const ruleObj = {type: compiled.type, regex: compiled.regex, conditions: parsed.dynamicConditions, originalRule: rule, N, source, isLocal};
              if (!parsed.dynamicConditions.length) {
                if (compiled.type === 'url' || compiled.type === 'regex') compiledRules.highlightUrls.push({regex: compiled.regex, originalRule: rule, N, source, isLocal});
                else if (compiled.type === 'title') compiledRules.highlightTitles.push({regex: compiled.regex, originalRule: rule, N, source, isLocal});
                else if (compiled.type === 'text') compiledRules.highlightTexts.push({regex: compiled.regex, originalRule: rule, N, source, isLocal});
              } else {
                compiledRules.highlightConditionalRules.push(ruleObj);
              }
            } catch (e) {
              if (currentConfig.debug) console.warn('高亮规则编译失败:', hlRule, e);
            }
          }
        }
        if (!highlightWhitelist) return;
        rule = hlRule;
      }

      if (!rule || rule.trim() === '' || rule.startsWith('#')) return;

      let parsed;
      try {
        parsed = parseRuleWithConditions(rule);
      } catch (e) {
        if (currentConfig.debug) console.warn('规则解析失败:', rule, e); return;
      }
      if (!parsed.staticPass) return;

      const coreRule = parsed.coreRule; const hasDynamic = parsed.dynamicConditions.length > 0;
      if (coreRule.startsWith('@@')) return;
      if (coreRule.startsWith('@')) {
        const simpleDomain = extractSimpleWhitelistDomain(coreRule);
        if (simpleDomain) {
          if (!hasDynamic) {
            if (!compiledRules.whitelistDomains.has(simpleDomain.domain))
              compiledRules.whitelistDomains.set(simpleDomain.domain, []); compiledRules.whitelistDomains.get(simpleDomain.domain).push({type: simpleDomain.type, originalRule: rule, source, isLocal});
          } else {
            if (!compiledRules.whitelistConditionalDomains.has(simpleDomain.domain))
              compiledRules.whitelistConditionalDomains.set(simpleDomain.domain, []);
            compiledRules.whitelistConditionalDomains.get(simpleDomain.domain).push({type: simpleDomain.type, conditions: parsed.dynamicConditions, originalRule: rule, source, isLocal});
          }
        } else {
          const whitelistRule = coreRule.substring(1).trim();
          if (!whitelistRule) {
            if (parsed.standaloneExpr || hasDynamic) {
              compiledRules.whitelistConditionalRules.push({type: 'expr', conditions: parsed.dynamicConditions, originalRule: rule, source, isLocal});
            }
            return;
          }
          try {
            const compiled = compileRuleRegex(whitelistRule);
            if (!hasDynamic) {
              if (compiled.type === 'title') {
                compiledRules.whitelistTitlePatterns.push({regex: compiled.regex, originalRule: rule, source, isLocal});
              } else if (compiled.type === 'text') {
                compiledRules.whitelistTextPatterns.push({regex: compiled.regex, originalRule: rule, source, isLocal});
              } else {
                compiledRules.whitelistUrlPatterns.push({regex: compiled.regex, originalRule: rule, source, isLocal});
              }
            } else {
              compiledRules.whitelistConditionalRules.push({type: compiled.type, regex: compiled.regex, conditions: parsed.dynamicConditions, originalRule: rule, source, isLocal});
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
          ruleObj.type = 'expr'; compiledRules.conditionalRules.push(ruleObj);
        }
        return;
      }

      if (!coreRule.startsWith('/') && !/^text\//i.test(coreRule) && !/^title\//i.test(coreRule)) {
        const dm = matchSimpleDomain(coreRule);
        if (dm) {
          ruleObj.type = 'domain'; ruleObj.domain = dm.domain; ruleObj.domainType = dm.domainType;
          if (!hasDynamic) {
            if (!compiledRules.domains.has(dm.domain))
              compiledRules.domains.set(dm.domain, []); compiledRules.domains.get(dm.domain).push({type: dm.domainType, originalRule: rule, source, isLocal});
          } else {
            if (!compiledRules.conditionalDomains.has(dm.domain))
              compiledRules.conditionalDomains.set(dm.domain, []); compiledRules.conditionalDomains.get(dm.domain).push(ruleObj);
          }
          return;
        }
      }

      try {
        const compiled = compileRuleRegex(coreRule); ruleObj.type = compiled.type; ruleObj.regex = compiled.regex;
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
    compiledRules.indexSignature = signature;
  }

  function cachedAnalyzeRule(rule) {
    if (!validationCache.has(rule)) {
      validationCache.set(rule, analyzeRule(rule));
    }
    return validationCache.get(rule);
  }

  function checkDynamicConditions(conditions, title, url) {
    if (!conditions || !conditions.length) return true;
    for (let i = 0; i < conditions.length; i++) {
      if (!evalCondAST(conditions[i], title, url)) return false;
    }
    return true;
  }

  function getSubdomainLevels(domain) {
    const lower = toASCIIHostname(domain); if (subdomainCache.has(lower)) return subdomainCache.get(lower); const levels = []; let d = lower;
    while (d) {
      levels.push(d); const dot = d.indexOf('.'); if (dot === -1) break; d = d.substring(dot + 1);
    }
    subdomainCache.set(lower, levels); return levels;
  }

  function matchDomainEntryType(entryType, level, lowerDomain) {
    return entryType === 'wildcard' || (entryType === 'exact' && level === lowerDomain);
  }

  function checkRuleMatchOptimized(url, domain, title, snippet, subdomainLevels) {
    if (!subdomainLevels) subdomainLevels = getSubdomainLevels(domain);
    const lowerDomain = toASCIIHostname(domain);

    const scanDomainMap = (map, filter) => {
      for (const level of subdomainLevels) {
        const entries = map.get(level); if (!entries) continue;
        for (const entry of entries) {
          if (!filter(entry, level)) continue; return entry;
        }
      }
      return null;
    };
    const scanPatterns = (patterns, value, filter) => {
      if (!value) return null;
      for (const item of patterns) {
        if (filter && !filter(item)) continue; if (safeRegexTest(item.regex, value)) return item;
      }
      return null;
    };
    const scanConditionalDomains = (map, filter) => {
      for (const level of subdomainLevels) {
        const rules = map.get(level); if (!rules) continue;
        for (const item of rules) {
          if (!filter(item, level)) continue; if (checkDynamicConditions(item.conditions, title, url)) return item;
        }
      }
      return null;
    };
    const scanConditionalRules = (rules, filter) => {
      for (const item of rules) {
        if (filter && !filter(item)) continue; if (!checkDynamicConditions(item.conditions, title, url)) continue; if (item.type === 'expr') return item;
        const value = item.type === 'title' ? title : item.type === 'text' ? snippet : url;
        if ((item.type === 'url' || item.type === 'regex' || item.type === 'title' || item.type === 'text') &&
            value && safeRegexTest(item.regex, value)) return item;
      }
      return null;
    };

    const hlEntry =
      scanDomainMap(compiledRules.highlightDomains, (en, lv) => matchDomainEntryType(en.type, lv, lowerDomain)) ||
      scanPatterns(compiledRules.highlightUrls, url) ||
      scanPatterns(compiledRules.highlightTitles, title) ||
      scanPatterns(compiledRules.highlightTexts, snippet) ||
      scanConditionalDomains(compiledRules.highlightConditionalDomains, (it, lv) => matchDomainEntryType(it.domainType, lv, lowerDomain)) ||
      scanConditionalRules(compiledRules.highlightConditionalRules); const highlightN = hlEntry ? hlEntry.N : 0;

    const findWhitelist = () => {
      return scanDomainMap(compiledRules.whitelistDomains, (en, lv) => matchDomainEntryType(en.type, lv, lowerDomain)) ||
        scanPatterns(compiledRules.whitelistUrlPatterns, url) ||
        scanPatterns(compiledRules.whitelistTitlePatterns, title) ||
        scanPatterns(compiledRules.whitelistTextPatterns, snippet) ||
        scanConditionalDomains(compiledRules.whitelistConditionalDomains, (it, lv) => matchDomainEntryType(it.type, lv, lowerDomain)) ||
        scanConditionalRules(compiledRules.whitelistConditionalRules);
    };
    const findBlocked = () => {
      return scanDomainMap(compiledRules.domains, (en, lv) => matchDomainEntryType(en.type, lv, lowerDomain)) ||
        scanPatterns(compiledRules.urls, url) ||
        scanPatterns(compiledRules.titles, title) ||
        scanPatterns(compiledRules.texts, snippet) ||
        scanConditionalDomains(compiledRules.conditionalDomains, (it, lv) => matchDomainEntryType(it.domainType, lv, lowerDomain)) ||
        scanConditionalRules(compiledRules.conditionalRules);
    };

    let whitelistHit = findWhitelist(); let whitelisted = !!whitelistHit; let blockedInfo = null; const toBlockedInfo = (item) => ({ rule: item.originalRule, source: item.source });
    if (!whitelisted) {
      const item = findBlocked(); if (item) blockedInfo = toBlockedInfo(item);
    }

    const toHlInfo = () => (hlEntry ? {hlRule: hlEntry.originalRule, hlSource: hlEntry.source} : {});
    if (highlightN && blockedInfo) return {highlight: highlightN, blocked: true, rule: blockedInfo.rule, source: blockedInfo.source, ...toHlInfo()};
    if (blockedInfo) return {blocked: true, rule: blockedInfo.rule, source: blockedInfo.source};
    if (whitelistHit) {
      const hit = {whitelisted: true, rule: whitelistHit.originalRule, source: whitelistHit.source};
      if (highlightN) { hit.highlight = highlightN; Object.assign(hit, toHlInfo()); }
      return hit;
    }
    if (highlightN) return {highlight: highlightN, ...toHlInfo()};
    return false;
  }

  function decodeRedirectTarget(raw) {
    if (!raw) return ''; let value = String(raw);
    for (let i = 0; i < 2; i++) {
      if (/^https?:\/\//i.test(value)) break;
      try {
        const next = decodeURIComponent(value); if (next === value) break; value = next;
      } catch (_) { break; }
    }
    return /^https?:\/\//i.test(value) ? value : '';
  }

  function decodeBingCkTarget(u) {
    if (!u) return ''; let rawEncoded = u; if (/^a[01]/i.test(rawEncoded)) rawEncoded = rawEncoded.slice(2); let base64 = rawEncoded.replace(/-/g, '+').replace(/_/g, '/');
    const rem = base64.length % 4; if (rem === 1) return ''; if (rem > 0) base64 += '='.repeat(4 - rem); let realUrl = '';
    try {
      if (typeof atob === 'function') {
        const bin = atob(base64);
        if (typeof TextDecoder !== 'undefined') {
          const bytes = Uint8Array.from(bin, c => c.charCodeAt(0)); realUrl = new TextDecoder('utf-8').decode(bytes);
        } else {
          realUrl = decodeURIComponent(escape(bin));
        }
      } else {
        realUrl = Buffer.from(base64, 'base64').toString('utf8');
      }
    } catch (_) { return ''; }

    for (let i = 0; i < 2; i++) {
      if (/^https?:\/\//i.test(realUrl)) break;
      try {
        const decoded = decodeURIComponent(realUrl); if (decoded === realUrl) break; realUrl = decoded;
      } catch (_) { break; }
    }

    return /^https?:\/\//i.test(realUrl) ? realUrl : '';
  }

  function unwrapRedirectUrl(url) {
    const isRedirectHost = (host) => {
      host = String(host || '').replace(/\.$/, '');
      return (
      /(?:^|\.)bing\.(?:com|[a-z]{2,3}(?:\.[a-z]{2})?)$/i.test(host) ||
      /(?:^|\.)scholar\.google\.(?:[a-z]{2,3}(?:\.[a-z]{2})?|[a-z]{4,})$/i.test(host) ||
      /(?:^|\.)google\.(?:[a-z]{2,3}(?:\.[a-z]{2})?|[a-z]{4,})$/i.test(host) ||
      /(?:^|\.)(?:duckduckgo\.com|ddg\.gg)$/i.test(host) ||
      /(?:^|\.)(?:[a-z]{2,6}\.)?(?:r\.)?search\.yahoo\.(?:com|[a-z]{2,3}(?:\.[a-z]{2})?)$/i.test(host) ||
      /(?:^|\.)(?:search|rd|rds|rdsig|ard)\.yahoo\.co\.jp$/i.test(host) ||
      /(?:^|\.)(?:so\.com|sogou\.com|toutiao\.com)$/i.test(host)
      );
    };
    const seen = new Set();
    for (let depth = 0; depth < 5 && url && !seen.has(url); depth++) {
      seen.add(url); let next = '';
      try {
        const urlObj = new URL(url); const host = urlObj.hostname.replace(/\.$/, ''); const path = urlObj.pathname;
        if (/(?:^|\.)bing\.(?:com|[a-z]{2,3}(?:\.[a-z]{2})?)$/i.test(host) && path.startsWith('/ck/a')) {
          const uParam = urlObj.searchParams.get('u'); next = decodeBingCkTarget(uParam); if (!next && uParam) next = decodeRedirectTarget(uParam);
        } else if (/(?:^|\.)scholar\.google\.(?:[a-z]{2,3}(?:\.[a-z]{2})?|[a-z]{4,})$/i.test(host) && /\/scholar_url\/?$/i.test(path)) {
          next = decodeRedirectTarget(urlObj.searchParams.get('url'));
        } else if (/(?:^|\.)google\.(?:[a-z]{2,3}(?:\.[a-z]{2})?|[a-z]{4,})$/i.test(host) && /^\/url\/?$/i.test(path)) {
          next = decodeRedirectTarget(urlObj.searchParams.get('q') || urlObj.searchParams.get('url'));
        } else if (/(?:^|\.)(?:duckduckgo\.com|ddg\.gg)$/i.test(host) && /^\/l\/?$/i.test(path)) {
          next = decodeRedirectTarget(urlObj.searchParams.get('uddg'));
        } else if (/(?:^|\.)(?:[a-z]{2,6}\.)?(?:r\.)?search\.yahoo\.(?:com|[a-z]{2,3}(?:\.[a-z]{2})?)$/i.test(host) || /(?:^|\.)(?:search|rd|rds|rdsig|ard)\.yahoo\.co\.jp$/i.test(host)) {
          if (/ru=/i.test(path)) {
            const ruMatch = path.match(/(?:^|\/)RU=([\s\S]*?)(?=(?:\/(?:rk|rs|rv|ro|re|rh|rt|_ylt|_ylu)=|\/$|$))/i); if (ruMatch && ruMatch[1]) next = decodeRedirectTarget(ruMatch[1]);
          }
          if (!next && url.includes('/*')) {
            const starMatch = url.match(/\/\*+-?(https?(?::|%3A)[\s\S]*)$/i); if (starMatch && starMatch[1]) next = decodeRedirectTarget(starMatch[1]);
          }
          if (!next) {
            const tryParam = (p) => { const v = urlObj.searchParams.get(p); if (v) next = decodeRedirectTarget(v); return !!next; };
            if (!tryParam('ru') && /^\/(?:r|rd)(?:\/|$)|ru=/i.test(path)) {
              for (const p of ['u', 'url', 'target', 'dest', 'dst', 'r']) { if (tryParam(p)) break; }
            }
          }
        } else if (/(?:^|\.)toutiao\.com$/i.test(host) && /^\/search\/jump\/?$/i.test(path)) {
          next = decodeRedirectTarget(urlObj.searchParams.get('url'));
          if (next) {
            try {
              const inner = new URL(next); const h5 = /(?:^|\.)toutiao\.com$/i.test(inner.hostname) ? inner.searchParams.get('h5_url') : ''; if (h5) next = decodeRedirectTarget(h5) || next;
            } catch (_) {}
          }
        } else if (/(?:^|\.)so\.com$/i.test(host) && /^\/jump\/?$/i.test(path)) {
          next = decodeRedirectTarget(urlObj.searchParams.get('u'));
        } else if (/(?:^|\.)(?:so\.com|sogou\.com)$/i.test(host) && /(?:\/tc\b|\/jump\b|\/link\b)/i.test(path)) {
          next = decodeRedirectTarget(urlObj.searchParams.get('url'));
        }
      } catch (_) {}
      if (!next || next === url) return url; let nextHost = '';
      try { nextHost = new URL(next).hostname; } catch (_) { return next; }
      if (!isRedirectHost(nextHost)) return next; url = next;
    }
    return url;
  }

  function getCleanUrl(link) {
    if (!link || !link.href) return '';
    let attr = '';
    if (typeof link.getAttribute === 'function') {
      attr = link.getAttribute('data-mdurl') || link.getAttribute('data-url') || link.getAttribute('linkurl') || '';
      if (!attr) {
        try {
          const box = typeof link.closest === 'function' ? link.closest('.res-list, .vrwrap') : null;
          const el = box && typeof box.querySelector === 'function' ? box.querySelector('[data-mdurl], [data-url]') : null;
          if (el && typeof el.getAttribute === 'function') attr = el.getAttribute('data-mdurl') || el.getAttribute('data-url') || '';
        } catch (_) {}
      }
    }
    if (attr) attr = /^\/\/\S/.test(String(attr)) ? 'https:' + String(attr) : String(attr);
    if (/^https?:\/\/\S+$/i.test(attr) && attr !== link.href) return unwrapRedirectUrl(attr);
    return unwrapRedirectUrl(link.href);
  }

  function resolveUrlDomain(link) {
    const rawHref = (link && link.href) || '';
    const keepRaw = currentConfig.removeRedirects === false;
    let rawUrl = keepRaw ? rawHref : getCleanUrl(link);
    if (keepRaw && rawHref && typeof isEngineSelfDomain === 'function') {
      try {
        const rawHost = toASCIIHostname(new URL(toASCIIUrl(rawHref)).hostname).toLowerCase();
        if (rawHost && isEngineSelfDomain(rawHost)) {
          const cleaned = toASCIIUrl(getCleanUrl(link)) || rawHref;
          const cleanedHost = toASCIIHostname(new URL(cleaned).hostname).toLowerCase();
          if (cleanedHost && !isEngineSelfDomain(cleanedHost)) rawUrl = cleaned;
        }
      } catch (_) {}
    }
    let url = toASCIIUrl(rawUrl) || rawUrl; let domain = '';
    try {
      domain = toASCIIHostname(new URL(url).hostname);
    } catch (e) {}
    return { url, domain };
  }

  function peekResultUrl(result) {
    try {
      const engine = getSearchEngine(); const link = getResultLink(result, engine); if (!link || !link.href) return ''; return resolveUrlDomain(link).url || '';
    } catch (e) {
      return '';
    }
  }

  function buildContentSignature(url, title, snippet) {
    return `${url || ''}\u0000${title || ''}\u0000${snippet || ''}`;
  }

  function getResultContentSignature(container) {
    try {
      const engine = getSearchEngine(); const link = getResultLink(container, engine); const url = link && link.href ? (resolveUrlDomain(link).url || '') : '';
      return buildContentSignature(url, getResultTitle(container, engine), getResultSnippet(container, engine));
    } catch (e) {
      return null;
    }
  }

  function getResultText(result, selectors) {
    if (!Array.isArray(selectors)) return '';
    for (let selector of selectors) {
      let elem = null;
      try {
        elem = result.querySelector(selector);
      } catch (e) { continue; }
      const text = elem ? elem.textContent.trim() : ''; if (text) return text;
    }
    return '';
  }

  function getResultSnippet(result, engine) {
    const selectors = (getSelectors()[engine] || SELECTORS.other).snippets; const snippet = getResultText(result, selectors); if (snippet) return snippet;
    for (const element of getResultExtraElements(result, engine)) {
      let matchedSelf = false;
      for (const selector of selectors) {
        try {
          if (element.matches(selector)) { matchedSelf = true; break; }
        } catch (e) { }
      }
      const text = matchedSelf ? element.textContent.trim() : getResultText(element, selectors); if (text) return text;
    }
    return '';
  }

  function getResultExtraElements(result, engine = getSearchEngine()) {
    const selectors = (getSelectors()[engine] || SELECTORS.other).extraElements; const parent = result.parentElement; if (!parent || !Array.isArray(selectors) || !selectors.length) return [];
    const index = Array.prototype.indexOf.call(parent.children, result) + 1; const elements = new Set();
    for (const selector of selectors) {
      if (typeof selector !== 'string' || !selector.trim() || selector.includes(',')) continue;
      try {
        for (const element of parent.querySelectorAll(':scope > :nth-child(' + index + ') ' + selector)) {
          if (element !== result && !element.contains(result)) elements.add(element);
        }
      } catch (e) {}
    }
    return [...elements];
  }

  const map_resultExtraElements = new WeakMap();
  function setResultExtraElementsVisible(result, visible) {
    let rows = map_resultExtraElements.get(result);
    if (!rows) {
      rows = new Map(getResultExtraElements(result).map(row => [row, row.style.display])); if (!rows.size) return; map_resultExtraElements.set(result, rows);
    }
    rows.forEach((display, row) => { row.style.display = visible ? display : 'none'; });
  }

  function restoreResultExtraElements(result) {
    if (result) {
      const rows = map_resultExtraElements.get(result);
      if (rows) {
        rows.forEach((display, row) => { row.style.display = display; }); map_resultExtraElements.delete(result);
      }
    }
  }

  function restoreResultCollapse(result) {
    if (!result || typeof result.querySelectorAll !== 'function') return;
    result.querySelectorAll('.serh-collapse-hide').forEach(el => el.classList.remove('serh-collapse-hide'));
  }

  function applyResultCollapse(result, engine) {
    restoreResultCollapse(result);
    const titleEl = getResultTitleElement(result, engine);
    if (!titleEl || (result.contains && !result.contains(titleEl))) {
      if (result && result.style) result.style.display = 'none'; return;
    }
    let node = titleEl;
    while (node && node !== result) {
      const parent = node.parentElement; if (!parent) break;
      for (const child of parent.children) {
        if (child !== node && !child.contains(titleEl)) child.classList.add('serh-collapse-hide');
      }
      node = parent;
    }
  }

  function getResultLink(result, engine) {
    if (isBingImagesPage(engine)) {
      const iusc = result.querySelector('a.iusc'); if (!iusc) return null;
      let murl = '';
      try { const m = JSON.parse(iusc.getAttribute('m') || '{}'); murl = m.purl || m.murl || ''; } catch (_) {}
      return murl ? { href: murl, getAttribute: a => iusc.getAttribute(a), setAttribute: (a, v) => iusc.setAttribute(a, v) } : iusc;
    }
    if (engine === 'google' && getSearchCategory() === 'images') {
      const card = result.querySelector('[data-lpage]');
      if (card && /^https?:\/\//i.test(card.getAttribute('data-lpage') || '')) {
        const lp = card.getAttribute('data-lpage');
        return { href: lp, getAttribute: a => card.getAttribute(a), setAttribute: (a, v) => card.setAttribute(a, v) };
      }
      const imgres = result.querySelector('a[href*="/imgres"]');
      if (imgres) { try { const iu = new URL(imgres.href, location.origin).searchParams.get('imgurl'); if (iu) return { href: iu, getAttribute: a => imgres.getAttribute(a), setAttribute: (a, v) => imgres.setAttribute(a, v) }; } catch (_) {} }
    }
    if (engine === 'yandex' && getSearchCategory() === 'images') {
      const a = result.querySelector('a[href*="img_url="]');
      if (a) { try { const u = new URL(a.href, location.origin).searchParams.get('img_url'); if (u && /^https?:\/\//i.test(u)) return { href: u, getAttribute: x => a.getAttribute(x), setAttribute: (x, v) => a.setAttribute(x, v) }; } catch (_) {} }
    }
    if (engine === 'brave' && getSearchCategory() === 'images') {
      const img = result.querySelector('img[src*="imgs.search.brave.com"]');
      if (img) {
        const segs = (img.getAttribute('src') || '').split('?')[0].split('/');
        for (let i = 1; i < segs.length; i++) {
          let b64 = segs.slice(i).join('').replace(/-/g, '+').replace(/_/g, '/'); if (b64.length % 4) b64 += '='.repeat(4 - b64.length % 4);
          try { const u = atob(b64); if (/^https?:\/\//i.test(u)) return { href: u, getAttribute: x => img.getAttribute(x), setAttribute: (x, v) => img.setAttribute(x, v) }; } catch (_) {}
        }
      }
    }
    const linkSelectors = (getSelectors()[engine] || SELECTORS.other).links; let foundEl = null;
    if (Array.isArray(linkSelectors)) {
      for (let selector of linkSelectors) {
        try {
          const el = result.querySelector(selector);
          if (el && el.href) {
            foundEl = el; break;
          }
        } catch (_) {}
      }
    } else if (typeof linkSelectors === 'string') {
      try {
        const el = result.querySelector(linkSelectors); if (el && el.href) foundEl = el;
      } catch (_) {}
    }
    if (engine === 'bing' && foundEl && foundEl.href) {
      try {
        const u = new URL(foundEl.href);
        if (/(?:^|\.)bing\.(?:com|[a-z]{2,3}(?:\.[a-z]{2})?)$/i.test(u.hostname) && u.pathname.startsWith('/ck/a')) {
          const unwrapTest = unwrapRedirectUrl(foundEl.href);
          if (!unwrapTest || unwrapTest === foundEl.href) {
            const attrEl = result.querySelector('.b_attribution, .b_algoheader cite, cite');
            if (attrEl && attrEl.textContent) {
              const citeText = attrEl.textContent.trim();
              const domainMatch = citeText.match(/^https?:\/\/([^/\s]+)/i) ||
                citeText.match(/^(?:[\p{L}\p{N}][\p{L}\p{N}_-]*\.)+\p{L}{2,}/u);
               if (domainMatch) {
                 if (domainMatch[0].startsWith('http')) {
                   try {
                     const citedUrl = new URL(domainMatch[0]);
                     if (!/(?:^|\.)bing\.(?:com|[a-z]{2,3}(?:\.[a-z]{2})?)$/i.test(citedUrl.hostname)) {
                       return { href: citedUrl.href, getAttribute: (attr) => foundEl.getAttribute(attr), setAttribute: (attr, val) => foundEl.setAttribute(attr, val) };
                     }
                   } catch (_) {}
                 }
                 const candidateDomain = domainMatch[1] || domainMatch[0];
                if (!/(?:^|\.)bing\.(?:com|[a-z]{2,3}(?:\.[a-z]{2})?)$/i.test(candidateDomain) &&
                    !candidateDomain.includes('..') && candidateDomain.includes('.')) {
                  try {
                    const fallbackUrl = new URL(`https://${toASCIIHostname(candidateDomain)}/`).href;
                    return {
                      href: fallbackUrl,
                      getAttribute: (attr) => foundEl.getAttribute(attr),
                      setAttribute: (attr, val) => foundEl.setAttribute(attr, val)
                    };
                  } catch (_) {}
                }
              }
            }
          }
        }
      } catch (_) {}
    }
    return foundEl;
  }

  function getResultTitle(result, engine) {
    if (isBingImagesPage(engine)) {
      const iusc = result.querySelector('a.iusc');
      if (iusc) { try { const t = JSON.parse(iusc.getAttribute('m') || '{}').t; if (t) return String(t); } catch (_) {} }
    }
    const title = getResultText(result, (getSelectors()[engine] || SELECTORS.other).titles);
    if (!title && engine === 'google' && getSearchCategory() === 'images') {
      const card = result.querySelector('[data-lpage]');
      const txt = card ? (card.getAttribute('aria-label') || card.textContent || '').trim() : '';
      if (txt) return txt.slice(0, 200);
    }
    if (!title && (engine === 'duckduckgo' || engine === 'yandex') && getSearchCategory() === 'images') {
      const img = result.querySelector('img[alt]');
      if (img && img.alt) return img.alt.trim();
    }
    if (!title && engine === 'brave' && getSearchCategory() === 'images') {
      const el = result.querySelector('.image-metadata-title') || result;
      const txt = (el.textContent || '').trim();
      if (txt) return txt.slice(0, 200);
    }
    return title;
  }

  function getResultTitleElement(result, engine) {
    const selectors = (getSelectors()[engine] || SELECTORS.other).titles;
    if (!Array.isArray(selectors)) return null;
    for (let selector of selectors) {
      let elem = null;
      try {
        elem = result.querySelector(selector);
      } catch (e) { continue; }
      if (elem && elem.textContent && elem.textContent.trim()) return elem;
    }
    return null;
  }

  function ensurePositioned(el) {
    if (window.getComputedStyle(el).position === 'static') el.style.position = 'relative';
  }

  const COMMON_HOST_PREFIXES = new Set(['www', 'm', 'mobile', 'wap', 'touch', 'www2', 'www3', 'www4', 'www5', 'www6', 'www7', 'www8', 'www9']);
  const PUBLIC_SUFFIX_2LD = new Set('uk:co,org,me,ac,gov,sch jp:co,ne,or,ac,go kr:co,ne,or,ac,go cn:com,net,org,gov,edu,ac tw:com,org,edu,gov,net hk:com,org,edu,gov,net mo:com,net,org,gov au:com,net,org,edu,gov,id,asn nz:co,net,org,govt,ac pl:com,net,org,gov,edu br:com,net,org,gov,edu mx:com,org,net,gob,edu ar:com,net,org,gob,edu co:com,org,net,edu,gov za:co,org,net,gov,ac eg:com,org,net,gov,edu sa:com,net,org,gov,edu ua:com,net,org,gov,edu id:co,or,ac,go,net es:com,org,gob,edu it:gov,edu in:co,net,org,gov,edu,ac il:co,org,net,ac,gov sg:com,net,org,gov,edu my:com,net,org,gov,edu ph:com,net,org,gov,edu vn:com,net,org,gov,edu th:co,in,or,ac,go,net tr:com,net,org,gov,edu'.split(' ').flatMap(g => { const p = g.split(':'); return p[1].split(',').map(s => s + '.' + p[0]); }));
  function isPublicSuffixBase(host) {
    const labels = String(host || '').toLowerCase().replace(/\.+$/, '').split('.').filter(Boolean); if (labels.length <= 1) return true; if (labels.length !== 2) return false;
    return PUBLIC_SUFFIX_2LD.has(labels[0] + '.' + labels[1]);
  }

  function buildBlockRuleOptions(domain) {
    const d = String(domain || ''); const ipParts = d.split('.');
    const isIP = ipParts.length === 4 && ipParts.every(p => {
      const n = parseInt(p, 10); return n >= 0 && n <= 255 && String(n) === p;
    });
    let baseDomain = d; let suffixLike = false;
    if (!isIP) {
      for (;;) {
        const dot = baseDomain.indexOf('.'); if (dot <= 0) break; if (!COMMON_HOST_PREFIXES.has(baseDomain.slice(0, dot).toLowerCase())) break; const rest = baseDomain.slice(dot + 1);
        if (isPublicSuffixBase(rest)) { suffixLike = true; break; }
        baseDomain = rest;
      }
    }
    const tldWide = !isIP && !baseDomain.includes('.');
    const exactRule = `*://${d}/*`;
    const domainRule = isIP ? exactRule : `*://*.${baseDomain}/*`;
    const whitelistRule = `@${exactRule}`;
    return { isIP, tldWide, domainRule, exactRule, whitelistRule, suffixLike };
  }

  function applyBlockRule(newRule) {
    adoptStoredConfigBeforeWrite(); const cleanRule = stripRuleComment(newRule.trim());
    if (!currentConfig.rules.some(rule => stripRuleComment(rule.trim()) === cleanRule)) {
      currentConfig.rules.push(newRule); persistConfig(true); appendRuleToTextarea(newRule);
    }
    forceReprocessAll();
  }

  let _blockConfirmOutsideHandler = null;
  function showBlockConfirmPanel(anchor, domain, onConfirm, customOptions = null) {
    injectWidgetStyles();
    if (_blockConfirmOutsideHandler) {
      document.removeEventListener('click', _blockConfirmOutsideHandler, true); _blockConfirmOutsideHandler = null;
    }
    const existing = document.getElementById('serh-block-confirm-dialog'); if (existing) existing.remove();

    const opts = buildBlockRuleOptions(domain);
    const options = customOptions || (opts.isIP
      ? [
          { label: t('bcExact'), rule: opts.exactRule },
          { label: t('bcWhitelist'), rule: opts.whitelistRule }
        ]
          : currentConfig.blockDomain
            ? [
                { label: t('bcDomain'), rule: opts.domainRule },
                { label: t('bcExact'), rule: opts.exactRule },
                { label: t('bcWhitelist'), rule: opts.whitelistRule }
              ]
            : [
                { label: t('bcExact'), rule: opts.exactRule },
                { label: t('bcDomain'), rule: opts.domainRule },
                { label: t('bcWhitelist'), rule: opts.whitelistRule }
              ]);
    const firstEnabledIdx = options.findIndex(o => !o.disabled);

    const panel = document.createElement('div'); panel.id = 'serh-block-confirm-dialog';
    panel.innerHTML = `
      <div class="sfb-confirm-domain">${escHtml(domain)}</div>
      ${options.map((o, i) => `
        <label class="sfb-confirm-option${o.disabled ? ' sfb-confirm-option-disabled' : ''}">
          <input type="radio" name="sfb-confirm-rule" value="${i}" ${o.disabled ? 'disabled' : ''} ${i === firstEnabledIdx ? 'checked' : ''}>
          <span class="sfb-confirm-label">${escHtml(o.label)}</span>
          <input type="text" class="sfb-confirm-rule" data-idx="${i}" value="${escHtml(o.rule)}" spellcheck="false" ${o.disabled ? 'disabled' : ''}>
        </label>`).join('')}
      <div class="sfb-confirm-btns">
        <button id="sfb-confirm-ok" class="serh-button serh-button-primary">${t('bcConfirm')}</button>
        <button id="sfb-confirm-cancel" class="serh-button serh-button-secondary">${t('cancel')}</button>
      </div>`;
    document.body.appendChild(panel);

    const rect = anchor.getBoundingClientRect(); const pw = panel.offsetWidth; const ph = panel.offsetHeight; let left = Math.min(Math.max(8, rect.right - pw), window.innerWidth - pw - 8);
    if (left < 8) left = 8; let top = rect.bottom + 6; if (top + ph > window.innerHeight - 8) top = Math.max(8, rect.top - ph - 6); panel.style.left = left + 'px'; panel.style.top = top + 'px';
    const close = () => {
      if (_blockConfirmOutsideHandler) {
        document.removeEventListener('click', _blockConfirmOutsideHandler, true); _blockConfirmOutsideHandler = null;
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
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault(); e.stopPropagation(); const okBtn = panel.querySelector('#sfb-confirm-ok'); if (okBtn) okBtn.click();
        }
      });
    });

    panel.querySelector('#sfb-confirm-cancel').onclick = (e) => {
      e.stopPropagation(); close();
    };
    panel.querySelector('#sfb-confirm-ok').onclick = (e) => {
      e.stopPropagation(); const checked = panel.querySelector('input[type="radio"]:checked'); const idx = checked ? parseInt(checked.value, 10) : 0;
      const ruleInput = panel.querySelector(`.sfb-confirm-rule[data-idx="${idx}"]`);
      const rule = (ruleInput ? ruleInput.value : '').trim();
      if (!rule) { close(); return; }
      if (!validateRule(rule)) {
        showToast(t('invalidRule'), 'error'); return;
      }
      const selectedOption = options[idx];
      if (selectedOption && selectedOption.disabled) { close(); return; }
      close(); onConfirm(rule, selectedOption);
    };
  }

  function isEngineSelfDomain(targetDomain) {
    const currentHost = String(window.location.hostname || '').toLowerCase();
    const target = String(targetDomain || '').toLowerCase();
    if (!target || !currentHost) return false;
    if (target === currentHost || target.endsWith('.' + currentHost)) return true;
    let engineMatch = null;
    try {
      const def = getSelectors()[getSearchEngine()];
      const m = def && def.match;
      if (m instanceof RegExp) engineMatch = m;
      else if (typeof m === 'string' && m) { try { engineMatch = new RegExp(m); } catch (_) {} }
    } catch (_) {}
    if (engineMatch && engineMatch.test(target)) return true;
    if (!currentHost.endsWith('.' + target)) return false;
    return !engineMatch;
  }

  function injectBlockButton(result, engine, domain) {
    if (!domain || getSearchCategory() === 'images') return; if (result.closest('header, [role="navigation"], [role="tablist"], [role="search"], g-scrolling-carousel, #hdtb, #appbar, #searchform, #top_nav')) return;
    if (engine === 'google') {
      if (result.classList.contains('isv-r') || result.querySelector('g-img')) {
        if (!result.querySelector('h3')) return;
      }
      if (!result.closest('#center_col')) return;
    }
    if (engine === 'yandex') {
      if (!result.closest('.main__content, .content, [class*="z6OLDwO9"]')) return;
    }
    if (result.querySelector('.serh-quick-block')) return;

    const isBlocked = result.getAttribute('data-is-blocked') === 'true'; const btn = document.createElement('div'); btn.className = 'serh-quick-block';
    const iconColor = isBlocked ? '#3182ce' : 'currentColor';
    btn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="${iconColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>`;

    ensurePositioned(result);
    if (engine === 'bing' || engine === 'yandex' || engine === 'brave' || engine === 'yahoo') {
      btn.style.right = '5px'; btn.style.top = '10px';
    } else {
      btn.style.right = '35px'; btn.style.top = '10px';
    }

    const stopNavEvents = (e) => {
      e.preventDefault(); e.stopPropagation();
    };
    btn.addEventListener('mousedown', stopNavEvents, true); btn.addEventListener('pointerdown', stopNavEvents, true); btn.addEventListener('auxclick', stopNavEvents, true);

    btn.onclick = (e) => {
      e.preventDefault(); e.stopPropagation();

      if (!isBlocked) {
        const targetDomain = String(domain || '').toLowerCase();
        if (isEngineSelfDomain(targetDomain)) {
          showToast(t('cannotBlockCurrentSite', { domain: targetDomain }), 'error'); return;
        }
      }

      if (isBlocked) {
        const opts = buildBlockRuleOptions(domain); const whitelistRule = '@' + (currentConfig.blockDomain ? opts.domainRule : opts.exactRule);
        const matchedRule = (result.dataset.matchedRule || '').trim();
        const deleteLocalRule = (rule) => {
          adoptStoredConfigBeforeWrite(); const cleanTarget = stripRuleComment(rule.trim()); currentConfig.rules = currentConfig.rules.filter(r => stripRuleComment(r.trim()) !== cleanTarget);
          persistConfig(true); removeRulesFromTextarea([rule]); forceReprocessAll();
        };

        if (currentConfig.blockConfirm || !matchedRule) {
          const unblockOptions = [];
          if (matchedRule) {
            unblockOptions.push({ label: t('bcDelete'), rule: matchedRule, action: 'delete' });
          }
          unblockOptions.push({ label: t('bcWhitelist'), rule: whitelistRule, action: 'whitelist' });

          showBlockConfirmPanel(btn, domain, (chosenRule, selectedOption) => {
            const action = (selectedOption && selectedOption.action) || 'whitelist';
            if (action === 'delete') {
              deleteLocalRule(chosenRule); return;
            }
            adoptStoredConfigBeforeWrite();
            if (!currentConfig.rules.some(rule => stripRuleComment(rule.trim()) === chosenRule)) {
              currentConfig.rules.push(chosenRule);
            }
            persistConfig(true); appendRuleToTextarea(chosenRule); forceReprocessAll();
          }, unblockOptions);
          return;
        }

        deleteLocalRule(matchedRule); return;
      }

      const opts = buildBlockRuleOptions(domain);
      if (currentConfig.blockConfirm || (currentConfig.blockDomain && opts.tldWide)) {
        const panelOptions = opts.tldWide
          ? [
              { label: t('bcExact'), rule: opts.exactRule },
              { label: t('bcDomain'), rule: opts.domainRule },
              { label: t('bcWhitelist'), rule: opts.whitelistRule }
            ]
          : null; showBlockConfirmPanel(btn, domain, (chosenRule) => applyBlockRule(chosenRule), panelOptions); return;
      }
      applyBlockRule(currentConfig.blockDomain ? opts.domainRule : opts.exactRule);
    };
    result.appendChild(btn);
  }

  function removeMatchedRuleLabel(result) {
    const label = result.querySelector('.serh-matched-rule'); if (label) label.remove();
  }

  function clearMatchedData(result) {
    result.removeAttribute('data-matched-rule'); result.removeAttribute('data-matched-source');
    result.removeAttribute('data-whitelist-rule'); result.removeAttribute('data-whitelist-source');
  }

  function saveOriginalDisplay(el) {
    if (!el || el.hasAttribute('data-serh-orig-display')) return; el.setAttribute('data-serh-orig-display', el.style.display || '');
  }

  function restoreOriginalDisplay(el) {
    if (!el) return; const orig = el.getAttribute('data-serh-orig-display'); el.style.display = orig !== null ? orig : '';
  }

  function googleResultBlocks(parent) {
    if (!parent || typeof parent.querySelectorAll !== 'function') return [];
    return Array.from(parent.querySelectorAll('div.g, div.tF2Cxc, div.MjjYud'));
  }

  function visibleUnblocked(el) {
    return el.style.display !== 'none' && el.getAttribute('data-is-blocked') !== 'true';
  }

  function blockedShown() {
    return showHiddenResults || currentConfig.collapseMode === true;
  }

  function hideParentIfNoVisibleSiblings(parent, children, attr) {
    const hasVisible = Array.from(children).some(visibleUnblocked);
    if (!hasVisible) {
      saveOriginalDisplay(parent); parent.style.display = blockedShown() ? (parent.getAttribute('data-serh-orig-display') || '') : 'none'; parent.setAttribute(attr, 'true');
    }
  }

  function resetResultStyles(result) {
    restoreResultExtraElements(result); restoreResultCollapse(result); _hrefUrlCache.delete(result); _resultContentCache.delete(result); _resultRetryCounts.delete(result); result.removeAttribute('data-blocker-processed');
    result.removeAttribute('data-is-blocked'); result.removeAttribute('data-is-highlighted'); result.removeAttribute('data-highlight-n'); result.removeAttribute('data-highlight-rule'); result.removeAttribute('data-highlight-source'); clearMatchedData(result);
    result.classList.remove('serh-blocked-visible'); result.classList.remove('serh-blocked-collapsed'); result.style.outline = ''; result.style.outlineOffset = ''; const origDisplay = result.getAttribute('data-serh-orig-display');
    if (origDisplay !== null) { result.style.display = origDisplay; result.removeAttribute('data-serh-orig-display'); }
    if (result.parentElement && result.parentElement.dataset.blockerYandexParent) {
      const parent = result.parentElement;
      const stillHasBlockedHidden = Array.from(parent.children).some(el =>
        el !== result && el.getAttribute('data-is-blocked') === 'true' && el.style.display === 'none');
      const parentOrig = parent.getAttribute('data-serh-orig-display');
      if (stillHasBlockedHidden) {
        parent.style.display = 'none';
      } else {
        parent.style.display = parentOrig !== null ? parentOrig : ''; parent.removeAttribute('data-blocker-yandex-parent'); parent.removeAttribute('data-serh-orig-display');
      }
    }
    const gridItem = result.closest ? result.closest('[data-serh-grid-item-hidden]') : null;
    if (gridItem) { gridItem.style.display = ''; gridItem.removeAttribute('data-serh-grid-item-hidden'); }
    const googleParent = result.closest ? result.closest('[data-blocker-google-parent]') : null;
    if (googleParent) {
      const stillHasBlockedHidden = googleResultBlocks(googleParent).some(el =>
        el !== result && el.getAttribute('data-is-blocked') === 'true' && el.style.display === 'none');
      const parentOrig = googleParent.getAttribute('data-serh-orig-display');
      if (stillHasBlockedHidden) {
        googleParent.style.display = 'none';
      } else if (googleParent.getAttribute('data-is-blocked') !== 'true') {
        googleParent.style.display = parentOrig !== null ? parentOrig : ''; googleParent.removeAttribute('data-blocker-google-parent'); googleParent.removeAttribute('data-serh-orig-display');
      }
    }
    removeMatchedRuleLabel(result); if (!result.querySelector('.serh-quick-block')) result.style.position = '';
  }

  function restoreParentDisplay(parent) {
    const orig = parent.getAttribute('data-serh-orig-display'); parent.style.display = orig !== null ? orig : ''; parent.removeAttribute('data-blocker-yandex-parent');
    parent.removeAttribute('data-blocker-google-parent'); parent.removeAttribute('data-serh-orig-display');
  }

  function restoreAllHiddenParents() {
    document.querySelectorAll('[data-blocker-yandex-parent], [data-blocker-google-parent]').forEach(restoreParentDisplay);
  }

  function reconcileHiddenParents() {
    document.querySelectorAll('[data-blocker-yandex-parent]').forEach(parent => {
      const hasVisibleUnblocked = Array.from(parent.children).some(el =>
        el.style.display !== 'none' && el.getAttribute('data-is-blocked') !== 'true');
      if (hasVisibleUnblocked && parent.getAttribute('data-is-blocked') !== 'true') restoreParentDisplay(parent);
    });
    document.querySelectorAll('[data-blocker-google-parent]').forEach(parent => {
      if (parent.getAttribute('data-is-blocked') !== 'true' && googleResultBlocks(parent).some(visibleUnblocked)) restoreParentDisplay(parent);
    });
  }

  function reprocessContainer(container) {
    try {
      if (!container || !container.isConnected) return; const staleBtn = container.querySelector('.serh-quick-block'); if (staleBtn) staleBtn.remove(); resetResultStyles(container);
      container.removeAttribute('data-observed');
      try {
        processSingleResult(container);
      } catch (e) {
        if (currentConfig.debug) {
          console.error('[屏蔽] 处理结果时出错:', container, e);
        }
      }
      if (!container.hasAttribute('data-blocker-processed')) {
        resultObserver.observe(container);
      } else {
        container.setAttribute('data-observed', 'true');
      }
      reconcileHiddenParents();
    } catch (e) {
      if (currentConfig.debug) {
        console.error('[屏蔽] 结果重处理失败:', container, e);
      }
    }
  }

  function addMatchedRuleLabel(result) {
    if (currentConfig.showMatchedSource === false || !result.dataset.matchedRule) return; removeMatchedRuleLabel(result); const label = document.createElement('div'); label.className = 'serh-matched-rule';
    const sourceText = result.dataset.matchedSource || t('matchedRule'); const ruleText = result.dataset.matchedRule;
    label.textContent = `${sourceText}: ${ruleText}`;
    ensurePositioned(result); result.appendChild(label);
  }

  function processSingleResult(result) {
    if (result.closest('.sys_algo_rs, .AlsoTry_M, [data-yga*="sugg"]')) return false;

    if (result.hasAttribute('data-blocker-processed')) {
      return result.getAttribute('data-is-blocked') === 'true';
    }

    if (!currentConfig.enabled) return false;
    const engine = getSearchEngine(); const link = getResultLink(result, engine);
    if (!link || !link.href) {
      if (currentConfig.debug) {
        console.warn('[屏蔽] 未找到链接，跳过结果:', result.tagName, result.className, result.innerHTML.substring(0, 200));
      }
      return false;
    }

    const { url, domain } = resolveUrlDomain(link); _hrefUrlCache.set(result, url);
    const title = getResultTitle(result, engine); const snippet = getResultSnippet(result, engine); _resultContentCache.set(result, buildContentSignature(url, title, snippet));
    const lowerDomain = domain.toLowerCase(); const subdomainLevels = getSubdomainLevels(domain);
    const matchResult = checkRuleMatchOptimized(url, domain, title, snippet, subdomainLevels); _resultRetryCounts.delete(result);
    const matchHL = matchResult && matchResult.highlight;
    if (matchHL) {
      const color = currentConfig.highlightColors[matchHL] || '#CE2029';
      result.style.outline = `2px solid ${color}`; result.style.outlineOffset = '-2px';
      result.setAttribute('data-is-highlighted', 'true'); result.setAttribute('data-highlight-n', matchHL);
      if (matchResult.hlRule) { result.dataset.highlightRule = matchResult.hlRule; result.dataset.highlightSource = matchResult.hlSource || ''; }
    }
    if (matchResult && matchResult.blocked) {
      _resultRetryCounts.delete(result); saveOriginalDisplay(result); if (blockedShown()) restoreOriginalDisplay(result); else result.style.display = 'none'; setResultExtraElementsVisible(result, showHiddenResults);
      result.setAttribute('data-blocker-processed', 'true'); result.setAttribute('data-is-blocked', 'true');

      if (engine === 'yandex') {
        const parent = result.parentElement; if (parent) hideParentIfNoVisibleSiblings(parent, parent.children, 'data-blocker-yandex-parent');
      }

      if (engine === 'google' && result.matches && result.matches('div.g')) {
        const parent = result.closest('div.MjjYud'); if (parent && parent !== result) hideParentIfNoVisibleSiblings(parent, googleResultBlocks(parent), 'data-blocker-google-parent');
      }
      if (engine === 'google' && getSearchCategory() === 'images' && !blockedShown()) {
        let cell = result.parentElement;
        while (cell && cell.parentElement && cell.tagName !== 'BODY') { const d = getComputedStyle(cell.parentElement).display; if (d === 'grid' || d === 'inline-grid') break; cell = cell.parentElement; }
        if (cell && cell.parentElement && cell.tagName !== 'BODY') { cell.style.display = 'none'; cell.setAttribute('data-serh-grid-item-hidden', 'true'); }
      }

      result.dataset.matchedRule = matchResult.rule || ''; result.dataset.matchedSource = matchResult.source || '';
      if (blockedShown()) {
        if (showHiddenResults) {
          result.classList.add('serh-blocked-visible');
          if (currentConfig.showBlockBtn) injectBlockButton(result, engine, domain); addMatchedRuleLabel(result);
        } else {
          result.classList.add('serh-blocked-collapsed');
          applyResultCollapse(result, engine);
        }
      }
      return true;
    }

    if (matchHL) {
      _resultRetryCounts.delete(result); saveOriginalDisplay(result); restoreOriginalDisplay(result);
      result.classList.remove('serh-blocked-visible'); result.classList.remove('serh-blocked-collapsed'); result.setAttribute('data-blocker-processed', 'true'); result.removeAttribute('data-is-blocked'); clearMatchedData(result);
      if (matchResult && matchResult.whitelisted) { result.dataset.whitelistRule = matchResult.rule || ''; result.dataset.whitelistSource = matchResult.source || ''; }
      if (currentConfig.showBlockBtn) injectBlockButton(result, engine, domain);
      return false;
    }

    _resultRetryCounts.delete(result); clearMatchedData(result);
    if (matchResult && matchResult.whitelisted) { result.dataset.whitelistRule = matchResult.rule || ''; result.dataset.whitelistSource = matchResult.source || ''; }
    result.setAttribute('data-blocker-processed', 'true'); if (currentConfig.showBlockBtn) injectBlockButton(result, engine, domain); return false;
  }

  const resultObserver = new IntersectionObserver((entries, observer) => {
    let newlyBlocked = 0;
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const result = entry.target; let blocked = false;
        try {
          blocked = processSingleResult(result);
        } catch (e) {
          if (currentConfig.debug) {
            console.error('[屏蔽] 处理结果时出错:', result, e);
          }
          scheduleResultRetry(result);
        }
        if (blocked) newlyBlocked++;
        if (result.hasAttribute('data-blocker-processed')) {
          observer.unobserve(result);
        } else {
          result.removeAttribute('data-observed'); observer.unobserve(result);
        }
      }
    });

    if (newlyBlocked > 0) {
      const totalBlocked = document.querySelectorAll('[data-is-blocked="true"]').length; updateStatus(totalBlocked);
    }
  }, {
    root: null,
    rootMargin: '1000px 0px',
    threshold: 0
  });

  function scheduleResultRetry(result) {
    const attempt = (_resultRetryCounts.get(result) || 0) + 1;
    if (attempt > RESULT_RETRY_LIMIT) {
      _resultRetryCounts.delete(result); result.removeAttribute('data-observed'); resultObserver.unobserve(result); return;
    }
    _resultRetryCounts.set(result, attempt);
    setTimeout(() => {
      if (!result.isConnected || !_engineSiteSetup) {
        _resultRetryCounts.delete(result); return;
      }
      if (result.hasAttribute('data-blocker-processed')) {
        _resultRetryCounts.delete(result); return;
      }
      result.setAttribute('data-observed', 'true'); resultObserver.observe(result);
    }, RESULT_RETRY_DELAY * attempt);
  }

  function clearStaleObserved(selector) {
    document.querySelectorAll('[data-observed]').forEach(result => {
      let stillMatches = false;
      try { stillMatches = result.matches(selector); } catch (e) { stillMatches = false; }
      if (stillMatches) return; resultObserver.unobserve(result); const quickBtn = result.querySelector('.serh-quick-block'); if (quickBtn) quickBtn.remove(); resetResultStyles(result);
      result.removeAttribute('data-observed');
    });
  }

  function syncObservedSelector(selector) {
    if (_observedSelector === selector) return; _observedSelector = selector; clearStaleObserved(selector);
  }

  function filterNestedContainers(nodes, selector) {
    const arr = Array.from(nodes || []);
    const hasOwnLink = (el) => {
      try {
        const links = el.querySelectorAll('a[href]'); const nested = selector ? Array.from(el.querySelectorAll(selector)) : [];
        for (const a of links) {
          if (!nested.some(other => other.contains(a)) &&
              !arr.some(other => other !== el && el.contains(other) && other.contains(a))) return true;
        }
      } catch (_) {}
      return false;
    };
    return arr.filter(el => {
      if (selector) {
        try {
          if (el.querySelector(selector) && !hasOwnLink(el)) return false;
        } catch (_) {}
      }
      if (arr.some(other => other !== el && el.contains(other))) {
        return hasOwnLink(el);
      }
      return true;
    });
  }

  function queryUnobserved(selector) {
    try {
      const nodes = document.querySelectorAll(`:is(${selector}):not([data-observed])`);
      return filterNestedContainers(nodes, selector);
    } catch (e) {
      try {
        const out = [];
        document.querySelectorAll(selector).forEach(el => {
          if (!el.hasAttribute('data-observed')) out.push(el);
        });
        return filterNestedContainers(out, selector);
      } catch (err) {
        return [];
      }
    }
  }

  function scanNewResults() {
    if (!currentConfig.enabled) {
      document.querySelectorAll('[data-blocker-processed], [data-observed]').forEach(result => {
        resultObserver.unobserve(result); resetResultStyles(result); result.removeAttribute('data-observed');
      });
      showHiddenResults = false; _observedSelector = ''; return;
    }

    const engine = getSearchEngine(); const selector = getContainerSelector(engine); if (!selector) return; syncObservedSelector(selector);
    if (currentConfig.debug) {
      const allMatches = document.querySelectorAll(selector);
      console.log(`[屏蔽] 引擎: ${engine}, 选择器: "${selector}", 匹配数量: ${allMatches.length}`);
      if (allMatches.length > 0) {
        console.log('[屏蔽] 第一个匹配元素:', allMatches[0]); console.log('[屏蔽] 第一个元素的 href:', allMatches[0].querySelector('a[href]')?.href);
      } else {
        console.log('[屏蔽] 选择器未匹配到任何元素'); console.log('[屏蔽] 页面中所有 li:', document.querySelectorAll('li').length); console.log('[屏蔽] 页面中所有 article:', document.querySelectorAll('article').length);
        const classes = new Set();
        document.querySelectorAll('li').forEach(li => {
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
      result.setAttribute('data-observed', 'true'); resultObserver.observe(result);
    });

    reconcileHiddenParents();
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
          unwrapRedirectUrl,
          getCleanUrl,
          resolveUrlDomain,
          getResultLink,
          forceReprocessAll
        };
      } else if (window.__SERH_DEBUG__) {
        delete window.__SERH_DEBUG__;
      }
    } catch (_) {}
  }

  function forceReprocessAll() {
    if (!isEngineSite()) return; buildRuleIndex(); exposeDebugApi();

    const engine = getSearchEngine(); const selector = getContainerSelector(engine); if (!selector) return; syncObservedSelector(selector);
    if (currentConfig.debug) {
      console.log(`[屏蔽] 引擎: ${engine}, 选择器: "${selector}"`);
      console.log(`[屏蔽] 规则数量: domains=${compiledRules.domains.size}, urls=${compiledRules.urls.length}, titles=${compiledRules.titles.length}, texts=${compiledRules.texts.length}`);
    }

    document.querySelectorAll('.serh-quick-block').forEach(btn => btn.remove()); restoreAllHiddenParents();
    const newResults = queryUnobserved(selector); newResults.forEach(r => r.setAttribute('data-observed', 'true'));
    const batchId = ++forceReprocessBatchId; let totalBlocked = 0; const allResults = document.querySelectorAll('[data-observed]'); let processIdx = 0;
    function processBatch() {
      if (batchId !== forceReprocessBatchId) return; const batchSize = 30; const end = Math.min(processIdx + batchSize, allResults.length);
      for (; processIdx < end; processIdx++) {
        const result = allResults[processIdx]; resetResultStyles(result);
        try {
          if (processSingleResult(result)) totalBlocked++;
        } catch (e) {
          if (currentConfig.debug) {
            console.error('[屏蔽] 处理结果时出错:', result, e);
          }
        }
        if (!result.hasAttribute('data-blocker-processed')) {
          result.removeAttribute('data-observed'); resultObserver.observe(result);
        }
      }
      if (processIdx < allResults.length) {
        requestAnimationFrame(processBatch);
      } else {
        if (currentConfig.debug) {
          console.log(`[屏蔽] 共屏蔽 ${totalBlocked} 个结果`);
        }
        updateStatus(totalBlocked); reconcileHiddenParents();
      }
    }
    requestAnimationFrame(processBatch);
  }

  const LAYOUT_CSS = `
        body { min-height: 101vh !important; }
        #rcnt, #rso { min-height: 60vh; }
  `;

  let widgetStylesInjected = false; let _globalStyleEl = null;
  function injectWidgetStyles() {
    if (widgetStylesInjected) return; widgetStylesInjected = true;
    GM_addStyle(`
        [id^="serh-"]:not(button),
        #serh-settings-panel * {
            text-align: left !important; letter-spacing: normal !important; word-spacing: normal !important;
            text-transform: none !important; text-indent: 0 !important; text-shadow: none !important;
            text-decoration: none !important; direction: ltr !important;
            font-style: normal !important; font-variant: normal !important;
        }

        .serh-window, .serh-window * {
            box-sizing: border-box !important;
        }
        .serh-window {
            font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
            font-size: 13px !important; background: #ffffff !important; color: #2d3748 !important;
            border: 1px solid #e2e8f0 !important; border-radius: 8px !important;
            box-shadow: 0 4px 12px rgba(0,0,0,0.08) !important; text-align: left !important; line-height: 1.5 !important;
            transition: all 0.3s ease;
        }

        #serh-settings-panel * { line-height: 1.2 !important; }
        #serh-settings-panel label,
        #serh-settings-panel span,
        #serh-settings-panel select { font-weight: 400 !important; }
        #serh-settings-panel span { font-size: inherit !important; }
        #serh-settings-panel #serh-settings-close { font-size: 12px !important; }

        [id^="serh-"] button,
        .serh-button {
            border: none !important; border-radius: 4px !important; cursor: pointer !important; box-sizing: border-box !important;
            line-height: normal !important; letter-spacing: normal !important; text-transform: none !important;
            white-space: nowrap !important; vertical-align: middle !important;
            appearance: none !important; -webkit-appearance: none !important; background-image: none !important;
            box-shadow: none !important; margin: 0 !important; outline: none !important; text-shadow: none !important;
            font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
            transition: background-color 0.2s;
        }

        [id^="serh-"] button:not(.serh-action-button),
        .serh-button:not(.serh-action-button) {
            font-size: 11px !important; padding: 4px 8px !important; height: auto !important; min-height: 0 !important;
            width: auto !important; min-width: 0 !important; max-width: none !important;
        }
        .serh-button-primary { background: #2c5282 !important; color: #ffffff !important; }
        .serh-button-primary:hover { background: #1a365d !important; color: #ffffff !important; }
        .serh-button-primary:active, .serh-button-primary:focus, .serh-button-primary:focus-visible { background: #1d375d !important; color: #ffffff !important; }

        .serh-button-secondary { background: #4a5568 !important; color: #ffffff !important; }
        .serh-button-secondary:hover { background: #2d3748 !important; color: #ffffff !important; }
        .serh-button-secondary:active, .serh-button-secondary:focus, .serh-button-secondary:focus-visible { background: #2a3240 !important; color: #ffffff !important; }

        .serh-button-success { background: #276749 !important; color: #ffffff !important; }
        .serh-button-success:hover { background: #22543d !important; color: #ffffff !important; }
        .serh-button-success:active, .serh-button-success:focus, .serh-button-success:focus-visible { background: #20503a !important; color: #ffffff !important; }

        .serh-button-danger { background: #c53030 !important; color: #ffffff !important; }
        .serh-button-danger:hover { background: #9b2c2c !important; color: #ffffff !important; }
        .serh-button-danger:active, .serh-button-danger:focus, .serh-button-danger:focus-visible { background: #8f2c2c !important; color: #ffffff !important; }

        .serh-option-row {
            display: flex; align-items: center; justify-content: space-between;
            margin-bottom: 10px; flex-wrap: wrap;
        }
        .serh-option-label {
            font-size: 12px; color: #4a5568; white-space: nowrap; margin-bottom: 4px;
        }
        .serh-compact-row {
            display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;
        }
        .serh-action-button {
            padding: 7px 12px !important; font-size: 12px !important; font-weight: 500 !important; box-sizing: border-box !important;
            height: 32px !important; min-height: 32px !important; line-height: 1 !important;
            display: inline-flex !important; align-items: center !important; justify-content: center !important;
            text-align: center !important;
        }

        .serh-rules-container {
            display: flex; border: 1px solid #e2e8f0; border-radius: 4px; background: #f8fafc;
            height: 190px; margin-bottom: 3px; position: relative; overflow: hidden;
        }

        #serh-line-numbers,
        #serh-sel-line-numbers {
            min-width: 20px; padding: 8px 4px 8px 2px !important; background: #edf2f7;
            border-right: 1px solid #e2e8f0; text-align: right !important; color: #a0aec0;
            font-family: 'Consolas', 'Monaco', 'Courier New', monospace !important;
            font-size: 11px !important; line-height: 15.4px !important; white-space: nowrap !important;
            overflow: hidden !important; user-select: none !important; flex-shrink: 0; box-sizing: border-box !important;
        }

        #serh-rules,
        #serh-sel-rules {
            flex: 1; height: 100% !important; min-height: 0 !important; max-height: none !important;
            font-size: 11px !important; padding: 8px !important; margin: 0 !important; border: none !important;
            resize: none !important; background: transparent !important; box-sizing: border-box !important;
            font-family: 'Consolas', 'Monaco', 'Courier New', monospace !important;
            line-height: 15.4px !important; white-space: pre !important;
            position: relative; z-index: 1;
            overflow-x: auto !important; overflow-y: auto !important; outline: none !important; box-shadow: none !important;
        }

        .serh-bracket-layer {
            position: absolute; top: 0; right: 0; bottom: 0; left: 0;
            z-index: 0; overflow: hidden; pointer-events: none;
        }
        .serh-bracket-mirror {
            position: absolute; top: 0; left: 0; visibility: hidden;
            white-space: pre; pointer-events: none;
            margin: 0 !important; padding: 0 !important; border: 0 !important;
            text-indent: 0 !important; text-align: left !important;
            -webkit-text-size-adjust: 100% !important; text-size-adjust: 100% !important;
        }
        .serh-bracket-hit { position: absolute; display: none; border-radius: 2px; pointer-events: none; }
        .serh-bracket-pair { background: rgba(49, 130, 206, 0.30); box-shadow: 0 0 0 1px rgba(49, 130, 206, 0.60); }
        .serh-bracket-enclosing { background: rgba(100, 116, 139, 0.16); }

        :is(#serh-rules, #serh-sel-rules)::-webkit-scrollbar { width: 6px; height: 0px; }
        :is(#serh-rules, #serh-sel-rules, #serh-stats-content)::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 3px; }
        :is(#serh-rules, #serh-sel-rules, #serh-stats-content)::-webkit-scrollbar-thumb { background: #c1c1c1; border-radius: 3px; }
        :is(#serh-rules, #serh-sel-rules, #serh-stats-content)::-webkit-scrollbar-thumb:hover { background: #a8a8a8; }

        #serh-stats-panel {
            position: absolute; top: 10px; left: 15px; right: 15px; bottom: 50px;
            background: white; border: 1px solid #e2e8f0; border-radius: 6px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.05); z-index: 10; display: none;
            flex-direction: column; overflow: hidden; box-sizing: border-box;
        }

        #serh-stats-content {
            padding: 12px; overflow-y: auto; flex: 1; scrollbar-width: thin;
        }

        #serh-stats-content::-webkit-scrollbar { width: 6px; }

        .serh-quick-block {
            position: absolute; cursor: pointer; z-index: 99; width: 24px; height: 24px;
            display: flex; align-items: center; justify-content: center;
            border-radius: 50%; background: transparent; user-select: none;
            color: #2c5282;
            transition: transform 0.2s;
        }

        .serh-quick-block:hover {
            transform: scale(1.1);
        }

        @media (prefers-color-scheme: dark) {
            body.serh-dark-on .serh-quick-block {
                color: #ffffff;
            }
        }

        #serh-block-confirm-dialog {
            position: fixed; z-index: 10002; display: flex; flex-direction: column; gap: 6px;
            width: 250px; max-width: calc(100vw - 16px); padding: 8px 10px;
            background: #ffffff; color: #2d3748; border: 1px solid #e2e8f0; border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 12px; text-align: left; line-height: 1.4; box-sizing: border-box;
        }
        #serh-block-confirm-dialog .sfb-confirm-domain { font-size: 11px; color: #718096; word-break: break-all; margin-bottom: 2px; }
        #serh-block-confirm-dialog .sfb-confirm-option {
            display: flex; align-items: center; gap: 6px; cursor: pointer; margin: 0; padding: 0;
            border: none; background: transparent; font-weight: normal; white-space: nowrap;
        }
        #serh-block-confirm-dialog .sfb-confirm-option input[type="radio"] {
            margin: 0 !important; padding: 0 !important; flex-shrink: 0 !important; accent-color: #2c5282 !important;
            cursor: pointer !important; width: auto !important; height: auto !important; min-width: 0 !important;
            appearance: auto !important; -webkit-appearance: auto !important; display: inline-block !important;
        }
        #serh-block-confirm-dialog .sfb-confirm-option-disabled { cursor: not-allowed; opacity: 0.6; }
        #serh-block-confirm-dialog .sfb-confirm-option-disabled input[type="radio"] { cursor: not-allowed !important; }
        #serh-block-confirm-dialog .sfb-confirm-option-disabled .sfb-confirm-rule { background: #edf2f7; color: #a0aec0; }

        .serh-switch input[type="checkbox"] {
            opacity: 0 !important; width: 0 !important; height: 0 !important;
            min-width: 0 !important; max-width: 0 !important; margin: 0 !important; padding: 0 !important;
            position: absolute !important; pointer-events: none !important;
            appearance: none !important; -webkit-appearance: none !important; border: none !important;
        }
        #serh-block-confirm-dialog .sfb-confirm-label { flex-shrink: 0; min-width: 36px; white-space: nowrap; font-size: 12px; }
        #serh-block-confirm-dialog .sfb-confirm-rule {
            flex: 1; min-width: 0; padding: 3px 6px; border: 1px solid #e2e8f0; border-radius: 4px;
            font-size: 11px; font-family: 'Consolas', 'Monaco', monospace; background: #f7fafc;
            color: #2d3748; outline: none; box-shadow: none; height: auto; box-sizing: border-box;
        }
        #serh-block-confirm-dialog .sfb-confirm-rule:focus { border-color: #3182ce; background: #ffffff; }
        #serh-block-confirm-dialog .sfb-confirm-btns { display: flex; gap: 6px; justify-content: flex-end; margin-top: 4px; }
        #serh-block-confirm-dialog .sfb-confirm-btns .serh-button { height: 24px; padding: 0 10px; font-size: 11px; }
        @media (prefers-color-scheme: dark) {
            body.serh-dark-on #serh-block-confirm-dialog {
                background: #171717; color: #f3f4f6; border-color: #374151;
                box-shadow: 0 4px 12px rgba(0,0,0,0.5);
            }
            body.serh-dark-on #serh-block-confirm-dialog .sfb-confirm-rule { background: #374151; border-color: #4b5563; color: #f3f4f6; }
            body.serh-dark-on #serh-block-confirm-dialog .sfb-confirm-rule:focus { border-color: #60a5fa; background: #374151; }
            body.serh-dark-on #serh-block-confirm-dialog .sfb-confirm-option-disabled .sfb-confirm-rule { background: #1f2937; color: #6b7280; }
        }

        .serh-scroll-btn {
            position: absolute; right: 7px; cursor: pointer; opacity: 0.5; font-size: 18px !important;
            line-height: 1 !important; user-select: none !important; transition: opacity 0.2s, transform 0.2s;
            background: transparent !important; border: none !important; padding: 0 !important; margin: 0 !important;
            z-index: 10;
        }

        .serh-scroll-btn:hover { opacity: 1; transform: scale(1.2); }
        .serh-quick-block:hover { transform: scale(1.1); opacity: 1; }

        :is(.isv-r, .image-section, g-img, .is-extra-container) .serh-quick-block,
        :is(header, [role="navigation"], [role="tablist"], [role="search"], g-scrolling-carousel, #hdtb, #appbar, #searchform, #top_nav, #extabar) .serh-quick-block { display: none !important; }

        #serh-selector-panel #serh-toast-container { max-width: none; width: auto; left: 0; right: 0; }

        @media (prefers-color-scheme: dark) {
            body.serh-dark-on #serh-panel .serh-option-label,
            body.serh-dark-on #serh-panel .serh-compact-row span { color: #f3f4f6 !important; }
            body.serh-dark-on :is(#serh-panel, #serh-selector-panel) .serh-rules-container { border-color: #4b5563 !important; background: #1E1F21 !important; }
            body.serh-dark-on :is(#serh-line-numbers, #serh-sel-line-numbers) { background: #222629 !important; border-right-color: #4b5563 !important; color: #9ca3af !important; }
            body.serh-dark-on :is(#serh-rules, #serh-sel-rules) { background: transparent !important; color: #f3f4f6 !important; }
            body.serh-dark-on #serh-rules::placeholder { color: #6b7280 !important; }
            body.serh-dark-on .serh-bracket-pair { background: rgba(96, 165, 250, 0.38); box-shadow: 0 0 0 1px rgba(96, 165, 250, 0.75); }
            body.serh-dark-on .serh-bracket-enclosing { background: rgba(148, 163, 184, 0.22); }
            body.serh-dark-on #serh-stats-panel { background: #171717 !important; border-color: #374151 !important; }
            body.serh-dark-on #serh-stats-content { color: #f3f4f6 !important; }
            body.serh-dark-on #serh-panel .serh-compact-row button.serh-button {
                height: auto !important; min-height: 0 !important; width: auto !important; min-width: 0 !important;
                flex: 0 0 auto !important; line-height: normal !important; padding: 3px 8px !important;
                font-size: 11px !important; margin: 0 !important;
            }
        }

        #serh-hlcolor-panel h3 {
            margin: 0 0 8px 0 !important; font-size: 14px !important; color: inherit !important;
            font-weight: 600 !important; padding: 0 !important; border: none !important;
            background: transparent !important; letter-spacing: normal !important;
        }

        #serh-hlcolor-panel h3 {
            margin: 0 0 1px 0 !important; line-height: 1.2 !important;
        }

        #serh-selector-panel h3 {
            margin: 0 !important; line-height: 1.2 !important;
        }

        #serh-hlcolor-panel .serh-button,
        :is(#serh-panel, #serh-selector-panel) .serh-action-button {
            height: 30px !important; min-height: 30px !important; max-height: 30px !important; padding: 0 12px !important;
            font-size: 13px !important; font-weight: 500 !important; box-sizing: border-box !important; margin: 0 !important;
            display: flex !important; align-items: center !important; justify-content: center !important;
            text-align: center !important; line-height: 1 !important; border: none !important; border-radius: 4px !important;
            appearance: none !important; -webkit-appearance: none !important; box-shadow: none !important;
            background-image: none !important;
        }

        @media (prefers-color-scheme: dark) {
            body.serh-dark-on .serh-window {
                background: #171717 !important; color: #f3f4f6 !important; border-color: #374151 !important;
                box-shadow: 0 4px 12px rgba(0,0,0,0.5) !important;
            }
            body.serh-dark-on #serh-settings-panel label,
            body.serh-dark-on #serh-hlcolor-panel .serh-hlcolor-row label {
                color: #9ca3af !important;
            }
            body.serh-dark-on #serh-settings-panel select,
            body.serh-dark-on #serh-hlcolor-panel .serh-hlcolor-row input {
                background: #374151 !important; border-color: #4b5563 !important; color: #f3f4f6 !important;
            }
            body.serh-dark-on #serh-hlcolor-panel .serh-hlcolor-row input:focus {
                border-color: #60a5fa !important;
            }
            body.serh-dark-on #serh-hlcolor-panel .serh-hlcolor-row .serh-hlcolor-preview,
            body.serh-dark-on #serh-hlcolor-current-preview,
            body.serh-dark-on #serh-hlcolor-sv-canvas,
            body.serh-dark-on #serh-hlcolor-hue-canvas {
                border-color: #4b5563 !important;
            }
        }

        /* 渐变动画 */
        .serh-panel-fade {
            opacity: 0;
            transform: translate(-50%, -48%);
            transition: all 0.3s ease;
            pointer-events: none;
        }
        .serh-panel-fade.show {
            opacity: 1;
            transform: translate(-50%, -50%);
            pointer-events: auto;
        }

        .serh-window:not(.serh-panel-fade) {
            transition: opacity 0.1s ease;
        }

        /* 屏蔽灰底 */
        .serh-blocked-visible,
        .g.serh-blocked-visible,
        .MjjYud.serh-blocked-visible {
            background-color: #d1d5db !important; border-radius: 8px !important; padding: 8px !important;
            transition: background 0.2s;
        }

        @media (prefers-color-scheme: dark) {
            body.serh-dark-on .serh-blocked-visible,
            body.serh-dark-on .g.serh-blocked-visible,
            body.serh-dark-on .MjjYud.serh-blocked-visible {
                background-color: #374151 !important;
            }
        }

        .serh-blocked-visible div,
        .serh-blocked-visible .yuRUbf,
        .serh-blocked-visible div[data-sokoban-container],
        .serh-blocked-visible div[data-snc] {
            background-color: transparent !important; background: transparent !important; background-image: none !important;
        }

        .serh-bubble-number {
            color: #000000 !important;
            line-height: 1 !important;
        }

        @media (prefers-color-scheme: dark) {
            body.serh-dark-on #serh-status {
                color: #a8c7fa !important;
            }
            body.serh-dark-on .serh-bubble-number {
                color: #ffffff !important;
            }
        }

        .serh-matched-rule {
            position: absolute; top: 2px; left: 50%; transform: translateX(-50%);
            max-width: calc(100% - 70px); background: rgba(0, 0, 0, 0.2); color: #000000;
            font-size: 12px; padding: 2px 8px; border-radius: 4px; white-space: nowrap;
            overflow: hidden; text-overflow: ellipsis; z-index: 98; pointer-events: none;
            font-family: monospace; backdrop-filter: blur(2px);
            box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        }
        @media (prefers-color-scheme: dark) {
            body.serh-dark-on .serh-matched-rule {
                background: rgba(0, 160, 0, 0.9);
                color: #fff;
            }
        }

        /* 高亮 */
        #serh-hlcolor-panel .serh-hlcolor-row {
            margin-bottom: 2px !important; padding: 0 !important; border: none !important;
            background: transparent !important; display: flex !important; align-items: center !important; gap: 4px !important;
            height: auto !important; min-height: 0 !important; max-height: none !important;
        }
        #serh-hlcolor-panel .serh-hlcolor-row label {
            min-width: 20px !important; font-size: 12px !important; color: #4a5568 !important;
            font-weight: 600 !important; margin: 0 !important; line-height: 1.2 !important;
            padding: 0 !important; border: none !important; background: transparent !important;
            height: auto !important; min-height: 0 !important; max-height: none !important;
            display: block !important; box-sizing: border-box !important;
        }
        #serh-hlcolor-panel .serh-hlcolor-row .serh-hlcolor-preview {
            width: 12px !important; height: 12px !important; border-radius: 2px !important;
            border: 1px solid #e2e8f0 !important; flex-shrink: 0 !important; cursor: pointer !important;
            margin: 0 !important; padding: 0 !important; box-sizing: border-box !important;
            min-height: 0 !important; max-height: none !important;
        }
        #serh-hlcolor-panel .serh-hlcolor-row input {
            width: 70px !important; flex: none !important; padding: 2px 4px !important; margin: 0 !important;
            border: 1px solid #e2e8f0 !important; border-radius: 3px !important; font-size: 11px !important;
            font-family: 'Consolas', monospace !important; background: #ffffff !important; color: #2d3748 !important;
            height: 20px !important; line-height: normal !important; box-shadow: none !important; outline: none !important;
            display: block !important; font-weight: normal !important; box-sizing: border-box !important;
            min-width: 0 !important; max-width: none !important; min-height: 0 !important; max-height: none !important;
            transform: none !important; appearance: none !important; -webkit-appearance: none !important;
        }
        #serh-hlcolor-panel .serh-hlcolor-row input:focus {
            border-color: #3182ce !important;
        }
        #serh-hlcolor-panel .serh-hlcolor-picker-wrapper {
            display: flex !important; align-items: stretch !important; margin: 0 !important;
        }
        #serh-hlcolor-sv-canvas, #serh-hlcolor-hue-canvas {
            cursor: crosshair !important; border-radius: 3px !important; border: 1px solid #e2e8f0 !important;
        }
        #serh-hlcolor-sv-dot, #serh-hlcolor-hue-dot {
            position: absolute !important; pointer-events: none !important; transform: translate(-50%, -50%) !important;
            border: 2px solid #ffffff !important; box-shadow: 0 0 3px rgba(0,0,0,0.55) !important; box-sizing: border-box !important; z-index: 2 !important;
        }
        #serh-hlcolor-sv-dot { width: 13px !important; height: 13px !important; border-radius: 50% !important; }
        #serh-hlcolor-hue-dot { width: 30px !important; height: 6px !important; border-radius: 3px !important; }
        #serh-hlcolor-current-preview {
            flex-shrink: 0 !important;
            margin: 0 !important; padding: 0 !important; box-sizing: border-box !important;
            min-height: 0 !important; max-height: none !important;
        }
        #serh-hlcolor-code-text {
            display: flex !important; align-items: center !important; justify-content: center !important;
            width: 70px !important; height: 20px !important; flex: none !important;
            margin: 0 !important; padding: 2px 4px !important; box-sizing: border-box !important;
            border: 1px solid #e2e8f0 !important; border-radius: 3px !important;
            background: #f7fafc !important; color: #2d3748 !important;
            font-size: 11px !important; font-family: 'Consolas', monospace !important; font-weight: normal !important;
            line-height: normal !important; min-height: 0 !important; max-height: none !important;
            min-width: 0 !important; overflow: hidden !important; white-space: nowrap !important;
        }

        /* 开关 */
        .serh-switch {
            position: relative !important; display: inline-block !important; width: 28px !important; height: 16px !important;
            margin: 0 6px 0 0 !important; padding: 0 !important; flex-shrink: 0 !important;
            border: none !important; box-shadow: none !important; background: transparent !important;
            min-width: 0 !important; max-width: none !important; min-height: 0 !important; max-height: none !important;
            box-sizing: border-box !important;
        }

        .serh-switch input {
            opacity: 0;
            width: 0;
            height: 0;
            position: absolute;
        }

        .serh-slider {
            position: absolute !important; cursor: pointer !important;
            top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important;
            background-color: #cbd5e0 !important; transition: .2s !important; border-radius: 16px !important;
            border: none !important; box-shadow: none !important; margin: 0 !important; padding: 0 !important;
            box-sizing: border-box !important;
        }

        .serh-slider:before {
            position: absolute !important; content: "" !important; height: 12px !important; width: 12px !important;
            left: 2px !important; bottom: 2px !important; top: auto !important; right: auto !important;
            background-color: #ffffff !important; transition: .2s !important; border-radius: 50% !important;
            border: none !important; box-shadow: none !important; margin: 0 !important; padding: 0 !important;
            box-sizing: border-box !important; transform: none !important;
        }

        .serh-switch input:checked + .serh-slider {
            background-color: #2c5282 !important;
        }

        .serh-switch input:checked + .serh-slider:before {
            transform: translateX(12px) !important;
        }

        @media (prefers-color-scheme: dark) {
            body.serh-dark-on .serh-slider {
                background-color: #4b5563 !important;
            }
            body.serh-dark-on .serh-switch input:checked + .serh-slider {
                background-color: #2c5282 !important;
            }
        }

        #serh-bubble-size-slider {
            flex: 1 1 0% !important; margin: 0 0 0 5px !important;
            height: 4px !important; min-height: 0 !important; max-height: none !important;
            width: auto !important; min-width: 0 !important; max-width: none !important;
            padding: 0 !important; border: none !important; border-radius: 2px !important;
            background: #cbd5e0 !important; outline: none !important; box-shadow: none !important;
            appearance: none !important; -webkit-appearance: none !important; -moz-appearance: none !important;
            cursor: pointer !important; transform: none !important; vertical-align: middle !important;
        }
        #serh-bubble-size-slider::-webkit-slider-thumb {
            -webkit-appearance: none !important; width: 14px !important; height: 14px !important; border-radius: 50% !important;
            background: #2c5282 !important; cursor: pointer !important; border: none !important;
        }
        #serh-bubble-size-slider::-moz-range-thumb {
            width: 14px !important; height: 14px !important; border-radius: 50% !important; background: #2c5282 !important;
            cursor: pointer !important; border: none !important;
        }

        #serh-toast-container {
            position: fixed; top: 15px; right: 15px; z-index: 2147483647; display: flex;
            flex-direction: column; align-items: stretch; gap: 8px; pointer-events: none;
            max-width: min(320px, calc(100vw - 16px));
        }

        .serh-toast {
            pointer-events: auto; box-sizing: border-box; background: #ffffff;
            border: 1px solid #e2e8f0; border-left: 3px solid #2c5282; border-radius: 6px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.12); color: #2d3748; font-size: 12px;
            line-height: 1.4; padding: 8px 12px; word-break: break-all; cursor: pointer;
            opacity: 0; transform: translateY(8px);
            transition: opacity 0.25s ease, transform 0.25s ease;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .serh-toast.show {
            opacity: 1;
            transform: translateY(0);
        }

        @media (prefers-color-scheme: dark) {
            body.serh-dark-on .serh-toast {
                background: #171717 !important; color: #f3f4f6 !important;
                border-top-color: #374151; border-right-color: #374151; border-bottom-color: #374151;
            }
        }

        .serh-toast-success { border-left-color: #276749; }
        .serh-toast-error { border-left-color: #c53030; }
        .serh-toast-info { border-left-color: #2c5282; }
    `);
  }

  function injectGlobalStyles() {
    const engine = getSearchEngine(); const applyLayout = engine !== 'other' && !!SELECTORS[engine];
    if (applyLayout) {
      if (!_globalStyleEl) {
        const el = GM_addStyle(LAYOUT_CSS); if (el && typeof el.remove === 'function') _globalStyleEl = el;
      }
    } else if (_globalStyleEl) {
      _globalStyleEl.remove(); _globalStyleEl = null;
    }
    injectWidgetStyles();
  }

  function removeGlobalStyles() {
    if (_globalStyleEl) {
      _globalStyleEl.remove(); _globalStyleEl = null;
    }
  }

  function applyBubbleStyle(element) {
    element.style.cssText = `
            position: fixed; background: transparent; color: #2c5282; border-radius: 4px;
            z-index: 10000; cursor: grab; font-weight: bold; user-select: none;
            transition: opacity 0.2s, text-shadow 0.2s, transform 0.2s; opacity: 0.8;
            font-family: Arial, sans-serif; text-align: center; box-sizing: border-box;
            display: flex; align-items: center; justify-content: center;
        `;
  }

  function getBubbleSize() {
    let size = 20;
    if (typeof currentConfig.bubbleSize === 'number') {
      size = currentConfig.bubbleSize;
    } else {
      switch (currentConfig.bubbleSize) {
        case 'medium': size = 18; break; case 'large': size = 20; break; case 'larger': size = 22; break; case 'xlarge': size = 26; break;
        default:
          const parsed = parseInt(currentConfig.bubbleSize); size = isNaN(parsed) ? 20 : parsed;
      }
    }
    return Math.max(15, Math.min(60, size));
  }

  function applyBubbleSize(element) {
    const size = getBubbleSize(); element.style.fontSize = size + 'px'; element.style.padding = '5px 5px'; element.style.lineHeight = (1 + (size - 12) * 0.015).toFixed(2);
    element.style.height = (size + 10) + 'px';
  }

  function updateBubbleContent(statusBtn, blocked) {
    const isLeft = currentConfig.bubbleState ? currentConfig.bubbleState.isLeftHalf : true; const isToggleMode = currentConfig.bubbleAction === 'toggleHidden';

    const bubbleIcon = (inner) => `<span style="display: inline-block; width: 1em; height: 1em; vertical-align: -0.15em; flex-shrink: 0; line-height: 0;"><svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg></span>`;
    const icon = isToggleMode
      ? bubbleIcon('<circle cx="12" cy="12" r="10"/>')
      : bubbleIcon('<circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>');

    let newHtml;
    if (currentConfig.showCount) {
      if (isLeft) {
        newHtml = `${icon} <span class="serh-bubble-number">${blocked}</span>`;
      } else {
        newHtml = `<span class="serh-bubble-number">${blocked}</span> ${icon}`;
      }
    } else {
      newHtml = icon;
    }
    if (statusBtn._lastHtml !== newHtml) {
      statusBtn.innerHTML = newHtml; statusBtn._lastHtml = newHtml;
    }
  }

  function updateStatus(blocked) {
    if (!isEngineSite()) return;
    function applyBubbleStatePosition(el) {
      if (!currentConfig.bubbleState) return; let top = String(currentConfig.bubbleState.top || 'auto');
      if (/^\d+(?:\.\d+)?px$/i.test(top)) {
        const h = el.offsetHeight || getBubbleSize() + 10; let maxTop = window.innerHeight - h - 5; if (maxTop < 0) maxTop = 0; top = Math.min(Math.max(5, parseFloat(top)), maxTop) + 'px';
      }
      el.style.top = top; el.style.left = currentConfig.bubbleState.left || 'auto'; el.style.right = currentConfig.bubbleState.right || 'auto'; el.style.bottom = 'auto'; el.style.transform = 'none';
    }
    if (!currentConfig.showBubble) {
      const status = document.getElementById('serh-status'); if (status) status.remove(); return;
    }

    let status = document.getElementById('serh-status');
    if (!status) {
      status = document.createElement('div'); status.id = 'serh-status'; applyBubbleStyle(status);

      let isDragging = false; let startX, startY, initialLeft, initialTop;
      let longPressTimer = null; let hasLongPressed = false;
      status.addEventListener('mousedown', startDrag);
      status.addEventListener('touchstart', startDrag, {
        passive: false
      });

      function startDrag(e) {
        if (e.type === 'touchstart') {
          e.preventDefault(); e.stopPropagation();
        }
        if (e.type === 'mousedown' && e.button !== 0) return;

        isDragging = false; hasLongPressed = false;
        if (longPressTimer) clearTimeout(longPressTimer);
        const clientX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX; const clientY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY; startX = clientX; startY = clientY;
        const rect = status.getBoundingClientRect(); initialLeft = rect.left; initialTop = rect.top; status.style.transition = 'none'; status.style.cursor = 'grabbing';
        status.style.transform = 'none'; status.style.bottom = 'auto'; status.style.right = 'auto'; status.style.top = initialTop + 'px'; status.style.left = initialLeft + 'px';
        document.addEventListener('mousemove', onDrag); document.addEventListener('mouseup', endDrag);
        document.addEventListener('touchmove', onDrag, {
          passive: false
        });
        document.addEventListener('touchend', endDrag); document.addEventListener('touchcancel', endDrag);

        if (currentConfig.bubbleAction === 'toggleHidden' || currentConfig.bubbleAction === 'openStats') {
          longPressTimer = setTimeout(() => {
            if (!isDragging) {
              hasLongPressed = true; status.style.transform = 'scale(1.15)';
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

        const clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX; const clientY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY; const dx = clientX - startX;
        const dy = clientY - startY;
        if (!isDragging && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
          isDragging = true; if (longPressTimer) clearTimeout(longPressTimer);
        }

        if (isDragging) {
          if (e.type === 'touchmove') e.preventDefault(); let newLeft = initialLeft + dx; let newTop = initialTop + dy;
          newLeft = Math.max(0, Math.min(window.innerWidth - status.offsetWidth, newLeft)); newTop = Math.max(0, Math.min(window.innerHeight - status.offsetHeight, newTop));
          status.style.left = newLeft + 'px'; status.style.top = newTop + 'px';
        }
      }

      function endDrag(e) {
        if (longPressTimer) clearTimeout(longPressTimer);

        if (e.type === 'touchend') e.preventDefault(); document.removeEventListener('mousemove', onDrag); document.removeEventListener('mouseup', endDrag);
        document.removeEventListener('touchmove', onDrag); document.removeEventListener('touchend', endDrag); document.removeEventListener('touchcancel', endDrag); status.style.cursor = 'grab';
        status.style.transition = 'opacity 0.2s, text-shadow 0.2s, transform 0.2s, left 0.3s ease, right 0.3s ease, top 0.3s ease, color 0.2s';
        if (e.type === 'touchcancel') {
          applyBubbleStatePosition(status); return;
        }

        if (isDragging) {
          const rect = status.getBoundingClientRect(); const centerX = rect.left + rect.width / 2; const isLeftHalf = centerX < window.innerWidth / 2;
          if (isLeftHalf) {
            status.style.left = '5px'; status.style.right = 'auto';
          } else {
            status.style.left = 'auto'; status.style.right = '5px';
          }
          let newTop = rect.top; if (newTop < 5) newTop = 5; if (newTop + rect.height > window.innerHeight - 5) newTop = window.innerHeight - rect.height - 5; status.style.top = newTop + 'px';
          adoptStoredConfigBeforeWrite();
          currentConfig.bubbleState = {
            top: status.style.top,
            left: status.style.left,
            right: status.style.right,
            isLeftHalf
          };
          persistConfig(false); updateBubbleContent(status, parseInt(status.dataset.blockedCount || 0));
        } else {
          applyBubbleStatePosition(status);

          if (!hasLongPressed) {
            if (currentConfig.bubbleAction === 'toggleHidden') {
              toggleHiddenResults();
            } else {
              setTimeout(() => {
                const action = resolveBubblePanelAction();
                if (action === 'closeAll') closeAllSerhPanels();
                else if (action === 'stats') showStatsPanel();
                else if (action === 'panel') showConfigPanel();
              }, 50);
            }
          }
        }
      }

      document.body.appendChild(status);
      if (currentConfig.bubbleState) {
        applyBubbleStatePosition(status);
      } else {
        status.style.top = '50%'; status.style.transform = 'translateY(-50%)'; status.style.left = '5px'; status.style.right = 'auto'; status.style.bottom = 'auto';
      }
    }

    applyBubbleSize(status); status.dataset.blockedCount = blocked; updateBubbleContent(status, blocked);
  }

  function toggleHiddenResults() {
    showHiddenResults = !showHiddenResults;
    document.querySelectorAll('[data-is-blocked="true"]').forEach(el => {
      saveOriginalDisplay(el); if (showHiddenResults) restoreOriginalDisplay(el); else el.style.display = blockedShown() ? '' : 'none'; setResultExtraElementsVisible(el, showHiddenResults);
      if (showHiddenResults) {
        el.classList.remove('serh-blocked-collapsed'); el.classList.add('serh-blocked-visible'); restoreResultCollapse(el); const engine = getSearchEngine(); const link = getResultLink(el, engine);
        if (link && link.href && currentConfig.showBlockBtn) {
          const { domain } = resolveUrlDomain(link);
          if (!el.querySelector('.serh-quick-block')) {
            injectBlockButton(el, engine, domain);
          }
        }
        addMatchedRuleLabel(el);
      } else if (currentConfig.collapseMode === true) {
        el.classList.remove('serh-blocked-visible'); el.classList.add('serh-blocked-collapsed');
        const btn = el.querySelector('.serh-quick-block'); if (btn) btn.remove();
        removeMatchedRuleLabel(el);
        applyResultCollapse(el, getSearchEngine());
      } else {
        el.classList.remove('serh-blocked-visible'); el.classList.remove('serh-blocked-collapsed'); restoreResultCollapse(el); removeMatchedRuleLabel(el);
      }
    });
    if (showHiddenResults) {
      document.querySelectorAll('[data-blocker-google-parent], [data-blocker-yandex-parent], [data-serh-grid-item-hidden]').forEach(parent => {
        restoreOriginalDisplay(parent);
      });
    } else {
      document.querySelectorAll('[data-blocker-yandex-parent]').forEach(parent => {
        hideParentIfNoVisibleSiblings(parent, parent.children, 'data-blocker-yandex-parent');
      });
      document.querySelectorAll('[data-blocker-google-parent]').forEach(parent => {
        hideParentIfNoVisibleSiblings(parent, googleResultBlocks(parent), 'data-blocker-google-parent');
      });
      if (!blockedShown()) document.querySelectorAll('[data-serh-grid-item-hidden]').forEach(cell => { cell.style.display = 'none'; });
    }
    const status = document.getElementById('serh-status');
    if (status) {
      updateBubbleContent(status, parseInt(status.dataset.blockedCount || 0));
    }
  }

  function adoptStoredConfigBeforeWrite() {
    adoptStoredConfigIfNewer(); if (!Array.isArray(currentConfig.rules)) currentConfig.rules = [];
  }

  function getSyncSettings(config) {
    const { rules, bubbleState, bubbleSize, selectors, subscriptions, syncedAt, rulesSyncedAt, settingsModifiedAt, selectorsSyncedAt, tombstones, ruleAddedTimes, subscriptionTombstones, ...settings } = config || {};
    const unsafeKey = (k) => k === '__proto__' || k === 'constructor' || k === 'prototype';
    const cleanVal = (v) => {
      if (!v || typeof v !== 'object' || Array.isArray(v)) return v;
      const o = {}; for (const k of Object.keys(v)) if (!unsafeKey(k)) o[k] = cleanVal(v[k]);
      return o;
    };
    const clean = {}; for (const k of Object.keys(settings)) if (!unsafeKey(k)) clean[k] = cleanVal(settings[k]);
    return clean;
  }

  function persistConfig() {
    GM_setValue(CONFIG_KEY, currentConfig);
  }

  const SETTINGS_PANEL_CHECKBOXES = {
    'serh-set-remove-redirects': 'removeRedirects',
    'serh-set-show-block-btn': 'showBlockBtn',
    'serh-set-block-domain': 'blockDomain', 'serh-set-block-confirm': 'blockConfirm',
    'serh-set-show-source': 'showMatchedSource', 'serh-set-bracket-highlight': 'bracketHighlight',
    'serh-set-show-bubble': 'showBubble', 'serh-set-show-count': 'showCount',
    'serh-set-panel-centered': 'panelCentered', 'serh-set-auto-dark': 'autoDark',
    'serh-set-disable-block': 'enabled', 'serh-set-debug': 'debug',
    'serh-set-error-detection': 'errorDetection', 'serh-set-export-config': 'exportConfig', 'serh-set-collapse-mode': 'collapseMode'
  };
  const INVERTED_SETTINGS_CHECKBOXES = new Set(['serh-set-disable-block']);

  function applyDarkModeClass() {
    if (document.body) document.body.classList.toggle('serh-dark-on', currentConfig.autoDark !== false);
  }

  let _collapseStyleEl = null;

  function buildCollapseCss() {
    const seen = new Set(); const rules = [];
    rules.push('body.serh-collapse-on .serh-blocked-collapsed .serh-collapse-hide { display: none !important; }');
    for (const def of Object.values(getSelectors())) {
      for (const sel of [...(def.snippets || []), ...(def.extraElements || [])]) {
        if (typeof sel !== 'string' || !sel.trim() || sel.includes(',') || seen.has(sel)) continue; seen.add(sel);
        rules.push(`body.serh-collapse-on .serh-blocked-collapsed ${sel} { display: none !important; }`);
      }
    }
    return rules.join('\n');
  }

  function ensureCollapseStyle() {
    const css = buildCollapseCss();
    if (_collapseStyleEl && _collapseStyleEl.isConnected) { _collapseStyleEl.textContent = css; return; }
    _collapseStyleEl = document.createElement('style'); _collapseStyleEl.setAttribute('data-serh', 'collapse');
    _collapseStyleEl.textContent = css; (document.head || document.documentElement).appendChild(_collapseStyleEl);
  }

  function applyCollapseMode() {
    if (document.body) document.body.classList.toggle('serh-collapse-on', currentConfig.collapseMode === true);
    ensureCollapseStyle();
  }

  function applyConfigToMainPanel() {
    if (!document.getElementById('serh-panel')) return;
    Object.keys(SETTINGS_PANEL_CHECKBOXES).forEach(id => {
      const el = document.getElementById(id); if (!el) return; const key = SETTINGS_PANEL_CHECKBOXES[id];
      if (id === 'serh-set-error-detection' || id === 'serh-set-bracket-highlight') {
        el.checked = currentConfig[key] !== false;
      } else if (INVERTED_SETTINGS_CHECKBOXES.has(id)) {
        el.checked = currentConfig[key] === false;
      } else {
        el.checked = currentConfig[key] === true;
      }
    });
    const bubbleActionSelect = document.getElementById('serh-set-bubble-action');
    if (bubbleActionSelect) bubbleActionSelect.value = (currentConfig.bubbleAction === 'toggleHidden' || currentConfig.bubbleAction === 'openStats') ? currentConfig.bubbleAction : 'openPanel';
    const textarea = document.getElementById('serh-rules');
    if (textarea && Array.isArray(currentConfig.rules)) {
      textarea.value = currentConfig.rules.join('\n'); updateLineNumbers();
    }
    applyDarkModeClass(); applyCollapseMode();
  }

  function syncRulesTextarea() {
    const textarea = document.getElementById('serh-rules');
    if (textarea) {
      textarea.value = currentConfig.rules.join('\n'); updateLineNumbers();
    }
  }

  function appendRuleToTextarea(rule) {
    const textarea = document.getElementById('serh-rules'); if (!textarea) return; const clean = stripRuleComment(String(rule).trim()); const panel = document.getElementById('serh-panel');
    if (panel && Array.isArray(panel._initialRules) &&
        !panel._initialRules.some(r => getRuleKey(r) === getRuleKey(rule))) {
      panel._initialRules.push(rule);
    }
    const lines = textarea.value ? textarea.value.split('\n') : []; if (lines.some(l => stripRuleComment(l.trim()) === clean)) return; lines.push(rule); textarea.value = lines.join('\n');
    updateLineNumbers();
  }

  function removeRulesFromTextarea(rulesToRemove) {
    const textarea = document.getElementById('serh-rules'); if (!textarea || !rulesToRemove || !rulesToRemove.length) return;
    const cleanSet = new Set(rulesToRemove.map(r => stripRuleComment(String(r).trim()))); const panel = document.getElementById('serh-panel');
    if (panel && Array.isArray(panel._initialRules)) {
      panel._initialRules = panel._initialRules.filter(r => !cleanSet.has(stripRuleComment(String(r).trim())));
    }
    const lines = textarea.value ? textarea.value.split('\n') : [];
    const filtered = lines.filter(l => {
      const trimmed = l.trim(); if (!trimmed) return true; return !cleanSet.has(stripRuleComment(trimmed));
    });
    if (filtered.length !== lines.length) {
      textarea.value = filtered.join('\n'); updateLineNumbers();
    }
  }

  function showStatsPanel() {
    const panel = document.getElementById('serh-panel');
    if (!panel || panel._fading) showConfigPanel();
    const statsPanel = document.getElementById('serh-stats-panel');
    if (statsPanel && statsPanel.style.display !== 'flex') {
      updateStatsContent();
      statsPanel.style.display = 'flex';
    }
  }

  function hideStatsPanel() {
    const statsPanel = document.getElementById('serh-stats-panel'); if (statsPanel) statsPanel.style.display = 'none';
    const statsBtn = document.getElementById('serh-test'); if (statsBtn) statsBtn.blur();
  }

  function toggleStatsPanel() {
    const statsPanel = document.getElementById('serh-stats-panel'); if (!statsPanel) return;

    if (statsPanel.style.display === 'flex') {
      hideStatsPanel(); return;
    }

    updateStatsContent(); statsPanel.style.display = 'flex';
  }

  function statSourceKey(s) {
    return (s === t('localRule') || s === '本地规则' || s === 'Local Rule') ? 'local' : '';
  }

  function updateStatsContent() {
    const statsContent = document.getElementById('serh-stats-content'); if (!statsContent) return;

    const textarea = document.getElementById('serh-rules'); const rulesText = textarea ? textarea.value : currentConfig.rules.join('\n'); const rawLines = rulesText.split('\n');
    const localRules = filterValidRuleLines(rawLines);
    const activeRules = localRules
      .filter(rule => !rule.startsWith('#'))
      .map(rule => stripRuleComment(rule))
      .filter(rule => rule.length > 0);

    const ruleErrors = {}; const ruleWarnings = {}; const ruleCounts = new Map();
    activeRules.forEach(rule => {
      if (currentConfig.errorDetection !== false) {
        const analysis = cachedAnalyzeRule(rule); if (!analysis.valid) ruleErrors[rule] = analysis.errors.length ? analysis.errors : [t('invalidRule')];
        if (analysis.warnings.length) ruleWarnings[rule] = analysis.warnings;
      }
      ruleCounts.set(rule, (ruleCounts.get(rule) || 0) + 1);
    });
    const duplicateRules = [...ruleCounts.entries()].filter(([, c]) => c > 1);

    const engine = getSearchEngine(); const selector = getContainerSelector(engine); let results = [];
    try { if (selector) results = document.querySelectorAll(selector); } catch (e) { if (currentConfig.debug) console.warn('[统计] 容器选择器无效:', selector, e); }
    const statsBySource = new Map(); const countedResults = new Map();
    const addRuleHit = (rule, source, type, result) => {
      if (!rule || !source) return;
      const sourceKey = statSourceKey(source); if (!sourceKey) return;
      if (!statsBySource.has(sourceKey)) {
        statsBySource.set(sourceKey, {
          total: 0,
          rules: new Map()
        });
      }
      const sourceStats = statsBySource.get(sourceKey);
      let seen = countedResults.get(sourceKey); if (!seen) { seen = new Set(); countedResults.set(sourceKey, seen); }
      if (!seen.has(result)) { seen.add(result); sourceStats.total++; }
      const ruleMap = sourceStats.rules; const entry = ruleMap.get(rule) || { count: 0, type }; ruleMap.set(rule, entry); entry.count++;
    };
    results.forEach(result => {
      const blockedRule = (result.dataset.matchedRule || '').trim(); if (blockedRule) addRuleHit(blockedRule, result.dataset.matchedSource, null, result);
      const wlRule = (result.dataset.whitelistRule || '').trim(); if (wlRule) addRuleHit(wlRule, result.dataset.whitelistSource, t('whitelistRules'), result);
      const hlRule = (result.dataset.highlightRule || '').trim(); if (hlRule) addRuleHit(hlRule, result.dataset.highlightSource, t('highlightRules'), result);
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

    const rulesSectionHtml = (title, badge, items) => {
      if (!items.length) return ''; let html = statsSectionStartHtml(title, badge);
      for (const item of items) {
        html += `<div style="font-size: 11px; color: #4a5568; word-break: break-all; font-family: 'Consolas', monospace;">${item}</div>`;
      }
      return html + '</div>';
    };

    if (ruleErrorsArray.length > 0) {
      resultHTML += issueBlockHtml(t('statsErrors', {count: ruleErrorsArray.length}), '#c53030', '#fff5f5', 'errorWord', ruleErrorsArray);
    }

    if (ruleWarningsArray.length > 0) {
      resultHTML += issueBlockHtml(t('statsWarnings', {count: ruleWarningsArray.length}), '#b7791f', '#fffff0', 'warningWord', ruleWarningsArray);
    }

    const sourceOrder = [['local', t('localRule')]];
    let hasMatches = false;

    sourceOrder.forEach(([source, sourceLabel]) => {
      const sourceStats = statsBySource.get(source); if (!sourceStats || sourceStats.total === 0) return; hasMatches = true;

      resultHTML += `<div style="margin-bottom: 16px;">`;
      resultHTML += `<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; padding-bottom: 4px; border-bottom: 1px solid #cbd5e0;">`;
      resultHTML += `<span style="font-weight: bold; color: #2d3748; font-size: 14px;">${sourceLabel}</span>`;
      resultHTML += `<span style="background: #2c5282; color: white; padding: 2px 10px; border-radius: 12px; font-size: 12px;">${t('matchedCountLabel')} ${sourceStats.total} ${t('matchedCountUnit')}</span>`;
      resultHTML += `</div>`;

      const sortedRules = Array.from(sourceStats.rules.entries()).sort((a, b) => b[1].count - a[1].count);
      sortedRules.forEach(([rule, hit]) => {
        let ruleType = hit.type;
        if (!ruleType) {
          ruleType = t('urlRule');
          if (HL_STATS_REGEX.test(rule)) {
            ruleType = t('highlightRules');
          } else if (/@if\s*\(/i.test(rule) || looksLikeCondExpr(rule.replace(/^@\d+\s+/, '').replace(/^@/, ''))) {
            ruleType = t('statsCompound');
          } else if (/^title\//i.test(rule)) {
            ruleType = t('titleRule');
          } else if (/^text\//i.test(rule)) {
            ruleType = t('textRule');
          } else if (rule.startsWith('/')) {
            ruleType = t('regexRule');
          }
        }

        resultHTML += `<div style="margin: 6px 0; padding: 6px 8px; background: #f7fafc; border-radius: 4px;">`;
        resultHTML += `<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">`;
        resultHTML += `<span style="font-size: 11px; color: #718096;">${ruleType}</span>`;
        resultHTML += `<span style="font-size: 11px; color: #38a169; font-weight: bold;">${t('matchedCountLabel')}: ${hit.count} ${t('matchedCountUnit')}</span>`;
        resultHTML += `</div>`;
        resultHTML += `<div style="font-size: 12px; color: #2d3748; word-break: break-all; font-family: 'Consolas', monospace;">${escHtml(rule)}</div>`;
        resultHTML += `</div>`;
      });

      resultHTML += `</div>`;
    });

    if (!hasMatches && ruleErrorsArray.length === 0 && ruleWarningsArray.length === 0) {
      resultHTML = `<div style="color: #38a169; padding: 10px; border-radius: 4px; font-size: 12px; background: #f0fff4; text-align: center;">${t('noMatch')}</div>`;
    }

    resultHTML += rulesSectionHtml(t('duplicateRules'), `${duplicateRules.length} ${t('matchedCountUnit')}`,
      duplicateRules.map(([rule, count]) => `${escHtml(rule)} <span style="color:#c53030;">${t('ruleDuplicate', {count})}</span>`));

    statsContent.innerHTML = resultHTML;
  }

  function showConfigPanel() {
    const clearPanelCloseTimers = () => {
      if (window._panelCloseTimer) {
        clearTimeout(window._panelCloseTimer); window._panelCloseTimer = null;
      }
      if (window._panelCloseHandler) {
        document.removeEventListener('click', window._panelCloseHandler); window._panelCloseHandler = null;
      }
      if (window._panelPressHandler) {
        document.removeEventListener('pointerdown', window._panelPressHandler); document.removeEventListener('mousedown', window._panelPressHandler); window._panelPressHandler = null;
      }
    };
    clearPanelCloseTimers();

    const opened = openPanel('serh-panel', { bindClose: false, onExisting: () => clearPanelCloseTimers() });
    if (!opened) return;
    const { panel } = opened; panel._initialRules = Array.isArray(currentConfig.rules) ? [...currentConfig.rules] : [];
    const initialSize = getBubbleSize();
    panel.innerHTML = `
            <div class="serh-option-row" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; gap: 8px;">
                <span class="serh-option-label" style="margin-bottom: 0;">${t('bubbleSize')} <span id="serh-bubble-size-val">${initialSize}px</span></span>
                <input type="range" id="serh-bubble-size-slider" min="20" max="60" value="${initialSize}" style="flex: 1; margin-left: 5px; height: 4px; background: #cbd5e0; border-radius: 2px; outline: none; -webkit-appearance: none; cursor: pointer;">
            </div>
            
            <div style="margin-bottom: 0px;">
                <div class="serh-compact-row">
                    <span style="font-size: 12px; color: #4a5568;">${t('blockRules')}</span>
                    <div style="display: flex; gap: 4px; flex: 0 0 auto;">
                        <button id="serh-import-file" class="serh-button serh-button-secondary" style="padding: 3px 8px; border: 1px solid transparent; min-width: 0 !important; width: auto !important; flex: 0 0 auto !important;">${t('import')}</button>
                        <button id="serh-export-file" class="serh-button serh-button-success" style="padding: 3px 8px; border: 1px solid transparent; min-width: 0 !important; width: auto !important; flex: 0 0 auto !important;">${t('export')}</button>
                        <button id="serh-open-settings" class="serh-button serh-button-secondary" style="padding: 3px 8px; border: 1px solid transparent; min-width: 0 !important; width: auto !important; flex: 0 0 auto !important;">${t('settingsBtn')}</button>
                    </div>
                </div>
                <div class="serh-rules-container" style="height: 205px;">
                    <div id="serh-line-numbers"></div>
                    <textarea id="serh-rules" placeholder="${t('placeholder')}" wrap="off">${escHtml(currentConfig.rules.join('\n'))}</textarea>
                    <div id="serh-scroll-top" class="serh-scroll-btn" style="top: 2px;">⬆️</div>
                    <div id="serh-scroll-bottom" class="serh-scroll-btn" style="bottom: 1px;">⬇️</div>
                </div>
            </div>
            
            <div style="display: flex; gap: 6px; margin-top: 8px;" id="serh-panel-footer">
                <button id="serh-save" class="serh-button serh-button-primary serh-action-button" style="flex: 2;">${t('save')}</button>
                <button id="serh-test" class="serh-button serh-button-secondary serh-action-button" style="flex: 1;">${t('stats')}</button>
                <button id="serh-close" class="serh-button serh-button-danger serh-action-button" style="flex: 1;">${t('close')}</button>
            </div>
            
            <div id="serh-stats-panel">
                <div id="serh-stats-content"></div>
            </div>
        `;

    updateLineNumbers();
    const textarea = document.getElementById('serh-rules'); const lineNums = document.getElementById('serh-line-numbers');
    textarea.addEventListener('input', () => scheduleLineNumbersUpdate());
    textarea.addEventListener('scroll', () => {
      lineNums.scrollTop = textarea.scrollTop;
    });
    lineNums.addEventListener('click', (e) => {
      const errorEl = e.target.closest('.serh-line-error'); if (errorEl) showToast(errorEl.getAttribute('data-error') || t('invalidRule'), 'error');
    });
    setupBracketHighlight(textarea, 'rules');

    const closePanel = () => {
      clearPanelCloseTimers(); fadeOutAndRemovePanel(panel); const toastContainer = document.getElementById('serh-toast-container'); if (toastContainer) toastContainer.remove();
    };

    document.getElementById('serh-save').onclick = () => {
      hideStatsPanel(); saveConfig(); showToast(t('saved'), 'success');
    };
    document.getElementById('serh-test').onclick = toggleStatsPanel;
    document.getElementById('serh-close').onclick = (e) => {
      e.stopPropagation(); closePanel();
    };
    document.getElementById('serh-import-file').onclick = importRulesFromFile; document.getElementById('serh-export-file').onclick = exportRulesToFile;
    document.getElementById('serh-open-settings').onclick = (e) => {
      e.stopPropagation(); showSettingsPanel();
    };

    const COMMENT_HEADING_REGEX = /^\s*#+\s+\S+/;
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
      const text = textarea.value; const lines = text.split('\n'); const commentIndices = findCommentLineIndices(lines); if (!commentIndices.length) return;

      const cursorPos = textarea.selectionStart || 0; let currentLineIndex = text.substring(0, cursorPos).split('\n').length - 1;
      let targetLineIndex = -1;
      if (direction === 'prev') {
        if (currentLineIndex === 0) {
          targetLineIndex = lines.length - 1;
        } else {
          for (let i = commentIndices.length - 1; i >= 0; i--) {
            if (commentIndices[i] < currentLineIndex) { targetLineIndex = commentIndices[i]; break; }
          }
          if (targetLineIndex === -1) targetLineIndex = lines.length - 1;
        }
      } else {
        for (let i = 0; i < commentIndices.length; i++) {
          if (commentIndices[i] > currentLineIndex) { targetLineIndex = commentIndices[i]; break; }
        }
        if (targetLineIndex === -1) targetLineIndex = commentIndices[0];
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
      const btn = document.getElementById(id); if (!btn) return; let lastTouchTime = 0;
      const handleJump = (e) => {
        if (e) {
          if (e.cancelable) e.preventDefault(); e.stopPropagation();
        }
        jumpToComment(direction);
      };
      btn.addEventListener('touchstart', (e) => {
        if (e.cancelable) e.preventDefault(); e.stopPropagation(); lastTouchTime = Date.now(); handleJump(e);
      }, { passive: false });
      btn.addEventListener('mousedown', (e) => {
        if (e.cancelable) e.preventDefault(); e.stopPropagation();
      });
      btn.onclick = (e) => {
        if (Date.now() - lastTouchTime < 400) return; handleJump(e);
      };
    };
    bindScrollBtn('serh-scroll-top', 'prev'); bindScrollBtn('serh-scroll-bottom', 'next');

    const sizeSlider = panel.querySelector('#serh-bubble-size-slider'); const sizeValueDisplay = panel.querySelector('#serh-bubble-size-val');
    if (sizeSlider) {
      sizeSlider.addEventListener('input', function() {
        const value = parseInt(this.value); currentConfig.bubbleSize = value;
        if (sizeValueDisplay) {
          sizeValueDisplay.textContent = `${value}px`;
        }
        const statusBtn = document.getElementById('serh-status'); if (statusBtn) applyBubbleSize(statusBtn);
      });
      sizeSlider.addEventListener('change', function() {
        const value = parseInt(this.value); adoptStoredConfigBeforeWrite(); currentConfig.bubbleSize = value; persistConfig(true);
      });
    }

    const closeZoneSelector = '#serh-status, #serh-hlcolor-panel, #serh-selector-panel, #serh-block-confirm-dialog, #serh-settings-panel, .serh-quick-block';
    const isPanelZone = (target) => panel.contains(target) || !!(target.closest && target.closest(closeZoneSelector)); let pressStartedInside = false;
    const pressHandler = (e) => {
      if (e.isTrusted === false) return; pressStartedInside = isPanelZone(e.target);
    };
    const closeHandler = (e) => {
      if (preventPanelClose) return; if (e.isTrusted === false) return;
      if (pressStartedInside) {
        pressStartedInside = false; return;
      }
      if (!isPanelZone(e.target)) closePanel();
    };
    window._panelCloseHandler = closeHandler; window._panelPressHandler = pressHandler; if (window._panelCloseTimer) clearTimeout(window._panelCloseTimer);
    window._panelCloseTimer = setTimeout(() => {
      window._panelCloseTimer = null;
      if (panel.isConnected && window._panelCloseHandler === closeHandler) {
        document.addEventListener('pointerdown', pressHandler); document.addEventListener('mousedown', pressHandler); document.addEventListener('click', closeHandler);
      }
    }, 200);
  }

  function saveConfig() {
    const rulesText = document.getElementById('serh-rules').value;

    const rawLines = rulesText.split('\n'); const userRules = filterValidRuleLines(rawLines);
    const panel = document.getElementById('serh-panel');
    const baseRules = (panel && Array.isArray(panel._initialRules)) ? panel._initialRules : (Array.isArray(currentConfig.rules) ? currentConfig.rules : []);
    const rulesChanged = JSON.stringify(baseRules) !== JSON.stringify(userRules);
    adoptStoredConfigBeforeWrite();
    const initialKeySet = new Set(baseRules.map(getRuleKey)); const userKeySet = new Set(userRules.map(getRuleKey));
    const backgroundNewRules = (Array.isArray(currentConfig.rules) ? currentConfig.rules : []).filter(r => {
      const k = getRuleKey(r); return k && !initialKeySet.has(k) && !userKeySet.has(k);
    });
    const finalRules = backgroundNewRules.length > 0 ? [...userRules, ...backgroundNewRules] : userRules;

    currentConfig.rules = finalRules;
    persistConfig(rulesChanged);
    if (panel) panel._initialRules = [...finalRules]; if (backgroundNewRules.length > 0) syncRulesTextarea();
    if (showHiddenResults) {
      showHiddenResults = false;
      if (currentConfig.collapseMode !== true) {
        document.querySelectorAll('[data-is-blocked="true"]').forEach(el => {
          el.style.display = 'none'; el.classList.remove('serh-blocked-visible'); el.classList.remove('serh-blocked-collapsed'); setResultExtraElementsVisible(el, false); removeMatchedRuleLabel(el); restoreResultCollapse(el);
        });
        document.querySelectorAll('[data-blocker-google-parent], [data-blocker-yandex-parent]').forEach(parent => { parent.style.display = 'none'; });
      }
    }
    forceReprocessAll();
  }

  function showSettingsPanel() {
    const opened = openPanel('serh-settings-panel', { width: 'max-content' });
    if (!opened) return;
    const { panel, closePanel } = opened;
    panel.style.minWidth = '240px';
    panel.style.maxWidth = 'calc(100vw - 24px)';
    const settingsSwitch = (id, label, checked) => `
                <label style="display: flex; align-items: center; flex: 1; justify-content: space-between; white-space: nowrap; cursor: pointer; font-size: 12px; color: #4a5568; margin: 0; padding: 0;">
                    <span style="display: flex; align-items: center; margin: 0; padding: 0;">
                        <span class="serh-switch">
                            <input type="checkbox" id="${id}" ${checked ? 'checked' : ''}>
                            <span class="serh-slider"></span>
                        </span>
                        <span style="margin: 0; padding: 0;">${label}</span>
                    </span>
                </label>`;
    const settingsRow = (items, last) => `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; align-items: center; margin: 0 0 ${last ? 0 : 10}px; padding: 0;">
                ${items.map(item => settingsSwitch(item.id, t(item.labelKey), item.checked)).join('\n                ')}
            </div>`;
    const settingsHeader = key => `
            <div style="margin: 0 0 6px; padding: 0; font-size: 11px; font-weight: 600; color: #718096;">${t(key)}</div>`;

    panel.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between; margin: 0 0 4px; padding: 0;">
                <h3 style="margin: 0; padding: 0; font-size: 13px; color: #2d3748; font-weight: 600;">${escHtml(t('settingsPanelTitle'))}</h3>
                <span id="serh-settings-close" style="cursor: pointer; font-size: 12px; line-height: 1; margin: 0; padding: 0;">❌</span>
            </div>
            ${settingsHeader('settingsSecBlock')}
            ${settingsRow([
              { id: 'serh-set-show-block-btn', labelKey: 'enableFeature', checked: currentConfig.showBlockBtn === true },
              { id: 'serh-set-block-domain', labelKey: 'blockDomain', checked: currentConfig.blockDomain === true }
            ])}
            ${settingsRow([
              { id: 'serh-set-block-confirm', labelKey: 'doubleConfirm', checked: currentConfig.blockConfirm === true },
              { id: 'serh-set-show-source', labelKey: 'showMatchedSource', checked: currentConfig.showMatchedSource !== false }
            ])}
            ${settingsHeader('settingsSecUI')}
            ${settingsRow([
              { id: 'serh-set-show-bubble', labelKey: 'menuBubble', checked: currentConfig.showBubble === true },
              { id: 'serh-set-show-count', labelKey: 'showCount', checked: currentConfig.showCount === true }
            ])}
            ${settingsRow([
              { id: 'serh-set-panel-centered', labelKey: 'menuCenter', checked: currentConfig.panelCentered === true },
              { id: 'serh-set-auto-dark', labelKey: 'autoDark', checked: currentConfig.autoDark !== false }
            ])}
            ${settingsRow([
              { id: 'serh-set-bracket-highlight', labelKey: 'bracketHighlight', checked: currentConfig.bracketHighlight !== false }
            ])}
            ${settingsHeader('settingsSecOther')}
            ${settingsRow([
              { id: 'serh-set-remove-redirects', labelKey: 'removeRedirects', checked: currentConfig.removeRedirects !== false },
              { id: 'serh-set-error-detection', labelKey: 'menuErrorDetection', checked: currentConfig.errorDetection !== false }
            ])}
            ${settingsRow([
              { id: 'serh-set-disable-block', labelKey: 'disableBlock', checked: currentConfig.enabled === false },
              { id: 'serh-set-debug', labelKey: 'debugMode', checked: currentConfig.debug === true }
            ])}
            ${settingsRow([
              { id: 'serh-set-export-config', labelKey: 'exportConfig', checked: currentConfig.exportConfig === true },
              { id: 'serh-set-collapse-mode', labelKey: 'collapseMode', checked: currentConfig.collapseMode === true }
            ])}
            <div style="display: flex; gap: 8px; margin: 0; padding: 0;">
                <div style="flex: 1; min-width: 0; margin: 0; padding: 0;">
                    <label for="serh-set-bubble-action" style="display: block; margin: 0 0 4px; padding: 0; cursor: pointer; font-size: 12px; color: #4a5568;">${t('menuBubbleAction')}</label>
                    <select id="serh-set-bubble-action" style="width: 100%; min-width: 0; margin: 0; font-size: 12px; padding: 3px 4px; border: 1px solid #cbd5e0; border-radius: 4px; background: #fff; color: #2d3748; cursor: pointer; outline: none; font-family: inherit;">
                        <option value="openPanel" ${(currentConfig.bubbleAction !== 'openStats' && currentConfig.bubbleAction !== 'toggleHidden') ? 'selected' : ''}>${t('menuBubbleActionOpen')}</option>
                        <option value="openStats" ${currentConfig.bubbleAction === 'openStats' ? 'selected' : ''}>${t('menuBubbleActionStats')}</option>
                        <option value="toggleHidden" ${currentConfig.bubbleAction === 'toggleHidden' ? 'selected' : ''}>${t('menuBubbleActionToggle')}</option>
                    </select>
                </div>
                <div style="flex: 1; min-width: 0; margin: 0; padding: 0;">
                    <label for="serh-set-language" style="display: block; margin: 0 0 4px; padding: 0; cursor: pointer; font-size: 12px; color: #4a5568;">${t('menuLanguage')}</label>
                    <select id="serh-set-language" style="width: 100%; min-width: 0; margin: 0; font-size: 12px; padding: 3px 4px; border: 1px solid #cbd5e0; border-radius: 4px; background: #fff; color: #2d3748; cursor: pointer; outline: none; font-family: inherit;">
                        <option value="zh-CN" ${currentConfig.language !== 'en' ? 'selected' : ''}>中文</option>
                        <option value="en" ${currentConfig.language === 'en' ? 'selected' : ''}>English</option>
                    </select>
                </div>
            </div>
        `;

    const applyPanelPosition = el => {
      if (!el) return; el.style.top = ''; el.style.left = ''; el.style.right = ''; el.style.bottom = ''; el.style.transform = '';
      getPanelPositionStyles().split(';').forEach(rule => {
        const idx = rule.indexOf(':'); if (idx > 0) el.style.setProperty(rule.slice(0, idx).trim(), rule.slice(idx + 1).trim());
      });
    };

    const settingsDefs = [
      { id: 'serh-set-remove-redirects', key: 'removeRedirects', apply: () => { forceReprocessAll(); } },
      { id: 'serh-set-show-block-btn', key: 'showBlockBtn', apply: () => { forceReprocessAll(); } },
      { id: 'serh-set-block-domain', key: 'blockDomain', apply: null },
      { id: 'serh-set-block-confirm', key: 'blockConfirm', apply: null },
      { id: 'serh-set-show-source', key: 'showMatchedSource', apply: () => {
        document.querySelectorAll('[data-is-blocked="true"]').forEach(el => {
          if (currentConfig.showMatchedSource === false) removeMatchedRuleLabel(el); else if (showHiddenResults) addMatchedRuleLabel(el);
        });
      } },
      { id: 'serh-set-show-bubble', key: 'showBubble', apply: () => { updateStatus(document.querySelectorAll('[data-is-blocked="true"]').length); } },
      { id: 'serh-set-show-count', key: 'showCount', apply: () => { const s = document.getElementById('serh-status'); if (s) updateBubbleContent(s, parseInt(s.dataset.blockedCount || 0)); } },
      { id: 'serh-set-panel-centered', key: 'panelCentered', apply: () => {
        applyPanelPosition(document.getElementById('serh-panel')); applyPanelPosition(document.getElementById('serh-settings-panel'));
      } },
      { id: 'serh-set-auto-dark', key: 'autoDark', apply: () => { applyDarkModeClass(); } },
      { id: 'serh-set-bracket-highlight', key: 'bracketHighlight', apply: () => { document.querySelectorAll('.serh-bracket-hit').forEach(h => { h.style.display = 'none'; }); } },
      { id: 'serh-set-disable-block', key: 'enabled', invert: true, apply: () => { forceReprocessAll(); } },
      { id: 'serh-set-debug', key: 'debug', apply: () => { exposeDebugApi(); } },
      { id: 'serh-set-error-detection', key: 'errorDetection', apply: () => {
        updateLineNumbers(); const statsPanel = document.getElementById('serh-stats-panel'); if (statsPanel && statsPanel.style.display === 'flex') updateStatsContent();
      } },
      { id: 'serh-set-collapse-mode', key: 'collapseMode', apply: () => {
        applyCollapseMode(); forceReprocessAll();
        if (currentConfig.collapseMode === true) showToast(t('collapseModeHint'), 'info');
      } },
      { id: 'serh-set-export-config', key: 'exportConfig', apply: null }
    ];
    settingsDefs.forEach(sw => {
      const el = document.getElementById(sw.id);
      if (el) {
        el.addEventListener('change', function() {
          adoptStoredConfigBeforeWrite(); currentConfig[sw.key] = sw.invert ? !this.checked : this.checked; persistConfig(true); if (sw.apply) sw.apply();
        });
      }
    });

    const bubbleActionSelect = document.getElementById('serh-set-bubble-action');
    if (bubbleActionSelect) {
      bubbleActionSelect.addEventListener('change', function() {
        const wasToggleMode = currentConfig.bubbleAction === 'toggleHidden';
        adoptStoredConfigBeforeWrite(); currentConfig.bubbleAction = this.value; persistConfig(true);
        if (wasToggleMode && this.value !== 'toggleHidden' && showHiddenResults) toggleHiddenResults();
        const statusBtn = document.getElementById('serh-status'); if (statusBtn) updateBubbleContent(statusBtn, parseInt(statusBtn.dataset.blockedCount || 0));
        if (this.value === 'toggleHidden') showToast(t('bubbleToggleHint'), 'info');
        else if (this.value === 'openStats') showToast(t('bubbleStatsHint'), 'info');
      });
    }

    const languageSelect = document.getElementById('serh-set-language');
    if (languageSelect) {
      languageSelect.addEventListener('change', function() {
        adoptStoredConfigBeforeWrite(); currentConfig.language = this.value; persistConfig(true); registerMenu();
        if (typeof panel._cleanupClick === 'function') panel._cleanupClick();
        panel.remove(); showSettingsPanel();
      });
    }

    document.getElementById('serh-settings-close').onclick = (e) => {
      e.stopPropagation(); closePanel();
    };
  }

  function showHighlightColorPanel() {
    const opened = openPanel('serh-hlcolor-panel', { width: 'auto; max-width: 350px' });
    if (!opened) return;
    const { panel, closePanel } = opened;

    function hsvToRgb(h, s, v) {
      h /= 360; let r, g, b; const i = Math.floor(h * 6); const f = h * 6 - i; const p = v * (1 - s); const q = v * (1 - f * s); const t = v * (1 - (1 - f) * s);
      switch (i % 6) {
        case 0: r=v; g=t; b=p; break; case 1: r=q; g=v; b=p; break; case 2: r=p; g=v; b=t; break; case 3: r=p; g=q; b=v; break; case 4: r=t; g=p; b=v; break; case 5: r=v; g=p; b=q; break;
      }
      return [Math.round(r*255), Math.round(g*255), Math.round(b*255)];
    }

    function rgbToHsv(r, g, b) {
      r /= 255; g /= 255; b /= 255; const max = Math.max(r, g, b), min = Math.min(r, g, b); const d = max - min; let h = 0;
      if (d !== 0) {
        if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60; else if (max === g) h = ((b - r) / d + 2) * 60; else h = ((r - g) / d + 4) * 60;
      }
      return [Math.round(h), max === 0 ? 0 : d / max, max];
    }

    function hexToRgb(hex) {
      return [parseInt(hex.slice(1,3), 16), parseInt(hex.slice(3,5), 16), parseInt(hex.slice(5,7), 16)];
    }

    function rgbToHex(r, g, b) {
      return '#' + [r,g,b].map(x => x.toString(16).padStart(2,'0').toUpperCase()).join('');
    }

    const colors = currentConfig.highlightColors || {}; const sanitizeHex = (val, fallback) => (/^#[0-9A-Fa-f]{6}$/.test(String(val || '')) ? String(val).toUpperCase() : fallback); let rowsHtml = '';
    for (let i = 1; i <= 5; i++) {
      const hex = sanitizeHex(colors[i], '#CE2029');
      rowsHtml += `<div class="serh-hlcolor-row">
        <label>@${i}</label>
        <span class="serh-hlcolor-preview" id="serh-hlcolor-preview-${i}" style="background:${escHtml(hex)}"></span>
        <input type="text" id="serh-hlcolor-input-${i}" value="${escHtml(hex)}" placeholder="#RRGGBB" maxlength="7">
      </div>`;
    }

    const defaultHex = '#66CCFF'; const [ir, ig, ib] = hexToRgb(defaultHex); let [currentHue, currentSat, currentVal] = rgbToHsv(ir, ig, ib);
    panel.innerHTML = `
      <h3 style="margin:0 0 1px;font-size:13px;line-height:1.2;color:#2d3748;font-weight:600;">${escHtml(t('hlColorTitle'))}</h3>
      <div style="font-size:11px;color:#718096;margin:0 0 3px;">${t('hlColorHint')}</div>
      <div style="display:flex;gap:2px;align-items:stretch;">
        <div id="serh-hlcolor-left" style="flex:0 0 auto;display:flex;flex-direction:column;height:132px;">
          ${rowsHtml}
          <div style="display:flex;align-items:center;gap:4px;margin-top:1px;">
            <span style="min-width:20px;font-size:12px;color:#4a5568;font-weight:600;">🎨</span>
            <span id="serh-hlcolor-current-preview" style="width:12px;height:12px;border-radius:2px;border:1px solid #e2e8f0;background:${escHtml(defaultHex)};flex-shrink:0;"></span>
            <span id="serh-hlcolor-code-text" style="font-size:11px;font-family:'Consolas',monospace;padding:2px 4px;background:#f7fafc;border-radius:3px;border:1px solid #e2e8f0;width:70px;flex:none;text-align:center;">${escHtml(defaultHex)}</span>
          </div>
        </div>
        <div class="serh-hlcolor-picker-wrapper" style="display:flex;gap:2px;align-items:stretch;flex-shrink:0;position:relative;">
          <canvas id="serh-hlcolor-sv-canvas"></canvas>
          <canvas id="serh-hlcolor-hue-canvas" width="22"></canvas>
          <span id="serh-hlcolor-sv-dot"></span>
          <span id="serh-hlcolor-hue-dot"></span>
        </div>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:5px;">
        <button id="serh-hlcolor-save" class="serh-button serh-button-primary" style="flex:1;">${escHtml(t('save'))}</button>
        <button id="serh-hlcolor-reset" class="serh-button serh-button-secondary" style="flex:1;">${escHtml(t('hlColorReset'))}</button>
        <button id="serh-hlcolor-cancel" class="serh-button serh-button-secondary" style="flex:1;">${escHtml(t('cancel'))}</button>
      </div>
    `;

    function resizeCanvasToMatch() {
      const left = document.getElementById('serh-hlcolor-left'); const svCanvas = document.getElementById('serh-hlcolor-sv-canvas');
      const hueCanvas = document.getElementById('serh-hlcolor-hue-canvas'); if (!left || !svCanvas || !hueCanvas) return; svCanvas.width = svCanvas.height = left.clientHeight;
      hueCanvas.height = left.clientHeight; drawSVCanvas(currentHue); drawHueCanvas(); updateIndicators();
    }
    requestAnimationFrame(() => {
      resizeCanvasToMatch(); updatePickedColor();
    });

    function drawSVCanvas(hue) {
      const canvas = document.getElementById('serh-hlcolor-sv-canvas'); if (!canvas) return; const ctx = canvas.getContext('2d'); const w = canvas.width, h = canvas.height;
      const imageData = ctx.createImageData(w, h);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const s = x / w, v = 1 - y / h; const [r, g, b] = hsvToRgb(hue, s, v); const idx = (y * w + x) * 4; imageData.data[idx] = r; imageData.data[idx+1] = g; imageData.data[idx+2] = b;
          imageData.data[idx+3] = 255;
        }
      }
      ctx.putImageData(imageData, 0, 0);
    }

    function drawHueCanvas() {
      const canvas = document.getElementById('serh-hlcolor-hue-canvas'); if (!canvas) return; const ctx = canvas.getContext('2d'); const w = canvas.width, h = canvas.height;
      for (let y = 0; y < h; y++) {
        const [r, g, b] = hsvToRgb((y / h) * 360, 1, 1);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(0, y, w, 1);
      }
    }

    function updatePickedColor() {
      const [r, g, b] = hsvToRgb(currentHue, currentSat, currentVal); const hex = rgbToHex(r, g, b); const el = document.getElementById('serh-hlcolor-code-text'); if (el) el.textContent = hex;
      const preview = document.getElementById('serh-hlcolor-current-preview'); if (preview) preview.style.background = hex;
    }

    const svCanvas = document.getElementById('serh-hlcolor-sv-canvas');
    function onSVMove(clientX, clientY) {
      const rect = svCanvas.getBoundingClientRect(); const x = Math.max(0, Math.min(svCanvas.width, clientX - rect.left)); const y = Math.max(0, Math.min(svCanvas.height, clientY - rect.top));
      currentSat = x / svCanvas.width; currentVal = 1 - y / svCanvas.height; updatePickedColor(); updateIndicators();
    }

    const hueCanvas = document.getElementById('serh-hlcolor-hue-canvas');
    const svDot = document.getElementById('serh-hlcolor-sv-dot'); const hueDot = document.getElementById('serh-hlcolor-hue-dot');
    function updateIndicators() {
      if (!svDot || !hueDot || !svCanvas.width) return; const wrap = svCanvas.parentElement.getBoundingClientRect(); const sr = svCanvas.getBoundingClientRect(); const hr = hueCanvas.getBoundingClientRect();
      svDot.style.left = (sr.left + currentSat * sr.width - wrap.left) + 'px'; svDot.style.top = (sr.top + (1 - currentVal) * sr.height - wrap.top) + 'px';
      hueDot.style.left = (hr.left + hr.width / 2 - wrap.left) + 'px'; hueDot.style.top = (hr.top + (currentHue / 360) * hr.height - wrap.top) + 'px';
    }
    function onHueMove(clientY) {
      const rect = hueCanvas.getBoundingClientRect(); const y = Math.max(0, Math.min(hueCanvas.height, clientY - rect.top)); currentHue = (y / hueCanvas.height) * 360; drawSVCanvas(currentHue);
      updatePickedColor(); updateIndicators();
    }

    const bindCanvasDrag = (canvas, onMove) => {
      canvas.addEventListener('mousedown', (e) => {
        onMove(e.clientX, e.clientY); const onDragMove = (me) => onMove(me.clientX, me.clientY);
        const onDragUp = () => {
          document.removeEventListener('mousemove', onDragMove); document.removeEventListener('mouseup', onDragUp);
        };
        document.addEventListener('mousemove', onDragMove); document.addEventListener('mouseup', onDragUp);
      });
      canvas.addEventListener('touchstart', (e) => {
        if (!e.touches || !e.touches[0]) return; e.preventDefault(); onMove(e.touches[0].clientX, e.touches[0].clientY);
        const onTouchMove = (te) => {
          if (!te.touches || !te.touches[0]) return; te.preventDefault(); onMove(te.touches[0].clientX, te.touches[0].clientY);
        };
        const onTouchEnd = () => {
          document.removeEventListener('touchmove', onTouchMove); document.removeEventListener('touchend', onTouchEnd); document.removeEventListener('touchcancel', onTouchEnd);
        };
        document.addEventListener('touchmove', onTouchMove, { passive: false }); document.addEventListener('touchend', onTouchEnd); document.addEventListener('touchcancel', onTouchEnd);
      }, { passive: false });
    };
    bindCanvasDrag(svCanvas, onSVMove); bindCanvasDrag(hueCanvas, (_x, y) => onHueMove(y));

    function updatePreview(i) {
      const input = document.getElementById(`serh-hlcolor-input-${i}`);
      const preview = document.getElementById(`serh-hlcolor-preview-${i}`);
      if (input && preview && /^#[0-9a-fA-F]{6}$/.test(input.value)) {
        preview.style.background = input.value;
      }
    }

    for (let i = 1; i <= 5; i++) {
      document.getElementById(`serh-hlcolor-input-${i}`).addEventListener('input', () => updatePreview(i));
      document.getElementById(`serh-hlcolor-preview-${i}`).addEventListener('click', () => {
        const hexEl = document.getElementById('serh-hlcolor-code-text'); const hex = hexEl && hexEl.textContent; const input = document.getElementById(`serh-hlcolor-input-${i}`);
        if (hex && input && /^#[0-9a-fA-F]{6}$/.test(hex)) { input.value = hex; updatePreview(i); }
      });
    }

    document.getElementById('serh-hlcolor-save').onclick = () => {
      const newColors = {...currentConfig.highlightColors}; let hasError = false;
      for (let i = 1; i <= 5; i++) {
        const input = document.getElementById(`serh-hlcolor-input-${i}`);
        const val = input.value.trim(); if (val === '') continue;
        if (!/^#[0-9a-fA-F]{6}$/.test(val)) {
          const saveBtn = document.getElementById('serh-hlcolor-save'); if (!saveBtn._errTimer) saveBtn._errText = saveBtn.textContent; saveBtn.textContent = t('errorWord'); saveBtn.style.backgroundColor = '#c53030';
          clearTimeout(saveBtn._errTimer); saveBtn._errTimer = setTimeout(() => {
            saveBtn.textContent = saveBtn._errText; saveBtn.style.backgroundColor = ''; saveBtn._errTimer = null;
          }, 1500);
          hasError = true; break;
        }
        newColors[i] = val;
      }
      if (hasError) return; adoptStoredConfigBeforeWrite(); currentConfig.highlightColors = newColors; persistConfig(true); forceReprocessAll(); showToast(t('saved'), 'success');
    };

    document.getElementById('serh-hlcolor-reset').onclick = () => {
      const defaults = DEFAULT_HIGHLIGHT_COLORS;
      for (let i = 1; i <= 5; i++) {
        document.getElementById(`serh-hlcolor-input-${i}`).value = defaults[i];
        document.getElementById(`serh-hlcolor-preview-${i}`).style.background = defaults[i];
      }
      const [r, g, b] = hexToRgb('#66CCFF');
      [currentHue, currentSat, currentVal] = rgbToHsv(r, g, b); drawSVCanvas(currentHue); updatePickedColor(); updateIndicators(); showToast(t('resetPending'), 'success');
    };

    document.getElementById('serh-hlcolor-cancel').onclick = (e) => {
      e.stopPropagation(); closePanel();
    };
  }

  function regexSourceToLiteralText(source) {
    let out = '';
    for (let i = 0; i < source.length; i++) {
      const ch = source[i];
      if (ch === '\\') { out += ch + (source[i + 1] || ''); i++; continue; }
      if (ch === '/') out += '\\/'; else out += ch;
    }
    return out;
  }

  function escapeJsString(text) {
    return String(text).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t');
  }

  function serializeSelectors(base) {
    const merged = base || getSelectors(); const parts = [];
    const keyToText = (key) => /^[A-Za-z_$][\w$]*$/.test(key) ? key : `'${escapeJsString(key)}'`;
    const defToText = (def, disabled) => {
      const links = Array.isArray(def.links)
        ? `[${(def.links || []).map(s => `'${escapeJsString(s)}'`).join(', ')}]`
        : `'${escapeJsString(def.links || 'a[href]')}'`;
      const m = matchDefToParts(def.match);
      const matchText = (m.source || m.flags) ? `/${regexSourceToLiteralText(m.source)}/${m.flags}` : `''`;
      return `{\n` +
        `  match: ${matchText},\n` +
        `  containers: '${escapeJsString(def.containers || '')}',\n` +
        `  titles: [${(def.titles || []).map(s => `'${escapeJsString(s)}'`).join(', ')}],\n` +
        `  snippets: [${(def.snippets || []).map(s => `'${escapeJsString(s)}'`).join(', ')}],\n` +
        `  links: ${links},\n` +
        `  extraElements: [${(def.extraElements || []).map(s => `'${escapeJsString(s)}'`).join(', ')}],\n` +
        (disabled ? `  disabled: true,\n` : '') +
        `}`;
    };
    for (const key of Object.keys(merged)) {
      if (key === 'other') continue; const def = merged[key];
      if (def && def.disabled) {
        let hasCustom = !!(def.match || def.containers || (def.titles && def.titles.length) || (def.snippets && def.snippets.length) || (def.extraElements && def.extraElements.length));
        if (!hasCustom && def.links !== undefined) {
          const norm = (v) => JSON.stringify(normalizeSelectorList(v)); hasCustom = norm(def.links) !== norm('a[href]');
        }
        if (hasCustom) {
          parts.push(`${keyToText(key)}: ${defToText(def, true)}`);
          continue;
        }
        const builtin = SELECTORS[key];
        parts.push(`${keyToText(key)}: ${builtin ? defToText(builtin, true) : `{\n  disabled: true,\n}`}`);
        continue;
      }
      parts.push(`${keyToText(key)}: ${defToText(def, false)}`);
    }
    return parts.join(',\n');
  }

  function isValidCssSelector(selector) {
    try {
      document.querySelector(selector); return true;
    } catch (e) {
      return false;
    }
  }

  function hasPseudoElement(selector) {
    return /::/.test(String(selector).replace(/(["'])(?:\\.|(?!\1).)*\1/g, ''));
  }

  function validateUserSelectors(config) {
    if (!config || typeof config !== 'object' || Array.isArray(config)) return [t('selectorJsonError')]; const errors = [];
    for (const key of Object.keys(config)) {
      const def = config[key];
      if (key === 'other') { errors.push(t('selectorReservedKey', { key })); continue; }
      if (!/^[A-Za-z0-9_-]+$/.test(key)) { errors.push(t('selectorInvalidKey', { key })); continue; }
      if (!def || typeof def !== 'object' || Array.isArray(def)) { errors.push(t('selectorFieldRequired', { key, field: 'match' })); continue; }
      if (def.extraElements !== undefined) {
        if (!Array.isArray(def.extraElements)) {
          errors.push(t('selectorFieldRequired', { key, field: 'extraElements' }));
        } else {
          for (const s of def.extraElements) {
            if (typeof s !== 'string' || !s.trim() || s.includes(',') || hasPseudoElement(s) || !isValidCssSelector(':scope > :nth-child(1) ' + s)) {
              errors.push(t('selectorInvalidCss', { key, field: 'extraElements', value: s }));
            }
          }
        }
      }
      if (def.disabled !== undefined && def.disabled !== null && typeof def.disabled !== 'boolean') errors.push(t('selectorInvalidBool', { key, field: 'disabled' }));
      if (def.disable !== undefined && def.disable !== null && typeof def.disable !== 'boolean') errors.push(t('selectorInvalidBool', { key, field: 'disable' }));
      if (def.disabled === true || def.disable === true) continue; if ((def.disabled === false || def.disable === false) && Object.keys(def).every(k => k === 'disabled' || k === 'disable')) continue;
      if (typeof def.match === 'string' && def.match) {
        const lit = def.match.match(/^\/(.*)\/([a-z]*)$/i); const badLit = lit ? getInvalidRegexFlags(lit[2]) : '';
        if (badLit) errors.push(t('invalidRegexFlags', { flags: badLit }));
        else { try { new RegExp(def.match); } catch (e) { errors.push(t('selectorInvalidRegex', { key })); } }
      } else if (def.match && typeof def.match === 'object' && typeof def.match.source === 'string' && def.match.source) {
        try { new RegExp(def.match.source, String(def.match.flags || '').toLowerCase().replace(/[^imsu]/g, '')); } catch (e) { errors.push(t('selectorInvalidRegex', { key })); }
        const badFlags = getInvalidRegexFlags(String(def.match.flags || '')); if (badFlags) errors.push(t('invalidRegexFlags', { flags: badFlags }));
      } else {
        errors.push(t('selectorFieldRequired', { key, field: 'match' }));
      }
      if (typeof def.containers !== 'string' || !def.containers.trim()) {
        errors.push(t('selectorFieldRequired', { key, field: 'containers' }));
      } else if (!isValidCssSelector(def.containers) || hasPseudoElement(def.containers)) {
        errors.push(t('selectorInvalidCss', { key, field: 'containers', value: def.containers }));
      }
      for (const field of ['titles', 'snippets']) {
        const value = def[field]; if (value === undefined || value === null) continue;
        if (!Array.isArray(value) && typeof value !== 'string') {
          errors.push(t('selectorFieldRequired', { key, field })); continue;
        }
        for (const s of normalizeSelectorList(value)) {
          if ((field === 'snippets' && s.includes(',')) || !isValidCssSelector(s) || hasPseudoElement(s)) errors.push(t('selectorInvalidCss', { key, field, value: s }));
        }
      }
      if (def.links === undefined || def.links === null) continue;
      if (typeof def.links === 'string') {
        if (def.links && (!isValidCssSelector(def.links) || hasPseudoElement(def.links))) errors.push(t('selectorInvalidCss', { key, field: 'links', value: def.links }));
      } else if (Array.isArray(def.links)) {
        for (const s of normalizeSelectorList(def.links)) {
          if (!isValidCssSelector(s) || hasPseudoElement(s)) errors.push(t('selectorInvalidCss', { key, field: 'links', value: s }));
        }
      } else {
        errors.push(t('selectorFieldRequired', { key, field: 'links' }));
      }
    }
    return errors;
  }

  function matchDefToParts(match) {
    if (typeof match === 'string') return { source: match, flags: '' }; if (match instanceof RegExp) return { source: match.source, flags: match.flags || '' };
    if (match && typeof match === 'object' && typeof match.source === 'string') return { source: match.source, flags: String(match.flags || '').toLowerCase() }; return { source: '', flags: '' };
  }

  function sameSelectorDef(a, b) {
    if (!a || !b) return false; if (!!a.disabled !== !!b.disabled || !!a.disable !== !!b.disable) return false; const aM = matchDefToParts(a.match); const bM = matchDefToParts(b.match); if (aM.source !== bM.source || aM.flags !== bM.flags) return false;
    if ((a.containers || '') !== (b.containers || '')) return false; const norm = (v) => JSON.stringify(normalizeSelectorList(v)); if (norm(a.titles) !== norm(b.titles)) return false;
    if (norm(a.snippets) !== norm(b.snippets)) return false; if (norm(a.extraElements) !== norm(b.extraElements)) return false; if (norm(a.links) !== norm(b.links)) return false; return true;
  }

  function diffSelectorDefFields(def, builtin) {
    const diff = {}; if (!def || typeof def !== 'object') return diff;
    if (!builtin) {
      for (const k of Object.keys(def)) diff[k] = def[k]; return diff;
    }
    if (def.match !== undefined) {
      const aM = matchDefToParts(def.match); const bM = matchDefToParts(builtin.match); if (aM.source !== bM.source || aM.flags !== bM.flags) diff.match = def.match;
    }
    if (def.containers !== undefined && (def.containers || '') !== (builtin.containers || '')) diff.containers = def.containers; const norm = (v) => JSON.stringify(normalizeSelectorList(v));
    for (const k of ['titles', 'snippets', 'extraElements', 'links']) {
      if (def[k] !== undefined && norm(def[k]) !== norm(builtin[k])) diff[k] = def[k];
    }
    return diff;
  }

  function diffUserSelectors(config) {
    const out = {}; if (!config || typeof config !== 'object' || Array.isArray(config)) return out;
    for (const key of Object.keys(config)) {
      if (key === 'other') continue; const def = config[key]; if (!def || typeof def !== 'object' || Array.isArray(def)) continue; const builtin = SELECTORS[key]; const rest = { ...def };
      if (rest.disable !== undefined) {
        if (rest.disabled === undefined) rest.disabled = rest.disable; delete rest.disable;
      }
      if (rest.disabled === true) {
        const diff = diffSelectorDefFields(rest, builtin); diff.disabled = true; out[key] = diff; continue;
      }
      if (rest.disabled === false && Object.keys(rest).every(k => k === 'disabled')) continue;
      if (!builtin) { out[key] = rest; continue; }
      const diff = diffSelectorDefFields(rest, builtin); if (Object.keys(diff).length > 0) out[key] = diff;
    }
    return out;
  }

  function pruneUserSelectors() {
    const user = getUserSelectors(); let changed = false; const next = {};
    for (const key of Object.keys(user)) {
      const def = user[key];
      if (key !== 'other' && SELECTORS[key] && sameSelectorDef(def, SELECTORS[key])) { changed = true; continue; }
      next[key] = def;
    }
    if (changed) {
      GM_setValue(SELECTORS_KEY, next); resetSelectorCache();
    }
  }

  function normalizeMatchLiteral(field, val) {
    if (field !== 'match' || typeof val !== 'string') return val;
    const m = val.match(/^\/(.*)\/([a-z]*)$/i);
    if (!m || getInvalidRegexFlags(m[2])) return val;
    return m[2] ? { source: m[1], flags: m[2].toLowerCase() } : m[1];
  }

  function parseSelectorText(text) {
    const fail = () => ({ config: null, errors: [t('selectorJsonError')] }); let s = String(text == null ? '' : text).trim(); if (!s) return fail();
    if (s.charCodeAt(0) === 123 && !/^const\s+SELECTORS\s*=/i.test(s)) {
      try {
        const parsedJson = JSON.parse(s);
        if (parsedJson && typeof parsedJson === 'object' && !Array.isArray(parsedJson)) {
          const cfg = {};
          for (const k of Object.keys(parsedJson)) {
            if (k === 'other' || k === '__proto__') continue; const def = parsedJson[k];
            if (def && typeof def === 'object' && !Array.isArray(def)) {
              const cleanDef = {};
              for (const field of Object.keys(def)) {
                if (field === '__proto__') continue; let val = def[field];
                if (field === 'match') {
                  if (typeof val === 'string') {
                    const m = val.match(/^\/(.*)\/([a-z]*)$/i);
                    if (m) {
                      if (m[2] && getInvalidRegexFlags(m[2])) return { config: null, errors: [t('invalidRegexFlags', { flags: m[2] })] };
                      cleanDef[field] = m[2] ? { source: m[1], flags: m[2].toLowerCase() } : m[1];
                    } else {
                      cleanDef[field] = val;
                    }
                  } else if (val && typeof val === 'object' && typeof val.source === 'string') {
                    if (val.flags && getInvalidRegexFlags(val.flags)) return { config: null, errors: [t('invalidRegexFlags', { flags: val.flags })] };
                    cleanDef[field] = val.flags ? { source: val.source, flags: String(val.flags).toLowerCase() } : val.source;
                  } else {
                    cleanDef[field] = val;
                  }
                } else {
                  cleanDef[field] = val;
                }
              }
              cfg[k] = cleanDef;
            } else cfg[k] = def;
          }
          if (!Object.keys(cfg).length && Object.keys(parsedJson).length) return fail();
          return { config: cfg, errors: [] };
        }
      } catch (eJson) {}
    }
    s = s.replace(/^const\s+SELECTORS\s*=\s*/i, '').replace(/;\s*$/, '').trim(); if (s.startsWith('{') && s.endsWith('}')) s = s.slice(1, -1); const n = s.length; let i = 0;
    const skipWs = () => { while (i < n && /\s/.test(s[i])) i++; };
    const readString = () => {
      const quote = s[i]; let j = i + 1, val = '';
      while (j < n) {
        const ch = s[j];
        if (ch === '\\') {
          const nx = s[j + 1];
          if (nx === '\\') { val += '\\'; j += 2; continue; }
          if (nx === quote) { val += quote; j += 2; continue; }
          if (nx === 'n') { val += '\n'; j += 2; continue; }
          if (nx === 'r') { val += '\r'; j += 2; continue; }
          if (nx === 't') { val += '\t'; j += 2; continue; }
          if (nx === 'u' && /^[0-9a-fA-F]{4}/.test(s.slice(j + 2, j + 6))) {
            val += String.fromCharCode(parseInt(s.slice(j + 2, j + 6), 16)); j += 6; continue;
          }
          if (nx === 'x' && /^[0-9a-fA-F]{2}/.test(s.slice(j + 2, j + 4))) {
            val += String.fromCharCode(parseInt(s.slice(j + 2, j + 4), 16)); j += 4; continue;
          }
          val += ch + (nx || ''); j += 2; continue;
        }
        if (ch === quote) { i = j + 1; return val; }
        val += ch; j++;
      }
      return null;
    };
    const config = {}; let keyCount = 0;
    const readKey = () => {
      if (s[i] === '\'' || s[i] === '"') return readString(); const m = /^[A-Za-z_$][\w$-]*/.exec(s.slice(i)); if (!m) return null; i += m[0].length; return m[0];
    };
    while (true) {
      skipWs(); if (i >= n) break;
      if (s[i] === ',' || s[i] === ';') { i++; continue; }
      const key = readKey(); if (key === null) return fail(); skipWs(); if (s[i] !== ':') return fail(); i++; skipWs(); if (s[i] !== '{') return fail(); i++; const def = {};
      while (true) {
        skipWs(); if (i >= n) return fail();
        if (s[i] === ',') { i++; continue; }
        if (s[i] === '}') { i++; break; }
        const field = readKey(); if (field === null) return fail(); skipWs(); if (s[i] !== ':') return fail(); i++; skipWs();
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
          if (!closed) return fail(); let k = j; while (k < n && /[a-z]/i.test(s[k])) k++; const flags = s.slice(j, k);
          if (flags && getInvalidRegexFlags(flags)) return { config: null, errors: [t('invalidRegexFlags', { flags })] }; i = k; if (field !== 'match') return fail();
          def[field] = flags ? { source: src, flags: flags.toLowerCase() } : src;
        } else if (s[i] === '\'' || s[i] === '"') {
          const val = readString(); if (val === null) return fail(); def[field] = normalizeMatchLiteral(field, val);
        } else if (s[i] === '[') {
          i++; const arr = [];
          while (true) {
            skipWs(); if (i >= n) return fail();
            if (s[i] === ',') { i++; continue; }
            if (s[i] === ']') { i++; break; }
            if (s[i] === '\'' || s[i] === '"') {
              const val = readString(); if (val === null) return fail(); arr.push(val);
            } else return fail();
          }
          def[field] = arr;
        } else if (s.startsWith('true', i) && !/[\w$]/.test(s[i + 4] || '')) {
          def[field] = true; i += 4;
        } else if (s.startsWith('false', i) && !/[\w$]/.test(s[i + 5] || '')) {
          def[field] = false; i += 5;
        } else return fail();
      }
      keyCount++; if (key === 'other' || key === '__proto__') continue; config[key] = def;
    }
    if (keyCount && !Object.keys(config).length) return fail();
    return { config, errors: [] };
  }

  function pickTextFile(accept, onLoaded) {
    preventPanelClose = true; const fileInput = document.createElement('input'); fileInput.type = 'file'; fileInput.accept = accept; fileInput.style.display = 'none';
    document.body.appendChild(fileInput);

    let cleanedUp = false;
    const cleanup = () => {
      if (cleanedUp) return; cleanedUp = true; window.removeEventListener('focus', onWindowFocus); fileInput.remove(); preventPanelClose = false;
    };
    const onWindowFocus = () => {
      setTimeout(() => {
        if (!fileInput.files || fileInput.files.length === 0) cleanup();
      }, 300);
    };

    fileInput.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) {
        cleanup(); return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        onLoaded(String(ev.target.result || '')); cleanup();
      };
      reader.onerror = () => {
        showToast(t('subImportFailed'), 'error'); cleanup();
      };
      reader.readAsText(file, 'UTF-8');
    };
    fileInput.addEventListener('cancel', cleanup); window.addEventListener('focus', onWindowFocus); fileInput.click();
  }

  function importSelectorsFromFile(textarea, onLoaded) {
    pickTextFile('.js,.json,application/javascript,application/json', (content) => {
      textarea.value = content; if (onLoaded) onLoaded();
    });
  }

  function showSelectorPanel() {
    hideStatsPanel();
    const opened = openPanel('serh-selector-panel');
    if (!opened) return;
    const { panel, closePanel } = opened;
    panel.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                <h3 style="margin:0;font-size:14px;line-height:1.2;">${t('selectorPanelTitle')}</h3>
                <div style="display:flex;align-items:center;gap:6px;">
                    <button id="serh-selector-import" class="serh-button serh-button-secondary" style="padding: 3px 8px; border: 1px solid transparent;">${t('import')}</button>
                    <button id="serh-selector-export" class="serh-button serh-button-success" style="padding: 3px 8px; border: 1px solid transparent;">${t('export')}</button>
                </div>
            </div>
            <div style="font-size:11px;color:#718096;margin-bottom:6px;">${t('selectorHint')}</div>
            <div class="serh-rules-container" style="height:255px;">
                <div id="serh-sel-line-numbers"></div>
                <textarea id="serh-sel-rules" spellcheck="false" wrap="off">${escHtml(serializeSelectors())}</textarea>
            </div>
            <div style="display:flex;gap:6px;margin-top:8px;">
                <button id="serh-selector-save" class="serh-button serh-button-primary serh-action-button" style="flex:2;">${t('save')}</button>
                <button id="serh-selector-reset" class="serh-button serh-button-danger serh-action-button" style="flex:1;">${t('hlColorReset')}</button>
                <button id="serh-selector-cancel" class="serh-button serh-button-secondary serh-action-button" style="flex:1;">${t('cancel')}</button>
            </div>
        `;

    const textarea = document.getElementById('serh-sel-rules'); const lineNums = document.getElementById('serh-sel-line-numbers');
    updateLineNumbers('selectors');

    textarea.addEventListener('input', () => scheduleLineNumbersUpdate('selectors'));
    textarea.addEventListener('scroll', () => {
      lineNums.scrollTop = textarea.scrollTop;
    });
    setupBracketHighlight(textarea, 'js');

    const applyUserSelectors = (config) => {
      GM_setValue(SELECTORS_KEY, diffUserSelectors(config)); _selectorStoreSignature = getSelectorStoreSignature(); resetSelectorCache(); refreshEngineSite();
    };

    const showError = (messages) => {
      if (!messages || !messages.length) return; showToast(messages.join('\n'), 'error', 5000);
    };

    document.getElementById('serh-selector-import').onclick = () => {
      importSelectorsFromFile(textarea, () => {
        showError([]); updateLineNumbers('selectors');
      });
    };

    document.getElementById('serh-selector-export').onclick = () => {
      preventPanelClose = true; const content = textarea.value;
      if (!content.trim()) {
        preventPanelClose = false; showToast(t('noRulesExport'), 'error'); return;
      }
      downloadTextFile(timestampFilename('selectors', 'js'), content, 'application/json;charset=utf-8'); preventPanelClose = false;
    };

    document.getElementById('serh-selector-save').onclick = () => {
      const parsed = parseSelectorText(textarea.value);
      if (!parsed.config || parsed.errors.length) {
        showError(parsed.errors.length ? parsed.errors : [t('selectorJsonError')]); return;
      }
      const errors = validateUserSelectors(parsed.config);
      if (errors.length) {
        showError(errors); return;
      }
      applyUserSelectors(parsed.config); showToast(t('saved'), 'success');
    };

    document.getElementById('serh-selector-reset').onclick = () => {
      textarea.value = serializeSelectors(SELECTORS); showError([]); updateLineNumbers('selectors'); showToast(t('resetPending'), 'success');
    };

    document.getElementById('serh-selector-cancel').onclick = (e) => {
      e.stopPropagation(); closePanel();
    };
  }

  function parseSyncHeader(content) {
    const lines = String(content || '').replace(/^\uFEFF/, '').split('\n'); let config = null; let selectors = null; let rawScriptConfig = null; let rawSelectors = null;
    const selectorPatchOk = (v) => {
      if (Array.isArray(v)) return true; if (!v || typeof v !== 'object') return false;
      const flagsOk = (f) => { f = String(f || '').toLowerCase(); return /^[imsu]*$/.test(f) && new Set(f).size === f.length; };
      const probe = (s) => { if (typeof document === 'undefined' || typeof document.querySelector !== 'function') return true; try { document.querySelector(s); return true; } catch (e) { return false; } };
      const cssOk = (val) => { const list = typeof val === 'string' ? [val] : val; return Array.isArray(list) && list.every((s) => typeof s === 'string' && !!s.trim() && probe(s)); };
      const reOk = (val) => {
        if (typeof val === 'string') { const lit = val.match(/^\/(.*)\/([a-z]*)$/i); if (lit && !flagsOk(lit[2])) return false; try { new RegExp(val); return true; } catch (e) { return false; } }
        if (val && typeof val === 'object' && typeof val.source === 'string' && flagsOk(val.flags)) { try { new RegExp(val.source, String(val.flags || '').toLowerCase()); return true; } catch (e) { return false; } }
        return false;
      };
      for (const key of Object.keys(v)) {
        const def = v[key];
        if (key === 'other' || !/^[A-Za-z0-9_-]+$/.test(key)) return false;
        if (!def || typeof def !== 'object' || Array.isArray(def)) return false;
        if ((def.disabled !== undefined && def.disabled !== null && typeof def.disabled !== 'boolean') || (def.disable !== undefined && def.disable !== null && typeof def.disable !== 'boolean')) return false;
        if (def.extraElements !== undefined && def.extraElements !== null && (!Array.isArray(def.extraElements) || !def.extraElements.every((s) => typeof s === 'string' && !!s.trim() && !s.includes(',') && probe(':scope > :nth-child(1) ' + s)))) return false;
        if (def.match !== undefined && def.match !== null && !reOk(def.match)) return false;
        for (const f of ['containers', 'titles', 'snippets', 'links']) if (def[f] !== undefined && def[f] !== null && !cssOk(def[f])) return false;
      }
      return true;
    };
    const headerLineIndexes = new Set();

    for (let i = 0; i < Math.min(lines.length, 10); i++) {
      const line = lines[i]; if (!line.trim()) continue;
      if (line.startsWith('# ScriptConfig:')) {
        const payload = line.substring('# ScriptConfig:'.length).trim(); let parsed = null;
        if (/^[\x7B\x5B]/.test(payload)) {
          try { parsed = JSON.parse(payload); } catch (e) { if (typeof currentConfig !== 'undefined' && currentConfig.debug) console.warn('[配置头] 配置头解析失败:', e); }
        }
        if (parsed && !config) { config = parsed; rawScriptConfig = line; headerLineIndexes.add(i); } else if (payload.startsWith('\x7B') && !config) headerLineIndexes.add(i);
      } else if (line.startsWith('# Selectors:')) {
        const payload = line.substring('# Selectors:'.length).trim(); let parsed = null;
        if (/^[\x7B\x5B]/.test(payload)) {
          try { parsed = JSON.parse(payload); } catch (e) { if (typeof currentConfig !== 'undefined' && currentConfig.debug) console.warn('[配置头] 选择器头解析失败:', e); }
        }
        if (parsed && !selectors && selectorPatchOk(parsed)) { selectors = parsed; rawSelectors = line; headerLineIndexes.add(i); } else if (payload.startsWith('\x7B') && !selectors) headerLineIndexes.add(i);
      } else if (!line.startsWith('#')) {
        break;
      }
    }

    if (config && selectors && !config.selectors) {
      config.selectors = selectors;
    } else if (!config && selectors) {
      config = { selectors };
    }
    if (config && config.selectors !== undefined && !selectorPatchOk(config.selectors)) delete config.selectors;

    const restLines = lines.filter((_, idx) => !headerLineIndexes.has(idx)); return { config, rawScriptConfig, rawSelectors, restLines };
  }

  function timestampFilename(prefix, ext) {
    const d = new Date(), pad = (n) => String(n).padStart(2, '0');
    return `${prefix}-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.${ext}`;
  }

  function downloadTextFile(filename, content, mime) {
    const blob = new Blob([content], { type: mime }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a);
    a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  function importRulesFromFile() {
    pickTextFile('.txt,text/plain', (content) => {
      const parsedHeader = parseSyncHeader(content);
      const headerConfig = parsedHeader.config;
      if (headerConfig && typeof headerConfig === 'object' && !Array.isArray(headerConfig)) {
        const headerSelectors = parsedHeader.rawSelectors ? headerConfig.selectors : null;
        if (headerSelectors && typeof headerSelectors === 'object' && !Array.isArray(headerSelectors)) {
          GM_setValue(SELECTORS_KEY, headerSelectors); _selectorStoreSignature = getSelectorStoreSignature(); resetSelectorCache(); refreshEngineSite();
        }
        const settings = getSyncSettings(headerConfig);
        if (Object.keys(settings).length > 0) {
          const next = Object.assign({}, currentConfig); const colors = settings.highlightColors;
          if (colors && typeof colors === 'object' && !Array.isArray(colors)) settings.highlightColors = Object.assign({}, currentConfig.highlightColors, colors);
          Object.assign(next, settings); next.rules = currentConfig.rules || []; next.bubbleState = currentConfig.bubbleState; next.bubbleSize = currentConfig.bubbleSize;
          currentConfig = normalizeConfig(next);
        }
      }
      const textarea = document.getElementById('serh-rules');
      if (textarea) {
        textarea.value = parsedHeader.restLines.join('\n'); updateLineNumbers();
      }
      currentConfig.rules = filterValidRuleLines(parsedHeader.restLines);
      const panel = document.getElementById('serh-panel'); if (panel) panel._initialRules = [...currentConfig.rules];
      persistConfig(true); applyConfigToMainPanel(); forceReprocessAll();
    });
  }

  function exportRulesToFile() {
    preventPanelClose = true; const textarea = document.getElementById('serh-rules'); let content = textarea.value;
    if (!content.trim()) {
      alert(t('noRulesExport')); preventPanelClose = false; return;
    }
    if (currentConfig.exportConfig === true) {
      content = '# ScriptConfig:' + JSON.stringify(getSyncSettings(currentConfig)) + '\n' + content;
    }
    downloadTextFile(timestampFilename('rules', 'txt'), content, 'text/plain;charset=utf-8'); preventPanelClose = false;
  }

  let _menuCommandIds = [];
  function registerMenu() {
    _menuCommandIds.forEach(id => { try { GM_unregisterMenuCommand(id); } catch (e) {} }); _menuCommandIds = [];
    _menuCommandIds.push(GM_registerMenuCommand(t('menuOpenPanel'), () => showConfigPanel()));
    _menuCommandIds.push(GM_registerMenuCommand(t('menuCustomSelectors'), showSelectorPanel));
    _menuCommandIds.push(GM_registerMenuCommand(t('menuHighlightColor'), () => showHighlightColorPanel()));
  }

  function ensureEngineSiteSetup() {
    if (_engineSiteSetup || !isEngineSite()) return; _engineSiteSetup = true; injectGlobalStyles(); buildRuleIndex(); exposeDebugApi(); updateStatus(0); scanNewResults();

    let _pendingRecords = []; let _mutationRafPending = false;
    const flushMutations = () => {
      _mutationRafPending = false; const records = _pendingRecords; _pendingRecords = []; if (!records.length || !_engineSiteSetup) return; if (_domObserver) _domObserver.disconnect();
      try {
        const selector = getContainerSelector(getSearchEngine());
        for (const m of records) {
          let node = null;
          if (m.type === 'attributes') {
            if (m.attributeName !== 'href') continue; node = m.target;
          } else if (m.type === 'childList') {
            if (!m.addedNodes || !m.addedNodes.length) continue; node = m.target;
          } else if (m.type === 'characterData') {
            node = m.target ? m.target.parentElement : null;
          } else {
            continue;
          }
          if (!node || typeof node.closest !== 'function' || !selector) continue; let container = null;
          try { container = node.closest(selector); } catch (e) { container = null; }
          if (!container) continue;
          if (m.type === 'attributes') {
            _hrefChangedContainers.add(container);
          } else if (container.hasAttribute('data-blocker-processed')) {
            _contentChangedContainers.add(container);
          }
        }
        let statusDirty = false;
        if (_hrefChangedContainers.size) {
          for (const container of _hrefChangedContainers) {
            if (!container.isConnected) continue; const cachedUrl = _hrefUrlCache.get(container); const currentUrl = peekResultUrl(container);
            if (cachedUrl !== undefined && cachedUrl === currentUrl) continue; reprocessContainer(container); statusDirty = true;
          }
          _hrefChangedContainers.clear();
        }
        if (_contentChangedContainers.size) {
          for (const container of _contentChangedContainers) {
            if (!container.isConnected) continue; if (!container.hasAttribute('data-blocker-processed')) continue; const cachedSig = _resultContentCache.get(container);
            const currentSig = getResultContentSignature(container); if (currentSig === null || cachedSig === currentSig) continue; reprocessContainer(container); statusDirty = true;
          }
          _contentChangedContainers.clear();
        }
        if (statusDirty) {
          updateStatus(document.querySelectorAll('[data-is-blocked="true"]').length);
        }
        const hasAddedNodes = records.some(m => m.type === 'childList' && m.addedNodes.length > 0); if (hasAddedNodes) scanNewResults();
      } finally {
        if (_engineSiteSetup && _domObserver) {
          _domObserver.observe(document.body, {
            childList: true,
            attributes: true,
            attributeFilter: ['href'],
            characterData: true,
            subtree: true
          });
        }
      }
    };
    _domObserver = new MutationObserver((records) => {
      if (!_mutationRafPending) {
        _mutationRafPending = true; requestAnimationFrame(flushMutations);
      }
      _pendingRecords = _pendingRecords.concat(records);
    });
    _domObserver.observe(document.body, {
      childList: true,
      attributes: true,
      attributeFilter: ['href'],
      characterData: true,
      subtree: true
    });

    const searchForm = document.querySelector('form[role="search"], form[name="search"], form[action*="search"]');
    if (searchForm) {
      _searchForm = searchForm; _searchFormHandler = () => setTimeout(forceReprocessAll, 800); searchForm.addEventListener('submit', _searchFormHandler);
    }

    if (!_urlChangeHandler) {
      let lastHref = location.href; let lastCategory = getSearchCategory();
      _urlChangeHandler = () => {
        const currentHref = location.href; const currentCat = getSearchCategory();
        if (currentHref !== lastHref || currentCat !== lastCategory) {
          lastHref = currentHref; lastCategory = currentCat; resetSelectorCache(); refreshEngineSite();
        }
      };
      window.addEventListener('popstate', _urlChangeHandler); window.addEventListener('hashchange', _urlChangeHandler);

      const wrapHistoryMethod = (method) => {
        const orig = history[method];
        if (typeof orig === 'function') {
          history[method] = function(...args) {
            const ret = orig.apply(this, args);
            try {
              window.dispatchEvent(new Event('serh:locationchange'));
            } catch (e) {}
            return ret;
          };
        }
      };
      wrapHistoryMethod('pushState'); wrapHistoryMethod('replaceState'); window.addEventListener('serh:locationchange', _urlChangeHandler);
    }
  }

  function teardownEngineSite() {
    if (!_engineSiteSetup) return; _engineSiteSetup = false; forceReprocessBatchId++;
    if (_domObserver) {
      _domObserver.disconnect(); _domObserver = null;
    }
    _hrefUrlCache = new WeakMap(); _hrefChangedContainers.clear(); _resultContentCache = new WeakMap(); _resultRetryCounts = new WeakMap(); _contentChangedContainers.clear();
    if (_searchForm && _searchFormHandler) {
      _searchForm.removeEventListener('submit', _searchFormHandler);
    }
    _searchForm = null; _searchFormHandler = null; document.querySelectorAll('.serh-quick-block').forEach(btn => btn.remove());
    const confirmPanel = document.getElementById('serh-block-confirm-dialog'); if (confirmPanel) confirmPanel.remove(); if (_blockConfirmOutsideHandler) { document.removeEventListener('click', _blockConfirmOutsideHandler, true); _blockConfirmOutsideHandler = null; } restoreAllHiddenParents();
    document.querySelectorAll('[data-observed]').forEach(el => {
      resultObserver.unobserve(el); el.removeAttribute('data-observed'); resetResultStyles(el);
    });
    showHiddenResults = false; _observedSelector = ''; const status = document.getElementById('serh-status'); if (status) status.remove(); removeGlobalStyles();
  }

  function refreshEngineSite() {
    const wasEngine = _engineSiteSetup;
    if (isEngineSite()) {
      ensureEngineSiteSetup(); if (wasEngine) injectGlobalStyles(); forceReprocessAll();
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
    const signature = getSelectorStoreSignature(); if (signature === null) return false; if (_selectorStoreSignature === signature) return false; const isBaseline = _selectorStoreSignature === null;
    _selectorStoreSignature = signature; if (isBaseline) return false; resetSelectorCache(); refreshEngineSite(); return true;
  }

  function adoptStoredConfigIfNewer() {
    const stored = GM_getValue(CONFIG_KEY); if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return false;
    normalizeConfig(stored);
    try {
      if (JSON.stringify(stored) === JSON.stringify(currentConfig)) return false;
    } catch (e) {
      return false;
    }
    currentConfig = stored; return true;
  }

  function checkExternalConfigChange() {
    if (document.getElementById('serh-panel')) return false; if (!adoptStoredConfigIfNewer()) return false; applyCollapseMode(); forceReprocessAll(); return true;
  }

  function init() {
    applyDarkModeClass(); applyCollapseMode(); pruneUserSelectors(); _selectorStoreSignature = getSelectorStoreSignature();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        checkExternalSelectorChange(); checkExternalConfigChange();
      }
    });

    registerMenu();
    exposeDebugApi();
    if (isEngineSite()) {
      try {
        ensureEngineSiteSetup();
      } catch (e) {
        console.error('[屏蔽] 引擎站点装配失败:', e);
      }
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else setTimeout(init, 1000);
})();
