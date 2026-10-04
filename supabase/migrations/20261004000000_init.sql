-- =============================================================================
-- Schichtwerk – Datenbankschema
-- Tabellen, Rollen, Row-Level-Security, Trigger für Benachrichtigungen,
-- öffentliche Freigabe-Links und Realtime.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
create type public.app_role as enum ('admin', 'manager', 'employee');
create type public.absence_type as enum ('vacation', 'sick', 'training', 'other');
create type public.absence_status as enum ('pending', 'approved', 'rejected');

-- -----------------------------------------------------------------------------
-- Tabellen
-- -----------------------------------------------------------------------------

-- Ein Profil pro Login (auth.users). Trägt die Rolle.
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  full_name   text,
  role        public.app_role not null default 'employee',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Mitarbeiter. Optional mit einem Login verknüpft (user_id).
create table public.employees (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid unique references auth.users (id) on delete set null,
  name              text not null check (length(trim(name)) > 0),
  email             text,
  position          text,
  hourly_rate       numeric(10, 2) not null default 0 check (hourly_rate >= 0),
  max_weekly_hours  numeric(5, 2) not null default 40 check (max_weekly_hours > 0 and max_weekly_hours <= 168),
  -- ISO-Wochentage: 1 = Montag … 7 = Sonntag
  available_days    smallint[] not null default '{1,2,3,4,5}'
                    check (available_days <@ '{1,2,3,4,5,6,7}'::smallint[]),
  color             text not null default '#6366f1',
  active            boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create unique index employees_email_key on public.employees (lower(email)) where email is not null;

-- Schichtarten (Früh, Spät, Nacht …) mit Farbe und Standardzeiten.
create table public.shift_types (
  id                     uuid primary key default gen_random_uuid(),
  name                   text not null check (length(trim(name)) > 0),
  color                  text not null,
  default_start          time not null,
  default_end            time not null,
  default_break_minutes  integer not null default 30 check (default_break_minutes between 0 and 720),
  sort_order             integer not null default 0,
  created_at             timestamptz not null default now()
);

-- Schichten. end_time < start_time bedeutet: Schicht endet am Folgetag.
create table public.shifts (
  id             uuid primary key default gen_random_uuid(),
  employee_id    uuid not null references public.employees (id) on delete cascade,
  shift_type_id  uuid references public.shift_types (id) on delete set null,
  date           date not null,
  start_time     time not null,
  end_time       time not null,
  break_minutes  integer not null default 0 check (break_minutes between 0 and 720),
  location       text,
  notes          text,
  created_by     uuid references auth.users (id) on delete set null default auth.uid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint shifts_time_check check (start_time <> end_time)
);
create index shifts_date_idx on public.shifts (date);
create index shifts_employee_date_idx on public.shifts (employee_id, date);

-- Urlaub & Abwesenheiten.
create table public.absences (
  id           uuid primary key default gen_random_uuid(),
  employee_id  uuid not null references public.employees (id) on delete cascade,
  type         public.absence_type not null default 'vacation',
  start_date   date not null,
  end_date     date not null,
  note         text,
  status       public.absence_status not null default 'pending',
  created_by   uuid references auth.users (id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint absences_range_check check (end_date >= start_date)
);
create index absences_employee_idx on public.absences (employee_id, start_date, end_date);

-- In-App-Benachrichtigungen (werden per Trigger erzeugt).
create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  title       text not null,
  body        text,
  link        text,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

-- Web-Push-Abonnements pro Gerät.
create table public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now()
);

-- Öffentliche Freigabe-Links für einen Zeitraum.
create table public.share_links (
  id            uuid primary key default gen_random_uuid(),
  token         text not null unique
                default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  title         text,
  start_date    date not null,
  end_date      date not null,
  employee_ids  uuid[],
  expires_at    timestamptz,
  created_by    uuid references auth.users (id) on delete set null default auth.uid(),
  created_at    timestamptz not null default now(),
  constraint share_links_range_check check (end_date >= start_date and end_date - start_date <= 92)
);

-- -----------------------------------------------------------------------------
-- Hilfsfunktionen für Rollen (security definer → keine RLS-Rekursion)
-- -----------------------------------------------------------------------------
create or replace function public.my_role()
returns public.app_role
language sql stable security definer set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.is_staff()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((select role in ('admin', 'manager') from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.my_employee_id()
returns uuid
language sql stable security definer set search_path = public
as $$
  select id from public.employees where user_id = auth.uid()
$$;

-- -----------------------------------------------------------------------------
-- updated_at automatisch pflegen
-- -----------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger employees_touch before update on public.employees
  for each row execute function public.touch_updated_at();
create trigger shifts_touch before update on public.shifts
  for each row execute function public.touch_updated_at();
create trigger absences_touch before update on public.absences
  for each row execute function public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- Neue Logins: Profil anlegen, erster Nutzer wird Admin,
-- Mitarbeiter mit gleicher E-Mail automatisch verknüpfen.
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_role public.app_role;
begin
  -- Serialisiert parallele Registrierungen, damit es genau einen ersten Admin gibt.
  perform pg_advisory_xact_lock(hashtext('schichtwerk_first_admin'));

  if not exists (select 1 from public.profiles) then
    v_role := 'admin';
  else
    v_role := 'employee';
  end if;

  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1)),
    v_role
  );

  update public.employees
     set user_id = new.id
   where user_id is null
     and email is not null
     and lower(email) = lower(new.email);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Mitarbeiter mit E-Mail eines bestehenden Logins automatisch verknüpfen.
