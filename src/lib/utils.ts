import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function uid(): string {
  return crypto.randomUUID();
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const currency = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
export function formatCurrency(value: number): string {
  return currency.format(value);
}

/** Farbe mit Transparenz mischen – für weiche Schicht-Hintergründe. */
export function tint(color: string, percent: number): string {
  return `color-mix(in srgb, ${color} ${percent}%, transparent)`;
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "Unbekannter Fehler";
}

export const EMPLOYEE_COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#f43f5e",
  "#f97316",
  "#f59e0b",
  "#84cc16",
  "#10b981",
  "#14b8a6",
  "#0ea5e9",
  "#3b82f6",
  "#64748b",
];
