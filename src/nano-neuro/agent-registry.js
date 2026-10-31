const CAPABILITIES = new Set(["analyze", "classify", "simulate", "summarize"]);
const ID = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,63}$/;

function cleanCapabilities(values = []) {
  if (!Array.isArray(values) || values.length > CAPABILITIES.size) throw new TypeError("Invalid capabilities");
  const result = [...new Set(values)];
  if (result.some(value => !CAPABILITIES.has(value))) throw new Error("Capability is not allow-listed");
  return result.sort();
}

export class AgentRegistry {
  #agents = new Map();
  constructor({ maxAgents = 10_000, maxDepth = 4, maxChildren = 100 } = {}) {
    if (!Number.isSafeInteger(maxAgents) || maxAgents < 1 || maxAgents > 10_000) throw new RangeError("maxAgents must be between 1 and 10000");
    if (!Number.isSafeInteger(maxDepth) || maxDepth < 0 || maxDepth > 8) throw new RangeError("Invalid maxDepth");
    if (!Number.isSafeInteger(maxChildren) || maxChildren < 1 || maxChildren > 100) throw new RangeError("Invalid maxChildren");
    this.limits = Object.freeze({ maxAgents, maxDepth, maxChildren });
  }
  createRoot({ id, projectId, capabilities = [], genome = null }) {
    this.#validateIdentity(id, projectId);
    if (this.#agents.size >= this.limits.maxAgents) throw new Error("Agent capacity reached");
    const agent = Object.freeze({ id, projectId, parentId: null, depth: 0, capabilities: Object.freeze(cleanCapabilities(capabilities)), genome });
    if (this.#agents.has(id)) throw new Error("Agent already exists");
    this.#agents.set(id, agent);
    return agent;
  }
  spawnChild({ id, parentId, projectId, capabilities = [], genome = null, approval }) {
    this.#validateIdentity(id, projectId);
    const parent = this.#agents.get(parentId);
    if (!parent || parent.projectId !== projectId) throw new Error("Parent is missing or outside project scope");
    if (!approval || approval.approved !== true || typeof approval.approvedBy !== "string" || !approval.approvedBy.trim() || approval.projectId !== projectId) {
      throw new Error("Explicit project-scoped spawn approval required");
    }
    if (this.#agents.has(id)) throw new Error("Agent already exists");
    if (this.#agents.size >= this.limits.maxAgents) throw new Error("Agent capacity reached");
    const children = [...this.#agents.values()].filter(agent => agent.parentId === parentId).length;
    if (children >= this.limits.maxChildren) throw new Error("Parent child quota reached");
    const depth = parent.depth + 1;
    if (depth > this.limits.maxDepth) throw new Error("Agent depth limit reached");
    const allowed = new Set(parent.capabilities);
    const requested = cleanCapabilities(capabilities);
    if (requested.some(capability => !allowed.has(capability))) throw new Error("Child cannot escalate parent capabilities");
    const agent = Object.freeze({ id, projectId, parentId, depth, capabilities: Object.freeze(requested), genome });
    this.#agents.set(id, agent);
    return agent;
  }
  get(id) { return this.#agents.get(id) ?? null; }
  list({ projectId } = {}) {
    return [...this.#agents.values()].filter(agent => !projectId || agent.projectId === projectId);
  }
  #validateIdentity(id, projectId) {
    if (typeof id !== "string" || !ID.test(id) || typeof projectId !== "string" || !ID.test(projectId)) throw new TypeError("Invalid agent or project identity");
  }
}
