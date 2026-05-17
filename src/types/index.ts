export type StylePreset = 'ethereal' | 'noir' | 'brutalist' | 'psychedelic' | 'minimal' | 'retro-futurist';

export type VisualMode =
  | 'waveform'
  | 'fractal-tree'
  | 'constellation'
  | 'topographic'
  | 'expressionist'
  | 'geometric'
  | 'hatching'
  | 'mosaic'
  | 'concentric'
  | 'scatter';

export type ColorStrategy = 'monochrome' | 'duotone' | 'triadic' | 'full-spectrum' | 'warm-dominant' | 'cool-dominant';

export interface AudioFeatures {
  bpm: number;
  beatDensity: number;
  transientSharpness: number;
  rhythmicComplexity: number;
  spectralCentroid: number;
  brightness: number;
  warmth: number;
  noisiness: number;
  harmonicDensity: number;
  loudness: number;
  dynamicRange: number;
  energyEvolution: number[];
  repetition: number;
  transitionDensity: number;
  tensionCurves: number[];
  subBassEnergy: number;
  midEnergy: number;
  highEnergy: number;
  spectralSpread: number;
  stereoWidth: number;
}

export interface SceneDefinition {
  seed: number;
  palette: string[];
  stylePreset: StylePreset;
  visualMode: VisualMode;
  colorStrategy: ColorStrategy;
  energyCurve: number[];
  rhythmPattern: number[];
  symmetry: number;
  density: number;
  scale: number;
  scaleMin: number;
  scaleMax: number;
  complexity: number;
  contrast: number;
  turbulence: number;
  grainIntensity: number;
  glowIntensity: number;
  lineWidth: number;
  overlayCount: number;
  postProcessMask: number;
}

export interface Generation {
  id: string;
  audioHash: string;
  seed: number;
  stylePreset: StylePreset;
  featureVector: AudioFeatures;
  sceneDefinition: SceneDefinition;
  imageUrl: string | null;
  createdAt: string;
}

export interface GalleryResponse {
  generations: Generation[];
  total: number;
  page: number;
  pageSize: number;
}

export interface GenerateRequest {
  audioHash: string;
  featureVector: AudioFeatures;
  stylePreset: StylePreset;
}

export interface GenerateResponse {
  generationId: string;
  sceneDefinition: SceneDefinition;
}
