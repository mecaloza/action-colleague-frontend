"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { api } from "@/lib/api";
import {
  BackendModule,
  EvaluationQuestionFull,
  QuestionType,
  Evaluation,
} from "@/lib/types";
import {
  Plus,
  Trash2,
  Save,
  Loader2,
  GraduationCap,
  ChevronDown,
  ChevronRight,
  AlertCircle,
} from "lucide-react";

// ─── Constants ───────────────────────────────────────────────────────────────

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  multiple_choice: "Opción múltiple",
  true_false: "Verdadero / Falso",
  ordering: "Ordenamiento",
  matching: "Emparejamiento",
  fill_blank: "Completar frase",
  scenario: "Escenario",
};

function emptyQuestion(type: QuestionType = "multiple_choice"): EvaluationQuestionFull {
  const base: EvaluationQuestionFull = { type, question: "" };
  switch (type) {
    case "multiple_choice":
      return { ...base, options: ["", ""], correct: 0 };
    case "true_false":
      return { ...base, statement: "", correct: 0 };
    case "ordering":
      return { ...base, items: ["", ""], correct_order: [0, 1] };
    case "matching":
      return { ...base, pairs: [{ left: "", right: "" }] };
    case "fill_blank":
      return { ...base, answer: "", hint: "" };
    case "scenario":
      return { ...base, scenario: "", options: ["", ""], correct: 0, explanation: "" };
  }
}

// ─── Question Editor ─────────────────────────────────────────────────────────

