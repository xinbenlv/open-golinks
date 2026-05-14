# F1. 用户认证 + 登录 UI

**Date**: 2026-05-13
**Duration**: 3 天
**Priority**: P0
**Status**: ✅ Done
**Parent plan**: [feature-parity-master-plan](./2026-05-13-feature-parity-master-plan.md)

## Overview

用户用邮箱魔法链接 (P0) 或 Google OAuth (可选, 待 [产品决策](./2026-05-13-feature-parity-master-plan.md#-产品ux-决策-agent-不该自己拍)) 登录, 前端能感知 session, API 通过 JWT 识别 user.

## Deliverables

新文件:
- `src/web/lib/supabase.ts` — supabase-js 客户端 (单例)
- `src/web/hooks/useAuth.ts` — `{ user, signInWithMagicLink, signOut, loading }`
- `src/web/components/AuthGuard.tsx` — 受保护路由包装, 未登录跳 `/login`
- `src/web/pages/Login.tsx` — 邮箱输入 + 魔法链接发送
- `src/web/pages/AuthCallback.tsx` — 处理 Supabase PKCE magic link 回跳的 `?code=...`; 同时兼容 Supabase Admin `generate_link` 产生的 `#access_token=...` 测试/旧式回跳
- `tests/e2e/F1-auth.test.ts`
- `tests/browser/F1.spec.ts` (按 SOP 步骤 6)

修改:
- `src/web/App.tsx` 或 router 配置: 加 `/login` / `/auth/callback` 路由 + 包 `AuthGuard` 到 `/dashboard` 以及后续 `/stats/*` 等 owner-only 页面; **不要包 `/edit/*`**, 否则会破坏 "未创建 slug → /edit/:slug 创建" 流程
- Header: 区分登录/未登录态 (显示邮箱 + 登出按钮)
- `src/routes/redirect.ts` + `tests/e2e/reserved-slug-fallthrough.test.ts`: 把 `login` 加入 RESERVED, 防止 `/login` 被当成 slug

## 依赖与现状

参见主计划 [V0 已有基础](./2026-05-13-feature-parity-master-plan.md#v0-已有基础-避免重复造轮子):
- DB: 无 schema 改动 — `public.users` 由 `middleware/auth.ts:70-82` lazy upsert
- API: `GET /api/v1/me` + `requireAuth` / `optionalAuth` 已就绪, **本 feature 不新增后端 API**
- env: 服务端 6 个 SUPABASE_* 已配 ✅; 客户端 3 个 `VITE_*` 已推 Railway; `SUPABASE_SECRET_KEY` 已更正为真实 service key, 供 browser smoke 用 Admin `generate_link`

## 实施步骤

1. `bun add @supabase/supabase-js`
2. 写 `src/web/lib/supabase.ts`: `createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { flowType: 'pkce', autoRefreshToken: true } })`
3. 写 `useAuth` hook: 监听 `supabase.auth.onAuthStateChange`, 把 session.access_token 注入 `fetch` 的 `Authorization: Bearer` (用 wrapper or interceptor)
4. 写 `Login.tsx`: 输入邮箱 → `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: VITE_BASE_URL + '/auth/callback' } })`
5. 写 `AuthCallback.tsx`: 优先读取 `location.search` 的 `code`, `supabase.auth.exchangeCodeForSession(code)` 后 navigate 到 `/dashboard`; 若 Admin `generate_link` / legacy 链路给 `location.hash` token, 用 `supabase.auth.setSession(...)` 兼容; 两者都缺失或 exchange 失败则显示错误并回 `/login`
6. 写 `AuthGuard`: loading 时显示空/骨架, `user ? children : <Navigate to="/login" replace />`
7. 改 Header 显示登录态
8. 更新 `redirect.ts` RESERVED + reserved route regression test
9. 写 e2e + browser tests

## API 设计

无新增 endpoint. 前端通过 `Authorization: Bearer <session.access_token>` 调现有 `/api/v1/me` 等.

## UI 草图

```
[Login.tsx]                      [Header (logged in)]
+----------------------------+   +--------------------+
| Sign in to OpenGoLinks     |   | OpenGoLinks  ___   |
|                            |   |        zzn@...  ▼  |
| Email: [_______________]   |   +--------------------+
| [Send magic link]          |
|                            |   (下拉: Dashboard | Sign out)
| ──── or ────               |
| [Sign in with Google]      |
+----------------------------+
```

## e2e 测试

> 实际魔法链接邮件在 e2e 中怎么收 — 见主计划 [测试环境](./2026-05-13-feature-parity-master-plan.md#-测试环境). 推荐方案: 用 Supabase Admin API `generateLink` 直接拿 token, 跳过邮箱.

```ts
// tests/e2e/F1-auth.test.ts
test('magic link login → session 持久 → 登出', async () => {
  // 1. 用 Supabase Admin API generateLink 或测试邮箱拿到 action_link
  // 2. 访问 action_link, 最终回跳 /auth/callback?code=...
  // 3. 期望: redirect /dashboard, header 显示 email
  // 4. 调 /api/v1/me 返回 { id, email }
  // 5. 点登出, session 清空
  // 6. 直接访问 /dashboard 跳回 /login
});

test('未登录访问受保护路由 → 跳 /login', ...);
test('直接访问 /login 不会被 redirectRoute 当成 slug', ...);
test('JWT 过期 → useAuth 自动 refresh 或跳 /login', ...);
```

## DoD checklist (遵循 [Per-Feature SOP](./2026-05-13-feature-parity-master-plan.md#-per-feature-推进-sop-definition-of-done))

- [x] 1. 本地 `bun run type-check` 绿 + `bun run build` 绿 + 本地生产 server/browser smoke 起得来
- [x] 2. 本地 `bun test tests/e2e/F1-auth.test.ts` 绿
- [x] 2b. `bun test tests/e2e/reserved-slug-fallthrough.test.ts` 绿, 且包含 `login`
- [x] 3. commit + push, message 前缀 `[F1]`
- [x] 4. 同步 Railway env (`railway variable set ... --stdin` 单条单条推):
  - `VITE_SUPABASE_URL` (= 服务端 `SUPABASE_URL` 同值)
  - `VITE_SUPABASE_PUBLISHABLE_KEY` (= 服务端 `SUPABASE_PUBLISHABLE_KEY` 同值)
  - `VITE_BASE_URL=https://open-golinks-v2-hono-production.up.railway.app`
  - `SUPABASE_SECRET_KEY` (真实 service key, 仅供 Admin generate-link smoke 使用)
- [x] 5. `railway status` 显示 deployment SUCCESS
- [x] 6. 浏览器验证: 在生产 URL 跑 `RUN_BROWSER_TESTS=1 bun test tests/browser/F1.spec.ts`; 检查 login UI / generated magic-link callback / console / network / `/api/v1/version` SHA
- [x] 7. `docs/plans/README.md` 勾选 F1; `docs/CURRENT-ARCHITECT.md` 加 `Login.tsx` 等新文件引用

## 风险

| 风险 | 缓解 |
|---|---|
| supabase-js v2 在 SPA + cookie/localStorage 冲突 | 用 PKCE flow + localStorage; 测试隐私模式 |
| Magic link redirect URL 没加白名单 → Supabase Auth 拒绝 | W0 在 Supabase Dashboard 把 `localhost:3000/auth/callback` 和 `<prod>/auth/callback` 都加白 |
| Bun fetch + jose JWKS 在 deploy 后偶发 cold-start 拉 JWKS 慢 | `auth.ts` 已用 jose 内部 LRU cache, 不再额外处理 |

主计划共享风险见 [Risks & 备选](./2026-05-13-feature-parity-master-plan.md#risks--备选).
