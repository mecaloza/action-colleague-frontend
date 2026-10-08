import { ArrowDown, ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface MoveButtonsProps {
  /** Prefix of the buttons' ids (`${id}-up`, `${id}-down`), for `focusMoveButton`. */
  id: string;
  /** What moves, for the buttons' names: "Subir «Ventas»". */
  label: string;
  index: number;
  total: number;
  /**
   * A move is being saved: the arrows wait, dimmed and announced as unavailable. They are never `disabled`, which
   * would drop the focus of the one just pressed.
   */
  busy?: boolean;
  onMove: (direction: -1 | 1) => void;
}

/** "Subir" and "Bajar" for a row of an ordered list: what dragging does, with a finger or a key. */
export function MoveButtons({ id, label, index, total, busy = false, onMove }: MoveButtonsProps) {
  return (
    <div className="flex shrink-0 items-center">
      <Button
        variant="ghost"
        size="icon-sm"
        id={`${id}-up`}
        aria-label={`Subir ${label}`}
        disabled={index === 0}
        aria-disabled={busy || undefined}
        className={cn(busy && "opacity-45")}
        onClick={() => !busy && onMove(-1)}
      >
        <ArrowUp />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        id={`${id}-down`}
        aria-label={`Bajar ${label}`}
        disabled={index === total - 1}
        aria-disabled={busy || undefined}
        className={cn(busy && "opacity-45")}
        onClick={() => !busy && onMove(1)}
      >
        <ArrowDown />
      </Button>
    </div>
  );
}

/**
 * Once a row moved, the arrow pressed takes the focus back: moving the row in the page drops it. At the top or the
 * bottom that arrow is off, so the other one takes it.
 */
export function focusMoveButton(id: string, direction: -1 | 1) {
  const arrow = (towards: -1 | 1) =>
    document.getElementById(`${id}-${towards === -1 ? "up" : "down"}`) as HTMLButtonElement | null;
  const pressed = arrow(direction);
  (pressed && !pressed.disabled ? pressed : arrow(direction === -1 ? 1 : -1))?.focus();
}
