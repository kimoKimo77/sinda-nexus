import { randomUUID } from "node:crypto";

const TABLES = Object.freeze({
  memory: "sinda_project_memory",
  approvals: "sinda_approval_ledger"
});

export function durableSchema(dialect = "postgres") {
  if (!["postgres", "sqlite"].includes(dialect)) throw new TypeError("Unsupported SQL dialect.");
  const id = dialect === "postgres" ? "TEXT PRIMARY KEY" : "TEXT PRIMARY KEY";
  return [
    `CREATE TABLE IF NOT EXISTS ${TABLES.memory} (id ${id}, project_id TEXT NOT NULL, content TEXT NOT NULL, source TEXT NOT NULL, tags_json TEXT NOT NULL, created_at TEXT NOT NULL)`,
    `CREATE INDEX IF NOT EXISTS idx_sinda_memory_project_created ON ${TABLES.memory}(project_id, created_at)`,
    `CREATE TABLE IF NOT EXISTS ${TABLES.approvals} (id ${id}, action TEXT NOT NULL, target TEXT NOT NULL, requested_by TEXT NOT NULL, reason TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL, approved_by TEXT, comment TEXT, approved_at TEXT, rejected_by TEXT, rejected_at TEXT, consumed_by TEXT, consumed_at TEXT)`,
    `CREATE INDEX IF NOT EXISTS idx_sinda_approvals_status_created ON ${TABLES.approvals}(status, created_at)`
  ];
}

export async function migrateDurableStores({ adapter, dialect = "postgres" } = {}) {
  if (!adapter || typeof adapter.execute !== "function") throw new TypeError("A database adapter with execute(sql, params) is required.");
  for (const statement of durableSchema(dialect)) await adapter.execute(statement, []);
  return { migrated: true, dialect, tables: Object.values(TABLES) };
}

function text(value, field) {
  if (typeof value !== "string" || !value.trim()) throw new TypeError(field + " is required.");
  return value.trim();
}
function rowsOf(result) { return Array.isArray(result) ? result : result?.rows ?? []; }
function placeholders(dialect, count) {
  return Array.from({ length: count }, (_, i) => dialect === "postgres" ? "$" + (i + 1) : "?").join(", ");
}
function parameter(dialect, index) { return dialect === "postgres" ? "$" + index : "?"; }

export class PersistentProjectMemory {
  constructor({ adapter, dialect = "postgres" } = {}) {
    if (!adapter || typeof adapter.query !== "function" || typeof adapter.execute !== "function") throw new TypeError("A query/execute database adapter is required.");
    if (!["postgres", "sqlite"].includes(dialect)) throw new TypeError("Unsupported SQL dialect.");
    this.adapter = adapter;
    this.dialect = dialect;
  }

  async remember({ projectId, content, source = "user", tags = [] } = {}) {
    const item = {
      id: randomUUID(), projectId: text(projectId, "projectId"), content: text(content, "content"),
      source: text(source, "source"), tags: Array.isArray(tags) ? tags.filter(x => typeof x === "string").slice(0, 20) : [],
      createdAt: new Date().toISOString()
    };
    const p = placeholders(this.dialect, 6);
    await this.adapter.execute(
      `INSERT INTO ${TABLES.memory} (id, project_id, content, source, tags_json, created_at) VALUES (${p})`,
      [item.id, item.projectId, item.content, item.source, JSON.stringify(item.tags), item.createdAt]
    );
    return item;
  }

  async search({ projectId, query = "", limit = 10 } = {}) {
    const scope = text(projectId, "projectId");
    const cap = Math.max(1, Math.min(Number(limit) || 10, 50));
    const p = parameter(this.dialect, 1);
    const result = await this.adapter.query(
      `SELECT id, project_id, content, source, tags_json, created_at FROM ${TABLES.memory} WHERE project_id = ${p} ORDER BY created_at DESC LIMIT ${cap}`,
      [scope]
    );
    const terms = String(query).toLowerCase().split(/\s+/).filter(Boolean);
    return rowsOf(result).map(row => ({
      id: row.id, projectId: row.project_id, content: row.content, source: row.source,
      tags: JSON.parse(row.tags_json || "[]"), createdAt: row.created_at
    })).map(item => ({ item, score: terms.filter(term => item.content.toLowerCase().includes(term) || item.tags.some(tag => tag.toLowerCase().includes(term))).length }))
      .filter(x => !terms.length || x.score > 0).sort((a,b) => b.score-a.score).slice(0, cap).map(x => x.item);
  }
}

