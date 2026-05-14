import { FormEvent, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

type LocationState = {
  from?: { pathname?: string };
};

export default function Login() {
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { user, loading, configured, signInWithMagicLink } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from =
    (location.state as LocationState | null)?.from?.pathname || "/dashboard";

  useEffect(() => {
    if (!loading && user) navigate(from, { replace: true });
  }, [from, loading, navigate, user]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSentTo(null);
    const normalized = email.trim().toLowerCase();
    if (!normalized) {
      setError("请输入邮箱地址。");
      return;
    }

    setSubmitting(true);
    try {
      await signInWithMagicLink(normalized);
      setSentTo(normalized);
    } catch (err) {
      setError(err instanceof Error ? err.message : "发送登录链接失败。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-panel" aria-labelledby="login-title">
        <Link to="/" className="brand auth-brand" aria-label="Open GoLinks 首页">
          <span className="brand__mark" aria-hidden>
            o/
          </span>
          <span>Open GoLinks</span>
        </Link>

        <div className="auth-copy">
          <h1 id="login-title">登录 Open GoLinks</h1>
          <p>输入邮箱后, 我们会发送一封魔法链接邮件。</p>
        </div>

        <form className="auth-form" onSubmit={onSubmit}>
          <label className="auth-label" htmlFor="login-email">
            Email
          </label>
          <input
            id="login-email"
            className="auth-input"
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            disabled={submitting || Boolean(sentTo)}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
          />

          <button
            className="btn btn--primary auth-submit"
            type="submit"
            disabled={submitting || !configured || Boolean(sentTo)}
          >
            {submitting ? (
              <>
                <span className="spinner" aria-hidden />
                发送中
              </>
            ) : (
              "发送登录链接"
            )}
          </button>
        </form>

        {!configured ? (
          <p className="auth-message auth-message--error">
            Supabase 前端环境变量未配置, 无法登录。
          </p>
        ) : null}

        {error ? (
          <p className="auth-message auth-message--error">{error}</p>
        ) : null}

        {sentTo ? (
          <p className="auth-message auth-message--success">
            登录链接已发送到 {sentTo}。请在同一浏览器打开邮件中的链接。
          </p>
        ) : null}
      </section>
    </main>
  );
}

