## 规则说明

### 2.1 一键屏蔽：

悬浮球：打开面板模式，点击**未被屏蔽结果**的屏蔽按钮时

| 类型 | 屏蔽域名 开 | 屏蔽域名 关 |
| --- | --- | --- |
| 二次确认 开 | 弹窗可选精确/域名/白名单，默认屏蔽域名 | 弹窗可选精确/域名/白名单，默认精确屏蔽 |
| 二次确认 关 | 直接屏蔽 `*://*.example.com/*` | 直接屏蔽 `*://m.example.com/*` |

悬浮球：切换显示/隐藏结果模式，点击**被屏蔽结果**的屏蔽按钮时

| 类型 | 本地规则 | 订阅规则 |
| --- | --- | --- |
| 二次确认 开 | 弹窗可选删除规则/添加白名单 | 弹窗提示添加白名单 |
| 二次确认 关 | 直接删除对应本地规则 | 弹窗提示添加白名单 |

### 2.2 URL匹配：

| 规则 | 说明 |
| --- | --- |
| `*://abc.example.com/*` | 匹配 `abc.example.com` |
| `*://*.example.com/*` | 匹配 `example.com`及其子域名 |
| `*://*.example.com/path/*` | 匹配 `example.com` 的特定路径 |
| `*://*.example.com:8080/*` | 匹配 `example.com` 的 `8080` 端口 |
| `*://*.example.*` | 匹配 `example.com` 的所有顶级/二级域名 |
| `example.com` | 等效 `*://*.example.com/*` 的简单写法，大多数情况下建议加 `*://*.` 前缀 |
| `*://*.例子.com` | 等效 `*://*.xn--fsqu00a.com`，中文等 IDN 域名与 punycode 视为同一主机 |

URL通配规则按匹配模式语义从URL开头匹配，主机通配`*`不跨越路径

### 2.3 正则匹配：

| 规则 | 说明 |
| --- | --- |
| `/pattern/flags` | 正则表匹配URL，如 `/example\.(com\|net)/i` |
| flags: `i`、`m`、`s`、`u` | 支持，其中 `s` 使用原生 dotAll 匹配（点号匹配换行） |
| flags: `g`、`y` | 不支持，脚本规则只判断是否匹配不执行全局提取 |

正则使用浏览器支持的 JavaScript `RegExp`

### 2.4 标题匹配：

| 规则 | 说明 |
| --- | --- |
| `title/.*示例.*/` | 匹配标题包含`示例`的结果 |
| `title/^示例.*/` | 匹配标题以`示例`开头的结果 |
| `title/.*示例(A\|B).*/` | 匹配标题包含`示例A`或`示例B`的结果 |
| `title/^(?=.*示例A)(?=.*(?:示例B)).*/i` | 忽略大小写和前后顺序，匹配同时出现`示例A`和`示例B`的结果 |
| `title/^(?=.*示例A)(?=.*(?:示例B\|示例C)).*/i` | 忽略大小写和前后顺序，匹配同时出现`示例A和示例B`或`示例A和示例C`的结果 |

### 2.5 摘要匹配：

| 规则 | 说明 |
| --- | --- |
| `text/.*example.*/` | 匹配结果的网页描述内容(snippet)中包含 `example` 的结果 |
| `text/.*example.*/i` | 同上，加 `i` 忽略大小写 |

### 2.6 白名单匹配：

| 规则 | 说明 |
| --- | --- |
| `@*://*.com/*` | 放行所有以 `.com` 结尾域名页面 |
| `@*://example.com/*` | 放行 `example.com` 主站 |
| `@*://example.com/abc/*` | 放行 `example.com` 特定路径 |
| `@*://*.example.com/*` | 放行 `example.com` 及其所有子域名 |

不支持 `@@` 写法

### 2.7 高亮规则：

| 规则 | 说明 |
| --- | --- |
| `@N*://*.example.com/*` | 给 `example.com` 及其子域名的搜索结果加上颜色边框 |
| `@Ntitle/.*示例.*/` | 给标题带有`示例`的结果加上颜色边框 |
| `@1path $= ".pdf"` | 给链接以 `.pdf` 结尾的结果加上颜色边框 |

