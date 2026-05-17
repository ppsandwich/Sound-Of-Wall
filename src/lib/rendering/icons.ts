import type { RNG } from '@/lib/prng';

const EMOJI_SETS = {
  objects: ['⚡', '🔥', '💎', '🌀', '❄️', '🌙', '⭐', '💫', '✨', '🎯', '🔮', '🎪', '🎭', '🪐', '🌊', '🎵', '🎶', '🎸', '🥁', '🎺', '🎹', '🎼', '🎤', '🎧'],
  nature: ['🌸', '🌺', '🌻', '🌷', '🌹', '🍀', '🌿', '🍃', '🍂', '🍁', '🌾', '🌵', '🪵', '🪨', '💎', '🫧', '🪸', '🦠', '🦋', '🐛', '🐝', '🐞'],
  symbols: ['♠', '♥', '♦', '♣', '⬤', '◼', '▲', '◆', '★', '☆', '✦', '✧', '◎', '⊕', '⊗', '⊘', '⊙', '⊛', '⊜', '⊝', '△', '▽', '◇', '□'],
  arrows: ['↗', '↘', '↙', '↖', '↕', '↔', '↻', '↺', '⟳', '⟲', '⤳', '⥤', '⥢', '⥣', '⥥', '⇰', '⇱', '⇲', '⇴', '⇵'],
  math: ['∞', '∑', '∏', '∫', '∂', '∇', '∆', '∈', '∉', '⊂', '⊃', '∪', '∩', '∧', '∨', '¬', '⊕', '⊗', '⊙', '⊛'],
  faces: ['◐', '◑', '◒', '◓', '◔', '◕', '◖', '◗', '◘', '◙', '◚', '◛', '◜', '◝', '◞', '◟'],
};

const ALL_EMOJI = [
  ...EMOJI_SETS.objects,
  ...EMOJI_SETS.nature,
  ...EMOJI_SETS.symbols,
  ...EMOJI_SETS.arrows,
  ...EMOJI_SETS.math,
  ...EMOJI_SETS.faces,
];

export interface IconData {
  draw: (ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string, alpha: number) => void;
  name: string;
}

function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string, alpha: number) {
  const spikes = 5;
  const outerR = size;
  const innerR = size * 0.4;
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (i * Math.PI) / spikes - Math.PI / 2;
    const px = x + Math.cos(angle) * r;
    const py = y + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = hexToRGBA(color, alpha);
  ctx.fill();
}

function drawHeart(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string, alpha: number) {
  ctx.beginPath();
  ctx.moveTo(x, y + size * 0.3);
  ctx.bezierCurveTo(x, y - size * 0.3, x - size, y - size * 0.3, x - size, y + size * 0.1);
  ctx.bezierCurveTo(x - size, y + size * 0.6, x, y + size, x, y + size);
  ctx.bezierCurveTo(x, y + size, x + size, y + size * 0.6, x + size, y + size * 0.1);
  ctx.bezierCurveTo(x + size, y - size * 0.3, x, y - size * 0.3, x, y + size * 0.3);
  ctx.closePath();
  ctx.fillStyle = hexToRGBA(color, alpha);
  ctx.fill();
}

function drawLightning(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string, alpha: number) {
  ctx.beginPath();
  ctx.moveTo(x - size * 0.2, y - size);
  ctx.lineTo(x + size * 0.4, y - size * 0.1);
  ctx.lineTo(x, y - size * 0.1);
  ctx.lineTo(x + size * 0.2, y + size);
  ctx.lineTo(x - size * 0.4, y + size * 0.1);
  ctx.lineTo(x, y + size * 0.1);
  ctx.closePath();
  ctx.fillStyle = hexToRGBA(color, alpha);
  ctx.fill();
}

