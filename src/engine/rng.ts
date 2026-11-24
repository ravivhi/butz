/* Seeded RNG (mulberry32) so generators are reproducible in tests. */
export interface Rng { next(): number; int(n: number): number; pick<T>(xs: readonly T[]): T; shuffle<T>(xs: readonly T[]): T[]; chance(p: number): boolean }

export function makeRng(seed = Date.now()): Rng {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (n: number) => Math.floor(next() * n);
  return {
    next,
    int,
    pick: <T>(xs: readonly T[]) => xs[int(xs.length)],
    shuffle: <T>(xs: readonly T[]) => {
      const a = xs.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = int(i + 1);
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
    chance: (p: number) => next() < p,
  };
}
