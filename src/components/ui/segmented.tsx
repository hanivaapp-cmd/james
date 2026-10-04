"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  size = "md",
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: ReactNode; icon?: ReactNode }[];
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div role="radiogroup" className={cn("inline-flex rounded-lg border border-border bg-surface-2 p-0.5", className)}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-md px-3 font-medium text-muted transition-all [&_svg]:size-3.5",
            size === "md" ? "h-8 text-[13px]" : "h-7 text-xs",
            value === option.value ? "bg-surface text-fg shadow-soft" : "hover:text-fg",
          )}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  );
}
