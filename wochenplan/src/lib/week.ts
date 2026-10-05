import { addDays, addWeeks, format, getISOWeek, getISOWeekYear, parseISO, startOfISOWeek } from "date-fns";
import type { DayIndex, ISODate } from "./types";

export const DAY_INDICES: readonly DayIndex[] = [0, 1, 2, 3, 4, 5, 6];

export const DAY_NAMES = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"] as const;
export const DAY_SHORT = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"] as const;

/** Montag der Woche, in der `date` liegt (yyyy-MM-dd). */
export function weekStartOf(date: Date): ISODate {
  return format(startOfISOWeek(date), "yyyy-MM-dd");
}

export function shiftWeek(weekStart: ISODate, weeks: number): ISODate {
  return format(addWeeks(parseISO(weekStart), weeks), "yyyy-MM-dd");
}

export function dayDate(weekStart: ISODate, day: DayIndex): Date {
  return addDays(parseISO(weekStart), day);
}

export function weekNumber(weekStart: ISODate): number {
  return getISOWeek(parseISO(weekStart));
}

/** „05.10.“ */
export function shortDate(date: Date): string {
  return format(date, "dd.MM.");
}

/** „05.10.2026 – 11.10.2026“ */
export function weekRangeLong(weekStart: ISODate): string {
  const start = parseISO(weekStart);
  return `${format(start, "dd.MM.yyyy")} – ${format(addDays(start, 6), "dd.MM.yyyy")}`;
}

/** „05.10. – 11.10.2026“ (bei Jahreswechsel mit beiden Jahreszahlen) */
export function weekRangeShort(weekStart: ISODate): string {
  const start = parseISO(weekStart);
  const end = addDays(start, 6);
  const sameYear = start.getFullYear() === end.getFullYear();
  return `${format(start, sameYear ? "dd.MM." : "dd.MM.yyyy")} – ${format(end, "dd.MM.yyyy")}`;
}

/** „KW 41 · 05.10. – 11.10.2026“ */
export function weekLabel(weekStart: ISODate): string {
  return `KW ${weekNumber(weekStart)} · ${weekRangeShort(weekStart)}`;
}

/** Dateiname-tauglicher Bezeichner, z. B. „KW41_2026“ */
export function weekFileId(weekStart: ISODate): string {
  const d = parseISO(weekStart);
  return `KW${String(getISOWeek(d)).padStart(2, "0")}_${getISOWeekYear(d)}`;
}

/** Beschreibt die Woche relativ zu heute: „Diese Woche“, „Nächste Woche“, … */
export function relativeWeekName(weekStart: ISODate, currentWeekStart: ISODate): string | null {
  const diff = Math.round((parseISO(weekStart).getTime() - parseISO(currentWeekStart).getTime()) / (7 * 86_400_000));
  if (diff === 0) return "Diese Woche";
  if (diff === 1) return "Nächste Woche";
  if (diff === -1) return "Letzte Woche";
  if (diff === 2) return "Übernächste Woche";
  return null;
}

/** Wochentag-Index (0 = Mo) für ein Datum, falls es in der Woche liegt. */
export function dayIndexInWeek(weekStart: ISODate, date: Date): DayIndex | null {
  const diff = Math.round(
    (new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() - parseISO(weekStart).getTime()) /
      86_400_000,
  );
  return diff >= 0 && diff <= 6 ? (diff as DayIndex) : null;
}

/** Kurzbeschreibung einer Tagesauswahl: „Mo–Fr“, „Mo, Mi, Fr“, „ganze Woche“ */
export function describeDays(days: readonly DayIndex[]): string {
  const sorted = [...new Set(days)].sort((a, b) => a - b);
  if (sorted.length === 0) return "";
  if (sorted.length === 7) return "ganze Woche";
  const contiguous = sorted.every((d, i) => i === 0 || d === sorted[i - 1] + 1);
  if (contiguous && sorted.length >= 3) return `${DAY_SHORT[sorted[0]]}–${DAY_SHORT[sorted[sorted.length - 1]]}`;
  return sorted.map((d) => DAY_SHORT[d]).join(", ");
}
