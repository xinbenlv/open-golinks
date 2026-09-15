# Drizzle 迁移

用 `bun run db:generate` 生成，用 `bun run db:migrate` 应用。`meta/` 存放 snapshots 与迁移 journal，必须和 SQL 一起提交。

- 0000：初始业务表。
- 0001：daily visits 唯一索引。
- 0002：用户 canonical email 约束。
- 0003：提议表、revision trigger、RLS 与浏览器角色写权限收口；trigger/授权是手写 SQL，生成 schema 时不可丢弃。
