"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Sparkles } from "lucide-react";
import { BackLink } from "@/components/layout/back-link";
import { PageHero } from "@/components/layout/page-hero";
import { BriefForm, type BriefValues, initialBrief, MIN_BRIEF_CHARS } from "@/components/studio/brief-form";
import { ProposeStatus } from "@/components/studio/job-status";
import { MaterialsField } from "@/components/studio/materials";
import { STEPS } from "@/components/studio/steps";
import { useProposeOutline } from "@/components/studio/use-propose-outline";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { coursesApi } from "@/lib/api/courses";
import type { CourseDetail } from "@/lib/api/types";
import { twoDigits } from "@/lib/format";
import { useCourseCache } from "@/lib/hooks/use-course-cache";
import { useStudioCapabilities } from "@/lib/hooks/use-studio-capabilities";
import { useUnmountSignal } from "@/lib/hooks/use-unmount-signal";
import { toastError } from "@/lib/notify";

const PROVISIONAL_TITLE_CHARS = 60;

/** A working title until the AI proposes one: the start of the brief's first sentence, cut at a word. */
function provisionalTitle(brief: string): string {
  const firstSentence = brief.trim().split(/[.:\n]/)[0].trim();
  if (firstSentence.length <= PROVISIONAL_TITLE_CHARS) return firstSentence || "Curso en preparación";
  const cut = firstSentence.slice(0, PROVISIONAL_TITLE_CHARS);
  return `${cut.slice(0, cut.lastIndexOf(" ")).replace(/[,;]$/, "")}…`;
}

export default function NewAiCoursePage() {
  const router = useRouter();
  const unmountSignal = useUnmountSignal();
  const { ai } = useStudioCapabilities();
  const { refreshLibrary } = useCourseCache();
  const [values, setValues] = useState<BriefValues>(() => initialBrief());
  const [staged, setStaged] = useState<File[]>([]);
  const [starting, setStarting] = useState(false);
  // What the wait says outside the proposal's own steps: creating the course, then opening its studio.
  const [phase, setPhase] = useState("Creando el curso");
  const { propose, status } = useProposeOutline();
  const canStart = values.brief.trim().length >= MIN_BRIEF_CHARS && ai && !starting;

  const start = async () => {
    // Leaving the page stops the work (reading documents can take minutes) and the redirect at the end.
    const signal = unmountSignal();
    setStarting(true);
    let course: CourseDetail;
    try {
      course = await coursesApi.create({
        title: provisionalTitle(values.brief),
        source: "ai",
        language: values.language,
      });
      refreshLibrary(); // the new course shows in the library right away
    } catch (error) {
      if (!signal.aborted) toastError(error);
      setStarting(false);
      return;
    }
    // The course exists: whatever is left (or fails) continues in its studio.
    setPhase("Abriendo el estudio"); // on screen once the proposal's steps are done, until the studio opens
    try {
      await propose(course.id, values, { staged, signal });
    } catch (error) {
      if (!signal.aborted) toastError(error);
    }
    if (!signal.aborted) router.replace(`/admin/courses/${course.id}/studio`);
  };

  return (
    <>
      <PageHero
        eyebrow="Nuevo curso · Con IA"
        title={
          <>
            Cuéntale a la IA qué curso <span className="text-accent">necesitas.</span>
          </>
        }
        description="Propone la estructura, escribe guiones y evaluaciones con tus documentos, y produce los videos con tu marca. Revisas y editas cada paso."
      >
        <BackLink href="/admin/courses/new">Otras formas de crear</BackLink>
      </PageHero>

      <section className="container grid gap-12 py-12 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-8">
          {!ai && (
            <Alert variant="warning">
              <Sparkles />
              <div>
                <AlertTitle>La IA no está configurada</AlertTitle>
                <AlertDescription>
                  Falta la llave de OpenAI en el servidor. Mientras tanto puedes crear cursos con tu propio material.
                </AlertDescription>
              </div>
            </Alert>
          )}
          <BriefForm values={values} onChange={setValues} disabled={starting} />
        </div>

        <aside className="space-y-8 lg:sticky lg:top-24 lg:self-start">
          <MaterialsField staged={staged} onStagedChange={setStaged} busy={starting} />

          <div className="border border-border bg-white p-6">
            <p className="mb-4 text-[11px] font-bold uppercase tracking-label text-ink-700">Qué sigue</p>
            <ol className="space-y-3">
              {STEPS.map((step, index) => (
                <li key={step.id} className="flex items-baseline gap-3 text-sm">
                  <span className="font-display text-lg font-medium text-accent">{twoDigits(index + 1)}</span>
                  <span>
                    <span className="font-semibold">{step.label}.</span>{" "}
                    <span className="text-muted-foreground">{step.hint}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>

          {starting ? (
            <ProposeStatus status={status ?? phase} />
          ) : (
            <Button variant="accent" size="lg" className="w-full" onClick={start} disabled={!canStart}>
              Proponer estructura <ArrowRight />
            </Button>
          )}
        </aside>
      </section>
    </>
  );
}
