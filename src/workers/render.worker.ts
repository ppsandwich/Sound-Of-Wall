import type { SceneDefinition } from '@/types';
import { renderArtwork } from '@/lib/rendering/renderer';
import { canvasToBlob } from '@/lib/export';

interface RenderMessage {
  type: 'render';
  scene: SceneDefinition;
  width: number;
  height: number;
}

interface ExportMessage {
  type: 'export';
  scene: SceneDefinition;
  size: number;
}

type WorkerMessage = RenderMessage | ExportMessage;

interface RenderResult {
  type: 'render-result';
  imageBitmap: ImageBitmap;
}

interface ExportResult {
  type: 'export-result';
  blob: Blob;
}

interface ErrorResult {
  type: 'error';
  message: string;
}

type WorkerResult = RenderResult | ExportResult | ErrorResult;

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  const msg = e.data;

  try {
    if (msg.type === 'render') {
      const { scene, width, height } = msg;
      const canvas = renderArtwork({ width, height, scene });
      const bitmap = await createImageBitmap(canvas);
      const result: RenderResult = { type: 'render-result', imageBitmap: bitmap };
      (self as unknown as Worker).postMessage(result, [bitmap]);
    } else if (msg.type === 'export') {
      const { scene, size } = msg;
      const clampedSize = Math.min(size, 4096);
      const canvas = renderArtwork({ width: clampedSize, height: clampedSize, scene });
      const blob = await canvasToBlob(canvas, 'image/png');
      const result: ExportResult = { type: 'export-result', blob };
      self.postMessage(result);
    }
  } catch (err) {
    const errorResult: ErrorResult = {
      type: 'error',
      message: err instanceof Error ? err.message : String(err),
    };
    self.postMessage(errorResult);
  }
};
