// Riot TFT Match-V5 수집기 → raw.matches / raw.participants (Supabase RPC ingest_match)
// 기준 문서: docs/티어기준.md §1 §2 §7 — 값이 문서와 다르면 문서가 옳다.
//
// 실행:  node --env-file=.env.local scripts/collect-matches.mjs [옵션]
//   --tiers challenger,grandmaster,master,diamond,emerald   시드 티어 (기본값 그대로)
//   --per-tier 300           다이아/에메랄드 티어당 시드 상한 (챌/그마/마스터는 리그 전원)
//   --per-player 20          플레이어당 최근 매치 수 (최대 200)
//   --max-matches 60         사이클당 적재할 최대 매치 수 (시드 12 + 매치 60 = 요청 72 < 100/2min)
//   --seeds-per-cycle 12     사이클당 매치목록을 조회할 시드 수
//   --loop 120               초 단위 반복 (기본 1회만 실행). 2분 = 100req/2min 창에 딱 맞음
//   --duration-min 170       --loop 일 때 총 지속 시간 (GitHub Actions 잡 6시간 제한 안쪽)
//   --reseed-min 60          시드 목록 갱신 주기
//   --queue 1100             1100 = 랭크만 (기본). 0 = 전부
//   --dry-run                DB에 안 쓰고 카운트만
//
// 필요 env: RIOT_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// 레이트 리밋: 20 req/s, 100 req/2min → 아래 limiter 가 자동으로 맞춤. 429 는 Retry-After 대기.

const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => a.startsWith("--") ? [a.slice(2), all[i + 1]?.startsWith("--") || all[i + 1] == null ? true : all[i + 1]] : []).filter(Boolean));
const TIERS = String(args.tiers ?? "challenger,grandmaster,master,diamond,emerald").split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
const PER_TIER = Number(args["per-tier"] ?? 300);
const PER_PLAYER = Math.min(200, Number(args["per-player"] ?? 20));
const MAX_MATCHES = Number(args["max-matches"] ?? 60);
const SEEDS_PER_CYCLE = Number(args["seeds-per-cycle"] ?? 12);
const LOOP_SEC = args.loop == null ? 0 : Number(args.loop === true ? 120 : args.loop);
const DURATION_MS = Number(args["duration-min"] ?? 170) * 60_000;
const RESEED_MS = Number(args["reseed-min"] ?? 60) * 60_000;
const QUEUE = Number(args.queue ?? 1100);
const DRY = !!args["dry-run"];

const { RIOT_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!RIOT_API_KEY) die("RIOT_API_KEY 없음 (.env.local)");
if (!DRY && (!NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY)) die("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 없음 (.env.local)");
function die(msg) { console.error("✗", msg); process.exit(1); }

const PLATFORM = "https://kr.api.riotgames.com";     // 리그·소환사 (플랫폼 라우팅)
const REGION = "https://asia.api.riotgames.com";     // 매치 (지역 라우팅)
const APEX = new Set(["challenger", "grandmaster", "master"]);   // 문서 §2: 티어 산정의 근거가 되는 그룹
const DIVISIONS = ["I", "II", "III", "IV"];

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

// ---- 2) 시드 플레이어 ----
// 챌/그마/마스터: 리그 엔드포인트 1회로 전원. 다이아/에메랄드: entries/{TIER}/{DIVISION}?page= 페이지네이션 (티어당 PER_TIER 명까지).
async function loadSeeds() {
  const seeds = [];
  for (const tier of TIERS) {
    const group = APEX.has(tier) ? "apex" : "high";
    const before = seeds.length;
    if (APEX.has(tier)) {
      const league = await riot(`${PLATFORM}/tft/league/v1/${tier}`);
      for (const e of league?.entries ?? []) if (e.puuid) seeds.push({ puuid: e.puuid, tier: tier.toUpperCase(), group });
    } else {
      const T = tier.toUpperCase();
      for (const div of DIVISIONS) {
        for (let page = 1; page <= 20 && seeds.length - before < PER_TIER; page++) {
          const rows = await riot(`${PLATFORM}/tft/league/v1/entries/${T}/${div}?page=${page}`);
          if (!rows?.length) break;
          for (const e of rows) if (e.puuid) seeds.push({ puuid: e.puuid, tier: `${T} ${div}`, group });
        }
        if (seeds.length - before >= PER_TIER) break;
      }
    }
    console.log(`${tier}: ${seeds.length - before}명 (${group})`);
  }
  for (let i = seeds.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [seeds[i], seeds[j]] = [seeds[j], seeds[i]]; }   // 매 사이클 같은 사람만 보지 않게
  return seeds;
}
let seeds = await loadSeeds();
let seedTier = new Map(seeds.map((s) => [s.puuid, s.tier]));   // 참가자 행에 남기는 시드 티어 (나머지 7명은 null)
if (!seeds.length) die("시드 0명 — 리그 응답에 puuid 가 없다. Riot 이 엔트리 스키마를 또 바꿨는지 확인");
const byGroup = seeds.reduce((m, s) => ({ ...m, [s.group]: (m[s.group] ?? 0) + 1 }), {});
console.log(`시드 ${seeds.length}명 (${Object.entries(byGroup).map(([g, n]) => `${g} ${n}`).join(", ")}) · 사이클당 시드 ${SEEDS_PER_CYCLE}명 / 매치 ${MAX_MATCHES}판${LOOP_SEC ? ` · ${LOOP_SEC}초 주기 ${(DURATION_MS / 60000).toFixed(0)}분` : ""}${DRY ? " (dry-run)" : ""}`);

