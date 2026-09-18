import type { MetadataRoute } from "next";

export const dynamic = "force-static";

// PWA: 게임 중 폰 홈 화면에서 바로 여는 용도. 서비스워커 없음(오프라인 불필요, 최신 데이터가 중요).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TFT PICK — 롤토체스 덱 추천",
    short_name: "TFT PICK",
    description: "지금 가진 아이템·유닛으로 갈 수 있는 롤토체스 덱 추천",
    start_url: "/",
    display: "standalone",
    background_color: "#0b0d12",
    theme_color: "#0b0d12",
    lang: "ko",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
