"use client";

import { Check, LoaderCircle, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { useAutosave } from "@/lib/hooks/use-autosave";
import { usePermissions } from "@/lib/hooks/use-permissions";
import { daysBetween, todayISO } from "@/lib/schedule/dates";
import { actions, useAppStore } from "@/lib/store/app-store";
import type { Absence, AbsenceType, NewAbsence } from "@/lib/types";
import { ABSENCE_LABELS, ABSENCE_STATUS_LABELS } from "@/lib/types";
import { cn } from "@/lib/utils";

const TYPES: AbsenceType[] = ["vacation", "sick", "training", "other"];

export function AbsenceEditor({
  open,
  absenceId,
  onOpenChange,
}: {
  open: boolean;
  absenceId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const absence = useAppStore((s) => (absenceId ? s.absences[absenceId] : undefined));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? <Body key={absenceId ?? "new"} absence={absence} onClose={() => onOpenChange(false)} /> : null}
    </Dialog>
  );
}

function Body({ absence, onClose }: { absence: Absence | undefined; onClose: () => void }) {
  const { isStaff, employeeId } = usePermissions();
  const employeesTable = useAppStore((s) => s.employees);
  const shiftsTable = useAppStore((s) => s.shifts);
  const employees = useMemo(
    () => Object.values(employeesTable).filter((e) => e.active).sort((a, b) => a.name.localeCompare(b.name, "de")),
    [employeesTable],
  );
  const [draft, setDraft] = useState<NewAbsence>(() =>
    absence
      ? { ...absence }
      : {
          employee_id: isStaff ? "" : (employeeId ?? ""),
          type: "vacation",
          start_date: todayISO(),
          end_date: todayISO(),
          note: null,
          status: isStaff ? "approved" : "pending",
        },
  );
  const [submitted, setSubmitted] = useState(false);
  const mode = absence ? "edit" : "create";
  const locked = !isStaff && absence && absence.status !== "pending";
  const update = (patch: Partial<NewAbsence>) => setDraft((d) => ({ ...d, ...patch }));

  const errors: Partial<Record<keyof NewAbsence, string>> = {};
  if (!draft.employee_id) errors.employee_id = "Bitte Mitarbeiter wählen.";
  if (!draft.start_date) errors.start_date = "Bitte Startdatum wählen.";
  if (!draft.end_date || draft.end_date < draft.start_date) errors.end_date = "Ende darf nicht vor dem Beginn liegen.";
  const valid = Object.keys(errors).length === 0;
  const showError = (key: keyof NewAbsence) => (submitted || mode === "edit" ? errors[key] : undefined);

  useEffect(() => {
    if (draft.start_date && draft.end_date >= draft.start_date) {
      void actions.ensureRange({ from: draft.start_date, to: draft.end_date });
    }
  }, [draft.start_date, draft.end_date]);

  const conflicts = useMemo(
    () =>
      Object.values(shiftsTable).filter(
        (s) => s.employee_id === draft.employee_id && s.date >= draft.start_date && s.date <= draft.end_date,
      ),
    [shiftsTable, draft.employee_id, draft.start_date, draft.end_date],
  );

  const status = useAutosave(draft, (value) => actions.updateAbsence(absence!.id, value), {
    enabled: mode === "edit" && valid && !locked,
  });

  const create = async () => {
    setSubmitted(true);
    if (!valid) return;
    const result = await actions.createAbsence(draft);
    if (result) onClose();
  };

  const days = valid ? daysBetween(draft.start_date, draft.end_date) + 1 : 0;

  return (
    <DialogContent
      title={mode === "create" ? (isStaff ? "Abwesenheit eintragen" : "Abwesenheit beantragen") : "Abwesenheit"}
      description={
        locked ? `Status: ${ABSENCE_STATUS_LABELS[absence!.status]} – kann nicht mehr geändert werden.` : !isStaff && mode === "create" ? "Ihr Antrag wird an die Planung gesendet." : undefined
      }
      footer={
        mode === "create" ? (
          <div className="flex w-full items-center justify-end gap-2">
            <span className="tabular mr-auto text-xs text-muted">{days > 0 ? `${days} ${days === 1 ? "Tag" : "Tage"}` : ""}</span>
            <Button variant="ghost" onClick={onClose}>
              Abbrechen
            </Button>
            <Button variant="primary" onClick={create}>
              {isStaff ? "Eintragen" : "Beantragen"}
            </Button>
          </div>
        ) : locked ? undefined : (
          <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-muted">
            {status === "saving" || status === "pending" ? (
              <>
                <LoaderCircle className="size-3.5 animate-spin" /> Speichert…
              </>
            ) : status === "error" || !valid ? (
              <span className="text-danger">Nicht gespeichert</span>
            ) : (
              <>
                <Check className="size-3.5 text-success" /> Automatisch gespeichert
              </>
            )}
          </span>
        )
      }
    >
      <fieldset disabled={Boolean(locked)} className="flex flex-col gap-4">
        {isStaff ? (
          <Field label="Mitarbeiter" error={showError("employee_id")} htmlFor="abs-employee">
            <Select id="abs-employee" value={draft.employee_id} onChange={(e) => update({ employee_id: e.target.value })}>
              <option value="" disabled>
                Auswählen…
              </option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
        <Field label="Art">
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {TYPES.map((type) => (
              <button
                key={type}
                type="button"
                aria-pressed={draft.type === type}
                onClick={() => update({ type })}
                className={cn(
                  "h-9 cursor-pointer rounded-lg border text-[13px] font-medium transition-colors",
                  draft.type === type ? "border-accent bg-accent-soft text-accent" : "border-border text-muted hover:text-fg",
                )}
              >
                {ABSENCE_LABELS[type]}
              </button>
            ))}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Von" error={showError("start_date")} htmlFor="abs-from">
            <Input
              id="abs-from"
              type="date"
              value={draft.start_date}
              onChange={(e) =>
                e.target.value &&
                update({ start_date: e.target.value, end_date: draft.end_date < e.target.value ? e.target.value : draft.end_date })
              }
            />
          </Field>
          <Field label="Bis" error={showError("end_date")} htmlFor="abs-to">
            <Input id="abs-to" type="date" min={draft.start_date} value={draft.end_date} onChange={(e) => e.target.value && update({ end_date: e.target.value })} />
          </Field>
        </div>
        <Field label="Notiz" htmlFor="abs-note">
          <Textarea id="abs-note" rows={2} value={draft.note ?? ""} onChange={(e) => update({ note: e.target.value || null })} placeholder="Optional" />
        </Field>
        {isStaff ? (
          <Field label="Status" htmlFor="abs-status">
            <Select id="abs-status" value={draft.status} onChange={(e) => update({ status: e.target.value as Absence["status"] })}>
              {(["pending", "approved", "rejected"] as const).map((s) => (
                <option key={s} value={s}>
                  {ABSENCE_STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
        {isStaff && conflicts.length > 0 && draft.status !== "rejected" ? (
          <p className="flex items-start gap-2 rounded-lg bg-warning-soft p-3 text-[13px] text-warning">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            {conflicts.length} geplante {conflicts.length === 1 ? "Schicht liegt" : "Schichten liegen"} in diesem Zeitraum.
            Bitte im Dienstplan umplanen.
          </p>
        ) : null}
      </fieldset>
    </DialogContent>
  );
}
