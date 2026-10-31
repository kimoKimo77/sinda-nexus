const TRAITS = ["adaptability", "learning", "stability"];
const clamp = value => Math.max(0, Math.min(1, value));
function validateTraits(traits) {
  if (!traits || typeof traits !== "object" || Array.isArray(traits)) throw new TypeError("Genome traits are required");
  const keys = Object.keys(traits);
  if (keys.some(key => !TRAITS.includes(key)) || TRAITS.some(key => !Number.isFinite(traits[key]) || traits[key] < 0 || traits[key] > 1)) {
    throw new RangeError("Genome traits must be allow-listed numbers from 0 to 1");
  }
  return Object.fromEntries(TRAITS.map(key => [key, traits[key]]));
}
function rng(seed) {
  let state = seed >>> 0;
  return () => { state = (1664525 * state + 1013904223) >>> 0; return state / 0x100000000; };
}
export function createGenome({ seed = 1, traits = { adaptability: 0.5, learning: 0.5, stability: 0.5 } } = {}) {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) throw new RangeError("Seed must be an unsigned 32-bit integer");
  return Object.freeze({ schemaVersion: 1, seed, traits: Object.freeze(validateTraits(traits)) });
}
export function mutateGenome(genome, { seed = genome?.seed, rate = 0.1, magnitude = 0.1 } = {}) {
  if (!genome || genome.schemaVersion !== 1 || !Number.isFinite(rate) || rate < 0 || rate > 1 || !Number.isFinite(magnitude) || magnitude < 0 || magnitude > 0.25) {
    throw new RangeError("Invalid genome mutation parameters");
  }
  const random = rng(seed);
  const traits = validateTraits(genome.traits);
  for (const key of TRAITS) if (random() < rate) traits[key] = clamp(traits[key] + (random() * 2 - 1) * magnitude);
  return createGenome({ seed, traits });
}
export function crossoverGenomes(left, right, { seed = 1 } = {}) {
  if (left?.schemaVersion !== 1 || right?.schemaVersion !== 1) throw new TypeError("Unsupported genome version");
  const a = validateTraits(left.traits); const b = validateTraits(right.traits); const random = rng(seed);
  return createGenome({ seed, traits: Object.fromEntries(TRAITS.map(key => [key, random() < 0.5 ? a[key] : b[key]])) });
}
