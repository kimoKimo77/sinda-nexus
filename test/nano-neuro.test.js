import test from "node:test";
import assert from "node:assert/strict";
import { AgentRegistry } from "../src/nano-neuro/agent-registry.js";
import { createGenome, mutateGenome, crossoverGenomes } from "../src/nano-neuro/genome.js";
import { VirtualSensorHub } from "../src/nano-neuro/neural-sensors.js";
import { SwarmCoordinator } from "../src/nano-neuro/swarm.js";
import { fuseCapabilities } from "../src/nano-neuro/fusion.js";
import { createSimulation, createVirtualPopulation } from "../src/nano-neuro/simulator.js";

const testApprovalVerifier = ({ approval, projectId }) =>
  approval?.kind === "synthetic-preview-population" && approval.projectId === projectId;

test("spawn is deny-by-default and requires an injected trusted approval verifier", () => {
  const registry = new AgentRegistry();
  registry.createRoot({ id: "root", projectId: "p", capabilities: ["analyze"] });
  const spoofed = { approved: true, approvedBy: "owner", projectId: "p" };
  assert.throws(() => registry.spawnChild({
    id: "child", parentId: "root", projectId: "p", capabilities: ["analyze"], approval: spoofed
  }), /No trusted spawn approval verifier/);
  const rejectingRegistry = new AgentRegistry({ verifySpawnApproval: () => false });
  rejectingRegistry.createRoot({ id: "other-root", projectId: "p", capabilities: ["analyze"] });
  assert.throws(() => rejectingRegistry.spawnChild({
    id: "child", parentId: "other-root", projectId: "p", capabilities: ["analyze"], approval: spoofed
  }), /not verified/);
});

test("trusted approval verifier receives immutable project-bound context", () => {
  let calls = 0;
  const registry = new AgentRegistry({
    verifySpawnApproval: context => {
      calls++;
      return context.approval.ticketId === "ticket-123"
        && context.projectId === "p"
        && context.parent.id === "root"
        && Object.isFrozen(context)
        && Object.isFrozen(context.approval);
    }
  });
  registry.createRoot({ id: "root", projectId: "p", capabilities: ["analyze"] });
  const child = registry.spawnChild({
    id: "child", parentId: "root", projectId: "p", capabilities: ["analyze"], approval: { ticketId: "ticket-123" }
  });
  assert.equal(child.depth, 1);
  assert.equal(calls, 1);
});

test("agent registry blocks escalation, cross-project parenting, and invalid genome payloads", () => {
  const registry = new AgentRegistry({ maxAgents: 4, maxDepth: 2, maxChildren: 2, verifySpawnApproval: testApprovalVerifier });
  registry.createRoot({ id: "root", projectId: "p", capabilities: ["analyze"] });
  const approval = { kind: "synthetic-preview-population", projectId: "p" };
  assert.throws(() => registry.spawnChild({
    id: "escalated", parentId: "root", projectId: "p", capabilities: ["simulate"], approval
  }), /escalate/);
  assert.throws(() => registry.spawnChild({
    id: "other", parentId: "root", projectId: "other", capabilities: ["analyze"],
    approval: { kind: "synthetic-preview-population", projectId: "other" }
  }), /project scope/);
  assert.throws(() => registry.createRoot({
    id: "bad-genome", projectId: "p", capabilities: [], genome: { schemaVersion: 1, seed: 1, traits: { adaptability: 1, learning: 1, stability: 1, extra: 1 } }
  }), /Genome traits/);
});

test("registry enforces identity, capacity, child and depth quotas", () => {
  const registry = new AgentRegistry({ maxAgents: 3, maxDepth: 1, maxChildren: 1, verifySpawnApproval: testApprovalVerifier });
  registry.createRoot({ id: "root", projectId: "p", capabilities: ["analyze"] });
  const approval = { kind: "synthetic-preview-population", projectId: "p" };
  registry.spawnChild({ id: "child", parentId: "root", projectId: "p", capabilities: ["analyze"], approval });
  assert.throws(() => registry.spawnChild({ id: "child2", parentId: "root", projectId: "p", capabilities: ["analyze"], approval }), /child quota/);
  assert.throws(() => registry.spawnChild({ id: "grandchild", parentId: "child", projectId: "p", capabilities: ["analyze"], approval }), /depth/);
  assert.throws(() => new AgentRegistry({ maxAgents: 10_001 }), /10000/);
});

