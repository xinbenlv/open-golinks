import { Link } from "react-router-dom";

export function ComingSoon({ title, desc }: { title: string; desc: string }) {
  return (
    <main
      style={{
        flex: 1,
        display: "grid",
        placeItems: "center",
        padding: "var(--space-12) var(--space-6)",
      }}
    >
      <div
        style={{
          maxWidth: 460,
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-4)",
        }}
      >
        <h1
          style={{
            fontSize: "var(--text-2xl)",
            margin: 0,
            letterSpacing: "-0.02em",
          }}
        >
          {title}
        </h1>
        <p
          style={{
            color: "var(--text-muted)",
            margin: 0,
            lineHeight: "var(--leading-relaxed)",
          }}
        >
          {desc} 即将推出.
        </p>
        <div>
          <Link to="/" className="btn btn--ghost btn--sm">
            返回首页
          </Link>
        </div>
      </div>
    </main>
  );
}
