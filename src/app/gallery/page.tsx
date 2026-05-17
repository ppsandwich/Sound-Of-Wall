'use client';
import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { GalleryGrid } from '@/components/gallery/GalleryGrid';
import type { Generation } from '@/types';

function SkeletonCard() {
  return (
    <div className="animate-pulse overflow-hidden rounded-xl border border-[#222] bg-[#0e0e18]">
      <div className="aspect-square bg-[#1a1a2e]" />
      <div className="flex items-center justify-between p-3">
        <div className="h-5 w-16 rounded-full bg-[#1a1a2e]" />
        <div className="h-4 w-12 rounded bg-[#1a1a2e]" />
      </div>
    </div>
  );
}

export default function GalleryPage() {
  const [items, setItems] = useState<Generation[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const pageSize = 12;

  const fetchGallery = useCallback(async (p: number) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/gallery?page=${p}&pageSize=${pageSize}`);
      const data = await res.json();
      setItems(data.generations);
      setTotal(data.total);
    } catch {
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGallery(page);
  }, [page, fetchGallery]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-12">
      <div className="mb-8 flex items-center justify-between">
        <Link href="/" className="text-sm text-[#888] transition-colors hover:text-[#e5e5e5]">
          ← Home
        </Link>
        <h1 className="text-lg font-bold">Gallery</h1>
        <Link href="/generate" className="text-sm text-[#5e239d] transition-colors hover:text-[#f61067]">
          Create →
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center gap-4 py-32 text-center"
        >
          <svg className="h-16 w-16 text-[#333]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v13.5A1.5 1.5 0 003.75 21z" />
          </svg>
          <p className="text-[#888]">No artworks yet. Be the first to create one!</p>
          <Link href="/generate">
            <span className="mt-2 inline-block rounded-xl bg-gradient-to-r from-[#5e239d] to-[#f61067] px-6 py-3 text-sm font-semibold text-white">
              Create Artwork
            </span>
          </Link>
        </motion.div>
      ) : (
        <>
          <GalleryGrid items={items} />

          {totalPages > 1 && (
            <div className="mt-12 flex items-center justify-center gap-4">
              <motion.button
                whileHover={page > 1 ? { scale: 1.05 } : {}}
                whileTap={page > 1 ? { scale: 0.95 } : {}}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className={`rounded-lg px-5 py-2 text-sm font-medium transition-colors ${
                  page > 1
                    ? 'border border-[#333] text-[#e5e5e5] hover:border-[#5e239d]'
                    : 'cursor-not-allowed border border-[#1a1a2e] text-[#333]'
                }`}
              >
                Previous
              </motion.button>

              <span className="text-sm text-[#888]">
                Page {page} of {totalPages}
              </span>

              <motion.button
                whileHover={page < totalPages ? { scale: 1.05 } : {}}
                whileTap={page < totalPages ? { scale: 0.95 } : {}}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className={`rounded-lg px-5 py-2 text-sm font-medium transition-colors ${
                  page < totalPages
                    ? 'border border-[#333] text-[#e5e5e5] hover:border-[#5e239d]'
                    : 'cursor-not-allowed border border-[#1a1a2e] text-[#333]'
                }`}
              >
                Next
              </motion.button>
            </div>
          )}
        </>
      )}
    </main>
  );
}
