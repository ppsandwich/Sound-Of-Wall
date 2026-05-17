import type { SceneDefinition } from '@/types';

export function createRenderWorker(): Worker {
  return new Worker(new URL('./render.worker.ts', import.meta.url), {
    type: 'module',
  });
}

export function renderInWorker(
  worker: Worker,
  scene: SceneDefinition,
  width: number,
  height: number
): Promise<ImageBitmap> {
  return new Promise((resolve, reject) => {
    const handler = (e: MessageEvent) => {
      if (e.data.type === 'render-result') {
        worker.removeEventListener('message', handler);
        resolve(e.data.imageBitmap);
      } else if (e.data.type === 'error') {
        worker.removeEventListener('message', handler);
        reject(new Error(e.data.message));
      }
    };
    worker.addEventListener('message', handler);
    worker.postMessage({ type: 'render', scene, width, height });
  });
}

export function exportInWorker(
  worker: Worker,
  scene: SceneDefinition,
  size: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const handler = (e: MessageEvent) => {
      if (e.data.type === 'export-result') {
        worker.removeEventListener('message', handler);
        resolve(e.data.blob);
      } else if (e.data.type === 'error') {
        worker.removeEventListener('message', handler);
        reject(new Error(e.data.message));
      }
    };
    worker.addEventListener('message', handler);
    worker.postMessage({ type: 'export', scene, size });
  });
}
