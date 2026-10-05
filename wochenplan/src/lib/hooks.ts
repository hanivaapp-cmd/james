"use client";

import { useMemo, useSyncExternalStore } from "react";

function subscribeMedia(query: string) {
  return (callback: () => void) => {
    const media = window.matchMedia(query);
    media.addEventListener("change", callback);
    return () => media.removeEventListener("change", callback);
  };
}

export function useMediaQuery(query: string, serverValue = false): boolean {
  const subscribe = useMemo(() => subscribeMedia(query), [query]);
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
}

/** Touch-Gerät (Finger statt Maus)? Dann z. B. nicht automatisch die Tastatur öffnen. */
export function useCoarsePointer(): boolean {
  return useMediaQuery("(pointer: coarse)");
}
