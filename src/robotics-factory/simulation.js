const MAX_STEPS = 500;
const ALLOWED_KEYS = new Set(["model", "steps", "dt", "strideLength", "cadence", "slipRatio", "seed"]);

function assertPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new TypeError("A plain scenario object is required.");
  }
}

export function validateLocomotionScenario(input) {
  assertPlainObject(input);
  for (const key of Object.keys(input)) {
    if (!ALLOWED_KEYS.has(key)) throw new TypeError(`Unsupported scenario field: ${key}`);
  }
  if (input.model !== "virtual-bio-inspired-gait") {
    throw new TypeError("Only the virtual bio-inspired gait model is available in Preview.");
  }
  const { steps, dt, strideLength, cadence, slipRatio, seed = 1 } = input;
  if (!Number.isInteger(steps) || steps < 1 || steps > MAX_STEPS) {
    throw new RangeError(`steps must be an integer from 1 to ${MAX_STEPS}.`);
  }
  if (!Number.isFinite(dt) || dt <= 0 || dt > 0.1) {
    throw new RangeError("dt must be finite and in the interval (0, 0.1].");
  }
  if (!Number.isFinite(strideLength) || strideLength < 0 || strideLength > 0.5) {
    throw new RangeError("strideLength must be finite and between 0 and 0.5 metres.");
  }
  if (!Number.isFinite(cadence) || cadence < 0 || cadence > 4) {
    throw new RangeError("cadence must be finite and between 0 and 4 cycles per second.");
  }
  if (!Number.isFinite(slipRatio) || slipRatio < 0 || slipRatio > 1) {
    throw new RangeError("slipRatio must be between 0 and 1.");
  }
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new RangeError("seed must be an unsigned 32-bit integer.");
  }
  return Object.freeze({ model: input.model, steps, dt, strideLength, cadence, slipRatio, seed });
}

export function runVirtualLocomotion(input) {
  const scenario = validateLocomotionScenario(input);
  const effectiveStride = scenario.strideLength * (1 - scenario.slipRatio);
  const distance = scenario.steps * effectiveStride * scenario.cadence * scenario.dt;
  const duration = scenario.steps * scenario.dt;
  const result = {
    mode: "simulation",
    model: scenario.model,
    scenario: { ...scenario },
    metrics: {
      durationSeconds: Number(duration.toFixed(6)),
      distanceMetres: Number(distance.toFixed(6)),
      averageSpeedMetresPerSecond: Number((distance / duration).toFixed(6)),
      slipRatio: scenario.slipRatio
    },
    safety: {
      physicalActuation: false,
      hardwareAccess: false,
      biologicalMaterials: false,
      networkAccess: false
    }
  };
  return Object.freeze(result);
}
