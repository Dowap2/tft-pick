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
  OP: "bg-neg/90 text-white", S: "bg-accent text-white", A: "bg-accent-2/90 text-white", B: "bg-surface-2 text-text border border-line", C: "bg-surface-2 text-muted border border-line",
};

const SIZE = { sm: "size-8", md: "size-12", lg: "size-16" };
const HEX_H = { sm: "h-8", md: "h-12", lg: "h-16" };

// 육각형 초상화. 테두리는 바깥 span 배경(코스트색)이 p-0.5 만큼 보이는 방식. 크기는 높이(h-*)로만 지정.
// 강조하려면 className에 "bg-accent!" 처럼 !로 덮어쓰기 (ring은 clip-path에 잘림).
export function UnitIcon({ id, size = "md", className = "" }: { id: string; size?: keyof typeof SIZE; className?: string }) {
  const u = unitById(id);
  return (
    <span className={`hex inline-block shrink-0 p-0.5 ${HEX_H[size]} ${COST_BG[u?.cost ?? 1]} ${className}`}>
      <img src={u?.img} alt={u?.name ?? id} title={u?.name} className="hex h-full w-full object-cover" />
    </span>
  );
}

export function ItemIcon({ id, size = "sm", className = "" }: { id: string; size?: keyof typeof SIZE; className?: string }) {
  const it = itemById(id);
  const name = it?.name ?? componentById(id as never)?.name ?? id;
  const img = (
    <img
      src={it?.img ?? componentImg(id)}
      alt={name}
      title={it ? undefined : name}
      className={`${SIZE[size]} shrink-0 rounded border border-line ${className}`}
    />
  );
  if (!it) return img;
  // 완성템: hover 시 조합식 툴팁
  return (
    <span className="group relative inline-block shrink-0">
      {img}
      <span className="tip panel absolute bottom-full left-1/2 z-10 mb-1.5 flex items-center gap-1 whitespace-nowrap rounded bg-bg px-1.5 py-1 text-[11px] text-text">
        <img src={componentImg(it.recipe[0])} alt="" className="size-5 rounded-sm" />
        <span className="text-muted">+</span>
        <img src={componentImg(it.recipe[1])} alt="" className="size-5 rounded-sm" />
        <span className="ml-1">{name}</span>
      </span>
    </span>
  );
}

export function TierBadge({ tier, size = "sm" }: { tier: string; size?: "sm" | "lg" }) {
  const cls = size === "lg" ? "rounded-md px-2 py-0.5 text-sm" : "rounded px-1.5 py-px text-[10px]";
  return <span className={`num inline-block align-middle ${cls} ${TIER_COLOR[tier] ?? ""}`}>{tier}</span>;
}
