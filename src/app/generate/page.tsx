'use client';
import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useAppStore } from '@/store';
import { AudioUploader } from '@/components/upload/AudioUploader';
import { ArtworkCanvas } from '@/components/renderer/ArtworkCanvas';
import { ExportButton } from '@/components/controls/ExportButton';
import { extractFeatures, decodeAudioFile, normalizeAudioBuffer } from '@/lib/audio';
import { hashAudio, hashToSeed } from '@/lib/hashing';
import { generateScene } from '@/lib/rendering/scene-generator';
import { canvasToBlob } from '@/lib/export';

const STEPS = ['Upload', 'Analyze', 'Generate'];

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-2">
      {STEPS.map((label, i) => (
        <div key={label} className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                i < current
                  ? 'bg-[#f61067] text-white'
                  : i === current
                    ? 'bg-[#5e239d] text-white'
                    : 'bg-[#1a1a2e] text-[#555]'
              }`}
            >
              {i < current ? '✓' : i + 1}
            </div>
            <span
              className={`hidden text-xs sm:inline ${
                i <= current ? 'text-[#e5e5e5]' : 'text-[#555]'
              }`}
            >
              {label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div
              className={`mx-1 h-px w-8 sm:w-12 ${
                i < current ? 'bg-[#f61067]' : 'bg-[#222]'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

const ANALYSIS_STEPS = [
  'Decoding audio…',
  'Extracting spectral features…',
  'Analyzing rhythm & beats…',
  'Computing harmonic density…',
  'Building energy evolution…',
  'Generating audio hash…',
];

export default function GeneratePage() {
  const [step, setStep] = useState(0);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [analysisProgress, setAnalysisProgress] = useState(0);

  const {
    audioFile,
    audioUrl,
    audioFeatures,
    audioHash,
    sceneDefinition,
    setAudioFeatures,
    setAudioHash,
    setSceneDefinition,
    setGenerationId,
    setUploadedAudioUrl,
    setIsGenerating,
    setIsAnalyzing,
    reset,
  } = useAppStore();

  const handleAnalyze = useCallback(async () => {
    if (!audioFile) return;

    setStep(1);
    setIsAnalyzing(true);
    setAnalysisProgress(0);
    setAnalysisStep(0);

    try {
      // Upload to blob storage in parallel with analysis
      const uploadPromise = (async () => {
        const formData = new FormData();
        formData.append('file', audioFile);
        const res = await fetch('/api/upload-url', { method: 'POST', body: formData });
        if (res.ok) {
          const data = await res.json();
          setUploadedAudioUrl(data.url);
        }
      })();

      setAnalysisStep(0);
      setAnalysisProgress(0.05);
      const buffer = await decodeAudioFile(audioFile);

      setAnalysisStep(1);
      setAnalysisProgress(0.15);
      await new Promise((r) => setTimeout(r, 300));

      setAnalysisStep(2);
      setAnalysisProgress(0.3);
      const features = await extractFeatures(buffer);

      setAnalysisStep(3);
      setAnalysisProgress(0.5);
      await new Promise((r) => setTimeout(r, 200));
      setAudioFeatures(features);

      setAnalysisStep(4);
      setAnalysisProgress(0.7);
      await new Promise((r) => setTimeout(r, 200));

      setAnalysisStep(5);
      setAnalysisProgress(0.85);
      const normalized = normalizeAudioBuffer(buffer);
      const hash = await hashAudio(normalized, features);
      setAudioHash(hash);

      setAnalysisProgress(1);
      await uploadPromise;
      await new Promise((r) => setTimeout(r, 300));

      setStep(2);
      setIsAnalyzing(false);

      const seed = hashToSeed(hash);
      const scene = generateScene(seed, features);
      console.log('[SOW] Audio Features:', JSON.stringify(features, null, 2));
      console.log('[SOW] Seed:', seed, 'Visual Mode:', scene.visualMode, 'Style:', scene.stylePreset, 'Density:', scene.density.toFixed(2), 'Complexity:', scene.complexity.toFixed(2), 'Scale:', scene.scale.toFixed(2), 'ScaleRange:', scene.scaleMin.toFixed(2), '-', scene.scaleMax.toFixed(2));
      setIsGenerating(true);

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioHash: hash,
          featureVector: features,
          stylePreset: scene.stylePreset,
          filename: audioFile?.name,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setGenerationId(data.generationId);
      }
      setIsGenerating(false);

      setSceneDefinition(scene);
    } catch (err) {
      console.error('Analysis failed:', err);
    } finally {
      setIsAnalyzing(false);
    }
  }, [audioFile, setAudioFeatures, setAudioHash, setUploadedAudioUrl, setIsAnalyzing, setSceneDefinition, setGenerationId, setIsGenerating]);

  const handleRenderComplete = useCallback(async (canvas: HTMLCanvasElement) => {
    const genId = useAppStore.getState().generationId;
    if (!genId) return;

    try {
      const fullBlob = await canvasToBlob(canvas);

      const thumbCanvas = document.createElement('canvas');
      thumbCanvas.width = 512;
      thumbCanvas.height = 512;
      const thumbCtx = thumbCanvas.getContext('2d')!;
      thumbCtx.drawImage(canvas, 0, 0, 512, 512);
      const thumbBlob = await canvasToBlob(thumbCanvas, 'image/jpeg', 0.85);

      const formData = new FormData();
      formData.append('image', fullBlob, 'artwork.png');
      formData.append('thumbnail', thumbBlob, 'artwork-512.jpg');

      const res = await fetch(`/api/generation/${genId}/image`, {
        method: 'POST',
        body: formData,
      });
      const result = await res.json();
      if (!res.ok) {
        console.error('Image upload failed:', result);
      } else {
        console.log('[SOW] Image stored:', result.url?.substring(0, 60));
      }
    } catch (err) {
      console.error('Failed to store artwork image:', err);
    }
  }, []);

  const handleStartOver = useCallback(() => {
    reset();
    setStep(0);
    setAnalysisStep(0);
    setAnalysisProgress(0);
  }, [reset]);

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-12">
      <div className="mb-8 flex items-center justify-between">
        <Link href="/" className="text-sm text-[#888] transition-colors hover:text-[#e5e5e5]">
          ← Home
        </Link>
        <h1 className="text-lg font-bold">Create Artwork</h1>
        <div className="w-16" />
      </div>

      <div className="mb-12">
        <StepIndicator current={step} />
      </div>

      <AnimatePresence mode="wait">
        {step === 0 && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="mx-auto max-w-xl"
          >
            <h2 className="mb-2 text-xl font-bold">Upload Audio</h2>
            <p className="mb-8 text-sm text-[#888]">
              Choose an audio file to transform into artwork.
            </p>

            <AudioUploader />

            <div className="mt-8 flex justify-end">
              <motion.button
                whileHover={audioFile ? { scale: 1.03 } : {}}
                whileTap={audioFile ? { scale: 0.97 } : {}}
                onClick={handleAnalyze}
                disabled={!audioFile}
                className={`rounded-xl px-8 py-3 text-sm font-semibold transition-colors ${
                  audioFile
                    ? 'bg-gradient-to-r from-[#5e239d] to-[#f61067] text-white'
                    : 'cursor-not-allowed bg-[#1a1a2e] text-[#555]'
                }`}
              >
                Next
              </motion.button>
            </div>
          </motion.div>
        )}

        {step === 1 && (
          <motion.div
            key="analyze"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="mx-auto max-w-xl"
          >
            <h2 className="mb-2 text-xl font-bold">Analyzing Audio</h2>
            <p className="mb-8 text-sm text-[#888]">
              Extracting features from your audio file…
            </p>

            <div className="space-y-4">
              {ANALYSIS_STEPS.map((label, i) => (
                <motion.div
                  key={label}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{
                    opacity: i <= analysisStep ? 1 : 0.3,
                    x: 0,
                  }}
                  transition={{ delay: i * 0.05, duration: 0.3 }}
                  className="flex items-center gap-3"
                >
                  <div
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                      i < analysisStep
                        ? 'bg-[#f61067] text-white'
                        : i === analysisStep
                          ? 'bg-[#5e239d] text-white'
                          : 'bg-[#1a1a2e] text-[#555]'
                    }`}
                  >
                    {i < analysisStep ? '✓' : i === analysisStep ? '○' : '·'}
                  </div>
                  <span className={`text-sm ${i <= analysisStep ? 'text-[#e5e5e5]' : 'text-[#555]'}`}>
                    {label}
                  </span>
                </motion.div>
              ))}
            </div>

            <div className="mt-8">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#1a1a2e]">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: 'linear-gradient(90deg, #5e239d, #f61067)' }}
                  initial={{ width: '0%' }}
                  animate={{ width: `${analysisProgress * 100}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            key="render"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="mx-auto max-w-2xl"
          >
            <h2 className="mb-2 text-xl font-bold">Your Artwork</h2>
            <p className="mb-8 text-sm text-[#888]">
              Generated from your audio — style selected automatically.
            </p>

            <ArtworkCanvas sceneDefinition={sceneDefinition} onRenderComplete={handleRenderComplete} />

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <div className="flex-1">
                <ExportButton sceneDefinition={sceneDefinition} />
              </div>
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleStartOver}
                className="rounded-xl border border-[#333] px-6 py-3.5 text-sm font-semibold text-[#888] transition-colors hover:border-[#f61067] hover:text-[#f61067]"
              >
                Start Over
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
