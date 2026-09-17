// 덱 번들 로더: Supabase(decks_bundle + 마스터) → EngineDeck/EngineCtx. DB가 비었거나 실패하면 로컬 JSON 폴백.
// fetch 만 사용 → Node·Edge(Workers)·Netlify 함수 어디서나 동작. 모듈 캐시 1시간(인스턴스 단위) + Cache API 있으면 병행.
import type { EngineCtx, EngineDeck, ItemRole, Star } from "./score";

export type Bundle = { source: "db" | "json"; patch: string; decks: EngineDeck[]; ctx: EngineCtx };

const TTL_MS = 60 * 60 * 1000;
let mem: { at: number; key: string; bundle: Bundle } | null = null;

type Row = Record<string, any>;
async function rest(url: string, key: string, path: string, init: RequestInit = {}): Promise<Row[]> {
  const res = await fetch(`${url}/rest/v1/${path}`, { ...init, headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(init.headers ?? {}) } });
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function fromDb(patch: string): Promise<Bundle | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  const [p] = await rest(url, key, patch === "current" ? "patches?select=id,version,set_number&is_current=eq.true" : `patches?select=id,version,set_number&version=eq.${encodeURIComponent(patch)}`);
  if (!p) return null;
  const q = `patch_id=eq.${p.id}`;
  const [decks, tiers, units, items, unitTraits, traits] = await Promise.all([
    rest(url, key, `decks_bundle?select=*&${q}`),
    rest(url, key, "rpc/calculate_deck_tiers", { method: "POST", body: JSON.stringify({ target_patch_id: p.id }) }),
    rest(url, key, `units?select=id,name,cost&${q}`),
    rest(url, key, `items?select=id,name,recipe,kind&${q}`),
    rest(url, key, `unit_traits?select=unit_id,trait_id&${q}`),
    rest(url, key, `traits?select=id,name,breakpoints&${q}`),
  ]);
  if (decks.length === 0) return null;

  const tier = new Map(tiers.map((t) => [t.deck_id, t.tier_label as string]));
  const unit = new Map(units.map((u) => [u.id, u]));
  const item = new Map(items.map((i) => [i.id, i]));
  const trait = new Map(traits.map((t) => [t.id, t]));
  const ut = new Map<string, string[]>();
  for (const r of unitTraits) ut.set(r.unit_id, [...(ut.get(r.unit_id) ?? []), r.trait_id]);

  const engineDecks: EngineDeck[] = decks.map((d) => ({
    id: d.id, name: d.name, carryUnitId: d.carry_unit_id, coreUnitIds: d.core_unit_ids ?? [],
    avgPlace: Number(d.avg_place), tierLabel: tier.get(d.id) ?? null,
    units: (d.units ?? []).map((u: Row) => ({ unitId: u.unitId, star: u.star as Star, core: u.core })),
    items: (d.items ?? []).map((i: Row) => ({ unitId: i.unitId, itemId: i.itemId, role: i.role as ItemRole, priority: i.priority })),
    levels: d.levels ?? undefined, counters: d.counters ?? undefined,
    requiresAugment: d.requires_augment, requiresSpecialItem: d.requires_special_item,
    qualifierLabel: d.qualifier_label, requirementNote: d.requirement_note,
  }));
  const ctx: EngineCtx = {
    itemRecipe: (id) => item.get(id)?.recipe ?? undefined,
    unitCost: (id) => unit.get(id)?.cost ?? 1,
    unitTraits: (id) => ut.get(id) ?? [],
    traitBreakpoints: (id) => trait.get(id)?.breakpoints ?? [],
    unitName: (id) => unit.get(id)?.name ?? id,
    itemName: (id) => item.get(id)?.name ?? id,
    traitName: (id) => trait.get(id)?.name ?? id,
  };
  return { source: "db", patch: p.version, decks: engineDecks, ctx };
}

async function fromJson(): Promise<Bundle> {
  const { engineDecks, jsonCtx } = await import("./adapt");
  const meta = (await import("@/lib/gen/meta.json")).default as { patch: string };
  return { source: "json", patch: meta.patch, decks: engineDecks, ctx: jsonCtx };
}

export async function loadBundle(patch = "current"): Promise<Bundle> {
  const key = patch;
  if (mem && mem.key === key && Date.now() - mem.at < TTL_MS) return mem.bundle;
  let bundle: Bundle | null = null;
  try { bundle = await fromDb(patch); } catch (e) { console.warn("[recommend] db bundle failed, fallback json:", (e as Error).message); }
  if (!bundle) bundle = await fromJson();
  mem = { at: Date.now(), key, bundle };
  return bundle;
}
