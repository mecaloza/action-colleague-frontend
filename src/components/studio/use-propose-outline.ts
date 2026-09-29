"use client";

import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { coursesApi } from "@/lib/api/courses";
import { mediaApi } from "@/lib/api/media";
import { studioApi, studioKeys } from "@/lib/api/studio";
import type { Job, MediaAsset } from "@/lib/api/types";
import { useUpload } from "@/lib/hooks/use-upload";
import type { BriefValues } from "./brief-form";

export const MATERIALS_POLL_MS = 2000;
const MATERIALS_WAIT_MS = 10 * 60 * 1000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** The server is done with the document: the AI can read it (`ready`) or never will (`failed`). */
export const isProcessed = (asset: MediaAsset) => asset.status === "ready" || asset.status === "failed";

/** The AI only reads processed documents: wait for them (up to 10 minutes) and return the failed ones. */
async function waitForMaterials(courseId: number): Promise<MediaAsset[]> {
  const deadline = Date.now() + MATERIALS_WAIT_MS;
  for (;;) {
    const materials = await mediaApi.materials(courseId);
    if (materials.every(isProcessed) || Date.now() > deadline) {
      return materials.filter((asset) => asset.status === "failed");
    }
    await sleep(MATERIALS_POLL_MS);
  }
}

/**
 * Saves the brief, uploads the staged materials, waits until they are read and asks the AI for an
 * outline. `status` narrates each step for the UI; the returned job is the outline being written.
 */
export function useProposeOutline() {
  const queryClient = useQueryClient();
  const { upload } = useUpload();
  const [status, setStatus] = useState<string | null>(null);

  const propose = useCallback(
    async (courseId: number, values: BriefValues, staged: File[] = [], feedback = ""): Promise<Job | null> => {
      try {
        setStatus("Guardando el brief");
        await coursesApi.update(courseId, {
          language: values.language,
          settings: { brief: values.brief, audience: values.audience, tone: values.tone, minutes: values.minutes },
        });
        for (let index = 0; index < staged.length; index += 1) {
          const file = staged[index];
          setStatus(`Subiendo ${file.name} (${index + 1} de ${staged.length})`);
          const asset = await upload(file, { kind: "document", courseId, purpose: "course_material" });
          if (!asset) throw new Error(`No pudimos subir «${file.name}». Revisa tu conexión e inténtalo de nuevo.`);
        }
        setStatus("Leyendo tus documentos");
        const failed = await waitForMaterials(courseId);
        if (failed.length) {
          toast.warning(`La IA no podrá usar ${failed.map((asset) => `«${asset.original_filename}»`).join(", ")}.`);
        }
        setStatus("Pidiendo la propuesta a la IA");
        const job = await studioApi.generateOutline(courseId, {
          brief: values.brief,
          audience: values.audience,
          tone: values.tone,
          minutes: values.minutes,
          modules: values.modules,
          feedback,
        });
        void queryClient.invalidateQueries({ queryKey: studioKeys.jobs(courseId) });
        return job;
      } finally {
        setStatus(null);
      }
    },
    [queryClient, upload],
  );

  return { propose, status };
}
