// 엔진 회귀 테스트: npx tsx scripts/test-engine.ts
import { recommend, scoreDeck, type RecommendInput } from "../lib/engine/score";
import { jsonCtx, toEngineDeck } from "../lib/engine/adapt";
import { DECKS_JSON } from "../lib/decks-json";
const engineDecks = DECKS_JSON.map(toEngineDeck);

const nm = (id: string) => jsonCtx.unitName?.(id) ?? id;
const inm = (id: string) => jsonCtx.itemName?.(id) ?? id;
const at = (ids: string[], star: 1 | 2 | 3) => ids.map((unitId) => ({ unitId, star }));
const lvLine = (d: (typeof engineDecks)[number]) =>
  Object.entries(d.levels ?? {}).sort((a, b) => Number(a[0]) - Number(b[0]))[0]?.[1].units ?? d.units.map((u) => u.unitId);
const carryItems = (d: (typeof engineDecks)[number]) => d.items.filter((i) => i.unitId === d.carryUnitId && i.priority === 1);
const carryComps = (d: (typeof engineDecks)[number]) => carryItems(d).flatMap((i) => jsonCtx.itemRecipe(i.itemId) ?? []);

// 케이스는 현재 스냅샷에서 뽑는다 — 챔피언 이름을 박아두면 패치마다 전부 "후보 없음" 이 되고
// (실제로 coreGate="all" 9케이스가 그 상태로 후반 경로를 검증하지 못하고 있었다) 조용히 썩는다.
const T = engineDecks.find((d) => carryItems(d).length > 0 && d.coreUnitIds.length > 0 && lvLine(d).length >= 3 && Object.keys(d.levels ?? {}).some((l) => Number(l) <= 6)) ?? engineDecks[0];
const RIVAL = engineDecks.find((d) => d.id !== T.id) ?? T;
const early3 = lvLine(T).slice(0, 3);
const comps = carryComps(T);
const lowCost = T.units.map((u) => u.unitId).find((u) => u !== T.carryUnitId && jsonCtx.unitCost(u) <= 3);
const highCost = T.units.map((u) => u.unitId).find((u) => jsonCtx.unitCost(u) >= 4);

console.log(`대상 덱: ${T.name} (캐리 ${nm(T.carryUnitId)}, 코어 ${T.coreUnitIds.map(nm).join("/")}) · 로비 덱: ${RIVAL.name}`);

const cases: Array<{ name: string; input: RecommendInput }> = [
  { name: `2-1 ${early3.map(nm).join(" ")} 1★ + 재료 ${comps.slice(0, 2).map(inm).join("·")}`,
    input: { stage: "2-1", components: comps.slice(0, 2), completed: [], units: at(early3, 1) } },
  { name: `2-5 같은 보드 2★ 업그레이드`,
    input: { stage: "2-5", components: comps.slice(0, 2), completed: [], units: at(early3, 2) } },
  { name: `3-3 캐리 ${nm(T.carryUnitId)}2★ + 재료 1개`,
    input: { stage: "3-3", components: comps.slice(0, 1), completed: [], units: at([T.carryUnitId, ...early3.slice(0, 1)], 2) } },
  ...(lowCost ? [{ name: `3-3 저코 ${nm(lowCost)}3★ (3성 규칙)`,
    input: { stage: "3-3", components: [], completed: [], units: [{ unitId: lowCost, star: 3 as const }, ...at([T.carryUnitId], 2)] } }] : []),
  { name: `4-5 코어 전부 보유(${T.coreUnitIds.map(nm).join(" ")}) + ${inm(carryItems(T)[0].itemId)} 완성 → 게이트 all 통과해야 함`,
    input: { stage: "4-5", components: comps.slice(2, 3), completed: [carryItems(T)[0].itemId], units: at(T.coreUnitIds, 2) } },
  ...(highCost ? [{ name: `4-5 4코 이상 ${nm(highCost)}3★ (2★ 취급) + 코어 전부`,
    input: { stage: "4-5", components: [], completed: [], units: [{ unitId: highCost, star: 3 as const }, ...at(T.coreUnitIds.filter((u) => u !== highCost), 2)] } }] : []),
  { name: `스테이지 없음 + 로비에 ${RIVAL.name} (경합·상성)`,
    input: { components: comps.slice(0, 2), completed: [], units: at(early3, 2), rivals: RIVAL.units.map((u) => u.unitId) } },
  { name: `4-1 재료만 ${comps.slice(0, 2).map(inm).join("·")} · 유닛 0 (게이트 풀려야 함)`,
    input: { stage: "4-1", components: comps.slice(0, 2), completed: [], units: [] } },
  { name: "입력 없음 (메타 순)", input: { components: [], completed: [], units: [] } },
];

for (const gate of ["stage", "all"] as const) {
  console.log(`\n=========== coreGate = ${gate} ===========`);
  for (const c of cases) {
    const r = recommend(c.input, engineDecks, jsonCtx, { coreGate: gate });
    console.log(`\n▶ ${c.name}`);
    if (r.length === 0) { console.log("   (후보 없음 — 게이트에 걸림)"); continue; }
    for (const x of r) {
      const s = x.score;
      console.log(`   ${String(x.confidence).padStart(3)}%  ${s.total.toFixed(1).padStart(5)}  ${x.deck.name.padEnd(16)} 조합${s.earlyScore.toFixed(0).padStart(3)}(특성${s.traitScore.toFixed(0)}) 템${s.itemScore.toFixed(0).padStart(3)} 캐리${s.carryScore.toFixed(0).padStart(3)} 메타${s.metaScore.toFixed(0).padStart(3)}  [${s.bestLabel}]`);
    }
    const top = r[0].score.reasons.slice(0, 3).map((x) => `${x.kind === "good" ? "✓" : x.kind === "warn" ? "△" : "·"} ${x.text}`);
    for (const t of top) console.log(`        ${t}`);
  }
}

