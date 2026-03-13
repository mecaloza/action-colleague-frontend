"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import {
  BackendCourse,
  BackendModule,
  BackendEvaluation,
  EvaluationQuestion,
  CourseStats,
  GenerationStatus,
} from "@/lib/types";
import {
  ArrowLeft,
  FileText,
  Video,
  ChevronDown,
  ChevronRight,
  Users,
  Loader2,
  BarChart3,
  BookOpen,
  GraduationCap,
  Play,
  Pause,
  Volume2,
  CheckCircle2,
  XCircle,
  CircleDot,
  ScrollText,
  RefreshCw,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { EvaluationEditorTab } from "@/components/evaluation-editor";
import { EvaluationResultsTab } from "@/components/evaluation-analytics";

// ─── Status helpers ──────────────────────────────────────────────────────────

const courseStatusLabels: Record<string, string> = {
  draft: "Borrador",
  published: "Publicado",
  archived: "Archivado",
};

const genStatusConfig: Record<
  GenerationStatus,
  { label: string; variant: "secondary" | "default" | "success" | "destructive"; pulse?: boolean }
> = {
  pending: { label: "Pendiente", variant: "secondary" },
  queued: { label: "En Cola", variant: "secondary", pulse: true },
  generating: { label: "Generando", variant: "default", pulse: true },
  completed: { label: "Completado", variant: "success" },
  failed: { label: "Error", variant: "destructive" },
};

// ─── Audio Player Component ──────────────────────────────────────────────────

function AudioPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
    } else {
      a.play();
    }
    setPlaying(!playing);
  };

  const seek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = Number(e.target.value);
  };

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex items-center gap-3 rounded-lg bg-white/[0.04] p-3">
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime ?? 0)}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
        onEnded={() => setPlaying(false)}
      />
      <button
        type="button"
        onClick={toggle}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-violet-400 hover:bg-violet-500/30 transition-colors"
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
      </button>
      <input
        type="range"
        min={0}
        max={duration || 0}
        value={currentTime}
        onChange={seek}
        className="flex-1 h-1.5 accent-violet-500 cursor-pointer"
      />
      <span className="text-xs text-muted-foreground tabular-nums min-w-[70px] text-right">
        {fmt(currentTime)} / {fmt(duration)}
      </span>
    </div>
  );
}

// ─── Evaluation Quiz Component ───────────────────────────────────────────────

