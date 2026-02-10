# Phase 1 验证清单

本文档包含验证 Phase 1 Foundation Setup 是否正确的所有步骤。

## 1️⃣ 依赖安装验证

```bash
# 安装所有依赖
npm install

# 验证安装成功（应无错误）
npm list --depth=0
```

**预期结果：**
- ✅ `node_modules/` 目录已创建
- ✅ `package-lock.json` 已生成
- ✅ 所有 42 个包已安装

---

## 2️⃣ TypeScript 严格模式验证

```bash
# 运行 TypeScript 类型检查
npm run type-check
```

**预期结果：**
- ✅ 0 个 TypeScript 错误
- ✅ 0 个警告

---

## 3️⃣ 代码规范验证

```bash
# 运行 ESLint
npm run lint

# 格式化代码（检查是否需要）
npm run format
```

**预期结果：**
- ✅ 0 个 lint 错误
- ✅ 所有文件符合编码规范

---

## 4️⃣ 单元测试验证

```bash
# 运行所有单元测试
npm test

# 生成测试覆盖率报告
npm run test:coverage

# 打开测试 UI（交互式）
npm run test:ui
```

**预期结果：**
- ✅ 50+ 个测试全部通过
- ✅ 测试覆盖率 ≥ 80%
- ✅ 特别是：
  - `slug.test.ts`: 所有 slug 验证用例通过
  - `url.test.ts`: 所有 URL 验证和私有 IP 检测通过
  - `hash.test.ts`: SHA-256 哈希一致性验证通过
  - `ip-mask.test.ts`: IPv4/IPv6 掩盖逻辑通过

---

## 5️⃣ 数据库架构验证

```bash
# 生成迁移文件
npm run db:generate

# 查看生成的迁移
ls -la src/db/migrations/
```

**预期结果：**
- ✅ `src/db/migrations/` 目录已创建
- ✅ 至少有一个 SQL 迁移文件
- ✅ 迁移文件包含 4 个表：
  - `users` (PK: id UUID)
  - `links` (PK: slug VARCHAR)
  - `audit_logs` (PK: id UUID)
  - `daily_visits` (PK: id UUID)
- ✅ 所有外键和索引已定义

---

## 6️⃣ 环境配置验证

```bash
# 检查 .env.example
cat .env.example

# 创建本地 .env.local（用于开发）
cp .env.example .env.local

# 编辑 .env.local 并填入正确的值
# 至少需要填入：
# - DATABASE_URL （或后续可跳过本地测试）
# - NEXT_PUBLIC_SUPABASE_URL
# - NEXT_PUBLIC_SUPABASE_ANON_KEY
```

**预期结果：**
- ✅ `.env.example` 包含所有必要的环境变量
- ✅ 所有变量都有明确的说明注释
- ✅ 敏感信息（如 SUPABASE_SERVICE_ROLE_KEY）已清楚标记

---

## 7️⃣ 文件结构验证

```bash
# 验证所有关键文件存在
ls -la src/db/schema.ts          # 数据库 schema
ls -la src/db/db.ts              # 数据库客户端
ls -la src/types/index.ts        # 类型导出
ls -la src/lib/validations/      # 验证逻辑
ls -la src/lib/constants/        # 常量定义
ls -la tests/unit/               # 单元测试
ls -la src/app/api/v1/health/    # API 路由
```

**预期结果：**
- ✅ 所有 42 个文件都存在
- ✅ 文件夹结构符合设计：
  ```
  src/
  ├── app/
  ├── db/
  ├── lib/
  │   ├── api/
  │   ├── auth/
  │   ├── constants/
  │   ├── utils/
  │   └── validations/
  └── types/
  tests/
  ├── fixtures/
  └── unit/
  ```

---

## 8️⃣ Next.js 应用验证

```bash
# 启动开发服务器
npm run dev

# 在另一个终端测试健康检查端点
curl http://localhost:3000/api/v1/health
```

**预期结果：**
- ✅ 开发服务器启动无错误
- ✅ 健康检查端点返回：
  ```json
  {
    "success": true,
    "data": {
      "status": "ok",
      "version": "v1",
      "timestamp": "2026-02-09T..."
    },
    "timestamp": "2026-02-09T..."
  }
  ```
- ✅ 主页 `http://localhost:3000` 可正常访问

---

## 9️⃣ 验证关键功能

