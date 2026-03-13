"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { api } from "@/lib/api";
import { BookOpen, CheckCircle, Clock, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

type MyCourse = {
  enrollment_id: number;
  course_id: number;
  course_title: string;
  course_description: string;
  status: string;
  progress_pct: number;
  total_modules: number;
  completed_modules: number;
  enrolled_at: string;
};

export default function MyCoursesPage() {
  const t = useTranslations("collaboratorCourses");
  const [courses, setCourses] = useState<MyCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .myCourses()
      .then(setCourses)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <p className="text-red-400">Error: {error}</p>
      </div>
    );
  }

  const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    assigned: { label: "Asignado", color: "bg-blue-600", icon: <Clock className="h-4 w-4" /> },
    in_progress: { label: "En Progreso", color: "bg-yellow-600", icon: <BookOpen className="h-4 w-4" /> },
    completed: { label: "Completado", color: "bg-green-600", icon: <CheckCircle className="h-4 w-4" /> },
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground mt-1">
          {t("subtitle")}
        </p>
      </div>

      {courses.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>{t("empty")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {courses.map((c) => {
            const cfg = statusConfig[c.status] || statusConfig.assigned;
            return (
              <Link key={c.enrollment_id} href={`/courses/${c.course_id}`}>
                <Card className="hover:border-violet-500/40 transition-colors cursor-pointer h-full">
                  <CardContent className="pt-6 space-y-4">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold line-clamp-2">{c.course_title}</h3>
                      <Badge className={`${cfg.color} text-white shrink-0 flex items-center gap-1`}>
                        {cfg.icon}
                        {cfg.label}
                      </Badge>
                    </div>

                    {c.course_description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {c.course_description}
                      </p>
                    )}

                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{t("progress")}</span>
                        <span className="font-medium">{c.progress_pct.toFixed(0)}%</span>
                      </div>
                      <Progress value={c.progress_pct} className="h-2" />
                      <p className="text-xs text-muted-foreground">
                        {t("completedModules", { completed: c.completed_modules, total: c.total_modules })}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
