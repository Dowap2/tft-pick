"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { COMPONENTS, UNITS, type ComponentId, type UnitId } from "@/lib/data";
import { COST_TEXT, ItemIcon, UnitIcon } from "@/app/icons";

type PickedUnit = { unitId: UnitId; star: 1 | 2 | 3 };

export default function Home() {
  const router = useRouter();
  const [components, setComponents] = useState<ComponentId[]>([]);
  const [units, setUnits] = useState<PickedUnit[]>([]);
  const [query, setQuery] = useState("");

  const addComponent = (id: ComponentId) => {
    if (components.length >= 3) return;
    setComponents([...components, id]);
  };
  const removeComponent = (idx: number) => {
    setComponents(components.filter((_, i) => i !== idx));
  };

  const toggleUnit = (id: UnitId) => {
    if (units.some((u) => u.unitId === id)) {
      setUnits(units.filter((u) => u.unitId !== id));
    } else {
      setUnits([...units, { unitId: id, star: 1 }]);
    }
  };
  const setStar = (id: UnitId, star: 1 | 2 | 3) => {
    setUnits(units.map((u) => (u.unitId === id ? { ...u, star } : u)));
  };

  const filteredUnits = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return UNITS;
    return UNITS.filter(
      (u) => u.name.toLowerCase().includes(q) || u.id.includes(q),
    );
  }, [query]);

  const submit = () => {
    const params = new URLSearchParams();
    if (components.length) params.set("items", components.join(","));
    if (units.length)
      params.set("units", units.map((u) => `${u.unitId}:${u.star}`).join(","));
    router.push(`/recommend?${params.toString()}`);
  };

  const canSubmit = components.length > 0 || units.length > 0;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">TFT PICK</h1>
        <p className="mt-2 text-zinc-400">
          지금 가진 아이템과 유닛을 입력하면 갈 수 있는 덱 3개를 추천해줍니다.
        </p>
      </header>

      {/* 아이템 선택 */}
      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">아이템 재료 (최대 3개)</h2>
          <span className="text-sm text-zinc-500">{components.length}/3</span>
        </div>

        {components.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {components.map((id, i) => {
              const c = COMPONENTS.find((x) => x.id === id);
              return (
                <button
                  key={i}
                  onClick={() => removeComponent(i)}
                  className="flex items-center gap-1.5 rounded-full bg-emerald-600 py-1 pl-1 pr-3 text-sm hover:bg-emerald-500"
                >
                  <ItemIcon id={id} className="size-6" /> {c?.name} ✕
                </button>
              );
            })}
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {COMPONENTS.map((c) => (
            <button
              key={c.id}
              onClick={() => addComponent(c.id)}
              disabled={components.length >= 3}
              className="flex flex-col items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-2 text-xs transition hover:border-zinc-600 hover:bg-zinc-800 disabled:opacity-40"
            >
              <ItemIcon id={c.id} size="md" />
              {c.name}
            </button>
          ))}
        </div>
      </section>

      {/* 유닛 선택 */}
      <section className="mb-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">보유 유닛</h2>
          <span className="text-sm text-zinc-500">{units.length}개 선택</span>
        </div>

        {units.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {units.map((u) => {
              const meta = UNITS.find((x) => x.id === u.unitId);
              return (
                <div
                  key={u.unitId}
                  className="flex items-center gap-2 rounded-full bg-indigo-600/80 py-1 pl-1 pr-3 text-sm"
                >
                  <UnitIcon id={u.unitId} className="size-7" />
                  <span>{meta?.name}</span>
                  <div className="flex gap-0.5">
                    {[1, 2, 3].map((s) => (
                      <button
                        key={s}
                        onClick={() => setStar(u.unitId, s as 1 | 2 | 3)}
                        className={
                          s <= u.star ? "text-yellow-300" : "text-indigo-300/50"
                        }
                      >
                        ★
                      </button>
                    ))}
                  </div>
                  <button onClick={() => toggleUnit(u.unitId)} className="ml-1 opacity-80 hover:opacity-100">
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="유닛 검색 (예: 아리)"
          className="mb-3 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-zinc-600"
        />
        <div className="grid max-h-72 grid-cols-2 gap-1.5 overflow-y-auto rounded-lg border border-zinc-900 p-2 sm:grid-cols-3">
          {filteredUnits.map((u) => {
            const picked = units.some((x) => x.unitId === u.id);
            return (
              <button
                key={u.id}
                onClick={() => toggleUnit(u.id)}
                className={`flex items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition ${
                  picked
                    ? "bg-indigo-600/60"
                    : "bg-zinc-900 hover:bg-zinc-800"
                }`}
              >
                <UnitIcon id={u.id} size="sm" />
                <span className="flex-1">{u.name}</span>
                <span className={`text-xs ${COST_TEXT[u.cost]}`}>{u.cost}코</span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="flex gap-3">
        <button
          onClick={submit}
          disabled={!canSubmit}
          className="flex-1 rounded-lg bg-emerald-500 py-3 font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          덱 추천받기
        </button>
        <Link
          href="/"
          onClick={(e) => {
            e.preventDefault();
            setComponents([]);
            setUnits([]);
            setQuery("");
          }}
          className="rounded-lg border border-zinc-800 px-4 py-3 text-sm hover:bg-zinc-900"
        >
          초기화
        </Link>
      </div>
    </main>
  );
}
