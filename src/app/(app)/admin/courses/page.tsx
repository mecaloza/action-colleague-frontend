"use client";

import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { BookOpen, Search } from "lucide-react";
import { CourseCard, CourseCardSkeleton } from "@/components/courses/course-card";
import { NewCourseButton } from "@/components/courses/new-course-button";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHero } from "@/components/layout/page-hero";
import { QueryError } from "@/components/layout/query-state";
import { Input } from "@/components/ui/input";
import { courseKeys, coursesApi } from "@/lib/api/courses";
import type { CourseStatus } from "@/lib/api/types";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { cn } from "@/lib/utils";

type StatusFilterValue = CourseStatus | "all";

const FILTERS: { value: StatusFilterValue; label: string }[] = [
  { value: "all", label: "Activos" }, // published and drafts; archived ones have their own tab
  { value: "published", label: "Publicados" },
  { value: "draft", label: "Borradores" },
  { value: "archived", label: "Archivados" },
];

const COURSE_GRID = "grid gap-6 sm:grid-cols-2 lg:grid-cols-3";

function StatusFilter({ value, onChange }: { value: StatusFilterValue; onChange: (value: StatusFilterValue) => void }) {
  return (
    <div role="group" aria-label="Filtrar cursos" className="scrollbar-thin flex gap-6 overflow-x-auto border-b border-border">
      {FILTERS.map((filter) => (
        <button
          key={filter.value}
          type="button"
          aria-pressed={value === filter.value}
          onClick={() => onChange(filter.value)}
          className={cn(
            "-mb-px whitespace-nowrap border-b-2 pb-3 text-[11.5px] font-bold uppercase tracking-label transition-colors",
            value === filter.value ? "border-accent text-ink-800" : "border-transparent text-muted-foreground hover:text-ink-800",
          )}
        >
          {filter.label}
        </button>
      ))}
    </div>
  );
}

export default function CoursesPage() {
  const [filter, setFilter] = useState<StatusFilterValue>("all");
  const [search, setSearch] = useState("");
  const searchTerm = useDebouncedValue(search.trim());
  const params = { status: filter === "all" ? undefined : filter, q: searchTerm || undefined };
  const isFiltered = Boolean(searchTerm) || filter !== "all";

  const courses = useQuery({
    queryKey: courseKeys.list(params),
    queryFn: () => coursesApi.list(params),
    placeholderData: keepPreviousData, // typing a search keeps the current cards instead of flashing skeletons
    // Keep the "Generando" badges live while any course is being produced.
    refetchInterval: (query) => (query.state.data?.some((course) => course.generating_count > 0) ? 5000 : false),
  });

  return (
    <>
      <PageHero
        eyebrow="Estudio de cursos"
        title="Cursos"
        description="Crea cursos con IA a partir de tus documentos, o arma uno con tus propios videos y materiales."
        actions={<NewCourseButton size="lg" />}
      />

      <section className="container py-10">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <StatusFilter value={filter} onChange={setFilter} />
          <div className="relative w-full md:w-80">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por título o descripción"
              className="pl-10"
              aria-label="Buscar cursos"
              maxLength={200}
            />
          </div>
        </div>

        {courses.isLoading ? (
          <div className={COURSE_GRID}>
            {Array.from({ length: 6 }).map((_, index) => (
              <CourseCardSkeleton key={index} />
            ))}
          </div>
        ) : courses.error ? (
          <QueryError query={courses} />
        ) : courses.data?.length ? (
          <div className={COURSE_GRID}>
            {courses.data.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<BookOpen />}
            title={isFiltered ? "No hay cursos que coincidan" : "Todavía no hay cursos"}
            description={
              isFiltered
                ? "Prueba con otro filtro o término de búsqueda."
                : "Crea tu primer curso con IA o con el material que ya tienes."
            }
            action={<NewCourseButton />}
          />
        )}
      </section>
    </>
  );
}
