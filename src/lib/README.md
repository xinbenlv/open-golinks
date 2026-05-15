# src/lib

`src/lib` 放后端和前端共用度较高、但不直接注册路由的基础 helper。

## 文件

- `fingerprint.ts` - 浏览器 fingerprint 生成与 64-hex 格式校验。
- `ga4.ts` - GA4 Data API 查询和 Measurement Protocol 上报。
- `gcp.ts` - 将 Railway 环境变量里的 GCP service account JSON 写入临时文件。
- `identity.ts` - email canonicalize、metadata normalize、公开 link DTO 脱敏。
- `qr.ts` - 服务端 QR PNG 渲染与缓存。

## 注意事项

- `identity.ts#sanitizeLinkRecord` 会删除 `metadata.legacy_author_email`，该字段只能用于迁移和后端 claim 判断，不能出现在公开 API 响应里。
- `normalizeEmail` 是 `public.users.email` 写入、transfer recipient lookup、legacy claim 和迁移脚本共用的 canonical email 规则。
