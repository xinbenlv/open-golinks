# Supabase 邮件模板

这些文件是 Supabase Auth `Magic Link` 邮件模板的可复制版本。

## 使用位置

Supabase Dashboard:

```text
Authentication -> Emails -> Magic Link
```

建议 subject:

- Open GoLinks: `登录 Open GoLinks`
- ZGZG: `登录 zgzg.li`

把对应 HTML 文件的完整内容复制到 Magic Link template body。

## 模板变量

模板使用 Supabase 官方变量:

- `{{ .SiteURL }}` - Supabase Auth Site URL, 生产为 `https://zgzg.li`
- `{{ .TokenHash }}` - 一次性 token 的 hash, 用于自定义确认链接
- `{{ .Email }}` - 收件邮箱

当前模板使用 `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`。
后端 `/auth/confirm` 调 Supabase `verifyOtp`, 成功后跳到 `/auth/callback`
并把 session token 放在 URL fragment 中, 由现有 SPA callback 写入浏览器 session。

## 文件

- [`magic-link-open-golinks.html`](./magic-link-open-golinks.html) - 默认 Open GoLinks 主题
- [`magic-link-zgzg.html`](./magic-link-zgzg.html) - ZGZG / `zgzg.li` 主题
