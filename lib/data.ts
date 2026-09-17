// TFT 시즌 18: 신비의 숲 (패치 18.2, 2026-09)
// 덱 데이터 출처: metatft.com 통계 (scripts/sync-meta.mjs)
import unitsJson from "./gen/units.json";
import itemsJson from "./gen/items.json";
import traitsJson from "./gen/traits.json";
import codesJson from "./gen/codes.json";

export type ComponentId =
  | "bf" | "bow" | "rod" | "tear"
  | "vest" | "cloak" | "belt" | "gloves" | "spatula" | "pan";

export const COMPONENTS: { id: ComponentId; name: string }[] = [
  { id: "bf",       name: "BF 대검" },
  { id: "bow",      name: "곡궁" },
  { id: "rod",      name: "쓸데없이 큰 지팡이" },
  { id: "tear",     name: "여신의 눈물" },
  { id: "vest",     name: "쇠사슬 조끼" },
  { id: "cloak",    name: "음전자 망토" },
  { id: "belt",     name: "거인의 허리띠" },
  { id: "gloves",   name: "연습용 장갑" },
  { id: "spatula",  name: "뒤집개" },
  { id: "pan",      name: "후라이팬" },
];

export type Item = {
  id: string;
  name: string;
  recipe: [ComponentId, ComponentId];
  img: string;
};

export type UnitId = string;
export type Unit = {
  id: UnitId;
  name: string;
  cost: 1 | 2 | 3 | 4 | 5;
  traits: string[];
  img: string;
};

// 유닛/완성 아이템은 `node scripts/sync.mjs [패치] [세트]` 로 CommunityDragon에서 생성 (lib/gen/)
export const UNITS = unitsJson as Unit[];
export const ITEMS = itemsJson as Item[];

export type Row = 0 | 1 | 2 | 3;              // 0=최전방, 3=최후방
export type Col = 0 | 1 | 2 | 3 | 4 | 5 | 6;
// pos 없으면 lib/board.ts 휴리스틱으로 자동 배치
export type DeckUnit = { unitId: UnitId; star: 1 | 2 | 3; pos?: [Row, Col] };
export type DeckItemPlacement = { unitId: UnitId; itemId: string };
export type LevelComp = { units: UnitId[]; avg: number; count: number };
export type Deck = {
  id: string;
  name: string;
  tierLabel: "OP" | "S" | "A" | "B" | "C";
  tier: 1 | 2 | 3 | 4 | 5;  // OP=1, S=2, A=3, B=4, C=5
  avgPlacement: number;
  games?: number;            // 표본 수
  winRate?: number;          // 1등 비율 (0~1)
  top4Rate?: number;         // Top4 비율 (0~1)
  pickRate?: number;         // 전체 보드 중 이 덱 비율 (0~1)
  levelling?: string;        // "Fast 8" | "Fast 9" | "Standard" | "lvl 7" (리롤)
  difficulty?: "쉬움" | "보통" | "어려움";
  threeStarTargets?: UnitId[];   // 이 덱에서 3성을 노리는 유닛
  carryId?: UnitId;          // 메인 캐리
  coreUnits: DeckUnit[];     // 최종 조합
  coreItems: DeckItemPlacement[];          // 1순위 빌드
  altItems?: Record<UnitId, string[]>;     // 유닛별 대체 아이템
  levels?: Record<string, LevelComp>;      // 레벨별(4~10) 최빈 조합
  counters?: { deckId: string; placeChange: number }[];  // 같이 만나면 불리한 덱 (+ = 내 등수 나빠짐)
  augments?: { id: string; tier: "S" | "A" | "B" }[];    // 덱별 추천 증강 (metatft)
  trends?: { day: string; avg: number; pick: number }[];  // 일자별 평균등수·픽률(%)
  proComps?: { title: string; author: string; notes: string; units: { unitId: UnitId; items: string[] }[] }[];  // 고랭커 공개 보드
  playstyle?: string;
};
export type Trait = { name: string; img: string; breakpoints: number[] };

// 덱 데이터는 lib/decks.ts (DB → 폴백 lib/gen/decks.json). 증강은 lib/augments.ts. 이 파일은 클라이언트 번들에도 들어가므로 가볍게 유지.
export const TRAITS = traitsJson as Record<string, Trait>;
const CODES = codesJson as { set: string; codes: Record<string, string> };
const TRAIT_BY_NAME = new Map(Object.values(TRAITS).map((t) => [t.name, t]));
export const traitByName = (name: string) => TRAIT_BY_NAME.get(name);

/** 유닛 목록의 활성 시너지: 인원수와 도달 단계(0 = 미활성). 인원 많은 순. */
export function activeTraits(unitIds: UnitId[]) {
  const count = new Map<string, number>();
  for (const id of new Set(unitIds)) for (const t of unitById(id)?.traits ?? []) count.set(t, (count.get(t) ?? 0) + 1);
  return [...count]
    .map(([name, n]) => {
      const t = TRAIT_BY_NAME.get(name);
      const level = t ? t.breakpoints.filter((b) => n >= b).length : 0;
      return { name, img: t?.img, count: n, level, max: t?.breakpoints.length ?? 0 };
    })
    .filter((t) => t.level > 0)
    .sort((a, b) => b.level - a.level || b.count - a.count);
}

export const unitById = (id: UnitId) => UNITS.find((u) => u.id === id);
export const itemById = (id: string) => ITEMS.find((i) => i.id === id);
export const deckById = (id: string, decks: Deck[]) => decks.find((d) => d.id === id);
export const componentById = (id: ComponentId) =>
  COMPONENTS.find((c) => c.id === id);

// 인게임 팀 플래너 코드: "02" + 슬롯 10개 × 3자리 hex(빈칸 000) + 세트키
export function teamCode(unitIds: UnitId[]): string | null {
  const ids = unitIds.filter((id) => CODES.codes[id]).slice(0, 10);
  if (ids.length === 0) return null;
  const slots = Array.from({ length: 10 }, (_, i) => CODES.codes[ids[i]] ?? "000").join("");
  return `02${slots}${CODES.set}`;
}

/** 유닛이 최종 조합에 들어가는 덱 + 그 덱들에서 쓰는 아이템(빈도순) */
export function unitUsage(unitId: UnitId, all: Deck[]) {
  const decks = all.filter((d) => d.coreUnits.some((u) => u.unitId === unitId)).sort((a, b) => a.avgPlacement - b.avgPlacement);
  const count = new Map<string, number>();
  for (const d of decks) for (const ci of d.coreItems) if (ci.unitId === unitId) count.set(ci.itemId, (count.get(ci.itemId) ?? 0) + 1);
  const items = [...count].sort((a, b) => b[1] - a[1]).map(([id]) => id);
  return { decks, items, carryOf: decks.filter((d) => d.carryId === unitId) };
}
