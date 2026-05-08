import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("缺少 #root 元素");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
