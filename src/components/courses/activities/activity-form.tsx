"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { GrowingTextarea, Textarea } from "@/components/ui/textarea";
import { LOOK_LABELS, TireTread } from "@/components/learn/activities/tire-tread";
import type { ActivityType, InspectionVerdict, TireLook } from "@/lib/api/types";
import { removeAt, replaceAt } from "@/lib/array";
import { computeFormula, FormulaError, parseFormula } from "@/lib/formula";

export interface ChoiceSpec {
  id: string;
  text: string;
  points: number;
  feedback: string;
  next: string;
}
export interface NodeSpec {
  id: string;
  speaker: string;
  situation: string;
  choices: ChoiceSpec[];
}
export interface DecisionSpec {
  nodes: NodeSpec[];
}
export interface InspectionItemSpec {
  id: string;
  label: string;
  facts: { label: string; value: string }[];
  look: TireLook;
  answer: string;
  explanation: string;
}
export interface InspectionSpec {
  prompt: string;
  scene: "truck" | "cards";
  verdicts: InspectionVerdict[];
  items: InspectionItemSpec[];
  lives: number;
}
export interface VariableSpec {
  key: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  default: number;
}
export interface SimulatorSpec {
  prompt: string;
  variables: VariableSpec[];
  formula: string;
  output: { label: string; unit: string; decimals: number };
  target: { op: "lte" | "gte" | "between"; value: number; value2: number };
  success_text: string;
  fail_text: string;
  hint: string;
}
export interface QuickSpec {
  mode: "match" | "order";
  prompt: string;
  items: string[];
  pairs: { left: string; right: string }[];
  seconds: number;
}
export type AnySpec = DecisionSpec | InspectionSpec | SimulatorSpec | QuickSpec;

/** A small valid activity of each type, to start from. */
export const TEMPLATES: Record<ActivityType, { title: string; intro: string; spec: AnySpec }> = {
  decision: {
    title: "Conversación con un cliente",
    intro: "Atiende al cliente y decide qué hacer.",
    spec: {
      nodes: [
        {
          id: "s1",
          speaker: "Cliente",
          situation: "¿Qué me recomiendas?",
          choices: [
            {
              id: "a",
              text: "Le pregunto por su operación.",
              points: 8,
              feedback: "Entiendes la necesidad antes de recomendar.",
              next: "",
            },
            {
              id: "b",
              text: "Le recomiendo lo más barato.",
              points: 2,
              feedback: "Sin entender su operación, el ahorro no llega.",
              next: "",
            },
          ],
        },
      ],
    },
  },
  inspection: {
    title: "Revisa la unidad",
    intro: "Revisa cada llanta y decide qué hacer con ella.",
    spec: {
      prompt: "Revisa las 4 llantas antes de que salga la unidad.",
      scene: "truck",
      lives: 3,
      verdicts: [
        { id: "v1", label: "Sigue rodando" },
        { id: "v2", label: "Reencauchar" },
        { id: "v3", label: "Retirar" },
      ],
      items: [
        {
          id: "e1",
          label: "Llanta 1",
          facts: [{ label: "Profundidad", value: "12 mm" }],
          look: "even",
          answer: "v1",
          explanation: "Desgaste parejo y buena profundidad.",
        },
        {
          id: "e2",
          label: "Llanta 2",
          facts: [{ label: "Profundidad", value: "4 mm" }],
          look: "shoulders",
          answer: "v2",
          explanation: "Hombros gastados: rodó con baja presión.",
        },
        {
          id: "e3",
          label: "Llanta 3",
          facts: [{ label: "Profundidad", value: "9 mm" }],
          look: "bulge",
          answer: "v3",
          explanation: "Un chipote es una ruptura interna.",
        },
        {
          id: "e4",
          label: "Llanta 4",
          facts: [{ label: "Profundidad", value: "11 mm" }],
          look: "even",
          answer: "v1",
          explanation: "Está bien: sigue rodando.",
        },
      ],
    },
  },
  simulator: {
    title: "Simulador",
    intro: "Mueve los controles hasta lograr el objetivo.",
    spec: {
      prompt: "Lleva el resultado por debajo del objetivo.",
      variables: [{ key: "valor", label: "Valor", unit: "", min: 0, max: 100, step: 10, default: 100 }],
      formula: "valor",
      output: { label: "Resultado", unit: "", decimals: 0 },
      target: { op: "lte", value: 50, value2: 0 },
      success_text: "¡Lo lograste!",
      fail_text: "Todavía no: prueba otro valor.",
      hint: "",
    },
  },
  quick: {
    title: "Reto rápido",
    intro: "Contra reloj.",
    spec: {
      mode: "order",
      prompt: "Ordena los pasos.",
      items: ["Paso 1", "Paso 2", "Paso 3", "Paso 4"],
      pairs: [],
      seconds: 60,
    },
  },
};

