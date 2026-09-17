// 추천 엔진 — 순수 함수. DB·Next·정적 JSON 어디에도 의존하지 않는다.
// 마스터 데이터(레시피·코스트·특성)는 ctx 로 주입. Edge/Node/브라우저 어디서나 실행 가능.
//
// 점수 = 조합 일치 40 (유닛 32 + 특성 단계 8) + 아이템 방향 25 + 캐리 보유 15 + 메타 20
//        → (+3성 보너스) × 3성 미활용 × 로비 경합
// 라운드(stage)는 레벨 창 폭·결과 수·수렴도(온도)로 반영: 초반엔 넓게, 후반엔 좁게.

export type Star = 1 | 2 | 3;
export type UserUnit = { unitId: string; star: Star };
export type RecommendInput = {
  patch?: string;
  stage?: string;                       // '2-1' … '7-1'
  components: string[];                 // 재료 id
  completed: string[];                  // 완성 아이템 id (분해 불가)
  units: UserUnit[];
  rivals?: string[];                    // 로비 스카우팅: 상대 보드 유닛
};

export type ItemRole = "carry_core" | "carry_flex" | "tank" | "utility";
export type EngineDeck = {
  id: string;
  name: string;
  carryUnitId: string;
  coreUnitIds: string[];                // 하드 게이트 대상 (3~4개)
  avgPlace: number;
  tierLabel?: string | null;
  units: { unitId: string; star: Star; core?: boolean }[];         // 최종 조합
  items: { unitId: string; itemId: string; role: ItemRole; priority: number }[];
  levels?: Record<string, { units: string[]; avg?: number | null; count?: number | null }>;
  counters?: { deckId: string; placeChange: number }[];
  requiresAugment?: string[] | null;
  requiresSpecialItem?: string[] | null;
  qualifierLabel?: string | null;
  requirementNote?: string | null;
};

export type EngineCtx = {
  itemRecipe: (itemId: string) => string[] | undefined;   // 완성템 → 재료 2개
  unitCost: (unitId: string) => number;
  unitTraits: (unitId: string) => string[];                // 유닛 → 특성 id 목록
  traitBreakpoints: (traitId: string) => number[];         // 특성 → 활성 인원 단계 (오름차순)
  unitName?: (unitId: string) => string;
  itemName?: (itemId: string) => string;
  traitName?: (traitId: string) => string;
};

export type RecommendOptions = {
  /** 코어 유닛 하드 게이트. all = 코어 전부 보유해야 후보 (지시서 기본), any = 하나라도, none = 게이트 없음,
   *  stage = 라운드에 따라 none(~5렙) → any(6~7렙) → all(8렙~). 초반엔 코어 유닛이 있을 리 없으므로 실서비스 권장값 */
  coreGate?: "all" | "any" | "none" | "stage";
  topN?: number;                                            // 없으면 stageProfile 의 값
};

export type Reason = { kind: "good" | "warn" | "info"; text: string };
export type ScoreBreakdown = {
  total: number;
  earlyScore: number;    // 0~40 (유닛 32 + 특성 8)
  traitScore: number;    // earlyScore 에 포함된 특성 부분 (0~8)
  itemScore: number;     // 0~25
  carryScore: number;    // 0~15
  metaScore: number;     // 0~20
  bestLabel: string;     // 가장 잘 맞은 조합 라벨 ('5렙' | '최종')
  hasCarry: boolean;
  buildableCarryItems: string[];
  matchedUnits: string[];
  missingCoreUnits: string[];
  reasons: Reason[];
};
export type Recommendation = {
  deck: EngineDeck;
  score: ScoreBreakdown;
  confidence: number;                                       // 1위 = 100, 라운드가 늦을수록 격차 확대
  qualifierLabel: string | null;
  requirementNote: string | null;
};

// ---------------------------------------------------------------------------
// 튜닝 값
// ---------------------------------------------------------------------------
export const STAR_MULT: Record<Star, number> = { 1: 1, 2: 1.5, 3: 3 };
const ROLE_W: Record<ItemRole, number> = { carry_core: 2, carry_flex: 1, tank: 0.5, utility: 0 };
const THREE_STAR_BONUS = 12;
const THREE_STAR_UNUSED_MULT = 0.5;
const EARLY_UNIT_MAX = 32, EARLY_TRAIT_MAX = 8, ITEM_MAX = 25, CARRY_MAX = 15, META_MAX = 20;

