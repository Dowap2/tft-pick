"use client";

import { useEffect } from "react";
import type { UserInput } from "@/lib/score";

const STORAGE_KEY = "tft-pick:input";

// 덱 상세/추천에서 URL로 바뀐 입력(유닛 토글 등)을 홈 localStorage에 반영 → 홈으로 돌아가도 유지.
// URL에 입력이 하나라도 있을 때만 쓰고, URL에 없는 항목(재료/완성템/로비)은 저장된 값을 유지.
export function SyncInput({ input }: { input: UserInput }) {
  useEffect(() => {
    const has = input.units.length || input.components.length || input.completed.length || input.rivals?.length;
    if (!has) return;
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        components: input.components.length ? input.components : saved.components ?? [],
        completed: input.completed.length ? input.completed : saved.completed ?? [],
        rivals: input.rivals?.length ? input.rivals : saved.rivals ?? [],
        units: input.units,
      }));
    } catch {}
  }, [input]);
  return null;
}
