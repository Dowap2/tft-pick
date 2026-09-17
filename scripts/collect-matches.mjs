// Riot TFT Match-V5 수집기 → raw.matches / raw.participants (Supabase RPC ingest_match)
//
// 실행:  node --env-file=.env.local scripts/collect-matches.mjs [옵션]
//   --tiers challenger,grandmaster,master   시드 플레이어 티어 (기본 challenger,grandmaster)
//   --per-player 20                          플레이어당 최근 매치 수 (최대 200)
//   --max-matches 500                        이번 실행에서 적재할 최대 매치 수
//   --queue 1100                             1100 = 랭크만 (기본). 0 = 전부
//   --dry-run                                DB에 안 쓰고 카운트만
//
// 필요 env: RIOT_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// 레이트 리밋(개발 키): 20 req/s, 100 req/2min → 아래 limiter 가 자동으로 맞춤. 429 는 Retry-After 대기.

const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => a.startsWith("--") ? [a.slice(2), all[i + 1]?.startsWith("--") || all[i + 1] == null ? true : all[i + 1]] : []).filter(Boolean));
const TIERS = String(args.tiers ?? "challenger,grandmaster").split(",");
const PER_PLAYER = Math.min(200, Number(args["per-player"] ?? 20));
const MAX_MATCHES = Number(args["max-matches"] ?? 500);
const QUEUE = Number(args.queue ?? 1100);
const DRY = !!args["dry-run"];

const { RIOT_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!RIOT_API_KEY) die("RIOT_API_KEY 없음 (.env.local)");
if (!DRY && (!NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY)) die("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 없음 (.env.local)");
function die(msg) { console.error("✗", msg); process.exit(1); }

const PLATFORM = "https://kr.api.riotgames.com";     // 리그·소환사 (플랫폼 라우팅)
const REGION = "https://asia.api.riotgames.com";     // 매치 (지역 라우팅)

