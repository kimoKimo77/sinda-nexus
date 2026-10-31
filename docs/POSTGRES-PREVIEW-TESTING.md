# PostgreSQL Preview integration, backup, and restore

This branch is a preparation layer only. It does not provision a database, store credentials, change Hostinger, or connect to production.

## Safety gate

- Use a newly created, disposable PostgreSQL database whose name ends in `_test` or `_preview`.
- The integration test checks the database name before applying the durable-store schema.
- Use a dedicated non-superuser test role. Do not reuse production credentials.
- Supply the connection string through the local shell/CI secret store as `SINDA_PG_TEST_URL`; never paste it into chat, commit it, or print it in logs.
- Do not point this test at production or a database containing real user/project data.

## Run the PostgreSQL integration test

The test dynamically loads the `pg` driver and skips when `SINDA_PG_TEST_URL` is absent. Install `pg` in the isolated test environment (without changing the project manifest), then run:

```sh
npm install --no-save --package-lock=false pg
SINDA_PG_TEST_URL="$SINDA_PG_TEST_URL" node --test test/postgres.integration.test.js
```

The test checks:
1. A real PostgreSQL connection and the target database identity.
2. Idempotent execution of the current durable-store schema helper.
3. Project-scoped memory reads.
4. Approval creation, approval consumption, and replay rejection.

A skipped test is not a pass. A pass is valid only when the test ran against a disposable PostgreSQL instance and completed successfully.

## Backup and restore drill

Run only against disposable test databases. Keep the backup file outside the repository and restrict its filesystem permissions.

```sh
umask 077
pg_dump --format=custom --no-owner --no-privileges \
  --file="$PWD/sinda-preview.backup" "$SINDA_PG_TEST_URL"

pg_restore --list "$PWD/sinda-preview.backup" >/dev/null
```

Restore into a separately provisioned, empty disposable database whose name ends in `_test` or `_preview`. Set its connection string in `SINDA_PG_RESTORE_TEST_URL` through the secret store:

```sh
pg_restore --no-owner --no-privileges \
  --dbname="$SINDA_PG_RESTORE_TEST_URL" \
  "$PWD/sinda-preview.backup"

psql "$SINDA_PG_RESTORE_TEST_URL" \
  --tuples-only --no-align \
  --command="SELECT to_regclass('public.sinda_project_memory'), to_regclass('public.sinda_approval_ledger');"
```

Record the PostgreSQL server version, source/restore database names (not credentials), backup timestamp, command exit codes, and verification query output. Delete the disposable databases and backup securely after the drill. Do not claim restore success until the restore command and verification query both succeed.

## Migration limitations to close before production

The current `migrateDurableStores` helper issues idempotent `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS` statements. It is not yet a versioned migration framework: it has no schema-version ledger, transactional migration orchestration, rollback strategy, or tested upgrade path from older schemas. The integration test validates repeatability on a disposable database, not upgrade/rollback safety.

Before any production use, add versioned migrations with a migration ledger, transaction boundaries, explicit upgrade/rollback policy, tenant/user ownership constraints, and independent review. Backup/restore must be exercised against the exact schema version being deployed.

## SQLite local development

SQLite remains the local-development option through the existing injected `SqlitePreparedAdapter`. Keep SQLite files local and access-restricted. Run the regular unit suite with `npm test`; this is separate from the real PostgreSQL integration test above.

## Current verification status

- PostgreSQL endpoint/credentials: not supplied; no live connection has been attempted.
- PostgreSQL integration test: added, not yet executed.
- Backup/restore drill: documented, not yet executed.
- Migration repeatability against real PostgreSQL: pending integration run.
- Production migrations, merge, deployment, and privilege changes: not authorized.
