# Sinda Nexus API

## Runtime and components

- Node.js 20+ with ES modules and Express 5.
- Helmet security headers, strict JSON parsing, a 100 KB body limit, and rate limiting.
- Public liveness endpoint: `GET /health`.
- Bearer-token protected project and report endpoints under `/api`.
- Node's built-in test runner and Supertest.

## Authentication

Set `API_TOKEN` in the hosting secret manager or environment. Use a random secret of at least 32 characters. Every `/api/*` request must send `Authorization: Bearer <token>`. The API fails closed with HTTP 503 when the token is absent or too short; production startup also refuses a missing/weak token. Never commit a real token or put it in frontend code.

This is a single shared service token, not a complete user identity system. It does not provide per-user accounts, roles, tenant isolation, token rotation/revocation, or delegated identity. Integrate a maintained OIDC/OAuth identity provider before a multi-user or public production release.

## Data and audit limitations

Project records remain in process memory and disappear on restart. Creation events are emitted as structured application logs only; they are not a durable or tamper-evident audit ledger. Do not store confidential, financial, or customer records in this scaffold.

Before production, select a persistent database, add migrations and backups, enforce per-user ownership at the data layer, and persist security/audit events to an access-controlled append-only destination. File uploads, object storage, report permissions, and financial integrations are intentionally not implemented.

## Local setup

1. Install Node.js 20 or newer.
2. Copy `.env.example` to `.env` and set a unique random `API_TOKEN`.
3. Run `npm install`.
4. Run `npm test` or `npm run check`.
5. Start with `npm start`.

Do not commit `.env`. Inject secrets through the hosting platform's environment/secret settings.

## CI

GitHub Actions runs tests and a production dependency audit on Node.js 20 and 22 for pushes and pull requests. A lockfile is still required for reproducible builds; it is not present in this branch yet.
