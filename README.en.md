## <img src="https://github.com/user-attachments/assets/92954a5d-7157-40ed-9309-b9d75bf2bd32" width="30" height="30" align="center"> Search Engine Result Hider

### 1.1 Introduction

[中文](README.md) | [English](README.en.md)

Implements complex-rule search result blocking on browsers that only support user script installation.  
Supports URL matching including uBlacklist basic rules, regex matching, title matching, whitelist matching, target result highlighting, and result snippet matching.  
Currently supported search engines: Bing, Google, Google Scholar, DuckDuckGo, Yandex, Brave, Yahoo

Install sources [Github](https://raw.githubusercontent.com/SadYuyuko/Search-Engine-Result-Hider/main/Search-Engine-Result-Hider_autoupdate.user.js) | [Greasy Fork](https://update.greasyfork.org/scripts/552394/%E6%90%9C%E7%B4%A2%E5%BC%95%E6%93%8E%E7%BB%93%E6%9E%9C%E5%B1%8F%E8%94%BD%E5%99%A8.user.js)

Open with a browser that supports script installation to install directly.

### 1.2 Features:

- Basic/advanced syntax matching results
- One-click blocking
- Matched rule statistics and debug output
- Import/export rules to TXT
- Rule error detection
- Rule subscription
- WebDAV sync
- Script manager menu  
┣ Open panel  
┣ Language switching  
┣ Custom selectors  
┣ Custom highlight colors  
┣ Toggle error detection  
┣ Toggle floating bubble display  
┣ Toggle panel centering: Centered by default; when toggled, displayed in the four screen corners based on floating bubble position.  
┗ Toggle floating bubble function:  
　┗ 🟢 Click to open panel  
　┗ 🔵 Click to expand blocked results, long press to open panel; clicking the block button on a blocked result again unblocks it.

### 1.3 About WebDAV:

1. Auto-sync performs an overwrite upload/download once per 12 hours based on configuration timestamp.
2. Address only supports HTTPS and full paths, e.g., Nutstore `https://dav.jianguoyun.com/dav/your_folder/`.
3. Auto-sync runs in the background. When multiple tabs are open, a cross-tab lock ensures only one tab initiates requests.

### 1.4 About Subscriptions:

1. Auto-update frequency is once per 12 hours. Supports plain text remote links, e.g., `https://raw.githubusercontent.com/SadYuyuko/Search-Engine-Result-Hider/main/Other/rules.txt`; compatible with `.yaml` uBlacklist list format (`name`/`rules`/`blacklist`/`whitelist` entries; whitelist entries are automatically prepended with `@` upon import).
2. Subscription rules are appended after local rules. Due to limited allocatable script performance, it is recommended that the total number of rules does not exceed 50k to avoid mobile device performance issues 🤳💥
3. Script extension capabilities are limited and do not support `##` DOM element rules; they are automatically filtered out when imported via subscriptions.
4. Subscription updates also run in the background. When multiple tabs are open, each subscription is fetched by only one tab.

### 1.5 Other:

1. One-click blocking logic:  
When secondary confirmation is enabled, a panel pops up offering options to block or add to whitelist; when secondary confirmation is disabled, adds `*://example.com/*` or `*://*.example.com/*` based on the domain blocking switch;  
For unblocking, when secondary confirmation is enabled, a panel pops up offering options to delete source rules or add to whitelist; when secondary confirmation is disabled, adds a new whitelist entry by default.
2. Both subscriptions and WebDAV rely on cross-origin request permissions. If a permission request prompt appears, select `Always allow`.
3. Rule priority: Local whitelist > Local blacklist > Subscription whitelist > Subscription blacklist
4. The script is injected globally via `@match *://*/*`. The floating bubble and blocking filters only take effect when matching search engine hostnames.
5. Comment line format: `# + space + content`. The ⬆️/⬇️ buttons navigate to the previous/next comment line. Pressing ⬆️ on the first line or first comment line jumps to the last line.
6. Automatic redirect removal: Unpacks result links by target URL Bing`/ck/a`, Google`/url`, Google Scholar`scholar_url`, DuckDuckGo`/l`, Yahoo`RU=`

## Rule Description

### 2.1 URL Matching:

| Rule | Description |
| --- | --- |
| `*://abc.example.com/*` | Matches `abc.example.com` |
| `*://*.example.com/*` | Matches `example.com` and all its subdomains |
| `*://*.example.com/path/*` | Matches specific path on `example.com` |
| `*://*.example.*` | Matches all top-level domains of `example.com` |
| `example.com` | Equivalent to `*://*.example.com/*`, shorthand for script only. Rules intended for simultaneous uBlacklist use must include the `*://*.` prefix. |

URL wildcard rules match from the start of the URL according to match pattern semantics. `*://` only matches `http/https`, host wildcard `*` does not cross paths, and `*.` prefix matches the bare domain simultaneously. IDN hostnames (e.g. `例子.com`) are treated as equivalent to their punycode form (`xn--fsqu00a.com`).

### 2.2 Regex Matching:

| Rule | Description |
| --- | --- |
| `/pattern/flags` | Matches URL using regular expressions, e.g. `/example\.(com\|net)/i` |
| `title/pattern/flags` | Matches title using regular expressions, e.g. `title/.*block.*/i` |
| `text/pattern/flags` | Matches snippet content using regular expressions, e.g. `text/.*ad.*/i` |

Standard regular expressions use JavaScript `RegExp` flags supported by browsers: `i`, `m`, `s`, `u`, where `s` uses native dotAll matching (dot matches newline); `g` and `y` are not supported. Script rules only evaluate matches and do not perform global extraction.

### 2.3 Title Matching:

| Rule | Description |
| --- | --- |
| `title/.*example.*/` | Matches results containing `example` in the title |
| `title/^example.*/` | Matches search results whose title starts with `example` |
| `title/.*example(A\|B).*/` | Matches results whose title contains `exampleA` or `exampleB` |
| `title/.*example(A\|B).*/i` | Case-insensitive; in addition to the above, matches results containing `examplea` or `exampleb` |
| `title/^(?=.*example1)(?=.*(?:example2)).*/i` | Case-insensitive and order-independent; matches results containing both `example1` and `example2` |
| `title/^(?=.*example1)(?=.*(?:example2\|example3)).*/i` | Case-insensitive and order-independent; matches results containing both `example1 and example2` or `example1 and example3` |

### 2.4 Snippet Matching:

| Rule | Description |
| --- | --- |
| `text/.*example.*/` | Matches search results whose page description content (snippet) contains `example` |
| `text/.*exampleabc.*/i` | Same as above, with `i` for case-insensitive |

### 2.5 Whitelist Matching:

| Rule | Description |
| --- | --- |
| `@*://*.com/*` | Allows all pages with domain ending in `.com` |
| `@*://example.com/*` | Allows main site `example.com` |
| `@*://example.com/abc/*` | Allows specific path on `example.com` |
| `@*://*.example.com/*` | Allows `example.com` and all its subdomains |
| `@*://*.example.com/abc/*` | Allows specific path on subdomains of `example.com` |

### 2.6 Highlighting Rules:

| Rule | Description |
| --- | --- |
| `@N *://*.example.com/*` | Adds a colored border to search results of `example.com` and its subdomains |
| `@N title/.*example.*/` | Adds a colored border to results matching titles containing `example` |

Priority: Block > Highlight; Whitelisted results will not be blocked, but can still be highlighted.  
Note: Only supports 5 colors, meaning `@N` is `@1` to `@5`. Open the custom color panel via the script menu.

### 2.7 Composite Rules:

**Description:**
1. Append `@if(...)` after a rule as additional conditions. Multiple `@if` conditions take effect simultaneously (logical AND `&`, can be converted into a single `@if`). Composite rule matching is case-insensitive by default.
2. Condition expressions can be used standalone, e.g., `host $= ".example.com"`, `path *= "/download/"`, taking effect across all search results.
3. Logical operations supported within a single `@if`: `|` OR, `&` AND, `!` NOT, nested and grouped using `( )` parentheses, priority `!` > `&` > `|`.
4. `!` negates the condition itself. When a result lacks the compared content (such as missing a title), the condition is considered not met, and after negation it evaluates to met. For example, `!(title *= "keyword")` matches results without a title.
5. Attribute values support omitting quotes, e.g. `@if($site=google)`, `@if(site=google.com)`, `@if(scheme=https)` for unquoted values, compatible with uBlacklist syntax style.

**Conditions supported by `@if`:**

| Condition Type | Syntax | Description |
| --- | --- | --- |
| Search Engine | `$site = "google"` | Only takes effect on the specified search engine. Can be `google`, `google_scholar`, `bing`, `duckduckgo`(`ddg`), `yandex`, `brave`, `yahoo`(`yahoo-japan`), case-insensitive, delimiters can be `=` or `:`, quotes can be omitted (e.g. `$site=google`) |
| Search Type | `$category = "web"` | Only takes effect on the specified search type. Can be `web`, `images`, `videos`, `news`, inferred from current page URL, defaults to `web` for web search, quotes can be omitted (e.g. `$category=images`) |
| Search Site | `site = "google.com.hk"` | Only takes effect on the specified regional site of search engine, quotes can be omitted (e.g. `site=google.com.hk`) |
| Title Contains | `title *= "keyword"` | Title contains specified string `keyword` |
| Title Exact | `title = "keyword"` | Title exactly matches specified string `keyword` |
| Title Prefix | `title ^= "keyword"` | Title starts with specified string `keyword` |
| Title Suffix | `title $= "keyword"` | Title ends with specified string `keyword` |
| Title Regex | `title =~ /regex/` (or shorthand `title/regex/`) | Title matches regular expression, `=~` can be omitted, character class `[...]` supports unescaped slashes, add `i` at the end for case-insensitive |
| URL Exact | `url = "https://example.com/"` | URL exactly matches specified string |
| URL Prefix | `url ^= "https://abc.example.com"` | URL starts with specified string |
| URL Suffix | `url $= ".pdf"` | URL ends with specified string |
| URL Contains | `url *= "example"` | URL contains specified string `example` |
| URL Regex | `url =~ /regex/` (or shorthand `url/regex/`) | URL matches regular expression, `=~` can be omitted, character class `[...]` supports unescaped slashes, add `i` at the end for case-insensitive |
| URL Host | `host $= ".example.com"` | Matches hostname of result URL; `$=` is compatible with bare domains, i.e., `host $= ".example.com"` matches both `example.com` and `www.example.com` |
| URL Path | `path *= "/download/"` | Matches pathname + search query (pathname+search) of result URL |
| URL Protocol | `scheme = "https"` | Matches protocol of result URL, e.g., `https`/`http`, quotes can be omitted (e.g. `scheme=https`) |
| Logical Operation | `\|` OR, `&` AND, `!` NOT | Combine arbitrary conditions |
| Parentheses Grouping | `( )` | Nest and combine sub-conditions |

`title`/`url`/`host`/`path`/`scheme` all support `=`, `^=`, `$=`, `*=`, `=~` (and shorthands omitting `=~` like `host/regex/`). Comparison is case-insensitive by default, `=~` case sensitivity is determined by regex flags. Compatible with the case modifier `i` in uBlacklist rules (e.g. `title $= "Domain" i`), this syntax is only used for rule recognition and compatibility, the script ignores case by default.

**Composite Rule Examples:**

| Rule | Description |
| --- | --- |
| `*://*.example.com/* @if(title *= "keyword")` | Block results from `example.com` whose title contains `keyword` |
| `*://*.example.com/* @if(title *= "keyword1" \| title *= "keyword2")` | Block results from `example.com` whose title contains `keyword1` or `keyword2` |
| `*://*.example.com/* @if(title =~ /keyword1\|keyword2/i)` | Regex format for the above rule, add `i` at the end for case-insensitive |
| `*://*.example.com/* @if(url *= "test")` | Block results from `example.com` whose URL contains `test`, e.g., `example.com/*/test/*` |
| `*://*.example.com/* @if(title *= "keyword" & !(url *= "test"))` | Block results from `example.com` whose title contains `keyword` and URL does not contain `test` |
| `*://*.example.com/* @if(site = "google.com.hk")` | Block `example.com` only on Google HK |
| `*://*.example.com/* @if($site = "google")` | Block `example.com` only on Google |
| `*://*.amazon.com/* @if($category = "images")` | Block `amazon.com` only on image search |
| `*://*.example.com/* @if($site = "google") @if(title *= "example")` | Block results from `example.com` whose title contains `example` only on Google |
| `*://*.example.com/* @if(title *= "a" \| title *= "b") @if(!(url *= "c"))` | Block results from `example.com` whose title contains `a` or `b` and URL does not contain `c` |
| `title/.*example.*/ @if($site = "google")` | Block results whose title contains `example` only on Google |
| `text/.*example.*/ @if($site = "google" \| $site = "bing")` | Block results whose web page description contains `example` on both Google or Bing |
| `path *= "/download/"` | Block results whose path contains `/download/` |
| `host $= ".example.com" & path *= "/download/"` | Block results under `example.com` whose path contains `/download/` |
| `@1 path $= ".pdf"` | Highlight results whose path ends with `.pdf` |

### 2.8 Custom Selectors:

Open the editing panel via the script manager menu `🖋️ Custom Selectors` (JS format, matching the structure of built-in [SELECTORS](https://raw.githubusercontent.com/SadYuyuko/Search-Engine-Result-Hider/main/Other/SELECTORS.js)).

| Field | Type | Description |
| --- | --- | --- |
| `match` | regex | Required, hostname matching regex literal |
| `containers` | string | Required, CSS selector for result containers (pseudo-elements such as `::after` are not supported) |
| `links` | string \| string\[\] | Optional, link selector, defaults to `a[href]` |
| `titles` | string \| string\[\] | Optional, list of title selectors |
| `snippets` | string \| string\[\] | Optional, list of snippet selectors |
| `disabled` | boolean | Optional, `true` disables the engine, applies to built-in engines as well; alias `disable`, writing `disabled: false` (or `disable: false`) alone restores the built-in configuration. |

**Examples:**

```javascript
example: {
  match: /(?:^|\.)search\.example\.com$/,
  containers: '.result',
  titles: ['h3'],
  snippets: ['.content'],
  links: 'a[href]',
},
bing: {disabled: true},
```

**Description:**

1. Priority: Custom selectors > Built-in selectors. Changing overrides back to built-in values or using "Reset" will restore following script updates.
2. Custom engines support `$site = "Engine ID"` condition as well as block/highlight/whitelist rules; `titles`/`snippets` can be omitted.
3. Engine ID only allows letters/numbers/`_`/`-`, `other` is a reserved key and cannot be used. Overlapping with built-in engine IDs or sites will override built-in selectors, e.g., matching `cn.bing.com` will take priority over built-in `bing`.
4. Built-in engine standard IDs: `google`, `google_scholar`, `bing`, `duckduckgo`, `yandex`, `brave`, `yahoo` (Note: `ddg` and `yahoo-japan` are aliases only supported in `@if($site=...)` conditions; use `duckduckgo` and `yahoo` when overriding built-in engines in selector configuration)
5. When saving, only keys differing from built-ins are stored; unmodified built-ins are not written to storage.

## Testing

### 3.1 Environment Requirements

- Node.js 14+ 
- No additional dependencies required

### 3.2 Running Tests

Place the test folder and script in the same directory to run. Tests automatically read the `.js` script in the parent directory, divided by functional domains into: conditional expressions, rules, selectors & engines, cross-origin permissions.

```bash
# Run all tests
node test/test-conditions.cjs
node test/test-rules.cjs
node test/test-selectors.cjs
node test/test-connect.cjs

# Run specific test
node test/test-conditions.cjs 2>&1 | grep "FAIL"
```

Successful output example: `10 passed, 0 failed`

### 3.3 Debug Mode

Use the [Web Debug](https://greasyfork.org/zh-CN/scripts/475228) script or browser F12 developer tools Console tab `window.__SERH_DEBUG__` to view output.

```javascript
const d = window.__SERH_DEBUG__;

// View current configuration
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

// Means: Successfully identified Google engine, found 15 results, blocked 3 results
```

Error output

```bash
// Rule syntax error
规则预编译失败: *://example.com/* Error: Invalid regex pattern

// Means: Rule syntax error, check rule format
```

## Screenshots

<img width="450" height="288" alt="01" src="https://github.com/user-attachments/assets/8523f109-84d1-4eba-b8d5-678b0a824340" />
<br/>
<img width="200" height="148" alt="02" src="https://github.com/user-attachments/assets/067323b2-40c0-498e-a0f4-f78ab8a52ad4" />
