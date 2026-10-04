"use client";

import { useEffect, useMemo } from "react";
import { summarize } from "@/lib/schedule/calc";
import { analyzeSchedule } from "@/lib/schedule/conflicts";
import { addDaysISO, coreRange, eachDate, gridRange } from "@/lib/schedule/dates";
import { actions, useAppStore } from "@/lib/store/app-store";
import { useViewStore } from "@/lib/store/view-store";
import type { Absence, Employee, Shift, ShiftType } from "@/lib/types";

/** Alle abgeleiteten Daten für die aktuelle Dienstplan-Ansicht. */
export function useScheduleData() {
  const { view, date, search, positions, shiftTypeIds, onlyIssues } = useViewStore();
  const employeesTable = useAppStore((s) => s.employees);
  const shiftsTable = useAppStore((s) => s.shifts);
  const absencesTable = useAppStore((s) => s.absences);
  const shiftTypesTable = useAppStore((s) => s.shiftTypes);
  const loadedWeeks = useAppStore((s) => s.loadedWeeks);

  const range = useMemo(() => gridRange(view, date), [view, date]);
  const core = useMemo(() => coreRange(view, date), [view, date]);
  const days = useMemo(() => eachDate(range.from, range.to), [range]);

  // Sichtbaren Zeitraum plus Nachbarwochen laden (für Ruhezeit-Prüfung & schnelles Blättern).
  useEffect(() => {
    void actions.ensureRange({ from: addDaysISO(range.from, -7), to: addDaysISO(range.to, 7) });
  }, [range]);

  const loading = !loadedWeeks[range.from];

  const employeeMap = useMemo(() => new Map(Object.entries(employeesTable)), [employeesTable]);
  const allShifts = useMemo(() => Object.values(shiftsTable), [shiftsTable]);
  const absences = useMemo(() => Object.values(absencesTable), [absencesTable]);
  const shiftTypes = useMemo(
    () => Object.values(shiftTypesTable).sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)),
    [shiftTypesTable],
  );

  const analysis = useMemo(() => analyzeSchedule(allShifts, employeeMap, absences), [allShifts, employeeMap, absences]);

  const rangeShifts = useMemo(
    () =>
      allShifts
        .filter((s) => s.date >= range.from && s.date <= range.to)
        .filter((s) => shiftTypeIds.length === 0 || shiftTypeIds.includes(s.shift_type_id ?? "none"))
        .sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time)),
    [allShifts, range, shiftTypeIds],
  );

  const rangeIssues = useMemo(
    () => analysis.issues.filter((i) => i.date >= range.from && i.date <= range.to && employeeMap.has(i.employeeId)),
    [analysis, range, employeeMap],
  );

  const employees = useMemo(() => {
    const q = search.trim().toLowerCase();
    const withShifts = new Set(rangeShifts.map((s) => s.employee_id));
    const withIssues = new Set(rangeIssues.map((i) => i.employeeId));
    return [...employeeMap.values()]
      .filter((e) => e.active || withShifts.has(e.id))
      .filter((e) => !q || e.name.toLowerCase().includes(q) || (e.position ?? "").toLowerCase().includes(q))
      .filter((e) => positions.length === 0 || positions.includes(e.position ?? ""))
      .filter((e) => !onlyIssues || withIssues.has(e.id))
      .sort((a, b) => a.name.localeCompare(b.name, "de"));
  }, [employeeMap, search, positions, onlyIssues, rangeShifts, rangeIssues]);

  const visibleIds = useMemo(() => new Set(employees.map((e) => e.id)), [employees]);
  const visibleShifts = useMemo(() => rangeShifts.filter((s) => visibleIds.has(s.employee_id)), [rangeShifts, visibleIds]);

  const summary = useMemo(
    () => summarize(allShifts.filter((s) => visibleIds.has(s.employee_id)), employeeMap, core.from, core.to),
    [allShifts, visibleIds, employeeMap, core],
  );

  /** Schichten je Zelle: key = `${employeeId}|${date}` */
  const shiftsByCell = useMemo(() => {
    const map = new Map<string, Shift[]>();
    for (const shift of visibleShifts) {
      const key = `${shift.employee_id}|${shift.date}`;
      const list = map.get(key) ?? [];
      list.push(shift);
      map.set(key, list);
    }
    return map;
  }, [visibleShifts]);

  const shiftsByDay = useMemo(() => {
    const map = new Map<string, Shift[]>();
    for (const shift of visibleShifts) {
      const list = map.get(shift.date) ?? [];
      list.push(shift);
      map.set(shift.date, list);
    }
    return map;
  }, [visibleShifts]);

  /** Abwesenheit je Zelle: key = `${employeeId}|${date}` */
  const absenceByCell = useMemo(() => {
    const map = new Map<string, Absence>();
    for (const absence of absences) {
      if (absence.status === "rejected" || !visibleIds.has(absence.employee_id)) continue;
      if (absence.end_date < range.from || absence.start_date > range.to) continue;
      const from = absence.start_date < range.from ? range.from : absence.start_date;
      const to = absence.end_date > range.to ? range.to : absence.end_date;
      for (const day of eachDate(from, to)) map.set(`${absence.employee_id}|${day}`, absence);
    }
    return map;
  }, [absences, visibleIds, range]);

  const positionsList = useMemo(
    () => [...new Set([...employeeMap.values()].map((e) => e.position).filter(Boolean) as string[])].sort(),
    [employeeMap],
  );

  const locations = useMemo(
    () => [...new Set(allShifts.map((s) => s.location).filter(Boolean) as string[])].sort(),
    [allShifts],
  );

  return {
    view,
    date,
    range,
    core,
    days,
    loading,
    employees,
    employeeMap,
    shiftTypes,
    shiftTypesTable,
    visibleShifts,
    shiftsByCell,
    shiftsByDay,
    absenceByCell,
    analysis,
    rangeIssues,
    summary,
    positionsList,
    locations,
  };
}

export type ScheduleData = ReturnType<typeof useScheduleData>;

export function shiftColor(shift: Shift, types: Record<string, ShiftType>, employee?: Employee): string {
  return (shift.shift_type_id && types[shift.shift_type_id]?.color) || employee?.color || "#64748b";
}
