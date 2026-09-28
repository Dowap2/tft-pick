// docs/티어기준.md §5 §6 이 실제 DB 에서 지켜지는지 검사. 실패하면 exit 1.
// 실행: node --env-file=.env.local scripts/check-tiers.mjs
//
// 문서가 기준인데 코드가 따로 노는 걸 사람이 눈으로 잡고 있었다 (ntile 비율 컷, OP 표본 하한 — 둘 다 육안 발견).
// 여기 적힌 단언문이 문서의 각 조항과 1:1 로 대응한다. 문서를 고치면 이 파일도 같이 고쳐야 한다.
import { rpc, select, currentPatch } from "./db.mjs";

const patch = await currentPatch();
// 자격 판정은 decks_bundle 기준 — 살아있는 덱만 담기고 §5 임계값이 이미 걸려 있다
const stats = (await select("decks_bundle", `select=id,games,avg_place,win_rate&patch_id=eq.${patch.id}`)).map((r) => ({ ...r, deck_id: r.id }));
const tiers = await rpc("calculate_deck_tiers", { target_patch_id: patch.id });
const tierOf = new Map(tiers.map((t) => [t.deck_id, t.tier_label]));
const by = (t) => tiers.filter((x) => x.tier_label === t).map((x) => x.deck_id);

const fail = [];
const check = (ok, msg) => { console.log(`  ${ok ? "✓" : "✗"} ${msg}`); if (!ok) fail.push(msg); };

// §5 자격: 제외 사유는 표본(100판) 하나뿐. 성적은 D 로 갈린다.
const eligible = stats.filter((s) => s.games >= 100);
const eIds = new Set(eligible.map((s) => s.deck_id));
// §6.3 순서 0: D 는 percent_rank 모집단에서 빠진다 → 아래 순위 검사는 D 를 뺀 집합으로 한다.
const qualified = eligible.filter((s) => Number(s.avg_place) < 4.75);

console.log(`패치 ${patch.version} · 자격 ${eligible.length}개(D 제외 ${qualified.length}개), 티어 부여 ${tiers.length}개\n`);

console.log("§5 자격");
check(tiers.length === eligible.length, `자격 덱 수(${eligible.length}) == 티어 부여 수(${tiers.length})`);
const ghosts = tiers.filter((t) => !eIds.has(t.deck_id)).map((t) => t.deck_id);
check(ghosts.length === 0, `표본 미달·사라진 덱에 티어가 붙지 않았다${ghosts.length ? ` — ${ghosts.length}개: ${ghosts.slice(0, 5).join(", ")}${ghosts.length > 5 ? " …" : ""}` : ""}`);
check(eligible.every((s) => tierOf.has(s.deck_id)), "자격 덱이 티어 없이 누락되지 않았다");
check(new Set(tiers.map((t) => t.deck_id)).size === tiers.length, "한 덱에 티어가 둘 이상 붙지 않았다");

// §6.2 순위 (동률은 같은 순위 = 그룹의 최소 등수 기준)
const pctRank = (key, dir) => {
  const sorted = [...qualified].sort((a, b) => dir * (Number(a[key]) - Number(b[key])));
  const n = sorted.length;
  const out = new Map();
  for (let i = 0; i < n; i++) {
    if (i > 0 && Number(sorted[i][key]) === Number(sorted[i - 1][key])) out.set(sorted[i].deck_id, out.get(sorted[i - 1].deck_id));
    else out.set(sorted[i].deck_id, n === 1 ? 0 : i / (n - 1));
  }
  return out;
};
const winPct = pctRank("win_rate", -1);     // 높을수록 앞
const placePct = pctRank("avg_place", 1);   // 낮을수록 앞
const statOf = new Map(stats.map((s) => [s.deck_id, s]));

console.log("\n§6.3 티어 컷");
const op = by("OP");
check(op.every((d) => winPct.get(d) <= 0.10 && placePct.get(d) <= 0.10), `OP 는 승률·등수 모두 상위 10% (${op.length}개)`);
check(op.every((d) => statOf.get(d).games >= 100), "OP 는 표본 100판 이상");
check(by("S").length <= 5, `S 는 최대 5개 (현재 ${by("S").length}개)`);

// A/B/C 는 OP·S 를 뺀 나머지의 30/40/30. percent_rank 근사라 표본이 작으면 오차가 크다 → 10개 이상일 때만 검사.
const rest = ["A", "B", "C"].flatMap(by);
if (rest.length >= 10) {
  const r = (t) => by(t).length / rest.length;
  check(r("A") >= 0.20 && r("A") <= 0.45, `A 비중 ${(r("A") * 100).toFixed(0)}% (목표 30%)`);
  check(r("B") >= 0.25 && r("B") <= 0.55, `B 비중 ${(r("B") * 100).toFixed(0)}% (목표 40%)`);
  check(r("C") >= 0.15 && r("C") <= 0.45, `C 비중 ${(r("C") * 100).toFixed(0)}% (목표 30%)`);
  check(by("B").length > 0 && by("C").length > 0, "B·C 가 비어있지 않다 (ntile 비율 컷 버그 재발 감지)");
} else {
  console.log(`  - A/B/C 비율 검사 생략 (나머지 ${rest.length}개, 10개 미만)`);
}

// §6.3 순서 0: D 는 절대 기준(4.75등)으로만 정해진다. 양방향으로 본다.
console.log("\n§6.3 D 티어");
const dDecks = by("D");
check(dDecks.every((d) => Number(statOf.get(d).avg_place) >= 4.75), `D 는 전부 평균 4.75등 이상 (${dDecks.length}개)`);
const shouldBeD = eligible.filter((s) => Number(s.avg_place) >= 4.75).map((s) => s.deck_id);
check(shouldBeD.every((d) => tierOf.get(d) === "D"), `평균 4.75등 이상인 덱은 전부 D (${shouldBeD.length}개)`);
check(["OP", "S", "A", "B", "C"].flatMap(by).every((d) => Number(statOf.get(d).avg_place) < 4.75), "OP~C 에는 4.75등 이상인 덱이 없다");

console.log("\n티어별 분포");
for (const t of ["OP", "S", "A", "B", "C", "D"]) {
  const v = by(t).map((d) => statOf.get(d)).filter(Boolean).sort((a, b) => Number(a.avg_place) - Number(b.avg_place));
  if (v.length) console.log(`  ${t.padEnd(3)} ${String(v.length).padStart(3)}개  평균 ${Number(v[0].avg_place).toFixed(2)} ~ ${Number(v[v.length - 1].avg_place).toFixed(2)}  표본 ${Math.min(...v.map((x) => x.games))}~${Math.max(...v.map((x) => x.games))}판`);
}

if (fail.length) { console.error(`\n✗ 문서와 어긋남 ${fail.length}건:\n  - ${fail.join("\n  - ")}`); process.exit(1); }
console.log("\n✓ docs/티어기준.md §5 §6 과 일치");
