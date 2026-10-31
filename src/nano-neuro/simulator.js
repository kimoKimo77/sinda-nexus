import { AgentRegistry } from "./agent-registry.js";
import { createGenome } from "./genome.js";
export const DEFAULT_SIMULATION = Object.freeze({ platform: "web", botSystem: "adaptive", algorithm: "digital", sensors: "virtual", maxAgents: 10_000 });
export function createSimulation({ projectId = "genesis-preview", maxAgents = 10_000, seed = 1 } = {}) {
  if (!Number.isSafeInteger(maxAgents) || maxAgents < 1 || maxAgents > 10_000) throw new RangeError("Simulation is capped at 10000 virtual agents");
  const registry = new AgentRegistry({ maxAgents, maxDepth: 4, maxChildren: 100 });
  const root = registry.createRoot({ id: "genesis-root", projectId, capabilities: ["analyze", "classify", "simulate", "summarize"], genome: createGenome({ seed }) });
  return Object.freeze({ config: Object.freeze({ ...DEFAULT_SIMULATION, maxAgents, projectId }), registry, root });
}
export function createVirtualPopulation(simulation, { count, seed = 1 } = {}) {
  if (!simulation?.registry || !Number.isSafeInteger(count) || count < 1 || count > simulation.config.maxAgents - 1) throw new RangeError("Population count exceeds configured virtual capacity");
  const agents = [];
  for (let i = 0; i < count; i++) {
    // Keep each parent at or below the configured fan-out of 100.
    // The first 100 agents are direct children of the root; later agents
    // are distributed across those children, keeping the test population shallow.
    const parent = i < 100 ? simulation.root : agents[Math.floor((i - 100) / 100)];
    const id = `agent-${String(i + 1).padStart(5, "0")}`;
    agents.push(simulation.registry.spawnChild({
      id, parentId: parent.id, projectId: simulation.config.projectId,
      capabilities: ["analyze", "classify", "simulate", "summarize"],
      genome: createGenome({ seed: (seed + i) >>> 0 }),
      approval: { approved: true, approvedBy: "preview-simulation-controller", projectId: simulation.config.projectId }
    }));
  }
  return agents;
}
