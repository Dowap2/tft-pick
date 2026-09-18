import type { MetadataRoute } from "next";
export const dynamic = "force-static";
import { SITE_URL } from "./layout";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: "/recommend" },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
