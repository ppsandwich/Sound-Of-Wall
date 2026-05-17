import { SceneDefinition, VisualMode } from '@/types';
import { createRNG, RNG } from '@/lib/prng';
import { seededNoise2D, createFBM, createTurbulence, createRidgedNoise, NoiseFunction2D } from '@/lib/noise';

export interface RenderOptions {
  width: number;
  height: number;
  scene: SceneDefinition;
  onProgress?: (progress: number) => void;
}

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function rgba(hex: string, a: number): string {
  const [r, g, b] = parseHex(hex);
  return `rgba(${r},${g},${b},${a})`;
}

function lerpColor(c1: string, c2: string, t: number): string {
  const [r1, g1, b1] = parseHex(c1);
  const [r2, g2, b2] = parseHex(c2);
  return `#${Math.round(r1 + (r2 - r1) * t).toString(16).padStart(2, '0')}${Math.round(g1 + (g2 - g1) * t).toString(16).padStart(2, '0')}${Math.round(b1 + (b2 - b1) * t).toString(16).padStart(2, '0')}`;
}

function energyAt(curve: number[], t: number): number {
  if (curve.length === 0) return 0.5;
  const idx = Math.max(0, Math.min(1, t)) * (curve.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.min(lo + 1, curve.length - 1);
  return curve[lo] * (1 - (idx - lo)) + curve[hi] * (idx - lo);
}

// ==================== Overlay Layers ====================
// These are composited on top of the primary mode to add complexity.

function overlayNoiseTexture(ctx: CanvasRenderingContext2D, w: number, h: number, fbm: NoiseFunction2D, palette: string[], intensity: number, scale: number) {
  const blockSize = Math.max(2, Math.floor(Math.min(w, h) / (60 + (1 - intensity) * 80)));
  for (let y = 0; y < h; y += blockSize) {
    for (let x = 0; x < w; x += blockSize) {
      const n = fbm((x / w) * scale * 4, (y / h) * scale * 4) * 0.5 + 0.5;
      if (n > 0.4) {
        const ci = Math.floor(n * palette.length) % palette.length;
        ctx.fillStyle = rgba(palette[ci], n * intensity * 0.15);
        ctx.fillRect(x, y, blockSize, blockSize);
      }
    }
  }
}

function overlayVoronoiTessellation(ctx: CanvasRenderingContext2D, w: number, h: number, rng: RNG, palette: string[], cellCount: number, lineAlpha: number) {
  const seeds: Array<{ x: number; y: number; color: string }> = [];
  for (let i = 0; i < cellCount; i++) {
    seeds.push({ x: rng.nextFloat(0, w), y: rng.nextFloat(0, h), color: palette[i % palette.length] });
  }
  const blockSize = Math.max(3, Math.floor(Math.min(w, h) / 120));
  const gridW = Math.ceil(w / blockSize);
  const gridH = Math.ceil(h / blockSize);
  const nearest = new Int32Array(gridW * gridH);
  for (let gy = 0; gy < gridH; gy++) {
    for (let gx = 0; gx < gridW; gx++) {
      const px = gx * blockSize + blockSize / 2;
      const py = gy * blockSize + blockSize / 2;
      let minD = Infinity, minI = 0;
      for (let s = 0; s < seeds.length; s++) {
        const d = (px - seeds[s].x) ** 2 + (py - seeds[s].y) ** 2;
        if (d < minD) { minD = d; minI = s; }
      }
      nearest[gy * gridW + gx] = minI;
    }
  }
  for (let gy = 0; gy < gridH; gy++) {
    for (let gx = 0; gx < gridW; gx++) {
      const idx = nearest[gy * gridW + gx];
      if (gx < gridW - 1 && nearest[gy * gridW + gx + 1] !== idx) {
        ctx.fillStyle = rgba(seeds[idx].color, lineAlpha);
        ctx.fillRect((gx + 1) * blockSize - 1, gy * blockSize, 1, blockSize);
      }
      if (gy < gridH - 1 && nearest[(gy + 1) * gridW + gx] !== idx) {
        ctx.fillStyle = rgba(seeds[idx].color, lineAlpha);
        ctx.fillRect(gx * blockSize, (gy + 1) * blockSize - 1, blockSize, 1);
      }
    }
  }
}

function overlayTriangleTessellation(ctx: CanvasRenderingContext2D, w: number, h: number, rng: RNG, palette: string[], density: number, alpha: number) {
  const cellSize = Math.max(15, Math.floor(60 - density * 40));
  const cols = Math.ceil(w / cellSize) + 1;
  const rows = Math.ceil(h / cellSize) + 1;
  const jitter = cellSize * 0.3;
  const points: number[][] = [];
  for (let r = 0; r <= rows; r++) {
    points[r] = [];
    for (let c = 0; c <= cols; c++) {
      points[r][c] = 0;
    }
  }
  for (let r = 0; r <= rows; r++) {
    for (let c = 0; c <= cols; c++) {
      const x = c * cellSize + (r % 2 === 0 ? 0 : cellSize / 2) + rng.nextFloat(-jitter, jitter);
      const y = r * cellSize + rng.nextFloat(-jitter, jitter);
      const ci = rng.nextInt(0, palette.length - 1);
      ctx.fillStyle = rgba(palette[ci], alpha * (0.3 + rng.next() * 0.5));
      ctx.beginPath();
      const x2 = x + cellSize + rng.nextFloat(-jitter, jitter);
      const y2 = y + cellSize + rng.nextFloat(-jitter, jitter);
      ctx.moveTo(x, y);
      ctx.lineTo(x2, y);
      ctx.lineTo(rng.nextFloat(Math.min(x, x2), Math.max(x, x2)), y2);
      ctx.closePath();
      if (rng.next() > 0.3) ctx.fill(); else ctx.stroke();
    }
  }
}

function overlayHexGrid(ctx: CanvasRenderingContext2D, w: number, h: number, rng: RNG, palette: string[], size: number, alpha: number) {
  const hexH = size * 2;
  const hexW = Math.sqrt(3) * size;
  const rows = Math.ceil(h / (hexH * 0.75)) + 1;
  const cols = Math.ceil(w / hexW) + 1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cx = c * hexW + (r % 2 === 0 ? 0 : hexW / 2);
      const cy = r * hexH * 0.75;
      const ci = rng.nextInt(0, palette.length - 1);
      ctx.strokeStyle = rgba(palette[ci], alpha * (0.2 + rng.next() * 0.4));
      ctx.lineWidth = 0.5 + rng.next() * 1.5;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 6;
        const px = cx + Math.cos(angle) * size;
        const py = cy + Math.sin(angle) * size;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      if (rng.next() < 0.2) {
        ctx.fillStyle = rgba(palette[ci], alpha * 0.1);
        ctx.fill();
      }
      ctx.stroke();
    }
  }
}

function overlayScratches(ctx: CanvasRenderingContext2D, w: number, h: number, rng: RNG, palette: string[], count: number, lineWidth: number) {
  for (let i = 0; i < count; i++) {
    const x = rng.nextFloat(0, w);
    const y = rng.nextFloat(0, h);
    const angle = rng.nextFloat(0, Math.PI * 2);
    const len = rng.nextFloat(20, Math.min(w, h) * 0.8);
    const color = palette[rng.nextInt(0, palette.length - 1)];
    ctx.strokeStyle = rgba(color, 0.03 + rng.next() * 0.12);
    ctx.lineWidth = lineWidth * (0.1 + rng.next() * 0.4);
    ctx.lineCap = rng.next() > 0.5 ? 'round' : 'butt';
    ctx.beginPath();
    ctx.moveTo(x, y);
    const midX = x + Math.cos(angle) * len * 0.5 + rng.nextFloat(-15, 15);
    const midY = y + Math.sin(angle) * len * 0.5 + rng.nextFloat(-15, 15);
    ctx.quadraticCurveTo(midX, midY, x + Math.cos(angle) * len, y + Math.sin(angle) * len);
    ctx.stroke();
  }
}

