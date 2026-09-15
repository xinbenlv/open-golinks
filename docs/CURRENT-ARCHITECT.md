# CURRENT-ARCHITECT

> v2-hono 实现的当前架构. 修改代码后必须同步更新此文档. 详见 [`.claude/rules/current-architect.md`](../.claude/rules/current-architect.md).

## System Overview

ZGZG QR 预览和 PNG 导出直接叠加透明 logo，不绘制白色缓冲区。

Edit 提议区使用标题和操作直接引导，省去重复说明；审批、隐私及冲突恢复提示保留在相关状态。

Railway 在新版启动前运行 `bun run db:migrate`（`railway.json`），复用服务环境中的数据库连接；迁移失败阻止发布。

### ASCII 简图

```
              ┌──────────────────────────────────────────────┐
              │   Railway 单容器 (us-west2, sjc-adjacent)    │
              │                                              │
   Browser ──▶│  Bun + Hono                                  │
   Extension  │   ├─ /:slug          → 302 + 异步 analytics  │
              │   ├─ /warn/:slug     → SSR warning HTML      │
              │   ├─ /qr/:slug.png    → QR PNG compat         │
              │   ├─ /api/v1/health  → JSON                  │
              │   ├─ /healthz        → JSON (uptime monitor)  │
              │   ├─ /api/v1/audit   → owner audit timeline   │
              │   ├─ /api/v1/links   → CRUD + claim + proposals  │
              │   ├─ /api/v1/me      → JWT 当前用户           │
              │   ├─ /api/v1/stats   → owner summary + public GA4/trending │
              │   └─ /*              → 静态 SPA (dist/web)   │
              └──────────┬───────────────────────────────────┘
                         │ postgres-js + Drizzle
                         ▼
                 Supabase Postgres
                 (links / link_proposals / audit_logs / daily_visits / users)
                         ▲
                         │
                 Supabase Auth (JWT + Admin API for migration/repair)
```

### Mermaid 详细图

独立体验原型：`Browser → Vite :5174 → React fixtures（仅内存）`，无后端连线。

```mermaid
flowchart TB
  DEMO[独立 Vite :5174 原型] --> FIXTURES[React 内存 fixtures]
  subgraph Client[客户端]
    BR[Browser]
    EX[Chrome Extension]
  end

  subgraph Railway[Railway us-west2 容器]
    SRV[Bun + Hono server.ts]
    RED[redirect.ts<br/>GET /:slug]
    WARN[warn.ts<br/>GET /warn/:slug]
    QR[qr.ts<br/>GET /qr/*.png]
    API[routes/api/*.ts]
    SPA[Vite SPA<br/>dist/web/]
    SCRIPTS[scripts/*<br/>migration + repair]
  end

  subgraph Supabase[Supabase]
    PG[(Postgres)]
    AUTH[Auth JWT]
    ADMIN[Auth Admin API]
  end

  BR -->|GET /:slug| SRV
  EX -->|GET /:slug| SRV
  SRV --> RED
  SRV --> WARN
  SRV --> QR
  RED -->|SELECT| PG
  RED -->|302| BR
  RED -.->|async UPSERT| PG
  RED -.->|async page_view| GA4[GA4 Measurement Protocol]

  BR -->|/dashboard, /create, /claim/:slug| SRV
  SRV --> SPA
  SPA -->|fetch /api/v1/*| API
  API --> PG
  API --> PROPOSALS[提议事务 / reviewer 权限]
  PROPOSALS --> PG
  PROPOSALS --> GEOIP[可选本地 GeoIP 数据库]
  BR -->|登录| AUTH
  AUTH -->|JWT| BR
  SCRIPTS --> PG
  SCRIPTS --> ADMIN
```

## 模块说明

### 入口
- **`src/server.ts`** - Hono app 装配, 注册路由, 在生产托管 SPA. Bun 用 `default { port, fetch }` 自动监听.

### 路由
- **`src/routes/redirect.ts`** (`GET /:slug`)
  - 校验 slug 格式 + 保留路径; RESERVED 或不合法格式 → `next()`, 交给静态资源 / SPA fallback
  - 查询 `links` 表 (排除软删除)
  - 若 `metadata.show_warning === true` 且未带 `?confirm=1`, 302 到 `/warn/:slug`
  - 命中 → 302 立即返回, 用 `queueMicrotask` 异步累加 visits + UPSERT daily_visits
  - 未命中 (合法但未创建) → 302 到 `/edit/<slug>`, 让用户走 Landing 同款表单创建
