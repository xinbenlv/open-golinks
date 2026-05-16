# `src/web/` - Vite + React 19 SPA

Open GoLinks 的前端单页应用. 由 Vite 构建到 `dist/web/`, 在生产由 Hono `serveStatic` 托管 (`src/server.ts:25-28`).

## 文件结构

```
src/web/
├── index.html               # Vite 入口 HTML, 默认 inline favicon; build 期按品牌替换
├── main.tsx                 # 浏览器入口: hydrate / createRoot 智能切换
├── entry-ssr.tsx            # SSG 入口: 由 scripts/prerender.ts 调用
├── App.tsx                  # 根组件 = AppRoutes
├── router.tsx               # react-router-dom v7 路由表
├── styles/
│   ├── tokens.css           # 设计 token (颜色 / 字体 / 间距 / 阴影 / 动效)
│   └── global.css           # 全局重置 + 容器 + .reveal 动画基础
├── public/
│   └── zgzg-round-logo.png  # Vite public asset, 给 SSG HTML 和浏览器 canvas 共用
├── hooks/
│   ├── useReveal.ts         # IntersectionObserver 滚动 reveal
│   ├── useTheme.ts          # light / dark / system 三态主题
│   ├── useAuth.ts           # Supabase session store + authFetch
│   └── useApi.ts            # JSON API wrapper, 自动带 Authorization
├── lib/
│   ├── brand.ts             # 前端/SSG 品牌配置, 解析 Vite 或 Bun 环境主题
│   └── supabase.ts          # supabase-js PKCE client singleton
├── components/
│   ├── AuthGuard.tsx        # owner-only route guard
│   ├── AuditTimeline.tsx    # Edit 页 owner 审计日志时间线
│   ├── BuildStamp.tsx       # 全局构建版本水印
│   ├── ClaimBanner.tsx      # Dashboard 匿名/legacy 可认领链接提示
│   ├── LinkRow.tsx          # Dashboard 链接行
│   ├── QrCanvas.tsx         # QR editor 客户端 canvas 预览
│   ├── StatsChart.tsx       # Dashboard 30 日 GA4 GitHub-style heatmap
│   ├── stats/               # 详细 Analytics 控件与图表
│   ├── UrlHistory.tsx       # Edit 页 URL 历史展示
│   └── WarnToggle.tsx       # Edit 页 warning interstitial 开关
└── pages/
    ├── Landing/             # Landing 页 (`/`), 构建期被 SSG 预渲染
    │   ├── index.tsx        # 组合 Header / Hero / Features / HowItWorks / ForTeams / Footer
    │   ├── Header.tsx
    │   ├── Hero.tsx
    │   ├── CreateForm.tsx   # 内嵌创建表单, 真实 POST /api/v1/links, 支持 initialSlug 预填
    │   ├── Features.tsx
    │   ├── HowItWorks.tsx
    │   ├── ForTeams.tsx
    │   ├── Footer.tsx
    │   ├── icons.tsx        # 内联 SVG icons, 不引图标库
    │   └── landing.css      # Landing 专属样式
    ├── ComingSoon.tsx       # 未来占位页通用组件
    ├── Dashboard.tsx        # /dashboard owner 链接列表 + 搜索 + 分页 + stats
    ├── Login.tsx            # /login, magic link form
    ├── AuthCallback.tsx     # /auth/callback, PKCE code exchange
    ├── Claim.tsx            # /claim/:slug, 匿名链接登录后认领
    ├── Create.tsx           # /create 复用 Landing 创建体验
    ├── Edit.tsx             # /edit/:slug, 不存在则创建; owner 可编辑/软删已存在链接 + URL history/audit timeline
    ├── QrEditor.tsx         # /qr/:slug, QR 预览 + PNG 下载
    ├── Stats/               # /stats 和 /stats/:slug 详细 GA4 analytics
    └── NotFound.tsx         # * (lazy stub)
```

## 路由

