# Manual Course Creation - Feature Documentation

**Status:** ✅ COMPLETED
**Date:** 2026-03-15
**Developer:** Stiglitz (Frontend)

---

## 📋 Overview

Feature completo de creación manual de cursos con grabación de video + diseño de slides + composición automática. 

Implementado en **3-4 horas** según sprint crítico de Padawan.

---

## 🎯 Tasks Completadas

### Task #132 - VideoRecorder + Upload Integration ✅
**Tiempo:** 30-45 min  
**Archivo:** `src/components/video-recorder-with-upload.tsx`

**Features:**
- ✅ Auto-upload cuando usuario detiene grabación
- ✅ Progress bar con porcentaje durante upload
- ✅ Manejo completo de errores (red, timeout, server)
- ✅ Estados visuales: uploading, success, error
- ✅ Integración con endpoint `/api/v1/videos/upload`

**Props:**
```tsx
interface VideoRecorderWithUploadProps {
  moduleId: number;
  onUploadComplete?: (data: { 
    video_id: number; 
    storage_url: string 
  }) => void;
  maxDuration?: number;
  className?: string;
}
```

**Usage:**
```tsx
import { VideoRecorderWithUpload } from "@/components/video-recorder-with-upload";

<VideoRecorderWithUpload
  moduleId={123}
  onUploadComplete={(data) => {
    console.log("Uploaded:", data.video_id);
  }}
  maxDuration={1800} // 30 minutes
/>
```

---

### Task #124 - SlideEditor MVP ✅
**Tiempo:** 1-2 horas  
**Archivo:** `src/components/slide-editor.tsx`

**Features:**
- ✅ Editor simple de slides (título + contenido + color)
- ✅ Añadir/eliminar/reordenar slides
- ✅ Preview thumbnails
- ✅ Export a PNG (1920x1080) con html2canvas
- ✅ Template simple pero funcional

**Props:**
```tsx
interface SlideEditorProps {
  onSlidesComplete: (slideImages: Blob[]) => void;
  className?: string;
}

interface Slide {
  id: string;
  title: string;
  content: string;
  background: string; // hex color
}
```

**Usage:**
```tsx
import { SlideEditor } from "@/components/slide-editor";

<SlideEditor
  onSlidesComplete={(slideBlobs) => {
    console.log(`Generated ${slideBlobs.length} slides`);
  }}
/>
```

**NO incluye (deferred V2):**
- ❌ Drag-and-drop reordering
- ❌ Templates avanzados
- ❌ IA generation frontend
- ❌ Image uploads en slides

---

### Task #128 - Wizard de Creación ✅
**Tiempo:** 1 hora  
**Archivo:** `src/components/course-creation-manual.tsx`

**Features:**
- ✅ Wizard paso-a-paso (3 pasos)
- ✅ Step 1: Grabar video → auto-upload
- ✅ Step 2: Crear slides → export PNG
- ✅ Step 3: Componer video final → `/videos/compose`
- ✅ Progress indicators
- ✅ Estado completo de error handling
- ✅ Auto-trigger de composición en Step 3

**Props:**
```tsx
interface CourseCreationManualProps {
  moduleId: number;
  onComplete?: (videoId: number) => void;
  className?: string;
}
```

**Usage:**
```tsx
import { CourseCreationManual } from "@/components/course-creation-manual";

<CourseCreationManual
  moduleId={123}
  onComplete={(videoId) => {
    router.push(`/courses/${videoId}`);
  }}
/>
```

**Flow:**
1. Usuario graba video → auto-upload
2. Usuario crea slides → export PNG
3. Sistema compone video + slides → video final

---

## 📦 Dependencies Added

```json
{
  "html2canvas": "^1.4.1"
}
```

**Installation:**
```bash
npm install html2canvas
```

---

## 🎨 New Components Created

1. **video-recorder-with-upload.tsx** - Wrapper con auto-upload
2. **slide-editor.tsx** - Editor MVP de slides
3. **course-creation-manual.tsx** - Wizard completo
4. **ui/alert.tsx** - Alert component (shadcn/ui style)
5. **index.ts** - Barrel exports

---

## 🧪 Testing

