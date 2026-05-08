import { Header } from "./Header";
import { Hero } from "./Hero";
import { Features } from "./Features";
import { HowItWorks } from "./HowItWorks";
import { ForTeams } from "./ForTeams";
import { Footer } from "./Footer";

type LandingProps = {
  /** /edit/[slug] 复用本组件时, 把 URL 里的 slug 透传给 Hero 表单做预填. */
  initialSlug?: string;
};

/** Landing 页 (`/`).
 *  本组件被 SSG 在构建期预渲染到 dist/web/index.html 中, 客户端 hydrate 接管.
 *  /edit/[slug] 也复用本组件 (initialSlug = 路径参数), 让"创建/编辑"和首页是同一张页面.
 *  CSS 在 src/web/main.tsx 集中导入, 本文件不直接 import .css.
 */
export function Landing({ initialSlug }: LandingProps = {}) {
  return (
    <div className="landing">
      <Header />
      <main className="landing-main">
        <Hero initialSlug={initialSlug} />
        <Features />
        <HowItWorks />
        <ForTeams />
      </main>
      <Footer />
    </div>
  );
}
