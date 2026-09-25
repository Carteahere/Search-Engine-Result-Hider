## <img src="https://github.com/user-attachments/assets/92954a5d-7157-40ed-9309-b9d75bf2bd32" width="30" height="30" align="center"> Search Engine Result Hider

### 1.1 Introduction

[中文](README.md) | [English](README.en.md)

Implements complex-rule search result blocking on browsers that **only support user script installation**.  
Supports URL matching including uBlacklist basic rules, regex matching, title matching, whitelist matching, target result highlighting, and result snippet matching.  
Currently supported search engines: Bing, Google, Google Scholar, DuckDuckGo(ddg/lite), Yandex, Brave, Yahoo(&Japan)  

Install sources [Github](https://raw.githubusercontent.com/Carteahere/Search-Engine-Result-Hider/main/Search-Engine-Result-Hider_autoupdate.user.js) | [Greasy Fork](https://update.greasyfork.org/scripts/552394/%E6%90%9C%E7%B4%A2%E5%BC%95%E6%93%8E%E7%BB%93%E6%9E%9C%E5%B1%8F%E8%94%BD%E5%99%A8.user.js)  
Open with a browser to install directly.  
Group [TG](https://t.me/+qBqMTqjc4Xk5M2Jh)

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

1. Auto-sync runs in the background, use 3-Way Merge Sync, manual upload/download is mandatory overwrite.
2. Address only supports **https** and full paths, e.g., Nutstore `https://dav.jianguoyun.com/dav/your_folder/`; the folder is created automatically if it does not exist, after changing the file name such as `rules.txt` need to manually upload and overwrite it once.
3. Tampermonkey lacks a secure storage API, so passwords can only be saved using local obfuscation; for security reasons, you must use a dedicated application password.
4. To ensure the accuracy of the timestamp during synchronization, the timeapi/akamai/cloudflare timing point will be automatically accessed once. If there is a cross domain request permission application pop-up, select `Always allow`. If rejected, the remote webdav date timestamp will be used by default.

### 1.4 About Subscriptions:

1. Subscription updates also run in the background, fetching once every 12h. Supports UTF-8 encoding for plain text remote links such as `https://raw.githubusercontent.com/Carteahere/Search-Engine-Result-Hider/main/Other/rules.txt`; compatible with `.yaml` uBlacklist list format (`name`/`rules`/`blacklist`/`whitelist`/`matches` fields).
2. Subscription rules are appended after local rules. Due to limited script-allocatable performance, keep the total number of rules under 50k to avoid mobile device performance issues.
3. Script extensions are limited and do not support `##` DOM element or uBO filter rules; they are filtered out automatically on subscription import.
4. If the subscription link is not a GitHub source, cross-origin request permission is required; if a permission prompt appears, select `Always allow`.

### 1.5 Other:

1. Automatic redirect removal engines: Bing, Google, Google Scholar, DuckDuckGo, Yahoo
2. Rule priority: Local whitelist > Local blacklist > Subscription whitelist > Subscription blacklist
3. Script runs on all websites, the floating bubble and blocking filter only take effect on search engines. Non engine sites only display some menu options.
4. Comment line format: `# + space + content`. ⬆️/⬇️ jump to the previous/next comment line; when on the first line or first comment line, ⬆️ jumps to the last line.
5. To avoid cross-page data conflicts, do not open panel editing rules on multiple tabs at the same time, and pause synchronization when opening the panel.

## Docs

For custom engine selectors and detailed rule syntax, see [Rule-Explanation](Rule-Explanation.en.md)

For debug mode and troubleshooting, see [Debug](Debug.en.md)

## Screenshots

<img width="450" height="288" alt="01" src="https://github.com/user-attachments/assets/8523f109-84d1-4eba-b8d5-678b0a824340" />
<br/>
<img width="200" height="148" alt="02" src="https://github.com/user-attachments/assets/067323b2-40c0-498e-a0f4-f78ab8a52ad4" />