**说明：**
1. `@N`和裸域名规则之间必须空格隔开，其他规则可忽略空格，如`@1 example.com`正常识别，`@1example.com`识别为白名单规则
2. 通过脚本菜单选项打开自定义颜色面板，只支持5种颜色，即 `@N` 为 `@1`～`@5`，`N` > 5 时效果回退为 `@1`，多个高亮规则命中时只显示 `N` 最大的效果
3. 支持条件表达式，如`@N+host/path/url/text/scheme`
4. 与uBlacklist的高亮自带白名单效果不同，高亮规则仅作为附加显示，即规则同时被高亮和黑名单命中时也会被屏蔽，开启 `高亮白名单` 开关后高亮规则才会附带白名单效

### 2.8 复合规则：

**`@if` 说明：**
1. 在规则后添加 `@if(...)` 作为附加条件，可同时使用多个 `@if` 条件（可用 `&` 合并为单个 `@if` ），复合规则默认忽略大小写
2. 条件表达式可单独使用，如 `host $= ".example.com"`、`path *= "/download/"`，对所有搜索结果生效
3. 属性值支持省略引号，如 `@if($site=google)`、`@if(scheme=https)`
4. `$site` 引擎ID同 **2.9 自定义引擎**

**`@if` 支持条件：**

| 条件类型 | 语法 | 说明 |
| --- | --- | --- |
| 搜索引擎 | `$site = "google"` | 仅在指定搜索引擎中生效，忽略大小写，分隔符可用 `=` 或 `:` |
| 搜索类型 | `$category = "web"` | 仅在搜索引擎的指定搜索类型中生效，内置 `web`、`images`、`videos`、`news`，网页默认 `web` |
| 搜索站点 | `site = "google.com.hk"` | 仅在指定搜索引擎地区站点中生效 |
| 标题包含 | `title *= "关键词"` | 标题中包含指定字符串`关键词` |
| 标题精确 | `title = "关键词"` | 标题精确匹配指定字符串`关键词` |
| 标题前缀 | `title ^= "关键词"` | 标题以指定字符串`关键词`开头 |
| 标题后缀 | `title $= "关键词"` | 标题以指定字符串`关键词`结尾 |
| 标题正则 | `title =~ /正则/`(或简写 `title/正则/`) | 标题匹配正则表达式，字符集 `[...]` 内支持裸斜杠，结尾加 `i` 忽略大小写 |
| 正文包含 | `text *= "关键词"` | 结果正文/摘要中包含指定字符串`关键词` |
| 正文精确 | `text = "关键词"` | 结果正文/摘要精确匹配指定字符串`关键词` |
| 正文前缀 | `text ^= "关键词"` | 结果正文/摘要以指定字符串`关键词`开头 |
| 正文后缀 | `text $= "关键词"` | 结果正文/摘要以指定字符串`关键词`结尾 |
| 正文正则 | `text =~ /正则/`(或简写 `text/正则/`) | 结果正文/摘要匹配正则表达式，字符集 `[...]` 内支持裸斜杠，结尾加 `i` 忽略大小写 |
| URL精确 | `url = "https://example.com/"` | URL与指定字符串完全一致 |
| URL前缀 | `url ^= "https://abc.example.com"` | URL以指定字符串开头 |
| URL后缀 | `url $= ".pdf"` | URL以指定字符串结尾 |
| URL包含 | `url *= "example"` | URL中包含指定字符串 `example` |
| URL正则 | `url =~ /正则/`(或简写 `url/正则/`) | URL匹配正则表达式，`=~` 可省略，字符集`[...]`内支持裸斜杠，结尾加`i`忽略大小写 |
| URL主机 | `host $= ".example.com"` | 匹配结果URL主机，`$=` 兼容裸域，即 `host $= ".example.com"` 同时命中 `example.com` 与 `m.example.com` |
| URL路径 | `path *= "/download/"` | 匹配结果URL路径 (`u.pathname` + `u.search`) |
| URL协议 | `scheme = "https"` | 匹配结果URL协议，如 `https` / `http` |
| 逻辑运算 | `\|` 或、`&` 与、`!` 非 | 组合任意条件，`!` 取反的是条件本身，如 `!(title *= "关键词")` 会命中无标题的结果 |
| 括号分组 | `(` `)` | 嵌套组合子条件 |

