// 홈 — 빌드 타임 프리렌더. 회전목마 우선순위만 서버에서 계산해 클라이언트 폼에 넘김.
import { carouselPriority } from "@/lib/score";
import { getDecks } from "@/lib/decks";
import { HomeForm } from "./home-form";

export const dynamic = "force-static";

export default async function Home() {
  const decks = await getDecks();
  const carousel = carouselPriority(decks).slice(0, 5).map((c) => ({ component: c.component, score: c.score, deckNames: c.decks.map((d) => d.name) }));
  return <HomeForm carousel={carousel} />;
}
