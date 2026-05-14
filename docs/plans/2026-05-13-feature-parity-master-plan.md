# v2-hono 对齐 master 功能总计划

**Date**: 2026-05-13
**Duration**: P0 ≈ 4 周; P1 再 ≈ 2 周; P2 视反馈
**Priority**: P0
**Status**: 📋 Planning

## Overview

`v2-hono` 重写已完成骨架与基础设施 (历史见已归档的 [`2026-05-07-v2-hono-rewrite-phase-1`](./archived/2026-05-07-v2-hono-rewrite-phase-1.md), 当前架构见 [`../CURRENT-ARCHITECT.md`](../CURRENT-ARCHITECT.md)),
但相对 `master` 仍缺少大量用户可见功能. 本计划列出对齐 master 所需的全部功能,
并把每个功能 (或紧密相关的功能集) 拆成独立的实施 sub-plan, 以便:

- 在切换生产流量前明确"哪些功能必须有, 哪些可以延后"
- 每个 feature set 可被独立 PR / 独立 sub-plan 跟踪
- 不丢失 master 已有的产品能力

> Master vs v2-hono 详细对比见本文档末尾 "附录 A".

## Deliverables

1. **每个 P0/P1 feature 的独立 sub-plan 文件** —
   `docs/plans/<YYYY-MM-DD>-<F-id>-<short-name>.md`, 内含 endpoint shape /
   DB 改动 / UI 草图 / 测试用例
2. **可上线的 v2-hono 服务**, 全部 P0 (F1–F5) 功能可用并经 e2e 覆盖
3. **Legacy ownership reconciliation** — 数据已 dump 到 Supabase Postgres, 后续不再跑全量迁移; 需要补 owner/email 映射校验与 legacy claim/backfill runbook
4. **生产切流 runbook** (`docs/runbooks/v2-cutover.md`) —
   DNS / 双跑 / 回滚步骤
5. **架构文档更新** (`docs/CURRENT-ARCHITECT.md`) — 完工后同步

## Implementation Steps

1. **W0 (本周)**: 评审本主计划; ✅ GA4/GCP 4 个凭据已在本地 `.env`; ✅ 本地 3 个 `VITE_*` 已补, Railway 待 F1 推; ✅ 浏览器验证工具已定 (Puppeteer + 系统 Chrome, headless, 见 SOP 步骤 6); 跑老链接 owner_id / legacy author email 覆盖率 SQL; F7 Bun + `@napi-rs/canvas` spike; F13 Chrome ext spike

> 之后的 W1-W6 每一项都要遵循"Per-Feature 推进 SOP" — 不是"本周做完 F1+F2", 而是"F1 走完 7 步再开始 F2".
2. **W1**: 实施 F1 (auth UI) + F2 (CRUD + audit + ratelimit), 合并 + e2e 绿
3. **W2**: 实施 F3 (dashboard) + F4 (基础 stats + GA4 双向接入); 评估 F6 /warn 是否升回 P0; 验证 GA4 测试 property 工作正常
4. **W3**: 实施 F5 (claim + legacy ownership reconciliation) + F7 (QR)
5. **W4**: 实施 F8 (详细 stats 移植 master) + F9 + F10; 演练切流; **决策 F12 do/drop**; **切换生产 DNS**
6. **W5–W6**: P1 收尾 (F6, F11, F14) + 用户反馈; 评估 cookie banner / GDPR; 决定 F12 是否做

## 🚨 Per-Feature 推进 SOP (Definition of Done)

> **强制流程, 不可跳步.** 任何 P0/P1 feature 都不算完成, 直到下面 7 步全跑完. 在前一个 feature 全绿之前**不开始**下一个.

| # | 步骤 | 验收标准 |
|---|---|---|
| 1 | **本地实现** | TypeScript `bun run type-check` 通过; 本地 `bun --hot src/server.ts` 起得来 |
| 2 | **本地 e2e** | `bun test tests/e2e/F<N>-*.test.ts` 全绿 |
| 3 | **commit + push** | commit message 前缀 `[F<N>]`; 推到 `v2-hono` branch 自动触发 Railway deploy |
| 4 | **同步 Railway env** | 用 `railway variables --set "<KEY>=<value>" --service open-golinks-v2-hono --environment production` 推该 feature 引入的新 env (按 Prerequisites 表的"同步时机"). 值不经 stdout (CLI 内部处理) |
| 5 | **等 deploy 绿** | `railway status` 或 `railway logs --deployment` 监听; deployment status = `SUCCESS`. 失败则修, 不允许带病进下一步 |
| 6 | **浏览器验证生产** | 在 **`https://open-golinks-v2-hono-production.up.railway.app`** 用 browser tool 实际过一遍 feature 的 golden path + ≥ 1 个 edge case. 检查: (a) UI 行为正确; (b) browser console 无 error; (c) Network 面板无 5xx; (d) `/api/v1/version` 返回的 commit SHA = 刚 push 的 SHA (确认拿到的是新代码不是缓存) |
| 7 | **关闭 feature ticket / 更新 README** | 在 `docs/plans/README.md` 的 feature checklist 上勾选 ✓; 更新 `docs/CURRENT-ARCHITECT.md` 反映新代码; 整理 `tests/e2e/F<N>` 和 `tests/browser/F<N>` 留作回归 |

