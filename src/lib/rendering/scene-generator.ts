import { AudioFeatures, SceneDefinition, StylePreset, CompositionMode, ColorStrategy } from '@/types';
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

function selectCompositionMode(features: AudioFeatures, rng: RNG): CompositionMode {
  const bpmNorm = (features.bpm - 60) / 140;

  if (features.repetition > 0.6 && features.harmonicDensity > 0.5) return 'radial';
  if (features.rhythmicComplexity > 0.6 && features.beatDensity > 0.5) return 'grid';
  if (features.energyEvolution.length > 0) {
    const variance = features.energyEvolution.reduce((sum, v, i, arr) => {
      if (i === 0) return 0;
      return sum + Math.abs(v - arr[i - 1]);
    }, 0) / Math.max(1, features.energyEvolution.length - 1);
    if (variance > 0.15) return 'flowing';
  }
  if (features.spectralSpread > 0.5) return 'scattered';
  if (bpmNorm < 0.3 && features.warmth > 0.5) return 'organic';
  if (features.midEnergy > 0.4 && features.dynamicRange < 0.4) return 'centered';

  const modes: CompositionMode[] = ['centered', 'scattered', 'flowing', 'radial', 'grid', 'organic'];
  return rng.pick(modes);
}

function selectColorStrategy(features: AudioFeatures, rng: RNG): ColorStrategy {
  if (features.dynamicRange < 0.2) return 'monochrome';
  if (features.brightness > 0.7 && features.noisiness > 0.5) return 'full-spectrum';
  if (features.warmth > 0.6) return 'warm-dominant';
  if (features.brightness > 0.6 && features.warmth < 0.3) return 'cool-dominant';
  if (features.harmonicDensity > 0.5) return 'triadic';

  const strategies: ColorStrategy[] = ['duotone', 'triadic', 'full-spectrum', 'warm-dominant', 'cool-dominant'];
  return rng.pick(strategies);
}

function computeLayerMask(features: AudioFeatures, rng: RNG): number {
  let mask = 0;
  if (features.noisiness > 0.15) mask |= 1;
  if (features.repetition > 0.3) mask |= 2;
  if (features.rhythmicComplexity > 0.2 || features.beatDensity > 0.3) mask |= 4;
  if (features.spectralCentroid > 0.3 || features.highEnergy > 0.3) mask |= 8;
  if (features.repetition > 0.4 && features.harmonicDensity > 0.3) mask |= 16;
  if (features.beatDensity > 0.2) mask |= 32;
  if (features.transientSharpness > 0.3 || features.noisiness > 0.4) mask |= 64;

  if (mask === 0) {
    mask = 1 << rng.nextInt(0, 5);
  }
  return mask;
}

