import { CreateForm } from "./CreateForm";

type HeroProps = {
  /** /edit/[slug] 进入时, 用 URL slug 预填表单. */
  initialSlug?: string;
};

export function Hero({ initialSlug }: HeroProps) {
  return (
    <section className="hero">
      <div className="hero__grid" aria-hidden />
      <div className="container hero__inner">
        <span className="hero__pill">
          <span className="hero__pill__dot" aria-hidden />
          v2 已上线 · 开源
        </span>
        <h1>
          让链接变得 <span className="accent">语义化、</span>
          <br />
          整个团队都看得懂
        </h1>
        <p className="hero__sub">
          Open GoLinks: 开源、可自部署的 go/links 短链服务. 匿名可用, 公私可控, 内置访问统计.
        </p>
        <div className="hero__form-wrap">
          <CreateForm initialSlug={initialSlug} />
        </div>
      </div>
    </section>
  );
}
