# F12. 公开链接发现 (Browse Public Links)

**Date**: 2026-05-13
**Duration**: TBD (若 do, ~2 天)
**Priority**: P2
**Status**: 📋 Decision Pending — **W4 末决策 do/drop**
**Parent plan**: [feature-parity-master-plan](./2026-05-13-feature-parity-master-plan.md)

## Overview

浏览 `is_public=true` 链接的目录页. **master 无此功能**, 是 v2-hono 候选新增. 决策 deadline W4 末 (切流时), 避免无限 TBD.

## 决策依据

| 选项 | 后果 |
|---|---|
| **Do** | 留 `GET /api/v1/links?owner=public` (当前 stub), 加 `/browse` 页 + SEO 友好 |
| **Drop** | 删除现有 `GET /api/v1/links` 公开 list 端点, 改为登录后 owner-only; 不留 `/browse` 页 |

## Deliverables (若 Do)

新文件:
- `src/web/pages/Browse.tsx`
- `tests/e2e/F12-browse.test.ts`
- `tests/browser/F12.spec.ts`

修改:
- `src/routes/api/links.ts` 的 `GET /` (当前 stub, 需补): 加分页 + 搜索 + 排序 (visits desc / created_at desc)
- 顶部导航加 "Browse" 入口

## Deliverables (若 Drop)

修改:
- `src/routes/api/links.ts` 的 `GET /` — 改成 `requireAuth + owner=me` 强制
- 去掉 Stub 行为
- 不留 `/browse` 路由

## 依赖与现状

- 任意 P0/P1 完成都可
- DB: `is_public` 字段已就绪, 索引 `idx_links_is_public` 已存在
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
```

## DoD checklist (若 Do, 遵循 [SOP](./2026-05-13-feature-parity-master-plan.md#-per-feature-推进-sop-definition-of-done))

- [ ] 0. W4 末决策 = Do
- [ ] 1-7. 同 SOP

## 风险

| 风险 | 缓解 |
|---|---|
| 公开列表暴露用户行为 (谁创建了哪个链接) | 不返回 owner_email, 只返回 slug + url + visits |
| SEO 流量过高消耗 quota | 加 robots.txt 控制 + rate limit (复用 F2) |
| 用户隐私担忧 — 不想链接公开 | 创建时默认 `is_public=true`? 还是 `false`? **当前 schema 默认 true** — 需要在 F2/F5 落地时确认是否改默认值 |
