# F10. URL 历史展示

**Date**: 2026-05-13
**Duration**: 0.5 天
**Priority**: P1
**Status**: ✅ Done
**Parent plan**: [feature-parity-master-plan](./2026-05-13-feature-parity-master-plan.md)

## Overview

Edit 页右侧 / 折叠区显示该链接的 URL 历史 timeline. 纯 UI feature, 后端无改动.

## Deliverables

新文件:
- `src/web/components/UrlHistory.tsx`
- `tests/e2e/F10-url-history.test.ts`
- `tests/browser/F10.spec.ts`

修改:
- `src/web/pages/Edit.tsx`: 加 `<UrlHistory />` 区块

## 依赖与现状

- F2 (PATCH 写 url_history) 完成
- DB: `links.url_history` (jsonb) 已就绪, F2 写入
- API: 复用 `GET /api/v1/links/:slug` (response 已含 `urlHistory`)
- env: 无新增

## Implementation Notes (2026-05-14)

- 已实现 `UrlHistory` 组件并嵌入 Edit 页, 展示 current URL、历史 URL newest-first、original 标记和空状态.
- `normalizeUrlHistoryEntries` 兼容 camelCase/snake_case 历史字段, malformed legacy 值会被忽略并回退为空数组.
- 后端无新增端点, 仍复用 `GET /api/v1/links/:slug`.

## UI 草图

```
[Edit.tsx 右侧或下方]
URL History
+--------------------------------------------------------+
| Current: https://new.example (since 2026-05-12)        |
| ────────────────────────────────                       |
| 2026-05-10  https://intermediate.example               |
| 2026-04-22  https://original.example (original)        |
+--------------------------------------------------------+
```

如果 url_history 为空 — 显示 "No previous URLs".

## e2e 测试

```ts
test('依次改 URL A → B → C, history 倒序显示 B (changed at t2) + A (original t1)', ...);
test('从未改过的 link → 显示 "No previous URLs"', ...);
test('history JSON 损坏 (旧数据格式) → 显示 fallback 不崩溃', ...);
```

## DoD checklist (遵循 [SOP](./2026-05-13-feature-parity-master-plan.md#-per-feature-推进-sop-definition-of-done))

- [x] 1. type-check + 本地启动 (`bun run type-check`, `bun run build`, `PORT=3110 NODE_ENV=production bun src/server.ts` + `/api/v1/health`)
- [x] 2. `bun test tests/e2e/F10-url-history.test.ts` 绿
- [x] 3. commit + push, 前缀 `[F10]` (`f869525`)
- [x] 4. Railway env: 无新增
- [x] 5. deploy SUCCESS (`4c1fb9ec-f3f1-4507-b398-4123395cdac1`, 2026-05-14)
- [x] 6. 浏览器验证生产 (`RUN_BROWSER_TESTS=1 EXPECTED_SHA=f86952 bun test tests/browser/F10.spec.ts`):
  - 对测试 slug 改 2-3 次 url
  - /edit/<slug> 看到 URL History timeline
  - build SHA 匹配
- [x] 7. README 勾选 + CURRENT-ARCHITECT 更新

## 风险

| 风险 | 缓解 |
|---|---|
| dump 数据老链接 url_history 格式不一致 | 兼容性 parse + fallback "No previous URLs" |
