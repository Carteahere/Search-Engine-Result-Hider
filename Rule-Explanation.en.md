## Rule Explanation

### 2.1 One-click Block:

Floating ball: Open Panel mode, when clicking the block button on an **unblocked result**.

| Type | Block Domain ON | Block Domain OFF |
| --- | --- | --- |
| Confirm ON | Dialog offers Exact/Domain/Whitelist, blocks Domain by default | Dialog offers Exact/Domain/Whitelist, blocks Exact by default |
| Confirm OFF | Blocks `*://*.example.com/*` | Blocks `*://m.example.com/*` |

Floating ball: Toggle show/hide results mode, when clicking the block button on a **blocked result**.

| Type | Local Rule | Subscription Rule |
| --- | --- | --- |
| Confirm ON | Dialog offers Delete Rule/Add Whitelist | Dialog prompts to add Whitelist |
| Confirm OFF | Deletes the corresponding local rule | Dialog prompts to add Whitelist |

### 2.2 URL Matching:

| Rule | Description |
| --- | --- |
| `*://abc.example.com/*` | Blocks `abc.example.com` |
| `*://*.example.com/*` | Blocks `example.com` and its subdomains |
| `*://*.example.*` | Blocks the top-level/second-level domains of `example.com` |
| `*://*.example.com/path/*` | Blocks a specific path on `example.com` |
| `*://*.example.com:8080/*` | Blocks port `8080` of `example.com` |
| `example.com` | Simple shorthand equivalent to `*://*.example.com/*`, adding the `*://*.` prefix is recommended in most cases |
| `*://*.例子.com` | Equivalent to `*://*.xn--fsqu00a.com`, Chinese and other IDN domains are treated as the same host as their punycode |

URL wildcard rules match from the start of the URL according to match-pattern semantics, the host wildcard `*` does not cross paths.

### 2.3 Regex Matching:

| Rule | Description |
| --- | --- |
| `/pattern/flags` | Regex matches the URL, using JavaScript RegExp, e.g. `/example\.(com\|net)/i` |
| flags: `i`, `m`, `s`, `u` | Supported, of which `s` uses native dotAll matching (dot matches newline) |
| flags: `g`, `y` | Not supported, script rules only test whether a match exists and do not perform global extraction |

### 2.4 Title Matching:

| Rule | Description |
| --- | --- |
| `title/.*example.*/i` | Blocks results whose title contains `example` |
| `title/^example.*/i` | Blocks results whose title starts with `example` |
| `title/.*example(A\|B).*/i` | Blocks results whose title contains `exampleA` or `exampleB` |
| `title/^(?=.*exampleA)(?=.*(?:exampleB)).*/i` | Case-insensitive and order-independent, blocks results whose title contains both `exampleA` and `exampleB` |
| `title/^(?=.*exampleA)(?=.*(?:exampleB\|exampleC)).*/i` | Case-insensitive and order-independent, blocks results whose title contains both `exampleA` and `exampleB` or both `exampleA` and `exampleC` |

### 2.5 Snippet Matching:

| Rule | Description |
| --- | --- |
| `text/.*example.*/` | Blocks results whose search result page description (snippet) contains `example` |
| `text/.*example.*/i` | Same as above, adding `i` ignores case |

### 2.6 Whitelist Matching:

| Rule | Description |
| --- | --- |
| `@*://*.com/*` | Allows domains ending in `.com` |
| `@*://example.com/*` | Allows `example.com` |
| `@*://*.example.com/*` | Allows `example.com` and its subdomains |
| `@*://example.com/abc/*` | Allows a specific path on `example.com` |

The `@@` syntax is not supported.

### 2.7 Highlighting Rules:

| Rule | Description |
| --- | --- |
| `@N*://*.example.com/*` | Adds a colored border to search results from `example.com` and its subdomains |
| `@Ntitle/.*example.*/` | Adds a colored border to results whose title contains `example` |
| `@1path $= ".pdf"` | Adds a colored border to results whose link ends with `.pdf` |

**Notes:**
1. `@N` must be separated by a space from a bare domain rule, other rules may omit the space, e.g. `@1 example.com` is recognized as a highlighting rule, `@1example.com` is recognized as a whitelist rule.
2. Open the custom color panel through the script menu option, it only supports 5 colors, i.e. `@N` ranges from `@1` to `@5`, when `N` > 5 the effect reverts to `@1`, when multiple highlighting rules are hit only the effect with the largest `N` is displayed.
3. Supports conditional expressions, e.g. `@N`+`host`/`path`/`url`/`text`/`scheme`.
4. Unlike uBlacklist highlighting that comes with a whitelist effect, a highlighting rule only serves as an additional display, i.e. when a rule is hit by both highlighting and blacklist it is still blocked, only after the `Highlight Whitelist` switch is turned on will highlighting rules carry a whitelist effect.

### 2.8 Composite Rules:

**`@if` Notes:**
1. Append `@if(...)` after a rule as an additional condition, multiple `@if` conditions can be used simultaneously (they can be merged into a single `@if` with `&`), composite rules are case-insensitive by default.
2. Condition expressions can be used standalone, e.g. `host $= ".example.com"`, `path *= "/download/"`, taking effect on all search results.
3. Attribute values can omit quotes, e.g. `@if($site=google)`, `@if(scheme=https)`.
4. `$site` engine IDs are the same as the IDs in the **Custom Engine** document.

