import { getDecksMeta } from "@/lib/decks";

export const dynamic = "force-static";   // 빌드 타임 프리렌더 (Workers 호출 0)
import meta from "@/lib/gen/meta.json";
import { DeckList } from "./deck-list";
import { describeDeck } from "@/lib/describe";
import { Breadcrumbs, JsonLd, KW, SITE } from "@/app/seo";

export const metadata = {
  title: `롤체 덱 티어 리스트 시즌 ${meta.set} — 최신 메타 덱 순위·조합·아이템`,
  description: `롤토체스(롤체) 시즌 ${meta.set} 덱 티어 리스트. 한국 챌린저 데이터로 매일 갱신되는 OP/S/A 덱, 평균 등수·Top4·1등 비율, 레벨별 조합과 추천 아이템, 팀 코드.`,
  alternates: { canonical: "/decks" },
};

export default async function DecksPage() {
  const { decks: all, source } = await getDecksMeta();
  const decks = [...all].sort((a, b) => a.tier - b.tier || a.avgPlacement - b.avgPlacement);
  return (
    <main className="w-full max-w-3xl px-4 py-8 sm:py-10">
      <Breadcrumbs items={[{ name: "덱 티어 리스트", href: "/decks" }]} />
      <JsonLd data={{ "@context": "https://schema.org", "@type": "ItemList", name: `${KW.b} ${KW.season} 덱 티어 리스트`, itemListElement: decks.map((d, i) => ({ "@type": "ListItem", position: i + 1, name: `${d.tierLabel} ${d.name}`, url: `${SITE}/deck/${d.id}` })) }} />
      <header className="mb-5">
        <h1 className="text-2xl font-bold sm:text-3xl">롤체 덱 티어 리스트 <span className="num text-base text-muted">{KW.season}</span></h1>
        <p className="mt-1 text-sm text-muted">
          현재 패치 기준 인기 조합과 핵심 아이템을 확인하세요. <span className="num text-muted">SET {meta.set} · {source === "db" ? "자체 통계" : meta.metaUpdated}</span>
        </p>
      </header>
      <DeckList decks={decks} guides={Object.fromEntries(decks.map((d) => [d.id, describeDeck(d).slice(0, 2).join(" ")]))} />
    </main>
  );
}
