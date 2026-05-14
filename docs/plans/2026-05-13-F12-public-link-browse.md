# F12. 公开链接发现 (Browse Public Links)

**Date**: 2026-05-13
**Duration**: TBD (若 do, ~2 天)
**Priority**: P2
**Status**: 📋 Decision Pending — **W4 末决策 do/drop**
**Parent plan**: [feature-parity-master-plan](./2026-05-13-feature-parity-master-plan.md)

## Overview

浏览 `is_public=true` 链接的目录页. **master 无此功能**, 是 v2-hono 候选新增. 决策 deadline W4 末 (切流时), 避免无限 TBD.

隐私默认: 在 F12 做出 Do 决策前, 不应扩大公开发现能力. F2/F3 实施时必须避免因为 schema 当前 `is_public=true` 默认值而意外暴露新/legacy 链接列表.

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
- `src/routes/api/links.ts` 的 `GET /` — 改成 `requireAuth + owner=me` 强制
- 去掉 Stub 行为
- 不留 `/browse` 路由
- 若继续保留 `is_public` 字段, UI 不展示公开开关; 新建链接写 `is_public=false` 或在 schema migration 中调整默认值

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
test('直接访问 /browse 不会被 redirectRoute 当成 slug', ...);
```

## DoD checklist (若 Do, 遵循 [SOP](./2026-05-13-feature-parity-master-plan.md#-per-feature-推进-sop-definition-of-done))

- [ ] 0. W4 末决策 = Do
- [ ] 1-7. 同 SOP

## 风险

| 风险 | 缓解 |
|---|---|
| 公开列表暴露用户行为 (谁创建了哪个链接) | 不返回 owner_email, 只返回 slug + url + visits |
| SEO 流量过高消耗 quota | 加 robots.txt 控制 + rate limit (复用 F2) |
| 用户隐私担忧 — 不想链接公开 | F12 决策前默认按 private 处理; 若 Do, 创建 UI 必须显式显示公开开关并解释后果, 不允许静默公开 legacy 链接 |
