# bitbot

飞书机器人托管平台

## 一键启动（本地开发）

```bash
# macOS / Linux
./dev.sh

# Windows
dev.cmd
```

这会自动：
1. 安装所有依赖
2. 启动前端 (http://localhost:5173)
3. 启动后端 (http://localhost:8787)
4. 启动 tunnel 暴露公网（用于接收飞书事件）

---

## 手动启动

### 前端
```bash
cd frontend
npm install
npm run dev
```

### 后端
```bash
cd workers
npm install
npx wrangler login  # 首次需要登录 Cloudflare
npx wrangler dev --tunnel  # 带 tunnel
```

---

## 首次使用

### 1. 创建管理员账号

访问 `http://localhost:5173/admin/register` 注册第一个管理员。

### 2. 添加机构

登录后在"机构管理"中添加客户的飞书机器人和多维表格配置。

### 3. 配置飞书 Webhook

在飞书开放平台配置 Webhook URL 为 tunnel 提供的公网地址。

---

## 项目文档

- [../SPEC.md](../SPEC.md) — 产品需求文档
- [./CLAUDE.md](./CLAUDE.md) — 开发指南
- [./docs/admin-guide.md](./docs/admin-guide.md) — 管理后台使用指南
