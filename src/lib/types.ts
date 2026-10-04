export type Role = "admin" | "manager" | "employee";
export type AbsenceType = "vacation" | "sick" | "training" | "other";
export type AbsenceStatus = "pending" | "approved" | "rejected";

/** Datum im Format yyyy-MM-dd */
export type ISODate = string;
/** Uhrzeit im Format HH:mm */
export type TimeString = string;

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
}

export interface Employee {
  id: string;
  user_id: string | null;
  name: string;
  email: string | null;
  position: string | null;
  hourly_rate: number;
  max_weekly_hours: number;
  /** ISO-Wochentage, 1 = Montag … 7 = Sonntag */
  available_days: number[];
  color: string;
  active: boolean;
}

export interface ShiftType {
  id: string;
  name: string;
  color: string;
  default_start: TimeString;
  default_end: TimeString;
  default_break_minutes: number;
  sort_order: number;
}

export interface Shift {
  id: string;
  employee_id: string;
  shift_type_id: string | null;
  date: ISODate;
  start_time: TimeString;
  end_time: TimeString;
  break_minutes: number;
  location: string | null;
  notes: string | null;
}

export interface Absence {
  id: string;
  employee_id: string;
  type: AbsenceType;
  start_date: ISODate;
  end_date: ISODate;
  note: string | null;
  status: AbsenceStatus;
}

export interface AppNotification {
  id: string;
  user_id: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

export interface ShareLink {
  id: string;
  token: string;
  title: string | null;
  start_date: ISODate;
  end_date: ISODate;
  employee_ids: string[] | null;
  expires_at: string | null;
  created_at: string;
}

/** Öffentliche Ansicht eines geteilten Plans (ohne Löhne/E-Mails). */
export interface SharedSchedule {
  title: string | null;
  start_date: ISODate;
  end_date: ISODate;
  employees: Pick<Employee, "id" | "name" | "position" | "color" | "max_weekly_hours">[];
  shift_types: ShiftType[];
  shifts: Shift[];
  absences: Absence[];
}

export interface Session {
  profile: Profile;
  /** Verknüpfter Mitarbeiter-Datensatz des Logins (falls vorhanden) */
  employeeId: string | null;
}

export type NewEmployee = Omit<Employee, "id" | "user_id"> & { id?: string };
export type NewShift = Omit<Shift, "id"> & { id?: string };
export type NewAbsence = Omit<Absence, "id" | "status"> & { id?: string; status?: AbsenceStatus };
export type NewShiftType = Omit<ShiftType, "id"> & { id?: string };
export type NewShareLink = Pick<ShareLink, "title" | "start_date" | "end_date" | "employee_ids" | "expires_at">;

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  manager: "Manager",
  employee: "Mitarbeiter",
};

export const ABSENCE_LABELS: Record<AbsenceType, string> = {
  vacation: "Urlaub",
  sick: "Krank",
  training: "Fortbildung",
  other: "Abwesend",
};

export const ABSENCE_STATUS_LABELS: Record<AbsenceStatus, string> = {
  pending: "Offen",
  approved: "Genehmigt",
  rejected: "Abgelehnt",
};

export const WEEKDAY_SHORT = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"] as const;
