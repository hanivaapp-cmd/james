"use client";

import { Check, Clock, Copy, LoaderCircle, MapPin, Moon, Trash } from "lucide-react";
import { useMemo, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { useAutosave } from "@/lib/hooks/use-autosave";
import { usePermissions } from "@/lib/hooks/use-permissions";
import { crossesMidnight, formatHours, shiftCost, shiftGrossMinutes, shiftNetMinutes } from "@/lib/schedule/calc";
import { analyzeSchedule } from "@/lib/schedule/conflicts";
import { addDaysISO, fmt, todayISO } from "@/lib/schedule/dates";
import { actions, useAppStore } from "@/lib/store/app-store";
import type { NewShift, Shift, ShiftType } from "@/lib/types";
import { cn, formatCurrency, tint } from "@/lib/utils";
import { useShiftEditor } from "./editor-store";
import { SeverityIcon } from "./shift-chip";

type Draft = NewShift;

const BREAK_PRESETS = [0, 15, 30, 45, 60];

function validate(draft: Draft): Partial<Record<keyof Draft, string>> {
  const errors: Partial<Record<keyof Draft, string>> = {};
  if (!draft.employee_id) errors.employee_id = "Bitte Mitarbeiter wählen.";
  if (!draft.date) errors.date = "Bitte Datum wählen.";
  if (!/^\d{2}:\d{2}$/.test(draft.start_time)) errors.start_time = "Ungültige Zeit.";
  if (!/^\d{2}:\d{2}$/.test(draft.end_time)) errors.end_time = "Ungültige Zeit.";
  if (!errors.start_time && !errors.end_time && draft.start_time === draft.end_time) {
    errors.end_time = "Ende muss sich vom Beginn unterscheiden.";
  }
  if (draft.break_minutes < 0 || Number.isNaN(draft.break_minutes)) errors.break_minutes = "Ungültige Pause.";
  else if (!errors.end_time && draft.break_minutes >= shiftGrossMinutes(draft)) {
    errors.break_minutes = "Pause ist länger als die Schicht.";
  }
  return errors;
}

function draftFrom(shift: Shift | undefined, defaults: Partial<Shift> | null, types: ShiftType[]): Draft {
  if (shift) {
    const { id: _id, ...rest } = shift;
    void _id;
    return rest;
  }
  const type = (defaults?.shift_type_id && types.find((t) => t.id === defaults.shift_type_id)) || types[0];
  return {
    employee_id: defaults?.employee_id ?? "",
    date: defaults?.date ?? todayISO(),
    shift_type_id: type?.id ?? null,
    start_time: defaults?.start_time ?? type?.default_start ?? "08:00",
    end_time: defaults?.end_time ?? type?.default_end ?? "16:00",
    break_minutes: defaults?.break_minutes ?? type?.default_break_minutes ?? 30,
    location: defaults?.location ?? null,
    notes: defaults?.notes ?? null,
  };
}

export function ShiftEditor({ locations = [] }: { locations?: string[] }) {
  const { open, shiftId, defaults, close } = useShiftEditor();
  const shift = useAppStore((s) => (shiftId ? s.shifts[shiftId] : undefined));
  // Neuer Schlüssel je Öffnung → Formular startet frisch.
  const key = `${open}-${shiftId ?? "new"}-${JSON.stringify(defaults)}`;
  const missing = open && shiftId && !shift;

  return (
    <Dialog open={open && !missing} onOpenChange={(o) => !o && close()}>
      {open && !missing ? <EditorBody key={key} shift={shift} defaults={defaults} locations={locations} /> : null}
    </Dialog>
  );
}

function EditorBody({
  shift,
  defaults,
  locations,
}: {
  shift: Shift | undefined;
  defaults: Partial<Shift> | null;
  locations: string[];
}) {
  const close = useShiftEditor((s) => s.close);
  const openNew = useShiftEditor((s) => s.openNew);
  const { canEditSchedule, canSeeCosts } = usePermissions();
  const employeesTable = useAppStore((s) => s.employees);
  const shiftTypesTable = useAppStore((s) => s.shiftTypes);
  const shiftsTable = useAppStore((s) => s.shifts);
  const absencesTable = useAppStore((s) => s.absences);

  const types = useMemo(
    () => Object.values(shiftTypesTable).sort((a, b) => a.sort_order - b.sort_order),
    [shiftTypesTable],
  );
  const currentEmployeeId = shift?.employee_id;
  const employees = useMemo(
    () =>
      Object.values(employeesTable)
        .filter((e) => e.active || e.id === currentEmployeeId)
        .sort((a, b) => a.name.localeCompare(b.name, "de")),
    [employeesTable, currentEmployeeId],
  );

  const [draft, setDraft] = useState<Draft>(() => draftFrom(shift, defaults, types));
  const [submitted, setSubmitted] = useState(false);
  const mode: "create" | "edit" | "view" = !canEditSchedule ? "view" : shift ? "edit" : "create";
  const errors = validate(draft);
  const valid = Object.keys(errors).length === 0;
  const employee = employeesTable[draft.employee_id];

  const update = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  const applyType = (type: ShiftType | null) => {
    if (!type) return update({ shift_type_id: null });
    update({
      shift_type_id: type.id,
      start_time: type.default_start,
      end_time: type.default_end,
      break_minutes: type.default_break_minutes,
    });
  };

  // Automatisches Speichern bestehender Schichten.
  const status = useAutosave(draft, (value) => actions.updateShift(shift!.id, value), {
    enabled: mode === "edit" && valid,
  });

  // Live-Prüfung: Wie sähe der Plan mit dieser Änderung aus?
  const draftId = shift?.id ?? "__draft__";
  const issues = useMemo(() => {
    if (!draft.employee_id || !valid) return [];
    const from = addDaysISO(draft.date, -8);
    const to = addDaysISO(draft.date, 8);
    const nearby = Object.values(shiftsTable).filter(
      (s) => s.employee_id === draft.employee_id && s.id !== draftId && s.date >= from && s.date <= to,
    );
    const absences = Object.values(absencesTable).filter((a) => a.employee_id === draft.employee_id);
    const analysis = analyzeSchedule([...nearby, { ...draft, id: draftId }], new Map(Object.entries(employeesTable)), absences);
    return analysis.issues.filter((i) => i.shiftIds.includes(draftId));
  }, [draft, draftId, valid, shiftsTable, absencesTable, employeesTable]);

  const net = valid ? shiftNetMinutes(draft) : 0;

  const create = async (another: boolean) => {
    setSubmitted(true);
    if (!valid) return;
    const result = await actions.createShifts([draft]);
    if (!result) return;
    if (another) openNew({ ...draft, date: addDaysISO(draft.date, 1) });
    else close();
  };

  if (mode === "view") {
    const type = draft.shift_type_id ? shiftTypesTable[draft.shift_type_id] : undefined;
    return (
      <DialogContent title={type?.name ?? "Schicht"} description={fmt(draft.date, "EEEE, d. MMMM yyyy")} size="sm">
        <div className="flex flex-col gap-3 text-sm">
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-muted" />
            <span className="tabular font-medium">
              {draft.start_time}–{draft.end_time}
            </span>
            <span className="text-muted">· {formatHours(net)} · {draft.break_minutes} min Pause</span>
          </div>
          {draft.location ? (
            <div className="flex items-center gap-2">
              <MapPin className="size-4 text-muted" /> {draft.location}
            </div>
          ) : null}
          {draft.notes ? <p className="rounded-lg bg-surface-2 p-3 text-[13px] whitespace-pre-wrap">{draft.notes}</p> : null}
        </div>
      </DialogContent>
    );
  }

  const showError = (field: keyof Draft) => (submitted || mode === "edit" ? errors[field] : undefined);

  return (
    <DialogContent
      title={mode === "create" ? "Neue Schicht" : "Schicht bearbeiten"}
      description={draft.date ? fmt(draft.date, "EEEE, d. MMMM yyyy") : undefined}
      footer={
        mode === "create" ? (
          <>
            <span className="tabular mr-auto text-xs text-muted">
              {valid ? `${formatHours(net)} Arbeitszeit` : ""}
            </span>
            <Button variant="ghost" onClick={close} className="max-sm:hidden">
              Abbrechen
            </Button>
            <Button onClick={() => create(true)} className="max-sm:flex-1">
              + Weitere
            </Button>
            <Button variant="primary" onClick={() => create(false)} className="max-sm:flex-1">
              Erstellen
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="danger-ghost"
              size="sm"
              onClick={() => {
                void actions.deleteShifts([shift!.id]);
                close();
              }}
            >
              <Trash /> Löschen
            </Button>
            <Button variant="ghost" size="sm" onClick={() => openNew(draft)}>
              <Copy /> Duplizieren
            </Button>
            <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-muted" aria-live="polite">
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
          </>
        )
      }
    >
      <div className="flex flex-col gap-4">
        {/* Schichtart */}
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Schichtart">
          {types.map((type) => {
            const active = draft.shift_type_id === type.id;
            return (
              <button
                key={type.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => applyType(type)}
                className={cn(
                  "inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all",
                  active ? "text-fg shadow-soft" : "border-border text-muted hover:text-fg",
                )}
                style={active ? { background: tint(type.color, 14), borderColor: type.color } : undefined}
              >
                <span className="size-2 rounded-full" style={{ background: type.color }} />
                {type.name}
              </button>
            );
          })}
          <button
            type="button"
            role="radio"
            aria-checked={!draft.shift_type_id}
            onClick={() => applyType(null)}
            className={cn(
              "cursor-pointer rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all",
              !draft.shift_type_id ? "border-fg/40 text-fg" : "border-border text-muted hover:text-fg",
            )}
          >
            Individuell
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Mitarbeiter" error={showError("employee_id")} htmlFor="shift-employee">
            <Select
              id="shift-employee"
              value={draft.employee_id}
              aria-invalid={Boolean(showError("employee_id"))}
              onChange={(e) => update({ employee_id: e.target.value })}
            >
              <option value="" disabled>
                Auswählen…
              </option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                  {e.position ? ` · ${e.position}` : ""}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Datum" error={showError("date")} htmlFor="shift-date">
            <Input
              id="shift-date"
              type="date"
              value={draft.date}
              aria-invalid={Boolean(showError("date"))}
              onChange={(e) => e.target.value && update({ date: e.target.value })}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Beginn" error={showError("start_time")} htmlFor="shift-start">
            <Input
              id="shift-start"
              type="time"
              step={300}
              value={draft.start_time}
              onChange={(e) => update({ start_time: e.target.value })}
            />
          </Field>
          <Field
            label="Ende"
            error={showError("end_time")}
            hint={
              valid && crossesMidnight(draft) ? (
                <span className="inline-flex items-center gap-1">
                  <Moon className="size-3" /> endet am Folgetag
                </span>
              ) : undefined
            }
            htmlFor="shift-end"
          >
            <Input id="shift-end" type="time" step={300} value={draft.end_time} onChange={(e) => update({ end_time: e.target.value })} />
          </Field>
        </div>

        <Field label="Pause" error={showError("break_minutes")}>
          <div className="flex flex-wrap items-center gap-1.5">
            {BREAK_PRESETS.map((minutes) => (
              <button
                key={minutes}
                type="button"
                onClick={() => update({ break_minutes: minutes })}
                className={cn(
                  "tabular h-8 cursor-pointer rounded-md border px-2.5 text-xs font-medium transition-colors",
                  draft.break_minutes === minutes ? "border-accent bg-accent-soft text-accent" : "border-border text-muted hover:text-fg",
                )}
              >
                {minutes} min
              </button>
            ))}
            <Input
              type="number"
              min={0}
              max={720}
              step={5}
              aria-label="Pause in Minuten"
              value={draft.break_minutes}
              onChange={(e) => update({ break_minutes: Math.max(0, Number(e.target.value) || 0) })}
              className="h-8 w-20"
            />
          </div>
        </Field>

        <Field label="Standort" hint="Optional" htmlFor="shift-location">
          <Input
            id="shift-location"
            list="shift-locations"
            placeholder="z. B. Filiale Mitte"
            value={draft.location ?? ""}
            onChange={(e) => update({ location: e.target.value || null })}
          />
          <datalist id="shift-locations">
            {locations.map((l) => (
              <option key={l} value={l} />
            ))}
          </datalist>
        </Field>

        <Field label="Notizen" htmlFor="shift-notes">
          <Textarea
            id="shift-notes"
            rows={2}
            placeholder="Hinweise für den Mitarbeiter…"
            value={draft.notes ?? ""}
            onChange={(e) => update({ notes: e.target.value || null })}
          />
        </Field>

        {/* Zusammenfassung & Warnungen */}
        {valid && employee ? (
          <div className="rounded-xl border border-border bg-surface-2/60 p-3">
            <div className="flex items-center gap-2.5">
              <Avatar name={employee.name} color={employee.color} size="sm" />
              <div className="min-w-0 flex-1 text-[13px]">
                <span className="font-medium">{employee.name}</span>
                <span className="text-muted"> · {formatHours(net)} Arbeitszeit</span>
              </div>
              {canSeeCosts ? (
                <span className="tabular text-[13px] text-muted">{formatCurrency(shiftCost(draft, employee))}</span>
              ) : null}
            </div>
            {issues.length > 0 ? (
              <ul className="mt-2.5 flex flex-col gap-1.5 border-t border-border pt-2.5">
                {issues.map((issue) => (
                  <li key={issue.id} className="flex items-start gap-2 text-[13px]">
                    <SeverityIcon severity={issue.severity} className="mt-0.5 size-3.5 shrink-0" />
                    <span>{issue.message}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-success">
                <Check className="size-3.5" /> Keine Konflikte
              </p>
            )}
          </div>
        ) : null}
      </div>
    </DialogContent>
  );
}
