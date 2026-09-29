// Riot 매치 데이터의 아이템 이름 → 우리 item id 매핑 검증: npx tsx scripts/check-item-ids.mts
//
// 세트마다 Riot 이 내부 id 를 재사용한다. 실측: DA_RedBuff = 붉은 덩굴정령(곡궁+곡궁) 인데
// 우리 id `redbuff` 는 태양불꽃 망토(흉갑+벨트) 다. 별칭이 없으면 두 아이템이 한 id 로 뭉개지고,
// 한쪽 통계는 영영 안 잡히고 다른 쪽은 엉뚱한 이름으로 표시된다.
// 이름이 아니라 "조합식" 으로 맞춰서 전수 확인한다.
import { readFileSync } from "node:fs";
// db.mjs 는 env 없으면 process.exit 한다. riotItemId 는 순수 함수라 더미로 채우고 동적 임포트.
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://example.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "dummy";
const { riotItemId } = await import("./db.mjs");

const cd = JSON.parse(readFileSync(process.argv[2] ?? "/tmp/cd.json", "utf8")) as {
  items: { apiName: string; name: string; composition: string[] }[];
};
const ours = JSON.parse(readFileSync("lib/gen/items.json", "utf8")) as { id: string; name: string; recipe: string[] }[];
const byId = new Map(ours.map((i) => [i.id, i]));

const COMP: Record<string, string> = {
  BFSword: "bf", RecurveBow: "bow", NeedlesslyLargeRod: "rod", TearOfTheGoddess: "tear",
  ChainVest: "vest", NegatronCloak: "cloak", GiantsBelt: "belt", SparringGloves: "gloves",
  Spatula: "spatula", FryingPan: "pan",
};
const comp = (c: string) => COMP[c.replace(/^(TFT_Item_|DA_Component_)/, "")];

let failed = 0;
const rows: string[] = [];
// Riot 매치 데이터에 실제로 오는 형태(DA_*)만 본다. 재료 2개 조합식이 있는 것만.
for (const it of cd.items) {
  if (!/^DA_[A-Za-z]+$/.test(it.apiName) || /Radiant$/.test(it.apiName)) continue;
  const recipe = (it.composition ?? []).map(comp);
  if (recipe.length !== 2 || recipe.some((x) => !x)) continue;

  const id = riotItemId(it.apiName);
  const mine = id ? byId.get(id) : undefined;
  const want = [...recipe].sort().join("+");
  const got = mine ? [...mine.recipe].sort().join("+") : "(id 없음)";
  if (!mine || want !== got) {
    failed++;
    // 조합식이 같은 우리 아이템을 찾아 제안한다
    const fix = ours.find((o) => [...o.recipe].sort().join("+") === want);
    rows.push(`  ✗ ${it.apiName.padEnd(26)} ${it.name.padEnd(16)} ${want}`
      + `\n      → 현재 매핑: ${String(id).padEnd(20)} ${mine ? `${mine.name} (${got})` : "items.json 에 없음"}`
      + (fix ? `\n      → 제안: ALIAS["${it.apiName.slice(3)}"] = "${fix.id}"   (${fix.name})` : "\n      → 조합식이 같은 우리 아이템 없음"));
  }
}
console.log(rows.join("\n") || "  (불일치 없음)");
console.log(failed ? `\n✗ 매핑 불일치 ${failed}건 — 이 아이템들의 통계가 다른 아이템에 섞여 들어간다` : "\n✓ Riot 아이템 이름 → 우리 id 매핑 전부 일치");
process.exitCode = failed ? 1 : 0;
