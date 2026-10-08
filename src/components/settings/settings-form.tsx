"use client";

import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Award, Building2, ClipboardCheck, Loader2 } from "lucide-react";
import { useConfirm } from "@/components/layout/confirm-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SwitchRow } from "@/components/ui/switch-row";
import { ApiError } from "@/lib/api/client";
import { type SettingsPatch, settingsApi, settingsKeys } from "@/lib/api/settings";
import type { CertificateSettings, EvaluationDefaults, GeneralSettings, PlatformSettings } from "@/lib/api/types";
import { useLeaveGuard } from "@/lib/hooks/use-leave-guard";
import { toastError } from "@/lib/notify";
import { cn } from "@/lib/utils";
import { CertificatePreview, DEFAULT_ISSUER } from "./certificate-preview";
import { TimezoneField, isCommonZone, knownZone } from "./timezone-field";

// The API's limits (app/schemas/settings.py).
const PASSING = { min: 1, max: 100 };
const ATTEMPTS = { min: 1, max: 10 };
const VALIDITY = { min: 1, max: 120 };
const MIN_SCORE = { min: 0, max: 100 };
const MAX_NAME = 200;

const MESSAGES = {
  timezone: "Esa zona horaria no existe. Elige una de la lista o escríbela como «America/Bogota».",
  timezoneEmpty: "Escribe el nombre de la zona horaria, por ejemplo «America/Bogota».",
  passingScore: `Escribe un número entero entre ${PASSING.min} y ${PASSING.max}.`,
  maxAttempts: `Escribe un número entero entre ${ATTEMPTS.min} y ${ATTEMPTS.max}.`,
  validityMonths: `Escribe un número de meses entre ${VALIDITY.min} y ${VALIDITY.max}, o déjalo vacío para que no venzan.`,
  minScore: `Escribe una nota entre ${MIN_SCORE.min} y ${MIN_SCORE.max}, o déjala vacía para aceptar cualquiera.`,
};

/** A whole number typed (digits only) in [min, max]: null when empty, undefined when it isn't valid. */
function wholeIn(raw: string, { min, max }: { min: number; max: number }): number | null | undefined {
  const text = raw.trim();
  if (!text) return null;
  const value = Number(text);
  // Digits only: Number() would also take "1e2" or "0x1E".
  return /^\d+$/.test(text) && value >= min && value <= max ? value : undefined;
}

/** The form's fields as the parameters are saved. Numbers are the text typed: validated, not clamped. */
function fieldsOf(settings: PlatformSettings) {
  const { general, evaluations, certificates } = settings;
  return {
    companyName: general.company_name,
    timezone: general.timezone,
    customZone: !isCommonZone(general.timezone),
    passingScore: String(evaluations.passing_score),
    maxAttempts: String(evaluations.max_attempts),
    enabled: certificates.enabled,
    validityMonths: certificates.validity_months?.toString() ?? "",
    minScore: certificates.min_score?.toString() ?? "",
    signerName: certificates.signer_name,
    signerTitle: certificates.signer_title,
  };
}

type Fields = ReturnType<typeof fieldsOf>;

/** What the fields say, read: undefined where a value isn't valid (null: empty, where that is allowed). */
function valuesOf(fields: Fields) {
  return {
    companyName: fields.companyName.trim(),
    timezone: knownZone(fields.timezone),
    passingScore: wholeIn(fields.passingScore, PASSING),
    maxAttempts: wholeIn(fields.maxAttempts, ATTEMPTS),
    validityMonths: wholeIn(fields.validityMonths, VALIDITY),
    minScore: wholeIn(fields.minScore, MIN_SCORE),
    signerName: fields.signerName.trim(),
    signerTitle: fields.signerTitle.trim(),
  };
}

type Values = ReturnType<typeof valuesOf>;

