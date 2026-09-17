import { unitById, type Deck } from "@/lib/data";
import { placeUnits } from "@/lib/board";
import { ItemIcon, UnitIcon } from "@/app/icons";

type Props = {
  deck: Deck;
  carryId: string;
  ownedIds: Set<string>;
  onToggle?: (unitId: string) => void; // 있으면 클릭으로 보유 토글
};

// 4행 × 7열 육각 배치도. row 0 = 최전방(위). 홀수 행은 반 칸 오른쪽 (인게임과 동일).
export function Board({ deck, carryId, ownedIds, onToggle }: Props) {
  const byPos = new Map(placeUnits(deck).map((u) => [u.pos.join(","), u]));
  const itemsByUnit = new Map<string, string[]>();
  for (const ci of deck.coreItems) itemsByUnit.set(ci.unitId, [...(itemsByUnit.get(ci.unitId) ?? []), ci.itemId]);

  return (
    <div className="mx-auto flex w-max flex-col gap-0.5">
      {[0, 1, 2, 3].map((row) => (
        <div key={row} className={`flex gap-0.5 ${row % 2 ? "ml-[21px]" : ""}`}>
          {[0, 1, 2, 3, 4, 5, 6].map((col) => {
            const u = byPos.get(`${row},${col}`);
            if (!u) return <span key={col} className="hex mb-3 h-12 shrink-0 bg-surface-2" />;
            const owned = ownedIds.has(u.unitId);
            const isCarry = u.unitId === carryId;
            const items = itemsByUnit.get(u.unitId) ?? [];
            const cell = (
              <div className={`relative flex w-[42px] flex-col items-center ${owned ? "" : "opacity-50"}`}>
                <UnitIcon id={u.unitId} className={`h-12! ${isCarry ? "bg-accent!" : ""}`} />
                <span className="absolute top-8 text-[10px] leading-none text-warn drop-shadow-[0_0_2px_#000]">
                  {"★".repeat(u.star)}
                </span>
                {items.length > 0 && (
                  <span className="absolute -right-1.5 top-0 flex flex-col gap-px">
                    {items.slice(0, 3).map((iid, i) => (
                      <ItemIcon key={i} id={iid} className="size-4! rounded-sm border-0" />
                    ))}
                  </span>
                )}
                <span className="mt-px w-[46px] truncate text-center text-[9px] leading-3 text-text">
                  {unitById(u.unitId)?.name}
                </span>
              </div>
            );
            return onToggle ? (
              <button key={col} type="button" onClick={() => onToggle(u.unitId)} className="shrink-0 hover:opacity-100" aria-pressed={owned}>{cell}</button>
            ) : (
              <div key={col} className="shrink-0">{cell}</div>
            );
          })}
        </div>
      ))}
      <div className="mt-1 flex justify-between text-[10px] text-muted/70">
        <span>↑ 최전방</span>
        <span className="opacity-60">흐림 = 미보유{onToggle && " · 클릭하면 보유 토글"} · 인디고 = 캐리</span>
      </div>
    </div>
  );
}
