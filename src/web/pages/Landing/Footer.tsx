import { formatVersionLine, getVersion } from "../../version";
import { webBrand } from "../../lib/brand";

export function Footer() {
  const year = new Date().getFullYear();
  const v = getVersion();
  const versionLabel = formatVersionLine(v);
  const repoCommit =
    v.sha === "dev"
      ? "https://github.com/xinbenlv/open-golinks"
      : `https://github.com/xinbenlv/open-golinks/commit/${v.sha}`;

  return (
    <footer className="landing-footer">
      <div className="container landing-footer__inner">
        <div className="landing-footer__copy">
          © {year} {webBrand.productName} · {webBrand.genericName} · 开源 MIT 协议
          <span className="landing-footer__version">
            <span aria-hidden="true"> · </span>
            <a href={repoCommit} target="_blank" rel="noreferrer" title="查看构建对应的 commit">
              {versionLabel}
            </a>
          </span>
        </div>
        <nav className="landing-footer__links" aria-label="页脚导航">
          <a
            href="https://github.com/xinbenlv/open-golinks"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
          <a
            href="https://github.com/xinbenlv/open-golinks#readme"
            target="_blank"
            rel="noreferrer"
          >
            文档
          </a>
          <a
            href="https://github.com/xinbenlv/open-golinks/blob/main/LICENSE"
            target="_blank"
            rel="noreferrer"
          >
            License
          </a>
        </nav>
      </div>
    </footer>
  );
}
