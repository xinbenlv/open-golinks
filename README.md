# Open GoLinks - v2-hono

短链与 Analytics 服务. **Bun + Hono + Drizzle + Vite/React** 实现, 部署在 **Railway**.

> 当前分支为 `v2-hono`, 是 v2 的第二次 attempt. 第一次 attempt (`v2-next`, Next.js + Vercel) 因为流量与场景不匹配被放弃, 但其 Drizzle schema 和 MongoDB 迁移脚本被复用. 详见 [`docs/plans/2026-05-07-v2-hono-rewrite.md`](./docs/plans/2026-05-07-v2-hono-rewrite.md).

## 架构速览

```
Browser/Extension ──▶ Railway (us-west2) ──▶ Supabase Postgres
                       Bun + Hono + 静态 SPA
```

- **后端**: 一个 Bun 进程, Hono 路由, Drizzle ORM
- **前端**: Vite + React 19 SPA, 由后端容器一并托管
- **数据库**: Supabase Postgres (links / audit_logs / daily_visits / users)
- **部署**: Railway 单容器 (Dockerfile), 月费目标 ≤ $5

## 目录结构

```
.
├── src/
│   ├── server.ts              # Hono 入口
│   ├── db/
│   │   ├── db.ts              # Drizzle 连接
│   │   ├── schema.ts          # 数据库 schema
│   │   └── migrations/        # SQL migrations
│   ├── routes/
│   │   ├── redirect.ts        # GET /:slug
│   │   └── api/
│   │       ├── health.ts
│   │       └── links.ts
│   └── web/                   # Vite + React SPA
│       ├── index.html
│       ├── main.tsx
│       ├── App.tsx
│       └── styles.css
├── scripts/
│   ├── migrate-from-legacy.ts # MongoDB → Postgres 迁移
│   └── inspect-mongo.ts
├── docs/
│   ├── plans/                 # 工作计划
│   └── v2-SPEC-zh-2.1.md      # 产品 spec
├── Dockerfile
├── railway.json
├── vite.config.ts
├── drizzle.config.ts
└── tsconfig.json
```

## 本地开发

```sh
# 安装依赖
bun install

# 配置环境变量 (DATABASE_URL = Supabase 连接串)
cp template.env .env

# 应用 schema
bun run db:migrate

# 启动 Hono server (端口 3000)
bun run dev

# 另一个终端: 启动 Vite dev server (端口 5173, 自动代理 /api 到 3000)
bun run dev:web
```

访问 http://localhost:5173/ 调试前端, http://localhost:3000/{slug} 测试重定向.

## 部署 (Railway)

```sh
railway init
railway up
# 在 Railway dashboard 设置 DATABASE_URL, NODE_ENV=production, PUBLIC_BASE_URL
```

healthcheck: `GET /api/v1/health`

## 文档导航

- [产品 Spec (v2.1)](./docs/v2-SPEC-zh-2.1.md)
- [当前架构 CURRENT-ARCHITECT](./docs/CURRENT-ARCHITECT.md)
- [活跃计划 docs/plans/](./docs/plans/)
- [迁移脚本说明 scripts/README.md](./scripts/README.md)

## 兼容性承诺

只保证 **slug URL 兼容**: 所有现有 `/{slug}` 短链在迁移后必须继续工作. API schema / Dashboard UI / Auth session 不保证向前兼容.
