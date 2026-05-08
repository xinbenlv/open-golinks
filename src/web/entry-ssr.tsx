// SSR / SSG 入口: 由 scripts/prerender.ts 在构建期调用,
// 把指定路径渲染成 HTML 字符串注入 dist/web/index.html.
// 注意: 本文件不能 import 任何 .css (CSS 仅在 main.tsx 客户端入口加载).

import { StrictMode } from "react";
import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router-dom";
import { App } from "./App";

export function renderApp(url: string): string {
  return renderToString(
    <StrictMode>
      <StaticRouter location={url}>
        <App />
      </StaticRouter>
    </StrictMode>,
  );
}
