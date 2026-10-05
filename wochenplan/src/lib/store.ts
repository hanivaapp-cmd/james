"use client";

import { create } from "zustand";
import { demoData } from "./demo-data";
import {
  clearEmployeeWeek,
  copyCellToDays,
  emptyWeek,
  freezeAreaInPastWeeks,
  hasEntriesFor,
  plannableEmployees,
  previousFilledWeek,
  setCells,
  setNote,
  weekFromEntries,
} from "./plan";
import { LocalStorageRepository } from "./storage/local-storage";
import type { PlanRepository } from "./storage/repository";
import {
  DEFAULT_SETTINGS,
  type AppData,
  type AreaId,
  type Cell,
  type DayIndex,
  type Employee,
  type ISODate,
  type Settings,
  type Template,
  type WeekPlan,
} from "./types";
import { weekStartOf } from "./week";

export type SaveState = "idle" | "saving" | "saved" | "error";

interface State extends AppData {
  status: "loading" | "ready";
  /** Montag der aktuellen Kalenderwoche */
  currentWeek: ISODate;
  /** Woche, die gerade angezeigt/bearbeitet wird */
  selectedWeek: ISODate;
  saveState: SaveState;
}

export interface CellChange {
  employeeId: string;
  day: DayIndex;
  cell: Cell;
}

interface Actions {
  init(repository?: PlanRepository): Promise<void>;
  selectWeek(weekStart: ISODate): void;

  addEmployee(input: { name: string; area: AreaId; color: string | null }): Employee;
  updateEmployee(id: string, patch: Partial<Pick<Employee, "name" | "area" | "color" | "active">>): void;
  moveEmployee(id: string, direction: -1 | 1): void;
  /** Löscht einen Mitarbeiter. Gibt eine Funktion zum Rückgängigmachen zurück. */
  removeEmployee(id: string): () => void;

  setCells(weekStart: ISODate, changes: CellChange[]): void;
  copyCellToDays(weekStart: ISODate, employeeId: string, from: DayIndex, to: DayIndex[]): void;
  clearEmployeeWeek(weekStart: ISODate, employeeId: string): WeekPlan | undefined;
  setNote(weekStart: ISODate, day: DayIndex, text: string): void;

  /** Setzt eine Woche auf einen früheren Stand zurück (Rückgängig). */
  restoreWeek(weekStart: ISODate, week: WeekPlan | undefined): void;
  /** Übernimmt die letzte Woche mit Einträgen. Gibt den bisherigen Stand (für Rückgängig) und die Quelle zurück. */
  copyFromPreviousWeek(weekStart: ISODate): { previous: WeekPlan | undefined; source: WeekPlan } | null;
  applyTemplate(templateId: string, weekStart: ISODate): WeekPlan | undefined;
  clearWeek(weekStart: ISODate): WeekPlan | undefined;

  saveTemplate(name: string, weekStart: ISODate): Template;
  renameTemplate(id: string, name: string): void;
  deleteTemplate(id: string): () => void;

  updateSettings(patch: Partial<Settings>): void;

  exportData(): AppData;
  importData(data: AppData): Promise<void>;
  resetToDemo(): Promise<void>;
  clearAll(): Promise<void>;
}

const SELECTED_WEEK_KEY = "wochenplan:selectedWeek";

let repository: PlanRepository | null = null;
let applyingExternal = false;
let unsubscribeExternal: (() => void) | null = null;

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function rememberSelectedWeek(weekStart: ISODate) {
  try {
    sessionStorage.setItem(SELECTED_WEEK_KEY, weekStart);
  } catch {
    // Privater Modus o. Ä. – dann startet die App eben in der aktuellen Woche.
  }
}

function initialSelectedWeek(currentWeek: ISODate): ISODate {
  try {
    const stored = sessionStorage.getItem(SELECTED_WEEK_KEY);
    if (stored && /^\d{4}-\d{2}-\d{2}$/.test(stored)) return stored;
  } catch {
    // ignorieren
  }
  return currentWeek;
}

const today = weekStartOf(new Date());

