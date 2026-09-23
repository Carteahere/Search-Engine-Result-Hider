// ==UserScript==
// @name         搜索引擎结果屏蔽器
// @name:zh-CN   搜索引擎结果屏蔽器
// @name:en      Search Engine Result Hider
// @namespace    https://github.com/Carteahere
// @version      5.8.0
// @description        支持uBlacklist规则的Bing/Google/DuckDuckGo搜索结果屏蔽工具
// @description:zh-CN  支持uBlacklist规则的Bing/Google/DuckDuckGo搜索结果屏蔽工具
// @description:en     A search result blocking tool for Bing/Google/DuckDuckGo that supports uBlacklist rules.
// @icon         data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAMAAACdt4HsAAACSVBMVEUAAAAdAAAhAAA5AAA9AABSAANBAABPAABaAASzAAJpAABMAANOAANJAAJoAANaAgRLAARcAANhAANNAAZkAwVLAAZlAANHAAV7AAJmAANaAANIAAVVAARwBwljAARRAAZvAANXAAVtAANNAAXhAAC+AACWCwx4AQRgAANsAANNAAVPAAZrAAOPEhNpAANmAANZAAVRAAVVAAZbAQVoAANNAAVXAAbPAACMCgxyAARgAAWbAAKkGRltAAJOAAWXAAFkAAVsAAOhAAF8AwaoGxtYAAebAABvAAOrAAGlAABpAAVVAAVzAARcAAVWAAZRAAX9Wlb9SkfsUE34Skf9Qz78Pzv8PDn8Ojb5Ozf7NzP4NzTvODXnODXbOjXoMzDbMzH1JiTlJSPTKifyHBntHRrZIiDxFRLNJCPEKCbeGxnwEA3TGhfFHx3pDQq7Hx/WExHhDQvMExGvHB22GRnEEhHsAADrAADqAADmAADgAACpFRe1Dw/UAAChFRbKAACtCwvDAACgDA2UERG7AACRERK4AACyAACRCw2pAACiAACICgufAACcAAGZAAGSAACPAAKMAAOJAAOFAAKAAAN9AAR6AAR4AAR2AAV0AARvAAVtAAZpAAZmAAZhAAdcAAb6MS72MS71LSr3KSX0JSH1IR70HRnyGBXuFBLtDw3tCgnrCAftBATqBATtAADrAADqAADpAADjAADdAADbAADYAADQAADNAADHAADAAAC9AAC2AAGwAAGuAAGsAACmAAGVAAGCAANxAAVZAAeYwP/6AAAAw3RSTlMABAoYIy00PEFGRkZNUlVZXV9kZ21tdXZ5e3t/gYKIiYqPk5ifoKChoaepsrS3t7e4ubzBwsLIzMzR0dPX29rd4eTm6Ovq7e3w9Pb2+fn7+/39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f3+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7nrWDnAAAID0lEQVR42o2ViV9TVxaAE0HoDNSFUaxLVWRGZdTWuo3bWLXTsRVEbVkCzGhqNNaoyKj3vkRDVGJSEEL2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
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
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';
    
    // 默认配置
    const CONFIG_KEY = 'searchfilter_blocker';
    let currentConfig = GM_getValue(CONFIG_KEY, {
        rules: ['*://*.example.com/*'],
        enabled: true,
        showCount: false,
        bubbleSize: 'large',
        bubblePosition: 'bottom-right',
        debug: false,
        showBlockBtn: false,
        blockDomain: false,
        blockConfirm: true,
        showBubble: true
    });
    
    // 兼容
    if (currentConfig.showBlockBtn === undefined) currentConfig.showBlockBtn = false;
    if (currentConfig.blockDomain === undefined) currentConfig.blockDomain = false;
    if (currentConfig.blockConfirm === undefined) currentConfig.blockConfirm = false;
    if (currentConfig.showBubble === undefined) currentConfig.showBubble = true;
    
    // 样式
    GM_addStyle(`
        /* 预留高度用于翻页 */
        body { min-height: 101vh !important; }
        #rcnt, #rso { min-height: 60vh; }
        
        #searchfilter-panel {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 13px;
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
        
        .rules-container {
            display: flex;
            border: 1px solid #e2e8f0;
            border-radius: 4px;
            background: #f8fafc;
            height: 150px;
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
            overflow-x: hidden;
            overflow-y: auto;
            outline: none;
        }
        
        #searchfilter-rules::-webkit-scrollbar { width: 6px; height: 6px; }
        #searchfilter-rules::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 3px; }
        #searchfilter-rules::-webkit-scrollbar-thumb { background: #c1c1c1; border-radius: 3px; }
        #searchfilter-rules::-webkit-scrollbar-thumb:hover { background: #a8a8a8; }
        
        #searchfilter-test-result {
            max-height: 150px;
            overflow-y: auto;
            padding-right: 8px;
            box-sizing: border-box;
            margin-top: 10px;
        }
        
        #searchfilter-test-result::-webkit-scrollbar { width: 6px; height: 6px; }
        #searchfilter-test-result::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 3px; }
        #searchfilter-test-result::-webkit-scrollbar-thumb { background: #c1c1c1; border-radius: 3px; }
        #searchfilter-test-result::-webkit-scrollbar-thumb:hover { background: #a8a8a8; }
        
        .searchfilter-quick-block {
            position: absolute;
            cursor: pointer;
            font-size: 16px;
            color: #000;
            z-index: 99;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
            background: transparent;
            transition: transform 0.2s, opacity 0.2s;
            user-select: none;
            opacity: 0.8;
            filter: grayscale(1) brightness(0);
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
        
        /* 深色模式切换 */
        @media (prefers-color-scheme: dark) {
            .searchfilter-quick-block {
                filter: grayscale(1) brightness(0) invert(1);
                opacity: 0.9;
            }
        }
        
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
        google: 'div.g, div.MjjYud', 
        duckduckgo: '[data-testid="result"], .result, .web-result, .tile, .tile--ad',
        other: 'div.g, li.b_algo'
    };

    // 语法检查
    function validateRule(rule) {
        if (!rule || rule.trim() === '') return true;
        
        try {
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
                
                if (!flags && remaining.endsWith('/')) {
                    pattern = remaining.slice(0, -1);
                }
                
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
                
                new RegExp(pattern, flags);
                return true;
            } else {
                let pattern = rule;
                if (pattern.startsWith('*://')) {
                    pattern = pattern.substring(4);
                }
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
                new RegExp(pattern, 'i');
                return true;
            }
        } catch (e) {
            return false;
        }
    }
    
    // 处理URL和标题规则
    function ruleToRegex(rule) {
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
            
            if (!flags && remaining.endsWith('/')) {
                pattern = remaining.slice(0, -1);
            }

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
        
        let pattern = rule;
        
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
            pattern = pattern
                .replace(/\*/g, '.*')
                .replace(/\?/g, '\\?')
                .replace(/(?<!\\)\./g, '\\.');
        }
        
        return { pattern, flags: 'i' };
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
            if (elem && elem.textContent) {
                return elem.textContent.trim();
            }
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
        
        if (!flags && remaining.endsWith('/')) {
            pattern = remaining.slice(0, -1);
        }
        
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
            console.error('正文规则解析错误:', e, '规则:', rule);

            const simplePattern = pattern.replace(/^\(\?[ims]+\)/, '');
            if (flags.includes('i')) {
                return snippet.toLowerCase().includes(simplePattern.toLowerCase());
            }
            return snippet.includes(simplePattern);
        }
    }
    
    // 检查规则匹配函数
    function checkRuleMatch(rule, url, domain, title, snippet) {
        if (rule.startsWith('text/')) {
            return checkTextRule(rule, snippet);
        }
        
        if (rule.startsWith('title/')) {
            try {
                const { pattern, flags } = ruleToRegex(rule);
                
                if (!title || title.trim() === '') return false;
                
                const regex = new RegExp(pattern, flags);
                const matches = regex.test(title);
                
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
                
                try {
                    const simplePattern = rule.substring(6).replace(/^\(\?[ims]+\)/, '');
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
            
            try {
                const simpleRule = rule.replace('*://', '').replace(/\*/g, '');
                return url.includes(simpleRule) || domain.includes(simpleRule);
            } catch (e2) {
                console.error('URL规则回退匹配失败:', e2);
                return false;
            }
        }
    }
    
    // 屏蔽按钮
    function injectBlockButton(result, engine, url, domain) {
        if (!domain) return;
        
        if (result.closest('header, [role="navigation"], [role="tablist"], [role="search"], g-scrolling-carousel, #hdtb, #appbar, #searchform, #top_nav')) {
            return;
        }
        
        // 跳过Google图片
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
        btn.innerHTML = '🚫';
        btn.title = '屏蔽此词条';
        
        if (window.getComputedStyle(result).position === 'static') {
            result.style.position = 'relative';
        }
        
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
                if (!confirm(`确定要屏蔽并添加规则 [ ${newRule} ] 吗？`)) {
                    return;
                }
            }
            
            if (!currentConfig.rules.includes(newRule)) {
                currentConfig.rules.push(newRule);
                GM_setValue(CONFIG_KEY, currentConfig);
                
                const textarea = document.getElementById('searchfilter-rules');
                if (textarea) {
                    textarea.value = currentConfig.rules.join('\n');
                    updateLineNumbers();
                }
                
                document.querySelectorAll('.searchfilter-quick-block').forEach(b => b.remove());
                document.querySelectorAll('[data-blocker-processed]').forEach(el => {
                    el.removeAttribute('data-blocker-processed');
                });
                blockResults();
            } else {
                result.style.display = 'none';
            }
        };
        
        result.appendChild(btn);
    }
    
    // 屏蔽结果逻辑
    function blockResults() {
        if (!currentConfig.enabled) {
            updateStatus(0);
            document.querySelectorAll('[data-blocker-processed]').forEach(result => {
                result.style.display = '';
                result.removeAttribute('data-blocker-processed');
                result.removeAttribute('data-is-blocked');
            });
            return;
        }
        
        const engine = getSearchEngine();
        const selector = selectors[engine];
        const results = document.querySelectorAll(selector);
        
        results.forEach(result => {
            const isProcessed = result.hasAttribute('data-blocker-processed');
            const isBlocked = result.hasAttribute('data-is-blocked');
            
            if (isBlocked) return;
            
            const link = getResultLink(result, engine);
            if (!link || !link.href) return;
            
            const url = link.href;
            let domain;
            try {
                domain = new URL(url).hostname;
            } catch (e) {
                domain = '';
            }
            
            if (isProcessed) {
                if (currentConfig.showBlockBtn && !result.querySelector('.searchfilter-quick-block')) {
                    injectBlockButton(result, engine, url, domain);
                }
                return;
            }
            
            const title = getResultTitle(result, engine);
            const snippet = getResultSnippet(result, engine);
            
            const shouldBlock = currentConfig.rules.some(rule => {
                return checkRuleMatch(rule, url, domain, title, snippet);
            });
            
            if (shouldBlock) {
                result.style.display = 'none';
                result.setAttribute('data-blocker-processed', 'true');
                result.setAttribute('data-is-blocked', 'true');
                
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
                if (currentConfig.showBlockBtn) {
                    injectBlockButton(result, engine, url, domain);
                }
            }
        });
        
        const totalBlocked = document.querySelectorAll('[data-is-blocked="true"]').length;
        updateStatus(totalBlocked);
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
            if (elem && elem.textContent) {
                return elem.textContent.trim();
            }
        }
        return '';
    }
    
    // 更新状态显示
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
    
    // 悬浮球样式
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
    
    // 悬浮球大小
    function applyBubbleSize(element) {
        let fontSize, padding, lineHeight;
        switch(currentConfig.bubbleSize) {
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
    
    // 悬浮球位置
    function applyBubblePosition(element) {
        element.style.top = 'auto';
        element.style.bottom = 'auto';
        element.style.left = 'auto';
        element.style.right = 'auto';
        
        switch(currentConfig.bubblePosition) {
            case 'top-left':
                element.style.top = '5px';
                element.style.left = '5px';
                break;
            case 'top-right':
                element.style.top = '5px';
                element.style.right = '5px';
                break;
            case 'bottom-left':
                element.style.bottom = '5px';
                element.style.left = '5px';
                break;
            default:
                element.style.bottom = '5px';
                element.style.right = '5px';
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
    
    // 行号与语法检查
    function updateLineNumbers() {
        const textarea = document.getElementById('searchfilter-rules');
        const lineNums = document.getElementById('searchfilter-line-numbers');
        if (!textarea || !lineNums) return;
        
        const lines = textarea.value.split('\n');
        let html = '';
        
        for (let i = 0; i < lines.length; i++) {
            const rule = lines[i];
            const isValid = validateRule(rule);
            
            const warnIcon = isValid ? '' : '<span style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); font-size: 10px; cursor: help; background: #edf2f7; z-index: 1;" title="语法错误 (可能降级为普通字符匹配)">⚠️</span>';
            
            html += `<div style="position: relative; color: #a0aec0;">${i + 1}${warnIcon}</div>`;
        }
        
        lineNums.innerHTML = html;
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
        
        let positionCSS = '';
        switch(currentConfig.bubblePosition) {
            case 'top-left':
                positionCSS = 'top: 60px; left: 10px;';
                break;
            case 'top-right':
                positionCSS = 'top: 60px; right: 10px;';
                break;
            case 'bottom-left':
                positionCSS = 'bottom: 60px; left: 10px;';
                break;
            case 'bottom-right':
            default:
                positionCSS = 'bottom: 60px; right: 10px;';
        }
        
        panel.style.cssText = `
            position: fixed;
            ${positionCSS}
            width: 325px;
            max-width: 90vw;
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 5px 15px 15px 15px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.08);
            z-index: 10001;
            font-size: 13px;
            box-sizing: border-box;
            transition: all 0.3s ease;
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
            { value: 'medium', label: '中杯' },
            { value: 'large', label: '大杯' },
            { value: 'larger', label: '超大' },
            { value: 'xlarge', label: '特大' }
        ];
        
        // 面板UI
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
                    <span>屏蔽按钮</span>
                </label>
                <label style="display: flex; align-items: center; flex: 1; justify-content: center; white-space: nowrap;">
                    <input type="checkbox" id="searchfilter-block-domain" ${currentConfig.blockDomain ? 'checked' : ''} style="margin-right: 4px;">
                    <span>屏蔽域名</span>
                </label>
                <label style="display: flex; align-items: center; flex: 1; justify-content: flex-end; white-space: nowrap;">
                    <input type="checkbox" id="searchfilter-block-confirm" ${currentConfig.blockConfirm ? 'checked' : ''} style="margin-right: 4px;">
                    <span>屏蔽确认</span>
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
                        <button id="searchfilter-import-file" class="searchfilter-button searchfilter-button-secondary" style="padding: 3px 8px; border: 1px solid transparent;" title="从TXT文件导入">导入</button>
                        <button id="searchfilter-export-file" class="searchfilter-button searchfilter-button-success" style="padding: 3px 8px; border: 1px solid transparent;" title="导出到TXT文件">导出</button>
                        <button id="searchfilter-import" class="searchfilter-button searchfilter-button-secondary" style="padding: 3px 8px; border: 1px solid transparent;" title="从剪贴板导入">粘贴</button>
                        <button id="searchfilter-export" class="searchfilter-button searchfilter-button-success" style="padding: 3px 8px; border: 1px solid transparent;" title="导出到剪贴板">复制</button>
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
                title/.*AbC.*/i 加i忽略大小写 | title/.*A(B|C).*/ 同时匹配AB和AC
                </div>
            </div>
            
            <div style="display: flex; gap: 6px; margin-top: 8px;">
                <button id="searchfilter-save" class="searchfilter-button searchfilter-button-primary action-button" style="flex: 2;">保存</button>
                <button id="searchfilter-test" class="searchfilter-button searchfilter-button-secondary action-button" style="flex: 1;">统计</button>
                <button id="searchfilter-close" class="searchfilter-button searchfilter-button-danger action-button" style="flex: 1;">关闭</button>
            </div>
            
            <div id="searchfilter-test-result" style="margin-top: 10px; font-size: 12px; display: none;"></div>
        `;
        
        document.body.appendChild(panel);
        
        // 初始化行号
        updateLineNumbers();
        
        const textarea = document.getElementById('searchfilter-rules');
        const lineNums = document.getElementById('searchfilter-line-numbers');
        
        textarea.addEventListener('input', updateLineNumbers);
        
        textarea.addEventListener('scroll', () => {
            lineNums.scrollTop = textarea.scrollTop;
        });

        // 事件处理
        document.getElementById('searchfilter-save').onclick = saveConfig;
        document.getElementById('searchfilter-test').onclick = testRules;
        document.getElementById('searchfilter-close').onclick = () => panel.remove();
        document.getElementById('searchfilter-import').onclick = importRules;
        document.getElementById('searchfilter-export').onclick = exportRules;
        document.getElementById('searchfilter-import-file').onclick = (e) => {
           e.stopPropagation();
           importRulesFromFile();
        };
        document.getElementById('searchfilter-export-file').onclick = exportRulesToFile;
        
        // 滚动事件
        document.getElementById('searchfilter-scroll-top').onclick = () => {
            textarea.scrollTo({ top: 0, behavior: 'smooth' });
        };
        document.getElementById('searchfilter-scroll-bottom').onclick = () => {
            textarea.scrollTo({ top: textarea.scrollHeight, behavior: 'smooth' });
        };
        
        panel.querySelectorAll('.option-button').forEach(button => {
            button.addEventListener('click', function() {
                const name = this.dataset.name;
                const value = this.dataset.value;
                
                currentConfig[name] = value;
                
                const buttons = panel.querySelectorAll(`[data-name="${name}"]`);
                buttons.forEach(btn => {
                    btn.classList.toggle('active', btn.dataset.value === value);
                });
                
                if (name === 'bubblePosition') {
                    panel.style.top = 'auto';
                    panel.style.bottom = 'auto';
                    panel.style.left = 'auto';
                    panel.style.right = 'auto';
                    
                    switch(value) {
                        case 'top-left':
                            panel.style.top = '60px';
                            panel.style.left = '10px';
                            break;
                        case 'top-right':
                            panel.style.top = '60px';
                            panel.style.right = '10px';
                            break;
                        case 'bottom-left':
                            panel.style.bottom = '60px';
                            panel.style.left = '10px';
                            break;
                        case 'bottom-right':
                        default:
                            panel.style.bottom = '60px';
                            panel.style.right = '10px';
                    }
                    
                    const statusBtn = document.getElementById('searchfilter-status');
                    if (statusBtn) applyBubblePosition(statusBtn);
                }
            });
        });
        
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
        
        const showBlockBtn = document.getElementById('searchfilter-show-block-btn').checked;
        const blockDomain = document.getElementById('searchfilter-block-domain').checked;
        const blockConfirm = document.getElementById('searchfilter-block-confirm').checked;
        
        currentConfig.rules = rulesText.split('\n')
            .map(rule => rule.trim())
            .filter(rule => rule.length > 0);
        currentConfig.enabled = enabled;
        currentConfig.showCount = showCount;
        currentConfig.debug = debug;
        currentConfig.showBlockBtn = showBlockBtn;
        currentConfig.blockDomain = blockDomain;
        currentConfig.blockConfirm = blockConfirm;
        
        GM_setValue(CONFIG_KEY, currentConfig);
        panel.remove();
        
        document.querySelectorAll('.searchfilter-quick-block').forEach(btn => btn.remove());
        
        document.querySelectorAll('[data-blocker-processed]').forEach(el => {
            el.removeAttribute('data-blocker-processed');
        });
        
        const existingStatus = document.getElementById('searchfilter-status');
        if (existingStatus) existingStatus.remove();
        
        blockResults();
    }
    
    // 测试统计
    function testRules() {
        const rulesText = document.getElementById('searchfilter-rules').value;
        const testRules = rulesText.split('\n')
            .map(rule => rule.trim())
            .filter(rule => rule.length > 0);
        
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
        
        const ruleStatsArray = Object.entries(ruleStats)
            .map(([rule, count]) => ({ rule, count }))
            .sort((a, b) => b.count - a.count);
        
        const ruleErrorsArray = Object.entries(ruleErrors)
            .map(([rule, errors]) => ({ rule, errors: [...new Set(errors)] }));
        
        const testResultEl = document.getElementById('searchfilter-test-result');
        const rulesTextarea = document.getElementById('searchfilter-rules');
        
        testResultEl.style.maxHeight = 'none';
        testResultEl.style.overflowY = 'visible';
        testResultEl.style.paddingRight = '8px';
        testResultEl.style.boxSizing = 'border-box';
        
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
        
        setTimeout(() => {
            testResultEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);
    }
    
    // 从剪贴板导入规则
    function importRules() {
        const textarea = document.getElementById('searchfilter-rules');
        const importText = prompt('请粘贴规则（每行一个）:');
        if (importText !== null) {
            let rules = importText.split('\n')
                .map(rule => rule.trim())
                .filter(rule => rule.length > 0);
            if (rules.length === 0) {
                const confirmClear = confirm('当前剪贴板为空，若继续导入将会清空规则');
                if (confirmClear) {
                    textarea.value = '';
                }
            } else {
                textarea.value = rules.join('\n');
            }
            updateLineNumbers();
        }
    }
    
    // 导出规则到剪贴板
    function exportRules() {
        const textarea = document.getElementById('searchfilter-rules');
        const exportText = textarea.value;
        
        if (!exportText.trim()) {
            alert('没有规则可导出');
            return;
        }
        
        const temp = document.createElement('textarea');
        temp.value = exportText;
        document.body.appendChild(temp);
        temp.select();
        document.execCommand('copy');
        document.body.removeChild(temp);
        
        alert('规则已复制到剪贴板');
    }
    
    // 从TXT导入规则
    function importRulesFromFile() {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.txt,text/plain';
        fileInput.style.display = 'none';
        fileInput.addEventListener('click', e => e.stopPropagation());
        document.body.appendChild(fileInput);
        
        fileInput.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) {
                document.body.removeChild(fileInput);
                return;
            }
            
            const reader = new FileReader();
            reader.onload = (event) => {
                const content = event.target.result;
                const textarea = document.getElementById('searchfilter-rules');
                if (textarea) {
                    textarea.value = content;
                    updateLineNumbers();
                }
                document.body.removeChild(fileInput);
            };
            reader.onerror = () => {
                alert('读取文件失败');
                document.body.removeChild(fileInput);
            };
            reader.readAsText(file, 'UTF-8');
        };
        
        fileInput.click();
    }
    
    // 导出规则到TXT
    function exportRulesToFile() {
        const textarea = document.getElementById('searchfilter-rules');
        const content = textarea.value;
        
        if (!content.trim()) {
            alert('没有规则可导出');
            return;
        }
        
        const now = new Date();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        const filename = `rules-${month}-${day}-${hours}${minutes}${seconds}.txt`;
        
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        
        a.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    
    // 管理器菜单
    function registerMenu() {
        GM_registerMenuCommand("⚙️ 打开配置面板", () => {
            showConfigPanel();
        });
        
        const enabledLabel = currentConfig.enabled ? "🟢 屏蔽功能：启用" : "🔴 屏蔽功能：关闭";
        GM_registerMenuCommand(enabledLabel, () => {
            currentConfig.enabled = !currentConfig.enabled;
            GM_setValue(CONFIG_KEY, currentConfig);
            location.reload();
        });
        
        const confirmLabel = currentConfig.blockConfirm ? "🟢 屏蔽确认：启用" : "🔴 屏蔽确认：关闭";
        GM_registerMenuCommand(confirmLabel, () => {
            currentConfig.blockConfirm = !currentConfig.blockConfirm;
            GM_setValue(CONFIG_KEY, currentConfig);
            location.reload(); 
        });
        
        const bubbleLabel = currentConfig.showBubble ? "🟢 悬浮球状态：显示" : "🔴 悬浮球状态：隐藏";
        GM_registerMenuCommand(bubbleLabel, () => {
            currentConfig.showBubble = !currentConfig.showBubble;
            GM_setValue(CONFIG_KEY, currentConfig);
            location.reload(); 
        });
    }
    
    // 初始化
    function init() {
        registerMenu();
        blockResults();
        
        const observer = new MutationObserver(() => {
            setTimeout(blockResults, 500);
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        let timeout;
        window.addEventListener('scroll', () => {
            clearTimeout(timeout);
            timeout = setTimeout(blockResults, 300);
        });
        
        const searchForm = document.querySelector('form[role="search"], form[name="search"], form[action*="search"]');
        if (searchForm) {
            searchForm.addEventListener('submit', () => {
                setTimeout(() => {
                    document.querySelectorAll('.searchfilter-quick-block').forEach(btn => btn.remove());
                    document.querySelectorAll('[data-blocker-processed]').forEach(el => {
                        el.removeAttribute('data-blocker-processed');
                    });
                }, 800);
            });
        }
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        setTimeout(init, 1000);
    }
})();