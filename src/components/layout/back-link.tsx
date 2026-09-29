import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/** "← Label" link for the dark bands at the top of inner pages. */
export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-label text-white/60 hover:text-white"
    >
      <ArrowLeft className="h-4 w-4" /> {children}
    </Link>
  );
}
