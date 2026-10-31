const ALLOWED = new Set(["analyze", "classify", "simulate", "summarize"]);

export function fuseCapabilities(registry, agentIds, { projectId, approvedCapabilities = [] } = {}) {
  if (!registry || typeof registry.get !== "function") throw new TypeError("Trusted agent registry is required");
  if (!Array.isArray(agentIds) || agentIds.length < 2 || agentIds.length > 20
    || new Set(agentIds).size !== agentIds.length
    || agentIds.some(id => typeof id !== "string" || !id)) {
    throw new RangeError("Fusion requires 2 to 20 distinct registered agent IDs");
  }
  const agents = agentIds.map(id => registry.get(id, projectId));
  if (agents.some(agent => !agent || agent.projectId !== projectId)) throw new Error("Fusion source is missing or outside project scope");
  if (!Array.isArray(approvedCapabilities)) throw new TypeError("Approved capabilities must be an array");
  const approved = new Set(approvedCapabilities);
  if ([...approved].some(capability => !ALLOWED.has(capability))) throw new Error("Unknown capability in fusion policy");
  const shared = agents.map(agent => new Set(agent.capabilities));
  const capabilities = [...ALLOWED].filter(capability => approved.has(capability) && shared.every(set => set.has(capability)));
  return Object.freeze({
    projectId,
    sourceAgentIds: Object.freeze([...agentIds]),
    capabilities: Object.freeze(capabilities),
    policy: "registry-backed-intersection-and-allowlist"
  });
}
