import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-7", className)} aria-hidden>
      <rect width="32" height="32" rx="8" fill="var(--accent)" />
      <rect x="7" y="9" width="11" height="4" rx="2" fill="#fff" opacity="0.95" />
      <rect x="11" y="15" width="14" height="4" rx="2" fill="#fff" opacity="0.75" />
      <rect x="7" y="21" width="8" height="4" rx="2" fill="#fff" opacity="0.55" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark />
      <span className="text-[15px] font-semibold tracking-tight text-fg">Schichtwerk</span>
    </span>
  );
}
