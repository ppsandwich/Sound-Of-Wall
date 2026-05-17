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
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function energyAt(curve: number[], t: number): number {
  if (curve.length === 0) return 0.5;
  const idx = Math.max(0, Math.min(1, t)) * (curve.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.min(lo + 1, curve.length - 1);
  return curve[lo] * (1 - (idx - lo)) + curve[hi] * (idx - lo);
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

// ==================== Visual Modes ====================

function modeWaveform(ctx: CanvasRenderingContext2D, w: number, h: number, scene: SceneDefinition, rng: RNG, noiseFn: NoiseFunction2D) {
  const { palette, energyCurve, density, complexity, lineWidth, symmetry, scale, contrast } = scene;
  bgGradient(ctx, w, h, palette, rng.nextFloat(0, 180));

  const lineCount = Math.max(5, Math.floor(density * 40));
  const centerY = h / 2;

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

    for (let x = 0; x <= w; x += 2) {
      const t = x / w;
      const e = energyAt(energyCurve, t);
      const noise = noiseFn(t * complexity * 3, i * 0.5) * amplitude * 0.5;
      const y = yBase + Math.sin(t * Math.PI * 2 * freq + phase) * amplitude * e + noise;
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  if (symmetry > 1) {
    const offscreen = document.createElement('canvas');
    offscreen.width = w; offscreen.height = h;
    const offCtx = offscreen.getContext('2d')!;
    offCtx.drawImage(ctx.canvas, 0, 0);
    const angleStep = (Math.PI * 2) / symmetry;
    for (let s = 1; s < symmetry; s++) {
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.rotate(angleStep * s);
      ctx.translate(-w / 2, -h / 2);
      ctx.globalAlpha = 0.4;
      ctx.drawImage(offscreen, 0, 0);
      ctx.globalAlpha = 1;
      ctx.restore();
    }
  }
}

function modeFractalTree(ctx: CanvasRenderingContext2D, w: number, h: number, scene: SceneDefinition, rng: RNG) {
  const { palette, density, complexity, lineWidth, scale, contrast, energyCurve } = scene;
  const bgAngle = rng.nextFloat(0, 360);
  bgGradient(ctx, w, h, palette, bgAngle);

  const treeCount = Math.max(1, Math.floor(density * 8));
  const maxDepth = Math.max(3, Math.floor(complexity * 10));

  function drawBranch(x: number, y: number, len: number, angle: number, depth: number, colorIdx: number) {
    if (depth <= 0 || len < 2) return;
    const endX = x + Math.cos(angle) * len;
    const endY = y + Math.sin(angle) * len;
    const t = depth / maxDepth;
    const color = palette[colorIdx % palette.length];
    const alpha = 0.1 + t * 0.6 * contrast;
    const lw = lineWidth * (0.2 + t * 1.2);

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(endX, endY);
    ctx.strokeStyle = rgba(color, alpha);
    ctx.lineWidth = lw;
    ctx.lineCap = 'round';
    ctx.stroke();

    const branchAngle = rng.nextFloat(0.2, 0.9) * scale;
    const branchLen = len * rng.nextFloat(0.55, 0.8);
    const energy = energyAt(energyCurve, 1 - t);

    drawBranch(endX, endY, branchLen * (0.8 + energy * 0.4), angle + branchAngle, depth - 1, (colorIdx + 1) % palette.length);
    drawBranch(endX, endY, branchLen * (0.8 + energy * 0.4), angle - branchAngle, depth - 1, (colorIdx + 2) % palette.length);
    if (rng.next() < 0.3 * complexity) {
      drawBranch(endX, endY, branchLen * 0.6, angle + rng.nextFloat(-0.2, 0.2), depth - 2, (colorIdx + 3) % palette.length);
    }
  }

  for (let t = 0; t < treeCount; t++) {
    const startX = rng.nextFloat(w * 0.1, w * 0.9);
    const startY = rng.nextFloat(h * 0.6, h * 0.95);
    const startLen = rng.nextFloat(60, 150) * scale;
    const startAngle = -Math.PI / 2 + rng.nextFloat(-0.4, 0.4);
    drawBranch(startX, startY, startLen, startAngle, maxDepth, t % palette.length);
  }
}

function modeConstellation(ctx: CanvasRenderingContext2D, w: number, h: number, scene: SceneDefinition, rng: RNG, noiseFn: NoiseFunction2D) {
  const { palette, density, complexity, lineWidth, scale, contrast, glowIntensity } = scene;
  bgSolid(ctx, w, h, palette[0]);

  const count = Math.floor(density * 200) + 30;
  const points: Array<{ x: number; y: number; size: number; color: string }> = [];

  for (let i = 0; i < count; i++) {
    const nx = rng.nextFloat(0, w);
    const ny = rng.nextFloat(0, h);
    const noise = noiseFn(nx / w * complexity * 4, ny / h * complexity * 4);
    const x = nx + noise * 30 * scale;
    const y = ny + noise * 30 * scale;
    const size = 0.5 + rng.next() * 3 * scale;
    points.push({ x, y, size, color: palette[rng.nextInt(0, palette.length - 1)] });
  }

  const maxDist = Math.min(w, h) * (0.05 + density * 0.15);
  ctx.lineWidth = lineWidth * 0.3;

  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const dx = points[i].x - points[j].x;
      const dy = points[i].y - points[j].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < maxDist) {
        const alpha = (1 - dist / maxDist) * 0.3 * contrast;
        ctx.strokeStyle = rgba(points[i].color, alpha);
        ctx.beginPath();
        ctx.moveTo(points[i].x, points[i].y);
        ctx.lineTo(points[j].x, points[j].y);
        ctx.stroke();
      }
    }
  }

  for (const p of points) {
    if (glowIntensity > 0.5) {
      ctx.shadowBlur = glowIntensity * 8;
      ctx.shadowColor = rgba(p.color, 0.6);
    }
    ctx.fillStyle = rgba(p.color, 0.5 + contrast * 0.3);
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
}

function modeTopographic(ctx: CanvasRenderingContext2D, w: number, h: number, scene: SceneDefinition, rng: RNG, noiseFn: NoiseFunction2D, fbm: NoiseFunction2D) {
  const { palette, density, complexity, lineWidth, scale, contrast } = scene;
  bgNoise(ctx, w, h, fbm, palette, 1);

  const levels = Math.max(5, Math.floor(density * 25));
  const resolution = Math.max(2, Math.floor(6 - complexity * 4));

  for (let level = 0; level < levels; level++) {
    const threshold = level / levels;
    const color = palette[level % palette.length];
    const alpha = 0.1 + contrast * 0.3 + (level / levels) * 0.3;

    ctx.beginPath();
    ctx.strokeStyle = rgba(color, alpha);
    ctx.lineWidth = lineWidth * (0.3 + (level / levels) * 0.7);

    for (let y = 0; y < h; y += resolution) {
      for (let x = 0; x < w; x += resolution) {
        const nx = (x / w) * complexity * 6;
        const ny = (y / h) * complexity * 6;
        const n = fbm(nx, ny) * 0.5 + 0.5;

        if (Math.abs(n - threshold) < 0.02 * scale) {
          ctx.rect(x, y, resolution, resolution);
        }
      }
    }
    ctx.stroke();
  }
}

function modeExpressionist(ctx: CanvasRenderingContext2D, w: number, h: number, scene: SceneDefinition, rng: RNG, noiseFn: NoiseFunction2D) {
  const { palette, density, complexity, lineWidth, scale, contrast, turbulence } = scene;
  bgGradient(ctx, w, h, palette, rng.nextFloat(0, 360));

  const strokeCount = Math.floor(density * 200) + 20;

  for (let i = 0; i < strokeCount; i++) {
    const x = rng.nextFloat(0, w);
    const y = rng.nextFloat(0, h);
    const angle = rng.nextFloat(0, Math.PI * 2);
    const len = rng.nextFloat(20, 200) * scale;
    const color = palette[rng.nextInt(0, palette.length - 1)];
    const alpha = 0.1 + rng.next() * 0.5 * contrast;
    const lw = lineWidth * (0.3 + rng.next() * 2.0);

    ctx.beginPath();
    ctx.strokeStyle = rgba(color, alpha);
    ctx.lineWidth = lw;
    ctx.lineCap = 'round';

    const cx = x + Math.cos(angle) * len * 0.5;
    const cy = y + Math.sin(angle) * len * 0.5 + rng.nextFloat(-20, 20) * turbulence;
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(cx, cy, x + Math.cos(angle) * len, y + Math.sin(angle) * len);
    ctx.stroke();

    if (rng.next() < 0.15 * density) {
      const splatterCount = rng.nextInt(3, 10);
      for (let s = 0; s < splatterCount; s++) {
        const sx = x + rng.gaussian() * 30 * scale;
        const sy = y + rng.gaussian() * 30 * scale;
        const sr = rng.nextFloat(1, 6) * scale;
        ctx.fillStyle = rgba(color, 0.2 + rng.next() * 0.4);
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

function modeGeometric(ctx: CanvasRenderingContext2D, w: number, h: number, scene: SceneDefinition, rng: RNG) {
  const { palette, density, complexity, lineWidth, scale, contrast, symmetry } = scene;
  bgGradient(ctx, w, h, palette, rng.nextFloat(0, 360));

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
        case 'circle':
          ctx.arc(cx, cy, size, 0, Math.PI * 2);
          break;
        case 'rect': {
          const angle = rng.nextFloat(0, Math.PI / symmetry);
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(angle);
          ctx.rect(-size, -size, size * 2, size * 2);
          ctx.restore();
          break;
        }
        case 'triangle':
          ctx.moveTo(cx, cy - size);
          ctx.lineTo(cx - size, cy + size);
          ctx.lineTo(cx + size, cy + size);
          ctx.closePath();
          break;
        case 'diamond':
          ctx.moveTo(cx, cy - size);
          ctx.lineTo(cx + size * 0.6, cy);
          ctx.lineTo(cx, cy + size);
          ctx.lineTo(cx - size * 0.6, cy);
          ctx.closePath();
          break;
        case 'cross':
          ctx.rect(cx - size * 0.2, cy - size, size * 0.4, size * 2);
          ctx.rect(cx - size, cy - size * 0.2, size * 2, size * 0.4);
          break;
      }
      if (rng.next() > 0.5) ctx.fill(); else ctx.stroke();
    }
  }
}

function modeHatching(ctx: CanvasRenderingContext2D, w: number, h: number, scene: SceneDefinition, rng: RNG, noiseFn: NoiseFunction2D) {
  const { palette, density, complexity, lineWidth, scale, contrast } = scene;
  bgSolid(ctx, w, h, palette[0]);

  const bandCount = Math.max(3, Math.floor(density * 10));
  const baseAngle = rng.nextFloat(0, Math.PI);
  const lineSpacing = Math.max(2, Math.floor(8 - density * 5));

  for (let band = 0; band < bandCount; band++) {
    const bandY = (band / bandCount) * h;
    const bandH = h / bandCount;
    const angle = baseAngle + (band / bandCount) * complexity * Math.PI * 0.5;
    const color = palette[band % palette.length];
    const density2 = 0.3 + rng.next() * 0.7;

    ctx.strokeStyle = rgba(color, 0.1 + contrast * 0.3 + density2 * 0.2);
    ctx.lineWidth = lineWidth * (0.2 + rng.next() * 0.5);

    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const diag = Math.sqrt(w * w + h * h);

    for (let d = -diag; d < diag; d += lineSpacing * (1 / density2)) {
      ctx.beginPath();
      const startX = w / 2 + cos * d - sin * diag;
      const startY = bandY + bandH / 2 + sin * d + cos * diag;
      const endX = w / 2 + cos * d + sin * diag;
      const endY = bandY + bandH / 2 + sin * d - cos * diag;

      const clippedStartX = Math.max(0, Math.min(w, startX));
      const clippedStartY = Math.max(bandY, Math.min(bandY + bandH, startY));
      const clippedEndX = Math.max(0, Math.min(w, endX));
      const clippedEndY = Math.max(bandY, Math.min(bandY + bandH, endY));

      ctx.moveTo(clippedStartX, clippedStartY);
      ctx.lineTo(clippedEndX, clippedEndY);
      ctx.stroke();
    }
  }
}

function modeMosaic(ctx: CanvasRenderingContext2D, w: number, h: number, scene: SceneDefinition, rng: RNG, noiseFn: NoiseFunction2D) {
  const { palette, density, complexity, contrast, scale } = scene;
  bgSolid(ctx, w, h, palette[0]);

  const cellSize = Math.max(8, Math.floor(40 - density * 30));
  const cols = Math.ceil(w / cellSize);
  const rows = Math.ceil(h / cellSize);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * cellSize;
      const y = r * cellSize;
      const nx = (x / w) * complexity * 4;
      const ny = (y / h) * complexity * 4;
      const n = noiseFn(nx, ny) * 0.5 + 0.5;
      const colorIdx = Math.floor(n * palette.length) % palette.length;
      const brightness = 0.1 + n * 0.5 + contrast * 0.2;

      ctx.fillStyle = rgba(palette[colorIdx], brightness);
      ctx.fillRect(x + 0.5, y + 0.5, cellSize - 1, cellSize - 1);

      if (rng.next() < 0.1 * complexity) {
        ctx.fillStyle = rgba(palette[(colorIdx + 2) % palette.length], brightness * 0.5);
        const subSize = cellSize * 0.4 * scale;
        ctx.fillRect(x + cellSize / 2 - subSize / 2, y + cellSize / 2 - subSize / 2, subSize, subSize);
      }
    }
  }

  ctx.strokeStyle = rgba(palette[3 % palette.length], 0.1 + contrast * 0.1);
  ctx.lineWidth = 0.5;
  for (let r = 0; r <= rows; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * cellSize);
    ctx.lineTo(w, r * cellSize);
    ctx.stroke();
  }
  for (let c = 0; c <= cols; c++) {
    ctx.beginPath();
    ctx.moveTo(c * cellSize, 0);
    ctx.lineTo(c * cellSize, h);
    ctx.stroke();
  }
}

