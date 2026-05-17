'use client';
import { motion } from 'framer-motion';
import { useAppStore } from '@/store';
import type { StylePreset } from '@/types';
import { PALETTES } from '@/lib/palettes';

const STYLES: { key: StylePreset; label: string }[] = [
  { key: 'ethereal', label: 'Ethereal' },
  { key: 'noir', label: 'Noir' },
  { key: 'brutalist', label: 'Brutalist' },
  { key: 'psychedelic', label: 'Psychedelic' },
  { key: 'minimal', label: 'Minimal' },
  { key: 'retro-futurist', label: 'Retro Futurist' },
];

export function StyleSelector() {
  const { selectedStyle, setSelectedStyle } = useAppStore();

  return (
    <div className="w-full">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[#888]">
        Style
      </h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {STYLES.map(({ key, label }) => {
          const isSelected = selectedStyle === key;
          const palette = PALETTES[key];

          return (
            <motion.button
              key={key}
              type="button"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setSelectedStyle(key)}
              className={`
                relative flex flex-col items-start gap-2 rounded-xl border p-4
                text-left transition-colors duration-200
                ${
                  isSelected
                    ? 'border-[#f61067] bg-[#f61067]/10 shadow-[0_0_20px_rgba(246,16,103,0.15)]'
                    : 'border-[#222] bg-[#0e0e18] hover:border-[#5e239d] hover:bg-[#12121e]'
                }
              `}
            >
              {isSelected && (
                <motion.div
                  layoutId="style-indicator"
                  className="absolute -top-px -left-px -right-px h-[2px] rounded-t-xl"
                  style={{
                    background: 'linear-gradient(90deg, #5e239d, #f61067)',
                  }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}

              <div className="flex gap-1.5">
                {palette.slice(0, 5).map((color, i) => (
                  <div
                    key={i}
                    className="h-4 w-4 rounded-full border border-[#333]"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>

              <span
                className={`text-sm font-medium ${
                  isSelected ? 'text-[#f61067]' : 'text-[#e5e5e5]'
                }`}
              >
                {label}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
