## <img src="https://github.com/user-attachments/assets/92954a5d-7157-40ed-9309-b9d75bf2bd32" width="30" height="30" align="center"> Search Engine Result Hider

### 1.1 Introduction

[中文](README.md) | [English](README.en.md)

Implements complex-rule search result blocking on browsers that only support script installation.  
Compatible with uBlacklist basic rules and subscriptions, supports URL matching, regex matching, title matching, result snippet matching, highlighting target results, whitelist matching, `@if` additional judgment conditions, blocking on search pages such as images/videos, and adding **custom engines**.

Currently supported search engines:  
Bing, Google, Google Scholar, DuckDuckGo(&lite), Yandex, Brave, Ecosia, Startpage, Yahoo(&Japan), 360 Search, Sogou, Toutiao Search, Quark(&Shenma), GitHub Search, GreasyFork Search

**Install:**  
Open and install using a browser that supports Tampermonkey / Greasemonkey scripts.  
Release Version [Github-AutoUpdate](https://raw.githubusercontent.com/Carteahere/Search-Engine-Result-Hider/main/Search-Engine-Result-Hider_autoupdate.user.js) | [GreasyFork](https://greasyfork.org/en/scripts/552394) | [ScriptCat](https://scriptcat.org/zh-CN/script-show-page/8237)  
Lite Version [Lite](https://raw.githubusercontent.com/Carteahere/Search-Engine-Result-Hider/main/Other/Lite.user.js) (Removing WebDAV sync / rule subscription / engine subscription, etc., no networking function).

### 1.2 Current Features:

- Basic/advanced syntax matching results
- Matched rule statistics and debug output
- Import/export rules
- Rule syntax check
- One-click blocking
- Rule subscription
- WebDAV sync
- Script manager menu  
  ┣ Open panel  
  ┣ Custom engine  
  ┗ Custom highlight colors

Partial setting instructions:

1. Collapse Mode: Disabled by default, when enabled, blocked results show titles only.
2. Show Source: Enabled by default, when disabled, the matched rules are not shown on blocked results.
3. Bubble Action: The floating ball opens the panel on tap by default; when switched to `Show/Hide Results`, tapping shows/hides blocked results, long-pressing opens the panel, clicking the block button of a blocked result again cancels blocking.

### 1.3 About WebDAV:

1. Auto-sync runs in the background, performing a 3-way snapshot merge sync once every 1h, manual upload/download is a forced overwrite. During synchronization, a `rules.txt.bak` backup file is automatically generated, along with a separate backup for the following day.
2. The address only supports **https** and full paths, such as Nutstore `https://dav.jianguoyun.com/dav/your_folder/`, the path folder is automatically created when it does not exist, after modifying the file name such as `rules.txt`, you need to manually upload and overwrite once.
3. Tampermonkey has no secure storage API, passwords can only be obfuscated locally, for security you must use a separate application password.
4. To ensure timestamp accuracy during sync, it will automatically access the timeapi/cloudflare networked time source once, if the access fails or the `Time Calibration` switch is turned off, the `date` timestamp of WebDAV is used by default.

### 1.4 About Subscriptions:

1. Rule subscription updates also run in the background, fetching once every 12h, supports `UTF-8` plain text such as [rules.txt](https://raw.githubusercontent.com/Carteahere/Search-Engine-Result-Hider/main/Other/rules.txt), subscription rules are appended after local rules for application.
2. Supports uBlacklist rule subscriptions and the `YAML frontmatter` format, does not support uBO rules such as `##` / `#@#`, they are automatically filtered when imported through a subscription.
3. The search engine subscription has [Selectors.js](https://raw.githubusercontent.com/Carteahere/Search-Engine-Result-Hider/main/Other/Selectors.js) built in by default and automatically updates the engines list.
4. Subscription/sync requires cross-origin request permission, if a permission request popup appears, select `Always allow all`.

### 1.5 Other:

1. Redirects are automatically removed for some search engines, can be toggled in the settings.
2. Rule priority: Local whitelist > Local blacklist > Subscription whitelist > Subscription blacklist.
3. ⬆️/⬇️ functions move to the previous/next comment line, on the first line or the first comment line, ⬆️ jumps to the last line, comment lines cannot be repeated, otherwise the content under the same comment line will be merged during synchronization.
4. To avoid cross-page data conflicts, do not open the panel to edit rules in multiple tabs at the same time, pause sync when opening the panel.

## Docs

For the tutorial on adding custom engines, see [Custom-Engine](Custom-Engine.en.md)

For specific rule syntax instructions, see [Rule-Explanation](Rule-Explanation.en.md)

For debug mode and rule self-check error instructions, see [Debug](Debug.en.md)

Simple rule examples:

| Rule | Example | Description |
| --- | --- | --- |
| URL | `*://*.example.com/*` | Block `example.com` |
| URL | `*://*.例子.com/*` | Equivalent to blocking `*://*.xn--fsqu00a.com` |
| regex | `/example\.(com\|net)/i` | Block `example.com` and `example.net` |
| title | `title/.*example.*/i` | Block results whose title contains `example` |
| snippet | `text/.*example.*/i` | Block results whose page description content (snippet) contains `example` |
| highlight | `@1*://*.example.com/*` | Add a highlighted border to `example.com` |
| whitelist | `@*://*.example.com/*` | Allow `example.com` |
| `@if` condition | `*://*.example.com/* @if(title *= "example")` | Block `example.com` results whose title contains `example` |
| multiple `@if` conditions | `*://*.example.com/* @if((title *= "a" \| title *= "b") & !(url *= "c"))` | Block `example.com` results whose title contains `a` or `b` and whose URL does not contain `c` |

## Screenshots

<img width="400" height="250" alt="01" src="https://github.com/user-attachments/assets/a8297817-1856-434e-a329-b98adbfbad91" />
<br/>
<img width="250" height="85" alt="02" src="https://github.com/user-attachments/assets/b5eb4eac-9bc5-44a4-a0eb-a38076c35e4d" />
