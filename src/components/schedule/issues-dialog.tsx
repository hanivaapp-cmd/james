"use client";

import { CircleCheck } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { useShiftEditor } from "./editor-store";
import { SeverityIcon } from "./shift-chip";
import type { ScheduleData } from "./use-schedule-data";

export function IssuesDialog({ open, onOpenChange, data }: { open: boolean; onOpenChange: (open: boolean) => void; data: ScheduleData }) {
  const openShift = useShiftEditor((s) => s.openShift);
  const issues = data.rangeIssues.filter((i) => data.employees.some((e) => e.id === i.employeeId));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Warnungen & Konflikte" description="Überschneidungen, Stundenlimits, Ruhezeiten und Abwesenheiten im sichtbaren Zeitraum.">
        {issues.length === 0 ? (
          <EmptyState icon={<CircleCheck />} title="Alles im grünen Bereich" description="Keine Konflikte im aktuellen Zeitraum." />
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {issues.map((issue) => {
              const employee = data.employeeMap.get(issue.employeeId);
              const target = issue.kind === "max_hours" ? null : issue.shiftIds[issue.shiftIds.length - 1];
              return (
                <li key={issue.id}>
                  <button
                    type="button"
                    disabled={!target}
                    onClick={() => {
                      if (!target) return;
                      onOpenChange(false);
                      openShift(target);
                    }}
                    className="flex w-full cursor-pointer items-start gap-3 py-2.5 text-left disabled:cursor-default"
                  >
                    <SeverityIcon severity={issue.severity} className="mt-1 size-4 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 text-[13px] font-medium">
                        {employee ? <Avatar name={employee.name} color={employee.color} size="sm" className="size-5 text-[9px]" /> : null}
                        {employee?.name}
                      </span>
                      <span className="block text-[13px] text-muted">{issue.message}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
