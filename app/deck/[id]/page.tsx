import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { deckById, unitById } from "@/lib/data";
import { getDecks, getRetiredDecks, getEditorialDecks, type RetiredDeck, type EditorialDeck } from "@/lib/decks";
import { ItemIcon, UnitIcon } from "@/app/icons";
import { DeckAugments, DeckCounters, DeckProComps, DeckTrends } from "@/app/deck-extras";
import { DeckInteractive } from "./deck-interactive";
import { describeDeck } from "@/lib/describe";
import { Breadcrumbs, JsonLd, KW, SITE } from "@/app/seo";
import { josa, withJosa } from "@/lib/josa";

// 빌드 타임에 덱별 정적 페이지 생성 (output: export → 요청 시 렌더 없음. 새 덱은 재배포 때 반영)
export const dynamicParams = false;
export async function generateStaticParams() {
  // 라이브 덱 + 내려간 덱. 후자는 예전 링크를 404 로 만들지 않기 위한 것뿐이다.
  const [live, retired, editorial] = await Promise.all([getDecks(), getRetiredDecks(), getEditorialDecks()]);
  return [...live, ...retired, ...editorial].map((d) => ({ id: d.id }));
}

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const id = (await params).id;
  const deck = deckById(id, await getDecks());
  if (!deck) {
    const ed = (await getEditorialDecks()).find((x) => x.id === id);
    if (ed) {
      const units = ed.units.map((u) => unitById(u.unitId)?.name).filter(Boolean).join(", ");
      const description = `${ed.playstyle ?? `${ed.name} 공략`} 조합: ${units}.${ed.levelling ? ` 레벨링 ${ed.levelling}.` : ""} 에디터가 직접 구성한 덱으로, 자동 집계 티어와는 별개입니다.`;
      return {
        title: `롤체 ${ed.name} 덱 공략`, description, alternates: { canonical: `/deck/${ed.id}` },
        // OG 이미지는 통계 덱만 생성된다 (opengraph-image.tsx) → 루트 이미지를 명시적으로 건다
        openGraph: { title: `${ed.name} 덱 | 롤체 ${KW.season}`, description, images: [{ url: "/opengraph-image.png", width: 1200, height: 630 }] },
        twitter: { card: "summary_large_image", title: `${ed.name} 덱`, description, images: ["/opengraph-image.png"] },
      };
    }
    const r = (await getRetiredDecks()).find((x) => x.id === id);
    if (!r) return { title: "덱을 찾을 수 없음" };
    // 티어를 주장하지 않는다 — 자격에서 떨어진 덱이다. OG 이미지도 라이브 덱만 생성되므로
    // (opengraph-image.tsx) 여기선 걸지 않고 루트 이미지를 쓴다.
    const stat = r.games && r.avgPlacement ? ` 마지막 집계는 ${r.games.toLocaleString()}판 평균 ${r.avgPlacement.toFixed(2)}등이었습니다.` : "";
    // openGraph.images 를 반드시 덮어쓴다: 같은 세그먼트의 opengraph-image.tsx 가 파일 컨벤션으로
    // 모든 페이지에 자동 부착되는데, 그 라우트는 라이브 덱만 생성하므로 은퇴 덱은 og:image 가 404 다.
    const og = { title: `${r.name} 덱 (내려감)`, description: `${withJosa(r.name, "은는")} 현재 티어 리스트에서 내려갔습니다.`, images: [{ url: "/opengraph-image.png", width: 1200, height: 630 }] };
    return {
      title: `롤체 ${r.name} 덱 (내려감)`,
      description: `${withJosa(r.name, "은는")} 현재 티어 리스트에서 내려갔습니다.${stat} 지금 올라와 있는 덱과 비슷한 대안을 함께 보여줍니다.`,
      alternates: { canonical: `/deck/${r.id}` },
      openGraph: og,
      twitter: { card: "summary_large_image", title: og.title, description: og.description, images: ["/opengraph-image.png"] },
    };
  }
  const units = deck.coreUnits.map((u) => unitById(u.unitId)?.name).filter(Boolean).join(", ");
  const carry = unitById(deck.carryId ?? "")?.name;
  const description = `${describeDeck(deck)[0]} 최종 조합: ${units}. ${deck.tierLabel}티어 · 평균 ${deck.avgPlacement.toFixed(2)}등${carry ? ` · 메인 캐리 ${carry}` : ""}.`;
  return {
    title: `롤체 ${deck.name} 덱 조합 (${deck.tierLabel}티어)`,
    description,
    alternates: { canonical: `/deck/${deck.id}` },
    // opengraph-image.tsx 가 만든 덱별 이미지를 명시적으로 건다.
    // generateMetadata 에서 openGraph 를 직접 주면 파일 컨벤션 이미지가 상속되지 않고 루트 것이 쓰인다.
    openGraph: { title: `${deck.name} 덱 | 롤체 ${KW.season} 덱 추천`, description, type: "article", images: [{ url: `/deck/${deck.id}/opengraph-image`, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title: `${deck.name} 덱`, description, images: [`/deck/${deck.id}/opengraph-image`] },
  };
}

export default async function DeckDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const decks = await getDecks();
  const deck = deckById(id, decks);
  if (!deck) {
    const ed = (await getEditorialDecks()).find((x) => x.id === id);
    if (ed) return <EditorialDeckPage d={ed} />;
    const r = (await getRetiredDecks()).find((x) => x.id === id);
    if (!r) notFound();
    return <RetiredDeckPage r={r} decks={decks} />;
  }

  // 상호작용 부분(보유 토글·점수)은 클라이언트, 통계성 섹션은 서버에서 렌더해 슬롯으로 전달
  const extras = (
    <>
      <DeckProComps deck={deck} />
      <DeckAugments deck={deck} />
      <DeckCounters deck={deck} decks={decks} />
      <DeckTrends deck={deck} />
    </>
  );
  // 클라이언트로 넘기는 덱은 큰 필드 제외
  const { proComps: _p, augments: _a, trends: _t, ...slim } = deck;

  return (
    <main className="w-full max-w-3xl px-4 py-8 sm:py-12">
      <Breadcrumbs items={[{ name: "덱 티어 리스트", href: "/decks" }, { name: deck.name, href: `/deck/${deck.id}` }]} />
      <JsonLd data={{
        "@context": "https://schema.org", "@type": "Article",
        headline: `${KW.b} ${KW.season} ${deck.name} 덱 조합·아이템·배치`, description: describeDeck(deck)[0], inLanguage: "ko",
        url: `${SITE}/deck/${deck.id}`, image: `${SITE}/img/units/${deck.carryId ?? deck.coreUnits[0]?.unitId}.webp`,
        dateModified: new Date().toISOString().slice(0, 10), author: { "@type": "Organization", name: "TFT PICK", url: SITE },
        about: deck.coreUnits.map((u) => ({ "@type": "VideoGameCharacter", name: unitById(u.unitId)?.name })),
      }} />
      <DeckInteractive deck={slim} extras={extras} guide={describeDeck(deck)} />
      <div className="mt-8">
        <Link href="/" className="inline-block rounded-lg border border-line px-4 py-2 text-sm hover:bg-surface-2">
          처음으로
        </Link>
      </div>
    </main>
  );
}

