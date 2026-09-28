// 덱 데이터 → 초보용 한국어 설명문 (정적 빌드 시 생성). 사람이 쓴 playstyle(deck-notes) 이 있으면 그 뒤에 붙는다.
import { activeTraits, itemById, unitById, type Deck } from "./data";
import { withJosa } from "./josa";

const names = (ids: string[]) => ids.map((id) => unitById(id)?.name ?? id).join(", ");
const pct = (v?: number) => (v == null ? null : `${Math.round(v * 100)}%`);

export function describeDeck(deck: Deck): string[] {
  const out: string[] = [];
  const carry = unitById(deck.carryId ?? "");
  const carryItems = deck.coreItems.filter((ci) => ci.unitId === deck.carryId).map((ci) => itemById(ci.itemId)?.name).filter(Boolean);
  const traits = activeTraits(deck.coreUnits.map((u) => u.unitId)).slice(0, 3);
  const lv = deck.levels ?? {};
  const lvKeys = Object.keys(lv).map(Number).sort((a, b) => a - b);
  const reroll = /^lvl/i.test(deck.levelling ?? "");
  const threeStar = deck.coreUnits.filter((u) => u.star === 3).map((u) => u.unitId);

  // 1) 한 줄 요약: 어떤 덱인가
  const kind = reroll
    ? `${deck.levelling!.replace(/lvl\s*/i, "")}렙에서 멈추고 리롤해 ${names(threeStar.length ? threeStar : [deck.carryId!])} 3성을 만드는 리롤 덱`
    : deck.levelling === "Fast 9"
      ? "8렙을 빠르게 지나 9렙에서 5코스트 기물로 완성하는 고밸류 덱"
      : "8렙에서 4코스트 캐리를 2성으로 굳히는 표준 템포 덱";
  out.push(`${withJosa(deck.name, "은는")} ${kind}입니다. 핵심 시너지는 ${traits.map((t) => `${t.name} ${t.count}`).join(", ")}${deck.difficulty ? `, 난이도는 ${deck.difficulty}` : ""}.`);

  // 2) 캐리와 아이템
  if (carry) {
    out.push(`메인 캐리는 ${carry.cost}코스트 ${carry.name}입니다. 아이템은 ${carryItems.join(" → ")} 순으로 챙기세요${deck.altItems?.[carry.id]?.length ? ` (대체: ${deck.altItems[carry.id].map((i) => itemById(i)?.name).filter(Boolean).join(", ")})` : ""}.`);
  }
  const tanks = deck.coreItems.filter((ci) => ci.unitId !== deck.carryId).map((ci) => ci.unitId);
  const tank = tanks.sort((a, b) => tanks.filter((x) => x === b).length - tanks.filter((x) => x === a).length)[0];
  if (tank) out.push(`방어 아이템은 ${unitById(tank)?.name}에게 몰아주는 것이 일반적입니다.`);

  // 3) 초반 → 중반 진행
  const early = lvKeys.filter((L) => L <= 6)[0];
  const mid = lvKeys.filter((L) => L === 7 || L === 8)[0];
  if (early != null) out.push(`초반(${early}렙)에는 ${names(lv[String(early)].units)}로 시작하고, ${mid != null ? `${mid}렙에 ${names(lv[String(mid)].units.filter((u) => !lv[String(early)].units.includes(u)).slice(0, 4))} 등을 붙여 최종 조합으로 넘어갑니다.` : "최종 조합의 저코스트 유닛부터 채워 갑니다."}`);

  // 4) 통계
  const stat = [deck.games && `${deck.games.toLocaleString()}판`, deck.avgPlacement && `평균 ${deck.avgPlacement.toFixed(2)}등`, pct(deck.top4Rate) && `Top4 ${pct(deck.top4Rate)}`, pct(deck.winRate) && `1등 ${pct(deck.winRate)}`].filter(Boolean).join(" · ");
  if (stat) out.push(`최근 고랭크 데이터 기준 ${stat}입니다.`);
  return out;
}

// ─────────────────────────────────────────────────────────────
// 챔피언·아이템·시너지 페이지용 요약문.
// "크롤링됨 – 색인 생성되지 않음" 대책: 이 페이지들은 본문이 600자대라
// 템플릿으로 찍어낸 얇은 페이지로 판정됐다. 우리 자체 통계에서만 나오는
// 문장을 붙여 다른 사이트에 없는 내용을 만든다. (빌드 타임 생성)
// ─────────────────────────────────────────────────────────────

