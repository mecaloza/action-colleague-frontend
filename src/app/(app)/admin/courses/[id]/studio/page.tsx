"use client";

import { useEffect, useRef, useState } from "react";
import { notFound, useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { useConfirm } from "@/components/layout/confirm-dialog";
import { BackLink } from "@/components/layout/back-link";
import { PageError, PageLoading } from "@/components/layout/query-state";
import { BriefStep } from "@/components/studio/brief-step";
import { ContentStep } from "@/components/studio/content-step";
import { OutlineStep } from "@/components/studio/outline-step";
import { ProductionStep } from "@/components/studio/production-step";
import { currentStep, furthestStep, isUntouched, OUTLINE_JOB, type StepId } from "@/components/studio/steps";
import { StudioStepper } from "@/components/studio/studio-stepper";
import { StyleStep } from "@/components/studio/style-step";
import type { ProposalRequest } from "@/components/studio/use-propose-outline";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ApiError } from "@/lib/api/client";
import { courseKeys, coursesApi } from "@/lib/api/courses";
import { STUDIO_STALE_MS, studioApi, studioKeys } from "@/lib/api/studio";
import { useActiveJobs } from "@/lib/hooks/use-jobs";
import { useStudioCapabilities } from "@/lib/hooks/use-studio-capabilities";
import { useUnsavedChangesWarning } from "@/lib/hooks/use-unsaved-changes-warning";

const COURSE_POLL_MS = 3000;

/** Each step fades in; the named states let the studio know when the new one is on screen. */
const STEP_MOTION = {
  hidden: { opacity: 0, y: 12 },
  shown: { opacity: 1, y: 0 },
  gone: { opacity: 0, y: -8 },
};

async function outlineOrNull(courseId: number) {
  try {
    return await studioApi.outline(courseId);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null; // nothing proposed yet
    throw error;
  }
}

