"use client";

import { Download, Eye, FolderOpen, LayoutTemplate, Pencil, RotateCcw, Trash2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { confirmAction } from "@/components/ui/confirm";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { downloadBlob } from "@/lib/export/share";
import { countEntries, hasContent } from "@/lib/plan";
import { looksLikeBackup, sanitizeAppData } from "@/lib/storage/sanitize";
import { usePlanStore } from "@/lib/store";
import type { Template } from "@/lib/types";
import { cn } from "@/lib/utils";
import { relativeWeekName, weekNumber, weekRangeShort } from "@/lib/week";

export function ArchivePage() {
  const router = useRouter();
  const weeks = usePlanStore((s) => s.weeks);
  const templates = usePlanStore((s) => s.templates);
  const currentWeek = usePlanStore((s) => s.currentWeek);
  const selectWeek = usePlanStore((s) => s.selectWeek);
  const clearWeek = usePlanStore((s) => s.clearWeek);
  const restoreWeek = usePlanStore((s) => s.restoreWeek);
  const deleteTemplate = usePlanStore((s) => s.deleteTemplate);
  const [renaming, setRenaming] = useState<Template | null>(null);

  const list = Object.values(weeks)
    .filter(hasContent)
    .sort((a, b) => b.weekStart.localeCompare(a.weekStart));

  const open = (weekStart: string, path: "/" | "/ansicht") => {
    selectWeek(weekStart);
    router.push(path);
  };

  const removeWeek = async (weekStart: string) => {
    const ok = await confirmAction({
      title: `KW ${weekNumber(weekStart)} löschen?`,
      description: "Alle Einträge und Notizen dieser Woche werden entfernt.",
      confirmLabel: "Löschen",
      destructive: true,
    });
    if (!ok) return;
    const previous = clearWeek(weekStart);
    toast(`KW ${weekNumber(weekStart)} gelöscht`, {
      action: { label: "Rückgängig", onClick: () => restoreWeek(weekStart, previous) },
    });
  };

  const removeTemplate = async (template: Template) => {
    const ok = await confirmAction({
      title: `Vorlage „${template.name}“ löschen?`,
      confirmLabel: "Löschen",
      destructive: true,
    });
    if (!ok) return;
    const undo = deleteTemplate(template.id);
    toast(`Vorlage „${template.name}“ gelöscht`, { action: { label: "Rückgängig", onClick: undo } });
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-4 pt-5 sm:px-6 sm:pt-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Archiv</h1>
        <p className="mt-1 text-[15px] text-muted">Alle gespeicherten Wochen, Vorlagen und die Datensicherung.</p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Vergangene Wochen</h2>
        {list.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border-strong bg-surface p-6 text-center text-muted">
            Noch keine Wochenpläne gespeichert.
          </p>
        ) : (
          <ul className="overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
            {list.map((week) => {
              const relative = relativeWeekName(week.weekStart, currentWeek);
              const entries = countEntries(week.entries);
              const notes = Object.keys(week.notes).length;
              return (
                <li key={week.weekStart} className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border px-4 py-3 last:border-b-0 sm:px-5">
                  <button type="button" onClick={() => open(week.weekStart, "/")} className="min-w-0 flex-1 basis-full text-left sm:basis-auto">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-semibold">KW {weekNumber(week.weekStart)}</span>
                      <span className="tabular text-[15px]">{weekRangeShort(week.weekStart)}</span>
                      {relative ? (
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs font-semibold",
                            week.weekStart === currentWeek ? "bg-accent text-white" : "bg-accent-soft text-accent",
                          )}
                        >
                          {relative}
                        </span>
                      ) : null}
                    </span>
                    <span className="block text-sm text-muted">
                      {entries} Einträge{notes > 0 ? ` · ${notes} ${notes === 1 ? "Notiz" : "Notizen"}` : ""}
                    </span>
                  </button>
                  <div className="flex gap-1.5">
                    <Button size="sm" onClick={() => open(week.weekStart, "/")}>
                      <FolderOpen /> Öffnen
                    </Button>
                    <Button size="sm" onClick={() => open(week.weekStart, "/ansicht")}>
                      <Eye /> Bild
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => removeWeek(week.weekStart)} aria-label={`KW ${weekNumber(week.weekStart)} löschen`}>
                      <Trash2 />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-semibold">Vorlagen</h2>
          <p className="text-sm text-muted">
            Neue Vorlage: im Wochenplan auf „Mehr“ → „Als Vorlage speichern“. Verwenden über „Wochenplan erstellen“.
          </p>
        </div>
        {templates.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border-strong bg-surface p-6 text-center text-muted">Noch keine Vorlagen.</p>
        ) : (
          <ul className="overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
            {templates.map((template) => (
              <li key={template.id} className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0 sm:px-5">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
                  <LayoutTemplate className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-base font-semibold">{template.name}</div>
                  <div className="text-sm text-muted">
                    {countEntries(template.entries)} Einträge · erstellt am {new Date(template.createdAt).toLocaleDateString("de-DE")}
                  </div>
                </div>
                <Button variant="ghost" size="icon-sm" onClick={() => setRenaming(template)} aria-label="Umbenennen">
                  <Pencil />
                </Button>
                <Button variant="ghost" size="icon-sm" onClick={() => removeTemplate(template)} aria-label="Löschen">
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <BackupSection />

      <RenameTemplateDialog template={renaming} onClose={() => setRenaming(null)} />
    </div>
  );
}

function BackupSection() {
  const exportData = usePlanStore((s) => s.exportData);
  const importData = usePlanStore((s) => s.importData);
  const resetToDemo = usePlanStore((s) => s.resetToDemo);
  const clearAll = usePlanStore((s) => s.clearAll);
  const fileInput = useRef<HTMLInputElement>(null);

  const backup = () => {
    const json = JSON.stringify({ app: "wochenplan", version: 1, exportedAt: new Date().toISOString(), ...exportData() }, null, 2);
    const date = new Date().toISOString().slice(0, 10);
    downloadBlob(new Blob([json], { type: "application/json" }), `wochenplan-sicherung-${date}.json`);
    toast.success("Sicherung heruntergeladen");
  };

  const restore = async (file: File) => {
    let raw: unknown;
    try {
      raw = JSON.parse(await file.text());
    } catch {
      toast.error("Diese Datei ist keine gültige Sicherung.");
      return;
    }
    if (!looksLikeBackup(raw)) {
      toast.error("Diese Datei ist keine Sicherung dieser App.");
      return;
    }
    const ok = await confirmAction({
      title: "Sicherung einspielen?",
      description: "Alle aktuellen Daten in diesem Browser werden durch die Sicherung ersetzt.",
      confirmLabel: "Einspielen",
      destructive: true,
    });
    if (!ok) return;
    await importData(sanitizeAppData(raw));
    toast.success("Sicherung eingespielt");
  };

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-lg font-semibold">Datensicherung</h2>
        <p className="text-sm text-muted">
          Alle Daten werden automatisch in diesem Browser gespeichert. Mit einer Sicherungsdatei lassen sie sich auf ein anderes
          Gerät übertragen.
        </p>
      </div>
      <div className="grid gap-2 rounded-2xl border border-border bg-surface p-4 shadow-card sm:grid-cols-2 sm:p-5">
        <Button onClick={backup}>
          <Download /> Sicherung herunterladen
        </Button>
        <Button onClick={() => fileInput.current?.click()}>
          <Upload /> Sicherung einspielen
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void restore(file);
            e.target.value = "";
          }}
        />
        <Button
          variant="ghost"
          onClick={async () => {
            const ok = await confirmAction({
              title: "Beispieldaten laden?",
              description: "Alle aktuellen Daten werden durch die Beispieldaten ersetzt.",
              confirmLabel: "Beispieldaten laden",
              destructive: true,
            });
            if (ok) {
              await resetToDemo();
              toast.success("Beispieldaten geladen");
            }
          }}
        >
          <RotateCcw /> Beispieldaten laden
        </Button>
        <Button
          variant="danger-ghost"
          onClick={async () => {
            const ok = await confirmAction({
              title: "Wirklich alles löschen?",
              description: "Alle Mitarbeiter, Wochenpläne und Vorlagen werden gelöscht. Tipp: vorher eine Sicherung herunterladen.",
              confirmLabel: "Alles löschen",
              destructive: true,
            });
            if (ok) {
              await clearAll();
              toast("Alle Daten gelöscht – du kannst jetzt mit deinen eigenen Mitarbeitern starten.");
            }
          }}
        >
          <Trash2 /> Alles löschen und neu beginnen
        </Button>
      </div>
    </section>
  );
}

function RenameTemplateDialog({ template, onClose }: { template: Template | null; onClose: () => void }) {
  return (
    <Dialog open={template !== null} onOpenChange={(o) => !o && onClose()}>
      {template ? <RenameBody key={template.id} template={template} onClose={onClose} /> : null}
    </Dialog>
  );
}

function RenameBody({ template, onClose }: { template: Template; onClose: () => void }) {
  const renameTemplate = usePlanStore((s) => s.renameTemplate);
  const [name, setName] = useState(template.name);
  const save = () => {
    if (!name.trim()) return;
    renameTemplate(template.id, name);
    onClose();
  };
  return (
    <DialogContent
      size="sm"
      title="Vorlage umbenennen"
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
          save();
        }}
      >
        <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} aria-label="Name der Vorlage" />
      </form>
    </DialogContent>
  );
}
