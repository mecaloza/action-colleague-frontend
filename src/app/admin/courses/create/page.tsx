/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  FileText,
  Image as ImageIcon,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Check,
  X,
  Mic,
  Play,
  Square,
  Video,
  PenTool,
  Bot,
  Clock,
  BookOpen,
  HelpCircle,
  Volume2,
  Trash2,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://colleague-backend-production.up.railway.app/api/v1";

function getToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("ac_token") || "";
}

// Step indicators
const STEPS = [
  { label: "Materiales", icon: Upload, desc: "Sube archivos y describe el curso" },
  { label: "Estructura", icon: BookOpen, desc: "Revisa el breakdown propuesto" },
  { label: "Scripts", icon: PenTool, desc: "Genera o escribe los guiones" },
  { label: "Avatar y Voz", icon: Mic, desc: "Elige avatar, voz y estilo de video" },
  { label: "Generar", icon: Video, desc: "Genera curso con videos multi-escena" },
];

// Popular HeyGen avatars for selection
const AVATAR_OPTIONS = [
  { id: "Daisy-inskirt-20220818", name: "Daisy", desc: "Profesional femenina", preview: "👩‍💼" },
  { id: "josh_lite3_20230714", name: "Josh", desc: "Presentador masculino", preview: "👨‍💼" },
  { id: "Anna_public_3_20240108", name: "Anna", desc: "Instructora casual", preview: "👩‍🏫" },
  { id: "Tyler-incasualsuit-20220721", name: "Tyler", desc: "Empresarial masculino", preview: "🧑‍💻" },
];

interface ModuleProposal {
  title: string;
  description: string;
  duration_minutes: number;
  content_points: string[];
  has_evaluation: boolean;
  evaluation_questions: number;
}

interface CourseBreakdown {
  title: string;
  description: string;
  target_audience: string;
  total_duration_minutes: number;
  modules: ModuleProposal[];
}

interface ModuleScript {
  module_index: number;
  title: string;
  script: string;
  duration_estimate_seconds: number;
  evaluation: any;
}

interface VoiceOption {
  id: string;
  name: string;
  language: string;
  gender: string;
  preview_url: string;
  provider: string;
}

