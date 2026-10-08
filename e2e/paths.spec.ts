import { test, expect, type APIRequestContext, type Browser, type Page } from "@playwright/test";

// Learning paths: the admin builds them (profiles, courses in order, people) and each learner follows theirs.
const API = process.env.E2E_API_URL ?? "http://localhost:8001/api/v1";
const admin = { email: process.env.E2E_ADMIN_EMAIL ?? "", password: process.env.E2E_ADMIN_PASSWORD ?? "" };
const PASSWORD = "Temporal-2026";

test.setTimeout(150_000);

type Call = (method: "post" | "put" | "patch" | "get", path: string, data?: unknown) => Promise<any>;

async function adminApi(request: APIRequestContext): Promise<Call> {
  const login = await request.post(`${API}/auth/login`, { data: admin });
  expect(login.ok()).toBeTruthy();
  const headers = { Authorization: `Bearer ${(await login.json()).access_token}` };
  return async (method, path, data) => {
    const response = await request[method](`${API}${path}`, { headers, data });
    expect(response.ok(), `${method} ${path}: ${await response.text()}`).toBeTruthy();
    return response.json();
  };
}

/** A published course with one reading, completed with "Marcar como completado". */
async function publishedCourse(call: Call, title: string) {
  const course = await call("post", "/courses", { title, description: "Un paso de la ruta." });
  await call("post", `/courses/${course.id}/modules`, { title: `Lectura: ${title}`, content_text: "Lo que hay que saber." });
  await call("post", `/courses/${course.id}/publish`);
  return course as { id: number; title: string };
}

/** A collaborator of their own (the shared learner never gets a path: other specs read its course list). */
async function newLearner(call: Call, name: string, extra: Record<string, unknown> = {}) {
  const email = `ruta.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@local.test`;
  const user = await call("post", "/users", { name, email, password: PASSWORD, role: "collaborator", ...extra });
  return user as { id: number; name: string; email: string };
}

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

