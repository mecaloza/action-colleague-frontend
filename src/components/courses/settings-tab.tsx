"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { coursesApi } from "@/lib/api/courses";
import type { CourseDetail, Language } from "@/lib/api/types";
import { useCourseCache } from "@/lib/hooks/use-course-cache";
import { toastError } from "@/lib/notify";
import { LanguageField } from "./language-field";

function SettingsForm({ course }: { course: CourseDetail }) {
  const { storeCourse } = useCourseCache();
  const [title, setTitle] = useState(course.title);
  const [description, setDescription] = useState(course.description);
  const [language, setLanguage] = useState<Language>(course.language);
  const [audience, setAudience] = useState(course.settings.audience);

  const save = useMutation({
    mutationFn: () => coursesApi.update(course.id, { title: title.trim(), description, language, settings: { audience } }),
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
        <Textarea id="course-description" value={description} onChange={(event) => setDescription(event.target.value)} />
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        <LanguageField value={language} onChange={setLanguage} />
        <div>
          <Label htmlFor="course-audience">Audiencia</Label>
          <Input id="course-audience" value={audience} onChange={(event) => setAudience(event.target.value)} placeholder="Ej. operarios de planta" />
        </div>
      </div>
      <Button type="submit" loading={save.isPending} disabled={!title.trim()}>
        Guardar cambios
      </Button>
    </form>
  );
}

export function SettingsTab({ course }: { course: CourseDetail }) {
  // The form starts over whenever the saved values change (after saving, or edited elsewhere).
  const savedValues = JSON.stringify([course.title, course.description, course.language, course.settings.audience]);
  return <SettingsForm key={savedValues} course={course} />;
}
