// 덱 추천 아이템 정합성 검사: node --env-file=.env.local npx tsx scripts/check-deck-items.mts
//   (보드 표본 조절: --boards 6000)
//
// 사흘 동안 아이템 파이프라인에서 버그 3개가 사람 눈으로 발견됐다. 각각을 불변식으로 바꾼다:
//   1) 상징 16개 누락      → raw 보드에 있는데 우리가 버리는 아이템을 센다
//   2) 곡궁+곡궁 오집계     → 서로 다른 Riot 이름이 같은 우리 id 로 가는 충돌을 잡는다
//   3) 픽률 3% 아이템 추천  → 라이브 덱 아이템의 등장률 하한을 확인한다
// 여기에 정렬 불변식(§4.11)과 참조 무결성을 더한다.
//
// "딜러에 방어템" 류의 역할 검사는 넣지 않는다. isDefensive 정규식이 밤의 끝자락·
// 스테락의 도전·거인의 결의·적응형 투구 같은 하이브리드 템을 방어템으로 분류해서
// 오탐이 10건 중 10건이었다 (실측). 늑대 소년이 되는 검사는 없는 게 낫다.
import { readFileSync } from "node:fs";
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "";
const { riotItemId } = await import("./db.mjs");

const arg = (k: string, d: number) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? Number(process.argv[i + 1]) : d; };
const MAX_BOARDS = arg("boards", 6000);
const MIN_RATE = 0.15;   // docs/티어기준.md §4.11

const U = process.env.NEXT_PUBLIC_SUPABASE_URL, K = process.env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: K!, Authorization: `Bearer ${K}`, "content-type": "application/json" };
const ours = JSON.parse(readFileSync("lib/gen/items.json", "utf8")) as { id: string; name: string; recipe: string[] }[];
const byId = new Map(ours.map((i) => [i.id, i]));

let failed = 0;
const fail = (msg: string) => { console.error(`✗ ${msg}`); failed++; };
const ok = (msg: string) => console.log(`✓ ${msg}`);

// ---- 1) 매핑 충돌: 서로 다른 Riot 이름이 같은 우리 id 로 가면 한쪽 통계가 다른 쪽에 섞인다 ----
{
  const cd = JSON.parse(readFileSync(process.argv.includes("--cdragon") ? process.argv[process.argv.indexOf("--cdragon") + 1] : "/tmp/cd.json", "utf8")) as { items: { apiName: string; name: string }[] };
  const to = new Map<string, string[]>();
  for (const it of cd.items) {
    if (!/^DA_/.test(it.apiName)) continue;
    const id = riotItemId(it.apiName);
    if (!id) continue;
    to.set(id, [...(to.get(id) ?? []), `${it.apiName}(${it.name})`]);
  }
  const clash = [...to].filter(([, names]) => names.length > 1);
  if (clash.length) for (const [id, names] of clash) fail(`매핑 충돌: ${names.join(" / ")} 가 모두 "${id}" 로 간다 → 한쪽 통계가 다른 쪽 이름으로 표시된다`);
  else ok(`Riot 이름 → 우리 id 충돌 없음 (${to.size}종)`);
}

const page = async (q: string) => {
  const out: Record<string, unknown>[] = [];
  for (let o = 0; ; o += 1000) {
    const r = await fetch(`${U}/rest/v1/${q}&limit=1000&offset=${o}`, { headers: H });
    const j = await r.json(); if (!Array.isArray(j)) throw new Error(JSON.stringify(j).slice(0, 200));
    out.push(...j); if (j.length < 1000) break;
  }
  return out;
};

// ---- 2) 라이브 덱 아이템: 등장률 하한 · 참조 무결성 · 정렬 불변식 ----
const bundle = await (await fetch(`${U}/rest/v1/decks_bundle?select=id,name,carry_unit_id,items`, { headers: H })).json() as
  { id: string; name: string; carry_unit_id: string; items: { unitId: string; itemId: string; priority: number; placeDelta: number | null }[] | null }[];

const rows = bundle.flatMap((d) => (d.items ?? []).map((i) => ({ ...i, deck: d.name, deckId: d.id, carry: d.carry_unit_id })));
console.log(`\n라이브 덱 ${bundle.length}개 · 아이템 행 ${rows.length}개`);

