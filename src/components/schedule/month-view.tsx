"use client";

import { useDroppable } from "@dnd-kit/core";
import { Plus, TreePalm } from "lucide-react";
import { memo } from "react";
import { formatHours } from "@/lib/schedule/calc";
import type { Issue } from "@/lib/schedule/conflicts";
import { fmt, isSameMonth, todayISO, weekNumber } from "@/lib/schedule/dates";
import { useIsDesktop } from "@/lib/hooks/use-media-query";
import type { Employee, Shift, ShiftType } from "@/lib/types";
import { WEEKDAY_SHORT } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useShiftEditor } from "./editor-store";
import { DraggableShift } from "./shift-chip";
import type { ScheduleData } from "./use-schedule-data";

const MAX_VISIBLE = 4;

const DayCell = memo(function DayCell({
  date,
  inMonth,
  shifts,
  absentCount,
  minutes,
  employees,
  types,
  issuesByShift,
  editable,
  onOpenDay,
  isDesktop,
}: {
  date: string;
  inMonth: boolean;
  shifts: Shift[] | undefined;
  absentCount: number;
  minutes: number;
  employees: Map<string, Employee>;
  types: Record<string, ShiftType>;
  issuesByShift: Map<string, Issue[]>;
  editable: boolean;
  onOpenDay: (date: string) => void;
  isDesktop: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day:${date}`, data: { kind: "day", date }, disabled: !editable });
  const openShift = useShiftEditor((s) => s.openShift);
  const openNew = useShiftEditor((s) => s.openNew);
  const isToday = date === todayISO();
  const list = shifts ?? [];
  const visible = isDesktop ? list.slice(0, MAX_VISIBLE) : [];

  return (
    <div
      ref={setNodeRef}
      onClick={isDesktop ? undefined : () => onOpenDay(date)}
      className={cn(
        "group/day relative flex min-h-24 flex-col gap-1 border-r border-b border-border p-1.5 transition-colors lg:min-h-32",
        !inMonth && "bg-surface-2/60",
        isOver && "bg-accent-soft ring-2 ring-accent/50 ring-inset",
      )}
    >
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenDay(date);
          }}
          className={cn(
            "tabular flex size-6 cursor-pointer items-center justify-center rounded-full text-xs font-semibold transition-colors hover:bg-surface-3",
            isToday ? "bg-accent text-accent-fg hover:bg-accent-hover" : inMonth ? "text-fg" : "text-subtle",
          )}
          aria-label={`${fmt(date, "EEEE, d. MMMM")} öffnen`}
        >
          {fmt(date, "d")}
        </button>
        {minutes > 0 ? <span className="tabular hidden text-[10.5px] text-subtle sm:inline">{formatHours(minutes)}</span> : null}
        {editable && isDesktop ? (
          <button
            type="button"
            onClick={() => openNew({ date })}
            className="ml-auto cursor-pointer rounded p-0.5 text-subtle opacity-0 transition-opacity group-hover/day:opacity-100 hover:bg-surface-3 hover:text-fg focus:opacity-100"
            aria-label="Schicht hinzufügen"
          >
            <Plus className="size-3.5" />
          </button>
        ) : null}
      </div>

      {isDesktop ? (
        <>
          {visible.map((shift) => (
            <DraggableShift
              key={shift.id}
              variant="compact"
              shift={shift}
              type={shift.shift_type_id ? types[shift.shift_type_id] : undefined}
              employee={employees.get(shift.employee_id)}
              issues={issuesByShift.get(shift.id)}
              onClick={() => openShift(shift.id)}
              disabled={!editable}
            />
          ))}
          {list.length > MAX_VISIBLE ? (
            <button
              type="button"
              onClick={() => onOpenDay(date)}
              className="cursor-pointer rounded px-1.5 text-left text-[11px] font-medium text-muted hover:text-fg"
            >
              +{list.length - MAX_VISIBLE} weitere
            </button>
          ) : null}
        </>
      ) : (
        <div className="flex flex-wrap gap-0.5">
          {list.slice(0, 8).map((shift) => (
            <span
              key={shift.id}
              className="h-1.5 w-3 rounded-full"
              style={{
                background:
                  (shift.shift_type_id && types[shift.shift_type_id]?.color) ||
                  employees.get(shift.employee_id)?.color ||
                  "#64748b",
              }}
            />
          ))}
          {list.length > 8 ? <span className="text-[9px] text-subtle">+{list.length - 8}</span> : null}
        </div>
      )}
      {absentCount > 0 ? (
        <span className="mt-auto flex items-center gap-1 truncate text-[10.5px] text-success" title={`${absentCount} abwesend`}>
          <TreePalm className="size-3 shrink-0" />
          {absentCount}
          <span className="max-sm:hidden">abwesend</span>
        </span>
      ) : null}
    </div>
  );
});

export function MonthView({
  data,
  editable,
  onOpenDay,
}: {
  data: ScheduleData;
  editable: boolean;
  onOpenDay: (date: string) => void;
}) {
  const isDesktop = useIsDesktop();
  const { days, date, shiftsByDay, summary, employeeMap, shiftTypesTable, analysis, absenceByCell, employees } = data;
  const weeks: string[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  const absentByDay = new Map<string, number>();
  for (const key of absenceByCell.keys()) {
    const day = key.split("|")[1];
    absentByDay.set(day, (absentByDay.get(day) ?? 0) + 1);
  }

  return (
    <div className="min-w-0">
      <div className="sticky top-0 z-20 grid grid-cols-[32px_repeat(7,minmax(0,1fr))] bg-surface sm:grid-cols-[44px_repeat(7,minmax(0,1fr))]">
        <div className="border-r border-b border-border" />
        {WEEKDAY_SHORT.map((label) => (
          <div key={label} className="border-r border-b border-border px-2 py-2 text-xs font-medium text-muted">
            {label}
          </div>
        ))}
      </div>
      {weeks.map((week) => {
        const minutes = employees.reduce((sum, e) => sum + (summary.byEmployeeWeek.get(`${e.id}|${week[0]}`) ?? 0), 0);
        return (
          <div key={week[0]} className="grid grid-cols-[32px_repeat(7,minmax(0,1fr))] sm:grid-cols-[44px_repeat(7,minmax(0,1fr))]">
            <div className="flex flex-col items-center gap-1 border-r border-b border-border bg-surface pt-2 text-center">
              <span className="text-[10px] font-medium text-subtle">KW</span>
              <span className="tabular text-xs font-semibold text-muted">{weekNumber(week[0])}</span>
              {minutes > 0 ? (
                <span className="tabular hidden text-[9.5px] leading-tight text-subtle sm:block" title="Stunden in dieser Woche">
                  {formatHours(minutes)}
                </span>
              ) : null}
            </div>
            {week.map((day) => (
              <DayCell
                key={day}
                date={day}
                inMonth={isSameMonth(day, date)}
                shifts={shiftsByDay.get(day)}
                absentCount={absentByDay.get(day) ?? 0}
                minutes={summary.byDay.get(day)?.minutes ?? 0}
                employees={employeeMap}
                types={shiftTypesTable}
                issuesByShift={analysis.byShift}
                editable={editable}
                onOpenDay={onOpenDay}
                isDesktop={isDesktop}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}
