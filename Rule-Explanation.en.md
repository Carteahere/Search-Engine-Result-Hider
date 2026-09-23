## Rule Explanation

### 2.1 URL Matching:

| Rule | Description |
| --- | --- |
| `*://abc.example.com/*` | Matches `abc.example.com` |
| `*://*.example.com/*` | Matches `example.com` and all its subdomains |
| `*://*.example.com/path/*` | Matches a specific path on `example.com` |
| `*://*.example.*` | Matches all Top-level/Second-level domains of `example.com` |
| `example.com` | Equivalent to `*://*.example.com/*`, script-only shorthand; rules also used in uBlacklist must keep the `*://*.` prefix |

URL wildcard rules match from the start of the URL per match-pattern semantics: `*://` only matches `http/https`, host wildcard `*` does not cross paths, `*.` also matches the bare domain; IDN domains (e.g. `例子.com`) and punycode (`xn--fsqu00a.com`) are treated as the same host.

### 2.2 Regex Matching:

| Rule | Description |
| --- | --- |
| `/pattern/flags` | Matches URL using regex, e.g. `/example\.(com\|net)/i` |
| `title/pattern/flags` | Matches title using regex, e.g. `title/.*block.*/i` |
| `text/pattern/flags` | Matches snippet content using regex, e.g. `text/.*ad.*/i` |

Plain regex uses browser-supported JavaScript `RegExp` flags: `i`, `m`, `s`, `u` (`s` = native dotAll, dot matches newline); `g`/`y` are not supported, as rules only test for a match without global extraction.

### 2.3 Title Matching:

| Rule | Description |
| --- | --- |
| `title/.*example.*/` | Matches results whose title contains `example` |
| `title/^example.*/` | Matches results whose title starts with `example` |
| `title/.*example(A\|B).*/` | Matches results whose title contains `exampleA` or `exampleB` |
| `title/.*example(A\|B).*/i` | Same as above with `i` to ignore case, also matching `examplea` or `exampleb` |
| `title/^(?=.*example1)(?=.*(?:example2)).*/i` | Case-insensitive and order-independent; matches results containing both `example1` and `example2` |
| `title/^(?=.*example1)(?=.*(?:example2\|example3)).*/i` | Case-insensitive and order-independent; matches results containing `example1` with `example2`, or `example1` with `example3` |

### 2.4 Snippet Matching:

| Rule | Description |
| --- | --- |
| `text/.*example.*/` | Matches results whose page description (snippet) contains `example` |
| `text/.*exampleabc.*/i` | Same as above, `i` ignores case |

### 2.5 Whitelist Matching:

| Rule | Description |
| --- | --- |
| `@*://*.com/*` | Allows all pages on domains ending in `.com` |
| `@*://example.com/*` | Allows the main site `example.com` |
| `@*://example.com/abc/*` | Allows a specific path on `example.com` |
| `@*://*.example.com/*` | Allows `example.com` and all its subdomains |
| `@*://*.example.com/abc/*` | Allows a specific path on subdomains of `example.com` |

### 2.6 Highlighting Rules:

| Rule | Description |
| --- | --- |
| `@N*://*.example.com/*` | Adds a colored border to results from `example.com` and its subdomains |
| `@N title/.*example.*/` | Adds a colored border to results whose title contains `example` |

Priority: Highlight > whitelist, but Blacklist > Highlight  
Note: `@N` is separated from the non-`*://` prefixe rule by a space. Only 5 colors, `@N` = `@1`–`@5`; open the custom color panel from the script menu.

### 2.7 Composite Rules:

**Description:**
1. Append `@if(...)` after a rule as an extra condition, rules and `@if` must be separated by spaces; multiple `@if` conditions all apply (logical AND `&`, can be merged into one `@if`). Composite matching is case-insensitive by default.
2. Condition expressions can be used standalone, e.g. `host $= ".example.com"`, `path *= "/download/"`, applying to all search results.
3. Within a single `@if`: `|` OR, `&` AND, `!` NOT, grouped with `( )`, precedence `!` > `&` > `|`.
4. `!` negates the condition itself; missing content (e.g. no title) fails the condition, so the negation passes, e.g. `!(title *= "keyword")` matches results without a title.
5. Quotes can be omitted for space-free values, e.g. `@if($site=google)`, `@if(scheme=https)`
6. Search Engine ID: `google`, `google_scholar`, `bing`, `duckduckgo`(`ddg`), `duckduckgo_lite`, `yandex`, `brave`, `yahoo`(`yahoo-japan`); for `duckduckgo`, `$site=duckduckgo` or `$site=ddg` also matches Lite, while `$site=duckduckgo_lite` matches only Lite.
7. Search Type: `web`, `images`, `videos`, `news`

**Conditions supported by `@if`:**

