import { test, expect, type APIRequestContext, type Locator, type Page } from "@playwright/test";
import { DECISION, INSPECTION, QUICK_ORDER, SIMULATOR } from "./fixtures/activities";

// The learner's side on a phone ("mobile" project: Pixel 7, touch, no hover), every game played with taps only.
const API = process.env.E2E_API_URL ?? "http://localhost:8001/api/v1";
const admin = { email: process.env.E2E_ADMIN_EMAIL ?? "", password: process.env.E2E_ADMIN_PASSWORD ?? "" };
const learner = { email: process.env.E2E_LEARNER_EMAIL ?? "", password: process.env.E2E_LEARNER_PASSWORD ?? "" };

test.use({ storageState: { cookies: [], origins: [] } }); // signed in as the learner, not the admin
test.skip(
  !learner.email || !learner.password,
  "Define E2E_LEARNER_EMAIL y E2E_LEARNER_PASSWORD para probar al colaborador.",
);
test.setTimeout(180_000);

// A conversation whose clients have names: past lines are labeled with them, never a generic "Cliente".
const NAMED_DECISION = {
  nodes: DECISION.nodes.map((node, index) => ({
    ...node,
    speaker: index === 0 ? "Don Ramiro · Transportes del Bajío" : "Ing. Laura Pérez · Flota",
  })),
};

// Three axles: on a 360 px phone the last ones sit under the sheet with the decisions until scrolled to.
const TRUCK = {
  ...INSPECTION,
  prompt: "Revisa las 6 llantas antes de que salga la unidad.",
  items: [
    ...INSPECTION.items,
    {
      id: "l5",
      label: "Llanta 5 · arrastre izquierda",
      look: "center",
      answer: "reencauchar",
      facts: [
        { label: "Profundidad", value: "5 mm" },
        { label: "Presión", value: "125 psi" },
      ],
      explanation: "Centro gastado: rodó sobreinflada. El casco sirve para reencauchar.",
    },
    {
      id: "l6",
      label: "Llanta 6 · arrastre derecha",
      look: "cuts",
      answer: "retirar",
      facts: [{ label: "Cortes", value: "3, con cuerdas expuestas" }],
      explanation: "Cortes que dejan ver las cuerdas: la llanta no es segura, se retira.",
    },
  ],
};

// Cards with long labels and values: they wrap instead of widening the screen.
const CARDS = {
  prompt: "Decide qué hacer con cada casco que llegó a la planta de renovado.",
  scene: "cards",
  verdicts: [
    { id: "renovar", label: "Renovar" },
    { id: "rechazar", label: "Rechazar" },
    { id: "revisar", label: "Revisión a fondo" },
  ],
  items: [
    {
      id: "c1",
      label: "Casco 295/80R22.5 · Fletes Rápidos del Norte",
      look: "even",
      answer: "renovar",
      facts: [
        { label: "Renovaciones", value: "1" },
        { label: "Medida", value: "295/80R22.5-XZE2+/LRH-16PR" },
      ],
      explanation: "Casco sano y con una sola renovación: se renueva.",
    },
    {
      id: "c2",
      label: "Casco 11R22.5 con clavo en la banda",
      answer: "revisar",
      facts: [{ label: "Daño", value: "Clavo en la banda de rodamiento" }],
      explanation: "Un clavo pide revisar el casco por dentro antes de renovarlo.",
    },
    {
      id: "c3",
      label: "Casco con chipote en el costado",
      look: "bulge",
      answer: "rechazar",
      facts: [{ label: "Costado", value: "Chipote de 4 cm" }],
      explanation: "Un chipote es una ruptura interna: el casco se rechaza.",
    },
  ],
};

// Money before the number, as it is written in Mexico: "$6,000".
const MONEY_SIMULATOR = {
  ...SIMULATOR,
  variables: [{ ...SIMULATOR.variables[0], unit: "$" }, SIMULATOR.variables[1]],
};

const QUICK_MATCH = {
  mode: "match",
  prompt: "Une cada patrón de desgaste con su causa más probable.",
  seconds: 60,
  pairs: [
    { left: "Centro gastado", right: "Sobreinflado" },
    { left: "Hombros gastados", right: "Baja presión de inflado" },
    { left: "Un lado gastado", right: "Desalineación de la unidad" },
    { left: "Copas o parches", right: "Amortiguadores o balanceo en mal estado" },
  ],
};

/** What the page records in the conversation test (see its init script). */
type Tracked = Window & { __events: string[] };

interface ModuleSeed {
  title: string;
  content_text?: string;
  activities?: { type: string; title: string; intro?: string; spec: unknown }[];
  quiz?: unknown;
}

async function adminApi(request: APIRequestContext) {
  const login = await request.post(`${API}/auth/login`, { data: admin });
  expect(login.ok()).toBeTruthy();
  const headers = { Authorization: `Bearer ${(await login.json()).access_token}` };
  return async (method: "post" | "put" | "get", path: string, data?: unknown) => {
    const response = await request[method](`${API}${path}`, { headers, data });
    expect(response.ok(), `${method} ${path}: ${await response.text()}`).toBeTruthy();
    return response.json();
  };
}

