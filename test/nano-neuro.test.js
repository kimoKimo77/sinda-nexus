import test from "node:test";
import assert from "node:assert/strict";
import { AgentRegistry } from "../src/nano-neuro/agent-registry.js";
import { createGenome, mutateGenome, crossoverGenomes } from "../src/nano-neuro/genome.js";
import { VirtualSensorHub } from "../src/nano-neuro/neural-sensors.js";
import { SwarmCoordinator } from "../src/nano-neuro/swarm.js";
import { fuseCapabilities } from "../src/nano-neuro/fusion.js";
import { createSimulation, createVirtualPopulation } from "../src/nano-neuro/simulator.js";

test("adaptive child creation requires project-scoped human approval and cannot escalate", () => {
  const registry = new AgentRegistry({ maxAgents: 4, maxDepth: 2, maxChildren: 2 });
  registry.createRoot({ id: "root", projectId: "p", capabilities: ["analyze"] });
  assert.throws(() => registry.spawnChild({ id: "child", parentId: "root", projectId: "p" }), /approval/);
  assert.throws(() => registry.spawnChild({ id: "child", parentId: "root", projectId: "p", capabilities: ["simulate"], approval: { approved: true, approvedBy: "owner", projectId: "p" } }), /escalate/);
  const child = registry.spawnChild({ id: "child", parentId: "root", projectId: "p", capabilities: ["analyze"], approval: { approved: true, approvedBy: "owner", projectId: "p" } });
  assert.equal(child.depth, 1);
  assert.throws(() => registry.spawnChild({ id: "other", parentId: "root", projectId: "other", approval: { approved: true, approvedBy: "owner", projectId: "other" } }), /scope/);
});

test("registry enforces identity, capacity, child and depth quotas", () => {
  const registry = new AgentRegistry({ maxAgents: 3, maxDepth: 1, maxChildren: 1 });
  registry.createRoot({ id: "root", projectId: "p", capabilities: ["analyze"] });
  const approval = { approved: true, approvedBy: "owner", projectId: "p" };
  registry.spawnChild({ id: "child", parentId: "root", projectId: "p", capabilities: ["analyze"], approval });
  assert.throws(() => registry.spawnChild({ id: "child2", parentId: "root", projectId: "p", capabilities: ["analyze"], approval }), /child quota/);
  assert.throws(() => registry.spawnChild({ id: "grandchild", parentId: "child", projectId: "p", capabilities: ["analyze"], approval }), /depth/);
  assert.throws(() => new AgentRegistry({ maxAgents: 10_001 }), /10000/);
});

test("digital genome mutation is deterministic and bounded", () => {
  const genome = createGenome({ seed: 7 });
  const a = mutateGenome(genome, { seed: 99, rate: 1, magnitude: 0.2 });
  const b = mutateGenome(genome, { seed: 99, rate: 1, magnitude: 0.2 });
  assert.deepEqual(a, b);
  assert.ok(Object.values(a.traits).every(value => value >= 0 && value <= 1));
  assert.throws(() => mutateGenome(genome, { rate: 2 }), /parameters/);
  assert.throws(() => createGenome({ traits: { malicious: 1 } }), /allow-listed/);
});

test("digital genome crossover accepts only versioned bounded traits", () => {
  const a = createGenome({ seed: 1, traits: { adaptability: 0, learning: 0, stability: 0 } });
  const b = createGenome({ seed: 2, traits: { adaptability: 1, learning: 1, stability: 1 } });
  assert.deepEqual(crossoverGenomes(a, b, { seed: 3 }), crossoverGenomes(a, b, { seed: 3 }));
  assert.throws(() => crossoverGenomes({}, b), /version/);
});

test("virtual sensors reject hardware, unknown types, invalid values and event floods", () => {
  const sensors = new VirtualSensorHub({ maxEventsPerAgent: 2 });
  const event = sensors.ingest({ agentId: "a", projectId: "p", sensorType: "motion", value: 0.5, timestamp: 1 });
  assert.equal(event.source, "virtual");
  assert.throws(() => sensors.ingest({ agentId: "a", projectId: "p", sensorType: "implant", value: 1 }), /allow-listed/);
  assert.throws(() => sensors.ingest({ agentId: "a", projectId: "p", sensorType: "pulse", value: Infinity }), /bounds/);
  sensors.ingest({ agentId: "a", projectId: "p", sensorType: "thermal", value: 22 });
  assert.throws(() => sensors.ingest({ agentId: "a", projectId: "p", sensorType: "motion", value: 0 }), /quota/);
});

test("swarm task delegation enforces project, capability, action and budget", () => {
  const registry = new AgentRegistry();
  registry.createRoot({ id: "root", projectId: "p", capabilities: ["analyze"] });
  const swarm = new SwarmCoordinator({ registry, maxTasks: 2, maxTasksPerAgent: 1 });
  assert.throws(() => swarm.delegate({ taskId: "x", projectId: "p", agentId: "root", action: "delete" }), /authorized/);
  assert.throws(() => swarm.delegate({ taskId: "x", projectId: "other", agentId: "root", action: "analyze" }), /scope/);
  swarm.delegate({ taskId: "x", projectId: "p", agentId: "root", action: "analyze" });
  assert.throws(() => swarm.delegate({ taskId: "y", projectId: "p", agentId: "root", action: "analyze" }), /quota/);
  assert.throws(() => swarm.delegate({ taskId: "x", projectId: "p", agentId: "root", action: "analyze" }), /duplicate/);
});

test("fusion uses same-project intersection and explicit allowlist", () => {
  const agents = [
    { id: "a", projectId: "p", capabilities: ["analyze", "simulate"] },
    { id: "b", projectId: "p", capabilities: ["analyze", "classify"] }
  ];
  assert.deepEqual(fuseCapabilities(agents, { projectId: "p", approvedCapabilities: ["analyze", "simulate"] }).capabilities, ["analyze"]);
  assert.throws(() => fuseCapabilities([agents[0], { ...agents[1], projectId: "q" }], { projectId: "p" }), /Cross-project/);
});

test("simulation creates a bounded population of 10000 virtual agents", () => {
  const simulation = createSimulation({ projectId: "load-test", maxAgents: 10_000, seed: 42 });
  const population = createVirtualPopulation(simulation, { count: 9_999, seed: 42 });
  assert.equal(population.length, 9_999);
  assert.equal(simulation.registry.list({ projectId: "load-test" }).length, 10_000);
  assert.throws(() => createVirtualPopulation(simulation, { count: 10_000 }), /capacity/);
  assert.equal(simulation.config.platform, "web");
  assert.equal(simulation.config.sensors, "virtual");
});
