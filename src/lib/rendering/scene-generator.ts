import { AudioFeatures, SceneDefinition, StylePreset, VisualMode, ColorStrategy } from '@/types';
import { createRNG, RNG } from '@/lib/prng';
import { getPalette } from '@/lib/palettes';

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function resampleCurve(curve: number[], targetLength: number): number[] {
  if (curve.length === 0) return Array(targetLength).fill(0.5);
  if (curve.length === 1) return Array(targetLength).fill(curve[0]);
  if (curve.length === targetLength) return [...curve];
  const result: number[] = [];
  for (let i = 0; i < targetLength; i++) {
    const t = i / (targetLength - 1);
    const srcPos = t * (curve.length - 1);
    const lo = Math.floor(srcPos);
    const hi = Math.min(lo + 1, curve.length - 1);
    const frac = srcPos - lo;
    result.push(lerp(curve[lo], curve[hi], frac));
  }
  return result;
}

const ALL_MODES: VisualMode[] = [
  'waveform', 'fractal-tree', 'constellation', 'topographic',
  'expressionist', 'geometric', 'hatching', 'mosaic', 'concentric', 'scatter',
];

function selectVisualMode(features: AudioFeatures, rng: RNG): VisualMode {
  if (features.noisiness > 0.6 && features.transientSharpness > 0.5) return 'expressionist';
  if (features.repetition > 0.6 && features.harmonicDensity > 0.5) return 'concentric';
  if (features.rhythmicComplexity > 0.6 && features.beatDensity > 0.5) return 'mosaic';
  if (features.spectralSpread > 0.6 && features.dynamicRange > 0.4) return 'topographic';
  if (features.brightness > 0.6 && features.highEnergy > 0.5) return 'hatching';
  if (features.subBassEnergy > 0.5 && features.loudness > 0.5) return 'fractal-tree';
  if (features.warmth > 0.5 && features.midEnergy > 0.4) return 'constellation';
  if (features.spectralCentroid > 0.5 && features.transitionDensity > 0.4) return 'scatter';
  if (features.bpm > 130 && features.beatDensity > 0.4) return 'geometric';
  if (features.dynamicRange > 0.3 && features.energyEvolution.length > 0) return 'waveform';
  return rng.pick(ALL_MODES);
}

function selectColorStrategy(features: AudioFeatures, rng: RNG): ColorStrategy {
  if (features.dynamicRange < 0.2) return 'monochrome';
  if (features.brightness > 0.7 && features.noisiness > 0.5) return 'full-spectrum';
  if (features.warmth > 0.6) return 'warm-dominant';
  if (features.brightness > 0.6 && features.warmth < 0.3) return 'cool-dominant';
  if (features.harmonicDensity > 0.5) return 'triadic';
  return rng.pick(['duotone', 'triadic', 'full-spectrum', 'warm-dominant', 'cool-dominant']);
}

function generateRhythmPattern(bpm: number, features: AudioFeatures, rng: RNG): number[] {
  const totalBeats = 16;
  const pattern: number[] = [];
  for (let i = 0; i < totalBeats; i++) {
    const beatInBar = i % 4;
    let strength = beatInBar === 0 ? 1.0 : beatInBar === 2 ? 0.7 : 0.3;
    if (features.rhythmicComplexity > 0.5) strength += rng.nextFloat(-0.2, 0.2);
    if (features.energyEvolution.length > 0) {
      const eIdx = Math.floor((i / totalBeats) * features.energyEvolution.length);
      strength *= 0.5 + features.energyEvolution[Math.min(eIdx, features.energyEvolution.length - 1)] * 0.5;
    }
    pattern.push(clamp(strength, 0, 1));
  }
  return pattern;
}

interface StyleModifiers {
  densityMul: number;
  complexityMul: number;
  contrastMul: number;
  turbulenceMul: number;
  grainMul: number;
  glowMul: number;
  lineWidthMul: number;
  symmetryBoost: number;
  scaleMul: number;
  paletteTransform: (palette: string[], rng: RNG) => string[];
}

const STYLE_MODIFIERS: Record<StylePreset, StyleModifiers> = {
  ethereal: {
    densityMul: 0.7, complexityMul: 0.8, contrastMul: 0.7,
    turbulenceMul: 0.5, grainMul: 0.3, glowMul: 2.0,
    lineWidthMul: 0.6, symmetryBoost: 2, scaleMul: 1.2,
    paletteTransform: (p) => p,
  },
  noir: {
    densityMul: 1.0, complexityMul: 1.2, contrastMul: 1.5,
    turbulenceMul: 0.7, grainMul: 2.5, glowMul: 0.2,
    lineWidthMul: 0.8, symmetryBoost: 0, scaleMul: 1.0,
    paletteTransform: (palette) => {
      return palette.map((hex) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
        const gr = Math.min(255, Math.round(gray * 0.7));
        return `#${gr.toString(16).padStart(2, '0').repeat(3)}`;
      });
    },
  },
  brutalist: {
    densityMul: 1.8, complexityMul: 1.5, contrastMul: 1.8,
    turbulenceMul: 1.2, grainMul: 1.5, glowMul: 0.1,
    lineWidthMul: 2.5, symmetryBoost: -1, scaleMul: 0.8,
    paletteTransform: (p) => p,
  },
  psychedelic: {
    densityMul: 1.5, complexityMul: 1.6, contrastMul: 1.2,
    turbulenceMul: 2.0, grainMul: 0.6, glowMul: 1.5,
    lineWidthMul: 1.0, symmetryBoost: 1, scaleMul: 1.4,
    paletteTransform: (palette, rng) => {
      return palette.map((hex) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        const shift = rng.nextFloat(-60, 60);
        return `#${clamp(Math.round(r + shift * 1.2), 0, 255).toString(16).padStart(2, '0')}${clamp(Math.round(g + shift * 0.8), 0, 255).toString(16).padStart(2, '0')}${clamp(Math.round(b + shift * 1.5), 0, 255).toString(16).padStart(2, '0')}`;
      });
    },
  },
  minimal: {
    densityMul: 0.25, complexityMul: 0.3, contrastMul: 1.2,
    turbulenceMul: 0.2, grainMul: 0.1, glowMul: 0.4,
    lineWidthMul: 0.5, symmetryBoost: 1, scaleMul: 1.5,
    paletteTransform: (palette, rng) => {
      const bg = palette[0];
      const accent = rng.pick(palette.slice(3));
      return [bg, bg, bg, '#ffffff', accent];
    },
  },
  'retro-futurist': {
    densityMul: 1.1, complexityMul: 1.1, contrastMul: 1.0,
    turbulenceMul: 1.0, grainMul: 1.2, glowMul: 1.4,
    lineWidthMul: 1.1, symmetryBoost: 1, scaleMul: 1.0,
    paletteTransform: (p) => p,
  },
};

