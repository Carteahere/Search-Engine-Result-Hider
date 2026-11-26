// ==UserScript==
// @name         搜索引擎结果屏蔽器
// @name:zh-CN   搜索引擎结果屏蔽器
// @name:en      Search Engine Result Hider
// @namespace    https://github.com/Carteahere
// @version      8.9.3
// @description        支持正则的搜索结果屏蔽工具。
// @description:zh-CN  支持正则的搜索结果屏蔽工具。
// @description:en     A search result blocking tool that supports regular expressions.
// @icon         data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjQgNCAxNiAxNiIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjMmM1MjgyIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgc3R5bGU9Im92ZXJmbG93OnZpc2libGUhaW1wb3J0YW50OyI+PGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iNyI+PC9jaXJjbGU+PGxpbmUgeDE9IjcuNDUiIHkxPSI3LjQ1IiB4Mj0iMTYuNTUiIHkyPSIxNi41NSI+PC9saW5lPjwvc3ZnPg==
// @author       南雪莲
// @homepageURL  https://greasyfork.org/zh-CN/scripts/552394
// @homepageURL  https://github.com/Carteahere/Search-Engine-Result-Hider
// @license      GPL-3.0
// @match        *://*/*
// @connect      *
// @noframes
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @grant        GM_deleteValue
// @run-at       document-idle
// @downloadURL  https://raw.githubusercontent.com/Carteahere/Search-Engine-Result-Hider/main/Search-Engine-Result-Hider_autoupdate.user.js
// @updateURL    https://raw.githubusercontent.com/Carteahere/Search-Engine-Result-Hider/main/Search-Engine-Result-Hider_autoupdate.user.js
// ==/UserScript==

(function() {
  'use strict';

  if (window.top !== window.self) return; let preventPanelClose = false, _engineSiteSetup = false, _domObserver = null, _observedBody = null, _observedSelector = '';
  let _searchForm = null, _searchFormHandler = null, _urlChangeHandler = null, _panelCloseHandler = null, _panelPressHandler = null, _panelCloseTimer = null, _syncIntervalIds = [];
  let _hrefUrlCache = new WeakMap(), _resultContentCache = new WeakMap(), _resultRetryCounts = new WeakMap(), _peekUrlCache = new WeakMap();
  const _hrefChangedContainers = new Set(), _contentChangedContainers = new Set();
  let _pendingSubRefresh = false;
  let _exportPick = { rules: true, subscription: false, engine: false, settings: false }, _exportMenuHandler = null;

  // 配置
  const CONFIG_KEY = 'searchfilter_blocker', WEBDAV_KEY = 'searchfilter_webdav', SELECTORS_KEY = 'searchfilter_selectors', EXPORT_PICK_KEY = 'searchfilter_export_pick';
  const SUBSCRIPTION_URL_KEY = 'searchfilter_subscription_url', SUBSCRIPTION_LAST_UPDATE_KEY = 'searchfilter_subscription_last_update', SUB_VERSION_KEY = 'searchfilter_sub_version';
  const SUBSCRIPTION_RULES_KEY = 'searchfilter_subscription_rules', SUBSCRIPTIONS_KEY = 'searchfilter_subscriptions';
  const WEBDAV_LAST_SYNC_KEY = 'searchfilter_webdav_last_sync', LOCAL_LAST_MODIFIED_KEY = 'searchfilter_local_last_modified', WEBDAV_DIRTY_KEY = 'searchfilter_webdav_dirty', WEBDAV_RETRY_COUNT_KEY = 'searchfilter_webdav_retry_count';
  const SETTINGS_LAST_MODIFIED_KEY = 'searchfilter_settings_last_modified', SELECTORS_LAST_MODIFIED_KEY = 'searchfilter_selectors_last_modified', SETTINGS_TIME_MIGRATED_KEY = 'searchfilter_settings_time_migrated';
  const WEBDAV_AUTO_SYNC_KEY = 'searchfilter_webdav_auto_sync', WEBDAV_SYNC_CONFIG_KEY = 'searchfilter_webdav_sync_config';
  const WEBDAV_SYNC_SNAPSHOT_KEY = 'searchfilter_webdav_sync_snapshot', ENGINE_SUBSCRIPTIONS_KEY = 'searchfilter_engine_subscriptions';
  const BUILTIN_ENGINE_SUB_URL = 'https://raw.githubusercontent.com/Carteahere/Search-Engine-Result-Hider/main/Other/Selectors.js';
  const SUBSCRIPTION_SYNC_SNAPSHOT_KEY = 'searchfilter_subscription_sync_snapshot'; const ENGINE_SUBS_SYNC_SNAPSHOT_KEY = 'searchfilter_engine_subs_sync_snapshot'; const WEBDAV_LAST_SYNC_SELECTORS_KEY = 'searchfilter_webdav_last_sync_selectors'; const HL_STATS_REGEX = /^@\d+/;
  const AUTO_UPDATE_INTERVAL = 12 * 60 * 60 * 1000, WEBDAV_AUTO_SYNC_INTERVAL = 1 * 60 * 60 * 1000, AUTO_SYNC_TOLERANCE = 60 * 1000;
  const WEBDAV_SYNC_MAX_RETRIES = 3, WEBDAV_SYNC_RETRY_DELAY = 2000, WEBDAV_TIME_TOLERANCE = 5 * 60 * 1000; const NET_TIME_CACHE_TTL = 30 * 60 * 1000, NET_TIME_FAIL_TTL = 10 * 60 * 1000, WEBDAV_CLOCK_CACHE_TTL = 24 * 60 * 60 * 1000;
  const RESULT_RETRY_LIMIT = 3, RESULT_RETRY_DELAY = 200;
  const GRID_HIDE_ATTR = 'data-serh-grid-item-hidden', GROUP_HIDE_ATTR = 'data-serh-group-hidden';
  let _hideNamesCache = null;

  const CFG_DEFAULTS = { enabled: true, showBlockBtn: false, blockDomain: false, blockConfirm: true, showMatchedSource: true, showBubble: true, panelCentered: true, bubbleAction: 'openPanel', uiScale: 'l', darkMode: 'system', collapseMode: false, highlightWhitelist: false, removeRedirects: true, showSubBtn: true, showSyncBtn: true, bracketHighlight: true, timeCalibration: true, language: 'zh-CN', subscriptionAutoUpdate: true, engineSubAutoUpdate: true };
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
    if (typeof cfg.bubbleSize !== 'number' || !Number.isFinite(cfg.bubbleSize)) { const size = parseInt(cfg.bubbleSize, 10); cfg.bubbleSize = Number.isFinite(size) ? size : 30; }
    if (cfg.bubbleSize < 20) cfg.bubbleSize = 30;
    for (const k in CFG_DEFAULTS) if (cfg[k] === undefined || cfg[k] === null) cfg[k] = CFG_DEFAULTS[k];
    if (!cfg.highlightColors || typeof cfg.highlightColors !== 'object') cfg.highlightColors = {...DEFAULT_HIGHLIGHT_COLORS};
    else { const colors = {...DEFAULT_HIGHLIGHT_COLORS}; for (let i = 1; i <= 5; i++) { if (/^#[0-9A-Fa-f]{6}$/.test(String(cfg.highlightColors[i] || ''))) colors[i] = String(cfg.highlightColors[i]).toUpperCase(); } cfg.highlightColors = colors; }
    return cfg;
  }
  let currentConfig = normalizeConfig(GM_getValue(CONFIG_KEY, getDefaultConfig()));
  ['searchfilter_webdav_pending', 'searchfilter_rule_tombstones', 'searchfilter_subscription_tombstones', 'searchfilter_rule_added_times'].forEach(k => {
    if (typeof GM_deleteValue === 'function') GM_deleteValue(k);
  });
  if (!GM_getValue(SETTINGS_TIME_MIGRATED_KEY, false)) {
    const legacyTime = GM_getValue(LOCAL_LAST_MODIFIED_KEY, 0);
    if (typeof legacyTime === 'number' && Number.isFinite(legacyTime) && legacyTime > 0) GM_setValue(SETTINGS_LAST_MODIFIED_KEY, legacyTime);
    GM_setValue(SETTINGS_TIME_MIGRATED_KEY, true);
  }
  if (currentConfig && typeof currentConfig === 'object') {
    delete currentConfig.tombstones; delete currentConfig.ruleAddedTimes; delete currentConfig.subscriptionTombstones; delete currentConfig.exportConfig;
  }
  let showHiddenResults = false;
  let _rulesRevision = 0, _rulesFingerprint = JSON.stringify(currentConfig.rules || []);

  // 选择器
  const SELECTORS = {
    bing: {
      includeRegex: /^https?:\/\/(?:(?:www[2-4]?|cn|global|m)\.)?bing\.(?:com|[a-z]{2,3}(?:\.[a-z]{2})?)(?::\d+)?(?:[/?#]|$)/i,
      root: 'li.b_algo, div.b_algo',
      url: ['or', [['rejectOpaqueRedirect', ['attribute', 'href', 'a:has(> h2)[href], .b_algoheader a[href], h2 a[href]']], ['normalizeUrl', ['rejectEngineHost', ['regexSubstitute', /^[\s\S]*?((?:[\p{L}\p{N}][\p{L}\p{N}_-]*\.)+\p{L}{2,})[\s\S]*$/u, 'https://$1', ['text', '.b_attribution, .b_algoheader cite, cite']]]], ['attribute', 'href', 'a:has(> h2)[href], .b_algoheader a[href], h2 a[href]']]],
      title: ['or', [['text', 'h2 a'], ['text', 'a h2'], ['text', '.b_title'], ['text', '.mc_vtvc_title'], ['text', 'a.title']]],
      snippet: ['or', [['text', '.b_caption p'], ['text', '.b_snippet'], ['text', '.b_paractl p'], ['text', '.b_lineclamp2'], ['text', '.mc_vtvc_meta'], ['text', '.snippet']]],
      button: { inset: { top: '10px', right: '5px' } },
      command: { link: { redirects: [{ path: /^\/ck\/a/, params: ['u'], codec: 'base64url', stripPrefix: /^a[01]/i }] } },
      pages: {
        images: {
          includeRegex: /^https?:\/\/images\.|^https?:\/\/[^/?#]+\/images(?:[/?#]|$)/i,
          button: false,
          root: 'li:has(div.iuscp), div.iuscp, div.imgpt',
          url: ['or', [['jsonPath', 'purl', ['attribute', 'm', 'a.iusc']], ['jsonPath', 'murl', ['attribute', 'm', 'a.iusc']], ['attribute', 'href', 'a[href]']]],
          title: ['or', [['jsonPath', 't', ['attribute', 'm', 'a.iusc']], ['attribute', 'alt', 'img[alt]']]],
          command: { grid: { cell: 'li', items: ['div.iuscp, div.imgpt'], has: 'a.iusc', deepest: true }, dedupeBy: 'a.iusc' }
        },
        videos: {
          includeRegex: /^https?:\/\/[^/?#]+\/videos?(?:[/?#]|$)/i,
          root: 'div.mc_vtvc',
          url: ['or', [['attribute', 'ourl', '[ourl]'], ['attribute', 'href', 'a.mc_vtvc_link[href]'], ['attribute', 'href', 'a[href]']]],
          title: ['text', '.mc_vtvc_title'],
        },
        news: {
          includeRegex: /^https?:\/\/[^/?#]+\/news(?:[/?#]|$)/i,
          root: 'div.news-card, .newscard',
          url: ['or', [['attribute', 'href', 'a.title[href]'], ['attribute', 'data-url', '[data-url]'], ['attribute', 'url', '[url]'], ['attribute', 'href', 'a[href]']]],
          title: ['text', 'a.title'],
        }
      },
    },
    google_scholar: {
      includeRegex: /^https?:\/\/(?:www\.)?scholar\.google\.(?:[a-z]{2,3}(?:\.[a-z]{2})?|[a-z]{4,})(?::\d+)?(?:[/?#]|$)/i,
      priority: 10,
      root: 'div.gs_r.gs_or.gs_scl',
      url: ['or', [['attribute', 'href', 'h3.gs_rt a[href]'], ['attribute', 'href', 'a[href]']]],
      title: ['or', [['text', 'h3.gs_rt a'], ['text', 'h3.gs_rt'], ['text', '.gs_rt']]],
      snippet: ['text', '.gs_rs'],
      command: { link: { redirects: [{ path: /\/scholar_url\/?$/, params: ['url'], codec: 'url' }] } },
    },
    google: {
      includeRegex: /^https?:\/\/(?:(?:www|images|video|videos|search|encrypted|m)\.)?google\.(?:[a-z]{2,3}(?:\.[a-z]{2})?|[a-z]{4,})(?::\d+)?\//i,
      excludeRegex: /^https?:\/\/[^/]+\/(?!(?:search|webhp|imghp|videohp)(?:[/?#]|$)|[?#]|$)/i,
      root: 'div.g, div.MjjYud:not(:has(#m-x-content)):not(:has(span.mgAbYb)):has(a[href])',
      url: ['or', [['rejectOpaqueRedirect', ['attribute', 'href', 'a[href]']], ['rejectEngineHost', ['regexSubstitute', /^[\s\S]*?((?:[\p{L}\p{N}][\p{L}\p{N}_-]*\.)+\p{L}{2,})[\s\S]*$/u, 'https://$1', ['text', '.lJQCTe, .XVWGNd, .R8BTeb, span.ob9lvb, .eip8Bb']]], ['rejectEngineHost', ['regexSubstitute', /^[\s\S]*?((?:[\p{L}\p{N}][\p{L}\p{N}_-]*\.)+\p{L}{2,})[\s\S]*$/u, 'https://$1', ['text', 'cite']]], ['attribute', 'href', 'a[href]']]],
      title: ['or', [['text', 'h3'], ['text', 'div[role="heading"]'], ['text', '.LC20lb'], ['text', '.DKV0Md'], ['text', '.sXLaOe'], ['text', '.c9DxTc'], ['text', 'a h3']]],
      snippet: ['or', [['text', '.st'], ['text', '.VwiC3b'], ['text', '.s3v9rd'], ['text', '.IsZvec'], ['text', '.lyLwlc'], ['text', '.yXK7lf'], ['text', '.ITZIwc']]],
      button: { scope: '#center_col', require: 'h3', requireSelf: 'g-img, .isv-r, .ivg-i', exclude: 'g-scrolling-carousel, #hdtb, #appbar, #searchform, #top_nav, #extabar, .isv-r, .ivg-i, .image-section, g-img, .is-extra-container' },
      command: {
        skip: '.sys_algo_rs, .AlsoTry_M, [data-yga*="sugg"]',
        group: { container: 'div.MjjYud', members: 'div.g, div.tF2Cxc, div.MjjYud' },
        preserveSpace: { container: '#rcnt, #rso' },
        blockedCss: ['.g.serh-blocked-visible, .MjjYud.serh-blocked-visible { background-color: var(--serh-blocked-bg) !important; border-radius: 8px !important; padding: 8px !important; transition: background 0.2s; }', '.serh-blocked-visible .yuRUbf, .serh-blocked-visible div[data-sokoban-container], .serh-blocked-visible div[data-snc] { background-color: transparent !important; background: transparent !important; background-image: none !important; }'],
        link: {
          redirects: [{ path: /^\/(?:url|goto)\/?$/, params: ['q', 'url', 'u'], codec: 'url' }, { path: /^(?:\/aclk|\/imgres|\/translate|\/pagead\/aclk)(?:\/|\?|$)/, params: ['adurl', 'imgurl', 'url', 'u', 'dest'], codec: 'url' }]
        }
      },
      pages: {
        images: {
          includeRegex: /^https?:\/\/(?:images\.google\.|(?:www\.)?google\.[^/]+\/(?:imghp|imgres)(?:[/?#]|$))|[?&](?:tbm=(?:isch|imgs)|udm=(?:2|imgs))(?:&|#|$)/i,
          button: false,
          root: 'div.ivg-i, div[data-attrid="images universal"], div.isv-r',
          url: ['or', [['attribute', 'data-lpage', '[data-lpage]'], ['queryParam', 'imgurl', ['attribute', 'href', 'a[href*="/imgres"]']], ['attribute', 'href', 'a[href]']]],
          title: ['or', [['attribute', 'alt', 'img[alt]'], ['attribute', 'alt', 'img']]],
          command: { grid: { anchor: 'grid', items: ['div.isv-r, div.ivg-i', 'div[data-attrid="images universal"]'] } }
        },
        videos: {
          includeRegex: /^https?:\/\/(?:videos?\.google\.|(?:www\.)?google\.[^/]+\/videohp(?:[/?#]|$))|[?&](?:tbm=(?:vid|vids)|udm=(?:7|vids))(?:&|#|$)/i,
          root: 'div.PmEWq, div.MjjYud:has(a[href]):not(:has(div.PmEWq))',
          url: ['or', [['attribute', 'data-curl', '[data-curl]'], ['attribute', 'href', 'a[href]']]],
        },
        news: { includeRegex: /[?&](?:tbm=nws|udm=12)(?:&|#|$)/i, root: 'a.aJWbwf, [data-news-cluster-id]', url: ['or', [['attribute', 'href'], ['attribute', 'href', 'a[href]']]] }
      },
    },
    duckduckgo_lite: {
      includeRegex: /^https?:\/\/lite\.duckduckgo\.com(?::\d+)?(?:[/?#]|$)/i,
      root: 'tr:has(.result-link)',
      url: ['attribute', 'href', 'a.result-link[href]'],
      title: ['text', '.result-link'],
      snippet: ['text', '.result-snippet'],
      extraSelector: '& + tr:not(:has(.result-link)), & + tr:not(:has(.result-link)) + tr:not(:has(.result-link)), & + tr:not(:has(.result-link)) + tr:not(:has(.result-link)) + tr:not(:has(.result-link))',
    },
    duckduckgo: {
      includeRegex: /^https?:\/\/(?:(?:www|html|start|m|safe|noai)\.)?(?:duckduckgo\.com|ddg\.gg)(?::\d+)?(?:[/?#]|$)/i,
      site: ['ddg', 'duckduckgo_lite'],
      root: '[data-testid="result"], [data-testid="web-vertical"] li > article, .result, .web-result, .tile',
      url: ['or', [['attribute', 'href'], ['attribute', 'href', 'a[data-testid="result-extras-url-link"]'], ['attribute', 'href', 'a[data-testid="result-title-a"]'], ['attribute', 'href', 'h2 > a'], ['attribute', 'href', '.result__url'], ['attribute', 'href', 'a[href]']]],
      title: ['or', [['text', 'a[data-testid="result-title-a"]'], ['text', '.result__title'], ['text', '.tile__title'], ['text', '.tile--title__title'], ['text', 'h2 a'], ['text', 'a h2'], ['text', 'h2']]],
      snippet: ['or', [['text', '[data-testid="result-snippet"]'], ['text', '[data-result="snippet"]'], ['text', '.result__snippet']]],
      command: { link: { redirects: [{ path: /^\/l\/?$/, params: ['uddg'], codec: 'url' }] } },
      pages: {
        images: {
          includeRegex: /[?&]iax=images(?:&|#|$)/i,
          button: false,
          root: 'li:has(> figure), figure',
          title: ['or', [['attribute', 'alt', 'img[alt]'], ['attribute', 'alt', 'img']]],
        },
        videos: { includeRegex: /[?&]iax=videos?(?:&|#|$)/i, root: '[data-testid="result"]:not(:has(article)), .result:not(:has(article)), a[href]:has(article)' },
        news: { includeRegex: /[?&]iar=news(?:&|#|$)/i, root: '[data-testid="result"]:not(:has(article)), li > article:has(h2), article:not(:has(article)):has(h2)' }
      },
    },
    yandex: {
      includeRegex: /^https?:\/\/(?:(?:www|m)\.)?(?:ya\.ru|yandex\.(?:[a-z]{2,3}(?:\.[a-z]{2})?|[a-z]{4,}))(?::\d+)?(?:[/?#]|$)/i,
      root: 'div.Organic',
      url: ['or', [['attribute', 'href', '.OrganicTitle a'], ['attribute', 'href', '.Path-Item a'], ['attribute', 'href', 'a.Link'], ['attribute', 'href', 'a[href]']]],
      title: ['text', '.OrganicTitle'],
      snippet: ['text', '.OrganicText'],
      button: { inset: { top: '10px', right: '5px' }, scope: '.main__content, .content, [class*="z6OLDwO9"]' },
      command: { group: { container: 'parent', members: 'div.Organic' } },
      pages: {
        images: {
          includeRegex: /^https?:\/\/images\.|^https?:\/\/[^/?#]+\/images(?:[/?#]|$)/i,
          button: false,
          root: '.JustifierRowLayout-Item, div.SerpItem',
          url: ['or', [['queryParam', 'img_url', ['attribute', 'href', 'a[href*="img_url="]']], ['attribute', 'href', 'a[href]']]],
          title: ['or', [['attribute', 'alt', 'img[alt]'], ['attribute', 'alt', 'img']]],
        },
        videos: { includeRegex: /^https?:\/\/[^/?#]+\/videos?(?:[/?#]|$)/i },
        news: { includeRegex: /^https?:\/\/[^/?#]+\/news(?:[/?#]|$)/i }
      },
    },
    brave: {
      includeRegex: /^https?:\/\/(?:safe\.)?search\.brave\.com(?::\d+)?(?:[/?#]|$)/i,
      root: '.snippet[data-type="web"], .snippet[data-type="news"], .snippet[data-type="videos"], .image-wrapper',
      url: ['attribute', 'href', 'a[href]'],
      title: ['or', [['text', '.title'], ['text', '.snippet-title'], ['text', '.img-title']]],
      snippet: ['or', [['text', '.generic-snippet .content'], ['text', '.generic-snippet'], ['text', '.line-clamp-dynamic'], ['text', '.snippet-description'], ['text', '.description']]],
      button: { inset: { top: '10px', right: '5px' } },
      pages: {
        images: {
          includeRegex: /search\.brave\.com\/images(?:[/?]|$)/i,
          button: false,
          root: 'button.image-result',
          url: ['or', [['base64Url', ['src', 'data-src'], 'img[src*="imgs.search.brave.com"]'], ['attribute', 'href', 'a[href]']]],
          title: ['or', [['text', '.image-metadata-title'], ['text', '.img-title'], ['attribute', 'alt', 'img[alt]']]],
        }
      },
    },
    ecosia: {
      includeRegex: /^https?:\/\/(?:(?:www|m)\.)?ecosia\.org(?::\d+)?(?:[/?#]|$)/i,
      root: 'article[data-test-id="organic-result"], article[data-test-id="videos-result"], article[data-test-id="news-result"], article[data-test-id="images-result"], div.result, article.result',
      url: ['or', [['attribute', 'href', 'a[data-test-id="result-link"][href]'], ['attribute', 'href', 'a.result__link[href]'], ['attribute', 'href', 'a.image-result__details-link[href]'], ['attribute', 'href', 'a.image-result__link[href]'], ['attribute', 'href', 'a[href]']]],
      title: ['or', [['text', 'h2[data-test-id="result-title"]'], ['text', '.result-title__heading'], ['text', 'h2.image-result__details-title'], ['text', 'h2']]],
      snippet: ['or', [['text', '[data-test-id="web-result-description"]'], ['text', '[data-test-id="news-result-description"]'], ['text', '.web-result__description'], ['text', '.news-result__description'], ['text', '.video-result__description'], ['text', '.result__description']]],
    },
    startpage: {
      includeRegex: /^https?:\/\/(?:(?:www|eu|m)\.)?startpage\.com(?::\d+)?(?:[/?#]|$)/i,
      root: 'div.result, .w-gl__result',
      url: ['or', [['attribute', 'href', 'a.result-link[href]'], ['attribute', 'href', 'a.wgl-site-title[href]'], ['attribute', 'href', 'a.wgl-display-url[href]'], ['attribute', 'href', 'a.display-url[href]'], ['attribute', 'href', '.w-gl__result-title[href]'], ['attribute', 'href', 'a[href]']]],
      title: ['or', [['text', 'a.result-link'], ['text', 'h2.wgl-title'], ['text', 'a.wgl-site-title'], ['text', '.w-gl__result-title']]],
      snippet: ['or', [['text', 'p.description'], ['text', '.result__main > p'], ['text', '.w-gl__description']]],
      pages: { images: { includeRegex: /[?&]cat=images(?:&|#|$)/i, button: false }, videos: { includeRegex: /[?&]cat=video(?:&|#|$)/i }, news: { includeRegex: /[?&]cat=news(?:&|#|$)/i } },
    },
    yahoo_japan: {
      includeRegex: /^https?:\/\/(?:(?:[a-z]{1,6}\.)?(?:(?:images|video|videos|news)\.)?(?:r\.)?search\.yahoo\.co\.jp(?::\d+)?(?:[/?#]|$)|news\.yahoo\.co\.jp(?::\d+)?\/search(?:[/?#].*)?)/i,
      matches: ['*://*.search.yahoo.co.jp/*', '*://*.news.yahoo.co.jp/*'],
      priority: 10,
      site: ['yahoo-japan'],
      root: '.sw-Card.Algo, li.b_algo, div.b_algo, #web .algo, .algo-sr, .richAlgo, #contents section:has(a h3)',
      url: ['or', [['attribute', 'href', 'a:has(> h3)'], ['attribute', 'href', 'a.sw-Card__titleInner[href]'], ['attribute', 'href', 'a.sw-Card__space'], ['attribute', 'href', 'h3 a'], ['attribute', 'href', '.s-title a'], ['attribute', 'href', '.s-title'], ['attribute', 'href', '.sw-Card__title a'], ['attribute', 'href', 'a[data-ylk*="slk:title"]'], ['attribute', 'href', 'a.ac-algo'], ['attribute', 'href', 'a[data-y-link-id]']]],
      title: ['or', [['text', 'h3'], ['text', '.s-title'], ['text', 'h2 a'], ['text', 'a h2'], ['text', '.b_title'], ['text', '.title']]],
      snippet: ['or', [['text', '.sw-Card__description'], ['text', '.sw-Card__snippet'], ['text', '.sw-Text__body'], ['text', 'p'], ['text', '.b_caption p'], ['text', '.b_snippet'], ['text', '.b_paractl p']]],
      button: { inset: { top: '10px', right: '5px' } },
      command: { skip: '.sys_algo_rs, .AlsoTry_M, [data-yga*="sugg"]', link: { redirects: [{ path: /^\/(?:r|rd)(?:\/|$)|ru=|\/\*/i, pathValue: /(?:^|\/)RU=([\s\S]*?)(?=(?:\/(?:rk|rs|rv|ro|re|rh|rt|_ylt|_ylu)=|\/$|$))/i, hrefSuffix: /\/\*+-?(https?(?::|%3A)[\s\S]*)$/i, params: ['u', 'url', 'target', 'dest', 'dst', 'r', 'ru'], codec: 'pattern' }] } },
      pages: {
        images: {
          includeRegex: /^https?:\/\/(?:images\.[^/]*yahoo\.co\.jp|(?:[a-z0-9-]+\.)*search\.yahoo\.co\.jp\/image\/search(?:[/?#]|$))/i,
          button: false,
          root: '.sw-ThumbnailGrid__columnItem, #isr div:has(> a[data-cl-params]), a.sw-Thumbnail',
          url: ['or', [['regexInclude', /^https?:\/\//i, ['regexSubstitute', /^(?:[\s\S]*?;)?targurl:\s*(?:https?:\/\/)?((?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^;]*)?)(?:;[\s\S]*)?$/i, 'https://$1', ['attribute', 'data-cl-params', 'a.sw-Thumbnail']]], ['regexInclude', /^https?:\/\//i, ['regexSubstitute', /^(?:[\s\S]*?;)?targurl:\s*(?:https?:\/\/)?((?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^;]*)?)(?:;[\s\S]*)?$/i, 'https://$1', ['attribute', 'data-cl-params', 'a']]], ['attribute', 'href', 'a[href]']]],
          title: ['or', [['text', '.sw-ThumbnailGrid__title'], ['attribute', 'alt', 'img[alt]'], ['attribute', 'alt', 'img']]],
          snippet: ['text', '.sw-ThumbnailGrid__domain'],
        },
        videos: { includeRegex: /^https?:\/\/(?:videos?\.[^/]*yahoo\.co\.jp|(?:[a-z0-9-]+\.)*search\.yahoo\.co\.jp\/video\/search(?:[/?#]|$))/i, root: '.Algo, a.sw-ListItem__wrapper[href], section.sw-ListItem', url: ['or', [['regexInclude', /^https?:\/\//i, ['regexSubstitute', /^(?:[\s\S]*?;)?targurl:\s*(?:https?:\/\/)?((?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^;]*)?)(?:;[\s\S]*)?$/i, 'https://$1', ['attribute', 'data-cl-params', 'a']]], ['attribute', 'href', 'a[href]']]], title: ['or', [['text', '.sw-ListItem__title'], ['text', 'h3'], ['text', '.s-title']]] },
        news: {
          includeRegex: /^https?:\/\/news\./i,
          root: 'li:has(a[href*="/articles/"])',
          url: ['attribute', 'href', 'a[href*="/articles/"]'],
          title: ['or', [['text', 'div.newsFeed_item_body > div:nth-child(2) > div:nth-child(1)'], ['text', 'p'], ['text', 'a[href*="/articles/"]']]],
          snippet: ['text', 'p'],
        }
      },
    },
    yahoo: {
      includeRegex: /^https?:\/\/(?:[a-z]{1,6}\.)?(?:(?:images|video|videos|news)\.)?(?:r\.)?search\.yahoo\.(?:com|[a-z]{2,3}(?:\.[a-z]{2})?)(?::\d+)?(?:[/?#]|$)/i,
      root: '.sw-Card.Algo, li.b_algo, div.b_algo, #web .algo, .algo-sr, .richAlgo, #web ol > li > div',
      url: ['or', [['attribute', 'href', 'a:has(> h3)'], ['attribute', 'href', 'a.sw-Card__titleInner[href]'], ['attribute', 'href', 'a.sw-Card__space'], ['attribute', 'href', 'h3 a'], ['attribute', 'href', '.s-title a'], ['attribute', 'href', '.s-title'], ['attribute', 'href', '.sw-Card__title a'], ['attribute', 'href', 'a[data-ylk*="slk:title"]'], ['attribute', 'href', 'a.ac-algo'], ['attribute', 'href', 'a[data-y-link-id]']]],
      title: ['or', [['text', 'h3'], ['text', '.s-title'], ['text', 'h2 a'], ['text', 'a h2'], ['text', '.b_title'], ['text', '.title']]],
      snippet: ['or', [['text', '.sw-Card__description'], ['text', '.sw-Card__snippet'], ['text', '.sw-Text__body'], ['text', 'p'], ['text', '.b_caption p'], ['text', '.b_snippet'], ['text', '.b_paractl p']]],
      button: { inset: { top: '10px', right: '5px' } },
      command: { skip: '.sys_algo_rs, .AlsoTry_M, [data-yga*="sugg"]', link: { redirects: [{ path: /^\/(?:r|rd)(?:\/|$)|ru=|\/\*/i, pathValue: /(?:^|\/)RU=([\s\S]*?)(?=(?:\/(?:rk|rs|rv|ro|re|rh|rt|_ylt|_ylu)=|\/$|$))/i, hrefSuffix: /\/\*+-?(https?(?::|%3A)[\s\S]*)$/i, params: ['u', 'url', 'target', 'dest', 'dst', 'r', 'ru'], codec: 'pattern' }] } },
      pages: {
        images: {
          includeRegex: /^https?:\/\/(?:images\.[^/]*yahoo\.[^/]+|(?:[a-z0-9-]+\.)*search\.yahoo\.[^/]+\/search\/images(?:[/?#]|$))/i,
          button: false,
          root: '.sw-ThumbnailGrid__columnItem, #isr div:has(> a[data-cl-params]), a.sw-Thumbnail',
          url: ['or', [['regexInclude', /^https?:\/\//i, ['regexSubstitute', /^(?:[\s\S]*?;)?targurl:\s*(?:https?:\/\/)?((?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^;]*)?)(?:;[\s\S]*)?$/i, 'https://$1', ['attribute', 'data-cl-params', 'a.sw-Thumbnail']]], ['regexInclude', /^https?:\/\//i, ['regexSubstitute', /^(?:[\s\S]*?;)?targurl:\s*(?:https?:\/\/)?((?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^;]*)?)(?:;[\s\S]*)?$/i, 'https://$1', ['attribute', 'data-cl-params', 'a']]], ['attribute', 'href', 'a[href]']]],
          title: ['or', [['text', '.sw-ThumbnailGrid__title'], ['attribute', 'alt', 'img[alt]'], ['attribute', 'alt', 'img']]],
          snippet: ['text', '.sw-ThumbnailGrid__domain'],
        },
        videos: { includeRegex: /^https?:\/\/(?:videos?\.[^/]*yahoo\.[^/]+|(?:[a-z0-9-]+\.)*search\.yahoo\.[^/]+\/search\/video(?:[/?#]|$))/i },
        news: { includeRegex: /^https?:\/\/news\./i }
      },
    },
    so360: {
      includeRegex: /^https?:\/\/(?:(?:www|m|news)\.)?so\.com(?::\d+)?(?:[/?#]|$)/i,
      root: 'li.res-list:not(.mso-recommend-card):not(.guide-rel), div.res-list:not(.mso-recommend-card):not(.guide-rel)',
      url: ['or', [['attribute', 'href', 'h3 a[href]'], ['attribute', 'href', 'a:has(> h3)[href]'], ['attribute', 'href', 'a.alink[href]'], ['attribute', 'href', '.g-linkinfo a[href]'], ['attribute', 'href', 'a[href]']]],
      title: ['or', [['text', 'h3.res-title a'], ['text', 'h3 a'], ['text', '.res-title'], ['text', '.g-title a'], ['text', '.g-title']]],
      snippet: ['or', [['text', '.res-desc'], ['text', '.res-list-summary'], ['text', '.mh-desc'], ['text', '.summary']]],
      command: {
        link: {
          redirects: [{ path: /^\/jump\/?$/, params: ['u', 'url'], codec: 'url' }, { path: /(?:\/tc\b|\/link\b)/, params: ['url'], codec: 'url' }],
          directAttrs: ['data-mdurl', 'data-url', 'linkurl'],
          directScope: '.res-list, .vrwrap, .reactResult',
          directProtocol: 'https'
        }
      },
    },
    sogou: {
      includeRegex: /^https?:\/\/(?:(?:www|m|wap|news)\.)?sogou\.com(?::\d+)?(?:[/?#]|$)/i,
      root: 'div.vrwrap:has(h3), div.reactResult:has(h3), div.reactResult:has(.vr-title), div.vrResult:has(h3)',
      url: ['or', [['attribute', 'href', 'h3.vr-title a[href]'], ['attribute', 'href', '.vr-title a[href]'], ['attribute', 'href', 'a[class*="saTitle"][href]'], ['attribute', 'href', 'a.citeLinkClass[href]'], ['regexExclude', /^(?:javascript:|void\s*\()/i, ['attribute', 'href', 'a:has(> h3)[href]']], ['regexExclude', /^(?:javascript:|void\s*\()/i, ['attribute', 'href', 'a:has(h3)[href]']], ['regexExclude', /^(?:javascript:|void\s*\()/i, ['attribute', 'href', 'h3 a[href]']], ['regexExclude', /^(?:javascript:|void\s*\()/i, ['attribute', 'href', 'a[href]']]]],
      title: ['or', [['text', 'h3.vr-title a'], ['text', '.vr-title a'], ['text', 'a[class*="saTitle"]'], ['text', '.vr-title'], ['text', 'h3.vr-tit'], ['text', 'h3 a'], ['text', 'h3']]],
      snippet: ['or', [['text', '.space-txt'], ['text', '.star-wiki'], ['text', '.str_info'], ['text', 'p.sa-text-clamp3'], ['text', '[class*="saText"]']]],
      command: {
        link: {
          redirects: [{ path: /(?:\/tc\b|\/jump\b|\/link\b)/, params: ['url'], codec: 'url' }],
          directAttrs: ['data-mdurl', 'data-url', 'linkurl'],
          directScope: '.res-list, .vrwrap, .reactResult',
          directProtocol: 'https'
        }
      },
    },
    toutiao: {
      includeRegex: /^https?:\/\/(?:so|m)\.toutiao\.com(?::\d+)?(?:[/?#]|$)/i,
      root: '.result-content',
      url: ['or', [['attribute', 'href', 'a[href*="/search/jump"]'], ['attribute', 'href', 'a.l-card-title[href]'], ['attribute', 'href', 'a[href]:not([href*="/search?"])'], ['attribute', 'href', '.cs-header a[href]']]],
      title: ['or', [['text', 'a[href*="/search/jump"]'], ['text', '.l-card-title a'], ['text', '.l-card-title'], ['text', '.cs-header a']]],
      snippet: ['or', [['text', '.cs-card-content .text-regular'], ['text', '.cs-source'], ['text', '.l-paragraph'], ['text', '.l-source']]],
      command: { link: { redirects: [{ path: /^\/search\/jump\/?$/, params: ['url'], codec: 'url', chain: { hostSelf: true, param: 'h5_url' } }] } },
      pages: {
        images: {
          includeRegex: /[?&]pd=atlas(?:&|#|$)/i,
          button: false,
          root: '.l-waterfallY-item',
          url: ['or', [['jsonPath', '0.original_page_url', ['or', [['jsonParse', ['queryParam', 'preload', ['queryParam', 'url', ['attribute', 'href', 'a[href*="/search/jump"]']]]], ['jsonParse', ['urlDecode', ['queryParam', 'preload', ['queryParam', 'url', ['attribute', 'href', 'a[href*="/search/jump"]']]]]]]]], ['attribute', 'href', 'a[href*="/search/jump"]'], ['attribute', 'href', 'a[href]']]],
          title: ['or', [['attribute', 'alt', 'img[alt]'], ['jsonPath', '0.text', ['or', [['jsonParse', ['queryParam', 'preload', ['queryParam', 'url', ['attribute', 'href', 'a[href*="/search/jump"]']]]], ['jsonParse', ['urlDecode', ['queryParam', 'preload', ['queryParam', 'url', ['attribute', 'href', 'a[href*="/search/jump"]']]]]]]]]]],
          snippet: ['jsonPath', '0.text', ['or', [['jsonParse', ['queryParam', 'preload', ['queryParam', 'url', ['attribute', 'href', 'a[href*="/search/jump"]']]]], ['jsonParse', ['urlDecode', ['queryParam', 'preload', ['queryParam', 'url', ['attribute', 'href', 'a[href*="/search/jump"]']]]]]]]],
        },
        news: { includeRegex: /[?&]pd=information(?:&|#|$)/i },
        videos: { includeRegex: /[?&]pd=[a-z_]*video/i }
      },
    },
    quark: {
      includeRegex: /^https?:\/\/(?:(?:www|m|so)\.)?quark\.cn(?::\d+)?(?:[/?#]|$)|^https?:\/\/(?:(?:quark|yz)\.)?(?:(?:www|m)\.)?sm\.cn(?::\d+)?(?:[/?#]|$)/i,
      root: 'div.qk-card',
      url: ['or', [['attribute', 'href', '.qk-title a[href]'], ['attribute', 'href', 'a.qk-link-wrapper[href]'], ['attribute', 'href', 'a[href]']]],
      title: ['or', [['text', '.qk-title-text'], ['text', '.qk-title'], ['text', 'a.qk-link-wrapper']]],
      snippet: ['or', [['text', '.qk-paragraph-text'], ['text', '.qk-paragraph']]],
    },
    github: {
      includeRegex: /^https?:\/\/(?:www\.)?github\.com\/search\/?(?:[?#]|$)/i,
      matches: ['*://*.github.com/search*'],
      root: '[data-testid=\'results-list\'] > div',
      url: ['or', [['attribute', 'href', '.search-title a[href]'], ['attribute', 'href', 'h3 a[href]']]],
      title: ['or', [['text', '.search-title a'], ['text', 'h3 a[data-component=\'Link\']'], ['text', 'h3 a'], ['text', 'h3']]],
      snippet: ['or', [['text', 'h3 ~ div'], ['text', 'h3 + div'], ['text', 'article .description']]],
      button: false,
    },
    greasyfork: {
      includeRegex: /^https?:\/\/(?:www\.)?greasyfork\.org\/(?:[a-z]{2}(?:-[a-z0-9]{2,4})?\/)?scripts(?:\/(?:by-site\/[^/?#]*|language\/[a-z0-9+-]+)\/?)?(?:[?#]|$)/i,
      matches: ['*://*.greasyfork.org/*'],
      root: '#browse-script-list li[data-script-id]',
      url: ['attribute', 'href', 'a.script-link[href]'],
      title: ['or', [['text', 'a.script-link'], ['text', 'article h2 a']]],
      snippet: ['or', [['text', '.script-description'], ['text', 'article .description']]],
      button: false,
    },
    other: {
      root: '',
      url: ['attribute', 'href', 'a[href]'],
      title: ['text', 'h3'],
      snippet: ['text', 'p'],
      button: { inset: { top: '10px', right: '35px' }, exclude: 'header, [role="navigation"], [role="tablist"], [role="search"]' },
    }
  };

  let activeSelectors = null, _redirectSpecsCache = new Map(); let _selectorStoreSignature = null; let _configStoreSignature = null; let _siteAliasMap = null;

  function splitTopLevelSelectorList(selector) {
    const out = []; let quote = ''; let depth = 0; let start = 0;
    for (let i = 0; i < selector.length; i++) {
      const c = selector[i];
      if (quote) { if (c === '\\') i++; else if (c === quote) quote = ''; continue; }
      if (c === '"' || c === "'") { quote = c; continue; }
      if (c === '[' || c === '(') depth++;
      else if ((c === ']' || c === ')') && depth) depth--;
      else if (c === ',' && !depth) { out.push(selector.slice(start, i)); start = i + 1; }
    }
    out.push(selector.slice(start));
    return out;
  }
  function normalizeSelectorList(value) {
    const raw = Array.isArray(value) ? value : (typeof value === 'string' && value ? [value] : []);
    const out = [];
    for (const item of raw) {
      if (typeof item !== 'string' || !item) continue;
      for (const part of splitTopLevelSelectorList(item)) {
        let s = part.trim();
        if (s.startsWith('&')) s = s.slice(1).trim();
        if (s) out.push(s);
      }
    }
    return out;
  }
  function normalizeCssRules(value) {
    const raw = Array.isArray(value) ? value : (typeof value === 'string' && value ? [value] : []);
    return raw.filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim());
  }
  function normalizePreserveSpace(value) {
    const height = (h) => { if (h === undefined || h === null || h === true) return '60vh'; if (typeof h === 'number' && isFinite(h) && h >= 0) return h + 'px'; if (typeof h === 'string' && h.trim()) return h.trim(); return null; };
    if (value === true) return { height: '60vh' };
    if (typeof value === 'number' || typeof value === 'string') { const h = height(value); return h ? { height: h } : null; }
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const h = height(value.height); if (!h) return null;
    const out = { height: h };
    if (value.container !== undefined) { if (typeof value.container !== 'string' || !value.container.trim()) return null; out.container = value.container.trim(); }
    return out;
  }
  function preserveSpaceCss(def) {
    const ps = normalizePreserveSpace(def && def.preserveSpace);
    if (!ps) return '';
    if (!ps.container) { dbgWarn('preserveSpace: 未设置 container，占位规则已忽略'); return ''; }
    return ps.container + ' { min-height: ' + ps.height + '; }';
  }
  function normalizeSiteList(value) {
    const raw = Array.isArray(value) ? value : (typeof value === 'string' ? value.split(/[\s,]+/) : []);
    return raw.filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim());
  }
  function normalizeMatchPatterns(value) {
    const raw = Array.isArray(value) ? value : (typeof value === 'string' && value ? [value] : []);
    const list = raw.filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim());
    return list.length ? list : undefined;
  }
  function hasTopLevelComma(selector) {
    let quote = '', depth = 0;
    for (let i = 0; i < selector.length; i++) {
      const c = selector[i];
      if (quote) { if (c === '\\') i++; else if (c === quote) quote = ''; continue; }
      if (c === '"' || c === "'") { quote = c; continue; }
      if (c === '[' || c === '(') depth++;
      else if ((c === ']' || c === ')') && depth) depth--;
      else if (c === ',' && !depth) return true;
    }
    return false;
  }
  function commandSelectors(cmd, out = []) {
    if (!Array.isArray(cmd) || typeof cmd[0] !== 'string') return out;
    const t = cmd[0], a = cmd[1], b = cmd[2], c = cmd[3];
    if (t === 'text' && typeof a === 'string') out.push(a);
    else if (t === 'attribute' && typeof b === 'string') out.push(b);
    else if (t === 'property' && typeof b === 'string') out.push(b);
    else if (t === 'base64Url') { if (b !== undefined) commandSelectors(b, out); }
    else if (t === 'queryParam') commandSelectors(b, out);
    else if (t === 'rejectEngineHost' || t === 'normalizeUrl' || t === 'rejectOpaqueRedirect') commandSelectors(a, out);
    else if (t === 'jsonPath') commandSelectors(b, out);
    else if (t === 'jsonParse' || t === 'urlDecode' || t === 'base64Decode') commandSelectors(a, out);
    else if (t === 'prefix') commandSelectors(b, out);
    else if (t === 'or' && Array.isArray(a)) a.forEach((x) => commandSelectors(x, out));
    else if (t === 'regexInclude' || t === 'regexExclude') commandSelectors(b, out);
    else if (t === 'regexSubstitute') commandSelectors(c, out);
    return out;
  }

  const builtinSelectorOf = (key) => (SELECTORS[key] && typeof SELECTORS[key] === 'object') ? SELECTORS[key] : {};
  const PAGE_FIELDS = ['root', 'url', 'title', 'snippet', 'extraSelector', 'button', 'skip', 'group', 'grid', 'dedupeBy', 'link', 'blockedCss', 'preserveSpace', 'site'];
  const CMD_TYPES = new Set(['or', 'attribute', 'property', 'text', 'const', 'regexInclude', 'regexExclude', 'regexSubstitute', 'rejectEngineHost', 'normalizeUrl', 'rejectOpaqueRedirect', 'jsonPath', 'jsonParse', 'urlDecode', 'queryParam', 'base64Decode', 'base64Url', 'prefix']);
  function isCommandArray(v) { return Array.isArray(v) && typeof v[0] === 'string' && CMD_TYPES.has(v[0]); }
  function simpleToCommand(v, mode) {
    if (isCommandArray(v)) return v;
    const list = Array.isArray(v) ? v.filter((s) => typeof s === 'string' && s) : (typeof v === 'string' && v ? [v] : []);
    if (!list.length) return null;
    const cmds = list.map((sel) => mode === 'link' ? ((sel === ':scope' || sel === ':scope[href]') ? ['attribute', 'href'] : ['attribute', 'href', sel]) : ['text', sel]);
    return cmds.length === 1 ? cmds[0] : ['or', cmds];
  }
  function normalizeLink(link) {
    if (!link || typeof link !== 'object' || Array.isArray(link)) return undefined;
    const out = {};
    if (link.redirects !== undefined) {
      const fields = ['path', 'pathValue', 'hrefSuffix', 'stripPrefix'];
      out.redirects = Array.isArray(link.redirects) ? link.redirects.map((spec) => {
        if (!spec || typeof spec !== 'object' || Array.isArray(spec)) return spec;
        if (!fields.some((f) => { const v = spec[f]; return v && typeof v === 'object' && !(v instanceof RegExp) && typeof v.source === 'string'; })) return spec;
        const copy = { ...spec };
        for (const f of fields) { const v = copy[f]; if (v && typeof v === 'object' && !(v instanceof RegExp) && typeof v.source === 'string') { try { copy[f] = new RegExp(v.source, v.flags || ''); } catch (_) {} } }
        return copy;
      }) : link.redirects;
    }
    if (link.directAttrs !== undefined) out.directAttrs = link.directAttrs;
    if (link.directScope !== undefined) out.directScope = link.directScope;
    if (link.directProtocol !== undefined) out.directProtocol = link.directProtocol;
    return out;
  }
  function normalizeButton(button) {
    if (button === false) return false;
    const src = button && typeof button === 'object' && !Array.isArray(button) ? button : null;
    const out = {};
    if (src) for (const f of ['scope', 'require', 'requireSelf', 'exclude']) if (src[f] !== undefined) out[f] = src[f];
    let inset = null, zIndex, style = '';
    const readStyle = (decl) => {
      if (typeof decl !== 'string' || !decl.trim()) return;
      const rest = [];
      for (const part of decl.split(';')) {
        const raw = part.trim(); if (!raw) continue;
        const i = raw.indexOf(':'); if (i < 0) { rest.push(raw); continue; }
        const key = raw.slice(0, i).trim().toLowerCase(), val = raw.slice(i + 1).trim();
        if (!val) continue;
        if (key === 'top' || key === 'right' || key === 'bottom' || key === 'left') { inset = inset || {}; inset[key] = val; }
        else if (key === 'z-index') zIndex = val;
        else rest.push(key + ': ' + val);
      }
      if (rest.length) style = (style ? style + '; ' : '') + rest.join('; ');
    };
    if (Array.isArray(button)) {
      const options = button[1] && typeof button[1] === 'object' ? button[1] : {};
      inset = inset || {};
      for (const f of ['top', 'right', 'bottom', 'left']) if (options[f] !== undefined) inset[f] = options[f];
      if (options.zIndex !== undefined) zIndex = options.zIndex;
      if (typeof button[2] === 'string' && button[2]) out.mount = button[2];
      else if (Array.isArray(button[2])) out.mount = button[2];
    } else if (src) {
      if (src.inset && typeof src.inset === 'object') inset = { ...src.inset };
      if (src.zIndex !== undefined) zIndex = src.zIndex;
      if (typeof src.mount === 'string' && src.mount) out.mount = src.mount;
      else if (Array.isArray(src.mount)) out.mount = src.mount;
      if (src.options && typeof src.options === 'object') {
        inset = { ...(inset || {}) };
        for (const f of ['top', 'right', 'bottom', 'left']) if (src.options[f] !== undefined) inset[f] = src.options[f];
        if (src.options.zIndex !== undefined) zIndex = src.options.zIndex;
      }
      readStyle(src.style);
    }
    if (inset && Object.keys(inset).length) out.inset = inset;
    if (zIndex !== undefined) out.zIndex = zIndex;
    if (style) out.style = style;
    return out;
  }
  function cleanPage(page) {
    const p = page && typeof page === 'object' && !Array.isArray(page) ? page : {};
    const out = {};
    if (p.includeRegex !== undefined) out.includeRegex = p.includeRegex;
    else if (p.match !== undefined) out.includeRegex = p.match;
    if (p.excludeRegex) out.excludeRegex = p.excludeRegex;
    const mps = normalizeMatchPatterns(p.matches);
    if (mps) out.matches = mps;
    const exm = normalizeMatchPatterns(p.excludeMatches);
    if (exm) out.excludeMatches = exm;
    const serh = p.command && typeof p.command === 'object' && !Array.isArray(p.command) ? p.command : null;
    const pick = (f) => p[f] !== undefined ? p[f] : (serh ? serh[f] : undefined);
    const root = pick('root');
    if (root !== undefined) out.root = root;
    else if (p.containers !== undefined) out.root = p.containers;
    const url = pick('url');
    if (url !== undefined) out.url = url;
    else if (p.links !== undefined) out.url = p.links;
    if (p.title !== undefined) out.title = p.title;
    else if (p.titles !== undefined) out.title = p.titles;
    if (p.snippet !== undefined) out.snippet = p.snippet;
    const extra = pick('extraSelector');
    if (extra !== undefined) out.extraSelector = normalizeSelectorList(extra);
    const rawButton = pick('button');
    if (rawButton !== undefined) out.button = normalizeButton(rawButton);
    for (const f of ['skip', 'group', 'grid', 'dedupeBy', 'link']) { const v = pick(f); if (v !== undefined) out[f] = v; }
    const blockedCss = normalizeCssRules(p.blockedCss !== undefined ? p.blockedCss : (serh && serh.blockedCss));
    if (blockedCss.length) out.blockedCss = blockedCss;
    const rawPreserveSpace = pick('preserveSpace');
    const preserveSpace = normalizePreserveSpace(rawPreserveSpace);
    if (preserveSpace) out.preserveSpace = preserveSpace;
    else if (rawPreserveSpace === false) out.preserveSpace = false;
    const site = normalizeSiteList(p.site);
    if (site.length) out.site = site;
    if (p.delay !== undefined) out.delay = p.delay;
    if (p.commonProps && typeof p.commonProps === 'object' && !Array.isArray(p.commonProps)) out.commonProps = { ...p.commonProps };
    return out;
  }
  function normalizePageMap(pages) {
    if (!pages) return undefined;
    const isArray = Array.isArray(pages);
    if (!isArray && typeof pages !== 'object') return undefined;
    const items = isArray ? pages.map((page) => [page && typeof page === 'object' && !Array.isArray(page) && typeof page.name === 'string' ? page.name.trim() : '', page]) : Object.entries(pages);
    const out = {};
    for (const [name0, page] of items) {
      if (!page || typeof page !== 'object' || Array.isArray(page)) continue;
      let name = name0;
      if (isArray) {
        if (!name) { const cp = page.commonProps; name = cp && typeof cp === 'object' && !Array.isArray(cp) && typeof cp.$category === 'string' ? cp.$category.trim() : ''; }
        if (!name) continue;
      }
      const clean = cleanPage(page);
      delete clean.name;
      if (!clean.commonProps || typeof clean.commonProps !== 'object' || Array.isArray(clean.commonProps) || clean.commonProps.$category === undefined) clean.commonProps = { ...(clean.commonProps || {}), $category: name };
      if (Object.keys(clean).length) out[name] = clean;
    }
    return out;
  }
  function mergePageObjects(base, page) {
    const out = { ...(base || {}), ...(page || {}) };
    for (const f of ['title', 'snippet']) { if ((base && base[f]) || (page && page[f])) out[f] = (page && page[f]) || (base && base[f]); }
    if ((base && base.link) || (page && page.link)) out.link = { ...((base && base.link) || {}), ...((page && page.link) || {}) };
    return out;
  }
  function pickProp(def, name, baseProps) {
    const d = def || {};
    const raw = d[name] !== undefined ? d[name] : (name === 'title' ? d.titles : undefined);
    return raw !== undefined ? simpleToCommand(raw, 'text') : (baseProps || {})[name];
  }
  function pickProps(def, base) {
    const baseProps = base || {};
    const props = {};
    for (const name of ['title', 'snippet']) {
      const v = pickProp(def, name, baseProps);
      if (v !== undefined) props[name] = v;
    }
    return props;
  }
  function mergeSelectorDef(def, base) {
    const d = cleanPage(def || {}), b = cleanPage(base || {});
    const pages = def && def.pages !== undefined ? (() => {
      const dp = normalizePageMap(def.pages), bp = normalizePageMap(base && base.pages);
      if (!dp) return bp;
      if (!bp) return dp;
      const m = {};
      for (const n of Object.keys(bp)) m[n] = { ...bp[n] };
      for (const n of Object.keys(dp)) m[n] = mergePageObjects(m[n], dp[n]);
      return m;
    })() : normalizePageMap(base && base.pages) || undefined;
    return {
      root: d.root !== undefined ? d.root : (b.root || ''),
      url: d.url !== undefined ? simpleToCommand(d.url, 'link') : b.url,
      title: pickProp(d, 'title', b),
      snippet: pickProp(d, 'snippet', b),
      extraSelector: d.extraSelector !== undefined ? d.extraSelector : (b.extraSelector || []),
      button: d.button !== undefined ? d.button : b.button,
      skip: d.skip !== undefined ? d.skip : b.skip,
      group: d.group !== undefined ? d.group : b.group,
      grid: d.grid !== undefined ? d.grid : b.grid,
      dedupeBy: d.dedupeBy !== undefined ? d.dedupeBy : b.dedupeBy,
      link: d.link !== undefined ? normalizeLink({ ...(b.link || {}), ...d.link }) : b.link,
      blockedCss: d.blockedCss !== undefined ? d.blockedCss : b.blockedCss,
      preserveSpace: d.preserveSpace !== undefined ? d.preserveSpace : b.preserveSpace,
      site: d.site !== undefined ? d.site : b.site,
      matches: d.matches !== undefined ? d.matches : b.matches,
      excludeMatches: d.excludeMatches !== undefined ? d.excludeMatches : b.excludeMatches,
      delay: d.delay !== undefined ? d.delay : b.delay,
      priority: def && def.priority !== undefined ? def.priority : (base && base.priority),
      ...(pages ? { pages } : {})
    };
  }

  function getUserSelectors() {
    const raw = GM_getValue(SELECTORS_KEY); if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}; return raw;
  }

  function getEngineSubscriptions() {
    const raw = GM_getValue(ENGINE_SUBSCRIPTIONS_KEY, null); const list = Array.isArray(raw) ? raw.filter(s => s && typeof s === 'object' && typeof s.url === 'string' && s.url) : [];
    let builtin = list.find(s => s.builtin) || list.find(s => s.url === BUILTIN_ENGINE_SUB_URL) || { url: BUILTIN_ENGINE_SUB_URL, enabled: true, lastUpdate: 0, lastAttempt: 0, selectors: null };
    let rest = list.filter(s => s !== builtin && s.url !== BUILTIN_ENGINE_SUB_URL);
    if (builtin.url !== BUILTIN_ENGINE_SUB_URL) {
      builtin = { ...builtin, url: BUILTIN_ENGINE_SUB_URL, lastUpdate: 0, lastAttempt: 0, selectors: null };
      rest = rest.filter(s => !s.builtin && s.url !== BUILTIN_ENGINE_SUB_URL);
      saveEngineSubscriptions([{ ...builtin, builtin: true, name: builtin.name || t('builtinEngineSub') }, ...rest]);
    }
    return [{ ...builtin, builtin: true, name: builtin.name || t('builtinEngineSub') }, ...rest];
  }

  function saveEngineSubscriptions(subs) {
    if (!Array.isArray(subs)) return; GM_setValue(ENGINE_SUBSCRIPTIONS_KEY, subs); resetSelectorCache();
  }
  const isBuiltinEngineSub = (s) => !!s && (!!s.builtin || s.url === BUILTIN_ENGINE_SUB_URL);
  function applyBuiltinEngineSubEnabled(enabled) {
    const subs = getEngineSubscriptions(); const b = subs.find(isBuiltinEngineSub);
    if (!b || (b.enabled !== false) === (enabled !== false)) return false;
    b.enabled = enabled !== false; saveEngineSubscriptions(subs); refreshEngineSite(); return true;
  }

  function parseRegexLiteral(str) { const m = String(str).match(/^\/(.*)\/([a-z]*)$/i); return m ? { source: m[1], flags: m[2].toLowerCase() } : { source: String(str), flags: '' }; }
  function sanitizeRegexFlags(f) { return String(f || '').toLowerCase().replace(/[^imsu]/g, ''); }
  function isRegexLiteralStr(s) { return /^\/(.*)\/([a-z]*)$/i.test(String(s)); }

  function coerceRegexValue(raw, fallback) {
    let out = fallback || null;
    try {
      if (raw instanceof RegExp) out = raw;
      else if (typeof raw === 'string' && raw) { const m = parseRegexLiteral(raw); out = new RegExp(m.source, isRegexLiteralStr(raw) ? sanitizeRegexFlags(m.flags) : 'i'); }
      else if (raw && typeof raw === 'object' && typeof raw.source === 'string' && raw.source) out = new RegExp(raw.source, sanitizeRegexFlags(raw.flags));
      else out = fallback || null;
    } catch (e) { out = fallback || null; }
    return out;
  }

  function selectorMatchValue(def) { return def && typeof def === 'object' ? (def.includeRegex !== undefined ? def.includeRegex : def.match) : undefined; }
  function parseSelectorMatch(def, base) { return coerceRegexValue(selectorMatchValue(def), selectorMatchValue(base) || null); }

  function coerceSelectorDef(def, base) {
    const merged = { ...mergeSelectorDef(def, base || {}), includeRegex: parseSelectorMatch(def, base || {}) };
    const exBase = def.excludeRegex !== undefined ? def.excludeRegex : (base || {}).excludeRegex;
    const ex = coerceRegexValue(exBase, null);
    if (ex) merged.excludeRegex = ex;
    if (def.disabled === true) merged.disabled = true;
    else if (def.disabled === false) merged.disabled = false;
    if (merged.pages && typeof merged.pages === 'object') {
      const pages = {};
      for (const name of Object.keys(merged.pages)) {
        const page = { ...merged.pages[name] };
        if (page.includeRegex !== undefined) page.includeRegex = coercePageMatch(page, null);
        const pex = coerceRegexValue(page.excludeRegex, null);
        if (pex) page.excludeRegex = pex; else delete page.excludeRegex;
        pages[name] = page;
      }
      merged.pages = pages;
    }
    return merged;
  }

  function coercePageMatch(def, base) { return coerceRegexValue(selectorMatchValue(def), selectorMatchValue(base) || null); }

  function getSubscribedSelectors() {
    const defs = {};
    for (const sub of getEngineSubscriptions()) {
      if (sub.enabled === false || !sub.selectors || typeof sub.selectors !== 'object' || Array.isArray(sub.selectors)) continue;
      for (const key of Object.keys(sub.selectors)) {
        if (key === 'other') continue; const def = sub.selectors[key];
        if (!def || typeof def !== 'object' || Array.isArray(def)) continue;
        defs[key] = coerceSelectorDef(def, defs[key] || builtinSelectorOf(key));
      }
    }
    return defs;
  }

  function getBaseSelectors() {
    const merged = {}; for (const key of Object.keys(SELECTORS)) merged[key] = SELECTORS[key];
    return Object.assign(merged, getSubscribedSelectors());
  }

  function getSelectors() {
    if (activeSelectors) return activeSelectors; const builtin = SELECTORS; const subscribed = getSubscribedSelectors(); const user = getUserSelectors(); const merged = {};
    for (const key of Object.keys(user)) {
      if (key === 'other') continue; const def = user[key]; if (!def || typeof def !== 'object' || Array.isArray(def)) continue;
      merged[key] = coerceSelectorDef(def, subscribed[key] || builtin[key] || {});
    }
    for (const key of Object.keys(subscribed)) if (!(key in merged)) merged[key] = subscribed[key];
    for (const key of Object.keys(builtin)) if (!(key in merged)) merged[key] = coerceSelectorDef(builtin[key], {});
    activeSelectors = merged; return merged;
  }

  function resetSelectorCache() {
    activeSelectors = null; _redirectSpecsCache.clear(); _siteAliasMap = null; _engineCacheHost = null; _engineCacheResult = 'other'; _observedSelector = ''; _categoryCacheHref = null; _categoryCacheResult = DEFAULT_CATEGORY; _catDefCacheKey = null; _catDefCache = null; _hideNamesCache = null;
    if (_engineStyleEl) { try { _engineStyleEl.remove(); } catch (_) {} _engineStyleEl = null; }
  }

  let _engineCacheHost = null, _engineCacheResult = 'other';
  const _matchPatternCache = new Map();
  function matchPatternToRegex(pattern) {
    const k = String(pattern); let r = _matchPatternCache.get(k);
    if (r === undefined) {
      r = null;
      if (k === '<all_urls>') r = /^[\s\S]*$/;
      else {
        const m = /^(?:\*|[A-Za-z][0-9A-Za-z+.-]*):\/\/(?:\*|(?:\*\.)?[0-9A-Za-z](?:[0-9A-Za-z-]*[0-9A-Za-z])?(?:\.[0-9A-Za-z](?:[0-9A-Za-z-]*[0-9A-Za-z])?)*)\/(?:(?:\*|[0-9A-Za-z._~:/?[\]@!$&'()+,;=-]|%[0-9A-Fa-f]{2})*)$/.exec(k);
        if (m) {
          const sep = k.indexOf('://'); const hs = sep + 3; const he = k.indexOf('/', hs);
          const scheme = k.slice(0, sep).toLowerCase(); const host = k.slice(hs, he).toLowerCase(); const path = k.slice(he);
          const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const sRe = scheme === '*' ? '(?:http|https)' : esc(scheme);
          const hRe = host === '*' ? '[^/]*' : (host.slice(0, 2) === '*.' ? '(?:[^./]+\\.)*' + esc(host.slice(2)) : esc(host));
          const pRe = path === '/*' ? '/[\\s\\S]*' : path.split('*').map(esc).join('[\\s\\S]*');
          try { r = new RegExp('^' + sRe + '://' + hRe + pRe + '$'); } catch (_) { r = null; }
        }
      }
      _matchPatternCache.set(k, r);
    }
    return r;
  }
  function matchPatternsTest(patterns, href) {
    if (!href || !patterns) return false;
    let u; try { u = new URL(href); } catch (_) { return false; }
    const scheme = u.protocol.slice(0, -1);
    if (scheme !== 'http' && scheme !== 'https') return false;
    const norm = scheme + '://' + u.hostname + u.pathname + u.search;
    for (const p of (Array.isArray(patterns) ? patterns : [patterns])) {
      if (typeof p !== 'string' || !p) continue;
      const re = matchPatternToRegex(p);
      if (re && re.test(norm)) return true;
    }
    return false;
  }
  function getSearchEngine() {
    const loc = window.location || {}; const hostname = String(loc.hostname || ''); const href = String(loc.href || ''); const cacheKey = href || hostname;
    if (_engineCacheHost === cacheKey) return _engineCacheResult; _engineCacheHost = cacheKey; const defs = getSelectors();
    const names = Object.keys(defs).sort((a, b) => ((defs[b] && defs[b].priority) || 0) - ((defs[a] && defs[a].priority) || 0));
    for (const name of names) {
      const def = defs[name]; if (!def || def.disabled || (!def.includeRegex && !def.matches)) continue;
      const re = def.includeRegex;
      let ok = re ? !!(href && re.test(href)) : false;
      if (ok && def.matches) ok = !!(href && matchPatternsTest(def.matches, href));
      else if (!re) ok = !!(href && def.matches && matchPatternsTest(def.matches, href));
      if (ok) {
        const ex = coerceRegexValue(def.excludeRegex, null);
        try { if (ex && ex.test(href)) continue; } catch (_) {}
        if (href && matchPatternsTest(def.excludeMatches, href)) continue;
        return (_engineCacheResult = name);
      }
    }
    return (_engineCacheResult = 'other');
  }

  function findPageByCategory(def, category) {
    const pages = def && def.pages && typeof def.pages === 'object' ? def.pages : null;
    if (!pages) return null;
    for (const name of Object.keys(pages)) {
      const page = pages[name];
      if (page && page.commonProps && page.commonProps.$category === category) return page;
    }
    return null;
  }

  const DEFAULT_CATEGORY = 'web';
  let _categoryCacheHref = null, _categoryCacheResult = DEFAULT_CATEGORY; let _categoryCacheEngine = null;
  function getSearchCategory(loc, engineArg) {
    if (loc === undefined || loc === null) {
      const href = String(window.location && window.location.href || '');
      const engine = getSearchEngine();
      if (_categoryCacheHref === href && _categoryCacheEngine === engine) return _categoryCacheResult;
      const r = getSearchCategory(window.location, engine);
      _categoryCacheHref = href; _categoryCacheEngine = engine; _categoryCacheResult = r; return r;
    }
    const engine = engineArg !== undefined ? engineArg : getSearchEngine();
    const href = String((loc || window.location) && (loc || window.location).href || window.location.href || '');
    const pages = (getSelectors()[engine] || SELECTORS.other).pages;
    if (pages && typeof pages === 'object') {
      for (const name of Object.keys(pages)) {
        const def = pages[name]; if (!def || typeof def !== 'object') continue;
        const m = coerceRegexValue(def.includeRegex !== undefined ? def.includeRegex : def.match, null);
        if (!m && !def.matches) continue;
        const ex = coerceRegexValue(def.excludeRegex, null);
        try { if ((!m || m.test(href)) && (!def.matches || matchPatternsTest(def.matches, href)) && !(ex && ex.test(href)) && !matchPatternsTest(def.excludeMatches, href)) return (def.commonProps && def.commonProps.$category) || name; } catch (e) {}
      }
    }
    return DEFAULT_CATEGORY;
  }

    function isEngineHost(engine, host) {
    let def = null; try { def = getSelectors()[engine]; } catch (_) {}
    const h = String(host || '').replace(/\.$/, ''); if (!h) return false;
    const re = def && def.includeRegex;
    if (re) {
      const test = (u) => { try { return re.test(u); } catch (_) { return false; } };
      if (test('https://' + h + '/') || test('https://' + h) || test('http://' + h + '/')) return true;
      try {
        const loc = window.location || {};
        if (String(loc.hostname || '').replace(/\.$/, '').toLowerCase() === h.toLowerCase() && re.test(String(loc.href || ''))) return true;
      } catch (_) {}
      return false;
    }
    return !!(def && def.matches && (Array.isArray(def.matches) ? def.matches : [def.matches]).some((p) => {
      const hostPattern = typeof p === 'string' ? p.replace(/^([^:]+:\/\/[^/]+)\/.*$/, '$1/*') : '';
      return !!hostPattern && matchPatternsTest([hostPattern], 'https://' + h + '/');
    }));
  }

  let _catDefCacheKey = null, _catDefCache = null;
  function resolvePageDef(engine) {
    const def = getSelectors()[engine] || SELECTORS.other;
    const category = getSearchCategory();
    const cacheKey = engine + '|' + category;
    if (_catDefCacheKey === cacheKey) return _catDefCache;
    const page = findPageByCategory(def, category);
    const resolved = page && typeof page === 'object' ? mergeSelectorDef(page, def) : def;
    _catDefCacheKey = cacheKey; _catDefCache = resolved;
    return resolved;
  }

  function getRootSelector(engine) {
    const root = resolvePageDef(engine).root;
    return typeof root === 'string' ? root : rootAnchorSelector(root);
  }
  function getRootCommand(engine) {
    return resolvePageDef(engine).root;
  }
  function rootAnchorSelector(cmd) {
    if (typeof cmd === 'string') return cmd;
    if (!Array.isArray(cmd)) return '';
    if (cmd[0] === 'selector') return rootAnchorSelector(cmd[1]);
    if (cmd[0] === 'upward') return rootAnchorSelector(cmd[2]);
    return '';
  }
  function rootHasUpward(cmd) {
    if (!Array.isArray(cmd)) return false;
    if (cmd[0] === 'upward') return true;
    if (cmd[0] === 'selector') return rootHasUpward(cmd[1]);
    return false;
  }
  function rootCommandKey(cmd) {
    return typeof cmd === 'string' ? cmd : JSON.stringify(cmd);
  }
  function queryRootCommand(cmd, scope = document) {
    if (typeof cmd === 'string') { try { return Array.from(scope.querySelectorAll(cmd)); } catch (_) { return []; } }
    if (!Array.isArray(cmd) || typeof cmd[0] !== 'string') return [];
    if (cmd[0] === 'selector') return queryRootCommand(cmd[1], scope);
    if (cmd[0] === 'upward') {
      const level = cmd[1], out = [], inner = queryRootCommand(cmd[2], scope);
      if (typeof level === 'string' && level) {
        for (const el of inner) {
          const parent = el.parentElement; let up = null;
          try { up = parent && parent.closest ? parent.closest(level) : null; } catch (_) { up = null; }
          if (up && up !== document.body && up !== document.documentElement) out.push(up);
        }
      } else {
        const steps = Math.max(0, Number(level) || 0);
        for (const el of inner) {
          let cur = el;
          for (let i = 0; i < steps && cur; i++) cur = cur.parentElement;
          if (cur && cur !== document.body && cur !== document.documentElement) out.push(cur);
        }
      }
      return [...new Set(out)];
    }
    return [];
  }
  function findRootContainer(node, cmd) {
    if (!node || typeof node.closest !== 'function') return null;
    if (typeof cmd === 'string') { try { return node.closest(cmd); } catch (_) { return null; } }
    if (!Array.isArray(cmd) || typeof cmd[0] !== 'string') return null;
    if (cmd[0] === 'selector') return findRootContainer(node, cmd[1]);
    if (cmd[0] === 'upward') {
      const anchor = rootAnchorSelector(cmd[2]); const level = cmd[1];
      if (anchor) {
        let cur = null; try { cur = node.closest(anchor); } catch (_) {}
        if (typeof level === 'string' && level) { cur = cur && cur.parentElement && cur.parentElement.closest ? cur.parentElement.closest(level) : null; }
        else { for (let i = 0; i < Math.max(0, Number(level) || 0) && cur; i++) cur = cur.parentElement; }
        if (cur && cur !== document.body && cur !== document.documentElement) return cur;
      }
      let best = null;
      for (const el of queryRootCommand(cmd, node.ownerDocument || document)) if (el.contains(node) && (!best || best.contains(el))) best = el;
      return best;
    }
    return null;
  }

  function isEngineSite() {
    return getSearchEngine() !== 'other';
  }

  function dbg(...args) { if (typeof currentConfig !== 'undefined' && currentConfig && currentConfig.debug) console.log('[屏蔽]', ...args); }
  function dbgWarn(...args) { if (typeof currentConfig !== 'undefined' && currentConfig && currentConfig.debug) console.warn('[屏蔽]', ...args); }
  function dbgError(...args) { if (typeof currentConfig !== 'undefined' && currentConfig && currentConfig.debug) console.error('[屏蔽]', ...args); }

  const LANG_TEXTS = {
    'zh-CN': {
      disableBlock: '临时禁用', showCount: '显示数量', debugMode: '调试模式',
      enableFeature: '启用功能', blockDomain: '屏蔽域名', doubleConfirm: '二次确认', showMatchedSource: '来源显示',
      uiScale: 'UI比例', scaleM: '75%', scaleL: '100%', scaleXL: '125%', scaleXXL: '150%',
      darkMode: '深色模式', darkSystem: '跟随系统', darkLight: '浅色', darkDark: '深色',
      exportOptRules: '规则', exportOptSubscription: '订阅', exportOptEngine: '引擎', exportOptSettings: '设置', exportEmpty: '至少选择一项导出内容', collapseMode: '折叠模式', collapseModeHint: '开启后屏蔽结果只显示标题', highlightWhitelist: '高亮白名单', highlightWhitelistHint: '开启后高亮规则附带白名单效果', timeCalibration: '时间校准', timeCalibrationHint: '关闭后不再使用联网授时点校准同步时间',
      showSubBtn: '订阅按钮', showSyncBtn: '同步按钮', bracketHighlight: '括号高亮',
      settingsBtn: '⚙️', settingsPanelTitle: '脚本设置',
      settingsSecBlock: '一键屏蔽', settingsSecUI: '界面显示', settingsSecOther: '其他设置', removeRedirects: '去除重定向',
      bubbleSize: '悬浮球:', blockRules: '规则：', sync: '同步',
      import: '导入', export: '导出', save: '保存',
      stats: '统计', close: '关闭', cancel: '取消',
      placeholder: '每行一个规则', panelTitle: '订阅管理', webdavTitle: 'WebDAV',
      webdavUrl: '地址', webdavUser: '账号', webdavPass: '密码',
      webdavPasswordSaved: '已保存密码，输入新密码以替换',
      webdavPasswordRequired: '地址或用户名已更改，请输入对应密码',
      filename: '文件名', upload: '上传', download: '下载',
      matchedRule: '规则', localRule: '本地规则', subscription: '订阅',
      urlRule: 'URL规则', titleRule: '标题规则', textRule: '正文规则',
      regexRule: '正则规则', statsCompound: '复合规则', noMatch: '无匹配项',
      whitelistRules: '白名单规则',
      menuOpenPanel: '⚙️ 打开面板', menuErrorDetection: '规则自检',
      menuCenter: '面板居中', menuBubble: '显示悬浮球', menuBubbleAction: '悬浮球功能', menuLanguage: 'Language',
      subscriptionSuccess: '订阅成功！已更新 {count}',
      saved: '已保存', uploadSuccess: '上传成功！',
      downloadSuccess: '下载成功！规则已保存',
      noRulesExport: '没有规则可导出',
      bcDomain: '域名', bcExact: '精确', bcWhitelist: '白名单',
      bcDelete: '删除', bcDeleteSub: '订阅规则无法删除', bcConfirm: '确认',
      cannotBlockCurrentSite: '无法屏蔽当前搜索引擎自身域名: {domain}',
      statsErrors: '发现 {count} 个规则错误: ',
      matchedCountLabel: '匹配', matchedCountUnit: '条',
      menuBubbleActionOpen: '打开面板', menuBubbleActionStats: '打开统计', menuBubbleActionToggle: '显隐结果',
      bubbleStatsHint: '点击打开统计，长按打开面板',
      bubbleToggleHint: '点击显示/隐藏屏蔽结果，长按打开面板',
      bubbleSelectorsHint: '点击打开自定义引擎，长按打开面板',
      subLinkEmpty: '链接为空', subImportSuccess: '导入成功',
      subImportFailed: '导入失败，请检查链接或网络状态',
      fileImportFailed: '导入失败，文件内容不是有效规则', importClearConfirm: '导入的文件不含任何规则，是否清空本地全部规则？', webdavClearConfirm: '云端文件不含任何规则，是否清空本地全部规则？',
      webdavUploading: '正在上传...', webdavDownloading: '正在下载...',
      webdavUploadFailed: '上传失败: ', webdavDownloadFailed: '下载失败: ',
      webdavSyncLocked: '同步正在进行中，请稍后重试',
      webdavHttpsRequired: '安全起见，WebDAV地址必须使用https',
      networkError: '网络错误', requestTimeout: '请求超时',
      subLinkInvalid: '链接错误', importing: '导入中', whitelistResult: '该结果为白名单',
      autoSync: '自动同步', syncScriptConfig: '同步配置',
      webdavUrlEmpty: 'WebDAV地址为空',
      highlightRules: '高亮规则', menuHighlightColor: '🎨 高亮颜色',
      hlColorTitle: '高亮颜色', hlColorReset: '重置', resetPending: '已重置，保存后生效', hlColorHint: '点击色块快速保存',
      autoUpdate: '自动更新', errorWord: '错误',
      duplicateRules: '重复规则', invalidRule: '规则无效',
      hlColorError: '高亮序号需＞0',
      ifParenError: '@if(...) 括号未闭合',
      condRegexError: '条件正则无效: {part}',
      regexError: '正则表达式无效', urlError: 'URL规则无效',
      ruleDuplicate: '重复了 {count} 次', emptyPrefixRule: '规则前缀后缺少内容',
      invalidRegexFlags: '正则 flags 无效: {flags}',
      emptyIfCondition: '@if() 条件不能为空', unknownIfCondition: '未知 @if 条件: {part}',
      condExprError: '@if 表达式语法错误: {part}',
      invalidUrlWildcard: 'URL 通配符格式无效: {rule}', elementRuleUnsupported: '不支持元素规则',
      menuCustomSelectors: '自定义引擎', selectorPanelTitle: '引擎选择器',
      subscribe: '订阅', engineSubTitle: '引擎订阅', builtinEngineSub: '内置引擎',
      selectorHint: '如果不知道有什么用，请勿修改。',
      selectorJsonError: '解析失败，请检查格式',
      selectorReservedKey: '保留键不可使用: {key}',
      selectorInvalidKey: '引擎ID仅允许字母/数字/_/-: {key}',
      selectorInvalidRegex: 'match 正则无效: {key}',
      selectorInvalidCss: 'CSS 选择器无效: {key}.{field}: {value}',
      selectorLegacyField: '不支持的旧字段: {key}.{field}',
      selectorInvalidCommand: '取值命令无效: {key}.{field}: {value}',
      selectorFieldRequired: '字段必填: {key}.{field}',
      selectorInvalidBool: '字段必须为布尔值: {key}.{field}',
    },
    'en': {
      disableBlock: 'Disable Block', showCount: 'Show Count', debugMode: 'Debug Mode',
      enableFeature: 'Enable Feature', blockDomain: 'Block Domain', doubleConfirm: 'Double Confirm', showMatchedSource: 'Show Source',
      uiScale: 'UI Scale', scaleM: '75%', scaleL: '100%', scaleXL: '125%', scaleXXL: '150%',
      darkMode: 'Dark Mode', darkSystem: 'System', darkLight: 'Light', darkDark: 'Dark',
      exportOptRules: 'Rules', exportOptSubscription: 'Subscriptions', exportOptEngine: 'Engines', exportOptSettings: 'Configs', exportEmpty: 'Select at least one item to export', collapseMode: 'Collapse Mode', collapseModeHint: 'Blocked results will show titles only', highlightWhitelist: 'Highlight Whitelist', highlightWhitelistHint: 'Highlight rules will also whitelist results', timeCalibration: 'Time Calibration', timeCalibrationHint: 'Network time calibration will stop, sync uses the WebDAV Date timestamp',
      showSubBtn: 'Sub Button', showSyncBtn: 'Sync Button', bracketHighlight: 'Highlight Bracket',
      settingsBtn: '⚙️', settingsPanelTitle: 'Script Settings',
      settingsSecBlock: 'One-click Block', settingsSecUI: 'Interface', settingsSecOther: 'Other', removeRedirects: 'Remove redirects',
      bubbleSize: 'Bubble:', blockRules: 'Rules:', sync: 'Sync',
      import: 'Import', export: 'Export', save: 'Save',
      stats: 'Stats', close: 'Close', cancel: 'Cancel',
      placeholder: 'One rule per line', panelTitle: 'Subscription Manager', webdavTitle: 'WebDAV',
      webdavUrl: 'URL', webdavUser: 'Username', webdavPass: 'Password',
      webdavPasswordSaved: 'Password saved, enter new to replace',
      webdavPasswordRequired: 'Address or username changed; enter the corresponding password',
      filename: 'Filename', upload: 'Upload', download: 'Download',
      matchedRule: 'Rule', localRule: 'Local Rule', subscription: 'Sub',
      urlRule: 'URL Rule', titleRule: 'Title Rule', textRule: 'Text Rule',
      regexRule: 'Regex Rule', statsCompound: 'Compound Rule', noMatch: 'No matches',
      whitelistRules: 'Whitelist Rules',
      menuOpenPanel: '⚙️ Open Panel', menuErrorDetection: 'Rules Detection',
      menuCenter: 'Center Panel', menuBubble: 'Show Bubble', menuBubbleAction: 'Bubble Action', menuLanguage: 'Language',
      subscriptionSuccess: 'Subscription successful! Updated {count}',
      saved: 'Saved', uploadSuccess: 'Upload successful!',
      downloadSuccess: 'Download successful! Rules saved.',
      noRulesExport: 'No rules to export',
      bcDomain: 'Domain', bcExact: 'Exact', bcWhitelist: 'Whitelist',
      bcDelete: 'Delete', bcDeleteSub: 'Subscription rules cannot be deleted', bcConfirm: 'Confirm',
      cannotBlockCurrentSite: 'Cannot block search engine own domain: {domain}',
      statsErrors: 'Found {count} rule errors:',
      matchedCountLabel: 'Hits', matchedCountUnit: 'Rule',
      menuBubbleActionOpen: 'Open Panel', menuBubbleActionStats: 'Open Stats', menuBubbleActionToggle: 'Show Results',
      bubbleStatsHint: 'Click to open stats, long-press to open panel',
      bubbleToggleHint: 'Click to show/hide blocked results, long-press to open panel',
      bubbleSelectorsHint: 'Click to open custom engine, long-press to open panel',
      subLinkEmpty: 'URL is empty', subImportSuccess: 'Import success',
      subImportFailed: 'Import failed, check URL or network',
      fileImportFailed: 'Import failed, file content is not valid rules', importClearConfirm: 'The imported file contains no rules. Clear all local rules?', webdavClearConfirm: 'The cloud file contains no rules. Clear all local rules?',
      webdavUploading: 'Uploading...', webdavDownloading: 'Downloading...',
      webdavUploadFailed: 'Upload failed: ', webdavDownloadFailed: 'Download failed: ',
      webdavSyncLocked: 'Sync is currently in progress, please try again later',
      webdavHttpsRequired: 'For security, WebDAV server must use HTTPS',
      networkError: 'Network error', requestTimeout: 'Request timeout',
      subLinkInvalid: 'Invalid URL', importing: 'Importing', whitelistResult: 'This result is whitelisted',
      autoSync: 'Auto Sync', syncScriptConfig: 'Sync Config',
      webdavUrlEmpty: 'WebDAV URL is empty',
      highlightRules: 'Highlight Rules', menuHighlightColor: '🎨 Highlight Colors',
      hlColorTitle: 'Highlight Colors', hlColorReset: 'Reset', resetPending: 'Reset, takes effect after saving', hlColorHint: 'Click a swatch to apply it quickly.',
      autoUpdate: 'Auto Update', errorWord: 'Error',
      duplicateRules: 'Duplicate Rules', invalidRule: 'Invalid rule',
      hlColorError: 'Highlight index must be > 0',
      ifParenError: 'Unbalanced @if(...) parentheses',
      condRegexError: 'Invalid condition regex: {part}',
      regexError: 'Invalid regex', urlError: 'Invalid URL rule',
      ruleDuplicate: 'duplicated {count} times', emptyPrefixRule: 'Missing content after rule prefix',
      invalidRegexFlags: 'Invalid regular expression flags: {flags}',
      emptyIfCondition: '@if() condition cannot be empty', unknownIfCondition: 'Unknown @if condition: {part}',
      condExprError: 'Syntax error in @if expression: {part}',
      invalidUrlWildcard: 'Invalid URL wildcard format: {rule}', elementRuleUnsupported: 'Element rules are not supported',
      menuCustomSelectors: 'Custom Engine', selectorPanelTitle: 'Engine Selectors',
      subscribe: 'Subscribe', engineSubTitle: 'Engine Subscriptions', builtinEngineSub: 'Built-in Engines',
      selectorHint: 'If you don\'t know what it is for, do not modify it.',
      selectorJsonError: 'Failed to parse, check the format',
      selectorReservedKey: 'Reserved key not allowed: {key}',
      selectorInvalidKey: 'Engine id allows letters/digits/_/- only: {key}',
      selectorInvalidRegex: 'Invalid match regex: {key}',
      selectorInvalidCss: 'Invalid CSS selector: {key}.{field}: {value}',
      selectorLegacyField: 'Unsupported legacy field: {key}.{field}',
      selectorInvalidCommand: 'Invalid value command: {key}.{field}: {value}',
      selectorFieldRequired: 'Required field: {key}.{field}',
      selectorInvalidBool: 'Field must be a boolean: {key}.{field}',
    }
  };

  // Map
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

  const validationCache = new Map(); const subdomainCache = new Map(); let cachedSubscriptionRules = null; let _subscriptionStoreSignature = null; let forceReprocessBatchId = 0; let _hiddenParentCount = 0;
  function t(key, params = {}) {
    const lang = currentConfig.language; const texts = LANG_TEXTS[lang] || LANG_TEXTS['zh-CN']; let text = texts[key] || key;
    for (const [k, v] of Object.entries(params)) {
      text = text.replaceAll(`{${k}}`, () => v);
    }
    return text;
  }

  // 调用开始
  function escHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function showToast(message, type = 'info', duration = 3000) {
    let container = document.getElementById('serh-toast-container');
    if (!container) {
      container = document.createElement('div'); container.id = 'serh-toast-container'; document.body.appendChild(container);
    }

    const panel = document.getElementById('serh-webdav-panel') ||
      document.getElementById('serh-subscription-panel') ||
      document.getElementById('serh-engine-sub-panel') ||
      document.getElementById('serh-hlcolor-panel') ||
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
      container.style.position = ''; container.style.top = ''; container.style.right = ''; container.style.left = ''; container.style.bottom = ''; container.style.width = ''; container.style.maxWidth = '';
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

  const RULE_PREFIX_RE = /^(?:title|text|host|path|url|scheme|u|t)\//i;
  const RULE_PREFIX_REGEX_RE = /^(?:title|text|host|path|url|scheme|u|t)\/(?:[^/\\]|\\.)*\//i;
  const RULE_LEADING_REGEX_RE = /^\/(?:[^/\\]|\\.)*\//;
  const REGEX_CTX_A = /(?:^|[\s(&|!])(?:title|text|url|host|path|scheme|u|t)\s*=~$/i;
  const REGEX_CTX_B = /(?:^|[\s(&|!])(?:title|text|url|host|path|scheme|u|t)$/i;
  const REGEX_CTX_C = /(?:^|[\s(&|!])(?:title|text|url|host|path|scheme|u|t)\s*=$/i;
  const RULE_REGEX_LIT_RE = /^\/(?:[^/\\[\]()]|\\.|\[(?:[^\]\\]|\\.)*\]|\((?:[^/\\[\]()]|\\.)*\))+\//;
  const REGEX_CTX_D = /(?:^|[\s(&|!])(?:title|text|url|host|path|scheme|u|t)\s*(?:\^=|\$=|\*=|:)$/i;
  function regexStartAhead(str, pos) {
    const prev = str.slice(Math.max(0, pos - 64), pos).trimEnd();
    return REGEX_CTX_A.test(prev) || REGEX_CTX_B.test(prev) || (REGEX_CTX_C.test(prev) && (RULE_REGEX_LIT_RE.test(str.slice(pos, Math.min(str.length, pos + 4096))) || (str[pos] === '/' && regexCloseAhead(str, pos)))) || (REGEX_CTX_D.test(prev) && regexCloseAhead(str, pos));
  }
  function regexCloseAhead(str, pos) {
    let inClass = false;
    for (let j = pos + 1; j < str.length; j++) {
      const ch = str[j];
      if (ch === '\\') { j++; continue; }
      if (ch === '\n') return false;
      if (inClass) { if (ch === ']') inClass = false; continue; }
      if (ch === '[') { inClass = true; continue; }
      if (ch === '/') { let k = j + 1; while (k < str.length && /[a-z]/i.test(str[k])) k++; if (k >= str.length || /[\s)&|]/.test(str[k])) return true; }
    }
    return false;
  }
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
    const tailIsCond = (end) => { let m = end + 1; while (m < n && /\s/.test(str[m])) m++; return m >= n || str[m] === '#' || str.substr(m, 3).toLowerCase() === '@if'; };
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
      if (ch === '"') { inDQ = true; continue; }
      if (ch === '/' && !inRE) {
        if (regexStartAhead(str, i)) { inRE = true; continue; }
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
        let j = i + 3; while (j < n && /\s/.test(str[j])) j++;
        const hasParen = str[j] === '(';
        const end = hasParen ? findBalancedParenEnd(str, j) : -1;
        const isCond = hasParen && (isBoundary || end === -1 || tailIsCond(end));
        if (strip) {
          if (isCond) atIf = true;
          i += 2; continue;
        }
        if (isCond) {
          occurrences.push({ index: i, condStart: j, endIndex: end });
          if (end !== -1) { i = end; justClosedIf = true; }
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
            if (/^#(?:#|@#|@?[$?%]{1,2}#)/.test(str.slice(i)) && !isScriptRuleLine(str.slice(0, end))) continue;
            if (pfxStart !== -1 && isBadRegexTail(str.slice(pfxStart, end)) && !isBadRegexTail(str.slice(pfxStart))) continue;
            return { stripped: str.slice(0, end), occurrences };
          }
        }
      }
    }
    return { stripped: str, occurrences };
  }

  function findBalancedParenEnd(str, openIdx) {
    let depth = 0, inSQ = false; let inDQ = false; let inRE = false; let inReClass = false;
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
        if (regexStartAhead(str, i)) { inRE = true; continue; }
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

    const lines = textarea.value.split('\n'); const len = lines.length; const token = ++target.token; const fmRange = findYamlFrontmatterRange(lines);
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
        const inFrontmatter = fmRange && i >= fmRange.start && i <= fmRange.end;
        const analysis = target.syntaxCheck && !inFrontmatter && currentConfig.errorDetection !== false ? cachedAnalyzeRule(lines[i]) : { valid: true, errors: [] }; const valid = analysis.valid;
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
          if (regexStartAhead(text, j)) {
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
      return `top: 60%; left: 50%; --serh-panel-tf: translate(-50%, -50%);`;
    }

    let rect;
    if (statusBtn) {
      rect = statusBtn.getBoundingClientRect();
    } else {
      rect = { left: window.innerWidth - 50, right: window.innerWidth - 10, top: window.innerHeight - 50, bottom: window.innerHeight - 10, width: 40, height: 40 };
    }
    const centerX = rect.left + rect.width / 2; const centerY = rect.top + rect.height / 2; const isLeft = centerX < window.innerWidth / 2; const isTop = centerY < window.innerHeight / 2;

    if (isLeft && isTop) return 'top: 10px; left: 10px; --serh-panel-tf: translate(0, 0);'; if (!isLeft && isTop) return 'top: 10px; right: 10px; --serh-panel-tf: translate(0, 0);';
    if (isLeft && !isTop) return 'bottom: 10px; left: 10px; --serh-panel-tf: translate(0, 0);'; return 'bottom: 10px; right: 10px; --serh-panel-tf: translate(0, 0);';
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
    applyDarkModeClass(); applyUiScale();
    requestAnimationFrame(() => requestAnimationFrame(() => panel.classList.add('show'))); return panel;
  }

  function fadeOutAndRemovePanel(panel, onClosed) {
    closeExportMenu(); panel.classList.remove('show'); panel._fading = true; let done = false;
    const finish = () => {
      if (done) return; done = true; panel.remove(); if (onClosed) onClosed();
      if (!isSerhPanelOpen()) {
        checkAutoSubscription();
        if (_webdavSyncPendingWhenPanelOpen) {
          _webdavSyncPendingWhenPanelOpen = false;
          triggerWebDAVSyncDelayed(1000);
        } else {
          checkAutoWebDAV();
        }
      }
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
      const otherPanel = e.target && e.target.closest && e.target.closest('.serh-window');
      if (panel.id === 'serh-selector-panel' && otherPanel && otherPanel.id === 'serh-engine-sub-panel') return;
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
      if (panel.isConnected && !panel._fading) {
        document.addEventListener('pointerdown', pressHandler); document.addEventListener('mousedown', pressHandler); document.addEventListener('click', closeHandler);
      }
    }, 200);
    return closePanel;
  }

  function openPanel(id, { width = '320px', padding = '15px', beforeClose = null, bindClose = true } = {}) {
    injectWidgetStyles();
    const existing = document.getElementById(id);
    if (existing && !existing._fading) return null;
    if (existing) existing.remove();
    const panel = createPanel(id, width, padding);
    panel._beforeClose = typeof beforeClose === 'function' ? beforeClose : null;
    return { panel, closePanel: bindClose ? bindOutsideClickClose(panel, beforeClose) : null };
  }

  function openSerhPanels() { return Array.from(document.querySelectorAll('.serh-window')).filter(p => !p._fading); }
  function closeAllSerhPanels() {
    if (_panelCloseTimer) { clearTimeout(_panelCloseTimer); _panelCloseTimer = null; }
    if (_panelCloseHandler) { document.removeEventListener('click', _panelCloseHandler); _panelCloseHandler = null; }
    if (_panelPressHandler) { document.removeEventListener('pointerdown', _panelPressHandler); document.removeEventListener('mousedown', _panelPressHandler); _panelPressHandler = null; }
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
    if (currentConfig.bubbleAction === 'openSelectors') return 'selectors';
    return currentConfig.bubbleAction === 'openStats' ? 'stats' : 'panel';
  }

  function subscriptionsSignature(subs) {
    return JSON.stringify((Array.isArray(subs) ? subs : [])
      .filter(s => s && s.url)
      .map(s => [s.url, s.name || '', s.enabled !== false])
      .sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  }

  function buildDavPutHeaders(headers, uploadedTime, guard = null) {
    const putHeaders = {
      ...headers,
      'Content-Type': 'text/plain; charset=utf-8',
      'X-OC-Mtime': Math.floor(uploadedTime / 1000).toString()
    };
    if (guard) {
      if (guard.ifNoneMatch) putHeaders['If-None-Match'] = '*';
      else if (guard.etag) putHeaders['If-Match'] = guard.etag;
      else if (guard.lastMod) putHeaders['If-Unmodified-Since'] = guard.lastMod;
    }
    return putHeaders;
  }

  function persistSyncSnapshots(rules, { modifiedTime = null, settingsModifiedAt = null, subs = null, engineSubs = null, selectors = null, config = null } = {}) {
    if (settingsModifiedAt !== null && GM_getValue(WEBDAV_SYNC_CONFIG_KEY, false)) GM_setValue(SETTINGS_LAST_MODIFIED_KEY, settingsModifiedAt);
    if (modifiedTime !== null) GM_setValue(LOCAL_LAST_MODIFIED_KEY, modifiedTime);
    setRuleSyncSnapshot(rules, config);
    if (GM_getValue(WEBDAV_SYNC_CONFIG_KEY, false)) setSubscriptionSyncSnapshot(subs || getSubscriptions(), config);
    if (GM_getValue(WEBDAV_SYNC_CONFIG_KEY, false)) setEngineSubSyncSnapshot(engineSubs || getEngineSubscriptions(), config);
    if (GM_getValue(WEBDAV_SYNC_CONFIG_KEY, false) && selectors !== null) setSelectorSyncSnapshot(selectors, config);
  }

  async function putWebDAVRules(ctx, content, uploadedTime, remotePreserved, putHeaders) {
    const settingsModifiedAt = GM_getValue(WEBDAV_SYNC_CONFIG_KEY, false) ? (ctx.settingsModifiedAt ?? getSettingsModifiedTime()) : null;
    const rulesModifiedAt = ctx.rulesModifiedAt ?? uploadedTime; const selectors = GM_getValue(WEBDAV_SYNC_CONFIG_KEY, false) ? getUserSelectors() : null;
    const rulesSnapshot = Array.isArray(ctx.rules) ? ctx.rules.slice() : ctx.rules; const uploadData = buildUploadContent(content, rulesModifiedAt, { ...remotePreserved, settingsModifiedAt });
    await gmPutWebDAV(ctx.fullUrl, { headers: putHeaders, data: uploadData }, ctx.folderUrl, ctx.headers);
    persistSyncSnapshots(rulesSnapshot, { modifiedTime: rulesModifiedAt, settingsModifiedAt, subs: ctx.subs, engineSubs: ctx.engineSubs, selectors, config: ctx.config || null });
  }
  // 调用结束

  function hostLabelToASCII(label) {
    const s = String(label || ''); if (!s || s === '*' || /^[a-z0-9_-]*$/i.test(s)) return s;
    try {
      const ascii = new URL('http://' + s + '.invalid').hostname; if (ascii.toLowerCase().endsWith('.invalid')) return ascii.slice(0, -8);
    } catch (e) {}
    return s;
  }

  function toASCIIHostname(host, keepTrailingDot = false) {
    let raw = String(host || '').trim().toLowerCase(); if (!keepTrailingDot) raw = raw.replace(/\.$/, ''); if (!raw) return ''; const colonIdx = raw.indexOf(':');
    if (colonIdx !== -1) {
      const h = raw.slice(0, colonIdx); const p = raw.slice(colonIdx); return (h ? toASCIIHostname(h, keepTrailingDot) : '') + p;
    }
    if (/^[\x00-\x7F]*$/.test(raw)) return raw; return raw.split('.').map(label => label ? hostLabelToASCII(label) : label).join('.');
  }

  function punycodeDecodeLabel(label) {
    const s = String(label || '').toLowerCase(); if (!s.startsWith('xn--')) return label; const body = s.slice(4);
    const base = 36, tmin = 1, tmax = 26, skew = 38, damp = 700, initialBias = 72, initialN = 128; let n = initialN, i = 0, bias = initialBias; const output = [];
    const delimPos = body.lastIndexOf('-'); let pos = 0;
    if (delimPos > 0) { for (; pos < delimPos; ++pos) output.push(body.charCodeAt(pos)); pos++; } else if (delimPos === 0) pos++;
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
      if (!(label && label.toLowerCase().startsWith('xn--'))) return label;
      try { return punycodeDecodeLabel(label); } catch (_) { return label; }
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
    try { return decodeURIComponent(String(str ?? '')); } catch (e) { return String(str ?? ''); }
  }

  function decodeUrlForMatch(url) {
    const raw = String(url ?? ''); if (!raw) return '';
    try {
      const abs = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) || raw.startsWith('//');
      if (!abs) return safeDecodeURIComponent(raw);
      const u = new URL(raw.startsWith('//') ? 'http:' + raw : raw); const host = toUnicodeHostname(u.hostname);
      const auth = u.username ? u.username + (u.password ? ':' + u.password : '') + '@' : ''; const port = u.port ? ':' + u.port : '';
      const tail = safeDecodeURIComponent(u.pathname) + u.search + u.hash;
      return (raw.startsWith('//') ? '//' : u.protocol + '//') + auth + host + port + tail;
    } catch (_) { return safeDecodeURIComponent(raw); }
  }

  function encodeNonAscii(str) {
    const s = String(str ?? ''); return /[^\x00-\x7F]/.test(s) ? s.replace(/[^\x00-\x7F]/gu, ch => encodeURIComponent(ch)) : s;
  }

  function filterValidRuleLines(lines) {
    return lines.map(line => line.trim()).filter(line => line.length > 0);
  }

  function findYamlFrontmatterRange(lines) {
    const arr = Array.isArray(lines) ? lines : String(lines ?? '').split('\n');
    let first = -1;
    for (let i = 0; i < arr.length; i++) { if (String(arr[i] ?? '').trim() !== '') { first = i; break; } }
    if (first === -1 || String(arr[first] ?? '').trim() !== '---') return null;
    for (let i = first + 1; i < arr.length; i++) { const s = String(arr[i] ?? '').trim(); if (s === '---' || s === '...') return { start: first, end: i }; }
    return null;
  }

  function hasEffectiveRules(lines) {
    return (Array.isArray(lines) ? lines : []).some(line => { const s = String(line || '').trim(); return s && !s.startsWith('#') && !!stripRuleComment(s).trim(); });
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
      if (/(?:=|\^=|\$=|\*=|:)$/.test(s) || /^(url|title|text|host|path|scheme|u|t)$/i.test(s)) {
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

  // 递归下降
  function parseCondExprTokens(tokens, leafParser, errors) {
    let pos = 0, depth = 0; const peek = () => tokens[pos]; const next = () => tokens[pos++];
    const syntaxError = () => {
      errors.push({ kind: 'syntax' }); return { type: 'const', value: false };
    };
    const tooDeep = () => { if (++depth <= 3000) return false; syntaxError(); return true; };

    function parseOr() {
      if (tooDeep()) return { type: 'const', value: false };
      try {
        const children = [parseAnd()];
        while (peek() === '|') { next(); children.push(parseAnd()); }
        return children.length === 1 ? children[0] : { type: 'or', children };
      } finally { depth--; }
    }
    function parseAnd() {
      const children = [parseNot()];
      while (peek() === '&') { next(); children.push(parseNot()); }
      return children.length === 1 ? children[0] : { type: 'and', children };
    }
    function parseNot() {
      if (tooDeep()) return { type: 'const', value: false };
      try {
        if (peek() === '!') { next(); return { type: 'not', child: parseNot() }; }
        return parsePrimary();
      } finally { depth--; }
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
        const m = trimmed.match(/^(?:title|text|url|host|path|scheme|u|t)\s*(?:=\~\s*|=\s*)?\/((?:[^/\\\[]|\\.|\[(?:[^\]\\]|\\.)*\])*)\/([a-z]*)$/i); if (!m) return null;
        const seg = m[2] || ''; const explicit = /^(?:title|text|url|host|path|scheme|u|t)\s*=\~\s*\//i.test(trimmed);
        return isUniqueFlagsStr(seg) || (explicit && /^[a-z]+$/i.test(seg)) ? seg.toLowerCase() : (isFlagsCandidateError(seg) ? seg : '');
      })();
      if (regexLeafFlags && getInvalidRegexFlags(regexLeafFlags)) {
        errors.push({ kind: 'flags', part: getInvalidRegexFlags(regexLeafFlags) }); return { type: 'const', value: false };
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

  function evalDynamicLeaf(cond, title, url, snippet) {
    const foldUrl = (value) => {
      const raw = String(value || ''); if (!raw) return '';
      const abs = /:\/\//.test(raw) || raw.startsWith('//'); let out = raw;
      if (abs) out = toASCIIUrl(raw) || raw;
      else if (/[^\x00-\x7F]/.test(raw) && /^[^/?#\s]+\.[^/?#\s]+/.test(raw)) {
        const host = raw.split(/[/?#]/)[0]; const port = /:\d+$/.exec(host); const ascii = toASCIIHostname(host.replace(/:\d+$/, ''));
        if (ascii && ascii !== host) out = ascii + (port ? port[0] : '') + raw.slice(host.length);
      }
      out = encodeNonAscii(out); return out.toLowerCase();
    };
    if (cond.type === 'title' || cond.type === 'text') {
      const source = cond.type === 'title' ? title : snippet;
      if (!source || (cond.op !== '=~' && !cond.val)) return false; const lower = source.toLowerCase(); if (cond.op === '=') return lower === cond.val; if (cond.op === '^=') return lower.startsWith(cond.val);
      if (cond.op === '$=') return lower.endsWith(cond.val); if (cond.op === '*=') return lower.includes(cond.val); if (cond.op === '=~') return safeRegexTest(cond.regex, source);
      return false;
    }
    if (cond.type === 'url') {
      if (!url || (cond.op !== '=~' && !cond.val)) return false; const lowerUrl = url.toLowerCase();
      const cmpUrl = foldUrl(cond.op === '=~' ? '' : cond.val); const urlHit = (pred) => pred(lowerUrl) || pred(foldUrl(url));
      if (cond.op === '=') return urlHit(v => v === cmpUrl); if (cond.op === '^=') return urlHit(v => v.startsWith(cmpUrl)) || (!/:\/\//.test(cmpUrl) && urlHit(v => v.replace(/^[a-z][a-z0-9+.-]*:\/\//, '').startsWith(cmpUrl)));
      if (cond.op === '$=') return urlHit(v => v.endsWith(cmpUrl)); if (cond.op === '*=') return urlHit(v => v.includes(cmpUrl));
      if (cond.op === '=~') {
        if (safeRegexTest(cond.regex, url)) return true;
        const folded = decodeUrlForMatch(url);
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
      const cmpVal = cond.type === 'host' ? toASCIIHostname(cond.val, cond.op === '^=' || cond.op === '*=') : cond.val; if (cond.op !== '=~' && !cmpVal) return false; const hasPortInCond = cond.type === 'host' && cmpVal.includes(':');
      const raw = cond.type === 'host' ? (hasPortInCond ? toASCIIHostname(u.host || u.hostname) : toASCIIHostname(u.hostname))
        : cond.type === 'path' ? (u.pathname + u.search)
        : u.protocol.slice(0, -1); const value = raw.toLowerCase(); let cmpFolded = cmpVal; let altValue = value; let altCmpVal = cmpVal;
      if (cond.type === 'path') {
        cmpFolded = foldUrl(cmpVal); altValue = (safeDecodeURIComponent(u.pathname) + u.search).toLowerCase(); altCmpVal = safeDecodeURIComponent(cmpVal).toLowerCase();
      }
      if (cond.op === '=') return value === cmpFolded || altValue === altCmpVal; if (cond.op === '^=') return value.startsWith(cmpFolded) || altValue.startsWith(altCmpVal);
      if (cond.op === '$=') {
        if (cond.type === 'host') {
          const target = cmpVal.replace(/^\.+|\.+$/g, ''); if (target.startsWith(':')) return value.endsWith(target);
          return value === target || value.endsWith(`.${target}`);
        }
        return value.endsWith(cmpFolded) || altValue.endsWith(altCmpVal);
      }
      if (cond.op === '*=') return value.includes(cmpFolded) || altValue.includes(altCmpVal);
      if (cond.op === '=~') {
        if (cond.type === 'host') {
          const uHost = u.hostname; let unicodeHost = uHost;
          try {
            unicodeHost = toUnicodeHostname(uHost);
          } catch (_) {}
          const unicodeFullHost = u.port ? unicodeHost + ':' + u.port : unicodeHost;
          return safeRegexTest(cond.regex, raw) || safeRegexTest(cond.regex, uHost) || safeRegexTest(cond.regex, unicodeHost) || safeRegexTest(cond.regex, u.host) || safeRegexTest(cond.regex, unicodeFullHost);
        }
        return safeRegexTest(cond.regex, raw) || safeRegexTest(cond.regex, cond.type === 'path' ? safeDecodeURIComponent(u.pathname) + u.search : safeDecodeURIComponent(raw));
      }
      return false;
    }
    return false;
  }

  function evalCondAST(ast, title, url, snippet) {
    if (!ast) return true;
    if (ast.type === 'and') {
      for (let i = 0; i < ast.children.length; i++) {
        if (!evalCondAST(ast.children[i], title, url, snippet)) return false;
      }
      return true;
    }
    if (ast.type === 'or') {
      for (let i = 0; i < ast.children.length; i++) {
        if (evalCondAST(ast.children[i], title, url, snippet)) return true;
      }
      return false;
    }
    if (ast.type === 'not') return !evalCondAST(ast.child, title, url, snippet); if (ast.type === 'leaf') return evalDynamicLeaf(ast.cond, title, url, snippet); return !!ast.value;
  }

  function siteAliasMap() {
    if (_siteAliasMap) return _siteAliasMap;
    const defs = getSelectors(); const adj = new Map();
    const link = (a, b) => { if (!adj.has(a)) adj.set(a, new Set()); if (!adj.has(b)) adj.set(b, new Set()); adj.get(a).add(b); adj.get(b).add(a); };
    for (const id of Object.keys(defs)) {
      const key = String(id).toLowerCase(); if (!adj.has(key)) adj.set(key, new Set());
      for (const alias of normalizeSiteList(defs[id] && defs[id].site)) { const a = alias.toLowerCase(); if (a && a !== key) link(key, a); }
    }
    const groups = new Map();
    for (const node of adj.keys()) {
      if (groups.has(node)) continue;
      const comp = new Set(), stack = [node];
      while (stack.length) { const n = stack.pop(); if (comp.has(n)) continue; comp.add(n); for (const m of adj.get(n) || []) if (!comp.has(m)) stack.push(m); }
      const group = [...comp].sort().join('\u0000');
      for (const n of comp) groups.set(n, group);
    }
    _siteAliasMap = groups; return groups;
  }
  function siteKey(value) { const k = String(value || '').toLowerCase(); return siteAliasMap().get(k) || k; }
  function parseConditionPart(trimmed, currentEngine, currentSite, currentCategory) {
    const enginePropMatch = trimmed.match(/^(?:\$site|engine)\s*[=:]\s*(?:['"](.*?)['"]|([^\s\)]+))\s*i?\s*$/i);
    if (enginePropMatch) {
      const target = String(enginePropMatch[1] !== undefined ? enginePropMatch[1] : (enginePropMatch[2] || '')).trim().toLowerCase();
      return { matched: true, static: !!target && siteKey(target) === siteKey(currentEngine) };
    }

    const categoryMatch = trimmed.match(/^(?:\$category|category)\s*[=:]\s*(?:['"](.*?)['"]|([^\s\)]+))\s*i?\s*$/i);
    if (categoryMatch) {
      const target = (categoryMatch[1] !== undefined ? categoryMatch[1] : categoryMatch[2]).trim().toLowerCase(); return { matched: true, static: String(currentCategory || 'web').toLowerCase() === target };
    }

    let siteMatch = trimmed.match(/^site\s*[=:]\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|([^\s\)]+))\s*i?\s*$/i);
    if (!siteMatch) siteMatch = trimmed.match(/^site\s*\(\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|([^\s\)]+))\s*\)\s*i?\s*$/i);
    if (siteMatch) {
      const rawVal = (siteMatch[1] !== undefined ? siteMatch[1] : (siteMatch[2] !== undefined ? siteMatch[2] : siteMatch[3])); const target = toASCIIHostname(rawVal.trim().replace(/^\.+|\.+$/g, ''));
      const curSite = toASCIIHostname(String(currentSite || ''));
      return { matched: true, static: curSite === target || curSite.endsWith(`.${target}`) };
    }

    const shorthandRe = trimmed.match(/^(title|text|url|host|path|scheme|u|t)\/(.+)$/i);
    if (shorthandRe) {
      const pre = parsePrefixedRegexRule(trimmed, shorthandRe[1].length + 1);
      const condType = (s => s === 'u' ? 'url' : s === 't' ? 'title' : s)(shorthandRe[1].toLowerCase());
      const badFlags = pre.flagsCandidate && (isFlagsCandidateError(pre.flagsCandidate) || (/^[imsu]+$/i.test(pre.flagsCandidate) && !!getInvalidRegexFlags(pre.flagsCandidate)));
      if (!pre.unclosed && String(pre.pattern || '').trim() && !getInvalidRegexFlags(pre.flags) && !badFlags) {
        return { matched: true, dynamic: { type: condType, op: '=~', regex: new RegExp(pre.pattern, pre.flags) } };
      }
      return { matched: false };
    }

    const eqRe = trimmed.match(/^(title|text|url|host|path|scheme|u|t)\s*(?:=\~\s*|=\s*)?\/((?:[^/\\\[]|\\.|\[(?:[^\]\\]|\\.)*\])*)\/([a-z]*)$/i);
    const eqSeg = eqRe ? String(eqRe[3] || '') : ''; const eqFlags = eqRe && isUniqueFlagsStr(eqSeg) ? eqSeg.toLowerCase() : '';
    const eqReOk = eqRe && !getInvalidRegexFlags(eqFlags) && (eqFlags || !eqSeg || (!/^(title|text|url|host|path|scheme|u|t)\s*=/i.test(trimmed) && !isFlagsCandidateError(eqSeg))) && (String(eqRe[2] || '').trim() || eqSeg);
    const strMatch = eqReOk ? null : trimmed.match(/^(title|text|url|host|path|scheme|u|t)\s*(\^=|\$=|\*=|=|:)\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|([^\s"']+))\s*i?\s*$/i);
    if (strMatch) {
      if (strMatch[5] !== undefined && strMatch[5].startsWith('~')) return { matched: false };
      const bareEq = (strMatch[2] === '=' && strMatch[5] !== undefined) ? strMatch[5].match(/^\/((?:[^/\\\[\]]|\\.|\[(?:[^\]\\]|\\.)*\])+)\/([a-z]*)$/i) : null;
      if (bareEq && (!bareEq[2] || isUniqueFlagsStr(bareEq[2]) || isFlagsCandidateError(bareEq[2]))) return { matched: false };
      const op = strMatch[2] === ':' ? '=' : strMatch[2];
      const rawVal = (strMatch[3] !== undefined ? strMatch[3] : (strMatch[4] !== undefined ? strMatch[4] : strMatch[5])); let val = rawVal.replace(/\\(["'])/g, '$1').toLowerCase();
      const condType = (s => s === 'u' ? 'url' : s === 't' ? 'title' : s)(strMatch[1].toLowerCase()); if (condType === 'host') val = val.startsWith('/') ? val : toASCIIHostname(val, op === '^=' || op === '*='); return { matched: true, dynamic: { type: condType, op, val } };
    }

    const reMatch = trimmed.match(/^(title|text|url|host|path|scheme|u|t)\s*(?:=\~\s*|=\s*)?\/((?:[^/\\\[]|\\.|\[(?:[^\]\\]|\\.)*\])*)\/([a-z]*)$/i);
    if (reMatch) {
      const condType = (s => s === 'u' ? 'url' : s === 't' ? 'title' : s)(reMatch[1].toLowerCase()); const seg = String(reMatch[3] || ''); const flags = isUniqueFlagsStr(seg) ? seg.toLowerCase() : '';
      const shorthand = !/^(title|text|url|host|path|scheme|u|t)\s*=/i.test(trimmed);
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
  function isFlagsCandidateError(seg) { seg = String(seg || ''); return /^[imsugy]+$/i.test(seg) && !!getInvalidRegexFlags(seg); }
  function hasBareRegexSlash(pattern) {
    let inClass = false;
    for (let i = 0; i < pattern.length; i++) {
      const ch = pattern[i];
      if (ch === '\\') { i++; continue; }
      if (inClass) { if (ch === ']') inClass = false; continue; }
      if (ch === '[') { inClass = true; continue; }
      if (ch === '/') return true;
    }
    return false;
  }

  function validateUrlWildcard(rule) {
    if (!rule || /[<>"]/.test(rule) || /\s/.test(rule)) return false; if (rule.startsWith('|') || rule.startsWith('@@')) return false; if (rule.includes('^')) return false;
    if (rule.includes('://')) {
      const scheme = rule.split('://')[0]; if (scheme !== '*' && !/^[a-z][a-z0-9+.-]*$/.test(scheme.toLowerCase())) return false;
    }
    const hostPart = rule.includes('://') ? (rule.split('/')[2] || '') : rule.split('/')[0]; if (/[$~]/.test(hostPart)) return false;
    if (rule.includes('://') ? !hostPart : /^[a-z][a-z0-9+.-]*:$/i.test(hostPart)) return false;
    if (/^\*:\/\/\*\*+/.test(rule) || /^\*{2,}:\//.test(rule) || /\*{3,}/.test(rule)) return false; if (rule.startsWith('*://') && !/^\*:\/\/[^/]+(?:\/.*)?$/.test(rule)) return false; return true;
  }

  function evaluateCondition(condStr, dynamicConditionsList) {
    const { ast, errors } = analyzeCondExpr(condStr); if (errors.length || !ast) return false; const folded = foldCondExpr(ast); if (folded.type === 'const') return folded.value;
    dynamicConditionsList.push(folded); return true;
  }

  function stripIfConditions(ruleStr, evaluateCond) {
    let coreRule = ruleStr.trim(), staticPass = true;

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
    if (!/^\s*(?:!|\(|\$site\b|\$category\b|engine\b|category\b|(?:site|title|text|url|host|path|scheme|u|t)\s*(?:=~|\^=|\$=|\*=|=|:|\/))/i.test(str)) return false;
    return /(?:^|[\s(&|!])(?:\$site|\$category|engine|category|site|title|text|url|host|path|scheme|u|t)\s*(?:(?:=~|\^=|\$=|\*=|=|:)\s+\S|(?:=~|\^=|\$=|\*=|=|:)\S|\/)/i.test(str)
      || /^\s*!\s*(?:(?:\$site|\$category|engine|category|site|title|text|url|host|path|scheme|u|t)\b|\()/i.test(str);
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

    const standaloneExpr = !!absorbed || staticMatchAll || (!coreRule && dynamicConditions.length > 0); if (whitelist) coreRule = '@' + coreRule;
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
    const errors = []; const { errors: rawErrors } = analyzeCondExpr(condStr);
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
    return { errors };
  }

  function analyzeRule(rule) {
    if (!rule || rule.trim() === '') return { valid: true, errors: [] };

    let ruleToCheck = rule.trim(); if (ruleToCheck.startsWith('#')) return { valid: true, errors: [] }; ruleToCheck = stripRuleComment(ruleToCheck);
    if (!ruleToCheck) return { valid: true, errors: [] }; const errors = [];
    let hlN = null; const hlValMatch = ruleToCheck.match(/^@(\d+)(?=\s|$|\*:\/\/|https?:\/\/|\/|title\/|text\/|(?:title|text|host|path|url|scheme|u|t|site|engine|category|\$site|\$category)\s*(?:=~|\^=|\$=|\*=|=|:|\/)|(?:[(!]|@if\b))/i);
    if (hlValMatch) {
      const N = parseInt(hlValMatch[1]); if (N < 1) return { valid: false, errors: [t('hlColorError')] };
      hlN = N > 5 ? 1 : N; ruleToCheck = ruleToCheck.substring(hlValMatch[0].length).trim(); if (!ruleToCheck) return { valid: false, errors: [t('emptyPrefixRule')] };
    }

    if (/^@@if\b/i.test(ruleToCheck)) return { valid: false, errors: [t('invalidUrlWildcard', { rule: ruleToCheck })] };
    const hasIfCond = /@if\s*\(/i.test(ruleToCheck);
    if (hasIfCond) {
        let unbalanced = false;
        for (const occ of findIfOccurrences(ruleToCheck)) {
          if (!extractBalancedParens(ruleToCheck, occ.condStart)) { unbalanced = true; break; }
        }
        if (unbalanced) return { valid: false, errors: [t('ifParenError')] };
        for (const cond of extractIfConditions(ruleToCheck)) {
          if (!cond.trim()) {
            errors.push(t('emptyIfCondition')); continue;
          }
          const r = validateCondition(cond); errors.push(...r.errors);
        }
    }

    const stripped = stripIfConditions(ruleToCheck); ruleToCheck = stripped.coreRule;
    if (ruleToCheck.startsWith('@')) {
      if (ruleToCheck.startsWith('@@')) {
        errors.push(t('invalidUrlWildcard', { rule: ruleToCheck })); return { valid: false, errors };
      }
      ruleToCheck = ruleToCheck.substring(1).trim();
      if (!ruleToCheck) {
        if (hasIfCond) return { valid: errors.length === 0, errors }; return { valid: false, errors: [t('emptyPrefixRule')] };
      }
    }

    if (!ruleToCheck) {
      return { valid: errors.length === 0, errors };
    }

    if (isElementRuleLine(ruleToCheck)) { errors.push(t('elementRuleUnsupported')); return { valid: false, errors }; }
    if (looksLikeCondExpr(ruleToCheck)) {
      const r = validateCondition(ruleToCheck); errors.push(...r.errors); return { valid: errors.length === 0, errors };
    }

    if (ruleToCheck.startsWith('/') && ruleToCheck.lastIndexOf('/') === 0) {
      errors.push(t('regexError'));
    }

    try {
      if (ruleToCheck.startsWith('/') && ruleToCheck.lastIndexOf('/') > 0) {
        const { pattern, flags } = ruleToRegex(ruleToCheck);
        if (!pattern.trim() || hasBareRegexSlash(pattern)) {
          errors.push(t('regexError')); return { valid: false, errors };
        }
        const invalidFlags = getInvalidRegexFlags(flags);
        if (invalidFlags) {
          errors.push(t('invalidRegexFlags', { flags: invalidFlags })); return { valid: false, errors };
        }
        new RegExp(pattern, String(flags || '').toLowerCase());
      } else if (/^(?:text|title)\//i.test(ruleToCheck)) {
        const prefixLen = /^title\//i.test(ruleToCheck) ? 6 : 5; const { pattern, flags, flagsCandidate, unclosed } = parsePrefixedRegexRule(ruleToCheck, prefixLen);
        if (unclosed) {
          errors.push(t('regexError')); return { valid: false, errors };
        }
        if (!pattern.trim()) {
          errors.push(t('emptyPrefixRule')); return { valid: false, errors };
        }
        const invalidFlags = getInvalidRegexFlags(flags);
        if (invalidFlags) {
          errors.push(t('invalidRegexFlags', { flags: invalidFlags })); return { valid: false, errors };
        }
        if (flagsCandidate && (isFlagsCandidateError(flagsCandidate) || (/^[imsu]+$/i.test(flagsCandidate) && getInvalidRegexFlags(flagsCandidate)))) {
          errors.push(t('invalidRegexFlags', { flags: getInvalidRegexFlags(flagsCandidate) })); return { valid: false, errors };
        }
        new RegExp(pattern, String(flags || '').toLowerCase());
      } else {
        if (!validateUrlWildcard(ruleToCheck)) {
          errors.push(t('invalidUrlWildcard', { rule: ruleToCheck })); return { valid: false, errors };
        }
        new RegExp(wildcardToRegex(ruleToCheck), 'i');
      }
    } catch (e) {
      errors.push((ruleToCheck.startsWith('/') || /^(?:text|title)\//i.test(ruleToCheck)) ? t('regexError') : t('urlError'));
    }

    return { valid: errors.length === 0, errors };
  }

  function validateRule(rule) {
    return analyzeRule(rule).valid;
  }

  function parsePrefixedRegexRule(rawRule, prefixLen) {
    let memo = parsePrefixedRegexRule._memo; if (!memo) memo = parsePrefixedRegexRule._memo = new Map(); const memoKey = prefixLen + '\u0000' + rawRule;
    if (memo.has(memoKey)) return memo.get(memoKey); let remaining = rawRule.substring(prefixLen); let pattern, flags = ''; let flagsCandidate = ''; let lastSlashIndex = -1; let unclosed = false;
    for (let i = remaining.length - 1; i >= 0; i--) {
      if (remaining[i] === '/') {
        let backslashCount = 0, j = i - 1;
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
      let backslashCount = 0, j = remaining.length - 2;
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
    let out = '', i = 0;
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

    let prefix = '^', hostIsFirst = false;
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
        .join('\\/'); let bs = 0; for (let i = pattern.length - 2; i >= 0 && pattern[i] === '\\'; i--) bs++;
        const lastChar = pattern[pattern.length - 1]; const openEnd = bs % 2 === 0 && (pattern.endsWith('*') || '\\/?#:&='.includes(lastChar));
        return openEnd ? regexStr : regexStr + '(?:[?&#].*)?$';
    }
    return prefix + (hostIsFirst ? escapeHostPart(pattern) : escapeWildcardPart(pattern, false)) + '(?:[\\/?#:&]|$)';
  }

  function ruleToRegex(rule) {
    let memo = ruleToRegex._memo;
    const original = rule;
    if (!memo) memo = ruleToRegex._memo = new Map(); if (memo.has(original)) return memo.get(original); let out; if (rule.startsWith('.')) rule = '*' + rule;
    if (!rule.startsWith('/') && !/^title\//i.test(rule) && !/^text\//i.test(rule) &&
      !rule.includes('://') && !rule.startsWith('.')) {
      const restMatch = rule.match(/^([^/?#]+)([\/?#].*)?$/);
      if (restMatch && restMatch[1].includes('.') && !restMatch[1].includes('*') && !/\s/.test(rule)) {
        rule = restMatch[2] ? '*://*.' + restMatch[1] + (restMatch[2].startsWith('/') ? restMatch[2] : '/' + restMatch[2]) : '*://*.' + rule + '/*';
      }
    }

    if (rule.startsWith('/') && rule.lastIndexOf('/') > 0) {
      const lastSlash = rule.lastIndexOf('/'); const pattern = rule.slice(1, lastSlash); const flags = rule.slice(lastSlash + 1).toLowerCase(); out = { pattern, flags }; memo.set(original, out);
      return out;
    }

    if (/^title\//i.test(rule)) {
      out = parsePrefixedRegexRule(rule, 6); memo.set(original, out); return out;
    }

    if (/^text\//i.test(rule)) {
      out = parsePrefixedRegexRule(rule, 5); memo.set(original, out); return out;
    }

    out = {
      pattern: wildcardToRegex(rule),
      flags: 'i'
    };
    memo.set(original, out); return out;
  }

  function normalizeHostCandidate(host) {
    const domain = toASCIIHostname(String(host || '').replace(/^\.+/, '').replace(/\\/g, ''));
    return /^[a-z0-9_-]+(?:\.[a-z0-9_-]+)+$/.test(domain) ? domain : null;
  }

  function matchWildcardDomainPattern(pattern) {
    if (pattern.startsWith('.')) pattern = '*' + pattern; if (pattern.includes(':') && !pattern.startsWith('*://')) return null; const bareWildcard = pattern.match(/^\*\.([^/\*\s:?#]+)$/);
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
    const wildcardMatch = pattern.match(/^\*:\/\/\*\.([^/\*:@]+)\/\*$/);
    if (wildcardMatch) {
      const domain = normalizeHostCandidate(wildcardMatch[1]); if (domain) return { domain, domainType: 'wildcard' };
    }
    const exactMatch = pattern.match(/^\*:\/\/([^/\*:@]+)\/\*$/);
    if (exactMatch) {
      const domain = normalizeHostCandidate(exactMatch[1]); if (domain) return { domain, domainType: 'exact' };
    }
    return null;
  }

  function compileRuleRegex(coreRule) {
    let memo = compileRuleRegex._memo; if (!memo) memo = compileRuleRegex._memo = new Map(); if (memo.has(coreRule)) return memo.get(coreRule); let type = 'url', pattern = '', flags = '';
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

  function isLocalEntry(entry) {
    if (!entry) return false; if (entry.isLocal !== undefined) return entry.isLocal; return entry.source === t('localRule') || entry.source === '本地规则' || entry.source === 'Local Rule';
  }

  // 预编译
  function buildRuleIndex() {
    const subscriptionRules = getAllSubscriptionRules(); let pageContext = '';
    try {
      pageContext = getSearchEngine() + '|' + getSearchCategory() + '|' + String(window.location.hostname || '');
    } catch (e) {}
    const contentSignature = getRulesModifiedTime() + '|' + _rulesRevision + '|' + (_subscriptionStoreSignature || '') + '|' + currentConfig.language;
    const signature = contentSignature + '|' + pageContext; if (compiledRules && compiledRules.indexSignature === signature) return;
    const contentChanged = !compiledRules || compiledRules.contentSignature !== contentSignature;
    subdomainCache.clear(); validationCache.clear();
    if (contentChanged) {
      if (ruleToRegex._memo) ruleToRegex._memo.clear();
      if (parsePrefixedRegexRule._memo) parsePrefixedRegexRule._memo.clear();
      if (compileRuleRegex._memo) compileRuleRegex._memo.clear();
    }
    compiledRules = newCompiledRules(); compiledRules.contentSignature = contentSignature;
    const allRules = currentConfig.rules.concat(subscriptionRules); const subscriptions = getSubscriptions();
    const localRuleCount = currentConfig.rules.length; const subscriptionSources = [];
    subscriptions.forEach((sub, idx) => {
      if (!sub.enabled || !Array.isArray(sub.rules)) return;
      for (let i = 0; i < sub.rules.length; i++) subscriptionSources.push({ key: 'sub:' + (idx + 1), label: `${t('subscription')}${idx + 1}` });
    });
    while (subscriptionSources.length < subscriptionRules.length) subscriptionSources.push({ key: 'local', label: t('localRule') });
    const hlSets = {domains: compiledRules.highlightDomains, condDomains: compiledRules.highlightConditionalDomains, urls: compiledRules.highlightUrls, titles: compiledRules.highlightTitles, texts: compiledRules.highlightTexts, condRules: compiledRules.highlightConditionalRules};
    const wlSets = {domains: compiledRules.whitelistDomains, condDomains: compiledRules.whitelistConditionalDomains, urls: compiledRules.whitelistUrlPatterns, titles: compiledRules.whitelistTitlePatterns, texts: compiledRules.whitelistTextPatterns, condRules: compiledRules.whitelistConditionalRules};
    const blSets = {domains: compiledRules.domains, condDomains: compiledRules.conditionalDomains, urls: compiledRules.urls, titles: compiledRules.titles, texts: compiledRules.texts, condRules: compiledRules.conditionalRules};

    allRules.forEach((rule, ruleIndex) => {
      if (typeof rule !== 'string') { dbgWarn('非字符串规则项, 已跳过:', rule); return; }
      rule = stripRuleComment(rule.trim()); if (!rule) return; let ruleValid = true;
      try {
        ruleValid = cachedAnalyzeRule(rule).valid;
      } catch (e) {
        ruleValid = false;
      }
      if (!ruleValid) {
        dbgWarn('规则校验未通过, 已跳过:', rule); return;
      }

      const isLocal = ruleIndex < localRuleCount; const sourceInfo = isLocal ? { key: 'local', label: t('localRule') } : (subscriptionSources[ruleIndex - localRuleCount] || { key: 'local', label: t('localRule') });
      const source = sourceInfo.label; const sourceKey = sourceInfo.key;

      const routeRule = (sets, parsed, coreRule, extra) => {
        const hasDynamic = parsed.dynamicConditions.length > 0;
        const base = {originalRule: rule, source, sourceKey, isLocal, ...extra};
        if (!coreRule) {
          if (parsed.standaloneExpr || hasDynamic) sets.condRules.push({type: 'expr', conditions: parsed.dynamicConditions, ...base});
          return;
        }
        if (!coreRule.startsWith('/') && !/^text\//i.test(coreRule) && !/^title\//i.test(coreRule)) {
          const dm = matchWildcardDomainPattern(coreRule);
          if (dm) {
            const map = hasDynamic ? sets.condDomains : sets.domains;
            if (!map.has(dm.domain)) map.set(dm.domain, []);
            map.get(dm.domain).push(hasDynamic
              ? {type: dm.domainType, domainType: dm.domainType, domain: dm.domain, conditions: parsed.dynamicConditions, ...base}
              : {type: dm.domainType, ...base});
            return;
          }
        }
        try {
          const compiled = compileRuleRegex(coreRule);
          if (hasDynamic) sets.condRules.push({type: compiled.type, regex: compiled.regex, conditions: parsed.dynamicConditions, ...base});
          else (compiled.type === 'title' ? sets.titles : compiled.type === 'text' ? sets.texts : sets.urls).push({regex: compiled.regex, ...base});
        } catch (e) {
          dbgWarn('规则编译失败:', rule, e);
        }
      };

      const hlMatch = rule.match(/^@(\d+)(?=\s|$|\*:\/\/|https?:\/\/|\/|title\/|text\/|(?:title|text|host|path|url|scheme|u|t|site|engine|category|\$site|\$category)\s*(?:=~|\^=|\$=|\*=|=|:|\/)|(?:[(!]|@if\b))/i);
      if (hlMatch) {
        let N = parseInt(hlMatch[1]); if (N < 1) return; if (N > 5) N = 1;
        const hlRule = rule.substring(hlMatch[0].length).trim(); if (!hlRule) return;
        let parsed;
        try {
          parsed = parseRuleWithConditions(hlRule);
        } catch (e) {
          dbgWarn('高亮规则解析失败:', hlRule, e); return;
        }
        if (!parsed.staticPass) return;
        let coreRule = parsed.coreRule;
        const highlightWhitelist = coreRule.startsWith('@') && !coreRule.startsWith('@@');
        if (highlightWhitelist) coreRule = coreRule.substring(1).trim();
        routeRule(hlSets, parsed, coreRule, {N});
        if (!highlightWhitelist) return;
        rule = hlRule;
      }

      if (!rule || rule.trim() === '' || rule.startsWith('#')) return;

      let parsed;
      try {
        parsed = parseRuleWithConditions(rule);
      } catch (e) {
        dbgWarn('规则解析失败:', rule, e); return;
      }
      if (!parsed.staticPass) return;

      const coreRule = parsed.coreRule;
      if (coreRule.startsWith('@@')) return;
      if (coreRule.startsWith('@')) {
        routeRule(wlSets, parsed, coreRule.substring(1).trim());
        return;
      }
      routeRule(blSets, parsed, coreRule);
    });
    compiledRules.indexSignature = signature;
  }

  function cachedAnalyzeRule(rule) {
    if (!validationCache.has(rule)) {
      try { validationCache.set(rule, analyzeRule(rule)); }
      catch (e) { validationCache.set(rule, { valid: false, errors: [t('regexError')] }); }
    }
    return validationCache.get(rule);
  }

  function checkDynamicConditions(conditions, title, url, snippet) {
    if (!conditions || !conditions.length) return true;
    for (let i = 0; i < conditions.length; i++) {
      if (!evalCondAST(conditions[i], title, url, snippet)) return false;
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

    const scanDomainMap = (map, filter, preferLocal, collect) => {
      let subHit = null;
      for (const level of subdomainLevels) {
        const entries = map.get(level); if (!entries) continue;
        for (const entry of entries) {
          if (!filter(entry, level)) continue;
          if (collect) { collect(entry); continue; }
          if (!preferLocal) return entry;
          if (isLocalEntry(entry)) return entry;
          if (!subHit) subHit = entry;
        }
      }
      return subHit;
    };
    const scanPatterns = (patterns, value, filter, foldUrl, collect) => {
      if (!value) return null;
      const alt = foldUrl ? decodeUrlForMatch(value) : '';
      const enc = foldUrl ? encodeNonAscii(value) : '';
      for (const item of patterns) {
        if (filter && !filter(item)) continue;
        if (!(safeRegexTest(item.regex, value) || (alt && alt !== value && safeRegexTest(item.regex, alt)) || (enc && enc !== value && safeRegexTest(item.regex, enc)))) continue;
        if (collect) { collect(item); continue; } return item;
      }
      return null;
    };
    const scanConditionalDomains = (map, filter, preferLocal, collect) => {
      let subHit = null;
      for (const level of subdomainLevels) {
        const rules = map.get(level); if (!rules) continue;
        for (const item of rules) {
          if (!filter(item, level)) continue; if (!checkDynamicConditions(item.conditions, title, url, snippet)) continue;
          if (collect) { collect(item); continue; }
          if (!preferLocal) return item;
          if (isLocalEntry(item)) return item;
          if (!subHit) subHit = item;
        }
      }
      return subHit;
    };
    const scanConditionalRules = (rules, filter, collect) => {
      for (const item of rules) {
        if (filter && !filter(item)) continue; if (!checkDynamicConditions(item.conditions, title, url, snippet)) continue; if (item.type === 'expr') {
          if (collect) { collect(item); continue; } return item;
        }
        const value = item.type === 'title' ? title : item.type === 'text' ? snippet : url;
        const alt = (item.type === 'url' || item.type === 'regex') && value ? decodeUrlForMatch(value) : '';
        const enc = (item.type === 'url' || item.type === 'regex') && value ? encodeNonAscii(value) : '';
        if ((item.type === 'url' || item.type === 'regex' || item.type === 'title' || item.type === 'text') &&
            value && (safeRegexTest(item.regex, value) || (alt && alt !== value && safeRegexTest(item.regex, alt)) || (enc && enc !== value && safeRegexTest(item.regex, enc)))) {
          if (collect) { collect(item); continue; } return item;
        }
      }
      return null;
    };

    let hlEntry = null, hlLocalEntry = null;
    const takeHl = (it) => { if (it.N > (hlEntry ? hlEntry.N : 0)) hlEntry = it; if (isLocalEntry(it) && (!hlLocalEntry || it.N > hlLocalEntry.N)) hlLocalEntry = it; };
    scanDomainMap(compiledRules.highlightDomains, (en, lv) => matchDomainEntryType(en.type, lv, lowerDomain), false, takeHl);
    scanPatterns(compiledRules.highlightUrls, url, null, true, takeHl);
    scanPatterns(compiledRules.highlightTitles, title, null, false, takeHl);
    scanPatterns(compiledRules.highlightTexts, snippet, null, false, takeHl);
    scanConditionalDomains(compiledRules.highlightConditionalDomains, (it, lv) => matchDomainEntryType(it.domainType, lv, lowerDomain), false, takeHl);
    scanConditionalRules(compiledRules.highlightConditionalRules, null, takeHl); const highlightN = hlEntry ? hlEntry.N : 0;

    const findPair = (steps) => {
      let subHit = null;
      for (const step of steps) {
        const item = step();
        if (!item) continue;
        if (isLocalEntry(item)) return [item, null];
        if (!subHit) subHit = item;
      }
      return [null, subHit];
    };
    const findWhitelistPair = () => findPair([
      () => scanDomainMap(compiledRules.whitelistDomains, (en, lv) => matchDomainEntryType(en.type, lv, lowerDomain), true),
      () => scanPatterns(compiledRules.whitelistUrlPatterns, url, null, true),
      () => scanPatterns(compiledRules.whitelistTitlePatterns, title),
      () => scanPatterns(compiledRules.whitelistTextPatterns, snippet),
      () => scanConditionalDomains(compiledRules.whitelistConditionalDomains, (it, lv) => matchDomainEntryType(it.domainType, lv, lowerDomain), true),
      () => scanConditionalRules(compiledRules.whitelistConditionalRules)
    ]);
    const findBlockedPair = () => findPair([
      () => scanDomainMap(compiledRules.domains, (en, lv) => matchDomainEntryType(en.type, lv, lowerDomain), true),
      () => scanPatterns(compiledRules.urls, url, null, true),
      () => scanPatterns(compiledRules.titles, title),
      () => scanPatterns(compiledRules.texts, snippet),
      () => scanConditionalDomains(compiledRules.conditionalDomains, (it, lv) => matchDomainEntryType(it.domainType, lv, lowerDomain), true),
      () => scanConditionalRules(compiledRules.conditionalRules)
    ]);

    const toBlockedInfo = (item) => ({ rule: item.originalRule, source: item.source, sourceKey: item.sourceKey });
    const [wlLocal, wlSub] = findWhitelistPair();
    const hlWl = currentConfig.highlightWhitelist === true ? (hlLocalEntry || hlEntry) : null;
    let whitelistHit = wlLocal || (hlWl && isLocalEntry(hlWl) ? hlWl : null), blockedInfo = null;
    if (!whitelistHit) {
      const [blLocal, blSub] = findBlockedPair();
      if (blLocal) blockedInfo = toBlockedInfo(blLocal);
      else if (wlSub) whitelistHit = wlSub;
      else if (hlWl) whitelistHit = hlWl;
      else if (blSub) blockedInfo = toBlockedInfo(blSub);
    }

    const toHlInfo = () => (hlEntry ? {hlRule: hlEntry.originalRule, hlSource: hlEntry.source, hlSourceKey: hlEntry.sourceKey} : {});
    if (highlightN && blockedInfo) return {highlight: highlightN, blocked: true, rule: blockedInfo.rule, source: blockedInfo.source, sourceKey: blockedInfo.sourceKey, ...toHlInfo()};
    if (blockedInfo) return {blocked: true, rule: blockedInfo.rule, source: blockedInfo.source, sourceKey: blockedInfo.sourceKey};
    if (whitelistHit) {
      const hit = {whitelisted: true, rule: whitelistHit.originalRule, source: whitelistHit.source, sourceKey: whitelistHit.sourceKey};
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
      try { const next = decodeURIComponent(value); if (next === value) break; value = next; } catch (_) { break; }
    }
    return /^https?:\/\//i.test(value) ? value : '';
  }

  function cmdB64Text(v) { let base64 = String(v || '').replace(/-/g, '+').replace(/_/g, '/'); const rem = base64.length % 4; if (rem === 1) return ''; if (rem > 0) base64 += '='.repeat(4 - rem); try { if (typeof atob === 'function') { const bin = atob(base64); return typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8').decode(Uint8Array.from(bin, c => c.charCodeAt(0))) : decodeURIComponent(escape(bin)); } return Buffer.from(base64, 'base64').toString('utf8'); } catch (_) { return ''; } }
  function decodeBase64UrlTarget(u, spec) {
    if (!u) return ''; let rawEncoded = u; const pre = spec && spec.stripPrefix; if (pre) { try { const r = pre instanceof RegExp ? pre : (pre && typeof pre.source === 'string' ? new RegExp(pre.source, pre.flags || '') : (typeof pre === 'string' && pre ? new RegExp(pre) : null)); if (r) rawEncoded = rawEncoded.replace(r, ''); } catch (_) {} }
    let realUrl = cmdB64Text(rawEncoded);
    for (let i = 0; i < 2; i++) {
      if (/^https?:\/\//i.test(realUrl)) break;
      try { const decoded = decodeURIComponent(realUrl); if (decoded === realUrl) break; realUrl = decoded; } catch (_) { break; }
    }
    return /^https?:\/\//i.test(realUrl) ? realUrl : '';
  }

  // 去除重定向
    const REDIRECT_CODECS = {
    base64url: (u, spec) => { const v = u.searchParams.get(spec.params && spec.params[0]); return decodeBase64UrlTarget(v, spec) || decodeRedirectTarget(v); },
    url: (u, spec) => { for (const p of (spec.params || [])) { const v = decodeRedirectTarget(u.searchParams.get(p)); if (v) return v; } return ''; },
    pattern: (u, spec) => {
      const re = (v) => { try { return v instanceof RegExp ? v : (v && typeof v.source === 'string' ? new RegExp(v.source, v.flags || '') : (typeof v === 'string' && v ? new RegExp(v) : null)); } catch (_) { return null; } };
      let next = '';
      if (spec.pathValue) { const m = u.pathname.match(re(spec.pathValue)); if (m && m[1]) next = decodeRedirectTarget(m[1]); }
      if (!next && spec.hrefSuffix) { const m = u.href.match(re(spec.hrefSuffix)); if (m && m[1]) next = decodeRedirectTarget(m[1]); }
      if (!next) for (const p of (spec.params || [])) { const v = u.searchParams.get(p); if (v) { next = decodeRedirectTarget(v); if (next) break; } }
      return next;
    }
  };
  function getRedirectSpecs(host, engine) {
    host = String(host || '').replace(/\.$/, ''); const cacheKey = engine ? engine + '\u0000' + host : host;
    if (_redirectSpecsCache.has(cacheKey)) return _redirectSpecsCache.get(cacheKey);
    let specs = null;
    try {
      const defs = getSelectors();
      if (engine && isEngineHost(engine, host)) {
        try {
          const link = resolvePageDef(engine).link;
          if (link && Array.isArray(link.redirects) && link.redirects.length) specs = link.redirects.map(r => ({ ...r, engine }));
        } catch (_) {}
      }
      if (!specs) {
        const ids = Object.keys(defs).sort((a, b) => ((defs[b] && defs[b].priority) || 0) - ((defs[a] && defs[a].priority) || 0));
        for (const id of ids) {
          const def = defs[id]; const redirects = def && def.link && def.link.redirects; if (!def || def.disabled || !Array.isArray(redirects) || !redirects.length) continue;
          if (isEngineHost(id, host)) { specs = redirects.map(r => ({ ...r, engine: id })); break; }
        }
      }
    } catch (_) {}
    _redirectSpecsCache.set(cacheKey, specs); return specs;
  }
  function tryUrl(raw) { try { return new URL(String(raw)); } catch (_) { return null; } }
  function decodeRedirectOnce(raw, engine) {
    if (!raw) return '';
    const u = tryUrl(raw); if (!u) return '';
    const specs = getRedirectSpecs(u.hostname, engine); if (!specs) return '';
    for (const spec of specs) {
      if (spec.path) { try { const p = spec.path; const re = p instanceof RegExp ? p : new RegExp(p && typeof p === 'object' && typeof p.source === 'string' ? p.source : p, p && typeof p === 'object' ? (p.flags || '') : ''); if (!re.test(u.pathname)) continue; } catch (_) { continue; } }
      const codec = REDIRECT_CODECS[spec.codec]; if (!codec) continue;
      let next = ''; try { next = codec(u, spec); } catch (_) {}
      if (next && spec.chain && typeof spec.chain.param === 'string' && spec.chain.param) {
        try {
          const inner = new URL(next);
          if (!spec.chain.hostSelf || (spec.engine && isEngineHost(spec.engine, inner.hostname))) {
            const v = decodeRedirectTarget(inner.searchParams.get(spec.chain.param));
            if (v) next = v;
          }
        } catch (_) {}
      }
      if (next) return next;
    }
    return '';
  }
  function unwrapRedirectUrl(url, engine) {
    const seen = new Set();
    for (let depth = 0; depth < 5 && url && !seen.has(url); depth++) {
      seen.add(url); const next = decodeRedirectOnce(url, engine);
      if (!next || next === url) break; url = next;
    }
    return url;
  }
  

  function hasRedirectSpec(url) {
    if (!url) return false;
    const u = tryUrl(url); if (!u) return false;
    const specs = getRedirectSpecs(u.hostname); if (!Array.isArray(specs)) return false;
    for (const spec of specs) {
      if (!spec) continue;
      if (spec.path) { try { const p = spec.path; const re = p instanceof RegExp ? p : new RegExp(p && typeof p === 'object' && typeof p.source === 'string' ? p.source : p, p && typeof p === 'object' ? (p.flags || '') : ''); if (!re.test(u.pathname)) continue; } catch (_) { continue; } }
      return true;
    }
    return false;
  }
  function isOpaqueRedirectUrl(url) {
    if (!url) return false;
    if (!hasRedirectSpec(url)) return false;
    const unwrapped = unwrapRedirectUrl(url);
    return !unwrapped || unwrapped === url;
  }

  function redirectsEnabled() { return !(typeof currentConfig !== 'undefined' && currentConfig && currentConfig.removeRedirects === false); }
  function getCleanUrl(link, engine) {
    if (!link || !link.href) return '';
    if (engine === undefined) engine = (typeof getSearchEngine === 'function') ? getSearchEngine() : '';
    const redirectsOn = redirectsEnabled();
    let attr = '';
    let directAttrs = null, directScope = '', directProtocol = '';
    try { if (redirectsOn && typeof resolvePageDef === 'function') { const d = resolvePageDef(engine); const l = d && d.link; directAttrs = l && l.directAttrs; directScope = l && l.directScope; directProtocol = l && l.directProtocol; } } catch (_) {}
    if (directAttrs && typeof link.getAttribute === 'function') {
      const names = Array.isArray(directAttrs) ? directAttrs : [directAttrs];
      for (const name of names) { attr = link.getAttribute(name) || ''; if (attr) break; }
      if (!attr && directScope && typeof link.closest === 'function') {
        const box = link.closest(directScope);
        const el = box && typeof box.querySelector === 'function' ? box.querySelector(names.map(n => '[' + n + ']').join(',')) : null;
        if (el && typeof el.getAttribute === 'function') for (const name of names) { attr = el.getAttribute(name) || ''; if (attr) break; }
      }
    }
    if (attr) { attr = String(attr); if (directProtocol && /^\/\/\S/.test(attr)) attr = directProtocol + ':' + attr; }
    const unwrap = (u) => redirectsEnabled() ? unwrapRedirectUrl(u, engine) : u;
    if (/^https?:\/\/\S+$/i.test(attr) && attr !== link.href) return unwrap(attr);
    return unwrap(link.href);
  }

  function resolveUrlDomain(link) {
    const rawHref = (link && link.href) || '';
    const keepRaw = !redirectsEnabled();
    let rawUrl = keepRaw ? rawHref : getCleanUrl(link);
    let url = toASCIIUrl(rawUrl) || rawUrl, domain = '';
    const parsedUrl = tryUrl(url); if (parsedUrl) domain = toASCIIHostname(parsedUrl.hostname);
    if (domain && isOpaqueRedirectUrl(url)) domain = '';
    return { url, domain };
  }

  function peekResultLink(result) {
    try { return getResultLink(result, getSearchEngine()) || null; } catch (e) { return null; }
  }

  function peekResultRawHref(result, link) {
    if (link === undefined) link = peekResultLink(result);
    return (link && link.href) || '';
  }

  function peekResultUrl(result, link) {
    if (link === undefined) link = peekResultLink(result);
    if (!link || !link.href) return '';
    const rawHref = link.href; const cached = _peekUrlCache.get(result);
    if (cached && cached.rawHref === rawHref) return cached.url;
    let url = ''; try { url = resolveUrlDomain(link).url || ''; } catch (e) { return ''; }
    _peekUrlCache.set(result, { rawHref, url });
    return url;
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
  }    function getResultSnippet(result, engine) {
    const def = resolvePageDef(engine); const cmd = def.snippet;
    if (cmd) { const r = runCmdValue(result, cmd, 'text'); if (r && r.value) return r.value; }
    if (cmd) for (const element of getResultExtraElements(result, engine)) { const r = runCmdValue(element, cmd, 'text'); if (r && r.value) return r.value; }
    return '';
  }

  function getResultExtraElements(result, engine = getSearchEngine()) {
    const selectors = resolvePageDef(engine).extraSelector; const parent = result.parentElement; if (!parent || !Array.isArray(selectors) || !selectors.length) return [];
    const index = Array.prototype.indexOf.call(parent.children, result) + 1; const elements = new Set();
    for (const selector of selectors) {
      if (typeof selector !== 'string') continue;
      for (const part of splitTopLevelSelectorList(selector)) {
        let sel = part.trim();
        if (sel.startsWith('&')) sel = sel.slice(1).trim();
        if (!sel || hasTopLevelComma(sel)) continue;
        try {
          for (const element of parent.querySelectorAll(':scope > :nth-child(' + index + ') ' + sel)) {
            if (element !== result && !element.contains(result)) elements.add(element);
          }
        } catch (e) {}
      }
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
    if (result && result.dataset) result.dataset.serhEngine = engine;
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
  }  const _cmdReCache = new Map();
  function cmdRe(p) { let k, f = ''; if (p instanceof RegExp) { k = 'r\u0000' + p.source; f = p.flags; } else if (p && typeof p === 'object' && typeof p.source === 'string') { k = 'o\u0000' + p.source; f = String(p.flags || ''); } else { k = 's\u0000' + String(p); } let r = _cmdReCache.get(k + '\u0000' + f); if (r === undefined) { try { r = new RegExp(p instanceof RegExp ? p.source : (p && typeof p.source === 'string' ? p.source : String(p)), f); } catch (_) { r = null; } _cmdReCache.set(k + '\u0000' + f, r); } return r; }
  function cmdQueryEl(root, sel) { if (!root || !sel) return null; try { return root.matches && root.matches(sel) ? root : (root.querySelector ? root.querySelector(sel) : null); } catch (_) { return null; } }
  function runCmdEl(root, spec) {
    if (spec == null) return root; if (typeof spec === 'string') return cmdQueryEl(root, spec); if (!Array.isArray(spec)) return root;
    const t = spec[0], a = spec[1], b = spec[2];
    if (t === 'upward') { const base = runCmdEl(root, b); if (typeof a === 'number') { let el = base; for (let i = 0; i < a && el; i++) el = el.parentElement; return el || null; } return base && base.parentElement && base.parentElement.closest ? base.parentElement.closest(a) : null; }
    if (t === 'selector') return cmdQueryEl(runCmdEl(root, b), a);
    return root;
  }
  function cmdText(el) { return el && typeof el.textContent === 'string' ? el.textContent.trim() : ''; }
  function cmdAttr(el, name) { if (!el) return ''; const v = el.getAttribute ? el.getAttribute(name) : null; if (v != null && v !== '') return String(v); const p = el[name]; return typeof p === 'string' ? p : ''; }
  function cmdPath(obj, path) { let cur = obj; for (const seg of String(path || '').replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean)) { if (cur == null) return undefined; cur = cur[seg]; } return cur; }
  function cmdOrigin() { return (typeof location !== 'undefined' && location.origin) ? location.origin : 'https://example.com'; }
  function cmdAbsUrl(v) { if (/^https?:\/\//i.test(String(v || ''))) return String(v); try { const u = new URL(String(v), cmdOrigin()); return /^https?:$/.test(u.protocol) ? u.href : ''; } catch (_) { return ''; } }
  function isOpaqueRedirectValue(v) {
    if (!v) return true; let abs = '';
    try { abs = new URL(v, cmdOrigin()).href; } catch (_) { return true; }
    if (!hasRedirectSpec(abs)) return false;
    const u = unwrapRedirectUrl(abs); return !u || u === abs;
  }
  function runCmdValue(root, cmd, mode) {
    if (cmd == null) return null;
    if (typeof cmd === 'string') {
      const el = cmdQueryEl(root, cmd); if (!el) return null;
      if (mode === 'link') { const href = cmdAttr(el, 'href'); return href ? { value: href, element: el } : null; }
      const text = cmdText(el); return text ? { value: text, element: el } : null;
    }
    if (!Array.isArray(cmd)) return null;
    const t = cmd[0], a = cmd[1], b = cmd[2], c = cmd[3];
    if (t === 'or') { const isElCmd = b === undefined || typeof b === 'string' || (Array.isArray(b) && (b[0] === 'selector' || b[0] === 'upward')); const base = isElCmd && b !== undefined ? runCmdEl(root, b) : root; if (!base) return null; for (const sub of (Array.isArray(a) ? a : [a])) { const r = runCmdValue(base, sub, mode); if (r && r.value) return r; } return null; }
    if (t === 'property') { const el = runCmdEl(root, b); if (!el) return null; const v = el[a]; return (typeof v === 'string' || typeof v === 'number') && v !== '' ? { value: String(v), element: el } : null; }
    if (t === 'attribute') { const el = runCmdEl(root, b); const v = cmdAttr(el, a); return v ? { value: v, element: el || root } : null; }
    if (t === 'text') { const el = runCmdEl(root, a); const v = cmdText(el); return v ? { value: v, element: el || root } : null; }
    if (t === 'const') return { value: String(a == null ? '' : a), element: root };
    if (t === 'regexInclude' || t === 'regexExclude') { const r = runCmdValue(root, b, mode); if (!r || !r.value) return null; const re = cmdRe(a); if (!re) return r; return (re.test(r.value) === (t === 'regexInclude')) ? r : null; }
    if (t === 'regexSubstitute') { const r = runCmdValue(root, c, mode); if (!r || !r.value) return null; const re = cmdRe(a); return re ? { value: r.value.replace(re, String(b == null ? '' : b)), element: r.element } : r; }
    if (t === 'rejectEngineHost') { const r = runCmdValue(root, a, 'text'); if (!r || !r.value) return null; try { const h = new URL(r.value, cmdOrigin()).hostname; for (const e of Object.keys(getSelectors())) if (isEngineHost(e, h)) return null; } catch (_) { return null; } return r; }
    if (t === 'normalizeUrl') { const r = runCmdValue(root, a, 'text'); if (!r || !r.value) return null; try { return { value: new URL(r.value, cmdOrigin()).href, element: r.element }; } catch (_) { return null; } }
    if (t === 'rejectOpaqueRedirect') { const r = runCmdValue(root, a, mode); if (!redirectsEnabled()) return r; return r && r.value && !isOpaqueRedirectValue(r.value) ? r : null; }
    if (t === 'jsonPath') {
      const r = runCmdValue(root, b, 'text'); if (!r) return null; let v = r.value;
      if (typeof v === 'string') { try { v = JSON.parse(v); } catch (_) { return null; } }
      const out = a === '' || a == null ? v : cmdPath(v, a); return out == null || out === '' ? null : { value: out, element: r.element };
    }
    if (t === 'jsonParse') { const r = runCmdValue(root, a, 'text'); if (!r || r.value == null) return null; let v = r.value; if (typeof v === 'string') { try { v = JSON.parse(v); } catch (_) { return null; } } return v && typeof v === 'object' ? { value: v, element: r.element } : null; }
    if (t === 'urlDecode') { const r = runCmdValue(root, a, 'text'); if (!r || typeof r.value !== 'string' || !r.value) return null; try { return { value: decodeURIComponent(r.value), element: r.element }; } catch (_) { return null; } }
    if (t === 'base64Decode') { const r = runCmdValue(root, a, 'text'); if (!r || typeof r.value !== 'string' || !r.value) return null; const v = cmdB64Text(r.value); return v ? { value: v, element: r.element } : null; }
    if (t === 'prefix') { const r = runCmdValue(root, b, 'text'); if (!r || typeof r.value !== 'string' || !r.value) return null; return { value: String(a == null ? '' : a) + r.value, element: r.element }; }
    if (t === 'queryParam') {
      const r = runCmdValue(root, b, 'text'); if (!r || !r.value) return null;
      try { const u = new URL(String(r.value), cmdOrigin()); const v = u.searchParams.get(a); return v ? { value: v, element: r.element } : null; } catch (_) { return null; }
    }
    if (t === 'base64Url') {
      const names = Array.isArray(a) ? a : (typeof a === 'string' && a ? [a] : null);
      if (!names || !names.length || !names.every((n) => typeof n === 'string' && n)) return null;
      const el = runCmdEl(root, b); let src = '';
      for (const n of names) { src = cmdAttr(el, n) || ''; if (src) break; }
      src = src.split('?')[0];
      const segs = src.split('/');
      for (let i = 1; i < segs.length; i++) { const u = decodeBase64UrlTarget(segs.slice(i).join('')); if (u) return { value: u, element: el || root }; }
      return null;
    }
    return null;
  }
  function makeResultLink(el, href) {
    const g = (n) => el && el.getAttribute ? el.getAttribute(n) : null; const s = (n, v) => { if (el && el.setAttribute) el.setAttribute(n, v); };
    return { href, getAttribute: g, setAttribute: s };
  }
  function getResultLink(result, engine) {
    const def = resolvePageDef(engine);
    if (def.url) { const r = runCmdValue(result, def.url, 'link'); const href = r && r.value ? cmdAbsUrl(r.value) : ''; if (href) return makeResultLink(r.element || result, href); }
    return null;
  }    function getResultTitle(result, engine) {
    const def = resolvePageDef(engine); const cmd = def.title;
    if (cmd) { const r = runCmdValue(result, cmd, 'text'); if (r && r.value) return r.value; }
    return '';
  }

    function getResultTitleElement(result, engine) {
    const def = resolvePageDef(engine); const cmd = def.title;
    if (cmd) { const r = runCmdValue(result, cmd, 'text'); if (r && r.value) return r.element || result; }
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
    let baseDomain = d, suffixLike = false;
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

    const panel = document.createElement('div'); panel.id = 'serh-block-confirm-dialog'; const scale = currentUiScale(); if (scale !== 1) panel.style.zoom = String(scale);
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

    const rect = anchor.getBoundingClientRect(); const pw = panel.offsetWidth; const ph = panel.offsetHeight; const vw = window.innerWidth / scale, vh = window.innerHeight / scale;
    let left = Math.min(Math.max(8, rect.right / scale - pw), vw - pw - 8), top;
    if (left < 8) left = 8; top = rect.bottom / scale + 6; if (top + ph > vh - 8) top = Math.max(8, rect.top / scale - ph - 6); panel.style.left = left + 'px'; panel.style.top = top + 'px';
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
      inp.addEventListener('input', () => { inp.style.borderColor = inp.value.trim().startsWith('#') ? '#e53935' : ''; });
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault(); e.stopPropagation(); const okBtn = panel.querySelector('#sfb-confirm-ok'); if (okBtn) okBtn.click();
        }
      });
    });

    bindCancelButton('sfb-confirm-cancel', close);
    panel.querySelector('#sfb-confirm-ok').onclick = (e) => {
      e.stopPropagation(); const checked = panel.querySelector('input[type="radio"]:checked'); const idx = checked ? parseInt(checked.value, 10) : 0;
      const ruleInput = panel.querySelector(`.sfb-confirm-rule[data-idx="${idx}"]`);
      const rule = (ruleInput ? ruleInput.value : '').trim();
      if (!rule) { close(); return; }
      if (rule.startsWith('#')) {
        if (ruleInput) { ruleInput.style.borderColor = '#e53935'; ruleInput.focus(); }
        showToast(t('invalidRule'), 'error'); return;
      }
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
      const m = def && (def.includeRegex || def.match);
      if (m instanceof RegExp) engineMatch = m;
      else if (typeof m === 'string' && m) { try { engineMatch = new RegExp(m); } catch (_) {} }
    } catch (_) {}
    if (engineMatch && engineMatch.test(target)) return true;
    return currentHost.endsWith('.' + target);
  }

  function injectBlockButton(result, engine, domain) {
    let def = null, boBase = null;
    try { def = resolvePageDef(engine); const ob = resolvePageDef('other').button; if (ob && typeof ob === 'object' && !Array.isArray(ob)) boBase = ob; } catch (_) {}
    const b = def ? def.button : undefined;
    if (b === false) return;
    const isBlocked = result.getAttribute('data-is-blocked') === 'true';
    if (!domain && !isBlocked) return;
    const bo = b && typeof b === 'object' && !Array.isArray(b) ? b : null;
    const defExclude = boBase && boBase.exclude;
    if (defExclude && result.closest(bo && bo.exclude ? defExclude + ',' + bo.exclude : defExclude)) return;
    if (bo) {
      if (bo.scope && !result.closest(bo.scope)) return;
      if (bo.require && (!bo.requireSelf || (result.matches && result.matches(bo.requireSelf))) && !result.querySelector(bo.require)) return;
    }
    if (result.querySelector('.serh-quick-block')) return;

    const btn = document.createElement('div'); btn.className = 'serh-quick-block';
    const iconColor = isBlocked ? '#3182ce' : 'currentColor';
    btn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="${iconColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>`;

    let host = result;
    if (bo && bo.mount) { try { const m = Array.isArray(bo.mount) ? runCmdEl(result, bo.mount) : result.querySelector(bo.mount); if (m) host = m; } catch (_) {} }
    ensurePositioned(host);
    if (bo && typeof bo.style === 'string' && bo.style) { try { btn.style.cssText += ';' + bo.style; } catch (_) {} }
    const inset = { ...(boBase && boBase.inset || {}), ...(bo && bo.inset || {}) };
    btn.style.right = inset.right; btn.style.top = inset.top;
    if (inset.bottom !== undefined) btn.style.bottom = inset.bottom;
    if (inset.left !== undefined) btn.style.left = inset.left;
    if (bo && bo.zIndex !== undefined) btn.style.zIndex = String(bo.zIndex);

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
        if (result.dataset.whitelistRule && (result.dataset.whitelistSourceKey || 'local') === 'local') {
          showToast(t('whitelistResult'), 'info'); return;
        }
      }

      if (isBlocked) {
        const matchedRule = (result.dataset.matchedRule || '').trim(); const matchedSource = (result.dataset.matchedSource || '').trim(); const matchedSourceKey = (result.dataset.matchedSourceKey || '').trim(); const isSubRule = matchedSourceKey ? matchedSourceKey.startsWith('sub:') : !isLocalEntry({ source: matchedSource });
        const opts = domain ? buildBlockRuleOptions(domain) : null; const whitelistRule = opts ? '@' + (currentConfig.blockDomain ? opts.domainRule : opts.exactRule) : (matchedRule ? '@' + stripRuleComment(matchedRule) : '');
        const deleteLocalRule = (rule) => {
          adoptStoredConfigBeforeWrite(); const cleanTarget = stripRuleComment(rule.trim()); currentConfig.rules = currentConfig.rules.filter(r => stripRuleComment(r.trim()) !== cleanTarget);
          persistConfig(true); removeRulesFromTextarea([rule]); forceReprocessAll();
        };

        if (currentConfig.blockConfirm || !matchedRule || isSubRule) {
          const unblockOptions = [];
          if (matchedRule) {
            unblockOptions.push({ label: isSubRule ? t('bcDeleteSub') : t('bcDelete'), rule: matchedRule, action: 'delete', disabled: isSubRule });
          }
          if (whitelistRule) unblockOptions.push({ label: t('bcWhitelist'), rule: whitelistRule, action: 'whitelist' });
          if (!unblockOptions.length) return;

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
    host.appendChild(btn);
  }

  function removeMatchedRuleLabel(result) {
    const label = result.querySelector('.serh-matched-rule'); if (label) label.remove();
  }

  function clearMatchedData(result) {
    result.removeAttribute('data-matched-rule'); result.removeAttribute('data-matched-source'); result.removeAttribute('data-matched-source-key');
    result.removeAttribute('data-whitelist-rule'); result.removeAttribute('data-whitelist-source'); result.removeAttribute('data-whitelist-source-key');
  }

  function saveOriginalDisplay(el) {
    if (!el || el.hasAttribute('data-serh-orig-display')) return; el.setAttribute('data-serh-orig-display', el.style.display || '');
  }

  function restoreOriginalDisplay(el) {
    if (!el) return; const orig = el.getAttribute('data-serh-orig-display'); el.style.display = orig !== null ? orig : '';
  }
  function hideNames(kind, fallback) {
    if (!_hideNamesCache) _hideNamesCache = {};
    const key = kind + '|' + fallback;
    if (_hideNamesCache[key]) return _hideNamesCache[key];
    const set = new Set([fallback]);
    for (const def of Object.values(getSelectors())) {
      for (const o of [def, ...Object.values(def.pages || {})]) {
        const v = o && o[kind] && o[kind].hideAttr;
        if (typeof v === 'string' && v) set.add(v);
      }
    }
    return (_hideNamesCache[key] = [...set]);
  }
  function hideSel(kind, fallback) { return hideNames(kind, fallback).map(a => '[' + a + ']').join(','); }
  function resultGroupMembers(root, selector) {
    const out = []; if (!root || !selector || typeof root.querySelectorAll !== 'function') return out;
    try {
      for (const el of root.querySelectorAll(selector)) {
        let p = el.parentElement, nested = false;
        while (p && p !== root) { if (typeof p.matches === 'function' && p.matches(selector)) { nested = true; break; } p = p.parentElement; }
        if (!nested) out.push(el);
      }
    } catch (_) {}
    return out;
  }
  function hideResultGroup(result, def) {
    const g = def && def.group; if (!g || !result) return;
    const root = g.container === 'parent' ? result.parentElement : (g.container && typeof result.closest === 'function' ? result.closest(g.container) : null);
    if (!root || root === result) return;
    const membersSel = g.members || def.root || '';
    const members = resultGroupMembers(root, membersSel);
    if (members.length) { hideParentIfNoVisibleSiblings(root, members, g.hideAttr || GROUP_HIDE_ATTR); root.setAttribute('data-serh-group-members', membersSel); }
  }

  function visibleUnblocked(el) {
    return el.style.display !== 'none' && el.getAttribute('data-is-blocked') !== 'true';
  }

  function blockedShown() {
    if (showHiddenResults) return true;
    if (currentConfig.collapseMode !== true) return false;
    try {
      const def = resolvePageDef(getSearchEngine());
      if (def && def.grid) return false;
      if (getSearchCategory() === 'images') return false;
    } catch (_) {}
    return true;
  }

    const map_groupMembers = new WeakMap();
  const map_gridConfig = new WeakMap();
  function hideParentIfNoVisibleSiblings(parent, children, attr) {
    if (!parent) return;
    const members = Array.from(children || []); if (!members.length) return;
    map_groupMembers.set(parent, members);
    const groupAttr = attr || GROUP_HIDE_ATTR;
    if (parent.getAttribute('data-serh-group-attr') !== groupAttr) parent.setAttribute('data-serh-group-attr', groupAttr);
    if (members.some(visibleUnblocked)) { if (parent.getAttribute('data-serh-group-hidden') === 'true') restoreParentDisplay(parent); return; }
    const alreadyHidden = parent.getAttribute('data-serh-group-hidden') === 'true';
    saveOriginalDisplay(parent); parent.style.display = blockedShown() ? (parent.getAttribute('data-serh-orig-display') || '') : 'none';
    parent.setAttribute(groupAttr, 'true'); parent.setAttribute('data-serh-group-hidden', 'true');
    if (!alreadyHidden) _hiddenParentCount++;
  }
  function recheckGroupRoot(root) {
    if (!root) return;
    let members = map_groupMembers.get(root);
    if (!members || !members.length) {
      const sel = root.getAttribute('data-serh-group-members') || '';
      members = sel ? resultGroupMembers(root, sel) : [];
    }
    if (!members.length) return;
    hideParentIfNoVisibleSiblings(root, members, root.getAttribute('data-serh-group-attr') || GROUP_HIDE_ATTR);
  }
  function resetResultStyles(result) {
    restoreResultExtraElements(result); restoreResultCollapse(result); _hrefUrlCache.delete(result); _resultContentCache.delete(result); _resultRetryCounts.delete(result); _peekUrlCache.delete(result); result.removeAttribute('data-blocker-processed'); result.removeAttribute('data-retry-exhausted');
    result.removeAttribute('data-is-blocked'); result.removeAttribute('data-is-highlighted'); result.removeAttribute('data-highlight-n'); result.removeAttribute('data-highlight-rule'); result.removeAttribute('data-highlight-source'); result.removeAttribute('data-highlight-source-key'); clearMatchedData(result);
    result.classList.remove('serh-blocked-visible'); result.classList.remove('serh-blocked-collapsed'); result.style.outline = ''; result.style.outlineOffset = ''; const origDisplay = result.getAttribute('data-serh-orig-display');
    if (origDisplay !== null) { result.style.display = origDisplay; result.removeAttribute('data-serh-orig-display'); }
    const groupRoot = result.closest ? result.closest(hideSel('group', GROUP_HIDE_ATTR)) : null; if (groupRoot) recheckGroupRoot(groupRoot);
    const gridItem = result.closest ? result.closest(hideSel('grid', GRID_HIDE_ATTR)) : null; if (gridItem) recheckGridCell(gridItem);
    removeMatchedRuleLabel(result); if (!result.querySelector('.serh-quick-block')) result.style.position = '';
  }
  function restoreParentDisplay(parent) {
    if (!parent) return;
    const orig = parent.getAttribute('data-serh-orig-display'); parent.style.display = orig !== null ? orig : '';
    const attr = parent.getAttribute('data-serh-group-attr') || GROUP_HIDE_ATTR;
    parent.removeAttribute(attr); parent.removeAttribute('data-serh-group-members'); parent.removeAttribute('data-serh-group-attr');
    for (const a of hideNames('group', GROUP_HIDE_ATTR)) parent.removeAttribute(a);
    for (const a of hideNames('grid', GRID_HIDE_ATTR)) parent.removeAttribute(a);
    parent.removeAttribute('data-serh-grid-items'); parent.removeAttribute('data-serh-grid-has'); parent.removeAttribute('data-serh-grid-deepest');
    parent.removeAttribute('data-serh-orig-display'); _hiddenParentCount--;
    map_groupMembers.delete(parent); map_gridConfig.delete(parent);
  }
  function restoreAllHiddenParents() {
    document.querySelectorAll(hideSel('group', GROUP_HIDE_ATTR) + ',' + hideSel('grid', GRID_HIDE_ATTR)).forEach(restoreParentDisplay); _hiddenParentCount = 0;
  }
  function recheckGridCell(cell) {
    if (!cell) return;
    const leaves = getGridLeaves(cell);
    const stillBlocked = leaves.length ? leaves.some(gridLeafBlocked) : Array.from(cell.querySelectorAll('[data-is-blocked="true"]')).some(el => el.style.display === 'none');
    const leafShown = (el) => {
      let cur = el;
      while (cur && cur !== cell) {
        if (cur.style && cur.style.display === 'none') return false;
        if (cur.getAttribute && cur.getAttribute('data-is-blocked') === 'true') return false;
        cur = cur.parentElement;
      }
      return cur === cell;
    };
    const hasVisibleUnblocked = leaves.some(leafShown);
    if (blockedShown() || !stillBlocked || hasVisibleUnblocked) restoreParentDisplay(cell);
  }
  function reconcileHiddenParents() {
    if (_hiddenParentCount <= 0) return;
    document.querySelectorAll(hideSel('group', GROUP_HIDE_ATTR)).forEach(recheckGroupRoot);
    document.querySelectorAll(hideSel('grid', GRID_HIDE_ATTR)).forEach(recheckGridCell);
  }

  function reprocessContainer(container) {
    try {
      if (!container || !container.isConnected) return; const staleBtn = container.querySelector('.serh-quick-block'); if (staleBtn) staleBtn.remove(); resetResultStyles(container);
      container.removeAttribute('data-observed');
      try {
        processSingleResult(container);
      } catch (e) {
        dbgError('处理结果时出错:', container, e);
      }
      container.setAttribute('data-observed', 'true');
      if (!container.hasAttribute('data-blocker-processed')) resultObserver.observe(container);
    } catch (e) {
      dbgError('结果重处理失败:', container, e);
    }
  }

  function sourceLabelOf(key) {
    if (key === 'local') return t('localRule'); const m = /^sub:(\d+)$/.exec(String(key || '')); return m ? `${t('subscription')}${m[1]}` : '';
  }

  function addMatchedRuleLabel(result) {
    if (currentConfig.showMatchedSource === false || !result.dataset.matchedRule) return; removeMatchedRuleLabel(result); const label = document.createElement('div'); label.className = 'serh-matched-rule';
    const sourceText = sourceLabelOf(result.dataset.matchedSourceKey) || result.dataset.matchedSource || t('matchedRule'); const ruleText = result.dataset.matchedRule;
    label.textContent = `${sourceText}: ${ruleText}`;
    ensurePositioned(result); result.appendChild(label);
  }

  function getGridLeaves(cell, g) {
    if (!cell || typeof cell.querySelectorAll !== 'function') return [];
    let cfg = g || map_gridConfig.get(cell) || null;
    if (!cfg) { const raw = cell.getAttribute && cell.getAttribute('data-serh-grid-items'); if (raw) { try { cfg = { items: JSON.parse(raw), has: cell.getAttribute('data-serh-grid-has') || '', deepest: cell.getAttribute('data-serh-grid-deepest') === 'true' }; } catch (_) {} } }
    try {
      if (cfg && cfg.items) {
        for (const sel of (Array.isArray(cfg.items) ? cfg.items : [cfg.items])) {
          let list = Array.from(cell.querySelectorAll(sel));
          if (cfg.has) list = list.filter(el => el.querySelector && el.querySelector(cfg.has));
          if (cfg.deepest) list = list.filter(el => !Array.from(el.querySelectorAll(sel)).some(child => child !== el && (!cfg.has || (child.querySelector && child.querySelector(cfg.has)))));
          if (list.length) return list;
        }
        return [];
      }
      return Array.from(cell.children || []);
    } catch (e) { return []; }
  }
  function gridLeafBlocked(el) {
    return !!el && (el.style.display === 'none' || el.getAttribute('data-is-blocked') === 'true' || !!(el.closest && el.closest('[data-is-blocked="true"]')));
  }
  function hideGridCell(cell, attr, g) {
    if (!cell) return; const alreadyHidden = cell.getAttribute(attr) === 'true';
    map_gridConfig.set(cell, g || null);
    if (g) { try { cell.setAttribute('data-serh-grid-items', JSON.stringify(g.items || [])); } catch (_) {} if (g.has) cell.setAttribute('data-serh-grid-has', g.has); if (g.deepest) cell.setAttribute('data-serh-grid-deepest', 'true'); }
    cell.style.display = 'none'; cell.setAttribute(attr, 'true'); if (!alreadyHidden) _hiddenParentCount++;
  }
  function markResultGridSlot(result, engine, def) {
    let g = def && def.grid;
    if (!g) { try { g = resolvePageDef(engine).grid; } catch (_) {} }
    if (!g) return;
    let cell = result;
    if (g.anchor === 'grid') {
      while (cell && cell.parentElement && cell.tagName !== 'BODY') { const d = getComputedStyle(cell.parentElement).display; if (d === 'grid' || d === 'inline-grid') break; cell = cell.parentElement; }
      if (!cell || cell === result || !cell.parentElement || cell.tagName === 'BODY') return;
    } else if (g.cell && result.closest) {
      cell = result.closest(g.cell);
      if (!cell || cell === result) return;
    } else return;
    const leaves = getGridLeaves(cell, g); const targets = leaves.length ? leaves : [result];
    if (!targets.every(gridLeafBlocked)) return;
    hideGridCell(cell, g.hideAttr || GRID_HIDE_ATTR, g);
  }

  function processSingleResult(result) {
    if (!_engineSiteSetup) return false;

    if (result.hasAttribute('data-blocker-processed')) {
      return result.getAttribute('data-is-blocked') === 'true';
    }

    if (!currentConfig.enabled) return false;
    const engine = getSearchEngine(); const def = resolvePageDef(engine); if (def.skip && result.closest(def.skip)) return false; const link = getResultLink(result, engine);
    if (!link || !link.href) {
      dbgWarn('未找到链接，跳过结果:', result.tagName, result.className, result.innerHTML.substring(0, 200));
      return false;
    }

    const { url, domain } = resolveUrlDomain(link); _hrefUrlCache.set(result, { rawHref: link.href || '', url });
    const title = getResultTitle(result, engine); const snippet = getResultSnippet(result, engine); _resultContentCache.set(result, buildContentSignature(url, title, snippet));
    const subdomainLevels = getSubdomainLevels(domain);
    const matchResult = checkRuleMatchOptimized(url, domain, title, snippet, subdomainLevels); _resultRetryCounts.delete(result); result.removeAttribute('data-retry-exhausted');
    const matchHL = matchResult && matchResult.highlight;
    if (matchHL) {
      const hlColor = currentConfig.highlightColors[matchHL]; const color = (typeof hlColor === 'string' && /^#[0-9A-Fa-f]{6}$/.test(hlColor)) ? hlColor : (DEFAULT_HIGHLIGHT_COLORS[matchHL] || '#CE2029');
      result.style.outline = `2px solid ${color}`; result.style.outlineOffset = '-2px';
      result.setAttribute('data-is-highlighted', 'true'); result.setAttribute('data-highlight-n', matchHL);
      if (matchResult.hlRule) { result.dataset.highlightRule = matchResult.hlRule; result.dataset.highlightSource = matchResult.hlSource || ''; result.dataset.highlightSourceKey = matchResult.hlSourceKey || ''; }
    }
    if (matchResult && matchResult.blocked) {
      _resultRetryCounts.delete(result); saveOriginalDisplay(result); if (blockedShown()) restoreOriginalDisplay(result); else result.style.display = 'none'; setResultExtraElementsVisible(result, showHiddenResults);
      result.setAttribute('data-blocker-processed', 'true'); result.setAttribute('data-is-blocked', 'true');

      hideResultGroup(result, def);
      if (!blockedShown() && def.grid) markResultGridSlot(result, engine, def);

      result.dataset.matchedRule = matchResult.rule || ''; result.dataset.matchedSource = matchResult.source || ''; result.dataset.matchedSourceKey = matchResult.sourceKey || '';
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
      if (matchResult && matchResult.whitelisted) { result.dataset.whitelistRule = matchResult.rule || ''; result.dataset.whitelistSource = matchResult.source || ''; result.dataset.whitelistSourceKey = matchResult.sourceKey || ''; }
      if (currentConfig.showBlockBtn) injectBlockButton(result, engine, domain);
      return false;
    }

    _resultRetryCounts.delete(result); clearMatchedData(result);
    if (matchResult && matchResult.whitelisted) { result.dataset.whitelistRule = matchResult.rule || ''; result.dataset.whitelistSource = matchResult.source || ''; result.dataset.whitelistSourceKey = matchResult.sourceKey || ''; }
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
          dbgError('处理结果时出错:', result, e);
        }
        if (blocked) newlyBlocked++;
        if (result.hasAttribute('data-blocker-processed')) {
          observer.unobserve(result);
        } else {
          observer.unobserve(result); scheduleResultRetry(result);
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
    result.setAttribute('data-observed', 'true'); result.removeAttribute('data-retry-exhausted');
    const attempt = (_resultRetryCounts.get(result) || 0) + 1;
    if (attempt > RESULT_RETRY_LIMIT) {
      _resultRetryCounts.delete(result); resultObserver.unobserve(result); result.setAttribute('data-retry-exhausted', 'true'); _resultContentCache.set(result, getResultContentSignature(result)); return;
    }
    _resultRetryCounts.set(result, attempt);
    setTimeout(() => {
      if (!result.isConnected || !_engineSiteSetup) {
        _resultRetryCounts.delete(result); result.removeAttribute('data-observed'); return;
      }
      if (result.hasAttribute('data-blocker-processed')) {
        _resultRetryCounts.delete(result); return;
      }
      result.setAttribute('data-observed', 'true'); resultObserver.observe(result);
    }, RESULT_RETRY_DELAY * attempt);
  }

  function clearStaleObserved(rootCmd) {
    const simple = typeof rootCmd === 'string' ? rootCmd : (Array.isArray(rootCmd) && rootCmd[0] === 'selector' ? rootCmd[1] : '');
    let current = null;
    if (!simple) { try { current = new Set(queryRootCommand(rootCmd)); } catch (_) { current = new Set(); } }
    document.querySelectorAll('[data-observed]').forEach(result => {
      let still = false;
      if (simple) { try { still = result.matches(simple); } catch (_) { still = false; } }
      else still = current.has(result);
      if (still) return; resultObserver.unobserve(result); const quickBtn = result.querySelector('.serh-quick-block'); if (quickBtn) quickBtn.remove(); resetResultStyles(result);
      result.removeAttribute('data-observed');
    });
  }

  function syncObservedSelector(rootCmd) {
    const key = rootCommandKey(rootCmd);
    if (_observedSelector === key) return; _observedSelector = key; clearStaleObserved(rootCmd);
  }

  function filterNestedContainers(nodes, selector) {
    const engine = getSearchEngine();
    let dedupeBy = null; try { if (typeof resolvePageDef === 'function') dedupeBy = resolvePageDef(engine).dedupeBy || null; } catch (_) {}
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
    const kept = arr.filter(el => {
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
    if (dedupeBy) {
      const seen = new Set();
      return kept.filter(el => {
        const tag = el.querySelector ? el.querySelector(dedupeBy) : null;
        if (!tag) return true;
        if (seen.has(tag)) return false;
        seen.add(tag); return true;
      });
    }
    return kept;
  }

  function queryUnobserved(rootCmd) {
    const anchor = rootAnchorSelector(rootCmd); if (!anchor) return [];
    const upward = rootHasUpward(rootCmd);
    try {
      const selector = upward ? anchor : `:is(${anchor}):not([data-observed])`;
      let nodes = Array.from(document.querySelectorAll(selector));
      if (upward) nodes = queryRootCommand(rootCmd).filter(el => !el.hasAttribute('data-observed'));
      return filterNestedContainers(nodes, upward ? '' : anchor);
    } catch (e) {
      try {
        let out = [];
        if (upward) out = queryRootCommand(rootCmd).filter(el => !el.hasAttribute('data-observed'));
        else document.querySelectorAll(anchor).forEach(el => { if (!el.hasAttribute('data-observed')) out.push(el); });
        return filterNestedContainers(out, upward ? '' : anchor);
      } catch (err) {
        return [];
      }
    }
  }

  function scanNewResults() {
    if (!currentConfig.enabled) {
      document.querySelectorAll('.serh-quick-block').forEach(btn => btn.remove());
      document.querySelectorAll('[data-blocker-processed], [data-observed]').forEach(result => {
        resultObserver.unobserve(result); resetResultStyles(result); result.removeAttribute('data-observed');
      });
      showHiddenResults = false; _observedSelector = ''; return;
    }

    const engine = getSearchEngine(); const rootCmd = getRootCommand(engine); const anchor = rootAnchorSelector(rootCmd); if (!anchor) return; syncObservedSelector(rootCmd);
    if (currentConfig.debug) {
      const allMatches = queryRootCommand(rootCmd);
      dbg(`引擎: ${engine}, 选择器: "${rootCommandKey(rootCmd)}", 匹配数量: ${allMatches.length}`);
      if (allMatches.length === 0) {
        dbg('选择器未匹配到任何元素'); dbg('页面中所有 li:', document.querySelectorAll('li').length); dbg('页面中所有 article:', document.querySelectorAll('article').length);
        const classes = new Set();
        document.querySelectorAll('li').forEach(li => {
          if (li.className && typeof li.className === 'string') classes.add(li.className);
        });
        dbg('li 的 class 列表:', [...classes].slice(0, 30));
      } else {
        dbg('第一个匹配元素:', allMatches[0]); dbg('第一个元素的 href:', allMatches[0].querySelector('a[href]')?.href);
      }
    }

    const newResults = queryUnobserved(rootCmd);
    dbg(`未处理的新结果数量: ${newResults.length}`);

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
          getRootSelector,
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
    if (!currentConfig.enabled) showHiddenResults = false;
    if (!isEngineSite()) return; buildRuleIndex(); exposeDebugApi();

    const engine = getSearchEngine(); const rootCmd = getRootCommand(engine); const anchor = rootAnchorSelector(rootCmd); if (!anchor) return; syncObservedSelector(rootCmd);
    dbg(`引擎: ${engine}, 选择器: "${rootCommandKey(rootCmd)}"`);
    dbg(`规则数量: domains=${compiledRules.domains.size}, urls=${compiledRules.urls.length}, titles=${compiledRules.titles.length}, texts=${compiledRules.texts.length}`);

    document.querySelectorAll('.serh-quick-block').forEach(btn => btn.remove()); restoreAllHiddenParents();
    const newResults = queryUnobserved(rootCmd); newResults.forEach(r => r.setAttribute('data-observed', 'true'));
    const batchId = ++forceReprocessBatchId; let totalBlocked = 0; const allResults = document.querySelectorAll('[data-observed]'); let processIdx = 0;
    function processBatch() {
      if (batchId !== forceReprocessBatchId) return; const batchSize = 30; const end = Math.min(processIdx + batchSize, allResults.length);
      for (; processIdx < end; processIdx++) {
        const result = allResults[processIdx]; if (!result.isConnected) continue; resetResultStyles(result);
        try {
          if (processSingleResult(result)) totalBlocked++;
        } catch (e) {
          dbgError('处理结果时出错:', result, e);
        }
        if (!result.hasAttribute('data-blocker-processed')) resultObserver.observe(result);
      }
      if (processIdx < allResults.length) {
        requestAnimationFrame(processBatch);
      } else {
        dbg(`共屏蔽 ${totalBlocked} 个结果`);
        updateStatus(totalBlocked); reconcileHiddenParents();
      }
    }
    requestAnimationFrame(processBatch);
  }

  const LAYOUT_CSS = `
        .serh-blocked-visible { background-color: var(--serh-blocked-bg) !important; border-radius: 8px !important; padding: 8px !important; transition: background 0.2s; }
        .serh-blocked-visible div { background-color: transparent !important; background: transparent !important; background-image: none !important; }
  `;

  let widgetStylesInjected = false, _globalStyleEl = null; let _engineStyleEl = null;
  function injectWidgetStyles() {
    if (widgetStylesInjected) return; widgetStylesInjected = true;
    GM_addStyle(`
        /* 主题变量 */
        body {
            --serh-bg: #ffffff; --serh-fg: #2d3748; --serh-label: #4a5568; --serh-label-strong: #4a5568;
            --serh-faint: #718096; --serh-dim: #a0aec0; --serh-border: #e2e8f0; --serh-input-border: #e2e8f0;
            --serh-editor-border: #e2e8f0; --serh-editor-fg: #000000; --serh-editor-bg: #f8fafc; --serh-gutter-bg: #edf2f7; --serh-code-bg: #f7fafc;
            --serh-readonly-bg: #f7fafc; --serh-input-bg: #ffffff; --serh-switch-off: #cbd5e0; --serh-focus: #3182ce;
            --serh-accent: #2c5282; --serh-success: #276749; --serh-danger: #c53030; --serh-blocked-bg: #d1d5db;
            --serh-bubble: #2c5282; --serh-bubble-number: #000000; --serh-quick-block: #2c5282;
            --serh-bracket-bg: rgba(49, 130, 206, 0.30); --serh-bracket-ring: rgba(49, 130, 206, 0.60); --serh-bracket-enclosing: rgba(100, 116, 139, 0.16);
            --serh-matched-bg: rgba(0, 0, 0, 0.2); --serh-matched-fg: #000000;
            --serh-window-shadow: 0 4px 12px rgba(0,0,0,0.08); --serh-dialog-shadow: 0 4px 12px rgba(0,0,0,0.15); --serh-toast-shadow: 0 4px 12px rgba(0,0,0,0.12);
            --serh-stats-bg: #ffffff; --serh-toast-bg: #ffffff; --serh-dialog-bg: #ffffff;
            --serh-disabled-bg: #edf2f7; --serh-disabled-fg: #a0aec0;
            --serh-scroll-track: #f1f1f1; --serh-scroll-thumb: #c1c1c1; --serh-scroll-thumb-hover: #a8a8a8;
        }
        body.serh-dark-on {
            --serh-bg: #171717; --serh-fg: #f3f4f6; --serh-label: #9ca3af; --serh-label-strong: #f3f4f6;
            --serh-faint: #9ca3af; --serh-dim: #9ca3af; --serh-border: #374151; --serh-input-border: #4b5563;
            --serh-editor-border: #4b5563; --serh-editor-fg: #f3f4f6; --serh-editor-bg: #1E1F21; --serh-gutter-bg: #222629; --serh-code-bg: #374151;
            --serh-readonly-bg: #2d3748; --serh-input-bg: #374151; --serh-switch-off: #4b5563; --serh-focus: #60a5fa;
            --serh-blocked-bg: #374151; --serh-bubble: #a8c7fa; --serh-bubble-number: #ffffff; --serh-quick-block: #ffffff;
            --serh-bracket-bg: rgba(96, 165, 250, 0.38); --serh-bracket-ring: rgba(96, 165, 250, 0.75); --serh-bracket-enclosing: rgba(148, 163, 184, 0.22);
            --serh-matched-bg: rgba(0, 160, 0, 0.9); --serh-matched-fg: #ffffff;
            --serh-window-shadow: 0 4px 12px rgba(0,0,0,0.5); --serh-dialog-shadow: 0 4px 12px rgba(0,0,0,0.5);
            --serh-stats-bg: #171717; --serh-toast-bg: #171717; --serh-dialog-bg: #171717;
            --serh-disabled-bg: #1f2937; --serh-disabled-fg: #6b7280;
        }

        [id^="serh-"]:not(button), #serh-settings-panel * { text-align: left !important; letter-spacing: normal !important; word-spacing: normal !important; text-transform: none !important; text-indent: 0 !important; text-shadow: none !important; text-decoration: none !important; direction: ltr !important; font-style: normal !important; font-variant: normal !important; }
        .serh-window, .serh-window * { box-sizing: border-box !important; }
        .serh-window { font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; font-size: 13px !important; background: var(--serh-bg) !important; color: var(--serh-fg) !important; border: 1px solid var(--serh-border) !important; border-radius: 8px !important; box-shadow: var(--serh-window-shadow) !important; text-align: left !important; line-height: 1.5 !important; transition: all 0.15s ease; }
        #serh-settings-panel * { line-height: 1.2 !important; }
        #serh-settings-panel label, #serh-settings-panel span, #serh-settings-panel select { font-weight: 400 !important; }
        #serh-settings-panel span { font-size: inherit !important; }
        #serh-settings-panel #serh-settings-close { font-size: 12px !important; }
        [id^="serh-"] button, .serh-button { border: none !important; border-radius: 4px !important; cursor: pointer !important; box-sizing: border-box !important; line-height: normal !important; letter-spacing: normal !important; text-transform: none !important; white-space: nowrap !important; vertical-align: middle !important; appearance: none !important; -webkit-appearance: none !important; background-image: none !important; box-shadow: none !important; margin: 0 !important; outline: none !important; text-shadow: none !important; font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; transition: background-color 0.2s; }
        [id^="serh-"] button:not(.serh-action-button), .serh-button:not(.serh-action-button) { font-size: 11px !important; padding: 4px 8px !important; height: auto !important; min-height: 0 !important; width: auto !important; min-width: 0 !important; max-width: none !important; }
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
        .serh-option-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; flex-wrap: wrap; }
        .serh-option-label { font-size: 12px; color: var(--serh-label-strong); white-space: nowrap; margin-bottom: 4px; }
        .serh-compact-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .serh-action-button { padding: 7px 12px !important; font-size: 12px !important; font-weight: 500 !important; box-sizing: border-box !important; height: 32px !important; min-height: 32px !important; line-height: 1 !important; display: inline-flex !important; align-items: center !important; justify-content: center !important; text-align: center !important; }
        .serh-rules-container { display: flex; border: 1px solid var(--serh-editor-border); border-radius: 4px; background: var(--serh-editor-bg); height: 190px; margin-bottom: 3px; position: relative; overflow: hidden; }
        #serh-line-numbers, #serh-sel-line-numbers { min-width: 20px; padding: 8px 4px 8px 2px !important; background: var(--serh-gutter-bg); border-right: 1px solid var(--serh-editor-border); text-align: right !important; color: var(--serh-dim); font-family: 'Consolas', 'Monaco', 'Courier New', monospace !important; font-size: 11px !important; line-height: 15.4px !important; white-space: nowrap !important; overflow: hidden !important; user-select: none !important; flex-shrink: 0; box-sizing: border-box !important; }
        #serh-rules, #serh-sel-rules { flex: 1; height: 100% !important; min-height: 0 !important; max-height: none !important; font-size: 11px !important; padding: 8px !important; margin: 0 !important; border: none !important; resize: none !important; background: transparent !important; box-sizing: border-box !important; font-family: 'Consolas', 'Monaco', 'Courier New', monospace !important; line-height: 15.4px !important; white-space: pre !important; position: relative; z-index: 1; overflow-x: auto !important; overflow-y: auto !important; outline: none !important; box-shadow: none !important; color: var(--serh-editor-fg) !important; }
        .serh-bracket-layer { position: absolute; top: 0; right: 0; bottom: 0; left: 0; z-index: 0; overflow: hidden; pointer-events: none; }
        .serh-bracket-mirror { position: absolute; top: 0; left: 0; visibility: hidden; white-space: pre; pointer-events: none; margin: 0 !important; padding: 0 !important; border: 0 !important; text-indent: 0 !important; text-align: left !important; -webkit-text-size-adjust: 100% !important; text-size-adjust: 100% !important; }
        .serh-bracket-hit { position: absolute; display: none; border-radius: 2px; pointer-events: none; }
        .serh-bracket-pair { background: var(--serh-bracket-bg); box-shadow: 0 0 0 1px var(--serh-bracket-ring); }
        .serh-bracket-enclosing { background: var(--serh-bracket-enclosing); }
        :is(#serh-rules, #serh-sel-rules)::-webkit-scrollbar { width: 6px; height: 0px; }
        :is(#serh-rules, #serh-sel-rules, #serh-stats-content, #serh-subscription-rows-container, #serh-engine-sub-rows)::-webkit-scrollbar-track { background: var(--serh-scroll-track); border-radius: 3px; }
        :is(#serh-rules, #serh-sel-rules, #serh-stats-content, #serh-subscription-rows-container, #serh-engine-sub-rows)::-webkit-scrollbar-thumb { background: var(--serh-scroll-thumb); border-radius: 3px; }
        :is(#serh-rules, #serh-sel-rules, #serh-stats-content, #serh-subscription-rows-container, #serh-engine-sub-rows)::-webkit-scrollbar-thumb:hover { background: var(--serh-scroll-thumb-hover); }
        #serh-stats-panel { position: absolute; top: 10px; left: 15px; right: 15px; bottom: 50px; background: var(--serh-stats-bg); border: 1px solid var(--serh-border); border-radius: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); z-index: 10; display: none; flex-direction: column; overflow: hidden; box-sizing: border-box; }
        #serh-stats-content { padding: 12px; overflow-y: auto; flex: 1; scrollbar-width: thin; }
        .serh-stats-title { color: var(--serh-fg); }
        .serh-stats-item { color: var(--serh-label-strong); }
        #serh-stats-content::-webkit-scrollbar { width: 6px; }
        .serh-quick-block { position: absolute; cursor: pointer; z-index: 99; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; border-radius: 50%; background: transparent; user-select: none; color: var(--serh-quick-block); transition: transform 0.2s; }
        #serh-block-confirm-dialog { position: fixed; z-index: 10002; display: flex; flex-direction: column; gap: 6px; width: 250px; max-width: calc(100vw - 16px); padding: 8px 10px; background: var(--serh-dialog-bg); color: var(--serh-fg); border: 1px solid var(--serh-border); border-radius: 8px; box-shadow: var(--serh-dialog-shadow); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; text-align: left; line-height: 1.4; box-sizing: border-box; }
        #serh-block-confirm-dialog .sfb-confirm-domain { font-size: 11px; color: #718096; word-break: break-all; margin-bottom: 2px; }
        #serh-block-confirm-dialog .sfb-confirm-option { display: flex; align-items: center; gap: 6px; cursor: pointer; margin: 0; padding: 0; border: none; background: transparent; font-weight: normal; white-space: nowrap; }
        #serh-block-confirm-dialog .sfb-confirm-option input[type="radio"] { margin: 0 !important; padding: 0 !important; flex-shrink: 0 !important; accent-color: #2c5282 !important; cursor: pointer !important; width: auto !important; height: auto !important; min-width: 0 !important; appearance: auto !important; -webkit-appearance: auto !important; display: inline-block !important; }
        #serh-block-confirm-dialog .sfb-confirm-option-disabled { cursor: not-allowed; opacity: 0.6; }
        #serh-block-confirm-dialog .sfb-confirm-option-disabled input[type="radio"] { cursor: not-allowed !important; }
        #serh-block-confirm-dialog .sfb-confirm-option-disabled .sfb-confirm-rule { background: var(--serh-disabled-bg); color: var(--serh-disabled-fg); }
        .serh-switch input[type="checkbox"] { opacity: 0 !important; width: 0 !important; height: 0 !important; min-width: 0 !important; max-width: 0 !important; margin: 0 !important; padding: 0 !important; position: absolute !important; pointer-events: none !important; appearance: none !important; -webkit-appearance: none !important; border: none !important; }
        #serh-block-confirm-dialog .sfb-confirm-label { flex-shrink: 0; min-width: 36px; white-space: nowrap; font-size: 12px; }
        #serh-block-confirm-dialog .sfb-confirm-rule { flex: 1; min-width: 0; padding: 3px 6px; border: 1px solid var(--serh-input-border); border-radius: 4px; font-size: 11px; font-family: 'Consolas', 'Monaco', monospace; background: var(--serh-code-bg); color: var(--serh-fg); outline: none; box-shadow: none; height: auto; box-sizing: border-box; }
        #serh-block-confirm-dialog .sfb-confirm-rule:focus { border-color: var(--serh-focus); background: var(--serh-input-bg); }
        #serh-block-confirm-dialog .sfb-confirm-btns { display: flex; gap: 6px; justify-content: flex-end; margin-top: 4px; }
        #serh-block-confirm-dialog .sfb-confirm-btns .serh-button { height: 24px; padding: 0 10px; font-size: 11px; }
        #serh-export-menu { position: fixed; z-index: 10002; display: flex; flex-direction: column; gap: 8px; max-width: calc(100vw - 16px); padding: 10px; background: var(--serh-dialog-bg); color: var(--serh-fg); border: 1px solid var(--serh-border); border-radius: 8px; box-shadow: var(--serh-dialog-shadow); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; line-height: 1.4; box-sizing: border-box; }
        #serh-export-menu .serh-export-grid { display: grid; grid-template-columns: max-content max-content; gap: 8px .5em; }
        #serh-export-menu label { display: flex; align-items: center; gap: 0; cursor: pointer; font-size: 12px; color: var(--serh-fg); margin: 0; padding: 0; white-space: nowrap; }
        #serh-export-menu .serh-switch { margin: 0 .25em 0 0 !important; }
        #serh-export-menu .serh-export-btns { display: flex; gap: 6px; justify-content: flex-end; }
        #serh-export-menu .serh-button { height: 24px; padding: 0 10px; font-size: 11px; }
        .serh-scroll-btn { position: absolute; right: 7px; cursor: pointer; opacity: 0.5; font-size: 18px !important; line-height: 1 !important; user-select: none !important; transition: opacity 0.2s, transform 0.2s; background: transparent !important; border: none !important; padding: 0 !important; margin: 0 !important; z-index: 10; }
        .serh-scroll-btn:hover { opacity: 1; transform: scale(1.2); }
        .serh-quick-block:hover { transform: scale(1.1); opacity: 1; }
        :is(header, [role="navigation"], [role="tablist"], [role="search"]) .serh-quick-block { display: none !important; }
        :is(#serh-webdav-panel, #serh-subscription-panel, #serh-engine-sub-panel) { height: 332px; overflow: visible; }
        :is(#serh-webdav-panel, #serh-subscription-panel, #serh-engine-sub-panel, #serh-selector-panel) #serh-toast-container { max-width: none; width: auto; left: 0; right: 0; }
        body.serh-dark-on #serh-panel .serh-compact-row span { color: #f3f4f6 !important; }
        body.serh-dark-on #serh-rules::placeholder { color: #6b7280 !important; }
        body.serh-dark-on #serh-stats-content { color: #f3f4f6 !important; }
        body.serh-dark-on #serh-panel .serh-compact-row button.serh-button { height: auto !important; min-height: 0 !important; width: auto !important; min-width: 0 !important; flex: 0 0 auto !important; line-height: normal !important; padding: 3px 8px !important; font-size: 11px !important; margin: 0 !important; }
        :is(#serh-webdav-panel, #serh-subscription-panel, #serh-engine-sub-panel, #serh-hlcolor-panel) h3 { margin: 0 0 8px 0 !important; font-size: 14px !important; color: inherit !important; font-weight: 600 !important; padding: 0 !important; border: none !important; background: transparent !important; letter-spacing: normal !important; }
        #serh-hlcolor-panel h3 { margin: 0 0 1px 0 !important; line-height: 1.2 !important; }
        #serh-selector-panel h3 { margin: 0 !important; line-height: 1.2 !important; }
        #serh-webdav-panel .serh-webdav-row { margin-bottom: 8px !important; padding: 0 !important; border: none !important; background: transparent !important; display: block !important; }
        :is(#serh-webdav-panel, #serh-subscription-panel, #serh-engine-sub-panel) label { display: block !important; margin: 0 0 4px 0 !important; color: var(--serh-label) !important; font-size: 12px !important; font-weight: normal !important; line-height: 1.2 !important; }
        :is(#serh-webdav-panel, #serh-subscription-panel, #serh-engine-sub-panel) input[type="text"], :is(#serh-webdav-panel, #serh-subscription-panel, #serh-engine-sub-panel) input[type="password"] { width: 100% !important; padding: 6px 8px !important; margin: 0 !important; border: 1px solid var(--serh-input-border) !important; border-radius: 4px !important; font-size: 13px !important; background: var(--serh-input-bg) !important; color: var(--serh-fg) !important; height: 30px !important; line-height: normal !important; box-shadow: none !important; outline: none !important; display: block !important; }
        :is(#serh-webdav-panel, #serh-subscription-panel, #serh-engine-sub-panel) input:focus { border-color: var(--serh-focus) !important; }
        #serh-webdav-panel .serh-webdav-btn-group { display: flex !important; gap: 8px !important; justify-content: flex-end !important; margin-top: 12px !important; }
        :is(#serh-webdav-panel, #serh-subscription-panel, #serh-engine-sub-panel, #serh-hlcolor-panel) .serh-button, :is(#serh-panel, #serh-selector-panel) .serh-action-button { height: 30px !important; min-height: 30px !important; max-height: 30px !important; padding: 0 12px !important; font-size: 13px !important; font-weight: 500 !important; box-sizing: border-box !important; margin: 0 !important; display: flex !important; align-items: center !important; justify-content: center !important; text-align: center !important; line-height: 1 !important; border: none !important; border-radius: 4px !important; appearance: none !important; -webkit-appearance: none !important; box-shadow: none !important; background-image: none !important; }
        #serh-webdav-panel .serh-button { flex: 1 !important; }
        body.serh-dark-on #serh-settings-panel label { color: #9ca3af !important; }
        body.serh-dark-on #serh-settings-panel select { background: #374151 !important; border-color: #4b5563 !important; color: #f3f4f6 !important; }
        /* 渐变动画 */
        .serh-panel-fade { opacity: 0; transform: var(--serh-panel-tf, translate(0, 0)) translateY(2%); transition: all 0.15s ease; pointer-events: none; }
        .serh-panel-fade.show { opacity: 1; transform: var(--serh-panel-tf, translate(0, 0)); pointer-events: auto; }
        .serh-window:not(.serh-panel-fade) { transition: opacity 0.1s ease; }
        .serh-subscription-panel-header { flex-shrink: 0; }
        .serh-subscription-panel-header h3 { margin: 0 !important; }
        :is(#serh-subscription-rows-container, #serh-engine-sub-rows) { flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; scrollbar-width: thin; padding-right: 2px; }
        :is(#serh-subscription-rows-container, #serh-engine-sub-rows)::-webkit-scrollbar { width: 6px; }
        .serh-subscription-row { display: flex; flex-direction: column; margin-bottom: 0; }
        .serh-subscription-meta-row { display: flex; align-items: center; margin: 2px 0 2px 0; min-height: 14px; }
        .serh-subscription-index { font-size: 12px; color: var(--serh-label); flex-shrink: 0; line-height: 1.2; }
        .serh-subscription-info { font-size: 11px; color: var(--serh-faint); white-space: nowrap; line-height: 1.2; margin-left: auto; margin-right: 24px; }
        .serh-subscription-input-row { display: flex; align-items: center; gap: 6px; }
        .serh-subscription-input-row .serh-subscription-toggle-switch { width: 28px !important; height: 16px !important; margin: 0 !important; flex-shrink: 0 !important; }
        .serh-subscription-input-row input.serh-subscription-url { flex: 1; margin: 0; }
        .serh-subscription-row.serh-subscription-row-invalid input.serh-subscription-url { border-color: #e53935 !important; box-shadow: 0 0 0 1px rgba(229, 57, 53, 0.25) !important; }
        .serh-subscription-delete-btn { background: none; border: none; font-size: 16px; cursor: pointer; color: #c53030; padding: 0; width: 18px; line-height: 1; text-align: center; flex-shrink: 0; opacity: 0.7; transition: opacity 0.2s; }
        .serh-subscription-delete-btn:hover { opacity: 1; }
        .serh-subscription-delete-btn:disabled { color: #a0aec0; cursor: not-allowed; opacity: 0.5; }
        .serh-subscription-input-row input.serh-subscription-url[readonly] { color: var(--serh-faint) !important; background: var(--serh-readonly-bg) !important; }
        .serh-subscription-status-message { font-size: 11px; color: #4a5568; margin-left: 8px; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .serh-subscription-status-message.success { color: #276749; }
        .serh-subscription-status-message.error { color: #c53030; }
        .serh-subscription-btn-group { display: flex; gap: 8px; justify-content: flex-end; margin-top: 12px; flex-shrink: 0; }
        .serh-subscription-btn-group .serh-button { flex: 1 !important; }
        .serh-bubble-number { color: var(--serh-bubble-number) !important; line-height: 1 !important; }
        .serh-matched-rule { position: absolute; top: 2px; left: 50%; transform: translateX(-50%); max-width: calc(100% - 70px); background: var(--serh-matched-bg); color: var(--serh-matched-fg); font-size: 12px; padding: 2px 8px; border-radius: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; z-index: 98; pointer-events: none; font-family: monospace; backdrop-filter: blur(2px); box-shadow: 0 1px 3px rgba(0,0,0,0.2); }
        /* 高亮 */
        #serh-hlcolor-panel .serh-hlcolor-row { margin-bottom: 2px !important; padding: 0 !important; border: none !important; background: transparent !important; display: flex !important; align-items: center !important; gap: 4px !important; height: auto !important; min-height: 0 !important; max-height: none !important; }
        #serh-hlcolor-panel .serh-hlcolor-row label { min-width: 20px !important; font-size: 12px !important; color: var(--serh-label) !important; font-weight: 600 !important; margin: 0 !important; line-height: 1.2 !important; padding: 0 !important; border: none !important; background: transparent !important; height: auto !important; min-height: 0 !important; max-height: none !important; display: block !important; box-sizing: border-box !important; }
        #serh-hlcolor-panel .serh-hlcolor-row .serh-hlcolor-preview { width: 12px !important; height: 12px !important; border-radius: 2px !important; border: 1px solid var(--serh-input-border) !important; flex-shrink: 0 !important; cursor: pointer !important; margin: 0 !important; padding: 0 !important; box-sizing: border-box !important; min-height: 0 !important; max-height: none !important; }
        #serh-hlcolor-panel .serh-hlcolor-row input { width: 70px !important; flex: none !important; padding: 2px 4px !important; margin: 0 !important; border: 1px solid var(--serh-input-border) !important; border-radius: 3px !important; font-size: 11px !important; font-family: 'Consolas', monospace !important; background: var(--serh-input-bg) !important; color: var(--serh-fg) !important; height: 20px !important; line-height: normal !important; box-shadow: none !important; outline: none !important; display: block !important; font-weight: normal !important; box-sizing: border-box !important; min-width: 0 !important; max-width: none !important; min-height: 0 !important; max-height: none !important; transform: none !important; appearance: none !important; -webkit-appearance: none !important; }
        #serh-hlcolor-panel .serh-hlcolor-row input:focus { border-color: var(--serh-focus) !important; }
        #serh-hlcolor-panel .serh-hlcolor-picker-wrapper { display: flex !important; align-items: stretch !important; margin: 0 !important; }
        #serh-hlcolor-sv-canvas, #serh-hlcolor-hue-canvas { cursor: crosshair !important; border-radius: 3px !important; border: 1px solid var(--serh-input-border) !important; }
        #serh-hlcolor-sv-dot, #serh-hlcolor-hue-dot { position: absolute !important; pointer-events: none !important; transform: translate(-50%, -50%) !important; border: 2px solid #ffffff !important; box-shadow: 0 0 3px rgba(0,0,0,0.55) !important; box-sizing: border-box !important; z-index: 2 !important; }
        #serh-hlcolor-sv-dot { width: 13px !important; height: 13px !important; border-radius: 50% !important; }
        #serh-hlcolor-hue-dot { width: 30px !important; height: 6px !important; border-radius: 3px !important; }
        #serh-hlcolor-current-preview { flex-shrink: 0 !important; margin: 0 !important; padding: 0 !important; box-sizing: border-box !important; min-height: 0 !important; max-height: none !important; }
        #serh-hlcolor-code-text { display: flex !important; align-items: center !important; justify-content: center !important; width: 70px !important; height: 20px !important; flex: none !important; margin: 0 !important; padding: 2px 4px !important; box-sizing: border-box !important; border: 1px solid var(--serh-input-border) !important; border-radius: 3px !important; background: var(--serh-code-bg) !important; color: var(--serh-fg) !important; font-size: 11px !important; font-family: 'Consolas', monospace !important; font-weight: normal !important; line-height: normal !important; min-height: 0 !important; max-height: none !important; min-width: 0 !important; overflow: hidden !important; white-space: nowrap !important; }
        /* 开关 */
        .serh-switch { position: relative !important; display: inline-block !important; width: 28px !important; height: 16px !important; margin: 0 6px 0 0 !important; padding: 0 !important; flex-shrink: 0 !important; border: none !important; box-shadow: none !important; background: transparent !important; min-width: 0 !important; max-width: none !important; min-height: 0 !important; max-height: none !important; box-sizing: border-box !important; }
        .serh-slider { position: absolute !important; cursor: pointer !important; top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important; background-color: var(--serh-switch-off) !important; transition: .2s !important; border-radius: 16px !important; border: none !important; box-shadow: none !important; margin: 0 !important; padding: 0 !important; box-sizing: border-box !important; }
        .serh-slider:before { position: absolute !important; content: "" !important; height: 12px !important; width: 12px !important; left: 2px !important; bottom: 2px !important; top: auto !important; right: auto !important; background-color: #ffffff !important; transition: .2s !important; border-radius: 50% !important; border: none !important; box-shadow: none !important; margin: 0 !important; padding: 0 !important; box-sizing: border-box !important; transform: none !important; }
        .serh-switch input:checked + .serh-slider { background-color: var(--serh-accent) !important; }
        .serh-switch input:checked + .serh-slider:before { transform: translateX(12px) !important; }
        #serh-bubble-size-slider { flex: 1 1 0% !important; margin: 0 0 0 5px !important; height: 4px !important; min-height: 0 !important; max-height: none !important; width: auto !important; min-width: 0 !important; max-width: none !important; padding: 0 !important; border: none !important; border-radius: 2px !important; background: #cbd5e0 !important; outline: none !important; box-shadow: none !important; appearance: none !important; -webkit-appearance: none !important; -moz-appearance: none !important; cursor: pointer !important; transform: none !important; vertical-align: middle !important; }
        #serh-bubble-size-slider::-webkit-slider-thumb { -webkit-appearance: none !important; width: 14px !important; height: 14px !important; border-radius: 50% !important; background: var(--serh-accent) !important; cursor: pointer !important; border: none !important; }
        #serh-bubble-size-slider::-moz-range-thumb { width: 14px !important; height: 14px !important; border-radius: 50% !important; background: var(--serh-accent) !important; cursor: pointer !important; border: none !important; }
        #serh-toast-container { position: fixed; top: 15px; right: 15px; z-index: 2147483647; display: flex; flex-direction: column; align-items: stretch; gap: 8px; pointer-events: none; max-width: min(320px, calc(100vw - 16px)); }
        .serh-toast { pointer-events: auto; box-sizing: border-box; background: var(--serh-toast-bg); border: 1px solid var(--serh-border); border-left: 3px solid var(--serh-accent); border-radius: 6px; box-shadow: var(--serh-toast-shadow); color: var(--serh-fg); font-size: 12px; line-height: 1.4; padding: 8px 12px; word-break: break-all; cursor: pointer; opacity: 0; transform: translateY(8px); transition: opacity 0.25s ease, transform 0.25s ease; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        .serh-toast.show { opacity: 1; transform: translateY(0); }
        .serh-toast-success { border-left-color: var(--serh-success); }
        .serh-toast-error { border-left-color: var(--serh-danger); }
        .serh-toast-info { border-left-color: var(--serh-accent); }`);
  }

  function injectGlobalStyles() {
    const engine = getSearchEngine(); const applyLayout = engine !== 'other' && !!getSelectors()[engine];
    if (applyLayout) {
      if (!_globalStyleEl) {
        const el = GM_addStyle(LAYOUT_CSS); if (el && typeof el.remove === 'function') _globalStyleEl = el;
      }
      let def = null; try { def = resolvePageDef(engine); } catch (_) {}
      let css = def ? normalizeCssRules(def.blockedCss).join('\n') : '';
      const psCss = def ? preserveSpaceCss(def) : '';
      if (psCss) css = css ? css + '\n' + psCss : psCss;
      if (css) {
        if (!_engineStyleEl) { const el = GM_addStyle(css); if (el && typeof el.remove === 'function') _engineStyleEl = el; }
        else if (_engineStyleEl.textContent !== css) _engineStyleEl.textContent = css;
      } else if (_engineStyleEl) {
        _engineStyleEl.remove(); _engineStyleEl = null;
      }
    } else {
      if (_globalStyleEl) { _globalStyleEl.remove(); _globalStyleEl = null; }
      if (_engineStyleEl) { _engineStyleEl.remove(); _engineStyleEl = null; }
    }
    injectWidgetStyles();
  }

  function removeGlobalStyles() {
    if (_globalStyleEl) {
      _globalStyleEl.remove(); _globalStyleEl = null;
    }
    if (_engineStyleEl) {
      _engineStyleEl.remove(); _engineStyleEl = null;
    }
  }

  function applyBubbleStyle(element) {
    element.style.cssText = `
            position: fixed; background: transparent; color: var(--serh-bubble); border-radius: 4px;
            z-index: 10000; cursor: grab; font-weight: bold; user-select: none;
            transition: opacity 0.2s, text-shadow 0.2s, transform 0.2s; opacity: 0.8;
            font-family: Arial, sans-serif; text-align: center; box-sizing: border-box;
            display: flex; align-items: center; justify-content: center;
        `;
  }

  function getBubbleSize() {
    let size = typeof currentConfig.bubbleSize === 'number' ? currentConfig.bubbleSize : parseInt(currentConfig.bubbleSize, 10);
    if (!Number.isFinite(size)) size = 30;
    return Math.max(20, Math.min(60, size));
  }

  function applyBubbleSize(element) {
    const size = getBubbleSize(); element.style.fontSize = size + 'px'; element.style.padding = '5px 5px'; element.style.lineHeight = (1 + (size - 12) * 0.015).toFixed(2);
    element.style.height = (size + 10) + 'px';
  }

  function updateBubbleContent(statusBtn, blocked) {
    const isLeft = currentConfig.bubbleState ? currentConfig.bubbleState.isLeftHalf : true; const isToggleMode = currentConfig.bubbleAction === 'toggleHidden'; const isEngineMode = currentConfig.bubbleAction === 'openSelectors';

    const bubbleIcon = (inner) => `<span style="display: inline-block; width: 1em; height: 1em; vertical-align: -0.15em; flex-shrink: 0; line-height: 0;"><svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg></span>`;
    const slash = currentConfig.bubbleAction === 'openStats' ? '<line x1="19.07" y1="4.93" x2="4.93" y2="19.07"/>' : '<line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>';
    const icon = isToggleMode
      ? bubbleIcon('<circle cx="12" cy="12" r="10"/>')
      : isEngineMode ? bubbleIcon('<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>')
      : bubbleIcon(`<circle cx="12" cy="12" r="10"/>${slash}`);

    let newHtml;
    newHtml = currentConfig.showCount
      ? (isLeft ? `${icon} <span class="serh-bubble-number">${blocked}</span>` : `<span class="serh-bubble-number">${blocked}</span> ${icon}`)
      : icon;
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

      let isDragging = false, startX, startY, initialLeft, initialTop;
      let longPressTimer = null, hasLongPressed = false;
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

        if (['toggleHidden', 'openStats', 'openSelectors'].includes(currentConfig.bubbleAction)) {
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
        status.style.transition = 'opacity 0.2s, text-shadow 0.2s, transform 0.2s, left 0.15s ease, right 0.15s ease, top 0.15s ease, color 0.2s';
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
                else if (action === 'selectors') showSelectorPanel();
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
      } else if (blockedShown()) {
        el.classList.remove('serh-blocked-visible'); el.classList.add('serh-blocked-collapsed');
        const btn = el.querySelector('.serh-quick-block'); if (btn) btn.remove();
        removeMatchedRuleLabel(el);
        applyResultCollapse(el, getSearchEngine());
      } else {
        el.classList.remove('serh-blocked-visible'); el.classList.remove('serh-blocked-collapsed'); restoreResultCollapse(el); removeMatchedRuleLabel(el);
      }
    });
    if (showHiddenResults) {
      document.querySelectorAll(hideSel('group', GROUP_HIDE_ATTR) + ',' + hideSel('grid', GRID_HIDE_ATTR)).forEach(parent => {
        restoreOriginalDisplay(parent);
      });
    } else {
      document.querySelectorAll(hideSel('group', GROUP_HIDE_ATTR)).forEach(recheckGroupRoot);
      document.querySelectorAll(hideSel('group', GROUP_HIDE_ATTR)).forEach(parent => {
        const groupAttr = parent.getAttribute('data-serh-group-attr'); if (groupAttr) recheckGroupRoot(parent);
      });
      document.querySelectorAll(hideSel('grid', GRID_HIDE_ATTR)).forEach(recheckGridCell);
      if (!blockedShown()) {
        document.querySelectorAll(hideSel('grid', GRID_HIDE_ATTR)).forEach(cell => { cell.style.display = 'none'; });
        const engine = getSearchEngine(); const def = resolvePageDef(engine);
        if (def.grid) document.querySelectorAll('[data-is-blocked="true"]').forEach(el => markResultGridSlot(el, engine, def));
      }
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
    const { rules, bubbleState, bubbleSize, selectors, subscriptions, engineSubscriptions, builtinEngineSubEnabled, syncedAt, rulesSyncedAt, settingsModifiedAt, selectorsSyncedAt, tombstones, ruleAddedTimes, subscriptionTombstones, exportConfig, ...settings } = config || {};
    const unsafeKey = (k) => k === '__proto__' || k === 'constructor' || k === 'prototype';
    const cleanVal = (v) => {
      if (!v || typeof v !== 'object' || Array.isArray(v)) return v;
      const o = {}; for (const k of Object.keys(v)) if (!unsafeKey(k)) o[k] = cleanVal(v[k]);
      return o;
    };
    const clean = {}; for (const k of Object.keys(settings)) if (!unsafeKey(k)) clean[k] = cleanVal(settings[k]);
    return clean;
  }

  function getRulesModifiedTime() {
    try { const saved = GM_getValue(LOCAL_LAST_MODIFIED_KEY, 0); return typeof saved === 'number' && Number.isFinite(saved) && saved > 0 ? saved : 0; } catch (e) { return 0; }
  }

  function getSettingsModifiedTime() {
    try { const saved = GM_getValue(SETTINGS_LAST_MODIFIED_KEY, null); if (typeof saved === 'number' && Number.isFinite(saved) && saved > 0) return saved; } catch (e) {}
    return 0;
  }

  function getSelectorsModifiedTime() {
    try { const saved = GM_getValue(SELECTORS_LAST_MODIFIED_KEY, 0); return typeof saved === 'number' && Number.isFinite(saved) && saved > 0 ? saved : 0; } catch (e) { return 0; }
  }

  function hasPendingLocalChange() { return GM_getValue(WEBDAV_DIRTY_KEY, false) === true; }
  function getWebDAVSyncWait() {
    const retryCount = GM_getValue(WEBDAV_RETRY_COUNT_KEY, 0);
    if (retryCount > 0) return Math.min(2 ** retryCount, 32) * 60000;
    return hasPendingLocalChange() ? 0 : WEBDAV_AUTO_SYNC_INTERVAL - AUTO_SYNC_TOLERANCE;
  }

  function persistConfig(updateModifiedTime = false) {
    const fingerprint = JSON.stringify(currentConfig.rules || []);
    if (fingerprint !== _rulesFingerprint) { _rulesRevision++; _rulesFingerprint = fingerprint; }
    const previous = normalizeConfig(GM_getValue(CONFIG_KEY, getDefaultConfig()));
    const rulesChanged = JSON.stringify(previous.rules) !== JSON.stringify(currentConfig.rules);
    const settingsChanged = !selectorsEqual(getSyncSettings(previous), getSyncSettings(currentConfig));
    GM_setValue(CONFIG_KEY, currentConfig);
    if (updateModifiedTime) {
      if (rulesChanged) markLocalModifiedTime(); if (settingsChanged) markLocalModifiedTime(SETTINGS_LAST_MODIFIED_KEY);
      if (rulesChanged || settingsChanged) {
        triggerWebDAVSyncDelayed(5000);
      }
    }
    return { rulesChanged, settingsChanged };
  }

  function markLocalModifiedTime(key = LOCAL_LAST_MODIFIED_KEY) {
    const prev = GM_getValue(key, 0) || 0; const now = Math.max(Date.now(), prev + 1); GM_setValue(key, now);
    const webdav = loadWebDAVConfig(); if (!webdav || !webdav.url || !isHttpsUrl(webdav.url)) return;
    Promise.resolve(getTrustedNow()).then(trusted => {
      if (trusted > 0 && GM_getValue(key, 0) === now) GM_setValue(key, trusted);
    }).catch(() => {});
  }

  const SETTINGS_PANEL_CHECKBOXES = {
    'serh-set-remove-redirects': 'removeRedirects',
    'serh-set-show-block-btn': 'showBlockBtn',
    'serh-set-block-domain': 'blockDomain', 'serh-set-block-confirm': 'blockConfirm',
    'serh-set-show-source': 'showMatchedSource', 'serh-set-show-sub-btn': 'showSubBtn', 'serh-set-show-sync-btn': 'showSyncBtn', 'serh-set-bracket-highlight': 'bracketHighlight',
    'serh-set-show-bubble': 'showBubble', 'serh-set-show-count': 'showCount',
    'serh-set-panel-centered': 'panelCentered',
    'serh-set-disable-block': 'enabled', 'serh-set-debug': 'debug',
    'serh-set-error-detection': 'errorDetection', 'serh-set-collapse-mode': 'collapseMode', 'serh-set-highlight-whitelist': 'highlightWhitelist', 'serh-set-time-calibration': 'timeCalibration'
  };
  const INVERTED_SETTINGS_CHECKBOXES = new Set(['serh-set-disable-block']);

  function applyDarkModeClass() {
    const mode = currentConfig.darkMode === 'light' || currentConfig.darkMode === 'dark' ? currentConfig.darkMode : 'system';
    const dark = mode === 'dark' || (mode === 'system' && !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches));
    if (document.body) document.body.classList.toggle('serh-dark-on', dark);
  }
  const UI_SCALE_VALUE = { s: 0.75, l: 1, xl: 1.25, xxl: 1.5 };
  function currentUiScale() { return UI_SCALE_VALUE[currentConfig.uiScale === 's' ? 's' : currentConfig.uiScale === 'xl' ? 'xl' : currentConfig.uiScale === 'xxl' ? 'xxl' : 'l'] || 1; }
  function applyUiScale() {
    const scale = currentUiScale();
    document.querySelectorAll('.serh-window').forEach(el => { el.style.zoom = scale === 1 ? '' : String(scale); });
  }

  let _collapseStyleEl = null;

  function buildCollapseCss() {
    const seen = new Set(); const rules = [];
    rules.push('body.serh-collapse-on .serh-blocked-collapsed .serh-collapse-hide { display: none !important; }');
    for (const [key, def] of Object.entries(getSelectors())) {
      for (const sel of [...commandSelectors(def.snippet), ...(def.extraSelector || [])]) {
        if (typeof sel !== 'string' || !sel.trim() || hasTopLevelComma(sel)) continue;
        const scoped = `body.serh-collapse-on .serh-blocked-collapsed[data-serh-engine="${key}"] ${sel}`;
        if (seen.has(scoped)) continue; seen.add(scoped);
        rules.push(`${scoped} { display: none !important; }`);
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
    const on = currentConfig.collapseMode === true;
    if (document.body) document.body.classList.toggle('serh-collapse-on', on);
    if (on) ensureCollapseStyle();
    else if (_collapseStyleEl) { _collapseStyleEl.remove(); _collapseStyleEl = null; }
  }

  function applyGlobalConfigUi() { applyDarkModeClass(); applyUiScale(); applyCollapseMode(); }

  function applyConfigToMainPanel(syncRules = true) {
    applyGlobalConfigUi(); if (!document.getElementById('serh-panel')) return;
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
    if (bubbleActionSelect) bubbleActionSelect.value = ['toggleHidden', 'openStats', 'openSelectors'].includes(currentConfig.bubbleAction) ? currentConfig.bubbleAction : 'openPanel';
    const uiScaleSync = document.getElementById('serh-set-ui-scale'); if (uiScaleSync) uiScaleSync.value = ['s', 'xl', 'xxl'].includes(currentConfig.uiScale) ? currentConfig.uiScale : 'l';
    const darkModeSync = document.getElementById('serh-set-dark-mode'); if (darkModeSync) darkModeSync.value = ['light', 'dark'].includes(currentConfig.darkMode) ? currentConfig.darkMode : 'system';
    const langSync = document.getElementById('serh-set-language'); if (langSync) langSync.value = currentConfig.language === 'en' ? 'en' : 'zh-CN';
    const textarea = document.getElementById('serh-rules');
    if (syncRules && textarea && Array.isArray(currentConfig.rules)) {
      textarea.value = currentConfig.rules.join('\n'); updateLineNumbers();
    }
    applySubSyncBtnVisibility();
  }

  function collectMainPanelConfigState() {
    if (!document.getElementById('serh-panel')) return;
    Object.keys(SETTINGS_PANEL_CHECKBOXES).forEach(id => {
      const el = document.getElementById(id); if (!el) return; currentConfig[SETTINGS_PANEL_CHECKBOXES[id]] = INVERTED_SETTINGS_CHECKBOXES.has(id) ? !el.checked : el.checked;
    });
  }

  function syncRulesTextarea() {
    const textarea = document.getElementById('serh-rules');
    if (textarea) {
      textarea.value = currentConfig.rules.join('\n'); updateLineNumbers();
    }
  }

  function setRulesTextareaValue(textarea, text) {
    if (!textarea || textarea.value === text) return;
    const old = textarea.value; const start = textarea.selectionStart; const end = textarea.selectionEnd; const top = textarea.scrollTop; const left = textarea.scrollLeft;
    const map = (pos) => {
      const max = Math.min(old.length, text.length); let p = 0; while (p < max && old.charCodeAt(p) === text.charCodeAt(p)) p++;
      return pos <= p ? Math.min(pos, text.length) : Math.min(text.length, Math.max(p, pos + text.length - old.length));
    };
    const s = map(start), e = map(end);
    textarea.value = text;
    try { textarea.setSelectionRange(s, e); } catch (_) {}
    textarea.scrollTop = top; textarea.scrollLeft = left;
  }

  function appendRuleToTextarea(rule) {
    const textarea = document.getElementById('serh-rules'); if (!textarea) return; const clean = stripRuleComment(String(rule).trim()); const panel = document.getElementById('serh-panel');
    if (panel && Array.isArray(panel._initialRules) &&
        !panel._initialRules.some(r => getRuleKey(r) === getRuleKey(rule))) {
      panel._initialRules.push(rule);
    }
    const lines = textarea.value ? textarea.value.split('\n') : []; if (lines.some(l => stripRuleComment(l.trim()) === clean)) return; lines.push(rule); setRulesTextareaValue(textarea, lines.join('\n'));
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
      setRulesTextareaValue(textarea, filtered.join('\n')); updateLineNumbers();
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
    if (!s) return '';
    if (s === 'local' || /^sub:\d+$/.test(s)) return s;
    if (s === '本地规则' || s === 'Local Rule' || s === t('localRule')) return 'local';
    const m = /^(?:订阅|Sub)\s*(\d+)$/i.exec(s); return m ? 'sub:' + m[1] : '';
  }

  function updateStatsContent() {
    const statsContent = document.getElementById('serh-stats-content'); if (!statsContent) return;

    const textarea = document.getElementById('serh-rules'); const rulesText = textarea ? textarea.value : currentConfig.rules.join('\n'); const rawLines = rulesText.split('\n');
    const fmRange = findYamlFrontmatterRange(rawLines);
    const localRules = filterValidRuleLines(fmRange ? rawLines.filter((_, i) => i < fmRange.start || i > fmRange.end) : rawLines);
    const activeRules = localRules
      .filter(rule => !rule.startsWith('#'))
      .map(rule => stripRuleComment(rule))
      .filter(rule => rule.length > 0);

    const ruleErrors = new Map(); const ruleCounts = new Map();
    activeRules.forEach(rule => {
      if (currentConfig.errorDetection !== false) {
        const analysis = cachedAnalyzeRule(rule); if (!analysis.valid) ruleErrors.set(rule, analysis.errors.length ? analysis.errors : [t('invalidRule')]);
      }
      ruleCounts.set(rule, (ruleCounts.get(rule) || 0) + 1);
    });
    const duplicateRules = [...ruleCounts.entries()].filter(([, c]) => c > 1);

    const engine = getSearchEngine(); const rootCmd = getRootCommand(engine); let results = [];
    try { results = queryRootCommand(rootCmd); } catch (e) { dbgWarn('[统计] 容器选择器无效:', rootCommandKey(rootCmd), e); }
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
      const blockedRule = (result.dataset.matchedRule || '').trim(); if (blockedRule) addRuleHit(blockedRule, result.dataset.matchedSourceKey || result.dataset.matchedSource, null, result);
      const wlRule = (result.dataset.whitelistRule || '').trim(); if (wlRule) addRuleHit(wlRule, result.dataset.whitelistSourceKey || result.dataset.whitelistSource, t('whitelistRules'), result);
      const hlRule = (result.dataset.highlightRule || '').trim(); if (hlRule) addRuleHit(hlRule, result.dataset.highlightSourceKey || result.dataset.highlightSource, t('highlightRules'), result);
    });

    const ruleErrorsArray = [...ruleErrors].map(([rule, errors]) => ({
      rule,
      msg: errors.join(', ')
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
      return `<div style="margin-top: 12px; padding-top: 8px; border-top: 1px solid #e2e8f0;"><div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; padding-bottom: 4px; border-bottom: 1px solid #cbd5e0;"><span class="serh-stats-title" style="font-weight: bold; font-size: 14px;">${title}</span><span style="background: #2c5282; color: white; padding: 2px 10px; border-radius: 12px; font-size: 12px;">${badge}</span></div>`;
    }

    const rulesSectionHtml = (title, badge, items) => {
      if (!items.length) return ''; let html = statsSectionStartHtml(title, badge);
      for (const item of items) {
        html += `<div class="serh-stats-item" style="font-size: 11px; word-break: break-all; font-family: 'Consolas', monospace;">${item}</div>`;
      }
      return html + '</div>';
    };

    if (ruleErrorsArray.length > 0) {
      resultHTML += issueBlockHtml(t('statsErrors', {count: ruleErrorsArray.length}), '#c53030', '#fff5f5', 'errorWord', ruleErrorsArray);
    }

    const sourceOrder = getSubscriptions().map((_, i) => [`sub:${i + 1}`, `${t('subscription')}${i + 1}`]).concat([['local', t('localRule')]]);
    let hasMatches = false;

    sourceOrder.forEach(([source, sourceLabel]) => {
      const sourceStats = statsBySource.get(source); if (!sourceStats || sourceStats.total === 0) return; hasMatches = true;

      resultHTML += `<div style="margin-bottom: 16px;">`;
      resultHTML += `<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; padding-bottom: 4px; border-bottom: 1px solid #cbd5e0;">`;
      resultHTML += `<span class="serh-stats-title" style="font-weight: bold; font-size: 14px;">${sourceLabel}</span>`;
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

    if (!hasMatches && ruleErrorsArray.length === 0) {
      resultHTML = `<div style="color: #38a169; padding: 10px; border-radius: 4px; font-size: 12px; background: #f0fff4; text-align: center;">${t('noMatch')}</div>`;
    }

    resultHTML += rulesSectionHtml(t('duplicateRules'), `${duplicateRules.length} ${t('matchedCountUnit')}`,
      duplicateRules.map(([rule, count]) => `${escHtml(rule)} <span style="color:#c53030;">${t('ruleDuplicate', {count})}</span>`));

    statsContent.innerHTML = resultHTML;
  }

  function applySubSyncBtnVisibility() {
    const subBtn = document.getElementById('serh-subscribe'); const syncBtn = document.getElementById('serh-sync');
    if (subBtn) subBtn.style.display = currentConfig.showSubBtn !== false ? '' : 'none';
    if (syncBtn) syncBtn.style.display = currentConfig.showSyncBtn !== false ? '' : 'none';
  }

  function showConfigPanel() {
    const clearPanelCloseTimers = () => {
      if (_panelCloseTimer) {
        clearTimeout(_panelCloseTimer); _panelCloseTimer = null;
      }
      if (_panelCloseHandler) {
        document.removeEventListener('click', _panelCloseHandler); _panelCloseHandler = null;
      }
      if (_panelPressHandler) {
        document.removeEventListener('pointerdown', _panelPressHandler); document.removeEventListener('mousedown', _panelPressHandler); _panelPressHandler = null;
      }
    };
    const opened = openPanel('serh-panel', { bindClose: false });
    if (!opened) return;
    clearPanelCloseTimers();
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
                        <button id="serh-subscribe" class="serh-button serh-button-secondary" style="padding: 3px 8px; border: 1px solid transparent; min-width: 0 !important; width: auto !important; flex: 0 0 auto !important;">${t('subscription')}</button>
                        <button id="serh-sync" class="serh-button serh-button-success" style="padding: 3px 8px; border: 1px solid transparent; min-width: 0 !important; width: auto !important; flex: 0 0 auto !important;">${t('sync')}</button>
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
    applySubSyncBtnVisibility();
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
    bindCancelButton('serh-close', closePanel);
    document.getElementById('serh-subscribe').onclick = showSubscriptionPanel; document.getElementById('serh-sync').onclick = showWebDAVPanel;
    document.getElementById('serh-import-file').onclick = importRulesFromFile; document.getElementById('serh-export-file').onclick = (e) => {
      e.stopPropagation(); if (document.getElementById('serh-export-menu')) closeExportMenu(); else showExportMenu(e.currentTarget);
    };
    document.getElementById('serh-open-settings').onclick = (e) => {
      e.stopPropagation(); showSettingsPanel();
    };

    function findCommentLineIndices(lines) {
      const indices = [];
      for (let i = 0; i < lines.length; i++) if (lines[i].trim()[0] === '#') indices.push(i);
      return indices;
    }

    function jumpToComment(direction) {
      const text = textarea.value; const lines = text.split('\n'); const commentIndices = findCommentLineIndices(lines); if (!commentIndices.length) return;
      const lineOffsets = []; let offset = 0;
      for (let i = 0; i < lines.length; i++) { lineOffsets.push(offset); offset += lines[i].length + 1; }

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
      const targetPos = lineOffsets[targetLineIndex] + (lines[targetLineIndex].length - lines[targetLineIndex].trimStart().length);

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

    const closeZoneSelector = '#serh-status, #serh-webdav-panel, #serh-subscription-panel, #serh-engine-sub-panel, #serh-hlcolor-panel, #serh-selector-panel, #serh-block-confirm-dialog, #serh-export-menu, #serh-settings-panel, .serh-quick-block';
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
    _panelCloseHandler = closeHandler; _panelPressHandler = pressHandler; if (_panelCloseTimer) clearTimeout(_panelCloseTimer);
    _panelCloseTimer = setTimeout(() => {
      _panelCloseTimer = null;
      if (panel.isConnected && _panelCloseHandler === closeHandler) {
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
    const storedRules = Array.isArray(currentConfig.rules) ? currentConfig.rules : [];
    const finalRules = JSON.stringify(baseRules) === JSON.stringify(storedRules) ? userRules : mergeRules3Way(baseRules, userRules, storedRules, true);

    currentConfig.rules = finalRules;
    persistConfig(rulesChanged);
    if (panel) panel._initialRules = [...finalRules]; if (JSON.stringify(userRules) !== JSON.stringify(finalRules)) syncRulesTextarea();
    if (showHiddenResults) {
      showHiddenResults = false;
      if (!blockedShown()) {
        document.querySelectorAll('[data-is-blocked="true"]').forEach(el => {
          el.style.display = 'none'; el.classList.remove('serh-blocked-visible'); el.classList.remove('serh-blocked-collapsed'); setResultExtraElementsVisible(el, false); removeMatchedRuleLabel(el); restoreResultCollapse(el);
        });
        document.querySelectorAll(hideSel('group', GROUP_HIDE_ATTR)).forEach(parent => { parent.style.display = 'none'; });
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
    const settingsSelect = (id, labelKey, options, current) => `
            <div style="flex: 1; min-width: 0; margin: 0; padding: 0;">
                <label for="${id}" style="display: block; margin: 0 0 4px; padding: 0; cursor: pointer; font-size: 12px; color: #4a5568;">${t(labelKey)}</label>
                <select id="${id}" style="width: 100%; min-width: 0; margin: 0; font-size: 12px; padding: 3px 4px; border: 1px solid #cbd5e0; border-radius: 4px; background: #fff; color: #2d3748; cursor: pointer; outline: none; font-family: inherit;">
                    ${options.map(([val, label]) => `<option value="${val}" ${current === val ? 'selected' : ''}>${escHtml(label)}</option>`).join('\n                    ')}
                </select>
            </div>`;

    panel.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between; margin: 0 0 4px; padding: 0;">
                <h3 style="margin: 0; padding: 0; font-size: 13px; font-weight: 600;">${escHtml(t('settingsPanelTitle'))}</h3>
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
              { id: 'serh-set-bracket-highlight', labelKey: 'bracketHighlight', checked: currentConfig.bracketHighlight !== false }
            ])}
            ${settingsRow([
              { id: 'serh-set-show-sub-btn', labelKey: 'showSubBtn', checked: currentConfig.showSubBtn !== false },
              { id: 'serh-set-show-sync-btn', labelKey: 'showSyncBtn', checked: currentConfig.showSyncBtn !== false }
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
              { id: 'serh-set-collapse-mode', labelKey: 'collapseMode', checked: currentConfig.collapseMode === true },
              { id: 'serh-set-highlight-whitelist', labelKey: 'highlightWhitelist', checked: currentConfig.highlightWhitelist === true }
            ])}
            ${settingsRow([
              { id: 'serh-set-time-calibration', labelKey: 'timeCalibration', checked: currentConfig.timeCalibration !== false }
            ], true)}
            <div style="display: flex; gap: 8px; margin: 2px 0 0; padding: 0;">
                ${settingsSelect('serh-set-ui-scale', 'uiScale', [['s', t('scaleM')], ['l', t('scaleL')], ['xl', t('scaleXL')], ['xxl', t('scaleXXL')]], ['s', 'xl', 'xxl'].includes(currentConfig.uiScale) ? currentConfig.uiScale : 'l')}
                ${settingsSelect('serh-set-dark-mode', 'darkMode', [['system', t('darkSystem')], ['light', t('darkLight')], ['dark', t('darkDark')]], ['light', 'dark'].includes(currentConfig.darkMode) ? currentConfig.darkMode : 'system')}
            </div>
            <div style="display: flex; gap: 8px; margin: 5px 0 0; padding: 0;">
                <div style="flex: 1; min-width: 0; margin: 0; padding: 0;">
                    <label for="serh-set-bubble-action" style="display: block; margin: 0 0 4px; padding: 0; cursor: pointer; font-size: 12px; color: #4a5568;">${t('menuBubbleAction')}</label>
                    <select id="serh-set-bubble-action" style="width: 100%; min-width: 0; margin: 0; font-size: 12px; padding: 3px 4px; border: 1px solid #cbd5e0; border-radius: 4px; background: #fff; color: #2d3748; cursor: pointer; outline: none; font-family: inherit;">
                        <option value="openPanel" ${!['openStats', 'toggleHidden', 'openSelectors'].includes(currentConfig.bubbleAction) ? 'selected' : ''}>${t('menuBubbleActionOpen')}</option>
                        <option value="openStats" ${currentConfig.bubbleAction === 'openStats' ? 'selected' : ''}>${t('menuBubbleActionStats')}</option>
                        <option value="toggleHidden" ${currentConfig.bubbleAction === 'toggleHidden' ? 'selected' : ''}>${t('menuBubbleActionToggle')}</option>
                        <option value="openSelectors" ${currentConfig.bubbleAction === 'openSelectors' ? 'selected' : ''}>${t('menuCustomSelectors')}</option>
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
      { id: 'serh-set-show-sub-btn', key: 'showSubBtn', apply: () => { applySubSyncBtnVisibility(); } },
      { id: 'serh-set-show-sync-btn', key: 'showSyncBtn', apply: () => { applySubSyncBtnVisibility(); } },
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
      { id: 'serh-set-highlight-whitelist', key: 'highlightWhitelist', apply: () => {
        forceReprocessAll();
        if (currentConfig.highlightWhitelist === true) showToast(t('highlightWhitelistHint'), 'info');
      } },
      { id: 'serh-set-time-calibration', key: 'timeCalibration', apply: () => {
        if (currentConfig.timeCalibration === false) showToast(t('timeCalibrationHint'), 'info');
      } }
    ];
    settingsDefs.forEach(sw => {
      const el = document.getElementById(sw.id);
      if (el) {
        el.addEventListener('change', function() {
          adoptStoredConfigBeforeWrite(); currentConfig[sw.key] = sw.invert ? !this.checked : this.checked; persistConfig(true); if (sw.apply) sw.apply();
        });
      }
    });

    const uiScaleSelect = document.getElementById('serh-set-ui-scale');
    if (uiScaleSelect) {
      uiScaleSelect.addEventListener('change', function() {
        adoptStoredConfigBeforeWrite(); currentConfig.uiScale = this.value; persistConfig(true); applyUiScale();
      });
    }

    const darkModeSelect = document.getElementById('serh-set-dark-mode');
    if (darkModeSelect) {
      darkModeSelect.addEventListener('change', function() {
        adoptStoredConfigBeforeWrite(); currentConfig.darkMode = this.value; persistConfig(true); applyDarkModeClass();
      });
    }

    const bubbleActionSelect = document.getElementById('serh-set-bubble-action');
    if (bubbleActionSelect) {
      bubbleActionSelect.addEventListener('change', function() {
        const wasToggleMode = currentConfig.bubbleAction === 'toggleHidden';
        adoptStoredConfigBeforeWrite(); currentConfig.bubbleAction = this.value; persistConfig(true);
        if (wasToggleMode && this.value !== 'toggleHidden' && showHiddenResults) toggleHiddenResults();
        const statusBtn = document.getElementById('serh-status'); if (statusBtn) updateBubbleContent(statusBtn, parseInt(statusBtn.dataset.blockedCount || 0));
        if (this.value === 'toggleHidden') showToast(t('bubbleToggleHint'), 'info');
        else if (this.value === 'openStats') showToast(t('bubbleStatsHint'), 'info');
        else if (this.value === 'openSelectors') showToast(t('bubbleSelectorsHint'), 'info');
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

    bindCancelButton('serh-settings-close', closePanel);
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

    function hexToRgb(hex) { return [parseInt(hex.slice(1,3), 16), parseInt(hex.slice(3,5), 16), parseInt(hex.slice(5,7), 16)]; }
    function rgbToHex(r, g, b) { return '#' + [r,g,b].map(x => x.toString(16).padStart(2,'0').toUpperCase()).join(''); }

    const colors = currentConfig.highlightColors || {}; const sanitizeHex = (val, fallback) => (/^#[0-9A-Fa-f]{6}$/.test(String(val || '')) ? String(val).toUpperCase() : fallback); let rowsHtml = '';
    for (let i = 1; i <= 5; i++) {
      const hex = sanitizeHex(colors[i], DEFAULT_HIGHLIGHT_COLORS[i]);
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
      const rect = svCanvas.getBoundingClientRect(); const x = Math.max(0, Math.min(rect.width, clientX - rect.left)); const y = Math.max(0, Math.min(rect.height, clientY - rect.top));
      currentSat = x / rect.width; currentVal = 1 - y / rect.height; updatePickedColor(); updateIndicators();
    }

    const hueCanvas = document.getElementById('serh-hlcolor-hue-canvas');
    const svDot = document.getElementById('serh-hlcolor-sv-dot'); const hueDot = document.getElementById('serh-hlcolor-hue-dot');
    function updateIndicators() {
      if (!svDot || !hueDot || !svCanvas.width) return;
      svDot.style.left = (svCanvas.offsetLeft + currentSat * svCanvas.offsetWidth) + 'px'; svDot.style.top = (svCanvas.offsetTop + (1 - currentVal) * svCanvas.offsetHeight) + 'px';
      hueDot.style.left = (hueCanvas.offsetLeft + hueCanvas.offsetWidth / 2) + 'px'; hueDot.style.top = (hueCanvas.offsetTop + (currentHue / 360) * hueCanvas.offsetHeight) + 'px';
    }
    function onHueMove(clientY) {
      const rect = hueCanvas.getBoundingClientRect(); const y = Math.max(0, Math.min(rect.height, clientY - rect.top)); currentHue = (y / rect.height) * 360; drawSVCanvas(currentHue);
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

    bindCancelButton('serh-hlcolor-cancel', closePanel);
  }

  function regexSourceToLiteralText(source) {
    let out = '', inClass = false;
    for (let i = 0; i < source.length; i++) {
      const ch = source[i];
      if (ch === '\\') { out += ch + (source[i + 1] || ''); i++; continue; }
      if (inClass) { if (ch === ']') inClass = false; out += ch; continue; }
      if (ch === '[') inClass = true;
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
    const str = (s) => `'${escapeJsString(s)}'`;
    const lit = (v) => {
      if (typeof v === 'string') return str(v);
      if (typeof v === 'number' || typeof v === 'boolean') return String(v);
      if (v == null) return 'null';
      if (v instanceof RegExp) return `/${regexSourceToLiteralText(v.source)}/${v.flags || ''}`;
      if (Array.isArray(v)) return `[${v.map(lit).join(', ')}]`;
      if (typeof v === 'object') return `{ ${Object.entries(v).map(([k, x]) => `${keyToText(k)}: ${lit(x)}`).join(', ')} }`;
      return 'null';
    };
    const matchToText = (match) => {
      const bare = typeof match === 'string' && !isRegexLiteralStr(match); const m = matchDefToParts(match);      return (m.source || m.flags) ? `/${regexSourceToLiteralText(m.source)}/${m.flags || (bare ? 'i' : '')}` : `''`;
    };
    const resultFields = ['root', 'url', 'title', 'snippet', 'extraSelector', 'button', 'skip', 'group', 'grid', 'dedupeBy', 'link', 'blockedCss', 'preserveSpace', 'site'];
    const buttonHasPosition = (b) => b === false || (b && typeof b === 'object' && ((b.inset && Object.keys(b.inset).length) || b.zIndex !== undefined || b.style !== undefined || ['mount', 'scope', 'require', 'requireSelf', 'exclude'].some((f) => b[f] !== undefined)));
    const buttonToText = (b) => {
      if (b === false) return 'false';
      if (b && typeof b === 'object') {
        const out = {};
        if (b.inset && typeof b.inset === 'object') { const opts = {}; for (const f of ['top', 'right', 'bottom', 'left']) if (b.inset[f] !== undefined) opts[f] = b.inset[f]; if (Object.keys(opts).length) out.inset = opts; }
        if (b.zIndex !== undefined) out.zIndex = b.zIndex;
        if (b.style !== undefined) out.style = b.style;
        for (const f of ['mount', 'scope', 'require', 'requireSelf', 'exclude']) if (b[f] !== undefined) out[f] = b[f];
        if (Object.keys(out).length) return `{ ${Object.entries(out).map(([k, x]) => `${keyToText(k)}: ${lit(x)}`).join(', ')} }`;
      }
      return lit(b);
    };
    const serhOf = (obj) => {
      const out = {};
      for (const f of ['skip', 'group', 'grid', 'dedupeBy', 'link', 'blockedCss', 'preserveSpace']) if (obj[f] !== undefined) out[f] = obj[f];
      if (out.link) {
        out.link = { ...out.link };
        if (Array.isArray(out.link.redirects)) out.link.redirects = out.link.redirects.map((s) => (s && typeof s === 'object' ? { ...s } : s)); else if (out.link.redirects == null) delete out.link.redirects;
        for (const spec of (out.link.redirects || [])) if (spec) for (const f of ['path', 'pathValue', 'hrefSuffix', 'stripPrefix']) { const v = spec[f]; if (v && typeof v === 'object' && !(v instanceof RegExp) && typeof v.source === 'string') { try { spec[f] = new RegExp(v.source, v.flags || ''); } catch (_) {} } }
        if (!Object.keys(out.link).length) delete out.link;
      }
      return Object.keys(out).length ? out : null;
    };
    const asTextSimple = (v) => {
      if (typeof v === 'string') return v;
      if (Array.isArray(v) && v.length === 2 && v[0] === 'text' && typeof v[1] === 'string') return v[1];
      if (Array.isArray(v) && v[0] === 'or' && Array.isArray(v[1]) && v[1].length) {
        const list = v[1].map((x) => (typeof x === 'string' ? x : (Array.isArray(x) && x.length === 2 && x[0] === 'text' && typeof x[1] === 'string' ? x[1] : null)));
        if (list.every((x) => x !== null)) return list;
      }
      return null;
    };
    const asLinkSimple = (v) => {
      if (typeof v === 'string') return v;
      if (Array.isArray(v) && v.length >= 2 && v[0] === 'attribute' && v[1] === 'href' && v.length <= 3) return v[2] === undefined ? ':scope[href]' : String(v[2]);
      if (Array.isArray(v) && v[0] === 'or' && Array.isArray(v[1]) && v[1].length) {
        const list = v[1].map((x) => (typeof x === 'string' ? x : (Array.isArray(x) && x.length >= 2 && x[0] === 'attribute' && x[1] === 'href' && x.length <= 3 ? (x[2] === undefined ? ':scope[href]' : String(x[2])) : null)));
        if (list.every((x) => x !== null)) return list;
      }
      return null;
    };
    const simpleValue = (obj, f) => {
      if (obj[f] === undefined) return undefined;
      if (f === 'root') return obj[f];
      const simple = f === 'url' ? asLinkSimple(obj[f]) : asTextSimple(obj[f]);
      return simple === null ? obj[f] : simple;
    };
    const bodyLines = (obj, indent) => {
      const lines = [];
      for (const f of ['root', 'url', 'title', 'snippet']) if (obj[f] !== undefined) lines.push(`${indent}${f}: ${lit(simpleValue(obj, f))},`);
      if (obj.site !== undefined) lines.push(`${indent}site: ${lit(obj.site)},`);
      if (obj.delay !== undefined) lines.push(`${indent}delay: ${lit(obj.delay)},`);
      if (obj.extraSelector !== undefined) {
        const list = normalizeSelectorList(obj.extraSelector);
        if (list.length) lines.push(`${indent}extraSelector: ${str(list.map((s) => '& ' + s).join(', '))},`);
      }
      if (obj.button !== undefined && buttonHasPosition(obj.button)) lines.push(`${indent}button: ${buttonToText(obj.button)},`);
      const serh = serhOf(obj);
      if (serh) lines.push(`${indent}command: ${lit(serh)},`);
      return lines;
    };
    const pageToText = (pageName, page, engineKey) => {
      const lines = [`    ${keyToText(pageName)}: {`];
      if (page.includeRegex !== undefined || page.match !== undefined) lines.push(`      includeRegex: ${matchToText(page.includeRegex !== undefined ? page.includeRegex : page.match)},`);
      if (page.excludeRegex) lines.push(`      excludeRegex: ${matchToText(page.excludeRegex)},`);
      if (page.matches && page.matches.length) lines.push(`      matches: ${lit(page.matches)},`);
      if (page.excludeMatches && page.excludeMatches.length) lines.push(`      excludeMatches: ${lit(page.excludeMatches)},`);
      const cp = page.commonProps && typeof page.commonProps === 'object' && !Array.isArray(page.commonProps) ? page.commonProps : null;
      const derived = { $site: engineKey, $category: pageName };
      if (cp && Object.keys(cp).some((k) => cp[k] !== derived[k])) lines.push(`      commonProps: ${lit(cp)},`);
      for (const line of bodyLines(page, '      ')) lines.push(line);
      lines.push('    },');
      return lines.join('\n');
    };
    const defToText = (def, disabled, key) => {
      const lines = [];
      if (def.includeRegex || def.match !== undefined) lines.push(`  includeRegex: ${matchToText(def.includeRegex !== undefined ? def.includeRegex : def.match)},`);
      if (def.excludeRegex) lines.push(`  excludeRegex: ${matchToText(def.excludeRegex)},`);
      if (def.matches && def.matches.length) lines.push(`  matches: ${lit(def.matches)},`);
      if (def.excludeMatches && def.excludeMatches.length) lines.push(`  excludeMatches: ${lit(def.excludeMatches)},`);
      if (def.priority !== undefined) lines.push(`  priority: ${lit(def.priority)},`);
      for (const line of bodyLines(cleanPage(def), '  ')) lines.push(line);
      const pages = normalizePageMap(def.pages);
      if (pages && Object.keys(pages).length) lines.push(`  pages: {\n${Object.keys(pages).map((n) => pageToText(n, pages[n], key)).join('\n')}\n  },`);
      if (disabled) lines.push('  disabled: true,'); else if (def.disabled === false) lines.push('  disabled: false,');
      return `{\n${lines.join('\n')}\n}`;
    };
    for (const key of Object.keys(merged)) {
      if (key === 'other') continue; const def = merged[key];
      if (def && def.disabled) {
        const pages = normalizePageMap(def.pages);
        let hasCustom = !!(def.includeRegex || def.match || def.excludeRegex || def.matches || def.excludeMatches || def.root || def.url || def.title || def.snippet || def.site || def.delay !== undefined || (def.extraSelector && def.extraSelector.length) || def.group || def.grid || (def.blockedCss && def.blockedCss.length) || def.preserveSpace !== undefined || (pages && Object.keys(pages).length));
        if (hasCustom) { parts.push(`${keyToText(key)}: ${defToText(def, true, key)}`); continue; }
        const builtin = getBaseSelectors()[key];
        parts.push(`${keyToText(key)}: ${builtin ? defToText(builtin, true, key) : '{\n  disabled: true,\n}'}`);
        continue;
      }
      parts.push(`${keyToText(key)}: ${defToText(def, false, key)}`);
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
    const s = String(selector).replace(/(["'])(?:\\.|(?!\1).)*\1/g, '');
    return /::/.test(s) || /(^|[^:]):(?:before|after|first-line|first-letter)\b/i.test(s);
  }

    function validateUserSelectors(config) {
    if (!config || typeof config !== 'object' || Array.isArray(config)) return [t('selectorJsonError')];
    const errors = [];
    const css = (v, field, label, extra) => {
      if (typeof v !== 'string' || !v.trim()) { errors.push(t('selectorFieldRequired', { key: label, field })); return; }
      try { if (extra && hasTopLevelComma(v)) throw 0; if (!(extra ? isValidCssSelector(':scope > :nth-child(1) ' + v) : isValidCssSelector(v))) throw 0; } catch (_) { errors.push(t('selectorInvalidCss', { key: label, field, value: v })); return; }
      if (hasPseudoElement(v)) errors.push(t('selectorInvalidCss', { key: label, field, value: v }));
    };
    const rootField = (v, field, label) => {
      if (typeof v === 'string') { css(v, field, label); return; }
      if (!Array.isArray(v) || typeof v[0] !== 'string') { errors.push(t('selectorInvalidCommand', { key: label, field, value: JSON.stringify(v) })); return; }
      if (v[0] === 'selector') { css(v[1], field, label); return; }
      if (v[0] === 'upward') {
        if (typeof v[1] === 'string') { if (!v[1].trim()) errors.push(t('selectorFieldRequired', { key: label, field: field + '.level' })); else css(v[1], field + '.level', label); }
        else { const level = Number(v[1]); if (!Number.isInteger(level) || level < 0) errors.push(t('selectorFieldRequired', { key: label, field: field + '.level' })); }
        if (v[2] === undefined) errors.push(t('selectorFieldRequired', { key: label, field: field + '.inner' }));
        else rootField(v[2], field, label);
        return;
      }
      errors.push(t('selectorInvalidCommand', { key: label, field, value: JSON.stringify(v) }));
    };
    const el = (v, field, label) => {
      if (v == null) return;
      if (typeof v === 'string') { css(v, field, label); return; }
      if (!Array.isArray(v) || typeof v[0] !== 'string') { errors.push(t('selectorInvalidCommand', { key: label, field, value: JSON.stringify(v) })); return; }
      if (v[0] === 'upward') { if (typeof v[1] === 'string') css(v[1], field, label); else if (typeof v[1] !== 'number') errors.push(t('selectorInvalidCommand', { key: label, field, value: JSON.stringify(v) })); el(v[2], field, label); }
      else if (v[0] === 'selector') { css(v[1], field, label); el(v[2], field, label); }
      else errors.push(t('selectorInvalidCommand', { key: label, field, value: JSON.stringify(v) }));
    };
    const cmd = (v, field, label) => {
      if (!Array.isArray(v) || typeof v[0] !== 'string') { errors.push(t('selectorInvalidCommand', { key: label, field, value: JSON.stringify(v) })); return; }
      const ty = v[0], a = v[1], b = v[2], c = v[3];
      const req = (x, f) => { if (typeof x !== 'string' || !x) errors.push(t('selectorFieldRequired', { key: label, field: f })); };
      const re = (x, f) => { const ok = x instanceof RegExp ? true : (x && typeof x === 'object' && typeof x.source === 'string' ? !!x.source : (typeof x === 'string' && x)); if (!ok) { errors.push(t('selectorFieldRequired', { key: label, field: f })); return; } try { x instanceof RegExp ? new RegExp(x.source, x.flags) : (x && typeof x.source === 'string' ? new RegExp(x.source, sanitizeRegexFlags(x.flags)) : new RegExp(x)); } catch (_) { errors.push(t('selectorInvalidRegex', { key: label })); } };
      switch (ty) {
        case 'or': if (!Array.isArray(a)) errors.push(t('selectorInvalidCommand', { key: label, field, value: JSON.stringify(v) })); else a.forEach((x) => cmd(x, field, label)); if (b !== undefined && (typeof b === 'string' || (Array.isArray(b) && (b[0] === 'selector' || b[0] === 'upward')))) el(b, field, label); break;
        case 'attribute': req(a, field); el(b, field, label); break;
        case 'property': req(a, field); el(b, field, label); break;
        case 'text': el(a, field, label); break;
        case 'queryParam': req(a, field); cmd(b, field, label); break;
        case 'base64Url': { const names = Array.isArray(a) ? a : [a]; if (!names.length || !names.every((x) => typeof x === 'string' && x)) errors.push(t('selectorFieldRequired', { key: label, field })); if (b !== undefined) el(b, field, label); break; }
        case 'jsonParse': case 'urlDecode': case 'base64Decode': cmd(a, field, label); break;
        case 'prefix': req(a, field); cmd(b, field, label); break;
        case 'rejectEngineHost': case 'normalizeUrl': case 'rejectOpaqueRedirect': cmd(a, field, label); break;
        case 'jsonPath': if (typeof a !== 'string') errors.push(t('selectorFieldRequired', { key: label, field })); cmd(b, field, label); break;
        case 'regexInclude': case 'regexExclude': re(a, field); cmd(b, field, label); break;
        case 'regexSubstitute': re(a, field); req(b, field); cmd(c, field, label); break;
        case 'const': break;
        default: errors.push(t('selectorInvalidCommand', { key: label, field, value: JSON.stringify(v) }));
      }
    };
    const valueField = (val, field, mode, label) => {
      if (val === undefined) return;
      if (isCommandArray(val)) { cmd(val, field, label); return; }
      const list = Array.isArray(val) ? val : (typeof val === 'string' ? [val] : null);
      if (!list || !list.every((x) => typeof x === 'string' && x)) { errors.push(t('selectorInvalidCommand', { key: label, field, value: JSON.stringify(val) })); return; }
      for (const s of list) css(s, field, label);
    };
    const def = (d, label, isPage) => {
      const regexField = (rawMatch, field) => {
        if (rawMatch === undefined) return;
        if (typeof rawMatch === 'string' && rawMatch) {
          const lit = parseRegexLiteral(rawMatch); const badLit = isRegexLiteralStr(rawMatch) ? getInvalidRegexFlags(lit.flags) : '';
          if (badLit) errors.push(t('invalidRegexFlags', { flags: badLit }));
          else { try { isRegexLiteralStr(rawMatch) ? new RegExp(lit.source, lit.flags) : new RegExp(rawMatch); } catch (e) { errors.push(t('selectorInvalidRegex', { key: label })); } }
        } else if (rawMatch && typeof rawMatch === 'object' && typeof rawMatch.source === 'string' && rawMatch.source) {
          try { new RegExp(rawMatch.source, sanitizeRegexFlags(rawMatch.flags)); } catch (e) { errors.push(t('selectorInvalidRegex', { key: label })); }
          const badFlags = getInvalidRegexFlags(String(rawMatch.flags || '')); if (badFlags) errors.push(t('invalidRegexFlags', { flags: badFlags }));
        } else errors.push(t('selectorFieldRequired', { key: label, field }));
      };
      regexField(d.includeRegex !== undefined ? d.includeRegex : d.match, 'includeRegex');
      regexField(d.excludeRegex, 'excludeRegex');
      if (d.matches !== undefined) {
        const list = Array.isArray(d.matches) ? d.matches : (typeof d.matches === 'string' ? [d.matches] : null);
        if (!list || !list.length || !list.every((x) => typeof x === 'string' && x.trim())) errors.push(t('selectorFieldRequired', { key: label, field: 'matches' }));
        else for (const p of list) if (!matchPatternToRegex(p)) errors.push(t('selectorInvalidRegex', { key: label }));
      }
      if (d.excludeMatches !== undefined) {
        const list = Array.isArray(d.excludeMatches) ? d.excludeMatches : (typeof d.excludeMatches === 'string' ? [d.excludeMatches] : null);
        if (!list || !list.length || !list.every((x) => typeof x === 'string' && x.trim())) errors.push(t('selectorFieldRequired', { key: label, field: 'excludeMatches' }));
        else for (const p of list) if (!matchPatternToRegex(p)) errors.push(t('selectorInvalidRegex', { key: label }));
      }
      const root = d.root !== undefined ? d.root : d.containers;
      const hasPages = Array.isArray(d.pages) ? d.pages.length > 0 : !!(d.pages && typeof d.pages === 'object' && Object.keys(d.pages).length);
      const onlyDisabled = !isPage && d.disabled !== undefined && Object.keys(d).every((k) => k === 'disabled' || k === 'name');
      if (root !== undefined) rootField(root, 'root', label); else if (!isPage && !hasPages && !onlyDisabled) errors.push(t('selectorFieldRequired', { key: label, field: 'root' }));
      if (!isPage && !onlyDisabled && !getBaseSelectors()[label] && d.includeRegex === undefined && d.match === undefined && d.matches === undefined) errors.push(t('selectorFieldRequired', { key: label, field: 'includeRegex/matches' }));
      const url = d.url !== undefined ? d.url : d.links;
      if (url !== undefined) valueField(url, 'url', 'link', label);
      if (d.title !== undefined) valueField(d.title, 'title', 'text', label);
      if (d.snippet !== undefined) valueField(d.snippet, 'snippet', 'text', label);
      if (d.titles !== undefined) valueField(d.titles, 'titles', 'text', label);
      if (d.extraSelector !== undefined) {
        const list = Array.isArray(d.extraSelector) ? d.extraSelector : (typeof d.extraSelector === 'string' ? [d.extraSelector] : null);
        if (!list || !list.every((x) => typeof x === 'string' && x)) errors.push(t('selectorFieldRequired', { key: label, field: 'extraSelector' }));
        else for (const s of list) {
          const parts = splitTopLevelSelectorList(s);
          if (parts.length > 1 && !parts.every((p) => p.trim().startsWith('&'))) { errors.push(t('selectorInvalidCss', { key: label, field: 'extraSelector', value: s })); continue; }
          for (const part of parts) {
            let sel = part.trim(); if (sel.startsWith('&')) sel = sel.slice(1).trim();
            if (sel) css(sel, 'extraSelector', label, true);
          }
        }
      }
      if (d.button !== undefined) {
        if (Array.isArray(d.button)) {
          if (typeof d.button[0] !== 'string' || !d.button[0]) errors.push(t('selectorInvalidBool', { key: label, field: 'button' }));
          const opts = d.button[1];
          if (opts !== undefined && (!opts || typeof opts !== 'object' || Array.isArray(opts))) errors.push(t('selectorFieldRequired', { key: label, field: 'button.options' }));
          else if (opts) for (const f of ['top', 'right', 'bottom', 'left', 'zIndex']) if (opts[f] !== undefined && typeof opts[f] !== 'string' && typeof opts[f] !== 'number') errors.push(t('selectorFieldRequired', { key: label, field: 'button.options.' + f }));
          if (d.button[2] !== undefined) {
            if (typeof d.button[2] === 'string') css(d.button[2], 'button.element', label);
            else el(d.button[2], 'button.element', label);
          }
        } else if (d.button !== false && d.button !== true) {
          if (!d.button || typeof d.button !== 'object') errors.push(t('selectorInvalidBool', { key: label, field: 'button' }));
          else {
            for (const f of ['scope', 'require', 'requireSelf', 'exclude']) if (d.button[f] !== undefined) css(d.button[f], 'button.' + f, label);
            if (d.button.mount !== undefined) { if (Array.isArray(d.button.mount)) el(d.button.mount, 'button.mount', label); else css(d.button.mount, 'button.mount', label); }
            if (d.button.style !== undefined && typeof d.button.style !== 'string') errors.push(t('selectorFieldRequired', { key: label, field: 'button.style' }));
            if (d.button.inset && typeof d.button.inset === 'object') { for (const f of ['top', 'right', 'bottom', 'left']) if (d.button.inset[f] !== undefined && typeof d.button.inset[f] !== 'string' && typeof d.button.inset[f] !== 'number') errors.push(t('selectorFieldRequired', { key: label, field: 'button.inset.' + f })); }
            if (d.button.zIndex !== undefined && typeof d.button.zIndex !== 'string' && typeof d.button.zIndex !== 'number') errors.push(t('selectorFieldRequired', { key: label, field: 'button.zIndex' }));
          }
        }
      }
      if (d.blockedCss !== undefined) {
        const list = Array.isArray(d.blockedCss) ? d.blockedCss : (typeof d.blockedCss === 'string' ? [d.blockedCss] : null);
        if (!list || !list.length || !list.every((x) => typeof x === 'string' && x.trim())) errors.push(t('selectorFieldRequired', { key: label, field: 'blockedCss' }));
      }
      if (d.preserveSpace !== undefined && d.preserveSpace !== false && d.preserveSpace !== null) {
        const ps = normalizePreserveSpace(d.preserveSpace);
        if (!ps) errors.push(t('selectorFieldRequired', { key: label, field: 'preserveSpace' }));
        else if (ps.container !== undefined) css(ps.container, 'preserveSpace.container', label);
      }
      if (d.site !== undefined) {
        const list = Array.isArray(d.site) ? d.site : (typeof d.site === 'string' ? normalizeSiteList(d.site) : null);
        if (!list || !list.length || !list.every((x) => typeof x === 'string' && x.trim())) errors.push(t('selectorFieldRequired', { key: label, field: 'site' }));
      }
      if (d.skip !== undefined) css(d.skip, 'skip', label);
      if (d.dedupeBy !== undefined) css(d.dedupeBy, 'dedupeBy', label);
      if (d.priority !== undefined && (typeof d.priority !== 'number' || !isFinite(d.priority))) errors.push(t('selectorFieldRequired', { key: label, field: 'priority' }));
      if (d.delay !== undefined && d.delay !== null && d.delay !== true && d.delay !== false && (typeof d.delay !== 'number' || !isFinite(d.delay) || d.delay < 0)) errors.push(t('selectorFieldRequired', { key: label, field: 'delay' }));      if (d.group !== undefined) {
        if (!d.group || typeof d.group !== 'object' || Array.isArray(d.group)) errors.push(t('selectorFieldRequired', { key: label, field: 'group' }));
        else {
          if (d.group.container !== undefined && d.group.container !== 'parent') css(d.group.container, 'group.container', label);
          if (d.group.members !== undefined) css(d.group.members, 'group.members', label);
          if (d.group.hideAttr !== undefined && typeof d.group.hideAttr !== 'string') errors.push(t('selectorFieldRequired', { key: label, field: 'group.hideAttr' }));
        }
      }
      if (d.grid !== undefined) {
        if (!d.grid || typeof d.grid !== 'object' || Array.isArray(d.grid)) errors.push(t('selectorFieldRequired', { key: label, field: 'grid' }));
        else {
          if (d.grid.anchor !== undefined && d.grid.anchor !== 'grid') css(d.grid.anchor, 'grid.anchor', label);
          if (d.grid.cell !== undefined) css(d.grid.cell, 'grid.cell', label);
          if (d.grid.items !== undefined) { const ls = Array.isArray(d.grid.items) ? d.grid.items : [d.grid.items]; for (const s of ls) css(s, 'grid.items', label); }
          if (d.grid.has !== undefined) css(d.grid.has, 'grid.has', label);
          if (d.grid.deepest !== undefined && typeof d.grid.deepest !== 'boolean') errors.push(t('selectorFieldRequired', { key: label, field: 'grid.deepest' }));
          if (d.grid.hideAttr !== undefined && typeof d.grid.hideAttr !== 'string') errors.push(t('selectorFieldRequired', { key: label, field: 'grid.hideAttr' }));
        }
      }
      if (d.link !== undefined) {
        if (!d.link || typeof d.link !== 'object' || Array.isArray(d.link)) errors.push(t('selectorFieldRequired', { key: label, field: 'link' }));
        else {
          if (d.link.redirects !== undefined && !Array.isArray(d.link.redirects)) errors.push(t('selectorFieldRequired', { key: label, field: 'link.redirects' }));
          if (d.link.directAttrs !== undefined && !(typeof d.link.directAttrs === 'string' || (Array.isArray(d.link.directAttrs) && d.link.directAttrs.every((x) => typeof x === 'string' && x)))) errors.push(t('selectorFieldRequired', { key: label, field: 'link.directAttrs' }));
          if (d.link.directScope !== undefined) css(d.link.directScope, 'link.directScope', label);
          if (d.link.directProtocol !== undefined && typeof d.link.directProtocol !== 'string') errors.push(t('selectorFieldRequired', { key: label, field: 'link.directProtocol' }));
        }
      }
      if (d.command !== undefined) {
        if (!d.command || typeof d.command !== 'object' || Array.isArray(d.command)) errors.push(t('selectorFieldRequired', { key: label, field: 'command' }));
        else def(d.command, label + '.command', true);
      }
      if (d.commonProps !== undefined) {
        if (!d.commonProps || typeof d.commonProps !== 'object' || Array.isArray(d.commonProps)) errors.push(t('selectorFieldRequired', { key: label, field: 'commonProps' }));
        else for (const [k, v] of Object.entries(d.commonProps)) if (typeof v !== 'string') errors.push(t('selectorFieldRequired', { key: label, field: 'commonProps.' + k }));
      }
      if (d.disabled !== undefined && d.disabled !== null && typeof d.disabled !== 'boolean') errors.push(t('selectorInvalidBool', { key: label, field: 'disabled' }));
    };
    for (const key of Object.keys(config)) {
      const d = config[key];
      if (key === 'other' || key === '__proto__') { errors.push(t('selectorReservedKey', { key })); continue; }
      if (!/^[A-Za-z0-9_-]+$/.test(key)) { errors.push(t('selectorInvalidKey', { key })); continue; }
      if (!d || typeof d !== 'object' || Array.isArray(d)) { errors.push(t('selectorFieldRequired', { key, field: 'match' })); continue; }
      def(d, key, false);
      if (d.pages !== undefined) {
        if (!d.pages || typeof d.pages !== 'object') errors.push(t('selectorFieldRequired', { key, field: 'pages' }));
        else if (Array.isArray(d.pages)) {
          d.pages.forEach((page, idx) => {
            if (!page || typeof page !== 'object' || Array.isArray(page)) { errors.push(t('selectorFieldRequired', { key, field: 'pages.' + idx })); return; }
            const cp = page.commonProps;
            const nm = typeof page.name === 'string' && page.name.trim() ? page.name.trim() : (cp && typeof cp === 'object' && !Array.isArray(cp) && typeof cp.$category === 'string' && cp.$category.trim() ? cp.$category.trim() : '');
            if (!nm) { errors.push(t('selectorFieldRequired', { key, field: 'pages.' + idx + '.name' })); return; }
            def(page, key + '.' + nm, true);
          });
        } else for (const pageName of Object.keys(d.pages)) {
          const page = d.pages[pageName];
          if (!page || typeof page !== 'object' || Array.isArray(page)) { errors.push(t('selectorFieldRequired', { key, field: 'pages.' + pageName })); continue; }
          if (!/^[A-Za-z0-9_-]+$/.test(pageName)) { errors.push(t('selectorInvalidKey', { key: key + '.' + pageName })); continue; }
          def(page, key + '.' + pageName, true);
        }
      }
    }
    return errors;
  }

  function matchDefToParts(match) {
    if (typeof match === 'string') { const m = parseRegexLiteral(match); return { source: m.source, flags: m.flags }; }
    if (match instanceof RegExp) return { source: match.source, flags: match.flags || '' };
    if (match && typeof match === 'object' && typeof match.source === 'string') return { source: match.source, flags: String(match.flags || '').toLowerCase() }; return { source: '', flags: '' };
  }
  function jsonKey(v) { return JSON.stringify(v, (k, x) => x instanceof RegExp ? { source: x.source, flags: x.flags } : x); }

  function normalizeSelectorAliases(def) {
    if (!def || typeof def !== 'object') return def;
    const out = { ...def };
    if (out.root === undefined && out.containers !== undefined) out.root = out.containers;
    if (out.url === undefined && out.links !== undefined) out.url = simpleToCommand(out.links, 'link');
    if (out.title === undefined && out.titles !== undefined) out.title = simpleToCommand(out.titles, 'text');
    if (out.includeRegex === undefined && out.match !== undefined) out.includeRegex = out.match;
    delete out.containers; delete out.links; delete out.titles; delete out.match;
    return out;
  }
  function pageMapKey(pages) {
    const map = normalizePageMap(pages) || {}; const out = {};
    for (const name of Object.keys(map)) {
      const page = mergeSelectorDef(map[name], {});
      const m = matchDefToParts(map[name].includeRegex);
      const ex = matchDefToParts(map[name].excludeRegex);
      out[name] = { ...page, ...(m.source || m.flags ? { includeRegex: m } : {}), ...(ex.source || ex.flags ? { excludeRegex: ex } : {}) };
    }
    return jsonKey(out);
  }
  function sameSelectorDef(a, b) {
    a = normalizeSelectorAliases(a); b = normalizeSelectorAliases(b);
    if (!a || !b) return false; if (!!a.disabled !== !!b.disabled) return false;
    const aM = matchDefToParts(a.includeRegex); const bM = matchDefToParts(b.includeRegex); if (aM.source !== bM.source || aM.flags !== bM.flags) return false;
    const aX = matchDefToParts(a.excludeRegex); const bX = matchDefToParts(b.excludeRegex); if (aX.source !== bX.source || aX.flags !== bX.flags) return false;
    const aD = mergeSelectorDef(a, {}), bD = mergeSelectorDef(b, {});
    for (const k of ['root', 'url', 'title', 'snippet', 'extraSelector', 'button', 'skip', 'group', 'grid', 'dedupeBy', 'link', 'blockedCss', 'preserveSpace', 'site', 'matches', 'excludeMatches', 'priority', 'delay']) if (jsonKey(aD[k]) !== jsonKey(bD[k])) return false;
    return pageMapKey(a.pages) === pageMapKey(b.pages);
  }

  function diffSelectorDefFields(def, builtin) {
    def = normalizeSelectorAliases(def);
    const diff = {}; if (!def || typeof def !== 'object') return diff;
    if (!builtin) {
      for (const k of Object.keys(def)) diff[k] = def[k]; return diff;
    }
    const bInc = builtin.includeRegex !== undefined ? builtin.includeRegex : builtin.match;
    const d = mergeSelectorDef(def, {}), b = mergeSelectorDef(builtin, {});
    if (def.includeRegex !== undefined) {
      const aM = matchDefToParts(def.includeRegex); const bM = matchDefToParts(bInc); if (aM.source !== bM.source || aM.flags !== bM.flags) diff.includeRegex = def.includeRegex;
    }
    if (def.excludeRegex !== undefined) {
      const aX = matchDefToParts(def.excludeRegex); const bX = matchDefToParts(builtin.excludeRegex); if (aX.source !== bX.source || aX.flags !== bX.flags) diff.excludeRegex = def.excludeRegex;
    }
    for (const k of ['root', 'url', 'title', 'snippet', 'extraSelector', 'button', 'skip', 'group', 'grid', 'dedupeBy', 'link', 'blockedCss', 'preserveSpace', 'site', 'matches', 'excludeMatches', 'priority', 'delay']) {
      const src = def[k] !== undefined ? def[k] : (def.command && def.command[k]);
      if (src !== undefined && jsonKey(d[k]) !== jsonKey(b[k])) diff[k] = src;
    }
    if (def.pages !== undefined) {
      const dp = normalizePageMap(def.pages), bp = normalizePageMap(builtin.pages) || {}; const pd = {};
      if (dp) for (const name of Object.keys(dp)) {
        const page = dp[name], basePage = bp[name]; if (!basePage) { pd[name] = page; continue; }
        const fields = {};
        for (const k of Object.keys(page)) {
          if (k === 'includeRegex' || k === 'excludeRegex') {
            const a = matchDefToParts(page[k]), b = matchDefToParts(basePage[k]); if (a.source !== b.source || a.flags !== b.flags) fields[k] = page[k];
          } else {
            const norm = (v) => k === 'title' || k === 'snippet' ? simpleToCommand(v, 'text') : k === 'url' ? simpleToCommand(v, 'link') : v;
            if (jsonKey(norm(page[k])) !== jsonKey(norm(basePage[k]))) fields[k] = page[k];
          }
        }
        if (Object.keys(fields).length) pd[name] = fields;
      }
      if (Object.keys(pd).length) diff.pages = pd;
    }
    return diff;
  }

  function diffUserSelectors(config, baseDefs = null) {
    const out = {}; if (!config || typeof config !== 'object' || Array.isArray(config)) return out; const base = baseDefs || getBaseSelectors();
    for (const key of Object.keys(config)) {
      if (key === 'other') continue; const def = config[key]; if (!def || typeof def !== 'object' || Array.isArray(def)) continue; const builtin = base[key]; const rest = { ...def };
      if (!builtin) { out[key] = rest; continue; }
      const diff = diffSelectorDefFields(rest, builtin); const hasContent = Object.keys(rest).some(k => k !== 'disabled');
      if (rest.disabled === true) { if (builtin.disabled !== true || Object.keys(diff).length) diff.disabled = true; }
      else if (builtin.disabled === true && (rest.disabled === false || hasContent)) diff.disabled = false;
      if (Object.keys(diff).length > 0) out[key] = diff;
    }
    return out;
  }

  function selectorStoreValue(v) {
    if (v instanceof RegExp) return { source: v.source, flags: v.flags || '' };
    if (Array.isArray(v)) return v.map(selectorStoreValue);
    if (v && typeof v === 'object') { const o = {}; for (const k of Object.keys(v)) o[k] = selectorStoreValue(v[k]); return o; }
    return v;
  }

  function pruneUserSelectors() {
    const user = getUserSelectors(); const baseDefs = getBaseSelectors(); let changed = false; const next = {};
    for (const key of Object.keys(user)) {
      const def = user[key];
      if (key !== 'other' && baseDefs[key] && sameSelectorDef(def, baseDefs[key])) { changed = true; continue; }
      next[key] = def;
    }
    if (changed) {
      GM_setValue(SELECTORS_KEY, next); resetSelectorCache();
    }
  }

  function normalizeMatchLiteral(field, val) {
    if ((field !== 'includeRegex' && field !== 'match' && field !== 'excludeRegex') || typeof val !== 'string') return val;
    const m = parseRegexLiteral(val);
    if (!isRegexLiteralStr(val) || getInvalidRegexFlags(m.flags)) return val;
    return { source: m.source, flags: m.flags };
  }

    function parseSelectorText(text) {
    const fail = () => ({ config: null, errors: [t('selectorJsonError')] });
    let s = String(text == null ? '' : text).trim(); if (!s) return fail();
    const normalizeRedirects = (link) => {
      if (link && Array.isArray(link.redirects)) for (const spec of link.redirects) { if (spec) for (const f of ['path', 'pathValue', 'hrefSuffix', 'stripPrefix']) { const v = spec[f]; if (v && typeof v === 'object' && !(v instanceof RegExp) && typeof v.source === 'string') { try { spec[f] = new RegExp(v.source, v.flags || ''); } catch (_) {} } } }
    };
    const normalizeNode = (node) => {
      if (!node || typeof node !== 'object' || Array.isArray(node)) return;
      if (node.includeRegex !== undefined) { node.includeRegex = normalizeMatchLiteral('includeRegex', node.includeRegex); delete node.match; }
      else if (node.match !== undefined) { const inc = normalizeMatchLiteral('includeRegex', node.match); delete node.match; if (inc !== undefined) node.includeRegex = inc; }
      if (node.excludeRegex !== undefined) node.excludeRegex = normalizeMatchLiteral('excludeRegex', node.excludeRegex);
      normalizeRedirects(node.link);
      if (node.command && typeof node.command === 'object') normalizeRedirects(node.command.link);
      if (node.pages && typeof node.pages === 'object') { const ps = Array.isArray(node.pages) ? node.pages : Object.values(node.pages); for (const p of ps) normalizeNode(p); }
    };
    const normalizeAll = (obj) => {
      for (const key of Object.keys(obj)) normalizeNode(obj[key]);
      return obj;
    };
    if (s.charCodeAt(0) === 123) {
      try {
        const parsed = JSON.parse(s);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          const walk = (o) => { if (!o || typeof o !== 'object') return true; for (const k of Object.keys(o)) { if (k === '__proto__') return false; if (!walk(o[k])) return false; } return true; };
          if (!Object.keys(parsed).length || !walk(parsed)) return fail();
          for (const k of Object.keys(parsed)) if (k === 'other' || k === '__proto__') delete parsed[k];
          return { config: normalizeAll(parsed), errors: [] };
        }
      } catch (_) {}
    }
    s = s.replace(/^const\s+SELECTORS\s*=\s*/i, '').replace(/;\s*$/, '').trim();
    let i = 0, n = s.length;
    const skipWs = () => {
      while (i < n) {
        if (/\s/.test(s[i])) { i++; continue; }
        if (s[i] === '/' && s[i + 1] === '/') { const j = s.indexOf('\n', i + 2); i = j === -1 ? n : j + 1; continue; }
        if (s[i] === '/' && s[i + 1] === '*') { const j = s.indexOf('*/', i + 2); i = j === -1 ? n : j + 2; continue; }
        break;
      }
    };
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
          if (nx === 'u' && /^[0-9a-fA-F]{4}/.test(s.slice(j + 2, j + 6))) { val += String.fromCharCode(parseInt(s.slice(j + 2, j + 6), 16)); j += 6; continue; }
          if (nx === 'x' && /^[0-9a-fA-F]{2}/.test(s.slice(j + 2, j + 4))) { val += String.fromCharCode(parseInt(s.slice(j + 2, j + 4), 16)); j += 4; continue; }
          val += ch + (nx || ''); j += 2; continue;
        }
        if (ch === quote) { i = j + 1; return val; }
        val += ch; j++;
      }
      throw 0;
    };
    const readRegex = () => {
      let j = i + 1, src = '', inClass = false;
      while (j < n) {
        const ch = s[j];
        if (ch === '\\') { src += ch + (s[j + 1] || ''); j += 2; continue; }
        if (inClass) { if (ch === ']') inClass = false; src += ch; j++; continue; }
        if (ch === '[') { inClass = true; src += ch; j++; continue; }
        if (ch === '/') { j++; break; }
        src += ch; j++;
      }
      let k = j; while (k < n && /[a-z]/i.test(s[k])) k++; const flags = s.slice(j, k);
      if (flags && getInvalidRegexFlags(flags)) throw { flags };
      i = k; return { source: src, flags: flags.toLowerCase() };
    };
    const readKey = () => {
      skipWs();
      if (s[i] === "'" || s[i] === '"') return readString();
      const m = /^[A-Za-z0-9_$][\w$-]*/.exec(s.slice(i)); if (!m) throw 0; i += m[0].length; return m[0];
    };
    const readValue = () => {
      skipWs(); const ch = s[i];
      if (ch === "'" || ch === '"') return readString();
      if (ch === '/') return readRegex();
      if (ch === '[') {
        i++; const arr = [];
        while (true) { skipWs(); if (i >= n) throw 0; if (s[i] === ',') { i++; continue; } if (s[i] === ']') { i++; return arr; } arr.push(readValue()); }
      }
      if (ch === '{') {
        i++; const obj = {};
        while (true) {
          skipWs(); if (i >= n) throw 0; if (s[i] === ',') { i++; continue; } if (s[i] === '}') { i++; return obj; }
          const key = readKey(); if (key === '__proto__') throw 0; skipWs(); if (s[i] !== ':') throw 0; i++; obj[key] = readValue();
        }
      }
      if (s.startsWith('true', i) && !/[\w$]/.test(s[i + 4] || '')) { i += 4; return true; }
      if (s.startsWith('false', i) && !/[\w$]/.test(s[i + 5] || '')) { i += 5; return false; }
      if (s.startsWith('null', i) && !/[\w$]/.test(s[i + 4] || '')) { i += 4; return null; }
      const m = /^-?\d+(?:\.\d+)?/.exec(s.slice(i)); if (m) { i += m[0].length; return Number(m[0]); }
      throw 0;
    };
    if (s[0] !== String.fromCharCode(123)) s = String.fromCharCode(123) + '\n' + s + '\n' + String.fromCharCode(125);
    i = 0; n = s.length;
    try {
      const root = readValue(); skipWs(); if (i < n) return fail();
      if (!root || typeof root !== 'object' || Array.isArray(root)) return fail();
      for (const k of Object.keys(root)) if (k === 'other') delete root[k];
      if (!Object.keys(root).length) return fail();
      return { config: normalizeAll(root), errors: [] };
    } catch (e) {
      if (e && e.flags) return { config: null, errors: [t('invalidRegexFlags', { flags: e.flags })] };
      return fail();
    }
  }

  function pickTextFile(accept, onLoaded) {
    const decodeText = (buffer) => {
      const bytes = new Uint8Array(buffer);
      if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) return new TextDecoder('utf-8').decode(bytes.subarray(3));
      if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xFE) return new TextDecoder('utf-16le').decode(bytes.subarray(2));
      if (bytes.length >= 2 && bytes[0] === 0xFE && bytes[1] === 0xFF) return new TextDecoder('utf-16be').decode(bytes.subarray(2));
      try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
      catch (e) {
        try { return new TextDecoder('gb18030').decode(bytes); }
        catch (e2) { return new TextDecoder('utf-8').decode(bytes); }
      }
    };
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
        const raw = ev.target.result; let text = '';
        if (typeof raw === 'string') text = raw;
        else if (raw) { try { text = decodeText(raw); } catch (_) { text = ''; } }
        onLoaded(String(text || '')); cleanup();
      };
      reader.onerror = () => {
        showToast(t('fileImportFailed'), 'error'); cleanup();
      };
      if (typeof TextDecoder !== 'undefined' && typeof reader.readAsArrayBuffer === 'function') reader.readAsArrayBuffer(file);
      else reader.readAsText(file, 'UTF-8');
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
    let baseAtOpen = getBaseSelectors();
    panel.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                <h3 style="margin:0;font-size:14px;line-height:1.2;">${t('selectorPanelTitle')}</h3>
                <div style="display:flex;align-items:center;gap:6px;">
                    <button id="serh-selector-subscribe" class="serh-button serh-button-secondary" style="padding: 3px 8px; border: 1px solid transparent;">${t('subscribe')}</button>
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
      GM_setValue(SELECTORS_KEY, selectorStoreValue(diffUserSelectors(config, baseAtOpen))); _selectorStoreSignature = getSelectorStoreSignature(); resetSelectorCache(); refreshEngineSite(); markLocalModifiedTime(SELECTORS_LAST_MODIFIED_KEY);
      triggerWebDAVSyncDelayed(5000);
    };

    const showError = (messages) => {
      if (!messages || !messages.length) return; showToast(messages.join('\n'), 'error', 5000);
    };

    document.getElementById('serh-selector-subscribe').onclick = (e) => {
      e.stopPropagation(); showEngineSubscriptionPanel();
    };

    document.getElementById('serh-selector-import').onclick = () => {
      importSelectorsFromFile(textarea, () => {
        const parsed = parseSelectorText(textarea.value); const errors = parsed.errors && parsed.errors.length ? parsed.errors : (parsed.config ? validateUserSelectors(parsed.config) : [t('selectorJsonError')]);
        showError(errors); updateLineNumbers('selectors');
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
      baseAtOpen = getBaseSelectors();
      textarea.value = serializeSelectors(baseAtOpen); showError([]); updateLineNumbers('selectors'); showToast(t('resetPending'), 'success');
    };

    bindCancelButton('serh-selector-cancel', closePanel);
  }

  function migrateSubscriptions() {
    if (GM_getValue(SUBSCRIPTIONS_KEY) !== undefined) return; const oldUrl = GM_getValue(SUBSCRIPTION_URL_KEY); const oldRules = GM_getValue(SUBSCRIPTION_RULES_KEY, []);
    const oldLastUpdate = GM_getValue(SUBSCRIPTION_LAST_UPDATE_KEY, 0); const subscriptions = [];
    if (oldUrl) subscriptions.push({ url: oldUrl, enabled: true, lastUpdate: oldLastUpdate, rules: oldRules });
    GM_setValue(SUBSCRIPTIONS_KEY, subscriptions);
    if (typeof GM_deleteValue === 'function') { GM_deleteValue(SUBSCRIPTION_URL_KEY); GM_deleteValue(SUBSCRIPTION_RULES_KEY); GM_deleteValue(SUBSCRIPTION_LAST_UPDATE_KEY); }
  }

  function refreshSubscriptionsOnVersionChange() {
    if (GM_getValue(SUB_VERSION_KEY) === GM_info.script.version) return;
    GM_setValue(SUB_VERSION_KEY, GM_info.script.version);
    saveSubscriptions(getSubscriptions().map(s => ({ ...s, lastUpdate: 0, lastAttempt: 0 })));
    saveEngineSubscriptions(getEngineSubscriptions().map(s => ({ ...s, lastUpdate: 0, lastAttempt: 0 })));
  }

  function getSubscriptions() {
    const value = GM_getValue(SUBSCRIPTIONS_KEY, []); if (!Array.isArray(value)) return []; return value.filter(s => s && typeof s === 'object' && !Array.isArray(s) && typeof s.url === 'string');
  }

  function getSubscriptionStoreSignature() {
    try { return JSON.stringify(GM_getValue(SUBSCRIPTIONS_KEY) ?? null); } catch (e) { return null; }
  }

  function saveSubscriptions(subscriptions) {
    cachedSubscriptionRules = null; _subscriptionStoreSignature = null; GM_setValue(SUBSCRIPTIONS_KEY, subscriptions); _subscriptionStoreSignature = getSubscriptionStoreSignature();
  }

  function bindCancelButton(id, onClose) {
    const btn = document.getElementById(id); if (!btn) return;
    btn.onclick = (e) => { e.stopPropagation(); onClose(); };
  }

  function getAllSubscriptionRules() {
    if (cachedSubscriptionRules) {
      const stored = _subscriptionStoreSignature; const fresh = getSubscriptionStoreSignature();
      if (fresh === stored) return cachedSubscriptionRules;
      _subscriptionStoreSignature = fresh;
    } else {
      _subscriptionStoreSignature = getSubscriptionStoreSignature();
    }
    const subs = getSubscriptions(); const rules = [];
    subs.filter(s => s.enabled).forEach(s => {
      if (s.rules && Array.isArray(s.rules)) rules.push(...s.rules);
    });
    cachedSubscriptionRules = rules; return rules;
  }

  function makeSyncSnapshot(key, payloadKey, validate) {
    return {
      get() {
        const raw = GM_getValue(key, null);
        if (!raw || Array.isArray(raw) || typeof raw !== 'object' || typeof raw.target !== 'string') return null;
        if (!validate(raw[payloadKey])) return null;
        return raw.target === webdavTargetId(loadWebDAVConfig()) ? raw[payloadKey] : null;
      },
      set(value, config = null) {
        if (!validate(value)) return;
        GM_setValue(key, { target: webdavTargetId(config || loadWebDAVConfig()), [payloadKey]: value });
      }
    };
  }
  function snapshotIsArray(v) { return Array.isArray(v); }
  function snapshotIsObject(v) { return v && typeof v === 'object' && !Array.isArray(v); }

  function getSubscriptionSyncSnapshot() { return makeSyncSnapshot(SUBSCRIPTION_SYNC_SNAPSHOT_KEY, 'subs', snapshotIsArray).get(); }
  function setSubscriptionSyncSnapshot(subs, config = null) {
    if (!Array.isArray(subs)) return;
    makeSyncSnapshot(SUBSCRIPTION_SYNC_SNAPSHOT_KEY, 'subs', snapshotIsArray).set(subs.map(s => ({ url: s.url, name: s.name, enabled: s.enabled !== false })), config);
  }

  function getEngineSubSyncSnapshot() { return makeSyncSnapshot(ENGINE_SUBS_SYNC_SNAPSHOT_KEY, 'subs', snapshotIsArray).get(); }
  function setEngineSubSyncSnapshot(subs, config = null) {
    if (!Array.isArray(subs)) return;
    makeSyncSnapshot(ENGINE_SUBS_SYNC_SNAPSHOT_KEY, 'subs', snapshotIsArray).set(subs.filter((s) => s && s.url && !isBuiltinEngineSub(s)).map(s => ({ url: s.url, name: s.name, enabled: s.enabled !== false })), config);
  }

  function applyCloudEngineSubscriptions(cloudSubs, preferLocal = false) {
    if (!Array.isArray(cloudSubs)) return null;
    const builtinSub = getEngineSubscriptions().find(isBuiltinEngineSub) || null; const existing = getEngineSubscriptions().filter((s) => !isBuiltinEngineSub(s)); let hasNewSub = false;
    const baseRaw = getEngineSubSyncSnapshot(); const baseSubs = baseRaw ? baseRaw.filter((s) => s && s.url && !isBuiltinEngineSub(s)) : null; cloudSubs = cloudSubs.filter((s) => !isBuiltinEngineSub(s)); let finalSubs = [];
    if (!baseSubs) {
      const seen = new Set(); const merged = [];
      cloudSubs.forEach(s => {
        if (!s || !s.url || seen.has(s.url)) return; seen.add(s.url); const local = existing.find(e => e && e.url === s.url);
        if (!local) hasNewSub = true;
        merged.push(local ? { ...local, name: (preferLocal && local.name) ? local.name : (s.name || local.name), enabled: preferLocal ? local.enabled !== false : s.enabled !== false } : { url: s.url, name: s.name || '', enabled: s.enabled !== false, lastUpdate: 0, lastAttempt: 0, selectors: null });
      });
      existing.forEach(localSub => {
        if (localSub && localSub.url && !seen.has(localSub.url)) { seen.add(localSub.url); merged.push(localSub); }
      });
      finalSubs = merged;
    } else {
      const baseMap = new Map(); baseSubs.forEach(s => { if (s && s.url) baseMap.set(s.url, s); }); const localMap = new Map(); existing.forEach(s => { if (s && s.url) localMap.set(s.url, s); });
      const cloudMap = new Map(); cloudSubs.forEach(s => { if (s && s.url) cloudMap.set(s.url, s); });
      const localDeleted = new Set([...baseMap.keys()].filter(u => !localMap.has(u))); const cloudDeleted = new Set([...baseMap.keys()].filter(u => !cloudMap.has(u)));
      const subChangedFrom = (sub, base) => {
        if (!sub || !base) return true;
        if ((sub.enabled !== false) !== (base.enabled !== false)) return true;
        return !!sub.name && (sub.name || '') !== (base.name || '');
      };
      const allUrls = new Set([...baseMap.keys(), ...localMap.keys(), ...cloudMap.keys()]); const merged = [];
      for (const url of allUrls) {
        if (!url) continue;
        if (localDeleted.has(url) || cloudDeleted.has(url)) {
          const survivor = localDeleted.has(url) ? cloudMap.get(url) : localMap.get(url);
          if (!survivor || !subChangedFrom(survivor, baseMap.get(url))) continue;
        }
        const local = localMap.get(url); const cloud = cloudMap.get(url); const item = cloud || local; if (!item) continue;
        const base = baseMap.get(url); const enabledOf = (sub) => sub ? sub.enabled !== false : true; const nameOf = (sub) => (sub && sub.name) || '';
        let enabled = enabledOf(item), name = cloud ? cloud.name : (local && local.name);
        if (base && local && cloud) {
          const localChanged = enabledOf(local) !== enabledOf(base); const cloudChanged = enabledOf(cloud) !== enabledOf(base);
          if (localChanged !== cloudChanged) enabled = localChanged ? enabledOf(local) : enabledOf(cloud);
          else if (localChanged && cloudChanged && enabledOf(local) !== enabledOf(cloud)) enabled = preferLocal ? enabledOf(local) : enabledOf(cloud);
          else enabled = enabledOf(cloud);
          const baseName = nameOf(base); const localNameChanged = nameOf(local) !== baseName; const cloudNameChanged = nameOf(cloud) !== baseName;
          if (localNameChanged !== cloudNameChanged) name = localNameChanged ? local.name : cloud.name;
          else if (localNameChanged && cloudNameChanged && nameOf(local) !== nameOf(cloud)) name = preferLocal ? local.name : cloud.name; else name = cloud.name;
        } else if (preferLocal && local) {
          enabled = enabledOf(local); if (local.name) name = local.name;
        }
        if (!local) hasNewSub = true;
        merged.push(local ? { ...local, name, enabled } : { url, name, enabled, lastUpdate: 0, lastAttempt: 0, selectors: null });
      }
      finalSubs = merged;
    }
    saveEngineSubscriptions(builtinSub ? [builtinSub, ...finalSubs] : finalSubs);
    if (hasNewSub) setTimeout(() => { checkAutoEngineSubscription(true); }, 1000);
    return finalSubs;
  }

  function applyCloudSubscriptions(cloudSubs, preferLocal = false) {
    if (!Array.isArray(cloudSubs)) return; const existing = getSubscriptions(); let hasNewSub = false;

    const baseSubs = getSubscriptionSyncSnapshot(); let finalSubs = [];
    if (!baseSubs) {
      const cloudMap = new Map(); cloudSubs.forEach(s => { if (s && s.url) cloudMap.set(s.url, s); }); const seen = new Set(); const merged = [];

      cloudSubs.forEach(s => {
        if (!s || !s.url || seen.has(s.url)) return; seen.add(s.url); const local = existing.find(e => e && e.url === s.url);
        const isNew = !local || !Array.isArray(local.rules) || local.rules.length === 0; if (isNew && s.enabled !== false) hasNewSub = true;
        merged.push({
          ...s,
          enabled: preferLocal && local ? local.enabled !== false : (s.enabled !== false),
          rules: (local && Array.isArray(local.rules) && local.rules.length > 0) ? local.rules : (Array.isArray(s.rules) ? s.rules : []),
          lastUpdate: (local && local.rules && local.rules.length > 0) ? (local.lastUpdate || 0) : 0,
          lastAttempt: (local && local.lastAttempt) || 0,
          addedAt: (local && local.addedAt) || s.addedAt || 0,
          name: (preferLocal && local && local.name) ? local.name : s.name
        });
      });

      existing.forEach(localSub => {
        if (localSub && localSub.url && !seen.has(localSub.url)) {
          seen.add(localSub.url); merged.push(localSub);
        }
      });
      finalSubs = merged;
    } else {
      const baseMap = new Map(); baseSubs.forEach(s => { if (s && s.url) baseMap.set(s.url, s); }); const localMap = new Map(); existing.forEach(s => { if (s && s.url) localMap.set(s.url, s); });
      const cloudMap = new Map(); cloudSubs.forEach(s => { if (s && s.url) cloudMap.set(s.url, s); });

      const localDeleted = new Set([...baseMap.keys()].filter(u => !localMap.has(u))); const cloudDeleted = new Set([...baseMap.keys()].filter(u => !cloudMap.has(u)));
      const subChangedFrom = (sub, base) => {
        if (!sub || !base) return true;
        if ((sub.enabled !== false) !== (base.enabled !== false)) return true;
        return !!sub.name && (sub.name || '') !== (base.name || '');
      };
      const allUrls = new Set([...baseMap.keys(), ...localMap.keys(), ...cloudMap.keys()]); const merged = [];
      for (const url of allUrls) {
        if (!url) continue;
        if (localDeleted.has(url) || cloudDeleted.has(url)) {
          const survivor = localDeleted.has(url) ? cloudMap.get(url) : localMap.get(url);
          if (!survivor || !subChangedFrom(survivor, baseMap.get(url))) continue;
        }
        const local = localMap.get(url); const cloud = cloudMap.get(url); const item = cloud || local; if (!item) continue;

        const isNew = !local || !Array.isArray(local.rules) || local.rules.length === 0; const base = baseMap.get(url); const enabledOf = (sub, fallback) => sub ? sub.enabled !== false : fallback;
        const nameOf = (sub) => (sub && sub.name) || ''; let enabled = enabledOf(item, true); let name = cloud ? cloud.name : (local && local.name);
        if (base && local && cloud) {
          const baseEnabled = enabledOf(base, true); const localChanged = enabledOf(local, true) !== baseEnabled; const cloudChanged = enabledOf(cloud, true) !== baseEnabled;
          if (localChanged !== cloudChanged) enabled = localChanged ? enabledOf(local, true) : enabledOf(cloud, true);
          else if (localChanged && cloudChanged && enabledOf(local, true) !== enabledOf(cloud, true)) enabled = preferLocal ? enabledOf(local, true) : enabledOf(cloud, true);
          else enabled = enabledOf(cloud, true); const baseName = nameOf(base); const localNameChanged = nameOf(local) !== baseName; const cloudNameChanged = nameOf(cloud) !== baseName;
          if (localNameChanged !== cloudNameChanged) name = localNameChanged ? local.name : cloud.name;
          else if (localNameChanged && cloudNameChanged && nameOf(local) !== nameOf(cloud)) name = preferLocal ? local.name : cloud.name; else name = cloud.name;
        } else if (preferLocal && local) {
          enabled = enabledOf(local, true); if (local.name) name = local.name;
        }
        if (isNew && enabled) hasNewSub = true;

        merged.push({
          url,
          name,
          enabled,
          rules: (local && Array.isArray(local.rules) && local.rules.length > 0) ? local.rules : (Array.isArray(item.rules) ? item.rules : []),
          lastUpdate: (local && local.rules && local.rules.length > 0) ? (local.lastUpdate || 0) : (item.lastUpdate || 0),
          lastAttempt: (local && local.lastAttempt) || 0,
          addedAt: (local && local.addedAt) || (item && item.addedAt) || 0
        });
      }
      finalSubs = merged;
    }

    saveSubscriptions(finalSubs);
    if (hasNewSub) {
      setTimeout(() => {
        checkAutoSubscription(true);
      }, 1000);
    }

    return finalSubs;
  }

  function gmRequest(method, url, { headers, data, allow404 = false, timeout = 30000, anonymous = true } = {}) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method,
        url,
        headers,
        data,
        timeout,
        anonymous,
        nocache: true,
        onload: (resp) => {
          if (resp.status >= 200 && resp.status < 300) resolve(resp); else if (allow404 && resp.status === 404) resolve(resp);
          else reject(new Error(`HTTP ${resp.status}`));
        },
        onerror: () => reject(new Error(t('networkError'))),
        ontimeout: () => reject(new Error(t('requestTimeout')))
      });
    });
  }

  let _netTimeOffset = null, _netTimeCheckedAt = 0; let _netTimeQuerying = null; let _davClockOffset = null; let _davClockCheckedAt = 0;
  function firstSuccess(promises) {
    return new Promise((resolve, reject) => {
      let pending = promises.length, settled = false;
      if (!pending) {
        reject(new Error('net time unavailable')); return;
      }
      promises.forEach(p => p.then(
        value => {
          if (!settled) {
            settled = true; resolve(value);
          }
        },
        () => {
          if (--pending === 0 && !settled) reject(new Error('net time unavailable'));
        }
      ));
    });
  }

  function parseHttpDateHeader(responseHeaders) {
    const m = responseHeaders && String(responseHeaders).match(/^date:\s*(.+)$/im); if (!m) return 0; const parsed = Date.parse(m[1].trim()); return isNaN(parsed) ? 0 : parsed;
  }

  function getCloudModifiedTime(config, key, trustedNow) {
    if (!config || typeof config !== 'object' || Array.isArray(config)) return 0;
    const value = Object.prototype.hasOwnProperty.call(config, key) ? config[key] : config.syncedAt;
    return typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= trustedNow + WEBDAV_TIME_TOLERANCE ? value : 0;
  }

  function extractValidCloudTimes(cloudConfig, trustedNow) {
    const times = []; const limit = trustedNow + WEBDAV_TIME_TOLERANCE;
    if (cloudConfig && typeof cloudConfig === 'object' && !Array.isArray(cloudConfig)) {
      [cloudConfig.syncedAt, cloudConfig.rulesSyncedAt, cloudConfig.settingsModifiedAt, cloudConfig.selectorsSyncedAt].forEach(v => {
        if (typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= limit) times.push(v);
      });
    }
    return times;
  }

  async function queryNetworkTimeEndpoint(url, parseResp) {
    const t0 = Date.now(); const resp = await gmRequest('GET', url, { timeout: 5000 }); const t1 = Date.now(); const serverTime = parseResp(resp);
    if (!(serverTime > 0)) throw new Error('invalid time'); return serverTime - Math.round((t0 + t1) / 2);
  }

  // 授时校准
  async function getNetworkTimeOffset() {
    if (typeof currentConfig !== 'undefined' && currentConfig && currentConfig.timeCalibration === false) return null;
    if (!_netTimeCheckedAt && typeof GM_getValue === 'function') { try { const c = GM_getValue('searchfilter_net_time_cache', null); if (c && typeof c === 'object' && typeof c.checkedAt === 'number' && Number.isFinite(c.checkedAt)) { _netTimeCheckedAt = c.checkedAt; _netTimeOffset = typeof c.offset === 'number' && Number.isFinite(c.offset) ? c.offset : null; } } catch (e) {} }
    const now = Date.now(); const ttl = _netTimeOffset === null ? NET_TIME_FAIL_TTL : NET_TIME_CACHE_TTL; if (_netTimeCheckedAt > 0 && now - _netTimeCheckedAt < ttl) return _netTimeOffset;
    if (_netTimeQuerying) return _netTimeQuerying;
    _netTimeQuerying = firstSuccess([
      queryNetworkTimeEndpoint('https://timeapi.io/api/Time/current/zone?timeZone=UTC', (resp) => {
        try {
          const data = JSON.parse(String(resp.responseText || '')); const s = typeof data.dateTime === 'string' ? data.dateTime : ''; if (!s) return 0;
          const ms = Date.parse(/[zZ]$|[+-]\d{2}:?\d{2}$/.test(s) ? s : s + 'Z'); return ms > 0 ? ms : 0;
        } catch (_) {
          return 0;
        }
      }),
      queryNetworkTimeEndpoint('https://cloudflare.com/cdn-cgi/trace', (resp) => {
        const m = /(?:^|\n)ts=([0-9.]+)(?:\n|$)/.exec(String(resp.responseText || '')); const sec = m ? parseFloat(m[1]) : 0; return sec > 0 ? Math.round(sec * 1000) : 0;
      })
    ]).then(offset => {
      _netTimeOffset = offset; _netTimeCheckedAt = Date.now(); if (typeof GM_setValue === 'function') { try { GM_setValue('searchfilter_net_time_cache', { offset, checkedAt: _netTimeCheckedAt }); } catch (e) {} } return offset;
    }).catch(() => {
      _netTimeOffset = null; _netTimeCheckedAt = Date.now(); if (typeof GM_setValue === 'function') { try { GM_setValue('searchfilter_net_time_cache', { offset: null, checkedAt: _netTimeCheckedAt }); } catch (e) {} } return null;
    }).finally(() => {
      _netTimeQuerying = null;
    });
    return _netTimeQuerying;
  }

  function loadDavClockCache() {
    if (_davClockOffset !== null && Date.now() - _davClockCheckedAt < WEBDAV_CLOCK_CACHE_TTL) return _davClockOffset;
    if (typeof GM_getValue === 'function') { try { const c = GM_getValue('searchfilter_dav_time_cache', null); if (c && typeof c === 'object' && Number.isFinite(c.offset) && Number.isFinite(c.checkedAt) && Date.now() - c.checkedAt < WEBDAV_CLOCK_CACHE_TTL) { _davClockOffset = c.offset; _davClockCheckedAt = c.checkedAt; } } catch (e) {} }
    return _davClockOffset;
  }
  function noteDavClock(serverTime) {
    if (!(serverTime > 0)) return;
    _davClockOffset = serverTime - Date.now(); _davClockCheckedAt = Date.now();
    if (typeof GM_setValue === 'function') { try { GM_setValue('searchfilter_dav_time_cache', { offset: _davClockOffset, checkedAt: _davClockCheckedAt }); } catch (e) {} }
  }
  async function getTrustedNow(serverTime = 0) {
    const offset = await getNetworkTimeOffset(); if (offset !== null) return Date.now() + offset;
    if (serverTime > 0) { noteDavClock(serverTime); return serverTime; }
    const davOffset = loadDavClockCache(); return davOffset !== null ? Date.now() + davOffset : Date.now();
  }

  function webdavTargetId(config) { try { return getWebDAVRequest(config).fullUrl; } catch (e) { return ''; } }

  function getRuleSyncSnapshot() { return makeSyncSnapshot(WEBDAV_SYNC_SNAPSHOT_KEY, 'rules', snapshotIsArray).get(); }
  function setRuleSyncSnapshot(rules, config = null) { makeSyncSnapshot(WEBDAV_SYNC_SNAPSHOT_KEY, 'rules', snapshotIsArray).set(rules, config); }

  function getSelectorSyncSnapshot() { return makeSyncSnapshot(WEBDAV_LAST_SYNC_SELECTORS_KEY, 'selectors', snapshotIsObject).get(); }
  function setSelectorSyncSnapshot(selectors, config = null) { makeSyncSnapshot(WEBDAV_LAST_SYNC_SELECTORS_KEY, 'selectors', snapshotIsObject).set(selectors, config); }

  function selectorsEqual(a, b) {
    const canon = (v) => {
      if (Array.isArray(v)) return v.map(canon);
      if (v && typeof v === 'object') {
        const out = {}; for (const k of Object.keys(v).sort()) out[k] = canon(v[k]); return out;
      }
      return v;
    };
    return JSON.stringify(canon(a)) === JSON.stringify(canon(b));
  }

  function mergeSelectors3Way(baseSelectors, localSelectors, cloudSelectors, preferLocal = true) {
    const asObject = (v) => (v && typeof v === 'object' && !Array.isArray(v)) ? v : {}; const base = asObject(baseSelectors); const local = asObject(localSelectors);
    const cloud = asObject(cloudSelectors); const keys = new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(cloud)]); const result = {};
    keys.forEach(key => {
      const inBase = Object.prototype.hasOwnProperty.call(base, key); const inLocal = Object.prototype.hasOwnProperty.call(local, key);
      const inCloud = Object.prototype.hasOwnProperty.call(cloud, key);
      if (inBase) {
        const bStr = JSON.stringify(base[key]); const localChanged = inLocal && JSON.stringify(local[key]) !== bStr; const cloudChanged = inCloud && JSON.stringify(cloud[key]) !== bStr;
        if (!inLocal || !inCloud) {
          if (!(inLocal ? localChanged : cloudChanged)) return;
          if (inLocal ? !preferLocal : preferLocal) return;
          result[key] = inLocal ? local[key] : cloud[key]; return;
        }
        if (localChanged && cloudChanged) { result[key] = preferLocal ? local[key] : cloud[key]; return; }
        if (localChanged) {
          result[key] = local[key]; return;
        }
        if (cloudChanged) {
          result[key] = cloud[key]; return;
        }
        result[key] = local[key]; return;
      }
      if (inLocal && inCloud) {
        result[key] = preferLocal ? local[key] : cloud[key]; return;
      }
      if (inLocal) {
        result[key] = local[key]; return;
      }
      if (inCloud) {
        result[key] = cloud[key];
      }
    });
    return result;
  }

  function mergeRules3Way(baseRules, localRules, cloudRules, preferLocal = true) {
    baseRules = Array.isArray(baseRules) ? baseRules : []; localRules = Array.isArray(localRules) ? localRules : []; cloudRules = Array.isArray(cloudRules) ? cloudRules : [];

    const splitFm = (list) => {
      let first = -1;
      for (let i = 0; i < list.length; i++) { if (String(list[i] ?? '').trim() !== '') { first = i; break; } }
      if (first === -1 || String(list[first] ?? '').trim() !== '---') return { head: [], body: list };
      for (let i = first + 1; i < list.length; i++) { const s = String(list[i] ?? '').trim(); if (s === '---' || s === '...') return { head: list.slice(0, i + 1), body: list.slice(i + 1) }; }
      return { head: [], body: list };
    };
    const baseParts = splitFm(baseRules); const localParts = splitFm(localRules); const cloudParts = splitFm(cloudRules);
    baseRules = baseParts.body; localRules = localParts.body; cloudRules = cloudParts.body;

    const baseKeys = new Set(baseRules.map(getRuleKey).filter(Boolean)); const localKeys = new Set(localRules.map(getRuleKey).filter(Boolean));
    const cloudKeys = new Set(cloudRules.map(getRuleKey).filter(Boolean));
    const localDeleted = new Set([...baseKeys].filter(k => !localKeys.has(k))); const cloudDeleted = new Set([...baseKeys].filter(k => !cloudKeys.has(k)));
    const lineKey = (r) => getRuleKey((r || '').trim());
    const rowsOf = (rules) => {
      const rows = [];
      for (const raw of rules) {
        const trimmed = (raw || '').trim(); const key = lineKey(trimmed); if (key) rows.push({ key, line: trimmed });
      }
      return rows;
    };
    const baseRows = rowsOf(baseRules); const localRows = rowsOf(localRules); const cloudRows = rowsOf(cloudRules); const baseIndex = new Map();
    baseRows.forEach((row, i) => { if (!baseIndex.has(row.key)) baseIndex.set(row.key, i); });

    const sideMeta = (rows) => {
      const index = new Map(); const line = new Map();
      rows.forEach((row, i) => {
        if (!index.has(row.key)) index.set(row.key, i); if (!line.has(row.key)) line.set(row.key, row.line);
      });
      return { index, line };
    };
    const localMeta = sideMeta(localRows); const cloudMeta = sideMeta(cloudRows); const lineOf = (meta, key) => (meta.line.has(key) ? meta.line.get(key) : null);
    const lineSim = (a, b) => {
      a = String(a || '').toLowerCase(); b = String(b || '').toLowerCase(); if (!a || !b) return 0;
      let p = 0; while (p < a.length && p < b.length && a[p] === b[p]) p++;
      let s = 0; while (s < a.length - p && s < b.length - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s++;
      return (p * 2 + s) / (a.length + b.length);
    };
    const bestRow = (rows, slotKey) => {
      const baseLine = baseIndex.has(slotKey) ? baseRows[baseIndex.get(slotKey)].line : '';
      let best = rows[0], score = -1;
      for (const row of rows) { const v = lineSim(row.line, baseLine); if (v > score) { score = v; best = row; } }
      return best;
    };
    const deleted = (key) => {
      if (!localDeleted.has(key) && !cloudDeleted.has(key)) return false;
      const baseLine = baseIndex.has(key) ? baseRows[baseIndex.get(key)].line : ''; const localLine = lineOf(localMeta, key); const cloudLine = lineOf(cloudMeta, key);
      return (localLine === null || localLine === baseLine) && (cloudLine === null || cloudLine === baseLine);
    };

    const moved = (rows) => {
      let prev = -1;
      for (const row of rows) {
        if (!baseIndex.has(row.key) || deleted(row.key)) continue; const at = baseIndex.get(row.key); if (at < prev) return true; prev = at;
      }
      return false;
    };
    const localMoved = moved(localRows); const cloudMoved = moved(cloudRows);
    const orderSide = localMoved !== cloudMoved
      ? (localMoved ? localMeta : cloudMeta)
      : (localMoved ? localMeta : null);

    const pickLine = (key) => {
      const inBase = baseIndex.has(key); const inLocal = localMeta.line.has(key); const inCloud = cloudMeta.line.has(key); if (!inLocal && !inCloud) return '';
      if (deleted(key) && !inBase) return '';
      if (inLocal && !inCloud) return localMeta.line.get(key); if (inCloud && !inLocal) return cloudMeta.line.get(key);
      if (!inBase) return localMeta.line.get(key); const baseLine = baseRows[baseIndex.get(key)].line; const localLine = localMeta.line.get(key); const cloudLine = cloudMeta.line.get(key);
      if (localLine !== baseLine && cloudLine === baseLine) return localLine; if (cloudLine !== baseLine && localLine === baseLine) return cloudLine; if (localLine === baseLine && cloudLine === baseLine) return deleted(key) ? '' : localLine; return localLine;
    };

    const anchorBefore = (rows, at) => {
      for (let i = at - 1; i >= 0; i--) {
        if (baseIndex.has(rows[i].key) && !deleted(rows[i].key)) return rows[i].key;
      }
      return null;
    };
    const anchorAfter = (rows, at) => {
      for (let i = at + 1; i < rows.length; i++) {
        if (baseIndex.has(rows[i].key) && !deleted(rows[i].key)) return rows[i].key;
      }
      return null;
    };
    const END = {}; const place = new Map(); const pendingByAnchor = new Map();
    const noteInsert = (key, anchor) => {
      if (place.has(key)) return; place.set(key, anchor); if (!pendingByAnchor.has(anchor)) pendingByAnchor.set(anchor, []); pendingByAnchor.get(anchor).push(key);
    };
    const srcOf = (rows, gone) => {
      const map = new Map(); let run = []; let lo = -1;
      const flush = (hi) => {
        if (!run.length) return;
        const cand = []; for (const [bk, bi] of baseIndex) if (bi > lo && bi < hi && gone.has(bk)) cand.push(bk);
        cand.sort((a, b) => baseIndex.get(a) - baseIndex.get(b));
        const both = cand.filter(bk => localDeleted.has(bk) && cloudDeleted.has(bk));
        if (cand.length === 1) {
          const best = bestRow(run, cand[0]); map.set(best.key, cand[0]);
          run.forEach(row => { if (row !== best) noteInsert(row.key, cand[0]); });
        } else if (cand.length !== run.length && both.length === 1) {
          const best = bestRow(run, both[0]); map.set(best.key, both[0]);
          run.forEach(row => { if (row !== best) noteInsert(row.key, both[0]); });
        } else for (let i = 0; i < run.length && i < cand.length; i++) map.set(run[i].key, cand[i]);
        run = [];
      };
      rows.forEach(row => {
        if (!baseIndex.has(row.key)) { run.push(row); return; }
        const at = baseIndex.get(row.key); flush(at); lo = at;
      });
      flush(baseRows.length); return map;
    };
    const localSrc = srcOf(localRows, localDeleted); const cloudSrc = srcOf(cloudRows, cloudDeleted);
    const sharedKeys = [...localKeys].filter(k => cloudKeys.has(k));
    for (const k of sharedKeys) { const lb = localSrc.get(k); const cb = cloudSrc.get(k); if (lb !== undefined && cb === undefined) cloudSrc.set(k, lb); else if (cb !== undefined && lb === undefined) localSrc.set(k, cb); }
    const groupBySrc = (srcMap, rows) => {
      const groups = new Map(); rows.forEach(row => { const bk = srcMap.get(row.key); if (bk === undefined) return; if (!groups.has(bk)) groups.set(bk, []); const arr = groups.get(bk); if (arr.indexOf(row.key) === -1) arr.push(row.key); }); return groups;
    };
    const localGroups = groupBySrc(localSrc, localRows); const cloudGroups = groupBySrc(cloudSrc, cloudRows); const mappedKeys = new Set([...localSrc.keys(), ...cloudSrc.keys()]);
    const pickedByBase = new Map();
    const pickGroup = (bk) => {
      const localKeys = localGroups.get(bk) || []; const cloudKeys = cloudGroups.get(bk) || [];
      if (!cloudKeys.length) return localKeys; if (!localKeys.length) return cloudKeys;
      const first = preferLocal ? localKeys : cloudKeys; const second = preferLocal ? cloudKeys : localKeys;
      if (!first.some(k => second.indexOf(k) !== -1)) return first;
      return first.concat(second.filter(k => first.indexOf(k) === -1));
    };
    new Set([...localGroups.keys(), ...cloudGroups.keys()]).forEach(bk => pickedByBase.set(bk, pickGroup(bk)));
    const orderedRows = orderSide === cloudMeta ? cloudRows : localRows; const otherRows = orderSide === cloudMeta ? localRows : cloudRows;
    orderedRows.forEach((row, i) => {
      if (baseIndex.has(row.key) || deleted(row.key) || mappedKeys.has(row.key)) return; noteInsert(row.key, anchorBefore(orderedRows, i));
    });
    otherRows.forEach((row, i) => {
      if (baseIndex.has(row.key) || deleted(row.key) || place.has(row.key) || mappedKeys.has(row.key)) return; const before = anchorBefore(otherRows, i); const after = anchorAfter(otherRows, i);
      if (before !== null && after === null) noteInsert(row.key, END); else noteInsert(row.key, before);
    });

    const result = []; const seen = new Set();
    const emit = (key) => {
      if (!key || seen.has(key) || deleted(key)) return; const line = pickLine(key); if (!line) return; seen.add(key); result.push(line);
    };
    const emitPending = (anchor) => {
      const keys = pendingByAnchor.get(anchor); if (keys) for (const key of keys) emit(key);
    };

    emitPending(null);
    const slots = []; const slotSeen = new Set();
    const addSlot = (key) => { if (!slotSeen.has(key)) { slotSeen.add(key); slots.push(key); } };
    (orderSide ? (orderSide === localMeta ? localRows : cloudRows) : baseRows).forEach(row => {
      if (baseIndex.has(row.key) && (!deleted(row.key) || pickedByBase.has(row.key))) addSlot(row.key);
    });
    baseRows.forEach(row => { if (pickedByBase.has(row.key)) addSlot(row.key); });
    slots.forEach(key => {
      const picked = pickedByBase.get(key);
      if (picked) { picked.forEach(emit); seen.add(key); } else emit(key);
      emitPending(key);
    });
    emitPending(END); for (const key of place.keys()) emit(key); baseRows.forEach((row) => emit(row.key)); for (const key of sharedKeys) emit(key);
    for (const row of [...localRows, ...cloudRows]) if (!baseIndex.has(row.key) && !deleted(row.key) && !mappedKeys.has(row.key) && !seen.has(row.key)) emit(row.key);
    const fmHead = localParts.head.length ? localParts.head : cloudParts.head;
    return fmHead.concat(result);
  }

  function buildSyncPayload(settingsModifiedAt = getSettingsModifiedTime()) {
    const stored = GM_getValue(CONFIG_KEY); const base = (stored && typeof stored === 'object' && !Array.isArray(stored)) ? stored : currentConfig;
    const engineSubs = getEngineSubscriptions();
    const payload = {
      ...getSyncSettings(base),
      subscriptions: getSubscriptions().map(s => ({
        url: s.url,
        name: s.name,
        enabled: s.enabled
      })),
      engineSubscriptions: engineSubs.filter((s) => !isBuiltinEngineSub(s)).map(s => ({
        url: s.url,
        name: s.name,
        enabled: s.enabled !== false
      })),
      builtinEngineSubEnabled: (engineSubs.find(isBuiltinEngineSub) || { enabled: true }).enabled !== false,
      syncedAt: settingsModifiedAt, settingsModifiedAt
    };
    return payload;
  }

  function isHtmlResponse(content) {
    return /^\s*<!DOCTYPE\s+html|^\s*<html[\s>]/i.test(String(content || ''));
  }

  function isInvalidSyncResponse(content, responseHeaders) {
    const text = String(content || ''); if (isHtmlResponse(text)) return true; const trimmed = text.replace(/^\uFEFF/, '').trim(); if (/^<\?xml/i.test(trimmed)) return true;
    const c0 = trimmed.charAt(0); if (c0 === '<') return true; if (c0 === '\u007B') return true;
    if (c0 === '\u005B') {
      try {
        JSON.parse(trimmed); return true;
      } catch (_) {}
    }
    const ctMatch = responseHeaders && String(responseHeaders).match(/content-type:\s*([^\r\n;]+)/i); const ct = ctMatch ? ctMatch[1].trim().toLowerCase() : '';
    if (/\b(?:application\/(?:json|xml))\b/.test(ct)) return true; const firstLine = trimmed.split('\n')[0].trim(); if (/^(?:4\d\d|5\d\d)(?:\s|$)/.test(firstLine)) return true;
    return /^(?:not found|forbidden|unauthorized|unauthenticated|bad request|proxy authentication required|request timeout|internal server error|bad gateway|service unavailable|gateway time-?out|error\d*|exception)\s*$/i.test(firstLine);
  }

  function parseSyncHeader(content) {
    const lines = String(content || '').replace(/^\uFEFF/, '').split('\n'); let config = null; let selectors = null; let rawScriptConfig = null; let rawSelectors = null; let invalidSelectors = false;
    const selectorPatchOk = (v) => {
      if (Array.isArray(v)) return true; if (!v || typeof v !== 'object') return false;
      const flagsOk = (f) => { f = String(f || '').toLowerCase(); return /^[imsu]*$/.test(f) && new Set(f).size === f.length; };
      const reOk = (val) => {
        if (typeof val === 'string') { const lit = parseRegexLiteral(val); if (lit.flags && !flagsOk(lit.flags)) return false; try { new RegExp(val); return true; } catch (e) { return false; } }
        if (val && typeof val === 'object' && typeof val.source === 'string' && flagsOk(val.flags)) { try { new RegExp(val.source, String(val.flags || '').toLowerCase()); return true; } catch (e) { return false; } }
        return false;
      };
      const probe = (s) => { if (typeof document === 'undefined' || typeof document.querySelector !== 'function') return true; try { document.querySelector(s); return true; } catch (_) { return false; } };
      const valueOk = (val, depth = 0) => {
        if (val == null || typeof val === 'string' || typeof val === 'boolean' || typeof val === 'number') return true;
        if (depth > 8) return false;
        if (Array.isArray(val)) return val.every((x) => valueOk(x, depth + 1));
        if (typeof val === 'object') return Object.keys(val).every((k) => k !== '__proto__' && valueOk(val[k], depth + 1));
        return false;
      };
      const rootOk = (r, depth = 0) => {
        if (depth > 8) return false;
        if (typeof r === 'string') return !!r.trim() && probe(r);
        if (!Array.isArray(r) || typeof r[0] !== 'string') return false;
        if (r[0] === 'selector') return typeof r[1] === 'string' && !!r[1].trim() && probe(r[1]);
        if (r[0] === 'upward') {
          const levelOk = typeof r[1] === 'number' ? Number.isInteger(r[1]) && r[1] >= 0 : (typeof r[1] === 'string' && !!r[1].trim() && probe(r[1]));
          return levelOk && r[2] !== undefined && rootOk(r[2], depth + 1);
        }
        return false;
      };
      for (const key of Object.keys(v)) {
        const def = v[key];
        if (key === 'other' || key === '__proto__' || !/^[A-Za-z0-9_-]+$/.test(key)) return false;
        if (!def || typeof def !== 'object' || Array.isArray(def)) return false;
        const inc = def.includeRegex !== undefined ? def.includeRegex : def.match;
        if (inc !== undefined && inc !== null && !reOk(inc)) return false;
        if (def.excludeRegex !== undefined && def.excludeRegex !== null && !reOk(def.excludeRegex)) return false;
        const root = def.root !== undefined ? def.root : def.containers;
        if (root !== undefined && !rootOk(root)) return false;
        for (const f of ['url', 'title', 'snippet', 'extraSelector', 'button', 'skip', 'group', 'grid', 'dedupeBy', 'link', 'blockedCss', 'site', 'matches', 'excludeMatches', 'priority', 'delay', 'pages', 'titles', 'links']) if (def[f] !== undefined && !valueOk(def[f])) return false;
        if (def.disabled !== undefined && def.disabled !== null && typeof def.disabled !== 'boolean') return false;
      }
      return true;
    };
    const headerLineIndexes = new Set();
    const fmRange = findYamlFrontmatterRange(lines);
    if (fmRange) for (let i = fmRange.start; i <= fmRange.end; i++) headerLineIndexes.add(i);
    const scanStart = fmRange ? fmRange.end + 1 : 0;

    for (let i = scanStart; i < Math.min(lines.length, scanStart + 10); i++) {
      const line = lines[i]; if (!line.trim()) continue;
      if (line.startsWith('# ScriptConfig:')) {
        const payload = line.substring('# ScriptConfig:'.length).trim(); let parsed = null;
        if (/^[\x7B\x5B]/.test(payload)) {
          try { parsed = JSON.parse(payload); } catch (e) { dbgWarn('[WebDAV] 配置头解析失败:', e); }
        }
        if (parsed && !Array.isArray(parsed) && !config) { config = parsed; rawScriptConfig = line; headerLineIndexes.add(i); } else if (payload.startsWith('\x7B') && !config) headerLineIndexes.add(i);
        else if (!parsed && !/^[\x7B\x5B]/.test(payload)) headerLineIndexes.add(i);
      } else if (line.startsWith('# Selectors:')) {
        if (!selectors) {
          const payload = line.substring('# Selectors:'.length).trim(); let parsed = null;
          if (/^[\x7B\x5B]/.test(payload)) {
            try { parsed = JSON.parse(payload); } catch (e) { dbgWarn('[WebDAV] 选择器头解析失败:', e); }
          }
          if (parsed && selectorPatchOk(parsed)) { selectors = parsed; rawSelectors = line; } else invalidSelectors = true;
          headerLineIndexes.add(i);
        }
      } else if (!line.startsWith('#')) {
        break;
      }
    }

    if (config && selectors && !config.selectors) {
      config.selectors = selectors;
    } else if (!config && selectors) {
      config = { selectors };
    }
    if (config && config.selectors !== undefined && !selectorPatchOk(config.selectors)) { delete config.selectors; invalidSelectors = true; }

    const restLines = lines.filter((_, idx) => !headerLineIndexes.has(idx)); return { config, rawScriptConfig, rawSelectors, restLines, invalidSelectors };
  }

  function isNonRuleTextResponse(restLines, hasHeader = false, allowCommentOnly = false) {
    const lines = (Array.isArray(restLines) ? restLines : [])
      .map((l) => String(l || '').trim())
      .filter((l) => l.length > 0); if (lines.length === 0) return false;
    const ruleLines = lines.filter((l) => !l.startsWith('#')); const htmlLike = (l, headOnly) => (headOnly ? /<\s*\/?\s*(?:!doctype|html|head|body)\b/i : /<\s*\/?\s*[a-z!?][^>\n]*>/i).test(l) && !validateRule(l);
    if (ruleLines.some((l) => htmlLike(l, true))) return true;
    const ruleLike = (l) => /^[\x21-\x7E]+$/.test(l) || /[:@|./]/.test(l) || looksLikeCondExpr(l);
    if (ruleLines.some((l) => ruleLike(l) && validateRule(l))) return false; if (ruleLines.some((l) => htmlLike(l, false))) return true;
    if (ruleLines.length === 0) return allowCommentOnly ? false : !hasHeader; return true;
  }

  function safeBase64Encode(str) {
    try {
      const bytes = new TextEncoder().encode(str); let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return btoa(binary);
    } catch (e) {
      return btoa(unescape(encodeURIComponent(str)));
    }
  }

  function isHttpsUrl(url) {
    return /^https:\/\//i.test(String(url || '').trim());
  }

  function getWebDAVRequest(config) {
    if (!isHttpsUrl(config.url)) throw new Error(t('webdavHttpsRequired'));
    const headers = {
      'Cache-Control': 'no-cache, no-store'
    };
    if (config.username) {
      const authStr = `${config.username}:${config.password || ''}`;
      headers['Authorization'] = 'Basic ' + safeBase64Encode(authStr);
    }
    const cleanFilename = String(config.filename || 'rules.txt').trim().replace(/^\/+/, '');
    const segments = cleanFilename.split('/').filter(seg => seg && seg !== '.' && seg !== '..');
    const fileBaseName = segments.pop() || 'rules.txt'; const subPath = segments.length > 0 ? segments.map(encodeURIComponent).join('/') + '/' : '';
    const cleanFolderUrl = String(config.url).trim().replace(/\/+$/, '') + '/' + subPath; const encodedFilename = encodeURIComponent(fileBaseName);
    return {
      folderUrl: cleanFolderUrl,
      fullUrl: cleanFolderUrl + encodedFilename,
      headers
    };
  }

  async function ensureWebDAVFolder(folderUrl, headers) {
    let url = String(folderUrl).trim().replace(/\/+$/, '') + '/'; const parsed = new URL(url); const rootPath = parsed.origin + '/'; if (url === rootPath || parsed.pathname === '/') return;

    let propfindResp;
    try {
      propfindResp = await gmRequest('PROPFIND', url, {
        headers: { ...headers, Depth: '0' },
        allow404: true
      });
    } catch (e) {
      dbgWarn('[WebDAV] PROPFIND 请求失败，跳过目录检查:', e && e.message); return;
    }

    if (propfindResp.status === 207 || propfindResp.status === 200) return;
    if (propfindResp.status !== 404) {
      dbgWarn(`[WebDAV] PROPFIND 返回 HTTP ${propfindResp.status}，跳过目录检查`);
      return;
    }

    const trimmedPath = url.slice(0, url.lastIndexOf('/', url.length - 2) + 1);
    if (trimmedPath && trimmedPath !== rootPath && trimmedPath.length > parsed.origin.length) {
      try {
        await ensureWebDAVFolder(trimmedPath, headers);
      } catch (_) {}
    }

    let mkcolResp;
    try {
      mkcolResp = await gmRequest('MKCOL', url, { headers, allow404: false });
    } catch (err) {
      dbgWarn('[WebDAV] MKCOL 请求失败，交由上传请求判定目录状态:', err && err.message); return;
    }
    if (mkcolResp && mkcolResp.status !== 405 && mkcolResp.status !== 301 && mkcolResp.status !== 409 && (mkcolResp.status < 200 || mkcolResp.status >= 300)) {
      dbgWarn(`[WebDAV] MKCOL 返回 HTTP ${mkcolResp.status}，交由上传请求判定目录状态`);
    }
  }

  async function gmPutWebDAV(fullUrl, putOptions, folderUrl, headers) {
    try {
      return await gmRequest('PUT', fullUrl, putOptions);
    } catch (err) {
      if (!err || err.message !== 'HTTP 409') throw err; await ensureWebDAVFolder(folderUrl, headers); return await gmRequest('PUT', fullUrl, putOptions);
    }
  }

  async function putWebDAVBackup(fullUrl, headers, rawContent) {
    await gmRequest('PUT', fullUrl + '.bak', { headers: { ...headers, 'Content-Type': 'text/plain; charset=utf-8' }, data: rawContent });
  }

  function buildUploadContent(content, syncedAt, remotePreserved) {
    syncedAt = syncedAt || Date.now(); remotePreserved = remotePreserved || {}; let prefix = ''; const syncConfig = GM_getValue(WEBDAV_SYNC_CONFIG_KEY, false);
    const syncSelectors = syncConfig;

    let remoteSelectorsSyncedAt = 0;
    if (remotePreserved.rawScriptConfig) {
      try {
        const parsedRemote = JSON.parse(remotePreserved.rawScriptConfig.substring('# ScriptConfig:'.length));
        if (parsedRemote && typeof parsedRemote.selectorsSyncedAt === 'number' && Number.isFinite(parsedRemote.selectorsSyncedAt)) remoteSelectorsSyncedAt = parsedRemote.selectorsSyncedAt;
      } catch (_) {}
    }
    const selectorBase = syncSelectors ? getSelectorSyncSnapshot() : null; const selectorsChanged = !!syncSelectors && (!selectorBase || !selectorsEqual(selectorBase, getUserSelectors()));
    const selectorsSyncedAt = selectorsChanged ? syncedAt : (remoteSelectorsSyncedAt || getSelectorsModifiedTime());

    if (syncConfig) {
      const payload = buildSyncPayload(remotePreserved.settingsModifiedAt ?? getSettingsModifiedTime()); payload.rulesSyncedAt = syncedAt; payload.selectorsSyncedAt = selectorsSyncedAt; prefix += '# ScriptConfig:' + JSON.stringify(payload) + '\n';
    } else if (remotePreserved.rawScriptConfig) {
      let updatedHeader = remotePreserved.rawScriptConfig;
      try {
        const parsed = JSON.parse(updatedHeader.substring('# ScriptConfig:'.length));
        if (parsed && typeof parsed === 'object') {
          parsed.rulesSyncedAt = syncedAt; parsed.selectorsSyncedAt = selectorsSyncedAt; updatedHeader = '# ScriptConfig:' + JSON.stringify(parsed);
        }
      } catch (_) {}
      prefix += updatedHeader + '\n';
    } else {
      prefix += '# ScriptConfig:' + JSON.stringify({ syncedAt: 0, rulesSyncedAt: syncedAt, selectorsSyncedAt: selectorsSyncedAt }) + '\n';
    }

    if (syncSelectors) {
      const userSelectors = getUserSelectors();
      if (Object.keys(userSelectors).length || remotePreserved.rawSelectors) prefix += '# Selectors:' + JSON.stringify(userSelectors) + '\n';
    } else if (remotePreserved.rawSelectors) {
      prefix += remotePreserved.rawSelectors + '\n';
    }

    return prefix + content;
  }

  // 订阅
  function extractYamlRuleItems(lines) {
    let hasSection = false, name; const items = [], sectionStack = [];
    const yamlEscapes = { '0': '\0', a: '\x07', b: '\b', t: '\t', n: '\n', v: '\v', f: '\f', r: '\r', e: '\x1b', ' ': ' ', '"': '"', '/': '/', '\\': '\\', N: '\u0085', _: '\u00a0', L: '\u2028', P: '\u2029' };
    const stripQ = (raw) => {
      const s = raw.trim();
      if (s.startsWith("'")) { const match = s.match(/^'((?:[^']|'')*)'/); return match ? match[1].replace(/''/g, "'") : s; }
      if (!s.startsWith('"')) return s;
      const match = s.match(/^"((?:[^"\\]|\\.)*)"/);
      return match ? match[1].replace(/\\(x[0-9a-fA-F]{2}|u[0-9a-fA-F]{4}|U[0-9a-fA-F]{8}|[\s\S])/g, (_, escape) => {
        if (yamlEscapes[escape] !== undefined) return yamlEscapes[escape];
        const code = /^[xuU]/.test(escape) ? parseInt(escape.slice(1), 16) : NaN;
        return code <= 0x10ffff ? String.fromCodePoint(code) : '\\' + escape;
      }) : s;
    };
    const keyOf = (line) => {
      const m = line.match(/^(\s*)(rules|blacklist|whitelist|matches)\s*:\s*(?:\[(.*)\]\s*)?(?:#.*)?$/i); return m ? { key: m[2].toLowerCase(), indent: m[1].length, payload: m[3] } : null;
    };
    const stripLineComment = (line) => {
      let quote = null;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (quote) {
          if (ch === '\\' && quote === '"') i++;
          else if (ch === quote) { if (quote === "'" && line[i + 1] === "'") i++; else quote = null; }
          continue;
        }
        if (ch === '#' && (i === 0 || /\s/.test(line[i - 1]))) return line.slice(0, i).trim();
        if ((ch === "'" || ch === '"') && (i === 0 || /[\s,:[\]{}]/.test(line[i - 1]))) quote = ch;
      }
      return line.trim();
    };
    const pushYamlItem = (rawItem, kind) => {
      let item = stripQ(stripLineComment(rawItem));
      if (kind === 'whitelist' && item && !item.startsWith('@')) item = '@' + item;
      if (item) items.push(item);
    };
    const joinFold = (from, baseIndent) => {
      const chunks = []; let j = from, contentIndent = -1;
      for (; j < lines.length; j++) {
        const raw = lines[j]; if (!raw.trim()) continue; const ind = raw.search(/\S/), trimmed = raw.trim();
        if (trimmed.startsWith('-') || ind < baseIndent) break;
        if (contentIndent === -1) contentIndent = ind; else if (ind < contentIndent) break;
        chunks.push(trimmed);
      }
      return { text: chunks.join(' ').replace(/\s+/g, ' ').trim(), next: j };
    };
    const flowItems = (payload) => {
      const out = []; let cur = '', quote = null;
      for (let i = 0; i < payload.length; i++) {
        const ch = payload[i];
        if (quote) {
          cur += ch;
          if (ch === '\\' && quote === '"') cur += payload[++i] || '';
          else if (ch === quote) { if (quote === "'" && payload[i + 1] === "'") cur += payload[++i]; else quote = null; }
          continue;
        }
        if ((ch === "'" || ch === '"') && (i === 0 || /[\s,:[\]{}]/.test(payload[i - 1]))) { quote = ch; cur += ch; }
        else if (ch === ',') { if (cur.trim()) out.push(cur.trim()); cur = ''; }
        else cur += ch;
      }
      if (cur.trim()) out.push(cur.trim());
      return out;
    };
    for (let idx = 0; idx < lines.length; idx++) {
      const line = lines[idx]; const match = keyOf(line);
      if (match) {
        hasSection = true;
        while (sectionStack.length && sectionStack[sectionStack.length - 1].indent >= match.indent) sectionStack.pop();
        sectionStack.push({ kind: match.key, indent: match.indent });
        if (match.payload !== undefined && match.key !== 'matches') for (const part of flowItems(match.payload)) pushYamlItem(part, match.key);
        continue;
      }
      if (!sectionStack.length) {
        if (name === undefined) { const nm = line.match(/^\s*(?:name|title)\s*:\s*(.+?)\s*$/i); if (nm) name = stripQ(nm[1]); }
        continue;
      }
      const s = line.trim(); if (!s || s.startsWith('#')) continue;
      const indent = line.search(/\S/);
      while (sectionStack.length && sectionStack[sectionStack.length - 1].indent >= indent + (s.startsWith('-') ? 1 : 0)) sectionStack.pop();
      if (!sectionStack.length) { idx--; continue; }
      const kind = sectionStack[sectionStack.length - 1].kind;
      if (kind === 'matches' || !/^-\s+/.test(s)) continue;
      const rawItem = s.replace(/^-\s+/, '').trim(); if (/^(?:[\u007b]|\[|[a-zA-Z0-9_]+\s*:(?:\s|$))/.test(rawItem)) continue;
      const fold = rawItem.match(/^(?:>|\|)\s*[-+]?\d*\s*$/);
      if (fold) {
        const joined = joinFold(idx + 1, indent); if (joined.text) pushYamlItem(joined.text, kind); idx = Math.max(idx, joined.next - 1); continue;
      }
      pushYamlItem(rawItem, kind);
    }
    return { items, name, section: hasSection };
  }

  function parseRulesetContent(content) {
    let lines = String(content || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n'), meta = {}; let isYaml = false; let head = null; const firstContentIdx = lines.findIndex((l) => l.trim() !== '');
    if (firstContentIdx !== -1 && lines[firstContentIdx].trim() === '---') {
      const endIndex = lines.findIndex((l, i) => i > firstContentIdx && l.trim() === '---');
      if (endIndex !== -1) { head = extractYamlRuleItems(lines.slice(firstContentIdx + 1, endIndex)); lines = lines.slice(endIndex + 1); }
      else isYaml = true;
    }
    if (head && head.name !== undefined) meta.name = head.name;
    if (!isYaml) {
      for (const line of lines) {
        const s = line.trim(); if (!s || s.startsWith('#')) continue;
        if (/^(?:name|title|rules|blacklist|whitelist|matches)\s*:/i.test(s)) {
          isYaml = true; break;
        }
        if (validateRule(s)) break;
      }
    }
    if (isYaml || (head && head.section)) {
      const body = extractYamlRuleItems(lines);
      if ((head && head.section) || body.section) {
        if (meta.name === undefined) meta.name = body.name;
        return { lines: (head && head.section ? head.items : []).concat(body.section ? body.items : lines), meta };
      }
    }
    return { lines, meta };
  }

function collectSubscriptionRules(lines) {
  const validRules = [];
  for (let line of lines) {
    if (line.length === 0 || /^-{3,}$/.test(line)) continue;
    if (/^!\s*site\s*[:=]/i.test(line)) continue;
    if (line.startsWith('!') && !looksLikeCondExpr(line)) continue; if (line.startsWith('[') && line.endsWith(']')) continue; if (line.startsWith('@@')) continue;
    if (isElementRuleLine(line)) continue; if (line.startsWith('#')) continue;

    const cleanLine = stripRuleComment(line);
    if (cleanLine && validateRule(cleanLine)) {
      validRules.push(cleanLine);
    } else dbgWarn('[订阅] 无效规则已跳过:', line);
  }
  return validRules;
}

async function performSubscriptionForUrl(url, showAlerts = true) {
  if (!getSubscriptions().some(s => s.url === url)) {
    return { success: false, cancelled: true, count: 0 };
  }
  const resp = await gmRequest('GET', url); const content = resp.responseText;

  const { lines: contentLines, meta } = parseRulesetContent(content); const lines = contentLines.map(line => line.trim()); const validRules = collectSubscriptionRules(lines);
  const subs = getSubscriptions(); const existing = subs.find(s => s.url === url);
  if (!existing) {
    return { success: false, cancelled: true, count: 0 };
  }

  if (isHtmlResponse(content) || validRules.length === 0) {
    throw new Error(t('subImportFailed'));
  }

  const existingIndex = subs.findIndex(s => s.url === url);
  const subData = {
    url,
    addedAt: existing.addedAt || 0,
    enabled: existing ? existing.enabled !== false : true,
    lastUpdate: Date.now(),
    rules: validRules
  };
  if (meta.name) subData.name = meta.name; else if (existing && existing.name) subData.name = existing.name;

  subs[existingIndex] = subData; saveSubscriptions(subs);
    if (showAlerts) showToast(t('subscriptionSuccess', { count: validRules.length }), 'success'); return { success: true, count: validRules.length };
  }

  async function performEngineSubscriptionForUrl(url, showAlerts = true) {
    const existing = getEngineSubscriptions().find(s => s.url === url);
    if (!existing) return { success: false, cancelled: true, count: 0 };
    const resp = await gmRequest('GET', url); const content = resp.responseText;
    if (isHtmlResponse(content)) throw new Error(t('subImportFailed'));
    const parsed = parseSelectorText(content);
    if (!parsed.config || parsed.errors.length) throw new Error((parsed.errors && parsed.errors[0]) || t('subImportFailed'));
    const errors = validateUserSelectors(parsed.config); if (errors.length) throw new Error(errors[0]);
    const count = Object.keys(parsed.config).length; if (!count) throw new Error(t('subImportFailed'));
    const subs = getEngineSubscriptions().map(s => s.url === url ? {
      ...s, selectors: selectorStoreValue(parsed.config), lastUpdate: Date.now(), lastAttempt: Date.now(),
      name: s.builtin ? (s.name || t('builtinEngineSub')) : s.name
    } : s);
    saveEngineSubscriptions(subs); refreshEngineSite();
    if (showAlerts) showToast(t('subscriptionSuccess', { count }), 'success');
    return { success: true, count };
  }

  const SUBSCRIPTION_PANEL_SPECS = {
    rules: {
      panelId: 'serh-subscription-panel', rowsId: 'serh-subscription-rows-container',
      titleKey: 'panelTitle', importKey: 'save', urlPlaceholder: 'https://example.com/rules.txt',
      autoUpdateKey: 'subscriptionAutoUpdate',
      get: getSubscriptions, save: saveSubscriptions, signature: subscriptionsSignature,
      countOf: sub => (sub && Array.isArray(sub.rules) ? sub.rules.length : 0),
      rowLabel: (sub, index) => ((sub && sub.name) || `${t('subscription')}${index + 1}`),
      importOne: performSubscriptionForUrl,
      afterChange: () => { markLocalModifiedTime(SETTINGS_LAST_MODIFIED_KEY); forceReprocessAll(); triggerWebDAVSyncDelayed(5000); }
    },
    engine: {
      panelId: 'serh-engine-sub-panel', rowsId: 'serh-engine-sub-rows',
      titleKey: 'engineSubTitle', importKey: 'import', urlPlaceholder: 'https://example.com/selectors.js',
      autoUpdateKey: 'engineSubAutoUpdate',
      get: getEngineSubscriptions, save: saveEngineSubscriptions,
      signature: list => JSON.stringify(list.map(s => [s.url, s.enabled !== false, s.name || ''])),
      countOf: sub => (sub && sub.selectors && typeof sub.selectors === 'object' ? Object.keys(sub.selectors).length : 0),
      rowLabel: (sub, index) => (sub && sub.builtin ? t('builtinEngineSub') : ((sub && sub.name) || `${t('subscription')}${index + 1}`)),
      importOne: performEngineSubscriptionForUrl,
      afterChange: () => { markLocalModifiedTime(SETTINGS_LAST_MODIFIED_KEY); refreshEngineSite(); forceReprocessAll(); triggerWebDAVSyncDelayed(5000); }
    }
  };

  function showSubscriptionPanel(kind = 'rules') {
    const isEngine = kind === 'engine';
    const spec = isEngine ? SUBSCRIPTION_PANEL_SPECS.engine : SUBSCRIPTION_PANEL_SPECS.rules;
    const pid = isEngine ? 'serh-engine-sub' : 'serh-subscription';
    hideStatsPanel();
    let cancelDiscardsEdits = false;
    const opened = openPanel(spec.panelId, { padding: '20px', beforeClose: () => { if (!cancelDiscardsEdits) persistCurrent(); } });
    if (!opened) return;
    const { panel, closePanel } = opened;
    let subscriptions = spec.get(); const deletedUrls = new Set();

    function createRow(sub = {}) {
      const url = typeof sub === 'string' ? sub : (sub.url || ''); const enabled = typeof sub === 'object' && sub.enabled !== undefined ? sub.enabled : true;
      const builtin = isEngine && sub.builtin === true; const row = document.createElement('div');
      row.className = 'serh-subscription-row';
      row.dataset.builtin = builtin ? '1' : ''; row.dataset.originalUrl = url; row.dataset.originalEnabled = String(enabled !== false);
      row.innerHTML = `<div class="serh-subscription-meta-row"><span class="serh-subscription-index"></span><div class="serh-subscription-status-message"></div><span class="serh-subscription-info"></span></div><div class="serh-subscription-input-row"><label class="serh-switch serh-subscription-toggle-switch" style="margin:0 2px 0 0;"><input type="checkbox" class="serh-subscription-enable-toggle" ${enabled ? 'checked' : ''}><span class="serh-slider"></span></label><input type="text" class="serh-subscription-url" placeholder="${spec.urlPlaceholder}" ${builtin ? 'readonly' : ''}><button class="serh-subscription-delete-btn" ${builtin ? 'disabled' : ''}>❌</button></div>`;
      row.querySelector('.serh-subscription-url').value = url;
      return row;
    }

    panel.innerHTML = `
            <div class="serh-subscription-panel-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0;">
                <h3 style="margin:0;font-size:16px;color:#2d3748;line-height:1;">${t(spec.titleKey)}</h3>
                <label style="display:flex !important;align-items:center;font-size:12px;color:#4a5568;cursor:pointer;margin:0;white-space:nowrap;line-height:1;">
                    <span class="serh-switch">
                        <input type="checkbox" id="${pid}-auto-update" ${currentConfig[spec.autoUpdateKey] ? 'checked' : ''}>
                        <span class="serh-slider"></span>
                    </span>
                    <span style="line-height:1;">${t('autoUpdate')}</span>
                </label>
            </div>
            <div id="${spec.rowsId}"></div>
            <div class="serh-subscription-btn-group">
                <button id="${pid}-import" class="serh-button serh-button-primary">${t(spec.importKey)}</button>
                <button id="${pid}-add" class="serh-button serh-button-success">+</button>
                <button id="${pid}-cancel" class="serh-button serh-button-secondary">${t('cancel')}</button>
            </div>
        `;

    const container = document.getElementById(spec.rowsId);
    subscriptions.forEach(sub => container.appendChild(createRow(sub)));

    const autoUpdateSwitch = document.getElementById(`${pid}-auto-update`);
    if (autoUpdateSwitch) {
      autoUpdateSwitch.addEventListener('change', function() {
        adoptStoredConfigBeforeWrite(); currentConfig[spec.autoUpdateKey] = this.checked; persistConfig(true);
      });
    }

    function formatSubInfo(sub) {
      if (!sub || !sub.lastUpdate) return '';
      const d = new Date(sub.lastUpdate);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return `${dateStr} - ${spec.countOf(sub)}`;
    }

    function reindexRows() {
      container.querySelectorAll('.serh-subscription-row').forEach((row, index) => {
        const sub = subscriptions.find(s => s.url === row.dataset.originalUrl);
        row.querySelector('.serh-subscription-index').textContent = spec.rowLabel(sub, index);
        row.querySelector('.serh-subscription-info').textContent = formatSubInfo(sub);
      });
    }

    function collectSubscriptionsFromRows(latestSubs = subscriptions, removedUrls = []) {
      const removed = new Set(removedUrls); const newSubs = latestSubs.filter(s => !removed.has(s.url)); let hasError = false; const seenUrls = new Set(); const producedUrls = new Set();
      container.querySelectorAll('.serh-subscription-row').forEach(row => {
        const input = row.querySelector('.serh-subscription-url'); const url = input.value.trim(); const origUrl = row.dataset.originalUrl || '';
        const toggle = row.querySelector('.serh-subscription-enable-toggle'); const enabled = toggle ? toggle.checked : true; const msgDiv = row.querySelector('.serh-subscription-status-message');
        row.classList.remove('serh-subscription-row-invalid'); msgDiv.textContent = ''; msgDiv.className = 'serh-subscription-status-message';
        if (!url) { row.dataset.originalUrl = ''; if (origUrl && !producedUrls.has(origUrl)) { const at = newSubs.findIndex(s => s && s.url === origUrl); if (at >= 0) newSubs.splice(at, 1); } return; }
        if (!/^https?:\/\//i.test(url)) {
          row.classList.add('serh-subscription-row-invalid'); msgDiv.textContent = t('subLinkInvalid'); msgDiv.className = 'serh-subscription-status-message error'; hasError = true; return;
        }
        if (seenUrls.has(url)) {
          if (origUrl && origUrl !== url && !producedUrls.has(origUrl)) {
            const ghostIndex = newSubs.findIndex(s => s.url === origUrl); if (ghostIndex >= 0) newSubs.splice(ghostIndex, 1);
          }
          return;
        }
        seenUrls.add(url);
        const existingSub = latestSubs.find(s => s && s.url === url); if (origUrl && url === origUrl && !existingSub) return;
        const enabledChanged = row.dataset.originalEnabled === undefined ||
          String(enabled) !== row.dataset.originalEnabled;
        const subData = {
          url,
          addedAt: existingSub && existingSub.url === url ? (existingSub.addedAt || 0) : Date.now(),
          enabled: existingSub && !enabledChanged ? existingSub.enabled !== false : enabled,
          lastUpdate: existingSub ? existingSub.lastUpdate : 0,
          lastAttempt: existingSub ? (existingSub.lastAttempt || 0) : 0,
          rules: existingSub && Array.isArray(existingSub.rules) ? existingSub.rules : [],
          name: existingSub ? existingSub.name : undefined
        };
        if (origUrl && origUrl !== url && !producedUrls.has(origUrl)) {
          const oldIndex = newSubs.findIndex(s => s.url === origUrl); if (oldIndex >= 0) newSubs.splice(oldIndex, 1);
        }
        const index = newSubs.findIndex(s => s.url === url); if (index >= 0) newSubs[index] = subData; else newSubs.push(subData); producedUrls.add(url);
      });
      return { newSubs, hasError };
    }

    function collectEngineSubscriptionsFromRows(latestSubs, removedUrls) {
      const removed = new Set(removedUrls); const newSubs = latestSubs.filter(s => s.builtin || !removed.has(s.url));
      const seen = new Set(); let hasError = false;
      container.querySelectorAll('.serh-subscription-row').forEach(row => {
        const input = row.querySelector('.serh-subscription-url'); const url = input.value.trim(); const origUrl = row.dataset.originalUrl || '';
        const builtin = row.dataset.builtin === '1'; const enabled = row.querySelector('.serh-subscription-enable-toggle').checked;
        const msgDiv = row.querySelector('.serh-subscription-status-message'); row.classList.remove('serh-subscription-row-invalid');
        msgDiv.textContent = ''; msgDiv.className = 'serh-subscription-status-message';
        if (!url) { if (origUrl && !builtin) { const at = newSubs.findIndex(s => s && s.url === origUrl && !s.builtin); if (at >= 0) newSubs.splice(at, 1); } return; }
        if (!/^https?:\/\//i.test(url)) {
          row.classList.add('serh-subscription-row-invalid'); msgDiv.textContent = t('subLinkInvalid'); msgDiv.className = 'serh-subscription-status-message error'; hasError = true; return;
        }
        if (seen.has(url)) return; seen.add(url);
        const existing = latestSubs.find(s => s.url === url) || (builtin ? latestSubs.find(s => s.builtin) : null) || {};
        if (origUrl && origUrl !== url && !builtin) {
          const oldIndex = newSubs.findIndex(s => s.url === origUrl && !s.builtin); if (oldIndex >= 0) newSubs.splice(oldIndex, 1);
        }
        const subData = {
          url,
          name: builtin ? t('builtinEngineSub') : (existing.name || ''),
          enabled, builtin: builtin || existing.builtin || undefined,
          lastUpdate: existing.lastUpdate || 0, lastAttempt: existing.lastAttempt || 0,
          selectors: existing.selectors || null
        };
        const at = newSubs.findIndex(s => s.url === url); if (at >= 0) newSubs[at] = subData; else newSubs.push(subData);
      });
      return { newSubs: [...newSubs.filter(s => s.builtin), ...newSubs.filter(s => !s.builtin)], hasError };
    }

    const collectRows = isEngine ? collectEngineSubscriptionsFromRows : collectSubscriptionsFromRows;

    function persistCurrent() {
      const latestSubs = spec.get(); const { newSubs } = collectRows(latestSubs, deletedUrls);
      const savedSubs = newSubs.filter(s => s.url); const changed = spec.signature(savedSubs) !== spec.signature(latestSubs);
      spec.save(savedSubs); deletedUrls.clear(); subscriptions = spec.get();
      container.querySelectorAll('.serh-subscription-row').forEach(row => {
        const input = row.querySelector('.serh-subscription-url'); const currentUrl = input ? input.value.trim() : '';
        if (!input || !/^https?:\/\//i.test(currentUrl)) return;
        row.dataset.originalUrl = currentUrl; const toggle = row.querySelector('.serh-subscription-enable-toggle');
        if (toggle) row.dataset.originalEnabled = String(toggle.checked);
      });
      reindexRows();
      if (changed) spec.afterChange();
      return true;
    }

    function bindToggleEvents() {
      container.querySelectorAll('.serh-subscription-enable-toggle').forEach(toggle => {
        toggle.onchange = () => {
          const row = toggle.closest('.serh-subscription-row'); const url = (row.querySelector('.serh-subscription-url').value || '').trim();
          if (!/^https?:\/\//i.test(url)) return;
          const subs = spec.get(); const at = subs.findIndex(s => s && s.url === url); if (at < 0) return;
          if ((subs[at].enabled !== false) === toggle.checked) return;
          subs[at].enabled = toggle.checked; spec.save(subs); subscriptions = spec.get();
          row.dataset.originalEnabled = String(toggle.checked);
          spec.afterChange();
        };
      });
    }

    function bindDeleteEvents() {
      container.querySelectorAll('.serh-subscription-delete-btn').forEach(btn => {
        btn.onclick = (e) => {
          if (btn.disabled) return; e.stopPropagation(); const row = btn.closest('.serh-subscription-row');
          const origUrl = (row.dataset.originalUrl || '').trim(); if (origUrl) deletedUrls.add(origUrl);
          row.remove(); reindexRows();
        };
      });
    }

    document.getElementById(`${pid}-add`).onclick = () => {
      container.appendChild(createRow()); reindexRows(); bindDeleteEvents(); bindToggleEvents();
      container.scrollTop = container.scrollHeight;
    };

    reindexRows(); bindDeleteEvents(); bindToggleEvents();

    document.getElementById(`${pid}-import`).onclick = async () => {
      const rows = Array.from(container.querySelectorAll('.serh-subscription-row')); persistCurrent(); showToast(t('importing'), 'info');
      let total = 0, failed = false;
      for (const row of rows) {
        const input = row.querySelector('.serh-subscription-url'); const url = input.value.trim(); const msgDiv = row.querySelector('.serh-subscription-status-message');
        if (!url) {
          row.classList.remove('serh-subscription-row-invalid'); msgDiv.textContent = t('subLinkEmpty'); msgDiv.className = 'serh-subscription-status-message error'; failed = true; continue;
        }
        if (!/^https?:\/\//i.test(url)) {
          row.classList.add('serh-subscription-row-invalid'); msgDiv.textContent = t('subLinkInvalid'); msgDiv.className = 'serh-subscription-status-message error'; failed = true; continue;
        }
        try {
          const result = await spec.importOne(url, false); if (!result.success) { failed = true; continue; }
          total += result.count || 0; row.classList.remove('serh-subscription-row-invalid'); row.dataset.originalUrl = url;
          msgDiv.textContent = t('subImportSuccess'); msgDiv.className = 'serh-subscription-status-message success';
          const sub = spec.get().find(s => s && s.url === url);
          row.querySelector('.serh-subscription-info').textContent = formatSubInfo(sub);
        } catch (err) {
          failed = true; console.error(isEngine ? `[引擎订阅] 导入失败 [${url}]:` : `导入失败 [${url}]:`, err);
          msgDiv.textContent = t('subImportFailed'); msgDiv.className = 'serh-subscription-status-message error';
        }
      }
      subscriptions = spec.get(); reindexRows(); forceReprocessAll();
      if (isEngine) {
        if (total > 0) showToast(t('subscriptionSuccess', { count: total }), 'success');
        else if (!failed) showToast(t('saved'), 'success');
      } else if (!rows.some(r => r.querySelector('.serh-subscription-status-message.error'))) {
        showToast(t('saved'), 'success');
      }
    };

    bindCancelButton(`${pid}-cancel`, () => { cancelDiscardsEdits = true; closePanel(); });
  }

  function showEngineSubscriptionPanel() {
    showSubscriptionPanel('engine');
  }

  function hasMatchingWebDAVCredentials(saved, url, username) {
    return !!saved.password && String(saved.url || '').trim() === url.trim() &&
      String(saved.username || '').trim() === username.trim();
  }

  function resolveWebDAVPanelConfig(saved, values) {
    const url = values.url.trim(); const username = values.username.trim(); let password = values.password;
    if (!password && saved.password) {
      if (!hasMatchingWebDAVCredentials(saved, url, username)) return null; password = saved.password;
    }
    return { url, username, password, filename: values.filename.trim() || 'rules.txt' };
  }

  function webdavRandomBytes(len) {
    const bytes = new Uint8Array(len);
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') crypto.getRandomValues(bytes);
    else for (let i = 0; i < len; i++) bytes[i] = Math.floor(Math.random() * 256);
    return bytes;
  }

  function webdavBytesToB64(bytes) {
    let binary = ''; for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]); return btoa(binary);
  }

  function webdavB64ToBytes(b64) {
    const bin = atob(b64); const bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i); return bytes;
  }

  function webdavXorBytes(data, key) {
    const out = new Uint8Array(data.length); for (let i = 0; i < data.length; i++) out[i] = data[i] ^ key[i % key.length]; return out;
  }

  function obfuscateWebDAVPassword(plain) {
    const text = String(plain || ''); if (!text) return '';
    try {
      const key = webdavRandomBytes(32); const data = new TextEncoder().encode(text); return 'serhx1:' + webdavBytesToB64(key) + ':' + webdavBytesToB64(webdavXorBytes(data, key));
    } catch (e) {
      return '';
    }
  }

  function deobfuscateWebDAVPassword(value) {
    const text = String(value || ''); if (text.indexOf('serhx1:') !== 0) return text;
    try {
      const parts = text.substring('serhx1:'.length).split(':'); if (parts.length !== 2 || !parts[0] || !parts[1]) return ''; const key = webdavB64ToBytes(parts[0]);
      return new TextDecoder().decode(webdavXorBytes(webdavB64ToBytes(parts[1]), key));
    } catch (e) {
      return '';
    }
  }

  function loadWebDAVConfig() {
    const saved = GM_getValue(WEBDAV_KEY); if (!saved || typeof saved !== 'object') return saved || {}; let password = saved.password;
    if (password) {
      try { password = deobfuscateWebDAVPassword(password); } catch (e) { password = ''; }
    }
    return { ...saved, password };
  }

 // WebDAV
  function showWebDAVPanel() {
    hideStatsPanel();
    const opened = openPanel('serh-webdav-panel', {
      padding: '20px',
      beforeClose: () => { passwordInput.value = ''; updateWebDAVPasswordState(); }
    });
    if (!opened) return;
    const { panel, closePanel } = opened;

    const webdavConfig = loadWebDAVConfig();
    const autoSyncEnabled = GM_getValue(WEBDAV_AUTO_SYNC_KEY, false); const syncConfigEnabled = GM_getValue(WEBDAV_SYNC_CONFIG_KEY, false);
    panel.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0;">
        <h3 style="margin:0;font-size:16px;color:#2d3748;line-height:1;">${t('webdavTitle')}</h3>
        <div style="display:flex;align-items:center;gap:8px;">
            <label style="display:flex !important;align-items:center;font-size:12px;color:#4a5568;cursor:pointer;margin:0;white-space:nowrap;line-height:1;">
                <span class="serh-switch">
                    <input type="checkbox" id="serh-webdav-sync-config" ${syncConfigEnabled ? 'checked' : ''}>
                    <span class="serh-slider"></span>
                </span>
                <span style="line-height:1;">${t('syncScriptConfig')}</span>
            </label>
            <label style="display:flex !important;align-items:center;font-size:12px;color:#4a5568;cursor:pointer;margin:0;white-space:nowrap;line-height:1;">
                <span class="serh-switch">
                    <input type="checkbox" id="serh-webdav-auto-sync" ${autoSyncEnabled ? 'checked' : ''}>
                    <span class="serh-slider"></span>
                </span>
                <span style="line-height:1;">${t('autoSync')}</span>
            </label>
        </div>
    </div>
    <div class="serh-webdav-row"><label>${t('webdavUrl')}</label><input id="serh-webdav-url" type="text" placeholder="https://example.com/dav/files/"></div>
    <div class="serh-webdav-row"><label>${t('webdavUser')}</label><input id="serh-webdav-username" type="text"></div>
    <div class="serh-webdav-row">
        <label>${t('webdavPass')}</label>
        <div style="position: relative; display: flex; align-items: center;">
            <input id="serh-webdav-password" type="password" autocomplete="new-password" style="padding-right: 35px !important;">
            <button id="serh-webdav-toggle-password" type="button" style="position: absolute; right: 4px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; padding: 4px; font-size: 16px; line-height: 1; color: #718096; display: none; align-items: center; justify-content: center; z-index: 1;">🐵</button>
        </div>
    </div>
    <div class="serh-webdav-row"><label>${t('filename')}</label><input id="serh-webdav-filename" type="text" placeholder="rules.txt"></div>
    <div class="serh-webdav-btn-group">
        <button id="serh-webdav-upload" class="serh-button serh-button-success">${t('upload')}</button>
        <button id="serh-webdav-download" class="serh-button serh-button-primary">${t('download')}</button>
        <button id="serh-webdav-cancel" class="serh-button serh-button-secondary">${t('cancel')}</button>
    </div>
`;

    const urlInput = document.getElementById('serh-webdav-url'); const usernameInput = document.getElementById('serh-webdav-username');
    const passwordInput = document.getElementById('serh-webdav-password'); const filenameInput = document.getElementById('serh-webdav-filename'); urlInput.value = webdavConfig.url || '';
    usernameInput.value = webdavConfig.username || ''; passwordInput.value = ''; filenameInput.value = webdavConfig.filename || 'rules.txt';
    const togglePasswordBtn = document.getElementById('serh-webdav-toggle-password');
    if (togglePasswordBtn && passwordInput) {
      togglePasswordBtn.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation(); if (!passwordInput.value) return; const type = passwordInput.type === 'password' ? 'text' : 'password'; passwordInput.type = type;
        togglePasswordBtn.textContent = type === 'password' ? '🐵' : '🙈';
      });
    }

    function updateWebDAVPasswordState() {
      const saved = loadWebDAVConfig();
      passwordInput.placeholder = hasMatchingWebDAVCredentials(saved, urlInput.value, usernameInput.value)
        ? t('webdavPasswordSaved') : ''; togglePasswordBtn.style.display = passwordInput.value ? 'flex' : 'none';
      if (!passwordInput.value) {
        passwordInput.type = 'password'; togglePasswordBtn.textContent = '🐵';
      }
    }

    function saveSuccessfulWebDAVConfig(config) {
      const toStore = { ...config }; if (toStore.password) toStore.password = obfuscateWebDAVPassword(toStore.password); GM_setValue(WEBDAV_KEY, toStore); passwordInput.value = '';
      updateWebDAVPasswordState();
    }

    function setWebDAVBusy(busy) {
      [urlInput, usernameInput, passwordInput, filenameInput, togglePasswordBtn,
        panel.querySelector('#serh-webdav-upload'), panel.querySelector('#serh-webdav-download')]
        .forEach(input => { input.disabled = busy; });
    }

    function getValidatedWebDAVConfig() {
      const url = urlInput.value.trim();
      if (!url) {
        showToast(t('webdavUrlEmpty'), 'error'); return null;
      }
      if (!url.toLowerCase().startsWith('https://')) {
        showToast(t('webdavHttpsRequired'), 'error'); return null;
      }
      if (filenameInput.value.split('/').some(seg => { const s = seg.trim(); return s === '.' || s === '..'; })) {
        showToast(t('filename') + ': . / ..', 'error'); return null;
      }
      const config = resolveWebDAVPanelConfig(loadWebDAVConfig(), {
        url,
        username: usernameInput.value,
        password: passwordInput.value,
        filename: filenameInput.value
      });
      if (!config) { showToast(t('webdavPasswordRequired'), 'error'); }
      return config;
    }

    urlInput.addEventListener('input', updateWebDAVPasswordState); usernameInput.addEventListener('input', updateWebDAVPasswordState);
    passwordInput.addEventListener('input', updateWebDAVPasswordState); updateWebDAVPasswordState();

    document.getElementById('serh-webdav-upload').onclick = async () => {
      const config = getValidatedWebDAVConfig(); if (!config) return; const uploadBtn = document.getElementById('serh-webdav-upload'); if (uploadBtn.disabled) return; setWebDAVBusy(true);
      const textarea = document.getElementById('serh-rules');
      if (textarea) {
        const panel = document.getElementById('serh-panel');
        const baseRules = (panel && Array.isArray(panel._initialRules)) ? panel._initialRules : (Array.isArray(currentConfig.rules) ? currentConfig.rules : []);
        const userRules = filterValidRuleLines(textarea.value.split('\n'));
        adoptStoredConfigBeforeWrite();
        const initialKeySet = new Set(baseRules.map(getRuleKey)); const userKeySet = new Set(userRules.map(getRuleKey));
        const backgroundNewRules = (Array.isArray(currentConfig.rules) ? currentConfig.rules : []).filter(r => {
          const k = getRuleKey(r); return k && !initialKeySet.has(k) && !userKeySet.has(k);
        });
        currentConfig.rules = backgroundNewRules.length > 0 ? [...userRules, ...backgroundNewRules] : userRules;
        if (panel) panel._initialRules = [...currentConfig.rules];
        if (backgroundNewRules.length > 0) syncRulesTextarea();
      } else {
        adoptStoredConfigBeforeWrite();
      }
      collectMainPanelConfigState(); const changes = persistConfig(false); if (changes.rulesChanged) markLocalModifiedTime(); if (changes.settingsChanged) markLocalModifiedTime(SETTINGS_LAST_MODIFIED_KEY); let content = currentConfig.rules.join('\n'); const loadingToast = showToast(t('webdavUploading'), 'info', 10000);
      try {
        let uploadedTime = 0;
        const lockAcquired = await runWithSyncLock('webdav', async () => {
          const { folderUrl, fullUrl, headers } = getWebDAVRequest(config); await ensureWebDAVFolder(folderUrl, headers); let remotePreserved = {}; let remoteConfig = null;
          const resp = await gmRequest('GET', fullUrl, { headers, allow404: true });
          if (resp.status !== 404 && !isInvalidSyncResponse(resp.responseText, resp.responseHeaders)) {
            const parsed = parseSyncHeader(resp.responseText);
            remotePreserved = {
              rawScriptConfig: parsed.rawScriptConfig,
              rawSelectors: parsed.rawSelectors
            };
            remoteConfig = parsed.config;
          }
          const serverTime = parseHttpDateHeader(resp.responseHeaders); const netOffset = await getNetworkTimeOffset();
          const trustedNow = netOffset !== null ? Date.now() + netOffset : (serverTime > 0 ? serverTime : Date.now()); const validRemoteTimes = extractValidCloudTimes(remoteConfig, trustedNow);
          const remoteSyncedAt = validRemoteTimes.length > 0 ? Math.max(...validRemoteTimes) : 0; uploadedTime = Math.max(remoteSyncedAt + 1000, trustedNow);
          const remoteRaw = String(resp.responseText || '');
          if (resp.status !== 404 && remoteRaw.trim() !== '' && !isInvalidSyncResponse(resp.responseText, resp.responseHeaders)) { try { await putWebDAVBackup(fullUrl, headers, remoteRaw); } catch (bakErr) { console.warn('[WebDAV] 备份失败:', bakErr && bakErr.message); } }
          await putWebDAVRules({ fullUrl, folderUrl, headers, rules: content.split('\n'), settingsModifiedAt: uploadedTime, config }, content, uploadedTime, remotePreserved, buildDavPutHeaders(headers, uploadedTime));
          GM_setValue(WEBDAV_LAST_SYNC_KEY, uploadedTime);
        });
        loadingToast.dismiss();
        if (lockAcquired === false) {
          showToast(t('webdavSyncLocked'), 'error', 4000); forceReprocessAll();
        } else {
          saveSuccessfulWebDAVConfig(config); showToast(t('uploadSuccess'), 'success'); const mainPanel = document.getElementById('serh-panel');
          markWebDAVSyncSuccess(uploadedTime);
          if (mainPanel && Array.isArray(currentConfig.rules)) {
            mainPanel._initialRules = [...currentConfig.rules];
          }
          forceReprocessAll();
        }
      } catch (err) {
        loadingToast.dismiss(); showToast(t('webdavUploadFailed') + err.message, 'error', 5000); forceReprocessAll();
      } finally {
        setWebDAVBusy(false);
      }
    };

    document.getElementById('serh-webdav-auto-sync').onchange = (e) => {
      GM_setValue(WEBDAV_AUTO_SYNC_KEY, e.target.checked);
    };
    document.getElementById('serh-webdav-sync-config').onchange = (e) => {
      GM_setValue(WEBDAV_SYNC_CONFIG_KEY, e.target.checked);
    };

    document.getElementById('serh-webdav-download').onclick = async () => {
      const config = getValidatedWebDAVConfig(); if (!config) return; const downloadBtn = document.getElementById('serh-webdav-download'); if (downloadBtn.disabled) return; setWebDAVBusy(true);
      const loadingToast = showToast(t('webdavDownloading'), 'info', 10000);
      try {
        const syncResult = await runWithSyncLock('webdav', async () => performWebDAVDownload(config)); loadingToast.dismiss();
        if (_pendingSubRefresh) { _pendingSubRefresh = false; if (syncResult !== false) checkAutoSubscription(true); }
        if (syncResult === false) {
          showToast(t('webdavSyncLocked'), 'error', 4000);
        } else if (syncResult !== 'cancelled') {
          saveSuccessfulWebDAVConfig(config); showToast(t('downloadSuccess'), 'success');
        }
      } catch (err) {
        loadingToast.dismiss(); showToast(t('webdavDownloadFailed') + err.message, 'error', 5000);
      } finally {
        setWebDAVBusy(false);
      }
    };

    bindCancelButton('serh-webdav-cancel', closePanel);

  }

  async function performWebDAVDownload(config) {
    adoptStoredConfigIfNewer(); const { fullUrl, headers } = getWebDAVRequest(config); const resp = await gmRequest('GET', fullUrl, { headers }); const content = resp.responseText;
    if (isInvalidSyncResponse(content, resp.responseHeaders)) throw new Error(t('subImportFailed')); const parsedHeader = parseSyncHeader(content);
    if (isNonRuleTextResponse(parsedHeader.restLines, !!(parsedHeader.rawScriptConfig || parsedHeader.rawSelectors))) throw new Error(t('subImportFailed')); const newRules = filterValidRuleLines(parsedHeader.restLines);
    if (!hasEffectiveRules(newRules) && hasEffectiveRules(currentConfig.rules) && !confirm(t('webdavClearConfirm'))) return 'cancelled';
    if (parsedHeader.config) {
      const { subscriptions, selectors, engineSubscriptions } = parsedHeader.config; const settings = getSyncSettings(parsedHeader.config);

      if (GM_getValue(WEBDAV_SYNC_CONFIG_KEY, false)) {
        if (Object.keys(settings).length > 0) {
          const colors = settings.highlightColors;
          if (colors && typeof colors === 'object' && !Array.isArray(colors)) settings.highlightColors = Object.assign({}, currentConfig.highlightColors, colors);
          currentConfig = normalizeConfig(Object.assign({}, getDefaultConfig(), currentConfig, settings, {
            rules: currentConfig.rules || [],
            bubbleState: currentConfig.bubbleState,
            bubbleSize: currentConfig.bubbleSize
          }));
          GM_setValue(CONFIG_KEY, currentConfig);
          if (settings.language !== undefined) registerMenu();
        }
        if (Array.isArray(subscriptions)) {
          const existingMap = new Map(getSubscriptions().map(s => [s.url, s]));
          saveSubscriptions(subscriptions.map(s => {
            const existing = existingMap.get(s.url);
            return {
              url: s.url,
              name: s.name || (existing && existing.name) || '',
              enabled: s.enabled !== false,
              rules: (existing && Array.isArray(existing.rules) && existing.rules.length > 0) ? existing.rules : [],
              lastUpdate: (existing && existing.rules && existing.rules.length > 0) ? (existing.lastUpdate || 0) : 0,
              lastAttempt: (existing && existing.lastAttempt) || 0,
              addedAt: (existing && existing.addedAt) || s.addedAt || 0
            };
          }));
          setSubscriptionSyncSnapshot(subscriptions, config); _pendingSubRefresh = true;
        }
        if (parsedHeader.config.builtinEngineSubEnabled !== undefined) applyBuiltinEngineSubEnabled(parsedHeader.config.builtinEngineSubEnabled);
        if (Array.isArray(engineSubscriptions)) {
          const existingEngineSubs = getEngineSubscriptions(); const localBuiltinSub = existingEngineSubs.find(isBuiltinEngineSub) || null; const existingEngineMap = new Map(existingEngineSubs.map(s => [s.url, s])); let hasNewEngineSub = false;
          saveEngineSubscriptions([...(localBuiltinSub ? [localBuiltinSub] : []), ...engineSubscriptions.filter((s) => !isBuiltinEngineSub(s)).map(s => {
            const existing = existingEngineMap.get(s.url); if (!existing) hasNewEngineSub = true;
            return existing ? { ...existing, name: s.name || existing.name || '', enabled: s.enabled !== false } : { url: s.url, name: s.name || '', enabled: s.enabled !== false, lastUpdate: 0, lastAttempt: 0, selectors: null };
          })]);
          setEngineSubSyncSnapshot(engineSubscriptions, config);
          if (hasNewEngineSub) setTimeout(() => { checkAutoEngineSubscription(true); }, 1000);
        }
      }
      if (selectors && typeof selectors === 'object' && !Array.isArray(selectors) && GM_getValue(WEBDAV_SYNC_CONFIG_KEY, false)) {
        GM_setValue(SELECTORS_KEY, selectors); setSelectorSyncSnapshot(selectors, config); _selectorStoreSignature = getSelectorStoreSignature(); resetSelectorCache(); refreshEngineSite();
      }
    }
    const trustedNow = await getTrustedNow(parseHttpDateHeader(resp.responseHeaders)); let cloudTime = 0; const validCloudTimes = [getCloudModifiedTime(parsedHeader.config, 'rulesSyncedAt', trustedNow)].filter(v => v > 0);
    if (GM_getValue(WEBDAV_SYNC_CONFIG_KEY, false) && parsedHeader.config && (Object.keys(getSyncSettings(parsedHeader.config)).length || Array.isArray(parsedHeader.config.subscriptions))) {
      const cloudSettingsTime = getCloudModifiedTime(parsedHeader.config, 'settingsModifiedAt', trustedNow);
      if (cloudSettingsTime > 0) { GM_setValue(SETTINGS_LAST_MODIFIED_KEY, cloudSettingsTime); }
    }
    if (validCloudTimes.length > 0) {
      cloudTime = Math.max(...validCloudTimes);
    } else {
      const lastModHeader = resp.responseHeaders && String(resp.responseHeaders).match(/last-modified:\s*(.+)$/im);
      if (lastModHeader) {
        const parsed = Date.parse(lastModHeader[1].trim()); if (!isNaN(parsed) && parsed <= trustedNow + WEBDAV_TIME_TOLERANCE) cloudTime = parsed;
      }
    }

    currentConfig.rules = newRules; persistConfig(false); GM_setValue(LOCAL_LAST_MODIFIED_KEY, cloudTime > 0 ? cloudTime : trustedNow); setRuleSyncSnapshot(newRules, config);
    const mainPanel = document.getElementById('serh-panel');
    if (mainPanel && Array.isArray(currentConfig.rules)) {
      mainPanel._initialRules = [...currentConfig.rules];
    }
    applyConfigToMainPanel(); forceReprocessAll(); markWebDAVSyncSuccess(trustedNow);
  }

  let _webdavRetryTimer = null;
  function scheduleWebDAVSyncRetry() {
    if (_webdavRetryTimer) { clearTimeout(_webdavRetryTimer); _webdavRetryTimer = null; }
    if (!GM_getValue(WEBDAV_AUTO_SYNC_KEY, false)) return;
    if (!(GM_getValue(WEBDAV_RETRY_COUNT_KEY, 0) > 0)) return;
    const wait = getWebDAVSyncWait(); if (!(wait > 0)) return;
    _webdavRetryTimer = setTimeout(() => {
      _webdavRetryTimer = null;
      if (!GM_getValue(WEBDAV_AUTO_SYNC_KEY, false) || !(GM_getValue(WEBDAV_RETRY_COUNT_KEY, 0) > 0)) return;
      if (isSerhPanelOpen()) { scheduleWebDAVSyncRetry(); return; }
      checkAutoWebDAV();
    }, wait + 5000);
  }
  function markWebDAVSyncFailure(ts) { const count = GM_getValue(WEBDAV_RETRY_COUNT_KEY, 0) + 1; GM_setValue(WEBDAV_RETRY_COUNT_KEY, count >= 6 ? 0 : count); if (count >= 6) GM_setValue(WEBDAV_DIRTY_KEY, false); GM_setValue(WEBDAV_LAST_SYNC_KEY, ts > 0 ? ts : Date.now()); scheduleWebDAVSyncRetry(); }
  function markWebDAVSyncSuccess(ts) { if (_webdavRetryTimer) { clearTimeout(_webdavRetryTimer); _webdavRetryTimer = null; } GM_setValue(WEBDAV_DIRTY_KEY, false); GM_setValue(WEBDAV_RETRY_COUNT_KEY, 0); GM_setValue(WEBDAV_LAST_SYNC_KEY, ts > 0 ? ts : Date.now()); }

  async function performAutoWebDAVSync(config, depth = 0) {
    adoptStoredConfigIfNewer(); const { folderUrl, fullUrl, headers } = getWebDAVRequest(config);

    const resp = await gmRequest('GET', fullUrl, { headers, allow404: true }); const trustedNow = await getTrustedNow(parseHttpDateHeader(resp.responseHeaders));
    let cloudRules = [], cloudConfig = null; let cloudTime = 0; let cloudSettingsTime = 0; let cloudETag = ''; let cloudLastMod = ''; let parsedHeader = null;
    if (resp.status !== 404) {
      const content = resp.responseText;
      if (isInvalidSyncResponse(content, resp.responseHeaders)) {
        console.warn('[WebDAV] 云端返回异常内容，已跳过'); markWebDAVSyncFailure(trustedNow); return;
      }
      parsedHeader = parseSyncHeader(content); cloudConfig = parsedHeader.config;
      if (isNonRuleTextResponse(parsedHeader.restLines, !!(parsedHeader.rawScriptConfig || parsedHeader.rawSelectors))) {
        console.warn('[WebDAV] 云端返回非规则文本，已跳过'); markWebDAVSyncFailure(trustedNow); return;
      }
      cloudRules = parsedHeader.restLines.map(r => r.trim()).filter(r => r); const validHeaderTimes = [getCloudModifiedTime(parsedHeader.config, 'rulesSyncedAt', trustedNow)].filter(v => v > 0); let lastModTime = 0;
      if (resp.responseHeaders && typeof resp.responseHeaders === 'string') {
        const lastModMatch = resp.responseHeaders.match(/last-modified:\s*(.+)$/im);
        if (lastModMatch) {
          cloudLastMod = lastModMatch[1].trim(); lastModTime = Date.parse(cloudLastMod) || 0;
        }
        const etagMatch = resp.responseHeaders.match(/etag:\s*(.+)$/im);
        if (etagMatch) {
          cloudETag = etagMatch[1].trim();
        }
      }
      if (validHeaderTimes.length > 0) {
        cloudTime = Math.max(...validHeaderTimes);
      } else {
        cloudTime = lastModTime; if (isNaN(cloudTime) || cloudTime > trustedNow + WEBDAV_TIME_TOLERANCE) cloudTime = 0;
      }
      cloudSettingsTime = getCloudModifiedTime(cloudConfig, 'settingsModifiedAt', trustedNow);
    }

    adoptStoredConfigIfNewer(); let localTime = GM_getValue(LOCAL_LAST_MODIFIED_KEY, 0); if (localTime > trustedNow + WEBDAV_TIME_TOLERANCE) localTime = trustedNow;
    let localSettingsTime = getSettingsModifiedTime(); if (localSettingsTime > trustedNow + WEBDAV_TIME_TOLERANCE) localSettingsTime = trustedNow;
    const localRules = currentConfig.rules || [];
    const scriptedEmptyCloud = resp.status !== 404 && cloudRules.length === 0 && !!(parsedHeader && parsedHeader.config && typeof parsedHeader.config.rulesSyncedAt === 'number' && Number.isFinite(parsedHeader.config.rulesSyncedAt) && parsedHeader.config.rulesSyncedAt > 0);
    if (resp.status !== 404 && cloudRules.length === 0 && !scriptedEmptyCloud) {
      if (localRules.length > 0) {
        console.log('[WebDAV] 云端文件为空，上传本地规则...'); const uploadedTime = Math.max(cloudTime + 1000, localTime + 1, trustedNow);
        try {
          await putWebDAVRules({ fullUrl, folderUrl, headers, rules: localRules, config }, localRules.join('\n'), uploadedTime, {
            rawScriptConfig: parsedHeader ? parsedHeader.rawScriptConfig : null,
            rawSelectors: parsedHeader ? parsedHeader.rawSelectors : null
          }, buildDavPutHeaders(headers, uploadedTime, { etag: cloudETag, lastMod: cloudLastMod }));
        } catch (err) {
          if (err && err.message && err.message.includes('412')) {
            if (depth >= WEBDAV_SYNC_MAX_RETRIES) {
              console.warn(`[WebDAV] 云端并发更新冲突 (412) 重试 ${WEBDAV_SYNC_MAX_RETRIES} 次后放弃，等待下一轮同步`);
              markWebDAVSyncFailure(trustedNow); return;
            }
            console.warn(`[WebDAV] 云端并发更新冲突 (412)，稍后重试 (${depth + 1}/${WEBDAV_SYNC_MAX_RETRIES})`);
            await delay(WEBDAV_SYNC_RETRY_DELAY * Math.pow(2, depth)); return performAutoWebDAVSync(config, depth + 1);
          }
          console.warn('[WebDAV] 空云端恢复上传失败:', err.message); markWebDAVSyncFailure(trustedNow); return;
        }
        forceReprocessAll(); markWebDAVSyncSuccess(trustedNow); return;
      }
      console.warn('[WebDAV] 云端文件为空，已跳过'); markWebDAVSyncSuccess(trustedNow); return;
    }

    if (resp.status === 404) {
      console.log('[WebDAV] 云端文件不存在，初始上传中...'); await ensureWebDAVFolder(folderUrl, headers);
      try {
        await putWebDAVRules({ fullUrl, folderUrl, headers, rules: localRules, config }, localRules.join('\n'), trustedNow, null, buildDavPutHeaders(headers, trustedNow, { ifNoneMatch: true }));
      } catch (err) {
        if (err && err.message && err.message.includes('412') && depth < WEBDAV_SYNC_MAX_RETRIES) {
          console.warn(`[WebDAV] 云端文件被并发创建 (412)，重新同步 (${depth + 1}/${WEBDAV_SYNC_MAX_RETRIES})`);
          await delay(WEBDAV_SYNC_RETRY_DELAY * Math.pow(2, depth)); return performAutoWebDAVSync(config, depth + 1);
        }
        console.warn('[WebDAV] 初始上传失败:', err.message); markWebDAVSyncFailure(trustedNow); return;
      }
    } else {
      const baseRules = getRuleSyncSnapshot(); let mergedRules;
      if (!baseRules) {
        const seen = new Set(); const union = [];
        const addRule = (r) => {
          const trimmed = (r || '').trim(); if (!trimmed) return; const k = getRuleKey(trimmed);
          if (k && !seen.has(k)) {
            seen.add(k); union.push(trimmed);
          }
        };
        localRules.forEach(addRule); cloudRules.forEach(addRule); mergedRules = union;
      } else {
        mergedRules = mergeRules3Way(baseRules, localRules, cloudRules, localTime >= cloudTime);
      }

      const mergedContent = mergedRules.join('\n');
      let mergedSubs = null;
      if (cloudConfig && Array.isArray(cloudConfig.subscriptions) && GM_getValue(WEBDAV_SYNC_CONFIG_KEY, false)) {
        mergedSubs = applyCloudSubscriptions(cloudConfig.subscriptions, localSettingsTime >= cloudSettingsTime);
      }
      let mergedEngineSubs = null;
      if (cloudConfig && Array.isArray(cloudConfig.engineSubscriptions) && GM_getValue(WEBDAV_SYNC_CONFIG_KEY, false)) {
        mergedEngineSubs = applyCloudEngineSubscriptions(cloudConfig.engineSubscriptions, localSettingsTime >= cloudSettingsTime);
      }

      if (GM_getValue(WEBDAV_SYNC_CONFIG_KEY, false) && cloudSettingsTime > localSettingsTime && cloudConfig) {
        const cloudSettings = getSyncSettings(cloudConfig); const colors = cloudSettings.highlightColors;
        if (colors && typeof colors === 'object' && !Array.isArray(colors)) cloudSettings.highlightColors = Object.assign({}, currentConfig.highlightColors, colors);
        Object.assign(currentConfig, cloudSettings); localSettingsTime = cloudSettingsTime; GM_setValue(SETTINGS_LAST_MODIFIED_KEY, localSettingsTime); if (cloudSettings.language !== undefined) registerMenu();
        if (cloudConfig.builtinEngineSubEnabled !== undefined) applyBuiltinEngineSubEnabled(cloudConfig.builtinEngineSubEnabled);
      }

      currentConfig.rules = mergedRules.slice(); persistConfig(false);
      const syncConfig = GM_getValue(WEBDAV_SYNC_CONFIG_KEY, false); const syncSelectors = syncConfig;
      const cloudSelectors = (cloudConfig && Object.prototype.hasOwnProperty.call(cloudConfig, 'selectors') && cloudConfig.selectors && typeof cloudConfig.selectors === 'object' && !Array.isArray(cloudConfig.selectors)) ? cloudConfig.selectors : null;
      let mergedSelectors = null;
      if (syncSelectors && cloudSelectors) {
        let localSelectorsTime = getSelectorsModifiedTime(); if (localSelectorsTime > trustedNow + WEBDAV_TIME_TOLERANCE) localSelectorsTime = trustedNow;
        const cloudSelectorsTime = getCloudModifiedTime(cloudConfig, 'selectorsSyncedAt', trustedNow);
        mergedSelectors = mergeSelectors3Way(getSelectorSyncSnapshot(), getUserSelectors(), cloudSelectors, localSelectorsTime > cloudSelectorsTime);
        if (!selectorsEqual(mergedSelectors, getUserSelectors())) {
          GM_setValue(SELECTORS_KEY, mergedSelectors); _selectorStoreSignature = getSelectorStoreSignature(); resetSelectorCache(); refreshEngineSite();
        }
      }
      const selectorsChanged = syncSelectors && (cloudSelectors === null ? Object.keys(getUserSelectors()).length > 0 : !selectorsEqual(mergedSelectors, cloudSelectors)); const contentChanged = mergedRules.join('\n') !== cloudRules.join('\n');
      const localSettingsNewer = localSettingsTime > cloudSettingsTime;
      const subscriptionsChanged = syncConfig && (
        subscriptionsSignature(mergedSubs || getSubscriptions()) !== subscriptionsSignature(cloudConfig && cloudConfig.subscriptions));
      const engineSubsChanged = syncConfig && Array.isArray(cloudConfig && cloudConfig.engineSubscriptions) && (
        subscriptionsSignature(mergedEngineSubs || getEngineSubscriptions()) !== subscriptionsSignature(cloudConfig && cloudConfig.engineSubscriptions));
      const shouldUpload = contentChanged || subscriptionsChanged || engineSubsChanged || selectorsChanged || (syncConfig && localSettingsNewer);

      if (shouldUpload) {
        console.log('[WebDAV] 规则合并或配置更新完成，上传至云端...'); const uploadedTime = Math.max(cloudTime + 1000, localTime + 1, trustedNow);
        if (cloudRules.length > 0 && resp.status !== 404 && String(resp.responseText || '').trim() !== '') { try { await putWebDAVBackup(fullUrl, headers, String(resp.responseText || '')); } catch (err) { console.warn('[WebDAV] 备份失败:', err && err.message); } }
        try {
          await putWebDAVRules({ fullUrl, folderUrl, headers, rules: mergedRules, subs: mergedSubs, engineSubs: mergedEngineSubs, selectors: mergedSelectors, config, rulesModifiedAt: (contentChanged || selectorsChanged) ? uploadedTime : (cloudTime || uploadedTime), settingsModifiedAt: (subscriptionsChanged || engineSubsChanged) ? Math.max(uploadedTime, localSettingsTime) : localSettingsTime }, mergedContent, uploadedTime, {
            rawScriptConfig: parsedHeader ? parsedHeader.rawScriptConfig : null,
            rawSelectors: parsedHeader ? parsedHeader.rawSelectors : null
          }, buildDavPutHeaders(headers, uploadedTime, { etag: cloudETag, lastMod: cloudLastMod }));
        } catch (err) {
          if (err && err.message && err.message.includes('412')) {
            if (depth >= WEBDAV_SYNC_MAX_RETRIES) {
              console.warn(`[WebDAV] 云端并发更新冲突 (412) 重试 ${WEBDAV_SYNC_MAX_RETRIES} 次后放弃，等待下一轮同步`);
              markWebDAVSyncFailure(trustedNow); return;
            }
            console.warn(`[WebDAV] 云端并发更新检测到版本冲突 (412)，稍后重试 (${depth + 1}/${WEBDAV_SYNC_MAX_RETRIES})`);
            await delay(WEBDAV_SYNC_RETRY_DELAY * Math.pow(2, depth)); return performAutoWebDAVSync(config, depth + 1);
          }
          console.warn('[WebDAV] 上传失败:', err.message); markWebDAVSyncFailure(trustedNow); return;
        }
      } else {
        persistSyncSnapshots(mergedRules, { subs: mergedSubs, engineSubs: mergedEngineSubs, selectors: mergedSelectors, config });
        if (cloudTime > 0) {
          GM_setValue(LOCAL_LAST_MODIFIED_KEY, cloudTime);
        }
      }
    }

    forceReprocessAll(); applyGlobalConfigUi(); markWebDAVSyncSuccess(trustedNow);
  }

  function isSerhPanelOpen() {
    return ['serh-panel', 'serh-subscription-panel', 'serh-engine-sub-panel', 'serh-webdav-panel', 'serh-selector-panel', 'serh-settings-panel', 'serh-hlcolor-panel'].some(id => document.getElementById(id));
  }

  let _webdavSyncDelayedTimer = null, _webdavSyncPendingWhenPanelOpen = false;
  function triggerWebDAVSyncDelayed(delayMs = 5000) {
    if (!GM_getValue(WEBDAV_AUTO_SYNC_KEY, false)) return;
    GM_setValue(WEBDAV_DIRTY_KEY, true); GM_setValue(WEBDAV_RETRY_COUNT_KEY, 0);

    if (_webdavSyncDelayedTimer) clearTimeout(_webdavSyncDelayedTimer);
    if (isSerhPanelOpen()) { _webdavSyncPendingWhenPanelOpen = true; return; }
    _webdavSyncDelayedTimer = setTimeout(() => {
      _webdavSyncDelayedTimer = null;
      if (!GM_getValue(WEBDAV_AUTO_SYNC_KEY, false)) return;
      const config = loadWebDAVConfig(); if (!config || !config.url || !isHttpsUrl(config.url)) return;
      if (isSerhPanelOpen()) { _webdavSyncPendingWhenPanelOpen = true; return; }
      runBackgroundSync('webdav', async () => {
        if (isSerhPanelOpen()) { _webdavSyncPendingWhenPanelOpen = true; return; }
        await performAutoWebDAVSync(config);
      }).catch(err => { markWebDAVSyncFailure(); console.error('[WebDAV] 同步失败:', err.message); });
    }, delayMs);
  }

  async function checkAutoWebDAV() {
    if (!GM_getValue(WEBDAV_AUTO_SYNC_KEY, false)) return; const config = loadWebDAVConfig(); if (!config || !config.url) return; if (!isHttpsUrl(config.url)) return;
    if (isSerhPanelOpen()) return;
    const wait = getWebDAVSyncWait();
    if (wait > 0) {
      const now = await getTrustedNow(); let lastSync = GM_getValue(WEBDAV_LAST_SYNC_KEY, 0); if (lastSync > now + WEBDAV_TIME_TOLERANCE) lastSync = 0;
      if (lastSync > 0 && now - lastSync < wait) return;
    }
    runBackgroundSync('webdav', async () => {
      const retryWait = getWebDAVSyncWait();
      if (retryWait > 0) {
        const trustedNow = await getTrustedNow(); let currentLastSync = GM_getValue(WEBDAV_LAST_SYNC_KEY, 0); if (currentLastSync > trustedNow + WEBDAV_TIME_TOLERANCE) currentLastSync = 0;
        if (currentLastSync > 0 && trustedNow - currentLastSync < retryWait) return;
      }
      if (isSerhPanelOpen()) return; await performAutoWebDAVSync(config);
    }).catch(err => { markWebDAVSyncFailure(); console.error('[WebDAV] 同步失败:', err.message); });
  }

  function timestampFilename(prefix, ext) {
    const d = new Date(), pad = (n) => String(n).padStart(2, '0');
    return `${prefix}-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.${ext}`;
  }

  function downloadTextFile(filename, content, mime) {
    const blob = new Blob([content], { type: mime }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a);
    a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  function exportSubscriptionList() {
    return getSubscriptions().map((s) => ({ url: s.url, name: s.name, enabled: s.enabled !== false }));
  }

  function applyImportedSubscriptions(subs) {
    if (!Array.isArray(subs) || subs.length === 0) return 0;
    const map = new Map(getSubscriptions().filter((s) => s && s.url).map((s) => [s.url, s]));
    let added = 0;
    subs.forEach((s) => {
      if (!s || typeof s.url !== 'string' || !s.url) return; const local = map.get(s.url); if (!local) added++;
      map.set(s.url, Object.assign({}, local || {}, { url: s.url, name: s.name !== undefined ? s.name : (local ? local.name : ''), enabled: s.enabled !== false }));
    });
    const merged = [...map.values()]; saveSubscriptions(merged); return added;
  }
  function applyImportedEngineSubscriptions(subs) {
    if (!Array.isArray(subs) || subs.length === 0) return 0;
    const before = getEngineSubscriptions();
    const map = new Map(before.filter((s) => s && s.url).map((s) => [s.url, s]));
    let added = 0;
    subs.forEach((s) => {
      if (!s || typeof s.url !== 'string' || !s.url) return; const local = map.get(s.url); if (!local) added++;
      map.set(s.url, Object.assign({}, local || { lastUpdate: 0, lastAttempt: 0, selectors: null }, { url: s.url, name: s.name !== undefined ? s.name : (local ? local.name : ''), enabled: s.enabled !== false }));
    });
    const merged = [...map.values()]; saveEngineSubscriptions(merged); return added;
  }

  function importRulesFromFile() {
    pickTextFile('.txt,text/plain', (content) => {
      const parsedHeader = parseSyncHeader(content);
      const hasHeader = !!(parsedHeader.rawScriptConfig || parsedHeader.rawSelectors);
      if (isNonRuleTextResponse(parsedHeader.restLines, hasHeader, true)) { showToast(t('fileImportFailed'), 'error'); return; }
      if (parsedHeader.invalidSelectors) {
        showToast(t('selectorJsonError'), 'error');
        if (!hasHeader && !hasEffectiveRules(parsedHeader.restLines)) return;
      }
      const newRules = filterValidRuleLines(parsedHeader.restLines);
      const headerOnly = hasHeader && !parsedHeader.restLines.some(l => l.trim());
      const replaceRules = !headerOnly && (hasEffectiveRules(newRules) || !hasEffectiveRules(currentConfig.rules) || confirm(t('importClearConfirm')));
      const headerConfig = parsedHeader.config;
      if (headerConfig && typeof headerConfig === 'object' && !Array.isArray(headerConfig)) {
        const headerSelectors = parsedHeader.rawSelectors ? headerConfig.selectors : null;
        if (headerSelectors && typeof headerSelectors === 'object' && !Array.isArray(headerSelectors)) {
          GM_setValue(SELECTORS_KEY, headerSelectors); _selectorStoreSignature = getSelectorStoreSignature(); resetSelectorCache(); refreshEngineSite(); markLocalModifiedTime(SELECTORS_LAST_MODIFIED_KEY);
        }
        const settings = getSyncSettings(headerConfig);
        if (Object.keys(settings).length > 0) {
          const next = Object.assign({}, currentConfig); const colors = settings.highlightColors;
          if (colors && typeof colors === 'object' && !Array.isArray(colors)) settings.highlightColors = Object.assign({}, currentConfig.highlightColors, colors);
          Object.assign(next, settings); next.rules = currentConfig.rules || []; next.bubbleState = currentConfig.bubbleState; next.bubbleSize = currentConfig.bubbleSize;
          currentConfig = normalizeConfig(next); if (settings.language !== undefined) registerMenu();
        }
        if (headerConfig.builtinEngineSubEnabled !== undefined) applyBuiltinEngineSubEnabled(headerConfig.builtinEngineSubEnabled);
      }
      if (headerConfig) { const importedSubs = Array.isArray(headerConfig.subscriptions) ? headerConfig.subscriptions : null; if (importedSubs && applyImportedSubscriptions(importedSubs) > 0) setTimeout(() => checkAutoSubscription(true), 1000); }
      if (headerConfig) { const importedEngineSubs = Array.isArray(headerConfig.engineSubscriptions) ? headerConfig.engineSubscriptions : null; if (importedEngineSubs && applyImportedEngineSubscriptions(importedEngineSubs) > 0) setTimeout(() => checkAutoEngineSubscription(true), 1000); }
      if (!replaceRules && !hasHeader) return;
      if (replaceRules) {
        const textarea = document.getElementById('serh-rules');
        if (textarea) {
          textarea.value = parsedHeader.restLines.join('\n'); updateLineNumbers();
        }
        currentConfig.rules = newRules;
        const panel = document.getElementById('serh-panel'); if (panel) panel._initialRules = [...currentConfig.rules];
      }
      persistConfig(true); applyConfigToMainPanel(replaceRules); forceReprocessAll();
    });
  }

  function loadExportPick() { const raw = GM_getValue(EXPORT_PICK_KEY, null); const out = { rules: true, subscription: false, engine: false, settings: false }; if (raw && typeof raw === 'object' && !Array.isArray(raw)) for (const k of Object.keys(out)) if (typeof raw[k] === 'boolean') out[k] = raw[k]; if (!out.rules && !out.subscription && !out.engine && !out.settings) out.rules = true; return out; }
  function saveExportPick() { const raw = GM_getValue(EXPORT_PICK_KEY, null); const out = (raw && typeof raw === 'object' && !Array.isArray(raw)) ? { ...raw } : {}; for (const k of Object.keys(_exportPick)) out[k] = !!_exportPick[k]; GM_setValue(EXPORT_PICK_KEY, out); }

  function closeExportMenu() {
    const menu = document.getElementById('serh-export-menu'); if (menu) menu.remove();
    if (_exportMenuHandler) { document.removeEventListener('click', _exportMenuHandler); _exportMenuHandler = null; }
  }

  function showExportMenu(anchor) {
    closeExportMenu(); _exportPick = loadExportPick();
    const menu = document.createElement('div'); menu.id = 'serh-export-menu'; menu.style.visibility = 'hidden'; const scale = currentUiScale(); if (scale !== 1) menu.style.zoom = String(scale);
    const opt = (key, labelKey) => `<label><span class="serh-switch"><input type="checkbox" data-export="${key}" ${_exportPick[key] ? 'checked' : ''}><span class="serh-slider"></span></span><span>${t(labelKey)}</span></label>`;
    menu.innerHTML = `<div class="serh-export-grid">${opt('rules', 'exportOptRules')}${opt('settings', 'exportOptSettings')}${opt('engine', 'exportOptEngine')}${opt('subscription', 'exportOptSubscription')}</div><div class="serh-export-btns"><button id="serh-export-ok" class="serh-button serh-button-primary">${t('bcConfirm')}</button><button id="serh-export-cancel" class="serh-button serh-button-secondary">${t('cancel')}</button></div>`;
    document.body.appendChild(menu);
    const rect = anchor.getBoundingClientRect(), mw = menu.offsetWidth, mh = menu.offsetHeight;
    let top = rect.bottom / scale + 6; if (top + mh > innerHeight / scale - 4) top = Math.max(4, rect.top / scale - mh - 6);
    menu.style.left = Math.max(4, Math.min(rect.left / scale, innerWidth / scale - mw - 4)) + 'px'; menu.style.top = top + 'px';
    menu.style.visibility = '';
    menu.querySelectorAll('input[data-export]').forEach(input => input.addEventListener('change', () => { _exportPick[input.dataset.export] = input.checked; saveExportPick(); }));
    menu.querySelector('#serh-export-cancel').onclick = closeExportMenu;
    menu.querySelector('#serh-export-ok').onclick = () => { closeExportMenu(); exportRulesToFile(); };
    _exportMenuHandler = (e) => { if (!menu.contains(e.target) && !anchor.contains(e.target)) closeExportMenu(); };
    setTimeout(() => { if (menu.isConnected) document.addEventListener('click', _exportMenuHandler); }, 0);
  }

  function exportRulesToFile() {
    preventPanelClose = true; const textarea = document.getElementById('serh-rules'); const content = textarea ? textarea.value : '';
    const pick = _exportPick;
    if (!pick.rules && !pick.subscription && !pick.engine && !pick.settings) { showToast(t('exportEmpty'), 'error'); preventPanelClose = false; return; }
    const header = pick.settings ? getSyncSettings(currentConfig) : {};
    if (pick.subscription) header.subscriptions = exportSubscriptionList();
    if (pick.engine) header.engineSubscriptions = getEngineSubscriptions().filter((s) => !isBuiltinEngineSub(s)).map((s) => ({ url: s.url, name: s.name, enabled: s.enabled !== false }));
    if (pick.settings) { const b = getEngineSubscriptions().find(isBuiltinEngineSub); if (b) header.builtinEngineSubEnabled = b.enabled !== false; }
    let out = Object.keys(header).length ? '# ScriptConfig:' + JSON.stringify(header) + '\n' : '';
    if (pick.engine) { const selectors = getUserSelectors(); if (Object.keys(selectors).length) out += '# Selectors:' + JSON.stringify(selectors) + '\n'; }
    if (pick.rules && content.trim()) out += content;
    if (!out.trim()) { showToast(t('exportEmpty'), 'error'); preventPanelClose = false; return; }
    downloadTextFile(timestampFilename('rules', 'txt'), out, 'text/plain;charset=utf-8'); preventPanelClose = false;
  }

  let _menuCommandIds = [];
  function registerMenu() {
    _menuCommandIds.forEach(id => { try { GM_unregisterMenuCommand(id); } catch (e) {} }); _menuCommandIds = [];
    _menuCommandIds.push(GM_registerMenuCommand(t('menuOpenPanel'), () => showConfigPanel()));
    _menuCommandIds.push(GM_registerMenuCommand('🖋️ ' + t('menuCustomSelectors'), showSelectorPanel));
    _menuCommandIds.push(GM_registerMenuCommand(t('menuHighlightColor'), () => showHighlightColorPanel()));
  }

  // 跨页锁
  const SYNC_LOCK_KEY_PREFIX = 'searchfilter_sync_lock_'; const SYNC_LOCK_TTL = 2 * 60 * 1000;
  const SYNC_TAB_ID = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function readSyncLock(task) {
    const raw = GM_getValue(SYNC_LOCK_KEY_PREFIX + task); if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null; return raw;
  }

  function writeSyncLock(task, lock) {
    GM_setValue(SYNC_LOCK_KEY_PREFIX + task, lock);
  }

  function tryAcquireSyncLock(task, ttl = SYNC_LOCK_TTL) {
    const now = Date.now(); const held = readSyncLock(task); if (held && held.expires > now) return false; writeSyncLock(task, { owner: SYNC_TAB_ID, expires: now + ttl }); return true;
  }

  async function acquireSyncLock(task, ttl = SYNC_LOCK_TTL) {
    if (!tryAcquireSyncLock(task, ttl)) return false; await delay(120 + Math.floor(Math.random() * 180)); const held = readSyncLock(task);
    return !!held && held.owner === SYNC_TAB_ID && held.expires > Date.now();
  }

  function renewSyncLock(task, ttl = SYNC_LOCK_TTL) {
    const held = readSyncLock(task); if (!held || held.owner !== SYNC_TAB_ID) return false; writeSyncLock(task, { owner: SYNC_TAB_ID, expires: Date.now() + ttl }); return true;
  }

  function releaseSyncLock(task) {
    const held = readSyncLock(task); if (held && held.owner === SYNC_TAB_ID) GM_setValue(SYNC_LOCK_KEY_PREFIX + task, null);
  }

  const _syncLocalChains = new Map();
  async function runWithSyncLock(task, fn) {
    if (!(await acquireSyncLock(task))) return false; const renewTimer = setInterval(() => renewSyncLock(task), Math.max(5000, Math.floor(SYNC_LOCK_TTL / 3)));
    try {
      const res = await fn(); return res === undefined ? true : res;
    } finally {
      clearInterval(renewTimer); releaseSyncLock(task);
    }
  }

  function runBackgroundSync(task, fn, retries = 2) {
    const prev = _syncLocalChains.get(task) || Promise.resolve();
    const run = prev.then(() => runWithSyncLock(task, fn), () => runWithSyncLock(task, fn));
    _syncLocalChains.set(task, run.then(() => {}, () => {}));
    run.then((res) => {
      if (res !== false || retries <= 0) return; const held = readSyncLock(task); const wait = Math.max(250, (held && held.expires > Date.now() ? held.expires - Date.now() : 0) + 100 + Math.floor(Math.random() * 200));
      setTimeout(() => runBackgroundSync(task, fn, retries - 1), wait);
    }).catch(() => {});
    return run;
  }

  function checkAutoSubscription(force = false) {
    if (!force && !currentConfig.subscriptionAutoUpdate) return; if (!force && isSerhPanelOpen()) return; const subs = getSubscriptions(); if (!subs || subs.length === 0) return;
    const now = Date.now(); const isDue = (s) => s.enabled && now - (s.lastAttempt || 0) >= AUTO_UPDATE_INTERVAL - AUTO_SYNC_TOLERANCE && (!s.rules || s.rules.length === 0 || now - s.lastUpdate >= AUTO_UPDATE_INTERVAL - AUTO_SYNC_TOLERANCE); if (!subs.some(isDue)) return;
    runBackgroundSync('webdav', async () => {
      if (!force && isSerhPanelOpen()) return;
      const pending = getSubscriptions().filter(isDue); if (!pending.length) return;
      for (const sub of pending) {
        console.log(`[订阅] 开始更新: ${sub.url}`);
        try {
          await performSubscriptionForUrl(sub.url, false);
        } catch (err) {
          console.error(`[订阅] 更新失败: ${sub.url}`, err.message);
          const latest = getSubscriptions(); const at = latest.findIndex(s => s && s.url === sub.url);
          if (at >= 0) { latest[at].lastAttempt = Date.now(); saveSubscriptions(latest); }
        }
      }
      forceReprocessAll();
    }).catch(err => console.error('[订阅] 更新失败:', err.message));
  }

  function checkAutoEngineSubscription(force = false) {
    if (!force && !currentConfig.engineSubAutoUpdate) return;
    if (!force && isSerhPanelOpen()) return;
    const subs = getEngineSubscriptions(); const now = Date.now();
    const isDue = (s) => s.enabled !== false && now - (s.lastAttempt || 0) >= AUTO_UPDATE_INTERVAL - AUTO_SYNC_TOLERANCE && (!s.selectors || now - (s.lastUpdate || 0) >= AUTO_UPDATE_INTERVAL - AUTO_SYNC_TOLERANCE);
    if (!subs.some(isDue)) return;
    runBackgroundSync('webdav', async () => {
      if (!force && isSerhPanelOpen()) return;
      const pending = getEngineSubscriptions().filter(isDue); if (!pending.length) return;
      let updated = false;
      for (const sub of pending) {
        console.log(`[引擎订阅] 开始更新: ${sub.url}`);
        try {
          const res = await performEngineSubscriptionForUrl(sub.url, false); if (res.success) updated = true;
        } catch (err) {
          console.error(`[引擎订阅] 更新失败: ${sub.url}`, err.message);
          const latest = getEngineSubscriptions(); const at = latest.findIndex(s => s && s.url === sub.url);
          if (at >= 0) { latest[at].lastAttempt = Date.now(); saveEngineSubscriptions(latest); }
        }
      }
      if (updated) forceReprocessAll();
    }).catch(err => console.error('[引擎订阅] 更新失败:', err.message));
  }

  function startBackgroundSync() {
    if (_syncIntervalIds.length) return;
    _syncIntervalIds = [
      setInterval(() => checkAutoSubscription(), 60 * 60 * 1000),
      setInterval(() => checkAutoEngineSubscription(), 60 * 60 * 1000),
      setInterval(checkAutoWebDAV, 60 * 60 * 1000)
    ];
    if (hasPendingLocalChange()) checkAutoWebDAV();
    setTimeout(() => {
      checkAutoSubscription(); checkAutoEngineSubscription(); checkAutoWebDAV();
    }, 5000 + Math.floor(Math.random() * 5000));
  }

  function bindSearchForm() {
    if (_searchForm && _searchFormHandler) _searchForm.removeEventListener('submit', _searchFormHandler);
    _searchForm = null; _searchFormHandler = null;
    const searchForm = document.querySelector('form[role="search"], form[name="search"], form[action*="search"]');
    if (searchForm) { _searchForm = searchForm; _searchFormHandler = () => setTimeout(forceReprocessAll, 800); searchForm.addEventListener('submit', _searchFormHandler); }
  }

  function syncBodyBindings() {
    if (!_engineSiteSetup || !document.body || _observedBody === document.body) return;
    _observedBody = document.body; _hiddenParentCount = 0;
    applyDarkModeClass(); applyCollapseMode(); bindSearchForm(); updateStatus(document.querySelectorAll('[data-is-blocked="true"]').length);
  }

  function scheduleInitialScan() {
    const raw = resolvePageDef(getSearchEngine()).delay;
    if (raw == null || raw === false) { scanNewResults(); return; }
    const ms = raw === true ? 0 : Math.max(0, Number(raw) || 0);
    const run = () => { if (_engineSiteSetup) scanNewResults(); };
    if (document.readyState === 'complete') { ms ? setTimeout(run, ms) : run(); }
    else window.addEventListener('load', () => { ms ? setTimeout(run, ms) : run(); }, { once: true });
  }
  function ensureEngineSiteSetup() {
    if (_engineSiteSetup || !isEngineSite()) return; _engineSiteSetup = true; _observedBody = document.body;
    try { injectGlobalStyles(); buildRuleIndex(); exposeDebugApi(); updateStatus(0); scheduleInitialScan(); } catch (e) { _engineSiteSetup = false; _observedBody = null; throw e; }

    let _pendingRecords = [], _mutationRafPending = false;
    const flushMutations = () => {
      _mutationRafPending = false; const records = _pendingRecords; _pendingRecords = []; if (!records.length || !_engineSiteSetup) return;
      syncBodyBindings(); if (!currentConfig.enabled) { _hrefChangedContainers.clear(); _contentChangedContainers.clear(); return; } if (_domObserver) _domObserver.disconnect();
      try {
        const rootCmd = getRootCommand(getSearchEngine());
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
          if (!node || typeof node.closest !== 'function' || !rootCmd) continue; let container = null;
          try { container = findRootContainer(node, rootCmd); } catch (e) { container = null; }
          if (!container) continue;
          if (m.type === 'attributes') {
            _hrefChangedContainers.add(container);
          } else if (container.hasAttribute('data-blocker-processed') || container.hasAttribute('data-retry-exhausted')) {
            _contentChangedContainers.add(container);
          }
        }
        let statusDirty = false;
        if (_hrefChangedContainers.size) {
          for (const container of _hrefChangedContainers) {
            if (!container.isConnected) continue; const cached = _hrefUrlCache.get(container); const link = peekResultLink(container); const rawHref = peekResultRawHref(container, link);
            if (cached !== undefined && cached.rawHref === rawHref) continue;
            if (cached !== undefined && peekResultUrl(container, link) === cached.url) { cached.rawHref = rawHref; continue; }
            reprocessContainer(container); statusDirty = true;
          }
          _hrefChangedContainers.clear();
        }
        if (_contentChangedContainers.size) {
          for (const container of _contentChangedContainers) {
            if (!container.isConnected) continue; if (!container.hasAttribute('data-blocker-processed') && !container.hasAttribute('data-retry-exhausted')) continue; const cachedSig = _resultContentCache.get(container);
            const currentSig = getResultContentSignature(container); if (currentSig === null || cachedSig === currentSig) continue;
            reprocessContainer(container); statusDirty = true;
          }
          _contentChangedContainers.clear();
        }
        if (statusDirty) {
          updateStatus(document.querySelectorAll('[data-is-blocked="true"]').length);
        }
        const hasAddedNodes = records.some(m => m.type === 'childList' && m.addedNodes && m.addedNodes.length > 0);
        const hasRemovedNodes = records.some(m => m.type === 'childList' && m.removedNodes && m.removedNodes.length > 0);
        if (hasAddedNodes) scanNewResults(); else if (hasRemovedNodes || statusDirty) reconcileHiddenParents();
      } finally {
        if (_engineSiteSetup && _domObserver) {
          _domObserver.observe(document.documentElement, {
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
        _mutationRafPending = true;
        if (document.hidden) setTimeout(flushMutations, 500); else requestAnimationFrame(flushMutations);
      }
      _pendingRecords = _pendingRecords.concat(records);
      if (_pendingRecords.length > 2000) _pendingRecords = [{ type: 'childList', target: document.body, addedNodes: [1] }];
    });
    _domObserver.observe(document.documentElement, {
      childList: true,
      attributes: true,
      attributeFilter: ['href'],
      characterData: true,
      subtree: true
    });

    bindSearchForm();
  }

  function ensureUrlWatcher() {
    if (_urlChangeHandler) return;
    let lastHref = location.href, lastCategory = getSearchCategory();
    _urlChangeHandler = () => {
      const currentHref = location.href; const currentCat = getSearchCategory();
      if (currentHref !== lastHref || currentCat !== lastCategory) {
        const hashOnly = currentCat === lastCategory && currentHref.split('#')[0] === lastHref.split('#')[0];
        lastHref = currentHref; lastCategory = currentCat;
        if (hashOnly) return;
        resetSelectorCache(); refreshEngineSite();
      }
    };
    window.addEventListener('popstate', _urlChangeHandler); window.addEventListener('hashchange', _urlChangeHandler);

    const wrapHistoryMethod = (method) => {
      const orig = history[method];
      if (typeof orig !== 'function' || orig._serhWrapped) return;
      const wrapped = function(...args) {
        const ret = orig.apply(this, args);
        try {
          window.dispatchEvent(new Event('serh:locationchange'));
        } catch (e) {}
        return ret;
      };
      wrapped._serhWrapped = true;
      history[method] = wrapped;
    };
    wrapHistoryMethod('pushState'); wrapHistoryMethod('replaceState'); window.addEventListener('serh:locationchange', _urlChangeHandler);
  }

  function teardownEngineSite() {
    if (!_engineSiteSetup) return; _engineSiteSetup = false; forceReprocessBatchId++;
    if (_domObserver) {
      _domObserver.disconnect(); _domObserver = null;
    }
    _hrefUrlCache = new WeakMap(); _hrefChangedContainers.clear(); _resultContentCache = new WeakMap(); _resultRetryCounts = new WeakMap(); _peekUrlCache = new WeakMap(); _contentChangedContainers.clear();
    if (_searchForm && _searchFormHandler) {
      _searchForm.removeEventListener('submit', _searchFormHandler);
    }
    _searchForm = null; _searchFormHandler = null; document.querySelectorAll('.serh-quick-block').forEach(btn => btn.remove());
    const confirmPanel = document.getElementById('serh-block-confirm-dialog'); if (confirmPanel) confirmPanel.remove(); if (_blockConfirmOutsideHandler) { document.removeEventListener('click', _blockConfirmOutsideHandler, true); _blockConfirmOutsideHandler = null; } restoreAllHiddenParents();
    document.querySelectorAll('[data-observed]').forEach(el => {
      resultObserver.unobserve(el); el.removeAttribute('data-observed'); resetResultStyles(el);
    });
    showHiddenResults = false; _observedSelector = ''; _observedBody = null; const status = document.getElementById('serh-status'); if (status) status.remove(); removeGlobalStyles();
  }

  function refreshEngineSite() {
    const wasEngine = _engineSiteSetup;
    if (isEngineSite()) {
      ensureEngineSiteSetup(); if (wasEngine) { syncBodyBindings(); injectGlobalStyles(); } forceReprocessAll();
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
    currentConfig = stored; const fingerprint = JSON.stringify(stored.rules || []);
    if (fingerprint !== _rulesFingerprint) { _rulesRevision++; _rulesFingerprint = fingerprint; }
    return true;
  }

  function getConfigStoreSignature() {
    try { return JSON.stringify(GM_getValue(CONFIG_KEY) ?? null); } catch (e) { return null; }
  }

  function checkExternalConfigChange() {
    if (document.getElementById('serh-panel')) return false;
    const storeSignature = getConfigStoreSignature();
    if (_configStoreSignature !== null && storeSignature === _configStoreSignature) return false;
    const prevLanguage = currentConfig.language;
    if (!adoptStoredConfigIfNewer()) return false; _configStoreSignature = storeSignature; applyGlobalConfigUi(); forceReprocessAll();
    if (currentConfig.language !== prevLanguage) registerMenu(); return true;
  }

  function init() {
    applyDarkModeClass(); applyUiScale(); applyCollapseMode(); migrateSubscriptions(); refreshSubscriptionsOnVersionChange(); pruneUserSelectors(); _selectorStoreSignature = getSelectorStoreSignature(); _configStoreSignature = getConfigStoreSignature();
    if (window.matchMedia) {
      try { window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyDarkModeClass); } catch (e) {}
    }
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        checkExternalSelectorChange(); checkExternalConfigChange();
      } else if (hasPendingLocalChange()) {
        checkAutoWebDAV();
      }
    });
    window.addEventListener('pagehide', (e) => { if (!e.persisted) releaseSyncLock('webdav'); });

    registerMenu();
    exposeDebugApi();
    ensureUrlWatcher();
    if (isEngineSite()) {
      try {
        ensureEngineSiteSetup();
      } catch (e) {
        console.error('[屏蔽] 引擎站点装配失败:', e);
      }
    }
    startBackgroundSync();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else setTimeout(init, 0);
})();
