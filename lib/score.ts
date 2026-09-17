// UI 점수 레이어: 엔진(lib/engine/score.ts) 을 UI Deck 타입으로 감싼다. 점수 로직은 엔진에만 있음.
import { itemById, type ComponentId, type Deck, type UnitId } from "./data";
import { recommend as engineRecommend, scoreDeck as engineScore, STAGES as ENGINE_STAGES, stageLevel as engineStageLevel, type RecommendOptions } from "./engine/score";
import { jsonCtx, toEngineDeck } from "./engine/adapt";

export type UserUnit = { unitId: UnitId; star: 1 | 2 | 3 };
// completed = 완성 아이템(분해 불가), rivals = 로비 스카우팅 상대 유닛, stage = 현재 스테이지
export type UserInput = { components: ComponentId[]; completed: string[]; units: UserUnit[]; rivals?: UnitId[]; stage?: string };

export const STAGES = ENGINE_STAGES;
export const stageLevel = (stage: string) => engineStageLevel(stage) ?? 4;

export type Reason = { kind: "good" | "warn" | "info"; text: string };
export type ScoreBreakdown = {
  earlyScore: number;       // 0~40  조합 일치 (유닛 32 + 특성 단계 8)
  itemScore: number;        // 0~25  아이템 방향
  carryScore: number;       // 0~15  캐리 보유 보너스
  metaScore: number;        // 0~20  메타
  total: number;            // 0~100
  reasons: Reason[];
  carryId: UnitId;
  carryItems: string[];     // 캐리 1순위 아이템 id
  buildableCarryItems: string[];
  hasCarry: boolean;
  matchedSupports: UnitId[];      // 덱 조합(초반~최종)에 들어가는 보유 유닛
  missingUnits: UnitId[];         // 최종 조합 중 미보유
};

export const getCarry = (deck: Deck): UnitId => deck.carryId ?? deck.coreUnits[0]?.unitId ?? "";

export function scoreDeck(input: UserInput, deck: Deck): ScoreBreakdown {
  const ed = toEngineDeck(deck);
  const s = engineScore(input, ed, jsonCtx);
  return {
    earlyScore: s.earlyScore, itemScore: s.itemScore, carryScore: s.carryScore, metaScore: s.metaScore, total: s.total,
    reasons: s.reasons, carryId: ed.carryUnitId,
    carryItems: deck.coreItems.filter((ci) => ci.unitId === ed.carryUnitId).map((ci) => ci.itemId),
    buildableCarryItems: s.buildableCarryItems, hasCarry: s.hasCarry, matchedSupports: s.matchedUnits,
    missingUnits: deck.coreUnits.map((u) => u.unitId).filter((id) => !input.units.some((x) => x.unitId === id)),
  };
}

/** 추천 (코어 게이트 기본 stage: 초반엔 게이트 없음 → 6~7렙 any → 8렙~ all) */
export function recommend(input: UserInput, decks: Deck[], opts: RecommendOptions = {}): Array<{ deck: Deck; score: ScoreBreakdown; confidence: number }> {
  const byId = new Map(decks.map((d) => [d.id, d]));
  return engineRecommend(input, decks.map(toEngineDeck), jsonCtx, { coreGate: "stage", ...opts })
    .map((r) => ({ deck: byId.get(r.deck.id)!, score: scoreDeck(input, byId.get(r.deck.id)!), confidence: r.confidence }));
}

const countBy = <T extends string>(xs: T[]): Record<T, number> => {
  const out = {} as Record<T, number>;
  for (const x of xs) out[x] = (out[x] ?? 0) + 1;
  return out;
};

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

/** 다음 행동: 캐리템 완성에 더 필요한 재료, 이 덱 어디에도 안 쓰이는(팔아도 되는) 보유 유닛 */
export function nextActions(deck: Deck, input: UserInput): { needComponents: ComponentId[]; sellUnits: UnitId[] } {
  const carryId = getCarry(deck);
  const need = countBy(
    deck.coreItems.filter((ci) => ci.unitId === carryId).flatMap((ci) => itemById(ci.itemId)?.recipe ?? []),
  ) as Record<string, number>;
  const done = countBy(input.completed);
  for (const ci of deck.coreItems) {
    if (ci.unitId !== carryId || !(done[ci.itemId] > 0)) continue;
    done[ci.itemId] -= 1;
    for (const c of itemById(ci.itemId)?.recipe ?? []) need[c] = (need[c] ?? 0) - 1;
  }
  for (const c of input.components) if ((need[c] ?? 0) > 0) need[c] -= 1;
  const needComponents = (Object.entries(need) as [ComponentId, number][])
    .flatMap(([c, n]) => Array<ComponentId>(Math.max(0, n)).fill(c));

  const used = new Set([...deck.coreUnits.map((u) => u.unitId), ...Object.values(deck.levels ?? {}).flatMap((l) => l.units)]);
  const sellUnits = input.units.map((u) => u.unitId).filter((id) => !used.has(id));
  return { needComponents, sellUnits };
}

/** 1-1 회전목마 재료 우선순위: 덱 픽률 × 캐리템 레시피 등장 횟수 (S/A 덱 기준) */
export function carouselPriority(all: Deck[]): Array<{ component: ComponentId; score: number; decks: Deck[] }> {
  const acc = new Map<ComponentId, { score: number; decks: Set<Deck> }>();
  for (const deck of all) {
    const carryId = getCarry(deck);
    const w = (deck.pickRate ?? 0.01) * (deck.tier <= 2 ? 1.3 : 1);
    for (const ci of deck.coreItems) {
      if (ci.unitId !== carryId) continue;
      for (const c of itemById(ci.itemId)?.recipe ?? []) {
        const e = acc.get(c) ?? { score: 0, decks: new Set<Deck>() };
        e.score += w; e.decks.add(deck); acc.set(c, e);
      }
    }
  }
  const max = Math.max(...[...acc.values()].map((e) => e.score), 1e-9);
  return [...acc]
    .map(([component, e]) => ({ component, score: e.score / max, decks: [...e.decks].sort((a, b) => a.avgPlacement - b.avgPlacement) }))
    .sort((a, b) => b.score - a.score);
}

/** 상대 보드 유닛으로 상대가 가는 덱 추정: 핵심 유닛 2개 이상 겹치는 덱, 겹침 많은 순 상위 2 */
export function inferDecks(unitIds: UnitId[], all: Deck[]): Deck[] {
  const set = new Set(unitIds);
  return all
    .map((d) => ({ d, hit: d.coreUnits.filter((u) => set.has(u.unitId)).length }))
    .filter((x) => x.hit >= 2)
    .sort((a, b) => b.hit - a.hit || a.d.avgPlacement - b.d.avgPlacement)
    .slice(0, 2)
    .map((x) => x.d);
}
