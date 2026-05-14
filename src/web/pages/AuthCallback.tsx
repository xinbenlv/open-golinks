import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

function readImplicitSessionFromHash() {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (!accessToken || !refreshToken) return null;
  return { access_token: accessToken, refresh_token: refreshToken };
}

export default function AuthCallback() {
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    async function exchange() {
      if (!supabase) {
        setError("Supabase 前端环境变量未配置。");
        return;
      }

      const code = new URLSearchParams(window.location.search).get("code");
      const implicitSession = readImplicitSessionFromHash();
      if (!code && !implicitSession) {
        setError("登录回跳缺少 code 或 session。请重新发送登录链接。");
        return;
      }

      const { error: exchangeError } = code
        ? await supabase.auth.exchangeCodeForSession(code)
        : await supabase.auth.setSession({
            access_token: implicitSession!.access_token,
            refresh_token: implicitSession!.refresh_token,
          });
      if (cancelled) return;

      if (exchangeError) {
        setError(exchangeError.message);
        return;
      }

      navigate("/dashboard", { replace: true });
    }

    void exchange();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <main className="auth-page">
      <section className="auth-panel auth-panel--compact">
        {error ? (
          <>
            <h1>登录失败</h1>
            <p className="auth-message auth-message--error">{error}</p>
            <Link to="/login" className="btn btn--ghost">
              返回登录
            </Link>
          </>
        ) : (
          <>
            <span className="spinner" aria-label="Loading" />
            <p className="auth-message">正在完成登录...</p>
          </>
        )}
      </section>
    </main>
  );
}
