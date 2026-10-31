import { GenerativeProvider } from "./generative-provider.js";
import { InMemoryProjectMemory } from "./project-memory.js";
import { ApprovalLedger } from "./approval-ledger.js";
import { DatabaseConnector } from "./database/connector.js";
import { SindaOrchestrator } from "./orchestrator.js";
import { PlanEvaluator } from "./evaluator.js";

export function createSindaAI({ env = process.env, fetchImpl = globalThis.fetch, memory = new InMemoryProjectMemory(), executor, auditLog, databaseAdapter, allowedTables = [] } = {}) {
  const provider = new GenerativeProvider({
    endpoint: env.SINDA_LLM_ENDPOINT,
    apiKey: env.SINDA_LLM_API_KEY,
    model: env.SINDA_LLM_MODEL,
    fetchImpl
  });
  const approvals = new ApprovalLedger({ auditLog });
  const database = databaseAdapter ? new DatabaseConnector({ adapter: databaseAdapter, allowedTables, approvalLedger: approvals, auditLog }) : null;
  const orchestrator = executor ? new SindaOrchestrator({ provider, memory, executor, auditLog }) : null;
  const evaluator = new PlanEvaluator({ provider });
  return { provider, memory, approvals, database, orchestrator, evaluator };
}
