"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  FileText,
  Wand2,
  ClipboardCheck,
  Rocket,
  ChevronRight,
  ChevronLeft,
  Check,
  Loader2,
  Film,
  Pencil,
  Sparkles,
  Video,
  Volume2,
} from "lucide-react";
import { useTranslations } from "next-intl";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://colleague-backend-production.up.railway.app/api/v1";

function getToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("ac_token") || "";
}

const STEPS = [
  { label: "Descripción", icon: FileText, desc: "Describe tu micro-serie" },
  { label: "Guión IA", icon: Wand2, desc: "Genera y edita el guión" },
  { label: "Revisión", icon: ClipboardCheck, desc: "Revisa antes de crear" },
  { label: "Generación", icon: Rocket, desc: "Genera videos y audio" },
];

interface Scene {
  scene_order: number;
  sora_prompt: string;
  narration_text: string;
  duration: number;
  video_status?: string;
  audio_status?: string;
  video_url?: string;
  audio_url?: string;
}

interface Episode {
  title: string;
  synopsis: string;
  scenes: Scene[];
}

interface GeneratedScript {
  title: string;
  description: string;
  category: string;
  episodes: Episode[];
}

interface GenerationStatus {
  status: string;
  episodes: {
    title: string;
    scenes: {
      scene_order: number;
      video_status: string;
      audio_status: string;
      video_url?: string;
      audio_url?: string;
    }[];
  }[];
}

