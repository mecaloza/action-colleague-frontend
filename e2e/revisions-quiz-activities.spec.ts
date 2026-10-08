import { test, expect, type Locator, type Page, type Request } from "@playwright/test";
import { SIMULATOR } from "./fixtures/activities";
import { adminApi } from "./fixtures/api";
import {
  ACTIVITY_INTRO,
  ACTIVITY_TITLE,
  activityCourse,
  MODULE_TITLE,
  publishedWithLearner,
  QUESTIONS,
  quizCourse,
  savedActivity,
  savedQuestions,
} from "./fixtures/revisions";

// "Pedir un cambio" to a module's quiz (all of it or some questions) and to one of its activities, against a backend
// with fake providers: the AI's change is deterministic (see fixtures/revisions.ts).
test.setTimeout(120_000);

const FIELD = "¿Qué quieres cambiar?";

const quizSheet = (page: Page) => page.getByRole("dialog", { name: "Cambios a la evaluación" });
const activitySheet = (page: Page) => page.getByRole("dialog", { name: "Cambios a la actividad" });

/** The module's header in Evaluaciones (it opens and closes its quiz). */
const quizHeader = (page: Page) => page.getByRole("button", { name: new RegExp(MODULE_TITLE), expanded: true });

/** An activity's row in Actividades. */
const activityRow = (page: Page, title: string) =>
  page.getByRole("list", { name: `Actividades de ${MODULE_TITLE}` }).getByRole("listitem").filter({ hasText: title });

const toastWith = (page: Page, text: string) => page.locator("[data-sonner-toast]").filter({ hasText: text });

const isProposal = (moduleId: number) => (request: Request) =>
  request.url().endsWith(`/modules/${moduleId}/revisions`) && request.method() === "POST";
const isApply = (request: Request) => /\/revisions\/\d+\/apply$/.test(request.url()) && request.method() === "POST";

/** Asks for a change with this observation and waits for the AI's proposal; returns what was sent. */
async function askChange(page: Page, sheet: Locator, moduleId: number, observation: string) {
  await sheet.getByLabel(FIELD).fill(observation);
  const [asked] = await Promise.all([
    page.waitForRequest(isProposal(moduleId)),
    sheet.getByRole("button", { name: "Pedir propuesta" }).click(),
  ]);
  await expect(sheet.getByRole("heading", { name: "Propuesta de la IA" })).toBeVisible({ timeout: 60_000 });
  return asked.postDataJSON();
}

/** Applies the proposal on screen (without producing anything) and waits for the panel to close. */
async function apply(page: Page, sheet: Locator) {
  const [applied] = await Promise.all([
    page.waitForRequest(isApply),
    sheet.getByRole("button", { name: "Aplicar", exact: true }).click(),
  ]);
  expect(applied.postDataJSON()).toEqual({ render: false });
  await expect(sheet).toBeHidden();
}

