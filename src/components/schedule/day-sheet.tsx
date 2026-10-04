"use client";

import { Plus, TreePalm } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { formatHours } from "@/lib/schedule/calc";
import { fmt } from "@/lib/schedule/dates";
import { ABSENCE_LABELS } from "@/lib/types";
import { useShiftEditor } from "./editor-store";
import { ShiftChipView } from "./shift-chip";
import type { ScheduleData } from "./use-schedule-data";

/** Alle Schichten eines Tages – v. a. für die Monatsansicht auf dem Smartphone. */
export function DaySheet({
  date,
  onClose,
  data,
  editable,
}: {
  date: string | null;
  onClose: () => void;
  data: ScheduleData;
  editable: boolean;
}) {
  const openShift = useShiftEditor((s) => s.openShift);
  const openNew = useShiftEditor((s) => s.openNew);
  const shifts = date ? (data.shiftsByDay.get(date) ?? []) : [];
  const absent = date
    ? data.employees.filter((e) => data.absenceByCell.has(`${e.id}|${date}`))
    : [];
  const minutes = date ? (data.summary.byDay.get(date)?.minutes ?? 0) : 0;

  return (
    <Dialog open={Boolean(date)} onOpenChange={(o) => !o && onClose()}>
      {date ? (
        <DialogContent
          title={fmt(date, "EEEE, d. MMMM")}
          description={`${shifts.length} Schichten · ${formatHours(minutes)}`}
          footer={
            editable ? (
              <Button
                variant="primary"
                className="w-full"
                onClick={() => {
                  onClose();
                  openNew({ date });
                }}
              >
                <Plus /> Schicht hinzufügen
              </Button>
            ) : undefined
          }
        >
          {shifts.length === 0 && absent.length === 0 ? (
            <EmptyState title="Keine Schichten" description="An diesem Tag ist noch niemand eingeplant." />
          ) : (
            <ul className="flex flex-col gap-2">
              {shifts.map((shift) => {
                const employee = data.employeeMap.get(shift.employee_id);
                return (
                  <li key={shift.id} className="flex items-center gap-3">
                    {employee ? <Avatar name={employee.name} color={employee.color} size="sm" /> : null}
                    <div className="w-28 shrink-0 truncate text-[13px] font-medium">{employee?.name}</div>
                    <div className="min-w-0 flex-1">
                      <ShiftChipView
                        shift={shift}
                        type={shift.shift_type_id ? data.shiftTypesTable[shift.shift_type_id] : undefined}
                        employee={employee}
                        issues={data.analysis.byShift.get(shift.id)}
                        onClick={() => {
                          onClose();
                          openShift(shift.id);
                        }}
                      />
                    </div>
                  </li>
                );
              })}
              {absent.map((employee) => {
                const absence = data.absenceByCell.get(`${employee.id}|${date}`)!;
                return (
                  <li key={employee.id} className="flex items-center gap-3 text-[13px] text-success">
                    <Avatar name={employee.name} color={employee.color} size="sm" />
                    <span className="w-28 shrink-0 truncate font-medium text-fg">{employee.name}</span>
                    <span className="inline-flex items-center gap-1.5">
                      <TreePalm className="size-3.5" /> {ABSENCE_LABELS[absence.type]}
                      {absence.status === "pending" ? " (beantragt)" : ""}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
