# Supabase Secret 被脱敏环境变量 shadow 导致 e2e 认证失败

## 问题描述

运行 `bun test tests/e2e/F5-claim.test.ts` 时，测试在调用 Supabase Admin `generate_link` 前失败：

```text
TypeError: Header 'apikey' has invalid value
```

## 错误原因

`.env` 文件里的 `SUPABASE_SECRET_KEY` 是完整值，但当前 shell / agent 进程里的 `process.env.SUPABASE_SECRET_KEY` 可能已经被脱敏处理，从第 15 个字符后变成 middle-dot 字符。测试 helper 直接读 `process.env`，所以会优先拿到被脱敏的进程环境变量，而不是 `.env` 文件里的完整值。

Bun `Headers` 会拒绝这个被脱敏后的 header value，请求尚未发出就失败。

## 解决方案

让测试进程不要继承被脱敏的 `SUPABASE_SECRET_KEY`，由 Bun 从 `.env` 读取完整值：

```bash
env -u SUPABASE_SECRET_KEY bun test tests/e2e/F5-claim.test.ts
```

如果其它 Supabase e2e 也出现同样错误，也用同样方式运行，或显式注入真实未脱敏的 service-role/Admin key。

已验证命令：

```bash
env -u SUPABASE_SECRET_KEY bun test tests/e2e/F5-claim.test.ts
```

结果：5 pass。

## 相关代码

- `tests/e2e/F5-claim.test.ts:26-57`
