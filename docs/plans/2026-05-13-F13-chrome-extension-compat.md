# F13. Chrome Extension 兼容性

**Date**: 2026-05-13
**Duration**: 1 天
**Priority**: P2 (但 W0 spike 是 P0 前置)
**Status**: ✅ Done — 方案 A shim (2026-05-14)
**Parent plan**: [feature-parity-master-plan](./2026-05-13-feature-parity-master-plan.md)

## Overview

验证 master 时代的 Chrome Extension (omnibox `go <slug>` 类似 keyword search) 能否调用 v2-hono API. 2026-05-14 已选择 **方案 A: `/api/v2` shim**. 未找到独立扩展源码, 因此不发新版; 先保证旧 `/api/v2` 契约可用.

## 结论

- 本地 `/Users/peteradams/ws` 与 GitHub `xinbenlv` 账号下未找到独立 Chrome Extension 源码.
- `origin/master` 确认旧契约来自应用自身:
  - `GET /api/v2/link/:goLink`
  - `GET /api/v2/available/:goLink`
  - `POST /api/v2/edit`
  - `GET /api/v2/my-links`
- 已新增 `src/routes/api/v2-compat.ts` 并在 `src/server.ts` 注册 `/api/v2`.
- 公开 lookup 不暴露 owner email: 非 owner 只返回 `author: "registered"` 或 `anonymous`.
- 旧 Auth0 cookie session 无法无缝迁到 Supabase; `/api/v2/my-links` 兼容路径只支持 Supabase Bearer JWT.
- `POST /api/v2/edit` 支持匿名创建; 更新仍要求当前 Supabase owner.

## 验证记录

- Local:
  - `bun run type-check`
  - `bun test tests/e2e/F13-extension-compat.test.ts`
  - `bun test tests/browser/F13.spec.ts` (本地未设生产开关时 skip)
  - `bun run build`
  - local production smoke: `/api/v2/link/:slug` 返回 `[]`, `/api/v2/available/:slug` 返回 `true`
- Production:
  - Commit: `1a8266a [F13] add legacy API compatibility shim`
  - Railway deployment `a57eb9bc-b1a9-4415-b83e-1473887a361f` SUCCESS
  - `RUN_BROWSER_TESTS=1 EXPECTED_SHA=1a8266 bun test tests/browser/F13.spec.ts` PASS

## W0 Spike (必做)

1. [x] 找到扩展源码 repo: 未找到独立 repo; 本地 workspace、GitHub `xinbenlv` 搜索无结果
2. [x] 读 master API 调用点, 列出旧 endpoint:
   - `GET /api/v2/link/:slug`
   - `POST /api/v2/edit`
   - `GET /api/v2/my-links`
   - `GET /api/v2/available/:slug`
3. [x] 跟 v2-hono 当前 API 对比, 列差异
4. [x] 决定方案: shim

## Deliverables (取决于方案)

### 方案 A: shim (推荐)

新文件:
- [x] `src/routes/api/v2-compat.ts` — `/api/v2/*` 兼容 shim
- [x] `tests/e2e/F13-extension-compat.test.ts`
- [x] `tests/browser/F13.spec.ts` — 无扩展源码时, 生产浏览器直接 smoke `/api/v2` endpoints

修改:
- [x] `src/server.ts` 注册 `/api/v2/*` 路由
- [x] `src/routes/api/links.ts` 新增 `GET /api/v1/links/:slug/available`

### 方案 B: 发扩展新版本

修改:
- 扩展源码 (在另一个 repo) 把 API path 改成 `/api/v1/*` + 重新打包发布 Chrome Web Store

### 方案 C: 弃用

修改:
- 通知现有用户 (扩展 / dashboard banner)
- 一段时间后停掉

## 依赖与现状

- 至少 F1 + F2 完成 (有完整 API 才能对照)
- env: 无新增

## API 兼容性 (W0 spike 确认)

| 旧 (master) | v2-hono 实现 | 状态 |
|---|---|---|
| `GET /api/v2/link/:slug` | `src/routes/api/v2-compat.ts`, 返回 master array shape | ✅ |
| `POST /api/v2/edit { golink, dest, addLogo, caption }` | 匿名创建; owner Bearer JWT 更新; 写 audit/url_history/metadata | ✅ |
| `GET /api/v2/my-links` (旧 cookie auth) | Supabase Bearer JWT only; 返回 master-ish array shape | ⚠️ cookie 不兼容 |
| `GET /api/v2/available/:slug` | 返回 boolean; v1 同时有 `GET /api/v1/links/:slug/available` | ✅ |

## e2e 测试

- `tests/e2e/F13-extension-compat.test.ts`
  - `GET /api/v2/available/:slug`
  - `POST /api/v2/edit`
  - `GET /api/v2/link/:slug`
  - owner-only update + Bearer `GET /api/v2/my-links`
- `tests/browser/F13.spec.ts`
  - production browser smoke against `/api/v2` endpoints, because extension source was unavailable

## DoD checklist (遵循 [SOP](./2026-05-13-feature-parity-master-plan.md#-per-feature-推进-sop-definition-of-done))

- [x] 0. W0 spike 完成, 方案确定 = shim
- [x] 1. Plan reviewed, scope locked
- [x] 2. e2e/browser tests added
- [x] 3. Implementation complete
- [x] 4. Local type-check/build/e2e/browser-skip/local smoke complete
- [x] 5. Commit + push: `1a8266a`
- [x] 6. Deploy + production browser verification complete
- [x] 7. Docs/checklist updated

## 风险

| 风险 | 缓解 |
|---|---|
| 扩展用 cookie session, v2-hono 用 Bearer JWT — 不兼容 | 已标明: `/api/v2/my-links` 只支持 Bearer; public lookup/edit-create 不依赖登录 |
| 找不到扩展源码 | 不发新版; 后端 shim 覆盖已确认的 master `/api/v2` endpoints |
| Chrome Web Store 审核慢 | 提前提交 (W0/W1 启动) |
