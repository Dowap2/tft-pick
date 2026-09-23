import { AUGMENTS, AUGMENT_TIERS } from "@/lib/augments";

export const dynamic = "force-static";
import { TierBadge } from "@/app/icons";
import meta from "@/lib/gen/meta.json";

export const metadata = {
  title: "롤체 증강 티어 리스트",
  description: `롤토체스 Set ${meta.set} 증강 티어. S/A/B/C 등급과 효과 설명.`,
  alternates: { canonical: "/augments" },
};

const ORDER = ["S", "A", "B", "C", "D"];

export default function AugmentsPage() {
  const groups = ORDER.map((tier) => ({
    tier,
    list: Object.entries(AUGMENT_TIERS).filter(([id, t]) => t === tier && AUGMENTS[id]).map(([id]) => ({ id, ...AUGMENTS[id] })).sort((a, b) => a.name.localeCompare(b.name, "ko")),
  })).filter((g) => g.list.length > 0);

  return (
    <main className="w-full max-w-3xl px-4 py-8 sm:py-10">
      <header className="mb-5">
        <h1 className="text-2xl font-bold sm:text-3xl">증강 티어 리스트</h1>
        <p className="mt-1 text-sm text-muted">{groups.reduce((n, g) => n + g.list.length, 0)}개 · 티어는 metatft 통계 기반. 아이콘에 마우스를 올리면 효과가 뜹니다.</p>
      </header>
      {groups.map((g) => (
        <section key={g.tier} className="mb-6">
          <h2 className="mb-2 flex items-center gap-2 text-base font-semibold"><TierBadge tier={g.tier} size="lg" /> <span className="num text-muted">{g.list.length}</span></h2>
          <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {g.list.map((a) => (
              <li key={a.id} title={a.desc} className="panel flex items-center gap-2 rounded-lg bg-surface px-2 py-1.5">
                <img src={a.img} alt="" className="size-8 shrink-0 rounded" />
                <div className="min-w-0">
                  <div className="truncate text-xs font-medium">{a.name}</div>
                  <div className="truncate text-[10px] text-muted/80">{a.desc}</div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
