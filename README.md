# Action Colleague — Estudio de cursos (frontend)

Aplicación web para crear cursos de formación **con IA** (a partir de tus documentos) o **con tu propio material** (videos, grabaciones con diapositivas, documentos y lecturas), asignarlos a tu equipo y seguir su avance. Next.js 14 (App Router) + React 18 + Tailwind, desplegada en Vercel; habla con el API de `action-colleague-backend`.

## Desarrollo

```bash
npm install
cp .env.example .env.local        # NEXT_PUBLIC_API_URL apunta al backend local
npm run dev                       # http://localhost:3001
```

El backend local se levanta como indica su README (SQLite, `USE_FAKE_PROVIDERS=true` para usar el estudio IA sin llaves).

| Variable | Descripción |
|---|---|
| `NEXT_PUBLIC_API_URL` | URL del API (`…/api/v1`). En desarrollo, `http://localhost:8001/api/v1`. |

## Estructura

```
src/
  app/                 rutas (App Router)
    login/             inicio de sesión
    (app)/admin/       panel, cursos (biblioteca, editor, estudio IA, vista previa) y equipo
    (app)/learn/       mis cursos y reproductor del colaborador
    (app)/profile/     perfil
  components/
    ui/                primitivas (Radix + Tailwind): botón, diálogo, panel, pestañas…
    layout/            shell, héroes, estados vacíos y de error, confirmación
    courses/           biblioteca y editor de cursos
    studio/            estudio de creación con IA
    media/, recording/ subidas directas y estudio de grabación
    learn/             experiencia del colaborador
    team/              equipo
  contexts/            sesión (auth)
  lib/api/             cliente tipado del API (JSON, refresh de tokens, errores en español)
  lib/hooks/           subidas (PUT/TUS), trabajos en segundo plano, URLs firmadas estables…
e2e/                   pruebas Playwright
```

## Decisiones

- **Un solo cliente del API** (`src/lib/api`): renueva la sesión sola (refresh token con bloqueo entre pestañas) y traduce los errores a mensajes en español.
- **React Query** para datos del servidor: los trabajos largos (IA, video, procesamiento) se siguen por polling mientras están activos.
- **Subidas directas** del navegador a Storage (PUT firmado o TUS reanudable); el API nunca recibe el archivo.
- **Diseño editorial**: blanco con bandas negras, acento naranja `#ff4c01`, tipografía display grotesca (Inter Tight) y texto en Red Hat Display, etiquetas en mayúsculas y rombos de marca. Todo funciona en celular.
- **Accesibilidad**: navegación con teclado (también reordenar y el quiz), foco que vuelve al cerrar diálogos, textos para lectores de pantalla y contraste AA.
- Interfaz solo en español; los cursos pueden estar en español, inglés o portugués.

## Pruebas

Ver [TESTING.md](TESTING.md): `npm run lint`, `npx tsc --noEmit`, `npm run build` y la suite Playwright contra un backend local.
