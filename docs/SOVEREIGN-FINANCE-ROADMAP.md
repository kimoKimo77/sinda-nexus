# SINDA Sovereign AI Finance — Preview roadmap

## Product boundary

This repository is the engineering foundation for a sovereign-style AI project and digital-asset workspace. "Sovereign" describes user-controlled project data, explicit authorization, auditability, and deployment ownership; it is not a claim of regulatory status, financial licensing, or guaranteed security.

The first release is a non-production Preview. It must not accept donations or payments, custody funds, store wallet private keys or seed phrases, execute financial transactions, mint live assets, or deploy contracts to mainnet.

## Delivery stages

1. **Core and server:** establish the Node.js service boundary, health/readiness endpoints, PostgreSQL persistence contracts, versioned migrations, and project-scoped data model.
2. **Control panel and agents:** add an authenticated dashboard, bounded agent orchestration, project-level RBAC, approval gates, usage quotas, and durable audit events.
3. **Commercial app factory:** generate isolated project templates and source artifacts; require static analysis, dependency checks, tests, and human review before export.
4. **Fundraising and wallet simulators:** use synthetic balances and simulated contribution ledgers only. Clearly label every amount as simulated; no payment rails, deposits, or withdrawals.
5. **Contract and asset lab:** compile and test sample contracts locally or on testnets; use disposable test accounts and test tokens; no mainnet deployment or private-key custody.
6. **Design and engraving studio:** create offline design previews, metadata, serial-number layouts, and exportable artwork; no claim that a design is a legally recognized financial instrument.
7. **Security, performance, and readiness:** threat model, authorization tests, tenant-isolation tests, dependency and secret scans, backup/restore drill, load tests, and evidence-based readiness report.

## Server preview API

- `GET /healthz`: process liveness only.
- `GET /readyz`: injected dependency checks; returns 503 if any check is not ready.
- `GET /api/v1/modules`: current module catalog and explicit Preview restrictions.
- All write methods are rejected. No business data or financial operation API is exposed in this first server slice.

Run locally with `npm start`. The default bind address is loopback (127.0.0.1); do not expose this preview directly to the public internet.

## Release gates

No production deployment, Hostinger changes, public fundraising, custody, payment integration, live minting, or mainnet deployment is authorized by this roadmap. Each requires separate legal/security review and explicit user approval. A passing unit test suite is not evidence of production readiness.
