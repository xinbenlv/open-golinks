import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { AuthGuard } from "./components/AuthGuard";
import { Landing } from "./pages/Landing";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Create = lazy(() => import("./pages/Create"));
const Edit = lazy(() => import("./pages/Edit"));
const Login = lazy(() => import("./pages/Login"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const Claim = lazy(() => import("./pages/Claim"));
const QrEditor = lazy(() => import("./pages/QrEditor"));
const Stats = lazy(() => import("./pages/Stats"));
const SlugStats = lazy(() => import("./pages/Stats/SlugStats"));
const NotFound = lazy(() => import("./pages/NotFound"));

const Fallback = () => null;

/** 应用路由表. Landing 为 / (会被 SSG 预渲染), 其余按需 lazy 加载. */
export function AppRoutes() {
  return (
    <Suspense fallback={<Fallback />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/claim/:slug" element={<Claim />} />
        <Route path="/qr/:slug" element={<QrEditor />} />
        <Route
          path="/stats"
          element={
            <AuthGuard>
              <Stats />
            </AuthGuard>
          }
        />
        <Route
          path="/stats/:slug"
          element={
            <AuthGuard>
              <SlugStats />
            </AuthGuard>
          }
        />
        <Route
          path="/dashboard"
          element={
            <AuthGuard>
              <Dashboard />
            </AuthGuard>
          }
        />
        <Route path="/create" element={<Create />} />
        <Route path="/edit/:slug" element={<Edit />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
