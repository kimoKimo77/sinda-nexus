import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { assessAction } from "../src/ai/policy.js";
import { DecisionEngine } from "../src/ai/decision-engine.js";
import { WorkspaceWriter } from "../src/ai/workspace-writer.js";

test("allows bounded analysis and workspace writes", () => {
  assert.equal(assessAction({ action: "analyze" }).decision, "allow");
  assert.equal(assessAction({ action: "write", target: "notes/result.md" }).decision, "allow");
});

test("requires approval for sensitive and high-risk actions", () => {
  assert.equal(assessAction({ action: "deploy" }).decision, "request_approval");
  assert.equal(assessAction({ action: "write", target: "x.txt", risk: "high" }).decision, "request_approval");
});

test("denies unknown actions and malformed write requests", () => {
  assert.equal(assessAction({ action: "invent_policy" }).decision, "deny");
  assert.equal(assessAction({ action: "write" }).decision, "deny");
});

test("decision engine returns an explanation", () => {
  const result = new DecisionEngine().decide({ action: "delete", target: "records.db" });
  assert.equal(result.decision, "request_approval");
  assert.match(result.explanation, /requires explicit human approval/);
});

test("writer creates a file only inside its workspace and records audit event", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "sinda-ai-"));
  const events = [];
  try {
    const writer = new WorkspaceWriter({ root, auditLog: entry => events.push(entry) });
    const result = await writer.write("reports/summary.md", "# Preview\n");
    assert.equal(result.written, true);
    assert.equal(await readFile(path.join(root, "reports/summary.md"), "utf8"), "# Preview\n");
    assert.equal(events[0].event, "workspace.write");
    assert.equal(events[0].outcome, "success");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("writer rejects path traversal", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "sinda-ai-"));
  try {
    const writer = new WorkspaceWriter({ root });
    await assert.rejects(() => writer.write("../escape.txt", "no"), /escapes/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
