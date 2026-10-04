"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { getRepository } from "@/lib/data";
import { errorMessage } from "@/lib/utils";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
export const PUSH_PREF_KEY = "schichtwerk-push";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function registration() {
  const existing = await navigator.serviceWorker.getRegistration();
  return existing ?? navigator.serviceWorker.register("/sw.js");
}

export function pushPreferenceEnabled() {
  try {
    return localStorage.getItem(PUSH_PREF_KEY) !== "off";
  } catch {
    return true;
  }
}

/**
 * Push-Benachrichtigungen: Erlaubnis anfragen, Gerät beim Server registrieren
 * (Web Push über Service Worker) und wieder abmelden.
 */
export function usePushNotifications() {
  // Wird nur im Browser gerendert (App-Inhalte erscheinen erst nach dem Laden der Session).
  const [supported] = useState(
    () => typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator,
  );
  const [permission, setPermission] = useState<NotificationPermission>(() =>
    supported ? Notification.permission : "default",
  );
  const [enabled, setEnabled] = useState(() => supported && Notification.permission === "granted" && pushPreferenceEnabled());
  const [busy, setBusy] = useState(false);

  const enable = useCallback(async () => {
    setBusy(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== "granted") {
        toast.error("Benachrichtigungen wurden nicht erlaubt");
        return;
      }
      localStorage.setItem(PUSH_PREF_KEY, "on");
      const repo = getRepository();
      if (repo.mode === "supabase" && VAPID_PUBLIC_KEY && "PushManager" in window) {
        const reg = await registration();
        await navigator.serviceWorker.ready;
        const subscription =
          (await reg.pushManager.getSubscription()) ??
          (await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
          }));
        const json = subscription.toJSON();
        await repo.savePushSubscription({
          endpoint: subscription.endpoint,
          p256dh: json.keys?.p256dh ?? "",
          auth: json.keys?.auth ?? "",
        });
      }
      setEnabled(true);
      toast.success("Benachrichtigungen aktiviert", {
        description: "Sie werden über Änderungen am Dienstplan informiert.",
      });
    } catch (error) {
      toast.error("Push konnte nicht aktiviert werden", { description: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }, []);

  const disable = useCallback(async () => {
    setBusy(true);
    try {
      localStorage.setItem(PUSH_PREF_KEY, "off");
      const reg = await navigator.serviceWorker.getRegistration();
      const subscription = await reg?.pushManager?.getSubscription();
      if (subscription) {
        await getRepository().deletePushSubscription(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setEnabled(false);
    } catch (error) {
      toast.error("Push konnte nicht deaktiviert werden", { description: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }, []);

  return { supported, permission, enabled, busy, enable, disable };
}
