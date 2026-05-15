# bitbot 部署指南

## 环境概览

| 环境 | URL | D1 数据库 | 用途 |
|------|-----|----------|------|
| 生产环境 | https://fastbot.de5.net | bitbot-db | 正式运营 |
| 开发环境 | https://bitbot-dev.hallofaiden.workers.dev | bitbot-dev-db | 测试开发 |

## 快速部署

### 生产环境

```bash
# 前端构建
cd frontend
npm run build

# 后端部署
cd workers
npx wrangler deploy
```

### 开发环境

```bash
# 前端构建（使用 dev 配置）
cd frontend
npm run build:dev

# 后端部署到 dev 环境
cd workers
export CLOUDFLARE_API_TOKEN="你的Cloudflare API Token"
npx wrangler deploy --env dev --config wrangler.dev.toml
```

## 配置文件说明

### Workers 配置

| 文件 | 环境 | 说明 |
|------|------|------|
| `wrangler.toml` | 生产 | 默认配置 |
| `wrangler.dev.toml` | 开发 | 开发环境配置 |

### 前端配置

| 文件 | 构建命令 | API 指向 |
|------|---------|---------|
| `vite.config.ts` | `npm run build` | 生产环境 |
| `vite.dev.config.ts` | `npm run build:dev` | 开发环境 |

## 环境变量

Workers 环境变量通过 `wrangler.toml` 的 `[vars]` 配置：

```toml
# 生产
[vars]
ENV = "production"

# 开发
[env.dev.vars]
ENV = "dev"
```

## D1 数据库

### 查看数据库列表

```bash
export CLOUDFLARE_API_TOKEN="你的token"
npx wrangler d1 list
```

### 数据库列表

| 数据库名 | 环境 | ID |
|---------|------|-----|
| bitbot-db | 生产 | d57c151b-dc86-47bd-bda8-93555d4e6cac |
| bitbot-dev-db | 开发 | 44e58750-3b53-4be7-b37c-b62be926cc9b |

### 初始化数据库

```bash
# 生产数据库
npx wrangler d1 execute bitbot-db --remote --file=./src/db/schema.sql

# 开发数据库
npx wrangler d1 execute bitbot-dev-db --remote --file=./src/db/schema.sql
```

## 部署步骤详解

### 1. 前端构建

```bash
cd frontend

# 生产构建
npm run build
# 输出: dist/

# 开发构建
npm run build:dev
# 输出: dist/ (VITE_API_BASE 指向开发环境)
```

### 2. Workers 部署

```bash
cd workers

# 生产部署
export CLOUDFLARE_API_TOKEN="你的Cloudflare API Token"
npx wrangler deploy

# 开发部署
export CLOUDFLARE_API_TOKEN="你的Cloudflare API Token"
npx wrangler deploy --env dev --config wrangler.dev.toml
```

## Cloudflare Token 配置

Token 存储在 `~/.wrangler/config.toml`：

```toml
[credentials]
api_token = "cfut_xxxxxxxxxxxxxxxxxxxx"
```

**获取新 Token：**
1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 进入 **My Profile** → **API Tokens**
3. 创建自定义 Token，添加 `D1:Edit` 和 `Workers:Edit` 权限

## 自定义域名

### 当前域名配置

| 环境 | 域名 | 类型 |
|------|------|------|
| 生产 | fastbot.de5.net | workers.dev |
| 开发 | bitbot-dev.hallofaiden.workers.dev | workers.dev (默认) |

### 添加自定义域名

如需添加 `bitbot-dev.de5.net`：

1. 在 Cloudflare Dashboard 添加 DNS 记录：
   - 类型: A
   - 名称: bitbot-dev
   - 内容: 指向 Workers IP

2. 更新 `wrangler.dev.toml`：
```toml
[[env.dev.routes]]
pattern = "bitbot-dev.de5.net"
zone_name = "de5.net"
```

3. 重新部署

## 数据隔离

| 环境 | 数据库 | 数据 |
|------|--------|------|
| 生产 | bitbot-db | 真实运营数据 |
| 开发 | bitbot-dev-db | 测试数据 |

两个环境数据库**完全独立**，开发环境不会影响生产数据。

## 常见问题

### Q: Wrangler 报错 "No API token found"
```bash
export CLOUDFLARE_API_TOKEN="你的token"
```

### Q: 部署后访问404
可能是 Workers Site 的 `bucket` 路径不对，检查：
```toml
[site]
bucket = "../frontend/dist"
```

### Q: D1 数据库查询失败
确认使用了 `--remote` 参数：
```bash
npx wrangler d1 execute bitbot-db --remote --file=./src/db/schema.sql
```

## 目录结构

```
bitbot/
├── frontend/
│   ├── src/
│   ├── dist/                    # 构建输出
│   ├── vite.config.ts           # 生产配置
│   └── vite.dev.config.ts       # 开发配置
├── workers/
│   ├── src/
│   ├── wrangler.toml            # 生产配置
│   └── wrangler.dev.toml       # 开发配置
└── docs/
    └── DEPLOY.md               # 本文档
```