export default function CreateCoursePage() {
  const t = useTranslations("adminCourseCreate");
  const router = useRouter();
  const [step, setStep] = useState(0);

  // Step 1: Materials
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 2: Breakdown
  const [sessionId, setSessionId] = useState("");
  const [breakdown, setBreakdown] = useState<CourseBreakdown | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  // Step 3: Scripts
  const [scriptMode, setScriptMode] = useState<"ai" | "manual">("ai");
  const [scripts, setScripts] = useState<ModuleScript[]>([]);
  const [generatingScripts, setGeneratingScripts] = useState(false);
  const [tone, setTone] = useState("professional");

  // Step 4: Avatar + Voice
  const [selectedAvatar, setSelectedAvatar] = useState("Daisy-inskirt-20220818");
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [selectedVoice, setSelectedVoice] = useState("");
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [cloning, setCloning] = useState(false);
  const [cloneFile, setCloneFile] = useState<File | null>(null);
  const [cloneName, setCloneName] = useState("");
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Step 5: Generate
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<any>(null);

  // ── Step 1: Analyze ────────────────────────────────────────────────
  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      const formData = new FormData();
      formData.append("description", description);
      for (const f of files) {
        formData.append("files", f);
      }
      const res = await fetch(`${API_BASE}/courses/ai/analyze`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
        body: formData,
      });
      if (!res.ok) throw new Error(t("errors.analysisFailed"));
      const data = await res.json();
      setSessionId(data.session_id);
      setBreakdown(data.breakdown);
      setStep(1);
    } catch {
      alert(t("errors.analysisRetry"));
    } finally {
      setAnalyzing(false);
    }
  };

  // ── Step 3: Generate Scripts ───────────────────────────────────────
  const handleGenerateScripts = async () => {
    if (!breakdown) return;
    setGeneratingScripts(true);
    try {
      const res = await fetch(`${API_BASE}/courses/ai/generate-scripts`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${getToken()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          session_id: sessionId,
          breakdown,
          tone,
          language: "es",
        }),
      });
      if (!res.ok) throw new Error(t("errors.scriptGenerationFailed"));
      const data = await res.json();
      setScripts(data.scripts);
    } catch {
      // Create empty scripts for manual editing
      setScripts(
        breakdown.modules.map((m, i) => ({
          module_index: i,
          title: m.title,
          script: "",
          duration_estimate_seconds: m.duration_minutes * 60,
          evaluation: null,
        }))
      );
    } finally {
      setGeneratingScripts(false);
    }
  };

  // ── Voice Preview ───────────────────────────────────────────────────
  const playPreview = (voiceId: string, previewUrl: string) => {
    if (playingVoice === voiceId) {
      // Stop
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setPlayingVoice(null);
      return;
    }
    // Play new
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const audio = new Audio(previewUrl);
    audio.onended = () => setPlayingVoice(null);
    audio.onerror = () => setPlayingVoice(null);
    audio.play();
    audioRef.current = audio;
    setPlayingVoice(voiceId);
  };

  // ── Step 4: Load Voices ────────────────────────────────────────────
  const loadVoices = async () => {
    setLoadingVoices(true);
    try {
      const res = await fetch(`${API_BASE}/courses/ai/voices`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      setVoices(data.voices);
    } catch {
      setVoices([]);
    } finally {
      setLoadingVoices(false);
    }
  };

  const handleCloneVoice = async () => {
    if (!cloneFile || !cloneName) return;
    setCloning(true);
    try {
      const formData = new FormData();
      formData.append("name", cloneName);
      formData.append("audio_file", cloneFile);
      const res = await fetch(`${API_BASE}/courses/ai/clone-voice`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
        body: formData,
      });
      const data = await res.json();
      // Add cloned voice to list
      setVoices((prev) => [
        ...prev,
        {
          id: data.voice_id,
          name: data.name,
          language: "es",
          gender: "custom",
          preview_url: "",
          provider: "cloned",
        },
      ]);
      setSelectedVoice(data.voice_id);
      setCloneFile(null);
      setCloneName("");
    } catch {
      alert(t("errors.cloneVoice"));
    } finally {
      setCloning(false);
    }
  };

  // ── Step 5: Generate Content ───────────────────────────────────────
  const handleGenerate = async () => {
    if (!breakdown) return;
    setGenerating(true);
    try {
      const res = await fetch(`${API_BASE}/courses/ai/generate-content`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${getToken()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          session_id: sessionId,
          course_title: breakdown.title,
          scripts,
          voice_id: selectedVoice,
          generate_video: true,
        }),
      });
      const data = await res.json();
      setResult(data);

      // Auto-generate multi-scene video (avatar + infographics) in background
      if (data.course_id) {
        try {
          await fetch(`${API_BASE}/courses/ai/generate-video-v2`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${getToken()}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ course_id: data.course_id, avatar_id: selectedAvatar }),
          });
        } catch {
          console.warn("Video generation queued in background");
        }
      }
    } catch {
      alert(t("errors.generateCourse"));
    } finally {
      setGenerating(false);
    }
  };

  // ── Add/remove modules in breakdown ────────────────────────────────
  const updateModule = (index: number, field: string, value: any) => {
    if (!breakdown) return;
    const updated = { ...breakdown };
    updated.modules = [...updated.modules];
    updated.modules[index] = { ...updated.modules[index], [field]: value };
    setBreakdown(updated);
  };

  const removeModule = (index: number) => {
    if (!breakdown) return;
    const updated = { ...breakdown };
    updated.modules = updated.modules.filter((_, i) => i !== index);
    setBreakdown(updated);
  };

  const addModule = () => {
    if (!breakdown) return;
    const updated = { ...breakdown };
    updated.modules = [
      ...updated.modules,
      {
        title: `Módulo ${updated.modules.length + 1}: Nuevo módulo`,
        description: "",
        duration_minutes: 10,
        content_points: ["Punto 1"],
        has_evaluation: true,
        evaluation_questions: 3,
      },
    ];
    setBreakdown(updated);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-slide-up pb-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground">
          {t("subtitle")}
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const isActive = i === step;
          const isDone = i < step;
          return (
            <div key={s.label} className="flex items-center">
              <button
                onClick={() => i < step && setStep(i)}
                disabled={i > step}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-all whitespace-nowrap",
                  isActive
                    ? "bg-violet-500/20 text-violet-400 border border-violet-500/30"
                    : isDone
                    ? "bg-emerald-500/10 text-emerald-400 cursor-pointer hover:bg-emerald-500/20"
                    : "text-muted-foreground opacity-50"
                )}
              >
                {isDone ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">{s.label}</span>
              </button>
              {i < STEPS.length - 1 && (
                <ChevronRight className="h-4 w-4 text-muted-foreground mx-1 shrink-0" />
              )}
            </div>
          );
        })}
      </div>

      {/* ─── STEP 0: Materials ──────────────────────────────────── */}
      {step === 0 && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-violet-400" />
                Describe tu curso
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>¿De qué trata el curso? Descríbelo con tus palabras</Label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ej: Quiero crear un curso de seguridad industrial para los operarios de planta. Debe cubrir uso de EPP, protocolos de emergencia, y manejo de sustancias peligrosas. Nivel básico, duración aproximada 1 hora."
                  rows={4}
                  className="flex w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 resize-none"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5 text-blue-400" />
                Material de referencia (opcional)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-white/10 rounded-xl p-8 text-center cursor-pointer hover:border-violet-500/30 hover:bg-violet-500/5 transition-all"
              >
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm font-medium">
                  Arrastra archivos o haz click para subir
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  PDF, imágenes (PNG, JPG) — hasta 10 archivos
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.png,.jpg,.jpeg,.webp"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) {
                      setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
                    }
                  }}
                />
              </div>

              {files.length > 0 && (
                <div className="space-y-2">
                  {files.map((f, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 p-2 rounded-lg bg-white/[0.03] border border-white/[0.08]"
                    >
                      {f.type.includes("pdf") ? (
                        <FileText className="h-5 w-5 text-red-400 shrink-0" />
                      ) : (
                        <ImageIcon className="h-5 w-5 text-blue-400 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{f.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(f.size / 1024).toFixed(0)} KB
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        onClick={() =>
                          setFiles((prev) => prev.filter((_, j) => j !== i))
                        }
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button
              onClick={handleAnalyze}
              disabled={!description.trim() || analyzing}
              size="lg"
            >
              {analyzing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analizando con IA...
                </>
              ) : (
                <>
                  Analizar y proponer estructura
                  <Sparkles className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* ─── STEP 1: Breakdown ─────────────────────────────────── */}
      {step === 1 && breakdown && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Propuesta de Estructura</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Título del curso</Label>
                  <Input
                    value={breakdown.title}
                    onChange={(e) =>
                      setBreakdown({ ...breakdown, title: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Audiencia objetivo</Label>
                  <Input
                    value={breakdown.target_audience}
                    onChange={(e) =>
                      setBreakdown({
                        ...breakdown,
                        target_audience: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Descripción</Label>
                <textarea
                  value={breakdown.description}
                  onChange={(e) =>
                    setBreakdown({
                      ...breakdown,
                      description: e.target.value,
                    })
                  }
                  rows={2}
                  className="flex w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50"
                />
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <BookOpen className="h-4 w-4" />
                  {breakdown.modules.length} módulos
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {breakdown.modules.reduce(
                    (sum, m) => sum + m.duration_minutes,
                    0
                  )}{" "}
                  min total
                </span>
                <span className="flex items-center gap-1">
                  <HelpCircle className="h-4 w-4" />
                  {breakdown.modules.filter((m) => m.has_evaluation).length}{" "}
                  evaluaciones
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Modules */}
          <div className="space-y-3">
            {breakdown.modules.map((mod, i) => (
              <Card
                key={i}
                className="gradient-border hover:glow-violet-sm transition-all"
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/20 text-violet-400 text-sm font-bold mt-1">
                      {i + 1}
                    </div>
                    <div className="flex-1 space-y-3">
                      <Input
                        value={mod.title}
                        onChange={(e) =>
                          updateModule(i, "title", e.target.value)
                        }
                        className="font-semibold"
                      />
                      <textarea
                        value={mod.description}
                        onChange={(e) =>
                          updateModule(i, "description", e.target.value)
                        }
                        rows={2}
                        className="flex w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50"
                        placeholder="Descripción del módulo..."
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary" className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <input
                            type="number"
                            value={mod.duration_minutes}
                            onChange={(e) =>
                              updateModule(
                                i,
                                "duration_minutes",
                                parseInt(e.target.value) || 5
                              )
                            }
                            className="w-10 bg-transparent text-center outline-none"
                            min={1}
                          />
                          min
                        </Badge>
                        <button
                          onClick={() =>
                            updateModule(
                              i,
                              "has_evaluation",
                              !mod.has_evaluation
                            )
                          }
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                            mod.has_evaluation
                              ? "bg-emerald-500/15 text-emerald-400"
                              : "bg-white/5 text-muted-foreground"
                          )}
                        >
                          <HelpCircle className="h-3 w-3" />
                          Evaluación{" "}
                          {mod.has_evaluation ? "✓" : "—"}
                        </button>
                      </div>
                      {/* Content points */}
                      <div className="space-y-1">
                        {mod.content_points.map((point, pi) => (
                          <div
                            key={pi}
                            className="flex items-center gap-2"
                          >
                            <span className="text-xs text-muted-foreground">
                              •
                            </span>
                            <input
                              value={point}
                              onChange={(e) => {
                                const pts = [...mod.content_points];
                                pts[pi] = e.target.value;
                                updateModule(i, "content_points", pts);
                              }}
                              className="flex-1 bg-transparent text-sm outline-none border-b border-transparent focus:border-violet-500/30"
                              placeholder="Punto del contenido..."
                            />
                            <button
                              onClick={() => {
                                const pts = mod.content_points.filter(
                                  (_, j) => j !== pi
                                );
                                updateModule(i, "content_points", pts);
                              }}
                              className="text-muted-foreground hover:text-red-400"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() =>
                            updateModule(i, "content_points", [
                              ...mod.content_points,
                              "",
                            ])
                          }
                          className="text-xs text-violet-400 hover:text-violet-300"
                        >
                          + Agregar punto
                        </button>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-muted-foreground hover:text-red-400"
                      onClick={() => removeModule(i)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}

            <Button variant="outline" onClick={addModule} className="w-full">
              <Plus className="mr-2 h-4 w-4" />
              Agregar módulo
            </Button>
          </div>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(0)}>
              <ChevronLeft className="mr-2 h-4 w-4" />
              Atrás
            </Button>
            <Button onClick={() => setStep(2)}>
              Continuar a Scripts
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ─── STEP 2: Scripts ───────────────────────────────────── */}
      {step === 2 && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Generación de Scripts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                ¿Cómo quieres crear los guiones de narración para cada módulo?
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <button
                  onClick={() => setScriptMode("ai")}
                  className={cn(
                    "p-4 rounded-xl border text-left transition-all",
                    scriptMode === "ai"
                      ? "border-violet-500/40 bg-violet-500/10"
                      : "border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06]"
                  )}
                >
                  <Bot className="h-8 w-8 text-violet-400 mb-2" />
                  <h3 className="font-semibold">IA Completa</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    La IA genera todos los scripts basándose en la estructura y
                    materiales
                  </p>
                </button>
                <button
                  onClick={() => setScriptMode("manual")}
                  className={cn(
                    "p-4 rounded-xl border text-left transition-all",
                    scriptMode === "manual"
                      ? "border-violet-500/40 bg-violet-500/10"
                      : "border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06]"
                  )}
                >
                  <PenTool className="h-8 w-8 text-blue-400 mb-2" />
                  <h3 className="font-semibold">Manual / Editar</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Escribe o edita los scripts tú mismo (la IA genera un
                    borrador)
                  </p>
                </button>
              </div>

              {scriptMode === "ai" && (
                <div className="space-y-2">
                  <Label>Tono de la narración</Label>
                  <div className="flex gap-2">
                    {[
                      { value: "professional", label: "Profesional" },
                      { value: "casual", label: "Casual" },
                      { value: "academic", label: "Académico" },
                    ].map((t) => (
                      <button
                        key={t.value}
                        onClick={() => setTone(t.value)}
                        className={cn(
                          "px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                          tone === t.value
                            ? "bg-violet-500/20 text-violet-400 border border-violet-500/30"
                            : "bg-white/5 text-muted-foreground hover:bg-white/10"
                        )}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <Button
                onClick={handleGenerateScripts}
                disabled={generatingScripts}
              >
                {generatingScripts ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generando scripts...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    {scriptMode === "ai"
                      ? "Generar scripts con IA"
                      : "Generar borradores"}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Script editors */}
          {scripts.length > 0 && (
            <div className="space-y-4">
              {scripts.map((s, i) => (
                <Card key={i}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded bg-violet-500/20 text-violet-400 text-xs font-bold">
                        {i + 1}
                      </span>
                      {s.title}
                      <Badge variant="secondary" className="ml-auto text-xs">
                        ~{Math.round(s.duration_estimate_seconds / 60)} min
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <textarea
                      value={s.script}
                      onChange={(e) => {
                        const updated = [...scripts];
                        updated[i] = { ...updated[i], script: e.target.value };
                        setScripts(updated);
                      }}
                      rows={8}
                      className="flex w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50"
                      placeholder="Script de narración..."
                    />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(1)}>
              <ChevronLeft className="mr-2 h-4 w-4" />
              Atrás
            </Button>
            <Button
              onClick={() => {
                loadVoices();
                setStep(3);
              }}
              disabled={scripts.length === 0}
            >
              Continuar a Voz
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ─── STEP 3: Avatar + Voice ───────────────────────────── */}
      {step === 3 && (
        <div className="space-y-6">
          {/* Avatar Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Video className="h-5 w-5 text-violet-400" />
                Selecciona el Avatar del Instructor
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                El avatar aparecerá en los videos alternando con infografías generadas automáticamente con IA
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {AVATAR_OPTIONS.map((av) => (
                  <div
                    key={av.id}
                    className={cn(
                      "flex flex-col items-center gap-2 p-4 rounded-xl border text-center transition-all cursor-pointer",
                      selectedAvatar === av.id
                        ? "border-violet-500/40 bg-violet-500/10"
                        : "border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06]"
                    )}
                    onClick={() => setSelectedAvatar(av.id)}
                  >
                    <span className="text-4xl">{av.preview}</span>
                    <p className="text-sm font-medium">{av.name}</p>
                    <p className="text-xs text-muted-foreground">{av.desc}</p>
                    {selectedAvatar === av.id && (
                      <Check className="h-4 w-4 text-violet-400" />
                    )}
                  </div>
                ))}
              </div>
              <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3">
                <p className="text-xs text-muted-foreground">
                  💡 Cada módulo genera un video multi-escena: el avatar explica conceptos y se intercalan infografías creadas con DALL-E para visualizar datos clave.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Voice Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Volume2 className="h-5 w-5 text-violet-400" />
                Selecciona la Voz del Narrador
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingVoices ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {voices.map((v) => (
                    <div
                      key={v.id}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-xl border text-left transition-all cursor-pointer",
                        selectedVoice === v.id
                          ? "border-violet-500/40 bg-violet-500/10"
                          : "border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06]"
                      )}
                      onClick={() => setSelectedVoice(v.id)}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (v.preview_url) playPreview(v.id, v.preview_url);
                        }}
                        disabled={!v.preview_url}
                        className={cn(
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-all",
                          playingVoice === v.id
                            ? "bg-violet-500 text-white animate-pulse"
                            : v.gender === "female"
                            ? "bg-pink-500/20 text-pink-400 hover:bg-pink-500/30"
                            : v.gender === "custom"
                            ? "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30"
                            : "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30",
                          !v.preview_url && "opacity-50 cursor-default"
                        )}
                        title={v.preview_url ? "Escuchar preview" : "Sin preview disponible"}
                      >
                        {playingVoice === v.id ? (
                          <Square className="h-4 w-4" />
                        ) : (
                          <Play className="h-4 w-4 ml-0.5" />
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{v.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {v.language.toUpperCase()} · {v.gender} · {v.provider}
                        </p>
                      </div>
                      {selectedVoice === v.id && (
                        <Check className="h-4 w-4 text-violet-400 shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Clone voice */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mic className="h-5 w-5 text-amber-400" />
                Clonar voz personalizada
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Sube un audio de al menos 30 segundos para clonar una voz personalizada
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nombre de la voz</Label>
                  <Input
                    value={cloneName}
                    onChange={(e) => setCloneName(e.target.value)}
                    placeholder="Ej: Instructor principal"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Audio de referencia</Label>
                  <Input
                    type="file"
                    accept="audio/*"
                    onChange={(e) => setCloneFile(e.target.files?.[0] || null)}
                  />
                </div>
              </div>
              <Button
                variant="outline"
                onClick={handleCloneVoice}
                disabled={!cloneFile || !cloneName || cloning}
              >
                {cloning ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Clonando...
                  </>
                ) : (
                  <>
                    <Mic className="mr-2 h-4 w-4" /> Clonar voz
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(2)}>
              <ChevronLeft className="mr-2 h-4 w-4" />
              Atrás
            </Button>
            <Button
              onClick={() => setStep(4)}
              disabled={!selectedVoice}
            >
              Continuar a Generar
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ─── STEP 4: Generate ──────────────────────────────────── */}
      {step === 4 && (
        <div className="space-y-6">
          {!result ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Video className="h-5 w-5 text-violet-400" />
                    Resumen y Generación
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-4 text-center">
                      <p className="text-2xl font-bold">
                        {breakdown?.modules.length || 0}
                      </p>
                      <p className="text-xs text-muted-foreground">Módulos</p>
                    </div>
                    <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-4 text-center">
                      <p className="text-2xl font-bold">
                        {scripts.reduce(
                          (sum, s) => sum + s.duration_estimate_seconds,
                          0
                        ) / 60 || 0}{" "}
                        min
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Duración total
                      </p>
                    </div>
                    <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-4 text-center">
                      <p className="text-2xl font-bold">
                        {AVATAR_OPTIONS.find((a) => a.id === selectedAvatar)?.name || "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">Avatar</p>
                    </div>
                    <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-4 text-center">
                      <p className="text-2xl font-bold">
                        {voices.find((v) => v.id === selectedVoice)?.name ||
                          "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">Voz</p>
                    </div>
                  </div>

                  <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-4">
                    <h3 className="font-semibold mb-2">
                      {breakdown?.title}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {breakdown?.description}
                    </p>
                    <div className="mt-3 space-y-1">
                      {scripts.map((s, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 text-sm"
                        >
                          <span className="flex h-5 w-5 items-center justify-center rounded bg-violet-500/20 text-violet-400 text-[10px] font-bold">
                            {i + 1}
                          </span>
                          <span>{s.title}</span>
                          <span className="text-xs text-muted-foreground ml-auto">
                            ~{Math.round(s.duration_estimate_seconds / 60)}{" "}
                            min
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(3)}>
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  Atrás
                </Button>
                <Button
                  onClick={handleGenerate}
                  disabled={generating}
                  size="lg"
                >
                  {generating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generando curso y videos...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Crear Curso con Videos
                    </>
                  )}
                </Button>
              </div>
            </>
          ) : (
            /* Success */
            <Card className="text-center py-12">
              <CardContent className="space-y-4">
                <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-full bg-emerald-500/20">
                  <Check className="h-8 w-8 text-emerald-400" />
                </div>
                <h2 className="text-2xl font-bold">¡Curso Creado!</h2>
                <p className="text-muted-foreground">
                  {result.message}
                </p>
                <div className="flex items-center justify-center gap-3 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => router.push("/admin/courses")}
                  >
                    Ver todos los cursos
                  </Button>
                  <Button
                    onClick={() =>
                      router.push(`/admin/courses/${result.course_id}`)
                    }
                  >
                    Ver curso creado
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
