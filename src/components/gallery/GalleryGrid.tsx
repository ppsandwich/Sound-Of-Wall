'use client';
import { motion } from 'framer-motion';
import Link from 'next/link';
import type { Generation } from '@/types';

interface GalleryGridProps {
  items: Generation[];
}

const STYLE_COLORS: Record<string, string> = {
  ethereal: '#9b59b6',
  noir: '#c0c0c0',
  brutalist: '#ff3333',
  psychedelic: '#ff006e',
  minimal: '#ffffff',
  'retro-futurist': '#ff6b35',
};

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 24, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const },
  },
};

export function GalleryGrid({ items }: GalleryGridProps) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-[#444]">
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
        <p className="text-sm">No artworks in gallery yet</p>
      </div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      {items.map((item) => (
        <motion.div key={item.id} variants={cardVariants}>
          <Link href={`/image/${item.id}`} className="group block">
            <motion.div
              whileHover={{ scale: 1.03 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="relative overflow-hidden rounded-xl border border-[#222] bg-[#0e0e18] transition-shadow duration-300 group-hover:shadow-[0_0_30px_rgba(94,35,157,0.2)]"
            >
              <div className="aspect-square overflow-hidden bg-[#0a0a0f]">
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={`Artwork — ${item.stylePreset}`}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[#333]">
                    <svg
                      className="h-10 w-10"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5"
                      />
                    </svg>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between p-3">
                <span
                  className="rounded-full border px-2.5 py-0.5 text-xs font-medium"
                  style={{
                    color: STYLE_COLORS[item.stylePreset] ?? '#e5e5e5',
                    borderColor: (STYLE_COLORS[item.stylePreset] ?? '#333') + '40',
                    backgroundColor: (STYLE_COLORS[item.stylePreset] ?? '#333') + '15',
                  }}
                >
                  {item.stylePreset.replace('-', ' ')}
                </span>
                <span className="text-xs text-[#555]">
                  {new Date(item.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </div>
            </motion.div>
          </Link>
        </motion.div>
      ))}
    </motion.div>
  );
}