function overlayDotField(ctx: CanvasRenderingContext2D, w: number, h: number, rng: RNG, noiseFn: NoiseFunction2D, palette: string[], count: number, scale: number) {
  for (let i = 0; i < count; i++) {
    const x = rng.nextFloat(0, w);
    const y = rng.nextFloat(0, h);
    const n = noiseFn(x / w * 3, y / h * 3) * 0.5 + 0.5;
    const size = (0.3 + n * 3) * scale;
    const ci = Math.floor(n * palette.length) % palette.length;
    ctx.fillStyle = rgba(palette[ci], 0.05 + n * 0.2);
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }
}

function overlayConcentricRings(ctx: CanvasRenderingContext2D, w: number, h: number, rng: RNG, palette: string[], ringCount: number, lineWidth: number) {
  const cx = rng.nextFloat(w * 0.2, w * 0.8);
  const cy = rng.nextFloat(h * 0.2, h * 0.8);
  const maxR = rng.nextFloat(50, Math.min(w, h) * 0.45);
  for (let i = 0; i < ringCount; i++) {
    const t = (i + 1) / ringCount;
    const r = maxR * t;
    const ci = i % palette.length;
    ctx.strokeStyle = rgba(palette[ci], 0.04 + t * 0.1);
    ctx.lineWidth = lineWidth * (0.1 + t * 0.5);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function overlaySymmetry(ctx: CanvasRenderingContext2D, w: number, h: number, folds: number) {
  if (folds <= 1) return;
  const offscreen = document.createElement('canvas');
  offscreen.width = w; offscreen.height = h;
  offscreen.getContext('2d')!.drawImage(ctx.canvas, 0, 0);
  const angleStep = (Math.PI * 2) / folds;
  for (let s = 1; s < folds; s++) {
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate(angleStep * s);
    ctx.translate(-w / 2, -h / 2);
    ctx.globalAlpha = 0.35;
    ctx.drawImage(offscreen, 0, 0);
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}

function overlayCrosshatch(ctx: CanvasRenderingContext2D, w: number, h: number, rng: RNG, scene: SceneDefinition, noiseFn: NoiseFunction2D) {
  const { palette } = scene;
  const elementScale = rng.nextFloat(scene.scaleMin, scene.scaleMax);
  const spacing = Math.max(2, Math.floor(6 * elementScale));
  const density = scene.density;
  const diag = Math.sqrt(w * w + h * h);
  const color1 = palette[rng.nextInt(0, palette.length - 1)];
  const color2 = palette[rng.nextInt(0, palette.length - 1)];
  const alpha = 0.04 + rng.next() * 0.12;
  ctx.lineWidth = Math.max(0.3, elementScale * 0.8);
  ctx.strokeStyle = rgba(color1, alpha);
  for (let d = -diag; d < diag; d += spacing) {
    const nx = noiseFn(d * 0.01, 0) * 0.5 + 0.5;
    if (nx < density * 0.5) continue;
    ctx.beginPath();
    ctx.moveTo(w / 2 - diag + d, -diag);
    ctx.lineTo(w / 2 + d, diag);
    ctx.stroke();
  }
  ctx.strokeStyle = rgba(color2, alpha * 0.8);
  for (let d = -diag; d < diag; d += spacing * 1.2) {
    const nx = noiseFn(0, d * 0.01) * 0.5 + 0.5;
    if (nx < density * 0.4) continue;
    ctx.beginPath();
    ctx.moveTo(w / 2 - diag + d, diag);
    ctx.lineTo(w / 2 + d, -diag);
    ctx.stroke();
  }
}

function overlayDotGradient(ctx: CanvasRenderingContext2D, w: number, h: number, rng: RNG, scene: SceneDefinition, noiseFn: NoiseFunction2D) {
  const { palette } = scene;
  const elementScale = rng.nextFloat(scene.scaleMin, scene.scaleMax);
  const gridSize = Math.max(3, Math.floor(10 * elementScale));
  for (let y = 0; y < h; y += gridSize) {
    for (let x = 0; x < w; x += gridSize) {
      const n = noiseFn(x / w * 4, y / h * 4) * 0.5 + 0.5;
      const size = Math.max(0.5, n * gridSize * 0.45 * elementScale);
      const ci = Math.floor(n * palette.length) % palette.length;
      ctx.fillStyle = rgba(palette[ci], 0.05 + n * 0.25);
      ctx.beginPath();
      ctx.arc(x + gridSize / 2, y + gridSize / 2, size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function overlayWaveInterference(ctx: CanvasRenderingContext2D, w: number, h: number, rng: RNG, scene: SceneDefinition) {
  const { palette } = scene;
  const elementScale = rng.nextFloat(scene.scaleMin, scene.scaleMax);
  const waveCount = rng.nextInt(3, 7);
  const resolution = Math.max(1, Math.floor(3 * elementScale));
  for (let y = 0; y < h; y += resolution) {
    for (let x = 0; x < w; x += resolution) {
      let val = 0;
      for (let wi = 0; wi < waveCount; wi++) {
        const freq = (1 + wi * rng.nextFloat(0.5, 2)) * scene.complexity * 2;
        const angle = rng.nextFloat(0, Math.PI * 2);
        const phase = rng.nextFloat(0, Math.PI * 2);
        val += Math.sin((x * Math.cos(angle) + y * Math.sin(angle)) * freq / w * Math.PI * 2 + phase);
      }
      val /= waveCount;
      const absVal = Math.abs(val);
      if (absVal > 0.3) {
        const ci = Math.floor(absVal * palette.length) % palette.length;
        ctx.fillStyle = rgba(palette[ci], absVal * 0.15);
        ctx.fillRect(x, y, resolution, resolution);
      }
    }
  }
}

function overlaySpiralOverlay(ctx: CanvasRenderingContext2D, w: number, h: number, rng: RNG, scene: SceneDefinition) {
  const { palette } = scene;
  const elementScale = rng.nextFloat(scene.scaleMin, scene.scaleMax);
  const spiralCount = rng.nextInt(2, 6);
  for (let s = 0; s < spiralCount; s++) {
    const cx = rng.nextFloat(w * 0.1, w * 0.9);
    const cy = rng.nextFloat(h * 0.1, h * 0.9);
    const maxRadius = rng.nextFloat(30, Math.min(w, h) * 0.5) * elementScale;
    const turns = rng.nextFloat(2, 12);
    const color = palette[rng.nextInt(0, palette.length - 1)];
    ctx.strokeStyle = rgba(color, 0.05 + rng.next() * 0.15);
    ctx.lineWidth = Math.max(0.3, rng.next() * 2 * elementScale);
    ctx.beginPath();
    const steps = Math.floor(turns * 60);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const angle = t * turns * Math.PI * 2;
      const r = t * maxRadius;
      const px = cx + Math.cos(angle) * r;
      const py = cy + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
}

function overlayGridDistortion(ctx: CanvasRenderingContext2D, w: number, h: number, rng: RNG, scene: SceneDefinition, noiseFn: NoiseFunction2D) {
  const { palette } = scene;
  const elementScale = rng.nextFloat(scene.scaleMin, scene.scaleMax);
  const gridSize = Math.max(10, Math.floor(30 * elementScale));
  const cols = Math.ceil(w / gridSize) + 1;
  const rows = Math.ceil(h / gridSize) + 1;
  const distortAmt = 15 * scene.turbulence * elementScale;
  ctx.lineWidth = Math.max(0.3, elementScale * 0.6);
  const color = palette[rng.nextInt(0, palette.length - 1)];
  ctx.strokeStyle = rgba(color, 0.06 + rng.next() * 0.1);
  for (let r = 0; r < rows; r++) {
    ctx.beginPath();
    for (let c = 0; c < cols; c++) {
      const baseX = c * gridSize;
      const baseY = r * gridSize;
      const dx = noiseFn(baseX / w * 5, baseY / h * 5) * distortAmt;
      const dy = noiseFn(baseX / w * 5 + 100, baseY / h * 5 + 100) * distortAmt;
      const px = baseX + dx;
      const py = baseY + dy;
      if (c === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
  for (let c = 0; c < cols; c++) {
    ctx.beginPath();
    for (let r = 0; r < rows; r++) {
      const baseX = c * gridSize;
      const baseY = r * gridSize;
      const dx = noiseFn(baseX / w * 5, baseY / h * 5) * distortAmt;
      const dy = noiseFn(baseX / w * 5 + 100, baseY / h * 5 + 100) * distortAmt;
      const px = baseX + dx;
      const py = baseY + dy;
      if (r === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
}

function overlayConcentricSquares(ctx: CanvasRenderingContext2D, w: number, h: number, rng: RNG, scene: SceneDefinition) {
  const { palette } = scene;
  const elementScale = rng.nextFloat(scene.scaleMin, scene.scaleMax);
  const centerCount = rng.nextInt(2, 5);
  for (let ci = 0; ci < centerCount; ci++) {
    const cx = rng.nextFloat(w * 0.15, w * 0.85);
    const cy = rng.nextFloat(h * 0.15, h * 0.85);
    const maxSide = rng.nextFloat(40, Math.min(w, h) * 0.5) * elementScale;
    const rotation = rng.nextFloat(0, Math.PI / 4);
    const ringCount = rng.nextInt(5, 20);
    const color = palette[rng.nextInt(0, palette.length - 1)];
    for (let r = 0; r < ringCount; r++) {
      const t = (r + 1) / ringCount;
      const side = maxSide * t;
      const alpha = 0.03 + t * 0.12;
      ctx.strokeStyle = rgba(color, alpha);
      ctx.lineWidth = Math.max(0.3, (1 - t) * 1.5 * elementScale);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rotation);
      ctx.strokeRect(-side / 2, -side / 2, side, side);
      ctx.restore();
    }
  }
}

function overlayRandomPolygons(ctx: CanvasRenderingContext2D, w: number, h: number, rng: RNG, scene: SceneDefinition) {
  const { palette } = scene;
  const elementScale = rng.nextFloat(scene.scaleMin, scene.scaleMax);
  const count = rng.nextInt(10, 40);
  for (let i = 0; i < count; i++) {
    const cx = rng.nextFloat(0, w);
    const cy = rng.nextFloat(0, h);
    const radius = rng.nextFloat(3, 80) * elementScale;
    const sides = rng.nextInt(3, 8);
    const rotation = rng.nextFloat(0, Math.PI * 2);
    const color = palette[rng.nextInt(0, palette.length - 1)];
    const alpha = 0.04 + rng.next() * 0.2;
    const fill = rng.next() > 0.4;
    ctx.beginPath();
    for (let s = 0; s < sides; s++) {
      const angle = rotation + (s / sides) * Math.PI * 2;
      const r = radius * rng.nextFloat(0.7, 1.3);
      const px = cx + Math.cos(angle) * r;
      const py = cy + Math.sin(angle) * r;
      if (s === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    if (fill) {
      ctx.fillStyle = rgba(color, alpha * 0.5);
      ctx.fill();
    }
    ctx.strokeStyle = rgba(color, alpha);
    ctx.lineWidth = Math.max(0.3, elementScale * 0.5);
    ctx.stroke();
  }
}

function overlayBarcodeLines(ctx: CanvasRenderingContext2D, w: number, h: number, rng: RNG, scene: SceneDefinition) {
  const { palette } = scene;
  const elementScale = rng.nextFloat(scene.scaleMin, scene.scaleMax);
  const vertical = rng.next() > 0.5;
  const lineCount = rng.nextInt(30, 150);
  const color = palette[rng.nextInt(0, palette.length - 1)];
  for (let i = 0; i < lineCount; i++) {
    const pos = rng.nextFloat(0, vertical ? w : h);
    const thickness = rng.nextFloat(0.5, 6) * elementScale;
    const alpha = 0.03 + rng.next() * 0.15;
    ctx.fillStyle = rgba(color, alpha);
    if (vertical) {
      ctx.fillRect(pos, 0, thickness, h);
    } else {
      ctx.fillRect(0, pos, w, thickness);
    }
  }
}

function overlayBubbleField(ctx: CanvasRenderingContext2D, w: number, h: number, rng: RNG, scene: SceneDefinition) {
  const { palette } = scene;
  const elementScale = rng.nextFloat(scene.scaleMin, scene.scaleMax);
  const count = rng.nextInt(20, 100);
  for (let i = 0; i < count; i++) {
    const x = rng.nextFloat(0, w);
    const y = rng.nextFloat(0, h);
    const radius = rng.nextFloat(2, 80) * elementScale;
    const color = palette[rng.nextInt(0, palette.length - 1)];
    const alpha = 0.02 + rng.next() * 0.08;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = rgba(color, alpha);
    ctx.fill();
    ctx.strokeStyle = rgba(color, alpha * 2);
    ctx.lineWidth = Math.max(0.3, elementScale * 0.3);
    ctx.stroke();
  }
}

function overlayStippleGradient(ctx: CanvasRenderingContext2D, w: number, h: number, rng: RNG, scene: SceneDefinition, noiseFn: NoiseFunction2D) {
  const { palette } = scene;
  const elementScale = rng.nextFloat(scene.scaleMin, scene.scaleMax);
  const gridSize = Math.max(2, Math.floor(5 * elementScale));
  for (let y = 0; y < h; y += gridSize) {
    for (let x = 0; x < w; x += gridSize) {
      const n = noiseFn(x / w * 5, y / h * 5) * 0.5 + 0.5;
      const dotsInCell = Math.floor(n * 6);
      const ci = Math.floor(n * palette.length) % palette.length;
      ctx.fillStyle = rgba(palette[ci], 0.04 + n * 0.2);
      for (let d = 0; d < dotsInCell; d++) {
        const dx = x + rng.nextFloat(0, gridSize);
        const dy = y + rng.nextFloat(0, gridSize);
        const dotSize = rng.nextFloat(0.3, 1.5) * elementScale;
        ctx.beginPath();
        ctx.arc(dx, dy, dotSize, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

function overlayChevronPattern(ctx: CanvasRenderingContext2D, w: number, h: number, rng: RNG, scene: SceneDefinition) {
  const { palette } = scene;
  const elementScale = rng.nextFloat(scene.scaleMin, scene.scaleMax);
  const bandCount = rng.nextInt(4, 12);
  const bandHeight = h / bandCount;
  for (let b = 0; b < bandCount; b++) {
    const y = b * bandHeight;
    const chevronWidth = rng.nextFloat(10, 50) * elementScale;
    const color = palette[rng.nextInt(0, palette.length - 1)];
    const alpha = 0.04 + rng.next() * 0.15;
    ctx.strokeStyle = rgba(color, alpha);
    ctx.lineWidth = Math.max(0.3, elementScale * 0.6);
    ctx.beginPath();
    const count = Math.ceil(w / chevronWidth) + 1;
    for (let i = 0; i < count; i++) {
      const cx = i * chevronWidth;
      const peakY = y + bandHeight * 0.2;
      const baseY = y + bandHeight * 0.8;
      if (i === 0) ctx.moveTo(cx, baseY);
      ctx.lineTo(cx + chevronWidth / 2, peakY);
      ctx.lineTo(cx + chevronWidth, baseY);
    }
    ctx.stroke();
  }
}

function overlayCirclePacking(ctx: CanvasRenderingContext2D, w: number, h: number, rng: RNG, scene: SceneDefinition) {
  const { palette } = scene;
  const elementScale = rng.nextFloat(scene.scaleMin, scene.scaleMax);
  const maxCircles = rng.nextInt(20, 80);
  const circles: Array<{ x: number; y: number; r: number }> = [];
  const minR = 2 * elementScale;
  const maxR = Math.min(w, h) * 0.15 * elementScale;
  let attempts = 0;
  while (circles.length < maxCircles && attempts < maxCircles * 20) {
    attempts++;
    const x = rng.nextFloat(0, w);
    const y = rng.nextFloat(0, h);
    const r = rng.nextFloat(minR, maxR);
    let overlaps = false;
    for (const c of circles) {
      const dist = Math.sqrt((x - c.x) ** 2 + (y - c.y) ** 2);
      if (dist < c.r + r + 2) { overlaps = true; break; }
    }
    if (!overlaps) {
      circles.push({ x, y, r });
      const color = palette[rng.nextInt(0, palette.length - 1)];
      const alpha = 0.04 + rng.next() * 0.15;
      if (rng.next() > 0.4) {
        ctx.fillStyle = rgba(color, alpha * 0.5);
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = rgba(color, alpha);
      ctx.lineWidth = Math.max(0.3, elementScale * 0.4);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

function overlayArcSegments(ctx: CanvasRenderingContext2D, w: number, h: number, rng: RNG, scene: SceneDefinition) {
  const { palette } = scene;
  const elementScale = rng.nextFloat(scene.scaleMin, scene.scaleMax);
  const count = rng.nextInt(10, 40);
  for (let i = 0; i < count; i++) {
    const cx = rng.nextFloat(0, w);
    const cy = rng.nextFloat(0, h);
    const radius = rng.nextFloat(5, 100) * elementScale;
    const startAngle = rng.nextFloat(0, Math.PI * 2);
    const arcLen = rng.nextFloat(0.3, Math.PI * 1.5);
    const color = palette[rng.nextInt(0, palette.length - 1)];
    const alpha = 0.05 + rng.next() * 0.2;
    ctx.strokeStyle = rgba(color, alpha);
    ctx.lineWidth = Math.max(0.3, rng.next() * 3 * elementScale);
    ctx.lineCap = rng.next() > 0.5 ? 'round' : 'butt';
    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle, startAngle + arcLen);
    ctx.stroke();
  }
}

function overlayDashedGrid(ctx: CanvasRenderingContext2D, w: number, h: number, rng: RNG, scene: SceneDefinition) {
  const { palette } = scene;
  const elementScale = rng.nextFloat(scene.scaleMin, scene.scaleMax);
  const gridSize = Math.max(10, Math.floor(30 * elementScale));
  const cols = Math.ceil(w / gridSize) + 1;
  const rows = Math.ceil(h / gridSize) + 1;
  for (let r = 0; r < rows; r++) {
    const color = palette[rng.nextInt(0, palette.length - 1)];
    const dashLen = rng.nextFloat(2, 15) * elementScale;
    const gapLen = rng.nextFloat(2, 15) * elementScale;
    ctx.strokeStyle = rgba(color, 0.05 + rng.next() * 0.12);
    ctx.lineWidth = Math.max(0.3, elementScale * 0.5);
    ctx.setLineDash([dashLen, gapLen]);
    ctx.beginPath();
    ctx.moveTo(0, r * gridSize);
    ctx.lineTo(w, r * gridSize);
    ctx.stroke();
  }
  for (let c = 0; c < cols; c++) {
    const color = palette[rng.nextInt(0, palette.length - 1)];
    const dashLen = rng.nextFloat(2, 15) * elementScale;
    const gapLen = rng.nextFloat(2, 15) * elementScale;
    ctx.strokeStyle = rgba(color, 0.05 + rng.next() * 0.12);
    ctx.lineWidth = Math.max(0.3, elementScale * 0.5);
    ctx.setLineDash([dashLen, gapLen]);
    ctx.beginPath();
    ctx.moveTo(c * gridSize, 0);
    ctx.lineTo(c * gridSize, h);
    ctx.stroke();
  }
  ctx.setLineDash([]);
}

function overlayNoiseContours(ctx: CanvasRenderingContext2D, w: number, h: number, rng: RNG, scene: SceneDefinition, noiseFn: NoiseFunction2D, fbm: NoiseFunction2D) {
  const { palette } = scene;
  const elementScale = rng.nextFloat(scene.scaleMin, scene.scaleMax);
  const levels = rng.nextInt(5, 15);
  const resolution = Math.max(1, Math.floor(3 * elementScale));
  for (let level = 0; level < levels; level++) {
    const threshold = level / levels;
    const color = palette[level % palette.length];
    const alpha = 0.04 + (level / levels) * 0.12;
    ctx.strokeStyle = rgba(color, alpha);
    ctx.lineWidth = Math.max(0.3, elementScale * 0.4);
    ctx.beginPath();
    for (let y = 0; y < h; y += resolution) {
      for (let x = 0; x < w; x += resolution) {
        const n = fbm(x / w * scene.complexity * 5, y / h * scene.complexity * 5) * 0.5 + 0.5;
        if (Math.abs(n - threshold) < 0.015) {
          ctx.rect(x, y, resolution, resolution);
        }
      }
    }
    ctx.stroke();
  }
}

function overlayScatteredTriangles(ctx: CanvasRenderingContext2D, w: number, h: number, rng: RNG, scene: SceneDefinition) {
  const { palette } = scene;
  const elementScale = rng.nextFloat(scene.scaleMin, scene.scaleMax);
  const count = rng.nextInt(10, 50);
  for (let i = 0; i < count; i++) {
    const cx = rng.nextFloat(0, w);
    const cy = rng.nextFloat(0, h);
    const size = rng.nextFloat(3, 100) * elementScale;
    const rotation = rng.nextFloat(0, Math.PI * 2);
    const color = palette[rng.nextInt(0, palette.length - 1)];
    const alpha = 0.04 + rng.next() * 0.2;
    const filled = rng.next() > 0.4;
    ctx.beginPath();
    for (let v = 0; v < 3; v++) {
      const angle = rotation + (v / 3) * Math.PI * 2;
      const r = size * rng.nextFloat(0.6, 1.4);
      const px = cx + Math.cos(angle) * r;
      const py = cy + Math.sin(angle) * r;
      if (v === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    if (filled) {
      ctx.fillStyle = rgba(color, alpha * 0.4);
      ctx.fill();
    }
    ctx.strokeStyle = rgba(color, alpha);
    ctx.lineWidth = Math.max(0.3, elementScale * 0.5);
    ctx.stroke();
  }
}

// ==================== Shared Backgrounds ====================

function bgSolid(ctx: CanvasRenderingContext2D, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, h);
}

function bgGradient(ctx: CanvasRenderingContext2D, w: number, h: number, palette: string[], angle: number) {
  bgSolid(ctx, w, h, palette[0]);
  const rad = (angle * Math.PI) / 180;
  const g = ctx.createLinearGradient(
    w / 2 - Math.cos(rad) * w * 0.7, h / 2 - Math.sin(rad) * h * 0.7,
    w / 2 + Math.cos(rad) * w * 0.7, h / 2 + Math.sin(rad) * h * 0.7
  );
  for (let i = 0; i < Math.min(4, palette.length); i++) {
    g.addColorStop(i / Math.max(1, Math.min(3, palette.length - 1)), rgba(palette[i], 0.35));
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function bgNoise(ctx: CanvasRenderingContext2D, w: number, h: number, fbm: NoiseFunction2D, palette: string[], noiseScale: number) {
  bgSolid(ctx, w, h, palette[0]);
  const blockSize = Math.max(2, Math.floor(Math.min(w, h) / 100));
  for (let y = 0; y < h; y += blockSize) {
    for (let x = 0; x < w; x += blockSize) {
      const n = fbm((x / w) * noiseScale * 5, (y / h) * noiseScale * 5) * 0.5 + 0.5;
      const ci = Math.floor(n * (palette.length - 1));
      ctx.fillStyle = rgba(palette[ci], 0.08 + n * 0.12);
      ctx.fillRect(x, y, blockSize, blockSize);
    }
  }
}

function bgRadialGradient(ctx: CanvasRenderingContext2D, w: number, h: number, palette: string[]) {
  bgSolid(ctx, w, h, palette[0]);
  const cx = w / 2, cy = h / 2;
  const r = Math.max(w, h) * 0.7;
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  for (let i = 0; i < Math.min(4, palette.length); i++) {
    g.addColorStop(i / Math.max(1, Math.min(3, palette.length - 1)), rgba(palette[i], 0.4));
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

// ==================== Primary Visual Modes ====================

function modeWaveform(ctx: CanvasRenderingContext2D, w: number, h: number, scene: SceneDefinition, rng: RNG, noiseFn: NoiseFunction2D) {
  const { palette, energyCurve, density, complexity, lineWidth, scale, contrast } = scene;
  const lineCount = Math.max(5, Math.floor(density * 40));
  for (let i = 0; i < lineCount; i++) {
    const yBase = (i / (lineCount - 1)) * h;
    const amplitude = h * 0.05 * scale * (0.5 + energyAt(energyCurve, i / lineCount) * 1.5);
    const freq = 1 + complexity * 8 + rng.nextFloat(0, 3);
    const phase = rng.nextFloat(0, Math.PI * 2);
    const color = palette[i % palette.length];
    const alpha = 0.15 + contrast * 0.3 + energyAt(energyCurve, i / lineCount) * 0.3;
    ctx.beginPath();
    ctx.strokeStyle = rgba(color, alpha);
    ctx.lineWidth = lineWidth * (0.3 + rng.next() * 0.7);
    ctx.lineCap = rng.next() > 0.5 ? 'round' : 'butt';
    for (let x = 0; x <= w; x += 2) {
      const t = x / w;
      const e = energyAt(energyCurve, t);
      const noise = noiseFn(t * complexity * 3, i * 0.5) * amplitude * 0.5;
      const y = yBase + Math.sin(t * Math.PI * 2 * freq + phase) * amplitude * e + noise;
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

function modeFractalTree(ctx: CanvasRenderingContext2D, w: number, h: number, scene: SceneDefinition, rng: RNG) {
  const { palette, density, complexity, lineWidth, scale, contrast, energyCurve } = scene;
  const treeCount = Math.max(1, Math.floor(density * 8));
  const maxDepth = Math.max(3, Math.floor(complexity * 10));
  function drawBranch(x: number, y: number, len: number, angle: number, depth: number, colorIdx: number) {
    if (depth <= 0 || len < 2) return;
    const endX = x + Math.cos(angle) * len;
    const endY = y + Math.sin(angle) * len;
    const t = depth / maxDepth;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(endX, endY);
    ctx.strokeStyle = rgba(palette[colorIdx % palette.length], 0.1 + t * 0.6 * contrast);
    ctx.lineWidth = lineWidth * (0.2 + t * 1.2);
    ctx.lineCap = 'round';
    ctx.stroke();
    const branchAngle = rng.nextFloat(0.2, 0.9) * scale;
    const branchLen = len * rng.nextFloat(0.55, 0.8);
    const energy = energyAt(energyCurve, 1 - t);
    drawBranch(endX, endY, branchLen * (0.8 + energy * 0.4), angle + branchAngle, depth - 1, (colorIdx + 1) % palette.length);
    drawBranch(endX, endY, branchLen * (0.8 + energy * 0.4), angle - branchAngle, depth - 1, (colorIdx + 2) % palette.length);
    if (rng.next() < 0.3 * complexity) drawBranch(endX, endY, branchLen * 0.6, angle + rng.nextFloat(-0.2, 0.2), depth - 2, (colorIdx + 3) % palette.length);
  }
  for (let t = 0; t < treeCount; t++) {
    drawBranch(rng.nextFloat(w * 0.1, w * 0.9), rng.nextFloat(h * 0.6, h * 0.95), rng.nextFloat(60, 150) * scale, -Math.PI / 2 + rng.nextFloat(-0.4, 0.4), maxDepth, t % palette.length);
  }
}

function modeConstellation(ctx: CanvasRenderingContext2D, w: number, h: number, scene: SceneDefinition, rng: RNG, noiseFn: NoiseFunction2D) {
  const { palette, density, complexity, lineWidth, scale, contrast, glowIntensity } = scene;
  const count = Math.floor(density * 200) + 30;
  const points: Array<{ x: number; y: number; size: number; color: string }> = [];
  for (let i = 0; i < count; i++) {
    const nx = rng.nextFloat(0, w);
    const ny = rng.nextFloat(0, h);
    const noise = noiseFn(nx / w * complexity * 4, ny / h * complexity * 4);
    points.push({ x: nx + noise * 30 * scale, y: ny + noise * 30 * scale, size: 0.5 + rng.next() * 3 * scale, color: palette[rng.nextInt(0, palette.length - 1)] });
  }
  const maxDist = Math.min(w, h) * (0.05 + density * 0.15);
  ctx.lineWidth = lineWidth * 0.3;
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const d = Math.sqrt((points[i].x - points[j].x) ** 2 + (points[i].y - points[j].y) ** 2);
      if (d < maxDist) {
        ctx.strokeStyle = rgba(points[i].color, (1 - d / maxDist) * 0.3 * contrast);
        ctx.beginPath();
        ctx.moveTo(points[i].x, points[i].y);
        ctx.lineTo(points[j].x, points[j].y);
        ctx.stroke();
      }
    }
  }
  for (const p of points) {
    if (glowIntensity > 0.5) { ctx.shadowBlur = glowIntensity * 8; ctx.shadowColor = rgba(p.color, 0.6); }
    ctx.fillStyle = rgba(p.color, 0.5 + contrast * 0.3);
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
}

function modeTopographic(ctx: CanvasRenderingContext2D, w: number, h: number, scene: SceneDefinition, rng: RNG, noiseFn: NoiseFunction2D, fbm: NoiseFunction2D) {
  const { palette, density, complexity, lineWidth, scale, contrast } = scene;
  const levels = Math.max(5, Math.floor(density * 25));
  const resolution = Math.max(2, Math.floor(6 - complexity * 4));
  for (let level = 0; level < levels; level++) {
    const threshold = level / levels;
    ctx.beginPath();
    ctx.strokeStyle = rgba(palette[level % palette.length], 0.1 + contrast * 0.3 + (level / levels) * 0.3);
    ctx.lineWidth = lineWidth * (0.3 + (level / levels) * 0.7);
    for (let y = 0; y < h; y += resolution) {
      for (let x = 0; x < w; x += resolution) {
        const n = fbm((x / w) * complexity * 6, (y / h) * complexity * 6) * 0.5 + 0.5;
        if (Math.abs(n - threshold) < 0.02 * scale) ctx.rect(x, y, resolution, resolution);
      }
    }
    ctx.stroke();
  }
}

function modeExpressionist(ctx: CanvasRenderingContext2D, w: number, h: number, scene: SceneDefinition, rng: RNG) {
  const { palette, density, lineWidth, scale, contrast, turbulence } = scene;
  const strokeCount = Math.floor(density * 200) + 20;
  for (let i = 0; i < strokeCount; i++) {
    const x = rng.nextFloat(0, w);
    const y = rng.nextFloat(0, h);
    const angle = rng.nextFloat(0, Math.PI * 2);
    const len = rng.nextFloat(20, 200) * scale;
    const color = palette[rng.nextInt(0, palette.length - 1)];
    ctx.strokeStyle = rgba(color, 0.1 + rng.next() * 0.5 * contrast);
    ctx.lineWidth = lineWidth * (0.3 + rng.next() * 2.0);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(angle) * len * 0.5, y + Math.sin(angle) * len * 0.5 + rng.nextFloat(-20, 20) * turbulence, x + Math.cos(angle) * len, y + Math.sin(angle) * len);
    ctx.stroke();
    if (rng.next() < 0.15 * density) {
      for (let s = 0; s < rng.nextInt(3, 10); s++) {
        ctx.fillStyle = rgba(color, 0.2 + rng.next() * 0.4);
        ctx.beginPath();
        ctx.arc(x + rng.gaussian() * 30 * scale, y + rng.gaussian() * 30 * scale, rng.nextFloat(1, 6) * scale, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

function modeGeometric(ctx: CanvasRenderingContext2D, w: number, h: number, scene: SceneDefinition, rng: RNG) {
  const { palette, density, complexity, lineWidth, scale, contrast, symmetry } = scene;
  const cols = Math.max(2, Math.floor(density * 12));
  const rows = Math.max(2, Math.floor(density * 12));
  const cellW = w / cols;
  const cellH = h / rows;
  const shapes = ['circle', 'rect', 'triangle', 'diamond', 'cross'] as const;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (rng.next() > 0.3 + density * 0.5) continue;
      const cx = c * cellW + cellW / 2;
      const cy = r * cellH + cellH / 2;
      const size = Math.min(cellW, cellH) * (0.2 + rng.next() * 0.6) * scale;
      const color = palette[(r + c) % palette.length];
      const alpha = 0.15 + contrast * 0.3 + rng.next() * 0.3;
      const shape = shapes[rng.nextInt(0, Math.min(shapes.length - 1, Math.floor(complexity * shapes.length)))];
      ctx.fillStyle = rgba(color, alpha);
      ctx.strokeStyle = rgba(color, alpha + 0.1);
      ctx.lineWidth = lineWidth * 0.5;
      ctx.beginPath();
      switch (shape) {
        case 'circle': ctx.arc(cx, cy, size, 0, Math.PI * 2); break;
        case 'rect': { ctx.save(); ctx.translate(cx, cy); ctx.rotate(rng.nextFloat(0, Math.PI / symmetry)); ctx.rect(-size, -size, size * 2, size * 2); ctx.restore(); break; }
        case 'triangle': ctx.moveTo(cx, cy - size); ctx.lineTo(cx - size, cy + size); ctx.lineTo(cx + size, cy + size); ctx.closePath(); break;
        case 'diamond': ctx.moveTo(cx, cy - size); ctx.lineTo(cx + size * 0.6, cy); ctx.lineTo(cx, cy + size); ctx.lineTo(cx - size * 0.6, cy); ctx.closePath(); break;
        case 'cross': ctx.rect(cx - size * 0.2, cy - size, size * 0.4, size * 2); ctx.rect(cx - size, cy - size * 0.2, size * 2, size * 0.4); break;
      }
      if (rng.next() > 0.5) ctx.fill(); else ctx.stroke();
    }
  }
}

function modeHatching(ctx: CanvasRenderingContext2D, w: number, h: number, scene: SceneDefinition, rng: RNG) {
  const { palette, density, complexity, lineWidth, contrast } = scene;
  const bandCount = Math.max(3, Math.floor(density * 10));
  const baseAngle = rng.nextFloat(0, Math.PI);
  const lineSpacing = Math.max(2, Math.floor(8 - density * 5));
  for (let band = 0; band < bandCount; band++) {
    const bandY = (band / bandCount) * h;
    const bandH = h / bandCount;
    const angle = baseAngle + (band / bandCount) * complexity * Math.PI * 0.5;
    const density2 = 0.3 + rng.next() * 0.7;
    ctx.strokeStyle = rgba(palette[band % palette.length], 0.1 + contrast * 0.3 + density2 * 0.2);
    ctx.lineWidth = lineWidth * (0.2 + rng.next() * 0.5);
    const cos = Math.cos(angle), sin = Math.sin(angle), diag = Math.sqrt(w * w + h * h);
    for (let d = -diag; d < diag; d += lineSpacing * (1 / density2)) {
      ctx.beginPath();
      ctx.moveTo(Math.max(0, Math.min(w, w / 2 + cos * d - sin * diag)), Math.max(bandY, Math.min(bandY + bandH, bandY + bandH / 2 + sin * d + cos * diag)));
      ctx.lineTo(Math.max(0, Math.min(w, w / 2 + cos * d + sin * diag)), Math.max(bandY, Math.min(bandY + bandH, bandY + bandH / 2 + sin * d - cos * diag)));
      ctx.stroke();
    }
  }
}

function modeMosaic(ctx: CanvasRenderingContext2D, w: number, h: number, scene: SceneDefinition, rng: RNG, noiseFn: NoiseFunction2D) {
  const { palette, density, complexity, contrast, scale } = scene;
  const cellSize = Math.max(8, Math.floor(40 - density * 30));
  const cols = Math.ceil(w / cellSize);
  const rows = Math.ceil(h / cellSize);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * cellSize, y = r * cellSize;
      const n = noiseFn((x / w) * complexity * 4, (y / h) * complexity * 4) * 0.5 + 0.5;
      const ci = Math.floor(n * palette.length) % palette.length;
      ctx.fillStyle = rgba(palette[ci], 0.1 + n * 0.5 + contrast * 0.2);
      ctx.fillRect(x + 0.5, y + 0.5, cellSize - 1, cellSize - 1);
      if (rng.next() < 0.1 * complexity) {
        ctx.fillStyle = rgba(palette[(ci + 2) % palette.length], (0.1 + n * 0.5 + contrast * 0.2) * 0.5);
        const subSize = cellSize * 0.4 * scale;
        ctx.fillRect(x + cellSize / 2 - subSize / 2, y + cellSize / 2 - subSize / 2, subSize, subSize);
      }
    }
  }
}

function modeConcentric(ctx: CanvasRenderingContext2D, w: number, h: number, scene: SceneDefinition, rng: RNG, noiseFn: NoiseFunction2D) {
  const { palette, density, complexity, lineWidth, scale, contrast, symmetry } = scene;
  const centerCount = Math.max(1, Math.floor(density * 5));
  const ringsPerCenter = Math.max(3, Math.floor(complexity * 15));
  for (let c = 0; c < centerCount; c++) {
    const cx = rng.nextFloat(w * 0.15, w * 0.85);
    const cy = rng.nextFloat(h * 0.15, h * 0.85);
    const maxRadius = rng.nextFloat(80, Math.min(w, h) * 0.4) * scale;
    for (let r = 0; r < ringsPerCenter; r++) {
      const t = (r + 1) / ringsPerCenter;
      const radius = maxRadius * t;
      ctx.strokeStyle = rgba(palette[r % palette.length], 0.05 + contrast * 0.2 + t * 0.3);
      ctx.lineWidth = lineWidth * (0.2 + t * 0.8);
      ctx.beginPath();
      const segments = Math.max(20, Math.floor(symmetry * 8));
      for (let s = 0; s <= segments; s++) {
        const angle = (s / segments) * Math.PI * 2;
        const wobble = 1 + noiseFn(Math.cos(angle) * complexity * 2 + c, Math.sin(angle) * complexity * 2 + r * 0.3) * 0.2 * scale;
        const px = cx + Math.cos(angle) * radius * wobble;
        const py = cy + Math.sin(angle) * radius * wobble;
        if (s === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
    }
  }
}

function modeScatter(ctx: CanvasRenderingContext2D, w: number, h: number, scene: SceneDefinition, rng: RNG, noiseFn: NoiseFunction2D) {
  const { palette, density, complexity, scale, contrast } = scene;
  const count = Math.floor(density * 2000) + 100;
  const shapes = ['dot', 'line', 'cross', 'ring'] as const;
  for (let i = 0; i < count; i++) {
    const x = rng.nextFloat(0, w);
    const y = rng.nextFloat(0, h);
    const noise = noiseFn(x / w * complexity * 4, y / h * complexity * 4) * 0.5 + 0.5;
    const size = (0.5 + noise * 4) * scale;
    const ci = Math.floor(noise * palette.length) % palette.length;
    const alpha = 0.1 + noise * 0.5 * contrast;
    const shape = shapes[rng.nextInt(0, Math.min(shapes.length - 1, Math.floor(complexity * shapes.length)))];
    ctx.fillStyle = rgba(palette[ci], alpha);
    ctx.strokeStyle = rgba(palette[ci], alpha);
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    switch (shape) {
      case 'dot': ctx.arc(x, y, size, 0, Math.PI * 2); ctx.fill(); break;
      case 'line': { const a = noise * Math.PI * 2; ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * size * 4, y + Math.sin(a) * size * 4); ctx.stroke(); break; }
      case 'cross': ctx.moveTo(x - size, y); ctx.lineTo(x + size, y); ctx.moveTo(x, y - size); ctx.lineTo(x, y + size); ctx.stroke(); break;
      case 'ring': ctx.arc(x, y, size, 0, Math.PI * 2); ctx.stroke(); break;
    }
  }
}

// ==================== Post-Processing ====================

function applyGrain(ctx: CanvasRenderingContext2D, w: number, h: number, intensity: number, rng: RNG) {
  if (intensity < 0.01) return;
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  const strength = intensity * 70;
  for (let i = 0; i < data.length; i += 4) {
    const n = (rng.next() - 0.5) * strength;
    data[i] = Math.max(0, Math.min(255, data[i] + n));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + n));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + n));
  }
  ctx.putImageData(imageData, 0, 0);
}

function applyGlow(ctx: CanvasRenderingContext2D, w: number, h: number, intensity: number) {
  if (intensity < 0.1) return;
  const off1 = document.createElement('canvas');
  off1.width = w; off1.height = h;
  off1.getContext('2d')!.drawImage(ctx.canvas, 0, 0);
  const off2 = document.createElement('canvas');
  off2.width = w; off2.height = h;
  const ctx2 = off2.getContext('2d')!;
  ctx2.filter = `blur(${Math.round(Math.min(25, intensity * 15))}px)`;
  ctx2.drawImage(off1, 0, 0);
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = Math.min(0.5, intensity * 0.3);
  ctx.drawImage(off2, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
}

function applyVignette(ctx: CanvasRenderingContext2D, w: number, h: number, intensity: number) {
  const cx = w / 2, cy = h / 2;
  const radius = Math.sqrt(cx * cx + cy * cy);
  const g = ctx.createRadialGradient(cx, cy, radius * 0.2, cx, cy, radius);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(0.5, `rgba(0,0,0,${intensity * 0.15})`);
  g.addColorStop(1, `rgba(0,0,0,${intensity * 0.85})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function applyScanlines(ctx: CanvasRenderingContext2D, w: number, h: number, rng: RNG) {
  const spacing = rng.nextInt(1, 3);
  ctx.fillStyle = 'rgba(0,0,0,0.04)';
  for (let y = 0; y < h; y += spacing) {
    ctx.fillRect(0, y, w, 1);
  }
}

function applyPosterize(ctx: CanvasRenderingContext2D, w: number, h: number, rng: RNG) {
  const levels = rng.nextInt(3, 8);
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  const step = 255 / levels;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.round(data[i] / step) * step;
    data[i + 1] = Math.round(data[i + 1] / step) * step;
    data[i + 2] = Math.round(data[i + 2] / step) * step;
  }
  ctx.putImageData(imageData, 0, 0);
}

function applyEdgeHighlight(ctx: CanvasRenderingContext2D, w: number, h: number, rng: RNG) {
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  const edgeData = new Uint8ClampedArray(data.length);
  const threshold = 30;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = (y * w + x) * 4;
      const idxL = (y * w + (x - 1)) * 4;
      const idxR = (y * w + (x + 1)) * 4;
      const idxU = ((y - 1) * w + x) * 4;
      const idxD = ((y + 1) * w + x) * 4;
      for (let ch = 0; ch < 3; ch++) {
        const gx = data[idxR + ch] - data[idxL + ch];
        const gy = data[idxD + ch] - data[idxU + ch];
        const mag = Math.sqrt(gx * gx + gy * gy);
        edgeData[idx + ch] = mag > threshold ? Math.min(255, mag * 2) : 0;
      }
      edgeData[idx + 3] = edgeData[idx] > 0 ? 120 : 0;
    }
  }
  const edgeImage = new ImageData(edgeData, w, h);
  ctx.putImageData(edgeImage, 0, 0);
}

function applyChromaticAberration(ctx: CanvasRenderingContext2D, w: number, h: number, rng: RNG) {
  const offset = rng.nextInt(2, 6);
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  const original = new Uint8ClampedArray(data);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const rIdx = (y * w + Math.min(w - 1, x + offset)) * 4;
      const bIdx = (y * w + Math.max(0, x - offset)) * 4;
      data[idx] = original[rIdx];
      data[idx + 1] = original[idx + 1];
      data[idx + 2] = original[bIdx + 2];
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

function applyRadialBlur(ctx: CanvasRenderingContext2D, w: number, h: number, rng: RNG) {
  const cx = w / 2, cy = h / 2;
  const passes = rng.nextInt(4, 8);
  const strength = rng.nextFloat(0.002, 0.008);
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.08;
  for (let i = 0; i < passes; i++) {
    const angle = (i / passes) * strength;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.scale(1 + angle * 0.5, 1 + angle * 0.5);
    ctx.translate(-cx, -cy);
    ctx.drawImage(ctx.canvas, 0, 0);
    ctx.restore();
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
}

function applyColorShift(ctx: CanvasRenderingContext2D, w: number, h: number, rng: RNG) {
  const hueShift = rng.nextFloat(0, 360);
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    let h2 = 0;
    const s = max === 0 ? 0 : d / max;
    const v = max;
    if (d !== 0) {
      if (max === r) h2 = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      else if (max === g) h2 = ((b - r) / d + 2) / 6;
      else h2 = ((r - g) / d + 4) / 6;
    }
    h2 = (h2 * 360 + hueShift) % 360;
    if (h2 < 0) h2 += 360;
    const hi = h2 / 60;
    const c = v * s;
    const x2 = c * (1 - Math.abs((hi % 2) - 1));
    const m = v - c;
    let r2 = 0, g2 = 0, b2 = 0;
    if (hi < 1) { r2 = c; g2 = x2; }
    else if (hi < 2) { r2 = x2; g2 = c; }
    else if (hi < 3) { g2 = c; b2 = x2; }
    else if (hi < 4) { g2 = x2; b2 = c; }
    else if (hi < 5) { r2 = x2; b2 = c; }
    else { r2 = c; b2 = x2; }
    data[i] = Math.round((r2 + m) * 255);
    data[i + 1] = Math.round((g2 + m) * 255);
    data[i + 2] = Math.round((b2 + m) * 255);
  }
  ctx.putImageData(imageData, 0, 0);
}

// ==================== Main Renderer ====================

const PRIMARY_RENDERERS: Record<VisualMode, (
  ctx: CanvasRenderingContext2D, w: number, h: number,
  scene: SceneDefinition, rng: RNG,
  noiseFn: NoiseFunction2D, fbm: NoiseFunction2D
) => void> = {
  'waveform': (ctx, w, h, s, r, n) => modeWaveform(ctx, w, h, s, r, n),
  'fractal-tree': (ctx, w, h, s, r) => modeFractalTree(ctx, w, h, s, r),
  'constellation': (ctx, w, h, s, r, n) => modeConstellation(ctx, w, h, s, r, n),
  'topographic': (ctx, w, h, s, r, n, f) => modeTopographic(ctx, w, h, s, r, n, f),
  'expressionist': (ctx, w, h, s, r) => modeExpressionist(ctx, w, h, s, r),
  'geometric': (ctx, w, h, s, r) => modeGeometric(ctx, w, h, s, r),
  'hatching': (ctx, w, h, s, r) => modeHatching(ctx, w, h, s, r),
  'mosaic': (ctx, w, h, s, r, n) => modeMosaic(ctx, w, h, s, r, n),
  'concentric': (ctx, w, h, s, r, n) => modeConcentric(ctx, w, h, s, r, n),
  'scatter': (ctx, w, h, s, r, n) => modeScatter(ctx, w, h, s, r, n),
};

const BG_RENDERERS = [
  (ctx: CanvasRenderingContext2D, w: number, h: number, palette: string[], rng: RNG, fbm: NoiseFunction2D, noiseScale: number) => bgGradient(ctx, w, h, palette, rng.nextFloat(0, 360)),
  (ctx: CanvasRenderingContext2D, w: number, h: number, palette: string[], rng: RNG, fbm: NoiseFunction2D, noiseScale: number) => bgNoise(ctx, w, h, fbm, palette, noiseScale),
  (ctx: CanvasRenderingContext2D, w: number, h: number, palette: string[], rng: RNG, fbm: NoiseFunction2D, noiseScale: number) => bgRadialGradient(ctx, w, h, palette),
  (ctx: CanvasRenderingContext2D, w: number, h: number, palette: string[], rng: RNG, fbm: NoiseFunction2D, noiseScale: number) => { bgSolid(ctx, w, h, palette[0]); },
];

const ALL_OVERLAY_TYPES = [
  'voronoi', 'triangles', 'hexgrid', 'scratches', 'dots', 'rings',
  'crosshatch', 'dotGradient', 'waveInterference', 'spiralOverlay',
  'gridDistortion', 'concentricSquares', 'randomPolygons', 'barcodeLines',
  'bubbleField', 'stippleGradient', 'chevronPattern', 'circlePacking',
  'arcSegments', 'dashedGrid', 'noiseContours', 'scatteredTriangles',
];

export function renderArtwork(options: RenderOptions): HTMLCanvasElement {
  const { width: w, height: h, scene, onProgress } = options;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const rng = createRNG(scene.seed);
  const noiseFn = seededNoise2D(scene.seed);
  const fbm = createFBM(noiseFn, 6, 2.0, 0.5);
  const turbFn = createTurbulence(noiseFn, 4, 2.0, 0.5);

  // 1. Background
  const bgIdx = rng.nextInt(0, BG_RENDERERS.length - 1);
  BG_RENDERERS[bgIdx](ctx, w, h, scene.palette, rng, fbm, scene.density);
  onProgress?.(0.1);

  // 2. Noise texture overlay (always, varying intensity)
  overlayNoiseTexture(ctx, w, h, fbm, scene.palette, scene.turbulence, scene.density * 2);
  onProgress?.(0.15);

  // 3. Primary visual mode
  const renderer = PRIMARY_RENDERERS[scene.visualMode];
  renderer(ctx, w, h, scene, rng, noiseFn, fbm);
  onProgress?.(0.5);

  // 4. Composited overlay layers
  const overlayCount = scene.overlayCount;
  const overlayTypes = rng.shuffle(ALL_OVERLAY_TYPES);

  for (let i = 0; i < Math.min(overlayCount, overlayTypes.length); i++) {
    const overlay = overlayTypes[i];
    const alpha = 0.05 + scene.contrast * 0.15 + rng.next() * 0.1;
    switch (overlay) {
      case 'voronoi':
        overlayVoronoiTessellation(ctx, w, h, rng, scene.palette, Math.floor(5 + scene.density * 20), alpha);
        break;
      case 'triangles':
        overlayTriangleTessellation(ctx, w, h, rng, scene.palette, scene.density, alpha * 0.5);
        break;
      case 'hexgrid':
        overlayHexGrid(ctx, w, h, rng, scene.palette, 15 + rng.next() * 25, alpha);
        break;
      case 'scratches':
        overlayScratches(ctx, w, h, rng, scene.palette, Math.floor(10 + scene.density * 30), scene.lineWidth);
        break;
      case 'dots':
        overlayDotField(ctx, w, h, rng, noiseFn, scene.palette, Math.floor(50 + scene.density * 200), scene.scale);
        break;
      case 'rings':
        overlayConcentricRings(ctx, w, h, rng, scene.palette, Math.floor(3 + scene.complexity * 10), scene.lineWidth);
        break;
      case 'crosshatch':
        overlayCrosshatch(ctx, w, h, rng, scene, noiseFn);
        break;
      case 'dotGradient':
        overlayDotGradient(ctx, w, h, rng, scene, noiseFn);
        break;
      case 'waveInterference':
        overlayWaveInterference(ctx, w, h, rng, scene);
        break;
      case 'spiralOverlay':
        overlaySpiralOverlay(ctx, w, h, rng, scene);
        break;
      case 'gridDistortion':
        overlayGridDistortion(ctx, w, h, rng, scene, noiseFn);
        break;
      case 'concentricSquares':
        overlayConcentricSquares(ctx, w, h, rng, scene);
        break;
      case 'randomPolygons':
        overlayRandomPolygons(ctx, w, h, rng, scene);
        break;
      case 'barcodeLines':
        overlayBarcodeLines(ctx, w, h, rng, scene);
        break;
      case 'bubbleField':
        overlayBubbleField(ctx, w, h, rng, scene);
        break;
      case 'stippleGradient':
        overlayStippleGradient(ctx, w, h, rng, scene, noiseFn);
        break;
      case 'chevronPattern':
        overlayChevronPattern(ctx, w, h, rng, scene);
        break;
      case 'circlePacking':
        overlayCirclePacking(ctx, w, h, rng, scene);
        break;
      case 'arcSegments':
        overlayArcSegments(ctx, w, h, rng, scene);
        break;
      case 'dashedGrid':
        overlayDashedGrid(ctx, w, h, rng, scene);
        break;
      case 'noiseContours':
        overlayNoiseContours(ctx, w, h, rng, scene, noiseFn, fbm);
        break;
      case 'scatteredTriangles':
        overlayScatteredTriangles(ctx, w, h, rng, scene);
        break;
    }
  }
  onProgress?.(0.7);

  // 5. Symmetry fold (1-6 fold rotational symmetry, driven by scene)
  const folds = scene.symmetry;
  if (folds > 1) {
    overlaySymmetry(ctx, w, h, folds);
  }
  onProgress?.(0.75);

  // 6. Second pass of primary mode at reduced opacity (adds depth)
  ctx.globalAlpha = 0.15 + scene.contrast * 0.2;
  renderer(ctx, w, h, scene, rng, noiseFn, fbm);
  ctx.globalAlpha = 1;
  onProgress?.(0.8);

  // 7. Post-processing (driven by postProcessMask bits)
  const mask = scene.postProcessMask;
  if (mask & 1) applyGrain(ctx, w, h, scene.grainIntensity, rng);
  if (mask & 2) applyGlow(ctx, w, h, scene.glowIntensity);
  if (mask & 4) applyVignette(ctx, w, h, 0.4 + scene.contrast * 0.2);
  if (mask & 8) applyScanlines(ctx, w, h, rng);
  if (mask & 16) applyPosterize(ctx, w, h, rng);
  if (mask & 32) applyEdgeHighlight(ctx, w, h, rng);
  if (mask & 64) applyChromaticAberration(ctx, w, h, rng);
  if (mask & 128) applyColorShift(ctx, w, h, rng);
  if (mask & 256) applyRadialBlur(ctx, w, h, rng);
  onProgress?.(1.0);

  return canvas;
}
