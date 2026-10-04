import ExcelJS from "exceljs";
import { formatHours, shiftCost, shiftNetMinutes } from "./calc";
import { fmt } from "./dates";
import { buildExportModel, downloadBlob, exportFileName, lighten, type ExportInput } from "./export-model";

const argb = (rgb: [number, number, number]) => `FF${rgb.map((c) => c.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
const BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FFE1E1DE" } },
  left: { style: "thin", color: { argb: "FFE1E1DE" } },
  bottom: { style: "thin", color: { argb: "FFE1E1DE" } },
  right: { style: "thin", color: { argb: "FFE1E1DE" } },
};

export async function exportExcel(input: ExportInput) {
  const { weeks, summary, employeeMap } = buildExportModel(input);
  const wb = new ExcelJS.Workbook();
  wb.creator = "Schichtwerk";
  wb.created = new Date();

  // ---------------------------------------------------------------- Raster
  const grid = wb.addWorksheet("Dienstplan", {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
    views: [{ state: "frozen", xSplit: 1 }],
  });
  grid.columns = [{ width: 26 }, ...Array.from({ length: 7 }, () => ({ width: 22 })), { width: 14 }];
  const title = grid.addRow([input.title]);
  title.font = { bold: true, size: 14 };
  grid.addRow([]);

  for (const week of weeks) {
    const label = grid.addRow([week.label]);
    label.font = { bold: true, size: 11 };
    const header = grid.addRow(["Mitarbeiter", ...week.days.map((d) => fmt(d, "EEE dd.MM.")), "Stunden"]);
    header.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FF67676D" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF7F7F5" } };
      cell.border = BORDER;
    });
    for (const row of week.rows) {
      const excelRow = grid.addRow([
        `${row.employee.name}${row.employee.position ? `\n${row.employee.position}` : ""}`,
        ...row.cells.map((cell) => [cell.absence, ...cell.lines].filter(Boolean).join("\n")),
        Math.round((row.minutes / 60) * 100) / 100,
      ]);
      const lineCount = (c: (typeof row.cells)[number]) =>
        c.lines.reduce((n, l) => n + l.split("\n").length, 0) + (c.absence ? 1 : 0);
      const maxLines = Math.max(2, ...row.cells.map(lineCount));
      excelRow.height = 15 * maxLines;
      excelRow.eachCell({ includeEmpty: true }, (cell, col) => {
        cell.alignment = { wrapText: true, vertical: "top" };
        cell.border = BORDER;
        const dayCell = row.cells[col - 2];
        if (dayCell?.absence) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE7F5EC" } };
        else if (dayCell?.color) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(lighten(dayCell.color, 0.82)) } };
      });
      excelRow.getCell(1).font = { bold: true };
      excelRow.getCell(week.days.length + 2).numFmt = '0.00 "h"';
    }
    const foot = grid.addRow([
      "Summe",
      ...week.dayMinutes.map((m) => (m ? formatHours(m) : "–")),
      Math.round((week.dayMinutes.reduce((a, b) => a + b, 0) / 60) * 100) / 100,
    ]);
    foot.font = { bold: true };
    foot.eachCell((cell) => (cell.border = BORDER));
    foot.getCell(week.days.length + 2).numFmt = '0.00 "h"';
    grid.addRow([]);
  }

  // ----------------------------------------------------------- Schichtliste
  const list = wb.addWorksheet("Schichten", { views: [{ state: "frozen", ySplit: 1 }] });
  list.columns = [
    { header: "Datum", key: "date", width: 12 },
    { header: "Tag", key: "weekday", width: 6 },
    { header: "Mitarbeiter", key: "employee", width: 24 },
    { header: "Position", key: "position", width: 16 },
    { header: "Schichtart", key: "type", width: 16 },
    { header: "Beginn", key: "start", width: 9 },
    { header: "Ende", key: "end", width: 9 },
    { header: "Pause (min)", key: "break", width: 11 },
    { header: "Stunden", key: "hours", width: 10, style: { numFmt: "0.00" } },
    ...(input.includeCosts ? [{ header: "Kosten", key: "cost", width: 12, style: { numFmt: '#,##0.00 "€"' } }] : []),
    { header: "Standort", key: "location", width: 18 },
    { header: "Notizen", key: "notes", width: 36 },
  ];
  list.getRow(1).font = { bold: true };
  const sorted = input.shifts
    .filter((s) => s.date >= input.from && s.date <= input.to && employeeMap.has(s.employee_id))
    .sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time));
  for (const shift of sorted) {
    const employee = employeeMap.get(shift.employee_id);
    list.addRow({
      date: fmt(shift.date, "dd.MM.yyyy"),
      weekday: fmt(shift.date, "EEE"),
      employee: employee?.name,
      position: employee?.position ?? "",
      type: shift.shift_type_id ? (input.shiftTypes[shift.shift_type_id]?.name ?? "") : "Individuell",
      start: shift.start_time,
      end: shift.end_time,
      break: shift.break_minutes,
      hours: Math.round((shiftNetMinutes(shift) / 60) * 100) / 100,
      cost: Math.round(shiftCost(shift, employee) * 100) / 100,
      location: shift.location ?? "",
      notes: shift.notes ?? "",
    });
  }
  list.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: list.columnCount } };

  // ------------------------------------------------------------ Stunden
  const hours = wb.addWorksheet("Stunden");
  hours.columns = [
    { header: "Mitarbeiter", key: "name", width: 24 },
    { header: "Position", key: "position", width: 16 },
    { header: "Schichten", key: "count", width: 10 },
    { header: "Stunden", key: "hours", width: 10, style: { numFmt: "0.00" } },
    { header: "Max. pro Woche", key: "max", width: 15, style: { numFmt: "0.00" } },
    { header: "Überstunden", key: "overtime", width: 13, style: { numFmt: "0.00" } },
    ...(input.includeCosts ? [{ header: "Kosten", key: "cost", width: 12, style: { numFmt: '#,##0.00 "€"' } }] : []),
  ];
  hours.getRow(1).font = { bold: true };
  for (const employee of input.employees) {
    const totals = summary.byEmployee.get(employee.id);
    hours.addRow({
      name: employee.name,
      position: employee.position ?? "",
      count: totals?.shiftCount ?? 0,
      hours: Math.round(((totals?.minutes ?? 0) / 60) * 100) / 100,
      max: employee.max_weekly_hours,
      overtime: Math.round(((totals?.overtimeMinutes ?? 0) / 60) * 100) / 100,
      cost: Math.round((totals?.cost ?? 0) * 100) / 100,
    });
  }
  const total = hours.addRow({
    name: "Gesamt",
    count: summary.shiftCount,
    hours: Math.round((summary.totalMinutes / 60) * 100) / 100,
    overtime: Math.round((summary.overtimeMinutes / 60) * 100) / 100,
    cost: Math.round(summary.totalCost * 100) / 100,
  });
  total.font = { bold: true };

  const buffer = await wb.xlsx.writeBuffer();
  downloadBlob(
    new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    exportFileName(input, "xlsx"),
  );
}
