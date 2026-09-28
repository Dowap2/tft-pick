"use client";

import { useEffect } from "react";

// AdSense 설정: .env(.local) 또는 Netlify 환경변수
//   NEXT_PUBLIC_ADSENSE_CLIENT=ca-pub-XXXXXXXXXXXXXXXX
//   NEXT_PUBLIC_ADSENSE_SLOT_LEFT=1234567890
//   NEXT_PUBLIC_ADSENSE_SLOT_RIGHT=0987654321
import { ADSENSE_CLIENT, ADSENSE_SLOTS as SLOTS } from "@/lib/ads";

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

  // 슬롯이 없으면 자리를 잡지도 않는다. 예전엔 빈 aside 가 xl 에서 160px + 여백을 먹어
  // 광고가 하나도 없는 상태로 양쪽 400px 를 버리고 있었다. (개발에서는 자리 확인용으로 남긴다)
  if (!(ADSENSE_CLIENT && slot) && process.env.NODE_ENV === "production") return null;

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
        ) : process.env.NODE_ENV !== "production" ? (
          // 슬롯 미설정 플레이스홀더는 개발에서만. 프로덕션에 "AD left" 빈 박스가 나가면
          // 방문자에겐 만들다 만 사이트로 보인다.
          <div className="flex h-[600px] w-40 items-center justify-center rounded border border-dashed border-line text-[10px] text-muted/40">
            AD {side}
          </div>
        ) : null}
      </div>
    </aside>
  );
}
