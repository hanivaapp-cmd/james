"use client";

import { RefreshCw } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { usePermissions } from "@/lib/hooks/use-permissions";
import { actions, useAppStore } from "@/lib/store/app-store";
import { isDemoMode } from "@/lib/supabase/config";
import { cn } from "@/lib/utils";
import { DemoSwitcher } from "./demo-switcher";
import { Logo, LogoMark } from "./logo";
import { visibleNavItems } from "./nav-items";
import { NotificationBell } from "./notification-bell";
import { SyncIndicator } from "./sync-indicator";
import { UserMenu } from "./user-menu";

function useNavItems() {
  const { isStaff, employeeId } = usePermissions();
  return visibleNavItems(isStaff, Boolean(employeeId));
}

function Sidebar() {
  const pathname = usePathname();
  const items = useNavItems();
  return (
    <aside className="hidden h-full w-60 shrink-0 flex-col border-r border-border bg-bg px-3 py-4 lg:flex">
      <div className="flex items-center justify-between px-2 pb-5">
        <Link href="/" aria-label="Startseite">
          <Logo />
        </Link>
        <NotificationBell align="start" />
      </div>
      <nav className="flex flex-col gap-0.5">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13.5px] font-medium transition-colors [&_svg]:size-4",
                active ? "bg-surface text-fg shadow-soft ring-1 ring-border" : "text-muted hover:bg-surface-2 hover:text-fg",
              )}
            >
              <item.icon className={active ? "text-accent" : undefined} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto flex flex-col gap-3">
        {isDemoMode ? <DemoSwitcher /> : null}
        <div className="px-2">
          <SyncIndicator />
        </div>
        <UserMenu />
      </div>
    </aside>
  );
}

function MobileTopBar() {
  return (
    <header className="z-30 flex h-13 shrink-0 items-center gap-2 border-b border-border bg-bg px-4 lg:hidden">
      <Link href="/" className="flex items-center gap-2" aria-label="Startseite">
        <LogoMark className="size-6" />
        <span className="text-[15px] font-semibold tracking-tight">Schichtwerk</span>
      </Link>
      <div className="ml-auto flex items-center gap-1">
        <SyncIndicator compact />
        <NotificationBell />
        <UserMenu variant="avatar" />
      </div>
    </header>
  );
}

function MobileTabBar() {
  const pathname = usePathname();
  const items = useNavItems();
  return (
    <nav className="safe-bottom z-30 shrink-0 border-t border-border bg-surface lg:hidden">
      <div className="mx-auto flex max-w-lg">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10.5px] font-medium transition-colors",
                active ? "text-accent" : "text-subtle",
              )}
            >
              <item.icon className="size-5" />
              {item.short}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const status = useAppStore((s) => s.status);
  const error = useAppStore((s) => s.error);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    void actions.bootstrap();
  }, []);

  useEffect(() => {
    if (status === "signed-out") router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [status, router, pathname]);

  // Nach Rückkehr in den Tab / Wiederverbindung frisch laden.
  useEffect(() => {
    const onOnline = () => void actions.refresh();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);

  if (status === "error") {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <EmptyState
          icon={<RefreshCw />}
          title="Daten konnten nicht geladen werden"
          description={error ?? undefined}
          action={<Button onClick={() => void actions.refresh()}>Erneut versuchen</Button>}
        />
      </div>
    );
  }

  if (status !== "ready") {
    return (
      <div className="flex min-h-dvh items-center justify-center gap-3 text-sm text-muted">
        <Spinner /> Lädt Dienstplan…
      </div>
    );
  }

  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileTopBar />
        <main className="scrollbar-thin flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">{children}</main>
        <MobileTabBar />
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions: headerActions,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="border-b border-border bg-bg px-4 pt-4 pb-3 sm:px-6 sm:pb-4 lg:pt-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight text-fg">{title}</h1>
          {description ? <p className="mt-0.5 text-[13px] text-muted">{description}</p> : null}
        </div>
        {headerActions ? <div className="flex shrink-0 items-center gap-2">{headerActions}</div> : null}
      </div>
      {children}
    </div>
  );
}
