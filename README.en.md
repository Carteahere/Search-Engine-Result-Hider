## <img src="https://github.com/user-attachments/assets/92954a5d-7157-40ed-9309-b9d75bf2bd32" width="30" height="30" align="center"> Search Engine Result Hider

### 1.1 Introduction

[中文](README.md) | [English](README.en.md) | Group [TG](https://t.me/+qBqMTqjc4Xk5M2Jh)

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

1. Auto-sync runs in the background once every 1 hour. When multiple tabs are open, a cross-tab lock ensures only one tab initiates requests. Uses a tombstone-backed line-based union merge strategy:
   - Automatically merges unique newly added rules from both sides to avoid overwriting rules created on other devices;
   - Supports rule deletion tracking via tombstones, preventing deleted rules from resurrecting upon union sync;
   - Skips uploading if the merged result is already identical to the remote file.
2. Address only supports HTTPS and full paths, e.g., Nutstore `https://dav.jianguoyun.com/dav/your_folder/` (default filename is `rules.txt`).
   - **Note**: Nutstore requires an **Application-Specific Password** generated from its web security settings, not your primary account password (which results in HTTP 401).
   - Ensure the destination folder already exists on the server to prevent HTTP 409 errors.
3. Settings & Selectors Sync:
   - Enabling "Sync Config" in WebDAV writes a `# ScriptConfig:...` header to sync script configurations and subscription URLs.
   - Enabling "Cloud Sync" in the Custom Selectors panel independently writes a separate `# Selectors:...` header line to sync custom search engine selectors.
   - Both operate independently and can be enabled separately as needed.

### 1.4 About Subscriptions:

1. Auto-update frequency is once per 12 hours. Supports plain text remote links and `.yaml` uBlacklist formats (`name`, `rules`, `blacklist`, `whitelist`, `matches` blocks; `whitelist:` entries in YAML are automatically prepended with `@` upon import).
2. The subscription panel includes toggle switches for individual subscriptions (allowing pausing without removing the URL), and automatically persists changes when clicking outside or unfocusing.
3. Subscription rules are appended after local rules. Due to limited allocatable script performance, it is recommended that the total number of rules does not exceed 50k.
4. Script extension capabilities are limited and do not support `##` DOM element rules or Adblock/uBO network request filter rules (e.g. `||example.com^` or `@@||example.com^`); they are automatically skipped when imported via subscriptions. Metadata comments like `! Title:` are also safely ignored.
5. Subscription updates also run in the background, scheduled safely with cross-tab locks.

### 1.5 Other:

1. One-click blocking logic:  
When secondary confirmation is enabled, a panel pops up offering options to block or add to whitelist; when secondary confirmation is disabled, adds `*://example.com/*` or `*://*.example.com/*` based on the domain blocking switch;  
For unblocking, when secondary confirmation is enabled, a panel pops up offering options to delete source rules or add to whitelist; when secondary confirmation is disabled, adds a new whitelist entry by default.
2. Both subscriptions and WebDAV rely on cross-origin request permissions. If a permission request prompt appears, select `Always allow`.
3. Rule priority: Local whitelist > Local blacklist > Subscription whitelist > Subscription blacklist
4. The script is injected globally via `@match *://*/*`. The floating bubble and blocking filters only take effect when matching search engine hostnames.
5. Comment line format: `# + space + content`. The ⬆️/⬇️ buttons navigate to the previous/next comment line. Pressing ⬆️ on the first line or first comment line jumps to the last line.
6. Automatic redirect removal: Unpacks result links by target URL Bing`/ck/a`, Google`/url`, Google Scholar`scholar_url`, DuckDuckGo`/l`, Yahoo`RU=`



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