function generateRhythmPattern(bpm: number, features: AudioFeatures, rng: RNG): number[] {
  const beatsPerBar = 4;
  const bars = 4;
  const totalBeats = beatsPerBar * bars;
  const pattern: number[] = [];

  const energyCurve = features.energyEvolution;
  for (let i = 0; i < totalBeats; i++) {
    const beatInBar = i % beatsPerBar;
    let strength = beatInBar === 0 ? 1.0 : beatInBar === 2 ? 0.7 : 0.3;

    if (features.rhythmicComplexity > 0.5) {
      strength += rng.nextFloat(-0.2, 0.2);
    }
    if (energyCurve.length > 0) {
      const eIdx = Math.floor((i / totalBeats) * energyCurve.length);
      strength *= 0.5 + energyCurve[Math.min(eIdx, energyCurve.length - 1)] * 0.5;
    }
    pattern.push(clamp(strength, 0, 1));
  }
  return pattern;
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
    geometryDensityMul: 0.7,
    geometryDensityOffset: -0.05,
    noiseScaleMul: 0.85,
    symmetryBoost: 2,
    particleCountMul: 1.2,
    curveComplexityMul: 0.8,
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
    geometryDensityMul: 1.0,
    geometryDensityOffset: 0,
    noiseScaleMul: 1.0,
    symmetryBoost: 0,
    particleCountMul: 0.5,
    curveComplexityMul: 1.2,
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
    geometryDensityMul: 1.8,
    geometryDensityOffset: 0.15,
    noiseScaleMul: 1.2,
    symmetryBoost: -1,
    particleCountMul: 1.4,
    curveComplexityMul: 1.6,
    turbulenceMul: 1.3,
    grainIntensityMul: 1.4,
    lineWidthMul: 2.5,
    glowIntensityMul: 0.2,
    radialDensityMul: 1.4,
    voronoiCellCountMul: 1.5,
    splineTensionMul: 1.5,
    paletteTransform: (palette) => palette,
  },

  psychedelic: {
    geometryDensityMul: 1.4,
    geometryDensityOffset: 0.05,
    noiseScaleMul: 2.0,
    symmetryBoost: 1,
    particleCountMul: 2.5,
    curveComplexityMul: 1.5,
    turbulenceMul: 2.5,
    grainIntensityMul: 0.8,
    lineWidthMul: 1.0,
    glowIntensityMul: 1.5,
    radialDensityMul: 1.8,
    voronoiCellCountMul: 2.0,
    splineTensionMul: 0.8,
    paletteTransform: (palette, rng) => {
      return palette.map((hex) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        const shift = rng.nextFloat(-60, 60);
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
    geometryDensityMul: 1.1,
    geometryDensityOffset: 0,
    noiseScaleMul: 1.1,
    symmetryBoost: 1,
    particleCountMul: 1.3,
    curveComplexityMul: 1.1,
    turbulenceMul: 1.1,
    grainIntensityMul: 1.2,
    lineWidthMul: 1.1,
    glowIntensityMul: 1.3,
    radialDensityMul: 2.0,
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

  const bpmNorm = clamp((features.bpm - 60) / 140, 0, 1);

  const geometryDensity = clamp(
    (lerp(0.05, 0.95, features.rhythmicComplexity * 0.5 + bpmNorm * 0.3 + features.beatDensity * 0.2) + mods.geometryDensityOffset) * mods.geometryDensityMul,
    0,
    1
  );

  const noiseScale = clamp(
    lerp(0.1, 2.0, features.noisiness) * mods.noiseScaleMul,
    0.05,
    3.0
  );

  const rawSymmetry = Math.round(lerp(2, 12, features.harmonicDensity * 0.6 + features.repetition * 0.4));
  const symmetry = clamp(rawSymmetry + mods.symmetryBoost, 2, 12);

  const particleBase = lerp(50, 5000, clamp(features.beatDensity * 0.4 + bpmNorm * 0.3 + features.loudness * 0.3, 0, 1));
  const particleCount = Math.round(particleBase * mods.particleCountMul);

  const energyCurve = resampleCurve(features.energyEvolution, 16);

  const curveComplexity = clamp(
    lerp(0.05, 1.0, features.spectralCentroid * 0.4 + features.spectralSpread * 0.3 + features.highEnergy * 0.3) * mods.curveComplexityMul,
    0,
    1
  );

  const turbulence = clamp(
    lerp(0.0, 2.0, features.transientSharpness * 0.4 + features.noisiness * 0.3 + features.dynamicRange * 0.3) * mods.turbulenceMul,
    0,
    3
  );

  const grainIntensity = clamp(features.noisiness * mods.grainIntensityMul, 0, 1);

  const lineWidth = clamp(
    lerp(0.3, 6.0, features.loudness * 0.5 + features.subBassEnergy * 0.3 + features.midEnergy * 0.2) * mods.lineWidthMul,
    0.1,
    10
  );

  const glowIntensity = clamp(
    lerp(0.0, 2.5, features.brightness * 0.5 + features.highEnergy * 0.3 + features.transientSharpness * 0.2) * mods.glowIntensityMul,
    0,
    3
  );

  const bgGradientAngle = lerp(0, 360, features.energyEvolution.length > 0 ? features.energyEvolution[0] : rng.next());

  const radialDensity = clamp(
    lerp(0.0, 1.0, features.repetition * 0.5 + features.harmonicDensity * 0.3 + bpmNorm * 0.2) * mods.radialDensityMul,
    0,
    2
  );

  const voronoiCellCount = Math.round(
    lerp(3, 80, clamp(features.transitionDensity * 0.5 + features.noisiness * 0.3 + features.dynamicRange * 0.2, 0, 1)) * mods.voronoiCellCountMul
  );

  const splineTension = clamp(
    lerp(0.05, 1.5, clamp(features.warmth * 0.5 + features.subBassEnergy * 0.3 + features.spectralCentroid * 0.2, 0, 1)) * mods.splineTensionMul,
    0.05,
    2.0
  );

  const compositionMode = selectCompositionMode(features, rng);
  const colorStrategy = selectColorStrategy(features, rng);
  const layerMask = computeLayerMask(features, rng);
  const dominantFrequencyBand = features.subBassEnergy > features.midEnergy
    ? (features.subBassEnergy > features.highEnergy ? 0 : 2)
    : (features.midEnergy > features.highEnergy ? 1 : 2);

  const rhythmPattern = generateRhythmPattern(features.bpm, features, rng);

  const contrastLevel = clamp(features.dynamicRange * 1.5 + features.transientSharpness * 0.5, 0, 1);
  const spatialDepth = clamp(features.spectralSpread * 0.5 + features.dynamicRange * 0.3 + features.noisiness * 0.2, 0, 1);
  const motionBlur = clamp(features.bpm > 140 ? 0.6 : bpmNorm * 0.5, 0, 1);

  const waveAmplitude = lerp(0.02, 0.3, features.midEnergy * 0.5 + features.dynamicRange * 0.3 + features.beatDensity * 0.2);
  const waveFrequency = lerp(1, 12, bpmNorm * 0.5 + features.spectralCentroid * 0.3 + features.highEnergy * 0.2);

  const ringCount = Math.round(lerp(0, 20, features.repetition * 0.5 + features.harmonicDensity * 0.3 + radialDensity * 0.2));
  const gridDensity = lerp(0, 0.8, features.rhythmicComplexity * 0.4 + features.beatDensity * 0.3 + bpmNorm * 0.3);
  const flowFieldStrength = lerp(0, 1, features.loudness * 0.3 + features.transitionDensity * 0.3 + features.spectralSpread * 0.2 + features.dynamicRange * 0.2);

  const palette = applyColorStrategy(
    mods.paletteTransform(basePalette, rng),
    colorStrategy,
    features,
    rng
  );

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
    compositionMode,
    colorStrategy,
    layerMask,
    dominantFrequencyBand,
    rhythmPattern,
    contrastLevel,
    spatialDepth,
    motionBlur,
    waveAmplitude,
    waveFrequency,
    ringCount,
    gridDensity,
    flowFieldStrength,
  };
}

function applyColorStrategy(
  palette: string[],
  strategy: ColorStrategy,
  features: AudioFeatures,
  rng: RNG
): string[] {
  const parseHex = (hex: string): [number, number, number] => {
    const h = hex.replace('#', '');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  };
  const toHex = (r: number, g: number, b: number): string =>
    `#${clamp(Math.round(r), 0, 255).toString(16).padStart(2, '0')}${clamp(Math.round(g), 0, 255).toString(16).padStart(2, '0')}${clamp(Math.round(b), 0, 255).toString(16).padStart(2, '0')}`;

  switch (strategy) {
    case 'monochrome': {
      const base = parseHex(palette[0]);
      const result: string[] = [];
      for (let i = 0; i < 7; i++) {
        const t = i / 6;
        result.push(toHex(
          base[0] * (0.3 + t * 0.7),
          base[1] * (0.3 + t * 0.7),
          base[2] * (0.3 + t * 0.7)
        ));
      }
      return result;
    }
    case 'duotone': {
      const c1 = parseHex(palette[0]);
      const c2 = parseHex(palette[Math.min(3, palette.length - 1)]);
      const result: string[] = [];
      for (let i = 0; i < 7; i++) {
        const t = i / 6;
        result.push(toHex(
          c1[0] + (c2[0] - c1[0]) * t,
          c1[1] + (c2[1] - c1[1]) * t,
          c1[2] + (c2[2] - c1[2]) * t
        ));
      }
      return result;
    }
    case 'warm-dominant': {
      return palette.map((hex) => {
        const [r, g, b] = parseHex(hex);
        return toHex(r * 1.3, g * 0.9, b * 0.7);
      });
    }
    case 'cool-dominant': {
      return palette.map((hex) => {
        const [r, g, b] = parseHex(hex);
        return toHex(r * 0.7, g * 0.9, b * 1.3);
      });
    }
    default:
      return palette;
  }
}
