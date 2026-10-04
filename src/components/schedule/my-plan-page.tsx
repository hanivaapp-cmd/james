"use client";

import { CalendarCheck2, ChevronLeft, ChevronRight, Clock, MapPin, StickyNote, TreePalm } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { de } from "date-fns/locale";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { usePermissions } from "@/lib/hooks/use-permissions";
import { formatHours, shiftNetMinutes } from "@/lib/schedule/calc";
import { addDaysISO, fmt, formatRangeLabel, todayISO, weekDays, weekStart } from "@/lib/schedule/dates";
import { actions, useAppStore } from "@/lib/store/app-store";
import type { Shift } from "@/lib/types";
import { ABSENCE_LABELS } from "@/lib/types";
import { cn, tint } from "@/lib/utils";
import { useShiftEditor } from "./editor-store";
import { ExportMenu } from "./export-menu";
import { ShiftChipView } from "./shift-chip";
import { ShiftEditor } from "./shift-editor";

function shiftStart(shift: Shift) {
  return new Date(`${shift.date}T${shift.start_time}:00`);
}

export function MyPlanPage() {
  const { employeeId, canSeeCosts } = usePermissions();
  const session = useAppStore((s) => s.session);
  const employee = useAppStore((s) => (employeeId ? s.employees[employeeId] : undefined));
  const shiftsTable = useAppStore((s) => s.shifts);
  const absencesTable = useAppStore((s) => s.absences);
  const typesTable = useAppStore((s) => s.shiftTypes);
  const openShift = useShiftEditor((s) => s.openShift);
  const params = useSearchParams();
  const paramDate = params.get("date");
  const validParam = paramDate && /^\d{4}-\d{2}-\d{2}$/.test(paramDate) ? paramDate : null;
  const [week, setWeek] = useState(() => weekStart(validParam ?? todayISO()));
  // Link aus einer Benachrichtigung (?date=…) springt zur passenden Woche.
  const [lastParam, setLastParam] = useState(validParam);
  if (validParam !== lastParam) {
    setLastParam(validParam);
    if (validParam) setWeek(weekStart(validParam));
  }

  useEffect(() => {
    void actions.ensureRange({ from: addDaysISO(week, -7), to: addDaysISO(week, 27) });
  }, [week]);

  const myShifts = useMemo(
    () =>
      Object.values(shiftsTable)
        .filter((s) => s.employee_id === employeeId)
        .sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time)),
    [shiftsTable, employeeId],
  );
  const myAbsences = useMemo(
    () => Object.values(absencesTable).filter((a) => a.employee_id === employeeId && a.status !== "rejected"),
    [absencesTable, employeeId],
  );

  const now = new Date();
  const next = myShifts.find((s) => shiftStart(s) >= now);
  const days = weekDays(week);
  const weekShifts = myShifts.filter((s) => s.date >= days[0] && s.date <= days[6]);
  const weekMinutes = weekShifts.reduce((sum, s) => sum + shiftNetMinutes(s), 0);
  const limit = (employee?.max_weekly_hours ?? 40) * 60;
  const firstName = (session?.profile.full_name ?? employee?.name ?? "").split(" ")[0];

  if (!employeeId || !employee) {
    return (
      <div className="flex flex-1 flex-col">
        <PageHeader title="Mein Plan" />
        <EmptyState
          icon={<CalendarCheck2 />}
          title="Noch kein Dienstplan verknüpft"
          description="Ihr Login ist noch keinem Mitarbeiter zugeordnet. Bitten Sie Ihre Planung, Ihre E-Mail-Adresse in Ihrem Mitarbeiterprofil zu hinterlegen."
        />
      </div>
    );
  }

  const nextType = next?.shift_type_id ? typesTable[next.shift_type_id] : undefined;
  const nextColor = nextType?.color ?? employee.color;

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        title={firstName ? `Hallo ${firstName}` : "Mein Plan"}
        description="Ihre Schichten auf einen Blick"
        actions={
          <ExportMenu
            getInput={() => ({
              title: `Dienstplan ${employee.name} · ${formatRangeLabel("week", week)}`,
              from: days[0],
              to: days[6],
              employees: [employee],
              shifts: weekShifts,
              shiftTypes: typesTable,
              absences: myAbsences,
              includeCosts: canSeeCosts,
            })}
          />
        }
      />

      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-5 sm:px-6">
        {next ? (
          <button
            type="button"
            onClick={() => openShift(next.id)}
            className="relative cursor-pointer overflow-hidden rounded-2xl border p-4 text-left shadow-soft transition-shadow hover:shadow-pop"
            style={{ background: tint(nextColor, 10), borderColor: tint(nextColor, 30) }}
          >
            <span className="absolute inset-y-0 left-0 w-1" style={{ background: nextColor }} />
            <span className="text-xs font-medium text-muted">
              Nächste Schicht · {formatDistanceToNowStrict(shiftStart(next), { addSuffix: true, locale: de })}
            </span>
            <span className="mt-1 block text-lg font-semibold tracking-tight">{fmt(next.date, "EEEE, d. MMMM")}</span>
            <span className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted">
              <span className="inline-flex items-center gap-1.5">
                <Clock className="size-4" />
                <span className="tabular font-medium text-fg">
                  {next.start_time}–{next.end_time}
                </span>
                · {formatHours(shiftNetMinutes(next))}
              </span>
              {nextType ? <span>{nextType.name}</span> : null}
              {next.location ? (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="size-4" /> {next.location}
                </span>
              ) : null}
            </span>
            {next.notes ? (
              <span className="mt-2 flex items-start gap-1.5 text-[13px]">
                <StickyNote className="mt-0.5 size-4 shrink-0 text-muted" /> {next.notes}
              </span>
            ) : null}
          </button>
        ) : null}

        <section className="rounded-2xl border border-border bg-surface shadow-soft">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-border px-3 py-2.5">
            <Button size="icon-sm" variant="ghost" onClick={() => setWeek(addDaysISO(week, -7))} aria-label="Vorige Woche">
              <ChevronLeft />
            </Button>
            <span className="text-sm font-semibold">{formatRangeLabel("week", week)}</span>
            <Button size="icon-sm" variant="ghost" onClick={() => setWeek(addDaysISO(week, 7))} aria-label="Nächste Woche">
              <ChevronRight />
            </Button>
            <span
              className={cn("tabular text-xs max-sm:w-full max-sm:pl-10 sm:ml-auto", weekMinutes > limit ? "font-semibold text-danger" : "text-muted")}
              title="Geplante Stunden / maximale Wochenstunden"
            >
              {formatHours(weekMinutes, false)} / {formatHours(limit)}
              {weekMinutes > limit ? ` · ${formatHours(weekMinutes - limit)} Überstunden` : ""}
            </span>
          </div>
          <ul>
            {days.map((day) => {
              const shifts = weekShifts.filter((s) => s.date === day);
              const absence = myAbsences.find((a) => day >= a.start_date && day <= a.end_date);
              const isToday = day === todayISO();
              return (
                <li key={day} className={cn("flex gap-3 border-b border-border px-3 py-2.5 last:border-0", isToday && "bg-accent-soft/40")}>
                  <div className="w-14 shrink-0">
                    <div className={cn("text-xs font-medium", isToday ? "text-accent" : "text-muted")}>{fmt(day, "EEE")}</div>
                    <div className="tabular text-[15px] font-semibold">{fmt(day, "d.M.")}</div>
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    {absence ? (
                      <span className="inline-flex items-center gap-1.5 self-start rounded-md bg-success-soft px-2 py-1 text-xs font-medium text-success">
                        <TreePalm className="size-3.5" /> {ABSENCE_LABELS[absence.type]}
                        {absence.status === "pending" ? " (beantragt)" : ""}
                      </span>
                    ) : null}
                    {shifts.map((shift) => (
                      <div key={shift.id} className="max-w-xs">
                        <ShiftChipView
                          shift={shift}
                          type={shift.shift_type_id ? typesTable[shift.shift_type_id] : undefined}
                          employee={employee}
                          onClick={() => openShift(shift.id)}
                        />
                      </div>
                    ))}
                    {!absence && shifts.length === 0 ? <span className="py-1 text-[13px] text-subtle">Frei</span> : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
      <ShiftEditor />
    </div>
  );
}