test("un admin arma una ruta por perfil y el colaborador la sigue curso por curso", async ({ page, request, browser }) => {
  const call = await adminApi(request);
  const stamp = Date.now();
  const profile = `Asesor de flotas ${stamp}`;
  const pathTitle = `Ruta de flotas ${stamp}`;
  const first = await publishedCourse(call, `Costo por kilómetro ${stamp}`);
  const second = await publishedCourse(call, `Mantenimiento preventivo ${stamp}`);
  const learnerName = `Colaboradora de ruta ${stamp}`;
  const learner = await newLearner(call, learnerName);

  // A profile, from Equipo › Perfiles.
  await page.goto("/admin/team");
  await page.getByRole("navigation", { name: "Equipo" }).getByRole("link", { name: "Perfiles" }).click();
  await expect(page).toHaveURL(/\/admin\/team\/profiles$/);
  await page.getByRole("button", { name: "Nuevo perfil" }).first().click();
  const profileDialog = page.getByRole("dialog", { name: "Nuevo perfil" });
  await profileDialog.getByLabel("Nombre").fill(profile);
  await profileDialog.getByRole("button", { name: "Crear perfil" }).click();
  await expect(page.getByText(`Perfil «${profile}» creado`)).toBeVisible();
  await expect(page.getByRole("list", { name: "Perfiles" }).getByRole("listitem").filter({ hasText: profile })).toContainText(
    "0 personas",
  );

  // The path: a draft from "Nueva ruta", then its courses, in the order they are picked.
  await page.getByRole("navigation", { name: "Principal" }).getByRole("link", { name: "Rutas" }).click();
  await expect(page).toHaveURL(/\/admin\/paths$/);
  await page.getByRole("button", { name: "Nueva ruta" }).first().click();
  const pathDialog = page.getByRole("dialog", { name: "Nueva ruta" });
  await pathDialog.getByRole("button", { name: "Crear ruta" }).click();
  await expect(pathDialog.getByText("Escribe el título de la ruta")).toBeVisible(); // nothing typed yet
  await pathDialog.getByLabel("Título").fill(pathTitle);
  await pathDialog.getByRole("button", { name: "Crear ruta" }).click();
  await expect(page).toHaveURL(/\/admin\/paths\/\d+$/);
  const pathUrl = page.url();
  await expect(page.getByRole("heading", { level: 1, name: pathTitle })).toBeVisible();
  await expect(page.getByText("Esta ruta aún no tiene cursos")).toBeVisible();

  await page.getByRole("button", { name: "Agregar cursos" }).first().click();
  const picker = page.getByRole("dialog", { name: "Agregar cursos" });
  await picker.getByLabel("Buscar cursos").fill(String(stamp));
  await picker.getByRole("button", { name: new RegExp(first.title) }).click();
  await picker.getByRole("button", { name: new RegExp(second.title) }).click();
  await picker.getByRole("button", { name: "Agregar (2)" }).click();
  await expect(page.getByText("2 cursos agregados a la ruta")).toBeVisible();
  const steps = page.getByRole("list", { name: "Cursos de la ruta, en orden" }).getByRole("listitem");
  await expect(steps).toHaveCount(2);
  await expect(steps.nth(0)).toContainText(first.title);
  await expect(steps.nth(1)).toContainText(second.title);

  // Its profile, in Ajustes (in order by default); then it is published.
  await page.getByRole("tab", { name: "Ajustes" }).click();
  await expect(page).toHaveURL(/\?tab=settings$/);
  await expect(page.getByRole("switch", { name: "Desbloquear los cursos en orden" })).toBeChecked();
  await page.getByRole("checkbox", { name: profile }).check();
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByText("Cambios guardados")).toBeVisible();
  await page.getByRole("button", { name: "Publicar" }).click();
  await expect(page.getByText("Ruta publicada: 0 personas la tienen")).toBeVisible();

  // The learner gets the profile in the team's dialog: the path comes with it.
  await page.goto("/admin/team");
  await page.getByLabel("Buscar personas").fill(learnerName);
  const row = page.getByRole("row").filter({ hasText: learner.email });
  await expect(row).toHaveCount(1);
  await row.getByRole("button", { name: `Acciones para ${learnerName}` }).click();
  await page.getByRole("menuitem", { name: /Editar datos/ }).click();
  const edit = page.getByRole("dialog", { name: `Editar a ${learnerName}` });
  await edit.getByLabel("Perfil").selectOption({ label: profile });
  await edit.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(edit).toBeHidden();
  await expect(row).toContainText(profile);

  // The path's people: the learner, by profile; their first course open, the second locked.
  await page.goto(`${pathUrl}?tab=people`);
  const person = page.getByRole("row").filter({ hasText: learnerName });
  await expect(person).toContainText("Por perfil");
  await expect(person).toContainText("Sin empezar");
  await expect(person).toContainText(`Curso 1, «${first.title}»: disponible`);
  await expect(person).toContainText(`Curso 2, «${second.title}»: bloqueado`);

  // The learner: "Mi ruta" first, course 1 next and course 2 locked (no link to it anywhere).
  const learnerPage = await signIn(browser, learner.email);
  await expect(learnerPage.getByRole("heading", { level: 2, name: "Mi ruta" })).toBeVisible();
  const journey = learnerPage.getByRole("article", { name: pathTitle });
  await expect(journey).toContainText(`Se desbloquea al terminar «${first.title}»`);
  await expect(journey.getByText("Sigue aquí")).toBeVisible();
  await expect(journey.getByRole("link", { name: `Empezar: ${first.title}` })).toBeVisible();
  await expect(learnerPage.getByText(`Ruta ${pathTitle} · curso 1 de 2`).first()).toBeVisible(); // the hero goes on with it
  await expect(learnerPage.getByRole("link", { name: new RegExp(second.title) })).toHaveCount(0);
  await expect(learnerPage.getByText("Bloqueado", { exact: true })).toBeVisible(); // its card in "Por empezar"

  // By its address, course 2 is a lock screen that leads to course 1.
  await learnerPage.goto(`/learn/${second.id}`);
  await expect(learnerPage.getByRole("heading", { name: "Este curso aún está bloqueado" })).toBeVisible();
  await learnerPage.getByRole("link", { name: `Ir a «${first.title}»` }).click();
  await expect(learnerPage.getByRole("heading", { level: 1, name: first.title })).toBeVisible();
  await expect(learnerPage.getByText(`Ruta ${pathTitle} · curso 1 de 2`)).toBeVisible();

  // Completing course 1 opens course 2, and the celebration offers it.
  await learnerPage.getByRole("button", { name: /Marcar como completado/ }).click();
  const completed = learnerPage.getByRole("dialog", { name: "¡Completaste el curso!" });
  await completed.getByRole("link", { name: `Siguiente curso: ${second.title}` }).click();
  await expect(learnerPage.getByRole("heading", { level: 1, name: second.title })).toBeVisible();
  await expect(learnerPage.getByText(`Ruta ${pathTitle} · curso 2 de 2`)).toBeVisible();

  // Completing course 2 completes the path.
  await learnerPage.getByRole("button", { name: /Marcar como completado/ }).click();
  const pathDone = learnerPage.getByRole("dialog", { name: "¡Completaste la ruta!" });
  await expect(pathDone).toContainText(`la ruta «${pathTitle}»`);
  await pathDone.getByRole("link", { name: "Volver a mis cursos" }).click();
  await expect(journey).toContainText("¡Completaste la ruta!");
  await expect(journey).toContainText("Completada");
  await learnerPage.context().close();

  // The admin sees it completed.
  await page.reload();
  await expect(person).toContainText("Completada");
  await expect(page.getByText(/100% la completó/)).toBeVisible();
});

