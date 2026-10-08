"use client";

import { useId, type ReactNode } from "react";
import { Type, Volume2 } from "lucide-react";
import { LOOK_LABELS } from "@/components/learn/activities/tire-tread";
import type { ActivityAdmin, ActivityChange, EntityChange, RevisionLearners, TireLook } from "@/lib/api/types";
import {
  Blank,
  ChangeCard,
  changeLooks,
  Compare,
  FieldDiff,
  LongText,
  NotesPanel,
  NUMBER,
  recordOf,
  textOf,
} from "./revision-diff";

const LOOKS = changeLooks("Se agrega");

/** What each field of an activity's parts is called in its editor (a field means the same in every kind). */
const KEYS: Record<string, string> = {
  speaker: "Quién habla",
  situation: "Situación",
  choices: "Opciones",
  text: "Texto",
  points: "Puntos",
  feedback: "Consecuencia",
  next: "A dónde lleva",
  label: "Nombre",
  facts: "Datos",
  look: "Cómo se ve",
  answer: "Respuesta correcta",
  explanation: "Explicación",
  key: "Clave (en la fórmula)",
  unit: "Unidad",
  min: "Mínimo",
  max: "Máximo",
  step: "Paso",
  default: "Valor inicial",
  decimals: "Decimales",
  op: "Objetivo",
  value: "Valor",
  value2: "Hasta",
};

// The choices of the editor's lists, by their value.
const SCENES: Record<string, string> = { truck: "Camión (llantas por eje)", cards: "Tarjetas (casos)" };
const MODES: Record<string, string> = { order: "Ordenar pasos", match: "Emparejar" };
const TARGETS: Record<string, string> = {
  lte: "Llegar a este valor o menos",
  gte: "Llegar a este valor o más",
  between: "Quedar entre dos valores",
};

/** What the activity's parts point to by id, by the names the admin knows: decisions, situations. */
interface SpecNames {
  /** A decision's name, by its id (an inspection's items answer with one). */
  verdicts: Map<string, string>;
  /** A situation's number, by its id (a conversation's choices lead to one). */
  nodes: Map<string, number>;
}

