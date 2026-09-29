"use client";

import { ArrowDown, ArrowUp, Copy, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RowActionsProps {
  /** What the row is, for the buttons' names: "módulo" gives "Subir módulo 2". */
  noun: string;
  index: number;
  total: number;
  onMove: (to: number) => void;
  onRemove: () => void;
  /** Adds a duplicate button when given. */
  onDuplicate?: () => void;
}

/** Move, (duplicate) and remove buttons at the end of a row's header; the only row of the list can't be removed. */
export function RowActions({ noun, index, total, onMove, onRemove, onDuplicate }: RowActionsProps) {
  const label = (action: string) => `${action} ${noun} ${index + 1}`;
  return (
    <div className="ml-auto flex items-center">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={label("Subir")}
        disabled={index === 0}
        onClick={() => onMove(index - 1)}
      >
        <ArrowUp />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={label("Bajar")}
        disabled={index === total - 1}
        onClick={() => onMove(index + 1)}
      >
        <ArrowDown />
      </Button>
      {onDuplicate && (
        <Button variant="ghost" size="icon-sm" aria-label={label("Duplicar")} onClick={onDuplicate}>
          <Copy />
        </Button>
      )}
      <Button variant="ghost" size="icon-sm" aria-label={label("Quitar")} disabled={total === 1} onClick={onRemove}>
        <Trash2 />
      </Button>
    </div>
  );
}
