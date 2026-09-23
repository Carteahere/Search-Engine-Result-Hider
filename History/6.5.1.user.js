// ==UserScript==
// @name         搜索引擎结果屏蔽器
// @name:zh-CN   搜索引擎结果屏蔽器
// @name:en      Search Engine Result Hider
// @namespace    https://github.com/Carteahere
// @version      6.5.1
// @description        支持正则规则的Bing/Google/DuckDuckGo搜索结果屏蔽工具。
// @description:zh-CN  支持正则规则的Bing/Google/DuckDuckGo搜索结果屏蔽工具。
// @description:en     A search result blocking tool for Bing/Google/DuckDuckGo that supports regular expressions.
// @icon         data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJyZWQiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSIxMCI+PC9jaXJjbGU+PGxpbmUgeDE9IjQuOTMiIHkxPSI0LjkzIiB4Mj0iMTkuMDciIHkyPSIxOS4wNyI+PC9saW5lPjwvc3ZnPg==
// @author       南雪莲
// @homepageURL  https://greasyfork.org/zh-CN/scripts/552394
// @homepageURL  https://github.com/SadYuyuko/Search-Engine-Result-Hider
// @license      MIT
// @match        *://*.bing.com/*
// @match        *://*.duckduckgo.com/*
// @match        *://duckduckgo.com/*
// @match        *://*.google.com/*
// @match        *://*.google.com.hk/*
// @match        *://*.google.com.tw/*
// @match        *://*.google.co.jp/*
// @match        *://*.google.com.sg/*
// @include      /^https?:\/\/([\w-]+\.)?google\.[a-z.]{2,6}\/.*$/
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @run-at       document-idle
// ==/UserScript==

