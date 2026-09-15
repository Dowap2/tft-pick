import type { ComponentId, UnitId } from "./data";
import type { UserInput, UserUnit } from "./score";

const VALID_COMPONENTS = new Set<ComponentId>([
  "bf", "bow", "rod", "tear", "vest", "cloak", "belt", "gloves", "spatula",
]);

export function parseUserInput(sp: Record<string, string | string[] | undefined>): UserInput {
  const itemsRaw = typeof sp.items === "string" ? sp.items : "";
  const unitsRaw = typeof sp.units === "string" ? sp.units : "";

  const components: ComponentId[] = itemsRaw
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is ComponentId => VALID_COMPONENTS.has(s as ComponentId))
    .slice(0, 3);

  const units: UserUnit[] = unitsRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((pair) => {
      const [id, starStr] = pair.split(":");
      const star = Math.min(3, Math.max(1, parseInt(starStr ?? "1", 10) || 1)) as 1 | 2 | 3;
      return { unitId: id as UnitId, star };
    });

  return { components, units };
}

export function buildQuery(input: UserInput): string {
  const p = new URLSearchParams();
  if (input.components.length) p.set("items", input.components.join(","));
  if (input.units.length)
    p.set("units", input.units.map((u) => `${u.unitId}:${u.star}`).join(","));
  return p.toString();
}
