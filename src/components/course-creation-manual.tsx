"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Video,
  FileImage,
  CheckCircle2,
  Loader2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";
import { VideoRecorderWithUpload } from "./video-recorder-with-upload";
import { SlideEditor } from "./slide-editor";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://colleague-backend-production.up.railway.app/api/v1";

interface CourseCreationManualProps {
  moduleId?: number; // Optional: si no se provee, creamos el curso completo
  onComplete?: (courseId: number) => void;
  className?: string;
}

type WizardStep = 1 | 2 | 3;
type ProcessingState = "idle" | "uploading" | "composing" | "success" | "error";

export function CourseCreationManual({
  moduleId,
  onComplete,
  className = "",
}: CourseCreationManualProps) {
  // Wizard state
  const [step, setStep] = useState<WizardStep>(1);
  const [canProceed, setCanProceed] = useState(false);

  // Course metadata (when creating full course)
  const [courseTitle, setCourseTitle] = useState("");
  const [courseDescription, setCourseDescription] = useState("");
  const [moduleTitle, setModuleTitle] = useState("");

  // Step 1: Video Recording
  const [videoData, setVideoData] = useState<{
    video_id: number;
    storage_url: string;
  } | null>(null);

  // Step 2: Slide Creation
  const [slideBlobs, setSlideBlobs] = useState<Blob[]>([]);

  // Step 3: Processing
  const [processingState, setProcessingState] =
    useState<ProcessingState>("idle");
  const [processingError, setProcessingError] = useState<string>("");
  const [finalVideoId, setFinalVideoId] = useState<number | null>(null);
  const [createdCourseId, setCreatedCourseId] = useState<number | null>(null);

  // ─── Handlers ────────────────────────────────────────────────────────────

  const handleVideoUploadComplete = (data: {
    video_id: number;
    storage_url: string;
  }) => {
    console.log("Video uploaded:", data);
    setVideoData(data);
    setCanProceed(true);
  };

  const handleSlidesComplete = (slideImages: Blob[]) => {
    console.log("Slides generated:", slideImages.length);
    setSlideBlobs(slideImages);
    setCanProceed(true);
  };

  const goToNextStep = () => {
    if (step < 3) {
      setStep((step + 1) as WizardStep);
      setCanProceed(false);
    }
  };

  const goToPreviousStep = () => {
    if (step > 1) {
      setStep((step - 1) as WizardStep);
      setCanProceed(true); // Previous steps already completed
    }
  };

  // ─── Video Composition & Course Creation ─────────────────────────────────

  const composeVideo = async () => {
    if (!videoData) {
      setProcessingError("No hay video grabado");
      return;
    }

    setProcessingState("composing");
    setProcessingError("");

    try {
      // Upload slides
      const formData = new FormData();
      formData.append("video_id", String(videoData.video_id));
      slideBlobs.forEach((blob, index) => {
        formData.append("slides", blob, `slide-${index + 1}.png`);
      });

      // Get auth token
      const token = localStorage.getItem("ac_token");

      // Call compose endpoint
      const response = await fetch(
        `${API_BASE}/videos/compose`,
        {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        }
      );

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(
          `Error ${response.status}: ${errorText || response.statusText}`
        );
      }

      const result = await response.json();
      console.log("Video composed:", result);

      const composedVideoUrl = result.video_url || result.storage_url;
      setFinalVideoId(result.video_id || videoData.video_id);

      // Si moduleId no está definido, crear curso completo
      if (!moduleId) {
        await createFullCourse(composedVideoUrl);
      } else {
        setProcessingState("success");
        onComplete?.(result.video_id || videoData.video_id);
      }
    } catch (error) {
      console.error("Composition error:", error);
      setProcessingError(
        error instanceof Error
          ? error.message
          : "Error desconocido al componer el video"
      );
      setProcessingState("error");
    }
  };

  const createFullCourse = async (videoUrl: string) => {
    try {
      const token = localStorage.getItem("ac_token");
      
      const coursePayload = {
        title: courseTitle || "Nuevo Curso",
        description: courseDescription || "Curso creado manualmente",
        modules: [
          {
            title: moduleTitle || "Módulo 1",
            order: 1,
            video_url: videoUrl,
          },
        ],
      };

      const courseResponse = await fetch(`${API_BASE}/courses`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(coursePayload),
      });

      if (!courseResponse.ok) {
        throw new Error("Error creando el curso");
      }

      const courseData = await courseResponse.json();
      console.log("Course created:", courseData);
      
      setCreatedCourseId(courseData.id);
      setProcessingState("success");
      onComplete?.(courseData.id);
    } catch (error) {
      console.error("Course creation error:", error);
      setProcessingError(
        error instanceof Error
          ? error.message
          : "Error creando el curso"
      );
      setProcessingState("error");
    }
  };

  // Auto-trigger composition when entering step 3
  const handleStep3Enter = () => {
    if (processingState === "idle" && videoData) {
      composeVideo();
    }
  };

  // ─── Render Steps ────────────────────────────────────────────────────────

  const renderStepIndicator = () => {
    const steps = [
      { num: 1, label: "Grabar Video", icon: Video },
      { num: 2, label: "Crear Slides", icon: FileImage },
      { num: 3, label: "Procesar", icon: CheckCircle2 },
    ];

    return (
      <div className="flex items-center justify-center gap-4 mb-8">
        {steps.map((s, index) => {
          const Icon = s.icon;
          const isActive = step === s.num;
          const isComplete = step > s.num;

          return (
            <div key={s.num} className="flex items-center gap-4">
              <div className="flex flex-col items-center gap-2">
                <div
                  className={`flex items-center justify-center w-12 h-12 rounded-full border-2 transition-all ${
                    isComplete
                      ? "bg-green-500 border-green-500 text-white"
                      : isActive
                        ? "bg-primary border-primary text-white"
                        : "bg-background border-border text-muted-foreground"
                  }`}
                >
                  {isComplete ? (
                    <CheckCircle2 className="h-6 w-6" />
                  ) : (
                    <Icon className="h-6 w-6" />
                  )}
                </div>
                <span
                  className={`text-sm font-medium ${
                    isActive ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {s.label}
                </span>
              </div>
              {index < steps.length - 1 && (
                <ArrowRight
                  className={`h-5 w-5 ${
                    isComplete ? "text-green-500" : "text-muted-foreground"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderStep1 = () => (
    <div className="space-y-6">
      {/* Course metadata (only when creating full course) */}
      {!moduleId && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Información del Curso</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Título del Curso</Label>
              <Input
                type="text"
                value={courseTitle}
                onChange={(e) => setCourseTitle(e.target.value)}
                placeholder="Ej: Seguridad Industrial Básica"
              />
            </div>
            <div className="space-y-2">
              <Label>Descripción</Label>
              <textarea
                value={courseDescription}
                onChange={(e) => setCourseDescription(e.target.value)}
                placeholder="Breve descripción del curso"
                rows={2}
                className="flex w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm resize-none outline-none focus:ring-2 focus:ring-violet-500/50"
              />
            </div>
            <div className="space-y-2">
              <Label>Título del Módulo</Label>
              <Input
                type="text"
                value={moduleTitle}
                onChange={(e) => setModuleTitle(e.target.value)}
                placeholder="Ej: Introducción y EPP"
              />
            </div>
          </CardContent>
        </Card>
      )}

      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Paso 1: Grabar Video</h2>
        <p className="text-muted-foreground">
          Graba el video de tu curso. Se subirá automáticamente cuando termines.
        </p>
      </div>

      <VideoRecorderWithUpload
        moduleId={moduleId || 0}
        onUploadComplete={handleVideoUploadComplete}
      />

      {videoData && (
        <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          <AlertDescription className="ml-2">
            <strong className="text-green-800 dark:text-green-200">
              Video grabado y subido exitosamente
            </strong>
            <div className="text-sm text-green-700 dark:text-green-300 mt-1">
              ID: {videoData.video_id}
            </div>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Paso 2: Crear Slides</h2>
        <p className="text-muted-foreground">
          Diseña las slides de tu presentación. Se exportarán como imágenes PNG.
        </p>
      </div>

      <SlideEditor onSlidesComplete={handleSlidesComplete} />

      {slideBlobs.length > 0 && (
        <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          <AlertDescription className="ml-2">
            <strong className="text-green-800 dark:text-green-200">
              {slideBlobs.length} slides generadas exitosamente
            </strong>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );

  const renderStep3 = () => {
    // Auto-trigger composition on mount
    if (processingState === "idle") {
      setTimeout(handleStep3Enter, 100);
    }

    return (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Paso 3: Procesando</h2>
          <p className="text-muted-foreground">
            Estamos componiendo tu video final con las slides.
          </p>
        </div>

        <Card>
          <CardContent className="p-12">
            {processingState === "composing" && (
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-16 w-16 animate-spin text-primary" />
                <div className="text-center">
                  <p className="text-lg font-semibold mb-2">
                    Componiendo video...
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Esto puede tomar unos minutos. Por favor, espera.
                  </p>
                </div>
                <Progress value={undefined} className="w-full max-w-md" />
              </div>
            )}

            {processingState === "success" && (
              <div className="flex flex-col items-center gap-4">
                <div className="rounded-full bg-green-100 dark:bg-green-900/20 p-6">
                  <CheckCircle2 className="h-16 w-16 text-green-600" />
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600 mb-2">
                    ¡{!moduleId ? "Curso" : "Video"} creado exitosamente!
                  </p>
                  {createdCourseId && (
                    <p className="text-sm text-muted-foreground mb-4">
                      Curso ID: {createdCourseId}
                    </p>
                  )}
                  {!createdCourseId && (
                    <p className="text-sm text-muted-foreground mb-4">
                      Video ID: {finalVideoId}
                    </p>
                  )}
                  <Badge variant="outline" className="text-sm">
                    Video: {videoData?.video_id} | Slides: {slideBlobs.length}
                  </Badge>
                </div>
              </div>
            )}

            {processingState === "error" && (
              <div className="flex flex-col items-center gap-4">
                <div className="rounded-full bg-red-100 dark:bg-red-900/20 p-6">
                  <AlertCircle className="h-16 w-16 text-red-600" />
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-600 mb-2">
                    Error al procesar
                  </p>
                  <p className="text-sm text-red-700 dark:text-red-300 mb-4">
                    {processingError}
                  </p>
                  <Button onClick={composeVideo} variant="outline">
                    Reintentar
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  // ─── Main Render ─────────────────────────────────────────────────────────

  return (
    <div className={`max-w-5xl mx-auto ${className}`}>
      <Card>
        <CardHeader>
          <CardTitle className="text-center">
            Creación Manual de Curso
          </CardTitle>
        </CardHeader>
        <CardContent className="p-8">
          {/* Step Indicator */}
          {renderStepIndicator()}

          {/* Step Content */}
          <div className="min-h-[500px]">
            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
            {step === 3 && renderStep3()}
          </div>

          {/* Navigation */}
          {step < 3 && (
            <div className="flex items-center justify-between mt-8 pt-6 border-t">
              <Button
                onClick={goToPreviousStep}
                disabled={step === 1}
                variant="outline"
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Anterior
              </Button>

              <Button
                onClick={goToNextStep}
                disabled={!canProceed}
                className="gap-2"
              >
                Siguiente
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