- **`src/routes/warn.ts`** (`GET /warn/:slug`)
  - Hono SSR route, 返回自包含 HTML, 不依赖 SPA bundle
  - 查询未删除链接; 不存在/已删除 → 404
  - Proceed 链接指向 `/:slug?confirm=1`, 让 redirect hot path 真正跳转并记录 analytics
  - 样式从 `src/lib/brand.ts` 注入 favicon 与 brand/action/warning 语义色; ZGZG 下 warning 用 amber, Proceed 用中性 action 色, 并提供 `Login to Claim` 入口 (`src/routes/warn.ts:51-138`)
- **`src/routes/qr.ts`** (`GET /qr/:slug.png`, `GET /qr/d/:slug.png`)
  - master-compatible QR PNG paths; `/d/` 变体加 `Content-Disposition: attachment`
  - 接受 `caption` 和 `addLogo=true`, 返回 `image/png`
- **`src/routes/api/health.ts`** (`GET /api/v1/health`) - 简单 JSON 健康检查
- `GET /healthz` (`src/server.ts`) - legacy 兼容的 uptime 监控端点 (UptimeRobot 等); 返回 200 JSON 含 version/sha/builtAt, 对应 `https://zgzg.li/healthz`、`https://zgzg.link/healthz`
- **`src/routes/api/audit.ts`** (`GET /api/v1/audit/:slug`) - requireAuth + owner-only; 返回当前链接 CREATE/UPDATE/DELETE/CLAIM/TRANSFER 审计日志, 支持 `limit` + `(timestamp,id)` cursor 分页, `VISIT` 不返回.
- **`src/routes/api/links.ts`** (`/api/v1/links`)
  - `GET /` - require JWT, 只列出当前用户链接; `owner` 只能省略或为 `me`, 支持 cursor/q/limit/tag; F12 已 drop 公开列表, `owner=public` 返回 `INVALID_INPUT`; 返回 DTO 会脱敏内部 legacy owner metadata (`src/routes/api/links.ts:187-254`)
  - `POST /` - 创建链接; 有 Bearer JWT 时写 `owner_id` 且默认 private; 匿名时走 IP+UA 限流、保存 `X-Fingerprint`, 并强制 `is_public=true` + `metadata.show_warning=true`; 可写 `metadata.description/tags/show_warning` 但匿名 show_warning 会被覆盖为 true; 写 CREATE audit; 返回 DTO 脱敏 (`src/routes/api/links.ts:257-321`)
  - `GET /claimable` - requireAuth + 精确 `@zg.io` 域；fingerprint 或 canonical legacy email 只用于发现未归属链接 (`src/routes/api/links.ts:323-362`)
  - `GET /:slug/available` - public availability check, 返回 `{ available: boolean }`; F13 `/api/v2/available/:slug` shim 复用同一语义
  - `GET /:slug` - 获取单链接, 公开返回中不包含 `metadata.legacy_author_email` (`src/routes/api/links.ts:374-388`)
  - `POST /:slug/claim` - 可信 JWT authenticated 非匿名身份、精确 `@zg.io` 邮箱；原子 UPDATE 限定 owner/deleted 为 NULL，事务内写 CLAIM audit；已有 owner 返回 409 (`src/routes/api/links.ts:390-417`)
  - `POST /:slug/transfer` - owner-only; recipient email 先 canonicalize 再查找已注册用户, 写 TRANSFER audit; 未注册 `USER_NOT_FOUND`, 自转 `SELF_TRANSFER` (`src/routes/api/links.ts:418-473`)
  - `PATCH /:slug` - 数据库 owner/admin 更新 URL、`isPublic` 和 metadata, 旧 URL 进入 `url_history`; strict metadata whitelist 允许 `description<=280`, `tags<=10` 且单 tag `<=20`, `show_warning`; 匿名链接必须先 claim 成 owner 后才能关闭 public/warning; 写 UPDATE audit; 返回 DTO 脱敏 (`src/routes/api/links.ts:476-550`)
  - `DELETE /:slug` - owner-only 软删, 写 DELETE audit
