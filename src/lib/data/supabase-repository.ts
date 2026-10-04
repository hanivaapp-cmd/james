import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { normalizeTime } from "@/lib/schedule/calc";
import type {
  Absence,
  AppNotification,
  Employee,
  Profile,
  SharedSchedule,
  Shift,
  ShiftType,
} from "@/lib/types";
import type { ChangeEvent, Repository } from "./repository";

const PAGE_SIZE = 1000;

const EMPLOYEE_COLUMNS = [
  "name",
  "email",
  "position",
  "hourly_rate",
  "max_weekly_hours",
  "available_days",
  "color",
  "active",
] as const;
const SHIFT_COLUMNS = [
  "employee_id",
  "shift_type_id",
  "date",
  "start_time",
  "end_time",
  "break_minutes",
  "location",
  "notes",
] as const;
const SHIFT_TYPE_COLUMNS = [
  "name",
  "color",
  "default_start",
  "default_end",
  "default_break_minutes",
  "sort_order",
] as const;
const ABSENCE_COLUMNS = ["employee_id", "type", "start_date", "end_date", "note", "status"] as const;

function pick<T extends object>(source: Partial<T>, keys: readonly (keyof T)[], withId = false) {
  const out: Record<string, unknown> = {};
  for (const key of keys) if (source[key] !== undefined) out[key as string] = source[key];
  if (withId && "id" in source && source.id) out.id = source.id;
  return out;
}

/** Datenbankfehler in verständliche Meldungen übersetzen. */
function fail(error: PostgrestError | Error | null): never {
  const message = error?.message ?? "Unbekannter Fehler";
  if (/row-level security|permission denied|42501/i.test(message) || (error as PostgrestError)?.code === "42501") {
    throw new Error(
      /Administratoren|Anträge|ID und E-Mail/.test(message) ? message : "Keine Berechtigung für diese Aktion.",
    );
  }
  if (/duplicate key.*employees_email_key/i.test(message)) {
    throw new Error("Diese E-Mail-Adresse ist bereits einem Mitarbeiter zugeordnet.");
  }
  if (/Failed to fetch|NetworkError/i.test(message)) {
    throw new Error("Keine Verbindung zum Server. Bitte Internetverbindung prüfen.");
  }
  throw new Error(message);
}

const toEmployee = (row: Record<string, unknown>): Employee => ({
  ...(row as unknown as Employee),
  hourly_rate: Number(row.hourly_rate),
  max_weekly_hours: Number(row.max_weekly_hours),
  available_days: ((row.available_days as number[]) ?? []).map(Number),
});

const toShift = (row: Record<string, unknown>): Shift => ({
  id: row.id as string,
  employee_id: row.employee_id as string,
  shift_type_id: (row.shift_type_id as string) ?? null,
  date: row.date as string,
  start_time: normalizeTime(row.start_time as string),
  end_time: normalizeTime(row.end_time as string),
  break_minutes: Number(row.break_minutes ?? 0),
  location: (row.location as string) ?? null,
  notes: (row.notes as string) ?? null,
});

const toShiftType = (row: Record<string, unknown>): ShiftType => ({
  ...(row as unknown as ShiftType),
  default_start: normalizeTime(row.default_start as string),
  default_end: normalizeTime(row.default_end as string),
  default_break_minutes: Number(row.default_break_minutes ?? 0),
});

const toAbsence = (row: Record<string, unknown>): Absence => row as unknown as Absence;
const toNotification = (row: Record<string, unknown>): AppNotification => row as unknown as AppNotification;

export class SupabaseRepository implements Repository {
  readonly mode = "supabase" as const;

  constructor(private readonly db: SupabaseClient) {}

  // ---------------------------------------------------------------- Session
  async getSession() {
    const { data, error } = await this.db.auth.getUser();
    if (error || !data.user) return null;
    const [{ data: profile, error: profileError }, { data: employee }] = await Promise.all([
      this.db.from("profiles").select("*").eq("id", data.user.id).maybeSingle(),
      this.db.from("employees").select("id").eq("user_id", data.user.id).maybeSingle(),
    ]);
    if (profileError) fail(profileError);
    if (!profile) return null;
    return { profile: profile as Profile, employeeId: (employee?.id as string) ?? null };
  }

