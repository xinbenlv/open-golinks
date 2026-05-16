# Open GoLinks - v2-hono

短链与 Analytics 服务. **Bun + Hono + Drizzle + Vite/React** 实现, 部署在 **Railway**.

> 当前分支为 `v2-hono`, 是 v2 的第二次 attempt. 第一次 attempt (`v2-next`, Next.js + Vercel) 因为流量与场景不匹配被放弃, 但其 Drizzle schema 和 MongoDB 迁移脚本被复用. 历史决策见已归档 [`docs/plans/archived/2026-05-07-v2-hono-rewrite-phase-1.md`](./docs/plans/archived/2026-05-07-v2-hono-rewrite-phase-1.md); 当前活跃工作计划见 [`docs/plans/2026-05-13-feature-parity-master-plan.md`](./docs/plans/2026-05-13-feature-parity-master-plan.md).

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
│   ├── lib/                   # brand / identity / GA4 / QR / fingerprint helpers
│   ├── assets/                # 字体与主题 logo 静态资源
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
│   ├── reconcile-legacy-owners.ts # synthetic owner repair
│   ├── lib/                  # migration/identity shared helpers
│   └── inspect-mongo.ts
├── docs/
│   ├── plans/                 # 工作计划
│   ├── troubleshooting/       # 排障记录与一次性修复注意事项
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

# 配置环境变量 (DATABASE_URL = Supabase 连接串; 迁移/repair 还需要 Supabase Admin key)
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

详见 [`DEPLOYMENT.md`](./DEPLOYMENT.md)。

```sh
railway init
railway up
# 在 Railway dashboard 设置 DATABASE_URL, NODE_ENV=production, PUBLIC_BASE_URL
```

healthcheck: `GET /api/v1/health`

## 文档导航

- [产品 Spec (v2.1)](./docs/v2-SPEC-zh-2.1.md)
- [部署与生产切换 DEPLOYMENT](./DEPLOYMENT.md)
- [当前架构 CURRENT-ARCHITECT](./docs/CURRENT-ARCHITECT.md)
- [活跃计划 docs/plans/](./docs/plans/)
- [Supabase 邮件模板 docs/email-templates/](./docs/email-templates/)
- [排障记录 docs/troubleshooting/](./docs/troubleshooting/)
- [迁移脚本说明 scripts/README.md](./scripts/README.md)

## 版本展示 (Versioning)

每个构建都会被打上 `version / sha / builtAt / branch` 四元组, 来源:

- **`version`**: `package.json#version` (semver, PR 中显式 bump)
- **`sha`**: `git rev-parse --short=6 HEAD` 或部署平台注入 (`VERCEL_GIT_COMMIT_SHA` / `RAILWAY_GIT_COMMIT_SHA` / `GITHUB_SHA`)
- **`builtAt`**: ISO-8601 带本地时区偏移, e.g. `2026-05-13T19:30:42-07:00`
- **`branch`**: 当前分支 (可选)

实现位于 [`src/build-info.ts`](./src/build-info.ts), 在三处暴露:

1. **Web UI**: 全局右下角水印 (`src/web/components/BuildStamp.tsx`) + Landing footer 版本链接
2. **API**: `GET /api/v1/version` 返回 JSON; 所有响应携带 `X-Build-Version` / `X-Build-Sha` / `X-Build-Time` header
3. **Server 启动日志**: `[build] open-golinks-v2-hono v… · … · …`

CI/部署期可用 `OGL_BUILD_VERSION` / `OGL_BUILD_SHA` / `OGL_BUILD_TIME` / `OGL_BUILD_BRANCH` 显式覆盖.

## 兼容性承诺

只保证 **slug URL 兼容**: 所有现有 `/{slug}` 短链在迁移后必须继续工作. API schema / Dashboard UI / Auth session 不保证向前兼容.
