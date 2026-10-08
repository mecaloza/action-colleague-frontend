"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { coursesApi } from "@/lib/api/courses";
import { settingsApi, settingsKeys } from "@/lib/api/settings";
import type { CourseDetail, Language } from "@/lib/api/types";
import { useCourseCache } from "@/lib/hooks/use-course-cache";
import { toastError } from "@/lib/notify";
import { CoverPicker } from "./cover-picker";
import { LanguageField } from "./language-field";

/** The course's certificate choice: the platform's parameter (null), always (true) or never (false). */
type CertificateChoice = "platform" | "yes" | "no";

const choiceOf = (value: boolean | null | undefined): CertificateChoice =>
  value === true ? "yes" : value === false ? "no" : "platform";
const CHOICE_VALUES: Record<CertificateChoice, boolean | null> = { platform: null, yes: true, no: false };

function ruleOf(choice: CertificateChoice, platformEnabled: boolean | undefined): string {
  if (choice === "no") return "Quien lo complete no recibe certificado (se le puede emitir a mano).";
  if (choice === "yes") return "Quien lo complete recibe certificado, aunque la emisión automática esté apagada en Parámetros.";
  if (platformEnabled === undefined) return "Sigue lo que digan los Parámetros.";
  return platformEnabled
    ? "Hoy los Parámetros emiten certificados al completar un curso."
    : "Hoy los Parámetros no emiten certificados automáticamente.";
}

/** What "Usar el parámetro general" does today (nothing until the parameters load). */
function PlatformCertificateHint({ choice }: { choice: CertificateChoice }) {
  const settings = useQuery({ queryKey: settingsKeys.all, queryFn: settingsApi.get });
  const certificates = settings.data?.certificates;
  const rule = ruleOf(choice, certificates?.enabled);
  const minimum =
    choice !== "no" && certificates?.min_score != null
      ? ` Necesita una calificación promedio de al menos ${certificates.min_score}% en sus evaluaciones.`
      : "";
  return (
    <p id="course-certificate-hint" className="mt-1.5 text-xs text-muted-foreground">
      {rule}
      {minimum}
    </p>
  );
}

function SettingsForm({ course }: { course: CourseDetail }) {
  const { storeCourse } = useCourseCache();
  const [title, setTitle] = useState(course.title);
  const [description, setDescription] = useState(course.description);
  const [language, setLanguage] = useState<Language>(course.language);
  const [audience, setAudience] = useState(course.settings.audience);
  const [certificate, setCertificate] = useState<CertificateChoice>(choiceOf(course.settings.certificate));

  const save = useMutation({
    mutationFn: () =>
      coursesApi.update(course.id, {
        title: title.trim(),
        description,
        language,
        settings: { audience, certificate: CHOICE_VALUES[certificate] },
      }),
    onSuccess: (updated) => {
      storeCourse(updated);
      toast.success("Cambios guardados");
    },
    onError: toastError,
  });

  return (
    <form
      className="max-w-2xl space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <div>
        <Label htmlFor="course-title">Título</Label>
        <Input id="course-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={300} required />
      </div>
      <div>
        <Label htmlFor="course-description">Descripción</Label>
        <Textarea
          id="course-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          maxLength={5000}
        />
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        <LanguageField value={language} onChange={setLanguage} />
        <div>
          <Label htmlFor="course-audience">Audiencia</Label>
          <Input
            id="course-audience"
            value={audience}
            onChange={(event) => setAudience(event.target.value)}
            placeholder="Ej. operarios de planta"
            maxLength={500}
          />
        </div>
      </div>
      <div className="sm:max-w-sm">
        <Label htmlFor="course-certificate">Certificado al completar</Label>
        <Select
          id="course-certificate"
          value={certificate}
          onChange={(event) => setCertificate(event.target.value as CertificateChoice)}
          aria-describedby="course-certificate-hint"
        >
          <option value="platform">Usar el parámetro general</option>
          <option value="yes">Sí</option>
          <option value="no">No</option>
        </Select>
        <PlatformCertificateHint choice={certificate} />
      </div>
      <Button type="submit" loading={save.isPending} disabled={!title.trim()}>
        Guardar cambios
      </Button>
    </form>
  );
}

export function SettingsTab({ course }: { course: CourseDetail }) {
  // The form starts over whenever the saved values change (after saving, or edited elsewhere).
  const savedValues = JSON.stringify([
    course.title,
    course.description,
    course.language,
    course.settings.audience,
    course.settings.certificate ?? null,
  ]);
  return (
    <div className="max-w-3xl space-y-10">
      <section>
        <p className="mb-3 text-[11px] font-bold uppercase tracking-label text-ink-700">Portada</p>
        <CoverPicker course={course} />
      </section>
      <SettingsForm key={savedValues} course={course} />
    </div>
  );
}
