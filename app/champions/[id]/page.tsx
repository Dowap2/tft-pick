import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UNITS, ITEMS, unitById, itemById, traitByName, traitImgByApi, unitUsage, type Deck } from "@/lib/data";
import { getDecks } from "@/lib/decks";
import { COST_TEXT, DeckTags, ItemIcon, TierBadge, UnitIcon } from "@/app/icons";
import { Breadcrumbs, JsonLd, KW, SITE } from "@/app/seo";

export const dynamicParams = false;
export async function generateStaticParams() { return UNITS.map((u) => ({ id: u.id })); }

const COST_NAME: Record<number, string> = { 1: "1코스트", 2: "2코스트", 3: "3코스트", 4: "4코스트", 5: "5코스트" };

/** 이 유닛과 같은 덱에 자주 같이 들어가는 유닛 (등장 덱 수 기준) */
function partners(unitId: string, decks: Deck[]) {
  const c = new Map<string, number>();
  for (const d of decks) if (d.coreUnits.some((u) => u.unitId === unitId)) for (const u of d.coreUnits) if (u.unitId !== unitId) c.set(u.unitId, (c.get(u.unitId) ?? 0) + 1);
  return [...c].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id, n]) => ({ id, n }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const u = unitById((await params).id);
  if (!u) return { title: "챔피언" };
  const decks = await getDecks();
  const use = unitUsage(u.id, decks);
  const items = use.items.slice(0, 3).map((i) => itemById(i)?.name).filter(Boolean).join(", ");
  const title = `${KW.a} ${u.name} 추천 아이템·시너지·덱 (${COST_NAME[u.cost]})`;
  const description = `${KW.b} ${KW.season} ${u.name}: ${COST_NAME[u.cost]}, 시너지 ${u.traits.join("·")}. 추천 아이템 ${items || "데이터 수집 중"}. ${u.name}이(가) 들어가는 메타 덱 ${use.decks.length}개와 캐리로 쓰는 덱, 같이 쓰는 기물까지.`;
  return { title, description, alternates: { canonical: `/champions/${u.id}` }, openGraph: { title, description, images: [`/img/units/${u.id}.webp`] } };
}

export default async function ChampionPage({ params }: { params: Promise<{ id: string }> }) {
  const u = unitById((await params).id);
  if (!u) notFound();
  const decks = await getDecks();
  const use = unitUsage(u.id, decks);
  const mates = partners(u.id, decks);
  const bestAvg = use.decks[0]?.avgPlacement;

  return (
    <main className="w-full max-w-3xl px-4 py-8 sm:py-10">
      <Breadcrumbs items={[{ name: "챔피언", href: "/champions" }, { name: u.name, href: `/champions/${u.id}` }]} />
      <header className="mb-6 flex items-center gap-4">
        <UnitIcon id={u.id} size="lg" />
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">{u.name} <span className={`num text-base ${COST_TEXT[u.cost]}`}>{u.cost}코</span></h1>
          <p className="mt-1 flex flex-wrap gap-2 text-sm text-muted">
            {u.traits.map((t) => {
              const tr = traitByName(t);
              return tr ? <Link key={t} href={`/traits/${tr.id.toLowerCase()}`} className="flex items-center gap-1 hover:text-text"><img src={traitImgByApi(tr.id)} alt="" className="size-3.5 brightness-0 invert" />{t}</Link> : <span key={t}>{t}</span>;
            })}
          </p>
        </div>
      </header>

      <p className="mb-6 text-sm leading-6 text-text/90">
        {KW.b} {KW.season} <strong>{u.name}</strong>은(는) {COST_NAME[u.cost]} 기물로 {u.traits.join(", ")} 시너지를 가집니다.
        현재 메타에서는 {use.decks.length > 0 ? <>{use.decks.length}개 덱의 최종 조합에 들어가며{use.carryOf.length > 0 && <>, 그중 {use.carryOf.length}개 덱에서 메인 캐리</>}입니다. 가장 성적이 좋은 덱은 <Link href={`/deck/${use.decks[0].id}`} className="text-accent hover:underline">{use.decks[0].name}</Link>(평균 {bestAvg?.toFixed(2)}등)입니다.</> : <>상위 티어 덱의 최종 조합에는 잘 쓰이지 않습니다.</>}
      </p>

      <section className="mb-6">
        <h2 className="mb-2 text-lg font-semibold">추천 아이템</h2>
        {use.items.length ? (
          <div className="flex flex-wrap gap-2">
            {use.items.slice(0, 6).map((iid, i) => (
              <Link key={iid} href={`/items/${iid}`} className="panel flex items-center gap-2 rounded-lg bg-surface px-2 py-1.5 text-sm hover:border-accent/60">
                <span className="num w-4 text-xs text-muted">{i + 1}</span><ItemIcon id={iid} /> {itemById(iid)?.name}
              </Link>
            ))}
          </div>
        ) : <p className="text-sm text-muted">메타 덱에서 이 기물에 아이템을 몰아주는 경우가 없습니다 (아이템 없이 시너지용으로 쓰임).</p>}
      </section>

      {mates.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-lg font-semibold">같이 쓰는 기물</h2>
          <div className="flex flex-wrap gap-1.5">
            {mates.map((m) => (
              <Link key={m.id} href={`/champions/${m.id}`} title={`${unitById(m.id)?.name} · ${m.n}개 덱`} className="flex flex-col items-center">
                <UnitIcon id={m.id} size="md" />
                <span className="w-14 truncate text-center text-[10px] text-muted">{unitById(m.id)?.name}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mb-6">
        <h2 className="mb-2 text-lg font-semibold">{u.name}이(가) 들어가는 덱</h2>
        {use.decks.length ? (
          <div className="panel divide-y divide-line rounded-xl bg-surface">
            {use.decks.map((d) => (
              <Link key={d.id} href={`/deck/${d.id}`} className="flex flex-wrap items-center gap-2 px-3 py-2.5 text-sm hover:bg-surface-2">
                <TierBadge tier={d.tierLabel} /><span className="font-medium">{d.name}</span>
                {d.carryId === u.id && <span className="num rounded bg-accent px-1 text-[9px] text-white">CARRY</span>}
                <DeckTags deck={d} />
                <span className="ml-auto num text-muted">평균 {d.avgPlacement.toFixed(2)}등</span>
              </Link>
            ))}
          </div>
        ) : <p className="text-sm text-muted">현재 상위 티어 덱 중 최종 조합에 포함되는 덱이 없습니다.</p>}
      </section>

      <p className="text-xs text-muted">코스트별 다른 기물: {UNITS.filter((x) => x.cost === u.cost && x.id !== u.id).slice(0, 8).map((x, i) => <span key={x.id}>{i > 0 && " · "}<Link href={`/champions/${x.id}`} className="hover:text-text">{x.name}</Link></span>)}</p>

      <JsonLd data={{
        "@context": "https://schema.org", "@type": "Article",
        headline: `${KW.b} ${u.name} 추천 아이템·시너지·덱`, inLanguage: "ko", url: `${SITE}/champions/${u.id}`, image: `${SITE}/img/units/${u.id}.webp`,
        dateModified: new Date().toISOString().slice(0, 10), author: { "@type": "Organization", name: "TFT PICK" },
        about: { "@type": "VideoGameCharacter", name: u.name },
      }} />
    </main>
  );
}