const num = (raw: string) => (raw.trim() === "" ? 0 : Number(raw));

/** A control's key as the formula (and the server) accept it: lowercase letters and "_", up to 20. */
const cleanKey = (raw: string) =>
  raw
    .toLowerCase()
    .replace(/[^a-z_]/g, "")
    .slice(0, 20);

/** A key no other control uses ("control_a", "control_b"...). */
function freeKey(variables: VariableSpec[]): string {
  const used = new Set(variables.map((variable) => variable.key));
  return (
    "abcdefghijklmnopqrstuvwxyz"
      .split("")
      .map((letter) => `control_${letter}`)
      .find((key) => !used.has(key)) ?? "control_z"
  );
}

interface FormProps<S> {
  spec: S;
  onChange: (spec: S) => void;
}

interface RemoveButtonProps {
  label: string;
  disabled?: boolean;
  title?: string;
  onClick: () => void;
}

/** The trash can at the end of a row of a list. */
function RemoveButton({ label, disabled, title, onClick }: RemoveButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      disabled={disabled}
      title={title}
      onClick={onClick}
    >
      <Trash2 />
    </Button>
  );
}

function DecisionForm({ spec, onChange }: FormProps<DecisionSpec>) {
  const setNode = (index: number, changes: Partial<NodeSpec>) =>
    onChange({ nodes: replaceAt(spec.nodes, index, { ...spec.nodes[index], ...changes }) });
  const later = (index: number) => spec.nodes.slice(index + 1);
  return (
    <div className="space-y-5">
      {spec.nodes.map((node, index) => (
        <fieldset key={node.id} className="space-y-3 border border-border p-4">
          <legend className="px-1 text-sm font-semibold">Situación {index + 1}</legend>
          <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
            <div>
              <Label htmlFor={`speaker-${node.id}`}>Quién habla</Label>
              <Input
                id={`speaker-${node.id}`}
                value={node.speaker}
                maxLength={80}
                onChange={(event) => setNode(index, { speaker: event.target.value })}
              />
            </div>
            <div>
              <Label htmlFor={`situation-${node.id}`}>Situación (se dice con voz)</Label>
              <Textarea
                id={`situation-${node.id}`}
                value={node.situation}
                maxLength={600}
                onChange={(event) => setNode(index, { situation: event.target.value })}
              />
            </div>
          </div>
          {node.choices.map((choice, at) => {
            const setChoice = (changes: Partial<ChoiceSpec>) =>
              setNode(index, { choices: replaceAt(node.choices, at, { ...choice, ...changes }) });
            return (
              <div key={choice.id} className="space-y-2 border-l-2 border-accent pl-3">
                <div className="grid gap-2 sm:grid-cols-[1fr_90px]">
                  <GrowingTextarea
                    aria-label={`Opción ${at + 1} de la situación ${index + 1}`}
                    value={choice.text}
                    maxLength={200}
                    onChange={(event) => setChoice({ text: event.target.value })}
                  />
                  <Input
                    aria-label={`Puntos de la opción ${at + 1}`}
                    type="number"
                    min={0}
                    max={10}
                    value={choice.points}
                    onChange={(event) => setChoice({ points: num(event.target.value) })}
                  />
                </div>
                <Textarea
                  aria-label={`Consecuencia de la opción ${at + 1}`}
                  value={choice.feedback}
                  maxLength={600}
                  onChange={(event) => setChoice({ feedback: event.target.value })}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    aria-label={`A dónde lleva la opción ${at + 1}`}
                    value={choice.next}
                    onChange={(event) => setChoice({ next: event.target.value })}
                    className="h-9 w-56"
                  >
                    <option value="">Termina la conversación</option>
                    {later(index).map((target) => (
                      <option key={target.id} value={target.id}>
                        Sigue en la situación {spec.nodes.indexOf(target) + 1}
                      </option>
                    ))}
                  </Select>
                  {node.choices.length > 2 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setNode(index, { choices: removeAt(node.choices, at) })}
                    >
                      <Trash2 /> Quitar opción
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
          <div className="flex flex-wrap gap-2">
            {node.choices.length < 3 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setNode(index, {
                    choices: [
                      ...node.choices,
                      {
                        id: ["a", "b", "c"].find((letter) => !node.choices.some((other) => other.id === letter)) ?? "c",
                        text: "Otra opción",
                        points: 0,
                        feedback: "Su consecuencia.",
                        next: "",
                      },
                    ],
                  })
                }
              >
                <Plus /> Opción
              </Button>
            )}
            {index > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  onChange({
                    nodes: removeAt(spec.nodes, index).map((other) => ({
                      ...other,
                      choices: other.choices.map((choice) =>
                        choice.next === node.id ? { ...choice, next: "" } : choice,
                      ),
                    })),
                  })
                }
              >
                <Trash2 /> Quitar situación
              </Button>
            )}
          </div>
        </fieldset>
      ))}
      {spec.nodes.length < 8 && (
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            onChange({
              nodes: [
                ...spec.nodes,
                {
                  id: freeId("s", spec.nodes),
                  speaker: "Cliente",
                  situation: "Lo que dice o pasa después.",
                  choices: [
                    { id: "a", text: "Una respuesta", points: 5, feedback: "Su consecuencia.", next: "" },
                    { id: "b", text: "Otra respuesta", points: 1, feedback: "Su consecuencia.", next: "" },
                  ],
                },
              ],
            });
          }}
        >
          <Plus /> Situación (llévala desde una opción anterior)
        </Button>
      )}
    </div>
  );
}

