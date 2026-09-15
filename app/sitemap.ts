import type { MetadataRoute } from "next";
import { DECKS } from "@/lib/data";
import meta from "@/lib/gen/meta.json";
import { SITE_URL } from "./layout";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date(meta.metaUpdated ?? meta.syncedAt);
  return [
    { url: SITE_URL, lastModified, changeFrequency: "weekly", priority: 1 },
    ...DECKS.map((d) => ({
      url: `${SITE_URL}/deck/${d.id}`,
      lastModified,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
