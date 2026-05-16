# Supabase PKCE 登录回跳到旧域名

## 问题描述

生产域名从 Railway 默认域名切到 `zgzg.li` 后, 用户在 `zgzg.li/login`
发起 magic link 登录, 邮件链接却回跳到旧域名:

```text
https://open-golinks-v2-hono-production.up.railway.app/auth/callback?...
```

页面显示:

```text
PKCE code verifier not found in storage
```

## 错误原因

Supabase PKCE flow 会把 code verifier 存在发起登录页面的浏览器 storage 中。
`zgzg.li` 和 `open-golinks-v2-hono-production.up.railway.app` 是不同 origin,
旧域名 callback 读不到 `zgzg.li` 下保存的 verifier。

本项目的 magic link redirect URL 来自 `VITE_BASE_URL`; 切正式域名时如果
Railway 仍保留旧值, 新登录邮件会继续指向旧域名。

## 解决方案

1. Railway production service 同时更新:

```sh
railway variable set \
  --service open-golinks-v2-hono \
  --environment production \
  PUBLIC_BASE_URL=https://zgzg.li \
  VITE_BASE_URL=https://zgzg.li
```

2. 等待 Railway 重新 build/deploy, 因为 `VITE_BASE_URL` 会被打进 Vite
   前端 bundle。
3. 确认 Supabase Auth Site URL 和 redirect allowlist 使用正式域名:

```text
Site URL: https://zgzg.li
https://zgzg.li/auth/callback
```

4. TokenHash 模板应让邮件按钮指向 `https://zgzg.li/auth/confirm?...`,
   不要直接暴露 Supabase `ConfirmationURL` 长链接。
5. 旧邮件里的 magic link 不能复用; 用户必须从 `https://zgzg.li/login`
   重新发送登录邮件。

## 相关代码

- `src/web/lib/supabase.ts:21-27` - 根据 `VITE_BASE_URL` 生成 `/auth/callback`
- `src/web/hooks/useAuth.ts:82-93` - `signInWithOtp` 传入 `emailRedirectTo`
- `src/web/pages/AuthCallback.tsx:26-43` - callback 用 `exchangeCodeForSession`
  读取 PKCE verifier 并交换 session
- `src/routes/auth.ts:1-64` - `/auth/confirm` 用 TokenHash 调 `verifyOtp`,
  再把 session 交给 SPA callback
