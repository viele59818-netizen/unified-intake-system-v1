# 统一收集后端骨架 v1

这是一个零依赖的 Node.js 后端骨架，用来先跑通：

`网页收集页 -> 统一后端 -> 输入池数据`

## 当前能力

- `GET /health`
- `GET /api/entries`
- `POST /api/entries`
- `DELETE /api/entries`
- 把图片和视频保存到本地 `data/uploads`
- 把元数据保存到 `data/entries.json`
- 直接托管前端收集页：
  - `/`
  - `/index.html`
  - `/styles.css`
  - `/app.js`

## 启动方式

在当前目录运行：

```bash
node server.js
```

默认监听：

```text
http://localhost:3001
```

启动后可直接打开：

```text
http://localhost:3001
```

## 数据目录

启动后会自动创建：

```text
data/
  entries.json
  uploads/
```

也可以通过环境变量改存储目录：

```bash
DATA_DIR=./data node server.js
```

## 和前端原型的关系

`weixin-intake-v1` 当前已经预留为：

- 后端可用时，优先写入这个后端
- 后端不可用时，退回浏览器本地存储

所以你可以先单独开后端，再打开前端测试。

现在也可以直接通过后端地址打开前端，不再依赖 `file://`：

```text
http://localhost:3001
```

## 后续扩展

下一步可以继续做：

1. 按专题查询
2. 状态切换
3. 生成 Markdown 导出
4. 接飞书 / 企业微信入口
5. 替换成云开发 / OpenCloud

## 为什么这版更适合部署

因为现在前后端已经可以同域运行：

- 前端页面由后端直接提供
- 前端会自动根据当前域名请求 API
- 上传后的图片和视频也能通过后端同域访问

所以后面部署到线上时，只要把这个服务挂到一个 `https://` 地址上，就能直接在微信里打开，而不用再手动改接口地址。
