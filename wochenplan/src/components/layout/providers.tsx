"use client";

import { useEffect, type ReactNode } from "react";
import { Toaster } from "sonner";
import { ConfirmHost } from "@/components/ui/confirm";
import { usePlanStore } from "@/lib/store";

export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    void usePlanStore.getState().init();
  }, []);

  return (
    <>
      {children}
      <Toaster
        position="bottom-center"
        offset={24}
        mobileOffset={{ bottom: 88 }}
        toastOptions={{
          classNames: {
            toast: "!rounded-2xl !border-border !bg-fg !text-white !shadow-pop !font-sans !text-[15px] !py-3.5",
            description: "!text-white/70",
            actionButton: "!bg-white !text-fg !rounded-lg !font-semibold !h-8 !px-3",
          },
        }}
      />
      <ConfirmHost />
    </>
  );
}
