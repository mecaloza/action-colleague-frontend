"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { Course } from "@/lib/types";
import { Plus, Search, Users, Clock, ChevronRight } from "lucide-react";

const categoryColors: Record<string, string> = {
  Compliance: "bg-blue-500/20 text-blue-400 border-blue-500/20",
  Technical: "bg-emerald-500/20 text-emerald-400 border-emerald-500/20",
  Leadership: "bg-amber-500/20 text-amber-400 border-amber-500/20",
  Onboarding: "bg-violet-500/20 text-violet-400 border-violet-500/20",
  "Soft Skills": "bg-pink-500/20 text-pink-400 border-pink-500/20",
};

export default function AdminCoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newCourse, setNewCourse] = useState({
    title: "",
    description: "",
    category: "Compliance",
    duration_hours: 4,
  });

  useEffect(() => {
    api.getCourses().then(setCourses).catch((err) => console.error("Error loading courses:", err));
  }, []);

  const filtered = courses.filter(
    (c) =>
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.category.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = () => {
    const course: Course = {
      id: String(courses.length + 1),
      ...newCourse,
      status: "draft",
      modules: [],
      enrolled_count: 0,
      completion_rate: 0,
      created_at: new Date().toISOString().split("T")[0],
      updated_at: new Date().toISOString().split("T")[0],
    };
    setCourses([course, ...courses]);
    setShowCreate(false);
    setNewCourse({ title: "", description: "", category: "Compliance", duration_hours: 4 });
  };

  const statusVariant = (status: string) => {
    switch (status) {
      case "published": return "success" as const;
      case "draft": return "secondary" as const;
      case "archived": return "outline" as const;
      default: return "secondary" as const;
    }
  };

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Courses</h1>
          <p className="text-muted-foreground">Manage training courses</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/courses/create">
            <Button variant="default">
              <Plus className="mr-2 h-4 w-4" /> Crear con IA ✨
            </Button>
          </Link>
          <Button variant="outline" onClick={() => setShowCreate(true)}>
            <Plus className="mr-2 h-4 w-4" /> Manual
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search courses..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((course) => (
          <Link key={course.id} href={`/admin/courses/${course.id}`}>
            <Card className="h-full cursor-pointer group hover:glow-violet-sm hover:scale-[1.02] transition-all duration-300">
              {/* Thumbnail placeholder */}
              <div className="h-32 rounded-t-lg bg-gradient-to-br from-violet-600/30 to-purple-800/20 flex items-center justify-center border-b border-white/[0.06]">
                <div className="text-4xl opacity-30">
                  {course.category === "Technical" ? "< />" : course.category === "Leadership" ? "***" : "|||"}
                </div>
              </div>
              <CardHeader className="pt-4">
                <div className="flex items-start justify-between">
                  <Badge variant={statusVariant(course.status)}>{course.status}</Badge>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-violet-400 transition-colors" />
                </div>
                <CardTitle className="text-lg">{course.title}</CardTitle>
                <CardDescription className="line-clamp-2">{course.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    {course.enrolled_count} enrolled
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {course.duration_hours}h
                  </div>
                </div>
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Completion</span>
                    <span className="text-violet-400">{course.completion_rate}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/10">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-violet-500 to-purple-500 transition-all duration-500"
                      style={{ width: `${course.completion_rate}%` }}
                    />
                  </div>
                </div>
                <div className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold mt-3 ${categoryColors[course.category] || "bg-white/10 text-muted-foreground border-white/10"}`}>
                  {course.category}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogClose onClose={() => setShowCreate(false)} />
          <DialogHeader>
            <DialogTitle>Create New Course</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={newCourse.title}
                onChange={(e) => setNewCourse({ ...newCourse, title: e.target.value })}
                placeholder="Course title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={newCourse.description}
                onChange={(e) => setNewCourse({ ...newCourse, description: e.target.value })}
                placeholder="Course description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  id="category"
                  value={newCourse.category}
                  onChange={(e) => setNewCourse({ ...newCourse, category: e.target.value })}
                >
                  <option value="Compliance">Compliance</option>
                  <option value="Technical">Technical</option>
                  <option value="Leadership">Leadership</option>
                  <option value="Onboarding">Onboarding</option>
                  <option value="Soft Skills">Soft Skills</option>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="duration">Duration (hours)</Label>
                <Input
                  id="duration"
                  type="number"
                  value={newCourse.duration_hours}
                  onChange={(e) => setNewCourse({ ...newCourse, duration_hours: Number(e.target.value) })}
                />
              </div>
            </div>
            <Button className="w-full" onClick={handleCreate} disabled={!newCourse.title}>
              Create Course
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
