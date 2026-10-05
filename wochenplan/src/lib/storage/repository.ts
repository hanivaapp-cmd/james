import type { AppData, Employee, ISODate, Settings, Template, WeekPlan } from "../types";

/**
 * Schnittstelle zur Datenhaltung.
 *
 * Die App spricht ausschließlich über dieses Interface mit dem Speicher.
 * Heute steckt dahinter localStorage (siehe `local-storage.ts`); für eine echte Datenbank
 * (z. B. Supabase/Postgres oder eine eigene API) genügt eine zweite Implementierung –
 * an Oberfläche und Logik muss dafür nichts geändert werden.
 *
 * Die Methoden sind bewusst feingranular (pro Woche, pro Liste), damit eine Datenbank
 * nicht bei jeder Änderung den gesamten Bestand schreiben muss.
 */
export interface PlanRepository {
  /** Lädt alle Daten. `null` bedeutet: erster Start, noch nichts gespeichert. */
  load(): Promise<AppData | null>;
  saveEmployees(employees: Employee[]): Promise<void>;
  saveWeek(week: WeekPlan): Promise<void>;
  deleteWeek(weekStart: ISODate): Promise<void>;
  saveTemplates(templates: Template[]): Promise<void>;
  saveSettings(settings: Settings): Promise<void>;
  /** Ersetzt den kompletten Bestand (Wiederherstellen einer Sicherung, Zurücksetzen). */
  replaceAll(data: AppData): Promise<void>;
  /** Meldet Änderungen von außen (anderer Tab, anderes Gerät). Gibt eine Abmeldefunktion zurück. */
  subscribe(onExternalChange: () => void): () => void;
}
