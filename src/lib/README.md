# src/lib

`src/lib` 放后端和前端共用度较高、但不直接注册路由的基础 helper。

## 文件

- `fingerprint.ts` - 浏览器 fingerprint 生成与 64-hex 格式校验。
- `brand.ts` - `OPEN_GOLINK_THEME` 品牌配置, 区分 favicon、brand/action/warning 语义色。
- `ga4.ts` - GA4 Data API 查询和 Measurement Protocol 上报。
- `gcp.ts` - 将 Railway 环境变量里的 GCP service account JSON 写入临时文件。
- `identity.ts` - email canonicalize、metadata normalize、公开 link DTO 脱敏。
- `qr.ts` - 服务端 QR PNG 渲染与缓存；ZGZG 透明 logo 直接叠在二维码上，不添加白色缓冲区，与前端预览一致。

## 注意事项

- `identity.ts#sanitizeLinkRecord` 会删除 `metadata.legacy_author_email`，该字段只能用于迁移和后端 claim 判断，不能出现在公开 API 响应里。
- `normalizeEmail` 是 `public.users.email` 写入、transfer recipient lookup、legacy claim 和迁移脚本共用的 canonical email 规则。

- proposals/：共享类型、验证、事务、分页、私有元数据和过期清理。

二维码外围总留白缩为原来的约 1/3，保持画布尺寸并扩大码体；预览与导出一致。

`identity.ts#canClaimOwnership` 共用于前端提示和后端域判断；后端只传入验证后的 JWT email，忽略请求体和 user_metadata 的邮箱。

`link-owner.ts`：单链接 DTO 的公开主人投影；规范化邮箱经带域分隔的 HMAC 生成 avatarSeed，只返回 seed。
