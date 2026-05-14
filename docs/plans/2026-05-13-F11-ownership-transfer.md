# F11. 所有权转移 (Transfer)

**Date**: 2026-05-13
**Duration**: 1.5 天
**Priority**: P2
**Status**: 📋 Planning
**Parent plan**: [feature-parity-master-plan](./2026-05-13-feature-parity-master-plan.md)

## Overview

owner 把链接转给另一个已注册 user (by email). 目标用户必须先注册 (无 invite 流程).

## Deliverables

新文件:
- `tests/e2e/F11-transfer.test.ts`
- `tests/browser/F11.spec.ts`

修改:
- `src/routes/api/links.ts`: 新增 `POST /:slug/transfer`
- `src/web/pages/Edit.tsx`: advanced section 加 Transfer form + 二次确认 modal

## 依赖与现状

- F2 (audit) 完成 — TRANSFER 走同套 audit
- DB: `audit_logs.action` enum 已含 `TRANSFER`; `metadata.from_owner_id` / `to_owner_id` 在 schema 注释里预留
- env: 无新增

## API 设计

### `POST /api/v1/links/:slug/transfer` (requireAuth, owner-only)

```jsonc
// req
{ "toEmail": "alice@example.com" }

// 流程:
// 1. 在 public.users 按 email 查目标 (大小写不敏感)
// 2. 不存在 → 404 USER_NOT_FOUND (要求接收方先登录一次创建 public.users 行)
// 3. DB transaction 内 SELECT link FOR UPDATE, 再改 owner_id, 写 audit TRANSFER (diff.from=old, diff.to=new)

// 200 { link: { ..., ownerId: "<new uuid>" } }
// 403 if 非 owner
// 404 if slug 不存在 OR toEmail 未注册
```

不做的:
- ❌ 不发邀请邮件 (无 invite)
- ❌ 不要被接收方确认 (直接转, 当前默认 — [可改](./2026-05-13-feature-parity-master-plan.md#-产品ux-决策-agent-不该自己拍))

若产品决策改为"接收方确认", 本 sub-plan 需要拆成 invite/pending transfer 流程, 不能在当前 API 上硬塞.

## UI 草图

```
[Edit.tsx Advanced section]
─────── Danger zone ─────────
Transfer ownership to another user:
  Email: [_______________]
  [Transfer →]

[确认 modal]
+-------------------------------------+
| Transfer "/foo" to alice@example.com? |
| You will lose ownership immediately.  |
| [Cancel]            [Yes, transfer]   |
+-------------------------------------+
```

## e2e 测试

```ts
test('owner A 把 /foo 转给 B, A dashboard 消失, B dashboard 出现', async () => {
  // 准备: A owns /foo, B 已注册
  // POST /links/foo/transfer { toEmail: B.email }
  // 期望: 200, owner_id 改为 B
  // GET /dashboard as A → 不含 /foo
  // GET /dashboard as B → 含 /foo
  // audit_logs 含 TRANSFER 含 from=A, to=B
});

test('toEmail 未注册 → 404 USER_NOT_FOUND', ...);
test('非 owner 调 → 403', ...);
test('转给自己 → 400 SELF_TRANSFER', ...);
```

## DoD checklist (遵循 [SOP](./2026-05-13-feature-parity-master-plan.md#-per-feature-推进-sop-definition-of-done))

- [ ] 1. type-check + 本地启动
- [ ] 2. `bun test tests/e2e/F11-transfer.test.ts` 绿
- [ ] 3. commit + push, 前缀 `[F11]`
- [ ] 4. Railway env: 无新增
- [ ] 5. deploy SUCCESS
- [ ] 6. 浏览器验证生产: 准备两个测试账号 A/B, A 转一个 slug 给 B, 双方 dashboard 状态正确
- [ ] 7. README 勾选 + CURRENT-ARCHITECT 更新

## 风险

| 风险 | 缓解 |
|---|---|
| 接收方收到不想要的链接 | 二次确认默认对发起方; 接收方可立即 transfer 回去 |
| email 大小写匹配漏 | SQL 用 `LOWER(email) = LOWER($1)` |
| race: 同时两个 transfer 请求 | DB row-level lock (FOR UPDATE) |
