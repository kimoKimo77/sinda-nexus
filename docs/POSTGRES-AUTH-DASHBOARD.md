# PostgreSQL, authentication, dashboard and agents (Preview)

## What is implemented

- Ordered PostgreSQL migrations in `src/db/migrations.js`, with a PostgreSQL advisory lock, transaction per migration, SHA-256 checksums, and refusal to rerun an edited migration.
- Tenant schema: organizations, users, projects, project membership, agents and audit events.
- PostgreSQL row-level security on projects, project memberships, agents and audit events. The application sets transaction-local `sinda.organization_id`, `sinda.user_id` and `sinda.project_id` values for each tenant request.
- Scrypt password hashes and HMAC-signed, expiring bearer sessions. Invalid credentials consistently return HTTP 401. Public self-registration is not exposed.
- One-time first-owner provisioning helper. It only succeeds while the users table is empty.
- Arabic RTL Preview dashboard at `/dashboard`, served with a same-origin JavaScript asset and restrictive Content Security Policy.
- Project list, project dashboard, agent list and agent creation handlers. Per-project agent quota checks are serialized with a transaction-scoped advisory lock. Agents are created in `idle` state only; this API does not execute autonomous work.
- Bounded JSON request bodies, request IDs, no-store responses and generic server errors.

## Compose the application

The app factory accepts a PostgreSQL-compatible Pool object. The host process is responsible for constructing that pool and supplying a secret from its secret manager:

```js
import pg from "pg";
import { createSindaApplication } from "./src/application.js";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const migrationPool = new pg.Pool({ connectionString: process.env.SINDA_MIGRATION_DATABASE_URL });\nconst { server } = await createSindaApplication({ pool, migrationPool, env: process.env });
server.listen(Number(process.env.PORT || 3000), "127.0.0.1");
```

The repository currently accepts an injected PostgreSQL pool through a trusted adapter. For `npm start`, set `SINDA_DATABASE_POOL_MODULE` to an absolute file URL for a trusted adapter module that exports `pool` or `createPool()`. The CI workflow temporarily installs the pinned `pg@8.23.1` package without changing the repository lockfile so it can run live PostgreSQL integration tests; this temporary CI install is not a substitute for committing the runtime dependency and generated lockfile. The adapter may return `{ pool, migrationPool }`; use a schema-owner pool only for migrations and a separate non-owner runtime pool for HTTP requests. Also set `DATABASE_URL` and a random `SINDA_SESSION_SECRET` (at least 32 bytes). Set `SINDA_RUN_MIGRATIONS=true` only during a planned migration window after a backup; otherwise run migrations separately. If the pool module is absent, the server deliberately starts in liveness-only mode and does not expose authenticated dashboard routes. The factory and migration runner are tested with injected pools. CI also runs a live PostgreSQL RLS test using a non-owner role and verifies cross-tenant row isolation.

## Provision the first owner

After applying migrations, call `provisionFirstOwner({ pool, email, password, displayName, organizationName })` from a controlled one-time administrative script. Supply the password through a secret manager or secure prompt; never commit it, place it in shell history, or send it in chat. The helper refuses to run if any user already exists.

The first owner receives a starter Preview project. There is no public signup or password reset route in this release.

## API

- `POST /api/v1/auth/login` — email/password; returns a signed bearer token.
- `GET /api/v1/auth/me` — current account.
- `GET /api/v1/projects` — projects for the authenticated user.
- `GET /api/v1/projects/:projectId/dashboard` — project-scoped counts and recent audit events.
- `GET /api/v1/projects/:projectId/agents` — project-scoped agent list.
- `POST /api/v1/projects/:projectId/agents` — create an idle agent; owner/admin/member only.

Agent types: `planner`, `auditor`, `builder`, `analyst`. Supported statuses are idle, queued, running, paused and failed, but this release only creates idle agents.

## Database role and security notes

Run migrations with a dedicated schema-owner role. Run the application with a separate non-superuser PostgreSQL role that does not own the tables and does not have `BYPASSRLS`; otherwise PostgreSQL RLS can be bypassed. Grant only the required table and sequence privileges to the runtime role. Do not use a superuser connection string in the web process.

The migration runner is forward-only. Do not edit an applied migration; add a new higher-numbered migration. Backups and a tested restore procedure are required before any production migration.

## Still required before release

- Add a pinned PostgreSQL driver and regenerate the lockfile in a controlled environment.
- Add live PostgreSQL integration tests for RLS using the actual non-owner runtime role, including cross-tenant negative tests.
- Add session revocation/rotation, password reset and MFA design before production use.
- Add dashboard frontend, agent queue/worker lifecycle, quotas and approval-gated execution.
- Run migration upgrade/restore drills, dependency scanning and load tests.
- No Hostinger deployment, real fundraising, custody, financial transactions, live minting or mainnet deployment is included.
