"use client";

// 덱 상세의 상호작용 부분: 보유 토글(로컬 상태 + localStorage) → /api/recommend(deckIds) 로 점수·이유·조합가능템 갱신.
// 페이지 자체는 정적 프리렌더. 이 컴포넌트만 클라이언트에서 돈다.
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { itemById, teamCode, unitById, type Deck } from "@/lib/data";
import { buildQuery } from "@/lib/params";
import { deckAtLevel } from "@/lib/board";
import type { Reason, UserInput } from "@/lib/score";
import { CopyTeamCode } from "@/app/team-code";
import { COST_TEXT, DeckStats, DeckTags, ItemIcon, TierBadge, TraitRow, UnitIcon } from "@/app/icons";
import { Board } from "@/app/board";
import { LevelComps } from "@/app/levels";
import { API_BASE } from "@/lib/api-base";

const STORAGE_KEY = "tft-pick:input";
const EMPTY: UserInput = { components: [], completed: [], units: [], rivals: [] };
type Score = { total: number; carryId: string; carryItems: string[]; buildableCarryItems: string[]; hasCarry: boolean; reasons: Reason[] };
type Trans = { emoji: string; text: string };

export function DeckInteractive({ deck, extras }: { deck: Deck; extras?: ReactNode }) {
  const [input, setInput] = useState<UserInput>(EMPTY);
  const [score, setScore] = useState<Score | null>(null);
  const [trans, setTrans] = useState<Trans | null>(null);
  const [lv, setLv] = useState<string | null>(null);

  useEffect(() => {
    try { const s = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null"); if (s) setInput({ ...EMPTY, ...s }); } catch {}
  }, []);
  useEffect(() => {
    const ctl = new AbortController();
    fetch(`${API_BASE}/api/recommend`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...input, deckIds: [deck.id] }), signal: ctl.signal })
      .then((r) => r.json())
      .then((d) => { const r = d.results?.[0]; if (r) { setScore(r.score); setTrans(r.transition); } })
      .catch(() => {});
    return () => ctl.abort();
  }, [input, deck.id]);

  // 유닛 클릭 → 보유 토글 (덱 목표 성으로 추가). 홈 저장 입력과 동기화.
  const toggle = (uid: string) => {
    const has = input.units.some((u) => u.unitId === uid);
    const star = deck.coreUnits.find((u) => u.unitId === uid)?.star ?? 1;
    const next = { ...input, units: has ? input.units.filter((u) => u.unitId !== uid) : [...input.units, { unitId: uid, star }] };
    setInput(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
  };

  const q = buildQuery(input);
  const carryId = score?.carryId ?? deck.carryId ?? deck.coreUnits[0]?.unitId ?? "";
  const carryName = unitById(carryId)?.name ?? carryId;
  const carryUnit = unitById(carryId);
  const userUnitIds = new Set(input.units.map((u) => u.unitId));
  const lvKeys = Object.keys(deck.levels ?? {}).sort((a, b) => Number(a) - Number(b));
  const boardDeck = lv ? deckAtLevel(deck, lv) : deck;
  const carryItems = score?.carryItems ?? deck.coreItems.filter((ci) => ci.unitId === carryId).map((ci) => ci.itemId);
  const buildable = score?.buildableCarryItems ?? [];
  const itemsByUnit = deck.coreItems.reduce<Record<string, string[]>>((acc, ci) => { (acc[ci.unitId] ??= []).push(ci.itemId); return acc; }, {});

  return (
    <>
      <header className="mb-8">
        <Link
          href={q ? `/recommend?${q}` : "/recommend"}
          className="text-sm text-muted hover:text-text"
        >
          ← 추천 결과로
        </Link>
        <div className="mt-2 flex items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-bold text-text"><TierBadge tier={deck.tierLabel} size="lg" />{deck.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted/80">
              <span>{trans ? `${trans.emoji} ${trans.text}` : "…"}</span>
              <DeckTags deck={deck} />
              {deck.games && <span className="text-xs">{deck.games.toLocaleString()}판</span>}
            </div>
            <TraitRow unitIds={deck.coreUnits.map((u) => u.unitId)} className="mt-2" />
            {deck.playstyle && (
              <p className="mt-2 text-sm text-muted">{deck.playstyle}</p>
            )}
          </div>
          <div className="text-right">
            <div className="num text-4xl text-accent">
              {score ? Math.round(score.total) : "–"}<span className="text-xl">%</span>
            </div>
            <div className="text-xs text-muted/80">현재 적합도</div>
            <CopyTeamCode code={teamCode(deck.coreUnits.map((u) => u.unitId))} className="mt-2" />
          </div>
        </div>
      </header>

      <section className="panel mb-6 rounded-lg bg-surface px-4 py-3">
        <DeckStats deck={deck} />
      </section>

      {/* 메인 캐리 */}
      <section className="mb-6 panel rounded-lg border-line! bg-accent/5 p-4">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-accent">
          메인 캐리
        </div>
        <div className="flex items-center gap-3">
          <UnitIcon id={carryId} size="lg" />
          <div>
            <div className="text-xl font-bold text-text">{carryName}</div>
            <div className="text-xs text-muted/80">
              <span className={COST_TEXT[carryUnit?.cost ?? 1]}>{carryUnit?.cost}코</span> · {carryUnit?.traits.join(" / ")}
            </div>
          </div>
          {userUnitIds.has(carryId) ? (
            <span className="ml-auto rounded bg-pos/20 px-2 py-0.5 text-xs font-medium text-pos">✓ 보유중</span>
          ) : (
            <span className="ml-auto rounded bg-surface-2 px-2 py-0.5 text-xs text-muted">확보 필요</span>
          )}
        </div>
        {carryItems.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {carryItems.map((iid, i) => {
              const canBuild = buildable.includes(iid);
              return (
                <span
                  key={i}
                  className={`flex items-center gap-1.5 rounded py-0.5 pl-0.5 pr-2 text-xs ${
                    canBuild
                      ? "bg-pos/15 text-pos"
                      : "bg-surface-2 text-muted"
                  }`}
                >
                  <ItemIcon id={iid} />
                  {canBuild && "✓ "}
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
          <LevelComps deck={deck} ownedIds={userUnitIds} onToggle={toggle} />
          <p className="mt-1 text-[10px] text-muted/60">각 레벨에서 가장 많이 쓰인 조합 · 흐림 = 미보유 · 클릭하면 보유 토글</p>
        </section>
      )}

      {/* 배치도 (레벨 탭) */}
      <section className="mb-6">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">{lv ? `${lv}렙 배치` : "최종 배치"}</h2>
          <div className="ml-auto flex gap-0.5">
            {lvKeys.map((k) => (
              <button key={k} type="button" onClick={() => setLv(k)}
                className={`num min-h-9 rounded px-3 py-1 text-xs transition-colors duration-150 sm:min-h-0 sm:px-2 sm:py-0.5 ${lv === k ? "bg-accent text-white" : "bg-surface-2 text-muted hover:text-text"}`}>
                {k}
              </button>
            ))}
            <button type="button" onClick={() => setLv(null)}
              className={`min-h-9 rounded px-3 py-1 text-xs transition-colors duration-150 sm:min-h-0 sm:px-2 sm:py-0.5 ${!lv ? "bg-accent text-white" : "bg-surface-2 text-muted hover:text-text"}`}>
              최종
            </button>
          </div>
        </div>
        <div className="panel overflow-x-auto rounded-lg bg-surface p-4">
          <Board deck={boardDeck} carryId={carryId} ownedIds={userUnitIds} onToggle={toggle} />
        </div>
        {lv && <p className="mt-1 text-[10px] text-muted/60">최종 조합에 있는 유닛은 최종 자리 그대로, 나머지는 특성 기준 자동 배치. {deck.levels?.[lv]?.avg.toFixed(2)}등 · {deck.levels?.[lv]?.count.toLocaleString()}판</p>}
      </section>

      {/* 필수 유닛 */}
      <section className="mb-6">
        <h2 className="mb-3 text-lg font-semibold">필수 유닛 <span className="text-xs font-normal text-muted/70">클릭하면 보유 토글</span></h2>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {deck.coreUnits.map((cu) => {
            const meta = unitById(cu.unitId);
            const has = userUnitIds.has(cu.unitId);
            const isCarry = cu.unitId === carryId;
            return (
              <button
                key={cu.unitId}
                type="button"
                onClick={() => toggle(cu.unitId)}
                aria-pressed={has}
                className={`block w-full rounded-lg border p-3 text-left transition hover:border-accent/60 ${
                  has ? "border-accent/60 bg-accent/10" : "border-line bg-surface"
                } ${isCarry ? "border-accent/60!" : ""}`}
              >
                <UnitIcon id={cu.unitId} size="lg" className="mb-2" />
                <div className="flex items-center gap-1 text-sm font-semibold">
                  {meta?.name ?? cu.unitId}
                  {isCarry && <span className="text-[10px] text-accent">★캐리</span>}
                </div>
                <div className="mt-1 text-xs text-warn">
                  {"★".repeat(cu.star)}
                  <span className="text-muted/50">{"★".repeat(3 - cu.star)}</span>
                </div>
                <div className="mt-1 text-[10px] text-muted/80">
                  <span className={COST_TEXT[meta?.cost ?? 1]}>{meta?.cost}코</span> · {meta?.traits.join(" / ")}
                </div>
                {has && <div className="mt-1 text-xs text-pos">✓ 보유</div>}
              </button>
            );
          })}
        </div>
      </section>

      {/* 아이템 배치 */}
      <section className="mb-6">
        <h2 className="mb-3 text-lg font-semibold">아이템 배치</h2>
        <div className="space-y-2">
          {Object.entries(itemsByUnit).map(([uid, itemIds]) => {
            const isCarry = uid === carryId;
            return (
              <div
                key={uid}
                className={`rounded-lg border p-3 ${
                  isCarry ? "border-accent/40 bg-accent/5" : "border-line bg-surface"
                }`}
              >
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <UnitIcon id={uid} size="sm" />
                  {unitById(uid)?.name}
                  {isCarry && <span className="text-[10px] text-accent">★캐리</span>}
                </div>
                {deck.altItems?.[uid]?.length ? (
                  <div className="mb-2 flex items-center gap-1 text-[10px] text-muted/70">
                    대체 {deck.altItems[uid].map((iid, i) => <ItemIcon key={i} id={iid} className="size-5! opacity-70" />)}
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  {itemIds.map((iid, i) => {
                    const it = itemById(iid);
                    const canMake = isCarry && buildable.includes(iid);
                    return (
                      <span
                        key={i}
                        className={`flex items-center gap-1.5 rounded py-1 pl-1 pr-2 text-xs ${
                          canMake
                            ? "bg-pos/15 text-pos"
                            : "bg-surface-2 text-muted"
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


      {extras}

      {/* 추천 이유 */}
      <section className="mb-6">
        <h2 className="mb-3 text-lg font-semibold">추천 이유</h2>
        <ul className="space-y-1.5 text-sm">
          {(score?.reasons ?? []).map((r, i) => (
            <li
              key={i}
              className={
                r.kind === "good" ? "text-pos"
                : r.kind === "warn" ? "text-warn"
                : "text-muted"
              }
            >
              {r.kind === "good" ? "✓" : r.kind === "warn" ? "△" : "·"} {r.text}
            </li>
          ))}
        </ul>
      </section>

    </>
  );
}
