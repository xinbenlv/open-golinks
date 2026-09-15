# API 与历史回归

F1–F14 覆盖旧认证、CRUD、统计、QR、审计及转移；运行说明见 [../legacy-tests.md](../legacy-tests.md)。部分旧测试会调用外部服务，执行前核对环境。

```text
e2e/
├── F*-*.test.ts                 # 功能回归；F5 复用隔离套件
├── identity-acl.test.ts         # 纯 identity/迁移 helper
└── reserved-slug-fallthrough.test.ts # 路由穿透
```

F5-claim 入口导入 proposals 的真实本地 JWT/DB 套件，需要专用 PROPOSAL_TEST_DATABASE_URL；无配置时跳过。详细命令与数据库隔离要求见 [../proposals/README.md](../proposals/README.md)。不要把旧 mock.module 套件与提议套件混在同一 Bun 进程。
