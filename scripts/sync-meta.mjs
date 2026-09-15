// metatft.com 비공식 JSON API → lib/gen/decks.json
// 사용: node scripts/sync-meta.mjs [최대 평균순위=4.5]   (S<4.25, A<4.5, B<4.75, C<5 — metatft 기준)
// 먼저 scripts/sync.mjs 로 units/items/traits.json 을 생성해 둘 것.
import { readFileSync, writeFileSync } from "node:fs";

const MAX_AVG = Number(process.argv[2] ?? 4.5);
const API = "https://api-hc.metatft.com/tft-comps-api/";
const UA = { headers: { "user-agent": "Mozilla/5.0 (tft-pick sync)" } };
const get = async (path) => {
  const r = await fetch(API + path, UA);
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return r.json();
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));

const units = readJson("lib/gen/units.json");
const items = readJson("lib/gen/items.json");
const traits = readJson("lib/gen/traits.json");
const unitByApi = Object.fromEntries(units.map((u) => [u.apiName, u]));
const itemIds = new Set(items.map((i) => i.id));

// metatft 아이템명(읽기 쉬운 이름) → cdragon apiName 기반 우리 id. 나머지는 접두어 떼고 소문자.
const ITEM_ALIAS = {
  KrakensFury: "runaanshurricane", EdgeOfNight: "guardianangel", NashorsTooth: "leviathan",
  VoidStaff: "statikkshiv", SpiritVisage: "redemption", StrikersFlail: "powergauntlet",
  SunfireCape: "redbuff", SteadfastHeart: "nightharvester", Evenshroud: "spectralgauntlet",
  ProtectorsVow: "frozenheart", HandOfJustice: "unstableconcoction", GiantSlayer: "madredsbloodrazor",
  TacticiansCape: "tacticiansring", TacticiansShield: "tacticiansscepter", TacticiansCrown: "forceofnature",
};
const unmappedItems = new Set();
const itemId = (api) => {
  if (!/^DA_[A-Za-z]+$/.test(api) || /Radiant$/.test(api)) return null; // 찬란/유물/상징/재료 제외
  const key = api.slice(3);
  const id = ITEM_ALIAS[key] ?? key.toLowerCase();
  if (!itemIds.has(id)) { unmappedItems.add(api); return null; }
  return id;
};
const tierOf = (avg) => (avg < 4.0 ? "OP" : avg < 4.25 ? "S" : avg < 4.5 ? "A" : avg < 4.75 ? "B" : "C");
const TIER_NUM = { OP: 1, S: 2, A: 3, B: 4, C: 5 };
// metatft cell_1..28: 1~7 최후방, 22~28 최전방 → 우리 row 0=최전방
const cellToPos = (cell) => { const n = Number(cell.slice(5)) - 1; return [3 - Math.floor(n / 7), n % 7]; };

const { cluster_info: ci } = await get("latest_cluster_info");
const builds = (await get("comp_builds")).results;
const clusters = ci.cluster_details.clusters
  .map((c) => ({ ...c, avg: builds[c.Cluster]?.overall?.avg, games: builds[c.Cluster]?.overall?.count }))
  .filter((c) => c.avg && c.avg < MAX_AVG)
  .sort((a, b) => a.avg - b.avg);
console.log(`cluster ${ci.cluster_id} (${ci.tft_set}, ${ci.updated_at.slice(0, 10)}): ${clusters.length} comps with avg < ${MAX_AVG}`);

const unmapped = new Set();
const mapUnits = (list) => list.split("&").map((a) => unitByApi[a]?.id ?? (unmapped.add(a), null)).filter(Boolean);

