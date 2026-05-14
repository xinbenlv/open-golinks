# F14. 链接 metadata (tags, description)

**Date**: 2026-05-13
**Duration**: 1 天
**Priority**: P2
**Status**: ✅ Done (2026-05-14)
**Parent plan**: [feature-parity-master-plan](./2026-05-13-feature-parity-master-plan.md)

## Overview

用 `links.metadata` JSONB 存 `description` (短文本) + `tags` (string[]); Dashboard 支持按 tag 过滤.

## 验证记录

- Implementation commit: `9e5f48d [F14] add link metadata tags`
- Local:
  - `bun run type-check`
  - `bun run build`
  - `bun test tests/e2e/F14-metadata.test.ts`
  - `bun test tests/e2e/F6-warn.test.ts tests/e2e/F14-metadata.test.ts tests/e2e/F13-extension-compat.test.ts`
  - local production smoke: `/dashboard` SPA fallback 200, unauth `/api/v1/links` 401
- Production:
  - Railway deployment `1484891b-fd92-4fb9-842a-e0b722999a55` SUCCESS
  - `RUN_BROWSER_TESTS=1 EXPECTED_SHA=9e5f48 bun test tests/browser/F14.spec.ts` PASS

## Deliverables

新文件:
- [x] `src/web/components/TagInput.tsx` — 多 tag 输入 (Chip 风格)
- [x] `tests/e2e/F14-metadata.test.ts`
- [x] `tests/browser/F14.spec.ts`

修改:
- `src/routes/api/links.ts`:
  - [x] `POST` + `PATCH` 接受 `metadata.{description, tags, show_warning}` (zod strict whitelist: tags max 10, 每个 max 20 chars; description max 280 chars)
  - [x] `GET /?owner=me&tag=<tag>` 加按 tag 过滤
- [x] `src/web/pages/Edit.tsx`: 加 description textarea + TagInput
- [x] `src/web/pages/Dashboard.tsx`: 加 Tag filter
- [x] `src/web/components/LinkRow.tsx`: Dashboard 行显示 description + tag chips

## 依赖与现状

- F2 (PATCH endpoint) 完成
- F3 (dashboard) 完成
- DB: `links.metadata` JSONB 已就绪, schema 注释里就预留了 `tags[]` 和 `description`
- env: 无新增

## API 设计

### `PATCH /api/v1/links/:slug` 扩展

```jsonc
// req body 现在支持
{
  "url": "...",  // 可选 (F2 已有)
  "metadata": {
    "description": "TPS report",
    "tags": ["work", "urgent"],
    "show_warning": false  // F6 字段
  }
}
```

`metadata` 是 partial — 不传的 key 保持原值. zod schema 必须 strict whitelist, 未列出的 key 拒绝:

```ts
z.object({
  description: z.string().max(280).optional(),
  tags: z.array(z.string().max(20)).max(10).optional(),
  show_warning: z.boolean().optional(),
}).partial()
```

如果 F6 已先实现 `show_warning`, F14 要复用同一 metadata merge helper, 不得覆盖或丢弃已有 `show_warning`.

### `GET /api/v1/links?owner=me&tag=work` (F3 扩展)

只返回带对应 tag 的行. PG JSONB containment 写法应为:

```sql
metadata @> '{"tags":["work"]}'::jsonb
-- 或
(metadata->'tags') @> '["work"]'::jsonb
```

不要写 `metadata.tags @> ARRAY['work']`; 那是数组语法, 不适用于当前 JSONB 字段.

## UI 草图

```
[Edit.tsx]
─── Metadata ───
Description: [TPS report - quarterly__________]
Tags: [work ×] [urgent ×] [+ add tag]

[Dashboard.tsx 搜索栏旁]
Tags: [All ▼] (multi-select dropdown)
  ☐ work (12)
  ☐ urgent (3)
  ☐ personal (8)
```

## e2e 测试

```ts
test('PATCH /links/foo with metadata.tags=[work,urgent] → DB 存入', ...);
test('Dashboard 显示 tag chip in LinkRow', ...);
test('选择 tag work → 只显示带 work 的链接', ...);
test('清空 tags (PATCH metadata.tags=[]) → 过滤器不再列该 tag', ...);
test('超过 10 个 tag / 单 tag 超 20 chars → 400', ...);
test('description > 280 chars → 400', ...);
```

## DoD checklist (遵循 [SOP](./2026-05-13-feature-parity-master-plan.md#-per-feature-推进-sop-definition-of-done))

- [x] 1. type-check + 本地启动
- [x] 2. `bun test tests/e2e/F14-metadata.test.ts` 绿
- [x] 3. commit + push, 前缀 `[F14]`
- [x] 4. Railway env: 无新增
- [x] 5. deploy SUCCESS
- [x] 6. 浏览器验证生产: 给一个 slug 加 description + tags, dashboard 过滤工作
- [x] 7. README 勾选 + CURRENT-ARCHITECT 更新

## 风险

| 风险 | 缓解 |
|---|---|
| `metadata.tags` 查询慢 (PG JSONB 无默认索引) | 当前规模 < 10k 行不优化; 触发后加 GIN 索引 `CREATE INDEX ON links USING GIN ((metadata->'tags'))` |
| 用户加入 tag "show_warning=true" 钻空子 | zod schema 严格 whitelist, 不在表里的 key 拒绝 |
| 多 tag UI 在小屏溢出 | Chip 自动 wrap + tag 数量超 5 折叠 |
