// ==UserScript==
// @name         搜索结果屏蔽器
// @namespace    https://github.com/Carteahere
// @version      4.4
// @description  支持uBlacklist规则的Bing/Google/DuckDuckGo搜索结果屏蔽工具
// @author       南雪莲
// @license      MIT
// @match        https://www.bing.com/*
// @match        https://cn.bing.com/*
// @match        https://www.google.com/*
// @match        https://www.google.com.*/*
// @match        https://duckduckgo.com/*
// @match        https://*.duckduckgo.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @run-at       document-idle
// @downloadURL none
// ==/UserScript==

(function() {
    'use strict';
    
    // 配置键
    const CONFIG_KEY = 'searchfilter_blocker';
    let currentConfig = GM_getValue(CONFIG_KEY, {
        rules: ['*://*.example.com/*'],
        enabled: true,
        showCount: true,
        bubbleSize: 'large',
        bubblePosition: 'bottom-right',
        debug: false
    });
    
    // 添加样式
    GM_addStyle(`
        #searchfilter-panel {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 13px;
            box-sizing: border-box;
        }
        #searchfilter-panel textarea {
            font-family: 'Consolas', 'Monaco', monospace;
            font-size: 11px;
            line-height: 1.4;
            box-sizing: border-box;
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
        .searchfilter-button-primary {
            background: #2c5282;
            color: white;
        }
        .searchfilter-button-primary:hover {
            background: #1a365d;
        }
        .searchfilter-button-secondary {
            background: #4a5568;
            color: white;
        }
        .searchfilter-button-secondary:hover {
            background: #2d3748;
        }
        .searchfilter-button-success {
            background: #276749;
            color: white;
        }
        .searchfilter-button-success:hover {
            background: #22543d;
        }
        .searchfilter-button-danger {
            background: #c53030;
            color: white;
        }
        .searchfilter-button-danger:hover {
            background: #9b2c2c;
        }
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
        
        #searchfilter-rules {
            width: 100%;
            height: 150px;
            font-size: 11px;
            padding: 8px;
            border: 1px solid #e2e8f0;
            border-radius: 4px;
            resize: none;
            margin-bottom: 3px;
            background: #f8fafc;
            box-sizing: border-box;
            font-family: 'Consolas', 'Monaco', monospace;
            line-height: 1.4;
            word-break: break-all;
            white-space: pre-wrap;
            overflow-wrap: break-word;
        }
        
        #searchfilter-rules::-webkit-scrollbar {
            width: 6px;
            height: 6px;
        }
        
        #searchfilter-rules::-webkit-scrollbar-track {
            background: #f1f1f1;
            border-radius: 3px;
        }
        
        #searchfilter-rules::-webkit-scrollbar-thumb {
            background: #c1c1c1;
            border-radius: 3px;
        }
        
        #searchfilter-rules::-webkit-scrollbar-thumb:hover {
            background: #a8a8a8;
        }
        
        #searchfilter-test-result {
            max-height: 150px;
            overflow-y: auto;
            padding-right: 8px;
            box-sizing: border-box;
            margin-top: 10px;
        }
        
        #searchfilter-test-result::-webkit-scrollbar {
            width: 6px;
            height: 6px;
        }
        
        #searchfilter-test-result::-webkit-scrollbar-track {
            background: #f1f1f1;
            border-radius: 3px;
        }
        
        #searchfilter-test-result::-webkit-scrollbar-thumb {
            background: #c1c1c1;
            border-radius: 3px;
        }
        
        #searchfilter-test-result::-webkit-scrollbar-thumb:hover {
            background: #a8a8a8;
        }
    `);
    
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
        google: 'div.g, div[data-snf], div[data-hveid]',
        duckduckgo: '[data-testid="result"], .result, .web-result, .tile, .tile--ad',
        other: 'div.g, li.b_algo'
    };
    
    // 规则转换正则（URL和标题规则）
    function ruleToRegex(rule) {
        // 标题规则
        if (rule.startsWith('title/')) {
            let pattern = rule.substring(6);
            let flags = '';
            
            // 提取正则表达式标志
            const flagMatch = pattern.match(/^\(\?([ims]+)\)/);
            if (flagMatch) {
                flags = flagMatch[1];
                pattern = pattern.substring(flagMatch[0].length);
                
                // 特殊处理(?s)，将.替换为[\s\S]
                if (flags.includes('s')) {
                    pattern = pattern.replace(/\./g, '[\\s\\S]');
                    flags = flags.replace('s', '');
                }
            }
            
            return { pattern, flags };
        }
        
        // URL规则处理
        let pattern = rule;
        
        // 移除协议部分
        if (pattern.startsWith('*://')) {
            pattern = pattern.substring(4);
        }
        
        // 处理路径匹配
        if (pattern.includes('/')) {
            const parts = pattern.split('/');
            pattern = parts.map((part, index) => {
                if (index === 0) {
                    return part
                        .replace(/\*/g, '.*')
                        .replace(/\?/g, '\\?')
                        .replace(/(?<!\\)\./g, '\\.');
                } else {
                    return part
                        .replace(/\*/g, '.*')
                        .replace(/\?/g, '\\?');
                }
            }).join('\\/');
        } else {
            // 没有路径的情况
            pattern = pattern
                .replace(/\*/g, '.*')
                .replace(/\?/g, '\\?')
                .replace(/(?<!\\)\./g, '\\.');
        }
        
        return { pattern, flags: 'i' };
    }
    
    // 获取结果描述文本
    function getResultSnippet(result, engine) {
        const bingSnippetSelectors = ['.b_caption p', '.b_snippet', '.b_paractl p', '.b_lineclamp2'];
        const googleSnippetSelectors = ['.VwiC3b', '.st', '.s3v9rd', '.IsZvec', '.lyLwlc', '.yXK7lf'];
        const duckSnippetSelectors = ['[data-testid="result-snippet"]', '[data-result="snippet"]', '.result__snippet'];

        let selectors;
        if (engine === 'bing') selectors = bingSnippetSelectors;
        else if (engine === 'google') selectors = googleSnippetSelectors;
        else if (engine === 'duckduckgo') selectors = duckSnippetSelectors;
        else return '';

        for (let selector of selectors) {
            const elem = result.querySelector(selector);
            if (elem && elem.textContent) {
                return elem.textContent.trim();
            }
        }
        return '';
    }

    // 处理正文规则
    function checkTextRule(rule, snippet) {
        if (!snippet) return false;
        
        let pattern = rule.substring(5);
        let flags = '';
        
        // 提取标志 (?ims)
        const flagMatch = pattern.match(/^\(\?([ims]+)\)/);
        if (flagMatch) {
            flags = flagMatch[1];
            pattern = pattern.substring(flagMatch[0].length);
            
            // 处理 (?s)：将 . 替换为 [\s\S]
            if (flags.includes('s')) {
                pattern = pattern.replace(/\./g, '[\\s\\S]');
                flags = flags.replace('s', '');
            }
        }
        
        try {
            const regex = new RegExp(pattern, flags);
            return regex.test(snippet);
        } catch (e) {
            console.error('正文规则解析错误:', e, '规则:', rule);
            
            // 回退到简单包含匹配
            const simplePattern = pattern.replace(/^\(\?[ims]+\)/, '');
            if (flags.includes('i')) {
                return snippet.toLowerCase().includes(simplePattern.toLowerCase());
            }
            return snippet.includes(simplePattern);
        }
    }
    
    // 检查规则匹配函数
    function checkRuleMatch(rule, url, domain, title, snippet) {
        // 正文规则
        if (rule.startsWith('text/')) {
            return checkTextRule(rule, snippet);
        }
        
        // 标题规则
        if (rule.startsWith('title/')) {
            try {
                const { pattern, flags } = ruleToRegex(rule);
                
                if (!title || title.trim() === '') return false;
                
                // 创建正则表达式
                const regex = new RegExp(pattern, flags);
                const matches = regex.test(title);
                
                // 调试输出
                if (currentConfig.debug && matches && Math.random() < 0.1) {
                    console.log('标题匹配成功:', {
                        rule: rule,
                        pattern: pattern,
                        title: title.substring(0, 50),
                        matches: matches
                    });
                }
                
                return matches;
            } catch (e) {
                console.error('标题规则解析错误:', e, '规则:', rule);
                
                // 简单字符串匹配
                try {
                    const simplePattern = rule.substring(6).replace(/^\(\?[ims]+\)/, '');
                    // 大小写匹配
                    if (rule.includes('(?i)') || rule.includes('(?i)')) {
                        return title.toLowerCase().includes(simplePattern.toLowerCase());
                    }
                    return title.includes(simplePattern);
                } catch (e2) {
                    console.error('标题规则回退匹配失败:', e2);
                    return false;
                }
            }
        }
        
        // URL匹配
        try {
            const { pattern, flags } = ruleToRegex(rule);
            const regex = new RegExp(pattern, flags);
            
            const fullMatch = regex.test(url);
            const domainMatch = regex.test(domain);
            
            // 调试输出
            if (currentConfig.debug && (fullMatch || domainMatch) && Math.random() < 0.1) {
                console.log('URL规则匹配检查:', {
                    rule: rule,
                    pattern: pattern,
                    url: url,
                    domain: domain,
                    fullMatch: fullMatch,
                    domainMatch: domainMatch
                });
            }
            
            return fullMatch || domainMatch;
        } catch (e) {
            console.error('URL规则解析错误:', e, '规则:', rule);
            
            // 简单包含匹配
            try {
                const simpleRule = rule.replace('*://', '').replace(/\*/g, '');
                return url.includes(simpleRule) || domain.includes(simpleRule);
            } catch (e2) {
                console.error('URL规则回退匹配失败:', e2);
                return false;
            }
        }
    }
    
    // 屏蔽结果
    function blockResults() {
        if (!currentConfig.enabled) {
            updateStatus(0);
            document.querySelectorAll('[data-blocker-processed]').forEach(result => {
                result.style.display = '';
                result.removeAttribute('data-blocker-processed');
            });
            return;
        }
        
        const engine = getSearchEngine();
        const selector = selectors[engine];
        const results = document.querySelectorAll(selector);
        
        let blocked = 0;
        results.forEach(result => {
            if (result.hasAttribute('data-blocker-processed')) return;
            
            // 获取链接
            const link = getResultLink(result, engine);
            if (!link || !link.href) return;
            
            const url = link.href;
            let domain;
            try {
                domain = new URL(url).hostname;
            } catch (e) {
                domain = '';
            }
            
            const title = getResultTitle(result, engine);
            const snippet = getResultSnippet(result, engine);
            
            const shouldBlock = currentConfig.rules.some(rule => {
                return checkRuleMatch(rule, url, domain, title, snippet);
            });
            
            if (shouldBlock) {
                result.style.display = 'none';
                blocked++;
                result.setAttribute('data-blocker-processed', 'true');
                
                // 调试输出
                if (currentConfig.debug) {
                    console.log('屏蔽结果:', {
                        engine: engine,
                        url: url,
                        domain: domain,
                        title: title,
                        snippet: snippet,
                        ruleMatched: true
                    });
                }
            } else {
                result.setAttribute('data-blocker-processed', 'true');
            }
        });
        
        updateStatus(blocked);
    }
    
    // 获取链接
    function getResultLink(result, engine) {
        if (engine === 'bing') {
            return result.querySelector('a[href]');
        } else if (engine === 'google') {
            return result.querySelector('a[href]');
        } else if (engine === 'duckduckgo') {
            return result.querySelector('a[data-testid="result-extras-url-link"]') ||
                   result.querySelector('a[data-testid="result-title-a"]') ||
                   result.querySelector('.result__url') ||
                   result.querySelector('.tile--title__domain') ||
                   result.querySelector('a[href]');
        }
        return result.querySelector('a[href]');
    }
    
    // 获取标题
    function getResultTitle(result, engine) {
        // 各搜索引擎标题选择器
        const bingSelectors = ['h2 a', 'a h2', '.b_title'];
        const googleSelectors = ['h3', 'div[role="heading"]', '.LC20lb', '.DKV0Md', '.sXLaOe', '.c9DxTc', 'a h3'];
        const duckSelectors = ['a[data-testid="result-title-a"]', '.result__title', '.tile__title', '.tile--title__title', 'h2 a', 'a h2'];

        let selectors;
        if (engine === 'bing') selectors = bingSelectors;
        else if (engine === 'google') selectors = googleSelectors;
        else if (engine === 'duckduckgo') selectors = duckSelectors;
        else return '';

        // 遍历选择器
        for (let i = 0; i < selectors.length; i++) {
            const elem = result.querySelector(selectors[i]);
            if (elem && elem.textContent) {
                return elem.textContent.trim();
            }
        }
        return '';
    }
    
    // 更新状态显示
    function updateStatus(blocked) {
        let status = document.getElementById('searchfilter-status');
        if (!status) {
            status = document.createElement('div');
            status.id = 'searchfilter-status';
            
            applyBubbleStyle(status);
            
            status.onmouseover = () => {
                status.style.opacity = '1';
                status.style.textShadow = '0 0 8px rgba(255,255,255,0.5)';
            };
            status.onmouseout = () => {
                status.style.opacity = '0.8';
                status.style.textShadow = '';
            };
            status.onclick = showConfigPanel;
            document.body.appendChild(status);
        }
        
        applyBubblePosition(status);
        applyBubbleSize(status);
        
        if (currentConfig.showCount) {
            status.textContent = `🚫 ${blocked}`;
        } else {
            status.textContent = '🚫';
        }
        status.title = '点击配置屏蔽规则';
    }
    
    // 应用悬浮球样式
    function applyBubbleStyle(element) {
        element.style.cssText = `
            position: fixed;
            background: transparent;
            color: #333;
            border-radius: 4px;
            z-index: 10000;
            cursor: pointer;
            font-weight: bold;
            user-select: none;
            transition: opacity 0.2s, text-shadow 0.2s;
            opacity: 0.8;
            font-family: Arial, sans-serif;
            text-align: center;
            box-sizing: border-box;
        `;
    }
    
    // 应用悬浮球大小
    function applyBubbleSize(element) {
        let fontSize, padding, lineHeight;
        switch(currentConfig.bubbleSize) {
            case 'medium':
                fontSize = '14px';
                padding = '8px 12px';
                lineHeight = '1.2';
                break;
            case 'large':
                fontSize = '16px';
                padding = '10px 14px';
                lineHeight = '1.3';
                break;
            case 'larger':
                fontSize = '18px';
                padding = '12px 16px';
                lineHeight = '1.4';
                break;
            case 'xlarge':
                fontSize = '20px';
                padding = '14px 18px';
                lineHeight = '1.5';
                break;
            default:
                fontSize = '16px';
                padding = '10px 14px';
                lineHeight = '1.3';
        }
        
        element.style.fontSize = fontSize;
        element.style.padding = padding;
        element.style.lineHeight = lineHeight;
    }
    
    // 应用悬浮球位置
    function applyBubblePosition(element) {
        element.style.top = 'auto';
        element.style.bottom = 'auto';
        element.style.left = 'auto';
        element.style.right = 'auto';
        
        switch(currentConfig.bubblePosition) {
            case 'top-left':
                element.style.top = '15px';
                element.style.left = '15px';
                break;
            case 'top-right':
                element.style.top = '15px';
                element.style.right = '15px';
                break;
            case 'bottom-left':
                element.style.bottom = '15px';
                element.style.left = '15px';
                break;
            default:
                element.style.bottom = '15px';
                element.style.right = '15px';
        }
    }
    
    // 创建选项按钮
    function createOptionButtons(name, value, options) {
        const buttons = options.map(option => {
            const active = currentConfig[name] === option.value;
            return `<button type="button" class="option-button ${active ? 'active' : ''}" 
                    data-value="${option.value}" data-name="${name}">
                ${option.label}
            </button>`;
        }).join('');
        
        return `<div class="option-buttons">${buttons}</div>`;
    }
    
    // 显示配置面板
    function showConfigPanel() {
        const existing = document.getElementById('searchfilter-panel');
        if (existing) {
            existing.remove();
            return;
        }
        
        const panel = document.createElement('div');
        panel.id = 'searchfilter-panel';
        panel.style.cssText = `
            position: fixed;
            bottom: 60px;
            right: 10px;
            width: 310px;
            max-width: 90vw;
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 5px 15px 15px 15px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.08);
            z-index: 10001;
            font-size: 13px;
            box-sizing: border-box;
        `;
        
        // 悬浮球位置
        const positionOptions = [
            { value: 'top-left', label: '左上' },
            { value: 'top-right', label: '右上' },
            { value: 'bottom-left', label: '左下' },
            { value: 'bottom-right', label: '右下' }
        ];
        
        // 悬浮球大小
        const sizeOptions = [
            { value: 'medium', label: '中' },
            { value: 'large', label: '大' },
            { value: 'larger', label: '更大' },
            { value: 'xlarge', label: '超大' }
        ];
        
        // 面板UI
        panel.innerHTML = `
            <div style="display: flex; gap: 8px; margin-top: 10px; margin-bottom: 12px;">
                <label style="display: flex; align-items: center; flex: 1; justify-content: flex-start; white-space: nowrap;">
                    <input type="checkbox" id="searchfilter-enabled" ${currentConfig.enabled ? 'checked' : ''} style="margin-right: 4px;">
                    <span>启用屏蔽</span>
                </label>
                <label style="display: flex; align-items: center; flex: 1; justify-content: center; white-space: nowrap;">
                    <input type="checkbox" id="searchfilter-show-count" ${currentConfig.showCount ? 'checked' : ''} style="margin-right: 4px;">
                    <span>显示屏蔽数量</span>
                </label>
                <label style="display: flex; align-items: center; flex: 1; justify-content: flex-end; white-space: nowrap;">
                    <input type="checkbox" id="searchfilter-debug" ${currentConfig.debug ? 'checked' : ''} style="margin-right: 4px;">
                    <span>调试模式</span>
                </label>
            </div>
            
            <div class="option-row">
                <span class="option-label">悬浮球位置:</span>
                ${createOptionButtons('bubblePosition', currentConfig.bubblePosition, positionOptions)}
            </div>
            
            <div class="option-row">
                <span class="option-label">悬浮球大小:</span>
                ${createOptionButtons('bubbleSize', currentConfig.bubbleSize, sizeOptions)}
            </div>
            
            <div style="margin-bottom: 8px;">
                <div class="compact-row">
                    <span style="font-size: 12px; color: #4a5568;">屏蔽规则:</span>
                    <div style="display: flex; gap: 4px;">
                        <button id="searchfilter-import" class="searchfilter-button searchfilter-button-secondary" style="padding: 3px 8px; border: 1px solid transparent;">导入</button>
                        <button id="searchfilter-export" class="searchfilter-button searchfilter-button-success" style="padding: 3px 8px; border: 1px solid transparent;">导出</button>
                    </div>
                </div>
                <textarea id="searchfilter-rules" placeholder="每行一个规则">${currentConfig.rules.join('\n')}</textarea>
                <div style="font-size: 10px; color: #718096; margin-top: 3px; text-align: left;">
                example.* 匹配域名 | title/.*文本.* 匹配标题 | text/.*文本.* 匹配内容<br>
                title/(?i).*AbC.* 加(?i)忽略大小写 | title/.*A(B|C).* 同时匹配AB和AC
                </div>
            </div>
            
            <div style="display: flex; gap: 6px; margin-top: 8px;">
                <button id="searchfilter-save" class="searchfilter-button searchfilter-button-primary action-button" style="flex: 2;">保存</button>
                <button id="searchfilter-test" class="searchfilter-button searchfilter-button-secondary action-button" style="flex: 1;">测试</button>
                <button id="searchfilter-close" class="searchfilter-button searchfilter-button-danger action-button" style="flex: 1;">关闭</button>
            </div>
            
            <div id="searchfilter-test-result" style="margin-top: 10px; font-size: 12px; display: none;"></div>
        `;
        
        document.body.appendChild(panel);
        
        // 事件处理
        document.getElementById('searchfilter-save').onclick = saveConfig;
        document.getElementById('searchfilter-test').onclick = testRules;
        document.getElementById('searchfilter-close').onclick = () => panel.remove();
        document.getElementById('searchfilter-import').onclick = importRules;
        document.getElementById('searchfilter-export').onclick = exportRules;
        
        // 选项按钮事件处理
        panel.querySelectorAll('.option-button').forEach(button => {
            button.addEventListener('click', function() {
                const name = this.dataset.name;
                const value = this.dataset.value;
                
                // 更新当前配置
                currentConfig[name] = value;
                
                // 更新按钮状态
                const buttons = panel.querySelectorAll(`[data-name="${name}"]`);
                buttons.forEach(btn => {
                    btn.classList.toggle('active', btn.dataset.value === value);
                });
            });
        });
        
        // 点击外部关闭
        setTimeout(() => {
            document.addEventListener('click', function closePanel(e) {
                if (!panel.contains(e.target) && e.target.id !== 'searchfilter-status') {
                    panel.remove();
                    document.removeEventListener('click', closePanel);
                }
            });
        }, 100);
    }
    
    // 保存配置
    function saveConfig() {
        const panel = document.getElementById('searchfilter-panel');
        const rulesText = document.getElementById('searchfilter-rules').value;
        const enabled = document.getElementById('searchfilter-enabled').checked;
        const showCount = document.getElementById('searchfilter-show-count').checked;
        const debug = document.getElementById('searchfilter-debug').checked;
        
        currentConfig.rules = rulesText.split('\n')
            .map(rule => rule.trim())
            .filter(rule => rule.length > 0);
        currentConfig.enabled = enabled;
        currentConfig.showCount = showCount;
        currentConfig.debug = debug;
        
        GM_setValue(CONFIG_KEY, currentConfig);
        panel.remove();
        
        // 重置并重新屏蔽
        document.querySelectorAll('[data-blocker-processed]').forEach(el => {
            el.removeAttribute('data-blocker-processed');
        });
        
        const existingStatus = document.getElementById('searchfilter-status');
        if (existingStatus) existingStatus.remove();
        
        blockResults();
    }
    
    // 测试规则
    function testRules() {
        const rulesText = document.getElementById('searchfilter-rules').value;
        const testRules = rulesText.split('\n')
            .map(rule => rule.trim())
            .filter(rule => rule.length > 0);
        
        const engine = getSearchEngine();
        const results = document.querySelectorAll(selectors[engine]);
        
        // 统计规则数量和错误
        const ruleStats = {};
        const ruleErrors = {};
        
        results.forEach(result => {
            const link = getResultLink(result, engine);
            if (!link || !link.href) return;
            
            const url = link.href;
            let domain = '';
            try {
                domain = new URL(url).hostname;
            } catch (e) {
                domain = '';
            }
            
            const title = getResultTitle(result, engine) || '';
            const snippet = getResultSnippet(result, engine) || '';
            
            testRules.forEach(rule => {
                try {
                    if (checkRuleMatch(rule, url, domain, title, snippet)) {
                        if (!ruleStats[rule]) {
                            ruleStats[rule] = 0;
                        }
                        ruleStats[rule]++;
                    }
                } catch (e) {
                    if (!ruleErrors[rule]) {
                        ruleErrors[rule] = [];
                    }
                    ruleErrors[rule].push(e.message);
                }
            });
        });
        
        // 统计结果
        const ruleStatsArray = Object.entries(ruleStats)
            .map(([rule, count]) => ({ rule, count }))
            .sort((a, b) => b.count - a.count);
        
        const ruleErrorsArray = Object.entries(ruleErrors)
            .map(([rule, errors]) => ({ rule, errors: [...new Set(errors)] }));
        
        const testResultEl = document.getElementById('searchfilter-test-result');
        const rulesTextarea = document.getElementById('searchfilter-rules');
        
        // 重置容器初始样式
        testResultEl.style.maxHeight = 'none';
        testResultEl.style.overflowY = 'visible';
        testResultEl.style.paddingRight = '8px';
        testResultEl.style.boxSizing = 'border-box';
        
        // 测试结果
        let resultHTML = '';
        
        if (ruleErrorsArray.length > 0) {
            resultHTML += `<div style="color: #c53030; background: #fff5f5; padding: 8px; border-radius: 4px; margin-bottom: 12px;">
                <strong>⚠️ 发现 ${ruleErrorsArray.length} 个规则错误：</strong><br>`;
            
            ruleErrorsArray.forEach(item => {
                resultHTML += `<div style="margin: 4px 0; font-size: 11px;">
                    <div style="color: #2d3748;"><strong>规则：</strong>${item.rule}</div>
                    <div style="color: #c53030;"><strong>错误：</strong>${item.errors.join(', ')}</div>
                </div>`;
            });
            
            resultHTML += '</div>';
        }
        
        if (ruleStatsArray.length > 0) {
            const totalMatches = ruleStatsArray.reduce((sum, item) => sum + item.count, 0);
            
            resultHTML += `<div style="color: #2d3748; font-weight: bold; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px solid #e2e8f0;">共匹配 ${totalMatches} 条结果</div>`;
            
            // 显示匹配规则数量
            ruleStatsArray.forEach(item => {
                let ruleType = 'URL规则';
                if (item.rule.startsWith('title/')) ruleType = '标题规则';
                else if (item.rule.startsWith('text/')) ruleType = '正文规则';
                
                resultHTML += `
                    <div style="margin: 4px 0; padding: 6px 0; border-bottom: 1px solid #edf2f7;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
                            <span style="font-size: 11px; color: #718096;">${ruleType}</span>
                            <span style="font-size: 11px; color: #38a169; font-weight: bold;">匹配: ${item.count} 条</span>
                        </div>
                        <div style="font-size: 12px; color: #2d3748; word-break: break-all; font-family: 'Consolas', monospace;">${item.rule}</div>
                    </div>
                `;
            });

            // 有结果或错误时应用高度限制
            const maxHeight = Math.max(rulesTextarea.offsetHeight * 1.2, 150);
            testResultEl.style.maxHeight = maxHeight + 'px';
            testResultEl.style.overflowY = 'auto';
        } else if (ruleErrorsArray.length === 0) {
            resultHTML = '<div style="color: #38a169; padding: 10px; border-radius: 4px; font-size: 12px; background: #f0fff4; text-align: center; width: 100%; box-sizing: border-box; display: block;">无匹配项</div>';
            testResultEl.style.maxHeight = 'none';
            testResultEl.style.overflowY = 'visible';
            testResultEl.style.paddingRight = '0';
        }
        
        testResultEl.innerHTML = resultHTML;
        testResultEl.style.display = 'block';
        
        // 滚动
        setTimeout(() => {
            testResultEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);
    }
    
    // 导入规则
    function importRules() {
        const textarea = document.getElementById('searchfilter-rules');
        const importText = prompt('请粘贴规则（每行一个）:');
        if (importText !== null) {
            textarea.value = importText.split('\n')
                .map(rule => rule.trim())
                .filter(rule => rule.length > 0)
                .join('\n');
        }
    }
    
    // 导出规则
    function exportRules() {
        const textarea = document.getElementById('searchfilter-rules');
        const exportText = textarea.value;
        
        if (!exportText.trim()) {
            alert('没有规则可导出');
            return;
        }
        
        // 创建临时元素复制文本
        const temp = document.createElement('textarea');
        temp.value = exportText;
        document.body.appendChild(temp);
        temp.select();
        document.execCommand('copy');
        document.body.removeChild(temp);
        
        alert('规则已复制到剪贴板');
    }
    
    // 初始化
    function init() {
        blockResults();
        
        // 观察DOM变化
        const observer = new MutationObserver(() => {
            setTimeout(blockResults, 500);
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        // 处理滚动加载
        let timeout;
        window.addEventListener('scroll', () => {
            clearTimeout(timeout);
            timeout = setTimeout(blockResults, 300);
        });
        
        // 处理搜索表单提交
        const searchForm = document.querySelector('form[role="search"], form[name="search"], form[action*="search"]');
        if (searchForm) {
            searchForm.addEventListener('submit', () => {
                setTimeout(() => {
                    document.querySelectorAll('[data-blocker-processed]').forEach(el => {
                        el.removeAttribute('data-blocker-processed');
                    });
                }, 800);
            });
        }
    }
    
    // 启动
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        setTimeout(init, 1000);
    }
})();