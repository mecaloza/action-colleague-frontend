# Pruebas — Action Colleague (frontend)

## Estáticas

```bash
npm run lint
npx tsc --noEmit
npm run build
```

## End-to-end (Playwright)

Se corren contra un backend local con datos de prueba (nunca contra producción).

```bash
# 1. Backend (repo action-colleague-backend): SQLite local, usuarios de prueba y proveedores
#    falsos (IA, voz y presentador deterministas: el estudio IA se prueba sin llaves ni red)
SEED_PASSWORD='elige-una-clave' .venv/bin/python -m scripts.seed_dev
USE_FAKE_PROVIDERS=true STORAGE_BACKEND=local .venv/bin/uvicorn app.main:app --port 8001

# 2. Frontend apuntando a ese backend
NEXT_PUBLIC_API_URL=http://localhost:8001/api/v1 npm run dev

# 3. Pruebas (otra terminal)
npx playwright install chromium
E2E_ADMIN_EMAIL=admin@local.test E2E_ADMIN_PASSWORD='elige-una-clave' \
E2E_LEARNER_EMAIL=colaborador@local.test E2E_LEARNER_PASSWORD='elige-una-clave' \
E2E_API_URL=http://localhost:8001/api/v1 \
npm run test:e2e
```

Las pruebas de subidas generan videos con **FFmpeg** (el mismo que usa el backend) y usan la cámara y el micrófono falsos de Chromium.

Variables (nunca en el repo):

| Variable | Uso |
|---|---|
| `PLAYWRIGHT_BASE_URL` | URL del frontend (por defecto `http://localhost:3001`). |
| `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD` | Admin de prueba. La sesión se guarda en `playwright/.auth/` (ignorado por git). |
| `E2E_LEARNER_EMAIL`, `E2E_LEARNER_PASSWORD` | Colaborador de prueba (opcional; sin ellas se omite su prueba). |
| `E2E_API_URL` | API del backend de prueba: algunas pruebas preparan datos directamente (por defecto `http://localhost:8001/api/v1`). |

Otros comandos: `npm run test:e2e:headed` (con navegador visible) y `npm run test:e2e:report`.

## Qué cubren

