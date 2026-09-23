// 덱별 OG 이미지 (빌드 타임 생성 → 정적 export).
//
// 공유할 때 모든 덱이 사이트 공통 로고로 보이던 걸 고친다. 카톡·디스코드·트위터에서
// 덱을 구분할 수 있어야 링크가 클릭된다.
//
// 한글을 넣지 않는다: satori 는 폰트 버퍼를 직접 줘야 하고, 한글 폰트는 최소 수 MB 라
// 빌드에 매달기엔 무겁다. 덱 이름은 어차피 og:title 로 헤드라인에 노출되므로,
// 이미지는 "무슨 덱인지 그림으로 알아보는" 역할만 한다 — 기물 초상화가 그 역할을 한다.
import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { getDecks } from "@/lib/decks";
import { unitById } from "@/lib/data";

export const dynamicParams = false;
export async function generateStaticParams() {
  return (await getDecks()).map((d) => ({ id: d.id }));
}

export const alt = "TFT PICK 덱 조합";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const COST_COLOR: Record<number, string> = { 1: "#5b6472", 2: "#2f9e5b", 3: "#3b7ddd", 4: "#a855f7", 5: "#c9a227" };
const TIER_COLOR: Record<string, string> = { OP: "#e5484d", S: "#6366f1", A: "#8b5cf6", B: "#3f4654", C: "#3f4654" };

// satori 는 webp 를 못 읽는다 → 빌드 타임에 png 로 변환해 data URI 로 심는다. 유닛당 1회만.
const pngCache = new Map<string, string>();
async function unitPng(unitId: string): Promise<string | null> {
  if (pngCache.has(unitId)) return pngCache.get(unitId)!;
  try {
    const webp = await readFile(join(process.cwd(), "public/img/units", `${unitId}.webp`));
    const buf = await sharp(webp).resize(112, 112).png().toBuffer();
    const uri = `data:image/png;base64,${buf.toString("base64")}`;
    pngCache.set(unitId, uri);
    return uri;
  } catch {
    return null;
  }
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const deck = (await getDecks()).find((d) => d.id === id);
  const units = (deck?.coreUnits ?? []).slice(0, 8);
  const imgs = await Promise.all(units.map(async (u) => ({ ...u, src: await unitPng(u.unitId), cost: unitById(u.unitId)?.cost ?? 1 })));

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#0b0d12", padding: 64, color: "#e8eaed" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {deck && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", background: TIER_COLOR[deck.tierLabel] ?? "#3f4654", borderRadius: 16, padding: "10px 28px", fontSize: 56, fontWeight: 700 }}>
              {deck.tierLabel}
            </div>
          )}
          {deck?.avgPlacement != null && (
            <div style={{ display: "flex", fontSize: 44, color: "#9aa4b2" }}>avg {deck.avgPlacement.toFixed(2)}</div>
          )}
          {deck?.games != null && (
            <div style={{ display: "flex", fontSize: 32, color: "#5b6472" }}>{deck.games.toLocaleString()} games</div>
          )}
        </div>

        <div style={{ display: "flex", gap: 18, alignItems: "flex-end" }}>
          {imgs.map((u) =>
            u.src ? (
              <div key={u.unitId} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                <img src={u.src} width={112} height={112} style={{ borderRadius: 18, border: `6px solid ${COST_COLOR[u.cost]}` }} />
                {u.unitId === deck?.carryId && (
                  <div style={{ display: "flex", background: "#6366f1", borderRadius: 8, padding: "2px 12px", fontSize: 24, fontWeight: 700 }}>C</div>
                )}
              </div>
            ) : null,
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 34 }}>
          <div style={{ display: "flex", letterSpacing: 4, fontWeight: 700 }}>TFT PICK</div>
          <div style={{ display: "flex", color: "#5b6472" }}>panlab.lol</div>
        </div>
      </div>
    ),
    size,
  );
}
