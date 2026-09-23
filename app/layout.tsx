import type { Metadata, Viewport } from "next";
import "./globals.css";
import meta from "@/lib/gen/meta.json";
import Script from "next/script";
import { Header } from "./header";
import { SideAd } from "./ads";
import { ADSENSE_CLIENT } from "@/lib/ads";
import { SiteJsonLd } from "./seo";

export const SITE_URL = "https://panlab.lol";
// Cloudflare Web Analytics (무료·쿠키리스 → 동의 배너 불필요).
// 토큰은 빌드 타임에 주입된다 (wrangler.jsonc vars / GitHub 환경변수). 없으면 아무것도 넣지 않는다.
const CF_BEACON = process.env.NEXT_PUBLIC_CF_BEACON ?? "";

export const viewport: Viewport = { themeColor: "#0b0d12", width: "device-width", initialScale: 1, viewportFit: "cover" };

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `롤체 덱 추천 시즌 ${meta.set} — 내 아이템·기물로 갈 덱 찾기 | TFT PICK`, template: `%s | 롤체 시즌 ${meta.set} TFT PICK` },
  description: `롤토체스(롤체, TFT) 시즌 ${meta.set} 덱 추천. 지금 가진 아이템과 기물을 입력하면 갈 수 있는 메타 덱과 레벨별 조합, 추천 아이템, 배치를 바로 알려줍니다. 한국 서버 챌린저~에메랄드 랭크 게임 데이터 기반 덱 티어 리스트.`,
  keywords: ["롤체", "롤토체스", "TFT", "전략적 팀 전투", "롤체 덱 추천", "롤체 덱", "롤체 메타", `롤체 시즌 ${meta.set}`, "롤체 티어", "롤체 아이템 조합표", "롤체 시너지", "롤체 리롤 덱"],
  openGraph: { type: "website", locale: "ko_KR", siteName: "TFT PICK" },
  robots: { index: true, follow: true },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "TFT PICK" },
  verification: {
    google: "OvNLHJXOThBroS7JJu1uc0Cb9xILGz1-RHIDC6Enz3c",
    // 네이버 서치어드바이저 HTML 태그 값 → wrangler.jsonc vars 또는 .env 의 NEXT_PUBLIC_NAVER_VERIFICATION
    ...(process.env.NEXT_PUBLIC_NAVER_VERIFICATION ? { other: { "naver-site-verification": process.env.NEXT_PUBLIC_NAVER_VERIFICATION } } : {}),
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <head>
        {/* Rajdhani(숫자·영문 라벨) — next/font 는 OpenNext(Workers) 빌드에서 woff2 로더 문제가 있어 링크로 */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&display=swap" />
        {/* Pretendard: Google Fonts에 없어 CDN 사용 (동적 서브셋) */}
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css" />
      </head>
      <body className="min-h-full flex flex-col bg-bg font-sans text-text">
        <SiteJsonLd />
        <Header />
        <div className="flex w-full justify-center gap-6">
          <SideAd side="left" />
          {children}
          <SideAd side="right" />
        </div>
        <footer className="mt-auto border-t border-line px-4 py-5 text-center text-[11px] text-muted/70">
          <span className="num">SET {meta.set}</span> · 패치 {meta.patch} · 데이터 Riot API(KR 챌린저~에메랄드) · 이미지 CommunityDragon · <a href="/about" className="underline hover:text-text">방법론</a>
        </footer>
        {CF_BEACON && (
          <Script
            defer
            strategy="afterInteractive"
            src="https://static.cloudflareinsights.com/beacon.min.js"
            data-cf-beacon={`{"token":"${CF_BEACON}"}`}
          />
        )}
        {ADSENSE_CLIENT && (
          <Script
            async
            strategy="afterInteractive"
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
            crossOrigin="anonymous"
          />
        )}
      </body>
    </html>
  );
}