test("un cambio a la pregunta 2 se revisa campo por campo, se aplica y se deshace", async ({ page, request }) => {
  const call = await adminApi(request);
  const { courseId, moduleId } = await quizCourse(call, "Cambios a la evaluación");
  // Someone tried the quiz without passing it and has attempts left: the change reaches their next attempt.
  const learner = await publishedWithLearner(call, request, courseId);
  const quiz = await learner<{ version: string }>("get", `/learn/modules/${moduleId}/quiz`);
  await learner("post", `/learn/modules/${moduleId}/quiz/attempts`, { answers: [], version: quiz.version });

  await page.goto(`/admin/courses/${courseId}?tab=evaluations`);
  await expect(quizHeader(page)).toContainText("3 preguntas · aprueba con 70%");
  await expect(quizHeader(page)).not.toContainText("Cambio por revisar");
  // Each question offers a change of its own: the panel starts on it.
  await page.getByRole("button", { name: "Pedir un cambio en la pregunta 2" }).click();
  const sheet = quizSheet(page);
  await expect(sheet).toContainText(MODULE_TITLE);
  const field = sheet.getByLabel(FIELD);
  const second = sheet.getByRole("button", { name: "Pregunta 02 · ¿Cuándo se revisa el casco?" });
  await expect(second).toHaveAttribute("aria-pressed", "true");
  await expect(sheet.getByRole("button", { name: "Toda la evaluación" })).toHaveAttribute("aria-pressed", "false");
  await expect(sheet).toContainText("La IA solo cambia las preguntas elegidas.");
  // The examples are about questions.
  await sheet.getByRole("button", { name: /Usar el ejemplo: Dos opciones podrían ser correctas/ }).click();
  await expect(field).toHaveValue("Dos opciones podrían ser correctas: que solo una lo sea.");
  await expect(field).toBeFocused();

  const observation = "La pregunta no dice de qué revisión se trata.";
  expect(await askChange(page, sheet, moduleId, observation)).toEqual({
    target: "quiz",
    observation,
    question_ids: ["q2"],
  });
  await expect(sheet.getByRole("heading", { name: "Propuesta de la IA" })).toBeFocused(); // the result arrived
  await expect(sheet).toContainText("Ajusté 1 pregunta(s) según la observación.");
  await expect(sheet).toContainText(`Pediste: «${observation}» · Pregunta 02`);

  // Question 2, field by field: its prompt before and after. What is answered changes: its results start anew.
  const card = sheet.getByRole("listitem", { name: "Pregunta 2: Revisado: ¿Cuándo se revisa el casco?" });
  await expect(card.getByText("Cambia", { exact: true })).toBeVisible();
  await expect(card).toContainText("Por qué: Así lo pidió la observación.");
  await expect(card.getByText("Enunciado", { exact: true })).toBeVisible();
  await expect(card.getByText("¿Cuándo se revisa el casco?", { exact: true })).toBeVisible();
  await expect(card.getByText("Revisado: ¿Cuándo se revisa el casco?", { exact: true })).toBeVisible();
  await expect(card).toContainText("Cambia lo que se responde: sus resultados empiezan de cero");
  await expect(sheet.getByRole("listitem", { name: /^Pregunta [13]:/ })).toHaveCount(0); // only what changes
  // Whom it reaches as soon as it is applied (a quiz has no video to produce again).
  const reach = sheet.getByRole("region", { name: "Para las personas" });
  await expect(reach).toContainText(
    "El curso está publicado: quienes lo toman ven la evaluación nueva en cuanto apliques el cambio.",
  );
  await expect(reach).toContainText(
    "1 persona ya intentó la evaluación sin aprobarla: su próximo intento será con las preguntas nuevas.",
  );
  await expect(sheet.getByRole("region", { name: "Para el video" })).toHaveCount(0);
  await expect(sheet.getByRole("button", { name: "Aplicar y volver a producir" })).toHaveCount(0);

  // Applied: the open quiz shows it at once, and a toast offers to undo it.
  await apply(page, sheet);
  const toast = toastWith(page, "Cambio aplicado");
  await expect(toast).toBeVisible();
  await expect(page.getByLabel("Enunciado")).toHaveValue("Revisado: ¿Cuándo se revisa el casco?");
  const changed = await savedQuestions(call, moduleId);
  expect(changed.map((question) => question.prompt)).toEqual([
    QUESTIONS[0].prompt,
    "Revisado: ¿Cuándo se revisa el casco?",
    QUESTIONS[2].prompt,
  ]);
  expect(changed[1].id).not.toBe("q2"); // another question to the results: the answers given stay with the old one

  // Undone from the toast: the question is back, with its own id (and its results).
  await toast.getByRole("button", { name: "Deshacer" }).click();
  await expect(toastWith(page, "Cambio deshecho")).toBeVisible();
  await expect(page.getByLabel("Enunciado")).toHaveValue("¿Cuándo se revisa el casco?");
  expect((await savedQuestions(call, moduleId)).map((question) => question.id)).toEqual(["q1", "q2", "q3"]);

  // The history: the undo (which could be undone too), the change it undid, and the quiz saved at first.
  await page.getByRole("button", { name: "Historial de cambios" }).click();
  await expect(sheet.getByRole("tab", { name: "Historial" })).toHaveAttribute("aria-selected", "true");
  const history = sheet.getByRole("list", { name: "Cambios de la evaluación" }).getByRole("listitem");
  await expect(history).toHaveCount(3);
  await expect(history.nth(0)).toContainText("Cambio deshecho");
  await expect(history.nth(0)).toContainText("Aplicado");
  await expect(history.nth(0).getByRole("button", { name: /^Deshacer: Deshace: / })).toBeVisible();
  await expect(history.nth(1)).toContainText("Cambio pedido a la IA");
  await expect(history.nth(1)).toContainText("Deshecho");
  await expect(history.nth(1)).toContainText(`«${observation}»`);
  await expect(history.nth(2)).toContainText("Edición a mano");
  await expect(history.nth(2)).toContainText("Cambios a mano en 3 preguntas.");
});

