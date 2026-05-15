# Identity ACL 数据清理注意事项

## 问题描述

清理生产库中匿名旧链接的内部 metadata 时，第一次只读备份查询失败：

```text
PostgresError: column "id" does not exist
```

当时目标是删除未归属链接上的错误内部字段：

```sql
metadata->>'legacy_author_email' = 'anonymous'
```

## 错误原因

`links` 表没有 `id` 列，主键是 `slug`。一次性数据修复脚本如果按常见的 `id` 主键假设写备份或 `RETURNING id`，会在执行前失败。

## 解决方案

所有针对 `links` 的一次性数据清理、备份和核对脚本都用 `slug` 作为行标识：

```sql
SELECT slug, owner_id, metadata, created_at, updated_at, deleted_at
FROM links
WHERE owner_id IS NULL
  AND lower(metadata->>'legacy_author_email') = 'anonymous';
```

生产清理执行前已写 JSON 备份：

```text
var/identity-acl-backups/2026-05-15T00-56-22-528Z-anonymous-legacy-email-cleanup.json
```

清理后核对结果：

```text
updated=4987
remaining_anonymous_legacy_email=0
active unowned_with_legacy_email=0
```

## 相关代码

- `src/db/schema.ts:52-80`
- `scripts/lib/identity-acl.ts:368-438`
