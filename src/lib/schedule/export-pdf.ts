import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import { formatHours } from "./calc";
import { fmt, todayISO } from "./dates";
import { buildExportModel, exportFileName, lighten, type ExportInput } from "./export-model";

const FALLBACK: Record<string, string> = { ı: "i", İ: "I", ł: "l", Ł: "L", ğ: "g", ş: "s", ș: "s", ț: "t", "→": "->" };
const WIN_ANSI_EXTRA = new Set(["–", "—", "„", "“", "”", "‘", "’", "€", "•", "…"]);

/** Die Standardschrift im PDF kennt nur Westeuropäisch – andere Zeichen ersetzen. */
function safe(text: string): string {
  let out = "";
  for (const char of text) {
    if (char.charCodeAt(0) <= 0xff || WIN_ANSI_EXTRA.has(char)) out += char;
    else if (FALLBACK[char]) out += FALLBACK[char];
    else {
      const base = char.normalize("NFD")[0];
      out += base && base.charCodeAt(0) <= 0x7f ? base : "?";
    }
  }
  return out;
}

/** PDF für Aushang & Weitergabe – bewusst ohne Löhne und Personalkosten. */
export function createSchedulePdf(input: ExportInput): jsPDF {
  const { weeks, summary } = buildExportModel(input);
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 12;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(28, 28, 31);
  doc.text(safe(input.title), margin, 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(103, 103, 109);
  const totals = [
    `${formatHours(summary.totalMinutes)} geplant`,
    `${summary.shiftCount} Schichten`,
    summary.overtimeMinutes > 0 ? `${formatHours(summary.overtimeMinutes)} Überstunden` : null,
    `erstellt am ${fmt(todayISO(), "dd.MM.yyyy")}`,
  ]
    .filter(Boolean)
    .join("   ·   ");
  doc.text(safe(totals), margin, 22);

  // Legende der Schichtarten
  let x = margin;
  for (const type of Object.values(input.shiftTypes).sort((a, b) => a.sort_order - b.sort_order)) {
    doc.setFillColor(...lighten(type.color, 0));
    doc.circle(x + 1.2, 26.8, 1.2, "F");
    const label = safe(`${type.name} ${type.default_start}–${type.default_end}`);
    doc.text(label, x + 3.5, 27.8);
    x += doc.getTextWidth(label) + 9;
  }

  let startY = 32;
  for (const week of weeks) {
    const head = [
      [
        { content: safe(week.label), colSpan: week.days.length + 2, styles: { fillColor: [247, 247, 245] as [number, number, number], textColor: [28, 28, 31] as [number, number, number], fontStyle: "bold" as const, fontSize: 10 } },
      ],
      ["Mitarbeiter", ...week.days.map((d) => fmt(d, "EEE dd.MM.")), "Stunden"],
    ];
    const body = week.rows.map((row) => [
      safe(`${row.employee.name}${row.employee.position ? `\n${row.employee.position}` : ""}`),
      ...row.cells.map((cell) => safe([cell.absence, ...cell.lines].filter(Boolean).join("\n"))),
      `${formatHours(row.minutes, false)} / ${formatHours(row.employee.max_weekly_hours * 60, false)}`,
    ]);
    const foot = [["Summe", ...week.dayMinutes.map((m) => (m ? formatHours(m) : "–")), formatHours(week.dayMinutes.reduce((a, b) => a + b, 0))]];

    autoTable(doc, {
      head,
      body,
      foot,
      startY,
      margin: { left: margin, right: margin },
      theme: "grid",
      styles: { font: "helvetica", fontSize: 7.5, cellPadding: 1.6, lineColor: [225, 225, 222], lineWidth: 0.2, textColor: [28, 28, 31], valign: "top" },
      headStyles: { fillColor: [255, 255, 255], textColor: [103, 103, 109], fontStyle: "bold" },
      footStyles: { fillColor: [247, 247, 245], textColor: [28, 28, 31], fontStyle: "bold" },
      columnStyles: { 0: { cellWidth: 38, fontStyle: "bold" }, [week.days.length + 1]: { cellWidth: 20, halign: "right" } },
      rowPageBreak: "avoid",
      didParseCell: (hook) => {
        if (hook.section !== "body") return;
        const dayIndex = hook.column.index - 1;
        if (dayIndex < 0 || dayIndex >= week.days.length) return;
        const cell = week.rows[hook.row.index]?.cells[dayIndex];
        if (cell?.absence) hook.cell.styles.fillColor = [231, 245, 236];
        else if (cell?.color) hook.cell.styles.fillColor = lighten(cell.color, 0.85);
      },
    });
    startY = ((doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY ?? startY) + 8;
  }

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(155, 155, 161);
    doc.text(`Schichtwerk · Seite ${i} von ${pages}`, pageWidth - margin, doc.internal.pageSize.getHeight() - 6, { align: "right" });
  }
  return doc;
}

export function exportPdf(input: ExportInput) {
  createSchedulePdf(input).save(exportFileName(input, "pdf"));
}

/** PDF als Datei – zum Teilen über das Teilen-Menü des Geräts. */
export function pdfFile(input: ExportInput): File {
  const blob = createSchedulePdf(input).output("blob");
  return new File([blob], exportFileName(input, "pdf"), { type: "application/pdf" });
}
