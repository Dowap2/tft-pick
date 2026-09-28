import type { MetadataRoute } from "next";
export const dynamic = "force-static";
import { getDecks } from "@/lib/decks";
import { ITEMS, TRAITS, UNITS, activeTraits, unitUsage } from "@/lib/data";
import { SITE_URL } from "./layout";

// 얇은 페이지는 사이트맵에 넣지 않는다.
// 메타 덱에 한 번도 안 나오는 기물/아이템/시너지 페이지는 본문이 사실상 "코스트 + 시너지 이름"뿐이라
// 구글이 "크롤링됨 – 현재 색인이 생성되지 않음"으로 떨어뜨린다. 그런 URL 을 계속 제출하면
// 크롤링 예산만 잡아먹고 사이트 전체 품질 평가도 깎인다. 페이지 자체는 그대로 두고(링크로 접근 가능),
// 데이터가 붙으면 다음 빌드에서 자동으로 사이트맵에 다시 올라온다.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const DECKS = await getDecks();
  const lastModified = new Date();   // 매일 재빌드 → 빌드 시각

  // 기준은 "페이지에 실제로 덱이 보이는가" = unitUsage(최종 조합 기준)와 같아야 한다.
  // 레벨별 조합에만 등장하는 기물까지 넣었더니 8개(아칼리·티모·쉔 등)가 "들어가는 덱 0개" 를
  // 띄운 채 사이트맵에 올라가 있었다. 페이지는 그대로 두고 제출만 멈춘다.
  const usedItems = new Set(DECKS.flatMap((d) => [...d.coreItems.map((i) => i.itemId), ...Object.values(d.altItems ?? {}).flat()]));
  const usedTraits = new Set(DECKS.flatMap((d) => activeTraits(d.coreUnits.map((u) => u.unitId)).map((t) => t.name)));

  const page = (path: string, priority: number) => ({ url: `${SITE_URL}${path}`, lastModified, changeFrequency: "weekly" as const, priority });

  return [
    page("/", 1),
    page("/decks", 0.9),
    ...["champions", "items", "traits", "augments", "about"].map((p) => page(`/${p}`, 0.7)),
    ...DECKS.map((d) => page(`/deck/${d.id}`, 0.8)),
    ...UNITS.filter((u) => unitUsage(u.id, DECKS).decks.length > 0).map((u) => page(`/champions/${u.id}`, 0.6)),
    ...ITEMS.filter((i) => usedItems.has(i.id)).map((i) => page(`/items/${i.id}`, 0.5)),
    ...Object.values(TRAITS).filter((t) => usedTraits.has(t.name)).map((t) => page(`/traits/${t.id.toLowerCase()}`, 0.5)),
  ];
}
