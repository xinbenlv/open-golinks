import { Header } from "./Header";
import { Hero } from "./Hero";
import { Features } from "./Features";
import { HowItWorks } from "./HowItWorks";
import { ForTeams } from "./ForTeams";
import { Footer } from "./Footer";

/** Landing 页 (`/`).
 *  本组件被 SSG 在构建期预渲染到 dist/web/index.html 中, 客户端 hydrate 接管.
 *  CSS 在 src/web/main.tsx 集中导入, 本文件不直接 import .css.
 */
export function Landing() {
  return (
    <div className="landing">
      <Header />
      <main className="landing-main">
        <Hero />
        <Features />
        <HowItWorks />
        <ForTeams />
      </main>
      <Footer />
    </div>
  );
}
