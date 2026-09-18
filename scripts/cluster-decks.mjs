// raw 보드(1~4등) → 덱 클러스터 → decks / deck_units / deck_items / deck_levels / participant_decks → deck_stats 리프레시
// 실행: node --env-file=.env.local scripts/cluster-decks.mjs [--min-members 15] [--sim 0.5] [--dry-run]
//
// 방식 (단순·결정적):
//  1. 보드 → 유닛 집합(우리 id). 유닛 6개 미만 보드 제외.
//  2. 등수 좋은 보드부터 순회, 기존 클러스터 대표(등장률 ≥ 50% 유닛)와 자카드 ≥ SIM 이면 합류, 아니면 새 클러스터. 2패스로 안정화.
//  3. 표본 < MIN 클러스터 버림. 대표 유닛·성·아이템·캐리·레벨별 조합 산출.
//  4. 이름 = 최고 단계 특성 + 캐리. id = 슬러그.
// ponytail: k-means 대신 그리디 자카드. 수천 판까진 충분, 수만 판 넘어가면 시그니처 해시 기반으로.
import { readFileSync } from "node:fs";
import { rpc, rpcAll, select, upsert, currentPatch, riotItemId } from "./db.mjs";

const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => a.startsWith("--") ? [a.slice(2), all[i + 1]?.startsWith("--") || all[i + 1] == null ? true : all[i + 1]] : []).filter(Boolean));
const MIN = Number(args["min-members"] ?? 15);
const SIM = Number(args.sim ?? 0.5);
const DRY = !!args["dry-run"];

const J = (p) => JSON.parse(readFileSync(p, "utf8"));
const patch = await currentPatch();
const pid = patch.id;
const units = await select("units", `select=id,api_name,name,cost&patch_id=eq.${pid}`);
const traits = await select("traits", `select=id,name,breakpoints&patch_id=eq.${pid}`);
const items = await select("items", `select=id,recipe,kind&patch_id=eq.${pid}`);
const unitByApi = new Map(units.map((u) => [u.api_name, u]));
const unitById = new Map(units.map((u) => [u.id, u]));
const traitById = new Map(traits.map((t) => [t.id, t]));
const itemIds = new Set(items.map((i) => i.id));
const isDefensive = (id) => /warmogs|bramble|gargoyle|dragonsclaw|redbuff|frozenheart|redemption|spectralgauntlet|adaptivehelm|crownguard|nightharvester|steraks|titansresolve|guardianangel|quicksilver/.test(id);

// ---- 1) 보드 로드 ----
const raw = await rpcAll("raw_boards", { p_patch_id: pid }, "match_id.asc,puuid.asc");
const boards = raw.map((b) => {
  const us = (b.units ?? []).map((u) => ({ id: unitByApi.get(u.character_id)?.id, star: Math.min(3, u.tier ?? 1), items: (u.items ?? []).map(riotItemId).filter((i) => i && itemIds.has(i)) })).filter((u) => u.id);
  return { ...b, us, set: new Set(us.map((u) => u.id)), traitLv: new Map((b.traits ?? []).map((t) => [t.name, t.tier_current])) };
}).filter((b) => b.set.size >= 5).sort((a, b) => a.placement - b.placement);
// 중반 탈락자(최종 레벨 ≤ 7)의 보드 = 그 덱의 6~7렙 중간 단계 표본. 클러스터를 만들진 않고, 최종 보드로 만든 덱에 "포함 비율"로 붙는다.
const isEarly = (b) => b.level <= 7;
const CONTAIN = 0.7;   // 초반 보드 유닛의 70% 이상이 덱 대표 유닛에 포함되면 합류
console.log(`패치 ${patch.version}: 보드 ${raw.length}개 → 유효 ${boards.length}개`);

