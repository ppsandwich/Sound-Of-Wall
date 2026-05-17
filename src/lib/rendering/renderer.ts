import { SceneDefinition, CompositionMode } from '@/types';
import { createRNG, RNG } from '@/lib/prng';
import { seededNoise2D, createFBM, createTurbulence, createRidgedNoise, NoiseFunction2D } from '@/lib/noise';
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

export interface RenderOptions {
  width: number;
  height: number;
  scene: SceneDefinition;
  onProgress?: (progress: number) => void;
}

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

function getEnergyAt(energyCurve: number[], x: number, width: number): number {
  if (energyCurve.length === 0) return 0.5;
  const t = Math.max(0, Math.min(1, x / width));
  const idx = t * (energyCurve.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.min(lo + 1, energyCurve.length - 1);
  const frac = idx - lo;
  return energyCurve[lo] * (1 - frac) + energyCurve[hi] * frac;
}

// ==================== Composition Helpers ====================

function getCompositionCenter(
  mode: CompositionMode,
  width: number,
  height: number,
  rng: RNG
): { cx: number; cy: number } {
  switch (mode) {
    case 'centered':
      return { cx: width / 2, cy: height / 2 };
    case 'radial':
      return { cx: width / 2, cy: height / 2 };
    case 'organic':
      return { cx: width * rng.nextFloat(0.3, 0.7), cy: height * rng.nextFloat(0.3, 0.7) };
    case 'flowing':
      return { cx: width * 0.3, cy: height * rng.nextFloat(0.3, 0.7) };
    case 'scattered':
      return { cx: rng.nextFloat(width * 0.2, width * 0.8), cy: rng.nextFloat(height * 0.2, height * 0.8) };
    case 'grid':
      return { cx: width / 2, cy: height / 2 };
    default:
      return { cx: width / 2, cy: height / 2 };
  }
}

// ==================== Drawing Helpers ====================

function drawSpline(
  ctx: CanvasRenderingContext2D,
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
  ctx: CanvasRenderingContext2D,
  seeds: VoronoiSeed[],
  width: number,
  height: number,
  colors: string[],
  fillOpacity: number,
  edgeOpacity: number
): void {
  if (seeds.length === 0) return;

  const blockSize = Math.max(3, Math.min(10, Math.floor(Math.min(width, height) / 150)));
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
      ctx.fillStyle = hexToRGBA(colors[seedIdx % colors.length], fillOpacity);
      ctx.fillRect(gx * blockSize, gy * blockSize, blockSize, blockSize);
    }
  }

  const edgeColor = colors[Math.min(3, colors.length - 1)];
  for (let gy = 0; gy < gridH; gy++) {
    for (let gx = 0; gx < gridW; gx++) {
      const idx = nearest[gy * gridW + gx];
      if (gx < gridW - 1 && nearest[gy * gridW + gx + 1] !== idx) {
        ctx.fillStyle = hexToRGBA(edgeColor, edgeOpacity);
        ctx.fillRect((gx + 1) * blockSize - 1, gy * blockSize, 1, blockSize);
      }
      if (gy < gridH - 1 && nearest[(gy + 1) * gridW + gx] !== idx) {
        ctx.fillStyle = hexToRGBA(edgeColor, edgeOpacity);
        ctx.fillRect(gx * blockSize, (gy + 1) * blockSize - 1, blockSize, 1);
      }
    }
  }
}

function drawParticles(
  ctx: CanvasRenderingContext2D,
  particles: Point[],
  colors: string[],
  sizeRange: [number, number],
  rng: RNG,
  noiseFn: NoiseFunction2D,
  noiseScale: number,
  width: number,
  height: number,
  shape: 'circle' | 'square' | 'line'
): void {
  for (const p of particles) {
    const nx = (p.x / width) * noiseScale * 4;
    const ny = (p.y / height) * noiseScale * 4;
    const n = noiseFn(nx, ny) * 0.5 + 0.5;
    const size = sizeRange[0] + n * (sizeRange[1] - sizeRange[0]);
    const colorIdx = Math.floor(n * colors.length) % colors.length;
    const alpha = 0.15 + n * 0.65;

    ctx.fillStyle = hexToRGBA(colors[colorIdx], alpha);
    ctx.beginPath();
    if (shape === 'circle') {
      ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
    } else if (shape === 'square') {
      ctx.rect(p.x - size / 2, p.y - size / 2, size, size);
    } else {
      const angle = noiseFn(nx * 2, ny * 2) * Math.PI;
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + Math.cos(angle) * size * 3, p.y + Math.sin(angle) * size * 3);
      ctx.strokeStyle = hexToRGBA(colors[colorIdx], alpha * 0.5);
      ctx.lineWidth = 0.5;
      ctx.stroke();
      continue;
    }
    ctx.fill();
  }
}

