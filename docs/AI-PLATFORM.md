# Sinda AI Platform Layer (Preview)

This layer adds a provider adapter, project-scoped memory, structured task planning, orchestration, a database read connector, and an auditable approval ledger.

## Generative provider

Configure an OpenAI-compatible chat-completions endpoint, model name, and API key through runtime secret management. HTTPS is required except for localhost development. No key or provider is bundled in the repository. The provider requests JSON output and rejects malformed responses.

## Project memory

The included in-memory store scopes records by project ID and supports simple keyword retrieval. It is a preview adapter only: process restart clears data. Replace it with an authenticated persistent repository before multi-user or production use. Do not store passwords, API keys, private keys, seed phrases, or sensitive personal data in memory.

## Planner, orchestrator, and evaluator

The planner validates a bounded task list, supported actions, write payload sizes, and dependency ordering. The orchestrator retrieves project-scoped context, records plan events, checks each task against the decision policy, enforces declared dependencies, and records execution outcomes. The evaluator requests a structured score, pass/fail result, findings, and next steps, then validates the response shape. Treat model scores as advisory until a deterministic test/evidence policy is added. The executor is injected by the host application; the included workspace executor routes file writes only through the guarded writer and requires trusted handlers for other actions. This package does not grant unrestricted shell or filesystem access.

## Database connector

The connector includes thin adapters for an injected PostgreSQL pool and SQLite prepared statements. It accepts allow-listed table names, permits a single restricted SELECT, rejects mutation/DDL keywords, comments, sensitive catalog/file functions, and out-of-scope tables, clamps LIMIT to the configured row cap, and logs reads. Write requests create approval records only; no write SQL is executed by this module. The application must provide a least-privilege database identity, ideally a database-level read-only role.

## Runtime wiring

`createSindaAI` wires the provider, project memory, approval ledger, optional database adapter, orchestrator, and evaluator from runtime configuration. Configure `SINDA_LLM_ENDPOINT`, `SINDA_LLM_MODEL`, and `SINDA_LLM_API_KEY` through a secret manager or protected environment. No credentials are committed. The host must inject the actual workspace executor and database pool/handle.

## Approvals and audit

Approval requests record requester, target, reason, approver, timestamps, and state transitions. The included ledger is in-memory and single-process; it is not a durable audit system. Persist it transactionally and bind approval to authenticated identities before real use. Approval must be revalidated at execution time and must not be treated as a general permission grant.

## Current limitations

- No actual database driver or persistent memory backend is bundled.
- No model provider credentials are stored.
- No unrestricted agent tool execution, shell access, deployment, wallet, financial, or destructive operations are enabled.
- The task executor must be supplied by a trusted host and must independently enforce file/project scopes.
- The SQL guard is defense in depth, not a replacement for database-level read-only credentials or a SQL parser.
- Production readiness requires durable storage, RBAC/tenant isolation, quotas, secret rotation, prompt-injection defenses, observability, backup/restore tests, and security review.

Run `npm ci` then `npm run check` on Node.js 22 or 24.
