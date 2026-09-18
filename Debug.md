## 测试说明

### 3.1 环境要求

- Node.js 14+ 
- 无额外依赖

### 3.2 运行测试

将test文件夹和脚本放至同一目录运行，测试会自动读取上一级目录 `.js` 脚本，按功能域分为：条件表达式、规则、选择器与引擎、跨域权限

```bash
# 运行所有测试
node test/test-conditions.cjs
node test/test-rules.cjs
node test/test-selectors.cjs
node test/test-connect.cjs

# 运行特定测试
node test/test-conditions.cjs 2>&1 | grep "FAIL"
```

成功输出如 `10 passed, 0 failed`

### 3.3 调试模式

使用[网页调试](https://greasyfork.org/zh-CN/scripts/475228)脚本或浏览器F12开发者工具 → Console标签查看输出

```javascript
const d = window.__SERH_DEBUG__;

// 查看当前配置
console.log('当前配置:', d.config);

// 查看编译后的规则
console.log('编译规则:', d.compiledRules);

// 查看搜索引擎识别
console.log('搜索引擎:', d.getSearchEngine());

// 查看当前页面结果数量
console.log('结果数量:', document.querySelectorAll('div.g').length);

// 监控规则匹配性能
console.time('规则匹配');
d.checkRuleMatchOptimized(url, domain, title, snippet);
console.timeEnd('规则匹配');

// 监控DOM查询性能
console.time('结果查询');
document.querySelectorAll(selector);
console.timeEnd('结果查询');
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