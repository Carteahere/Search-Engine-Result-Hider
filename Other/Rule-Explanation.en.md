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