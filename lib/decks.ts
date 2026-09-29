// 덱 데이터 소스 (서버 전용): Supabase decks_bundle → UI Deck. 실패/비어있으면 lib/gen/decks.json(metatft 스냅샷) 폴백.
// 정적 페이지는 빌드 타임에, API 는 요청 시(1시간 캐시) 호출.
import { DECK_NOTES } from "./deck-notes";
import type { Deck, DeckUnit } from "./data";
import type { EngineDeck } from "./engine/score";
import { toEngineDeck } from "./engine/adapt";

// JSON 폴백은 지연 로드 — 135KB 파싱을 Worker 콜드 스타트마다 하지 않도록 (DB 실패 시에만)
export async function loadDecksJson(): Promise<Deck[]> {
  return (await import("./decks-json")).DECKS_JSON;
}

const TIER_NUM: Record<string, Deck["tier"]> = { OP: 1, S: 2, A: 3, B: 4, C: 5, D: 6 };
const TTL_MS = 60 * 60 * 1000;
type Cached = { at: number; decks: Deck[]; engineDecks: EngineDeck[]; source: "db" | "json"; patch: string };
let cache: Cached | null = null;

type Row = Record<string, any>;
// 전부 GET → Cloudflare 엣지 캐시(cf.cacheTtl) 적용 가능. 콜드 아이솔레이트도 원본(Supabase) 왕복 없이 엣지에서 받음.
const EDGE_TTL = 3600;
async function rest(path: string): Promise<Row[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;   // 핸들러 안에서 읽기 (Workers 런타임 바인딩)
  if (!url || !key) throw new Error("supabase env 없음");
  const res = await fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    // Workers 전용 옵션. Node 에선 무시됨
    ...({ cf: { cacheTtl: EDGE_TTL, cacheEverything: true } } as RequestInit),
  });
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

function toDeck(d: Row, tier: string | undefined): Deck {
  const units: Row[] = d.units ?? [];
  const items: Row[] = d.items ?? [];
  const alt: Record<string, string[]> = {};
  for (const i of items) if (i.priority > 1) (alt[i.unitId] ??= []).push(i.itemId);
  const tierLabel = (tier ?? "B") as Deck["tierLabel"];
  return {
    id: d.id, name: d.name, tierLabel, tier: TIER_NUM[tierLabel] ?? 4,
    avgPlacement: Number(d.avg_place), games: d.games ?? undefined,
    winRate: d.win_rate == null ? undefined : Number(d.win_rate), top4Rate: d.top4_rate == null ? undefined : Number(d.top4_rate), pickRate: d.pick_rate == null ? undefined : Number(d.pick_rate),
    gamesApex: d.games_apex ?? undefined, avgPlaceApex: d.avg_place_apex == null ? undefined : Number(d.avg_place_apex),
    gamesHigh: d.games_high ?? undefined, avgPlaceHigh: d.avg_place_high == null ? undefined : Number(d.avg_place_high),
    levelling: d.levelling ?? undefined, difficulty: d.difficulty ?? undefined,
    threeStarTargets: units.filter((u) => u.star === 3).map((u) => u.unitId),
    carryId: d.carry_unit_id,
    coreUnits: units.map((u): DeckUnit => ({ unitId: u.unitId, star: u.star, pos: u.pos ?? undefined })),
    // 뷰가 priority → place_delta 순으로 정렬해 준다 (§4.11). 그 순서를 그대로 쓴다.
    coreItems: items.filter((i) => i.priority === 1).map((i) => ({ unitId: i.unitId, itemId: i.itemId, placeDelta: i.placeDelta ?? undefined })),
    altItems: alt, levels: d.levels ?? undefined, counters: d.counters ?? undefined,
    augments: d.augments ?? undefined,
    playstyle: d.playstyle ?? undefined,
  };
}

export async function getDecksMeta(): Promise<Cached> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache;
  let decks: Deck[] | null = null, source: Cached["source"] = "db", patch = "json";
  try {
    const [p] = await rest("patches?select=id,version&is_current=eq.true");
    if (p) {
      // 티어 함수도 GET (stable 함수는 PostgREST 가 GET 허용) → 캐시 가능
      const [rows, tiers] = await Promise.all([rest(`decks_bundle?select=*&patch_id=eq.${p.id}`), rest(`rpc/calculate_deck_tiers?target_patch_id=${p.id}`)]);
      if (rows.length) {
        const tier = new Map(tiers.map((t) => [t.deck_id, t.tier_label as string]));
        decks = rows.map((r) => toDeck(r, tier.get(r.id))).map((d) => ({ ...d, ...DECK_NOTES[d.name] })).sort((a, b) => a.tier - b.tier || a.avgPlacement - b.avgPlacement);
        patch = p.version;
      }
    }
  } catch (e) {
    console.warn("[decks] db 실패, json 폴백:", (e as Error).message);
  }
  if (!decks) { decks = await loadDecksJson(); source = "json"; }
  // 엔진용 변환은 번들당 1회 (요청마다 하지 않음)
  cache = { at: Date.now(), decks, engineDecks: decks.map(toEngineDeck), source, patch };
  return cache;
}
export const getDecks = async () => (await getDecksMeta()).decks;

