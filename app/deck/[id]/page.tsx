import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { deckById, unitById } from "@/lib/data";
import { getDecks } from "@/lib/decks";
import { DeckAugments, DeckCounters, DeckProComps, DeckTrends } from "@/app/deck-extras";
import { DeckInteractive } from "./deck-interactive";
import { describeDeck } from "@/lib/describe";
import { Breadcrumbs, JsonLd, KW, SITE } from "@/app/seo";

// 빌드 타임에 덱별 정적 페이지 생성 (output: export → 요청 시 렌더 없음. 새 덱은 재배포 때 반영)
export const dynamicParams = false;
export async function generateStaticParams() {
  return (await getDecks()).map((d) => ({ id: d.id }));
}

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const deck = deckById((await params).id, await getDecks());
  if (!deck) return { title: "덱을 찾을 수 없음" };
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
  if (!deck) notFound();

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
