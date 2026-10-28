## Rule Explanation

### 2.1 One-click Block:

Floating ball, Open Panel mode — clicking the block button on an **unblocked result**:

| Type | Block Domain ON | Block Domain OFF |
| --- | --- | --- |
| Confirm ON | Dialog offers Exact / Domain / Whitelist, Domain block selected by default | Dialog offers Exact / Domain / Whitelist, Exact block selected by default |
| Confirm OFF | Directly blocks `*://*.example.com/*` | Directly blocks `*://m.example.com/*` |

Floating ball, Toggle Results (show/hide results) mode — clicking the block button on a **blocked result**:

| Type | Local Rule | Subscription Rule |
| --- | --- | --- |
| Confirm ON | Dialog offers Delete Rule / Add Whitelist | Dialog prompts to add Whitelist |
| Confirm OFF | Directly deletes the corresponding local rule | Dialog prompts to add Whitelist |

### 2.2 URL Matching:

| Rule | Description |
| --- | --- |
| `*://abc.example.com/*` | Matches `abc.example.com` |
| `*://*.example.com/*` | Matches `example.com` and its subdomains |
| `*://*.example.com/path/*` | Matches a specific path on `example.com` |
| `*://*.example.com:8080/*` | Matches port `8080` of `example.com` |
| `*://*.example.*` | Matches all top-level/second-level domains of `example.com` |
| `example.com` | Shorthand equivalent to `*://*.example.com/*`; adding the `*://*.` prefix is recommended in most cases |
| `*://*.例子.com` | Equivalent to `*://*.xn--fsqu00a.com`; Chinese and other IDN domains are treated as the same host as their punycode |

URL wildcard rules match from the start of the URL per match-pattern semantics; the host wildcard `*` does not cross paths.

### 2.3 Regex Matching:

| Rule | Description |
| --- | --- |
| `/pattern/flags` | Matches the URL using regex, e.g. `/example\.(com\|net)/i` |
| flags: `i`, `m`, `s`, `u` | Supported; `s` uses native dotAll (dot matches newline) |
| flags: `g`, `y` | Not supported; script rules only test whether a match exists, without global extraction |

Regex uses the browser-supported JavaScript `RegExp`.

### 2.4 Title Matching:

| Rule | Description |
| --- | --- |
| `title/.*example.*/` | Matches results whose title contains `example` |
| `title/^example.*/` | Matches results whose title starts with `example` |
| `title/.*example(A\|B).*/` | Matches results whose title contains `exampleA` or `exampleB` |
| `title/^(?=.*exampleA)(?=.*(?:exampleB)).*/i` | Case-insensitive and order-independent; matches results containing both `exampleA` and `exampleB` |
| `title/^(?=.*exampleA)(?=.*(?:exampleB\|exampleC)).*/i` | Case-insensitive and order-independent; matches results containing `exampleA` and `exampleB`, or `exampleA` and `exampleC` |

### 2.5 Snippet Matching:

| Rule | Description |
| --- | --- |
| `text/.*example.*/` | Matches results whose page description (snippet) contains `example` |
| `text/.*example.*/i` | Same as above; `i` ignores case |

### 2.6 Whitelist Matching:

| Rule | Description |
| --- | --- |
| `@*://*.com/*` | Allows all pages on domains ending in `.com` |
| `@*://example.com/*` | Allows the main site `example.com` |
| `@*://example.com/abc/*` | Allows a specific path on `example.com` |
| `@*://*.example.com/*` | Allows `example.com` and all its subdomains |

The `@@` syntax not supported yet.

### 2.7 Highlighting Rules:

| Rule | Description |
| --- | --- |
| `@N*://*.example.com/*` | Adds a colored border to results from `example.com` and its subdomains |
| `@Ntitle/.*example.*/` | Adds a colored border to results whose title contains `example` |
| `@1path $= ".pdf"` | Adds a colored border to results whose link ends with `.pdf` |

