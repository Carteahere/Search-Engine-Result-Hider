// ==UserScript==
// @name         Bing/Google屏蔽搜索结果
// @namespace    https://github.com/Carteahere
// @version      2.1
// @description  适用于Bing和Google，在搜索结果中移除屏蔽网站，支持正则表达式
// @author       南雪莲
// @license       MIT
// @match        https://www.bing.com/*
// @match        https://www.google.com/*
// @match        https://www.google.com.*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-idle
// @downloadURL none
// ==/UserScript==

(function() {
    'use strict';
    
    // 简化配置
    const CONFIG_KEY = 'search_blocker_simple';
    let currentConfig = GM_getValue(CONFIG_KEY, {
        rules: ['example\\.com'],
        enabled: true,
        showCount: true,
        bubbleSize: 'medium', // 悬浮球大小：medium, large, larger, xlarge
        bubblePosition: 'bottom-right' // 悬浮球位置：top-left, top-right, bottom-left, bottom-right
    });
    
    // 简化的搜索引擎检测
    function getSearchEngine() {
        const url = window.location.href;
        if (url.includes('bing.com')) return 'bing';
        if (url.includes('google.com')) return 'google';
        return 'other';
    }
    
    // 简化的选择器映射
    const selectors = {
        bing: 'li.b_algo',
        google: 'div.g, div[data-snf]',
        other: 'div.g, li.b_algo, .result, .c-container'
    };
    
    // 获取URL的域名
    function getDomain(url) {
        try {
            const domain = new URL(url).hostname;
            return domain.replace(/^www\./, '');
        } catch (e) {
            return url;
        }
    }
    
    // 恢复隐藏的结果
    function restoreHiddenResults() {
        const hiddenResults = document.querySelectorAll('[data-blocker-processed]');
        hiddenResults.forEach(result => {
            result.style.display = '';
            result.style.opacity = '';
            result.removeAttribute('data-blocker-processed');
        });
    }
    
    // 简化的屏蔽函数
    function blockResults() {
        // 禁用状态下也要更新状态显示
        if (!currentConfig.enabled) {
            updateStatus(0);
            restoreHiddenResults();
            return;
        }
        
        const engine = getSearchEngine();
        const selector = selectors[engine];
        const results = document.querySelectorAll(selector);
        
        let blocked = 0;
        results.forEach(result => {
            // 跳过已经处理过的结果
            if (result.hasAttribute('data-blocker-processed')) return;
            
            const link = result.querySelector('a[href]');
            if (!link || !link.href) return;
            
            const url = link.href;
            const domain = getDomain(url);
            
            const shouldBlock = currentConfig.rules.some(rule => {
                try {
                    const regex = new RegExp(rule);
                    return regex.test(url) || regex.test(domain);
                } catch (e) {
                    return url.includes(rule) || domain.includes(rule);
                }
            });
            
            if (shouldBlock) {
                // 添加动画效果后移除
                result.style.opacity = '0.5';
                result.style.transition = 'opacity 0.3s ease';
                
                setTimeout(() => {
                    result.style.display = 'none';
                    blocked++;
                    updateStatus(blocked);
                }, 300);
                
                result.setAttribute('data-blocker-processed', 'true');
            } else {
                result.setAttribute('data-blocker-processed', 'true');
            }
        });
        
        // 更新状态显示
        updateStatus(blocked);
    }
    
    // 简化的状态显示
    function updateStatus(blocked) {
        let status = document.getElementById('blocker-status');
        if (!status) {
            status = document.createElement('div');
            status.id = 'blocker-status';
            
            // 应用悬浮球大小和位置
            applyBubbleSize(status);
            applyBubblePosition(status);
            
            status.style.cssText += `
                position: fixed;
                background: transparent;
                color: #333;
                border-radius: 4px;
                z-index: 10000;
                cursor: pointer;
                font-family: Arial, sans-serif;
                font-weight: bold;
                text-shadow: 0 0 2px white;
                user-select: none;
            `;
            
            status.onclick = showSimplePanel;
            document.body.appendChild(status);
        } else {
            // 更新现有悬浮球的大小和位置
            applyBubbleSize(status);
            applyBubblePosition(status);
        }
        
        // 根据设置显示屏蔽数量
        if (currentConfig.showCount) {
            status.textContent = `🚫 ${blocked}`;
        } else {
            status.textContent = '🚫';
        }
        status.title = '点击配置屏蔽规则';
    }
    
    // 应用悬浮球大小
    function applyBubbleSize(element) {
        let fontSize, padding;
        switch(currentConfig.bubbleSize) {
            case 'large':
                fontSize = '14px';
                padding = '6px 10px';
                break;
            case 'larger':
                fontSize = '16px';
                padding = '8px 12px';
                break;
            case 'xlarge':
                fontSize = '18px';
                padding = '10px 14px';
                break;
            case 'medium':
            default:
                fontSize = '12px';
                padding = '5px 10px';
                break;
        }
        
        element.style.fontSize = fontSize;
        element.style.padding = padding;
    }
    
    // 应用悬浮球位置
    function applyBubblePosition(element) {
        // 重置所有位置属性
        element.style.top = 'auto';
        element.style.bottom = 'auto';
        element.style.left = 'auto';
        element.style.right = 'auto';
        
        // 根据配置设置位置
        switch(currentConfig.bubblePosition) {
            case 'top-left':
                element.style.top = '10px';
                element.style.left = '10px';
                break;
            case 'top-right':
                element.style.top = '10px';
                element.style.right = '10px';
                break;
            case 'bottom-left':
                element.style.bottom = '10px';
                element.style.left = '10px';
                break;
            case 'bottom-right':
            default:
                element.style.bottom = '10px';
                element.style.right = '10px';
                break;
        }
    }
    
    // 简化的配置面板
    function showSimplePanel() {
        // 移除已存在的面板
        const existing = document.getElementById('blocker-panel');
        if (existing) {
            existing.remove();
            return;
        }
        
        const panel = document.createElement('div');
        panel.id = 'blocker-panel';
        panel.style.cssText = `
            position: fixed;
            bottom: 50px;
            right: 10px;
            width: 320px;
            background: white;
            border: 1px solid #ccc;
            border-radius: 8px;
            padding: 15px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            z-index: 10001;
            font-family: Arial, sans-serif;
            font-size: 14px;
        `;
        
        panel.innerHTML = `
            <div style="margin-bottom: 10px;">
                <label>
                    <input type="checkbox" id="blocker-enabled" ${currentConfig.enabled ? 'checked' : ''}>
                    启用屏蔽
                </label>
            </div>
            <div style="margin-bottom: 10px;">
                <label>
                    <input type="checkbox" id="blocker-show-count" ${currentConfig.showCount ? 'checked' : ''}>
                    显示屏蔽数量
                </label>
            </div>
            <div style="margin-bottom: 10px;">
                <div style="font-size: 12px; margin-bottom: 5px; color: #333;">悬浮球位置:</div>
                <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                    <label style="font-size: 11px; display: flex; align-items: center;">
                        <input type="radio" name="bubble-position" value="top-left" ${currentConfig.bubblePosition === 'top-left' ? 'checked' : ''}> 左上角
                    </label>
                    <label style="font-size: 11px; display: flex; align-items: center;">
                        <input type="radio" name="bubble-position" value="top-right" ${currentConfig.bubblePosition === 'top-right' ? 'checked' : ''}> 右上角
                    </label>
                    <label style="font-size: 11px; display: flex; align-items: center;">
                        <input type="radio" name="bubble-position" value="bottom-left" ${currentConfig.bubblePosition === 'bottom-left' ? 'checked' : ''}> 左下角
                    </label>
                    <label style="font-size: 11px; display: flex; align-items: center;">
                        <input type="radio" name="bubble-position" value="bottom-right" ${currentConfig.bubblePosition === 'bottom-right' ? 'checked' : ''}> 右下角
                    </label>
                </div>
            </div>
            <div style="margin-bottom: 10px;">
                <div style="font-size: 12px; margin-bottom: 5px; color: #333;">悬浮球大小:</div>
                <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                    <label style="font-size: 11px; display: flex; align-items: center;">
                        <input type="radio" name="bubble-size" value="medium" ${currentConfig.bubbleSize === 'medium' ? 'checked' : ''}> 中
                    </label>
                    <label style="font-size: 11px; display: flex; align-items: center;">
                        <input type="radio" name="bubble-size" value="large" ${currentConfig.bubbleSize === 'large' ? 'checked' : ''}> 大
                    </label>
                    <label style="font-size: 11px; display: flex; align-items: center;">
                        <input type="radio" name="bubble-size" value="larger" ${currentConfig.bubbleSize === 'larger' ? 'checked' : ''}> 更大
                    </label>
                    <label style="font-size: 11px; display: flex; align-items: center;">
                        <input type="radio" name="bubble-size" value="xlarge" ${currentConfig.bubbleSize === 'xlarge' ? 'checked' : ''}> 超大
                    </label>
                </div>
            </div>
            <div style="margin-bottom: 10px;">
                <div style="font-size: 12px; margin-bottom: 5px; color: #333;">屏蔽规则 (每行一个):</div>
                <textarea id="blocker-rules" style="width: 100%; height: 120px; font-size: 12px; padding: 5px; border: 1px solid #ddd; border-radius: 4px; resize: vertical;">${currentConfig.rules.join('\n')}</textarea>
            </div>
            <div style="font-size: 11px; color: #666; margin-bottom: 10px;">
                支持正则表达式，如: example\\.com|spam-site\\.org<br>
                每行一个规则，匹配到的网站将被隐藏
            </div>
            <div style="display: flex; gap: 5px;">
                <button id="blocker-save" style="flex: 1; padding: 8px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">保存</button>
                <button id="blocker-test" style="padding: 8px; background: #2196F3; color: white; border: none; border-radius: 4px; cursor: pointer;">测试</button>
                <button id="blocker-close" style="padding: 8px; background: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer;">关闭</button>
            </div>
            <div id="blocker-test-result" style="margin-top: 10px; font-size: 12px; display: none;"></div>
        `;
        
        document.body.appendChild(panel);
        
        // 事件处理
        document.getElementById('blocker-save').onclick = () => {
            const rulesText = document.getElementById('blocker-rules').value;
            const enabled = document.getElementById('blocker-enabled').checked;
            const showCount = document.getElementById('blocker-show-count').checked;
            
            // 获取选中的悬浮球位置
            const positionRadios = document.querySelectorAll('input[name="bubble-position"]');
            let bubblePosition = 'bottom-right';
            for (const radio of positionRadios) {
                if (radio.checked) {
                    bubblePosition = radio.value;
                    break;
                }
            }
            
            // 获取选中的悬浮球大小
            const sizeRadios = document.querySelectorAll('input[name="bubble-size"]');
            let bubbleSize = 'medium';
            for (const radio of sizeRadios) {
                if (radio.checked) {
                    bubbleSize = radio.value;
                    break;
                }
            }
            
            currentConfig.rules = rulesText.split('\n')
                .map(rule => rule.trim())
                .filter(rule => rule.length > 0);
            currentConfig.enabled = enabled;
            currentConfig.showCount = showCount;
            currentConfig.bubblePosition = bubblePosition;
            currentConfig.bubbleSize = bubbleSize;
            
            GM_setValue(CONFIG_KEY, currentConfig);
            panel.remove();
            
            // 清除处理标记并重新应用规则
            document.querySelectorAll('[data-blocker-processed]').forEach(el => {
                el.removeAttribute('data-blocker-processed');
            });
            
            // 移除现有悬浮球，以便重新创建
            const existingStatus = document.getElementById('blocker-status');
            if (existingStatus) {
                existingStatus.remove();
            }
            
            blockResults();
        };
        
        document.getElementById('blocker-test').onclick = () => {
            const rulesText = document.getElementById('blocker-rules').value;
            const testRules = rulesText.split('\n')
                .map(rule => rule.trim())
                .filter(rule => rule.length > 0);
            
            const results = document.querySelectorAll(selectors[getSearchEngine()]);
            let testResults = [];
            
            results.forEach(result => {
                const link = result.querySelector('a[href]');
                if (!link || !link.href) return;
                
                const url = link.href;
                const domain = getDomain(url);
                
                const matchedRule = testRules.find(rule => {
                    try {
                        const regex = new RegExp(rule);
                        return regex.test(url) || regex.test(domain);
                    } catch (e) {
                        return url.includes(rule) || domain.includes(rule);
                    }
                });
                
                if (matchedRule) {
                    testResults.push({
                        domain: domain,
                        rule: matchedRule,
                        title: link.textContent.substring(0, 50) + '...'
                    });
                }
            });
            
            const testResultEl = document.getElementById('blocker-test-result');
            if (testResults.length > 0) {
                testResultEl.innerHTML = `<div style="color: #d32f2f; font-weight: bold;">测试结果 (${testResults.length}个匹配):</div>` +
                    testResults.slice(0, 5).map(r => 
                        `• ${r.domain} (规则: ${r.rule})`
                    ).join('<br>');
                if (testResults.length > 5) {
                    testResultEl.innerHTML += `<br>... 还有 ${testResults.length - 5} 个`;
                }
            } else {
                testResultEl.innerHTML = '<div style="color: #388e3c;">测试结果: 无匹配项</div>';
            }
            testResultEl.style.display = 'block';
        };
        
        document.getElementById('blocker-close').onclick = () => {
            panel.remove();
        };
        
        // 点击外部关闭
        setTimeout(() => {
            document.addEventListener('click', function closePanel(e) {
                if (!panel.contains(e.target) && e.target.id !== 'blocker-status') {
                    panel.remove();
                    document.removeEventListener('click', closePanel);
                }
            });
        }, 100);
    }
    
    // 简化的初始化
    function init() {
        // 初始屏蔽
        blockResults();
        
        // 优化的DOM观察
        let timeout;
        const observer = new MutationObserver((mutations) => {
            // 检查是否有新的搜索结果添加
            const hasNewResults = mutations.some(mutation => {
                return Array.from(mutation.addedNodes).some(node => {
                    if (node.nodeType === 1) { // Element node
                        const engine = getSearchEngine();
                        return node.matches && (node.matches(selectors[engine]) || 
                               node.querySelector && node.querySelector(selectors[engine]));
                    }
                    return false;
                });
            });
            
            if (hasNewResults) {
                clearTimeout(timeout);
                timeout = setTimeout(blockResults, 500);
            }
        });
        
        // 观察body的变化
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        // 滚动时延迟检查（针对无限滚动）
        window.addEventListener('scroll', () => {
            clearTimeout(timeout);
            timeout = setTimeout(blockResults, 300);
        });
        
        // 搜索表单提交时重置状态
        const searchForm = document.querySelector('form[role="search"], form[name="search"], form[action*="search"]');
        if (searchForm) {
            searchForm.addEventListener('submit', () => {
                setTimeout(() => {
                    document.querySelectorAll('[data-blocker-processed]').forEach(el => {
                        el.removeAttribute('data-blocker-processed');
                    });
                }, 1000);
            });
        }
    }
    
    // 延迟初始化，确保页面稳定
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        setTimeout(init, 1000);
    }
})();