export const STAGES = ["2-1", "2-3", "2-5", "3-1", "3-3", "3-5", "4-1", "4-3", "4-5", "5-1"] as const;

/** 스테이지 → 그 시점의 일반적인 레벨 (5렙 2-5, 6렙 3-2, 7렙 3-6, 8렙 4-2, 9렙 6-1) */
export function stageLevel(stage?: string): number | null {
  if (!stage) return null;
  const [s, r] = stage.split("-").map(Number);
  if (!s || !r) return null;
  const t = s * 10 + r;
  return t < 25 ? 4 : t < 32 ? 5 : t < 36 ? 6 : t < 42 ? 7 : t < 61 ? 8 : 9;
}

/** 라운드별 창 폭·후보 수·수렴 정도 */
export function stageProfile(stage?: string) {
  const L = stageLevel(stage);
  if (L == null) return { L: null, window: [4, 7] as [number, number], includeFinal: true, finalW: 1, metaW: 1, temp: 1, topN: 3 };
  if (L <= 5)     return { L, window: [L - 1, L + 1] as [number, number], includeFinal: false, finalW: 1,   metaW: 1.2, temp: 1.0, topN: 5 };
  if (L <= 7)     return { L, window: [L, L + 1] as [number, number],     includeFinal: true,  finalW: 1,   metaW: 1.0, temp: 0.8, topN: 3 };
  return                 { L, window: [L, L] as [number, number],         includeFinal: true,  finalW: 1.3, metaW: 0.9, temp: 0.6, topN: 2 };
}

/** 스타 목표 규칙: 1~3코 메인 캐리 = 3, 4~5코 = 2 (실제 3성이어도 2성 취급), 그 외 = 2 */
export function targetStar(deck: EngineDeck, unitId: string, ctx: EngineCtx): Star {
  const cost = ctx.unitCost(unitId);
  if (cost >= 4) return 2;
  if (unitId === deck.carryUnitId) return 3;
  return deck.units.find((u) => u.unitId === unitId)?.star ?? 2;
}
/** 4~5코는 3성이어도 2성으로 캡 */
export function effectiveStar(unitId: string, star: Star, ctx: EngineCtx): Star {
  return ctx.unitCost(unitId) >= 4 ? (Math.min(star, 2) as Star) : star;
}

/** 유닛 목록 → 특성별 활성 단계 (0 = 미활성 제외) */
export function traitLevels(unitIds: string[], ctx: EngineCtx): Map<string, number> {
  const count = new Map<string, number>();
  for (const id of new Set(unitIds)) for (const t of ctx.unitTraits(id)) count.set(t, (count.get(t) ?? 0) + 1);
  const out = new Map<string, number>();
  for (const [t, n] of count) {
    const lv = ctx.traitBreakpoints(t).filter((b) => n >= b).length;
    if (lv > 0) out.set(t, lv);
  }
  return out;
}

const countBy = (xs: string[]) => { const m: Record<string, number> = {}; for (const x of xs) m[x] = (m[x] ?? 0) + 1; return m; };
const nm = (ctx: EngineCtx, id: string) => ctx.unitName?.(id) ?? id;
const im = (ctx: EngineCtx, id: string) => ctx.itemName?.(id) ?? id;
const starName = (ctx: EngineCtx, id: string, star: number) => `${nm(ctx, id)}${star > 1 ? "★".repeat(star) : ""}`;

/** 재료 풀에서 완성템 하나 조합 가능하면 소비하고 true */
function tryBuild(itemId: string, pool: Record<string, number>, ctx: EngineCtx): boolean {
  const r = ctx.itemRecipe(itemId);
  if (!r || r.length !== 2) return false;
  const [a, b] = r;
  if (a === b) { if ((pool[a] ?? 0) >= 2) { pool[a] -= 2; return true; } return false; }
  if ((pool[a] ?? 0) >= 1 && (pool[b] ?? 0) >= 1) { pool[a] -= 1; pool[b] -= 1; return true; }
  return false;
}

