"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { COMPONENTS, ITEMS, UNITS, type ComponentId, type UnitId } from "@/lib/data";
import { MAX_COMPONENTS } from "@/lib/params";
import { STAGES } from "@/lib/score";

const HISTORY_KEY = "tft-pick:history"; // 이번 판 기록 (라운드별 입력 스냅샷)
type HistoryEntry = { at: number; stage: string; query: string; summary: string };

import { COST_TEXT, ItemIcon, UnitIcon } from "@/app/icons";

const STORAGE_KEY = "tft-pick:input"; // app/sync-input.tsx 와 동일 키

type PickedUnit = { unitId: UnitId; star: 1 | 2 | 3 };

export function HomeForm() {
  const router = useRouter();
  const [components, setComponents] = useState<ComponentId[]>([]);
  const [completed, setCompleted] = useState<string[]>([]); // 완성 아이템 (분해 불가라 재료로 풀지 않음)
  const [units, setUnits] = useState<PickedUnit[]>([]);
  const [query, setQuery] = useState("");
  const [costTab, setCostTab] = useState<0 | 1 | 2 | 3 | 4 | 5>(0);
  const [showItems, setShowItems] = useState(false);
  const [rivals, setRivals] = useState<UnitId[]>([]);      // 로비 스카우팅: 상대 보드에서 본 유닛
  const [rivalQuery, setRivalQuery] = useState("");
  const [showRivals, setShowRivals] = useState(false);
  const [stage, setStage] = useState<string>("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // 마지막 입력 복원/저장 (라운드마다 다시 입력하지 않도록)
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
      if (saved?.components) setComponents(saved.components);
      if (saved?.completed) setCompleted(saved.completed);
      if (saved?.rivals) { setRivals(saved.rivals); if (saved.rivals.length) setShowRivals(true); }
      if (saved?.stage) setStage(saved.stage);
      setHistory(JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]"));
      if (saved?.units) setUnits(saved.units);
    } catch {}
    setRestored(true);
  }, []);
  useEffect(() => {
    if (!restored) return; // 복원 전에 빈 값으로 덮어쓰지 않도록
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ components, completed, units, rivals, stage })); } catch {}
  }, [restored, components, completed, units, rivals]);

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
    if (rivals.length) params.set("rivals", rivals.join(","));
    if (stage) params.set("stage", stage);
    if (units.length)
      params.set("units", units.map((u) => `${u.unitId}:${u.star}`).join(","));
    const query = params.toString();
    // 이번 판 기록: 같은 스테이지는 덮어쓰기, 최대 10개
    const summary = [
      ...units.map((u) => `${UNITS.find((x) => x.id === u.unitId)?.name}${u.star > 1 ? "★".repeat(u.star) : ""}`),
      ...completed.map((id) => ITEMS.find((x) => x.id === id)?.name),
      ...components.map((c) => COMPONENTS.find((x) => x.id === c)?.name),
    ].filter(Boolean).join(", ");
    const next = [...history.filter((h) => !stage || h.stage !== stage), { at: Date.now(), stage, query, summary }].slice(-10);
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); } catch {}
    router.push(`/recommend?${query}`);
  };

  const canSubmit = components.length > 0 || completed.length > 0 || units.length > 0;

  return (
    <main className="w-full max-w-5xl px-4 py-8 sm:py-12">
      <header className="mb-8 flex items-center gap-4">
        <img src="/logo.png" alt="TFT PICK" className="size-16 shrink-0" />
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">덱 추천</h1>
          <p className="mt-1 text-sm text-muted">
            지금 가진 아이템과 유닛을 입력하면 초반에 갈 수 있는 덱 3개를 추천합니다. 입력은 자동 저장됩니다.
          </p>
        </div>
      </header>

      {/* 스테이지 + 이번 판 기록 */}
      <section className="mb-6">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs text-muted">지금 스테이지</span>
          <button onClick={() => setStage("")} className={`num rounded-md px-2.5 py-1.5 text-xs transition-colors duration-150 ${!stage ? "bg-accent text-white" : "bg-surface-2 text-muted hover:text-text"}`}>전체</button>
          {STAGES.map((s) => (
            <button key={s} onClick={() => setStage(s)} className={`num rounded-md px-2.5 py-1.5 text-xs transition-colors duration-150 ${stage === s ? "bg-accent text-white" : "bg-surface-2 text-muted hover:text-text"}`}>{s}</button>
          ))}
          <span className="ml-1 text-[10px] text-muted/60">고르면 그 시점 레벨 조합으로만 계산</span>
        </div>
        {history.length > 0 && (
          <div className="mt-3 rounded-lg border border-line p-3">
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="font-semibold">이번 판 기록</span>
              <button onClick={() => { setHistory([]); try { localStorage.removeItem(HISTORY_KEY); } catch {} }} className="text-muted hover:text-text">새 판 시작</button>
            </div>
            <ol className="space-y-0.5 text-xs">
              {history.map((h) => (
                <li key={h.at}>
                  <Link href={`/recommend?${h.query}`} className="flex gap-2 rounded px-1.5 py-1 transition-colors duration-150 hover:bg-surface-2">
                    <span className="num w-8 shrink-0 text-accent">{h.stage || "—"}</span>
                    <span className="truncate text-muted">{h.summary || "입력 없음"}</span>
                  </Link>
                </li>
              ))}
            </ol>
          </div>
        )}
      </section>

      {/* 챔피언(좌) + 아이템(우) — 둘을 한 화면에 */}
      <div className="mb-10 grid gap-6 md:grid-cols-2">

        {/* ── 왼쪽: 챔피언 ── */}
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-base font-semibold">챔피언</h2>
            <span className="text-xs text-muted/80">
              {units.length > 0 ? `${units.length}개 선택` : "테두리 색 = 코스트"}
            </span>
          </div>

          {units.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {units.map((u) => {
                const meta = UNITS.find((x) => x.id === u.unitId);
                return (
                  <div key={u.unitId} className="flex items-center gap-1.5 rounded-md bg-accent-2/70 py-1 pl-1 pr-2 text-sm">
                    <UnitIcon id={u.unitId} className="h-7" />
                    <span className="max-w-20 truncate">{meta?.name}</span>
                    <div className="flex gap-0.5">
                      {[1, 2, 3].map((st) => (
                        <button key={st} onClick={() => setStar(u.unitId, st as 1 | 2 | 3)} aria-label={`${meta?.name} ${st}성`} className={st <= u.star ? "text-text" : "text-text/30"}>★</button>
                      ))}
                    </div>
                    <button onClick={() => toggleUnit(u.unitId)} aria-label={`${meta?.name} 제거`} className="ml-0.5 opacity-80 hover:opacity-100">✕</button>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mb-2 flex flex-wrap gap-1">
            {([0, 1, 2, 3, 4, 5] as const).map((c) => (
              <button
                key={c}
                onClick={() => setCostTab(c)}
                className={`rounded px-2.5 py-1.5 text-xs font-semibold transition ${
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
            placeholder="챔피언 검색 (예: 아리)"
            inputMode="search"
            enterKeyHint="search"
            className="mb-2 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent/60"
          />
          {/* 초상화 + 이름만. 코스트는 UnitIcon 의 육각 테두리 색으로 (COST_BG) */}
          <div className="grid max-h-[55vh] grid-cols-4 gap-1 overflow-y-auto overscroll-contain rounded-lg border border-line p-2 sm:max-h-[26rem] sm:grid-cols-5">
            {filteredUnits.map((u) => {
              const picked = units.some((x) => x.unitId === u.id);
              return (
                <button
                  key={u.id}
                  onClick={() => toggleUnit(u.id)}
                  aria-pressed={picked}
                  title={`${u.name} · ${u.cost}코`}
                  className={`flex flex-col items-center gap-1 rounded-lg px-0.5 py-1.5 transition ${
                    picked ? "bg-accent-2/50 ring-1 ring-accent" : "hover:bg-surface-2"
                  }`}
                >
                  <UnitIcon id={u.id} size="md" />
                  <span className="w-full truncate text-center text-[11px] leading-tight">{u.name}</span>
                </button>
              );
            })}
            {filteredUnits.length === 0 && (
              <p className="col-span-full py-6 text-center text-xs text-muted">검색 결과 없음</p>
            )}
          </div>
        </section>

        {/* ── 오른쪽: 아이템 ── */}
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-base font-semibold">아이템</h2>
            <span className="text-xs text-muted/80">재료 환산 {slotsUsed}/{MAX_COMPONENTS}</span>
          </div>

          {(components.length > 0 || completed.length > 0) && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {completed.map((id, i) => (
                <button
                  key={`c${i}`}
                  onClick={() => setCompleted(completed.filter((_, j) => j !== i))}
                  className="flex items-center gap-1.5 rounded-md bg-accent-2/70 py-1 pl-1 pr-2 text-sm hover:bg-accent-2/60"
                  title="완성 아이템 (분해 불가)"
                >
                  <ItemIcon id={id} className="size-6" /> {ITEMS.find((x) => x.id === id)?.name} ✕
                </button>
              ))}
              {components.map((id, i) => (
                <button
                  key={i}
                  onClick={() => removeComponent(i)}
                  className="flex items-center gap-1.5 rounded-md bg-pos/25 py-1 pl-1 pr-2 text-sm hover:bg-pos/35"
                >
                  <ItemIcon id={id} className="size-6" /> {COMPONENTS.find((x) => x.id === id)?.name} ✕
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
            {COMPONENTS.map((c) => (
              <button
                key={c.id}
                onClick={() => addComponent(c.id)}
                disabled={slotsUsed >= MAX_COMPONENTS}
                className="flex flex-col items-center gap-1 rounded-lg border border-line bg-surface px-1 py-1.5 text-[10px] transition hover:border-accent/60 hover:bg-surface-2 disabled:opacity-40 sm:py-2 sm:text-xs"
              >
                <ItemIcon id={c.id} size="md" />
                {c.name}
              </button>
            ))}
          </div>

          <button onClick={() => setShowItems(!showItems)} className="mt-3 text-sm text-muted hover:text-text">
            {showItems ? "▾" : "▸"} 이미 완성한 아이템 추가 <span className="text-muted/60">(재료로 분해되지 않음)</span>
          </button>
          {showItems && (
            <div className="mt-2 grid max-h-64 grid-cols-6 gap-1.5 overflow-y-auto overscroll-contain rounded-lg border border-line p-2 sm:grid-cols-7">
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
      </div>

      {/* 로비 스카우팅 (선택) */}
      <section className="mb-10">
        <button onClick={() => setShowRivals(!showRivals)} className="text-sm text-muted hover:text-text">
          {showRivals ? "▾" : "▸"} 로비 스카우팅 <span className="text-muted/60">(선택 · 상대 보드에서 본 유닛 → 경합·상성 반영)</span>
          {rivals.length > 0 && <span className="num ml-2 text-accent">{rivals.length}</span>}
        </button>
        {showRivals && (
          <div className="mt-2 rounded-lg border border-line p-3">
            {rivals.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {rivals.map((id) => (
                  <button key={id} onClick={() => setRivals(rivals.filter((r) => r !== id))} className="flex items-center gap-1 rounded-md bg-warn/15 py-0.5 pl-0.5 pr-2 text-xs text-warn hover:bg-warn/25">
                    <UnitIcon id={id} className="h-5" /> {UNITS.find((u) => u.id === id)?.name} ✕
                  </button>
                ))}
              </div>
            )}
            <input
              value={rivalQuery}
              onChange={(e) => setRivalQuery(e.target.value)}
              placeholder="상대가 들고 있는 유닛 검색 (예: 아펠리오스)"
              className="mb-2 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent/60"
            />
            {rivalQuery.trim() && (
              <div className="flex flex-wrap gap-1">
                {UNITS.filter((u) => u.name.includes(rivalQuery.trim()) && !rivals.includes(u.id)).slice(0, 12).map((u) => (
                  <button key={u.id} onClick={() => { setRivals([...rivals, u.id]); setRivalQuery(""); }} className="flex items-center gap-1 rounded-md bg-surface px-2 py-1 text-xs hover:bg-surface-2">
                    <UnitIcon id={u.id} className="h-5" /> {u.name} <span className={COST_TEXT[u.cost]}>{u.cost}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* 모바일: 하단 고정 CTA (입력이 길어서 버튼이 화면 밖으로 나감) */}
      <div className="sticky bottom-0 -mx-4 flex gap-3 border-t border-line bg-bg/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
        <button
          onClick={submit}
          disabled={!canSubmit}
          className="flex-1 rounded-lg bg-accent py-3 font-semibold text-white transition-colors duration-150 hover:bg-accent/85 disabled:cursor-not-allowed disabled:opacity-40"
        >
          덱 추천받기{units.length + components.length + completed.length > 0 && <span className="num ml-2 text-xs font-normal text-white/70">유닛 {units.length} · 재료 {slotsUsed}</span>}
        </button>
        <Link
          href="/"
          onClick={(e) => {
            e.preventDefault();
            setComponents([]);
            setCompleted([]);
            setRivals([]);
            setStage("");
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
