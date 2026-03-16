"use client";

import { useState } from "react";
import { VideoRecorder } from "./video-recorder";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Play } from "lucide-react";

/**
 * Demo component showing how to use VideoRecorder
 * 
 * Usage example for integration:
 * 
 * ```tsx
 * import { VideoRecorder } from "@/components/video-recorder";
 * 
 * function MyPage() {
 *   const handleRecordingComplete = async (blob: Blob, duration: number) => {
 *     // Option 1: Upload to backend
 *     const formData = new FormData();
 *     formData.append('video', blob, 'recording.webm');
 *     formData.append('duration', duration.toString());
 *     
 *     await fetch('/api/videos/upload', {
 *       method: 'POST',
 *       body: formData,
 *     });
 *     
 *     // Option 2: Store locally for later processing
 *     localStorage.setItem('pending-video', URL.createObjectURL(blob));
 *   };
 *   
 *   return (
 *     <VideoRecorder 
 *       onRecordingComplete={handleRecordingComplete}
 *       maxDuration={600} // 10 minutes
 *     />
 *   );
 * }
 * ```
 */
export function VideoRecorderDemo() {
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedDuration, setRecordedDuration] = useState<number>(0);
  const [videoUrl, setVideoUrl] = useState<string>("");

  const handleRecordingComplete = (blob: Blob, duration: number) => {
    console.log("Recording completed!", {
      size: `${(blob.size / 1024 / 1024).toFixed(2)} MB`,
      duration: `${duration}s`,
      type: blob.type,
    });

    setRecordedBlob(blob);
    setRecordedDuration(duration);
    
    // Create URL for preview
    const url = URL.createObjectURL(blob);
    setVideoUrl(url);
  };

  const downloadRecording = () => {
    if (!recordedBlob) return;

    const url = URL.createObjectURL(recordedBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `recording-${Date.now()}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="container mx-auto py-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Video Recorder Demo</h1>
        <p className="text-muted-foreground">
          Graba videos directamente desde tu navegador usando MediaRecorder API
        </p>
      </div>

      <div className="grid gap-6">
        {/* Recorder */}
        <VideoRecorder 
          onRecordingComplete={handleRecordingComplete}
          maxDuration={1800} // 30 minutes
        />

        {/* Recorded Video Preview */}
        {recordedBlob && (
          <Card>
            <CardHeader>
              <CardTitle>Grabación Completada</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Stats */}
              <div className="flex gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Duración:</span>{" "}
                  <span className="font-mono font-semibold">
                    {formatDuration(recordedDuration)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Tamaño:</span>{" "}
                  <span className="font-mono font-semibold">
                    {(recordedBlob.size / 1024 / 1024).toFixed(2)} MB
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Formato:</span>{" "}
                  <span className="font-mono font-semibold">
                    {recordedBlob.type}
                  </span>
                </div>
              </div>

              {/* Preview Player */}
              <div className="rounded-lg overflow-hidden bg-black aspect-video">
                <video 
                  src={videoUrl} 
                  controls 
                  className="w-full h-full"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button onClick={downloadRecording} className="gap-2">
                  <Download className="h-4 w-4" />
                  Descargar Video
                </Button>
                <Button variant="outline" className="gap-2">
                  <Play className="h-4 w-4" />
                  Usar en Curso
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
