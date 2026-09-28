// 엔진 회귀 테스트: npx tsx scripts/test-engine.ts
import { recommend, scoreDeck, type RecommendInput } from "../lib/engine/score";
import { jsonCtx, toEngineDeck } from "../lib/engine/adapt";
import { DECKS_JSON } from "../lib/decks-json";
const engineDecks = DECKS_JSON.map(toEngineDeck);

const U = (s: string) => s.split(",").filter(Boolean).map((p) => { const [unitId, st] = p.split(":"); return { unitId, star: (Number(st) || 1) as 1 | 2 | 3 }; });
const cases: Array<{ name: string; input: RecommendInput }> = [
  { name: "2-1 오른1 자야1 바루스1 + BF·곡궁",      input: { stage: "2-1", components: ["bf", "bow"], completed: [], units: U("ornn:1,xayah:1,varus:1") } },
  { name: "2-5 오른2 자야2 바루스1 + BF·망토",       input: { stage: "2-5", components: ["bf", "cloak"], completed: [], units: U("ornn:2,xayah:2,varus:1") } },
  { name: "3-3 코부코2 베이가2 + 지팡이",            input: { stage: "3-3", components: ["rod"], completed: [], units: U("kobuko:2,veigar:2") } },
  { name: "3-3 베이가3 (3성 규칙)",                   input: { stage: "3-3", components: [], completed: [], units: U("veigar:3,kobuko:2") } },
  { name: "4-5 드레이븐2 마오카이2 + 죽음의검 완성",  input: { stage: "4-5", components: ["bow"], completed: ["deathblade"], units: U("draven:2,maokai:2,ezreal:2") } },
  { name: "4-5 드레이븐2 알리스타2 아무무2 (코어 전부 보유)", input: { stage: "4-5", components: ["bf"], completed: ["deathblade"], units: U("draven:2,alistar:2,amumu:2") } },
  { name: "4-5 아펠리오스3 (4코 3성 → 2성 취급)",     input: { stage: "4-5", components: [], completed: [], units: U("aphelios:3,nidalee:2,sentinel:2") } },
  { name: "스테이지 없음 + 로비(아펠·니달리)",        input: { components: ["bf", "cloak"], completed: [], units: U("ornn:2,xayah:2,varus:1"), rivals: ["aphelios", "nidalee", "sentinel"] } },
  { name: "입력 없음 (메타 순)",                      input: { components: [], completed: [], units: [] } },
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
  const s = scoreDeck({ stage: "2-1", components: [], completed: [], units: U("_u1,_u2,_u3") }, lateOnly, jsonCtx);
  ok(Math.abs(s.earlyScore - 24) < 0.01, `8렙 조합만 있는 덱 · 2-1(4렙) 3유닛 일치 → 조합 24 (3/4) 여야 하는데 ${s.earlyScore.toFixed(1)} (3/8 이면 12)`);
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

console.log(failed ? `\n✗ 가드 ${failed}건 실패` : "\n✓ 가드 통과");
process.exitCode = failed ? 1 : 0;