function QuestionEditor({
  question,
  index,
  onChange,
  onDelete,
}: {
  question: EvaluationQuestionFull;
  index: number;
  onChange: (q: EvaluationQuestionFull) => void;
  onDelete: () => void;
}) {
  const update = (patch: Partial<EvaluationQuestionFull>) =>
    onChange({ ...question, ...patch });

  const changeType = (newType: QuestionType) => {
    onChange({ ...emptyQuestion(newType), question: question.question });
  };

  return (
    <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-bold text-violet-400">P{index + 1}</span>
        <Select
          value={question.type}
          onChange={(e) => changeType(e.target.value as QuestionType)}
          className="w-48 h-8 text-xs"
        >
          {Object.entries(QUESTION_TYPE_LABELS).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </Select>
        <div className="flex-1" />
        <Button size="sm" variant="ghost" onClick={onDelete} className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-7 px-2">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Question text (all types) */}
      <div>
        <Label className="text-xs text-muted-foreground">
          {question.type === "fill_blank" ? "Frase (usa _____ para el espacio)" : "Pregunta"}
        </Label>
        <Input
          value={question.question}
          onChange={(e) => update({ question: e.target.value })}
          placeholder={question.type === "fill_blank" ? "La capital de Francia es _____" : "Escribe la pregunta..."}
          className="mt-1 h-8 text-sm"
        />
      </div>

      {/* Type-specific fields */}
      {(question.type === "multiple_choice" || question.type === "scenario") && (
        <MultipleChoiceFields question={question} onChange={update} />
      )}
      {question.type === "true_false" && (
        <TrueFalseFields question={question} onChange={update} />
      )}
      {question.type === "ordering" && (
        <OrderingFields question={question} onChange={update} />
      )}
      {question.type === "matching" && (
        <MatchingFields question={question} onChange={update} />
      )}
      {question.type === "fill_blank" && (
        <FillBlankFields question={question} onChange={update} />
      )}
      {question.type === "scenario" && (
        <ScenarioExtraFields question={question} onChange={update} />
      )}
    </div>
  );
}

// ─── Type-specific field components ──────────────────────────────────────────

function MultipleChoiceFields({
  question,
  onChange,
}: {
  question: EvaluationQuestionFull;
  onChange: (patch: Partial<EvaluationQuestionFull>) => void;
}) {
  const options = question.options || ["", ""];
  const setOption = (idx: number, val: string) => {
    const next = [...options];
    next[idx] = val;
    onChange({ options: next });
  };
  const addOption = () => onChange({ options: [...options, ""] });
  const removeOption = (idx: number) => {
    const next = options.filter((_, i) => i !== idx);
    const correct = question.correct ?? 0;
    onChange({ options: next, correct: correct >= next.length ? 0 : correct });
  };

  return (
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground">Opciones (marca la correcta)</Label>
      {options.map((opt, i) => (
        <div key={i} className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onChange({ correct: i })}
            className={`h-5 w-5 rounded-full border-2 shrink-0 transition-colors ${
              question.correct === i
                ? "border-emerald-500 bg-emerald-500"
                : "border-white/20 hover:border-violet-400"
            }`}
          />
          <Input
            value={opt}
            onChange={(e) => setOption(i, e.target.value)}
            placeholder={`Opción ${i + 1}`}
            className="h-8 text-sm flex-1"
          />
          {options.length > 2 && (
            <Button size="sm" variant="ghost" onClick={() => removeOption(i)} className="h-7 px-1.5 text-muted-foreground hover:text-red-400">
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      ))}
      {options.length < 6 && (
        <Button size="sm" variant="ghost" onClick={addOption} className="text-xs text-violet-400 h-7">
          <Plus className="h-3 w-3 mr-1" /> Agregar opción
        </Button>
      )}
    </div>
  );
}

function TrueFalseFields({
  question,
  onChange,
}: {
  question: EvaluationQuestionFull;
  onChange: (patch: Partial<EvaluationQuestionFull>) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs text-muted-foreground">Afirmación</Label>
        <Input
          value={question.statement || ""}
          onChange={(e) => onChange({ statement: e.target.value })}
          placeholder="Escribe la afirmación..."
          className="mt-1 h-8 text-sm"
        />
      </div>
      <div>
        <Label className="text-xs text-muted-foreground">Respuesta correcta</Label>
        <div className="flex gap-3 mt-1">
          {[
            { val: true, label: "Verdadero" },
            { val: false, label: "Falso" },
          ].map(({ val, label }) => (
            <button
              key={label}
              type="button"
              onClick={() => onChange({ correct: val ? 1 : 0 })}
              className={`px-4 py-1.5 rounded-md border text-sm transition-colors ${
                (question.correct === 1) === val
                  ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-400"
                  : "border-white/10 hover:border-violet-400"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function OrderingFields({
  question,
  onChange,
}: {
  question: EvaluationQuestionFull;
  onChange: (patch: Partial<EvaluationQuestionFull>) => void;
}) {
  const items = question.items || ["", ""];
  const setItem = (idx: number, val: string) => {
    const next = [...items];
    next[idx] = val;
    onChange({ items: next, correct_order: next.map((_, i) => i) });
  };
  const addItem = () => {
    const next = [...items, ""];
    onChange({ items: next, correct_order: next.map((_, i) => i) });
  };
  const removeItem = (idx: number) => {
    const next = items.filter((_, i) => i !== idx);
    onChange({ items: next, correct_order: next.map((_, i) => i) });
  };

  return (
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground">
        Items (en el orden correcto, se mezclarán al presentar)
      </Label>
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-5 text-right shrink-0">{i + 1}.</span>
          <Input
            value={item}
            onChange={(e) => setItem(i, e.target.value)}
            placeholder={`Item ${i + 1}`}
            className="h-8 text-sm flex-1"
          />
          {items.length > 2 && (
            <Button size="sm" variant="ghost" onClick={() => removeItem(i)} className="h-7 px-1.5 text-muted-foreground hover:text-red-400">
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      ))}
      {items.length < 8 && (
        <Button size="sm" variant="ghost" onClick={addItem} className="text-xs text-violet-400 h-7">
          <Plus className="h-3 w-3 mr-1" /> Agregar item
        </Button>
      )}
    </div>
  );
}

function MatchingFields({
  question,
  onChange,
}: {
  question: EvaluationQuestionFull;
  onChange: (patch: Partial<EvaluationQuestionFull>) => void;
}) {
  const pairs = question.pairs || [{ left: "", right: "" }];
  const setPair = (idx: number, side: "left" | "right", val: string) => {
    const next = pairs.map((p, i) => (i === idx ? { ...p, [side]: val } : p));
    onChange({ pairs: next });
  };
  const addPair = () => onChange({ pairs: [...pairs, { left: "", right: "" }] });
  const removePair = (idx: number) => onChange({ pairs: pairs.filter((_, i) => i !== idx) });

  return (
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground">Pares (izquierda ↔ derecha)</Label>
      {pairs.map((pair, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            value={pair.left}
            onChange={(e) => setPair(i, "left", e.target.value)}
            placeholder="Izquierda"
            className="h-8 text-sm flex-1"
          />
          <span className="text-muted-foreground text-xs">↔</span>
          <Input
            value={pair.right}
            onChange={(e) => setPair(i, "right", e.target.value)}
            placeholder="Derecha"
            className="h-8 text-sm flex-1"
          />
          {pairs.length > 1 && (
            <Button size="sm" variant="ghost" onClick={() => removePair(i)} className="h-7 px-1.5 text-muted-foreground hover:text-red-400">
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      ))}
      {pairs.length < 8 && (
        <Button size="sm" variant="ghost" onClick={addPair} className="text-xs text-violet-400 h-7">
          <Plus className="h-3 w-3 mr-1" /> Agregar par
        </Button>
      )}
    </div>
  );
}

function FillBlankFields({
  question,
  onChange,
}: {
  question: EvaluationQuestionFull;
  onChange: (patch: Partial<EvaluationQuestionFull>) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs text-muted-foreground">Respuesta correcta</Label>
        <Input
          value={question.answer || ""}
          onChange={(e) => onChange({ answer: e.target.value })}
          placeholder="Respuesta esperada"
          className="mt-1 h-8 text-sm"
        />
      </div>
      <div>
        <Label className="text-xs text-muted-foreground">Pista (opcional)</Label>
        <Input
          value={question.hint || ""}
          onChange={(e) => onChange({ hint: e.target.value })}
          placeholder="Pista para el estudiante"
          className="mt-1 h-8 text-sm"
        />
      </div>
    </div>
  );
}

function ScenarioExtraFields({
  question,
  onChange,
}: {
  question: EvaluationQuestionFull;
  onChange: (patch: Partial<EvaluationQuestionFull>) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs text-muted-foreground">Escenario / Contexto</Label>
        <Textarea
          value={question.scenario || ""}
          onChange={(e) => onChange({ scenario: e.target.value })}
          placeholder="Describe el escenario..."
          className="mt-1 text-sm min-h-[60px]"
        />
      </div>
      <div>
        <Label className="text-xs text-muted-foreground">Explicación (mostrada después de responder)</Label>
        <Input
          value={question.explanation || ""}
          onChange={(e) => onChange({ explanation: e.target.value })}
          placeholder="Explicación de la respuesta correcta"
          className="mt-1 h-8 text-sm"
        />
      </div>
    </div>
  );
}

// ─── Module Evaluation Card ──────────────────────────────────────────────────

function ModuleEvaluationCard({ mod }: { mod: BackendModule }) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [evalId, setEvalId] = useState<number | string | null>(null);
  const [questions, setQuestions] = useState<EvaluationQuestionFull[]>([]);
  const [maxAttempts, setMaxAttempts] = useState<number>(3);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const loadEvaluation = useCallback(async () => {
    if (loaded) return;
    setLoading(true);
    try {
      const evals = await api.getEvaluations(String(mod.id));
      if (evals && evals.length > 0) {
        const ev = evals[0];
        setEvalId(ev.id);
        let parsed: EvaluationQuestionFull[] = [];
        if (ev.questions && Array.isArray(ev.questions)) {
          parsed = ev.questions;
        } else if (ev.questions_json) {
          try { parsed = JSON.parse(ev.questions_json); } catch { /* ignore */ }
        }
        setQuestions(parsed);
        if (ev.max_attempts) setMaxAttempts(ev.max_attempts);
      }
    } catch {
      // no evaluation yet
    }
    setLoaded(true);
    setLoading(false);
  }, [mod.id, loaded]);

  useEffect(() => {
    if (expanded && !loaded) loadEvaluation();
  }, [expanded, loaded, loadEvaluation]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      if (evalId) {
        await api.updateEvaluation(evalId, { questions, max_attempts: maxAttempts });
      } else {
        const created = await api.createEvaluation({
          module_id: Number(mod.id),
          questions,
          max_attempts: maxAttempts,
        });
        setEvalId(created.id);
      }
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || "Error al guardar");
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!evalId || !confirm("¿Eliminar toda la evaluación de este módulo?")) return;
    try {
      await api.deleteEvaluation(evalId);
      setEvalId(null);
      setQuestions([]);
      setMaxAttempts(3);
    } catch (err: any) {
      setError(err.message || "Error al eliminar");
    }
  };

  const addQuestion = () => {
    setQuestions([...questions, emptyQuestion("multiple_choice")]);
  };

  const updateQuestion = (idx: number, q: EvaluationQuestionFull) => {
    setQuestions(questions.map((old, i) => (i === idx ? q : old)));
  };

  const deleteQuestion = (idx: number) => {
    setQuestions(questions.filter((_, i) => i !== idx));
  };

  return (
    <Card>
      <button
        type="button"
        className="w-full text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <CardContent className="flex items-center gap-4 py-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-400 font-bold">
            {mod.order}
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-xs text-muted-foreground">Módulo {mod.order}</span>
            <h3 className="font-medium truncate">{mod.title}</h3>
          </div>
          {loaded && (
            <Badge variant={questions.length > 0 ? "default" : "secondary"}>
              {questions.length > 0 ? `${questions.length} preguntas` : "Sin evaluación"}
            </Badge>
          )}
          <div className="shrink-0 text-muted-foreground">
            {expanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
          </div>
        </CardContent>
      </button>

      {expanded && (
        <div className="border-t border-white/[0.08] px-6 py-5 space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando evaluación...
            </div>
          ) : (
            <>
              {/* Max attempts */}
              <div className="flex items-center gap-3">
                <Label className="text-sm">Intentos máximos:</Label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={maxAttempts}
                  onChange={(e) => setMaxAttempts(parseInt(e.target.value) || 3)}
                  className="w-20 h-8 text-sm"
                />
              </div>

              {/* Questions list */}
              {questions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <GraduationCap className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No hay preguntas. Agrega una para crear la evaluación.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {questions.map((q, i) => (
                    <QuestionEditor
                      key={i}
                      question={q}
                      index={i}
                      onChange={(updated) => updateQuestion(i, updated)}
                      onDelete={() => deleteQuestion(i)}
                    />
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-3 pt-2 border-t border-white/[0.06]">
                <Button size="sm" variant="outline" onClick={addQuestion} className="text-xs">
                  <Plus className="h-3.5 w-3.5 mr-1" /> Agregar pregunta
                </Button>
                <div className="flex-1" />
                {evalId && (
                  <Button size="sm" variant="ghost" onClick={handleDelete} className="text-red-400 hover:text-red-300 text-xs">
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Eliminar evaluación
                  </Button>
                )}
                <Button size="sm" onClick={handleSave} disabled={saving || questions.length === 0}>
                  {saving ? (
                    <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Guardando...</>
                  ) : (
                    <><Save className="h-3.5 w-3.5 mr-1" /> {evalId ? "Actualizar" : "Crear evaluación"}</>
                  )}
                </Button>
              </div>

              {/* Feedback */}
              {error && (
                <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">
                  <AlertCircle className="h-4 w-4 shrink-0" /> {error}
                </div>
              )}
              {success && (
                <div className="text-sm text-emerald-400 bg-emerald-500/10 rounded-lg px-3 py-2">
                  Evaluación guardada correctamente.
                </div>
              )}
            </>
          )}
        </div>
      )}
    </Card>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export function EvaluationEditorTab({ modules }: { modules: BackendModule[] }) {
  const sorted = [...modules].sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Evaluaciones por Módulo</h2>
        <p className="text-sm text-muted-foreground">
          Crea y edita evaluaciones para cada módulo
        </p>
      </div>
      {sorted.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <GraduationCap className="mb-3 h-10 w-10" />
            <p>No hay módulos aún. Crea módulos primero.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sorted.map((mod) => (
            <ModuleEvaluationCard key={mod.id} mod={mod} />
          ))}
        </div>
      )}
    </div>
  );
}