/** A published course with these modules (and their published activities or quiz), assigned to the learner. */
async function prepareCourse(request: APIRequestContext, title: string, modules: ModuleSeed[]) {
  const call = await adminApi(request);
  const course = await call("post", "/courses", { title, description: "Práctica en el celular." });
  for (const seed of modules) {
    const module = await call("post", `/courses/${course.id}/modules`, {
      title: seed.title,
      content_text: seed.content_text ?? "Lo que hay que saber antes de practicar.",
    });
    for (const activity of seed.activities ?? []) {
      await call("post", `/modules/${module.id}/activities`, { ...activity, status: "ready" });
    }
    if (seed.quiz) await call("put", `/modules/${module.id}/evaluation`, seed.quiz);
  }
  await call("post", `/courses/${course.id}/publish`);
  const [person] = await call("get", `/users?q=${encodeURIComponent(learner.email)}`);
  await call("post", `/courses/${course.id}/participants`, { user_ids: [person.id] });
  return course;
}

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(learner.email);
  await page.getByLabel("Contraseña", { exact: true }).fill(learner.password);
  await page.getByRole("button", { name: /Ingresar/ }).tap();
  await expect(page).toHaveURL(/\/learn$/, { timeout: 20_000 }); // a cold route
}

async function openCourse(page: Page, title: string) {
  await signIn(page);
  await page.getByRole("link", { name: new RegExp(title) }).first().tap();
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
}

/** Big enough for a finger (polled: a dialog zooming in is smaller for a moment). */
async function expectTarget(locator: Locator, min = 40) {
  await expect
    .poll(async () => {
      const box = await locator.boundingBox();
      return box ? Math.min(box.width, box.height) : 0;
    })
    .toBeGreaterThanOrEqual(min);
}

/** Nothing is wider than the phone: neither the page nor the open dialog scrolls sideways. */
async function expectNoSidewaysScroll(page: Page) {
  const width = page.viewportSize()!.width;
  // Polled: a card sliding in or shaking is wider for a moment.
  await expect
    .poll(() =>
      page.evaluate(() => {
        const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
        return {
          page: document.documentElement.scrollWidth,
          // Chrome widens the layout viewport of a page that overflows: it must stay the phone's width.
          viewport: window.innerWidth,
          dialog: dialog ? dialog.scrollWidth - dialog.clientWidth : 0,
        };
      }),
    )
    .toEqual({ page: width, viewport: width, dialog: 0 });
}

async function scrollDialogToBottom(dialog: Locator) {
  await dialog.evaluate((element) => element.scrollTo({ top: element.scrollHeight }));
}

/** Holds the next request that finishes a play until `release()`: then it reaches the server, or fails with `status`. */
async function holdFinish(page: Page, status?: number) {
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route(
    "**/activity-attempts/*/finish",
    async (route) => {
      await held;
      if (!status) return route.continue();
      await route.fulfill({ status, headers: { "access-control-allow-origin": "*" }, json: { detail: "Falló" } });
    },
    { times: 1 },
  );
  return release;
}

/** What the page fetched, in order: "→ url" as each request starts, "← url" as its answer arrives. */
type Fetched = Window & { __fetches: string[] };

/**
 * Logs the page's fetches from its next load on and returns a reader of that log. Kept by the page itself, so it is
 * in the order things happened there (the API calls and the router's requests for a page alike).
 */
async function logFetches(page: Page) {
  await page.addInitScript(() => {
    const log: string[] = [];
    (window as unknown as Fetched).__fetches = log;
    const fetch = window.fetch;
    window.fetch = async (input, init) => {
      const url = String(input instanceof Request ? input.url : input);
      log.push(`→ ${url}`);
      const response = await fetch(input, init);
      log.push(`← ${url}`);
      return response;
    };
  });
  return () => page.evaluate(() => (window as unknown as Fetched).__fetches.slice());
}

