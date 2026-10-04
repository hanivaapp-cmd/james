import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-14 text-center", className)}>
      {icon ? (
        <div className="mb-4 flex size-11 items-center justify-center rounded-xl border border-border bg-surface text-muted shadow-soft [&_svg]:size-5">
          {icon}
        </div>
      ) : null}
      <h3 className="text-sm font-semibold text-fg">{title}</h3>
      {description ? <p className="mt-1 max-w-sm text-[13px] text-muted">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
