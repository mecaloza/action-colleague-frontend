"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as tus from "tus-js-client";
import { errorMessage } from "@/lib/api/client";
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

/** One signed PUT with progress (the API picks it for small files). Rejects with an AbortError when `signal` fires. */
function putWithProgress(target: UploadTarget, file: Blob, onProgress: OnProgress, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", target.url);
    Object.entries(target.headers).forEach(([key, value]) => xhr.setRequestHeader(key, value));
    xhr.upload.onprogress = (event) => event.lengthComputable && onProgress(event.loaded, event.total);
    // The object already exists: an earlier try of this same upload got through (signatures never overwrite).
    const alreadyThere = () => xhr.status === 409 || /duplicate|already exists/i.test(xhr.responseText);
    xhr.onload = () =>
      (xhr.status >= 200 && xhr.status < 300) || alreadyThere()
        ? resolve()
        : reject(new Error(`La subida falló (código ${xhr.status}).`));
    xhr.onerror = () => reject(new Error("Se perdió la conexión durante la subida."));
    xhr.onabort = () => reject(abortError());
    signal.addEventListener("abort", () => xhr.abort());
    xhr.send(file);
  });
}

const MAX_SIGNATURE_RENEWALS = 5;

/** tus-js-client's default: retry network errors, 5xx, 409 and 423; give up on other 4xx. */
function retriable(status: number): boolean {
  const clientError = status >= 400 && status < 500;
  return !clientError || status === 409 || status === 423;
}

/** Resumable upload in chunks (the API picks it for big files); `renewTarget` gets a new signature when one expires. */
function tusUpload(
  target: UploadTarget,
  file: Blob,
  onProgress: OnProgress,
  signal: AbortSignal,
  renewTarget: () => Promise<UploadTarget>,
) {
  return new Promise<void>((resolve, reject) => {
    let headers = target.headers;
    let renewals = 0;
    const upload = new tus.Upload(file, {
      endpoint: target.url,
      metadata: target.metadata,
      chunkSize: target.chunk_size ?? 6 * MB,
      retryDelays: [1000, 3000, 5000, 10000, 20000],
      uploadDataDuringCreation: true,
      // Every upload is a new object: resuming "the same file" from an earlier try would write elsewhere.
      storeFingerprintForResuming: false,
      // Read on every request, so a renewed signature applies from the next chunk on.
      onBeforeRequest: (request) => Object.entries(headers).forEach(([key, value]) => request.setHeader(key, value)),
      onShouldRetry: (error) => {
        const status = (error as tus.DetailedError).originalResponse?.getStatus() ?? 0;
        if (status === 403 && renewals < MAX_SIGNATURE_RENEWALS) {
          // Signatures last 2 hours: a long upload asks for a new one and carries on where it was.
          renewals += 1;
          renewTarget()
            .then((renewed) => {
              headers = renewed.headers;
            })
            .catch(() => undefined); // the next retries fail with the old one and end in onError
          return true;
        }
        return retriable(status);
      },
      onProgress,
      onSuccess: () => resolve(),
      onError: (error) => reject(new Error(`La subida se interrumpió: ${error.message}`)),
    });
    signal.addEventListener("abort", () => {
      void upload.abort(true);
      reject(abortError());
    });
    upload.start();
  });
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

  const upload = useCallback(async (file: Blob, options: UploadOptions): Promise<MediaAsset | null> => {
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    const filename = options.filename ?? (file instanceof File ? file.name : "archivo");
    const mimeType = file instanceof File ? mimeTypeOf(file) : file.type || "application/octet-stream";
    setState({ phase: "uploading", progress: 0, loaded: 0, total: file.size });
    const onProgress: OnProgress = (loaded, total) =>
      setState({ phase: "uploading", progress: total ? Math.round((loaded / total) * 100) : 0, loaded, total });
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
      setState({ phase: "finishing" });
      const asset = await mediaApi.complete(start.asset.id, { module_id: options.moduleId, purpose: options.purpose });
      setState({ phase: "idle" });
      return asset;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setState({ phase: "idle" });
        return null;
      }
      setState({ phase: "error", message: errorMessage(error) });
      return null;
    }
  }, []);

  const cancel = useCallback(() => controller.current?.abort(), []);
  const reset = useCallback(() => setState({ phase: "idle" }), []);

  return { state, busy, upload, cancel, reset };
}
