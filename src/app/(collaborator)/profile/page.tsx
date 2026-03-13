"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/auth-context";
import { api } from "@/lib/api";
import { Enrollment } from "@/lib/types";
import {
  Mail,
  Building,
  Briefcase,
  Shield,
  Users,
  BookOpen,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useTranslations } from "next-intl";

export default function ProfilePage() {
  const t = useTranslations("profile");
  const { user } = useAuth();
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);

  useEffect(() => {
    if (user) {
      api
        .getEnrollments(user.id)
        .then(setEnrollments)
        .catch(() => setEnrollments([]));
    }
  }, [user]);

  if (!user) return null;

  const completedCourses = enrollments.filter(
    (e) => e.status === "completed"
  );
  const inProgressCourses = enrollments.filter(
    (e) => e.status === "in_progress" || e.status === "enrolled"
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* User Info Card */}
        <Card className="lg:col-span-1">
          <CardContent className="flex flex-col items-center pt-6">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-primary-foreground text-2xl font-bold">
              {user.name.charAt(0)}
            </div>
            <h2 className="mt-4 text-xl font-semibold">{user.name}</h2>
            <p className="text-sm text-muted-foreground">{user.position}</p>
            <Badge className="mt-2" variant="secondary">
              {user.role}
            </Badge>

            <div className="mt-6 w-full space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>{user.email}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Building className="h-4 w-4 text-muted-foreground" />
                <span>{user.department || t("emptyValue")}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Briefcase className="h-4 w-4 text-muted-foreground" />
                <span>{user.position || t("emptyValue")}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span>{t("leader")}: {user.leader_name || t("none")}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Role & Permissions + Courses */}
        <div className="lg:col-span-2 space-y-6">
          {/* Role & Permissions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                {t("rolePermissions")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">{t("role")}</p>
                  <p className="text-sm font-medium capitalize">{user.role}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">{t("permissions")}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {user.role === "admin" ? (
                      <>
                        <Badge variant="outline" className="text-xs">
                          {t("permission.manageUsers")}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {t("permission.manageCourses")}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {t("permission.viewReports")}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {t("permission.generateDocuments")}
                        </Badge>
                      </>
                    ) : (
                      <>
                        <Badge variant="outline" className="text-xs">
                          {t("permission.viewCourses")}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {t("permission.takeQuizzes")}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {t("permission.viewDocuments")}
                        </Badge>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Enrolled Courses */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                {t("enrolledCourses")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {enrollments.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("noCourses")}
                </p>
              ) : (
                <div className="space-y-3">
                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="flex items-center gap-2 rounded-lg border p-3">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                      <div>
                        <p className="text-lg font-semibold">
                          {completedCourses.length}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t("completed")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 rounded-lg border p-3">
                      <Clock className="h-5 w-5 text-blue-600" />
                      <div>
                        <p className="text-lg font-semibold">
                          {inProgressCourses.length}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t("inProgress")}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Course list */}
                  {enrollments.map((enrollment) => (
                    <div
                      key={enrollment.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">
                          {enrollment.course.title}
                        </p>
                        <div className="mt-1 flex items-center gap-2">
                          <Progress
                            value={enrollment.progress}
                            className="h-1.5 flex-1"
                          />
                          <span className="text-xs text-muted-foreground shrink-0">
                            {enrollment.progress}%
                          </span>
                        </div>
                      </div>
                      <Badge
                        variant={
                          enrollment.status === "completed"
                            ? "default"
                            : "secondary"
                        }
                        className="ml-3 shrink-0"
                      >
                        {enrollment.status === "completed"
                          ? t("done")
                          : enrollment.status === "in_progress"
                          ? t("inProgress")
                          : t("enrolled")}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
