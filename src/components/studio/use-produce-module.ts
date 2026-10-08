"use client";

import { useMutation } from "@tanstack/react-query";
import { useConfirm } from "@/components/layout/confirm-dialog";
import { studioApi } from "@/lib/api/studio";
import type { CourseDetail, ModuleAdmin } from "@/lib/api/types";
import { useCourseCache } from "@/lib/hooks/use-course-cache";
import { useStudioCache } from "./use-studio-cache";

/**
 * Asks first when the course is published: the people taking it get the module's new video as soon as it's ready.
 * True when it can be produced (also when the course isn't published).
 */
export function useConfirmProduce(course: CourseDetail) {
  const confirm = useConfirm();
  return async (module: ModuleAdmin, confirmLabel = module.video ? "Volver a producir" : "Producir") =>
    course.status !== "published" ||
    confirm({
      title: module.video ? "¿Volver a producir el video?" : "¿Producir el video?",
      description: `El curso está publicado: quienes lo toman verán el video nuevo de «${module.title}» al terminar.`,
      confirmLabel,
    });
}

/** Produces one module's video (again, e.g. after editing its script) with the course's voice, presenter and look. */
export function useProduceModule(course: CourseDetail) {
  const confirmProduce = useConfirmProduce(course);
  const { refreshCourse } = useCourseCache();
  const { trackJobs, failed } = useStudioCache();
  const render = useMutation({
    mutationFn: (moduleId: number) => studioApi.renderModule(moduleId),
    onSuccess: (job) => {
      trackJobs(course.id, [job]);
      void refreshCourse(course.id);
    },
    onError: failed(course.id),
  });

  const produce = async (module: ModuleAdmin) => {
    if (await confirmProduce(module)) render.mutate(module.id);
  };

  return { produce, producingId: render.isPending ? render.variables : null };
}
