## <img src="https://github.com/user-attachments/assets/92954a5d-7157-40ed-9309-b9d75bf2bd32" width="30" height="30" align="center"> 搜索引擎结果屏蔽器

### 1.1 简介

[中文](README.md) | [English](README.en.md)

在**仅支持安装脚本**的浏览器上实现复杂规则屏蔽搜索结果功能  
支持包括ublacklist基础规则在内的URL匹配、正则匹配、标题匹配、白名单匹配、高亮目标结果以及结果摘要(snippet)匹配  
当前支持搜索引擎：Bing、Google、Google Scholar、DuckDuckGo(ddg/lite)、Yandex、Brave、Yahoo(&Japan)  

安装源 [Github](https://raw.githubusercontent.com/Carteahere/Search-Engine-Result-Hider/main/Search-Engine-Result-Hider_autoupdate.user.js) | [Greasy Fork](https://update.greasyfork.org/scripts/552394/%E6%90%9C%E7%B4%A2%E5%BC%95%E6%93%8E%E7%BB%93%E6%9E%9C%E5%B1%8F%E8%94%BD%E5%99%A8.user.js)  
浏览器打开直接安装

### 1.2 当前功能：

- 基础/高级语法匹配结果
- 统计命中规则和调试输出
- 导入/导出规则到TXT
- 规则错误检测
- 规则订阅
- 一键屏蔽
- Webdav同步
- 脚本管理器菜单  
┣ 打开面板  
┣ 语言切换  
┣ 自定义选择器  
┣ 自定义高亮颜色  
┗ 切换悬浮球功能：  
　┗ 🟢点击打开面板  
　┗ 🔵点击展开被屏蔽结果，长按打开面板，被屏蔽结果的屏蔽按钮再次点击则取消屏蔽

### 1.3 关于Webdav：

1. 自动同步后台运行，使用三方快照合并同步，手动上传/下载为强制覆盖
2. 地址只支持**https**和完整路径，如坚果云`https://dav.jianguoyun.com/dav/your_folder/`，路径文件夹不存在时会自动创建，文件名如`rules.txt`修改后需手动上传覆盖一次
3. 油猴无安全存储API，密码只能本地混淆处理，安全起见必须使用单独应用密码
4. 同步时为确保时间戳准确，会自动访问一次timeapi/akamai/cloudflare授时点，访问失败默认使用webdav的date时间戳

### 1.4 关于订阅：

1. 订阅更新同样后台运行，每12h拉取一次，支持UTF-8编码的纯文本远程链接如`https://raw.githubusercontent.com/Carteahere/Search-Engine-Result-Hider/main/Other/rules.txt`；兼容`.yaml`uBlacklist列表格式（`name`/`rules`/`blacklist`/`whitelist`/`matches`项）
2. 订阅规则在本地规则后追加应用，由于脚本可分配性能有限，规则总数建议不超过5w条避免手机爆炸🤳💥
3. 脚本扩展有限不支持`##`DOM元素和uBO过滤等规则，通过订阅导入会自动过滤
4. 订阅链接非github源时需要跨域请求权限，若有权限申请弹窗选`总是允许`

### 1.5 其他：

1. 自动去除重定向的引擎：Bing、Google、Google Scholar、DuckDuckGo、Yahoo
2. 规则优先级：本地白名单 > 本地黑名单 > 订阅白名单 > 订阅黑名单
3. 脚本全站运行，悬浮球与屏蔽过滤仅在搜索引擎生效，非引擎站点只显示部分菜单选项
4. 面板居中默认开启，关闭后根据悬浮球位置显示在屏幕四角
5. 注释行格式`#+空格+内容`，不可重复否则同步时会合并同注释行下内容；⬆️/⬇️功能为移动到上一个/下一个注释行，在第一行或第一个注释行时⬆️会跳到最后一行
6. 为避免跨页数据冲突，请勿在多个标签页同时打开面板编辑规则，打开面板时暂停同步

## 文档

自定义引擎选择器、具体规则语法说明见 [规则说明](Rule-Explanation.md)

调试模式、故障排除见 [测试说明](Debug.md)

## 截图

<img width="400" height="250" alt="01" src="https://github.com/user-attachments/assets/a8297817-1856-434e-a329-b98adbfbad91" />

<img width="250" height="123" alt="02" src="https://github.com/user-attachments/assets/4f7927c2-9340-4276-b253-b8a6e2523eb1" />
