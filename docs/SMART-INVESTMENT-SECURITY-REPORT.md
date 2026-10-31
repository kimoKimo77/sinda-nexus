# Smart Investment AI — Initial Security Report

**Branch:** feat/smart-investment-readonly-preview  
**Pull request:** https://github.com/kimoKimo77/sinda-nexus/pull/16  
**Assessment type:** Code-level Preview review; not a production certification.

## Scope reviewed

- Arabic web/mobile Preview page and same-origin JavaScript.
- Authenticated investment market catalog and snapshot handlers.
- HTTP routing and investment-specific method restrictions.
- Provider response validation and explicit unavailable-state behavior.
- Existing SINDA authentication and PostgreSQL foundation as inherited dependencies.

## Verified controls

| Control | Evidence / result |
|---|---|
| Authentication | Investment catalog and snapshot handlers reject missing/invalid bearer identity (automated tests pass). |
| Read-only API | Investment routes accept GET only; POST, PUT, PATCH and DELETE are rejected (automated tests pass). |
| Financial action exclusion | No investment order, trade, deposit, withdrawal, custody, broker/account linking, private-key or automated-trading route is implemented. |
| Market-data provenance | Provider snapshots must include market, timestamp, source and items; invalid prices fail closed. |
| No fabricated market prices | With no configured provider, API returns status unavailable and data null. |
| Browser protections | Same-origin script, restrictive Content Security Policy, no-store and nosniff headers on the investment page. |
| UI output handling | Market labels/descriptions are rendered through textContent, not interpolated as HTML. |
| Dependency audit | CI npm ci reported 0 known vulnerabilities across the single package in the current lockfile. |
| Unit/integration test suite | Initial GitHub Actions run on Node 22 and 24: 41 passed, 0 failed, 1 skipped. |

## Additional PostgreSQL isolation gate

A disposable PostgreSQL 16 workflow and a non-owner runtime-role RLS integration test have been added. The test seeds two tenants and checks that a read-only runtime role can only see its own projects, memberships, agents and audit events.

**Status:** The new PostgreSQL workflow was queued separately after the initial Node test run. Its final result must be recorded before claiming live RLS verification. The earlier Node-only run skipped the PostgreSQL integration test because no database URL was present.

## Findings and residual risks

1. **No live market provider is configured.** Current UI shows the five market categories but no prices, quotes, property valuations or recommendations. Provider accuracy, freshness, licensing and uptime are unverified.
2. **No real portfolio or financial account is connected.** Holdings, account balances and broker data are not available in this Preview.
3. **Inherited authentication has no demonstrated session revocation or MFA in this release.** The investment UI keeps its bearer token in page memory and clears it on logout; the underlying signed-session design still needs revocation/rotation and MFA before production.
4. **Live RLS evidence is pending.** Unit-level policy declaration tests do not replace a real PostgreSQL test using a non-owner, non-BYPASSRLS runtime role.
5. **No mobile-browser visual QA or production penetration test has been completed.**
6. **The current dependency audit is narrow.** It reports the lockfile's single package and is not a substitute for SAST, secret scanning, container scanning or a full third-party supply-chain review.

## Release decision

**Not production-ready. Preview-only.**

Do not connect financial accounts, broker APIs or payment rails. Do not enable orders or automated trading. Do not merge into main or deploy to Hostinger without a separate review and explicit approval. A passing CI suite does not establish financial-data correctness, investment suitability, regulatory compliance or production security.
