# 变更提议

共享类型、数据库事务和私有元数据处理。`types.ts` 可被前端引用；服务端文件禁止导入前端。

- validation.ts：严格输入与游标。
- submit.ts / review.ts / read.ts：API 处理函数。
- store.ts：锁、权限、限流与 DTO。
- metadata.ts / geoip.ts / retention.ts：短期私有详情；本地 GeoIP 可选。
