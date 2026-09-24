## Rule Explanation

### 2.1 One-click Block

Floating ball in "Open Panel" mode — clicking the block button on an **unblocked result**:

| Setting | Block Domain ON | Block Domain OFF |
| --- | --- | --- |
| Confirm ON | Dialog offers Exact / Domain / Whitelist, Domain block selected by default | Dialog offers Exact / Domain / Whitelist, Exact block selected by default |
| Confirm OFF | Directly blocks `*://*.example.com/*` | Directly blocks `*://abc.example.com/*` |

Floating ball in "Toggle Results" (show/hide results) mode — clicking the block button on a **blocked result**:

| Setting | Local Rule | Subscription Rule |
| --- | --- | --- |
| Confirm ON | Dialog offers Delete Rule / Add Whitelist | Dialog prompts to add Whitelist |
| Confirm OFF | Directly deletes the corresponding local rule | Dialog prompts to add Whitelist |

### 2.2 URL Matching:

| Rule | Description |
| --- | --- |
| `*://abc.example.com/*` | Matches `abc.example.com` |
| `*://*.example.com/*` | Matches `example.com` and all its subdomains |
| `*://*.example.com/path/*` | Matches a specific path on `example.com` |
| `*://*.example.*` | Matches all Top-level/Second-level domains of `example.com` |
| `example.com` | Equivalent to `*://*.example.com/*`, script-only shorthand; rules also used in uBlacklist must add the `*://*.` prefix |

URL wildcard rules match from the start of the URL per match-pattern semantics; the host wildcard `*` does not cross paths; the `*.` prefix also matches the bare domain; Chinese and other IDN domains and punycode (e.g. `例子.com` and `xn--fsqu00a.com`) are treated as the same host.

### 2.3 Regex Matching:

| Rule | Description |
| --- | --- |
| `/pattern/flags` | Matches URL using regex, e.g. `/example\.(com\|net)/i` |
| `title/pattern/flags` | Matches title using regex, e.g. `title/.*block.*/i` |
| `text/pattern/flags` | Matches snippet content using regex, e.g. `text/.*ad.*/i` |

Regex uses browser-supported JavaScript `RegExp` flags: `i`, `m`, `s`, `u` (`s` = native dotAll, dot matches newline); `g`/`y` are not supported, as script rules only test for a match without global extraction; when flags ≤ 2 characters, `g`/`y` are automatically detected and reported as an error.

### 2.4 Title Matching:

| Rule | Description |
| --- | --- |
| `title/.*example.*/` | Matches results whose title contains `example` |
| `title/^example.*/` | Matches results whose title starts with `example` |
| `title/.*example(A\|B).*/` | Matches results whose title contains `exampleA` or `exampleB` |
| `title/^(?=.*exampleA)(?=.*(?:exampleB)).*/i` | Case-insensitive and order-independent; matches results containing both `exampleA` and `exampleB` |
| `title/^(?=.*exampleA)(?=.*(?:exampleB\|exampleC)).*/i` | Case-insensitive and order-independent; matches results containing `exampleA` with `exampleB`, or `exampleA` with `exampleC` |

### 2.5 Snippet Matching:

| Rule | Description |
| --- | --- |
| `text/.*example.*/` | Matches results whose page description (snippet) contains `example` |
| `text/.*exampleabc.*/i` | Same as above, `i` ignores case |

### 2.6 Whitelist Matching:

| Rule | Description |
| --- | --- |
| `@*://*.com/*` | Allows all pages on domains ending in `.com` |
| `@*://example.com/*` | Allows the main site `example.com` |
| `@*://example.com/abc/*` | Allows a specific path on `example.com` |
| `@*://*.example.com/*` | Allows `example.com` and all its subdomains |

### 2.7 Highlighting Rules:

| Rule | Description |
| --- | --- |
| `@N*://*.example.com/*` | Adds a colored border to results from `example.com` and its subdomains |
| `@N title/.*example.*/` | Adds a colored border to results whose title contains `example` |

Notes:
1. Priority: Highlight > Whitelist, but Blacklist > Highlight
2. `@N` must be separated by a space from rules that do not start with `*://`, such as `@1example.com` which will be recognized as a whitelist rule (allowing `1example.com`)
3. Only 5 colors are supported, `@N` = `@1`–`@5`; open the custom color panel from the script menu

### 2.8 Composite Rules:

**Notes:**
1. Append `@if(...)` after a rule as an extra condition; the rule and `@if` must be separated by a space; multiple `@if` conditions all apply (they can be merged into a single `@if` with `&`). Composite rules are case-insensitive by default.
2. Within `@if`, logical operations are supported: `|` OR, `&` AND, `!` NOT, nested and grouped with parentheses, precedence `!` > `&` > `|`.
3. `!` negates the condition itself, e.g. `!(title *= "keyword")` matches results without a title.
4. Condition expressions can be used standalone, e.g. `host $= ".example.com"`, `path *= "/download/"`, applying to all search results.
5. Quotes can be omitted for attribute values; space-free values such as `@if($site=google)`, `@if(scheme=https)` can be written bare.
6. Search engine IDs are the same as in Custom Selectors (see 2.9).

**Conditions supported by `@if`:**

