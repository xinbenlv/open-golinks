import { useId, useRef, useState, useTransition } from "react";
import { IconArrowRight, IconCheck, IconCopy } from "./icons";

const MOCK_HOST = "o.dev";

// 与后端 schema CHECK 约束保持一致
const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$|^[a-z0-9]{3}$/;
const RESERVED = new Set([
  "api",
  "auth",
  "create",
  "dashboard",
  "edit",
  "warn",
  "assets",
  "static",
]);

const SLUG_ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";

function genSlug(): string {
  let s = "";
  for (let i = 0; i < 6; i++) {
    s += SLUG_ALPHABET[Math.floor(Math.random() * SLUG_ALPHABET.length)];
  }
  return s;
}

function isValidUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

type Result = { slug: string; url: string; isPublic: boolean };

export function CreateForm() {
  const urlId = useId();
  const slugId = useId();
  const pubId = useId();

  const [url, setUrl] = useState("");
  const [slug, setSlug] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [errors, setErrors] = useState<{ url?: string; slug?: string }>({});
  const [result, setResult] = useState<Result | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  const copyTimer = useRef<number | null>(null);

  function validate(): { url?: string; slug?: string } | null {
    const next: { url?: string; slug?: string } = {};
    if (!url.trim()) next.url = "请输入要缩短的链接";
    else if (!isValidUrl(url.trim())) next.url = "需要 http:// 或 https:// 开头的有效链接";

    const cleaned = slug.trim().toLowerCase();
    if (cleaned) {
      if (RESERVED.has(cleaned)) next.slug = "该 slug 是保留路径";
      else if (!SLUG_RE.test(cleaned))
        next.slug = "只允许 a-z0-9-, 首尾字母数字, 长度 3-50";
    }
    return Object.keys(next).length ? next : null;
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (errs) {
      setErrors(errs);
      return;
    }
    setErrors({});

    // mock submit: 模拟一次 220ms 网络延迟
    startTransition(() => {
      window.setTimeout(() => {
        const finalSlug = slug.trim().toLowerCase() || genSlug();
        startTransition(() => {
          setResult({ slug: finalSlug, url: url.trim(), isPublic });
        });
      }, 220);
    });
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (copyTimer.current) window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  function reset() {
    setResult(null);
    setUrl("");
    setSlug("");
    setIsPublic(true);
    setErrors({});
    setCopied(false);
  }

  if (result) {
    const shortUrl = `https://${MOCK_HOST}/${result.slug}`;
    return (
      <div className="create-form" role="status" aria-live="polite">
        <div className="create-success">
          <div className="create-success__title">短链已生成 (mock)</div>
          <div className="create-success__url">
            <span className="create-success__url__text">{shortUrl}</span>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => copyToClipboard(shortUrl)}
              aria-label="复制短链"
            >
              {copied ? <IconCheck /> : <IconCopy />}
              <span>{copied ? "已复制" : "复制"}</span>
            </button>
          </div>
          <p className="create-success__hint">
            后端 POST /api/v1/links 还未接通, 此处仅为前端 mock. {result.isPublic ? "公开" : "私有"}.
          </p>
          <div className="create-success__row">
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={reset}
            >
              再创建一个
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form className="create-form" onSubmit={onSubmit} noValidate>
      <div className="field">
        <label className="field__label" htmlFor={urlId}>
          目标链接
        </label>
        <input
          id={urlId}
          type="url"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/very/long/path"
          className="field__input"
          aria-invalid={!!errors.url}
          aria-describedby={errors.url ? `${urlId}-err` : undefined}
          required
        />
        <div id={`${urlId}-err`} className="field__error">
          {errors.url ?? " "}
        </div>
      </div>

      <div className="field">
        <label className="field__label" htmlFor={slugId}>
          自定义 slug <span style={{ color: "var(--text-faint)" }}>(可选)</span>
        </label>
        <div className="field__prefix-wrap">
          <span className="field__prefix">{MOCK_HOST}/</span>
          <input
            id={slugId}
            type="text"
            autoComplete="off"
            spellCheck={false}
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="留空自动生成"
            className="field__input field__input--with-prefix"
            aria-invalid={!!errors.slug}
            aria-describedby={errors.slug ? `${slugId}-err` : undefined}
            maxLength={50}
          />
        </div>
        <div id={`${slugId}-err`} className="field__error">
          {errors.slug ?? " "}
        </div>
      </div>

      <div className="create-form__actions">
        <label className="checkbox" htmlFor={pubId}>
          <input
            id={pubId}
            type="checkbox"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
          />
          <span>公开可见</span>
        </label>
        <button
          type="submit"
          className="btn btn--primary"
          disabled={pending}
          aria-busy={pending}
        >
          <span>{pending ? "创建中" : "创建短链"}</span>
          <IconArrowRight />
        </button>
      </div>
    </form>
  );
}
