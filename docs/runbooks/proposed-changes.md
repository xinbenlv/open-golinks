# Proposed changes 发布与运维

## 发布前

1. 在 staging 备份数据库并应用 `bun run db:migrate`，确认 `0003_brave_mulholland_black` 成功。迁移新增 `link_proposals`、`links.revision` 和版本 trigger，不改既有短链 URL。
2. API 的数据库连接必须使用受信服务端角色。新表启用 RLS 且不提供浏览器策略；迁移撤销 Supabase `anon` / `authenticated` 对提议表的权限，以及对 `public.users` 的 INSERT/UPDATE/DELETE，避免直接写 admin role。前端只通过 Hono API 访问业务表。
3. 管理员由 `public.users.role = 'admin'` 判定，JWT 的 `role` 不是产品管理员角色。角色分配仍由有权限的运维人员完成，本功能不会自动提升任何账户。
4. 设置 `PUBLIC_BASE_URL` 为真实公开 origin；开发前端经不同端口代理时也要设置成浏览器访问的 origin。POST 检查 Origin 和 JSON content type。
5. 按下方代理说明配置 IP。原有 `IP_HASH_SALT` 必须存在且保持稳定。
6. 先迁移，再发布应用。旧应用可继续使用新增后的 schema；回退应用时保留表和 trigger，保留待审记录。不要反向删除审计数据。

## 提交详情

- `PROPOSAL_TRUST_PROXY=railway`：仅在 Railway 是唯一公网入口、覆盖 `X-Real-IP` 且无法绕过入口直连应用时启用。该 header 按 [Railway 文档](https://docs.railway.com/networking/public-networking/specs-and-limits) 获取远端 IP。不能在任意代理上照搬。
- 默认不信任任何转发头，IP 显示 Unknown；未知来源共享一个保守限流桶。不要把未配置代理的共享限流误认为每位访客的独立额度。
- `PROPOSAL_GEOIP_DB`：可选的本地 GeoLite2-City / GeoIP2-City `.mmdb` 文件路径。部署方负责合法获取、更新和挂载数据库；不包含在仓库，不自动下载，不把 IP 发往第三方。
- 缺少/无法读取数据库、无匹配记录时位置显示 Unknown。坐标四舍五入到 0.1°，精度半径至少 10km。详情中的图是全球坐标概览，不表示街道或设备 GPS。
- UA / locale 是客户端自报，设备与浏览器分类仅作参考。
- 原始 IP、UA、语言及定位结果仅在 reviewer 专用详情接口返回。30 天后不再返回；服务启动及每小时清除过期 `request_metadata`。离线期间清理延后至下次启动。哈希、提议和审核历史保留。

## 行为与边界

- 所有访客可提议 URL/description；URL 仅允许 HTTP(S)，不会抓取或验证目标页面内容。
- 当前 owner 或数据库 admin 可单独通过。任意字段、权限或软删除状态变化都会增加 revision，旧提议只能拒绝或重新提交；visits 不影响 revision。
- 通过在一个事务里写链接、URL history、提议状态和审计；拒绝不改链接。描述单独变化不会添加重复 URL 历史。
- 匿名状态通过 HttpOnly SameSite cookie 追踪；清除 cookie 后不能再查看旧匿名提议，登录后只列出该账户提交的提议。没有跨设备匿名恢复或通知投递。
- 每个可信 IP 哈希每分钟 5 次、每小时 30 次；数据库锁使多个进程共享限额。JSON body 上限 16KiB。
- 未保存的 owner 编辑会阻止审核，避免刷新覆盖草稿。普通 PATCH 带 baseRevision 检测过期表单；旧 API 客户端仍可不传该字段。

## 本地验证

详见 [`tests/proposals/README.md`](../../tests/proposals/README.md)。测试使用一次性 PostgreSQL 和进程内 JWT，不需要生产凭据。生产 Supabase/PostgREST、真实 Railway proxy 以及实际 GeoIP 数据文件仍需部署后 smoke。
