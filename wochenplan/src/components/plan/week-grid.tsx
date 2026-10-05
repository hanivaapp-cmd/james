"use client";

import { CalendarRange, Eraser, MoreHorizontal, Pencil, Plus, StickyNote, Timer } from "lucide-react";
import { Fragment, useEffect, useRef } from "react";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { getCell, rowsForWeek, type Warning } from "@/lib/plan";
import { usePlanStore } from "@/lib/store";
import { formatCell, isEmptyCell } from "@/lib/time-entry";
import type { AreaId, Cell, DayIndex, Employee, ISODate } from "@/lib/types";
import { cn } from "@/lib/utils";
import { DAY_INDICES, DAY_NAMES, DAY_SHORT, dayDate, dayIndexInWeek, shortDate } from "@/lib/week";

interface Props {
  weekStart: ISODate;
  warnings: Warning[];
  onEditCell: (employee: Employee, day: DayIndex) => void;
  onEditNote: (day: DayIndex) => void;
  onEditEmployee: (employee: Employee) => void;
  onAddEmployee: (area: AreaId) => void;
  onBulkEntry: (employee: Employee) => void;
}

/**
 * Wochenübersicht zum Bearbeiten – aufgebaut wie die bisherige Tabelle:
 * Tage als Spalten, Küche und Fahrer als Blöcke mit cremefarbener Überschrift.
 */
