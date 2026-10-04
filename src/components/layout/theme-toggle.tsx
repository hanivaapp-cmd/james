"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { Segmented } from "@/components/ui/segmented";

const useMounted = () => useSyncExternalStore(() => () => {}, () => true, () => false);

export function ThemeToggle({ withLabels = false }: { withLabels?: boolean }) {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();
  return (
    <Segmented
      size="sm"
      value={mounted ? (theme ?? "system") : "system"}
      onChange={setTheme}
      options={[
        { value: "light", label: withLabels ? "Hell" : <span className="sr-only">Hell</span>, icon: <Sun /> },
        { value: "dark", label: withLabels ? "Dunkel" : <span className="sr-only">Dunkel</span>, icon: <Moon /> },
        { value: "system", label: withLabels ? "System" : <span className="sr-only">System</span>, icon: <Monitor /> },
      ]}
    />
  );
}
