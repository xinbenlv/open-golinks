# F2. 链接编辑 + 删除 + 统一 audit + IP 限流

**Date**: 2026-05-13
**Duration**: 3 天
**Priority**: P0
**Status**: 📋 Planning
**Parent plan**: [feature-parity-master-plan](./2026-05-13-feature-parity-master-plan.md)

## Overview

已登录 owner 能改 URL / 软删自己的链接, 旧 URL 进 `url_history`; 登录用户创建链接时写 `owner_id`; CREATE / UPDATE / DELETE / CLAIM / TRANSFER 统一写 `audit_logs` (VISIT 走 GA4 不进 audit); 匿名/低频写操作过 IP+UA 内存令牌桶限流 (替代原计划的 Turnstile).

## Deliverables

新文件:
- `src/middleware/audit.ts` — `writeAudit(c, action, slug, diff?)` helper, 内部 SHA-256(IP + IP_HASH_SALT)
- `src/middleware/ratelimit.ts` — 内存 token bucket, 配置: 匿名 5/min + 30/hour, 已登录跳过
- `tests/e2e/F2-link-crud.test.ts`
- `tests/browser/F2.spec.ts`

修改:
- `src/routes/api/links.ts`:
  - `POST` 接 `optionalAuth` + audit (CREATE) + ratelimit (匿名) + 软删后重建 UPSERT 逻辑; 若有 JWT, `owner_id = current user`
  - 新增 `PATCH /:slug` (owner-only, 旧 url 入 `url_history`, audit UPDATE)
  - 新增 `DELETE /:slug` (软删 `deleted_at=now()`, audit DELETE)
- `src/routes/redirect.ts`: 增加 "存在但 `deleted_at IS NOT NULL` → 404" 分支
- `src/web/pages/Edit.tsx`: 完善 form + Edit/Delete 按钮 + 二次确认

## 依赖与现状

- F1 (auth) 完成 — PATCH/DELETE 需要 `requireAuth` + owner 校验
- DB: 无 schema 改动 (`deleted_at`, `url_history`, audit_logs 全部已就绪)
- env: ✅ `IP_HASH_SALT` 本地已生成; Railway 同步时**新生成另一个** salt (不复用)

## API 设计

### POST `/api/v1/links` 扩展 (optionalAuth)

```jsonc
// req body 仍保持 F0 shape; F5/F14 会再扩展 fingerprint / metadata
{ "slug": "foo", "url": "https://example.com" }

// 行为:
// - 有有效 Bearer JWT: owner_id = current user id
// - 无 JWT: owner_id = null, 走匿名 rate limit
// - audit CREATE: actor_id 为 current user 或 null; actor_fingerprint 后续由 F5 补
// - VISIT 不写 audit
```

### PATCH `/api/v1/links/:slug` (requireAuth)

```jsonc
// req body
{ "url": "https://new-url.example" }

// 200 OK
{ "link": { "slug": "...", "url": "...", "urlHistory": [{ "url": "old", "changedAt": "...", "changedBy": "<userId>" }] } }

// 403 if owner_id != current user
// 404 if not found OR deleted_at IS NOT NULL
```

### DELETE `/api/v1/links/:slug` (requireAuth)

```jsonc
// 204 No Content (软删)
// 403 / 404 同上
```

### 软删后重建同名 slug (POST)

`POST /api/v1/links` 命中 23505 时:
- 若 row.deleted_at IS NOT NULL **且** row.owner_id = current user → 改写为 UPDATE (清 deleted_at, 重置 url, url_history 重新开始)
- 否则保持 409 `SLUG_TAKEN`

## 限流策略

`middleware/ratelimit.ts`:
- 内存 Map<key, { count, resetAt }>
- key = `${ip}:${ua_hash}`
- 匿名: 5 次 / 60s, 30 次 / 3600s 双层
- 已登录: bypass
- 超限: 429 `RATE_LIMITED` + `Retry-After` header
- 单实例内存计数 (Railway 单容器), 多实例需换 Redis (P2)

## e2e 测试

```ts
test('owner 完整 CRUD 流程 + audit + url_history', async () => {
  // login → POST /links {slug:'foo', url:'A'} → audit 含 CREATE
  // DB links.owner_id === current user; F3 owner=me 能查到
  // PATCH /links/foo {url:'B'} → 200, url_history 含 {url:'A'}
  // GET /:foo → 302 B
  // DELETE /links/foo → 204
  // GET /:foo → 404 (不再跳 /edit/foo)
  // audit_logs 三行: CREATE, UPDATE, DELETE
});

test('非 owner PATCH/DELETE → 403', ...);
test('软删 slug 重建 (同 owner): 清 deleted_at 后可访问', ...);
test('软删 slug 重建 (不同 owner) → 409 SLUG_TAKEN', ...);
test('匿名 6 次 POST 在 1 分钟内 → 第 6 个 429', ...);
test('已登录用户 POST 不被限流', ...);
test('已登录 POST 写 owner_id, 匿名 POST owner_id 为 null', ...);
```

## DoD checklist (遵循 [Per-Feature SOP](./2026-05-13-feature-parity-master-plan.md#-per-feature-推进-sop-definition-of-done))

- [ ] 1. type-check + 本地启动
- [ ] 2. `bun test tests/e2e/F2-link-crud.test.ts` 绿
- [ ] 3. commit + push, 前缀 `[F2]`
- [ ] 4. Railway env: `IP_HASH_SALT=<另生成一个 32-byte hex, 不复用本地值>`
- [ ] 5. deploy SUCCESS
- [ ] 6. 浏览器验证生产: 登录 → 创建 → 编辑 → 删除 → 访问被删 slug 应 404; console + network 无 5xx; `/api/v1/version` commit SHA 匹配
- [ ] 7. README 勾选 + CURRENT-ARCHITECT 更新

## 风险

| 风险 | 缓解 |
|---|---|
| 内存限流在 Railway 重启后清零 → 滥用者重连 | 接受 — Railway 重启不频繁; 严重时升级 Redis |
| 软删后 row 占主键, 用户 confused | UI 在创建表单展示"该 slug 之前被删, 可恢复"提示 |
| 大量历史 PATCH 把 `url_history` 撑爆 | 当前无上限; P2 评估保留最近 N 条 |
