import type { Metadata } from "next";
import { Rajdhani } from "next/font/google";
import "./globals.css";
import meta from "@/lib/gen/meta.json";
import Script from "next/script";
import { Header } from "./header";
import { ADSENSE_CLIENT, SideAd } from "./ads";

const rajdhani = Rajdhani({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-rajdhani" });

export const SITE_URL = "https://tft-pick.netlify.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "TFT PICK — 롤토체스 덱 추천", template: "%s | TFT PICK" },
  description: `롤토체스(TFT) 시즌 ${meta.set} 메타 덱 추천. 지금 가진 아이템과 유닛을 입력하면 갈 수 있는 덱, 레벨별 조합, 아이템, 배치를 알려줍니다.`,
  keywords: ["롤토체스", "TFT", "전략적 팀 전투", "덱 추천", "메타 덱", `시즌 ${meta.set}`, "배치", "조합"],
  openGraph: { type: "website", locale: "ko_KR", siteName: "TFT PICK" },
  robots: { index: true, follow: true },
  verification: { google: "OvNLHJXOThBroS7JJu1uc0Cb9xILGz1-RHIDC6Enz3c" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`h-full antialiased ${rajdhani.variable}`}>
      <head>
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
          <span className="num">SET {meta.set}</span> · 패치 {meta.patch} · 덱 통계 {meta.metaUpdated} (metatft) · 이미지 CommunityDragon
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
