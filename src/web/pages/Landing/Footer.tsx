export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="landing-footer">
      <div className="container landing-footer__inner">
        <div className="landing-footer__copy">
          © {year} Open GoLinks · 开源 MIT 协议
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
