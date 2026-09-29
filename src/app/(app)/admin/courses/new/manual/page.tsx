"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { LanguageField } from "@/components/courses/language-field";
import { PageHero } from "@/components/layout/page-hero";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { coursesApi } from "@/lib/api/courses";
import type { Language } from "@/lib/api/types";
import { useCourseCache } from "@/lib/hooks/use-course-cache";
import { toastError } from "@/lib/notify";

const STEPS = [
  "Crea el curso con su título.",
  "Agrega módulos: videos, documentos, grabaciones o lecturas.",
  "Añade evaluaciones y asigna a tu equipo.",
];

export default function NewManualCoursePage() {
  const router = useRouter();
  const { storeCourse } = useCourseCache();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [language, setLanguage] = useState<Language>("es");

  const create = useMutation({
    mutationFn: () => coursesApi.create({ title: title.trim(), description: description.trim(), language, source: "manual" }),
    onSuccess: (course) => {
      storeCourse(course);
      toast.success("Curso creado. Ahora agrega sus módulos.");
      router.push(`/admin/courses/${course.id}`);
    },
    onError: toastError,
  });

  return (
    <>
      <PageHero
        eyebrow="Nuevo curso · Con mi material"
        title="Empecemos por lo básico"
        description="Después agregas el contenido módulo por módulo, con tus videos, documentos o grabaciones."
      />
      <section className="container grid gap-12 py-12 lg:grid-cols-[1fr_320px]">
        <form
          className="max-w-2xl space-y-6"
          onSubmit={(event) => {
            event.preventDefault();
            if (title.trim()) create.mutate();
          }}
        >
          <div>
            <Label htmlFor="course-title">Título del curso</Label>
            <Input
              id="course-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ej. Seguridad en planta"
              maxLength={300}
              autoFocus
              required
            />
          </div>
          <div>
            <Label htmlFor="course-description">Descripción (opcional)</Label>
            <Textarea
              id="course-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Qué aprenderá el equipo y por qué importa"
              maxLength={5000}
            />
          </div>
          <LanguageField value={language} onChange={setLanguage} className="max-w-xs" />
          <div className="flex flex-wrap gap-3 pt-2">
            <Button type="submit" variant="accent" size="lg" loading={create.isPending} disabled={!title.trim()}>
              Crear y agregar contenido <ArrowRight />
            </Button>
            <Button variant="ghost" size="lg" asChild>
              <Link href="/admin/courses/new">
                <ArrowLeft /> Volver
              </Link>
            </Button>
          </div>
        </form>
        <aside className="h-fit border border-border bg-mist p-6">
          <p className="eyebrow mb-4">Cómo funciona</p>
          <ol className="space-y-4">
            {STEPS.map((step, index) => (
              <li key={step} className="flex gap-3 text-sm">
                <span className="font-display text-xl font-semibold leading-none text-accent">{index + 1}</span>
                {step}
              </li>
            ))}
          </ol>
        </aside>
      </section>
    </>
  );
}