export function generateScene(
  seed: number,
  features: AudioFeatures,
  stylePreset: StylePreset
): SceneDefinition {
  const rng = createRNG(seed);
  const basePalette = getPalette(stylePreset);
  const mods = STYLE_MODIFIERS[stylePreset];

  const visualMode = selectVisualMode(features, rng);
  const colorStrategy = selectColorStrategy(features, rng);
  const energyCurve = resampleCurve(features.energyEvolution, 16);
  const rhythmPattern = generateRhythmPattern(features.bpm, features, rng);

  const density = clamp(
    lerp(0.1, 1.0, features.beatDensity * 0.3 + features.rhythmicComplexity * 0.3 + features.loudness * 0.2 + features.noisiness * 0.2) * mods.densityMul,
    0.05, 1.5
  );

  const complexity = clamp(
    lerp(0.1, 1.0, features.spectralCentroid * 0.3 + features.spectralSpread * 0.3 + features.highEnergy * 0.2 + features.harmonicDensity * 0.2) * mods.complexityMul,
    0.05, 1.5
  );

  const symmetry = clamp(
    Math.round(lerp(1, 12, features.repetition * 0.5 + features.harmonicDensity * 0.3 + features.bpm / 200 * 0.2)) + mods.symmetryBoost,
    1, 12
  );

  const scale = clamp(
    lerp(0.3, 2.0, features.subBassEnergy * 0.3 + features.loudness * 0.3 + features.dynamicRange * 0.2 + features.spectralSpread * 0.2) * mods.scaleMul,
    0.1, 3.0
  );

  const contrast = clamp(
    lerp(0.2, 1.0, features.dynamicRange * 0.4 + features.transientSharpness * 0.3 + features.noisiness * 0.3) * mods.contrastMul,
    0.1, 2.0
  );

  const turbulence = clamp(
    lerp(0.0, 1.0, features.noisiness * 0.4 + features.transientSharpness * 0.3 + features.dynamicRange * 0.3) * mods.turbulenceMul,
    0, 2.0
  );

  const grainIntensity = clamp(features.noisiness * 0.5 + features.transientSharpness * 0.3 + (1 - features.brightness) * 0.2, 0, 1) * mods.grainMul;
  const glowIntensity = clamp(features.brightness * 0.5 + features.highEnergy * 0.3 + features.transientSharpness * 0.2, 0, 1) * mods.glowMul;

  const lineWidth = clamp(
    lerp(0.3, 4.0, features.loudness * 0.4 + features.subBassEnergy * 0.3 + features.midEnergy * 0.3) * mods.lineWidthMul,
    0.1, 8.0
  );

  const palette = applyColorStrategy(
    mods.paletteTransform(basePalette, rng),
    colorStrategy, features, rng
  );

  return {
    seed, palette, stylePreset, visualMode, colorStrategy,
    energyCurve, rhythmPattern, symmetry, density, scale,
    complexity, contrast, turbulence, grainIntensity,
    glowIntensity, lineWidth,
  };
}

function applyColorStrategy(
  palette: string[], strategy: ColorStrategy,
  features: AudioFeatures, rng: RNG
): string[] {
  const parse = (hex: string): [number, number, number] => {
    const h = hex.replace('#', '');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  };
  const toHex = (r: number, g: number, b: number): string =>
    `#${clamp(Math.round(r), 0, 255).toString(16).padStart(2, '0')}${clamp(Math.round(g), 0, 255).toString(16).padStart(2, '0')}${clamp(Math.round(b), 0, 255).toString(16).padStart(2, '0')}`;

  switch (strategy) {
    case 'monochrome': {
      const base = parse(palette[0]);
      return Array.from({ length: 7 }, (_, i) => {
        const t = i / 6;
        return toHex(base[0] * (0.2 + t * 0.8), base[1] * (0.2 + t * 0.8), base[2] * (0.2 + t * 0.8));
      });
    }
    case 'duotone': {
      const c1 = parse(palette[0]);
      const c2 = parse(palette[Math.min(3, palette.length - 1)]);
      return Array.from({ length: 7 }, (_, i) => {
        const t = i / 6;
        return toHex(c1[0] + (c2[0] - c1[0]) * t, c1[1] + (c2[1] - c1[1]) * t, c1[2] + (c2[2] - c1[2]) * t);
      });
    }
    case 'warm-dominant':
      return palette.map((hex) => { const [r, g, b] = parse(hex); return toHex(r * 1.3, g * 0.85, b * 0.65); });
    case 'cool-dominant':
      return palette.map((hex) => { const [r, g, b] = parse(hex); return toHex(r * 0.65, g * 0.85, b * 1.3); });
    default:
      return palette;
  }
}
