"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { itemById, teamCode, unitById, type Deck } from "@/lib/data";
import { CopyTeamCode } from "@/app/team-code";
import { COST_TEXT, DeckStats, DeckTags, ItemIcon, TierBadge, TraitRow, UnitIcon } from "@/app/icons";
import { LevelComps } from "@/app/levels";

const TIERS = ["전체", "OP", "S", "A", "B", "C"] as const;
const SORTS = { avg: "평균 등수", games: "게임 수" } as const;

export function DeckList({ decks }: { decks: Deck[] }) {
  const [q, setQ] = useState("");
  const [tier, setTier] = useState<(typeof TIERS)[number]>("전체");
  const [sort, setSort] = useState<keyof typeof SORTS>("avg");

  const shown = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return decks
      .filter((d) => tier === "전체" || d.tierLabel === tier)
      .filter((d) => {
        if (!kw) return true;
        const hay = [
          d.name,
          ...d.coreUnits.map((u) => unitById(u.unitId)?.name ?? ""),
          ...d.coreItems.map((i) => itemById(i.itemId)?.name ?? ""),
        ].join(" ").toLowerCase();
        return hay.includes(kw);
      })
      .sort((a, b) => (sort === "avg" ? a.avgPlacement - b.avgPlacement : (b.games ?? 0) - (a.games ?? 0)));
  }, [decks, q, tier, sort]);

  const chip = (active: boolean) =>
    `rounded-md px-3 py-1.5 text-sm transition-colors duration-150 ${active ? "bg-accent font-semibold text-white" : "bg-surface-2 text-muted hover:text-text"}`;

  return (
    <>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="덱, 챔피언, 아이템 검색..."
        aria-label="덱 검색"
        className="mb-3 w-full rounded-lg border border-line bg-surface px-4 py-3 text-base outline-none placeholder:text-muted/60 focus:border-accent"
      />
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="flex gap-1">
          {TIERS.map((t) => (
            <button key={t} onClick={() => setTier(t)} className={chip(tier === t)} aria-pressed={tier === t}>{t}</button>
          ))}
        </div>
        <div className="flex items-center gap-1 text-xs text-muted sm:ml-auto">
          정렬
          {(Object.keys(SORTS) as (keyof typeof SORTS)[]).map((k) => (
            <button key={k} onClick={() => setSort(k)} className={chip(sort === k)} aria-pressed={sort === k}>{SORTS[k]}</button>
          ))}
        </div>
      </div>

      {shown.length === 0 && (
        <div className="panel rounded-xl bg-surface py-14 text-center text-sm text-muted">
          검색 결과가 없습니다. 다른 이름이나 티어로 찾아보세요.
        </div>
      )}

      <div className="space-y-3">
        {shown.map((deck) => {
          const carry = unitById(deck.carryId ?? "");
          const itemsByUnit = deck.coreItems.reduce<Record<string, string[]>>((acc, ci) => {
            (acc[ci.unitId] ??= []).push(ci.itemId);
            return acc;
          }, {});
          return (
            <details key={deck.id} className="panel group rounded-xl bg-surface">
              <summary className="flex cursor-pointer list-none flex-wrap items-start gap-4 p-4 transition-colors duration-150 hover:bg-surface-2/50 [&::-webkit-details-marker]:hidden">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <TierBadge tier={deck.tierLabel} size="lg" />
                    <h2 className="truncate text-lg font-semibold">{deck.name}</h2>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                    <DeckTags deck={deck} />
                    {carry && <>캐리 <span className={`font-medium ${COST_TEXT[carry.cost]}`}>{carry.name}</span></>}
                  </div>
                  <TraitRow unitIds={deck.coreUnits.map((u) => u.unitId)} className="mt-1" />
                  <div className="scrollbar-none -mx-1 mt-2 flex gap-1.5 overflow-x-auto px-1 sm:mx-0 sm:flex-wrap sm:px-0">
                    {deck.coreUnits.map((cu) => {
                      const u = unitById(cu.unitId);
                      return (
                        <div key={cu.unitId} className="flex w-11 flex-col items-center">
                          <UnitIcon id={cu.unitId} size="md" className={`h-11! ${cu.unitId === deck.carryId ? "bg-accent!" : ""}`} />
                          <span className="mt-0.5 w-12 truncate text-center text-[10px] leading-3 text-muted">{u?.name}</span>
                          <span className={`text-[9px] leading-3 ${cu.star === 3 ? "num text-[11px] text-warn" : "text-warn/80"}`}>{"★".repeat(cu.star)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="order-last basis-full border-t border-line pt-3 sm:order-none sm:basis-auto sm:border-0 sm:pt-0">
                  <DeckStats deck={deck} />
                  <div className="mt-1 flex items-center justify-end gap-2 text-[10px] text-muted/70">
                    <CopyTeamCode code={teamCode(deck.coreUnits.map((u) => u.unitId))} />
                    <span>게임 <span className="num">{fmt(deck.games)}</span></span>
                  </div>
                </div>
                <span className="hidden self-center text-muted transition-transform duration-150 group-open:rotate-180 sm:inline" aria-hidden>▾</span>
              </summary>

              <div className="space-y-4 border-t border-line p-4">
                <div>
                  <h3 className="mb-2 text-sm font-semibold">레벨별 조합</h3>
                  <LevelComps deck={deck} />
                </div>
                <div>
                  <h3 className="mb-2 text-sm font-semibold">추천 아이템</h3>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(itemsByUnit).map(([uid, itemIds]) => (
                      <div key={uid} className={`flex items-center gap-2 rounded-lg border p-2 ${uid === deck.carryId ? "border-accent/40 bg-accent/5" : "border-line bg-surface-2/40"}`}>
                        <UnitIcon id={uid} size="sm" />
                        <div>
                          <div className="text-xs font-medium">
                            {unitById(uid)?.name}
                            {uid === deck.carryId && <span className="ml-1 text-[10px] text-accent">CARRY</span>}
                          </div>
                          <div className="mt-1 flex items-center gap-1">
                            {itemIds.map((iid, i) => <ItemIcon key={i} id={iid} />)}
                            {deck.altItems?.[uid]?.length ? (
                              <>
                                <span className="mx-1 text-[10px] text-muted/60">대체</span>
                                {deck.altItems[uid].map((iid, i) => <ItemIcon key={`a${i}`} id={iid} className="size-6! opacity-70" />)}
                              </>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <Link href={`/deck/${deck.id}`} className="inline-block rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors duration-150 hover:bg-accent/85">
                  최종 배치 · 상세 보기 →
                </Link>
              </div>
            </details>
          );
        })}
      </div>
    </>
  );
}

const fmt = (n?: number) => (n == null ? "-" : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n));
