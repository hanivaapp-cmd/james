import type { Absence, Employee, ISODate, Shift, ShiftType } from "@/lib/types";
import { ABSENCE_LABELS } from "@/lib/types";
import { summarize } from "./calc";
import { addDaysISO, eachDate, fmt, formatDateRange, weekNumber, weekStart } from "./dates";

export type ExportEmployee = Pick<Employee, "id" | "name" | "position" | "color" | "max_weekly_hours"> &
  Partial<Pick<Employee, "hourly_rate">>;

export interface ExportInput {
  title: string;
  from: ISODate;
  to: ISODate;
  employees: ExportEmployee[];
  shifts: Shift[];
  shiftTypes: Record<string, ShiftType>;
  absences: Absence[];
  includeCosts: boolean;
}

export interface ExportCell {
  lines: string[];
  color: string | null;
  absence: string | null;
}

export interface ExportWeek {
  label: string;
  days: ISODate[];
  rows: { employee: ExportEmployee; cells: ExportCell[]; minutes: number }[];
  dayMinutes: number[];
}

/** Baut das Raster (Wochen × Mitarbeiter × Tage) für PDF und Excel. */
export function buildExportModel(input: ExportInput) {
  const employeeMap = new Map(
    input.employees.map((e) => [e.id, { ...e, hourly_rate: e.hourly_rate ?? 0 } as Employee]),
  );
  const summary = summarize(input.shifts, employeeMap, input.from, input.to);
  const weeks: ExportWeek[] = [];

  for (let ws = weekStart(input.from); ws <= input.to; ws = addDaysISO(ws, 7)) {
    const days = eachDate(ws, addDaysISO(ws, 6)).filter((d) => d >= input.from && d <= input.to);
    const rows = input.employees.map((employee) => {
      const cells = days.map((day): ExportCell => {
        const shifts = input.shifts
          .filter((s) => s.employee_id === employee.id && s.date === day)
          .sort((a, b) => a.start_time.localeCompare(b.start_time));
        const absence = input.absences.find(
          (a) => a.employee_id === employee.id && a.status !== "rejected" && day >= a.start_date && day <= a.end_date,
        );
        const lines = shifts.map((s) => {
          const type = s.shift_type_id ? input.shiftTypes[s.shift_type_id] : undefined;
          const details = [type?.name, s.location].filter(Boolean).join(" · ");
          return details ? `${s.start_time}–${s.end_time}\n${details}` : `${s.start_time}–${s.end_time}`;
        });
        const first = shifts[0];
        const color = first ? (first.shift_type_id && input.shiftTypes[first.shift_type_id]?.color) || employee.color : null;
        return { lines, color, absence: absence ? ABSENCE_LABELS[absence.type] : null };
      });
      const minutes = days.reduce((sum, d) => sum + (summary.byEmployeeDay.get(`${employee.id}|${d}`) ?? 0), 0);
      return { employee, cells, minutes };
    });
    weeks.push({
      label: `KW ${weekNumber(ws)} · ${formatDateRange(days[0], days[days.length - 1])}`,
      days,
      rows,
      dayMinutes: days.map((d) => summary.byDay.get(d)?.minutes ?? 0),
    });
  }

  return { weeks, summary, employeeMap };
}

export function exportFileName(input: Pick<ExportInput, "from" | "to">, extension: string) {
  return `Dienstplan_${fmt(input.from, "yyyy-MM-dd")}_bis_${fmt(input.to, "yyyy-MM-dd")}.${extension}`;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Hex-Farbe mit Weiß mischen (für helle Zellhintergründe). */
export function lighten(hex: string, amount: number): [number, number, number] {
  const value = hex.replace("#", "");
  const full = value.length === 3 ? value.split("").map((c) => c + c).join("") : value;
  const n = parseInt(full, 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  return [mix((n >> 16) & 255), mix((n >> 8) & 255), mix(n & 255)];
}
