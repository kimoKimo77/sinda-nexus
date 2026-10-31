const FORBIDDEN = /\b(insert|update|delete|drop|alter|truncate|create|grant|revoke|copy|call|execute|vacuum|attach|detach|into|for)\b/i;
const SENSITIVE = /\b(pg_catalog|information_schema|pg_read_file|pg_ls_dir|dblink|lo_export|lo_import|pg_sleep)\b/i;

export class PostgresPoolAdapter {
  constructor(pool) {
    if (!pool || typeof pool.query !== "function") throw new TypeError("A PostgreSQL pool is required.");
    this.pool = pool;
  }
  async query(sql, params = []) { return this.pool.query(sql, params); }
  async execute(sql, params = []) { const result = await this.pool.query(sql, params); return { rowCount: result.rowCount ?? 0 }; }
}

export class SqlitePreparedAdapter {
  constructor(database) {
    if (!database || typeof database.prepare !== "function") throw new TypeError("A SQLite database handle is required.");
    this.database = database;
  }
  async query(sql, params = []) { return this.database.prepare(sql).all(...params); }
  async execute(sql, params = []) {
    if (/^\\s*create\\s+(table|index)/i.test(sql) && typeof this.database.exec === "function") { this.database.exec(sql); return { changes: 0 }; }
    const result = this.database.prepare(sql).run(...params);
    return { changes: result.changes ?? 0, lastInsertRowid: result.lastInsertRowid };
  }
}

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
    if (typeof sql !== "string" || !/^\s*select\b/i.test(sql) || FORBIDDEN.test(sql) || SENSITIVE.test(sql) || sql.includes(";") || /--|\/\*/.test(sql)) {
      throw new Error("Only one restricted read-only SELECT statement is permitted.");
    }
    const referenced = [...sql.matchAll(/\b(?:from|join)\s+([a-zA-Z_][a-zA-Z0-9_.]*)/gi)].map(match => match[1]);
    if (referenced.some(name => !this.allowedTables.has(name)) || (referenced.length && !referenced.includes(table))) {
      throw new Error("Every referenced table must be allow-listed and match the requested table scope.");
    }
    const limitMatch = sql.match(/\blimit\s+(\d+)\b/i);
    const safeLimit = limitMatch ? Math.min(Number(limitMatch[1]), this.maxRows) : this.maxRows;
    const limitedSql = limitMatch ? sql.replace(/\blimit\s+\d+\b/i, "LIMIT " + safeLimit) : sql + " LIMIT " + safeLimit;
    const result = await this.adapter.query(limitedSql, params);
    const rows = Array.isArray(result) ? result : result?.rows;
    if (!Array.isArray(rows)) throw new Error("Database adapter returned an invalid row set.");
    await this.#audit({ event: "database.read", table, requestedBy, rowCount: Math.min(rows.length, this.maxRows) });
    return rows.slice(0, this.maxRows);
  }

  async requestWrite({ table, operation, requestedBy, reason } = {}) {
    if (!this.allowedTables.has(table)) throw new Error("Table is not allow-listed.");
    if (!/^(insert|update|delete)$/.test(operation) || !this.approvalLedger) throw new Error("A supported write operation and approval ledger are required.");
    return this.approvalLedger.request({ action: "database_" + operation, target: table, requestedBy, reason });
  }

  async #audit(entry) { if (typeof this.auditLog === "function") await this.auditLog({ ...entry, at: new Date().toISOString() }); }
}
