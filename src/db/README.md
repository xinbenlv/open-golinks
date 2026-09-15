# 数据库

`schema.ts` 定义 users、links、audit_logs、daily_visits 和 link_proposals；`db.ts` 创建服务端连接；`migrations/` 按 Drizzle journal 顺序迁移。

`links.revision` 由数据库 trigger 维护，所有写入口共用同一冲突检测版本。提议表启用 RLS，只由服务端访问。发布顺序见 [`提议运维说明`](../../docs/runbooks/proposed-changes.md)。
