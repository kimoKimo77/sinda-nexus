import test from "node:test";
import assert from "node:assert/strict";
import { runVirtualLocomotion, validateLocomotionScenario } from "../src/robotics-factory/simulation.js";

const validScenario = {
  model: "virtual-bio-inspired-gait",
  steps: 100,
  dt: 0.02,
  strideLength: 0.25,
  cadence: 1.5,
  slipRatio: 0.1,
  seed: 42
};

test("validates and runs a bounded virtual locomotion scenario", () => {
  const result = runVirtualLocomotion(validScenario);
  assert.equal(result.mode, "simulation");
  assert.equal(result.metrics.durationSeconds, 2);
  assert.equal(result.metrics.distanceMetres, 0.675);
  assert.equal(result.safety.physicalActuation, false);
  assert.equal(result.safety.hardwareAccess, false);
  assert.equal(result.safety.biologicalMaterials, false);
  assert.equal(result.safety.networkAccess, false);
});

test("simulation is deterministic for the same versioned input", () => {
  assert.deepEqual(runVirtualLocomotion(validScenario), runVirtualLocomotion(validScenario));
});

test("rejects unsupported model types and unknown capability fields", () => {
  assert.throws(() => validateLocomotionScenario({ ...validScenario, model: "physical-robot" }), /Only the virtual/);
  assert.throws(() => validateLocomotionScenario({ ...validScenario, motorCommand: "move" }), /Unsupported scenario field/);
  assert.throws(() => validateLocomotionScenario({ ...validScenario, deviceId: "robot-1" }), /Unsupported scenario field/);
});

test("rejects unbounded or malformed simulation parameters", () => {
  assert.throws(() => validateLocomotionScenario({ ...validScenario, steps: 501 }), /steps must be/);
  assert.throws(() => validateLocomotionScenario({ ...validScenario, dt: 1 }), /dt must be/);
  assert.throws(() => validateLocomotionScenario({ ...validScenario, strideLength: -1 }), /strideLength must be/);
  assert.throws(() => validateLocomotionScenario({ ...validScenario, cadence: 100 }), /cadence must be/);
  assert.throws(() => validateLocomotionScenario({ ...validScenario, slipRatio: 2 }), /slipRatio must be/);
  assert.throws(() => validateLocomotionScenario({ ...validScenario, seed: -1 }), /seed must be/);
});

test("rejects non-plain objects and arrays", () => {
  assert.throws(() => validateLocomotionScenario([]), /plain scenario object/);
  assert.throws(() => validateLocomotionScenario(null), /plain scenario object/);
});
