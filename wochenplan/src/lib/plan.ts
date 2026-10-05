import { AREAS, type Area } from "./areas";
import { cellProblems, formatCell, isEmptyCell, isWorking, sortKey } from "./time-entry";
import type { Cell, DayIndex, Employee, ISODate, Template, WeekEntries, WeekPlan } from "./types";
import { DAY_INDICES, DAY_NAMES } from "./week";

/**
 * Reine Funktionen rund um einen Wochenplan.
 * Sie verändern nichts, sondern geben immer neue Objekte zurück –
 * dadurch sind sie leicht zu testen und Rückgängig-machen ist trivial.
 */

export function emptyWeek(weekStart: ISODate): WeekPlan {
  return { weekStart, entries: {}, notes: {}, areas: {}, updatedAt: new Date().toISOString() };
}

function touch(week: WeekPlan, patch: Partial<WeekPlan>): WeekPlan {
  return { ...week, ...patch, updatedAt: new Date().toISOString() };
}

export function getCell(week: WeekPlan | undefined, employeeId: string, day: DayIndex): Cell | undefined {
  return week?.entries[employeeId]?.[day];
}

export function setCell(week: WeekPlan, employeeId: string, day: DayIndex, cell: Cell): WeekPlan {
  return setCells(week, [{ employeeId, day, cell }]);
}

export function setCells(week: WeekPlan, changes: { employeeId: string; day: DayIndex; cell: Cell }[]): WeekPlan {
  const entries: WeekEntries = { ...week.entries };
  for (const { employeeId, day, cell } of changes) {
    const row = { ...entries[employeeId] };
    if (cell.length === 0) delete row[day];
    else row[day] = cell;
    if (Object.keys(row).length === 0) delete entries[employeeId];
    else entries[employeeId] = row;
  }
  return touch(week, { entries });
}

/** Kopiert den Eintrag eines Tages auf andere Tage desselben Mitarbeiters. */
export function copyCellToDays(week: WeekPlan, employeeId: string, from: DayIndex, to: readonly DayIndex[]): WeekPlan {
  const cell = getCell(week, employeeId, from) ?? [];
  return setCells(
    week,
    to.filter((d) => d !== from).map((day) => ({ employeeId, day, cell })),
  );
}

export function clearEmployeeWeek(week: WeekPlan, employeeId: string): WeekPlan {
  const entries = { ...week.entries };
  delete entries[employeeId];
  return touch(week, { entries });
}

export function setNote(week: WeekPlan, day: DayIndex, text: string): WeekPlan {
  const notes = { ...week.notes };
  const trimmed = text.trim();
  if (trimmed) notes[day] = trimmed;
  else delete notes[day];
  return touch(week, { notes });
}

/** Übernimmt Einträge (aus Vorwoche oder Vorlage) für die angegebenen Mitarbeiter. Notizen bleiben leer. */
export function weekFromEntries(weekStart: ISODate, source: WeekEntries, employeeIds: readonly string[]): WeekPlan {
  const allowed = new Set(employeeIds);
  const entries: WeekEntries = {};
  for (const [id, row] of Object.entries(source)) {
    if (allowed.has(id) && row && Object.keys(row).length > 0) entries[id] = structuredClone(row);
  }
  return { ...emptyWeek(weekStart), entries };
}

export function countEntries(entries: WeekEntries | undefined): number {
  if (!entries) return 0;
  return Object.values(entries).reduce((sum, row) => sum + Object.values(row ?? {}).filter((c) => !isEmptyCell(c)).length, 0);
}

export function hasContent(week: WeekPlan | undefined): boolean {
  return Boolean(week && (countEntries(week.entries) > 0 || Object.keys(week.notes).length > 0));
}

export function hasEntriesFor(week: WeekPlan | undefined, employeeId: string): boolean {
  const row = week?.entries[employeeId];
  return Boolean(row && Object.values(row).some((c) => !isEmptyCell(c)));
}

/** Mitarbeiter, die in neuen Wochen erscheinen. */
export function plannableEmployees(employees: readonly Employee[]): Employee[] {
  return employees.filter((e) => e.active && !e.deleted);
}

export interface AreaRows extends Area {
  employees: Employee[];
}

/**
 * Zeilen eines Wochenplans, gruppiert nach Bereich.
 * Aktive Mitarbeiter erscheinen immer; inaktive oder gelöschte nur, wenn sie in dieser Woche Einträge haben –
 * so bleiben alte Pläne vollständig.
 */
export function rowsForWeek(employees: readonly Employee[], week: WeekPlan | undefined): AreaRows[] {
  const visible = employees.filter((e) => (e.active && !e.deleted) || hasEntriesFor(week, e.id));
  return AREAS.map((area) => ({
    ...area,
    employees: visible
      .filter((e) => (week?.areas[e.id] ?? e.area) === area.id)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "de")),
  }));
}

