"use client";

import { useEffect, useState } from "react";

export const THEME_KEY = "tft-pick:theme";

// 기본은 다크. data-theme 은 layout.tsx 의 선행 스크립트가 페인트 전에 이미 붙여놨으므로
// 여기서는 읽기만 한다 (여기서 처음 붙이면 라이트 사용자가 다크 한 프레임을 본다).
export function ThemeToggle() {
  const [light, setLight] = useState(false);
  useEffect(() => setLight(document.documentElement.dataset.theme === "light"), []);

  const toggle = () => {
    const next = light ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem(THEME_KEY, next); } catch {}
    setLight(!light);
  };

  const label = light ? "다크 모드로 전환" : "라이트 모드로 전환";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className="flex size-8 shrink-0 items-center justify-center rounded-md border border-line text-muted transition-colors duration-150 hover:border-accent/60 hover:text-text"
    >
      {light ? (
        // 달 — 지금 라이트라 누르면 다크로 간다
        <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden="true">
          <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z" />
        </svg>
      ) : (
        // 해
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
        </svg>
      )}
    </button>
  );
}
