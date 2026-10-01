"use client";

import { useEffect, useRef } from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { Check, ChevronDown, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SLIDE_ICONS, slideIcon } from "@/lib/slide-icons";

interface IconPickerProps {
  value: string;
  onChange: (name: string) => void;
  /** What the icon is for, e.g. "Viñetas 2": names the button for screen readers. */
  label: string;
}

const NONE = { name: "", label: "Sin ícono", Icon: Minus };

/**
 * Picks the icon a slide shows for a point (or for a statement or a figure); "" shows none.
 * A list (one icon per row, with its name) so the arrows, typing a name and screen readers all work.
 */
export function IconPicker({ value, onChange, label }: IconPickerProps) {
  const current = slideIcon(value);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          className="w-14 shrink-0 gap-0.5 px-1.5"
          aria-label={`Ícono de ${label}: ${current ? current.label : "ninguno"}`}
        >
          {current ? <current.Icon className="text-accent" /> : <Minus className="text-muted-foreground" />}
          <ChevronDown className="!size-3 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 w-60 overflow-y-auto">
        <IconList value={current ? current.name : ""} onChange={onChange} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The options, mounted when the menu opens: it starts on the icon in use (not at the top of a long list). */
function IconList({ value, onChange }: { value: string; onChange: (name: string) => void }) {
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // After the menu's own opening focus, which goes to the first option.
    const timer = window.setTimeout(() => {
      const checked = list.current?.querySelector<HTMLElement>('[data-state="checked"]');
      checked?.focus();
      checked?.scrollIntoView({ block: "nearest" });
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <DropdownMenuPrimitive.RadioGroup ref={list} value={value} onValueChange={onChange}>
      {[NONE, ...SLIDE_ICONS].map(({ name, label: iconLabel, Icon }) => (
        <DropdownMenuPrimitive.RadioItem
          key={name || "none"}
          value={name}
          textValue={iconLabel}
          className="flex cursor-pointer select-none items-center gap-3 rounded-sm px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-muted data-[state=checked]:text-accent"
        >
          <Icon className="size-4 shrink-0" aria-hidden />
          <span className="flex-1">{iconLabel}</span>
          <DropdownMenuPrimitive.ItemIndicator>
            <Check className="size-4" aria-hidden />
          </DropdownMenuPrimitive.ItemIndicator>
        </DropdownMenuPrimitive.RadioItem>
      ))}
    </DropdownMenuPrimitive.RadioGroup>
  );
}