// ---------------------------------------------------------------------------
// 코어 게이트
// ---------------------------------------------------------------------------
export function passesCoreGate(input: RecommendInput, deck: EngineDeck, mode: RecommendOptions["coreGate"] = "all"): boolean {
  if (mode === "stage") { const L = stageLevel(input.stage); mode = L == null || L <= 5 ? "none" : L <= 7 ? "any" : "all"; }
  if (mode === "none" || deck.coreUnitIds.length === 0) return true;
  const owned = new Set(input.units.map((u) => u.unitId));
  const hits = deck.coreUnitIds.filter((id) => owned.has(id)).length;
  return mode === "all" ? hits === deck.coreUnitIds.length : hits > 0;
}

// ---------------------------------------------------------------------------
// 덱 1개 점수
// ---------------------------------------------------------------------------
export function scoreDeck(input: RecommendInput, deck: EngineDeck, ctx: EngineCtx, rivalDecks: EngineDeck[] = []): ScoreBreakdown {
  const p = stageProfile(input.stage);
  const reasons: Reason[] = [];
  const hasAnyInput = input.components.length + input.completed.length + input.units.length > 0;
  const starOf = new Map(input.units.map((u) => [u.unitId, effectiveStar(u.unitId, u.star, ctx)]));
  const carryId = deck.carryUnitId;

  // ---- 1) 조합 일치 (0~40) — 레벨 창 안의 최빈 조합 + (조건부) 최종 조합 중 최고 ----
  const comps: { label: string; units: string[]; w: number }[] = [];
  for (const [lv, c] of Object.entries(deck.levels ?? {})) {
    const n = Number(lv);
    if (c.units.length && n >= p.window[0] && n <= p.window[1]) comps.push({ label: `${lv}렙`, units: c.units, w: 1 });
  }
  if (p.includeFinal) comps.push({ label: "최종", units: deck.units.map((u) => u.unitId), w: p.finalW });
  if (comps.length === 0) {
    // 창 안에 레벨 데이터가 없으면(예: 수집 데이터가 7렙 이상뿐) 가장 낮은 레벨 조합으로 대체
    const lowest = Object.entries(deck.levels ?? {}).filter(([, c]) => c.units.length).sort((a, b) => Number(a[0]) - Number(b[0]))[0];
    comps.push(lowest ? { label: `${lowest[0]}렙`, units: lowest[1].units, w: 1 } : { label: "최종", units: deck.units.map((u) => u.unitId), w: 1 });
  }
  let best = { label: "", ratio: 0, hit: [] as string[], total: 1, units: [] as string[] };
  for (const c of comps) {
    const hit = c.units.filter((u) => starOf.has(u));
    const weighted = hit.reduce((s, u) => s + STAR_MULT[starOf.get(u)!], 0);
    const ratio = Math.min(weighted / c.units.length, 1.25) * c.w;
    if (ratio > best.ratio) best = { label: c.label, ratio, hit, total: c.units.length, units: c.units };
  }
  const unitPart = Math.min(best.ratio, 1.25) * EARLY_UNIT_MAX;

  // 특성: 단순 특성명이 아니라 "활성 단계"까지. 덱 조합의 활성 특성 각각에 대해 내 단계/덱 단계 비율 평균.
  let traitScore = 0;
  if (best.units.length) {
    const deckT = traitLevels(best.units, ctx);
    const mine = traitLevels(input.units.map((u) => u.unitId), ctx);
    if (deckT.size) {
      let sum = 0;
      for (const [t, lv] of deckT) sum += Math.min(mine.get(t) ?? 0, lv) / lv;
      traitScore = (sum / deckT.size) * EARLY_TRAIT_MAX;
      const matchedT = [...deckT].filter(([t, lv]) => (mine.get(t) ?? 0) >= lv).map(([t]) => ctx.traitName?.(t) ?? t);
      if (matchedT.length) reasons.push({ kind: "good", text: `시너지 단계 일치: ${matchedT.join(", ")}` });
    }
  }
  const earlyScore = unitPart + traitScore;
  const matchedUnits = [...new Set(comps.flatMap((c) => c.units))].filter((u) => starOf.has(u));
  if (best.hit.length) {
    const up = best.hit.some((u) => starOf.get(u)! > 1) ? " · 업그레이드 반영" : "";
    reasons.push({ kind: "good", text: `${best.label} 조합 ${best.hit.length}/${best.total} 보유 (${best.hit.map((u) => starName(ctx, u, starOf.get(u)!)).join(", ")})${up}` });
  }
  const wasted = input.units.map((u) => u.unitId).filter((u) => !matchedUnits.includes(u));
  if (wasted.length && matchedUnits.length) reasons.push({ kind: "info", text: `이 덱에 안 쓰이는 보유 유닛: ${wasted.map((u) => nm(ctx, u)).join(", ")}` });

  // ---- 2) 아이템 방향 (0~25) — 캐리 1순위 빌드의 재료 멀티셋, 역할 가중. 완성템은 정확 일치만 ----
  const carryItems = deck.items.filter((i) => i.unitId === carryId && i.priority === 1);
  const need: Record<string, number> = {};
  let needTotal = 0;
  for (const it of carryItems) for (const c of ctx.itemRecipe(it.itemId) ?? []) { need[c] = (need[c] ?? 0) + ROLE_W[it.role]; needTotal += ROLE_W[it.role]; }
  const donePool = countBy(input.completed);
  const ownedDone: string[] = [];
  const buildable: string[] = [];
  let matched = 0;
  for (const it of carryItems) {
    if ((donePool[it.itemId] ?? 0) > 0) {
      donePool[it.itemId] -= 1; ownedDone.push(it.itemId); buildable.push(it.itemId);
      matched += 2 * ROLE_W[it.role];
      for (const c of ctx.itemRecipe(it.itemId) ?? []) need[c] = (need[c] ?? 0) - ROLE_W[it.role];
    }
  }
  const pool = countBy(input.components);
  for (const c of input.components) if ((need[c] ?? 0) > 0) { need[c] -= 1; matched += 1; }
  for (const it of carryItems) if (!ownedDone.includes(it.itemId) && tryBuild(it.itemId, pool, ctx)) buildable.push(it.itemId);
  let itemScore = needTotal ? Math.min(matched / needTotal, 1) * ITEM_MAX : 0;
  if (p.L && p.L >= 7 && input.completed.length && ownedDone.length === 0) itemScore *= 0.9;   // 후반에 완성템이 하나도 안 맞으면 굳은 것
  if (ownedDone.length) reasons.push({ kind: "good", text: `${nm(ctx, carryId)} 핵심템 이미 완성 (${ownedDone.map((i) => im(ctx, i)).join(", ")})` });
  const craftable = buildable.filter((i) => !ownedDone.includes(i));
  if (craftable.length) reasons.push({ kind: "good", text: `보유 재료로 ${nm(ctx, carryId)} 핵심템 조합 가능 (${craftable.map((i) => im(ctx, i)).join(", ")})` });
  else if (matched > 0) reasons.push({ kind: "good", text: `보유 재료가 ${nm(ctx, carryId)} 핵심템 레시피에 쓰임` });

  // ---- 3) 캐리 보유 (0~15) — 없어도 감점 없음. 4~5코 캐리는 목표 2성 ----
  const userCarry = input.units.find((u) => u.unitId === carryId);
  const hasCarry = !!userCarry;
  let carryScore = 0;
  if (userCarry) {
    const target = targetStar(deck, carryId, ctx);
    const have = effectiveStar(carryId, userCarry.star, ctx);
    const ratio = Math.min(STAR_MULT[have] / STAR_MULT[target], 2);
    carryScore = Math.min(CARRY_MAX, CARRY_MAX * (0.6 + 0.4 * ratio));
    reasons.push({ kind: "good", text: `메인 캐리 ${starName(ctx, carryId, have)} 보유${have >= target ? " (목표 성 달성)" : ` (목표 ${"★".repeat(target)})`}` });
  } else if (p.L && p.L >= 8 && ctx.unitCost(carryId) >= 4) {
    carryScore = 0; // 이미 0이지만 의도 명시: 후반에 고코 캐리 미보유는 보너스 없음
  }

  // ---- 4) 메타 (0~20) — 초반일수록 통계 비중 ↑, 접점 없으면 0.3× ----
  const metaBase = Math.max(0, Math.min(META_MAX, ((4.5 - deck.avgPlace) / 2) * META_MAX)) * p.metaW;
  const hasConnection = matchedUnits.length > 0 || matched > 0;
  const metaScore = hasAnyInput && !hasConnection ? metaBase * 0.3 : metaBase;
  if (deck.tierLabel) reasons.push({ kind: ["OP", "S"].includes(deck.tierLabel) ? "good" : "info", text: `${deck.tierLabel}티어 · 평균순위 ${deck.avgPlace.toFixed(2)}` });

  // ---- 5) 3성 규칙 — 3성 기물을 쓰는 덱 +12, 안 쓰면 총점 반감 (4~5코 3성은 2성 취급이라 제외) ----
  let bonus = 0, mult = 1;
  for (const u of input.units) {
    if (effectiveStar(u.unitId, u.star, ctx) !== 3 || u.unitId === carryId) continue;
    if (deck.units.some((d) => d.unitId === u.unitId)) { bonus += THREE_STAR_BONUS; reasons.push({ kind: "good", text: `3성 ${nm(ctx, u.unitId)} 활용하는 덱` }); }
    else { mult *= THREE_STAR_UNUSED_MULT; reasons.push({ kind: "warn", text: `3성 ${nm(ctx, u.unitId)}을(를) 쓰지 않는 덱 (총점 반감)` }); }
  }

  // ---- 6) 로비 경합 + 상성 ----
  const rivals = new Set(input.rivals ?? []);
  if (rivals.size) {
    const core = deck.units.filter((u) => u.core !== false).map((u) => u.unitId);
    const contested = core.filter((u) => rivals.has(u) && !starOf.has(u));
    if (contested.length) {
      mult *= 1 - Math.min(0.5, (contested.length / core.length) * 1.2);
      reasons.push({ kind: "warn", text: `경합: 상대가 ${contested.map((u) => nm(ctx, u)).join(", ")} 보유 (핵심 ${contested.length}/${core.length} 겹침)` });
    }
    for (const rd of rivalDecks) {
      if (rd.id === deck.id) continue;
      const c = deck.counters?.find((x) => x.deckId === rd.id);
      if (c && c.placeChange >= 0.1) { mult *= 1 - Math.min(0.3, c.placeChange * 0.6); reasons.push({ kind: "warn", text: `상성 불리: 상대 ${rd.name} 만나면 평균 +${c.placeChange.toFixed(2)}등` }); }
    }
  }

  const missingCoreUnits = deck.coreUnitIds.filter((id) => !starOf.has(id));
  if (!hasCarry && ctx.unitCost(carryId) <= 3) reasons.push({ kind: "warn", text: `저코 캐리 ${nm(ctx, carryId)} 확보 필요 (리롤 덱)` });
  if (deck.requirementNote) reasons.push({ kind: "info", text: deck.requirementNote });

  const total = !hasAnyInput
    ? Math.max(0, Math.min(100, ((4.5 - deck.avgPlace) / 2) * 100))
    : Math.min(100, (earlyScore + itemScore + carryScore + metaScore + bonus) * mult);

  return { total, earlyScore, traitScore, itemScore, carryScore, metaScore, bestLabel: best.label, hasCarry, buildableCarryItems: buildable, matchedUnits, missingCoreUnits, reasons };
}

