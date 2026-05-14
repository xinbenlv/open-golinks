# F9. 审计日志查看

**Date**: 2026-05-13
**Duration**: 1.5 天
**Priority**: P1
**Status**: ✅ Done
**Parent plan**: [feature-parity-master-plan](./2026-05-13-feature-parity-master-plan.md)

## Overview

owner 在 Edit 页底部看到自己链接的完整操作历史 (CREATE / UPDATE / DELETE / CLAIM / TRANSFER 五种, VISIT 不在内 — 走 GA4).

## Deliverables

新文件:
- `src/routes/api/audit.ts` — `GET /api/v1/audit/:slug` (requireAuth + owner-only)
- `src/web/components/AuditTimeline.tsx` — 时间线 UI, UPDATE 行可展开看 diff
- `tests/e2e/F9-audit.test.ts`
- `tests/browser/F9.spec.ts`

修改:
- `src/web/pages/Edit.tsx`: 底部嵌入 `<AuditTimeline />`

## 依赖与现状

- F2 (audit middleware) 完成 — 此 feature 仅读, 写已在 F2 内
- DB: `audit_logs` 表完整 (`schema.ts:102-133`), 索引 `idx_audit_logs_link_slug` 已存在
- env: 无新增

## Implementation Notes (2026-05-14)

- 已实现 `GET /api/v1/audit/:slug?limit=20&cursor=...`, requireAuth + owner-only, 非 owner 403, 不存在/已删除 404.
- API 按 `timestamp DESC, id DESC` 排序, cursor 为 base64url JSON `{ timestamp, id }`; 返回 `actorEmail`, `actorFingerprint`, `diff`.
- Edit 页底部嵌入 `AuditTimeline`, 支持 Load more 与 diff 展开.

## API 设计

### `GET /api/v1/audit/:slug?limit=20&cursor=<base64>` (requireAuth)

校验: `links.owner_id = current user` (非 owner 返 403, 即使是 admin)

```jsonc
// 200
{
  "logs": [
    {
      "id": "...",
      "action": "UPDATE",
      "actorId": "<uuid>",
      "actorEmail": "zzn@...",   // join users 拿
      "timestamp": "...",
      "diff": { "before": { "url": "A" }, "after": { "url": "B" } }
    },
    ...
  ],
  "nextCursor": "<base64>" | null
}

// 403 if 非 owner
// 404 if slug 不存在
```

按 `timestamp DESC` 排序; cursor 用 `(timestamp, id)` 复合编码.

## UI 草图

```
[Edit.tsx 底部]
History
+--------------------------------------------------------+
| 🕐 2026-05-12 14:23  UPDATE  by zzn@...     [展开 ▼]    |
|     before: { url: "https://old.example" }              |
|     after:  { url: "https://new.example" }              |
| 🕐 2026-05-10 09:11  CLAIM   by zzn@...                |
| 🕐 2026-04-22 11:00  CREATE  by <anonymous, fp: 1f3a..> |
+--------------------------------------------------------+
[Load more]
```

## e2e 测试

```ts
test('owner 看 audit 时间线: CREATE + UPDATE + CLAIM 倒序', async () => {
  // 准备 slug foo: 匿名 CREATE → user A CLAIM → user A UPDATE
  // user A 登录, GET /edit/foo, 底部 AuditTimeline 显示 3 行
  // 点 UPDATE 展开 → 看到 before/after url diff
});

test('非 owner 调 GET /api/v1/audit/foo → 403', ...);
test('不存在的 slug → 404', ...);
test('分页: 25 条 audit 显示前 20 → cursor next → 剩 5 条', ...);
```

## DoD checklist (遵循 [SOP](./2026-05-13-feature-parity-master-plan.md#-per-feature-推进-sop-definition-of-done))

- [x] 1. type-check + 本地启动 (`bun run type-check`, `bun run build`, `PORT=3109 NODE_ENV=production bun src/server.ts` + `/api/v1/health`)
- [x] 2. `bun test tests/e2e/F9-audit.test.ts` 绿
- [x] 3. commit + push, 前缀 `[F9]` (`6845a24`)
- [x] 4. Railway env: 无新增
- [x] 5. deploy SUCCESS (`55865a55-acee-4a90-a2a1-38bef9b5c3e5`, 2026-05-14)
- [x] 6. 浏览器验证生产 (`RUN_BROWSER_TESTS=1 EXPECTED_SHA=6845a2 bun test tests/browser/F9.spec.ts`):
  - 对一个测试 slug 做 CREATE + 2 次 UPDATE
  - /edit/<slug> 底部 History 显示 3 行
  - UPDATE 展开看 diff
  - build SHA 匹配
- [x] 7. README 勾选 + CURRENT-ARCHITECT 更新

## 风险

| 风险 | 缓解 |
|---|---|
| `actorEmail` join `users` 表慢 (audit_logs 行多) | 索引 `idx_audit_logs_link_slug` 已有; LIMIT 后再 join |
| 老 audit 没有 `actorEmail` (用户后来删账号) | 显示 "deleted user (id: xxx)" |
| 大量 UPDATE 让 timeline 太长 | 默认 20/页, 用户主动 load more |
