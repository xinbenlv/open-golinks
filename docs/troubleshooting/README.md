# `docs/troubleshooting/` - 排障记录

这里记录 agent 或开发者在本仓库中遇到并定位过的非显而易见问题。开始处理类似领域任务前，应先搜索本目录，避免重复踩坑。

## 当前主题

- `identity-acl-data-cleanup.md` - Identity ACL 数据清理与 `links.slug` 主键注意事项。
- `railway-nixpacks-node18.md` - Railway/Nixpacks Node 版本相关问题。
- `spa-reserved-paths.md` - 单段 SPA 路径必须穿透 redirect fallback。
- `stats-public-scope-tests.md` - public stats/trending 测试不能假设共享数据库为空。
- `supabase-pkce-custom-domain-cutover.md` - 自定义域切换后的 Supabase PKCE 回跳问题。
- `supabase-railway-ipv6.md` - Supabase/Railway IPv6 连接注意事项。
- `supabase-secret-placeholder-tests.md` - 被脱敏的 Supabase secret shadow 导致 e2e auth header 无效。

## 文档格式

每个问题至少包含：

- 问题描述
- 错误原因
- 解决方案
- 相关代码

- [编辑页操作层级](./edit-page-actions.md)：Go 紧邻短链，保存与管理操作按使用场景分区。

- [`proposal-preview.md`](./proposal-preview.md)：独立原型共享样式、sandbox 启动、HMR 和 dialog 焦点恢复。

- [`railway-static-compression.md`](./railway-static-compression.md)：Railway Bun 缺少 CompressionStream 导致页面 500。

- [`claim-login.md`](./claim-login.md)：认领 revision、旧邮件回跳、隔离测试和剪贴板权限。

claim-login.md 同时记录邮箱自动头像的产品约束和键盘/匿名 fixture 测试陷阱。

claim-login.md 记录空缺头像与通用 details 样式冲突的修复。