// ---- 2) 그리디 자카드 클러스터링 (2패스) ----
const jaccard = (a, b) => { let i = 0; for (const x of a) if (b.has(x)) i++; return i / (a.size + b.size - i); };
const contain = (board, rep) => { let i = 0; for (const x of board) if (rep.has(x)) i++; return i / board.size; };
// 대표(centroid)는 최종 보드(8렙+)로만 계산 — 중반 보드가 섞이면 유닛 등장률이 희석됨
const centroid = (members) => {
  const late = members.filter((m) => !isEarly(m));
  const base = late.length >= 3 ? late : members;
  const f = new Map();
  for (const m of base) for (const u of m.set) f.set(u, (f.get(u) ?? 0) + 1);
  return new Set([...f].filter(([, n]) => n / base.length >= 0.5).map(([u]) => u));
};
let clusters = [];
for (let pass = 0; pass < 2; pass++) {
  const next = pass === 0 ? [] : clusters.map((c) => ({ rep: centroid(c.members), members: [] }));
  for (const b of boards) {
    if (isEarly(b)) continue;   // 중반 보드는 2패스 후 별도 배정
    let best = null, bs = 0;
    for (const c of next) { const s = jaccard(b.set, c.rep); if (s > bs) { bs = s; best = c; } }
    if (best && bs >= SIM) best.members.push(b);
    else next.push({ rep: new Set(b.set), members: [b] });
  }
  clusters = next.filter((c) => c.members.length > 0);
  clusters.forEach((c) => (c.rep = centroid(c.members)));
  // 대표가 겹치는 클러스터 병합
  for (let i = 0; i < clusters.length; i++) for (let j = clusters.length - 1; j > i; j--) {
    if (jaccard(clusters[i].rep, clusters[j].rep) >= 0.7) { clusters[i].members.push(...clusters[j].members); clusters[i].rep = centroid(clusters[i].members); clusters.splice(j, 1); }
  }
}
clusters = clusters.filter((c) => c.members.length >= MIN).sort((a, b) => b.members.length - a.members.length);
// 중반 보드 배정: 최종 대표 + (metatft 유사 덱의 4~6렙 초반 라인) 을 합친 집합에 얼마나 포함되는지.
// 중반 탈락자 보드는 초반 유닛(오른·바루스 등)을 아직 들고 있어 최종 대표만으로는 안 붙는다.
let metaDecks = [];
try { metaDecks = J("lib/gen/decks.json"); } catch {}
for (const c of clusters) {
  const near = metaDecks.map((m) => ({ m, s: jaccard(c.rep, new Set(m.coreUnits.map((u) => u.unitId))) })).sort((a, b) => b.s - a.s)[0];
  c.extRep = new Set(c.rep);
  if (near && near.s >= 0.4) for (const L of ["4", "5", "6", "7"]) for (const u of near.m.levels?.[L]?.units ?? []) if (unitById.has(u)) c.extRep.add(u);
}
let earlyAssigned = 0, earlyTotal = 0;
for (const b of boards.filter(isEarly)) {
  earlyTotal++;
  let best = null, bs = 0;
  for (const c of clusters) { const s = contain(b.set, c.extRep); if (s > bs) { bs = s; best = c; } }
  if (best && bs >= CONTAIN) { best.members.push(b); earlyAssigned++; }
  else if (DRY) (globalThis.__miss ??= []).push(bs.toFixed(2));
}
if (DRY && globalThis.__miss) { const m = globalThis.__miss.sort(); console.log(`  미배정 포함비율 분포: min ${m[0]} median ${m[m.length >> 1]} max ${m[m.length - 1]}`); }
console.log(`클러스터 ${clusters.length}개 (표본 ≥ ${MIN}) · 중반(≤7렙) 보드 ${earlyAssigned}/${earlyTotal} 배정`);

