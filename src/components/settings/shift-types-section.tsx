"use client";

import { Plus, Trash } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { confirmAction } from "@/components/ui/confirm";
import { Input } from "@/components/ui/input";
import { useAutosave } from "@/lib/hooks/use-autosave";
import { actions, useAppStore } from "@/lib/store/app-store";
import type { ShiftType } from "@/lib/types";

function ShiftTypeRow({ type }: { type: ShiftType }) {
  const [draft, setDraft] = useState(type);
  const valid = draft.name.trim().length > 0 && draft.default_start !== draft.default_end;
  useAutosave(draft, (value) => actions.updateShiftType(type.id, { ...value, name: value.name.trim() }), { enabled: valid });
  const update = (patch: Partial<ShiftType>) => setDraft((d) => ({ ...d, ...patch }));

  const remove = async () => {
    const ok = await confirmAction({
      title: `„${type.name}“ löschen?`,
      description: "Bestehende Schichten bleiben erhalten, verlieren aber ihre Schichtart.",
      confirmLabel: "Löschen",
      destructive: true,
    });
    if (ok) await actions.deleteShiftType(type.id);
  };

  return (
    <li className="grid grid-cols-[auto_1fr_auto] items-center gap-2 border-b border-border py-2.5 last:border-0 sm:grid-cols-[auto_1fr_124px_124px_90px_auto]">
      <input
        type="color"
        value={draft.color}
        onChange={(e) => update({ color: e.target.value })}
        aria-label="Farbe"
        className="size-8 cursor-pointer rounded-md border border-border bg-transparent p-0.5"
      />
      <Input value={draft.name} onChange={(e) => update({ name: e.target.value })} aria-label="Name" aria-invalid={!draft.name.trim()} />
      <Button size="icon-sm" variant="ghost" onClick={remove} aria-label={`${type.name} löschen`} className="sm:order-last">
        <Trash />
      </Button>
      <div className="col-span-3 grid grid-cols-3 gap-2 sm:col-span-3 sm:contents">
        <Input type="time" value={draft.default_start} onChange={(e) => update({ default_start: e.target.value })} aria-label="Beginn" />
        <Input type="time" value={draft.default_end} onChange={(e) => update({ default_end: e.target.value })} aria-label="Ende" />
        <div className="relative">
          <Input
            type="number"
            min={0}
            max={720}
            step={5}
            value={draft.default_break_minutes}
            onChange={(e) => update({ default_break_minutes: Math.max(0, Number(e.target.value) || 0) })}
            aria-label="Pause in Minuten"
            className="pr-10"
          />
          <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-subtle">min</span>
        </div>
      </div>
    </li>
  );
}

export function ShiftTypesSection() {
  const table = useAppStore((s) => s.shiftTypes);
  const types = useMemo(() => Object.values(table).sort((a, b) => a.sort_order - b.sort_order), [table]);
  return (
    <div>
      <div className="hidden grid-cols-[auto_1fr_110px_110px_90px_auto] gap-2 pb-1 text-xs text-subtle sm:grid">
        <span className="w-8" />
        <span>Name</span>
        <span>Beginn</span>
        <span>Ende</span>
        <span>Pause</span>
        <span className="w-8" />
      </div>
      <ul>
        {types.map((type) => (
          <ShiftTypeRow key={type.id} type={type} />
        ))}
      </ul>
      <Button
        size="sm"
        className="mt-3"
        onClick={() =>
          void actions.createShiftType({
            name: "Neue Schicht",
            color: "#10b981",
            default_start: "09:00",
            default_end: "17:00",
            default_break_minutes: 30,
            sort_order: (types[types.length - 1]?.sort_order ?? 0) + 1,
          })
        }
      >
        <Plus /> Schichtart hinzufügen
      </Button>
    </div>
  );
}
