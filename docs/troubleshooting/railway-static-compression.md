# Railway 静态页面压缩 500

## 问题和原因

2026-09-15 发布后 API 正常，但接受 gzip/deflate 的页面请求返回 500；identity 请求返回 200。Railway 日志确认 `ReferenceError: CompressionStream is not defined`。本地较新的 Bun 支持该 API，生产运行时不支持。

## 解决方案

`src/middleware/static-compression.ts` 使用 node:zlib 的异步 gzip/deflate，保留 Vary、编码协商和 no-transform。`tests/static-compression.test.ts` 在移除 CompressionStream 后验证两种编码可解压，以及 q=0 不压缩。

发布验收必须实际访问带 Accept-Encoding 的 HTML 和 JS，不能仅用 API health/version 判断网站可用。
