"use client";

import { CalendarDays, CalendarRange, ChevronLeft, ChevronRight, CopyPlus, Ellipsis, Funnel, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Segmented } from "@/components/ui/segmented";
import { Switch } from "@/components/ui/switch";
import { formatRangeLabel, stepDate, todayISO, weekStart, addDaysISO } from "@/lib/schedule/dates";
import { confirmAction } from "@/components/ui/confirm";
import { actions } from "@/lib/store/app-store";
import { useViewStore } from "@/lib/store/view-store";
import type { ShiftType } from "@/lib/types";
import { cn } from "@/lib/utils";

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function FilterPopover({ positions, shiftTypes }: { positions: string[]; shiftTypes: ShiftType[] }) {
  const view = useViewStore();
  const active = view.positions.length + view.shiftTypeIds.length + (view.onlyIssues ? 1 : 0);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button className={cn(active > 0 && "border-accent/40 text-accent")} aria-label="Filter">
          <Funnel />
          <span className="max-sm:hidden">Filter</span>
          {active > 0 ? <Badge tone="accent">{active}</Badge> : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="flex flex-col gap-4">
          {positions.length > 0 ? (
            <div>
              <p className="mb-2 text-xs font-medium text-muted">Position</p>
              <div className="flex flex-wrap gap-1.5">
                {positions.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => view.setPositions(toggle(view.positions, p))}
                    className={cn(
                      "cursor-pointer rounded-md border px-2 py-1 text-xs font-medium transition-colors",
                      view.positions.includes(p) ? "border-accent bg-accent-soft text-accent" : "border-border text-muted hover:text-fg",
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <div>
            <p className="mb-2 text-xs font-medium text-muted">Schichtart</p>
            <div className="flex flex-wrap gap-1.5">
              {[...shiftTypes, { id: "none", name: "Individuell", color: "#94a3b8" } as ShiftType].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => view.setShiftTypeIds(toggle(view.shiftTypeIds, t.id))}
                  className={cn(
                    "inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium transition-colors",
                    view.shiftTypeIds.includes(t.id) ? "border-accent bg-accent-soft text-accent" : "border-border text-muted hover:text-fg",
                  )}
                >
                  <span className="size-2 rounded-full" style={{ background: t.color }} />
                  {t.name}
                </button>
              ))}
            </div>
          </div>
          <label className="flex cursor-pointer items-center justify-between gap-3 text-[13px]">
            Nur Mitarbeiter mit Warnungen
            <Switch checked={view.onlyIssues} onCheckedChange={view.setOnlyIssues} />
          </label>
          {active > 0 ? (
            <Button variant="ghost" size="sm" onClick={view.resetFilters} className="self-start">
              <X /> Filter zurücksetzen
            </Button>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function ScheduleToolbar({
  positions,
  shiftTypes,
  editable,
}: {
  positions: string[];
  shiftTypes: ShiftType[];
  editable: boolean;
}) {
  const { view, date, search, setView, setDate, setSearch } = useViewStore();
  const isCurrent = view === "week" ? weekStart(date) === weekStart(todayISO()) : date.slice(0, 7) === todayISO().slice(0, 7);

  const copyPreviousWeek = async () => {
    const target = weekStart(date);
    const ok = await confirmAction({
      title: "Vorwoche kopieren?",
      description: "Alle Schichten der Vorwoche werden in die aktuelle Woche übernommen. Bereits vorhandene identische Schichten werden übersprungen.",
      confirmLabel: "Kopieren",
    });
    if (ok) await actions.copyWeek(addDaysISO(target, -7), target);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1">
        <Button size="icon" variant="ghost" onClick={() => setDate(stepDate(view, date, -1))} aria-label="Zurück">
          <ChevronLeft />
        </Button>
        <Button size="icon" variant="ghost" onClick={() => setDate(stepDate(view, date, 1))} aria-label="Weiter">
          <ChevronRight />
        </Button>
        <label className="relative cursor-pointer rounded-lg px-1.5 py-1 transition-colors hover:bg-surface-2">
          <span className="text-sm font-semibold tracking-tight whitespace-nowrap sm:text-[15px]">{formatRangeLabel(view, date)}</span>
          <input
            type="date"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
            aria-label="Zu Datum springen"
          />
        </label>
        {!isCurrent ? (
          <Button size="sm" variant="ghost" onClick={() => setDate(todayISO())} className="text-accent">
            Heute
          </Button>
        ) : null}
      </div>

      <div className="ml-auto flex w-full items-center gap-2 sm:w-auto">
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { value: "week", label: "Woche", icon: <CalendarRange className="max-sm:hidden" /> },
            { value: "month", label: "Monat", icon: <CalendarDays className="max-sm:hidden" /> },
          ]}
        />
        <div className="relative min-w-0 flex-1 sm:w-52 sm:flex-none">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-subtle" />
          <Input
            type="search"
            placeholder="Mitarbeiter suchen…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
            aria-label="Mitarbeiter suchen"
          />
        </div>
        <FilterPopover positions={positions} shiftTypes={shiftTypes} />
        {editable && view === "week" ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" aria-label="Weitere Aktionen">
                <Ellipsis />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem icon={<CopyPlus />} onSelect={copyPreviousWeek}>
                Vorwoche kopieren
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </div>
  );
}
