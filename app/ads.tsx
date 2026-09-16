"use client";

import { useEffect } from "react";

// AdSense 설정: .env(.local) 또는 Netlify 환경변수
//   NEXT_PUBLIC_ADSENSE_CLIENT=ca-pub-XXXXXXXXXXXXXXXX
//   NEXT_PUBLIC_ADSENSE_SLOT_LEFT=1234567890
//   NEXT_PUBLIC_ADSENSE_SLOT_RIGHT=0987654321
export const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
const SLOTS = {
  left: process.env.NEXT_PUBLIC_ADSENSE_SLOT_LEFT,
  right: process.env.NEXT_PUBLIC_ADSENSE_SLOT_RIGHT,
};

declare global {
  interface Window { adsbygoogle?: unknown[] }
}

// 세로형(160×600) 사이드 광고. xl(1280px) 이상에서만 보임 — 본문 768 + 양쪽 160 + 여백.
export function SideAd({ side }: { side: "left" | "right" }) {
  const slot = SLOTS[side];
  useEffect(() => {
    if (!ADSENSE_CLIENT || !slot) return;
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch {}
  }, [slot]);

  return (
    <aside className="hidden w-40 shrink-0 xl:block">
      <div className="sticky top-16">
        {ADSENSE_CLIENT && slot ? (
          <ins
            className="adsbygoogle block h-[600px] w-40"
            data-ad-client={ADSENSE_CLIENT}
            data-ad-slot={slot}
            data-ad-format="vertical"
          />
        ) : (
          <div className="flex h-[600px] w-40 items-center justify-center rounded border border-dashed border-line text-[10px] text-muted/40">
            AD {side}
          </div>
        )}
      </div>
    </aside>
  );
}
