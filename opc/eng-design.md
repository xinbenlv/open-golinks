# 工程设计

复用 Bun/Hono/Drizzle/Postgres 和现有 React 主题。前一提议功能见 [技术设计](../docs/plans/archived/2026-09-15-proposed-changes-phase-2.md)。

## 无主链接认领与复制

用户已明确范围：`@zgzg.io` 登录账号可认领无主链接；slug 与图标均复制，Go 保持独立。不发布生产。

```text
Edit / Claim -> ClaimOwnership -> existing POST /links/:slug/claim
Login -> Supabase -> AuthCallback -> safe original edit path
Verified JWT email -> exact zgzg.io gate -> atomic owner-null UPDATE + audit transaction
ShortLinkActions -> canonical VITE_BASE_URL + slug -> Clipboard + live feedback
```

- `ownerId === null` 是无主语义；已拥有及软删链接不可认领。并发请求只有一次成功，失败者收到 409。
- fingerprint/legacy email 保留为 Dashboard 发现和旧请求格式兼容，不能绕过本次精确域限制。通用登录和 owner/admin Save、其他人 Propose change 权限保持。
- 成功后保留表单草稿、设置 owner 并只推进本次认领的一个 revision；如管理员同时修改内容，后续 Save 仍由 CAS 拒绝，避免覆盖。
- 登录参数只允许 edit/claim slug 或 Dashboard；30 分钟本地回跳记录兼容旧邮件模板在同浏览器新 tab 打开。旧模板跨设备不携带目标的限制需明确说明。
- 共享复制逻辑、icon-only 图标、44px 触控区域、原生按钮键盘操作、焦点与简短状态反馈。

## 验证

真实隔离 PostgreSQL/JWKS 测试域授权、并发与审计回滚；Chrome 检查登录回跳、claim→Save、复制、提案回归与窄屏。生产构建和 type-check；Lighthouse 检查首页与 edit 页。使用独立 55449/3198 端口，截图为本地虚构 fixture。

## 链接主人头像

用户确认直接按邮箱自动生成几何头像，无需填写用户名或图片。复用现有 users.email，不增加资料表、迁移或第三方服务。

```text
links.owner_id -> users.email -> canonical email + HMAC -> owner.avatarSeed
Edit -> OwnerAvatar -> @metamask/jazzicon 2.0.0（本地 DOM/SVG）
```

服务端使用现有 IP_HASH_SALT，加独立 owner-avatar 域前缀计算 HMAC；浏览器只收到截短 seed，不收到邮箱或普通 email hash。相同邮箱产生固定头像（轮换服务端 salt 后会变化），同一 owner 跨链接保持一致。公开 tooltip 为 Link owner。

详情、认领、保存和转移响应返回相同 owner 形状。无主仍显示 ZGID 认领入口；认领后保留草稿与 revision +1 规则。权限判定不变。

验证：真实 DB/JWT 检查正确 owner、相同邮箱一致、邮箱不泄漏及无主分支；浏览器检查匿名/登录查看一致、认领后立即显示、保存后保留、键盘与 320px 布局。
