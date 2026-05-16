# components/

跨页面复用的轻量展示型组件 (与具体页面/路由无关).

## 文件

- `AuthGuard.tsx` — 保护 owner-only SPA 路由. loading 时显示轻量 spinner; 未登录时跳 `/login`, 并保留原始 location.
- `AuditTimeline.tsx` — Edit 页 owner-only 审计日志时间线, 调 `/api/v1/audit/:slug`, 支持 Load more 和 diff 展开.
- `BuildStamp.tsx` — 全局右下角的构建版本水印 (version · sha · 时间). 在 `App.tsx` 顶层挂载, 所有路由可见. 样式见 `../styles/global.css` 的 `.build-stamp` class. 数据来源: `../version.ts` (由 `scripts/prerender.ts` 构建期注入 `globalThis.__OGL_VERSION__`).
- `ClaimBanner.tsx` — Dashboard 顶部匿名/legacy 可认领链接提示, 调 `/api/v1/links/claimable` 并支持批量 claim.
- `LinkRow.tsx` — Dashboard 单行链接展示, 含 slug/url/description/tags/visits/created/actions.
- `QrCanvas.tsx` — QR editor 的浏览器 canvas 预览, 用 `qrcode` 矩阵本地绘制 caption/logo.
- `StatsChart.tsx` — Dashboard 近 52 周总点击与 GitHub-style heatmap, 数据来自 `/api/v1/stats/summary`.
- `TagInput.tsx` — Edit 页 metadata tags chip 输入.
- `stats/DateRangePicker.tsx` — `/stats` 7/30/90/180 天范围 segmented control.
- `stats/PathRegexInput.tsx` — `/stats` path regex 输入 + Apply.
- `stats/PieChart.tsx` — `/stats` path event share 饼图.
- `stats/LineChart.tsx` — `/stats` date event/user 折线图.
- `UrlHistory.tsx` — Edit 页 URL 历史展示, 兼容 malformed legacy `url_history` 并回退到空状态.
- `WarnToggle.tsx` — Edit 页 warning interstitial 开关, 写 `metadata.show_warning`.
