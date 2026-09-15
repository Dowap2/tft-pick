import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TFT PICK",
  description: "내 상황에 맞는 TFT 덱 추천",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-zinc-950 text-zinc-100">
        {children}
      </body>
    </html>
  );
}