**Conditions supported by `@if`:**

| Condition Type | Syntax | Description |
| --- | --- | --- |
| Search Engine | `$site = "google"` | Only takes effect in the specified search engine, case-insensitive, the separator can be `=` or `:` |
| Search Type | `$category = "web"` | Only takes effect in the specified search type of the search engine, e.g. `web`, `images`, `videos`, web pages default to `web` |
| Search Site | `site = "google.com.hk"` | Only takes effect in the specified regional site of the search engine |
| Title Contains | `title *= "keyword"` | Title contains the specified string `keyword` |
| Title Exact | `title = "keyword"` | Title exactly matches the specified string `keyword` |
| Title Prefix | `title ^= "keyword"` | Title starts with the specified string `keyword` |
| Title Suffix | `title $= "keyword"` | Title ends with the specified string `keyword` |
| Title Regex | `title =~ /regex/` (or shorthand `title/regex/`) | Title matches the regex, bare slashes are supported inside the character set `[...]`, adding `i` at the end ignores case |
| Snippet Contains | `text *= "keyword"` | Result snippet contains the specified string `keyword` |
| Snippet Exact | `text = "keyword"` | Result snippet exactly matches the specified string `keyword` |
| Snippet Prefix | `text ^= "keyword"` | Result snippet starts with the specified string `keyword` |
| Snippet Suffix | `text $= "keyword"` | Result snippet ends with the specified string `keyword` |
| Snippet Regex | `text =~ /regex/` (or shorthand `text/regex/`) | Result snippet matches the regex, bare slashes are supported inside the character set `[...]`, adding `i` at the end ignores case |
| URL Exact | `url = "https://example.com/"` | URL is completely identical to the specified string |
| URL Prefix | `url ^= "https://abc.example.com"` | URL starts with the specified string |
| URL Suffix | `url $= ".pdf"` | URL ends with the specified string |
| URL Contains | `url *= "example"` | URL contains the specified string `example` |
| URL Regex | `url =~ /regex/` (or shorthand `url/regex/`) | URL matches the regex, `=~` can be omitted, bare slashes are supported inside the character set `[...]`, adding `i` at the end ignores case |
| URL Host | `host $= ".example.com"` | Matches the host of the result URL, `$=` is compatible with the bare domain, i.e. `host $= ".example.com"` hits both `example.com` and `m.example.com` |
| URL Path | `path *= "/download/"` | Matches the path of the result URL, supports decoding Chinese paths (`u.pathname` + `u.search`) |
| URL Protocol | `scheme = "https"` | Matches the protocol of the result URL, e.g. `https` / `http` |
| Logical Operation | `\|` OR, `&` AND, `!` NOT | Combines arbitrary conditions, `!` negates the condition itself, e.g. `!(title *= "keyword")` will hit results without a title |
| Parentheses Grouping | `( )` | Nests and groups sub-conditions |

**Condition Logic:**
1. `title` has the alias `t`, `url` has the alias `u`, e.g. `@if(t *= "keyword")` is equivalent to `@if(title *= "keyword")`.
2. `title`/`text`/`url`/`host`/`path`/`scheme` all support `=`, `^=`, `$=`, `*=`, `=~` and the shorthand omitting `=~` (e.g. `host/regex/`), `=~` case sensitivity is determined by the regex flags, comparisons ignore case by default.
3. Compatible with the uBlacklist case modifier `i` (e.g. `title $= "Domain" i`), this syntax is only used to recognize and be compatible with rules, the script ignores case by default.

**Composite Rule Examples:**

| Rule | Description |
| --- | --- |
| `*://*.example.com/* @if(title *= "keyword")` | Block `example.com` results whose title contains `keyword` |
| `*://*.example.com/* @if(title *= "keywordA" \| title *= "keywordB")` | Block `example.com` results whose title contains `keywordA` or `keywordB` |
| `*://*.example.com/* @if(title =~ /keywordA\|keywordB/i)` | Regex form of the previous rule, adding `i` at the end is required to ignore case |
| `*://*.example.com/* @if(text *= "keyword")` | Block `example.com` results whose snippet contains `keyword` |
| `*://*.example.com/* @if(title *= "keyword" & !(url *= "test"))` | Block `example.com` results whose title contains `keyword` and URL does not contain `test` |
| `*://*.example.com/* @if(site = "google.com.hk")` | Block `example.com` only on Google HK |
| `*://*.example.com/* @if($site = "google") @if(title *= "example")` | Block `example.com` results whose title contains `example` only on Google |
| `*://*.example.com/* @if(title *= "a" \| title *= "b") @if(!(url *= "c"))` | Block `example.com` results whose title contains `a` or `b` and URL does not contain `c` |
| `text/.*example.*/ @if($site = "google" \| $site = "bing")` | Block results whose page description contains `example` on both Google and Bing |
| `path *= "/download/"` | Block results whose path contains `/download/` |
| `host $= ".example.com" & path *= "/download/"` | Block `example.com` results whose path contains `/download/` |
| `@1 path $= ".pdf"` | Highlight results whose URL path ends with `.pdf` |
