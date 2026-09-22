// 현재 수집량 + 티어 덱 리스트를 docs/티어리스트.md 로 뽑는다.
// 실행: npm run report:tiers
//
// 숫자는 3시간마다(클러스터링 주기) 바뀐다. 손으로 옮겨 적지 말고 이 스크립트를 다시 돌릴 것.
// 산정 기준 자체는 docs/티어기준.md 에 있고, 여기는 그 결과 스냅샷일 뿐이다.
import { writeFileSync } from "node:fs";
import { rpc, select, currentPatch } from "./db.mjs";

const patch = await currentPatch();
const [raw] = await rpc("raw_stats");
const tiers = await rpc("calculate_deck_tiers", { target_patch_id: patch.id });
const decks = await select("decks_bundle", `select=id,name,games,avg_place,win_rate,top4_rate,pick_rate,games_apex,games_high,carry_unit_id,levelling&patch_id=eq.${patch.id}`);
const stats = await select("deck_stats", `select=deck_id,games,avg_place&patch_id=eq.${patch.id}&limit=500`);
const units = await select("units", `select=id,name&patch_id=eq.${patch.id}`);
// deck_stats 와 같은 7일 창만 (버킷 자체는 played_at 기준이라 더 과거까지 있다)
const since = new Date(Date.now() - 7 * 864e5).toISOString();
const buckets = await select("deck_stat_buckets", `select=hour,games,deck_id&patch_id=eq.${patch.id}&deck_id=eq.*&hour=gt.${since}&order=hour.asc`);

const unitName = new Map(units.map((u) => [u.id, u.name]));
const tierOf = new Map(tiers.map((t) => [t.deck_id, t.tier_label]));
const ORDER = ["OP", "S", "A", "B", "C"];
const rows = decks.filter((d) => tierOf.has(d.id))
  .sort((a, b) => ORDER.indexOf(tierOf.get(a.id)) - ORDER.indexOf(tierOf.get(b.id)) || Number(a.avg_place) - Number(b.avg_place));

const pct = (v) => (v == null ? "—" : `${(Number(v) * 100).toFixed(1)}%`);
const hours = buckets.map((b) => b.hour).sort();
const totalBoards = rows.reduce((s, d) => s + Number(d.games), 0);
const apex = rows.reduce((s, d) => s + Number(d.games_apex ?? 0), 0);
const high = rows.reduce((s, d) => s + Number(d.games_high ?? 0), 0);
const dropped = stats.filter((s) => !tierOf.has(s.deck_id));

const L = [];
L.push(`# 티어 리스트 (자동 생성)`);
L.push("");
L.push(`**기준 시각** ${new Date().toISOString().replace("T", " ").slice(0, 16)} UTC · **패치** ${patch.version} (세트 ${patch.set_number})`);
L.push("");
L.push(`이 파일은 \`npm run report:tiers\` 로 다시 만든다. 손으로 고치지 말 것 — 3시간마다 숫자가 바뀐다.`);
L.push(`산정 기준은 [티어기준.md](./티어기준.md), 여기는 그 결과 스냅샷이다.`);
L.push("");
L.push(`## 수집 현황`);
L.push("");
L.push(`| 항목 | 값 |`);
L.push(`|---|---|`);
L.push(`| 티어 집계에 쓰인 보드 | **${totalBoards.toLocaleString()}개** (최근 7일 누적) |`);
L.push(`| └ 챌린저~마스터 (apex) | ${apex.toLocaleString()}개 (${totalBoards ? ((apex / totalBoards) * 100).toFixed(0) : 0}%) |`);
L.push(`| └ 다이아·에메랄드 (high) | ${high.toLocaleString()}개 (${totalBoards ? ((high / totalBoards) * 100).toFixed(0) : 0}%) |`);
L.push(`| 집계 창 | 최근 7일 중 데이터가 있는 ${hours.length}시간 (${hours[0]?.slice(0, 16) ?? "—"} ~ ${hours.at(-1)?.slice(0, 16) ?? "—"} UTC) |`);
L.push(`| 원본 보관 (24시간분) | 매치 ${Number(raw.matches).toLocaleString()}판 / 참가자 ${Number(raw.participants).toLocaleString()}명 |`);
L.push(`| 가장 최근 매치 | ${raw.latest?.slice(0, 16) ?? "—"} |`);
L.push(`| 티어를 받은 덱 | ${rows.length}개 (자격 미달 ${dropped.length}개 제외) |`);
L.push("");
L.push(`## 티어 덱`);
L.push("");
L.push(`| 티어 | 덱 | 캐리 | 판수 | 평균 등수 | 승률 | TOP4 | 픽률 | 레벨링 |`);
L.push(`|---|---|---|---:|---:|---:|---:|---:|---|`);
for (const d of rows) {
  L.push(`| **${tierOf.get(d.id)}** | ${d.name} | ${unitName.get(d.carry_unit_id) ?? d.carry_unit_id} | ${Number(d.games).toLocaleString()} | ${Number(d.avg_place).toFixed(2)} | ${pct(d.win_rate)} | ${pct(d.top4_rate)} | ${pct(d.pick_rate)} | ${d.levelling ?? "—"} |`);
}
L.push("");
const byTier = ORDER.map((t) => `${t} ${rows.filter((d) => tierOf.get(d.id) === t).length}`).join(" · ");
L.push(`분포: ${byTier}`);
L.push("");
L.push(`## 티어를 못 받은 덱 (${dropped.length}개)`);
L.push("");
L.push(`표본 30판 미만이거나 평균 4.75등을 넘은 덱. 판수가 쌓이거나 성적이 오르면 자동으로 올라온다.`);
L.push("");
const short = dropped.filter((d) => d.games < 30).length;
const weak = dropped.filter((d) => d.games >= 30).length;
L.push(`- 표본 부족(30판 미만): ${short}개`);
L.push(`- 성적 미달(평균 4.75등 이상): ${weak}개`);
L.push("");
writeFileSync("docs/티어리스트.md", L.join("\n") + "\n");
console.log(`docs/티어리스트.md — 티어 덱 ${rows.length}개, 집계 보드 ${totalBoards.toLocaleString()}개`);
