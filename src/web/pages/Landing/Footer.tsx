import { formatBuiltAtShort, getVersion } from "../../version";
import { webBrand } from "../../lib/brand";

export function Footer() {
  const year = new Date().getFullYear();
  const v = getVersion();
  const isDev = v.sha === "dev";
  const repoCommit = isDev
    ? "https://github.com/xinbenlv/open-golinks"
    : `https://github.com/xinbenlv/open-golinks/commit/${v.sha}`;
  const time = formatBuiltAtShort(v.builtAt);

  return (
    <footer className="landing-footer">
      <div className="container landing-footer__inner">
        <div className="landing-footer__copy">
          © {year} {webBrand.productName} · {webBrand.genericName} · 开源 MIT 协议
          <span className="landing-footer__version">
            <span aria-hidden="true"> · </span>
            <span>v{v.version}</span>
            <span aria-hidden="true"> · </span>
            <a href={repoCommit} target="_blank" rel="noreferrer" title="查看构建对应的 commit (GitHub)">
              {v.sha}
            </a>
            {time && (
              <>
                <span aria-hidden="true"> · </span>
                {v.deployUrl ? (
                  <a
                    href={v.deployUrl}
                    target="_blank"
                    rel="noreferrer"
                    title="查看本次 Railway 部署"
                  >
                    {time}
                  </a>
                ) : (
                  <span>{time}</span>
                )}
              </>
            )}
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
