# bitbot 部署文档

## 部署地址

| 类型 | 地址 | 状态 |
|------|------|------|
| Frontend H5 | https://bitbot-aky.pages.dev | ✅ |
| Frontend 自定义域名 | https://feishuapi.de5.net | ✅ |
| Workers API | https://bitbot.hallofaiden.workers.dev | ✅ |
| Workers 自定义域名 | https://fastbot.de5.net | ✅ |

## 飞书 Webhook 配置

```
https://fastbot.de5.net/webhook/feishu
```

在飞书开放平台的机器人事件订阅中填写此地址。

## 路由路径

### 前端 H5
- `/` - 首页
- `/admin/register` - 注册管理员
- `/admin/login` - 管理员登录
- `/dashboard` - 仪表盘
- `/attendance` - 签到页面
- `/cron-jobs` - 定时任务
- `/makeup` - 补签管理

### 后端 API
- `GET /api/admin/me` - 当前管理员信息
- `POST /api/admin/login` - 管理员登录
- `POST /api/admin/register` - 注册管理员
- `GET/POST /api/admin/institutions` - 机构管理
- `POST /api/admin/activation` - 激活码管理
- `GET /api/admin/stats` - 统计数据
- `POST /webhook/feishu` - 飞书事件接收

## 技术栈

- 前端：React + Vite + TypeScript
- 后端：Cloudflare Workers (TypeScript)
- 数据库：Cloudflare D1 (SQLite)
- 部署：Cloudflare Pages + Workers

## 本地开发

```bash
# 1. 登录 Cloudflare
export CLOUDFLARE_API_TOKEN="your-token"
npx wrangler login

# 2. 本地开发
cd bitbot
npm run dev

# 3. 构建前端
npm run build:frontend

# 4. 部署 Workers
cd workers
npx wrangler deploy

# 5. 部署 Pages
wrangler pages deploy ./frontend/dist --project-name=bitbot
```

## D1 数据库

- 数据库名：bitbot-db
- 数据库 ID：d57c151b-dc86-47bd-bda8-93555d4e6cac
- Schema 文件：workers/src/db/schema.sql

```bash
# 执行 SQL
npx wrangler d1 execute bitbot-db --remote --file=./src/db/schema.sql
```

## Cloudflare 账号

- 账户邮箱：hallofaiden@gmail.com
- 账户 ID：cc2427c27991a20591e6156a179fb49c

## 常见问题

### Wrangler 登录失败 (WSL 环境)
OAuth 回调在 WSL 中无法访问 localhost:8976。解决方案：
1. 创建 API Token 代替 OAuth 登录
2. 在 https://dash.cloudflare.com/profile/api-tokens 创建
3. 使用 `export CLOUDFLARE_API_TOKEN="your-token"` 配置

### Pages 部署显示 "Deployment Not Found"
检查生产分支设置。Cloudflare Pages 默认使用 `main` 分支作为生产环境。
- 解决方案 1：创建 main 分支并推送
- 解决方案 2：用 `wrangler pages deploy` 手动部署

### Workers 报错 "Cannot read properties of undefined (reading 'fetch')"
`env.ASSETS` 可能为 undefined，需要加空值检查：
```typescript
if (env.ASSETS) {
  const assets = await env.ASSETS.fetch(request);
  // ...
}
```

## 更新日志

### 2026-05-07
- 完成 Cloudflare 部署配置
- Workers + Pages 全部部署成功
- 自定义域名配置完成