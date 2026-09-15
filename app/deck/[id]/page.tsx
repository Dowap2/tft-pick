import Link from "next/link";
import { notFound } from "next/navigation";
import { deckById, itemById, unitById } from "@/lib/data";
import { parseUserInput, buildQuery } from "@/lib/params";
import { scoreDeck, transitionLabel } from "@/lib/score";
import { COST_TEXT, ItemIcon, UnitIcon } from "@/app/icons";

type SP = Promise<Record<string, string | string[] | undefined>>;
type Params = Promise<{ id: string }>;

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
          className="text-sm text-zinc-400 hover:text-zinc-200"
        >
          ← 추천 결과로
        </Link>
        <div className="mt-2 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">{deck.name}</h1>
            <div className="mt-1 text-sm text-zinc-500">
              {trans.emoji} {trans.text} · {deck.tierLabel}티어 · 평균순위 {deck.avgPlacement.toFixed(2)}
            </div>
            {deck.playstyle && (
              <p className="mt-2 text-sm text-zinc-400">{deck.playstyle}</p>
            )}
          </div>
          <div className="text-right">
            <div className="text-4xl font-bold text-emerald-400">
              {Math.round(score.total)}%
            </div>
            <div className="text-xs text-zinc-500">현재 적합도</div>
          </div>
        </div>
      </header>

      {/* 메인 캐리 */}
      <section className="mb-6 rounded-lg border border-emerald-800/50 bg-emerald-900/10 p-4">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-500">
          메인 캐리
        </div>
        <div className="flex items-center gap-3">
          <UnitIcon id={score.carryId} size="lg" />
          <div>
            <div className="text-xl font-bold text-emerald-300">{carryName}</div>
            <div className="text-xs text-zinc-500">
              <span className={COST_TEXT[carryUnit?.cost ?? 1]}>{carryUnit?.cost}코</span> · {carryUnit?.traits.join(" / ")}
            </div>
          </div>
          {score.hasCarry ? (
            <span className="ml-auto rounded bg-emerald-600 px-2 py-0.5 text-xs font-medium">✓ 보유중</span>
          ) : (
            <span className="ml-auto rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">확보 필요</span>
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
                      ? "bg-emerald-600/30 text-emerald-200"
                      : "bg-zinc-800 text-zinc-400"
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

      {/* 필수 유닛 */}
      <section className="mb-6">
        <h2 className="mb-3 text-lg font-semibold">필수 유닛</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {deck.coreUnits.map((cu) => {
            const meta = unitById(cu.unitId);
            const has = userUnitIds.has(cu.unitId);
            const isCarry = cu.unitId === score.carryId;
            return (
              <div
                key={cu.unitId}
                className={`rounded-lg border p-3 ${
                  has ? "border-emerald-600 bg-emerald-600/10" : "border-zinc-800 bg-zinc-900"
                } ${isCarry ? "ring-1 ring-emerald-500/50" : ""}`}
              >
                <UnitIcon id={cu.unitId} size="lg" className="mb-2" />
                <div className="flex items-center gap-1 text-sm font-semibold">
                  {meta?.name ?? cu.unitId}
                  {isCarry && <span className="text-[10px] text-emerald-400">★캐리</span>}
                </div>
                <div className="mt-1 text-xs text-yellow-400">
                  {"★".repeat(cu.star)}
                  <span className="text-zinc-600">{"★".repeat(3 - cu.star)}</span>
                </div>
                <div className="mt-1 text-[10px] text-zinc-500">
                  <span className={COST_TEXT[meta?.cost ?? 1]}>{meta?.cost}코</span> · {meta?.traits.join(" / ")}
                </div>
                {has && <div className="mt-1 text-xs text-emerald-400">✓ 보유</div>}
              </div>
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
                  isCarry ? "border-emerald-800 bg-emerald-900/10" : "border-zinc-800 bg-zinc-900"
                }`}
              >
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <UnitIcon id={uid} size="sm" />
                  {unitById(uid)?.name}
                  {isCarry && <span className="text-[10px] text-emerald-400">★캐리</span>}
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
                            ? "bg-emerald-600/30 text-emerald-200"
                            : "bg-zinc-800 text-zinc-400"
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
                r.kind === "good" ? "text-emerald-300"
                : r.kind === "warn" ? "text-amber-300"
                : "text-zinc-400"
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
          className="inline-block rounded-lg border border-zinc-800 px-4 py-2 text-sm hover:bg-zinc-900"
        >
          처음으로
        </Link>
      </div>
    </main>
  );
}