export const usePlanStore = create<State & Actions>()((set, get) => {
  /** Ändert eine Woche (legt sie bei Bedarf an) und gibt den vorherigen Stand zurück. */
  const updateWeek = (weekStart: ISODate, fn: (week: WeekPlan) => WeekPlan | undefined): WeekPlan | undefined => {
    const previous = get().weeks[weekStart];
    const next = fn(previous ?? emptyWeek(weekStart));
    const weeks = { ...get().weeks };
    if (next) weeks[weekStart] = next;
    else delete weeks[weekStart];
    set({ weeks });
    return previous;
  };

  const plannableIds = () => plannableEmployees(get().employees).map((e) => e.id);

  const applyData = (data: AppData) => {
    set({
      employees: data.employees,
      weeks: data.weeks,
      templates: data.templates,
      settings: data.settings,
    });
  };

  return {
    status: "loading",
    employees: [],
    weeks: {},
    templates: [],
    settings: DEFAULT_SETTINGS,
    currentWeek: today,
    selectedWeek: today,
    saveState: "idle",

    async init(repo) {
      if (repository && !repo) return;
      repository = repo ?? new LocalStorageRepository();
      const currentWeek = weekStartOf(new Date());
      let data: AppData | null;
      try {
        data = await repository.load();
        if (!data) {
          data = demoData(currentWeek);
          await repository.replaceAll(data);
        }
      } catch {
        // Speicher nicht verfügbar (z. B. gesperrt): App trotzdem nutzbar machen, aber deutlich warnen.
        data = demoData(currentWeek);
        set({ saveState: "error" });
      }
      applyingExternal = true;
      applyData(data);
      set({ status: "ready", currentWeek, selectedWeek: initialSelectedWeek(currentWeek) });
      applyingExternal = false;

      unsubscribeExternal?.();
      unsubscribeExternal = repository.subscribe(async () => {
        const fresh = await repository?.load();
        if (!fresh) return;
        applyingExternal = true;
        applyData(fresh);
        applyingExternal = false;
      });
    },

    selectWeek(weekStart) {
      rememberSelectedWeek(weekStart);
      set({ selectedWeek: weekStart });
    },

    addEmployee({ name, area, color }) {
      const employees = get().employees;
      const employee: Employee = {
        id: newId(),
        name: name.trim(),
        area,
        color,
        active: true,
        deleted: false,
        sortOrder: Math.max(-1, ...employees.map((e) => e.sortOrder)) + 1,
      };
      set({ employees: [...employees, employee] });
      return employee;
    },

    updateEmployee(id, patch) {
      const { employees, weeks, currentWeek } = get();
      const before = employees.find((e) => e.id === id);
      if (!before) return;
      const after: Employee = { ...before, ...patch, name: (patch.name ?? before.name).trim() || before.name };
      if (patch.area && patch.area !== before.area) {
        // Neuer Bereich: ans Ende der Liste; alte Wochen behalten den bisherigen Bereich.
        after.sortOrder = Math.max(-1, ...employees.map((e) => e.sortOrder)) + 1;
        set({ weeks: freezeAreaInPastWeeks(weeks, before, currentWeek) });
      }
      set({ employees: employees.map((e) => (e.id === id ? after : e)) });
    },

    moveEmployee(id, direction) {
      const employees = get().employees;
      const employee = employees.find((e) => e.id === id);
      if (!employee) return;
      // Verschoben wird zwischen sichtbaren (aktiven) Nachbarn; Inaktive behalten ihren Platz.
      const area = employees.filter((e) => e.area === employee.area).sort((a, b) => a.sortOrder - b.sortOrder);
      const visible = area.filter((e) => e.active && !e.deleted);
      const neighbor = visible[visible.findIndex((e) => e.id === id) + direction];
      if (!neighbor) return;
      const a = area.indexOf(employee);
      const b = area.indexOf(neighbor);
      [area[a], area[b]] = [area[b], area[a]];
      const base = Math.min(...area.map((e) => e.sortOrder));
      const order = new Map(area.map((e, i) => [e.id, base + i]));
      set({ employees: employees.map((e) => (order.has(e.id) ? { ...e, sortOrder: order.get(e.id)! } : e)) });
    },

    removeEmployee(id) {
      const { employees, weeks, templates, currentWeek } = get();
      const employee = employees.find((e) => e.id === id);
      if (!employee) return () => {};
      const usedInPast = Object.values(weeks).some((w) => w.weekStart <= currentWeek && hasEntriesFor(w, id));
      const usedInTemplates = templates.some((t) => t.entries[id]);

      // Aus zukünftigen Wochen entfernen – vergangene Pläne bleiben unverändert.
      const nextWeeks = { ...weeks };
      for (const [key, week] of Object.entries(weeks)) {
        if (key > currentWeek && week.entries[id]) nextWeeks[key] = clearEmployeeWeek(week, id);
      }

      const nextEmployees =
        usedInPast || usedInTemplates
          ? employees.map((e) => (e.id === id ? { ...e, deleted: true, active: false } : e))
          : employees.filter((e) => e.id !== id);
      set({ employees: nextEmployees, weeks: nextWeeks });

      return () => {
        const current = get();
        set({
          employees: current.employees.some((e) => e.id === id)
            ? current.employees.map((e) => (e.id === id ? employee : e))
            : [...current.employees, employee],
          weeks: { ...current.weeks, ...Object.fromEntries(Object.entries(weeks).filter(([k]) => nextWeeks[k] !== weeks[k])) },
        });
      };
    },

    setCells(weekStart, changes) {
      updateWeek(weekStart, (week) => setCells(week, changes));
    },

    copyCellToDays(weekStart, employeeId, from, to) {
      updateWeek(weekStart, (week) => copyCellToDays(week, employeeId, from, to));
    },

    clearEmployeeWeek(weekStart, employeeId) {
      return updateWeek(weekStart, (week) => clearEmployeeWeek(week, employeeId));
    },

    setNote(weekStart, day, text) {
      updateWeek(weekStart, (week) => setNote(week, day, text));
    },

    restoreWeek(weekStart, week) {
      updateWeek(weekStart, () => week);
    },

    copyFromPreviousWeek(weekStart) {
      const source = previousFilledWeek(get().weeks, weekStart);
      if (!source) return null;
      const previous = updateWeek(weekStart, (existing) => ({
        ...weekFromEntries(weekStart, source.entries, plannableIds()),
        notes: existing.notes,
      }));
      return { previous, source };
    },

    applyTemplate(templateId, weekStart) {
      const template = get().templates.find((t) => t.id === templateId);
      if (!template) return get().weeks[weekStart];
      return updateWeek(weekStart, (existing) => ({
        ...weekFromEntries(weekStart, template.entries, plannableIds()),
        notes: existing.notes,
      }));
    },

    clearWeek(weekStart) {
      return updateWeek(weekStart, () => undefined);
    },

    saveTemplate(name, weekStart) {
      const week = get().weeks[weekStart];
      const template: Template = {
        id: newId(),
        name: name.trim() || "Vorlage",
        entries: structuredClone(week?.entries ?? {}),
        createdAt: new Date().toISOString(),
      };
      set({ templates: [...get().templates, template] });
      return template;
    },

    renameTemplate(id, name) {
      const trimmed = name.trim();
      if (!trimmed) return;
      set({ templates: get().templates.map((t) => (t.id === id ? { ...t, name: trimmed } : t)) });
    },

    deleteTemplate(id) {
      const before = get().templates;
      set({ templates: before.filter((t) => t.id !== id) });
      return () => set({ templates: before });
    },

    updateSettings(patch) {
      set({ settings: { ...get().settings, ...patch } });
    },

    exportData() {
      const { employees, weeks, templates, settings } = get();
      return { employees, weeks, templates, settings };
    },

    async importData(data) {
      applyingExternal = true;
      applyData(data);
      applyingExternal = false;
      await persistAll(data);
    },

    async resetToDemo() {
      await get().importData(demoData(get().currentWeek));
    },

    async clearAll() {
      await get().importData({ employees: [], weeks: {}, templates: [], settings: { ...DEFAULT_SETTINGS } });
    },
  };
});

