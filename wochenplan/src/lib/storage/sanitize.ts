import { DEFAULT_SETTINGS, type AppData, type AreaId, type Cell, type DayIndex, type Employee, type Entry, type Template, type WeekEntries, type WeekPlan } from "../types";

/**
 * Prüft gespeicherte oder importierte Daten und repariert, was sich reparieren lässt.
 * Unbrauchbare Teile werden verworfen statt die App zum Absturz zu bringen.
 */

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown, fallback = ""): string => (typeof v === "string" ? v : fallback);
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}$/;

function area(v: unknown): AreaId {
  return v === "driver" ? "driver" : "kitchen";
}

function entry(v: unknown): Entry | null {
  if (!isObj(v)) return null;
  if (v.kind === "off") return { kind: "off" };
  if (v.kind === "text" && typeof v.text === "string" && v.text.trim()) return { kind: "text", text: v.text };
  if (v.kind === "shift") {
    const start = typeof v.start === "string" && TIME.test(v.start) ? v.start : null;
    const end = typeof v.end === "string" && TIME.test(v.end) ? v.end : null;
    const untilClose = v.untilClose === true;
    if (!start && !end && !untilClose) return null;
    return { kind: "shift", start, end, untilClose };
  }
  return null;
}

function entries(v: unknown): WeekEntries {
  const result: WeekEntries = {};
  if (!isObj(v)) return result;
  for (const [id, row] of Object.entries(v)) {
    if (!isObj(row)) continue;
    const clean: Partial<Record<DayIndex, Cell>> = {};
    for (const [day, cell] of Object.entries(row)) {
      const d = Number(day);
      if (!Number.isInteger(d) || d < 0 || d > 6 || !Array.isArray(cell)) continue;
      const list = cell.map(entry).filter((e): e is Entry => e !== null);
      if (list.length > 0) clean[d as DayIndex] = list;
    }
    if (Object.keys(clean).length > 0) result[id] = clean;
  }
  return result;
}

function employee(v: unknown, index: number): Employee | null {
  if (!isObj(v) || typeof v.id !== "string" || typeof v.name !== "string" || !v.name.trim()) return null;
  return {
    id: v.id,
    name: v.name.trim(),
    area: area(v.area),
    color: typeof v.color === "string" && /^#[0-9a-f]{6}$/i.test(v.color) ? v.color : null,
    active: v.active !== false,
    deleted: v.deleted === true,
    sortOrder: typeof v.sortOrder === "number" ? v.sortOrder : index,
  };
}

function week(key: string, v: unknown): WeekPlan | null {
  if (!isObj(v)) return null;
  const weekStart = str(v.weekStart, key);
  if (!DATE.test(weekStart)) return null;
  const notes: WeekPlan["notes"] = {};
  if (isObj(v.notes)) {
    for (const [day, text] of Object.entries(v.notes)) {
      const d = Number(day);
      if (Number.isInteger(d) && d >= 0 && d <= 6 && typeof text === "string" && text.trim()) notes[d as DayIndex] = text;
    }
  }
  const areas: WeekPlan["areas"] = {};
  if (isObj(v.areas)) for (const [id, a] of Object.entries(v.areas)) areas[id] = area(a);
  return { weekStart, entries: entries(v.entries), notes, areas, updatedAt: str(v.updatedAt, new Date().toISOString()) };
}

function template(v: unknown): Template | null {
  if (!isObj(v) || typeof v.id !== "string" || typeof v.name !== "string") return null;
  return { id: v.id, name: v.name, entries: entries(v.entries), createdAt: str(v.createdAt, new Date().toISOString()) };
}

export function sanitizeAppData(raw: unknown): AppData {
  const data = isObj(raw) ? raw : {};
  const employees = (Array.isArray(data.employees) ? data.employees : [])
    .map(employee)
    .filter((e): e is Employee => e !== null);
  const weeks: Record<string, WeekPlan> = {};
  if (isObj(data.weeks)) {
    for (const [key, value] of Object.entries(data.weeks)) {
      const w = week(key, value);
      if (w) weeks[w.weekStart] = w;
    }
  }
  const templates = (Array.isArray(data.templates) ? data.templates : [])
    .map(template)
    .filter((t): t is Template => t !== null);
  const s = isObj(data.settings) ? data.settings : {};
  return {
    employees,
    weeks,
    templates,
    settings: {
      title: str(s.title, DEFAULT_SETTINGS.title).trim() || DEFAULT_SETTINGS.title,
      showNotesInExport: s.showNotesInExport !== false,
    },
  };
}

/** Erkennt, ob eine Datei überhaupt eine Sicherung dieser App ist. */
export function looksLikeBackup(raw: unknown): boolean {
  return isObj(raw) && Array.isArray(raw.employees) && isObj(raw.weeks);
}
