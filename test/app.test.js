import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import { createApp } from "../src/app.js";

const TOKEN = "test-only-token-that-is-at-least-32-characters-long";
const makeApp = (options = {}) => createApp({ apiTokens: [TOKEN], dataFile: ":memory:", ...options });
const auth = (requestBuilder) => requestBuilder.set("Authorization", `Bearer ${TOKEN}`);

test("configuration rejects weak tokens and invalid limits", () => {
  assert.throws(() => createApp({ apiTokens: ["short"], dataFile: ":memory:" }), /API_TOKENS/);
  assert.throws(() => createApp({ apiTokens: [TOKEN], dataFile: ":memory:", maxProjects: 0 }), /MAX_PROJECTS/);
  assert.throws(() => createApp({ apiTokens: [TOKEN], dataFile: ":memory:", maxProjects: 100001 }), /MAX_PROJECTS/);
  assert.throws(() => createApp({ apiTokens: [TOKEN], dataFile: ":memory:", rateLimitWindowMs: 0 }), /RATE_LIMIT_WINDOW_MS/);
  assert.throws(() => createApp({ apiTokens: [TOKEN], dataFile: ":memory:", rateLimitMax: -1 }), /RATE_LIMIT_MAX/);
});

test("health endpoint is public, uncached, and does not require API credentials", async () => {
  const response = await request(makeApp()).get("/health");
  assert.equal(response.status, 200);
  assert.equal(response.body.status, "ok");
  assert.equal(response.headers["cache-control"], "no-store");
});

test("API fails closed when no bearer tokens are configured", async () => {
  const response = await request(createApp({ apiTokens: [], dataFile: ":memory:" })).get("/api/projects");
  assert.equal(response.status, 503);
  assert.equal(response.body.error, "auth_not_configured");
});

test("API rejects missing, malformed, and invalid bearer tokens before parsing request bodies", async () => {
  const app = makeApp();
  assert.equal((await request(app).get("/api/projects")).status, 401);
  assert.equal((await request(app).get("/api/projects").set("Authorization", "Bearer wrong")).status, 401);
  const malformedUnauthenticated = await request(app).post("/api/projects")
    .set("Content-Type", "application/json")
    .send('{"name":');
  assert.equal(malformedUnauthenticated.status, 401);
});

test("authenticated project can be created, listed, and retrieved", async () => {
  const app = makeApp();
  const created = await auth(request(app).post("/api/projects"))
    .send({ name: "Demo project", description: "Test record" });
  assert.equal(created.status, 201);
  assert.equal(created.body.data.name, "Demo project");
  assert.equal(created.headers["cache-control"], "no-store");

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

test("API rate limit returns a stable 429 response", async () => {
  const app = makeApp({ rateLimitMax: 1 });
  assert.equal((await auth(request(app).get("/api/projects")).then((response) => response.status)), 200);
  const limited = await auth(request(app).get("/api/projects"));
  assert.equal(limited.status, 429);
  assert.equal(limited.body.error, "rate_limit_exceeded");
});

test("unknown routes and projects return 404", async () => {
  const app = makeApp();
  assert.equal((await request(app).get("/missing")).status, 404);
  assert.equal((await auth(request(app).get("/api/projects/not-a-real-id"))).status, 404);
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

test("projects persist across app instances with restrictive file permissions", async () => {
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

    const stored = JSON.parse(readFileSync(dataFile, "utf8"));
    assert.equal(stored[0].name, "Persistent");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("persisted project data rejects duplicate IDs and invalid timestamps", () => {
  const directory = mkdtempSync(join(tmpdir(), "sinda-nexus-invalid-data-"));
  const dataFile = join(directory, "projects.json");
  const project = { id: "duplicate-id", name: "Example", description: "", createdAt: "2026-01-01T00:00:00.000Z" };
  try {
    writeFileSync(dataFile, JSON.stringify([project, { ...project, name: "Duplicate" }]));
    assert.throws(() => createApp({ apiTokens: [TOKEN], dataFile }), /valid project array with unique IDs/);

    writeFileSync(dataFile, JSON.stringify([{ ...project, id: "unique-id", createdAt: "not-a-date" }]));
    assert.throws(() => createApp({ apiTokens: [TOKEN], dataFile }), /valid project array with unique IDs/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("storage rejects symbolic links rather than following them", () => {
  const directory = mkdtempSync(join(tmpdir(), "sinda-nexus-symlink-"));
  const target = join(directory, "target.json");
  const dataFile = join(directory, "projects.json");
  try {
    writeFileSync(target, "[]");
    symlinkSync(target, dataFile);
    assert.throws(() => createApp({ apiTokens: [TOKEN], dataFile }), /regular file/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("summary endpoint requires authentication and reports project count", async () => {
  const app = makeApp();
  assert.equal((await request(app).get("/api/reports/summary")).status, 401);
  const response = await auth(request(app).get("/api/reports/summary"));
  assert.equal(response.status, 200);
  assert.equal(response.body.data.projectCount, 0);
  assert.ok(Number.isFinite(Date.parse(response.body.data.generatedAt)));
});
