import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// SPA 前端 (Dashboard / Create / Edit / Warn 页面)
// 构建产物输出到 dist/web/, 由 Hono server 在生产环境托管
export default defineConfig({
  plugins: [react()],
  root: "src/web",
  publicDir: path.resolve(__dirname, "src/web/public"),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: {
    outDir: path.resolve(__dirname, "dist/web"),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3000",
    },
  },
});