function drawMusicNote(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string, alpha: number) {
  ctx.fillStyle = hexToRGBA(color, alpha);
  ctx.beginPath();
  ctx.ellipse(x - size * 0.3, y + size * 0.6, size * 0.35, size * 0.25, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(x + size * 0.02, y - size * 0.8, size * 0.12, size * 1.4);
  ctx.beginPath();
  ctx.moveTo(x + size * 0.14, y - size * 0.8);
  ctx.quadraticCurveTo(x + size * 0.6, y - size * 0.6, x + size * 0.14, y - size * 0.3);
  ctx.lineTo(x + size * 0.14, y - size * 0.8);
  ctx.closePath();
  ctx.fill();
}

function drawEye(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string, alpha: number) {
  ctx.strokeStyle = hexToRGBA(color, alpha);
  ctx.lineWidth = size * 0.15;
  ctx.beginPath();
  ctx.moveTo(x - size, y);
  ctx.quadraticCurveTo(x, y - size * 0.7, x + size, y);
  ctx.quadraticCurveTo(x, y + size * 0.7, x - size, y);
  ctx.closePath();
  ctx.stroke();
  ctx.fillStyle = hexToRGBA(color, alpha);
  ctx.beginPath();
  ctx.arc(x, y, size * 0.25, 0, Math.PI * 2);
  ctx.fill();
}

function drawSpiral(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string, alpha: number) {
  ctx.strokeStyle = hexToRGBA(color, alpha);
  ctx.lineWidth = size * 0.1;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i < 120; i++) {
    const t = i / 120;
    const angle = t * Math.PI * 6;
    const r = t * size;
    const px = x + Math.cos(angle) * r;
    const py = y + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.stroke();
}

function drawDiamond(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string, alpha: number) {
  ctx.beginPath();
  ctx.moveTo(x, y - size);
  ctx.lineTo(x + size * 0.6, y);
  ctx.lineTo(x, y + size);
  ctx.lineTo(x - size * 0.6, y);
  ctx.closePath();
  ctx.fillStyle = hexToRGBA(color, alpha);
  ctx.fill();
}

function drawCross(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string, alpha: number) {
  const t = size * 0.25;
  ctx.fillStyle = hexToRGBA(color, alpha);
  ctx.fillRect(x - t, y - size, t * 2, size * 2);
  ctx.fillRect(x - size, y - t, size * 2, t * 2);
}

function drawTriangle(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string, alpha: number) {
  ctx.beginPath();
  ctx.moveTo(x, y - size);
  ctx.lineTo(x + size * 0.87, y + size * 0.5);
  ctx.lineTo(x - size * 0.87, y + size * 0.5);
  ctx.closePath();
  ctx.fillStyle = hexToRGBA(color, alpha);
  ctx.fill();
}

function drawCrescent(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string, alpha: number) {
  ctx.fillStyle = hexToRGBA(color, alpha);
  ctx.beginPath();
  ctx.arc(x, y, size, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(x + size * 0.4, y - size * 0.2, size * 0.85, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
}

function drawWave(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string, alpha: number) {
  ctx.strokeStyle = hexToRGBA(color, alpha);
  ctx.lineWidth = size * 0.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    const px = x - size + t * size * 2;
    const py = y + Math.sin(t * Math.PI * 3) * size * 0.4;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.stroke();
}

function drawTarget(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string, alpha: number) {
  ctx.strokeStyle = hexToRGBA(color, alpha);
  ctx.lineWidth = size * 0.12;
  for (let i = 3; i > 0; i--) {
    ctx.beginPath();
    ctx.arc(x, y, size * (i / 3), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = hexToRGBA(color, alpha);
  ctx.beginPath();
  ctx.arc(x, y, size * 0.1, 0, Math.PI * 2);
  ctx.fill();
}

function drawHexagon(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string, alpha: number) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    const px = x + Math.cos(angle) * size;
    const py = y + Math.sin(angle) * size;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = hexToRGBA(color, alpha);
  ctx.fill();
}

function drawArrowRight(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string, alpha: number) {
  ctx.fillStyle = hexToRGBA(color, alpha);
  ctx.beginPath();
  ctx.moveTo(x - size, y - size * 0.4);
  ctx.lineTo(x + size * 0.3, y - size * 0.4);
  ctx.lineTo(x + size * 0.3, y - size * 0.8);
  ctx.lineTo(x + size, y);
  ctx.lineTo(x + size * 0.3, y + size * 0.8);
  ctx.lineTo(x + size * 0.3, y + size * 0.4);
  ctx.lineTo(x - size, y + size * 0.4);
  ctx.closePath();
  ctx.fill();
}

function drawFlower(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string, alpha: number) {
  const petals = 6;
  ctx.fillStyle = hexToRGBA(color, alpha);
  for (let i = 0; i < petals; i++) {
    const angle = (i / petals) * Math.PI * 2;
    ctx.beginPath();
    ctx.ellipse(
      x + Math.cos(angle) * size * 0.5,
      y + Math.sin(angle) * size * 0.5,
      size * 0.35, size * 0.2,
      angle, 0, Math.PI * 2
    );
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(x, y, size * 0.2, 0, Math.PI * 2);
  ctx.fillStyle = hexToRGBA(color, Math.min(1, alpha + 0.2));
  ctx.fill();
}

function drawMaze(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string, alpha: number) {
  ctx.strokeStyle = hexToRGBA(color, alpha);
  ctx.lineWidth = size * 0.1;
  const s = size * 0.8;
  ctx.strokeRect(x - s, y - s, s * 2, s * 2);
  ctx.beginPath();
  ctx.moveTo(x - s, y);
  ctx.lineTo(x, y);
  ctx.lineTo(x, y - s);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + s, y);
  ctx.lineTo(x, y);
  ctx.lineTo(x, y + s);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x - s * 0.5, y + s * 0.5, s * 0.3, 0, Math.PI * 2);
  ctx.stroke();
}

export const ICON_LIBRARY: IconData[] = [
  { draw: drawStar, name: 'star' },
  { draw: drawHeart, name: 'heart' },
  { draw: drawLightning, name: 'lightning' },
  { draw: drawMusicNote, name: 'musicNote' },
  { draw: drawEye, name: 'eye' },
  { draw: drawSpiral, name: 'spiral' },
  { draw: drawDiamond, name: 'diamond' },
  { draw: drawCross, name: 'cross' },
  { draw: drawTriangle, name: 'triangle' },
  { draw: drawCrescent, name: 'crescent' },
  { draw: drawWave, name: 'wave' },
  { draw: drawTarget, name: 'target' },
  { draw: drawHexagon, name: 'hexagon' },
  { draw: drawArrowRight, name: 'arrowRight' },
  { draw: drawFlower, name: 'flower' },
  { draw: drawMaze, name: 'maze' },
];

function hexToRGBA(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

export function getRandomEmoji(rng: RNG): string {
  return ALL_EMOJI[Math.floor(rng.next() * ALL_EMOJI.length)];
}

export function getRandomIcon(rng: RNG): IconData {
  return ICON_LIBRARY[Math.floor(rng.next() * ICON_LIBRARY.length)];
}

export function drawEmoji(
  ctx: CanvasRenderingContext2D,
  emoji: string,
  x: number, y: number,
  size: number,
  bgColor: string,
  bgAlpha: number,
  rotation: number
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);

  ctx.fillStyle = hexToRGBA(bgColor, bgAlpha);
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.9, 0, Math.PI * 2);
  ctx.fill();

  ctx.font = `${size * 1.2}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, 0, size * 0.05);

  ctx.restore();
}

export function drawIconWithEffects(
  ctx: CanvasRenderingContext2D,
  icon: IconData,
  x: number, y: number,
  size: number,
  color: string,
  alpha: number,
  rotation: number,
  glowColor?: string,
  glowIntensity?: number
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);

  if (glowColor && glowIntensity && glowIntensity > 0.3) {
    ctx.shadowBlur = glowIntensity * 10;
    ctx.shadowColor = hexToRGBA(glowColor, 0.5);
  }

  icon.draw(ctx, 0, 0, size, color, alpha);

  ctx.shadowBlur = 0;
  ctx.restore();
}
