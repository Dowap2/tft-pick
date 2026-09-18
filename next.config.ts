import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 완전 정적 export → Cloudflare Static Assets 로 서빙 (Worker 호출 0). API 는 worker/index.ts 가 별도로 처리.
  output: "export",
  images: { unoptimized: true },
};

export default nextConfig;
