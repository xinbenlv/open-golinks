# Open GoLinks v2-hono - Railway 部署镜像
# 单容器: Bun runtime + Hono server + 静态托管 Vite SPA build 产物

FROM oven/bun:1.1-alpine AS builder
WORKDIR /app

# 装依赖
COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile

# 复制源码并构建 SPA
COPY . .
RUN bun run build:web

# ---- 运行时镜像 ----
FROM oven/bun:1.1-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# 只复制运行时需要的内容
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/src ./src
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/drizzle.config.ts ./

EXPOSE 3000
CMD ["bun", "src/server.ts"]
