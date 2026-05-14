# F8. 详细 Analytics 页 (移植 master dashboard.vue)

**Date**: 2026-05-13
**Duration**: 3 天
**Priority**: P1
**Status**: ✅ Done
**Parent plan**: [feature-parity-master-plan](./2026-05-13-feature-parity-master-plan.md)

## Overview

完整移植 master `pages/dashboard.vue` 到 React: 时间范围预设 (7/30/90/180 天), pagePath 正则过滤, 三图表 (Group by Path 表 / Pie / Line by date), pagePath vs pagePathPlusQueryString 切换. **数据源 = GA4 Data API**, 但必须复用/扩展 [F4](./2026-05-13-F4-basic-stats-ga4.md) 的 scoped stats API, 不暴露任意 GA4 passthrough.

## Deliverables

新文件:
- `src/web/pages/Stats/index.tsx` — 用户级 stats (覆盖该用户全部 slug)
- `src/web/pages/Stats/SlugStats.tsx` — 单 slug stats 详情 (React Router path `/stats/:slug`, 不使用 Next 风格 `[slug].tsx`)
- `src/web/components/stats/LineChart.tsx` — recharts 折线
- `src/web/components/stats/PieChart.tsx` — recharts 饼图
- `src/web/components/stats/DateRangePicker.tsx`
- `src/web/components/stats/PathRegexInput.tsx`
- `tests/e2e/F8-detailed-stats.test.ts`
- `tests/browser/F8.spec.ts`

后端:
- 扩展 [F4](./2026-05-13-F4-basic-stats-ga4.md) 的 `src/routes/api/stats.ts`, 新增 controlled query endpoint, 例如 `POST /api/v1/stats/query`
- `POST /api/v1/stats/query` 只接受 allowlisted 参数 (`range`, `limit`, `pathRegex`, `usePathPlusQueryString`, `slug?`); 2026-05-14 起为公开只读查询, 无 `slug` 时统计所有未删除 links, 有 `slug` 时校验该 slug 存在且未删除
- `/stats/:slug` 是公开单 slug GA4 视图; 不存在或已删除返回 404
- 更新 `src/routes/redirect.ts` RESERVED + `reserved-slug-fallthrough.test.ts`, 把 `stats` 加进去

## 依赖与现状

- F4 完成 (端点 + 凭据 + 上报)
- env: 无新增

## Implementation Notes (2026-05-14)

- 已实现 `POST /api/v1/stats/query`, 参数 allowlist 为 `range`, `groupBy`, `limit`, `pathRegex`, `usePathPlusQueryString`, `slug?`; 公开只读, 后端强制 all-links 或单 slug scope, 不暴露 GA4 passthrough.
- `groupBy` 在 v2 API 中固定为 `"path" | "date"`; `pagePathPlusQueryString` 通过 `usePathPlusQueryString` 控制, 避免暴露任意 GA4 dimension passthrough.
- `/stats` 与 `/stats/:slug` 已接入 React Router 公开路由, UI 包含 7/30/90/180 天范围、Top 10/20/50 path 表、path share 饼图、day 折线、path regex 和 query string toggle.
- `/stats` 已加入 redirect RESERVED 与 reserved-slug regression.

## 实施要点 (移植自 master)

`master/pages/dashboard.vue:120-200` 的 fetchData 逻辑直接搬:

```ts
// 两次 controlled stats query (后端内部转 GA4)
// 1. Group by path (pagePath 或 pagePathPlusQueryString)
const groupByPath = await postStatsQuery({
  range: selectedRange,
  groupBy: usePathPlusQueryString ? 'pagePathPlusQueryString' : 'pagePath',
  pathRegex,
  limit: resultLimit,
});

const timeSeries = await postStatsQuery({
  range: selectedRange,
  groupBy: 'date',
  pathRegex,
  limit: resultLimit,
});
```

默认全站查询不再传任意 GA4 passthrough; 后端用 slug 格式 `pagePath` 正则约束到短链路径, 并排除 `/healthz`、`/dashboard`、`/stats` 等 reserved/system path. 用户 `pathRegex` 只作为额外过滤条件.

## UI 草图

```
[/stats]
+-------------------------------------------------------+
|  [7d ▼] [Limit 10 ▼] [PathRegex __________] [Apply]   |
|  ☐ Include query string                                |
+-------------------------------------------------------+
| Group by Path                  | Percentage by Path   |
| Path     | Events | Users      |    [Pie chart]       |
| /foo     | 120    | 80         |                      |
| /bar     | 95     | 60         |                      |
| ...                            |                      |
+-------------------------------------------------------+
| Time Visualization by Day                             |
|    [Line chart 折线图 spanning width]                  |
+-------------------------------------------------------+
```

## e2e 测试

```ts
test('打开 /stats 默认显示 7 天 group by path 表 + 折线图', ...);
test('改时间范围为 30 天 → 重新拉数据 (mock /api/v1/stats/query)', ...);
test('输入正则 ^/foo- 只剩匹配 path', ...);
test('切 pagePathPlusQueryString → 不同 query string 分开显示', ...);
test('点单 path 链接跳到 /stats/<slug>', ...);
test('空数据状态显示 "No data yet"', ...);
test('stats endpoint 500 → 显示降级错误而非崩溃', ...);
test('访问不存在或已删除的 /stats/<slug> → 404', ...);
test('直接访问 /stats 不会被 redirectRoute 当成 slug', ...);
```

## DoD checklist (遵循 [SOP](./2026-05-13-feature-parity-master-plan.md#-per-feature-推进-sop-definition-of-done))

- [x] 1. type-check + 本地启动 (`bun run type-check`, `bun run build`, `PORT=3108 NODE_ENV=production bun src/server.ts` + `/api/v1/health`)
- [x] 2. `bun test tests/e2e/F8-detailed-stats.test.ts` 绿
- [x] 3. commit + push, 前缀 `[F8]` (`78adce8`)
- [x] 4. Railway env: 无新增 (F4 已配 GA4)
- [x] 5. deploy SUCCESS (`d9de1638-e319-45bb-b057-3062b0dba85f`, 2026-05-14)
- [x] 6. 浏览器验证生产 (`RUN_BROWSER_TESTS=1 EXPECTED_SHA=78adce bun test tests/browser/F8.spec.ts`):
  - /stats 打开, 默认 7 天数据显示
  - 改时间范围, 表格 + 图表更新
  - 输入正则过滤
  - stats query 返回 200, 空/延迟数据降级为 No data yet
  - build SHA 匹配
- [x] 7. README 勾选 + CURRENT-ARCHITECT 更新

## 风险

| 风险 | 缓解 |
|---|---|
| recharts vs ECharts 视觉差异 | 接受 — 用户预期 v2-hono 是新设计; 关键交互保持 |
| 复杂正则在 GA4 PARTIAL_REGEXP 不支持 | 文档明确支持的语法; 测试常见 case |
| GA4 quota (10k queries/day 免费) | 当前用量 < 100/day, 远低于上限 |