test("lo editado en la evaluación no se pierde, y un cambio a toda la evaluación puede agregar preguntas", async ({
  page,
  request,
}) => {
  const call = await adminApi(request);
  const { courseId, moduleId } = await quizCourse(call, "Evaluación con cambios sin guardar");
  await page.goto(`/admin/courses/${courseId}?tab=evaluations`);
  const sheet = quizSheet(page);
  const ask = page.getByRole("button", { name: "Pedir un cambio", exact: true });
  const second = page.getByRole("button", { name: "Pedir un cambio en la pregunta 2" });
  const statement = page.getByLabel("Afirmación").first();
  const edited = "El casco se usa siempre, también en la bodega";

  // The AI starts from the saved quiz: not while there are edits, for the whole quiz or a question.
  await statement.fill(edited);
  await expect(ask).toBeDisabled();
  await expect(second).toBeDisabled();
  const hint = "Para pedirle un cambio a la IA, primero guarda o descarta lo que editaste: la IA trabaja sobre la evaluación guardada.";
  await expect(ask).toHaveAccessibleDescription(hint);
  await expect(second).toHaveAccessibleDescription(hint);
  await page.getByRole("button", { name: "Descartar cambios" }).click();
  await expect(statement).toHaveValue(QUESTIONS[0].prompt);
  await expect(ask).toBeEnabled();

  // The whole quiz: the AI picks the question (the fake one, the first); here only its explanation, and one more.
  await ask.click();
  await expect(sheet.getByRole("button", { name: "Toda la evaluación" })).toHaveAttribute("aria-pressed", "true");
  const observation = "Que la explicación sea más clara y agrega una pregunta sobre el barbiquejo.";
  expect(await askChange(page, sheet, moduleId, observation)).toEqual({
    target: "quiz",
    observation,
    question_ids: null,
  });
  await expect(sheet).toContainText(`Pediste: «${observation}» · Toda la evaluación`);
  const first = sheet.getByRole("listitem", { name: `Pregunta 1: ${QUESTIONS[0].prompt}` });
  await expect(first.getByText("Explicación", { exact: true })).toBeVisible();
  await expect(first.getByText(`Revisado: ${QUESTIONS[0].explanation}`, { exact: true })).toBeVisible();
  await expect(first).not.toContainText("sus resultados empiezan de cero"); // the same question to answer
  // The new one, whole.
  const added = sheet.getByRole("listitem", { name: "Pregunta 2: Revisado: una pregunta nueva" });
  await expect(added.getByText("Pregunta nueva", { exact: true })).toBeVisible();
  await expect(added).toContainText("Verdadero / falso");
  await expect(added.getByText("Verdadero", { exact: true })).toBeVisible();
  await expect(sheet.getByRole("region", { name: "Para las personas" })).toContainText(
    "El curso no está publicado: nadie ve el cambio hasta que lo publiques.",
  );

  // Left for later: the quiz says a change waits. Meanwhile the admin edits it, and the change waits for that.
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  await expect(quizHeader(page)).toContainText("Cambio por revisar");
  await statement.fill(edited);
  await page.getByRole("button", { name: "Revisar la propuesta" }).click();
  await expect(sheet.getByRole("heading", { name: "Propuesta de la IA" })).toBeVisible();
  const applyButton = sheet.getByRole("button", { name: "Aplicar", exact: true });
  await expect(applyButton).toBeDisabled();
  await expect(applyButton).toHaveAccessibleDescription(
    "Guarda o descarta los cambios de la evaluación en el editor: aplicar la propuesta los reemplazaría.",
  );
  await page.keyboard.press("Escape");
  await expect(statement).toHaveValue(edited);

  // The edit discarded, the proposal is applied: four questions, the first one with the same id.
  await page.getByRole("button", { name: "Descartar cambios" }).click();
  await page.getByRole("button", { name: "Revisar la propuesta" }).click();
  await apply(page, sheet);
  const toast = toastWith(page, "Cambio aplicado");
  await expect(page.getByRole("article")).toHaveCount(4);
  const changed = await savedQuestions(call, moduleId);
  expect(changed.map((question) => question.prompt)).toEqual([
    QUESTIONS[0].prompt,
    "Revisado: una pregunta nueva",
    QUESTIONS[1].prompt,
    QUESTIONS[2].prompt,
  ]);
  expect(changed[0]).toMatchObject({ id: "q1", explanation: `Revisado: ${QUESTIONS[0].explanation}` });

  // Edited after it: the toast's «Deshacer» waits (it would replace the edit) and stays.
  await statement.fill(edited);
  await toast.getByRole("button", { name: "Deshacer" }).click();
  const unsaved = toastWith(page, "Guarda o descarta los cambios de la evaluación");
  await expect(unsaved).toBeVisible();
  await expect(toast).toBeVisible();
  await expect(statement).toHaveValue(edited);

  // The edit discarded, the same toast undoes the change.
  await page.getByRole("button", { name: "Descartar cambios" }).click();
  await unsaved.hover(); // the toasts spread out, the first one in reach
  await toast.getByRole("button", { name: "Deshacer" }).click();
  await expect(toastWith(page, "Cambio deshecho")).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(3);
  await expect(quizHeader(page)).toContainText("3 preguntas");
  await expect(quizHeader(page)).not.toContainText("Cambio por revisar");
});

