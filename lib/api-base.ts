// 클라이언트가 API 를 부를 기준 URL. 배포(같은 오리진) 는 "" , 로컬 개발은 wrangler dev (npm run dev:api) → http://localhost:8787
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";
