# Architecture (initial scaffold)

- **Runtime:** Node.js 20+ with ES modules.
- **HTTP:** Express with Helmet security headers, JSON body-size limit, and rate limiting.
- **Routes:** health check, in-memory project create/list/detail, and a summary report.
- **Tests:** Node's built-in test runner and Supertest.

## Important limitations

This is a development scaffold, not production-ready. Project records are held in memory and are lost when the process restarts. Authentication/authorization, persistent storage, file upload/storage, audit logging, and production deployment are not implemented. Do not put confidential or real customer data into this prototype.

## Next steps

1. Run tests and dependency/security checks in an isolated environment.
2. Select persistent storage and define migrations.
3. Add authentication, authorization, and ownership checks before exposing project data.
4. Design safe file metadata/storage workflows and report permissions.
5. Add CI checks and review environment-specific deployment settings before any release.

## Web3 state validation (preview)

- `POST /api/web3/validate` checks EVM transaction inclusion and receipt status using configured read-only JSON-RPC endpoints.
- Supported chain IDs: Ethereum Mainnet (1), BNB Smart Chain (56), and Polygon PoS (137).
- A valid result requires a matching chain ID, matching transaction and receipt hashes, and receipt status `0x1`.
- Pending, missing, or unavailable provider data is reported as `unverified`, never as valid.
- `POST /api/web3/hash` calculates a SHA-256 digest for a UTF-8 payload; it does not prove on-chain inclusion or authorship.
- No wallet connection, signing, transaction submission, or state-changing RPC methods are used.
- Bitcoin transaction verification is not implemented in this iteration; Bitcoin inputs are reported as unsupported.
- Configure trusted HTTPS RPC endpoints through environment variables. Do not commit credentials.
