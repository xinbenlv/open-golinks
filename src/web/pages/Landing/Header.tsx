import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTheme } from "../../hooks/useTheme";
import { useAuth } from "../../hooks/useAuth";
import { webBrand } from "../../lib/brand";
import { IconGitHub, IconSun, IconMoon, IconMonitor } from "./icons";

const THEME_LABEL: Record<string, string> = {
  light: "切换主题: 当前浅色",
  dark: "切换主题: 当前深色",
  system: "切换主题: 跟随系统",
};

export function Header() {
  const { theme, toggleTheme } = useTheme();
  const { user, signOut } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="landing-header" data-scrolled={scrolled}>
      <div className="container landing-header__inner">
        <a href="/" className="brand" aria-label={webBrand.homepageLabel}>
          <span className="brand__mark" aria-hidden>
            {webBrand.logoUrl ? (
              <img className="brand__logo" src={webBrand.logoUrl} alt="" />
            ) : (
              "o/"
            )}
          </span>
          <span>{webBrand.productName}</span>
        </a>

        <nav className="nav" aria-label="主导航">
          <a
            href="#features"
            className="nav__link nav__link--hide-sm"
          >
            特性
          </a>
          <a
            href="#how"
            className="nav__link nav__link--hide-sm"
          >
            原理
          </a>
          <a
            href="https://github.com/xinbenlv/open-golinks"
            className="nav__link nav__link--hide-sm"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>

          <button
            type="button"
            onClick={toggleTheme}
            className="icon-btn"
            aria-label={THEME_LABEL[theme] ?? "切换主题"}
            title={THEME_LABEL[theme]}
          >
            {theme === "light" ? (
              <IconSun />
            ) : theme === "dark" ? (
              <IconMoon />
            ) : (
              <IconMonitor />
            )}
          </button>

          <a
            href="https://github.com/xinbenlv/open-golinks"
            className="icon-btn"
            target="_blank"
            rel="noreferrer"
            aria-label="GitHub 仓库"
          >
            <IconGitHub />
          </a>

          {user ? (
            <div className="nav-account">
              <Link to="/dashboard" className="nav-account__email">
                {user.email ?? "Dashboard"}
              </Link>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                disabled={signingOut}
                onClick={async () => {
                  setSigningOut(true);
                  try {
                    await signOut();
                  } finally {
                    setSigningOut(false);
                  }
                }}
              >
                {signingOut ? "退出中" : "登出"}
              </button>
            </div>
          ) : (
            <Link to="/login" className="btn btn--ghost btn--sm">
              登录
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
