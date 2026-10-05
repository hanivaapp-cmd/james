"use client";

import { AlertTriangle, ChevronDown, Info } from "lucide-react";
import { useState } from "react";
import type { Warning } from "@/lib/plan";
import { cn } from "@/lib/utils";

/** Kleine, aufklappbare Hinweisleiste – bewusst zurückhaltend. */
export function WarningsPanel({ warnings }: { warnings: Warning[] }) {
  const [open, setOpen] = useState(false);
  if (warnings.length === 0) return null;
  const hasWarnings = warnings.some((w) => w.level === "warning");
  const Icon = hasWarnings ? AlertTriangle : Info;

  return (
    <div className={cn("rounded-2xl border text-sm", hasWarnings ? "border-warning/25 bg-warning-soft" : "border-border bg-surface")}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center gap-2 px-4 py-2 text-left"
      >
        <Icon className={cn("size-4 shrink-0", hasWarnings ? "text-warning" : "text-muted")} />
        <span className={cn("font-medium", hasWarnings ? "text-warning" : "text-muted")}>
          {warnings.length === 1 ? "1 Hinweis" : `${warnings.length} Hinweise`}
        </span>
        {!open ? <span className="min-w-0 flex-1 truncate text-muted">{warnings[0].message}</span> : <span className="flex-1" />}
        <ChevronDown className={cn("size-4 shrink-0 text-muted transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <ul className="flex flex-col gap-1.5 px-4 pb-3">
          {warnings.map((w) => (
            <li key={w.id} className="flex items-start gap-2">
              <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", w.level === "warning" ? "bg-warning" : "bg-subtle")} />
              <span className={w.level === "warning" ? "text-fg" : "text-muted"}>{w.message}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
