import { unitById, type Deck, type DeckUnit, type Row, type Col } from "./data";

export type Placed = DeckUnit & { pos: [Row, Col] };

const FRONT = new Set(["엄호대", "선봉대", "싸움꾼", "전쟁기계", "거석"]);

// 가운데(3)부터 바깥으로: 3,2,4,1,5,0,6
const CENTER_OUT: Col[] = [3, 2, 4, 1, 5, 0, 6];

// ponytail: 특성 기반 휴리스틱. 덱별 정확한 자리는 DeckUnit.pos 로 덮어쓴다.
export function placeUnits(deck: Deck): Placed[] {
  const taken = new Set<string>();
  const out: Placed[] = [];
  const auto: DeckUnit[] = [];

  for (const u of deck.coreUnits) {
    if (u.pos) { taken.add(u.pos.join(",")); out.push(u as Placed); }
    else auto.push(u);
  }

  const rowOf = (u: DeckUnit): Row => {
    const traits = unitById(u.unitId)?.traits ?? [];
    if (traits.some((t) => FRONT.has(t))) return 0;
    return 3; // 탱커 특성 없으면 후방 (원딜/딜러 대부분)
  };

  // 같은 줄 안에서 코스트 높은 순 → 가운데부터
  auto.sort((a, b) => (unitById(b.unitId)?.cost ?? 0) - (unitById(a.unitId)?.cost ?? 0));
  for (const u of auto) {
    let row = rowOf(u);
    let placed = false;
    // 해당 줄이 꽉 차면 한 줄 안쪽으로
    for (let tries = 0; tries < 4 && !placed; tries++) {
      for (const col of CENTER_OUT) {
        const key = `${row},${col}`;
        if (taken.has(key)) continue;
        taken.add(key);
        out.push({ ...u, pos: [row, col] });
        placed = true;
        break;
      }
      row = (row === 0 ? 1 : row === 3 ? 2 : row + 1) as Row;
    }
  }
  return out;
}