/** 상대 보드 유닛으로 상대가 가는 덱 추정: 최종 조합 2개 이상 겹침, 상위 2 */
export function inferDecks(unitIds: string[], decks: EngineDeck[]): EngineDeck[] {
  const set = new Set(unitIds);
  return decks
    .map((d) => ({ d, hit: d.units.filter((u) => set.has(u.unitId)).length }))
    .filter((x) => x.hit >= 2)
    .sort((a, b) => b.hit - a.hit || a.d.avgPlace - b.d.avgPlace)
    .slice(0, 2)
    .map((x) => x.d);
}

// ---------------------------------------------------------------------------
// 추천
// ---------------------------------------------------------------------------
export function recommend(input: RecommendInput, decks: EngineDeck[], ctx: EngineCtx, opts: RecommendOptions = {}): Recommendation[] {
  const p = stageProfile(input.stage);
  const gate = opts.coreGate ?? "all";
  const rivalDecks = input.rivals?.length ? inferDecks(input.rivals, decks) : [];
  const scored = decks
    .filter((d) => passesCoreGate(input, d, gate))     // 하드 게이트: 점수 계산 자체를 스킵
    .map((deck) => ({ deck, score: scoreDeck(input, deck, ctx, rivalDecks) }))
    .sort((a, b) => b.score.total - a.score.total);
  const max = scored[0]?.score.total ?? 1;
  return scored.slice(0, opts.topN ?? p.topN).map((x) => ({
    ...x,
    confidence: Math.round(100 * Math.exp((x.score.total - max) / (25 * p.temp))),
    qualifierLabel: x.deck.qualifierLabel ?? null,
    requirementNote: x.deck.requirementNote ?? null,
  }));
}
