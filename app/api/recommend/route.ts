// POST /api/recommend — 입력(재료·완성템·유닛·스테이지·로비) → 추천 덱 (UI 렌더에 필요한 것까지 계산해서 반환)
// 클라이언트 페이지(/recommend, /deck/[id])가 이걸 호출. 정적 페이지들은 Worker 를 건드리지 않음.
// Node(Netlify)·Workers(OpenNext) 공용: fetch 외 Node API 없음, 환경변수는 요청 시 읽음, runtime='edge' 불필요.
import { NextResponse } from "next/server";
import { getDecksMeta } from "@/lib/decks";
import { componentById, itemById, unitById, type Deck } from "@/lib/data";
import { inferDecks, nextActions, nextStep, recommend, scoreDeck, STAGES, transitionLabel, type UserInput } from "@/lib/score";
import type { RecommendOptions } from "@/lib/engine/score";

const MAX = { components: 8, completed: 4, units: 12, rivals: 20, deckIds: 5 };
const COMPONENTS = new Set(["bf", "bow", "rod", "tear", "vest", "cloak", "belt", "gloves", "spatula", "pan"]);
const GATES = new Set(["stage", "all", "any", "none"]);

type Body = Partial<UserInput> & { coreGate?: RecommendOptions["coreGate"]; topN?: number; deckIds?: string[] };

function parse(raw: unknown) {
  const b = (raw && typeof raw === "object" ? raw : {}) as Body;
  const str = (xs: unknown, max: number) => (Array.isArray(xs) ? xs.filter((x): x is string => typeof x === "string").slice(0, max) : []);
  const input: UserInput = {
    stage: typeof b.stage === "string" && (STAGES as readonly string[]).includes(b.stage) ? b.stage : undefined,
    components: str(b.components, MAX.components).filter((c): c is UserInput["components"][number] => COMPONENTS.has(c)),
    completed: str(b.completed, MAX.completed).filter((id) => itemById(id)),
    units: (Array.isArray(b.units) ? (b.units as unknown[]) : [])
      .filter((u): u is { unitId: string; star?: unknown } => !!u && typeof u === "object" && typeof (u as { unitId?: unknown }).unitId === "string")
      .filter((u) => unitById(u.unitId))
      .map((u) => ({ unitId: u.unitId, star: ([1, 2, 3].includes(u.star as number) ? u.star : 1) as 1 | 2 | 3 }))
      .slice(0, MAX.units),
    rivals: str(b.rivals, MAX.rivals).filter((id) => unitById(id)),
  };
  const opts: RecommendOptions = {
    coreGate: typeof b.coreGate === "string" && GATES.has(b.coreGate) ? b.coreGate : "stage",
    topN: Number.isInteger(b.topN) && b.topN! > 0 && b.topN! <= 10 ? b.topN : undefined,
  };
  return { input, opts, deckIds: str(b.deckIds, MAX.deckIds) };
}

// 응답용 덱: 클라이언트가 카드/분기트리/배치도 그리는 데 필요한 것만 (proComps·augments·trends 제외)
export type SlimDeck = ReturnType<typeof slim>;
const slim = (d: Deck) => ({
  id: d.id, name: d.name, tierLabel: d.tierLabel, tier: d.tier, avgPlacement: d.avgPlacement, games: d.games,
  winRate: d.winRate, top4Rate: d.top4Rate, pickRate: d.pickRate, levelling: d.levelling, difficulty: d.difficulty,
  threeStarTargets: d.threeStarTargets, carryId: d.carryId, coreUnits: d.coreUnits, coreItems: d.coreItems, altItems: d.altItems, levels: d.levels, counters: d.counters,
});

export async function POST(req: Request) {
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }
  const { input, opts, deckIds } = parse(body);
  const { decks, source, patch } = await getDecksMeta();
  const owned = new Set(input.units.map((u) => u.unitId));

  // deckIds 지정 = 특정 덱 점수만 (덱 상세 페이지). 게이트 없이 항상 계산.
  const results = deckIds.length
    ? decks.filter((d) => deckIds.includes(d.id)).map((deck) => ({ deck, score: scoreDeck(input, deck), confidence: 100 }))
    : recommend(input, decks, opts);
  const rivalDecks = input.rivals?.length ? inferDecks(input.rivals, decks).map((d) => d.name) : [];

  return NextResponse.json(
    {
      patch, source, stage: input.stage ?? null, coreGate: deckIds.length ? "none" : opts.coreGate, candidates: decks.length, rivalDecks,
      input: { ...input, componentNames: input.components.map((c) => componentById(c)?.name) },
      results: results.map(({ deck, score, confidence }) => ({
        deck: slim(deck), confidence, transition: transitionLabel(score),
        score: { total: score.total, earlyScore: score.earlyScore, itemScore: score.itemScore, carryScore: score.carryScore, metaScore: score.metaScore, carryId: score.carryId, carryItems: score.carryItems, buildableCarryItems: score.buildableCarryItems, hasCarry: score.hasCarry, matchedSupports: score.matchedSupports, missingUnits: score.missingUnits, reasons: score.reasons },
        next: nextStep(deck, owned), actions: nextActions(deck, input),
      })),
    },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function GET() {
  const { decks, source, patch } = await getDecksMeta();
  return NextResponse.json({ patch, source, decks: decks.map((d) => ({ id: d.id, name: d.name, tier: d.tierLabel, carry: d.carryId })) });
}