(function() {
  'use strict';

  let preventPanelClose = false;

  // 配置存储键
  const CONFIG_KEY = 'searchfilter_blocker';
  const WEBDAV_KEY = 'searchfilter_webdav';
  const SUBSCRIPTION_URL_KEY = 'searchfilter_subscription_url';
  const SUBSCRIPTION_LAST_UPDATE_KEY = 'searchfilter_subscription_last_update';
  const SUBSCRIPTION_RULES_KEY = 'searchfilter_subscription_rules';
  const SUBSCRIPTIONS_KEY = 'searchfilter_subscriptions';
  const WEBDAV_LAST_SYNC_KEY = 'searchfilter_webdav_last_sync';
  const LOCAL_LAST_MODIFIED_KEY = 'searchfilter_local_last_modified';

  // 默认配置
  let currentConfig = GM_getValue(CONFIG_KEY, {
    rules: ['*://*.example.com/*'],
    enabled: true,
    showCount: false,
    bubbleSize: 'large',
    debug: false,
    showBlockBtn: false,
    blockDomain: false,
    blockConfirm: true,
    showBubble: true,
    bubbleState: null,
    panelCentered: true,
    bubbleAction: 'openPanel',
    language: 'zh-CN'
  });

  // 兼容旧配置
  if (currentConfig.showBlockBtn === undefined) currentConfig.showBlockBtn = false;
  if (currentConfig.blockDomain === undefined) currentConfig.blockDomain = false;
  if (currentConfig.blockConfirm === undefined) currentConfig.blockConfirm = false;
  if (currentConfig.showBubble === undefined) currentConfig.showBubble = true;
  if (currentConfig.panelCentered === undefined) currentConfig.panelCentered = true;
  if (currentConfig.bubbleAction === undefined) currentConfig.bubbleAction = 'openPanel';
  if (currentConfig.language === undefined) currentConfig.language = 'zh-CN';

  let showHiddenResults = false;

  // 多语言文本映射
  const LANG_TEXTS = {
    'zh-CN': {
      enableBlock: '启用屏蔽',
      showCount: '显示数量',
      debugMode: '调试模式',
      oneClickBlock: '一键屏蔽',
      blockDomain: '屏蔽域名',
      doubleConfirm: '二次确认',
      bubbleSize: '悬浮球大小:',
      sizeMedium: '中杯',
      sizeLarge: '大杯',
      sizeLarger: '超大',
      sizeXLarge: '特大',
      blockRules: '屏蔽规则:',
      subscribe: '订阅',
      sync: '同步',
      import: '导入',
      export: '导出',
      save: '保存',
      test: '统计',
      close: '关闭',
      placeholder: '每行一个规则',
      ruleHint: 'title/.*ABC.*/ 匹配标题 | text/*ABC.*/ 匹配内容',
      scrollTop: '回到顶部',
      scrollBottom: '回到底部',
      panelTitle: '订阅管理',
      addSubscription: '➕ 添加订阅',
      saveSub: '保存',
      importSub: '导入',
      cancel: '取消',
      webdavTitle: 'WebDAV 同步设置',
      webdavUrl: 'Webdav地址',
      webdavUser: 'Webdav账号',
      webdavPass: '应用密码',
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
      matchedCount: '匹配',
      noMatch: '无匹配项',
      whitelistRules: '白名单规则',
      ruleErrors: '个规则错误',
      menuOpenPanel: '⚙️ 打开配置面板',
      menuEnable: '屏蔽功能',
      menuConfirm: '二次确认',
      menuCenter: '面板居中',
      menuBubble: '悬浮球状态',
      menuBubbleAction: '悬浮球功能',
      menuLang: 'Language：中文',
      menuLangEn: 'Language: English',
      bubbleTitleHide: '点击隐藏已屏蔽结果',
      bubbleTitleShow: '点击显示已屏蔽结果',
      bubbleTitlePanel: '拖动边缘吸附，点击打开配置面板',
      blockBtnTitle: '屏蔽此词条',
      unblockBtnTitle: '取消屏蔽此域名规则',
      subscriptionSuccess: '订阅成功！已更新 {count} 条有效规则。',
      subscriptionSaved: '订阅配置已保存',
      importDone: '导入操作完成',
      uploadSuccess: '上传成功！',
      downloadSuccess: '下载成功！规则已加载到编辑区，保存生效',
      noRulesExport: '没有规则可导出',
      confirmBlock: '确定要屏蔽并添加规则 [ {rule} ] 吗？',
      statsSourceLocal: '本地规则',
      statsSourceSub: '订阅',
      statsWhitelist: '白名单规则',
      statsCompound: '复合规则',
      statsNoMatch: '无匹配项',
      statsErrors: '发现 {count} 个规则错误：',
      statsRule: '规则：',
      matchedCountLabel: '匹配',
      matchedCountUnit: '条',
      menuBubbleStateShow: '显示',
      menuBubbleStateHide: '隐藏',
      menuBubbleActionOpen: '打开面板',
      menuBubbleActionToggle: '显示隐藏结果',
      stateEnabled: '启用',
      stateDisabled: '关闭',
      statsError: '错误：',
      subLinkEmpty: '链接为空',
      subImportSuccess: '导入成功，已导入 {count} 条规则',
      subImportFailed: '导入失败，请检查链接或网络状态',
      maxSubscriptions: '最多只能添加3条订阅',
      webdavUploading: '正在上传...',
      webdavDownloading: '正在下载...',
      webdavUploadFailed: '上传失败：',
      webdavDownloadFailed: '下载失败：',
      webdavHttpsRequired: '安全起见，WebDAV服务器地址必须使用https',
      syntaxError: '语法错误',
      networkError: '网络错误',
      requestTimeout: '请求超时',
    },
    'en': {
      enableBlock: 'Enable Block',
      showCount: 'Show Count',
      debugMode: 'Debug',
      oneClickBlock: 'Click Block',
      blockDomain: 'Block Domain',
      doubleConfirm: 'Confirm',
      bubbleSize: 'Bubble Size:',
      sizeMedium: 'Medium',
      sizeLarge: 'Large',
      sizeLarger: 'Larger',
      sizeXLarge: 'XLarge',
      blockRules: 'Block Rules:',
      subscribe: 'Subscribe',
      sync: 'Sync',
      import: 'Import',
      export: 'Export',
      save: 'Save',
      test: 'Stats',
      close: 'Close',
      placeholder: 'One rule per line',
      ruleHint: 'title/.*ABC.*/ matches title | text/*ABC.*/ matches snippet',
      scrollTop: 'Scroll to Top',
      scrollBottom: 'Scroll to Bottom',
      panelTitle: 'Subscription Manager',
      addSubscription: '➕ Add Subscription',
      saveSub: 'Save',
      importSub: 'Import',
      cancel: 'Cancel',
      webdavTitle: 'WebDAV Sync Settings',
      webdavUrl: 'WebDAV URL',
      webdavUser: 'Username',
      webdavPass: 'App Password',
      filename: 'Filename',
      upload: 'Upload',
      download: 'Download',
      matchedRule: 'Rule',
      localRule: 'Local Rule',
      subscription: 'Subscription',
      urlRule: 'URL Rule',
      titleRule: 'Title Rule',
      textRule: 'Text Rule',
      regexRule: 'Regex Rule',
      matchedCount: 'Matches',
      noMatch: 'No matches',
      whitelistRules: 'Whitelist Rules',
      ruleErrors: 'rule errors',
      menuOpenPanel: '⚙️ Open Panel',
      menuEnable: 'Block',
      menuConfirm: 'Confirm',
      menuCenter: 'Center Panel',
      menuBubble: 'Bubble',
      menuBubbleAction: 'Bubble Action',
      menuLang: 'Language：中文',
      menuLangEn: 'Language: English',
      bubbleTitleHide: 'Click to hide blocked results',
      bubbleTitleShow: 'Click to show blocked results',
      bubbleTitlePanel: 'Drag to snap edge, click to open panel',
      blockBtnTitle: 'Block this entry',
      unblockBtnTitle: 'Unblock this domain rule',
      subscriptionSuccess: 'Subscription successful! Updated {count} valid rules.',
      subscriptionSaved: 'Subscription config saved',
      importDone: 'Import completed',
      uploadSuccess: 'Upload successful!',
      downloadSuccess: 'Download successful! Rules loaded into editor, save to apply.',
      noRulesExport: 'No rules to export',
      confirmBlock: 'Add block rule [ {rule} ] ?',
      statsSourceLocal: 'Local Rules',
      statsSourceSub: 'Subscription',
      statsWhitelist: 'Whitelist Rules',
      statsCompound: 'Compound Rules',
      statsNoMatch: 'No matches',
      statsErrors: 'Found {count} rule errors:',
      statsRule: 'Rule:',
      matchedCountLabel: 'Hits',
      matchedCountUnit: 'Result',
      menuBubbleStateShow: 'Show',
      menuBubbleStateHide: 'Hide',
      menuBubbleActionOpen: 'Open Panel',
      menuBubbleActionToggle: 'Toggle Results',
      stateEnabled: 'Enabled',
      stateDisabled: 'Disabled',
      statsError: 'Error:',
      subLinkEmpty: 'URL is empty',
      subImportSuccess: 'Import success, {count} rules imported',
      subImportFailed: 'Import failed, check URL or network',
      maxSubscriptions: 'Maximum 3 subscriptions allowed',
      webdavUploading: 'Uploading...',
      webdavDownloading: 'Downloading...',
      webdavUploadFailed: 'Upload failed: ',
      webdavDownloadFailed: 'Download failed: ',
      webdavHttpsRequired: 'For security, WebDAV server must use HTTPS',
      syntaxError: 'Syntax error',
      networkError: 'Network error',
      requestTimeout: 'Request timeout',
    }
  };

  // 选择器
  const SELECTORS = {
    // 容器选择器
    containers: {
      bing: 'li.b_algo, div.b_algo',
      google: 'div.g, div.MjjYud',
      duckduckgo: '[data-testid="result"], .result, .web-result, .tile, .tile--ad',
      other: 'div.g, li.b_algo'
    },
    // 标题选择器
    titles: {
      bing: ['h2 a', 'a h2', '.b_title'],
      google: ['h3', 'div[role="heading"]', '.LC20lb', '.DKV0Md', '.sXLaOe', '.c9DxTc', 'a h3'],
      duckduckgo: ['a[data-testid="result-title-a"]', '.result__title', '.tile__title', '.tile--title__title', 'h2 a', 'a h2']
    },
    // 正文选择器
    snippets: {
      bing: ['.b_caption p', '.b_snippet', '.b_paractl p', '.b_lineclamp2'],
      google: ['.st', '.VwiC3b', '.s3v9rd', '.IsZvec', '.lyLwlc', '.yXK7lf'],
      duckduckgo: ['[data-testid="result-snippet"]', '[data-result="snippet"]', '.result__snippet']
    },
    // URL选择器
    links: {
      bing: 'a[href]',
      google: 'a[href]',
      duckduckgo: ['a[data-testid="result-extras-url-link"]', 'a[data-testid="result-title-a"]', '.result__url', '.tile--title__domain', 'a[href]']
    }
  };

  function t(key, params = {}) {
    const lang = currentConfig.language;
    const texts = LANG_TEXTS[lang] || LANG_TEXTS['zh-CN'];
    let text = texts[key] || key;
    for (const [k, v] of Object.entries(params)) {
      text = text.replaceAll(`{${k}}`, v);
    }
    return text;
  }

  // Set优化
  let compiledRules = {
    domains: new Set(),
    urls: [],
    titles: [],
    texts: [],
    whitelistDomains: new Set(),
    whitelistUrlPatterns: [],
    rulesList: [],
    conditionalRules: []
  };

  // 样式
  GM_addStyle(`
        /* 预留高度用于翻页 */
        body { min-height: 101vh !important; }
        #rcnt, #rso { min-height: 60vh; }

        #searchfilter-panel, #searchfilter-webdav-panel, #searchfilter-subscription-panel {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 13px;
            box-sizing: border-box;
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.08);
            transition: all 0.3s ease;
        }

        .searchfilter-button {
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 11px;
            padding: 4px 8px;
            transition: background-color 0.2s;
            box-sizing: border-box;
        }
        .searchfilter-button-primary { background: #2c5282; color: white; }
        .searchfilter-button-primary:hover { background: #1a365d; }
        .searchfilter-button-secondary { background: #4a5568; color: white; }
        .searchfilter-button-secondary:hover { background: #2d3748; }
        .searchfilter-button-success { background: #276749; color: white; }
        .searchfilter-button-success:hover { background: #22543d; }
        .searchfilter-button-danger { background: #c53030; color: white; }
        .searchfilter-button-danger:hover { background: #9b2c2c; }

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
            padding: 8px 12px;
            font-size: 12px;
            font-weight: 500;
            box-sizing: border-box;
        }

        /* 面板高度 */
        .rules-container {
            display: flex;
            border: 1px solid #e2e8f0;
            border-radius: 4px;
            background: #f8fafc;
            height: 180px;
            margin-bottom: 3px;
            position: relative;
        }
        
        /* 规则栏 */
        #searchfilter-line-numbers {
            width: 26px;
            padding: 8px 2px 8px 0;
            background: #edf2f7;
            border-right: 1px solid #e2e8f0;
            text-align: right;
            color: #a0aec0;
            font-family: 'Consolas', 'Monaco', monospace;
            font-size: 11px;
            line-height: 1.4;
            overflow: hidden;
            user-select: none;
            flex-shrink: 0;
            box-sizing: border-box;
        }
        
        #searchfilter-rules {
            flex: 1;
            height: 100%;
            font-size: 11px;
            padding: 8px;
            border: none;
            resize: none;
            background: transparent;
            box-sizing: border-box;
            font-family: 'Consolas', 'Monaco', monospace;
            line-height: 1.4;
            white-space: pre;
            overflow-x: auto;
            overflow-y: auto;
            outline: none;
        }
        
        #searchfilter-rules::-webkit-scrollbar { width: 6px; height: 0px; }
        #searchfilter-rules::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 3px; }
        #searchfilter-rules::-webkit-scrollbar-thumb { background: #c1c1c1; border-radius: 3px; }
        #searchfilter-rules::-webkit-scrollbar-thumb:hover { background: #a8a8a8; }
        
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
            color: #000000; 
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

        /* 快速滑动按钮 */
        .searchfilter-scroll-btn {
            position: absolute;
            right: 7px;
            cursor: pointer;
            opacity: 0.5;
            font-size: 14px;
            user-select: none;
            transition: opacity 0.2s, transform 0.2s;
            background: transparent;
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
        
        /* WebDAV面板 */
        #searchfilter-webdav-panel input,
        #searchfilter-subscription-panel input {
            width: 100%;
            padding: 6px;
            border: 1px solid #e2e8f0;
            border-radius: 4px;
            box-sizing: border-box;
            font-size: 13px;
        }
        #searchfilter-webdav-panel label,
        #searchfilter-subscription-panel label {
            display: block;
            margin-bottom: 4px;
            color: #4a5568;
            font-size: 12px;
        }

        /* 面板渐入渐出动画 */
        .searchfilter-panel-fade {
            opacity: 0;
            transform: translate(-50%, -48%);
            transition: opacity 0.2s ease, transform 0.2s ease;
        }
        .searchfilter-panel-fade.show {
            opacity: 1;
            transform: translate(-50%, -50%);
        }
        
        #searchfilter-panel:not(.searchfilter-panel-fade) {
            transition: opacity 0.2s ease;
        }
        #searchfilter-webdav-panel:not(.searchfilter-panel-fade) {
            transition: opacity 0.2s ease;
        }
        #searchfilter-subscription-panel:not(.searchfilter-panel-fade) {
            transition: opacity 0.2s ease;
        }

        /* WebDAV面板按钮 */
        #searchfilter-webdav-panel .searchfilter-button,
        #searchfilter-subscription-panel .searchfilter-button {
            height: 30px;
            padding: 0 12px;
            font-size: 13px;
        }

        /* 订阅布局 */
        .subscription-row {
            display: flex;
            flex-direction: column;
            gap: 4px;
            margin-bottom: 12px;
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
            margin-left: 6px;
            min-height: 18px;
        }
        .subscription-status-message.success {
            color: #276749;
        }
        .subscription-status-message.error {
            color: #c53030;
        }
        .add-subscription-btn {
            margin-top: 4px;
            margin-bottom: 16px;
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
    `);

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
    GM_setValue(SUBSCRIPTIONS_KEY, subscriptions);
  }

  function getAllSubscriptionRules() {
    const subs = getSubscriptions();
    const rules = [];
    subs.filter(s => s.enabled).forEach(s => {
      if (s.rules && Array.isArray(s.rules)) rules.push(...s.rules);
    });
    return rules;
  }

  // 搜索引擎检测
  function getSearchEngine() {
    const hostname = window.location.hostname;
    if (hostname.includes('bing.com')) return 'bing';
    if (hostname.includes('google.com')) return 'google';
    if (hostname.includes('duckduckgo.com')) return 'duckduckgo';
    return 'other';
  }

  function getContainerSelector(engine) {
    return SELECTORS.containers[engine] || SELECTORS.containers.other;
  }

  // 解析规则
  function evaluateCondition(condStr, dynamicConditionsList) {
    const currentEngine = getSearchEngine();
    const currentSite = window.location.hostname;

    if (/^(google|bing|duckduckgo)$/i.test(condStr.trim())) {
      return currentEngine === condStr.trim().toLowerCase();
    }

    let siteMatch = condStr.match(/^site\s*[=:]\s*['"](.*?)['"]$/i);
    if (siteMatch) {
      return currentSite.endsWith(siteMatch[1].toLowerCase());
    }
    siteMatch = condStr.match(/^site\s*\(\s*['"](.*?)['"]\s*\)$/i);
    if (siteMatch) {
      return currentSite.endsWith(siteMatch[1].toLowerCase());
    }

    const titleMatch = condStr.match(/^title\s*\*\=\s*['"](.*?)['"]$/i);
    if (titleMatch) {
      dynamicConditionsList.push({
        type: 'title',
        op: '*=',
        val: titleMatch[1]
      });
      return true;
    }

    return false;
  }

  function parseRuleWithConditions(ruleStr) {
    let coreRule = ruleStr.trim();
    let staticPass = true;
    let dynamicConditions = [];

    function extractBalancedParens(str, startIndex) {
      if (str[startIndex] !== '(') return null;
      let depth = 0;
      for (let i = startIndex; i < str.length; i++) {
        if (str[i] === '(') depth++;
        else if (str[i] === ')') {
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

    // 处理前置@if
    const prefixIfIdx = coreRule.search(/@if\s*\(/i);
    if (prefixIfIdx !== -1) {
      const parenResult = extractBalancedParens(coreRule, coreRule.indexOf('(', prefixIfIdx));
      if (parenResult) {
        const cond = parenResult.content.trim();
        const afterParen = coreRule.substring(parenResult.endIndex).trim();
        const braceMatch = afterParen.match(/^\{\s*([\s\S]*?)\s*\}$/);
        if (braceMatch) {
          coreRule = braceMatch[1].trim();
          if (!evaluateCondition(cond, dynamicConditions)) staticPass = false;
        }
      }
    }

    // 处理所有@if
    const ifRegex = /@if\s*\(/gi;
    let match;
    const ranges = [];

    while ((match = ifRegex.exec(coreRule)) !== null) {
      const condStartIdx = match.index + match[0].length - 1;

      const parenResult = extractBalancedParens(coreRule, condStartIdx);
      if (!parenResult) continue;

      const cond = parenResult.content.trim();

      ranges.push({
        start: match.index,
        end: parenResult.endIndex
      });

      if (!evaluateCondition(cond, dynamicConditions)) {
        staticPass = false;
      }
    }

    ranges.sort((a, b) => b.start - a.start);

    for (const r of ranges) {
      coreRule = coreRule.slice(0, r.start) + coreRule.slice(r.end);
    }

    coreRule = coreRule.replace(/\s{2,}/g, ' ').trim();

    return {
      coreRule,
      staticPass,
      dynamicConditions
    };
  }

  // 语法检查
  function validateRule(rule) {
    if (!rule || rule.trim() === '') return true;

    let ruleToCheck = rule.trim();

    function extractBalancedParens(str, startIndex) {
      if (str[startIndex] !== '(') return null;
      let depth = 0;
      for (let i = startIndex; i < str.length; i++) {
        if (str[i] === '(') depth++;
        else if (str[i] === ')') {
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

    const prefixIfIdx = ruleToCheck.search(/@if\s*\(/i);
    if (prefixIfIdx !== -1) {
      const parenResult = extractBalancedParens(ruleToCheck, ruleToCheck.indexOf('(', prefixIfIdx));
      if (parenResult) {
        const afterParen = ruleToCheck.substring(parenResult.endIndex).trim();
        const braceMatch = afterParen.match(/^\{\s*([\s\S]*?)\s*\}$/);
        if (braceMatch) {
          ruleToCheck = braceMatch[1].trim();
        }
      }
    } else {
      const lastPostfixIdx = ruleToCheck.lastIndexOf('@if(');
      if (lastPostfixIdx !== -1) {
        const parenResult = extractBalancedParens(ruleToCheck, lastPostfixIdx + 3); // '(' 索引
        if (parenResult) {
          ruleToCheck = ruleToCheck.substring(0, lastPostfixIdx).trim();
        }
      }
    }

    // 白名单规则检查
    if (ruleToCheck.startsWith('@')) {
      ruleToCheck = ruleToCheck.substring(1).trim();
      if (!ruleToCheck) return true;
    }

    if (ruleToCheck.startsWith('/') && ruleToCheck.lastIndexOf('/') > 0) {
      const lastSlash = ruleToCheck.lastIndexOf('/');
      const pattern = ruleToCheck.slice(1, lastSlash);
      const flags = ruleToCheck.slice(lastSlash + 1);
      try {
        new RegExp(pattern, flags);
        return true;
      } catch (e) {
        return false;
      }
    }

    // 标题或正文规则
    if (ruleToCheck.startsWith('text/') || ruleToCheck.startsWith('title/')) {
      let remaining = ruleToCheck.startsWith('title/') ? ruleToCheck.substring(6) : ruleToCheck.substring(5);
      let pattern, flags = '';
      const lastSlashIndex = remaining.lastIndexOf('/');
      if (lastSlashIndex !== -1 && lastSlashIndex < remaining.length - 1) {
        const possibleFlags = remaining.substring(lastSlashIndex + 1);
        if (/^[ims]+$/i.test(possibleFlags)) {
          flags = possibleFlags.toLowerCase();
          pattern = remaining.substring(0, lastSlashIndex);
        } else {
          pattern = remaining;
        }
      } else {
        pattern = remaining;
      }
      if (!flags && remaining.endsWith('/')) pattern = remaining.slice(0, -1);
      if (!flags) {
        const oldFlagMatch = pattern.match(/^\(\?([ims]+)\)/);
        if (oldFlagMatch) {
          flags = oldFlagMatch[1];
          pattern = pattern.substring(oldFlagMatch[0].length);
        }
      }
      if (flags.includes('s')) {
        pattern = pattern.replace(/\./g, '[\\s\\S]');
        flags = flags.replace('s', '');
      }
      try {
        new RegExp(pattern, flags);
        return true;
      } catch (e) {
        return false;
      }
    }

    // URL通配符规则
    let pattern = ruleToCheck;
    if (pattern.startsWith('*://')) pattern = pattern.substring(4);
    if (pattern.includes('/')) {
      const parts = pattern.split('/');
      pattern = parts.map((part, index) => {
        if (index === 0) {
          return part.replace(/\*/g, '.*').replace(/\?/g, '\\?').replace(/(?<!\\)\./g, '\\.');
        } else {
          return part.replace(/\*/g, '.*').replace(/\?/g, '\\?');
        }
      }).join('\\/');
    } else {
      pattern = pattern.replace(/\*/g, '.*').replace(/\?/g, '\\?').replace(/(?<!\\)\./g, '\\.');
    }
    try {
      new RegExp(pattern, 'i');
      return true;
    } catch (e) {
      return false;
    }
  }

  // 规则转换
  function ruleToRegex(rule) {
    if (!rule.startsWith('/') && !rule.startsWith('title/') && !rule.startsWith('text/') &&
      !rule.includes('*') && !rule.includes('://') && !rule.startsWith('.')) {
      if (rule.includes('.') && !/\s/.test(rule)) {
        rule = '*://*.' + rule + '/*';
      }
    }

    if (rule.startsWith('/') && rule.lastIndexOf('/') > 0) {
      const lastSlash = rule.lastIndexOf('/');
      const pattern = rule.slice(1, lastSlash);
      const flags = rule.slice(lastSlash + 1);
      return {
        pattern,
        flags
      };
    }

    if (rule.startsWith('title/')) {
      let remaining = rule.substring(6);
      let pattern, flags = '';
      const lastSlashIndex = remaining.lastIndexOf('/');
      if (lastSlashIndex !== -1 && lastSlashIndex < remaining.length - 1) {
        const possibleFlags = remaining.substring(lastSlashIndex + 1);
        if (/^[ims]+$/i.test(possibleFlags)) {
          flags = possibleFlags.toLowerCase();
          pattern = remaining.substring(0, lastSlashIndex);
        } else {
          pattern = remaining;
        }
      } else {
        pattern = remaining;
      }
      if (!flags && remaining.endsWith('/')) pattern = remaining.slice(0, -1);
      if (!flags) {
        const oldFlagMatch = pattern.match(/^\(\?([ims]+)\)/);
        if (oldFlagMatch) {
          flags = oldFlagMatch[1];
          pattern = pattern.substring(oldFlagMatch[0].length);
        }
      }
      if (flags.includes('s')) {
        pattern = pattern.replace(/\./g, '[\\s\\S]');
        flags = flags.replace('s', '');
      }
      return {
        pattern,
        flags
      };
    }

    // URL规则
    let pattern = rule;
    if (pattern.startsWith('*://')) pattern = pattern.substring(4);
    if (pattern.includes('/')) {
      const parts = pattern.split('/');
      pattern = parts.map((part, index) => {
        if (index === 0) {
          return part.replace(/\*/g, '.*').replace(/\?/g, '\\?').replace(/(?<!\\)\./g, '\\.');
        } else {
          return part.replace(/\*/g, '.*').replace(/\?/g, '\\?');
        }
      }).join('\\/');
    } else {
      pattern = pattern.replace(/\*/g, '.*').replace(/\?/g, '\\?').replace(/(?<!\\)\./g, '\\.');
    }
    return {
      pattern,
      flags: 'i'
    };
  }

  // 白名单简单域名
  function extractSimpleWhitelistDomain(rule) {
    const match = rule.match(/^@\*:\/\/(?:\*\.)?([^\/\*]+)\/\*$/);
    return match ? match[1].toLowerCase() : null;
  }

  // 预编译规则索引
  function buildRuleIndex() {
    compiledRules = {
      domains: new Set(),
      urls: [],
      titles: [],
      texts: [],
      whitelistDomains: new Set(),
      whitelistUrlPatterns: [],
      rulesList: [],
      conditionalRules: []
    };
    const subscriptionRules = getAllSubscriptionRules();
    const allRules = currentConfig.rules.concat(subscriptionRules);
    const subscriptions = getSubscriptions();

    // 规则来源标签
    function getRuleSource(rule) {
      for (let idx = 0; idx < subscriptions.length; idx++) {
        const sub = subscriptions[idx];
        if (sub.enabled && sub.rules && sub.rules.includes(rule)) {
          return `${t('subscription')}${idx + 1}`;
        }
      }
      return t('localRule');
    }

    allRules.forEach(rule => {
      if (!rule || rule.trim() === '' || rule.startsWith('#')) return;

      const source = getRuleSource(rule);

      const parsed = parseRuleWithConditions(rule);
      if (!parsed.staticPass) return;

      const coreRule = parsed.coreRule;
      const hasDynamic = parsed.dynamicConditions.length > 0;

      // 白名单简单处理
      if (coreRule.startsWith('@')) {
        const simpleDomain = extractSimpleWhitelistDomain(coreRule);
        if (simpleDomain) {
          compiledRules.whitelistDomains.add(simpleDomain);
        } else {
          const whitelistRule = coreRule.substring(1).trim();
          if (!whitelistRule) return;
          try {
            const {
              pattern,
              flags
            } = ruleToRegex(whitelistRule);
            compiledRules.whitelistUrlPatterns.push(new RegExp(pattern, flags));
          } catch (e) {
            if (currentConfig.debug) console.warn('白名单规则预编译失败:', rule, e);
          }
        }
        return;
      }

      let ruleObj = {
        originalRule: rule,
        source: source,
        conditions: parsed.dynamicConditions
      };

      // 处理域名规则
      if (!coreRule.startsWith('/') && !coreRule.startsWith('text/') && !coreRule.startsWith('title/')) {
        let domainMatch = coreRule.match(/^\*:\/\/\*\.([^\/]+)\/\*$/);
        if (!domainMatch) {
          domainMatch = coreRule.match(/^\*:\/\/([^\/]+)\/\*$/);
        }
        if (domainMatch) {
          const domain = domainMatch[1].toLowerCase();
          if (!domain.includes('/')) {
            ruleObj.type = 'domain';
            ruleObj.domain = domain;
            if (!hasDynamic) compiledRules.domains.add(domain);
            else compiledRules.conditionalRules.push(ruleObj);

            compiledRules.rulesList.push(ruleObj);
            return;
          }
        }
      }

      // 预编译正则表达式
      try {
        if (coreRule.startsWith('text/')) {
          let virtualRule = coreRule.replace(/^text\//, 'title/');
          let {
            pattern,
            flags
          } = ruleToRegex(virtualRule);
          const regex = new RegExp(pattern, flags);
          ruleObj.type = 'text';
          ruleObj.regex = regex;
          if (!hasDynamic) compiledRules.texts.push(regex);
          else compiledRules.conditionalRules.push(ruleObj);
          compiledRules.rulesList.push(ruleObj);
        } else if (coreRule.startsWith('title/')) {
          let {
            pattern,
            flags
          } = ruleToRegex(coreRule);
          const regex = new RegExp(pattern, flags);
          ruleObj.type = 'title';
          ruleObj.regex = regex;
          if (!hasDynamic) compiledRules.titles.push(regex);
          else compiledRules.conditionalRules.push(ruleObj);
          compiledRules.rulesList.push(ruleObj);
        } else {
          let {
            pattern,
            flags
          } = ruleToRegex(coreRule);
          const regex = new RegExp(pattern, flags);
          ruleObj.type = coreRule.startsWith('/') ? 'regex' : 'url';
          ruleObj.regex = regex;
          if (!hasDynamic) compiledRules.urls.push(regex);
          else compiledRules.conditionalRules.push(ruleObj);
          compiledRules.rulesList.push(ruleObj);
        }
      } catch (e) {
        if (currentConfig.debug) console.warn('规则预编译失败:', rule, e);
      }
    });
  }

  // 规则匹配
  function checkRuleMatchOptimized(url, domain, title, snippet) {
    let d = domain.toLowerCase();
    while (d) {
      if (compiledRules.whitelistDomains.has(d)) return false;
      let dotIndex = d.indexOf('.');
      if (dotIndex === -1) break;
      d = d.substring(dotIndex + 1);
    }

    for (let i = 0; i < compiledRules.whitelistUrlPatterns.length; i++) {
      if (compiledRules.whitelistUrlPatterns[i].test(url) || compiledRules.whitelistUrlPatterns[i].test(domain)) {
        return false;
      }
    }

    d = domain.toLowerCase();
    while (d) {
      if (compiledRules.domains.has(d)) return true;
      let dotIndex = d.indexOf('.');
      if (dotIndex === -1) break;
      d = d.substring(dotIndex + 1);
    }

    for (let i = 0; i < compiledRules.urls.length; i++) {
      if (compiledRules.urls[i].test(url) || compiledRules.urls[i].test(domain)) return true;
    }

    if (title) {
      for (let i = 0; i < compiledRules.titles.length; i++) {
        if (compiledRules.titles[i].test(title)) return true;
      }
    }

    if (snippet) {
      for (let i = 0; i < compiledRules.texts.length; i++) {
        if (compiledRules.texts[i].test(snippet)) return true;
      }
    }

    for (let i = 0; i < compiledRules.conditionalRules.length; i++) {
      const ruleObj = compiledRules.conditionalRules[i];
      let conditionsMet = true;
      for (let j = 0; j < ruleObj.conditions.length; j++) {
        const cond = ruleObj.conditions[j];
        if (cond.type === 'title' && cond.op === '*=') {
          if (!title || !title.includes(cond.val)) {
            conditionsMet = false;
            break;
          }
        }
      }
      if (!conditionsMet) continue;

      if (ruleObj.type === 'domain') {
        let d2 = domain.toLowerCase();
        let matched = false;
        while (d2) {
          if (d2 === ruleObj.domain) {
            matched = true;
            break;
          }
          let dotIndex = d2.indexOf('.');
          if (dotIndex === -1) break;
          d2 = d2.substring(dotIndex + 1);
        }
        if (matched) return true;
      } else if (ruleObj.type === 'url' || ruleObj.type === 'regex') {
        if (ruleObj.regex.test(url) || ruleObj.regex.test(domain)) return true;
      } else if (ruleObj.type === 'title' && title) {
        if (ruleObj.regex.test(title)) return true;
      } else if (ruleObj.type === 'text' && snippet) {
        if (ruleObj.regex.test(snippet)) return true;
      }
    }

    return false;
  }

  // 查找第一条命中规则
  function findFirstMatchingRule(url, domain, title, snippet) {
    for (const item of compiledRules.rulesList) {
      try {
        if (item.conditions && item.conditions.length > 0) {
          let conditionsMet = true;
          for (let j = 0; j < item.conditions.length; j++) {
            const cond = item.conditions[j];
            if (cond.type === 'title' && cond.op === '*=') {
              if (!title || !title.includes(cond.val)) {
                conditionsMet = false;
                break;
              }
            }
          }
          if (!conditionsMet) continue;
        }

        if (item.type === 'domain') {
          let d = domain.toLowerCase();
          while (d) {
            if (d === item.domain) {
              return {
                rule: item.originalRule,
                source: item.source
              };
            }
            const dot = d.indexOf('.');
            if (dot === -1) break;
            d = d.substring(dot + 1);
          }
        } else if (item.type === 'url' || item.type === 'regex') {
          if (item.regex.test(url) || item.regex.test(domain)) {
            return {
              rule: item.originalRule,
              source: item.source
            };
          }
        } else if (item.type === 'title' && title) {
          if (item.regex.test(title)) {
            return {
              rule: item.originalRule,
              source: item.source
            };
          }
        } else if (item.type === 'text' && snippet) {
          if (item.regex.test(snippet)) {
            return {
              rule: item.originalRule,
              source: item.source
            };
          }
        }
      } catch (e) {}
    }
    return null;
  }

  // 正文选择器
  function getResultSnippet(result, engine) {
    const selectors = SELECTORS.snippets[engine] || SELECTORS.snippets.bing;
    for (let selector of selectors) {
      const elem = result.querySelector(selector);
      if (elem && elem.textContent) return elem.textContent.trim();
    }
    return '';
  }

  // 处理正文规则
  function checkTextRule(rule, snippet) {
    if (!snippet) return false;
    let remaining = rule.substring(5);
    let pattern, flags = '';
    const lastSlashIndex = remaining.lastIndexOf('/');
    if (lastSlashIndex !== -1 && lastSlashIndex < remaining.length - 1) {
      const possibleFlags = remaining.substring(lastSlashIndex + 1);
      if (/^[ims]+$/i.test(possibleFlags)) {
        flags = possibleFlags.toLowerCase();
        pattern = remaining.substring(0, lastSlashIndex);
      } else {
        pattern = remaining;
      }
    } else {
      pattern = remaining;
    }
    if (!flags && remaining.endsWith('/')) pattern = remaining.slice(0, -1);
    if (!flags) {
      const oldFlagMatch = pattern.match(/^\(\?([ims]+)\)/);
      if (oldFlagMatch) {
        flags = oldFlagMatch[1];
        pattern = pattern.substring(oldFlagMatch[0].length);
      }
    }
    if (flags.includes('s')) {
      pattern = pattern.replace(/\./g, '[\\s\\S]');
      flags = flags.replace('s', '');
    }
    try {
      const regex = new RegExp(pattern, flags);
      return regex.test(snippet);
    } catch (e) {
      const simplePattern = pattern.replace(/^\(\?[ims]+\)/, '');
      return flags.includes('i') ? snippet.toLowerCase().includes(simplePattern.toLowerCase()) : snippet.includes(simplePattern);
    }
  }

  // 函数匹配
  function checkRuleMatch(rule, url, domain, title, snippet) {
    if (rule.startsWith('/') && rule.lastIndexOf('/') > 0) {
      try {
        const {
          pattern,
          flags
        } = ruleToRegex(rule);
        const regex = new RegExp(pattern, flags);
        return regex.test(url);
      } catch (e) {
        return false;
      }
    }

    if (rule.startsWith('text/')) {
      return checkTextRule(rule, snippet);
    }

    if (rule.startsWith('title/')) {
      try {
        const {
          pattern,
          flags
        } = ruleToRegex(rule);
        if (!title || title.trim() === '') return false;
        const regex = new RegExp(pattern, flags);
        return regex.test(title);
      } catch (e) {
        try {
          const simplePattern = rule.substring(6).replace(/^\(\?[ims]+\)/, '');
          return rule.includes('(?i)') || rule.includes('(?i)') ? title.toLowerCase().includes(simplePattern.toLowerCase()) : title.includes(simplePattern);
        } catch (e2) {
          return false;
        }
      }
    }

    // URL匹配
    try {
      const {
        pattern,
        flags
      } = ruleToRegex(rule);
      const regex = new RegExp(pattern, flags);
      const fullMatch = regex.test(url);
      const domainMatch = regex.test(domain);
      return fullMatch || domainMatch;
    } catch (e) {
      try {
        const simpleRule = rule.replace('*://', '').replace(/\*/g, '');
        return url.includes(simpleRule) || domain.includes(simpleRule);
      } catch (e2) {
        return false;
      }
    }
  }

  // 规则过滤
  function filterValidRuleLines(lines) {
    return lines
      .map(line => line.trim())
      .filter(line => line.length > 0);
  }

  // 选择器链接
  function getResultLink(result, engine) {
    const linkSelectors = SELECTORS.links[engine];
    if (Array.isArray(linkSelectors)) {
      for (let selector of linkSelectors) {
        const el = result.querySelector(selector);
        if (el && el.href) return el;
      }
    } else if (typeof linkSelectors === 'string') {
      return result.querySelector(linkSelectors);
    }
    return result.querySelector('a[href]');
  }

  // 标题选择器
  function getResultTitle(result, engine) {
    const selectors = SELECTORS.titles[engine] || SELECTORS.titles.google;
    for (let selector of selectors) {
      const elem = result.querySelector(selector);
      if (elem && elem.textContent) return elem.textContent.trim();
    }
    return '';
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
    const title = getResultTitle(result, engine);
    if (!title) return;
    if (result.querySelector('.searchfilter-quick-block')) return;

    const isBlocked = result.getAttribute('data-is-blocked') === 'true';
    const btn = document.createElement('div');
    btn.className = 'searchfilter-quick-block';

    // 切换屏蔽按钮颜色
    const iconColor = isBlocked ? '#3182ce' : 'currentColor';
    btn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="${iconColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>`;
    btn.title = isBlocked ? t('unblockBtnTitle') : t('blockBtnTitle');

    if (window.getComputedStyle(result).position === 'static') result.style.position = 'relative';
    if (engine === 'bing') {
      btn.style.right = '5px';
      btn.style.top = '10px';
    } else {
      btn.style.right = '35px';
      btn.style.top = '10px';
    }

    btn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();

      // 移除规则
      if (isBlocked) {
        let baseDomain = domain.replace(/^www\./, '');
        let ruleRemoved = false;

        const possibleRules = [
          `${domain}/*`,
          `www.${baseDomain}/*`,
          `*.${baseDomain}/*`,
          domain,
          baseDomain
        ];

        const newRules = currentConfig.rules.filter(rule => {
          const cleanRule = rule.replace(/^\*:\/\//, '');
          const matched = possibleRules.includes(cleanRule);
          if (matched) ruleRemoved = true;
          return !matched;
        });

        if (ruleRemoved) {
          currentConfig.rules = newRules;
          GM_setValue(CONFIG_KEY, currentConfig);
          GM_setValue(LOCAL_LAST_MODIFIED_KEY, Date.now());
          const textarea = document.getElementById('searchfilter-rules');
          if (textarea) {
            textarea.value = currentConfig.rules.join('\n');
            updateLineNumbers();
          }
          forceReprocessAll();
        }
        return;
      }

      // 添加规则
      let newRule = '';
      const isIP = /^(\d{1,3}\.){3}\d{1,3}$/.test(domain);

      if (isIP) {
        newRule = `*://${domain}`;
      } else {
        const baseDomain = domain.startsWith('www.') ? domain.substring(4) : domain;
        if (currentConfig.blockDomain) {
          newRule = `*://*.${baseDomain}/*`;
        } else {
          newRule = `*://${domain}/*`;
        }
      }

      if (currentConfig.blockConfirm) {
        if (!confirm(t('confirmBlock', {
            rule: newRule
          }))) return;
      }

      // 避免重复
      if (!currentConfig.rules.includes(newRule)) {
        currentConfig.rules.push(newRule);
        GM_setValue(CONFIG_KEY, currentConfig);
        GM_setValue(LOCAL_LAST_MODIFIED_KEY, Date.now());
        const textarea = document.getElementById('searchfilter-rules');
        if (textarea) {
          textarea.value = currentConfig.rules.join('\n');
          updateLineNumbers();
        }
        forceReprocessAll();
      } else {
        result.style.display = 'none';
        result.setAttribute('data-is-blocked', 'true');
        const totalBlocked = document.querySelectorAll('[data-is-blocked="true"]').length;
        updateStatus(totalBlocked);
      }
    };
    result.appendChild(btn);
  }

  // 添加匹配规则标签
  function addMatchedRuleLabel(result) {
    if (!result.dataset.matchedRule) return;
    let existing = result.querySelector('.searchfilter-matched-rule');
    if (existing) existing.remove();
    const label = document.createElement('div');
    label.className = 'searchfilter-matched-rule';
    const sourceText = result.dataset.matchedSource || t('matchedRule');
    const ruleText = result.dataset.matchedRule;
    label.textContent = `${sourceText}：${ruleText}`;
    label.title = `${sourceText}：${ruleText}`;
    if (window.getComputedStyle(result).position === 'static') result.style.position = 'relative';
    result.appendChild(label);
  }

  // 视口观察器
  const resultObserver = new IntersectionObserver((entries, observer) => {
    let newlyBlocked = 0;
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const result = entry.target;
        const blocked = processSingleResult(result);
        if (blocked) newlyBlocked++;
        observer.unobserve(result);
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

  // 防重复检查
  function processSingleResult(result) {
    if (result.hasAttribute('data-blocker-processed')) {
      return result.getAttribute('data-is-blocked') === 'true';
    }

    if (!currentConfig.enabled) return false;

    const engine = getSearchEngine();
    const link = getResultLink(result, engine);
    if (!link || !link.href) return false;

    const url = link.href;
    let domain = '';
    try {
      domain = new URL(url).hostname;
    } catch (e) {}

    const title = getResultTitle(result, engine);
    const snippet = getResultSnippet(result, engine);

    const shouldBlock = checkRuleMatchOptimized(url, domain, title, snippet);

    if (shouldBlock) {
      result.style.display = showHiddenResults ? '' : 'none';
      result.setAttribute('data-blocker-processed', 'true');
      result.setAttribute('data-is-blocked', 'true');
      const match = findFirstMatchingRule(url, domain, title, snippet);
      if (match) {
        result.dataset.matchedRule = match.rule;
        result.dataset.matchedSource = match.source;
      }
      if (showHiddenResults) {
        result.classList.add('searchfilter-blocked-visible');
        if (currentConfig.showBlockBtn) injectBlockButton(result, engine, url, domain);
        addMatchedRuleLabel(result);
      }
      return true;
    } else {
      result.setAttribute('data-blocker-processed', 'true');
      if (currentConfig.showBlockBtn) injectBlockButton(result, engine, url, domain);
      return false;
    }
  }

  // 增量扫描
  function scanNewResults() {
    if (!currentConfig.enabled) {
      document.querySelectorAll('[data-blocker-processed], [data-observed]').forEach(result => {
        resultObserver.unobserve(result);
        result.style.display = '';
        result.removeAttribute('data-blocker-processed');
        result.removeAttribute('data-is-blocked');
        result.removeAttribute('data-observed');
        result.classList.remove('searchfilter-blocked-visible');
        const label = result.querySelector('.searchfilter-matched-rule');
        if (label) label.remove();
      });
      showHiddenResults = false;
      updateStatus(0);
      return;
    }

    const engine = getSearchEngine();
    const selector = getContainerSelector(engine);
    const newResults = document.querySelectorAll(`${selector}:not([data-observed])`);

    newResults.forEach(result => {
      result.setAttribute('data-observed', 'true');
      resultObserver.observe(result);
    });
  }

  // 更新悬浮球
  function forceReprocessAll() {
    buildRuleIndex();

    const engine = getSearchEngine();
    const selector = getContainerSelector(engine);

    document.querySelectorAll('[data-observed]').forEach(el => {
      resultObserver.unobserve(el);
      el.removeAttribute('data-observed');
      el.removeAttribute('data-blocker-processed');
      el.removeAttribute('data-is-blocked');
      el.classList.remove('searchfilter-blocked-visible');
      el.style.display = '';
      const label = el.querySelector('.searchfilter-matched-rule');
      if (label) label.remove();
    });
    document.querySelectorAll('.searchfilter-quick-block').forEach(btn => btn.remove());

    const allResults = document.querySelectorAll(selector);
    let totalBlocked = 0;

    allResults.forEach(result => {
      result.setAttribute('data-observed', 'true');
      const blocked = processSingleResult(result);
      if (blocked) totalBlocked++;
    });

    updateStatus(totalBlocked);
  }

  // 悬浮球样式
  function applyBubbleStyle(element) {
    element.style.cssText = `
            position: fixed;
            background: transparent;
            color: #333;
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
  function applyBubbleSize(element) {
    let fontSize, padding, lineHeight;
    switch (currentConfig.bubbleSize) {
      case 'medium':
        fontSize = '18px';
        padding = '5px 5px';
        lineHeight = '1.3';
        break;
      case 'large':
        fontSize = '20px';
        padding = '5px 5px';
        lineHeight = '1.4';
        break;
      case 'larger':
        fontSize = '22px';
        padding = '5px 5px';
        lineHeight = '1.5';
        break;
      case 'xlarge':
        fontSize = '26px';
        padding = '5px 5px';
        lineHeight = '1.6';
        break;
      default:
        fontSize = '20px';
        padding = '5px 5px';
        lineHeight = '1.4';
    }
    element.style.fontSize = fontSize;
    element.style.padding = padding;
    element.style.lineHeight = lineHeight;
  }

  // 悬浮球内容
  function updateBubbleContent(statusBtn, blocked) {
    const isLeft = currentConfig.bubbleState ? currentConfig.bubbleState.isLeftHalf : false;
    const isToggleMode = currentConfig.bubbleAction === 'toggleHidden';

    const icon = isToggleMode ? '⭕' : '🚫';

    if (currentConfig.showCount) {
      if (isLeft) {
        statusBtn.innerHTML = `${icon} <span class="bubble-number">${blocked}</span>`;
      } else {
        statusBtn.innerHTML = `<span class="bubble-number">${blocked}</span> ${icon}`;
      }
    } else {
      statusBtn.innerHTML = icon;
    }

    if (isToggleMode) {
      statusBtn.title = showHiddenResults ? t('bubbleTitleHide') : t('bubbleTitleShow');
    } else {
      statusBtn.title = t('bubbleTitlePanel');
    }

    statusBtn.style.color = '';
  }

  // 拖动与边缘吸附
  function updateStatus(blocked) {
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
          GM_setValue(CONFIG_KEY, currentConfig);
          updateBubbleContent(status, parseInt(status.dataset.blockedCount || 0));
        } else {
          if (currentConfig.bubbleState) {
            status.style.top = currentConfig.bubbleState.top || 'auto';
            status.style.left = currentConfig.bubbleState.left || 'auto';
            status.style.right = currentConfig.bubbleState.right || 'auto';
            status.style.bottom = 'auto';
          }

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

      status.onmouseover = () => {
        status.style.opacity = '1';
        status.style.textShadow = '0 0 8px rgba(255,255,255,0.5)';
      };
      status.onmouseout = () => {
        status.style.opacity = '0.8';
        status.style.textShadow = '';
      };
      document.body.appendChild(status);

      if (currentConfig.bubbleState) {
        status.style.top = currentConfig.bubbleState.top || 'auto';
        status.style.left = currentConfig.bubbleState.left || 'auto';
        status.style.right = currentConfig.bubbleState.right || 'auto';
        status.style.bottom = 'auto';
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
        el.classList.add('searchfilter-blocked-visible');
        const engine = getSearchEngine();
        const link = getResultLink(el, engine);
        if (link && link.href && currentConfig.showBlockBtn) {
          let domain = '';
          try {
            domain = new URL(link.href).hostname;
          } catch (e) {}
          if (!el.querySelector('.searchfilter-quick-block')) {
            injectBlockButton(el, engine, link.href, domain);
          }
        }
        addMatchedRuleLabel(el);
      } else {
        el.classList.remove('searchfilter-blocked-visible');
        const label = el.querySelector('.searchfilter-matched-rule');
        if (label) label.remove();
      }
    });
    const status = document.getElementById('searchfilter-status');
    if (status) {
      updateBubbleContent(status, parseInt(status.dataset.blockedCount || 0));
    }
  }

  function createOptionButtons(name, value, options) {
    const buttons = options.map(option => {
      const active = currentConfig[name] === option.value;
      return `<button type="button" class="option-button ${active ? 'active' : ''}" data-value="${option.value}" data-name="${name}">${option.label}</button>`;
    }).join('');
    return `<div class="option-buttons">${buttons}</div>`;
  }

  // 行号与语法检查
  const validationCache = new Map();

  function cachedValidateRule(rule) {
    if (validationCache.has(rule)) return validationCache.get(rule);
    const result = validateRule(rule);
    validationCache.set(rule, result);
    return result;
  }

  let lineUpdateRaf = null;

  function updateLineNumbersIncremental() {
    const textarea = document.getElementById('searchfilter-rules');
    const lineNums = document.getElementById('searchfilter-line-numbers');
    if (!textarea || !lineNums) return;

    const lines = textarea.value.split('\n');
    const children = lineNums.children;

    if (Math.abs(lines.length - children.length) > 50) {
      validationCache.clear();
      let html = '';
      for (let i = 0; i < lines.length; i++) {
        const rule = lines[i];
        const isValid = cachedValidateRule(rule);
        const warnIcon = isValid ? '' : `<span style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); font-size: 10px; cursor: help; background: #edf2f7; z-index: 1;" title="${t('syntaxError')}">⚠️</span>`;
        html += `<div style="position: relative; color: #a0aec0;">${i + 1}${warnIcon}</div>`;
      }
      lineNums.innerHTML = html;
      return;
    }

    while (children.length > lines.length) {
      lineNums.removeChild(lineNums.lastChild);
    }
    while (children.length < lines.length) {
      const div = document.createElement('div');
      div.style.position = 'relative';
      div.style.color = '#a0aec0';
      lineNums.appendChild(div);
    }

    for (let i = 0; i < lines.length; i++) {
      const rule = lines[i];
      const isValid = cachedValidateRule(rule);
      const warnIcon = isValid ? '' : `<span style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); font-size: 10px; cursor: help; background: #edf2f7; z-index: 1;" title="${t('syntaxError')}">⚠️</span>`;
      children[i].innerHTML = `${i + 1}${warnIcon}`;
    }
  }

  function scheduleLineNumbersUpdate() {
    if (lineUpdateRaf) cancelAnimationFrame(lineUpdateRaf);
    lineUpdateRaf = requestAnimationFrame(() => {
      updateLineNumbersIncremental();
      lineUpdateRaf = null;
    });
  }

  function updateLineNumbers() {
    scheduleLineNumbersUpdate();
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

  function updateStatsContent() {
    const statsContent = document.getElementById('searchfilter-stats-content');
    if (!statsContent) return;

    const textarea = document.getElementById('searchfilter-rules');
    const rulesText = textarea ? textarea.value : currentConfig.rules.join('\n');
    const rawLines = rulesText.split('\n');
    const localRules = filterValidRuleLines(rawLines);
    const activeRules = localRules.filter(rule => !rule.startsWith('#'));

    // 静态语法检查
    const ruleErrors = {};
    activeRules.forEach(rule => {
      if (!cachedValidateRule(rule)) {
        ruleErrors[rule] = ['Invalid syntax'];
      }
    });

    // 规则统计
    const whitelistRules = activeRules
      .filter(rule => rule.startsWith('@') && !rule.toLowerCase().startsWith('@if'))
      .map(rule => rule.substring(1).trim());

    const compoundRules = activeRules.filter(rule => /@if\s*\(/i.test(rule));

    const engine = getSearchEngine();
    const selector = getContainerSelector(engine);
    const results = document.querySelectorAll(selector);
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

    // 错误信息
    const ruleErrorsArray = Object.entries(ruleErrors).map(([rule, errors]) => ({
      rule,
      errors
    }));
    let resultHTML = '';

    if (ruleErrorsArray.length > 0) {
      resultHTML += `<div style="color: #c53030; background: #fff5f5; padding: 8px; border-radius: 4px; margin-bottom: 12px;"><strong>⚠️ ${t('statsErrors', {count: ruleErrorsArray.length})}</strong><br>`;
      ruleErrorsArray.forEach(item => {
        resultHTML += `<div style="margin: 4px 0; font-size: 11px;"><div style="color: #2d3748;"><strong>${t('statsRule')}</strong>${item.rule}</div><div style="color: #c53030;"><strong>${t('statsError')}</strong>${item.errors.join(', ')}</div></div>`;
      });
      resultHTML += '</div>';
    }

    // 匹配规则统计
    const sourceOrder = [`${t('subscription')}1`, `${t('subscription')}2`, `${t('subscription')}3`, t('localRule')];
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
        if (/@if\s*\(/i.test(rule)) {
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
        resultHTML += `<div style="font-size: 12px; color: #2d3748; word-break: break-all; font-family: 'Consolas', monospace;">${rule}</div>`;
        resultHTML += `</div>`;
      });

      resultHTML += `</div>`;
    });

    if (!hasMatches && ruleErrorsArray.length === 0) {
      resultHTML = `<div style="color: #38a169; padding: 10px; border-radius: 4px; font-size: 12px; background: #f0fff4; text-align: center;">${t('noMatch')}</div>`;
    }

    // 白名单列表
    if (whitelistRules.length > 0) {
      resultHTML += `<div style="margin-top: 12px; padding-top: 8px; border-top: 1px solid #e2e8f0;"><strong style="color: #2d3748;">${t('whitelistRules')} (${whitelistRules.length})</strong><br>`;
      whitelistRules.forEach(rule => {
        resultHTML += `<div style="font-size: 11px; color: #4a5568; word-break: break-all; font-family: 'Consolas', monospace;">@${rule}</div>`;
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

  // 面板显示
  function showConfigPanel() {
    const existingPanel = document.getElementById('searchfilter-panel');
    if (existingPanel) {
      existingPanel.remove();
      return;
    }

    const panel = document.createElement('div');
    panel.id = 'searchfilter-panel';
    panel.classList.add('searchfilter-panel-fade');

    const statusBtn = document.getElementById('searchfilter-status');
    panel.style.cssText = `
        position: fixed;
        ${getPanelPositionStyles()}
        width: 320px;
        z-index: 10001;
        padding: 15px;
        display: flex;
        flex-direction: column;
    `;

    const sizeOptions = [{
      value: 'medium',
      label: t('sizeMedium')
    }, {
      value: 'large',
      label: t('sizeLarge')
    }, {
      value: 'larger',
      label: t('sizeLarger')
    }, {
      value: 'xlarge',
      label: t('sizeXLarge')
    }];

    panel.innerHTML = `
            <div style="display: flex; gap: 8px; margin-top: 0px; margin-bottom: 8px;">
                <label style="display: flex; align-items: center; flex: 1; justify-content: flex-start; white-space: nowrap;">
                    <input type="checkbox" id="searchfilter-enabled" ${currentConfig.enabled ? 'checked' : ''} style="margin-right: 4px;">
                    <span>${t('enableBlock')}</span>
                </label>
                <label style="display: flex; align-items: center; flex: 1; justify-content: center; white-space: nowrap;">
                    <input type="checkbox" id="searchfilter-show-count" ${currentConfig.showCount ? 'checked' : ''} style="margin-right: 4px;">
                    <span>${t('showCount')}</span>
                </label>
                <label style="display: flex; align-items: center; flex: 1; justify-content: flex-end; white-space: nowrap;">
                    <input type="checkbox" id="searchfilter-debug" ${currentConfig.debug ? 'checked' : ''} style="margin-right: 4px;">
                    <span>${t('debugMode')}</span>
                </label>
            </div>
            
            <div style="display: flex; gap: 8px; margin-bottom: 12px;">
                <label style="display: flex; align-items: center; flex: 1; justify-content: flex-start; white-space: nowrap;">
                    <input type="checkbox" id="searchfilter-show-block-btn" ${currentConfig.showBlockBtn ? 'checked' : ''} style="margin-right: 4px;">
                    <span>${t('oneClickBlock')}</span>
                </label>
                <label style="display: flex; align-items: center; flex: 1; justify-content: center; white-space: nowrap;">
                    <input type="checkbox" id="searchfilter-block-domain" ${currentConfig.blockDomain ? 'checked' : ''} style="margin-right: 4px;">
                    <span>${t('blockDomain')}</span>
                </label>
                <label style="display: flex; align-items: center; flex: 1; justify-content: flex-end; white-space: nowrap;">
                    <input type="checkbox" id="searchfilter-block-confirm" ${currentConfig.blockConfirm ? 'checked' : ''} style="margin-right: 4px;">
                    <span>${t('doubleConfirm')}</span>
                </label>
            </div>
            
            <div class="option-row">
                <span class="option-label">${t('bubbleSize')}</span>
                ${createOptionButtons('bubbleSize', currentConfig.bubbleSize, sizeOptions)}
            </div>
            
            <div style="margin-bottom: 0px;">
                <div class="compact-row">
                    <span style="font-size: 12px; color: #4a5568;">${t('blockRules')}</span>
                    <div style="display: flex; gap: 4px;">
                        <button id="searchfilter-subscribe" class="searchfilter-button searchfilter-button-secondary" style="padding: 3px 8px; border: 1px solid transparent;" title="${t('subscribe')}">${t('subscribe')}</button>
                        <button id="searchfilter-sync" class="searchfilter-button searchfilter-button-success" style="padding: 3px 8px; border: 1px solid transparent;" title="${t('sync')}">${t('sync')}</button>
                        <button id="searchfilter-import-file" class="searchfilter-button searchfilter-button-secondary" style="padding: 3px 8px; border: 1px solid transparent;" title="${t('import')}">${t('import')}</button>
                        <button id="searchfilter-export-file" class="searchfilter-button searchfilter-button-success" style="padding: 3px 8px; border: 1px solid transparent;" title="${t('export')}">${t('export')}</button>
                    </div>
                </div>
                <div class="rules-container">
                    <div id="searchfilter-line-numbers"></div>
                    <textarea id="searchfilter-rules" placeholder="${t('placeholder')}" wrap="off">${currentConfig.rules.join('\n')}</textarea>
                    <div id="searchfilter-scroll-top" class="searchfilter-scroll-btn" style="top: 2px;" title="${t('scrollTop')}">⬆️</div>
                    <div id="searchfilter-scroll-bottom" class="searchfilter-scroll-btn" style="bottom: 1px;" title="${t('scrollBottom')}">⬇️</div>
                </div>
                <div style="font-size: 10px; color: #718096; margin-top: 3px; text-align: left;">
                ${t('ruleHint')}<br>
                </div>
            </div>
            
            <div style="display: flex; gap: 6px; margin-top: 8px;" id="searchfilter-panel-footer">
                <button id="searchfilter-save" class="searchfilter-button searchfilter-button-primary action-button" style="flex: 2;">${t('save')}</button>
                <button id="searchfilter-test" class="searchfilter-button searchfilter-button-secondary action-button" style="flex: 1;">${t('test')}</button>
                <button id="searchfilter-close" class="searchfilter-button searchfilter-button-danger action-button" style="flex: 1;">${t('close')}</button>
            </div>
            
            <div id="searchfilter-stats-panel">
                <div id="searchfilter-stats-content"></div>
            </div>
        `;

    document.body.appendChild(panel);
    requestAnimationFrame(() => panel.classList.add('show'));

    updateLineNumbers();

    const textarea = document.getElementById('searchfilter-rules');
    const lineNums = document.getElementById('searchfilter-line-numbers');

    textarea.addEventListener('input', scheduleLineNumbersUpdate);
    textarea.addEventListener('scroll', () => {
      lineNums.scrollTop = textarea.scrollTop;
    });

    const closePanel = () => {
      panel.classList.remove('show');
      panel.addEventListener('transitionend', () => {
        panel.remove();
        document.removeEventListener('click', window._panelCloseHandler);
        window._panelCloseHandler = null;

        currentConfig = GM_getValue(CONFIG_KEY, currentConfig);
        const statusBtn = document.getElementById('searchfilter-status');
        if (statusBtn) applyBubbleSize(statusBtn);
      }, {
        once: true
      });
    };

    document.getElementById('searchfilter-save').onclick = () => {
      hideStatsPanel();
      saveConfig();
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

    document.getElementById('searchfilter-scroll-top').onclick = () => textarea.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
    document.getElementById('searchfilter-scroll-bottom').onclick = () => textarea.scrollTo({
      top: textarea.scrollHeight,
      behavior: 'smooth'
    });

    panel.querySelectorAll('.option-button').forEach(button => {
      button.addEventListener('click', function() {
        const name = this.dataset.name;
        const value = this.dataset.value;
        currentConfig[name] = value;
        const buttons = panel.querySelectorAll(`[data-name="${name}"]`);
        buttons.forEach(btn => btn.classList.toggle('active', btn.dataset.value === value));

        if (name === 'bubbleSize') {
          const statusBtn = document.getElementById('searchfilter-status');
          if (statusBtn) applyBubbleSize(statusBtn);
        }
      });
    });

    const closeHandler = (e) => {
      if (preventPanelClose) return;
      if (!panel.contains(e.target) && !e.target.closest('#searchfilter-status') && !e.target.closest('#searchfilter-webdav-panel') && !e.target.closest('#searchfilter-subscription-panel')) {
        closePanel();
      }
    };
    window._panelCloseHandler = closeHandler;
    setTimeout(() => document.addEventListener('click', closeHandler), 200);
  }

  // 保存配置
  function saveConfig() {
    const panel = document.getElementById('searchfilter-panel');
    const rulesText = document.getElementById('searchfilter-rules').value;
    const enabled = document.getElementById('searchfilter-enabled').checked;
    const showCount = document.getElementById('searchfilter-show-count').checked;
    const debug = document.getElementById('searchfilter-debug').checked;
    const showBlockBtn = document.getElementById('searchfilter-show-block-btn').checked;
    const blockDomain = document.getElementById('searchfilter-block-domain').checked;
    const blockConfirm = document.getElementById('searchfilter-block-confirm').checked;

    const rawLines = rulesText.split('\n');
    currentConfig.rules = filterValidRuleLines(rawLines);
    currentConfig.enabled = enabled;
    currentConfig.showCount = showCount;
    currentConfig.debug = debug;
    currentConfig.showBlockBtn = showBlockBtn;
    currentConfig.blockDomain = blockDomain;
    currentConfig.blockConfirm = blockConfirm;

    GM_setValue(CONFIG_KEY, currentConfig);
    GM_setValue(LOCAL_LAST_MODIFIED_KEY, Date.now());

    const existingStatus = document.getElementById('searchfilter-status');
    if (existingStatus) existingStatus.remove();
    showHiddenResults = false;
    forceReprocessAll();

    if (panel) {
      panel.classList.remove('show');
      panel.addEventListener('transitionend', function onTransitionEnd() {
        panel.remove();
        if (window._panelCloseHandler) {
          document.removeEventListener('click', window._panelCloseHandler);
          window._panelCloseHandler = null;
        }
        panel.removeEventListener('transitionend', onTransitionEnd);
      }, {
        once: true
      });
    }
  }

  // 订阅管理
  async function performSubscriptionForUrl(url, showAlerts = true) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const content = await response.text();

    const lines = content.split('\n').map(line => line.trim());
    const validRules = [];

    for (let line of lines) {
      if (line.length === 0) continue;
      if (line.startsWith('!')) continue;
      if (line.startsWith('[') && line.endsWith(']')) continue;
      if (line.includes('##') || line.startsWith('#@#') || line.startsWith('@@')) continue;
      if (line.startsWith('#')) continue;

      if (validateRule(line)) {
        validRules.push(line);
      } else if (currentConfig.debug) {
        console.warn('[订阅] 无效规则已跳过:', line);
      }
    }

    let subs = getSubscriptions();
    const existingIndex = subs.findIndex(s => s.url === url);
    const subData = {
      url,
      enabled: true,
      lastUpdate: Date.now(),
      rules: validRules
    };

    if (existingIndex >= 0) subs[existingIndex] = subData;
    else subs.push(subData);
    saveSubscriptions(subs);

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
      existing.remove();
      return;
    }

    const panel = document.createElement('div');
    panel.id = 'searchfilter-subscription-panel';
    panel.classList.add('searchfilter-panel-fade');
    panel.style.cssText = `
        position: fixed;
        ${getPanelPositionStyles()}
        width: 320px;
        z-index: 10001;
        padding: 20px;
        display: flex;
        flex-direction: column;
    `;

    let subscriptions = getSubscriptions();
    if (!subscriptions) subscriptions = [];

    let rowsHtml = '';
    subscriptions.forEach((sub, index) => {
      rowsHtml += `<div class="subscription-row" data-index="${index}">
                <div class="subscription-input-row">
                    <input type="text" class="subscription-url" placeholder="https://example.com/rules.txt" value="${sub.url || ''}">
                    <button class="delete-subscription-btn" title="${t('delete')}" data-index="${index}">❌</button>
                </div>
                <div class="subscription-status-message"></div>
            </div>`;
    });

    panel.innerHTML = `
            <h3 style="margin:0 0 16px;font-size:16px;color:#2d3748;">${t('panelTitle')}</h3>
            <div id="subscription-rows-container">${rowsHtml}</div>
            <div class="add-subscription-btn"><button id="add-subscription" class="searchfilter-button searchfilter-button-secondary" style="width:100%;" ${subscriptions.length >= 3 ? 'disabled' : ''}>${t('addSubscription')}</button></div>
            <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:0px;"><button id="subscription-save" class="searchfilter-button searchfilter-button-primary" style="flex:1;">${t('saveSub')}</button><button id="subscription-import" class="searchfilter-button searchfilter-button-primary" style="flex:1;">${t('importSub')}</button><button id="subscription-cancel" class="searchfilter-button searchfilter-button-secondary" style="flex:1;">${t('cancel')}</button></div>
            <div id="subscription-status" style="margin-top:0px;font-size:12px;color:#4a5568;min-height:0px;"></div>
        `;

    document.body.appendChild(panel);
    requestAnimationFrame(() => panel.classList.add('show'));

    const container = document.getElementById('subscription-rows-container');
    const addBtn = document.getElementById('add-subscription');
    const statusDiv = document.getElementById('subscription-status');

    function setStatus(msg, isError = false) {
      statusDiv.textContent = msg;
      statusDiv.style.color = isError ? '#c53030' : '#4a5568';
    }

    function updateAddButtonState() {
      addBtn.disabled = container.querySelectorAll('.subscription-row').length >= 3;
    }

    addBtn.onclick = () => {
      if (container.querySelectorAll('.subscription-row').length >= 3) {
        setStatus(t('maxSubscriptions'), true);
        return;
      }
      const newRow = document.createElement('div');
      newRow.className = 'subscription-row';
      newRow.innerHTML = `<div class="subscription-input-row"><input type="text" class="subscription-url" placeholder="https://example.com/rules.txt" value=""><button class="delete-subscription-btn" title="${t('delete')}">❌</button></div><div class="subscription-status-message"></div>`;
      container.appendChild(newRow);
      updateAddButtonState();
      bindDeleteEvents();
    };

    function bindDeleteEvents() {
      container.querySelectorAll('.delete-subscription-btn').forEach(btn => {
        btn.onclick = (e) => {
          e.stopPropagation();
          btn.closest('.subscription-row').remove();
          updateAddButtonState();
        };
      });
    }
    bindDeleteEvents();

    const closePanel = () => {
      panel.classList.remove('show');
      panel.addEventListener('transitionend', () => {
        panel.remove();
        document.removeEventListener('click', closeHandler);
      }, {
        once: true
      });
    };

    document.getElementById('subscription-save').onclick = () => {
      const rows = container.querySelectorAll('.subscription-row');
      const newSubs = [];
      rows.forEach(row => {
        const input = row.querySelector('.subscription-url');
        const url = input.value.trim();
        if (url) {
          const existingSub = subscriptions.find(s => s.url === url);
          newSubs.push({
            url,
            enabled: true,
            lastUpdate: existingSub ? existingSub.lastUpdate : 0,
            rules: existingSub ? existingSub.rules : []
          });
        }
      });
      saveSubscriptions(newSubs);
      setStatus(t('subscriptionSaved'));
      subscriptions = newSubs;
      forceReprocessAll();
    };

    document.getElementById('subscription-import').onclick = async () => {
      const rows = container.querySelectorAll('.subscription-row');
      if (rows.length === 0) {
        setStatus(t('subLinkEmpty'), true);
        return;
      }
      setStatus(t('importing'));
      for (let row of rows) {
        const input = row.querySelector('.subscription-url');
        const url = input.value.trim();
        const msgDiv = row.querySelector('.subscription-status-message');
        if (!url) {
          msgDiv.textContent = t('subLinkEmpty');
          msgDiv.className = 'subscription-status-message error';
          continue;
        }
        try {
          const result = await performSubscriptionForUrl(url, false);
          msgDiv.textContent = t('subImportSuccess', {
            count: result.count
          });
          msgDiv.className = 'subscription-status-message success';
        } catch (err) {
          console.error(`导入失败 [${url}]:`, err);
          msgDiv.textContent = t('subImportFailed');
          msgDiv.className = 'subscription-status-message error';
        }
      }
      setStatus(t('importDone'));
      forceReprocessAll();
    };

    document.getElementById('subscription-cancel').onclick = (e) => {
      e.stopPropagation();
      closePanel();
    };

    const closeHandler = (e) => {
      if (!panel.contains(e.target)) closePanel();
    };
    setTimeout(() => document.addEventListener('click', closeHandler), 200);
  }

  function showWebDAVPanel() {
    hideStatsPanel();
    const existing = document.getElementById('searchfilter-webdav-panel');
    if (existing) {
      existing.remove();
      return;
    }

    const webdavConfig = GM_getValue(WEBDAV_KEY, {
      url: '',
      username: '',
      password: '',
      filename: 'rules.txt'
    });

    const panel = document.createElement('div');
    panel.id = 'searchfilter-webdav-panel';
    panel.classList.add('searchfilter-panel-fade');
    panel.style.cssText = `
        position: fixed;
        ${getPanelPositionStyles()}
        width: 320px;
        z-index: 10001;
        padding: 20px;
        display: flex;
        flex-direction: column;
    `;

    panel.innerHTML = `
            <h3 style="margin:0 0 10px;font-size:16px;color:#2d3748;">${t('webdavTitle')}</h3>
            <div style="margin-bottom:5px;"><label>${t('webdavUrl')}</label><input id="webdav-url" type="text" placeholder="https://example.com/remote.php/dav/files/user/" value="${webdavConfig.url}"></div>
            <div style="margin-bottom:5px;"><label>${t('webdavUser')}</label><input id="webdav-username" type="text" value="${webdavConfig.username}"></div>
            <div style="margin-bottom:5px;"><label>${t('webdavPass')}</label><input id="webdav-password" type="password" value="${webdavConfig.password}"></div>
            <div style="margin-bottom:5px;"><label>${t('filename')}</label><input id="webdav-filename" type="text" placeholder="rules.txt" value="${webdavConfig.filename}"></div>
            <div style="display:flex;gap:8px;justify-content:flex-end;"><button id="webdav-upload" class="searchfilter-button searchfilter-button-success" style="flex:1;">${t('upload')}</button><button id="webdav-download" class="searchfilter-button searchfilter-button-primary" style="flex:1;">${t('download')}</button><button id="webdav-cancel" class="searchfilter-button searchfilter-button-secondary" style="flex:1;">${t('cancel')}</button></div>
            <div id="webdav-status" style="margin-top:0px;font-size:12px;color:#4a5568;min-height:0px;"></div>
        `;

    document.body.appendChild(panel);
    requestAnimationFrame(() => panel.classList.add('show'));

    const urlInput = document.getElementById('webdav-url');
    const usernameInput = document.getElementById('webdav-username');
    const passwordInput = document.getElementById('webdav-password');
    const filenameInput = document.getElementById('webdav-filename');
    const statusDiv = document.getElementById('webdav-status');

    function setStatus(msg, isError = false) {
      statusDiv.textContent = msg;
      statusDiv.style.color = isError ? '#c53030' : '#4a5568';
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

    const closePanel = () => {
      panel.classList.remove('show');
      panel.addEventListener('transitionend', () => {
        panel.remove();
        document.removeEventListener('click', closeHandler);
      }, {
        once: true
      });
    };

    document.getElementById('webdav-upload').onclick = async () => {
      const url = urlInput.value.trim();
      if (!url) {
        setStatus(t('webdavUrlEmpty'), true);
        return;
      }
      if (!url.toLowerCase().startsWith('https://')) {
        alert(t('webdavHttpsRequired'));
        return;
      }
      const config = saveWebDAVConfig();
      const textarea = document.getElementById('searchfilter-rules');
      const content = textarea ? textarea.value : currentConfig.rules.join('\n');
      setStatus(t('webdavUploading'));
      try {
        const fullUrl = config.url.replace(/\/$/, '') + '/' + config.filename;
        const headers = {};
        if (config.username) headers['Authorization'] = 'Basic ' + btoa(`${config.username}:${config.password}`);
        await new Promise((resolve, reject) => {
          GM_xmlhttpRequest({
            method: 'PUT',
            url: fullUrl,
            headers,
            data: content,
            onload: (resp) => {
              if (resp.status >= 200 && resp.status < 300) resolve(resp);
              else reject(new Error(`HTTP ${resp.status}`));
            },
            onerror: (err) => reject(new Error(t('networkError'))),
            ontimeout: () => reject(new Error(t('requestTimeout')))
          });
        });
        setStatus(t('uploadSuccess'));
      } catch (err) {
        setStatus(t('webdavUploadFailed') + err.message, true);
      }
    };

    document.getElementById('webdav-download').onclick = async () => {
      const url = urlInput.value.trim();
      if (!url) {
        setStatus(t('webdavUrlEmpty'), true);
        return;
      }
      if (!url.toLowerCase().startsWith('https://')) {
        alert(t('webdavHttpsRequired'));
        return;
      }
      const config = saveWebDAVConfig();
      setStatus(t('webdavDownloading'));
      try {
        await performWebDAVDownload(config, true, setStatus);
        setStatus(t('downloadSuccess'));
      } catch (err) {
        setStatus(t('webdavDownloadFailed') + err.message, true);
      }
    };

    document.getElementById('webdav-cancel').onclick = (e) => {
      e.stopPropagation();
      closePanel();
    };

    const closeHandler = (e) => {
      if (!panel.contains(e.target)) closePanel();
    };
    setTimeout(() => document.addEventListener('click', closeHandler), 200);
  }

  async function performWebDAVDownload(config, showAlerts = true, statusCallback = null) {
    const fullUrl = config.url.replace(/\/$/, '') + '/' + config.filename;
    const headers = {};
    if (config.username) headers['Authorization'] = 'Basic ' + btoa(`${config.username}:${config.password}`);
    const resp = await new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET',
        url: fullUrl,
        headers,
        onload: (resp) => {
          if (resp.status >= 200 && resp.status < 300) resolve(resp);
          else reject(new Error(`HTTP ${resp.status}`));
        },
        onerror: () => reject(new Error(t('networkError'))),
        ontimeout: () => reject(new Error(t('requestTimeout')))
      });
    });
    const content = resp.responseText;
    const newRules = content.split('\n').map(r => r.trim()).filter(r => r);
    const textarea = document.getElementById('searchfilter-rules');
    if (textarea) {
      textarea.value = newRules.join('\n');
      updateLineNumbers();
    } else {
      currentConfig.rules = newRules;
      GM_setValue(CONFIG_KEY, currentConfig);
      GM_setValue(LOCAL_LAST_MODIFIED_KEY, Date.now());
      forceReprocessAll();
    }
    GM_setValue(WEBDAV_LAST_SYNC_KEY, Date.now());
  }

  // 去重合并同步
  async function performAutoWebDAVSync(config) {
    const fullUrl = config.url.replace(/\/$/, '') + '/' + config.filename;
    const headers = {};
    if (config.username) headers['Authorization'] = 'Basic ' + btoa(`${config.username}:${config.password}`);

    const resp = await new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET',
        url: fullUrl,
        headers,
        onload: (r) => {
          if (r.status >= 200 && r.status < 300) resolve(r);
          else if (r.status === 404) resolve(r);
          else reject(new Error(`HTTP ${r.status}`));
        },
        onerror: () => reject(new Error(t('networkError'))),
        ontimeout: () => reject(new Error(t('requestTimeout')))
      });
    });

    let cloudRules = [];
    let cloudTime = 0;
    if (resp.status !== 404) {
      const content = resp.responseText;
      cloudRules = content.split('\n').map(r => r.trim()).filter(r => r);
      const lastModMatch = resp.responseHeaders.match(/last-modified:\s*(.*)/i);
      if (lastModMatch) cloudTime = Date.parse(lastModMatch[1]);
      if (isNaN(cloudTime)) cloudTime = 0;
    }

    const localTime = GM_getValue(LOCAL_LAST_MODIFIED_KEY, 0);
    const localRules = currentConfig.rules || [];
    const mergedRules = [...new Set([...localRules, ...cloudRules])];

    if (localTime > cloudTime) {
      console.log('[自动 WebDAV] 本地规则较新，合并后上传...');
      await new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
          method: 'PUT',
          url: fullUrl,
          headers,
          data: mergedRules.join('\n'),
          onload: (r) => {
            if (r.status >= 200 && r.status < 300) resolve(r);
            else reject(new Error(`HTTP ${r.status}`));
          },
          onerror: reject
        });
      });
    }
    currentConfig.rules = mergedRules;
    GM_setValue(CONFIG_KEY, currentConfig);
    forceReprocessAll();
    GM_setValue(WEBDAV_LAST_SYNC_KEY, Date.now());
  }

  function checkAutoWebDAV() {
    const config = GM_getValue(WEBDAV_KEY);
    if (!config || !config.url) return;
    const lastSync = GM_getValue(WEBDAV_LAST_SYNC_KEY, 0);
    if (Date.now() - lastSync < 60 * 60 * 1000) return;
    if (document.getElementById('searchfilter-panel')) return;
    performAutoWebDAVSync(config).catch(err => console.error('[自动 WebDAV] 同步失败:', err.message));
  }

  // 从TXT导入规则
  function importRulesFromFile() {
    preventPanelClose = true;
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.txt,text/plain';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);
    fileInput.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) {
        document.body.removeChild(fileInput);
        preventPanelClose = false;
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const textarea = document.getElementById('searchfilter-rules');
        if (textarea) {
          textarea.value = event.target.result;
          updateLineNumbers();
        }
        document.body.removeChild(fileInput);
        preventPanelClose = false;
      };
      reader.readAsText(file, 'UTF-8');
    };
    fileInput.click();
  }

  // 导出规则到TXT
  function exportRulesToFile() {
    preventPanelClose = true;
    const textarea = document.getElementById('searchfilter-rules');
    const content = textarea.value;
    if (!content.trim()) {
      alert(t('noRulesExport'));
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
  function registerMenu() {
    GM_registerMenuCommand(t('menuOpenPanel'), () => showConfigPanel());
    GM_registerMenuCommand((currentConfig.enabled ? "🟢 " : "🔴 ") + t('menuEnable') + (currentConfig.enabled ? `：${t('stateEnabled')}` : `：${t('stateDisabled')}`), () => {
      currentConfig.enabled = !currentConfig.enabled;
      GM_setValue(CONFIG_KEY, currentConfig);
      location.reload();
    });
    GM_registerMenuCommand((currentConfig.blockConfirm ? "🟢 " : "🔴 ") + t('menuConfirm') + (currentConfig.blockConfirm ? `：${t('stateEnabled')}` : `：${t('stateDisabled')}`), () => {
      currentConfig.blockConfirm = !currentConfig.blockConfirm;
      GM_setValue(CONFIG_KEY, currentConfig);
      location.reload();
    });
    GM_registerMenuCommand((currentConfig.panelCentered ? "🟢 " : "🔴 ") + t('menuCenter') + (currentConfig.panelCentered ? `：${t('stateEnabled')}` : `：${t('stateDisabled')}`), () => {
      currentConfig.panelCentered = !currentConfig.panelCentered;
      GM_setValue(CONFIG_KEY, currentConfig);
      location.reload();
    });
    GM_registerMenuCommand((currentConfig.showBubble ? "🟢 " : "🔴 ") + t('menuBubble') + (currentConfig.showBubble ? `：${t('menuBubbleStateShow')}` : `：${t('menuBubbleStateHide')}`), () => {
      currentConfig.showBubble = !currentConfig.showBubble;
      GM_setValue(CONFIG_KEY, currentConfig);
      location.reload();
    });
    GM_registerMenuCommand((currentConfig.bubbleAction === 'openPanel' ? "🟢 " : "🔵 ") + t('menuBubbleAction') + (currentConfig.bubbleAction === 'openPanel' ? `：${t('menuBubbleActionOpen')}` : `：${t('menuBubbleActionToggle')}`), () => {
      currentConfig.bubbleAction = currentConfig.bubbleAction === 'openPanel' ? 'toggleHidden' : 'openPanel';
      GM_setValue(CONFIG_KEY, currentConfig);
      location.reload();
    });
    const langDisplay = currentConfig.language === 'zh-CN' ? t('menuLang') : t('menuLangEn');
    GM_registerMenuCommand((currentConfig.language === 'zh-CN' ? '🟢 ' : '🔵 ') + langDisplay, () => {
      currentConfig.language = currentConfig.language === 'zh-CN' ? 'en' : 'zh-CN';
      GM_setValue(CONFIG_KEY, currentConfig);
      location.reload();
    });
  }

  // 初始化
  function checkAutoSubscription() {
    const subs = getSubscriptions();
    if (!subs || subs.length === 0) return;
    const now = Date.now();
    subs.filter(s => s.enabled).forEach(async sub => {
      if (now - sub.lastUpdate < 24 * 60 * 60 * 1000) return;
      console.log(`[自动订阅] 开始更新: ${sub.url}`);
      try {
        await performSubscriptionForUrl(sub.url, false);
      } catch (err) {
        console.error(`[自动订阅] 失败: ${sub.url}`, err.message);
      }
    });
  }

  function init() {
    migrateSubscriptions();
    registerMenu();
    buildRuleIndex();
    updateStatus(0);
    scanNewResults();

    const domObserver = new MutationObserver((mutations) => {
      if (mutations.some(m => m.addedNodes.length > 0)) requestAnimationFrame(() => scanNewResults());
    });
    domObserver.observe(document.body, {
      childList: true,
      subtree: true
    });

    const searchForm = document.querySelector('form[role="search"], form[name="search"], form[action*="search"]');
    if (searchForm) searchForm.addEventListener('submit', () => setTimeout(forceReprocessAll, 800));

    // 同步间隔
    setInterval(checkAutoSubscription, 60 * 60 * 1000);
    setInterval(checkAutoWebDAV, 60 * 60 * 1000);
    setTimeout(() => {
      checkAutoSubscription();
      checkAutoWebDAV();
    }, 5000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else setTimeout(init, 1000);
})();