## Testing Instructions

### 3.1 Environment Requirements

- Node.js 17+ 
- No extra dependencies

### 3.2 Running Tests

Place the `test` folder and the script in the same directory to run, the tests automatically read the `.js` script in the parent directory, divided by functional domain into: conditional expression parsing, WebDAV sync & subscription, rules logic, selectors & engines.

```bash
# Run all tests
node test/test-conditions.cjs
node test/test-connect.cjs
node test/test-rules.cjs
node test/test-selectors.cjs

# Run a specific test
node test/test-conditions.cjs 2>&1 | Select-String "failed"
```

Success output looks like `10 passed, 0 failed`

### 3.3 Debug Mode

Enable script debug mode, use the [网页调试](https://greasyfork.org/zh-CN/scripts/475228) script or the browser F12 DevTools → Console tab to view output.

```javascript
// Release version
const d = window.__SERH_DEBUG__;
// Lite version
const d = window.__SERHL_DEBUG__;

// View current config
console.log('Config:', d.config);

// View engine identification
console.log('Search engine:', d.getSearchEngine());

// Simulate result matching
d.checkRuleMatchOptimized(
  'https://www.example.com/page?a=1',   // Result URL
  'www.example.com',                    // Result domain
  'Page title',                         // Title
  'Page snippet'                        // Snippet
);
```

Normal output

```bash
// Normal startup
[屏蔽] 引擎: google, 选择器: "div.g, div.MjjYud", 匹配数量: 15
[屏蔽] 未处理的新结果数量: 15
[屏蔽] 共屏蔽 3 个结果

// Means: Google engine successfully identified, 15 results found, 3 blocked
```

Error output

```bash
// Rule syntax error
规则编译失败: *://example.com/* Error: Unbalanced regex

// Means: The rule syntax is wrong, the rule format needs to be checked
```
### 3.4 Debug API Examples

`window.__SERH_DEBUG__` (Lite: `window.__SERHL_DEBUG__`) is mounted only after debug mode is enabled, and is automatically cleared when debug mode is turned off.

| API | Signature | Return / Description |
| --- | --- | --- |
| config | getter | Current full config object (read-only reference) |
| compiledRules | getter | Compiled rule index: category arrays such as `domains`(Map), `urls`/`titles`/`texts`, `highlight*` |
| getSearchEngine() | () | Current engine ID (`google`/`bing`/…), returns `other` on non-engine sites |
| getSearchCategory(loc?) | (location?) | Current search type (default `web`) |
| getRootSelector(engine) | (engineId) | CSS selector string of the engine's result containers |
| getSubdomainLevels(domain) | (hostname) | Domain level array, e.g. `'a.b.example.com'` → `['a.b.example.com', 'b.example.com', 'example.com', 'com']` |
| checkRuleMatchOptimized(url, domain, title, snippet, subdomainLevels?) | 5th param can be omitted | `false` or `{highlight: N}` / `{blocked: true, rule, source}` / `{highlight: N, blocked: true, rule, source}` |
| forceReprocessAll() | () | Rebuilds the rule index and forces reprocessing of all results on the current page (batched 30 per frame), used for manual refresh after changing rules |

### 3.5 Rule Self-Check Reference Table

| Message | Example | Cause | Fix |
| --- | --- | --- | --- |
| Highlight index must be > 0 | `@0*://*.example.com/*` | Index `N` of `@N` is 0 | Change to `@1`–`@5` |
| Missing content after rule prefix | `title//` | Nothing after the prefix (`@`/`@N`/`title/`/`text/`) | Add the specific rule or regex content |
| Invalid URL wildcard format: {rule} | `@@*://example.com/*` | The `@@` prefix (uBO exception syntax) is unsupported, or the wildcard structure cannot be parsed | Remove the extra `@`, check the wildcard format (whitelist needs only a single `@`) |
| Invalid regex | `title/(unclosed/` | Unclosed slashes, regex syntax errors such as parentheses/quantifiers | Close the slashes, fix the regex syntax |
| Invalid regular expression flags: {flags} | `/x/g`, `title/x/gi` | `g`/`y` or a non-existent flag is used | Remove `g`/`y`, use only `i`/`m`/`s`/`u` |
| Unbalanced `@if(...)` parentheses | `*://x.com/* @if(title *= "a"` | The parentheses of `@if(` are not paired | Add the missing closing `)` |
| `@if()` condition cannot be empty | `*://x.com/* @if()` | No condition inside the parentheses | Enter a condition expression |
| Unknown `@if` condition: {part} | `@if(foo = "a")` | The condition key is not in the supported list (`$site`/`$category`/`site`/`title`/`text`/`url`/`host`/`path`/`scheme`) | Check the key spelling |
| Invalid condition regex: {part} | `@if(title =~ /(/)` | The `=~` regex inside `@if` is itself invalid syntax | Fix the regex |
| Syntax error in `@if` expression: {part} | `@if(title *= )` | The condition expression is missing an operand, the parenthesis grouping is incomplete, etc. | Complete the expression |
| Invalid URL rule | The wildcard rule cannot be compiled after conversion to a regex | Internal URL wildcard exception | Simplify the rule structure and retry |
| Element rules are not supported | `example.com##div.x` | The rule contains uBO rules such as `##`/`#@#` | Delete the corresponding rule |