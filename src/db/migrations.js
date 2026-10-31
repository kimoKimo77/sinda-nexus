import { createHash } from "node:crypto";

export const MIGRATIONS = Object.freeze([
  {
    version: 1,
    name: "core_tenant_dashboard",
    sql: `
      CREATE TABLE organizations (
        id UUID PRIMARY KEY,
        name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 160),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE TABLE users (
        id UUID PRIMARY KEY,
        organization_id UUID NOT NULL REFERENCES organizations(id),
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        display_name TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('owner','admin','member','viewer')),
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE TABLE projects (
        id UUID PRIMARY KEY,
        organization_id UUID NOT NULL REFERENCES organizations(id),
        name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 160),
        description TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'preview' CHECK (status IN ('preview','archived')),
        created_by UUID NOT NULL REFERENCES users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE TABLE project_members (
        project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK (role IN ('owner','admin','member','viewer')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (project_id, user_id)
      );
      CREATE TABLE agents (
        id UUID PRIMARY KEY,
        project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
        agent_type TEXT NOT NULL CHECK (agent_type IN ('planner','auditor','builder','analyst')),
        status TEXT NOT NULL DEFAULT 'idle' CHECK (status IN ('idle','queued','running','paused','failed')),
        config JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_by UUID NOT NULL REFERENCES users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE TABLE audit_events (
        id BIGSERIAL PRIMARY KEY,
        organization_id UUID NOT NULL REFERENCES organizations(id),
        project_id UUID REFERENCES projects(id),
        actor_user_id UUID REFERENCES users(id),
        event_type TEXT NOT NULL,
        details JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX projects_org_created_idx ON projects(organization_id, created_at DESC);
      CREATE INDEX agents_project_created_idx ON agents(project_id, created_at DESC);
      CREATE INDEX audit_project_created_idx ON audit_events(project_id, created_at DESC);
      ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
      ALTER TABLE projects FORCE ROW LEVEL SECURITY;
      CREATE POLICY projects_tenant_policy ON projects
        USING (organization_id = nullif(current_setting('sinda.organization_id', true), '')::uuid)
        WITH CHECK (organization_id = nullif(current_setting('sinda.organization_id', true), '')::uuid);
      ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
      ALTER TABLE project_members FORCE ROW LEVEL SECURITY;
      CREATE POLICY project_members_user_policy ON project_members
        USING (user_id = nullif(current_setting('sinda.user_id', true), '')::uuid)
        WITH CHECK (user_id = nullif(current_setting('sinda.user_id', true), '')::uuid);
      ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
      ALTER TABLE agents FORCE ROW LEVEL SECURITY;
      CREATE POLICY agents_project_policy ON agents
        USING (project_id = nullif(current_setting('sinda.project_id', true), '')::uuid)
        WITH CHECK (project_id = nullif(current_setting('sinda.project_id', true), '')::uuid);
      ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
      ALTER TABLE audit_events FORCE ROW LEVEL SECURITY;
      CREATE POLICY audit_project_policy ON audit_events
        USING (
          organization_id = nullif(current_setting('sinda.organization_id', true), '')::uuid
          AND (project_id IS NULL OR project_id = nullif(current_setting('sinda.project_id', true), '')::uuid)
        )
        WITH CHECK (
          organization_id = nullif(current_setting('sinda.organization_id', true), '')::uuid
          AND (project_id IS NULL OR project_id = nullif(current_setting('sinda.project_id', true), '')::uuid)
        );
    `
  }
]);

export async function runMigrations({ pool, migrations = MIGRATIONS } = {}) {
  if (!pool || typeof pool.connect !== "function") throw new TypeError("A PostgreSQL pool with connect() is required.");
  const client = await pool.connect();
  const applied = [];
  try {
    await client.query("SELECT pg_advisory_lock($1)", [741923604]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        checksum TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    const existing = await client.query("SELECT version, checksum FROM schema_migrations ORDER BY version");
    const known = new Map(existing.rows.map(row => [Number(row.version), row.checksum]));
    for (const migration of [...migrations].sort((a,b) => a.version-b.version)) {
      if (!Number.isInteger(migration.version) || migration.version < 1 || typeof migration.sql !== "string") {
        throw new TypeError("Each migration requires a positive integer version and SQL string.");
      }
      const checksum = createHash("sha256").update(migration.sql).digest("hex");
      if (known.has(migration.version)) {
        if (known.get(migration.version) !== checksum) throw new Error("Applied migration checksum mismatch at version " + migration.version + ".");
        continue;
      }
      await client.query("BEGIN");
      try {
        await client.query(migration.sql);
        await client.query(
          "INSERT INTO schema_migrations(version, name, checksum) VALUES ($1, $2, $3)",
          [migration.version, migration.name, checksum]
        );
        await client.query("COMMIT");
        applied.push(migration.version);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
    return { applied, currentVersion: migrations.length ? Math.max(...migrations.map(m => m.version)) : 0 };
  } finally {
    try { await client.query("SELECT pg_advisory_unlock($1)", [741923604]); } finally { client.release(); }
  }
}
