"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  destructive?: boolean;
}

type Confirm = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<Confirm | null>(null);

/** Accessible replacement for window.confirm: `if (await confirm({...})) ...` */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  // Kept after closing so the text doesn't vanish during the closing animation.
  const [options, setOptions] = useState<ConfirmOptions>({ title: "" });
  const resolver = useRef<(value: boolean) => void>();
  const cancelButton = useRef<HTMLButtonElement>(null);
  const confirmButton = useRef<HTMLButtonElement>(null);

  const confirm = useCallback<Confirm>((next) => {
    resolver.current?.(false); // a newer question replaces one still open
    setOptions(next);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = (value: boolean) => {
    resolver.current?.(value);
    resolver.current = undefined;
    setOpen(false);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog open={open} onOpenChange={(next) => !next && close(false)}>
        <DialogContent
          className="max-w-md"
          onOpenAutoFocus={(event) => {
            // Destructive questions start on "Cancelar": Enter never deletes by accident.
            // Focused here, not with autoFocus, so focus can return to whoever asked (see useReturnFocus).
            event.preventDefault();
            (options.destructive ? cancelButton : confirmButton).current?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>{options.title}</DialogTitle>
            {options.description && <DialogDescription>{options.description}</DialogDescription>}
          </DialogHeader>
          <DialogFooter>
            <Button ref={cancelButton} variant="ghost" onClick={() => close(false)}>
              Cancelar
            </Button>
            <Button
              ref={confirmButton}
              variant={options.destructive ? "destructive" : "default"}
              onClick={() => close(true)}
            >
              {options.confirmLabel ?? "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): Confirm {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error("useConfirm must be used inside <ConfirmProvider>");
  return confirm;
}
