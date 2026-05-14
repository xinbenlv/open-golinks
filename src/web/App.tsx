import { AppRoutes } from "./router";
import { BuildStamp } from "./components/BuildStamp";

/** SPA 顶层. 由 main.tsx (浏览器) 与 entry-ssr.tsx (预渲染) 共用. */
export function App() {
  return (
    <>
      <AppRoutes />
      <BuildStamp />
    </>
  );
}
