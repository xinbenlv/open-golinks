# JSON API

- `links.ts`：创建、查询、编辑、claim、transfer 和软删除；PATCH 用 revision CAS 防并发覆盖。
- `proposals.ts`：提议请求边界与路由注册，转交 `../../lib/proposals/`。
- `audit.ts`：owner 审计历史。
- `me.ts`：当前认证用户。
- `stats.ts`：GA4 统计；`qr.ts`：QR API。
- `health.ts` / `version.ts`：运行状态和构建版本。
- `v2-compat.ts`：旧 Chrome extension API。

浏览器不能直接读提议表；详情仅对当前 owner/admin 开放。
