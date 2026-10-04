import { cn, initials, tint } from "@/lib/utils";

export function Avatar({ name, color, size = "md", className }: { name: string; color: string; size?: "sm" | "md" | "lg"; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold select-none",
        size === "sm" && "size-6 text-[10px]",
        size === "md" && "size-8 text-xs",
        size === "lg" && "size-10 text-sm",
        className,
      )}
      style={{ background: tint(color, 18), color }}
    >
      {initials(name)}
    </span>
  );
}
