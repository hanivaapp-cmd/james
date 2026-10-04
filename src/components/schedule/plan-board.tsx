"use client";

import {
  DndContext,
  DragOverlay,
  MouseSensor,
  pointerWithin,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { actions, useAppStore } from "@/lib/store/app-store";
import { useViewStore } from "@/lib/store/view-store";
import { fmt } from "@/lib/schedule/dates";
import { cn } from "@/lib/utils";
import { Users } from "lucide-react";
import { useShiftEditor } from "./editor-store";
import { MonthView } from "./month-view";
import { ShiftChipView } from "./shift-chip";
import { PaletteItemView, ShiftPalette } from "./shift-palette";
import type { ScheduleData } from "./use-schedule-data";
import { WeekView } from "./week-view";

type DragData = { kind: "shift"; shiftId: string } | { kind: "template"; shiftTypeId: string };
type DropData = { kind: "cell"; employeeId: string; date: string } | { kind: "day"; date: string };

/** Plan mit Drag-and-Drop: Schichten verschieben (Alt/⌥ = kopieren) und Vorlagen einfügen. */
export function PlanBoard({
  data,
  editable,
  showCost,
  onOpenDay,
}: {
  data: ScheduleData;
  editable: boolean;
  showCost: boolean;
  onOpenDay: (date: string) => void;
}) {
  const [active, setActive] = useState<DragData | null>(null);
  const altPressed = useRef(false);
  const openNew = useShiftEditor((s) => s.openNew);
  const resetFilters = useViewStore((s) => s.resetFilters);
  const totalEmployees = useAppStore((s) => Object.keys(s.employees).length);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => (altPressed.current = e.altKey);
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
    };
  }, []);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
  );

  const onDragStart = (event: DragStartEvent) => {
    setActive(event.active.data.current as DragData);
    if ("vibrate" in navigator) navigator.vibrate?.(10);
  };

  const onDragEnd = (event: DragEndEvent) => {
    setActive(null);
    const drag = event.active.data.current as DragData | undefined;
    const drop = event.over?.data.current as DropData | undefined;
    if (!drag || !drop) return;

    if (drag.kind === "shift") {
      const shift = useAppStore.getState().shifts[drag.shiftId];
      if (!shift) return;
      const employee_id = drop.kind === "cell" ? drop.employeeId : shift.employee_id;
      const date = drop.date;
      if (altPressed.current) {
        const { id: _id, ...rest } = shift;
        void _id;
        void actions.createShifts([{ ...rest, employee_id, date }], { undo: true });
        return;
      }
      if (employee_id === shift.employee_id && date === shift.date) return;
      const name = data.employeeMap.get(employee_id)?.name ?? "";
      void actions.updateShift(
        shift.id,
        { employee_id, date },
        { undoLabel: `Schicht verschoben → ${name.split(" ")[0]}, ${fmt(date, "EEE d.M.")}` },
      );
      return;
    }

    const type = data.shiftTypesTable[drag.shiftTypeId];
    if (!type) return;
    const base = {
      shift_type_id: type.id,
      date: drop.date,
      start_time: type.default_start,
      end_time: type.default_end,
      break_minutes: type.default_break_minutes,
      location: null,
      notes: null,
    };
    if (drop.kind === "cell") {
      void actions.createShifts([{ ...base, employee_id: drop.employeeId }], { undo: true });
    } else {
      openNew(base);
      toast.info("Mitarbeiter auswählen", { description: "In der Monatsansicht bitte noch den Mitarbeiter wählen." });
    }
  };

  const activeShift = active?.kind === "shift" ? useAppStore.getState().shifts[active.shiftId] : undefined;
  const activeType = active?.kind === "template" ? data.shiftTypesTable[active.shiftTypeId] : undefined;

  const empty = data.employees.length === 0;

  return (
    <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActive(null)}>
      {editable && !empty ? (
        <div className="hidden items-center gap-3 border-t border-border bg-bg px-4 py-2 sm:px-6 md:flex">
          <ShiftPalette types={data.shiftTypes} />
          <span className="ml-auto hidden shrink-0 text-xs text-subtle xl:inline">
            Schichten ziehen zum Verschieben · mit <kbd className="rounded border border-border bg-surface px-1 font-sans">Alt</kbd> kopieren
          </span>
        </div>
      ) : null}
      <div
        className={cn(
          "scrollbar-thin relative min-h-0 flex-1 overflow-auto border-t border-border bg-surface",
          data.loading && "opacity-70",
        )}
      >
        {data.loading ? (
          <div className="absolute top-3 right-3 z-30 rounded-full bg-surface p-1.5 shadow-pop">
            <Spinner />
          </div>
        ) : null}
        {empty ? (
          <EmptyState
            icon={<Users />}
            title={totalEmployees === 0 ? "Noch keine Mitarbeiter" : "Keine Treffer"}
            description={
              totalEmployees === 0
                ? "Legen Sie zuerst Ihr Team an – danach können Sie Schichten planen."
                : "Kein Mitarbeiter passt zur Suche oder zu den Filtern."
            }
            action={
              totalEmployees === 0 ? (
                <a href="/employees" className="text-sm font-medium text-accent hover:underline">
                  Mitarbeiter anlegen →
                </a>
              ) : (
                <button type="button" onClick={resetFilters} className="cursor-pointer text-sm font-medium text-accent hover:underline">
                  Filter zurücksetzen
                </button>
              )
            }
          />
        ) : data.view === "week" ? (
          <WeekView data={data} editable={editable} showCost={showCost} />
        ) : (
          <MonthView data={data} editable={editable} onOpenDay={onOpenDay} />
        )}
      </div>
      <DragOverlay dropAnimation={null}>
        {activeShift ? (
          <div className="w-36">
            <ShiftChipView
              overlay
              shift={activeShift}
              type={activeShift.shift_type_id ? data.shiftTypesTable[activeShift.shift_type_id] : undefined}
              employee={data.employeeMap.get(activeShift.employee_id)}
              variant={data.view === "week" ? "full" : "compact"}
            />
          </div>
        ) : activeType ? (
          <PaletteItemView type={activeType} overlay />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
