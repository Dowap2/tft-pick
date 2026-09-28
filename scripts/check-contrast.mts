// 테마 색 대비 검사: npx tsx scripts/check-contrast.mts
// globals.css 의 토큰을 직접 읽어 WCAG 명도 대비를 계산한다. 라이트 모드 토큰을 눈대중으로
// 골라 배포했기 때문에 필요하다 — 브라우저 없이 확인할 수 있는 유일한 부분이다.
// 기준: 본문/작은 글자 4.5:1, 큰 글자·UI 경계 3:1 (WCAG 2.1 AA)
import { readFileSync } from "node:fs";

const css = readFileSync("app/globals.css", "utf8");
const block = (re: RegExp) => Object.fromEntries(
  [...(css.match(re)?.[1] ?? "").matchAll(/--color-([a-z0-9-]+):\s*(#[0-9a-fA-F]{3,8})/g)].map((m) => [m[1], m[2]]),
);
const dark = block(/@theme\s*\{([\s\S]*?)\n\}/);
const light = { ...dark, ...block(/:root\[data-theme="light"\]\s*\{([\s\S]*?)\n\}/) };

const hex = (h: string) => {
  const v = h.replace("#", "");
  const f = v.length === 3 ? v.split("").map((c) => c + c).join("") : v;
  return [0, 2, 4].map((i) => parseInt(f.slice(i, i + 2), 16)) as [number, number, number];
};
/** 알파 합성 (Tailwind 의 text-white/70, bg-neg/90 같은 표기) */
const over = (fg: string, bg: string, a: number) => {
  const [r1, g1, b1] = hex(fg), [r2, g2, b2] = hex(bg);
  return `#${[r1 * a + r2 * (1 - a), g1 * a + g2 * (1 - a), b1 * a + b2 * (1 - a)]
    .map((x) => Math.round(x).toString(16).padStart(2, "0")).join("")}`;
};
const lum = (h: string) => {
  const [r, g, b] = hex(h).map((c) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

// 실제로 화면에 쓰이는 조합만. [설명, 전경, 배경, 최소비, 전경알파]
const pairs = (T: Record<string, string>): [string, string, string, number, number?][] => [
  ["본문 text / bg", T.text, T.bg, 4.5],
  ["본문 text / surface", T.text, T.surface, 4.5],
  ["본문 text/90 / bg (상세 문단)", over(T.text, T.bg, 0.9), T.bg, 4.5],
  ["muted / bg", T.muted, T.bg, 4.5],
  ["muted / surface", T.muted, T.surface, 4.5],
  ["muted / surface-2", T.muted, T["surface-2"], 4.5],
  ["muted / bg (푸터 11px)", T.muted, T.bg, 4.5],
  ["accent 링크 / surface", T.accent, T.surface, 4.5],
  ["accent-2 / surface", T["accent-2"], T.surface, 4.5],
  ["pos / surface", T.pos, T.surface, 4.5],
  ["neg / surface", T.neg, T.surface, 4.5],
  ["warn / surface", T.warn, T.surface, 4.5],
  ["흰 글자 / accent-strong (버튼·S티어)", "#ffffff", T["accent-strong"], 4.5],
  ["흰 글자 / accent-2 90% (A티어)", "#ffffff", over(T["accent-2"], T.surface, 0.9), 4.5],
  ["흰 글자 / neg (OP티어)", "#ffffff", T.neg, 4.5],
  ["흰 글자 / accent-strong (CTA 부가)", "#ffffff", T["accent-strong"], 4.5],
  ["D티어 neg / surface-2", T.neg, T["surface-2"], 4.5],
  ...([1, 2, 3, 4, 5].map((n) => [`코스트${n} 글자 / surface`, T[`cost-${n}`], T.surface, 4.5] as [string, string, string, number])),
  // WCAG 1.4.11 은 "식별에 필요한 UI 경계" 에만 3:1 을 요구한다. 패널 구분선은 장식이라
  // 대상이 아니지만(디자인.md: 옅은 테두리만), 입력창은 경계가 없으면 어디를 누를지 모른다.
  ["입력창 경계 line / surface", T.line, T.surface, 3],
];

let failed = 0;
for (const [name, T] of [["다크", dark], ["라이트", light]] as const) {
  console.log(`\n=== ${name} 모드 ===`);
  for (const [label, fg, bg, min] of pairs(T)) {
    const r = ratio(fg, bg);
    const pass = r >= min;
    if (!pass) failed++;
    console.log(`  ${pass ? "✓" : "✗"} ${r.toFixed(2).padStart(5)}:1 (기준 ${min})  ${label}`);
  }
}
console.log(failed ? `\n✗ 대비 미달 ${failed}건` : "\n✓ 두 테마 모두 WCAG AA 통과");
process.exitCode = failed ? 1 : 0;
