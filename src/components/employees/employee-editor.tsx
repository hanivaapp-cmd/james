"use client";

import { Check, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useAutosave } from "@/lib/hooks/use-autosave";
import { usePermissions } from "@/lib/hooks/use-permissions";
import { actions, useAppStore } from "@/lib/store/app-store";
import type { Employee, NewEmployee } from "@/lib/types";
import { WEEKDAY_SHORT } from "@/lib/types";
import { cn, EMPLOYEE_COLORS } from "@/lib/utils";

type Draft = NewEmployee;

const emptyDraft = (): Draft => ({
  name: "",
  email: null,
  position: null,
  hourly_rate: 14,
  max_weekly_hours: 40,
  available_days: [1, 2, 3, 4, 5],
  color: EMPLOYEE_COLORS[Math.floor(Math.random() * EMPLOYEE_COLORS.length)],
  active: true,
});

function validate(draft: Draft) {
  const errors: Partial<Record<keyof Draft, string>> = {};
  if (!draft.name.trim()) errors.name = "Bitte einen Namen eingeben.";
  if (draft.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email)) errors.email = "Ungültige E-Mail-Adresse.";
  if (!(draft.hourly_rate >= 0)) errors.hourly_rate = "Ungültiger Stundenlohn.";
  if (!(draft.max_weekly_hours > 0 && draft.max_weekly_hours <= 168)) errors.max_weekly_hours = "Zwischen 1 und 168 Stunden.";
  if (draft.available_days.length === 0) errors.available_days = "Mindestens einen Tag wählen.";
  return errors;
}

export function EmployeeEditor({
  open,
  employeeId,
  onOpenChange,
}: {
  open: boolean;
  employeeId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const employee = useAppStore((s) => (employeeId ? s.employees[employeeId] : undefined));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? <Body key={employeeId ?? "new"} employee={employee} onClose={() => onOpenChange(false)} /> : null}
    </Dialog>
  );
}

function Body({ employee, onClose }: { employee: Employee | undefined; onClose: () => void }) {
  const { canManageEmployees } = usePermissions();
  const [draft, setDraft] = useState<Draft>(() => {
    if (!employee) return emptyDraft();
    const { id: _id, user_id: _user, ...rest } = employee;
    void _id;
    void _user;
    return rest;
  });
  const [submitted, setSubmitted] = useState(false);
  const errors = validate(draft);
  const valid = Object.keys(errors).length === 0;
  const mode = employee ? "edit" : "create";
  const update = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const showError = (key: keyof Draft) => (submitted || mode === "edit" ? errors[key] : undefined);

  const status = useAutosave(draft, (value) => actions.updateEmployee(employee!.id, { ...value, name: value.name.trim() }), {
    enabled: mode === "edit" && valid && canManageEmployees,
  });

  const create = async () => {
    setSubmitted(true);
    if (!valid) return;
    const result = await actions.createEmployee({ ...draft, name: draft.name.trim() });
    if (result) onClose();
  };

  return (
    <DialogContent
      title={mode === "create" ? "Neuer Mitarbeiter" : draft.name || "Mitarbeiter"}
      description={mode === "create" ? "Stammdaten für die Planung" : "Änderungen werden automatisch gespeichert."}
      footer={
        mode === "create" ? (
          <div className="flex w-full justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              Abbrechen
            </Button>
            <Button variant="primary" onClick={create}>
              Anlegen
            </Button>
          </div>
        ) : (
          <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-muted" aria-live="polite">
            {status === "saving" || status === "pending" ? (
              <>
                <LoaderCircle className="size-3.5 animate-spin" /> Speichert…
              </>
            ) : status === "error" || !valid ? (
              <span className="text-danger">Nicht gespeichert – bitte Eingaben prüfen</span>
            ) : (
              <>
                <Check className="size-3.5 text-success" /> Automatisch gespeichert
              </>
            )}
          </span>
        )
      }
    >
      <fieldset disabled={!canManageEmployees} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Name" error={showError("name")} htmlFor="emp-name">
            <Input id="emp-name" autoFocus={mode === "create"} value={draft.name} aria-invalid={Boolean(showError("name"))} onChange={(e) => update({ name: e.target.value })} placeholder="Vor- und Nachname" />
          </Field>
          <Field label="Position" htmlFor="emp-position">
            <Input id="emp-position" value={draft.position ?? ""} onChange={(e) => update({ position: e.target.value || null })} placeholder="z. B. Service, Küche" />
          </Field>
        </div>
        <Field
          label="E-Mail"
          htmlFor="emp-email"
          error={showError("email")}
          hint="Mit dieser Adresse kann sich der Mitarbeiter registrieren und seinen Plan sehen."
        >
          <Input id="emp-email" type="email" value={draft.email ?? ""} aria-invalid={Boolean(showError("email"))} onChange={(e) => update({ email: e.target.value.trim() || null })} placeholder="name@firma.de" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Stundenlohn (€)" error={showError("hourly_rate")} htmlFor="emp-rate">
            <Input id="emp-rate" type="number" inputMode="decimal" min={0} step={0.1} value={draft.hourly_rate} onChange={(e) => update({ hourly_rate: Number(e.target.value) })} />
          </Field>
          <Field label="Max. Std. / Woche" error={showError("max_weekly_hours")} htmlFor="emp-max">
            <Input id="emp-max" type="number" inputMode="decimal" min={1} max={168} step={0.5} value={draft.max_weekly_hours} onChange={(e) => update({ max_weekly_hours: Number(e.target.value) })} />
          </Field>
        </div>
        <Field label="Verfügbare Arbeitstage" error={showError("available_days")}>
          <div className="grid grid-cols-7 gap-1">
            {WEEKDAY_SHORT.map((label, index) => {
              const day = index + 1;
              const active = draft.available_days.includes(day);
              return (
                <button
                  key={label}
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    update({
                      available_days: active
                        ? draft.available_days.filter((d) => d !== day)
                        : [...draft.available_days, day].sort(),
                    })
                  }
                  className={cn(
                    "h-9 cursor-pointer rounded-lg border text-[13px] font-medium transition-colors",
                    active ? "border-accent bg-accent-soft text-accent" : "border-border text-subtle hover:text-fg",
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </Field>
        <Field label="Farbe">
          <div className="flex flex-wrap gap-2">
            {EMPLOYEE_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={`Farbe ${color}`}
                aria-pressed={draft.color === color}
                onClick={() => update({ color })}
                className={cn(
                  "size-7 cursor-pointer rounded-full transition-transform hover:scale-110",
                  draft.color === color && "ring-2 ring-offset-2 ring-offset-surface",
                )}
                style={{ background: color, ["--tw-ring-color" as string]: color }}
              />
            ))}
          </div>
        </Field>
        {mode === "edit" ? (
          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5">
            <span>
              <span className="block text-[13px] font-medium">Aktiv</span>
              <span className="block text-xs text-muted">Inaktive Mitarbeiter erscheinen nicht mehr im Plan.</span>
            </span>
            <Switch checked={draft.active} onCheckedChange={(active) => update({ active })} />
          </label>
        ) : null}
      </fieldset>
    </DialogContent>
  );
}
