# SINDA Unified Workspace — Beta 0.1

A bilingual (Arabic RTL / English LTR), local-first prototype for managing five digital product categories from one workspace.

## Included
- Dashboard counters derived from project data.
- Project create, edit, delete, search and category/status filtering.
- Local browser persistence using localStorage.
- JSON export/import and demo-data reset.
- Responsive layout and language toggle.
- Dependency-free Node.js preview server and automated engine tests.

## Run locally
Requires Node.js 20+.

```sh
npm test
npm start
```

Open http://127.0.0.1:4173.

## Data and safety
- Seed data is illustrative and synthetic.
- Project data stays in this browser's localStorage unless the user exports it.
- JSON import/export is user-initiated.
- No authentication, server database, cloud sync, external social account connection, payment processing, blockchain transaction, publishing, or production deployment is implemented.
- Do not store secrets, personal data, credentials or real financial data in this prototype.

This is a functional frontend beta, not a production-ready multi-user service.