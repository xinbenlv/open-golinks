# React SPA

Vite + React 19，构建到 dist/web，生产由 Hono 托管。详细路由、SSG、主题和原有功能说明见 [architecture.md](./architecture.md)。

## 入口

- main.tsx：hydrate/createRoot 与集中 CSS 导入。
- router.tsx：路由表，页面 lazy 加载。
- pages/：Landing、Dashboard、Edit、QR、Stats、认证入口。
- components/：共享组件；proposals/ 为提议提交、审核与历史。
- hooks/：useAuth、authFetch、useApi、主题。
- styles/：token、global 和限定作用域的 proposals 样式。
- lib/：品牌与 Supabase client。

## 提议

/edit/:slug 允许访客提议 URL/描述，当前 owner/admin 审核。UI 保留极简 inline diff，元数据通过 reviewer-only API 按需读取。owner/admin 未保存编辑时不能审核；保存请求携带 baseRevision。统一编辑字段提交到保存或提议 API，辅助内容按四个 tab 展示。

LinkStatsCard 在有数据时才加载图表。样式只在 main.tsx 导入，以便 SSR 导入组件树。

## 开发

运行 bun run dev:web；构建 bun run build:web。品牌由 OPEN_GOLINK_THEME 控制；前端认证需要 VITE_SUPABASE_URL 与 VITE_SUPABASE_PUBLISHABLE_KEY。新增根级路径需同步 redirect 的 RESERVED。

生产权限和发布步骤见 [提议 runbook](../../docs/runbooks/proposed-changes.md)。

无主链接在 edit 和 claim 页复用 ClaimOwnership；ShortLinkActions 提供 slug/图标复制、44px 触控区域与状态反馈。authReturn 保留安全的登录回跳路径，兼容旧邮件模板同浏览器新 tab 回跳。

OwnerAvatar 使用固定版本 `@metamask/jazzicon` 在本地绘制邮箱派生头像；无网络图片请求。无主显示认领，已有主人显示头像。

无主入口为灰色空缺头像；点击才展开登录/认领面板，可通过 Escape 或点击外部关闭。

OwnerAvatar 提示及可访问名称使用服务端 maskedEmail，格式 a**z@完整域名；长域名完整换行。
