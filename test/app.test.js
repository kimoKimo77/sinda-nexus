import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createApp } from "../src/app.js";

const TOKEN = "test-only-token-that-is-long-enough-32-chars";
const app = createApp({ apiToken: TOKEN });
const auth = { Authorization: `Bearer ${TOKEN}` };

test("health endpoint is public", async () => {
  const response = await request(app).get("/health");
  assert.equal(response.status, 200);
  assert.equal(response.body.status, "ok");
});

test("API rejects missing and invalid bearer tokens", async () => {
  assert.equal((await request(app).get("/api/projects")).status, 401);
  assert.equal((await request(app).get("/api/projects").set("Authorization", "Bearer wrong")).status, 401);
});

test("API fails closed when authentication is not configured", async () => {
  const response = await request(createApp({ apiToken: undefined })).get("/api/projects");
  assert.equal(response.status, 503);
});

test("project can be created, listed, and retrieved with authentication", async () => {
  const created = await request(app).post("/api/projects").set(auth).send({ name: "Demo project", description: "Test record" });
  assert.equal(created.status, 201);
  assert.equal(created.body.data.name, "Demo project");
  const listed = await request(app).get("/api/projects").set(auth);
  assert.ok(listed.body.data.some((project) => project.id === created.body.data.id));
  const detail = await request(app).get(`/api/projects/${created.body.data.id}`).set(auth);
  assert.equal(detail.status, 200);
  assert.equal(detail.body.data.id, created.body.data.id);
});

test("project creation rejects invalid names and descriptions", async () => {
  for (const body of [{ name: "  " }, { name: "x".repeat(121) }, { name: "valid", description: "x".repeat(2001) }]) {
    const response = await request(app).post("/api/projects").set(auth).send(body);
    assert.equal(response.status, 400);
    assert.equal(response.body.error, "invalid_project");
  }
});

test("malformed JSON is rejected", async () => {
  const response = await request(app).post("/api/projects").set(auth).set("Content-Type", "application/json").send("{bad json");
  assert.equal(response.status, 400);
  assert.equal(response.body.error, "invalid_json");
});

test("unknown routes and projects return 404", async () => {
  assert.equal((await request(app).get("/missing")).status, 404);
  assert.equal((await request(app).get("/api/projects/not-a-real-id").set(auth)).status, 404);
});

test("report summary is protected and declares ephemeral storage", async () => {
  assert.equal((await request(app).get("/api/reports/summary")).status, 401);
  const response = await request(app).get("/api/reports/summary").set(auth);
  assert.equal(response.status, 200);
  assert.equal(response.body.data.storage, "process-memory");
});