async function persistAll(data: AppData) {
  if (!repository) return;
  usePlanStore.setState({ saveState: "saving" });
  try {
    await repository.replaceAll(data);
    usePlanStore.setState({ saveState: "saved" });
  } catch {
    usePlanStore.setState({ saveState: "error" });
  }
}

// ---------------------------------------------------------------------------
// Automatisches Speichern: jede Änderung wird sofort an das Repository übergeben.
// ---------------------------------------------------------------------------
usePlanStore.subscribe((state, prev) => {
  if (!repository || applyingExternal || state.status !== "ready" || prev.status !== "ready") return;
  const repo = repository;
  const tasks: Promise<void>[] = [];
  if (state.employees !== prev.employees) tasks.push(repo.saveEmployees(state.employees));
  if (state.templates !== prev.templates) tasks.push(repo.saveTemplates(state.templates));
  if (state.settings !== prev.settings) tasks.push(repo.saveSettings(state.settings));
  if (state.weeks !== prev.weeks) {
    for (const [key, week] of Object.entries(state.weeks)) {
      if (prev.weeks[key] !== week) tasks.push(repo.saveWeek(week));
    }
    for (const key of Object.keys(prev.weeks)) {
      if (!(key in state.weeks)) tasks.push(repo.deleteWeek(key));
    }
  }
  if (tasks.length === 0) return;
  usePlanStore.setState({ saveState: "saving" });
  Promise.all(tasks)
    .then(() => usePlanStore.setState({ saveState: "saved" }))
    .catch(() => usePlanStore.setState({ saveState: "error" }));
});
