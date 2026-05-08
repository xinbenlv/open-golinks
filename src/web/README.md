# `src/web/` - Vite + React 19 SPA

Open GoLinks 的前端单页应用. 由 Vite 构建到 `dist/web/`, 在生产由 Hono `serveStatic` 托管 (`src/server.ts:25-28`).

## 文件结构

```
src/web/
├── index.html               # Vite 入口 HTML, 含 inline favicon (data URL)
├── main.tsx                 # 浏览器入口: hydrate / createRoot 智能切换
├── entry-ssr.tsx            # SSG 入口: 由 scripts/prerender.ts 调用
├── App.tsx                  # 根组件 = AppRoutes
├── router.tsx               # react-router-dom v7 路由表
├── styles/
│   ├── tokens.css           # 设计 token (颜色 / 字体 / 间距 / 阴影 / 动效)
│   └── global.css           # 全局重置 + 容器 + .reveal 动画基础
├── hooks/
│   ├── useReveal.ts         # IntersectionObserver 滚动 reveal
│   └── useTheme.ts          # light / dark / system 三态主题
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
    ├── ComingSoon.tsx       # Dashboard / Create / Edit / Warn / NotFound 通用占位
    ├── Dashboard.tsx        # /dashboard (lazy stub)
    ├── Create.tsx           # /create (lazy stub)
    ├── Edit.tsx             # /edit/:slug 复用 Landing, slug 预填, 光标自动放 URL 输入框
    ├── Warn.tsx             # /warn/:slug (lazy stub)
    └── NotFound.tsx         # * (lazy stub)
```

## 路由

| 路径 | 组件 | 渲染策略 |
|---|---|---|
| `/` | `pages/Landing` | 构建期 **SSG 预渲染** + 客户端 hydrate |
| `/dashboard` | `pages/Dashboard` | 客户端 lazy chunk |
| `/create` | `pages/Create` | 客户端 lazy chunk |
| `/edit/:slug` | `pages/Edit` | 客户端 lazy chunk |
| `/warn/:slug` | `pages/Warn` | 客户端 lazy chunk |
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
预渲染脚本在 `<head>` 注入一段防闪烁脚本, 在样式表加载前同步 `data-theme`.

## CSS 约定

- **所有 CSS 在 `main.tsx` 集中导入**, 组件 .tsx 文件保持纯 JSX. 这样 `entry-ssr.tsx` 可以无副作用地 `import` 组件树.
- 颜色 / 间距 / 阴影 / 字号一律用 token (CSS variable), 不写死十六进制.
- 不引 Tailwind v3 / framer-motion / 大型 UI 库 (体积约束).

## 创建表单 (CreateForm)

`Hero` 内嵌的创建表单直连 `POST /api/v1/links`:
- 客户端先做 URL/slug 格式校验 (与后端 schema 对齐, 失败原地报错不发请求)
- 提交成功 (201) → 显示真实短链 (`window.location.host` 拼出) + 复制按钮 + "打开"按钮 (打到 `/<slug>` 走 redirect)
- slug 留空时, 客户端用 `genSlug()` 生成; 撞库 (409) 时自动重试一次
- 用户填的 slug 撞库 → 在 slug 字段下报"该 slug 已被占用"
- 网络/服务端异常 → 表单底部红字, 不清空已输入的 url/slug

`/edit/<slug>` 复用同一表单 (Landing 整页), CreateForm 拿到 `initialSlug` prop 后预填 slug 字段并把焦点放到 URL 输入框. 配合 redirect.ts (没找到的 slug → 302 `/edit/<slug>`), 形成 "访问没找到 → 直接进创建页" 的闭环.

校验规则:
- `url`: 必填, http/https URL
- `slug`: 可选, 正则 `^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$|^[a-z0-9]{3}$`, 不能是保留路径
- `is_public`: UI 上有勾选, 但当前后端 POST 未读这个字段 (DB 默认 true), 待后端补

## 开发

```fish
bun run dev:web                # vite dev, http://localhost:5173
                               # 注意: dev mode 不预渲染, 走 createRoot
bun run build:web              # vite build + prerender
bun run start                  # NODE_ENV=production, Hono 托管 dist/web
```

## 已知限制

- `/favicon.ico` / `/favicon.svg` / `/robots.txt` 等带 `.` 的根路径在生产被 redirect handler 当成无效 slug 拦截 → 404. 因此 favicon 用 inline data URL 处理. 后端逻辑由 `src/routes/redirect.ts` 决定, 本目录不修改.
- 直接访问 `/dashboard` 等单段 RESERVED 路径在生产会被 redirect handler 返回 404. 需要 server 改造以支持 SPA fallback (见 `docs/troubleshooting/spa-reserved-paths.md`). `/edit/:slug` 是双段, 走 SPA fallback 没问题.

## 相关

- [`docs/CURRENT-ARCHITECT.md`](../../docs/CURRENT-ARCHITECT.md) - 项目整体架构
- [`docs/plans/2026-05-08-landing-page.md`](../../docs/plans/2026-05-08-landing-page.md) - 本次实现的计划