test("si la pregunta cambió desde la propuesta, no se aplica: se pide de nuevo", async ({ page, request }) => {
  const call = await adminApi(request);
  const { courseId, moduleId } = await quizCourse(call, "Pregunta cambiada");
  await page.goto(`/admin/courses/${courseId}?tab=evaluations`);
  await page.getByRole("button", { name: "Pedir un cambio en la pregunta 3" }).click();
  const sheet = quizSheet(page);
  const observation = "Que la afirmación sea más directa.";
  await askChange(page, sheet, moduleId, observation);

  // Meanwhile question 3 is edited elsewhere.
  const reworded = "Un casco golpeado puede seguir en uso";
  await call("put", `/modules/${moduleId}/evaluation`, {
    questions: QUESTIONS.map((question) => (question.id === "q3" ? { ...question, prompt: reworded } : question)),
  });

  await sheet.getByRole("button", { name: "Aplicar", exact: true }).click();
  const stale = sheet.getByRole("alert").filter({ hasText: "La evaluación cambió desde la propuesta" });
  await expect(stale).toContainText("La evaluación cambió en la pregunta 3 desde la propuesta; pide el cambio de nuevo.");
  await expect(sheet.getByRole("button", { name: "Aplicar", exact: true })).toBeDisabled();
  expect((await savedQuestions(call, moduleId))[2].prompt).toBe(reworded);

  // Asked again on the quiz as it is now: the same observation and question.
  await stale.getByRole("button", { name: "Pedir el cambio de nuevo" }).click();
  await expect(sheet.getByLabel(FIELD)).toHaveValue(observation);
  await expect(sheet.getByRole("button", { name: `Pregunta 03 · ${reworded}` })).toHaveAttribute("aria-pressed", "true");
  await askChange(page, sheet, moduleId, observation);
  await apply(page, sheet);
  expect((await savedQuestions(call, moduleId))[2].prompt).toBe(`Revisado: ${reworded}`);
});

