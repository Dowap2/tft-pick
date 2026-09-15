import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { deckById, itemById, unitById } from "@/lib/data";
import { parseUserInput, buildQuery, toggleUnitQuery } from "@/lib/params";
import { scoreDeck, transitionLabel } from "@/lib/score";
import { COST_TEXT, ItemIcon, TierBadge, UnitIcon } from "@/app/icons";
import { Board } from "@/app/board";

type SP = Promise<Record<string, string | string[] | undefined>>;
type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const deck = deckById((await params).id);
  if (!deck) return { title: "덱을 찾을 수 없음" };
  const units = deck.coreUnits.map((u) => unitById(u.unitId)?.name).filter(Boolean).join(", ");
  const carry = unitById(deck.carryId ?? "")?.name;
  const description = `${deck.tierLabel}티어 · 평균 ${deck.avgPlacement.toFixed(2)}등${carry ? ` · 메인 캐리 ${carry}` : ""}. 최종 조합: ${units}. 레벨별 조합과 아이템, 배치도까지.`;
  return {
    title: `${deck.name} 덱 조합·아이템·배치`,
    description,
    alternates: { canonical: `/deck/${deck.id}` }, // 보유 유닛 쿼리는 색인에서 하나로 합침
    openGraph: { title: `${deck.name} 덱 | TFT PICK`, description },
  };
}

