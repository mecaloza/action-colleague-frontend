"use client";

import { useState } from "react";
import { notFound, useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { FileText, HelpCircle } from "lucide-react";
import { ModuleVideo } from "@/components/courses/module-video";
import { BackLink } from "@/components/layout/back-link";
import { EmptyState } from "@/components/layout/empty-state";
import { PageError, PageLoading } from "@/components/layout/query-state";
import { Reading } from "@/components/learn/reading";
import { Button } from "@/components/ui/button";
import { courseKeys, coursesApi } from "@/lib/api/courses";
import type { LearnerModule } from "@/lib/api/types";
import { formatDuration, plural, twoDigits } from "@/lib/format";
import { safeHttpUrl } from "@/lib/safe-url";
import { cn } from "@/lib/utils";

function ModuleContent({ module }: { module: LearnerModule }) {
  return (
    <article className="space-y-6">
      <div>
        <p className="eyebrow mb-3">Módulo {module.order}</p>
        <h2 className="display-md">{module.title}</h2>
        {module.description && <p className="mt-3 text-muted-foreground">{module.description}</p>}
      </div>
      <ModuleVideo module={module} />
      {module.document && safeHttpUrl(module.document.url) && (
        <Button variant="outline" asChild>
          <a href={safeHttpUrl(module.document.url)} target="_blank" rel="noreferrer">
            <FileText /> Abrir documento
          </a>
        </Button>
      )}
      {module.content_text && <Reading text={module.content_text} />}
      {!module.video && !module.document && !module.content_text && (
        <EmptyState icon={<FileText />} title="Este módulo aún no tiene contenido" />
      )}
      {module.quiz && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <HelpCircle className="h-4 w-4 text-accent" />
          Evaluación de {plural(module.quiz.question_count, "pregunta")} · aprueba con {module.quiz.passing_score}% ·{" "}
          {plural(module.quiz.max_attempts, "intento")}
        </p>
      )}
    </article>
  );
}

function moduleSubtitle(module: LearnerModule): string {
  if (module.duration_seconds) return formatDuration(module.duration_seconds);
  return module.quiz ? "Con evaluación" : "Lectura";
}

interface ModuleNavProps {
  modules: LearnerModule[];
  selected: number;
  onSelect: (index: number) => void;
}

function ModuleNav({ modules, selected, onSelect }: ModuleNavProps) {
  return (
    <nav aria-label="Módulos del curso">
      <ol className="space-y-1">
        {modules.map((module, index) => (
          <li key={module.id}>
            <button
              type="button"
              onClick={() => onSelect(index)}
              aria-current={index === selected ? "step" : undefined}
              className={cn(
                "flex w-full items-start gap-3 border-l-2 px-4 py-3 text-left transition-colors",
                index === selected ? "border-accent bg-mist" : "border-transparent hover:bg-mist/60",
              )}
            >
              <span className="font-display text-lg font-semibold leading-tight text-accent">
                {twoDigits(module.order)}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-semibold">{module.title}</span>
                <span className="text-xs text-muted-foreground">{moduleSubtitle(module)}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** The course exactly as a learner sees it (every module unlocked, no progress saved). */
export default function CoursePreviewPage() {
  const params = useParams<{ id: string }>();
  const courseId = Number(params.id);
  const validId = Number.isInteger(courseId) && courseId > 0;
  const preview = useQuery({
    queryKey: courseKeys.preview(courseId),
    queryFn: () => coursesApi.preview(courseId),
    enabled: validId,
  });
  const [selected, setSelected] = useState(0);

  if (!validId) notFound();
  if (preview.isPending) return <PageLoading bodyClassName="aspect-video" />;
  if (!preview.data) return <PageError query={preview} />;

  const { course, modules } = preview.data;
  const current = modules[Math.min(selected, modules.length - 1)];

  return (
    <>
      <section className="band-dark">
        <div className="container relative z-10 flex flex-col gap-4 py-8 md:flex-row md:items-end md:justify-between">
          <div>
            <BackLink href={`/admin/courses/${courseId}`}>Volver al editor</BackLink>
            <p className="eyebrow mb-2 mt-6 text-white/60">Vista previa</p>
            <h1 className="display-lg text-white">{course.title}</h1>
          </div>
          <p className="max-w-sm text-sm text-white/60">
            Así lo ve una persona asignada. En la vista previa todos los módulos están abiertos y nada se guarda.
          </p>
        </div>
      </section>

      {modules.length === 0 ? (
        <div className="container py-12">
          <EmptyState icon={<FileText />} title="El curso aún no tiene módulos" />
        </div>
      ) : (
        <div className="container grid gap-10 py-10 lg:grid-cols-[300px_1fr]">
          <ModuleNav modules={modules} selected={selected} onSelect={setSelected} />
          {current && <ModuleContent module={current} />}
        </div>
      )}
    </>
  );
}