| 路径 | 组件 | 渲染策略 |
|---|---|---|
| `/` | `pages/Landing` | 构建期 **SSG 预渲染** + 客户端 hydrate |
| `/login` | `pages/Login` | 客户端 lazy chunk, Supabase magic link |
| `/auth/callback` | `pages/AuthCallback` | 客户端 lazy chunk, PKCE code exchange |
| `/claim/:slug` | `pages/Claim` | 客户端 lazy chunk, 登录后认领匿名/legacy 链接 |
| `/qr/:slug` | `pages/QrEditor` | 客户端 lazy chunk, QR 预览与 PNG 下载 |
| `/stats` | `pages/Stats` | 客户端 lazy chunk, 公开只读; 全部未删除链接 GA4 analytics |
| `/stats/:slug` | `pages/Stats/SlugStats` | 客户端 lazy chunk, 公开只读; 单 slug GA4 analytics |
| `/dashboard` | `AuthGuard(pages/Dashboard)` | 客户端 lazy chunk, 需登录; owner 链接列表 |
| `/create` | `pages/Create` | 客户端 lazy chunk; Landing 创建体验 |
| `/edit/:slug` | `pages/Edit` | 客户端 lazy chunk; 不存在 slug 进入创建流, owner 可编辑/删除 |
| `/warn/:slug` | Hono `src/routes/warn.ts` | SSR HTML, 不走 SPA bundle |
| `*` | `pages/NotFound` | 客户端 lazy chunk |

## SSG 预渲染流程

构建期把 `/` 渲染成完整 HTML, 写入 `dist/web/index.html`. 搜索引擎与 OG 抓取直接拿到全部 markup.

```
bun run build:web
   │
   ├── vite build              # 输出 dist/web/{index.html, assets/*}
   │
   └── bun scripts/prerender.ts
         ├── 读 dist/web/index.html (template)
         ├── import entry-ssr.tsx → renderApp("/") → HTML 字符串
         ├── 注入 <title>/<meta>/<script (theme 防闪烁)>
         └── 写回 dist/web/index.html
```

客户端 `main.tsx` 会判断:
- 路径 `/` 且 root 已有内容 → `hydrateRoot`
- 否则 → 清空后 `createRoot`(避免 hydration mismatch)

## 主题

`useTheme()` 提供 `light` / `dark` / `system` 三态, 持久化到 `localStorage('ogl-theme')`.
预渲染脚本在 `<head>` 注入一段防闪烁脚本, 在样式表加载前同步 `data-theme`, 并按品牌替换 favicon.

品牌主题由 `OPEN_GOLINK_THEME` 控制。默认显示 Open GoLinks；构建/运行环境设为 `zgzg` 时, 前端使用 `zgzg.li` 文案、favicon 和 public asset `/zgzg-round-logo.png`。ZGZG 红色只作为品牌 accent/token 使用；`.btn--primary` 等前进操作走 `--action-*` token, 在 ZGZG 下呈现中性色按钮, warning 场景走 amber 语义色。

## CSS 约定

- **所有 CSS 在 `main.tsx` 集中导入**, 组件 .tsx 文件保持纯 JSX. 这样 `entry-ssr.tsx` 可以无副作用地 `import` 组件树.
- 颜色 / 间距 / 阴影 / 字号一律用 token (CSS variable), 不写死十六进制. 色彩语义优先使用 `--brand-*`, `--action-*`, `--warning-*`, `--danger`.
- 不引 Tailwind v3 / framer-motion / 大型 UI 库 (体积约束).

## Auth

`useAuth()` 通过 `@supabase/supabase-js` 维护浏览器 session:
- `Login.tsx` 调 `signInWithMagicLink(email)`, redirect 到 `/auth/callback`
- `AuthCallback.tsx` 优先读取 `?code=` 并调用 `exchangeCodeForSession`; Admin generated-link / legacy hash token 回跳则调用 `setSession`
- `AuthGuard` 保护 `/dashboard`; `/stats`、`/stats/:slug` 与 `/edit/:slug` 保持公开只读/创建入口
- `/api/v1/stats/summary` 仍 requireAuth 并只给 `/dashboard` 的 owner summary 使用
- Header 根据 session 显示登录/登出状态
- `/claim/:slug` 允许未登录用户先查看认领入口; 登录后用浏览器 fingerprint 或 legacy author email 调 `POST /api/v1/links/:slug/claim`