export function WeekGrid({ weekStart, warnings, onEditCell, onEditNote, onEditEmployee, onAddEmployee, onBulkEntry }: Props) {
  const employees = usePlanStore((s) => s.employees);
  const week = usePlanStore((s) => s.weeks[weekStart]);
  const groups = rowsForWeek(employees, week);
  const todayIndex = dayIndexInWeek(weekStart, new Date());
  const scroller = useRef<HTMLDivElement>(null);
  const todayHeader = useRef<HTMLTableCellElement>(null);

  // Auf schmalen Bildschirmen den heutigen Tag ins Bild scrollen.
  useEffect(() => {
    const box = scroller.current;
    const cell = todayHeader.current;
    if (!box || !cell || box.scrollWidth <= box.clientWidth) return;
    box.scrollLeft = Math.max(0, cell.offsetLeft - 130);
  }, [weekStart]);

  const warningCells = new Map<string, string[]>();
  for (const w of warnings) {
    if (w.employeeId === undefined || w.day === undefined) continue;
    const key = `${w.employeeId}-${w.day}`;
    warningCells.set(key, [...(warningCells.get(key) ?? []), w.message]);
  }

  return (
    <div ref={scroller} className="scrollbar-thin overflow-x-auto">
      <table className="w-full min-w-[780px] table-fixed border-separate border-spacing-0 text-left">
        <colgroup>
          <col className="w-[124px] sm:w-[150px] lg:w-[172px]" />
          {DAY_INDICES.map((d) => (
            <col key={d} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th className="sticky left-0 z-10 border-b border-border bg-surface px-3 py-3 text-xs font-medium tracking-wide text-muted uppercase sm:px-4">
              Mitarbeiter
            </th>
            {DAY_INDICES.map((day) => {
              const isToday = day === todayIndex;
              return (
                <th
                  key={day}
                  ref={isToday ? todayHeader : undefined}
                  className={cn("border-b border-l border-border px-1 py-2.5 text-center", isToday && "bg-accent-soft")}
                >
                  <div className={cn("text-[15px] font-semibold", isToday && "text-accent")}>
                    <span className="hidden lg:inline">{DAY_NAMES[day]}</span>
                    <span className="lg:hidden">{DAY_SHORT[day]}</span>
                  </div>
                  <div className={cn("tabular text-xs font-normal text-muted", isToday && "text-accent")}>
                    {isToday ? "Heute · " : ""}
                    {shortDate(dayDate(weekStart, day))}
                  </div>
                </th>
              );
            })}
          </tr>
          <tr>
            <th className="sticky left-0 z-10 border-b border-border bg-surface-2 px-3 py-1 text-xs font-medium text-muted sm:px-4">
              <span className="flex items-center gap-1.5">
                <StickyNote className="size-3.5" /> Notiz
              </span>
            </th>
            {DAY_INDICES.map((day) => {
              const note = week?.notes[day];
              return (
                <td key={day} className={cn("border-b border-l border-border bg-surface-2 p-0.5", day === todayIndex && "bg-accent-soft/60")}>
                  <button
                    type="button"
                    onClick={() => onEditNote(day)}
                    title={note ? `Notiz bearbeiten: ${note}` : `Notiz für ${DAY_NAMES[day]} hinzufügen`}
                    aria-label={note ? `Notiz ${DAY_NAMES[day]}: ${note} – bearbeiten` : `Notiz für ${DAY_NAMES[day]} hinzufügen`}
                    className={cn(
                      "flex min-h-9 w-full items-center justify-center rounded-md px-1.5 py-1 text-center text-xs leading-tight transition-colors hover:bg-surface-3",
                      note ? "font-medium text-fg italic" : "text-subtle",
                    )}
                  >
                    <span className="line-clamp-2">{note ?? "+ Notiz"}</span>
                  </button>
                </td>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <Fragment key={group.id}>
              <tr>
                <th colSpan={8} className="border-b border-cream-border bg-cream p-0">
                  <div className="sticky left-0 flex w-fit items-center gap-3 px-3 py-2 sm:px-4">
                    <span className="text-sm font-bold tracking-[0.12em] text-cream-fg uppercase">{group.label}</span>
                    <span className="text-xs font-medium text-cream-fg/70">{group.employees.length}</span>
                    <button
                      type="button"
                      onClick={() => onAddEmployee(group.id)}
                      className="flex h-8 items-center gap-1 rounded-lg px-2.5 text-sm font-medium text-cream-fg/80 transition-colors hover:bg-white/60 hover:text-cream-fg"
                    >
                      <Plus className="size-4" /> Mitarbeiter
                    </button>
                  </div>
                </th>
              </tr>
              {group.employees.length === 0 ? (
                <tr>
                  <td colSpan={8} className="border-b border-border px-4 py-4 text-sm text-muted">
                    Noch niemand im Bereich {group.label}.
                  </td>
                </tr>
              ) : null}
              {group.employees.map((employee, rowIndex) => (
                <tr key={employee.id} className={cn(rowIndex % 2 === 1 && "bg-surface-2/50")}>
                  <th className="sticky left-0 z-10 border-b border-border bg-surface p-0 font-normal">
                    <EmployeeMenu
                      employee={employee}
                      weekStart={weekStart}
                      onEdit={() => onEditEmployee(employee)}
                      onBulkEntry={() => onBulkEntry(employee)}
                    />
                  </th>
                  {DAY_INDICES.map((day) => (
                    <td key={day} className={cn("border-b border-l border-border p-0.5", day === todayIndex && "bg-accent-soft/40")}>
                      <CellButton
                        cell={getCell(week, employee.id, day)}
                        problems={warningCells.get(`${employee.id}-${day}`)}
                        label={`${employee.name}, ${DAY_NAMES[day]}`}
                        onClick={() => onEditCell(employee, day)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CellButton({
  cell,
  problems,
  label,
  onClick,
}: {
  cell: Cell | undefined;
  problems?: string[];
  label: string;
  onClick: () => void;
}) {
  const text = formatCell(cell);
  const isOff = cell?.length === 1 && cell[0].kind === "off";
  const isText = Boolean(cell?.every((e) => e.kind === "text"));
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${label}: ${text || "leer"} – bearbeiten`}
      title={problems?.join("\n")}
      className={cn(
        "group relative flex min-h-14 w-full items-center justify-center rounded-lg px-1 py-1.5 text-center text-[15px] leading-tight transition-colors",
        "hover:bg-accent-soft hover:ring-1 hover:ring-accent/40 focus-visible:bg-accent-soft",
        isEmptyCell(cell) && "text-subtle",
        isOff && "text-muted",
        isText && "text-muted italic",
        !isEmptyCell(cell) && !isOff && !isText && "font-semibold text-fg",
      )}
    >
      {text ? (
        <span className="break-words">{text}</span>
      ) : (
        <Plus className="size-4 opacity-0 transition-opacity group-hover:opacity-60 group-focus-visible:opacity-60" />
      )}
      {problems?.length ? <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-warning" /> : null}
    </button>
  );
}

function EmployeeMenu({
  employee,
  weekStart,
  onEdit,
  onBulkEntry,
}: {
  employee: Employee;
  weekStart: ISODate;
  onEdit: () => void;
  onBulkEntry: () => void;
}) {
  const monday = usePlanStore((s) => getCell(s.weeks[weekStart], employee.id, 0));
  const hasAny = usePlanStore((s) => Boolean(s.weeks[weekStart]?.entries[employee.id]));
  const copyCellToDays = usePlanStore((s) => s.copyCellToDays);
  const clearEmployeeWeek = usePlanStore((s) => s.clearEmployeeWeek);
  const restoreWeek = usePlanStore((s) => s.restoreWeek);

  const copyMonday = () => {
    const before = usePlanStore.getState().weeks[weekStart];
    copyCellToDays(weekStart, employee.id, 0, [1, 2, 3, 4, 5, 6]);
    toast.success(`${employee.name}: „${formatCell(monday)}“ für die ganze Woche eingetragen`, {
      action: { label: "Rückgängig", onClick: () => restoreWeek(weekStart, before) },
    });
  };

  const clearRow = () => {
    const before = clearEmployeeWeek(weekStart, employee.id);
    toast(`${employee.name}: Woche geleert`, {
      action: { label: "Rückgängig", onClick: () => restoreWeek(weekStart, before) },
    });
  };

  const status = employee.deleted ? "gelöscht" : !employee.active ? "inaktiv" : null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="group flex min-h-14 w-full items-center gap-2 px-3 py-1.5 text-left transition-colors hover:bg-surface-3 sm:px-4"
        >
          {employee.color ? <span className="size-2.5 shrink-0 rounded-full" style={{ background: employee.color }} /> : null}
          <span className="min-w-0 flex-1">
            <span className="line-clamp-2 block text-[15px] leading-tight font-semibold [overflow-wrap:anywhere]">{employee.name}</span>
            {status ? <span className="block text-xs text-muted">{status}</span> : null}
          </span>
          <MoreHorizontal className="hidden size-4 shrink-0 text-subtle opacity-60 group-hover:opacity-100 sm:block" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>{employee.name}</DropdownMenuLabel>
        <DropdownMenuItem icon={<Timer />} onSelect={onBulkEntry}>
          Arbeitszeit für mehrere Tage
        </DropdownMenuItem>
        <DropdownMenuItem icon={<CalendarRange />} onSelect={copyMonday} disabled={isEmptyCell(monday)}>
          Montag auf ganze Woche kopieren
        </DropdownMenuItem>
        <DropdownMenuItem icon={<Eraser />} onSelect={clearRow} disabled={!hasAny}>
          Diese Woche leeren
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem icon={<Pencil />} onSelect={onEdit}>
          Mitarbeiter bearbeiten
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