/** An id the list doesn't use yet: `${prefix}1`, `${prefix}2`... */
function freeId(prefix: string, used: { id: string }[]): string {
  const ids = new Set(used.map((entry) => entry.id));
  let number = used.length + 1;
  while (ids.has(`${prefix}${number}`)) number += 1;
  return `${prefix}${number}`;
}

function InspectionForm({ spec, onChange }: FormProps<InspectionSpec>) {
  const setItem = (index: number, changes: Partial<InspectionItemSpec>) =>
    onChange({ ...spec, items: replaceAt(spec.items, index, { ...spec.items[index], ...changes }) });
  const hasPairs = spec.scene !== "truck" || spec.items.length % 2 === 0;
  return (
    <div className="space-y-5">
      <div>
        <Label htmlFor="inspection-prompt">Misión</Label>
        <GrowingTextarea
          id="inspection-prompt"
          value={spec.prompt}
          maxLength={200}
          onChange={(event) => onChange({ ...spec, prompt: event.target.value })}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="inspection-scene">Escena</Label>
          <Select
            id="inspection-scene"
            value={spec.scene}
            onChange={(event) => onChange({ ...spec, scene: event.target.value as InspectionSpec["scene"] })}
          >
            <option value="truck">Camión (llantas por eje)</option>
            <option value="cards">Tarjetas (casos)</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="inspection-lives">Vidas</Label>
          <Input
            id="inspection-lives"
            type="number"
            min={1}
            max={5}
            value={spec.lives}
            onChange={(event) => onChange({ ...spec, lives: num(event.target.value) })}
          />
        </div>
      </div>
      {!hasPairs && (
        <p className="text-sm text-destructive">En el camión las llantas van por pares: agrega o quita una.</p>
      )}

      <fieldset className="space-y-2 border border-border p-4">
        <legend className="px-1 text-sm font-semibold">
          Decisiones<span className="touch:hidden"> (teclas 1 a {spec.verdicts.length})</span>
        </legend>
        {spec.verdicts.map((verdict, index) => (
          <div key={verdict.id} className="flex gap-2">
            <Input
              aria-label={`Decisión ${index + 1}`}
              value={verdict.label}
              maxLength={40}
              onChange={(event) =>
                onChange({ ...spec, verdicts: replaceAt(spec.verdicts, index, { ...verdict, label: event.target.value }) })
              }
            />
            <RemoveButton
              label={`Quitar decisión ${index + 1}`}
              disabled={spec.verdicts.length <= 2 || spec.items.some((item) => item.answer === verdict.id)}
              title="Solo se quita una decisión que no es la respuesta de ningún elemento"
              onClick={() => onChange({ ...spec, verdicts: removeAt(spec.verdicts, index) })}
            />
          </div>
        ))}
        {spec.verdicts.length < 4 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              onChange({ ...spec, verdicts: [...spec.verdicts, { id: freeId("v", spec.verdicts), label: "Otra" }] })
            }
          >
            <Plus /> Decisión
          </Button>
        )}
      </fieldset>

      {spec.items.map((item, index) => (
        <fieldset key={item.id} className="space-y-3 border border-border p-4">
          <legend className="px-1 text-sm font-semibold">
            {spec.scene === "truck" ? `Llanta ${index + 1}` : `Caso ${index + 1}`}
          </legend>
          <div className="flex gap-4">
            {item.look !== "none" && <TireTread look={item.look} className="h-24 shrink-0" />}
            <div className="grid flex-1 gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor={`item-label-${item.id}`}>Nombre</Label>
                <Input
                  id={`item-label-${item.id}`}
                  value={item.label}
                  maxLength={80}
                  onChange={(event) => setItem(index, { label: event.target.value })}
                />
              </div>
              <div>
                <Label htmlFor={`item-look-${item.id}`}>Cómo se ve</Label>
                <Select
                  id={`item-look-${item.id}`}
                  value={item.look}
                  onChange={(event) => setItem(index, { look: event.target.value as TireLook })}
                >
                  {(Object.keys(LOOK_LABELS) as TireLook[]).map((look) => (
                    <option key={look} value={look}>
                      {LOOK_LABELS[look]}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor={`item-answer-${item.id}`}>Respuesta correcta</Label>
                <Select
                  id={`item-answer-${item.id}`}
                  value={item.answer}
                  onChange={(event) => setItem(index, { answer: event.target.value })}
                >
                  {spec.verdicts.map((verdict) => (
                    <option key={verdict.id} value={verdict.id}>
                      {verdict.label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Datos que ve el colaborador (nunca la respuesta)</p>
            {item.facts.map((fact, at) => (
              <div key={at} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                <Input
                  aria-label={`Dato ${at + 1} de ${item.label}`}
                  value={fact.label}
                  maxLength={80}
                  onChange={(event) =>
                    setItem(index, { facts: replaceAt(item.facts, at, { ...fact, label: event.target.value }) })
                  }
                />
                <Input
                  aria-label={`Valor del dato ${at + 1} de ${item.label}`}
                  value={fact.value}
                  maxLength={60}
                  onChange={(event) =>
                    setItem(index, { facts: replaceAt(item.facts, at, { ...fact, value: event.target.value }) })
                  }
                />
                <RemoveButton
                  label={`Quitar dato ${at + 1} de ${item.label}`}
                  disabled={item.facts.length <= 1}
                  onClick={() => setItem(index, { facts: removeAt(item.facts, at) })}
                />
              </div>
            ))}
            {item.facts.length < 5 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setItem(index, { facts: [...item.facts, { label: "Dato", value: "Valor" }] })}
              >
                <Plus /> Dato
              </Button>
            )}
          </div>
          <div>
            <Label htmlFor={`item-explanation-${item.id}`}>Explicación (se dice con voz)</Label>
            <Textarea
              id={`item-explanation-${item.id}`}
              value={item.explanation}
              maxLength={600}
              onChange={(event) => setItem(index, { explanation: event.target.value })}
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={spec.items.length <= 3}
            onClick={() => onChange({ ...spec, items: removeAt(spec.items, index) })}
          >
            <Trash2 /> Quitar
          </Button>
        </fieldset>
      ))}
      {spec.items.length < 10 && (
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            onChange({
              ...spec,
              items: [
                ...spec.items,
                {
                  id: freeId("e", spec.items),
                  label: spec.scene === "truck" ? `Llanta ${spec.items.length + 1}` : `Caso ${spec.items.length + 1}`,
                  facts: [{ label: "Profundidad", value: "10 mm" }],
                  look: spec.scene === "truck" ? "even" : "none",
                  answer: spec.verdicts[0]?.id ?? "",
                  explanation: "Por qué esa es la decisión correcta.",
                },
              ],
            })
          }
        >
          <Plus /> {spec.scene === "truck" ? "Llanta" : "Caso"}
        </Button>
      )}
    </div>
  );
}

function SimulatorForm({ spec, onChange }: FormProps<SimulatorSpec>) {
  const keys = spec.variables.map((variable) => variable.key);
  let formulaError = "";
  try {
    parseFormula(spec.formula, keys);
  } catch (error) {
    formulaError = error instanceof FormulaError ? error.message : "La fórmula no es válida.";
  }
  const preview = computeFormula(
    spec.formula,
    Object.fromEntries(spec.variables.map((variable) => [variable.key, variable.default])),
  );
  const setVariable = (index: number, changes: Partial<VariableSpec>) =>
    onChange({ ...spec, variables: replaceAt(spec.variables, index, { ...spec.variables[index], ...changes }) });
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="sim-prompt">Reto</Label>
        <GrowingTextarea
          id="sim-prompt"
          value={spec.prompt}
          maxLength={200}
          onChange={(event) => onChange({ ...spec, prompt: event.target.value })}
        />
      </div>
      {spec.variables.map((variable, index) => (
        <fieldset key={index} className="grid gap-2 border border-border p-3 sm:grid-cols-4">
          <legend className="px-1 text-sm font-semibold">Control {index + 1}</legend>
          <Input
            aria-label="Clave (en la fórmula)"
            value={variable.key}
            maxLength={20}
            onChange={(event) => setVariable(index, { key: cleanKey(event.target.value) })}
          />
          <Input
            aria-label="Nombre"
            value={variable.label}
            maxLength={80}
            onChange={(event) => setVariable(index, { label: event.target.value })}
          />
          <Input
            aria-label="Unidad"
            value={variable.unit}
            maxLength={30}
            onChange={(event) => setVariable(index, { unit: event.target.value })}
          />
          <Input
            aria-label="Valor inicial"
            type="number"
            value={variable.default}
            onChange={(event) => setVariable(index, { default: num(event.target.value) })}
          />
          <Input
            aria-label="Mínimo"
            type="number"
            value={variable.min}
            onChange={(event) => setVariable(index, { min: num(event.target.value) })}
          />
          <Input
            aria-label="Máximo"
            type="number"
            value={variable.max}
            onChange={(event) => setVariable(index, { max: num(event.target.value) })}
          />
          <Input
            aria-label="Paso"
            type="number"
            value={variable.step}
            onChange={(event) => setVariable(index, { step: num(event.target.value) })}
          />
          {spec.variables.length > 1 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange({ ...spec, variables: removeAt(spec.variables, index) })}
            >
              <Trash2 /> Quitar
            </Button>
          )}
        </fieldset>
      ))}
      {spec.variables.length < 4 && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            onChange({
              ...spec,
              variables: [
                ...spec.variables,
                {
                  key: freeKey(spec.variables),
                  label: "Otro control",
                  unit: "",
                  min: 0,
                  max: 10,
                  step: 1,
                  default: 0,
                },
              ],
            })
          }
        >
          <Plus /> Control
        </Button>
      )}
      <div>
        <Label htmlFor="sim-formula">Fórmula (solo + − × ÷, paréntesis, min y max con las claves)</Label>
        <Input
          id="sim-formula"
          value={spec.formula}
          maxLength={200}
          onChange={(event) => onChange({ ...spec, formula: event.target.value })}
          aria-invalid={Boolean(formulaError)}
        />
        <p className={formulaError ? "mt-1 text-xs text-destructive" : "mt-1 text-xs text-muted-foreground"}>
          {formulaError || `Con los valores iniciales da ${preview ?? "—"}.`}
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <Input
          aria-label="Nombre del resultado"
          value={spec.output.label}
          maxLength={80}
          onChange={(event) => onChange({ ...spec, output: { ...spec.output, label: event.target.value } })}
        />
        <Input
          aria-label="Unidad del resultado"
          value={spec.output.unit}
          maxLength={30}
          onChange={(event) => onChange({ ...spec, output: { ...spec.output, unit: event.target.value } })}
        />
        <Input
          aria-label="Decimales"
          type="number"
          min={0}
          max={4}
          value={spec.output.decimals}
          onChange={(event) => onChange({ ...spec, output: { ...spec.output, decimals: num(event.target.value) } })}
        />
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <Select
          aria-label="Objetivo"
          value={spec.target.op}
          onChange={(event) =>
            onChange({ ...spec, target: { ...spec.target, op: event.target.value as SimulatorSpec["target"]["op"] } })
          }
        >
          <option value="lte">Llegar a este valor o menos</option>
          <option value="gte">Llegar a este valor o más</option>
          <option value="between">Quedar entre dos valores</option>
        </Select>
        <Input
          aria-label="Valor del objetivo"
          type="number"
          value={spec.target.value}
          onChange={(event) => onChange({ ...spec, target: { ...spec.target, value: num(event.target.value) } })}
        />
        {spec.target.op === "between" && (
          <Input
            aria-label="Hasta"
            type="number"
            value={spec.target.value2}
            onChange={(event) => onChange({ ...spec, target: { ...spec.target, value2: num(event.target.value) } })}
          />
        )}
      </div>
      <Textarea
        aria-label="Texto al lograrlo (con voz)"
        value={spec.success_text}
        maxLength={600}
        onChange={(event) => onChange({ ...spec, success_text: event.target.value })}
      />
      <Textarea
        aria-label="Texto al no lograrlo (con voz)"
        value={spec.fail_text}
        maxLength={600}
        onChange={(event) => onChange({ ...spec, fail_text: event.target.value })}
      />
      <GrowingTextarea
        aria-label="Pista"
        value={spec.hint}
        maxLength={600}
        onChange={(event) => onChange({ ...spec, hint: event.target.value })}
      />
    </div>
  );
}

