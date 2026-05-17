'use client';
import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArtworkCanvas } from '@/components/renderer/ArtworkCanvas';
import { ExportButton } from '@/components/controls/ExportButton';
import type { Generation } from '@/types';

function FeatureRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-[#1a1a2e] py-2">
      <span className="text-xs text-[#888]">{label}</span>
      <span className="text-xs font-medium text-[#e5e5e5]">{value}</span>
    </div>
  );
}

export default function ImagePage() {
  const params = useParams();
  const id = params.id as string;
  const [generation, setGeneration] = useState<Generation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGeneration = useCallback(async () => {
    try {
      const res = await fetch(`/api/generation/${id}`);
      if (!res.ok) {
        setError('Artwork not found');
        return;
      }
      const data = await res.json();
      setGeneration(data);
    } catch {
      setError('Failed to load artwork');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchGeneration();
  }, [fetchGeneration]);

  if (isLoading) {
    return (
      <main className="mx-auto flex min-h-screen max-w-5xl items-center justify-center px-6">
        <div className="flex flex-col items-center gap-4">
          <motion.div
            className="h-10 w-10 rounded-full border-2 border-[#5e239d]/30"
            style={{ borderTopColor: '#f61067' }}
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
          />
          <p className="text-sm text-[#888]">Loading artwork…</p>
        </div>
      </main>
    );
  }

  if (error || !generation) {
    return (
      <main className="mx-auto flex min-h-screen max-w-5xl items-center justify-center px-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <svg className="h-16 w-16 text-[#333]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <p className="text-[#888]">{error ?? 'Artwork not found'}</p>
          <Link href="/gallery">
            <span className="mt-2 inline-block rounded-xl border border-[#333] px-6 py-3 text-sm font-medium text-[#e5e5e5] transition-colors hover:border-[#5e239d]">
              Back to Gallery
            </span>
          </Link>
        </div>
      </main>
    );
  }

  const features = generation.featureVector;

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-12">
      <div className="mb-8 flex items-center justify-between">
        <Link href="/gallery" className="text-sm text-[#888] transition-colors hover:text-[#e5e5e5]">
          ← Gallery
        </Link>
        <h1 className="text-lg font-bold">Artwork</h1>
        <div className="w-16" />
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
        <div className="lg:col-span-3">
          {generation.imageUrl ? (
            <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl border border-[#222] bg-[#0a0a0f]">
              <img
                src={generation.imageUrl}
                alt={`Artwork — ${generation.stylePreset}`}
                className="h-full w-full object-contain"
              />
            </div>
          ) : (
            <ArtworkCanvas sceneDefinition={generation.sceneDefinition} />
          )}
        </div>

        <div className="lg:col-span-2">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="space-y-6"
          >
            <div>
              <span
                className="inline-block rounded-full border px-3 py-1 text-xs font-medium"
                style={{
                  color: '#f61067',
                  borderColor: 'rgba(246,16,103,0.3)',
                  backgroundColor: 'rgba(246,16,103,0.1)',
                }}
              >
                {generation.stylePreset.replace('-', ' ')}
              </span>
              <p className="mt-3 text-xs text-[#666]">
                Created {new Date(generation.createdAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
              <p className="mt-1 text-xs text-[#555]">
                Seed: {generation.seed}
              </p>
            </div>

            <div>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#888]">
                Audio Features
              </h3>
              <div className="rounded-xl border border-[#222] bg-[#0e0e18] p-4">
                <FeatureRow label="BPM" value={features.bpm.toFixed(1)} />
                <FeatureRow label="Brightness" value={(features.brightness * 100).toFixed(1) + '%'} />
                <FeatureRow label="Warmth" value={(features.warmth * 100).toFixed(1) + '%'} />
                <FeatureRow label="Noisiness" value={(features.noisiness * 100).toFixed(1) + '%'} />
                <FeatureRow label="Beat Density" value={features.beatDensity.toFixed(2)} />
                <FeatureRow label="Harmonic Density" value={(features.harmonicDensity * 100).toFixed(1) + '%'} />
                <FeatureRow label="Loudness" value={features.loudness.toFixed(1) + ' dB'} />
                <FeatureRow label="Dynamic Range" value={features.dynamicRange.toFixed(1) + ' dB'} />
                <FeatureRow label="Rhythmic Complexity" value={(features.rhythmicComplexity * 100).toFixed(1) + '%'} />
                <FeatureRow label="Repetition" value={(features.repetition * 100).toFixed(1) + '%'} />
              </div>
            </div>

            <ExportButton sceneDefinition={generation.sceneDefinition} />

            <div className="flex gap-3">
              <Link href="/generate" className="flex-1">
                <motion.span
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center justify-center rounded-xl bg-gradient-to-r from-[#5e239d] to-[#f61067] py-3 text-sm font-semibold text-white"
                >
                  Create Your Own
                </motion.span>
              </Link>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  if (navigator.share) {
                    navigator.share({
                      title: 'Sound Of Wall Artwork',
                      url: window.location.href,
                    }).catch(() => {});
                  } else {
                    navigator.clipboard.writeText(window.location.href);
                  }
                }}
                className="rounded-xl border border-[#333] px-4 py-3 text-sm text-[#888] transition-colors hover:border-[#5e239d] hover:text-[#e5e5e5]"
              >
                Share
              </motion.button>
            </div>
          </motion.div>
        </div>
      </div>
    </main>
  );
}
