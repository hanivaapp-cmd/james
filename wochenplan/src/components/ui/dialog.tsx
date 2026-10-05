"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogClose = DialogPrimitive.Close;

/**
 * Dialog: auf dem Smartphone als Bottom-Sheet (Daumen-freundlich), ab Tablet zentriert.
 */
export function DialogContent({
  title,
  description,
  children,
  footer,
  className,
  size = "md",
  onOpenAutoFocus,
}: {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  onOpenAutoFocus?: ComponentProps<typeof DialogPrimitive.Content>["onOpenAutoFocus"];
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/35 backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
      <DialogPrimitive.Content
        onOpenAutoFocus={onOpenAutoFocus}
        className={cn(
          "fixed z-50 flex max-h-[92dvh] w-full flex-col bg-surface shadow-pop focus:outline-none",
          "inset-x-0 bottom-0 rounded-t-3xl data-[state=open]:animate-sheet-in",
          "sm:inset-x-auto sm:bottom-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:data-[state=open]:animate-dialog-in",
          size === "sm" && "sm:max-w-sm",
          size === "md" && "sm:max-w-lg",
          size === "lg" && "sm:max-w-2xl",
          size === "xl" && "sm:max-w-3xl",
          className,
        )}
      >
        <div className="mx-auto mt-2.5 h-1.5 w-12 shrink-0 rounded-full bg-border-strong sm:hidden" />
        <div className="flex items-start gap-3 px-5 pt-4 pb-3 sm:px-6 sm:pt-6">
          <div className="min-w-0 flex-1">
            <DialogPrimitive.Title className="text-lg leading-tight font-semibold tracking-tight text-fg">
              {title}
            </DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="mt-1 text-sm text-muted">{description}</DialogPrimitive.Description>
            ) : (
              <DialogPrimitive.Description className="sr-only">
                {typeof title === "string" ? title : "Dialog"}
              </DialogPrimitive.Description>
            )}
          </div>
          <DialogPrimitive.Close className="-mt-1 -mr-2 rounded-xl p-2 text-subtle transition-colors hover:bg-surface-3 hover:text-fg">
            <X className="size-5" />
            <span className="sr-only">Schließen</span>
          </DialogPrimitive.Close>
        </div>
        <div className="scrollbar-thin flex-1 overflow-y-auto px-5 pb-5 sm:px-6">{children}</div>
        {footer ? (
          <div className="pb-safe border-t border-border bg-surface-2 px-5 pt-3 sm:rounded-b-3xl sm:px-6">
            <div className="flex flex-wrap items-center gap-2">
              {footer}
            </div>
          </div>
        ) : (
          <div className="safe-bottom" />
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
