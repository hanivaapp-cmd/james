"use client";

import { LayoutTemplate } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { confirmAction } from "@/components/ui/confirm";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { countEntries } from "@/lib/plan";
import { usePlanStore } from "@/lib/store";
import type { ISODate } from "@/lib/types";
import { weekLabel } from "@/lib/week";
import { applyTemplateToWeek } from "./week-actions";

export function SaveTemplateDialog({ weekStart, open, onClose }: { weekStart: ISODate; open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      {open ? <SaveBody weekStart={weekStart} onClose={onClose} /> : null}
    </Dialog>
  );
}

function SaveBody({ weekStart, onClose }: { weekStart: ISODate; onClose: () => void }) {
  const templates = usePlanStore((s) => s.templates);
  const saveTemplate = usePlanStore((s) => s.saveTemplate);
  const deleteTemplate = usePlanStore((s) => s.deleteTemplate);
  const [name, setName] = useState(templates.length === 0 ? "Normale Woche" : "");

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const existing = templates.find((t) => t.name.toLowerCase() === trimmed.toLowerCase());
    if (existing) {
      const ok = await confirmAction({
        title: `Vorlage „${existing.name}“ ersetzen?`,
        description: "Die bestehende Vorlage wird mit dem Plan dieser Woche überschrieben.",
        confirmLabel: "Ersetzen",
      });
      if (!ok) return;
      deleteTemplate(existing.id);
    }
    saveTemplate(trimmed, weekStart);
    toast.success(`Vorlage „${trimmed}“ gespeichert`, {
      description: "Beim nächsten „Wochenplan erstellen“ auswählbar.",
    });
    onClose();
  };

  return (
    <DialogContent
      size="sm"
      title="Als Vorlage speichern"
      description={`Speichert alle Zeiten aus ${weekLabel(weekStart)} als wiederverwendbare Vorlage.`}
      footer={
        <div className="flex w-full justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          <Button variant="primary" onClick={save} disabled={!name.trim()}>
            Speichern
          </Button>
        </div>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <Field label="Name der Vorlage" htmlFor="template-name">
          <Input
            id="template-name"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="z. B. Normale Woche, Sommer, Ramadan"
          />
        </Field>
      </form>
    </DialogContent>
  );
}

export function ApplyTemplateDialog({ weekStart, open, onClose }: { weekStart: ISODate; open: boolean; onClose: () => void }) {
  const templates = usePlanStore((s) => s.templates);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      {open ? (
        <DialogContent size="md" title="Vorlage verwenden" description={`Zeiten aus einer Vorlage in ${weekLabel(weekStart)} übernehmen.`}>
          {templates.length === 0 ? (
            <p className="text-[15px] text-muted">
              Noch keine Vorlage vorhanden. Erstelle einen Plan und speichere ihn über „Mehr“ → „Als Vorlage speichern“.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {templates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={async () => {
                    if (await applyTemplateToWeek(t.id, weekStart)) onClose();
                  }}
                  className="flex items-center gap-4 rounded-2xl border-2 border-border bg-surface px-4 py-3.5 text-left transition-colors hover:border-accent"
                >
                  <span className="flex size-11 items-center justify-center rounded-xl bg-accent-soft text-accent">
                    <LayoutTemplate className="size-5" />
                  </span>
                  <span>
                    <span className="block text-base font-semibold">{t.name}</span>
                    <span className="block text-sm text-muted">{countEntries(t.entries)} Einträge</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