- **`src/routes/api/me.ts`** (`GET /api/v1/me`) - 通过 Supabase JWT 返回当前用户 `{ id, email, role }`
- **`src/routes/api/qr.ts`** (`GET /api/v1/qr/:slug`) - 公开 QR PNG endpoint; `format=png`, `caption<=100`, `logo=true`; 不存在/软删返回 404.
- **`src/routes/api/stats.ts`** (`/api/v1/stats`)
  - `GET /summary` - requireAuth; 查询当前用户 owned slugs 后调用 GA4 Data API, 返回 `{ totalClicks, days, source, scope }` (`src/routes/api/stats.ts:41-70`).
  - `GET /trending` - public read-only; 只接受 `range=7|30` 和 `limit<=50`, 先查 `is_public=true AND deleted_at IS NULL` 的链接, 再用这些 slug 调 GA4 path query, 返回公开热门链接 DTO (`src/routes/api/stats.ts:72-141`).
  - `POST /query` - public read-only; 受控详细查询, 只接受 `range`, `groupBy`, `limit`, `pathRegex`, `usePathPlusQueryString`, `slug?`; 无 `slug` 时查所有未删除链接并用 GA4 `pagePath` slug 格式 + reserved/system path 排除过滤, 有 `slug` 时只查该未删除 slug, 不存在/已删除返回 404 (`src/routes/api/stats.ts:143-180`).
- **`src/routes/api/v2-compat.ts`** (`/api/v2`)
  - F13 Chrome extension / master API compatibility shim.
  - `GET /link/:slug` 返回 master array shape (`goLink`, `goDest`, `destHistory`, `addLogo`, `caption`, `editable`); 非 owner 不暴露 owner email.
  - `GET /available/:slug` 返回 legacy boolean.
  - `POST /edit` 接受 `{ golink, dest, addLogo?, caption? }`; 匿名可创建, 更新 require Supabase owner Bearer JWT, 写 audit/url_history/metadata.
  - `GET /my-links` 仅支持 Supabase Bearer JWT; 旧 Auth0 cookie 不兼容.

### Middleware
- **`src/middleware/auth.ts`** - Supabase Auth JWT 验证 middleware:
  - `requireAuth`: 缺失或无效 Bearer token → 401
  - `optionalAuth`: 有 token 就验, 无 token 继续匿名
  - 首次见到 JWT `sub` 时 lazy upsert `public.users`, email 统一 `trim().toLowerCase()`, 供 `links.owner_id` / `audit_logs.actor_id` 外键使用 (`src/middleware/auth.ts:71-90`)
- **`src/middleware/audit.ts`** - `writeAudit(c, action, slug, diff?)`, 对低频 CREATE/UPDATE/DELETE/CLAIM/TRANSFER 写 `audit_logs`; `VISIT` 不写 audit.
- **`src/middleware/ratelimit.ts`** - 匿名写操作 IP+UA 内存 token bucket: 5/min + 30/hour; 已登录用户 bypass.
- **`src/lib/fingerprint.ts`** - 浏览器端 64-hex fingerprint: canvas + UA + timezone + screen; canvas 不可用时用本地持久 fallback token. 服务端只校验格式和比对已有值.
- **`src/lib/identity.ts`** - identity helper: canonical email、精确 zg.io 认领域、metadata normalize、公开 DTO 脱敏 (`src/lib/identity.ts:1-35`).
- **`src/lib/brand.ts`** - 品牌主题配置；`OPEN_GOLINK_THEME=zgzg` 时使用 `zgzg.li` 文案和 ZGZG favicon, 并区分 brand/action/warning 语义色: ZGZG 红色是品牌 accent, primary action 使用中性色 (`src/lib/brand.ts:3-116`)。
- **`src/lib/qr.ts`** - `qrcode` + `@napi-rs/canvas` 服务端 QR PNG 渲染, 支持 CJK caption、主题 logo、1h/1000-entry LRU cache, 字体来自 `src/assets/fonts/NotoSansCJKsc-Regular.otf`, 服务端 ZGZG QR logo 来自 `src/assets/img/zgzg-round-logo.png`, 默认 QR fallback 使用 brand 色。

### 数据
- **`src/db/db.ts`** - postgres-js client + Drizzle 实例. `prepare: false` 兼容 Supabase pooler.
- **`src/db/schema.ts`** - Drizzle schema, 5 张表:
  - `users` (sync 自 Supabase auth.users; `id = auth.users.id`; email 有普通 unique 和 `lower(email)` unique index) (`src/db/schema.ts:29-50`)
  - `links` (slug 主键, soft delete, url_history JSONB)
  - `audit_logs` (CREATE/UPDATE/DELETE/CLAIM/VISIT/TRANSFER)
  - `daily_visits` (UNIQUE(slug, date), 用于 analytics)
- **`src/db/migrations/0002_identity_acl_email_canonical.sql`** - apply 前阻止 duplicate canonical email, 将 `public.users.email` 规范为 lowercase/trim, 并创建 `unique_users_email_lower` (`src/db/migrations/0002_identity_acl_email_canonical.sql:1-16`).