**Notes:**
1. `@N` must be separated by a space from a bare domain rule; other rules may omit the space. For example, `@1 example.com` is recognized normally, while `@1example.com` is recognized as a whitelist rule.
2. Only 5 colors are supported, `@N` = `@1`–`@5`; open the custom color panel from the script menu.
3. Supports conditional expressions, such as `@N+host/path/url/scheme`.
4. Unlike uBlacklist, where highlighting implies a whitelist effect, a highlighting rule only adds a display: a result that matches both a highlighting rule and the blacklist is still blocked.

### 2.8 Composite Rules:

**`@if` Notes:**
1. Append `@if(...)` after a rule as an extra condition; multiple `@if` conditions apply together (they can be merged into a single `@if` with `&`). Composite rules are case-insensitive by default.
2. Condition expressions can be **used standalone**, e.g. `host $= ".example.com"`, `path *= "/download/"`, applying to all search results.
3. Quotes can be omitted for attribute values, e.g. `@if($site=google)`, `@if(scheme=https)`.
4. `$site` engine IDs are the same as in **2.9 Custom Engine**.

**Conditions supported by `@if`:**

| Condition Type | Syntax | Description |
| --- | --- | --- |
| Search Engine | `$site = "google"` | Only takes effect on the specified engine; case-insensitive, separator can be `=` or `:` |
| Search Type | `$category = "web"` | Only takes effect on the specified search type; can be `web`, `images`, `videos`, `news`; web search defaults to `web` |
| Search Site | `site = "google.com.hk"` | Only takes effect on the specified regional site of the search engine |
| Title Contains | `title *= "keyword"` | Title contains the string `keyword` |
| Title Exact | `title = "keyword"` | Title exactly matches the string `keyword` |
| Title Prefix | `title ^= "keyword"` | Title starts with the string `keyword` |
| Title Suffix | `title $= "keyword"` | Title ends with the string `keyword` |
| Title Regex | `title =~ /regex/` (or shorthand `title/regex/`) | Title matches regex; bare slashes are allowed inside `[...]`; trailing `i` ignores case |
| URL Exact | `url = "https://example.com/"` | URL is exactly the string |
| URL Prefix | `url ^= "https://abc.example.com"` | URL starts with the string |
| URL Suffix | `url $= ".pdf"` | URL ends with the string |
| URL Contains | `url *= "example"` | URL contains the string `example` |
| URL Regex | `url =~ /regex/` (or shorthand `url/regex/`) | URL matches regex; `=~` can be omitted; bare slashes are allowed inside `[...]`; trailing `i` ignores case |
| URL Host | `host $= ".example.com"` | Matches the hostname of the result URL; `$=` is compatible with the bare domain, so `host $= ".example.com"` hits both `example.com` and `m.example.com` |
| URL Path | `path *= "/download/"` | Matches the path of the result URL |
| URL Protocol | `scheme = "https"` | Matches the protocol of the result URL, e.g. `https` / `http` |
| Logical Operation | `\|` OR, `&` AND, `!` NOT | Combines arbitrary conditions; `!` negates the condition itself, e.g. `!(title *= "keyword")` hits results without a title |
| Parentheses Grouping | `( )` | Nests and groups sub-conditions |

**Condition Logic:**
1. `title` has the alias `t`, `url` has the alias `u`; e.g. `@if(t *= "keyword")` is equivalent to `@if(title *= "keyword")`.
2. `title`/`url`/`host`/`path`/`scheme` all support `=`, `^=`, `$=`, `*=`, `=~` and the shorthand omitting `=~` (e.g. `host/regex/`); `=~` case sensitivity follows the regex flags, while other comparisons ignore case by default.
3. The uBlacklist case modifier `i` (e.g. `title $= "Domain" i`) is recognized for compatibility only; the script ignores case by default.

**Composite Rule Examples:**

