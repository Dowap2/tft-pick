import type { NextConfig } from "next";
import { readFileSync } from "node:fs";

// 빌드 타임(정적 페이지가 DB 를 읽을 때)에도 Worker 런타임과 같은 공개 변수를 쓰도록 wrangler.jsonc 의 vars 를 기본값으로 주입.
// (Workers Builds 는 빌드 환경변수를 따로 설정하지 않으면 process.env 가 비어 JSON 폴백으로 빌드됨 → 덱 id 가 API 와 어긋남)
try {
  const raw = readFileSync(new URL("./wrangler.jsonc", import.meta.url), "utf8").replace(/^\s*\/\/.*$/gm, "");
  const vars = (JSON.parse(raw).vars ?? {}) as Record<string, string>;
  for (const [k, v] of Object.entries(vars)) if (k.startsWith("NEXT_PUBLIC_") && !process.env[k]) process.env[k] = v;
} catch {}

const nextConfig: NextConfig = {
  // 완전 정적 export → Cloudflare Static Assets 로 서빙 (Worker 호출 0). API 는 worker/index.ts 가 별도로 처리.
  output: "export",
  images: { unoptimized: true },
};

export default nextConfig;
