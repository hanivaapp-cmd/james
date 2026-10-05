"use client";

import { Archive, CalendarDays, Check, CloudOff, Loader2, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { usePlanStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";

const NAV = [
  { href: "/", label: "Wochenplan", icon: CalendarDays },
  { href: "/mitarbeiter", label: "Mitarbeiter", icon: Users },
  { href: "/archiv", label: "Archiv", icon: Archive },
] as const;

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" || pathname.startsWith("/ansicht") : pathname.startsWith(href);
}

function SaveIndicator() {
  const saveState = usePlanStore((s) => s.saveState);
  if (saveState === "error") {
    return (
      <span className="flex items-center gap-1.5 text-sm font-medium text-danger">
        <CloudOff className="size-4" /> Nicht gespeichert
      </span>
    );
  }
  if (saveState === "saving") {
    return (
      <span className="hidden items-center gap-1.5 text-sm text-muted sm:flex">
        <Loader2 className="size-4 animate-spin" /> Speichert …
      </span>
    );
  }
  return (
    <span className="hidden items-center gap-1.5 text-sm text-muted sm:flex" title="Alle Änderungen werden automatisch gespeichert">
      <Check className="size-4 text-success" /> Automatisch gespeichert
    </span>
  );
}

function Loading() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 sm:px-6">
      <div className="h-9 w-72 animate-pulse rounded-xl bg-surface-3" />
      <div className="h-16 animate-pulse rounded-2xl bg-surface-3" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-2xl bg-surface-3" />
        ))}
      </div>
      <div className="h-96 animate-pulse rounded-2xl bg-surface-3" />
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const ready = usePlanStore((s) => s.status === "ready");

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="no-print sticky top-0 z-30 border-b border-border bg-surface/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
            <Logo className="size-9" />
            <span className="text-[17px]">Wochenplan</span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex h-10 items-center gap-2 rounded-xl px-3.5 text-[15px] font-medium transition-colors",
                  isActive(pathname, href) ? "bg-accent-soft text-accent" : "text-muted hover:bg-surface-3 hover:text-fg",
                )}
              >
                <Icon className="size-[18px]" />
                {label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto">{ready ? <SaveIndicator /> : null}</div>
        </div>
      </header>

      <main className="flex-1 pb-28 md:pb-12">{ready ? children : <Loading />}</main>

      {/* Navigation unten auf dem Smartphone */}
      <nav className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur-md md:hidden">
        <div className="safe-bottom grid grid-cols-3">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors",
                  active ? "text-accent" : "text-muted",
                )}
              >
                <span className={cn("flex h-8 w-14 items-center justify-center rounded-full", active && "bg-accent-soft")}>
                  <Icon className="size-[22px]" />
                </span>
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
