# 变更提议

共享类型、数据库事务和私有元数据处理。`types.ts` 可被前端引用；服务端文件禁止导入前端。

- validation.ts：严格输入与游标。
- submit.ts / review.ts / read.ts：API 处理函数。
- store.ts：锁、权限、限流与 DTO。
- metadata.ts / geoip.ts / retention.ts：短期私有详情；本地 GeoIP 可选。

新提议的私有详情按身份区分：匿名记录 IP/浏览器，登录用户记录邮箱/account ID；IP 哈希仍用于服务端限流。旧详情按原保留期过期。

提议支持增删 tags，未传 tags 的旧提议审批时保留现有标签。审核者列表可取得保留期内的匿名详情，其他角色 DTO 不包含这些字段。

Publish（Public listing）支持提议开启或关闭，仅审批后更新 isPublic；旧提议未含此字段时保持现有设置。
