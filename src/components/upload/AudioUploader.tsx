'use client';
import { useCallback, useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/store';

const ACCEPTED_TYPES = [
  'audio/mpeg',
  'audio/wav',
  'audio/flac',
  'audio/ogg',
  'audio/mp4',
  'audio/x-m4a',
];
const ACCEPTED_EXTENSIONS = ['.mp3', '.wav', '.flac', '.ogg', '.m4a'];
const MAX_FILE_SIZE = 100 * 1024 * 1024;

export function AudioUploader() {
  const { audioFile, audioUrl, setAudioFile, setAudioUrl } = useAppStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const validateFile = useCallback((file: File): string | null => {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    const hasValidType = ACCEPTED_TYPES.includes(file.type);
    const hasValidExt = ACCEPTED_EXTENSIONS.includes(ext);

    if (!hasValidType && !hasValidExt) {
      return 'Unsupported file type. Please upload MP3, WAV, FLAC, OGG, or M4A.';
    }
    if (file.size > MAX_FILE_SIZE) {
      return 'File exceeds 100MB limit.';
    }
    return null;
  }, []);

  const processFile = useCallback(
    (file: File) => {
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        return;
      }

      setError(null);
      setIsUploading(true);
      setUploadProgress(0);

      const url = URL.createObjectURL(file);

      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.random() * 25 + 10;
        if (progress >= 100) {
          progress = 100;
          clearInterval(interval);
          setUploadProgress(100);
          setTimeout(() => {
            setIsUploading(false);
            setAudioFile(file);
            setAudioUrl(url);
          }, 300);
        } else {
          setUploadProgress(progress);
        }
      }, 120);
    },
    [validateFile, setAudioFile, setAudioUrl]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
      e.target.value = '';
    },
    [processFile]
  );

  const handleRemove = useCallback(() => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioFile(null);
    setAudioUrl(null);
    setUploadProgress(0);
    setError(null);
  }, [audioUrl, setAudioFile, setAudioUrl]);

  return (
    <div className="w-full">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS.join(',')}
        className="hidden"
        onChange={handleFileChange}
      />

      <AnimatePresence mode="wait">
        {!audioUrl ? (
          <motion.div
            key="dropzone"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3 }}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={handleClick}
            className={`
              relative cursor-pointer rounded-xl border-2 border-dashed
              p-10 text-center transition-colors duration-300
              ${
                isDragging
                  ? 'border-[#f61067] bg-[#f61067]/10'
                  : 'border-[#333] bg-[#0a0a0f] hover:border-[#5e239d] hover:bg-[#5e239d]/5'
              }
            `}
          >
            {isDragging && (
              <motion.div
                className="pointer-events-none absolute inset-0 rounded-xl"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{
                  background:
                    'radial-gradient(circle at center, rgba(246,16,103,0.15) 0%, transparent 70%)',
                }}
              />
            )}

            <motion.div
              animate={isDragging ? { scale: 1.05 } : { scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="flex flex-col items-center gap-4"
            >
              <div
                className={`
                  flex h-16 w-16 items-center justify-center rounded-full
                  ${isDragging ? 'bg-[#f61067]/20' : 'bg-[#1a1a2e]'}
                `}
              >
                <svg
                  className={`h-8 w-8 ${isDragging ? 'text-[#f61067]' : 'text-[#5e239d]'}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 16V4m0 0L8 8m4-4l4 4M2 17l.621 2.485A2 2 0 004.561 21h14.878a2 2 0 001.94-1.515L22 17"
                  />
                </svg>
              </div>

              <div>
                <p className="text-sm font-medium text-[#e5e5e5]">
                  {isDragging ? 'Drop audio here' : 'Drag & drop audio file'}
                </p>
                <p className="mt-1 text-xs text-[#666]">
                  MP3, WAV, FLAC, OGG, M4A — max 100MB
                </p>
              </div>

              <motion.button
                type="button"
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                className="rounded-lg bg-[#5e239d] px-5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#f61067]"
                onClick={(e) => {
                  e.stopPropagation();
                  handleClick();
                }}
              >
                Browse files
              </motion.button>
            </motion.div>
          </motion.div>
        ) : (
          <motion.div
            key="preview"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3 }}
            className="rounded-xl border border-[#222] bg-[#0e0e18] p-6"
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#5e239d]/20">
                  <svg
                    className="h-5 w-5 text-[#f61067]"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-[#e5e5e5]">
                    {audioFile?.name}
                  </p>
                  <p className="text-xs text-[#666]">
                    {audioFile
                      ? `${(audioFile.size / (1024 * 1024)).toFixed(1)} MB`
                      : ''}
                  </p>
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={handleRemove}
                className="rounded-lg p-2 text-[#666] transition-colors hover:bg-[#f61067]/10 hover:text-[#f61067]"
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
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </motion.button>
            </div>

            <audio
              controls
              src={audioUrl}
              className="w-full [&::-webkit-media-controls-panel]:bg-[#1a1a2e]"
            />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isUploading && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 overflow-hidden"
          >
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#1a1a2e]">
              <motion.div
                className="h-full rounded-full"
                style={{
                  background: 'linear-gradient(90deg, #5e239d, #f61067)',
                }}
                initial={{ width: '0%' }}
                animate={{ width: `${uploadProgress}%` }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
              />
            </div>
            <p className="mt-2 text-center text-xs text-[#666]">
              Processing audio…
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="mt-3 rounded-lg border border-[#f61067]/30 bg-[#f61067]/10 px-4 py-3 text-sm text-[#f61067]"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
