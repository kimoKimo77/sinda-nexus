# Sinda Nexus architecture and security status

## Implemented in this branch

- Node.js ES modules and Express 5.
- Helmet security headers; `X-Powered-By` and ETag generation disabled.
- JSON request parsing is applied only after API authentication, with a 100 KiB limit and explicit malformed/oversized-body responses.
- Every `/api/*` route is protected by one or more configured Bearer service tokens. Tokens shorter than 32 characters are rejected at startup; comparisons use constant-time comparison for equal-length values.
- API rate limiting runs before authentication so failed credential attempts are counted. The public liveness endpoint is not included in that limiter.
- API and health responses are marked `Cache-Control: no-store`.
- Configuration values for rate limits and project capacity are strictly validated.
- Project names/descriptions are validated and project count is capped.
- JSON-file persistence uses unique temporary files, restrictive file permissions, and atomic rename. Existing symlink/special-file targets and malformed/invalid persisted records are rejected at startup.
- Graceful SIGTERM/SIGINT shutdown is implemented.
- Tests cover authentication, weak-token rejection, rate limiting (including failed auth), CRUD reads/writes, capacity limits, persistence, malformed/oversized JSON, symlink rejection, and reporting.
- GitHub Actions workflow runs checks on Node.js 20 and 22 and audits dependencies.

## Important limitations — not production-ready

1. Bearer tokens are shared service credentials, not individual user identities. There are no user accounts, roles, per-project ownership, tenant isolation, token rotation/revocation endpoint, or delegated identity.
2. JSON-file persistence is for a single process and low-volume preview only. It does not provide transactional or multi-instance guarantees, database migrations, backups, or crash-safe durability guarantees.
3. The in-memory rate-limit store is per process. Multi-instance deployments need a shared store and trusted proxy configuration.
4. No durable/tamper-evident audit ledger, file-upload pipeline, or fine-grained authorization is implemented.
5. No `package-lock.json` has been generated or validated in this environment. Reproducible dependency installation remains incomplete until a real lockfile is generated and committed; do not fabricate one.
6. GitHub Actions and vulnerability-audit results must be checked after this branch is pushed. Adding a workflow does not prove it passed.
7. Hosting configuration, TLS/reverse proxy, secrets storage, backups, and production deployment have not been verified.

Use only synthetic test data. Do not expose this preview API publicly or use it for confidential, financial, or customer records. No merge, real financial integration, or deployment is included or authorized by this branch.
