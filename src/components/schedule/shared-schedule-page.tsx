"use client";

import { Download, LinkIcon, TreePalm } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Logo } from "@/components/layout/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { getRepository } from "@/lib/data";
import { formatHours, shiftNetMinutes } from "@/lib/schedule/calc";
import { addDaysISO, fmt, formatDateRange, todayISO, weekNumber, weekStart } from "@/lib/schedule/dates";
import type { ExportInput } from "@/lib/schedule/export-model";
import type { SharedSchedule } from "@/lib/types";
import { ABSENCE_LABELS } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ShiftChipView } from "./shift-chip";

/** Öffentliche, schreibgeschützte Ansicht eines geteilten Dienstplans. */
export function SharedSchedulePage({ token }: { token: string }) {
  const [data, setData] = useState<SharedSchedule | null | undefined>(undefined);

  useEffect(() => {
    getRepository()
      .getSharedSchedule(token)
      .then(setData)
      .catch(() => setData(null));
  }, [token]);

  const typesTable = useMemo(() => Object.fromEntries((data?.shift_types ?? []).map((t) => [t.id, t])), [data]);
  const weeks = useMemo(() => {
    if (!data) return [];
    const list: string[][] = [];
    for (let ws = weekStart(data.start_date); ws <= data.end_date; ws = addDaysISO(ws, 7)) {
      list.push(Array.from({ length: 7 }, (_, i) => addDaysISO(ws, i)).filter((d) => d >= data.start_date && d <= data.end_date));
    }
    return list;
  }, [data]);

  const exportInput = (): ExportInput => ({
    title: data?.title ?? "Dienstplan",
    from: data!.start_date,
    to: data!.end_date,
    employees: data!.employees,
    shifts: data!.shifts,
    shiftTypes: typesTable,
    absences: data!.absences,
    includeCosts: false,
  });

  return (
    <div className="min-h-dvh">
      <header className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-6">
        <Logo />
        <ThemeToggle />
      </header>
      {data === undefined ? (
        <div className="flex justify-center py-20">
          <Spinner />
        </div>
      ) : data === null ? (
        <EmptyState
          icon={<LinkIcon />}
          title="Link ungültig oder abgelaufen"
          description="Bitte fragen Sie bei Ihrer Planung nach einem neuen Link."
          className="py-24"
        />
      ) : (
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold tracking-tight">{data.title ?? "Dienstplan"}</h1>
              <p className="text-[13px] text-muted">{formatDateRange(data.start_date, data.end_date)} · nur lesen</p>
            </div>
            <Button
              onClick={async () => {
                const { exportPdf } = await import("@/lib/schedule/export-pdf");
                exportPdf(exportInput());
              }}
            >
              <Download /> PDF
            </Button>
          </div>
          <div className="flex flex-col gap-6">
            {weeks.map((days) => (
              <section key={days[0]} className="overflow-hidden rounded-xl border border-border bg-surface shadow-soft">
                <h2 className="border-b border-border px-4 py-2.5 text-sm font-semibold">
                  KW {weekNumber(days[0])} · {formatDateRange(days[0], days[days.length - 1])}
                </h2>
                <div className="scrollbar-thin overflow-x-auto">
                  <table className="w-full min-w-[820px] border-collapse text-left">
                    <thead>
                      <tr className="text-xs text-muted">
                        <th className="sticky left-0 z-10 w-44 border-r border-b border-border bg-surface px-3 py-2 font-medium">Mitarbeiter</th>
                        {days.map((d) => (
                          <th key={d} className={cn("border-r border-b border-border px-2 py-2 font-medium", d === todayISO() && "text-accent")}>
                            {fmt(d, "EEE d.M.")}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.employees.map((employee) => {
                        const minutes = data.shifts
                          .filter((s) => s.employee_id === employee.id && days.includes(s.date))
                          .reduce((sum, s) => sum + shiftNetMinutes(s), 0);
                        return (
                          <tr key={employee.id}>
                            <td className="sticky left-0 z-10 border-r border-b border-border bg-surface px-3 py-2">
                              <div className="flex items-center gap-2">
                                <Avatar name={employee.name} color={employee.color} size="sm" />
                                <div className="min-w-0">
                                  <div className="truncate text-[13px] font-medium">{employee.name}</div>
                                  <div className="tabular text-[11px] text-muted">{formatHours(minutes)}</div>
                                </div>
                              </div>
                            </td>
                            {days.map((day) => {
                              const shifts = data.shifts.filter((s) => s.employee_id === employee.id && s.date === day);
                              const absence = data.absences.find((a) => a.employee_id === employee.id && day >= a.start_date && day <= a.end_date);
                              return (
                                <td key={day} className="border-r border-b border-border p-1.5 align-top">
                                  <div className="flex flex-col gap-1">
                                    {absence ? (
                                      <span className="inline-flex items-center gap-1 rounded-md bg-success-soft px-2 py-1 text-[11px] font-medium text-success">
                                        <TreePalm className="size-3" /> {ABSENCE_LABELS[absence.type]}
                                      </span>
                                    ) : null}
                                    {shifts.map((shift) => (
                                      <ShiftChipView key={shift.id} shift={shift} type={shift.shift_type_id ? typesTable[shift.shift_type_id] : undefined} />
                                    ))}
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </div>
        </main>
      )}
    </div>
  );
}
