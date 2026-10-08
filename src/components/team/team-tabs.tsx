"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/admin/team", label: "Personas" },
  { href: "/admin/team/profiles", label: "Perfiles" },
];

/** The two views of the team: its people, and the profiles that group them. */
export function TeamTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Equipo" className="mb-8 flex gap-6 border-b border-border">
      {TABS.map((tab) => {
        const current = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={current ? "page" : undefined}
            className={cn(
              "-mb-px inline-flex min-h-11 items-center border-b-2 text-[11.5px] font-bold uppercase tracking-label transition-colors",
              current ? "border-accent text-ink-800" : "border-transparent text-muted-foreground hover:text-ink-800",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
