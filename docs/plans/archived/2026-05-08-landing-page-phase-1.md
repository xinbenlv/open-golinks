# Landing Page (SPA `/` 路径)

**Date**: 2026-05-08
**Duration**: 4-6 小时
**Priority**: P1
**Status**: ✅ Complete (phase 1, 2026-05-07 实装)

## 实装备注 (2026-05-07)

- 路由不只 `/`: 同时 stub 了 `/dashboard` `/create` `/edit/:slug` `/warn/:slug` `*`
- SEO: 改成 **构建期 SSG 预渲染**, 不是纯 SPA. 见 `scripts/prerender.ts` + `src/web/entry-ssr.tsx`
- 首屏 JS 实测 ~80KB gzip (高于 50KB 目标), 但 LCP 与首屏内容已不依赖 JS — HTML+CSS 即完整呈现
- 创建表单走 mock, `POST /api/v1/links` 上线后改 `CreateForm.tsx#onSubmit`
- 已知遗留: 直接访问 `/dashboard` 等 SPA 路径在生产被 redirect handler 拦截 404, 见 [`docs/troubleshooting/spa-reserved-paths.md`](../../troubleshooting/spa-reserved-paths.md)

## Overview

为 v2-hono SPA 实现 `/` 落地页。访问根路径时，hero section 是创建短链表单（直接可用），下方依次是功能介绍、工作流程、面向团队、Footer。视觉风格模仿 [luma.com](https://luma.com)：大留白、暗色优先、克制色彩、强字体层级。

后端 `POST /api/v1/links` 暂未实现，所以创建表单 **走 mock**——校验通过后本地生成假短链 + 显示成功状态，等后端就绪再接。

## 上下文 (handover)

工作目录：`~/ws/open-golinks/.worktrees/v2-hono`，branch `v2-hono`。线上：https://open-golinks-v2-hono-production.up.railway.app（短链跳转已通，例 `/test` → example.com）。

### 技术栈

- **SPA 入口**：`src/web/{index.html, main.tsx, App.tsx, styles.css}`
- **Build**：Vite 6（`vite.config.ts`：root=`src/web`，outDir=`dist/web`）
- **Framework**：React 19，Bun 作为 runtime/package manager
- **后端**：Hono；生产模式托管 `dist/web` 静态产物 (`src/server.ts:25-28`)

### 后端 API（已就绪）

- `GET /api/v1/health` → 健康检查
- `GET /api/v1/me` → 需 `Authorization: Bearer <jwt>`
- `GET /:slug` → 302 跳转
- 保留路径不能当 slug：`api`、`auth`、`create`、`dashboard`、`edit`、`warn`、`assets`、`static`、`favicon.ico`、`robots.txt`

### 后端 schema (`src/db/schema.ts`)

```ts
links: { slug: pk varchar(50), url: text, isPublic: boolean, ... }
// slug 校验正则: ^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$|^[a-z0-9]{3}$
```

表单字段：`url` (必填) / `slug` (可选，留空则后端生成 nanoid) / `is_public` (默认 true) / `turnstile_token` (后续接)。

## Deliverables

### 1. Header

- 左：logo + "Open GoLinks"
- 右：GitHub 链接 + 登录按钮（stub）

### 2. Hero

- H1 标语（中文）+ 副标"开源的 go/links 短链服务"
- **核心：嵌入创建短链表单**（URL 输入框 + 可选自定义 slug + 创建按钮）
- 提交成功 → 显示 `https://o.dev/<slug>` + copy 按钮（mock）

### 3. Features (3-4 卡片)

- 匿名可创建（无需登录）
- 公私可控
- 访问统计 + 每日趋势
- 开源自部署

### 4. How it works

步骤说明 + 简洁示意图。

### 5. For Teams

Chrome 扩展介绍 + 路线图占位。

### 6. Footer

GitHub / 文档 / License。

## Implementation Steps

1. 装路由：react-router-dom v7 或 TanStack Router
2. 拆 `src/web/pages/Landing/` 模块（独立 chunk）
3. 设计 token：`src/web/styles/tokens.css`（颜色、间距、字体、阴影）
4. 实现 Header / Hero / Features / HowItWorks / ForTeams / Footer 组件
5. 创建表单：客户端校验 + mock submit + 成功态 UI
6. 暗色优先 + 浅色切换（CSS variable + `prefers-color-scheme`）
7. 滚动 reveal（IntersectionObserver，自己写 ~30 行，不引 framer-motion）
8. Lighthouse 跑分 ≥ 95 (Performance + Accessibility)

## 设计要求

**风格：模仿 luma.com**

- 大留白、克制色彩、**深色优先**
- 字体层级强（Inter + 一个衬线副标题）
- 卡片：薄边框 + 软阴影，圆角 12-16px
- 微妙渐变背景或 noise texture（不要 glassmorphism）
- 滚动 reveal：IntersectionObserver 或 motion-one（轻量）
- 暗色调色板参考 luma：背景近黑 (#0a0a0c)、卡片 #14141a 系、主色暖橙或冷紫

## 性能要求

- LCP < 1.5s（Hero 表单可交互）
- 首屏 JS bundle < 50KB gzip（split dashboard / create 等其他页面）
- web font 用 `font-display: swap` + 优先 system stack
- Hero **不放图片**，用 CSS 渐变 + SVG 几何
- React 19 用 `use()` + Suspense；按钮交互用 `useTransition`

## Timeline

- 设计 token + 路由 + 骨架: 1h
- Header / Hero / 表单 + mock submit: 1.5h
- Features / HowItWorks / ForTeams: 1.5h
- 暗/亮主题 + 滚动 reveal: 1h
- Lighthouse 调优 + 文档更新: 1h

## Success Criteria

- [ ] 访问 https://localhost:5173 (`bun run dev:web`) 显示完整 landing
- [ ] 创建表单 mock 流程跑通：输入 URL → 校验 → 显示假短链 + copy
- [ ] `bun run build:web` 后 `dist/web/assets/*.js` 首屏 chunk < 50KB gzip
- [ ] Lighthouse Performance ≥ 95，Accessibility ≥ 95
- [ ] 暗/亮主题切换正常，跟随系统偏好
- [ ] 移动端 (375px) / 平板 / 桌面 (1440px) 都视觉协调
- [ ] 部署到 Railway 后 https://open-golinks-v2-hono-production.up.railway.app/ 显示新 landing
- [ ] `src/web/README.md` 和 `docs/CURRENT-ARCHITECT.md` 同步更新

## 约束 (CLAUDE.md)

- 文档/注释**中文简体**，代码命名英文
- 文件 < 2K tokens，超 10K 必须拆
- 改完代码同步更新所在文件夹 README.md 和 `docs/CURRENT-ARCHITECT.md`
- 踩坑 → `docs/troubleshooting/` 留笔记

## Don't Touch

- ❌ `src/server.ts` / `src/routes/` / `src/db/` / `src/middleware/`
- ❌ 真实调用 POST /links（后端没好，走 mock）
- ❌ Tailwind v3（要用就 v4；纯 CSS modules / vanilla CSS 也行）
- ❌ framer-motion / 大型 UI 库（shadcn/radix 可挑单组件）

## Verify

```fish
cd ~/ws/open-golinks/.worktrees/v2-hono
bun run dev:web                  # http://localhost:5173
bun run build:web
du -sh dist/web/assets/*
```
