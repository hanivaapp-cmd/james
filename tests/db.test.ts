/**
 * Prüft das Supabase-Schema (supabase/migrations) gegen ein echtes Postgres (PGlite):
 * Migration läuft durch, Rollen/RLS greifen, Trigger erzeugen Benachrichtigungen.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

const MIGRATIONS = join(__dirname, "..", "supabase", "migrations");

// Minimaler Nachbau der Supabase-Umgebung (auth-Schema, Rollen).
const SUPABASE_STUB = `
  create schema auth;
  create table auth.users (
    id uuid primary key,
    email text,
    raw_user_meta_data jsonb default '{}'::jsonb
  );
  create role anon nologin;
  create role authenticated nologin;
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
`;

const ADMIN = "00000000-0000-0000-0000-00000000000a";
const MANAGER = "00000000-0000-0000-0000-00000000000b";
const ANNA = "00000000-0000-0000-0000-00000000000c";
const BEN = "00000000-0000-0000-0000-00000000000d";

let db: PGlite;

async function as<T>(user: string | null, fn: () => Promise<T>): Promise<T> {
  if (user) {
    await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${user}', false);`);
  } else {
    await db.exec(`set role anon; select set_config('request.jwt.claim.sub', '', false);`);
  }
  try {
    return await fn();
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
  }
}

async function rows<T = Record<string, unknown>>(sql: string, params: unknown[] = []) {
  return (await db.query<T>(sql, params)).rows;
}

async function signUp(id: string, email: string) {
  await db.query(`insert into auth.users (id, email) values ($1, $2)`, [id, email]);
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STUB);
  for (const file of readdirSync(MIGRATIONS).sort()) {
    await db.exec(readFileSync(join(MIGRATIONS, file), "utf8"));
  }
  // Mitarbeiter mit E-Mail vor der Registrierung anlegen → automatische Verknüpfung.
  await db.exec(`
    insert into public.employees (name, email, position, hourly_rate, max_weekly_hours)
    values ('Anna Becker', 'anna@firma.de', 'Service', 15.5, 30),
           ('Ben Wolf', 'ben@firma.de', 'Küche', 17, 40);
  `);
  await signUp(ADMIN, "chef@firma.de");
  await signUp(MANAGER, "manager@firma.de");
  await signUp(ANNA, "anna@firma.de");
  await signUp(BEN, "ben@firma.de");
});

describe("Supabase-Schema", () => {
  it("legt Standard-Schichtarten an", async () => {
    const types = await rows<{ name: string }>(`select name from shift_types order by sort_order`);
    expect(types.map((t) => t.name)).toEqual(["Frühschicht", "Spätschicht", "Nachtschicht"]);
  });

  it("macht den ersten Nutzer zum Admin, alle weiteren zu Mitarbeitern", async () => {
    const profiles = await rows<{ email: string; role: string }>(
      `select email, role from profiles order by email`,
    );
    expect(profiles).toEqual([
      { email: "anna@firma.de", role: "employee" },
      { email: "ben@firma.de", role: "employee" },
      { email: "chef@firma.de", role: "admin" },
      { email: "manager@firma.de", role: "employee" },
    ]);
  });

  it("verknüpft Mitarbeiter per E-Mail mit dem Login", async () => {
    const [anna] = await rows<{ user_id: string }>(
      `select user_id from employees where email = 'anna@firma.de'`,
    );
    expect(anna.user_id).toBe(ANNA);
  });

  it("erlaubt nur Admins, Rollen zu ändern", async () => {
    await expect(
      as(ANNA, () => db.query(`update profiles set role = 'admin' where id = $1`, [ANNA])),
    ).rejects.toThrow(/Administratoren/);

    await as(ADMIN, () => db.query(`update profiles set role = 'manager' where id = $1`, [MANAGER]));
    const [m] = await rows<{ role: string }>(`select role from profiles where id = $1`, [MANAGER]);
    expect(m.role).toBe("manager");
  });

  it("verhindert, dass der letzte Admin entfernt wird", async () => {
    await expect(
      as(ADMIN, () => db.query(`update profiles set role = 'employee' where id = $1`, [ADMIN])),
    ).rejects.toThrow(/mindestens ein Administrator/);
  });

  it("lässt Manager Schichten planen und benachrichtigt den Mitarbeiter", async () => {
    await as(MANAGER, () =>
      db.query(
        `insert into shifts (employee_id, date, start_time, end_time, break_minutes, location)
         select id, '2026-10-05', '06:00', '14:00', 30, 'Filiale Mitte' from employees where email = 'anna@firma.de'`,
      ),
    );
    const notes = await as(ANNA, () =>
      rows<{ title: string; body: string }>(`select title, body from notifications`),
    );
    expect(notes).toHaveLength(1);
    expect(notes[0].title).toBe("Neue Schicht");
    expect(notes[0].body).toContain("05.10.2026, 06:00–14:00");
  });

  it("zeigt Mitarbeitern nur die eigenen Schichten und Daten", async () => {
    await as(ADMIN, () =>
      db.query(
        `insert into shifts (employee_id, date, start_time, end_time)
         select id, '2026-10-06', '14:00', '22:00' from employees where email = 'ben@firma.de'`,
      ),
    );
    const annaShifts = await as(ANNA, () => rows(`select * from shifts`));
    expect(annaShifts).toHaveLength(1);
    const annaEmployees = await as(ANNA, () => rows<{ name: string }>(`select name from employees`));
    expect(annaEmployees.map((e) => e.name)).toEqual(["Anna Becker"]);
    const managerShifts = await as(MANAGER, () => rows(`select * from shifts`));
    expect(managerShifts).toHaveLength(2);
  });

  it("verbietet Mitarbeitern das Bearbeiten von Schichten", async () => {
    const updated = await as(ANNA, () =>
      db.query(`update shifts set start_time = '05:00' returning id`),
    );
    expect(updated.rows).toHaveLength(0);
    await expect(
      as(ANNA, () =>
        db.query(
          `insert into shifts (employee_id, date, start_time, end_time)
           select id, '2026-10-07', '06:00', '14:00' from employees where email = 'anna@firma.de'`,
        ),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("erlaubt nur Admins das Löschen von Mitarbeitern", async () => {
    const deletedByManager = await as(MANAGER, () =>
      db.query(`delete from employees where email = 'ben@firma.de' returning id`),
    );
    expect(deletedByManager.rows).toHaveLength(0);
  });

  it("Urlaubsanträge: Mitarbeiter stellen offen, Manager genehmigen", async () => {
    // Anna versucht, sich selbst zu genehmigen → Status wird auf pending gezwungen.
    await as(ANNA, () =>
      db.query(
        `insert into absences (employee_id, type, start_date, end_date, status)
         select id, 'vacation', '2026-10-12', '2026-10-16', 'approved' from employees where email = 'anna@firma.de'`,
      ),
    );
    const [absence] = await rows<{ id: string; status: string }>(`select id, status from absences`);
    expect(absence.status).toBe("pending");

    // Admin & Manager bekommen eine Benachrichtigung über den Antrag.
    const staffNotes = await rows<{ user_id: string }>(
      `select user_id from notifications where title like 'Neuer Antrag%' order by user_id`,
    );
    expect(staffNotes.map((n) => n.user_id).sort()).toEqual([ADMIN, MANAGER].sort());

    // Anna kann keinen Antrag für Ben stellen.
    await as(ANNA, () =>
      db.query(
        `insert into absences (employee_id, type, start_date, end_date)
         select id, 'vacation', '2026-11-01', '2026-11-02' from employees where email = 'ben@firma.de'`,
      ),
    );
    const annaAbsences = await rows<{ name: string }>(
      `select e.name from absences a join employees e on e.id = a.employee_id`,
    );
    expect(annaAbsences.every((a) => a.name === "Anna Becker")).toBe(true);

    await as(MANAGER, () =>
      db.query(`update absences set status = 'approved' where id = $1`, [absence.id]),
    );
    const notes = await as(ANNA, () =>
      rows<{ title: string }>(`select title from notifications order by created_at desc`),
    );
    expect(notes.map((n) => n.title)).toContain("Urlaub genehmigt");

    // Genehmigte Anträge kann Anna nicht mehr ändern.
    const changed = await as(ANNA, () =>
      db.query(`update absences set note = 'x' where id = $1 returning id`, [absence.id]),
    );
    expect(changed.rows).toHaveLength(0);
  });

  it("Freigabe-Link liefert Plan ohne Login, aber ohne Stundenlöhne", async () => {
    const [link] = await as(MANAGER, () =>
      rows<{ token: string }>(
        `insert into share_links (start_date, end_date, title) values ('2026-10-05', '2026-10-11', 'KW 41') returning token`,
      ),
    );
    expect(link.token).toMatch(/^[0-9a-f]{64}$/);

    const [result] = await as(null, () =>
      rows<{ data: { shifts: unknown[]; employees: Record<string, unknown>[] } }>(
        `select public.get_shared_schedule($1) as data`,
        [link.token],
      ),
    );
    expect(result.data.shifts).toHaveLength(2);
    expect(result.data.employees[0]).not.toHaveProperty("hourly_rate");
    expect(result.data.employees[0]).not.toHaveProperty("email");

    const [invalid] = await as(null, () =>
      rows<{ data: unknown }>(`select public.get_shared_schedule('falsch') as data`),
    );
    expect(invalid.data).toBeNull();

    const anonLinks = await as(null, () => db.query(`select * from share_links`).catch(() => ({ rows: [] })));
    expect(anonLinks.rows).toHaveLength(0);
  });
});
