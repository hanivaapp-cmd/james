"use client";

import { toast } from "sonner";
import { create } from "zustand";
import { getRepository, type ChangeEvent } from "@/lib/data";
import { addDaysISO, eachDate, weekStart, type DateRange } from "@/lib/schedule/dates";
import type {
  Absence,
  AppNotification,
  Employee,
  NewAbsence,
  NewEmployee,
  NewShift,
  NewShiftType,
  Session,
  Shift,
  ShiftType,
} from "@/lib/types";
import { errorMessage, uid } from "@/lib/utils";
import { announceNotification } from "@/lib/notify";

type Table<T> = Record<string, T>;

export interface AppState {
  status: "idle" | "loading" | "ready" | "signed-out" | "error";
  error: string | null;
  session: Session | null;
  employees: Table<Employee>;
  shiftTypes: Table<ShiftType>;
  shifts: Table<Shift>;
  absences: Table<Absence>;
  notifications: AppNotification[];
  /** Bereits geladene Wochen (Montag als Schlüssel) */
  loadedWeeks: Record<string, true>;
  sync: { pending: number; error: string | null; savedAt: number | null };
}

const initialState: AppState = {
  status: "idle",
  error: null,
  session: null,
  employees: {},
  shiftTypes: {},
  shifts: {},
  absences: {},
  notifications: [],
  loadedWeeks: {},
  sync: { pending: 0, error: null, savedAt: null },
};

export const useAppStore = create<AppState>()(() => initialState);

const set = useAppStore.setState;
const get = useAppStore.getState;
const repo = () => getRepository();

const byId = <T extends { id: string }>(rows: T[]): Table<T> => Object.fromEntries(rows.map((r) => [r.id, r]));
const without = <T>(table: Table<T>, ids: string[]): Table<T> => {
  const next = { ...table };
  for (const id of ids) delete next[id];
  return next;
};

// ---------------------------------------------------------------------------
// Speichern mit optimistischem Update
// ---------------------------------------------------------------------------

/** IDs mit laufenden Schreibvorgängen – Echtzeit-Events dafür werden ignoriert. */
const locks = new Map<string, number>();
const lock = (ids: string[], delta: 1 | -1) => {
  for (const id of ids) {
    const next = (locks.get(id) ?? 0) + delta;
    if (next <= 0) locks.delete(id);
    else locks.set(id, next);
  }
};

async function mutate<T>(options: {
  ids: string[];
  apply?: () => void;
  rollback?: () => void;
  run: () => Promise<T>;
  done?: (result: T) => void;
  errorTitle: string;
}): Promise<T | undefined> {
  const { ids, apply, rollback, run, done, errorTitle } = options;
  lock(ids, 1);
  set((s) => ({ sync: { ...s.sync, pending: s.sync.pending + 1 } }));
  apply?.();
  try {
    const result = await run();
    done?.(result);
    set((s) => ({ sync: { pending: s.sync.pending - 1, error: null, savedAt: Date.now() } }));
    return result;
  } catch (error) {
    rollback?.();
    const message = errorMessage(error);
    set((s) => ({ sync: { pending: s.sync.pending - 1, error: message, savedAt: s.sync.savedAt } }));
    toast.error(errorTitle, { description: message });
    return undefined;
  } finally {
    lock(ids, -1);
  }
}

// ---------------------------------------------------------------------------
// Laden & Echtzeit
// ---------------------------------------------------------------------------

let unsubscribe: (() => void) | null = null;
const inflightWeeks = new Set<string>();

