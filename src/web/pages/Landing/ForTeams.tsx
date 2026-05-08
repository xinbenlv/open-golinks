import { useReveal } from "../../hooks/useReveal";
import { IconCheck } from "./icons";

const POINTS = [
  "Chrome 扩展拦截 go/* 关键字, 直接跳转, 不必先开主页",
  "私有部署: 自托管在 Railway / Fly / 自家 K8s 都行",
  "全员加速「长链接 → 短链」在团队中的扩散",
  "路线图: 标签 / 分组 / 团队空间 / SAML",
];

export function ForTeams() {
  const wrapRef = useReveal<HTMLDivElement>();
  const visualRef = useReveal<HTMLDivElement>();
  return (
    <section className="section">
      <div className="container teams">
        <div ref={wrapRef} className="reveal teams__copy">
          <span className="section__eyebrow">面向团队</span>
          <h2 className="teams__title">把"语义化链接"装进团队的肌肉记忆</h2>
          <p className="section__lead">
            Chrome 扩展 + 自部署后端, 让 <code className="serif">go/onboard</code> 这种链接成为团队默认沟通方式.
          </p>
          <ul className="teams__list">
            {POINTS.map((p) => (
              <li key={p}>
                <IconCheck width={18} height={18} />
                <span>{p}</span>
              </li>
            ))}
          </ul>
          <div>
            <a
              href="https://github.com/xinbenlv/open-golinks#chrome-extension"
              target="_blank"
              rel="noreferrer"
              className="btn btn--ghost"
            >
              查看 Chrome 扩展
            </a>
          </div>
        </div>
        <div ref={visualRef} className="reveal teams__visual" aria-hidden>
          <p className="teams__visual__caption">浏览器地址栏</p>
          <div className="teams__visual__row">
            <span className="teams__visual__addr">
              <code>go/onboard</code>
            </span>
            <span className="teams__visual__pill">扩展拦截</span>
          </div>
          <div className="teams__visual__row">
            <span className="teams__visual__addr">
              ↳ <code>https://notion.so/...new-hire-checklist</code>
            </span>
            <span className="teams__visual__pill">302 跳转</span>
          </div>
          <p className="teams__visual__caption">
            一行短链 → 整团队都到达同一份文档
          </p>
        </div>
      </div>
    </section>
  );
}
