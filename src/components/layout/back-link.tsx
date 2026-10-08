import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface BackLinkProps {
  href: string;
  /** Runs before navigating; `event.preventDefault()` stays on the page (e.g. to confirm first). */
  onClick?: React.MouseEventHandler<HTMLAnchorElement>;
  children: React.ReactNode;
}

/** "← Label" link for the dark bands at the top of inner pages. */
export function BackLink({ href, onClick, children }: BackLinkProps) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="-my-2.5 inline-flex min-h-10 items-center gap-2 py-2.5 text-[11px] font-bold uppercase tracking-label text-white/60 hover:text-white"
    >
      <ArrowLeft className="h-4 w-4" /> {children}
    </Link>
  );
}