### 前端 (SPA)
- **`src/web/`** - Vite + React 19 + react-router-dom v7. 详见 [`src/web/README.md`](../src/web/README.md).
  - `src/web/styles/tokens.css` 定义 brand/action/warning/danger 语义色; 默认主题 action alias 到橙色 brand, ZGZG 主题 action 改为中性色且保留红色 brand accent (`src/web/styles/tokens.css:20-237`).
  - `src/web/lib/brand.ts` 给浏览器和 SSG 统一解析主题, ZGZG 前端 logo/favicon 使用 Vite public path `/zgzg-round-logo.png`, 避免 SSG 输出本地文件路径 (`src/web/lib/brand.ts:1-24`)。
  - `/` Landing (`src/web/pages/Landing/`) 由 `scripts/prerender.ts` 在构建期 SSG 预渲染到 `dist/web/index.html`; 匿名创建表单需要勾选 public/warning 安全确认 (`src/web/pages/Landing/CreateForm.tsx:64-80`, `src/web/pages/Landing/CreateForm.tsx:147-180`, `src/web/pages/Landing/CreateForm.tsx:353-389`).
  - `/edit/:slug` 对不存在 slug 复用 Landing 创建流; 对已存在链接, 登录 owner 可编辑 URL / 软删, 底部展示 last 30 days stats heatmap + 折线、`UrlHistory` 与 `AuditTimeline` (`src/web/components/LinkStatsCard.tsx:22-135`).
  - `/login` / `/auth/callback` 是 Supabase magic link 登录流, 走客户端 lazy chunk; callback 优先处理 `?code=...`, 并兼容 Admin generated-link / legacy `#access_token=...` session hash.
  - `/auth/confirm` 是 Supabase TokenHash 邮件链接入口, 调 `verifyOtp` 后把 session token 交给 `/auth/callback` 的 hash-token 分支。
  - Supabase Magic Link 邮件模板维护在 `docs/email-templates/`, 分默认 Open GoLinks 和 ZGZG 两套主题, 邮件按钮使用 `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`；部署/Supabase/Resend 操作见 `DEPLOYMENT.md`。
  - `/dashboard` 由 `AuthGuard` 保护, 展示 owner 链接列表, 支持搜索、分页加载、Edit/Delete actions, 顶部嵌入 `ClaimBanner` 和 `StatsChart`; `StatsChart` 调 `/api/v1/stats/summary?days=364` 并复用 `StatsHeatmap` 把近 52 周日点击渲染为 GitHub-style heatmap, 支持完整月份标签、1 月年份标签和浮动 tooltip (`src/web/components/StatsChart.tsx:1-69`, `src/web/components/stats/Heatmap.tsx:1-163`, `src/routes/api/stats.ts:10-12`, `src/lib/ga4.ts:153-159`, `package.json:24-40`).
  - `/stats` / `/stats/:slug` 是公开只读 GA4 统计视图, 调 `/api/v1/stats/query` 展示全站或单 slug 的 path 表、path share 饼图、date heatmap + 折线, 支持 7/30/90/180 天、路径正则、pagePathPlusQueryString 切换 (`src/web/pages/Stats/index.tsx:1-295`).
  - `/trending` 是公开只读热门链接页, 调 `/api/v1/stats/trending` 展示近 7/30 天 `is_public=true` 链接的 events/users 排名 (`src/web/router.tsx:13-32`, `src/web/pages/Trending.tsx:1-153`).
  - `/claim/:slug` 是单链接认领页; 未登录时提示登录, 与 edit 页共用 ClaimOwnership，登录后返回原链接，精确 zg.io 账号可认领无主链接。
  - `/edit/:slug` 和创建成功态内嵌 QR editor; `/qr/:slug` 仍是独立 QR editor. 浏览器 canvas 实时预览 caption/logo, 下载走 `/qr/d/:slug.png`.
  - `/create` 复用 Landing 创建体验.
  - `/warn/:slug` 不再走 SPA; 由 Hono `src/routes/warn.ts` 直接返回 SSR HTML.
  - `src/web/hooks/useAuth.ts` 维护 Supabase session store, 暴露 `signInWithMagicLink`, `signOut`, `authFetch`; `src/web/hooks/useApi.ts` 封装 JSON API 请求.
  - 客户端 `src/web/main.tsx:14-32` 智能切换 `hydrateRoot` (Landing 命中预渲染) / `createRoot` (其他路径).
- 构建输出 `dist/web/`, 由 Hono `serveStatic` 在生产托管.

