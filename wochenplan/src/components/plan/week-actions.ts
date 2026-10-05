"use client";

import { toast } from "sonner";
import { confirmAction } from "@/components/ui/confirm";
import { countEntries, previousFilledWeek } from "@/lib/plan";
import { usePlanStore } from "@/lib/store";
import type { ISODate, WeekPlan } from "@/lib/types";
import { weekLabel, weekNumber } from "@/lib/week";

/**
 * Wochen-Aktionen mit Sicherheitsabfrage (falls schon etwas eingetragen ist)
 * und „Rückgängig“-Knopf in der Bestätigung.
 */

function undoAction(weekStart: ISODate, previous: WeekPlan | undefined) {
  return {
    label: "Rückgängig",
    onClick: () => usePlanStore.getState().restoreWeek(weekStart, previous),
  };
}

async function confirmOverwrite(weekStart: ISODate, replacement: string): Promise<boolean> {
  const week = usePlanStore.getState().weeks[weekStart];
  if (countEntries(week?.entries) === 0) return true;
  return confirmAction({
    title: "Vorhandene Einträge ersetzen?",
    description: `${weekLabel(weekStart)} hat bereits Einträge. Sie werden durch ${replacement} ersetzt. Notizen bleiben erhalten.`,
    confirmLabel: "Ersetzen",
    destructive: true,
  });
}

export async function takeOverPreviousWeek(weekStart: ISODate): Promise<boolean> {
  const state = usePlanStore.getState();
  const source = previousFilledWeek(state.weeks, weekStart);
  if (!source) {
    toast("Es gibt noch keine frühere Woche mit Einträgen.");
    return false;
  }
  if (!(await confirmOverwrite(weekStart, `den Plan von KW ${weekNumber(source.weekStart)}`))) return false;
  const result = state.copyFromPreviousWeek(weekStart);
  if (!result) return false;
  toast.success(`Plan von KW ${weekNumber(source.weekStart)} übernommen`, {
    description: "Jetzt nur noch die Änderungen anpassen.",
    action: undoAction(weekStart, result.previous),
  });
  return true;
}

export async function applyTemplateToWeek(templateId: string, weekStart: ISODate): Promise<boolean> {
  const state = usePlanStore.getState();
  const template = state.templates.find((t) => t.id === templateId);
  if (!template) return false;
  if (!(await confirmOverwrite(weekStart, `die Vorlage „${template.name}“`))) return false;
  const previous = state.applyTemplate(templateId, weekStart);
  toast.success(`Vorlage „${template.name}“ übernommen`, { action: undoAction(weekStart, previous) });
  return true;
}

export async function clearWholeWeek(weekStart: ISODate): Promise<boolean> {
  const ok = await confirmAction({
    title: "Woche leeren?",
    description: `Alle Einträge und Notizen von ${weekLabel(weekStart)} werden entfernt.`,
    confirmLabel: "Woche leeren",
    destructive: true,
  });
  if (!ok) return false;
  const previous = usePlanStore.getState().clearWeek(weekStart);
  toast("Woche geleert", { action: undoAction(weekStart, previous) });
  return true;
}
