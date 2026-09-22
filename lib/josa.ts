// 한국어 조사 선택. "아리이(가)", "죽음모자을(를)" 같은 기계 티를 없앤다.
// 받침(종성) 유무로 고른다. 한글이 아니면 마지막 글자의 한국어 발음을 기준으로.

const DIGIT_JONG = [true, true, false, true, false, false, true, true, true, false]; // 영 일 이 삼 사 오 육 칠 팔 구
// 알파벳은 읽는 이름의 받침으로 (엘·엠·엔·알 등). TFT 데이터엔 드물지만 아이템 영문명이 섞일 수 있다.
const ALPHA_JONG: Record<string, boolean> = {
  l: true, m: true, n: true, r: true, g: false, b: false, c: false, d: false, e: false, f: true,
  a: false, h: false, i: false, j: false, k: false, o: false, p: false, q: false, s: false,
  t: false, u: false, v: false, w: false, x: false, y: false, z: false,
};

/** 마지막 글자에 받침이 있으면 true. 판단할 수 없으면 null */
function hasJong(word: string): boolean | null {
  const ch = word.trim().replace(/[)\]」』"'.]+$/, "").slice(-1);
  if (!ch) return null;
  const code = ch.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 !== 0;   // 완성형 한글
  if (ch >= "0" && ch <= "9") return DIGIT_JONG[Number(ch)];
  const low = ch.toLowerCase();
  if (low >= "a" && low <= "z") return ALPHA_JONG[low] ?? false;
  return null;
}

const PAIRS = {
  은는: ["은", "는"], 이가: ["이", "가"], 을를: ["을", "를"], 과와: ["과", "와"],
} as const;

/** 조사만 반환. `${name}${josa(name, "이가")}` → "아리가" / "케넨이" */
export function josa(word: string, pair: keyof typeof PAIRS): string {
  const [withJong, without] = PAIRS[pair];
  const j = hasJong(word);
  if (j === null) return `${withJong}(${without})`;   // 판단 불가 — 기존 표기 유지
  return j ? withJong : without;
}

/** 단어 + 조사를 붙여서 반환. `withJosa("아리", "이가")` → "아리가" */
export function withJosa(word: string, pair: keyof typeof PAIRS): string {
  return `${word}${josa(word, pair)}`;
}

// 자체 검사: node --experimental-strip-types lib/josa.ts
if (process.argv[1]?.endsWith("josa.ts")) {
  const eq = (a: string, b: string) => { if (a !== b) { console.error(`✗ ${a} !== ${b}`); process.exitCode = 1; } else console.log(`✓ ${a}`); };
  eq(withJosa("아리", "이가"), "아리가");
  eq(withJosa("케넨", "이가"), "케넨이");
  eq(withJosa("라바돈의 죽음모자", "을를"), "라바돈의 죽음모자를");
  eq(withJosa("약탈자", "을를"), "약탈자를");
  eq(withJosa("장로 드래곤", "은는"), "장로 드래곤은");
  eq(withJosa("자이라", "은는"), "자이라는");
  eq(withJosa("쇼진의 창", "과와"), "쇼진의 창과");
  eq(withJosa("보석 건틀릿", "과와"), "보석 건틀릿과");
  eq(withJosa("아이템 3", "이가"), "아이템 3이");   // 삼 → 받침 있음
  eq(withJosa("레벨 9", "이가"), "레벨 9가");       // 구 → 받침 없음
}
