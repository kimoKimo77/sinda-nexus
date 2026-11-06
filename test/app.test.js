import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createApp } from "../src/app.js";

const app = createApp();

test("health endpoint returns ok", async () => {
  const response = await request(app).get("/health");
  assert.equal(response.status, 200);
  assert.equal(response.body.status, "ok");
});

test("wallet preview frontend is served", async () => {
  const page = await request(app).get("/");
  assert.equal(page.status, 200);
  assert.match(page.text, /بوابة المعاملات الآمنة/);
  const module = await request(app).get("/wallet-modules/wallet.js");
  assert.equal(module.status, 200);
  assert.match(module.text, /sendWithMetaMask/);
});

test("project can be created and listed", async () => {
  const created = await request(app)
    .post("/api/projects")
    .send({ name: "Demo project", description: "Test record" });
  assert.equal(created.status, 201);
  assert.equal(created.body.data.name, "Demo project");

  const listed = await request(app).get("/api/projects");
  assert.ok(listed.body.data.some((project) => project.id === created.body.data.id));
});

test("project creation rejects an empty name", async () => {
  const response = await request(app).post("/api/projects").send({ name: "   " });
  assert.equal(response.status, 400);
  assert.equal(response.body.error, "invalid_project");
});

test("unknown project returns 404", async () => {
  const response = await request(app).get("/api/projects/not-a-real-id");
  assert.equal(response.status, 404);
});


test("read-only validation endpoint verifies a testnet receipt and confirmations", async () => {
  const hash = "0x" + "a".repeat(64);
  const responses = {
    eth_chainId: "0xaa36a7",
    eth_getTransactionByHash: { hash },
    eth_getTransactionReceipt: { transactionHash: hash, status: "0x1", blockNumber: "0x20" },
    eth_blockNumber: "0x22"
  };
  const rpcApp = createApp({
    rpcUrls: { ETHEREUM_SEPOLIA_RPC_URL: "https://rpc.example" },
    fetchImpl: async (_url, options) => {
      const { method } = JSON.parse(options.body);
      return { ok: true, json: async () => ({ jsonrpc: "2.0", id: 1, result: responses[method] }) };
    }
  });
  const response = await request(rpcApp).post("/api/web3/validate").send({
    network: "ethereumSepolia",
    transactionHash: hash
  });
  assert.equal(response.status, 200);
  assert.equal(response.body.data.status, "valid");
  assert.equal(response.body.data.confirmations, "3");
});
