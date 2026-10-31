import { assessAction } from "./policy.js";

export class DecisionEngine {
  decide(request = {}) {
    const policy = assessAction(request);
    return {
      action: request.action ?? null,
      target: request.target ?? null,
      decision: policy.decision,
      requiresApproval: policy.requiresApproval,
      explanation: policy.reason,
      decidedAt: new Date().toISOString()
    };
  }
}
