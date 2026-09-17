// 덱 데이터 소스 (서버 전용): Supabase decks_bundle → UI Deck. 실패/비어있으면 lib/gen/decks.json(metatft 스냅샷) 폴백.
// 정적 페이지는 빌드 타임에, API 는 요청 시(1시간 캐시) 호출.
import decksJson from "./gen/decks.json";
import { DECK_NOTES } from "./deck-notes";
import type { Deck, DeckUnit } from "./data";

export const DECKS_JSON: Deck[] = (decksJson as unknown as Deck[]).map((d) => ({ ...d, ...DECK_NOTES[d.name] }));

const TIER_NUM: Record<string, Deck["tier"]> = { OP: 1, S: 2, A: 3, B: 4, C: 5 };
const TTL_MS = 60 * 60 * 1000;
let cache: { at: number; decks: Deck[]; source: "db" | "json"; patch: string } | null = null;

type Row = Record<string, any>;
async function rest(path: string): Promise<Row[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;   // 핸들러 안에서 읽기 (Workers 런타임 바인딩)
  if (!url || !key) throw new Error("supabase env 없음");
  const res = await fetch(`${url}/rest/v1/${path}`, { headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, ...(path.startsWith("rpc/") ? { method: "POST", body: path.includes("?") ? undefined : "{}" } : {}) });
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

export async function getDecksMeta(): Promise<{ decks: Deck[]; source: "db" | "json"; patch: string }> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache;
  let result: typeof cache = null;
  try {
    const [p] = await rest("patches?select=id,version&is_current=eq.true");
    if (p) {
      const [rows, tiers] = await Promise.all([
        rest(`decks_bundle?select=*&patch_id=eq.${p.id}`),
        fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/calculate_deck_tiers`, { method: "POST", headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, "Content-Type": "application/json" }, body: JSON.stringify({ target_patch_id: p.id }) }).then((r) => r.json() as Promise<Row[]>),
      ]);
      if (rows.length) {
        const tier = new Map(tiers.map((t) => [t.deck_id, t.tier_label as string]));
        const decks = rows.map((r) => toDeck(r, tier.get(r.id))).map((d) => ({ ...d, ...DECK_NOTES[d.name] })).sort((a, b) => a.tier - b.tier || a.avgPlacement - b.avgPlacement);
        result = { at: Date.now(), decks, source: "db", patch: p.version };
      }
    }
  } catch (e) {
    console.warn("[decks] db 실패, json 폴백:", (e as Error).message);
  }
  cache = result ?? { at: Date.now(), decks: DECKS_JSON, source: "json", patch: "json" };
  return cache;
}
export const getDecks = async () => (await getDecksMeta()).decks;
