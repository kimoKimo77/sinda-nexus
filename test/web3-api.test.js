import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createApp } from "../src/app.js";

const HASH = "0x" + "b".repeat(64);
const fakeFetch = async (_url, options) => {
  const { method } = JSON.parse(options.body);
  const values = {
    eth_chainId: "0x1",
    eth_getTransactionByHash: { hash: HASH },
    eth_getTransactionReceipt: { transactionHash: HASH, status: "0x1", blockNumber: "0x2a" },
    eth_blockNumber: "0x2c"
  };
  return { ok: true, json: async () => ({ jsonrpc: "2.0", id: 1, result: values[method] }) };
};

test("POST /api/web3/hash returns a SHA-256 digest", async () => {
  const response = await request(createApp()).post("/api/web3/hash").send({ payload: "hello" });
  assert.equal(response.status, 200);
  assert.equal(response.body.data.algorithm, "SHA-256");
  assert.equal(response.body.data.sha256, "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");
});

test("POST /api/web3/validate returns a verified read-only EVM result", async () => {
  const app = createApp({ fetchImpl: fakeFetch, rpcUrls: { ETHEREUM_RPC_URL: "https://rpc.example" } });
  const response = await request(app).post("/api/web3/validate").send({ network: "ethereum", transactionHash: HASH });
  assert.equal(response.status, 200);
  assert.equal(response.body.data.status, "valid");
  assert.equal(response.body.data.chainId, 1);
});


test("Web3 routes require the configured bearer key", async () => {
  const app = createApp({ apiKey: "test-secret" });
  const denied = await request(app).post("/api/web3/hash").send({ payload: "hello" });
  assert.equal(denied.status, 401);
  const allowed = await request(app).post("/api/web3/hash").set("Authorization", "Bearer test-secret").send({ payload: "hello" });
  assert.equal(allowed.status, 200);
});

test("POST /api/web3/hash accepts payloads above 100 KB", async () => {
  const payload = "a".repeat(150_000);
  const response = await request(createApp()).post("/api/web3/hash").send({ payload });
  assert.equal(response.status, 200);
  assert.equal(response.body.data.sha256.length, 64);
});

test("POST /api/web3/hash rejects payloads above 1 MB", async () => {
  const payload = "a".repeat(1_000_001);
  const response = await request(createApp()).post("/api/web3/hash").send({ payload });
  assert.equal(response.status, 400);
  assert.equal(response.body.error, "invalid_payload");
});
