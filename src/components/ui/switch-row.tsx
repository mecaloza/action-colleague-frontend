import { Switch } from "./switch";

interface SwitchRowProps {
  id: string;
  label: string;
  hint: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

/** A setting turned on or off: the whole row is the target (a finger needs more than the switch). */
export function SwitchRow({ id, label, hint, checked, onCheckedChange }: SwitchRowProps) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start justify-between gap-4 p-4">
      <span>
        <span className="block font-semibold">{label}</span>
        <span id={`${id}-hint`} className="mt-0.5 block text-sm text-muted-foreground">
          {hint}
        </span>
      </span>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        aria-label={label}
        aria-describedby={`${id}-hint`}
        className="mt-0.5"
      />
    </label>
  );
}
