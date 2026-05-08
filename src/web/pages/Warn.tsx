import { useParams } from "react-router-dom";
import { ComingSoon } from "./ComingSoon";

export default function Warn() {
  const { slug } = useParams<{ slug: string }>();
  return (
    <ComingSoon
      title={`警告: /${slug ?? ""}`}
      desc="确认跳转外部链接的拦截页."
    />
  );
}
