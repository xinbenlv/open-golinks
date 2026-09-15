# 源码

- `server.ts`：Bun/Hono 入口，生产托管压缩后的 SPA，启动提议元数据过期清理。
- `db/`：Drizzle schema 与迁移。
- `routes/`：API、redirect、warning、QR。
- `middleware/`：认证、审计、限流和静态压缩。
- `lib/`：共享 helper 与提议服务。
- `web/`：React SPA。

数据流与关键位置见 [`docs/CURRENT-ARCHITECT.md`](../docs/CURRENT-ARCHITECT.md)。

认领复用 links API：JWT 的 `@zgzg.io` 邮箱授权，owner 为空时原子更新并在同一事务写审计。

链接详情通过 `lib/link-owner.ts` 返回邮箱派生的头像 seed；前端本地绘制 Jazzicon，不公开邮箱。