test("conversación con toques: el cliente con su nombre y cerrar al final cuenta la partida", async ({
  page,
  request,
}) => {
  const title = `Celular: conversación ${Date.now()}`;
  await prepareCourse(request, title, [
    {
      title: "Ventas",
      activities: [
        { type: "decision", title: "Cliente que solo pide precio por llanta", intro: "Atiende al cliente.", spec: NAMED_DECISION },
      ],
    },
    { title: "Cierre", content_text: "Gracias por completar el curso." },
  ]);
  // Records when the audio element first plays and when the play is requested (see the "Empezar" tap below).
  await page.addInitScript(() => {
    const events: string[] = [];
    (window as unknown as Tracked).__events = events;
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
      events.push(`play:${this.src.slice(0, "data:audio/wav".length)}`);
      return play.call(this);
    };
    const fetch = window.fetch;
    window.fetch = (input, init) => {
      if (String(input instanceof Request ? input.url : input).includes("/attempts")) events.push("start");
      return fetch(input, init);
    };
  });
  await openCourse(page, title);

  const play = page.getByRole("button", { name: "Jugar: Cliente que solo pide precio por llanta" });
  await expectTarget(play);
  await play.tap();
  const game = page.getByRole("dialog");
  await game.getByRole("button", { name: /Empezar/ }).tap();
  await expect(game.getByText("Solo quiero la llanta más barata para mi flota.")).toBeVisible();
  // iOS plays a line after a request only if the element already played inside the tap: a silent clip, first.
  expect(await page.evaluate(() => (window as unknown as Tracked).__events.slice(0, 2))).toEqual([
    "play:data:audio/wav",
    "start",
  ]);

  // A compact header: the title whole (two lines, never cut to one), no type label, 40 px buttons.
  const heading = game.getByRole("heading", { name: "Cliente que solo pide precio por llanta" });
  await expect(heading).toBeVisible();
  expect(await heading.evaluate((element) => element.scrollHeight <= element.clientHeight + 1)).toBe(true);
  await expect(game.getByText("Decisión con cliente")).toBeHidden();
  await expectTarget(game.getByRole("button", { name: "Cerrar actividad" }));
  await expectTarget(game.getByRole("button", { name: /la voz/ }));

  // The best answer on offer turns green and says so; then a weaker one says what was possible.
  await game.getByRole("button", { name: "¿Qué ruta y carga manejan?" }).tap();
  await expect(game.getByText("+6 puntos · la mejor opción")).toBeVisible();
  await game.getByRole("button", { name: "Le hablo de la marca." }).tap();
  await expect(game.getByText("+1 punto de 4 posibles")).toBeVisible();
  // Every past line is labeled with who said it.
  await expect(game.getByText("Don Ramiro · Transportes del Bajío")).toBeVisible();
  await expect(game.getByText("Ing. Laura Pérez · Flota")).toBeVisible();
  await expect(game.getByText("Cliente", { exact: true })).toHaveCount(0);

  // Over: "Ver resultado" waits at the bottom of the screen, with the focus.
  const result = game.getByRole("button", { name: /Ver resultado/ });
  await expect(result).toBeInViewport({ ratio: 1 });
  await expect(result).toBeFocused();
  await expectNoSidewaysScroll(page);

  // Closed without asking for the result: the play still counts, the module completes and the course moves on.
  await game.getByRole("button", { name: "Cerrar actividad" }).tap();
  await expect(game).toBeHidden();
  await expect(page.getByRole("heading", { level: 2, name: "Cierre" })).toBeVisible();
  await page.getByRole("button", { name: /Ventas/ }).tap();
  await expect(page.getByText("7 de 10 puntos")).toBeVisible();
  await expect(page.getByRole("button", { name: "Jugar de nuevo: Cliente que solo pide precio por llanta" })).toBeVisible();
});

