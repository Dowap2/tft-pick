// lib/gen/*.json (cdragon 스냅샷) → public.traits / units / unit_traits / items  (현재 패치)
// 실행: node --env-file=.env.local scripts/seed-master.mjs
import { readFileSync } from "node:fs";
import { upsert, currentPatch } from "./db.mjs";

const J = (p) => JSON.parse(readFileSync(p, "utf8"));
const units = J("lib/gen/units.json"), items = J("lib/gen/items.json"), traits = J("lib/gen/traits.json"), codes = J("lib/gen/codes.json").codes;
const patch = await currentPatch();
const pid = patch.id;
console.log(`패치 ${patch.version} (id ${pid})`);

const traitRows = Object.entries(traits).map(([id, t]) => ({ id, patch_id: pid, name: t.name, img: t.img, breakpoints: t.breakpoints }));
await upsert("traits", traitRows, "id,patch_id");
console.log(`traits ${traitRows.length}`);

const unitRows = units.map((u) => ({ id: u.id, patch_id: pid, api_name: u.apiName, name: u.name, cost: u.cost, img: u.img, planner_code: codes[u.id] ?? null }));
await upsert("units", unitRows, "id,patch_id");
console.log(`units ${unitRows.length}`);

const traitByName = new Map(Object.entries(traits).map(([id, t]) => [t.name, id]));
const utRows = units.flatMap((u) => u.traits.map((n) => traitByName.get(n)).filter(Boolean).map((trait_id) => ({ unit_id: u.id, trait_id, patch_id: pid })));
await upsert("unit_traits", utRows, "unit_id,trait_id,patch_id");
console.log(`unit_traits ${utRows.length}`);

const COMPONENTS = [
  ["bf", "TFT_Item_BFSword", "BF 대검"], ["bow", "TFT_Item_RecurveBow", "곡궁"], ["rod", "TFT_Item_NeedlesslyLargeRod", "쓸데없이 큰 지팡이"],
  ["tear", "TFT_Item_TearOfTheGoddess", "여신의 눈물"], ["vest", "TFT_Item_ChainVest", "쇠사슬 조끼"], ["cloak", "TFT_Item_NegatronCloak", "음전자 망토"],
  ["belt", "TFT_Item_GiantsBelt", "거인의 허리띠"], ["gloves", "TFT_Item_SparringGloves", "연습용 장갑"], ["spatula", "TFT_Item_Spatula", "뒤집개"], ["pan", "TFT_Item_FryingPan", "후라이팬"],
];
const itemRows = [
  ...COMPONENTS.map(([id, api_name, name]) => ({ id, patch_id: pid, api_name, name, kind: "component", recipe: null, img: null })),
  ...items.map((i) => ({ id: i.id, patch_id: pid, api_name: "TFT_Item_" + i.id, name: i.name, kind: i.id.endsWith("emblem") ? "emblem" : "completed", recipe: i.recipe, img: i.img })),
];
await upsert("items", itemRows, "id,patch_id");
console.log(`items ${itemRows.length}`);
