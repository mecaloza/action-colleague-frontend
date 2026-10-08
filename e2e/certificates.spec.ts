import { test, expect, type APIRequestContext, type Browser, type Page } from "@playwright/test";
import { adminApi, API, type Call, type CourseRef, newLearner, PASSWORD, publishedCourse } from "./fixtures/api";

// Certificates: the admin sets them up in Parámetros, learners earn them by completing a course or a path, anyone
// verifies them with their code, and the admin issues, revokes and reissues them in the registry.
test.setTimeout(180_000);

const CODE = /RC-[0-9A-Z]{4}-[0-9A-Z]{4}/;

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

/** Someone without a session: a public page. */
async function visitor(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  return context.newPage();
}

/** The PDF behind a link, asked again while the server is busy drawing others (429, "try again in 2 s"). */
async function fetchPdf(request: APIRequestContext, url: string) {
  for (let attempt = 0; ; attempt += 1) {
    const response = await request.get(url);
    if (response.status() !== 429 || attempt >= 5) return response;
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
}

/** Opens the course and completes its only module ("Marcar como completado"): the celebration opens. */
async function completeCourse(page: Page, course: CourseRef, dialogName: string) {
  await page.goto(`/learn/${course.id}`);
  await expect(page.getByRole("heading", { level: 1, name: course.title })).toBeVisible();
  await page.getByRole("button", { name: /Marcar como completado/ }).click();
  const dialog = page.getByRole("dialog", { name: dialogName });
  await expect(dialog).toBeVisible();
  return dialog;
}

/** A published course with a learner of its own enrolled in it. */
async function courseForLearner(call: Call, title: string, learnerName: string) {
  const course = await publishedCourse(call, title);
  const learner = await newLearner(call, learnerName);
  await call("post", `/courses/${course.id}/participants`, { user_ids: [learner.id] });
  return { course, learner };
}

test("el colaborador recibe su certificado, lo descarga y cualquiera lo verifica; revocado, la verificación lo dice", async ({
  page,
  request,
  browser,
}) => {
  const call = await adminApi(request);
  const stamp = Date.now();
  const signer = { name: `Laura Méndez ${stamp}`, title: "Directora de Formación" };
  const { course, learner } = await courseForLearner(call, `Seguridad en planta ${stamp}`, `Persona certificada ${stamp}`);

  // Parámetros, from the admin's menu: who signs (the miniature shows it as it is typed).
  await page.goto("/admin");
  await page.getByRole("button", { name: /^Menú de / }).click();
  await page.getByRole("menuitem", { name: "Parámetros" }).click();
  await expect(page).toHaveURL(/\/admin\/settings$/);
  await expect(page.getByRole("heading", { level: 1, name: "Parámetros" })).toBeVisible();
  await page.getByLabel("Nombre de quien firma").fill(signer.name);
  await page.getByLabel("Cargo de quien firma").fill(signer.title);
  const preview = page.getByRole("figure");
  await expect(preview).toContainText(signer.name);
  await expect(preview).toContainText(signer.title);
  await expect(page.getByText("Cambios sin guardar.")).toBeVisible();
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByText("Parámetros guardados")).toBeVisible();
  await expect(page.getByText("Todo guardado.")).toBeVisible();

  // The learner has none yet. From here to their profile again the page is never reloaded: it must show the new one.
  const learnerPage = await signIn(browser, learner.email);
  const nav = learnerPage.getByRole("navigation", { name: "Principal" });
  await nav.getByRole("link", { name: "Mi perfil" }).click();
  await expect(learnerPage.getByText("Aún no tienes certificados.")).toBeVisible();
  await nav.getByRole("link", { name: "Mis cursos" }).click();
  await learnerPage.getByRole("link", { name: course.title, exact: true }).click();
  await expect(learnerPage.getByRole("heading", { level: 1, name: course.title })).toBeVisible();

  // Completing the course: the celebration brings the certificate.
  await learnerPage.getByRole("button", { name: /Marcar como completado/ }).click();
  const dialog = learnerPage.getByRole("dialog", { name: "¡Completaste el curso!" });
  await expect(dialog).toContainText("Tu certificado ya está listo.");
  const download = dialog.getByRole("link", { name: "Descargar certificado", exact: true });
  await expect(download).toHaveAttribute("target", "_blank");
  await expect(download).toHaveAttribute("rel", /noopener/);
  const pdfUrl = (await download.getAttribute("href"))!;
  expect(pdfUrl).toMatch(/^https?:\/\/[^/]+\/api\/v1\/public\/certificates\/RC-[0-9A-Z]{4}-[0-9A-Z]{4}\/pdf$/);
  const code = pdfUrl.match(CODE)![0];
  await expect(dialog).toContainText(code);
  await expect(dialog.getByRole("link", { name: "Ver verificación" })).toHaveAttribute("href", new RegExp(`/verify/${code}$`));
  // The link is the PDF itself, without a session.
  const pdf = await fetchPdf(request, pdfUrl);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toContain("application/pdf");
  expect((await pdf.body()).subarray(0, 4).toString()).toBe("%PDF");

  // Back in the course it stays at hand; in the profile, with its code and status (the same words for its links).
  await dialog.getByRole("button", { name: "Repasar el curso" }).click();
  await expect(dialog).toBeHidden(); // its own link, with the same words, gone
  await expect(learnerPage.getByRole("link", { name: "Descargar certificado", exact: true })).toHaveAttribute("href", pdfUrl);
  await nav.getByRole("link", { name: "Mi perfil" }).click();
  const mine = learnerPage.getByRole("list", { name: "Mis certificados" }).getByRole("listitem").filter({ hasText: code });
  await expect(mine).toContainText(course.title);
  await expect(mine).toContainText("Válido");
  await expect(mine.getByRole("link", { name: `Descargar certificado «${course.title}»` })).toHaveAttribute("href", pdfUrl);
  await expect(mine.getByRole("link", { name: `Ver verificación «${course.title}»` })).toHaveAttribute(
    "href",
    new RegExp(`/verify/${code}$`),
  );
  // Its card in "Mis cursos" links it too (beside the course's own link, not inside it).
  await learnerPage.goto("/learn");
  await expect(learnerPage.getByRole("link", { name: `Certificado de «${course.title}»` })).toHaveAttribute("href", pdfUrl);
  await learnerPage.getByRole("link", { name: course.title, exact: true }).click();
  await expect(learnerPage.getByRole("heading", { level: 1, name: course.title })).toBeVisible();

  // Anyone, without signing in, verifies it (written in any case, without dashes too).
  const publicPage = await visitor(browser);
  await publicPage.goto(`/verify/${code}`);
  await expect(publicPage.getByRole("heading", { level: 1, name: "Certificado válido" })).toBeVisible();
  await expect(publicPage.getByText("Válido", { exact: true })).toBeVisible();
  const card = publicPage.getByRole("article", { name: "Datos del certificado" });
  await expect(card).toContainText(learner.name);
  await expect(card).toContainText(course.title);
  await expect(card).toContainText("completó el curso");
  // Whoever signs when it was issued (the parameters are global: a spec running alongside may have saved its own).
  await expect(card).toContainText(/Laura Méndez \d+, Directora de Formación/);
  await expect(card.getByRole("link", { name: "Descargar certificado" })).toHaveAttribute("href", pdfUrl);
  await publicPage.goto(`/verify/${code.toLowerCase().replace(/-/g, "")}`);
  await expect(publicPage.getByRole("heading", { level: 1, name: "Certificado válido" })).toBeVisible();
  // A status this page doesn't know (a newer server's, say) is never taken for valid, nor offers the PDF.
  const verification = `${API}/public/certificates/${code}`;
  await publicPage.route(verification, async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, json: { ...(await response.json()), status: "suspended" } });
  });
  await publicPage.goto(`/verify/${code}`);
  await expect(publicPage.getByRole("heading", { level: 1, name: "Estado desconocido" })).toBeVisible();
  await expect(publicPage.getByText("Desconocido", { exact: true })).toBeVisible();
  await expect(
    publicPage.getByText("No pudimos confirmar si está vigente. Consulta con quien lo emitió.", { exact: true }),
  ).toBeVisible();
  await expect(publicPage.getByText("Certificado válido")).toHaveCount(0);
  await expect(publicPage.getByRole("link", { name: "Descargar certificado" })).toHaveCount(0);
  await publicPage.unroute(verification);
  // A code that doesn't exist says so, and another one can be typed.
  await publicPage.goto("/verify/RC-0000-0000");
  await expect(publicPage.getByRole("heading", { level: 1, name: "Certificado no encontrado" })).toBeVisible();
  await publicPage.getByLabel("Prueba con otro código").fill(code);
  await publicPage.getByRole("button", { name: "Verificar" }).click();
  await expect(publicPage).toHaveURL(new RegExp(`/verify/${code}$`));
  await expect(publicPage.getByRole("heading", { level: 1, name: "Certificado válido" })).toBeVisible();

  // The admin finds it in the registry (by code) and revokes it, saying why.
  await page.getByRole("navigation", { name: "Principal" }).getByRole("link", { name: "Certificados" }).click();
  await expect(page).toHaveURL(/\/admin\/certificates$/);
  const search = page.getByLabel("Buscar certificados");
  await search.fill(code.toLowerCase());
  const row = page.getByRole("row").filter({ hasText: code });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText(learner.name);
  await expect(row).toContainText("Válido");
  // What each search finds is read out, nothing included: by one region that stays (one put in with its text, or
  // taken out with the list, is never read).
  const found = page.getByRole("status");
  await expect(found).toHaveText("1 certificado");
  const region = (await found.elementHandle())!;
  const said = () => region.evaluate((node) => (node.isConnected ? node.textContent : null));
  await search.fill(`Sin coincidencias ${stamp}`);
  await expect(page.getByRole("heading", { name: "Ningún certificado coincide" })).toBeVisible();
  expect(await said()).toBe("Ningún certificado coincide");
  await search.fill(code.toLowerCase());
  await expect(row).toHaveCount(1);
  expect(await said()).toBe("1 certificado");
  await row.getByRole("button", { name: `Acciones del certificado ${code} de ${learner.name}` }).click();
  await page.getByRole("menuitem", { name: "Revocar" }).click();
  const revoke = page.getByRole("dialog", { name: `¿Revocar el certificado de ${learner.name}?` });
  await revoke.getByLabel("Motivo (opcional)").fill("Se emitió por error.");
  await revoke.getByRole("button", { name: "Revocar certificado" }).click();
  await expect(page.getByText(`Certificado ${code} revocado`)).toBeVisible();
  await expect(row).toContainText("Revocado");
  await expect(row).toContainText("Motivo: Se emitió por error.");

  // The verification says so, without the PDF (which the server no longer gives).
  await publicPage.goto(`/verify/${code}`);
  await expect(publicPage.getByRole("heading", { level: 1, name: "Certificado revocado" })).toBeVisible();
  await expect(publicPage.getByText("Revocado", { exact: true })).toBeVisible();
  await expect(publicPage.getByRole("link", { name: "Descargar certificado" })).toHaveCount(0);
  expect((await request.get(pdfUrl)).status()).toBe(410);
  await publicPage.context().close();

  // The learner's profile says it too.
  await learnerPage.goto("/profile");
  await expect(mine).toContainText("Revocado");
  await expect(mine.getByRole("link", { name: `Descargar certificado «${course.title}»` })).toHaveCount(0);
  await learnerPage.context().close();
});

