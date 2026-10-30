import test from "node:test";
import assert from "node:assert/strict";
import { prepareEvmTransaction, sendWithMetaMask } from "../src/web3/wallet.js";

const ACCOUNT = "0x1111111111111111111111111111111111111111";
const RECIPIENT = "0x2222222222222222222222222222222222222222";
const HASH = `0x${"a".repeat(64)}`;

test("prepares a transaction without signing or sending it", () => {
  const result = prepareEvmTransaction({
    network: "ethereumSepolia",
    transaction: { to: RECIPIENT, value: "0x10", data: "0x1234" }
  });
  assert.equal(result.chainId, 11155111);
  assert.deepEqual(result.transaction, { to: RECIPIENT, value: "0x10", data: "0x1234" });
});

test("supports only configured test networks for the demo", () => {
  assert.equal(prepareEvmTransaction({ network: "ethereumSepolia", transaction: { to: RECIPIENT } }).chainId, 11155111);
  assert.equal(prepareEvmTransaction({ network: "bscTestnet", transaction: { to: RECIPIENT } }).chainId, 97);
  assert.equal(prepareEvmTransaction({ network: "polygonAmoy", transaction: { to: RECIPIENT } }).chainId, 80002);
});

test("rejects unsupported networks and unsafe transaction fields", () => {
  assert.throws(() => prepareEvmTransaction({ network: "unknown", transaction: { to: RECIPIENT } }), /unsupported_network/);
  assert.throws(() => prepareEvmTransaction({ network: "ethereumSepolia", transaction: { to: RECIPIENT, privateKey: "secret" } }), /unsupported_transaction_field/);
  assert.throws(() => prepareEvmTransaction({ network: "ethereumSepolia", transaction: { to: "0x1234" } }), /20-byte/);
  assert.throws(() => prepareEvmTransaction({ network: "ethereumSepolia", transaction: { to: RECIPIENT, value: "10" } }), /canonical hexadecimal/);
});

test("rejects conflicting fee formats", () => {
  assert.throws(() => prepareEvmTransaction({
    network: "ethereumSepolia",
    transaction: { to: RECIPIENT, gasPrice: "0x1", maxFeePerGas: "0x2" }
  }), /cannot be combined/);
});

test("wallet sends only after account and expected test network checks", async () => {
  const calls = [];
  const provider = {
    async request(payload) {
      calls.push(payload);
      if (payload.method === "eth_requestAccounts") return [ACCOUNT];
      if (payload.method === "eth_chainId") return "0xaa36a7";
      if (payload.method === "eth_sendTransaction") return HASH;
      throw new Error("unexpected_method");
    }
  };
  const result = await sendWithMetaMask({
    provider, network: "ethereumSepolia", transaction: { to: RECIPIENT, value: "0x0" }
  });
  assert.equal(result.transactionHash, HASH);
  assert.deepEqual(calls.map((call) => call.method), ["eth_requestAccounts", "eth_chainId", "eth_sendTransaction"]);
  assert.equal(calls[2].params[0].from, ACCOUNT);
});

test("does not send when the wallet is on the wrong network", async () => {
  const calls = [];
  const provider = {
    async request(payload) {
      calls.push(payload.method);
      if (payload.method === "eth_requestAccounts") return [ACCOUNT];
      if (payload.method === "eth_chainId") return "0x1";
      throw new Error("transaction_must_not_be_sent");
    }
  };
  await assert.rejects(
    sendWithMetaMask({ provider, network: "ethereumSepolia", transaction: { to: RECIPIENT } }),
    /wallet_network_mismatch/
  );
  assert.deepEqual(calls, ["eth_requestAccounts", "eth_chainId"]);
});

test("does not send when wallet connection is unavailable", async () => {
  const provider = { request: async () => [] };
  await assert.rejects(
    sendWithMetaMask({ provider, network: "ethereumSepolia", transaction: { to: RECIPIENT } }),
    /wallet_account_unavailable/
  );
});
