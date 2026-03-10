/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  ChevronLeft,
  Film,
  Video,
  Volume2,
  Loader2,
  RefreshCw,
  Play,
  Clapperboard,
  Layers,
  Eye,
  EyeOff,
} from "lucide-react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://colleague-backend-production.up.railway.app/api/v1";

function getToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("ac_token") || "";
}

interface Scene {
  id?: string;
  scene_order: number;
  sora_prompt: string;
  narration_text: string;
  duration: number;
  video_status: string;
  audio_status: string;
  video_url?: string;
  audio_url?: string;
}

interface Episode {
  id?: string;
  title: string;
  synopsis: string;
  episode_order?: number;
  scenes: Scene[];
}

interface SeriesDetail {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  episodes: Episode[];
  created_at: string;
}

const categoryColors: Record<string, string> = {
  caso: "bg-amber-500/20 text-amber-400 border-amber-500/20",
  onboarding: "bg-violet-500/20 text-violet-400 border-violet-500/20",
  compliance: "bg-blue-500/20 text-blue-400 border-blue-500/20",
  custom: "bg-emerald-500/20 text-emerald-400 border-emerald-500/20",
};

const categoryLabels: Record<string, string> = {
  caso: "Caso",
  onboarding: "Onboarding",
  compliance: "Compliance",
  custom: "Personalizado",
};

const statusVariant = (status: string) => {
  switch (status) {
    case "completed":
      return "success" as const;
    case "generating":
      return "default" as const;
    case "draft":
      return "secondary" as const;
    case "error":
      return "destructive" as const;
    default:
      return "secondary" as const;
  }
};

const statusLabel = (status: string) => {
  switch (status) {
    case "completed":
      return "Completada";
    case "generating":
      return "Generando";
    case "draft":
      return "Borrador";
    case "error":
      return "Error";
    case "pending":
      return "Pendiente";
    default:
      return status;
  }
};

