// cdragon 원본(256px PNG, 50~60KB) → public/img/{units,items,traits}/*.webp (자체 호스팅, 모바일 체감·외부 CDN 의존 제거)
// 실행: node scripts/build-images.mjs   (npm run sync 뒤에. 이미 있는 파일은 건너뜀, --force 로 재생성)
import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const FORCE = process.argv.includes("--force");
const J = (p) => JSON.parse(readFileSync(p, "utf8"));
const units = J("lib/gen/units.json"), items = J("lib/gen/items.json"), traits = J("lib/gen/traits.json"), meta = J("lib/gen/meta.json");
const CDN = `https://raw.communitydragon.org/${meta.patch}/game/assets/maps/tft/icons/items/hexcore/tft_item_`;
const COMPONENTS = { bf: "bfsword", bow: "recurvebow", rod: "needlesslylargerod", tear: "tearofthegoddess", vest: "chainvest", cloak: "negatroncloak", belt: "giantsbelt", gloves: "sparringgloves", spatula: "spatula", pan: "fryingpan" };

// [폴더, 파일명, 원본 URL, 출력 크기]  — UnitIcon 최대 64px·배치도 48px → 2x 로 128. 아이템 48px → 96. 특성 아이콘 20px → 48
const jobs = [
  ...units.map((u) => ["units", u.id, u.img, 128]),
  ...items.map((i) => ["items", i.id, i.img, 96]),
  ...Object.entries(COMPONENTS).map(([id, f]) => ["items", id, `${CDN}${f}.png`, 96]),
  ...Object.entries(traits).map(([id, t]) => ["traits", id.toLowerCase(), t.img, 48]),
];
let done = 0, skipped = 0, failed = 0;
for (const [dir, name, url, size] of jobs) {
  const out = `public/img/${dir}/${name}.webp`;
  mkdirSync(`public/img/${dir}`, { recursive: true });
  if (!FORCE && existsSync(out)) { skipped++; continue; }
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(String(res.status));
    const buf = Buffer.from(await res.arrayBuffer());
    writeFileSync(out, await sharp(buf).resize(size, size, { fit: "cover" }).webp({ quality: 82 }).toBuffer());
    done++;
  } catch (e) { failed++; console.warn(`✗ ${dir}/${name}: ${e.message}`); }
}
console.log(`images: 생성 ${done}, 건너뜀 ${skipped}, 실패 ${failed}`);
