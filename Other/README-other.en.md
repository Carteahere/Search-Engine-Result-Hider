## <img src="https://github.com/user-attachments/assets/92954a5d-7157-40ed-9309-b9d75bf2bd32" width="30" height="30" align="center"> Search Engine Result Hider

### Introduction

**More information [Github](https://github.com/Carteahere/Search-Engine-Result-Hider)**

Implements complex-rule search result blocking on browsers that only support user script installation.  
Compatible with uBlacklist basic rules, supports URL matching, regular expression matching, title matching, result snippet matching, highlighting target results, whitelist matching, `@if` additional judgment conditions, and adding **custom engines**.  
Currently supported search engines:  
Bing, Google, Google Scholar, DuckDuckGo(&lite), Yandex, Brave, Ecosia, Startpage, Yahoo(&Japan), 360 Search, Sogou, Toutiao、Quark(&Shenma)

### Features:

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
1. Folding mode: Disabled by default, when enabled, blocked results will show titles only.
2. Bubble Action: Open the panel by default; after switching to show results mode, tap shows/hides blocked results, long press opens the panel, and clicking the block button for blocked results again removes the block.

### Simple Rule Explanation:
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

### Screenshots

<img width="400" height="250" alt="01" src="https://github.com/user-attachments/assets/a8297817-1856-434e-a329-b98adbfbad91" />
<br/>
<img width="250" height="85" alt="02" src="https://github.com/user-attachments/assets/b5eb4eac-9bc5-44a4-a0eb-a38076c35e4d" />
