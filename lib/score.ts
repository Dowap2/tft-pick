import {
  DECKS, itemById, unitById,
  type ComponentId, type Deck, type UnitId,
} from "./data";

export type UserUnit = { unitId: UnitId; star: 1 | 2 | 3 };
export type UserInput = { components: ComponentId[]; units: UserUnit[] };

export type Reason = { kind: "good" | "warn" | "info"; text: string };
export type ScoreBreakdown = {
  carryScore: number;       // 0~35
  carryItemScore: number;   // 0~30
  supportScore: number;     // 0~15
  metaScore: number;        // 0~20 (접점 없으면 크게 감쇄)
  total: number;            // 0~100
  reasons: Reason[];
  carryId: UnitId;
  carryItems: string[];     // 캐리가 사용할 아이템 id
  buildableCarryItems: string[];  // 유저 재료로 조합 가능한 캐리 아이템
  hasCarry: boolean;
  matchedSupports: UnitId[];
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

/** 코스트별 캐리 소유 기본 점수 (희귀할수록 높음) */
const CARRY_COST_WEIGHT: Record<number, number> = { 1: 20, 2: 24, 3: 28, 4: 32, 5: 35 };

/** 코스트별 서포트 가중치 */
const SUPPORT_COST_WEIGHT: Record<number, number> = { 1: 1, 2: 2, 3: 3, 4: 5, 5: 7 };

/** 성 가중치. 2성 = 1성 3개 값어치지만 점수는 1.5배, 3성 2배로 완만하게 */
const STAR_MULT: Record<number, number> = { 1: 1, 2: 1.5, 3: 2 };
const starName = (id: UnitId, star: number) => `${unitById(id)?.name ?? id}${star > 1 ? "★".repeat(star) : ""}`;

export function scoreDeck(input: UserInput, deck: Deck): ScoreBreakdown {
  const reasons: Reason[] = [];
  const hasAnyInput = input.components.length > 0 || input.units.length > 0;

  const carryId = getCarry(deck);
  const carry = unitById(carryId);
  const carryTarget = deck.coreUnits.find((u) => u.unitId === carryId);
  const carryItems = deck.coreItems.filter((ci) => ci.unitId === carryId).map((ci) => ci.itemId);

  // ---- 1) 캐리 소유 점수 (0~35) ----
  const userCarry = input.units.find((u) => u.unitId === carryId);
  const hasCarry = !!userCarry;
  let carryScore = 0;
  if (userCarry && carry) {
    const base = CARRY_COST_WEIGHT[carry.cost] ?? 20;
    const targetStar = carryTarget?.star ?? 2;
    const starRatio = Math.min(STAR_MULT[userCarry.star] / STAR_MULT[targetStar], 1.5); // 목표 초과(3성 등)는 최대 1.5배
    carryScore = base * (0.5 + 0.5 * starRatio);
    if (userCarry.star > targetStar) {
      reasons.push({ kind: "good", text: `메인 캐리 ${carry.name} ${"★".repeat(userCarry.star)} 확보 (목표 ${"★".repeat(targetStar)} 초과!)` });
    } else if (starRatio >= 1) {
      reasons.push({ kind: "good", text: `메인 캐리 ${carry.name} ${"★".repeat(userCarry.star)} 확보 (목표 달성)` });
    } else {
      reasons.push({ kind: "good", text: `메인 캐리 ${carry.name} 보유 (목표 ${"★".repeat(targetStar)}, 현재 ${"★".repeat(userCarry.star)})` });
    }
  }

  // ---- 2) 캐리 아이템 적합도 (0~30) ----
  const pool = { ...countBy(input.components) } as Record<ComponentId, number>;
  const buildable: string[] = [];
  for (const iid of carryItems) {
    if (tryBuildItem(iid, pool)) buildable.push(iid);
  }
  const carryItemScore = carryItems.length === 0 ? 0 : (buildable.length / carryItems.length) * 30;

  if (buildable.length > 0 && carry) {
    const names = buildable.map((id) => itemById(id)?.name).filter(Boolean).join(", ");
    reasons.push({
      kind: "good",
      text: `보유 재료로 ${carry.name}의 핵심 아이템 ${buildable.length}/${carryItems.length}개 조합 가능 (${names})`,
    });
  }

  // ---- 3) 서포트 유닛 적합도 (0~15) ----
  const supportUnits = deck.coreUnits.filter((u) => u.unitId !== carryId);
  const totalSupportWeight = supportUnits.reduce((s, u) => {
    const c = unitById(u.unitId)?.cost ?? 1;
    return s + (SUPPORT_COST_WEIGHT[c] ?? 1);
  }, 0);
  const matchedSupports: UserUnit[] = [];
  let matchedWeight = 0;
  for (const uu of input.units) {
    if (uu.unitId === carryId) continue;
    const isSupport = supportUnits.find((u) => u.unitId === uu.unitId);
    if (!isSupport) continue;
    matchedSupports.push(uu);
    const c = unitById(uu.unitId)?.cost ?? 1;
    // 덱 목표 성 대비 내 성. 목표 2성인데 3성이면 1.33배, 1성이면 0.67배
    matchedWeight += (SUPPORT_COST_WEIGHT[c] ?? 1) * (STAR_MULT[uu.star] / STAR_MULT[isSupport.star]);
  }
  let supportScore = totalSupportWeight === 0 ? 0 : Math.min(matchedWeight / totalSupportWeight, 1.25) * 15;

  // 초반(4~7렙) 조합과의 일치율. 최종 조합엔 없는 초반 유닛(오른/자야 등)을 들고 있어도 인정.
  // 초반엔 2성 여부가 핵심이라 성 가중치(1/1.5/2)로 카운트. 1성 4개 = 4/4, 2성 4개 = 6/4 → 1.25 캡
  const starOf = new Map(input.units.map((u) => [u.unitId, u.star]));
  let earlyBest: { level: string; hit: number; weighted: number; total: number } | null = null;
  for (const [lv, comp] of Object.entries(deck.levels ?? {})) {
    if (Number(lv) > 7 || comp.units.length === 0) continue;
    const owned = comp.units.filter((u) => starOf.has(u));
    const weighted = owned.reduce((s, u) => s + STAR_MULT[starOf.get(u)!], 0);
    if (!earlyBest || weighted / comp.units.length > earlyBest.weighted / earlyBest.total)
      earlyBest = { level: lv, hit: owned.length, weighted, total: comp.units.length };
  }
  if (earlyBest && earlyBest.hit > 0) {
    supportScore = Math.max(supportScore, Math.min(earlyBest.weighted / earlyBest.total, 1.25) * 15);
    const upgraded = earlyBest.weighted > earlyBest.hit ? ", 업그레이드 반영" : "";
    reasons.push({ kind: "good", text: `${earlyBest.level}렙 조합 ${earlyBest.hit}/${earlyBest.total} 보유 (초반 진입 좋음${upgraded})` });
  }

  if (matchedSupports.length > 0) {
    const names = matchedSupports.map((u) => starName(u.unitId, u.star)).join(", ");
    reasons.push({
      kind: "good",
      text: `핵심 서포트 유닛 ${matchedSupports.length}개 보유 (${names})`,
    });
  }

  // ---- 4) 메타 tiebreak (0~20, 접점 없으면 대폭 감쇄) ----
  const metaBase = Math.max(0, Math.min(20, ((4.5 - deck.avgPlacement) / 2) * 20));
  const hasConnection = hasCarry || buildable.length > 0 || matchedSupports.length > 0 || (earlyBest?.hit ?? 0) > 0;
  const metaScore = hasAnyInput && !hasConnection ? metaBase * 0.15 : metaBase;

  // 티어/평균순위는 항상 표시
  reasons.push({
    kind: deck.tier <= 2 ? "good" : "info",
    text: `${deck.tierLabel}티어 · 평균순위 ${deck.avgPlacement.toFixed(2)}`,
  });

  // 부족한 핵심 유닛 안내
  const missingUnits = deck.coreUnits
    .map((u) => u.unitId)
    .filter((id) => !input.units.some((uu) => uu.unitId === id));
  const keyMissing = deck.coreUnits
    .filter((u) => u.unitId === carryId && !hasCarry)
    .map((u) => unitById(u.unitId)?.name)
    .filter(Boolean);
  if (keyMissing.length > 0) {
    reasons.push({ kind: "warn", text: `메인 캐리 ${keyMissing.join(", ")} 확보 필요` });
  }

  // ---- 입력 없음 → 순수 메타 랭킹 ----
  let total: number;
  if (!hasAnyInput) {
    total = ((4.5 - deck.avgPlacement) / 2) * 100;
    total = Math.max(0, Math.min(100, total));
  } else {
    total = Math.min(100, carryScore + carryItemScore + supportScore + metaScore);
  }

  return {
    carryScore,
    carryItemScore,
    supportScore,
    metaScore,
    total,
    reasons,
    carryId,
    carryItems,
    buildableCarryItems: buildable,
    hasCarry,
    matchedSupports: matchedSupports.map((u) => u.unitId),
    missingUnits,
  };
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
  const reachability = score.carryScore + score.carryItemScore + score.supportScore;
  if (reachability >= 45) return { emoji: "🟢", text: "전환 쉬움" };
  if (reachability >= 20) return { emoji: "🟡", text: "전환 보통" };
  return { emoji: "🔴", text: "전환 어려움" };
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
