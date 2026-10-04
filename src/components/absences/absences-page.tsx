"use client";

import { Check, Plus, Trash, TreePalm, X } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/app-shell";
import { Avatar } from "@/components/ui/avatar";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { confirmAction } from "@/components/ui/confirm";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { usePermissions } from "@/lib/hooks/use-permissions";
import { daysBetween, formatDateRange, todayISO } from "@/lib/schedule/dates";
import { actions, useAppStore } from "@/lib/store/app-store";
import type { Absence, AbsenceStatus, AbsenceType } from "@/lib/types";
import { ABSENCE_LABELS, ABSENCE_STATUS_LABELS } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AbsenceEditor } from "./absence-editor";

type Tab = "pending" | "upcoming" | "past" | "all";

const STATUS_TONE: Record<AbsenceStatus, BadgeTone> = { pending: "warning", approved: "success", rejected: "danger" };

export function AbsencesPage() {
  const { isStaff, canApproveAbsences, employeeId } = usePermissions();
  const absencesTable = useAppStore((s) => s.absences);
  const employeesTable = useAppStore((s) => s.employees);
  const [tab, setTab] = useState<Tab>(isStaff ? "pending" : "upcoming");
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<AbsenceType | "">("");
  const [editor, setEditor] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });
  const today = todayISO();

  const absences = useMemo(() => Object.values(absencesTable), [absencesTable]);
  const pendingCount = absences.filter((a) => a.status === "pending").length;

  const list = useMemo(() => {
    return absences
      .filter((a) => {
        if (tab === "pending") return a.status === "pending";
        if (tab === "upcoming") return a.end_date >= today && a.status !== "rejected";
        if (tab === "past") return a.end_date < today;
        return true;
      })
      .filter((a) => !employeeFilter || a.employee_id === employeeFilter)
      .filter((a) => !typeFilter || a.type === typeFilter)
      .sort((a, b) => (tab === "past" ? b.start_date.localeCompare(a.start_date) : a.start_date.localeCompare(b.start_date)));
  }, [absences, tab, employeeFilter, typeFilter, today]);

  const remove = async (absence: Absence) => {
    const ok = await confirmAction({ title: "Eintrag löschen?", confirmLabel: "Löschen", destructive: true });
    if (ok) await actions.deleteAbsence(absence.id);
  };

  const canCreate = isStaff || Boolean(employeeId);

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        title="Abwesenheiten"
        description={isStaff ? "Urlaub, Krankheit und Fortbildungen des Teams" : "Ihre Urlaubsanträge und Abwesenheiten"}
        actions={
          canCreate ? (
            <Button variant="primary" onClick={() => setEditor({ open: true, id: null })}>
              <Plus /> {isStaff ? "Eintragen" : "Beantragen"}
            </Button>
          ) : null
        }
      >
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { value: "pending", label: pendingCount > 0 ? `Offen (${pendingCount})` : "Offen" },
              { value: "upcoming", label: "Aktuell" },
              { value: "past", label: "Vergangen" },
              { value: "all", label: "Alle" },
            ]}
          />
          {isStaff ? (
            <div className="w-48">
              <Select value={employeeFilter} onChange={(e) => setEmployeeFilter(e.target.value)} aria-label="Mitarbeiter filtern">
                <option value="">Alle Mitarbeiter</option>
                {Object.values(employeesTable)
                  .sort((a, b) => a.name.localeCompare(b.name, "de"))
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
              </Select>
            </div>
          ) : null}
          <div className="w-40">
            <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as AbsenceType | "")} aria-label="Art filtern">
              <option value="">Alle Arten</option>
              {Object.entries(ABSENCE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </PageHeader>

      <div className="flex-1 px-4 py-4 sm:px-6">
        {!isStaff && !employeeId ? (
          <EmptyState
            icon={<TreePalm />}
            title="Kein Mitarbeiterprofil verknüpft"
            description="Bitten Sie Ihre Planung, Ihre E-Mail-Adresse bei Ihrem Mitarbeiterprofil zu hinterlegen."
          />
        ) : list.length === 0 ? (
          <EmptyState
            icon={<TreePalm />}
            title={tab === "pending" ? "Keine offenen Anträge" : "Keine Einträge"}
            description={tab === "pending" ? "Alles erledigt – neue Anträge erscheinen hier." : "Für diese Auswahl gibt es keine Abwesenheiten."}
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {list.map((absence) => {
              const employee = employeesTable[absence.employee_id];
              const days = daysBetween(absence.start_date, absence.end_date) + 1;
              const editable = isStaff || absence.status === "pending";
              return (
                <li
                  key={absence.id}
                  className={cn(
                    "flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface p-3 shadow-soft sm:flex-nowrap",
                    editable && "cursor-pointer transition-colors hover:border-border-strong",
                  )}
                  onClick={() => editable && setEditor({ open: true, id: absence.id })}
                >
                  {employee ? <Avatar name={employee.name} color={employee.color} /> : null}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {isStaff ? <span className="text-sm font-medium">{employee?.name ?? "Unbekannt"}</span> : null}
                      <Badge tone="accent">{ABSENCE_LABELS[absence.type]}</Badge>
                      <Badge tone={STATUS_TONE[absence.status]}>{ABSENCE_STATUS_LABELS[absence.status]}</Badge>
                    </div>
                    <div className="mt-0.5 text-[13px] text-muted">
                      {formatDateRange(absence.start_date, absence.end_date)} · {days} {days === 1 ? "Tag" : "Tage"}
                      {absence.note ? <span className="text-subtle"> · {absence.note}</span> : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 max-sm:w-full max-sm:justify-end" onClick={(e) => e.stopPropagation()}>
                    {canApproveAbsences && absence.status === "pending" ? (
                      <>
                        <Button size="sm" variant="ghost" className="text-danger" onClick={() => void actions.updateAbsence(absence.id, { status: "rejected" })}>
                          <X /> Ablehnen
                        </Button>
                        <Button size="sm" variant="primary" onClick={() => void actions.updateAbsence(absence.id, { status: "approved" })}>
                          <Check /> Genehmigen
                        </Button>
                      </>
                    ) : null}
                    {editable ? (
                      <Button size="icon-sm" variant="ghost" aria-label="Löschen" onClick={() => void remove(absence)}>
                        <Trash />
                      </Button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <AbsenceEditor open={editor.open} absenceId={editor.id} onOpenChange={(open) => setEditor((s) => ({ ...s, open }))} />
    </div>
  );
}
