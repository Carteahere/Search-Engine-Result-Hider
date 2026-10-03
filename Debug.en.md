## Debug

### 3.1 Environment Requirements

- Node.js 17+ 
- No extra dependencies

### 3.2 Running Tests

Put the `test` folder and the script in the same directory, tests auto read the first `.js` script in the parent directory, grouped by domain: conditions, rules, selectors & engines, cross-origin permissions.

```bash
# Run all tests
node test/test-conditions.cjs
node test/test-rules.cjs
node test/test-selectors.cjs
node test/test-connect.cjs

# Run specific test
node test/test-conditions.cjs 2>&1 | Select-String "failed"
```

Success output looks like `10 passed, 0 failed`

### 3.3 Debug Mode

Enable script debug mode, use the [Web Debug](https://greasyfork.org/zh-CN/scripts/475228) script or browser F12 DevTools → Console tab to view output.

```javascript
const d = window.__SERH_DEBUG__;

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

// Means: Google engine identified, 15 results found, 3 blocked
```

Error output

```bash
// Rule syntax error
规则预编译失败: *://example.com/* Error: Invalid regex pattern

// Means: Rule syntax error, check the rule format
```

### 3.4 Debug API Examples

`window.__SERH_DEBUG__` is only mounted after debug mode is enabled, and is removed automatically when debug mode is turned off.

| API | Signature | Return / Description |
| --- | --- | --- |
| config | getter | Full current config object (read-only reference) |
| compiledRules | getter | Compiled rule index: `domains`(Map), `urls`/`titles`/`texts`, `highlight*`, `whitelist*`, `conditional*` category arrays |
| getSearchEngine() | () | Current engine ID (`google`/`bing`/…); returns `other` on non-engine sites |
| getSearchCategory(loc?) | (location?) | Current search type: `web`/`images`/`videos`/`news` |
| getContainerSelector(engine) | (engineId) | CSS selector string of the engine's result containers |
| getSubdomainLevels(domain) | (hostname) | Domain level array, e.g. `'a.b.example.com'` → `['a.b.example.com', 'b.example.com', 'example.com', 'com']` |
| checkRuleMatchOptimized(url, domain, title, snippet, subdomainLevels?) | 5th param optional | `false`, or `{highlight: N}` / `{blocked: true, rule, source}` / `{highlight: N, blocked: true, rule, source}` |
| forceReprocessAll() | () | Rebuilds the rule index and forces reprocessing of all results on the current page (batched 30 per frame); for manual refresh after changing rules |

### 3.5 Rules Detection Reference Table

| Message | Example | Cause | Fix |
| --- | --- | --- | --- |
| Highlight level must be 1-5 | `@6*://*.example.com/*` | `@N` out of the `@1`–`@5` range | Use `@1`–`@5` |
| Missing content after rule prefix | `title//` | Nothing after the prefix (`@`/`@N`/`title/`/`text/`) | Add the actual rule or regex content |
| Invalid URL wildcard format: {rule} | `@@*://example.com/*` | The `@@` prefix (uBO exception syntax) is unsupported; or the wildcard structure cannot be parsed | Remove the extra `@`; check the wildcard format (whitelist needs only a single `@`) |
| Invalid regex | `title/(unclosed/` | Unclosed slashes, invalid groups/quantifiers, etc. | Close the slashes, fix the regex syntax |
| Invalid regular expression flags: {flags} | `/x/g`, `title/x/gi` | `g`/`y` are unsupported (the script only tests for a match); or a non-existent flag | Remove `g`/`y`, use only `i`/`m`/`s`/`u` |
| Unbalanced `@if(...)` parentheses | `*://x.com/* @if(title *= "a"` | Parentheses of `@if(` are not paired | Add the closing `)` |
| `@if()` condition cannot be empty | `*://x.com/* @if()` | No condition inside the parentheses | Enter a condition expression |
| Unknown `@if` condition: {part} | `@if(foo = "a")` | Key not in the supported list (`$site`/`$category`/`site`/`title`/`url`/`host`/`path`/`scheme`) | Check the key spelling |
| Invalid condition regex: {part} | `@if(title =~ /(/)` | The `=~` regex inside `@if` is itself invalid | Fix the regex |
| Syntax error in `@if` expression: {part} | `@if(title *= )` | Missing operand, incomplete parenthesis grouping, etc. | Complete the expression |
| Invalid URL rule | Wildcard rule fails to compile into a regex | Internal wildcard conversion exception | Simplify the rule structure and retry |
| Element rules are not supported | `example.com##div.x` |  Rule contains DOM/uBO rules such as `##`/`#@#` | Delete corresponding rule |