// ==UserScript==
// @name         搜索引擎结果屏蔽器
// @name:zh-CN   搜索引擎结果屏蔽器
// @name:en      Search Engine Result Hider
// @namespace    https://github.com/Carteahere
// @version      6.1.0
// @description        支持正则规则的Bing/Google/DuckDuckGo搜索结果屏蔽工具
// @description:zh-CN  支持正则规则的Bing/Google/DuckDuckGo搜索结果屏蔽工具
// @description:en     A search result blocking tool for Bing/Google/DuckDuckGo that supports regular expressions.
// @icon         data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAMAAACdt4HsAAACSVBMVEUAAAAdAAAhAAA5AAA9AABSAANBAABPAABaAASzAAJpAABMAANOAANJAAJoAANaAgRLAARcAANhAANNAAZkAwVLAAZlAANHAAV7AAJmAANaAANIAAVVAARwBwljAARRAAZvAANXAAVtAANNAAXhAAC+AACWCwx4AQRgAANsAANNAAVPAAZrAAOPEhNpAANmAANZAAVRAAVVAAZbAQVoAANNAAVXAAbPAACMCgxyAARgAAWbAAKkGRltAAJOAAWXAAFkAAVsAAOhAAF8AwaoGxtYAAebAABvAAOrAAGlAABpAAVVAAVzAARcAAVWAAZRAAX9Wlb9SkfsUE34Skf9Qz78Pzv8PDn8Ojb5Ozf7NzP4NzTvODXnODXbOjXoMzDbMzH1JiTlJSPTKifyHBntHRrZIiDxFRLNJCPEKCbeGxnwEA3TGhfFHx3pDQq7Hx/WExHhDQvMExGvHB22GRnEEhHsAADrAADqAADmAADgAACpFRe1Dw/UAAChFRbKAACtCwvDAACgDA2UERG7AACRERK4AACyAACRCw2pAACiAACICgufAACcAAGZAAGSAACPAAKMAAOJAAOFAAKAAAN9AAR6AAR4AAR2AAV0AARvAAVtAAZpAAZmAAZhAAdcAAb6MS72MS71LSr3KSX0JSH1IR70HRnyGBXuFBLtDw3tCgnrCAftBATqBATtAADrAADqAADpAADjAADdAADbAADYAADQAADNAADHAADAAAC9AAC2AAGwAAGuAAGsAACmAAGVAAGCAANxAAVZAAeYwP/6AAAAw3RSTlMABAoYIy00PEFGRkZNUlVZXV9kZ21tdXZ5e3t/gYKIiYqPk5ifoKChoaepsrS3t7e4ubzBwsLIzMzR0dPX29rd4eTm6Ovq7e3w9Pb2+fn7+/39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f3+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7nrWDnAAAID0lEQVR42o2ViV9TVxaAE0HoDNSFUaxLVWRGZdTWuo3bWLXTsRVEbVkCzGhqNNaoyKj3vkRDVGJSEEL2l0BWtpBE5t2EkBBCFsJf1nMDlBAeLR+B9+O+nO+ce9+59wl4KT7KQ6Vg/ZTYl7At/gI164s9fAX4RqVS3ftvHndVqunv6Z3Lwj8SHLWwdrtJoVB4G/JoDIcVWjtw/XcF265du6aJtAHiIe/4xAJoAsFfUWtra1vbnakofOXwmoJK1mqJy0UNjSKPp0WGEYfgk/sJNTZRWuWTVta21mLsvPJv1YMffvixqckfCAaDhIYDiH4wjAQC45JW76Nnqu+v8New35JWtN26daupiSDMocXsAL0CGAd8ja2Sp1MJ9gue8IpzV2M//SjySvyBAMZEa56bM+ejAwGD/E8lvvGO6e/OHVg9AUsqLL4lEssYTHN327P2bB4DekQhE76xMf/kDHu0IHxTzYWZZ+IhyA+JUEaXOfRpAfszGZ0Kbgb9Yz5pR/xqza4Vgs+tKcV90dCojBBMECRf1bebs1nbDIZpBMfGRn1hte1U/vM/9bX62ZB4RBJEOJnRG8vLyooLBUVlNdaXo4gwcnhC4yOP1N+dqlpefzY1CfklMgaRPqvdwd9tey1Phj9CDQQzfo9EEbctr8MB9vV9sdgXQGi658DWrVv4BNtqLj58JONoc0CHSKWS/+ULrC+GR0ah9ZDWulnAT4253SODcIBaZMOP2SXB1kMXNA9EI7D+qvSximLe8Ir9F9sfSD/S2EhKA5KP0o7E1Zo9i/ln5UO3RwjBGsuutfao+WGLhHAAUhp6EAcGHFbbTy0ILK8lYq+UiSb1A/yCbTsvvngg8eNc/j67aWaaGu6/tC0J2lvE0kBIbRlw8gv+abkHm5PQTlTZHW6nsQdj7Pc8ZKngk51nU489kgAKJeynqspWRwsrK//14pEkQGAGCm2v4/K+w7YMg3Fg9HHP1zs3C/ayyfD4iJ/BROvcK+BBWGe50wwdikAwZc26TwhKHcYQ5pDsaTRh+wIEr8el0gCZil+o+pQnvry8s/MncQDmTxTq1MDl6u2C4qqj2jghwacdL6nA2u6RMoSoDYfWyC9qhvLpcaC02FzHBZQyVo9DoeDYY5YKXojHMSYJ82Ge8NLS913eoSBGHA7PpLLXj+xZENj0iGAkfZYTvJYGMMazdh7Bhjp7azNi4DZHlLYB9yUYWxQQAqMx9ksQaGRBAgLbakHxxg8fvB5MzzS5Mp69fv7IsoCOoiitgE18RARxPAJhlhU1hyAVNGDUNug+DWNLAkO+AGNIkeQR1JlFLSGECcJylf36t0fyBQiBIEYFtgTCCKFk4RoU1dU1NMrlhND5w/P/CsYKK4jZvqQCjHgFNrapaQLC4atK68B8gQDCfxPkXiEFgo1Xvmlrm5gIEdjBMch/esOGlQK0XIGWcEAyu1JgMTfTBeSAGDtYfwLGVlZAWRaglYKN587+504wkAuPmqyuk8VFhQKUu7cogFmunMInll8am2k4ovmzLpg/ryBXgV0Xn4JVyBOUHj17967fn8uv6je7TpQU8woUKm1O0J9Q0uN0WbDJ3NXQQkju/frWMuD+u6AQ2Exwc3ImZQeBQ5+IMhx6mzm0mP/AsZ8fSqS57or1Gh3nN5euEvy5Pw3ySXXacVywz2XURuUYR5MHFw9gc2eDN4ShKIxm2EHaQKsF6QRUEFH3OEHgtvQmpiNkMvq3XHGQ/55knBBaftrgPLmljEfwJ5WSC6vUPXoXFdj7uxNKhMlfBUCl5XnDEBMiGPKnrA53NYzxCGB6kdm03gyC8qrzdp1GCSX/47PPdu081v5QLCEAVs0aHSd3851yRZUHfTIUme1lr1T9Bf6vdhs1SgahaZ2RtUL+EN3BmOlmne59Aj5Kze88EhxJZugGzwnmuuPKSTQ1k3jz/N6Qj8GEw6qE0XGmqpwnvHjr550vJFKi7DX+JmAzPdooh+VBn6clEGIw4kga8u/mf01m3zcNYURiRtv8gmBL9XmrThvDJIRkoyNBAgXQ/Mery/kFpnctYiSHd8Ll6h2LY1Vu6IVQCBOCQzSeS1uc7i0Cfip0b4ZHuUhSt9whILD2aqKTDHQfxphRzxoHj+8r4Q3fWHGw/YlkPKLqM64QOMy62RgICOEIMdicLng8vFSanjd6GUU8aWLzBNvPXGaNvTORMAgIZjLmASefoGjTpk0HX/3sFWPaA9fO5DfZDrczm9FEQwxUgbv75rIVPIIy61ymHfqEYaIGS8Ee2X7p2wHD7LRCEQaDJpkx7S0pWnHClwDb3ne9e9IqxvLIW1PdpYJNDjUMmPo0GnUYugBNRjP2vSvWzmrV617dFo34OESUOgN9yRYK6p2W/lQCFgIhrqPjzS+HSvPY3NXV+apd5B2TIias0pt5Nrlwwz73oKlXPRNHCI20DI++trIsfAC4fGhqvH27FSGCSCSVcZ2AQ341e+qvWzJatVouRxKPePRJ1/tFuiB9q6ihwYuQXK6I9RhuQH4ehEL6LHTd2jiHAElzHh56CEP82wQ9A4RCAT87am8MGvq6NZOKMPm/z5PHMMTLw+EpbXqurvaIYG12u93uuf5MWjtFM+Z+gIWLujutc7rcEP57gtraWqs+05NSMoggABNEwzEjZxI9vfobtbXw/P+A0/Xz8263y5RZpt8Elc3Pz18SrIfTN2/erK93mTP9S+gNZlf9TWB9AiGlxL2S+hIhRbBuir9a4sTCpXiNL/4KigWLnBOCzfAAAAAASUVORK5CYII=
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
  const LOCAL_LAST_MODIFIED_KEY = 'searchfilter_local_last_modified'; // 新增：记录本地最后修改时间

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
    bubbleAction: 'openPanel'
  });

  // 兼容旧配置
  if (currentConfig.showBlockBtn === undefined) currentConfig.showBlockBtn = false;
  if (currentConfig.blockDomain === undefined) currentConfig.blockDomain = false;
  if (currentConfig.blockConfirm === undefined) currentConfig.blockConfirm = false;
  if (currentConfig.showBubble === undefined) currentConfig.showBubble = true;
  if (currentConfig.panelCentered === undefined) currentConfig.panelCentered = true;
  if (currentConfig.bubbleAction === undefined) currentConfig.bubbleAction = 'openPanel';

  let showHiddenResults = false;

  // 缓存
  let compiledRules = {
    domains: new Set(),
    urls: [],
    titles: [],
    texts: []
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

        /* 被屏蔽结果灰底 */
        .searchfilter-blocked-visible {
            background: #d1d5db !important;
            border-radius: 4px;
            transition: background 0.2s;
        }

        /* Google强制背景色 */
        .searchfilter-blocked-visible .yuRUbf,
        .searchfilter-blocked-visible .g,
        .searchfilter-blocked-visible .MjjYud,
        .searchfilter-blocked-visible div[data-sokoban-container],
        .searchfilter-blocked-visible div[data-snc] {
        background: transparent !important;
        }

        /* 覆盖Google背景卡片 */
        .MjjYud .searchfilter-blocked-visible,
        .g .searchfilter-blocked-visible {
        background: #d1d5db !important;
        }

        /* 屏蔽数量 */
        .bubble-number {
        color: #000000 !important;
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

  // 选择器
  const selectors = {
    bing: 'li.b_algo, div.b_algo',
    google: 'div.g, div.MjjYud',
    duckduckgo: '[data-testid="result"], .result, .web-result, .tile, .tile--ad',
    other: 'div.g, li.b_algo'
  };

  // 语法检查
  function validateRule(rule) {
    if (!rule || rule.trim() === '') return true;

    if (rule.startsWith('/') && rule.lastIndexOf('/') > 0) {
      const lastSlash = rule.lastIndexOf('/');
      const pattern = rule.slice(1, lastSlash);
      const flags = rule.slice(lastSlash + 1);
      try {
        new RegExp(pattern, flags);
        return true;
      } catch (e) {
        return false;
      }
    }

    // 标题或正文规则
    if (rule.startsWith('text/') || rule.startsWith('title/')) {
      let remaining = rule.startsWith('title/') ? rule.substring(6) : rule.substring(5);
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

  // 规则预编译索引
  function buildRuleIndex() {
    compiledRules = {
      domains: new Set(),
      urls: [],
      titles: [],
      texts: []
    };
    const subscriptionRules = getAllSubscriptionRules();
    const allRules = currentConfig.rules.concat(subscriptionRules);

    allRules.forEach(rule => {
      if (!rule || rule.trim() === '' || rule.startsWith('#')) return;

      if (!rule.startsWith('/') && !rule.startsWith('text/') && !rule.startsWith('title/')) {
        let domainMatch = rule.match(/^\*:\/\/\*\.([^\/]+)\/\*$/);
        if (!domainMatch) {
          domainMatch = rule.match(/^\*:\/\/([^\/]+)\/\*$/);
        }
        if (domainMatch) {
          const domain = domainMatch[1].toLowerCase();
          if (!domain.includes('/')) {
            compiledRules.domains.add(domain);
            return;
          }
        }
      }

      // 预编译正则表达式
      try {
        if (rule.startsWith('text/')) {
          let virtualRule = rule.replace(/^text\//, 'title/');
          let {
            pattern,
            flags
          } = ruleToRegex(virtualRule);
          compiledRules.texts.push(new RegExp(pattern, flags));
        } else if (rule.startsWith('title/')) {
          let {
            pattern,
            flags
          } = ruleToRegex(rule);
          compiledRules.titles.push(new RegExp(pattern, flags));
        } else {
          let {
            pattern,
            flags
          } = ruleToRegex(rule);
          compiledRules.urls.push(new RegExp(pattern, flags));
        }
      } catch (e) {
        if (currentConfig.debug) console.warn('规则预编译失败:', rule, e);
      }
    });
  }

  // 匹配函数
  function checkRuleMatchOptimized(url, domain, title, snippet) {
    let d = domain.toLowerCase();
    while (d) {
      if (compiledRules.domains.has(d)) return true;
      let dotIndex = d.indexOf('.');
      if (dotIndex === -1) break;
      d = d.substring(dotIndex + 1);
    }

    // 预编译正则匹配
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

    return false;
  }

  // 正文选择器
  function getResultSnippet(result, engine) {
    const bingSnippetSelectors = ['.b_caption p', '.b_snippet', '.b_paractl p', '.b_lineclamp2'];
    const googleSnippetSelectors = ['.st', '.VwiC3b', '.s3v9rd', '.IsZvec', '.lyLwlc', '.yXK7lf'];
    const duckSnippetSelectors = ['[data-testid="result-snippet"]', '[data-result="snippet"]', '.result__snippet'];
    let selectors;
    if (engine === 'bing') selectors = bingSnippetSelectors;
    else if (engine === 'google') selectors = googleSnippetSelectors;
    else if (engine === 'duckduckgo') selectors = duckSnippetSelectors;
    else return '';
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

  // 匹配函数
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
      .filter(line => line.length > 0 && !line.startsWith('#'));
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

    const btn = document.createElement('div');
    btn.className = 'searchfilter-quick-block';
    btn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>`;
    btn.title = '屏蔽此词条';

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
      let newRule = '';
      if (currentConfig.blockDomain) {
        let baseDomain = domain.startsWith('www.') ? domain.substring(4) : domain;
        newRule = baseDomain + '/*';
      } else {
        newRule = domain + '/*';
      }
      if (currentConfig.blockConfirm) {
        if (!confirm(`确定要屏蔽并添加规则 [ ${newRule} ] 吗？`)) return;
      }
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
      if (showHiddenResults) result.classList.add('searchfilter-blocked-visible');
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
      });
      showHiddenResults = false;
      updateStatus(0);
      return;
    }

    const engine = getSearchEngine();
    const selector = selectors[engine];
    const newResults = document.querySelectorAll(`${selector}:not([data-observed])`);

    newResults.forEach(result => {
      result.setAttribute('data-observed', 'true');
      resultObserver.observe(result);
    });
  }

  // 立即更新悬浮球
  function forceReprocessAll() {
    buildRuleIndex();

    const engine = getSearchEngine();
    const selector = selectors[engine];

    document.querySelectorAll('[data-observed]').forEach(el => {
      resultObserver.unobserve(el);
      el.removeAttribute('data-observed');
      el.removeAttribute('data-blocker-processed');
      el.removeAttribute('data-is-blocked');
      el.classList.remove('searchfilter-blocked-visible');
      el.style.display = '';
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

  // 获取链接
  function getResultLink(result, engine) {
    if (engine === 'bing') return result.querySelector('a[href]');
    if (engine === 'google') return result.querySelector('a[href]');
    if (engine === 'duckduckgo') {
      return result.querySelector('a[data-testid="result-extras-url-link"]') ||
        result.querySelector('a[data-testid="result-title-a"]') ||
        result.querySelector('.result__url') ||
        result.querySelector('.tile--title__domain') ||
        result.querySelector('a[href]');
    }
    return result.querySelector('a[href]');
  }

  // 标题选择器
  function getResultTitle(result, engine) {
    const bingSelectors = ['h2 a', 'a h2', '.b_title'];
    const googleSelectors = ['h3', 'div[role="heading"]', '.LC20lb', '.DKV0Md', '.sXLaOe', '.c9DxTc', 'a h3'];
    const duckSelectors = ['a[data-testid="result-title-a"]', '.result__title', '.tile__title', '.tile--title__title', 'h2 a', 'a h2'];
    let selectors;
    if (engine === 'bing') selectors = bingSelectors;
    else if (engine === 'google') selectors = googleSelectors;
    else if (engine === 'duckduckgo') selectors = duckSelectors;
    else return '';
    for (let i = 0; i < selectors.length; i++) {
      const elem = result.querySelector(selectors[i]);
      if (elem && elem.textContent) return elem.textContent.trim();
    }
    return '';
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

    if (currentConfig.bubbleAction === 'toggleHidden') {
      statusBtn.innerHTML = '⭕';
      statusBtn.title = `点击${showHiddenResults ? '隐藏' : '显示'}已屏蔽结果`;
    } else {
      if (currentConfig.showCount) {
        const icon = '🚫';
        if (isLeft) {
          statusBtn.innerHTML = `${icon} <span class="bubble-number">${blocked}</span>`;
        } else {
          statusBtn.innerHTML = `<span class="bubble-number">${blocked}</span> ${icon}`;
        }
      } else {
        statusBtn.innerHTML = '🚫';
      }
      statusBtn.title = '拖动边缘吸附，点击打开配置面板';
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
        dragStartTime = Date.now();
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
      }

      function onDrag(e) {
        const clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
        const clientY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;
        const dx = clientX - startX;
        const dy = clientY - startY;
        if (!isDragging && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) isDragging = true;
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

          if (Date.now() - dragStartTime < 300) {
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
      } else {
        el.classList.remove('searchfilter-blocked-visible');
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
        const warnIcon = isValid ? '' : `<span style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); font-size: 10px; cursor: help; background: #edf2f7; z-index: 1;" title="语法错误">⚠️</span>`;
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
      const warnIcon = isValid ? '' : `<span style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); font-size: 10px; cursor: help; background: #edf2f7; z-index: 1;" title="语法错误">⚠️</span>`;
      children[i].innerHTML = `${i + 1}${warnIcon}`;
    }
  }

  function scheduleLineNumbersUpdate() {
    if (lineUpdateRaf) cancelAnimationFrame(lineUpdateRaf);
    lineUpdateRaf = requestAnimationFrame(() => {
      validationCache.clear();
      updateLineNumbersIncremental();
      lineUpdateRaf = null;
    });
  }

  function updateLineNumbers() {
    scheduleLineNumbersUpdate();
  }

  // 隐藏统计面板
  function hideStatsPanel() {
    const statsPanel = document.getElementById('searchfilter-stats-panel');
    if (statsPanel) statsPanel.style.display = 'none';
  }

  // 切换显示隐藏
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

  // 更新面板内容
  function updateStatsContent() {
    const statsContent = document.getElementById('searchfilter-stats-content');
    if (!statsContent) return;

    const textarea = document.getElementById('searchfilter-rules');
    const rulesText = textarea ? textarea.value : currentConfig.rules.join('\n');
    const rawLines = rulesText.split('\n');
    const testRules = filterValidRuleLines(rawLines);
    const subscriptionRules = getAllSubscriptionRules();
    const allTestRules = testRules.concat(subscriptionRules);

    const engine = getSearchEngine();
    const results = document.querySelectorAll(selectors[engine]);

    const ruleStats = {};
    const ruleErrors = {};

    results.forEach(result => {
      const link = getResultLink(result, engine);
      if (!link || !link.href) return;
      const url = link.href;
      let domain = '';
      try {
        domain = new URL(url).hostname;
      } catch (e) {}
      const title = getResultTitle(result, engine) || '';
      const snippet = getResultSnippet(result, engine) || '';

      allTestRules.forEach(rule => {
        try {
          if (checkRuleMatch(rule, url, domain, title, snippet)) {
            if (!ruleStats[rule]) ruleStats[rule] = 0;
            ruleStats[rule]++;
          }
        } catch (e) {
          if (!ruleErrors[rule]) ruleErrors[rule] = [];
          ruleErrors[rule].push(e.message);
        }
      });
    });

    const ruleStatsArray = Object.entries(ruleStats).map(([rule, count]) => ({
        rule,
        count
      }))
      .sort((a, b) => b.count - a.count);
    const ruleErrorsArray = Object.entries(ruleErrors).map(([rule, errors]) => ({
      rule,
      errors: [...new Set(errors)]
    }));

    let resultHTML = '';

    if (ruleErrorsArray.length > 0) {
      resultHTML += `<div style="color: #c53030; background: #fff5f5; padding: 8px; border-radius: 4px; margin-bottom: 12px;"><strong>⚠️ 发现 ${ruleErrorsArray.length} 个规则错误：</strong><br>`;
      ruleErrorsArray.forEach(item => {
        resultHTML += `<div style="margin: 4px 0; font-size: 11px;"><div style="color: #2d3748;"><strong>规则：</strong>${item.rule}</div><div style="color: #c53030;"><strong>错误：</strong>${item.errors.join(', ')}</div></div>`;
      });
      resultHTML += '</div>';
    }

    if (ruleStatsArray.length > 0) {
      const totalMatches = ruleStatsArray.reduce((sum, item) => sum + item.count, 0);
      resultHTML += `<div style="color: #2d3748; font-weight: bold; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px solid #e2e8f0;">共匹配 ${totalMatches} 条结果</div>`;
      ruleStatsArray.forEach(item => {
        let ruleType = 'URL规则';
        if (item.rule.startsWith('title/')) ruleType = '标题规则';
        else if (item.rule.startsWith('text/')) ruleType = '正文规则';
        else if (item.rule.startsWith('/')) ruleType = '正则规则';
        resultHTML += `<div style="margin: 4px 0; padding: 6px 0; border-bottom: 1px solid #edf2f7;"><div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;"><span style="font-size: 11px; color: #718096;">${ruleType}</span><span style="font-size: 11px; color: #38a169; font-weight: bold;">匹配: ${item.count} 条</span></div><div style="font-size: 12px; color: #2d3748; word-break: break-all; font-family: 'Consolas', monospace;">${item.rule}</div></div>`;
      });
    } else if (ruleErrorsArray.length === 0) {
      resultHTML = '<div style="color: #38a169; padding: 10px; border-radius: 4px; font-size: 12px; background: #f0fff4; text-align: center;">无匹配项</div>';
    }

    statsContent.innerHTML = resultHTML;
  }

  // 显示配置面板
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
    let positionCSS = '';
    if (currentConfig.panelCentered) {
      positionCSS = `top: 60%; left: 50%; transform: translate(-50%, -50%);`;
    } else {
      let rect;
      if (statusBtn) rect = statusBtn.getBoundingClientRect();
      else rect = {
        left: window.innerWidth - 50,
        right: window.innerWidth - 10,
        top: window.innerHeight - 50,
        bottom: window.innerHeight - 10,
        width: 40,
        height: 40
      };
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const isLeft = centerX < window.innerWidth / 2;
      const isTop = centerY < window.innerHeight / 2;
      if (isLeft && isTop) positionCSS = 'top: 10px; left: 10px; transform: none;';
      else if (!isLeft && isTop) positionCSS = 'top: 10px; right: 10px; transform: none;';
      else if (isLeft && !isTop) positionCSS = 'bottom: 10px; left: 10px; transform: none;';
      else positionCSS = 'bottom: 10px; right: 10px; transform: none;';
    }

    panel.style.cssText = `position: fixed; ${positionCSS} width: 315px; max-width: 90vw; z-index: 10001; padding: 5px 15px 15px 15px;`;

    const sizeOptions = [{
      value: 'medium',
      label: '中杯'
    }, {
      value: 'large',
      label: '大杯'
    }, {
      value: 'larger',
      label: '超大'
    }, {
      value: 'xlarge',
      label: '特大'
    }];

    panel.innerHTML = `
            <div style="display: flex; gap: 8px; margin-top: 10px; margin-bottom: 8px;">
                <label style="display: flex; align-items: center; flex: 1; justify-content: flex-start; white-space: nowrap;">
                    <input type="checkbox" id="searchfilter-enabled" ${currentConfig.enabled ? 'checked' : ''} style="margin-right: 4px;">
                    <span>启用屏蔽</span>
                </label>
                <label style="display: flex; align-items: center; flex: 1; justify-content: center; white-space: nowrap;">
                    <input type="checkbox" id="searchfilter-show-count" ${currentConfig.showCount ? 'checked' : ''} style="margin-right: 4px;">
                    <span>显示数量</span>
                </label>
                <label style="display: flex; align-items: center; flex: 1; justify-content: flex-end; white-space: nowrap;">
                    <input type="checkbox" id="searchfilter-debug" ${currentConfig.debug ? 'checked' : ''} style="margin-right: 4px;">
                    <span>调试模式</span>
                </label>
            </div>
            
            <div style="display: flex; gap: 8px; margin-bottom: 12px;">
                <label style="display: flex; align-items: center; flex: 1; justify-content: flex-start; white-space: nowrap;">
                    <input type="checkbox" id="searchfilter-show-block-btn" ${currentConfig.showBlockBtn ? 'checked' : ''} style="margin-right: 4px;">
                    <span>一键屏蔽</span>
                </label>
                <label style="display: flex; align-items: center; flex: 1; justify-content: center; white-space: nowrap;">
                    <input type="checkbox" id="searchfilter-block-domain" ${currentConfig.blockDomain ? 'checked' : ''} style="margin-right: 4px;">
                    <span>屏蔽域名</span>
                </label>
                <label style="display: flex; align-items: center; flex: 1; justify-content: flex-end; white-space: nowrap;">
                    <input type="checkbox" id="searchfilter-block-confirm" ${currentConfig.blockConfirm ? 'checked' : ''} style="margin-right: 4px;">
                    <span>二次确认</span>
                </label>
            </div>
            
            <div class="option-row">
                <span class="option-label">悬浮球大小:</span>
                ${createOptionButtons('bubbleSize', currentConfig.bubbleSize, sizeOptions)}
            </div>
            
            <div style="margin-bottom: 8px;">
                <div class="compact-row">
                    <span style="font-size: 12px; color: #4a5568;">屏蔽规则:</span>
                    <div style="display: flex; gap: 4px;">
                        <button id="searchfilter-subscribe" class="searchfilter-button searchfilter-button-secondary" style="padding: 3px 8px; border: 1px solid transparent;" title="订阅规则">订阅</button>
                        <button id="searchfilter-sync" class="searchfilter-button searchfilter-button-success" style="padding: 3px 8px; border: 1px solid transparent;" title="WebDAV同步">同步</button>
                        <button id="searchfilter-import-file" class="searchfilter-button searchfilter-button-secondary" style="padding: 3px 8px; border: 1px solid transparent;" title="从TXT文件导入">导入</button>
                        <button id="searchfilter-export-file" class="searchfilter-button searchfilter-button-success" style="padding: 3px 8px; border: 1px solid transparent;" title="导出到TXT文件">导出</button>
                    </div>
                </div>
                <div class="rules-container">
                    <div id="searchfilter-line-numbers"></div>
                    <textarea id="searchfilter-rules" placeholder="每行一个规则" wrap="off">${currentConfig.rules.join('\n')}</textarea>
                    <div id="searchfilter-scroll-top" class="searchfilter-scroll-btn" style="top: 2px;" title="回到顶部">⬆️</div>
                    <div id="searchfilter-scroll-bottom" class="searchfilter-scroll-btn" style="bottom: 1px;" title="回到底部">⬇️</div>
                </div>
                <div style="font-size: 10px; color: #718096; margin-top: 3px; text-align: left;">
                title/.*文本.*/ 匹配标题 | text/.*文本.*/ 匹配内容<br>
                title/.*AbC.*/i 加i忽略大小写 | title/.*A(B|C).*/ 同时匹配AB和AC<br>
                </div>
            </div>
            
            <div style="display: flex; gap: 6px; margin-top: 8px;" id="searchfilter-panel-footer">
                <button id="searchfilter-save" class="searchfilter-button searchfilter-button-primary action-button" style="flex: 2;">保存</button>
                <button id="searchfilter-test" class="searchfilter-button searchfilter-button-secondary action-button" style="flex: 1;">统计</button>
                <button id="searchfilter-close" class="searchfilter-button searchfilter-button-danger action-button" style="flex: 1;">关闭</button>
            </div>
            
            <!-- 统计面板 -->
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
      if (line.startsWith('@')) continue;
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

    if (showAlerts) alert(`订阅成功！已更新 ${validRules.length} 条有效规则。`);
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
    panel.style.cssText = `position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 315px; max-width: 90vw; padding: 15px 15px 8px 15px; z-index: 10002;`;

    let subscriptions = getSubscriptions();
    if (!subscriptions) subscriptions = [];

    let rowsHtml = '';
    subscriptions.forEach((sub, index) => {
      rowsHtml += `<div class="subscription-row" data-index="${index}">
                <div class="subscription-input-row">
                    <input type="text" class="subscription-url" placeholder="https://example.com/rules.txt" value="${sub.url || ''}">
                    <button class="delete-subscription-btn" title="删除订阅" data-index="${index}">❌</button>
                </div>
                <div class="subscription-status-message"></div>
            </div>`;
    });

    panel.innerHTML = `
            <h3 style="margin:0 0 16px;font-size:16px;color:#2d3748;">订阅管理</h3>
            <div id="subscription-rows-container">${rowsHtml}</div>
            <div class="add-subscription-btn"><button id="add-subscription" class="searchfilter-button searchfilter-button-secondary" style="width:100%;" ${subscriptions.length >= 3 ? 'disabled' : ''}>➕ 添加订阅</button></div>
            <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:20px;"><button id="subscription-save" class="searchfilter-button searchfilter-button-primary" style="flex:1;">保存</button><button id="subscription-import" class="searchfilter-button searchfilter-button-primary" style="flex:1;">导入</button><button id="subscription-cancel" class="searchfilter-button searchfilter-button-secondary" style="flex:1;">取消</button></div>
            <div id="subscription-status" style="margin-top:2px;font-size:12px;color:#4a5568;min-height:12px;"></div>
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
        setStatus('最多只能添加3条订阅', true);
        return;
      }
      const newRow = document.createElement('div');
      newRow.className = 'subscription-row';
      newRow.innerHTML = `<div class="subscription-input-row"><input type="text" class="subscription-url" placeholder="https://example.com/rules.txt" value=""><button class="delete-subscription-btn" title="删除订阅">❌</button></div><div class="subscription-status-message"></div>`;
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
      setStatus('订阅配置已保存');
      subscriptions = newSubs;
      forceReprocessAll();
    };

    document.getElementById('subscription-import').onclick = async () => {
      const rows = container.querySelectorAll('.subscription-row');
      if (rows.length === 0) {
        setStatus('没有订阅链接', true);
        return;
      }
      setStatus('正在导入...');
      for (let row of rows) {
        const input = row.querySelector('.subscription-url');
        const url = input.value.trim();
        const msgDiv = row.querySelector('.subscription-status-message');
        if (!url) {
          msgDiv.textContent = '链接为空';
          msgDiv.className = 'subscription-status-message error';
          continue;
        }
        try {
          const result = await performSubscriptionForUrl(url, false);
          msgDiv.textContent = `导入成功，已导入 ${result.count} 条规则`;
          msgDiv.className = 'subscription-status-message success';
        } catch (err) {
          console.error(`导入失败 [${url}]:`, err);
          msgDiv.textContent = '导入失败，请检查链接或网络状态';
          msgDiv.className = 'subscription-status-message error';
        }
      }
      setStatus('导入操作完成');
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
    panel.style.cssText = `position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 315px; max-width: 90vw; padding: 15px 15px 8px 15px; z-index: 10002;`;

    panel.innerHTML = `
            <h3 style="margin:0 0 16px;font-size:16px;color:#2d3748;">WebDAV 同步设置</h3>
            <div style="margin-bottom:12px;"><label>Webdav地址</label><input id="webdav-url" type="text" placeholder="https://example.com/remote.php/dav/files/user/" value="${webdavConfig.url}"></div>
            <div style="margin-bottom:12px;"><label>Webdav账号</label><input id="webdav-username" type="text" value="${webdavConfig.username}"></div>
            <div style="margin-bottom:12px;"><label>应用密码</label><input id="webdav-password" type="password" value="${webdavConfig.password}"></div>
            <div style="margin-bottom:20px;"><label>文件名</label><input id="webdav-filename" type="text" placeholder="rules.txt" value="${webdavConfig.filename}"></div>
            <div style="display:flex;gap:8px;justify-content:flex-end;"><button id="webdav-upload" class="searchfilter-button searchfilter-button-success" style="flex:1;">上传</button><button id="webdav-download" class="searchfilter-button searchfilter-button-primary" style="flex:1;">下载</button><button id="webdav-cancel" class="searchfilter-button searchfilter-button-secondary" style="flex:1;">取消</button></div>
            <div id="webdav-status" style="margin-top:2px;font-size:12px;color:#4a5568;min-height:12px;"></div>
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
        setStatus('请填写服务器地址', true);
        return;
      }
      if (!url.toLowerCase().startsWith('https://')) {
        alert('安全起见，WebDAV服务器地址必须使用https');
        return;
      }
      const config = saveWebDAVConfig();
      const textarea = document.getElementById('searchfilter-rules');
      const content = textarea ? textarea.value : currentConfig.rules.join('\n');
      setStatus('正在上传...');
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
            onerror: (err) => reject(new Error('网络错误')),
            ontimeout: () => reject(new Error('请求超时'))
          });
        });
        setStatus('上传成功！');
      } catch (err) {
        setStatus(`上传失败：${err.message}`, true);
      }
    };

    document.getElementById('webdav-download').onclick = async () => {
      const url = urlInput.value.trim();
      if (!url) {
        setStatus('请填写服务器地址', true);
        return;
      }
      if (!url.toLowerCase().startsWith('https://')) {
        alert('安全起见，WebDAV服务器地址必须使用https');
        return;
      }
      const config = saveWebDAVConfig();
      setStatus('正在下载...');
      try {
        await performWebDAVDownload(config, true, setStatus);
        setStatus('下载成功！规则已加载到编辑区，点击“保存”生效。');
      } catch (err) {
        setStatus(`下载失败：${err.message}`, true);
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
        onerror: () => reject(new Error('网络错误')),
        ontimeout: () => reject(new Error('请求超时'))
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
        onerror: () => reject(new Error('网络错误')),
        ontimeout: () => reject(new Error('请求超时'))
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
      alert('没有规则可导出');
      return;
    }
    const now = new Date();
    const filename = `rules-${now.getMonth()+1}-${now.getDate()}-${now.getHours()}${now.getMinutes()}${now.getSeconds()}.txt`;
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
    GM_registerMenuCommand("⚙️ 打开配置面板", () => showConfigPanel());
    GM_registerMenuCommand(currentConfig.enabled ? "🟢 屏蔽功能：启用" : "🔴 屏蔽功能：关闭", () => {
      currentConfig.enabled = !currentConfig.enabled;
      GM_setValue(CONFIG_KEY, currentConfig);
      location.reload();
    });
    GM_registerMenuCommand(currentConfig.blockConfirm ? "🟢 二次确认：启用" : "🔴 二次确认：关闭", () => {
      currentConfig.blockConfirm = !currentConfig.blockConfirm;
      GM_setValue(CONFIG_KEY, currentConfig);
      location.reload();
    });
    GM_registerMenuCommand(currentConfig.panelCentered ? "🟢 面板居中：启用" : "🔴 面板居中：关闭", () => {
      currentConfig.panelCentered = !currentConfig.panelCentered;
      GM_setValue(CONFIG_KEY, currentConfig);
      location.reload();
    });
    GM_registerMenuCommand(currentConfig.showBubble ? "🟢 悬浮球状态：显示" : "🔴 悬浮球状态：隐藏", () => {
      currentConfig.showBubble = !currentConfig.showBubble;
      GM_setValue(CONFIG_KEY, currentConfig);
      location.reload();
    });
    GM_registerMenuCommand(currentConfig.bubbleAction === 'openPanel' ? "🟢 悬浮球功能：打开面板" : "🔵 悬浮球功能：显示隐藏结果", () => {
      currentConfig.bubbleAction = currentConfig.bubbleAction === 'openPanel' ? 'toggleHidden' : 'openPanel';
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