import type { AudioFeatures } from '@/types';

export async function decodeAudioFile(file: File): Promise<AudioBuffer> {
  const arrayBuffer = await file.arrayBuffer();
  const audioContext = new OfflineAudioContext(1, 1, 44100);
  return audioContext.decodeAudioData(arrayBuffer);
}

export function normalizeAudioBuffer(buffer: AudioBuffer): Float32Array {
  const raw = buffer.getChannelData(0);
  const data = new Float32Array(raw.length);
  let max = 0;
  for (let i = 0; i < raw.length; i++) {
    const abs = Math.abs(raw[i]);
    if (abs > max) max = abs;
  }
  const scale = max > 0 ? 1 / max : 1;
  for (let i = 0; i < raw.length; i++) {
    data[i] = raw[i] * scale;
  }
  return data;
}

function nextPowerOf2(n: number): number {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

export function computeFFT(signal: Float32Array, start: number, size: number): Float32Array {
  const N = nextPowerOf2(size);
  const re = new Float32Array(N);
  const im = new Float32Array(N);

  for (let i = 0; i < size; i++) {
    re[i] = signal[start + i] || 0;
  }

  for (let i = 0, j = 0; i < N; i++) {
    if (i < j) {
      let tmp = re[i]; re[i] = re[j]; re[j] = tmp;
      tmp = im[i]; im[i] = im[j]; im[j] = tmp;
    }
    let m = N >> 1;
    while (m >= 1 && j >= m) {
      j -= m;
      m >>= 1;
    }
    j += m;
  }

  for (let len = 2; len <= N; len <<= 1) {
    const halfLen = len >> 1;
    const angle = -2 * Math.PI / len;
    const wRe = Math.cos(angle);
    const wIm = Math.sin(angle);

    for (let i = 0; i < N; i += len) {
      let curRe = 1;
      let curIm = 0;

      for (let j = 0; j < halfLen; j++) {
        const tRe = curRe * re[i + j + halfLen] - curIm * im[i + j + halfLen];
        const tIm = curRe * im[i + j + halfLen] + curIm * re[i + j + halfLen];

        re[i + j + halfLen] = re[i + j] - tRe;
        im[i + j + halfLen] = im[i + j] - tIm;
        re[i + j] += tRe;
        im[i + j] += tIm;

        const newCurRe = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = newCurRe;
      }
    }
  }

  const magnitudes = new Float32Array(N / 2);
  for (let i = 0; i < N / 2; i++) {
    magnitudes[i] = Math.sqrt(re[i] * re[i] + im[i] * im[i]);
  }
  return magnitudes;
}

export function spectralCentroidRaw(magnitudes: number[]): number {
  let weightedSum = 0;
  let totalMag = 0;
  for (let i = 0; i < magnitudes.length; i++) {
    weightedSum += i * magnitudes[i];
    totalMag += magnitudes[i];
  }
  return totalMag > 0 ? weightedSum / totalMag : 0;
}

export function spectralBrightness(magnitudes: number[]): number {
  const midpoint = Math.floor(magnitudes.length / 2);
  let highEnergy = 0;
  let totalEnergy = 0;
  for (let i = 0; i < magnitudes.length; i++) {
    const e = magnitudes[i] * magnitudes[i];
    totalEnergy += e;
    if (i >= midpoint) highEnergy += e;
  }
  return totalEnergy > 0 ? highEnergy / totalEnergy : 0;
}

export function spectralWarmth(magnitudes: number[]): number {
  const cutoff = Math.floor(magnitudes.length * 0.15);
  let lowEnergy = 0;
  let totalEnergy = 0;
  for (let i = 0; i < magnitudes.length; i++) {
    const e = magnitudes[i] * magnitudes[i];
    totalEnergy += e;
    if (i < cutoff) lowEnergy += e;
  }
  return totalEnergy > 0 ? lowEnergy / totalEnergy : 0;
}

export function spectralNoisiness(fftFrames: number[][]): number {
  if (fftFrames.length === 0) return 0;
  let totalFlatness = 0;
  for (const frame of fftFrames) {
    if (frame.length === 0) continue;
    let logSum = 0;
    let arithmeticSum = 0;
    let count = 0;
    for (let i = 0; i < frame.length; i++) {
      const v = frame[i] > 0 ? frame[i] : 1e-10;
      logSum += Math.log(v);
      arithmeticSum += v;
      count++;
    }
    if (count === 0 || arithmeticSum === 0) continue;
    const geometricMean = Math.exp(logSum / count);
    const arithmeticMean = arithmeticSum / count;
    totalFlatness += geometricMean / arithmeticMean;
  }
  return totalFlatness / fftFrames.length;
}

export function computeRMS(signal: Float32Array, start: number, length: number): number {
  let sum = 0;
  const end = Math.min(start + length, signal.length);
  const count = end - start;
  if (count <= 0) return 0;
  for (let i = start; i < end; i++) {
    sum += signal[i] * signal[i];
  }
  return Math.sqrt(sum / count);
}

export function computeLoudness(rmsValues: number[]): number {
  if (rmsValues.length === 0) return -60;
  let sum = 0;
  for (let i = 0; i < rmsValues.length; i++) {
    const db = rmsValues[i] > 0 ? 20 * Math.log10(rmsValues[i]) : -60;
    sum += db;
  }
  return sum / rmsValues.length;
}

export function computeDynamicRange(rmsValues: number[]): number {
  if (rmsValues.length === 0) return 0;
  let minDb = Infinity;
  let maxDb = -Infinity;
  for (let i = 0; i < rmsValues.length; i++) {
    const db = rmsValues[i] > 0 ? 20 * Math.log10(rmsValues[i]) : -60;
    if (db < minDb) minDb = db;
    if (db > maxDb) maxDb = db;
  }
  return maxDb - minDb;
}

export function computeRepetition(signal: Float32Array): number {
  const blockSize = 2048;
  const numBlocks = Math.floor(signal.length / blockSize);
  if (numBlocks < 4) return 0;

  const energies = new Float32Array(numBlocks);
  for (let i = 0; i < numBlocks; i++) {
    energies[i] = computeRMS(signal, i * blockSize, blockSize);
  }

  const maxLag = Math.floor(numBlocks / 2);
  let bestCorr = 0;
  for (let lag = 2; lag < maxLag; lag++) {
    let corr = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < numBlocks - lag; i++) {
      corr += energies[i] * energies[i + lag];
      normA += energies[i] * energies[i];
      normB += energies[i + lag] * energies[i + lag];
    }
    const denom = Math.sqrt(normA * normB);
    if (denom > 0) {
      const normalized = corr / denom;
      if (normalized > bestCorr) bestCorr = normalized;
    }
  }
  return bestCorr;
}