**条件逻辑：**
1. `title` 别名 `t`、`url` 别名 `u`，如 `@if( t *="关键词")` 等效 `@if( title *="关键词")`
2. `title`/`text`/`url`/`host`/`path`/`scheme` 均支持 `=`、`^=`、`$=`、`*=`、`=~` 及省略 `=~` 的简写（如 `host/正则/`），`=~` 大小写由正则 flags 决定，比较默认忽略大小写
3. 兼容 uBlacklist 大小写修饰符 `i`（如 `title $= "Domain" i`），此写法仅用于识别和兼容规则，脚本默认忽略大小写

**复合规则示例：**

| 规则 | 说明 |
| --- | --- |
| `*://*.example.com/* @if(title *= "关键词")` | 屏蔽 `example.com` 的标题中含有`关键词`的结果 |
| `*://*.example.com/* @if(title *= "关键词A" \| title *= "关键词B")` | 屏蔽 `example.com` 的标题中含`关键词A`或`关键词B`的结果 |
| `*://*.example.com/* @if(title =~ /关键词A\|关键词B/i)` | 上条规则的正则写法，结尾需加 `i` 才会忽略大小写 |
| `*://*.example.com/* @if(text *= "关键词")` | 屏蔽 `example.com` 的正文/摘要中含`关键词`的结果 |
| `*://*.example.com/* @if(title *= "关键词" & !(url *= "test"))` | 屏蔽 `example.com` 的标题含`关键词`且URL中不含 `test` 的结果 |
| `*://*.example.com/* @if(site = "google.com.hk")` | 仅在 Google HK 中屏蔽 `example.com` |
| `*://*.example.com/* @if($site = "google") @if(title *= "示例")` | 仅在 Google 中屏蔽标题含`示例`的 `example.com` 的结果 |
| `*://*.example.com/* @if(title *= "a" \| title *= "b") @if(!(url *= "c"))` | 屏蔽标题含 `a` 或 `b` 且 URL 不含 `c` 的 `example.com` 的结果 |
| `text/.*示例.*/ @if($site = "google" \| $site = "bing")` | 在 Google 或 Bing 中都屏蔽网页描述含`示例`的结果 |
| `path *= "/download/"` | 屏蔽路径含 `/download/` 的结果 |
| `host $= ".example.com" & path *= "/download/"` | 屏蔽 `example.com` 的路径含 `/download/ `的结果 |
| `@1 path $= ".pdf"` | 高亮 URL 路径以 `.pdf` 结尾的结果 |

### 2.9 自定义引擎：