// ---- 레이트 리미터: 20/1s, 100/120s 두 창을 동시에 만족 ----
const windows = [{ limit: 20, ms: 1000, hits: [] }, { limit: 100, ms: 120_000, hits: [] }];
async function throttle() {
  for (;;) {
    const now = Date.now();
    let wait = 0;
    for (const w of windows) {
      w.hits = w.hits.filter((t) => now - t < w.ms);
      if (w.hits.length >= w.limit) wait = Math.max(wait, w.hits[0] + w.ms - now + 5);
    }
    if (!wait) break;
    await sleep(wait);
  }
  for (const w of windows) w.hits.push(Date.now());
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let reqCount = 0;
async function riot(url, attempt = 0) {
  await throttle();
  reqCount++;
  const res = await fetch(url, { headers: { "X-Riot-Token": RIOT_API_KEY } });
  if (res.status === 429) {
    const ra = Number(res.headers.get("retry-after") ?? 5);
    console.warn(`  429 rate limited → ${ra}s 대기`);
    await sleep(ra * 1000 + 200);
    return riot(url, attempt + 1);
  }
  if ((res.status >= 500 || res.status === 403) && attempt < 3) { await sleep(1000 * (attempt + 1)); return riot(url, attempt + 1); }
  if (res.status === 403) die("403 — API 키 만료/무효 (개발 키는 24시간). developer.riotgames.com 에서 재발급");
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

// ---- Supabase PostgREST 직접 호출 (supabase-js 는 Node 20에서 WebSocket 요구 → fetch 로 충분) ----
const SB_HEADERS = { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json" };
async function rpc(fn, params = {}) {
  const res = await fetch(`${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/${fn}`, { method: "POST", headers: SB_HEADERS, body: JSON.stringify(params) });
  if (!res.ok) throw new Error(`${fn}: ${res.status} ${await res.text()}`);
  return res.json();
}
async function select(table, query) {
  const res = await fetch(`${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${table}?${query}`, { headers: SB_HEADERS });
  if (!res.ok) throw new Error(`${table}: ${res.status} ${await res.text()}`);
  return res.json();
}

// ---- 1) 현재 패치 (match 응답의 game_version 은 "TFT Unreal Version ?.?.?.?" 라 쓸모없음 → patches.is_current) ----
let patch = null;
if (!DRY) {
  [patch] = await select("patches", "select=id,set_number,version&is_current=eq.true");
  if (!patch) die("patches 에 is_current 행이 없음. 먼저: insert into patches (set_number, version, is_current) values (18, '16.18', true);");
  console.log(`패치: set ${patch.set_number} / ${patch.version} (id ${patch.id})`);
}

// ---- 2) 시드 플레이어 (챌린저/그마/마스터 리그 엔트리에 puuid 포함) ----
const seeds = new Map(); // puuid → tier
for (const tier of TIERS) {
  const league = await riot(`${PLATFORM}/tft/league/v1/${tier}`);
  for (const e of league?.entries ?? []) if (e.puuid) seeds.set(e.puuid, tier.toUpperCase());
  console.log(`${tier}: ${league?.entries?.length ?? 0}명`);
}
console.log(`시드 플레이어 ${seeds.size}명, 플레이어당 ${PER_PLAYER}판, 최대 ${MAX_MATCHES}판${DRY ? " (dry-run)" : ""}`);

// ---- 3) 매치 id 수집 → 중복 제거 → DB에 이미 있는 것 제외 ----
const ids = new Set();
for (const puuid of seeds.keys()) {
  const list = await riot(`${REGION}/tft/match/v1/matches/by-puuid/${puuid}/ids?count=${PER_PLAYER}`);
  for (const id of list ?? []) ids.add(id);
  if (ids.size >= MAX_MATCHES * 3) break;   // 넉넉히 모았으면 중단 (중복·기존 제외 감안)
}
let todo = [...ids];
if (!DRY) {
  const existing = new Set();
  for (let i = 0; i < todo.length; i += 500) for (const id of await rpc("existing_match_ids", { ids: todo.slice(i, i + 500) })) existing.add(id);
  todo = todo.filter((id) => !existing.has(id));
  console.log(`매치 id ${ids.size}개 중 신규 ${todo.length}개`);
}
todo = todo.slice(0, MAX_MATCHES);

// ---- 4) 매치 상세 → 적재 ----
let stored = 0, skipped = 0;
const t0 = Date.now();
for (const [i, id] of todo.entries()) {
  const m = await riot(`${REGION}/tft/match/v1/matches/${id}`);
  const info = m?.info;
  if (!info) { skipped++; continue; }
  if (QUEUE && (info.queue_id ?? info.queueId) !== QUEUE) { skipped++; continue; }
  if (patch && info.tft_set_number !== patch.set_number) { skipped++; continue; }

  const participants = info.participants.map((p) => {
    const top4 = p.placement <= 4;   // 지시서: 보드는 1~4등만 저장
    return {
      puuid: p.puuid, placement: p.placement, level: p.level, last_round: p.last_round ?? null,
      tier: seeds.get(p.puuid) ?? null,
      units: top4 ? p.units.map((u) => ({ character_id: u.character_id, tier: u.tier, items: u.itemNames ?? [] })) : null,
      traits: top4 ? p.traits.filter((t) => t.tier_current > 0).map((t) => ({ name: t.name, num_units: t.num_units, tier_current: t.tier_current })) : null,
      augments: top4 ? (p.augments ?? []) : [],
    };
  });
  const row = {
    match_id: id, patch_id: patch?.id ?? 0,
    game_version: `${info.tft_set_core_name ?? "set"}/${info.game_version ?? ""}`.slice(0, 80),
    queue_id: info.queue_id ?? info.queueId ?? 0,
    played_at: new Date(info.game_datetime).toISOString(),
  };
  if (DRY) { stored++; }
  else if (await rpc("ingest_match", { m: row, ps: participants })) stored++;
  else skipped++;
  if ((i + 1) % 50 === 0) console.log(`  ${i + 1}/${todo.length}  적재 ${stored}  요청 ${reqCount}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}

console.log(`\n완료: 적재 ${stored}, 건너뜀 ${skipped}, Riot 요청 ${reqCount}회, ${((Date.now() - t0) / 1000).toFixed(0)}s`);
if (!DRY) { const [s] = await rpc("raw_stats"); console.log(`raw 누적: 매치 ${s.matches}, 참가자 ${s.participants}, 최신 ${s.latest}`); }
