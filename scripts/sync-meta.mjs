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
const traits = Object.fromEntries(Object.entries(readJson("lib/gen/traits.json")).map(([k, v]) => [k, v.name]));
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
const compsData = (await get("comps_data")).results.data.cluster_details;   // levelling, difficulty, 3성 목표, 아이템 우선순위
const compsStats = (await get("comps_stats")).results;                     // 등수 분포 → 1등률/Top4/픽률
const totalBoards = compsStats.find((s) => s.cluster === "")?.places?.[0] ?? 0;
const statsOf = Object.fromEntries(compsStats.filter((s) => s.cluster).map((s) => [s.cluster, s]));
// metatft 기준: difficulty < -0.05 Easy, > 0.07 또는 Fast 9 Hard
const difficultyOf = (diff, lev) => (diff < -0.05 ? "쉬움" : diff > 0.07 || lev === "Fast 9" ? "어려움" : "보통");
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

  // 대체 아이템: 유닛별 2~3위 빌드에만 나오는 아이템
  const altItems = {};
  for (const b of [...d.builds].sort((a, b) => b.score - a.score)) {
    const uid = unitByApi[b.unit]?.id;
    if (!uid || !seenUnit.has(uid)) continue;
    const main = coreItems.filter((ci) => ci.unitId === uid).map((ci) => ci.itemId);
    for (const it of b.buildName.map(itemId).filter(Boolean)) {
      if (main.includes(it) || (altItems[uid] ?? []).includes(it)) continue;
      (altItems[uid] ??= []).push(it);
    }
    if ((altItems[uid]?.length ?? 0) >= 3) altItems[uid] = altItems[uid].slice(0, 3);
  }

  // 통계·태그
  const cd = compsData[c.Cluster] ?? {};
  const st = statsOf[c.Cluster];
  const places = st?.places ?? [];
  const games = st?.count ?? c.games;
  const winRate = games ? places[0] / games : undefined;
  const top4Rate = games ? (places[0] + places[1] + places[2] + places[3]) / games : undefined;
  const pickRate = totalBoards ? games / totalBoards : undefined;
  const levelling = cd.levelling ?? (Number(finalLv) >= 9 ? "Fast 9" : "Fast 8");
  const threeStarTargets = (cd.stars ?? []).map((a) => unitByApi[a]?.id).filter(Boolean);
  // 상대 덱 상성: 같이 만나면 내 등수가 얼마나 나빠지나 (+면 불리). 우리 덱 집합 안의 것만.
  const counters = (d.counters ?? [])
    .filter((x) => String(x.against) !== String(c.Cluster) && clusters.some((k) => String(k.Cluster) === String(x.against)))
    .map((x) => ({ deckId: `mt-${x.against}`, placeChange: Number(x.place_change.toFixed(2)) }));

  const name = c.name.map((p) => (p.type === "trait" ? traits[p.name] : unitByApi[p.name]?.name) ?? p.name).join(" ");
  const tierLabel = tierOf(c.avg);
  decks.push({
    id: `mt-${c.Cluster}`, name, tierLabel, tier: TIER_NUM[tierLabel],
    avgPlacement: Number(c.avg.toFixed(2)), games,
    winRate: winRate && Number(winRate.toFixed(4)), top4Rate: top4Rate && Number(top4Rate.toFixed(4)), pickRate: pickRate && Number(pickRate.toFixed(4)),
    levelling, difficulty: difficultyOf(cd.difficulty ?? 0, levelling), threeStarTargets,
    carryId, coreUnits, coreItems, altItems, levels, counters,
  });
  console.log(`  ${tierLabel.padEnd(2)} ${c.avg.toFixed(2)} ${name}  [${levelling}/${difficultyOf(cd.difficulty ?? 0, levelling)}] win ${((winRate ?? 0) * 100).toFixed(1)}% top4 ${((top4Rate ?? 0) * 100).toFixed(1)}%`);
}

writeFileSync("lib/gen/decks.json", JSON.stringify(decks, null, 2) + "\n");

// ---- 증강 티어 (metatft 큐레이션 S/A/B/C)
try {
  const tl = (await get("../tft-stat-api/augments_tiers")).content.content.tierList;
  const tiers = {};
  for (const t of tl) for (const a of t.content) if (a.type === "augment") tiers[a.id] = t.label;
  writeFileSync("lib/gen/augment_tiers.json", JSON.stringify(tiers, null, 2) + "\n");
  console.log(`증강 티어: ${Object.keys(tiers).length}개`);
} catch (e) {
  console.warn("증강 티어 실패 (기존 유지):", e.message);
}

// ---- 팀 플래너 코드용 유닛 코드 (metatft 룩업). 코드 = "02" + 10슬롯×3hex + "TFTSet18"
try {
  const lookup = await (await fetch(`https://data.metatft.com/lookups/${ci.tft_set}_latest_en_us.json`, UA)).json();
  const codes = {};
  for (const u of units) {
    const m = lookup.units.find((x) => x.assetNames?.includes(u.apiName) && x.code);
    if (m) codes[u.id] = m.code;
  }
  writeFileSync("lib/gen/codes.json", JSON.stringify({ set: ci.tft_set, codes }, null, 2) + "\n");
  console.log(`팀 코드: ${Object.keys(codes).length}/${units.length} 유닛`);
} catch (e) {
  console.warn("팀 코드 룩업 실패 (기존 codes.json 유지):", e.message);
}
writeFileSync("lib/gen/meta.json", JSON.stringify({ ...readJson("lib/gen/meta.json"), metaCluster: ci.cluster_id, metaUpdated: ci.updated_at.slice(0, 10) }, null, 2) + "\n");
if (unmapped.size) console.warn("매핑 안 된 유닛(무시됨):", [...unmapped].join(", "));
if (unmappedItems.size) console.warn("매핑 안 된 아이템(무시됨) — ITEM_ALIAS 확인:", [...unmappedItems].join(", "));
console.log(`→ lib/gen/decks.json (${decks.length} decks)`);