test("digital genome mutation and crossover are deterministic and bounded", () => {
  const genome = createGenome({ seed: 7 });
  const a = mutateGenome(genome, { seed: 99, rate: 1, magnitude: 0.2 });
  const b = mutateGenome(genome, { seed: 99, rate: 1, magnitude: 0.2 });
  assert.deepEqual(a, b);
  assert.ok(Object.values(a.traits).every(value => value >= 0 && value <= 1));
  assert.throws(() => mutateGenome(genome, { rate: 2 }), /parameters/);
  assert.throws(() => mutateGenome(genome, { seed: -1 }), /Seed/);
  assert.throws(() => createGenome({ traits: { malicious: 1 } }), /allow-listed/);
  const other = createGenome({ seed: 8, traits: { adaptability: 1, learning: 1, stability: 1 } });
  assert.deepEqual(crossoverGenomes(genome, other, { seed: 3 }), crossoverGenomes(genome, other, { seed: 3 }));
  assert.throws(() => crossoverGenomes(genome, other, { seed: -1 }), /Seed/);
});

test("virtual sensors accept only registered agents in the matching project", () => {
  const registry = new AgentRegistry();
  registry.createRoot({ id: "agent-a", projectId: "alpha", capabilities: ["analyze"] });
  const sensors = new VirtualSensorHub({ registry, maxEventsPerAgent: 2 });
  const event = sensors.ingest({ agentId: "agent-a", projectId: "alpha", sensorType: "motion", value: 0.5, timestamp: 1 });
  assert.equal(event.source, "virtual");
  assert.throws(() => sensors.ingest({ agentId: "agent-a", projectId: "beta", sensorType: "motion", value: 1 }), /not registered/);
  assert.throws(() => sensors.ingest({ agentId: "spoofed", projectId: "alpha", sensorType: "motion", value: 1 }), /not registered/);
  assert.throws(() => sensors.ingest({ agentId: "agent-a", projectId: "alpha", sensorType: "implant", value: 1 }), /allow-listed/);
  assert.throws(() => sensors.ingest({ agentId: "agent-a", projectId: "alpha", sensorType: "pulse", value: Infinity }), /bounds/);
  sensors.ingest({ agentId: "agent-a", projectId: "alpha", sensorType: "thermal", value: 22 });
  assert.throws(() => sensors.ingest({ agentId: "agent-a", projectId: "alpha", sensorType: "motion", value: 0 }), /quota/);
  assert.equal(sensors.count("agent-a", "alpha"), 2);
});

test("swarm delegation validates quotas, indexes counts and enforces project scope", () => {
  const registry = new AgentRegistry();
  registry.createRoot({ id: "root", projectId: "p", capabilities: ["analyze"] });
  const swarm = new SwarmCoordinator({ registry, maxTasks: 2, maxTasksPerAgent: 1 });
  assert.throws(() => new SwarmCoordinator({ registry, maxTasks: 0 }), /quota/);
  assert.throws(() => swarm.delegate({ taskId: "x", projectId: "p", agentId: "root", action: "delete" }), /authorized/);
  assert.throws(() => swarm.delegate({ taskId: "x", projectId: "other", agentId: "root", action: "analyze" }), /scope/);
  swarm.delegate({ taskId: "x", projectId: "p", agentId: "root", action: "analyze" });
  assert.throws(() => swarm.delegate({ taskId: "y", projectId: "p", agentId: "root", action: "analyze" }), /quota/);
  assert.throws(() => swarm.delegate({ taskId: "x", projectId: "p", agentId: "root", action: "analyze" }), /duplicate/);
});

test("fusion resolves sources from registry and applies same-project intersection", () => {
  const registry = new AgentRegistry();
  registry.createRoot({ id: "a", projectId: "p", capabilities: ["analyze", "simulate"] });
  registry.createRoot({ id: "b", projectId: "p", capabilities: ["analyze", "classify"] });
  const result = fuseCapabilities(registry, ["a", "b"], { projectId: "p", approvedCapabilities: ["analyze", "simulate"] });
  assert.deepEqual(result.capabilities, ["analyze"]);
  assert.throws(() => fuseCapabilities(registry, ["a", "missing"], { projectId: "p" }), /missing/);
  assert.throws(() => fuseCapabilities(registry, ["a", "a"], { projectId: "p" }), /distinct/);
  assert.throws(() => fuseCapabilities(registry, ["a", "b"], { projectId: "other" }), /project scope/);
});

test("simulation population creation remains bounded and fails closed without verifier", () => {
  const unverified = createSimulation({ projectId: "unverified", maxAgents: 10 });
  assert.throws(() => createVirtualPopulation(unverified, { count: 2 }), /No trusted spawn approval verifier/);
  const simulation = createSimulation({
    projectId: "load-test", maxAgents: 10_000, seed: 42,
    verifySpawnApproval: testApprovalVerifier
  });
  const population = createVirtualPopulation(simulation, { count: 9_999, seed: 42 });
  assert.equal(population.length, 9_999);
  assert.equal(simulation.registry.list({ projectId: "load-test" }).length, 10_000);
  assert.throws(() => createVirtualPopulation(simulation, { count: 10_000 }), /capacity/);
  assert.equal(simulation.config.platform, "web");
  assert.equal(simulation.config.sensors, "virtual");
});
