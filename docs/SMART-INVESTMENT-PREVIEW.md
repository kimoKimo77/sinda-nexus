# Smart Investment AI — Read-only Preview

## Approved scope
- Responsive Arabic-first web/mobile dashboard.
- Markets: Saudi equities, crypto spot, gold, reference FX rates and Saudi real-estate registered-rent indicators.
- Read-only data access and analysis only.
- Existing Sinda authentication is reused; investment endpoints require an authenticated bearer session.
- Preview only. This feature does not authorize production deployment.

## Safety boundary
The investment API exposes GET-only routes. POST, PUT, PATCH and DELETE requests under `/api/v1/investment/*` return HTTP 405. There are no order, trade, deposit, withdrawal, custody, broker-linking, account-linking, private-key, or automated-trading operations in this module. Login POST only establishes a session.

## Provider adapters added
- Crypto: Binance public spot ticker endpoints for BTC/USDT, ETH/USDT and SOL/USDT; no API key.
- Forex: Frankfurter v2 blended daily reference rates for USD against SAR, EUR, GBP and JPY; no API key. These are daily mid/reference rates, not executable or intraday quotes.
- Gold: GoldAPI.io XAU/SAR endpoint; requires server-side `GOLDAPI_ACCESS_TOKEN`.
- Saudi equities: SAHMK quote endpoint; requires server-side `SAHMK_API_KEY`. Default symbols are 2222 and 1120 and can be overridden with `SAHMK_STOCK_SYMBOLS`.
- Real estate: Kite registered-rents endpoint for Riyadh by default; requires server-side `KITE_API_KEY`. City can be overridden with `KITE_CITY`. Registered rents are not listing asking prices or a property-specific valuation.

All provider requests are GET-only, server-side, use an eight-second timeout, and normalize into a shared snapshot. Secrets are read from environment variables and are never sent to browser code. Missing credentials and provider failures fail closed to an unavailable response. The dashboard requests each authenticated market snapshot and displays source/time metadata when present.

## Required GitHub Actions secrets
- `GOLDAPI_ACCESS_TOKEN`
- `SAHMK_API_KEY`
- `KITE_API_KEY`

Optional variables:
- `SAHMK_STOCK_SYMBOLS` (default `2222,1120`)
- `KITE_CITY` (default `riyadh`)

Do not commit secrets, add them to issue comments, or expose them in client-side code. Secret presence/validity must be confirmed by authorized repository administrators. The current connected GitHub integration does not expose the repository Secrets API, so this work does not claim those secrets have been added.

## Data quality and limitations
Provider payloads must contain the expected symbols, finite non-negative prices and provenance. Timestamps must parse, cannot be more than five minutes in the future, and cannot be older than 400 days. The age limit is a coarse fail-closed bound, not a guarantee of freshness; individual provider freshness/entitlement must still be verified. The UI labels FX as daily reference rates. Gold and equities may be delayed according to provider plan. Kite registered-rent data must retain its source attribution and applicable open-data licence notice when presented; confirm the precise response schema and terms for the selected endpoint before external user display.

## Verification status
Automated adapter tests use mocked HTTP responses and verify normalization, authentication headers, missing credentials, malformed data and GET-only behavior. These are contract/unit tests, not live-provider verification. Live checks still require authorized provider credentials and review of the real response schema. Browser/device visual QA and independent security review are also outstanding.

Run `npm ci`, `npm run check` and `npm test`.

No merge to `main`, production deployment, Hostinger changes, financial transactions, brokerage connections or real account linking are included or authorized.
