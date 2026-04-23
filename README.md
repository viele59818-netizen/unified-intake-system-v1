# 统一输入收集系统 v1-candidate

这是一个围绕“多渠道输入收集 -> 统一后端 -> 后续分析输出”搭建的候选版工作区。

当前重点不是继续扩很多新能力，而是先把下面这条主干带到真实测试环境：

`收集页 / 其他入口 -> 统一后端 -> 输入池 -> AI分析 -> Obsidian / 飞书 / 任务系统`

## 当前项目包含什么

### 1. 可运行原型

- 收集页前端：[weixin-intake-v1](/Users/ethanlam/Documents/Codex/2026-04-22-new-chat/weixin-intake-v1)
- 统一后端：[intake-backend-v1](/Users/ethanlam/Documents/Codex/2026-04-22-new-chat/intake-backend-v1)

### 2. 方法与方案文档

- 总导航：[知识系统总导航-v1.md](/Users/ethanlam/Documents/Codex/2026-04-22-new-chat/知识系统总导航-v1.md)
- 工作流框架：[知识工作流与思考框架.md](/Users/ethanlam/Documents/Codex/2026-04-22-new-chat/知识工作流与思考框架.md)
- 微信优先方案：[微信优先接入方案-v1.md](/Users/ethanlam/Documents/Codex/2026-04-22-new-chat/微信优先接入方案-v1.md)
- 多渠道方案：[统一收集后端与多渠道接入方案-v1.md](/Users/ethanlam/Documents/Codex/2026-04-22-new-chat/统一收集后端与多渠道接入方案-v1.md)
- 部署说明：[部署方案-v1.md](/Users/ethanlam/Documents/Codex/2026-04-22-new-chat/部署方案-v1.md)
- 候选版入口：[候选版总入口-v1.md](/Users/ethanlam/Documents/Codex/2026-04-22-new-chat/候选版总入口-v1.md)
- 候选版检查清单：[部署候选版检查清单-v1.md](/Users/ethanlam/Documents/Codex/2026-04-22-new-chat/部署候选版检查清单-v1.md)
- 版本说明：[版本说明-v1-candidate.md](/Users/ethanlam/Documents/Codex/2026-04-22-new-chat/版本说明-v1-candidate.md)

### 3. 样板专题

- 专题索引：[产品舒适性问题 - 专题索引.md](/Users/ethanlam/Documents/Codex/2026-04-22-new-chat/产品舒适性问题%20-%20专题索引.md)
- 内部主笔记：[产品舒适性问题 - 售后分析与第二版评估.md](/Users/ethanlam/Documents/Codex/2026-04-22-new-chat/产品舒适性问题%20-%20售后分析与第二版评估.md)
- 客户版草稿：[产品舒适性问题 - 飞书客户版v1.md](/Users/ethanlam/Documents/Codex/2026-04-22-new-chat/产品舒适性问题%20-%20飞书客户版v1.md)

## 最小运行方式

### 启动后端

```bash
cd /Users/ethanlam/Documents/Codex/2026-04-22-new-chat/intake-backend-v1
npm start
```

### 打开页面

浏览器访问：

```text
http://localhost:3001
```

## 当前推荐的下一步

1. 把当前版本作为候选版收口
2. 部署成一个可通过 `https://` 访问的地址
3. 用手机和微信做真实测试
4. 再决定下一版迭代方向

## 当前目录结构

```text
2026-04-22-new-chat/
  README.md
  weixin-intake-v1/
  intake-backend-v1/
  *.md
```

其中：

- `weixin-intake-v1/` 负责页面体验
- `intake-backend-v1/` 负责统一收集后端
- 根目录这些 `.md` 负责方法、流程、专题和部署说明

## 当前结论

这不是最终产品，但已经是一个可以进入真实部署测试的候选版仓库。
