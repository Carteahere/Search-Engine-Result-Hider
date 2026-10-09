## <img src="https://github.com/user-attachments/assets/92954a5d-7157-40ed-9309-b9d75bf2bd32" width="30" height="30" align="center"> 搜索引擎结果屏蔽器

### 简介：

**详细信息见 [Github](https://github.com/Carteahere/Search-Engine-Result-Hider)**  
建议在Issue反馈bug方便上传附件

在仅支持安装脚本的浏览器上实现复杂规则屏蔽搜索结果功能  
兼容uBlacklist基础规则，支持URL匹配、正则匹配、标题匹配、结果摘要(snippet)匹配、高亮目标结果、白名单匹配、`@if`附加判断条件，以及添加**自定义引擎**  
当前适配搜索引擎：  
Bing、Google、Google Scholar、DuckDuckGo(&lite)、Yandex、Brave、Ecosia、Startpage、Yahoo(&Japan)、360搜索、搜狗、头条搜索、夸克(&神马)

### 当前功能：

- 基础/高级语法匹配结果
- 统计命中规则和调试输出
- 导入/导出规则
- 规则语法检查
- 一键屏蔽
- 规则订阅
- Webdav同步
- 脚本管理器菜单  
┣ 打开面板  
┣ 自定义引擎  
┗ 自定义高亮颜色

部分设置说明：
1. 折叠模式：默认关闭，开启后被屏蔽结果只显示标题
2. 悬浮球功能切换：默认点击打开面板；切换为显隐结果时点击显示/隐藏被屏蔽结果、长按打开面板，被屏蔽结果的屏蔽按钮再次点击则取消屏蔽

### 规则简单示例：

| 规则 | 示例 |说明 |
| --- | --- |--- |
| URL | `*://*.example.com/*` | 屏蔽`example.com` |
| 正则 | `/example\.(com\|net)/i` | 屏蔽`example.com`和`example.net` |
| 标题 | `title/.*example.*/i` | 屏蔽标题含`example`的结果 |
| 摘要 | `text/.*example.*/i` | 屏蔽网页描述内容(snippet)含`example`的结果 |
| 高亮 | `@1*://*.example.com/*` | 给`example.com`加上高亮边框 |
| 白名单 | `@*://*.example.com/*` | 放行`example.com` |
| `@if`附加条件 | `*://*.example.com/* @if(title *= "示例")` | 屏蔽`example.com`的标题中含`示例`的结果 |
| 多`@if`附加条件 | `*://*.example.com/* @if((title *= "a" \| title *= "b") & !(url *= "c"))` | 屏蔽标题含`a`或`b`且URL不含`c`的`example.com`的结果 |

### 截图

<img width="400" height="250" alt="01" src="https://github.com/user-attachments/assets/a8297817-1856-434e-a329-b98adbfbad91" />
<br/>
<img width="250" height="85" alt="02" src="https://github.com/user-attachments/assets/b5eb4eac-9bc5-44a4-a0eb-a38076c35e4d" />