create or replace function public.link_employee_to_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.user_id is null and new.email is not null then
    select p.id into new.user_id
      from public.profiles p
     where lower(p.email) = lower(new.email)
       and not exists (select 1 from public.employees e where e.user_id = p.id and e.id <> new.id)
     limit 1;
  end if;
  return new;
end;
$$;

create trigger employees_link_user
  before insert or update of email on public.employees
  for each row execute function public.link_employee_to_user();

-- Nur Admins dürfen Rollen ändern (auch nicht die eigene).
create or replace function public.guard_profile_role()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'Nur Administratoren dürfen Rollen ändern.' using errcode = '42501';
  end if;
  if new.id <> old.id or new.email <> old.email then
    if auth.uid() is not null then
      raise exception 'ID und E-Mail können hier nicht geändert werden.' using errcode = '42501';
    end if;
  end if;
  -- Es muss immer mindestens einen Admin geben.
  if old.role = 'admin' and new.role <> 'admin'
     and not exists (select 1 from public.profiles where role = 'admin' and id <> old.id) then
    raise exception 'Es muss mindestens ein Administrator bestehen bleiben.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger profiles_guard_role
  before update on public.profiles
  for each row execute function public.guard_profile_role();

-- Mitarbeiter dürfen eigene Anträge nur im Status "pending" anlegen/ändern.
create or replace function public.guard_absence_status()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_staff() then
    if tg_op = 'UPDATE' and old.status <> 'pending' then
      raise exception 'Bereits bearbeitete Anträge können nicht mehr geändert werden.' using errcode = '42501';
    end if;
    new.status := 'pending';
    new.employee_id := public.my_employee_id();
  end if;
  return new;
end;
$$;

create trigger absences_guard_status
  before insert or update on public.absences
  for each row execute function public.guard_absence_status();

-- -----------------------------------------------------------------------------
-- Benachrichtigungen bei Änderungen am Dienstplan
-- -----------------------------------------------------------------------------
create or replace function public.fmt_shift(p_date date, p_start time, p_end time)
returns text
language sql stable
as $$
  select to_char(p_date, 'DD.MM.YYYY') || ', ' || to_char(p_start, 'HH24:MI') || '–' || to_char(p_end, 'HH24:MI')
$$;

