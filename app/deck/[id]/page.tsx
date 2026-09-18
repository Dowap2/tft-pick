import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { deckById, unitById } from "@/lib/data";
import { getDecks } from "@/lib/decks";
import { DeckAugments, DeckCounters, DeckProComps, DeckTrends } from "@/app/deck-extras";
import { DeckInteractive } from "./deck-interactive";

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
  const description = `${deck.tierLabel}티어 · 평균 ${deck.avgPlacement.toFixed(2)}등${carry ? ` · 메인 캐리 ${carry}` : ""}. 최종 조합: ${units}. 레벨별 조합과 아이템, 배치도까지.`;
  return {
    title: `${deck.name} 덱 조합·아이템·배치`,
    description,
    alternates: { canonical: `/deck/${deck.id}` },
    openGraph: { title: `${deck.name} 덱 | TFT PICK`, description },
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
      <DeckInteractive deck={slim} extras={extras} />
      <div className="mt-8">
        <Link href="/" className="inline-block rounded-lg border border-line px-4 py-2 text-sm hover:bg-surface-2">
          처음으로
        </Link>
      </div>
    </main>
  );
}
