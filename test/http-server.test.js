import test from "node:test";
import assert from "node:assert/strict";
import { createSindaHttpServer } from "../src/server/http.js";

async function withServer(options, run) {
  const server = createSindaHttpServer(options);
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  try { await run(`http://127.0.0.1:${address.port}`); }
  finally { await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
}

test("health endpoint reports service liveness without exposing configuration", async () => {
  await withServer({}, async base => {
    const response = await fetch(base + "/healthz");
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.status, "ok");
    assert.equal(body.service, "sinda-sovereign-preview");
    assert.ok(response.headers.get("x-request-id"));
    assert.equal("env" in body, false);
  });
});

test("readiness endpoint fails closed when an injected dependency is unavailable", async () => {
  await withServer({ healthChecks: { database: async () => false, audit: async () => true } }, async base => {
    const response = await fetch(base + "/readyz");
    const body = await response.json();
    assert.equal(response.status, 503);
    assert.equal(body.status, "not_ready");
    assert.equal(body.checks.database, "not_ready");
  });
});

test("module catalog exposes preview restrictions and no financial execution routes", async () => {
  await withServer({}, async base => {
    const response = await fetch(base + "/api/v1/modules");
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.mode, "preview");
    assert.equal(body.restrictions.real_fundraising, false);
    assert.equal(body.restrictions.custody_or_private_keys, false);
    assert.equal(body.restrictions.mainnet_minting_or_deployment, false);
    assert.ok(body.modules.some(module => module.id === "wallet-lab"));
  });
});

test("write methods are rejected and unknown paths return 404", async () => {
  await withServer({}, async base => {
    assert.equal((await fetch(base + "/healthz", { method: "POST" })).status, 405);
    assert.equal((await fetch(base + "/unknown")).status, 404);
  });
});
