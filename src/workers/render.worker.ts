import { SceneDefinition } from '@/types';
import { createRNG, RNG } from '@/lib/prng';
import { seededNoise2D, createFBM, createTurbulence, NoiseFunction2D } from '@/lib/noise';
import {
  generateSplinePoints,
  generateRadialPoints,
  generateVoronoiSeeds,
  generateParticleField,
  generateRecursiveCurve,
  generateSpiralPoints,
  Point,
  VoronoiSeed,
} from '@/lib/geometry';

// ==================== Message Types ====================

interface RenderMessage {
  type: 'render';
  scene: SceneDefinition;
  width: number;
  height: number;
}

interface ExportMessage {
  type: 'export';
  scene: SceneDefinition;
  size: number;
}

type WorkerMessage = RenderMessage | ExportMessage;

interface RenderResult {
  type: 'render-result';
  imageBitmap: ImageBitmap;
}

interface ExportResult {
  type: 'export-result';
  blob: Blob;
}

interface ErrorResult {
  type: 'error';
  message: string;
}

type WorkerResult = RenderResult | ExportResult | ErrorResult;

// ==================== Canvas Context Type ====================

type Ctx2D = OffscreenCanvasRenderingContext2D;

// ==================== Color Utilities ====================

function parseHexColor(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function hexToRGBA(hex: string, alpha: number): string {
  const [r, g, b] = parseHexColor(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

function lerpColor(color1: string, color2: string, t: number): string {
  const [r1, g1, b1] = parseHexColor(color1);
  const [r2, g2, b2] = parseHexColor(color2);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// ==================== Geometry Helpers ====================

function getEnergyAt(energyCurve: number[], x: number, width: number): number {
  if (energyCurve.length === 0) return 0.5;
  const t = Math.max(0, Math.min(1, x / width));
  const idx = t * (energyCurve.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.min(lo + 1, energyCurve.length - 1);
  const frac = idx - lo;
  return energyCurve[lo] * (1 - frac) + energyCurve[hi] * frac;
}

// ==================== Drawing Helpers ====================

function drawSpline(
  ctx: Ctx2D,
  points: Point[],
  tension: number,
  color: string,
  width: number
): void {
  if (points.length < 2) return;

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);

  if (points.length === 2) {
    ctx.lineTo(points[1].x, points[1].y);
  } else if (points.length === 3) {
    ctx.quadraticCurveTo(points[1].x, points[1].y, points[2].x, points[2].y);
  } else {
    const tau = Math.max(0.05, tension);
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(0, i - 1)];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[Math.min(points.length - 1, i + 2)];

      const cp1x = p1.x + (tau * (p2.x - p0.x)) / 6;
      const cp1y = p1.y + (tau * (p2.y - p0.y)) / 6;
      const cp2x = p2.x - (tau * (p3.x - p1.x)) / 6;
      const cp2y = p2.y - (tau * (p3.y - p1.y)) / 6;

      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
    }
  }

  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
}

function drawVoronoiCells(
  ctx: Ctx2D,
  seeds: VoronoiSeed[],
  width: number,
  height: number,
  colors: string[]
): void {
  if (seeds.length === 0) return;

  const blockSize = Math.max(4, Math.min(8, Math.floor(Math.min(width, height) / 200)));
  const gridW = Math.ceil(width / blockSize);
  const gridH = Math.ceil(height / blockSize);
  const nearest = new Int32Array(gridW * gridH);

  for (let gy = 0; gy < gridH; gy++) {
    for (let gx = 0; gx < gridW; gx++) {
      const px = gx * blockSize + blockSize / 2;
      const py = gy * blockSize + blockSize / 2;
      let minDist = Infinity;
      let minIdx = 0;
      for (let s = 0; s < seeds.length; s++) {
        const dx = px - seeds[s].x;
        const dy = py - seeds[s].y;
        const d = dx * dx + dy * dy;
        if (d < minDist) {
          minDist = d;
          minIdx = s;
        }
      }
      nearest[gy * gridW + gx] = minIdx;
    }
  }

  for (let gy = 0; gy < gridH; gy++) {
    for (let gx = 0; gx < gridW; gx++) {
      const seedIdx = nearest[gy * gridW + gx];
      ctx.fillStyle = hexToRGBA(colors[seedIdx % colors.length], 0.06);
      ctx.fillRect(gx * blockSize, gy * blockSize, blockSize, blockSize);
    }
  }

  const edgeColor = colors[Math.min(3, colors.length - 1)];
  for (let gy = 0; gy < gridH; gy++) {
    for (let gx = 0; gx < gridW; gx++) {
      const idx = nearest[gy * gridW + gx];
      if (gx < gridW - 1 && nearest[gy * gridW + gx + 1] !== idx) {
        ctx.fillStyle = hexToRGBA(edgeColor, 0.2);
        ctx.fillRect((gx + 1) * blockSize - 1, gy * blockSize, 1, blockSize);
      }
      if (gy < gridH - 1 && nearest[(gy + 1) * gridW + gx] !== idx) {
        ctx.fillStyle = hexToRGBA(edgeColor, 0.2);
        ctx.fillRect(gx * blockSize, (gy + 1) * blockSize - 1, blockSize, 1);
      }
    }
  }
}

function drawParticles(
  ctx: Ctx2D,
  particles: Point[],
  colors: string[],
  sizeRange: [number, number],
  rng: RNG,
  noiseFn: NoiseFunction2D,
  noiseScale: number,
  width: number,
  height: number
): void {
  for (const p of particles) {
    const nx = (p.x / width) * noiseScale * 4;
    const ny = (p.y / height) * noiseScale * 4;
    const n = noiseFn(nx, ny) * 0.5 + 0.5;
    const size = sizeRange[0] + n * (sizeRange[1] - sizeRange[0]);
    const colorIdx = Math.floor(n * colors.length) % colors.length;
    const alpha = 0.2 + n * 0.6;

    ctx.fillStyle = hexToRGBA(colors[colorIdx], alpha);
    ctx.beginPath();
    if (rng.next() > 0.5) {
      ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
    } else {
      ctx.rect(p.x - size / 2, p.y - size / 2, size, size);
    }
    ctx.fill();
  }
}

function applyGrain(
  ctx: Ctx2D,
  width: number,
  height: number,
  intensity: number,
  rng: RNG
): void {
  if (intensity < 0.01) return;

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const strength = intensity * 60;

  for (let i = 0; i < data.length; i += 4) {
    const noise = (rng.next() - 0.5) * strength;
    data[i] = Math.max(0, Math.min(255, data[i] + noise));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
  }

  ctx.putImageData(imageData, 0, 0);
}

function applyVignette(
  ctx: Ctx2D,
  width: number,
  height: number,
  intensity: number
): void {
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.sqrt(cx * cx + cy * cy);

  const gradient = ctx.createRadialGradient(cx, cy, radius * 0.3, cx, cy, radius);
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(0.6, `rgba(0,0,0,${intensity * 0.2})`);
  gradient.addColorStop(1, `rgba(0,0,0,${intensity * 0.85})`);

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

// ==================== Layer Renderers ====================

function drawBackground(
  ctx: Ctx2D,
  scene: SceneDefinition,
  width: number,
  height: number,
  fbm: NoiseFunction2D,
  rng: RNG
): void {
  const { palette, bgGradientAngle, noiseScale } = scene;

  ctx.fillStyle = palette[0];
  ctx.fillRect(0, 0, width, height);

  const angle = (bgGradientAngle * Math.PI) / 180;
  const x1 = width / 2 - Math.cos(angle) * width * 0.7;
  const y1 = height / 2 - Math.sin(angle) * height * 0.7;
  const x2 = width / 2 + Math.cos(angle) * width * 0.7;
  const y2 = height / 2 + Math.sin(angle) * height * 0.7;

  const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
  const stops = Math.min(4, palette.length);
  for (let i = 0; i < stops; i++) {
    gradient.addColorStop(i / Math.max(1, stops - 1), hexToRGBA(palette[i], 0.4));
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  const offscreen = new OffscreenCanvas(width, height);
  const offCtx = offscreen.getContext('2d')!;
  const imgData = offCtx.createImageData(width, height);
  const data = imgData.data;
  const blockSize = Math.max(2, Math.floor(Math.min(width, height) / 150));

  for (let y = 0; y < height; y += blockSize) {
    for (let x = 0; x < width; x += blockSize) {
      const nx = (x / width) * noiseScale * 4;
      const ny = (y / height) * noiseScale * 4;
      const n = fbm(nx, ny) * 0.5 + 0.5;
      const val = Math.floor(n * 40);

      for (let dy = 0; dy < blockSize && y + dy < height; dy++) {
        for (let dx = 0; dx < blockSize && x + dx < width; dx++) {
          const idx = ((y + dy) * width + (x + dx)) * 4;
          data[idx] = val;
          data[idx + 1] = val;
          data[idx + 2] = val;
          data[idx + 3] = 255;
        }
      }
    }
  }
  offCtx.putImageData(imgData, 0, 0);

  ctx.globalAlpha = 0.15;
  ctx.drawImage(offscreen, 0, 0);
  ctx.globalAlpha = 1.0;
}

function drawVoronoiLayer(
  ctx: Ctx2D,
  scene: SceneDefinition,
  width: number,
  height: number,
  rng: RNG
): void {
  if (scene.voronoiCellCount <= 0) return;

  const seeds = generateVoronoiSeeds(rng, scene.voronoiCellCount, width, height);
  drawVoronoiCells(ctx, seeds, width, height, scene.palette);
}

function drawRadialLayer(
  ctx: Ctx2D,
  scene: SceneDefinition,
  width: number,
  height: number,
  rng: RNG
): void {
  if (scene.radialDensity <= 0.3) return;

  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.4;
  const count = Math.floor(scene.radialDensity * 80) + 10;

  const points = generateRadialPoints(rng, cx, cy, radius, count);

  const maxDist = radius * 0.4;
  ctx.lineWidth = scene.lineWidth * 0.5;

  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const dx = points[i].x - points[j].x;
      const dy = points[i].y - points[j].y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < maxDist) {
        const alpha = (1 - dist / maxDist) * 0.4;
        const colorIdx = (i + j) % scene.palette.length;

        if (scene.glowIntensity > 0.5) {
          ctx.shadowBlur = scene.glowIntensity * 8;
          ctx.shadowColor = hexToRGBA(scene.palette[colorIdx], 0.5);
        }

        ctx.strokeStyle = hexToRGBA(scene.palette[colorIdx], alpha);
        ctx.beginPath();
        ctx.moveTo(points[i].x, points[i].y);
        ctx.lineTo(points[j].x, points[j].y);
        ctx.stroke();
      }
    }
  }

  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';

  for (let i = 0; i < points.length; i++) {
    const energy = getEnergyAt(scene.energyCurve, points[i].x, width);
    const size = 1.5 + energy * 2;
    ctx.fillStyle = hexToRGBA(scene.palette[i % scene.palette.length], 0.6);
    ctx.beginPath();
    ctx.arc(points[i].x, points[i].y, size, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawSplineLayer(
  ctx: Ctx2D,
  scene: SceneDefinition,
  width: number,
  height: number,
  rng: RNG
): void {
  const splineCount = Math.max(1, Math.floor(scene.geometryDensity * 12));

  for (let s = 0; s < splineCount; s++) {
    const controlPointCount = rng.nextInt(5, 12);
    const points = generateSplinePoints(rng, controlPointCount, width, height, scene.splineTension);

    if (points.length < 2) continue;

    const color = scene.palette[(s + 2) % scene.palette.length];
    const energy = getEnergyAt(scene.energyCurve, points[0].x, width);
    const lineWidth = scene.lineWidth * (0.5 + energy * 0.8);
    const alpha = 0.3 + energy * 0.5;

    if (scene.glowIntensity > 0.3) {
      ctx.shadowBlur = scene.glowIntensity * 6;
      ctx.shadowColor = hexToRGBA(color, 0.4);
    }

    ctx.globalAlpha = alpha;
    drawSpline(ctx, points, scene.splineTension, color, lineWidth);

    if (scene.symmetry > 1) {
      const angleStep = (Math.PI * 2) / scene.symmetry;
      for (let sym = 1; sym < scene.symmetry; sym++) {
        ctx.save();
        ctx.translate(width / 2, height / 2);
        ctx.rotate(angleStep * sym);
        ctx.translate(-width / 2, -height / 2);
        drawSpline(ctx, points, scene.splineTension, color, lineWidth * 0.7);
        ctx.restore();
      }
    }
  }

  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';
}

function drawRecursiveLayer(
  ctx: Ctx2D,
  scene: SceneDefinition,
  width: number,
  height: number,
  rng: RNG
): void {
  if (scene.curveComplexity <= 0.4) return;

  const treeCount = Math.max(1, Math.floor(scene.curveComplexity * 5));
  const maxDepth = Math.max(3, Math.floor(scene.curveComplexity * 8));

  for (let t = 0; t < treeCount; t++) {
    const startX = rng.nextFloat(width * 0.1, width * 0.9);
    const startY = rng.nextFloat(height * 0.6, height * 0.95);
    const length = rng.nextFloat(80, 200) * scene.curveComplexity;
    const angle = -Math.PI / 2 + rng.nextFloat(-0.3, 0.3);

    const segments = generateRecursiveCurve(rng, maxDepth, startX, startY, length, angle);

    for (const seg of segments) {
      const depthRatio = seg.depth / maxDepth;
      const alpha = 0.1 + depthRatio * 0.5;
      const colorIdx = (t + seg.depth) % scene.palette.length;
      const lw = scene.lineWidth * (0.3 + depthRatio * 0.7);

      ctx.strokeStyle = hexToRGBA(scene.palette[colorIdx], alpha);
      ctx.lineWidth = lw;
      ctx.lineCap = 'round';

      ctx.beginPath();
      if (seg.points.length > 0) {
        ctx.moveTo(seg.points[0].x, seg.points[0].y);
        for (let i = 1; i < seg.points.length; i++) {
          ctx.lineTo(seg.points[i].x, seg.points[i].y);
        }
      }
      ctx.stroke();
    }
  }
}

function drawSpiralLayer(
  ctx: Ctx2D,
  scene: SceneDefinition,
  width: number,
  height: number,
  rng: RNG
): void {
  if (scene.radialDensity <= 0.5) return;

  const spiralCount = Math.max(1, Math.floor(scene.radialDensity * 4));

  for (let s = 0; s < spiralCount; s++) {
    const cx = width / 2 + rng.nextFloat(-width * 0.15, width * 0.15);
    const cy = height / 2 + rng.nextFloat(-height * 0.15, height * 0.15);
    const turns = rng.nextFloat(3, 8);
    const pointsPerTurn = rng.nextInt(30, 60);
    const radius = rng.nextFloat(100, Math.min(width, height) * 0.35);

    const points = generateSpiralPoints(rng, cx, cy, turns, pointsPerTurn, radius);

    for (let i = 1; i < points.length; i++) {
      const t = i / points.length;
      const color = lerpColor(
        scene.palette[s % scene.palette.length],
        scene.palette[(s + 2) % scene.palette.length],
        t
      );
      const alpha = 0.2 + t * 0.5;
      const lw = scene.lineWidth * (0.3 + t * 0.7);

      ctx.strokeStyle = hexToRGBA(color, alpha);
      ctx.lineWidth = lw;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(points[i - 1].x, points[i - 1].y);
      ctx.lineTo(points[i].x, points[i].y);
      ctx.stroke();
    }
  }
}

function drawParticleLayer(
  ctx: Ctx2D,
  scene: SceneDefinition,
  width: number,
  height: number,
  rng: RNG,
  noiseFn: NoiseFunction2D
): void {
  if (scene.particleCount <= 0) return;

  const particles = generateParticleField(
    rng,
    scene.particleCount,
    width,
    height,
    scene.geometryDensity
  );
  const sizeRange: [number, number] = [1, 3 + scene.lineWidth];

  drawParticles(
    ctx,
    particles,
    scene.palette,
    sizeRange,
    rng,
    noiseFn,
    scene.noiseScale,
    width,
    height
  );
}

function applyTurbulenceOverlay(
  ctx: Ctx2D,
  scene: SceneDefinition,
  width: number,
  height: number,
  turbFn: NoiseFunction2D
): void {
  const gridSize = Math.max(20, Math.floor(Math.min(width, height) / 30));
  const intensity = scene.turbulence;

  for (let y = 0; y < height; y += gridSize) {
    for (let x = 0; x < width; x += gridSize) {
      const nx = (x / width) * scene.noiseScale * 3;
      const ny = (y / height) * scene.noiseScale * 3;
      const n = turbFn(nx, ny);

      if (Math.abs(n) > 0.3) {
        const size = Math.abs(n) * gridSize * 0.8;
        const colorIdx =
          Math.floor(Math.abs(n) * scene.palette.length) % scene.palette.length;
        ctx.fillStyle = hexToRGBA(scene.palette[colorIdx], intensity * 0.08);
        ctx.beginPath();
        ctx.arc(x + gridSize / 2, y + gridSize / 2, size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

function applyGlowPass(
  ctx: Ctx2D,
  width: number,
  height: number,
  intensity: number
): void {
  if (intensity < 0.1) return;

  const off1 = new OffscreenCanvas(width, height);
  const ctx1 = off1.getContext('2d')!;
  ctx1.drawImage(ctx.canvas as OffscreenCanvas, 0, 0);

  const off2 = new OffscreenCanvas(width, height);
  const ctx2 = off2.getContext('2d')!;
  const blurRadius = Math.round(Math.min(20, intensity * 12));
  ctx2.filter = `blur(${blurRadius}px)`;
  ctx2.drawImage(off1, 0, 0);

  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = Math.min(0.4, intensity * 0.25);
  ctx.drawImage(off2, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
}

// ==================== Main Renderer ====================

function renderToCanvas(
  ctx: Ctx2D,
  width: number,
  height: number,
  scene: SceneDefinition,
  onProgress?: (progress: number) => void
): void {
  const rng = createRNG(scene.seed);
  const noiseFn = seededNoise2D(scene.seed);
  const fbm = createFBM(noiseFn, 6, 2.0, 0.5);
  const turbFn = createTurbulence(noiseFn, 4, 2.0, 0.5);

  drawBackground(ctx, scene, width, height, fbm, rng);
  onProgress?.(0.1);

  drawVoronoiLayer(ctx, scene, width, height, rng);
  onProgress?.(0.2);

  drawRadialLayer(ctx, scene, width, height, rng);
  onProgress?.(0.3);

  drawSplineLayer(ctx, scene, width, height, rng);
  onProgress?.(0.5);

  drawRecursiveLayer(ctx, scene, width, height, rng);
  onProgress?.(0.6);

  drawSpiralLayer(ctx, scene, width, height, rng);
  onProgress?.(0.7);

  drawParticleLayer(ctx, scene, width, height, rng, noiseFn);
  onProgress?.(0.8);

  applyGrain(ctx, width, height, scene.grainIntensity, rng);
  if (scene.turbulence > 0.3) {
    applyTurbulenceOverlay(ctx, scene, width, height, turbFn);
  }
  onProgress?.(0.9);

  applyGlowPass(ctx, width, height, scene.glowIntensity);
  applyVignette(ctx, width, height, 0.6);
  onProgress?.(1.0);
}

// ==================== Message Handler ====================

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  const msg = e.data;

  try {
    if (msg.type === 'render') {
      const { scene, width, height } = msg;
      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext('2d')!;

      renderToCanvas(ctx, width, height, scene);

      const bitmap = await createImageBitmap(canvas);
      const result: RenderResult = { type: 'render-result', imageBitmap: bitmap };
      (self as unknown as Worker).postMessage(result, [bitmap]);
    } else if (msg.type === 'export') {
      const { scene, size } = msg;
      const clampedSize = Math.min(size, 4096);
      const canvas = new OffscreenCanvas(clampedSize, clampedSize);
      const ctx = canvas.getContext('2d')!;

      renderToCanvas(ctx, clampedSize, clampedSize, scene);

      const blob = await canvas.convertToBlob({ type: 'image/png' });
      const result: ExportResult = { type: 'export-result', blob };
      self.postMessage(result);
    }
  } catch (err) {
    const errorResult: ErrorResult = {
      type: 'error',
      message: err instanceof Error ? err.message : String(err),
    };
    self.postMessage(errorResult);
  }
};