test("rutas: reordenar y quitar cursos, asignar y quitar personas, plazo, borrador, archivo y eliminación", async ({
  page,
  request,
}) => {
  const call = await adminApi(request);
  const stamp = Date.now();
  const courses = [];
  for (const name of ["Inducción", "Seguridad", "Ventas"]) courses.push(await publishedCourse(call, `${name} ${stamp}`));
  const [induction, safety, sales] = courses;
  const profile = await call("post", "/profiles", { name: `Perfil de gestión ${stamp}` });
  const byProfile = await newLearner(call, `Por perfil ${stamp}`, { profile_id: profile.id });
  const byHand = await newLearner(call, `A mano ${stamp}`);
  const path = await call("post", "/paths", { title: `Ruta de gestión ${stamp}` });
  await call("put", `/paths/${path.id}/courses`, { course_ids: courses.map((course) => course.id) });
  await call("patch", `/paths/${path.id}`, { profile_ids: [profile.id], status: "published" });

  await page.goto(`/admin/paths/${path.id}`);
  const steps = page.getByRole("list", { name: "Cursos de la ruta, en orden" }).getByRole("listitem");
  await expect(steps).toHaveCount(3);

  // The arrows reorder (and say where it landed); removing a course asks first.
  const up = page.getByRole("button", { name: `Subir ${sales.title}` });
  await up.click();
  await expect(steps.nth(1)).toContainText(sales.title);
  await expect(up).toBeFocused(); // it moved with its course
  await expect(page.getByText(`«${sales.title}» quedó en la posición 2 de 3.`)).toHaveAttribute("aria-live", "polite");
  await expect(up).not.toHaveAttribute("aria-disabled"); // saved: each change sends the whole list
  await page.getByRole("button", { name: `Quitar ${safety.title} de la ruta` }).click();
  await page
    .getByRole("dialog", { name: `¿Quitar «${safety.title}» de la ruta?` })
    .getByRole("button", { name: "Quitar de la ruta" })
    .click();
  await expect(page.getByText(`«${safety.title}» salió de la ruta`)).toBeVisible();
  await page.reload();
  await expect(steps).toHaveCount(2);
  await expect(steps.nth(0)).toContainText(induction.title);
  await expect(steps.nth(1)).toContainText(sales.title);

  // People: the one by profile can't be taken off by hand (it says why); the one assigned by hand can.
  await page.getByRole("tab", { name: "Personas" }).click();
  const profileRow = page.getByRole("row").filter({ hasText: byProfile.name });
  await expect(profileRow).toContainText("Por perfil");
  // Dimmed (aria-disabled) but still tappable: it says why.
  await profileRow.getByRole("button", { name: `Quitar la ruta a ${byProfile.name}` }).click({ force: true });
  await expect(
    page.getByText(`Esta persona tiene la ruta por su perfil «${profile.name}». Cambia su perfil para quitarla.`),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0); // nothing to confirm

  await page.getByRole("button", { name: "Asignar personas" }).first().click();
  const assign = page.getByRole("dialog", { name: "Asignar personas" });
  await expect(assign).toContainText("quedarán inscritas en sus 2 cursos");
  await assign.getByLabel("Buscar personas").fill(String(stamp));
  await expect(assign.getByRole("button", { name: new RegExp(byProfile.name) })).toHaveCount(0); // already has it
  await assign.getByRole("button", { name: new RegExp(byHand.name) }).click();
  await assign.getByRole("button", { name: "Asignar (1)" }).click();
  await expect(page.getByText("Persona asignada a la ruta")).toBeVisible();
  const handRow = page.getByRole("row").filter({ hasText: byHand.name });
  await expect(handRow).toContainText("Manual");
  await handRow.getByRole("button", { name: `Quitar la ruta a ${byHand.name}` }).click();
  await page
    .getByRole("dialog", { name: `¿Quitarle la ruta a ${byHand.name}?` })
    .getByRole("button", { name: "Quitar ruta" })
    .click();
  await expect(page.getByText(`Le quitaste la ruta a ${byHand.name}`)).toBeVisible();
  await expect(handRow).toHaveCount(0);

  // A deadline in days: a wrong one says what is expected; a right one shows for whoever has the path.
  await expect(profileRow).toContainText("Sin plazo");
  await page.getByRole("tab", { name: "Ajustes" }).click();
  const deadline = page.getByLabel("Plazo (días)");
  await deadline.fill("0");
  await expect(page.getByText("Escribe un número de días entre 1 y 365, o déjalo vacío para no poner plazo.")).toBeVisible();
  await deadline.fill("30");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByText("Cambios guardados")).toBeVisible();
  await page.getByRole("tab", { name: "Personas" }).click();
  await expect(profileRow).toContainText("Vence el");

  // Back to draft (asks first: learners stop seeing it), then archived, found among the archived, and deleted.
  await page.getByRole("button", { name: "Pasar a borrador" }).click();
  await page
    .getByRole("dialog", { name: "¿Pasar la ruta a borrador?" })
    .getByRole("button", { name: "Pasar a borrador" })
    .click();
  await expect(page.getByText("La ruta volvió a borrador: las personas ya no la ven")).toBeVisible();
  await expect(page.getByRole("note")).toContainText("La ruta es un borrador");
  await page.getByRole("button", { name: "Más acciones" }).click();
  await page.getByRole("menuitem", { name: "Archivar ruta" }).click();
  await expect(page.getByText("Ruta archivada: las personas ya no la ven")).toBeVisible();

  await page.getByRole("link", { name: "Rutas", exact: true }).first().click();
  await expect(page).toHaveURL(/\/admin\/paths$/);
  const card = page.getByRole("link", { name: new RegExp(path.title) });
  await expect(card).toHaveCount(0);
  await page.getByRole("button", { name: "Archivadas" }).click();
  await card.click();
  await page.getByRole("button", { name: "Más acciones" }).click();
  await page.getByRole("menuitem", { name: "Eliminar ruta" }).click();
  const remove = page.getByRole("dialog", { name: "¿Eliminar esta ruta?" });
  await expect(remove).toContainText("Se le quita a la persona que la tiene, que conserva sus cursos y su avance.");
  await remove.getByRole("button", { name: "Eliminar ruta" }).click();
  await expect(page).toHaveURL(/\/admin\/paths$/);
  await expect(page.getByText("Ruta eliminada")).toBeVisible();
});

