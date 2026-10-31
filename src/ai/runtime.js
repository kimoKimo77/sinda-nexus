import { GenerativeProvider } from "./generative-provider.js";
import { InMemoryProjectMemory } from "./project-memory.js";
import { ApprovalLedger } from "./approval-ledger.js";
import { DatabaseConnector } from "./database/connector.js";
import { PersistentProjectMemory, PersistentApprovalLedger } from "./database/durable-repositories.js";
import { SindaOrchestrator } from "./orchestrator.js";
import { PlanEvaluator } from "./evaluator.js";

export function createSindaAI({
  env = process.env, fetchImpl = globalThis.fetch, memory, approvals, executor, auditLog,
  databaseAdapter, allowedTables = [], durable = false, databaseDialect = "postgres"
} = {}) {
  const provider = new GenerativeProvider({
    endpoint: env.SINDA_LLM_ENDPOINT, apiKey: env.SINDA_LLM_API_KEY,
    model: env.SINDA_LLM_MODEL, fetchImpl
  });
  if (durable && (!databaseAdapter || typeof databaseAdapter.query !== "function" || typeof databaseAdapter.execute !== "function")) {
    throw new TypeError("Durable mode requires an injected database adapter with query and execute methods.");
  }
  const projectMemory = memory ?? (durable
    ? new PersistentProjectMemory({ adapter: databaseAdapter, dialect: databaseDialect })
    : new InMemoryProjectMemory());
  const approvalLedger = approvals ?? (durable
    ? new PersistentApprovalLedger({ adapter: databaseAdapter, dialect: databaseDialect, auditLog })
    : new ApprovalLedger({ auditLog }));
  const database = databaseAdapter ? new DatabaseConnector({
    adapter: databaseAdapter, allowedTables, approvalLedger, auditLog
  }) : null;
  const orchestrator = executor ? new SindaOrchestrator({
    provider, memory: projectMemory, executor, auditLog
  }) : null;
  const evaluator = new PlanEvaluator({ provider });
  return { provider, memory: projectMemory, approvals: approvalLedger, database, orchestrator, evaluator };
}
