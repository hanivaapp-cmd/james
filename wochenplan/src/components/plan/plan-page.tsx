"use client";

import { CalendarPlus, Eraser, Eye, History, LayoutTemplate, MoreHorizontal, Save, Smartphone, Timer, UserPlus } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type ComponentProps, type ReactNode } from "react";
import { EmployeeDialog, type EmployeeDialogState } from "@/components/employees/employee-dialog";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { computeWarnings, countEntries, previousFilledWeek } from "@/lib/plan";
import { usePlanStore } from "@/lib/store";
import type { DayIndex } from "@/lib/types";
import { cn } from "@/lib/utils";
import { shiftWeek, weekNumber } from "@/lib/week";
import { BulkEntryDialog } from "./bulk-entry-dialog";
import { EntryEditor, type EditorTarget } from "./entry-editor";
import { NewWeekDialog } from "./new-week-dialog";
import { NoteDialog } from "./note-dialog";
import { ApplyTemplateDialog, SaveTemplateDialog } from "./template-dialogs";
import { WarningsPanel } from "./warnings-panel";
import { clearWholeWeek, takeOverPreviousWeek } from "./week-actions";
import { WeekGrid } from "./week-grid";
import { WeekPicker } from "./week-picker";

export function PlanPage() {
  const weekStart = usePlanStore((s) => s.selectedWeek);
  const week = usePlanStore((s) => s.weeks[weekStart]);
  const weeks = usePlanStore((s) => s.weeks);
  const employees = usePlanStore((s) => s.employees);
  const templates = usePlanStore((s) => s.templates);

  const [editor, setEditor] = useState<EditorTarget | null>(null);
  const [noteDay, setNoteDay] = useState<DayIndex | null>(null);
  const [bulk, setBulk] = useState<{ employeeId?: string } | null>(null);
  const [newWeekOpen, setNewWeekOpen] = useState(false);
  const [employeeDialog, setEmployeeDialog] = useState<EmployeeDialogState>(null);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [applyTemplateOpen, setApplyTemplateOpen] = useState(false);

  const warnings = useMemo(() => computeWarnings(employees, week), [employees, week]);
  const entryCount = countEntries(week?.entries);
  const source = previousFilledWeek(weeks, weekStart);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 pt-5 sm:px-6 sm:pt-8">
      <header className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Wöchentlicher Arbeitsplan</h1>
        <WeekPicker />
      </header>

      {/* Die wichtigsten Aktionen als große Buttons */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-5">
        <Tile variant="primary" icon={<CalendarPlus />} className="col-span-2 lg:col-span-1" onClick={() => setNewWeekOpen(true)}>
          Wochenplan erstellen
        </Tile>
        <Tile icon={<Timer />} onClick={() => setBulk({})}>
          Arbeitszeit eintragen
        </Tile>
        <Tile icon={<Eye />} href="/ansicht">
          Wochenplan anzeigen
        </Tile>
        <Tile variant="whatsapp" icon={<Smartphone />} href="/ansicht">
          Für WhatsApp exportieren
        </Tile>
        <Tile icon={<UserPlus />} onClick={() => setEmployeeDialog({ mode: "add", area: "kitchen" })}>
          Mitarbeiter
        </Tile>
      </div>

      {entryCount === 0 ? (
        <div className="flex flex-col gap-3 rounded-2xl border-2 border-dashed border-accent/30 bg-accent-soft/40 p-4 sm:flex-row sm:items-center sm:p-5">
          <div className="flex-1">
            <p className="text-base font-semibold">KW {weekNumber(weekStart)} ist noch leer.</p>
            <p className="text-sm text-muted">Am schnellsten: den letzten Plan übernehmen und nur die Änderungen anpassen.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            {source ? (
              <Button variant="primary" onClick={() => takeOverPreviousWeek(weekStart)}>
                <History /> {source.weekStart === shiftWeek(weekStart, -1) ? "Letzte Woche übernehmen" : `KW ${weekNumber(source.weekStart)} übernehmen`}
              </Button>
            ) : null}
            {templates.length > 0 ? (
              <Button onClick={() => setApplyTemplateOpen(true)}>
                <LayoutTemplate /> Vorlage verwenden
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border px-4 py-3 sm:px-5">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold">Wochenübersicht</h2>
            <p className="text-sm text-muted">Auf eine Zelle tippen, um die Zeit einzutragen.</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="md">
                <MoreHorizontal /> Mehr
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem icon={<History />} onSelect={() => takeOverPreviousWeek(weekStart)} disabled={!source}>
                Letzte Woche übernehmen
              </DropdownMenuItem>
              <DropdownMenuItem icon={<LayoutTemplate />} onSelect={() => setApplyTemplateOpen(true)} disabled={templates.length === 0}>
                Vorlage verwenden
              </DropdownMenuItem>
              <DropdownMenuItem icon={<Save />} onSelect={() => setSaveTemplateOpen(true)} disabled={entryCount === 0}>
                Als Vorlage speichern
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem icon={<Eraser />} destructive onSelect={() => clearWholeWeek(weekStart)} disabled={!week}>
                Woche leeren
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {warnings.length > 0 ? (
          <div className="border-b border-border px-3 py-2.5 sm:px-4">
            <WarningsPanel warnings={warnings} />
          </div>
        ) : null}
        <WeekGrid
          weekStart={weekStart}
          warnings={warnings}
          onEditCell={(employee, day) => setEditor({ employee, day })}
          onEditNote={setNoteDay}
          onEditEmployee={(employee) => setEmployeeDialog({ mode: "edit", employee })}
          onAddEmployee={(area) => setEmployeeDialog({ mode: "add", area })}
          onBulkEntry={(employee) => setBulk({ employeeId: employee.id })}
        />
      </section>

      <EntryEditor weekStart={weekStart} target={editor} onClose={() => setEditor(null)} />
      <NoteDialog weekStart={weekStart} day={noteDay} onClose={() => setNoteDay(null)} />
      <BulkEntryDialog weekStart={weekStart} open={bulk !== null} initialEmployeeId={bulk?.employeeId} onClose={() => setBulk(null)} />
      <NewWeekDialog open={newWeekOpen} onClose={() => setNewWeekOpen(false)} />
      <EmployeeDialog state={employeeDialog} onClose={() => setEmployeeDialog(null)} />
      <SaveTemplateDialog weekStart={weekStart} open={saveTemplateOpen} onClose={() => setSaveTemplateOpen(false)} />
      <ApplyTemplateDialog weekStart={weekStart} open={applyTemplateOpen} onClose={() => setApplyTemplateOpen(false)} />
    </div>
  );
}

const tileVariants = {
  primary: "bg-accent text-white hover:bg-accent-hover shadow-card [&_.tile-icon]:bg-white/15",
  whatsapp: "bg-whatsapp text-white hover:bg-whatsapp-hover shadow-card [&_.tile-icon]:bg-white/15",
  default: "border border-border bg-surface text-fg hover:border-border-strong hover:bg-surface-2 shadow-card [&_.tile-icon]:bg-accent-soft [&_.tile-icon]:text-accent",
} as const;

function Tile({
  icon,
  children,
  variant = "default",
  className,
  href,
  onClick,
}: {
  icon: ReactNode;
  children: ReactNode;
  variant?: keyof typeof tileVariants;
  className?: string;
  href?: ComponentProps<typeof Link>["href"];
  onClick?: () => void;
}) {
  const classes = cn(
    "flex min-h-16 items-center gap-3 rounded-2xl px-3.5 py-3 text-left text-[15px] leading-tight font-semibold transition-colors sm:min-h-[72px] sm:px-4 sm:text-base",
    tileVariants[variant],
    className,
  );
  const content = (
    <>
      <span className="tile-icon flex size-10 shrink-0 items-center justify-center rounded-xl [&_svg]:size-5">{icon}</span>
      <span>{children}</span>
    </>
  );
  return href ? (
    <Link href={href} className={classes}>
      {content}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={classes}>
      {content}
    </button>
  );
}
