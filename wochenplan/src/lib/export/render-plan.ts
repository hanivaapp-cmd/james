import type { AreaRows } from "../plan";
import { getCell } from "../plan";
import { formatCell, formatEntry } from "../time-entry";
import type { Cell, ISODate, WeekPlan } from "../types";
import { DAY_INDICES, DAY_NAMES, dayDate, shortDate, weekNumber, weekRangeShort } from "../week";

/**
 * Zeichnet den Wochenplan als hochauflösendes PNG (Querformat) – optimiert für WhatsApp:
 * große Schrift im Verhältnis zur Bildbreite, klare Trennung von Küche und Fahrer,
 * Optik angelehnt an die bisherige Excel-Tabelle.
 *
 * Bewusst direkt mit Canvas gezeichnet (statt einen Screenshot der Seite zu machen):
 * Das Ergebnis sieht auf jedem Gerät gleich aus und funktioniert auch zuverlässig auf dem iPhone.
 */

export interface RenderInput {
  title: string;
  weekStart: ISODate;
  groups: AreaRows[];
  week: WeekPlan | undefined;
  showNotes: boolean;
  /** CSS-Schriftfamilie, z. B. die der App */
  fontFamily: string;
  generatedAt?: Date;
}

export interface RenderedPlan {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
}

const COLORS = {
  page: "#ffffff",
  title: "#111827",
  muted: "#6b7280",
  grid: "#d9dde3",
  outer: "#b5bcc6",
  headerBg: "#f1f3f6",
  headerText: "#111827",
  nameBg: "#fafbfc",
  zebra: "#fbfbfc",
  text: "#111827",
  off: "#9aa1ab",
  note: "#4b5563",
  creamBg: "#fdf3c9",
  creamBorder: "#e9d68a",
  creamText: "#6b5108",
  notesBg: "#f3f6fd",
  notesText: "#1e3a8a",
  accent: "#2f5fd0",
};

const WIDTH = 1240;
const PAD = 32;
const MAX_PIXELS = 16_000_000;

type Ctx = CanvasRenderingContext2D;

function font(ctx: Ctx, family: string, size: number, weight = 400, italic = false) {
  ctx.font = `${italic ? "italic " : ""}${weight} ${size}px ${family}`;
}

