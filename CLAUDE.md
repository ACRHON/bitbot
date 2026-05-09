# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

bitbot is a Feishu (飞书) robot hosting platform for education/training institutions. It provides:
- H5-based attendance taking (students sign in via card button → H5 page)
- Scheduled class reminders via Cloudflare Cron
- Multi-tenant isolation (each institution has its own robot + bitable)

## Architecture

```
Cloudflare Workers (API + Feishu Webhook)
    │
    ├── /webhook/feishu     → Feishu event receiver
    ├── /api/admin/*        → Institution management
    ├── /api/auth/*         → User authorization
    └── /api/attendance/*   → Attendance sessions

Cloudflare Pages (H5 Frontend)
    │
    ├── /dashboard          → Main entry
    ├── /attendance         → Core attendance taking UI
    ├── /robot-status       → Robot status
    └── /cron-jobs          → Scheduled tasks
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + Vite + React Router |
| Backend | Cloudflare Workers (TypeScript) |
| Database | Cloudflare D1 (SQLite) |
| Scheduler | Cloudflare Cron Triggers |
| Deployment | Cloudflare Pages + Workers |

## Commands

```bash
# Frontend
cd frontend
npm install
npm run dev
npm run build

# Backend (Workers)
cd workers
npx wrangler d1 execute bitbot-db --local --file=./src/db/schema.sql  # Init D1
npx wrangler dev                 # Local dev
npx wrangler deploy              # Deploy
```

## Key Flows

### Attendance Flow (Core)
1. Cron triggers → Worker sends Feishu card with "开始点名" button
2. Teacher clicks button → Feishu sends `card.action.trigger` to `/webhook/feishu`
3. Worker verifies open_id → Returns H5 URL with session context
4. H5 loads → Shows student list → Teacher marks attendance
5. Results written back to customer's bitable

### Database Schema
- `institutions` — one per customer (robot + bitable config)
- `authorized_users` — open_ids authorized per institution
- `cron_jobs` — scheduled tasks per institution
- `attendance_sessions` — one per class session

## Important Notes

- Platform does NOT store customer's business data (only stores config)
- All business data stays in customer's bitable
- Authentication happens at card-click time, not H5 login
- Worker uses D1 binding `DB`, KV binding `BITBOT_KV`

## File Structure

```
bitbot/
├── frontend/
│   ├── src/
│   │   ├── pages/           # React page components
│   │   ├── lib/api.ts       # API client
│   │   ├── App.tsx          # Router
│   │   └── index.css        # Global styles
│   ├── index.html
│   └── vite.config.ts
│
├── workers/
│   ├── src/
│   │   ├── index.ts         # Entry + fetch handler
│   │   ├── db/
│   │   │   ├── schema.ts    # D1 schema (SQL)
│   │   │   └── queries.ts   # D1 query functions
│   │   ├── routes/
│   │   │   ├── feishu.ts    # Feishu webhook handler
│   │   │   ├── attendance.ts # Attendance session API
│   │   │   ├── auth.ts       # User auth API
│   │   │   ├── cron.ts       # Cron job executor
│   │   │   └── institutions.ts # Admin institution CRUD
│   │   └── services/
│   │       ├── feishu-api.ts # Feishu API calls
│   │       └── bitable.ts    # Bitable API calls
│   ├── wrangler.toml
│   └── tsconfig.json
│
├── CLAUDE.md
├── SPEC.md
└── README.md
```