| Condition Type | Syntax | Description |
| --- | --- | --- |
| Search Engine | `$site = "google"` | Only takes effect on the specified engine; case-insensitive, separator can be `=` or `:`, quotes can be omitted (e.g. `$site=google`) |
| Search Type | `$category = "web"` | Only takes effect on the specified search type; can be `web`, `images`, `videos`, `news`; web search defaults to `web`; quotes can be omitted (e.g. `$category=images`) |
| Search Site | `site = "google.com.hk"` | Only takes effect on the specified regional site of the search engine; quotes can be omitted (e.g. `site=google.com.hk`) |
| Title Contains | `title *= "keyword"` | Title contains the string `keyword` |
| Title Exact | `title = "keyword"` | Title exactly matches the string `keyword` |
| Title Prefix | `title ^= "keyword"` | Title starts with the string `keyword` |
| Title Suffix | `title $= "keyword"` | Title ends with the string `keyword` |
| Title Regex | `title =~ /regex/` (or shorthand `title/regex/`) | Title matches regex, `=~` can be omitted, bare slashes allowed inside `[...]`, trailing `i` ignores case |
| URL Exact | `url = "https://example.com/"` | URL is exactly identical to the string |
| URL Prefix | `url ^= "https://abc.example.com"` | URL starts with the string |
| URL Suffix | `url $= ".pdf"` | URL ends with the string |
| URL Contains | `url *= "example"` | URL contains the string `example` |
| URL Regex | `url =~ /regex/` (or shorthand `url/regex/`) | URL matches regex, `=~` can be omitted, bare slashes allowed inside `[...]`, trailing `i` ignores case |
| URL Host | `host $= ".example.com"` | Matches the hostname of the result URL; `$=` is compatible with the bare domain, so `host $= ".example.com"` hits both `example.com` and `www.example.com` |
| URL Path | `path *= "/download/"` | Matches the path + query string (pathname+search) of the result URL |
| URL Protocol | `scheme = "https"` | Matches the protocol of the result URL, e.g. `https`/`http`; quotes can be omitted (e.g. `scheme=https`) |
| Logical Operation | `\|` OR, `&` AND, `!` NOT | Combine arbitrary conditions |
| Parentheses Grouping | `( )` | Nest and group sub-conditions |

`title`/`url`/`host`/`path`/`scheme` all support `=`, `^=`, `$=`, `*=`, `=~` (and shorthand without `=~`, e.g. `host/regex/`). Comparisons ignore case by default; `=~` case sensitivity follows the regex flags. The uBlacklist case modifier `i` (e.g. `title $= "Domain" i`) is recognized for compatibility only; the script ignores case by default.

**Composite Rule Examples:**

| Rule | Description |
| --- | --- |
| `*://*.example.com/* @if(title *= "keyword")` | Block results from `example.com` whose title contains `keyword` |
| `*://*.example.com/* @if(title *= "keywordA" \| title *= "keywordB")` | Block results from `example.com` whose title contains `keywordA` or `keywordB` |
| `*://*.example.com/* @if(title =~ /keywordA\|keywordB/i)` | Regex form of the above; add trailing `i` to ignore case |
| `*://*.example.com/* @if(title *= "keyword" & !(url *= "test"))` | Block results from `example.com` whose title contains `keyword` and URL does not contain `test` |
| `*://*.example.com/* @if(site = "google.com.hk")` | Block `example.com` only on Google HK |
| `*://*.example.com/* @if($site = "google") @if(title *= "example")` | On Google only, block `example.com` results whose title contains `example` |
| `*://*.example.com/* @if($category = "images")` | Block `example.com` only in image search |
| `*://*.example.com/* @if(title *= "a" \| title *= "b") @if(!(url *= "c"))` | Block `example.com` results whose title contains `a` or `b` and URL does not contain `c` |
| `text/.*example.*/ @if($site = "google" \| $site = "bing")` | On both Google and Bing, block results whose snippet contains `example` |
| `path *= "/download/"` | Block results whose path contains `/download/` |
| `host $= ".example.com" & path *= "/download/"` | Block results under `example.com` whose path contains `/download/` |
| `@1 path $= ".pdf"` | Highlight results whose URL path ends with `.pdf` |

### 2.9 Custom Selectors:

Open the edit panel via script manager menu `🖋️ Custom Selectors` (JS format, same structure as built-in [SELECTORS](https://raw.githubusercontent.com/Carteahere/Search-Engine-Result-Hider/main/Other/SELECTORS.js)).

| Field | Type | Description |
| --- | --- | --- |
| `match` | regex | Required, hostname matching regex literal |
| `containers` | string | Required, CSS selector for result containers (pseudo-elements like `::after` unsupported), ; the **one-click block** button relies on it |
| `links` | string \| string\[\] | Optional, link selector, defaults to `a[href]` |
| `titles` | string \| string\[\] | Optional, title selector list the title selector for positioning |
| `snippets` | string \| string\[\] | Optional, snippet selector list |
| `extraElements` | string\[\] | Optional, array of relative CSS selectors starting from each result container to pick associated elements; these elements are hidden, expanded, and restored together with the result, and are also used for fallback snippet extraction; also available to custom engines |
| `disabled` | boolean | Optional, `true` disables the engine (built-ins included); alias `disable`; writing `disabled: false` (or `disable: false`) alone restores the built-in |

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

1. Priority: Custom selectors > Built-in selectors. Changing an override back to the built-in value or using Reset restores following script updates.
2. Custom engines support the `$site = "Engine ID"` condition as well as block/highlight/whitelist rules; `titles`/`snippets` can be omitted.
3. Engine IDs allow only letters/digits/`_`/`-`; `other` is a reserved key and cannot be used. The same ID as a built-in engine, or an overlapping site, overrides the built-in selectors, e.g. matching `cn.bing.com` takes priority over built-in `bing`.
4. Built-in engine standard IDs: `google`, `google_scholar`, `bing`, `duckduckgo_lite`, `duckduckgo`, `yandex`, `brave`, `yahoo` (Note: `ddg` and `yahoo-japan` are shorthand aliases only for `@if($site=)` condition rules; Lite uses the separate ID `duckduckgo_lite`)
5. On save, only keys that differ from the built-ins are stored; unmodified built-ins are not written to storage. When no selector matches, it falls back to `other` (empty) by default.