- `e2e/critical-flows.spec.ts`: panel, biblioteca de cursos, equipo, redirecciones de URLs viejas y menú móvil (con sesión de admin).
- `e2e/session.spec.ts`: login con `next`, protección contra redirecciones a otros dominios, error de contraseña en español, cierre de sesión y acceso de colaboradores a `/admin`.
- `e2e/courses.spec.ts`: crear, completar, publicar, asignar, archivar y eliminar cursos.
- `e2e/uploads.spec.ts`: subir video y documento a un módulo, grabarse con la cámara y subir una portada.
- `e2e/ai-studio.spec.ts`: el estudio IA completo (brief, estructura, guiones, voz y presentador, producción).
- `e2e/layout-warnings.spec.ts`: los avisos de diseño del guion. Un guion guardado con una viñeta demasiado larga trae su aviso en el resumen sobre las escenas, en la cabecera de la escena y junto a la viñeta (marcada como inválida); el resumen lleva a la viñeta; al acortarla se revisa el borrador sin guardarlo y el aviso se va; lo que se escribe se revisa al escribirlo (un dato que no cabe es un error; una palabra partida, solo un aviso); escribir la narración no pide ninguna revisión (ni pasada la pausa, que el reloj de la prueba adelanta); descartar los cambios trae de vuelta los avisos del guion guardado y, guardado ya corregido, no queda ninguno. Si la revisión falla, lo dice (también en voz alta), deja los últimos avisos y se reintenta; al quitar una viñeta, el aviso de la que no cabía no pasa a la que toma su lugar. Lo que no causa ningún campo (simulado) describe el diseño de la escena, y el resumen lleva a él o, si la escena también tiene un campo con avisos, a ese campo. Una infografía que tapa el presentador (aviso simulado: las infografías falsas dejan libre esa esquina) ofrece «Otra versión» junto al aviso sin perder el foco; la nueva versión no se da por corregida (una nota dice que se revisa cuando esté lista) y, guardada y dibujada (la espera de la imagen es simulada), se revisa y el aviso vuelve. Producción muestra los avisos del guion de cada módulo, escena por escena, y «Corregir en el guion» lo abre en Contenido; si no puede revisar el guion de un módulo, lo dice y se reintenta.
- `e2e/revisions.spec.ts`: «Pedir un cambio» al guion de un módulo (con la IA falsa, que cambia el título de las escenas elegidas y, si se pide, su narración o la lectura; el video se produce de verdad, con la voz falsa y sin presentador). Desde la fila del módulo, un cambio a la escena 2 (sin observación lo dice junto al campo; un ejemplo lo llena) llega como propuesta con el título antes y después, la narración palabra por palabra, la diapositiva dibujada antes y después y lo que costaría volver a producir el video; al aplicarlo el guion cambia, el módulo avisa «El video no refleja 1 escena del guion» con «Volver a producir», y «Deshacer» del aviso lo devuelve (y el aviso se va); el historial muestra el cambio deshecho, el que lo deshizo y el guion guardado al principio. En el estudio, el botón de una escena empieza el cambio en esa escena y espera mientras el guion tiene cambios sin guardar; una propuesta que se deja para después queda como «Cambio por revisar» en el módulo y se retoma (el botón de otra escena abre el formulario en esa escena, dice qué propuesta reemplaza y deja volver a ella), y descartarla devuelve el formulario con la observación. «Pedir otro ajuste» reemplaza la propuesta (se puede volver a ella) y «Aplicar y volver a producir», en un curso publicado, pregunta antes (cancelar no aplica nada) y encola el video sin ofrecer deshacer en el aviso; un cambio que no toca las escenas (simulado) no ofrece volver a producir el video; si la escena cambió desde la propuesta, no se aplica y se pide de nuevo sobre el guion actual; si la IA no puede proponer nada (simulado), lo dice y deja pedirlo otra vez. Lo editado sin guardar en el guion abierto no se pierde: el panel abierto desde «Cambio por revisar» no vuelve a pedir el guion (aunque haya cambiado en otra pestaña) y no deja aplicar, y tras aplicar, «Deshacer» del aviso espera a que se guarde o descarte lo editado (lo dice y el aviso se queda; luego deshace sin tocar lo cambiado en otra pestaña). En el panel del módulo, si la lectura cambió mientras se editaba (al aplicar un cambio que la reescribe), lo dice, pregunta antes de guardar encima y ofrece «Usar la lectura nueva».
- `e2e/learner.spec.ts`: el colaborador toma un curso (lectura, completar, reprobar y aprobar la evaluación, terminar) y edita su perfil.
- `e2e/team.spec.ts`: agregar a una persona (entra con su contraseña temporal), abrir su vista rápida desde el menú de su fila (su nombre lleva a su ficha), editarla, desactivarla y reactivarla; y que el foco vuelva a quien abrió cada diálogo o panel (también desde el menú de una fila).
- `e2e/paths.spec.ts`: rutas de aprendizaje. Un perfil desde Equipo › Perfiles, una ruta con dos cursos en orden vinculada al perfil y publicada; el perfil se le da a una persona en su diálogo y la ruta le llega: ve «Mi ruta» con el segundo curso bloqueado (también por su dirección), y al terminar el primero el diálogo le ofrece el siguiente hasta completar la ruta. También ordenar y quitar cursos, asignar y quitar personas (no a quien la tiene por su perfil), el plazo, borrador, archivo y eliminación; y renombrar un perfil (nombre repetido), ver sus personas en el equipo y eliminarlo sin quitarles sus cursos.
- `e2e/certificates.spec.ts`: certificados. El firmante se define en Parámetros (desde el menú del admin, con la miniatura del certificado); al completar un curso el diálogo trae «Descargar certificado» (el enlace es el PDF, sin sesión) y «Ver verificación»; el certificado queda en el curso, en «Mis cursos» y en «Mis certificados»; la página pública `/verify/<código>` lo da por válido (también en minúsculas y sin guiones), nunca da por válido un estado que no conoce y, revocado desde el registro con un motivo, lo da por revocado (y el PDF ya no se descarga); el registro anuncia lo que encuentra cada búsqueda, también cuando no encuentra nada. Un curso que no da certificado («No» en sus Ajustes), el certificado de una ruta completada (en el diálogo y en «Mi ruta»), emitir a mano (a quien no completó ningún curso se le dice; dos veces: el válido vuelve), una ruta sin completar rechazada con el motivo del servidor y reemitir (mientras va, la fila no se puede reemitir otra vez; el anterior queda revocado). En Parámetros: valores fuera de rango, una zona horaria escrita a mano (mal, en otras mayúsculas y otro nombre de la zona en minúsculas, que se guarda como lo acepta el servidor), la pregunta antes de salir sin guardar y los valores con que nace una evaluación nueva (si no se pueden leer, lo dice y se reintenta).
- `e2e/mobile-certificates.spec.ts` (proyecto `mobile`, a 360 px): el diálogo del curso completado con sus enlaces a la mano, «Mis certificados», la verificación pública (válida y no encontrada), el registro como tarjetas con su menú, emitir a mano sin abrir el teclado y Parámetros con su miniatura y la barra para guardar a la vista.
- `e2e/mobile-layout-warnings.spec.ts` (proyecto `mobile`, a 360 px): los avisos de diseño del guion sin desbordes, con el botón del resumen a la mano y llevando al punto que no cabe; y en producción, los avisos de un módulo y «Corregir en el guion» con un toque.
- `e2e/mobile-revisions.spec.ts` (proyecto `mobile`, a 360 px): el cambio al guion desde el panel del módulo, con el panel del cambio encima sin desbordes y sin abrir el teclado, escenas y ejemplos a la mano, las diapositivas de la propuesta una sobre otra y las decisiones siempre visibles abajo; al aplicar, el aviso arriba y de vuelta en el panel del módulo, y el historial con «Deshacer».
- `e2e/mobile-admin.spec.ts` (proyecto `mobile`: un Pixel 7 táctil): la administración en el celular. La cabecera del curso con sus acciones en un menú, la vista previa sin desbordes, con sus actividades para probar y el módulo elegido a la vista, participantes con «Retirar» a la mano, evaluaciones legibles y su editor de preguntas, despublicar una actividad con confirmación, flechas para ordenar módulos y actividades (esperan mientras se guarda y anuncian la nueva posición), el editor sin abrir el teclado y con sus botones sobre la barra de inicio del teléfono, por qué no se quita una decisión, el motivo de un aviso con un toque, y el panel, los filtros de cursos y el equipo.
- `e2e/mobile-paths.spec.ts` (proyecto `mobile`, a 360 px): «Mi ruta» del colaborador sin desbordes y con el botón para seguir a la mano, la pantalla de un curso bloqueado, y las rutas del admin (tarjetas, cabecera, cursos, personas como tarjetas y ajustes).
- `e2e/people.spec.ts`: la ficha de una persona y el ranking. El colaborador juega una actividad y reprueba la evaluación (su único intento); el admin llega a su ficha desde el nombre en el equipo y ve sus cifras (puntos, actividades jugadas), su ruta, su curso módulo por módulo (mejor puntaje y partidas, sus respuestas) y le da otro intento (con confirmación; el foco se queda en la evaluación). El colaborador la aprueba, completa curso y ruta, y ve su lugar de hoy en «Mis cursos» y en su página de ranking (por periodo, en la dirección; lo que se lee en voz alta al cambiar dice el periodo); el admin lo ve en la ficha, en la pestaña «Ranking» de la ruta y en «Los mejores hoy» del panel. Ocultar el ranking en Parámetros se lo quita al colaborador (menú, tarjeta y página) y no al admin. También la vista rápida con «Ver ficha completa» (cada barra de avance dice de qué curso es), editar desde la ficha, el enlace desde los participantes de un curso (abre ese curso), revocar un certificado desde la ficha y una persona que no existe.
- `e2e/mobile-people.spec.ts` (proyecto `mobile`, a 360 px): la ficha sin desbordes y con los nombres de rutas y cursos (también los cortos), «Dar otro intento» y «Ver respuestas» a la mano; y el colaborador con la barra inferior (Inicio, Ranking, Perfil), «Cerrar sesión» en su menú, la tarjeta del ranking de hoy y la página del ranking con su posición fija sobre la barra. La pestaña «Ranking» guarda su lugar mientras se preguntan los parámetros y no aparece si lo ocultan (con la respuesta simulada: los parámetros son globales). Como `people.spec.ts` oculta el ranking por un momento, lo que depende de que se vea se vuelve a revisar tras recargar.
