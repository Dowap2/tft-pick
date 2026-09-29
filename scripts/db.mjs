// Supabase PostgREST 최소 클라이언트 (service_role). supabase-js 는 Node 20에서 WebSocket 요구라 fetch 로.
const { NEXT_PUBLIC_SUPABASE_URL: URL_, SUPABASE_SERVICE_ROLE_KEY: KEY } = process.env;
if (!URL_ || !KEY) { console.error("✗ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 없음 — node --env-file=.env.local 로 실행"); process.exit(1); }
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

/** fetch 자체가 throw 하는 경우(DNS·연결 끊김)를 재시도로 흡수한다.
 *  상태 코드로 오지 않아 호출자가 못 잡고 프로세스가 그대로 죽었다 —
 *  실측: ENOTFOUND asia.api.riotgames.com 한 번에 170분 수집 잡이 5사이클만 돌고 끝났다.
 *  상시로 도는 스크립트라 일시적 장애는 삼키고 계속 가야 한다. */
export async function fetchRetry(url, init, label = "fetch", tries = 5) {
  for (let i = 0; ; i++) {
    try {
      return await fetch(url, init);
    } catch (e) {
      if (i >= tries) throw e;
      const wait = 2000 * (i + 1);
      console.warn(`  ${label} 네트워크 오류 (${e.cause?.code ?? e.message}) → ${wait / 1000}s 후 재시도 ${i + 1}/${tries}`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
}

export async function rpc(fn, params = {}, query = "") {
  const res = await fetchRetry(`${URL_}/rest/v1/rpc/${fn}${query ? `?${query}` : ""}`, { method: "POST", headers: H, body: JSON.stringify(params) }, `rpc ${fn}`);
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
  const res = await fetchRetry(`${URL_}/rest/v1/${table}?${query}`, { headers: H }, `select ${table}`);
  if (!res.ok) throw new Error(`select ${table}: ${res.status} ${await res.text()}`);
  return res.json();
}
/** upsert (PK/unique 충돌 시 갱신). 500행씩 분할 */
export async function upsert(table, rows, onConflict) {
  for (let i = 0; i < rows.length; i += 500) {
    const res = await fetchRetry(`${URL_}/rest/v1/${table}${onConflict ? `?on_conflict=${onConflict}` : ""}`, {
      method: "POST", headers: { ...H, Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(rows.slice(i, i + 500)),
    }, `upsert ${table}`);
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
  // ★ RedBuff: 세트 18 에서 DA_RedBuff = 붉은 덩굴정령(곡궁+곡궁) 인데, cdragon 의 레거시
  //   TFT_Item_RedBuff 는 태양불꽃 망토(흉갑+벨트)라 우리 id `redbuff` 가 그쪽을 가리킨다.
  //   별칭이 없으면 두 아이템이 redbuff 한 id 로 뭉개져, 곡궁+곡궁 통계가 영영 안 잡히고
  //   그 사용량이 "태양불꽃 망토" 라는 엉뚱한 이름으로 덱 추천템에 표시된다.
  //   (실측 2026-09-29: 애쉬에 붙은 "태양불꽃 망토 52%" 는 전부 붉은 덩굴정령이었다)
  //   scripts/check-item-ids.mts 가 조합식으로 전수 검증한다 — 세트가 바뀌면 다시 돌려라.
  RedBuff: "rapidfirecannon",
  KrakensFury: "runaanshurricane", EdgeOfNight: "guardianangel", NashorsTooth: "leviathan",
  VoidStaff: "statikkshiv", SpiritVisage: "redemption", StrikersFlail: "powergauntlet",
  SunfireCape: "redbuff", SteadfastHeart: "nightharvester", Evenshroud: "spectralgauntlet",
  ProtectorsVow: "frozenheart", HandOfJustice: "unstableconcoction", GiantSlayer: "madredsbloodrazor",
  TacticiansCape: "tacticiansring", TacticiansShield: "tacticiansscepter", TacticiansCrown: "forceofnature",
};
export function riotItemId(api) {
  // 상징(DA_18_EmblemInferno)은 정규 아이템이라 살린다. id 는 sync.mjs 와 같은 규칙(<특성>emblem).
  // 이게 없으면 상징을 낀 보드에서 그 칸이 통째로 버려져 덱 추천 아이템에 상징이 영영 안 뜬다.
  const emb = api.match(/^DA_\d+_Emblem([A-Za-z]+)$/);
  if (emb) return `${emb[1].toLowerCase()}emblem`;
  if (!/^DA_[A-Za-z]+$/.test(api) || /Radiant$/.test(api)) return null;   // 찬란/유물/재료 제외
  const key = api.slice(3);
  return ITEM_ALIAS[key] ?? key.toLowerCase();
}
