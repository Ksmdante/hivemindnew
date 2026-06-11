// Deterministic seeded RNG (mulberry32). The engine never calls Math.random —
// the RNG state lives in the save, so replays and tests are reproducible.

export function nextRandom(state: { rng: number }): number {
  let t = (state.rng += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
