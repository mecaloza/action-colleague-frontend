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

export default function ProfilePage() {
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
        <h1 className="text-3xl font-bold">Profile</h1>
        <p className="text-muted-foreground">Your account information</p>
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
                <span>{user.department || "—"}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Briefcase className="h-4 w-4 text-muted-foreground" />
                <span>{user.position || "—"}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span>Leader: {user.leader_name || "None"}</span>
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
                Role & Permissions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Role</p>
                  <p className="text-sm font-medium capitalize">{user.role}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Permissions</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {user.role === "admin" ? (
                      <>
                        <Badge variant="outline" className="text-xs">
                          Manage Users
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          Manage Courses
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          View Reports
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          Generate Documents
                        </Badge>
                      </>
                    ) : (
                      <>
                        <Badge variant="outline" className="text-xs">
                          View Courses
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          Take Quizzes
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          View Documents
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
                Enrolled Courses
              </CardTitle>
            </CardHeader>
            <CardContent>
              {enrollments.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No courses enrolled yet.
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
                          Completed
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
                          In Progress
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
                          ? "Done"
                          : enrollment.status === "in_progress"
                          ? "In Progress"
                          : "Enrolled"}
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
