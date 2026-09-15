import type { Deck } from "@/lib/data";
import { placeUnits } from "@/lib/board";
import { ItemIcon, UnitIcon } from "@/app/icons";

type Props = {
  deck: Deck;
  carryId: string;
  ownedIds: Set<string>;
};

// 4행 × 7열 육각 배치도. row 0 = 최전방(위). 홀수 행은 반 칸 오른쪽 (인게임과 동일).
export function Board({ deck, carryId, ownedIds }: Props) {
  const byPos = new Map(placeUnits(deck).map((u) => [u.pos.join(","), u]));
  const itemsByUnit = new Map<string, string[]>();
  for (const ci of deck.coreItems) itemsByUnit.set(ci.unitId, [...(itemsByUnit.get(ci.unitId) ?? []), ci.itemId]);

  return (
    <div className="mx-auto flex w-max flex-col gap-1">
      {[0, 1, 2, 3].map((row) => (
        <div key={row} className={`flex gap-0.5 ${row % 2 ? "ml-[22px]" : ""}`}>
          {[0, 1, 2, 3, 4, 5, 6].map((col) => {
            const u = byPos.get(`${row},${col}`);
            if (!u) return <span key={col} className="hex size-11 shrink-0 bg-gold/15" />;
            const owned = ownedIds.has(u.unitId);
            const isCarry = u.unitId === carryId;
            const items = itemsByUnit.get(u.unitId) ?? [];
            return (
              <div key={col} className="relative size-11 shrink-0">
                <UnitIcon id={u.unitId} className={`size-11! ${isCarry ? "bg-teal!" : ""} ${owned ? "" : "opacity-50"}`} />
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[10px] leading-none text-gold drop-shadow">
                  {"★".repeat(u.star)}
                </span>
                {items.length > 0 && (
                  <span className="absolute -right-1 top-0 flex flex-col gap-px">
                    {items.slice(0, 3).map((iid, i) => (
                      <ItemIcon key={i} id={iid} className="size-4! rounded-sm border-0" />
                    ))}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      ))}
      <div className="mt-1 flex justify-between text-[10px] text-muted/70">
        <span>↑ 최전방</span>
        <span className="opacity-60">흐림 = 미보유 · 청록 테두리 = 캐리</span>
      </div>
    </div>
  );
}
