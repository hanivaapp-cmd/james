"use client";

import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { usePlanStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { relativeWeekName, shiftWeek, weekNumber, weekRangeLong, weekStartOf } from "@/lib/week";

/** Wochenauswahl: Vorherige/Nächste Woche und Sprung zu einem beliebigen Datum. */
export function WeekPicker({ className }: { className?: string }) {
  const selectedWeek = usePlanStore((s) => s.selectedWeek);
  const currentWeek = usePlanStore((s) => s.currentWeek);
  const selectWeek = usePlanStore((s) => s.selectWeek);
  const dateInput = useRef<HTMLInputElement>(null);
  const relative = relativeWeekName(selectedWeek, currentWeek);

  const openPicker = () => {
    const input = dateInput.current;
    if (!input) return;
    try {
      input.showPicker();
    } catch {
      input.focus();
      input.click();
    }
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-stretch gap-1.5 rounded-2xl border border-border bg-surface p-1.5 shadow-card sm:gap-2 sm:p-2">
        <Button
          variant="ghost"
          size="lg"
          onClick={() => selectWeek(shiftWeek(selectedWeek, -1))}
          className="h-auto min-h-14 px-3 text-fg sm:px-4"
          aria-label="Vorherige Woche"
        >
          <ChevronLeft />
          <span className="hidden sm:inline">Vorherige Woche</span>
        </Button>

        <button
          type="button"
          onClick={openPicker}
          className="relative flex min-w-0 flex-1 flex-col items-center justify-center rounded-xl px-2 py-1.5 transition-colors hover:bg-surface-3"
          title="Woche über Kalender auswählen"
        >
          <span className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-accent uppercase sm:text-[13px]">
            <CalendarDays className="size-3.5" />
            KW {weekNumber(selectedWeek)}
            {relative ? <span className="text-muted">· {relative}</span> : null}
          </span>
          <span className="tabular text-[17px] font-semibold tracking-tight sm:text-xl">{weekRangeLong(selectedWeek)}</span>
          <input
            ref={dateInput}
            type="date"
            tabIndex={-1}
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-0 w-full opacity-0"
            value={selectedWeek}
            onChange={(e) => {
              if (e.target.value) selectWeek(weekStartOf(new Date(`${e.target.value}T12:00:00`)));
            }}
          />
        </button>

        <Button
          variant="ghost"
          size="lg"
          onClick={() => selectWeek(shiftWeek(selectedWeek, 1))}
          className="h-auto min-h-14 px-3 text-fg sm:px-4"
          aria-label="Nächste Woche"
        >
          <span className="hidden sm:inline">Nächste Woche</span>
          <ChevronRight />
        </Button>
      </div>
      {selectedWeek !== currentWeek ? (
        <button
          type="button"
          onClick={() => selectWeek(currentWeek)}
          className="self-center text-sm font-medium text-accent hover:underline"
        >
          Zurück zur aktuellen Woche
        </button>
      ) : null}
    </div>
  );
}
