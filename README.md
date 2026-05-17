# Sound Of Wall

Turn sound into collectible artwork. Upload any audio file and the application analyzes its sonic characteristics — BPM, spectral profile, harmonic density, transient sharpness, dynamic range, and more — then generates deterministic procedural artwork that visually reflects those characteristics. The same audio file always produces the same artwork. No AI image generation is involved; every image is built from mathematical noise fields, geometry systems, and layered compositing driven entirely by the audio's feature vector.

## How It Works

1. **Upload** — drag and drop an audio file (MP3, WAV, FLAC, OGG, M4A, up to 100 MB).
2. **Analyze** — the browser decodes the audio, runs FFT-based spectral analysis, detects onsets and BPM, extracts 20 numerical features, and hashes the normalized waveform with SHA-256 to produce a deterministic seed.
3. **Generate** — the seed and feature vector drive a scene definition that selects one of 10 visual modes, one of 6 style presets, up to 22 composited overlay layers, and up to 9 post-processing effects. A Canvas2D renderer draws the artwork entirely client-side.
4. **Export** — download the finished artwork as a 4096 x 4096 PNG.

## Visual Modes

The audio features select one of 10 primary rendering modes:

| Mode | Aesthetic |
|------|-----------|
| waveform | Oscilloscope-style horizontal wave traces |
| fractal-tree | Recursive branching structures |
| constellation | Connected point networks (star map) |
| topographic | Contour lines from noise fields |
| expressionist | Bold gestural strokes and splatters |
| geometric | Clean circles, triangles, rectangles in grids |
| hatching | Dense parallel angled lines (engraving) |
| mosaic | Tessellated tiles (stained glass) |
| concentric | Organic concentric rings |
| scatter | Dense stippled marks (pointillist) |

Each image also stacks 2-6 randomly selected overlay layers from a pool of 22 (Voronoi tessellation, triangle tessellation, hex grids, crosshatch, wave interference, spiral overlays, grid distortion, barcode lines, bubble fields, circle packing, arc segments, dashed grids, noise contours, and more) and applies up to 9 post-processing effects (grain, glow, vignette, scanlines, posterization, edge highlighting, chromatic aberration, color shift, radial blur).

## Style Presets

Style presets are selected automatically from the audio features:

- **Ethereal** — soft glow, high symmetry, muted turbulence
- **Noir** — high contrast, heavy grain, desaturated palette
- **Brutalist** — thick lines, dense geometry, raw aesthetic
- **Psychedelic** — saturated colors, high turbulence, many particles
- **Minimal** — sparse elements, single accent color
- **Retro Futurist** — radial emphasis, warm glow, synthwave palette

## Tech Stack

### Frontend

