// ==UserScript==
// @name         Bing屏蔽搜索结果
// @namespace    https://github.com/Carteahere
// @version      1.1
// @description  适用于Bing移动端，在搜索结果中移除屏蔽网站，支持正则表达式
// @author       南雪莲
// @license       MIT
// @match        https://www.bing.com/*
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
        enabled: true
    });
    
    // 简化的搜索引擎检测
    function getSearchEngine() {
        const url = window.location.href;
        if (url.includes('bing.com')) return 'bing';
        return 'other';
    }
    
    // 简化的选择器映射
    const selectors = {
        bing: 'li.b_algo',
        other: 'div.g, li.b_algo, .result, .c-container'
    };
    
    // 简化的屏蔽函数
    function blockResults() {
        if (!currentConfig.enabled) return;
        
        const engine = getSearchEngine();
        const selector = selectors[engine];
        const results = document.querySelectorAll(selector);
        
        let blocked = 0;
        results.forEach(result => {
            const link = result.querySelector('a[href]');
            if (!link || !link.href) return;
            
            const url = link.href;
            const shouldBlock = currentConfig.rules.some(rule => {
                try {
                    const regex = new RegExp(rule);
                    return regex.test(url);
                } catch (e) {
                    return url.includes(rule);
                }
            });
            
            if (shouldBlock) {
                result.style.display = 'none';
                blocked++;
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
            status.style.cssText = `
                position: fixed;
                bottom: 10px;
                right: 10px;
                background: #333;
                color: white;
                padding: 5px 10px;
                border-radius: 4px;
                font-size: 12px;
                z-index: 10000;
                cursor: pointer;
            `;
            status.onclick = showSimplePanel;
            document.body.appendChild(status);
        }
        status.textContent = `🚫 ${blocked}`;
        status.title = '点击配置屏蔽规则';
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
            width: 300px;
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
            <div style="margin-bottom: 10px; font-weight: bold;">搜索引擎屏蔽器</div>
            <div style="margin-bottom: 10px;">
                <label>
                    <input type="checkbox" id="blocker-enabled" ${currentConfig.enabled ? 'checked' : ''}>
                    启用屏蔽
                </label>
            </div>
            <div style="margin-bottom: 10px;">
                <div style="font-size: 12px; margin-bottom: 5px;">屏蔽规则 (每行一个):</div>
                <textarea id="blocker-rules" style="width: 100%; height: 100px; font-size: 12px; padding: 5px;">${currentConfig.rules.join('\n')}</textarea>
            </div>
            <div style="font-size: 11px; color: #666; margin-bottom: 10px;">
                支持正则表达式，如: example\\.com
            </div>
            <div style="display: flex; gap: 5px;">
                <button id="blocker-save" style="flex: 1; padding: 5px; background: #4CAF50; color: white; border: none; border-radius: 4px;">保存</button>
                <button id="blocker-close" style="padding: 5px; background: #f44336; color: white; border: none; border-radius: 4px;">关闭</button>
            </div>
        `;
        
        document.body.appendChild(panel);
        
        // 事件处理
        document.getElementById('blocker-save').onclick = () => {
            const rulesText = document.getElementById('blocker-rules').value;
            const enabled = document.getElementById('blocker-enabled').checked;
            
            currentConfig.rules = rulesText.split('\n').filter(rule => rule.trim());
            currentConfig.enabled = enabled;
            
            GM_setValue(CONFIG_KEY, currentConfig);
            panel.remove();
            blockResults(); // 重新应用规则
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
        
        // 简化的DOM观察 - 只在需要时执行
        let timeout;
        const observer = new MutationObserver(() => {
            clearTimeout(timeout);
            timeout = setTimeout(blockResults, 300);
        });
        
        // 只观察body的直接子元素变化，减少性能开销
        observer.observe(document.body, {
            childList: true,
            subtree: false
        });
        
        // 滚动时延迟检查
        window.addEventListener('scroll', () => {
            clearTimeout(timeout);
            timeout = setTimeout(blockResults, 200);
        });
    }
    
    // 延迟初始化，确保页面稳定
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        setTimeout(init, 1000);
    }
})();