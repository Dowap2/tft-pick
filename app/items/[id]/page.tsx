import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { COMPONENTS, ITEMS, itemById, unitById, componentById, type Deck } from "@/lib/data";
import { getDecks } from "@/lib/decks";
import { ItemIcon, TierBadge, UnitIcon } from "@/app/icons";
import { Breadcrumbs, JsonLd, KW, SITE } from "@/app/seo";

export const dynamicParams = false;
export async function generateStaticParams() { return ITEMS.map((i) => ({ id: i.id })); }

function users(itemId: string, decks: Deck[]) {
  const c = new Map<string, { n: number; decks: Deck[] }>();
  for (const d of decks) for (const ci of d.coreItems) if (ci.itemId === itemId) { const e = c.get(ci.unitId) ?? { n: 0, decks: [] }; e.n++; e.decks.push(d); c.set(ci.unitId, e); }
  return [...c].sort((a, b) => b[1].n - a[1].n);
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const it = itemById((await params).id);
  if (!it) return { title: "아이템" };
  const decks = await getDecks();
  const top = users(it.id, decks).slice(0, 3).map(([u]) => unitById(u)?.name).filter(Boolean).join(", ");
  const recipe = it.recipe.map((c) => componentById(c as never)?.name).join(" + ");
  const title = `${KW.a} ${it.name} 조합식·추천 챔피언`;
  const description = `${KW.b} ${KW.season} ${it.name} 조합식: ${recipe}. 메타 덱에서 ${it.name}을(를) 드는 기물 ${top || "수집 중"}. 어떤 덱에서 누구에게 주는지 한눈에.`;
  return { title, description, alternates: { canonical: `/items/${it.id}` }, openGraph: { title, description, images: [`/img/items/${it.id}.webp`] } };
}

export default async function ItemPage({ params }: { params: Promise<{ id: string }> }) {
  const it = itemById((await params).id);
  if (!it) notFound();
  const decks = await getDecks();
  const rows = users(it.id, decks);
  const [a, b] = it.recipe;
  const siblings = ITEMS.filter((x) => x.id !== it.id && (x.recipe.includes(a) || x.recipe.includes(b))).slice(0, 8);

  return (
    <main className="w-full max-w-3xl px-4 py-8 sm:py-10">
      <Breadcrumbs items={[{ name: "아이템", href: "/items" }, { name: it.name, href: `/items/${it.id}` }]} />
      <header className="mb-6 flex items-center gap-4">
        <ItemIcon id={it.id} size="lg" />
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">{it.name}</h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
            조합식 <ItemIcon id={a} className="size-5!" /> {componentById(a as never)?.name} + <ItemIcon id={b} className="size-5!" /> {componentById(b as never)?.name}
          </p>
        </div>
      </header>

      <p className="mb-6 text-sm leading-6 text-text/90">
        {KW.b} {KW.season} <strong>{it.name}</strong>은(는) {componentById(a as never)?.name}과(와) {componentById(b as never)?.name}을(를) 합쳐 만듭니다.
        {rows.length > 0
          ? <> 현재 상위 티어 덱에서는 주로 <strong>{rows.slice(0, 3).map(([u]) => unitById(u)?.name).join(", ")}</strong>에게 줍니다. 총 {new Set(rows.flatMap(([, e]) => e.decks.map((d) => d.id))).size}개 덱의 1순위 빌드에 포함됩니다.</>
          : <> 현재 상위 티어 덱의 1순위 빌드에는 잘 쓰이지 않습니다.</>}
      </p>

      <section className="mb-6">
        <h2 className="mb-2 text-lg font-semibold">이 아이템을 드는 기물</h2>
        {rows.length ? (
          <div className="panel divide-y divide-line rounded-xl bg-surface">
            {rows.map(([uid, e]) => (
              <div key={uid} className="flex flex-wrap items-center gap-2 px-3 py-2.5 text-sm">
                <Link href={`/champions/${uid}`} className="flex items-center gap-2 font-medium hover:text-accent"><UnitIcon id={uid} size="sm" />{unitById(uid)?.name}</Link>
                <span className="text-xs text-muted">{e.n}개 덱</span>
                <span className="ml-auto flex flex-wrap justify-end gap-1">
                  {e.decks.slice(0, 3).map((d) => <Link key={d.id} href={`/deck/${d.id}`} className="flex items-center gap-1 rounded-md border border-line px-1.5 py-0.5 text-[11px] text-muted hover:border-accent/60 hover:text-text"><TierBadge tier={d.tierLabel} />{d.name}</Link>)}
                </span>
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-muted">메타 덱 1순위 빌드에 없는 아이템입니다.</p>}
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-lg font-semibold">같은 재료로 만드는 아이템</h2>
        <div className="flex flex-wrap gap-2">
          {siblings.map((x) => <Link key={x.id} href={`/items/${x.id}`} className="panel flex items-center gap-2 rounded-lg bg-surface px-2 py-1.5 text-sm hover:border-accent/60"><ItemIcon id={x.id} />{x.name}</Link>)}
        </div>
      </section>
      <p className="text-xs text-muted"><Link href="/items" className="hover:text-text">전체 아이템 조합표 →</Link></p>

      <JsonLd data={{
        "@context": "https://schema.org", "@type": "Article", headline: `${KW.b} ${it.name} 조합식·추천 챔피언`, inLanguage: "ko",
        url: `${SITE}/items/${it.id}`, image: `${SITE}/img/items/${it.id}.webp`, dateModified: new Date().toISOString().slice(0, 10), author: { "@type": "Organization", name: "TFT PICK" },
      }} />
    </main>
  );
}
