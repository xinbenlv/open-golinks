# 测试

使用 Bun test runner。测试行为和用户流程，不锁实现细节。

## 提议（本地隔离）

[proposals/README.md](./proposals/README.md) 提供真实 PostgreSQL + 本地 JWT 的权限/并发回归、浏览器完整流程、极简 diff 验证。不要与旧全局 mock.module 测试放在同一进程运行。

## 原有测试

- e2e/：F1–F14 API、ACL、reserved path 回归。
- browser/：Puppeteer 真实浏览器 smoke 和 README tour。
- [legacy-tests.md](./legacy-tests.md)：原有测试的详细说明与命令。

部分旧测试默认使用生产 Railway 地址或需要 Supabase 测试凭据；执行前核对目标。新的提议 harness 强制专用 loopback 数据库，不需要生产凭据。

## 基本命令

- bun run type-check
- bun test tests/proposals/inline-diff.test.tsx
- bun test tests/e2e/identity-acl.test.ts

真实提议、认领 DB / 浏览器命令见上方 README。截图只保存到指定本地目录，不自动公开上传。

`static-compression.test.ts` 验证缺少 CompressionStream 时 gzip/deflate 页面仍可解压，以及 q=0 的编码协商。

`qr-logo.test.ts` 验证首次导出包含已解码的 ZGZG logo，且logo 边界之外保留原 QR 模块。

F5-claim 入口复用隔离提议/认领套件，不再创建真实 Supabase 测试账号。claim-cases 覆盖域资格、抢占、并发和审计回滚；auth-return 覆盖安全回跳。

owner-avatar-cases 与 owner-avatar.browser.spec 验证邮箱头像隐私、归属一致性和认领/保存后的头像。