export function computeEnergyEvolution(signal: Float32Array, segments: number): number[] {
  const segmentLength = Math.floor(signal.length / segments);
  const result = new Array<number>(segments);
  for (let i = 0; i < segments; i++) {
    result[i] = computeRMS(signal, i * segmentLength, segmentLength);
  }
  return result;
}

export function computeTensionCurves(signal: Float32Array, spectralData: number[][]): number[] {
  const frames = spectralData.length;
  if (frames === 0) return [];
  const result = new Array<number>(frames);
  const samplesPerFrame = Math.floor(signal.length / frames);

  for (let i = 0; i < frames; i++) {
    const energy = computeRMS(signal, i * samplesPerFrame, samplesPerFrame);
    const centroid = spectralCentroidRaw(spectralData[i]);
    const maxCentroid = spectralData[i].length > 0 ? spectralData[i].length : 1;
    const normalizedCentroid = centroid / maxCentroid;
    result[i] = 0.5 * energy + 0.5 * normalizedCentroid;
  }
  return result;
}

export function computeBeatDensity(onsets: number[], duration: number): number {
  if (duration <= 0) return 0;
  return onsets.length / duration;
}

export function computeTransientSharpness(signal: Float32Array, onsets: number[]): number {
  if (onsets.length === 0) return 0;
  const windowSize = 64;
  let totalSharpness = 0;
  let count = 0;

  for (const onset of onsets) {
    const idx = Math.floor(onset);
    if (idx < 0 || idx + windowSize >= signal.length) continue;
    let maxSlope = 0;
    for (let i = idx; i < Math.min(idx + windowSize, signal.length - 1); i++) {
      const slope = Math.abs(signal[i + 1] - signal[i]);
      if (slope > maxSlope) maxSlope = slope;
    }
    totalSharpness += maxSlope;
    count++;
  }
  return count > 0 ? totalSharpness / count : 0;
}

export function computeRhythmicComplexity(onsets: number[]): number {
  if (onsets.length < 3) return 0;
  const intervals = new Float32Array(onsets.length - 1);
  for (let i = 0; i < intervals.length; i++) {
    intervals[i] = onsets[i + 1] - onsets[i];
  }
  let mean = 0;
  for (let i = 0; i < intervals.length; i++) mean += intervals[i];
  mean /= intervals.length;
  if (mean === 0) return 0;

  let variance = 0;
  for (let i = 0; i < intervals.length; i++) {
    const diff = intervals[i] - mean;
    variance += diff * diff;
  }
  variance /= intervals.length;
  return Math.sqrt(variance) / mean;
}

