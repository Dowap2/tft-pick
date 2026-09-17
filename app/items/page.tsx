import Link from "next/link";
import { COMPONENTS, ITEMS, unitById, type ComponentId } from "@/lib/data";
import { getDecks } from "@/lib/decks";

export const dynamic = "force-static";
import { ItemIcon, UnitIcon } from "@/app/icons";
import meta from "@/lib/gen/meta.json";

export const metadata = {
  title: "TFT 아이템 조합표 - 완성 아이템 레시피와 추천 챔피언",
  description: `롤토체스 Set ${meta.set} 아이템 조합표. 재료 2개 조합 결과와 메타 덱에서 그 아이템을 쓰는 챔피언을 확인하세요.`,
  alternates: { canonical: "/items" },
};

export default async function ItemsPage() {
  const DECKS = await getDecks();
  const comps = COMPONENTS.map((c) => c.id);
  const byRecipe = new Map(ITEMS.map((i) => [[...i.recipe].sort().join("+"), i]));
  const find = (a: ComponentId, b: ComponentId) => byRecipe.get([a, b].sort().join("+"));
  // 아이템별 사용 유닛(메타 덱 기준, 빈도순)
  const users = new Map<string, Map<string, number>>();
  for (const d of DECKS) for (const ci of d.coreItems) {
    const m = users.get(ci.itemId) ?? new Map(); m.set(ci.unitId, (m.get(ci.unitId) ?? 0) + 1); users.set(ci.itemId, m);
  }

  return (
    <main className="w-full max-w-3xl px-4 py-8 sm:py-10">
      <header className="mb-5">
        <h1 className="text-2xl font-bold sm:text-3xl">아이템 조합표</h1>
        <p className="mt-1 text-sm text-muted">재료 2개를 교차한 칸이 완성 아이템. 아이콘에 마우스를 올리면 이름이 뜹니다.</p>
      </header>

      <div className="overflow-x-auto">
        <table className="panel w-max border-separate border-spacing-0 rounded-xl bg-surface text-center">
          <thead>
            <tr>
              <th className="p-1.5" />
              {comps.map((c) => <th key={c} className="p-1.5"><ItemIcon id={c} className="mx-auto size-7!" /></th>)}
            </tr>
          </thead>
          <tbody>
            {comps.map((r) => (
              <tr key={r} className="border-t border-line">
                <th className="p-1.5"><ItemIcon id={r} className="size-7!" /></th>
                {comps.map((c) => {
                  const it = find(r, c);
                  return (
                    <td key={c} className="p-1.5">
                      {it ? <a href={`#${it.id}`}><ItemIcon id={it.id} className="mx-auto size-8!" /></a> : <span className="mx-auto block size-8 rounded bg-surface-2/40" />}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mb-2 mt-8 text-base font-semibold">완성 아이템 <span className="num text-muted">{ITEMS.length}</span></h2>
      <div className="panel divide-y divide-line rounded-xl bg-surface">
        {ITEMS.map((it) => {
          const u = [...(users.get(it.id) ?? [])].sort((a, b) => b[1] - a[1]).slice(0, 4);
          return (
            <article key={it.id} id={it.id} className="flex flex-wrap items-center gap-3 px-3 py-2 scroll-mt-16">
              <ItemIcon id={it.id} size="md" />
              <div className="min-w-36">
                <h3 className="text-sm font-semibold">{it.name}</h3>
                <div className="mt-0.5 flex items-center gap-1 text-[10px] text-muted">
                  <ItemIcon id={it.recipe[0]} className="size-4!" /> + <ItemIcon id={it.recipe[1]} className="size-4!" />
                </div>
              </div>
              <div className="ml-auto flex items-center gap-1.5">
                {u.map(([uid]) => (
                  <Link key={uid} href={`/champions#${uid}`} title={unitById(uid)?.name}><UnitIcon id={uid} size="sm" /></Link>
                ))}
                {u.length === 0 && <span className="text-[10px] text-muted/60">메타 덱 사용 없음</span>}
              </div>
            </article>
          );
        })}
      </div>
    </main>
  );
}
