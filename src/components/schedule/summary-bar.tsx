"use client";

import { Clock, Euro, Hourglass, TriangleAlert, Users } from "lucide-react";
import type { ReactNode } from "react";
import { formatHours } from "@/lib/schedule/calc";
import { cn, formatCurrency } from "@/lib/utils";
import type { ScheduleData } from "./use-schedule-data";

function Stat({
  icon,
  label,
  value,
  tone,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  tone?: "danger" | "warning";
  onClick?: () => void;
}) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "flex min-w-fit flex-1 items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2 text-left shadow-soft sm:py-2.5 [&_svg]:size-4",
        onClick && "cursor-pointer transition-colors hover:border-border-strong",
      )}
    >
      <span
        className={cn(
          "hidden size-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-muted sm:flex",
          tone === "danger" && "bg-danger-soft text-danger",
          tone === "warning" && "bg-warning-soft text-warning",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-[11px] whitespace-nowrap text-muted">{label}</span>
        <span className="tabular block text-sm font-semibold whitespace-nowrap text-fg">{value}</span>
      </span>
    </Comp>
  );
}

export function SummaryBar({
  data,
  showCost,
  onShowIssues,
}: {
  data: ScheduleData;
  showCost: boolean;
  onShowIssues: () => void;
}) {
  const { summary, rangeIssues, view } = data;
  const errors = rangeIssues.filter((i) => i.severity === "error").length;
  const warnings = rangeIssues.filter((i) => i.severity === "warning").length;
  const staffed = summary.byEmployee.size;

  return (
    <div className="scrollbar-thin flex gap-2 overflow-x-auto pb-0.5">
      <Stat icon={<Clock />} label={view === "week" ? "Stunden (Woche)" : "Stunden (Monat)"} value={formatHours(summary.totalMinutes)} />
      <Stat icon={<Users />} label="Eingeplant" value={`${staffed} MA · ${summary.shiftCount} Schichten`} />
      {showCost ? <Stat icon={<Euro />} label="Personalkosten" value={formatCurrency(summary.totalCost)} /> : null}
      <Stat
        icon={<Hourglass />}
        label="Überstunden"
        value={formatHours(summary.overtimeMinutes)}
        tone={summary.overtimeMinutes > 0 ? "warning" : undefined}
      />
      <Stat
        icon={<TriangleAlert />}
        label="Warnungen"
        value={
          errors + warnings === 0
            ? "Keine"
            : [errors ? `${errors} ${errors === 1 ? "Konflikt" : "Konflikte"}` : null, warnings ? `${warnings} ${warnings === 1 ? "Hinweis" : "Hinweise"}` : null]
                .filter(Boolean)
                .join(" · ")
        }
        tone={errors > 0 ? "danger" : warnings > 0 ? "warning" : undefined}
        onClick={onShowIssues}
      />
    </div>
  );
}
