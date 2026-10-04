import type { DateRange } from "@/lib/schedule/dates";
import type {
  Absence,
  AppNotification,
  Employee,
  NewAbsence,
  NewEmployee,
  NewShareLink,
  NewShift,
  NewShiftType,
  Profile,
  Role,
  Session,
  ShareLink,
  SharedSchedule,
  Shift,
  ShiftType,
} from "@/lib/types";

export type { DateRange };

export type TableName = "employees" | "shift_types" | "shifts" | "absences" | "notifications";

export type ChangeEvent =
  | { table: "employees"; type: "upsert"; row: Employee }
  | { table: "shift_types"; type: "upsert"; row: ShiftType }
  | { table: "shifts"; type: "upsert"; row: Shift }
  | { table: "absences"; type: "upsert"; row: Absence }
  | { table: "notifications"; type: "upsert"; row: AppNotification }
  | { table: TableName; type: "delete"; id: string };

export interface PushSubscriptionInput {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * Einheitliche Schnittstelle für die Datenhaltung.
 * Implementiert von Supabase (Produktion) und LocalStorage (Demo-Modus).
 */
export interface Repository {
  readonly mode: "supabase" | "demo";

  getSession(): Promise<Session | null>;
  signOut(): Promise<void>;
  updateOwnProfile(patch: { full_name: string }): Promise<Profile>;

  listEmployees(): Promise<Employee[]>;
  createEmployee(input: NewEmployee): Promise<Employee>;
  updateEmployee(id: string, patch: Partial<Employee>): Promise<Employee>;
  deleteEmployee(id: string): Promise<void>;

  listShiftTypes(): Promise<ShiftType[]>;
  createShiftType(input: NewShiftType): Promise<ShiftType>;
  updateShiftType(id: string, patch: Partial<ShiftType>): Promise<ShiftType>;
  deleteShiftType(id: string): Promise<void>;

  listShifts(range: DateRange): Promise<Shift[]>;
  createShifts(inputs: NewShift[]): Promise<Shift[]>;
  updateShift(id: string, patch: Partial<Shift>): Promise<Shift>;
  deleteShifts(ids: string[]): Promise<void>;

  listAbsences(): Promise<Absence[]>;
  createAbsence(input: NewAbsence): Promise<Absence>;
  updateAbsence(id: string, patch: Partial<Absence>): Promise<Absence>;
  deleteAbsence(id: string): Promise<void>;

  listNotifications(): Promise<AppNotification[]>;
  markNotificationsRead(ids: string[]): Promise<void>;

  listProfiles(): Promise<Profile[]>;
  updateProfileRole(id: string, role: Role): Promise<Profile>;

  listShareLinks(): Promise<ShareLink[]>;
  createShareLink(input: NewShareLink): Promise<ShareLink>;
  deleteShareLink(id: string): Promise<void>;
  getSharedSchedule(token: string): Promise<SharedSchedule | null>;

  savePushSubscription(input: PushSubscriptionInput): Promise<void>;
  deletePushSubscription(endpoint: string): Promise<void>;

  /** Echtzeit-Änderungen (auch von anderen Geräten/Tabs). Gibt eine Abmeldefunktion zurück. */
  subscribe(userId: string, onChange: (event: ChangeEvent) => void): () => void;
}