// ---- 3) 클러스터 → 덱 ----
const mode = (xs) => [...xs.reduce((m, x) => m.set(x, (m.get(x) ?? 0) + 1), new Map())].sort((a, b) => b[1] - a[1])[0]?.[0];
const decks = [];
const pdRows = [];
for (const c of clusters) {
  const n = c.members.length;
  // 유닛 등장률
  const freq = new Map();
  for (const m of c.members) for (const u of m.set) freq.set(u, (freq.get(u) ?? 0) + 1);
  const deckUnits = [...freq].filter(([, k]) => k / n >= 0.3).map(([id, k]) => ({ id, rate: k / n, core: k / n >= 0.5 }));
  // 유닛별 성 최빈값 (4~5코는 2 캡, 캐리는 아래서 보정), 아이템 빈도
  const starMode = new Map(), itemFreq = new Map(), offense = new Map();
  for (const du of deckUnits) {
    const inst = c.members.flatMap((m) => m.us.filter((u) => u.id === du.id));
    starMode.set(du.id, mode(inst.map((u) => u.star)) ?? 2);
    // 캐리 지표: 인스턴스당 평균 공격템 개수 (탱커는 방어템 3개라 제외됨)
    offense.set(du.id, inst.reduce((s, u) => s + u.items.filter((i) => !isDefensive(i)).length, 0) / inst.length);
    const f = new Map(); for (const u of inst) for (const it of u.items) f.set(it, (f.get(it) ?? 0) + 1);
    itemFreq.set(du.id, [...f].map(([it, k]) => ({ it, rate: k / inst.length })).sort((a, b) => b.rate - a.rate));
  }
  // 캐리 = 공격템을 가장 많이 드는 유닛 (동률 고코스트)
  const carry = [...deckUnits].sort((a, b) => (offense.get(b.id) - offense.get(a.id)) || (unitById.get(b.id).cost - unitById.get(a.id).cost))[0].id;
  // 코어 = 캐리 + 등장률 상위 2 (캐리 제외)
  const coreIds = [carry, ...deckUnits.filter((u) => u.id !== carry).sort((a, b) => b.rate - a.rate).slice(0, 2).map((u) => u.id)];
  // 특성 (구성원 traits 최빈 상위) → 이름
  const tf = new Map();
  for (const m of c.members) for (const [t, lv] of m.traitLv) {
    const bp = traitById.get(t)?.breakpoints ?? [];
    if (bp.length >= 2 && lv >= 2) tf.set(t, (tf.get(t) ?? 0) + lv);   // 단일 유닛 고유 특성 제외, 단계 가중
  }
  const topTrait = [...tf].sort((a, b) => b[1] - a[1])[0]?.[0];
  const carryName = unitById.get(carry).name;
  const name = `${topTrait ? traitById.get(topTrait).name + " " : ""}${carryName}`;
  let id = `${(topTrait ?? "deck").toLowerCase().replace(/^da_18_|^da_|18$/g, "")}-${carry}`;
  if (decks.some((d) => d.id === id)) id = `${id}-${decks.filter((d) => d.id.startsWith(id)).length + 1}`;   // 같은 특성+캐리 변형 덱
  // 레벨링 태그
  const lvMode = mode(c.members.map((m) => m.level));
  const levelling = lvMode >= 9 ? "Fast 9" : lvMode <= 7 ? `lvl ${lvMode}` : "Fast 8";
  // 레벨별 조합 (최종 레벨 L인 구성원 보드의 ≥50% 유닛) — Match-V5엔 라운드 스냅샷이 없어 7렙 이상만 근사
  const levels = {};
  for (const L of [5, 6, 7, 8, 9, 10]) {
    const ms = c.members.filter((m) => m.level === L);
    if (ms.length < 5) continue;
    const us = centroid(ms);
    if (us.size >= 5) levels[L] = { units: [...us], avg: ms.reduce((s, m) => s + m.placement, 0) / ms.length, count: ms.length };
  }
  const avgPlace = c.members.reduce((s, m) => s + m.placement, 0) / n;
  const byLevel = Object.fromEntries([5, 6, 7, 8, 9, 10].map((L) => [L, c.members.filter((m) => m.level === L).length]));
  decks.push({
    id, name, carry, coreIds, levelling, n, avgPlace, deckUnits, starMode, itemFreq, levels, byLevel,
    signature: { traits: Object.fromEntries([...tf].slice(0, 8)), units: Object.fromEntries([...freq].map(([u, k]) => [u, Number((k / n).toFixed(2))])) },
  });
  for (const m of c.members) pdRows.push({ match_id: m.match_id, puuid: m.puuid, deck_id: id, distance: Number((1 - jaccard(m.set, c.rep)).toFixed(3)) });
}
// ---- 3.5) 초반(4~6렙) 조합 보강 ----
// Match-V5 엔 최종 보드만 있어 4~6렙을 알 수 없다. metatft 스냅샷(lib/gen/decks.json, early_options)에서
// 최종 조합이 가장 비슷한 덱(자카드 ≥ 0.4)의 4·5·6렙 조합을 빌려온다. 우리 데이터에 같은 레벨이 있으면 우리 것 우선.
// ponytail: 인게임 수집이 생기면 이 블록 삭제.
try {
  const meta = J("lib/gen/decks.json");
  const jac = (a, b) => { const A = new Set(a), B = new Set(b); let i = 0; for (const x of A) if (B.has(x)) i++; return i / (A.size + B.size - i); };
  let borrowed = 0;
  for (const d of decks) {
    const mine = d.deckUnits.filter((u) => u.core).map((u) => u.id);
    const best = meta.map((m) => ({ m, s: jac(mine, m.coreUnits.map((u) => u.unitId)) })).sort((a, b) => b.s - a.s)[0];
    if (!best || best.s < 0.4) continue;
    for (const L of ["4", "5", "6", "7"]) {   // 우리 표본이 없는 레벨만 (7렙은 자체 표본 5개 이상이면 자체 것)
      const lv = best.m.levels?.[L];
      if (!lv || d.levels[L]) continue;
      const units = lv.units.filter((u) => unitById.has(u));
      if (units.length >= 3) { d.levels[L] = { units, avg: lv.avg, count: lv.count, borrowed: best.m.name }; borrowed++; }
    }
  }
  console.log(`초반 조합 보강: metatft 에서 ${borrowed}개 레벨 차용`);
} catch (e) { console.warn("초반 조합 보강 건너뜀:", e.message); }