function modeConcentric(ctx: CanvasRenderingContext2D, w: number, h: number, scene: SceneDefinition, rng: RNG, noiseFn: NoiseFunction2D) {
  const { palette, density, complexity, lineWidth, scale, contrast, symmetry } = scene;
  bgGradient(ctx, w, h, palette, rng.nextFloat(0, 360));

  const centerCount = Math.max(1, Math.floor(density * 5));
  const ringsPerCenter = Math.max(3, Math.floor(complexity * 15));

  for (let c = 0; c < centerCount; c++) {
    const cx = rng.nextFloat(w * 0.15, w * 0.85);
    const cy = rng.nextFloat(h * 0.15, h * 0.85);
    const maxRadius = rng.nextFloat(80, Math.min(w, h) * 0.4) * scale;

    for (let r = 0; r < ringsPerCenter; r++) {
      const t = (r + 1) / ringsPerCenter;
      const radius = maxRadius * t;
      const color = palette[r % palette.length];
      const alpha = 0.05 + contrast * 0.2 + t * 0.3;
      const lw = lineWidth * (0.2 + t * 0.8);

      ctx.strokeStyle = rgba(color, alpha);
      ctx.lineWidth = lw;
      ctx.beginPath();

      const segments = Math.max(20, Math.floor(symmetry * 8));
      for (let s = 0; s <= segments; s++) {
        const angle = (s / segments) * Math.PI * 2;
        const wobble = 1 + noiseFn(
          Math.cos(angle) * complexity * 2 + c,
          Math.sin(angle) * complexity * 2 + r * 0.3
        ) * 0.2 * scale;
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
  bgGradient(ctx, w, h, palette, rng.nextFloat(0, 360));

  const count = Math.floor(density * 2000) + 100;
  const shapes = ['dot', 'line', 'cross', 'ring'] as const;

  for (let i = 0; i < count; i++) {
    const x = rng.nextFloat(0, w);
    const y = rng.nextFloat(0, h);
    const noise = noiseFn(x / w * complexity * 4, y / h * complexity * 4) * 0.5 + 0.5;
    const size = (0.5 + noise * 4) * scale;
    const color = palette[Math.floor(noise * palette.length) % palette.length];
    const alpha = 0.1 + noise * 0.5 * contrast;
    const shape = shapes[rng.nextInt(0, Math.min(shapes.length - 1, Math.floor(complexity * shapes.length)))];

    ctx.fillStyle = rgba(color, alpha);
    ctx.strokeStyle = rgba(color, alpha);
    ctx.lineWidth = 0.5;
    ctx.beginPath();

    switch (shape) {
      case 'dot':
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'line': {
        const angle = noise * Math.PI * 2;
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(angle) * size * 4, y + Math.sin(angle) * size * 4);
        ctx.stroke();
        break;
      }
      case 'cross':
        ctx.moveTo(x - size, y); ctx.lineTo(x + size, y);
        ctx.moveTo(x, y - size); ctx.lineTo(x, y + size);
        ctx.stroke();
        break;
      case 'ring':
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.stroke();
        break;
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

// ==================== Main Renderer ====================

const MODE_RENDERERS: Record<VisualMode, (
  ctx: CanvasRenderingContext2D, w: number, h: number,
  scene: SceneDefinition, rng: RNG,
  noiseFn: NoiseFunction2D, fbm: NoiseFunction2D
) => void> = {
  'waveform': (ctx, w, h, s, r, n) => modeWaveform(ctx, w, h, s, r, n),
  'fractal-tree': (ctx, w, h, s, r) => modeFractalTree(ctx, w, h, s, r),
  'constellation': (ctx, w, h, s, r, n) => modeConstellation(ctx, w, h, s, r, n),
  'topographic': (ctx, w, h, s, r, n, f) => modeTopographic(ctx, w, h, s, r, n, f),
  'expressionist': (ctx, w, h, s, r, n) => modeExpressionist(ctx, w, h, s, r, n),
  'geometric': (ctx, w, h, s, r) => modeGeometric(ctx, w, h, s, r),
  'hatching': (ctx, w, h, s, r, n) => modeHatching(ctx, w, h, s, r, n),
  'mosaic': (ctx, w, h, s, r, n) => modeMosaic(ctx, w, h, s, r, n),
  'concentric': (ctx, w, h, s, r, n) => modeConcentric(ctx, w, h, s, r, n),
  'scatter': (ctx, w, h, s, r, n) => modeScatter(ctx, w, h, s, r, n),
};

export function renderArtwork(options: RenderOptions): HTMLCanvasElement {
  const { width, height, scene, onProgress } = options;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  const rng = createRNG(scene.seed);
  const noiseFn = seededNoise2D(scene.seed);
  const fbm = createFBM(noiseFn, 6, 2.0, 0.5);

  onProgress?.(0.1);

  const renderer = MODE_RENDERERS[scene.visualMode];
  renderer(ctx, width, height, scene, rng, noiseFn, fbm);
  onProgress?.(0.7);

  applyGrain(ctx, width, height, scene.grainIntensity, rng);
  onProgress?.(0.8);

  applyGlow(ctx, width, height, scene.glowIntensity);
  onProgress?.(0.9);

  applyVignette(ctx, width, height, 0.5);
  onProgress?.(1.0);

  return canvas;
}
