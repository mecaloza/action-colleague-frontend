"use client";

import { notFound, useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CourseHeader } from "@/components/courses/course-header";
import { EvaluationsTab } from "@/components/courses/evaluations-tab";
import { ModulesTab } from "@/components/courses/modules-tab";
import { ParticipantsTab } from "@/components/courses/participants-tab";
import { ResultsTab } from "@/components/courses/results-tab";
import { SettingsTab } from "@/components/courses/settings-tab";
import { PageError, PageLoading } from "@/components/layout/query-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { courseKeys, coursesApi } from "@/lib/api/courses";
import type { CourseDetail } from "@/lib/api/types";

/** While a module is still being generated, the editor refetches every few seconds. */
const GENERATION_POLL_MS = 4000;

function hasPendingGeneration(course: CourseDetail | undefined): boolean {
  return course?.modules.some((m) => m.generation_status === "queued" || m.generation_status === "generating") ?? false;
}

export default function CourseEditorPage() {
  const params = useParams<{ id: string }>();
  const courseId = Number(params.id);
  const validId = Number.isInteger(courseId) && courseId > 0;

  const courseQuery = useQuery({
    queryKey: courseKeys.detail(courseId),
    queryFn: () => coursesApi.get(courseId),
    enabled: validId,
    refetchInterval: (query) => (hasPendingGeneration(query.state.data) ? GENERATION_POLL_MS : false),
  });

  if (!validId) notFound();
  if (courseQuery.isPending) return <PageLoading />;
  // Only when there is nothing to show: a failed poll keeps the editor (and unsaved drafts) on screen.
  if (!courseQuery.data) return <PageError query={courseQuery} />;

  const course = courseQuery.data;

  return (
    <>
      <CourseHeader course={course} />

      <div className="container py-10">
        <Tabs defaultValue="modules">
          <div className="relative">
            <TabsList>
              <TabsTrigger value="modules">Contenido</TabsTrigger>
              <TabsTrigger value="evaluations">Evaluaciones</TabsTrigger>
              <TabsTrigger value="participants">Participantes</TabsTrigger>
              <TabsTrigger value="results">Resultados</TabsTrigger>
              <TabsTrigger value="settings">Ajustes</TabsTrigger>
            </TabsList>
            {/* On phones the tabs scroll sideways: the fade hints there is more. */}
            <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-background md:hidden" />
          </div>
          <TabsContent value="modules">
            <ModulesTab course={course} />
          </TabsContent>
          <TabsContent value="evaluations" forceMount className="data-[state=inactive]:hidden">
            <EvaluationsTab course={course} />
          </TabsContent>
          <TabsContent value="participants">
            <ParticipantsTab course={course} />
          </TabsContent>
          <TabsContent value="results">
            <ResultsTab course={course} />
          </TabsContent>
          <TabsContent value="settings">
            <SettingsTab course={course} />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
