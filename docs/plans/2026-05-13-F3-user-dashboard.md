# F3. 个人链接列表 / Dashboard

**Date**: 2026-05-13
**Duration**: 3 天
**Priority**: P0
**Status**: 📋 Planning
**Parent plan**: [feature-parity-master-plan](./2026-05-13-feature-parity-master-plan.md)

## Overview

登录用户看到"我创建的所有链接", 可分页 / 搜索 / 排序; 点行进 Edit 页. 对应 master `pages/user-links.vue`.

## Deliverables

新文件:
- `src/web/components/LinkRow.tsx` — 单行展示 (slug, url, visits, created_at, Edit/Delete 按钮)
- `src/web/hooks/useApi.ts` — fetch 包装, 自动注入 `Authorization: Bearer`
- `tests/e2e/F3-dashboard.test.ts`
- `tests/browser/F3.spec.ts`

修改:
- `src/routes/api/links.ts` 的 `GET /` — 扩展 query params: `owner=me|public`, `limit=`, `cursor=`, `q=` (ILIKE on slug + url), owner=me 需 `requireAuth`
- `src/web/pages/Dashboard.tsx` — 重写: 顶部用户欢迎 + 空状态 CTA + LinkRow 列表 + 滚动加载更多 + 搜索框

## 依赖与现状

- F1 (auth) 完成
- F2 (POST 写 `owner_id` + PATCH/DELETE) 完成; 否则登录用户新建链接不会出现在 `owner=me`
- DB: 索引 `idx_links_owner_id` 已存在 (`src/db/schema.ts:82`)
- env: 无新增

## API 设计

`GET /api/v1/links?owner=me&limit=20&cursor=<base64-encoded-created_at>&q=foo` (requireAuth when owner=me; 永远过滤 `deleted_at IS NULL`)

```jsonc
// 200
{
  "links": [
    { "slug": "...", "url": "...", "visits": 0, "createdAt": "...", "updatedAt": "...", "isPublic": true }
  ],
  "nextCursor": "<base64>" | null
}
```

Cursor 用 `(createdAt, slug)` 复合编码; 当 q 存在时, 同时匹配 slug 和 url (PG `ILIKE`, `q` 自动加 `%...%`). `owner=public` 行为留给 F12 决策, F3 不扩大公开列表能力.

## UI 草图

```
[Dashboard.tsx]
+--------------------------------------------------+
| 欢迎, zzn@d3serve.xyz                      [+ New]
|                                                  |
| [📊 stats placeholder (F4 注入)]                 |
|                                                  |
| 🔍 Search [_____________]                        |
| -------------------------------------------------|
| slug         | url             | visits  | actions
| /foo         | https://...     | 23      | [Edit] |
| /bar         | https://...     | 7       | [Edit] |
| ...                                              |
| [Loading more...]                                |
+--------------------------------------------------+

空状态:
+--------------------------------------------------+
| You haven't created any links yet.               |
| [Create your first link]                         |
+--------------------------------------------------+
```

## e2e 测试

```ts
test('30 条链接显示前 20 → 滚到底加载剩 10', ...);
test('搜索 "foo" 只显示匹配 slug/url 的行', ...);
test('点 LinkRow 跳 /edit/:slug', ...);
test('新用户看到空状态 CTA, 点击跳 /create', ...);
test('未登录访问 /dashboard → 跳 /login', ...); // 复用 F1 AuthGuard
```

## DoD checklist (遵循 [SOP](./2026-05-13-feature-parity-master-plan.md#-per-feature-推进-sop-definition-of-done))

- [ ] 1. type-check + 本地启动
- [ ] 2. `bun test tests/e2e/F3-dashboard.test.ts` 绿
- [ ] 3. commit + push, 前缀 `[F3]`
- [ ] 4. Railway env: 无新增
- [ ] 5. deploy SUCCESS
- [ ] 6. 浏览器验证: 登录 → /dashboard 看到自己链接列表 → 搜索过滤工作 → 点行进 /edit/:slug; console / network 干净; build SHA 匹配
- [ ] 7. README 勾选 + CURRENT-ARCHITECT 更新

## 风险

| 风险 | 缓解 |
|---|---|
| ILIKE 在 1M 行后慢 | 当前规模 < 10k, 不优化; 触发后加 `pg_trgm` GIN 索引 |
| Cursor 编码错误导致漏数据 | e2e 显式验证边界 (恰好 20 条 / 21 条) |
