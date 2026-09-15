# 提议隔离测试

预览服务器显式设置 Content-Type，避免中间件丢失 MIME。

预览同时接入 /qr 的真实 PNG 路由，启动时设置 OPEN_GOLINK_THEME=zgzg 可检查品牌 logo 下载。

只在显式设置 `PROPOSAL_TEST_DATABASE_URL` 且指向 localhost 的 `ogl_proposals_test` 数据库时执行；使用本地生成的 JWT/JWKS，不读取 Supabase 凭据。请单独运行此目录，避免旧测试的 mock.module 污染。

```sh
PROPOSAL_TEST_DATABASE_URL=postgres://ogl_test@127.0.0.1:55449/ogl_proposals_test bun test tests/proposals
```

Harness 会应用全部迁移并清空这个专用测试数据库中的业务表，不能指向共享数据库。

浏览器回归（先构建测试前端，再单独启动 fixture server）：

```sh
VITE_SUPABASE_URL=http://127.0.0.1:55448 VITE_SUPABASE_PUBLISHABLE_KEY=local-test-public-key VITE_BASE_URL=http://127.0.0.1:3198 OPEN_GOLINK_THEME=zgzg bun run build
PROPOSAL_TEST_DATABASE_URL=postgres://ogl_test@127.0.0.1:55449/ogl_proposals_test PROPOSAL_BROWSER_PORT=3198 bun tests/proposals/browser-server.ts
# 另一个终端，服务器启动会重置专用测试库，不要与 API 测试并行运行：
PROPOSAL_BROWSER_URL=http://127.0.0.1:3198 bun test tests/proposals/browser.spec.ts tests/proposals/claim-copy.browser.spec.ts
```

`browser-server.ts` 仅监听 loopback，测试登录路由不进入生产应用。GA4 用空统计替代；提议 API、JWT 和数据库均走真实实现。测试构建包含本地公开占位 key，不应部署；部署需使用正常生产构建环境重新构建。`PROPOSAL_SCREENSHOTS` 可指定已存在的截图目录。

`inline-diff.test.tsx` 不需要数据库。API 回归覆盖提议生命周期与认领；浏览器回归覆盖匿名→owner、member→admin、拒绝、过期保护、焦点和窄屏。

直接保存回归覆盖 owner/admin、匿名和普通成员拒绝、伪造 JWT admin、角色撤销与旧 revision 冲突。浏览器统一使用主编辑字段。

测试登录支持 /__test/login/anonymous 清除本地登录；harness 启动时清理中断测试留下的 audit 故障注入约束。

身份回归验证登录提议只有邮箱/account ID 私有详情，不写原始 IP/UA，同时保留限流哈希。

标签回归验证增删审批和其他 metadata 保留；历史验证 admin 可见操作者、提议者与 IP，普通成员不能读取私有审计。

Publish（Public listing）支持提议开启或关闭，仅审批后更新 isPublic；旧提议未含此字段时保持现有设置。

浏览器提交流程先打开确认 dialog，再点击 Submit proposal；主表单不重复显示 tag diff 或隐私说明。

身份预览回归确保展示的 IP/UA 与实际匿名提议一致。local browser server 从 socket 注入 loopback IP，模拟可信代理，覆盖客户端自报头。

## 认领与复制

`claim-cases.ts` 在 proposals.test.ts 共用一次 harness 生命周期，避免重复 JWKS/DB 初始化。覆盖无 fingerprint 的认领、非域/伪造身份拒绝、旧发现规则、已有 owner/软删、并发与审计失败回滚。

`claim-copy.browser.spec.ts` 验证匿名登录回跳（含旧模板新 tab）、精确域提示、保留草稿后立即 Save、并发冲突、真实剪贴板、键盘、320/390px 与长 slug。邮件服务是本地网络 stub，JWT 验证、claim/PATCH 和 DB 均为真实实现；不验证生产发信或 Supabase 配置。

每次浏览器套件执行前重启 fixture server，恢复 handbook/unowned/race 初始状态。API 测试结束后再启动预览，禁止同时重置其数据库。测试端口可通过 PROPOSAL_BROWSER_PORT 指定；同名数据库必须使用本任务独立 PostgreSQL 实例。

```text
harness -> proposals.test + claim-cases
        -> browser-server -> browser.spec + claim-copy.browser.spec
```

手动预览可打开 `/__test/login/claimant?next=/edit/unowned`，使用本地签名的虚构 @zgzg.io 账号回到无主链接；无需真实发信。

`owner-avatar-cases.ts` 共用 harness 检查规范化邮箱、不同 owner、无主及 claim/PATCH/transfer 响应；`owner-avatar.browser.spec.ts` 检查 Jazzicon、不同访客一致、键盘提示、手机和认领后保存。运行浏览器命令时追加该文件。

`unowned-avatar.browser.spec.ts`：专用 avatar-empty fixture 检查默认头像、Enter/Space/点击、Escape 回焦、外部关闭、登录回跳与 1280/390/320px。旧界面缺少空头像时该用例失败；运行浏览器命令时一并追加。

masked-email.test.ts 覆盖边界邮箱；owner-avatar-cases 检查公开脱敏字段与完整邮箱不泄漏，浏览器检查长域名和 aria-label。

edit-header.browser.spec.ts 覆盖 Header 登录/退出和编辑页回跳入口、审核 UI 撤销、窄屏及新建 fallback 单一导航。原版缺少 Header 时回归失败。

独立认证占位端口可通过 PROPOSAL_TEST_AUTH_URL 指定，并与构建 VITE_SUPABASE_URL 一致（末尾包含 /）。