/** The AI studio of a course: brief -> structure -> content -> style and voice -> production. */
export default function CourseStudioPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const confirm = useConfirm();
  const courseId = Number(params.id);
  const validId = Number.isInteger(courseId) && courseId > 0;
  const queryClient = useQueryClient();
  // Edits of the step on screen not saved yet (a script, the proposal): leaving the step or the page asks first.
  const [dirty, setDirty] = useState(false);
  useUnsavedChangesWarning(dirty);

  const jobs = useActiveJobs(courseId, validId);
  const activeJobs = jobs.data ?? [];
  const course = useQuery({
    queryKey: courseKeys.detail(courseId),
    queryFn: () => coursesApi.get(courseId),
    enabled: validId,
    refetchInterval: activeJobs.length ? COURSE_POLL_MS : false,
    // Another tab (or a job) may have changed it while this one was in the background.
    refetchOnWindowFocus: true,
    staleTime: STUDIO_STALE_MS,
  });
  const outline = useQuery({
    queryKey: studioKeys.outline(courseId),
    queryFn: () => outlineOrNull(courseId),
    enabled: validId,
    staleTime: STUDIO_STALE_MS,
    refetchOnWindowFocus: !dirty, // a new copy restarts the proposal's editor: never over unsaved edits
  });
  const capabilities = useStudioCapabilities();
  // The proposal asked for in this visit: the Structure step follows it until it ends (and says why if it fails).
  const [asked, setAsked] = useState<ProposalRequest | null>(null);

  // A job just finished: refresh the course and everything under it (outline, jobs, materials). Sorted: the order
  // of the list is not a change.
  const jobIds = activeJobs.map((job) => job.id).sort().join(",");
  const previousJobIds = useRef(jobIds);
  useEffect(() => {
    if (previousJobIds.current && previousJobIds.current !== jobIds) {
      void queryClient.invalidateQueries({ queryKey: courseKeys.detail(courseId) });
    }
    previousJobIds.current = jobIds;
  }, [jobIds, courseId, queryClient]);

  // The step to open depends on the course, its proposal and its jobs: nothing is shown until the three are known.
  // A proposal that can't be loaded counts as there: its step shows the error, the others work without it.
  const loading = course.isPending || outline.isPending || jobs.isPending;
  const ready = !loading && Boolean(course.data);
  const hasOutline = Boolean(outline.data) || outline.isError;
  const reached: StepId = ready ? currentStep(course.data!, hasOutline, activeJobs) : "brief";
  const furthest: StepId = ready ? furthestStep(course.data!, hasOutline, activeJobs) : "brief";
  // The step on screen stays where the admin is: it only moves by their choice or when a step finishes
  // (e.g. the proposal was asked for), never while they are editing a script.
  const [selected, setSelected] = useState<StepId | null>(null);
  useEffect(() => {
    if (ready && selected === null) setSelected(reached);
  }, [ready, selected, reached]);
  const step = selected ?? reached;

  // Moving on from inside a step (not with the stepper) takes the focus to the new step's heading.
  const stepRoot = useRef<HTMLDivElement>(null);
  const focusOnEnter = useRef(false);
  const show = (next: StepId, focus: boolean) => {
    focusOnEnter.current = focus && next !== step;
    setDirty(false);
    setSelected(next);
  };
  // The step on screen now: a request that ends after the admin moved on doesn't move them again.
  const onScreen = useRef(step);
  useEffect(() => {
    onScreen.current = step;
  });
  /** The work of step `from` is saved: on to `next`, if the admin is still there. */
  const advance = (from: StepId, next: StepId) => {
    if (onScreen.current === from) show(next, true);
  };
  const discardConfirmed = async () =>
    !dirty ||
    (await confirm({ title: "¿Descartar los cambios sin guardar?", confirmLabel: "Descartar", destructive: true }));
  /** The admin chose another step: unsaved edits of this one are dropped only after confirming. */
  const goTo = async (next: StepId, focus = true) => {
    if (next !== step && (await discardConfirmed())) show(next, focus);
  };

  if (!validId) notFound();
  if (loading) return <PageLoading />;
  if (!course.data) return <PageError query={course} />;

  const data = course.data;
  const courseHref = `/admin/courses/${data.id}`;
  const outlineJob = activeJobs.find((job) => job.type === OUTLINE_JOB) ?? null;
  // A new proposal would replace the modules: only while none has content or is being generated (the API's rule).
  const locked = data.modules.some(
    (module) => !isUntouched(module) || activeJobs.some((job) => job.module_id === module.id),
  );

  return (
    <>
      <section className="band-dark">
        <div className="container relative z-10 space-y-8 py-10">
          <div>
            <BackLink
              href={courseHref}
              onClick={(event) => {
                // Opening it in another tab (a modifier key) leaves this one as it is.
                if (!dirty || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                event.preventDefault();
                void discardConfirmed().then((leave) => {
                  if (!leave) return;
                  setDirty(false);
                  router.push(courseHref);
                });
              }}
            >
              Volver al curso
            </BackLink>
            <p className="eyebrow mb-3 mt-6 text-white/60">Estudio IA</p>
            <h1 className="display-lg text-balance text-white">{data.title}</h1>
          </div>
          <StudioStepper current={step} reached={furthest} onSelect={(next) => void goTo(next, false)} />
        </div>
      </section>

      <div className="container py-10">
        {!capabilities.ai && (
          <Alert variant="warning" className="mb-8">
            <Sparkles />
            <div>
              <AlertTitle>La IA no está configurada</AlertTitle>
              <AlertDescription>
                Sin la llave de OpenAI en el servidor no se pueden proponer estructuras ni escribir guiones.
              </AlertDescription>
            </div>
          </Alert>
        )}
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            ref={stepRoot}
            variants={STEP_MOTION}
            initial="hidden"
            animate="shown"
            exit="gone"
            transition={{ duration: 0.2 }}
            onAnimationComplete={(definition) => {
              if (definition !== "shown" || !focusOnEnter.current) return;
              focusOnEnter.current = false;
              stepRoot.current?.querySelector<HTMLElement>("h2")?.focus();
            }}
          >
            {step === "brief" && (
              <BriefStep
                course={data}
                aiReady={capabilities.ai}
                locked={locked}
                onProposed={(request) => {
                  setAsked(request);
                  advance("brief", "outline");
                }}
                onDirtyChange={setDirty}
              />
            )}
            {step === "outline" && (
              <OutlineStep
                course={data}
                outline={outline}
                activeJob={outlineJob}
                asked={asked}
                locked={locked}
                onProposed={setAsked}
                onBrief={() => void goTo("brief")}
                onApproved={() => {
                  setAsked(null); // what failed before approving is no longer news
                  advance("outline", "content");
                }}
                onDirtyChange={setDirty}
              />
            )}
            {step === "content" && (
              <ContentStep
                course={data}
                jobs={activeJobs}
                dirty={dirty}
                onDirtyChange={setDirty}
                onContinue={() => void goTo("style")}
              />
            )}
            {step === "style" && (
              <StyleStep
                course={data}
                jobs={activeJobs}
                capabilities={capabilities}
                onProducing={() => advance("style", "production")}
              />
            )}
            {step === "production" && <ProductionStep course={data} jobs={activeJobs} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </>
  );
}
