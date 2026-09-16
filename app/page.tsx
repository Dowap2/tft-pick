"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { COMPONENTS, ITEMS, UNITS, type ComponentId, type UnitId } from "@/lib/data";
import { MAX_COMPONENTS } from "@/lib/params";
import { COST_TEXT, ItemIcon, UnitIcon } from "@/app/icons";

const STORAGE_KEY = "tft-pick:input";

type PickedUnit = { unitId: UnitId; star: 1 | 2 | 3 };

export default function Home() {
  const router = useRouter();
  const [components, setComponents] = useState<ComponentId[]>([]);
  const [completed, setCompleted] = useState<string[]>([]); // 완성 아이템 (분해 불가라 재료로 풀지 않음)
  const [units, setUnits] = useState<PickedUnit[]>([]);
  const [query, setQuery] = useState("");
  const [costTab, setCostTab] = useState<0 | 1 | 2 | 3 | 4 | 5>(0);
  const [showItems, setShowItems] = useState(false);

  // 마지막 입력 복원/저장 (라운드마다 다시 입력하지 않도록)
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
      if (saved?.components) setComponents(saved.components);
      if (saved?.completed) setCompleted(saved.completed);
      if (saved?.units) setUnits(saved.units);
    } catch {}
    setRestored(true);
  }, []);
  useEffect(() => {
    if (!restored) return; // 복원 전에 빈 값으로 덮어쓰지 않도록
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ components, completed, units })); } catch {}
  }, [restored, components, completed, units]);

  // 재료 상한은 "재료 환산" 기준: 완성템 1개 = 재료 2개
  const slotsUsed = components.length + completed.length * 2;

  const addComponent = (id: ComponentId) => {
    if (slotsUsed >= MAX_COMPONENTS) return;
    setComponents([...components, id]);
  };
  const addItem = (id: string) => {
    if (slotsUsed + 2 > MAX_COMPONENTS) return;
    setCompleted([...completed, id]);
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
    return UNITS.filter(
      (u) => (costTab === 0 || u.cost === costTab) && (!q || u.name.toLowerCase().includes(q) || u.id.includes(q)),
    );
  }, [query, costTab]);

  const submit = () => {
    const params = new URLSearchParams();
    if (components.length) params.set("items", components.join(","));
    if (completed.length) params.set("done", completed.join(","));
    if (units.length)
      params.set("units", units.map((u) => `${u.unitId}:${u.star}`).join(","));
    router.push(`/recommend?${params.toString()}`);
  };

  const canSubmit = components.length > 0 || completed.length > 0 || units.length > 0;

  return (
    <main className="w-full max-w-3xl px-4 py-8 sm:py-12">
      <header className="mb-8 flex items-center gap-4">
        <img src="/logo.png" alt="TFT PICK" className="size-16 shrink-0" />
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">덱 추천</h1>
          <p className="mt-1 text-sm text-muted">
            지금 가진 아이템과 유닛을 입력하면 초반에 갈 수 있는 덱 3개를 추천합니다. 입력은 자동 저장됩니다.
          </p>
        </div>
      </header>

      {/* 아이템 선택 */}
      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">아이템</h2>
          <span className="text-sm text-muted/80">재료 환산 {slotsUsed}/{MAX_COMPONENTS}</span>
        </div>

        {(components.length > 0 || completed.length > 0) && (
          <div className="mb-3 flex flex-wrap gap-2">
            {completed.map((id, i) => (
              <button
                key={`c${i}`}
                onClick={() => setCompleted(completed.filter((_, j) => j !== i))}
                className="flex items-center gap-1.5 rounded-md bg-accent-2/70 py-1 pl-1 pr-3 text-sm hover:bg-accent-2/60"
                title="완성 아이템 (분해 불가)"
              >
                <ItemIcon id={id} className="size-6" /> {ITEMS.find((x) => x.id === id)?.name} ✕
              </button>
            ))}
            {components.map((id, i) => {
              const c = COMPONENTS.find((x) => x.id === id);
              return (
                <button
                  key={i}
                  onClick={() => removeComponent(i)}
                  className="flex items-center gap-1.5 rounded-md bg-pos/25 py-1 pl-1 pr-3 text-sm hover:bg-pos/35"
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
              disabled={slotsUsed >= MAX_COMPONENTS}
              className="flex flex-col items-center gap-1 rounded-lg border border-line bg-surface px-2 py-2 text-xs transition hover:border-accent/60 hover:bg-surface-2 disabled:opacity-40"
            >
              <ItemIcon id={c.id} size="md" />
              {c.name}
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowItems(!showItems)}
          className="mt-3 text-sm text-muted hover:text-text"
        >
          {showItems ? "▾" : "▸"} 이미 완성한 아이템 추가 <span className="text-muted/60">(재료로 분해되지 않음)</span>
        </button>
        {showItems && (
          <div className="mt-2 grid grid-cols-6 gap-1.5 rounded-lg border border-line p-2 sm:grid-cols-9">
            {ITEMS.map((it) => (
              <button
                key={it.id}
                onClick={() => addItem(it.id)}
                disabled={slotsUsed + 2 > MAX_COMPONENTS}
                title={it.name}
                className="rounded transition hover:bg-surface-2 disabled:opacity-40"
              >
                <ItemIcon id={it.id} size="md" className="mx-auto" />
              </button>
            ))}
          </div>
        )}
      </section>

      {/* 유닛 선택 */}
      <section className="mb-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">보유 유닛</h2>
          <span className="text-sm text-muted/80">{units.length}개 선택</span>
        </div>

        {units.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {units.map((u) => {
              const meta = UNITS.find((x) => x.id === u.unitId);
              return (
                <div
                  key={u.unitId}
                  className="flex items-center gap-2 rounded-md bg-accent-2/70 py-1 pl-1 pr-3 text-sm"
                >
                  <UnitIcon id={u.unitId} className="h-7" />
                  <span>{meta?.name}</span>
                  <div className="flex gap-0.5">
                    {[1, 2, 3].map((s) => (
                      <button
                        key={s}
                        onClick={() => setStar(u.unitId, s as 1 | 2 | 3)}
                        className={
                          s <= u.star ? "text-text" : "text-text/30"
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

        <div className="mb-2 flex gap-1">
          {([0, 1, 2, 3, 4, 5] as const).map((c) => (
            <button
              key={c}
              onClick={() => setCostTab(c)}
              className={`rounded px-2.5 py-1 text-xs font-semibold transition ${
                costTab === c ? "bg-accent text-white" : `bg-surface ${c ? COST_TEXT[c] : "text-muted"} hover:bg-surface-2`
              }`}
            >
              {c ? `${c}코` : "전체"}
            </button>
          ))}
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="유닛 검색 (예: 아리)"
          className="mb-3 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent/60"
        />
        <div className="grid max-h-72 grid-cols-2 gap-1.5 overflow-y-auto rounded-lg border border-line p-2 sm:grid-cols-3">
          {filteredUnits.map((u) => {
            const picked = units.some((x) => x.unitId === u.id);
            return (
              <button
                key={u.id}
                onClick={() => toggleUnit(u.id)}
                className={`flex items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition ${
                  picked
                    ? "bg-accent-2/50"
                    : "bg-surface hover:bg-surface-2"
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
          className="flex-1 rounded-lg bg-accent py-3 font-semibold text-white transition-colors duration-150 hover:bg-accent/85 disabled:cursor-not-allowed disabled:opacity-40"
        >
          덱 추천받기
        </button>
        <Link
          href="/"
          onClick={(e) => {
            e.preventDefault();
            setComponents([]);
            setCompleted([]);
            setUnits([]);
            setQuery("");
            try { localStorage.removeItem(STORAGE_KEY); } catch {}
          }}
          className="rounded-lg border border-line px-4 py-3 text-sm hover:bg-surface-2"
        >
          초기화
        </Link>
      </div>
    </main>
  );
}
