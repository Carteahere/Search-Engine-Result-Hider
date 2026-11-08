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
2. Open the custom color panel through the script menu option. It only supports 5 colors, where `@N` ranges from `@1` to `@5`. When `N` > 5, the effect reverts to `@1`. When multiple highlighting rules are matched, only the effect with the largest `N` is displayed.
3. Supports conditional expressions, such as `@N+host/path/url/text/scheme`.
4. Unlike uBlacklist, where highlighting implies a whitelist effect, a highlighting rule only adds a display: a result that matches both a highlighting rule and the blacklist is still blocked. The highlighting rules will only have a whitelist effect when the `Highlight Whitelist` switch is turned on.

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
| Search Type | `$category = "web"` | Only takes effect on the specified search type; built-in types are `web`, `images`, `videos`, `news`; web search defaults to `web`. |
| Search Site | `site = "google.com.hk"` | Only takes effect on the specified regional site of the search engine |
| Title Contains | `title *= "keyword"` | Title contains the string `keyword` |
| Title Exact | `title = "keyword"` | Title exactly matches the string `keyword` |
| Title Prefix | `title ^= "keyword"` | Title starts with the string `keyword` |
| Title Suffix | `title $= "keyword"` | Title ends with the string `keyword` |
| Title Regex | `title =~ /regex/` (or shorthand `title/regex/`) | Title matches regex; bare slashes are allowed inside `[...]`; trailing `i` ignores case |
| Snippet Contains | `text *= "keyword"` | Result snippet contains the string `keyword` |
| Snippet Exact | `text = "keyword"` | Result snippet exactly matches the string `keyword` |
| Snippet Prefix | `text ^= "keyword"` | Result snippet starts with the string `keyword` |
| Snippet Suffix | `text $= "keyword"` | Result snippet ends with the string `keyword` |
| Snippet Regex | `text =~ /regex/` (or shorthand `text/regex/`) | Result snippet matches regex; bare slashes are allowed inside `[...]`; trailing `i` ignores case |
| URL Exact | `url = "https://example.com/"` | URL is exactly the string |
| URL Prefix | `url ^= "https://abc.example.com"` | URL starts with the string |
| URL Suffix | `url $= ".pdf"` | URL ends with the string |
| URL Contains | `url *= "example"` | URL contains the string `example` |
| URL Regex | `url =~ /regex/` (or shorthand `url/regex/`) | URL matches regex; `=~` can be omitted; bare slashes are allowed inside `[...]`; trailing `i` ignores case |
| URL Host | `host $= ".example.com"` | Matches the hostname of the result URL; `$=` is compatible with the bare domain, so `host $= ".example.com"` hits both `example.com` and `m.example.com` |
| URL Path | `path *= "/download/"` | Matches the path of the result URL (`u.pathname` + `u.search`) |
| URL Protocol | `scheme = "https"` | Matches the protocol of the result URL, e.g. `https` / `http` |
| Logical Operation | `\|` OR, `&` AND, `!` NOT | Combines arbitrary conditions; `!` negates the condition itself, e.g. `!(title *= "keyword")` hits results without a title |
| Parentheses Grouping | `( )` | Nests and groups sub-conditions |

**Condition Logic:**
1. `title` has the alias `t`, `url` has the alias `u`; e.g. `@if(t *= "keyword")` is equivalent to `@if(title *= "keyword")`.
2. `title`/`text`/`url`/`host`/`path`/`scheme` all support `=`, `^=`, `$=`, `*=`, `=~` and the shorthand omitting `=~` (e.g. `host/regex/`); `=~` case sensitivity follows the regex flags, while other comparisons ignore case by default.
3. The uBlacklist case modifier `i` (e.g. `title $= "Domain" i`) is recognized for compatibility only; the script ignores case by default.

**Composite Rule Examples:**

| Rule | Description |
| --- | --- |
| `*://*.example.com/* @if(title *= "keyword")` | Block `example.com` results whose title contains `keyword` |
| `*://*.example.com/* @if(title *= "keywordA" \| title *= "keywordB")` | Block `example.com` results whose title contains `keywordA` or `keywordB` |
| `*://*.example.com/* @if(title =~ /keywordA\|keywordB/i)` | Regex form of the rule above; a trailing `i` is required to ignore case |
| `*://*.example.com/* @if(text *= "keyword")` | Block `example.com` results whose snippet contains `keyword` |
| `*://*.example.com/* @if(title *= "keyword" & !(url *= "test"))` | Block `example.com` results whose title contains `keyword` and URL does not contain `test` |
| `*://*.example.com/* @if(site = "google.com.hk")` | Block `example.com` only on Google HK |
| `*://*.example.com/* @if($site = "google") @if(title *= "example")` | On Google only, block `example.com` results whose title contains `example` |
| `*://*.example.com/* @if(title *= "a" \| title *= "b") @if(!(url *= "c"))` | Block `example.com` results whose title contains `a` or `b` and URL does not contain `c` |
| `text/.*example.*/ @if($site = "google" \| $site = "bing")` | On Google or Bing, block results whose snippet contains `example` |
| `path *= "/download/"` | Block results whose path contains `/download/` |
| `host $= ".example.com" & path *= "/download/"` | Block results under `example.com` whose path contains `/download/` |
| `@1 path $= ".pdf"` | Highlight results whose URL path ends with `.pdf` |

### 2.9 Custom Engine:

