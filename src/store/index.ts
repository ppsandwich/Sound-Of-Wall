import { create } from 'zustand';
import type { AudioFeatures, SceneDefinition, StylePreset, Generation } from '@/types';

interface AppState {
  audioFile: File | null;
  audioUrl: string | null;
  uploadedAudioUrl: string | null;
  audioFeatures: AudioFeatures | null;
  audioHash: string | null;
  isAnalyzing: boolean;
  analysisProgress: number;
  isUploading: boolean;

  selectedStyle: StylePreset;
  sceneDefinition: SceneDefinition | null;
  generationId: string | null;
  isGenerating: boolean;
  isRendering: boolean;
  renderProgress: number;

  galleryItems: Generation[];
  galleryTotal: number;
  galleryPage: number;
  isLoadingGallery: boolean;

  setAudioFile: (file: File | null) => void;
  setAudioUrl: (url: string | null) => void;
  setUploadedAudioUrl: (url: string | null) => void;
  setAudioFeatures: (features: AudioFeatures | null) => void;
  setAudioHash: (hash: string | null) => void;
  setIsAnalyzing: (v: boolean) => void;
  setAnalysisProgress: (v: number) => void;
  setIsUploading: (v: boolean) => void;
  setSelectedStyle: (style: StylePreset) => void;
  setSceneDefinition: (scene: SceneDefinition | null) => void;
  setGenerationId: (id: string | null) => void;
  setIsGenerating: (v: boolean) => void;
  setIsRendering: (v: boolean) => void;
  setRenderProgress: (v: number) => void;
  setGalleryItems: (items: Generation[]) => void;
  setGalleryTotal: (total: number) => void;
  setGalleryPage: (page: number) => void;
  setIsLoadingGallery: (v: boolean) => void;
  reset: () => void;
}

const initialState = {
  audioFile: null,
  audioUrl: null,
  uploadedAudioUrl: null,
  audioFeatures: null,
  audioHash: null,
  isAnalyzing: false,
  analysisProgress: 0,
  isUploading: false,
  selectedStyle: 'ethereal' as StylePreset,
  sceneDefinition: null,
  generationId: null,
  isGenerating: false,
  isRendering: false,
  renderProgress: 0,
  galleryItems: [],
  galleryTotal: 0,
  galleryPage: 0,
  isLoadingGallery: false,
};

export const useAppStore = create<AppState>((set) => ({
  ...initialState,

  setAudioFile: (file) => set({ audioFile: file }),
  setAudioUrl: (url) => set({ audioUrl: url }),
  setUploadedAudioUrl: (url) => set({ uploadedAudioUrl: url }),
  setAudioFeatures: (features) => set({ audioFeatures: features }),
  setAudioHash: (hash) => set({ audioHash: hash }),
  setIsAnalyzing: (v) => set({ isAnalyzing: v }),
  setAnalysisProgress: (v) => set({ analysisProgress: v }),
  setIsUploading: (v) => set({ isUploading: v }),
  setSelectedStyle: (style) => set({ selectedStyle: style }),
  setSceneDefinition: (scene) => set({ sceneDefinition: scene }),
  setGenerationId: (id) => set({ generationId: id }),
  setIsGenerating: (v) => set({ isGenerating: v }),
  setIsRendering: (v) => set({ isRendering: v }),
  setRenderProgress: (v) => set({ renderProgress: v }),
  setGalleryItems: (items) => set({ galleryItems: items }),
  setGalleryTotal: (total) => set({ galleryTotal: total }),
  setGalleryPage: (page) => set({ galleryPage: page }),
  setIsLoadingGallery: (v) => set({ isLoadingGallery: v }),
  reset: () => set(initialState),
}));