### 脚本 (前端构建)
- **`scripts/prerender.ts`** - SSG 入口, 由 `bun run build:web` 在 `vite build` 之后执行.
  - import `src/web/entry-ssr.tsx#renderApp("/")` 拿到 Landing HTML 字符串
  - 注入 `<title>` / `<meta>` (description / og:* / twitter:* / theme-color) + 品牌 favicon + 防闪烁主题脚本 (`scripts/prerender.ts:53-81`)
  - 写回 `dist/web/index.html`

### 脚本
- **`scripts/lib/identity-acl.ts`** - migration/repair 共享 identity helper: Supabase Admin `listUsers`, `email -> auth.users.id` resolver, silent `createUser`, public mirror upsert/remap, coverage report 和 apply 前 JSON 备份 (`scripts/lib/identity-acl.ts:63-75`, `scripts/lib/identity-acl.ts:84-121`, `scripts/lib/identity-acl.ts:155-258`, `scripts/lib/identity-acl.ts:278-358`, `scripts/lib/identity-acl.ts:368-438`).
- **`scripts/migrate-from-legacy.ts`** - MongoDB → Postgres 一次性迁移; legacy email 只映射到 Supabase Auth UUID, `"anonymous"`/无效 email 保持 `owner_id = null`, 默认不覆盖已有非空 owner, dry-run/apply 后输出 owner coverage 和 identity consistency (`scripts/migrate-from-legacy.ts:134-187`, `scripts/migrate-from-legacy.ts:222-295`, `scripts/migrate-from-legacy.ts:313-383`).
- **`scripts/inspect-mongo.ts`** - 检查源数据形态
- **`scripts/reconcile-legacy-owners.ts`** - Identity ACL repair: dry-run 扫描 synthetic `public.users`, apply 前备份 `users/links/audit_logs`, transaction 中 remap 到真实 Auth user 或置空 owner/conflict (`scripts/reconcile-legacy-owners.ts:93-165`, `scripts/reconcile-legacy-owners.ts:167-218`).
- **`docs/troubleshooting/identity-acl-data-cleanup.md`** - 记录 Identity ACL 生产数据清理注意事项；`links` 表以 `slug` 为主键，一次性备份/修复脚本不能假设存在 `id` 列。

### 测试与视觉资产
- **`tests/e2e/*.test.ts`** - Bun e2e 回归测试, 覆盖 API / route 行为, 不依赖前端构建。
- **`tests/browser/*.spec.ts`** - Puppeteer + 系统 Chrome 的生产/浏览器 smoke tests; `tests/browser/readme-tour.spec.ts` 是可选截图用例, 由 `CAPTURE_README_TOUR=1` 开启, 本地构建前端并启动 Vite preview、mock API/SSR 数据, 写入 `docs/assets/readme-tour.gif` (`tests/browser/readme-tour.spec.ts:12-29`, `tests/browser/readme-tour.spec.ts:223-267`, `tests/browser/readme-tour.spec.ts:413-492`)。

### 外部服务
- **`src/lib/gcp.ts`** - 启动时把 `GOOGLE_APPLICATION_CREDENTIALS_JSON` 写到 `/tmp/open-golinks-gcp-key.json`, 供 Google SDK 使用.
- **`src/lib/ga4.ts`** - GA4 Data API summary/detail 查询 + Measurement Protocol `page_view` 上报 helper.

## 数据流

### 短链重定向 (hot path)
1. 用户访问 `https://go.example.com/abc`
2. Cloudflare CDN cache miss → 转 Railway
3. Hono `redirect.ts:slug` handler
4. Drizzle 查 `links WHERE slug=$1 AND deleted_at IS NULL`
5. 命中 → 返回 302 (响应已 flush 给客户端)
6. 异步: 事务内累加 `links.visits` + UPSERT `daily_visits`; fire-and-forget 上报 GA4 `page_view`

### 创建短链
1. 用户在 Landing (或 `/edit/<slug>`, slug 自动预填) 填表; 浏览器计算 fingerprint, SPA POST `/api/v1/links` JSON `{slug, url}` + `X-Fingerprint`
2. Hono `links.ts` zod 校验; 登录请求忽略 fingerprint 并写 `owner_id`, 匿名请求保存 `created_by_fingerprint`, 强制 `is_public=true` 和 `metadata.show_warning=true`
3. INSERT, 唯一约束失败 (Drizzle 把 PG 的 23505 包成 `DrizzleQueryError`, 从 `err.cause.code` 解出) 返回 `SLUG_TAKEN` 409
4. 客户端拿到 409 后, 自动生成的 slug 重试一次; 用户自定义的 slug 则在表单内提示
5. 已登录请求写 `owner_id` 且默认 private; 匿名请求进入 IP+UA rate limit, 创建后可由 @zg.io 登录账号 claim, claim 成 owner 后才可关闭 public/warning; CREATE 写 `audit_logs`

