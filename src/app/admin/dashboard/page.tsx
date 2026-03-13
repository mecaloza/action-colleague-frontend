/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { BookOpen, Users, TrendingUp, Award, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useTranslations } from "next-intl";

const statIcons = [
  { icon: BookOpen, bg: "bg-violet-500/10", color: "text-violet-400" },
  { icon: Users, bg: "bg-blue-500/10", color: "text-blue-400" },
  { icon: TrendingUp, bg: "bg-emerald-500/10", color: "text-emerald-400" },
  { icon: Award, bg: "bg-amber-500/10", color: "text-amber-400" },
];

interface DashboardData {
  total_courses: number;
  total_users: number;
  total_enrollments: number;
  completed_enrollments: number;
  active_enrollments: number;
  total_certificates: number;
}

export default function AdminDashboard() {
  const t = useTranslations("adminDashboard");
  const [stats, setStats] = useState<DashboardData | null>(null);
  const [error, setError] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    api
      .getAdminDashboard()
      .then((data: any) => {
        setStats({
          total_courses: data.total_courses ?? 0,
          total_users: data.total_users ?? data.total_employees ?? 0,
          total_enrollments: data.total_enrollments ?? 0,
          completed_enrollments: data.completed_enrollments ?? 0,
          active_enrollments: data.active_enrollments ?? 0,
          total_certificates: data.total_certificates ?? 0,
        });
      })
      .catch(() => setError(true));
  }, []);

  if (error) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-muted-foreground">{t("loadError")}</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
      </div>
    );
  }

  const completionRate =
    stats.total_enrollments > 0
      ? Math.round((stats.completed_enrollments / stats.total_enrollments) * 100)
      : 0;

  const statCards = [
    { label: t("stats.courses"), value: stats.total_courses, sub: t("stats.coursesSub") },
    { label: t("stats.employees"), value: stats.total_users, sub: t("stats.employeesSub") },
    { label: t("stats.activeEnrollments"), value: stats.active_enrollments, sub: t("stats.activeEnrollmentsSub") },
    { label: t("stats.completionRate"), value: `${completionRate}%`, sub: t("stats.completionRateSub", { completed: stats.completed_enrollments, total: stats.total_enrollments }) },
  ];

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-xl border border-white/[0.08] bg-gradient-to-r from-violet-600/20 via-purple-600/10 to-transparent p-6 backdrop-blur-xl">
        <div className="absolute top-0 right-0 h-full w-1/3 bg-gradient-to-l from-violet-500/10 to-transparent" />
        <h1 className="text-3xl font-bold">
          {t("welcome")}, <span className="gradient-text">{user?.name || t("adminFallback")}</span>
        </h1>
        <p className="text-muted-foreground mt-1">
          {t("subtitle")}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat, i) => {
          const { icon: Icon, bg, color } = statIcons[i];
          return (
            <Card
              key={stat.label}
              className="gradient-border hover:glow-violet-sm transition-all duration-300"
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.label}
                </CardTitle>
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-lg ${bg}`}
                >
                  <Icon className={`h-4 w-4 ${color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stat.sub}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Summary cards */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("enrollmentSummary.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { label: t("enrollmentSummary.completed"), value: stats.completed_enrollments, color: "bg-emerald-500" },
                { label: t("enrollmentSummary.inProgress"), value: stats.active_enrollments, color: "bg-amber-500" },
                { label: t("enrollmentSummary.total"), value: stats.total_enrollments, color: "bg-violet-500" },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`h-3 w-3 rounded-full ${item.color}`} />
                    <span className="text-sm font-medium">{item.label}</span>
                  </div>
                  <span className="text-sm font-semibold">{item.value}</span>
                </div>
              ))}
              {/* Progress bar */}
              <div className="pt-2">
                <div className="h-3 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full bg-gradient-to-r from-violet-500 to-purple-500 transition-all duration-500"
                    style={{ width: `${completionRate}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1 text-center">
                  {t("enrollmentSummary.completedPct", { percent: completionRate })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("certificates.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-orange-500 shadow-lg shadow-amber-500/20 mb-4">
                <Award className="h-8 w-8 text-white" />
              </div>
              <p className="text-4xl font-bold">{stats.total_certificates}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {t("certificates.issued")}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
