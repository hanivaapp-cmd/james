"use client";

import { create } from "zustand";
import { Button } from "./button";
import { Dialog, DialogContent } from "./dialog";

interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  destructive?: boolean;
}

interface ConfirmState {
  options: ConfirmOptions | null;
  resolve: ((value: boolean) => void) | null;
}

const useConfirmStore = create<ConfirmState>(() => ({ options: null, resolve: null }));

/** Bestätigungsdialog als Promise: `if (await confirmAction({...})) …` */
export function confirmAction(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    useConfirmStore.getState().resolve?.(false);
    useConfirmStore.setState({ options, resolve });
  });
}

export function ConfirmHost() {
  const { options, resolve } = useConfirmStore();
  const close = (value: boolean) => {
    resolve?.(value);
    useConfirmStore.setState({ options: null, resolve: null });
  };
  return (
    <Dialog open={Boolean(options)} onOpenChange={(open) => !open && close(false)}>
      {options ? (
        <DialogContent
          size="sm"
          title={options.title}
          description={options.description}
          footer={
            <div className="flex w-full justify-end gap-2">
              <Button variant="ghost" onClick={() => close(false)}>
                Abbrechen
              </Button>
              <Button variant={options.destructive ? "danger" : "primary"} onClick={() => close(true)} autoFocus>
                {options.confirmLabel ?? "Bestätigen"}
              </Button>
            </div>
          }
        >
          <span />
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
