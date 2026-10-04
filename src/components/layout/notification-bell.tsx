"use client";

import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import { Bell, CheckCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { actions, useAppStore } from "@/lib/store/app-store";
import { cn } from "@/lib/utils";
import { PushToggle } from "./push-toggle";

export function NotificationBell({ align = "end" }: { align?: "start" | "end" }) {
  const notifications = useAppStore((s) => s.notifications);
  const unread = notifications.filter((n) => !n.read_at).length;
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="relative" aria-label={`Benachrichtigungen (${unread} ungelesen)`}>
          <Bell />
          {unread > 0 ? (
            <span className="absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] leading-4 font-semibold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-[min(22rem,calc(100vw-24px))] p-0">
        <div className="flex items-center justify-between border-b border-border px-3.5 py-2.5">
          <span className="text-sm font-semibold">Benachrichtigungen</span>
          {unread > 0 ? (
            <Button variant="ghost" size="sm" onClick={() => actions.markNotificationsRead()}>
              <CheckCheck /> Alle gelesen
            </Button>
          ) : null}
        </div>
        <div className="scrollbar-thin max-h-96 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="px-4 py-10 text-center text-[13px] text-muted">Keine Benachrichtigungen</p>
          ) : (
            notifications.map((note) => (
              <Link
                key={note.id}
                href={note.link ?? "#"}
                onClick={() => {
                  if (!note.read_at) void actions.markNotificationsRead([note.id]);
                  setOpen(false);
                }}
                className="flex gap-3 border-b border-border px-3.5 py-3 transition-colors last:border-0 hover:bg-surface-2"
              >
                <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", note.read_at ? "bg-transparent" : "bg-accent")} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium text-fg">{note.title}</span>
                  {note.body ? <span className="block text-[13px] text-muted">{note.body}</span> : null}
                  <span className="mt-0.5 block text-xs text-subtle">
                    {formatDistanceToNow(new Date(note.created_at), { addSuffix: true, locale: de })}
                  </span>
                </span>
              </Link>
            ))
          )}
        </div>
        <div className="border-t border-border px-3.5 py-2.5">
          <PushToggle />
        </div>
      </PopoverContent>
    </Popover>
  );
}
