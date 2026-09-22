import BN from 'bn.js';

/**
 * Seeded PRNG using Mulberry32 for deterministic, reproducible simulation runs.
 */
export class SeededRng {
  private s: number;

  constructor(seed: number = 42) {
    this.s = Math.floor(seed) >>> 0;
    if (this.s === 0) this.s = 1;
  }

  /** Return pseudo-random float in [0, 1) */
  next(): number {
    this.s = (this.s + 0x6d2b79f5) | 0;
    let t = Math.imul(this.s ^ (this.s >>> 15), 1 | this.s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Return pseudo-random integer in [min, max] (inclusive) */
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /** Return pseudo-random BN in [min, max] (inclusive) */
  nextBN(min: BN, max: BN): BN {
    if (min.gte(max)) return min.clone();
    const diff = max.sub(min);
    const diffNum = diff.toNumber();
    if (diffNum > 0 && diffNum <= Number.MAX_SAFE_INTEGER) {
      const offset = Math.floor(this.next() * (diffNum + 1));
      return min.add(new BN(offset));
    }
    // For very large BNs, generate via high/low bits
    const r = this.next();
    const scale = new BN(Math.floor(r * 1000000));
    const offset = diff.mul(scale).div(new BN(1000000));
    return min.add(offset);
  }

  /** Pick a random item from array */
  pick<T>(items: T[]): T {
    if (items.length === 0) throw new Error('Cannot pick from empty array');
    const idx = Math.floor(this.next() * items.length);
    return items[idx];
  }

  /** Shuffle array in-place using Fisher-Yates */
  shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
}
