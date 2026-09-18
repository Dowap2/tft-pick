import { itemById, unitById, componentById, activeTraits, unitImg, itemImg, type Deck } from "@/lib/data";

// 유닛/완성템 이미지는 lib/gen/*.json (scripts/sync.mjs). 재료 9종만 여기서 고정.

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
// 테두리 색은 코스트 전용 — 캐리 강조는 테두리를 덮지 않고(인디고가 3코 파랑과 헷갈림) 위에 "C" 배지를 얹는다.
export function UnitIcon({ id, size = "md", className = "", carry = false }: { id: string; size?: keyof typeof SIZE; className?: string; carry?: boolean }) {
  const u = unitById(id);
  const hex = (
    <span className={`hex inline-block shrink-0 p-0.5 ${HEX_H[size]} ${COST_BG[u?.cost ?? 1]} ${carry ? "" : className}`}>
      <img src={unitImg(id)} alt={u?.name ?? id} title={u?.name} width={128} height={128} loading="lazy" decoding="async" className="hex h-full w-full object-cover" />
    </span>
  );
  if (!carry) return hex;
  return (
    <span className={`relative inline-block shrink-0 ${className}`} title={`${u?.name ?? id} · 캐리`}>
      {hex}
      <span className="num absolute -right-1 -top-1 rounded-sm bg-accent px-1 text-[9px] leading-3 text-white shadow">C</span>
    </span>
  );
}

export function ItemIcon({ id, size = "sm", className = "" }: { id: string; size?: keyof typeof SIZE; className?: string }) {
  const it = itemById(id);
  const name = it?.name ?? componentById(id as never)?.name ?? id;
  const img = (
    <img
      src={itemImg(id)}
      width={96}
      height={96}
      loading="lazy"
      decoding="async"
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
        <img src={itemImg(it.recipe[0])} alt="" className="size-5 rounded-sm" />
        <span className="text-muted">+</span>
        <img src={itemImg(it.recipe[1])} alt="" className="size-5 rounded-sm" />
        <span className="ml-1">{name}</span>
      </span>
    </span>
  );
}

export function TierBadge({ tier, size = "sm" }: { tier: string; size?: "sm" | "lg" }) {
  const cls = size === "lg" ? "rounded-md px-2 py-0.5 text-sm" : "rounded px-1.5 py-px text-[10px]";
  return <span className={`num inline-block align-middle ${cls} ${TIER_COLOR[tier] ?? ""}`}>{tier}</span>;
}

// 시너지 아이콘 줄: 단계별 색(동/은/금/프리즘 느낌을 절제해서)
const TRAIT_LEVEL = ["", "bg-[#7a5a3a]", "bg-[#6b7280]", "bg-[#b08a2e]", "bg-accent-2", "bg-accent"];
export function TraitRow({ unitIds, className = "" }: { unitIds: string[]; className?: string }) {
  const traits = activeTraits(unitIds);
  if (traits.length === 0) return null;
  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {traits.map((t) => (
        <span key={t.name} title={`${t.name} ${t.count}`} className={`flex items-center gap-1 rounded px-1 py-px text-[10px] text-white ${TRAIT_LEVEL[Math.min(t.level, 5)]}`}>
          {t.img && <img src={t.img} alt="" className="size-3.5 brightness-0 invert" />}
          <span className="num">{t.count}</span>
        </span>
      ))}
    </div>
  );
}

/** Fast 8 / Fast 9 / 리롤(lvl N) / 난이도 태그 */
export function DeckTags({ deck }: { deck: Deck }) {
  const lev = deck.levelling ?? "";
  const reroll = /^lvl/i.test(lev);
  const DIFF: Record<string, string> = { 쉬움: "text-pos border-pos/40", 보통: "text-muted border-line", 어려움: "text-warn border-warn/40" };
  return (
    <span className="inline-flex gap-1 align-middle">
      {lev && (
        <span className={`num rounded border px-1.5 py-px text-[10px] uppercase ${reroll ? "border-accent-2/50 text-accent-2" : "border-accent/50 text-accent"}`}>
          {reroll ? `${lev.replace(/lvl\s*/i, "")}렙 리롤` : lev}
        </span>
      )}
      {deck.difficulty && <span className={`rounded border px-1.5 py-px text-[10px] ${DIFF[deck.difficulty]}`}>{deck.difficulty}</span>}
    </span>
  );
}

/** 통계 4종 */
export function DeckStats({ deck, compact = false }: { deck: Deck; compact?: boolean }) {
  const pct = (v?: number) => (v == null ? "-" : `${(v * 100).toFixed(1)}%`);
  const cells: [string, string, string][] = [
    ["평균 등수", deck.avgPlacement.toFixed(2), "text-text"],
    ["Top4", pct(deck.top4Rate), "text-pos"],
    ["1등", pct(deck.winRate), "text-text"],
    ["픽률", pct(deck.pickRate), "text-muted"],
  ];
  return (
    <div className={`grid grid-cols-4 ${compact ? "gap-3" : "gap-4"}`}>
      {cells.map(([label, v, color]) => (
        <div key={label} className="text-right">
          <div className="text-[10px] uppercase tracking-wide text-muted">{label}</div>
          <div className={`num leading-none ${compact ? "text-base" : "text-xl"} ${color}`}>{v}</div>
        </div>
      ))}
    </div>
  );
}