### 浏览器验证 (步骤 6) 工具

**已定 (2026-05-13)**: **Puppeteer (puppeteer-core) + 系统 Chrome + headless**, 脚本放 `tests/browser/F<N>.spec.ts` 用 `bun test` 跑.

配置:

```ts
// 不下载 puppeteer 自带 Chromium, 用系统 Chrome
// package.json: { "dependencies": { "puppeteer-core": "^23.x" } }
// (PUPPETEER_SKIP_DOWNLOAD 不再需要 — puppeteer-core 默认不下载)

import puppeteer from 'puppeteer-core';
const CHROME_PATH = process.platform === 'darwin'
  ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  : '/usr/bin/google-chrome'; // Linux / Railway 容器
const browser = await puppeteer.launch({
  executablePath: CHROME_PATH,
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});
```

理由 (vs Playwright):
- 包小 ~10MB (vs Playwright ~200MB), 不下载额外 browser
- 直接走 CDP, 调试时能 fallback 到 raw 命令
- v2-hono 仅 Chromium 一种用户场景, 不需要多 browser 矩阵
- 跟 `bun test` 集成顺滑, 跟 `tests/e2e/` 风格一致

每个 P0/P1 feature 必须留 `tests/browser/F<N>.spec.ts` 可重复脚本, 为切流后回归.

### Build SHA 校验 (步骤 6.d)

`/api/v1/version` 端点已存在 (`src/routes/api/version.ts`), 返回当前部署 commit SHA 等信息. 验证脚本必须断言:

```typescript
const v = await fetch(`${PROD_URL}/api/v1/version`).then(r => r.json());
expect(v.commit).toBe(process.env.GITHUB_SHA || lastLocalCommit);
```

这一步是为了防止"浏览器拿到旧 build, 验证假绿". Railway 的 CDN / 浏览器 cache 都可能搞这事.

### 中途失败处理

- 步骤 2 (本地 e2e) 红 → 修代码, 不 push
- 步骤 5 (deploy) 红 → 看 `railway logs`, 大概率是 env 漏配或 build 错; 修后重 push
- 步骤 6 (浏览器验证) 红 → **不要 patch 上去就跑** — 写一个新的 e2e/browser 测试覆盖这个 case (符合 `feedback_bug_to_e2e`), 然后修
- 任何一步遇到生产事故 → 走 Risks 表的回滚方案

### 新增顶层路由的保留路径规则

`redirect.ts` 会把 `GET /:slug` 当短链处理; 任何新增 SPA 顶层路径或 SSR 顶层路径都必须同时完成:

1. 把路径第一段加入 `src/routes/redirect.ts` 的 `RESERVED` set
2. 更新 `tests/e2e/reserved-slug-fallthrough.test.ts` 的 `EXPECTED_RESERVED`
3. 在对应 feature 的 browser test 中直接访问该路径, 确认不会被当成 slug 跳 `/edit/<slug>`

当前已知后续会新增的顶层路径: `/login`, `/claim`, `/qr`, `/stats`, `/browse` (若 F12 = Do). `/auth` 已在 RESERVED 内, 覆盖 `/auth/callback`.

### 与 master 双跑期 (W4 切流前)

- W3-W4 期间, master 在原生产域名跑, v2-hono 在 `*.up.railway.app` 跑
- 浏览器验证步骤 6 都跑在 v2-hono Railway 域名上, 不动 master
- W4 切 DNS 后, "生产" = v2-hono 域名

---

## 高层栈选型 (沿用 archived v2-hono-rewrite 决策, 不再变更)

| 维度 | 选型 | 理由 |
|---|---|---|
| Runtime | Bun (Node 20 兜底) | 启动快, Hono 跨 runtime |
| Web 框架 | Hono | 路由极简, edge/node 通用 |
| 数据库 | Supabase Postgres + Drizzle ORM | SQL analytics, 迁移脚本已写 |
| 认证 | Supabase Auth (JWT) | 替代 master 的 Auth0 |
| 前端 | Vite + React 19 SPA (landing 走 SSR) | 单容器托管, 无 RSC 开销 |
| 路由 | React Router | 已在用 |
| 样式 | CSS modules + tokens (`src/web/styles/`) | 已在用, 不引入 Tailwind |
| 部署 | Railway (us-west2) | 永远在线, 无冷启动 |
| 图表库 | recharts (待引入) | master 用 ECharts (`vue-echarts`), 切到 React 生态 |
| QR 生成 | `qrcode` (npm) | 服务端 PNG + 客户端 canvas |
| 反滥用 | ~~Cloudflare Turnstile~~ → **暂缓 (P2 评估)**; 用 IP+UA token bucket 兜底 | 不引入外部依赖, 单容器内存计数即可 |
| **Analytics 数据源** | **GA4 Data API (读) + Measurement Protocol (写)**, 沿用 master | 保留几年历史数据连续性; event_name 默认继续用 master 的 `page_view`, 通过 params 标记 v2-hono; daily_visits 仍写但作为冷备 |
| **GA4 SDK (后端)** | `@google-analytics/data` | 移植自 master |
| e2e (API 级) | `bun test tests/e2e/` | Bun 内置, 跟现有 `tests/e2e/` 一致 |
| 浏览器验证 (E2E) | **Puppeteer (puppeteer-core) + 系统 Chrome + headless**, `bun test tests/browser/` | 轻量 (~10MB), CDP-based, F1 落地前装 |