export class PersistentApprovalLedger {
  constructor({ adapter, dialect = "postgres", auditLog } = {}) {
    if (!adapter || typeof adapter.query !== "function" || typeof adapter.execute !== "function") throw new TypeError("A query/execute database adapter is required.");
    if (!["postgres", "sqlite"].includes(dialect)) throw new TypeError("Unsupported SQL dialect.");
    this.adapter = adapter;
    this.dialect = dialect;
    this.auditLog = auditLog;
  }

  async request({ action, target, requestedBy, reason } = {}) {
    const item = { id: randomUUID(), action: text(action,"action"), target: text(target,"target"), requestedBy: text(requestedBy,"requestedBy"), reason: text(reason,"reason"), status: "pending", createdAt: new Date().toISOString() };
    await this.adapter.execute(
      `INSERT INTO ${TABLES.approvals} (id, action, target, requested_by, reason, status, created_at) VALUES (${placeholders(this.dialect,7)})`,
      [item.id,item.action,item.target,item.requestedBy,item.reason,item.status,item.createdAt]
    );
    await this.#audit({ event: "approval.requested", requestId: item.id, actor: item.requestedBy, action: item.action, target: item.target });
    return item;
  }

  async #transition(id, from, to, fields, actor, event) {
    text(id, "id"); text(actor, "actor");
    const names = Object.keys(fields);
    const sets = [...names.map((name,i) => name + " = " + parameter(this.dialect,i+1)), "status = " + parameter(this.dialect,names.length+1)];
    const whereId = parameter(this.dialect,names.length+2);
    const whereStatus = parameter(this.dialect,names.length+3);
    const values = [...Object.values(fields), to, id, from];
    const result = await this.adapter.execute(
      `UPDATE ${TABLES.approvals} SET ${sets.join(", ")} WHERE id = ${whereId} AND status = ${whereStatus}`, values
    );
    const changed = result?.rowCount ?? result?.changes ?? result?.changesCount ?? 0;
    if (changed !== 1) throw new Error("Approval request is missing, stale, or already transitioned.");
    await this.#audit({ event, requestId: id, actor });
    return this.get(id);
  }

  async approve(id, { approvedBy, comment = "" } = {}) {
    const at = new Date().toISOString();
    return this.#transition(id,"pending","approved",{approved_by:text(approvedBy,"approvedBy"),comment:String(comment).slice(0,1000),approved_at:at},approvedBy,"approval.granted");
  }
  async reject(id, { rejectedBy, comment = "" } = {}) {
    const at = new Date().toISOString();
    return this.#transition(id,"pending","rejected",{rejected_by:text(rejectedBy,"rejectedBy"),comment:String(comment).slice(0,1000),rejected_at:at},rejectedBy,"approval.rejected");
  }
  async consumeApproved(id, { action, target, consumedBy } = {}) {
    const existing = await this.get(id);
    if (!existing || existing.status !== "approved" || existing.action !== action || existing.target !== target) throw new Error("A matching current approval is required.");
    const at = new Date().toISOString();
    return this.#transition(id,"approved","consumed",{consumed_by:text(consumedBy,"consumedBy"),consumed_at:at},consumedBy,"approval.consumed");
  }
  async get(id) {
    const result = await this.adapter.query(`SELECT * FROM ${TABLES.approvals} WHERE id = ${parameter(this.dialect,1)} LIMIT 1`,[id]);
    const row = rowsOf(result)[0];
    return row ? { id:row.id, action:row.action, target:row.target, requestedBy:row.requested_by, reason:row.reason, status:row.status, createdAt:row.created_at, approvedBy:row.approved_by, comment:row.comment, approvedAt:row.approved_at, rejectedBy:row.rejected_by, rejectedAt:row.rejected_at, consumedBy:row.consumed_by, consumedAt:row.consumed_at } : null;
  }
  async #audit(entry) { if (typeof this.auditLog === "function") await this.auditLog({ ...entry, at:new Date().toISOString() }); }
}
