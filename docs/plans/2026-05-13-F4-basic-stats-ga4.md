# F4. 基础 Stats Dashboard + GA4 上报接入

**Date**: 2026-05-13
**Duration**: 2.5 天
**Priority**: P0
**Status**: 📋 Planning
**Parent plan**: [feature-parity-master-plan](./2026-05-13-feature-parity-master-plan.md)

## Overview

Dashboard 顶部显示"近 30 天总点击 + 日访问折线". **数据源 = GA4 Data API** (沿用 master, 保留历史连续). 同时把 `redirect.ts` 接 GA4 Measurement Protocol 上报 (**fire-and-forget**, 不阻塞 redirect, 比 master 的 await 改进).

## Deliverables

新文件:
- `src/lib/gcp.ts` — 启动时把 `GOOGLE_APPLICATION_CREDENTIALS_JSON` 解码到 `/tmp/gcp-key.json` (移植 master `utils.ts:loadGcpCredentials`)
- `src/routes/api/ga4.ts` — `POST /api/v1/ga4/reports` (requireAuth) 透传 GA4 Data API
- `src/web/components/StatsChart.tsx` — recharts 折线图 + 总点击 summary
- `tests/e2e/F4-stats.test.ts`
- `tests/browser/F4.spec.ts`

修改:
- `src/routes/redirect.ts`:
  - 在现有 `queueMicrotask(recordVisit)` 旁再加 `queueMicrotask(reportGA4)`
  - `reportGA4` 用 Bun `fetch` POST 到 GA4 Measurement Protocol endpoint, **不 await**
  - 事件名 `link_redirect`; client_id 从 `_ga` cookie 读, 无则生成 16-byte hex 并 set cookie
- `src/web/pages/Dashboard.tsx` (F3 完成的) 顶部嵌入 `<StatsChart />`
- `src/server.ts`: 启动调一次 `loadGcpCredentials()`

依赖:
- `bun add @google-analytics/data recharts`

## 依赖与现状

- F1 + F3 完成
- env: ✅ GA4_MEASUREMENT_ID, GA4_API_SECRET, GA4_PROPERTY_ID, GOOGLE_APPLICATION_CREDENTIALS_JSON **本地已配**, Railway 未配 (本 feature 同步)

## API 设计

### `POST /api/v1/ga4/reports` (requireAuth)

透传前端构造的 GA4 Data API request body, 自动补 `property`:

```jsonc
// req (前端构造, 跟 master apiv2.ts:14-41 同结构)
{
  "dateRanges": [{ "startDate": "2026-04-13", "endDate": "2026-05-13" }],
  "dimensions": [{ "name": "date" }],
  "metrics": [{ "name": "eventCount" }],
  "dimensionFilter": {
    "filter": {
      "fieldName": "eventName",
      "stringFilter": { "value": "link_redirect", "matchType": "EXACT" }
    }
  },
  "limit": 30
}

// 后端补: property: `properties/${GA4_PROPERTY_ID}`
// 调 BetaAnalyticsDataClient.runReport(...)

// 200: 透传 GA4 response { dimensionHeaders, metricHeaders, rows, ... }
// 500: GA4 凭据错或 quota 超限
```

### Measurement Protocol 上报 (redirect.ts 内部, 无 endpoint)

```ts
// fire-and-forget, 不 await
function reportGA4(req, slug) {
  const eventData = {
    client_id: getOrGenClientId(req),
    user_id: req.user?.id ?? undefined,
    events: [{
      name: 'link_redirect',
      params: {
        page_location: `${PUBLIC_BASE_URL}/${slug}`,
        page_path: `/${slug}`,
        slug,
        user_agent: req.header('user-agent'),
        referer: req.header('referer'),
      }
    }]
  };
  fetch(`https://www.google-analytics.com/mp/collect?measurement_id=${MID}&api_secret=${SECRET}`,
    { method: 'POST', body: JSON.stringify(eventData) })
    .catch(err => console.error('[GA4] report failed', err));
}
```

## e2e 测试

```ts
test('redirect 触发 GA4 上报 (mock measurement protocol)', async () => {
  // mock fetch to https://www.google-analytics.com/...
  // GET /foo → 302
  // 期望: mock 收到 1 次 POST, body.events[0].name === 'link_redirect'
  // 期望: redirect 响应时间 < 50ms (上报不阻塞)
});

test('Dashboard 顶部 stats 调 GA4 Data API', async () => {
  // mock /api/v1/ga4/reports
  // login + GET /dashboard
  // 期望: 折线图渲染 30 个数据点, 总点击数与 mock 一致
});

test('GA4 凭据缺失 → ga4/reports 返回 500, 前端降级 (不崩溃)', ...);
test('未登录调 ga4/reports → 401', ...);
```

## DoD checklist (遵循 [SOP](./2026-05-13-feature-parity-master-plan.md#-per-feature-推进-sop-definition-of-done))

- [ ] 1. type-check + 本地启动 (本地 .env 已有 GA4 凭据)
- [ ] 2. `bun test tests/e2e/F4-stats.test.ts` 绿
- [ ] 3. commit + push, 前缀 `[F4]`
- [ ] 4. Railway env (一次性把 4 个 GA4/GCP 推到生产):
  - `GA4_MEASUREMENT_ID` (从本地 .env 复制)
  - `GA4_API_SECRET` (从本地 .env 复制)
  - `GA4_PROPERTY_ID` (从本地 .env 复制)
  - `GOOGLE_APPLICATION_CREDENTIALS_JSON` (从本地 .env 复制)
  - **建议同时**: 生成独立的 v2-hono GCP service account (不复用 master), IAM 给 GA4 Data API Viewer + Measurement Protocol Sender; 替换上面的 `GOOGLE_APPLICATION_CREDENTIALS_JSON` 值
- [ ] 5. deploy SUCCESS
- [ ] 6. 浏览器验证生产:
  - 访问任意 slug 触发 redirect (3-5 次)
  - 等待 ~1 分钟 (GA4 摄入延迟)
  - 登录 → /dashboard → 顶部 stats 折线图显示数据 (≥ 刚才的次数)
  - 检查 Network 面板 `/api/v1/ga4/reports` 返回 200
  - 检查 console 无 GA4 上报错误
  - build SHA 匹配
- [ ] 7. README 勾选; CURRENT-ARCHITECT 更新 (加 `routes/api/ga4.ts`, `lib/gcp.ts`)

## 风险

| 风险 | 缓解 |
|---|---|
| GA4 摄入延迟 (~30s-数分钟) 让 e2e flaky | e2e 用 retry + 长 timeout (60s); 浏览器验证手动等 |
| Measurement Protocol 上报失败 (fetch 抛错) | catch 不重抛, log; 监控 5xx 计数告警 |
| GA4 quota 限额 | 当前流量 < 1k/day 远低于免费额度; 触发后采样上报 |
| `@napi-rs/canvas` 间接通过 `@google-analytics/data` 引入 | 检查 transitive deps; Bun 兼容性 spike (W0) |
