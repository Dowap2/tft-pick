import type { MetadataRoute } from "next";
import { getDecks } from "@/lib/decks";
import meta from "@/lib/gen/meta.json";
import { SITE_URL } from "./layout";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const DECKS = await getDecks();
  const lastModified = new Date(meta.metaUpdated ?? meta.syncedAt);
  return [
    { url: SITE_URL, lastModified, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/decks`, lastModified, changeFrequency: "weekly", priority: 0.9 },
    ...["champions", "items", "traits", "augments"].map((p) => ({ url: `${SITE_URL}/${p}`, lastModified, changeFrequency: "weekly" as const, priority: 0.7 })),
    ...DECKS.map((d) => ({
      url: `${SITE_URL}/deck/${d.id}`,
      lastModified,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