test("cerrar un juego terminado: si guardarlo falla se avisa, y un resultado tardío nunca mueve el curso a destiempo", async ({
  page,
  request,
}) => {
  const title = `Celular: cerrar al final ${Date.now()}`;
  const course = await prepareCourse(request, title, [
    {
      title: "Ventas",
      activities: [
        { type: "decision", title: "Cliente que pide precio", spec: DECISION },
        { type: "decision", title: "Cliente con prisa", spec: DECISION },
      ],
    },
    { title: "Cierre", activities: [{ type: "decision", title: "Cliente que se despide", spec: DECISION }] },
    { title: "Repaso" },
  ]);
  const fetched = await logFetches(page);
  await openCourse(page, title);
  const game = page.getByRole("dialog");
  const courseAsked = new RegExp(`^→ .*/learn/courses/${course.id}$`);
  const courseAnswered = new RegExp(`^← .*/learn/courses/${course.id}$`);
  const listAsked = /^→ .*\/learn\/courses$/;
  const coursePage = (entry: string) =>
    entry.startsWith("→ ") && new URL(entry.slice(2), "http://localhost").pathname === `/learn/${course.id}`;
  /** What the page fetched once the play's "finish" was answered (among its fetches from `from` on). */
  const afterResult = async (from: number) => {
    const entries = (await fetched()).slice(from);
    const answer = entries.findIndex((entry) => /^← .*\/finish$/.test(entry));
    return answer < 0 ? [] : entries.slice(answer + 1);
  };
  /** One tap ends the conversation (the cheapest answer); the game closes without asking for its result. */
  const playAndClose = async (play: string) => {
    await page.getByRole("button", { name: play }).tap();
    await game.getByRole("button", { name: /Empezar/ }).tap();
    await game.getByRole("button", { name: "Le doy la más barata." }).tap();
    await expect(game.getByRole("button", { name: /Ver resultado/ })).toBeFocused();
    const closing = (await fetched()).length;
    await game.getByRole("button", { name: "Cerrar actividad" }).tap();
    // The course is asked again as the game closes (its result still on its way).
    await expect.poll(async () => (await fetched()).slice(closing).some((entry) => courseAnswered.test(entry))).toBe(true);
  };
  // The module in the address: from here the course moves on only when a play says so.
  await page.getByRole("button", { name: /Ventas/ }).tap();
  await expect(page).toHaveURL(/[?&]m=\d+/);

  // Saving the play as the game closes fails: the learner hears it, and the course is asked again for what the
  // server kept (the last move already counted the play).
  const fail = await holdFinish(page, 500);
  await playAndClose("Jugar: Cliente con prisa");
  let mark = (await fetched()).length;
  fail();
  await expect(page.getByText("El servidor tuvo un problema. Intenta de nuevo en unos segundos.")).toBeVisible();
  await expect.poll(async () => (await afterResult(mark)).some((entry) => courseAsked.test(entry))).toBe(true);
  await expect(page.getByRole("button", { name: "Jugar de nuevo: Cliente con prisa" })).toBeVisible();

  // The play that completes the module is recorded while another activity is open: the course is refreshed, but it
  // moves on only once that activity closes.
  const recordLate = await holdFinish(page);
  await playAndClose("Jugar: Cliente que pide precio");
  await page.getByRole("button", { name: "Jugar de nuevo: Cliente con prisa" }).tap();
  mark = (await fetched()).length;
  recordLate();
  await expect.poll(async () => (await afterResult(mark)).some((entry) => courseAsked.test(entry))).toBe(true);
  await game.getByRole("button", { name: /Empezar/ }).tap();
  await expect(game.getByText("Solo quiero la llanta más barata para mi flota.")).toBeVisible();
  expect((await afterResult(mark)).filter(coursePage)).toEqual([]);
  await game.getByRole("button", { name: "Cerrar actividad" }).tap();
  await expect(page.getByRole("heading", { level: 2, name: "Cierre" })).toBeVisible();

  // Recorded once the learner left the course: it refreshes their courses, and never takes them back to it (that
  // would start right as the courses are asked for, in the same step).
  const recordAfterLeaving = await holdFinish(page);
  await playAndClose("Jugar: Cliente que se despide");
  await page.getByRole("link", { name: "Mis cursos" }).tap();
  await expect(page).toHaveURL(/\/learn$/);
  await expect(page.getByRole("link", { name: new RegExp(title) }).first()).toBeVisible();
  mark = (await fetched()).length;
  recordAfterLeaving();
  await expect.poll(async () => (await afterResult(mark)).some((entry) => listAsked.test(entry))).toBe(true);
  expect((await afterResult(mark)).filter(coursePage)).toEqual([]);
  await expect(page).toHaveURL(/\/learn$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test.describe("a 360 px", () => {
  test.use({ viewport: { width: 360, height: 740 } });

  test("inspección en el camión y en tarjetas: las decisiones siempre a la vista", async ({ page, request }) => {
    const title = `Celular: inspección ${Date.now()}`;
    await prepareCourse(request, title, [
      {
        title: "Diagnóstico",
        activities: [
          { type: "inspection", title: "Revisa la unidad", spec: TRUCK },
          { type: "inspection", title: "Cascos en la planta", spec: CARDS },
        ],
      },
    ]);
    await openCourse(page, title);
    const game = page.getByRole("dialog");

    await page.getByRole("button", { name: "Jugar: Revisa la unidad" }).tap();
    await game.getByRole("button", { name: /Empezar/ }).tap();
    await expect(game.getByRole("heading", { name: "Llanta 1 · direccional izquierda" })).toBeVisible();
    // The decisions are on screen from the start (a sheet at the bottom); no keyboard hints on a touch screen.
    await expect(game.getByRole("button", { name: "Sigue rodando" })).toBeInViewport({ ratio: 1 });
    await expect(game.getByText(/Flechas o WASD/)).toBeHidden();
    await expect(game.locator("kbd").first()).toBeHidden();
    const factLabel = game.getByText("Presión", { exact: true });
    expect(await factLabel.evaluate((element) => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(12);

    // A tire at the back: tapping it brings its facts to the sheet, the decisions still in sight.
    await game.getByRole("button", { name: /^Llanta 6 · arrastre derecha: pendiente/ }).tap();
    await expect(game.getByRole("heading", { name: "Llanta 6 · arrastre derecha" })).toBeInViewport();
    await expect(game.getByText("3, con cuerdas expuestas")).toBeVisible();
    await game.getByRole("button", { name: "Retirar", exact: true }).tap();
    await expect(game.getByText("¡Bien! Retirar")).toBeInViewport();
    const next = game.getByRole("button", { name: /Siguiente/ });
    await expect(next).toBeInViewport({ ratio: 1 });

    // Lives and streak stay under the header wherever the diagram is scrolled to.
    await scrollDialogToBottom(game);
    await expect(game.getByRole("img", { name: "3 de 3 vidas" })).toBeInViewport();

    // The other tires, one after the other from the sheet (one of them wrong).
    const verdicts: Record<number, string> = { 1: "Sigue rodando", 2: "Sigue rodando", 3: "Retirar", 4: "Sigue rodando", 5: "Reencauchar" };
    for (const tire of [1, 2, 3, 4, 5]) {
      await next.tap();
      await expect(game.getByRole("heading", { name: new RegExp(`^Llanta ${tire} ·`) })).toBeVisible();
      const verdict = game.getByRole("button", { name: verdicts[tire], exact: true });
      await expect(verdict).toBeInViewport({ ratio: 1 });
      await verdict.tap();
      if (tire === 2) await expect(game.getByRole("img", { name: "2 de 3 vidas" })).toBeInViewport();
    }
    await expect(game.getByText(/Acertaste 5 de 6/)).toBeVisible();
    const result = game.getByRole("button", { name: /Ver resultado/ });
    await expect(result).toBeInViewport({ ratio: 1 });
    await expect(result).toBeFocused();
    await expectNoSidewaysScroll(page);
    await result.tap();
    // 10 + 12 (a streak of 2), the miss, then 10 + 12 + 14.
    await expect(game.getByRole("status").filter({ hasText: "/ 84" })).toContainText("58");
    await game.getByRole("button", { name: "Continuar" }).tap();

    // Cards: long labels and values wrap; the decisions are on screen without scrolling.
    await page.getByRole("button", { name: "Jugar: Cascos en la planta" }).tap();
    await game.getByRole("button", { name: /Empezar/ }).tap();
    await expect(game.getByText("295/80R22.5-XZE2+/LRH-16PR")).toBeVisible();
    await expect(game.getByRole("button", { name: "Renovar", exact: true })).toBeInViewport({ ratio: 1 });
    await expectNoSidewaysScroll(page);
    for (const [card, verdict] of [
      ["Casco 295/80R22.5", "Renovar"],
      ["Casco 11R22.5", "Revisión a fondo"],
      ["Casco con chipote", "Rechazar"],
    ]) {
      await expect(game.getByRole("heading", { name: new RegExp(`^${card.replace(".", "\\.")}`) })).toBeVisible();
      await game.getByRole("button", { name: verdict, exact: true }).tap();
      await expect(game.getByText(`¡Bien! ${verdict}`)).toBeInViewport();
      if (verdict !== "Rechazar") await game.getByRole("button", { name: /Siguiente/ }).tap();
    }
    await expect(game.getByRole("button", { name: /Ver resultado/ })).toBeInViewport({ ratio: 1 });
    await expectNoSidewaysScroll(page);
    await game.getByRole("button", { name: /Ver resultado/ }).tap();
    await expect(game.getByText("Completaste el módulo.")).toBeVisible();
  });

  test("inspección sin vidas: cada llanta dice cómo terminó, sin decisiones que no hacen nada", async ({
    page,
    request,
  }) => {
    const title = `Celular: sin vidas ${Date.now()}`;
    await prepareCourse(request, title, [
      { title: "Diagnóstico", activities: [{ type: "inspection", title: "Revisa la unidad", spec: { ...INSPECTION, lives: 1 } }] },
    ]);
    await openCourse(page, title);
    const game = page.getByRole("dialog");
    const end = game.getByText(/^Te quedaste sin vidas\. Acertaste 0 de 4/);
    const undecided = game.getByRole("button", { name: /^Llanta 2 · direccional derecha:/ });

    // The move that takes the only life comes without the other answers (as from an older server): a tire never
    // decided still says the game is over.
    await page.route(
      "**/activity-attempts/*/moves",
      async (route) => {
        const response = await route.fetch();
        const body = await response.json();
        delete body.result.items;
        await route.fulfill({ response, json: body });
      },
      { times: 1 },
    );
    await page.getByRole("button", { name: "Jugar: Revisa la unidad" }).tap();
    await game.getByRole("button", { name: /Empezar/ }).tap();
    await game.getByRole("button", { name: "Retirar", exact: true }).tap(); // tire 1 rolls on
    await expect(game.getByText("No: lo correcto era Sigue rodando")).toBeVisible();
    await expect(end).toBeInViewport();
    await undecided.tap();
    await expect(game.getByRole("heading", { name: "Llanta 2 · direccional derecha" })).toBeVisible();
    await expect(end).toBeInViewport();
    await expect(game.getByText("¿Qué haces?")).toHaveCount(0);
    await expect(game.getByRole("button", { name: "Reencauchar", exact: true })).toHaveCount(0);

    // Played again, the last move reveals every answer: the tire never decided shows what was right.
    await game.getByRole("button", { name: /Ver resultado/ }).tap();
    await game.getByRole("button", { name: /Jugar de nuevo/ }).tap();
    await game.getByRole("button", { name: /Empezar/ }).tap();
    await game.getByRole("button", { name: "Retirar", exact: true }).tap();
    await expect(end).toBeInViewport();
    await undecided.tap();
    await expect(game.getByText("Lo correcto: Reencauchar")).toBeVisible();
    await expect(end).toBeInViewport();
    await expect(game.getByText("¿Qué haces?")).toHaveCount(0);
  });

  test("la evaluación cabe en 360 px y sus botones quedan a la mano", async ({ page, request }) => {
    const title = `Celular: evaluación ${Date.now()}`;
    await prepareCourse(request, title, [
      {
        title: "Seguridad",
        quiz: {
          questions: [
            { id: "q1", type: "true_false", prompt: "El casco es obligatorio en toda la planta", correct: true, explanation: "Siempre." },
            {
              id: "q2",
              type: "single_choice",
              prompt: "¿Qué parte del cuerpo protege el casco durante una revisión de la unidad en el patio?",
              options: ["La cabeza", "Las manos", "Los pies"],
              correct_index: 0,
            },
          ],
          max_attempts: 3,
          passing_score: 100,
        },
      },
    ]);
    await openCourse(page, title);
    await page.getByRole("button", { name: /Presentar evaluación/ }).tap();
    const quiz = page.getByRole("dialog");
    const close = quiz.getByRole("button", { name: "Cerrar evaluación" });
    await expectTarget(close);

    await quiz.getByRole("radio", { name: "Falso" }).tap();
    // Leaving with answers asks first; that dialog's X is a 40 px target too.
    await close.tap();
    const confirm = page.getByRole("dialog", { name: "¿Salir de la evaluación?" });
    await expectTarget(confirm.getByRole("button", { name: "Cerrar", exact: true }));
    await confirm.getByRole("button", { name: "Cancelar" }).tap();

    await quiz.getByRole("button", { name: /Siguiente/ }).tap();
    const question = quiz.getByRole("heading", { name: /Qué parte del cuerpo/ });
    expect(await question.evaluate((element) => parseFloat(getComputedStyle(element).fontSize))).toBeLessThanOrEqual(20);
    await quiz.getByRole("radio", { name: /Las manos/ }).tap();
    // The last question's footer fits: "Anterior" is its arrow, "Enviar respuestas" takes the rest.
    const previous = quiz.getByRole("button", { name: "Anterior" });
    await expectTarget(previous);
    const send = quiz.getByRole("button", { name: /Enviar respuestas/ });
    const box = await send.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(360);
    await expectNoSidewaysScroll(page);

    // The header stays while the question scrolls.
    await scrollDialogToBottom(quiz);
    await expect(close).toBeInViewport({ ratio: 1 });

    await send.tap();
    await expect(quiz.getByRole("heading", { name: "Aún no alcanzas el puntaje" })).toBeVisible();
    // Trying again is right under the score: no scrolling past the answers, and it fits the screen.
    const retry = quiz.getByRole("button", { name: /Intentar de nuevo/ });
    await expect(retry).toBeInViewport({ ratio: 1 });
    const retryBox = await retry.boundingBox();
    expect(retryBox!.x + retryBox!.width).toBeLessThanOrEqual(360);
    await expectNoSidewaysScroll(page);
    await retry.tap();
    await expect(quiz.getByText("Pregunta 1 de 2")).toBeVisible();
  });
});

test("simulador y retos rápidos con toques", async ({ page, request }) => {
  const title = `Celular: simulador y retos ${Date.now()}`;
  await prepareCourse(request, title, [
    {
      title: "Números",
      activities: [
        { type: "simulator", title: "Baja el costo por km", spec: MONEY_SIMULATOR },
        { type: "quick", title: "Causas del desgaste", spec: QUICK_MATCH },
        { type: "quick", title: "Revisión en patio", spec: QUICK_ORDER },
      ],
    },
  ]);
  await openCourse(page, title);
  const game = page.getByRole("dialog");

  // Simulator: money as written in Mexico, thumb-sized controls, steps with − and +.
  await page.getByRole("button", { name: "Jugar: Baja el costo por km" }).tap();
  await game.getByRole("button", { name: /Empezar/ }).tap();
  await expect(game.getByText("$6,000", { exact: true })).toBeVisible();
  await expect(game.getByText("6,000 $")).toHaveCount(0);
  await expectTarget(game.getByRole("slider", { name: "Kilómetros de vida" }));
  const more = game.getByRole("button", { name: "Aumentar Kilómetros de vida" });
  await expectTarget(more);
  const probe = game.getByRole("button", { name: /Probar estos valores/ });
  await expect(probe).toBeInViewport({ ratio: 1 });
  await probe.tap();
  await expect(game.getByText("Todavía no: prueba con más kilómetros de vida.")).toBeInViewport();
  await expect(game.getByText(/Intento 2 de 6/)).toBeVisible();
  for (let step = 0; step < 3; step += 1) await more.tap();
  await expect(game.getByText("130,000 km")).toBeVisible();
  await expect(game.getByText("0.046")).toBeVisible();
  await probe.tap();
  await expect(game.getByText("Así se vende: más vida útil, menos costo por kilómetro.")).toBeInViewport();
  await expect(game.getByText(/Lo lograste en 2 intentos/)).toBeVisible();
  await expect(game.getByRole("button", { name: /Ver resultado/ })).toBeInViewport({ ratio: 1 });
  await expectNoSidewaysScroll(page);
  await game.getByRole("button", { name: /Ver resultado/ }).tap();
  await game.getByRole("button", { name: "Continuar" }).tap();

  // Quick match, against the clock.
  await page.getByRole("button", { name: "Jugar: Causas del desgaste" }).tap();
  await game.getByRole("button", { name: /Empezar/ }).tap();
  await expect(game.getByRole("timer")).toBeVisible();
  const tile = (name: string) => game.getByRole("button", { name, exact: true });
  // An answer tapped first says what to do instead of nothing.
  await tile("Sobreinflado").tap();
  await expect(game.getByText("Primero toca un concepto de la izquierda.")).toBeVisible();
  await tile("Centro gastado").tap();
  await tile("Sobreinflado").tap();
  await expect(tile("Centro gastado")).toBeDisabled(); // matched
  await expect(tile("Baja presión de inflado")).toBeEnabled(); // and its answer is back: nothing in flight
  // Where a card sits in the game (not on the screen, which a scroll would change).
  const top = (name: string) => tile(name).evaluate((element) => (element as HTMLElement).offsetTop);
  const below = await top("Copas o parches");

  // While a pair is on its way it is marked and the answers wait; a concept picked meanwhile stays picked.
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  let intercepted!: () => void;
  const reached = new Promise<void>((resolve) => (intercepted = resolve));
  await page.route(
    "**/activity-attempts/*/moves",
    async (route) => {
      intercepted();
      await held;
      await route.continue();
    },
    { times: 1 },
  );
  await tile("Hombros gastados").tap();
  await tile("Baja presión de inflado").tap();
  await reached;
  await expect(tile("Baja presión de inflado")).toHaveAttribute("aria-busy", "true");
  await expect(tile("Desalineación de la unidad")).toBeDisabled();
  await tile("Un lado gastado").tap();
  release();
  await expect(tile("Baja presión de inflado")).toBeDisabled(); // matched
  await expect(tile("Un lado gastado")).toHaveAttribute("aria-pressed", "true");
  // The streak's bonus floats over the status bar: the cards didn't move.
  await expect(game.getByText("Racha +2", { exact: true })).toBeVisible();
  expect(await top("Copas o parches")).toBe(below);

  // A wrong pair shakes, then settles back in its place (a shake cut short used to leave it a few px off).
  const shaken = tile("Amortiguadores o balanceo en mal estado");
  await shaken.tap();
  await expect(tile("Un lado gastado")).toHaveAttribute("aria-pressed", "false"); // answered: the shake is on
  await expect(shaken).not.toHaveClass(/border-destructive/); // and over: the wrong mark outlasts the shake
  await expect
    .poll(() =>
      shaken.evaluate((element) => {
        const transform = getComputedStyle(element).transform;
        return transform === "none" ? 0 : new DOMMatrix(transform).m41;
      }),
    )
    .toBe(0);
  // The clock stays in sight under the header wherever the cards are scrolled to.
  await scrollDialogToBottom(game);
  await expect(game.getByRole("timer")).toBeInViewport({ ratio: 1 });
  await tile("Un lado gastado").tap();
  await tile("Desalineación de la unidad").tap();
  await tile("Copas o parches").tap();
  await tile("Amortiguadores o balanceo en mal estado").tap();
  await expect(game.getByText("¡Completaste el reto!", { exact: true })).toBeVisible();
  await expect(game.getByRole("button", { name: /Ver resultado/ })).toBeInViewport({ ratio: 1 });
  await expectNoSidewaysScroll(page);
  await game.getByRole("button", { name: /Ver resultado/ }).tap();
  await game.getByRole("button", { name: "Continuar" }).tap();

  // Quick order without the clock: each placed step shows its number where it is (no copy below the fold).
  await page.getByRole("button", { name: "Jugar: Revisión en patio" }).tap();
  const untimed = game.getByRole("checkbox", { name: /sin límite de tiempo/ });
  await expectTarget(untimed, 24);
  await untimed.tap();
  await game.getByRole("button", { name: /Empezar/ }).tap();
  await expect(game.getByRole("timer")).toHaveCount(0);
  for (let index = 0; index < QUICK_ORDER.items.length; index += 1) {
    const step = QUICK_ORDER.items[index];
    await game.getByRole("button", { name: step }).tap();
    await expect(game.getByRole("button", { name: `Paso ${index + 1}: ${step}` })).toBeDisabled();
  }
  await expect(game.getByText("Tu orden")).toBeHidden();
  await expect(game.getByRole("button", { name: /Ver resultado/ })).toBeInViewport({ ratio: 1 });
  await game.getByRole("button", { name: /Ver resultado/ }).tap();
  await expect(game.getByText("Completaste el módulo.")).toBeVisible();
});

test("un reto con reloj que se venció vuelve jugable", async ({ page, request }) => {
  const title = `Celular: reloj ${Date.now()}`;
  await prepareCourse(request, title, [
    { title: "Patio", activities: [{ type: "quick", title: "Revisión en patio", spec: { ...QUICK_ORDER, seconds: 20 } }] },
  ]);
  await openCourse(page, title);
  const game = page.getByRole("dialog");
  const first = QUICK_ORDER.items[0];

  await page.getByRole("button", { name: "Jugar: Revisión en patio" }).tap();
  await game.getByRole("button", { name: /Empezar/ }).tap();
  const started = Date.now();
  await game.getByRole("button", { name: first }).tap();
  await expect(game.getByRole("button", { name: `Paso 1: ${first}` })).toBeDisabled();
  await game.getByRole("button", { name: "Cerrar actividad" }).tap();

  // Still on the clock: the card (which gets the focus back as the game closes) and the intro offer to go on;
  // untimed is a choice for new games only.
  const resume = page.getByRole("button", { name: "Continuar: Revisión en patio" });
  await expect(resume).toBeFocused();
  await resume.tap();
  await expect(game.getByRole("checkbox")).toHaveCount(0);
  await game.getByRole("button", { name: /Continuar partida/ }).tap();
  await expect(game.getByRole("button", { name: `Paso 1: ${first}` })).toBeDisabled();
  await game.getByRole("button", { name: "Cerrar actividad" }).tap();

  // Back once its time (and the server's grace) ran out: a new game to play, not one already lost.
  await page.waitForTimeout(Math.max(0, started + 25_000 - Date.now()));
  await page.reload();
  await page.getByRole("button", { name: "Jugar: Revisión en patio" }).tap();
  await expect(game.getByRole("checkbox", { name: /sin límite de tiempo/ })).toBeVisible();
  await game.getByRole("button", { name: /Empezar/ }).tap();
  await expect(game.getByRole("timer")).toContainText(/0:(19|20)/);
  await expect(game.getByText("Se acabó el tiempo.")).toHaveCount(0);
  await expect(game.getByRole("button", { name: first })).toBeEnabled();
  await expect(game.getByText(/Paso 1/)).toHaveCount(0);
  await game.getByRole("button", { name: "Cerrar actividad" }).tap();
  // The expired play counted with the step it had; the new one waits to be continued.
  await expect(page.getByText("10 de 90 puntos")).toBeVisible();
  await expect(page.getByRole("button", { name: "Continuar: Revisión en patio" })).toBeVisible();
});

test("el curso en el celular: módulos a la vista, bloqueos explicados y errores claros", async ({ page, request }) => {
  const title = `Celular: curso ${Date.now()}`;
  await prepareCourse(request, title, [
    { title: "Uno: bienvenida" },
    { title: "Dos: seguridad" },
    { title: "Tres: herramientas" },
    { title: "Cuatro: cierre" },
  ]);
  await page.goto("/login");
  // Fields of 16 px (iOS zooms into smaller ones) and a password toggle a finger can hit.
  expect(await page.getByLabel("Correo electrónico").evaluate((element) => getComputedStyle(element).fontSize)).toBe("16px");
  await expectTarget(page.getByRole("button", { name: "Mostrar contraseña" }));
  await openCourse(page, title);
  await expectTarget(page.getByRole("link", { name: "Mis cursos" }));

  // A locked module says what unlocks it.
  const locked = page.getByRole("button", { name: /Tres: herramientas/ });
  await expect(locked).toBeDisabled();
  await locked.tap({ force: true });
  await expect(page.getByText("Completa «Uno: bienvenida» para desbloquear este módulo.")).toBeVisible();

  // Moving on keeps the current module in sight in the sideways list.
  for (const next of ["Dos: seguridad", "Tres: herramientas", "Cuatro: cierre"]) {
    await page.getByRole("button", { name: /Marcar como completado/ }).tap();
    await expect(page.getByRole("heading", { level: 2, name: next })).toBeVisible();
  }
  await expect(page.getByRole("button", { name: /Cuatro: cierre/ })).toBeInViewport({ ratio: 1 });
  await expect(page.getByText("¿Terminaste? Márcalo para terminar el curso.")).toBeVisible();
  await expectNoSidewaysScroll(page);

  // "Cerrar sesión" in the menu is a finger-sized target.
  await page.getByRole("button", { name: "Abrir menú" }).tap();
  const menu = page.getByRole("dialog", { name: "Menú principal" });
  await expectTarget(menu.getByRole("button", { name: "Cerrar sesión" }));
  await menu.getByRole("button", { name: "Cerrar menú" }).tap();

  // A course that isn't the learner's: a clear message and the way back, not a retry.
  await page.goto("/learn/99999999");
  await expect(page.getByRole("heading", { name: "No puedes abrir este curso" })).toBeVisible();
  await page.getByRole("link", { name: "Volver a mis cursos" }).tap();
  await expect(page).toHaveURL(/\/learn$/);
});
