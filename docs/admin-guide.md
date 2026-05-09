# 管理后台使用指南

## 首次登录

### 1. 初始化管理员账号

首次使用需要创建管理员账号。连接 D1 数据库后，执行以下 SQL：

```sql
-- 使用简单的 hash 算法，实际密码是 'admin123'
INSERT INTO admin_users (id, username, password_hash, name, role, created_at)
VALUES (
  'admin-001',
  'admin',
  'hash_5d41402abc4b2a76b9719d911017c592',
  '管理员',
  'super_admin',
  1713000000000
);
```

> **注意**: 这是简化版密码哈希。正式环境请使用 bcrypt 或argon2。

### 2. 登录后台

访问 `/admin/login`，使用创建的账号登录。

---

## 功能说明

### 首页

- 查看机构总数、运行中数量、到期数量统计
- 授权即将到期的机构预警提示

### 机构管理

添加/编辑/删除机构。每个机构需要配置：

| 字段 | 说明 |
|------|------|
| 机构名称 | 显示名称 |
| 飞书 App ID | 机器人的 app_id |
| 飞书 App Secret | 机器人的 app_secret |
| 群 Chat ID | 机器人所在群的 ID |
| 多维表格 Base ID | 机构的多维表格 ID |
| 学员表 Table ID | 存储学员信息的表 |
| 排课表 Table ID | 存储课程安排的表 |
| 签到记录表 Table ID | 存储签到记录的表 |
| 到期时间 | 授权到期时间 |

### 定时任务

查看和管理各机构的定时任务，包括启用/停用。

---

## 添加授权用户

机构管理员添加该机构的飞书用户（老师）后，老师才能使用机器人点名等功能。

---

## API 接口

所有管理接口需要携带 Authorization header：

```
Authorization: Bearer <token>
```

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/admin/login` | POST | 管理员登录 |
| `/api/admin/register` | POST | 注册第一个管理员 |
| `/api/admin/me` | GET | 获取当前用户信息 |
| `/api/admin/institutions` | GET/POST | 机构列表/添加 |
| `/api/admin/institutions/:id` | GET/PUT/DELETE | 机构详情/更新/删除 |
| `/api/admin/cron` | GET | 定时任务列表 |
| `/api/admin/stats` | GET | 统计数据 |
