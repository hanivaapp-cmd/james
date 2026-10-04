"use client";

import { useDroppable } from "@dnd-kit/core";
import { Plus, TreePalm } from "lucide-react";
import { memo } from "react";
import { Avatar } from "@/components/ui/avatar";
import { formatHours } from "@/lib/schedule/calc";
import { worstSeverity, type Issue } from "@/lib/schedule/conflicts";
import { fmt, isoWeekday, todayISO, weekStart } from "@/lib/schedule/dates";
import type { Absence, Employee, Shift, ShiftType } from "@/lib/types";
import { ABSENCE_LABELS } from "@/lib/types";
import { cn, formatCurrency } from "@/lib/utils";
import { useShiftEditor } from "./editor-store";
import { DraggableShift, SeverityIcon } from "./shift-chip";
import type { ScheduleData } from "./use-schedule-data";

const GRID =
  "grid grid-cols-[116px_repeat(7,minmax(108px,1fr))] sm:grid-cols-[minmax(148px,200px)_repeat(7,minmax(118px,1fr))]";

function AbsenceTag({ absence }: { absence: Absence }) {
  const pending = absence.status === "pending";
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium",
        pending ? "border border-dashed border-success/50 text-success" : "bg-success-soft text-success",
      )}
      title={absence.note ?? undefined}
    >
      <TreePalm className="size-3.5" />
      {ABSENCE_LABELS[absence.type]}
      {pending ? <span className="font-normal opacity-80">· beantragt</span> : null}
    </div>
  );
}

const Cell = memo(function Cell({
  employee,
  date,
  shifts,
  absence,
  types,
  issuesByShift,
  editable,
  isToday,
}: {
  employee: Employee;
  date: string;
  shifts: Shift[] | undefined;
  absence: Absence | undefined;
  types: Record<string, ShiftType>;
  issuesByShift: Map<string, Issue[]>;
  editable: boolean;
  isToday: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `cell:${employee.id}:${date}`,
    data: { kind: "cell", employeeId: employee.id, date },
    disabled: !editable,
  });
  const openShift = useShiftEditor((s) => s.openShift);
  const openNew = useShiftEditor((s) => s.openNew);
  const unavailable = !employee.available_days.includes(isoWeekday(date));

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "group/cell relative flex min-h-[68px] flex-col gap-1 border-r border-b border-border p-1.5 transition-colors",
        unavailable && "hatched",
        isToday && "bg-accent-soft/40",
        isOver && "bg-accent-soft ring-2 ring-accent/50 ring-inset",
      )}
    >
      {absence ? <AbsenceTag absence={absence} /> : null}
      {shifts?.map((shift) => (
        <DraggableShift
          key={shift.id}
          shift={shift}
          type={shift.shift_type_id ? types[shift.shift_type_id] : undefined}
          employee={employee}
          issues={issuesByShift.get(shift.id)}
          onClick={() => openShift(shift.id)}
          disabled={!editable}
        />
      ))}
      {editable ? (
        <button
          type="button"
          onClick={() => openNew({ employee_id: employee.id, date })}
          aria-label={`Schicht für ${employee.name} am ${fmt(date, "EEEE, d. MMMM")} hinzufügen`}
          className={cn(
            "flex min-h-7 flex-1 cursor-pointer items-center justify-center rounded-md text-subtle transition-opacity hover:bg-surface-2 hover:text-fg",
            shifts?.length || absence ? "opacity-0 group-hover/cell:opacity-100 focus:opacity-100" : "opacity-0 group-hover/cell:opacity-100 focus:opacity-100 max-lg:opacity-30",
          )}
        >
          <Plus className="size-4" />
        </button>
      ) : null}
    </div>
  );
});

