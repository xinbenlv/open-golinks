# 提议隔离测试

预览服务器显式设置静态文件 Content-Type，避免经过响应中间件后丢失 Bun 文件的隐式 MIME。

预览同时接入 /qr 的真实 PNG 路由，启动时设置 OPEN_GOLINK_THEME=zgzg 可检查品牌 logo 下载。

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

直接保存回归覆盖 owner/admin、匿名和普通成员拒绝、伪造 JWT admin、角色撤销与旧 revision 冲突。浏览器统一使用主编辑字段。

测试登录支持 /__test/login/anonymous 清除本地登录；harness 启动时清理中断测试留下的 audit 故障注入约束。

身份回归验证登录提议只有邮箱/account ID 私有详情，不写原始 IP/UA，同时保留限流哈希。

标签回归验证增删审批和其他 metadata 保留；历史验证 admin 可见操作者、提议者与 IP，普通成员不能读取私有审计。

Publish（Public listing）支持提议开启或关闭，仅审批后更新 isPublic；旧提议未含此字段时保持现有设置。

浏览器提交流程先打开确认 dialog，再点击 Submit proposal；主表单不重复显示 tag diff 或隐私说明。

身份预览回归确保展示的 IP/UA 与实际匿名提议一致。local browser server 从 socket 注入 loopback IP，模拟可信代理，覆盖客户端自报头。