function applyChange(event: ChangeEvent) {
  if (event.type === "delete") {
    if (locks.has(event.id)) return;
    switch (event.table) {
      case "shifts":
        return set((s) => ({ shifts: without(s.shifts, [event.id]) }));
      case "employees":
        return set((s) => ({ employees: without(s.employees, [event.id]) }));
      case "absences":
        return set((s) => ({ absences: without(s.absences, [event.id]) }));
      case "shift_types":
        return set((s) => ({ shiftTypes: without(s.shiftTypes, [event.id]) }));
      case "notifications":
        return set((s) => ({ notifications: s.notifications.filter((n) => n.id !== event.id) }));
    }
  }
  if (locks.has(event.row.id)) return;
  switch (event.table) {
    case "shifts": {
      const row = event.row;
      // Nur Wochen, die geladen sind, im Speicher halten.
      if (!get().loadedWeeks[weekStart(row.date)] && !get().shifts[row.id]) return;
      return set((s) => ({ shifts: { ...s.shifts, [row.id]: row } }));
    }
    case "employees":
      return set((s) => ({ employees: { ...s.employees, [event.row.id]: event.row } }));
    case "absences":
      return set((s) => ({ absences: { ...s.absences, [event.row.id]: event.row } }));
    case "shift_types":
      return set((s) => ({ shiftTypes: { ...s.shiftTypes, [event.row.id]: event.row } }));
    case "notifications": {
      const row = event.row;
      const exists = get().notifications.some((n) => n.id === row.id);
      set((s) => ({
        notifications: exists
          ? s.notifications.map((n) => (n.id === row.id ? row : n))
          : [row, ...s.notifications].slice(0, 50),
      }));
      if (!exists && !row.read_at) announceNotification(row);
      return;
    }
  }
}

