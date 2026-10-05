import { describe, expect, it } from "vitest";
import { cellProblems, formatCell, parseCell, parseTime } from "@/lib/time-entry";
import type { Cell } from "@/lib/types";

/** Eingabe → formatierte Anzeige (oder Fehler) */
function show(input: string): string {
  const result = parseCell(input);
  return result.ok ? formatCell(result.cell) : `FEHLER: ${result.error}`;
}

describe("parseCell + formatCell", () => {
  it.each([
    ["16", "16h"],
    ["16h", "16h"],
    ["16 Uhr", "16h"],
    ["16:00", "16h"],
    ["ab 16", "16h"],
    ["11:30", "11:30h"],
    ["11.30", "11:30h"],
    ["1130", "11:30h"],
    ["9:30", "9:30h"],
    ["16h30", "16:30h"],
    ["11:30-18", "11:30h bis 18h"],
    ["11:30 - 18:00", "11:30h bis 18h"],
    ["12:30h bis 18h", "12:30h bis 18h"],
    ["12.30–18", "12:30h bis 18h"],
    ["11:30 bis 18 Uhr", "11:30h bis 18h"],
    ["bis 18", "bis 18h"],
    ["Bis Ende", "Bis Ende"],
    ["bis ende", "Bis Ende"],
    ["be", "Bis Ende"],
    ["ende", "Bis Ende"],
    ["16-ende", "16h bis Ende"],
    ["16 bis Ende", "16h bis Ende"],
    ["frei", "Frei"],
    ["F", "Frei"],
    ["-", "Frei"],
    ["urlaub", "Urlaub"],
    ["Vertretung durch Hamza", "Vertretung durch Hamza"],
    ["Urlaub bis 12.10.", "Urlaub bis 12.10."],
    ["11-14 / 17-22", "11h bis 14h / 17h bis 22h"],
    ["11-14 und 17-22", "11h bis 14h / 17h bis 22h"],
  ])("%s → %s", (input, expected) => {
    expect(show(input)).toBe(expected);
  });

  it("leere Eingabe leert die Zelle", () => {
    expect(parseCell("   ")).toEqual({ ok: true, cell: [] });
  });

  it.each(["25", "16:75", "16:3", "16 18", "12-30:00"])("„%s“ ist ungültig", (input) => {
    expect(parseCell(input).ok).toBe(false);
  });

  it("formatierte Ausgabe lässt sich wieder einlesen (Round-Trip)", () => {
    for (const text of ["16h", "11:30h bis 18h", "Bis Ende", "16h bis Ende", "Frei", "bis 18h", "Urlaub"]) {
      expect(show(text)).toBe(text);
    }
  });
});

describe("parseTime", () => {
  it("akzeptiert 24h als Endzeit, aber nicht 24:30", () => {
    expect(parseTime("24")).toBe("24:00");
    expect(parseTime("24:30")).toBeNull();
  });
});

describe("cellProblems", () => {
  const cell = (input: string): Cell => {
    const r = parseCell(input);
    if (!r.ok) throw new Error(r.error);
    return r.cell;
  };

  it("keine Hinweise bei normalen Zeiten", () => {
    expect(cellProblems(cell("11:30-18"))).toEqual([]);
    expect(cellProblems(cell("11-14 / 17-22"))).toEqual([]);
  });

  it("Endzeit vor Startzeit", () => {
    expect(cellProblems(cell("18-11"))).toContain("Endzeit liegt vor Startzeit");
  });

  it("Überschneidung bei geteiltem Dienst", () => {
    expect(cellProblems(cell("11-15 / 14-18"))).toContain("Zeiten überschneiden sich");
  });

  it("widersprüchlich: Frei und Arbeitszeit", () => {
    expect(cellProblems(cell("frei / 16"))).toContain("„Frei“ und Arbeitszeit am selben Tag");
  });

  it("ungültige gespeicherte Zeit", () => {
    expect(cellProblems([{ kind: "shift", start: "99:99", end: null, untilClose: false }])).toContain("Ungültige Zeit");
  });
});