function applyGrain(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  intensity: number,
  rng: RNG
): void {
  if (intensity < 0.01) return;

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const strength = intensity * 80;

  for (let i = 0; i < data.length; i += 4) {
    const noise = (rng.next() - 0.5) * strength;
    data[i] = Math.max(0, Math.min(255, data[i] + noise));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
  }

  ctx.putImageData(imageData, 0, 0);
}

function applyVignette(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  intensity: number
): void {
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.sqrt(cx * cx + cy * cy);

  const gradient = ctx.createRadialGradient(cx, cy, radius * 0.2, cx, cy, radius);
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(0.5, `rgba(0,0,0,${intensity * 0.15})`);
  gradient.addColorStop(1, `rgba(0,0,0,${intensity * 0.9})`);

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

// ==================== Layer Renderers ====================

function drawBackground(
  ctx: CanvasRenderingContext2D,
  scene: SceneDefinition,
  width: number,
  height: number,
  fbm: NoiseFunction2D,
  ridgedFn: NoiseFunction2D,
  rng: RNG
): void {
  const { palette, bgGradientAngle, noiseScale, contrastLevel } = scene;

  ctx.fillStyle = palette[0];
  ctx.fillRect(0, 0, width, height);

  const angle = (bgGradientAngle * Math.PI) / 180;
  const x1 = width / 2 - Math.cos(angle) * width * 0.7;
  const y1 = height / 2 - Math.sin(angle) * height * 0.7;
  const x2 = width / 2 + Math.cos(angle) * width * 0.7;
  const y2 = height / 2 + Math.sin(angle) * height * 0.7;

  const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
  const stops = Math.min(5, palette.length);
  for (let i = 0; i < stops; i++) {
    gradient.addColorStop(i / Math.max(1, stops - 1), hexToRGBA(palette[i], 0.3 + contrastLevel * 0.3));
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  const offscreen = document.createElement('canvas');
  offscreen.width = width;
  offscreen.height = height;
  const offCtx = offscreen.getContext('2d')!;
  const imgData = offCtx.createImageData(width, height);
  const data = imgData.data;
  const blockSize = Math.max(2, Math.floor(Math.min(width, height) / 120));

  const useRidged = scene.turbulence > 0.8;
  const noiseFunc = useRidged ? ridgedFn : fbm;

  for (let y = 0; y < height; y += blockSize) {
    for (let x = 0; x < width; x += blockSize) {
      const nx = (x / width) * noiseScale * 5;
      const ny = (y / height) * noiseScale * 5;
      const n = noiseFunc(nx, ny) * 0.5 + 0.5;
      const val = Math.floor(n * (30 + contrastLevel * 40));

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

  ctx.globalAlpha = 0.1 + scene.spatialDepth * 0.15;
  ctx.drawImage(offscreen, 0, 0);
  ctx.globalAlpha = 1.0;
}

function drawVoronoiLayer(
  ctx: CanvasRenderingContext2D,
  scene: SceneDefinition,
  width: number,
  height: number,
  rng: RNG
): void {
  if (scene.voronoiCellCount <= 0) return;

  const seeds = generateVoronoiSeeds(rng, scene.voronoiCellCount, width, height);
  const fillOpacity = 0.03 + scene.spatialDepth * 0.08;
  const edgeOpacity = 0.1 + scene.contrastLevel * 0.2;
  drawVoronoiCells(ctx, seeds, width, height, scene.palette, fillOpacity, edgeOpacity);
}

function drawRadialLayer(
  ctx: CanvasRenderingContext2D,
  scene: SceneDefinition,
  width: number,
  height: number,
  rng: RNG
): void {
  const { cx, cy } = getCompositionCenter(scene.compositionMode, width, height, rng);
  const radius = Math.min(width, height) * (0.2 + scene.radialDensity * 0.3);
  const count = Math.floor(scene.radialDensity * 120) + 5;

  const points = generateRadialPoints(rng, cx, cy, radius, count);

  const maxDist = radius * (0.2 + scene.radialDensity * 0.3);
  ctx.lineWidth = scene.lineWidth * 0.4;

  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const dx = points[i].x - points[j].x;
      const dy = points[i].y - points[j].y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < maxDist) {
        const alpha = (1 - dist / maxDist) * (0.2 + scene.contrastLevel * 0.3);
        const colorIdx = (i + j) % scene.palette.length;

        if (scene.glowIntensity > 0.4) {
          ctx.shadowBlur = scene.glowIntensity * 10;
          ctx.shadowColor = hexToRGBA(scene.palette[colorIdx], 0.4);
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
    const size = 1 + energy * 3;
    ctx.fillStyle = hexToRGBA(scene.palette[i % scene.palette.length], 0.5);
    ctx.beginPath();
    ctx.arc(points[i].x, points[i].y, size, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawSplineLayer(
  ctx: CanvasRenderingContext2D,
  scene: SceneDefinition,
  width: number,
  height: number,
  rng: RNG
): void {
  const splineCount = Math.max(1, Math.floor(scene.geometryDensity * 15));

  for (let s = 0; s < splineCount; s++) {
    const controlPointCount = rng.nextInt(4, 14);
    const points = generateSplinePoints(rng, controlPointCount, width, height, scene.splineTension);

    if (points.length < 2) continue;

    const color = scene.palette[(s + 2) % scene.palette.length];
    const energy = getEnergyAt(scene.energyCurve, points[0].x, width);
    const lineWidth = scene.lineWidth * (0.3 + energy * 1.0);
    const alpha = 0.15 + energy * 0.6 + scene.contrastLevel * 0.15;

    if (scene.glowIntensity > 0.3) {
      ctx.shadowBlur = scene.glowIntensity * 8;
      ctx.shadowColor = hexToRGBA(color, 0.3);
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
        drawSpline(ctx, points, scene.splineTension, color, lineWidth * 0.6);
        ctx.restore();
      }
    }
  }

  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';
}

function drawRecursiveLayer(
  ctx: CanvasRenderingContext2D,
  scene: SceneDefinition,
  width: number,
  height: number,
  rng: RNG
): void {
  const treeCount = Math.max(1, Math.floor(scene.curveComplexity * 8));
  const maxDepth = Math.max(2, Math.floor(scene.curveComplexity * 7));

  for (let t = 0; t < treeCount; t++) {
    let startX: number, startY: number;

    if (scene.compositionMode === 'centered' || scene.compositionMode === 'radial') {
      const angle = rng.nextFloat(0, Math.PI * 2);
      const dist = rng.nextFloat(0.1, 0.4) * Math.min(width, height);
      startX = width / 2 + Math.cos(angle) * dist;
      startY = height / 2 + Math.sin(angle) * dist;
    } else if (scene.compositionMode === 'flowing') {
      startX = rng.nextFloat(0, width * 0.3);
      startY = rng.nextFloat(height * 0.2, height * 0.8);
    } else {
      startX = rng.nextFloat(width * 0.1, width * 0.9);
      startY = rng.nextFloat(height * 0.5, height * 0.95);
    }

    const length = rng.nextFloat(40, 180) * scene.curveComplexity;
    const angle = scene.compositionMode === 'flowing'
      ? rng.nextFloat(-0.4, 0.4)
      : -Math.PI / 2 + rng.nextFloat(-0.5, 0.5);

    const segments = generateRecursiveCurve(rng, maxDepth, startX, startY, length, angle);

    for (const seg of segments) {
      const depthRatio = seg.depth / maxDepth;
      const alpha = 0.08 + depthRatio * 0.4 + scene.contrastLevel * 0.1;
      const colorIdx = (t + seg.depth) % scene.palette.length;
      const lw = scene.lineWidth * (0.2 + depthRatio * 0.8);

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
  ctx: CanvasRenderingContext2D,
  scene: SceneDefinition,
  width: number,
  height: number,
  rng: RNG
): void {
  const spiralCount = Math.max(1, Math.floor(scene.radialDensity * 6));

  for (let s = 0; s < spiralCount; s++) {
    let cx: number, cy: number;
    if (scene.compositionMode === 'radial' || scene.compositionMode === 'centered') {
      cx = width / 2 + rng.nextFloat(-width * 0.1, width * 0.1);
      cy = height / 2 + rng.nextFloat(-height * 0.1, height * 0.1);
    } else {
      cx = rng.nextFloat(width * 0.15, width * 0.85);
      cy = rng.nextFloat(height * 0.15, height * 0.85);
    }

    const turns = rng.nextFloat(2, 10);
    const pointsPerTurn = rng.nextInt(20, 80);
    const radius = rng.nextFloat(60, Math.min(width, height) * 0.4);

    const points = generateSpiralPoints(rng, cx, cy, turns, pointsPerTurn, radius);

    for (let i = 1; i < points.length; i++) {
      const t = i / points.length;
      const color = lerpColor(
        scene.palette[s % scene.palette.length],
        scene.palette[(s + 2) % scene.palette.length],
        t
      );
      const alpha = 0.1 + t * 0.6;
      const lw = scene.lineWidth * (0.2 + t * 1.0);

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
  ctx: CanvasRenderingContext2D,
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

  const sizeRange: [number, number] = [0.5, 2 + scene.lineWidth * 1.5];

  const shapes: Array<'circle' | 'square' | 'line'> = ['circle', 'square', 'line'];
  const shape = scene.compositionMode === 'flowing' ? 'line' :
    scene.compositionMode === 'grid' ? 'square' :
    rng.pick(shapes);

  drawParticles(
    ctx,
    particles,
    scene.palette,
    sizeRange,
    rng,
    noiseFn,
    scene.noiseScale,
    width,
    height,
    shape
  );
}

function drawWaveLayer(
  ctx: CanvasRenderingContext2D,
  scene: SceneDefinition,
  width: number,
  height: number,
  rng: RNG
): void {
  if (scene.waveAmplitude < 0.03) return;

  const waveCount = Math.max(3, Math.floor(scene.waveFrequency * 2));
  const centerY = height / 2;

  for (let w = 0; w < waveCount; w++) {
    const yOffset = (w - waveCount / 2) * (height * 0.08);
    const phase = rng.nextFloat(0, Math.PI * 2);
    const amplitude = height * scene.waveAmplitude * (0.5 + rng.next() * 0.5);
    const freq = scene.waveFrequency * (0.8 + rng.next() * 0.4);
    const color = scene.palette[w % scene.palette.length];

    ctx.beginPath();
    ctx.strokeStyle = hexToRGBA(color, 0.15 + scene.contrastLevel * 0.2);
    ctx.lineWidth = scene.lineWidth * (0.3 + rng.next() * 0.5);

    for (let x = 0; x <= width; x += 2) {
      const t = x / width;
      const energy = getEnergyAt(scene.energyCurve, x, width);
      const y = centerY + yOffset +
        Math.sin(t * Math.PI * 2 * freq + phase) * amplitude * energy +
        Math.sin(t * Math.PI * 2 * freq * 2.3 + phase * 1.7) * amplitude * 0.3;

      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

function drawRingLayer(
  ctx: CanvasRenderingContext2D,
  scene: SceneDefinition,
  width: number,
  height: number,
  rng: RNG
): void {
  if (scene.ringCount <= 0) return;

  const { cx, cy } = getCompositionCenter(scene.compositionMode, width, height, rng);
  const maxRadius = Math.min(width, height) * 0.45;

  for (let i = 0; i < scene.ringCount; i++) {
    const t = (i + 1) / scene.ringCount;
    const radius = maxRadius * t;
    const color = scene.palette[i % scene.palette.length];
    const energy = getEnergyAt(scene.energyCurve, cx + radius, width);
    const alpha = 0.05 + energy * 0.3 + scene.contrastLevel * 0.1;
    const lw = scene.lineWidth * (0.2 + energy * 0.8);

    if (scene.glowIntensity > 0.5) {
      ctx.shadowBlur = scene.glowIntensity * 6;
      ctx.shadowColor = hexToRGBA(color, 0.3);
    }

    ctx.strokeStyle = hexToRGBA(color, alpha);
    ctx.lineWidth = lw;
    ctx.beginPath();

    if (scene.compositionMode === 'organic') {
      const segments = 60;
      for (let s = 0; s <= segments; s++) {
        const angle = (s / segments) * Math.PI * 2;
        const wobble = 1 + rng.nextFloat(-0.1, 0.1) * scene.noiseScale;
        const px = cx + Math.cos(angle) * radius * wobble;
        const py = cy + Math.sin(angle) * radius * wobble;
        if (s === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
    } else {
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    }
    ctx.stroke();
  }

  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';
}

function drawGridLayer(
  ctx: CanvasRenderingContext2D,
  scene: SceneDefinition,
  width: number,
  height: number,
  rng: RNG
): void {
  if (scene.gridDensity < 0.1) return;

  const cols = Math.max(3, Math.floor(scene.gridDensity * 20));
  const rows = Math.max(3, Math.floor(scene.gridDensity * 20));
  const cellW = width / cols;
  const cellH = height / rows;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * cellW;
      const y = r * cellH;
      const energy = getEnergyAt(scene.energyCurve, x, width);
      const noiseVal = rng.next();

      if (noiseVal < scene.gridDensity * energy) {
        const colorIdx = (r + c) % scene.palette.length;
        const alpha = 0.03 + energy * 0.15;
        const size = Math.min(cellW, cellH) * (0.3 + energy * 0.5);

        ctx.fillStyle = hexToRGBA(scene.palette[colorIdx], alpha);
        ctx.beginPath();
        if (scene.compositionMode === 'grid') {
          ctx.rect(x + (cellW - size) / 2, y + (cellH - size) / 2, size, size);
        } else {
          ctx.arc(x + cellW / 2, y + cellH / 2, size / 2, 0, Math.PI * 2);
        }
        ctx.fill();
      }
    }
  }
}

function drawFlowFieldLayer(
  ctx: CanvasRenderingContext2D,
  scene: SceneDefinition,
  width: number,
  height: number,
  rng: RNG,
  noiseFn: NoiseFunction2D
): void {
  if (scene.flowFieldStrength < 0.2) return;

  const stepSize = Math.max(10, Math.floor(30 - scene.flowFieldStrength * 20));
  const lineLength = Math.floor(20 + scene.flowFieldStrength * 40);
  const numLines = Math.floor(scene.flowFieldStrength * 300) + 50;

  for (let i = 0; i < numLines; i++) {
    let x = rng.nextFloat(0, width);
    let y = rng.nextFloat(0, height);
    const colorIdx = rng.nextInt(0, scene.palette.length - 1);

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = hexToRGBA(scene.palette[colorIdx], 0.05 + scene.flowFieldStrength * 0.15);
    ctx.lineWidth = scene.lineWidth * 0.3;

    for (let step = 0; step < lineLength; step++) {
      const nx = (x / width) * scene.noiseScale * 3;
      const ny = (y / height) * scene.noiseScale * 3;
      const angle = noiseFn(nx, ny) * Math.PI * 4;

      x += Math.cos(angle) * stepSize;
      y += Math.sin(angle) * stepSize;

      if (x < 0 || x > width || y < 0 || y > height) break;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

function applyTurbulenceOverlay(
  ctx: CanvasRenderingContext2D,
  scene: SceneDefinition,
  width: number,
  height: number,
  turbFn: NoiseFunction2D
): void {
  const gridSize = Math.max(15, Math.floor(Math.min(width, height) / 25));
  const intensity = Math.min(1, scene.turbulence);

  for (let y = 0; y < height; y += gridSize) {
    for (let x = 0; x < width; x += gridSize) {
      const nx = (x / width) * scene.noiseScale * 4;
      const ny = (y / height) * scene.noiseScale * 4;
      const n = turbFn(nx, ny);

      if (Math.abs(n) > 0.25) {
        const size = Math.abs(n) * gridSize * 1.0;
        const colorIdx = Math.floor(Math.abs(n) * scene.palette.length) % scene.palette.length;
        ctx.fillStyle = hexToRGBA(scene.palette[colorIdx], intensity * 0.06);
        ctx.beginPath();
        ctx.arc(x + gridSize / 2, y + gridSize / 2, size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

function applyGlowPass(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  intensity: number
): void {
  if (intensity < 0.1) return;

  const off1 = document.createElement('canvas');
  off1.width = width;
  off1.height = height;
  const ctx1 = off1.getContext('2d')!;
  ctx1.drawImage(ctx.canvas, 0, 0);

  const off2 = document.createElement('canvas');
  off2.width = width;
  off2.height = height;
  const ctx2 = off2.getContext('2d')!;
  const blurRadius = Math.round(Math.min(25, intensity * 15));
  ctx2.filter = `blur(${blurRadius}px)`;
  ctx2.drawImage(off1, 0, 0);

  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = Math.min(0.5, intensity * 0.3);
  ctx.drawImage(off2, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
}

// ==================== Main Renderer ====================

export function renderArtwork(options: RenderOptions): HTMLCanvasElement {
  const { width, height, scene, onProgress } = options;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  const rng = createRNG(scene.seed);
  const noiseFn = seededNoise2D(scene.seed);
  const fbm = createFBM(noiseFn, 6, 2.0, 0.5);
  const turbFn = createTurbulence(noiseFn, 4, 2.0, 0.5);
  const ridgedFn = createRidgedNoise(noiseFn, 5, 2.0, 0.5);

  const LAYER_VORONOI = 1;
  const LAYER_RADIAL = 2;
  const LAYER_SPLINE = 4;
  const LAYER_RECURSIVE = 8;
  const LAYER_SPIRAL = 16;
  const LAYER_PARTICLES = 32;
  const LAYER_TURBULENCE = 64;

  const mask = scene.layerMask;

  drawBackground(ctx, scene, width, height, fbm, ridgedFn, rng);
  onProgress?.(0.05);

  drawWaveLayer(ctx, scene, width, height, rng);
  onProgress?.(0.1);

  drawRingLayer(ctx, scene, width, height, rng);
  onProgress?.(0.15);

  drawGridLayer(ctx, scene, width, height, rng);
  onProgress?.(0.2);

  if (mask & LAYER_VORONOI) {
    drawVoronoiLayer(ctx, scene, width, height, rng);
  }
  onProgress?.(0.25);

  if (scene.flowFieldStrength > 0.2) {
    drawFlowFieldLayer(ctx, scene, width, height, rng, noiseFn);
  }
  onProgress?.(0.35);

  if (mask & LAYER_RADIAL) {
    drawRadialLayer(ctx, scene, width, height, rng);
  }
  onProgress?.(0.4);

  if (mask & LAYER_SPLINE) {
    drawSplineLayer(ctx, scene, width, height, rng);
  }
  onProgress?.(0.5);

  if (mask & LAYER_RECURSIVE) {
    drawRecursiveLayer(ctx, scene, width, height, rng);
  }
  onProgress?.(0.6);

  if (mask & LAYER_SPIRAL) {
    drawSpiralLayer(ctx, scene, width, height, rng);
  }
  onProgress?.(0.7);

  if (mask & LAYER_PARTICLES) {
    drawParticleLayer(ctx, scene, width, height, rng, noiseFn);
  }
  onProgress?.(0.8);

  if ((mask & LAYER_TURBULENCE) && scene.turbulence > 0.3) {
    applyTurbulenceOverlay(ctx, scene, width, height, turbFn);
  }
  onProgress?.(0.85);

  applyGrain(ctx, width, height, scene.grainIntensity, rng);
  onProgress?.(0.9);

  applyGlowPass(ctx, width, height, scene.glowIntensity);
  applyVignette(ctx, width, height, 0.5 + scene.spatialDepth * 0.3);
  onProgress?.(1.0);

  return canvas;
}
