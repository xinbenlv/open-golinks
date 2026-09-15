# Railway 静态页面压缩 500

## 问题和原因

2026-09-15 发布后 API 正常，但接受 gzip/deflate 的页面请求返回 500；identity 请求返回 200。Railway 日志确认 `ReferenceError: CompressionStream is not defined`。本地较新的 Bun 支持该 API，生产运行时不支持。

## 解决方案

`src/middleware/static-compression.ts` 使用 node:zlib 的异步 gzip/deflate，保留 Vary、编码协商和 no-transform。`tests/static-compression.test.ts` 在移除 CompressionStream 后验证两种编码可解压，以及 q=0 不压缩。

发布验收必须实际访问带 Accept-Encoding 的 HTML 和 JS，不能仅用 API health/version 判断网站可用。

## 本地预览与 QR 首次渲染

本地 fixture 的 Bun.file 响应经过中间件后可能丢失隐式 MIME；browser-server.ts 显式设置 Content-Type。QR 下载首次出现空白中心时，原因是 canvas Image 尚未完成解码；qr.ts 在模块初始化等待 decode，测试验证首次渲染出现 logo。
