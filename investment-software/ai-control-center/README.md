# SINDA AI Control Center — Preview

Independent Node.js 22+ service for managing third-party API credentials. Initial scope is deliberately limited to API keys; it does not manage wallet/private keys, sign transactions, or execute payments.

## Local setup

1. Create a dedicated PostgreSQL database and a restricted runtime role.
2. Copy `.env.example` to `.env`; generate independent values for `CONTROL_CENTER_ADMIN_TOKEN` and `KEY_ENCRYPTION_KEY`.
3. Install dependencies with `npm install`.
4. Apply `migrations/001_control_center.sql` using a migration-only database role.
5. Run `npm test`, then `npm start`.

Keep `.env` out of Git. Back up the encryption key separately from the database; losing it makes stored credentials unrecoverable. Rotate by controlled re-encryption, not by replacing the key blindly.

## API

All routes require `Authorization: Bearer <CONTROL_CENTER_ADMIN_TOKEN>`.
- `GET /health`
- `GET /api/credentials` — metadata only, never secret material.
- `POST /api/credentials` — JSON: `{ "provider": "openai", "label": "Primary", "apiKey": "..." }`; encrypts before persistence and never returns the secret.
- `DELETE /api/credentials/:id`
- `GET /api/audit`

## Security boundaries

AES-256-GCM authenticated encryption with a 32-byte base64 master key; random 96-bit IV per secret; constant-time comparison for the admin token; Helmet, strict input validation, request-size limit, rate limiting, parameterized SQL, allowlisted CORS and append-only audit trigger. No secret values are returned by list/create/delete routes and request bodies are never logged.

This is a preview foundation, not production-ready secret management. Before real provider integrations or Hostinger use: add user/role-based auth and MFA, a managed KMS/HSM or secret manager, CSRF protection if cookie sessions are introduced, per-provider outbound adapters with strict egress allowlists, key rotation/revocation workflows, backup/restore drills, PostgreSQL TLS and least-privilege grants, CI and independent security review. Do not paste production secrets into preview until those controls are reviewed.

## Operation modes

Local development is the first target. Hostinger VPS is a later target only after local integration/security tests and explicit deployment approval. No CI, production deployment, merge or PR is created by this preview step.
