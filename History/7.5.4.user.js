// ==UserScript==
// @name         搜索引擎结果屏蔽器
// @name:zh-CN   搜索引擎结果屏蔽器
// @name:en      Search Engine Result Hider
// @namespace    https://github.com/Carteahere
// @version      7.5.4
// @description        支持正则的搜索结果屏蔽工具。
// @description:zh-CN  支持正则的搜索结果屏蔽工具。
// @description:en     A search result blocking tool that supports regular expressions.
// @icon         data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjQgNCAxNiAxNiIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjMmM1MjgyIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgc3R5bGU9Im92ZXJmbG93OnZpc2libGUhaW1wb3J0YW50OyI+PGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iNyI+PC9jaXJjbGU+PGxpbmUgeDE9IjcuNDUiIHkxPSI3LjQ1IiB4Mj0iMTYuNTUiIHkyPSIxNi41NSI+PC9saW5lPjwvc3ZnPg==
// @author       南雪莲
// @homepageURL  https://greasyfork.org/zh-CN/scripts/552394
// @homepageURL  https://github.com/SadYuyuko/Search-Engine-Result-Hider
// @license      MIT
// @match        *://*.bing.com/*
// @match        *://*.brave.com/*
// @match        *://*.yahoo.com/*
// @match        *://*.google.com/*
// @match        *://*.yandex.com/*
// @match        *://*.duckduckgo.com/*
// @include      /^https?:\/\/([\w-]+\.)?brave\.com\/.*$/
// @include      /^https?:\/\/([\w-]+\.)?(?:duckduckgo\.com|ddg\.gg)\/.*$/
// @include      /^https?:\/\/([\w-]+\.)?bing\.(?:com|[a-z]{2}(?:\.[a-z]{2})?)\/.*$/
// @include      /^https?:\/\/([\w-]+\.)?yahoo\.(?:co\.jp|com|[a-z]{2}(?:\.[a-z]{2})?)\/.*$/
// @include      /^https?:\/\/([\w-]+\.)?google\.(?:com|[a-z]{2,3}(?:\.[a-z]{2})?|[a-z]{4,})\/.*$/
// @include      /^https?:\/\/(?:(?:[\w-]+\.)?yandex\.(?:com|[a-z]{2,3}(?:\.[a-z]{2})?|[a-z]{4})|(?:[\w-]+\.)?ya\.ru)\/.*$/
// @connect      dav.jianguoyun.com
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// ==/UserScript==

