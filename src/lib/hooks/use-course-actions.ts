import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/client";
import { courseKeys, coursesApi } from "@/lib/api/courses";
import type { PublishProblem } from "@/lib/api/types";
import { toastError } from "@/lib/notify";
import { useCourseCache } from "./use-course-cache";

/** When publishing is rejected, the API lists what is still missing. */
function publishProblemsOf(error: unknown): PublishProblem[] {
  const detail = error instanceof ApiError ? (error.detail as { problems?: PublishProblem[] } | undefined) : undefined;
  return detail?.problems ?? [];
}

/** Publish, unpublish, archive and delete a course, each with its own feedback. */
export function useCourseActions(courseId: number) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { storeCourse } = useCourseCache();
  const [publishProblems, setPublishProblems] = useState<PublishProblem[] | null>(null);

  const publish = useMutation({
    mutationFn: () => coursesApi.publish(courseId),
    onSuccess: (course) => {
      storeCourse(course);
      toast.success("Curso publicado: ya lo ven las personas asignadas");
    },
    onError: (error) => {
      const problems = publishProblemsOf(error);
      if (problems.length) setPublishProblems(problems);
      else toastError(error);
    },
  });

  const unpublish = useMutation({
    mutationFn: () => coursesApi.unpublish(courseId),
    onSuccess: (course) => {
      storeCourse(course);
      toast.success("El curso volvió a borrador");
    },
    onError: toastError,
  });

  const archive = useMutation({
    mutationFn: () => coursesApi.archive(courseId),
    onSuccess: (course) => {
      storeCourse(course);
      toast.success("Curso archivado: ya no aparece para las personas asignadas");
    },
    onError: toastError,
  });

  const remove = useMutation({
    mutationFn: () => coursesApi.remove(courseId),
    onSuccess: () => {
      toast.success("Curso eliminado");
      router.replace("/admin/courses");
      queryClient.removeQueries({ queryKey: courseKeys.detail(courseId) }); // detail, participants, results...
      queryClient.invalidateQueries({ queryKey: ["courses", "list"] });
    },
    onError: toastError,
  });

  return {
    publish,
    unpublish,
    archive,
    remove,
    publishProblems,
    dismissPublishProblems: () => setPublishProblems(null),
  };
}
