## 测试说明

### 3.1 环境要求

- Node.js 15+ 
- 无额外依赖

### 3.2 运行测试

将test文件夹和脚本放至同一目录运行，测试会自动读取上一级目录唯一一个 `.js` 脚本，按功能域分为：条件表达式、规则、选择器与引擎、跨域权限

```bash
# 运行所有测试
node test/test-conditions.cjs
node test/test-rules.cjs
node test/test-selectors.cjs
node test/test-connect.cjs

# 运行特定测试
node test/test-conditions.cjs 2>&1 | Select-String "failed"
```

成功输出如 `10 passed, 0 failed`

### 3.3 调试模式

开启脚本调试模式，使用[网页调试](https://greasyfork.org/zh-CN/scripts/475228)脚本或浏览器F12开发者工具 → Console标签查看输出

```javascript
const d = window.__SERH_DEBUG__;

// 查看当前配置
console.log('当前配置:', d.config);

// 查看引擎识别
console.log('搜索引擎:', d.getSearchEngine());

// 模拟结果匹配
d.checkRuleMatchOptimized(
  'https://www.example.com/page?a=1',   // 结果 URL
  'www.example.com',                    // 结果域名
  '页面标题',                            // 标题
  '网页摘要'                             // 摘要
);
```

正常输出

```bash
// 正常启动
[屏蔽] 引擎: google, 选择器: "div.g, div.MjjYud", 匹配数量: 15
[屏蔽] 未处理的新结果数量: 15
[屏蔽] 共屏蔽 3 个结果

// 表示：成功识别Google引擎，找到15个结果，屏蔽了3个
```

错误输出

```bash
// 规则语法错误
规则预编译失败: *://example.com/* Error: Invalid regex pattern

// 表示：规则语法有误，需要检查规则格式
```
### 3.4 Debug API示例

开启调试模式后 `window.__SERH_DEBUG__` 才会被挂载，关闭调试模式自动删除

| API | 签名 | 返回/说明 |
| --- | --- | --- |
| config | getter | 当前完整配置对象（只读引用） |
| compiledRules | getter | 编译后的规则索引：domains(Map)、urls/titles/texts、highlight*、whitelist*、conditional* 等分类数组 |
| getSearchEngine() | () | 当前引擎 ID（google/bing/…），非引擎站点返回 other |
| getSearchCategory(loc?) | (location?) | 当前搜索类型：web/images/videos/news |
| getContainerSelector(engine) | (engineId) | 该引擎的结果容器 CSS 选择器字符串 |
| getSubdomainLevels(domain) | (hostname) | 域名层级数组，如 'a.b.example.com' → ['a.b.example.com', 'b.example.com', 'example.com', 'com'] |
| checkRuleMatchOptimized(url, domain, title, snippet, subdomainLevels?) | 第 5 参可省略 | false 或 {highlight: N} / {blocked: true, rule, source} / {highlight: N, blocked: true, rule, source} |
| forceReprocessAll() | () | 重建规则索引并强制重新处理当前页所有结果（每帧 30 个分批），用于改规则后手动刷新 |

### 3.5 规则自检对照表

| 提示 | 示例 | 原因 | 修改 |
| --- | --- | --- | --- |
| 高亮级别需在 1-5 之间 | `@6*://*.example.com/*` | `@N` 的 N 超出 `@1`～`@5` 范围 | 改为 `@1`～`@5` |
| 高亮规则不能与白名单组合 | `@1@*://*.example.com/*` | `@N` 高亮前缀与 `@` 白名单前缀叠加 | 二选一，去掉其中一个前缀 |
| 规则前缀后缺少内容 | `title//` | 前缀（`@/@N/title//text/`）后面是空的 | 补上具体规则或正则内容 |
| URL 通配符格式无效: {rule} | `@@*://example.com/*` | `@@` 开头（uBO 例外语法）不被支持；或通配符结构无法解析 | 去掉多余 `@`；检查通配符格式（白名单只需单个 `@`） |
| 正则表达式无效 | `title/(未闭合/` | 斜杠未闭合、括号/量词等正则语法错误 | 补全闭合斜杠，修正正则语法 |
| 正则 flags 无效: {flags} | `/x/g、title/x/gi` | 不支持 `g`/`y`（脚本只判断是否匹配）；或使用了不存在的 flag | 删除 `g`/`y`，仅用 `i`/`m`/`s`/`u` |
| `@if(...)` 括号未闭合 | `*://x.com/* @if(title *= "a"` | `@if( `的括号不配对 | 补全右括号 `)` |
| `@if()` 条件不能为空 | `*://x.com/* @if()` | 括号内没有条件 | 填入条件表达式 |
| 未知 `@if` 条件: {part} | `@if(foo = "a")` | 条件键名不在支持列表（`$site`/`$category`/`site`/`title`/`url`/`host`/`path`/`scheme`） | 检查键名拼写 |
| 条件正则无效: {part} | `@if(title =~ /(/)` | `@if` 内 `=~` 正则本身语法错误 | 修正正则 |
| `@if` 表达式语法错误: {part} | `@if(title *= )` | 条件表达式缺操作数、括号分组不完整等 | 补全表达式 |
| URL规则无效 | 通配规则转正则后无法编译 | URL 通配符内部异常 | 简化规则结构重试 |