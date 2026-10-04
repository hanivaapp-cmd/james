"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { todayISO, type ViewMode } from "@/lib/schedule/dates";
import type { ISODate } from "@/lib/types";

export interface ViewState {
  view: ViewMode;
  date: ISODate;
  search: string;
  positions: string[];
  shiftTypeIds: string[];
  onlyIssues: boolean;
  setView: (view: ViewMode) => void;
  setDate: (date: ISODate) => void;
  setSearch: (search: string) => void;
  setPositions: (positions: string[]) => void;
  setShiftTypeIds: (ids: string[]) => void;
  setOnlyIssues: (value: boolean) => void;
  resetFilters: () => void;
}

export const useViewStore = create<ViewState>()(
  persist(
    (set) => ({
      view: "week",
      date: todayISO(),
      search: "",
      positions: [],
      shiftTypeIds: [],
      onlyIssues: false,
      setView: (view) => set({ view }),
      setDate: (date) => set({ date }),
      setSearch: (search) => set({ search }),
      setPositions: (positions) => set({ positions }),
      setShiftTypeIds: (shiftTypeIds) => set({ shiftTypeIds }),
      setOnlyIssues: (onlyIssues) => set({ onlyIssues }),
      resetFilters: () => set({ search: "", positions: [], shiftTypeIds: [], onlyIssues: false }),
    }),
    {
      name: "schichtwerk-view",
      // Nur die Ansicht merken – Datum startet immer bei heute.
      partialize: (state) => ({ view: state.view }),
    },
  ),
);
