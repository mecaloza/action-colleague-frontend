"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { CollaboratorDashboard } from "@/lib/types";
import { BookOpen, Clock, Award, TrendingUp, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";

export default function CollaboratorDashboardPage() {
  const t = useTranslations("collaboratorDashboard");
  const { user } = useAuth();
  const [data, setData] = useState<CollaboratorDashboard | null>(null);

  useEffect(() => {
    if (user) {
      api.getCollaboratorDashboard(user.id).then(setData);
    }
  }, [user]);

  if (!data) {
    return <div className="flex items-center justify-center p-12 text-muted-foreground">{t("loading")}</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t("stats.inProgress")}</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.in_progress_courses}</div>
            <p className="text-xs text-muted-foreground">{t("stats.activeCourses")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t("stats.completed")}</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.completed_courses}</div>
            <p className="text-xs text-muted-foreground">{t("stats.finishedCourses")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t("stats.totalHours")}</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.total_hours}h</div>
            <p className="text-xs text-muted-foreground">{t("stats.learningTime")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t("stats.totalEnrolled")}</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.enrollments.length}</div>
            <p className="text-xs text-muted-foreground">{t("stats.allCourses")}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-xl font-semibold">{t("myCourses")}</h2>
          {data.enrollments.map((enrollment) => (
            <Link key={enrollment.id} href={`/courses/${enrollment.course_id}`}>
              <Card className="cursor-pointer transition-shadow hover:shadow-md mb-4">
                <CardContent className="flex items-center gap-4 py-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium">{enrollment.course.title}</h3>
                      <Badge
                        variant={enrollment.status === "completed" ? "default" : "secondary"}
                      >
                        {enrollment.status.replace("_", " ")}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      {enrollment.course.category} &middot; {enrollment.course.duration_hours}h
                    </p>
                    <div className="flex items-center gap-2">
                      <Progress value={enrollment.progress} className="h-2 flex-1" />
                      <span className="text-sm font-medium w-10 text-right">
                        {enrollment.progress}%
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">{t("recentActivity")}</h2>
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                {data.recent_activity.map((activity, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="mt-1 h-2 w-2 rounded-full bg-primary" />
                    <div>
                      <p className="text-sm font-medium">{activity.action}</p>
                      <p className="text-xs text-muted-foreground">{activity.course}</p>
                      <p className="text-xs text-muted-foreground">{activity.date}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
