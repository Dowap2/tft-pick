// CommunityDragon → lib/gen/{units,items}.json
// 사용: node scripts/sync.mjs [패치=pbe] [세트번호=18]
//   패치: pbe | latest | 16.18 같은 버전
import { writeFileSync, readFileSync } from "node:fs";

const [patch = "pbe", setArg = "18"] = process.argv.slice(2);
const SET = Number(setArg);
const CDN = `https://raw.communitydragon.org/${patch}/game/`;
const asset = (tex) => CDN + tex.toLowerCase().replace(/\.tex$/, ".png");

const COMPONENT = {
  TFT_Item_BFSword: "bf", TFT_Item_RecurveBow: "bow", TFT_Item_NeedlesslyLargeRod: "rod",
  TFT_Item_TearOfTheGoddess: "tear", TFT_Item_ChainVest: "vest", TFT_Item_NegatronCloak: "cloak",
  TFT_Item_GiantsBelt: "belt", TFT_Item_SparringGloves: "gloves", TFT_Item_Spatula: "spatula",
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
  units.push({ id, name: c.name, cost: c.cost, traits: c.traits, img: asset(c.squareIcon) });
}
units.sort((a, b) => a.cost - b.cost || a.id.localeCompare(b.id));

// ---- 아이템: 재료 2개 조합식만, 조합식당 1개(먼저 나온 것 우선).
const items = [];
const seenRecipe = new Set();
for (const it of data.items) {
  if (!/^TFT_Item_[A-Za-z]+$/.test(it.apiName) || /Corrupted/.test(it.apiName)) continue;
  if (it.composition?.length !== 2 || !it.composition.every((c) => COMPONENT[c])) continue;
  const recipe = it.composition.map((c) => COMPONENT[c]).sort();
  const key = recipe.join("+");
  if (seenRecipe.has(key)) continue;
  seenRecipe.add(key);
  items.push({ id: it.apiName.slice("TFT_Item_".length).toLowerCase(), name: it.name, recipe, img: asset(it.icon) });
}
items.sort((a, b) => a.recipe.join().localeCompare(b.recipe.join()));

writeFileSync("lib/gen/units.json", JSON.stringify(units, null, 2) + "\n");
writeFileSync("lib/gen/items.json", JSON.stringify(items, null, 2) + "\n");
writeFileSync("lib/gen/meta.json", JSON.stringify({ patch, set: SET, syncedAt: new Date().toISOString().slice(0, 10) }, null, 2) + "\n");
console.log(`patch=${patch} set=${SET}: ${units.length} units, ${items.length} items`);

// ---- 덱 데이터 검증: data.ts 안의 unitId/itemId가 전부 존재하는지
const src = readFileSync("lib/data.ts", "utf8");
const bad = [];
for (const m of src.matchAll(/unitId: "([a-z0-9_]+)"/g)) if (!seenUnit.has(m[1])) bad.push("unit:" + m[1]);
for (const m of src.matchAll(/itemId: "([a-z0-9_]+)"/g)) if (!items.some((i) => i.id === m[1])) bad.push("item:" + m[1]);
if (bad.length) {
  console.error("덱 데이터에 없는 id:", [...new Set(bad)].join(", "));
  process.exit(1);
}
