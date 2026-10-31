import test from "node:test";
import assert from "node:assert/strict";
import { GenerativeProvider } from "../src/ai/generative-provider.js";
import { InMemoryProjectMemory } from "../src/ai/project-memory.js";
import { validatePlan } from "../src/ai/task-planner.js";
import { ApprovalLedger } from "../src/ai/approval-ledger.js";
import { DatabaseConnector } from "../src/ai/database/connector.js";
import { SindaOrchestrator } from "../src/ai/orchestrator.js";
import { PlanEvaluator } from "../src/ai/evaluator.js";
import { createWorkspaceTaskExecutor } from "../src/ai/workspace-task-executor.js";
import { createSindaAI } from "../src/ai/runtime.js";

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

test("planner validates tasks and rejects unsupported or out-of-order dependencies", () => {
  assert.equal(validatePlan({ tasks: [{ id: "a", action: "test", description: "Run tests" }] }).tasks.length, 1);
  assert.throws(() => validatePlan({ tasks: [{ id: "a", action: "deploy", description: "Deploy" }] }), /Unsupported/);
  assert.throws(() => validatePlan({ tasks: [
    { id: "a", action: "read", description: "Read", dependsOn: ["b"] },
    { id: "b", action: "read", description: "Read dependency" }
  ] }), /ordered/);
  assert.throws(() => validatePlan({ tasks: [{ id: "w", action: "write", description: "Write" }] }), /targetPath/);
});

test("approval ledger records, binds, and consumes approval once", async () => {
  const events = [];
  const ledger = new ApprovalLedger({ auditLog: e => events.push(e) });
  const request = await ledger.request({ action: "deploy", target: "preview", requestedBy: "user", reason: "release" });
  assert.equal((await ledger.approve(request.id, { approvedBy: "owner" })).status, "approved");
  await assert.rejects(() => ledger.consumeApproved(request.id, { action: "deploy", target: "production", consumedBy: "runner" }), /does not match/);
  assert.equal((await ledger.consumeApproved(request.id, { action: "deploy", target: "preview", consumedBy: "runner" })).status, "consumed");
  await assert.rejects(() => ledger.consumeApproved(request.id, { action: "deploy", target: "preview", consumedBy: "runner" }), /approved request/);
  assert.deepEqual(events.map(e => e.event), ["approval.requested", "approval.granted", "approval.consumed"]);
});

test("database connector scopes SELECT, caps rows, and queues writes for approval", async () => {
  let calls = 0;
  let sqlSeen = "";
  const approvals = new ApprovalLedger();
  const db = new DatabaseConnector({
    adapter: { query: async sql => { calls++; sqlSeen = sql; return [{ id: 1 }, { id: 2 }, { id: 3 }]; } },
    allowedTables: ["projects"],
    maxRows: 2,
    approvalLedger: approvals
  });
  assert.deepEqual(await db.read({ table: "projects", sql: "SELECT id FROM projects" }), [{ id: 1 }, { id: 2 }]);
  assert.match(sqlSeen, /LIMIT 2$/);
  await db.read({ table: "projects", sql: "SELECT id FROM projects LIMIT 999" });
  assert.match(sqlSeen, /LIMIT 2$/);
  await assert.rejects(() => db.read({ table: "projects", sql: "SELECT id FROM users" }), /allow-listed/);
  await assert.rejects(() => db.read({ table: "projects", sql: "DELETE FROM projects" }), /SELECT/);
  const request = await db.requestWrite({ table: "projects", operation: "update", requestedBy: "user", reason: "edit project" });
  assert.equal((await approvals.get(request.id)).status, "pending");
  assert.equal(calls, 2);
});

test("workspace executor routes writes only through the guarded writer", async () => {
  const writes = [];
  const executor = createWorkspaceTaskExecutor({
    workspaceWriter: { write: async (...args) => { writes.push(args); return { written: true }; } },
    handlers: { analyze: async () => "analysis" }
  });
  await executor({ projectId: "p", actor: "user", task: { action: "write", targetPath: "notes/a.md", content: "safe", risk: "low" } });
  assert.equal(writes.length, 1);
  assert.equal(writes[0][0], "notes/a.md");
  assert.equal(await executor({ projectId: "p", actor: "user", task: { action: "analyze" } }), "analysis");
  await assert.rejects(() => executor({ task: { action: "read" } }), /No trusted handler/);
});

test("plan evaluator validates model scores and evidence fields", async () => {
  const evaluator = new PlanEvaluator({ provider: { generateJSON: async () => ({ score: 92, passed: true, findings: ["Tests passed"], nextSteps: [] }) } });
  assert.equal((await evaluator.evaluate({ goal: "Build feature", plan: {}, execution: {} })).score, 92);
  const invalid = new PlanEvaluator({ provider: { generateJSON: async () => ({ score: 120, passed: true }) } });
  await assert.rejects(() => invalid.evaluate({ goal: "x", plan: {}, execution: {} }), /score/);
});

test("runtime factory wires provider, approvals, database, orchestrator, and evaluator", () => {
  const runtime = createSindaAI({
    env: { SINDA_LLM_ENDPOINT: "https://llm.example/v1/chat/completions", SINDA_LLM_MODEL: "test" },
    fetchImpl: async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: "{}" } }] }) }),
    executor: async () => "ok",
    databaseAdapter: { query: async () => [] },
    allowedTables: ["projects"]
  });
  assert.ok(runtime.provider);
  assert.ok(runtime.approvals);
  assert.ok(runtime.database);
  assert.ok(runtime.orchestrator);
  assert.ok(runtime.evaluator);
});

test("orchestrator plans from scoped memory, gates execution, and evaluates results", async () => {
  const memory = new InMemoryProjectMemory();
  await memory.remember({ projectId: "p1", content: "Use mock providers and preview only" });
  const provider = { generateJSON: async ({ system }) => system.startsWith("Evaluate")
    ? ({ score: 90, passed: true, findings: ["Evidence confirms completion"], nextSteps: [] })
    : ({ summary: "Plan", tasks: [
      { id: "a", action: "analyze", description: "Inspect code", dependsOn: [], risk: "low" },
      { id: "b", action: "write", description: "Write report", targetPath: "reports/result.md", content: "# Result", dependsOn: ["a"], risk: "high" }
    ] }) };
  const executed = [];
  const engine = new SindaOrchestrator({ provider, memory, executor: async ({ task }) => { executed.push(task.id); return "ok"; } });
  const plan = await engine.plan({ projectId: "p1", goal: "inspect code" });
  const result = await engine.execute({ projectId: "p1", plan: plan.plan, actor: "owner" });
  assert.deepEqual(executed, ["a"]);
  assert.equal(result.results[1].status, "approval_required");
  assert.equal((await engine.evaluate({ goal: "inspect code", plan: plan.plan, execution: result })).passed, true);
  await assert.rejects(() => engine.execute({ projectId: "p1", plan: { tasks: [{ id: "x", action: "deploy", description: "Run" }] } }), /Unsupported/);
});
