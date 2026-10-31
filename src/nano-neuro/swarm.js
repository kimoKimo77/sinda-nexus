const ACTIONS = new Set(["analyze", "classify", "simulate", "summarize"]);
const ID = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,63}$/;

export class SwarmCoordinator {
  #assignments = new Map();
  #agentTaskCounts = new Map();
  #projectTaskCounts = new Map();
  #registry;
  #maxTasks;
  #maxTasksPerProject;
  #maxTasksPerAgent;

  constructor({ registry, maxTasks = 50_000, maxTasksPerProject = 10_000, maxTasksPerAgent = 1000 } = {}) {
    if (!registry || typeof registry.get !== "function") throw new TypeError("Agent registry is required");
    if (!Number.isSafeInteger(maxTasks) || maxTasks < 1 || maxTasks > 100_000) throw new RangeError("Invalid total task quota");
    if (!Number.isSafeInteger(maxTasksPerProject) || maxTasksPerProject < 1 || maxTasksPerProject > 100_000) {
      throw new RangeError("Invalid per-project task quota");
    }
    if (!Number.isSafeInteger(maxTasksPerAgent) || maxTasksPerAgent < 1 || maxTasksPerAgent > 10_000) {
      throw new RangeError("Invalid per-agent task quota");
    }
    this.#registry = registry;
    this.#maxTasks = maxTasks;
    this.#maxTasksPerProject = maxTasksPerProject;
    this.#maxTasksPerAgent = maxTasksPerAgent;
  }

  delegate({ taskId, projectId, agentId, action, budget = 1 }) {
    if (typeof projectId !== "string" || !ID.test(projectId)
      || typeof agentId !== "string" || !ID.test(agentId)
      || typeof taskId !== "string" || !/^[a-zA-Z0-9._:-]{1,64}$/.test(taskId)) {
      throw new TypeError("Invalid project, agent or task identity");
    }
    const taskKey = `${projectId}\u0000${taskId}`;
    if (this.#assignments.has(taskKey)) throw new Error("Invalid or duplicate task in project");
    const agent = this.#registry.get(agentId, projectId);
    if (!agent) throw new Error("Agent is outside project scope");
    if (!ACTIONS.has(action) || !agent.capabilities.includes(action)) throw new Error("Task action is not authorized");
    if (!Number.isSafeInteger(budget) || budget < 1 || budget > 100) throw new RangeError("Task budget must be between 1 and 100");
    if (this.#assignments.size >= this.#maxTasks) throw new Error("Swarm task budget exhausted");

    const agentKey = `${projectId}\u0000${agentId}`;
    const assignedByAgent = this.#agentTaskCounts.get(agentKey) ?? 0;
    if (assignedByAgent >= this.#maxTasksPerAgent) throw new Error("Agent task quota reached");
    const assignedByProject = this.#projectTaskCounts.get(projectId) ?? 0;
    if (assignedByProject >= this.#maxTasksPerProject) throw new Error("Project task quota reached");

    const task = Object.freeze({ taskId, projectId, agentId, action, budget, status: "queued" });
    this.#assignments.set(taskKey, task);
    this.#agentTaskCounts.set(agentKey, assignedByAgent + 1);
    this.#projectTaskCounts.set(projectId, assignedByProject + 1);
    return task;
  }

  snapshot({ projectId } = {}) {
    if (typeof projectId !== "string" || !ID.test(projectId)) throw new TypeError("A valid project scope is required");
    return [...this.#assignments.values()].filter(task => task.projectId === projectId);
  }
}
