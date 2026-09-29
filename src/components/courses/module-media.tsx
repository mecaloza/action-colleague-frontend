"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileText, Loader2, RefreshCw, Trash2, Video, type LucideIcon } from "lucide-react";
import { useConfirm } from "@/components/layout/confirm-dialog";
import { Dropzone } from "@/components/media/dropzone";
import { PendingAsset } from "@/components/media/pending-asset";
import { StatusPanel } from "@/components/media/status-panel";
import { UploadProgress } from "@/components/media/upload-progress";
import { RecordingDialog } from "@/components/recording/recording-dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { UPLOAD_RULES, mediaApi, mediaKeys } from "@/lib/api/media";
import type { ModuleAdmin } from "@/lib/api/types";
import { formatDuration } from "@/lib/format";
import { useCourseCache } from "@/lib/hooks/use-course-cache";
import { useUpload } from "@/lib/hooks/use-upload";
import { toastError } from "@/lib/notify";
import { safeHttpUrl } from "@/lib/safe-url";
import { ModuleVideo } from "./module-video";

const PROCESSING = new Set(["queued", "generating"]);

function SectionTitle({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <h3 className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-label text-ink-700">
      <Icon className="h-4 w-4 text-accent" /> {children}
    </h3>
  );
}

function RemoveButton({ loading, onClick }: { loading: boolean; onClick: () => void }) {
  return (
    <Button type="button" variant="ghost" size="sm" className="text-destructive hover:bg-red-50" loading={loading} onClick={onClick}>
      <Trash2 /> Quitar
    </Button>
  );
}

/** Live step of the module's processing job ("Optimizando el video… 45%"). */
function ProcessingStatus({ moduleId }: { moduleId: number }) {
  const params = { module_id: moduleId, active: true };
  const jobs = useQuery({ queryKey: mediaKeys.jobs(params), queryFn: () => mediaApi.jobs(params), refetchInterval: 2000 });
  const job = jobs.data?.[0];
  return (
    <StatusPanel>
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Loader2 className="h-4 w-4 animate-spin text-accent" />
        {job?.step || "En cola para procesar"}
      </p>
      <Progress value={job?.progress} indeterminate={!job?.progress} />
      <p className="text-xs text-muted-foreground">Puedes cerrar este panel; el procesamiento continúa.</p>
    </StatusPanel>
  );
}

interface SectionProps {
  module: ModuleAdmin;
  /** Whether an upload is running here (closing the panel would cancel it). */
  onBusyChange: (busy: boolean) => void;
}

/** The module's video: play it, replace or remove it, or upload or record one. */
function VideoSection({ module, startRecording, onBusyChange }: SectionProps & { startRecording: boolean }) {
  const { refreshCourse } = useCourseCache();
  const confirm = useConfirm();
  const { state, busy, upload, cancel, reset } = useUpload();
  useEffect(() => onBusyChange(busy), [busy, onBusyChange]);
  const [recording, setRecording] = useState(startRecording);
  const [replacing, setReplacing] = useState(false);

  // Runs once a video has reached the API, from the file picker or from the recording studio.
  const afterUpload = () => {
    setReplacing(false);
    refreshCourse(module.course_id);
  };

  const uploadVideo = async (file: File) => {
    const asset = await upload(file, { kind: "video", courseId: module.course_id, moduleId: module.id, purpose: "module_video" });
    if (asset) afterUpload();
  };

  const remove = useMutation({
    mutationFn: () => mediaApi.removeModuleVideo(module.id),
    onSuccess: () => {
      toast.success("Video quitado del módulo");
      refreshCourse(module.course_id);
    },
    onError: toastError,
  });

  const confirmRemove = async () => {
    const confirmed = await confirm({
      title: "¿Quitar el video del módulo?",
      description: "El archivo se borrará.",
      confirmLabel: "Quitar video",
      destructive: true,
    });
    if (confirmed) remove.mutate();
  };

  const processing = PROCESSING.has(module.generation_status);
  const hasVideo = Boolean(module.video);
  const showPlayer = !processing && hasVideo && !replacing;
  const showPicker = !processing && !busy && (!hasVideo || replacing);

  return (
    <section>
      <SectionTitle icon={Video}>Video</SectionTitle>
      {processing && <ProcessingStatus moduleId={module.id} />}
      {showPlayer && (
        <div className="space-y-3">
          <ModuleVideo module={module} />
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-auto text-xs text-muted-foreground">
              {module.duration_seconds ? `Duración ${formatDuration(module.duration_seconds)}` : null}
            </span>
            <Button type="button" variant="outline" size="sm" onClick={() => setReplacing(true)}>
              <RefreshCw /> Reemplazar
            </Button>
            <RemoveButton loading={remove.isPending} onClick={confirmRemove} />
          </div>
        </div>
      )}
      {module.generation_status === "failed" && module.generation_error && (
        <p role="alert" className="mb-3 border-l-2 border-destructive bg-red-50 px-3 py-2 text-sm">
          {module.generation_error}
        </p>
      )}
      {showPicker && (
        <div className="space-y-3">
          <Dropzone rule={UPLOAD_RULES.video} label="Arrastra tu video o haz clic para elegirlo" onFile={uploadVideo} />
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs text-muted-foreground">¿No tienes el video?</span>
            <Button type="button" variant="outline" size="sm" onClick={() => setRecording(true)}>
              <Video /> Grabarme ahora
            </Button>
            {replacing && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setReplacing(false)}>
                Cancelar
              </Button>
            )}
          </div>
        </div>
      )}
      <div className="mt-3">
        <UploadProgress state={state} onCancel={cancel} onRetry={reset} />
      </div>
      <RecordingDialog
        open={recording}
        onOpenChange={setRecording}
        courseId={module.course_id}
        moduleId={module.id}
        moduleTitle={module.title}
        onUploaded={afterUpload}
      />
    </section>
  );
}

