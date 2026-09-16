import Link from "next/link";
import { DECKS, unitById } from "@/lib/data";
import { COST_TEXT, ItemIcon, TierBadge, UnitIcon } from "@/app/icons";
import { LevelComps } from "@/app/levels";

export const metadata = {
  title: "덱 목록",
  description: "롤토체스 시즌 18 S/A 티어 메타 덱 전체 목록. 레벨별 조합, 핵심 아이템, 평균 등수.",
};

export default function DecksPage() {
  const decks = [...DECKS].sort((a, b) => a.tier - b.tier || a.avgPlacement - b.avgPlacement);

  return (
    <main className="w-full max-w-3xl px-4 py-8 sm:py-12">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gold-light">덱 목록</h1>
        <p className="mt-1 text-sm text-muted">
          {decks.length}개 · 평균 등수 순. 카드를 누르면 레벨별 조합과 핵심 아이템이 펼쳐집니다.
        </p>
      </header>

      <div className="space-y-3">
        {decks.map((deck) => {
          const carry = unitById(deck.carryId ?? "");
          // 유닛별 아이템 묶기 (아이템 있는 유닛만)
          const itemsByUnit = deck.coreItems.reduce<Record<string, string[]>>((acc, ci) => {
            (acc[ci.unitId] ??= []).push(ci.itemId);
            return acc;
          }, {});
          return (
            <details key={deck.id} className="panel group rounded-xl bg-panel open:bg-panel/90">
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 p-4 [&::-webkit-details-marker]:hidden">
                <TierBadge tier={deck.tierLabel} size="lg" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-lg font-bold">{deck.name}</div>
                  <div className="text-xs text-muted/80">
                    평균 {deck.avgPlacement.toFixed(2)}등{deck.games && ` · ${deck.games.toLocaleString()}판`}
                    {carry && <> · 캐리 <span className={COST_TEXT[carry.cost]}>{carry.name}</span></>}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {deck.coreUnits.map((cu) => (
                    <UnitIcon key={cu.unitId} id={cu.unitId} size="sm" className={cu.unitId === deck.carryId ? "bg-teal!" : ""} />
                  ))}
                </div>
                <span className="text-muted transition group-open:rotate-180">▾</span>
              </summary>

              <div className="space-y-4 border-t border-gold/15 p-4">
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-gold-light">레벨별 조합</h3>
                  <LevelComps deck={deck} />
                </div>

                <div>
                  <h3 className="mb-2 text-sm font-semibold text-gold-light">핵심 아이템</h3>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(itemsByUnit).map(([uid, itemIds]) => (
                      <div key={uid} className={`flex items-center gap-2 rounded-lg border p-2 ${uid === deck.carryId ? "border-teal/40 bg-teal/5" : "border-gold/15 bg-panel-2/40"}`}>
                        <UnitIcon id={uid} size="sm" />
                        <div>
                          <div className="text-xs font-semibold">{unitById(uid)?.name}</div>
                          <div className="mt-1 flex gap-1">
                            {itemIds.map((iid, i) => <ItemIcon key={i} id={iid} />)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <Link href={`/deck/${deck.id}`} className="inline-block rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-navy hover:bg-gold-light">
                  배치도·상세 보기 →
                </Link>
              </div>
            </details>
          );
        })}
      </div>
    </main>
  );
}
