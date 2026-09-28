import { getDecksMeta, getEditorialDecks } from "@/lib/decks";

export const dynamic = "force-static";   // 빌드 타임 프리렌더 (Workers 호출 0)
import meta from "@/lib/gen/meta.json";
import { DeckList } from "./deck-list";
import { describeDeck } from "@/lib/describe";
import { Breadcrumbs, JsonLd, KW, SITE } from "@/app/seo";
import Link from "next/link";
import { UnitIcon } from "@/app/icons";
import { unitById } from "@/lib/data";

export const metadata = {
  title: "롤체 덱 티어 리스트",
  description: `롤토체스(롤체) 시즌 ${meta.set} 덱 티어 리스트. 한국 챌린저 데이터로 매일 갱신되는 OP/S/A 덱, 평균 등수·Top4·1등 비율, 레벨별 조합과 추천 아이템, 팀 코드.`,
  alternates: { canonical: "/decks" },
};

export default async function DecksPage() {
  const [{ decks: all, source }, editorial] = await Promise.all([getDecksMeta(), getEditorialDecks()]);
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
      {/* 에디터 추천은 티어 리스트와 섞지 않는다. 통계로 만든 순위 안에 사람이 고른 덱을 끼워 넣으면
          "챌린저~에메랄드 실데이터 기반" 이라는 설명이 그 순간 거짓이 된다. 자리를 나누고 라벨을 붙인다. */}
      {editorial.length > 0 && (
        <section className="mb-8">
          <div className="mb-2 flex items-baseline gap-2">
            <h2 className="text-lg font-semibold">에디터 추천</h2>
            <span className="text-xs text-muted">직접 구성한 덱 · 티어·평균 등수 없음</span>
          </div>
          <div className="panel divide-y divide-line rounded-xl bg-surface">
            {editorial.map((d) => (
              <Link key={d.id} href={`/deck/${d.id}`} className="block px-3 py-3 hover:bg-surface-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="num rounded border border-accent/50 px-1.5 py-px text-[10px] uppercase text-accent">에디터</span>
                  <span className="font-semibold">{d.name}</span>
                  {d.levelling && <span className="num rounded border border-line px-1.5 py-px text-[10px] text-muted">{d.levelling}</span>}
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {d.units.slice(0, 10).map((u) => (
                    <span key={u.unitId} title={unitById(u.unitId)?.name}><UnitIcon id={u.unitId} size="sm" carry={u.unitId === d.carryId} /></span>
                  ))}
                </div>
                {d.playstyle && <p className="mt-1.5 line-clamp-2 text-xs text-muted">{d.playstyle}</p>}
              </Link>
            ))}
          </div>
        </section>
      )}

      <DeckList decks={decks} guides={Object.fromEntries(decks.map((d) => [d.id, describeDeck(d).slice(0, 2).join(" ")]))} />
    </main>
  );
}
