const FORBIDDEN = /\\b(insert|update|delete|drop|alter|truncate|create|grant|revoke|copy|call|execute|vacuum|attach|detach)\\b/i;

export class DatabaseConnector {
  constructor({ adapter, allowedTables = [], maxRows = 200, auditLog, approvalLedger } = {}) {
    if (!adapter || typeof adapter.query !== "function") throw new TypeError("A database adapter with query(sql, params) is required.");
    this.adapter = adapter;
    this.allowedTables = new Set(allowedTables);
    this.maxRows = Math.max(1, Math.min(maxRows, 1000));
    this.auditLog = auditLog;
    this.approvalLedger = approvalLedger;
  }

  async read({ table, sql, params = [], requestedBy = "system" } = {}) {
    if (!this.allowedTables.has(table)) throw new Error("Table is not allow-listed.");
    if (typeof sql !== "string" || !/^\\s*select\\b/i.test(sql) || FORBIDDEN.test(sql) || sql.includes(";") || /--|\\/\\*/.test(sql)) {
      throw new Error("Only one read-only SELECT statement is permitted.");
    }
    const result = await this.adapter.query(sql, params);
    const rows = Array.isArray(result) ? result : result?.rows;
    if (!Array.isArray(rows)) throw new Error("Database adapter returned an invalid row set.");
    await this.#audit({ event: "database.read", table, requestedBy, rowCount: Math.min(rows.length, this.maxRows) });
    return rows.slice(0, this.maxRows);
  }

  async requestWrite({ table, operation, requestedBy, reason } = {}) {
    if (!this.allowedTables.has(table)) throw new Error("Table is not allow-listed.");
    if (!this.approvalLedger) throw new Error("Approval ledger is not configured.");
    return this.approvalLedger.request({ action: "database_" + operation, target: table, requestedBy, reason });
  }

  async #audit(entry) { if (typeof this.auditLog === "function") await this.auditLog({ ...entry, at: new Date().toISOString() }); }
}