// ---- 3) 한 사이클: 시드 몇 명의 최근 매치 → 신규만 상세 조회 → 적재 ----
const seen = new Set();     // 이 프로세스에서 이미 본 매치 id (DB 왕복 절약)
let cursor = 0, stored = 0, skipped = 0, cycles = 0;
const t0 = Date.now();

async function cycle() {
  const owner = new Map();  // match_id → rank_group (apex 가 high 를 이김, 문서 §2)
  for (let i = 0; i < SEEDS_PER_CYCLE; i++) {
    const s = seeds[cursor++ % seeds.length];
    const list = await riot(`${REGION}/tft/match/v1/matches/by-puuid/${s.puuid}/ids?count=${PER_PLAYER}`);
    for (const id of list ?? []) {
      if (seen.has(id)) continue;
      if (owner.get(id) !== "apex") owner.set(id, s.group);
    }
  }
  let todo = [...owner.keys()];
  if (!DRY && todo.length) {
    const existing = new Set();
    for (let i = 0; i < todo.length; i += 500) for (const id of await rpc("existing_match_ids", { ids: todo.slice(i, i + 500) })) existing.add(id);
    for (const id of existing) seen.add(id);
    todo = todo.filter((id) => !existing.has(id));
  }
  todo = todo.slice(0, MAX_MATCHES);

  let n = 0;
  for (const id of todo) {
    seen.add(id);
    const m = await riot(`${REGION}/tft/match/v1/matches/${id}`);
    const info = m?.info;
    if (!info) { skipped++; continue; }
    if (QUEUE && (info.queue_id ?? info.queueId) !== QUEUE) { skipped++; continue; }
    if (patch && info.tft_set_number !== patch.set_number) { skipped++; continue; }

    // 보드는 1~8등 전부 저장 (5~8등이 있어야 덱별 평균등수·Top4·승률이 의미 있음)
    const participants = info.participants.map((p) => ({
      puuid: p.puuid, placement: p.placement, level: p.level, last_round: p.last_round ?? null,
      tier: seedTier.get(p.puuid) ?? null,
      units: p.units.map((u) => ({ character_id: u.character_id, tier: u.tier, items: u.itemNames ?? [] })),
      traits: p.traits.filter((t) => t.tier_current > 0).map((t) => ({ name: t.name, num_units: t.num_units, tier_current: t.tier_current })),
      augments: p.augments ?? [],
    }));
    const row = {
      match_id: id, patch_id: patch?.id ?? 0,
      game_version: `${info.tft_set_core_name ?? "set"}/${info.game_version ?? ""}`.slice(0, 80),
      queue_id: info.queue_id ?? info.queueId ?? 0,
      played_at: new Date(info.game_datetime).toISOString(),
      rank_group: owner.get(id) ?? "high",
    };
    if (DRY) { stored++; n++; }
    else if (await rpc("ingest_match", { m: row, ps: participants })) { stored++; n++; }
    else skipped++;
  }
  // ponytail: seen 은 프로세스 메모리에만. 3시간 잡이면 수만 건 수준이라 충분, 더 길게 돌릴 거면 LRU 로.
  if (seen.size > 200_000) seen.clear();
  return n;
}

// ---- 4) 1회 또는 반복 ----
const endAt = Date.now() + DURATION_MS;
let lastSeed = Date.now();
for (;;) {
  const cs = Date.now();
  const n = await cycle();
  cycles++;
  console.log(`[${new Date().toISOString().slice(11, 19)}] 사이클 ${cycles}: +${n}판 (누적 적재 ${stored}, 건너뜀 ${skipped}, 요청 ${reqCount})`);
  if (!LOOP_SEC || Date.now() >= endAt) break;
  if (Date.now() - lastSeed >= RESEED_MS) { seeds = await loadSeeds(); seedTier = new Map(seeds.map((s) => [s.puuid, s.tier])); lastSeed = Date.now(); }
  await sleep(Math.max(0, LOOP_SEC * 1000 - (Date.now() - cs)));
}

console.log(`\n완료: 사이클 ${cycles}, 적재 ${stored}, 건너뜀 ${skipped}, Riot 요청 ${reqCount}회, ${((Date.now() - t0) / 1000 / 60).toFixed(1)}분`);
if (!DRY) { const [s] = await rpc("raw_stats"); console.log(`raw 누적: 매치 ${s.matches}, 참가자 ${s.participants}, 최신 ${s.latest}`); }
