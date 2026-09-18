// 덱 데이터 → 초보용 한국어 설명문 (정적 빌드 시 생성). 사람이 쓴 playstyle(deck-notes) 이 있으면 그 뒤에 붙는다.
import { activeTraits, itemById, unitById, type Deck } from "./data";

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
  out.push(`${deck.name}은(는) ${kind}입니다. 핵심 시너지는 ${traits.map((t) => `${t.name} ${t.count}`).join(", ")}${deck.difficulty ? `, 난이도는 ${deck.difficulty}` : ""}.`);

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
