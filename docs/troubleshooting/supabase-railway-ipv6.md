# Railway 容器连 Supabase 5432 直连 ECONNREFUSED

## 问题描述

部署到 Railway 后，redirect 路由 500，运行日志：

```
error: connect ECONNREFUSED 2600:1f13:5fd:be01:...:5432
Failed query: select "url", "slug" from "links" where ...
```

## 错误原因

Supabase 把免费/小型项目的直连 DB host (`db.<project-ref>.supabase.co:5432`) 切成了 **IPv6-only**。Railway 容器虽然支持 IPv6 出站，但到 Supabase IPv6 endpoint 的路径在多个区域不稳定，连接经常 refused / timeout。

这不是 Railway 的 bug、也不是 Supabase 的 bug，是两边设计选择交叉的结果——Supabase 官方文档明确说：**直连仅供 Supabase 内部 runtime 使用，外部 runtime 必须走 Supavisor connection pooler**。

## 解决方案

把 `DATABASE_URL` 从直连换成 **Supavisor transaction pooler** (port 6543，IPv4 可达)。

格式：

```
postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres
```

从 Supabase Dashboard 拿：

> Project Settings → Database → Connection pooling → **Transaction** 模式 → Connection string

注意：

- 用户名是 `postgres.<ref>`（带 ref 后缀），不是 `postgres`
- Drizzle 配置必须 `prepare: false`（pooler 不支持 prepared statements） — 已经在 `src/db/db.ts:13` 配好
- Railway 那边把 `DATABASE_URL` 替换成 pooler URL 后 redeploy

## 相关代码

- `src/db/db.ts:7-13` — `postgres()` 客户端，`prepare:false` 是 pooler 兼容必需
- `template.env:1-3` — 已注释正确的 pooler URL 格式
