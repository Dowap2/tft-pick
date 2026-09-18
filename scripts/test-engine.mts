// 엔진 회귀 테스트: npx tsx scripts/test-engine.ts
import { recommend, type RecommendInput } from "../lib/engine/score";
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
