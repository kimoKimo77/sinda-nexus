import test from "node:test";
import assert from "node:assert/strict";
import { validateEvmTransaction, validatePayloadHash } from "../src/web3/validation.js";

const HASH = "0x" + "a".repeat(64);
const makeFetch = (responses) => async (_url, options) => {
  const request = JSON.parse(options.body);
  return { ok: true, json: async () => ({ jsonrpc: "2.0", id: 1, result: responses[request.method] }) };
};

test("payload hash is deterministic SHA-256", () => {
  assert.equal(validatePayloadHash("Sinda-Nexus Web3 State Validation"), "430a341a1f5c4874c6e85b7ec1ec25138f033eb7bbe126c564d048beee5981e6");
});
test("rejects malformed transaction hashes", async () => {
  const result = await validateEvmTransaction({ network: "ethereum", transactionHash: "0x1234" });
  assert.equal(result.status, "invalid");
  assert.equal(result.reason, "invalid_transaction_hash");
});
test("rejects unsupported networks", async () => {
  const result = await validateEvmTransaction({ network: "bitcoin", transactionHash: HASH });
  assert.equal(result.reason, "unsupported_network");
});
test("reports missing RPC configuration as unverified", async () => {
  const result = await validateEvmTransaction({ network: "ethereum", transactionHash: HASH, rpcUrls: {} });
  assert.equal(result.reason, "rpc_not_configured");
});
test("detects a chain ID mismatch", async () => {
  const result = await validateEvmTransaction({ network: "ethereum", transactionHash: HASH, rpcUrls: { ETHEREUM_RPC_URL: "https://rpc.example" }, fetchImpl: makeFetch({ eth_chainId: "0x38" }) });
  assert.equal(result.reason, "network_mismatch");
});
test("marks successful mined transactions valid", async () => {
  const result = await validateEvmTransaction({ network: "ethereum", transactionHash: HASH, rpcUrls: { ETHEREUM_RPC_URL: "https://rpc.example" }, fetchImpl: makeFetch({ eth_chainId: "0x1", eth_getTransactionByHash: { hash: HASH }, eth_getTransactionReceipt: { transactionHash: HASH, status: "0x1", blockNumber: "0x10" } }) });
  assert.equal(result.status, "valid");
  assert.equal(result.blockNumber, "0x10");
});
test("marks reverted transactions invalid", async () => {
  const result = await validateEvmTransaction({ network: "bsc", transactionHash: HASH, rpcUrls: { BSC_RPC_URL: "https://rpc.example" }, fetchImpl: makeFetch({ eth_chainId: "0x38", eth_getTransactionByHash: { hash: HASH }, eth_getTransactionReceipt: { transactionHash: HASH, status: "0x0", blockNumber: "0x10" } }) });
  assert.equal(result.reason, "transaction_reverted");
});
test("marks pending transactions unverified", async () => {
  const result = await validateEvmTransaction({ network: "polygon", transactionHash: HASH, rpcUrls: { POLYGON_RPC_URL: "https://rpc.example" }, fetchImpl: makeFetch({ eth_chainId: "0x89", eth_getTransactionByHash: { hash: HASH }, eth_getTransactionReceipt: null }) });
  assert.equal(result.reason, "transaction_pending_or_receipt_unavailable");
});
test("does not treat inherited object properties as supported networks", async () => {
  const result = await validateEvmTransaction({ network: "toString", transactionHash: HASH });
  assert.equal(result.status, "invalid");
  assert.equal(result.reason, "unsupported_network");
});

test("rejects malformed JSON-RPC envelopes as unverified", async () => {
  const result = await validateEvmTransaction({
    network: "ethereum",
    transactionHash: HASH,
    rpcUrls: { ETHEREUM_RPC_URL: "https://rpc.example" },
    fetchImpl: async () => ({ ok: true, json: async () => ({ jsonrpc: "1.0", id: 1, result: "0x1" }) })
  });
  assert.equal(result.status, "unverified");
  assert.equal(result.reason, "rpc_unavailable_or_invalid_response");
});
