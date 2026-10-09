## <img src="https://github.com/user-attachments/assets/92954a5d-7157-40ed-9309-b9d75bf2bd32" width="30" height="30" align="center"> Search Engine Result Hider

### 1.1 Introduction

[中文](README.md) | [English](README.en.md)

Implements complex-rule search result blocking on browsers that only support user script installation.  
Compatible with uBlacklist basic rules, supports URL matching, regular expression matching, title matching, result snippet matching, highlighting target results, whitelist matching, `@if` additional judgment conditions, and adding **custom engines**.  
Currently supported search engines:  
Bing, Google, Google Scholar, DuckDuckGo(&lite), Yandex, Brave, Ecosia, Startpage, Yahoo(&Japan), 360 Search, Sogou, Toutiao、Quark(&Shenma)

**Install:**  
Open and install using a browser that supports Tampermonkey / Greasemonkey scripts.  
Release Version [Github-AutoUpdate](https://raw.githubusercontent.com/Carteahere/Search-Engine-Result-Hider/main/Search-Engine-Result-Hider_autoupdate.user.js) | [GreasyFork](https://greasyfork.org/en/scripts/552394) | [ScriptCat](https://scriptcat.org/zh-CN/script-show-page/8237)  
Lite Version (Remove Subscription / WebDAV) [Lite](https://raw.githubusercontent.com/Carteahere/Search-Engine-Result-Hider/main/Other/Lite.user.js)

### 1.2 Features:

- Basic/advanced syntax matching results
- Matched rule statistics and debug output
- Import/export rules
- Rule error detection
- One-click blocking
- Rule subscription
- WebDAV sync
- Script manager menu  
┣ Open panel  
┣ Custom engine  
┗ Custom highlight colors

Partial setting instructions:
1. Show Source: Enabled by default, when disabled, the rules that match the blocked results will not be shown on it.
2. Folding mode: Disabled by default, when enabled, blocked results will show titles only.
3. Export Config: Disabled by default, when enabled, export TXT with script configuration attached.
4. Bubble Action: Open the panel by default; after switching to show results mode, tap shows/hides blocked results, long press opens the panel, and clicking the block button for blocked results again removes the block.

### 1.3 About WebDAV:

1. Auto-sync runs in the background, 3-Way Merge Sync once every 1h, manual upload/download is mandatory overwrite, script config/custom engine synchronization switch independent.
2. Address only supports **https** and full paths, e.g., Nutstore `https://dav.jianguoyun.com/dav/your_folder/`; the folder is created automatically if it does not exist, after changing the file name such as `rules.txt` need to manually upload and overwrite it once.
3. Tampermonkey lacks a secure storage API, so passwords can only be saved using local obfuscation; for security reasons, you must use a dedicated application password.
4. To ensure the accuracy of the timestamp during synchronization, the timeapi/akamai/cloudflare timing point will be automatically accessed once. If the access fails, the webdav date timestamp will be used by default.

### 1.4 About Subscriptions:

1. Rule subscription updates also run in the background, fetching once every 12h. It supports plain text remote links encoded in `UTF-8` such as [rules.txt](https://raw.githubusercontent.com/Carteahere/Search-Engine-Result-Hider/main/Other/rules.txt) , subscription rules are appended after local rules. 
2. Compatible with `.yaml` uBlacklist list format (`name`/`rules`/`blacklist`/`whitelist`/`matches` fields).
3. Script extensions are limited and do not support `##`/`#@#` DOM/uBO rules, they are filtered out automatically on subscription import.
4. If the subscription link is not a GitHub source, cross-origin request permission is required; if a permission prompt appears, select `Always allow`.

### 1.5 Other:

1. Redirections will be automatically removed for some engines, and can be toggled on or off in the settings.
2. Rule priority: Local whitelist > Local blacklist > Subscription whitelist > Subscription blacklist
3. Comment line format: `#+[space]+text` and cannot be repeated, otherwise the content under the same comment line will be merged during synchronization; ⬆️/⬇️ jump to the previous/next comment line; when on the first line or first comment line, ⬆️ jumps to the last line.
4. To avoid cross-page data conflicts, do not open panel editing rules on multiple tabs at the same time, and pause synchronization when opening the panel.

## Docs

For detailed rule syntax and tutorial on adding custom engines, see [Rule-Explanation](Rule-Explanation.en.md)

For debug mode and rules detection error instructions, see [Debug](Debug.en.md)

Simple Rule Explanation:
| Type | Example | Explanation |
| --- | --- |--- |
| URL | `*://*.example.com/*` | block `example.com` |
| regex | `/example\.(com\|net)/i` | block `example.com` and `example.net` |
| title | `title/.*example.*/i` | block results whose title contains `example` |
| snippet | `text/.*example.*/i` | block results whose page description (snippet) contains `example` |
| highlight | `@1*://*.example.com/*` | adds a colored border to results from `example.com` |
| whitelist | `@*://*.example.com/*` | allows `example.com` |
| `@if` conditional statements | `*://*.example.com/* @if(title *= "keyword")` | block results from `example.com` whose title contains `keyword` |
| multiple `@if` conditional statements | `*://*.example.com/* @if((title *= "a" \| title *= "b") & !(url *= "c"))` | Block `example.com` results whose title contains `a` or `b` and URL does not contain `c` |

## Screenshots

<img width="400" height="250" alt="01" src="https://github.com/user-attachments/assets/a8297817-1856-434e-a329-b98adbfbad91" />
<br/>
<img width="250" height="85" alt="02" src="https://github.com/user-attachments/assets/b5eb4eac-9bc5-44a4-a0eb-a38076c35e4d" />
