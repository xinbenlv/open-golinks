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
- `/claim/:slug` 与 edit 页共用 ClaimOwnership，`@zg.io` 登录后返回当前 edit 页再认领。

## 相关文档

- [`../README.md`](../README.md)
- [`../../../docs/CURRENT-ARCHITECT.md`](../../../docs/CURRENT-ARCHITECT.md)

`/edit/:slug` 沿用项目原有主题与字体。短链标题与相邻图标共用复制逻辑，Go 独立导航；基本信息直接可编辑，History、Stats、QR Code 分 tab 按需展示。操作按钮在修改后出现；转移和删除收在 Manage link。

Edit 页包含真实 Proposed changes，保存请求携带 baseRevision，避免旧表单覆盖刚审核的更新。

编辑页移除重复的操作解释；提议区直接展示标题、操作和内容。

Landing footer 使用既有 text-muted token，满足 Lighthouse 对比度检查。

编辑页使用 Details / History / Stats / QR Code tabs；目标地址和描述直接编辑，owner/admin 保存，其他访客提交提议。表单状态跨 tab 保留。

修改后、提交前显示身份关联提示；匿名可登录改用邮箱/account ID，登录用户显示邮箱，account ID 可通过提示查看。

访客在基本信息编辑 URL、描述和 tags；待审提议进入独立 Proposals tab，History 保留已审核提议。owner/admin 的待审区仍在基本信息下。

Publish（Public listing）支持提议开启或关闭，仅审批后更新 isPublic；旧提议未含此字段时保持现有设置。

基本信息使用无卡片连续表单。点击 Propose change 后打开确认 dialog，diff 与身份提示只在 dialog 显示；取消保留草稿。

History 不再叠加三个历史区：owner/admin 只有一条变更时间线，其他访客只看自己已审核提议；Proposals 只放待处理提议。
