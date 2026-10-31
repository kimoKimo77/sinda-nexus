# Digital Factory Architecture

## Logical architecture

```text
Web/API Experience
       |
Identity & Project Scope
       |
Policy Gateway ---- Audit Ledger
       |
Factory Application Services
  |        |         |          |
Design   Scenario  Invention   Evaluation
Catalog  Registry  Workspace  & Reports
  |        |         |          |
       Simulation Orchestrator
                 |
       Sandboxed Simulation Adapter
                 |
      Virtual World / Virtual Devices
```

## Service boundaries

### Identity and project scope
- Resolve the actor only from a verified host session.
- Enforce project membership and action-level permissions on the server.
- Never accept actor identity or approval state from model-generated content or an untrusted request body.

### Design catalog
- Store immutable, versioned robot design documents.
- Treat sensors and actuators as simulated capabilities only.
- Reject physical-device identifiers, network endpoints, and hardware-control payloads in preview.

### Scenario registry
- Store versioned simulation scenarios with declared environment, virtual components, seed, time budget, and resource budget.
- Validate schemas and enforce maximum object counts, simulation steps, and payload sizes.

### Simulation orchestrator
- Accept only registered scenario versions.
- Execute inside a constrained worker with no arbitrary shell, filesystem, network, or host-device access.
- Use deterministic seeds where supported and persist run metadata.
- Stop on timeout, resource exhaustion, invalid state, or safety-policy violation.

### Responsible AI studio
- Generate plans and design suggestions as typed proposals.
- Require evidence references and uncertainty notes for material claims.
- AI cannot change permissions, approve its own proposal, bypass limits, or invoke physical capabilities.

### Invention workspace
- Track problem statement, prior-art research status, hypothesis, design versions, simulation evidence, test results, and human decision.
- Do not claim patentability or novelty without a qualified search and legal review.

### Audit and evaluation
- Record append-only events for proposals, approvals, simulation runs, policy denials, and releases.
- Separate user-facing summaries from immutable evidence records.
- Preserve the distinction between passed, failed, blocked, and not-run checks.

## Data model (initial logical entities)

- Project(id, owner_id, name, status)
- RobotDesign(id, project_id, version, schema_version, document, created_by)
- Scenario(id, project_id, version, seed, limits, definition)
- SimulationRun(id, scenario_id, design_version, status, metrics, evidence_ref)
- Invention(id, project_id, title, hypothesis, status)
- Proposal(id, project_id, actor_id, proposal_type, payload, risk_level, status)
- Approval(id, proposal_id, approver_id, decision, expires_at, consumed_at)
- AuditEvent(id, project_id, actor_id, event_type, subject_ref, details, created_at)

All project-owned records must be queried through a project-scoped repository API. Database row-level security is a later hardening gate, not assumed to exist merely because project IDs are present.

## Initial API surface (proposed, not yet implemented)

- POST /api/factory/projects
- GET /api/factory/projects/:projectId
- POST /api/factory/designs
- POST /api/factory/scenarios
- POST /api/factory/simulations (simulation-only)
- GET /api/factory/simulations/:runId
- POST /api/factory/inventions
- POST /api/factory/proposals/:proposalId/approve
- GET /api/factory/audit

All routes require verified authentication, project authorization, input validation, rate limits, and audit logging. The API list is a design target, not a claim of existing routes.
