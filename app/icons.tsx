import { itemById, unitById, componentById } from "@/lib/data";
import meta from "@/lib/gen/meta.json";

// 유닛/완성템 이미지는 lib/gen/*.json (scripts/sync.mjs). 재료 9종만 여기서 고정.
const COMPONENT_IMG: Record<string, string> = {
  bf: "bfsword", bow: "recurvebow", rod: "needlesslylargerod", tear: "tearofthegoddess", vest: "chainvest",
  cloak: "negatroncloak", belt: "giantsbelt", gloves: "sparringgloves", spatula: "spatula", pan: "fryingpan",
};
const componentImg = (id: string) =>
  `https://raw.communitydragon.org/${meta.patch}/game/assets/maps/tft/icons/items/hexcore/tft_item_${COMPONENT_IMG[id]}.png`;

// 코스트별 색 (인게임 기준)
export const COST_BG: Record<number, string> = {
  1: "bg-cost-1", 2: "bg-cost-2", 3: "bg-cost-3", 4: "bg-cost-4", 5: "bg-cost-5",
};
export const COST_TEXT: Record<number, string> = {
  1: "text-cost-1", 2: "text-cost-2", 3: "text-cost-3", 4: "text-cost-4", 5: "text-cost-5",
};
export const TIER_COLOR: Record<string, string> = {
  OP: "bg-red-500 text-white", S: "bg-orange-400 text-navy", A: "bg-gold text-navy", B: "bg-teal text-navy", C: "bg-muted text-navy",
};

const SIZE = { sm: "size-8", md: "size-12", lg: "size-16" };

// 육각형 초상화. 테두리는 바깥 span 배경(코스트색)이 p-0.5 만큼 보이는 방식.
// 강조하려면 className에 "bg-teal!" 처럼 !로 덮어쓰기 (ring은 clip-path에 잘림).
export function UnitIcon({ id, size = "md", className = "" }: { id: string; size?: keyof typeof SIZE; className?: string }) {
  const u = unitById(id);
  return (
    <span className={`hex inline-block shrink-0 p-0.5 ${SIZE[size]} ${COST_BG[u?.cost ?? 1]} ${className}`}>
      <img src={u?.img} alt={u?.name ?? id} title={u?.name} className="hex size-full object-cover" />
    </span>
  );
}

export function ItemIcon({ id, size = "sm", className = "" }: { id: string; size?: keyof typeof SIZE; className?: string }) {
  const it = itemById(id);
  const name = it?.name ?? componentById(id as never)?.name ?? id;
  return (
    <img
      src={it?.img ?? componentImg(id)}
      alt={name}
      title={name}
      className={`${SIZE[size]} shrink-0 rounded border border-gold/40 ${className}`}
    />
  );
}

export function TierBadge({ tier }: { tier: string }) {
  return <span className={`rounded px-1.5 py-px text-[10px] font-bold ${TIER_COLOR[tier] ?? ""}`}>{tier}</span>;
}
