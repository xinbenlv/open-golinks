import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import { applyBrandTheme } from "./lib/brand";

// CSS 在客户端入口集中导入, 这样组件文件可被 SSG 脚本直接 import (无 CSS 副作用).
import "react-activity-calendar/tooltips.css";
import "./styles/tokens.css";
import "./styles/global.css";
import "./pages/Landing/landing.css";

applyBrandTheme();

const root = document.getElementById("root");
if (!root) throw new Error("缺少 #root 元素");

const isPrerenderedLanding =
  window.location.pathname === "/" && root.firstElementChild !== null;

const tree = (
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);

if (isPrerenderedLanding) {
  hydrateRoot(root, tree);
} else {
  // 非 / 路径: SPA fallback 也命中预渲染的 Landing HTML, 这里清空再 createRoot
  // 避免 hydration mismatch (代价: 极短时间的 Landing 内容闪现).
  root.innerHTML = "";
  createRoot(root).render(tree);
}
