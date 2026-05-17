export interface RNG {
  next(): number;
  nextInt(min: number, max: number): number;
  nextFloat(min: number, max: number): number;
  pick<T>(arr: T[]): T;
  shuffle<T>(arr: T[]): T[];
  gaussian(): number;
}

export function createRNG(seed: number): RNG {
  let state = seed | 0;
  let spareGaussian: number | null = null;

  function mulberry32(): number {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  return {
    next(): number {
      return mulberry32();
    },

    nextInt(min: number, max: number): number {
      return Math.floor(mulberry32() * (max - min + 1)) + min;
    },

    nextFloat(min: number, max: number): number {
      return mulberry32() * (max - min) + min;
    },

    pick<T>(arr: T[]): T {
      return arr[Math.floor(mulberry32() * arr.length)];
    },

    shuffle<T>(arr: T[]): T[] {
      const copy = [...arr];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(mulberry32() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    },

    gaussian(): number {
      if (spareGaussian !== null) {
        const val = spareGaussian;
        spareGaussian = null;
        return val;
      }
      let u: number, v: number, s: number;
      do {
        u = mulberry32() * 2 - 1;
        v = mulberry32() * 2 - 1;
        s = u * u + v * v;
      } while (s >= 1 || s === 0);
      const mul = Math.sqrt((-2 * Math.log(s)) / s);
      spareGaussian = v * mul;
      return u * mul;
    },
  };
}
