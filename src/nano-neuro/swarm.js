const ACTIONS = new Set(["analyze", "classify", "simulate", "summarize"]);
export class SwarmCoordinator {
  #assignments = new Map();
  constructor({ registry, maxTasks = 50_000, maxTasksPerAgent = 1000 } = {}) {
    if (!registry) throw new TypeError("Agent registry is required");
    this.registry = registry;
    this.maxTasks = maxTasks;
    this.maxTasksPerAgent = maxTasksPerAgent;
  }
  delegate({ taskId, projectId, agentId, action, budget = 1 }) {
    if (typeof taskId !== "string" || !/^[a-zA-Z0-9._:-]{1,64}$/.test(taskId) || this.#assignments.has(taskId)) throw new Error("Invalid or duplicate task");
    const agent = this.registry.get(agentId);
    if (!agent || agent.projectId !== projectId) throw new Error("Agent is outside project scope");
    if (!ACTIONS.has(action) || !agent.capabilities.includes(action)) throw new Error("Task action is not authorized");
    if (!Number.isSafeInteger(budget) || budget < 1 || budget > 100) throw new RangeError("Task budget must be between 1 and 100");
    if (this.#assignments.size >= this.maxTasks) throw new Error("Swarm task budget exhausted");
    const assigned = [...this.#assignments.values()].filter(item => item.agentId === agentId).length;
    if (assigned >= this.maxTasksPerAgent) throw new Error("Agent task quota reached");
    const task = Object.freeze({ taskId, projectId, agentId, action, budget, status: "queued" });
    this.#assignments.set(taskId, task);
    return task;
  }
  snapshot() { return [...this.#assignments.values()]; }
}
