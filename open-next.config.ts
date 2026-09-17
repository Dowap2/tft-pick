// OpenNext → Cloudflare Workers 어댑터 설정.
// 정적 페이지는 빌드 타임 프리렌더, 동적은 Worker. ISR/캐시(R2)는 안 씀 — 데이터 갱신은 재배포로.
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig();
