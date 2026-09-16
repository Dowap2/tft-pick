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
      if (saved?.units) setUnits(saved.units);
    } catch {}
    setRestored(true);
  }, []);
  useEffect(() => {
    if (!restored) return; // 복원 전에 빈 값으로 덮어쓰지 않도록
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ components, units })); } catch {}
  }, [restored, components, units]);

  const addComponent = (id: ComponentId) => {
    if (components.length >= MAX_COMPONENTS) return;
    setComponents([...components, id]);
  };
  // 완성 아이템 = 재료 2개로 풀어서 추가 (점수 로직은 재료 기준 그대로)
  const addItem = (recipe: [ComponentId, ComponentId]) => {
    if (components.length + 2 > MAX_COMPONENTS) return;
    setComponents([...components, ...recipe]);
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
    if (units.length)
      params.set("units", units.map((u) => `${u.unitId}:${u.star}`).join(","));
    router.push(`/recommend?${params.toString()}`);
  };

  const canSubmit = components.length > 0 || units.length > 0;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-gold-light">덱 추천</h1>
        <p className="mt-2 text-muted">
          지금 가진 아이템과 유닛을 입력하면 갈 수 있는 덱 3개를 추천해줍니다. 입력은 자동 저장됩니다.
        </p>
      </header>

      {/* 아이템 선택 */}
      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gold-light">아이템</h2>
          <span className="text-sm text-muted/80">재료 {components.length}/{MAX_COMPONENTS}</span>
        </div>

        {components.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {components.map((id, i) => {
              const c = COMPONENTS.find((x) => x.id === id);
              return (
                <button
                  key={i}
                  onClick={() => removeComponent(i)}
                  className="flex items-center gap-1.5 rounded-full bg-teal/80 py-1 pl-1 pr-3 text-sm hover:bg-teal"
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
              disabled={components.length >= MAX_COMPONENTS}
              className="flex flex-col items-center gap-1 rounded-lg border border-gold/25 bg-panel px-2 py-2 text-xs transition hover:border-gold/70 hover:bg-panel-2 disabled:opacity-40"
            >
              <ItemIcon id={c.id} size="md" />
              {c.name}
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowItems(!showItems)}
          className="mt-3 text-sm text-muted hover:text-gold-light"
        >
          {showItems ? "▾" : "▸"} 완성 아이템으로 추가
        </button>
        {showItems && (
          <div className="mt-2 grid grid-cols-6 gap-1.5 rounded-lg border border-gold/15 p-2 sm:grid-cols-9">
            {ITEMS.map((it) => (
              <button
                key={it.id}
                onClick={() => addItem(it.recipe)}
                disabled={components.length + 2 > MAX_COMPONENTS}
                title={it.name}
                className="rounded transition hover:bg-panel-2 disabled:opacity-40"
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
          <h2 className="text-lg font-semibold text-gold-light">보유 유닛</h2>
          <span className="text-sm text-muted/80">{units.length}개 선택</span>
        </div>

        {units.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {units.map((u) => {
              const meta = UNITS.find((x) => x.id === u.unitId);
              return (
                <div
                  key={u.unitId}
                  className="flex items-center gap-2 rounded-full bg-gold-dark/90 py-1 pl-1 pr-3 text-sm"
                >
                  <UnitIcon id={u.unitId} className="h-7" />
                  <span>{meta?.name}</span>
                  <div className="flex gap-0.5">
                    {[1, 2, 3].map((s) => (
                      <button
                        key={s}
                        onClick={() => setStar(u.unitId, s as 1 | 2 | 3)}
                        className={
                          s <= u.star ? "text-gold-light" : "text-parchment/30"
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
                costTab === c ? "bg-gold text-navy" : `bg-panel ${c ? COST_TEXT[c] : "text-muted"} hover:bg-panel-2`
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
          className="mb-3 w-full rounded-lg border border-gold/25 bg-panel px-3 py-2 text-sm outline-none focus:border-gold/70"
        />
        <div className="grid max-h-72 grid-cols-2 gap-1.5 overflow-y-auto rounded-lg border border-gold/15 p-2 sm:grid-cols-3">
          {filteredUnits.map((u) => {
            const picked = units.some((x) => x.unitId === u.id);
            return (
              <button
                key={u.id}
                onClick={() => toggleUnit(u.id)}
                className={`flex items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition ${
                  picked
                    ? "bg-gold-dark/70"
                    : "bg-panel hover:bg-panel-2"
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
          className="flex-1 rounded-lg bg-gold py-3 font-semibold text-navy transition hover:bg-gold-light disabled:cursor-not-allowed disabled:opacity-40"
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
            try { localStorage.removeItem(STORAGE_KEY); } catch {}
          }}
          className="rounded-lg border border-gold/25 px-4 py-3 text-sm hover:bg-panel-2"
        >
          초기화
        </Link>
      </div>
    </main>
  );
}
