// Supabase PostgREST 최소 클라이언트 (service_role). supabase-js 는 Node 20에서 WebSocket 요구라 fetch 로.
const { NEXT_PUBLIC_SUPABASE_URL: URL_, SUPABASE_SERVICE_ROLE_KEY: KEY } = process.env;
if (!URL_ || !KEY) { console.error("✗ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 없음 — node --env-file=.env.local 로 실행"); process.exit(1); }
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

export async function rpc(fn, params = {}, query = "") {
  const res = await fetch(`${URL_}/rest/v1/rpc/${fn}${query ? `?${query}` : ""}`, { method: "POST", headers: H, body: JSON.stringify(params) });
  if (!res.ok) throw new Error(`rpc ${fn}: ${res.status} ${await res.text()}`);
  const t = await res.text();
  return t ? JSON.parse(t) : null;
}
/** setof 를 반환하는 rpc 전부 읽기 (PostgREST max-rows 1000 → limit/offset 순회. Range 헤더는 RPC에서 무시됨). max 행에서 중단 */
export async function rpcAll(fn, params = {}, order = "", page = 1000, max = Infinity) {
  const out = [];
  for (let offset = 0; out.length < max; offset += page) {
    const rows = await rpc(fn, params, `limit=${page}&offset=${offset}${order ? `&order=${order}` : ""}`);
    out.push(...rows);
    if (rows.length < page) break;
  }
  return out;
}
export async function select(table, query = "") {
  const res = await fetch(`${URL_}/rest/v1/${table}?${query}`, { headers: H });
  if (!res.ok) throw new Error(`select ${table}: ${res.status} ${await res.text()}`);
  return res.json();
}
/** upsert (PK/unique 충돌 시 갱신). 500행씩 분할 */
export async function upsert(table, rows, onConflict) {
  for (let i = 0; i < rows.length; i += 500) {
    const res = await fetch(`${URL_}/rest/v1/${table}${onConflict ? `?on_conflict=${onConflict}` : ""}`, {
      method: "POST", headers: { ...H, Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(rows.slice(i, i + 500)),
    });
    if (!res.ok) throw new Error(`upsert ${table}: ${res.status} ${await res.text()}`);
  }
  return rows.length;
}
export async function currentPatch() {
  const [p] = await select("patches", "select=id,set_number,version&is_current=eq.true");
  if (!p) throw new Error("patches 에 is_current 행 없음");
  return p;
}

// metatft/Riot 아이템명(DA_GuinsoosRageblade) → 우리 item id (cdragon apiName 소문자)
const ITEM_ALIAS = {
  KrakensFury: "runaanshurricane", EdgeOfNight: "guardianangel", NashorsTooth: "leviathan",
  VoidStaff: "statikkshiv", SpiritVisage: "redemption", StrikersFlail: "powergauntlet",
  SunfireCape: "redbuff", SteadfastHeart: "nightharvester", Evenshroud: "spectralgauntlet",
  ProtectorsVow: "frozenheart", HandOfJustice: "unstableconcoction", GiantSlayer: "madredsbloodrazor",
  TacticiansCape: "tacticiansring", TacticiansShield: "tacticiansscepter", TacticiansCrown: "forceofnature",
};
export function riotItemId(api) {
  if (!/^DA_[A-Za-z]+$/.test(api) || /Radiant$/.test(api)) return null;   // 찬란/유물/상징/재료 제외
  const key = api.slice(3);
  return ITEM_ALIAS[key] ?? key.toLowerCase();
}