/** Only what changed (and is valid), key by key: a stale copy never overwrites what another admin saved meanwhile. */
function changesOf(values: Values, fields: Fields, saved: PlatformSettings): SettingsPatch {
  const general: Partial<GeneralSettings> = {};
  if (values.companyName !== saved.general.company_name) general.company_name = values.companyName;
  if (values.timezone && values.timezone !== saved.general.timezone) general.timezone = values.timezone;

  const evaluations: Partial<EvaluationDefaults> = {};
  if (values.passingScore != null && values.passingScore !== saved.evaluations.passing_score) {
    evaluations.passing_score = values.passingScore;
  }
  if (values.maxAttempts != null && values.maxAttempts !== saved.evaluations.max_attempts) {
    evaluations.max_attempts = values.maxAttempts;
  }

  const certificates: Partial<CertificateSettings> = {};
  if (fields.enabled !== saved.certificates.enabled) certificates.enabled = fields.enabled;
  // null empties them (no expiry, any score).
  if (values.validityMonths !== undefined && values.validityMonths !== saved.certificates.validity_months) {
    certificates.validity_months = values.validityMonths;
  }
  if (values.minScore !== undefined && values.minScore !== saved.certificates.min_score) {
    certificates.min_score = values.minScore;
  }
  if (values.signerName !== saved.certificates.signer_name) certificates.signer_name = values.signerName;
  if (values.signerTitle !== saved.certificates.signer_title) certificates.signer_title = values.signerTitle;

  const patch: SettingsPatch = {};
  if (Object.keys(general).length) patch.general = general;
  if (Object.keys(evaluations).length) patch.evaluations = evaluations;
  if (Object.keys(certificates).length) patch.certificates = certificates;
  return patch;
}

interface SectionProps {
  id: string;
  icon: React.ReactNode;
  title: string;
  hint: string;
  children: React.ReactNode;
}

function Section({ id, icon, title, hint, children }: SectionProps) {
  return (
    <section aria-labelledby={id} className="grid gap-6 border-t border-border py-10 first:border-t-0 md:grid-cols-[280px_1fr]">
      <div>
        <h2 id={id} className="flex items-center gap-2 font-display text-xl font-medium tracking-tightest">
          {icon} {title}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">{hint}</p>
      </div>
      <div className="min-w-0 max-w-xl space-y-6">{children}</div>
    </section>
  );
}

interface NumberFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error: string | null;
  hint?: string;
  placeholder?: string;
  inputRef: React.Ref<HTMLInputElement>;
}

/** A whole number. Text with a numeric keyboard, not type="number": that one reads "3e" as empty, and empty means
 * "no limit" in some of these, which would change it without a word. */