export default function SeriesDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [series, setSeries] = useState<SeriesDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedEpisodes, setExpandedEpisodes] = useState<Set<number>>(
    new Set([0])
  );
  const [expandedPrompts, setExpandedPrompts] = useState<Set<string>>(
    new Set()
  );
  const [regeneratingVideos, setRegeneratingVideos] = useState(false);
  const [regeneratingAudio, setRegeneratingAudio] = useState(false);

  const fetchSeries = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/series/ai/${id}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error("Failed to fetch series");
      const data: SeriesDetail = await res.json();
      setSeries(data);
    } catch (err) {
      console.error("Error loading series:", err);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    fetchSeries();
  }, [fetchSeries]);

  const toggleEpisode = (idx: number) => {
    setExpandedEpisodes((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const togglePrompt = (key: string) => {
    setExpandedPrompts((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleRegenerateVideos = async () => {
    setRegeneratingVideos(true);
    try {
      const token = getToken();
      await fetch(`${API_BASE}/series/ai/generate-videos/${id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      // Refresh data after a moment
      setTimeout(fetchSeries, 2000);
    } catch (err) {
      console.error("Error regenerating videos:", err);
      alert("Error al regenerar videos.");
    } finally {
      setRegeneratingVideos(false);
    }
  };

  const handleRegenerateAudio = async () => {
    setRegeneratingAudio(true);
    try {
      const token = getToken();
      await fetch(`${API_BASE}/series/ai/generate-audio/${id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      setTimeout(fetchSeries, 2000);
    } catch (err) {
      console.error("Error regenerating audio:", err);
      alert("Error al regenerar audio.");
    } finally {
      setRegeneratingAudio(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <Clapperboard className="h-8 w-8 text-violet-400 animate-pulse" />
          <p className="text-sm text-muted-foreground">
            Cargando micro-serie...
          </p>
        </div>
      </div>
    );
  }

  if (!series) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Film className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium">Serie no encontrada</h3>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push("/admin/series")}
        >
          <ChevronLeft className="mr-2 h-4 w-4" />
          Volver a Series
        </Button>
      </div>
    );
  }

  const totalScenes = series.episodes.reduce(
    (a, ep) => a + ep.scenes.length,
    0
  );

  return (
    <div className="space-y-6 animate-slide-up max-w-4xl mx-auto">
      {/* Back button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.push("/admin/series")}
        className="text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="mr-1 h-4 w-4" />
        Volver a Series
      </Button>

      {/* Series Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant={statusVariant(series.status)}>
                  {statusLabel(series.status)}
                </Badge>
                <div
                  className={cn(
                    "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                    categoryColors[series.category] ||
                      "bg-white/10 text-muted-foreground border-white/10"
                  )}
                >
                  {categoryLabels[series.category] || series.category}
                </div>
              </div>
              <CardTitle className="text-2xl">{series.title}</CardTitle>
              <CardDescription>{series.description}</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-4 pt-3 border-t border-white/[0.06] mt-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Layers className="h-4 w-4 text-violet-400" />
              {series.episodes.length} episodios
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Film className="h-4 w-4 text-violet-400" />
              {totalScenes} escenas
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRegenerateVideos}
              disabled={regeneratingVideos}
            >
              {regeneratingVideos ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Regenerar Videos
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRegenerateAudio}
              disabled={regeneratingAudio}
            >
              {regeneratingAudio ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Regenerar Audio
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Episodes Accordion */}
      <div className="space-y-3">
        {series.episodes.map((episode, epIdx) => {
          const isExpanded = expandedEpisodes.has(epIdx);
          return (
            <Card key={epIdx} className="overflow-hidden">
              <button
                onClick={() => toggleEpisode(epIdx)}
                className="w-full text-left p-4 flex items-center gap-3 hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/20 text-violet-400 text-sm font-bold">
                  {episode.episode_order ?? epIdx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{episode.title}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {episode.synopsis}
                  </p>
                </div>
                <Badge variant="secondary" className="shrink-0">
                  {episode.scenes.length} escenas
                </Badge>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 text-muted-foreground transition-transform shrink-0",
                    isExpanded && "rotate-180"
                  )}
                />
              </button>

              {isExpanded && (
                <div className="border-t border-white/[0.06] p-4 space-y-4">
                  {episode.scenes.map((scene, scIdx) => {
                    const promptKey = `${epIdx}-${scIdx}`;
                    const isPromptExpanded = expandedPrompts.has(promptKey);
                    return (
                      <div
                        key={scIdx}
                        className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-4 space-y-3"
                      >
                        {/* Scene header */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <Film className="h-4 w-4 text-violet-400" />
                          <span className="text-sm font-medium">
                            Escena {scene.scene_order}
                          </span>
                          <Badge
                            variant="secondary"
                            className="text-[10px]"
                          >
                            {scene.duration}s
                          </Badge>
                          <div className="flex items-center gap-2 ml-auto">
                            <div className="flex items-center gap-1">
                              <Video className="h-3 w-3" />
                              <Badge
                                variant={
                                  scene.video_status === "completed"
                                    ? "success"
                                    : scene.video_status === "error"
                                    ? "destructive"
                                    : "secondary"
                                }
                                className="text-[10px]"
                              >
                                {statusLabel(scene.video_status)}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-1">
                              <Volume2 className="h-3 w-3" />
                              <Badge
                                variant={
                                  scene.audio_status === "completed"
                                    ? "success"
                                    : scene.audio_status === "error"
                                    ? "destructive"
                                    : "secondary"
                                }
                                className="text-[10px]"
                              >
                                {statusLabel(scene.audio_status)}
                              </Badge>
                            </div>
                          </div>
                        </div>

                        {/* Sora prompt (collapsible) */}
                        <button
                          onClick={() => togglePrompt(promptKey)}
                          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {isPromptExpanded ? (
                            <EyeOff className="h-3 w-3" />
                          ) : (
                            <Eye className="h-3 w-3" />
                          )}
                          {isPromptExpanded
                            ? "Ocultar prompt Sora"
                            : "Ver prompt Sora"}
                        </button>
                        {isPromptExpanded && (
                          <div className="rounded-md bg-white/[0.03] border border-white/[0.06] p-3">
                            <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                              {scene.sora_prompt}
                            </p>
                          </div>
                        )}

                        {/* Narration text */}
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">
                            Narración
                          </p>
                          <p className="text-sm">{scene.narration_text}</p>
                        </div>

                        {/* Video player */}
                        {scene.video_url && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                              <Video className="h-3 w-3" /> Video
                            </p>
                            <video
                              controls
                              className="w-full rounded-lg border border-white/[0.08] max-h-64"
                              src={scene.video_url}
                            >
                              Tu navegador no soporta el tag de video.
                            </video>
                          </div>
                        )}

                        {/* Audio player */}
                        {scene.audio_url && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                              <Volume2 className="h-3 w-3" /> Audio
                            </p>
                            <audio
                              controls
                              className="w-full"
                              src={scene.audio_url}
                            >
                              Tu navegador no soporta el tag de audio.
                            </audio>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