test("perfiles: renombrar, ver sus personas en el equipo y eliminarlo sin quitarles sus cursos", async ({ page, request }) => {
  const call = await adminApi(request);
  const stamp = Date.now();
  const profile = await call("post", "/profiles", { name: `Perfil de equipo ${stamp}` });
  const taken = await call("post", "/profiles", { name: `Perfil ocupado ${stamp}` });
  const member = await newLearner(call, `Con perfil ${stamp}`, { profile_id: profile.id });
  const other = await newLearner(call, `Sin perfil ${stamp}`);
  const course = await publishedCourse(call, `Curso del perfil ${stamp}`);
  await call("post", `/courses/${course.id}/participants`, { user_ids: [member.id] });
  const renamed = `Perfil renombrado ${stamp}`;

  await page.goto("/admin/team/profiles");
  const item = (name: string) => page.getByRole("list", { name: "Perfiles" }).getByRole("listitem").filter({ hasText: name });
  await expect(item(profile.name)).toContainText("1 persona");

  // A name another profile has (in other capitals) is said under the field; a new one is saved.
  await item(profile.name).getByRole("button", { name: `Editar el perfil ${profile.name}` }).click();
  const dialog = page.getByRole("dialog", { name: `Editar el perfil ${profile.name}` });
  const name = dialog.getByLabel("Nombre");
  await name.fill(taken.name.toUpperCase());
  await dialog.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(dialog.getByText("Ya existe un perfil con ese nombre.")).toBeVisible();
  await expect(name).toBeFocused();
  await name.fill(renamed);
  await dialog.getByLabel("Descripción (opcional)").fill("Venden a flotas de carretera.");
  await dialog.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByText("Perfil guardado")).toBeVisible();
  await expect(item(renamed)).toContainText("Venden a flotas de carretera.");

  // Its people: the team, filtered by it (and the filter in the address).
  await item(renamed).getByRole("link", { name: "1 persona" }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/team\\?profile=${profile.id}$`));
  await expect(page.getByLabel("Filtrar por perfil")).toHaveValue(String(profile.id));
  await page.getByLabel("Buscar personas").fill(String(stamp));
  await expect(page.getByRole("row").filter({ hasText: member.email })).toContainText(renamed);
  await expect(page.getByRole("row").filter({ hasText: other.email })).toHaveCount(0);
  await page.getByLabel("Filtrar por perfil").selectOption("");
  await expect(page).toHaveURL(/\/admin\/team$/);
  await expect(page.getByRole("row").filter({ hasText: other.email })).toHaveCount(1);

  // Deleting it asks first: its people stay without a profile and keep their courses.
  await page.goto("/admin/team/profiles");
  await item(renamed).getByRole("button", { name: `Eliminar el perfil ${renamed}` }).click();
  const confirm = page.getByRole("dialog", { name: `¿Eliminar el perfil «${renamed}»?` });
  await expect(confirm).toContainText("1 persona queda sin perfil: conserva sus cursos y su avance");
  await confirm.getByRole("button", { name: "Eliminar perfil" }).click();
  await expect(page.getByText(`Perfil «${renamed}» eliminado`)).toBeVisible();
  await expect(item(renamed)).toHaveCount(0);

  await page.goto("/admin/team");
  await page.getByLabel("Buscar personas").fill(member.email);
  const row = page.getByRole("row").filter({ hasText: member.email });
  await expect(row).toContainText("0 de 1 curso");
  await expect(row).not.toContainText(renamed);
  await row.getByRole("button", { name: member.name, exact: true }).click();
  await expect(page.getByRole("dialog", { name: member.name })).toContainText("Sin perfil");
});