/** 내려간 덱: 404 대신 "무슨 덱이었는지 + 마지막 성적 + 지금 갈 만한 대안". 같은 특성+캐리
 *  조합이 다시 자격을 통과하면 id 가 같으므로 이 페이지가 그대로 원래 덱 페이지로 돌아온다. */
function RetiredDeckPage({ r, decks }: { r: RetiredDeck; decks: Awaited<ReturnType<typeof getDecks>> }) {
  const carryName = unitById(r.carryId ?? "")?.name;
  const traitSlug = r.id.split("-")[0];
  // 대안: 같은 캐리를 쓰는 현재 덱 → 없으면 같은 특성 계열 → 없으면 상위 티어 3개
  const sameCarry = decks.filter((d) => r.carryId && d.carryId === r.carryId);
  const sameTrait = decks.filter((d) => d.id.startsWith(`${traitSlug}-`));
  const alts = (sameCarry.length ? sameCarry : sameTrait.length ? sameTrait : decks).slice(0, 3);
  const altReason = sameCarry.length ? `${carryName} 캐리를 쓰는` : sameTrait.length ? "같은 시너지 계열의" : "현재 성적이 가장 좋은";

  return (
    <main className="w-full max-w-3xl px-4 py-8 sm:py-12">
      <Breadcrumbs items={[{ name: "덱 티어 리스트", href: "/decks" }, { name: r.name, href: `/deck/${r.id}` }]} />

      <header className="mb-4">
        <span className="num rounded border border-line px-1.5 py-px text-[10px] uppercase text-muted">내려간 덱</span>
        <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{r.name}</h1>
      </header>

      <div className="panel mb-6 rounded-xl bg-surface p-4 text-sm leading-6">
        <p>
          <strong>{r.name}</strong>{josa(r.name, "은는")} 현재 티어 리스트에 없습니다. 최근 7일 표본이 자격 기준
          (100판 이상 · 평균 4.75등 미만)에 못 미쳐 목록에서 내려갔습니다.
        </p>
        {r.games != null && r.avgPlacement != null && (
          <p className="mt-2 text-muted">
            마지막 집계: <span className="num text-text">{r.games.toLocaleString()}판</span> · 평균{" "}
            <span className="num text-text">{r.avgPlacement.toFixed(2)}등</span>
            {r.top4Rate != null && <> · Top4 <span className="num text-text">{(r.top4Rate * 100).toFixed(1)}%</span></>}
            {r.winRate != null && <> · 1등 <span className="num text-text">{(r.winRate * 100).toFixed(1)}%</span></>}
            {r.levelling && <> · {r.levelling}</>}
          </p>
        )}
        <p className="mt-2 text-muted">같은 조합이 다시 올라오면 이 주소에서 그대로 볼 수 있습니다.</p>
      </div>

      <section className="mb-6">
        <h2 className="mb-2 text-lg font-semibold">마지막 최종 조합</h2>
        <div className="flex flex-wrap gap-2">
          {r.units.map((u) => (
            <Link key={u.unitId} href={`/champions/${u.unitId}`} className="flex flex-col items-center">
              <UnitIcon id={u.unitId} size="md" carry={u.unitId === r.carryId} />
              <span className="w-14 truncate text-center text-[10px] text-muted">{unitById(u.unitId)?.name}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-lg font-semibold">지금 갈 수 있는 덱</h2>
        <p className="mb-2 text-sm text-muted">{altReason} 덱입니다.</p>
        <div className="panel divide-y divide-line rounded-xl bg-surface">
          {alts.map((d) => (
            <Link key={d.id} href={`/deck/${d.id}`} className="flex flex-wrap items-center gap-2 px-3 py-2.5 text-sm hover:bg-surface-2">
              <span className="num rounded bg-surface-2 px-1.5 py-px text-[10px]">{d.tierLabel}</span>
              <span className="font-medium">{d.name}</span>
              <span className="num ml-auto text-muted">평균 {d.avgPlacement.toFixed(2)}등</span>
            </Link>
          ))}
        </div>
      </section>

      <Link href="/decks" className="inline-block rounded-lg border border-line px-4 py-2 text-sm hover:bg-surface-2">
        전체 덱 티어 리스트
      </Link>
    </main>
  );
}

/** 에디터 덱: 사람이 만든 덱. 통계 덱과 같은 화면을 쓰지 않는다 — 티어·평균 등수·표본이 없고,
 *  있는 척하면 "자체 수집 통계" 라는 설명과 모순된다. 무엇을 보고 만들었는지만 정직하게 보여준다. */
function EditorialDeckPage({ d }: { d: EditorialDeck }) {
  const itemsOf = (unitId: string) => d.items.filter((i) => i.unitId === unitId).sort((a, b) => a.priority - b.priority);
  const levels = Object.entries(d.levels).sort((a, b) => Number(a[0]) - Number(b[0]));

  return (
    <main className="w-full max-w-3xl px-4 py-8 sm:py-12">
      <Breadcrumbs items={[{ name: "덱 티어 리스트", href: "/decks" }, { name: d.name, href: `/deck/${d.id}` }]} />
      <header className="mb-4">
        <span className="num rounded border border-accent/50 px-1.5 py-px text-[10px] uppercase text-accent">에디터 추천</span>
        <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{d.name}</h1>
        <p className="mt-1 text-xs text-muted">
          직접 구성한 덱입니다. 자동 집계 티어(OP~D)와 평균 등수는 붙지 않습니다 —
          <Link href="/decks" className="ml-1 text-accent hover:underline">통계 기반 티어 리스트</Link>
        </p>
      </header>

      {d.playstyle && <p className="panel mb-6 rounded-xl bg-surface p-4 text-sm leading-6">{d.playstyle}</p>}

      <section className="mb-6">
        <h2 className="mb-2 text-lg font-semibold">최종 조합</h2>
        <div className="flex flex-wrap gap-2">
          {d.units.map((u) => (
            <div key={u.unitId} className="flex w-16 flex-col items-center">
              <Link href={`/champions/${u.unitId}`}>
                <UnitIcon id={u.unitId} size="md" carry={u.unitId === d.carryId} />
              </Link>
              <span className="w-full truncate text-center text-[10px] text-muted">{unitById(u.unitId)?.name}</span>
              {u.star > 1 && <span className="text-[10px] leading-none text-warn">{"★".repeat(u.star)}</span>}
              {itemsOf(u.unitId).length > 0 && (
                <span className="mt-0.5 flex gap-px">
                  {itemsOf(u.unitId).slice(0, 3).map((i) => <ItemIcon key={i.itemId} id={i.itemId} className="size-4! rounded-sm border-0" />)}
                </span>
              )}
            </div>
          ))}
        </div>
      </section>

      {levels.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-lg font-semibold">레벨별 조합</h2>
          <div className="panel divide-y divide-line rounded-xl bg-surface">
            {levels.map(([lv, v]) => (
              <div key={lv} className="flex flex-wrap items-center gap-2 px-3 py-2.5">
                <span className="num w-10 shrink-0 text-sm text-accent">{lv}렙</span>
                <div className="flex flex-wrap gap-1">
                  {v.units.map((uid) => (
                    <span key={uid} className="flex flex-col items-center">
                      <UnitIcon id={uid} size="sm" />
                      <span className="w-12 truncate text-center text-[9px] text-muted">{unitById(uid)?.name}</span>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {d.requirementNote && <p className="mb-6 text-sm text-warn">{d.requirementNote}</p>}

      <Link href="/decks" className="inline-block rounded-lg border border-line px-4 py-2 text-sm hover:bg-surface-2">
        전체 덱 티어 리스트
      </Link>
    </main>
  );
}