### Warning interstitial
1. Owner 在 `/edit/:slug` 勾选 `WarnToggle`, PATCH `/api/v1/links/:slug` body `{ metadata: { show_warning: true } }`
2. 访客访问 `/:slug`, redirect handler 发现 `metadata.show_warning` 且没有 `?confirm=1`, 返回 302 `/warn/:slug`
3. `/warn/:slug` SSR HTML 展示目标 URL, 不加载 SPA assets; warning 视觉使用 amber, Proceed 按钮使用 action token 而不是品牌红色, 并提供 `Login to Claim` 指向 `/claim/:slug`
4. 用户点 Proceed 访问 `/:slug?confirm=1`, redirect handler 跳过 warning, 返回目标 URL 302 并记录 visits/GA4

### Audit history
1. Owner 打开 `/edit/:slug`, 页面确认当前用户拥有该链接
2. `AuditTimeline` 调 `GET /api/v1/audit/:slug?limit=20`
3. 后端先校验 `links.owner_id = JWT sub`; 非 owner 403, 不存在/已删除 404
4. 返回按 `timestamp DESC, id DESC` 排序的审计日志, `UPDATE` 等带 diff 的事件可在 UI 展开查看 JSON
5. `Load more` 用 base64url cursor 继续取下一页

### URL history
1. Owner 在 `/edit/:slug` 保存新目标 URL
2. `PATCH /api/v1/links/:slug` 把旧 URL 追加到 `links.url_history` (`{ url, changedAt, changedBy }`)
3. Edit 页 `UrlHistory` 直接使用 `GET /api/v1/links/:slug` 返回的 `urlHistory`, newest-first 展示历史目标 URL
4. 旧数据若不是数组或条目缺少 `url`, 前端 normalize 后忽略, 显示 "No previous URLs" 而不崩溃

### Ownership transfer
1. Owner 在 `/edit/:slug` 的 Danger zone 输入接收方 email 并确认
2. `POST /api/v1/links/:slug/transfer` 要求接收方已登录过并存在于 `public.users`
3. 后端校验当前用户仍是 owner, 更新 `links.owner_id`, 写 `audit_logs.action = TRANSFER`
4. 发起方立即失去 owner 权限; 接收方的 `/dashboard` 可看到该链接

### QR code
1. 用户在 `/edit/:slug` 或 `/qr/:slug` 中看到 `QrCanvas` 实时预览短链 QR; 创建成功态也显示可下载 QR
2. `caption` / `addLogo` 作为 link `metadata` 保存; `/qr/*.png` 未传 query 时读取已保存设置
3. 下载按钮指向 `/qr/d/:slug.png?caption=...&addLogo=true`
4. 兼容旧路径 `/qr/:slug.png` 返回 inline PNG; `/qr/d/:slug.png` 返回 attachment PNG
5. 服务端 QR PNG 始终编码短链 URL (`PUBLIC_BASE_URL` 或请求 origin + `/:slug`), 不直接编码 destination URL

### Detailed analytics
1. 任何用户访问 `/stats` 或 `/stats/:slug`
2. SPA 并行 POST 两次 `/api/v1/stats/query`: 一次 `groupBy=path`, 一次 `groupBy=date`
3. 后端查未删除 links: `/stats` 注入全站 slug scope 并用 GA4 `pagePath` slug 格式过滤, 同时排除 `/healthz`、`/dashboard`、`/stats` 等 reserved/system path; `/stats/:slug` 只保留目标 slug, 不存在/已删除返回 404
4. `src/lib/ga4.ts#queryStatsForSlugs` 用 GA4 Data API 查询 `page_view`; 可选用户 `pathRegex` 只作为额外过滤条件, 不暴露任意 GA4 passthrough
5. SPA 渲染 path 表、path share 饼图、day heatmap 与 day 折线; 空数据展示 "No data yet", GA4 错误降级为页面 alert

### Trending discovery
1. 任何用户访问 `/trending`
2. SPA 调 `GET /api/v1/stats/trending?range=7|30&limit=20`
3. 后端只查询 `links.is_public=true AND deleted_at IS NULL`, 用这些 slug 构造 GA4 `pagePath` in-list scope 后查询排名
4. 返回 DTO 只包含 slug、url、description、eventCount、activeUsers; owner、legacy metadata、fingerprint 等内部字段不返回
5. SPA 渲染公开热门链接列表; 空结果显示 "No public trending links yet"

