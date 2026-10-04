"use client";

import { LogOut, Settings } from "lucide-react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { actions, useAppStore } from "@/lib/store/app-store";
import { ROLE_LABELS } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./theme-toggle";

export function UserMenu({ variant = "full" }: { variant?: "full" | "avatar" }) {
  const session = useAppStore((s) => s.session);
  const router = useRouter();
  if (!session) return null;
  const { profile } = session;
  const name = profile.full_name || profile.email;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex cursor-pointer items-center gap-2.5 rounded-lg text-left outline-none transition-colors hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-accent",
          variant === "full" ? "w-full px-2 py-1.5" : "p-1",
        )}
      >
        <Avatar name={name} color="#5e6ad2" size={variant === "full" ? "md" : "sm"} />
        {variant === "full" ? (
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-medium text-fg">{name}</span>
            <span className="block truncate text-xs text-muted">{ROLE_LABELS[profile.role]}</span>
          </span>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={variant === "full" ? "start" : "end"} side={variant === "full" ? "top" : "bottom"} className="w-64">
        <DropdownMenuLabel>
          <span className="block truncate text-[13px] text-fg">{name}</span>
          <span className="block truncate font-normal">{profile.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="px-2.5 py-1.5">
          <ThemeToggle withLabels />
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem icon={<Settings />} onSelect={() => router.push("/settings")}>
          Einstellungen
        </DropdownMenuItem>
        <DropdownMenuItem
          icon={<LogOut />}
          onSelect={async () => {
            await actions.signOut();
            router.replace("/login");
          }}
        >
          Abmelden
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
