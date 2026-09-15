import { itemById, unitById, componentById } from "@/lib/data";
import meta from "@/lib/gen/meta.json";

// 유닛/완성템 이미지는 lib/gen/*.json (scripts/sync.mjs). 재료 9종만 여기서 고정.
const COMPONENT_IMG: Record<string, string> = {
  bf: "bfsword", bow: "recurvebow", rod: "needlesslylargerod", tear: "tearofthegoddess", vest: "chainvest",
  cloak: "negatroncloak", belt: "giantsbelt", gloves: "sparringgloves", spatula: "spatula",
};
const componentImg = (id: string) =>
  `https://raw.communitydragon.org/${meta.patch}/game/assets/maps/tft/icons/items/hexcore/tft_item_${COMPONENT_IMG[id]}.png`;

// 코스트별 테두리/글자색 (인게임 색상 기준)
export const COST_BORDER: Record<number, string> = {
  1: "border-zinc-400",
  2: "border-emerald-500",
  3: "border-sky-500",
  4: "border-purple-500",
  5: "border-amber-400",
};
export const COST_TEXT: Record<number, string> = {
  1: "text-zinc-400",
  2: "text-emerald-400",
  3: "text-sky-400",
  4: "text-purple-400",
  5: "text-amber-400",
};

const SIZE = { sm: "size-8", md: "size-12", lg: "size-16" };

export function UnitIcon({ id, size = "md", className = "" }: { id: string; size?: keyof typeof SIZE; className?: string }) {
  const u = unitById(id);
  return (
    <img
      src={u?.img}
      alt={u?.name ?? id}
      title={u?.name}
      className={`${SIZE[size]} shrink-0 rounded border-2 object-cover ${COST_BORDER[u?.cost ?? 1]} ${className}`}
    />
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
      className={`${SIZE[size]} shrink-0 rounded border border-zinc-700 ${className}`}
    />
  );
}