function specNames(spec: Record<string, unknown>, entities: EntityChange[]): SpecNames {
  const elements = (value: unknown) => (Array.isArray(value) ? value.map(recordOf) : []);
  const verdicts = new Map(elements(spec.verdicts).map((verdict) => [textOf(verdict.id), textOf(verdict.label)]));
  // A decision the change adds or renames, by its new name.
  for (const entity of entities) {
    const label = textOf(recordOf(entity.after).label);
    if (entity.path.startsWith("verdicts/") && label) verdicts.set(entity.path.slice("verdicts/".length), label);
  }
  const nodes = new Map(elements(spec.nodes).map((node, index) => [textOf(node.id), index + 1]));
  return { verdicts, nodes };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

/** An element of a list shown on one line: a fact ("Profundidad: 12 mm") or a pair ("Concepto → su pareja"). */
function inline(value: Record<string, unknown>): string | null {
  const keys = Object.keys(value).sort().join();
  if (keys === "label,value") return `${textOf(value.label)}: ${textOf(value.value)}`;
  if (keys === "left,right") return `${textOf(value.left)} → ${textOf(value.right)}`;
  return null;
}

/** A value of the activity's spec as its editor shows it (`name`: its field, or the spec's field it is). */
function SpecValue({ name, value, names }: { name: string; value: unknown; names: SpecNames }): ReactNode {
  if (value === null || value === undefined || value === "") {
    return name === "next" ? "Termina la conversación" : <Blank />;
  }
  if (typeof value === "string") {
    switch (name) {
      case "look":
        return LOOK_LABELS[value as TireLook] ?? value;
      case "scene":
        return SCENES[value] ?? value;
      case "mode":
        return MODES[value] ?? value;
      case "op":
        return TARGETS[value] ?? value;
      case "answer":
        return names.verdicts.get(value) || value;
      case "next": {
        const number = names.nodes.get(value);
        return number ? `Sigue en la situación ${number}` : "Sigue en otra situación";
      }
      default:
        return <span className="whitespace-pre-wrap">{value}</span>;
    }
  }
  if (typeof value === "number") return NUMBER.format(value);
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (Array.isArray(value)) {
    if (!value.length) return <Blank />;
    return (
      <ol className="list-decimal space-y-1 pl-5">
        {value.map((item, index) => (
          <li key={index}>
            {isRecord(item) && inline(item) !== null ? inline(item) : <SpecValue name={name} value={item} names={names} />}
          </li>
        ))}
      </ol>
    );
  }
  return <SpecFields value={recordOf(value)} names={names} />;
}

/** An element (a situation, a choice, a control...) or a field made of fields (a target): each one by its name. */
function SpecFields({ value, names }: { value: Record<string, unknown>; names: SpecNames }) {
  const entries = Object.entries(value).filter(([key]) => key !== "id");
  if (!entries.length) return <Blank />;
  return (
    <dl className="space-y-1.5">
      {entries.map(([key, item]) => (
        <div key={key}>
          <dt className="text-[10px] font-bold uppercase tracking-label text-muted-foreground">{KEYS[key] ?? key}</dt>
          <dd className="break-words">
            <SpecValue name={key} value={item} names={names} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** A small diamond leading a part's card, as the brand marks lists. */
function Diamond() {
  return <span className="mx-1 h-2 w-2 shrink-0 rotate-45 bg-accent" aria-hidden />;
}

function EntityChangeCard({ change, names }: { change: EntityChange; names: SpecNames }) {
  const { action, before, after, path } = change;
  let body: ReactNode;
  if (action === "move") {
    body = <p className="text-sm">Cambia de lugar en su lista.</p>;
  } else if (action === "update" && isRecord(before) && isRecord(after)) {
    // An element (or a field made of fields): only what changed in it, by its name.
    const keys = Object.keys({ ...before, ...after }).filter(
      (key) => key !== "id" && JSON.stringify(before[key]) !== JSON.stringify(after[key]),
    );
    body = keys.map((key) => (
      <FieldDiff key={key} label={KEYS[key] ?? key}>
        <Compare
          before={<SpecValue name={key} value={before[key]} names={names} />}
          after={<SpecValue name={key} value={after[key]} names={names} />}
        />
      </FieldDiff>
    ));
  } else {
    body = (
      <Compare
        before={action === "insert" ? undefined : <SpecValue name={path} value={before} names={names} />}
        after={action === "delete" ? undefined : <SpecValue name={path} value={after} names={names} />}
      />
    );
  }
  return (
    <ChangeCard marker={<Diamond />} title={change.label} look={LOOKS[action] ?? LOOKS.update}>
      {body}
    </ChangeCard>
  );
}

/**
 * What a change does to an activity: its title and intro before and after, and each of its parts that changes (a
 * situation, a choice, an item, a control, its instruction...) with what changes in it.
 */
export function ActivityRevisionDiff({ change, activity }: { change: ActivityChange; activity: ActivityAdmin }) {
  const headingId = useId();
  const names = specNames(activity.spec, change.entities);
  return (
    <section aria-labelledby={headingId} className="space-y-3">
      <h4 id={headingId} className="text-[11px] font-bold uppercase tracking-label text-ink-700">
        Qué cambia
      </h4>
      <ol className="space-y-3">
        {change.title && (
          <ChangeCard marker={<Type className="h-5 w-5 shrink-0 text-accent" aria-hidden />} title="Título" look={LOOKS.update}>
            <Compare before={change.title.before || <Blank />} after={change.title.after || <Blank />} />
          </ChangeCard>
        )}
        {change.intro && (
          <ChangeCard
            marker={<Volume2 className="h-5 w-5 shrink-0 text-accent" aria-hidden />}
            title="Introducción"
            look={LOOKS.update}
          >
            <Compare before={<LongText value={change.intro.before} />} after={<LongText value={change.intro.after} />} />
          </ChangeCard>
        )}
        {change.entities.map((entity) => (
          <EntityChangeCard key={`${entity.action}:${entity.path}`} change={entity} names={names} />
        ))}
      </ol>
    </section>
  );
}

interface ActivityReachPanelProps {
  activity: ActivityAdmin;
  /** Who it reaches, as the server counts them (left out by an older one: then the course's status says it). */
  learners: RevisionLearners | null;
  coursePublished: boolean;
  linesChanged: number;
}

/** Who the change reaches as soon as it is applied, and what is voiced again, in plain Spanish. */
function reachLines({ activity, learners, coursePublished, linesChanged }: ActivityReachPanelProps): string[] {
  const published = activity.status === "ready";
  const lines = [
    !published
      ? "La actividad es un borrador: nadie la ve hasta que la publiques."
      : (learners?.published ?? coursePublished)
        ? "La actividad está publicada: quienes la juegan ven el cambio en cuanto lo apliques."
        : "El curso no está publicado: nadie ve el cambio todavía.",
  ];
  const playing = learners?.mid_play ?? 0;
  if (playing === 1) lines.push("1 persona tiene una partida abierta: al aplicar el cambio, la empieza de nuevo.");
  else if (playing > 1) {
    lines.push(`${playing} personas tienen una partida abierta: al aplicar el cambio, la empiezan de nuevo.`);
  }
  // A draft is voiced when it is published, whole.
  if (published) {
    lines.push(
      linesChanged === 0
        ? "La voz queda igual: no cambia nada de lo que se dice."
        : linesChanged === 1
          ? "Se graba de nuevo la voz de 1 línea; las demás conservan la suya."
          : `Se graba de nuevo la voz de ${linesChanged} líneas; las demás conservan la suya.`,
    );
  }
  return lines;
}

/** What the change means for the people playing the activity, and for its voice. */
export function ActivityReachPanel(props: ActivityReachPanelProps) {
  return <NotesPanel title="Para las personas" lines={reachLines(props)} />;
}
