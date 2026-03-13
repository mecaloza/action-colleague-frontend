"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/lib/api";
import {
  EvaluationAnalytics,
  EmployeeResponse,
  UserResponseDetail,
  CourseStats,
} from "@/lib/types";
import {
  Loader2,
  BarChart3,
  Users,
  GraduationCap,
  BookOpen,
  Eye,
  TrendingUp,
  Target,
  CheckCircle2,
  XCircle,
} from "lucide-react";

// ─── Stats Cards ─────────────────────────────────────────────────────────────

function StatsCards({ stats, analytics }: { stats: CourseStats | null; analytics: EvaluationAnalytics | null }) {
  const cards = [
    {
      label: "Módulos",
      value: stats?.total_modules ?? "—",
      icon: BookOpen,
    },
    {
      label: "Evaluaciones",
      value: stats?.total_evaluations ?? "—",
      icon: GraduationCap,
    },
    {
      label: "Inscritos",
      value: stats?.total_enrollments ?? "—",
      icon: Users,
    },
    {
      label: "Tasa de Aprobación",
      value: analytics ? `${analytics.pass_rate.toFixed(0)}%` : stats ? `${stats.completion_rate}%` : "—",
      icon: TrendingUp,
      highlight: true,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => (
        <Card key={c.label} className="gradient-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/10">
                <c.icon className="h-4 w-4 text-violet-400" />
              </div>
              <span className={`text-3xl font-bold ${c.highlight ? "text-violet-400" : ""}`}>
                {c.value}
              </span>
            </div>
            {c.highlight && analytics && (
              <div className="mt-2 h-2 rounded-full bg-white/10">
                <div
                  className="h-2 rounded-full bg-gradient-to-r from-violet-500 to-purple-500"
                  style={{ width: `${analytics.pass_rate}%` }}
                />
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Question Analytics Table ────────────────────────────────────────────────

function QuestionAnalyticsTable({ analytics }: { analytics: EvaluationAnalytics }) {
  if (!analytics.questions || analytics.questions.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Target className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No hay datos de preguntas todavía.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-violet-400" />
          Rendimiento por Pregunta
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Pregunta</TableHead>
              <TableHead className="w-24">Tipo</TableHead>
              <TableHead className="w-28 text-right">% Acierto</TableHead>
              <TableHead className="w-24 text-right">Intentos</TableHead>
              <TableHead>Error más común</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {analytics.questions.map((q) => (
              <TableRow key={q.question_index}>
                <TableCell className="font-medium text-violet-400">{q.question_index + 1}</TableCell>
                <TableCell className="max-w-[300px] truncate">{q.question_text}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className="text-xs">{q.question_type}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <span className={q.correct_rate >= 70 ? "text-emerald-400" : q.correct_rate >= 40 ? "text-amber-400" : "text-red-400"}>
                    {q.correct_rate.toFixed(0)}%
                  </span>
                </TableCell>
                <TableCell className="text-right">{q.total_attempts}</TableCell>
                <TableCell className="max-w-[200px] truncate text-muted-foreground text-xs">
                  {q.most_common_wrong || "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ─── Employee Responses Table ────────────────────────────────────────────────

function EmployeeResponsesTable({ courseId }: { courseId: string }) {
  const [responses, setResponses] = useState<EmployeeResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<EmployeeResponse | null>(null);
  const [userDetails, setUserDetails] = useState<UserResponseDetail[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    api
      .getEvaluationResponses(courseId)
      .then(setResponses)
      .catch(() => setResponses([]))
      .finally(() => setLoading(false));
  }, [courseId]);

  const viewDetail = async (emp: EmployeeResponse) => {
    setSelectedUser(emp);
    setDetailLoading(true);
    try {
      const details = await api.getEvaluationResponsesUser(emp.user_id, courseId);
      setUserDetails(details);
    } catch {
      setUserDetails([]);
    }
    setDetailLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-violet-400" />
      </div>
    );
  }

  if (responses.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No hay respuestas de empleados todavía.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-violet-400" />
            Respuestas por Empleado
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empleado</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="text-right">Score Promedio</TableHead>
                <TableHead className="text-right">Intentos</TableHead>
                <TableHead className="text-center">Estado</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {responses.map((emp) => (
                <TableRow key={emp.user_id}>
                  <TableCell className="font-medium">{emp.user_name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{emp.user_email}</TableCell>
                  <TableCell className="text-right">
                    <span className={emp.average_score >= 70 ? "text-emerald-400" : "text-red-400"}>
                      {emp.average_score.toFixed(0)}%
                    </span>
                  </TableCell>
                  <TableCell className="text-right">{emp.total_attempts}</TableCell>
                  <TableCell className="text-center">
                    {emp.passed ? (
                      <Badge className="bg-emerald-600 text-white text-xs">Aprobado</Badge>
                    ) : (
                      <Badge variant="destructive" className="text-xs">Reprobado</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" onClick={() => viewDetail(emp)} className="h-7 px-2">
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Detalle — {selectedUser?.user_name}
            </DialogTitle>
          </DialogHeader>
          {detailLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-violet-400" />
            </div>
          ) : userDetails.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Sin intentos registrados.</p>
          ) : (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              {userDetails.map((attempt) => (
                <div key={attempt.attempt} className="rounded-lg border border-white/[0.08] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Intento {attempt.attempt}</span>
                    <div className="flex items-center gap-2">
                      <Badge className={attempt.passed ? "bg-emerald-600 text-white" : "bg-red-600 text-white"}>
                        {attempt.score.toFixed(0)}%
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(attempt.submitted_at).toLocaleDateString("es-ES", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    {attempt.answers.map((a) => (
                      <div key={a.question_index} className="flex items-center gap-2 text-sm">
                        {a.correct ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />
                        )}
                        <span className="text-muted-foreground">
                          Pregunta {a.question_index + 1}:
                        </span>
                        <span className="truncate">
                          {typeof a.selected === "object" ? JSON.stringify(a.selected) : String(a.selected)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export function EvaluationResultsTab({
  courseId,
  stats,
}: {
  courseId: string;
  stats: CourseStats | null;
}) {
  const [analytics, setAnalytics] = useState<EvaluationAnalytics | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);
  const [activeView, setActiveView] = useState<"questions" | "employees">("questions");

  useEffect(() => {
    api
      .getEvaluationAnalytics(courseId)
      .then(setAnalytics)
      .catch(() => setAnalytics(null))
      .finally(() => setLoadingAnalytics(false));
  }, [courseId]);

  return (
    <div className="space-y-6">
      {/* Stats */}
      <StatsCards stats={stats} analytics={analytics} />

      {/* Sub-tabs */}
      <div className="flex items-center gap-2 border-b border-white/[0.08] pb-2">
        <button
          type="button"
          onClick={() => setActiveView("questions")}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
            activeView === "questions"
              ? "text-violet-400 border-b-2 border-violet-400"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <BarChart3 className="h-3.5 w-3.5 inline mr-1.5" />
          Por Pregunta
        </button>
        <button
          type="button"
          onClick={() => setActiveView("employees")}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
            activeView === "employees"
              ? "text-violet-400 border-b-2 border-violet-400"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Users className="h-3.5 w-3.5 inline mr-1.5" />
          Por Empleado
        </button>
      </div>

      {/* Content */}
      {loadingAnalytics ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
        </div>
      ) : activeView === "questions" ? (
        analytics ? (
          <QuestionAnalyticsTable analytics={analytics} />
        ) : (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No hay datos de analytics disponibles.</p>
            </CardContent>
          </Card>
        )
      ) : (
        <EmployeeResponsesTable courseId={courseId} />
      )}
    </div>
  );
}
