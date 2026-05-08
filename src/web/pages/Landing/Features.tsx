import { useReveal } from "../../hooks/useReveal";
import { IconLink, IconShield, IconChart, IconCode } from "./icons";

const ITEMS = [
  {
    icon: IconLink,
    title: "匿名即可创建",
    desc: "不必登录就能上手. 后续注册可认领并管理已创建链接.",
  },
  {
    icon: IconShield,
    title: "公私可控",
    desc: "默认公开便于分享; 一键改私有, 仅本人可见.",
  },
  {
    icon: IconChart,
    title: "访问统计 + 趋势",
    desc: "每个短链记录访问数、来源与每日趋势图, 用数据迭代分享内容.",
  },
  {
    icon: IconCode,
    title: "开源 · 自部署",
    desc: "MIT 协议, Bun + Hono + Postgres, 数据 100% 在你自己的基础设施上.",
  },
];

export function Features() {
  const ref = useReveal<HTMLDivElement>();
  return (
    <section className="section" id="features">
      <div className="container">
        <div ref={ref} className="reveal section__head">
          <span className="section__eyebrow">为什么 Open GoLinks</span>
          <h2 className="section__title">克制设计, 关键功能一个不少</h2>
          <p className="section__lead">
            围绕日常分享与团队协作的真实场景设计, 不堆砌, 不上锁.
          </p>
        </div>
        <div className="features">
          {ITEMS.map((item) => (
            <FeatureCard key={item.title} {...item} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  desc,
}: {
  icon: (typeof ITEMS)[number]["icon"];
  title: string;
  desc: string;
}) {
  const ref = useReveal<HTMLDivElement>();
  return (
    <div ref={ref} className="reveal feature">
      <div className="feature__icon">
        <Icon />
      </div>
      <h3 className="feature__title">{title}</h3>
      <p className="feature__desc">{desc}</p>
    </div>
  );
}