function computeSubBassEnergy(fftFrames: number[][]): number {
  if (fftFrames.length === 0) return 0;
  let total = 0;
  const cutoff = Math.floor(fftFrames[0].length * 0.05);
  for (const frame of fftFrames) {
    let energy = 0;
    for (let i = 0; i < Math.min(cutoff, frame.length); i++) {
      energy += frame[i] * frame[i];
    }
    total += Math.sqrt(energy / Math.max(1, cutoff));
  }
  return total / fftFrames.length;
}

function computeMidEnergy(fftFrames: number[][]): number {
  if (fftFrames.length === 0) return 0;
  let total = 0;
  const lo = Math.floor(fftFrames[0].length * 0.05);
  const hi = Math.floor(fftFrames[0].length * 0.4);
  for (const frame of fftFrames) {
    let energy = 0;
    let count = 0;
    for (let i = lo; i < Math.min(hi, frame.length); i++) {
      energy += frame[i] * frame[i];
      count++;
    }
    total += Math.sqrt(energy / Math.max(1, count));
  }
  return total / fftFrames.length;
}

function computeHighEnergy(fftFrames: number[][]): number {
  if (fftFrames.length === 0) return 0;
  let total = 0;
  const lo = Math.floor(fftFrames[0].length * 0.4);
  for (const frame of fftFrames) {
    let energy = 0;
    let count = 0;
    for (let i = lo; i < frame.length; i++) {
      energy += frame[i] * frame[i];
      count++;
    }
    total += Math.sqrt(energy / Math.max(1, count));
  }
  return total / fftFrames.length;
}

function computeSpectralSpread(fftFrames: number[][]): number {
  if (fftFrames.length === 0) return 0;
  let totalSpread = 0;
  for (const frame of fftFrames) {
    const centroid = spectralCentroidRaw(frame);
    let weightedVariance = 0;
    let totalMag = 0;
    for (let i = 0; i < frame.length; i++) {
      weightedVariance += (i - centroid) * (i - centroid) * frame[i];
      totalMag += frame[i];
    }
    totalSpread += totalMag > 0 ? Math.sqrt(weightedVariance / totalMag) : 0;
  }
  return totalSpread / fftFrames.length;
}

function detectOnsets(signal: Float32Array, sampleRate: number): number[] {
  const frameSize = 1024;
  const hopSize = 512;
  const numFrames = Math.floor((signal.length - frameSize) / hopSize) + 1;
  if (numFrames < 2) return [];

  const energies = new Float32Array(numFrames);
  for (let i = 0; i < numFrames; i++) {
    energies[i] = computeRMS(signal, i * hopSize, frameSize);
  }

  const onsets: number[] = [];
  const threshold = 0.02;
  const minSpacing = Math.floor(0.05 * sampleRate / hopSize);

  for (let i = 1; i < numFrames - 1; i++) {
    const diff = energies[i] - energies[i - 1];
    const diffNext = energies[i] - energies[i + 1];
    if (diff > threshold && diffNext > 0) {
      if (onsets.length === 0 || i - onsets[onsets.length - 1] >= minSpacing) {
        onsets.push(i * hopSize);
      }
    }
  }

  return onsets;
}

function detectBPM(signal: Float32Array, sampleRate: number): number {
  const frameSize = 1024;
  const hopSize = 512;
  const numFrames = Math.floor((signal.length - frameSize) / hopSize) + 1;
  if (numFrames < 4) return 120;

  const energies = new Float32Array(numFrames);
  for (let i = 0; i < numFrames; i++) {
    energies[i] = computeRMS(signal, i * hopSize, frameSize);
  }

  const onsetEnv = new Float32Array(numFrames);
  for (let i = 1; i < numFrames; i++) {
    const diff = energies[i] - energies[i - 1];
    onsetEnv[i] = diff > 0 ? diff : 0;
  }

  const minLag = Math.floor(60 * sampleRate / (200 * hopSize));
  const maxLag = Math.min(
    Math.floor(60 * sampleRate / (60 * hopSize)),
    Math.floor(numFrames / 2)
  );
  if (maxLag <= minLag) return 120;

  const corr = new Float32Array(maxLag + 1);
  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0;
    for (let i = 0; i < numFrames - lag; i++) {
      sum += onsetEnv[i] * onsetEnv[i + lag];
    }
    corr[lag] = sum;
  }

  let bestLag = minLag;
  let bestVal = -Infinity;
  for (let lag = minLag; lag <= maxLag; lag++) {
    if (corr[lag] > bestVal) {
      bestVal = corr[lag];
      bestLag = lag;
    }
  }

  const bpm = (60 * sampleRate) / (bestLag * hopSize);
  return Math.max(60, Math.min(200, bpm));
}

