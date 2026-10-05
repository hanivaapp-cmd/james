"use client";

import { FilePlus2, History, LayoutTemplate } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { countEntries, previousFilledWeek } from "@/lib/plan";
import { usePlanStore } from "@/lib/store";
import type { ISODate } from "@/lib/types";
import { cn } from "@/lib/utils";
import { relativeWeekName, shiftWeek, weekNumber, weekRangeShort, weekStartOf } from "@/lib/week";
import { applyTemplateToWeek, clearWholeWeek, takeOverPreviousWeek } from "./week-actions";

/**
 * „Wochenplan erstellen“: Woche wählen → letzte Woche übernehmen, Vorlage oder leer starten.
 */
export function NewWeekDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      {open ? <NewWeekBody onClose={onClose} /> : null}
    </Dialog>
  );
}

function NewWeekBody({ onClose }: { onClose: () => void }) {
  const weeks = usePlanStore((s) => s.weeks);
  const templates = usePlanStore((s) => s.templates);
  const currentWeek = usePlanStore((s) => s.currentWeek);
  const selectWeek = usePlanStore((s) => s.selectWeek);

  const options = [0, 1, 2, 3].map((n) => shiftWeek(currentWeek, n));
  const [target, setTarget] = useState<ISODate>(
    () => options.find((w) => countEntries(weeks[w]?.entries) === 0) ?? options[1],
  );
  const [showTemplates, setShowTemplates] = useState(false);
  const extraOption = options.includes(target) ? null : target;
  const source = previousFilledWeek(weeks, target);
  const targetFilled = countEntries(weeks[target]?.entries) > 0;

  const finish = async (action: () => Promise<boolean>) => {
    selectWeek(target);
    if (await action()) onClose();
  };

  return (
    <DialogContent size="lg" title="Wochenplan erstellen" description="In zwei Schritten zum fertigen Plan." onOpenAutoFocus={(e) => e.preventDefault()}>
      <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-3">
          <h3 className="text-[15px] font-semibold">1. Für welche Woche?</h3>
          <div className="grid grid-cols-2 gap-2">
            {[...options, ...(extraOption ? [extraOption] : [])].map((w) => {
              const count = countEntries(weeks[w]?.entries);
              const active = w === target;
              return (
                <button
                  key={w}
                  type="button"
                  onClick={() => setTarget(w)}
                  aria-pressed={active}
                  className={cn(
                    "flex flex-col items-start rounded-2xl border-2 px-3 py-2.5 text-left transition-colors sm:px-4 sm:py-3",
                    active ? "border-accent bg-accent-soft" : "border-border bg-surface hover:border-border-strong",
                  )}
                >
                  <span className="flex w-full flex-wrap items-baseline gap-x-2">
                    <span className={cn("text-base font-semibold", active && "text-accent")}>KW {weekNumber(w)}</span>
                    <span className="text-xs text-muted sm:text-sm">{relativeWeekName(w, currentWeek)}</span>
                  </span>
                  <span className="tabular text-sm sm:text-[15px]">{weekRangeShort(w)}</span>
                  <span className={cn("mt-1 text-xs font-medium", count > 0 ? "text-warning" : "text-success")}>
                    {count > 0 ? `Schon geplant (${count})` : "Noch leer"}
                  </span>
                </button>
              );
            })}
          </div>
          <label className="flex flex-wrap items-center gap-2 text-sm text-muted">
            Andere Woche:
            <input
              type="date"
              className="h-10 rounded-xl border border-border-strong/70 bg-surface px-3 text-[15px] text-fg"
              onChange={(e) => e.target.value && setTarget(weekStartOf(new Date(`${e.target.value}T12:00:00`)))}
            />
          </label>
        </section>

        <section className="flex flex-col gap-3">
          <h3 className="text-[15px] font-semibold">2. Wie möchtest du starten?</h3>
          <div className="flex flex-col gap-2.5">
            <Choice
              icon={<History />}
              title={source && source.weekStart === shiftWeek(target, -1) ? "Letzte Woche übernehmen" : "Letzten Plan übernehmen"}
              text={
                source
                  ? `Kopiert KW ${weekNumber(source.weekStart)} (${weekRangeShort(source.weekStart)}). Danach nur noch Änderungen anpassen.`
                  : "Es gibt noch keine frühere Woche mit Einträgen."
              }
              recommended={Boolean(source)}
              disabled={!source}
              onClick={() => finish(() => takeOverPreviousWeek(target))}
            />
            <Choice
              icon={<LayoutTemplate />}
              title="Vorlage verwenden"
              text={
                templates.length > 0
                  ? templates.map((t) => t.name).join(", ")
                  : "Noch keine Vorlage gespeichert – geht über „Mehr“ → „Als Vorlage speichern“."
              }
              disabled={templates.length === 0}
              onClick={() => (templates.length === 1 ? finish(() => applyTemplateToWeek(templates[0].id, target)) : setShowTemplates((v) => !v))}
            />
            {showTemplates && templates.length > 1 ? (
              <div className="ml-4 flex flex-wrap gap-2 border-l-2 border-accent/30 pl-4">
                {templates.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => finish(() => applyTemplateToWeek(t.id, target))}
                    className="h-11 rounded-xl border border-border-strong/70 bg-surface px-4 text-[15px] font-medium hover:border-accent hover:text-accent"
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            ) : null}
            <Choice
              icon={<FilePlus2 />}
              title={targetFilled ? "Leer neu beginnen" : "Mit leerem Plan starten"}
              text={targetFilled ? "Löscht die vorhandenen Einträge dieser Woche." : "Alle Zeiten selbst eintragen."}
              onClick={() => finish(async () => (targetFilled ? clearWholeWeek(target) : true))}
            />
          </div>
        </section>
      </div>
    </DialogContent>
  );
}

function Choice({
  icon,
  title,
  text,
  onClick,
  disabled,
  recommended,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  onClick: () => void;
  disabled?: boolean;
  recommended?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center gap-4 rounded-2xl border-2 px-4 py-3.5 text-left transition-colors disabled:opacity-50",
        recommended ? "border-accent/40 bg-accent-soft/50 hover:border-accent" : "border-border bg-surface hover:border-border-strong",
      )}
    >
      <span
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-xl [&_svg]:size-5",
          recommended ? "bg-accent text-white" : "bg-surface-3 text-fg",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 text-base font-semibold">
          {title}
          {recommended ? (
            <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-white">Empfohlen</span>
          ) : null}
        </span>
        <span className="block text-sm text-muted">{text}</span>
      </span>
    </button>
  );
}
