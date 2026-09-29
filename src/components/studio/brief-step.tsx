"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { mediaApi } from "@/lib/api/media";
import { studioKeys } from "@/lib/api/studio";
import type { CourseDetail } from "@/lib/api/types";
import { useUpload } from "@/lib/hooks/use-upload";
import { toastError } from "@/lib/notify";
import { BriefForm, type BriefValues, initialBrief, MIN_BRIEF_CHARS } from "./brief-form";
import { ProposeStatus } from "./job-status";
import { MaterialsField } from "./materials";
import { isProcessed, MATERIALS_POLL_MS, useProposeOutline } from "./use-propose-outline";

interface BriefStepProps {
  course: CourseDetail;
  aiReady: boolean;
  /** Modules exist: a new proposal would replace them, so it's only allowed while they're untouched. */
  locked: boolean;
  onProposed: () => void;
}

/** The brief of an existing course: edit it, add materials and ask for a (new) structure. */
export function BriefStep({ course, aiReady, locked, onProposed }: BriefStepProps) {
  const queryClient = useQueryClient();
  const [values, setValues] = useState<BriefValues>(() => initialBrief(course.language, course.settings));
  const { propose, status } = useProposeOutline();
  const { upload, busy: uploading } = useUpload();
  const materials = useQuery({
    queryKey: studioKeys.materials(course.id),
    queryFn: () => mediaApi.materials(course.id),
    // Poll while the server is still reading a document.
    refetchInterval: (query) => (query.state.data?.some((asset) => !isProcessed(asset)) ? MATERIALS_POLL_MS : false),
  });

  const addMaterial = async (file: File) => {
    const asset = await upload(file, { kind: "document", courseId: course.id, purpose: "course_material" });
    if (asset) void queryClient.invalidateQueries({ queryKey: studioKeys.materials(course.id) });
  };

  const submit = async () => {
    try {
      if (await propose(course.id, values)) onProposed();
    } catch (error) {
      toastError(error);
    }
  };

  return (
    <div className="grid gap-12 lg:grid-cols-[1.5fr_1fr]">
      <BriefForm values={values} onChange={setValues} disabled={Boolean(status) || locked} />
      <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
        <MaterialsField uploaded={materials.data ?? []} onUpload={addMaterial} busy={uploading || Boolean(status) || locked} />
        {uploading && (
          <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-accent" /> Subiendo el documento…
          </p>
        )}
        {locked ? (
          <p className="border-l-2 border-ink-800 bg-mist px-4 py-3 text-sm">
            La estructura ya se aprobó y el curso tiene contenido. Cambia módulos desde el paso Contenido o desde el editor.
          </p>
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