**Demo page:** `/test`

```bash
npm run dev
# Navigate to http://localhost:3000/test
```

**Test flow:**
1. Grab video con webcam
2. Espera auto-upload
3. Crea 2-3 slides
4. Click "Generar Presentación"
5. Wizard auto-compone video final

---

## 🔌 API Endpoints Used

### POST `/api/v1/videos/upload`
**Request:**
```typescript
FormData {
  file: Blob, // recording.webm
  module_id: string,
  duration: number
}
```

**Response:**
```json
{
  "video_id": 123,
  "storage_url": "https://..."
}
```

### POST `/api/v1/videos/compose?video_id={id}`
**Request:**
```typescript
FormData {
  slides: Blob[], // slide-1.png, slide-2.png, ...
}
```

**Response:**
```json
{
  "video_id": 123,
  "status": "composed"
}
```

---

## 📝 Component Architecture

```
CourseCreationManual (wizard)
├── Step 1: VideoRecorderWithUpload
│   └── VideoRecorder (base component)
├── Step 2: SlideEditor
│   └── html2canvas (export)
└── Step 3: Processing
    └── POST /videos/compose
```

---

## 🚀 Integration Guide

### Agregar a página de admin:

```tsx
// src/app/admin/courses/[id]/create-manual/page.tsx
"use client";

import { CourseCreationManual } from "@/components/course-creation-manual";
import { useParams, useRouter } from "next/navigation";

export default function CreateManualPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params.id as string;

  return (
    <div className="container mx-auto py-8">
      <CourseCreationManual
        moduleId={parseInt(courseId)}
        onComplete={(videoId) => {
          router.push(`/admin/courses/${courseId}`);
        }}
      />
    </div>
  );
}
```

### Agregar ruta en nav:

```tsx
// En tu admin sidebar/nav
<Link href="/admin/courses/new/manual">
  Crear Curso Manual
</Link>
```

---

## ⚡ Performance Notes

**Video Upload:**
- XMLHttpRequest con progress tracking
- Timeout: 5 minutos
- Compresión: video/webm (codec vp9)

**Slide Export:**
- html2canvas scale: 2 (alta calidad)
- Resolución: 1920x1080
- Formato: PNG
- Proceso secuencial (no paralelo por limitación de canvas)

**Optimizations:**
- Hidden preview divs (off-screen render)
- Blobs en memoria (no URLs temporales)
- Progress incremental

---

## 🐛 Known Limitations

1. **Browser Support:** Requiere MediaRecorder API (Chrome/Edge 49+, Firefox 25+)
2. **Mobile:** MediaRecorder puede tener issues en iOS Safari
3. **File Size:** Videos grandes (>100MB) pueden ser lentos en upload
4. **Slides:** No soporta imágenes/multimedia (solo texto)
5. **Concurrent:** No soporta múltiples uploads simultáneos

---

## 🔮 Future Improvements (V2)

- [ ] Drag-and-drop slide reordering
- [ ] Image upload en slides
- [ ] Templates de diseño predefinidos
- [ ] Preview de video compuesto antes de finalizar
- [ ] Soporte para editar video ya grabado
- [ ] Retry automático de uploads fallidos
- [ ] Background upload (service worker)

---

## 📊 Metrics

**Development Time:**
- Task #132: 30 min ✅
- Task #124: 1.5 horas ✅
- Task #128: 1 hora ✅
- Testing + Docs: 30 min
- **Total:** ~3.5 horas

**Code Stats:**
- Lines of code: ~750
- Files created: 5
- Dependencies added: 1

---

## ✅ Checklist de Deploy

- [x] Components creados
- [x] Types definidos
- [x] Error handling completo
- [x] Build exitoso (warnings solo de i18n preexistentes)
- [x] Documentación completa
- [ ] Testing manual en staging
- [ ] Testing en producción con video real
- [ ] Monitoreo de errores (Sentry)

---

## 🎬 Demo Video

TODO: Grabar demo en Loom cuando esté en staging

---

**Entregado por:** Stiglitz 🎯  
**Reviewed by:** Aldo Raine 🎬  
**Backend Integration:** Donowitz 🔨 (endpoints ya ready)
