import type { AreaId } from "./types";

export interface Area {
  id: AreaId;
  label: string;
  /** Hinweistext, wenn an einem Tag niemand aus dem Bereich eingeteilt ist. */
  nobody: string;
}

/** Bereiche in der Reihenfolge, in der sie im Plan erscheinen. */
export const AREAS: readonly Area[] = [
  { id: "kitchen", label: "Küche", nobody: "niemand in der Küche eingeteilt" },
  { id: "driver", label: "Fahrer", nobody: "kein Fahrer eingeteilt" },
];

export function areaLabel(id: AreaId): string {
  return AREAS.find((a) => a.id === id)?.label ?? id;
}

/** Auswählbare Erkennungsfarben für Mitarbeiter. */
export const EMPLOYEE_COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#0ea5e9",
  "#6366f1",
  "#a855f7",
  "#ec4899",
  "#78716c",
] as const;
