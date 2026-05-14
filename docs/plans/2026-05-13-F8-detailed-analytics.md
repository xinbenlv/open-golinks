# F8. 详细 Analytics 页 (移植 master dashboard.vue)

**Date**: 2026-05-13
**Duration**: 3 天
**Priority**: P1
**Status**: 📋 Planning
**Parent plan**: [feature-parity-master-plan](./2026-05-13-feature-parity-master-plan.md)

## Overview

完整移植 master `pages/dashboard.vue` 到 React: 时间范围预设 (7/30/90/180 天), pagePath 正则过滤, 三图表 (Group by Path 表 / Pie / Line by date), pagePath vs pagePathPlusQueryString 切换. **数据源 = GA4 Data API** (复用 [F4](./2026-05-13-F4-basic-stats-ga4.md) 的 `/api/v1/ga4/reports` 端点).

## Deliverables

新文件:
- `src/web/pages/Stats/index.tsx` — 用户级 stats (覆盖该用户全部 slug)
- `src/web/pages/Stats/[slug].tsx` — 单 slug stats 详情
- `src/web/components/stats/LineChart.tsx` — recharts 折线
- `src/web/components/stats/PieChart.tsx` — recharts 饼图
- `src/web/components/stats/DateRangePicker.tsx`
- `src/web/components/stats/PathRegexInput.tsx`
- `tests/e2e/F8-detailed-stats.test.ts`
- `tests/browser/F8.spec.ts`

无后端新增 — 全部复用 [F4](./2026-05-13-F4-basic-stats-ga4.md) 的 `POST /api/v1/ga4/reports`.

## 依赖与现状

- F4 完成 (端点 + 凭据 + 上报)
- env: 无新增

## 实施要点 (移植自 master)

`master/pages/dashboard.vue:120-200` 的 fetchData 逻辑直接搬:

```ts
// 两次 GA4 query
// 1. Group by path (pagePath 或 pagePathPlusQueryString)
const groupByPath = await postGA4({
  dateRanges: [{ startDate, endDate }],
  dimensions: [{ name: usePathPlusQueryString ? 'pagePathPlusQueryString' : 'pagePath' }],
  metrics: [{ name: 'eventCount' }, { name: 'activeUsers' }],
  dimensionFilter,
  limit: resultLimit,
});

// 2. Time series by date
const timeSeries = await postGA4({
  dateRanges: [{ startDate, endDate }],
  dimensions: [{ name: 'date' }],
  metrics: [{ name: 'eventCount' }, { name: 'activeUsers' }],
  dimensionFilter,
  limit: resultLimit,
});
```

默认 `pathDoesNotMatchRegex` (排除 system path) 直接抄 master `pages/dashboard.vue:99`.

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
test('改时间范围为 30 天 → 重新拉数据 (mock /ga4/reports)', ...);
test('输入正则 ^/foo- 只剩匹配 path', ...);
test('切 pagePathPlusQueryString → 不同 query string 分开显示', ...);
test('点单 path 链接跳到 /stats/<slug>', ...);
test('空数据状态显示 "No data yet"', ...);
test('GA4 端点 500 → 显示降级错误而非崩溃', ...);
```

## DoD checklist (遵循 [SOP](./2026-05-13-feature-parity-master-plan.md#-per-feature-推进-sop-definition-of-done))

- [ ] 1. type-check + 本地启动
- [ ] 2. `bun test tests/e2e/F8-detailed-stats.test.ts` 绿
- [ ] 3. commit + push, 前缀 `[F8]`
- [ ] 4. Railway env: 无新增 (F4 已配 GA4)
- [ ] 5. deploy SUCCESS
- [ ] 6. 浏览器验证生产:
  - /stats 打开, 默认 7 天数据显示
  - 改时间范围, 表格 + 图表更新
  - 输入正则过滤
  - 跟 master 对比同一时间范围数据是否一致 (sanity check)
  - build SHA 匹配
- [ ] 7. README 勾选 + CURRENT-ARCHITECT 更新

## 风险

| 风险 | 缓解 |
|---|---|
| recharts vs ECharts 视觉差异 | 接受 — 用户预期 v2-hono 是新设计; 关键交互保持 |
| 复杂正则在 GA4 PARTIAL_REGEXP 不支持 | 文档明确支持的语法; 测试常见 case |
| GA4 quota (10k queries/day 免费) | 当前用量 < 100/day, 远低于上限 |
