/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { api } from "@/lib/api";
import {
  ArrowLeft,
  CheckCircle,
  Lock,
  Play,
  Pause,
  Volume2,
  FileText,
  Video,
  ChevronDown,
  ChevronRight,
  Loader2,
  BookOpen,
  Trophy,
  CircleDot,
  CheckCircle2,
  XCircle,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Lightbulb,
} from "lucide-react";

type ModuleDetail = {
  id: number;
  title: string;
  order: number;
  content_text: string | null;
  video_url: string | null;
  audio_url: string | null;
  can_access: boolean;
  passed: boolean;
  score: number | null;
  attempts: number;
  completed_at: string | null;
};

type CourseData = {
  enrollment_id: number;
  course: { id: number; title: string; description: string };
  progress_pct: number;
  total_modules: number;
  completed_modules: number;
  modules: ModuleDetail[];
};

// ─── Audio Player ────────────────────────────────────────────────────────────
function AudioPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);

  const toggle = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setPlaying(!playing);
  };

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-violet-500/10 border border-violet-500/20">
      <Button size="icon" variant="ghost" onClick={toggle} className="shrink-0">
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </Button>
      <Volume2 className="h-4 w-4 text-violet-400" />
      <span className="text-sm text-muted-foreground">Audio del módulo</span>
      <audio
        ref={audioRef}
        src={src}
        onEnded={() => setPlaying(false)}
      />
    </div>
  );
}

// ─── Question Sub-Components ─────────────────────────────────────────────────

function ScenarioQuestion({
  q,
  qi,
  selected,
  submitted,
  onSelect,
}: {
  q: any;
  qi: number;
  selected: any;
  submitted: boolean;
  onSelect: (qi: number, val: any) => void;
}) {
  return (
    <div className="rounded-lg bg-white/[0.04] p-4 space-y-3">
      <p className="text-sm font-medium">{qi + 1}. {q.question}</p>
      {q.scenario && (
        <div className="rounded-md bg-violet-500/10 border border-violet-500/20 p-3 text-sm text-violet-200 italic">
          {q.scenario}
        </div>
      )}
      <div className="space-y-2">
        {(q.options || []).map((opt: string, oi: number) => {
          const isSelected = selected === oi;
          const isCorrectAnswer = q.correct === oi;
          let ring = "border-white/10";
          if (submitted && isCorrectAnswer)
            ring = "border-green-500/60 bg-green-500/10";
          else if (submitted && isSelected && !isCorrectAnswer)
            ring = "border-red-500/60 bg-red-500/10";
          else if (isSelected)
            ring = "border-violet-500/60 bg-violet-500/10";

          return (
            <button
              key={oi}
              type="button"
              onClick={() => !submitted && onSelect(qi, oi)}
              className={`w-full text-left flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-all ${ring} ${
                submitted ? "cursor-default" : "hover:border-violet-500/40 cursor-pointer"
              }`}
            >
              {submitted && isCorrectAnswer && <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />}
              {submitted && isSelected && !isCorrectAnswer && <XCircle className="h-4 w-4 text-red-400 shrink-0" />}
              {!submitted && (
                <CircleDot className={`h-4 w-4 shrink-0 ${isSelected ? "text-violet-400" : "text-muted-foreground"}`} />
              )}
              <span>{opt}</span>
            </button>
          );
        })}
      </div>
      {submitted && q.explanation && (
        <div className="rounded-md bg-violet-500/5 border border-violet-500/10 p-3 text-sm text-muted-foreground">
          <span className="font-medium text-violet-400">Explicación:</span> {q.explanation}
        </div>
      )}
    </div>
  );
}

