"use client";

import { ArrowDown, ArrowUp, ChevronRight, Pencil, Plus, RotateCcw, UserPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AREAS } from "@/lib/areas";
import { usePlanStore } from "@/lib/store";
import type { Employee } from "@/lib/types";
import { cn } from "@/lib/utils";
import { EmployeeDialog, type EmployeeDialogState } from "./employee-dialog";

export function EmployeesPage() {
  const employees = usePlanStore((s) => s.employees);
  const moveEmployee = usePlanStore((s) => s.moveEmployee);
  const updateEmployee = usePlanStore((s) => s.updateEmployee);
  const [dialog, setDialog] = useState<EmployeeDialogState>(null);
  const [showInactive, setShowInactive] = useState(false);

  const visible = employees.filter((e) => !e.deleted).sort((a, b) => a.sortOrder - b.sortOrder);
  const inactive = visible.filter((e) => !e.active);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 pt-5 sm:px-6 sm:pt-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Mitarbeiter</h1>
          <p className="mt-1 text-[15px] text-muted">Hinzufügen, umbenennen, Bereich wechseln oder deaktivieren.</p>
        </div>
        <Button variant="primary" size="lg" onClick={() => setDialog({ mode: "add", area: "kitchen" })} className="w-full sm:w-auto">
          <UserPlus /> Mitarbeiter hinzufügen
        </Button>
      </header>

      {AREAS.map((area) => {
        const list = visible.filter((e) => e.area === area.id && e.active);
        return (
          <section key={area.id} className="overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
            <div className="flex items-center justify-between border-b border-cream-border bg-cream px-4 py-2.5 sm:px-5">
              <h2 className="text-sm font-bold tracking-[0.12em] text-cream-fg uppercase">
                {area.label} <span className="ml-1 font-medium tracking-normal opacity-70">{list.length}</span>
              </h2>
              <button
                type="button"
                onClick={() => setDialog({ mode: "add", area: area.id })}
                className="flex h-9 items-center gap-1 rounded-lg px-2.5 text-sm font-medium text-cream-fg/80 hover:bg-white/60 hover:text-cream-fg"
              >
                <Plus className="size-4" /> Hinzufügen
              </button>
            </div>
            {list.length === 0 ? (
              <p className="px-5 py-6 text-[15px] text-muted">Noch niemand im Bereich {area.label}.</p>
            ) : (
              <ul>
                {list.map((employee, index) => (
                  <EmployeeRow
                    key={employee.id}
                    employee={employee}
                    isFirst={index === 0}
                    isLast={index === list.length - 1}
                    onEdit={() => setDialog({ mode: "edit", employee })}
                    onMove={(dir) => moveEmployee(employee.id, dir)}
                  />
                ))}
              </ul>
            )}
          </section>
        );
      })}

      {inactive.length > 0 ? (
        <section className="rounded-2xl border border-border bg-surface shadow-card">
          <button
            type="button"
            onClick={() => setShowInactive((v) => !v)}
            className="flex min-h-14 w-full items-center gap-2 px-4 text-left sm:px-5"
          >
            <span className="flex-1 text-[15px] font-semibold">Inaktive Mitarbeiter ({inactive.length})</span>
            <ChevronRight className={cn("size-5 text-muted transition-transform", showInactive && "rotate-90")} />
          </button>
          {showInactive ? (
            <ul className="border-t border-border">
              {inactive.map((employee) => (
                <li key={employee.id} className="flex min-h-16 items-center gap-3 border-b border-border px-4 last:border-b-0 sm:px-5">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-base font-medium text-muted">{employee.name}</div>
                    <div className="text-sm text-subtle">{AREAS.find((a) => a.id === employee.area)?.label} · inaktiv</div>
                  </div>
                  <Button
                    onClick={() => {
                      updateEmployee(employee.id, { active: true });
                      toast.success(`${employee.name} ist wieder aktiv`);
                    }}
                  >
                    <RotateCcw /> Aktivieren
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setDialog({ mode: "edit", employee })} aria-label="Bearbeiten">
                    <Pencil />
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <p className="text-center text-sm text-muted">
        Inaktive oder gelöschte Mitarbeiter bleiben in alten Wochenplänen sichtbar.
      </p>

      <EmployeeDialog state={dialog} onClose={() => setDialog(null)} />
    </div>
  );
}

function EmployeeRow({
  employee,
  isFirst,
  isLast,
  onEdit,
  onMove,
}: {
  employee: Employee;
  isFirst: boolean;
  isLast: boolean;
  onEdit: () => void;
  onMove: (direction: -1 | 1) => void;
}) {
  return (
    <li className="flex min-h-16 items-center gap-2 border-b border-border px-2 last:border-b-0 sm:px-3">
      <button
        type="button"
        onClick={onEdit}
        className="flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-xl px-2 text-left transition-colors hover:bg-surface-3"
      >
        <span
          className="flex size-10 shrink-0 items-center justify-center rounded-full text-[15px] font-bold text-white"
          style={{ background: employee.color ?? "#9aa1ab" }}
        >
          {employee.name.slice(0, 1).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1 truncate text-base font-semibold">{employee.name}</span>
        <Pencil className="size-4 shrink-0 text-subtle" />
      </button>
      <div className="flex shrink-0 gap-1">
        <Button variant="ghost" size="icon" onClick={() => onMove(-1)} disabled={isFirst} aria-label={`${employee.name} nach oben`}>
          <ArrowUp />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => onMove(1)} disabled={isLast} aria-label={`${employee.name} nach unten`}>
          <ArrowDown />
        </Button>
      </div>
    </li>
  );
}
