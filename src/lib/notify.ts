"use client";

import { toast } from "sonner";
import { pushPreferenceEnabled } from "@/lib/hooks/use-push";
import type { AppNotification } from "@/lib/types";

/**
 * Zeigt eine neue Benachrichtigung in der App und – falls erlaubt und die App
 * im Hintergrund ist – als System-Benachrichtigung an.
 */
export function announceNotification(note: AppNotification) {
  toast(note.title, { description: note.body ?? undefined });

  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted" || document.visibilityState === "visible") return;
  if (!pushPreferenceEnabled()) return;

  const options: NotificationOptions = {
    body: note.body ?? undefined,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: note.id,
    data: { link: note.link ?? "/" },
  };
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => registration.showNotification(note.title, options))
      .catch(() => new Notification(note.title, options));
  } else {
    new Notification(note.title, options);
  }
}
