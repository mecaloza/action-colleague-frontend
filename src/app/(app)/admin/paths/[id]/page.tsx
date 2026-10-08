"use client";

import { Suspense } from "react";
import Link from "next/link";
import { notFound, useParams, usePathname, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Route } from "lucide-react";
import { EmptyState } from "@/components/layout/empty-state";
import { PageError, PageLoading } from "@/components/layout/query-state";
import { PathCoursesTab } from "@/components/paths/path-courses-tab";
import { PathHeader } from "@/components/paths/path-header";
import { PathPeopleTab } from "@/components/paths/path-people-tab";
import { PathSettingsTab } from "@/components/paths/path-settings-tab";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiError } from "@/lib/api/client";
import { pathKeys, pathsApi } from "@/lib/api/paths";

/** The path's sections, in order: `?tab=` opens one (a link to its people, its settings...). */
const TABS = [
  { value: "courses", label: "Cursos" },
  { value: "people", label: "Personas" },
  { value: "settings", label: "Ajustes" },
] as const;

type TabValue = (typeof TABS)[number]["value"];

const isTab = (value: string | null): value is TabValue => TABS.some((tab) => tab.value === value);

function PathEditor() {
  const params = useParams<{ id: string }>();
  const pathId = Number(params.id);
  const validId = Number.isInteger(pathId) && pathId > 0;
  const pathname = usePathname();
  const requested = useSearchParams().get("tab");
  const tab: TabValue = isTab(requested) ? requested : "courses";

  const pathQuery = useQuery({ queryKey: pathKeys.detail(pathId), queryFn: () => pathsApi.get(pathId), enabled: validId });

  if (!validId) notFound();
  if (pathQuery.isPending) return <PageLoading />;
  if (!pathQuery.data) {
    if (pathQuery.error instanceof ApiError && pathQuery.error.status === 404) {
      return (
        <div className="container py-12">
          <EmptyState
            icon={<Route />}
            title="Esta ruta ya no existe"
            description="Puede que alguien la haya eliminado."
            action={
              <Button variant="outline" asChild>
                <Link href="/admin/paths">
                  <ArrowLeft /> Volver a las rutas
                </Link>
              </Button>
            }
          />
        </div>
      );
    }
    return <PageError query={pathQuery} />;
  }

  const path = pathQuery.data;
  const counts: Partial<Record<TabValue, number>> = { courses: path.courses.length, people: path.people_count };
  // The section lives in the address (the first one keeps it clean): reloads and shared links land on it. Through
  // `history`, not the router: the tab changes at once, without asking the server for the page again.
  const show = (value: string) => {
    if (isTab(value)) window.history.replaceState(null, "", value === "courses" ? pathname : `${pathname}?tab=${value}`);
  };

  return (
    <>
      <PathHeader path={path} />

      <div className="container py-10">
        <Tabs value={tab} onValueChange={show}>
          <TabsList>
            {TABS.map(({ value, label }) => (
              <TabsTrigger key={value} value={value}>
                {label}
                {counts[value] !== undefined && <span className="font-semibold text-muted-foreground">{counts[value]}</span>}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="courses">
            <PathCoursesTab path={path} />
          </TabsContent>
          <TabsContent value="people">
            <PathPeopleTab path={path} />
          </TabsContent>
          {/* Kept mounted: switching tabs never loses unsaved settings. */}
          <TabsContent value="settings" forceMount className="data-[state=inactive]:hidden">
            <PathSettingsTab path={path} />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}

export default function PathEditorPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <PathEditor />
    </Suspense>
  );
}
