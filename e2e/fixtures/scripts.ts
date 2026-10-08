import { expect } from "@playwright/test";
import type { Call } from "./api";

// AI modules whose script (and video) the specs prepare through the API. With the fake providers, a change asked of
// the AI retitles the scenes in scope ("Revisado: …"; the first one when no scene is chosen), adds a sentence to their
// narration when the observation says "narración", and a line to the reading when it says "lectura".

/** A three-scene script: a cover, the helmet's rules and a closing. */
export const SCENES = [
  {
    id: "s1",
    slide: { layout: "cover", title: "Seguridad en planta", subtitle: "Lo esencial" },
    narration: "Bienvenida al módulo sobre el uso correcto del casco en la planta.",
  },
  {
    id: "s2",
    slide: { layout: "bullets", title: "Reglas del casco", points: ["Siempre puesto", "Revisarlo antes del turno"] },
    narration: "Hay dos reglas: llevarlo siempre puesto y revisarlo antes de cada turno.",
  },
  {
    id: "s3",
    slide: { layout: "closing", title: "Para recordar", points: ["El casco te cuida"] },
    narration: "Recuerda: el casco te cuida en cada turno.",
  },
];

export const MODULE_TITLE = "Uso del casco";

/** An AI course with one module whose script has `SCENES` (and a reading). */
export async function scriptedCourse(call: Call, title: string) {
  const course = await call<{ id: number }>("post", "/courses", { title: `${title} ${Date.now()}`, source: "ai" });
  const module = await call<{ id: number }>("post", `/courses/${course.id}/modules`, {
    title: MODULE_TITLE,
    source: "ai",
    content_text: "El casco se usa siempre en la planta.",
  });
  await call("put", `/modules/${module.id}/storyboard`, { scenes: SCENES });
  return { courseId: course.id, moduleId: module.id };
}

/** Produces the module's video with the fake voice and no presenter (a few seconds), and waits for it. */
export async function produceVideo(call: Call, courseId: number, moduleId: number) {
  const [job] = await call<{ id: string }[]>("post", `/courses/${courseId}/render`, {
    module_ids: [moduleId],
    voice_id: "fake-voice-es",
    presenter: false,
  });
  await expect
    .poll(async () => (await call<{ status: string }>("get", `/jobs/${job.id}`)).status, {
      timeout: 150_000,
      intervals: [1_000],
    })
    .toBe("succeeded");
}

/** The module's saved scenes' titles, in order. */
export async function sceneTitles(call: Call, moduleId: number): Promise<string[]> {
  const storyboard = await call<{ scenes: { slide: { title: string } }[] }>("get", `/modules/${moduleId}/storyboard`);
  return storyboard.scenes.map((scene) => scene.slide.title);
}
