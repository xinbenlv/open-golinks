# F4. 基础 Stats Dashboard + GA4 上报接入

**Date**: 2026-05-13
**Duration**: 2.5 天
**Priority**: P0
**Status**: 📋 Planning
**Parent plan**: [feature-parity-master-plan](./2026-05-13-feature-parity-master-plan.md)

## Overview

Dashboard 顶部显示"近 30 天总点击 + 日访问折线". **数据源 = GA4 Data API** (沿用 master, 保留历史连续). 同时把 `redirect.ts` 接 GA4 Measurement Protocol 上报 (**fire-and-forget**, 不阻塞 redirect, 比 master 的 await 改进).

关键决策:
- 为了保留 master 历史连续性, v2-hono 默认继续上报 `event_name = page_view`, 不改成 `link_redirect`
- 为避免任意登录用户查询整个 GA4 property, 不暴露任意透传 GA4 endpoint; API 必须按当前用户 owned slugs 注入 scope
- `_ga` cookie 必须在 redirect response 生成前读/写; 只有 Measurement Protocol `fetch` 放进 async fire-and-forget

## Deliverables

新文件:
- `src/lib/gcp.ts` — 启动时把 `GOOGLE_APPLICATION_CREDENTIALS_JSON` 解码到 `/tmp/gcp-key.json` (移植 master `utils.ts:loadGcpCredentials`)
- `src/lib/ga4.ts` — GA4 Data API client + Measurement Protocol helper
- `src/routes/api/stats.ts` — scoped stats endpoints (requireAuth), 内部调用 GA4 Data API, 不透传任意 request
- `src/web/components/StatsChart.tsx` — recharts 折线图 + 总点击 summary
- `tests/e2e/F4-stats.test.ts`
- `tests/browser/F4.spec.ts`

修改:
- `src/routes/redirect.ts`:
  - 在现有 `queueMicrotask(recordVisit)` 旁再加 `queueMicrotask(reportGA4)`
  - redirect response 生成前读取 `_ga` cookie; 无则生成 16-byte hex 并 `Set-Cookie`
  - `reportGA4` 用 Bun `fetch` POST 到 GA4 Measurement Protocol endpoint, **不 await**
  - 事件名 `page_view`; params 增加 `slug`, `source: 'v2-hono'`, `is_redirect: true`
- `src/web/pages/Dashboard.tsx` (F3 完成的) 顶部嵌入 `<StatsChart />`
- `src/server.ts`: 启动调一次 `loadGcpCredentials()`

依赖:
- `bun add @google-analytics/data recharts`

## 依赖与现状

- F1 + F3 完成
- env: ✅ GA4_MEASUREMENT_ID, GA4_API_SECRET, GA4_PROPERTY_ID, GOOGLE_APPLICATION_CREDENTIALS_JSON **本地已配**, Railway 未配 (本 feature 同步)

## API 设计

### `GET /api/v1/stats/summary?days=30` (requireAuth)

返回当前用户 owned links 的基础汇总. 后端流程:
1. 查询 `links WHERE owner_id = currentUser AND deleted_at IS NULL`
2. 如果没有 owned slugs, 返回空数据
3. 构造 GA4 Data API query, 自动注入 `eventName = page_view` + `pagePath` 匹配当前用户 slugs
4. 返回前端需要的稳定 shape, 不透传 GA4 原始 response

```jsonc
// 200
{
  "totalClicks": 42,
  "days": [
    { "date": "2026-05-01", "eventCount": 3, "activeUsers": 2 }
  ],
  "source": "ga4",
  "scope": { "slugCount": 12 }
}
```

GA4 filter notes:
- 基础版可用 `pagePath` 的 `PARTIAL_REGEXP` 拼出 `^/(foo|bar|baz)$`
- slug 很多导致 regex 过长时分批查询再合并; 当前规模可先不优化
- F8 可在此基础上扩展 controlled query, 仍必须注入 owner scope

### Measurement Protocol 上报 (redirect.ts 内部, 无 endpoint)

```ts
// fire-and-forget, 不 await
function reportGA4(req, slug) {
  // called after client_id cookie has been resolved before redirect response
  const eventData = {
    client_id: getOrGenClientId(req),
    user_id: req.user?.id ?? undefined,
    events: [{
      name: 'page_view',
      params: {
        page_location: `${PUBLIC_BASE_URL}/${slug}`,
        page_path: `/${slug}`,
        page_title: `/${slug}`,
        slug,
        source: 'v2-hono',
        is_redirect: true,
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
  // 期望: response set _ga cookie when missing
  // 期望: mock 收到 1 次 POST, body.events[0].name === 'page_view'
  // 期望: body.events[0].params.source === 'v2-hono'
  // 期望: redirect 响应时间 < 50ms (上报不阻塞)
});

test('Dashboard 顶部 stats 调 scoped stats endpoint', async () => {
  // mock /api/v1/stats/summary
  // login + GET /dashboard
  // 期望: 折线图渲染 30 个数据点, 总点击数与 mock 一致
});

test('用户 A 不能通过 stats endpoint 看到用户 B 的 slug 数据', ...);
test('GA4 凭据缺失 → stats/summary 返回 500, 前端降级 (不崩溃)', ...);
test('未登录调 stats/summary → 401', ...);
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
  - 检查 Network 面板 `/api/v1/stats/summary` 返回 200
  - 检查 console 无 GA4 上报错误
  - build SHA 匹配
- [ ] 7. README 勾选; CURRENT-ARCHITECT 更新 (加 `routes/api/stats.ts`, `lib/gcp.ts`, `lib/ga4.ts`)

## 风险

| 风险 | 缓解 |
|---|---|
| GA4 摄入延迟 (~30s-数分钟) 让 e2e flaky | e2e 用 retry + 长 timeout (60s); 浏览器验证手动等 |
| Measurement Protocol 上报失败 (fetch 抛错) | catch 不重抛, log; 监控 5xx 计数告警 |
| 任意 GA4 passthrough 泄露全站数据 | 不暴露 passthrough; stats endpoint 只接受 allowlisted params, 后端注入 owner slug scope |
| GA4 quota 限额 | 当前流量 < 1k/day 远低于免费额度; 触发后采样上报 |
| `@napi-rs/canvas` 间接通过 `@google-analytics/data` 引入 | 检查 transitive deps; Bun 兼容性 spike (W0) |
