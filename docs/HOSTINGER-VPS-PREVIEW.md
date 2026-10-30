# Hostinger VPS preview deployment

This runbook prepares the API-only preview stack. It does not deploy automatically and does not make the current API production-ready.

## Preview architecture

- Node.js 22 API container, running as the unprivileged `node` user.
- Docker Compose keeps the API private on the internal network; only Caddy publishes ports 80/443.
- Caddy obtains and renews HTTPS certificates after the DNS name resolves to this VPS and inbound ports 80/443 are reachable.
- Project JSON data is stored in a named Docker volume.
- Container filesystem is read-only except for the data volume and temporary directory.
- No production financial data, wallet signing, or transaction submission is supported.

## Hostinger VPS prerequisites

1. Confirm the intended VPS, available disk/RAM, supported OS, and that Docker Engine plus the Docker Compose plugin are installed.
2. Point a DNS A record for the preview hostname to the VPS public IPv4 address. Add an AAAA record only if IPv6 is configured and reachable.
3. Allow inbound TCP 80 and 443; restrict SSH (22 or the configured SSH port) to trusted source addresses. Do not expose port 3000.
4. Confirm no existing service is already using ports 80/443. Do not overwrite an existing site or reverse proxy without reviewing it first.

## Configure the preview

From the repository root on the VPS:

```sh
cp .env.example .env
chmod 600 .env
```

Edit `.env` locally on the VPS. Set:

- `NODE_ENV=production`
- `API_TOKENS` to a unique random value generated on the VPS, for example `openssl rand -hex 32`
- `DOMAIN` to the preview hostname whose DNS points to this VPS

Keep the real `.env` file off GitHub, out of support tickets, and out of chat. Do not reuse the example token.

## Start and verify

```sh
docker compose -f compose.preview.yaml config
docker compose -f compose.preview.yaml build --pull
docker compose -f compose.preview.yaml up -d
docker compose -f compose.preview.yaml ps
docker compose -f compose.preview.yaml logs --tail=100 api caddy
```

Smoke tests (replace the hostname and use the token only in the local shell):

```sh
curl --fail https://PREVIEW_HOSTNAME/health
curl --fail -H "Authorization: Bearer $API_TOKENS" https://PREVIEW_HOSTNAME/api/projects
```

The first request should return the public health status. The second should return the authenticated projects response. Confirm that an unauthenticated API request returns 401 and that HTTP redirects to HTTPS.

## Stop and rollback

```sh
docker compose -f compose.preview.yaml down
```

This stops containers but preserves named volumes. Do not add `--volumes` unless you explicitly intend to delete preview data. To roll back the application image, check out the previously approved commit and rebuild; preserve the `api_data` volume.

## Preview-only limitations

- JSON file persistence and the in-process rate limiter are single-instance mechanisms.
- The shared Bearer token is not end-user authentication, RBAC, tenant isolation, or token revocation.
- No database migration, automated off-host backup, tamper-evident audit ledger, or restore drill is provided.
- This preview stack is not approved for confidential, customer, or financial records.
- Hostinger account access, VPS provisioning, DNS, firewall, live TLS issuance, and live smoke tests must be verified on the actual VPS before considering the preview operational.
