import {
  DECKS, itemById, unitById, componentById,
  type ComponentId, type Deck, type UnitId,
} from "./data";
const componentName = (c: ComponentId) => componentById(c)?.name ?? c;

export type UserUnit = { unitId: UnitId; star: 1 | 2 | 3 };
// completed = 이미 완성된 아이템(분해 불가) → 캐리템과 정확히 일치할 때만 인정
export type UserInput = { components: ComponentId[]; completed: string[]; units: UserUnit[] };

export type Reason = { kind: "good" | "warn" | "info"; text: string };
export type ScoreBreakdown = {
  earlyScore: number;       // 0~40  초반(4~7렙) 조합 일치 — 핵심 축
  itemScore: number;        // 0~25  아이템 방향 (재료 단위로 캐리템 레시피와 겹치는 정도)
  carryScore: number;       // 0~15  캐리 보유 보너스 (없어도 감점 없음)
  metaScore: number;        // 0~20  메타 (평균 순위)
  total: number;            // 0~100
  reasons: Reason[];
  carryId: UnitId;
  carryItems: string[];     // 캐리가 사용할 아이템 id
  buildableCarryItems: string[];  // 보유 재료/완성템으로 지금 갖출 수 있는 캐리 아이템
  hasCarry: boolean;
  matchedSupports: UnitId[];      // 덱 조합(초반~최종)에 들어가는 보유 유닛
  missingUnits: UnitId[];
};

// ---- 헬퍼 ----
const countBy = <T extends string>(xs: T[]): Record<T, number> => {
  const out = {} as Record<T, number>;
  for (const x of xs) out[x] = (out[x] ?? 0) + 1;
  return out;
};

