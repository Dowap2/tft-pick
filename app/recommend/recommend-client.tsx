"use client";

// 추천 결과 — 정적 셸 + 클라이언트에서 /api/recommend 호출. URL 쿼리는 공유용(파싱만 클라이언트).
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { componentById, itemById, unitById, type Deck } from "@/lib/data";
import { parseUserInput, buildQuery } from "@/lib/params";
import { toStars, type Reason, type UserInput } from "@/lib/score";
import { COST_TEXT, DeckTags, ItemIcon, TierBadge, TraitRow, UnitIcon } from "@/app/icons";
import { PivotTree } from "@/app/pivot";
import { SyncInput } from "@/app/sync-input";
import { API_BASE } from "@/lib/api-base";

const MEDALS = ["🥇", "🥈", "🥉", "4", "5"];

type Result = {
  deck: Deck; confidence: number; transition: { emoji: string; text: string };
  score: { total: number; earlyScore: number; itemScore: number; carryScore: number; metaScore: number; carryId: string; carryItems: string[]; buildableCarryItems: string[]; hasCarry: boolean; reasons: Reason[] };
  next: { level: string; buy: string[] } | null;
  actions: { needComponents: string[]; sellUnits: string[] };
};
type Resp = { patch: string; source: string; rivalDecks: string[]; results: Result[] };

