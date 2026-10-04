"use client";

import { create } from "zustand";
import type { Shift } from "@/lib/types";

interface EditorState {
  open: boolean;
  shiftId: string | null;
  defaults: Partial<Shift> | null;
  openShift: (shiftId: string) => void;
  openNew: (defaults: Partial<Shift>) => void;
  close: () => void;
}

/** Steuert den Schicht-Editor (ein Dialog für die ganze Seite). */
export const useShiftEditor = create<EditorState>((set) => ({
  open: false,
  shiftId: null,
  defaults: null,
  openShift: (shiftId) => set({ open: true, shiftId, defaults: null }),
  openNew: (defaults) => set({ open: true, shiftId: null, defaults }),
  close: () => set({ open: false }),
}));
