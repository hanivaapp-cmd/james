import { addDaysISO, todayISO, weekStart } from "@/lib/schedule/dates";
import type {
  Absence,
  AppNotification,
  Employee,
  Profile,
  ShareLink,
  Shift,
  ShiftType,
} from "@/lib/types";

export interface DemoDatabase {
  version: 1;
  profiles: Profile[];
  employees: Employee[];
  shift_types: ShiftType[];
  shifts: Shift[];
  absences: Absence[];
  notifications: AppNotification[];
  share_links: ShareLink[];
}

export const DEMO_PROFILES = {
  admin: "demo-admin",
  manager: "demo-manager",
  employee: "demo-employee",
} as const;

/** Deterministischer Zufall, damit die Demo bei jedem Laden gleich aussieht. */
function random(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

export function createDemoDatabase(today = todayISO()): DemoDatabase {
  const types: ShiftType[] = [
    { id: "type-early", name: "Frühschicht", color: "#f59e0b", default_start: "06:00", default_end: "14:00", default_break_minutes: 30, sort_order: 1 },
    { id: "type-late", name: "Spätschicht", color: "#6366f1", default_start: "14:00", default_end: "22:00", default_break_minutes: 30, sort_order: 2 },
    { id: "type-night", name: "Nachtschicht", color: "#0ea5e9", default_start: "22:00", default_end: "06:00", default_break_minutes: 45, sort_order: 3 },
  ];

  const employees: Employee[] = [
    { id: "emp-1", user_id: null, name: "Jonas Weber", email: "jonas@demo.de", position: "Schichtleitung", hourly_rate: 21.5, max_weekly_hours: 40, available_days: [1, 2, 3, 4, 5], color: "#6366f1", active: true },
    { id: "emp-2", user_id: DEMO_PROFILES.employee, name: "Lena Hoffmann", email: "lena@demo.de", position: "Service", hourly_rate: 15.5, max_weekly_hours: 30, available_days: [1, 2, 3, 4, 5, 6], color: "#ec4899", active: true },
    { id: "emp-3", user_id: null, name: "Mehmet Yılmaz", email: "mehmet@demo.de", position: "Küche", hourly_rate: 17, max_weekly_hours: 40, available_days: [1, 2, 3, 4, 5, 6, 7], color: "#f97316", active: true },
    { id: "emp-4", user_id: null, name: "Sophie Schulz", email: "sophie@demo.de", position: "Service", hourly_rate: 14.8, max_weekly_hours: 20, available_days: [3, 4, 5, 6, 7], color: "#10b981", active: true },
    { id: "emp-5", user_id: null, name: "David Neumann", email: "david@demo.de", position: "Küche", hourly_rate: 16.2, max_weekly_hours: 38, available_days: [1, 2, 3, 4, 5], color: "#0ea5e9", active: true },
    { id: "emp-6", user_id: null, name: "Clara Fischer", email: "clara@demo.de", position: "Kasse", hourly_rate: 14.5, max_weekly_hours: 25, available_days: [1, 2, 4, 5, 6], color: "#8b5cf6", active: true },
    { id: "emp-7", user_id: null, name: "Tim Wagner", email: "tim@demo.de", position: "Lager", hourly_rate: 15, max_weekly_hours: 40, available_days: [1, 2, 3, 4, 5, 6, 7], color: "#14b8a6", active: true },
  ];

  const profiles: Profile[] = [
    { id: DEMO_PROFILES.admin, email: "chef@demo.de", full_name: "Sabine Krüger", role: "admin" },
    { id: DEMO_PROFILES.manager, email: "planung@demo.de", full_name: "Markus Brandt", role: "manager" },
    { id: DEMO_PROFILES.employee, email: "lena@demo.de", full_name: "Lena Hoffmann", role: "employee" },
  ];

  const rand = random(42);
  const shifts: Shift[] = [];
  const firstWeek = addDaysISO(weekStart(today), -14);
  let counter = 0;

  // Je Woche und Mitarbeiter so viele Tage, wie die Wochenstunden hergeben.
  const workdays = new Set<string>();
  for (let week = 0; week < 5; week++) {
    for (const employee of employees) {
      const targetDays = Math.min(employee.available_days.length, Math.floor(employee.max_weekly_hours / 7.5));
      const days = [...employee.available_days].sort(() => rand() - 0.5).slice(0, targetDays);
      for (const day of days) workdays.add(`${employee.id}|${week * 7 + day - 1}`);
    }
  }

  // Fünf Wochen Plan: zwei zurück, aktuelle Woche, zwei voraus.
  for (let day = 0; day < 35; day++) {
    const date = addDaysISO(firstWeek, day);
    for (const employee of employees) {
      if (!workdays.has(`${employee.id}|${day}`)) continue;
      // Wöchentlicher Wechsel zwischen Früh- und Spätschicht (Lager: auch Nacht).
      const week = Math.floor(day / 7);
      const index = employees.indexOf(employee);
      let type = types[(week + index) % 2];
      if (employee.id === "emp-7" && week % 3 === 2) type = types[2];
      shifts.push({
        id: `shift-${++counter}`,
        employee_id: employee.id,
        shift_type_id: type.id,
        date,
        start_time: type.default_start,
        end_time: type.default_end,
        break_minutes: type.default_break_minutes,
        location: employee.position === "Lager" ? "Lager Nord" : "Filiale Mitte",
        notes: null,
      });
    }
  }

  // Ein paar realistische Sonderfälle für die Warnungen.
  const monday = weekStart(today);
  const thisWeek = (offset: number) => addDaysISO(monday, offset);
  shifts.push(
    {
      id: `shift-${++counter}`,
      employee_id: "emp-1",
      shift_type_id: "type-late",
      date: thisWeek(5),
      start_time: "10:00",
      end_time: "20:00",
      break_minutes: 45,
      location: "Filiale Mitte",
      notes: "Inventur – bitte Schlüssel mitnehmen",
    },
    {
      id: `shift-${++counter}`,
      employee_id: "emp-3",
      shift_type_id: "type-early",
      date: thisWeek(2),
      start_time: "11:00",
      end_time: "15:00",
      break_minutes: 0,
      location: "Filiale Mitte",
      notes: "Lieferung annehmen",
    },
  );

  const absences: Absence[] = [
    { id: "abs-1", employee_id: "emp-5", type: "vacation", start_date: thisWeek(7), end_date: thisWeek(11), note: "Familienurlaub", status: "approved" },
    { id: "abs-2", employee_id: "emp-2", type: "vacation", start_date: thisWeek(17), end_date: thisWeek(18), note: "Hochzeit einer Freundin", status: "pending" },
    { id: "abs-3", employee_id: "emp-4", type: "sick", start_date: thisWeek(-3), end_date: thisWeek(-2), note: null, status: "approved" },
  ];

  // Geplante Schichten während eines genehmigten Urlaubs entfernen – bis auf eine (zeigt die Warnung).
  const vacation = absences[0];
  const vacationShifts = shifts.filter(
    (s) => s.employee_id === vacation.employee_id && s.date >= vacation.start_date && s.date <= vacation.end_date,
  );
  const keep = vacationShifts[0]?.id;
  const filtered = shifts.filter((s) => !vacationShifts.some((v) => v.id === s.id && v.id !== keep));

  const now = new Date().toISOString();
  const notifications: AppNotification[] = [
    {
      id: "note-1",
      user_id: DEMO_PROFILES.employee,
      title: "Neue Schicht",
      body: "Willkommen! Hier erscheinen Änderungen an deinem Dienstplan.",
      link: "/my",
      read_at: null,
      created_at: now,
    },
    {
      id: "note-2",
      user_id: DEMO_PROFILES.admin,
      title: "Neuer Antrag: Urlaub",
      body: "Lena Hoffmann · zwei Tage in zwei Wochen",
      link: "/absences",
      read_at: null,
      created_at: now,
    },
  ];
  notifications.push({ ...notifications[1], id: "note-3", user_id: DEMO_PROFILES.manager });

  return {
    version: 1,
    profiles,
    employees,
    shift_types: types,
    shifts: filtered,
    absences,
    notifications,
    share_links: [],
  };
}
