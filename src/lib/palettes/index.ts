import type { StylePreset } from '../../types';

export const PALETTES: Record<StylePreset, string[]> = {
  ethereal: ['#1e1033', '#5e239d', '#f61067', '#1a0533', '#9b59b6', '#e8a0bf'],
  noir: ['#0a0a0a', '#1a1a1a', '#333333', '#f5f5f5', '#8b0000', '#c0c0c0'],
  brutalist: ['#2d2d2d', '#ff3333', '#ffcc00', '#3366ff', '#e0e0e0', '#666666'],
  psychedelic: ['#0d0221', '#ff006e', '#8338ec', '#3a86ff', '#ffbe0b', '#fb5607'],
  minimal: ['#0f0f0f', '#1a1a1a', '#2a2a2a', '#ffffff', '#e63946'],
  'retro-futurist': ['#0c0032', '#190061', '#240090', '#3500d3', '#ff6b35', '#f7c59f'],
};

export function getPalette(preset: StylePreset): string[] {
  return PALETTES[preset];
}