/** The module's attached document (PDF, Word, PowerPoint or text). */
function DocumentSection({ module, onBusyChange }: SectionProps) {
  const { refreshCourse } = useCourseCache();
  const confirm = useConfirm();
  const { state, busy, upload, cancel, reset } = useUpload();
  useEffect(() => onBusyChange(busy), [busy, onBusyChange]);
  const [pendingAssetId, setPendingAssetId] = useState<string | null>(null);

  const uploadDocument = async (file: File) => {
    const asset = await upload(file, { kind: "document", courseId: module.course_id, moduleId: module.id, purpose: "module_document" });
    if (asset) setPendingAssetId(asset.id);
  };

  const remove = useMutation({
    mutationFn: () => mediaApi.removeModuleDocument(module.id),
    onSuccess: () => {
      toast.success("Documento quitado del módulo");
      refreshCourse(module.course_id);
    },
    onError: toastError,
  });

  const confirmRemove = async () => {
    const confirmed = await confirm({
      title: "¿Quitar el documento del módulo?",
      description: "El archivo se borrará.",
      confirmLabel: "Quitar documento",
      destructive: true,
    });
    if (confirmed) remove.mutate();
  };
  const documentUrl = safeHttpUrl(module.document?.url);

  return (
    <section>
      <SectionTitle icon={FileText}>Documento</SectionTitle>
      {pendingAssetId ? (
        <PendingAsset
          assetId={pendingAssetId}
          label="Leyendo el documento…"
          onReady={() => {
            setPendingAssetId(null);
            refreshCourse(module.course_id);
          }}
          onDismiss={() => setPendingAssetId(null)}
        />
      ) : module.document ? (
        <div className="flex flex-wrap items-center gap-2 border border-border bg-white p-4">
          <FileText className="h-5 w-5 text-accent" />
          {documentUrl && (
            <a href={documentUrl} target="_blank" rel="noreferrer" className="mr-auto text-sm font-semibold hover:text-accent">
              Ver documento
            </a>
          )}
          <RemoveButton loading={remove.isPending} onClick={confirmRemove} />
        </div>
      ) : (
        !busy && <Dropzone rule={UPLOAD_RULES.document} label="Adjunta un documento para leer o descargar" onFile={uploadDocument} />
      )}
      <div className="mt-3">
        <UploadProgress state={state} onCancel={cancel} onRetry={reset} />
      </div>
    </section>
  );
}

interface ModuleMediaProps {
  module: ModuleAdmin;
  /** Open the recording studio right away (the module was just created to record it). */
  startRecording?: boolean;
  /** Whether a video or document upload is running (closing the panel would cancel it). */
  onUploadingChange?: (uploading: boolean) => void;
}

/** Video and document of a module: upload, record, replace or remove. */
export function ModuleMedia({ module, startRecording = false, onUploadingChange }: ModuleMediaProps) {
  const [videoBusy, setVideoBusy] = useState(false);
  const [documentBusy, setDocumentBusy] = useState(false);
  const uploading = videoBusy || documentBusy;
  useEffect(() => onUploadingChange?.(uploading), [uploading, onUploadingChange]);
  return (
    <div className="space-y-8">
      <VideoSection module={module} startRecording={startRecording} onBusyChange={setVideoBusy} />
      <DocumentSection module={module} onBusyChange={setDocumentBusy} />
    </div>
  );
}
