# 认领、登录回跳与测试

记录无主链接认领涉及的旧认证兼容和本地验证陷阱。

## 认领后立即 Save 报 revision 冲突

`links_revision` trigger 在 owner_id 改变时增加 revision。页面必须同步本次认领的一次增量，同时保留草稿。不能盲目采纳服务器最新 revision：其他管理员在认领之前更新内容时，应让旧草稿 Save 得到 409，不能覆盖新内容。

相关：`src/web/pages/Edit.tsx`、`src/db/migrations/0003_brave_mulholland_black.sql`。

## 旧邮件模板没有 next

现有模板固定调用 `/auth/confirm?token_hash=...&type=email`，不传 `.RedirectTo`。标准 Supabase callback 通过 next 返回原页；旧模板通过同浏览器 localStorage 的 30 分钟回跳记录恢复原页（新 tab 也可）。不同浏览器/设备或清除存储后，旧模板会回 Dashboard。未修改生产模板或认证配置；生产发信未在本地 stub 测试中验证。

相关：`src/web/lib/authReturn.ts`、`src/web/pages/AuthCallback.tsx`。

## 浏览器测试权限与计数

Chrome 的 `clipboard-write` permission 映射为 clipboardReadWrite，不能代替 writeText 所需的 clipboardSanitizedWrite。Puppeteer 测试同时授权 clipboard-read 和 clipboard-sanitized-write，实际执行剪贴板读写。另一个旧断言误用 `page.$` 返回单元素再检查 length；计数应使用 `page.$$`，且先等待异步历史请求渲染出 `.audit-event`；tab 已选中并不代表数据已加载。

相关：`tests/proposals/claim-copy.browser.spec.ts`、`tests/proposals/browser.spec.ts`。

## 隔离测试与外部工具

同一进程内多次初始化 harness 会与缓存的 JWKS middleware 冲突；claim-cases 与提议共用一次生命周期。不同任务使用不同 Postgres 端口，浏览器测试前重启本任务 fixture；不要重置正在使用的预览数据库。

Lighthouse 的入口是 `cli/index.js`，`cli/bin.js` 只导出 begin，不会执行审计。GuestSafe 中已有 GitHub 凭据仅用于博客或 journal，不适用于此仓库写入；本任务使用已连接 GitHub 插件，不读取旧 CLI/OAuth 凭据。

## ZGID 邮箱域更正

用户明确更正账号域为 `zgzg.io`。前后端统一判断精确 `@zgzg.io`，登录占位与错误提示同步；`@zg.io`、子域和后缀伪装均被测试覆盖为拒绝。已先用更正后的测试复现旧判断拒绝合法账号，再验证修复。相关：`src/lib/identity.ts`、`tests/proposals/auth-return.test.ts`、`tests/proposals/claim-cases.ts`。

## 自动头像与预览回归

- 问题：短链账号通常不会填写姓名/图片。原因：先前方案依赖个人资料。解决：用户指定邮箱派生 Jazzicon，复用 users.email，无 schema 迁移；不将邮箱传给外部服务。相关：src/lib/link-owner.ts、src/web/components/OwnerAvatar.tsx。
- 问题：头像测试反复聚焦后提示没有出现。原因：Escape 关闭提示后，focus 已在同一按钮，不会再次触发 focus。解决：先移到 slug 再回到头像，模拟真实键盘导航；匿名测试登录仍固定回到 handbook，再显式导航测试链接。相关：tests/proposals/owner-avatar.browser.spec.ts。
- 问题：Drizzle generate 将 meta/README.md 当作 JSON。原因：本地版本扫描整个 meta 目录。解决：生成时临时移开 README 再恢复。本次最终无 schema 变更，无迁移文件。

- 问题：本机负载使 Lighthouse CPU benchmark 从约 4375 降至 1261，重复测量波动。解决：关闭本任务闲置浏览器、独立测量；头像库同时改为按需加载，避免进入编辑页首屏包。相关：src/web/components/OwnerAvatar.tsx。
