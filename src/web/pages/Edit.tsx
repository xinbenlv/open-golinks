import { useParams } from "react-router-dom";
import { ComingSoon } from "./ComingSoon";

export default function Edit() {
  const { slug } = useParams<{ slug: string }>();
  return (
    <ComingSoon
      title={`编辑 /${slug ?? ""}`}
      desc="修改 url、可见性、所有权、删除."
    />
  );
}
