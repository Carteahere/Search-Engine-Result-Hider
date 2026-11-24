## Custom Engine

Open the edit panel through the script manager menu `🖋️ Custom Engine`, `js`/`json` format, with the same structure as the built-in engine [Selectors.js](https://raw.githubusercontent.com/Carteahere/Search-Engine-Result-Hider/main/Other/Selectors.js).  
Not limited to search engines, in theory, any site page that contains containers can be added.

**Built-in engine IDs:**

`google`, `google_scholar`, `bing`, `duckduckgo`, `duckduckgo_lite`, `yandex`, `brave`, `ecosia`, `startpage`, `yahoo`, `yahoo_japan`, `so360`, `sogou`, `toutiao`, `quark`, `github`, `greasyfork`

In `@if($site = "engine")`, by default `yahoo-japan` = `yahoo_japan`, `ddg` = `duckduckgo` = `duckduckgo_lite`, and custom aliases can be defined in the `site` field.

### 1.1 Selector Structure:

In the script, an engine's selector structure is a group of fields contained in `engine_id: {...}`, engine IDs allow letters/numbers/`_`/`-`, `other` is a reserved key that cannot be written, when a custom engine and a built-in engine have the same ID or their sites overlap, the built-in selector is overridden, priority: custom engines > subscription engines > built-in engines.

### 1.1.1 Basic Structure:

| Field | Type | Description | Required |
| --- | --- | --- | --- |
| `matches` | string \| string[] | Whole-URL matching, at least one of this and `includeRegex` must exist | ✔ |
| `excludeMatches` | string \| string[] | Whole-URL exclusion, when it hits, blocking does not take effect and matching falls back by priority | |
| `includeRegex` | regex | Whole-URL matching regex, at least one of this and `matches` must exist | ✔ |
| `excludeRegex` | regex | Whole-URL exclusion regex, when it hits, blocking does not take effect and matching falls back by priority | |
| `root` | string \| array | Result container selector, can be a command or CSS selector, the **One-click Block** button relies on the container selector for positioning | ✔ |
| `url` | command \| string \| string[] | Result link selector, can be a command array or CSS selector, default `a[href]` | ✔ |
| `title` | command \| string \| string[] | Result title selector, can be a command array or CSS selector | |
| `snippet` | command \| string \| string[] | Result snippet selector, can be a command array or CSS selector | |
| `disabled` | boolean | Engine enable switch, `true` disables the engine | |
| `button` | boolean \| object \| array | Display switch or position of the **One-click Block** button, `false` hides the button on that engine, for custom relative positions see **1.2.2** | |

The legacy forms `containers`, `links`, `titles`, and `match` map to `root`, `url`, `title`, and `includeRegex` respectively.

Commands that can be written for `root`:

1. `['upward', levels, innerSelector]`, `['upward', selector, innerSelector]`, walk up to the nearest matching ancestor.
2. `['selector', selector]`, for cases where the result container is the parent of the inner element.

### 1.1.2 Advanced Structure:

| Field | Type | Description |
| --- | --- | --- |
| `name` | string | Only used for engine remarks, useless in the script |
| `priority` | number | Engine matching priority, the larger the value, the higher the priority |
| `delay` | boolean \| number | Script startup delay, when filled with a number, the unit is `ms`, `true` or a missing field executes blocking immediately after the page finishes loading |
| `preserveSpace` | boolean \| number \| string \| object | Page blank space placeholder, to avoid being unable to trigger pagination after all results on the page are blocked, when filled with a number, the unit is `px`, `true` defaults to `60vh`, object form `{ height, container }`, `container` is the placeholder selector |
| `extraSelector` | string \| string[] | CSS relative selector, starting from the result container to select associated elements, when written as a single string containing a top-level comma, each item starts with `&` |
| `site` | string \| string[] | Engine aliases, can be used for `$site`, multiple aliases can be written, separated by commas |
| `command` | — | A group of multi-function commands of the script, see the **`command` group** below for details |
| `pages` | — | Search type category definitions, supports object or array form, the object key name is the `$category`, see the **Search type substructure** below for details |

**`command` group:**

| Field | Type | Description |
| --- | --- | --- |
| `link.redirects` | object[] | Redirect removal logic, whether it is enabled is decided by the `Remove redirects` switch in settings |
| `link.directAttrs` | string \| string[] | During redirect removal, which attribute to read first |
| `link.directScope` | string \| string[] | During redirect removal, within which scope to find that attribute |
| `link.directProtocol` | string | During redirect removal, the protocol filled in when `directAttrs` reads a value starting with `//` |
| `skip` | string | Skip the specified result containers |
| `group` | object | Hide the parent structure after all results in the same group are blocked, supports `container`, `members`, `hideAttr` |
| `grid` | object | Hide blank grid slots on the image search page, supports `anchor`, `cell`, `items`, `has`, `deepest`, `hideAttr` |
| `dedupeBy` | string | Deduplicate results by the elements selected by this CSS selector, to avoid duplicates |
| `blockedCss` | string[] | Engine-specific styles, injected with the script when that engine matches, used for the engine's blocked gray background/layout fixes, can be declared at both the top level and in `pages` categories, the category level overrides the engine level |

**Fields supported by `link.redirects`:**

| Field | Description | Example |
| --- | --- | --- |
| `path` | URL path matching regex | — |
| `params` | Query parameter names tried in order | — |
| `pathValue` | Capture regex for URL path matching, the 1st capture group is the encoded target | yahoo's `RU=` |
| `hrefSuffix` | Capture regex for whole-URL matching, the 1st capture group is the encoded target | yahoo's `/*-` suffix |
| `codec` | Decoder, built-in `url`, `base64url`, `pattern` | — |
| `stripPrefix` | Prefix regex stripped before `base64url` decoding | bing's `/^a[01]/i` |
| `chain` | When the URL is still an engine redirect link after unwrapping, unwrap one more level by the specified query parameter, when `hostSelf` is omitted, the target domain is not restricted | `{ hostSelf: true, param: 'h5_url' }` |

**Search type substructure:**

Similar to SERPINFO's `pages`, it defines matching and selectors separately for specific search types such as images/videos, matches the whole URL in declaration order, adopts that category when it hits, defaults to `web` when nothing hits or no category is declared, `pages` supports object or array form.

| Field | Type | Description |
| --- | --- | --- |
| (key name) | string | Category name, i.e. the `$category`, letters/numbers/`_`/`-` are allowed |
| `matches`/`excludeMatches` | string \| string[] | Whole-URL matching/exclusion, same as the basic structure |
| `includeRegex`/`excludeRegex` | regex | URL regex matching/exclusion, same as the basic structure |
| `commonProps` | object | `$site` / `$category` are automatically derived from the engine ID and category name, only written when an override is needed |
| (structure fields) | — | Can write `root`, `url`, `title`, `snippet`, `button`, `extraSelector`, `command`, etc., unwritten fields inherit the top-level definitions, `blockedCss` overrides the top-level rule |

Object form: the key name is the `$category`.

```javascript
pages: {
  images: { includeRegex: /\/images\//, root: 'div.img-card', title: ['attribute', 'alt', 'img[alt]'] },
  videos: { includeRegex: /\/videos\// },
}
```

Array form: each item uses `name` as the key and derives `$category`, can write `commonProps.$category` to override, items lacking `name` and without `$category` are ignored.

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
| `['attribute', attributeName, elementSelector?]` | Get the element attribute, when the element is omitted, it is the result container itself |
| `['property', attributeName, elementSelector?]` | Get the element JS property, such as `href`, `textContent`, `src`, when the element is omitted, it is the result container itself |
| `['text', elementSelector?]` | Get the element text |
| `['const', value]` | Return a fixed string value |
| `['jsonParse', valueCommand]` | Parse the value as JSON, return it as is when the value is already an object |
| `['jsonPath', path, valueCommand]` | Parse the value as JSON, then get the value by path, the path can be empty |
| `['queryParam', param, valueCommand]` | Get the value from the URL query parameter in the value |
| `['urlDecode', valueCommand]` | URI-decode the value once (`decodeURIComponent`), return empty on failure |
| `['base64Decode', valueCommand]` | Decode the value as base64/base64url into text |
| `['prefix', prefix, valueCommand]` | Concatenate a fixed prefix before the value, e.g. `['prefix', 'https://', valueCommand]` |
| `['normalizeUrl', valueCommand]` | Normalize to an absolute URL |
| `['rejectEngineHost', valueCommand]` | Return empty when the value is the search engine's own domain |
| `['rejectOpaqueRedirect', valueCommand]` | Discard search engine redirect links that cannot be unwrapped |
| `['or', [commands...], elementSelector?]` | Try in order, return the first non-empty result, the 3rd parameter can limit the value element |
| `['regexInclude' / 'regexExclude', regex, valueCommand]` | Keep when the regex matches/does not match |
| `['regexSubstitute', regex, replacement, valueCommand]` | Regex replacement |
| `['base64Url', attributeName, elementSelector?]` | Decode the URL from the base64 path fragment of the specified attribute |

Element parameters support `['upward', levels, elementCommand?]`, `['upward', selector, elementCommand?]`, `['selector', selector, elementCommand?]`.

### 1.2.2 Block Button:

Button relative position format:

| Type | Description |
| --- | --- |
| Object form | `{ inset: { top, right, bottom, left }, zIndex, style, mount, scope, require, requireSelf, exclude }` |
| Array form | `['inset', { top, right, bottom, left, zIndex }, mount?]`, the 3rd parameter is equivalent to `mount` |

Fields of the `button` object:

| Field | Description |
| --- | --- |
| `inset` | Button offset position object `{ top, right, bottom, left }`, unwritten `top`/`right` fall back to 10px/35px by default |
| `zIndex` | The button's `z-index` |
| `mount` | Button mount target selector or element command, when it hits, the button mounts on that element inside the result container, when it does not hit, it still mounts on the result container |
| `scope` | Button appearance condition, the result container must be inside an element matching this selector |
| `require` | Button appearance condition, an element matching this selector must exist inside the result container |
| `requireSelf` | Used with `require`, when the result container itself matches this selector, it is also considered to satisfy `require`, when not written, `require` only checks inside the container |
| `exclude` | Button disable condition, when the result container is inside an element matching this selector, the button does not appear, appended after the default exclusion list (`header`, navigation, etc.) |

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

1. Custom engine IDs support `$site = "Engine ID"` and can be used in rules such as blocking/highlighting/whitelisting, none of the selector fields support pseudo-elements, such as `::after`.
2. On save, only keys that differ from the built-ins are stored, unmodified built-ins are not written to storage, changing back to the built-in value or the `Reset` button restores following script updates, when no selector matches, it falls back to an empty `other` by default.
3. When adding a non-engine site with search functionality (i.e. in-site search), it is recommended to write the rule to be used only on that site, for example on `m.example.com`, write the rule as `title/.*keyword.*/i @if($site = "example")` etc., i.e. the target site is the current non-engine site, to avoid results containing the same keyword also being blocked on external sites.

**Auto-analysis:**

1. Conversion script: install `node.js`, download [auto_convert.cmd](https://raw.githubusercontent.com/Carteahere/Search-Engine-Result-Hider/main/Other/auto_convert.cmd) (Windows) or [auto_convert.sh](https://raw.githubusercontent.com/Carteahere/Search-Engine-Result-Hider/main/Other/auto_convert.sh) (Android / Linux), run it in the same directory as the target page's `.mht` / `.mhtml` offline file, this conversion script can perform basic container structure analysis and generate the corresponding `.js` selector file.
2. AI generation: if the conversion script cannot recognize it and you also do not know how to capture selectors, you can send the custom engine documentation and the `.mht` / `.mhtml` / `.html` offline file to AI to analyze and generate the corresponding selector structure.
3. The container naming of mobile/desktop/regional sites of the same website may differ, you need to save offline files separately for analysis and fill in multiple selectors.
