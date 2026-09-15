// TFT 시즌 18: 신비의 숲 (패치 18.2, 2026-09)
// 덱 데이터 출처: op.gg 한국판 메타 트렌드
import unitsJson from "./gen/units.json";
import itemsJson from "./gen/items.json";

export type ComponentId =
  | "bf" | "bow" | "rod" | "tear"
  | "vest" | "cloak" | "belt" | "gloves" | "spatula";

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

export type DeckUnit = { unitId: UnitId; star: 1 | 2 | 3 };
export type DeckItemPlacement = { unitId: UnitId; itemId: string };
export type Deck = {
  id: string;
  name: string;
  tierLabel: "OP" | "S" | "A" | "B" | "C";
  tier: 1 | 2 | 3 | 4 | 5;  // OP=1, S=2, A=3, B=4, C=5
  avgPlacement: number;
  coreUnits: DeckUnit[];
  coreItems: DeckItemPlacement[];
  playstyle?: string;
};

// op.gg 한국판 시즌 18 메타 트렌드 (patch 18.2) 기반
export const DECKS: Deck[] = [
  {
    id: "elderwood-draven",
    name: "나무정령 드레이븐",
    tierLabel: "OP",
    tier: 1,
    avgPlacement: 2.78,
    coreUnits: [
      { unitId: "draven",  star: 2 },
      { unitId: "maokai",  star: 2 },
      { unitId: "ezreal",  star: 2 },
      { unitId: "hecarim", star: 2 },
      { unitId: "xayah",   star: 2 },
      { unitId: "ornn",    star: 2 },
    ],
    coreItems: [
      { unitId: "draven", itemId: "deathblade" },
      { unitId: "draven", itemId: "guinsoosrageblade" },
      { unitId: "draven", itemId: "runaanshurricane" },
      { unitId: "maokai", itemId: "gargoylestoneplate" },
      { unitId: "maokai", itemId: "redemption" },
      { unitId: "maokai", itemId: "warmogsarmor" },
    ],
    playstyle: "나무정령 프론트라인 + 드레이븐 캐리. 최상위 메타.",
  },
  {
    id: "riftbeast-elder-dragon",
    name: "협곡야수 장로 드래곤",
    tierLabel: "OP",
    tier: 1,
    avgPlacement: 3.10,
    coreUnits: [
      { unitId: "elderdragon", star: 2 },
      { unitId: "sentry",      star: 2 },
      { unitId: "sentinel",     star: 2 },
      { unitId: "gromp",        star: 2 },
      { unitId: "murkwolf",     star: 2 },
    ],
    coreItems: [
      { unitId: "elderdragon", itemId: "infinityedge" },
      { unitId: "elderdragon", itemId: "lastwhisper" },
      { unitId: "elderdragon", itemId: "powergauntlet" },
      { unitId: "sentry",      itemId: "bluebuff" },
      { unitId: "sentry",      itemId: "jeweledgauntlet" },
      { unitId: "sentry",      itemId: "rabadonsdeathcap" },
    ],
    playstyle: "장로 드래곤 후반 캐리, 조약돌 보조 딜러.",
  },
  {
    id: "coven-cassiopeia",
    name: "마녀회 카시오페아",
    tierLabel: "S",
    tier: 2,
    avgPlacement: 3.42,
    coreUnits: [
      { unitId: "cassiopeia", star: 2 },
      { unitId: "rammus",     star: 2 },
      { unitId: "fiddlesticks",star: 2 },
      { unitId: "elise",      star: 2 },
      { unitId: "camille",    star: 2 },
    ],
    coreItems: [
      { unitId: "cassiopeia", itemId: "archangelsstaff" },
      { unitId: "cassiopeia", itemId: "bluebuff" },
      { unitId: "cassiopeia", itemId: "hextechgunblade" },
    ],
    playstyle: "마녀회 시너지 + 카시오페아 AP 캐리.",
  },
  {
    id: "rapidfire-kayle",
    name: "속사포 케일",
    tierLabel: "S",
    tier: 2,
    avgPlacement: 2.78,
    coreUnits: [
      { unitId: "kayle", star: 2 },
      { unitId: "ornn",  star: 2 },
      { unitId: "xayah", star: 2 },
      { unitId: "varus", star: 2 },
    ],
    coreItems: [
      { unitId: "kayle", itemId: "guinsoosrageblade" },
      { unitId: "kayle", itemId: "jeweledgauntlet" },
      { unitId: "kayle", itemId: "rabadonsdeathcap" },
    ],
    playstyle: "케일 하이브리드 딜러, 속사포 공격속도 극대화.",
  },
  {
    id: "adaptor-rengar",
    name: "적응가 렝가",
    tierLabel: "S",
    tier: 2,
    avgPlacement: 3.00,
    coreUnits: [
      { unitId: "rengar",    star: 3 },
      { unitId: "masteryi", star: 2 },
      { unitId: "vi",        star: 2 },
      { unitId: "khazix",    star: 2 },
    ],
    coreItems: [
      { unitId: "rengar", itemId: "guardianangel" },
      { unitId: "rengar", itemId: "guinsoosrageblade" },
      { unitId: "rengar", itemId: "titansresolve" },
    ],
    playstyle: "렝가 3성 리롤 캐리, 라이벌 시너지.",
  },
  {
    id: "brawler-reksai",
    name: "날렵이 렉사이",
    tierLabel: "S",
    tier: 2,
    avgPlacement: 3.15,
    coreUnits: [
      { unitId: "reksai", star: 3 },
      { unitId: "veigar", star: 2 },
      { unitId: "teemo",  star: 2 },
      { unitId: "kobuko", star: 2 },
    ],
    coreItems: [
      { unitId: "reksai", itemId: "gargoylestoneplate" },
      { unitId: "reksai", itemId: "gargoylestoneplate" },
      { unitId: "reksai", itemId: "warmogsarmor" },
    ],
    playstyle: "렉사이 3성 탱커 캐리.",
  },
  {
    id: "blossom-sett",
    name: "개화 세트",
    tierLabel: "S",
    tier: 2,
    avgPlacement: 3.94,
    coreUnits: [
      { unitId: "sett",   star: 2 },
      { unitId: "sivir",  star: 2 },
      { unitId: "ahri",   star: 2 },
      { unitId: "karma",  star: 2 },
      { unitId: "yorick", star: 2 },
    ],
    coreItems: [
      { unitId: "sett", itemId: "gargoylestoneplate" },
      { unitId: "sett", itemId: "gargoylestoneplate" },
      { unitId: "sett", itemId: "warmogsarmor" },
    ],
    playstyle: "세트 탱캐리 + 개화 시너지.",
  },
  {
    id: "hunter-sivir",
    name: "사냥꾼 시비르",
    tierLabel: "A",
    tier: 3,
    avgPlacement: 3.36,
    coreUnits: [
      { unitId: "sivir", star: 2 },
      { unitId: "ashe",  star: 2 },
      { unitId: "amumu", star: 2 },
      { unitId: "nidalee",star:2 },
    ],
    coreItems: [
      { unitId: "sivir", itemId: "infinityedge" },
      { unitId: "sivir", itemId: "spearofshojin" },
      { unitId: "sivir", itemId: "powergauntlet" },
    ],
    playstyle: "시비르 원거리 캐리, 사냥꾼 시너지.",
  },
  {
    id: "inferno-akali",
    name: "지옥불 아칼리",
    tierLabel: "A",
    tier: 3,
    avgPlacement: 3.35,
    coreUnits: [
      { unitId: "akali",  star: 3 },
      { unitId: "varus",  star: 2 },
      { unitId: "camille",star: 2 },
      { unitId: "shen",   star: 2 },
    ],
    coreItems: [
      { unitId: "akali", itemId: "guardianangel" },
      { unitId: "akali", itemId: "unstableconcoction" },
      { unitId: "akali", itemId: "jeweledgauntlet" },
    ],
    playstyle: "아칼리 3성 리롤 + 지옥불 시너지.",
  },
  {
    id: "inferno-draven",
    name: "지옥불 드레이븐",
    tierLabel: "A",
    tier: 3,
    avgPlacement: 3.14,
    coreUnits: [
      { unitId: "draven",       star: 2 },
      { unitId: "maokai",       star: 2 },
      { unitId: "elderdragon", star: 2 },
      { unitId: "kennen",       star: 2 },
      { unitId: "amumu",        star: 2 },
    ],
    coreItems: [
      { unitId: "draven", itemId: "deathblade" },
      { unitId: "draven", itemId: "guinsoosrageblade" },
      { unitId: "draven", itemId: "runaanshurricane" },
    ],
    playstyle: "드레이븐 캐리 + 지옥불 프론트라인.",
  },
  {
    id: "hunter-scuttlecrab",
    name: "사냥꾼 바위 게",
    tierLabel: "A",
    tier: 3,
    avgPlacement: 3.06,
    coreUnits: [
      { unitId: "scuttlecrab",star: 3 },
      { unitId: "sejuani",   star: 2 },
      { unitId: "caitlyn",   star: 2 },
      { unitId: "cinderling",star: 2 },
    ],
    coreItems: [
      { unitId: "scuttlecrab", itemId: "gargoylestoneplate" },
      { unitId: "scuttlecrab", itemId: "redemption" },
      { unitId: "scuttlecrab", itemId: "warmogsarmor" },
    ],
    playstyle: "바위 게 3성 탱커 캐리.",
  },
  {
    id: "riftbeast-pebbles",
    name: "협곡야수 조약돌",
    tierLabel: "A",
    tier: 3,
    avgPlacement: 4.45,
    coreUnits: [
      { unitId: "sentry",   star: 3 },
      { unitId: "raptor", star: 2 },
      { unitId: "krug",      star: 2 },
      { unitId: "gromp",     star: 2 },
      { unitId: "cinderling",star: 3 },
    ],
    coreItems: [
      { unitId: "sentry", itemId: "bluebuff" },
      { unitId: "sentry", itemId: "jeweledgauntlet" },
      { unitId: "sentry", itemId: "rabadonsdeathcap" },
    ],
    playstyle: "조약돌 3성 리롤, 저코 협곡야수 시너지.",
  },
  {
    id: "vanguard-morgana",
    name: "선봉대 모르가나",
    tierLabel: "A",
    tier: 3,
    avgPlacement: 3.99,
    coreUnits: [
      { unitId: "morgana",  star: 2 },
      { unitId: "alune",    star: 2 },
      { unitId: "sentinel", star: 2 },
      { unitId: "elise",    star: 2 },
      { unitId: "rakan",    star: 2 },
    ],
    coreItems: [
      { unitId: "morgana", itemId: "morellonomicon" },
      { unitId: "morgana", itemId: "rabadonsdeathcap" },
      { unitId: "morgana", itemId: "statikkshiv" },
    ],
    playstyle: "모르가나 AP 캐리 + 선봉대 탱커.",
  },
  {
    id: "elderwood-aphelios",
    name: "나무정령 아펠리오스",
    tierLabel: "A",
    tier: 3,
    avgPlacement: 3.93,
    coreUnits: [
      { unitId: "aphelios",star: 2 },
      { unitId: "lillia",  star: 2 },
      { unitId: "alune",   star: 2 },
      { unitId: "xayah",   star: 2 },
      { unitId: "ornn",    star: 2 },
    ],
    coreItems: [
      { unitId: "aphelios", itemId: "guinsoosrageblade" },
      { unitId: "aphelios", itemId: "infinityedge" },
      { unitId: "aphelios", itemId: "runaanshurricane" },
    ],
    playstyle: "아펠리오스 원딜 캐리, 나무정령 프론트라인.",
  },
  {
    id: "elderwood-rengar",
    name: "나무정령 렝가",
    tierLabel: "A",
    tier: 3,
    avgPlacement: 2.79,
    coreUnits: [
      { unitId: "rengar",   star: 3 },
      { unitId: "khazix",   star: 2 },
      { unitId: "hecarim",  star: 2 },
      { unitId: "alistar",  star: 2 },
    ],
    coreItems: [
      { unitId: "rengar", itemId: "guardianangel" },
      { unitId: "rengar", itemId: "guinsoosrageblade" },
      { unitId: "rengar", itemId: "titansresolve" },
    ],
    playstyle: "렝가 리롤 + 나무정령 프론트라인.",
  },
  {
    id: "executioner-sett",
    name: "처형자 세트",
    tierLabel: "B",
    tier: 4,
    avgPlacement: 3.33,
    coreUnits: [
      { unitId: "sett",   star: 2 },
      { unitId: "ezreal", star: 2 },
      { unitId: "soraka", star: 2 },
      { unitId: "yunara", star: 2 },
      { unitId: "azir",   star: 2 },
    ],
    coreItems: [
      { unitId: "sett", itemId: "gargoylestoneplate" },
      { unitId: "sett", itemId: "gargoylestoneplate" },
      { unitId: "sett", itemId: "warmogsarmor" },
    ],
    playstyle: "세트 탱캐리 + 처형자 시너지.",
  },
  {
    id: "elderwood-ezreal",
    name: "나무정령 이즈리얼",
    tierLabel: "B",
    tier: 4,
    avgPlacement: 4.20,
    coreUnits: [
      { unitId: "ezreal",  star: 2 },
      { unitId: "hecarim", star: 2 },
      { unitId: "soraka",  star: 2 },
      { unitId: "xayah",   star: 2 },
    ],
    coreItems: [
      { unitId: "ezreal", itemId: "deathblade" },
      { unitId: "ezreal", itemId: "infinityedge" },
      { unitId: "ezreal", itemId: "powergauntlet" },
    ],
    playstyle: "이즈리얼 원거리 캐리 + 나무정령 프론트라인.",
  },
  {
    id: "lunar-kayle",
    name: "달빛 케일",
    tierLabel: "B",
    tier: 4,
    avgPlacement: 2.98,
    coreUnits: [
      { unitId: "kayle",    star: 2 },
      { unitId: "diana",    star: 2 },
      { unitId: "aphelios", star: 2 },
      { unitId: "alune",    star: 2 },
    ],
    coreItems: [
      { unitId: "kayle", itemId: "guinsoosrageblade" },
      { unitId: "kayle", itemId: "guinsoosrageblade" },
      { unitId: "kayle", itemId: "jeweledgauntlet" },
    ],
    playstyle: "케일 캐리 + 달빛 시너지.",
  },
  {
    id: "hunter-nidalee",
    name: "사냥꾼 니달리",
    tierLabel: "B",
    tier: 4,
    avgPlacement: 2.45,
    coreUnits: [
      { unitId: "nidalee",  star: 2 },
      { unitId: "sivir",    star: 2 },
      { unitId: "malphite", star: 2 },
      { unitId: "ashe",     star: 2 },
    ],
    coreItems: [
      { unitId: "nidalee", itemId: "infinityedge" },
      { unitId: "nidalee", itemId: "spearofshojin" },
      { unitId: "nidalee", itemId: "steraksgage" },
    ],
    playstyle: "니달리 하이브리드 캐리 + 사냥꾼 시너지.",
  },

  // ---- 캐리 다양성 확보용 추가 덱 (tftacademy 참고) ----
  {
    id: "blossom-ahri",
    name: "개화 아리",
    tierLabel: "A",
    tier: 3,
    avgPlacement: 3.65,
    coreUnits: [
      { unitId: "ahri",    star: 2 },
      { unitId: "morgana", star: 2 },
      { unitId: "karma",   star: 2 },
      { unitId: "yorick",  star: 2 },
      { unitId: "yunara",  star: 2 },
      { unitId: "sentry", star: 2 },
    ],
    coreItems: [
      { unitId: "ahri",    itemId: "rabadonsdeathcap" },
      { unitId: "ahri",    itemId: "jeweledgauntlet" },
      { unitId: "ahri",    itemId: "statikkshiv" },
      { unitId: "morgana", itemId: "morellonomicon" },
    ],
    playstyle: "아리 AP 메인 캐리, 모르가나 세컨 딜러.",
  },
  {
    id: "coven-morgana",
    name: "마녀회 모르가나",
    tierLabel: "B",
    tier: 4,
    avgPlacement: 3.90,
    coreUnits: [
      { unitId: "morgana",    star: 2 },
      { unitId: "alune",      star: 2 },
      { unitId: "cassiopeia", star: 2 },
      { unitId: "elise",      star: 2 },
      { unitId: "camille",    star: 2 },
    ],
    coreItems: [
      { unitId: "morgana", itemId: "rabadonsdeathcap" },
      { unitId: "morgana", itemId: "morellonomicon" },
      { unitId: "morgana", itemId: "statikkshiv" },
    ],
    playstyle: "모르가나 AP 캐리 + 마녀회 시너지.",
  },
  {
    id: "blackthorn-warwick",
    name: "가시나무 워윅",
    tierLabel: "C",
    tier: 5,
    avgPlacement: 4.20,
    coreUnits: [
      { unitId: "warwick",  star: 3 },
      { unitId: "reksai",   star: 2 },
      { unitId: "veigar",   star: 2 },
      { unitId: "camille",  star: 2 },
      { unitId: "malphite", star: 2 },
    ],
    coreItems: [
      { unitId: "warwick", itemId: "spectralgauntlet" },
      { unitId: "warwick", itemId: "titansresolve" },
      { unitId: "warwick", itemId: "steraksgage" },
    ],
    playstyle: "워윅 3성 리롤 브루저 캐리.",
  },
  {
    id: "blossom-yunara",
    name: "개화 유나라",
    tierLabel: "C",
    tier: 5,
    avgPlacement: 4.30,
    coreUnits: [
      { unitId: "yunara", star: 3 },
      { unitId: "karma",  star: 2 },
      { unitId: "yorick", star: 2 },
      { unitId: "sett",   star: 2 },
      { unitId: "ahri",   star: 2 },
    ],
    coreItems: [
      { unitId: "yunara", itemId: "infinityedge" },
      { unitId: "yunara", itemId: "lastwhisper" },
      { unitId: "yunara", itemId: "madredsbloodrazor" },
    ],
    playstyle: "유나라 3성 원거리 캐리, 개화 처형자 시너지.",
  },
  {
    id: "sprykin-teemo",
    name: "스프라이킨 티모",
    tierLabel: "C",
    tier: 5,
    avgPlacement: 4.35,
    coreUnits: [
      { unitId: "teemo",   star: 3 },
      { unitId: "veigar",  star: 2 },
      { unitId: "kobuko",  star: 2 },
      { unitId: "rammus",  star: 2 },
      { unitId: "tristana",star: 2 },
    ],
    coreItems: [
      { unitId: "teemo", itemId: "rabadonsdeathcap" },
      { unitId: "teemo", itemId: "ionicspark" },
      { unitId: "teemo", itemId: "jeweledgauntlet" },
    ],
    playstyle: "티모 3성 리롤 AP 캐리.",
  },
  {
    id: "solar-akali",
    name: "태양 아칼리",
    tierLabel: "B",
    tier: 4,
    avgPlacement: 3.80,
    coreUnits: [
      { unitId: "akali",   star: 3 },
      { unitId: "leona",   star: 2 },
      { unitId: "sejuani", star: 2 },
      { unitId: "kayle",   star: 2 },
    ],
    coreItems: [
      { unitId: "akali", itemId: "guardianangel" },
      { unitId: "akali", itemId: "infinityedge" },
      { unitId: "akali", itemId: "unstableconcoction" },
    ],
    playstyle: "아칼리 3성 AD 암살자 리롤 + 태양 프론트라인.",
  },
];

export const unitById = (id: UnitId) => UNITS.find((u) => u.id === id);
export const itemById = (id: string) => ITEMS.find((i) => i.id === id);
export const deckById = (id: string) => DECKS.find((d) => d.id === id);
export const componentById = (id: ComponentId) =>
  COMPONENTS.find((c) => c.id === id);
