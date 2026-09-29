"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as tus from "tus-js-client";
import { ApiError, STATUS_MESSAGES, errorMessage } from "@/lib/api/client";
import { MB, mediaApi, mimeTypeOf } from "@/lib/api/media";
import type { MediaAsset, MediaKind, MediaPurpose, UploadTarget } from "@/lib/api/types";

export type UploadState =
  | { phase: "idle" }
  | { phase: "uploading"; progress: number; loaded: number; total: number }
  | { phase: "finishing" }
  | { phase: "error"; message: string };

type OnProgress = (loaded: number, total: number) => void;

function abortError() {
  return new DOMException("Subida cancelada", "AbortError");
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

/** What the person sees when the transfer to storage fails (never the raw client error, which is English and long). */
function transferFailure(status: number): string {
  if (status === 413) return STATUS_MESSAGES[413];
  if (status === 0) return "Se perdió la conexión durante la subida. Revisa tu conexión e intenta de nuevo.";
  return `La subida falló (código ${status}). Intenta de nuevo.`;
}

/**
 * Listens for `signal` only while a transfer runs: once it settles, a later abort (unmounting, the
 * next upload) must not touch it. Returns the function that stops listening.
 */
function onAbort(signal: AbortSignal, handler: () => void): () => void {
  signal.addEventListener("abort", handler);
  return () => signal.removeEventListener("abort", handler);
}

/** One signed PUT with progress (the API picks it for small files). Rejects with an AbortError when `signal` fires. */
function putWithProgress(target: UploadTarget, file: Blob, onProgress: OnProgress, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const stopListening = onAbort(signal, () => xhr.abort());
    const settle = (error?: Error) => {
      stopListening();
      if (error) reject(error);
      else resolve();
    };
    xhr.open("PUT", target.url);
    Object.entries(target.headers).forEach(([key, value]) => xhr.setRequestHeader(key, value));
    xhr.upload.onprogress = (event) => event.lengthComputable && onProgress(event.loaded, event.total);
    // The object already exists: an earlier try of this same upload got through (signatures never overwrite).
    const alreadyThere = () => xhr.status === 409 || /duplicate|already exists/i.test(xhr.responseText);
    xhr.onload = () =>
      (xhr.status >= 200 && xhr.status < 300) || alreadyThere() ? settle() : settle(new Error(transferFailure(xhr.status)));
    xhr.onerror = () => settle(new Error(transferFailure(0)));
    xhr.onabort = () => settle(abortError());
    xhr.send(file);
  });
}

/** Signatures last 2 hours: renew well before, so the next chunk never goes out with an expired one. */
const SIGNATURE_MAX_AGE_MS = 90 * 60 * 1000;
const MAX_SIGNATURE_RENEWALS = 10;

/** tus-js-client's default: retry network errors, 5xx, 409 and 423; give up on other 4xx. */
function retriable(status: number): boolean {
  const clientError = status >= 400 && status < 500;
  return !clientError || status === 409 || status === 423;
}

/** Supabase Storage answers an expired or invalid signature with 400 (not 403), naming the token in the body. */
function signatureRejected(status: number, body: string): boolean {
  return (status === 400 || status === 401 || status === 403) && /exp|signature|jwt|token/i.test(body);
}

/** Resumable upload in chunks (the API picks it for big files); `renewTarget` gets a new signature before one expires. */
function tusUpload(
  target: UploadTarget,
  file: Blob,
  onProgress: OnProgress,
  signal: AbortSignal,
  renewTarget: () => Promise<UploadTarget>,
) {
  return new Promise<void>((resolve, reject) => {
    let headers = target.headers;
    let signedAt = Date.now();
    let renewals = 0;
    let renewing: Promise<void> | null = null;
    const renew = () => {
      if (!renewing) {
        renewals += 1;
        renewing = renewTarget()
          .then((renewed) => {
            headers = renewed.headers;
            signedAt = Date.now();
          })
          .finally(() => {
            renewing = null;
          });
      }
      return renewing;
    };

    const upload = new tus.Upload(file, {
      endpoint: target.url,
      metadata: target.metadata,
      chunkSize: target.chunk_size ?? 6 * MB,
      retryDelays: [1000, 3000, 5000, 10000, 20000],
      uploadDataDuringCreation: true,
      // Every upload is a new object: resuming "the same file" from an earlier try would write elsewhere.
      storeFingerprintForResuming: false,
      // Awaited before every request: an old signature is renewed first (a failed renewal fails the
      // request, and tus retries it).
      onBeforeRequest: async (request) => {
        if (Date.now() - signedAt > SIGNATURE_MAX_AGE_MS && renewals < MAX_SIGNATURE_RENEWALS) await renew();
        Object.entries(headers).forEach(([key, value]) => request.setHeader(key, value));
      },
      onShouldRetry: (error) => {
        const response = (error as tus.DetailedError).originalResponse;
        const status = response?.getStatus() ?? 0;
        if (signatureRejected(status, response?.getBody() ?? "")) {
          signedAt = 0; // expired sooner than expected (a sleeping laptop, a skewed clock): renew on the retry
          return renewals < MAX_SIGNATURE_RENEWALS;
        }
        return retriable(status);
      },
      onProgress,
      onSuccess: () => {
        stopListening();
        resolve();
      },
      onError: (error) => {
        stopListening();
        reject(new Error(transferFailure((error as tus.DetailedError).originalResponse?.getStatus() ?? 0)));
      },
    });
    const stopListening = onAbort(signal, () => {
      stopListening();
      // Also deletes the partial upload on the server; a failure there only leaves storage to clean up.
      upload.abort(true).catch(() => undefined);
      reject(abortError());
    });
    upload.start();
  });
}

