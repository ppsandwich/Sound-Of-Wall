import type { AudioFeatures } from '../../types';

function serializeFeatures(features: AudioFeatures): string {
  const sortedKeys = Object.keys(features).sort() as (keyof AudioFeatures)[];
  const parts: string[] = [];
  for (const key of sortedKeys) {
    const value = features[key];
    if (Array.isArray(value)) {
      parts.push(key + ':[' + value.map((v) => v.toFixed(6)).join(',') + ']');
    } else {
      parts.push(key + ':' + (value as number).toFixed(6));
    }
  }
  return parts.join('|');
}

function bufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

export async function hashAudio(
  normalizedData: Float32Array,
  features: AudioFeatures
): Promise<string> {
  const featureStr = serializeFeatures(features);
  const featureBytes = new TextEncoder().encode(featureStr);

  const buffer = new ArrayBuffer(
    normalizedData.byteLength + featureBytes.byteLength
  );
  const view = new Float32Array(buffer, 0, normalizedData.length);
  view.set(normalizedData);
  const uint8View = new Uint8Array(buffer);
  uint8View.set(featureBytes, normalizedData.byteLength);

  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return bufferToHex(hashBuffer);
}

export function hashToSeed(hash: string): number {
  const hex8 = hash.slice(0, 8);
  return parseInt(hex8, 16) | 0;
}
