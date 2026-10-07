"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ActivityType } from "@/lib/api/types";
import { removeAt, replaceAt } from "@/lib/array";
import { computeFormula, FormulaError, parseFormula } from "@/lib/formula";
import { ZoneEditor, type ZoneSpec } from "./zone-editor";

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
export interface InspectionSpec {
  prompt: string;
  zones: ZoneSpec[];
  max_misses: number;
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
    title: "Encuentra los problemas",
    intro: "Revisa la imagen.",
    spec: {
      prompt: "Encuentra los 2 problemas.",
      max_misses: 5,
      zones: [
        {
          id: "z1",
          label: "Problema 1",
          x: 0.05,
          y: 0.1,
          w: 0.25,
          h: 0.3,
          is_problem: true,
          explanation: "Por qué es un problema.",
          placed: false,
        },
        {
          id: "z2",
          label: "Problema 2",
          x: 0.37,
          y: 0.1,
          w: 0.25,
          h: 0.3,
          is_problem: true,
          explanation: "Por qué es un problema.",
          placed: false,
        },
        {
          id: "z3",
          label: "Está bien",
          x: 0.7,
          y: 0.1,
          w: 0.25,
          h: 0.3,
          is_problem: false,
          explanation: "Por qué está bien.",
          placed: false,
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
                  <Input
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
            const ids = new Set(spec.nodes.map((node) => node.id));
            let number = spec.nodes.length + 1;
            while (ids.has(`s${number}`)) number += 1;
            onChange({
              nodes: [
                ...spec.nodes,
                {
                  id: `s${number}`,
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

function InspectionForm({ spec, onChange, imageUrl }: FormProps<InspectionSpec> & { imageUrl: string | null }) {
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="inspection-prompt">Qué buscar</Label>
        <Input
          id="inspection-prompt"
          value={spec.prompt}
          maxLength={200}
          onChange={(event) => onChange({ ...spec, prompt: event.target.value })}
        />
      </div>
      <ZoneEditor imageUrl={imageUrl} zones={spec.zones} onChange={(zones) => onChange({ ...spec, zones })} />
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange({ ...spec, zones: spec.zones.map((zone) => ({ ...zone, placed: true })) })}
      >
        Confirmar que todas las zonas están bien ubicadas
      </Button>
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
        <Input
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
      <Input
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
        <Input
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
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Quitar paso ${index + 1}`}
                disabled={spec.items.length <= 4}
                onClick={() => onChange({ ...spec, items: removeAt(spec.items, index) })}
              >
                <Trash2 />
              </Button>
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
              <Input
                aria-label={`Pareja ${index + 1}`}
                value={pair.right}
                maxLength={200}
                onChange={(event) =>
                  onChange({ ...spec, pairs: replaceAt(spec.pairs, index, { ...pair, right: event.target.value }) })
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Quitar pareja ${index + 1}`}
                disabled={spec.pairs.length <= 4}
                onClick={() => onChange({ ...spec, pairs: removeAt(spec.pairs, index) })}
              >
                <Trash2 />
              </Button>
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
  imageUrl: string | null;
  onChange: (spec: AnySpec) => void;
}

/** The form of each type of activity (the server validates the whole spec when it's saved). */
export function ActivityForm({ type, spec, imageUrl, onChange }: ActivityFormProps) {
  if (type === "decision") return <DecisionForm spec={spec as DecisionSpec} onChange={onChange} />;
  if (type === "inspection")
    return <InspectionForm spec={spec as InspectionSpec} onChange={onChange} imageUrl={imageUrl} />;
  if (type === "simulator") return <SimulatorForm spec={spec as SimulatorSpec} onChange={onChange} />;
  return <QuickForm spec={spec as QuickSpec} onChange={onChange} />;
}
