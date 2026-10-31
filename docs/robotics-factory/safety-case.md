# Safety Case and Threat Boundaries

## Safety invariants

1. Preview has no physical actuation path.
2. Bio-inspired simulation has no biological materials or wet-lab instructions.
3. The model cannot grant itself permissions or approve its own actions.
4. A simulation cannot access host devices, arbitrary network destinations, or unrestricted host files.
5. Human approval is bound to one proposal, project, action, target version, expiry, and one-time consumption.
6. A failed or skipped safety test blocks phase acceptance.

## Threats and mitigations

| Threat | Required mitigation |
|---|---|
| Prompt injection in project documents | Treat documents as untrusted data; isolate instructions; schema-validate outputs |
| Cross-project data access | Server-side project authorization on every read/write; isolation tests |
| Approval replay | Atomic one-time approval consumption; action/target binding; expiry |
| Resource exhaustion | CPU, memory, step, payload, and wall-clock limits |
| Malicious simulation package | No arbitrary plugins in MVP; allow-listed internal simulator only |
| Data exfiltration | No outbound network from simulation workers; redact secrets from logs |
| Unsafe hardware command | No hardware adapter or command schema in Preview; deny unknown capability types |
| Misleading AI claims | Evidence references, confidence/uncertainty, and human review |

## Bio-inspired simulation boundary

Allowed: abstract mathematical models of gait, compliant motion, fluid-like dynamics, swarm coordination, and soft-robotics behavior using synthetic parameters.

Not allowed in this phase: wet-lab workflows, culture or growth procedures, organism manipulation, genetic engineering, pathogen work, biological sample processing, or clinical/medical claims.

## Human approval boundary

Approval must come from an authenticated human with project-level permission. It must be separate from the AI proposer. Approval is never implied by a generated plan, chat message, or test fixture.

## Incident response

- Stop the affected simulation worker.
- Preserve the run ID, scenario version, audit events, and sanitized error details.
- Mark the run blocked or failed; never rewrite it as passed.
- Disable the affected capability until a reviewed fix and regression test are available.
