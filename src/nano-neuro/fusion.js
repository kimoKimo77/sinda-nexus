const ALLOWED = new Set(["analyze", "classify", "simulate", "summarize"]);
export function fuseCapabilities(agents, { projectId, approvedCapabilities = [] } = {}) {
  if (!Array.isArray(agents) || agents.length < 2 || agents.length > 20) throw new RangeError("Fusion requires 2 to 20 agents");
  if (agents.some(agent => !agent || agent.projectId !== projectId)) throw new Error("Cross-project fusion is denied");
  const approved = new Set(approvedCapabilities);
  if ([...approved].some(capability => !ALLOWED.has(capability))) throw new Error("Unknown capability in fusion policy");
  const shared = agents.map(agent => new Set(agent.capabilities));
  const capabilities = [...ALLOWED].filter(capability => approved.has(capability) && shared.every(set => set.has(capability)));
  return Object.freeze({ projectId, sourceAgentIds: Object.freeze(agents.map(agent => agent.id)), capabilities: Object.freeze(capabilities), policy: "intersection-and-allowlist" });
}
