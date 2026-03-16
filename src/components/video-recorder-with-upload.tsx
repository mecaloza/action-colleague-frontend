"use client";

import { useState } from "react";
import { VideoRecorder } from "./video-recorder";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://colleague-backend-production.up.railway.app/api/v1";

interface VideoRecorderWithUploadProps {
  moduleId: number;
  onUploadComplete?: (data: { video_id: number; storage_url: string }) => void;
  maxDuration?: number;
  className?: string;
}

type UploadState = "idle" | "uploading" | "success" | "error";

export function VideoRecorderWithUpload({
  moduleId,
  onUploadComplete,
  maxDuration = 1800,
  className = "",
}: VideoRecorderWithUploadProps) {
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadError, setUploadError] = useState<string>("");
  const [uploadedData, setUploadedData] = useState<{
    video_id: number;
    storage_url: string;
  } | null>(null);

  const handleRecordingComplete = async (blob: Blob, duration: number) => {
    // Reset state
    setUploadState("uploading");
    setUploadProgress(0);
    setUploadError("");
    setUploadedData(null);

    try {
      // Prepare FormData
      const formData = new FormData();
      formData.append("file", blob, "recording.webm");
      formData.append("module_id", moduleId.toString());
      formData.append("duration", duration.toString());

      // Create XMLHttpRequest for progress tracking
      const xhr = new XMLHttpRequest();

      // Progress event
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          const percentComplete = (e.loaded / e.total) * 100;
          setUploadProgress(Math.round(percentComplete));
        }
      });

      // Success
      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            setUploadedData(data);
            setUploadState("success");
            setUploadProgress(100);
            onUploadComplete?.(data);
          } catch {
            setUploadError("Error al procesar la respuesta del servidor");
            setUploadState("error");
          }
        } else {
          setUploadError(
            `Error ${xhr.status}: ${xhr.statusText || "Error al subir el video"}`
          );
          setUploadState("error");
        }
      });

      // Error
      xhr.addEventListener("error", () => {
        setUploadError("Error de red al subir el video");
        setUploadState("error");
      });

      // Timeout
      xhr.addEventListener("timeout", () => {
        setUploadError("Tiempo de espera agotado al subir el video");
        setUploadState("error");
      });

      // Get auth token
      const token = localStorage.getItem("ac_token");

      // Configure request
      xhr.open("POST", `${API_BASE}/videos/upload`);
      if (token) {
        xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      }
      xhr.timeout = 300000; // 5 minutes timeout

      // Send request
      xhr.send(formData);
    } catch (error) {
      console.error("Upload error:", error);
      setUploadError(
        error instanceof Error ? error.message : "Error desconocido al subir el video"
      );
      setUploadState("error");
    }
  };

  return (
    <div className={className}>
      {/* Video Recorder */}
      <VideoRecorder
        onRecordingComplete={handleRecordingComplete}
        maxDuration={maxDuration}
      />

      {/* Upload Status */}
      {uploadState !== "idle" && (
        <Card className="mt-4">
          <CardContent className="p-6">
            {uploadState === "uploading" && (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span className="font-medium">Subiendo video...</span>
                  <span className="text-sm text-muted-foreground ml-auto">
                    {uploadProgress}%
                  </span>
                </div>
                <Progress value={uploadProgress} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  Por favor, no cierres esta ventana hasta que se complete la subida.
                </p>
              </div>
            )}

            {uploadState === "success" && (
              <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <AlertDescription className="ml-2">
                  <strong className="text-green-800 dark:text-green-200">
                    ¡Video subido exitosamente!
                  </strong>
                  <div className="text-sm text-green-700 dark:text-green-300 mt-1">
                    Video ID: {uploadedData?.video_id}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {uploadState === "error" && (
              <Alert className="border-red-500 bg-red-50 dark:bg-red-950">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <AlertDescription className="ml-2">
                  <strong className="text-red-800 dark:text-red-200">
                    Error al subir el video
                  </strong>
                  <div className="text-sm text-red-700 dark:text-red-300 mt-1">
                    {uploadError}
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