| Rule | Description |
| --- | --- |
| `*://*.example.com/* @if(title *= "keyword")` | Block `example.com` results whose title contains `keyword` |
| `*://*.example.com/* @if(title *= "keywordA" \| title *= "keywordB")` | Block `example.com` results whose title contains `keywordA` or `keywordB` |
| `*://*.example.com/* @if(title =~ /keywordA\|keywordB/i)` | Regex form of the rule above; a trailing `i` is required to ignore case |
| `*://*.example.com/* @if(title *= "keyword" & !(url *= "test"))` | Block `example.com` results whose title contains `keyword` and URL does not contain `test` |
| `*://*.example.com/* @if(site = "google.com.hk")` | Block `example.com` only on Google HK |
| `*://*.example.com/* @if($site = "google") @if(title *= "example")` | On Google only, block `example.com` results whose title contains `example` |
| `*://*.example.com/* @if($category = "images")` | Block `example.com` only in image search |
| `*://*.example.com/* @if(title *= "a" \| title *= "b") @if(!(url *= "c"))` | Block `example.com` results whose title contains `a` or `b` and URL does not contain `c` |
| `text/.*example.*/ @if($site = "google" \| $site = "bing")` | On Google or Bing, block results whose snippet contains `example` |
| `path *= "/download/"` | Block results whose path contains `/download/` |
| `host $= ".example.com" & path *= "/download/"` | Block results under `example.com` whose path contains `/download/` |
| `@1 path $= ".pdf"` | Highlight results whose URL path ends with `.pdf` |

### 2.9 Custom Engine:

Open the edit panel via the script manager menu `🖋️ Custom Engine` (JS format, same structure as the built-in [Selectors.js](https://raw.githubusercontent.com/Carteahere/Search-Engine-Result-Hider/main/Other/Selectors.js)).  
Not limited to search engines; theoretically any web site with a container can be added.

| Field | Type | Description |
| --- | --- | --- |
| `match` | regex | Required, hostname matching regex literal |
| `containers` | string | Required, CSS selector for result containers; the **One-click Block** button relies on it for positioning |
| `links` | string \| string\[\] | Optional, link selector, defaults to `a[href]` |
| `titles` | string \| string\[\] | Optional, title selector list |
| `snippets` | string \| string\[\] | Optional, snippet selector list |
| `extraElements` | string\[\] | Optional, array of relative CSS selectors starting from each result container to pick associated elements |
| `button` | boolean | Optional, `button: false` hides the **One-click Block** button in this engine (without affecting the one-click block switch); when missing or `button: true`, the button is shown by default |
| `disabled` | boolean | Optional, alias `disable`; `disabled: true` disables the engine, `disabled: false` restores the built-in |

**Examples:**

```javascript
example: {
  match: /^(?:(?:www|m)\.)?example\.com$/,
  containers: '.result',
  titles: ['.title'],
  snippets: ['.content'],
  links: 'a[href]',
  button: false,
},
bing: {disabled: true},
```

**Built-in engine IDs:**  
`google`, `google_scholar`, `bing`, `duckduckgo`, `duckduckgo_lite`, `yandex`, `brave`, `ecosia`, `startpage`, `yahoo`, `yahoo_japan`, `so360`, `sogou`, `toutiao`, `quark`, `github`, `greasyfork` (in `@if($site=)`, `yahoo-japan` = `yahoo_japan`, and `ddg` = `duckduckgo` = `duckduckgo_lite`).

**Notes:**

1. Custom engines support the `$site = "Engine ID"` condition as well as block/highlight/whitelist rules; selector fields do not support pseudo-elements such as `::after`.
2. Engine IDs allow only letters/digits/`_`/`-`; `other` is a reserved key and cannot be used. A custom engine with the same ID as a built-in engine, or an overlapping site, overrides the built-in selector. Priority: Custom engines > subscription engines > built-in engines.
3. On save, only keys that differ from the built-ins are stored; unmodified built-ins are not written to storage. Changing a value back to the built-in one, or using Reset, restores following script updates. When no selector matches, it falls back to `other` (empty) by default.
4. When adding a non-engine site with search functionality (in-site search), write the rule so that it applies only to that site. For example, on `m.example.com`, write `title/.*keyword.*/i @if($site = "example")`: the target site is the current non-engine site, which avoids blocking results containing the same keyword on external sites.

**Auto-analysis:**

If you are unsure how to add or capture selectors, send offline files of the search page (such as `.mht` or `.html`) along with a formatted table to the AI; it will analyze the container structure and generate the corresponding selectors. Since container naming may differ across mobile, desktop, or regional versions of search engines and web sites, save and analyze a file for each version and fill in multiple selectors accordingly.
