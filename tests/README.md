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
```

## 目录

- `e2e/` — 端到端回归测试. 每个文件锁住一个已被用户揪出过的 bug, 防止再犯.
  - `reserved-slug-fallthrough.test.ts` — `GET /dashboard` 等保留路径必须穿透到 SPA fallback, 不能被 `redirectRoute` 短路成 404 (commit `d0e310b` 之前的 bug).
  - `F1-auth.test.ts` — `GET /api/v1/me` 的 401 行为 + `/login` / `/auth/callback` SPA fallback.
  - `F2-link-crud.test.ts` — 真实 Supabase token + Postgres 集成测试: owner CRUD、audit、url_history、软删重建、匿名限流.
  - `F3-dashboard.test.ts` — `GET /api/v1/links?owner=me` 鉴权、cursor 分页、slug/url 搜索.
- `browser/` — Puppeteer + 系统 Chrome 的生产/浏览器 smoke tests. 默认指向 Railway v2-hono URL, 可用 `BROWSER_BASE_URL` 和 `CHROME_PATH` 覆盖. F1 的完整 magic-link callback smoke 还需要 `SUPABASE_URL` + `SUPABASE_SECRET_KEY`; 缺少时只跑公开页面 smoke.

## 约定

- **每个 bug 一个 e2e**. 用户揪出的每个 bug 都应该补一个端到端测试, 文件命名建议 `<symptom>.test.ts`, 顶部用注释写清"起因 / 修复 / 这个测试锁的是什么".
- **测试 symptom, 不测 implementation**. 例如 dashboard 404 的测试断言的是 HTTP 状态码, 不是 `redirectRoute` 内部的 if 分支. 这样实现改了测试也能继续保护.
- **不依赖前端构建**. e2e 测试只 import 后端模块, 用 sentinel handler 模拟 SPA fallback, 跑得快、信号聚焦.
- **DB stub**. 测试运行时设 `DATABASE_URL=postgres://stub:...`. `postgres-js` 在第一次 query 前不连接, 不触发 query 的测试用 stub URL 即可.
