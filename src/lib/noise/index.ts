import { createNoise2D, createNoise3D } from 'simplex-noise';
import { createRNG } from '../prng';

export type NoiseFunction2D = (x: number, y: number) => number;
export type NoiseFunction3D = (x: number, y: number, z: number) => number;

export function seededNoise2D(seed: number): NoiseFunction2D {
  const rng = createRNG(seed);
  return createNoise2D(() => rng.next());
}

export function seededNoise3D(seed: number): NoiseFunction3D {
  const rng = createRNG(seed);
  return createNoise3D(() => rng.next());
}

export function createFBM(
  noiseFn: NoiseFunction2D,
  octaves: number,
  lacunarity: number,
  gain: number
): NoiseFunction2D {
  return (x: number, y: number): number => {
    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    let maxValue = 0;
    for (let i = 0; i < octaves; i++) {
      value += amplitude * noiseFn(x * frequency, y * frequency);
      maxValue += amplitude;
      amplitude *= gain;
      frequency *= lacunarity;
    }
    return value / maxValue;
  };
}

export function createTurbulence(
  noiseFn: NoiseFunction2D,
  octaves: number,
  lacunarity: number,
  gain: number
): NoiseFunction2D {
  return (x: number, y: number): number => {
    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    let maxValue = 0;
    for (let i = 0; i < octaves; i++) {
      value += amplitude * Math.abs(noiseFn(x * frequency, y * frequency));
      maxValue += amplitude;
      amplitude *= gain;
      frequency *= lacunarity;
    }
    return value / maxValue;
  };
}

export function createRidgedNoise(
  noiseFn: NoiseFunction2D,
  octaves: number,
  lacunarity: number,
  gain: number
): NoiseFunction2D {
  return (x: number, y: number): number => {
    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    let maxValue = 0;
    let prev = 1;
    for (let i = 0; i < octaves; i++) {
      let n = 1 - Math.abs(noiseFn(x * frequency, y * frequency));
      n *= n;
      n *= prev;
      prev = n;
      value += amplitude * n;
      maxValue += amplitude;
      amplitude *= gain;
      frequency *= lacunarity;
    }
    return value / maxValue;
  };
}