// ── 에디터 덱 (0022_editorial_decks.sql) ──────────────────────────────
// 사람이 직접 만든 덱. 통계 기준(§5)을 타지 않으므로 티어도 평균 등수도 없다.
// 타입을 Deck 과 분리해 둔 이유: 티어·표본을 옵셔널로 끼우면 화면에서 둘이 섞이고,
// "자체 수집 통계" 라는 설명과 모순되는 숫자가 나간다.
export type EditorialDeck = {
  id: string; name: string; playstyle?: string; carryId?: string; coreUnitIds: string[];
  levelling?: string; difficulty?: string; requirementNote?: string;
  units: { unitId: string; star: number; pos?: [number, number] | null; core?: boolean }[];
  items: { unitId: string; itemId: string; role: string; priority: number }[];
  levels: Record<string, { units: string[] }>;
};

let editorialCache: Promise<EditorialDeck[]> | null = null;
export function getEditorialDecks(): Promise<EditorialDeck[]> {
  // 뷰가 없는 환경(마이그레이션 전)에서도 빌드는 통과해야 한다 → 실패는 빈 배열.
  editorialCache ??= (async () => {
    try {
      const rows = await rest("decks_editorial?select=*");
      return rows.map((d): EditorialDeck => ({
        id: d.id, name: d.name, playstyle: d.playstyle ?? undefined, carryId: d.carry_unit_id ?? undefined,
        coreUnitIds: d.core_unit_ids ?? [], levelling: d.levelling ?? undefined,
        difficulty: d.difficulty ?? undefined, requirementNote: d.requirement_note ?? undefined,
        units: d.units ?? [], items: d.items ?? [], levels: d.levels ?? {},
      })).filter((d) => d.units.length > 0);
    } catch (e) {
      console.warn("[decks] decks_editorial 조회 실패 → 에디터 덱 생략:", (e as Error).message);
      return [];
    }
  })();
  return editorialCache;
}

// ── 내려간 덱 (0020_decks_retired.sql) ────────────────────────────────
// 자격에서 떨어져 티어 리스트에 안 나오는 덱. 예전 링크가 404 되지 않게 페이지만 남긴다.
// 사이트맵에도, 추천에도, 내부 링크에도 넣지 않는다 — 옛 링크로 들어온 사람만 닿는 페이지다.
export type RetiredDeck = {
  id: string; name: string; carryId?: string; levelling?: string;
  games?: number; avgPlacement?: number; winRate?: number; top4Rate?: number;
  units: { unitId: string; star: number }[];
};

let retiredCache: Promise<RetiredDeck[]> | null = null;
export function getRetiredDecks(): Promise<RetiredDeck[]> {
  // 뷰가 아직 없는 환경(마이그레이션 전·JSON 폴백)에서도 빌드는 통과해야 한다 → 실패는 빈 배열.
  retiredCache ??= (async () => {
    try {
      const rows = await rest("decks_retired?select=*");
      return rows
        .map((d): RetiredDeck => ({
          id: d.id, name: d.name, carryId: d.carry_unit_id ?? undefined, levelling: d.levelling ?? undefined,
          games: d.games ?? undefined,
          avgPlacement: d.avg_place == null ? undefined : Number(d.avg_place),
          winRate: d.win_rate == null ? undefined : Number(d.win_rate),
          top4Rate: d.top4_rate == null ? undefined : Number(d.top4_rate),
          units: (d.units ?? []) as RetiredDeck["units"],
        }))
        // 조합을 못 그리면 보여줄 게 없다. 그런 행은 페이지를 만들지 않는다.
        .filter((d) => d.units.length > 0);
    } catch (e) {
      console.warn("[decks] decks_retired 조회 실패 → 은퇴 덱 페이지 생략:", (e as Error).message);
      return [];
    }
  })();
  return retiredCache;
}