export const actions = {
  async bootstrap() {
    if (get().status === "loading" || get().status === "ready") return;
    set({ status: "loading", error: null });
    try {
      const session = await repo().getSession();
      if (!session) {
        set({ ...initialState, status: "signed-out" });
        return;
      }
      const [employees, shiftTypes, absences, notifications] = await Promise.all([
        repo().listEmployees(),
        repo().listShiftTypes(),
        repo().listAbsences(),
        repo().listNotifications(),
      ]);
      set({
        session,
        employees: byId(employees),
        shiftTypes: byId(shiftTypes),
        absences: byId(absences),
        notifications,
        shifts: {},
        loadedWeeks: {},
        status: "ready",
      });
      unsubscribe?.();
      unsubscribe = repo().subscribe(session.profile.id, applyChange);
    } catch (error) {
      set({ status: "error", error: errorMessage(error) });
    }
  },

  /** Lädt Schichten für alle Wochen des Bereichs nach, die noch fehlen. */
  async ensureRange(range: DateRange) {
    const weeks = new Set<string>();
    for (const date of eachDate(weekStart(range.from), range.to)) weeks.add(weekStart(date));
    const missing = [...weeks].filter((w) => !get().loadedWeeks[w] && !inflightWeeks.has(w)).sort();
    if (missing.length === 0) return;
    missing.forEach((w) => inflightWeeks.add(w));
    try {
      const from = missing[0];
      const to = addDaysISO(missing[missing.length - 1], 6);
      const rows = await repo().listShifts({ from, to });
      set((s) => {
        const shifts = { ...s.shifts };
        // Bereits lokal geänderte Schichten nicht überschreiben.
        for (const row of rows) if (!locks.has(row.id)) shifts[row.id] = row;
        const loadedWeeks = { ...s.loadedWeeks };
        missing.forEach((w) => (loadedWeeks[w] = true));
        return { shifts, loadedWeeks };
      });
    } catch (error) {
      toast.error("Schichten konnten nicht geladen werden", { description: errorMessage(error) });
    } finally {
      missing.forEach((w) => inflightWeeks.delete(w));
    }
  },

  /** Alles neu laden (z. B. nach Verbindungsabbruch). */
  async refresh() {
    const weeks = Object.keys(get().loadedWeeks).sort();
    set({ status: "idle" });
    await actions.bootstrap();
    if (weeks.length) await actions.ensureRange({ from: weeks[0], to: addDaysISO(weeks[weeks.length - 1], 6) });
  },

  async signOut() {
    unsubscribe?.();
    unsubscribe = null;
    await repo().signOut();
    set({ ...initialState, status: "signed-out" });
  },

  // ----------------------------------------------------------------- Schichten
  async createShifts(inputs: NewShift[], options: { undo?: boolean } = {}) {
    const rows: Shift[] = inputs.map((input) => ({ ...input, id: input.id ?? uid() }));
    const ids = rows.map((r) => r.id);
    const result = await mutate({
      ids,
      apply: () => set((s) => ({ shifts: { ...s.shifts, ...byId(rows) } })),
      rollback: () => set((s) => ({ shifts: without(s.shifts, ids) })),
      run: () => repo().createShifts(rows),
      done: (created) => set((s) => ({ shifts: { ...s.shifts, ...byId(created) } })),
      errorTitle: "Schicht konnte nicht gespeichert werden",
    });
    if (result && options.undo) {
      toast.success(rows.length === 1 ? "Schicht erstellt" : `${rows.length} Schichten erstellt`, {
        action: { label: "Rückgängig", onClick: () => void actions.deleteShifts(ids, { undo: false }) },
      });
    }
    return result;
  },

  async updateShift(id: string, patch: Partial<Shift>, options: { undoLabel?: string } = {}) {
    const before = get().shifts[id];
    if (!before) return;
    const result = await mutate({
      ids: [id],
      apply: () => set((s) => ({ shifts: { ...s.shifts, [id]: { ...before, ...patch, id } } })),
      rollback: () => set((s) => ({ shifts: { ...s.shifts, [id]: before } })),
      run: () => repo().updateShift(id, patch),
      done: (row) => set((s) => ({ shifts: { ...s.shifts, [id]: row } })),
      errorTitle: "Änderung konnte nicht gespeichert werden",
    });
    if (result && options.undoLabel) {
      const revert: Partial<Shift> = {};
      for (const key of Object.keys(patch) as (keyof Shift)[]) {
        (revert as Record<string, unknown>)[key] = before[key];
      }
      toast.success(options.undoLabel, {
        action: { label: "Rückgängig", onClick: () => void actions.updateShift(id, revert) },
      });
    }
    return result;
  },

  async deleteShifts(ids: string[], options: { undo?: boolean } = { undo: true }) {
    const removed = ids.map((id) => get().shifts[id]).filter(Boolean);
    if (removed.length === 0) return;
    const result = await mutate({
      ids,
      apply: () => set((s) => ({ shifts: without(s.shifts, ids) })),
      rollback: () => set((s) => ({ shifts: { ...s.shifts, ...byId(removed) } })),
      run: async () => {
        await repo().deleteShifts(ids);
        return true;
      },
      errorTitle: "Schicht konnte nicht gelöscht werden",
    });
    if (result && options.undo) {
      toast(removed.length === 1 ? "Schicht gelöscht" : `${removed.length} Schichten gelöscht`, {
        action: { label: "Rückgängig", onClick: () => void actions.createShifts(removed) },
      });
    }
  },

  /** Kopiert alle Schichten einer Woche in eine andere (ohne Doppelungen). */
  async copyWeek(sourceWeek: string, targetWeek: string, employeeIds?: Set<string>) {
    await actions.ensureRange({ from: sourceWeek, to: addDaysISO(targetWeek, 6) });
    const { shifts } = get();
    const sourceEnd = addDaysISO(sourceWeek, 6);
    const offset = Math.round(
      (new Date(`${targetWeek}T12:00:00`).getTime() - new Date(`${sourceWeek}T12:00:00`).getTime()) / 86_400_000,
    );
    const existing = new Set(
      Object.values(shifts).map((s) => `${s.employee_id}|${s.date}|${s.start_time}|${s.end_time}`),
    );
    const copies: NewShift[] = Object.values(shifts)
      .filter((s) => s.date >= sourceWeek && s.date <= sourceEnd && (!employeeIds || employeeIds.has(s.employee_id)))
      .map(({ id: _id, ...rest }) => {
        void _id;
        return { ...rest, date: addDaysISO(rest.date, offset) };
      })
      .filter((s) => !existing.has(`${s.employee_id}|${s.date}|${s.start_time}|${s.end_time}`));
    if (copies.length === 0) {
      toast.info("Nichts zu kopieren", { description: "Die Vorwoche enthält keine neuen Schichten." });
      return;
    }
    await actions.createShifts(copies, { undo: true });
  },

  // --------------------------------------------------------------- Mitarbeiter
  async createEmployee(input: NewEmployee) {
    const row: Employee = { ...input, id: input.id ?? uid(), user_id: null };
    return mutate({
      ids: [row.id],
      apply: () => set((s) => ({ employees: { ...s.employees, [row.id]: row } })),
      rollback: () => set((s) => ({ employees: without(s.employees, [row.id]) })),
      run: () => repo().createEmployee(row),
      done: (created) => set((s) => ({ employees: { ...s.employees, [created.id]: created } })),
      errorTitle: "Mitarbeiter konnte nicht angelegt werden",
    });
  },

  async updateEmployee(id: string, patch: Partial<Employee>) {
    const before = get().employees[id];
    if (!before) return;
    return mutate({
      ids: [id],
      apply: () => set((s) => ({ employees: { ...s.employees, [id]: { ...before, ...patch } } })),
      rollback: () => set((s) => ({ employees: { ...s.employees, [id]: before } })),
      run: () => repo().updateEmployee(id, patch),
      done: (row) => set((s) => ({ employees: { ...s.employees, [id]: row } })),
      errorTitle: "Änderung konnte nicht gespeichert werden",
    });
  },

  async deleteEmployee(id: string) {
    const before = get().employees[id];
    const shifts = Object.values(get().shifts).filter((s) => s.employee_id === id);
    const absences = Object.values(get().absences).filter((a) => a.employee_id === id);
    const ok = await mutate({
      ids: [id, ...shifts.map((s) => s.id)],
      apply: () =>
        set((s) => ({
          employees: without(s.employees, [id]),
          shifts: without(s.shifts, shifts.map((x) => x.id)),
          absences: without(s.absences, absences.map((x) => x.id)),
        })),
      rollback: () =>
        set((s) => ({
          employees: { ...s.employees, [id]: before },
          shifts: { ...s.shifts, ...byId(shifts) },
          absences: { ...s.absences, ...byId(absences) },
        })),
      run: async () => {
        await repo().deleteEmployee(id);
        return true;
      },
      errorTitle: "Mitarbeiter konnte nicht gelöscht werden",
    });
    if (ok) toast.success(`${before?.name ?? "Mitarbeiter"} gelöscht`);
    return ok;
  },

  // -------------------------------------------------------------- Schichtarten
  async createShiftType(input: NewShiftType) {
    const row: ShiftType = { ...input, id: input.id ?? uid() };
    return mutate({
      ids: [row.id],
      apply: () => set((s) => ({ shiftTypes: { ...s.shiftTypes, [row.id]: row } })),
      rollback: () => set((s) => ({ shiftTypes: without(s.shiftTypes, [row.id]) })),
      run: () => repo().createShiftType(row),
      done: (created) => set((s) => ({ shiftTypes: { ...s.shiftTypes, [created.id]: created } })),
      errorTitle: "Schichtart konnte nicht angelegt werden",
    });
  },

  async updateShiftType(id: string, patch: Partial<ShiftType>) {
    const before = get().shiftTypes[id];
    if (!before) return;
    return mutate({
      ids: [id],
      apply: () => set((s) => ({ shiftTypes: { ...s.shiftTypes, [id]: { ...before, ...patch } } })),
      rollback: () => set((s) => ({ shiftTypes: { ...s.shiftTypes, [id]: before } })),
      run: () => repo().updateShiftType(id, patch),
      done: (row) => set((s) => ({ shiftTypes: { ...s.shiftTypes, [id]: row } })),
      errorTitle: "Schichtart konnte nicht gespeichert werden",
    });
  },

  async deleteShiftType(id: string) {
    const before = get().shiftTypes[id];
    const affected = Object.values(get().shifts).filter((s) => s.shift_type_id === id);
    return mutate({
      ids: [id],
      apply: () =>
        set((s) => ({
          shiftTypes: without(s.shiftTypes, [id]),
          shifts: { ...s.shifts, ...byId(affected.map((x) => ({ ...x, shift_type_id: null }))) },
        })),
      rollback: () =>
        set((s) => ({ shiftTypes: { ...s.shiftTypes, [id]: before }, shifts: { ...s.shifts, ...byId(affected) } })),
      run: async () => {
        await repo().deleteShiftType(id);
        return true;
      },
      errorTitle: "Schichtart konnte nicht gelöscht werden",
    });
  },

  // ------------------------------------------------------------ Abwesenheiten
  async createAbsence(input: NewAbsence) {
    const session = get().session;
    const staff = session?.profile.role !== "employee";
    const row: Absence = {
      ...input,
      id: input.id ?? uid(),
      status: staff ? (input.status ?? "approved") : "pending",
    };
    return mutate({
      ids: [row.id],
      apply: () => set((s) => ({ absences: { ...s.absences, [row.id]: row } })),
      rollback: () => set((s) => ({ absences: without(s.absences, [row.id]) })),
      run: () => repo().createAbsence(row),
      done: (created) => set((s) => ({ absences: { ...s.absences, [created.id]: created } })),
      errorTitle: "Abwesenheit konnte nicht gespeichert werden",
    });
  },

  async updateAbsence(id: string, patch: Partial<Absence>) {
    const before = get().absences[id];
    if (!before) return;
    return mutate({
      ids: [id],
      apply: () => set((s) => ({ absences: { ...s.absences, [id]: { ...before, ...patch } } })),
      rollback: () => set((s) => ({ absences: { ...s.absences, [id]: before } })),
      run: () => repo().updateAbsence(id, patch),
      done: (row) => set((s) => ({ absences: { ...s.absences, [id]: row } })),
      errorTitle: "Abwesenheit konnte nicht gespeichert werden",
    });
  },

  async deleteAbsence(id: string) {
    const before = get().absences[id];
    return mutate({
      ids: [id],
      apply: () => set((s) => ({ absences: without(s.absences, [id]) })),
      rollback: () => set((s) => ({ absences: { ...s.absences, [id]: before } })),
      run: async () => {
        await repo().deleteAbsence(id);
        return true;
      },
      errorTitle: "Abwesenheit konnte nicht gelöscht werden",
    });
  },

  // ---------------------------------------------------------- Benachrichtigungen
  async markNotificationsRead(ids?: string[]) {
    const targets = ids ?? get().notifications.filter((n) => !n.read_at).map((n) => n.id);
    if (targets.length === 0) return;
    const before = get().notifications;
    const now = new Date().toISOString();
    return mutate({
      ids: targets,
      apply: () =>
        set((s) => ({
          notifications: s.notifications.map((n) => (targets.includes(n.id) && !n.read_at ? { ...n, read_at: now } : n)),
        })),
      rollback: () => set({ notifications: before }),
      run: async () => {
        await repo().markNotificationsRead(targets);
        return true;
      },
      errorTitle: "Benachrichtigungen konnten nicht aktualisiert werden",
    });
  },

  async updateOwnName(fullName: string) {
    const session = get().session;
    if (!session) return;
    return mutate({
      ids: [session.profile.id],
      apply: () => set({ session: { ...session, profile: { ...session.profile, full_name: fullName } } }),
      rollback: () => set({ session }),
      run: () => repo().updateOwnProfile({ full_name: fullName }),
      errorTitle: "Name konnte nicht gespeichert werden",
    });
  },
};
