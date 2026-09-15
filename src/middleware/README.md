# 中间件

`auth.ts` 校验 Supabase JWT 并同步用户；`audit.ts` 写操作审计；`ratelimit.ts` 限制匿名创建；`static-compression.ts` 压缩生产 HTML/CSS/JS，设置 Vary。

提议的数据库限流和严格可选认证在提议模块中，避免改动旧创建接口契约。

压缩使用 node:zlib，兼容 Railway 中没有 CompressionStream 的 Bun 运行时。
