import Link from "next/link";
import { componentById, unitById } from "@/lib/data";
import { parseUserInput, buildQuery } from "@/lib/params";
import { recommend, toStars, transitionLabel } from "@/lib/score";
import { COST_TEXT, ItemIcon, UnitIcon } from "@/app/icons";

const MEDALS = ["🥇", "🥈", "🥉"];

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function RecommendPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const input = parseUserInput(sp);
  const results = recommend(input).slice(0, 3);
  const q = buildQuery(input);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <Link href="/" className="text-sm text-zinc-400 hover:text-zinc-200">
            ← 다시 입력
          </Link>
          <h1 className="mt-2 text-2xl font-bold">추천 결과</h1>
        </div>
      </header>

      {/* 현재 상황 요약 */}
      <section className="mb-8 rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
        <h2 className="mb-3 text-sm font-semibold text-zinc-400">현재 상황</h2>
        <div className="space-y-2 text-sm">
          <div>
            <span className="text-zinc-500">아이템: </span>
            {input.components.length === 0 ? (
              <span className="text-zinc-600">없음</span>
            ) : (
              input.components.map((c, i) => (
                <span key={i} className="mr-2 inline-flex items-center gap-1 rounded bg-emerald-600/30 py-0.5 pl-0.5 pr-2 align-middle">
                  <ItemIcon id={c} className="size-5" /> {componentById(c)?.name}
                </span>
              ))
            )}
          </div>
          <div>
            <span className="text-zinc-500">유닛: </span>
            {input.units.length === 0 ? (
              <span className="text-zinc-600">없음</span>
            ) : (
              input.units.map((u) => (
                <span key={u.unitId} className="mr-2 inline-flex items-center gap-1 rounded bg-indigo-600/30 py-0.5 pl-0.5 pr-2 align-middle">
                  <UnitIcon id={u.unitId} className="size-5" /> {unitById(u.unitId)?.name} {"★".repeat(u.star)}
                </span>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Top 3 */}
      <section className="space-y-4">
        {results.map(({ deck, score }, idx) => {
          const trans = transitionLabel(score);
          const carryName = unitById(score.carryId)?.name ?? score.carryId;
          const carryCost = unitById(score.carryId)?.cost ?? 0;
          return (
            <Link
              key={deck.id}
              href={`/deck/${deck.id}?${q}`}
              className="block rounded-xl border border-zinc-800 bg-zinc-900 p-5 transition hover:border-zinc-600 hover:bg-zinc-800/70"
            >
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs text-zinc-500">{MEDALS[idx]} 추천 {idx + 1}</div>
                  <h3 className="mt-1 text-xl font-bold">{deck.name}</h3>
                  <div className="mt-1 text-xs text-zinc-500">
                    {trans.emoji} {trans.text} · {deck.tierLabel}티어 · 평균순위 {deck.avgPlacement.toFixed(2)}
                  </div>
                  <div className="mt-2 inline-flex items-center gap-1.5 rounded bg-zinc-800 py-0.5 pl-0.5 pr-2 text-xs">
                    <UnitIcon id={score.carryId} className="size-6" />
                    <span className="text-zinc-500">메인 캐리</span>
                    <span className={score.hasCarry ? "font-semibold text-emerald-300" : "font-semibold text-zinc-200"}>
                      {carryName}
                    </span>
                    <span className={COST_TEXT[carryCost]}>{carryCost}코</span>
                    {score.hasCarry && <span className="text-emerald-400">✓ 보유</span>}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-emerald-400">
                    {Math.round(score.total)}%
                  </div>
                  <div className="text-xs text-zinc-500">적합도</div>
                </div>
              </div>

              <div className="mb-3 flex flex-wrap gap-1.5">
                {deck.coreUnits.map((cu) => (
                  <div key={cu.unitId} className="flex flex-col items-center">
                    <UnitIcon id={cu.unitId} size="md" className={cu.unitId === score.carryId ? "ring-2 ring-emerald-400" : ""} />
                    <span className="text-[10px] leading-3 text-yellow-400">{"★".repeat(cu.star)}</span>
                  </div>
                ))}
                {score.carryItems.length > 0 && (
                  <div className="ml-2 flex items-center gap-1 self-start">
                    {score.carryItems.map((iid, i) => (
                      <ItemIcon key={i} id={iid} size="md" className={score.buildableCarryItems.includes(iid) ? "ring-2 ring-emerald-400" : "opacity-60"} />
                    ))}
                  </div>
                )}
              </div>

              <div className="mb-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-zinc-400 sm:grid-cols-4">
                <MetricRow label="캐리" score={score.carryScore} max={35} />
                <MetricRow label="캐리템" score={score.carryItemScore} max={30} />
                <MetricRow label="서포트" score={score.supportScore} max={15} />
                <MetricRow label="메타" score={score.metaScore} max={20} />
              </div>

              <ul className="space-y-1 text-sm">
                {score.reasons.slice(0, 4).map((r, i) => (
                  <li
                    key={i}
                    className={
                      r.kind === "good" ? "text-emerald-300"
                      : r.kind === "warn" ? "text-amber-300/80"
                      : "text-zinc-400"
                    }
                  >
                    {r.kind === "good" ? "✓" : r.kind === "warn" ? "△" : "·"} {r.text}
                  </li>
                ))}
              </ul>
            </Link>
          );
        })}
      </section>
    </main>
  );
}

function MetricRow({ label, score, max }: { label: string; score: number; max: number }) {
  return (
    <div className="flex items-center justify-between">
      <span>{label}</span>
      <span className="font-mono text-yellow-400">{toStars(score, max)}</span>
    </div>
  );
}