function EmployeeCell({
  employee,
  minutes,
  cost,
  issues,
  showCost,
}: {
  employee: Employee;
  minutes: number;
  cost: number;
  issues: Issue[] | undefined;
  showCost: boolean;
}) {
  const limit = employee.max_weekly_hours * 60;
  const ratio = Math.min(1, minutes / limit);
  const over = minutes > limit;
  const severity = worstSeverity(issues);
  return (
    <div className="sticky left-0 z-10 flex flex-col justify-center gap-1.5 border-r border-b border-border bg-surface px-2.5 py-2 sm:px-3">
      <div className="flex min-w-0 items-center gap-2">
        <Avatar name={employee.name} color={employee.color} size="sm" className="max-sm:hidden" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-medium text-fg">{employee.name}</div>
          {employee.position ? <div className="truncate text-[11px] text-muted">{employee.position}</div> : null}
        </div>
        {severity ? (
          <span title={issues?.map((i) => i.message).join("\n")}>
            <SeverityIcon severity={severity} className="size-3.5" />
          </span>
        ) : null}
      </div>
      <div className="flex items-center gap-2 max-sm:flex-col max-sm:items-stretch max-sm:gap-1">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface-3 max-sm:flex-none">
          <div
            className={cn("h-full rounded-full transition-all", over ? "bg-danger" : ratio > 0.9 ? "bg-warning" : "bg-accent")}
            style={{ width: `${ratio * 100}%` }}
          />
        </div>
        <span className={cn("tabular text-[11px] whitespace-nowrap", over ? "font-semibold text-danger" : "text-muted")}>
          {formatHours(minutes, false)}/{formatHours(limit)}
        </span>
      </div>
      {showCost && cost > 0 ? (
        <div className="tabular -mt-1 hidden text-[10.5px] text-subtle sm:block">{formatCurrency(cost)}</div>
      ) : null}
    </div>
  );
}

export function WeekView({ data, editable, showCost }: { data: ScheduleData; editable: boolean; showCost: boolean }) {
  const today = todayISO();
  const { days, employees, shiftsByCell, absenceByCell, shiftTypesTable, analysis, summary } = data;
  const ws = weekStart(days[0]);

  return (
    <div className="min-w-max lg:min-w-0">
      {/* Kopfzeile */}
      <div className={cn(GRID, "sticky top-0 z-20 bg-surface")}>
        <div className="sticky left-0 z-10 flex items-end border-r border-b border-border bg-surface px-3 py-2 text-[11px] font-medium text-subtle">
          {employees.length} Mitarbeiter
        </div>
        {days.map((day) => {
          const isToday = day === today;
          const dayTotals = summary.byDay.get(day);
          return (
            <div
              key={day}
              className={cn("flex flex-col border-r border-b border-border px-2.5 py-2", isToday && "bg-accent-soft/40")}
            >
              <div className="flex items-baseline gap-1.5">
                <span className={cn("text-xs font-medium", isToday ? "text-accent" : "text-muted")}>{fmt(day, "EEE")}</span>
                <span
                  className={cn(
                    "tabular text-[15px] font-semibold",
                    isToday ? "flex size-6 items-center justify-center rounded-full bg-accent text-[13px] text-accent-fg" : "text-fg",
                  )}
                >
                  {fmt(day, "d")}
                </span>
              </div>
              <div className="tabular text-[11px] text-subtle">
                {dayTotals ? `${formatHours(dayTotals.minutes)} · ${dayTotals.employees.size} MA` : "–"}
              </div>
            </div>
          );
        })}
      </div>

      {/* Zeilen je Mitarbeiter */}
      {employees.map((employee) => {
        const minutes = summary.byEmployeeWeek.get(`${employee.id}|${ws}`) ?? 0;
        return (
          <div key={employee.id} className={GRID}>
            <EmployeeCell
              employee={employee}
              minutes={minutes}
              cost={summary.byEmployee.get(employee.id)?.cost ?? 0}
              issues={analysis.byEmployeeWeek.get(`${employee.id}|${ws}`)}
              showCost={showCost}
            />
            {days.map((day) => (
              <Cell
                key={day}
                employee={employee}
                date={day}
                shifts={shiftsByCell.get(`${employee.id}|${day}`)}
                absence={absenceByCell.get(`${employee.id}|${day}`)}
                types={shiftTypesTable}
                issuesByShift={analysis.byShift}
                editable={editable}
                isToday={day === today}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}
