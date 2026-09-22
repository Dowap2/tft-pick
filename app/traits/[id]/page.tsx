import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TRAITS, UNITS, activeTraits, traitImgByApi } from "@/lib/data";
import { getDecks } from "@/lib/decks";
import { COST_TEXT, DeckTags, TierBadge, UnitIcon } from "@/app/icons";
import { Breadcrumbs, JsonLd, KW, SITE } from "@/app/seo";
import { withJosa } from "@/lib/josa";
import { describeTrait } from "@/lib/describe";

export const dynamicParams = false;
const all = () => Object.values(TRAITS).filter((t) => UNITS.some((u) => u.traits.includes(t.name)));
export async function generateStaticParams() { return all().map((t) => ({ id: t.id.toLowerCase() })); }
const find = (id: string) => all().find((t) => t.id.toLowerCase() === id);

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const t = find((await params).id);
  if (!t) return { title: "시너지" };
  const units = UNITS.filter((u) => u.traits.includes(t.name)).sort((a, b) => a.cost - b.cost);
  const title = `${KW.a} ${t.name} 시너지 — 기물 ${units.length}명, 활성 ${t.breakpoints.join("/")}`;
  const description = `${KW.b} ${KW.season} ${t.name} 시너지 정리: ${t.breakpoints.join("/")}명 활성, 보유 기물 ${units.map((u) => u.name).join(", ")}. ${withJosa(t.name, "을를")} 쓰는 메타 덱과 조합.`;
  return { title, description, alternates: { canonical: `/traits/${t.id.toLowerCase()}` }, openGraph: { title, description } };
}

export default async function TraitPage({ params }: { params: Promise<{ id: string }> }) {
  const t = find((await params).id);
  if (!t) notFound();
  const units = UNITS.filter((u) => u.traits.includes(t.name)).sort((a, b) => a.cost - b.cost);
  const decks = (await getDecks()).map((d) => ({ d, a: activeTraits(d.coreUnits.map((u) => u.unitId)).find((x) => x.name === t.name) })).filter((x) => x.a).sort((x, y) => x.d.avgPlacement - y.d.avgPlacement);

  return (
    <main className="w-full max-w-3xl px-4 py-8 sm:py-10">
      <Breadcrumbs items={[{ name: "시너지", href: "/traits" }, { name: t.name, href: `/traits/${t.id.toLowerCase()}` }]} />
      <header className="mb-6 flex items-center gap-4">
        <span className="flex size-14 items-center justify-center rounded-lg bg-surface-2"><img src={traitImgByApi(t.id)} alt="" className="size-8 brightness-0 invert" /></span>
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">{t.name}</h1>
          <p className="mt-1 text-sm text-muted">활성 단계 <span className="num text-text">{t.breakpoints.join(" / ")}</span> · 기물 {units.length}명</p>
        </div>
      </header>

      <p className="mb-6 text-sm leading-6 text-text/90">
        {KW.b} {KW.season} <strong>{t.name}</strong> 시너지는 {t.breakpoints[0]}명부터 활성되며 {t.breakpoints.slice(1).map((b) => `${b}명`).join(", ")}에서 단계가 오릅니다.
        기물은 {units.map((u) => `${u.name}(${u.cost}코)`).join(", ")}입니다.
        {decks.length > 0 && <> 대표 덱은 <Link href={`/deck/${decks[0].d.id}`} className="text-accent hover:underline">{decks[0].d.name}</Link>({decks[0].a!.count}{t.name}, 평균 {decks[0].d.avgPlacement.toFixed(2)}등)입니다.</>}
      </p>
      {describeTrait(t, decks.map((x) => ({ d: x.d, count: x.a!.count }))).map((txt, i) => (
        <p key={i} className="mb-3 text-sm leading-6 text-text/90">{txt}</p>
      ))}

      <section className="mb-6">
        <h2 className="mb-2 text-lg font-semibold">{t.name} 기물</h2>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {units.map((u) => (
            <Link key={u.id} href={`/champions/${u.id}`} className="panel flex flex-col items-center rounded-lg bg-surface p-2 hover:border-accent/60">
              <UnitIcon id={u.id} size="md" />
              <span className="mt-1 text-xs font-medium">{u.name}</span>
              <span className={`num text-[10px] ${COST_TEXT[u.cost]}`}>{u.cost}코</span>
              <span className="text-[10px] text-muted">{u.traits.filter((x) => x !== t.name).join(" · ")}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-lg font-semibold">{withJosa(t.name, "을를")} 쓰는 덱</h2>
        {decks.length ? (
          <div className="panel divide-y divide-line rounded-xl bg-surface">
            {decks.map(({ d, a }) => (
              <Link key={d.id} href={`/deck/${d.id}`} className="flex flex-wrap items-center gap-2 px-3 py-2.5 text-sm hover:bg-surface-2">
                <TierBadge tier={d.tierLabel} /><span className="font-medium">{d.name}</span>
                <span className="num rounded bg-surface-2 px-1.5 text-[10px] text-muted">{t.name} {a!.count}</span>
                <DeckTags deck={d} />
                <span className="ml-auto num text-muted">평균 {d.avgPlacement.toFixed(2)}등</span>
              </Link>
            ))}
          </div>
        ) : <p className="text-sm text-muted">현재 상위 티어 덱 중 활성화하는 덱이 없습니다.</p>}
      </section>
      <p className="text-xs text-muted"><Link href="/traits" className="hover:text-text">전체 시너지 →</Link></p>

      <JsonLd data={{
        "@context": "https://schema.org", "@type": "Article", headline: `${KW.b} ${t.name} 시너지 기물·덱`, inLanguage: "ko",
        url: `${SITE}/traits/${t.id.toLowerCase()}`, dateModified: new Date().toISOString().slice(0, 10), author: { "@type": "Organization", name: "TFT PICK" },
      }} />
    </main>
  );
}
