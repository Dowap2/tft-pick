"use client";

// 에디터 덱 빌더 (0022_editorial_decks.sql).
//
// service_role 키를 브라우저에 두지 않는다 — 새면 DB 전체가 열린다. 대신 anon 키로
// save_editorial_deck(token, deck) RPC 를 부르고, 토큰 검증은 DB 안(security definer)에서 한다.
// 토큰이 새도 할 수 있는 일은 "에디터 덱 저장/삭제" 뿐이다.
import { useEffect, useMemo, useState } from "react";
import { ITEMS, UNITS, unitById, itemById, type UnitId } from "@/lib/data";
import { COST_TEXT, ItemIcon, UnitIcon } from "@/app/icons";

const TOKEN_KEY = "tft-pick:admin-token";
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SB_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const LEVELLINGS = ["Fast 8", "Fast 9", "Standard", "lvl 7", "lvl 8"];
const DIFFS = ["쉬움", "보통", "어려움"];
const LEVELS = [4, 5, 6, 7, 8, 9, 10];

type U = { unitId: UnitId; star: 1 | 2 | 3; items: string[] };

async function rpc(fn: string, body: unknown) {
  const res = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text.slice(0, 300));
  return text ? JSON.parse(text) : null;
}

export function AdminDeckBuilder() {
  const [token, setToken] = useState("");
  const [id, setId] = useState("ed-");
  const [name, setName] = useState("");
  const [playstyle, setPlaystyle] = useState("");
  const [levelling, setLevelling] = useState("Fast 9");
  const [difficulty, setDifficulty] = useState("보통");
  const [note, setNote] = useState("");
  const [units, setUnits] = useState<U[]>([]);
  const [carry, setCarry] = useState<UnitId | "">("");
  const [levels, setLevels] = useState<Record<number, UnitId[]>>({});
  const [q, setQ] = useState("");
  const [picking, setPicking] = useState<UnitId | null>(null);   // 아이템 붙일 유닛
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [existing, setExisting] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => { try { setToken(localStorage.getItem(TOKEN_KEY) ?? ""); } catch {} }, []);
  const saveToken = (t: string) => { setToken(t); try { localStorage.setItem(TOKEN_KEY, t); } catch {} };

  const loadExisting = async () => {
    try {
      const res = await fetch(`${SB_URL}/rest/v1/decks_editorial?select=id,name`, { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } });
      setExisting(res.ok ? await res.json() : []);
    } catch { setExisting([]); }
  };
  useEffect(() => { loadExisting(); }, []);

  const found = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? UNITS.filter((u) => u.name.toLowerCase().includes(s) || u.id.includes(s)).slice(0, 12) : [];
  }, [q]);

  const addUnit = (unitId: UnitId) => {
    if (units.some((u) => u.unitId === unitId)) return;
    setUnits([...units, { unitId, star: 2, items: [] }]);
    if (!carry) setCarry(unitId);
    setQ("");
  };
  const patch = (unitId: UnitId, p: Partial<U>) => setUnits(units.map((u) => (u.unitId === unitId ? { ...u, ...p } : u)));
  const toggleLevel = (lv: number, unitId: UnitId) => {
    const cur = levels[lv] ?? [];
    setLevels({ ...levels, [lv]: cur.includes(unitId) ? cur.filter((x) => x !== unitId) : [...cur, unitId] });
  };

  const problems = [
    !/^ed-[a-z0-9-]{2,40}$/.test(id) && "id 는 ed- 로 시작하는 소문자 슬러그여야 합니다 (예: ed-maokai-reroll)",
    !name.trim() && "이름을 입력하세요",
    !carry && "캐리를 지정하세요",
    units.length < 4 && "유닛을 4개 이상 넣으세요",
    !token && "토큰을 입력하세요",
  ].filter(Boolean) as string[];

  const save = async () => {
    setBusy(true); setMsg(null);
    try {
      const deck = {
        id, name: name.trim(), playstyle: playstyle.trim() || null, carryUnitId: carry,
        coreUnitIds: units.filter((u) => u.items.length || u.unitId === carry).slice(0, 4).map((u) => u.unitId),
        levelling, difficulty, requirementNote: note.trim() || null,
        units: units.map((u) => ({ unitId: u.unitId, star: u.star, core: true })),
        items: units.flatMap((u) => u.items.map((itemId, i) => ({
          unitId: u.unitId, itemId, priority: 1,
          role: u.unitId === carry ? (i === 0 ? "carry_core" : "carry_flex") : "tank",
        }))),
        levels: Object.fromEntries(Object.entries(levels).filter(([, v]) => v.length)),
      };
      const savedId = await rpc("save_editorial_deck", { p_token: token, p_deck: deck });
      setMsg({ ok: true, text: `저장됨: ${savedId} — 다음 배포부터 /decks 와 /deck/${savedId} 에 나옵니다` });
      loadExisting();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally { setBusy(false); }
  };

  const remove = async (delId: string) => {
    if (!confirm(`${delId} 삭제?`)) return;
    try { await rpc("delete_editorial_deck", { p_token: token, p_id: delId }); loadExisting(); setMsg({ ok: true, text: `${delId} 삭제됨` }); }
    catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
  };

  const field = "w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm outline-none focus:border-accent";

  return (
    <main className="w-full max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold">덱 빌더 <span className="text-sm font-normal text-muted">에디터 추천용</span></h1>
      <p className="mt-1 mb-5 text-xs text-muted">
        여기서 만든 덱은 티어 리스트와 섞이지 않고 <strong>에디터 추천</strong> 자리에만 나옵니다. 티어·평균 등수는 붙지 않습니다.
        저장은 DB 에 즉시 반영되지만, 화면은 정적 빌드라 <strong>다음 배포부터</strong> 보입니다.
      </p>

      <label className="mb-5 block">
        <span className="text-xs text-muted">관리자 토큰</span>
        <input type="password" value={token} onChange={(e) => saveToken(e.target.value)} placeholder="admin_secrets.editorial_token" className={field} />
      </label>

      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <label><span className="text-xs text-muted">id (URL)</span><input value={id} onChange={(e) => setId(e.target.value)} placeholder="ed-maokai-reroll" className={field} /></label>
        <label><span className="text-xs text-muted">덱 이름</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="지옥불 마오카이" className={field} /></label>
        <label><span className="text-xs text-muted">레벨링</span>
          <select value={levelling} onChange={(e) => setLevelling(e.target.value)} className={field}>{LEVELLINGS.map((l) => <option key={l}>{l}</option>)}</select>
        </label>
        <label><span className="text-xs text-muted">난이도</span>
          <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className={field}>{DIFFS.map((d) => <option key={d}>{d}</option>)}</select>
        </label>
      </div>
      <label className="mb-3 block"><span className="text-xs text-muted">한 줄 공략</span>
        <textarea value={playstyle} onChange={(e) => setPlaystyle(e.target.value)} rows={3} className={field} placeholder="초반 무엇으로 버티고, 언제 레벨업하고, 아이템 우선순위는…" />
      </label>
      <label className="mb-6 block"><span className="text-xs text-muted">조건 안내 (선택)</span>
        <input value={note} onChange={(e) => setNote(e.target.value)} className={field} placeholder="기원자 상징이 있어야 완성되는 덱입니다" />
      </label>

      <section className="mb-6">
        <h2 className="mb-2 text-lg font-semibold">유닛 <span className="text-xs font-normal text-muted">{units.length}개 · 클릭해 캐리 지정</span></h2>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="챔피언 검색해서 추가" className={`${field} mb-2`} />
        {found.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1">
            {found.map((u) => (
              <button key={u.id} onClick={() => addUnit(u.id)} className="flex items-center gap-1 rounded-md border border-line bg-surface px-2 py-1 text-xs hover:border-accent/60">
                <UnitIcon id={u.id} className="h-5" /> {u.name} <span className={COST_TEXT[u.cost]}>{u.cost}</span>
              </button>
            ))}
          </div>
        )}
        <div className="space-y-2">
          {units.map((u) => (
            <div key={u.unitId} className="panel flex flex-wrap items-center gap-2 rounded-lg bg-surface p-2">
              <button onClick={() => setCarry(u.unitId)} title="캐리로 지정" className="shrink-0">
                <UnitIcon id={u.unitId} size="md" carry={u.unitId === carry} />
              </button>
              <span className="w-20 truncate text-sm">{unitById(u.unitId)?.name}</span>
              <div className="flex gap-0.5">
                {[1, 2, 3].map((st) => (
                  <button key={st} onClick={() => patch(u.unitId, { star: st as 1 | 2 | 3 })} className={st <= u.star ? "text-warn" : "text-muted/40"}>★</button>
                ))}
              </div>
              <div className="flex items-center gap-1">
                {u.items.map((it, i) => (
                  <button key={i} onClick={() => patch(u.unitId, { items: u.items.filter((_, j) => j !== i) })} title="제거">
                    <ItemIcon id={it} className="size-6" />
                  </button>
                ))}
                {u.items.length < 3 && (
                  <button onClick={() => setPicking(picking === u.unitId ? null : u.unitId)} className="rounded border border-dashed border-line px-2 py-1 text-[10px] text-muted hover:border-accent/60">
                    {picking === u.unitId ? "닫기" : "+ 아이템"}
                  </button>
                )}
              </div>
              <button onClick={() => { setUnits(units.filter((x) => x.unitId !== u.unitId)); if (carry === u.unitId) setCarry(""); }} className="ml-auto text-xs text-muted hover:text-neg">✕</button>
              {picking === u.unitId && (
                <div className="grid w-full grid-cols-8 gap-1 border-t border-line pt-2 sm:grid-cols-12">
                  {ITEMS.map((it) => (
                    <button key={it.id} title={it.name} onClick={() => { patch(u.unitId, { items: [...u.items, it.id] }); setPicking(null); }} className="rounded border border-line p-0.5 hover:border-accent/60">
                      <ItemIcon id={it.id} className="mx-auto size-6" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-lg font-semibold">레벨별 조합 <span className="text-xs font-normal text-muted">선택 · 비워두면 최종 조합만</span></h2>
        <div className="space-y-1.5">
          {LEVELS.map((lv) => (
            <div key={lv} className="flex flex-wrap items-center gap-1">
              <span className="num w-9 shrink-0 text-xs text-accent">{lv}렙</span>
              {units.map((u) => {
                const on = (levels[lv] ?? []).includes(u.unitId);
                return (
                  <button key={u.unitId} onClick={() => toggleLevel(lv, u.unitId)} title={unitById(u.unitId)?.name}
                    className={`rounded ${on ? "opacity-100 ring-2 ring-accent" : "opacity-35"}`}>
                    <UnitIcon id={u.unitId} size="sm" />
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </section>

      {problems.length > 0 && (
        <ul className="mb-3 space-y-0.5 text-xs text-warn">{problems.map((p) => <li key={p}>· {p}</li>)}</ul>
      )}
      <button onClick={save} disabled={busy || problems.length > 0}
        className="w-full rounded-lg bg-accent-strong py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">
        {busy ? "저장 중…" : "저장"}
      </button>
      {msg && <p className={`mt-2 text-sm ${msg.ok ? "text-pos" : "text-neg"}`}>{msg.text}</p>}

      {existing.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-2 text-lg font-semibold">저장된 에디터 덱 {existing.length}개</h2>
          <div className="panel divide-y divide-line rounded-xl bg-surface">
            {existing.map((d) => (
              <div key={d.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                <span className="num text-xs text-muted">{d.id}</span><span>{d.name}</span>
                <button onClick={() => remove(d.id)} className="ml-auto text-xs text-muted hover:text-neg">삭제</button>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