create or replace function public.notify_user(p_user uuid, p_title text, p_body text, p_link text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if p_user is null then
    return;
  end if;
  -- Wer selbst ändert, bekommt keine Benachrichtigung über die eigene Änderung.
  if auth.uid() is not null and p_user = auth.uid() then
    return;
  end if;
  insert into public.notifications (user_id, title, body, link)
  values (p_user, p_title, p_body, p_link);
end;
$$;

create or replace function public.on_shift_change()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_old_user uuid;
  v_new_user uuid;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    select user_id into v_old_user from public.employees where id = old.employee_id;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    select user_id into v_new_user from public.employees where id = new.employee_id;
  end if;

  if tg_op = 'INSERT' then
    perform public.notify_user(v_new_user, 'Neue Schicht',
      public.fmt_shift(new.date, new.start_time, new.end_time)
        || coalesce(' · ' || nullif(new.location, ''), ''),
      '/my?date=' || new.date);
  elsif tg_op = 'DELETE' then
    perform public.notify_user(v_old_user, 'Schicht entfernt',
      public.fmt_shift(old.date, old.start_time, old.end_time), '/my?date=' || old.date);
  elsif tg_op = 'UPDATE' then
    if new.employee_id <> old.employee_id then
      perform public.notify_user(v_old_user, 'Schicht entfernt',
        public.fmt_shift(old.date, old.start_time, old.end_time), '/my?date=' || old.date);
      perform public.notify_user(v_new_user, 'Neue Schicht',
        public.fmt_shift(new.date, new.start_time, new.end_time), '/my?date=' || new.date);
    elsif (new.date, new.start_time, new.end_time, new.break_minutes, new.location)
          is distinct from (old.date, old.start_time, old.end_time, old.break_minutes, old.location) then
      perform public.notify_user(v_new_user, 'Schicht geändert',
        public.fmt_shift(old.date, old.start_time, old.end_time) || ' → '
          || public.fmt_shift(new.date, new.start_time, new.end_time),
        '/my?date=' || new.date);
    end if;
  end if;

  return null;
end;
$$;

create trigger shifts_notify
  after insert or update or delete on public.shifts
  for each row execute function public.on_shift_change();

create or replace function public.on_absence_change()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid;
  v_name text;
  v_staff record;
  v_label text;
  v_range text;
begin
  select user_id, name into v_user, v_name from public.employees where id = new.employee_id;
  v_label := case new.type
    when 'vacation' then 'Urlaub'
    when 'sick' then 'Krankheit'
    when 'training' then 'Fortbildung'
    else 'Abwesenheit' end;
  v_range := to_char(new.start_date, 'DD.MM.') || '–' || to_char(new.end_date, 'DD.MM.YYYY');

  if tg_op = 'INSERT' and new.status = 'pending' then
    for v_staff in select id from public.profiles where role in ('admin', 'manager') loop
      perform public.notify_user(v_staff.id, 'Neuer Antrag: ' || v_label,
        v_name || ' · ' || v_range, '/absences');
    end loop;
  elsif tg_op = 'UPDATE' and new.status <> old.status and new.status <> 'pending' then
    perform public.notify_user(v_user,
      v_label || case when new.status = 'approved' then ' genehmigt' else ' abgelehnt' end,
      v_range, '/absences');
  end if;
  return null;
end;
$$;

create trigger absences_notify
  after insert or update on public.absences
  for each row execute function public.on_absence_change();

-- -----------------------------------------------------------------------------
-- Öffentliche Freigabe: liefert einen Dienstplan-Zeitraum ohne Login.
-- Gibt bewusst keine Stundenlöhne oder E-Mails heraus.
-- -----------------------------------------------------------------------------
create or replace function public.get_shared_schedule(p_token text)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_link public.share_links;
begin
  select * into v_link from public.share_links where token = p_token;
  if not found or (v_link.expires_at is not null and v_link.expires_at < now()) then
    return null;
  end if;

  return jsonb_build_object(
    'title', v_link.title,
    'start_date', v_link.start_date,
    'end_date', v_link.end_date,
    'employees', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id, 'name', e.name, 'position', e.position, 'color', e.color,
        'max_weekly_hours', e.max_weekly_hours) order by e.name)
      from public.employees e
      where e.active
        and (v_link.employee_ids is null or e.id = any (v_link.employee_ids))
    ), '[]'::jsonb),
    'shift_types', coalesce((
      select jsonb_agg(to_jsonb(t) order by t.sort_order) from public.shift_types t
    ), '[]'::jsonb),
    'shifts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'employee_id', s.employee_id, 'shift_type_id', s.shift_type_id,
        'date', s.date, 'start_time', s.start_time, 'end_time', s.end_time,
        'break_minutes', s.break_minutes, 'location', s.location, 'notes', s.notes)
        order by s.date, s.start_time)
      from public.shifts s
      join public.employees e on e.id = s.employee_id
      where s.date between v_link.start_date and v_link.end_date
        and e.active
        and (v_link.employee_ids is null or s.employee_id = any (v_link.employee_ids))
    ), '[]'::jsonb),
    'absences', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id, 'employee_id', a.employee_id, 'type', a.type,
        'start_date', a.start_date, 'end_date', a.end_date, 'status', a.status))
      from public.absences a
      where a.status = 'approved'
        and a.start_date <= v_link.end_date and a.end_date >= v_link.start_date
        and (v_link.employee_ids is null or a.employee_id = any (v_link.employee_ids))
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_shared_schedule(text) from public;
grant execute on function public.get_shared_schedule(text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Row-Level-Security
-- -----------------------------------------------------------------------------
alter table public.profiles           enable row level security;
alter table public.employees          enable row level security;
alter table public.shift_types        enable row level security;
alter table public.shifts             enable row level security;
alter table public.absences           enable row level security;
alter table public.notifications      enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.share_links        enable row level security;

-- profiles
create policy "profiles_select" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_staff());
create policy "profiles_update_self" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles_update_admin" on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- employees: Mitarbeiter sehen nur sich selbst, Admin/Manager alle.
create policy "employees_select" on public.employees for select to authenticated
  using (public.is_staff() or user_id = auth.uid());
