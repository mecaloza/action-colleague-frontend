"use client";

import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { QueryError } from "@/components/layout/query-state";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { type PathUpdate, pathsApi } from "@/lib/api/paths";
import { profileKeys, profilesApi } from "@/lib/api/profiles";
import type { PathDetail, PathSettings } from "@/lib/api/types";
import { plural } from "@/lib/format";
import { usePathCache } from "@/lib/hooks/use-path-cache";
import { useUnsavedChangesWarning } from "@/lib/hooks/use-unsaved-changes-warning";
import { toastError } from "@/lib/notify";
import { cn, toggled } from "@/lib/utils";

const TITLE_ERROR_ID = "path-title-error";
const DUE_HINT_ID = "path-due-hint";
const DUE_ERROR_ID = "path-due-error";
const MAX_DUE_DAYS = 365;

/** The deadline typed: days (1..365), null when empty (no deadline), undefined when it isn't valid. */
function dueDaysIn(raw: string): number | null | undefined {
  const text = raw.trim();
  if (!text) return null;
  const days = Number(text);
  // Digits only: Number() would also take "1e2" or "0x1E".
  return /^\d+$/.test(text) && days >= 1 && days <= MAX_DUE_DAYS ? days : undefined;
}

/** The form's fields as the path has them saved. The deadline is the text typed: validated, not clamped. */
function fieldsOf(path: PathDetail) {
  return {
    title: path.title,
    description: path.description,
    profileIds: path.profiles.map((profile) => profile.id),
    sequential: path.settings.sequential,
    dueDays: path.settings.due_days?.toString() ?? "",
    certificate: path.settings.certificate,
  };
}

type Fields = ReturnType<typeof fieldsOf>;

const sameIds = (a: number[], b: number[]) => a.length === b.length && a.every((id) => b.includes(id));

interface SwitchRowProps {
  id: string;
  label: string;
  hint: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

/** A setting turned on or off: the whole row is the target (a finger needs more than the switch). */
function SwitchRow({ id, label, hint, checked, onCheckedChange }: SwitchRowProps) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start justify-between gap-4 p-4">
      <span>
        <span className="block font-semibold">{label}</span>
        <span id={`${id}-hint`} className="mt-0.5 block text-sm text-muted-foreground">
          {hint}
        </span>
      </span>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        aria-label={label}
        aria-describedby={`${id}-hint`}
        className="mt-0.5"
      />
    </label>
  );
}

