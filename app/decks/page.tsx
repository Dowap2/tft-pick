import { getDecksMeta } from "@/lib/decks";

export const dynamic = "force-static";   // 빌드 타임 프리렌더 (Workers 호출 0)
import meta from "@/lib/gen/meta.json";
import { DeckList } from "./deck-list";
import { describeDeck } from "@/lib/describe";

export const metadata = {
  title: "TFT 덱 티어 리스트 - 최신 패치 조합 분석",
  description: `최신 TFT 패치(Set ${meta.set}) 기준 티어별 덱과 챔피언 조합, 추천 아이템, 레벨별 보드를 확인하세요.`,
  alternates: { canonical: "/decks" },
};

export default async function DecksPage() {
  const { decks: all, source } = await getDecksMeta();
  const decks = [...all].sort((a, b) => a.tier - b.tier || a.avgPlacement - b.avgPlacement);
  return (
    <main className="w-full max-w-3xl px-4 py-8 sm:py-10">
      <header className="mb-5">
        <h1 className="text-2xl font-bold sm:text-3xl">TFT 덱 티어 리스트</h1>
        <p className="mt-1 text-sm text-muted">
          현재 패치 기준 인기 조합과 핵심 아이템을 확인하세요. <span className="num text-muted">SET {meta.set} · {source === "db" ? "자체 통계" : meta.metaUpdated}</span>
        </p>
      </header>
      <DeckList decks={decks} guides={Object.fromEntries(decks.map((d) => [d.id, describeDeck(d).slice(0, 2).join(" ")]))} />
    </main>
  );
}
