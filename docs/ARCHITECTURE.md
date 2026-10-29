# Sinda Nexus architecture and security status

## Implemented in this branch

- Node.js ES modules and Express 5.
- Helmet security headers; `X-Powered-By` disabled.
- JSON body limit (100 KiB), rate limiting, and explicit handling for malformed/oversized JSON.
- Bearer-token gate on all `/api` routes. The service fails closed with HTTP 503 if `API_TOKENS` is not configured and returns 401 for missing/invalid tokens.
- Project count cap (`MAX_PROJECTS`) and validation of project names/descriptions.
- Local JSON-file persistence with restrictive file permissions on creation and temporary-file rename; malformed or invalid stored data fails startup instead of being silently overwritten.
- Tests cover authentication, CRUD reads/writes, capacity limits, persistence across app instances, invalid JSON, oversized requests, and 404 behavior.
- GitHub Actions workflow for Node 20/22, tests, and dependency audit.

## Known limitations — not production-ready

1. Bearer tokens are shared service credentials, not individual user identities. There are no user roles, per-project ownership checks, token rotation/revocation service, or rate limits per identity.
2. JSON-file persistence is intended for a single process and low-volume testing. It does not provide transactional/concurrent multi-instance guarantees or a database migration path.
3. No audit log, file-upload pipeline, or fine-grained authorization is implemented.
4. No `package-lock.json` could be generated and validated in the current environment. Reproducible dependency installation remains incomplete until a real lockfile is generated and committed.
5. GitHub Actions and vulnerability-audit results must be checked after the branch is pushed; adding a workflow file does not prove that it has passed.
6. Hosting configuration, TLS/reverse proxy, secrets storage, backups, and production deployment have not been verified.

Do not use this branch for confidential or production customer data. No merge or deployment is authorized by these code changes.
