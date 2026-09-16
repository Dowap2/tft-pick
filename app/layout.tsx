import type { Metadata } from "next";
import "./globals.css";
import meta from "@/lib/gen/meta.json";
import { Header } from "./header";

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
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-navy text-parchment">
        <Header />
        {children}
        <footer className="mt-auto px-4 py-6 text-center text-[11px] text-muted/60">
          Set {meta.set} · 패치 {meta.patch} · 덱 통계 {meta.metaUpdated} (metatft) · 이미지 CommunityDragon
        </footer>
      </body>
    </html>
  );
}
