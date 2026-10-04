import { normalizeTime } from "@/lib/schedule/calc";
import { fmt } from "@/lib/schedule/dates";
import type {
  Absence,
  AppNotification,
  Employee,
  Profile,
  Role,
  Session,
  ShareLink,
  Shift,
  ShiftType,
} from "@/lib/types";
import { ABSENCE_LABELS } from "@/lib/types";
import { uid } from "@/lib/utils";
import { createDemoDatabase, DEMO_PROFILES, type DemoDatabase } from "./demo-seed";
import type { ChangeEvent, Repository } from "./repository";

const DB_KEY = "schichtwerk-demo-db";
const SESSION_KEY = "schichtwerk-demo-session";
const CHANNEL = "schichtwerk-demo";

type DemoRole = keyof typeof DEMO_PROFILES;

const delay = () => new Promise((resolve) => setTimeout(resolve, 60));

/**
 * Demo-Datenhaltung im Browser (localStorage).
 * Bildet die Rechte der Supabase-RLS-Regeln nach, damit sich die Rollen echt anfühlen.
 * Änderungen werden per BroadcastChannel an andere Tabs verteilt (wie Realtime).
 */
export class LocalRepository implements Repository {
  readonly mode = "demo" as const;
  private channel: BroadcastChannel | null =
    typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(CHANNEL) : null;