  async signOut() {
    await this.db.auth.signOut();
  }

  async updateOwnProfile(patch: { full_name: string }) {
    const { data: auth } = await this.db.auth.getUser();
    const { data, error } = await this.db
      .from("profiles")
      .update({ full_name: patch.full_name })
      .eq("id", auth.user?.id ?? "")
      .select()
      .single();
    if (error) fail(error);
    return data as Profile;
  }

  // -------------------------------------------------------------- Employees
  async listEmployees() {
    const { data, error } = await this.db.from("employees").select("*").order("name");
    if (error) fail(error);
    return (data ?? []).map(toEmployee);
  }

  async createEmployee(input: Parameters<Repository["createEmployee"]>[0]) {
    const { data, error } = await this.db
      .from("employees")
      .insert(pick<Employee>(input, EMPLOYEE_COLUMNS, true))
      .select()
      .single();
    if (error) fail(error);
    return toEmployee(data);
  }

  async updateEmployee(id: string, patch: Partial<Employee>) {
    const { data, error } = await this.db
      .from("employees")
      .update(pick(patch, EMPLOYEE_COLUMNS))
      .eq("id", id)
      .select()
      .single();
    if (error) fail(error);
    return toEmployee(data);
  }

  async deleteEmployee(id: string) {
    const { error, count } = await this.db.from("employees").delete({ count: "exact" }).eq("id", id);
    if (error) fail(error);
    if (count === 0) throw new Error("Keine Berechtigung: Nur Admins dürfen Mitarbeiter löschen.");
  }

  // ------------------------------------------------------------ Shift types
  async listShiftTypes() {
    const { data, error } = await this.db.from("shift_types").select("*").order("sort_order");
    if (error) fail(error);
    return (data ?? []).map(toShiftType);
  }

  async createShiftType(input: Parameters<Repository["createShiftType"]>[0]) {
    const { data, error } = await this.db
      .from("shift_types")
      .insert(pick<ShiftType>(input, SHIFT_TYPE_COLUMNS, true))
      .select()
      .single();
    if (error) fail(error);
    return toShiftType(data);
  }

  async updateShiftType(id: string, patch: Partial<ShiftType>) {
    const { data, error } = await this.db
      .from("shift_types")
      .update(pick(patch, SHIFT_TYPE_COLUMNS))
      .eq("id", id)
      .select()
      .single();
    if (error) fail(error);
    return toShiftType(data);
  }

  async deleteShiftType(id: string) {
    const { error } = await this.db.from("shift_types").delete().eq("id", id);
    if (error) fail(error);
  }

