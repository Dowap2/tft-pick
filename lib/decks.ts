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

const TIER_NUM: Record<string, Deck["tier"]> = { OP: 1, S: 2, A: 3, B: 4, C: 5 };
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
    levelling: d.levelling ?? undefined, difficulty: d.difficulty ?? undefined,
    threeStarTargets: units.filter((u) => u.star === 3).map((u) => u.unitId),
    carryId: d.carry_unit_id,
    coreUnits: units.map((u): DeckUnit => ({ unitId: u.unitId, star: u.star, pos: u.pos ?? undefined })),
    coreItems: items.filter((i) => i.priority === 1).map((i) => ({ unitId: i.unitId, itemId: i.itemId })),
    altItems: alt, levels: d.levels ?? undefined, counters: d.counters ?? undefined,
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
