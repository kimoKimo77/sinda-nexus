const CAPABILITIES = new Set(["analyze", "classify", "simulate", "summarize"]);
const ID = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,63}$/;
const GENOME_TRAITS = ["adaptability", "learning", "stability"];

function readPlainDataRecord(value, expectedKeys = null, label = "Record") {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) {
    throw new TypeError(`${label} must be a plain object`);
  }
  const keys = Reflect.ownKeys(value);
  if (keys.some(key => typeof key !== "string")) throw new TypeError(`${label} cannot contain symbol keys`);
  if (expectedKeys && (keys.length !== expectedKeys.length || keys.some(key => !expectedKeys.includes(key)))) {
    throw new TypeError(`${label} has an unsupported schema`);
  }
  const result = {};
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, "value")) {
      throw new TypeError(`${label} cannot contain accessors or hidden fields`);
    }
    result[key] = descriptor.value;
  }
  return result;
}

function cleanCapabilities(values = []) {
  if (!Array.isArray(values) || values.length > CAPABILITIES.size) throw new TypeError("Invalid capabilities");
  const result = [...new Set(values)];
  if (result.some(value => !CAPABILITIES.has(value))) throw new Error("Capability is not allow-listed");
  return result.sort();
}

function cleanGenome(genome) {
  if (genome === null) return null;
  const data = readPlainDataRecord(genome, ["schemaVersion", "seed", "traits"], "Genome");
  if (data.schemaVersion !== 1 || !Number.isSafeInteger(data.seed) || data.seed < 0 || data.seed > 0xffffffff) {
    throw new TypeError("Genome must be a version-1 digital genome");
  }
  const traits = readPlainDataRecord(data.traits, GENOME_TRAITS, "Genome traits");
  if (GENOME_TRAITS.some(key => !Number.isFinite(traits[key]) || traits[key] < 0 || traits[key] > 1)) {
    throw new RangeError("Genome traits must be the bounded digital trait allowlist");
  }
  return Object.freeze({
    schemaVersion: 1,
    seed: data.seed,
    traits: Object.freeze(Object.fromEntries(GENOME_TRAITS.map(key => [key, traits[key]])))
  });
}

function cleanApproval(approval) {
  const ticket = readPlainDataRecord(approval, null, "Approval ticket");
  const keys = Object.keys(ticket);
  if (keys.length < 1 || keys.length > 8) throw new RangeError("Approval ticket must contain between 1 and 8 fields");
  for (const [key, value] of Object.entries(ticket)) {
    if (!/^[a-zA-Z][a-zA-Z0-9_]{0,31}$/.test(key)
      || !(value === null || ["string", "number", "boolean"].includes(typeof value))
      || (typeof value === "string" && value.length > 512)
      || (typeof value === "number" && !Number.isFinite(value))) {
      throw new TypeError("Approval ticket fields must be small scalar values");
    }
  }
  return Object.freeze(ticket);
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
    const safeGenome = cleanGenome(genome);
    const context = Object.freeze({
      action: "agent.spawn",
      approval: ticket,
      parent,
      childId: id,
      projectId,
      capabilities: Object.freeze(requested)
    });
    const verdict = this.#verifySpawnApproval(context);
    if (verdict && typeof verdict.then === "function") {
      Promise.resolve(verdict).catch(() => {});
      throw new TypeError("Spawn approval verifier must be synchronous");
    }
    if (verdict !== true) throw new Error("Trusted spawn approval was not verified");

    const agent = Object.freeze({
      id, projectId, parentId, depth,
      capabilities: Object.freeze(requested),
      genome: safeGenome
    });
    this.#agents.set(id, agent);
    this.#childCounts.set(id, 0);
    this.#childCounts.set(parentId, (this.#childCounts.get(parentId) ?? 0) + 1);
    return agent;
  }

  get(id, projectId) {
    this.#validateIdentity(id, projectId);
    const agent = this.#agents.get(id);
    return agent?.projectId === projectId ? agent : null;
  }

  list({ projectId } = {}) {
    if (typeof projectId !== "string" || !ID.test(projectId)) throw new TypeError("A valid project scope is required");
    return [...this.#agents.values()].filter(agent => agent.projectId === projectId);
  }

  #validateIdentity(id, projectId) {
    if (typeof id !== "string" || !ID.test(id) || typeof projectId !== "string" || !ID.test(projectId)) {
      throw new TypeError("Invalid agent or project identity");
    }
  }
}
