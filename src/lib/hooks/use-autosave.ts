"use client";

import { useEffect, useRef, useState } from "react";

export type AutosaveStatus = "idle" | "pending" | "saving" | "saved" | "error";

/**
 * Speichert einen Wert automatisch, sobald er sich ändert (mit Verzögerung).
 * `save` wird nur aufgerufen, wenn `enabled` true ist und sich der Wert geändert hat.
 */
export function useAutosave<T>(
  value: T,
  save: (value: T) => Promise<unknown>,
  { delay = 700, enabled = true }: { delay?: number; enabled?: boolean } = {},
) {
  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const lastSaved = useRef(JSON.stringify(value));
  const saveRef = useRef(save);
  const latest = useRef(value);

  useEffect(() => {
    saveRef.current = save;
    latest.current = value;
  });

  const serialized = JSON.stringify(value);

  useEffect(() => {
    if (!enabled || serialized === lastSaved.current) return;
    setStatus("pending");
    const timer = setTimeout(async () => {
      setStatus("saving");
      const snapshot = serialized;
      try {
        const result = await saveRef.current(latest.current);
        if (result === undefined) throw new Error("save failed");
        lastSaved.current = snapshot;
        setStatus("saved");
      } catch {
        setStatus("error");
      }
    }, delay);
    return () => clearTimeout(timer);
  }, [serialized, enabled, delay]);

  // Beim Schließen ausstehende Änderungen sofort speichern.
  useEffect(() => {
    return () => {
      if (enabled && JSON.stringify(latest.current) !== lastSaved.current) {
        void saveRef.current(latest.current);
      }
    };
  }, [enabled]);

  return status;
}
