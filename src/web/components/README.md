# components/

跨页面复用的轻量展示型组件 (与具体页面/路由无关).

## 文件

- `AuthGuard.tsx` — 保护 owner-only SPA 路由. loading 时显示轻量 spinner; 未登录时跳 `/login`, 并保留原始 location.
- `AuditTimeline.tsx` — Edit 页 owner-only 审计日志时间线, 调 `/api/v1/audit/:slug`, 支持 Load more 和 diff 展开.
- `BuildStamp.tsx` — 全局右下角的构建版本水印 (version · sha · 时间). 在 `App.tsx` 顶层挂载, 所有路由可见. 样式见 `../styles/global.css` 的 `.build-stamp` class. 数据来源: `../version.ts` (由 `scripts/prerender.ts` 构建期注入 `globalThis.__OGL_VERSION__`).
- `ClaimBanner.tsx` — Dashboard 顶部匿名/legacy 可认领链接提示, 调 `/api/v1/links/claimable` 并支持批量 claim.
- `LinkRow.tsx` — Dashboard 单行链接展示, 含 slug/url/description/tags/visits/created/actions.
- `QrCanvas.tsx` — QR editor 的浏览器 canvas 预览, 用 `qrcode` 矩阵本地绘制 caption/logo；ZGZG logo 保留透明角，不添加白色缓冲区。
- `StatsChart.tsx` — Dashboard 近 52 周总点击入口, 复用 `stats/Heatmap.tsx`, 数据来自 `/api/v1/stats/summary`.
- `TagInput.tsx` — Edit 页 metadata tags chip 输入.
- `stats/DateRangePicker.tsx` — `/stats` 7/30/90/180 天范围 segmented control.
- `stats/Heatmap.tsx` — Dashboard、`/stats`、Edit stats card 共用的 `react-activity-calendar` GitHub-style heatmap.
- `stats/PathRegexInput.tsx` — `/stats` path regex 输入 + Apply.
- `stats/PieChart.tsx` — `/stats` path event share 饼图.
- `stats/LineChart.tsx` — `/stats` date event/user 折线图.
- `UrlHistory.tsx` — Edit 页 URL 历史展示, 兼容 malformed legacy `url_history` 并回退到空状态.
- `WarnToggle.tsx` — Edit 页 warning interstitial 开关, 写 `metadata.show_warning`.

- proposals/：真实提议 UI、Namefi 极简 diff、reviewer-only 提交详情。
- LinkStatsCard.tsx：Edit 统计卡片，按需加载图表。

二维码外围总留白缩为原来的约 1/3，保持画布尺寸并扩大码体；预览与导出一致。

UrlHistory 显示修改者和提议者；AuditTimeline 显示审核操作者、原提议者和受权限保护的匿名详情。

Edit History 只使用 AuditTimeline，不再重复 URL 历史和提议卡片；时间线合并显示修改者与原提议者/时间。

- `ClaimOwnership.tsx`：无主链接的 ZGID 登录/认领入口，文案为 “Login with your ZGID to claim and edit”；共用 claim API，成功后恢复 slug 焦点并保留编辑草稿。
- `ShortLinkActions.tsx`：slug 和相邻 icon-only 按钮共用 canonical URL 复制，提供键盘操作与 aria-live 反馈。

- `OwnerAvatar.tsx`：32px Jazzicon + 44px 触控区域，Link owner 提示支持悬停、聚焦和 Escape；seed 由后端按邮箱生成。
