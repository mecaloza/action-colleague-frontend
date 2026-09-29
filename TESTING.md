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
# 1. Backend (repo action-colleague-backend): SQLite local + usuarios de prueba
SEED_PASSWORD='elige-una-clave' .venv/bin/python -m scripts.seed_dev
.venv/bin/uvicorn app.main:app --port 8001

# 2. Frontend apuntando a ese backend
NEXT_PUBLIC_API_URL=http://localhost:8001/api/v1 npm run dev

# 3. Pruebas (otra terminal)
npx playwright install chromium
E2E_ADMIN_EMAIL=admin@local.test E2E_ADMIN_PASSWORD='elige-una-clave' \
E2E_LEARNER_EMAIL=colaborador@local.test E2E_LEARNER_PASSWORD='elige-una-clave' \
npm run test:e2e
```

Variables (nunca en el repo):

| Variable | Uso |
|---|---|
| `PLAYWRIGHT_BASE_URL` | URL del frontend (por defecto `http://localhost:3001`). |
| `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD` | Admin de prueba. La sesión se guarda en `playwright/.auth/` (ignorado por git). |
| `E2E_LEARNER_EMAIL`, `E2E_LEARNER_PASSWORD` | Colaborador de prueba (opcional; sin ellas se omite su prueba). |

Otros comandos: `npm run test:e2e:headed` (con navegador visible) y `npm run test:e2e:report`.

## Qué cubren

- `e2e/critical-flows.spec.ts`: panel, biblioteca de cursos, equipo, redirecciones de URLs viejas y menú móvil (con sesión de admin).
- `e2e/session.spec.ts`: login con `next`, protección contra redirecciones a otros dominios, error de contraseña en español, cierre de sesión y acceso de colaboradores a `/admin`.
