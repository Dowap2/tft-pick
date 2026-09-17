// POST /api/recommend — 입력(재료·완성템·유닛·스테이지·로비) → 추천 덱
// Node 런타임(Netlify)·Edge(OpenNext/Workers) 양쪽에서 동작하도록 fetch 외 Node API 사용 안 함.
// Cloudflare next-on-pages 로 배포할 때만 `export const runtime = "edge"` 추가 (OpenNext 는 불필요).
import { NextResponse } from "next/server";
import { recommend, STAGES, type RecommendInput, type RecommendOptions } from "@/lib/engine/score";
import { loadBundle } from "@/lib/engine/source";

const MAX = { components: 8, completed: 4, units: 12, rivals: 20 };
const COMPONENTS = new Set(["bf", "bow", "rod", "tear", "vest", "cloak", "belt", "gloves", "spatula", "pan"]);
const GATES = new Set(["stage", "all", "any", "none"]);

type Body = Partial<RecommendInput> & { coreGate?: RecommendOptions["coreGate"]; topN?: number };

function parse(raw: unknown): { input: RecommendInput; opts: RecommendOptions } {
  const b = (raw && typeof raw === "object" ? raw : {}) as Body;
  const str = (xs: unknown, max: number) => (Array.isArray(xs) ? xs.filter((x): x is string => typeof x === "string").slice(0, max) : []);
  const input: RecommendInput = {
    patch: typeof b.patch === "string" && /^[\w.-]{1,20}$/.test(b.patch) ? b.patch : "current",
    stage: typeof b.stage === "string" && (STAGES as readonly string[]).includes(b.stage) ? b.stage : undefined,
    components: str(b.components, MAX.components).filter((c) => COMPONENTS.has(c)),
    completed: str(b.completed, MAX.completed),
    units: (Array.isArray(b.units) ? (b.units as unknown[]) : [])
      .filter((u): u is { unitId: string; star?: unknown } => !!u && typeof u === "object" && typeof (u as { unitId?: unknown }).unitId === "string")
      .map((u) => ({ unitId: u.unitId, star: ([1, 2, 3].includes(u.star as number) ? u.star : 1) as 1 | 2 | 3 }))
      .slice(0, MAX.units),
    rivals: str(b.rivals, MAX.rivals),
  };
  const opts: RecommendOptions = {
    coreGate: typeof b.coreGate === "string" && GATES.has(b.coreGate) ? b.coreGate : "stage",   // 초반 입력엔 코어가 없으므로 라운드 연동이 기본
    topN: Number.isInteger(b.topN) && b.topN! > 0 && b.topN! <= 10 ? b.topN : undefined,
  };
  return { input, opts };
}

export async function POST(req: Request) {
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }
  const { input, opts } = parse(body);

  const bundle = await loadBundle(input.patch);
  // 이 패치에 없는 id 는 조용히 버림 (클라이언트 데이터가 한 패치 늦을 수 있음)
  input.units = input.units.filter((u) => bundle.ctx.unitName?.(u.unitId) !== u.unitId);   // 이름이 안 풀리면 모르는 유닛
  input.completed = input.completed.filter((id) => bundle.ctx.itemRecipe(id));

  const results = recommend(input, bundle.decks, bundle.ctx, opts);
  return NextResponse.json(
    {
      patch: bundle.patch, source: bundle.source, stage: input.stage ?? null, coreGate: opts.coreGate,
      candidates: bundle.decks.length,
      results: results.map((r) => ({
        deckId: r.deck.id, name: r.deck.name, tier: r.deck.tierLabel ?? null, carryUnitId: r.deck.carryUnitId,
        confidence: r.confidence,
        score: { total: +r.score.total.toFixed(1), early: +r.score.earlyScore.toFixed(1), trait: +r.score.traitScore.toFixed(1), item: +r.score.itemScore.toFixed(1), carry: +r.score.carryScore.toFixed(1), meta: +r.score.metaScore.toFixed(1), bestLabel: r.score.bestLabel },
        hasCarry: r.score.hasCarry, buildableCarryItems: r.score.buildableCarryItems, missingCoreUnits: r.score.missingCoreUnits,
        qualifierLabel: r.qualifierLabel, requirementNote: r.requirementNote,
        reasons: r.score.reasons,
      })),
    },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function GET() {
  const b = await loadBundle("current");
  return NextResponse.json({ patch: b.patch, source: b.source, decks: b.decks.map((d) => ({ id: d.id, name: d.name, tier: d.tierLabel, core: d.coreUnitIds })) });
}
