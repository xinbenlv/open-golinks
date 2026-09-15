# JSON API

- `links.ts`：创建、查询、编辑、claim、transfer 和软删除；PATCH 用 revision CAS 防并发覆盖。
- `proposals.ts`：提议请求边界与路由注册，转交 `../../lib/proposals/`。
- `audit.ts`：owner 审计历史。
- `me.ts`：当前认证用户。
- `stats.ts`：GA4 统计；`qr.ts`：QR API。
- `health.ts` / `version.ts`：运行状态和构建版本。
- `v2-compat.ts`：旧 Chrome extension API。

浏览器不能直接读提议表；详情仅对当前 owner/admin 开放。

PATCH 在事务内锁定链接并校验数据库 owner/admin 权限；JWT role 不能授予管理权限。转移和删除仍为 owner-only。

Audit API 对 owner/admin 开放，关联提议身份与未过期匿名详情；响应 private/no-store，普通成员无权访问。

GET /links/:slug/proposals/identity 仅返回当前请求的身份，private/no-store；与提交共用 IP/UA 解析，不写数据库。

Claim API 要求已验证 JWT 的 authenticated 非匿名用户及精确 `@zgzg.io` 域；单条 UPDATE 限制 owner_id/deleted_at 为空，事务包含审计。claimable 保留 fingerprint/legacy email 发现规则，但不能绕过域限制。

单链接 GET、创建/恢复、claim、PATCH 和 transfer 共用 linkWithOwner；`owner` 只含邮箱派生 avatarSeed，无主为 null，不返回邮箱。事务写入使用同一连接读取 owner。
