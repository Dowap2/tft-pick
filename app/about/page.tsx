import Link from "next/link";
import { getDecksMeta } from "@/lib/decks";
import meta from "@/lib/gen/meta.json";

export const dynamic = "force-static";
export const metadata = {
  title: "방법론 — 롤체 덱 티어와 추천 점수는 어떻게 계산하나",
  description: "TFT PICK이 덱 티어와 추천 점수를 어떻게 계산하는지: 데이터 출처, 표본, 클러스터링, 티어 기준, 점수 가중치, 한계.",
  alternates: { canonical: "/about" },
};

export default async function AboutPage() {
  const { decks, source, patch } = await getDecksMeta();
  const games = decks.reduce((s, d) => s + (d.games ?? 0), 0);
  const H = ({ children }: { children: React.ReactNode }) => <h2 className="mb-2 mt-8 text-lg font-semibold">{children}</h2>;
  const P = ({ children }: { children: React.ReactNode }) => <p className="text-sm leading-6 text-text/90">{children}</p>;

  return (
    <main className="w-full max-w-3xl px-4 py-8 sm:py-10">
      <header className="mb-2">
        <h1 className="text-2xl font-bold sm:text-3xl">방법론</h1>
        <p className="mt-1 text-sm text-muted">TFT PICK은 "지금 이 보드로 어느 덱을 가야 하나"를 답하는 도구입니다. 그 답이 어디서 나오는지 적어둡니다.</p>
      </header>

      <H>데이터 출처</H>
      <P>
        덱과 통계는 <strong>Riot Games 공식 API(TFT Match-V5)</strong>로 받은 한국 서버 랭크 게임에서 직접 만듭니다.
        시드 플레이어는 <strong>챌린저·그랜드마스터·마스터</strong>와 <strong>다이아몬드·에메랄드</strong>, 2분마다 새 게임을 받아 하루 종일 쌓습니다.
        현재 세트 {meta.set}(패치 {patch === "json" ? meta.patch : patch}), 덱에 배정된 보드 <span className="num">{games.toLocaleString()}</span>개 기준입니다.
        유닛·아이템·시너지 데이터와 이미지는 CommunityDragon(라이엇 클라이언트 원본)에서 가져옵니다.
        {source === "json" && " (현재는 자체 통계 대신 메타 스냅샷을 임시로 사용 중입니다.)"}
      </P>

      <H>덱은 어떻게 정하나</H>
      <P>
        각 게임의 8명 최종 보드를 유닛 집합으로 보고, 서로 절반 이상 겹치는 보드끼리 묶어(자카드 유사도 ≥ 0.5) 덱을 만듭니다. 표본 15판 미만인 묶음은 버립니다.
        같은 시너지·캐리·레벨링 조합은 한 덱으로 합칩니다(같은 이름이 여러 티어에 흩어지지 않게).
        덱 구성은 최근 6시간 보드로 3시간마다 다시 계산하고, 성적 통계는 최근 7일치를 누적합니다.
        덱의 최종 조합은 그 묶음에서 30% 이상 등장한 유닛, 핵심(코어)은 캐리 + 등장률 상위 2명입니다.
        캐리는 <em>아이템을 가장 많이 받는 유닛</em>(방어 아이템도 셉니다 — 가고일·워모그를 끼고 캐리하는 유닛이 있어서), 아이템 우선순위는 그 유닛의 아이템 등장률 순, 이름은 가장 많이 활성화된 2단계 이상 시너지 + 캐리입니다.
      </P>

      <H>티어(OP·S·A·B·C)</H>
      <P>
        티어는 <strong>챌린저부터 에메랄드까지 전 구간을 섞어</strong> 매깁니다. 찾는 답이 "챌린저에서만 되는 덱"이 아니라
        <strong>어느 구간에서든 공통으로 먹히는 덱</strong>이기 때문입니다.
      </P>
      <P>
        자격은 <strong>최근 7일 30판 이상, 평균 4.75등 이내</strong>. 그중 승률과 평균 등수가 모두 상위 10%면서 <strong>100판 이상</strong>이면 <strong>OP</strong>,
        그 다음 (승률 순위 + 등수 순위) 상위 5개가 <strong>S</strong>, 나머지를 <strong>A</strong> 30% · <strong>B</strong> 40% · <strong>C</strong> 30%로 나눕니다.
        OP에만 표본 하한을 따로 두는 건, 30판짜리 덱이 수백 판 검증된 덱 위에 올라오는 걸 막기 위해서입니다. <strong>OP가 없는 날도 정상입니다.</strong>
        카드에 표시되는 게임 수·평균 등수·승률은 티어를 계산한 것과 같은 표본입니다.
      </P>

      <H>추천 점수(적합도)</H>
      <P>
        입력한 유닛·재료·완성 아이템·스테이지를 덱마다 100점 만점으로 채점합니다:
        <strong> 조합 일치 40</strong>(스테이지에 맞는 레벨 조합과 성 가중 일치율 32 + 시너지 단계 일치 8) ·
        <strong> 아이템 방향 25</strong>(캐리 아이템 레시피와 재료 겹침. 완성 아이템은 정확히 일치할 때만 — 분해할 수 없으니) ·
        <strong> 캐리 보유 15</strong>(없어도 감점 없음. 초반에 4~5코가 없는 게 정상) ·
        <strong> 메타 20</strong>(평균 등수).
        여기에 3성 기물을 쓰는 덱 +12 / 안 쓰는 덱 총점 절반, 로비에 같은 덱 경쟁자가 있으면 감점. 스테이지가 늦을수록 후보 수를 줄이고 1위로 수렴시킵니다.
      </P>

      <H>한계와 정직한 안내</H>
      <ul className="list-disc space-y-1 pl-5 text-sm leading-6 text-text/90">
        <li>Riot API에는 라운드별 보드가 없습니다. <strong>4~7렙 조합은 자체 표본이 5판 미만이면 MetaTFT의 초반 통계를 빌려 씁니다.</strong> 자체 표본이 쌓이면 자동으로 교체됩니다.</li>
        <li>배치도의 위치는 실측이 아니라 특성 기반 자동 배치입니다.</li>
        <li>증강 데이터는 현재 세트 API에 포함되지 않아 증강 티어는 MetaTFT 큐레이션을 씁니다.</li>
        <li>티어는 구간 평균입니다. 챌린저와 에메랄드에서 성적이 갈리는 덱도 하나의 티어로 묶입니다.</li>
        <li>표본이 빠르게 쌓이고 3시간마다 다시 계산하므로 티어와 순위는 하루에도 바뀔 수 있습니다.</li>
      </ul>

      <H>갱신 주기</H>
      <P>새 게임은 2분마다 들어오고, 덱과 티어는 3시간마다 다시 계산합니다. 유닛·아이템·시너지 원본 데이터는 매일 오전 6시(KST)에 갱신합니다. 페이지 하단에 기준 패치가 표시됩니다.</P>

      <p className="mt-8 text-xs text-muted">
        TFT PICK은 Riot Games의 승인을 받거나 후원을 받지 않으며, Riot Games 또는 리그 오브 레전드/전략적 팀 전투 제작·관리에 공식적으로 관여하는 누구의 견해나 의견도 대변하지 않습니다.
        Riot Games 및 관련 자산은 Riot Games, Inc.의 상표 또는 등록 상표입니다.
      </p>
      <p className="mt-4"><Link href="/" className="text-sm text-accent hover:underline">← 덱 추천으로</Link></p>
    </main>
  );
}
