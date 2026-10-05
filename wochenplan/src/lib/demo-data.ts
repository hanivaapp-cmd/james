import { parseCell } from "./time-entry";
import { DEFAULT_SETTINGS, type AppData, type AreaId, type DayIndex, type Employee, type ISODate, type WeekEntries } from "./types";

/**
 * Beispieldaten für den ersten Start – entsprechen dem bisherigen Excel-Plan.
 * Reihenfolge der Werte: Montag … Sonntag, leer = kein Eintrag.
 */
const DEMO: { name: string; area: AreaId; days: string[] }[] = [
  { name: "Mama", area: "kitchen", days: ["Bis Ende", "Bis Ende", "Bis Ende", "Bis Ende", "Bis Ende", "Bis Ende", "Bis Ende"] },
  { name: "Naro", area: "kitchen", days: ["", "", "", "16h", "", "", "15h"] },
  { name: "Mimoun", area: "kitchen", days: ["16h", "11:30h", "16h", "11:30h", "11:30h", "16h", "12:30h"] },
  { name: "Hamza", area: "kitchen", days: ["11:30h bis 18h", "16h", "11:30h bis 18h", "", "16h", "12:30h", "18h"] },
  { name: "Ferdaus", area: "kitchen", days: ["18h", "", "18h", "", "18h", "15h", ""] },
  { name: "Oli", area: "kitchen", days: ["", "", "", "", "", "", ""] },
  { name: "Enrico", area: "driver", days: ["18h", "", "18h", "", "18h", "", "18h"] },
  { name: "Michael", area: "driver", days: ["16h", "16h", "16h", "", "18h", "", "13:30h"] },
  { name: "Abdulrahman", area: "driver", days: ["", "", "", "16h", "16h", "13:30h", ""] },
  { name: "Mostafa", area: "driver", days: ["", "", "", "", "", "", ""] },
  { name: "Simbat", area: "driver", days: ["12:30h bis 18h", "12:30h bis 18h", "12:30h bis 18h", "12:30h bis 18h", "12:30h bis 18h", "18h", ""] },
  { name: "Motia", area: "driver", days: ["", "18h", "", "18h", "", "16h", "16h"] },
];

function demoId(name: string): string {
  return `demo-${name.toLowerCase()}`;
}

export function demoData(currentWeekStart: ISODate): AppData {
  const employees: Employee[] = DEMO.map((d, i) => ({
    id: demoId(d.name),
    name: d.name,
    area: d.area,
    color: null,
    active: true,
    deleted: false,
    sortOrder: i,
  }));

  const entries: WeekEntries = {};
  for (const d of DEMO) {
    d.days.forEach((value, day) => {
      const parsed = parseCell(value);
      if (!parsed.ok || parsed.cell.length === 0) return;
      (entries[demoId(d.name)] ??= {})[day as DayIndex] = parsed.cell;
    });
  }

  const now = new Date().toISOString();
  return {
    employees,
    weeks: {
      [currentWeekStart]: { weekStart: currentWeekStart, entries, notes: {}, areas: {}, updatedAt: now },
    },
    templates: [{ id: "demo-template", name: "Normale Woche", entries: structuredClone(entries), createdAt: now }],
    settings: { ...DEFAULT_SETTINGS },
  };
}
