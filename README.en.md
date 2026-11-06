## <img src="https://github.com/user-attachments/assets/92954a5d-7157-40ed-9309-b9d75bf2bd32" width="30" height="30" align="center"> Search Engine Result Hider

### 1.1 Introduction

[中文](README.md) | [English](README.en.md)

Implements complex-rule search result blocking on browsers that only support scripts installation.  
Compatible with uBlacklist basic rules, supports URL matching, regular expression matching, title matching, result snippet matching, highlighting target results, whitelist matching, `@if` additional judgment conditions, blocking on image/video/news search pages, and adding **custom engine sites**.

Currently supported search engines:  
Bing, Google, Google Scholar, DuckDuckGo(&lite), Yandex, Brave, Ecosia, Startpage, Yahoo(&Japan), 360 Search, Sogou, Toutiao, Quark(&Shenma), GitHub Search, GreasyFork Search

**Install:**  
Open and install using a browser that supports Tampermonkey / Greasemonkey scripts.  
Release Version [Github-AutoUpdate](https://raw.githubusercontent.com/Carteahere/Search-Engine-Result-Hider/main/Search-Engine-Result-Hider_autoupdate.user.js) | [GreasyFork](https://greasyfork.org/en/scripts/552394) | [ScriptCat](https://scriptcat.org/zh-CN/script-show-page/8237)  
Lite Version [Lite](https://raw.githubusercontent.com/Carteahere/Search-Engine-Result-Hider/main/Other/Lite.user.js) (Remove WebDAV Sync / Rule Subscription / Engine Subscription, no networking function) 

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
3. Bubble Action: The floating ball opens the panel on tap by default; when switched to `Show/Hide Results` mode, tapping shows/hides blocked results and long-pressing opens the panel, and clicking the block button on a blocked result again unblocks it.

### 1.3 About WebDAV:

1. Auto-sync runs in the background with a 3-way snapshot merge sync once every 1h; manual upload/download is a forced overwrite, and after the first upload the cloud file generates a `rules.txt.bak` backup file on every subsequent upload.
2. The address only supports **https** and full paths, e.g., Nutstore `https://dav.jianguoyun.com/dav/your_folder/`; the folder is created automatically if the path does not exist, and after changing the file name such as `rules.txt` you need to manually upload and overwrite it once.
3. Tampermonkey has no secure storage API, so passwords can only be saved with local obfuscation; for security, you must use a separate application password.
4. To ensure the accuracy of timestamps during synchronization, an automatic access will be made to the timeapi / akamai / cloudflare networking timing points. If the access fails or the `Time Calibration` switch is turned off, the `date` timestamp from WebDAV will be used by default.

### 1.4 About Subscriptions:

1. Rule subscription updates also run in the background, fetching once every 12h. It supports `UTF-8` plain text remote links such as [rules.txt](https://raw.githubusercontent.com/Carteahere/Search-Engine-Result-Hider/main/Other/rules.txt), and subscription rules are appended after local rules.
2. Compatible with `.yaml` uBlacklist subscription format, do not support `##` / `#@#` uBO rules, they are filtered out automatically on subscription import.
3. The search engine subscription supports `.js` / `.json`, with [Selectors.js](https://raw.githubusercontent.com/Carteahere/Search-Engine-Result-Hider/main/Other/Selectors.js) being built-in by default and the engines list being automatically updated.
4. Subscription/synchronization requires cross-origin request permissions; if a permission prompt appears, select `Always allow all`.

### 1.5 Other:

1. Redirections will be automatically removed for some search engines, and can be toggled on or off in the settings.
2. Rule priority: Local whitelist > Local blacklist > Subscription whitelist > Subscription blacklist
3. ⬆️/⬇️ jump to the previous/next comment line; when on the first line or first comment line, ⬆️ jumps to the last line. Comment lines cannot be duplicated, or content under the same comment line will be merged during synchronization.
4. To avoid cross-page data conflicts, do not open panel editing rules on multiple tabs at the same time, and pause synchronization when opening the panel.

## Docs

For detailed rule syntax and custom engine setup, see [Rule-Explanation](Rule-Explanation.en.md)

For debug mode and rule self-check error instructions, see [Debug](Debug.en.md)

Simple rule examples:

| Rule | Example | Description |
| --- | --- | --- |
| URL | `*://*.example.com/*` | block `example.com` |
| URL | `*://*.例子.com/*` | Equivalent blocking `*://*.xn--fsqu00a.com` |
| regex | `/example\.(com\|net)/i` | block `example.com` and `example.net` |
| title | `title/.*example.*/i` | block results whose title contains `example` |
| snippet | `text/.*example.*/i` | block results whose page description content (snippet) contains `example` |
| highlight | `@1*://*.example.com/*` | add a colored border to `example.com` results |
| whitelist | `@*://*.example.com/*` | allow `example.com` |
| `@if` condition | `*://*.example.com/* @if(title *= "keyword")` | block `example.com` results whose title contains `keyword` |
| multiple `@if` conditions | `*://*.example.com/* @if((title *= "a" \| title *= "b") & !(url *= "c"))` | block `example.com` results whose title contains `a` or `b` and whose URL does not contain `c` |

## Screenshots

![01](https://github.com/user-attachments/assets/a8297817-1856-434e-a329-b98adbfbad91)  
![02](https://github.com/user-attachments/assets/b5eb4eac-9bc5-44a4-a0eb-a38076c35e4d)