export default function CreateSeriesPage() {
  const t = useTranslations("adminSeriesCreate");
  const router = useRouter();
  const [step, setStep] = useState(0);

  // Step 1: Description
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("caso");
  const [caseDescription, setCaseDescription] = useState("");
  const [numEpisodes, setNumEpisodes] = useState(3);

  // Step 2: Script
  const [generatedScript, setGeneratedScript] =
    useState<GeneratedScript | null>(null);
  const [generatingScript, setGeneratingScript] = useState(false);

  // Step 3: Review — uses generatedScript

  // Step 4: Generation
  const [seriesId, setSeriesId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [generationStatus, setGenerationStatus] =
    useState<GenerationStatus | null>(null);
  const [generationComplete, setGenerationComplete] = useState(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const handleGenerateScript = async () => {
    setGeneratingScript(true);
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE}/series/ai/generate-script`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title,
          description,
          category,
          case_description: caseDescription,
          num_episodes: numEpisodes,
        }),
      });
      if (!res.ok) throw new Error(t("errors.generateScript"));
      const data: GeneratedScript = await res.json();
      setGeneratedScript(data);
      setStep(1);
    } catch (err) {
      console.error(err);
      alert(t("errors.generateScriptRetry"));
    } finally {
      setGeneratingScript(false);
    }
  };

  const handleCreateSeries = async () => {
    if (!generatedScript) return;
    setCreating(true);
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE}/series/ai/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(generatedScript),
      });
      if (!res.ok) throw new Error(t("errors.createSeries"));
      const data = await res.json();
      const id = data.id || data.series_id;
      setSeriesId(id);
      setStep(3);
      // Auto-trigger generation
      triggerGeneration(id, token);
    } catch (err) {
      console.error(err);
      alert(t("errors.createSeriesRetry"));
    } finally {
      setCreating(false);
    }
  };

  const triggerGeneration = async (id: string, token: string) => {
    try {
      // Trigger full pipeline: video + audio + merge (all in one)
      await fetch(`${API_BASE}/series/ai/generate-videos/${id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
    } catch (err) {
      console.error("Error triggering generation:", err);
    }
    // Start polling for status
    startPolling(id, token);
  };

  const startPolling = useCallback((id: string, token: string) => {
    const poll = async () => {
      try {
        const res = await fetch(`${API_BASE}/series/ai/status/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data: GenerationStatus = await res.json();
        setGenerationStatus(data);

        // Check if all done
        const allDone = data.episodes?.every((ep) =>
          ep.scenes?.every(
            (sc) =>
              (sc.video_status === "completed" || sc.video_status === "error") &&
              (sc.audio_status === "completed" || sc.audio_status === "error")
          )
        );
        if (allDone || data.status === "completed") {
          setGenerationComplete(true);
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
        }
      } catch (err) {
        console.error("Error polling status:", err);
      }
    };
    poll();
    pollingRef.current = setInterval(poll, 5000);
  }, []);

  // Update scene fields inline
  const updateScene = (
    epIdx: number,
    scIdx: number,
    field: keyof Scene,
    value: string | number
  ) => {
    if (!generatedScript) return;
    const updated = { ...generatedScript };
    const episodes = [...updated.episodes];
    const scenes = [...episodes[epIdx].scenes];
    scenes[scIdx] = { ...scenes[scIdx], [field]: value };
    episodes[epIdx] = { ...episodes[epIdx], scenes };
    updated.episodes = episodes;
    setGeneratedScript(updated);
  };

  const updateEpisode = (
    epIdx: number,
    field: "title" | "synopsis",
    value: string
  ) => {
    if (!generatedScript) return;
    const updated = { ...generatedScript };
    const episodes = [...updated.episodes];
    episodes[epIdx] = { ...episodes[epIdx], [field]: value };
    updated.episodes = episodes;
    setGeneratedScript(updated);
  };

  const totalScenes = generatedScript
    ? generatedScript.episodes.reduce((a, ep) => a + ep.scenes.length, 0)
    : 0;

  const getSceneProgress = () => {
    if (!generationStatus?.episodes) return { video: 0, audio: 0 };
    let videoCompleted = 0;
    let audioCompleted = 0;
    let total = 0;
    for (const ep of generationStatus.episodes) {
      for (const sc of ep.scenes) {
        total++;
        if (sc.video_status === "completed") videoCompleted++;
        if (sc.audio_status === "completed") audioCompleted++;
      }
    }
    if (total === 0) return { video: 0, audio: 0 };
    return {
      video: Math.round((videoCompleted / total) * 100),
      audio: Math.round((audioCompleted / total) * 100),
    };
  };

  return (
    <div className="space-y-6 animate-slide-up max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground">
          {t("subtitle")}
        </p>
      </div>

      {/* Step Indicator */}
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

      {/* Step 1: Descripción */}
      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-violet-400" />
              Descripción de la Micro-Serie
            </CardTitle>
            <CardDescription>
              Define los detalles básicos y el escenario que quieres enseñar
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="title">Título</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej: Acoso Laboral en Oficina"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Breve descripción de la micro-serie"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Categoría</Label>
                <Select
                  id="category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="caso">Caso</option>
                  <option value="onboarding">Onboarding</option>
                  <option value="compliance">Compliance</option>
                  <option value="custom">Personalizado</option>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="numEpisodes">
                  Número de episodios: {numEpisodes}
                </Label>
                <input
                  id="numEpisodes"
                  type="range"
                  min={2}
                  max={5}
                  value={numEpisodes}
                  onChange={(e) => setNumEpisodes(Number(e.target.value))}
                  className="w-full accent-violet-500 mt-2"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>2</span>
                  <span>3</span>
                  <span>4</span>
                  <span>5</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="caseDescription">
                Describe el caso o escenario que quieres enseñar
              </Label>
              <Textarea
                id="caseDescription"
                value={caseDescription}
                onChange={(e) => setCaseDescription(e.target.value)}
                placeholder="Describe en detalle el escenario, personajes, y lecciones clave que quieres cubrir..."
                rows={5}
              />
            </div>

            <div className="flex justify-end">
              <Button
                onClick={handleGenerateScript}
                disabled={
                  !title || !caseDescription || generatingScript
                }
                size="lg"
              >
                {generatingScript ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generando guión...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generar Guión con IA
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

      )}

      {/* Generating overlay */}
      {generatingScript && (
        <Card className="border-violet-500/30 bg-violet-500/5">
          <CardContent className="py-12 flex flex-col items-center gap-4">
            <div className="relative">
              <div className="h-16 w-16 rounded-full border-4 border-violet-500/20 border-t-violet-500 animate-spin" />
              <Sparkles className="h-6 w-6 text-violet-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>
            <h3 className="text-lg font-semibold text-violet-300">
              Generando guión con IA...
            </h3>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              Estamos creando {numEpisodes} episodios con escenas cinematográficas, 
              prompts de video y narración. Esto puede tomar 15-30 segundos.
            </p>
            <div className="flex gap-1 mt-2">
              <div className="h-2 w-2 rounded-full bg-violet-400 animate-bounce" style={{animationDelay: '0ms'}} />
              <div className="h-2 w-2 rounded-full bg-violet-400 animate-bounce" style={{animationDelay: '150ms'}} />
              <div className="h-2 w-2 rounded-full bg-violet-400 animate-bounce" style={{animationDelay: '300ms'}} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Guión IA */}
      {step === 1 && generatedScript && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wand2 className="h-5 w-5 text-violet-400" />
                Guión Generado
              </CardTitle>
              <CardDescription>
                Revisa y edita el guión generado por IA. Puedes modificar
                cualquier campo.
              </CardDescription>
            </CardHeader>
          </Card>

          {generatedScript.episodes.map((episode, epIdx) => (
            <Card
              key={epIdx}
              className="gradient-border hover:glow-violet-sm transition-all"
            >
              <CardContent className="p-4 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/20 text-violet-400 text-sm font-bold mt-1">
                    {epIdx + 1}
                  </div>
                  <div className="flex-1 space-y-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        Título del Episodio
                      </Label>
                      <Input
                        value={episode.title}
                        onChange={(e) =>
                          updateEpisode(epIdx, "title", e.target.value)
                        }
                        className="font-semibold"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        Sinopsis
                      </Label>
                      <Textarea
                        value={episode.synopsis}
                        onChange={(e) =>
                          updateEpisode(epIdx, "synopsis", e.target.value)
                        }
                        rows={2}
                      />
                    </div>
                  </div>
                </div>

                <div className="ml-11 space-y-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Escenas
                  </p>
                  {episode.scenes.map((scene, scIdx) => (
                    <div
                      key={scIdx}
                      className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3 space-y-3"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Film className="h-3.5 w-3.5 text-violet-400" />
                        <span className="text-xs font-medium text-violet-400">
                          Escena {scene.scene_order}
                        </span>
                        <Badge variant="secondary" className="text-[10px] ml-auto">
                          {scene.duration}s
                        </Badge>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground flex items-center gap-1">
                          <Video className="h-3 w-3" /> Prompt Sora
                        </Label>
                        <Textarea
                          value={scene.sora_prompt}
                          onChange={(e) =>
                            updateScene(
                              epIdx,
                              scIdx,
                              "sora_prompt",
                              e.target.value
                            )
                          }
                          rows={3}
                          className="text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground flex items-center gap-1">
                          <Volume2 className="h-3 w-3" /> Texto de narración
                        </Label>
                        <Textarea
                          value={scene.narration_text}
                          onChange={(e) =>
                            updateScene(
                              epIdx,
                              scIdx,
                              "narration_text",
                              e.target.value
                            )
                          }
                          rows={2}
                          className="text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">
                          Duración (segundos)
                        </Label>
                        <Input
                          type="number"
                          value={scene.duration}
                          onChange={(e) =>
                            updateScene(
                              epIdx,
                              scIdx,
                              "duration",
                              Number(e.target.value)
                            )
                          }
                          className="w-24 text-sm"
                          min={1}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(0)}>
              <ChevronLeft className="mr-2 h-4 w-4" />
              Atrás
            </Button>
            <Button onClick={() => setStep(2)}>
              Continuar a Revisión
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Revisión */}
      {step === 2 && generatedScript && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-violet-400" />
                Revisión Final
              </CardTitle>
              <CardDescription>
                Confirma los detalles antes de crear la serie
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Título</p>
                  <p className="font-medium">{generatedScript.title}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Categoría</p>
                  <Badge variant="secondary">
                    {generatedScript.category}
                  </Badge>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground">Descripción</p>
                  <p className="text-sm text-muted-foreground">
                    {generatedScript.description}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 pt-2 border-t border-white/[0.06]">
                <div className="flex items-center gap-2 text-sm">
                  <Film className="h-4 w-4 text-violet-400" />
                  <span>
                    {generatedScript.episodes.length} episodios
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Pencil className="h-4 w-4 text-violet-400" />
                  <span>{totalScenes} escenas</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {generatedScript.episodes.map((episode, epIdx) => (
            <Card key={epIdx}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/20 text-violet-400 text-sm font-bold">
                    {epIdx + 1}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold">{episode.title}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {episode.synopsis}
                    </p>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {episode.scenes.length} escenas ·{" "}
                      {episode.scenes.reduce((a, s) => a + s.duration, 0)}s
                      duración total
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(1)}>
              <ChevronLeft className="mr-2 h-4 w-4" />
              Editar Guión
            </Button>
            <Button onClick={handleCreateSeries} disabled={creating}>
              {creating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creando serie...
                </>
              ) : (
                <>
                  <Rocket className="mr-2 h-4 w-4" />
                  Crear Serie
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Step 4: Generación */}
      {step === 3 && (
        <div className="space-y-4">
          {!generationComplete ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Loader2 className="h-5 w-5 text-violet-400 animate-spin" />
                  Generando Contenido
                </CardTitle>
                <CardDescription>
                  Generando videos y audio para cada escena. Esto puede tomar
                  varios minutos.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <Video className="h-4 w-4 text-violet-400" />
                      Videos (Sora)
                    </span>
                    <span className="text-violet-400">
                      {getSceneProgress().video}%
                    </span>
                  </div>
                  <Progress value={getSceneProgress().video} className="h-2" />
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <Volume2 className="h-4 w-4 text-violet-400" />
                      Audio (ElevenLabs)
                    </span>
                    <span className="text-violet-400">
                      {getSceneProgress().audio}%
                    </span>
                  </div>
                  <Progress value={getSceneProgress().audio} className="h-2" />
                </div>

                {generationStatus?.episodes && (
                  <div className="space-y-3 pt-4 border-t border-white/[0.06]">
                    {generationStatus.episodes.map((ep, epIdx) => (
                      <div key={epIdx} className="space-y-2">
                        <p className="text-sm font-medium">
                          Episodio {epIdx + 1}: {ep.title}
                        </p>
                        <div className="grid gap-2">
                          {ep.scenes.map((sc, scIdx) => (
                            <div
                              key={scIdx}
                              className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-sm"
                            >
                              <span className="text-muted-foreground w-16 shrink-0">
                                Escena {sc.scene_order}
                              </span>
                              <div className="flex items-center gap-2 flex-1">
                                <Video className="h-3 w-3" />
                                <Badge
                                  variant={
                                    sc.video_status === "completed"
                                      ? "success"
                                      : sc.video_status === "error"
                                      ? "destructive"
                                      : "secondary"
                                  }
                                  className="text-[10px]"
                                >
                                  {sc.video_status === "completed"
                                    ? "Listo"
                                    : sc.video_status === "error"
                                    ? "Error"
                                    : "Generando..."}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2 flex-1">
                                <Volume2 className="h-3 w-3" />
                                <Badge
                                  variant={
                                    sc.audio_status === "completed"
                                      ? "success"
                                      : sc.audio_status === "error"
                                      ? "destructive"
                                      : "secondary"
                                  }
                                  className="text-[10px]"
                                >
                                  {sc.audio_status === "completed"
                                    ? "Listo"
                                    : sc.audio_status === "error"
                                    ? "Error"
                                    : "Generando..."}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="text-center py-12">
              <CardContent className="space-y-4">
                <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-full bg-emerald-500/20">
                  <Check className="h-8 w-8 text-emerald-400" />
                </div>
                <h2 className="text-2xl font-bold">
                  ¡Micro-Serie Creada!
                </h2>
                <p className="text-muted-foreground">
                  Todos los videos y audios han sido generados exitosamente.
                </p>
                <div className="flex items-center justify-center gap-3 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => router.push("/admin/series")}
                  >
                    Ver todas las series
                  </Button>
                  {seriesId && (
                    <Button
                      onClick={() =>
                        router.push(`/admin/series/${seriesId}`)
                      }
                    >
                      Ver serie creada
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
