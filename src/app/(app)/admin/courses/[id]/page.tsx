"use client";

import { Suspense } from "react";
import { notFound, useParams, usePathname, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CourseHeader } from "@/components/courses/course-header";
import { ActivitiesTab } from "@/components/courses/activities-tab";
import { EvaluationsTab } from "@/components/courses/evaluations-tab";
import { ModulesTab } from "@/components/courses/modules-tab";
import { ParticipantsTab } from "@/components/courses/participants-tab";
import { ResultsTab } from "@/components/courses/results-tab";
import { SettingsTab } from "@/components/courses/settings-tab";
import { PageError, PageLoading } from "@/components/layout/query-state";
import { isReviewing } from "@/components/studio/qa";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { courseKeys, coursesApi } from "@/lib/api/courses";
import type { CourseDetail } from "@/lib/api/types";

/** While a module is still being generated (or its video reviewed), the editor refetches every few seconds. */
const GENERATION_POLL_MS = 4000;

/** The editor's sections, in order: `?tab=` opens one (a link to a course's participants, its evaluations...). */
const TABS = [
  { value: "modules", label: "Contenido" },
  { value: "evaluations", label: "Evaluaciones" },
  { value: "activities", label: "Actividades" },
  { value: "participants", label: "Participantes" },
  { value: "results", label: "Resultados" },
  { value: "settings", label: "Ajustes" },
] as const;

type TabValue = (typeof TABS)[number]["value"];

const isTab = (value: string | null): value is TabValue => TABS.some((tab) => tab.value === value);

function hasPendingWork(course: CourseDetail | undefined): boolean {
  return (
    course?.modules.some(
      (m) => m.generation_status === "queued" || m.generation_status === "generating" || isReviewing(m.review),
    ) ?? false
  );
}

function CourseEditor() {
  const params = useParams<{ id: string }>();
  const courseId = Number(params.id);
  const validId = Number.isInteger(courseId) && courseId > 0;
  const pathname = usePathname();
  const requested = useSearchParams().get("tab");
  const tab: TabValue = isTab(requested) ? requested : "modules";

  const courseQuery = useQuery({
    queryKey: courseKeys.detail(courseId),
    queryFn: () => coursesApi.get(courseId),
    enabled: validId,
    refetchInterval: (query) => (hasPendingWork(query.state.data) ? GENERATION_POLL_MS : false),
  });

  if (!validId) notFound();
  if (courseQuery.isPending) return <PageLoading />;
  // Only when there is nothing to show: a failed poll keeps the editor (and unsaved drafts) on screen.
  if (!courseQuery.data) return <PageError query={courseQuery} />;

  const course = courseQuery.data;
  // The section lives in the address (the first one keeps it clean): reloads and shared links land on it. Through
  // `history`, not the router: the tab changes at once, without asking the server for the page again.
  const show = (value: string) => {
    if (isTab(value)) window.history.replaceState(null, "", value === "modules" ? pathname : `${pathname}?tab=${value}`);
  };

  return (
    <>
      <CourseHeader course={course} />

      <div className="container py-10">
        <Tabs value={tab} onValueChange={show}>
          {/* Six tabs don't fit a phone: there, a list to pick the section. */}
          <div className="sm:hidden">
            <Label htmlFor="course-section">Sección del curso</Label>
            <Select id="course-section" value={tab} onChange={(event) => show(event.target.value)}>
              {TABS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
          <div className="relative hidden sm:block">
            <TabsList>
              {TABS.map(({ value, label }) => (
                <TabsTrigger key={value} value={value}>
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
            {/* Until md the tabs scroll sideways: the fade hints there is more. */}
            <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-background md:hidden" />
          </div>
          <TabsContent value="modules">
            <ModulesTab course={course} />
          </TabsContent>
          <TabsContent value="evaluations" forceMount className="data-[state=inactive]:hidden">
            <EvaluationsTab course={course} />
          </TabsContent>
          <TabsContent value="activities">
            <ActivitiesTab course={course} />
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

export default function CourseEditorPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <CourseEditor />
    </Suspense>
  );
}
