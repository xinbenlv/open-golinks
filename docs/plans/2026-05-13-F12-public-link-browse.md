# F12. 公开链接发现 (Browse Public Links)

**Date**: 2026-05-13
**Duration**: 0.5 天 (Drop path)
**Priority**: P2
**Status**: ✅ Done — **Drop** (2026-05-14)
**Parent plan**: [feature-parity-master-plan](./2026-05-13-feature-parity-master-plan.md)

## Overview

浏览 `is_public=true` 链接的目录页. **master 无此功能**, 原为 v2-hono 候选新增; 2026-05-14 已决策 Drop.

隐私默认: F12 已按总计划默认决策 **Drop** 落地, 不扩大公开发现能力. `GET /api/v1/links` 现在只允许登录用户列出自己的链接; 新建/恢复链接显式写 `is_public=false`, schema 默认值也改为 `false`.

## 决策结果

- **Decision**: Drop
- **Reason**: master 无公开 browse 能力; 当前没有明确产品/隐私需求支持公开目录, 默认保护用户链接发现面.
- **Implementation commits**:
  - `df9170c [F12] drop public browse surface`
  - `1f5beb0 [F12] ignore expected privacy response console noise`
- **Production verification**:
  - Railway deployment `dabf8128-2efa-49ee-8903-c6b202ae5355` SUCCESS
  - `railway run --service open-golinks-v2-hono --environment production --no-local -- bun scripts/run-migrations.ts`
  - `RUN_BROWSER_TESTS=1 EXPECTED_SHA=1f5beb bun test tests/browser/F12.spec.ts` PASS

## 决策依据

| 选项 | 后果 |
|---|---|
| **Do** | 留 `GET /api/v1/links?owner=public` (当前 stub), 加 `/browse` 页 + SEO 友好; 同时把 `browse` 加入 redirect RESERVED + reserved route test |
| **Drop** | 删除现有 `GET /api/v1/links` 公开 list 端点, 改为登录后 owner-only; 不留 `/browse` 页; 新建链接默认 private |

## Deliverables (若 Do)

新文件:
- `src/web/pages/Browse.tsx`
- `tests/e2e/F12-browse.test.ts`
- `tests/browser/F12.spec.ts`

修改:
- `src/routes/api/links.ts` 的 `GET /` (当前 stub, 需补): 加分页 + 搜索 + 排序 (visits desc / created_at desc)
- 顶部导航加 "Browse" 入口
- `src/routes/redirect.ts` + `tests/e2e/reserved-slug-fallthrough.test.ts`: 把 `browse` 加入 RESERVED

## Deliverables (若 Drop)

修改:
- [x] `src/routes/api/links.ts` 的 `GET /` — 改成 `requireAuth + owner=me` 强制
- [x] 去掉 Stub 行为; `owner=public` 现在返回 `INVALID_INPUT`
- [x] 不留 `/browse` 路由
- [x] 继续保留 `is_public` 字段, UI 不展示公开开关; 新建/恢复链接写 `is_public=false`, schema migration 调整默认值
- [x] `tests/e2e/F12-browse.test.ts` 固定 owner-only list、`owner=public` 拒绝、private create/restore
- [x] `tests/browser/F12.spec.ts` 固定生产 browser/privacy smoke

## 依赖与现状

- 任意 P0/P1 完成都可
- DB: `is_public` 字段已就绪, 索引 `idx_links_is_public` 已存在; default 已改为 `false`
- env: 无新增

## API 设计 (若 Do)

`GET /api/v1/links?owner=public&limit=20&cursor=&sort=visits|created_at`

```jsonc
// 200
{ "links": [...], "nextCursor": "..." }
// 仅返回 is_public=true AND deleted_at IS NULL
```

匿名可访问 (无 requireAuth).

## UI 草图 (若 Do)

```
[Browse.tsx]
+----------------------------------+
| Browse Public Links              |
| Sort: [Most visited ▼]           |
|                                  |
| /interesting    https://...  120 |
| /useful         https://...   95 |
| ...                              |
+----------------------------------+
```

## e2e 测试 (若 Do)

```ts
test('访客访问 /browse 显示公开链接列表 (按 visits desc)', ...);
test('私有 is_public=false 链接不出现', ...);
test('软删链接不出现', ...);
test('点链接跳到目标 URL (而不是 /edit)', ...);
test('直接访问 /browse 不会被 redirectRoute 当成 slug', ...);
```

## DoD checklist (Drop path, 遵循 [SOP](./2026-05-13-feature-parity-master-plan.md#-per-feature-推进-sop-definition-of-done))

- [x] 0. W4 末决策 = Drop (采用总计划默认)
- [x] 1. Review plan, lock scope: 关闭公开 list, 不新增 `/browse`
- [x] 2. e2e before implementation: `tests/e2e/F12-browse.test.ts`
- [x] 3. Implement: API owner-only, create/restore private, schema default false, UI 去公开勾选
- [x] 4. Local verification: `bun run type-check`; `bun run build`; `bun test tests/e2e/F12-browse.test.ts tests/e2e/F3-dashboard.test.ts`; local production smoke
- [x] 5. Commit + push: `df9170c`, `1f5beb0`
- [x] 6. Deploy + production browser verification: Railway SUCCESS + `tests/browser/F12.spec.ts` PASS
- [x] 7. Docs/checklist updated

## 风险

| 风险 | 缓解 |
|---|---|
| 公开列表暴露用户行为 (谁创建了哪个链接) | 不返回 owner_email, 只返回 slug + url + visits |
| SEO 流量过高消耗 quota | 加 robots.txt 控制 + rate limit (复用 F2) |
| 用户隐私担忧 — 不想链接公开 | 当前已 Drop 且默认 private; 若未来重新 Do, 创建 UI 必须显式显示公开开关并解释后果, 不允许静默公开 legacy 链接 |
