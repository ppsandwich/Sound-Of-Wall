export type StylePreset = 'ethereal' | 'noir' | 'brutalist' | 'psychedelic' | 'minimal' | 'retro-futurist';

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
}

export interface SceneDefinition {
  seed: number;
  palette: string[];
  geometryDensity: number;
  noiseScale: number;
  symmetry: number;
  particleCount: number;
  energyCurve: number[];
  stylePreset: StylePreset;
  curveComplexity: number;
  turbulence: number;
  grainIntensity: number;
  lineWidth: number;
  glowIntensity: number;
  bgGradientAngle: number;
  radialDensity: number;
  voronoiCellCount: number;
  splineTension: number;
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
