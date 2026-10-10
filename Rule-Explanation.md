## 规则说明

### 2.1 一键屏蔽：

悬浮球：打开面板模式，点击**未被屏蔽结果**的屏蔽按钮时

| 类型 | 屏蔽域名 开 | 屏蔽域名 关 |
| --- | --- | --- |
| 二次确认 开 | 弹窗可选精确/域名/白名单，默认屏蔽域名 | 弹窗可选精确/域名/白名单，默认精确屏蔽 |
| 二次确认 关 | 直接屏蔽 `*://*.example.com/*` | 直接屏蔽 `*://abc.example.com/*` |

悬浮球：切换显示/隐藏结果模式，点击**被屏蔽结果**的屏蔽按钮时

| 类型 | 本地规则 | 订阅规则 |
| --- | --- | --- |
| 二次确认 开 | 弹窗可选删除规则/添加白名单 | 弹窗提示添加白名单 |
| 二次确认 关 | 直接删除对应本地规则 | 弹窗提示添加白名单 |

### 2.2 URL匹配：

| 规则 | 说明 |
| --- | --- |
| `*://abc.example.com/*` | 匹配`abc.example.com` |
| `*://*.example.com/*` | 匹配`example.com`及其子域名 |
| `*://*.example.com/path/*` | 匹配`example.com`特定路径 |
| `*://*.example.*` | 匹配`example.com`所有顶级/二级域名 |
| `example.com` | 等效`*://*.example.com/*`的简单写法，大多数情况下建议加`*://*.`前缀 |

URL通配规则按匹配模式语义从URL开头匹配，主机通配`*`不跨越路径，`*.`前缀同时匹配裸域；中文等 IDN 域名与 punycode（如`例子.com`与`xn--fsqu00a.com`）视为同一主机

### 2.3 正则匹配：

| 规则 | 说明 |
| --- | --- |
| `/pattern/flags` | 使用正则表达式匹配URL，如`/example\.(com\|net)/i` |
| `title/pattern/flags` | 使用正则表达式匹配标题，如`title/.*屏蔽.*/i` |
| `text/pattern/flags` | 使用正则表达式匹配摘要内容，如`text/.*广告.*/i` |

正则使用浏览器支持的 JavaScript `RegExp` flags，支持`i`、`m`、`s`、`u`，其中 `s` 使用原生 dotAll 匹配(点号匹配换行)；不支持`g`/`y`，脚本规则只判断是否匹配不执行全局提取，flags ≤ 2字符时自动检测`g`/`y`并报错

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
| `text/.*example.*/` | 匹配结果的网页描述内容(snippet)中包含`example`的结果 |
| `text/.*example.*/i` | 同上，加i忽略大小写 |

### 2.6 白名单匹配：

| 规则 | 说明 |
| --- | --- |
| `@*://*.com/*` | 放行所有以`.com`结尾域名页面 |
| `@*://example.com/*` | 放行`example.com`主站 |
| `@*://example.com/abc/*` | 放行`example.com`特定路径 |
| `@*://*.example.com/*` | 放行`example.com`及其所有子域名 |

### 2.7 高亮规则：

| 规则 | 说明 |
| --- | --- |
| `@N*://*.example.com/*` | 给`example.com`及其子域名的搜索结果加上颜色边框 |
| `@Ntitle/.*示例.*/` | 给匹配到标题带有`示例`的结果加上颜色边框 |
| `@1path $= ".pdf"` | 给链接以`.pdf`结尾的结果加上颜色边框 |

说明：
1. `@N`和裸域名规则之间必须空格隔开，其他规则可忽略空格，如`@1 example.com`正常识别，`@1example.com`识别为白名单规则
2. 只支持5种颜色，即`@N`为`@1`～`@5`，通过脚本菜单打开自定义颜色面板
3. 支持条件表达式，如`@N+host/path/url/scheme`
4. 高亮规则仅作为附加显示，即规则同时被高亮和黑名单命中时也会被屏蔽

