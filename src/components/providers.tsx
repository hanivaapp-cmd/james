"use client";

import { ThemeProvider, useTheme } from "next-themes";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "sonner";
import { ConfirmHost } from "@/components/ui/confirm";

function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Toaster
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      position="bottom-right"
      offset={16}
      mobileOffset={{ bottom: 72 }}
      toastOptions={{
        classNames: {
          toast: "!rounded-xl !border-border !bg-surface !text-fg !shadow-pop !font-sans",
          description: "!text-muted",
          actionButton: "!bg-accent !text-accent-fg !rounded-md",
        },
      }}
    />
  );
}

function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Ohne Service Worker funktioniert die App weiterhin – nur ohne Push im Hintergrund.
    });
  }, []);
  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
      <ThemedToaster />
      <ConfirmHost />
      <ServiceWorker />
    </ThemeProvider>
  );
}
