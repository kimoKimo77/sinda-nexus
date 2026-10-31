import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PostgresPoolAdapter } from "../src/ai/database/connector.js";
import { migrateDurableStores, PersistentProjectMemory, PersistentApprovalLedger } from "../src/ai/database/durable-repositories.js";

const connectionString = process.env.SINDA_PG_TEST_URL;

test("PostgreSQL preview integration: migrations, project scoping, approval replay", {
  skip: !connectionString && "Set SINDA_PG_TEST_URL to a disposable PostgreSQL database ending in _test or _preview."
}, async () => {
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString, max: 2, connectionTimeoutMillis: 5000, idleTimeoutMillis: 5000 });
  try {
    const identity = await pool.query("SELECT current_database() AS database_name, current_user AS role_name");
    const databaseName = identity.rows[0]?.database_name ?? "";
    assert.match(databaseName, /(?:_test|_preview)$/i, "Refusing to run migrations unless database name ends in _test or _preview");

    const adapter = new PostgresPoolAdapter(pool);
    const first = await migrateDurableStores({ adapter, dialect: "postgres" });
    const second = await migrateDurableStores({ adapter, dialect: "postgres" });
    assert.equal(first.migrated, true);
    assert.equal(second.migrated, true);

    const suffix = randomUUID();
    const projectA = "preview-a-" + suffix;
    const projectB = "preview-b-" + suffix;
    const memory = new PersistentProjectMemory({ adapter, dialect: "postgres" });
    await memory.remember({ projectId: projectA, content: "postgres preview record" });
    await memory.remember({ projectId: projectB, content: "isolated project record" });
    assert.equal((await memory.search({ projectId: projectA })).length, 1);
    assert.equal((await memory.search({ projectId: projectB, query: "postgres" })).length, 0);

    const ledger = new PersistentApprovalLedger({ adapter, dialect: "postgres" });
    const approval = await ledger.request({
      action: "preview_test",
      target: "isolated-resource-" + suffix,
      requestedBy: "integration-test",
      reason: "Disposable PostgreSQL integration test"
    });
    await ledger.approve(approval.id, { approvedBy: "integration-test-approver" });
    const consumed = await ledger.consumeApproved(approval.id, {
      action: "preview_test",
      target: approval.target,
      consumedBy: "integration-test-runner"
    });
    assert.equal(consumed.status, "consumed");
    await assert.rejects(
      () => ledger.consumeApproved(approval.id, {
        action: "preview_test",
        target: approval.target,
        consumedBy: "integration-test-runner"
      }),
      /matching current approval/
    );
  } finally {
    await pool.end();
  }
});
