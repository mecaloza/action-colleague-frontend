import { http } from "./client";
import type { CourseDetail, Job, MediaAsset, MediaKind, MediaPurpose, ModuleAdmin, TimelinePoint, UploadTarget } from "./types";

export interface RecordingCompose {
  recording_asset_id: string;
  deck_asset_id?: string;
  /** Slide changes: the page index shown from each second on (the server takes up to 2000). */
  timeline: TimelinePoint[];
}

export interface UploadRequest {
  filename: string;
  mime_type: string;
  size_bytes: number;
  kind: MediaKind;
  course_id?: number;
}

export const mediaApi = {
  createUpload: (input: UploadRequest) => http.post<{ asset: MediaAsset; upload: UploadTarget }>("/media/uploads", input),
  /** A fresh signature for an upload still in progress (they expire after 2 hours). */
  renewUpload: (assetId: string) =>
    http.post<{ asset: MediaAsset; upload: UploadTarget }>(`/media/${assetId}/upload-target`),
  complete: (assetId: string, input: { module_id?: number; purpose?: MediaPurpose }) =>
    http.post<MediaAsset>(`/media/${assetId}/complete`, input),
  get: (assetId: string) => http.get<MediaAsset>(`/media/${assetId}`),
  removeModuleVideo: (moduleId: number) => http.delete<ModuleAdmin>(`/modules/${moduleId}/video`),
  removeModuleDocument: (moduleId: number) => http.delete<ModuleAdmin>(`/modules/${moduleId}/document`),
  setCover: (courseId: number, assetId: string) => http.put<CourseDetail>(`/courses/${courseId}/cover`, { asset_id: assetId }),
  materials: (courseId: number, signal?: AbortSignal) =>
    http.get<MediaAsset[]>(`/courses/${courseId}/materials`, undefined, signal),
  jobs: (params: { course_id?: number; module_id?: number; active?: boolean }) => http.get<Job[]>("/jobs", { ...params }),
  /** A camera recording becomes the module's video, combined with the slides at the recorded times. */
  composeRecording: (moduleId: number, input: RecordingCompose, signal?: AbortSignal) =>
    http.post<Job>(`/modules/${moduleId}/recording`, input, signal),
};

export const mediaKeys = {
  asset: (id: string) => ["media", id] as const,
  jobs: (params: object) => ["jobs", params] as const,
};

export const MB = 1024 * 1024;

/** What one kind of upload may contain (mirrors the API limits, to fail fast in the browser). */
export interface UploadRule {
  accept: string;
  maxBytes: number;
  /** The same limits in words, shown in the drop area. */
  hint: string;
}

export const UPLOAD_RULES: Record<"video" | "document" | "deck" | "image", UploadRule> = {
  video: { accept: "video/*", maxBytes: 2048 * MB, hint: "MP4, MOV o WEBM de hasta 2 GB" },
  document: {
    accept: ".pdf,.docx,.pptx,.txt,.md,application/pdf",
    maxBytes: 100 * MB,
    hint: "PDF, Word, PowerPoint o texto de hasta 100 MB",
  },
  deck: { accept: "application/pdf,.pdf", maxBytes: 100 * MB, hint: "Presentación en PDF de hasta 100 MB" },
  image: { accept: "image/png,image/jpeg,image/webp", maxBytes: 15 * MB, hint: "PNG, JPG o WEBP de hasta 15 MB" },
};

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain",
  md: "text/markdown",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
};

/** Browsers leave `type` empty for some files (e.g. .md, .pptx on some systems). */
export function mimeTypeOf(file: File): string {
  if (file.type) return file.type;
  const extension = file.name.split(".").pop()?.toLowerCase();
  return (extension && MIME_BY_EXTENSION[extension]) || "application/octet-stream";
}
