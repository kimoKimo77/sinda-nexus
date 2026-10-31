import { randomUUID } from "node:crypto";

export class ApprovalLedger {
  #requests = new Map();
  constructor({ auditLog } = {}) { this.auditLog = auditLog; }

  async request({ action, target, requestedBy, reason } = {}) {
    if (![action, target, requestedBy, reason].every(x => typeof x === "string" && x.trim())) throw new TypeError("action, target, requestedBy, and reason are required.");
    const request = { id: randomUUID(), action, target, requestedBy, reason, status: "pending", createdAt: new Date().toISOString() };
    this.#requests.set(request.id, request);
    await this.#audit({ event: "approval.requested", requestId: request.id, action, target, actor: requestedBy });
    return structuredClone(request);
  }

  async approve(id, { approvedBy, comment = "" } = {}) {
    const request = this.#requests.get(id);
    if (!request || request.status !== "pending") throw new Error("Approval request is missing or no longer pending.");
    if (typeof approvedBy !== "string" || !approvedBy.trim()) throw new TypeError("An approving actor is required.");
    request.status = "approved";
    request.approvedBy = approvedBy;
    request.comment = String(comment).slice(0, 1000);
    request.approvedAt = new Date().toISOString();
    await this.#audit({ event: "approval.granted", requestId: id, actor: approvedBy });
    return structuredClone(request);
  }

  async reject(id, { rejectedBy, comment = "" } = {}) {
    const request = this.#requests.get(id);
    if (!request || request.status !== "pending") throw new Error("Approval request is missing or no longer pending.");
    if (typeof rejectedBy !== "string" || !rejectedBy.trim()) throw new TypeError("A rejecting actor is required.");
    request.status = "rejected";
    request.rejectedBy = rejectedBy;
    request.comment = String(comment).slice(0, 1000);
    request.rejectedAt = new Date().toISOString();
    await this.#audit({ event: "approval.rejected", requestId: id, actor: rejectedBy });
    return structuredClone(request);
  }

  async consumeApproved(id, { action, target, consumedBy } = {}) {
    const request = this.#requests.get(id);
    if (!request || request.status !== "approved") throw new Error("A current approved request is required.");
    if (request.action !== action || request.target !== target) throw new Error("Approval does not match the requested action and target.");
    if (typeof consumedBy !== "string" || !consumedBy.trim()) throw new TypeError("A consuming actor is required.");
    request.status = "consumed";
    request.consumedBy = consumedBy;
    request.consumedAt = new Date().toISOString();
    await this.#audit({ event: "approval.consumed", requestId: id, actor: consumedBy, action, target });
    return structuredClone(request);
  }

  async get(id) { const item = this.#requests.get(id); return item ? structuredClone(item) : null; }
  async #audit(entry) { if (typeof this.auditLog === "function") await this.auditLog({ ...entry, at: new Date().toISOString() }); }
}
