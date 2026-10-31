const ACTIONS = new Set(["analyze", "read", "write", "test", "evaluate"]);

export function validatePlan(value) {
  if (!value || typeof value !== "object" || !Array.isArray(value.tasks) || value.tasks.length > 30) {
    throw new TypeError("Plan must contain a tasks array with at most 30 tasks.");
  }
  const ids = new Set();
  const tasks = value.tasks.map((task, index) => {
    if (!task || typeof task !== "object") throw new TypeError("Invalid task at index " + index + ".");
    const id = String(task.id ?? "");
    const action = String(task.action ?? "");
    const description = String(task.description ?? "");
    if (!/^[a-zA-Z0-9_-]{1,40}$/.test(id) || ids.has(id)) throw new TypeError("Task IDs must be unique safe identifiers.");
    if (!ACTIONS.has(action)) throw new TypeError("Unsupported task action: " + action);
    if (!description.trim() || description.length > 2000) throw new TypeError("Task description is required and must be under 2000 characters.");
    ids.add(id);
    return { id, action, description, dependsOn: Array.isArray(task.dependsOn) ? task.dependsOn.map(String) : [], risk: task.risk === "high" ? "high" : task.risk === "medium" ? "medium" : "low" };
  });
  const completed = new Set();
  for (const task of tasks) {
    if (task.dependsOn.some(dep => !ids.has(dep) || dep === task.id)) throw new TypeError("Task dependency is missing or self-referential.");
    if (task.dependsOn.some(dep => !completed.has(dep))) throw new TypeError("Tasks must be ordered after their dependencies.");
    completed.add(task.id);
  }
  return { summary: String(value.summary ?? "Generated project plan").slice(0, 500), tasks };
}

export class TaskPlanner {
  constructor({ provider } = {}) {
    if (!provider || typeof provider.generateJSON !== "function") throw new TypeError("A JSON-generating provider is required.");
    this.provider = provider;
  }

  async createPlan({ goal, projectContext = [], constraints = [] } = {}) {
    if (typeof goal !== "string" || !goal.trim()) throw new TypeError("A task goal is required.");
    const result = await this.provider.generateJSON({
      system: "You are a careful software planning assistant. Return JSON only with shape {summary:string,tasks:[{id,action,description,dependsOn,risk}]}. Allowed actions: analyze, read, write, test, evaluate. Prefer small reversible tasks. Put each dependency before the task that depends on it. Never propose deployment, deletion, financial transactions, credential access, or permission escalation. Mark uncertain/high-impact tasks risk high.",
      input: JSON.stringify({ goal, projectContext, constraints })
    });
    return validatePlan(result);
  }
}
