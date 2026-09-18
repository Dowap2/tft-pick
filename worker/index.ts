// Cloudflare Worker — /api/* 만 처리. 나머지 경로는 정적 에셋(out/)이 Worker 를 거치지 않고 바로 서빙됨
// (wrangler.jsonc assets.run_worker_first = ["/api/*"]). 즉 페이지 조회는 Worker 요청·CPU 를 전혀 쓰지 않는다.
import { handleRecommendGet, handleRecommendPost } from "@/lib/recommend-api";

type Env = { NEXT_PUBLIC_SUPABASE_URL?: string; NEXT_PUBLIC_SUPABASE_ANON_KEY?: string; ASSETS: { fetch: typeof fetch }; DEV_CORS?: string };

const CORS = (env: Env): Record<string, string> => (env.DEV_CORS ? { "access-control-allow-origin": env.DEV_CORS, "access-control-allow-headers": "content-type", "access-control-allow-methods": "GET,POST,OPTIONS" } : {});

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    // nodejs_compat 이 process.env 를 바인딩으로 채워주지만, 명시적으로도 넣어둔다 (lib/decks.ts 가 process.env 를 읽음)
    for (const k of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"] as const) if (env[k]) process.env[k] = env[k];

    const url = new URL(req.url);
    const cors = CORS(env);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    let res: Response;
    if (url.pathname === "/api/recommend") res = req.method === "POST" ? await handleRecommendPost(req) : await handleRecommendGet();
    else if (url.pathname.startsWith("/api/")) res = new Response("not found", { status: 404 });
    else return env.ASSETS.fetch(req);   // run_worker_first 패턴 밖이면 여기 안 오지만 안전망

    if (Object.keys(cors).length) { res = new Response(res.body, res); for (const [k, v] of Object.entries(cors)) res.headers.set(k, v); }
    return res;
  },
};