function QuickForm({ spec, onChange }: FormProps<QuickSpec>) {
  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-[1fr_200px_120px]">
        <GrowingTextarea
          aria-label="Instrucción"
          value={spec.prompt}
          maxLength={200}
          onChange={(event) => onChange({ ...spec, prompt: event.target.value })}
        />
        <Select
          aria-label="Modo"
          value={spec.mode}
          onChange={(event) => {
            const mode = event.target.value as QuickSpec["mode"];
            // Each mode needs 4 entries of its own to be saved: start the new one with some.
            const pairs =
              spec.pairs.length >= 4
                ? spec.pairs
                : [1, 2, 3, 4].map((n) => ({ left: `Concepto ${n}`, right: `Su pareja ${n}` }));
            const items = spec.items.length >= 4 ? spec.items : [1, 2, 3, 4].map((n) => `Paso ${n}`);
            onChange({ ...spec, mode, pairs, items });
          }}
        >
          <option value="order">Ordenar pasos</option>
          <option value="match">Emparejar</option>
        </Select>
        <Input
          aria-label="Segundos"
          type="number"
          min={20}
          max={120}
          value={spec.seconds}
          onChange={(event) => onChange({ ...spec, seconds: num(event.target.value) })}
        />
      </div>
      {spec.mode === "order" ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Escribe los pasos en el orden correcto: se barajan al jugar.</p>
          {spec.items.map((item, index) => (
            <div key={index} className="flex gap-2">
              <Input
                aria-label={`Paso ${index + 1}`}
                value={item}
                maxLength={80}
                onChange={(event) => onChange({ ...spec, items: replaceAt(spec.items, index, event.target.value) })}
              />
              <RemoveButton
                label={`Quitar paso ${index + 1}`}
                disabled={spec.items.length <= 4}
                onClick={() => onChange({ ...spec, items: removeAt(spec.items, index) })}
              />
            </div>
          ))}
          {spec.items.length < 8 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onChange({ ...spec, items: [...spec.items, `Paso ${spec.items.length + 1}`] })}
            >
              <Plus /> Paso
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {spec.pairs.map((pair, index) => (
            <div key={index} className="grid grid-cols-[1fr_1fr_auto] gap-2">
              <Input
                aria-label={`Concepto ${index + 1}`}
                value={pair.left}
                maxLength={80}
                onChange={(event) =>
                  onChange({ ...spec, pairs: replaceAt(spec.pairs, index, { ...pair, left: event.target.value }) })
                }
              />
              <GrowingTextarea
                aria-label={`Pareja ${index + 1}`}
                value={pair.right}
                maxLength={200}
                onChange={(event) =>
                  onChange({ ...spec, pairs: replaceAt(spec.pairs, index, { ...pair, right: event.target.value }) })
                }
              />
              <RemoveButton
                label={`Quitar pareja ${index + 1}`}
                disabled={spec.pairs.length <= 4}
                onClick={() => onChange({ ...spec, pairs: removeAt(spec.pairs, index) })}
              />
            </div>
          ))}
          {spec.pairs.length < 8 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                onChange({
                  ...spec,
                  pairs: [...spec.pairs, { left: `Concepto ${spec.pairs.length + 1}`, right: "Su pareja" }],
                })
              }
            >
              <Plus /> Pareja
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

interface ActivityFormProps {
  type: ActivityType;
  spec: AnySpec;
  onChange: (spec: AnySpec) => void;
}

/** The form of each type of activity (the server validates the whole spec when it's saved). */
export function ActivityForm({ type, spec, onChange }: ActivityFormProps) {
  if (type === "decision") return <DecisionForm spec={spec as DecisionSpec} onChange={onChange} />;
  if (type === "inspection") return <InspectionForm spec={spec as InspectionSpec} onChange={onChange} />;
  if (type === "simulator") return <SimulatorForm spec={spec as SimulatorSpec} onChange={onChange} />;
  return <QuickForm spec={spec as QuickSpec} onChange={onChange} />;
}
