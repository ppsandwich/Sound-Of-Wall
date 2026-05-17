'use client';
import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { SceneDefinition } from '@/types';
import { renderHighRes, exportToPNG } from '@/lib/export';

interface ExportButtonProps {
  sceneDefinition: SceneDefinition | null;
}

export function ExportButton({ sceneDefinition }: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleExport = useCallback(() => {
    if (!sceneDefinition || isExporting) return;

    setIsExporting(true);
    setProgress(0);

    const steps = 20;
    let step = 0;
    const interval = setInterval(() => {
      step++;
      setProgress((step / steps) * 90);
      if (step >= steps) clearInterval(interval);
    }, 600);

    requestAnimationFrame(() => {
      try {
        const canvas = renderHighRes(sceneDefinition, 4096);
        setProgress(95);
        exportToPNG(canvas, `sound-of-wall-${Date.now()}.png`);
        setProgress(100);
        setTimeout(() => {
          setIsExporting(false);
          setProgress(0);
        }, 800);
      } catch {
        setIsExporting(false);
        setProgress(0);
      }
    });
  }, [sceneDefinition, isExporting]);

  return (
    <div className="w-full">
      <motion.button
        type="button"
        whileHover={!isExporting && sceneDefinition ? { scale: 1.02 } : {}}
        whileTap={!isExporting && sceneDefinition ? { scale: 0.98 } : {}}
        onClick={handleExport}
        disabled={!sceneDefinition || isExporting}
        className={`
          relative w-full overflow-hidden rounded-xl border py-3.5 text-sm font-semibold
          transition-colors duration-200
          ${
            sceneDefinition && !isExporting
              ? 'border-[#5e239d] bg-[#5e239d]/20 text-[#e5e5e5] hover:bg-[#f61067]/20 hover:border-[#f61067]'
              : 'border-[#222] bg-[#111] text-[#555] cursor-not-allowed'
          }
        `}
      >
        <AnimatePresence mode="wait">
          {isExporting ? (
            <motion.span
              key="exporting"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-center gap-2"
            >
              <motion.div
                className="h-4 w-4 rounded-full border-2 border-[#5e239d]/30"
                style={{ borderTopColor: '#f61067' }}
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
              />
              Exporting… {Math.round(progress)}%
            </motion.span>
          ) : (
            <motion.span
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-center gap-2"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
                />
              </svg>
              Export 4K PNG
            </motion.span>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isExporting && (
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: progress / 100 }}
              exit={{ opacity: 0 }}
              className="absolute bottom-0 left-0 right-0 h-[2px] origin-left"
              style={{
                background: 'linear-gradient(90deg, #5e239d, #f61067)',
              }}
            />
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
}
