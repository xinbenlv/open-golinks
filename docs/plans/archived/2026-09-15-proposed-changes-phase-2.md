# Proposed changes 实现

## Overview

2026-09-15 用户批准原型，进入真实实现。保留 Namefi 极简 inline diff；任何访客可提议 URL/描述，当前 owner 或数据库 users.role=admin 可以审核。

## Deliverables

- Postgres 提议表、链接 revision、审核事务和审计记录。
- 真实 Edit 页提交、待审、历史、私有元数据弹窗。
- 隔离数据库集成测试、浏览器验证、部署说明。

## Implementation Steps

1. API `/api/v1/links/:slug/proposals` GET/POST；`/:id/review` POST；`/:id/metadata` GET。
2. 提交保存服务端基线和 revision；任何内容、权限、删除状态变化由数据库 trigger 增加 revision，访问计数不增加。审核锁定链接再锁提议；只有 pending 且 revision 匹配可通过。链接、URL history、提议与审计同一事务提交。普通 PATCH 使用 revision CAS，防并发覆盖。
3. 列表按时间/id 游标分页。reviewer 可查看全部；普通用户仅自己，匿名以随机 HttpOnly SameSite cookie 证明归属。私有元数据独立接口，审核时重新鉴权。JWT role 不作为 admin 判据。
4. 提交每个来源 IP 哈希每分钟 5 / 每小时 30，数据库 advisory lock 跨进程序列化。JSON body 上限 16KiB。无效 bearer 返回 401。
5. 元数据保留 UA、语言、受信入口 IP；不信任任意 forwarded headers。未配置受信代理则 IP/位置未知。不访问提议 URL，不做外部定位请求。可选本地 GeoIP 数据库提供粗略区域，缺失时显示未知。元数据仅保留 30 天，清理不删除提议和审计。
6. 使用真实临时 PostgreSQL 验证权限、并发、回滚、速率限制、生命周期，浏览器验证核心流程和窄屏。

## Timeline

本次实现按 schema → API → UI → 验证顺序完成。生产迁移与部署是发布步骤，不在本次自动执行。

## Success Criteria

匿名提交不改变当前链接；owner/admin 单人即可通过；拒绝不改变链接；旧提议、重复或并发通过不会覆盖；私有信息不出现在公开响应；diff 公共前后缀只出现一次，旧值灰色删除线，新值正常文字色。

## 验证结果

实现与本地验证完成：14 项真实数据库场景、3 项 diff、完整浏览器流程、4 项原型测试通过；类型检查和生产构建通过。首页与编辑页 Lighthouse 均为 97/100/100/100。生产数据库、Railway 代理和实际 GeoIP 文件尚未操作。