## V0 已有基础 (避免重复造轮子)

> 写 sub-plan 时请先确认对应实现, 不要重复创建.

| 能力 | 现状 | 位置 |
|---|---|---|
| Drizzle schema | **已完整** — `users` / `links` / `audit_logs` / `daily_visits` 全部字段就绪 (deletedAt, urlHistory, metadata, createdByFingerprint, isPublic) | `src/db/schema.ts` |
| JWT 验证 + 用户落库 | **已实现** — `requireAuth` / `optionalAuth`, 首次见到 JWT 时 lazy `ensureUserRow` upsert public.users (不需要 webhook/触发器) | `src/middleware/auth.ts:70-82` |
| `GET /api/v1/me` | **已实现** | `src/routes/api/me.ts` |
| Redirect + 异步访问计数 | **已实现** — 不存在的合法 slug → `/edit/:slug`; 命中后 queueMicrotask 异步 update `visits` + UPSERT `daily_visits` + fire-and-forget GA4 `page_view` | `src/routes/redirect.ts` |
| `POST /api/v1/links` (create) | **已实现** — 登录写 `owner_id`; 匿名写 `created_by_fingerprint`; CREATE audit; 匿名限流 | `src/routes/api/links.ts` |
| `GET /api/v1/links` (public / owner list) | **已实现** — `owner=me` requireAuth, cursor/q/limit; 默认公开列表 | `src/routes/api/links.ts` |
| `GET /api/v1/links/:slug` | **已实现** | `src/routes/api/links.ts` |
| `GET /api/v1/links/claimable` / `POST /api/v1/links/:slug/claim` | **已实现** — fingerprint claim + legacy author email claim | `src/routes/api/links.ts` |
| Landing 页 SSR | **已实现** | `src/web/pages/Landing/` |
| Edit/Create/Dashboard/Claim 页面 | **已实现** | `src/web/pages/{Edit,Create,Dashboard,Claim}.tsx` |

**已知 gap (不属于任何单一 feature)**:

- Redirect 命中时没写 audit_logs.VISIT 事件 (只更新计数). **决定: VISIT 不进 audit_logs**, 因为高频事件会撑爆表, 且 GA4 已有完整 page_view 数据. `audit_logs.action` enum 中的 `VISIT` 值保留但实际不使用.
- `POST /api/v1/links` 已写 `audit_logs.CREATE`; F5 追加匿名 `created_by_fingerprint`.
- `src/lib/` / `src/web/{components,hooks,lib}/` 已由 F1-F5 落地.
- `redirect.ts` 已接 GA4 Measurement Protocol 上报.

## 文件夹决策

沿用 v2-hono 现有结构, 新功能落位规则:

```
src/
├── db/
│   ├── schema.ts              # Drizzle schema (已有所有表, 部分未用)
│   └── migrations/
├── middleware/
│   ├── auth.ts                # Supabase JWT 解析, c.set('userId')
│   ├── ratelimit.ts           # ← 新增: IP+UA token bucket (内存, 替代 Turnstile)
│   └── audit.ts               # ← 新增: 写 audit_logs 的统一 helper
├── routes/
│   ├── redirect.ts            # /:slug 主重定向
│   ├── warn.ts                # ← 新增: /warn/:slug SSR 警告页
│   ├── qr.ts                  # ← 新增: /qr/:slug.png master 兼容 QR 路由
│   └── api/
│       ├── health.ts
│       ├── version.ts
│       ├── me.ts              # 当前用户 (已有)
│       ├── links.ts           # CRUD (扩展 PATCH/DELETE/claim/transfer)
│       ├── audit.ts           # ← 新增: GET /api/v1/audit/:slug
│       ├── stats.ts           # ← 新增: scoped stats endpoints (内部调用 GA4 Data API)
│       └── qr.ts              # ← 新增: GET /api/v1/qr/:slug
├── lib/
│   ├── slug.ts                # slug 校验/生成
│   ├── fingerprint.ts         # 匿名指纹哈希
│   └── qr.ts                  # QR 渲染 (服务端复用)
└── web/
    ├── pages/
    │   ├── Landing/           # 已有
    │   ├── Dashboard.tsx      # ← 重写 (链接列表 + stats)
    │   ├── Stats/             # ← 新增: 详细 analytics 页
    │   ├── Login.tsx          # ← 新增
    │   ├── Create.tsx         # 已有 stub, 待完善
    │   ├── Edit.tsx           # 已有 stub, 待完善
    │   ├── Claim.tsx          # ← 新增: 匿名链接认领
    │   └── QrEditor.tsx       # ← 新增: QR 编辑+下载
    ├── components/
    │   ├── LinkRow.tsx
    │   ├── StatsChart.tsx
    │   ├── QrCanvas.tsx
    │   └── AuthGuard.tsx
    ├── hooks/
    │   ├── useAuth.ts
    │   └── useApi.ts
    └── lib/
        └── supabase.ts

tests/e2e/
├── reserved-slug-fallthrough.test.ts   # 已有
├── F1-auth.test.ts                     # ← 新增
├── F2-link-crud.test.ts                # ← 新增
└── ...                                 # 每个 P0/P1 feature 至少一个 e2e
```

