"use client";

import { Copy, Eraser } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useCoarsePointer } from "@/lib/hooks";
import { getCell } from "@/lib/plan";
import { areaLabel } from "@/lib/areas";
import { usePlanStore } from "@/lib/store";
import { cellProblems, formatCell } from "@/lib/time-entry";
import type { Cell, DayIndex, Employee, ISODate } from "@/lib/types";
import { DAY_INDICES, DAY_NAMES, dayDate, describeDays, shortDate } from "@/lib/week";
import { DayToggles } from "./day-toggles";
import { CustomTimeInput, QuickButtons, useQuickTimes } from "./time-chooser";

export interface EditorTarget {
  employee: Employee;
  day: DayIndex;
}

/**
 * Eingabe für eine Zelle: Schnellbuttons (1 Tipp = fertig), eigene Zeit, Kopieren auf andere Tage.
 */
export function EntryEditor({
  weekStart,
  target,
  onClose,
}: {
  weekStart: ISODate;
  target: EditorTarget | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={Boolean(target)} onOpenChange={(open) => !open && onClose()}>
      {target ? (
        <EditorBody key={`${target.employee.id}-${target.day}`} weekStart={weekStart} target={target} onClose={onClose} />
      ) : null}
    </Dialog>
  );
}

function EditorBody({ weekStart, target, onClose }: { weekStart: ISODate; target: EditorTarget; onClose: () => void }) {
  const { employee, day } = target;
  const week = usePlanStore((s) => s.weeks[weekStart]);
  const setCells = usePlanStore((s) => s.setCells);
  const copyCellToDays = usePlanStore((s) => s.copyCellToDays);
  const suggestions = useQuickTimes(employee.id);
  const coarse = useCoarsePointer();
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyDays, setCopyDays] = useState<DayIndex[]>([]);
  const copyPanel = useRef<HTMLElement>(null);

  // Aufgeklappten Kopieren-Bereich ins Bild holen (auf dem Handy liegt er sonst unterhalb).
  useEffect(() => {
    // Nur den Dialog scrollen, nicht die Seite dahinter.
    const box = copyOpen ? copyPanel.current?.closest(".overflow-y-auto") : null;
    box?.scrollTo({ top: box.scrollHeight, behavior: "smooth" });
  }, [copyOpen]);

  const current = getCell(week, employee.id, day);
  const currentLabel = formatCell(current);
  const problems = cellProblems(current);

  const save = (cell: Cell) => {
    setCells(weekStart, [{ employeeId: employee.id, day, cell }]);
    onClose();
  };

  const applyCopy = () => {
    if (copyDays.length === 0) return;
    copyCellToDays(weekStart, employee.id, day, copyDays);
    toast.success(`${employee.name}: „${currentLabel}“ kopiert auf ${describeDays(copyDays)}`);
    onClose();
  };

  const rowValues = Object.fromEntries(DAY_INDICES.map((d) => [d, formatCell(getCell(week, employee.id, d))]));

  return (
    <DialogContent
      size="lg"
      title={employee.name}
      description={`${DAY_NAMES[day]}, ${shortDate(dayDate(weekStart, day))} · ${areaLabel(employee.area)}`}
      onOpenAutoFocus={(e) => {
        // Am PC direkt lostippen („16“ + Enter). Auf dem Handy nicht sofort die Tastatur öffnen –
        // die Schnellbuttons reichen meistens.
        e.preventDefault();
        if (!coarse) document.getElementById("custom-time")?.focus();
      }}
    >
      <div className="flex flex-col gap-5">
        {currentLabel ? (
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-surface-2 px-4 py-3">
            <div>
              <div className="text-xs font-medium tracking-wide text-muted uppercase">Aktuell</div>
              <div className="text-lg font-semibold">{currentLabel}</div>
              {problems.length > 0 ? <div className="text-sm text-warning">{problems.join(", ")}</div> : null}
            </div>
          </div>
        ) : null}

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium text-fg">Schnell auswählen</h3>
          <QuickButtons suggestions={suggestions} selected={currentLabel} onPick={(s) => save(s.cell)} />
        </section>

        <CustomTimeInput initial={currentLabel} onSubmit={save} />

        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          <Button
            variant={copyOpen ? "soft" : "secondary"}
            onClick={() => setCopyOpen((v) => !v)}
            disabled={!currentLabel}
            className="flex-1 sm:flex-none"
          >
            <Copy /> Auf andere Tage kopieren
          </Button>
          <Button variant="danger-ghost" onClick={() => save([])} disabled={!currentLabel} className="flex-1 sm:flex-none">
            <Eraser /> Leeren
          </Button>
        </div>

        {copyOpen && currentLabel ? (
          <section ref={copyPanel} className="flex flex-col gap-3 rounded-2xl border border-accent/25 bg-accent-soft/60 p-4">
            <p className="text-[15px]">
              <b>„{currentLabel}“</b> von {DAY_NAMES[day]} kopieren nach:
            </p>
            <DayToggles selected={copyDays} onChange={setCopyDays} disabledDay={day} values={rowValues} />
            <Button variant="primary" size="lg" onClick={applyCopy} disabled={copyDays.length === 0}>
              <Copy /> Übernehmen{copyDays.length > 0 ? ` (${describeDays(copyDays)})` : ""}
            </Button>
          </section>
        ) : null}
      </div>
    </DialogContent>
  );
}
