const SAFE_ACTIONS = new Set(["analyze", "read", "write"]);
const SENSITIVE_ACTIONS = new Set(["delete", "publish", "deploy", "change_permissions", "financial_transaction"]);

export function assessAction({ action, risk = "low", target = "" } = {}) {
  if (typeof action !== "string" || !action.trim()) {
    return { decision: "deny", reason: "A named action is required.", requiresApproval: false };
  }
  const normalized = action.trim().toLowerCase();
  if (SENSITIVE_ACTIONS.has(normalized)) {
    return { decision: "request_approval", reason: 'Action "' + normalized + '" is sensitive and requires explicit human approval.', requiresApproval: true };
  }
  if (!SAFE_ACTIONS.has(normalized)) {
    return { decision: "deny", reason: 'Action "' + normalized + '" is not in the permitted action list.', requiresApproval: false };
  }
  if (risk !== "low" && risk !== "medium") {
    return { decision: "request_approval", reason: "High or unknown risk requires explicit human approval.", requiresApproval: true };
  }
  if (normalized === "write" && (typeof target !== "string" || !target.trim())) {
    return { decision: "deny", reason: "A workspace-relative target path is required for writes.", requiresApproval: false };
  }
  return { decision: "allow", reason: "Action is within the configured low-impact policy.", requiresApproval: false };
}
