## Debug

### 3.1 Environment Requirements

- Node.js 15+ 
- No extra dependencies

### 3.2 Running Tests

Put the test folder and the script in the same directory; tests auto-read the `.js` script in the parent directory, grouped by domain: conditions, rules, selectors & engines, cross-origin permissions.

```bash
# Run all tests
node test/test-conditions.cjs
node test/test-rules.cjs
node test/test-selectors.cjs
node test/test-connect.cjs

# Run specific test
node test/test-conditions.cjs 2>&1 | grep "FAIL"
```

Success output looks like `10 passed, 0 failed`

### 3.3 Debug Mode

Use the [Web Debug](https://greasyfork.org/zh-CN/scripts/475228) script or browser F12 DevTools  → Console tab to view output.

```javascript
const d = window.__SERH_DEBUG__;

// View current config
console.log('Current config:', d.config);

// View compiled rules
console.log('Compiled rules:', d.compiledRules);

// View search engine identification
console.log('Search engine:', d.getSearchEngine());

// View result count on current page
console.log('Result count:', document.querySelectorAll('div.g').length);

// Monitor rule matching performance
console.time('Rule matching');
d.checkRuleMatchOptimized(url, domain, title, snippet);
console.timeEnd('Rule matching');

// Monitor DOM query performance
console.time('Result query');
document.querySelectorAll(selector);
console.timeEnd('Result query');
```

Normal output

```bash
// Normal startup
[屏蔽] 引擎: google, 选择器: "div.g, div.MjjYud", 匹配数量: 15
[屏蔽] 未处理的新结果数量: 15
[屏蔽] 共屏蔽 3 个结果

// Means: Google engine identified, 15 results found, 3 blocked
```

Error output

```bash
// Rule syntax error
规则预编译失败: *://example.com/* Error: Invalid regex pattern

// Means: Rule syntax error, check the rule format
```
