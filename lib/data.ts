// TFT 시즌 18: 신비의 숲 (패치 18.2, 2026-09)
// 덱 데이터 출처: metatft.com 통계 (scripts/sync-meta.mjs)
import unitsJson from "./gen/units.json";
import itemsJson from "./gen/items.json";
import decksJson from "./gen/decks.json";

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
  carryId?: UnitId;          // metatft 아이템 빌드 score 1위 유닛
  coreUnits: DeckUnit[];     // 최종 조합
  coreItems: DeckItemPlacement[];
  levels?: Record<string, LevelComp>;  // 레벨별(4~10) 최빈 조합
  playstyle?: string;
};

// 덱은 `node scripts/sync-meta.mjs` 로 metatft 통계에서 생성 (lib/gen/decks.json)
export const DECKS = decksJson as unknown as Deck[];

export const unitById = (id: UnitId) => UNITS.find((u) => u.id === id);
export const itemById = (id: string) => ITEMS.find((i) => i.id === id);
export const deckById = (id: string) => DECKS.find((d) => d.id === id);
export const componentById = (id: ComponentId) =>
  COMPONENTS.find((c) => c.id === id);
