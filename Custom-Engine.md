## 自定义引擎

通过脚本管理器菜单 `🖋️ 自定义引擎` 打开编辑面板（JS 格式，与内置 [Selectors.js](https://raw.githubusercontent.com/Carteahere/Search-Engine-Result-Hider/main/Other/Selectors.js) 结构一致）  
不局限于搜索引擎，理论上只要是含有容器的站点网页都能添加

**内置引擎ID：**

`google`、`google_scholar`、`bing`、`duckduckgo`、`duckduckgo_lite`、`yandex`、`brave`、`ecosia`、`startpage`、`yahoo`、`yahoo_japan`、`so360`、`sogou`、`toutiao`、`quark`、`github`、`greasyfork`

在 `@if($site = "engine")` 中，默认 `yahoo-japan`＝`yahoo_japan`，`ddg`＝`duckduckgo`＝`duckduckgo_lite`，可在 `site` 字段自定义别名

### 1.1 选择器结构：

在脚本中，引擎的选择器结构为 `engine_id: {...}` 包含的一组字段，引擎ID允许字母/数字/`_`/`-`，`other` 为保留键不可写，自定义引擎与内置引擎同ID或站点重叠时会覆盖内置选择器，优先级：自定义引擎 > 订阅引擎 > 内置引擎

### 1.1.1 基础结构：

| 字段 | 类型 | 说明 | 必填 |
| --- | --- | --- | --- |
| `matches` | string \| string[] | 整条 URL 匹配，和 `includeRegex` 至少存在一个 | ✔ |
| `excludeMatches` | string \| string[] | 整条 URL 排除，命中时屏蔽不生效并按优先级回退 | |
| `includeRegex` | regex | 整条 URL 匹配正则，和 `matches` 至少存在一个 | ✔ |
| `excludeRegex` | regex | 整条 URL 排除正则，命中时屏蔽不生效并按优先级回退 | |
| `root` | string \| array | 结果容器选择器，可写命令或 CSS 选择器，**一键屏蔽**按钮依赖容器选择器定位 | ✔ |
| `url` | command \| string \| string[] | 结果链接选择器，可写命令数组或 CSS 选择器，默认 `a[href]` | ✔ |
| `title` | command \| string \| string[] | 结果标题选择器，可写命令数组或 CSS 选择器 | |
| `snippet` | command \| string \| string[] | 结果摘要选择器，可写命令数组或 CSS 选择器 | |
| `disabled` | boolean | 引擎启用开关，`true` 停用该引擎| |
| `button` | boolean \| object \| array | 一键屏蔽按钮的显示开关或位置，`false` 在该引擎隐藏按钮，自定义相对位置见**1.2.2**  |

旧写法 `containers`、`links`、`titles`、`match` 分别映射为 `root`、`url`、`title`、`includeRegex`

`root` 可写命令：
1. `['upward', 层数, 内层选择器]`、`['upward', 选择器, 内层选择器]`，向上找最近的匹配祖先
2. `['selector', 选择器]`，用于结果容器是内层元素父级的情况

### 1.1.2 高级结构：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `name` | string | 仅用于引擎备注，在脚本中无用 |
| `priority` | number | 引擎匹配优先级，数值越大优先级越高 |
| `delay` | boolean \| number | 脚本启动延迟，填入数字，单位 `ms`， `true` 或缺少该字段时在页面加载完成后立即执行屏蔽 |
| `preserveSpace` | boolean \| number \| string \| object | 页面空白占位，避免整页结果被屏蔽后无法触发翻页，填入数字，单位 `px`，`true` 默认 `60vh`，对象写 `{ height, container }`，`container` 为占位选择器 |
| `extraSelector` | string \| string[] | CSS 相对选择器，以结果容器为起点选出关联元素，写成含顶层逗号的单字符串时每项以 `&` 开头 |
| `site` | string \| string[] | 引擎别名，可用于 `$site`，可写多个别名，逗号隔开 |
| `command` | — | 脚本的一组多功能命令，详细见下方 **command 分组** |
| `pages` | — | 搜索类型分类定义，支持对象或数组形式，对象键名即 `$category`，详细见下方**搜索类型子结构** |

**`command` 分组：**

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `link.redirects` | object[] | 去除重定向逻辑，设置的 `去除重定向` 开关决定是否启用 |
| `link.directAttrs` | string \| string[] | 在去除重定向中，优先读取哪个属性 |
| `link.directScope` | string \| string[] | 在去除重定向中，在哪个范围内找该属性 |
| `link.directProtocol` | string | 在去除重定向中，`directAttrs` 读到以 `//` 开头的值时补全的协议 |
| `skip` | string | 跳过指定结果容器 |
| `group` | object | 同组结果全部屏蔽后隐藏父级结构，支持 `container`、`members`、`hideAttr` |
| `grid` | object | 隐藏图片搜索页的空白网格槽位，支持 `anchor`、`cell`、`items`、`has`、`deepest`、`hideAttr` |
| `dedupeBy` | string | 按该 CSS 选中的元素对结果去重，避免重复出现 |
| `blockedCss` | string[] | 引擎专属样式，匹配该引擎时随脚本注入，用于引擎的屏蔽灰底/布局修正，顶层与 `pages` 分类均可声明，分类级会覆盖引擎级 |

**`link.redirects` 支持字段：**

| 字段 | 说明 | 示例 |
| --- | --- | --- |
| `path` | URL 路径匹配正则 | — |
| `params` | 依次尝试的查询参数名 | — |
| `pathValue` | 对 URL 路径匹配的捕获正则，第 1 捕获组为编码目标 | yahoo 的 `RU=` |
| `hrefSuffix` | 对整条 URL 匹配的捕获正则，第 1 捕获组为编码目标 | yahoo 的 `/*-` 尾缀 |
| `codec` | 解码器，内置 `url`、`base64url`、`pattern` | — |
| `stripPrefix` | `base64url` 解码前剥离的前缀正则 | bing 的 `/^a[01]/i` |
| `chain` | URL 解包后仍是引擎重定向链接时，按指定查询参数再解一层，`hostSelf` 省略时不限制目标域名 | `{ hostSelf: true, param: 'h5_url' }` |

**搜索类型子结构：**

类似 SERPINFO 的 `pages`，为图片/视频等特定搜索类型单独定义匹配和选择器，按声明顺序匹配整条 URL，命中即采用该分类，未命中或未声明分类时默认 `web`，`pages` 支持对象或数组形式

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| （键名） | string | 分类名，即 `$category`，允许字母/数字/`_`/`-` |
| `matches`/`excludeMatches` | string \| string[] | 整条 URL 匹配/排除，同基础结构 |
| `includeRegex`/`excludeRegex` | regex | URL 正则匹配/排除，同基础结构 |
| `commonProps` | object | `$site` / `$category` 由引擎 ID 与分类名自动派生，仅在需要覆盖时才写 |
| （结构字段） | — | 可写 `root`、`url`、`title`、`snippet`、`button`、`extraSelector`、`command` 等，未写字段继承顶层定义，`blockedCss` 会覆盖顶层规则 |

对象形式：键名即 `$category`

```javascript
pages: {
  images: { includeRegex: /\/images\//, root: 'div.img-card', title: ['attribute', 'alt', 'img[alt]'] },
  videos: { includeRegex: /\/videos\// },
}
```

数组形式：每项以 `name` 为键并派生 `$category`，可写 `commonProps.$category` 覆盖，缺 `name` 且无 `$category` 的项忽略

```javascript
pages: [
  { name: 'images', includeRegex: /\/images\//, root: 'div.img-card', title: ['attribute', 'alt', 'img[alt]'] },
  { name: 'videos', includeRegex: /\/videos\// },
]
```

### 1.2 参数说明：

### 1.2.1 取值命令：

| 命令 | 说明 |
| --- | --- |
| `['attribute', 属性名, 元素选择器?]` | 取元素属性，元素省略时为结果容器自身 |
| `['property', 属性名, 元素选择器?]` | 取元素 JS 属性，如 `href`、`textContent`、`src`，元素省略时为结果容器自身 |
| `['text', 元素选择器?]` | 取元素文本 |
| `['const', 值]` | 返回固定字符串值 |
| `['jsonParse', 值命令]` | 把值解析为 JSON，值已是对象时原样返回 |
| `['jsonPath', 路径, 值命令]` | 把值解析为 JSON，然后按路径取值，路径可为空 |
| `['queryParam', 参数名, 值命令]` | 从值中的 URL 查询参数取值 |
| `['urlDecode', 值命令]` | 对值做一次 URI 解码（`decodeURIComponent`），失败返回空 |
| `['base64Decode', 值命令]` | 把值按 base64/base64url 解码为文本 |
| `['prefix', 前缀, 值命令]` | 在值前拼接固定前缀，如 `['prefix', 'https://', 值命令]` |
| `['normalizeUrl', 值命令]` | 规范化为绝对 URL |
| `['rejectEngineHost', 值命令]` | 值是搜索引擎自身域名时返回空 |
| `['rejectOpaqueRedirect', 值命令]` | 丢弃无法解包的搜索引擎跳转链接 |
| `['or', [命令...], 元素选择器?]` | 依次尝试，返回第一个非空结果，第3参数可限定取值元素 |
| `['regexInclude' / 'regexExclude', 正则, 值命令]` | 命中/不命中正则时保留 |
| `['regexSubstitute', 正则, 替换, 值命令]` | 正则替换 |
| `['base64Url', 属性名, 元素选择器?]` | 从指定属性的 base64 路径片段解码 URL |

元素参数支持 `['upward', 层数, 元素命令?]`、`['upward', 选择器, 元素命令?]`、`['selector', 选择器, 元素命令?]`

### 1.2.2 屏蔽按钮：

按钮相对位置格式：
| 类型 | 说明 |
| --- | --- |
| 对象形式 | `{ inset: { top, right, bottom, left }, zIndex, style, mount, scope, require, requireSelf, exclude }` |
| 数组形式 | `['inset', { top, right, bottom, left, zIndex }, mount?]`，第3参数等价 `mount` |

`button` 对象字段：

| 字段 | 说明 |
| --- | --- |
| `inset` | 按钮偏移位置对象 `{ top, right, bottom, left }`，未写的 `top`/`right` 默认回退 10px/35px |
| `zIndex` | 按钮的 `z-index` |
| `mount` | 按钮挂载的目标选择器或元素命令，命中时按钮挂在结果容器内的该元素上，未命中时仍挂在结果容器 |
| `scope` | 按钮出现条件，结果容器需位于匹配该选择器的元素内 |
| `require` | 按钮出现条件，结果容器内需存在匹配该选择器的元素 |
| `requireSelf` | 搭配 `require` 使用，结果容器自身匹配该选择器时也视为满足 `require`，未写时 `require` 仅检查容器内部 |
| `exclude` | 按钮禁用条件，结果容器位于匹配该选择器的元素内时不出现按钮，追加在默认排除列表之后（`header`、导航等） |

### 1.3 引擎示例：

简单写法：

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

高级写法：

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

### 1.4 其他：

**注意：**

1. 自定义引擎ID支持 `$site = "引擎ID"` 并可用于屏蔽/高亮/白名单等规则，选择器字段均不支持伪元素，如 `::after`
2. 保存时仅存储与内置有差异的键，未改动的内置不会写入存储，改回内置值或 `重置` 按钮可恢复跟随脚本更新，选择器未匹配到时默认退回 `other` 置空
3. 添加带搜索功能的非引擎站点（即站内搜索）时，规则建议写为仅在该站点使用，例如在 `m.example.com` 上，规则写为 `title/.*关键词.*/i @if($site = "example")` 等，即目标站点为当前的非引擎站点，避免含相同关键词的结果在外站也被屏蔽

**自动分析：**

1. 转换脚本：安装 node.js ，下载 [auto_convert.cmd](https://raw.githubusercontent.com/Carteahere/Search-Engine-Result-Hider/main/Other/auto_convert.cmd)（Windows）或 [auto_convert.sh](https://raw.githubusercontent.com/Carteahere/Search-Engine-Result-Hider/main/Other/auto_convert.sh) （Android / Linux），和目标网页离线文件 `.mht` / `.mhtml` 在同一目录下运行，该转换脚本能进行基础的容器结构分析并生成对应 `.js` 选择器文件
2. AI生成：如果转换脚本无法识别也不知道怎么抓取选择器，可以把自定义引擎文档和 `.mht` / `.mhtml` / `.html` 离线文件发给AI分析并生成对应选择器结构
3. 同一网站的移动端/桌面端/地区站点的容器命名可能不同，需要分别保存离线文件分析并填写多个选择器