function NumberField({ id, label, value, onChange, error, hint, placeholder, inputRef }: NumberFieldProps) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined;
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        ref={inputRef}
        id={id}
        inputMode="numeric"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        maxLength={4}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
      />
      <FieldError id={errorId} message={error} />
      {hint && (
        <p id={hintId} className="mt-1.5 text-xs text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}

/** The platform's parameters: general, the evaluations' defaults and the certificates, saved together. */
export function SettingsForm({ settings }: { settings: PlatformSettings }) {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [fields, setFields] = useState(() => fieldsOf(settings));
  const [attempted, setAttempted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  // The form starts over whenever the saved values change (after saving, or saved elsewhere). In place, not with a
  // `key`: a new form would take the focus from the button just pressed.
  const savedValues = JSON.stringify(fieldsOf(settings));
  const [shownValues, setShownValues] = useState(savedValues);
  if (shownValues !== savedValues) {
    setShownValues(savedValues);
    setFields(fieldsOf(settings));
    setAttempted(false);
  }
  const edit = (changes: Partial<Fields>) => {
    setServerError(null);
    setFields((current) => ({ ...current, ...changes }));
  };

  const zoneSelect = useRef<HTMLSelectElement>(null);
  const zoneInput = useRef<HTMLInputElement>(null);
  const passingField = useRef<HTMLInputElement>(null);
  const attemptsField = useRef<HTMLInputElement>(null);
  const validityField = useRef<HTMLInputElement>(null);
  const minScoreField = useRef<HTMLInputElement>(null);

  const values = valuesOf(fields);
  // A wrong value is said as it is typed; a required one left empty, once saving was tried.
  const requiredError = (value: number | null | undefined, message: string) =>
    value === undefined || (value === null && attempted) ? message : null;
  const errors = {
    timezone:
      values.timezone !== null
        ? null
        : fields.timezone.trim()
          ? MESSAGES.timezone
          : attempted
            ? MESSAGES.timezoneEmpty
            : null,
    passingScore: requiredError(values.passingScore, MESSAGES.passingScore),
    maxAttempts: requiredError(values.maxAttempts, MESSAGES.maxAttempts),
    validityMonths: values.validityMonths === undefined ? MESSAGES.validityMonths : null,
    minScore: values.minScore === undefined ? MESSAGES.minScore : null,
  };
  // In the order of the page: the first one gets the focus.
  const problems = [
    { invalid: values.timezone === null, field: fields.customZone ? zoneInput : zoneSelect },
    { invalid: values.passingScore == null, field: passingField },
    { invalid: values.maxAttempts == null, field: attemptsField },
    { invalid: values.validityMonths === undefined, field: validityField },
    { invalid: values.minScore === undefined, field: minScoreField },
  ].filter((problem) => problem.invalid);

  const patch = changesOf(values, fields, settings);
  const dirty = Object.keys(patch).length > 0 || problems.length > 0;
  useLeaveGuard(dirty, () =>
    confirm({
      title: "¿Salir sin guardar los parámetros?",
      description: "Los cambios que no guardaste se perderán.",
      confirmLabel: "Salir sin guardar",
      destructive: true,
    }),
  );

  const save = useMutation({
    mutationFn: (changes: SettingsPatch) => settingsApi.update(changes),
    onSuccess: (saved) => {
      queryClient.setQueryData(settingsKeys.all, saved);
      toast.success("Parámetros guardados");
    },
    onError: (error) => {
      // A value the server refuses says which one, in Spanish: next to the button that saved.
      if (error instanceof ApiError && error.status === 422) setServerError(error.message);
      else toastError(error);
    },
  });
  // Nothing to save, or a save on its way: "Guardar cambios" waits.
  const waiting = !dirty || save.isPending;

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (waiting) return; // Enter in a field, or the button that only looks disabled
        if (!problems.length) {
          save.mutate(patch);
          return;
        }
        // Show the problems before moving to the first one, so it is read out with its message.
        flushSync(() => setAttempted(true));
        problems[0].field.current?.focus();
      }}
    >
      <Section
        id="settings-general"
        icon={<Building2 className="h-5 w-5 text-accent" aria-hidden />}
        title="General"
        hint="Quién emite los certificados y en qué zona horaria se escriben las fechas."
      >
        <div>
          <Label htmlFor="settings-company">Nombre de la empresa</Label>
          <Input
            id="settings-company"
            value={fields.companyName}
            onChange={(event) => edit({ companyName: event.target.value })}
            maxLength={MAX_NAME}
            placeholder={DEFAULT_ISSUER}
            autoComplete="organization"
            aria-describedby="settings-company-hint"
          />
          <p id="settings-company-hint" className="mt-1.5 text-xs text-muted-foreground">
            Aparece como emisor en los certificados. Vacío: {DEFAULT_ISSUER}.
          </p>
        </div>
        <TimezoneField
          value={fields.timezone}
          custom={fields.customZone}
          error={errors.timezone}
          onChange={(timezone, customZone) => edit({ timezone, customZone })}
          selectRef={zoneSelect}
          inputRef={zoneInput}
        />
      </Section>

      <Section
        id="settings-evaluations"
        icon={<ClipboardCheck className="h-5 w-5 text-accent" aria-hidden />}
        title="Evaluaciones"
        hint="Con estos valores nace cada evaluación nueva, hecha a mano o propuesta por la IA. Cada una puede cambiarlos; las que ya existen no cambian."
      >
        <div className="grid gap-6 sm:grid-cols-2">
          <NumberField
            id="settings-passing-score"
            label="Nota mínima para aprobar (%)"
            value={fields.passingScore}
            onChange={(passingScore) => edit({ passingScore })}
            error={errors.passingScore}
            inputRef={passingField}
          />
          <NumberField
            id="settings-max-attempts"
            label="Intentos permitidos"
            value={fields.maxAttempts}
            onChange={(maxAttempts) => edit({ maxAttempts })}
            error={errors.maxAttempts}
            inputRef={attemptsField}
          />
        </div>
      </Section>

      <Section
        id="settings-certificates"
        icon={<Award className="h-5 w-5 text-accent" aria-hidden />}
        title="Certificados"
        hint="Cuándo se emiten y qué dicen. Los ya emitidos no cambian: cada uno guarda los datos del día en que salió."
      >
        <div className="border border-border bg-white">
          <SwitchRow
            id="settings-certificates-enabled"
            label="Emitir certificados automáticamente"
            hint="Al completar un curso o una ruta. Cada curso puede seguir este parámetro, o emitirlos siempre o nunca, en sus Ajustes."
            checked={fields.enabled}
            onCheckedChange={(enabled) => edit({ enabled })}
          />
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          <NumberField
            id="settings-validity"
            label="Vigencia (meses)"
            value={fields.validityMonths}
            onChange={(validityMonths) => edit({ validityMonths })}
            error={errors.validityMonths}
            hint="Vacío: no vencen."
            placeholder="No vencen"
            inputRef={validityField}
          />
          <NumberField
            id="settings-min-score"
            label="Nota mínima promedio (%)"
            value={fields.minScore}
            onChange={(minScore) => edit({ minScore })}
            error={errors.minScore}
            hint="Promedio de las mejores notas del curso. Vacío: cualquiera. Los cursos sin evaluación siempre califican."
            placeholder="Cualquiera"
            inputRef={minScoreField}
          />
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <Label htmlFor="settings-signer-name">Nombre de quien firma</Label>
            <Input
              id="settings-signer-name"
              value={fields.signerName}
              onChange={(event) => edit({ signerName: event.target.value })}
              maxLength={MAX_NAME}
              placeholder="Sin firma"
              autoComplete="off"
            />
          </div>
          <div>
            <Label htmlFor="settings-signer-title">Cargo de quien firma</Label>
            <Input
              id="settings-signer-title"
              value={fields.signerTitle}
              onChange={(event) => edit({ signerTitle: event.target.value })}
              maxLength={MAX_NAME}
              placeholder="Ej. Director de Formación"
              autoComplete="off"
            />
          </div>
        </div>
        <CertificatePreview
          companyName={fields.companyName}
          signerName={fields.signerName}
          signerTitle={fields.signerTitle}
          validityMonths={values.validityMonths ?? null}
          timezone={values.timezone}
          enabled={fields.enabled}
        />
      </Section>

      {/* Always at hand on a long page: what is left to save, and the button. */}
      <div className="sticky bottom-0 z-10 -mx-4 border-t border-border bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        {serverError && (
          <Alert variant="destructive" className="mb-3">
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        )}
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 text-sm text-muted-foreground" aria-live="polite">
            {dirty ? "Cambios sin guardar." : "Todo guardado."}
          </p>
          {/* Never `disabled` (nothing to save, or saving): the button just pressed would lose the focus. */}
          <Button
            type="submit"
            aria-disabled={waiting || undefined}
            aria-busy={save.isPending || undefined}
            className={cn("px-5 sm:px-6", waiting && "pointer-events-none opacity-45")}
          >
            {save.isPending && <Loader2 className="animate-spin" aria-hidden />}
            Guardar cambios
          </Button>
        </div>
      </div>
    </form>
  );
}
