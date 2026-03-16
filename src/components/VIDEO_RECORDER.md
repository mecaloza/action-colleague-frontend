# VideoRecorder Component

**Task:** #123  
**Developer:** Stiglitz 🎯  
**Status:** ✅ Completado (MVP)  
**Fecha:** 2026-03-15

---

## 📋 Descripción

Componente de grabación de video en vivo para Action Colleague. Permite a los usuarios grabarse a sí mismos (modo "streamer") directamente desde el navegador usando MediaRecorder API.

---

## ✅ Funcionalidades Implementadas (MVP)

### Core Features
- ✅ Acceso a cámara/micrófono con permisos
- ✅ Preview en tiempo real
- ✅ Countdown 3-2-1 antes de grabar
- ✅ Timer visible durante grabación
- ✅ Controles básicos:
  - 🔴 Grabar
  - ⏹ Detener  
  - 🔄 Reiniciar
- ✅ Audio level visualization en tiempo real
- ✅ Indicadores visuales (cámara/mic status)
- ✅ Manejo de errores y permisos denegados
- ✅ Export como Blob al completar
- ✅ Límite de duración configurable

### UI/UX
- ✅ Preview grande tipo "streamer"
- ✅ Controles intuitivos abajo
- ✅ Estados visuales claros
- ✅ Responsive design
- ✅ Dark mode compatible
- ✅ Accesibilidad (ARIA labels)

---

## 🚀 Uso

### Importación

```tsx
import { VideoRecorder } from "@/components/video-recorder";
```

### Ejemplo Básico

```tsx
function MyPage() {
  const handleComplete = (blob: Blob, duration: number) => {
    console.log('Video grabado:', blob);
    console.log('Duración:', duration, 'segundos');
    
    // Hacer algo con el blob (upload, guardar, etc.)
  };

  return (
    <VideoRecorder 
      onRecordingComplete={handleComplete}
      maxDuration={600} // 10 minutos
    />
  );
}
```

### Integración con Backend (Semana 2)

```tsx
const handleComplete = async (blob: Blob, duration: number) => {
  const formData = new FormData();
  formData.append('video', blob, 'recording.webm');
  formData.append('module_id', moduleId);
  formData.append('duration', duration.toString());
  
  const response = await fetch('/api/v1/videos/upload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: formData,
  });
  
  const data = await response.json();
  console.log('Video ID:', data.video_id);
};
```

---

## 📝 API

### Props

```tsx
interface VideoRecorderProps {
  onRecordingComplete: (blob: Blob, duration: number) => void;
  maxDuration?: number; // segundos, default 1800 (30 min)
  className?: string;
}
```

#### `onRecordingComplete`
**Tipo:** `(blob: Blob, duration: number) => void`  
**Requerido:** Sí

Callback que se ejecuta cuando la grabación se completa (usuario presiona "Detener" o se alcanza maxDuration).

**Parámetros:**
- `blob`: Video grabado como Blob (tipo `video/webm`)
- `duration`: Duración total en segundos

#### `maxDuration`
**Tipo:** `number`  
**Default:** `1800` (30 minutos)  
**Opcional:** Sí

Duración máxima de grabación en segundos. Al alcanzar este límite, la grabación se detiene automáticamente.

#### `className`
**Tipo:** `string`  
**Opcional:** Sí

Clases CSS adicionales para el contenedor del componente.

---

## 🎨 Estados del Componente

### `idle`
Estado inicial. Muestra preview de cámara y botón "Grabar".

### `countdown`
Cuenta regresiva 3-2-1 antes de iniciar grabación.

### `recording`
Grabando activamente. Muestra timer, badge "GRABANDO", audio levels.

### `stopped`
Grabación completada. Permite reiniciar o usar el video grabado.

### `error`
Error de permisos o dispositivos. Muestra mensaje y botón "Reintentar".

---

## 🔧 Detalles Técnicos

### MediaRecorder API

```javascript
const mediaRecorder = new MediaRecorder(stream, {
  mimeType: "video/webm;codecs=vp9,opus"
});
```

