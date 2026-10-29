import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import { createApp } from "../src/app.js";

const TOKEN = "test-only-token";
const makeApp = (options = {}) => createApp({ apiTokens: [TOKEN], dataFile: ":memory:", ...options });
const auth = (requestBuilder) => requestBuilder.set("Authorization", `Bearer ${TOKEN}`);

test("health endpoint remains available without API authentication", async () => {
  const response = await request(makeApp()).get("/health");
  assert.equal(response.status, 200);
  assert.equal(response.body.status, "ok");
});

test("API fails closed when no bearer tokens are configured", async () => {
  const app = createApp({ apiTokens: [], dataFile: ":memory:" });
  const response = await request(app).get("/api/projects");
  assert.equal(response.status, 503);
  assert.equal(response.body.error, "auth_not_configured");
});

test("API rejects missing and invalid bearer tokens", async () => {
  const app = makeApp();
  assert.equal((await request(app).get("/api/projects")).status, 401);
  assert.equal((await request(app).get("/api/projects").set("Authorization", "Bearer wrong")).status, 401);
});

test("authenticated project can be created, listed, and retrieved", async () => {
  const app = makeApp();
  const created = await auth(request(app).post("/api/projects"))
    .send({ name: "Demo project", description: "Test record" });
  assert.equal(created.status, 201);
  assert.equal(created.body.data.name, "Demo project");

  const listed = await auth(request(app).get("/api/projects"));
  assert.ok(listed.body.data.some((project) => project.id === created.body.data.id));

  const detail = await auth(request(app).get(`/api/projects/${created.body.data.id}`));
  assert.equal(detail.status, 200);
  assert.equal(detail.body.data.id, created.body.data.id);
});

test("project creation rejects invalid fields and enforces configured capacity", async () => {
  const app = makeApp({ maxProjects: 1 });
  const invalid = await auth(request(app).post("/api/projects")).send({ name: "   " });
  assert.equal(invalid.status, 400);
  assert.equal(invalid.body.error, "invalid_project");

  const created = await auth(request(app).post("/api/projects")).send({ name: "One" });
  assert.equal(created.status, 201);

  const overflow = await auth(request(app).post("/api/projects")).send({ name: "Two" });
  assert.equal(overflow.status, 409);
  assert.equal(overflow.body.error, "project_limit_reached");
});

test("unknown project returns 404", async () => {
  const response = await auth(request(makeApp()).get("/api/projects/not-a-real-id"));
  assert.equal(response.status, 404);
});

test("malformed JSON returns 400 and oversized JSON returns 413", async () => {
  const app = makeApp();
  const malformed = await auth(request(app).post("/api/projects"))
    .set("Content-Type", "application/json")
    .send('{"name":');
  assert.equal(malformed.status, 400);
  assert.equal(malformed.body.error, "invalid_json");

  const oversized = await auth(request(app).post("/api/projects"))
    .send({ name: "Large", description: "x".repeat(110_000) });
  assert.equal(oversized.status, 413);
  assert.equal(oversized.body.error, "payload_too_large");
});

test("projects persist across app instances when a data file is configured", async () => {
  const directory = mkdtempSync(join(tmpdir(), "sinda-nexus-"));
  const dataFile = join(directory, "projects.json");
  try {
    const firstApp = createApp({ apiTokens: [TOKEN], dataFile });
    const created = await auth(request(firstApp).post("/api/projects")).send({ name: "Persistent" });
    assert.equal(created.status, 201);

    const secondApp = createApp({ apiTokens: [TOKEN], dataFile });
    const listed = await auth(request(secondApp).get("/api/projects"));
    assert.equal(listed.body.data.length, 1);
    assert.equal(listed.body.data[0].id, created.body.data.id);

    const statContent = JSON.parse(readFileSync(dataFile, "utf8"));
    assert.equal(statContent[0].name, "Persistent");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