function EvaluationQuiz({
  questions,
  onSubmit,
  moduleId,
}: {
  questions: EvaluationQuestion[];
  onSubmit?: (moduleId: number | string, answers: Array<{ question_index: number; selected: string }>) => Promise<{ score: number; passed: boolean; correct: number; total: number } | null>;
  moduleId?: number | string;
}) {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [serverResult, setServerResult] = useState<{ score: number; passed: boolean; correct: number; total: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const select = (qi: number, oi: number) => {
    if (submitted) return;
    setAnswers((prev) => ({ ...prev, [qi]: oi }));
  };

  const score = questions.reduce(
    (acc, q, i) => acc + (answers[i] === q.correct ? 1 : 0),
    0
  );

  const handleSubmit = async () => {
    setSubmitted(true);
    if (onSubmit && moduleId) {
      setSubmitting(true);
      const formattedAnswers = Object.entries(answers).map(([qi, oi]) => ({
        question_index: parseInt(qi),
        selected: String.fromCharCode(97 + oi), // 0→a, 1→b, 2→c, 3→d
      }));
      const result = await onSubmit(moduleId, formattedAnswers);
      if (result) setServerResult(result);
      setSubmitting(false);
    }
  };

  const reset = () => {
    setAnswers({});
    setSubmitted(false);
    setServerResult(null);
  };

  if (!questions || !Array.isArray(questions) || questions.length === 0) {
    return <p className="text-sm text-muted-foreground">No hay preguntas disponibles.</p>;
  }

  return (
    <div className="space-y-4">
      {questions.map((q, qi) => {
        if (!q || !q.options) return null;
        const selected = answers[qi];
        const isCorrect = submitted && selected === q.correct;
        const isWrong = submitted && selected !== undefined && selected !== q.correct;

        return (
          <div
            key={qi}
            className="rounded-lg bg-white/[0.04] p-4 space-y-3"
          >
            <p className="text-sm font-medium">
              {qi + 1}. {q.question}
            </p>
            <div className="space-y-2">
              {q.options.map((opt, oi) => {
                const isSelected = selected === oi;
                const isTheCorrect = q.correct === oi;
                let ring = "border-white/10";
                if (submitted && isTheCorrect) ring = "border-emerald-500/60 bg-emerald-500/10";
                else if (submitted && isSelected && !isTheCorrect) ring = "border-red-500/60 bg-red-500/10";
                else if (isSelected) ring = "border-violet-500/60 bg-violet-500/10";

                return (
                  <button
                    key={oi}
                    type="button"
                    onClick={() => select(qi, oi)}
                    className={`w-full text-left flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${ring} ${
                      submitted ? "cursor-default" : "hover:border-violet-500/40 cursor-pointer"
                    }`}
                  >
                    {submitted && isTheCorrect && (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    )}
                    {submitted && isSelected && !isTheCorrect && (
                      <XCircle className="h-4 w-4 text-red-400 shrink-0" />
                    )}
                    {!submitted && (
                      <CircleDot
                        className={`h-4 w-4 shrink-0 ${
                          isSelected ? "text-violet-400" : "text-muted-foreground"
                        }`}
                      />
                    )}
                    <span>{opt}</span>
                  </button>
                );
              })}
            </div>
            {submitted && isCorrect && (
              <p className="text-xs text-emerald-400">Correcto</p>
            )}
            {submitted && isWrong && (
              <p className="text-xs text-red-400">
                Incorrecto — la respuesta correcta es: {q.options[q.correct]}
              </p>
            )}
          </div>
        );
      })}

      <div className="flex items-center gap-3 pt-2">
        {!submitted ? (
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!questions.every((q, qi) => !q || !q.options ? true : answers[qi] !== undefined) || submitting}
          >
            {submitting ? "Enviando..." : "Enviar respuestas"}
          </Button>
        ) : (
          <>
            <Badge variant={score === questions.length ? "default" : "secondary"}>
              {score}/{questions.length} correctas
            </Badge>
            {serverResult && (
              <Badge className={serverResult.passed ? "bg-green-600 text-white" : "bg-red-600 text-white"}>
                {serverResult.passed ? "✅ Aprobado" : "❌ Reprobado"} — {serverResult.score.toFixed(0)}%
              </Badge>
            )}
            <Button size="sm" variant="outline" onClick={reset}>
              Reintentar
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Module Card Component ───────────────────────────────────────────────────

function ModuleCard({
  mod,
  isExpanded,
  onToggle,
  locked = false,
  progress,
  onSubmitEvaluation,
  t,
}: {
  mod: BackendModule;
  isExpanded: boolean;
  onToggle: () => void;
  locked?: boolean;
  progress?: { score: number | null; passed: boolean; attempts: number } | null;
  onSubmitEvaluation?: (moduleId: number | string, answers: Array<{ question_index: number; selected: string }>) => Promise<{ score: number; passed: boolean; correct: number; total: number } | null>;
  t: ReturnType<typeof useTranslations>;
}) {
  const [evaluation, setEvaluation] = useState<EvaluationQuestion[] | null>(null);
  const [evalLoading, setEvalLoading] = useState(false);
  const [evalLoaded, setEvalLoaded] = useState(false);
  const [scriptOpen, setScriptOpen] = useState(false);
  // submitting/lastResult managed by EvaluationQuiz component

  const hasContent = !!mod.content_text;
  const hasVideo = !!mod.video_url && !mod.video_url.startsWith("heygen://pending");
  const videoPending = !!mod.video_url && mod.video_url.startsWith("heygen://pending");
  const hasAudio = !!mod.audio_url;
  const status = mod.generation_status || "pending";
  const cfg = genStatusConfig[status] || genStatusConfig["pending"];

  // Poll video status when pending
  useEffect(() => {
    if (!videoPending) return;
    const interval = setInterval(async () => {
      try {
        const res = await api.checkVideoStatus(mod.id);
        if (res.status === "completed" && res.video_url) {
          mod.video_url = res.video_url;
          mod.generation_status = "completed";
          clearInterval(interval);
          // Force re-render
          setEvalLoaded((v) => !v);
          setTimeout(() => setEvalLoaded((v) => !v), 100);
        } else if (res.status === "failed") {
          mod.generation_status = "failed";
          mod.video_url = null;
          clearInterval(interval);
          setEvalLoaded((v) => !v);
          setTimeout(() => setEvalLoaded((v) => !v), 100);
        }
      } catch {
        // ignore polling errors
      }
    }, 10000); // every 10s
    return () => clearInterval(interval);
  }, [videoPending, mod]);

  // Fetch evaluation when expanded for the first time
  useEffect(() => {
    if (isExpanded && !evalLoaded) {
      setEvalLoaded(true);
      setEvalLoading(true);
      api
        .getEvaluations(String(mod.id))
        .then((evals: BackendEvaluation[]) => {
          if (evals && evals.length > 0) {
            // Backend returns `questions` (parsed array) or legacy `questions_json` (string)
            const ev = evals[0];
            let parsed: EvaluationQuestion[] | null = null;
            if (ev.questions && Array.isArray(ev.questions)) {
              parsed = ev.questions;
            } else if (ev.questions_json) {
              try {
                parsed = JSON.parse(ev.questions_json);
              } catch {
                // invalid JSON — ignore
              }
            }
            if (parsed && parsed.length > 0) setEvaluation(parsed);
          }
        })
        .catch(() => {})
        .finally(() => setEvalLoading(false));
    }
  }, [isExpanded, evalLoaded, mod.id]);

  return (
    <Card className="transition-all duration-200 overflow-hidden">
      <button
        type="button"
        className={`w-full text-left ${locked ? "opacity-60 cursor-not-allowed" : ""}`}
        onClick={locked ? undefined : onToggle}
        title={locked ? t("module.mustPassPrevious") : ""}
      >
        <CardContent className="flex items-center gap-4 py-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-400 font-bold">
            {mod.order}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              {hasVideo && <Video className="h-3.5 w-3.5 text-violet-400" />}
              {hasAudio && !hasVideo && <Volume2 className="h-3.5 w-3.5 text-violet-400" />}
              {hasContent && !hasVideo && !hasAudio && (
                <FileText className="h-3.5 w-3.5 text-violet-400" />
              )}
              <span className="text-xs text-muted-foreground">
                Módulo {mod.order}
              </span>
              {locked && <span className="text-xs">🔒</span>}
            </div>
            <h3 className={`font-medium truncate ${locked ? "opacity-50" : ""}`}>{mod.title}</h3>
          </div>

          {/* Progress badge */}
          {progress?.passed && (
            <Badge variant="default" className="bg-green-600 text-white">
              ✅ Aprobado ({progress.score?.toFixed(0)}%)
            </Badge>
          )}
          {progress && !progress.passed && progress.attempts > 0 && (
            <Badge variant="destructive">
              ❌ {progress.score?.toFixed(0)}% (intento {progress.attempts})
            </Badge>
          )}

          {/* Generation status badge */}
          {!locked && (
            <Badge
              variant={cfg.variant}
              className={cfg.pulse ? "animate-pulse" : ""}
            >
              {cfg.label}
            </Badge>
          )}

          <div className="shrink-0 text-muted-foreground">
            {isExpanded ? (
              <ChevronDown className="h-5 w-5" />
            ) : (
              <ChevronRight className="h-5 w-5" />
            )}
          </div>
        </CardContent>
      </button>

      {/* ── Expanded Rich Content ── */}
      {isExpanded && (
        <div className="border-t border-white/[0.08] px-6 py-5 bg-white/[0.02] space-y-5">
          {/* Video Section */}
          {(hasVideo || videoPending) && (
            <section>
              <div className="flex items-center gap-2 mb-2">
                <Video className="h-4 w-4 text-violet-400" />
                  <span className="text-xs font-medium text-violet-400 uppercase tracking-wide">
                  {t("module.video")}
                </span>
              </div>
              {hasVideo ? (
                <video
                  src={mod.video_url!}
                  controls
                  className="w-full max-w-2xl rounded-lg bg-black/40"
                />
              ) : (
                <div className="flex items-center gap-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 px-4 py-3 text-sm text-yellow-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("module.generatingVideo")}
                </div>
              )}
            </section>
          )}

          {/* Audio Section */}
          {hasAudio && (
            <section>
              <div className="flex items-center gap-2 mb-2">
                <Volume2 className="h-4 w-4 text-violet-400" />
                <span className="text-xs font-medium text-violet-400 uppercase tracking-wide">
                  {t("module.narrationAudio")}
                </span>
              </div>
              <AudioPlayer src={mod.audio_url!} />
            </section>
          )}

          {/* Regenerate Buttons (per module) */}
          <section className="flex items-center gap-2 pt-2 border-t border-white/[0.06]">
            <span className="text-xs text-muted-foreground mr-2">{t("module.regenerate")}:</span>
            <Button
              size="sm"
              variant="outline"
              onClick={async (e) => {
                e.stopPropagation();
                try {
                  await api.regenerateModuleAudio(mod.id);
                  alert("Audio en generación. Recarga en unos segundos.");
                } catch { /* background */ }
              }}
              className="text-xs h-7"
            >
              <RefreshCw className="mr-1 h-3 w-3" />
              {t("module.audio")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={async (e) => {
                e.stopPropagation();
                try {
                  await api.regenerateModuleVideo(mod.id);
                  alert("Video en generación. Puede tardar 2-3 minutos.");
                } catch { /* background */ }
              }}
              className="text-xs h-7"
            >
              <RefreshCw className="mr-1 h-3 w-3" />
              {t("module.video")}
            </Button>
          </section>

          {/* Script Section (collapsible) */}
          {hasContent && (
            <section>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setScriptOpen(!scriptOpen);
                }}
                className="flex items-center gap-2 text-xs font-medium text-violet-400 uppercase tracking-wide hover:text-violet-300 transition-colors"
              >
                <ScrollText className="h-4 w-4" />
                {t("module.viewScript")}
                {scriptOpen ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
              </button>
              {scriptOpen && (
                <div className="mt-2 rounded-lg bg-white/[0.04] p-4 text-sm leading-relaxed whitespace-pre-wrap max-h-80 overflow-y-auto">
                  {mod.content_text}
                </div>
              )}
            </section>
          )}

          {/* Evaluation Section */}
          {evalLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("module.loadingEvaluation")}
            </div>
          )}
          {evaluation && evaluation.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <GraduationCap className="h-4 w-4 text-violet-400" />
                <span className="text-xs font-medium text-violet-400 uppercase tracking-wide">
                  {t("module.evaluation")}
                </span>
              </div>
              <EvaluationQuiz questions={evaluation} onSubmit={onSubmitEvaluation} moduleId={mod.id} />
            </section>
          )}

          {/* Empty state */}
          {!hasVideo && !videoPending && !hasAudio && !hasContent && !evaluation && !evalLoading && (
            <p className="text-sm text-muted-foreground">
              {t("module.noContent")}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function CourseDetailPage() {
  const t = useTranslations("adminCourseDetail");
  const params = useParams();
  const id = params.id as string;
  const [course, setCourse] = useState<BackendCourse | null>(null);
  const [modules, setModules] = useState<BackendModule[]>([]);
  const [stats, setStats] = useState<CourseStats | null>(null);
  const [expandedModules, setExpandedModules] = useState<Set<string | number>>(
    new Set()
  );
  const [loading, setLoading] = useState(true);
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const [moduleProgress, setModuleProgress] = useState<Record<any, { score: number | null; passed: boolean; attempts: number }>>({});

  const loadModules = useCallback(() => {
    return api.getModules(id).then(setModules);
  }, [id]);

  useEffect(() => {
    Promise.all([
      api.getCourse(id).then(setCourse),
      loadModules(),
      api.getCourseStats(id).then(setStats),
    ]).finally(() => setLoading(false));
  }, [id, loadModules]);

  const toggleModule = (moduleId: string | number) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) {
        next.delete(moduleId);
      } else {
        next.add(moduleId);
      }
      return next;
    });
  };

  if (loading || !course) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
      </div>
    );
  }

  const sortedModules = [...modules].sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/courses">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{course.title}</h1>
            <Badge
              variant={course.status === "published" ? "success" : "secondary"}
            >
              {courseStatusLabels[course.status] || course.status}
            </Badge>
          </div>
          {course.description && (
            <p className="text-muted-foreground mt-1">{course.description}</p>
          )}
        </div>
      </div>

      <Tabs defaultValue="modules">
        <TabsList>
          <TabsTrigger value="modules">{t("tabs.modules")}</TabsTrigger>
          <TabsTrigger value="evaluations">Evaluaciones</TabsTrigger>
          <TabsTrigger value="results">Resultados</TabsTrigger>
          <TabsTrigger value="details">{t("tabs.details")}</TabsTrigger>
        </TabsList>

        {/* Modules Tab */}
        <TabsContent value="modules">
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h2 className="text-xl font-semibold">
                {t("courseModules", { count: sortedModules.length })}
              </h2>
              <p className="text-sm text-muted-foreground">
                {t("modulesHint")}
              </p>
            </div>

            {sortedModules.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <FileText className="mb-3 h-10 w-10" />
                  <p>{t("noModules")}</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {sortedModules.map((mod) => (
                  <ModuleCard
                    key={mod.id}
                    mod={mod}
                    isExpanded={expandedModules.has(mod.id)}
                    onToggle={() => toggleModule(mod.id)}
                    locked={false} /* Admin always has full access */
                    progress={moduleProgress[mod.id]}
                    t={t}
                    onSubmitEvaluation={async (moduleId, answers) => {
                      try {
                        // For now, use enrollment_id=1 (admin testing)
                        const result = await api.submitEvaluation({
                          enrollment_id: 1,
                          module_id: Number(moduleId),
                          answers,
                        });
                        setModuleProgress((prev) => ({
                          ...prev,
                          [moduleId]: {
                            score: result.score,
                            passed: result.passed,
                            attempts: result.attempts,
                          },
                        }));
                        return result;
                      } catch (err) {
                        console.error("Error submitting evaluation:", err);
                        return null;
                      }
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Details Tab */}
        <TabsContent value="details">
          <Card>
            <CardHeader>
              <CardTitle>{t("details.title")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg bg-white/[0.04] p-3">
                  <span className="text-muted-foreground text-xs">Estado</span>
                  <p className="font-medium mt-1">
                    {courseStatusLabels[course.status] || course.status}
                  </p>
                </div>
                <div className="rounded-lg bg-white/[0.04] p-3">
                  <span className="text-muted-foreground text-xs">
                    {t("details.creationDate")}
                  </span>
                  <p className="font-medium mt-1">
                    {new Date(course.created_at).toLocaleDateString("es-ES", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                </div>
                <div className="rounded-lg bg-white/[0.04] p-3">
                  <span className="text-muted-foreground text-xs">
                    {t("details.totalModules")}
                  </span>
                  <p className="font-medium mt-1">{modules.length}</p>
                </div>
                <div className="rounded-lg bg-white/[0.04] p-3">
                  <span className="text-muted-foreground text-xs">
                    {t("details.createdBy")}
                  </span>
                  <p className="font-medium mt-1">{course.created_by}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Evaluations Editor Tab */}
        <TabsContent value="evaluations">
          <EvaluationEditorTab modules={modules} />
        </TabsContent>

        {/* Results / Analytics Tab */}
        <TabsContent value="results">
          <EvaluationResultsTab courseId={id} stats={stats} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