export default async function DeckDetailPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SP;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const deck = deckById(id);
  if (!deck) notFound();

  const input = parseUserInput(sp);
  const score = scoreDeck(input, deck);
  const q = buildQuery(input);
  const trans = transitionLabel(score);

  const carryName = unitById(score.carryId)?.name ?? score.carryId;
  const carryUnit = unitById(score.carryId);
  const userUnitIds = new Set(input.units.map((u) => u.unitId));
  // 유닛 클릭 → 보유 토글 (덱 목표 성으로 추가). URL만 바뀌고 점수/배치/레벨이 전부 다시 계산됨.
  const toggleHref = (uid: string) =>
    `/deck/${deck.id}?${toggleUnitQuery(input, uid, deck.coreUnits.find((u) => u.unitId === uid)?.star ?? 1)}`;

  // 유닛별 그룹: {unitId: [itemIds]}
  const itemsByUnit = deck.coreItems.reduce<Record<string, string[]>>((acc, ci) => {
    (acc[ci.unitId] ??= []).push(ci.itemId);
    return acc;
  }, {});

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
      <header className="mb-8">
        <Link
          href={q ? `/recommend?${q}` : "/recommend"}
          className="text-sm text-muted hover:text-gold-light"
        >
          ← 추천 결과로
        </Link>
        <div className="mt-2 flex items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-bold text-gold-light"><TierBadge tier={deck.tierLabel} size="lg" />{deck.name}</h1>
            <div className="mt-1 text-sm text-muted/80">
              {trans.emoji} {trans.text} · 평균순위 {deck.avgPlacement.toFixed(2)}
              {deck.games && <span> · {deck.games.toLocaleString()}판</span>}
            </div>
            {deck.playstyle && (
              <p className="mt-2 text-sm text-muted">{deck.playstyle}</p>
            )}
          </div>
          <div className="text-right">
            <div className="text-4xl font-bold gold-text">
              {Math.round(score.total)}%
            </div>
            <div className="text-xs text-muted/80">현재 적합도</div>
          </div>
        </div>
      </header>

      {/* 메인 캐리 */}
      <section className="mb-6 panel rounded-lg border-teal/40! bg-teal/5 p-4">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-teal">
          메인 캐리
        </div>
        <div className="flex items-center gap-3">
          <UnitIcon id={score.carryId} size="lg" />
          <div>
            <div className="text-xl font-bold text-teal">{carryName}</div>
            <div className="text-xs text-muted/80">
              <span className={COST_TEXT[carryUnit?.cost ?? 1]}>{carryUnit?.cost}코</span> · {carryUnit?.traits.join(" / ")}
            </div>
          </div>
          {score.hasCarry ? (
            <span className="ml-auto rounded bg-teal/80 px-2 py-0.5 text-xs font-medium">✓ 보유중</span>
          ) : (
            <span className="ml-auto rounded bg-panel-2 px-2 py-0.5 text-xs text-muted">확보 필요</span>
          )}
        </div>
        {score.carryItems.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {score.carryItems.map((iid, i) => {
              const buildable = score.buildableCarryItems.includes(iid);
              return (
                <span
                  key={i}
                  className={`flex items-center gap-1.5 rounded py-0.5 pl-0.5 pr-2 text-xs ${
                    buildable
                      ? "bg-teal/20 text-teal"
                      : "bg-panel-2 text-muted"
                  }`}
                >
                  <ItemIcon id={iid} />
                  {buildable && "✓ "}
                  {itemById(iid)?.name ?? iid}
                </span>
              );
            })}
          </div>
        )}
      </section>

      {/* 레벨별 조합 */}
      {deck.levels && (
        <section className="mb-6">
          <h2 className="mb-3 text-lg font-semibold">레벨별 조합</h2>
          <div className="panel divide-y divide-gold/15 rounded-lg bg-panel/70">
            {Object.entries(deck.levels).map(([lv, comp]) => (
              <div key={lv} className="flex items-center gap-3 px-3 py-2">
                <div className="w-10 shrink-0">
                  <div className="text-sm font-bold text-gold-light">{lv}렙</div>
                  <div className="text-[10px] text-muted/70">{comp.avg.toFixed(2)}등</div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {comp.units.map((uid) => (
                    <Link key={uid} href={toggleHref(uid)} replace scroll={false} title={unitById(uid)?.name}>
                      <UnitIcon id={uid} size="sm" className={`h-9! ${userUnitIds.has(uid) ? "" : "opacity-45"}`} />
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-1 text-[10px] text-muted/60">각 레벨에서 가장 많이 쓰인 조합 · 흐림 = 미보유 · 클릭하면 보유 토글</p>
        </section>
      )}

      {/* 배치도 */}
      <section className="mb-6">
        <h2 className="mb-3 text-lg font-semibold">최종 배치</h2>
        <div className="panel overflow-x-auto rounded-lg bg-panel/70 p-4">
          <Board deck={deck} carryId={score.carryId} ownedIds={userUnitIds} hrefFor={toggleHref} />
        </div>
      </section>

      {/* 필수 유닛 */}
      <section className="mb-6">
        <h2 className="mb-3 text-lg font-semibold">필수 유닛 <span className="text-xs font-normal text-muted/70">클릭하면 보유 토글</span></h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {deck.coreUnits.map((cu) => {
            const meta = unitById(cu.unitId);
            const has = userUnitIds.has(cu.unitId);
            const isCarry = cu.unitId === score.carryId;
            return (
              <Link
                key={cu.unitId}
                href={toggleHref(cu.unitId)}
                replace
                scroll={false}
                className={`block rounded-lg border p-3 transition hover:border-gold/60 ${
                  has ? "border-teal/60 bg-teal/10" : "border-gold/25 bg-panel"
                } ${isCarry ? "border-teal/60!" : ""}`}
              >
                <UnitIcon id={cu.unitId} size="lg" className="mb-2" />
                <div className="flex items-center gap-1 text-sm font-semibold">
                  {meta?.name ?? cu.unitId}
                  {isCarry && <span className="text-[10px] text-teal">★캐리</span>}
                </div>
                <div className="mt-1 text-xs text-gold">
                  {"★".repeat(cu.star)}
                  <span className="text-muted/50">{"★".repeat(3 - cu.star)}</span>
                </div>
                <div className="mt-1 text-[10px] text-muted/80">
                  <span className={COST_TEXT[meta?.cost ?? 1]}>{meta?.cost}코</span> · {meta?.traits.join(" / ")}
                </div>
                {has && <div className="mt-1 text-xs text-teal">✓ 보유</div>}
              </Link>
            );
          })}
        </div>
      </section>

      {/* 아이템 배치 */}
      <section className="mb-6">
        <h2 className="mb-3 text-lg font-semibold">아이템 배치</h2>
        <div className="space-y-2">
          {Object.entries(itemsByUnit).map(([uid, itemIds]) => {
            const isCarry = uid === score.carryId;
            return (
              <div
                key={uid}
                className={`rounded-lg border p-3 ${
                  isCarry ? "border-teal/40 bg-teal/5" : "border-gold/25 bg-panel"
                }`}
              >
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <UnitIcon id={uid} size="sm" />
                  {unitById(uid)?.name}
                  {isCarry && <span className="text-[10px] text-teal">★캐리</span>}
                </div>
                <div className="flex flex-wrap gap-2">
                  {itemIds.map((iid, i) => {
                    const it = itemById(iid);
                    const canMake = isCarry && score.buildableCarryItems.includes(iid);
                    return (
                      <span
                        key={i}
                        className={`flex items-center gap-1.5 rounded py-1 pl-1 pr-2 text-xs ${
                          canMake
                            ? "bg-teal/20 text-teal"
                            : "bg-panel-2 text-muted"
                        }`}
                      >
                        <ItemIcon id={iid} />
                        {canMake && "✓ "}
                        {it?.name ?? iid}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 추천 이유 */}
      <section className="mb-6">
        <h2 className="mb-3 text-lg font-semibold">추천 이유</h2>
        <ul className="space-y-1.5 text-sm">
          {score.reasons.map((r, i) => (
            <li
              key={i}
              className={
                r.kind === "good" ? "text-teal"
                : r.kind === "warn" ? "text-amber-300"
                : "text-muted"
              }
            >
              {r.kind === "good" ? "✓" : r.kind === "warn" ? "△" : "·"} {r.text}
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-8">
        <Link
          href="/"
          className="inline-block rounded-lg border border-gold/25 px-4 py-2 text-sm hover:bg-panel-2"
        >
          처음으로
        </Link>
      </div>
    </main>
  );
}
