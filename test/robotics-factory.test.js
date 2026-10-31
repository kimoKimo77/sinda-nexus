import test from "node:test";
import assert from "node:assert/strict";
import { RobotDesignStudio, validateRobotDesign } from "../src/robotics-factory/design-studio.js";
import { runVirtualLocomotion, validateLocomotionScenario } from "../src/robotics-factory/simulation.js";

const design = (overrides = {}) => ({
  designId: "edu-bot-01", projectId: "project-alpha", name: "Educational Explorer",
  version: 1, motionModel: "biped-walk",
  sensors: [{ type: "virtual-imu", label: "Body IMU" }, { type: "virtual-camera", label: "Front Camera" }],
  actuators: [{ type: "virtual-joint", label: "Left Leg" }, { type: "virtual-joint", label: "Right Leg" }],
  body: { massKg: 4, heightMetres: 0.45, widthMetres: 0.25 },
  ...overrides
});
const scenario = (robot = design(), overrides = {}) => ({
  design: robot, steps: 100, dt: 0.02, strideLength: 0.25, cadence: 1.5, slipRatio: 0.1, seed: 42, ...overrides
});

test("design studio creates immutable versioned virtual designs", () => {
  const studio = new RobotDesignStudio();
  const created = studio.create(design(), { projectId: "project-alpha" });
  assert.equal(created.executionTarget, "virtual-only");
  assert.equal(studio.get("edu-bot-01", 1, { projectId: "project-alpha" }).name, "Educational Explorer");
  assert.equal(studio.list({ projectId: "project-alpha" }).length, 1);
});

test("design studio enforces project isolation on create, get, and list", () => {
  const studio = new RobotDesignStudio();
  studio.create(design(), { projectId: "project-alpha" });
  assert.throws(() => studio.create(design(), { projectId: "project-beta" }), /scope mismatch/);
  assert.throws(() => studio.get("edu-bot-01", 1, { projectId: "project-beta" }), /not found/);
  assert.equal(studio.list({ projectId: "project-beta" }).length, 0);
});

test("design studio rejects duplicate versions and prevents caller mutation", () => {
  const studio = new RobotDesignStudio();
  const created = studio.create(design(), { projectId: "project-alpha" });
  created.sensors[0].label = "mutated";
  assert.equal(studio.get("edu-bot-01", 1, { projectId: "project-alpha" }).sensors[0].label, "Body IMU");
  assert.throws(() => studio.create(design(), { projectId: "project-alpha" }), /already exists/);
});

test("design validation rejects physical device fields and unsupported components", () => {
  assert.throws(() => validateRobotDesign(design({ deviceId: "real-device" })), /unsupported fields/);
  assert.throws(() => validateRobotDesign(design({ sensors: [{ type: "camera", label: "real camera" }] })), /unsupported virtual component/);
  assert.throws(() => validateRobotDesign(design({ actuators: [{ type: "motor", label: "motor" }] })), /unsupported virtual component/);
});

test("design validation enforces bounded body dimensions and component counts", () => {
  assert.throws(() => validateRobotDesign(design({ body: { massKg: 500, heightMetres: 0.4, widthMetres: 0.2 } })), /massKg/);
  assert.throws(() => validateRobotDesign(design({ sensors: [] })), /1 to 12/);
});

test("simulator connects versioned designs to three distinct motion profiles", () => {
  const cases = [
    ["biped-walk", "Bipedal walk"],
    ["quadruped-trot", "Quadruped trot"],
    ["soft-crawl", "Soft crawl"]
  ];
  for (const [motionModel, expected] of cases) {
    const result = runVirtualLocomotion(scenario(design({ motionModel })));
    assert.equal(result.profile, expected);
    assert.equal(result.design.motionModel, motionModel);
    assert.ok(result.metrics.distanceMetres > 0);
    assert.ok(result.metrics.stabilityIndex > 0 && result.metrics.stabilityIndex <= 1);
    assert.ok(result.metrics.energyProxyJoules > 0);
    assert.equal(result.safety.physicalActuation, false);
    assert.equal(result.safety.hardwareAccess, false);
    assert.equal(result.safety.biologicalMaterials, false);
    assert.equal(result.safety.networkAccess, false);
  }
});

test("simulation is deterministic and rejects unknown physical capability fields", () => {
  assert.deepEqual(runVirtualLocomotion(scenario()), runVirtualLocomotion(scenario()));
  assert.throws(() => validateLocomotionScenario(scenario(design(), { motorCommand: "move" })), /Unsupported scenario field/);
  assert.throws(() => validateLocomotionScenario(scenario(design(), { deviceId: "robot-1" })), /Unsupported scenario field/);
});

test("simulation rejects unbounded parameters and unsupported models", () => {
  assert.throws(() => validateLocomotionScenario(scenario(design(), { steps: 501 })), /steps must be/);
  assert.throws(() => validateLocomotionScenario(scenario(design(), { dt: 1 })), /dt must be/);
  assert.throws(() => validateLocomotionScenario(scenario(design({ motionModel: "unknown" }))), /Unsupported virtual motion model/);
});
