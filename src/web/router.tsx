import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { Landing } from "./pages/Landing";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Create = lazy(() => import("./pages/Create"));
const Edit = lazy(() => import("./pages/Edit"));
const Warn = lazy(() => import("./pages/Warn"));
const NotFound = lazy(() => import("./pages/NotFound"));

const Fallback = () => null;

/** 应用路由表. Landing 为 / (会被 SSG 预渲染), 其余按需 lazy 加载. */
export function AppRoutes() {
  return (
    <Suspense fallback={<Fallback />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/create" element={<Create />} />
        <Route path="/edit/:slug" element={<Edit />} />
        <Route path="/warn/:slug" element={<Warn />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
