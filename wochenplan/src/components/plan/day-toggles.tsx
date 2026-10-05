"use client";

import { Check } from "lucide-react";
import type { DayIndex } from "@/lib/types";
import { cn } from "@/lib/utils";
import { DAY_INDICES, DAY_SHORT } from "@/lib/week";

/** Sieben große Tages-Schalter (Mo–So) mit optionaler Anzeige des aktuellen Werts. */
export function DayToggles({
  selected,
  onChange,
  disabledDay,
  values,
}: {
  selected: readonly DayIndex[];
  onChange: (days: DayIndex[]) => void;
  /** Ausgangstag beim Kopieren – nicht wählbar */
  disabledDay?: DayIndex;
  /** Aktueller Eintrag pro Tag (klein unter dem Tag) */
  values?: Partial<Record<DayIndex, string>>;
}) {
  const toggle = (day: DayIndex) => {
    onChange(selected.includes(day) ? selected.filter((d) => d !== day) : [...selected, day].sort((a, b) => a - b));
  };
  const selectable = DAY_INDICES.filter((d) => d !== disabledDay);
  const setDays = (days: DayIndex[]) => onChange(days.filter((d) => d !== disabledDay));

  return (
    <div className="flex flex-col gap-2.5">
      <div className="grid grid-cols-7 gap-1.5">
        {DAY_INDICES.map((day) => {
          const isSource = day === disabledDay;
          const active = selected.includes(day);
          return (
            <button
              key={day}
              type="button"
              disabled={isSource}
              onClick={() => toggle(day)}
              aria-pressed={active}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl border px-0.5 py-1.5 transition-colors",
                isSource && "border-dashed border-accent/50 bg-accent-soft text-accent",
                !isSource && active && "border-accent bg-accent text-white shadow-soft",
                !isSource && !active && "border-border-strong/70 bg-surface text-fg hover:border-accent",
              )}
            >
              <span className="flex items-center gap-0.5 text-[15px] font-semibold">
                {active && !isSource ? <Check className="size-3.5" strokeWidth={3} /> : null}
                {DAY_SHORT[day]}
              </span>
              {values ? (
                <span
                  className={cn(
                    "line-clamp-2 w-full text-center text-[10px] leading-tight break-words",
                    active && !isSource ? "text-white/85" : "text-muted",
                  )}
                >
                  {values[day] || "–"}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <QuickPick label="Mo–Fr" onClick={() => setDays([0, 1, 2, 3, 4])} />
        <QuickPick label="Sa + So" onClick={() => setDays([5, 6])} />
        <QuickPick label="Ganze Woche" onClick={() => setDays([...selectable])} />
        {selected.length > 0 ? <QuickPick label="Keine" onClick={() => onChange([])} /> : null}
      </div>
    </div>
  );
}

function QuickPick({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-9 rounded-full border border-border-strong/70 bg-surface px-3.5 text-sm font-medium text-muted transition-colors hover:border-accent hover:text-accent"
    >
      {label}
    </button>
  );
}
