"use client";

import { Check, CheckCircle2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { getCell, rowsForWeek } from "@/lib/plan";
import { usePlanStore, type CellChange } from "@/lib/store";
import { formatCell } from "@/lib/time-entry";
import type { Cell, DayIndex, ISODate } from "@/lib/types";
import { cn } from "@/lib/utils";
import { DAY_INDICES, describeDays, weekLabel } from "@/lib/week";
import { DayToggles } from "./day-toggles";
import { CustomTimeInput, QuickButtons, useQuickTimes } from "./time-chooser";

/**
 * „Arbeitszeit eintragen“: Mitarbeiter wählen → Tage wählen → Zeit wählen → fertig.
 * Ideal für „Simbat arbeitet Mo–Fr 12:30h bis 18h“.
 */
export function BulkEntryDialog({
  weekStart,
  open,
  initialEmployeeId,
  onClose,
}: {
  weekStart: ISODate;
  open: boolean;
  initialEmployeeId?: string;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      {open ? <BulkBody weekStart={weekStart} initialEmployeeId={initialEmployeeId} onClose={onClose} /> : null}
    </Dialog>
  );
}

function BulkBody({ weekStart, initialEmployeeId, onClose }: { weekStart: ISODate; initialEmployeeId?: string; onClose: () => void }) {
  const employees = usePlanStore((s) => s.employees);
  const week = usePlanStore((s) => s.weeks[weekStart]);
  const setCells = usePlanStore((s) => s.setCells);
  const restoreWeek = usePlanStore((s) => s.restoreWeek);
  const groups = rowsForWeek(employees, week).map((g) => ({ ...g, employees: g.employees.filter((e) => e.active && !e.deleted) }));

  const [selected, setSelected] = useState<string[]>(initialEmployeeId ? [initialEmployeeId] : []);
  const [days, setDays] = useState<DayIndex[]>([]);
  const [time, setTime] = useState<{ label: string; cell: Cell } | null>(null);
  const [inputKey, setInputKey] = useState(0);
  const [done, setDone] = useState<string[]>([]);
  const suggestions = useQuickTimes(selected.length === 1 ? selected[0] : undefined);

  const single = selected.length === 1 ? selected[0] : null;
  const dayValues = single ? Object.fromEntries(DAY_INDICES.map((d) => [d, formatCell(getCell(week, single, d))])) : undefined;
  const names = selected.map((id) => employees.find((e) => e.id === id)?.name ?? "").filter(Boolean);
  const ready = selected.length > 0 && days.length > 0 && time !== null;

  const toggleEmployee = (id: string) =>
    setSelected((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));

  const apply = (cell = time?.cell, label = time?.label) => {
    if (!cell || !label) return;
    if (selected.length === 0 || days.length === 0) {
      toast.error(selected.length === 0 ? "Bitte zuerst auswählen, für wen." : "Bitte zuerst die Tage auswählen.");
      return;
    }
    const before = usePlanStore.getState().weeks[weekStart];
    const changes: CellChange[] = selected.flatMap((employeeId) => days.map((day) => ({ employeeId, day, cell })));
    setCells(weekStart, changes);
    toast.success(`${names.join(", ")}: ${describeDays(days)} → ${label}`, {
      action: { label: "Rückgängig", onClick: () => restoreWeek(weekStart, before) },
    });
    setDone((d) => [...new Set([...d, ...selected])]);
    setSelected([]);
    setTime(null);
    setInputKey((k) => k + 1);
  };

  return (
    <DialogContent
      size="xl"
      title="Arbeitszeit eintragen"
      description={`${weekLabel(weekStart)} – für eine oder mehrere Personen an mehreren Tagen`}
      onOpenAutoFocus={(e) => e.preventDefault()}
      footer={
        <>
          {ready ? (
            <div className="w-full min-w-0 text-sm text-muted sm:w-auto sm:flex-1">
              <b className="text-fg">{names.join(", ")}</b> · {describeDays(days)} · <b className="text-accent">{time?.label}</b>
            </div>
          ) : (
            <div className="hidden flex-1 text-sm text-muted sm:block">Wer · Welche Tage · Welche Zeit</div>
          )}
          <Button variant="ghost" onClick={onClose} className="flex-1 sm:flex-none">
            Fertig
          </Button>
          <Button variant="primary" onClick={() => apply()} disabled={!ready} className="flex-[2] sm:flex-none">
            <Check /> Eintragen
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <Step number={1} title="Wer?" hint="Mehrere möglich">
          <div className="flex flex-col gap-3">
            {groups.map((group) =>
              group.employees.length > 0 ? (
                <div key={group.id} className="flex flex-col gap-1.5">
                  <div className="text-xs font-bold tracking-[0.12em] text-cream-fg uppercase">{group.label}</div>
                  <div className="flex flex-wrap gap-2">
                    {group.employees.map((e) => {
                      const active = selected.includes(e.id);
                      return (
                        <button
                          key={e.id}
                          type="button"
                          onClick={() => toggleEmployee(e.id)}
                          aria-pressed={active}
                          className={cn(
                            "flex h-11 items-center gap-1.5 rounded-xl border px-3.5 text-[15px] font-medium transition-colors",
                            active
                              ? "border-accent bg-accent text-white shadow-soft"
                              : "border-border-strong/70 bg-surface hover:border-accent",
                          )}
                        >
                          {active ? <Check className="size-4" strokeWidth={3} /> : null}
                          {e.name}
                          {!active && done.includes(e.id) ? <CheckCircle2 className="size-4 text-success" /> : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null,
            )}
          </div>
        </Step>

        <Step number={2} title="Welche Tage?">
          <DayToggles selected={days} onChange={setDays} values={dayValues} />
        </Step>

        <Step number={3} title="Welche Zeit?">
          <div className="flex flex-col gap-4">
            <QuickButtons suggestions={suggestions} selected={time?.label} onPick={(s) => setTime(s)} />
            <CustomTimeInput
              key={inputKey}
              id="bulk-time"
              submitLabel="Eintragen"
              onChange={(cell) => setTime(cell ? { cell, label: formatCell(cell) } : null)}
              onSubmit={(cell) => apply(cell, formatCell(cell))}
            />
          </div>
        </Step>
      </div>
    </DialogContent>
  );
}

function Step({ number, title, hint, children }: { number: number; title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="flex items-center gap-2.5 text-[15px] font-semibold">
        <span className="flex size-7 items-center justify-center rounded-full bg-accent-soft text-sm font-bold text-accent">{number}</span>
        {title}
        {hint ? <span className="text-sm font-normal text-muted">({hint})</span> : null}
      </h3>
      {children}
    </section>
  );
}
