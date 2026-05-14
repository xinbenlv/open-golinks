import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

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
      if (!code) {
        setError("登录回跳缺少 code。请重新发送登录链接。");
        return;
      }

      const { error: exchangeError } =
        await supabase.auth.exchangeCodeForSession(code);
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
