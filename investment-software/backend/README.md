# SINDA Workspace API — Preview only

Node.js 22+ / PostgreSQL API, separate from the localStorage frontend.

## Setup
Create a dedicated PostgreSQL database and restricted runtime role. Copy .env.example to .env and set DATABASE_URL plus a cryptographically random JWT_SECRET (at least 32 bytes). Never commit .env. Install dependencies in a network-enabled environment, then run npm run migrate and npm start.

## Routes
- POST /api/auth/register — disabled unless ALLOW_REGISTRATION=true; new users are viewer-only.
- POST /api/auth/login — short-lived JWT.
- GET /api/projects — own projects; admins see all.
- POST/PATCH/DELETE /api/projects — admin/editor, owner-scoped unless admin.
- GET /api/audit — admin only, latest 200 events.

Roles: admin, editor, viewer. No public role escalation endpoint. Grant admin out-of-band through a controlled operator procedure.

## Tests
Set TEST_DATABASE_URL to a disposable PostgreSQL database, then npm test. Tests truncate tables: never point it at development, staging, or production. Without TEST_DATABASE_URL integration tests are skipped.

## Security
Helmet, JSON body limit, rate limits, strict Zod validation, bcrypt password hashing, JWT issuer/audience/expiry validation, parameterized SQL, owner scoping and transactional audit writes. Database trigger blocks ordinary UPDATE/DELETE of audit rows; a database owner/superuser can still alter them. Use separate migration and runtime roles for operational separation. Configure TLS for deployment and PostgreSQL as appropriate.

Preview implementation only. Lockfile generation, CI, live PostgreSQL tests, browser validation and independent security review remain required before production consideration. No secrets, real personal/financial data, payments, blockchain transactions, deployment or production access are included.
