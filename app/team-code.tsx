"use client";

import { useState } from "react";

export function CopyTeamCode({ code, className = "" }: { code: string | null; className?: string }) {
  const [done, setDone] = useState(false);
  if (!code) return null;
  const copy = async (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    try { await navigator.clipboard.writeText(code); setDone(true); setTimeout(() => setDone(false), 2000); } catch {}
  };
  return (
    <button
      onClick={copy}
      title="인게임 팀 플래너 → 코드 불러오기에 붙여넣기"
      className={`rounded-md border border-line px-2.5 py-1 text-xs text-muted transition-colors duration-150 hover:border-accent/60 hover:text-text ${className}`}
    >
      {done ? "✓ 복사됨" : "팀 코드 복사"}
    </button>
  );
}
