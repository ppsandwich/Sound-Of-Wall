import type { RNG } from '../prng';

export interface Point {
  x: number;
  y: number;
}

export interface VoronoiSeed extends Point {
  id: number;
}

export interface RecursiveSegment {
  points: Point[];
  depth: number;
}

export function generateSplinePoints(
  rng: RNG,
  count: number,
  width: number,
  height: number,
  tension: number
): Point[] {
  const points: Point[] = [];
  for (let i = 0; i < count; i++) {
    points.push({
      x: rng.nextFloat(0, width),
      y: rng.nextFloat(0, height),
    });
  }

  if (points.length < 4) return points;

  const interpolated: Point[] = [];
  const segments = (points.length - 3) * 8;

  for (let i = 0; i < segments; i++) {
    const t = i / 8;
    const idx = Math.floor(t);
    const frac = t - idx;

    const p0 = points[idx];
    const p1 = points[idx + 1];
    const p2 = points[idx + 2];
    const p3 = points[idx + 3];

    const t2 = frac * frac;
    const t3 = t2 * frac;

    const s = tension;
    const x =
      s * ((-t3 + 2 * t2 - frac) * p0.x +
        (3 * t3 - 5 * t2 + 2) * p1.x +
        (-3 * t3 + 4 * t2 + frac) * p2.x +
        (t3 - t2) * p3.x);
    const y =
      s * ((-t3 + 2 * t2 - frac) * p0.y +
        (3 * t3 - 5 * t2 + 2) * p1.y +
        (-3 * t3 + 4 * t2 + frac) * p2.y +
        (t3 - t2) * p3.y);

    interpolated.push({ x, y });
  }

  return interpolated;
}

export function generateRadialPoints(
  rng: RNG,
  centerX: number,
  centerY: number,
  radius: number,
  count: number
): Point[] {
  const points: Point[] = [];
  const angleStep = (Math.PI * 2) / count;

  for (let i = 0; i < count; i++) {
    const angle = angleStep * i + rng.nextFloat(-0.1, 0.1);
    const r = radius * (0.8 + rng.next() * 0.2);
    points.push({
      x: centerX + Math.cos(angle) * r,
      y: centerY + Math.sin(angle) * r,
    });
  }

  return points;
}

export function generateVoronoiSeeds(
  rng: RNG,
  count: number,
  width: number,
  height: number
): VoronoiSeed[] {
  const seeds: VoronoiSeed[] = [];
  for (let i = 0; i < count; i++) {
    seeds.push({
      id: i,
      x: rng.nextFloat(0, width),
      y: rng.nextFloat(0, height),
    });
  }
  return seeds;
}

export function generateParticleField(
  rng: RNG,
  count: number,
  width: number,
  height: number,
  density: number
): Point[] {
  const points: Point[] = [];
  const clusterCount = Math.max(1, Math.floor(density * 5));

  const clusterCenters: Point[] = [];
  for (let i = 0; i < clusterCount; i++) {
    clusterCenters.push({
      x: rng.nextFloat(0, width),
      y: rng.nextFloat(0, height),
    });
  }

  for (let i = 0; i < count; i++) {
    const useCluster = rng.next() < density;
    if (useCluster && clusterCenters.length > 0) {
      const center = clusterCenters[Math.floor(rng.next() * clusterCenters.length)];
      const spread = 50 + (1 - density) * 100;
      points.push({
        x: center.x + rng.gaussian() * spread,
        y: center.y + rng.gaussian() * spread,
      });
    } else {
      points.push({
        x: rng.nextFloat(0, width),
        y: rng.nextFloat(0, height),
      });
    }
  }

  return points;
}

export function generateRecursiveCurve(
  rng: RNG,
  depth: number,
  startX: number,
  startY: number,
  length: number,
  angle: number
): RecursiveSegment[] {
  const segments: RecursiveSegment[] = [];

  function recurse(
    x: number,
    y: number,
    len: number,
    a: number,
    d: number
  ): void {
    if (d <= 0 || len < 1) return;

    const steps = Math.max(2, Math.floor(len / 5));
    const points: Point[] = [{ x, y }];
    let cx = x;
    let cy = y;

    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      cx = x + Math.cos(a) * len * t;
      cy = y + Math.sin(a) * len * t;
      points.push({ x: cx, y: cy });
    }

    segments.push({ points, depth: d });

    const branchAngle = rng.nextFloat(0.3, 0.8);
    const branchLen = len * rng.nextFloat(0.5, 0.8);

    recurse(cx, cy, branchLen, a + branchAngle, d - 1);
    recurse(cx, cy, branchLen, a - branchAngle, d - 1);
  }

  recurse(startX, startY, length, angle, depth);
  return segments;
}

export function generateSpiralPoints(
  rng: RNG,
  centerX: number,
  centerY: number,
  turns: number,
  pointsPerTurn: number,
  radius: number
): Point[] {
  const totalPoints = turns * pointsPerTurn;
  const points: Point[] = [];

  for (let i = 0; i < totalPoints; i++) {
    const t = i / totalPoints;
    const angle = t * turns * Math.PI * 2;
    const r = radius * t;
    const jitter = rng.nextFloat(-2, 2);

    points.push({
      x: centerX + Math.cos(angle) * (r + jitter),
      y: centerY + Math.sin(angle) * (r + jitter),
    });
  }

  return points;
}
