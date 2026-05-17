'use client';
import { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { SceneDefinition } from '@/types';
import { renderArtwork } from '@/lib/rendering/renderer';
import { getOptimalRenderSize, prefersReducedMotion } from '@/lib/device';

interface ArtworkCanvasProps {
  sceneDefinition: SceneDefinition | null;
  onRenderComplete?: (canvas: HTMLCanvasElement) => void;
}

export function ArtworkCanvas({ sceneDefinition, onRenderComplete }: ArtworkCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const reducedMotion = prefersReducedMotion();

  useEffect(() => {
    if (!sceneDefinition || !containerRef.current) return;

    setIsRendering(true);
    setIsComplete(false);
    setRenderProgress(0);

    const container = containerRef.current;
    const containerSize = Math.min(container.clientWidth, container.clientHeight);
    const size = getOptimalRenderSize(containerSize);

    const rafId = requestAnimationFrame(() => {
      const canvas = renderArtwork({
        width: size,
        height: size,
        scene: sceneDefinition,
        onProgress: (p) => setRenderProgress(p),
      });

      if (canvasRef.current) {
        canvasRef.current.remove();
      }

      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.objectFit = 'contain';
      canvasRef.current = canvas;
      container.appendChild(canvas);

      setIsRendering(false);
      setIsComplete(true);
      onRenderComplete?.(canvas);
    });

    return () => {
      cancelAnimationFrame(rafId);
      if (canvasRef.current) {
        canvasRef.current.remove();
        canvasRef.current = null;
      }
    };
  }, [sceneDefinition, onRenderComplete]);

  return (
    <div
      ref={containerRef}
      className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl border border-[#222] bg-[#0a0a0f]"
    >
      <AnimatePresence>
        {isRendering && (
          <motion.div
            key="spinner"
            initial={reducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-[#0a0a0f]/80 backdrop-blur-sm"
          >
            <div className="relative h-12 w-12">
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-[#5e239d]/30"
                style={{ borderTopColor: '#f61067' }}
                animate={reducedMotion ? {} : { rotate: 360 }}
                transition={reducedMotion ? undefined : { repeat: Infinity, duration: 1, ease: 'linear' }}
              />
              <motion.div
                className="absolute inset-2 rounded-full border-2 border-[#f61067]/30"
                style={{ borderBottomColor: '#5e239d' }}
                animate={reducedMotion ? {} : { rotate: -360 }}
                transition={reducedMotion ? undefined : { repeat: Infinity, duration: 1.5, ease: 'linear' }}
              />
            </div>

            <div className="w-48">
              <div className="h-1 w-full overflow-hidden rounded-full bg-[#1a1a2e]">
                <motion.div
                  className="h-full rounded-full"
                  style={{
                    background: 'linear-gradient(90deg, #5e239d, #f61067)',
                  }}
                  animate={{ width: `${renderProgress * 100}%` }}
                  transition={{ duration: reducedMotion ? 0 : 0.15 }}
                />
              </div>
              <p className="mt-2 text-center text-xs text-[#666]">
                Rendering artwork…
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!sceneDefinition && !isRendering && !isComplete && (
          <motion.div
            initial={reducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-3 text-[#444]"
          >
            <svg
              className="h-12 w-12"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v13.5A1.5 1.5 0 003.75 21z"
              />
            </svg>
            <p className="text-sm">No artwork generated yet</p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isComplete && (
          <motion.div
            initial={reducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: reducedMotion ? 0 : 0.6 }}
            className="absolute inset-0 pointer-events-none"
          />
        )}
      </AnimatePresence>
    </div>
  );
}