const place = (d: Deck) => `평균 ${d.avgPlacement.toFixed(2)}등`;
const TIERS = ["OP", "S", "A", "B", "C", "D"] as const;
/** 판수 가중 평균 등수. 100판 덱과 4,000판 덱을 같은 무게로 세면 안 된다. */
const wAvgPlace = (ds: Deck[]) => {
  const w = ds.reduce((s, d) => s + (d.games ?? 1), 0);
  return ds.reduce((s, d) => s + d.avgPlacement * (d.games ?? 1), 0) / (w || 1);
};

export function describeUnit(u: { id: string; name: string; cost: number; traits: string[] }, use: { decks: Deck[]; items: string[]; carryOf: Deck[] }, mates: { id: string; n: number }[]): string[] {
  const out: string[] = [];
  if (use.decks.length === 0) {
    out.push(`${withJosa(u.name, "은는")} 현재 상위 티어 덱의 핵심 기물로는 쓰이지 않습니다. ${u.traits.join("·")} 시너지를 맞추는 보조 기물로 넣거나, 메타가 바뀌면 다시 올라올 수 있습니다.`);
    return out;
  }
  const totalGames = use.decks.reduce((s, d) => s + (d.games ?? 0), 0);
  const best = use.decks[0];
  const star = best.coreUnits.find((x) => x.unitId === u.id)?.star;
  const items = use.items.slice(0, 3).map((i) => itemById(i)?.name).filter(Boolean);
  out.push(
    `현재 메타에서 ${withJosa(u.name, "이가")} 핵심으로 들어가는 덱은 ${use.decks.length}개입니다. ` +
    `그중 평균 등수가 가장 좋은 덱은 ${best.name} (${best.tierLabel}티어, ${place(best)})이고, ` +
    (use.carryOf.length ? `메인 캐리로 쓰는 덱은 ${use.carryOf.length}개입니다.` : `메인 캐리보다는 시너지·전열용으로 쓰입니다.`),
  );
  if (items.length) {
    out.push(`${u.name}에게 주는 아이템은 ${items.join(", ")} 순으로 많이 갑니다${star ? `. 목표 성은 ${star}성입니다` : ""}.`);
  }
  if (mates.length) {
    out.push(`같은 덱에 자주 함께 들어가는 기물은 ${mates.slice(0, 5).map((m) => unitById(m.id)?.name).filter(Boolean).join(", ")}입니다.`);
  }

  // ── 아래는 우리 수집 데이터에서만 나오는 문장들. 문장마다 숫자가 하나씩 붙어야 하고,
  //    숫자가 없으면 문단을 만들지 않는다 (분량만 늘리는 문단은 오히려 감점된다).
  const places = use.decks.map((d) => d.avgPlacement).sort((a, b) => a - b);
  const tierText = TIERS.map((t) => [t, use.decks.filter((d) => d.tierLabel === t).length] as const)
    .filter(([, n]) => n > 0).map(([t, n]) => `${t}티어 ${n}개`).join(", ");
  if (totalGames > 0) {
    out.push(
      `최근 7일 자체 수집 표본 기준, ${withJosa(u.name, "이가")} 최종 조합에 들어가는 덱들의 표본은 합계 ${totalGames.toLocaleString()}판입니다. ` +
      `평균 등수는 ${places[0].toFixed(2)}등에서 ${places[places.length - 1].toFixed(2)}등까지 걸쳐 있고, 티어 분포는 ${tierText}입니다.`,
    );
  }

  // 캐리로 쓸 때와 시너지용으로 쓸 때 성적이 갈리는지 — 이 기물을 "왜" 넣는지를 가른다.
  const subDecks = use.decks.filter((d) => d.carryId !== u.id);
  if (use.carryOf.length && subDecks.length) {
    out.push(
      `${withJosa(u.name, "을를")} 메인 캐리로 쓰는 덱 ${use.carryOf.length}개는 평균 ${wAvgPlace(use.carryOf).toFixed(2)}등, ` +
      `시너지·전열용으로만 쓰는 덱 ${subDecks.length}개는 평균 ${wAvgPlace(subDecks).toFixed(2)}등입니다 (판수 가중).`,
    );
  }

  // 등장 비율. 보드 하나는 덱 하나에만 배정되므로 픽률을 그냥 더해도 된다.
  const pick = use.decks.reduce((s, d) => s + (d.pickRate ?? 0), 0);
  if (pick > 0) {
    out.push(`이 덱들은 수집된 전체 보드의 약 ${(pick * 100).toFixed(1)}%를 차지합니다. 8인 로비라면 평균 ${(pick * 8).toFixed(1)}명이 ${withJosa(u.name, "을를")} 최종 조합에 넣고 있다는 뜻입니다.`);
  }

  // 랭크 구간별 차이 (docs/티어기준.md §2). 양쪽 표본이 자격 하한(100판)을 넘고
  // 차이가 0.10등 이상일 때만 — 그 밑은 표본 노이즈와 구분이 안 된다.
  const gap = (d: Deck) => Math.abs((d.avgPlaceApex ?? 0) - (d.avgPlaceHigh ?? 0));
  const [split] = use.decks
    .filter((d) => (d.gamesApex ?? 0) >= 100 && (d.gamesHigh ?? 0) >= 100 && d.avgPlaceApex != null && d.avgPlaceHigh != null && gap(d) >= 0.1)
    .sort((a, b) => gap(b) - gap(a));
  if (split) {
    const easier = split.avgPlaceApex! > split.avgPlaceHigh! ? "다이아몬드·에메랄드" : "챌린저~마스터";
    out.push(
      `구간을 나눠 보면 ${withJosa(split.name, "은는")} 챌린저~마스터에서 ${split.avgPlaceApex!.toFixed(2)}등(${split.gamesApex!.toLocaleString()}판), ` +
      `다이아몬드·에메랄드에서 ${split.avgPlaceHigh!.toFixed(2)}등(${split.gamesHigh!.toLocaleString()}판)으로 ${easier} 쪽 성적이 더 좋습니다. ` +
      `티어는 두 구간을 합쳐서 매기므로 이 차이는 티어에 반영되지 않습니다.`,
    );
  }
  return out;
}