约定:

- API 路由文件名 = 资源名 (复数), method 在文件内分发
- 所有写操作必须经 `middleware/audit.ts` 写 audit_logs
- 前端"页面级"组件放 `web/pages/`, 可复用组件放 `web/components/`
- 每个 P0/P1 feature 在合并前必须有对应 e2e 测试 (符合 `feedback_bug_to_e2e`)

## 功能 Checklist

> 完整对比见附录 A. 此处仅列需要实装的项, 按优先级排序.

### 🔴 P0 - 切流前必须有

- [x] **F1. 用户认证 + 登录 UI** — Supabase Auth 替代 Auth0
- [x] **F2. 链接编辑 (PATCH) + 删除 (软删) + 统一 audit** — master 有, v2-hono 仅有 POST; 顺便补齐 CREATE audit 写入; VISIT 明确不进 audit
- [x] **F3. 个人链接列表 (User Dashboard)** — 对应 master `user-links.vue`
- [x] **F4. 基础 stats dashboard** — 日访问折线 + 总点击
- [x] **F5. 匿名链接认领 (Claim)** — master 关键差异化功能

### 🟡 P1 - 切流后 1 个月内补齐

- [ ] **F6. /warn/:slug 警告页** — 标记敏感链接的拦截页 (master 是否有未确认, 视为 v2-hono 新增)
- [ ] **F7. QR 码生成 / 显示 / 下载** — 对应 master `QrCodeEditor.vue`
- [ ] **F8. 详细 Analytics 页** — 时间范围, slug 正则过滤, 多图表
- [ ] **F9. 审计日志查看 (`/api/v1/audit/:slug`)** — schema 已有, API 缺失
- [ ] **F10. 链接 URL 历史展示** — schema 已有

### 🟢 P2 - 长尾, 视用户反馈

- [ ] **F11. 链接所有权转移 (Transfer)**
- [ ] **F12. 公开链接发现页 (Browse Public Links)** — master 无, 新功能 (决策 deadline: W4 末)
- [ ] **F13. Chrome Extension 兼容性验证** (W1 必须先 spike 一次, 决定走 shim 还是发新版)
- [ ] **F14. 链接 metadata (tags, description)** — schema 已有

---

## 各功能 Sub-Plan

