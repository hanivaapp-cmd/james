"use client";

import { CornerDownLeft } from "lucide-react";
import { useMemo, useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { fieldClass } from "@/components/ui/input";
import { DEFAULT_QUICK_TIMES, frequentCells, sortSuggestions } from "@/lib/plan";
import { usePlanStore } from "@/lib/store";
import { cellProblems, formatCell, parseCell } from "@/lib/time-entry";
import type { Cell } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface Suggestion {
  label: string;
  cell: Cell;
}

const OFF: Suggestion = { label: "Frei", cell: [{ kind: "off" }] };
const UNTIL_CLOSE: Suggestion = { label: "Bis Ende", cell: [{ kind: "shift", start: null, end: null, untilClose: true }] };

/** Schnellbuttons: die häufigsten Zeiten (inkl. der typischen Zeit dieses Mitarbeiters), chronologisch sortiert. */
export function useQuickTimes(employeeId?: string): Suggestion[] {
  const weeks = usePlanStore((s) => s.weeks);
  const templates = usePlanStore((s) => s.templates);
  return useMemo(() => {
    const list = frequentCells(Object.values(weeks), templates, { limit: 7 });
    if (employeeId) {
      for (const own of frequentCells(Object.values(weeks), templates, { limit: 2, employeeId })) {
        if (!list.some((s) => s.label === own.label)) list.push(own);
      }
    }
    for (const label of DEFAULT_QUICK_TIMES) {
      if (list.length >= 6) break;
      const parsed = parseCell(label);
      if (parsed.ok && !list.some((s) => s.label === label)) list.push({ label, cell: parsed.cell });
    }
    return [OFF, UNTIL_CLOSE, ...sortSuggestions(list)];
  }, [weeks, templates, employeeId]);
}

export function QuickButtons({
  suggestions,
  selected,
  onPick,
}: {
  suggestions: Suggestion[];
  /** Beschriftung des aktuell gewählten Werts (wird hervorgehoben) */
  selected?: string;
  onPick: (s: Suggestion) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 min-[400px]:grid-cols-3 sm:grid-cols-4">
      {suggestions.map((s) => {
        const active = s.label === selected;
        return (
          <button
            key={s.label}
            type="button"
            onClick={() => onPick(s)}
            className={cn(
              "flex min-h-13 items-center justify-center rounded-xl border px-2 py-2 text-center text-[15px] leading-tight font-semibold transition-colors",
              active
                ? "border-accent bg-accent text-white shadow-soft"
                : s.label === "Frei"
                  ? "border-border-strong/70 bg-surface-2 text-muted hover:border-border-strong hover:text-fg"
                  : "border-border-strong/70 bg-surface text-fg shadow-soft hover:border-accent hover:bg-accent-soft hover:text-accent",
            )}
          >
            {s.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Freie Eingabe mit Live-Vorschau: „11:30-18“ → „11:30h bis 18h“.
 */
export function CustomTimeInput({
  initial = "",
  id = "custom-time",
  onSubmit,
  submitLabel = "Übernehmen",
  onChange,
}: {
  initial?: string;
  id?: string;
  onSubmit: (cell: Cell) => void;
  submitLabel?: string;
  /** Meldet jede gültige Eingabe (für Dialoge mit eigenem Speichern-Button) */
  onChange?: (cell: Cell | null) => void;
}) {
  const [value, setValue] = useState(initial);
  const result = useMemo(() => parseCell(value), [value]);
  const preview = result.ok ? formatCell(result.cell) : "";
  const problems = result.ok ? cellProblems(result.cell) : [];
  const touched = value.trim() !== initial.trim();

  const submit = () => {
    if (result.ok) onSubmit(result.cell);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      submit();
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium text-fg">
        Eigene Zeit eingeben
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          onFocus={(e) => e.currentTarget.select()}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            const r = parseCell(e.target.value);
            onChange?.(r.ok && e.target.value.trim() ? r.cell : null);
          }}
          onKeyDown={onKeyDown}
          placeholder="z. B. 16 oder 11:30-18"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="done"
          aria-invalid={!result.ok}
          className={cn(fieldClass, "h-13 min-w-0 flex-1 text-[17px]")}
        />
        <Button variant="primary" size="lg" onClick={submit} disabled={!result.ok || !touched} className="px-4">
          <CornerDownLeft className="hidden sm:block" />
          {submitLabel}
        </Button>
      </div>
      <div className="min-h-5 text-sm">
        {!result.ok ? (
          <span className="text-danger">{result.error}</span>
        ) : value.trim() && touched ? (
          <span className="text-muted">
            Wird eingetragen als: <b className="font-semibold text-accent">{preview}</b>
            {problems.length > 0 ? <span className="ml-2 text-warning">· {problems.join(", ")}</span> : null}
          </span>
        ) : (
          <span className="text-subtle">Beispiele: 16 · 11:30-18 · 16-ende · frei · Urlaub</span>
        )}
      </div>
    </div>
  );
}
