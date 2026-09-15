import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
export default defineConfig({
  root: import.meta.dirname,
  plugins: [react()],
  publicDir: path.resolve(import.meta.dirname, "../../src/web/public"),
  define: { "import.meta.env.VITE_OPEN_GOLINK_THEME": JSON.stringify("zgzg") },
  server: {
    host: "127.0.0.1",
    port: 5174,
    strictPort: true,
    fs: { allow: [path.resolve(import.meta.dirname, "../..")] },
  },
  build: { outDir: "../../dist/proposed-changes-demo", emptyOutDir: true },
});
