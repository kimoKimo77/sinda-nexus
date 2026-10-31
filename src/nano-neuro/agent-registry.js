const CAPABILITIES = new Set(["analyze", "classify", "simulate", "summarize"]);
const ID = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,63}$/;
const GENOME_TRAITS = ["adaptability", "learning", "stability"];

function cleanCapabilities(values = []) {
  if (!Array.isArray(values) || values.length > CAPABILITIES.size) throw new TypeError("Invalid capabilities");
  const result = [...new Set(values)];
  if (result.some(value => !CAPABILITIES.has(value))) throw new Error("Capability is not allow-listed");
  return result.sort();
}

function cleanGenome(genome) {
  if (genome === null) return null;
  if (!genome || typeof genome !== "object" || Array.isArray(genome)
    || Object.getPrototypeOf(genome) !== Object.prototype
    || genome.schemaVersion !== 1 || !Number.isSafeInteger(genome.seed)
    || genome.seed < 0 || genome.seed > 0xffffffff) {
    throw new TypeError("Genome must be a version-1 digital genome");
  }
  const traits = genome.traits;
  if (!traits || typeof traits !== "object" || Array.isArray(traits)
    || Object.getPrototypeOf(traits) !== Object.prototype
    || Object.keys(traits).length !== GENOME_TRAITS.length
    || Object.keys(traits).some(key => !GENOME_TRAITS.includes(key))
    || GENOME_TRAITS.some(key => !Number.isFinite(traits[key]) || traits[key] < 0 || traits[key] > 1)) {
    throw new RangeError("Genome traits must be the bounded digital trait allowlist");
  }
  return Object.freeze({
    schemaVersion: 1,
    seed: genome.seed,
    traits: Object.freeze(Object.fromEntries(GENOME_TRAITS.map(key => [key, traits[key]])))
  });
}

function cleanApproval(approval) {
  if (!approval || typeof approval !== "object" || Array.isArray(approval)
    || (Object.getPrototypeOf(approval) !== Object.prototype && Object.getPrototypeOf(approval) !== null)) {
    throw new TypeError("Approval ticket must be a plain JSON object");
  }
  let serialized;
  try { serialized = JSON.stringify(approval); } catch { throw new TypeError("Approval ticket must be serializable"); }
  if (!serialized || serialized.length > 4096) throw new RangeError("Approval ticket is empty or too large");
  return Object.freeze(JSON.parse(serialized));
}

export class AgentRegistry {
  #agents = new Map();
  #childCounts = new Map();
  #verifySpawnApproval;

  constructor({ maxAgents = 10_000, maxDepth = 4, maxChildren = 100, verifySpawnApproval = null } = {}) {
    if (!Number.isSafeInteger(maxAgents) || maxAgents < 1 || maxAgents > 10_000) throw new RangeError("maxAgents must be between 1 and 10000");
    if (!Number.isSafeInteger(maxDepth) || maxDepth < 0 || maxDepth > 8) throw new RangeError("Invalid maxDepth");
    if (!Number.isSafeInteger(maxChildren) || maxChildren < 1 || maxChildren > 100) throw new RangeError("Invalid maxChildren");
    if (verifySpawnApproval !== null && typeof verifySpawnApproval !== "function") throw new TypeError("Spawn approval verifier must be a trusted function");
    this.#verifySpawnApproval = verifySpawnApproval;
    this.limits = Object.freeze({ maxAgents, maxDepth, maxChildren });
  }

  createRoot({ id, projectId, capabilities = [], genome = null }) {
    this.#validateIdentity(id, projectId);
    if (this.#agents.has(id)) throw new Error("Agent already exists");
    if (this.#agents.size >= this.limits.maxAgents) throw new Error("Agent capacity reached");
    const agent = Object.freeze({
      id, projectId, parentId: null, depth: 0,
      capabilities: Object.freeze(cleanCapabilities(capabilities)),
      genome: cleanGenome(genome)
    });
    this.#agents.set(id, agent);
    this.#childCounts.set(id, 0);
    return agent;
  }

  spawnChild({ id, parentId, projectId, capabilities = [], genome = null, approval }) {
    this.#validateIdentity(id, projectId);
    const parent = this.#agents.get(parentId);
    if (!parent || parent.projectId !== projectId) throw new Error("Parent is missing or outside project scope");
    if (this.#agents.has(id)) throw new Error("Agent already exists");
    if (this.#agents.size >= this.limits.maxAgents) throw new Error("Agent capacity reached");
    if ((this.#childCounts.get(parentId) ?? 0) >= this.limits.maxChildren) throw new Error("Parent child quota reached");
    const depth = parent.depth + 1;
    if (depth > this.limits.maxDepth) throw new Error("Agent depth limit reached");
    const requested = cleanCapabilities(capabilities);
    if (requested.some(capability => !parent.capabilities.includes(capability))) throw new Error("Child cannot escalate parent capabilities");
    if (!this.#verifySpawnApproval) throw new Error("No trusted spawn approval verifier is configured");
    const ticket = cleanApproval(approval);
    const context = Object.freeze({
      approval: ticket, parent, childId: id, projectId, capabilities: Object.freeze(requested)
    });
    if (this.#verifySpawnApproval(context) !== true) throw new Error("Trusted spawn approval was not verified");

    const agent = Object.freeze({
      id, projectId, parentId, depth,
      capabilities: Object.freeze(requested),
      genome: cleanGenome(genome)
    });
    this.#agents.set(id, agent);
    this.#childCounts.set(id, 0);
    this.#childCounts.set(parentId, (this.#childCounts.get(parentId) ?? 0) + 1);
    return agent;
  }

  get(id) { return this.#agents.get(id) ?? null; }
  list({ projectId } = {}) {
    return [...this.#agents.values()].filter(agent => !projectId || agent.projectId === projectId);
  }

  #validateIdentity(id, projectId) {
    if (typeof id !== "string" || !ID.test(id) || typeof projectId !== "string" || !ID.test(projectId)) {
      throw new TypeError("Invalid agent or project identity");
    }
  }
}
