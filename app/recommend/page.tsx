import { Suspense } from "react";
import { RecommendClient } from "./recommend-client";

export const metadata = {
  title: "추천 결과",
  robots: { index: false, follow: true }, // 입력마다 달라지는 페이지라 색인 제외
};
export const dynamic = "force-static";   // 셸은 정적, 데이터는 클라이언트가 /api/recommend 호출

export default function RecommendPage() {
  return (
    <Suspense fallback={null}>
      <RecommendClient />
    </Suspense>
  );
}