| Package | Purpose |
|---------|---------|
| [Next.js 15](https://nextjs.org/) (App Router) | Framework, routing, serverless functions |
| [React 19](https://react.dev/) | UI library |
| [TypeScript 5](https://www.typescriptlang.org/) | Type safety |
| [Tailwind CSS 4](https://tailwindcss.com/) | Utility-first styling |
| [Framer Motion 12](https://www.framer.com/motion/) | Animations and transitions |
| [Zustand 5](https://zustand-demo.pmnd.rs/) | Client state management |

### Audio Analysis

| Package | Purpose |
|---------|---------|
| Web Audio API | Browser-native audio decoding |
| Custom FFT (Cooley-Tukey radix-2) | Spectral analysis |
| Custom onset detection | Beat and transient detection |
| SubtleCrypto (SHA-256) | Deterministic hashing |

### Rendering

| Package | Purpose |
|---------|---------|
| Canvas API | 2D procedural rendering |
| [simplex-noise 4](https://github.com/jwagner/simplex-noise.js) | Seeded simplex noise for FBM, turbulence, ridged noise |

### Backend / Storage

| Package | Purpose |
|---------|---------|
| [Neon Serverless](https://neon.tech/docs/serverless/serverless-driver) | PostgreSQL database (Vercel-compatible) |
| [Vercel Blob](https://vercel.com/docs/storage/vercel-blob) | Audio and artwork image storage |
| [uuid](https://www.npmjs.com/package/uuid) | Generation ID creation |

## Architecture

```
Browser                          Vercel (Serverless)
┌──────────────────────┐         ┌─────────────────────────┐
│ Audio Upload         │         │ POST /api/upload-url    │
│   ↓                  │────────→│   → Vercel Blob upload  │
│ Web Audio Decode     │         ├─────────────────────────┤
│   ↓                  │         │ POST /api/generate      │
│ FFT Feature Extract  │         │   → SHA-256 dedup check │
│   ↓                  │         │   → Neon INSERT         │
│ SHA-256 Hash         │         ├─────────────────────────┤
│   ↓                  │         │ GET /api/generation/:id │
│ Scene Generation     │         │   → Neon SELECT         │
│   ↓                  │         ├─────────────────────────┤
│ Canvas2D Render      │         │ GET /api/gallery        │
│   ↓                  │         │   → Neon paginated      │
│ PNG Export           │         ├─────────────────────────┤
│   ↓                  │         │ GET /api/init           │
│ Upload to Blob       │────────→│   → CREATE TABLE        │
└──────────────────────┘         └─────────────────────────┘
```

All heavy computation (audio analysis, rendering, export) happens in the browser. Serverless functions handle persistence and orchestration only.

## Project Structure

```
src/
  app/
    api/
      upload-url/route.ts    — Vercel Blob file upload
      generate/route.ts      — Scene generation + DB persistence
      generation/[id]/route.ts — Single generation lookup
      generation/[id]/image/route.ts — Artwork image upload
      gallery/route.ts       — Paginated gallery query
      init/route.ts          — Database schema initialization
    generate/page.tsx         — Upload → analyze → render workflow
    gallery/page.tsx          — Public artwork gallery
    image/[id]/page.tsx       — Single artwork view
    page.tsx                  — Landing page
  components/
    upload/AudioUploader.tsx  — Drag-and-drop file upload
    renderer/ArtworkCanvas.tsx — Canvas render display
    controls/StyleSelector.tsx — Style preset grid
    controls/ExportButton.tsx  — PNG download button
    gallery/GalleryGrid.tsx   — Responsive artwork grid
  lib/
    audio/analyzer.ts         — FFT, BPM detection, feature extraction
    rendering/scene-generator.ts — Audio features → scene definition
    rendering/renderer.ts     — Canvas2D rendering engine (10 modes, 22 overlays, 9 post-processing)
    hashing/index.ts          — SHA-256 audio hashing
    prng/index.ts             — Mulberry32 seeded PRNG
    noise/index.ts            — Simplex noise + FBM + turbulence + ridged noise
    geometry/index.ts         — Splines, Voronoi, particles, spirals, recursive curves
    palettes/index.ts         — 6 style-specific color palettes
    export/index.ts           — PNG export + high-res rendering
    db/index.ts               — Neon serverless connection
    device/index.ts           — Mobile detection + reduced motion
  store/index.ts              — Zustand application state
  workers/render.worker.ts    — Off-screen rendering worker
  middleware.ts               — API rate limiting (30 req/min per IP)
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm
- A [Neon](https://neon.tech/) PostgreSQL database (free tier works)
- A [Vercel Blob](https://vercel.com/docs/storage/vercel-blob) store (free tier works)

### Installation

```bash
git clone https://github.com/silentsoar/Sound-Of-Wall.git
cd Sound-Of-Wall
npm install
```

### Environment Variables

Copy the example and fill in your values:

```bash
cp .env.example .env.local
```

```env
DATABASE_URL=postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxx
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Database Setup

Start the dev server, then initialize the database tables:

```bash
npm run dev
```

Visit `http://localhost:3000/api/init` in your browser (or `curl http://localhost:3000/api/init`) to create the `generations` table and indexes.

### Development

```bash
npm run dev        # Start dev server
npm run typecheck  # Run TypeScript checks
npm run lint       # Run ESLint
npm run build      # Production build
```

## Deployment to Vercel

1. Push the repository to GitHub.
2. Import the project in the [Vercel dashboard](https://vercel.com/dashboard).
3. Vercel auto-detects Next.js — no configuration changes needed.
4. Add storage integrations:
   - **Storage → Create Database → Neon** — auto-sets `DATABASE_URL`.
   - **Storage → Create Blob Store** — auto-sets `BLOB_READ_WRITE_TOKEN`.
5. Add `NEXT_PUBLIC_APP_URL` pointing to your deployment URL.
6. After the first deploy, hit `https://your-domain.vercel.app/api/init` to create the database tables.

## Determinism

The same audio input always produces the same artwork. The pipeline is:

```
Audio bytes → normalize → FFT feature extraction → feature vector
                                                          ↓
Normalized waveform + feature vector → SHA-256 → deterministic seed
                                                          ↓
Seed + features → scene definition → Canvas2D render → identical pixel output
```

No `Math.random()` is used anywhere in the rendering pipeline. All randomness flows from the Mulberry32 seeded PRNG, which is initialized from the SHA-256 hash of the audio.

## Browser Support

- Chrome 90+
- Firefox 90+
- Safari 15.4+
- Edge 90+

Mobile devices automatically receive reduced render resolution (1024px max) and reduced particle counts. The `prefers-reduced-motion` media query disables animations.

## License

[GNU General Public License v3.0](LICENSE)