const COMPLETE_RETRY_DELAYS_MS = [1000, 3000, 6000];

function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(abortError());
    const timer = window.setTimeout(() => {
      stopListening();
      resolve();
    }, ms);
    const stopListening = onAbort(signal, () => {
      window.clearTimeout(timer);
      reject(abortError());
    });
  });
}

/**
 * Tells the API the file arrived. The bytes are already in storage, so a dropped connection or a
 * server hiccup here is retried instead of making the person upload (maybe 2 GB) again.
 */
async function completeUpload(
  assetId: string,
  input: { module_id?: number; purpose?: MediaPurpose },
  signal: AbortSignal,
): Promise<MediaAsset> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await mediaApi.complete(assetId, input);
    } catch (error) {
      const status = error instanceof ApiError ? error.status : 0;
      if (status === 409) {
        // "Already received": an earlier try got through and only its answer was lost.
        const asset = await mediaApi.get(assetId).catch(() => null);
        if (asset && asset.status !== "pending") return asset;
      }
      const transient = status === 0 || status === 409 || status >= 500;
      if (!transient || attempt >= COMPLETE_RETRY_DELAYS_MS.length) throw error;
      await wait(COMPLETE_RETRY_DELAYS_MS[attempt], signal);
    }
  }
}

export interface UploadOptions {
  filename?: string;
  kind: MediaKind;
  courseId?: number;
  moduleId?: number;
  purpose?: MediaPurpose;
}

/**
 * Uploads a file straight to storage with progress (resumable for big files), then asks the API
 * to process it. Returns the asset, or null if it was cancelled or failed (a failure stays in
 * `state` until `reset`). Once the asset is returned the hook is idle again.
 */
export function useUpload() {
  const [state, setState] = useState<UploadState>({ phase: "idle" });
  const controller = useRef<AbortController | null>(null);
  const busy = state.phase === "uploading" || state.phase === "finishing";

  useEffect(() => () => controller.current?.abort(), []);

  // Closing or reloading the tab would cancel the upload: let the browser ask first.
  useEffect(() => {
    if (!busy) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);

  const upload = useCallback(async (file: Blob, options: UploadOptions): Promise<MediaAsset | null> => {
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    // Only the latest upload may change the state: one it replaced finishes quietly.
    const update = (next: UploadState) => {
      if (controller.current === abort) setState(next);
    };
    const filename = options.filename ?? (file instanceof File ? file.name : "archivo");
    const mimeType = file instanceof File ? mimeTypeOf(file) : file.type || "application/octet-stream";
    update({ phase: "uploading", progress: 0, loaded: 0, total: file.size });
    const onProgress: OnProgress = (loaded, total) =>
      update({ phase: "uploading", progress: total ? Math.round((loaded / total) * 100) : 0, loaded, total });
    try {
      const start = await mediaApi.createUpload({
        filename,
        mime_type: mimeType,
        size_bytes: file.size,
        kind: options.kind,
        course_id: options.courseId,
      });
      if (abort.signal.aborted) throw abortError(); // cancelled while the upload was being prepared
      if (start.upload.method === "TUS") {
        const renew = async () => (await mediaApi.renewUpload(start.asset.id)).upload;
        await tusUpload(start.upload, file, onProgress, abort.signal, renew);
      } else {
        await putWithProgress(start.upload, file, onProgress, abort.signal);
      }
      update({ phase: "finishing" });
      const asset = await completeUpload(start.asset.id, { module_id: options.moduleId, purpose: options.purpose }, abort.signal);
      update({ phase: "idle" });
      return asset;
    } catch (error) {
      update(isAbort(error) ? { phase: "idle" } : { phase: "error", message: errorMessage(error) });
      return null;
    } finally {
      if (controller.current === abort) controller.current = null;
    }
  }, []);

  const cancel = useCallback(() => controller.current?.abort(), []);
  const reset = useCallback(() => setState({ phase: "idle" }), []);

  return { state, busy, upload, cancel, reset };
}
