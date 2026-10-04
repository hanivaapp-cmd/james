"use client";

import { Check, CloudOff, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store/app-store";
import { cn } from "@/lib/utils";

/** Zeigt an, ob alle Änderungen gespeichert sind. */
export function SyncIndicator({ compact = false }: { compact?: boolean }) {
  const { pending, error } = useAppStore((s) => s.sync);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  let icon = <Check className="size-3.5" />;
  let label = "Alles gespeichert";
  let tone = "text-subtle";
  if (!online) {
    icon = <CloudOff className="size-3.5" />;
    label = "Offline";
    tone = "text-warning";
  } else if (pending > 0) {
    icon = <LoaderCircle className="size-3.5 animate-spin" />;
    label = "Speichert…";
    tone = "text-muted";
  } else if (error) {
    icon = <CloudOff className="size-3.5" />;
    label = "Nicht gespeichert";
    tone = "text-danger";
  }

  if (compact && online && pending === 0 && !error) return null;

  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs", tone)} title={error ?? label} aria-live="polite">
      {icon}
      {compact ? <span className="sr-only">{label}</span> : label}
    </span>
  );
}