export function describeItem(it: { id: string; name: string }, rows: [string, { n: number; decks: Deck[] }][], siblings: { name: string }[]): string[] {
  const out: string[] = [];
  if (rows.length === 0) {
    out.push(`${withJosa(it.name, "은는")} 현재 상위 티어 덱의 1순위 빌드에는 거의 쓰이지 않습니다. 재료가 남을 때의 임시 조합으로는 갈 수 있습니다.`);
  } else {
    const deckIds = new Set(rows.flatMap(([, e]) => e.decks.map((d) => d.id)));
    const bestDeck = rows.flatMap(([uid, e]) => e.decks.map((d) => ({ d, uid }))).sort((a, b) => a.d.avgPlacement - b.d.avgPlacement)[0];
    out.push(
      `${withJosa(it.name, "을를")} 1순위로 드는 기물은 ${rows.length}명, 덱은 ${deckIds.size}개입니다. ` +
      (bestDeck ? `가장 성적이 좋은 조합은 ${bestDeck.d.name}(${bestDeck.d.tierLabel}티어, ${place(bestDeck.d)})의 ${unitById(bestDeck.uid)?.name}입니다.` : ""),
    );
  }
  if (siblings.length) out.push(`같은 재료를 쓰는 다른 완성 아이템으로는 ${siblings.slice(0, 5).map((s) => s.name).join(", ")}이 있어, 재료가 겹칠 때 무엇을 만들지 비교해 보세요.`);
  return out;
}

export function describeTrait(t: { name: string; breakpoints: number[] }, rows: { d: Deck; count: number }[]): string[] {
  const out: string[] = [];
  if (rows.length === 0) {
    out.push(`${withJosa(t.name, "은는")} 현재 상위 티어 덱에서 주력 시너지로 쓰이지 않습니다. 단계를 낮게 걸치는 보조 시너지로는 나올 수 있습니다.`);
    return out;
  }
  const avg = rows.reduce((s, r) => s + r.d.avgPlacement, 0) / rows.length;
  const cnt = new Map<number, number>();
  for (const r of rows) cnt.set(r.count, (cnt.get(r.count) ?? 0) + 1);
  const common = [...cnt].sort((a, b) => b[1] - a[1])[0][0];
  const carries = [...new Set(rows.map((r) => r.d.carryId).filter(Boolean))].slice(0, 4).map((c) => unitById(c!)?.name).filter(Boolean);
  out.push(`${t.name} 시너지를 쓰는 상위 티어 덱은 ${rows.length}개이고, 이 덱들의 평균 등수는 ${avg.toFixed(2)}등입니다. 가장 흔한 활성 단계는 ${common}명입니다.`);
  if (carries.length) out.push(`${t.name} 덱의 주요 캐리는 ${carries.join(", ")}입니다.`);
  return out;
}
