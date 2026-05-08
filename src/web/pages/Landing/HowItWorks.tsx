import { useReveal } from "../../hooks/useReveal";

const STEPS = [
  {
    n: "01",
    title: "贴入长链接",
    desc: "任何 https:// 链接都行. 文档、PR、Notion 页面、设计稿……",
    code: { input: "https://docs.example.com/very/long/path?id=42" },
  },
  {
    n: "02",
    title: "可选自定义 slug",
    desc: "想要 go/onboard? 直接填. 留空则自动生成 6 位短码.",
    code: { slug: "onboard" },
  },
  {
    n: "03",
    title: "整团队用同一个短链",
    desc: "粘贴到 Slack / 邮件 / 文档. 短链是语义化的, 比贴一长串可读多了.",
    code: { output: "go/onboard" },
  },
];

export function HowItWorks() {
  const headRef = useReveal<HTMLDivElement>();
  return (
    <section className="section" id="how">
      <div className="container">
        <div ref={headRef} className="reveal section__head">
          <span className="section__eyebrow">原理</span>
          <h2 className="section__title">三步创建, 一次生效</h2>
          <p className="section__lead">
            没有 onboarding 表单, 没有套路. 输入即用.
          </p>
        </div>
        <div className="steps">
          {STEPS.map((s) => (
            <StepCard key={s.n} {...s} />
          ))}
        </div>
      </div>
    </section>
  );
}

function StepCard({
  n,
  title,
  desc,
  code,
}: {
  n: string;
  title: string;
  desc: string;
  code: { input?: string; slug?: string; output?: string };
}) {
  const ref = useReveal<HTMLDivElement>();
  return (
    <div ref={ref} className="reveal step">
      <div className="step__num">{n}</div>
      <h3 className="step__title">{title}</h3>
      <p className="step__desc">{desc}</p>
      <div className="step__code">
        {code.input && <span>{code.input}</span>}
        {code.slug && (
          <span>
            <span className="url-host">o.dev/</span>
            {code.slug}
          </span>
        )}
        {code.output && (
          <span>
            <span className="url-host">go/</span>
            {code.output.replace("go/", "")}
          </span>
        )}
      </div>
    </div>
  );
}
