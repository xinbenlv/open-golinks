import { useParams } from "react-router-dom";
import { StatsView } from "./index";

export default function SlugStats() {
  const { slug = "" } = useParams<{ slug: string }>();
  return <StatsView slug={slug} />;
}
