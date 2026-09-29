"use client";

import { useEffect, useRef, useState } from "react";
import { notFound, useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { BackLink } from "@/components/layout/back-link";
import { PageError, PageLoading } from "@/components/layout/query-state";
import { BriefStep } from "@/components/studio/brief-step";
import { ContentStep } from "@/components/studio/content-step";
import { OutlineStep } from "@/components/studio/outline-step";
import { ProductionStep } from "@/components/studio/production-step";
import { currentStep, type StepId } from "@/components/studio/steps";
import { StudioStepper } from "@/components/studio/studio-stepper";
import { StyleStep } from "@/components/studio/style-step";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ApiError } from "@/lib/api/client";
import { courseKeys, coursesApi } from "@/lib/api/courses";
import { studioApi, studioKeys } from "@/lib/api/studio";
import { useActiveJobs } from "@/lib/hooks/use-jobs";
import { useStudioCapabilities } from "@/lib/hooks/use-studio-capabilities";

const COURSE_POLL_MS = 3000;

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
  const courseId = Number(params.id);
  const validId = Number.isInteger(courseId) && courseId > 0;
  const queryClient = useQueryClient();

  const jobs = useActiveJobs(courseId, validId);
  const activeJobs = jobs.data ?? [];
  const course = useQuery({
    queryKey: courseKeys.detail(courseId),
    queryFn: () => coursesApi.get(courseId),
    enabled: validId,
    refetchInterval: activeJobs.length ? COURSE_POLL_MS : false,
  });
  const outline = useQuery({ queryKey: studioKeys.outline(courseId), queryFn: () => outlineOrNull(courseId), enabled: validId });
  const capabilities = useStudioCapabilities();

  // A job just finished: refresh the course and everything under it (outline, jobs, materials).
  const jobIds = activeJobs.map((job) => job.id).join(",");
  const previousJobIds = useRef(jobIds);
  useEffect(() => {
    if (previousJobIds.current && previousJobIds.current !== jobIds) {
      void queryClient.invalidateQueries({ queryKey: courseKeys.detail(courseId) });
    }
    previousJobIds.current = jobIds;
  }, [jobIds, courseId, queryClient]);

  const ready = course.data && !outline.isPending && !jobs.isPending;
  const reached: StepId = ready ? currentStep(course.data!, Boolean(outline.data), activeJobs) : "brief";
  // The step on screen stays where the admin is: it only moves by their choice or when a step finishes
  // (e.g. the proposal arrives), never while they are editing a script.
  const [selected, setSelected] = useState<StepId | null>(null);
  useEffect(() => {
    if (ready && selected === null) setSelected(reached);
  }, [ready, selected, reached]);
  useEffect(() => {
    if (selected === "brief" && reached === "outline" && outline.data) setSelected("outline");
  }, [selected, reached, outline.data]);

  if (!validId) notFound();
  if (course.isPending || outline.isPending) return <PageLoading />;
  if (!course.data) return <PageError query={course} />;
  if (outline.error && !outline.data) return <PageError query={outline} />;

  const data = course.data;
  const step = selected ?? reached;
  const outlineJob = activeJobs.find((job) => job.type === "ai.outline") ?? null;
  const locked = data.modules.some((module) => module.source !== "ai" || module.scene_count > 0 || Boolean(module.video));

  return (
    <>
      <section className="band-dark">
        <div className="container relative z-10 space-y-8 py-10">
          <div>
            <BackLink href={`/admin/courses/${data.id}`}>Volver al curso</BackLink>
            <p className="eyebrow mb-3 mt-6 text-white/60">Estudio IA</p>
            <h1 className="display-lg text-balance text-white">{data.title}</h1>
          </div>
          <StudioStepper current={step} reached={reached} onSelect={setSelected} />
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
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {step === "brief" && (
              <BriefStep
                course={data}
                aiReady={capabilities.ai}
                locked={locked}
                onProposed={() => setSelected("outline")}
              />
            )}
            {step === "outline" && (
              <OutlineStep
                course={data}
                outline={outline.data ?? null}
                job={outlineJob}
                onApproved={() => setSelected("content")}
              />
            )}
            {step === "content" && (
              <ContentStep course={data} jobs={activeJobs} onContinue={() => setSelected("style")} />
            )}
            {step === "style" && (
              <StyleStep course={data} capabilities={capabilities} onProducing={() => setSelected("production")} />
            )}
            {step === "production" && <ProductionStep course={data} jobs={activeJobs} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </>
  );
}