/**
 * Wechselt ein Mitarbeiter den Bereich, wird in allen vergangenen Wochen mit seinen Einträgen
 * der alte Bereich festgehalten.
 */
export function freezeAreaInPastWeeks(
  weeks: Record<ISODate, WeekPlan>,
  employee: Employee,
  currentWeekStart: ISODate,
): Record<ISODate, WeekPlan> {
  let changed = false;
  const next = { ...weeks };
  for (const [key, week] of Object.entries(weeks)) {
    if (key >= currentWeekStart || week.areas[employee.id] || !hasEntriesFor(week, employee.id)) continue;
    next[key] = { ...week, areas: { ...week.areas, [employee.id]: employee.area } };
    changed = true;
  }
  return changed ? next : weeks;
}

/** Die jüngste Woche vor `weekStart`, die bereits Einträge hat (meist die Vorwoche). */
export function previousFilledWeek(weeks: Record<ISODate, WeekPlan>, weekStart: ISODate): WeekPlan | undefined {
  return Object.values(weeks)
    .filter((w) => w.weekStart < weekStart && countEntries(w.entries) > 0)
    .sort((a, b) => b.weekStart.localeCompare(a.weekStart))[0];
}

// ---------------------------------------------------------------------------
// Schnellbuttons: häufigste Zeiten
// ---------------------------------------------------------------------------

export const DEFAULT_QUICK_TIMES = ["11:30h", "12:30h", "16h", "18h"];

interface Suggestion {
  label: string;
  cell: Cell;
}

/**
 * Häufigste Zeiten aus allen Wochen und Vorlagen, chronologisch sortiert.
 * „Frei“ und „Bis Ende“ werden separat als feste Buttons angezeigt.
 */
export function frequentCells(
  weeks: readonly WeekPlan[],
  templates: readonly Template[],
  options: { limit?: number; employeeId?: string } = {},
): Suggestion[] {
  const { limit = 8, employeeId } = options;
  const counts = new Map<string, { cell: Cell; count: number }>();
  const add = (cell: Cell | undefined, weight: number) => {
    if (!cell || !isWorking(cell) || cell.length !== 1) return;
    const label = formatCell(cell);
    if (label === "Bis Ende") return;
    const current = counts.get(label);
    counts.set(label, { cell, count: (current?.count ?? 0) + weight });
  };
  const sources = [...weeks.map((w) => w.entries), ...templates.map((t) => t.entries)];
  for (const entries of sources) {
    for (const [id, row] of Object.entries(entries)) {
      if (employeeId && id !== employeeId) continue;
      for (const cell of Object.values(row ?? {})) add(cell, 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, limit)
    .map(([label, { cell }]) => ({ label, cell }));
}

export function sortSuggestions<T extends { cell: Cell }>(list: T[]): T[] {
  return [...list].sort((a, b) => sortKey(a.cell) - sortKey(b.cell));
}

// ---------------------------------------------------------------------------
// Hinweise
// ---------------------------------------------------------------------------

export interface Warning {
  id: string;
  message: string;
  /** Zelle, auf die sich der Hinweis bezieht (zum Markieren in der Tabelle). */
  employeeId?: string;
  day?: DayIndex;
  level: "warning" | "info";
}

export function computeWarnings(employees: readonly Employee[], week: WeekPlan | undefined): Warning[] {
  if (!week) return [];
  const warnings: Warning[] = [];
  const groups = rowsForWeek(employees, week);

  for (const group of groups) {
    for (const employee of group.employees) {
      for (const day of DAY_INDICES) {
        for (const problem of cellProblems(getCell(week, employee.id, day))) {
          warnings.push({
            id: `${employee.id}-${day}-${problem}`,
            message: `${employee.name}, ${DAY_NAMES[day]}: ${problem}`,
            employeeId: employee.id,
            day,
            level: "warning",
          });
        }
      }
    }
  }

  if (countEntries(week.entries) === 0) return warnings;

  // Ein Bereich ist an einem Tag leer, obwohl der andere besetzt ist (sonst: Ruhetag)
  for (const day of DAY_INDICES) {
    const staffed = groups.map((g) => g.employees.some((e) => isWorking(getCell(week, e.id, day))));
    if (!staffed.some(Boolean)) continue;
    groups.forEach((group, i) => {
      if (!staffed[i] && group.employees.length > 0) {
        warnings.push({
          id: `empty-${group.id}-${day}`,
          message: `${DAY_NAMES[day]}: ${group.nobody}`,
          day,
          level: "info",
        });
      }
    });
  }

  const withoutEntries = groups
    .flatMap((g) => g.employees)
    .filter((e) => e.active && !e.deleted && !hasEntriesFor(week, e.id))
    .map((e) => e.name);
  if (withoutEntries.length > 0) {
    warnings.push({
      id: "no-entries",
      message: `Keine Arbeitszeit eingetragen: ${withoutEntries.join(", ")}`,
      level: "info",
    });
  }

  return warnings;
}