create policy "employees_insert" on public.employees for insert to authenticated
  with check (public.is_staff());
create policy "employees_update" on public.employees for update to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy "employees_delete" on public.employees for delete to authenticated
  using (public.is_admin());

-- shift_types: alle lesen, Admin/Manager pflegen.
create policy "shift_types_select" on public.shift_types for select to authenticated
  using (true);
create policy "shift_types_write" on public.shift_types for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- shifts: Mitarbeiter sehen nur eigene Schichten, nur Admin/Manager bearbeiten.
create policy "shifts_select" on public.shifts for select to authenticated
  using (public.is_staff() or employee_id = public.my_employee_id());
create policy "shifts_insert" on public.shifts for insert to authenticated
  with check (public.is_staff());
create policy "shifts_update" on public.shifts for update to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy "shifts_delete" on public.shifts for delete to authenticated
  using (public.is_staff());

-- absences: Mitarbeiter verwalten eigene offene Anträge, Admin/Manager alles.
create policy "absences_select" on public.absences for select to authenticated
  using (public.is_staff() or employee_id = public.my_employee_id());
create policy "absences_insert" on public.absences for insert to authenticated
  with check (public.is_staff() or employee_id = public.my_employee_id());
create policy "absences_update" on public.absences for update to authenticated
  using (public.is_staff() or (employee_id = public.my_employee_id() and status = 'pending'))
  with check (public.is_staff() or employee_id = public.my_employee_id());
create policy "absences_delete" on public.absences for delete to authenticated
  using (public.is_staff() or (employee_id = public.my_employee_id() and status = 'pending'));

-- notifications: nur eigene.
create policy "notifications_select" on public.notifications for select to authenticated
  using (user_id = auth.uid());
create policy "notifications_update" on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "notifications_delete" on public.notifications for delete to authenticated
  using (user_id = auth.uid());

-- push_subscriptions: nur eigene.
create policy "push_select" on public.push_subscriptions for select to authenticated
  using (user_id = auth.uid());
create policy "push_insert" on public.push_subscriptions for insert to authenticated
  with check (user_id = auth.uid());
create policy "push_update" on public.push_subscriptions for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "push_delete" on public.push_subscriptions for delete to authenticated
  using (user_id = auth.uid());

-- share_links: nur Admin/Manager. Öffentlicher Zugriff läuft über get_shared_schedule().
create policy "share_links_all" on public.share_links for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- -----------------------------------------------------------------------------
-- Rechte für die Data API (RLS regelt den Zeilenzugriff)
-- -----------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on
  public.profiles, public.employees, public.shift_types, public.shifts, public.absences,
  public.notifications, public.push_subscriptions, public.share_links
  to authenticated;
grant execute on function
  public.my_role(), public.is_admin(), public.is_staff(), public.my_employee_id()
  to authenticated;

-- -----------------------------------------------------------------------------
-- Realtime
-- -----------------------------------------------------------------------------
alter table public.shifts        replica identity full;
alter table public.absences      replica identity full;
alter table public.employees     replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table
      public.shifts, public.employees, public.absences, public.shift_types, public.notifications;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Standard-Schichtarten
-- -----------------------------------------------------------------------------
insert into public.shift_types (name, color, default_start, default_end, default_break_minutes, sort_order) values
  ('Frühschicht',  '#f59e0b', '06:00', '14:00', 30, 1),
  ('Spätschicht',  '#6366f1', '14:00', '22:00', 30, 2),
  ('Nachtschicht', '#0ea5e9', '22:00', '06:00', 45, 3);
