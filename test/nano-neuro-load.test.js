import test from "node:test";
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { AgentRegistry } from "../src/nano-neuro/agent-registry.js";
import { VirtualSensorHub } from "../src/nano-neuro/neural-sensors.js";
import { SwarmCoordinator } from "../src/nano-neuro/swarm.js";
import { createSimulation, createVirtualPopulation } from "../src/nano-neuro/simulator.js";

const previewApprovalVerifier = ({ approval, projectId, parent }) =>
  approval?.kind === "synthetic-preview-population"
  && approval.projectId === projectId
  && parent.projectId === projectId;

test("staged load smoke: 100, 1000, 5000 and 10000 virtual agents", { timeout: 60_000 }, () => {
  const stages = [100, 1_000, 5_000, 10_000];
  const observations = [];

  for (const target of stages) {
    const memoryBefore = process.memoryUsage();
    const started = performance.now();
    const simulation = createSimulation({
      projectId: `load-${target}`,
      maxAgents: target,
      seed: target,
      verifySpawnApproval: previewApprovalVerifier
    });

    const registryStarted = performance.now();
    const agents = createVirtualPopulation(simulation, { count: target - 1, seed: target });
    const registryMs = performance.now() - registryStarted;
    assert.equal(agents.length + 1, target);
    assert.equal(simulation.registry.list({ projectId: `load-${target}` }).length, target);

    const sensors = new VirtualSensorHub({ registry: simulation.registry, maxEventsPerAgent: 2 });
    const sensorStarted = performance.now();
    for (let index = 0; index < agents.length; index++) {
      sensors.ingest({
        agentId: agents[index].id,
        projectId: `load-${target}`,
        sensorType: "motion",
        value: (index % 100) / 100,
        timestamp: index + 1
      });
    }
    const sensorMs = performance.now() - sensorStarted;
    assert.equal(agents.reduce((sum, agent) => sum + sensors.count(agent.id, agent.projectId), 0), target - 1);

    const swarm = new SwarmCoordinator({
      registry: simulation.registry,
      maxTasks: target,
      maxTasksPerAgent: 1
    });
    const swarmStarted = performance.now();
    for (let index = 0; index < agents.length; index++) {
      swarm.delegate({
        taskId: `task-${target}-${index}`,
        projectId: `load-${target}`,
        agentId: agents[index].id,
        action: "analyze",
        budget: 1
      });
    }
    const swarmMs = performance.now() - swarmStarted;
    assert.equal(swarm.snapshot().length, target - 1);

    const memoryAfter = process.memoryUsage();
    observations.push({
      targetAgents: target,
      registryMs: Number(registryMs.toFixed(2)),
      sensorMs: Number(sensorMs.toFixed(2)),
      swarmMs: Number(swarmMs.toFixed(2)),
      totalMs: Number((performance.now() - started).toFixed(2)),
      heapDeltaMiB: Number(((memoryAfter.heapUsed - memoryBefore.heapUsed) / 1024 / 1024).toFixed(2)),
      rssMiB: Number((memoryAfter.rss / 1024 / 1024).toFixed(2))
    });
  }

  console.log(`[nano-neuro-load-observations] ${JSON.stringify(observations)}`);
  assert.deepEqual(observations.map(item => item.targetAgents), stages);
});
