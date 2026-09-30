import type { CourseDetail, CourseSettings, Job, ModuleAdmin, SlideTheme } from "@/lib/api/types";

export type StepId = "brief" | "outline" | "content" | "style" | "production";

export const STEPS: { id: StepId; label: string; hint: string }[] = [
  { id: "brief", label: "Brief", hint: "Qué curso necesitas y tus materiales" },
  { id: "outline", label: "Estructura", hint: "Módulos y objetivos propuestos" },
  { id: "content", label: "Contenido", hint: "Guiones, diapositivas y evaluación" },
  { id: "style", label: "Estilo y voz", hint: "Voz, presentador y diseño" },
  { id: "production", label: "Producción", hint: "Los videos del curso" },
];

// The studio's background jobs.
export const OUTLINE_JOB = "ai.outline";
const DRAFT_JOB = "ai.module_draft";
const RENDER_JOB = "video.render";

/** Why a new proposal can't replace the course's modules (the API refuses it too). */
export const LOCKED_MESSAGE =
  "El curso ya tiene contenido o lo está generando: una estructura nueva lo reemplazaría. " +
  "Cambia sus módulos desde el paso Contenido o desde el editor.";

export const aiModules = (course: CourseDetail): ModuleAdmin[] =>
  course.modules.filter((module) => module.source === "ai");

/** How the course's videos look: what the style step saved, or dark with the presenter shown. */
export const videoStyle = (settings: CourseSettings): { theme: SlideTheme; presenter: boolean } => ({
  theme: settings.theme || "dark",
  presenter: settings.presenter ?? true,
});

export const isBusy = (module: ModuleAdmin) =>
  module.generation_status === "queued" || module.generation_status === "generating";

/** Created from the approved outline and nothing more yet: what a new proposal may replace (the API's rule). */
export const isUntouched = (module: ModuleAdmin) =>
  module.source === "ai" &&
  !isBusy(module) &&
  !module.scene_count &&
  !module.video &&
  !module.content_text.trim() &&
  !module.evaluation;

/** A busy module is writing its script or producing its video. */
export type ModuleActivity = "drafting" | "rendering" | null;

/** The module's active job that writes its script or produces its video, if any. */
export const moduleJob = (module: ModuleAdmin, jobs: Job[]): Job | undefined =>
  jobs.find((job) => job.module_id === module.id && (job.type === DRAFT_JOB || job.type === RENDER_JOB));

/**
 * What the module is doing, as its active job says. Without one (the list of jobs may lag behind the course),
 * a busy module with a script is taken as producing its video and one without as writing it.
 */
export function moduleActivity(module: ModuleAdmin, jobs: Job[]): ModuleActivity {
  const job = moduleJob(module, jobs);
  if (job) return job.type === DRAFT_JOB ? "drafting" : "rendering";
  if (!isBusy(module)) return null;
  return module.scene_count > 0 ? "rendering" : "drafting";
}

/**
 * Where the course is, from what the server has: the studio resumes there after a reload.
 * `hasOutline`: the AI already proposed a structure; `jobs`: the course's active jobs.
 */
export function currentStep(course: CourseDetail, hasOutline: boolean, jobs: Job[]): StepId {
  const modules = aiModules(course);
  if (!modules.length) return hasOutline || jobs.some((job) => job.type === OUTLINE_JOB) ? "outline" : "brief";
  // Modules still waiting for their script (one brought with its own video from the previous app can do without).
  if (modules.some((module) => !module.scene_count && !module.video)) return "content";
  if (modules.some((module) => module.video || moduleActivity(module, jobs) === "rendering")) return "production";
  return "style";
}

/**
 * The furthest step worth visiting: any produced (or failed) video opens Production to it, any script
 * the Style step, even while another module still waits for its script (`currentStep` opens there).
 */
export function furthestStep(course: CourseDetail, hasOutline: boolean, jobs: Job[]): StepId {
  const modules = aiModules(course);
  if (!modules.length) return currentStep(course, hasOutline, jobs);
  const inProduction = (module: ModuleAdmin) =>
    Boolean(module.video) ||
    moduleActivity(module, jobs) === "rendering" ||
    (module.generation_status === "failed" && module.scene_count > 0);
  if (modules.some(inProduction)) return "production";
  return modules.some((module) => module.scene_count > 0) ? "style" : "content";
}

export const stepIndex = (id: StepId) => STEPS.findIndex((step) => step.id === id);
