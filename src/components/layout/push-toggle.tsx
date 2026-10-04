"use client";

import { BellRing } from "lucide-react";
import { usePushNotifications } from "@/lib/hooks/use-push";
import { Switch } from "@/components/ui/switch";

export function PushToggle() {
  const push = usePushNotifications();
  if (!push.supported) {
    return <p className="text-xs text-subtle">Push-Benachrichtigungen werden von diesem Browser nicht unterstützt.</p>;
  }
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-[13px]">
      <BellRing className="size-4 text-muted" />
      <span className="flex-1">
        Push-Benachrichtigungen
        {push.permission === "denied" ? (
          <span className="block text-xs text-danger">Im Browser blockiert – bitte in den Website-Einstellungen erlauben.</span>
        ) : null}
      </span>
      <Switch
        checked={push.enabled}
        disabled={push.busy || push.permission === "denied"}
        onCheckedChange={(checked) => (checked ? push.enable() : push.disable())}
      />
    </label>
  );
}