  // ------------------------------------------------------------- Speicher
  private read(): DemoDatabase {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as DemoDatabase;
        if (parsed.version === 1) return parsed;
      } catch {
        // beschädigte Daten → neu anlegen
      }
    }
    const fresh = createDemoDatabase();
    localStorage.setItem(DB_KEY, JSON.stringify(fresh));
    return fresh;
  }

  private write(db: DemoDatabase, events: ChangeEvent[] = []) {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
    if (events.length) this.channel?.postMessage(events);
  }

  static reset() {
    localStorage.setItem(DB_KEY, JSON.stringify(createDemoDatabase()));
  }

  static signIn(role: DemoRole) {
    localStorage.setItem(SESSION_KEY, DEMO_PROFILES[role]);
  }

  private currentUserId(): string | null {
    return localStorage.getItem(SESSION_KEY);
  }

  private me(db = this.read()) {
    const id = this.currentUserId();
    const profile = db.profiles.find((p) => p.id === id);
    if (!profile) throw new Error("Nicht angemeldet.");
    const employee = db.employees.find((e) => e.user_id === profile.id);
    return { profile, employeeId: employee?.id ?? null };
  }

  private isStaff(db = this.read()) {
    const { profile } = this.me(db);
    return profile.role === "admin" || profile.role === "manager";
  }

  private requireStaff(db: DemoDatabase) {
    if (!this.isStaff(db)) throw new Error("Keine Berechtigung für diese Aktion.");
  }

  private requireAdmin(db: DemoDatabase) {
    if (this.me(db).profile.role !== "admin") throw new Error("Nur Administratoren dürfen das.");
  }

  /** Nachbildung der Datenbank-Trigger für Benachrichtigungen. */
  private notify(db: DemoDatabase, userId: string | null | undefined, title: string, body: string, link: string) {
    if (!userId || userId === this.currentUserId()) return null;
    const note: AppNotification = {
      id: uid(),
      user_id: userId,
      title,
      body,
      link,
      read_at: null,
      created_at: new Date().toISOString(),
    };
    db.notifications.unshift(note);
    return { table: "notifications", type: "upsert", row: note } as ChangeEvent;
  }

  private shiftLabel(shift: Shift) {
    return `${fmt(shift.date, "dd.MM.yyyy")}, ${shift.start_time}–${shift.end_time}`;
  }

  private userOf(db: DemoDatabase, employeeId: string) {
    return db.employees.find((e) => e.id === employeeId)?.user_id ?? null;
  }

  // -------------------------------------------------------------- Session
  async getSession(): Promise<Session | null> {
    const db = this.read();
    const id = this.currentUserId();
    const profile = db.profiles.find((p) => p.id === id);
    if (!profile) return null;
    return { profile, employeeId: db.employees.find((e) => e.user_id === profile.id)?.id ?? null };
  }

  async signOut() {
    localStorage.removeItem(SESSION_KEY);
  }

  async updateOwnProfile(patch: { full_name: string }) {
    const db = this.read();
    const { profile } = this.me(db);
    profile.full_name = patch.full_name;
    this.write(db);
    return profile;
  }

  // ------------------------------------------------------------ Employees
  async listEmployees() {
    await delay();
    const db = this.read();
    const { employeeId } = this.me(db);
    const list = this.isStaff(db) ? db.employees : db.employees.filter((e) => e.id === employeeId);
    return [...list].sort((a, b) => a.name.localeCompare(b.name, "de"));
  }

  async createEmployee(input: Parameters<Repository["createEmployee"]>[0]) {
    const db = this.read();
    this.requireStaff(db);
    this.assertUniqueEmail(db, input.email ?? null);
    const linked = db.profiles.find((p) => input.email && p.email.toLowerCase() === input.email.toLowerCase());
    const employee: Employee = { ...input, id: input.id ?? uid(), user_id: linked?.id ?? null };
    db.employees.push(employee);
    this.write(db, [{ table: "employees", type: "upsert", row: employee }]);
    return employee;
  }

  async updateEmployee(id: string, patch: Partial<Employee>) {
    const db = this.read();
    this.requireStaff(db);
    const employee = db.employees.find((e) => e.id === id);
    if (!employee) throw new Error("Mitarbeiter nicht gefunden.");
    if (patch.email !== undefined && patch.email !== employee.email) this.assertUniqueEmail(db, patch.email, id);
    const { id: _ignore, user_id: _user, ...rest } = patch;
    void _ignore;
    void _user;
    Object.assign(employee, rest);
    this.write(db, [{ table: "employees", type: "upsert", row: employee }]);
    return employee;
  }

  private assertUniqueEmail(db: DemoDatabase, email: string | null, exceptId?: string) {
    if (!email) return;
    const taken = db.employees.some((e) => e.id !== exceptId && e.email?.toLowerCase() === email.toLowerCase());
    if (taken) throw new Error("Diese E-Mail-Adresse ist bereits einem Mitarbeiter zugeordnet.");
  }

  async deleteEmployee(id: string) {
    const db = this.read();
    this.requireAdmin(db);
    db.employees = db.employees.filter((e) => e.id !== id);
    const removedShifts = db.shifts.filter((s) => s.employee_id === id);
    db.shifts = db.shifts.filter((s) => s.employee_id !== id);
    db.absences = db.absences.filter((a) => a.employee_id !== id);
    this.write(db, [
      { table: "employees", type: "delete", id },
      ...removedShifts.map((s) => ({ table: "shifts", type: "delete", id: s.id }) as ChangeEvent),
    ]);
  }

  // ---------------------------------------------------------- Shift types
  async listShiftTypes() {
    return [...this.read().shift_types].sort((a, b) => a.sort_order - b.sort_order);
  }

  async createShiftType(input: Parameters<Repository["createShiftType"]>[0]) {
    const db = this.read();
    this.requireStaff(db);
    const type: ShiftType = { ...input, id: input.id ?? uid() };
    db.shift_types.push(type);
    this.write(db, [{ table: "shift_types", type: "upsert", row: type }]);
    return type;
  }

  async updateShiftType(id: string, patch: Partial<ShiftType>) {
    const db = this.read();
    this.requireStaff(db);
    const type = db.shift_types.find((t) => t.id === id);
    if (!type) throw new Error("Schichtart nicht gefunden.");
    Object.assign(type, patch, { id });
    this.write(db, [{ table: "shift_types", type: "upsert", row: type }]);
    return type;
  }

  async deleteShiftType(id: string) {
    const db = this.read();
    this.requireStaff(db);
    db.shift_types = db.shift_types.filter((t) => t.id !== id);
    const touched = db.shifts.filter((s) => s.shift_type_id === id);
    touched.forEach((s) => (s.shift_type_id = null));
    this.write(db, [
      { table: "shift_types", type: "delete", id },
      ...touched.map((row) => ({ table: "shifts", type: "upsert", row }) as ChangeEvent),
    ]);
  }

  // --------------------------------------------------------------- Shifts
  async listShifts(range: { from: string; to: string }) {
    await delay();
    const db = this.read();
    const { employeeId } = this.me(db);
    const staff = this.isStaff(db);
    return db.shifts.filter(
      (s) => s.date >= range.from && s.date <= range.to && (staff || s.employee_id === employeeId),
    );
  }

  async createShifts(inputs: Parameters<Repository["createShifts"]>[0]) {
    const db = this.read();
    this.requireStaff(db);
    const created = inputs.map(
      (input): Shift => ({
        ...input,
        id: input.id ?? uid(),
        start_time: normalizeTime(input.start_time),
        end_time: normalizeTime(input.end_time),
      }),
    );
    db.shifts.push(...created);
    const events: ChangeEvent[] = created.map((row) => ({ table: "shifts", type: "upsert", row }));
    for (const shift of created) {
      const note = this.notify(db, this.userOf(db, shift.employee_id), "Neue Schicht", this.shiftLabel(shift), `/my?date=${shift.date}`);
      if (note) events.push(note);
    }
    this.write(db, events);
    return created;
  }

  async updateShift(id: string, patch: Partial<Shift>) {
    const db = this.read();
    this.requireStaff(db);
    const shift = db.shifts.find((s) => s.id === id);
    if (!shift) throw new Error("Schicht nicht gefunden – wurde sie gelöscht?");
    const before = { ...shift };
    Object.assign(shift, patch, { id });
    const events: ChangeEvent[] = [{ table: "shifts", type: "upsert", row: shift }];
    const push = (e: ChangeEvent | null) => e && events.push(e);
    if (before.employee_id !== shift.employee_id) {
      push(this.notify(db, this.userOf(db, before.employee_id), "Schicht entfernt", this.shiftLabel(before), "/my"));
      push(this.notify(db, this.userOf(db, shift.employee_id), "Neue Schicht", this.shiftLabel(shift), `/my?date=${shift.date}`));
    } else if (
      before.date !== shift.date ||
      before.start_time !== shift.start_time ||
      before.end_time !== shift.end_time ||
      before.break_minutes !== shift.break_minutes ||
      before.location !== shift.location
    ) {
      push(
        this.notify(
          db,
          this.userOf(db, shift.employee_id),
          "Schicht geändert",
          `${this.shiftLabel(before)} → ${this.shiftLabel(shift)}`,
          `/my?date=${shift.date}`,
        ),
      );
    }
    this.write(db, events);
    return shift;
  }

  async deleteShifts(ids: string[]) {
    const db = this.read();
    this.requireStaff(db);
    const removed = db.shifts.filter((s) => ids.includes(s.id));
    db.shifts = db.shifts.filter((s) => !ids.includes(s.id));
    const events: ChangeEvent[] = removed.map((s) => ({ table: "shifts", type: "delete", id: s.id }));
    for (const shift of removed) {
      const note = this.notify(db, this.userOf(db, shift.employee_id), "Schicht entfernt", this.shiftLabel(shift), "/my");
      if (note) events.push(note);
    }
    this.write(db, events);
  }

  // ------------------------------------------------------------- Absences
  async listAbsences() {
    const db = this.read();
    const { employeeId } = this.me(db);
    const list = this.isStaff(db) ? db.absences : db.absences.filter((a) => a.employee_id === employeeId);
    return [...list].sort((a, b) => b.start_date.localeCompare(a.start_date));
  }

  async createAbsence(input: Parameters<Repository["createAbsence"]>[0]) {
    const db = this.read();
    const { employeeId } = this.me(db);
    const staff = this.isStaff(db);
    if (!staff && !employeeId) throw new Error("Ihr Login ist keinem Mitarbeiter zugeordnet.");
    const absence: Absence = {
      ...input,
      id: input.id ?? uid(),
      employee_id: staff ? input.employee_id : employeeId!,
      status: staff ? (input.status ?? "approved") : "pending",
    };
    if (absence.end_date < absence.start_date) throw new Error("Das Enddatum liegt vor dem Startdatum.");
    db.absences.push(absence);
    const events: ChangeEvent[] = [{ table: "absences", type: "upsert", row: absence }];
    if (absence.status === "pending") {
      const name = db.employees.find((e) => e.id === absence.employee_id)?.name ?? "";
      for (const profile of db.profiles.filter((p) => p.role !== "employee")) {
        const note = this.notify(
          db,
          profile.id,
          `Neuer Antrag: ${ABSENCE_LABELS[absence.type]}`,
          `${name} · ${fmt(absence.start_date, "dd.MM.")}–${fmt(absence.end_date, "dd.MM.yyyy")}`,
          "/absences",
        );
        if (note) events.push(note);
      }
    }
    this.write(db, events);
    return absence;
  }

  async updateAbsence(id: string, patch: Partial<Absence>) {
    const db = this.read();
    const absence = db.absences.find((a) => a.id === id);
    if (!absence) throw new Error("Eintrag nicht gefunden.");
    const staff = this.isStaff(db);
    if (!staff) {
      if (absence.employee_id !== this.me(db).employeeId || absence.status !== "pending") {
        throw new Error("Bereits bearbeitete Anträge können nicht mehr geändert werden.");
      }
      patch = { ...patch, status: "pending", employee_id: absence.employee_id };
    }
    const before = absence.status;
    Object.assign(absence, patch, { id });
    const events: ChangeEvent[] = [{ table: "absences", type: "upsert", row: absence }];
    if (absence.status !== before && absence.status !== "pending") {
      const note = this.notify(
        db,
        this.userOf(db, absence.employee_id),
        `${ABSENCE_LABELS[absence.type]} ${absence.status === "approved" ? "genehmigt" : "abgelehnt"}`,
        `${fmt(absence.start_date, "dd.MM.")}–${fmt(absence.end_date, "dd.MM.yyyy")}`,
        "/absences",
      );
      if (note) events.push(note);
    }
    this.write(db, events);
    return absence;
  }

  async deleteAbsence(id: string) {
    const db = this.read();
    const absence = db.absences.find((a) => a.id === id);
    if (!absence) return;
    if (!this.isStaff(db) && (absence.employee_id !== this.me(db).employeeId || absence.status !== "pending")) {
      throw new Error("Keine Berechtigung für diese Aktion.");
    }
    db.absences = db.absences.filter((a) => a.id !== id);
    this.write(db, [{ table: "absences", type: "delete", id }]);
  }

  // -------------------------------------------------------- Notifications
  async listNotifications() {
    const db = this.read();
    const { profile } = this.me(db);
    return db.notifications.filter((n) => n.user_id === profile.id).slice(0, 50);
  }

  async markNotificationsRead(ids: string[]) {
    const db = this.read();
    const now = new Date().toISOString();
    db.notifications.forEach((n) => {
      if (ids.includes(n.id) && !n.read_at) n.read_at = now;
    });
    this.write(db);
  }

  // ------------------------------------------------------------- Profiles
  async listProfiles() {
    const db = this.read();
    this.requireStaff(db);
    return db.profiles;
  }

  async updateProfileRole(id: string, role: Role) {
    const db = this.read();
    this.requireAdmin(db);
    const profile = db.profiles.find((p) => p.id === id);
    if (!profile) throw new Error("Benutzer nicht gefunden.");
    if (profile.role === "admin" && role !== "admin" && db.profiles.filter((p) => p.role === "admin").length === 1) {
      throw new Error("Es muss mindestens ein Administrator bestehen bleiben.");
    }
    profile.role = role;
    this.write(db);
    return profile as Profile;
  }

  // ---------------------------------------------------------- Share links
  async listShareLinks() {
    const db = this.read();
    this.requireStaff(db);
    return [...db.share_links].sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  async createShareLink(input: Parameters<Repository["createShareLink"]>[0]) {
    const db = this.read();
    this.requireStaff(db);
    const link: ShareLink = {
      ...input,
      id: uid(),
      token: (uid() + uid()).replaceAll("-", ""),
      created_at: new Date().toISOString(),
    };
    db.share_links.push(link);
    this.write(db);
    return link;
  }

  async deleteShareLink(id: string) {
    const db = this.read();
    this.requireStaff(db);
    db.share_links = db.share_links.filter((l) => l.id !== id);
    this.write(db);
  }

  async getSharedSchedule(token: string) {
    await delay();
    const db = this.read();
    const link = db.share_links.find((l) => l.token === token);
    if (!link || (link.expires_at && link.expires_at < new Date().toISOString())) return null;
    const visible = (employeeId: string) => !link.employee_ids || link.employee_ids.includes(employeeId);
    const employees = db.employees
      .filter((e) => e.active && visible(e.id))
      .sort((a, b) => a.name.localeCompare(b.name, "de"));
    const active = new Set(employees.map((e) => e.id));
    return {
      title: link.title,
      start_date: link.start_date,
      end_date: link.end_date,
      employees: employees.map(({ id, name, position, color, max_weekly_hours }) => ({
        id,
        name,
        position,
        color,
        max_weekly_hours,
      })),
      shift_types: db.shift_types,
      shifts: db.shifts.filter((s) => s.date >= link.start_date && s.date <= link.end_date && active.has(s.employee_id)),
      absences: db.absences.filter(
        (a) =>
          a.status === "approved" &&
          a.start_date <= link.end_date &&
          a.end_date >= link.start_date &&
          visible(a.employee_id),
      ),
    };
  }

  // ----------------------------------------------------------------- Push
  async savePushSubscription() {}
  async deletePushSubscription() {}

  // ------------------------------------------------------------- Realtime
  subscribe(userId: string, onChange: (event: ChangeEvent) => void) {
    if (!this.channel) return () => {};
    const handler = (message: MessageEvent<ChangeEvent[]>) => {
      let db: DemoDatabase;
      try {
        db = this.read();
      } catch {
        return;
      }
      const profile = db.profiles.find((p) => p.id === userId);
      const staff = profile?.role === "admin" || profile?.role === "manager";
      const ownEmployee = db.employees.find((e) => e.user_id === userId)?.id;
      for (const event of message.data) {
        if (event.type === "upsert") {
          if (event.table === "notifications" && event.row.user_id !== userId) continue;
          if (!staff && (event.table === "shifts" || event.table === "absences") && event.row.employee_id !== ownEmployee) continue;
          if (!staff && event.table === "employees" && event.row.id !== ownEmployee) continue;
        }
        onChange(event);
      }
    };
    this.channel.addEventListener("message", handler);
    return () => this.channel?.removeEventListener("message", handler);
  }
}

export type { DemoRole };