> 每个 feature 一个独立 sub-plan, 详述 API shape / DB 改动 / UI 草图 / 测试用例 / DoD checklist.
>
> ⚠️ **所有 P0/P1 feature 落地必须严格遵循 [🚨 Per-Feature 推进 SOP](#-per-feature-推进-sop-definition-of-done)** —— 本地实现 → 本地 e2e → push → Railway env 同步 → 等 deploy 绿 → **生产域名浏览器验证** → 关闭 ticket. 7 步缺一不可, 前一个 feature 全绿前不开始下一个.

### 🔴 P0 (切流前)

- **[F1. 用户认证 + 登录 UI](./2026-05-13-F1-auth-and-login.md)** (3 天) — Supabase magic link + JWT session 感知; 不新增后端 API, 主要是前端 + AuthGuard 路由保护
- **[F2. 链接 CRUD + audit + ratelimit](./2026-05-13-F2-link-crud-audit-ratelimit.md)** (3 天) — PATCH / DELETE + 软删 + 统一 audit middleware + IP+UA 内存 token bucket 限流 (替代 Turnstile)
- **[F3. 个人链接列表 Dashboard](./2026-05-13-F3-user-dashboard.md)** (3 天) — `?owner=me` 分页 + 搜索 + LinkRow + 空状态 CTA
- **[F4. 基础 Stats + GA4 上报](./2026-05-13-F4-basic-stats-ga4.md)** (2.5 天) — 移植 master GA4, scoped stats endpoint, redirect fire-and-forget `page_view` 上报, recharts 折线
- **[F5. 匿名链接认领 (Claim)](./2026-05-13-F5-anonymous-claim.md)** (3 天) — fingerprint claim + legacy email ownership reconciliation + Dashboard banner + 单链接认领页

### 🟡 P1 (切流后 1 月内)

- **[F6. /warn/:slug 警告页](./2026-05-13-F6-warn-page.md)** (1.5 天) — SSR 最小 HTML warning page + Edit 页 toggle
- **[F7. QR 码生成 / 下载](./2026-05-13-F7-qr-codes.md)** (3 天 + 0.5 W0 spike) — 移植 master, CJK caption, NotoSansCJK 字体
- **[F8. 详细 Analytics 页](./2026-05-13-F8-detailed-analytics.md)** (3 天) — 移植 master `dashboard.vue` → React, 复用 F4 GA4 端点, ECharts → recharts
- **[F9. 审计日志查看](./2026-05-13-F9-audit-log-view.md)** (1.5 天) — Edit 页底部 timeline, owner-only
- **[F10. URL 历史展示](./2026-05-13-F10-url-history-display.md)** (0.5 天) — 纯 UI, 后端无改动

### 🟢 P2 (长尾, 视用户反馈)

- **[F11. 所有权转移 (Transfer)](./2026-05-13-F11-ownership-transfer.md)** (1.5 天) — `POST /:slug/transfer { toEmail }`, 接收方必须先注册
- **[F12. 公开链接发现 (Browse)](./2026-05-13-F12-public-link-browse.md)** (TBD) — **W4 末决策 do/drop**; do 则 2 天
- **[F13. Chrome Extension 兼容性](./2026-05-13-F13-chrome-extension-compat.md)** (2 天 含 W0 spike) — shim / 发新版 / 弃用三选一
- **[F14. 链接 metadata (tags, description)](./2026-05-13-F14-link-metadata.md)** (2 天) — JSONB tags + description + Dashboard tag 过滤

---

## Timeline 汇总

| 周 | 内容 |
|---|---|
| W0 | 创建各 sub-plan 文件; F13 Chrome Ext spike (1 天); F7 Bun + `@napi-rs/canvas` spike (0.5 天) |
| W1 | F1 (auth) + F2 (CRUD + audit 统一收口) |
| W2 | F3 (dashboard) + F4 (基础 stats); 跑 legacy owner/email 映射 dry-run |
| W3 | F5 (claim + legacy ownership reconciliation) + F7 (QR) |
| W4 | F8 (详细 stats) + F9 + F10; 演练切流; **决策 F12 do/drop**; **切换生产 DNS** |
| W5–W6 | F6 (/warn) + F11 + F14, 视反馈引入 F12 / 优化 |

## 数据迁移与切流

### 数据迁移
- **现状**: 已完成一次性 dump (MongoDB → Supabase Postgres), 后续以 Postgres 为准, **不再跑迁移脚本**
- **`scripts/migrate-from-legacy.ts`**: 暂留, 但不再列为依赖项; 必要时手动校对一次性记录
- **老链接 owner_id 处理**: 不能只靠 fingerprint claim. W0/W2 必须先按 legacy author email → Supabase `public.users.email` 做可映射率统计与 backfill; fingerprint claim 只覆盖 v2-hono 新匿名创建的链接. 对 `owner_id IS NULL AND created_by_fingerprint IS NULL` 的 legacy 链接, F5 必须提供 email match claim 或人工校验 runbook 后才能切流
- **建议跑一次确认 SQL** (W0 内):
  ```sql
  SELECT
    COUNT(*) FILTER (WHERE owner_id IS NULL) AS unowned,
    COUNT(*) FILTER (WHERE owner_id IS NOT NULL) AS owned,
    COUNT(*) FILTER (WHERE owner_id IS NULL AND metadata->>'legacy_author_email' IS NOT NULL) AS unowned_with_legacy_email,
    COUNT(*) FILTER (WHERE owner_id IS NULL AND created_by_fingerprint IS NOT NULL) AS unowned_with_fingerprint,
    COUNT(*) AS total
  FROM links;
  ```
  如果 unowned 占比 > 0, W2 必须产出映射/认领方案; 如果 `legacy_author_email` 缺失或无法匹配占比 > 5%, F5 legacy claim 升级为切流阻塞
- **GA4 历史**: 不迁移, 直接复用 master 的 GA4 property (沿用 `GA4_PROPERTY_ID`). v2-hono 默认继续上报 `page_view`, 并增加 `slug` / `source=v2-hono` / `is_redirect=true` params, 这样历史 + 新数据能在同一 event_name 下连续查询

### 切流策略
- **W3 末**: 在 Railway 起 v2-hono 生产实例, 走临时域名 (e.g. `v2.golinks.example`)
- **W4 周中**: 把 master 切只读模式 (POST/PATCH/DELETE 返回 503 + 提示), 同时确认 v2-hono 已上报到同一 GA4 property
- **W4 周五**: DNS A/CNAME 切到 v2-hono 实例; master 实例保留 7 天用于回滚
- **回滚**: DNS 回切 master + 把切流后 v2-hono 新增的 link 增量回写 (脚本 TBD, 出现严重事故时执行)

## Observability & SLO

- **延迟**: redirect P99 ≤ 100 ms (us-west2 同区); API P99 ≤ 500 ms
- **可用性**: 月度 ≥ 99.5%
- **健康检查**: `/api/v1/health` (已存在), `/api/v1/version` (已存在) 接 Railway healthcheck
- **日志**: Railway log + 后续接入 Better Stack (P1)
- **告警**: 至少有 5xx > 1% / health check fail / DB connection lost 三类

## Success Criteria

- [ ] master 用户登录后看到自己全部历史链接
- [ ] redirect / edit / delete / claim / stats 全部可用
- [ ] QR 下载与 master 视觉一致
- [ ] 全部 P0/P1 功能有 e2e 测试覆盖 (符合 `feedback_bug_to_e2e`)
- [ ] redirect P99 ≤ 100 ms 在切流后 24h 内验证达成
- [ ] 数据迁移 dry-run 0 冲突
- [ ] Railway 月费仍 ≤ $5

## Risks & 备选

| 风险 | 缓解 |
|---|---|
| Supabase Auth UI 在 SPA 内集成不顺 | 退到自建邮箱魔法链接 + own session |
| recharts bundle 体积过大 | 路由级 lazy import |
| 服务端 QR 中文字体加载慢 | 字体预热 + LRU 缓存 PNG; 或回退纯客户端方案 |
| `@napi-rs/canvas` 在 Bun 不兼容 | W0 spike 验证; 不行就走客户端 canvas, 服务端 API 仅返回纯 QR |
| Chrome Extension 老用户不更新 | API shim 永久保留 v2 兼容路径 (F13) |
| ~~MongoDB → Postgres 迁移数据丢失~~ | ~~dry-run~~ — 已 dump 一次, 风险消除 |
| Supabase free tier 限额 (50k MAU / 500 MB DB) | 监控用量; 当前规模远低于上限, 触发后升级 Pro ($25/月) |
| 老链接 owner_id 为 null 或 legacy author email 缺失 | W0/W2 跑覆盖率 SQL; 先 email backfill, 再 F5 legacy claim/manual review; 未解决前不切 DNS |
| canvas fingerprint 在隐私模式失败 | F5 内已设计 fallback 算法 |
| **GA4 服务依赖 (down → dashboard 空白)** | dashboard 显示降级状态; `daily_visits` 表保留写入作冷备, P2 评估脱离 GA4 |
| **GA4 Measurement Protocol 上报失败 (fire-and-forget)** | Bun fetch 失败不阻塞 redirect; 5xx 计数告警, 高于阈值时调查 |
| **GCP service account 凭据泄露** | 仅服务端持有 `GOOGLE_APPLICATION_CREDENTIALS_JSON`; 生成独立的 v2-hono service account, 不与 master 共用; IAM 权限收敛到 GA4 Data API 只读 |
| **GA4 数据延迟 (摄入 ~30s)** | e2e 测试用 polling + retry; UI 不显示"实时", 显示"~分钟前" |
| **GDPR / cookie 合规** (GA4 上报 IP/UA + `_ga` cookie) | P1 加 cookie banner + 隐私政策; e2e 验证未同意时跳过上报 |

---

## Prerequisites & 开放问题 (agent 端到端执行前必须就位)

> 标记: 🔴 必须由人提供 / 🟡 待决策 / ⚪ agent 可自定. **凭据值不要写入本文档或任何 commit, 仅引用变量名**.

### 🔴 凭据与环境变量

> 现状基于 2026-05-13 扫描 `.env` 与 `template.env` (变量名核对, 不含值). Supabase 已迁到新命名: `publishable_key` 替代 `anon_key`, `secret_key` 替代 `service_role_key`.

服务端 (Railway / 本地 `.env`):

| 变量名 | 用途 | 状态 |
|---|---|---|
| `DATABASE_URL` | Supabase Postgres 连接串 | ✅ `.env` 已配 |
| `SUPABASE_URL` | 服务端调用 Supabase REST/Admin | ✅ `.env` 已配 |
| `SUPABASE_JWKS_URL` | JWT 验证 | ✅ `.env` 已配 (`middleware/auth.ts:19`) |
| `SUPABASE_JWT_ISSUER` | JWT issuer 校验 | ✅ `.env` 已配 (`middleware/auth.ts:20`) |
| `SUPABASE_PUBLISHABLE_KEY` | 旧 anon_key, 给前端用的公开 JWT | ✅ `.env` 已配 |
| `SUPABASE_SECRET_KEY` | 旧 service_role_key, admin API | ✅ `.env` 已配; F11/F5 仍优先走 `public.users` 避免暴露 |
| ~~`TURNSTILE_SECRET_KEY`~~ | ~~反滥用~~ | **暂缓** (P2 再评估), `template.env` 占位保留即可 |
| ~~`TURNSTILE_SITE_KEY`~~ | ~~Turnstile widget~~ | **暂缓** |
| `PUBLIC_BASE_URL` | 魔法链接回跳基址 | ⚠️ `template.env` 默认 `http://localhost:3000`, `.env` 未填 (本地够用); **生产 (Railway) 决策值 = `https://open-golinks-v2-hono-production.up.railway.app`**, F1 部署前用 `railway variables --set` 推 |
| `IP_HASH_SALT` | `audit_logs.actor_ip_hash` 加盐 | ✅ `.env` 已配 (2026-05-13 生成, 32-byte hex); 入 `template.env` 占位 |
| ~~`LEGACY_MONGODB_URL`~~ | ~~一次性数据迁移~~ | **不需要** — 数据已 dump 进 Postgres |
| `GA4_MEASUREMENT_ID` | GA4 Measurement Protocol 上报 | ✅ `.env` 已配 |
| `GA4_API_SECRET` | 同上 | ✅ `.env` 已配 |
| `GA4_PROPERTY_ID` | GA4 Data API 查询 (F4 dashboard 取数) | ✅ `.env` 已配 |
| `GOOGLE_APPLICATION_CREDENTIALS_JSON` | base64 编码的 GCP service account JSON, 解码到 `/tmp/gcp-key.json` 给 SDK 用 | ✅ `.env` 已配. **注意: 这是高权限凭据, 仅服务端用**; 建议生产 Railway 用独立的 v2-hono service account, 不共用 master 的 |

客户端 (Vite, `VITE_*` 前缀, 本地 3/3 就位; Railway 待 F1 同步):

| 变量名 | 用途 | 状态 |
|---|---|---|
| `VITE_SUPABASE_URL` | supabase-js client (= 服务端 `SUPABASE_URL` 同值) | ✅ `.env` 已配; F1 前推 Railway |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | publishable JWT (= 服务端 `SUPABASE_PUBLISHABLE_KEY` 同值) | ✅ `.env` 已配; F1 前推 Railway |
| ~~`VITE_TURNSTILE_SITE_KEY`~~ | ~~Turnstile widget~~ | **暂缓** |
| `VITE_BASE_URL` | 前端 base URL (= `PUBLIC_BASE_URL` 同值) | ✅ `.env` 已配本地 `http://localhost:3000`; F1 前推 Railway 为 `https://open-golinks-v2-hono-production.up.railway.app` |

> Vite 安全机制: 没有 `VITE_` 前缀的变量不会进客户端 bundle, 即使值一样也得双写一份. 建议在 `template.env` 用注释指明"同步保持一致".

**P0 阻塞项汇总** (2026-05-13 评估; ✅ 本地 env 就位, Railway 待推):
- F1 (auth) 前: 将 `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_BASE_URL`, `PUBLIC_BASE_URL` 推到 Railway; 本地 `PUBLIC_BASE_URL` 用 `http://localhost:3000`
- F2 (CRUD + audit) 前: ✅ `IP_HASH_SALT` 已就位
- F4 (stats + GA4 上报) 前: ✅ GA4/GCP 4 个凭据全部已就位
- W4 生产切流前: Railway 上对应改 `PUBLIC_BASE_URL` + `VITE_BASE_URL` 为生产域名

### 🔴 外部账户/项目就位 (需人介入)

- [ ] Supabase Auth Providers 配置 (magic link + 选定的 OAuth)
- [ ] Supabase Email Templates (中文化, 含项目名)
- [ ] Supabase Auth redirect URLs 白名单 (本地 + staging + prod)
- [ ] ~~Cloudflare Turnstile site 创建~~ — **暂缓**
- [ ] (若启用 Google OAuth) Google Cloud Console OAuth client + redirect URL
- [ ] ~~master MongoDB 读权限~~ — **不需要**, 数据已 dump 进 Postgres
- [x] **GA4 凭据已在本地 `.env`** (2026-05-13 确认); Railway 生产 env 仍需配置 (W4 前)
- [ ] **(P1 建议) 生成独立的 v2-hono GCP service account 给生产用**, 不共用 master 的, 权限收敛到 GA4 Data API 只读
- [ ] **新建 GA4 测试 property** (e2e 测试用, 避免污染生产数据); 或承认 e2e 跳过 GA4 集成测试
- [ ] master 仓库中 NotoSansCJK 字体文件路径确认 (F7 复制源; 当前 master 路径为 `static/fonts/NotoSansCJKsc-Regular.otf`, 需确认文件实际存在)
- [ ] Chrome Extension 源码 repo URL (F13 spike 需要)
- [ ] 生产域名 DNS 控制权 (W4 切流)
- [ ] Better Stack / 告警出口账户 (W4 后接入)

### 🟡 产品/UX 决策 (agent 不该自己拍)

- [ ] 登录方式范围: 仅 magic link / + Google OAuth / + 邮箱密码?
- [ ] F6 /warn 警告页文案 (中英? 默认 warn 哪类链接?)
- [ ] F12 公开链接发现 do/drop (W4 末)
- [ ] 软删后是否暴露 "回收站"
- [ ] F11 transfer 是否需要被接收方确认 (当前默认: 不需要, 直接转)
- [x] dump 进来的老链接 owner_id + legacy author email 覆盖率已查 (2026-05-13 dry-run): `total=5804`, `unowned=4959`, `unowned_with_legacy_email=0`, `unowned_with_fingerprint=0`. 无自动 email backfill 空间; 这 4959 条需 manual review/批量归属策略, 未闭环不切 DNS
- [ ] ~~历史 visits 计数迁移~~ — **不需要**, 历史数据全在 GA4
- [ ] 是否做 dark mode / i18n / cookie banner (GDPR — **GA4 上报有 IP/UA, 加 cookie banner 是合规需求**, 优先级提到 P1)
- [ ] Dashboard 默认分页大小 (当前默认 20) / 默认排序 (当前默认 created_at desc)
- [ ] recharts 主题色与品牌风格 (跟 Landing 一致, 复刻 master ECharts 还是重设计)
- [x] GA4 上报 event_name: 默认继续用 master 的 `page_view`, 通过 event params `source=v2-hono`, `slug`, `is_redirect=true` 区分; 若后续需要新 event_name, F4/F8 查询必须同时兼容历史 `page_view`

### 🟡 测试环境

- [ ] e2e 用什么 Supabase 项目? 推荐: 独立 staging 项目, 与 prod 隔离
- [ ] 魔法链接邮件在 e2e 中怎么收? 候选:
  - (a) Supabase test 模式 / Admin API 直接发 magic link token (推荐)
  - (b) Mailosaur 或类似邮箱测试服务
- [x] 浏览器验证工具已定 = Puppeteer + 系统 Chrome (见 SOP 步骤 6). F1 落地前 `bun add -D puppeteer-core`. **跑在哪**: 本地开发机 / agent 工作目录, 指向生产 URL `https://open-golinks-v2-hono-production.up.railway.app`. Railway 容器**不需要**装 Chrome (它跑服务, 不跑 browser test). CI (若启用): 用 GitHub Actions `browser-actions/setup-chrome@v1` 装 Chrome.
- [ ] CI 平台: GitHub Actions? 现有 `.github/workflows/` 是否就位?
- [ ] e2e 测试账号/数据生命周期: 每次跑前清表 / 用临时 schema / Supabase Local

### 🔴 部署/运维 runbook (人介入)

- [ ] W4 DNS 切换的执行人 + 时间窗 + 公告渠道
- [ ] Railway 部署 trigger 模式: push 自动还是手动 promote? (memory 里有 GitHub trigger 配置, 需确认是否启用)
- [ ] 告警接收人 / 通道 (Slack / 邮箱)
- [ ] 回滚决策权: 谁能拍板回切 master

### ⚪ 已由本计划默认 (agent 可直接执行, 无需再问)

- recharts 作为图表库 (替代 master ECharts)
- 软删的 slug → redirect 返回 404
- F11 transfer 目标 email 未注册 → 404 `USER_NOT_FOUND` (不做 invite)
- F5 fingerprint 主算法 = SHA-256(canvas + UA + tz + screen), fallback 不含 canvas
- F12 默认 drop (除非 W4 末有反向决策)
- 分页: cursor based, 默认 20/页, 用 `created_at` 排序
- 搜索: PG `ILIKE` (规模 < 1M 行够用), 不上 fulltext
- audit_logs 永久保留 (磁盘成本 < $0.01/GB·月); VISIT 事件**不写** audit, 走 GA4
- redirect.ts 的 daily_visits / visits 字段保留写入但暂不读 (冷备); F4/F8 数据源全部走 GA4 Data API
- GA4 上报: redirect response 生成前读/写 `_ga` cookie, 然后 queueMicrotask fire-and-forget Measurement Protocol, **不 await** (跟 master 不一样, 不阻塞 redirect)
- Turnstile 暂缓; 用内存 IP+UA token bucket 兜底

---

## 附录 A: master vs v2-hono 详细对比

| 功能 | master | v2-hono 现状 | 缺口 |
|---|---|---|---|
| Stats dashboard | `pages/dashboard.vue` (GA4 Data API + ECharts; 后端透传端点 `POST /api/v2/ga4/reports` 在 `src/routes/apiv2.ts:14`) | `Dashboard.tsx` stub | F4 / F8 (沿用 GA4, 移植 vue→react) |
| GA4 上报 | `src/main.ts:180-247` 中间件 (Measurement Protocol, await axios) | 无 | F4 (改成 fire-and-forget) |
| 用户链接列表 | `pages/user-links.vue` | 无 | F3 |
| 登录 | Auth0 (`src/routes/auth.ts`) | JWT middleware + `/api/v1/me` 已有, UI 无 | F1 |
| QR 码 | `components/QrCodeEditor.vue` + `src/routes/qr.ts` | 无 | F7 |
| 链接编辑 | `pages/link.vue` + `POST /api/v2/edit` | 仅 `POST /api/v1/links` (create) | F2 |
| 链接删除 | 有 | 无 | F2 |
| 匿名认领 | 有 | 无 | F5 |
| Redirect | 基础 302 + GA4 `page_view` | 智能 (不存在 → /edit/:slug) + 异步 visit + daily_visits UPSERT | ✅ v2-hono 更好; F4 补 GA4 `page_view`, VISIT 不写 audit |
| Landing 页 | 无 | 有 (`Landing/*`, SSR prerender) | ✅ v2-hono 新增 |
| 警告页 | 未确认 | 无 | F6 (按新增处理) |
| 审计日志 | 无 | schema 完整, API 无 | F9 |
| URL 历史 | 有 | schema 有 (jsonb 默认 []), API 无 | F10 |
| 所有权转移 | 无 | enum 已含 `TRANSFER`, 无 API | F11 (新增) |
| Chrome Extension | 待 W0 spike 确认 | 未验证 | F13 |
