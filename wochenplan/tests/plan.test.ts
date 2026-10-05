import { describe, expect, it } from "vitest";
import { demoData } from "@/lib/demo-data";
import {
  computeWarnings,
  copyCellToDays,
  emptyWeek,
  freezeAreaInPastWeeks,
  frequentCells,
  getCell,
  previousFilledWeek,
  rowsForWeek,
  setCell,
  weekFromEntries,
} from "@/lib/plan";
import { formatCell } from "@/lib/time-entry";
import type { Employee } from "@/lib/types";
import { describeDays, weekLabel, weekStartOf } from "@/lib/week";

const WEEK = "2026-10-05";
const data = demoData(WEEK);
const week = data.weeks[WEEK];
const byName = (name: string) => data.employees.find((e) => e.name === name)!;

describe("Woche", () => {
  it("findet den Montag und beschriftet die Woche", () => {
    expect(weekStartOf(new Date(2026, 9, 7))).toBe("2026-10-05");
    expect(weekStartOf(new Date(2026, 9, 11))).toBe("2026-10-05");
    expect(weekLabel(WEEK)).toBe("KW 41 · 05.10. – 11.10.2026");
    expect(weekLabel("2026-12-28")).toBe("KW 53 · 28.12.2026 – 03.01.2027");
  });

  it("beschreibt Tagesauswahlen kurz", () => {
    expect(describeDays([0, 1, 2, 3, 4])).toBe("Mo–Fr");
    expect(describeDays([0, 2, 4])).toBe("Mo, Mi, Fr");
    expect(describeDays([0, 1, 2, 3, 4, 5, 6])).toBe("ganze Woche");
  });
});

describe("Demo-Daten", () => {
  it("entsprechen der Vorlage", () => {
    expect(formatCell(getCell(week, byName("Hamza").id, 0))).toBe("11:30h bis 18h");
    expect(formatCell(getCell(week, byName("Mama").id, 6))).toBe("Bis Ende");
    expect(formatCell(getCell(week, byName("Simbat").id, 4))).toBe("12:30h bis 18h");
    expect(getCell(week, byName("Oli").id, 0)).toBeUndefined();
  });

  it("gruppiert Küche und Fahrer in der richtigen Reihenfolge", () => {
    const rows = rowsForWeek(data.employees, week);
    expect(rows.map((r) => r.label)).toEqual(["Küche", "Fahrer"]);
    expect(rows[0].employees.map((e) => e.name)).toEqual(["Mama", "Naro", "Mimoun", "Hamza", "Ferdaus", "Oli"]);
    expect(rows[1].employees.map((e) => e.name)).toEqual(["Enrico", "Michael", "Abdulrahman", "Mostafa", "Simbat", "Motia"]);
  });
});

describe("Bearbeiten", () => {
  it("kopiert einen Eintrag auf andere Tage", () => {
    const id = byName("Oli").id;
    const w = copyCellToDays(setCell(emptyWeek(WEEK), id, 0, [{ kind: "off" }]), id, 0, [1, 2, 3, 4, 5, 6]);
    expect([0, 1, 2, 3, 4, 5, 6].map((d) => formatCell(getCell(w, id, d as 0)))).toEqual(Array(7).fill("Frei"));
  });

  it("leert eine Zelle bei leerem Eintrag", () => {
    const id = byName("Mama").id;
    expect(getCell(setCell(week, id, 0, []), id, 0)).toBeUndefined();
  });

  it("„Letzte Woche übernehmen“ übernimmt nur aktive Mitarbeiter", () => {
    const next = weekFromEntries("2026-10-12", week.entries, [byName("Mama").id]);
    expect(Object.keys(next.entries)).toEqual([byName("Mama").id]);
    expect(next.notes).toEqual({});
  });

  it("findet die letzte Woche mit Einträgen", () => {
    const weeks = { [WEEK]: week, "2026-10-12": emptyWeek("2026-10-12") };
    expect(previousFilledWeek(weeks, "2026-10-19")?.weekStart).toBe(WEEK);
    expect(previousFilledWeek(weeks, WEEK)).toBeUndefined();
  });
});

describe("Alte Wochen bleiben erhalten", () => {
  it("inaktive Mitarbeiter erscheinen nur in Wochen mit Einträgen", () => {
    const employees: Employee[] = data.employees.map((e) => (e.name === "Mama" ? { ...e, active: false } : e));
    expect(rowsForWeek(employees, week)[0].employees.map((e) => e.name)).toContain("Mama");
    expect(rowsForWeek(employees, emptyWeek("2026-10-12"))[0].employees.map((e) => e.name)).not.toContain("Mama");
  });

  it("Bereichswechsel ändert vergangene Wochen nicht", () => {
    const hamza = byName("Hamza");
    const weeks = freezeAreaInPastWeeks(data.weeks, hamza, "2026-10-12");
    const moved = data.employees.map((e) => (e.id === hamza.id ? { ...e, area: "driver" as const } : e));
    const rows = rowsForWeek(moved, weeks[WEEK]);
    expect(rows[0].employees.map((e) => e.name)).toContain("Hamza");
    expect(rowsForWeek(moved, undefined)[1].employees.map((e) => e.name)).toContain("Hamza");
  });
});

describe("Hinweise", () => {
  it("meldet Mitarbeiter ohne Einträge", () => {
    const messages = computeWarnings(data.employees, week).map((w) => w.message);
    expect(messages).toContain("Keine Arbeitszeit eingetragen: Oli, Mostafa");
  });

  it("meldet Zellenprobleme mit Name und Tag", () => {
    const w = setCell(week, byName("Naro").id, 0, [{ kind: "shift", start: "18:00", end: "11:00", untilClose: false }]);
    const warning = computeWarnings(data.employees, w).find((x) => x.employeeId === byName("Naro").id);
    expect(warning?.message).toBe("Naro, Montag: Endzeit liegt vor Startzeit");
  });

  it("meldet einen leeren Bereich, wenn der andere besetzt ist", () => {
    const drivers = data.employees.filter((e) => e.area === "driver");
    let w = week;
    for (const d of drivers) w = setCell(w, d.id, 1, []);
    expect(computeWarnings(data.employees, w).map((x) => x.message)).toContain("Dienstag: kein Fahrer eingeteilt");
  });
});

describe("Schnellbuttons", () => {
  it("bietet die häufigsten Zeiten an", () => {
    const labels = frequentCells([week], [], { limit: 3 }).map((s) => s.label);
    expect(labels).toEqual(["16h", "18h", "12:30h bis 18h"]);
  });
});
