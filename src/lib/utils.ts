import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** The list without `item` if it has it, with `item` added at the end if not (a multi-select's click). */
export function toggled<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((other) => other !== item) : [...list, item];
}
