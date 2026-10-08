import { expect, type Page } from "@playwright/test";
import { API, type Call } from "./api";
import { MODULE_TITLE, produceVideo, SCENES } from "./scripts";

// The automatic review of a module's AI video ("Revisión de calidad"). With the fake providers, a scene's texts script
// what the AI "sees" in its frames: "[qa:<category>:<severity>]" is reported once, on the first frame of the scene,
// over the frame's top-left quarter (the backend's FakeLLM). Where a spec needs states the fake AI can't give (a
// review in progress, one that failed), the review is faked whole in the browser (`fakeReviews`).

/** What the fake AI reports for scene 2: a critical cut text. */
export const MARKER = "[qa:cut_text:critical]";
/** How it words it, and the change it suggests. */
export const MARKED = "Revisión de prueba: «cut_text» en la escena 2.";
export const MARKED_FIX = "En la escena 2, corrige lo que se ve mal (cut_text).";

/** An AI course with one module whose video was produced and reviewed: scene 2's title carries `MARKER`. */
export async function reviewedCourse(call: Call, title: string) {
  const course = await call<{ id: number }>("post", "/courses", { title: `${title} ${Date.now()}`, source: "ai" });
  const module = await call<{ id: number }>("post", `/courses/${course.id}/modules`, {
    title: MODULE_TITLE,
    source: "ai",
    content_text: "El casco se usa siempre en la planta.",
  });
  const scenes = SCENES.map((scene) =>
    scene.id === "s2" ? { ...scene, slide: { ...scene.slide, title: `${scene.slide.title} ${MARKER}` } } : scene,
  );
  await call("put", `/modules/${module.id}/storyboard`, { scenes });
  await produceVideo(call, course.id, module.id);
  // Its review was queued as the video was published (Parámetros review every video by default).
  await expect
    .poll(async () => (await call<{ status: string }>("get", `/modules/${module.id}/review`)).status, {
      timeout: 60_000,
      intervals: [1_000],
    })
    .toBe("done");
  return { courseId: course.id, moduleId: module.id };
}

/** A video made before (it never loads here: only its presence matters). */
const VIDEO = { url: "https://example.com/video.mp4", mime_type: "video/mp4", duration_seconds: 14, width: 1920, height: 1080 };

