import { AudioFeatures, SceneDefinition, StylePreset } from '@/types';
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

interface StyleModifiers {
  geometryDensityMul: number;
  geometryDensityOffset: number;
  noiseScaleMul: number;
  symmetryBoost: number;
  particleCountMul: number;
  curveComplexityMul: number;
  turbulenceMul: number;
  grainIntensityMul: number;
  lineWidthMul: number;
  glowIntensityMul: number;
  radialDensityMul: number;
  voronoiCellCountMul: number;
  splineTensionMul: number;
  paletteTransform: (palette: string[], rng: RNG) => string[];
}

const STYLE_MODIFIERS: Record<StylePreset, StyleModifiers> = {
  ethereal: {
    geometryDensityMul: 0.6,
    geometryDensityOffset: -0.05,
    noiseScaleMul: 0.85,
    symmetryBoost: 2,
    particleCountMul: 1.1,
    curveComplexityMul: 0.7,
    turbulenceMul: 0.6,
    grainIntensityMul: 0.4,
    lineWidthMul: 0.7,
    glowIntensityMul: 1.8,
    radialDensityMul: 0.9,
    voronoiCellCountMul: 0.8,
    splineTensionMul: 0.6,
    paletteTransform: (palette) => palette,
  },

  noir: {
    geometryDensityMul: 0.9,
    geometryDensityOffset: 0,
    noiseScaleMul: 1.0,
    symmetryBoost: 0,
    particleCountMul: 0.5,
    curveComplexityMul: 1.1,
    turbulenceMul: 0.8,
    grainIntensityMul: 2.5,
    lineWidthMul: 0.9,
    glowIntensityMul: 0.3,
    radialDensityMul: 0.7,
    voronoiCellCountMul: 0.6,
    splineTensionMul: 1.2,
    paletteTransform: (palette) => {
      const desaturated = palette.map((hex) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
        const gr = Math.min(255, Math.round(gray * 0.7));
        return `#${gr.toString(16).padStart(2, '0').repeat(3)}`;
      });
      if (palette.length >= 5) {
        desaturated[4] = palette[4];
      }
      return desaturated;
    },
  },

  brutalist: {
    geometryDensityMul: 1.6,
    geometryDensityOffset: 0.15,
    noiseScaleMul: 1.2,
    symmetryBoost: -1,
    particleCountMul: 1.3,
    curveComplexityMul: 1.5,
    turbulenceMul: 1.3,
    grainIntensityMul: 1.4,
    lineWidthMul: 2.0,
    glowIntensityMul: 0.2,
    radialDensityMul: 1.4,
    voronoiCellCountMul: 1.5,
    splineTensionMul: 1.5,
    paletteTransform: (palette) => palette,
  },

  psychedelic: {
    geometryDensityMul: 1.3,
    geometryDensityOffset: 0.05,
    noiseScaleMul: 1.8,
    symmetryBoost: 1,
    particleCountMul: 2.0,
    curveComplexityMul: 1.4,
    turbulenceMul: 2.0,
    grainIntensityMul: 0.8,
    lineWidthMul: 1.0,
    glowIntensityMul: 1.5,
    radialDensityMul: 1.6,
    voronoiCellCountMul: 1.8,
    splineTensionMul: 0.8,
    paletteTransform: (palette, rng) => {
      return palette.map((hex) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        const shift = rng.nextFloat(-40, 40);
        const nr = clamp(Math.round(r + shift * 1.2), 0, 255);
        const ng = clamp(Math.round(g + shift * 0.8), 0, 255);
        const nb = clamp(Math.round(b + shift * 1.5), 0, 255);
        return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`;
      });
    },
  },

  minimal: {
    geometryDensityMul: 0.3,
    geometryDensityOffset: -0.1,
    noiseScaleMul: 0.5,
    symmetryBoost: 1,
    particleCountMul: 0.25,
    curveComplexityMul: 0.4,
    turbulenceMul: 0.3,
    grainIntensityMul: 0.2,
    lineWidthMul: 0.6,
    glowIntensityMul: 0.5,
    radialDensityMul: 0.4,
    voronoiCellCountMul: 0.3,
    splineTensionMul: 0.5,
    paletteTransform: (palette, rng) => {
      const bg = palette[0];
      const accent = rng.pick(palette.slice(3));
      return [bg, bg, bg, '#ffffff', accent];
    },
  },

  'retro-futurist': {
    geometryDensityMul: 1.0,
    geometryDensityOffset: 0,
    noiseScaleMul: 1.1,
    symmetryBoost: 1,
    particleCountMul: 1.2,
    curveComplexityMul: 1.0,
    turbulenceMul: 1.1,
    grainIntensityMul: 1.2,
    lineWidthMul: 1.1,
    glowIntensityMul: 1.3,
    radialDensityMul: 1.8,
    voronoiCellCountMul: 1.0,
    splineTensionMul: 0.9,
    paletteTransform: (palette) => palette,
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

  const geometryDensity = clamp(
    (lerp(0.05, 0.95, features.rhythmicComplexity) + mods.geometryDensityOffset) * mods.geometryDensityMul,
    0,
    1
  );

  const noiseScale = clamp(features.noisiness * mods.noiseScaleMul, 0, 1);

  const rawSymmetry = Math.round(lerp(2, 8, features.harmonicDensity));
  const symmetry = clamp(rawSymmetry + mods.symmetryBoost, 2, 8);

  const particleCount = Math.round(
    lerp(200, 3000, clamp(features.beatDensity, 0, 1)) * mods.particleCountMul
  );

  const energyCurve = resampleCurve(features.energyEvolution, 8);

  const curveComplexity = clamp(features.spectralCentroid * mods.curveComplexityMul, 0, 1);

  const turbulence = clamp(features.transientSharpness * mods.turbulenceMul, 0, 1);

  const grainIntensity = clamp(features.noisiness * mods.grainIntensityMul, 0, 1);

  const lineWidth = clamp(lerp(0.5, 4.0, clamp(features.loudness, 0, 1)) * mods.lineWidthMul, 0.1, 8);

  const glowIntensity = clamp(features.brightness * mods.glowIntensityMul, 0, 2);

  const bgGradientAngle = rng.nextFloat(0, 360);

  const radialDensity = clamp(features.repetition * mods.radialDensityMul, 0, 1);

  const voronoiCellCount = Math.round(
    lerp(5, 50, clamp(features.transitionDensity, 0, 1)) * mods.voronoiCellCountMul
  );

  const splineTension = clamp(
    lerp(0.1, 1.0, clamp(features.warmth, 0, 1)) * mods.splineTensionMul,
    0.1,
    1.0
  );

  const palette = mods.paletteTransform(basePalette, rng);

  return {
    seed,
    palette,
    geometryDensity,
    noiseScale,
    symmetry,
    particleCount,
    energyCurve,
    stylePreset,
    curveComplexity,
    turbulence,
    grainIntensity,
    lineWidth,
    glowIntensity,
    bgGradientAngle,
    radialDensity,
    voronoiCellCount,
    splineTension,
  };
}