function OrderingQuestion({
  q,
  qi,
  selected,
  submitted,
  onSelect,
}: {
  q: any;
  qi: number;
  selected: any;
  submitted: boolean;
  onSelect: (qi: number, val: any) => void;
}) {
  const items: string[] = q.items || [];
  const order: number[] = selected || items.map((_: string, i: number) => i);

  const moveItem = (fromIdx: number, toIdx: number) => {
    if (submitted || toIdx < 0 || toIdx >= order.length) return;
    const newOrder = [...order];
    const [moved] = newOrder.splice(fromIdx, 1);
    newOrder.splice(toIdx, 0, moved);
    onSelect(qi, newOrder);
  };

  const correctOrder: number[] = q.correct_order || [];
  const isItemCorrect = (idx: number) => order[idx] === correctOrder[idx];

  // Drag state
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  return (
    <div className="rounded-lg bg-white/[0.04] p-4 space-y-3">
      <p className="text-sm font-medium">{qi + 1}. {q.question}</p>
      <div className="space-y-2">
        {order.map((itemIdx: number, posIdx: number) => {
          let border = "border-white/10";
          if (submitted) {
            border = isItemCorrect(posIdx)
              ? "border-green-500/60 bg-green-500/10"
              : "border-red-500/60 bg-red-500/10";
          } else if (dragIdx === posIdx) {
            border = "border-violet-500/60 bg-violet-500/10";
          }

          return (
            <div
              key={posIdx}
              draggable={!submitted}
              onDragStart={() => setDragIdx(posIdx)}
              onDragOver={(e) => { e.preventDefault(); }}
              onDrop={() => {
                if (dragIdx !== null && dragIdx !== posIdx) {
                  moveItem(dragIdx, posIdx);
                }
                setDragIdx(null);
              }}
              onDragEnd={() => setDragIdx(null)}
              className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-all ${border} ${
                submitted ? "cursor-default" : "cursor-grab active:cursor-grabbing"
              }`}
            >
              {!submitted && (
                <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
              {submitted && isItemCorrect(posIdx) && <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />}
              {submitted && !isItemCorrect(posIdx) && <XCircle className="h-4 w-4 text-red-400 shrink-0" />}
              <span className="flex-1">{items[itemIdx]}</span>
              {!submitted && (
                <div className="flex flex-col gap-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => moveItem(posIdx, posIdx - 1)}
                    disabled={posIdx === 0}
                    className="p-0.5 rounded hover:bg-white/10 disabled:opacity-30 transition-colors"
                  >
                    <ArrowUp className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveItem(posIdx, posIdx + 1)}
                    disabled={posIdx === order.length - 1}
                    className="p-0.5 rounded hover:bg-white/10 disabled:opacity-30 transition-colors"
                  >
                    <ArrowDown className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const MATCH_COLORS = [
  "bg-violet-500/20 border-violet-500/50",
  "bg-blue-500/20 border-blue-500/50",
  "bg-amber-500/20 border-amber-500/50",
  "bg-emerald-500/20 border-emerald-500/50",
  "bg-pink-500/20 border-pink-500/50",
  "bg-cyan-500/20 border-cyan-500/50",
];

function MatchingQuestion({
  q,
  qi,
  selected,
  submitted,
  onSelect,
}: {
  q: any;
  qi: number;
  selected: any;
  submitted: boolean;
  onSelect: (qi: number, val: any) => void;
}) {
  const pairs: Array<{ left: string; right: string }> = q.pairs || [];
  // selected = Array<{ left: string; right: string }> of user-matched pairs
  const matches: Array<{ left: string; right: string }> = selected || [];
  const [activeLeft, setActiveLeft] = useState<string | null>(null);

  // Shuffled right column (stable via useMemo-like approach using state)
  const [shuffledRight] = useState<string[]>(() => {
    const rights = pairs.map((p) => p.right);
    // Fisher-Yates shuffle
    for (let i = rights.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rights[i], rights[j]] = [rights[j], rights[i]];
    }
    return rights;
  });

  const getMatchIdx = (left: string) => matches.findIndex((m) => m.left === left);
  const getRightMatchIdx = (right: string) => matches.findIndex((m) => m.right === right);

  const handleLeftClick = (left: string) => {
    if (submitted) return;
    // If already matched, unmatch
    const existingIdx = getMatchIdx(left);
    if (existingIdx >= 0) {
      const newMatches = matches.filter((_, i) => i !== existingIdx);
      onSelect(qi, newMatches);
      setActiveLeft(null);
      return;
    }
    setActiveLeft(left);
  };

  const handleRightClick = (right: string) => {
    if (submitted || !activeLeft) return;
    // Remove any existing match for this right
    const newMatches = matches.filter((m) => m.right !== right && m.left !== activeLeft);
    newMatches.push({ left: activeLeft, right });
    onSelect(qi, newMatches);
    setActiveLeft(null);
  };

  const isCorrectMatch = (left: string, right: string) => {
    return pairs.some((p) => p.left === left && p.right === right);
  };

  return (
    <div className="rounded-lg bg-white/[0.04] p-4 space-y-3">
      <p className="text-sm font-medium">{qi + 1}. {q.question}</p>
      <div className="grid grid-cols-2 gap-3">
        {/* Left column */}
        <div className="space-y-2">
          {pairs.map((p, idx) => {
            const matchIdx = getMatchIdx(p.left);
            const isActive = activeLeft === p.left;
            const isMatched = matchIdx >= 0;
            let style = "border-white/10";
            if (submitted && isMatched) {
              style = isCorrectMatch(matches[matchIdx].left, matches[matchIdx].right)
                ? "border-green-500/60 bg-green-500/10"
                : "border-red-500/60 bg-red-500/10";
            } else if (isActive) {
              style = "border-violet-500/60 bg-violet-500/10 ring-1 ring-violet-500/40";
            } else if (isMatched) {
              style = MATCH_COLORS[matchIdx % MATCH_COLORS.length];
            }
            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleLeftClick(p.left)}
                className={`w-full text-left rounded-md border px-3 py-2 text-sm transition-all ${style} ${
                  submitted ? "cursor-default" : "hover:border-violet-500/40 cursor-pointer"
                }`}
              >
                {submitted && isMatched && isCorrectMatch(matches[matchIdx].left, matches[matchIdx].right) && (
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-400 inline mr-1.5" />
                )}
                {submitted && isMatched && !isCorrectMatch(matches[matchIdx].left, matches[matchIdx].right) && (
                  <XCircle className="h-3.5 w-3.5 text-red-400 inline mr-1.5" />
                )}
                {p.left}
              </button>
            );
          })}
        </div>
        {/* Right column */}
        <div className="space-y-2">
          {shuffledRight.map((right, idx) => {
            const matchIdx = getRightMatchIdx(right);
            const isMatched = matchIdx >= 0;
            let style = "border-white/10";
            if (submitted && isMatched) {
              style = isCorrectMatch(matches[matchIdx].left, matches[matchIdx].right)
                ? "border-green-500/60 bg-green-500/10"
                : "border-red-500/60 bg-red-500/10";
            } else if (isMatched) {
              style = MATCH_COLORS[matchIdx % MATCH_COLORS.length];
            }
            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleRightClick(right)}
                className={`w-full text-left rounded-md border px-3 py-2 text-sm transition-all ${style} ${
                  submitted ? "cursor-default" : activeLeft ? "hover:border-violet-500/40 cursor-pointer" : "cursor-default opacity-70"
                }`}
              >
                {right}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function FillBlankQuestion({
  q,
  qi,
  selected,
  submitted,
  onSelect,
}: {
  q: any;
  qi: number;
  selected: any;
  submitted: boolean;
  onSelect: (qi: number, val: any) => void;
}) {
  const [showHint, setShowHint] = useState(false);
  const value = typeof selected === "string" ? selected : "";

  // Split question at _____ to render inline input
  const parts = (q.question || "").split("_____");
  const isCorrect = submitted && q.answer &&
    value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") ===
    q.answer.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  return (
    <div className="rounded-lg bg-white/[0.04] p-4 space-y-3">
      <p className="text-sm font-medium">{qi + 1}. Completa la frase:</p>
      <div className="text-sm leading-relaxed flex flex-wrap items-center gap-1">
        {parts.length > 1 ? (
          <>
            <span>{parts[0]}</span>
            <input
              type="text"
              value={value}
              onChange={(e) => !submitted && onSelect(qi, e.target.value)}
              disabled={submitted}
              placeholder="..."
              className={`inline-block w-40 px-2 py-1 rounded-md border text-sm bg-transparent transition-all outline-none ${
                submitted
                  ? isCorrect
                    ? "border-green-500/60 bg-green-500/10 text-green-300"
                    : "border-red-500/60 bg-red-500/10 text-red-300"
                  : "border-violet-500/40 focus:border-violet-500 focus:ring-1 focus:ring-violet-500/40"
              }`}
            />
            <span>{parts[1]}</span>
          </>
        ) : (
          <>
            <span>{q.question}</span>
            <input
              type="text"
              value={value}
              onChange={(e) => !submitted && onSelect(qi, e.target.value)}
              disabled={submitted}
              placeholder="Tu respuesta..."
              className={`block w-full mt-2 px-3 py-2 rounded-md border text-sm bg-transparent transition-all outline-none ${
                submitted
                  ? isCorrect
                    ? "border-green-500/60 bg-green-500/10 text-green-300"
                    : "border-red-500/60 bg-red-500/10 text-red-300"
                  : "border-violet-500/40 focus:border-violet-500 focus:ring-1 focus:ring-violet-500/40"
              }`}
            />
          </>
        )}
      </div>
      <div className="flex items-center gap-2">
        {!submitted && q.hint && (
          <button
            type="button"
            onClick={() => setShowHint(!showHint)}
            className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 transition-colors"
          >
            <Lightbulb className="h-3.5 w-3.5" />
            Pista
          </button>
        )}
        {showHint && !submitted && q.hint && (
          <span className="text-xs text-muted-foreground italic">{q.hint}</span>
        )}
      </div>
      {submitted && !isCorrect && (
        <p className="text-xs text-muted-foreground">
          Respuesta correcta: <span className="text-green-400 font-medium">{q.answer}</span>
        </p>
      )}
    </div>
  );
}

function TrueFalseQuestion({
  q,
  qi,
  selected,
  submitted,
  onSelect,
}: {
  q: any;
  qi: number;
  selected: any;
  submitted: boolean;
  onSelect: (qi: number, val: any) => void;
}) {
  const chosen = typeof selected === "boolean" ? selected : null;
  const correctVal = q.correct;

  const btnClass = (val: boolean) => {
    const isChosen = chosen === val;
    const isCorrectAnswer = val === correctVal;
    let style = "border-white/10";
    if (submitted && isCorrectAnswer) {
      style = "border-green-500/60 bg-green-500/10";
    } else if (submitted && isChosen && !isCorrectAnswer) {
      style = "border-red-500/60 bg-red-500/10";
    } else if (isChosen) {
      style = "border-violet-500/60 bg-violet-500/10";
    }
    return style;
  };

  return (
    <div className="rounded-lg bg-white/[0.04] p-4 space-y-3">
      <p className="text-sm font-medium">{qi + 1}. Verdadero o Falso:</p>
      <p className="text-sm text-muted-foreground italic">&quot;{q.statement}&quot;</p>
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => !submitted && onSelect(qi, true)}
          className={`flex items-center justify-center gap-2 rounded-md border px-4 py-3 text-sm font-medium transition-all ${btnClass(true)} ${
            submitted ? "cursor-default" : "hover:border-violet-500/40 cursor-pointer"
          }`}
        >
          {submitted && true === correctVal && <CheckCircle2 className="h-4 w-4 text-green-400" />}
          {submitted && chosen === true && true !== correctVal && <XCircle className="h-4 w-4 text-red-400" />}
          Verdadero
        </button>
        <button
          type="button"
          onClick={() => !submitted && onSelect(qi, false)}
          className={`flex items-center justify-center gap-2 rounded-md border px-4 py-3 text-sm font-medium transition-all ${btnClass(false)} ${
            submitted ? "cursor-default" : "hover:border-violet-500/40 cursor-pointer"
          }`}
        >
          {submitted && false === correctVal && <CheckCircle2 className="h-4 w-4 text-green-400" />}
          {submitted && chosen === false && false !== correctVal && <XCircle className="h-4 w-4 text-red-400" />}
          Falso
        </button>
      </div>
      {submitted && q.explanation && (
        <div className="rounded-md bg-violet-500/5 border border-violet-500/10 p-3 text-sm text-muted-foreground">
          <span className="font-medium text-violet-400">Explicación:</span> {q.explanation}
        </div>
      )}
    </div>
  );
}

// ─── Quiz Component ──────────────────────────────────────────────────────────
function ModuleQuiz({
  moduleId,
  enrollmentId,
  onResult,
}: {
  moduleId: number;
  enrollmentId: number;
  onResult: (passed: boolean) => void;
}) {
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Record<number, any>>({});
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<{
    score: number;
    passed: boolean;
    correct: number;
    total: number;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api
      .getEvaluations(moduleId)
      .then((evals: any[]) => {
        if (evals.length > 0 && evals[0].questions) {
          const qs = evals[0].questions;
          setQuestions(qs);
          // Initialize ordering answers with default index order
          const initial: Record<number, any> = {};
          qs.forEach((q: any, i: number) => {
            if (q.type === "ordering" && q.items) {
              initial[i] = q.items.map((_: string, idx: number) => idx);
            }
          });
          if (Object.keys(initial).length > 0) {
            setAnswers(initial);
          }
        }
      })
      .finally(() => setLoading(false));
  }, [moduleId]);

  const setAnswer = (qi: number, val: any) => {
    if (submitted) return;
    setAnswers((prev) => ({ ...prev, [qi]: val }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    const formattedAnswers = questions.map((q: any, qi: number) => {
      const qType = q.type || "multiple_choice";
      const raw = answers[qi];

      if (qType === "scenario" || qType === "multiple_choice") {
        // Send the index number directly (backend compares as string)
        return { question_index: qi, selected: typeof raw === "number" ? raw : "" };
      }
      if (qType === "ordering") {
        return { question_index: qi, selected: raw || [] };
      }
      if (qType === "matching") {
        return { question_index: qi, selected: raw || [] };
      }
      if (qType === "fill_blank") {
        return { question_index: qi, selected: typeof raw === "string" ? raw : "" };
      }
      if (qType === "true_false") {
        return { question_index: qi, selected: typeof raw === "boolean" ? raw : "" };
      }
      // Legacy fallback
      return { question_index: qi, selected: typeof raw === "number" ? String.fromCharCode(97 + raw) : (raw ?? "") };
    });
    try {
      const res = await api.submitEvaluation({
        enrollment_id: enrollmentId,
        module_id: moduleId,
        answers: formattedAnswers,
      });
      setResult(res);
      setSubmitted(true);
      onResult(res.passed);
    } catch (err) {
      console.error("Error submitting:", err);
    }
    setSubmitting(false);
  };

  const reset = () => {
    const initial: Record<number, any> = {};
    questions.forEach((q: any, i: number) => {
      if (q.type === "ordering" && q.items) {
        initial[i] = q.items.map((_: string, idx: number) => idx);
      }
    });
    setAnswers(initial);
    setSubmitted(false);
    setResult(null);
  };

  // Check if all questions are answered
  const allAnswered = questions.every((q: any, qi: number) => {
    const qType = q.type || "multiple_choice";
    const val = answers[qi];
    if (qType === "scenario" || qType === "multiple_choice") return typeof val === "number";
    if (qType === "ordering") return Array.isArray(val);
    if (qType === "matching") return Array.isArray(val) && val.length === (q.pairs || []).length;
    if (qType === "fill_blank") return typeof val === "string" && val.trim().length > 0;
    if (qType === "true_false") return typeof val === "boolean";
    return val !== undefined;
  });

  if (loading) return <Loader2 className="h-5 w-5 animate-spin text-violet-400" />;
  if (questions.length === 0) return <p className="text-sm text-muted-foreground">No hay evaluación para este módulo.</p>;

  return (
    <div className="space-y-4">
      <h4 className="font-semibold flex items-center gap-2">
        <BookOpen className="h-4 w-4 text-violet-400" />
        Evaluación del Módulo
      </h4>
      {questions.map((q: any, qi: number) => {
        const qType = q.type || "multiple_choice";

        if (qType === "scenario") {
          return <ScenarioQuestion key={qi} q={q} qi={qi} selected={answers[qi]} submitted={submitted} onSelect={setAnswer} />;
        }
        if (qType === "ordering") {
          return <OrderingQuestion key={qi} q={q} qi={qi} selected={answers[qi]} submitted={submitted} onSelect={setAnswer} />;
        }
        if (qType === "matching") {
          return <MatchingQuestion key={qi} q={q} qi={qi} selected={answers[qi]} submitted={submitted} onSelect={setAnswer} />;
        }
        if (qType === "fill_blank") {
          return <FillBlankQuestion key={qi} q={q} qi={qi} selected={answers[qi]} submitted={submitted} onSelect={setAnswer} />;
        }
        if (qType === "true_false") {
          return <TrueFalseQuestion key={qi} q={q} qi={qi} selected={answers[qi]} submitted={submitted} onSelect={setAnswer} />;
        }
        // Legacy multiple_choice fallback
        return (
          <ScenarioQuestion key={qi} q={q} qi={qi} selected={answers[qi]} submitted={submitted} onSelect={setAnswer} />
        );
      })}

      <div className="flex items-center gap-3 pt-2">
        {!submitted ? (
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!allAnswered || submitting}
          >
            {submitting ? "Enviando..." : "Enviar Respuestas"}
          </Button>
        ) : (
          <>
            {result && (
              <Badge className={result.passed ? "bg-green-600 text-white" : "bg-red-600 text-white"}>
                {result.passed ? "Aprobado" : "Reprobado"} — {result.score.toFixed(0)}%
                ({result.correct}/{result.total})
              </Badge>
            )}
            {result && !result.passed && (
              <Button size="sm" variant="outline" onClick={reset}>
                Reintentar
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Module Accordion ────────────────────────────────────────────────────────
function CollaboratorModule({
  mod,
  enrollmentId,
  onModulePassed,
}: {
  mod: ModuleDetail;
  enrollmentId: number;
  onModulePassed: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const hasVideo = mod.video_url && !mod.video_url.startsWith("heygen://");
  const hasAudio = !!mod.audio_url;

  return (
    <Card className={`transition-all ${!mod.can_access ? "opacity-50" : ""}`}>
      <button
        type="button"
        className={`w-full text-left ${!mod.can_access ? "cursor-not-allowed" : ""}`}
        onClick={mod.can_access ? () => setExpanded(!expanded) : undefined}
        title={!mod.can_access ? "Debes aprobar el módulo anterior" : ""}
      >
        <CardContent className="flex items-center gap-4 py-4">
          {/* Module icon */}
          <div className="shrink-0">
            {!mod.can_access ? (
              <Lock className="h-5 w-5 text-muted-foreground" />
            ) : mod.passed ? (
              <CheckCircle className="h-5 w-5 text-green-400" />
            ) : (
              <div className="h-5 w-5 rounded-full border-2 border-violet-400 flex items-center justify-center text-xs font-bold text-violet-400">
                {mod.order}
              </div>
            )}
          </div>

          {/* Title */}
          <div className="flex-1 min-w-0">
            <span className="text-xs text-muted-foreground">Módulo {mod.order}</span>
            <h3 className="font-medium truncate">{mod.title}</h3>
          </div>

          {/* Status badges */}
          {mod.passed && (
            <Badge className="bg-green-600 text-white">✅ {mod.score?.toFixed(0)}%</Badge>
          )}
          {!mod.passed && mod.attempts > 0 && mod.can_access && (
            <Badge variant="destructive">❌ {mod.score?.toFixed(0)}% (intento {mod.attempts})</Badge>
          )}
          {!mod.can_access && (
            <Badge variant="secondary">🔒 Bloqueado</Badge>
          )}

          {mod.can_access && (
            <div className="shrink-0 text-muted-foreground">
              {expanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
            </div>
          )}
        </CardContent>
      </button>

      {/* Expanded content */}
      {expanded && mod.can_access && (
        <div className="border-t border-white/[0.08] px-6 py-5 space-y-5">
          {/* Video */}
          {hasVideo && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Video className="h-4 w-4 text-violet-400" /> Video
              </h4>
              <video
                controls
                className="w-full rounded-lg max-h-[400px] bg-black"
                src={mod.video_url || ""}
              >
                Tu navegador no soporta video.
              </video>
            </div>
          )}

          {/* Audio */}
          {hasAudio && !hasVideo && (
            <AudioPlayer src={mod.audio_url || ""} />
          )}

          {/* Content */}
          {mod.content_text && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <FileText className="h-4 w-4 text-violet-400" /> Contenido
              </h4>
              <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap max-h-[300px] overflow-y-auto rounded-lg bg-white/[0.02] p-4">
                {mod.content_text}
              </div>
            </div>
          )}

          {/* Evaluation */}
          {!mod.passed && (
            <div className="border-t border-white/[0.08] pt-4">
              <ModuleQuiz
                moduleId={mod.id}
                enrollmentId={enrollmentId}
                onResult={(passed) => {
                  if (passed) onModulePassed();
                }}
              />
            </div>
          )}

          {mod.passed && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
              <CheckCircle className="h-5 w-5 text-green-400" />
              <span className="text-sm text-green-400 font-medium">
                Módulo aprobado con {mod.score?.toFixed(0)}%
              </span>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function CollaboratorCourseDetailPage() {
  const params = useParams();
  const courseId = params.id as string;
  const [data, setData] = useState<CourseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = () => {
    api
      .myCourseDetail(courseId)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 space-y-4">
        <p className="text-red-400">Error: {error}</p>
        <Link href="/courses">
          <Button variant="outline">← Volver a Mis Cursos</Button>
        </Link>
      </div>
    );
  }

  if (!data) return null;

  const isCompleted = data.progress_pct >= 100;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link href="/courses">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{data.course.title}</h1>
          {data.course.description && (
            <p className="text-muted-foreground mt-1">{data.course.description}</p>
          )}
        </div>
      </div>

      {/* Progress Card */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Progreso del Curso</span>
            <span className="text-sm font-bold text-violet-400">
              {data.progress_pct.toFixed(0)}%
            </span>
          </div>
          <Progress value={data.progress_pct} className="h-3" />
          <p className="text-xs text-muted-foreground mt-2">
            {data.completed_modules}/{data.total_modules} módulos aprobados
          </p>
        </CardContent>
      </Card>

      {/* Completion Badge */}
      {isCompleted && (
        <Card className="border-green-500/40 bg-green-500/5">
          <CardContent className="py-6 text-center space-y-2">
            <Trophy className="h-12 w-12 text-yellow-400 mx-auto" />
            <h3 className="text-lg font-bold text-green-400">¡Curso Completado!</h3>
            <p className="text-sm text-muted-foreground">
              Has aprobado todos los módulos exitosamente.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Modules */}
      <div className="space-y-3">
        {data.modules.map((mod) => (
          <CollaboratorModule
            key={mod.id}
            mod={mod}
            enrollmentId={data.enrollment_id}
            onModulePassed={loadData}
          />
        ))}
      </div>
    </div>
  );
}
