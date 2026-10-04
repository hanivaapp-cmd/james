import { describe, expect, it } from "vitest";
import type { Absence, Employee, Shift } from "@/lib/types";
import { formatHours, shiftNetMinutes, summarize } from "@/lib/schedule/calc";
import { analyzeSchedule } from "@/lib/schedule/conflicts";
import { formatRangeLabel, gridRange, monthGrid, weekDays } from "@/lib/schedule/dates";

const employee = (patch: Partial<Employee> = {}): Employee => ({
  id: "e1",
  user_id: null,
  name: "Anna Becker",
  email: null,
  position: "Service",
  hourly_rate: 20,
  max_weekly_hours: 20,
  available_days: [1, 2, 3, 4, 5],
  color: "#6366f1",
  active: true,
  ...patch,
});

let n = 0;
const shift = (patch: Partial<Shift>): Shift => ({
  id: `s${++n}`,
  employee_id: "e1",
  shift_type_id: null,
  date: "2026-10-05",
  start_time: "06:00",
  end_time: "14:00",
  break_minutes: 30,
  location: null,
  notes: null,
  ...patch,
});

const employees = new Map([["e1", employee()]]);

describe("Arbeitszeit", () => {
  it("zieht die Pause ab", () => {
    expect(shiftNetMinutes(shift({}))).toBe(450);
  });

  it("rechnet Nachtschichten über Mitternacht", () => {
    expect(shiftNetMinutes(shift({ start_time: "22:00", end_time: "06:00", break_minutes: 45 }))).toBe(435);
  });

  it("formatiert Stunden deutsch", () => {
    expect(formatHours(450)).toBe("7,5 h");
    expect(formatHours(480)).toBe("8 h");
  });

  it("summiert Stunden, Kosten und Überstunden pro Woche", () => {
    const shifts = [
      shift({ date: "2026-10-05" }),
      shift({ date: "2026-10-06" }),
      shift({ date: "2026-10-07" }),
      // nächste Woche, außerhalb des Zeitraums
      shift({ date: "2026-10-12" }),
    ];
    const summary = summarize(shifts, employees, "2026-10-05", "2026-10-11");
    expect(summary.totalMinutes).toBe(3 * 450);
    expect(summary.totalCost).toBeCloseTo(3 * 7.5 * 20);
    // 22,5 h bei max. 20 h → 2,5 h Überstunden
    expect(summary.overtimeMinutes).toBe(150);
    expect(summary.byEmployee.get("e1")?.overtimeMinutes).toBe(150);
    expect(summary.byDay.get("2026-10-05")?.minutes).toBe(450);
  });
});

describe("Konfliktprüfung", () => {
  it("erkennt Überschneidungen", () => {
    const a = shift({ start_time: "06:00", end_time: "14:00" });
    const b = shift({ start_time: "13:00", end_time: "18:00", break_minutes: 0 });
    const { issues, byShift } = analyzeSchedule([a, b], employees, []);
    expect(issues.some((i) => i.kind === "overlap")).toBe(true);
    expect(byShift.get(a.id)?.[0].severity).toBe("error");
  });

  it("erkennt Überschneidung einer Nachtschicht mit der Frühschicht am Folgetag", () => {
    const night = shift({ date: "2026-10-05", start_time: "22:00", end_time: "06:00" });
    const early = shift({ date: "2026-10-06", start_time: "05:00", end_time: "13:00" });
    const { issues } = analyzeSchedule([night, early], employees, []);
    expect(issues.map((i) => i.kind)).toContain("overlap");
  });

  it("warnt bei zu kurzer Ruhezeit", () => {
    const late = shift({ date: "2026-10-05", start_time: "14:00", end_time: "22:00" });
    const early = shift({ date: "2026-10-06", start_time: "06:00", end_time: "14:00" });
    const { issues } = analyzeSchedule([late, early], employees, []);
    expect(issues.find((i) => i.kind === "rest_period")?.message).toContain("8 h");
  });

  it("warnt bei Überschreitung der Wochenstunden", () => {
    const shifts = ["05", "06", "07"].map((d) => shift({ date: `2026-10-${d}` }));
    const { issues, byEmployeeWeek } = analyzeSchedule(shifts, employees, []);
    expect(issues.find((i) => i.kind === "max_hours")?.message).toContain("2,5 h über");
    expect(byEmployeeWeek.get("e1|2026-10-05")?.length).toBeGreaterThan(0);
  });

  it("warnt bei Schichten im Urlaub und an freien Tagen", () => {
    const absence: Absence = {
      id: "a1",
      employee_id: "e1",
      type: "vacation",
      start_date: "2026-10-05",
      end_date: "2026-10-09",
      note: null,
      status: "approved",
    };
    const shifts = [shift({ date: "2026-10-06" }), shift({ date: "2026-10-10" })];
    const { issues } = analyzeSchedule(shifts, employees, [absence]);
    expect(issues.find((i) => i.kind === "absence")?.severity).toBe("error");
    expect(issues.find((i) => i.kind === "unavailable")?.message).toContain("Samstag");
  });

  it("ignoriert abgelehnte Anträge", () => {
    const absence: Absence = {
      id: "a1",
      employee_id: "e1",
      type: "vacation",
      start_date: "2026-10-05",
      end_date: "2026-10-05",
      note: null,
      status: "rejected",
    };
    const { issues } = analyzeSchedule([shift({})], employees, [absence]);
    expect(issues).toHaveLength(0);
  });
});

describe("Kalender", () => {
  it("beginnt Wochen am Montag", () => {
    expect(weekDays("2026-10-08")[0]).toBe("2026-10-05");
    expect(weekDays("2026-10-08")[6]).toBe("2026-10-11");
  });

  it("baut das Monatsraster aus ganzen Wochen", () => {
    const days = monthGrid("2026-10-15");
    expect(days[0]).toBe("2026-09-28");
    expect(days.length % 7).toBe(0);
    expect(gridRange("month", "2026-10-15").to).toBe("2026-11-01");
  });

  it("beschriftet Wochen mit Kalenderwoche", () => {
    expect(formatRangeLabel("week", "2026-10-05")).toBe("KW 41 · 5.–11. Okt. 2026");
  });
});
