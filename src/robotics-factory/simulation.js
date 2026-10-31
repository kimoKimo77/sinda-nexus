import { validateRobotDesign } from "./design-studio.js";

const MAX_STEPS = 500;
const MODELS = new Set(["biped-walk", "quadruped-trot", "soft-crawl"]);
const ALLOWED_KEYS = new Set(["design", "steps", "dt", "strideLength", "cadence", "slipRatio", "seed"]);

export function validateLocomotionScenario(input) {
  if (!input || typeof input !== "object" || Array.isArray(input) || Object.getPrototypeOf(input) !== Object.prototype) {
    throw new TypeError("A plain scenario object is required.");
  }
  for (const key of Object.keys(input)) {
    if (!ALLOWED_KEYS.has(key)) throw new TypeError(`Unsupported scenario field: ${key}`);
  }
  const design = validateRobotDesign(input.design);
  if (!MODELS.has(design.motionModel)) throw new TypeError("Unsupported virtual motion model.");
  const { steps, dt, strideLength, cadence, slipRatio, seed = 1 } = input;
  if (!Number.isInteger(steps) || steps < 1 || steps > MAX_STEPS) throw new RangeError(`steps must be an integer from 1 to ${MAX_STEPS}.`);
  if (!Number.isFinite(dt) || dt <= 0 || dt > 0.1) throw new RangeError("dt must be finite and in the interval (0, 0.1].");
  if (!Number.isFinite(strideLength) || strideLength < 0 || strideLength > 0.5) throw new RangeError("strideLength must be finite and between 0 and 0.5 metres.");
  if (!Number.isFinite(cadence) || cadence < 0 || cadence > 4) throw new RangeError("cadence must be finite and between 0 and 4 cycles per second.");
  if (!Number.isFinite(slipRatio) || slipRatio < 0 || slipRatio > 1) throw new RangeError("slipRatio must be between 0 and 1.");
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new RangeError("seed must be an unsigned 32-bit integer.");
  return Object.freeze({ design, steps, dt, strideLength, cadence, slipRatio, seed });
}

export function runVirtualLocomotion(input) {
  const scenario = validateLocomotionScenario(input);
  const modelFactors = {
    "biped-walk": { efficiency: 0.92, stability: 0.78, label: "Bipedal walk" },
    "quadruped-trot": { efficiency: 0.97, stability: 0.9, label: "Quadruped trot" },
    "soft-crawl": { efficiency: 0.84, stability: 0.96, label: "Soft crawl" }
  };
  const profile = modelFactors[scenario.design.motionModel];
  const effectiveStride = scenario.strideLength * (1 - scenario.slipRatio) * profile.efficiency;
  const distance = scenario.steps * effectiveStride * scenario.cadence * scenario.dt;
  const duration = scenario.steps * scenario.dt;
  const averageSpeed = distance / duration;
  const energyProxy = scenario.design.body.massKg * distance * (1 + scenario.slipRatio) * (1 / profile.efficiency);
  const result = {
    mode: "simulation",
    design: { designId: scenario.design.designId, projectId: scenario.design.projectId, version: scenario.design.version, motionModel: scenario.design.motionModel },
    scenario: { steps: scenario.steps, dt: scenario.dt, strideLength: scenario.strideLength, cadence: scenario.cadence, slipRatio: scenario.slipRatio, seed: scenario.seed },
    metrics: {
      durationSeconds: Number(duration.toFixed(6)),
      distanceMetres: Number(distance.toFixed(6)),
      averageSpeedMetresPerSecond: Number(averageSpeed.toFixed(6)),
      stabilityIndex: Number((profile.stability * (1 - scenario.slipRatio * 0.5)).toFixed(6)),
      energyProxyJoules: Number(energyProxy.toFixed(6)),
      slipRatio: scenario.slipRatio
    },
    profile: profile.label,
    safety: { physicalActuation: false, hardwareAccess: false, biologicalMaterials: false, networkAccess: false }
  };
  return Object.freeze(result);
}
