import type { Cell, Entry, Time } from "./types";

/**
 * Eingabe und Formatierung von Arbeitszeiten.
 *
 * Erlaubt bewusst sehr lockere Eingaben, damit der Chef so tippen kann, wie er spricht:
 *   "16"            → 16h
 *   "11:30-18"      → 11:30h bis 18h
 *   "12.30 bis 18"  → 12:30h bis 18h
 *   "be" / "ende"   → Bis Ende
 *   "16-ende"       → 16h bis Ende
 *   "f" / "frei"    → Frei
 *   "Urlaub"        → Urlaub (freier Text)
 *   "11-14 / 17-22" → geteilter Dienst
 */

export type ParseResult = { ok: true; cell: Cell } | { ok: false; error: string };

const OFF_WORDS = new Set(["frei", "f", "-", "off", "free"]);
const UNTIL_CLOSE_WORDS = new Set([
  "bis ende",
  "bisende",
  "ende",
  "be",
  "b.e.",
  "bis schluss",
  "schluss",
  "bis zum ende",
  "bis zum schluss",
  "open end",
  "openend",
]);

/** Trennt mehrere Einträge in einer Zelle (geteilter Dienst). */
const PART_SEPARATOR = /\s*(?:\/|\+|&|;|\n|\bund\b)\s*/i;

const TIME = String.raw`(\d{1,2}(?:[:.,]\d{1,2})?|\d{3,4})\s*h?`;
const RANGE_RE = new RegExp(String.raw`^(?:ab\s*)?${TIME}\s*(?:-|bis)\s*(?:${TIME}|(ende|schluss))$`);
const START_RE = new RegExp(String.raw`^(?:ab\s*)?${TIME}$`);
const END_RE = new RegExp(String.raw`^bis\s*${TIME}$`);

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function normalize(part: string): string {
  return part
    .toLowerCase()
    .trim()
    .replace(/[–—−]/g, "-")
    .replace(/uhr/g, "h")
    .replace(/(\d)\s*h\s*(\d{2})(?!\d)/g, "$1:$2") // 16h30 → 16:30
    .replace(/\s+/g, " ");
}

/** Wandelt ein Uhrzeit-Stück („16“, „11:30“, „1130“, „9.30h“) in HH:mm um. */
export function parseTime(raw: string): Time | null {
  const t = raw.trim().replace(/\s*h$/, "");
  let h: number;
  let m: number;
  const withSeparator = /^(\d{1,2})[:.,](\d{1,2})$/.exec(t);
  if (withSeparator) {
    if (withSeparator[2].length !== 2) return null;
    h = Number(withSeparator[1]);
    m = Number(withSeparator[2]);
  } else if (/^\d{3,4}$/.test(t)) {
    h = Number(t.slice(0, -2));
    m = Number(t.slice(-2));
  } else if (/^\d{1,2}$/.test(t)) {
    h = Number(t);
    m = 0;
  } else {
    return null;
  }
  if (h > 24 || m > 59 || (h === 24 && m !== 0)) return null;
  return `${pad(h)}:${pad(m)}`;
}

function invalidTime(raw: string): ParseResult {
  return { ok: false, error: `„${raw.trim()}“ ist keine gültige Uhrzeit` };
}

/** Enthält der Text echte Wörter (z. B. „Urlaub bis 12.10.“)? Dann ist es eine Notiz, keine Zeit. */
function hasWords(normalized: string): boolean {
  const rest = normalized.replace(/\b(bis|ab|ende|schluss|h)\b/g, " ");
  return /[a-zäöüß]{3,}/.test(rest);
}

function parsePart(original: string): ParseResult {
  const s = normalize(original);
  if (!s) return { ok: true, cell: [] };
  if (OFF_WORDS.has(s)) return { ok: true, cell: [{ kind: "off" }] };
  if (UNTIL_CLOSE_WORDS.has(s)) {
    return { ok: true, cell: [{ kind: "shift", start: null, end: null, untilClose: true }] };
  }

  const range = RANGE_RE.exec(s);
  if (range) {
    const start = parseTime(range[1]);
    if (!start) return invalidTime(range[1]);
    if (range[3]) return { ok: true, cell: [{ kind: "shift", start, end: null, untilClose: true }] };
    const end = parseTime(range[2]);
    if (!end) return invalidTime(range[2]);
    return { ok: true, cell: [{ kind: "shift", start, end, untilClose: false }] };
  }

  const startOnly = START_RE.exec(s);
  if (startOnly) {
    const start = parseTime(startOnly[1]);
    if (!start) return invalidTime(startOnly[1]);
    return { ok: true, cell: [{ kind: "shift", start, end: null, untilClose: false }] };
  }

  const endOnly = END_RE.exec(s);
  if (endOnly) {
    const end = parseTime(endOnly[1]);
    if (!end) return invalidTime(endOnly[1]);
    return { ok: true, cell: [{ kind: "shift", start: null, end, untilClose: false }] };
  }

  if (/\d/.test(s) && !hasWords(s)) {
    return { ok: false, error: "Zeit nicht erkannt – z. B. 16, 11:30-18 oder Bis Ende" };
  }

  const text = original.trim().replace(/\s+/g, " ");
  return { ok: true, cell: [{ kind: "text", text: text.charAt(0).toUpperCase() + text.slice(1) }] };
}

