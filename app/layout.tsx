import type { Metadata, Viewport } from "next";
import "./globals.css";
import meta from "@/lib/gen/meta.json";
import Script from "next/script";
import { Header } from "./header";
import { SideAd } from "./ads";
import { ADSENSE_CLIENT } from "@/lib/ads";

export const SITE_URL = "https://panlab.lol";

export const viewport: Viewport = { themeColor: "#0b0d12", width: "device-width", initialScale: 1, viewportFit: "cover" };

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "TFT PICK — 롤토체스 덱 추천", template: "%s | TFT PICK" },
  description: `롤토체스(TFT) 시즌 ${meta.set} 메타 덱 추천. 지금 가진 아이템과 유닛을 입력하면 갈 수 있는 덱, 레벨별 조합, 아이템, 배치를 알려줍니다.`,
  keywords: ["롤토체스", "TFT", "전략적 팀 전투", "덱 추천", "메타 덱", `시즌 ${meta.set}`, "배치", "조합"],
  openGraph: { type: "website", locale: "ko_KR", siteName: "TFT PICK" },
  robots: { index: true, follow: true },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "TFT PICK" },
  verification: { google: "OvNLHJXOThBroS7JJu1uc0Cb9xILGz1-RHIDC6Enz3c" },
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
        <Header />
        <div className="flex w-full justify-center gap-6">
          <SideAd side="left" />
          {children}
          <SideAd side="right" />
        </div>
        <footer className="mt-auto border-t border-line px-4 py-5 text-center text-[11px] text-muted/70">
          <span className="num">SET {meta.set}</span> · 패치 {meta.patch} · 데이터 Riot API(KR 챌린저·그마) · 이미지 CommunityDragon · <a href="/about" className="underline hover:text-text">방법론</a>
        </footer>
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
