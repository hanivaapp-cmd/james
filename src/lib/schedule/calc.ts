import type { Employee, ISODate, Shift, TimeString } from "@/lib/types";
import { dayNumber, inRange, weekStart } from "./dates";

export const MINUTES_PER_DAY = 1440;

export function timeToMinutes(time: TimeString): number {
  const [h, m] = time.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function minutesToTime(minutes: number): TimeString {
  const m = ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** "06:00:00" → "06:00" */
export function normalizeTime(time: string): TimeString {
  return time.slice(0, 5);
}

type Timed = Pick<Shift, "start_time" | "end_time" | "break_minutes">;

/** Dauer inkl. Pause. Endet die Schicht vor dem Beginn, geht sie über Mitternacht. */
export function shiftGrossMinutes(shift: Pick<Shift, "start_time" | "end_time">): number {
  let minutes = timeToMinutes(shift.end_time) - timeToMinutes(shift.start_time);
  if (minutes <= 0) minutes += MINUTES_PER_DAY;
  return minutes;
}

/** Bezahlte Arbeitszeit = Dauer − Pause. */
export function shiftNetMinutes(shift: Timed): number {
  return Math.max(0, shiftGrossMinutes(shift) - (shift.break_minutes || 0));
}

export function crossesMidnight(shift: Pick<Shift, "start_time" | "end_time">): boolean {
  return timeToMinutes(shift.end_time) <= timeToMinutes(shift.start_time);
}

/** Absoluter Zeitraum in Minuten (über Tagesgrenzen vergleichbar). */
export function shiftSpan(shift: Pick<Shift, "date" | "start_time" | "end_time">) {
  const start = dayNumber(shift.date) * MINUTES_PER_DAY + timeToMinutes(shift.start_time);
  return { start, end: start + shiftGrossMinutes(shift) };
}

export function shiftCost(shift: Timed, employee: Pick<Employee, "hourly_rate"> | undefined): number {
  if (!employee) return 0;
  return (shiftNetMinutes(shift) / 60) * employee.hourly_rate;
}

const hoursFormat = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 });

/** 450 → "7,5 h" */
export function formatHours(minutes: number, unit = true): string {
  const value = hoursFormat.format(Math.round((minutes / 60) * 100) / 100);
  return unit ? `${value} h` : value;
}

export function formatTimeRange(shift: Pick<Shift, "start_time" | "end_time">): string {
  return `${shift.start_time}–${shift.end_time}`;
}

export interface EmployeeTotals {
  minutes: number;
  cost: number;
  shiftCount: number;
  overtimeMinutes: number;
}

export interface ScheduleSummary {
  totalMinutes: number;
  totalCost: number;
  overtimeMinutes: number;
  shiftCount: number;
  byEmployee: Map<string, EmployeeTotals>;
  /** Minuten pro Mitarbeiter und Tag: key = `${employeeId}|${date}` */
  byEmployeeDay: Map<string, number>;
  byDay: Map<ISODate, { minutes: number; employees: Set<string> }>;
  /** Minuten pro Mitarbeiter und Woche: key = `${employeeId}|${weekStart}` */
  byEmployeeWeek: Map<string, number>;
}

/**
 * Stunden, Kosten und Überstunden für einen Zeitraum.
 * Überstunden = Minuten über den maximalen Wochenstunden, je Kalenderwoche
 * (berücksichtigt werden alle Wochen, die den Zeitraum berühren).
 */
export function summarize(
  shifts: Shift[],
  employees: Map<string, Employee>,
  from: ISODate,
  to: ISODate,
): ScheduleSummary {
  const byEmployee = new Map<string, EmployeeTotals>();
  const byEmployeeDay = new Map<string, number>();
  const byDay = new Map<ISODate, { minutes: number; employees: Set<string> }>();
  const byEmployeeWeek = new Map<string, number>();
  const firstWeek = weekStart(from);
  const lastWeek = weekStart(to);
  let totalMinutes = 0;
  let totalCost = 0;
  let shiftCount = 0;

  for (const shift of shifts) {
    const minutes = shiftNetMinutes(shift);
    const ws = weekStart(shift.date);
    if (ws >= firstWeek && ws <= lastWeek) {
      const key = `${shift.employee_id}|${ws}`;
      byEmployeeWeek.set(key, (byEmployeeWeek.get(key) ?? 0) + minutes);
    }
    if (!inRange(shift.date, from, to)) continue;

    const employee = employees.get(shift.employee_id);
    const cost = shiftCost(shift, employee);
    totalMinutes += minutes;
    totalCost += cost;
    shiftCount++;

    const totals = byEmployee.get(shift.employee_id) ?? { minutes: 0, cost: 0, shiftCount: 0, overtimeMinutes: 0 };
    totals.minutes += minutes;
    totals.cost += cost;
    totals.shiftCount++;
    byEmployee.set(shift.employee_id, totals);

    const dayKey = `${shift.employee_id}|${shift.date}`;
    byEmployeeDay.set(dayKey, (byEmployeeDay.get(dayKey) ?? 0) + minutes);

    const day = byDay.get(shift.date) ?? { minutes: 0, employees: new Set<string>() };
    day.minutes += minutes;
    day.employees.add(shift.employee_id);
    byDay.set(shift.date, day);
  }

  let overtimeMinutes = 0;
  for (const [key, minutes] of byEmployeeWeek) {
    const employeeId = key.split("|")[0];
    const employee = employees.get(employeeId);
    if (!employee) continue;
    const overtime = Math.max(0, minutes - employee.max_weekly_hours * 60);
    if (overtime <= 0) continue;
    overtimeMinutes += overtime;
    const totals = byEmployee.get(employeeId) ?? { minutes: 0, cost: 0, shiftCount: 0, overtimeMinutes: 0 };
    totals.overtimeMinutes += overtime;
    byEmployee.set(employeeId, totals);
  }

  return { totalMinutes, totalCost, overtimeMinutes, shiftCount, byEmployee, byEmployeeDay, byDay, byEmployeeWeek };
}
