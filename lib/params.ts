import { ITEMS, UNITS, type ComponentId, type UnitId } from "./data";
import { STAGES, type UserInput, type UserUnit } from "./score";

// 재료 상한: 완성템 3개 + 여분 2개
export const MAX_COMPONENTS = 8;

const VALID_COMPONENTS = new Set<ComponentId>([
  "bf", "bow", "rod", "tear", "vest", "cloak", "belt", "gloves", "spatula", "pan",
]);

export function parseUserInput(sp: Record<string, string | string[] | undefined>): UserInput {
  const itemsRaw = typeof sp.items === "string" ? sp.items : "";
  const unitsRaw = typeof sp.units === "string" ? sp.units : "";
  const doneRaw = typeof sp.done === "string" ? sp.done : "";
  const rivalsRaw = typeof sp.rivals === "string" ? sp.rivals : "";

  const components: ComponentId[] = itemsRaw
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is ComponentId => VALID_COMPONENTS.has(s as ComponentId))
    .slice(0, MAX_COMPONENTS);

  const completed = doneRaw
    .split(",")
    .map((s) => s.trim())
    .filter((id) => ITEMS.some((i) => i.id === id))
    .slice(0, 4);

  const units: UserUnit[] = unitsRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((pair) => {
      const [id, starStr] = pair.split(":");
      const star = Math.min(3, Math.max(1, parseInt(starStr ?? "1", 10) || 1)) as 1 | 2 | 3;
      return { unitId: id as UnitId, star };
    });

  const rivals = rivalsRaw.split(",").map((s) => s.trim()).filter((id) => UNITS.some((u) => u.id === id)).slice(0, 20);

  const stage = typeof sp.stage === "string" && (STAGES as readonly string[]).includes(sp.stage) ? sp.stage : undefined;

  return { components, completed, units, rivals, stage };
}

export function buildQuery(input: UserInput): string {
  const p = new URLSearchParams();
  if (input.components.length) p.set("items", input.components.join(","));
  if (input.completed.length) p.set("done", input.completed.join(","));
  if (input.rivals?.length) p.set("rivals", input.rivals.join(","));
  if (input.stage) p.set("stage", input.stage);
  if (input.units.length)
    p.set("units", input.units.map((u) => `${u.unitId}:${u.star}`).join(","));
  return p.toString();
}

/** 유닛 보유 토글: 있으면 빼고, 없으면 star로 추가 (덱 페이지에서 "산 것처럼" 보기) */
export function toggleUnitQuery(input: UserInput, unitId: UnitId, star: 1 | 2 | 3 = 1): string {
  const has = input.units.some((u) => u.unitId === unitId);
  const units = has ? input.units.filter((u) => u.unitId !== unitId) : [...input.units, { unitId, star }];
  return buildQuery({ ...input, units });
}
