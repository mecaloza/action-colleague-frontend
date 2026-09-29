"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { mediaApi } from "@/lib/api/media";
import { studioKeys } from "@/lib/api/studio";
import type { CourseDetail } from "@/lib/api/types";
import { useUpload } from "@/lib/hooks/use-upload";
import { BriefForm, type BriefValues, initialBrief, MIN_BRIEF_CHARS } from "./brief-form";
import { ProposeStatus } from "./job-status";
import { MaterialsField } from "./materials";
import { LOCKED_MESSAGE } from "./steps";
import { isSettled, MATERIALS_POLL_MS, type ProposalRequest, useProposeOutline } from "./use-propose-outline";

interface BriefStepProps {
  course: CourseDetail;
  aiReady: boolean;
  /** Modules exist: a new proposal would replace them, so it's only allowed while they're untouched. */
  locked: boolean;
  /** The proposal was asked for (its job is the AI writing it). */
  onProposed: (request: ProposalRequest) => void;
  onDirtyChange: (dirty: boolean) => void;
}

/** The brief of an existing course: edit it, add materials and ask for a (new) structure. */
export function BriefStep({ course, aiReady, locked, onProposed, onDirtyChange }: BriefStepProps) {
  const queryClient = useQueryClient();
  const [values, setValues] = useState<BriefValues>(() => initialBrief(course.language, course.settings));
  const { proposeFromStep, status } = useProposeOutline();
  const { upload, busy: uploading, state: uploadState } = useUpload();
  // Edits not sent yet, or a proposal on its way (leaving stops it): leaving the step asks first.
  const saved = initialBrief(course.language, course.settings);
  const persisted = (brief: BriefValues) => JSON.stringify([brief.brief, brief.audience, brief.tone, brief.minutes, brief.language]);
  const dirty = Boolean(status) || persisted(values) !== persisted(saved);
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);
  const materials = useQuery({
    queryKey: studioKeys.materials(course.id),
    queryFn: () => mediaApi.materials(course.id),
    // Poll while the server is still reading a document.
    refetchInterval: (query) => (query.state.data?.some((asset) => !isSettled(asset)) ? MATERIALS_POLL_MS : false),
  });

  // A failed upload stays in `uploadState` (shown below) until the next one starts.
  const addMaterial = async (file: File) => {
    const asset = await upload(file, { kind: "document", courseId: course.id, purpose: "course_material" });
    if (asset) void queryClient.invalidateQueries({ queryKey: studioKeys.materials(course.id) });
  };

  // Leaving the step stops the work (reading the documents can take minutes).
  const submit = async () => {
    const request = await proposeFromStep(course.id, values);
    if (request) onProposed(request);
  };

  return (
    <div className="grid gap-12 lg:grid-cols-[1.5fr_1fr]">
      <div>
        <h2 tabIndex={-1} className="sr-only">
          Brief del curso
        </h2>
        <BriefForm values={values} onChange={setValues} disabled={Boolean(status) || locked} />
      </div>
      <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
        <MaterialsField
          uploaded={materials.data ?? []}
          onUpload={addMaterial}
          uploading={uploading}
          busy={uploading || Boolean(status) || locked}
        />
        {uploading && (
          <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-accent" /> Subiendo el documento…
          </p>
        )}
        {uploadState.phase === "error" && (
          <p role="alert" className="flex items-start gap-2 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {uploadState.message}
          </p>
        )}
        {locked ? (
          <p className="border-l-2 border-ink-800 bg-mist px-4 py-3 text-sm">{LOCKED_MESSAGE}</p>
        ) : status ? (
          <ProposeStatus status={status} />
        ) : (
          <Button
            variant="accent"
            size="lg"
            className="w-full"
            onClick={submit}
            disabled={!aiReady || uploading || values.brief.trim().length < MIN_BRIEF_CHARS}
          >
            Proponer estructura <ArrowRight />
          </Button>
        )}
      </aside>
    </div>
  );
}
