'use client';
import { useRef, useEffect, useState } from 'react';
import { motion, useInView } from 'framer-motion';
import Link from 'next/link';
import { generateScene } from '@/lib/rendering/scene-generator';
import { renderArtwork } from '@/lib/rendering/renderer';
import { GalleryGrid } from '@/components/gallery/GalleryGrid';
import type { AudioFeatures, Generation } from '@/types';

const PLACEHOLDER_FEATURES: AudioFeatures = {
  bpm: 120,
  beatDensity: 0.5,
  transientSharpness: 0.4,
  rhythmicComplexity: 0.5,
  spectralCentroid: 0.5,
  brightness: 0.6,
  warmth: 0.5,
  noisiness: 0.3,
  harmonicDensity: 0.5,
  loudness: 0.3,
  dynamicRange: 0.4,
  energyEvolution: [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.7, 0.6],
  repetition: 0.4,
  transitionDensity: 0.5,
  tensionCurves: [0.3, 0.5, 0.7, 0.6, 0.8, 0.5, 0.4, 0.6],
  subBassEnergy: 0.3,
  midEnergy: 0.5,
  highEnergy: 0.4,
  spectralSpread: 0.5,
  stereoWidth: 0,
};

const STEPS = [
  {
    icon: '🎵',
    title: 'Upload Audio',
    description: 'Drop any audio file — MP3, WAV, FLAC, OGG, or M4A. We support files up to 100MB.',
  },
  {
    icon: '🔬',
    title: 'Analyze & Hash',
    description: 'Our engine extracts spectral, rhythmic, and harmonic features, then generates a deterministic hash.',
  },
  {
    icon: '🎨',
    title: 'Generate Artwork',
    description: 'The hash seeds a procedural renderer that produces a unique piece of art — every time, the same result.',
  },
];

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.15 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] as const } },
};

function HeroBackground() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const scene = generateScene(42, PLACEHOLDER_FEATURES, 'ethereal');
    const canvas = renderArtwork({ width: 512, height: 512, scene });
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.objectFit = 'cover';
    canvas.style.opacity = '0.3';
    canvas.style.filter = 'blur(2px)';
    container.appendChild(canvas);
    return () => { canvas.remove(); };
  }, []);

  return <div ref={containerRef} className="absolute inset-0 overflow-hidden" />;
}

function AnimatedSection({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] as const }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

const PLACEHOLDER_GRADIENTS = [
  'linear-gradient(135deg, #1e1033, #5e239d, #f61067)',
  'linear-gradient(135deg, #0a0a0a, #333333, #8b0000)',
  'linear-gradient(135deg, #2d2d2d, #ff3333, #ffcc00)',
  'linear-gradient(135deg, #0d0221, #ff006e, #8338ec)',
  'linear-gradient(135deg, #0f0f0f, #2a2a2a, #e63946)',
  'linear-gradient(135deg, #0c0032, #240090, #ff6b35)',
];