/** Wandelt eine freie Eingabe in Zelleinträge um. Leere Eingabe = Zelle leeren. */
export function parseCell(input: string): ParseResult {
  const cell: Entry[] = [];
  for (const part of input.split(PART_SEPARATOR)) {
    const result = parsePart(part);
    if (!result.ok) return result;
    cell.push(...result.cell);
  }
  return { ok: true, cell };
}

/** „16:00“ → „16h“, „09:30“ → „9:30h“ */
export function formatTime(time: Time): string {
  const [h, m] = time.split(":");
  const hours = String(Number(h));
  return m === "00" ? `${hours}h` : `${hours}:${m}h`;
}

export function formatEntry(entry: Entry): string {
  switch (entry.kind) {
    case "off":
      return "Frei";
    case "text":
      return entry.text;
    case "shift": {
      const { start, end, untilClose } = entry;
      if (start && end) return `${formatTime(start)} bis ${formatTime(end)}`;
      if (start && untilClose) return `${formatTime(start)} bis Ende`;
      if (start) return formatTime(start);
      if (end) return `bis ${formatTime(end)}`;
      return untilClose ? "Bis Ende" : "";
    }
  }
}

export function formatCell(cell: Cell | undefined | null): string {
  if (!cell || cell.length === 0) return "";
  return cell.map(formatEntry).join(" / ");
}

export function isEmptyCell(cell: Cell | undefined | null): boolean {
  return !cell || cell.length === 0;
}

/** Arbeitet der Mitarbeiter laut dieser Zelle (mindestens eine Arbeitszeit)? */
export function isWorking(cell: Cell | undefined | null): boolean {
  return Boolean(cell?.some((e) => e.kind === "shift"));
}

const TIME_FORMAT = /^([01]\d|2[0-4]):[0-5]\d$/;

export function toMinutes(time: Time): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Kleine Plausibilitätsprüfung einer Zelle.
 * Liefert kurze, verständliche Hinweise – keine Fehler, die das Speichern verhindern.
 */
export function cellProblems(cell: Cell | undefined | null): string[] {
  if (!cell || cell.length === 0) return [];
  const problems = new Set<string>();
  const spans: { start: number; end: number }[] = [];

  for (const entry of cell) {
    if (entry.kind !== "shift") continue;
    const { start, end } = entry;
    if ((start && !TIME_FORMAT.test(start)) || (end && !TIME_FORMAT.test(end))) {
      problems.add("Ungültige Zeit");
      continue;
    }
    if (start && end) {
      if (toMinutes(end) < toMinutes(start)) problems.add("Endzeit liegt vor Startzeit");
      else if (toMinutes(end) === toMinutes(start)) problems.add("Start- und Endzeit sind gleich");
    }
    spans.push({
      start: start ? toMinutes(start) : Number.NEGATIVE_INFINITY,
      end: end ? toMinutes(end) : Number.POSITIVE_INFINITY,
    });
  }

  if (cell.length > 1) {
    const offCount = cell.filter((e) => e.kind === "off").length;
    if (offCount > 0 && spans.length > 0) problems.add("„Frei“ und Arbeitszeit am selben Tag");
    else if (offCount > 1) problems.add("Doppelter Eintrag");
    const overlaps = spans.some((a, i) => spans.some((b, j) => j > i && a.start < b.end && b.start < a.end));
    if (overlaps) problems.add("Zeiten überschneiden sich");
  }

  return [...problems];
}

/** Startzeit in Minuten zum Sortieren von Vorschlägen (Frei/Text ans Ende). */
export function sortKey(cell: Cell): number {
  const first = cell[0];
  if (!first || first.kind !== "shift") return 10_000;
  if (first.start) return toMinutes(first.start) + (first.end || first.untilClose ? 0.5 : 0);
  return first.untilClose ? 5_000 : 4_000;
}
