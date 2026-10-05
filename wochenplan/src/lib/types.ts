/**
 * Datenmodell des Wochenplans.
 *
 * Alle Typen sind reine JSON-Daten (keine Klassen, keine Date-Objekte),
 * damit sie 1:1 in localStorage oder später in einer Datenbank landen können.
 */

/** Bereich, in dem ein Mitarbeiter eingeteilt ist. */
export type AreaId = "kitchen" | "driver";

/** Datum im Format yyyy-MM-dd */
export type ISODate = string;

/** Uhrzeit im Format HH:mm */
export type Time = string;

/** Wochentag: 0 = Montag … 6 = Sonntag */
export type DayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface Employee {
  id: string;
  name: string;
  area: AreaId;
  /** Optionale Erkennungsfarbe (Hex), wird als Punkt vor dem Namen angezeigt. */
  color: string | null;
  /** Inaktive Mitarbeiter erscheinen nicht mehr in neuen Wochen. */
  active: boolean;
  /** Gelöschte Mitarbeiter verschwinden aus der Liste, bleiben aber in alten Wochenplänen sichtbar. */
  deleted: boolean;
  /** Reihenfolge innerhalb des Bereichs (aufsteigend). */
  sortOrder: number;
}

/**
 * Ein einzelner Eintrag in einer Zelle.
 * - `off`:   „Frei“
 * - `shift`: Arbeitszeit, z. B. „16h“, „11:30h bis 18h“, „Bis Ende“, „16h bis Ende“
 * - `text`:  freier Text, z. B. „Urlaub“ oder „Schule“
 */
export type Entry =
  | { kind: "off" }
  | { kind: "shift"; start: Time | null; end: Time | null; untilClose: boolean }
  | { kind: "text"; text: string };

/** Inhalt einer Zelle (Mitarbeiter × Tag). Meist ein Eintrag, bei geteilten Diensten mehrere. */
export type Cell = Entry[];

/** Einträge einer Woche: entries[mitarbeiterId][tag] */
export type WeekEntries = Record<string, Partial<Record<DayIndex, Cell>>>;

export interface WeekPlan {
  /** Montag der Woche (yyyy-MM-dd) – zugleich die ID der Woche. */
  weekStart: ISODate;
  entries: WeekEntries;
  /** Optionale Notiz pro Tag, z. B. „Lieferung um 15 Uhr“. */
  notes: Partial<Record<DayIndex, string>>;
  /**
   * Bereich eines Mitarbeiters in dieser Woche, falls er später den Bereich gewechselt hat.
   * So bleiben alte Wochenpläne unverändert.
   */
  areas: Record<string, AreaId>;
  updatedAt: string;
}

export interface Template {
  id: string;
  name: string;
  entries: WeekEntries;
  createdAt: string;
}

export interface Settings {
  /** Überschrift auf dem exportierten Bild. */
  title: string;
  /** Tagesnotizen auf dem Bild anzeigen. */
  showNotesInExport: boolean;
}

/** Gesamter gespeicherter Zustand. */
export interface AppData {
  employees: Employee[];
  weeks: Record<ISODate, WeekPlan>;
  templates: Template[];
  settings: Settings;
}

export const DEFAULT_SETTINGS: Settings = {
  title: "Arbeitsplan",
  showNotesInExport: true,
};
