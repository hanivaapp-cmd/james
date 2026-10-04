import type { Absence, Employee, Shift } from "@/lib/types";
import { ABSENCE_LABELS } from "@/lib/types";
import { fmt, inRange, isoWeekday, weekStart } from "./dates";
import { formatHours, shiftNetMinutes, shiftSpan } from "./calc";

export type IssueKind = "overlap" | "absence" | "max_hours" | "daily_max" | "rest_period" | "unavailable";
export type IssueSeverity = "error" | "warning" | "info";

export interface Issue {
  id: string;
  kind: IssueKind;
  severity: IssueSeverity;
  employeeId: string;
  shiftIds: string[];
  date: string;
  message: string;
}

export interface Analysis {
  issues: Issue[];
  byShift: Map<string, Issue[]>;
  /** key = `${employeeId}|${weekStart}` */
  byEmployeeWeek: Map<string, Issue[]>;
}

/** Gesetzliche Mindestruhezeit zwischen zwei Arbeitstagen (ArbZG §5). */
export const MIN_REST_MINUTES = 11 * 60;
/** Maximale tägliche Arbeitszeit (ArbZG §3). */
export const MAX_DAILY_MINUTES = 10 * 60;

const SEVERITY_ORDER: Record<IssueSeverity, number> = { error: 0, warning: 1, info: 2 };

export function worstSeverity(issues: Issue[] | undefined): IssueSeverity | null {
  if (!issues || issues.length === 0) return null;
  return issues.reduce<IssueSeverity>(
    (worst, issue) => (SEVERITY_ORDER[issue.severity] < SEVERITY_ORDER[worst] ? issue.severity : worst),
    "info",
  );
}

/**
 * Prüft den Dienstplan auf Überschneidungen, Abwesenheiten, Stundenlimits,
 * Ruhezeiten und Verfügbarkeit.
 */
export function analyzeSchedule(shifts: Shift[], employees: Map<string, Employee>, absences: Absence[]): Analysis {
  const issues: Issue[] = [];
  const add = (issue: Omit<Issue, "id">) =>
    issues.push({ ...issue, id: `${issue.kind}:${issue.shiftIds.join(",")}:${issue.date}` });

  const byEmployee = new Map<string, Shift[]>();
  for (const shift of shifts) {
    const list = byEmployee.get(shift.employee_id) ?? [];
    list.push(shift);
    byEmployee.set(shift.employee_id, list);
  }

  const absencesByEmployee = new Map<string, Absence[]>();
  for (const absence of absences) {
    if (absence.status === "rejected") continue;
    const list = absencesByEmployee.get(absence.employee_id) ?? [];
    list.push(absence);
    absencesByEmployee.set(absence.employee_id, list);
  }

  for (const [employeeId, list] of byEmployee) {
    const employee = employees.get(employeeId);
    const sorted = list
      .map((shift) => ({ shift, span: shiftSpan(shift) }))
      .sort((a, b) => a.span.start - b.span.start);

    // Überschneidungen & Ruhezeiten
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const a = sorted[i];
        const b = sorted[j];
        if (b.span.start >= a.span.end) {
          const gap = b.span.start - a.span.end;
          if (gap < MIN_REST_MINUTES && a.shift.date !== b.shift.date && j === i + 1) {
            add({
              kind: "rest_period",
              severity: "warning",
              employeeId,
              shiftIds: [a.shift.id, b.shift.id],
              date: b.shift.date,
              message: `Ruhezeit nur ${formatHours(gap)} (mind. 11 h) vor ${fmt(b.shift.date, "EEE d.M.")}`,
            });
          }
          break;
        }
        add({
          kind: "overlap",
          severity: "error",
          employeeId,
          shiftIds: [a.shift.id, b.shift.id],
          date: a.shift.date,
          message: `Überschneidung: ${a.shift.start_time}–${a.shift.end_time} und ${b.shift.start_time}–${b.shift.end_time} am ${fmt(b.shift.date, "EEE d.M.")}`,
        });
      }
    }

    // Tages- und Wochensummen
    const perDay = new Map<string, { minutes: number; ids: string[] }>();
    const perWeek = new Map<string, { minutes: number; ids: string[] }>();
    for (const { shift } of sorted) {
      const minutes = shiftNetMinutes(shift);
      const day = perDay.get(shift.date) ?? { minutes: 0, ids: [] };
      day.minutes += minutes;
      day.ids.push(shift.id);
      perDay.set(shift.date, day);
      const ws = weekStart(shift.date);
      const week = perWeek.get(ws) ?? { minutes: 0, ids: [] };
      week.minutes += minutes;
      week.ids.push(shift.id);
      perWeek.set(ws, week);
    }

    for (const [date, day] of perDay) {
      if (day.minutes > MAX_DAILY_MINUTES) {
        add({
          kind: "daily_max",
          severity: "warning",
          employeeId,
          shiftIds: day.ids,
          date,
          message: `${formatHours(day.minutes)} am ${fmt(date, "EEE d.M.")} – mehr als 10 h pro Tag`,
        });
      }
    }

    if (employee) {
      const limit = employee.max_weekly_hours * 60;
      for (const [ws, week] of perWeek) {
        if (week.minutes > limit) {
          add({
            kind: "max_hours",
            severity: "warning",
            employeeId,
            shiftIds: week.ids,
            date: ws,
            message: `${formatHours(week.minutes)} in KW ${fmt(ws, "I")} – ${formatHours(week.minutes - limit)} über dem Maximum von ${formatHours(limit)}`,
          });
        }
      }
    }

    // Abwesenheiten & Verfügbarkeit
    const employeeAbsences = absencesByEmployee.get(employeeId) ?? [];
    for (const { shift } of sorted) {
      const absence = employeeAbsences.find((a) => inRange(shift.date, a.start_date, a.end_date));
      if (absence) {
        add({
          kind: "absence",
          severity: absence.status === "approved" ? "error" : "warning",
          employeeId,
          shiftIds: [shift.id],
          date: shift.date,
          message: `${ABSENCE_LABELS[absence.type]}${absence.status === "pending" ? " (beantragt)" : ""} am ${fmt(shift.date, "EEE d.M.")}`,
        });
      }
      if (employee && !employee.available_days.includes(isoWeekday(shift.date))) {
        add({
          kind: "unavailable",
          severity: "info",
          employeeId,
          shiftIds: [shift.id],
          date: shift.date,
          message: `${fmt(shift.date, "EEEE")} ist kein verfügbarer Arbeitstag`,
        });
      }
    }
  }

  issues.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.date.localeCompare(b.date));

  const byShift = new Map<string, Issue[]>();
  const byEmployeeWeek = new Map<string, Issue[]>();
  for (const issue of issues) {
    for (const id of issue.shiftIds) {
      // Wochen-Limits gehören zur Zeile, nicht zu jeder einzelnen Schicht.
      if (issue.kind === "max_hours") continue;
      const list = byShift.get(id) ?? [];
      list.push(issue);
      byShift.set(id, list);
    }
    const key = `${issue.employeeId}|${weekStart(issue.date)}`;
    const list = byEmployeeWeek.get(key) ?? [];
    list.push(issue);
    byEmployeeWeek.set(key, list);
  }

  return { issues, byShift, byEmployeeWeek };
}
