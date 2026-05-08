import { useParams } from "react-router-dom";
import { Landing } from "./Landing";

/** /edit/[slug] 复用 Landing 整页, 只是把表单的 slug 字段预填,
 *  并自动把光标放到 URL 输入框 (CreateForm 内部 useEffect 处理).
 *  设计意图: 用户访问一个还不存在的短链时, redirect.ts 把他们 302 到这里,
 *  这样"看链接 → 没找到 → 直接创建"是一条平滑路径. */
export default function Edit() {
  const { slug } = useParams<{ slug: string }>();
  return <Landing initialSlug={slug ?? ""} />;
}