/** A frame (960 × 540) drawn as a picture of its own, with its moment written on it. */
function picture(label: string) {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540"><rect width="960" height="540" fill="#1d1d1d"/>' +
    `<text x="480" y="290" font-size="48" fill="#ffffff" text-anchor="middle">${label}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** The frames of a three-scene video: each scene's slide settled and a moment at random in it; two more anywhere. */
function frames() {
  const moments: [number, string, string][] = [
    [1.2, "s1", "scene"],
    [3.4, "s1", "settled"],
    [5.1, "s2", "scene"],
    [6.2, "s2", "settled"],
    [7.9, "s2", "random"],
    [9.6, "s3", "scene"],
    [12.4, "s3", "settled"],
    [13.1, "s3", "random"],
  ];
  return moments.map(([at, scene, kind], index) => ({
    index,
    at_seconds: at,
    scene_id: scene,
    kind,
    url: picture(`${scene} · ${at} s`),
  }));
}

/**
 * What a faked review finds: a critical cut text in scene 2 (seen on its settled frame, drawn there), a black screen
 * in scene 3 (the video's own: no change to the script fixes it) and, in scene 1, a narration that doesn't say what its
 * slide does.
 */
export const CUT = "El segundo punto se corta en el borde derecho.";
export const CUT_FIX = "En la escena 2, acorta el segundo punto para que quepa completo.";
export const BLACK = "La pantalla queda en negro 1.2 s desde el 0:11.";
export const MISMATCH = "La narración habla de guantes y la diapositiva no.";
/** What a review may also find in scene 2, suggesting the very same change as `CUT` (findings of a scene often do). */
export const OVERLAP = "El título se monta sobre el primer punto.";

function issues(reviewId: number) {
  return [
    {
      id: `${reviewId}-1`,
      source: "vision",
      scene_id: "s2",
      at_seconds: 6.2,
      frame_index: 3,
      category: "cut_text",
      severity: "critical",
      description: CUT,
      suggested_observation: CUT_FIX,
      box: [0.55, 0.4, 0.98, 0.62],
      status: "open",
    },
    {
      id: `${reviewId}-2`,
      source: "video",
      scene_id: "s3",
      at_seconds: 11.0,
      frame_index: null,
      category: "empty",
      severity: "major",
      description: BLACK,
      suggested_observation: "",
      box: null,
      status: "open",
    },
    {
      id: `${reviewId}-3`,
      source: "content",
      scene_id: "s1",
      at_seconds: 0.4,
      frame_index: null,
      category: "content",
      severity: "minor",
      description: MISMATCH,
      suggested_observation: "En la escena 1, que la narración hable del casco.",
      box: null,
      status: "open",
    },
  ];
}

/** A finished review (`changes` turns it into another state). */
export function fakeReview(id: number, moduleId: number, changes: Record<string, unknown> = {}) {
  const now = new Date().toISOString();
  return {
    id,
    module_id: moduleId,
    video_asset_id: "e2e-video",
    status: "done",
    verdict: "problems",
    summary: "Encontré un texto cortado en los fotogramas.",
    error: null as string | null,
    job_id: `e2e-review-${id}`,
    issues: issues(id),
    frames: frames(),
    checks: { lint: { warnings: [] }, black: [], silence: [], frozen: null, presenter_seconds: null } as Record<string, unknown>,
    created_at: now,
    finished_at: now as string | null,
    ...changes,
  };
}

export type FakeReview = ReturnType<typeof fakeReview>;

/** A review just asked for: queued, nothing found or taken yet. */
export const queued = (id: number, moduleId: number) =>
  fakeReview(id, moduleId, {
    status: "queued",
    verdict: null,
    summary: "",
    issues: [],
    frames: [],
    checks: {},
    finished_at: null,
  });

/** What a faked endpoint answers (the API is on another origin). */
export const jsonReply = (body: unknown, status = 200) => ({
  status,
  contentType: "application/json",
  headers: { "access-control-allow-origin": "*" },
  body: JSON.stringify(body),
});

/**
 * The module's review, faked in the browser: what `GET /modules/{id}/review` answers (`review`; null: 404, none yet),
 * what asking for one again starts (`next`, answered as queued with its job running), dismissing and reopening a
 * finding; and, in the course, the module's video and the badge of its review. The test changes `review` as it goes.
 */
export async function fakeReviews(page: Page, courseId: number, moduleId: number, initial: FakeReview | null) {
  const fake = {
    review: initial,
    /** What each request for a review starts (the n-th one). */
    next: (asked: number) => queued(900 + asked, moduleId),
    asked: 0,
  };
  const job = (id: string, changes: Record<string, unknown>) => ({
    id,
    type: "video.review",
    status: "queued",
    progress: 0,
    step: "",
    error: null,
    course_id: courseId,
    module_id: moduleId,
    result: null,
    created_at: null,
    updated_at: null,
    ...changes,
  });
  const badge = () => {
    const review = fake.review;
    if (!review) return null;
    const open = review.issues.filter((issue) => issue.status === "open");
    return {
      status: review.status,
      verdict: review.verdict,
      open_issues: open.length,
      critical: open.filter((issue) => issue.severity === "critical").length,
    };
  };
  await page.route(`${API}/courses/${courseId}`, async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const response = await route.fetch();
    const detail = await response.json();
    for (const module of detail.modules) {
      if (module.id === moduleId) Object.assign(module, { video: VIDEO, duration_seconds: 14, review: badge() });
    }
    await route.fulfill({ response, json: detail });
  });
  await page.route(`${API}/modules/${moduleId}/review`, async (route) => {
    if (route.request().method() === "POST") {
      fake.asked += 1;
      fake.review = fake.next(fake.asked);
      return route.fulfill(jsonReply({ review: fake.review, job: job(fake.review.job_id, {}) }, 202));
    }
    const answer = fake.review ? jsonReply(fake.review) : jsonReply({ detail: "Este video aún no tiene revisión" }, 404);
    return route.fulfill(answer);
  });
  await page.route(new RegExp(`${API}/reviews/\\d+/issues/[^/]+/(dismiss|reopen)$`), async (route) => {
    const [, issueId, action] = /\/issues\/([^/]+)\/(dismiss|reopen)$/.exec(route.request().url())!;
    const issue = fake.review?.issues.find((each) => each.id === decodeURIComponent(issueId));
    if (!issue) return route.fulfill(jsonReply({ detail: "Hallazgo no encontrado" }, 404));
    issue.status = action === "dismiss" ? "dismissed" : "open";
    return route.fulfill(jsonReply(fake.review));
  });
  // A review being made: its job is where the AI looks at the frames.
  await page.route(new RegExp(`${API}/jobs/e2e-review-\\d+$`), (route) =>
    route.fulfill(
      jsonReply(
        job(route.request().url().split("/").pop()!, {
          status: "running",
          progress: 40,
          step: "Revisando los fotogramas con IA",
        }),
      ),
    ),
  );
  return fake;
}
