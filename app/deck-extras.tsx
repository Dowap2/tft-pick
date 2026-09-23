import Link from "next/link";
import { deckById, type Deck } from "@/lib/data";
import { AUGMENTS } from "@/lib/augments";
import { ItemIcon, TierBadge, UnitIcon } from "@/app/icons";

/** 덱별 추천 증강: S는 펼쳐서, A는 접어서 */
export function DeckAugments({ deck }: { deck: Deck }) {
  const list = (deck.augments ?? []).filter((a) => AUGMENTS[a.id]);
  if (list.length === 0) return null;
  const self = list.some((a) => a.avg != null);   // 자체 집계인지 metatft 폴백인지
  const group = (tier: string) => list.filter((a) => a.tier === tier);
  const Grid = ({ items }: { items: typeof list }) => (
    <ul className="grid grid-cols-2 gap-1 sm:grid-cols-3">
      {items.map((a) => (
        <li key={a.id} title={AUGMENTS[a.id].desc} className="flex items-center gap-2 rounded-md bg-surface-2/50 px-2 py-1">
          <img src={AUGMENTS[a.id].img} alt="" className="size-6 shrink-0 rounded" />
          <span className="flex-1 truncate text-xs">{AUGMENTS[a.id].name}</span>
          {a.avg != null && <span className="num shrink-0 text-[10px] text-muted" title={`${a.games}판`}>{a.avg.toFixed(2)}등</span>}
        </li>
      ))}
    </ul>
  );
  return (
    <section className="mb-6">
      <h2 className="mb-3 text-lg font-semibold">추천 증강 <span className="text-xs font-normal text-muted/70">{self ? "이 덱에서 실제로 성적이 좋았던 순" : "이 덱과 잘 맞는 순 (metatft)"}</span></h2>
      <div className="panel space-y-3 rounded-lg bg-surface p-3">
        <div>
          <div className="mb-1.5 flex items-center gap-2 text-xs"><TierBadge tier="S" /> <span className="num text-muted">{group("S").length}</span></div>
          <Grid items={group("S")} />
        </div>
        {group("A").length > 0 && (
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center gap-2 text-xs text-muted [&::-webkit-details-marker]:hidden">
              <TierBadge tier="A" /> <span className="num">{group("A").length}</span> <span className="transition-transform group-open:rotate-180">▾</span>
            </summary>
            <div className="mt-1.5"><Grid items={group("A")} /></div>
          </details>
        )}
      </div>
    </section>
  );
}

/** 상성: 같이 만나면 등수가 나빠지는/좋아지는 덱 */
export function DeckCounters({ deck, decks }: { deck: Deck; decks: Deck[] }) {
  const rows = (deck.counters ?? []).map((c) => ({ ...c, deck: deckById(c.deckId, decks) })).filter((c) => c.deck);
  if (rows.length === 0) return null;
  const bad = rows.filter((c) => c.placeChange > 0).sort((a, b) => b.placeChange - a.placeChange).slice(0, 3);
  const good = rows.filter((c) => c.placeChange < 0).sort((a, b) => a.placeChange - b.placeChange).slice(0, 3);
  const Row = ({ c }: { c: (typeof rows)[number] }) => (
    <Link href={`/deck/${c.deckId}`} className="flex items-center gap-2 rounded-md px-2 py-1 text-xs transition-colors duration-150 hover:bg-surface-2">
      <TierBadge tier={c.deck!.tierLabel} />
      <span className="flex-1 truncate">{c.deck!.name}</span>
      <span className={`num ${c.placeChange > 0 ? "text-neg" : "text-pos"}`}>{c.placeChange > 0 ? "+" : ""}{c.placeChange.toFixed(2)}등</span>
    </Link>
  );
  return (
    <section className="mb-6">
      <h2 className="mb-3 text-lg font-semibold">상성 <span className="text-xs font-normal text-muted/70">같은 로비에 있을 때 내 평균 등수 변화</span></h2>
      <div className="panel grid gap-3 rounded-lg bg-surface p-3 sm:grid-cols-2">
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-wide text-neg">불리</div>
          {bad.length ? bad.map((c) => <Row key={c.deckId} c={c} />) : <div className="px-2 text-xs text-muted/60">없음</div>}
        </div>
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-wide text-pos">유리</div>
          {good.length ? good.map((c) => <Row key={c.deckId} c={c} />) : <div className="px-2 text-xs text-muted/60">없음</div>}
        </div>
      </div>
    </section>
  );
}

