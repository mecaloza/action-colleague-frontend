"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { PathOutcome } from "@/lib/api/types";

// Brand diamonds that rise and fade, a quiet celebration.
const PIECES = Array.from({ length: 14 }, (_, index) => ({
  left: `${(index * 37) % 100}%`,
  size: 6 + ((index * 5) % 10),
  delay: (index % 7) * 0.08,
  color: index % 3 !== 0 ? "bg-accent" : "bg-white/70",
}));

// Stacked on a phone; a long course title wraps inside the button instead of widening it past the dialog.
const ACTION = "h-auto min-h-11 max-w-full whitespace-normal py-3";

interface CourseCompleteDialogProps {
  open: boolean;
  courseTitle: string;
  /** What completing the course opened in the learner's paths: the next course, or the path completed. */
  outcome: PathOutcome;
  onOpenChange: (open: boolean) => void;
}

/** "¡Completaste el curso!", or the whole path; with the path's next course to go on with when there is one. */
export function CourseCompleteDialog({ open, courseTitle, outcome, onOpenChange }: CourseCompleteDialogProps) {
  const { next_course: next, path_completed: path } = outcome;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg overflow-hidden border-0 bg-ink-950 p-0 text-white" hideClose>
        <div className="relative px-6 pb-8 pt-14 text-center sm:px-8">
          <div className="pointer-events-none absolute inset-0" aria-hidden>
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
          </DialogDescription>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
            {next && (
              <Button variant="accent" className={ACTION} asChild>
                <Link href={`/learn/${next.course_id}`} onClick={() => onOpenChange(false)}>
                  Siguiente curso: {next.title} <ArrowRight />
                </Link>
              </Button>
            )}
            <Button variant={next ? "outline-inverse" : "accent"} className={ACTION} asChild>
              <Link href="/learn">Volver a mis cursos</Link>
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