const decks = [];
for (const c of clusters) {
  const d = (await get(`comp_details?comp=${c.Cluster}&cluster_id=${ci.cluster_id}`)).results;
  await sleep(500);

  // 레벨별 조합: 4~6 early_options, 7~10 options. 각 레벨 1순위.
  const levels = {};
  for (const [lv, list] of Object.entries({ ...d.early_options, ...d.options })) {
    const top = [...(list ?? [])].sort((a, b) => b.count - a.count)[0]; // 표본 최다 조합
    if (!top) continue;
    levels[lv] = { units: mapUnits(top.unit_list ?? top.units_list), avg: top.avg, count: top.count };
  }
  // 최종 조합 = 7렙 이상 중 표본 최다 레벨
  const finalLv = Object.keys(d.options).sort((a, b) => (levels[b]?.count ?? 0) - (levels[a]?.count ?? 0))[0];
  const starOf = (uid) => {
    const api = units.find((u) => u.id === uid).apiName;
    const tiers = d.unit_stats.find((s) => s.unit === api)?.tiers ?? [];
    const best = tiers.filter((t) => t.tier <= 3).sort((a, b) => b.pcnt - a.pcnt)[0];
    return best?.tier ?? 2;
  };
  // 배치: 유닛별 선호 셀 목록에서 안 겹치는 첫 칸. 확신 높은(1순위 표본 많은) 유닛부터.
  const prefs = (uid) => d.positioning?.units?.[units.find((u) => u.id === uid).apiName]?.positions ?? [];
  const taken = new Set();
  const pos = {};
  for (const uid of [...levels[finalLv].units].sort((a, b) => (prefs(b)[0]?.count ?? 0) - (prefs(a)[0]?.count ?? 0))) {
    const cell = prefs(uid).find((p) => !taken.has(p.cell))?.cell;
    if (cell) { taken.add(cell); pos[uid] = cellToPos(cell); }
  }
  const coreUnits = levels[finalLv].units.map((unitId) => ({ unitId, star: starOf(unitId), pos: pos[unitId] }));

  // 아이템: 유닛별 score 1위 빌드, 상위 4유닛
  const coreItems = [];
  const seenUnit = new Set();
  for (const b of [...d.builds].sort((a, b) => b.score - a.score)) {
    const uid = unitByApi[b.unit]?.id;
    if (!uid || seenUnit.has(uid) || !coreUnits.some((u) => u.unitId === uid)) continue;
    seenUnit.add(uid);
    for (const it of b.buildName.map(itemId).filter(Boolean)) coreItems.push({ unitId: uid, itemId: it });
    if (seenUnit.size >= 4) break;
  }
  // 캐리: 덱 이름에 박힌 유닛들 중 아이템 빌드 score가 가장 높은 유닛. 없으면 빌드 1위.
  const named = new Set(c.name.filter((p) => p.type === "unit").map((p) => unitByApi[p.name]?.id));
  const carryId = [...seenUnit].find((id) => named.has(id)) ?? [...named].find((id) => id && coreUnits.some((u) => u.unitId === id)) ?? [...seenUnit][0] ?? coreUnits[0].unitId;

  const name = c.name.map((p) => (p.type === "trait" ? traits[p.name] : unitByApi[p.name]?.name) ?? p.name).join(" ");
  const tierLabel = tierOf(c.avg);
  decks.push({
    id: `mt-${c.Cluster}`, name, tierLabel, tier: TIER_NUM[tierLabel],
    avgPlacement: Number(c.avg.toFixed(2)), games: c.games, carryId, coreUnits, coreItems, levels,
  });
  console.log(`  ${tierLabel.padEnd(2)} ${c.avg.toFixed(2)} ${name}  (${coreUnits.length}u ${coreItems.length}i lv${Object.keys(levels).join("/")})`);
}

writeFileSync("lib/gen/decks.json", JSON.stringify(decks, null, 2) + "\n");
writeFileSync("lib/gen/meta.json", JSON.stringify({ ...readJson("lib/gen/meta.json"), metaCluster: ci.cluster_id, metaUpdated: ci.updated_at.slice(0, 10) }, null, 2) + "\n");
if (unmapped.size) console.warn("매핑 안 된 유닛(무시됨):", [...unmapped].join(", "));
if (unmappedItems.size) console.warn("매핑 안 된 아이템(무시됨) — ITEM_ALIAS 확인:", [...unmappedItems].join(", "));
console.log(`→ lib/gen/decks.json (${decks.length} decks)`);
