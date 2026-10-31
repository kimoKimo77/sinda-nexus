import test from "node:test";
import assert from "node:assert/strict";
import { GenerativeProvider } from "../src/ai/generative-provider.js";
import { InMemoryProjectMemory } from "../src/ai/project-memory.js";
import { TaskPlanner, validatePlan } from "../src/ai/task-planner.js";
import { ApprovalLedger } from "../src/ai/approval-ledger.js";
import { DatabaseConnector } from "../src/ai/database/connector.js";
import { SindaOrchestrator } from "../src/ai/orchestrator.js";

test("provider validates endpoint and parses structured JSON", async () => {
  assert.throws(() => new GenerativeProvider({ endpoint: "http://example.com", model: "test" }), /HTTPS/);
  const provider = new GenerativeProvider({ endpoint: "https://llm.example/v1/chat/completions", model: "test", fetchImpl: async (_url, options) => {
    assert.equal(options.method, "POST");
    return { ok: true, json: async () => ({ choices: [{ message: { content: '{"ok":true}' } }] }) };
  }});
  assert.deepEqual(await provider.generateJSON({ system: "sys", input: "hi" }), { ok: true });
});

test("project memory is isolated by project and searchable", async () => {
  const memory = new InMemoryProjectMemory();
  await memory.remember({ projectId: "alpha", content: "Use preview mode for deployments", tags: ["deployment"] });
  await memory.remember({ projectId: "beta", content: "Different project" });
  assert.equal((await memory.search({ projectId: "alpha", query: "preview" })).length, 1);
  assert.equal((await memory.search({ projectId: "beta", query: "preview" })).length, 0);
});

test("planner validates tasks and rejects unknown actions", () => {
  assert.equal(validatePlan({ tasks: [{ id: "a", action: "test", description: "Run tests" }] }).tasks.length, 1);
  assert.throws(() => validatePlan({ tasks: [{ id: "a", action: "deploy", description: "Deploy" }] }), /Unsupported/);
});

test("approval ledger records and enforces one-way approval state", async () => {
  const events = [];
  const ledger = new ApprovalLedger({ auditLog: e => events.push(e) });
  const request = await ledger.request({ action: "deploy", target: "preview", requestedBy: "user", reason: "release" });
  assert.equal((await ledger.approve(request.id, { approvedBy: "owner" })).status, "approved");
  await assert.rejects(() => ledger.reject(request.id, { rejectedBy: "owner" }), /no longer pending/);
  assert.deepEqual(events.map(e => e.event), ["approval.requested", "approval.granted"]);
});

test("database connector allows allow-listed SELECT and blocks writes", async () => {
  let calls = 0;
  const approvals = new ApprovalLedger();
  const db = new DatabaseConnector({ adapter: { query: async () => { calls++; return [{ id: 1 }, { id: 2 }]; } }, allowedTables: ["projects"], approvalLedger: approvals });
  assert.deepEqual(await db.read({ table: "projects", sql: "SELECT id FROM projects" }), [{ id: 1 }, { id: 2 }]);
  await assert.rejects(() => db.read({ table: "projects", sql: "DELETE FROM projects" }), /SELECT/);
  const request = await db.requestWrite({ table: "projects", operation: "update", requestedBy: "user", reason: "edit project" });
  assert.equal((await approvals.get(request.id)).status, "pending");
  assert.equal(calls, 1);
});

test("orchestrator plans from scoped memory and executes only allowed tasks", async () => {
  const memory = new InMemoryProjectMemory();
  await memory.remember({ projectId: "p1", content: "Use mock providers and preview only" });
  const provider = { generateJSON: async () => ({ summary: "Plan", tasks: [
    { id: "a", action: "analyze", description: "Inspect code", dependsOn: [], risk: "low" },
    { id: "b", action: "write", description: "Write report", dependsOn: ["a"], risk: "high" }
  ] }) };
  const executed = [];
  const engine = new SindaOrchestrator({ provider, memory, executor: async ({ task }) => { executed.push(task.id); return "ok"; } });
  const plan = await engine.plan({ projectId: "p1", goal: "inspect code" });
  const result = await engine.execute({ projectId: "p1", plan: plan.plan, actor: "owner" });
  assert.deepEqual(executed, ["a"]);
  assert.equal(result.results[1].status, "approval_required");
});