**Configuración de stream:**
```javascript
{
  video: {
    width: { ideal: 1920 },
    height: { ideal: 1080 },
    facingMode: "user"
  },
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    sampleRate: 44100
  }
}
```

### Audio Level Monitoring

Usa Web Audio API para monitorear niveles de audio en tiempo real:

```javascript
const audioContext = new AudioContext();
const analyser = audioContext.createAnalyser();
const microphone = audioContext.createMediaStreamSource(stream);
analyser.fftSize = 256;
microphone.connect(analyser);
```

Visualización con 8 barras indicadoras:
- 🟢 Verde: Nivel óptimo (>80%)
- 🟡 Amarillo: Nivel medio (50-80%)
- 🔵 Azul: Nivel bajo (<50%)

### Formato de Salida

- **Tipo:** `video/webm`
- **Codecs:** `vp9` (video) + `opus` (audio)
- **Resolución:** 1920x1080 (1080p ideal)
- **Audio:** 44.1 kHz, mono/stereo según dispositivo

---

## 📦 Dependencias

### Requeridas (ya en package.json)
- `react` ^18
- `lucide-react` (iconos)
- `@/components/ui/*` (shadcn/ui components)

### Browser APIs
- `navigator.mediaDevices.getUserMedia`
- `MediaRecorder`
- `AudioContext`
- `AnalyserNode`

**Compatibilidad:** Chrome 60+, Firefox 65+, Safari 14.1+, Edge 79+

---

## 🧪 Testing

### Manual Testing Checklist

- [ ] Permisos aceptados → preview funciona
- [ ] Permisos denegados → mensaje de error claro
- [ ] Countdown 3-2-1 antes de grabar
- [ ] Timer incrementa correctamente durante grabación
- [ ] Audio levels se visualizan en tiempo real
- [ ] Detener grabación → blob generado correctamente
- [ ] Reiniciar → limpia estado y permite nueva grabación
- [ ] MaxDuration detiene automáticamente
- [ ] Blob exportado es reproducible
- [ ] Dark mode funciona correctamente
- [ ] Responsive en mobile/tablet/desktop

### Unit Tests (TODO - Semana 2)

```tsx
// Ejemplo tests con Jest + React Testing Library
describe('VideoRecorder', () => {
  it('solicita permisos de cámara y micrófono', () => {});
  it('muestra countdown antes de grabar', () => {});
  it('genera blob válido al detener', () => {});
  it('respeta maxDuration', () => {});
});
```

---

## 🐛 Known Issues / Limitaciones

### Limitaciones del MVP
- ❌ No upload automático (Semana 2)
- ❌ No múltiples tomas (V2)
- ❌ No selector de calidad (V2)
- ❌ No pausa/resume (V2)
- ❌ No rotación de cámara front/back (V2)

### Browser Limitations
- Safari iOS requiere HTTPS para getUserMedia
- Firefox puede tener issues con vp9 codec (fallback automático a vp8)
- Mobile browsers pueden limitar resolución a 720p

---

## 🔜 Próximos Pasos (Semana 2+)

### Integración Backend
- [ ] Endpoint `/api/v1/videos/upload`
- [ ] Progress bar durante upload
- [ ] Thumbnail generation
- [ ] Metadata storage

### Mejoras UX
- [ ] Selector de calidad (720p/1080p/4K)
- [ ] Múltiples tomas (guardar/reintentar)
- [ ] Pausa/Resume durante grabación
- [ ] Picture-in-Picture mode

### Features Avanzados
- [ ] Chromakey (green screen)
- [ ] Filters en tiempo real
- [ ] Screen sharing simultáneo
- [ ] Teleprompter overlay

---

## 📚 Referencias

- [MediaRecorder API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder)
- [getUserMedia - MDN](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)
- [Web Audio API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)

---

**Completado:** 2026-03-15  
**Developer:** Stiglitz 🎯  
**Review:** Pendiente (Aldo 🎬)