### 2.8 复合规则：

**说明：**
1. 在规则后添加 `@if(...)` 作为附加条件，规则和 `@if` 之间空格隔开，多个 `@if` 条件同时生效（可用 `&` 合并为单个 `@if` ），复合规则默认忽略大小写
2. `@if` 内支持逻辑运算：`|` 或、`&` 与、`!` 非，用括号嵌套分组，优先级 `!` > `&` > `|`
3. `!` 取反的是条件本身，如 `!(title *= "关键词")` 会命中无标题的结果
4. 条件表达式可**单独使用**，如 `host $= ".example.com"`、`path *= "/download/"`，对所有搜索结果生效
5. 属性值支持省略引号，如 `@if($site=google)`、`@if(scheme=https)` 等无空格值可直接裸写 
6. `$site`搜索引擎ID同 **2.9 自定义引擎**

**`@if` 支持条件：**

| 条件类型 | 语法 | 说明 |
| --- | --- | --- |
| 搜索引擎 | `$site = "google"` | 仅在指定搜索引擎中生效，忽略大小写，分隔符可用`=`或`:`，值支持省略引号（如`$site=google`） |
| 搜索类型 | `$category = "web"` | 仅在指定搜索类型中生效，可写`web`、`images`、`videos`、`news`，网页搜索默认为`web`，值支持省略引号（如`$category=images`） |
| 搜索站点 | `site = "google.com.hk"` | 仅在指定搜索引擎地区站点中生效，值支持省略引号（如`site=google.com.hk`） |
| 标题包含 | `title *= "关键词"` | 标题中包含指定字符串`关键词` |
| 标题精确 | `title = "关键词"` | 标题精确匹配指定字符串`关键词` |
| 标题前缀 | `title ^= "关键词"` | 标题以指定字符串`关键词`开头 |
| 标题后缀 | `title $= "关键词"` | 标题以指定字符串`关键词`结尾 |
| 标题正则 | `title =~ /正则/`(或简写 `title/正则/`) | 标题匹配正则表达式，`=~` 可省略，字符集`[...]`内支持裸斜杠，结尾加`i`忽略大小写 |
| URL精确 | `url = "https://example.com/"` | URL与指定字符串完全一致 |
| URL前缀 | `url ^= "https://abc.example.com"` | URL以指定字符串开头 |
| URL后缀 | `url $= ".pdf"` | URL以指定字符串结尾 |
| URL包含 | `url *= "example"` | URL中包含指定字符串`example` |
| URL正则 | `url =~ /正则/`(或简写 `url/正则/`) | URL匹配正则表达式，`=~` 可省略，字符集`[...]`内支持裸斜杠，结尾加`i`忽略大小写 |
| URL主机 | `host $= ".example.com"` | 结果URL的主机名(hostname)匹配；`$=`兼容裸域，即`host $= ".example.com"`同时命中`example.com`与`www.example.com` |
| URL路径 | `path *= "/download/"` | 结果URL的路径+查询串(pathname+search)匹配 |
| URL协议 | `scheme = "https"` | 结果URL的协议匹配，如`https`/`http`，值支持省略引号（如`scheme=https`） |
| 逻辑运算 | `\|` 或、`&` 与、`!` 非 | 组合任意条件 |
| 括号分组 | `( )` | 嵌套组合子条件 |

`title`/`url`/`host`/`path`/`scheme` 均支持 `=`、`^=`、`$=`、`*=`、`=~`(及省略`=~`的简写如 `host/正则/`)，比较默认忽略大小写，`=~` 大小写由正则 flags 决定。兼容 uBlacklist 规则中的大小写修饰符 `i`(如 `title $= "Domain" i`)，此写法仅用于识别和兼容规则，脚本默认忽略大小写

**复合规则示例：**