for (const d of decks) console.log(`  ${String(d.n).padStart(4)}판  avg ${d.avgPlace.toFixed(2)}  ${d.levelling.padEnd(7)} ${d.name.padEnd(14)} 코어[${d.coreIds.map((u) => unitById.get(u).name).join(", ")}]  유닛 ${d.deckUnits.length}  lv[${Object.keys(d.levels).join("/")}]  ${DRY ? "표본/렙 " + [5, 6, 7, 8, 9, 10].map((L) => L + ":" + d.byLevel[L]).join(" ") : ""}`);
if (DRY) process.exit(0);

// ---- 4) 적재 ----
await rpc("reset_decks", { p_patch_id: pid });
await upsert("decks", decks.map((d) => ({
  id: d.id, patch_id: pid, name: d.name, carry_unit_id: d.carry, core_unit_ids: d.coreIds,
  levelling: d.levelling, difficulty: null, signature: d.signature, is_published: true,
})), "id,patch_id");
await upsert("deck_units", decks.flatMap((d) => d.deckUnits.map((u) => {
  const cost = unitById.get(u.id).cost;
  const target = cost >= 4 ? 2 : u.id === d.carry && cost <= 3 ? 3 : Math.min(2, d.starMode.get(u.id));   // 지시서 스타 규칙
  return { deck_id: d.id, patch_id: pid, unit_id: u.id, target_star: target, is_core: u.core };
})), "deck_id,patch_id,unit_id");
await upsert("deck_items", decks.flatMap((d) => d.deckUnits.flatMap((u) => {
  const top = d.itemFreq.get(u.id).slice(0, 5);
  if (top.length === 0) return [];
  const isCarry = u.id === d.carry;
  return top.map((x, i) => ({
    deck_id: d.id, patch_id: pid, unit_id: u.id, item_id: x.it,
    role: isCarry ? (x.rate >= 0.5 ? "carry_core" : "carry_flex") : isDefensive(x.it) ? "tank" : "utility",
    priority: i < 3 ? 1 : i - 1, pick_rate: Number(x.rate.toFixed(4)),
  }));
})), "deck_id,patch_id,unit_id,item_id");
await upsert("deck_levels", decks.flatMap((d) => Object.entries(d.levels).map(([L, v]) => ({
  deck_id: d.id, patch_id: pid, level: Number(L), unit_ids: v.units, avg_place: Number(v.avg.toFixed(2)), games: v.count,
}))), "deck_id,patch_id,level");
const n = await rpc("ingest_participant_decks", { p_patch_id: pid, rows: pdRows });
await rpc("refresh_deck_stats");
console.log(`\n적재: decks ${decks.length}, participant_decks ${n}, deck_stats 리프레시 완료`);