const orphan = rows.filter((r) => !byId.has(r.itemId));
if (orphan.length) fail(`items.json 에 없는 item_id ${orphan.length}건: ${[...new Set(orphan.map((o) => o.itemId))].slice(0, 5).join(", ")}`);
else ok("모든 item_id 가 items.json 에 있다");

// pick_rate 는 뷰에 없으므로 deck_items 를 직접 본다 (라이브 덱만)
const live = new Set(bundle.map((d) => d.id));
const di = (await page("deck_items?select=deck_id,unit_id,item_id,pick_rate,place_delta,priority&patch_id=eq.1"))
  .filter((r) => live.has(r.deck_id as string)) as { deck_id: string; unit_id: string; item_id: string; pick_rate: number; place_delta: number | null; priority: number }[];
const lowRate = di.filter((r) => Number(r.pick_rate) < MIN_RATE);
if (lowRate.length) fail(`등장률 ${MIN_RATE * 100}% 미만이 추천에 올라있다 ${lowRate.length}건 (최저 ${(Math.min(...lowRate.map((r) => Number(r.pick_rate))) * 100).toFixed(1)}%): ${lowRate.slice(0, 3).map((r) => `${r.deck_id}/${r.unit_id}/${r.item_id}`).join(", ")}`);
else ok(`등장률 하한 ${MIN_RATE * 100}% 준수 (최저 ${(Math.min(...di.map((r) => Number(r.pick_rate))) * 100).toFixed(1)}%)`);

// §4.11: priority 1 안에서 delta 오름차순. 뷰가 정렬해 주므로 뷰 결과로 확인한다.
let unsorted = 0;
for (const d of bundle) {
  const p1 = (d.items ?? []).filter((i) => i.unitId === d.carry_unit_id && i.priority === 1 && i.placeDelta != null);
  for (let i = 1; i < p1.length; i++) if (p1[i].placeDelta! < p1[i - 1].placeDelta! - 1e-9) { unsorted++; break; }
}
if (unsorted) fail(`캐리 1순위 아이템이 delta 오름차순이 아닌 덱 ${unsorted}개 — 0024 뷰 정렬을 확인해라`);
else ok("캐리 1순위 아이템이 성적순으로 정렬돼 있다 (§4.11)");

// ---- 3) 버려지는 아이템: raw 보드에 등장하는데 매핑이 null 인 것 ----
const boards: { units?: { items?: string[] }[] }[] = [];
for (let o = 0; o < MAX_BOARDS; o += 1000) {
  const r = await fetch(`${U}/rest/v1/rpc/raw_boards?limit=1000&offset=${o}`, { method: "POST", headers: H, body: JSON.stringify({ p_patch_id: 1 }) });
  const j = await r.json() as typeof boards; if (!j.length) break; boards.push(...j);
}
const seen = new Map<string, number>();
let total = 0, dropped = 0;
for (const b of boards) for (const u of b.units ?? []) for (const it of u.items ?? []) {
  total++;
  const id = riotItemId(it);
  if (!id || !byId.has(id)) { dropped++; seen.set(it, (seen.get(it) ?? 0) + 1); }
}
console.log(`\n보드 ${boards.length}개 · 아이템 인스턴스 ${total}개 · 버려짐 ${dropped}개 (${(dropped / total * 100).toFixed(1)}%)`);
// 상징 같은 정규 아이템이 대량으로 버려지면 실패. 찬란/유물은 원래 제외 대상이라 경고만.
const big = [...seen].filter(([n, k]) => k / total >= 0.005 && !/Radiant|Artifact|Ornn|Support/i.test(n)).sort((a, b) => b[1] - a[1]);
if (big.length) for (const [n, k] of big.slice(0, 8)) fail(`버려지는 아이템 ${n} — ${k}회 (${(k / total * 100).toFixed(1)}%). items.json·ITEM_ALIAS 를 확인해라`);
else ok("0.5% 이상 버려지는 정규 아이템 없음");
const minor = [...seen].filter(([n]) => /Radiant|Artifact|Ornn|Support/i.test(n)).length;
if (minor) console.log(`  · 찬란/유물/지원 ${minor}종은 설계상 제외 (docs/티어기준.md)`);

console.log(failed ? `\n✗ ${failed}건 실패` : "\n✓ 덱 추천 아이템 정합성 통과");
process.exitCode = failed ? 1 : 0;
