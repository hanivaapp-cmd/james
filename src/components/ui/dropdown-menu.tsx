"use client";

import * as Menu from "@radix-ui/react-dropdown-menu";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export const DropdownMenu = Menu.Root;
export const DropdownMenuTrigger = Menu.Trigger;

export function DropdownMenuContent({ className, align = "end", ...props }: ComponentProps<typeof Menu.Content>) {
  return (
    <Menu.Portal>
      <Menu.Content
        align={align}
        sideOffset={6}
        className={cn(
          "z-50 min-w-48 overflow-hidden rounded-xl border border-border bg-surface p-1 shadow-pop data-[state=open]:animate-pop-in",
          className,
        )}
        {...props}
      />
    </Menu.Portal>
  );
}

export function DropdownMenuItem({
  className,
  icon,
  children,
  destructive,
  shortcut,
  ...props
}: ComponentProps<typeof Menu.Item> & { icon?: ReactNode; destructive?: boolean; shortcut?: string }) {
  return (
    <Menu.Item
      className={cn(
        "flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] text-fg outline-none select-none",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-surface-2 [&_svg]:size-4 [&_svg]:text-muted",
        destructive && "text-danger data-[highlighted]:bg-danger-soft [&_svg]:text-danger",
        className,
      )}
      {...props}
    >
      {icon}
      <span className="flex-1">{children}</span>
      {shortcut ? <span className="text-xs text-subtle">{shortcut}</span> : null}
    </Menu.Item>
  );
}

export function DropdownMenuLabel({ className, ...props }: ComponentProps<typeof Menu.Label>) {
  return <Menu.Label className={cn("px-2.5 pt-1.5 pb-1 text-xs font-medium text-subtle", className)} {...props} />;
}

export function DropdownMenuSeparator() {
  return <Menu.Separator className="-mx-1 my-1 h-px bg-border" />;
}