| 规则 | 说明 |
| --- | --- |
| `*://*.example.com/* @if(title *= "关键词")` | 屏蔽`example.com`的标题中含有`关键词`的结果 |
| `*://*.example.com/* @if(title *= "关键词A" \| title *= "关键词B")` | 屏蔽`example.com`的标题中含`关键词A`或`关键词B`的结果 |
| `*://*.example.com/* @if(title =~ /关键词A\|关键词B/i)` | 上条规则的正则写法，结尾需加`i`才会忽略大小写 |
| `*://*.example.com/* @if(title *= "关键词" & !(url *= "test"))` | 屏蔽`example.com`的标题含`关键词`且URL中不含`test`的结果 |
| `*://*.example.com/* @if(site = "google.com.hk")` | 仅在Google HK中屏蔽`example.com` |
| `*://*.example.com/* @if($site = "google") @if(title *= "示例")` | 仅在Google中屏蔽标题含`示例`的`example.com`的结果 |
| `*://*.example.com/* @if($category = "images")` | 仅在图片搜索中屏蔽`example.com` |
| `*://*.example.com/* @if(title *= "a" \| title *= "b") @if(!(url *= "c"))` | 屏蔽标题含`a`或`b`且URL不含`c`的`example.com`的结果 |
| `text/.*示例.*/ @if($site = "google" \| $site = "bing")` | 在Google或Bing中都屏蔽网页描述含`示例`的结果 |
| `path *= "/download/"` | 屏蔽路径含`/download/`的结果 |
| `host $= ".example.com" & path *= "/download/"` | 屏蔽`example.com`下路径含`/download/`的结果 |
| `@1 path $= ".pdf"` | 高亮URL路径以`.pdf`结尾的结果 |

### 2.9 自定义引擎：

通过脚本管理器菜单 `🖋️ 自定义引擎` 打开编辑面板（JS 格式，与内置 [SELECTORS](https://raw.githubusercontent.com/Carteahere/Search-Engine-Result-Hider/main/Other/SELECTORS.js) 结构一致）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `match` | regex | 必填，hostname 匹配正则字面量 |
| `containers` | string | 必填，结果容器的 CSS 选择器，**一键屏蔽**按钮依赖容器选择器定位 |
| `links` | string \| string\[\] | 可选，链接选择器，默认 `a[href]` |
| `titles` | string \| string\[\] | 可选，标题选择器列表 |
| `snippets` | string \| string\[\] | 可选，摘要选择器列表 |
| `extraElements` | string\[\] | 可选，CSS 相对选择器数组，以结果容器为起点选出关联元素 |
| `disabled` | boolean | 可选，别名 `disable`，`disabled: true` 停用该引擎，`disabled: false` 恢复内置 |

**示例：**

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

**说明：**

1. 内置引擎ID：`google`、`google_scholar`、`bing`、`duckduckgo_lite`、`duckduckgo`、`yandex`、`brave`、`ecosia`、`startpage`、`yahoo`、`so360`、`sogou`、`toutiao`、`quark`（在`@if($site=)`中，`ddg`是`duckduckgo`别名，`yahoo-japan`是`yahoo`别名）
2. 自定义引擎支持 `$site = "引擎ID"` 条件以及屏蔽/高亮/白名单规则
3. 引擎ID仅允许字母/数字/`_`/`-`，`other` 为保留键不可写，与内置引擎同ID或站点重叠时会覆盖内置选择器，如匹配 `cn.bing.com` 时将优先于内置 `bing` 命中
4. 优先级：自定义选择器 > 内置选择器，保存时仅存储与内置有差异的键，未改动的内置不会写入存储，改回内置值或重置可恢复跟随脚本更新，选择器未匹配到时默认退回`other`（置空）
5. 选择器字段均不支持伪元素，如 `::after`

**自动分析：**

不知道怎么添加的话，可以把网页离线文件（如 `.mht` / `.html` ）和表格发给Ai自动分析容器结构并生成对应选择器，部分搜索引擎移动端、桌面端、地区站点的容器命名不同需要分别保存文件分析并填写多个选择器。