// SEO 공용: JSON-LD 삽입, 브레드크럼(내부 링크 + BreadcrumbList 구조화 데이터), 키워드 상수
import Link from "next/link";
import meta from "@/lib/gen/meta.json";

export const SITE = "https://panlab.lol";
export const SEASON = `시즌 ${meta.set}`;
/** 한국 검색어 변형 — 제목·설명에 섞어 씀 */
export const KW = { a: "롤체", b: "롤토체스", c: "TFT", season: SEASON };

export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}

export type Crumb = { name: string; href: string };
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  const all: Crumb[] = [{ name: "홈", href: "/" }, ...items];
  return (
    <>
      <nav aria-label="breadcrumb" className="mb-4 text-xs text-muted">
        <ol className="flex flex-wrap items-center gap-1">
          {all.map((c, i) => (
            <li key={c.href} className="flex items-center gap-1">
              {i > 0 && <span className="text-muted/50">›</span>}
              {i === all.length - 1 ? <span className="text-text/80">{c.name}</span> : <Link href={c.href} className="hover:text-text">{c.name}</Link>}
            </li>
          ))}
        </ol>
      </nav>
      <JsonLd data={{
        "@context": "https://schema.org", "@type": "BreadcrumbList",
        itemListElement: all.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: `${SITE}${c.href}` })),
      }} />
    </>
  );
}

/** 사이트 공통 구조화 데이터 (layout 에서 1회) */
export function SiteJsonLd() {
  return (
    <JsonLd data={[
      { "@context": "https://schema.org", "@type": "WebSite", name: "TFT PICK", alternateName: ["팬랩", "panlab", "롤체 덱 추천"], url: SITE, inLanguage: "ko" },
      { "@context": "https://schema.org", "@type": "Organization", name: "TFT PICK", url: SITE, logo: `${SITE}/icon-512.png` },
    ]} />
  );
}
