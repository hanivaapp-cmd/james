"use client";

import { Check, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { confirmAction } from "@/components/ui/confirm";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { AREAS, EMPLOYEE_COLORS } from "@/lib/areas";
import { usePlanStore } from "@/lib/store";
import type { AreaId, Employee } from "@/lib/types";
import { cn } from "@/lib/utils";

export type EmployeeDialogState = { mode: "add"; area: AreaId } | { mode: "edit"; employee: Employee } | null;

/** Mitarbeiter anlegen oder bearbeiten – Name, Bereich, Farbe, aktiv. */
export function EmployeeDialog({ state, onClose }: { state: EmployeeDialogState; onClose: () => void }) {
  return (
    <Dialog open={state !== null} onOpenChange={(o) => !o && onClose()}>
      {state ? <EmployeeBody key={state.mode === "edit" ? state.employee.id : "add"} state={state} onClose={onClose} /> : null}
    </Dialog>
  );
}

function EmployeeBody({ state, onClose }: { state: NonNullable<EmployeeDialogState>; onClose: () => void }) {
  const editing = state.mode === "edit" ? state.employee : null;
  const addEmployee = usePlanStore((s) => s.addEmployee);
  const updateEmployee = usePlanStore((s) => s.updateEmployee);
  const removeEmployee = usePlanStore((s) => s.removeEmployee);
  const employees = usePlanStore((s) => s.employees);

  const [name, setName] = useState(editing?.name ?? "");
  const [area, setArea] = useState<AreaId>(editing?.area ?? (state.mode === "add" ? state.area : "kitchen"));
  const [color, setColor] = useState<string | null>(editing?.color ?? null);
  const [active, setActive] = useState(editing?.active ?? true);
  const trimmed = name.trim();
  const duplicate = employees.some(
    (e) => !e.deleted && e.id !== editing?.id && e.name.toLowerCase() === trimmed.toLowerCase(),
  );

  const save = () => {
    if (!trimmed) return;
    if (editing) {
      updateEmployee(editing.id, { name: trimmed, area, color, active });
      toast.success(`${trimmed} gespeichert`);
    } else {
      addEmployee({ name: trimmed, area, color });
      toast.success(`${trimmed} hinzugefügt`);
    }
    onClose();
  };

  const remove = async () => {
    if (!editing) return;
    const ok = await confirmAction({
      title: `${editing.name} löschen?`,
      description: "Erscheint nicht mehr in neuen Wochen. In alten Wochenplänen bleiben die Einträge erhalten.",
      confirmLabel: "Löschen",
      destructive: true,
    });
    if (!ok) return;
    const undo = removeEmployee(editing.id);
    toast(`${editing.name} gelöscht`, { action: { label: "Rückgängig", onClick: undo } });
    onClose();
  };

  return (
    <DialogContent
      size="md"
      title={editing ? "Mitarbeiter bearbeiten" : "Mitarbeiter hinzufügen"}
      footer={
        <>
          {editing ? (
            <Button variant="danger-ghost" onClick={remove}>
              <Trash2 /> Löschen
            </Button>
          ) : null}
          <div className="ml-auto flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Abbrechen
            </Button>
            <Button variant="primary" onClick={save} disabled={!trimmed}>
              <Check /> {editing ? "Speichern" : "Hinzufügen"}
            </Button>
          </div>
        </>
      }
    >
      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Field
          label="Name"
          htmlFor="employee-name"
          hint={duplicate ? "Diesen Namen gibt es schon – zur Unterscheidung z. B. „Ali K.“ verwenden." : undefined}
        >
          <Input
            id="employee-name"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Vorname oder Spitzname"
            autoComplete="off"
            maxLength={40}
          />
        </Field>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Bereich</span>
          <div className="grid grid-cols-2 gap-2">
            {AREAS.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setArea(a.id)}
                aria-pressed={area === a.id}
                className={cn(
                  "h-13 rounded-xl border-2 text-base font-semibold transition-colors",
                  area === a.id ? "border-accent bg-accent-soft text-accent" : "border-border bg-surface hover:border-border-strong",
                )}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">
            Farbe <span className="font-normal text-muted">(optional)</span>
          </span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setColor(null)}
              className={cn(
                "flex h-10 items-center rounded-full border-2 px-3 text-sm text-muted",
                color === null ? "border-accent text-accent" : "border-border",
              )}
            >
              Keine
            </button>
            {EMPLOYEE_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={`Farbe ${c}`}
                className={cn(
                  "flex size-10 items-center justify-center rounded-full border-2 transition-transform hover:scale-105",
                  color === c ? "border-fg" : "border-transparent",
                )}
              >
                <span className="size-7 rounded-full" style={{ background: c }} />
              </button>
            ))}
          </div>
        </div>

        {editing ? (
          <label className="flex items-center justify-between gap-4 rounded-2xl bg-surface-2 px-4 py-3">
            <span>
              <span className="block text-[15px] font-medium">Aktiv</span>
              <span className="block text-sm text-muted">
                Inaktive Mitarbeiter erscheinen nicht in neuen Wochen, bleiben aber in alten Plänen.
              </span>
            </span>
            <Switch checked={active} onCheckedChange={setActive} />
          </label>
        ) : null}
        <button type="submit" className="hidden" />
      </form>
    </DialogContent>
  );
}