test("un curso sin certificado, emitir a mano, reemitir y el certificado de una ruta completada", async ({
  page,
  request,
  browser,
}) => {
  const call = await adminApi(request);
  const stamp = Date.now();
  const { course: optedOut, learner } = await courseForLearner(call, `Inducción sin certificado ${stamp}`, `Persona de ruta ${stamp}`);
  const idle = await newLearner(call, `Persona sin cursos ${stamp}`);
  // A path of one course that gives a certificate (the default), and another one the learner won't complete.
  const pathCourse = await publishedCourse(call, `Llantas para flotas ${stamp}`);
  const pending = await publishedCourse(call, `Ventas consultivas ${stamp}`);
  const path = await call<{ id: number; title: string }>("post", "/paths", { title: `Ruta de llantas ${stamp}` });
  const unfinished = await call<{ id: number; title: string }>("post", "/paths", { title: `Ruta de ventas ${stamp}` });
  for (const [target, course] of [
    [path, pathCourse],
    [unfinished, pending],
  ] as const) {
    await call("put", `/paths/${target.id}/courses`, { course_ids: [course.id] });
    await call("patch", `/paths/${target.id}`, { status: "published" });
    await call("post", `/paths/${target.id}/people`, { user_ids: [learner.id] });
  }

  // The first course gives no certificate: chosen in its Ajustes.
  await page.goto(`/admin/courses/${optedOut.id}?tab=settings`);
  const choice = page.getByLabel("Certificado al completar");
  await expect(choice).toHaveValue("platform");
  await choice.selectOption({ label: "No" });
  await expect(page.getByText("Quien lo complete no recibe certificado (se le puede emitir a mano).")).toBeVisible();
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByText("Cambios guardados")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Certificado al completar")).toHaveValue("no");

  // The learner completes it: no certificate. Then the path's course: the path's certificate and the course's.
  const learnerPage = await signIn(browser, learner.email);
  const plain = await completeCourse(learnerPage, optedOut, "¡Completaste el curso!");
  await expect(plain.getByRole("link", { name: /certificado/i })).toHaveCount(0);
  await expect(plain).not.toContainText("certificado ya está listo");
  await plain.getByRole("button", { name: "Repasar el curso" }).click();
  const pathDone = await completeCourse(learnerPage, pathCourse, "¡Completaste la ruta!");
  await expect(pathDone).toContainText("Tus certificados ya están listos.");
  const pathPdf = pathDone.getByRole("link", { name: "Descargar certificado de la ruta" });
  await expect(pathPdf).toHaveAttribute("href", /\/public\/certificates\/RC-[0-9A-Z]{4}-[0-9A-Z]{4}\/pdf$/);
  await expect(pathDone.getByRole("link", { name: "Descargar certificado del curso" })).toBeVisible();
  await expect(pathDone.getByRole("link", { name: "Ver verificación de la ruta" })).toBeVisible();
  const pathCode = (await pathPdf.getAttribute("href"))!.match(CODE)![0];
  // In "Mi ruta", the completed path keeps it.
  await pathDone.getByRole("link", { name: "Volver a mis cursos" }).click();
  const journey = learnerPage.getByRole("article", { name: path.title });
  await expect(journey).toContainText("¡Completaste la ruta!");
  await expect(journey.getByRole("link", { name: `Descargar certificado de la ruta «${path.title}»` })).toHaveAttribute(
    "href",
    new RegExp(`${pathCode}/pdf$`),
  );
  // Verified, it is a path's: its courses are listed.
  const publicPage = await visitor(browser);
  await publicPage.goto(`/verify/${pathCode}`);
  await expect(publicPage.getByRole("heading", { level: 1, name: "Certificado válido" })).toBeVisible();
  await expect(publicPage.getByRole("article", { name: "Datos del certificado" })).toContainText("completó la ruta de aprendizaje");
  await expect(publicPage.getByRole("article", { name: "Datos del certificado" })).toContainText(pathCourse.title);
  await publicPage.context().close();
  await learnerPage.context().close();

  // By hand, from the registry: the course that gives none (the rules don't apply)...
  await page.goto("/admin/certificates");
  const issue = async (person: { name: string } = learner) => {
    await page.getByRole("button", { name: "Emitir certificado" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Emitir certificado" });
    await dialog.getByLabel("Buscar persona").fill(person.name);
    await dialog.getByRole("radio", { name: new RegExp(person.name) }).check();
    return dialog;
  };
  // (Someone who completed none has no course to choose: it says so, and goes back to the person.)
  let dialog = await issue(idle);
  await expect(dialog.getByText(`${idle.name} aún no completa ningún curso.`, { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Emitir certificado" }).click();
  await expect(dialog.getByText(`${idle.name} aún no completa ningún curso: elige una ruta u otra persona.`)).toBeVisible();
  await expect(dialog.getByLabel("Buscar persona")).toBeFocused();
  await expect(dialog.getByText("Elige el curso.")).toHaveCount(0);
  await dialog.getByRole("button", { name: "Cancelar" }).click();
  await expect(dialog).toBeHidden();
  dialog = await issue();
  await dialog.getByLabel("Curso", { exact: true }).selectOption({ label: optedOut.title });
  await dialog.getByRole("button", { name: "Emitir certificado" }).click();
  const issued = page.getByText(/^Certificado emitido: RC-/);
  await expect(issued).toBeVisible();
  const code = (await issued.textContent())!.match(CODE)![0];
  await expect(page.getByRole("row").filter({ hasText: code })).toContainText(optedOut.title);

  // ...a second time, the valid one comes back (no second certificate)...
  dialog = await issue();
  await dialog.getByLabel("Curso", { exact: true }).selectOption({ label: `${optedOut.title} (ya tiene certificado)` });
  await dialog.getByRole("button", { name: "Emitir certificado" }).click();
  await expect(page.getByText(`${learner.name} ya tenía un certificado válido: ${code}`)).toBeVisible();

  // ...and a path not completed is refused, with the server's reason.
  dialog = await issue();
  await dialog.getByRole("radio", { name: "Una ruta" }).check();
  await dialog.getByLabel("Ruta", { exact: true }).selectOption({ label: unfinished.title });
  await dialog.getByRole("button", { name: "Emitir certificado" }).click();
  await expect(dialog.getByRole("alert")).toHaveText("La persona aún no completa la ruta.");
  await dialog.getByRole("button", { name: "Cancelar" }).click();
  await expect(dialog).toBeHidden();

  // Reissued: a new code with today's details; the old one revoked, saying which replaced it.
  await page.getByLabel("Buscar certificados").fill(learner.name);
  // By its menu, named after its code (the old one's reason names the new code too).
  const rowOf = (target: string) =>
    page.getByRole("row").filter({
      has: page.getByRole("button", { name: `Acciones del certificado ${target} de ${learner.name}` }),
    });
  // Held on its way: it says it is at it, and the row can't be reissued (nor revoked) again meanwhile.
  let release = () => {};
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route(`${API}/certificates/*/reissue`, async (route) => {
    await held;
    await route.continue();
  });
  const actionsOf = (target: string) =>
    rowOf(target).getByRole("button", { name: `Acciones del certificado ${target} de ${learner.name}` });
  await actionsOf(code).click();
  await page.getByRole("menuitem", { name: "Reemitir" }).click();
  await page
    .getByRole("dialog", { name: `¿Reemitir el certificado de ${learner.name}?` })
    .getByRole("button", { name: "Reemitir" })
    .click();
  await expect(page.getByText("Reemitiendo el certificado…")).toBeVisible();
  await actionsOf(code).click();
  await expect(page.getByRole("menuitem", { name: "Reemitir" })).toBeDisabled();
  await expect(page.getByRole("menuitem", { name: "Revocar" })).toBeDisabled();
  await page.keyboard.press("Escape");
  release();
  const reissued = page.getByText(new RegExp(`^Certificado reemitido: RC-.*El ${code} quedó revocado\\.$`));
  await expect(reissued).toBeVisible();
  const fresh = (await reissued.textContent())!.match(CODE)![0];
  expect(fresh).not.toBe(code);
  await page.getByRole("button", { name: "Revocados" }).click();
  await expect(rowOf(fresh)).toHaveCount(0); // the filter is on
  await expect(rowOf(code)).toContainText(`Motivo: Reemitido como ${fresh}`);
  await page.getByRole("button", { name: "Válidos" }).click();
  await expect(rowOf(code)).toHaveCount(0);
  await expect(rowOf(fresh)).toContainText(optedOut.title);
});

test("Parámetros: avisa lo que no es válido, pregunta antes de salir sin guardar y da los valores de las evaluaciones nuevas", async ({
  page,
  request,
}) => {
  const call = await adminApi(request);
  const stamp = Date.now();
  type Settings = { general: { timezone: string }; evaluations: { passing_score: number; max_attempts: number } };
  const before = await call<Settings>("get", "/settings");
  const course = await publishedCourse(call, `Evaluación con los parámetros ${stamp}`);
  try {
    await page.goto("/admin/settings");
    // The same words as each evaluation's editor.
    await expect(page.getByLabel("Puntaje para aprobar (%)")).toBeVisible();
    const attempts = page.getByLabel("Intentos permitidos");
    // Another default for the attempts (one more attempt changes nothing for the specs creating evaluations meanwhile).
    const savedAttempts = await attempts.inputValue();
    const otherAttempts = savedAttempts === "4" ? "5" : "4";
    const attemptsError = page.getByText("Escribe un número entero entre 1 y 10.");
    await attempts.fill("0");
    await expect(attemptsError).toBeVisible();
    await attempts.fill("11");
    await expect(attemptsError).toBeVisible();
    await attempts.fill(otherAttempts);
    await expect(attemptsError).toBeHidden();
    const validity = page.getByLabel("Vigencia (meses)");
    const validityBefore = await validity.inputValue();
    await validity.fill("3e"); // a number field would read it as empty: "no expiry", without a word
    await expect(page.getByText("Escribe un número de meses entre 1 y 120, o déjalo vacío para que no venzan.")).toBeVisible();
    await validity.fill(validityBefore);

    // A zone not in the list is written by hand: a wrong one says so; one in other capitals is taken as the server's.
    await page.getByLabel("Zona horaria").selectOption({ label: "Otra zona (escribirla)" });
    const zone = page.getByLabel("Nombre de la zona");
    await expect(zone).toBeFocused();
    await zone.fill("");
    // Saving with it empty, or wrong, goes to it instead.
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(zone).toBeFocused();
    await expect(page.getByText("Escribe el nombre de la zona horaria, por ejemplo «America/Bogota».")).toBeVisible();
    await zone.fill("Marte/Base_Alfa");
    const zoneError = page.getByText("Esa zona horaria no existe. Elige una de la lista o escríbela como «America/Bogota».");
    await expect(zoneError).toBeVisible();
    await zone.fill("america/bogota");
    await expect(zoneError).toBeHidden();

    // Leaving with unsaved changes asks first; staying keeps them.
    await page.getByRole("navigation", { name: "Principal" }).getByRole("link", { name: "Cursos" }).click();
    const leave = page.getByRole("dialog", { name: "¿Salir sin guardar los parámetros?" });
    await leave.getByRole("button", { name: "Cancelar" }).click();
    await expect(leave).toBeHidden();
    await expect(page).toHaveURL(/\/admin\/settings$/);
    await expect(attempts).toHaveValue(otherAttempts);

    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByText("Parámetros guardados")).toBeVisible();
    await expect(page.getByLabel("Zona horaria")).toHaveValue("America/Bogota"); // now from the list
    await expect(zone).toBeHidden();
    await expect(attempts).toHaveValue(otherAttempts);
    // Another name of a zone, in other capitals: saved as the server takes it (the browser may give the zone's
    // older name), never refused by it.
    await page.getByLabel("Zona horaria").selectOption({ label: "Otra zona (escribirla)" });
    await zone.fill("asia/kolkata");
    await expect(zoneError).toBeHidden();
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(zone).toHaveValue(/^Asia\/(Kolkata|Calcutta)$/);
    await expect(page.getByText("Todo guardado.")).toBeVisible();
    // Saved: leaving asks nothing.
    await page.getByRole("navigation", { name: "Principal" }).getByRole("link", { name: "Cursos" }).click();
    await expect(page).toHaveURL(/\/admin\/courses$/);
    await expect(page.getByRole("dialog")).toHaveCount(0);

    // A module's new evaluation starts with the platform's values, as the server gives them (some of its own here:
    // the parameters are global, and a spec running alongside may save others meanwhile). If they can't be read, it
    // says so instead of starting with made-up ones.
    let unreadable = true;
    await page.route(`${API}/settings`, async (route) => {
      if (route.request().method() !== "GET") return route.continue();
      if (unreadable) return route.fulfill({ status: 503, json: { detail: "Servicio no disponible" } });
      const response = await route.fetch();
      const settings = await response.json();
      await route.fulfill({ response, json: { ...settings, evaluations: { passing_score: 85, max_attempts: 7 } } });
    });
    await page.goto(`/admin/courses/${course.id}?tab=evaluations`);
    await expect(page.getByText("No pudimos cargar esta información.")).toBeVisible({ timeout: 15_000 }); // after a retry
    await expect(page.getByLabel("Intentos permitidos")).toHaveCount(0);
    unreadable = false;
    await page.getByRole("button", { name: "Reintentar" }).click();
    await expect(page.getByLabel("Intentos permitidos")).toHaveValue("7");
    await expect(page.getByLabel("Puntaje para aprobar (%)")).toHaveValue("85");
  } finally {
    await call("patch", "/settings", {
      general: { timezone: before.general.timezone },
      evaluations: { max_attempts: before.evaluations.max_attempts },
    });
  }
});
