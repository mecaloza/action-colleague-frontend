// The server draws two slides at a time (the previews, and the checks of a script being edited) and turns away (429)
// the requests that wait too long: a long script asks for every scene at once (and Producción for every module's
// script, whose slides are drawn to check them), so this tab sends two at most and queues the rest.
const MAX_RENDERS = 2;
let rendering = 0;
const waiting: (() => void)[] = [];

const cancelled = () => new DOMException("Cancelado", "AbortError");

/** Resolves when a render slot is free; rejects if `signal` aborts first (the slide changed or left the screen). */
function takeSlot(signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.reject(cancelled());
  if (rendering < MAX_RENDERS) {
    rendering += 1;
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const start = () => {
      signal.removeEventListener("abort", cancel);
      rendering += 1;
      resolve();
    };
    const cancel = () => {
      const index = waiting.indexOf(start);
      if (index >= 0) waiting.splice(index, 1);
      reject(cancelled());
    };
    waiting.push(start);
    signal.addEventListener("abort", cancel, { once: true });
  });
}

function releaseSlot() {
  rendering -= 1;
  waiting.shift()?.();
}

/** Runs `draw` (a request that makes the server draw) once one of the tab's slots is free. */
export async function inRenderSlot<T>(signal: AbortSignal, draw: () => Promise<T>): Promise<T> {
  await takeSlot(signal);
  try {
    return await draw();
  } finally {
    releaseSlot();
  }
}