### 匿名链接认领
1. 匿名创建成功后, 链接已强制 public + warning; 客户端把 `{ slug, fingerprint }` 记入 `localStorage('golinks:created')`
2. 用户登录后进 `/dashboard`, `ClaimBanner` 计算当前浏览器 fingerprint 并调 `GET /api/v1/links/claimable?fingerprint=<64hex>`
3. 后端先检查 @zg.io 域，再返回两类未归属链接: `created_by_fingerprint` 匹配, 或 canonical `metadata.legacy_author_email` 等于当前用户 email
4. 用户点击 Claim 后, `POST /api/v1/links/:slug/claim` 用单条原子 UPDATE 写 `owner_id`, 仅可信 @zg.io 身份且 `owner_id IS NULL`、未删除才成功，并在同一事务记录 CLAIM audit
5. Dashboard reload 后, 被认领链接通过 `GET /api/v1/links?owner=me` 出现在 owner 列表

## 环境变量

| 变量 | 必需 | 说明 |
|---|---|---|
| `DATABASE_URL` | ✅ | Supabase Postgres 连接串 (用 pooler `:6543`) |
| `PORT` | - | Railway 自动注入, 本地默认 3000 |
| `NODE_ENV` | - | `production` 时托管 SPA |
| `SUPABASE_JWKS_URL` | ✅ | JWT 验证 JWKS URL |
| `SUPABASE_JWT_ISSUER` | ✅ | JWT issuer 校验 |
| `SUPABASE_URL` | 迁移/repair | Supabase Auth Admin API project URL；可由 `VITE_SUPABASE_URL` fallback |
| `SUPABASE_SECRET_KEY` | 迁移/repair | Supabase service-role/Admin key；可由 `SUPABASE_SERVICE_ROLE_KEY` fallback |
| `VITE_SUPABASE_URL` | ✅ | 前端 Supabase client URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | ✅ | 前端 Supabase publishable key |
| `VITE_BASE_URL` | ✅ | magic link redirect base URL；生产切域名时必须和 canonical origin 保持一致 |
| `PUBLIC_BASE_URL` | ✅ | GA4 `page_location` / 完整短链 base URL；生产 canonical origin |
| `OPEN_GOLINK_THEME` | - | 品牌主题, 默认 `open-golinks`; 设为 `zgzg` 时启用 ZGZG 文案、logo 与品牌/accent 色 |
| `GA4_MEASUREMENT_ID` | ✅ | Measurement Protocol |
| `GA4_API_SECRET` | ✅ | Measurement Protocol |
| `GA4_PROPERTY_ID` | ✅ | GA4 Data API |
| `GOOGLE_APPLICATION_CREDENTIALS_JSON` | ✅ | GCP service account JSON |
| `TURNSTILE_SECRET_KEY` | 待用 | 创建链接的 bot 防护 |
| `TURNSTILE_SITE_KEY` | 待用 | 前端嵌入 |

## 启动流程

1. Bun 加载 `src/server.ts`
2. import `./routes/redirect.ts`, `./routes/api/*` 触发 db.ts 加载 → 检查 `DATABASE_URL`
3. Hono app 注册路由
4. `default { port, fetch }` 让 Bun 监听
5. Railway healthcheck 命中 `/api/v1/health` 后开始接流量

## 当前未实现 (TODO)

- Turnstile 校验
- CI/CD (GitHub Actions → Railway)

编辑页直接展示目标、描述、标签及访问开关，二维码与自定义放置于窄侧栏；统计直接展示，仅历史和管理使用 details。手机上改为顺序布局。主题 token 和字体保持原样，Go 保留 redirect / warning / analytics 流程 (`src/web/pages/Edit.tsx:254-453`)。

## 已批准体验原型（独立运行）

- 独立入口与共享主题：`demos/proposed-changes/main.tsx:1-14`；独立 Vite 配置，不进入生产构建。
- 提交、直接编辑与审核编排：`demos/proposed-changes/ProposalDemo.tsx:17-134`。仅 URL/description 可由访客提议，当前链接在通过前不变。
- 虚构元数据和场景：`demos/proposed-changes/model.ts:54-138`。权限模拟、冲突检查和仅应用差异字段：`demos/proposed-changes/model.ts:139-174`。
- diff、原生元数据对话框及审核卡：`demos/proposed-changes/Review.tsx:12-252`。近似位置与未知位置均为静态示意，无真实采集。
- 拒绝保留独立结果，历史包含提议人、审核人、提交/审核时间与前后值。
- 运行、边界与验证见 [`demos/proposed-changes/README.md`](../demos/proposed-changes/README.md)。用户于 2026-09-15 批准，正式实现见下。

