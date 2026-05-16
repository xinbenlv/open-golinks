# tests/

存放自动化测试. 用 Bun 内置 test runner (`bun:test`).

## 运行

```bash
bun test              # 跑全部
bun test:e2e          # 只跑 e2e
bun test tests/e2e/reserved-slug-fallthrough.test.ts   # 跑单个文件
bun test tests/e2e/F1-auth.test.ts                     # F1 auth/API routing smoke
bun test tests/e2e/F2-link-crud.test.ts                # F2 real DB CRUD/audit/rate-limit smoke
bun test tests/e2e/F3-dashboard.test.ts                # F3 owner dashboard API pagination/search
bun test tests/e2e/F4-stats.test.ts                    # F4 GA4/reporting scoped stats smoke
bun test tests/e2e/F5-claim.test.ts                    # F5 anonymous/legacy claim smoke
bun test tests/e2e/F6-warn.test.ts                     # F6 warning interstitial smoke
bun test tests/e2e/F7-qr.test.ts                       # F7 QR PNG and compat route smoke
bun test tests/e2e/F8-detailed-stats.test.ts           # F8 detailed analytics scoped query smoke
bun test tests/e2e/F9-audit.test.ts                    # F9 owner audit timeline API smoke
bun test tests/e2e/F10-url-history.test.ts             # F10 URL history data/normalizer smoke
bun test tests/e2e/F11-transfer.test.ts                # F11 ownership transfer API smoke
bun test tests/e2e/identity-acl.test.ts                # Identity/ACL migration helper unit tests
CAPTURE_README_TOUR=1 bun test tests/browser/readme-tour.spec.ts       # 用本地 fake data 重新生成 README GIF
```

## 目录

- `e2e/` — 端到端回归测试. 每个文件锁住一个已被用户揪出过的 bug, 防止再犯.
  - `reserved-slug-fallthrough.test.ts` — `GET /dashboard` 等保留路径必须穿透到 SPA fallback, 不能被 `redirectRoute` 短路成 404 (commit `d0e310b` 之前的 bug).
  - `F1-auth.test.ts` — `GET /api/v1/me` 的 401 行为 + `/login` / `/auth/callback` SPA fallback.
  - `F2-link-crud.test.ts` — 真实 Supabase token + Postgres 集成测试: owner CRUD、audit、url_history、软删重建、匿名限流.
  - `F3-dashboard.test.ts` — `GET /api/v1/links?owner=me` 鉴权、cursor 分页、slug/url 搜索.
  - `F4-stats.test.ts` — mock Measurement Protocol, scoped stats endpoint, GA4 failure downgrade.
  - `F5-claim.test.ts` — 匿名 fingerprint claim、legacy author email claim、403/409/400 边界.
  - `F6-warn.test.ts` — `metadata.show_warning` 类型校验、`/:slug` warning 拦截、自包含 `/warn/:slug` SSR、confirm 绕过.
  - `F7-qr.test.ts` — QR API PNG、master-compatible `/qr/*.png`、download header、caption/format/404 校验、`/qr/:slug` SPA fallback.
  - `F8-detailed-stats.test.ts` — `/api/v1/stats/query` 公开全站/单 slug scope、deleted/missing 404、allowlist validation、GA4 failure downgrade.
  - `F9-audit.test.ts` — `/api/v1/audit/:slug` owner-only、CREATE/CLAIM/UPDATE diff、404/403、cursor pagination.
  - `F10-url-history.test.ts` — PATCH url_history 写入顺序、never-edited 空状态、malformed legacy history normalize.
  - `F11-transfer.test.ts` — owner transfer to registered user、A/B dashboard scope、TRANSFER audit、USER_NOT_FOUND/SELF_TRANSFER/FORBIDDEN.
  - `F12-browse.test.ts` — F12 Drop 决策回归: links list requireAuth、`owner=public` 拒绝、创建/恢复默认 private、不泄露其他 owner 链接.
  - `F13-extension-compat.test.ts` — `/api/v2` legacy shim: link lookup、availability、edit create/update、Bearer my-links、owner-only update.
  - `F14-metadata.test.ts` — metadata description/tags PATCH/POST、tag filter、show_warning preserve、strict validation.
  - `identity-acl.test.ts` — migration identity resolver: canonical email、DTO 脱敏、Auth user mapping、dry-run 不生成 synthetic UUID、duplicate email conflict.
- `browser/` — Puppeteer + 系统 Chrome 的生产/浏览器 smoke tests. 默认指向 Railway v2-hono URL, 可用 `BROWSER_BASE_URL` 和 `CHROME_PATH` 覆盖. F1-F8 的完整 magic-link/browser smoke 需要 `SUPABASE_URL` + `SUPABASE_SECRET_KEY`; 缺少时只跑公开页面 smoke 或跳过需登录用例.
  - `readme-tour.spec.ts` — 可选截图用例, 只有设置 `CAPTURE_README_TOUR=1` 才运行; 本地构建前端并启动 Vite preview, 将 `https://zzgg.li` 请求 proxy 到本地前端资产, mock API/SSR 数据, 通过创建/QR/edit/stats/warn 流程生成 `docs/assets/readme-tour.gif`; 需要本机 `ffmpeg`.
  - `F5.spec.ts` — 生产 golden path: 匿名创建 → `/claim/:slug` 不被短链路由截获 → magic-link 登录 → Dashboard banner → Claim all → owner 列表出现该 slug.
  - `F6.spec.ts` — 生产 golden path: owner 打开 warning toggle → 访客进入 `/warn/:slug` → Proceed → 关闭 warning 后直接 302.
  - `F7.spec.ts` — 生产 golden path: `/qr/:slug` 预览渲染、中文 caption 更新、下载 PNG header/content-disposition 校验.
  - `F8.spec.ts` — 生产 golden path: 准备测试链接 → 公开 `/stats` 控件交互 → `/stats/:slug` 详情 → stats query 200 + build SHA 校验.
  - `F9.spec.ts` — 生产 golden path: 登录 → 创建并更新链接 → `/edit/:slug` History → 展开 UPDATE diff.
  - `F10.spec.ts` — 生产 golden path: 登录 → 创建并更新链接 → `/edit/:slug` URL History 显示 current/previous/original.
  - `F11.spec.ts` — 生产 golden path: A 创建链接 → Edit 页 transfer 给已注册 B → A 列表消失, B 列表出现.
  - `F12.spec.ts` — 生产 privacy smoke: 无公开 browse UI、未登录 list 401、`owner=public` 400、新建 private.
  - `F13.spec.ts` — 生产 compatibility smoke: `/api/v2/available`、`/api/v2/edit`、`/api/v2/link` legacy shape + build SHA.
  - `F14.spec.ts` — 生产 metadata smoke: Edit 页保存 description/tags, Dashboard tag filter 只显示匹配链接.

## 约定

- **每个 bug 一个 e2e**. 用户揪出的每个 bug 都应该补一个端到端测试, 文件命名建议 `<symptom>.test.ts`, 顶部用注释写清"起因 / 修复 / 这个测试锁的是什么".
- **测试 symptom, 不测 implementation**. 例如 dashboard 404 的测试断言的是 HTTP 状态码, 不是 `redirectRoute` 内部的 if 分支. 这样实现改了测试也能继续保护.
- **不依赖前端构建**. e2e 测试只 import 后端模块, 用 sentinel handler 模拟 SPA fallback, 跑得快、信号聚焦.
- **DB stub**. 测试运行时设 `DATABASE_URL=postgres://stub:...`. `postgres-js` 在第一次 query 前不连接, 不触发 query 的测试用 stub URL 即可.
