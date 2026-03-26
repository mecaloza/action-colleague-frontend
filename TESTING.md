# Testing - Action Colleague Frontend 🧪

## Setup

```bash
npm install -D @playwright/test
npx playwright install chromium
```

## Running Tests

### Local Development
```bash
# Asegúrate de tener el servidor corriendo en :3001
npm run dev

# En otra terminal:
PLAYWRIGHT_BASE_URL=http://localhost:3001 npm run test:e2e
```

### Production
```bash
npm run test:e2e
# Default: https://action-colleague.vercel.app
```

### Headed Mode (ver el browser)
```bash
npm run test:e2e:headed
```

### Ver Reporte
```bash
npm run test:e2e:report
```

## Test Coverage

### Critical Flows ✅
- Cursos: lista, detalle, creación
- Empleados: lista, mapeo seguro (fix bug s.map)
- Evaluaciones: analytics sin crashes
- Dashboard: carga correcta
- Documentos: tabla visible
- Navegación general

### Authentication
Los tests usan credenciales admin:
- Email: `admin@actioncolleague.com`
- Password: `admin123`

Estado guardado en `playwright/.auth/user.json`

## Verification Workflow

Antes de marcar un fix como DONE:

```bash
./scripts/verify-fix.sh
```

Este script:
1. ✅ Build local
2. ✅ Tests E2E local
3. ✅ Deploy a Vercel
4. ✅ Tests E2E en producción

**SOLO si pasan todos → DONE** 🎯

## Bug Fix Log

### 2026-03-25: s.map is not a function

**Error reportado:**
```
TypeError: s.map is not a function
at ec (page-10921728000b0368.js:1:25633)
```

**Causa:**
API `getUsers()` podía devolver algo que no era array.

**Fix aplicado:**
1. Guard en API layer (`src/lib/api.ts`):
   ```typescript
   if (!Array.isArray(raw)) {
     console.error('[API] getUsers returned non-array:', raw);
     return [];
   }
   ```

2. Guard en component layer (`src/app/admin/employees/page.tsx`):
   ```typescript
   const safeUsers = Array.isArray(users) ? users : [];
   ```

**Verificación:**
- Build: ✅
- Tests E2E local: ✅ 9/9
- Deploy: ✅
- Tests E2E producción: ✅ 9/9

**Status:** ✅ DONE
**Deployed:** https://action-colleague.vercel.app
