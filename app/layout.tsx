import type { Metadata } from "next";
import "./globals.css";
import meta from "@/lib/gen/meta.json";

export const metadata: Metadata = {
  title: "TFT PICK",
  description: "내 상황에 맞는 TFT 덱 추천",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-navy text-parchment">
        {children}
        <footer className="mt-auto px-4 py-6 text-center text-[11px] text-muted/60">
          Set {meta.set} · 패치 {meta.patch} · 덱 통계 {meta.metaUpdated} (metatft) · 이미지 CommunityDragon
        </footer>
      </body>
    </html>
  );
}
