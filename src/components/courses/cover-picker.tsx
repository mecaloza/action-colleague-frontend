"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Dropzone } from "@/components/media/dropzone";
import { PendingAsset } from "@/components/media/pending-asset";
import { UploadProgress } from "@/components/media/upload-progress";
import { UPLOAD_RULES } from "@/lib/api/media";
import type { CourseDetail } from "@/lib/api/types";
import { useCourseCache } from "@/lib/hooks/use-course-cache";
import { useStableUrl } from "@/lib/hooks/use-stable-url";
import { useUpload } from "@/lib/hooks/use-upload";
import { CoverArt } from "./course-card";

/** Course cover: shows the current one (or the generated art) and uploads a new image. */
export function CoverPicker({ course }: { course: CourseDetail }) {
  const { refreshLibrary } = useCourseCache();
  const { state, busy, upload, cancel, reset } = useUpload();
  const [pendingAssetId, setPendingAssetId] = useState<string | null>(null);
  // Re-signed on every refetch (the editor polls while modules process): keep the image loaded.
  const cover = useStableUrl(course.cover_url);

  const uploadCover = async (file: File) => {
    const asset = await upload(file, { kind: "image", courseId: course.id, purpose: "course_cover" });
    if (asset) setPendingAssetId(asset.id);
  };

  return (
    <div className="grid gap-4 sm:grid-cols-[240px_1fr]">
      <div className="aspect-[16/9] overflow-hidden border border-border">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="Portada actual" className="h-full w-full object-cover" />
        ) : (
          <CoverArt title={course.title} seed={course.id} />
        )}
      </div>
      <div className="space-y-3">
        {pendingAssetId ? (
          <PendingAsset
            assetId={pendingAssetId}
            label="Preparando la portada…"
            onReady={() => {
              setPendingAssetId(null);
              refreshLibrary(); // the cover shows in the library cards as well as in this course
              toast.success("Portada actualizada");
            }}
            onDismiss={() => setPendingAssetId(null)}
          />
        ) : (
          !busy && (
            <Dropzone
              rule={UPLOAD_RULES.image}
              label="Sube una imagen de portada"
              hint={`${UPLOAD_RULES.image.hint}. Ideal 1600 × 900.`}
              onFile={uploadCover}
              className="py-6"
            />
          )
        )}
        <UploadProgress state={state} onCancel={cancel} onRetry={reset} />
      </div>
    </div>
  );
}
