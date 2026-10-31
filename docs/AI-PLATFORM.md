# Sinda AI Platform Layer (Preview)

This layer adds a provider adapter, project-scoped memory, structured task planning, orchestration, a database read connector, and an auditable approval ledger.

## Generative provider

Configure an OpenAI-compatible chat-completions endpoint, model name, and API key through runtime secret management. HTTPS is required except for localhost development. No key or provider is bundled in the repository. The provider requests JSON output and rejects malformed responses.

## Project memory

The included in-memory store scopes records by project ID and supports simple keyword retrieval. It is a preview adapter only: process restart clears data. Replace it with an authenticated persistent repository before multi-user or production use. Do not store passwords, API keys, private keys, seed phrases, or sensitive personal data in memory.

## Planner and orchestrator

The planner validates a bounded task list and supported action set. The orchestrator retrieves project-scoped context, records plan events, checks each task against the decision policy, enforces declared dependencies, and records execution outcomes. The executor is injected by the host application; this package does not grant unrestricted shell or filesystem access.

## Database connector

The connector accepts an injected database adapter and allow-listed table names. It permits one SELECT statement, rejects mutation/DDL keywords and comments, caps returned rows, and logs reads. Write requests create approval records only; no write SQL is executed by this module. The application must provide a least-privilege database identity, ideally a database-level read-only role.

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
