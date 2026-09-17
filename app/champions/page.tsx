import Link from "next/link";
import { UNITS, traitByName, unitUsage } from "@/lib/data";
import { getDecks } from "@/lib/decks";

export const dynamic = "force-static";
import { COST_TEXT, ItemIcon, TierBadge, UnitIcon } from "@/app/icons";
import meta from "@/lib/gen/meta.json";

export const metadata = {
  title: "TFT 챔피언 목록 - 코스트·시너지·추천 아이템",
  description: `롤토체스 Set ${meta.set} 전체 챔피언. 코스트별 시너지, 메타 덱에서 쓰는 추천 아이템, 등장 덱을 확인하세요.`,
  alternates: { canonical: "/champions" },
};

export default async function ChampionsPage() {
  const decks = await getDecks();
  const byCost = [1, 2, 3, 4, 5].map((c) => ({ cost: c, units: UNITS.filter((u) => u.cost === c) }));
  return (
    <main className="w-full max-w-3xl px-4 py-8 sm:py-10">
      <header className="mb-5">
        <h1 className="text-2xl font-bold sm:text-3xl">챔피언</h1>
        <p className="mt-1 text-sm text-muted">{UNITS.length}명 · 코스트순. 추천 아이템과 등장 덱은 현재 S/A 메타 덱 기준.</p>
      </header>
      <nav className="mb-5 flex gap-1 text-xs">
        {byCost.map(({ cost }) => (
          <a key={cost} href={`#cost-${cost}`} className={`rounded-md bg-surface-2 px-2.5 py-1 font-semibold ${COST_TEXT[cost]}`}>{cost}코</a>
        ))}
      </nav>
      {byCost.map(({ cost, units }) => (
        <section key={cost} id={`cost-${cost}`} className="mb-8 scroll-mt-16">
          <h2 className={`mb-2 text-base font-semibold ${COST_TEXT[cost]}`}>{cost}코스트 <span className="num text-muted">{units.length}</span></h2>
          <div className="panel divide-y divide-line rounded-xl bg-surface">
            {units.map((u) => {
              const use = unitUsage(u.id, decks);
              return (
                <article key={u.id} id={u.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                  <UnitIcon id={u.id} size="md" />
                  <div className="min-w-32">
                    <h3 className="text-sm font-semibold">{u.name}</h3>
                    <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] text-muted">
                      {u.traits.map((t) => (
                        <span key={t} className="flex items-center gap-0.5">
                          {traitByName(t)?.img && <img src={traitByName(t)!.img} alt="" className="size-3 opacity-70 brightness-0 invert" />}{t}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {use.items.slice(0, 3).map((iid) => <ItemIcon key={iid} id={iid} />)}
                    {use.items.length === 0 && <span className="text-[10px] text-muted/60">메타 덱 아이템 없음</span>}
                  </div>
                  <div className="ml-auto flex flex-wrap justify-end gap-1 text-[11px]">
                    {use.decks.slice(0, 3).map((d) => (
                      <Link key={d.id} href={`/deck/${d.id}`} className="flex items-center gap-1 rounded-md border border-line px-1.5 py-0.5 text-muted transition-colors duration-150 hover:border-accent/60 hover:text-text">
                        <TierBadge tier={d.tierLabel} />{d.name}{d.carryId === u.id && <span className="text-accent">★</span>}
                      </Link>
                    ))}
                    {use.decks.length > 3 && <span className="self-center text-muted/60">+{use.decks.length - 3}</span>}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </main>
  );
}
