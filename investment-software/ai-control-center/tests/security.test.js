import { test } from "node:test";
import assert from "node:assert/strict";
import { encryptSecret, decryptSecret } from "../src/crypto.js";
import { createApp } from "../src/app.js";
import request from "supertest";

test("AES-256-GCM encrypts and decrypts API secret with configured key", () => {
  process.env.KEY_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  const encrypted = encryptSecret("test-provider-secret-123");
  assert.notEqual(encrypted.ciphertext, Buffer.from("test-provider-secret-123").toString("base64"));
  assert.equal(decryptSecret({ key_ciphertext: encrypted.ciphertext, key_iv: encrypted.iv, key_auth_tag: encrypted.authTag }), "test-provider-secret-123");
});

test("tampering with ciphertext is rejected", () => {
  process.env.KEY_ENCRYPTION_KEY = Buffer.alloc(32, 8).toString("base64");
  const encrypted = encryptSecret("another-test-secret");
  assert.throws(() => decryptSecret({ key_ciphertext: Buffer.from("tampered").toString("base64"), key_iv: encrypted.iv, key_auth_tag: encrypted.authTag }));
});

test("API rejects missing admin token and does not expose stored secrets", async () => {
  process.env.CONTROL_CENTER_ADMIN_TOKEN = "a".repeat(40);
  const pool = { query: async () => ({ rows: [{ id: "id-1", provider: "openai", label: "test", key_fingerprint: "abcdef123456", created_at: "now", updated_at: "now" }] }) };
  const app = createApp({ pool });
  await request(app).get("/api/credentials").expect(401);
  const response = await request(app).get("/api/credentials").set("Authorization", "Bearer " + "a".repeat(40)).expect(200);
  assert.equal(JSON.stringify(response.body).includes("apiKey"), false);
  assert.equal(JSON.stringify(response.body).includes("ciphertext"), false);
});
