// 현재 정적 JSON(lib/data.ts) → 엔진 입력. DB 전환 전까지의 어댑터. DB 붙이면 decks_bundle 행을 같은 모양으로 매핑하면 됨.
import { ITEMS, TRAITS, UNITS, componentById, type Deck } from "@/lib/data";
import type { EngineCtx, EngineDeck, ItemRole } from "./score";

const unit = new Map(UNITS.map((u) => [u.id, u]));
const item = new Map(ITEMS.map((i) => [i.id, i]));
const traitByName = new Map(Object.values(TRAITS).map((t) => [t.name, t]));
const traitById = new Map(Object.entries(TRAITS));

export const jsonCtx: EngineCtx = {
  itemRecipe: (id) => item.get(id)?.recipe,
  unitCost: (id) => unit.get(id)?.cost ?? 1,
  unitTraits: (id) => (unit.get(id)?.traits ?? []).map((n) => traitByName.get(n)?.id ?? n),
  traitBreakpoints: (id) => traitById.get(id)?.breakpoints ?? [],
  unitName: (id) => unit.get(id)?.name ?? id,
  itemName: (id) => item.get(id)?.name ?? componentById(id as never)?.name ?? id,
  traitName: (id) => traitById.get(id)?.name ?? id,
};

/** 코어 유닛: 캐리 + "7렙 이후 조합에 가장 꾸준히 등장하는" 유닛 2개 (동률이면 저코 우선 = 일찍 확보하는 유닛).
 *  DB 전환 후엔 decks.core_unit_ids(큐레이션)로 대체. */
function coreUnitIds(d: Deck): string[] {
  const carry = d.carryId ?? d.coreUnits[0]?.unitId;
  const late = Object.entries(d.levels ?? {}).filter(([lv]) => Number(lv) >= 7).map(([, c]) => c.units);
  const freq = (u: string) => late.filter((us) => us.includes(u)).length;
  const rest = d.coreUnits.map((u) => u.unitId).filter((u) => u !== carry)
    .sort((a, b) => freq(b) - freq(a) || (unit.get(a)?.cost ?? 0) - (unit.get(b)?.cost ?? 0));
  return [carry, ...rest].filter(Boolean).slice(0, 3);
}

export function toEngineDeck(d: Deck): EngineDeck {
  const carry = d.carryId ?? d.coreUnits[0]?.unitId ?? "";
  const items: EngineDeck["items"] = [];
  for (const ci of d.coreItems) {
    const role: ItemRole = ci.unitId === carry ? "carry_core" : "tank";
    items.push({ unitId: ci.unitId, itemId: ci.itemId, role, priority: 1 });
  }
  for (const [uid, alts] of Object.entries(d.altItems ?? {}))
    alts.forEach((iid, i) => items.push({ unitId: uid, itemId: iid, role: uid === carry ? "carry_flex" : "tank", priority: i + 2 }));
  return {
    id: d.id, name: d.name, carryUnitId: carry, coreUnitIds: coreUnitIds(d),
    avgPlace: d.avgPlacement, tierLabel: d.tierLabel,
    units: d.coreUnits.map((u) => ({ unitId: u.unitId, star: u.star, core: true })),
    items, levels: d.levels, counters: d.counters,
  };
}
