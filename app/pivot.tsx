import { unitById, type Deck } from "@/lib/data";
import { TierBadge, UnitIcon } from "@/app/icons";

const ALL_LEVELS = ["4", "5", "6", "7", "8", "9"];

/** 분기 트리: 추천 상위 덱들이 레벨별로 어디까지 같은 유닛을 쓰고 어디서 갈라지는지 */
export function PivotTree({ decks, ownedIds }: { decks: Deck[]; ownedIds: Set<string> }) {
  const rows = decks.filter((d) => d.levels).slice(0, 3);
  if (rows.length < 2) return null;
  // 데이터가 하나도 없는 레벨 열은 숨김 (자체 수집 데이터는 7렙 이상만 있음)
  const LEVELS = ALL_LEVELS.filter((lv) => rows.some((d) => d.levels?.[lv]?.units?.length));
  if (LEVELS.length === 0) return null;

  const sets = LEVELS.map((lv) => rows.map((d) => new Set(d.levels?.[lv]?.units ?? [])));
  const shared = sets.map((s) => [...s[0]].filter((u) => s.every((x) => x.has(u))));
  // 분기 시점: 공통 유닛이 각 덱 조합의 절반 미만이 되는 첫 레벨
  const splitIdx = sets.findIndex((s, i) => s.every((x) => x.size > 0) && shared[i].length / Math.max(...s.map((x) => x.size)) < 0.5);
  const splitLv = splitIdx >= 0 ? LEVELS[splitIdx] : null;

  return (
    <section className="panel mb-8 rounded-lg bg-surface p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">분기 트리</h2>
        <p className="text-xs text-muted">
          {splitLv
            ? <>공통 초반 → <span className="num text-accent">{splitLv}렙</span>에서 갈림. 그 전까진 결정 안 해도 됨</>
            : "상위 덱들이 초반부터 다른 라인"}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-max min-w-full border-separate border-spacing-0 text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-surface pr-3 text-left font-medium text-muted">덱</th>
              {LEVELS.map((lv, i) => (
                <th key={lv} className={`num px-2 pb-1 text-left text-[11px] ${lv === splitLv ? "text-accent" : "text-muted"}`}>
                  {lv}렙{lv === splitLv && " ▼"}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((d, r) => (
              <tr key={d.id} className="border-t border-line">
                <td className="sticky left-0 z-10 max-w-40 truncate bg-surface py-1.5 pr-3 align-top">
                  <TierBadge tier={d.tierLabel} /> <span className="font-medium">{d.name}</span>
                </td>
                {LEVELS.map((lv, i) => {
                  const units = d.levels?.[lv]?.units ?? [];
                  const common = new Set(shared[i]);
                  return (
                    <td key={lv} className={`px-2 py-1.5 align-top ${lv === splitLv ? "bg-accent/5" : ""}`}>
                      <div className="flex gap-0.5">
                        {units.map((u) => (
                          <span key={u} className={`flex flex-col items-center ${ownedIds.has(u) ? "" : "opacity-40"}`}>
                            <UnitIcon id={u} size="sm" className="h-7!" />
                            <span className={`mt-0.5 h-0.5 w-4 rounded ${common.has(u) ? "bg-transparent" : "bg-accent"}`} />
                          </span>
                        ))}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[10px] text-muted/70">밑줄 인디고 = 그 덱에만 있는 유닛 · 흐림 = 미보유. 공통 유닛만 사두면 어느 쪽으로든 갈 수 있음.</p>
    </section>
  );
}
