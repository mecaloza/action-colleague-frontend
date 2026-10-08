import { test, expect, type Browser, type Page } from "@playwright/test";
import { DECISION } from "./fixtures/activities";
import { adminApi, type Call, type CourseRef, learnerApi, newLearner, PASSWORD, publishedCourse } from "./fixtures/api";

// A person's page for admins (their courses module by module, another attempt at a quiz, certificates), the points
// learners earn and the rankings: each path's and the panel's for admins, "Mis cursos" and the ranking page for them.
test.setTimeout(180_000);

/** The learner, signed in on a browser of their own. */
async function signIn(browser: Browser, email: string): Promise<Page> {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: /Ingresar/ }).click();
  await expect(page).toHaveURL(/\/learn$/, { timeout: 20_000 });
  return page;
}

/**
 * A published course on a published path the learner has: a conversation to play, then a quiz of one question with a
 * single attempt.
 */
async function courseOnPath(call: Call, stamp: number, learnerId: number) {
  const course = await call<CourseRef>("post", "/courses", { title: `Atención a flotas ${stamp}`, description: "Conversar y evaluar." });
  const talk = await call<{ id: number }>("post", `/courses/${course.id}/modules`, {
    title: "Conversación",
    content_text: "Cómo atender a un cliente que solo pide precio.",
  });
  await call("post", `/modules/${talk.id}/activities`, {
    type: "decision",
    title: "Cliente que pide precio",
    intro: "Atiende al cliente.",
    spec: DECISION,
    status: "ready",
  });
  const exam = await call<{ id: number }>("post", `/courses/${course.id}/modules`, {
    title: "Evaluación final",
    content_text: "Repasa antes de responder.",
  });
  await call("put", `/modules/${exam.id}/evaluation`, {
    questions: [
      { id: "q1", type: "true_false", prompt: "La presión se mide con la llanta fría", correct: true, explanation: "Siempre en frío." },
    ],
    max_attempts: 1,
    passing_score: 100,
  });
  await call("post", `/courses/${course.id}/publish`);
  const path = await call<{ id: number; title: string }>("post", "/paths", { title: `Ruta de atención ${stamp}` });
  await call("put", `/paths/${path.id}/courses`, { course_ids: [course.id] });
  await call("patch", `/paths/${path.id}`, { status: "published" });
  await call("post", `/paths/${path.id}/people`, { user_ids: [learnerId] });
  return { course, path };
}

/**
 * Checks a learner's page where the ranking shows. The parameters are global and a test running alongside may hide the
 * ranking for a moment (the "Parámetros" step below does): the page is reloaded until it shows again.
 */
async function whileShown(page: Page, check: () => Promise<void>) {
  let again = false;
  await expect(async () => {
    if (again) await page.reload();
    again = true;
    await check();
  }).toPass({ timeout: 45_000 });
}

const SOON = { timeout: 5_000 };

/** A figure of the person's band, by its label. */
const figure = (page: Page, label: string) =>
  page.locator("dl > div").filter({ has: page.getByText(label, { exact: true }) }).locator("dd").first();

