"use client";

import { useDraggable } from "@dnd-kit/core";
import { GripVertical } from "lucide-react";
import type { ShiftType } from "@/lib/types";
import { cn, tint } from "@/lib/utils";

export function PaletteItemView({ type, overlay }: { type: ShiftType; overlay?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex cursor-grab items-center gap-1.5 rounded-lg border py-1 pr-2.5 pl-1.5 text-xs font-medium whitespace-nowrap text-fg select-none active:cursor-grabbing",
        overlay && "shadow-drag",
      )}
      style={{ background: tint(type.color, 12), borderColor: tint(type.color, 30) }}
    >
      <GripVertical className="size-3.5 text-subtle" />
      <span className="size-2 rounded-full" style={{ background: type.color }} />
      {type.name}
      <span className="tabular font-normal text-muted">
        {type.default_start}–{type.default_end}
      </span>
    </span>
  );
}

function PaletteItem({ type }: { type: ShiftType }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `template:${type.id}`,
    data: { kind: "template", shiftTypeId: type.id },
  });
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} className={cn("touch-manipulation", isDragging && "opacity-40")}>
      <PaletteItemView type={type} />
    </div>
  );
}

/** Schichtvorlagen, die in den Plan gezogen werden können. */
export function ShiftPalette({ types }: { types: ShiftType[] }) {
  if (types.length === 0) return null;
  return (
    <div className="scrollbar-thin flex items-center gap-2 overflow-x-auto">
      <span className="hidden shrink-0 text-xs text-subtle sm:inline">In den Plan ziehen:</span>
      {types.map((type) => (
        <PaletteItem key={type.id} type={type} />
      ))}
    </div>
  );
}
