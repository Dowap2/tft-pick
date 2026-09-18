import Link from "next/link";
import { TRAITS, UNITS, activeTraits, traitImgByApi } from "@/lib/data";
import { getDecks } from "@/lib/decks";

export const dynamic = "force-static";
import { TierBadge, UnitIcon } from "@/app/icons";
import meta from "@/lib/gen/meta.json";

export const metadata = {
  title: "TFT 시너지(특성) 목록 - 활성 인원과 보유 챔피언",
  description: `롤토체스 Set ${meta.set} 시너지 전체. 활성 단계, 보유 챔피언, 이 시너지를 쓰는 메타 덱.`,
  alternates: { canonical: "/traits" },
};

export default async function TraitsPage() {
  const DECKS = await getDecks();
  const rows = Object.values(TRAITS)
    .map((t) => ({
      ...t,
      units: UNITS.filter((u) => u.traits.includes(t.name)).sort((a, b) => a.cost - b.cost),
      decks: DECKS.filter((d) => activeTraits(d.coreUnits.map((u) => u.unitId)).some((a) => a.name === t.name)).sort((a, b) => a.avgPlacement - b.avgPlacement),
    }))
    .filter((t) => t.units.length > 0)
    .sort((a, b) => b.units.length - a.units.length || a.name.localeCompare(b.name, "ko"));

  return (
    <main className="w-full max-w-3xl px-4 py-8 sm:py-10">
      <header className="mb-5">
        <h1 className="text-2xl font-bold sm:text-3xl">시너지</h1>
        <p className="mt-1 text-sm text-muted">{rows.length}개 · 보유 챔피언 수 순. 숫자는 활성 인원 단계.</p>
      </header>
      <div className="panel divide-y divide-line rounded-xl bg-surface">
        {rows.map((t) => (
          <article key={t.name} className="px-3 py-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex size-8 items-center justify-center rounded bg-surface-2"><img src={traitImgByApi(t.id)} alt="" className="size-5 brightness-0 invert" /></span>
              <h2 className="text-sm font-semibold">{t.name}</h2>
              <span className="num text-xs text-muted">{t.breakpoints.join(" / ")}</span>
              <div className="ml-auto flex flex-wrap justify-end gap-1 text-[11px]">
                {t.decks.slice(0, 3).map((d) => (
                  <Link key={d.id} href={`/deck/${d.id}`} className="flex items-center gap-1 rounded-md border border-line px-1.5 py-0.5 text-muted transition-colors duration-150 hover:border-accent/60 hover:text-text">
                    <TierBadge tier={d.tierLabel} />{d.name}
                  </Link>
                ))}
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {t.units.map((u) => (
                <Link key={u.id} href={`/champions#${u.id}`} title={u.name} className="flex flex-col items-center">
                  <UnitIcon id={u.id} size="sm" className="h-9!" />
                  <span className="w-11 truncate text-center text-[9px] leading-3 text-muted">{u.name}</span>
                </Link>
              ))}
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
