import {
  addDays,
  addMonths,
  addWeeks,
  differenceInCalendarDays,
  endOfMonth,
  endOfWeek,
  format,
  getISODay,
  getISOWeek,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { de } from "date-fns/locale";
import type { ISODate } from "@/lib/types";

export type ViewMode = "week" | "month";

export interface DateRange {
  from: ISODate;
  to: ISODate;
}

export const toISODate = (date: Date): ISODate => format(date, "yyyy-MM-dd");
export const fromISODate = (date: ISODate): Date => parseISO(date);
export const todayISO = (): ISODate => toISODate(new Date());

export function addDaysISO(date: ISODate, days: number): ISODate {
  return toISODate(addDays(parseISO(date), days));
}

export function weekStart(date: ISODate): ISODate {
  return toISODate(startOfWeek(parseISO(date), { weekStartsOn: 1 }));
}

export function weekEnd(date: ISODate): ISODate {
  return toISODate(endOfWeek(parseISO(date), { weekStartsOn: 1 }));
}

export function eachDate(from: ISODate, to: ISODate): ISODate[] {
  const days: ISODate[] = [];
  const total = differenceInCalendarDays(parseISO(to), parseISO(from));
  for (let i = 0; i <= total; i++) days.push(addDaysISO(from, i));
  return days;
}

export function weekDays(date: ISODate): ISODate[] {
  return eachDate(weekStart(date), weekEnd(date));
}

/** Volle Kalenderwochen, die den Monat abdecken (für das Monatsraster). */
export function monthGrid(date: ISODate): ISODate[] {
  const d = parseISO(date);
  const from = toISODate(startOfWeek(startOfMonth(d), { weekStartsOn: 1 }));
  const to = toISODate(endOfWeek(endOfMonth(d), { weekStartsOn: 1 }));
  return eachDate(from, to);
}

export function monthRange(date: ISODate): DateRange {
  const d = parseISO(date);
  return { from: toISODate(startOfMonth(d)), to: toISODate(endOfMonth(d)) };
}

/** Sichtbarer Bereich der Ansicht (immer ganze Wochen). */
export function gridRange(view: ViewMode, date: ISODate): DateRange {
  if (view === "week") return { from: weekStart(date), to: weekEnd(date) };
  const days = monthGrid(date);
  return { from: days[0], to: days[days.length - 1] };
}

/** Kernbereich der Ansicht: Woche bzw. Kalendermonat. */
export function coreRange(view: ViewMode, date: ISODate): DateRange {
  return view === "week" ? gridRange("week", date) : monthRange(date);
}

export function stepDate(view: ViewMode, date: ISODate, direction: 1 | -1): ISODate {
  const d = parseISO(date);
  return toISODate(view === "week" ? addWeeks(d, direction) : addMonths(d, direction));
}

export function isoWeekday(date: ISODate): number {
  return getISODay(parseISO(date));
}

export function weekNumber(date: ISODate): number {
  return getISOWeek(parseISO(date));
}

export function isSameMonth(a: ISODate, b: ISODate): boolean {
  return a.slice(0, 7) === b.slice(0, 7);
}

export function inRange(date: ISODate, from: ISODate, to: ISODate): boolean {
  return date >= from && date <= to;
}

export function rangesOverlap(a: DateRange, b: DateRange): boolean {
  return a.from <= b.to && b.from <= a.to;
}

export function daysBetween(from: ISODate, to: ISODate): number {
  return differenceInCalendarDays(parseISO(to), parseISO(from));
}

/** Fortlaufende Tagesnummer – für Zeitvergleiche über Tagesgrenzen hinweg. */
export function dayNumber(date: ISODate): number {
  const [y, m, d] = date.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

export const fmt = (date: ISODate, pattern: string) => format(parseISO(date), pattern, { locale: de });

export function formatRangeLabel(view: ViewMode, date: ISODate): string {
  if (view === "month") return fmt(date, "MMMM yyyy");
  const from = weekStart(date);
  const to = weekEnd(date);
  const sameMonth = isSameMonth(from, to);
  const range = sameMonth
    ? `${fmt(from, "d.")}–${fmt(to, "d. MMM yyyy")}`
    : `${fmt(from, "d. MMM")} – ${fmt(to, "d. MMM yyyy")}`;
  return `KW ${weekNumber(date)} · ${range}`;
}

export function formatDateRange(from: ISODate, to: ISODate): string {
  if (from === to) return fmt(from, "EEE, d. MMM yyyy");
  return `${fmt(from, "d. MMM")} – ${fmt(to, "d. MMM yyyy")}`;
}