  // ----------------------------------------------------------------- Shifts
  async listShifts(range: { from: string; to: string }) {
    const rows: Record<string, unknown>[] = [];
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error } = await this.db
        .from("shifts")
        .select("*")
        .gte("date", range.from)
        .lte("date", range.to)
        .order("date")
        .order("id")
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) fail(error);
      rows.push(...(data ?? []));
      if (!data || data.length < PAGE_SIZE) break;
    }
    return rows.map(toShift);
  }

  async createShifts(inputs: Parameters<Repository["createShifts"]>[0]) {
    if (inputs.length === 0) return [];
    const { data, error } = await this.db
      .from("shifts")
      .insert(inputs.map((input) => pick<Shift>(input, SHIFT_COLUMNS, true)))
      .select();
    if (error) fail(error);
    return (data ?? []).map(toShift);
  }

  async updateShift(id: string, patch: Partial<Shift>) {
    const { data, error } = await this.db
      .from("shifts")
      .update(pick(patch, SHIFT_COLUMNS))
      .eq("id", id)
      .select()
      .single();
    if (error) fail(error);
    return toShift(data);
  }

  async deleteShifts(ids: string[]) {
    if (ids.length === 0) return;
    const { error } = await this.db.from("shifts").delete().in("id", ids);
    if (error) fail(error);
  }

  // --------------------------------------------------------------- Absences
  async listAbsences() {
    const { data, error } = await this.db.from("absences").select("*").order("start_date", { ascending: false });
    if (error) fail(error);
    return (data ?? []).map(toAbsence);
  }

  async createAbsence(input: Parameters<Repository["createAbsence"]>[0]) {
    const { data, error } = await this.db
      .from("absences")
      .insert(pick<Absence>(input, ABSENCE_COLUMNS, true))
      .select()
      .single();
    if (error) fail(error);
    return toAbsence(data);
  }

  async updateAbsence(id: string, patch: Partial<Absence>) {
    const { data, error } = await this.db
      .from("absences")
      .update(pick(patch, ABSENCE_COLUMNS))
      .eq("id", id)
      .select()
      .single();
    if (error) fail(error);
    return toAbsence(data);
  }

  async deleteAbsence(id: string) {
    const { error } = await this.db.from("absences").delete().eq("id", id);
    if (error) fail(error);
  }

  // ---------------------------------------------------------- Notifications
  async listNotifications() {
    const { data, error } = await this.db
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) fail(error);
    return (data ?? []).map(toNotification);
  }

  async markNotificationsRead(ids: string[]) {
    if (ids.length === 0) return;
    const { error } = await this.db
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .in("id", ids);
    if (error) fail(error);
  }

  // --------------------------------------------------------------- Profiles
  async listProfiles() {
    const { data, error } = await this.db.from("profiles").select("*").order("email");
    if (error) fail(error);
    return (data ?? []) as Profile[];
  }

  async updateProfileRole(id: string, role: Profile["role"]) {
    const { data, error } = await this.db.from("profiles").update({ role }).eq("id", id).select().single();
    if (error) fail(error);
    return data as Profile;
  }

  // ------------------------------------------------------------ Share links
  async listShareLinks() {
    const { data, error } = await this.db.from("share_links").select("*").order("created_at", { ascending: false });
    if (error) fail(error);
    return data ?? [];
  }

  async createShareLink(input: Parameters<Repository["createShareLink"]>[0]) {
    const { data, error } = await this.db.from("share_links").insert(input).select().single();
    if (error) fail(error);
    return data;
  }

  async deleteShareLink(id: string) {
    const { error } = await this.db.from("share_links").delete().eq("id", id);
    if (error) fail(error);
  }

  async getSharedSchedule(token: string) {
    const { data, error } = await this.db.rpc("get_shared_schedule", { p_token: token });
    if (error) fail(error);
    if (!data) return null;
    const result = data as SharedSchedule;
    return {
      ...result,
      shifts: (result.shifts ?? []).map((s) => toShift(s as unknown as Record<string, unknown>)),
      shift_types: (result.shift_types ?? []).map((t) => toShiftType(t as unknown as Record<string, unknown>)),
    };
  }

  // ------------------------------------------------------------------- Push
  async savePushSubscription(input: { endpoint: string; p256dh: string; auth: string }) {
    const { data: auth } = await this.db.auth.getUser();
    if (!auth.user) return;
    const { error } = await this.db
      .from("push_subscriptions")
      .upsert({ ...input, user_id: auth.user.id }, { onConflict: "endpoint" });
    if (error) fail(error);
  }

  async deletePushSubscription(endpoint: string) {
    const { error } = await this.db.from("push_subscriptions").delete().eq("endpoint", endpoint);
    if (error) fail(error);
  }

  // --------------------------------------------------------------- Realtime
  subscribe(userId: string, onChange: (event: ChangeEvent) => void) {
    const mappers = {
      employees: toEmployee,
      shift_types: toShiftType,
      shifts: toShift,
      absences: toAbsence,
      notifications: toNotification,
    } as const;

    let channel = this.db.channel(`schedule:${userId}`);
    for (const table of Object.keys(mappers) as (keyof typeof mappers)[]) {
      channel = channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          ...(table === "notifications" ? { filter: `user_id=eq.${userId}` } : {}),
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const id = (payload.old as { id?: string }).id;
            if (id) onChange({ table, type: "delete", id });
            return;
          }
          const row = mappers[table](payload.new as Record<string, unknown>);
          onChange({ table, type: "upsert", row } as ChangeEvent);
        },
      );
    }
    channel.subscribe();
    return () => {
      void this.db.removeChannel(channel);
    };
  }
}
