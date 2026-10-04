"use client";

import { Sparkles } from "lucide-react";
import { LocalRepository, type DemoRole } from "@/lib/data/local-repository";
import { useAppStore } from "@/lib/store/app-store";
import { cn } from "@/lib/utils";

const ROLES: { role: DemoRole; label: string }[] = [
  { role: "admin", label: "Admin" },
  { role: "manager", label: "Manager" },
  { role: "employee", label: "Mitarbeiter" },
];

/** Im Demo-Modus zwischen den Rollen wechseln, um die Rechte auszuprobieren. */
export function DemoSwitcher() {
  const role = useAppStore((s) => s.session?.profile.role);
  return (
    <div className="rounded-xl border border-dashed border-border-strong bg-surface p-2.5">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted">
        <Sparkles className="size-3.5 text-accent" /> Demo – Rolle wechseln
      </p>
      <div className="grid grid-cols-3 gap-1">
        {ROLES.map((r) => (
          <button
            key={r.role}
            type="button"
            onClick={() => {
              LocalRepository.signIn(r.role);
              window.location.href = r.role === "employee" ? "/my" : "/plan";
            }}
            className={cn(
              "cursor-pointer rounded-md px-1 py-1 text-[11px] font-medium transition-colors",
              role === r.role ? "bg-accent text-accent-fg" : "bg-surface-2 text-muted hover:text-fg",
            )}
          >
            {r.label}
          </button>
        ))}
      </div>
    </div>
  );
}