// ---------------------------------------------------------------------------
// 회귀 가드 — "초반 조건이 갖춰졌는데 적합도가 낮다" 를 고친 두 규칙을 고정한다.
// 실패하면 exit 1. 네트워크·DB 없이 돌아간다.
// ---------------------------------------------------------------------------
let failed = 0;
const ok = (cond: boolean, msg: string) => { if (!cond) { console.error(`✗ ${msg}`); failed++; } };

// 1) 분모는 "지금 낼 수 있는 유닛 수"(레벨) — 조합 크기로 나누지 않는다.
//    4~6렙 데이터가 없는 덱(라이브 DB 에 21개 중 6개)은 8렙 조합으로 대체되는데,
//    8 로 나누면 초반 보드가 구조적으로 반토막 난다.
{
  const eight = ["_u1", "_u2", "_u3", "_u4", "_u5", "_u6", "_u7", "_u8"];   // 마스터데이터에 없는 id = 코스트1·특성없음
  const lateOnly = {
    id: "_t", name: "_t", carryUnitId: "_u1", coreUnitIds: [], avgPlace: 4.5,
    units: eight.map((unitId) => ({ unitId, star: 2 as const })), items: [], levels: { "8": { units: eight } },
  };
  const s = scoreDeck({ stage: "2-1", components: [], completed: [], units: at(eight.slice(0, 3), 1) }, lateOnly, jsonCtx);
  ok(Math.abs(s.earlyScore - 24) < 0.01, `8렙 조합만 있는 덱 · 2-1(4렙) 3유닛 일치 → 조합 24 (3/4) 여야 하는데 ${s.earlyScore.toFixed(1)} (3/8 이면 12)`);

  // 반대 방향: 크기가 깨진 조합(유닛 1개짜리 '5렙')이 1/1 로 만점이 되면 안 된다.
  const tiny = { ...lateOnly, levels: { "5": { units: [eight[0]] } } };
  const t = scoreDeck({ stage: "2-1", components: [], completed: [], units: at([eight[0]], 1) }, tiny, jsonCtx);
  ok(Math.abs(t.earlyScore - 8) < 0.01, `유닛 1개짜리 조합 · 1유닛 일치 → 조합 8 (1/4) 여야 하는데 ${t.earlyScore.toFixed(1)} (1/1 이면 32)`);
}

// 2) 재료 2개 = 완성템 1개. 초반엔 재료로 들고 있는 게 정상이므로 재료만으로 만점까지 가야 한다.
{
  const d = engineDecks.find((x) => x.items.some((i) => i.unitId === x.carryUnitId && i.priority === 1 && jsonCtx.itemRecipe(i.itemId)?.length === 2));
  if (!d) console.warn("· 캐리 1순위 완성템이 있는 덱이 없어 아이템 가드 스킵");
  else {
    const ci = d.items.filter((i) => i.unitId === d.carryUnitId && i.priority === 1);
    const comps = ci.flatMap((i) => jsonCtx.itemRecipe(i.itemId) ?? []);
    const base = { stage: "2-1", completed: [] as string[], components: [] as string[], units: [] };
    const fromComps = scoreDeck({ ...base, components: comps }, d, jsonCtx);
    const fromDone = scoreDeck({ ...base, completed: ci.map((i) => i.itemId) }, d, jsonCtx);
    ok(fromComps.itemScore > 24.9, `캐리 핵심템 재료 전부 보유인데 템 ${fromComps.itemScore.toFixed(1)}/25 (덱 ${d.name})`);
    ok(Math.abs(fromComps.itemScore - fromDone.itemScore) < 0.01, `재료 전부(${fromComps.itemScore.toFixed(1)}) 와 완성템 전부(${fromDone.itemScore.toFixed(1)}) 가 달라진다`);

    // 덱이 1칸만 쓰는 재료를 여러 개 들고 있어도 그 칸 수만큼만 센다.
    const one = comps[0];
    const slots = comps.filter((c) => c === one).length;
    const dup = scoreDeck({ ...base, components: Array(slots + 3).fill(one) }, d, jsonCtx);
    ok(dup.itemScore <= (slots / comps.length) * 25 + 0.01, `${one} ${slots + 3}개 → 템 ${dup.itemScore.toFixed(1)} (칸이 ${slots}개뿐이라 ${((slots / comps.length) * 25).toFixed(1)} 이 상한)`);
  }
}

// 3) 유닛 0개면 코어 게이트가 걸러낼 근거가 없다 — 빈 목록 대신 아이템·메타 순으로 세운다.
{
  const input: RecommendInput = { stage: "4-1", components: carryComps(T).slice(0, 2), completed: [], units: [] };
  for (const gate of ["stage", "all"] as const)
    ok(recommend(input, engineDecks, jsonCtx, { coreGate: gate }).length > 0, `4-1 재료만(유닛 0) · gate=${gate} → 후보 0개`);
}

console.log(failed ? `\n✗ 가드 ${failed}건 실패` : "\n✓ 가드 통과");
process.exitCode = failed ? 1 : 0;