/** Zeilenumbruch nach Wörtern. */
function wrapWords(ctx: Ctx, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (!line || ctx.measureText(candidate).width <= maxWidth) line = candidate;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Zellinhalt in Zeilen: mehrere Einträge untereinander, „11:30h bis 18h“ notfalls als „11:30h / bis 18h“. */
function cellLines(ctx: Ctx, cell: Cell, maxWidth: number): string[] {
  return cell.flatMap((entry) => {
    const text = formatEntry(entry);
    if (ctx.measureText(text).width <= maxWidth) return [text];
    const bis = text.indexOf(" bis ");
    if (entry.kind === "shift" && bis > 0) {
      const parts = [text.slice(0, bis), text.slice(bis + 1)];
      if (parts.every((p) => ctx.measureText(p).width <= maxWidth)) return parts;
    }
    return wrapWords(ctx, text, maxWidth);
  });
}

interface CellLayout {
  lines: string[];
  size: number;
  weight: number;
  italic: boolean;
  color: string;
}

function layoutCell(ctx: Ctx, family: string, cell: Cell | undefined, maxWidth: number): CellLayout | null {
  if (!cell || cell.length === 0) return null;
  const isOff = cell.every((e) => e.kind === "off");
  const isText = cell.every((e) => e.kind === "text");
  const style = isOff
    ? { size: 20, weight: 500, italic: false, color: COLORS.off }
    : isText
      ? { size: 18, weight: 500, italic: true, color: COLORS.note }
      : { size: 22, weight: 600, italic: false, color: COLORS.text };

  for (let size = style.size; size >= 13; size--) {
    font(ctx, family, size, style.weight, style.italic);
    const lines = cellLines(ctx, cell, maxWidth);
    const fits = lines.length <= 3 && lines.every((l) => ctx.measureText(l).width <= maxWidth);
    if (fits || size === 13) return { ...style, size, lines };
  }
  return null;
}

function drawCenteredLines(ctx: Ctx, family: string, layout: CellLayout, cx: number, top: number, height: number) {
  font(ctx, family, layout.size, layout.weight, layout.italic);
  ctx.fillStyle = layout.color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const lineHeight = Math.round(layout.size * 1.18);
  const start = top + height / 2 - ((layout.lines.length - 1) * lineHeight) / 2;
  layout.lines.forEach((line, i) => ctx.fillText(line, cx, start + i * lineHeight));
}

export function renderPlan(input: RenderInput): RenderedPlan {
  const { title, weekStart, groups, week, showNotes, fontFamily: family } = input;
  const measure = document.createElement("canvas").getContext("2d");
  if (!measure) throw new Error("Canvas wird von diesem Browser nicht unterstützt.");

  // ---------- Maße berechnen ----------
  const tableX = PAD;
  const tableW = WIDTH - PAD * 2;
  font(measure, family, 21, 700);
  const longestName = Math.max(0, ...groups.flatMap((g) => g.employees.map((e) => measure.measureText(e.name).width)));
  const hasColors = groups.some((g) => g.employees.some((e) => e.color));
  const nameW = Math.round(Math.min(230, Math.max(150, longestName + 36 + (hasColors ? 20 : 0))));
  const dayW = (tableW - nameW) / 7;
  const cellMax = dayW - 14;

  const titleH = 78;
  const headerH = 64;
  const notes = DAY_INDICES.map((d) => (showNotes ? (week?.notes[d] ?? "") : ""));
  const hasNotes = notes.some(Boolean);
  font(measure, family, 15, 500, true);
  const noteLines = notes.map((n) => (n ? wrapWords(measure, n, cellMax).slice(0, 4) : []));
  const notesH = hasNotes ? Math.max(40, Math.max(...noteLines.map((l) => l.length)) * 19 + 18) : 0;
  const areaH = 42;

  const rows = groups.map((group) => ({
    group,
    employees: group.employees.map((employee) => {
      const cells = DAY_INDICES.map((d) => layoutCell(measure, family, getCell(week, employee.id, d), cellMax));
      const maxLines = Math.max(1, ...cells.map((c) => (c ? c.lines.length : 1)));
      return { employee, cells, height: Math.max(52, maxLines * 26 + 22) };
    }),
  }));
  const emptyRowH = 46;
  const bodyH = rows.reduce(
    (sum, r) => sum + areaH + (r.employees.length === 0 ? emptyRowH : r.employees.reduce((s, e) => s + e.height, 0)),
    0,
  );
  const tableH = headerH + notesH + bodyH;
  const footerH = 44;
  const height = Math.ceil(PAD + titleH + tableH + footerH + PAD / 2);

  // ---------- Canvas anlegen ----------
  const scale = Math.min(2, Math.sqrt(MAX_PIXELS / (WIDTH * height)));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(WIDTH * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas wird von diesem Browser nicht unterstützt.");
  ctx.scale(scale, scale);
  ctx.fillStyle = COLORS.page;
  ctx.fillRect(0, 0, WIDTH, height);

  // ---------- Überschrift ----------
  const titleY = PAD + 30;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  font(ctx, family, 34, 800);
  ctx.fillStyle = COLORS.title;
  const titleText = `${title.trim() || "Arbeitsplan"}`;
  ctx.fillText(titleText, tableX, titleY);
  const titleWidth = ctx.measureText(titleText).width;

  // KW-Badge
  font(ctx, family, 20, 700);
  const kw = `KW ${weekNumber(weekStart)}`;
  const kwW = ctx.measureText(kw).width + 24;
  const kwX = tableX + titleWidth + 16;
  ctx.fillStyle = COLORS.accent;
  roundRect(ctx, kwX, titleY - 17, kwW, 34, 9);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.fillText(kw, kwX + kwW / 2, titleY + 1);

  font(ctx, family, 24, 600);
  ctx.fillStyle = COLORS.muted;
  ctx.textAlign = "right";
  ctx.fillText(weekRangeShort(weekStart), tableX + tableW, titleY);

  // ---------- Tabelle ----------
  const top = PAD + titleH;
  ctx.save();
  roundRect(ctx, tableX, top, tableW, tableH, 14);
  ctx.clip();

  const colX = (day: number) => tableX + nameW + day * dayW;
  /** Horizontale Linien und Bereichsüberschriften werden zum Schluss über die Flächen gezeichnet. */
  const lines: { y: number; color: string; width: number }[] = [];
  const areaRows: { y: number; label: string }[] = [];
  let y = top;

  // Kopfzeile mit Wochentagen
  ctx.fillStyle = COLORS.headerBg;
  ctx.fillRect(tableX, y, tableW, headerH);
  for (const day of DAY_INDICES) {
    const cx = colX(day) + dayW / 2;
    ctx.textAlign = "center";
    font(ctx, family, dayW < 150 ? 19 : 21, 700);
    ctx.fillStyle = COLORS.headerText;
    ctx.fillText(DAY_NAMES[day], cx, y + 25);
    font(ctx, family, 15, 500);
    ctx.fillStyle = COLORS.muted;
    ctx.fillText(shortDate(dayDate(weekStart, day)), cx, y + 47);
  }
  y += headerH;
  lines.push({ y, color: COLORS.outer, width: 1.5 });

  // Notizen-Zeile
  if (hasNotes) {
    ctx.fillStyle = COLORS.notesBg;
    ctx.fillRect(tableX, y, tableW, notesH);
    font(ctx, family, 15, 700);
    ctx.fillStyle = COLORS.notesText;
    ctx.textAlign = "left";
    ctx.fillText("Hinweise", tableX + 16, y + notesH / 2);
    font(ctx, family, 15, 500, true);
    noteLines.forEach((noteRow, day) => {
      const cx = colX(day) + dayW / 2;
      const start = y + notesH / 2 - ((noteRow.length - 1) * 19) / 2;
      ctx.textAlign = "center";
      noteRow.forEach((line, i) => ctx.fillText(line, cx, start + i * 19));
    });
    y += notesH;
    lines.push({ y, color: COLORS.grid, width: 1 });
  }

  for (const { group, employees } of rows) {
    areaRows.push({ y, label: group.label });
    y += areaH;

    if (employees.length === 0) {
      ctx.fillStyle = COLORS.page;
      ctx.fillRect(tableX, y, tableW, emptyRowH);
      font(ctx, family, 16, 500, true);
      ctx.fillStyle = COLORS.muted;
      ctx.textAlign = "left";
      ctx.fillText("–", tableX + 16, y + emptyRowH / 2);
      y += emptyRowH;
      continue;
    }

    employees.forEach(({ employee, cells, height: rowH }, index) => {
      ctx.fillStyle = index % 2 === 1 ? COLORS.zebra : COLORS.page;
      ctx.fillRect(tableX, y, tableW, rowH);
      ctx.fillStyle = COLORS.nameBg;
      ctx.fillRect(tableX, y, nameW, rowH);

      let nameX = tableX + 16;
      if (employee.color) {
        ctx.fillStyle = employee.color;
        ctx.beginPath();
        ctx.arc(nameX + 6, y + rowH / 2, 6, 0, Math.PI * 2);
        ctx.fill();
        nameX += 20;
      }
      font(ctx, family, 21, 700);
      ctx.fillStyle = COLORS.text;
      ctx.textAlign = "left";
      ctx.fillText(fitText(ctx, employee.name, nameW - (nameX - tableX) - 10), nameX, y + rowH / 2 + 1);

      cells.forEach((layout, day) => {
        if (layout) drawCenteredLines(ctx, family, layout, colX(day) + dayW / 2, y, rowH);
      });
      y += rowH;
      if (index < employees.length - 1) lines.push({ y, color: COLORS.grid, width: 1 });
    });
  }

  // Spaltenlinien
  for (let day = 0; day <= 6; day++) {
    const x = Math.round(colX(day)) + 0.5;
    ctx.strokeStyle = day === 0 ? COLORS.outer : COLORS.grid;
    ctx.lineWidth = day === 0 ? 1.5 : 1;
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, top + tableH);
    ctx.stroke();
  }

  for (const line of lines) hLine(ctx, tableX, tableX + tableW, line.y, line.color, line.width);

  // Bereichsüberschriften (cremegelb wie in der Excel-Tabelle) über die volle Breite
  for (const area of areaRows) {
    ctx.fillStyle = COLORS.creamBg;
    ctx.fillRect(tableX, area.y, tableW, areaH);
    hLine(ctx, tableX, tableX + tableW, area.y, area.y === top + headerH + notesH ? COLORS.outer : COLORS.creamBorder, area.y === top + headerH + notesH && !hasNotes ? 1.5 : 1);
    hLine(ctx, tableX, tableX + tableW, area.y + areaH, COLORS.creamBorder);
    font(ctx, family, 18, 800);
    ctx.fillStyle = COLORS.creamText;
    ctx.textAlign = "left";
    drawSpaced(ctx, area.label.toUpperCase(), tableX + 16, area.y + areaH / 2 + 1, 2.2);
  }
  ctx.restore();

  // Rahmen
  ctx.strokeStyle = COLORS.outer;
  ctx.lineWidth = 1.5;
  roundRect(ctx, tableX, top, tableW, tableH, 14);
  ctx.stroke();

  // ---------- Fußzeile ----------
  const at = input.generatedAt ?? new Date();
  const stamp = `Stand: ${at.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })}, ${at.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} Uhr`;
  font(ctx, family, 14, 500);
  ctx.fillStyle = COLORS.muted;
  ctx.textAlign = "right";
  ctx.fillText(stamp, tableX + tableW, top + tableH + 24);

  return { canvas, width: canvas.width, height: canvas.height };
}

// ---------------------------------------------------------------------------

function hLine(ctx: Ctx, x1: number, x2: number, y: number, color: string, width = 1) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x1, Math.round(y) + 0.5);
  ctx.lineTo(x2, Math.round(y) + 0.5);
  ctx.stroke();
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Text mit Buchstabenabstand (für KÜCHE / FAHRER). */
function drawSpaced(ctx: Ctx, text: string, x: number, y: number, spacing: number) {
  let cursor = x;
  for (const char of text) {
    ctx.fillText(char, cursor, y);
    cursor += ctx.measureText(char).width + spacing;
  }
}

/** Kürzt zu lange Namen mit „…“. */
function fitText(ctx: Ctx, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > maxWidth) cut = cut.slice(0, -1);
  return `${cut}…`;
}

/** Wartet, bis die App-Schrift geladen ist – sonst misst Canvas mit einer Ersatzschrift. */
export async function ensureFonts(family: string): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return;
  await Promise.all([400, 500, 600, 700, 800].map((w) => document.fonts.load(`${w} 20px ${family}`).catch(() => [])));
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Bild konnte nicht erzeugt werden."))), "image/png"),
  );
}

/** Kurzer Text für die Vorschau/Barrierefreiheit */
export function planSummary(groups: AreaRows[], week: WeekPlan | undefined): string {
  return groups
    .map((g) => `${g.label}: ${g.employees.map((e) => `${e.name} (${DAY_INDICES.map((d) => formatCell(getCell(week, e.id, d)) || "–").join(", ")})`).join("; ")}`)
    .join(" · ");
}