/** The path's profiles: one checkbox each, with how many people it has. */
function ProfilesField({ selected, onToggle, published }: { selected: number[]; onToggle: (id: number) => void; published: boolean }) {
  const profiles = useQuery({ queryKey: profileKeys.list, queryFn: profilesApi.list });
  return (
    <fieldset aria-describedby="path-profiles-hint">
      <legend className="mb-1.5 text-[11px] font-bold uppercase tracking-label text-ink-700">Perfiles</legend>
      <p id="path-profiles-hint" className="mb-3 text-sm text-muted-foreground">
        Sus colaboradores reciben la ruta {published ? "al guardar" : "cuando la publiques"} (los administradores no).
        Quien la tenía por un perfil que quitas la pierde si no la había completado.
      </p>
      {profiles.isPending ? (
        <Skeleton className="h-24" />
      ) : !profiles.data ? (
        <QueryError query={profiles} />
      ) : profiles.data.length ? (
        <ul className="max-h-72 overflow-y-auto border border-border bg-white">
          {profiles.data.map((profile) => (
            <li key={profile.id} className="border-b border-border last:border-0">
              <label className="flex min-h-11 cursor-pointer items-center gap-3 px-4 py-2">
                <input
                  type="checkbox"
                  className="h-5 w-5 shrink-0 cursor-pointer accent-accent"
                  checked={selected.includes(profile.id)}
                  onChange={() => onToggle(profile.id)}
                />
                <span className="min-w-0 flex-1 break-words font-semibold">{profile.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{plural(profile.user_count, "persona")}</span>
              </label>
            </li>
          ))}
        </ul>
      ) : (
        <p className="border border-dashed border-input bg-mist/50 px-4 py-3 text-sm text-muted-foreground">
          Aún no hay perfiles.{" "}
          <Link href="/admin/team/profiles" className="font-semibold text-accent-strong underline underline-offset-4">
            Créalos en Equipo › Perfiles
          </Link>
          .
        </p>
      )}
    </fieldset>
  );
}

/** The path's data and rules: title, description, profiles, order, deadline and certificate. */
export function PathSettingsTab({ path }: { path: PathDetail }) {
  const { storePath } = usePathCache();
  const titleField = useRef<HTMLInputElement>(null);
  const dueField = useRef<HTMLInputElement>(null);
  const [fields, setFields] = useState(() => fieldsOf(path));
  const [attempted, setAttempted] = useState(false);
  // The form starts over whenever the saved values change (after saving, or edited elsewhere). In place, not with a
  // `key`: a new form would take the focus from the field or the button in use.
  const savedValues = JSON.stringify(fieldsOf(path));
  const [shownValues, setShownValues] = useState(savedValues);
  if (shownValues !== savedValues) {
    setShownValues(savedValues);
    setFields(fieldsOf(path));
    setAttempted(false);
  }
  const edit = (changes: Partial<Fields>) => setFields((current) => ({ ...current, ...changes }));
  const { title, description, profileIds, sequential, dueDays, certificate } = fields;
  const published = path.status === "published";

  const due = dueDaysIn(dueDays);
  const titleError = attempted && !title.trim() ? "Escribe el título de la ruta" : null;
  const dueError = due === undefined ? `Escribe un número de días entre 1 y ${MAX_DUE_DAYS}, o déjalo vacío para no poner plazo.` : null;

  // Only what changed: a stale copy never overwrites what someone else saved meanwhile.
  const update: PathUpdate = {};
  if (title.trim() !== path.title.trim()) update.title = title.trim();
  if (description.trim() !== path.description.trim()) update.description = description.trim();
  if (!sameIds(profileIds, path.profiles.map((profile) => profile.id))) update.profile_ids = profileIds;
  const settings: Partial<PathSettings> = {};
  if (sequential !== path.settings.sequential) settings.sequential = sequential;
  if (due !== undefined && due !== path.settings.due_days) settings.due_days = due;
  if (certificate !== path.settings.certificate) settings.certificate = certificate;
  if (Object.keys(settings).length) update.settings = settings;
  const dirty = Object.keys(update).length > 0 || due === undefined;
  useUnsavedChangesWarning(dirty);

  const save = useMutation({
    mutationFn: (changes: PathUpdate) => pathsApi.update(path.id, changes),
    onSuccess: (saved, changes) => {
      void storePath(saved);
      toast.success(
        changes.profile_ids && saved.status === "published"
          ? `Cambios guardados: ${plural(saved.people_count, "persona tiene", "personas tienen")} la ruta`
          : "Cambios guardados",
      );
    },
    onError: toastError,
  });
  // Nothing to save, or a save on its way: "Guardar cambios" waits.
  const waiting = !dirty || save.isPending;

  return (
    <form
      noValidate
      className="max-w-2xl space-y-8"
      onSubmit={(event) => {
        event.preventDefault();
        if (waiting) return; // Enter in a field, or the button that only looks disabled
        const problem = !title.trim() ? titleField : due === undefined ? dueField : null;
        if (!problem) {
          save.mutate(update);
          return;
        }
        // Show the problems before moving to the first one, so it is read out with its message.
        flushSync(() => setAttempted(true));
        problem.current?.focus();
      }}
    >
      <div className="space-y-6">
        <div>
          <Label htmlFor="path-title">Título</Label>
          <Input
            ref={titleField}
            id="path-title"
            value={title}
            onChange={(event) => edit({ title: event.target.value })}
            maxLength={200}
            required
            aria-invalid={titleError ? true : undefined}
            aria-describedby={titleError ? TITLE_ERROR_ID : undefined}
          />
          <FieldError id={TITLE_ERROR_ID} message={titleError} />
        </div>
        <div>
          <Label htmlFor="path-description">Descripción</Label>
          <Textarea
            id="path-description"
            value={description}
            onChange={(event) => edit({ description: event.target.value })}
            maxLength={5000}
            placeholder="Qué logra quien la completa."
          />
        </div>
      </div>

      <ProfilesField
        selected={profileIds}
        published={published}
        onToggle={(id) => setFields((current) => ({ ...current, profileIds: toggled(current.profileIds, id) }))}
      />

      <div className="divide-y divide-border border border-border bg-white">
        <SwitchRow
          id="path-sequential"
          label="Desbloquear los cursos en orden"
          hint="Cada curso se abre al completar el anterior. Un curso que la persona ya empezó sigue abierto."
          checked={sequential}
          onCheckedChange={(checked) => edit({ sequential: checked })}
        />
        <div className="p-4">
          <Label htmlFor="path-due-days">Plazo (días)</Label>
          <Input
            ref={dueField}
            id="path-due-days"
            // Text with a numeric keyboard, not type="number": that one reads "3e" or "--" as empty, which here means
            // "no deadline" and would take it away without a word.
            inputMode="numeric"
            value={dueDays}
            onChange={(event) => edit({ dueDays: event.target.value })}
            placeholder="Sin plazo"
            className="sm:w-48"
            aria-invalid={dueError ? true : undefined}
            aria-describedby={dueError ? `${DUE_ERROR_ID} ${DUE_HINT_ID}` : DUE_HINT_ID}
          />
          <FieldError id={DUE_ERROR_ID} message={dueError} />
          <p id={DUE_HINT_ID} className="mt-1.5 text-xs text-muted-foreground">
            Días para completarla desde que se asigna; vacío, sin plazo. Un plazo nuevo vale para quienes aún no la completan.
          </p>
        </div>
        <SwitchRow
          id="path-certificate"
          label="Emitir certificado al completar la ruta"
          hint="Cuando la persona completa todos sus cursos publicados."
          checked={certificate}
          onCheckedChange={(checked) => edit({ certificate: checked })}
        />
      </div>

      {/* Never `disabled` (nothing to save, or saving): the button just pressed would lose the focus. */}
      <Button
        type="submit"
        aria-disabled={waiting || undefined}
        aria-busy={save.isPending || undefined}
        className={cn(waiting && "pointer-events-none opacity-45")}
      >
        {save.isPending && <Loader2 className="animate-spin" aria-hidden />}
        Guardar cambios
      </Button>
    </form>
  );
}