export default function HomePage() {
  const [galleryItems, setGalleryItems] = useState<Generation[]>([]);

  useEffect(() => {
    fetch('/api/gallery?page=1&pageSize=6')
      .then((res) => res.json())
      .then((data) => setGalleryItems(data.generations ?? []))
      .catch(() => {});
  }, []);

  return (
    <main className="min-h-screen">
      <section className="relative flex min-h-screen items-center justify-center overflow-hidden">
        <HeroBackground />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0f]/70 via-[#0a0a0f]/50 to-[#0a0a0f]" />

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="relative z-10 mx-auto max-w-3xl px-6 text-center"
        >
          <motion.h1
            variants={itemVariants}
            className="text-4xl font-bold tracking-tight sm:text-6xl lg:text-7xl"
          >
            Turn sound into{' '}
            <span className="bg-gradient-to-r from-[#5e239d] to-[#f61067] bg-clip-text text-transparent">
              collectible artwork
            </span>
            .
          </motion.h1>

          <motion.p
            variants={itemVariants}
            className="mx-auto mt-6 max-w-xl text-base text-[#999] sm:text-lg"
          >
            Upload any audio. Our deterministic engine transforms it into unique procedural
            art — the same sound always creates the same masterpiece.
          </motion.p>

          <motion.div variants={itemVariants} className="mt-10">
            <Link href="/generate">
              <motion.span
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.97 }}
                className="inline-block cursor-pointer rounded-xl bg-gradient-to-r from-[#5e239d] to-[#f61067] px-8 py-4 text-sm font-semibold text-white shadow-[0_0_30px_rgba(246,16,103,0.3)] transition-shadow hover:shadow-[0_0_40px_rgba(246,16,103,0.5)]"
              >
                Create Your Artwork
              </motion.span>
            </Link>
          </motion.div>
        </motion.div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-24">
        <AnimatedSection>
          <h2 className="mb-12 text-center text-2xl font-bold sm:text-3xl">
            Recent Creations
          </h2>
        </AnimatedSection>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {galleryItems.length > 0 ? (
            <div className="col-span-full">
              <GalleryGrid items={galleryItems} />
            </div>
          ) : (
            PLACEHOLDER_GRADIENTS.map((gradient, i) => (
              <AnimatedSection key={i}>
                <motion.div
                  whileHover={{ scale: 1.03 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  className="group relative aspect-square overflow-hidden rounded-xl border border-[#222] bg-[#0e0e18]"
                >
                  <div
                    className="absolute inset-0 opacity-40 transition-opacity duration-500 group-hover:opacity-60"
                    style={{ background: gradient }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    <span className="rounded-full bg-[#0a0a0f]/60 px-4 py-2 text-xs font-medium text-[#e5e5e5] backdrop-blur-sm">
                      Preview
                    </span>
                  </div>
                </motion.div>
              </AnimatedSection>
            ))
          )}
        </div>

        <AnimatedSection className="mt-10 text-center">
          <Link href="/gallery">
            <span className="text-sm font-medium text-[#5e239d] transition-colors hover:text-[#f61067]">
              View Gallery →
            </span>
          </Link>
        </AnimatedSection>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-24">
        <AnimatedSection>
          <h2 className="mb-16 text-center text-2xl font-bold sm:text-3xl">
            How It Works
          </h2>
        </AnimatedSection>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <AnimatedSection key={i}>
              <motion.div
                whileHover={{ y: -4 }}
                className="flex flex-col items-center gap-4 rounded-xl border border-[#222] bg-[#0e0e18] p-8 text-center"
              >
                <span className="text-4xl">{step.icon}</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#5e239d]/20 text-xs font-bold text-[#f61067]">
                  {i + 1}
                </div>
                <h3 className="text-lg font-semibold text-[#e5e5e5]">{step.title}</h3>
                <p className="text-sm leading-relaxed text-[#888]">{step.description}</p>
              </motion.div>
            </AnimatedSection>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-24 text-center">
        <AnimatedSection>
          <h2 className="text-2xl font-bold sm:text-3xl">
            Deterministic. Procedural.{' '}
            <span className="bg-gradient-to-r from-[#5e239d] to-[#f61067] bg-clip-text text-transparent">
              Non-AI.
            </span>
          </h2>
        </AnimatedSection>

        <AnimatedSection className="mt-8 space-y-6">
          <p className="text-[#999]">
            Every audio file produces identical artwork every time. Upload the same file
            twice — you get the exact same piece. No randomness, no AI hallucination. Pure
            mathematical determinism.
          </p>
          <p className="text-[#999]">
            Unlike AI image generators that blend training data, our engine uses procedural
            rendering driven by your audio&apos;s spectral fingerprint. The result is truly
            one-of-a-kind — a visual signature of your sound.
          </p>
        </AnimatedSection>

        <AnimatedSection className="mt-12">
          <Link href="/generate">
            <motion.span
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
              className="inline-block cursor-pointer rounded-xl border border-[#5e239d] px-8 py-4 text-sm font-semibold text-[#e5e5e5] transition-colors hover:border-[#f61067] hover:text-[#f61067]"
            >
              Try It Now
            </motion.span>
          </Link>
        </AnimatedSection>
      </section>
    </main>
  );
}