function computeHarmonicDensity(fftFrames: number[][]): number {
  if (fftFrames.length === 0) return 0;
  let totalPeaks = 0;
  for (const frame of fftFrames) {
    if (frame.length < 3) continue;
    let peaks = 0;
    for (let i = 1; i < frame.length - 1; i++) {
      if (frame[i] > frame[i - 1] && frame[i] > frame[i + 1] && frame[i] > 0.01) {
        peaks++;
      }
    }
    totalPeaks += peaks;
  }
  const avgPeaks = totalPeaks / fftFrames.length;
  return Math.min(1, avgPeaks / 30);
}

function computeTransitionDensity(spectralData: number[][]): number {
  if (spectralData.length < 2) return 0;
  let totalChange = 0;
  for (let i = 1; i < spectralData.length; i++) {
    let diff = 0;
    const len = Math.min(spectralData[i].length, spectralData[i - 1].length);
    for (let j = 0; j < len; j++) {
      const d = spectralData[i][j] - spectralData[i - 1][j];
      diff += d * d;
    }
    totalChange += Math.sqrt(diff / len);
  }
  return totalChange / (spectralData.length - 1);
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export async function extractFeatures(buffer: AudioBuffer): Promise<AudioFeatures> {
  const signal = normalizeAudioBuffer(buffer);
  const sampleRate = buffer.sampleRate;
  const duration = buffer.duration;

  const windowSize = 2048;
  const hopSize = 512;
  const numWindows = Math.floor((signal.length - windowSize) / hopSize) + 1;

  const fftFrames: number[][] = [];
  for (let i = 0; i < numWindows; i++) {
    const mags = computeFFT(signal, i * hopSize, windowSize);
    fftFrames.push(Array.from(mags));
  }

  const rmsValues = new Float32Array(numWindows);
  for (let i = 0; i < numWindows; i++) {
    rmsValues[i] = computeRMS(signal, i * hopSize, windowSize);
  }

  const onsets = detectOnsets(signal, sampleRate);
  const bpm = detectBPM(signal, sampleRate);

  let centroidSum = 0;
  let brightnessSum = 0;
  let warmthSum = 0;
  for (const frame of fftFrames) {
    centroidSum += spectralCentroidRaw(frame);
    brightnessSum += spectralBrightness(frame);
    warmthSum += spectralWarmth(frame);
  }
  const nFrames = fftFrames.length || 1;

  const rawBeatDensity = computeBeatDensity(onsets, duration);
  const rawTransientSharpness = computeTransientSharpness(signal, onsets);
  const rawLoudness = computeLoudness(Array.from(rmsValues));
  const rawDynamicRange = computeDynamicRange(Array.from(rmsValues));
  const rawTransitionDensity = computeTransitionDensity(fftFrames);
  const rawSpectralSpread = computeSpectralSpread(fftFrames);
  const rawSubBass = computeSubBassEnergy(fftFrames);
  const rawMid = computeMidEnergy(fftFrames);
  const rawHigh = computeHighEnergy(fftFrames);

  return {
    bpm,
    beatDensity: clamp01(rawBeatDensity / 8),
    transientSharpness: clamp01(rawTransientSharpness * 5),
    rhythmicComplexity: clamp01(computeRhythmicComplexity(onsets)),
    spectralCentroid: clamp01(centroidSum / nFrames / (fftFrames[0]?.length ?? 1)),
    brightness: clamp01(brightnessSum / nFrames),
    warmth: clamp01(warmthSum / nFrames),
    noisiness: clamp01(spectralNoisiness(fftFrames) * 3),
    harmonicDensity: clamp01(computeHarmonicDensity(fftFrames)),
    loudness: clamp01((rawLoudness + 60) / 60),
    dynamicRange: clamp01(rawDynamicRange / 60),
    energyEvolution: computeEnergyEvolution(signal, 16),
    repetition: clamp01(computeRepetition(signal)),
    transitionDensity: clamp01(rawTransitionDensity * 2),
    tensionCurves: computeTensionCurves(signal, fftFrames),
    subBassEnergy: clamp01(rawSubBass * 8),
    midEnergy: clamp01(rawMid * 4),
    highEnergy: clamp01(rawHigh * 6),
    spectralSpread: clamp01(rawSpectralSpread / (fftFrames[0]?.length ?? 1) * 3),
    stereoWidth: 0,
  };
}