Open the edit panel via the script manager menu `🖋️ Custom Engine` (JS format, same structure as the built-in [Selectors.js](https://raw.githubusercontent.com/Carteahere/Search-Engine-Result-Hider/main/Other/Selectors.js)).  
Not limited to search engines; theoretically any web site with a container can be added.

**Built-in engine IDs:**

`google`, `google_scholar`, `bing`, `duckduckgo`, `duckduckgo_lite`, `yandex`, `brave`, `ecosia`, `startpage`, `yahoo`, `yahoo_japan`, `so360`, `sogou`, `toutiao`, `quark`, `github`, `greasyfork`  
In `@if($site = "engine")`, `yahoo-japan` = `yahoo_japan`, `ddg` = `duckduckgo` = `duckduckgo_lite`

**Engine selector structure:**

| Field | Type | Description |
| --- | --- | --- |
| `match` | regex | Required, hostname matching regex literal, case ignored by default |
| `containers` | string | Required, CSS selector for result containers; the **One-click Block** button relies on it for positioning |
| `links` | string \| string\[\] | Optional, link selector, defaults to `a[href]` |
| `titles` | string \| string\[\] | Optional, title selector list |
| `snippets` | string \| string\[\] | Optional, snippet selector list |
| `button` | boolean | Optional, `button: false` hides the **One-click Block** button in this engine (without affecting the one-click block switch); `button: true` or missing, the button is shown by default |
| `disabled` | boolean | Optional, alias `disable`; `disabled: true` disables the engine, `disabled: false` or missing restores the built-in |
| `extraElements` | string\[\] | Optional, array of relative CSS selectors starting from each result container to pick associated elements |
| `categories` | object | Optional, search-type category definitions, see below |

**Search type categories:**

Similar to the uBlacklist classification matching substructure, selectors and `match` are defined separately for specific search types of search engines such as images/videos/news, and the `match` regular expression for each classification is attempted to match the entire URL in the declared order. If a match is found, that classification is adopted. If no match is found or no classification is declared, the default is `web` (the top-level selector). Classification names are allowed to contain letters/numbers/`_`/`-`, with `web`, `images`, `videos`, and `news` being built-in by default.  
Within a category you can write `match`(Required), `containers`, `links`, `titles`, `snippets`, `button`, `extraElements`; fields not written are inherited from the top-level definition.

| Rule | Description |
| --- | --- |
| `categories.images.match: /tbm=isch\|udm=2/` | When the URL matches, treat the page as image search |
| `categories.videos.containers: 'div.card'` | Use a dedicated container selector on video search pages |

**Advanced links / titles extraction syntax:**

When the link or title does not sit directly on `href` / the element (e.g. the real target of an image result is stored in a JSON attribute), append an `@` extraction directive to the selector:

| Syntax | Description | Example |
| --- | --- | --- |
| `sel@attr:name` | Reads the element's `name` attribute value; `sel@attr` is equivalent to a normal link reading `href` | Bing video `[ourl]@attr:ourl` |
| `sel@json:attr.path.path` | Parses the JSON in the element's `attr` attribute and reads by path | Bing image `a.iusc@json:m.purl` |
| `sel@query:attr.param` | Reads a query parameter from the URL in the element's `attr` attribute (usually `href`) | Google image `a[href*="/imgres"]@query:href.imgurl` |
| `sel@b64url` | Decodes a URL from the base64 fragment in the element's `src` | Brave image `img[src*="imgs.search.brave.com"]@b64url` |
| `sel@attr:name` (in titles) | Uses an attribute's text as the title; `sel@json:` works the same way | `img@attr:alt` |

**Examples:**

```javascript
example_engine: {
  match: /^(?:(?:www|m)\.)?example\.com$/,
  containers: '.result',
  titles: ['.title'],
  snippets: ['.content'],
  links: 'a[href]',
  categories: {
    images: {
      match: /\/images\//,
      containers: 'div.img-card',
      titles: ['img@attr:alt'],
      links: ['a.thumb@json:data.url', 'a[href]'],
    },
    videos: {
      match: /\/videos\//,
      containers: 'div.video-card' },
    },
  button: false,
},
bing: {disabled: true},
```

**Notes:**

1. Custom engines support the `$site = "Engine ID"` condition as well as block/highlight/whitelist rules; selector fields do not support pseudo-elements such as `::after`.
2. Engine IDs are allowed to contain letters/numbers/`_`/`-`; `other` is a reserved key and cannot be used. A custom engine with the same ID as a built-in engine, or an overlapping site, overrides the built-in selector. Priority: Custom engines > subscription engines > built-in engines.
3. On save, only keys that differ from the built-ins are stored; unmodified built-ins are not written to storage. Changing a value back to the built-in one, or using Reset, restores following script updates. When no selector matches, it falls back to `other` (empty) by default.
4. When adding a non-engine site with search functionality (in-site search), write the rule so that it applies only to that site. For example, on `m.example.com`, write `title/.*keyword.*/i @if($site = "example")`: the target site is the current non-engine site, which avoids blocking results containing the same keyword on external sites.

**Auto-analysis:**

1. Conversion script: Download [auto_convert.cmd](https://raw.githubusercontent.com/Carteahere/Search-Engine-Result-Hider/main/Other/auto_convert.cmd) and run it in the same directory as the `.mht` / `.mhtml` offline file of the target webpage. This conversion script can perform basic container structure analysis and generate the corresponding `.js` selector file.
2. AI generation: If the conversion script cannot recognize or knows how to grab selectors, it is recommended to send the custom engine description and `.mht` / `.mhtml` / `.html` offline files to AI for analyzing the structure and generating corresponding selectors.
3. The naming of containers for mobile/desktop/regional sites of the same website may vary, requiring separate offline file analysis and filling in multiple selectors.