(function() {
  'use strict';

  let preventPanelClose = false;
  let yandexParentTimeouts = new Set();

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
  const HL_STATS_REGEX = /^@\d+/;

  // 默认配置
  let currentConfig = GM_getValue(CONFIG_KEY, {
    rules: ['*://*.csdn.net/*\n*://*.giffgaff.com/*\n*://*.example.com/*'],
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
  if (currentConfig.blockConfirm === undefined) currentConfig.blockConfirm = false;
  if (currentConfig.showBubble === undefined) currentConfig.showBubble = true;
  if (currentConfig.panelCentered === undefined) currentConfig.panelCentered = true;
  if (currentConfig.bubbleAction === undefined) currentConfig.bubbleAction = 'openPanel';
  if (currentConfig.language === undefined) currentConfig.language = 'zh-CN';
  if (currentConfig.highlightColors === undefined) currentConfig.highlightColors = {1:'#CE2029', 2:'#FF8C00', 3:'#FFD700', 4:'#228B22', 5:'#1E90FF'};
  if (currentConfig.subscriptionAutoUpdate === undefined) currentConfig.subscriptionAutoUpdate = false;
  if (currentConfig.errorDetection === undefined) currentConfig.errorDetection = true;
  let showHiddenResults = false;
  let _orGroupCounter = 0;

  // 选择器
  const SELECTORS = {
    bing: {
      containers: 'li.b_algo, div.b_algo',
      titles: ['h2 a', 'a h2', '.b_title'],
      snippets: ['.b_caption p', '.b_snippet', '.b_paractl p', '.b_lineclamp2'],
      links: 'a[href]',
    },
    google: {
      containers: 'div.g, div.MjjYud',
      titles: ['h3', 'div[role="heading"]', '.LC20lb', '.DKV0Md', '.sXLaOe', '.c9DxTc', 'a h3'],
      snippets: ['.st', '.VwiC3b', '.s3v9rd', '.IsZvec', '.lyLwlc', '.yXK7lf'],
      links: 'a[href]',
    },
    duckduckgo: {
      containers: '[data-testid="result"], .result, .web-result, .tile, .tile--ad',
      titles: ['a[data-testid="result-title-a"]', '.result__title', '.tile__title', '.tile--title__title', 'h2 a', 'a h2'],
      snippets: ['[data-testid="result-snippet"]', '[data-result="snippet"]', '.result__snippet'],
      links: ['a[data-testid="result-extras-url-link"]', 'a[data-testid="result-title-a"]', '.result__url', '.tile--title__domain', 'a[href]'],
    },
    yandex: {
      containers: 'div.Organic',
      titles: ['.OrganicTitle'],
      snippets: ['.OrganicText'],
      links: ['.OrganicTitle a', '.Path-Item a', 'a.Link', 'a[href]'],
    },
    brave: {
      containers: '.snippet[data-type="web"], .snippet[data-type="news"], .snippet[data-type="videos"], .image-wrapper',
      titles: ['.title', '.snippet-title', '.img-title'],
      snippets: ['.generic-snippet .content', '.generic-snippet', '.line-clamp-dynamic', '.snippet-description', '.description'],
      links: ['a[href]'],
    },
    yahoo: {
      containers: '.sw-Card.Algo, li.b_algo, div.b_algo, #web .algo, .algo-sr, .richAlgo',
      titles: ['h3', '.s-title', 'h2 a', 'a h2', '.b_title', '.title'],
      snippets: ['.sw-Card__description', '.sw-Card__snippet', '.sw-Text__body', 'p', '.b_caption p', '.b_snippet', '.b_paractl p'],
      links: ['h3 a', '.s-title', '.sw-Card__title a', 'a[data-ylk*="slk:title"]', 'a.ac-algo', 'a[data-y-link-id]'],
    },
    other: {
      containers: '',
    }
  };

  // 引擎检测
  function getSearchEngine() {
    const hostname = window.location.hostname;
    if (/(?:^|\.)bing\.(?:com|[a-z]{2}(?:\.[a-z]{2})?)$/.test(hostname)) return 'bing';
    if (/(?:^|\.)google\.(?:[a-z]{2,3}(?:\.[a-z]{2})?|[a-z]{4,})$/.test(hostname)) return 'google';
    if (/(?:^|\.)(?:duckduckgo\.com|ddg\.gg)$/.test(hostname)) return 'duckduckgo';
    if (/(?:^|\.)(?:ya\.ru|yandex\.(?:[a-z]{2,3}(?:\.[a-z]{2})?|[a-z]{4,}))$/.test(hostname)) return 'yandex';
    if (/(?:^|\.)brave\.com$/.test(hostname)) return 'brave';
    if (/(?:^|\.)yahoo\.(?:com|[a-z]{2}(?:\.[a-z]{2})?)$/i.test(hostname)) return 'yahoo';
    return 'other';
  }

  function getContainerSelector(engine) {
    return (SELECTORS[engine] || SELECTORS.other).containers;
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
      subImportSuccess: '导入成功，已导入 {count} 条规则',
      subImportFailed: '导入失败，请检查链接或网络状态',
      maxSubscriptions: '最多只能添加3条订阅',
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
      ifParenError: '@if(...) 括号未闭合',
      condUnknown: '无法识别的条件: {part}',
      condRegexError: '条件正则无效: {part}',
      regexError: '正则表达式无效',
      urlError: 'URL规则无效',
      slashWarning: '以 / 开头但未闭合，将按URL规则处理',
      ruleDuplicate: '重复了 {count} 次',
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
      subImportSuccess: 'Import success, {count} rules imported',
      subImportFailed: 'Import failed, check URL or network',
      maxSubscriptions: 'Maximum 3 subscriptions allowed',
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
      ifParenError: 'Unbalanced @if(...) parentheses',
      condUnknown: 'Unknown condition: {part}',
      condRegexError: 'Invalid condition regex: {part}',
      regexError: 'Invalid regex',
      urlError: 'Invalid URL rule',
      slashWarning: 'Starts with / but has no closing slash, treated as URL rule',
      ruleDuplicate: 'duplicated {count} times',
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

  // 规则处理
  function filterValidRuleLines(lines) {
    return lines
      .map(line => line.trim())
      .filter(line => line.length > 0);
  }

  function splitByPipe(str) {
    const parts = [];
    let current = '';
    let inSQ = false;
    let inDQ = false;
    let inRE = false;
    let depth = 0;

    for (let i = 0; i < str.length; i++) {
      const ch = str[i];

      if (ch === '\\' && i + 1 < str.length) {
        current += ch + str[++i];
        continue;
      }

      if (!inDQ && !inRE && ch === "'") { inSQ = !inSQ; current += ch; continue; }
      if (!inSQ && !inRE && ch === '"') { inDQ = !inDQ; current += ch; continue; }

      if (!inSQ && !inDQ && ch === '(') { depth++; current += ch; continue; }
      if (!inSQ && !inDQ && ch === ')') { depth--; current += ch; continue; }

      if (!inSQ && !inDQ && ch === '/' && !inRE) {
        const trimmed = current.replace(/\s+$/, '');
        if (!trimmed || trimmed.endsWith('=~') || trimmed.endsWith('~') || trimmed.endsWith('|') || trimmed.endsWith('(')) {
          inRE = true; current += ch; continue;
        }
      }
      if (!inSQ && !inDQ && ch === '/' && inRE) {
        inRE = false; current += ch; continue;
      }

      if (!inSQ && !inDQ && !inRE && depth === 0 && ch === '|') {
        parts.push(current);
        current = '';
        continue;
      }

      current += ch;
    }

    if (current) parts.push(current);
    return parts;
  }

  // 解析条件片段
  function parseConditionPart(trimmed, currentEngine, currentSite) {
    if (/^(google|bing|duckduckgo|yandex|brave|yahoo)$/i.test(trimmed)) {
      return { matched: true, static: currentEngine === trimmed.toLowerCase() };
    }

    let siteMatch = trimmed.match(/^site\s*[=:]\s*['"](.*?)['"]$/i);
    if (!siteMatch) siteMatch = trimmed.match(/^site\s*\(\s*['"](.*?)['"]\s*\)$/i);
    if (siteMatch) {
      return { matched: true, static: currentSite.endsWith(siteMatch[1].toLowerCase()) };
    }

    const titleMatch = trimmed.match(/^title\s*\*\=\s*['"](.*?)['"]$/i);
    if (titleMatch) {
      return { matched: true, dynamic: { type: 'title', op: '*=', val: titleMatch[1].toLowerCase() } };
    }

    const regexMatch = trimmed.match(/^title\s*=\~\s*\/((?:[^/\\]|\\.)*)\/([a-z]*)$/i);
    if (regexMatch) {
      return { matched: true, dynamic: { type: 'title', op: '=~', regex: new RegExp(regexMatch[1], regexMatch[2]) } };
    }

    return { matched: false };
  }

  function evaluateCondition(condStr, dynamicConditionsList) {
    const currentEngine = getSearchEngine();
    const currentSite = window.location.hostname;
    const parts = splitByPipe(condStr);

    if (parts.length === 1) {
      const parsed = parseConditionPart(parts[0].trim(), currentEngine, currentSite);
      if (!parsed.matched) return false;
      if (parsed.static !== undefined) return parsed.static;
      dynamicConditionsList.push(parsed.dynamic);
      return true;
    }

    const orGroup = ++_orGroupCounter;
    let anyStaticPass = false;
    const pendingDynamic = [];

    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;

      const parsed = parseConditionPart(trimmed, currentEngine, currentSite);
      if (!parsed.matched) continue;
      if (parsed.static !== undefined) {
        if (parsed.static) anyStaticPass = true;
        continue;
      }
      pendingDynamic.push(parsed.dynamic);
    }

    if (anyStaticPass) return true;

    if (pendingDynamic.length > 0) {
      for (const cond of pendingDynamic) {
        cond.orGroup = orGroup;
        dynamicConditionsList.push(cond);
      }
      return true;
    }

    return false;
  }

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

  // 剥离@if条件
  function stripIfConditions(ruleStr, evaluateCond) {
    let coreRule = ruleStr.trim();
    let staticPass = true;

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
          if (evaluateCond && !evaluateCond(cond)) staticPass = false;
        }
      }
    }

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

      if (evaluateCond && !evaluateCond(cond)) staticPass = false;
    }

    ranges.sort((a, b) => b.start - a.start);

    for (const r of ranges) {
      coreRule = coreRule.slice(0, r.start) + coreRule.slice(r.end);
    }

    coreRule = coreRule.replace(/\s{2,}/g, ' ').trim();

    if (coreRule.startsWith('{') && coreRule.endsWith('}') && coreRule.length > 1) {
      coreRule = coreRule.slice(1, -1).trim();
    }

    return {
      coreRule,
      staticPass
    };
  }

  function parseRuleWithConditions(ruleStr) {
    const dynamicConditions = [];
    const { coreRule, staticPass } = stripIfConditions(ruleStr, (cond) => evaluateCondition(cond, dynamicConditions));
    return {
      coreRule,
      staticPass,
      dynamicConditions
    };
  }

  // 处理@if条件
  function extractIfConditions(ruleStr) {
    const conds = [];
    const ifRegex = /@if\s*\(/gi;
    let match;
    while ((match = ifRegex.exec(ruleStr)) !== null) {
      const parenResult = extractBalancedParens(ruleStr, match.index + match[0].length - 1);
      if (parenResult) conds.push(parenResult.content.trim());
    }
    return conds;
  }

  // 校验@if条件语法
  function validateCondition(condStr) {
    const errors = [];
    const warnings = [];
    for (const part of splitByPipe(condStr)) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      if (/^(google|bing|duckduckgo|yandex|brave|yahoo)$/i.test(trimmed)) continue;
      if (/^site\s*[=:]\s*['"][^'"]*['"]$/i.test(trimmed)) continue;
      if (/^site\s*\(\s*['"][^'"]*['"]\s*\)$/i.test(trimmed)) continue;
      if (/^title\s*\*\=\s*['"][^'"]*['"]$/i.test(trimmed)) continue;
      const regexMatch = trimmed.match(/^title\s*=\~\s*\/((?:[^/\\]|\\.)*)\/([a-z]*)$/i);
      if (regexMatch) {
        try {
          new RegExp(regexMatch[1], regexMatch[2]);
        } catch (e) {
          errors.push(t('condRegexError', { part: trimmed }));
        }
        continue;
      }
      warnings.push(t('condUnknown', { part: trimmed }));
    }
    return { errors, warnings };
  }

  // 规则语法分析
  function analyzeRule(rule) {
    if (!rule || rule.trim() === '') return { valid: true, errors: [], warnings: [] };

    let ruleToCheck = rule.trim();
    const errors = [];
    const warnings = [];

    const hlValMatch = ruleToCheck.match(/^@(\d+)/);
    if (hlValMatch) {
      const N = parseInt(hlValMatch[1]);
      if (N < 1 || N > 5) {
        return { valid: false, errors: [t('hlColorError')], warnings };
      }
      ruleToCheck = ruleToCheck.substring(hlValMatch[0].length).trim();
      if (!ruleToCheck) return { valid: true, errors, warnings };
    }

    // @if条件语法检查
    if (!ruleToCheck.startsWith('/') && !ruleToCheck.startsWith('title/') && !ruleToCheck.startsWith('text/')) {
      if (/@if\s*\(/i.test(ruleToCheck)) {
        const ifRegex = /@if\s*\(/gi;
        let m;
        let unbalanced = false;
        while ((m = ifRegex.exec(ruleToCheck)) !== null) {
          const parenResult = extractBalancedParens(ruleToCheck, m.index + m[0].length - 1);
          if (!parenResult) { unbalanced = true; break; }
        }
        if (unbalanced) return { valid: false, errors: [t('ifParenError')], warnings };
        for (const cond of extractIfConditions(ruleToCheck)) {
          const r = validateCondition(cond);
          errors.push(...r.errors);
          warnings.push(...r.warnings);
        }
      }
    }

    const stripped = stripIfConditions(ruleToCheck);
    ruleToCheck = stripped.coreRule;

    // 白名单规则
    if (ruleToCheck.startsWith('@')) {
      ruleToCheck = ruleToCheck.substring(1).trim();
      if (!ruleToCheck) return { valid: true, errors, warnings };
    }

    // 未闭合正则提示
    if (ruleToCheck.startsWith('/') && ruleToCheck.lastIndexOf('/') === 0) {
      warnings.push(t('slashWarning'));
    }

    try {
      if (ruleToCheck.startsWith('/') && ruleToCheck.lastIndexOf('/') > 0) {
        const { pattern, flags } = ruleToRegex(ruleToCheck);
        new RegExp(pattern, flags);
      } else if (ruleToCheck.startsWith('text/') || ruleToCheck.startsWith('title/')) {
        const prefixLen = ruleToCheck.startsWith('title/') ? 6 : 5;
        const { pattern, flags } = parsePrefixedRegexRule(ruleToCheck, prefixLen);
        new RegExp(pattern, flags);
      } else {
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
    return { pattern, flags };
  }

  // URL通配符转正则
  function wildcardToRegex(pattern) {
    if (pattern.startsWith('*://')) pattern = pattern.substring(4);
    if (pattern.includes('/')) {
      const parts = pattern.split('/');
      return parts.map((part, index) => {
        if (index === 0) {
          return part.replace(/(?<!\\)\./g, '\\.').replace(/\*/g, '.*').replace(/\?/g, '\\?');
        } else {
          return part.replace(/\*/g, '.*').replace(/\?/g, '\\?');
        }
      }).join('\\/');
    } else {
      return pattern.replace(/(?<!\\)\./g, '\\.').replace(/\*/g, '.*').replace(/\?/g, '\\?');
    }
  }

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
    const wildcardMatch = pattern.match(/^\*:\/\/\*\.([^\/\*]+)\/\*$/);
    if (wildcardMatch) return { domain: wildcardMatch[1].toLowerCase(), domainType: 'wildcard' };
    const exactMatch = pattern.match(/^\*:\/\/([^\/\*]+)\/\*$/);
    if (exactMatch) return { domain: exactMatch[1].toLowerCase(), domainType: 'exact' };
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
    if (coreRule.startsWith('/') && coreRule.lastIndexOf('/') > 0) {
      const {pattern, flags} = ruleToRegex(coreRule);
        return {type: 'regex', regex: new RegExp(pattern, flags)};
    }
    if (coreRule.startsWith('title/')) {
      const {pattern, flags} = ruleToRegex(coreRule);
      return {type: 'title', regex: new RegExp(pattern, flags)};
    }
    if (coreRule.startsWith('text/')) {
      const {pattern, flags} = parsePrefixedRegexRule(coreRule, 5);
      return {type: 'text', regex: new RegExp(pattern, flags)};
    }
    const {pattern, flags} = ruleToRegex(coreRule);
    return {type: 'url', regex: new RegExp(pattern, flags)};
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

    const subRuleSets = subscriptions.map((sub, idx) => ({
      idx,
      set: (sub.enabled && sub.rules && sub.rules.length) ? new Set(sub.rules) : null
    }));

    function getRuleSource(rule) {
      for (const {idx, set} of subRuleSets) {
        if (set && set.has(rule)) return `${t('subscription')}${idx + 1}`;
      }
      return t('localRule');
    }

    allRules.forEach(rule => {

      // @N高亮规则
      const hlMatch = rule.trim().match(/^@(\d+)/);
      if (hlMatch) {
        const N = parseInt(hlMatch[1]);
        if (N < 1 || N > 5) return;
        let hlRule = rule.trim().substring(hlMatch[0].length).trim();
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

      const source = getRuleSource(rule);

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
          if (!compiledRules.whitelistDomains.has(simpleDomain.domain))
            compiledRules.whitelistDomains.set(simpleDomain.domain, []);
          compiledRules.whitelistDomains.get(simpleDomain.domain).push(simpleDomain.type);
        } else {
          const whitelistRule = coreRule.substring(1).trim();
          if (!whitelistRule) return;
          try {
            const compiled = compileRuleRegex(whitelistRule);
            if (compiled.type === 'title') {
              compiledRules.whitelistTitlePatterns.push(compiled.regex);
            } else if (compiled.type === 'text') {
              compiledRules.whitelistTextPatterns.push(compiled.regex);
            } else {
              compiledRules.whitelistUrlPatterns.push(compiled.regex);
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
        conditions: parsed.dynamicConditions
      };

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
            compiledRules.domains.get(dm.domain).push({type: dm.domainType, originalRule: rule, source});
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
          if (compiled.type === 'text') compiledRules.texts.push({regex: compiled.regex, originalRule: rule, source});
          else if (compiled.type === 'title') compiledRules.titles.push({regex: compiled.regex, originalRule: rule, source});
          else compiledRules.urls.push({regex: compiled.regex, originalRule: rule, source});
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

  function checkDynamicConditions(conditions, title) {
    const groups = new Map();
    const ungrouped = [];

    for (const cond of conditions) {
      if (cond.orGroup !== undefined) {
        if (!groups.has(cond.orGroup)) groups.set(cond.orGroup, []);
        groups.get(cond.orGroup).push(cond);
      } else {
        ungrouped.push(cond);
      }
    }

    for (const cond of ungrouped) {
      if (cond.type === 'title' && cond.op === '*=') {
        if (!title || !title.toLowerCase().includes(cond.val)) return false;
      } else if (cond.type === 'title' && cond.op === '=~') {
        if (!title || !cond.regex.test(title)) return false;
      }
    }

    const groupsArr = [];
    groups.forEach(v => groupsArr.push(v));
    for (let gi = 0; gi < groupsArr.length; gi++) {
      const conds = groupsArr[gi];
      let groupMatch = false;
      for (let ci = 0; ci < conds.length; ci++) {
        const cond = conds[ci];
        if (cond.type === 'title' && cond.op === '*=') {
          if (title && title.toLowerCase().includes(cond.val)) { groupMatch = true; break; }
        } else if (cond.type === 'title' && cond.op === '=~') {
          if (title && cond.regex.test(title)) { groupMatch = true; break; }
        }
      }
      if (!groupMatch) return false;
    }

    return true;
  }

  function getSubdomainLevels(domain) {
    const lower = domain.toLowerCase();
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
        if (regex.test(url) || regex.test(domain)) { highlightN = N; break; }
      }
    }
    if (!highlightN && title) {
      for (let {regex, N} of compiledRules.highlightTitles) {
        if (regex.test(title)) { highlightN = N; break; }
      }
    }
    if (!highlightN && snippet) {
      for (let {regex, N} of compiledRules.highlightTexts) {
        if (regex.test(snippet)) { highlightN = N; break; }
      }
    }
    if (!highlightN) {
      for (const level of subdomainLevels) {
        const rules = compiledRules.highlightConditionalDomains.get(level);
        if (rules) {
          for (const item of rules) {
            if (matchDomainEntryType(item.domainType, level, lowerDomain) && checkDynamicConditions(item.conditions, title)) {
              highlightN = item.N; break;
            }
          }
          if (highlightN) break;
        }
      }
    }
    if (!highlightN) {
      for (let item of compiledRules.highlightConditionalRules) {
        if (!checkDynamicConditions(item.conditions, title)) continue;
        if (item.type === 'url' || item.type === 'regex') {
          if (item.regex.test(url) || item.regex.test(domain)) { highlightN = item.N; break; }
        } else if (item.type === 'title' && title) {
          if (item.regex.test(title)) { highlightN = item.N; break; }
        } else if (item.type === 'text' && snippet) {
          if (item.regex.test(snippet)) { highlightN = item.N; break; }
        }
      }
    }

    for (const level of subdomainLevels) {
      const types = compiledRules.whitelistDomains.get(level);
      if (types) {
        for (const matchType of types) {
          if (matchDomainEntryType(matchType, level, lowerDomain)) { whitelisted = true; break; }
        }
        if (whitelisted) break;
      }
    }
    if (!whitelisted) {
      for (let i = 0; i < compiledRules.whitelistUrlPatterns.length; i++) {
        if (compiledRules.whitelistUrlPatterns[i].test(url) || compiledRules.whitelistUrlPatterns[i].test(domain)) {
          whitelisted = true; break;
        }
      }
    }
    if (!whitelisted && title) {
      for (let i = 0; i < compiledRules.whitelistTitlePatterns.length; i++) {
        if (compiledRules.whitelistTitlePatterns[i].test(title)) { whitelisted = true; break; }
      }
    }
    if (!whitelisted && snippet) {
      for (let i = 0; i < compiledRules.whitelistTextPatterns.length; i++) {
        if (compiledRules.whitelistTextPatterns[i].test(snippet)) { whitelisted = true; break; }
      }
    }

    if (!whitelisted) {
      for (const level of subdomainLevels) {
        const entries = compiledRules.domains.get(level);
        if (entries) {
          for (const dm of entries) {
            if (matchDomainEntryType(dm.type, level, lowerDomain)) { blockedInfo = {rule: dm.originalRule, source: dm.source}; break; }
          }
          if (blockedInfo) break;
        }
      }
      if (!blockedInfo) {
        for (let i = 0; i < compiledRules.urls.length; i++) {
          const item = compiledRules.urls[i];
          if (item.regex.test(url) || item.regex.test(domain)) { blockedInfo = {rule: item.originalRule, source: item.source}; break; }
        }
      }
      if (!blockedInfo && title) {
        for (let i = 0; i < compiledRules.titles.length; i++) {
          const item = compiledRules.titles[i];
          if (item.regex.test(title)) { blockedInfo = {rule: item.originalRule, source: item.source}; break; }
        }
      }
      if (!blockedInfo && snippet) {
        for (let i = 0; i < compiledRules.texts.length; i++) {
          const item = compiledRules.texts[i];
          if (item.regex.test(snippet)) { blockedInfo = {rule: item.originalRule, source: item.source}; break; }
        }
      }
      if (!blockedInfo) {
        for (const level of subdomainLevels) {
          const rules = compiledRules.conditionalDomains.get(level);
          if (rules) {
            for (const ruleObj of rules) {
              if (matchDomainEntryType(ruleObj.domainType, level, lowerDomain) && checkDynamicConditions(ruleObj.conditions, title)) {
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
          if (!checkDynamicConditions(ruleObj.conditions, title)) continue;
          if (ruleObj.type === 'url' || ruleObj.type === 'regex') {
            if (ruleObj.regex.test(url) || ruleObj.regex.test(domain)) { blockedInfo = {rule: ruleObj.originalRule, source: ruleObj.source}; break; }
          } else if (ruleObj.type === 'title' && title) {
            if (ruleObj.regex.test(title)) { blockedInfo = {rule: ruleObj.originalRule, source: ruleObj.source}; break; }
          } else if (ruleObj.type === 'text' && snippet) {
            if (ruleObj.regex.test(snippet)) { blockedInfo = {rule: ruleObj.originalRule, source: ruleObj.source}; break; }
          }
        }
      }
    }

    if (highlightN && blockedInfo) return {highlight: highlightN, blocked: true, rule: blockedInfo.rule, source: blockedInfo.source};
    if (highlightN) return {highlight: highlightN};
    if (blockedInfo) return {blocked: true, rule: blockedInfo.rule, source: blockedInfo.source};
    return false;
  }

  // 去除重定向
  function getCleanUrlAndFixDOM(link, engine) {
    if (!link || !link.href) return '';
    let url = link.href;
    if (engine === 'google') {
      try {
        const urlObj = new URL(url);
        if (urlObj.hostname.includes('google.') && urlObj.pathname === '/url') {
          const realUrl = urlObj.searchParams.get('q') || urlObj.searchParams.get('url');
          if (realUrl) {
            url = realUrl;
            link.href = realUrl;
          }
        }
      } catch (e) {}
    }
    if (engine === 'yahoo') {
      try {
        const urlObj = new URL(url);
        if (/^(?:r\.)?search\.yahoo\./.test(urlObj.hostname)) {
          const pathParts = urlObj.pathname.split('/');
          for (const part of pathParts) {
            if (part.startsWith('RU=')) {
              const encodedUrl = part.substring(3);
              try {
                const realUrl = decodeURIComponent(encodedUrl);
                if (realUrl && /^https?:\/\//i.test(realUrl)) {
                  url = realUrl;
                  link.href = realUrl;
                }
              } catch (_) {}
              break;
            }
          }
        }
      } catch (_) {}
    }
    return url;
  }

  // 提取链接
  function resolveUrlDomain(link, engine) {
    const url = getCleanUrlAndFixDOM(link, engine);
    let domain = '';
    try {
      domain = new URL(url).hostname;
    } catch (e) {}
    return { url, domain };
  }

  // 选择器适配
  function getResultText(result, selectors) {
    for (let selector of selectors) {
      const elem = result.querySelector(selector);
      if (elem && elem.textContent) return elem.textContent.trim();
    }
    return '';
  }

  function getResultSnippet(result, engine) {
    return getResultText(result, (SELECTORS[engine] || SELECTORS.bing).snippets);
  }

  function getResultLink(result, engine) {
    const linkSelectors = (SELECTORS[engine] || SELECTORS.google).links;
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

  function getResultTitle(result, engine) {
    return getResultText(result, (SELECTORS[engine] || SELECTORS.google).titles);
  }

  function ensurePositioned(el) {
    if (window.getComputedStyle(el).position === 'static') el.style.position = 'relative';
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

    btn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();

      // 移除规则
      if (isBlocked) {
        let ruleRemoved = false;
        const matchedRule = result.dataset.matchedRule;

        if (matchedRule && currentConfig.rules.includes(matchedRule)) {
          currentConfig.rules = currentConfig.rules.filter(rule => rule !== matchedRule);
          ruleRemoved = true;
        }

        if (!ruleRemoved) {
          let baseDomain = domain.replace(/^www\./, '');
          const possibleRules = [
            `*://${domain}/*`,
            `*://www.${baseDomain}/*`,
            `*://*.${baseDomain}/*`,
            `${domain}/*`,
            `www.${baseDomain}/*`,
            `*.${baseDomain}/*`,
            domain,
            baseDomain
          ];

          const newRules = currentConfig.rules.filter(rule => {
            const matched = possibleRules.includes(rule);
            if (matched) ruleRemoved = true;
            return !matched;
          });
          currentConfig.rules = newRules;
        }

        if (ruleRemoved) {
          persistConfig();
          syncRulesTextarea();
          forceReprocessAll();
        }
        return;
      }

      // 添加规则
      let newRule = '';
      const ipParts = domain.split('.');
      const isIP = ipParts.length === 4 && ipParts.every(p => {
        const n = parseInt(p, 10);
        return n >= 0 && n <= 255 && String(n) === p;
      });

      if (isIP) {
        newRule = `*://${domain}/*`;
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

      if (!currentConfig.rules.includes(newRule)) {
        currentConfig.rules.push(newRule);
        persistConfig();
        syncRulesTextarea();
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

    const { url, domain } = resolveUrlDomain(link, engine);

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

  // 增量扫描
  function scanNewResults() {
    if (!currentConfig.enabled) {
      document.querySelectorAll('[data-blocker-processed], [data-observed]').forEach(result => {
        resultObserver.unobserve(result);
        resetResultStyles(result);
        result.removeAttribute('data-observed');
      });
      showHiddenResults = false;
      return;
    }

    const engine = getSearchEngine();
    const selector = getContainerSelector(engine);

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

    const newResults = document.querySelectorAll(`${selector}:not([data-observed])`);

    if (currentConfig.debug) {
      console.log(`[屏蔽] 未处理的新结果数量: ${newResults.length}`);
    }

    newResults.forEach(result => {
      result.setAttribute('data-observed', 'true');
      resultObserver.observe(result);
    });
  }

  function forceReprocessAll() {
    yandexParentTimeouts.forEach(id => clearTimeout(id));
    yandexParentTimeouts.clear();
    buildRuleIndex();

    const engine = getSearchEngine();
    const selector = getContainerSelector(engine);

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

    const newResults = document.querySelectorAll(`${selector}:not([data-observed])`);
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
  GM_addStyle(`
        /* 预留翻页高度 */
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

        /* 规则栏行号 */
        #searchfilter-line-numbers {
            min-width: 20px;
            padding: 8px 4px 8px 2px;
            background: #edf2f7;
            border-right: 1px solid #e2e8f0;
            text-align: right;
            color: #a0aec0;
            font-family: 'Consolas', 'Monaco', monospace;
            font-size: 11px;
            line-height: 1.4;
            white-space: nowrap;
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

        /* 面板隔离 */
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

        #searchfilter-panel .rules-container {
            border-color: #4b5563 !important;
            background: #1E1F21 !important;
        }

        #searchfilter-line-numbers {
            background: #222629 !important;
            border-right-color: #4b5563 !important;
            color: #9ca3af !important;
        }

        #searchfilter-rules {
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

        #searchfilter-panel .searchfilter-button {
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
        #searchfilter-hlcolor-panel .searchfilter-button {
            height: 30px !important;
            padding: 0 12px !important;
            font-size: 13px !important;
            margin: 0 !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
        }
        
        #searchfilter-webdav-panel .searchfilter-button {
            flex: 1 !important;
        }

        /* Webdav订阅面板深色 */
        @media (prefers-color-scheme: dark) {
            #searchfilter-webdav-panel,
            #searchfilter-subscription-panel,
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
        .subscription-row {
            display: flex;
            flex-direction: column;
            gap: 4px;
            margin-bottom: 0;
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
            margin-top: 0;
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
          const { url, domain } = resolveUrlDomain(link, engine);
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

    const children = lineNums.children;
    while (children.length < len) {
      const div = document.createElement('div');
      div.style.position = 'relative';
      div.style.color = '#a0aec0';
      div.style.height = '1.4em';
      lineNums.appendChild(div);
    }

    // 分帧处理
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
      for (let i = index; i < end; i++) {
        const node = children[i];
        const analysis = currentConfig.errorDetection !== false ? cachedAnalyzeRule(lines[i]) : { valid: true, errors: [], warnings: [] };
        const valid = analysis.valid;
        const errMsg = valid ? '' : analysis.errors.join(' | ');
        const html = `${i + 1}${valid ? '' : `<span class="searchfilter-line-error" title="${escHtml(errMsg)}" data-error="${escHtml(errMsg)}" style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); font-size: 10px; background: #edf2f7; z-index: 1; cursor: pointer;">⚠️</span>`}`;
        if (node.dataset.v === html) continue;
        node.innerHTML = html;
        node.dataset.v = html;
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
  function persistConfig() {
    GM_setValue(CONFIG_KEY, currentConfig);
    GM_setValue(LOCAL_LAST_MODIFIED_KEY, Date.now());
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
      container.style.width = '';
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
    const activeRules = localRules.filter(rule => !rule.startsWith('#'));

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

    const whitelistRules = activeRules
      .filter(rule => rule.startsWith('@') && !rule.toLowerCase().startsWith('@if') && !HL_STATS_REGEX.test(rule))
      .map(rule => rule.substring(1).trim());

    const highlightRules = activeRules
      .filter(rule => HL_STATS_REGEX.test(rule));

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
        if (HL_STATS_REGEX.test(rule)) {
          ruleType = t('highlightRules');
        } else if (/@if\s*\(/i.test(rule)) {
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
        resultHTML += `<div style="font-size: 11px; color: #4a5568; word-break: break-all; font-family: 'Consolas', monospace;">@${escHtml(rule)}</div>`;
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
    panel.addEventListener('transitionend', () => {
      panel.remove();
      if (onClosed) onClosed();
    }, { once: true });
  }

  // 点击面板外关闭
  function bindOutsideClickClose(panel) {
    const closePanel = () => {
      fadeOutAndRemovePanel(panel, () => document.removeEventListener('click', closeHandler));
    };
    const closeHandler = (e) => {
      if (!panel.contains(e.target)) closePanel();
    };
    setTimeout(() => document.addEventListener('click', closeHandler), 200);
    return closePanel;
  }

  // 主面板样式
  function showConfigPanel() {
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
                    <div style="display: flex; gap: 4px;">
                        <button id="searchfilter-subscribe" class="searchfilter-button searchfilter-button-secondary" style="padding: 3px 8px; border: 1px solid transparent;">${t('subscription')}</button>
                        <button id="searchfilter-sync" class="searchfilter-button searchfilter-button-success" style="padding: 3px 8px; border: 1px solid transparent;">${t('sync')}</button>
                        <button id="searchfilter-import-file" class="searchfilter-button searchfilter-button-secondary" style="padding: 3px 8px; border: 1px solid transparent;">${t('import')}</button>
                        <button id="searchfilter-export-file" class="searchfilter-button searchfilter-button-success" style="padding: 3px 8px; border: 1px solid transparent;">${t('export')}</button>
                    </div>
                </div>
                <div class="rules-container">
                    <div id="searchfilter-line-numbers"></div>
                    <textarea id="searchfilter-rules" placeholder="${t('placeholder')}" wrap="off">${currentConfig.rules.join('\n')}</textarea>
                    <div id="searchfilter-scroll-top" class="searchfilter-scroll-btn" style="top: 2px;">⬆️</div>
                    <div id="searchfilter-scroll-bottom" class="searchfilter-scroll-btn" style="bottom: 1px;">⬇️</div>
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

    document.getElementById('searchfilter-scroll-top').onclick = () => textarea.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
    document.getElementById('searchfilter-scroll-bottom').onclick = () => textarea.scrollTo({
      top: textarea.scrollHeight,
      behavior: 'smooth'
    });

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
      { id: 'searchfilter-debug', key: 'debug', apply: null },
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
      if (!panel.contains(e.target) && !e.target.closest('#searchfilter-status') && !e.target.closest('#searchfilter-webdav-panel') && !e.target.closest('#searchfilter-subscription-panel') && !e.target.closest('#searchfilter-hlcolor-panel') && !e.target.closest('#searchfilter-hlcolor-popup')) {
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
    currentConfig.rules = filterValidRuleLines(rawLines);
    currentConfig.enabled = enabled;
    currentConfig.showCount = showCount;
    currentConfig.debug = debug;
    currentConfig.showBlockBtn = showBlockBtn;
    currentConfig.blockDomain = blockDomain;
    currentConfig.blockConfirm = blockConfirm;

    persistConfig();

    showHiddenResults = false;
    forceReprocessAll();

  }

  // 高亮面板
    function showHighlightColorPanel() {
      const existing = document.getElementById('searchfilter-hlcolor-panel');
      if (existing) {
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
    let rowsHtml = '';
    for (let i = 1; i <= 5; i++) {
      const hex = (colors[i] || '#CE2029').toUpperCase();
      rowsHtml += `<div class="hlcolor-row">
        <label>@${i}</label>
        <span class="hlcolor-preview" id="hlcolor-preview-${i}" style="background:${hex}"></span>
        <input type="text" id="hlcolor-input-${i}" value="${hex}" placeholder="#RRGGBB" maxlength="7">
      </div>`;
    }

    const defaultHex = (colors[1] || '#CE2029').toUpperCase();
    const [ir, ig, ib] = hexToRgb(defaultHex);
    let [currentHue, currentSat, currentVal] = rgbToHsv(ir, ig, ib);

    panel.innerHTML = `
      <h3 style="margin:0 0 3px;font-size:13px;color:#2d3748;font-weight:600;">${t('hlColorTitle')}</h3>
      <div style="display:flex;gap:2px;align-items:stretch;">
        <div id="hlcolor-left" style="flex:0 0 auto;display:flex;flex-direction:column;height:132px;">
          ${rowsHtml}
          <div style="display:flex;align-items:center;gap:4px;margin-top:1px;">
            <span style="min-width:20px;font-size:12px;color:#4a5568;font-weight:600;">🎨</span>
            <span id="hlcolor-current-preview" style="width:12px;height:12px;border-radius:2px;border:1px solid #e2e8f0;background:${defaultHex};flex-shrink:0;"></span>
            <span id="hlcolor-code-text" style="font-size:11px;font-family:'Consolas',monospace;padding:2px 4px;background:#f7fafc;border-radius:3px;border:1px solid #e2e8f0;width:70px;flex:none;text-align:center;">${defaultHex}</span>
          </div>
        </div>
        <div class="hlcolor-picker-wrapper" style="display:flex;gap:2px;align-items:stretch;flex-shrink:0;">
          <canvas id="hlcolor-sv-canvas"></canvas>
          <canvas id="hlcolor-hue-canvas" width="22"></canvas>
        </div>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:5px;">
        <button id="hlcolor-save" class="searchfilter-button searchfilter-button-primary" style="flex:1;">${t('save')}</button>
        <button id="hlcolor-reset" class="searchfilter-button searchfilter-button-secondary" style="flex:1;">${t('hlColorReset')}</button>
        <button id="hlcolor-cancel" class="searchfilter-button searchfilter-button-secondary" style="flex:1;">${t('cancel')}</button>
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
    let svDragging = false;

    function onSVMove(clientX, clientY) {
      const rect = svCanvas.getBoundingClientRect();
      const x = Math.max(0, Math.min(svCanvas.width, clientX - rect.left));
      const y = Math.max(0, Math.min(svCanvas.height, clientY - rect.top));
      currentSat = x / svCanvas.width;
      currentVal = 1 - y / svCanvas.height;
      updatePickedColor();
    }

    svCanvas.addEventListener('mousedown', (e) => { svDragging = true; onSVMove(e.clientX, e.clientY); });
    document.addEventListener('mousemove', (e) => { if (svDragging) onSVMove(e.clientX, e.clientY); });
    document.addEventListener('mouseup', () => { svDragging = false; });

    const hueCanvas = document.getElementById('hlcolor-hue-canvas');
    let hueDragging = false;

    function onHueMove(clientY) {
      const rect = hueCanvas.getBoundingClientRect();
      const y = Math.max(0, Math.min(hueCanvas.height, clientY - rect.top));
      currentHue = (y / hueCanvas.height) * 360;
      drawSVCanvas(currentHue);
      updatePickedColor();
    }

    hueCanvas.addEventListener('mousedown', (e) => { hueDragging = true; onHueMove(e.clientY); });
    document.addEventListener('mousemove', (e) => { if (hueDragging) onHueMove(e.clientY); });
    document.addEventListener('mouseup', () => { hueDragging = false; });

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
      buildRuleIndex();
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

  // 订阅管理
  function gmRequest(method, url, { headers, data, allow404 = false } = {}) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method,
        url,
        headers,
        data,
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
  function buildSyncPayload() {
    const { rules, bubbleState, bubbleSize, ...settings } = currentConfig;
    return {
      ...settings,
      subscriptions: getSubscriptions().map(s => ({ url: s.url, enabled: s.enabled, lastUpdate: s.lastUpdate })),
      syncedAt: Date.now()
    };
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

  // WebDAV请求
  function getWebDAVRequest(config) {
    const headers = {};
    if (config.username) headers['Authorization'] = 'Basic ' + btoa(`${config.username}:${config.password}`);
    return {
      fullUrl: config.url.replace(/\/$/, '') + '/' + config.filename,
      headers
    };
  }

  // 配置头上传
  function buildUploadContent(content) {
    return GM_getValue(WEBDAV_SYNC_CONFIG_KEY, false)
      ? '# ScriptConfig:' + JSON.stringify(buildSyncPayload()) + '\n' + content
      : content;
  }

  async function performSubscriptionForUrl(url, showAlerts = true) {
    const resp = await gmRequest('GET', url);
    const content = resp.responseText;

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

    const subs = getSubscriptions();
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

    // 订阅面板样式
    const panel = createPanel('searchfilter-subscription-panel', '320px', '20px');

    let subscriptions = getSubscriptions();

    let rowsHtml = '';
    subscriptions.forEach((sub, index) => {
      rowsHtml += `<div class="subscription-row" data-index="${index}">
                <div class="subscription-input-row">
                    <input type="text" class="subscription-url" placeholder="https://example.com/rules.txt" value="${sub.url || ''}">
                    <button class="delete-subscription-btn" data-index="${index}">❌</button>
                </div>
                <div class="subscription-status-message"></div>
            </div>`;
    });

    panel.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
                <h3 style="margin:0;font-size:16px;color:#2d3748;line-height:1;">${t('panelTitle')}</h3>
                <label style="display:flex !important;align-items:center;font-size:12px;color:#4a5568;cursor:pointer;margin:0;white-space:nowrap;line-height:1;">
                    <span class="searchfilter-switch">
                        <input type="checkbox" id="subscription-auto-update" ${currentConfig.subscriptionAutoUpdate ? 'checked' : ''}>
                        <span class="searchfilter-slider"></span>
                    </span>
                    <span style="line-height:1;">${t('autoUpdate')}</span>
                </label>
            </div>
            <div id="subscription-rows-container">${rowsHtml}</div>
            <div class="add-subscription-btn"><button id="add-subscription" class="searchfilter-button searchfilter-button-secondary" style="width:100%;" ${subscriptions.length >= 3 ? 'disabled' : ''}>${t('addSubscription')}</button></div>
            <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:0px;"><button id="subscription-save" class="searchfilter-button searchfilter-button-primary" style="flex:1;">${t('save')}</button><button id="subscription-import" class="searchfilter-button searchfilter-button-primary" style="flex:1;">${t('import')}</button><button id="subscription-cancel" class="searchfilter-button searchfilter-button-secondary" style="flex:1;">${t('cancel')}</button></div>
        `;

    const container = document.getElementById('subscription-rows-container');
    const addBtn = document.getElementById('add-subscription');
    const autoUpdateSwitch = document.getElementById('subscription-auto-update');
    if (autoUpdateSwitch) {
      autoUpdateSwitch.addEventListener('change', function() {
        currentConfig.subscriptionAutoUpdate = this.checked;
        persistConfig();
      });
    }

    function updateAddButtonState() {
      addBtn.disabled = container.querySelectorAll('.subscription-row').length >= 3;
    }

    addBtn.onclick = () => {
      if (container.querySelectorAll('.subscription-row').length >= 3) {
        showToast(t('maxSubscriptions'), 'error');
        return;
      }
      const newRow = document.createElement('div');
      newRow.className = 'subscription-row';
      newRow.innerHTML = `<div class="subscription-input-row"><input type="text" class="subscription-url" placeholder="https://example.com/rules.txt" value=""><button class="delete-subscription-btn">❌</button></div><div class="subscription-status-message"></div>`;
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

    const closePanel = bindOutsideClickClose(panel);

    document.getElementById('subscription-save').onclick = () => {
      const rows = container.querySelectorAll('.subscription-row');
      const newSubs = [];
      let hasError = false;
      rows.forEach(row => {
        const input = row.querySelector('.subscription-url');
        const url = input.value.trim();
        if (url) {
          if (!/^https?:\/\//i.test(url)) {
            const msgDiv = row.querySelector('.subscription-status-message');
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
            rules: existingSub ? existingSub.rules : []
          });
        }
      });
      if (hasError) return;
      saveSubscriptions(newSubs);
      showToast(t('saved'), 'success');
      subscriptions = newSubs;
      forceReprocessAll();
    };

    document.getElementById('subscription-import').onclick = async () => {
      const rows = container.querySelectorAll('.subscription-row');
      if (rows.length === 0) {
        showToast(t('subLinkEmpty'), 'error');
        return;
      }
      const loadingToast = showToast(t('importing'), 'info', 10000);
      let hasError = false;
      for (let row of rows) {
        const input = row.querySelector('.subscription-url');
        const url = input.value.trim();
        const msgDiv = row.querySelector('.subscription-status-message');
        if (!url) {
          msgDiv.textContent = t('subLinkEmpty');
          msgDiv.className = 'subscription-status-message error';
          hasError = true;
          continue;
        }
        if (!/^https?:\/\//i.test(url)) {
          msgDiv.textContent = t('subLinkInvalid');
          msgDiv.className = 'subscription-status-message error';
          hasError = true;
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
          hasError = true;
        }
      }
      loadingToast.dismiss();
      if (!hasError) {
        showToast(t('importDone'), 'success');
      }
      forceReprocessAll();
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
    <div class="webdav-row"><label>${t('webdavUrl')}</label><input id="webdav-url" type="text" placeholder="https://example.com/dav/files/" value="${webdavConfig.url}"></div>
    <div class="webdav-row"><label>${t('webdavUser')}</label><input id="webdav-username" type="text" value="${webdavConfig.username}"></div>
    <div class="webdav-row">
        <label>${t('webdavPass')}</label>
        <div style="position: relative; display: flex; align-items: center;">
            <input id="webdav-password" type="password" value="${webdavConfig.password}" style="padding-right: 35px !important;">
            <button id="webdav-toggle-password" type="button" style="position: absolute; right: 4px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; padding: 4px; font-size: 16px; line-height: 1; color: #718096; display: flex; align-items: center; justify-content: center; z-index: 1;">🐵</button>
        </div>
    </div>
    <div class="webdav-row"><label>${t('filename')}</label><input id="webdav-filename" type="text" placeholder="rules.txt" value="${webdavConfig.filename}"></div>
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
      let content = textarea ? textarea.value : currentConfig.rules.join('\n');
      content = buildUploadContent(content);
      const loadingToast = showToast(t('webdavUploading'), 'info', 10000);
      try {
        const { fullUrl, headers } = getWebDAVRequest(config);
        await gmRequest('PUT', fullUrl, { headers, data: content });
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
    const parsedHeader = parseSyncHeader(content);
    if (parsedHeader.config && GM_getValue(WEBDAV_SYNC_CONFIG_KEY, false)) {
      const { syncedAt, subscriptions, bubbleState, bubbleSize, ...settings } = parsedHeader.config;
      Object.assign(currentConfig, settings);
      GM_setValue(CONFIG_KEY, currentConfig);
      if (subscriptions) saveSubscriptions(subscriptions);
    }
    const newRules = parsedHeader.restLines.map(r => r.trim()).filter(r => r);
    const textarea = document.getElementById('searchfilter-rules');
    if (textarea) {
      textarea.value = newRules.join('\n');
      updateLineNumbers();
    } else {
      currentConfig.rules = newRules;
      persistConfig();
      forceReprocessAll();
    }
    GM_setValue(WEBDAV_LAST_SYNC_KEY, Date.now());
  }

  // 去重合并同步
  async function performAutoWebDAVSync(config) {
    const { fullUrl, headers } = getWebDAVRequest(config);

    const resp = await gmRequest('GET', fullUrl, { headers, allow404: true });

    let cloudRules = [];
    let cloudConfig = null;
    let cloudTime = 0;
    if (resp.status !== 404) {
      const content = resp.responseText;
      const parsedHeader = parseSyncHeader(content);
      if (parsedHeader.config && GM_getValue(WEBDAV_SYNC_CONFIG_KEY, false)) {
        cloudConfig = parsedHeader.config;
      }
      cloudRules = parsedHeader.restLines.map(r => r.trim()).filter(r => r);
      let headerTime = 0;
      if (parsedHeader.config && typeof parsedHeader.config.syncedAt === 'number') {
        headerTime = parsedHeader.config.syncedAt;
      }
      const lastModMatch = resp.responseHeaders.match(/last-modified:\s*(.*)/i);
      cloudTime = headerTime || (lastModMatch ? Date.parse(lastModMatch[1]) : 0);
      if (isNaN(cloudTime)) cloudTime = 0;
    }

    const localTime = GM_getValue(LOCAL_LAST_MODIFIED_KEY, 0);
    const localRules = currentConfig.rules || [];
    const mergedRules = [...new Set([...localRules, ...cloudRules])];

    if (localTime > cloudTime) {
      console.log('[自动 WebDAV] 本地规则较新，合并后上传...');
      const uploadData = buildUploadContent(mergedRules.join('\n'));
      await gmRequest('PUT', fullUrl, { headers, data: uploadData });
    }

    if (cloudConfig && GM_getValue(WEBDAV_SYNC_CONFIG_KEY, false)) {
      const { syncedAt, subscriptions, bubbleState, bubbleSize, ...settings } = cloudConfig;
      Object.assign(currentConfig, settings);
      if (subscriptions) saveSubscriptions(subscriptions);
    }

    currentConfig.rules = mergedRules;
    persistConfig();
    forceReprocessAll();
    GM_setValue(WEBDAV_LAST_SYNC_KEY, Date.now());
  }

  function checkAutoWebDAV() {
    if (!GM_getValue(WEBDAV_AUTO_SYNC_KEY, false)) return;
    const config = GM_getValue(WEBDAV_KEY);
    if (!config || !config.url) return;
    const lastSync = GM_getValue(WEBDAV_LAST_SYNC_KEY, 0);
    if (Date.now() - lastSync < 60 * 60 * 1000) return;
    if (document.getElementById('searchfilter-panel')) return;
    performAutoWebDAVSync(config).catch(err => console.error('[自动 WebDAV] 同步失败:', err.message));
  }

  // TXT导入
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
        let content = event.target.result;
        content = parseSyncHeader(content).restLines.join('\n');
        const textarea = document.getElementById('searchfilter-rules');
        if (textarea) {
          textarea.value = content;
          updateLineNumbers();
        }
        document.body.removeChild(fileInput);
        preventPanelClose = false;
      };
      reader.readAsText(file, 'UTF-8');
    };
    fileInput.click();
  }

  // TXT导出
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

  // 订阅
  function checkAutoSubscription() {
    if (!currentConfig.subscriptionAutoUpdate) return;
    const subs = getSubscriptions();
    if (!subs || subs.length === 0) return;
    const now = Date.now();
    const needUpdate = subs.filter(s => s.enabled && now - s.lastUpdate >= 24 * 60 * 60 * 1000);
    if (needUpdate.length === 0) return;
    (async () => {
      for (const sub of needUpdate) {
        console.log(`[订阅] 开始更新: ${sub.url}`);
        try {
          await performSubscriptionForUrl(sub.url, false);
        } catch (err) {
          console.error(`[订阅] 更新失败: ${sub.url}`, err.message);
        }
      }
      forceReprocessAll();
    })();
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