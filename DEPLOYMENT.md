# 部署与生产切换

## Railway

生产服务:

- Project: `open-golinks-v2`
- Environment: `production`
- Service: `open-golinks-v2-hono`
- Canonical domain: `https://zgzg.li`
- Legacy alias: `https://zgzg.link`

关键变量:

```text
PUBLIC_BASE_URL=https://zgzg.li
VITE_BASE_URL=https://zgzg.li
OPEN_GOLINK_THEME=zgzg
```

部署本地工作区:

```sh
railway up --service open-golinks-v2-hono --environment production
```

验证:

```sh
curl -fsS https://zgzg.li/api/v1/health
curl -fsS https://zgzg.link/api/v1/health
curl -fsS https://zgzg.li/api/v1/version
```

## Supabase Auth

生产 Auth 配置必须使用正式域名:

```text
site_url=https://zgzg.li
uri_allow_list=http://localhost:3000/auth/callback,http://localhost:5173/auth/callback,https://zgzg.li/auth/callback
```

Magic Link 邮件模板维护在 [`docs/email-templates/`](./docs/email-templates/)。
生产 ZGZG 模板使用 TokenHash URL:

```html
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
```

`/auth/confirm` 由 Hono 后端处理, 调 Supabase `verifyOtp`, 成功后把 session token
交给 SPA `/auth/callback`。

更新 Supabase 项目级 Magic Link 模板:

```sh
PROJECT_REF=zbzzmsesjvfaipwuaehr
jq -n --rawfile html docs/email-templates/magic-link-zgzg.html \
  '{mailer_subjects_magic_link:"登录 zgzg.li", mailer_templates_magic_link_content:$html}' |
curl -fsS -X PATCH "https://api.supabase.com/v1/projects/$PROJECT_REF/config/auth" \
  -H "Authorization: Bearer $SUPABASE_ACCOUNT_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  --data-binary @-
```

## Resend

Resend sending domain 已通过 API 创建:

```text
domain=zgzg.li
id=a5311ab2-4878-438b-bb90-c246d1250310
status=not_started
```

需要在 Name.com DNS 添加 Resend 返回的记录:

```text
TXT  resend._domainkey  p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDCZcZNTR8i0nOaGhdL+tKS8UsjWyLbV9xQFTKPVeLyqbLHuVzzixcZeIxakvN845Ma5VVrptP/sZjDQBfMyUB2aPMrcVKFiI/0j/NhTfnoLJV31ZJIi9megwC8ihRwnZ+PvaGxC4yHF9Vu4JVCVL71SvFPsFtcxf7lmqA+vmw3jwIDAQAB
MX   send               feedback-smtp.us-east-1.amazonses.com  priority=10
TXT  send               v=spf1 include:amazonses.com ~all
```

DNS 添加后触发验证:

```sh
curl -fsS -X POST "https://api.resend.com/domains/a5311ab2-4878-438b-bb90-c246d1250310/verify" \
  -H "Authorization: Bearer $RESEND_API_KEY"
```

Supabase custom SMTP 可用 Resend SMTP:

```text
smtp_host=smtp.resend.com
smtp_port=587
smtp_user=resend
smtp_pass=$RESEND_API_KEY
smtp_admin_email=noreply@zgzg.li
smtp_sender_name=zgzg.li
```

Supabase Auth config 当前没有 `Reply-To` 字段。若必须设置
`Reply-To: zgzg-dot-li@zgzg.io`, 需要改用 Supabase Send Email Hook 自己调用
Resend API, 或在 Resend 侧配置全局/default reply-to。
