import Link from "next/link";
import { componentById, itemById, unitById } from "@/lib/data";
import { parseUserInput, buildQuery } from "@/lib/params";
import { nextStep, recommend, toStars, transitionLabel } from "@/lib/score";
import { COST_TEXT, ItemIcon, TierBadge, UnitIcon } from "@/app/icons";

const MEDALS = ["🥇", "🥈", "🥉"];

export const metadata = {
  title: "추천 결과",
  robots: { index: false, follow: true }, // 입력마다 달라지는 페이지라 색인 제외
};

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function RecommendPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const input = parseUserInput(sp);
  const results = recommend(input).slice(0, 3);
  const q = buildQuery(input);
  const owned = new Set(input.units.map((u) => u.unitId));

  return (
    <main className="w-full max-w-3xl px-4 py-8 sm:py-12">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <Link href="/" className="text-sm text-muted hover:text-gold-light">
            ← 다시 입력
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-gold-light">추천 결과</h1>
        </div>
      </header>

      {/* 현재 상황 요약 */}
      <section className="mb-8 panel rounded-lg bg-panel/70 p-4">
        <h2 className="mb-3 text-sm font-semibold text-muted">현재 상황</h2>
        <div className="space-y-2 text-sm">
          <div>
            <span className="text-muted/80">아이템: </span>
            {input.completed.map((id, i) => (
              <span key={`d${i}`} className="mr-2 inline-flex items-center gap-1 rounded bg-gold-dark/60 py-0.5 pl-0.5 pr-2 align-middle" title="완성 아이템">
                <ItemIcon id={id} className="size-5" /> {itemById(id)?.name}
              </span>
            ))}
            {input.components.length + input.completed.length === 0 ? (
              <span className="text-muted/50">없음</span>
            ) : (
              input.components.map((c, i) => (
                <span key={i} className="mr-2 inline-flex items-center gap-1 rounded bg-teal/20 py-0.5 pl-0.5 pr-2 align-middle">
                  <ItemIcon id={c} className="size-5" /> {componentById(c)?.name}
                </span>
              ))
            )}
          </div>
          <div>
            <span className="text-muted/80">유닛: </span>
            {input.units.length === 0 ? (
              <span className="text-muted/50">없음</span>
            ) : (
              input.units.map((u) => (
                <span key={u.unitId} className="mr-2 inline-flex items-center gap-1 rounded bg-gold-dark/60 py-0.5 pl-0.5 pr-2 align-middle">
                  <UnitIcon id={u.unitId} className="h-5" /> {unitById(u.unitId)?.name} {"★".repeat(u.star)}
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
          const next = nextStep(deck, owned);
          return (
            <Link
              key={deck.id}
              href={`/deck/${deck.id}?${q}`}
              className="block panel rounded-xl bg-panel p-5 transition hover:border-gold/70 hover:bg-panel-2"
            >
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs text-muted/80">{MEDALS[idx]} 추천 {idx + 1}</div>
                  <h3 className="mt-1 flex items-center gap-2 text-xl font-bold"><TierBadge tier={deck.tierLabel} size="lg" />{deck.name}</h3>
                  <div className="mt-1 text-xs text-muted/80">
                    {trans.emoji} {trans.text} · 평균순위 {deck.avgPlacement.toFixed(2)}
                  </div>
                  <div className="mt-2 inline-flex items-center gap-1.5 rounded bg-panel-2 py-0.5 pl-0.5 pr-2 text-xs">
                    <UnitIcon id={score.carryId} className="h-6" />
                    <span className="text-muted/80">메인 캐리</span>
                    <span className={score.hasCarry ? "font-semibold text-teal" : "font-semibold text-parchment"}>
                      {carryName}
                    </span>
                    <span className={COST_TEXT[carryCost]}>{carryCost}코</span>
                    {score.hasCarry && <span className="text-teal">✓ 보유</span>}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold gold-text">
                    {Math.round(score.total)}%
                  </div>
                  <div className="text-xs text-muted/80">적합도</div>
                </div>
              </div>

              <div className="mb-3 flex flex-wrap gap-1.5">
                {deck.coreUnits.map((cu) => (
                  <div key={cu.unitId} className="flex flex-col items-center">
                    <UnitIcon id={cu.unitId} size="md" className={`${cu.unitId === score.carryId ? "bg-teal!" : ""} ${owned.has(cu.unitId) ? "" : "opacity-45"}`} />
                    <span className="text-[10px] leading-3 text-gold">{"★".repeat(cu.star)}</span>
                  </div>
                ))}
                {score.carryItems.length > 0 && (
                  <div className="ml-2 flex items-center gap-1 self-start">
                    {score.carryItems.map((iid, i) => (
                      <ItemIcon key={i} id={iid} size="md" className={score.buildableCarryItems.includes(iid) ? "ring-2 ring-teal" : "opacity-60"} />
                    ))}
                  </div>
                )}
              </div>

              {next && (
                <div className="mb-3 flex flex-wrap items-center gap-1.5 rounded bg-panel-2/60 px-2 py-1.5 text-xs">
                  <span className="mr-1 text-gold-light">다음 목표 {next.level}렙 →</span>
                  {next.buy.map((uid) => (
                    <span key={uid} className="inline-flex items-center gap-1">
                      <UnitIcon id={uid} className="h-6" />
                      <span className={COST_TEXT[unitById(uid)?.cost ?? 1]}>{unitById(uid)?.name}</span>
                    </span>
                  ))}
                </div>
              )}

              <div className="mb-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted sm:grid-cols-4">
                <MetricRow label="초반 조합" score={score.earlyScore} max={40} />
                <MetricRow label="아이템 방향" score={score.itemScore} max={25} />
                <MetricRow label="캐리" score={score.carryScore} max={15} />
                <MetricRow label="메타" score={score.metaScore} max={20} />
              </div>

              <ul className="space-y-1 text-sm">
                {score.reasons.slice(0, 4).map((r, i) => (
                  <li
                    key={i}
                    className={
                      r.kind === "good" ? "text-teal"
                      : r.kind === "warn" ? "text-amber-300/80"
                      : "text-muted"
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
      <span className="font-mono text-gold">{toStars(score, max)}</span>
    </div>
  );
}
