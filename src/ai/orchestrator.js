import { DecisionEngine } from "./decision-engine.js";
import { TaskPlanner, validatePlan } from "./task-planner.js";
import { PlanEvaluator } from "./evaluator.js";

export class SindaOrchestrator {
  constructor({ provider, memory, executor, auditLog, decisionEngine = new DecisionEngine() } = {}) {
    if (!provider || !memory || typeof executor !== "function") throw new TypeError("provider, project memory, and task executor are required.");
    this.provider = provider;
    this.memory = memory;
    this.executor = executor;
    this.auditLog = auditLog;
    this.decisionEngine = decisionEngine;
    this.planner = new TaskPlanner({ provider });
    this.evaluator = new PlanEvaluator({ provider });
  }

  async plan({ projectId, goal, constraints = [] } = {}) {
    const memories = await this.memory.search({ projectId, query: goal, limit: 12 });
    const plan = await this.planner.createPlan({ goal, projectContext: memories, constraints });
    await this.#audit({ event: "plan.created", projectId, taskCount: plan.tasks.length });
    return { projectId, plan, memoryReferences: memories.map(item => item.id) };
  }

  async execute({ projectId, plan, actor = "system" } = {}) {
    const safePlan = validatePlan(plan);
    if (typeof projectId !== "string" || !projectId.trim()) throw new TypeError("projectId is required.");
    const results = [];
    const completed = new Set();
    for (const task of safePlan.tasks) {
      const blockedBy = task.dependsOn.filter(id => !completed.has(id));
      if (blockedBy.length) {
        results.push({ taskId: task.id, status: "blocked", reason: "Dependencies not completed: " + blockedBy.join(", ") });
        continue;
      }
      const decision = this.decisionEngine.decide({ action: task.action === "test" || task.action === "evaluate" ? "analyze" : task.action, target: task.id, risk: task.risk });
      if (decision.decision !== "allow") {
        results.push({ taskId: task.id, status: "approval_required", decision });
        await this.#audit({ event: "task.held", projectId, taskId: task.id, actor, decision: decision.decision });
        continue;
      }
      try {
        const output = await this.executor({ projectId, task, actor });
        completed.add(task.id);
        results.push({ taskId: task.id, status: "completed", output });
        await this.#audit({ event: "task.completed", projectId, taskId: task.id, actor });
      } catch (error) {
        results.push({ taskId: task.id, status: "failed", error: error.message });
        await this.#audit({ event: "task.failed", projectId, taskId: task.id, actor, error: error.message });
      }
    }
    return { projectId, results, completedCount: completed.size, totalCount: safePlan.tasks.length };
  }

  async evaluate({ goal, plan, execution } = {}) {
    const evaluation = await this.evaluator.evaluate({ goal, plan, execution });
    await this.#audit({ event: "plan.evaluated", score: evaluation.score, passed: evaluation.passed });
    return evaluation;
  }

  async #audit(entry) { if (typeof this.auditLog === "function") await this.auditLog({ ...entry, at: new Date().toISOString() }); }
}
