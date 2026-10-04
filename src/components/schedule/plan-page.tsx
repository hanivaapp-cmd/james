"use client";

import { Plus, Share2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/lib/hooks/use-permissions";
import { formatRangeLabel, todayISO } from "@/lib/schedule/dates";
import type { ExportInput } from "@/lib/schedule/export-model";
import { useAppStore } from "@/lib/store/app-store";
import { useViewStore } from "@/lib/store/view-store";
import { DaySheet } from "./day-sheet";
import { useShiftEditor } from "./editor-store";
import { ExportMenu } from "./export-menu";
import { IssuesDialog } from "./issues-dialog";
import { PlanBoard } from "./plan-board";
import { ScheduleToolbar } from "./schedule-toolbar";
import { ShareDialog } from "./share-dialog";
import { ShiftEditor } from "./shift-editor";
import { SummaryBar } from "./summary-bar";
import { useScheduleData } from "./use-schedule-data";

export function PlanPage() {
  const data = useScheduleData();
  const { canEditSchedule, canSeeCosts } = usePermissions();
  const openNew = useShiftEditor((s) => s.openNew);
  const setDate = useViewStore((s) => s.setDate);
  const [issuesOpen, setIssuesOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [dayOpen, setDayOpen] = useState<string | null>(null);
  const params = useSearchParams();

  useEffect(() => {
    const date = params.get("date");
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) setDate(date);
  }, [params, setDate]);

  const getExportInput = (): ExportInput => ({
    title: `Dienstplan ${formatRangeLabel(data.view, data.date)}`,
    from: data.core.from,
    to: data.core.to,
    employees: data.employees,
    shifts: data.visibleShifts,
    shiftTypes: data.shiftTypesTable,
    absences: Object.values(useAppStore.getState().absences),
    includeCosts: canSeeCosts,
  });

  const filtered = data.employees.length !== [...data.employeeMap.values()].filter((e) => e.active).length;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="Dienstplan"
        actions={
          <>
            <ExportMenu getInput={getExportInput} />
            {canEditSchedule ? (
              <Button onClick={() => setShareOpen(true)} aria-label="Teilen" className="max-sm:w-9 max-sm:px-0">
                <Share2 /> <span className="max-sm:hidden">Teilen</span>
              </Button>
            ) : null}
            {canEditSchedule ? (
              <Button variant="primary" onClick={() => openNew({ date: data.view === "week" && data.days.includes(todayISO()) ? todayISO() : data.core.from })}>
                <Plus /> Schicht
              </Button>
            ) : null}
          </>
        }
      >
        <div className="mt-3 flex flex-col gap-3 sm:mt-4">
          <ScheduleToolbar positions={data.positionsList} shiftTypes={data.shiftTypes} editable={canEditSchedule} />
          <SummaryBar data={data} showCost={canSeeCosts} onShowIssues={() => setIssuesOpen(true)} />
        </div>
      </PageHeader>

      <PlanBoard data={data} editable={canEditSchedule} showCost={canSeeCosts} onOpenDay={setDayOpen} />

      <ShiftEditor locations={data.locations} />
      <IssuesDialog open={issuesOpen} onOpenChange={setIssuesOpen} data={data} />
      <DaySheet date={dayOpen} onClose={() => setDayOpen(null)} data={data} editable={canEditSchedule} />
      {canEditSchedule ? (
        <ShareDialog
          open={shareOpen}
          onOpenChange={setShareOpen}
          getInput={getExportInput}
          employeeIds={filtered ? data.employees.map((e) => e.id) : null}
        />
      ) : null}
    </div>
  );
}
