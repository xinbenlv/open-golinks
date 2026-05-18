# `src/web/pages/` - SPA 页面入口

这里存放 React Router 的页面级组件。读者主要是维护前端路由、登录/认领、链接编辑、公开统计和创建体验的开发者。

## 结构

```text
pages/
├── Landing/          # `/` 和 `/create` 复用的创建体验
├── Stats/            # `/stats` 与 `/stats/:slug`
├── AuthCallback.tsx  # Supabase PKCE / hash session 回跳
├── Claim.tsx         # `/claim/:slug`
├── Create.tsx        # `/create` 包装 Landing
├── Dashboard.tsx     # owner dashboard
├── Edit.tsx          # `/edit/:slug`
├── Login.tsx         # magic link 登录
├── QrEditor.tsx      # `/qr/:slug`
└── Trending.tsx      # `/trending` 公开热门链接
```

## 路由约定

- 路由表在 `src/web/router.tsx`，页面新增后需要同步 lazy import 和 `<Route>`。
- 新增单段公开 SPA 路径时，必须同步 `src/routes/redirect.ts` 的 `RESERVED` 和 `tests/e2e/reserved-slug-fallthrough.test.ts`，避免被 `/:slug` redirect handler 当作短链。
- 公开数据页面应通过受控 API 获取数据，不直接暴露任意查询参数给外部服务。

## 当前公开页面

- `/stats` 与 `/stats/:slug` 展示只读 GA4 统计。
- `/trending` 展示近 7/30 天热门公开链接，后端只会查询 `is_public=true` 且未删除的链接。
- `/claim/:slug` 支持匿名链接登录后认领；未登录时先显示登录入口。

## 相关文档

- [`../README.md`](../README.md)
- [`../../../docs/CURRENT-ARCHITECT.md`](../../../docs/CURRENT-ARCHITECT.md)
