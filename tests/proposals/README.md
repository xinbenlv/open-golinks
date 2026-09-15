# 提议隔离测试

只在显式设置 `PROPOSAL_TEST_DATABASE_URL` 且指向 localhost 的 `ogl_proposals_test` 数据库时执行；使用本地生成的 JWT/JWKS，不读取 Supabase 凭据。请单独运行此目录，避免旧测试的 mock.module 污染。

```sh
PROPOSAL_TEST_DATABASE_URL=postgres://ogl_test@127.0.0.1:55439/ogl_proposals_test bun test tests/proposals
```

Harness 会应用全部迁移并清空这个专用测试数据库中的业务表，不能指向共享数据库。

浏览器回归（先构建测试前端，再单独启动 fixture server）：

```sh
VITE_SUPABASE_URL=http://127.0.0.1:3197 VITE_SUPABASE_PUBLISHABLE_KEY=local-test-public-key OPEN_GOLINK_THEME=zgzg bun run build
PROPOSAL_TEST_DATABASE_URL=postgres://ogl_test@127.0.0.1:55439/ogl_proposals_test bun tests/proposals/browser-server.ts
# 另一个终端，服务器启动会重置专用测试库，不要与 API 测试并行运行：
PROPOSAL_BROWSER_URL=http://127.0.0.1:3197 bun test tests/proposals/browser.spec.ts
```

`browser-server.ts` 仅监听 loopback，测试登录路由不进入生产应用。GA4 用空统计替代；提议 API、JWT 和数据库均走真实实现。测试构建包含本地公开占位 key，不应部署；部署需使用正常生产构建环境重新构建。`PROPOSAL_SCREENSHOTS` 可指定已存在的截图目录。

`inline-diff.test.tsx` 不需要数据库。API 回归覆盖 14 个场景；浏览器回归覆盖匿名→owner、member→admin、拒绝、过期保护、焦点和窄屏。