Vite client env:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_BASE_URL`

## 创建表单 (CreateForm)

`Hero` 内嵌的创建表单直连 `POST /api/v1/links`:
- 客户端先做 URL/slug 格式校验 (与后端 schema 对齐, 失败原地报错不发请求)
- 提交成功 (201) → 显示真实短链 (`window.location.host` 拼出) + 复制按钮 + "打开"按钮 (打到 `/<slug>` 走 redirect)
- 匿名提交会先计算 `src/lib/fingerprint.ts` 的 64-hex fingerprint, 通过 `X-Fingerprint` 传给后端, 并把 `{ slug, fingerprint }` 记入 `localStorage('golinks:created')`
- F12 已 drop 公开 browse 能力: 创建表单不展示公开开关, 后端新建/恢复链接均写 `is_public=false`
- slug 留空时, 客户端用 `genSlug()` 生成; 撞库 (409) 时自动重试一次
- 用户填的 slug 撞库 → 在 slug 字段下报"该 slug 已被占用"
- 网络/服务端异常 → 表单底部红字, 不清空已输入的 url/slug

`/edit/<slug>` 会先查 `/api/v1/links/:slug`: 不存在时复用同一表单 (Landing 整页), CreateForm 拿到 `initialSlug` prop 后预填 slug 字段并把焦点放到 URL 输入框; 已存在时, 登录 owner 可以 PATCH 更新目标 URL、description、tags、`metadata.show_warning`, TRANSFER 到另一个已注册用户或 DELETE 软删. 底部 `UrlHistory` 展示历史目标 URL, `AuditTimeline` 展示 CREATE/UPDATE/DELETE/CLAIM/TRANSFER 历史并支持展开 diff. 配合 redirect.ts (没找到的 slug → 302 `/edit/<slug>`), 形成 "访问没找到 → 直接进创建页" 的闭环.

## Metadata

- `Edit.tsx` 使用 `TagInput.tsx` 维护 `metadata.tags` 和 description textarea 维护 `metadata.description`.
- `Dashboard.tsx` 在搜索旁提供 tag filter, 调 `GET /api/v1/links?owner=me&tag=<tag>`.
- `LinkRow.tsx` 显示 description 与 tag chips.

## QR Editor

`/qr/<slug>` 读取 `/api/v1/links/:slug` 后展示 QR 预览。预览由 `QrCanvas.tsx` 在浏览器端实时绘制, caption 输入不会打服务端。下载 PNG 使用 master-compatible `/qr/d/<slug>.png?caption=...&addLogo=true`, QR 内容始终是短链 URL, 不是 destination URL.

## Stats

`/stats` 与 `/stats/<slug>` 调公开只读的 `/api/v1/stats/query` 获取 GA4 数据:
- path query: `groupBy: "path"`, `limit` 为 Top 10/20/50, 可切 `pagePathPlusQueryString`
- date query: `groupBy: "date"`, `limit` 跟随 7/30/90/180 天范围
- `/stats` 查询所有未删除 links 并在 GA4 层强制 `pagePath` 为 slug 格式, 同时排除 reserved/system path; `/stats/<slug>` 先确认该 slug 未删除
- `pathRegex` 是额外过滤条件; 后端仍不暴露任意 GA4 passthrough
- 组件位于 `components/stats/`: `DateRangePicker`, `PathRegexInput`, `StatsPieChart`, `StatsLineChart`

校验规则:
- `url`: 必填, http/https URL
- `slug`: 可选, 正则 `^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$|^[a-z0-9]{3}$`, 不能是保留路径
- `is_public`: 创建 UI 不展示公开开关; 后端 POST/restore 显式写 `false`, DB 默认值也是 `false`

## 开发

```fish
bun run dev:web                # vite dev, http://localhost:5173
                               # 注意: dev mode 不预渲染, 走 createRoot
bun run build:web              # vite build + prerender
bun run start                  # NODE_ENV=production, Hono 托管 dist/web
```

## 已知限制

- `/favicon.ico` / `/favicon.svg` / `/robots.txt` 等带 `.` 的根路径在生产被 redirect handler 当成无效 slug 拦截 → 404. 因此 favicon 用 inline data URL 处理. 后端逻辑由 `src/routes/redirect.ts` 决定, 本目录不修改.
- 直接访问新的单段 SPA 路径时, 必须先把该路径加入 `src/routes/redirect.ts` 的 `RESERVED`, 并更新 `tests/e2e/reserved-slug-fallthrough.test.ts`. 当前 `/dashboard`、`/login`、`/claim`、`/qr`、`/stats` 等已覆盖.

## 相关

- [`docs/CURRENT-ARCHITECT.md`](../../docs/CURRENT-ARCHITECT.md) - 项目整体架构
- [`docs/plans/2026-05-08-landing-page.md`](../../docs/plans/2026-05-08-landing-page.md) - 本次实现的计划
