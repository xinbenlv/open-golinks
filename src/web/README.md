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

/edit/:slug 允许访客提议 URL/描述，当前 owner/admin 审核。UI 保留极简 inline diff，元数据通过 reviewer-only API 按需读取。owner 未保存编辑时不能审核；保存请求携带 baseRevision。

LinkStatsCard 在有数据时才加载图表。样式只在 main.tsx 导入，以便 SSR 导入组件树。

## 开发

运行 bun run dev:web；构建 bun run build:web。品牌由 OPEN_GOLINK_THEME 控制；前端认证需要 VITE_SUPABASE_URL 与 VITE_SUPABASE_PUBLISHABLE_KEY。新增根级路径需同步 redirect 的 RESERVED。

生产权限和发布步骤见 [提议 runbook](../../docs/runbooks/proposed-changes.md)。