通过脚本管理器菜单 `🖋️ 自定义引擎` 打开编辑面板（JS 格式，与内置 [Selectors.js](https://raw.githubusercontent.com/Carteahere/Search-Engine-Result-Hider/main/Other/Selectors.js) 结构一致）  
不局限于搜索引擎，理论上只要是含有容器的网页站点都能添加

**内置引擎ID：**

`google`、`google_scholar`、`bing`、`duckduckgo`、`duckduckgo_lite`、`yandex`、`brave`、`ecosia`、`startpage`、`yahoo`、`yahoo_japan`、`so360`、`sogou`、`toutiao`、`quark`、`github`、`greasyfork`  
在 `@if($site = "engine")` 中，`yahoo-japan`＝`yahoo_japan`，`ddg`＝`duckduckgo`＝`duckduckgo_lite`

**引擎选择器结构：**

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `match` | regex | 必填，hostname 匹配正则字面量 |
| `containers` | string | 必填，结果容器的 CSS 选择器，**一键屏蔽**按钮依赖容器选择器定位 |
| `links` | string \| string\[\] | 可选，链接选择器，默认 `a[href]` |
| `titles` | string \| string\[\] | 可选，标题选择器列表 |
| `snippets` | string \| string\[\] | 可选，摘要选择器列表 |
| `button` | boolean | 可选，`button: false` 不在该引擎显示**一键屏蔽**按钮（不影响一键屏蔽开关），`button: true` 或缺少该参数时默认允许显示按钮 |
| `disabled` | boolean | 可选，别名 `disable`，`disabled: true` 停用该引擎，`disabled: false` 或缺少该参数时恢复内置 |
| `extraElements` | string\[\] | 可选，CSS 相对选择器数组，以结果容器为起点选出关联元素 |
| `categories` | object | 可选，搜索类型分类定义，见下方说明 |

**搜索类型分类：**

类似 uBlacklist 分类匹配子结构，为图片/视频/新闻等搜索引擎的特定搜索类型单独定义选择器和 `match` 匹配 URL ，按声明顺序将每个分类 `match` 正则对整条 URL 尝试匹配，命中即采用该分类，未命中或未声明分类时默认 `web`（顶层选择器）。分类名称允许字母/数字/`_`/`-`，默认内置 `web`、`images`、`videos`、`news`。  
分类内可写 `match`（必填）、`containers`、`links`、`titles`、`snippets`、`button`、`extraElements`，未写字段继承顶层定义。

| 规则 | 说明 |
| --- | --- |
| `categories.images.match: /tbm=isch\|udm=2/` | URL 命中时按图片搜索处理 |
| `categories.videos.containers: 'div.card'` | 视频搜索页使用独立的容器选择器 |

**进阶 links / titles 提取语法：**

链接/标题不直接落在 `href` /元素上时（如图片结果真实地址存在 JSON 属性），可在选择器后追加 `@` 提取指令：

| 语法 | 说明 | 示例
| --- | --- | --- |
| `sel@attr:name` | 取元素 `name` 属性值，`sel@attr` 等效普通链接取 `href` | Bing 视频 `[ourl]@attr:ourl` |
| `sel@json:attr.路径.路径` | 解析元素 `attr` 属性的 JSON 后按路径取值 | Bing 图片 `a.iusc@json:m.purl` |
| `sel@query:attr.参数名` | 从元素 `attr` 属性（通常 `href`）的 URL 查询参数中取值 | Google 图片 `a[href*="/imgres"]@query:href.imgurl` |
| `sel@b64url` | 从元素 `src` 的 base64 片段解码出 URL | Brave 图片 `img[src*="imgs.search.brave.com"]@b64url` |
| `sel@attr:name`（titles 中） | 取元素属性文本作为标题，`sel@json:` 同上 | `img@attr:alt` |

**示例：**

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

**说明：**

1. 自定义引擎支持 `$site = "引擎ID"` 条件以及屏蔽/高亮/白名单规则，选择器字段均不支持伪元素，如 `::after`
2. 引擎ID允许字母/数字/`_`/`-`，`other` 为保留键不可写，自定义引擎与内置引擎同ID或站点重叠时会覆盖内置选择器，优先级：自定义引擎 > 订阅引擎 > 内置引擎
3. 保存时仅存储与内置有差异的键，未改动的内置不会写入存储，改回内置值或重置可恢复跟随脚本更新，选择器未匹配到时默认退回`other`（置空）
4. 添加带搜索功能的非引擎站点（即站内搜索）时，规则建议写为仅在该站点使用，例如在 `m.example.com` 上，规则写为 `title/.*关键词.*/i @if($site = "example")` 等，即目标站点为当前的非引擎站点，避免含相同关键词的结果在外站也被屏蔽

**自动分析：**

1. 转换脚本：下载 [auto_convert_mht.cmd](https://raw.githubusercontent.com/Carteahere/Search-Engine-Result-Hider/main/Other/auto_convert_mht.cmd) 并放在目标网页 `.mht` 离线文件同一目录下运行，该转换脚本能进行基础的容器结构分析并生成对应 `.js` 选择器文件
2. AI生成：如果转换脚本无法识别也不知道怎么抓取选择器，建议把自定义引擎说明和 `.mht` / `.html` 离线文件发给AI分析结构并生成对应选择器
3. 同一网站的移动端/桌面端/地区站点的容器命名可能不同，需要分别保存离线文件分析并填写多个选择器