# Smart Investment AI — Read-only Preview

## Approved scope

- Responsive Arabic-first web/mobile dashboard.
- Markets: stocks, crypto, gold/metals, forex and real estate.
- Read-only data access and analysis only.
- Existing Sinda authentication is reused; investment endpoints require an authenticated bearer session.
- Preview only. This feature does not authorize production deployment.

## Safety boundary

The investment API exposes GET-only routes. POST, PUT, PATCH and DELETE requests under `/api/v1/investment/*` return HTTP 405. There are no order, trade, deposit, withdrawal, custody, broker-linking, account-linking, private-key, or automated-trading operations in this module.

The existing authentication login endpoint uses POST solely to establish a session. It is not an investment or financial write operation.

## Implemented in this branch

- `GET /investment` — Arabic responsive Preview dashboard.
- `GET /investment.js` — same-origin client script.
- `GET /api/v1/investment/markets` — authenticated catalog of the five approved markets and explicit restrictions.
- `GET /api/v1/investment/markets/:market` — authenticated read-only market snapshot contract.
- Provider response validation for market identifier, timestamp, source, item symbol/name and non-negative finite price.
- No provider configured by default. The API returns an explicit unavailable state and null data instead of invented or simulated prices.
- No brokerage accounts, user holdings or real portfolios are connected or read.

## Data-source status

No live market-data provider has been selected or configured in this Preview. The current dashboard therefore lists the five markets but intentionally displays no prices, quotes, valuations or recommendations. A provider must be independently reviewed for source provenance, licensing, rate limits, timestamps, symbol mapping and error handling before connection.

Real-estate market data is especially jurisdiction- and provider-dependent; no property valuation is inferred from other asset classes.

## Verification

Run:

- `npm ci`
- `npm run check`
- `npm test`

The dedicated tests cover authentication, the five-market catalog, missing-provider behavior, provider validation and read-only HTTP method enforcement. A green unit suite does not prove live provider accuracy, PostgreSQL RLS enforcement, deployment security or production readiness.

## Release gates not satisfied yet

- GitHub Actions results for this branch.
- Live PostgreSQL integration and cross-tenant RLS tests under the intended non-owner runtime role.
- Dependency/security scanning and secret scanning.
- Market-data provider selection and contract tests.
- Browser/device visual verification on mobile and desktop.
- Independent security review.

No merge to `main`, production deployment, Hostinger changes or financial operations are included or authorized.
