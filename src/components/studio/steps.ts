import type { CourseDetail, CourseSettings, Job, ModuleAdmin, SlideTheme } from "@/lib/api/types";

export type StepId = "brief" | "outline" | "content" | "style" | "production";

export const STEPS: { id: StepId; label: string; hint: string }[] = [
  { id: "brief", label: "Brief", hint: "Qué curso necesitas y tus materiales" },
  { id: "outline", label: "Estructura", hint: "Módulos y objetivos propuestos" },
  { id: "content", label: "Contenido", hint: "Guiones, diapositivas y evaluación" },
  { id: "style", label: "Estilo y voz", hint: "Voz, presentador y diseño" },
  { id: "production", label: "Producción", hint: "Los videos del curso" },
];

export const aiModules = (course: CourseDetail): ModuleAdmin[] =>
  course.modules.filter((module) => module.source === "ai");

/** How the course's videos look: what the style step saved, or dark with the presenter shown. */
export const videoStyle = (settings: CourseSettings): { theme: SlideTheme; presenter: boolean } => ({
  theme: settings.theme || "dark",
  presenter: settings.presenter ?? true,
});

const isBusy = (module: ModuleAdmin) =>
  module.generation_status === "queued" || module.generation_status === "generating";

// A busy module is doing one of two things: writing its script (no scenes yet) or producing its video.
export const isRendering = (module: ModuleAdmin) => isBusy(module) && module.scene_count > 0;
export const isDrafting = (module: ModuleAdmin) => isBusy(module) && module.scene_count === 0;

/**
 * Where the course is, from what the server has: the studio resumes there after a reload.
 * `hasOutline`: the AI already proposed a structure; `jobs`: the course's active jobs.
 */
export function currentStep(course: CourseDetail, hasOutline: boolean, jobs: Job[]): StepId {
  const modules = aiModules(course);
  if (!modules.length) return hasOutline || jobs.some((job) => job.type === "ai.outline") ? "outline" : "brief";
  if (modules.some((module) => module.scene_count === 0)) return "content";
  if (modules.some((module) => module.video || isRendering(module)) || jobs.some((job) => job.type === "video.render"))
    return "production";
  return "style";
}

export const stepIndex = (id: StepId) => STEPS.findIndex((step) => step.id === id);
