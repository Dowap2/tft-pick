import type { Deck } from "@/lib/data";
import { unitById } from "@/lib/data";
import { UnitIcon } from "@/app/icons";

type Props = {
  deck: Deck;
  ownedIds?: Set<string>;                 // 있으면 미보유 흐림
  onToggle?: (unitId: string) => void;    // 있으면 클릭으로 보유 토글
};

// 레벨별(4~10) 최빈 조합 표. 덱 상세·덱 목록에서 공용.
export function LevelComps({ deck, ownedIds, onToggle }: Props) {
  if (!deck.levels) return null;
  return (
    <div className="panel divide-y divide-line rounded-lg bg-surface">
      {Object.entries(deck.levels).map(([lv, comp]) => (
        <div key={lv} className="flex items-center gap-3 px-3 py-2">
          <div className="w-10 shrink-0">
            <div className="text-sm font-bold text-text">{lv}렙</div>
            <div className="text-[10px] text-muted/70">{comp.avg.toFixed(2)}등</div>
          </div>
          <div className="flex flex-wrap gap-1">
            {comp.units.map((uid) => {
              const icon = <UnitIcon id={uid} size="sm" className={`h-10! sm:h-9! ${!ownedIds || ownedIds.has(uid) ? "" : "opacity-45"}`} />;
              return onToggle ? (
                <button key={uid} type="button" onClick={() => onToggle(uid)} title={unitById(uid)?.name} aria-pressed={ownedIds?.has(uid)}>{icon}</button>
              ) : (
                <span key={uid} title={unitById(uid)?.name}>{icon}</span>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
