# Hono 路由

`api/` 为版本化 JSON API；其余文件处理认证回调、短链 redirect、warning HTML 与 QR PNG。入口注册在 `../server.ts`。

提议 API 先于 links CRUD 注册，权限与事务实现在 `../lib/proposals/`。

links 的认领只接受可信 `@zgzg.io` 身份；不会修改通用登录、直接编辑和提议规则。

单链接读取和写入响应包含 `owner.avatarSeed`，供编辑页显示自动头像。
