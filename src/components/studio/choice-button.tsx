"use client";

import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface ChoiceButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected: boolean;
}

/** One option of a pick-one group (tone, minutes, theme): the chosen one is filled in; `className` sets the size. */
export function ChoiceButton({ selected, className, ...props }: ChoiceButtonProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "border transition-colors",
        selected ? "border-ink-800 bg-ink-800 text-white" : "border-input bg-white hover:border-ink-800",
        className,
      )}
      {...props}
    />
  );
}
