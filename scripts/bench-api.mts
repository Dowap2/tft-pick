// /api/recommend 핸들러 로컬 벤치: 콜드(캐시 없음) 1회 + 웜 N회. 실행: npx tsx --env-file=.env.local scripts/bench-api.ts
import { handleRecommendPost } from "../lib/recommend-api";

const body = { stage: "2-5", components: ["bf", "cloak"], units: [{ unitId: "ornn", star: 2 }, { unitId: "xayah", star: 2 }, { unitId: "varus", star: 1 }] };
const req = () => new Request("http://x/api/recommend", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const ms = (t: bigint) => Number(process.hrtime.bigint() - t) / 1e6;

let t = process.hrtime.bigint();
const cpu0 = process.cpuUsage();
const first = await (await handleRecommendPost(req())).json();
const cpu = process.cpuUsage(cpu0);
console.log(`cold: wall ${ms(t).toFixed(0)}ms, CPU ${((cpu.user + cpu.system) / 1000).toFixed(1)}ms (DB 응답 파싱·변환 포함)  → ${first.results.map((r: any) => r.deck.name).join(", ")}`);

const N = 50; const times: number[] = [];
const cpuW0 = process.cpuUsage();
for (let i = 0; i < N; i++) { t = process.hrtime.bigint(); await handleRecommendPost(req()); times.push(ms(t)); }
const cpuW = process.cpuUsage(cpuW0);
times.sort((a, b) => a - b);
console.log(`warm ×${N}: median ${times[N >> 1].toFixed(2)}ms  p90 ${times[Math.floor(N * 0.9)].toFixed(2)}ms  CPU/req ${((cpuW.user + cpuW.system) / 1000 / N).toFixed(2)}ms`);
