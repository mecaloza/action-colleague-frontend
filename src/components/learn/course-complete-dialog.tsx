"use client";

import { useRef } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Award, Download, ShieldCheck, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { CertificateRef, PathOutcome } from "@/lib/api/types";
import { safeHttpUrl } from "@/lib/safe-url";

// Brand diamonds that rise and fade, a quiet celebration.
const PIECES = Array.from({ length: 14 }, (_, index) => ({
  left: `${(index * 37) % 100}%`,
  size: 6 + ((index * 5) % 10),
  delay: (index % 7) * 0.08,
  color: index % 3 !== 0 ? "bg-accent" : "bg-white/70",
}));

// Stacked on a phone; a long course title wraps inside the button instead of widening it past the dialog.
const ACTION = "h-auto min-h-11 max-w-full whitespace-normal py-3";

interface EarnedCertificateProps {
  certificate: CertificateRef;
  label: string;
  /** Said after each link's text to screen readers when the dialog shows two ("de la ruta", "del curso"). */
  of?: string;
}

/** A certificate just earned: its code, its PDF and its public verification (each in a new tab). */
function EarnedCertificate({ certificate, label, of }: EarnedCertificateProps) {
  const pdf = safeHttpUrl(certificate.pdf_url);
  const verify = safeHttpUrl(certificate.verify_url);
  const suffix = of ? <span className="sr-only"> {of}</span> : null;
  return (
    <div className="border border-white/15 bg-white/5 p-4 text-left">
      <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-label text-white/60">
        <Award className="h-4 w-4 shrink-0 text-accent" aria-hidden /> {label}
      </p>
      <div className="flex flex-wrap items-center justify-between gap-x-4">
        <p className="break-all font-display text-lg font-medium tracking-tight text-white">{certificate.code}</p>
        {verify && (
          <a
            href={verify}
            target="_blank"
            rel="noopener"
            className="inline-flex min-h-10 items-center gap-1.5 text-[11px] font-bold uppercase tracking-label text-white/80 underline-offset-4 hover:text-white hover:underline"
          >
            <ShieldCheck className="h-4 w-4" aria-hidden /> Ver verificación{suffix}
          </a>
        )}
      </div>
      {pdf && (
        <Button variant="inverse" size="sm" className="mt-2 min-h-10 w-full" asChild>
          {/* A plain link to the PDF (no blob made after a request): phones open it as they open any PDF. */}
          <a href={pdf} target="_blank" rel="noopener">
            <Download aria-hidden /> Descargar certificado{suffix}
          </a>
        </Button>
      )}
    </div>
  );
}

interface CourseCompleteDialogProps {
  open: boolean;
  courseTitle: string;
  /** What completing the course earned and opened: its certificate, the path's next course or the path completed. */
  outcome: PathOutcome;
  onOpenChange: (open: boolean) => void;
}

/**
 * "¡Completaste el curso!", or the whole path; with the certificates earned (the course's, and the path's when it
 * completed one) and the path's next course to go on with when there is one.
 */
export function CourseCompleteDialog({ open, courseTitle, outcome, onOpenChange }: CourseCompleteDialogProps) {
  const { certificate, next_course: next, path_completed: path } = outcome;
  const pathCertificate = path?.certificate ?? null;
  const earned = Boolean(certificate || pathCertificate);
  // Two certificates (course and path): each link says which one.
  const both = Boolean(certificate && pathCertificate);
  const primary = useRef<HTMLAnchorElement>(null);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        // Scrolls when it doesn't fit (a phone, with certificates): the celebration clips itself instead.
        className="max-w-lg overflow-x-hidden border-0 bg-ink-950 p-0 text-white"
        hideClose
        // The way on first (the next course, or back): the certificates above stay a Tab away, and the description
        // already says they are ready. Without scrolling to it: a phone shows the celebration from its top.
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          primary.current?.focus({ preventScroll: true });
        }}
      >
        <div className="relative px-6 pb-8 pt-14 text-center sm:px-8">
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
            {PIECES.map((piece, index) => (
              <motion.span
                key={index}
                className={`absolute bottom-0 rotate-45 ${piece.color}`}
                style={{ left: piece.left, width: piece.size, height: piece.size }}
                initial={{ y: 40, opacity: 0 }}
                animate={{ y: -320, opacity: [0, 1, 0] }}
                transition={{ duration: 2.2, delay: piece.delay, ease: "easeOut" }}
              />
            ))}
          </div>
          <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 200, damping: 14 }}>
            <Trophy className="mx-auto h-14 w-14 text-accent" />
          </motion.div>
          <DialogTitle className="mt-6 font-display text-4xl font-medium tracking-tightest text-white">
            {path ? "¡Completaste la ruta!" : "¡Completaste el curso!"}
          </DialogTitle>
          <DialogDescription className="mt-3 text-white/70">
            {path
              ? `Terminaste «${courseTitle}» y con él la ruta «${path.title}». ¡Buen trabajo!`
              : next
                ? `Terminaste «${courseTitle}». Ya puedes seguir con el próximo curso de tu ruta.`
                : `Terminaste «${courseTitle}». Buen trabajo: puedes repasarlo cuando quieras.`}
            {earned && (both ? " Tus certificados ya están listos." : " Tu certificado ya está listo.")}
          </DialogDescription>
          {earned && (
            <div className="mt-6 space-y-3">
              {pathCertificate && (
                <EarnedCertificate
                  certificate={pathCertificate}
                  label={both ? "Certificado de la ruta" : "Tu certificado de la ruta"}
                  of={both ? "de la ruta" : undefined}
                />
              )}
              {certificate && (
                <EarnedCertificate
                  certificate={certificate}
                  label={both ? "Certificado del curso" : "Tu certificado"}
                  of={both ? "del curso" : undefined}
                />
              )}
            </div>
          )}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
            {next && (
              <Button variant="accent" className={ACTION} asChild>
                <Link ref={primary} href={`/learn/${next.course_id}`} onClick={() => onOpenChange(false)}>
                  Siguiente curso: {next.title} <ArrowRight />
                </Link>
              </Button>
            )}
            <Button variant={next ? "outline-inverse" : "accent"} className={ACTION} asChild>
              <Link ref={next ? undefined : primary} href="/learn">
                Volver a mis cursos
              </Link>
            </Button>
            <Button variant="outline-inverse" className={ACTION} onClick={() => onOpenChange(false)}>
              Repasar el curso
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
