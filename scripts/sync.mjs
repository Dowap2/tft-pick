// CommunityDragon → lib/gen/{units,items}.json
// 사용: node scripts/sync.mjs [패치=latest] [세트번호=18]
//   패치: pbe | latest | 16.18 같은 버전
import { writeFileSync, readFileSync } from "node:fs";

const [patch = "latest", setArg = "18"] = process.argv.slice(2);
const SET = Number(setArg);
const CDN = `https://raw.communitydragon.org/${patch}/game/`;
const asset = (tex) => CDN + tex.toLowerCase().replace(/\.tex$/, ".png");

const COMPONENT = {
  TFT_Item_BFSword: "bf", TFT_Item_RecurveBow: "bow", TFT_Item_NeedlesslyLargeRod: "rod",
  TFT_Item_TearOfTheGoddess: "tear", TFT_Item_ChainVest: "vest", TFT_Item_NegatronCloak: "cloak",
  TFT_Item_GiantsBelt: "belt", TFT_Item_SparringGloves: "gloves", TFT_Item_Spatula: "spatula", TFT_Item_FryingPan: "pan",
};

const res = await fetch(`https://raw.communitydragon.org/${patch}/cdragon/tft/ko_kr.json`);
if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
const data = await res.json();

// ---- 유닛: 캐릭터 폴더명(tft18_ahri → ahri)을 id로. 스킨 변형(럭스 등)은 첫 항목만.
const set = data.setData.find((s) => s.number === SET && s.mutator === `TFTSet${SET}`);
if (!set) throw new Error(`set ${SET} not found in ${patch}`);
const units = [];
const seenUnit = new Set();
for (const c of set.champions) {
  const m = c.squareIcon?.match(new RegExp(`/characters/tft${SET}_([a-z0-9]+)/`, "i"));
  if (!m || !c.traits?.length || c.cost < 1 || c.cost > 5) continue;
  const id = m[1].toLowerCase();
  if (seenUnit.has(id)) continue;
  seenUnit.add(id);
  units.push({ id, apiName: c.apiName, name: c.name, cost: c.cost, traits: c.traits, img: asset(c.squareIcon) });
}
units.sort((a, b) => a.cost - b.cost || a.id.localeCompare(b.id));

// ---- 아이템: 재료 2개 조합식만, 조합식당 1개(먼저 나온 것 우선).
const items = [];
const seenRecipe = new Set();
for (const it of data.items) {
  const isCore = /^TFT_Item_[A-Za-z]+$/.test(it.apiName) && !/Corrupted/.test(it.apiName);
  const isEmblem = new RegExp(`^TFT${SET}_Item_[A-Za-z]+EmblemItem$`).test(it.apiName); // 세트 상징 (뒤집개/후라이팬 조합)
  if (!isCore && !isEmblem) continue;
  if (it.composition?.length !== 2 || !it.composition.every((c) => COMPONENT[c])) continue;
  const recipe = it.composition.map((c) => COMPONENT[c]).sort();
  const key = recipe.join("+");
  if (seenRecipe.has(key)) continue;
  seenRecipe.add(key);
  const id = it.apiName.replace(/^TFT\d*_Item_/, "").replace(/EmblemItem$/, "emblem").toLowerCase();
  items.push({ id, name: it.name, recipe, img: asset(it.icon) });
}
items.sort((a, b) => a.recipe.join().localeCompare(b.recipe.join()));

// ---- 특성: apiName → { name, img, breakpoints(활성 인원), styles } — 덱 이름 변환 + 시너지 아이콘/단계 표시용
const traits = Object.fromEntries(set.traits.map((t) => [t.apiName, {
  name: t.name,
  img: asset(t.icon),
  breakpoints: t.effects.map((e) => e.minUnits).filter((n) => n != null).sort((a, b) => a - b),
}]));

// ---- 증강: 세트 증강 목록 → 이름/아이콘/설명 (변수는 N으로, 태그 제거)
const augSet = new Set(set.augments);
const augments = {};
for (const it of data.items) {
  if (!augSet.has(it.apiName) || augments[it.apiName] || !it.icon) continue;
  augments[it.apiName] = {
    name: it.name,
    img: asset(it.icon),
    desc: (it.desc ?? "").replace(/<[^>]+>/g, " ").replace(/@[^@]+@/g, "N").replace(/\s+/g, " ").trim(),
  };
}
writeFileSync("lib/gen/augments.json", JSON.stringify(augments, null, 2) + "\n");

writeFileSync("lib/gen/traits.json", JSON.stringify(traits, null, 2) + "\n");
writeFileSync("lib/gen/units.json", JSON.stringify(units, null, 2) + "\n");
writeFileSync("lib/gen/items.json", JSON.stringify(items, null, 2) + "\n");
const prevMeta = (() => { try { return JSON.parse(readFileSync("lib/gen/meta.json", "utf8")); } catch { return {}; } })();
writeFileSync("lib/gen/meta.json", JSON.stringify({ ...prevMeta, patch, set: SET, syncedAt: new Date().toISOString().slice(0, 10) }, null, 2) + "\n");
console.log(`patch=${patch} set=${SET}: ${units.length} units, ${items.length} items, ${Object.keys(augments).length} augments`);

