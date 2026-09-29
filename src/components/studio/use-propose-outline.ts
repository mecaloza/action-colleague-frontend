"use client";

import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { courseKeys, coursesApi } from "@/lib/api/courses";
import { mediaApi } from "@/lib/api/media";
import { studioApi } from "@/lib/api/studio";
import type { Job, MediaAsset } from "@/lib/api/types";
import { useUnmountSignal } from "@/lib/hooks/use-unmount-signal";
import { useUpload } from "@/lib/hooks/use-upload";
import type { BriefValues } from "./brief-form";
import { useStudioCache } from "./use-studio-cache";

export const MATERIALS_POLL_MS = 2000;
const MATERIALS_WAIT_MS = 10 * 60 * 1000;

const aborted = () => new DOMException("Cancelado", "AbortError");

/** Waits `ms`, or rejects as soon as `signal` aborts. */
function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(aborted());
    const stop = () => {
      window.clearTimeout(timer);
      reject(aborted());
    };
    const timer = window.setTimeout(() => {
      signal?.removeEventListener("abort", stop);
      resolve();
    }, ms);
    signal?.addEventListener("abort", stop, { once: true });
  });
}

/**
 * Nothing will change the document anymore: the AI can read it (`ready`), never will (`failed`), or its upload
 * never finished (`pending`).
 */
export const isSettled = (asset: MediaAsset) =>
  asset.status === "ready" || asset.status === "failed" || asset.status === "pending";

/** The AI only reads processed documents: wait for them (up to 10 minutes) and return the ones it can't use. */
async function waitForMaterials(courseId: number, signal?: AbortSignal): Promise<MediaAsset[]> {
  const deadline = Date.now() + MATERIALS_WAIT_MS;
  for (;;) {
    const materials = await mediaApi.materials(courseId, signal);
    if (materials.every(isSettled) || Date.now() > deadline) {
      return materials.filter((asset) => asset.status === "failed" || asset.status === "pending");
    }
    await sleep(MATERIALS_POLL_MS, signal);
  }
}

/** A proposal asked for: the job writing it and what was asked (to ask again for the same). */
export interface ProposalRequest {
  job: Job;
  values: BriefValues;
  feedback: string;
}

interface ProposeOptions {
  /** Files chosen before the course existed: uploaded first. */
  staged?: File[];
  /** What to change from the current proposal (asks for another one). */
  feedback?: string;
  /** Stops the work (e.g. the page was left): the promise then rejects with an AbortError. */
  signal?: AbortSignal;
}

/**
 * Saves the brief, uploads the staged materials, waits until they are read and asks the AI for an
 * outline. `status` narrates each step for the UI; the returned job is the outline being written.
 */
export function useProposeOutline() {
  const queryClient = useQueryClient();
  const unmountSignal = useUnmountSignal();
  const { trackJobs, failed } = useStudioCache();
  const { upload } = useUpload();
  const [status, setStatus] = useState<string | null>(null);

  const propose = useCallback(
    async (courseId: number, values: BriefValues, options: ProposeOptions = {}): Promise<Job> => {
      const { staged = [], feedback = "", signal } = options;
      const stopIfAborted = () => {
        if (signal?.aborted) throw aborted();
      };
      try {
        // Saved even if the page was left meanwhile: the course exists already and resumes with its brief.
        setStatus("Guardando el brief");
        const saved = await coursesApi.update(courseId, {
          language: values.language,
          settings: { brief: values.brief, audience: values.audience, tone: values.tone, minutes: values.minutes },
        });
        queryClient.setQueryData(courseKeys.detail(courseId), saved); // the Brief step reopens with what was sent
        for (let index = 0; index < staged.length; index += 1) {
          stopIfAborted();
          const file = staged[index];
          setStatus(`Subiendo ${file.name} (${index + 1} de ${staged.length})`);
          const asset = await upload(file, { kind: "document", courseId, purpose: "course_material" });
          stopIfAborted(); // leaving the page cancels the upload too: that is not a failure to report
          if (!asset) throw new Error(`No pudimos subir «${file.name}». Revisa tu conexión e inténtalo de nuevo.`);
        }
        stopIfAborted();
        setStatus("Leyendo tus documentos");
        const unusable = await waitForMaterials(courseId, signal);
        stopIfAborted();
        if (unusable.length) {
          toast.warning(`La IA no podrá usar ${unusable.map((asset) => `«${asset.original_filename}»`).join(", ")}.`);
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
        trackJobs(courseId, [job]);
        return job;
      } finally {
        setStatus(null);
      }
    },
    [queryClient, trackJobs, upload],
  );

  /**
   * `propose` from a studio step: it stops when the step unmounts and a failure (not the stop) shows in a toast.
   * What was asked, with the job writing it; null when it failed or the step was left.
   */
  const proposeFromStep = async (
    courseId: number,
    values: BriefValues,
    feedback = "",
  ): Promise<ProposalRequest | null> => {
    const signal = unmountSignal();
    try {
      const job = await propose(courseId, values, { feedback, signal });
      return signal.aborted ? null : { job, values, feedback };
    } catch (error) {
      if (!signal.aborted) failed(courseId)(error);
      return null;
    }
  };

  return { propose, proposeFromStep, status };
}
