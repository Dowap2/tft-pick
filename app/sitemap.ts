import type { MetadataRoute } from "next";
export const dynamic = "force-static";
import { getDecks } from "@/lib/decks";
import { ITEMS, TRAITS, UNITS } from "@/lib/data";
import meta from "@/lib/gen/meta.json";
import { SITE_URL } from "./layout";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const DECKS = await getDecks();
  const lastModified = new Date();   // 매일 재빌드 → 빌드 시각
  return [
    { url: SITE_URL, lastModified, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/decks`, lastModified, changeFrequency: "weekly", priority: 0.9 },
    ...["champions", "items", "traits", "augments", "about"].map((p) => ({ url: `${SITE_URL}/${p}`, lastModified, changeFrequency: "weekly" as const, priority: 0.7 })),
    ...UNITS.map((u) => ({ url: `${SITE_URL}/champions/${u.id}`, lastModified, changeFrequency: "weekly" as const, priority: 0.6 })),
    ...ITEMS.map((i) => ({ url: `${SITE_URL}/items/${i.id}`, lastModified, changeFrequency: "weekly" as const, priority: 0.5 })),
    ...Object.values(TRAITS).filter((t) => UNITS.some((u) => u.traits.includes(t.name))).map((t) => ({ url: `${SITE_URL}/traits/${t.id.toLowerCase()}`, lastModified, changeFrequency: "weekly" as const, priority: 0.5 })),
    ...DECKS.map((d) => ({
      url: `${SITE_URL}/deck/${d.id}`,
      lastModified,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
