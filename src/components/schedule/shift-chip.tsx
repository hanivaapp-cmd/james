"use client";

import { useDraggable } from "@dnd-kit/core";
import { CircleAlert, Info, MapPin, StickyNote, TriangleAlert } from "lucide-react";
import { memo } from "react";
import { crossesMidnight, formatHours, shiftNetMinutes } from "@/lib/schedule/calc";
import { worstSeverity, type Issue } from "@/lib/schedule/conflicts";
import type { Employee, Shift, ShiftType } from "@/lib/types";
import { cn, tint } from "@/lib/utils";

export const SeverityIcon = ({ severity, className }: { severity: Issue["severity"]; className?: string }) => {
  if (severity === "error") return <CircleAlert className={cn("text-danger", className)} />;
  if (severity === "warning") return <TriangleAlert className={cn("text-warning", className)} />;
  return <Info className={cn("text-info", className)} />;
};

interface ChipProps {
  shift: Shift;
  type?: ShiftType;
  employee?: Employee;
  issues?: Issue[];
  variant?: "full" | "compact";
  onClick?: () => void;
  dragging?: boolean;
  overlay?: boolean;
}

/** Darstellung einer Schicht (ohne Drag-Logik). */
export const ShiftChipView = memo(function ShiftChipView({
  shift,
  type,
  employee,
  issues,
  variant = "full",
  onClick,
  dragging,
  overlay,
}: ChipProps) {
  const color = type?.color ?? employee?.color ?? "#64748b";
  const severity = worstSeverity(issues);
  const title = [
    `${shift.start_time}–${shift.end_time}${crossesMidnight(shift) ? " (+1 Tag)" : ""}`,
    type?.name,
    employee?.name,
    shift.location,
    `${formatHours(shiftNetMinutes(shift))} netto, ${shift.break_minutes} min Pause`,
    shift.notes,
    ...(issues ?? []).map((i) => `⚠ ${i.message}`),
  ]
    .filter(Boolean)
    .join("\n");

  if (variant === "compact") {
    return (
      <button
        type="button"
        onClick={onClick}
        title={title}
        className={cn(
          "flex w-full min-w-0 cursor-pointer items-center gap-1.5 rounded-[5px] px-1.5 py-[3px] text-left text-[11px] leading-tight transition-[filter] hover:brightness-95 dark:hover:brightness-125",
          dragging && "opacity-40",
          overlay && "shadow-drag",
        )}
        style={{ background: tint(color, 14) }}
      >
        <span className="size-1.5 shrink-0 rounded-full" style={{ background: color }} />
        <span className="tabular shrink-0 font-medium text-fg">{shift.start_time.slice(0, 5)}</span>
        <span className="truncate text-muted">{employee?.name.split(" ")[0] ?? type?.name}</span>
        {severity ? <SeverityIcon severity={severity} className="ml-auto size-3 shrink-0" /> : null}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        "group/chip relative flex w-full min-w-0 cursor-pointer flex-col gap-0.5 overflow-hidden rounded-md border py-1 pr-1.5 pl-2.5 text-left transition-[filter,box-shadow] hover:brightness-[0.97] dark:hover:brightness-125",
        dragging && "opacity-40",
        overlay && "rotate-1 shadow-drag",
        severity === "error" && "ring-1 ring-danger/60",
      )}
      style={{ background: tint(color, 12), borderColor: tint(color, 28) }}
    >
      <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: color }} />
      <span className="flex items-center gap-1">
        <span className="tabular text-xs font-semibold text-fg">
          {shift.start_time}–{shift.end_time}
        </span>
        {severity ? <SeverityIcon severity={severity} className="ml-auto size-3.5 shrink-0" /> : null}
      </span>
      <span className="flex min-w-0 items-center gap-1 text-[11px] text-muted">
        <span className="truncate">{type?.name ?? "Schicht"}</span>
        {shift.location ? <MapPin className="size-3 shrink-0 opacity-70" aria-label={shift.location} /> : null}
        {shift.notes ? <StickyNote className="size-3 shrink-0 opacity-70" aria-label="Notiz" /> : null}
      </span>
    </button>
  );
});

/** Ziehbare Schicht. */
export function DraggableShift(props: ChipProps & { disabled?: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `shift:${props.shift.id}`,
    data: { kind: "shift", shiftId: props.shift.id },
    disabled: props.disabled,
  });
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} className="touch-manipulation" role="presentation" tabIndex={-1}>
      <ShiftChipView {...props} dragging={isDragging} />
    </div>
  );
}
