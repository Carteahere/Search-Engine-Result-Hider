## <img src="https://github.com/user-attachments/assets/92954a5d-7157-40ed-9309-b9d75bf2bd32" width="30" height="30" align="center"> 搜索引擎结果屏蔽器

### 1.1 简介

[中文](README.md) | [English](README.en.md) | 交流群 [TG](https://t.me/+qBqMTqjc4Xk5M2Jh)

在**仅支持安装脚本**的浏览器上实现复杂规则屏蔽搜索结果功能  
支持包括ublacklist基础规则在内的URL匹配、正则匹配、标题匹配、白名单匹配、高亮目标结果以及结果摘要(snippet)匹配  
当前支持的搜索引擎：Bing、Google、Google Scholar、DuckDuckGo(&lite)、Yandex、Brave、Yahoo(&Japan)  
自动去除重定向引擎：Bing、Google、Google Scholar、DuckDuckGo、Yahoo

安装源 [Github](https://raw.githubusercontent.com/SadYuyuko/Search-Engine-Result-Hider/main/Search-Engine-Result-Hider_autoupdate.user.js) | [Greasy Fork](https://update.greasyfork.org/scripts/552394/%E6%90%9C%E7%B4%A2%E5%BC%95%E6%93%8E%E7%BB%93%E6%9E%9C%E5%B1%8F%E8%94%BD%E5%99%A8.user.js)

使用支持安装脚本的浏览器打开直接安装

### 1.2 当前功能：

- 基础/高级语法匹配结果
- 一键屏蔽
- 统计命中规则和调试输出
- 导入/导出规则到TXT
- 规则错误检测
- 规则订阅
- Webdav同步
- 脚本管理器菜单  
┣ 打开面板  
┣ 语言切换  
┣ 自定义选择器  
┣ 自定义高亮颜色  
┣ 开关错误检测  
┣ 开关悬浮球显示  
┣ 开关面板居中：默认居中，切换后根据悬浮球位置显示在屏幕四角  
┗ 切换悬浮球功能：  
　┗ 🟢点击打开面板  
　┗ 🔵点击展开被屏蔽结果，长按打开面板，被屏蔽结果的屏蔽按钮再次点击则取消屏蔽

### 1.3 关于Webdav：

1. 自动同步后台运行，根据配置时间戳每1h按行合并同步一次，手动上传/下载为强制覆盖
2. 脚本设置同步和自定义选择器同步开关互相独立
3. 地址只支持https和完整路径，如坚果云`https://dav.jianguoyun.com/dav/your_folder/`，路径文件夹不存在会自动创建

### 1.4 关于订阅：

1. 订阅更新同样后台运行，每12h拉取一次，支持纯文本远程链接如`https://raw.githubusercontent.com/SadYuyuko/Search-Engine-Result-Hider/main/Other/rules.txt`；兼容`.yaml`uBlacklist列表格式（`name`/`rules`/`blacklist`/`whitelist`/`matches`项）
2. 订阅规则在本地规则后追加应用，由于脚本可分配性能有限，规则总数建议不超过5w条避免手机爆炸🤳💥
3. 脚本扩展有限不支持`##`DOM元素和uBO过滤等规则，通过订阅导入会自动过滤
4. 订阅和webdav都依赖跨域请求权限，若有权限申请弹窗选`总是允许`

### 1.5 其他：

1. 一键屏蔽逻辑：  
开启二次确认时弹出面板可选屏蔽或添加白名单，关闭时按屏蔽域名开关添加`*://example.com/*`或`*://*.example.com/*`；  
取消屏蔽在开启二次确认时弹出面板可选删除本地源规则或添加白名单；关闭时默认删除本地源规则，命中订阅规则时显示选择面板添加白名单。
2. 规则优先级：本地白名单 > 本地黑名单 > 订阅白名单 > 订阅黑名单
3. 脚本通过`@match *://*/*`全站注入，悬浮球与屏蔽过滤仅在搜索引擎生效
4. 注释行格式`#+空格+内容`，⬆️/⬇️功能为移动到上一个/下一个注释行，在第一行或第一个注释行时⬆️会跳到最后一行

## 文档

自定义选择器、具体规则语法说明见 [规则说明](Rule-Explanation.md)

调试模式、故障排除见 [测试说明](Debug.md)

## 截图

<img width="450" height="288" alt="01" src="https://github.com/user-attachments/assets/8523f109-84d1-4eba-b8d5-678b0a824340" />
<br/>
<img width="200" height="148" alt="02" src="https://github.com/user-attachments/assets/067323b2-40c0-498e-a0f4-f78ab8a52ad4" />