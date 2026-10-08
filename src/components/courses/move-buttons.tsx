import { ArrowDown, ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MoveButtonsProps {
  /** Prefix of the buttons' ids (`${id}-up`, `${id}-down`), for `focusMoveButton`. */
  id: string;
  /** What moves, for the buttons' names: "Subir «Ventas»". */
  label: string;
  index: number;
  total: number;
  disabled?: boolean;
  onMove: (direction: -1 | 1) => void;
}

/** "Subir" and "Bajar" for a row of an ordered list: what dragging does, with a finger or a key. */
export function MoveButtons({ id, label, index, total, disabled = false, onMove }: MoveButtonsProps) {
  return (
    <div className="flex shrink-0 items-center">
      <Button
        variant="ghost"
        size="icon-sm"
        id={`${id}-up`}
        aria-label={`Subir ${label}`}
        disabled={disabled || index === 0}
        onClick={() => onMove(-1)}
      >
        <ArrowUp />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        id={`${id}-down`}
        aria-label={`Bajar ${label}`}
        disabled={disabled || index === total - 1}
        onClick={() => onMove(1)}
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