test("la ficha de una persona: su avance módulo por módulo, otro intento en la evaluación y su lugar en el ranking", async ({
  page,
  request,
  browser,
}) => {
  const call = await adminApi(request);
  const stamp = Date.now();
  const learner = await newLearner(call, `Persona con ficha ${stamp}`, { position: "Asesora de flotas", department: "Ventas" });
  const { course, path } = await courseOnPath(call, stamp, learner.id);

  // "Mis cursos" says where the learner stands today in their path: no points yet.
  const learnerPage = await signIn(browser, learner.email);
  const today = learnerPage.getByRole("region", { name: "Ranking" });
  await whileShown(learnerPage, () => expect(today).toContainText(`Hoy en ${path.title}: aún sin puntos`, SOON));

  // They play the conversation with the best answers (10 of 10)...
  await learnerPage.goto(`/learn/${course.id}`);
  await learnerPage.getByRole("button", { name: "Jugar: Cliente que pide precio" }).click();
  const game = learnerPage.getByRole("dialog");
  await game.getByRole("button", { name: /Empezar/ }).click();
  await game.getByRole("button", { name: "¿Qué ruta y carga manejan?" }).click();
  await game.getByRole("button", { name: "Le muestro el costo por kilómetro." }).click();
  await game.getByRole("button", { name: /Ver resultado/ }).click();
  await expect(game.getByText("Completaste el módulo.")).toBeVisible();
  await game.getByRole("button", { name: "Continuar" }).click();
  // ...and fail the quiz, its only attempt.
  await expect(learnerPage.getByRole("heading", { level: 2, name: "Evaluación final" })).toBeVisible();
  await learnerPage.getByRole("button", { name: /Presentar evaluación/ }).click();
  const quiz = learnerPage.getByRole("dialog");
  await quiz.getByRole("radio", { name: "Falso" }).click();
  await quiz.getByRole("button", { name: /Enviar respuestas/ }).click();
  await expect(quiz.getByRole("heading", { name: "Aún no alcanzas el puntaje" })).toBeVisible();
  await quiz.getByRole("button", { name: "Revisar el módulo" }).click();
  await expect(learnerPage.getByText("Usaste todos los intentos. Habla con tu administrador si necesitas otro.")).toBeVisible();

  // The admin finds them in the team: the name leads to their page.
  await page.goto("/admin/team");
  await page.getByLabel("Buscar personas").fill(learner.name);
  await page.getByRole("row").filter({ hasText: learner.email }).getByRole("link", { name: learner.name }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/team/${learner.id}$`));
  await expect(page.getByRole("heading", { level: 1, name: learner.name })).toBeVisible();
  await expect(page.getByText("Asesora de flotas · Ventas")).toBeVisible();
  await expect(page.getByText(/^Última actividad /)).toBeVisible();
  // Their figures: one course, the play's 100 points and its module's 20, one activity played, the quiz at 0%.
  await expect(figure(page, "Cursos asignados")).toHaveText("1");
  await expect(figure(page, "Puntos")).toHaveText("120");
  await expect(figure(page, "Actividades jugadas")).toHaveText("1");
  await expect(figure(page, "Puntaje promedio")).toHaveText("0%");
  // Their path, assigned by hand, with its course under way.
  const journey = page.getByRole("article", { name: path.title });
  await expect(journey).toContainText("Manual");
  await expect(journey).toContainText("En curso · 1 de 2 módulos");

  // Their course, module by module: the activity's best and plays, the quiz out of attempts.
  const card = page.getByRole("list", { name: "Sus cursos" }).getByRole("listitem").filter({ hasText: course.title }).first();
  await expect(card).toContainText("1 de 2 módulos");
  await card.getByRole("button", { name: `Ver módulos de «${course.title}»` }).click();
  const modules = card.getByRole("list", { name: `Módulos de ${course.title}` });
  await expect(modules).toContainText("Cliente que pide precio · Decisión con cliente");
  await expect(modules).toContainText(/Mejor: 10 de 10 · 1 partida/);
  const exam = modules.getByRole("listitem").filter({ hasText: "Evaluación final" }).first();
  await expect(exam).toContainText("Sin intentos");
  await expect(exam).toContainText("1 de 1 intento usado");
  // What they answered, question by question.
  await exam.getByRole("button", { name: "Ver respuestas de «Evaluación final»" }).click();
  await expect(exam.getByRole("list", { name: "Sus intentos" })).toContainText("No aprobado · 0%");
  await expect(exam.getByRole("img", { name: "Incorrecta" })).toBeVisible();

  // Another attempt, after confirming: the button leaves and the quiz says it is open again.
  await exam.getByRole("button", { name: "Dar otro intento en «Evaluación final»" }).click();
  await page
    .getByRole("dialog", { name: `¿Darle otro intento a ${learner.name}?` })
    .getByRole("button", { name: "Dar otro intento" })
    .click();
  await expect(page.getByText(`${learner.name} puede presentar «Evaluación final» de nuevo: 1 intento.`)).toBeVisible();
  await expect(exam).toContainText("0 de 1 intento usado");
  await expect(exam.getByRole("button", { name: /Dar otro intento/ })).toHaveCount(0);
  // The focus stays on the quiz (its line), not at the top of the page.
  await expect.poll(() => page.evaluate(() => document.activeElement?.textContent ?? "")).toMatch(/^Evaluación/);

  // The learner can take it again: passing it completes the course and its path.
  await learnerPage.reload();
  await learnerPage.getByRole("button", { name: /Presentar evaluación/ }).click();
  await quiz.getByRole("radio", { name: "Verdadero" }).click();
  await quiz.getByRole("button", { name: /Enviar respuestas/ }).click();
  await expect(quiz.getByRole("heading", { name: "¡Aprobaste!" })).toBeVisible();
  await quiz.getByRole("button", { name: /Terminar el curso/ }).click();
  const done = learnerPage.getByRole("dialog", { name: "¡Completaste la ruta!" });
  await done.getByRole("link", { name: "Volver a mis cursos" }).click();
  // Today: first of their path with every point (120, the quiz's 100 and its module's 20, the course's 100, the
  // path's 200).
  await whileShown(learnerPage, () => expect(today).toContainText(`Hoy en ${path.title}: #1 de 1 · 540 pts`, SOON));

  // Their ranking page, in the path (from the card), then this week.
  await today.getByRole("link", { name: "Ver ranking" }).click();
  await expect(learnerPage).toHaveURL(new RegExp(`/learn/ranking\\?path=${path.id}$`));
  await expect(learnerPage.getByRole("heading", { level: 1, name: "Los mejores de hoy" })).toBeVisible();
  const mine = learnerPage
    .getByRole("list", { name: `Los mejores de hoy: ${path.title}` })
    .getByRole("listitem")
    .filter({ hasText: "Tú" });
  const nav = learnerPage.getByRole("navigation", { name: "Principal" });
  // What is read out as the list changes: since when, in which path and how many have points.
  const announced = learnerPage.locator("[aria-live=polite]").filter({ hasText: "con puntos" });
  await whileShown(learnerPage, async () => {
    await expect(mine).toContainText(learner.name, SOON);
    await expect(mine).toContainText("540 pts");
    await expect(learnerPage.getByText("Tu posición")).toBeVisible();
    // In the nav, "Ranking" is the page on screen ("Mis cursos" isn't).
    await expect(nav.getByRole("link", { name: "Ranking" })).toHaveAttribute("aria-current", "page", SOON);
    await expect(nav.getByRole("link", { name: "Mis cursos" })).not.toHaveAttribute("aria-current", "page");
    await expect(announced).toHaveText(`Desde la medianoche · ${path.title} · 1 persona con puntos`);
  });
  await whileShown(learnerPage, async () => {
    await learnerPage.getByRole("group", { name: "Periodo" }).getByRole("button", { name: "Semana" }).click(SOON);
    await expect(learnerPage.getByRole("list", { name: `Los mejores de la semana: ${path.title}` })).toContainText(
      "540 pts",
      SOON,
    );
    // Another period is heard, even with as many people.
    const week = new RegExp(`^Desde el lunes \\d{1,2} de [a-z]+ · ${path.title} · 1 persona con puntos$`);
    await expect(announced).toHaveText(week);
  });
  await expect(learnerPage).toHaveURL(new RegExp(`/learn/ranking\\?path=${path.id}&period=week$`));
  await expect(learnerPage.getByRole("heading", { level: 1, name: "Los mejores de la semana" })).toBeVisible();
  await expect(learnerPage.getByRole("button", { name: "Semana" })).toHaveAttribute("aria-pressed", "true");

  // The admin: the person page shows it all, the path's ranking tab and the panel's "Los mejores hoy" too.
  await page.reload();
  await expect(figure(page, "Puntos")).toHaveText("540");
  await expect(figure(page, "Cursos completados")).toHaveText("1");
  await expect(card).toContainText("Completado");
  await card.getByRole("button", { name: `Ver módulos de «${course.title}»` }).click();
  await expect(exam).toContainText("Aprobada con 100%");
  await expect(page.getByRole("list", { name: "Actividad reciente" })).toContainText("Aprobó la evaluación de «Evaluación final» (100%)");
  await expect(page.getByRole("list", { name: "Certificados" }).getByRole("listitem").filter({ hasText: course.title })).toContainText(
    "Válido",
  );

  await page.goto(`/admin/paths/${path.id}?tab=ranking`);
  const ranked = page.getByRole("list", { name: `Ranking de ${path.title}` }).getByRole("listitem").first();
  await expect(ranked).toContainText(learner.name);
  await expect(ranked).toContainText("540 pts");
  await expect(ranked).toContainText("1 curso completado");
  await expect(page.getByText("1 persona con puntos")).toBeVisible();
  await page.getByRole("group", { name: "Periodo" }).getByRole("button", { name: "Total" }).click();
  await expect(page.getByText(/^Desde siempre · 1 persona con puntos$/)).toBeVisible();
  await ranked.getByRole("link", { name: learner.name }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/team/${learner.id}$`));

  await page.goto("/admin");
  await page.getByLabel("Ranking de").selectOption({ label: path.title });
  await expect(page.getByRole("list", { name: `Los mejores hoy en ${path.title}` })).toContainText(learner.name);
  await expect(page.getByRole("link", { name: "Ver el ranking de la ruta" })).toHaveAttribute(
    "href",
    `/admin/paths/${path.id}?tab=ranking`,
  );

  // Parámetros: points out of range are refused as they are typed; hiding the ranking hides it for learners.
  const before = await call<{ ranking: { visible_to_learners: boolean } }>("get", "/settings");
  expect(before.ranking.visible_to_learners).toBe(true);
  try {
    await page.goto("/admin/settings");
    const points = page.getByLabel("Puntos por módulo");
    const saved = await points.inputValue();
    await points.fill("1001");
    await expect(page.getByText("Escribe un número entero de puntos entre 0 y 1000.")).toBeVisible();
    await points.fill(saved);
    const visible = page.getByRole("switch", { name: "Visible para los colaboradores" });
    await expect(visible).toBeChecked();
    await visible.click();
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByText("Parámetros guardados")).toBeVisible();

    // The learner: no "Ranking" in the nav, no card in "Mis cursos", and its page says it isn't available.
    await learnerPage.goto("/learn");
    await expect(nav.getByRole("link", { name: "Ranking" })).toHaveCount(0);
    await expect(learnerPage.getByRole("heading", { level: 2, name: "Mi ruta" })).toBeVisible();
    await expect(today).toHaveCount(0);
    await learnerPage.goto("/learn/ranking");
    await expect(learnerPage.getByRole("heading", { name: "El ranking no está disponible" })).toBeVisible();
    await expect(learnerPage.getByRole("listitem").filter({ hasText: "Tú" })).toHaveCount(0);
    // Admins still see it.
    await page.goto(`/admin/paths/${path.id}?tab=ranking`);
    await expect(page.getByRole("list", { name: `Ranking de ${path.title}` })).toContainText(learner.name);
  } finally {
    await call("patch", "/settings", { ranking: { visible_to_learners: true } });
  }
  await learnerPage.context().close();
});

test("la ficha desde el equipo y los participantes: vista rápida, editar, revocar un certificado y una persona que no existe", async ({
  page,
  request,
}) => {
  const call = await adminApi(request);
  const stamp = Date.now();
  const learner = await newLearner(call, `Persona de equipo ${stamp}`);
  const course = await publishedCourse(call, `Inducción con certificado ${stamp}`);
  await call("post", `/courses/${course.id}/participants`, { user_ids: [learner.id] });
  // They complete it through the API: its certificate is issued.
  const learnerCall = await learnerApi(request, learner.email);
  const detail = await learnerCall<{ modules: { id: number }[] }>("get", `/learn/courses/${course.id}`);
  const completed = await learnerCall<{ certificate: { code: string } | null }>(
    "post",
    `/learn/modules/${detail.modules[0].id}/complete`,
  );
  const code = completed.certificate?.code;

  // The quick view, from the row's menu, leads to the whole page.
  await page.goto("/admin/team");
  await page.getByLabel("Buscar personas").fill(learner.name);
  const row = page.getByRole("row").filter({ hasText: learner.email });
  await row.getByRole("button", { name: `Acciones para ${learner.name}` }).click();
  await page.getByRole("menuitem", { name: "Vista rápida" }).click();
  const sheet = page.getByRole("dialog", { name: learner.name });
  await expect(sheet.getByRole("link", { name: course.title })).toBeVisible();
  // Each course's bar says whose progress it is.
  await expect(sheet.getByRole("progressbar", { name: `Avance en ${course.title}` })).toHaveAttribute("aria-valuenow", "100");
  await sheet.getByRole("link", { name: "Ver ficha completa" }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/team/${learner.id}$`));
  await expect(page.getByRole("heading", { level: 1, name: learner.name })).toBeVisible();

  // Its data is edited from the page too.
  await page.getByRole("button", { name: "Editar datos" }).click();
  const edit = page.getByRole("dialog", { name: `Editar a ${learner.name}` });
  await edit.getByLabel("Cargo").fill("Supervisora de patio");
  await edit.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(edit).toBeHidden();
  await expect(page.getByText("Supervisora de patio", { exact: true })).toBeVisible();

  // A course's participant leads to the page with that course open.
  await page.goto(`/admin/courses/${course.id}?tab=participants`);
  await page.getByRole("button", { name: `Ver el detalle de ${learner.name}` }).click();
  await page.getByRole("dialog", { name: learner.name }).getByRole("link", { name: "Ver ficha completa" }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/team/${learner.id}\\?course=${course.id}$`));
  const card = page.getByRole("list", { name: "Sus cursos" }).getByRole("listitem").filter({ hasText: course.title }).first();
  await expect(card.getByRole("button", { name: `Ocultar módulos de «${course.title}»` })).toHaveAttribute("aria-expanded", "true");
  await expect(card.getByRole("list", { name: `Módulos de ${course.title}` })).toContainText(`Lectura: ${course.title}`);

  // Its certificate, revoked from here: the card says so and keeps the focus.
  expect(code).toBeTruthy();
  const certificate = page.getByRole("list", { name: "Certificados" }).getByRole("listitem").filter({ hasText: code! });
  await expect(certificate).toContainText("Válido");
  await expect(certificate.getByRole("link", { name: `Descargar «${course.title}»` })).toHaveAttribute(
    "href",
    new RegExp(`/public/certificates/${code}/pdf$`),
  );
  await certificate.getByRole("button", { name: `Revocar «${course.title}»` }).click();
  const revoke = page.getByRole("dialog", { name: `¿Revocar el certificado de ${learner.name}?` });
  await revoke.getByLabel("Motivo (opcional)").fill("Prueba de la ficha.");
  await revoke.getByRole("button", { name: "Revocar certificado" }).click();
  await expect(page.getByText(`Certificado ${code} revocado`)).toBeVisible();
  await expect(certificate).toContainText("Revocado");
  await expect(certificate).toContainText("Motivo: Prueba de la ficha.");
  await expect(certificate.getByRole("button", { name: /Revocar/ })).toHaveCount(0);
  await expect(certificate).toBeFocused();
  await expect(figure(page, "Certificados vigentes")).toHaveText("0");

  // Someone who doesn't exist: said plainly, with the way back.
  await page.goto("/admin/team/99999999");
  await expect(page.getByRole("heading", { name: "Esta persona no existe" })).toBeVisible();
  await page.getByRole("link", { name: "Volver al equipo" }).click();
  await expect(page).toHaveURL(/\/admin\/team$/);
});
