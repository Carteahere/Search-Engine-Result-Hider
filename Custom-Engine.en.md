## Custom Engine

Open the edit panel through the script manager menu `🖋️ Custom Engine` (JS format, same structure as the built-in [Selectors.js](https://raw.githubusercontent.com/Carteahere/Search-Engine-Result-Hider/main/Other/Selectors.js)).  
Not limited to search engines; in theory, any site page that contains containers can be added.

**Built-in engine IDs:**

`google`, `google_scholar`, `bing`, `duckduckgo`, `duckduckgo_lite`, `yandex`, `brave`, `ecosia`, `startpage`, `yahoo`, `yahoo_japan`, `so360`, `sogou`, `toutiao`, `quark`, `github`, `greasyfork`

In `@if($site = "engine")`, by default `yahoo-japan` = `yahoo_japan`, `ddg` = `duckduckgo` = `duckduckgo_lite`; custom aliases can be defined in the `site` field

### 1.1 Selector Structure:

In the script, an engine's selector structure is a group of fields wrapped in `engine_id: {...}`. Engine IDs allow letters/numbers/`_`/`-`, and `other` is a reserved key that cannot be used. When a custom engine shares an ID with a built-in engine or their sites overlap, it overrides the built-in selector. Priority: custom engines > subscription engines > built-in engines.

### 1.1.1 Basic Structure:

| Field | Type | Description | Required |
| --- | --- | --- | --- |
| `matches` | string \| string[] | Matched against the whole URL; at least one of this and `includeRegex` must exist | ✔ |
| `excludeMatches` | string \| string[] | Excluded from the whole URL; when it hits, blocking does not take effect and matching falls back by priority | |
| `includeRegex` | regex | URL matching regex; at least one of this and `matches` must exist | ✔ |
| `excludeRegex` | regex | URL exclusion regex; when it hits, blocking does not take effect and matching falls back by priority | |
| `root` | string \| array | Result container selector; command or CSS selector; the **One-click Block** button relies on the container selector to locate results | ✔ |
| `url` | command \| string \| string[] | Result link selector; command array or CSS selector, default `a[href]` | ✔ |
| `title` | command \| string \| string[] | Title selector; command array or CSS selector | |
| `snippet` | command \| string \| string[] | Snippet selector; command array or CSS selector | |
| `disabled` | boolean | Engine enable switch; `true` disables the engine | |
| `button` | boolean \| object \| array | Display toggle or position of the **One-click Block** button; `false` hides the button on that engine; for custom relative positions see **1.2.2** |

The legacy forms `containers`, `links`, `titles`, and `match` map to `root`, `url`, `title`, and `includeRegex` respectively.

Commands available for `root`:

1. `['upward', levels, innerSelector]`, `['upward', selector, innerSelector]` — walk up to the nearest matching ancestor.
2. `['selector', selector]` — for cases where the result container is the parent of the inner element.

### 1.1.2 Advanced Structure:

| Field | Type | Description |
| --- | --- | --- |
| `name` | string | For remarks only; not read by the script |
| `priority` | number | Engine matching priority; the larger the value, the higher the priority |
| `delay` | boolean \| number | Script startup delay; when filled with a number, the unit is `ms`; `true` or a missing field executes blocking immediately after the page finishes loading |
| `preserveSpace` | boolean \| number \| string \| object | Reserve blank page space to keep pagination working after all results are blocked; `true` defaults to `60vh`, unit `px`; object form `{ height, container }` where `container` is the placeholder selector |
| `extraSelector` | string \| string[] | Relative CSS selector; starting from the result container, selects associated elements. When written as a single string containing top-level commas, each item starts with `&` |
| `site` | string \| string[] | Engine aliases, usable in `$site`; multiple aliases can be written, separated by commas |
| `command` | — | A group of multi-purpose commands of the script; see the **`command` group** below for details |
| `pages` | — | Search type category definitions; supports object or array form, the object key name is the `$category`; see **Search type substructure** below for details |

**`command` group:**

| Field | Type | Description |
| --- | --- | --- |
| `link.redirects` | object[] | Redirect removal logic; whether it is enabled is decided by the `Remove redirects` toggle |
| `link.directAttrs` | string \| string[] | During redirect removal, which attribute to read first |
| `link.directScope` | string \| string[] | During redirect removal, the scope in which to find that attribute |
| `link.directProtocol` | string | During redirect removal, the scheme prepended when a value read from `directAttrs` starts with `//` |
| `skip` | string | Skip the specified result containers |
| `group` | object | Hide the parent structure after all results in the same group are blocked; supports `container`, `members`, `hideAttr` |
| `grid` | object | Hide empty grid slots on the image search page; supports `anchor`, `cell`, `items`, `has`, `deepest`, `hideAttr` |
| `dedupeBy` | string | Deduplicate results by the elements selected by this CSS selector, avoiding duplicates |
| `blockedCss` | string[] | Engine-specific styles injected with the script when this engine matches; used for the engine's blocked gray background/layout fixes; can be declared at both the top level and `pages` categories; a category-level declaration overrides the engine-level one |

**Fields supported by each `link.redirects` item:**

| Field | Description | Example |
| --- | --- | --- |
| `path` | URL path matching regex | — |
| `params` | Query parameter names tried in order | — |
| `pathValue` | Capture regex matched against the URL path; capture group 1 is the encoded target | yahoo's `RU=` |
| `hrefSuffix` | Capture regex matched against the whole URL; capture group 1 is the encoded target | yahoo's `/*-` suffix |
| `codec` | Decoder; built-in `url`, `base64url`, `pattern` | — |
| `stripPrefix` | Prefix regex stripped before `base64url` decoding | bing's `/^a[01]/i` |
| `chain` | When the unwrapped URL is still an engine redirect link, unwraps one more level via the specified query parameter; when `hostSelf` is omitted the target host is not restricted | `{ hostSelf: true, param: 'h5_url' }` |

**Search type substructure:**

Similar to SERPINFO's `pages`, this defines matching and selectors separately for specific search types such as images/videos; the whole URL is matched in declaration order, the first category that hits is adopted, and when nothing hits or no category is declared, `web` is the default. `pages` supports both object and array form.

| Field | Type | Description |
| --- | --- | --- |
| (key name) | string | Category name, i.e. the `$category`; letters/numbers/`_`/`-` are allowed |
| `matches`/`excludeMatches` | string \| string[] | Whole-URL matching/exclusion, same as the basic structure |
| `includeRegex`/`excludeRegex` | regex | URL regex matching/exclusion, same as the basic structure |
| `commonProps` | object | `$site` / `$category` are derived automatically from the engine ID and category name; write them only when overriding is needed |
| (structure fields) | — | May write `root`, `url`, `title`, `snippet`, `button`, `extraSelector`, `command`, etc.; unspecified fields inherit from the top level, and `blockedCss` overrides the top-level rule |

Object form: the key name is the `$category`

```javascript
pages: {
  images: { includeRegex: /\/images\//, root: 'div.img-card', title: ['attribute', 'alt', 'img[alt]'] },
  videos: { includeRegex: /\/videos\// },
}
```

Array form: each item uses `name` as its key and derives `$category`; a `commonProps.$category` override can be written; items lacking both `name` and `$category` are ignored

```javascript
pages: [
  { name: 'images', includeRegex: /\/images\//, root: 'div.img-card', title: ['attribute', 'alt', 'img[alt]'] },
  { name: 'videos', includeRegex: /\/videos\// },
]
```

### 1.2 Parameter Descriptions:

### 1.2.1 Value Commands:

| Command | Description |
| --- | --- |
| `['attribute', name, selector?]` | Read an element attribute; when the element is omitted, the result container itself is used |
| `['property', name, selector?]` | Read an element JS property such as `href`, `textContent`, `src`; when the element is omitted, the result container itself is used |
| `['text', selector?]` | Read element text |
| `['const', value]` | Return a fixed string value |
| `['jsonParse', command]` | Parse the value as JSON; objects pass through unchanged |
| `['jsonPath', path, command]` | Parse the value as JSON and read a value by path; the path may be empty |
| `['queryParam', param, command]` | Read the value of a URL query parameter from the value |
| `['urlDecode', command]` | URI-decode the value once (`decodeURIComponent`); returns empty on failure |
| `['base64Decode', command]` | Decode the value from base64/base64url into text |
| `['prefix', text, command]` | Prepend a fixed prefix to the value, e.g. `['prefix', 'https://', command]` |
| `['normalizeUrl', command]` | Normalize to an absolute URL |
| `['rejectEngineHost', command]` | Return empty when the value is the search engine's own host |
| `['rejectOpaqueRedirect', command]` | Drop search engine redirect links that cannot be unwrapped |
| `['or', [commands...], selector?]` | Try in order and return the first non-empty result; the third argument can limit the element read from |
| `['regexInclude' / 'regexExclude', regex, command]` | Keep the value when the regex matches / does not match |
| `['regexSubstitute', regex, replacement, command]` | Regex replacement |
| `['base64Url', attribute, selector?]` | Decode a URL from the base64 path fragment in the given attribute |

Element arguments also support `['upward', levels, elementCommand?]`, `['upward', selector, elementCommand?]`, `['selector', selector, elementCommand?]`.

### 1.2.2 Block Button:

Button relative position format:

| Type | Description |
| --- | --- |
| Object form | `{ inset: { top, right, bottom, left }, zIndex, style, mount, scope, require, requireSelf, exclude }` |
| Array form | `['inset', { top, right, bottom, left, zIndex }, mount?]`; the 3rd argument is equivalent to `mount` |

Fields of the `button` object:

| Field | Description |
| --- | --- |
| `inset` | Button offset object `{ top, right, bottom, left }`; unwritten `top`/`right` fall back to 10px/35px |
| `zIndex` | The button's `z-index` |
| `mount` | Button mount target selector or element command; when it matches, the button is mounted on that element inside the result container, otherwise on the result container itself |
| `scope` | Button visibility condition; the result container must be inside an element matching this selector |
| `require` | Button visibility condition; the result container must contain an element matching this selector |
| `requireSelf` | Used with `require`; when the result container itself matches this selector, `require` is also considered satisfied; when unset, `require` only checks inside the container |
| `exclude` | Button disabling condition; the button does not appear when the result container is inside an element matching this selector; appended after the default exclusion list (`header`, navigation, etc.) |

### 1.3 Engine Examples:

Simple form:

```javascript
example_engine: {
  includeRegex: /^https?:\/\/(?:(?:www|m)\.)?example\.com(?:[/?#]|$)/i,
  root: '.result',
  url: 'a[href]',
  title: ['.title'],
  snippet: ['.content'],
  button: false,
},
bing: { disabled: true },
```

Advanced form:

```javascript
advanced_engine: {
  includeRegex: /^https?:\/\/(?:(?:www|m)\.)?example\.com(?:[/?#]|$)/i,
  excludeRegex: /^https?:\/\/news\.example\.com(?:[/?#]|$)/i,
  priority: 10,
  site: ['example_engine', 'other_name'],
  root: '.result',
  url: ['or', [['jsonPath', 'url', ['attribute', 'data', 'a.thumb']], ['attribute', 'href', 'a[href]']]],
  title: ['text', '.title'],
  snippet: ['text', '.content'],
  button: { inset: { top: '10px', right: '35px' } },
  extraSelector: '& + .result-meta, & ~ .aside',
  command: { link: { redirects: [{ path: /^\/ck\/a/, params: ['u'], codec: 'base64url', stripPrefix: /^a[01]/i }] } },
  pages: {
    web: {},
    images: {
      includeRegex: /\/images\//,
      root: 'div.img-card',
      title: ['attribute', 'alt', 'img[alt]'],
      command: { grid: { cell: 'li', items: ['.img-card'], has: 'a[href]' } },
    },
  },
},
```

### 1.4 Other:

**Notes:**

1. Custom engine IDs support `$site = "Engine ID"` and can be used in rules such as block/highlight/whitelist; none of the selector fields support pseudo-elements such as `::after`.
2. On save, only keys that differ from the built-ins are stored; unmodified built-ins are not written to storage. Changing a value back to the built-in one, or using the `Reset` button, restores following script updates. When no selector matches, it falls back to `other` (empty) by default.
3. When adding a non-engine site with search functionality (in-site search), it is recommended to write the rule so that it applies only to that site. For example, on `m.example.com`, write the rule as `title/.*keyword.*/i @if($site = "example")`, i.e. the target site is the current non-engine site, which avoids blocking results containing the same keyword on external sites.

**Auto-analysis:**

1. Conversion script: Install `node.js`, download [auto_convert.cmd](https://raw.githubusercontent.com/Carteahere/Search-Engine-Result-Hider/main/Other/auto_convert.cmd) (Windows) or [auto_convert.sh](https://raw.githubusercontent.com/Carteahere/Search-Engine-Result-Hider/main/Other/auto_convert.sh) (Android / Linux), and run it in the same directory as the target page's `.mht` / `.mhtml` offline file. This conversion script performs basic container structure analysis and generates the corresponding `.js` selector file.
2. AI generation: If the conversion script cannot recognize the structure and you do not know how to capture the selectors, you can send the custom engine documentation and the `.mht` / `.mhtml` / `.html` offline file to AI to analyze and generate the corresponding selector structure.
3. The container naming of the mobile/desktop/regional sites of the same website may differ, so save separate offline files for analysis and fill in multiple selectors.
