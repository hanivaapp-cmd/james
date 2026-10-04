"use client";

import { Ellipsis, Link2, Pencil, Plus, Search, Trash, UserPlus, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/app-shell";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { confirmAction } from "@/components/ui/confirm";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { usePermissions } from "@/lib/hooks/use-permissions";
import { formatHours, shiftNetMinutes } from "@/lib/schedule/calc";
import { todayISO, weekEnd, weekStart } from "@/lib/schedule/dates";
import { actions, useAppStore } from "@/lib/store/app-store";
import { isDemoMode } from "@/lib/supabase/config";
import type { Employee } from "@/lib/types";
import { WEEKDAY_SHORT } from "@/lib/types";
import { cn, formatCurrency } from "@/lib/utils";
import { EmployeeEditor } from "./employee-editor";

type StatusFilter = "active" | "inactive" | "all";

function DayPills({ days }: { days: number[] }) {
  return (
    <span className="flex gap-0.5">
      {WEEKDAY_SHORT.map((label, i) => (
        <span
          key={label}
          className={cn(
            "flex size-5 items-center justify-center rounded text-[10px] font-medium",
            days.includes(i + 1) ? "bg-accent-soft text-accent" : "text-subtle",
          )}
        >
          {label[0]}
        </span>
      ))}
    </span>
  );
}

function HoursBar({ minutes, max }: { minutes: number; max: number }) {
  const limit = max * 60;
  const over = minutes > limit;
  return (
    <span className="flex min-w-28 items-center gap-2">
      <span className="h-1 flex-1 overflow-hidden rounded-full bg-surface-3">
        <span
          className={cn("block h-full rounded-full", over ? "bg-danger" : "bg-accent")}
          style={{ width: `${Math.min(100, (minutes / limit) * 100)}%` }}
        />
      </span>
      <span className={cn("tabular text-xs whitespace-nowrap", over ? "font-semibold text-danger" : "text-muted")}>
        {formatHours(minutes, false)}/{formatHours(limit)}
      </span>
    </span>
  );
}

export function EmployeesPage() {
  const { canManageEmployees, canDeleteEmployees, isStaff } = usePermissions();
  const router = useRouter();
  const employeesTable = useAppStore((s) => s.employees);
  const shiftsTable = useAppStore((s) => s.shifts);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("active");
  const [editor, setEditor] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });

  const thisWeek = useMemo(() => ({ from: weekStart(todayISO()), to: weekEnd(todayISO()) }), []);

  useEffect(() => {
    if (!isStaff) router.replace("/my");
  }, [isStaff, router]);

  useEffect(() => {
    void actions.ensureRange(thisWeek);
  }, [thisWeek]);

  const weekMinutes = useMemo(() => {
    const map = new Map<string, number>();
    for (const shift of Object.values(shiftsTable)) {
      if (shift.date < thisWeek.from || shift.date > thisWeek.to) continue;
      map.set(shift.employee_id, (map.get(shift.employee_id) ?? 0) + shiftNetMinutes(shift));
    }
    return map;
  }, [shiftsTable, thisWeek]);

  const all = useMemo(() => Object.values(employeesTable).sort((a, b) => a.name.localeCompare(b.name, "de")), [employeesTable]);
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all
      .filter((e) => (status === "all" ? true : status === "active" ? e.active : !e.active))
      .filter((e) => !q || [e.name, e.position, e.email].some((v) => v?.toLowerCase().includes(q)));
  }, [all, query, status]);

  const activeCount = all.filter((e) => e.active).length;
  const capacity = all.filter((e) => e.active).reduce((sum, e) => sum + e.max_weekly_hours, 0);

  const copyInvite = async (employee: Employee) => {
    if (!employee.email) {
      toast.error("Keine E-Mail hinterlegt", { description: "Bitte zuerst eine E-Mail-Adresse eintragen." });
      return;
    }
    const url = `${window.location.origin}/register?email=${encodeURIComponent(employee.email)}`;
    const text = `Hallo ${employee.name.split(" ")[0]}, hier kannst du dich für unseren Dienstplan registrieren: ${url}`;
    await navigator.clipboard.writeText(text);
    toast.success("Einladung kopiert", {
      description: isDemoMode ? "Im Demo-Modus ist keine echte Registrierung möglich." : "Per Messenger oder E-Mail weitergeben.",
    });
  };

  const remove = async (employee: Employee) => {
    const ok = await confirmAction({
      title: `${employee.name} löschen?`,
      description: "Alle Schichten und Abwesenheiten dieses Mitarbeiters werden ebenfalls gelöscht. Tipp: Stattdessen deaktivieren, um die Historie zu behalten.",
      confirmLabel: "Endgültig löschen",
      destructive: true,
    });
    if (ok) await actions.deleteEmployee(employee.id);
  };

  const menu = (employee: Employee) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Aktionen für ${employee.name}`} onClick={(e) => e.stopPropagation()}>
          <Ellipsis />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem icon={<Pencil />} onSelect={() => setEditor({ open: true, id: employee.id })}>
          Bearbeiten
        </DropdownMenuItem>
        {!employee.user_id ? (
          <DropdownMenuItem icon={<Link2 />} onSelect={() => void copyInvite(employee)}>
            Einladung kopieren
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onSelect={() => void actions.updateEmployee(employee.id, { active: !employee.active })} icon={<Users />}>
          {employee.active ? "Deaktivieren" : "Aktivieren"}
        </DropdownMenuItem>
        {canDeleteEmployees ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive icon={<Trash />} onSelect={() => void remove(employee)}>
              Löschen
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        title="Mitarbeiter"
        description={`${activeCount} aktiv · Kapazität ${formatHours(capacity * 60)} pro Woche`}
        actions={
          canManageEmployees ? (
            <Button variant="primary" onClick={() => setEditor({ open: true, id: null })}>
              <Plus /> Mitarbeiter
            </Button>
          ) : null
        }
      >
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1 sm:max-w-72">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-subtle" />
            <Input type="search" placeholder="Name, Position oder E-Mail…" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-8" />
          </div>
          <Segmented
            value={status}
            onChange={setStatus}
            options={[
              { value: "active", label: "Aktiv" },
              { value: "inactive", label: "Inaktiv" },
              { value: "all", label: "Alle" },
            ]}
          />
        </div>
      </PageHeader>

      <div className="flex-1 px-4 py-4 sm:px-6">
        {list.length === 0 ? (
          <EmptyState
            icon={<UserPlus />}
            title={all.length === 0 ? "Noch keine Mitarbeiter" : "Keine Treffer"}
            description={all.length === 0 ? "Legen Sie Ihr Team an, um Schichten zu planen." : "Passen Sie Suche oder Filter an."}
            action={
              all.length === 0 && canManageEmployees ? (
                <Button variant="primary" onClick={() => setEditor({ open: true, id: null })}>
                  <Plus /> Ersten Mitarbeiter anlegen
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            {/* Tabelle ab Tablet */}
            <div className="hidden overflow-hidden rounded-xl border border-border bg-surface shadow-soft md:block">
              <table className="w-full text-left text-[13px]">
                <thead className="border-b border-border bg-surface-2/50 text-xs text-muted">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Name</th>
                    <th className="px-3 py-2.5 font-medium">Position</th>
                    <th className="px-3 py-2.5 text-right font-medium">Lohn</th>
                    <th className="px-3 py-2.5 font-medium">Diese Woche</th>
                    <th className="hidden px-3 py-2.5 font-medium lg:table-cell">Verfügbar</th>
                    <th className="px-3 py-2.5 font-medium">Login</th>
                    <th className="w-12 px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {list.map((employee) => (
                    <tr
                      key={employee.id}
                      onClick={() => setEditor({ open: true, id: employee.id })}
                      className={cn("cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-surface-2/60", !employee.active && "opacity-60")}
                    >
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={employee.name} color={employee.color} />
                          <div className="min-w-0">
                            <div className="truncate font-medium text-fg">{employee.name}</div>
                            <div className="truncate text-xs text-muted">{employee.email ?? "—"}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-muted">{employee.position ?? "—"}</td>
                      <td className="tabular px-3 py-2.5 text-right text-muted">{formatCurrency(employee.hourly_rate)}</td>
                      <td className="px-3 py-2.5">
                        <HoursBar minutes={weekMinutes.get(employee.id) ?? 0} max={employee.max_weekly_hours} />
                      </td>
                      <td className="hidden px-3 py-2.5 lg:table-cell">
                        <DayPills days={employee.available_days} />
                      </td>
                      <td className="px-3 py-2.5">
                        {employee.user_id ? <Badge tone="success">Verknüpft</Badge> : <Badge>Kein Login</Badge>}
                        {!employee.active ? <Badge className="ml-1">Inaktiv</Badge> : null}
                      </td>
                      <td className="px-3 py-2.5">{menu(employee)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Karten auf dem Smartphone */}
            <ul className="flex flex-col gap-2 md:hidden">
              {list.map((employee) => (
                <li
                  key={employee.id}
                  onClick={() => setEditor({ open: true, id: employee.id })}
                  className={cn("flex cursor-pointer flex-col gap-2.5 rounded-xl border border-border bg-surface p-3 shadow-soft", !employee.active && "opacity-60")}
                >
                  <div className="flex items-center gap-2.5">
                    <Avatar name={employee.name} color={employee.color} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{employee.name}</div>
                      <div className="truncate text-xs text-muted">
                        {[employee.position, formatCurrency(employee.hourly_rate) + "/h"].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                    {menu(employee)}
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <DayPills days={employee.available_days} />
                    {employee.user_id ? <Badge tone="success">Verknüpft</Badge> : <Badge>Kein Login</Badge>}
                  </div>
                  <HoursBar minutes={weekMinutes.get(employee.id) ?? 0} max={employee.max_weekly_hours} />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <EmployeeEditor open={editor.open} employeeId={editor.id} onOpenChange={(open) => setEditor((s) => ({ ...s, open }))} />
    </div>
  );
}