/** 추세: 일자별 평균 등수(선) + 픽률(막대) */
export function DeckTrends({ deck }: { deck: Deck }) {
  const t = deck.trends ?? [];
  if (t.length < 2) return null;
  const W = 320, H = 72, P = 6;
  const avgs = t.map((x) => x.avg), picks = t.map((x) => x.pick);
  const [lo, hi] = [Math.min(...avgs) - 0.1, Math.max(...avgs) + 0.1];
  const x = (i: number) => P + (i * (W - 2 * P)) / (t.length - 1);
  const y = (v: number) => P + ((v - lo) / (hi - lo)) * (H - 2 * P); // 등수는 낮을수록 좋음 → 위로
  const path = avgs.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const maxPick = Math.max(...picks, 0.01);
  const first = t[0], last = t[t.length - 1];
  const delta = last.avg - first.avg;
  return (
    <section className="mb-6">
      <h2 className="mb-3 text-lg font-semibold">추세 <span className="text-xs font-normal text-muted/70">최근 {t.length}일</span></h2>
      <div className="panel rounded-lg bg-surface p-3">
        <div className="mb-2 flex flex-wrap gap-4 text-xs">
          <span>평균 등수 <span className="num text-text">{last.avg.toFixed(2)}</span> <span className={`num ${delta <= 0 ? "text-pos" : "text-neg"}`}>({delta > 0 ? "+" : ""}{delta.toFixed(2)})</span></span>
          <span>픽률 <span className="num text-text">{last.pick.toFixed(1)}%</span></span>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="h-18 w-full max-w-md" role="img" aria-label="평균 등수와 픽률 추세">
          {picks.map((p, i) => (
            <rect key={i} x={x(i) - 6} y={H - P - (p / maxPick) * (H - 2 * P) * 0.6} width={12} height={(p / maxPick) * (H - 2 * P) * 0.6} className="fill-accent/20" />
          ))}
          <path d={path} fill="none" className="stroke-accent" strokeWidth={2} strokeLinejoin="round" />
          {avgs.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r={2.5} className="fill-accent" />)}
        </svg>
        <div className="flex justify-between text-[10px] text-muted/60"><span>{first.day}</span><span>선 = 평균 등수(위가 좋음) · 막대 = 픽률</span><span>{last.day}</span></div>
      </div>
    </section>
  );
}

/** 고랭커/프로가 공개한 팀 빌더 보드 (metatft 팀 빌더, 유사도순) */
export function DeckProComps({ deck }: { deck: Deck }) {
  const list = deck.proComps ?? [];
  if (list.length === 0) return null;
  return (
    <section className="mb-6">
      <h2 className="mb-3 text-lg font-semibold">고랭커 보드 <span className="text-xs font-normal text-muted/70">metatft 팀 빌더 공개 덱</span></h2>
      <div className="space-y-2">
        {list.map((p, i) => (
          <article key={i} className="panel rounded-lg bg-surface p-3">
            <div className="flex flex-wrap items-baseline gap-2 text-xs">
              <span className="font-semibold text-text">{p.title}</span>
              <span className="num text-muted">{p.author}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {p.units.map((u, j) => (
                <div key={j} className="flex flex-col items-center gap-0.5">
                  <UnitIcon id={u.unitId} size="sm" className="h-9!" />
                  <div className="flex gap-px">{u.items.map((it, k) => <ItemIcon key={k} id={it} className="size-3.5! rounded-sm border-0" />)}</div>
                </div>
              ))}
            </div>
            {p.notes && <p className="mt-2 whitespace-pre-line text-[11px] leading-4 text-muted">{p.notes}</p>}
          </article>
        ))}
      </div>
    </section>
  );
}