test("un cambio a una actividad publicada se revisa parte por parte, se aplica y se deshace", async ({
  page,
  request,
}) => {
  const call = await adminApi(request);
  const { courseId, moduleId, activityId } = await activityCourse(call, "Cambios a la actividad");
  const { version } = await savedActivity(call, moduleId, activityId);
  // Someone has a play of it open: applying the change makes them start it again.
  const learner = await publishedWithLearner(call, request, courseId);
  await learner("post", `/learn/activities/${activityId}/attempts`, { untimed: false });

  await page.goto(`/admin/courses/${courseId}?tab=activities`);
  const row = activityRow(page, ACTIVITY_TITLE);
  await row.getByRole("button", { name: `Pedir un cambio a ${ACTIVITY_TITLE}` }).click();
  const sheet = activitySheet(page);
  await expect(sheet).toContainText("Decisión con cliente");
  await expect(sheet).toContainText(ACTIVITY_TITLE);
  // An activity is changed whole: nothing to choose, and examples of its own.
  await expect(sheet.getByRole("group")).toHaveCount(0);
  await expect(sheet.getByRole("button", { name: /Usar el ejemplo: Que la introducción diga/ })).toBeVisible();

  const observation = "Que el título diga qué se decide y las consecuencias hablen del costo.";
  expect(await askChange(page, sheet, moduleId, observation)).toEqual({
    target: "activity",
    observation,
    activity_id: activityId,
  });
  await expect(sheet).toContainText("Ajusté la actividad según la observación.");
  await expect(sheet).toContainText(`Pediste: «${observation}»`);

  // Part by part: its title and intro before and after, and the choice whose consequence changes.
  const title = sheet.getByRole("listitem", { name: "Título" });
  await expect(title.getByText(ACTIVITY_TITLE, { exact: true })).toBeVisible();
  await expect(title.getByText(`Revisado: ${ACTIVITY_TITLE}`, { exact: true })).toBeVisible();
  const intro = sheet.getByRole("listitem", { name: "Introducción" });
  await expect(intro.getByText(ACTIVITY_INTRO, { exact: true })).toBeVisible();
  await expect(intro.getByText(`Revisado: ${ACTIVITY_INTRO}`, { exact: true })).toBeVisible();
  const choice = sheet.getByRole("listitem", { name: "Opción 1 de la situación 1" });
  await expect(choice.getByText("Cambia", { exact: true })).toBeVisible();
  await expect(choice.getByText("Consecuencia", { exact: true })).toBeVisible();
  await expect(choice.getByText("Vendes hoy, pero el costo por kilómetro sube.", { exact: true })).toBeVisible();
  await expect(choice.getByText("Vendes hoy, pero el costo por kilómetro sube. Revisado.", { exact: true })).toBeVisible();
  await expect(choice.getByText("Texto", { exact: true })).toHaveCount(0); // only what changes in it
  // Whom it reaches, and the voice it takes.
  const reach = sheet.getByRole("region", { name: "Para las personas" });
  await expect(reach).toContainText("La actividad está publicada: quienes la juegan ven el cambio en cuanto lo apliques.");
  await expect(reach).toContainText("1 persona tiene una partida abierta: al aplicar el cambio, la empieza de nuevo.");
  await expect(reach).toContainText("Se graba de nuevo la voz de 2 líneas; las demás conservan la suya.");

  // Applied: a new version of the activity, its new lines voiced.
  await apply(page, sheet);
  const toast = toastWith(page, "Cambio aplicado");
  await expect(toast).toContainText("La voz de las líneas nuevas se está grabando.");
  await expect(activityRow(page, `Revisado: ${ACTIVITY_TITLE}`)).toBeVisible();
  const applied = await savedActivity(call, moduleId, activityId);
  expect(applied).toMatchObject({ title: `Revisado: ${ACTIVITY_TITLE}`, version: version + 1 });

  // Undone from the toast: as it was (a version of its own).
  await toast.getByRole("button", { name: "Deshacer" }).click();
  await expect(toastWith(page, "Cambio deshecho")).toBeVisible();
  await expect(activityRow(page, `Revisado: ${ACTIVITY_TITLE}`)).toHaveCount(0);
  expect(await savedActivity(call, moduleId, activityId)).toMatchObject({ title: ACTIVITY_TITLE, version: version + 2 });

  // The history: the undo and the change it undid.
  await row.getByRole("button", { name: `Pedir un cambio a ${ACTIVITY_TITLE}` }).click();
  await sheet.getByRole("tab", { name: "Historial" }).click();
  const history = sheet.getByRole("list", { name: "Cambios de la actividad" }).getByRole("listitem");
  await expect(history).toHaveCount(2);
  await expect(history.nth(0)).toContainText("Cambio deshecho");
  await expect(history.nth(0)).toContainText("Aplicado");
  await expect(history.nth(1)).toContainText("Cambio pedido a la IA");
  await expect(history.nth(1)).toContainText("Deshecho");
});