### 9.1 Slug 验证

```bash
# 启动 Node REPL
node

# 在 REPL 中测试 slug 验证
const { validateSlug } = require('./dist/lib/validations/slug');
console.log(validateSlug('example'));        // {valid: true, normalized: 'example'}
console.log(validateSlug('api'));           // {valid: false, error: 'SLUG_RESERVED'}
console.log(validateSlug('-invalid'));      // {valid: false, error: '...'}
```

或直接运行单元测试：
```bash
npm test -- slug.test.ts
```

**预期结果：**
- ✅ 有效 slug 通过验证
- ✅ 保留 slug 被拒绝
- ✅ 格式不符合的 slug 被拒绝

### 9.2 URL 验证

```bash
npm test -- url.test.ts
```

**预期结果：**
- ✅ 公网 URL 通过验证
- ✅ 私有 IP URL 被拒绝
- ✅ 格式错误的 URL 被拒绝

### 9.3 哈希和 IP 掩盖

```bash
npm test -- hash.test.ts
npm test -- ip-mask.test.ts
```

**预期结果：**
- ✅ SHA-256 哈希一致
- ✅ IPv4 和 IPv6 正确掩盖

---

## 🔟 构建验证

```bash
# 构建生产版本
npm run build

# 启动生产服务器
npm start
```

**预期结果：**
- ✅ 构建无错误
- ✅ `.next/` 目录已创建
- ✅ 生产服务器启动无错误
- ✅ 健康检查端点仍然可用

---

## 完整验证脚本

如果想一次性运行所有验证，可以使用此脚本：

```bash
#!/bin/bash
set -e

echo "🧪 Phase 1 验证开始..."

echo "1️⃣ 安装依赖..."
npm install

echo "2️⃣ TypeScript 类型检查..."
npm run type-check

echo "3️⃣ ESLint 代码检查..."
npm run lint

echo "4️⃣ 运行单元测试..."
npm test

echo "5️⃣ 生成数据库迁移..."
npm run db:generate

echo "6️⃣ 构建应用..."
npm run build

echo "✅ Phase 1 验证完成！"
echo ""
echo "验证项目："
echo "  ✅ 依赖安装"
echo "  ✅ TypeScript 类型检查"
echo "  ✅ 代码规范"
echo "  ✅ 单元测试 (50+ 用例)"
echo "  ✅ 数据库架构"
echo "  ✅ 生产构建"
echo ""
echo "后续步骤："
echo "  1. 配置 .env.local 中的 Supabase 凭证"
echo "  2. 运行: npm run db:push （推送到数据库）"
echo "  3. 开始 Phase 2: 核心 API 端点实现"
```

保存为 `validate-phase1.sh`，然后运行：
```bash
chmod +x validate-phase1.sh
./validate-phase1.sh
```

---

## ✅ 验证检查清单

| 项目 | 命令 | 预期结果 |
|-----|------|---------|
| 依赖安装 | `npm install` | 0 个错误 |
| 类型检查 | `npm run type-check` | 0 个 TS 错误 |
| 代码规范 | `npm run lint` | 0 个 lint 错误 |
| 单元测试 | `npm test` | 50+ 通过 |
| 数据库迁移 | `npm run db:generate` | SQL 文件已创建 |
| 生产构建 | `npm run build` | 构建成功 |
| 健康检查 | `curl localhost:3000/api/v1/health` | 返回 success: true |

---

## 常见问题

### Q: 如何跳过某些测试？
```bash
npm test -- --exclude="tests/unit/validations/url.test.ts"
```

### Q: 如何只运行特定测试？
```bash
npm test slug.test.ts
```

### Q: 如何调试测试失败？
```bash
npm run test:ui  # 打开交互式 UI 调试
```

### Q: 如何生成详细的测试覆盖率报告？
```bash
npm run test:coverage
# 然后打开 coverage/index.html
```

---

## 下一步

当所有验证都通过后，您可以：

1. ✅ 配置 Supabase（获取连接字符串）
2. ✅ 更新 `.env.local` 中的数据库凭证
3. ✅ 运行 `npm run db:push` 推送 schema 到数据库
4. ✅ 开始 Phase 2：核心 API 端点实现

---

**估计验证时间：5-10 分钟**

有任何验证失败，请运行：
```bash
npm run test:ui
```
以交互式方式调试具体的测试失败。