/** 덱의 캐리 유닛 = 아이템을 가장 많이 걸치는 유닛 (동률이면 고코스트) */
export function getCarry(deck: Deck): UnitId {
  if (deck.carryId) return deck.carryId;
  const itemsPerUnit = deck.coreItems.reduce((acc, ci) => {
    acc[ci.unitId] = (acc[ci.unitId] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const candidates = Object.entries(itemsPerUnit);
  if (candidates.length === 0) return deck.coreUnits[0]?.unitId ?? "";

  candidates.sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    const costA = unitById(a[0])?.cost ?? 0;
    const costB = unitById(b[0])?.cost ?? 0;
    return costB - costA;
  });
  return candidates[0][0];
}

/** 아이템 하나가 유저의 컴포넌트 풀에서 조합 가능한지 (있으면 소비) */
function tryBuildItem(itemId: string, pool: Record<ComponentId, number>): boolean {
  const it = itemById(itemId);
  if (!it) return false;
  const [a, b] = it.recipe;
  if (a === b) {
    if ((pool[a] ?? 0) >= 2) { pool[a] -= 2; return true; }
    return false;
  }
  if ((pool[a] ?? 0) >= 1 && (pool[b] ?? 0) >= 1) {
    pool[a] -= 1; pool[b] -= 1; return true;
  }
  return false;
}

/** 성 가중치. 3성은 9장 투자라 그 기물 중심으로 덱을 맞춰야 함 → 크게 */
const STAR_MULT: Record<number, number> = { 1: 1, 2: 1.5, 3: 3 };
/** 3성 기물 규칙: 덱이 그 기물을 쓰면 보너스, 안 쓰면 총점 반감 */
const THREE_STAR_BONUS = 12;
const THREE_STAR_UNUSED_MULT = 0.5;
const starName = (id: UnitId, star: number) => `${unitById(id)?.name ?? id}${star > 1 ? "★".repeat(star) : ""}`;
const names = (ids: UnitId[]) => ids.map((id) => unitById(id)?.name ?? id).join(", ");

// 이 서비스는 "초반에 어느 덱으로 갈지" 정하는 도구다. 2~3스테이지엔 1~2코 기물 몇 개와 재료 2~3개가 전부이므로
// (1) 초반 조합 일치를 가장 크게, (2) 아이템은 완성 여부가 아니라 재료 단위 방향성으로, (3) 고코 캐리 미보유는 감점하지 않는다.
export function scoreDeck(input: UserInput, deck: Deck): ScoreBreakdown {
  const reasons: Reason[] = [];
  const hasAnyInput = input.components.length > 0 || input.completed.length > 0 || input.units.length > 0;

  const carryId = getCarry(deck);
  const carry = unitById(carryId);
  const carryTarget = deck.coreUnits.find((u) => u.unitId === carryId);
  const carryItems = deck.coreItems.filter((ci) => ci.unitId === carryId).map((ci) => ci.itemId);
  const starOf = new Map(input.units.map((u) => [u.unitId, u.star]));

  // ---- 1) 초반 조합 일치 (0~40) ----
  // 4~7렙 각 레벨의 최빈 조합과 성 가중 일치율. 가장 잘 맞는 레벨 기준. 최종 조합도 후보에 포함(리롤 덱 등).
  const comps: Array<{ label: string; units: UnitId[] }> = Object.entries(deck.levels ?? {})
    .filter(([lv, c]) => Number(lv) <= 7 && c.units.length > 0)
    .map(([lv, c]) => ({ label: `${lv}렙`, units: c.units }));
  comps.push({ label: "최종", units: deck.coreUnits.map((u) => u.unitId) });
  let best = { label: "", ratio: 0, hit: [] as UnitId[], total: 1 };
  for (const c of comps) {
    const hit = c.units.filter((u) => starOf.has(u));
    const weighted = hit.reduce((s, u) => s + STAR_MULT[starOf.get(u)!], 0);
    const ratio = Math.min(weighted / c.units.length, 1.25);
    if (ratio > best.ratio) best = { label: c.label, ratio, hit, total: c.units.length };
  }
  const earlyScore = best.ratio * 40;
  const matchedSupports = [...new Set(comps.flatMap((c) => c.units))].filter((u) => starOf.has(u));
  if (best.hit.length > 0) {
    const upgraded = best.hit.some((u) => starOf.get(u)! > 1) ? " · 업그레이드 반영" : "";
    reasons.push({ kind: "good", text: `${best.label} 조합 ${best.hit.length}/${best.total} 보유 (${best.hit.map((u) => starName(u, starOf.get(u)!)).join(", ")})${upgraded}` });
  }
  const wasted = input.units.filter((u) => !matchedSupports.includes(u.unitId));
  if (wasted.length > 0 && matchedSupports.length > 0) {
    reasons.push({ kind: "info", text: `이 덱에 안 쓰이는 보유 유닛: ${names(wasted.map((u) => u.unitId))}` });
  }

  // ---- 2) 아이템 방향 (0~25) ----
  // 캐리템 레시피의 재료 멀티셋 vs 내 재료. 완성템은 정확히 일치할 때만 재료 2개로 인정(분해 불가).
  const need = countBy(carryItems.flatMap((iid) => itemById(iid)?.recipe ?? [])) as Record<string, number>;
  const needTotal = Object.values(need).reduce((a, b) => a + b, 0);
  const donePool = countBy(input.completed);
  const buildable: string[] = [];
  const ownedDone: string[] = [];
  let matched = 0;
  for (const iid of carryItems) {
    if ((donePool[iid] ?? 0) > 0) {
      donePool[iid] -= 1; buildable.push(iid); ownedDone.push(iid); matched += 2;
      for (const c of itemById(iid)?.recipe ?? []) need[c] -= 1;
    }
  }
  const pool = { ...countBy(input.components) } as Record<ComponentId, number>;
  for (const c of input.components) if ((need[c] ?? 0) > 0) { need[c] -= 1; matched += 1; }
  for (const iid of carryItems) if (!ownedDone.includes(iid) && tryBuildItem(iid, pool)) buildable.push(iid);
  const itemScore = needTotal === 0 ? 0 : Math.min(matched / needTotal, 1) * 25;
  if (ownedDone.length > 0 && carry) reasons.push({ kind: "good", text: `${carry.name} 핵심템 이미 완성 (${ownedDone.map((id) => itemById(id)?.name).join(", ")})` });
  const craftable = buildable.filter((id) => !ownedDone.includes(id));
  if (craftable.length > 0 && carry) reasons.push({ kind: "good", text: `보유 재료로 ${carry.name} 핵심템 조합 가능 (${craftable.map((id) => itemById(id)?.name).join(", ")})` });
  else if (matched > 0 && carry) reasons.push({ kind: "good", text: `보유 재료 ${matched - ownedDone.length * 2}개가 ${carry.name} 핵심템 레시피에 쓰임` });
  const uselessComps = input.components.filter((c) => !carryItems.some((iid) => itemById(iid)?.recipe.includes(c)));
  if (uselessComps.length > 0 && matched > 0) reasons.push({ kind: "info", text: `캐리템에 안 쓰이는 재료: ${uselessComps.map((c) => componentName(c)).join(", ")}` });

  // ---- 3) 캐리 보유 보너스 (0~15) ----
  // 초반엔 4~5코 캐리가 없는 게 정상이라 없어도 감점 없음. 있으면(특히 저코 리롤 캐리) 보너스.
  const userCarry = input.units.find((u) => u.unitId === carryId);
  const hasCarry = !!userCarry;
  let carryScore = 0;
  if (userCarry && carry) {
    const targetStar = carryTarget?.star ?? 2;
    const starRatio = Math.min(STAR_MULT[userCarry.star] / STAR_MULT[targetStar], 2);
    carryScore = Math.min(15, 15 * (0.6 + 0.4 * starRatio));
    reasons.push({ kind: "good", text: `메인 캐리 ${starName(carryId, userCarry.star)} 보유${userCarry.star >= targetStar ? " (목표 성 달성)" : ` (목표 ${"★".repeat(targetStar)})`}` });
  }

  // ---- 4) 메타 (0~20) ----
  const metaBase = Math.max(0, Math.min(20, ((4.5 - deck.avgPlacement) / 2) * 20));
  const hasConnection = matchedSupports.length > 0 || matched > 0;
  const metaScore = hasAnyInput && !hasConnection ? metaBase * 0.3 : metaBase;
  reasons.push({ kind: deck.tier <= 2 ? "good" : "info", text: `${deck.tierLabel}티어 · 평균순위 ${deck.avgPlacement.toFixed(2)}` });

  // ---- 5) 3성 기물 규칙 ----
  let anchorBonus = 0;
  let anchorMult = 1;
  for (const t of input.units.filter((u) => u.star === 3)) {
    if (t.unitId === carryId) continue;
    if (deck.coreUnits.some((u) => u.unitId === t.unitId)) {
      anchorBonus += THREE_STAR_BONUS;
      reasons.push({ kind: "good", text: `3성 ${unitById(t.unitId)?.name} 활용하는 덱` });
    } else {
      anchorMult *= THREE_STAR_UNUSED_MULT;
      reasons.push({ kind: "warn", text: `3성 ${unitById(t.unitId)?.name}을(를) 쓰지 않는 덱 (총점 반감)` });
    }
  }

  const missingUnits = deck.coreUnits.map((u) => u.unitId).filter((id) => !starOf.has(id));
  if (!hasCarry && carry && carry.cost <= 3) reasons.push({ kind: "warn", text: `저코 캐리 ${carry.name} 확보 필요 (리롤 덱)` });

  const total = !hasAnyInput
    ? Math.max(0, Math.min(100, ((4.5 - deck.avgPlacement) / 2) * 100))
    : Math.min(100, (earlyScore + itemScore + carryScore + metaScore + anchorBonus) * anchorMult);

  return { earlyScore, itemScore, carryScore, metaScore, total, reasons, carryId, carryItems, buildableCarryItems: buildable, hasCarry, matchedSupports, missingUnits };
}

export function recommend(input: UserInput): Array<{ deck: Deck; score: ScoreBreakdown }> {
  return DECKS
    .map((deck) => ({ deck, score: scoreDeck(input, deck) }))
    .sort((a, b) => b.score.total - a.score.total);
}

/** 0~max → 별 5개 표시 */
export const toStars = (score: number, max: number) => {
  const r = Math.min(5, Math.round((score / max) * 5));
  return "★".repeat(r) + "☆".repeat(5 - r);
};

export const transitionLabel = (score: ScoreBreakdown) => {
  const reachability = score.earlyScore + score.itemScore + score.carryScore;
  if (reachability >= 40) return { emoji: "🟢", text: "진입 쉬움" };
  if (reachability >= 18) return { emoji: "🟡", text: "진입 보통" };
  return { emoji: "🔴", text: "진입 어려움" };
};

/** 보유 유닛과 가장 겹치는 레벨을 현재로 보고, 그 다음 레벨에서 사야 할 유닛 */
export function nextStep(deck: Deck, ownedIds: Set<UnitId>): { level: string; buy: UnitId[] } | null {
  if (!deck.levels) return null;
  const lvs = Object.keys(deck.levels).sort((a, b) => Number(a) - Number(b));
  let cur = -1, best = -1;
  lvs.forEach((lv, i) => {
    const hit = deck.levels![lv].units.filter((u) => ownedIds.has(u)).length;
    if (hit > best) { best = hit; cur = i; }
  });
  const next = lvs[Math.min(cur + 1, lvs.length - 1)];
  const buy = deck.levels[next].units.filter((u) => !ownedIds.has(u));
  return buy.length ? { level: next, buy } : null;
}