test("la propuesta de una actividad espera en su fila, y si la actividad cambió se pide de nuevo", async ({
  page,
  request,
}) => {
  const call = await adminApi(request);
  const title = "Costo por kilómetro";
  const { courseId, moduleId, activityId } = await activityCourse(call, "Actividad cambiada", {
    type: "simulator",
    title,
    spec: SIMULATOR,
    status: "draft",
  });
  await page.goto(`/admin/courses/${courseId}?tab=activities`);
  const row = activityRow(page, title);
  await row.getByRole("button", { name: `Pedir un cambio a ${title}` }).click();
  const sheet = activitySheet(page);
  const observation = "Que el reto diga para qué sirve bajar el costo.";
  await askChange(page, sheet, moduleId, observation);
  const instruction = sheet.getByRole("listitem", { name: "Instrucción" });
  await expect(instruction.getByText(SIMULATOR.prompt, { exact: true })).toBeVisible();
  await expect(instruction.getByText(`Revisado: ${SIMULATOR.prompt}`, { exact: true })).toBeVisible();
  // A draft: nobody sees it, and its voice is recorded when it is published.
  const reach = sheet.getByRole("region", { name: "Para las personas" });
  await expect(reach).toContainText("La actividad es un borrador: nadie la ve hasta que la publiques.");
  await expect(reach).not.toContainText("voz");

  // Left for later: its row says a change waits, and opens it.
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  const waiting = row.getByRole("button", { name: `Cambio por revisar: abrir la propuesta de ${title}` });
  await waiting.click();
  await expect(sheet.getByRole("heading", { name: "Propuesta de la IA" })).toBeVisible();
  await expect(sheet).toContainText(`Pediste: «${observation}»`);

  // Meanwhile its instruction is edited elsewhere: the proposal can't be applied over it.
  const reworded = "Baja el costo por kilómetro de la flota a menos de $0.050.";
  await call("put", `/activities/${activityId}`, { spec: { ...SIMULATOR, prompt: reworded } });
  await sheet.getByRole("button", { name: "Aplicar", exact: true }).click();
  const stale = sheet.getByRole("alert").filter({ hasText: "La actividad cambió desde la propuesta" });
  await expect(stale).toContainText("La actividad cambió en la instrucción desde la propuesta; pide el cambio de nuevo.");
  await expect(sheet.getByRole("button", { name: "Aplicar", exact: true })).toBeDisabled();

  // Asked again on the activity as it is now.
  await stale.getByRole("button", { name: "Pedir el cambio de nuevo" }).click();
  await expect(sheet.getByLabel(FIELD)).toHaveValue(observation);
  await askChange(page, sheet, moduleId, observation);
  await expect(instruction.getByText(reworded, { exact: true })).toBeVisible();
  await apply(page, sheet);
  expect((await savedActivity(call, moduleId, activityId)).spec.prompt).toBe(`Revisado: ${reworded}`);
  await expect(waiting).toHaveCount(0);
});