| Condition Type | Syntax | Description |
| --- | --- | --- |
| Search Engine | `$site = "google"` | Only takes effect on the specified engine; case-insensitive, `=` or `:`, quotes can be omitted (e.g. `$site=google`) |
| Search Type | `$category = "web"` | Only takes effect on the specified search type; inferred from the page URL, defaults to `web`, quotes can be omitted (e.g. `$category=images`) |
| Search Site | `site = "google.com.hk"` | Only takes effect on the specified regional site, quotes can be omitted (e.g. `site=google.com.hk`) |
| Title Contains | `title *= "keyword"` | Title contains `keyword` |
| Title Exact | `title = "keyword"` | Title equals `keyword` |
| Title Prefix | `title ^= "keyword"` | Title starts with `keyword` |
| Title Suffix | `title $= "keyword"` | Title ends with `keyword` |
| Title Regex | `title =~ /regex/` (or shorthand `title/regex/`) | Title matches regex, `=~` can be omitted, bare slashes allowed inside `[...]`, trailing `i` ignores case |
| URL Exact | `url = "https://example.com/"` | URL equals the string |
| URL Prefix | `url ^= "https://abc.example.com"` | URL starts with the string |
| URL Suffix | `url $= ".pdf"` | URL ends with the string |
| URL Contains | `url *= "example"` | URL contains `example` |
| URL Regex | `url =~ /regex/` (or shorthand `url/regex/`) | URL matches regex, `=~` can be omitted, bare slashes allowed inside `[...]`, trailing `i` ignores case |
| URL Host | `host $= ".example.com"` | Matches the hostname of the result URL; `$=` also matches the bare domain, so `host $= ".example.com"` hits both `example.com` and `www.example.com` |
| URL Path | `path *= "/download/"` | Matches pathname+search of the result URL |
| URL Protocol | `scheme = "https"` | Matches the protocol, e.g. `https`/`http`, quotes can be omitted (e.g. `scheme=https`) |
| Logical Operation | `\|` OR, `&` AND, `!` NOT | Combine arbitrary conditions |
| Parentheses Grouping | `( )` | Nest and group sub-conditions |

`title`/`url`/`host`/`path`/`scheme` all support `=`, `^=`, `$=`, `*=`, `=~` (and shorthand without `=~`, e.g. `host/regex/`). Comparisons ignore case by default; `=~` case sensitivity follows the regex flags. The uBlacklist case modifier `i` (e.g. `title $= "Domain" i`) is recognized for compatibility only; the script ignores case by default.

**Composite Rule Examples:**

| Rule | Description |
| --- | --- |
| `*://*.example.com/* @if(title *= "keyword")` | Block results from `example.com` whose title contains `keyword` |
| `*://*.example.com/* @if(title *= "keyword1" \| title *= "keyword2")` | Block results from `example.com` whose title contains `keyword1` or `keyword2` |
| `*://*.example.com/* @if(title =~ /keyword1\|keyword2/i)` | Regex form of the above; add trailing `i` to ignore case |
| `*://*.example.com/* @if(url *= "test")` | Block results from `example.com` whose URL contains `test`, e.g. `example.com/*/test/*` |
| `*://*.example.com/* @if(title *= "keyword" & !(url *= "test"))` | Block results from `example.com` whose title contains `keyword` and URL does not contain `test` |
| `*://*.example.com/* @if(site = "google.com.hk")` | Block `example.com` only on Google HK |
| `*://*.example.com/* @if($site = "google")` | Block `example.com` only on Google |
| `*://*.amazon.com/* @if($category = "images")` | Block `amazon.com` only in image search |
| `*://*.example.com/* @if($site = "google") @if(title *= "example")` | On Google only, block `example.com` results whose title contains `example` |
| `*://*.example.com/* @if(title *= "a" \| title *= "b") @if(!(url *= "c"))` | Block `example.com` results whose title contains `a` or `b` and URL does not contain `c` |
| `title/.*example.*/ @if($site = "google")` | On Google only, block results whose title contains `example` |
| `text/.*example.*/ @if($site = "google" \| $site = "bing")` | On both Google and Bing, block results whose snippet contains `example` |
| `path *= "/download/"` | Block results whose path contains `/download/` |
| `host $= ".example.com" & path *= "/download/"` | Block results under `example.com` whose path contains `/download/` |
| `@1 path $= ".pdf"` | Highlight results whose path ends with `.pdf` |

### 2.8 Custom Selectors:

Open the edit panel via script manager menu `🖋️ Custom Selectors` (JS format, same structure as built-in [SELECTORS](https://raw.githubusercontent.com/SadYuyuko/Search-Engine-Result-Hider/main/Other/SELECTORS.js)).

| Field | Type | Description |
| --- | --- | --- |
| `match` | regex | Required, hostname regex literal |
| `containers` | string | Required, CSS selector for result containers (pseudo-elements like `::after` unsupported) |
| `links` | string \| string\[\] | Optional, link selector, defaults to `a[href]` |
| `titles` | string \| string\[\] | Optional, title selector list |
| `snippets` | string \| string\[\] | Optional, snippet selector list |
| `extraElements` | string\[\] | Optional, array of relative CSS selectors anchored at each result container to select associated elements; these elements are hidden, expanded, and restored together with the result and are also used for fallback snippet extraction; available to custom engines as well |
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

1. Priority: Custom > Built-in. Change overrides back to built-in values or use "Reset" to follow script updates again.
2. Custom engines support the `$site = "Engine ID"` condition and block/highlight/whitelist rules; `titles`/`snippets` can be omitted.
3. Engine IDs allow only letters/digits/`_`/`-`; `other` is reserved. The same ID as, or a site overlapping, a built-in overrides it, e.g. `cn.bing.com` takes priority over built-in `bing`.
4. Built-in engine standard IDs: `google`, `google_scholar`, `bing`, `duckduckgo_lite`, `duckduckgo`, `yandex`, `brave`, `yahoo` (Note: `ddg` and `yahoo-japan` are aliases only in `@if($site=)` , Lite uses the separate ID `duckduckgo_lite` )
5. On save, only keys that differ from built-ins are stored. If the selector is not matched, it defaults to 'other' (leave blank) by default.
