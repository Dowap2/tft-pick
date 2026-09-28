// fetchRetry 검증: npx tsx scripts/test-fetch-retry.mts
// DNS 장애 한 번에 170분 수집 잡이 죽은 걸 고친 코드다. 재시도가 정말 돌고,
// 다 쓰면 원래 예외를 그대로 올리는지만 본다 (약 2초 걸린다).
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://example.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "dummy";
const { fetchRetry } = await import("./db.mjs");

let failed = 0;
const ok = (cond: boolean, msg: string) => { if (!cond) { console.error(`✗ ${msg}`); failed++; } };

// console.warn 을 가로채 재시도 횟수를 센다
const warns: string[] = [];
const realWarn = console.warn;
console.warn = (...a: unknown[]) => { warns.push(a.join(" ")); };

// 1) 해결되지 않는 호스트 → tries 만큼 재시도하고 원래 예외를 올린다
let caught: any = null;
try {
  await fetchRetry("https://no-such-host.invalid/x", {}, "테스트", 1);
} catch (e) { caught = e; }
console.warn = realWarn;

ok(caught !== null, "재시도를 다 쓴 뒤 예외를 올려야 한다");
ok(/ENOTFOUND|EAI_AGAIN|getaddrinfo/.test(String(caught?.cause?.code ?? caught?.message)),
   `원래 네트워크 예외가 보존돼야 한다 — 받은 것: ${caught?.cause?.code ?? caught?.message}`);
ok(warns.length === 1, `tries=1 이면 재시도 경고가 1번 (실제 ${warns.length}번: ${warns.join(" | ")})`);
ok(warns[0]?.includes("테스트"), `경고에 label 이 들어가야 한다 — ${warns[0]}`);

// 2) 정상 URL 은 재시도 없이 한 번에 통과한다 (네트워크 없으면 조용히 건너뛴다)
const before = warns.length;
try {
  const res = await fetchRetry("https://raw.communitydragon.org/latest/", {}, "정상");
  ok(res.status > 0, "정상 응답이어야 한다");
  ok(warns.length === before, "정상 요청에는 재시도 경고가 없어야 한다");
} catch {
  console.log("· 외부 네트워크 불가 → 정상 경로 검사 건너뜀");
}

console.log(failed ? `\n✗ ${failed}건 실패` : "✓ fetchRetry 검증 통과");
process.exitCode = failed ? 1 : 0;