- 极简字段 diff：`src/web/components/proposals/InlineDiff.tsx:1-46`，复用 Namefi 的共同前后缀、灰色删除线与普通文字新值规则；字段布局及完整前后值的读屏名称位于 `demos/proposed-changes/Review.tsx:12-52`。

## 真实变更提议

- HTTP 边界：`src/routes/api/proposals.ts:1-39`；列表/详情：`src/lib/proposals/read.ts:1-101`；提交：`src/lib/proposals/submit.ts:1-74`；审核事务：`src/lib/proposals/review.ts:1-93`。
- Migration 0003 新增提议、版本 trigger 和 RLS。链接、提议、URL history、审计在审核事务内原子变更；任何内容/权限/删除变化使旧提议过期，visits 不影响 revision。普通 PATCH 用 revision CAS 避免覆盖并发审核。
- Admin 来自数据库 users.role；匿名 cookie 仅用于本人列表，不授予审核权限。元数据单独鉴权，30 天到期后每小时清理。运行参数与代理信任见 [发布说明](./runbooks/proposed-changes.md)。
- UI：src/web/components/proposals/。Proposals 编排提交、分页与审核，Diff/InlineDiff 使用 Namefi 规则，MetadataDialog 保持键盘焦点。owner 草稿未保存时阻止审核。
- 生产静态内容使用 src/middleware/static-compression.ts 协商压缩；Edit 统计图有数据时才下载，避免阻塞提议首屏。
- 独立测试：tests/proposals/ 使用本地 PostgreSQL、签名 JWT 和真实浏览器操作，不连生产服务。

静态压缩使用异步 node:zlib gzip/deflate，不依赖生产 Bun 未提供的 CompressionStream；见 middleware/static-compression.ts 与压缩回归测试。

二维码外围总留白缩为原来的约 1/3，保持画布尺寸并扩大码体；预览与导出一致。

编辑页改为 Details / History / Stats / QR Code tabs；所有访客可编辑 URL/描述后提议，owner/admin 可直接保存。PATCH 锁定链接并从数据库核对角色；移动端复用同一表单状态。

提交前显示身份关联提示。新登录提议保存邮箱/account ID 私有详情；匿名提议保留原 IP/浏览器详情。限流 IP 哈希不变，旧详情仍按 30 天过期。

提议支持 tags；普通访客使用独立 Proposals tab。owner/admin History 显示操作者、提议者和未过期匿名 IP/位置/浏览器/OS；普通访客仍只能查看自己的提议状态。

Publish（Public listing）支持提议开启或关闭，仅审批后更新 isPublic；旧提议未含此字段时保持现有设置。

基本信息为连续表单；提议先通过 ProposalConfirmation 确认差异与身份关联，再发 POST。取消不会丢失草稿。

History 合并为一份变更记录，避免提议历史/URL 历史/审计重复展示同一次修改。

提议确认弹窗读取当前请求的身份预览 API，展示实际 IP、浏览器/OS 及可展开 User-Agent；登录时改为账号身份。

Railway startCommand 显式启用 PROPOSAL_TRUST_PROXY=railway；非 Railway 启动保持默认不信任代理头。

## 无主链接与 slug 复制（2026-09-15）

- Edit/Claim → ClaimOwnership → 同一个 claim API；通用登录及 owner/admin Save、其他人 Propose change 规则不变。
- 认领返回后仅同步 owner 和这次操作的一个 revision，保留草稿；其他并发内容更新仍会触发 Save 冲突。认领后焦点移到 slug。
- ShortLinkActions 中 slug 和图标共用 canonical VITE_BASE_URL 复制；原生按钮、44px 触控、aria-label/title 与简短 live 反馈。Go 独立导航。
- AuthCallback 优先使用经过白名单校验的 next；旧 confirm 模板在同浏览器新 tab 使用 30 分钟 localStorage 回跳记录，跨设备回 Dashboard。见 `src/web/lib/authReturn.ts:1-22` 和 `docs/troubleshooting/claim-login.md`。

```mermaid
flowchart LR
  EditClaim[Edit / Claim] --> ClaimUI[ClaimOwnership]
  ClaimUI --> Login[Login + safe next]
  Login --> Supabase[Supabase Auth]
  Supabase --> Callback[AuthCallback]
  Callback --> EditClaim
  ClaimUI --> JWT[Verified JWT zg.io gate]
  JWT --> CAS[Owner NULL update + audit transaction]
  SlugIcon[Slug / Copy icon] --> Clipboard[Canonical URL + live feedback]
```