export function RecommendClient() {
  const sp = useSearchParams();
  const [input, setInput] = useState<UserInput | null>(null);
  const [data, setData] = useState<Resp | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const parsed = parseUserInput(Object.fromEntries(sp.entries()));
    setInput(parsed);
    setData(null); setError(null);
    fetch(`${API_BASE}/api/recommend`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed) })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status}`))))
      .then(setData)
      .catch((e) => setError(e.message));
  }, [sp]);

  if (!input) return null;
  const q = buildQuery(input);
  const owned = new Set(input.units.map((u) => u.unitId));
  const results = data?.results ?? [];
  const rivalDecks = data?.rivalDecks ?? [];

  return (
    <main className="w-full max-w-3xl px-4 py-8 sm:py-12">
      <header className="mb-8 flex items-center justify-between">
        {input.stage && <span className="num order-last rounded-md border border-accent/50 px-2 py-0.5 text-xs text-accent">STAGE {input.stage}</span>}
        <div>
          <Link href="/" className="text-sm text-muted hover:text-text">
            ← 다시 입력
          </Link>
          <h1 className="mt-2 text-2xl font-bold">추천 결과</h1>
        </div>
      </header>

      {/* 현재 상황 요약 */}
      <section className="mb-8 panel rounded-lg bg-surface p-4">
        <h2 className="mb-3 text-sm font-semibold text-muted">현재 상황</h2>
        <div className="space-y-2 text-sm">
          <div>
            <span className="text-muted/80">아이템: </span>
            {input.completed.map((id, i) => (
              <span key={`d${i}`} className="mr-2 inline-flex items-center gap-1 rounded bg-accent-2/40 py-0.5 pl-0.5 pr-2 align-middle" title="완성 아이템">
                <ItemIcon id={id} className="size-5" /> {itemById(id)?.name}
              </span>
            ))}
            {input.components.length + input.completed.length === 0 ? (
              <span className="text-muted/50">없음</span>
            ) : (
              input.components.map((c, i) => (
                <span key={i} className="mr-2 inline-flex items-center gap-1 rounded bg-pos/15 py-0.5 pl-0.5 pr-2 align-middle">
                  <ItemIcon id={c} className="size-5" /> {componentById(c)?.name}
                </span>
              ))
            )}
          </div>
          {(input.rivals?.length ?? 0) > 0 && (
            <div>
              <span className="text-muted/80">로비: </span>
              {input.rivals!.map((id) => (
                <span key={id} className="mr-1.5 inline-flex items-center gap-1 rounded bg-warn/15 py-0.5 pl-0.5 pr-2 align-middle text-warn">
                  <UnitIcon id={id} className="h-5" /> {unitById(id)?.name}
                </span>
              ))}
              {rivalDecks.length > 0 && (
                <span className="ml-1 text-xs text-muted">→ 상대 추정: {rivalDecks.join(", ")}</span>
              )}
            </div>
          )}
          <div>
            <span className="text-muted/80">유닛: </span>
            {input.units.length === 0 ? (
              <span className="text-muted/50">없음</span>
            ) : (
              input.units.map((u) => (
                <span key={u.unitId} className="mr-2 inline-flex items-center gap-1 rounded bg-accent-2/40 py-0.5 pl-0.5 pr-2 align-middle">
                  <UnitIcon id={u.unitId} className="h-5" /> {unitById(u.unitId)?.name} {"★".repeat(u.star)}
                </span>
              ))
            )}
          </div>
        </div>
      </section>

      <SyncInput input={input} />
      {error && <div className="mb-6 rounded-lg border border-neg/40 bg-neg/10 px-4 py-3 text-sm text-neg">추천을 불러오지 못했습니다 ({error}). 잠시 후 다시 시도해주세요.</div>}
      {!data && !error && (
        <div className="mb-6 space-y-4" aria-busy>
          {[0, 1, 2].map((i) => <div key={i} className="panel h-56 animate-pulse rounded-xl bg-surface" />)}
        </div>
      )}
      {data && results.length === 0 && <div className="panel mb-6 rounded-xl bg-surface px-4 py-10 text-center text-sm text-muted">조건에 맞는 덱이 없습니다. 유닛이나 스테이지를 조정해보세요.</div>}

      {results.length > 1 && <PivotTree decks={results.map((r) => r.deck)} ownedIds={owned} />}

      {/* Top 3 */}
      <section className="space-y-4">
        {results.map(({ deck, score, transition: trans, next, actions: act }, idx) => {
          const carryName = unitById(score.carryId)?.name ?? score.carryId;
          const carryCost = unitById(score.carryId)?.cost ?? 0;
          return (
            <Link
              key={deck.id}
              href={`/deck/${deck.id}?${q}`}
              className="block panel rounded-xl bg-surface p-5 transition hover:border-accent/60 hover:bg-surface-2"
            >
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs text-muted/80">{MEDALS[idx]} 추천 {idx + 1}</div>
                  <h3 className="mt-1 flex items-center gap-2 text-xl font-bold"><TierBadge tier={deck.tierLabel} size="lg" />{deck.name}</h3>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted/80">
                    <span>{trans.emoji} {trans.text}</span>
                    <DeckTags deck={deck} />
                    <span>평균 <span className="num text-text">{deck.avgPlacement.toFixed(2)}</span></span>
                    {deck.top4Rate != null && <span>Top4 <span className="num text-pos">{(deck.top4Rate * 100).toFixed(0)}%</span></span>}
                    {deck.winRate != null && <span>1등 <span className="num text-text">{(deck.winRate * 100).toFixed(0)}%</span></span>}
                  </div>
                  <TraitRow unitIds={deck.coreUnits.map((u) => u.unitId)} className="mt-1.5" />
                  <div className="mt-2 inline-flex items-center gap-1.5 rounded bg-surface-2 py-0.5 pl-0.5 pr-2 text-xs">
                    <UnitIcon id={score.carryId} className="h-6" />
                    <span className="text-muted/80">메인 캐리</span>
                    <span className="font-semibold text-text">
                      {carryName}
                    </span>
                    <span className={COST_TEXT[carryCost]}>{carryCost}코</span>
                    {score.hasCarry && <span className="text-pos">✓ 보유</span>}
                  </div>
                </div>
                <div className="text-right">
                  <div className="num text-3xl text-accent">
                    {Math.round(score.total)}<span className="text-lg">%</span>
                  </div>
                  <div className="text-xs text-muted/80">적합도</div>
                </div>
              </div>

              <div className="scrollbar-none -mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 sm:mx-0 sm:flex-wrap sm:px-0">
                {deck.coreUnits.map((cu) => (
                  <div key={cu.unitId} className="flex flex-col items-center">
                    <UnitIcon id={cu.unitId} size="md" className={`${cu.unitId === score.carryId ? "bg-accent!" : ""} ${owned.has(cu.unitId) ? "" : "opacity-45"}`} />
                    <span className="text-[10px] leading-3 text-warn">{"★".repeat(cu.star)}</span>
                  </div>
                ))}
                {score.carryItems.length > 0 && (
                  <div className="ml-2 flex items-center gap-1 self-start">
                    {score.carryItems.map((iid, i) => (
                      <ItemIcon key={i} id={iid} size="md" className={score.buildableCarryItems.includes(iid) ? "ring-2 ring-pos" : "opacity-60"} />
                    ))}
                  </div>
                )}
              </div>

              {(next || act.needComponents.length > 0 || act.sellUnits.length > 0) && (
                <div className="mb-3 space-y-1.5 rounded bg-surface-2/60 px-2 py-2 text-xs">
                  {next && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="mr-1 w-full text-muted sm:w-24">다음 목표 <span className="num text-text">{next.level}렙</span></span>
                      {next.buy.map((uid) => (
                        <span key={uid} className="inline-flex items-center gap-1">
                          <UnitIcon id={uid} className="h-6" />
                          <span className={COST_TEXT[unitById(uid)?.cost ?? 1]}>{unitById(uid)?.name}</span>
                        </span>
                      ))}
                    </div>
                  )}
                  {act.needComponents.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="mr-1 w-full text-muted sm:w-24">집을 재료</span>
                      {act.needComponents.map((c, i) => <ItemIcon key={i} id={c} className="size-6!" />)}
                    </div>
                  )}
                  {act.sellUnits.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="mr-1 w-full text-muted sm:w-24">팔아도 됨</span>
                      {act.sellUnits.map((uid) => (
                        <span key={uid} className="inline-flex items-center gap-1 opacity-70">
                          <UnitIcon id={uid} className="h-6" />
                          <span className="text-muted">{unitById(uid)?.name}</span>
                        </span>
                      ))}
                    </div>
                  )}
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
                      r.kind === "good" ? "text-pos"
                      : r.kind === "warn" ? "text-warn/80"
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
      <span className="text-warn">{toStars(score, max)}</span>
    </div>
  );
}
