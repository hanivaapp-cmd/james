"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

/**
 * Dialog: auf dem Smartphone als Bottom-Sheet, ab Tablet zentriert.
 */
export function DialogContent({
  title,
  description,
  children,
  footer,
  className,
  headerExtra,
  size = "md",
}: {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  headerExtra?: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px] data-[state=open]:animate-fade-in dark:bg-black/60" />
      <DialogPrimitive.Content
        aria-describedby={description ? undefined : undefined}
        className={cn(
          "fixed z-50 flex max-h-[92dvh] w-full flex-col border border-border bg-surface shadow-pop focus:outline-none",
          "inset-x-0 bottom-0 rounded-t-2xl data-[state=open]:animate-sheet-in",
          "sm:inset-x-auto sm:bottom-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:data-[state=open]:animate-dialog-in",
          size === "sm" && "sm:max-w-sm",
          size === "md" && "sm:max-w-lg",
          size === "lg" && "sm:max-w-2xl",
          className,
        )}
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-border-strong sm:hidden" />
        <div className="flex items-start gap-3 px-5 pt-4 pb-3 sm:pt-5">
          <div className="min-w-0 flex-1">
            <DialogPrimitive.Title className="text-[15px] font-semibold tracking-tight text-fg">{title}</DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="mt-0.5 text-[13px] text-muted">{description}</DialogPrimitive.Description>
            ) : (
              <DialogPrimitive.Description className="sr-only">{typeof title === "string" ? title : "Dialog"}</DialogPrimitive.Description>
            )}
          </div>
          {headerExtra}
          <DialogPrimitive.Close className="-mt-1 -mr-2 rounded-md p-1.5 text-subtle transition-colors hover:bg-surface-2 hover:text-fg">
            <X className="size-4" />
            <span className="sr-only">Schließen</span>
          </DialogPrimitive.Close>
        </div>
        <div className="scrollbar-thin flex-1 overflow-y-auto px-5 pb-4">{children}</div>
        {footer ? (
          <div className="safe-bottom flex items-center gap-2 border-t border-border bg-surface-2/50 px-5 py-3 sm:rounded-b-2xl">
            {footer}
          </div>
        ) : (
          <div className="safe-bottom" />
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
