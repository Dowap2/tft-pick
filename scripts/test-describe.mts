// describe.ts 숫자 생성 검증: npx tsx scripts/test-describe.mts
// 문장 표현이 아니라 숫자만 본다 — 사용자에게 보이는 통계가 조용히 틀리는 게 유일한 위험이다.
import { describeUnit } from "../lib/describe";
import type { Deck } from "../lib/data";

let failed = 0;
const ok = (cond: boolean, msg: string) => { if (!cond) { console.error(`✗ ${msg}`); failed++; } };

const deck = (o: Partial<Deck> & { id: string }): Deck => ({
  name: o.id, tierLabel: "A", tier: 3, avgPlacement: 4.5, coreUnits: [{ unitId: "x", star: 2 }], coreItems: [], ...o,
} as Deck);
const U = { id: "x", name: "요릭", cost: 1, traits: ["검은 가시"] };
const say = (decks: Deck[], carryOf: Deck[] = []) => describeUnit(U, { decks, items: [], carryOf }, []).join("\n");

// 1) 표본 합계·평균 등수 범위·티어 분포
{
  const ds = [deck({ id: "a", games: 100, avgPlacement: 3.5, tierLabel: "OP" }), deck({ id: "b", games: 900, avgPlacement: 4.7, tierLabel: "B" })];
  const t = say(ds);
  ok(t.includes("합계 1,000판"), `표본 합계가 1,000판이 아니다:\n${t}`);
  ok(t.includes("3.50등에서 4.70등"), `평균 등수 범위가 틀렸다:\n${t}`);
  ok(t.includes("OP티어 1개, B티어 1개"), `티어 분포가 틀렸다:\n${t}`);
}

// 2) 캐리 vs 서브는 판수 가중 평균이다 (단순 평균이면 4.50)
{
  const carry = deck({ id: "c", games: 100, avgPlacement: 4.0, carryId: "x" });
  const sub1 = deck({ id: "s1", games: 100, avgPlacement: 4.0 });
  const sub2 = deck({ id: "s2", games: 900, avgPlacement: 5.0 });
  const t = say([carry, sub1, sub2], [carry]);
  ok(t.includes("덱 2개는 평균 4.90등"), `서브 덱 가중 평균이 4.90 이 아니다 (단순 평균 4.50 이면 가중이 안 걸린 것):\n${t}`);
}

// 3) 픽률은 그냥 더한다 (보드 하나 = 덱 하나). 8인 로비 환산도 같이.
{
  const t = say([deck({ id: "a", games: 100, pickRate: 0.03 }), deck({ id: "b", games: 100, pickRate: 0.05 })]);
  ok(t.includes("약 8.0%"), `픽률 합이 8.0% 가 아니다:\n${t}`);
  ok(t.includes("평균 0.6명"), `8인 환산이 0.6명이 아니다 (0.08×8=0.64):\n${t}`);
}

// 3-1) 반올림해서 0.0 이 되는 값은 문장에 넣지 않는다 (D 티어의 저픽률 덱)
{
  const t = say([deck({ id: "a", games: 120, pickRate: 0.002 })]);   // 0.2% → 8인 환산 0.016명
  ok(!t.includes("0.0명"), `"평균 0.0명" 문장이 나왔다:\n${t}`);
  ok(t.includes("약 0.2%"), `픽률 0.2% 는 그대로 나와야 한다:\n${t}`);
  const none = say([deck({ id: "b", games: 120, pickRate: 0.0001 })]);   // 0.01% → 문단 자체를 만들지 않는다
  ok(!none.includes("차지합니다"), `0.0% 로 반올림되는데 점유율 문단이 나왔다:\n${none}`);
}

// 4) 구간 차이: 표본 100판 미만이거나 차이 0.10등 미만이면 문단을 만들지 않는다
{
  const near = deck({ id: "a", games: 500, gamesApex: 400, avgPlaceApex: 4.40, gamesHigh: 100, avgPlaceHigh: 4.45 });
  ok(!say([near]).includes("구간을 나눠 보면"), "차이 0.05등인데 구간 문단이 나왔다");
  const thin = deck({ id: "b", games: 500, gamesApex: 400, avgPlaceApex: 4.00, gamesHigh: 99, avgPlaceHigh: 4.60 });
  ok(!say([thin]).includes("구간을 나눠 보면"), "high 표본 99판인데 구간 문단이 나왔다");
  // 차이가 가장 큰 덱을 골라야 한다
  const small = deck({ id: "small", games: 500, gamesApex: 300, avgPlaceApex: 4.00, gamesHigh: 200, avgPlaceHigh: 4.15 });
  const big = deck({ id: "big", games: 500, avgPlacement: 4.6, gamesApex: 300, avgPlaceApex: 4.00, gamesHigh: 200, avgPlaceHigh: 4.80 });
  const t = say([small, big]);
  ok(t.includes("big"), `차이가 더 큰 덱(0.80등)을 골라야 하는데 작은 쪽(0.15등)을 골랐다:\n${t}`);
}

// 5) 덱 0개면 문단 1개, 통계 문장 없음
{
  const t = say([]);
  ok(!t.includes("자체 수집 표본"), "덱 0개인데 통계 문단이 나왔다");
}

// 조사 하드코딩 검사 — 이 세션에서 같은 실수를 세 번 했다. 인스턴스가 아니라 부류를 막는다.
// `${이름}은` 처럼 보간 직후에 조사를 박으면 모음으로 끝나는 이름에서 틀린다 ("자이라은", "스파크이").
// lib/josa.ts 의 josa()/withJosa() 를 쓰면 마지막 글자를 보고 골라준다.
{
  const { readFileSync, readdirSync, statSync } = await import("node:fs");
  const { join } = await import("node:path");
  const walk = (dir: string): string[] => readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return f === "gen" ? [] : walk(p);
    return /\.tsx?$/.test(f) ? [p] : [];
  });
  const bad: string[] = [];
  for (const f of [...walk("lib"), ...walk("app")]) {
    readFileSync(f, "utf8").split("\n").forEach((line, i) => {
      const m = line.match(/\}(은|는|이|가|을|를|과|와)(?=[\s,.·)]|$)/);
      if (m) bad.push(`${f}:${i + 1} → "}${m[1]}"`);
    });
  }
  ok(bad.length === 0, `보간 직후에 조사를 하드코딩한 곳 ${bad.length}건 (josa/withJosa 를 쓸 것):\n    ${bad.join("\n    ")}`);
}

console.log(failed ? `\n✗ ${failed}건 실패` : "✓ describe 통계 검증 통과");
process.exitCode = failed ? 1 : 0;
