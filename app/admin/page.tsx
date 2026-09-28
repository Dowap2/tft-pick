import type { Metadata } from "next";
import { AdminDeckBuilder } from "./builder";

export const dynamic = "force-static";
// 색인 금지. robots.txt 에도 Disallow 를 넣지만, 링크로 새어나갈 때를 대비해 메타로도 막는다.
export const metadata: Metadata = {
  title: "덱 빌더 (관리자)",
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminPage() {
  return <AdminDeckBuilder />;
}
