# Phased Preview Roadmap

## Phase 0 — Foundation and scope (current)
- Freeze digital-only and simulation-only boundaries.
- Define architecture, data entities, threat model, and acceptance gates.
- Inspect existing AI orchestration and durable storage before wiring services.
- No user-facing claim of an operational factory yet.

Exit: architecture review, scope checks, branch CI, and threat-model review.

## Phase 1 — Factory control plane
- Project-scoped factory workspace and role model.
- Design/scenario/invention metadata APIs.
- Audit event contract and validation schemas.

Tests: authentication boundary, authorization matrix, cross-project isolation, malformed input, rate limits, audit completeness.

## Phase 2 — Robot design studio
- Versioned robot design schema.
- Virtual-only sensors/actuators catalogue.
- Design validation and revision history.

Tests: schema compatibility, invalid capability rejection, version immutability, size limits.

## Phase 3 — Simulation lab
- Sandboxed deterministic simulation adapter.
- Scenario registry, run lifecycle, reproducibility metadata.
- Time/CPU/memory/step budgets and cancellation.

Tests: deterministic replay, timeout, resource exhaustion, isolation, no-network/no-device checks.

## Phase 4 — Bio-inspired simulation
- Synthetic locomotion and soft-robotics models.
- Parameter sweeps and visualizable metrics.
- No biological material or wet-lab features.

Tests: numerical bounds, invalid parameter rejection, stability checks, resource caps, reproducibility.

## Phase 5 — Responsible AI and invention workflow
- Evidence-backed design proposals.
- Risk classification and uncertainty reporting.
- Human review and one-time approval for controlled state transitions.

Tests: prompt-injection resistance, untrusted-context handling, approval replay, actor attribution, policy denial.

## Phase 6 — Verification and Preview release candidate
- End-to-end tests, dependency and secret scans, performance baselines.
- Backup/restore and migration checks for durable records.
- Accessibility and Arabic/English UI review.
- Independent security review and documented residual risks.

Exit: all required checks green, no skipped mandatory tests, manual review approval. Production deployment remains a separate explicit decision.

## Performance targets (initial hypotheses, to be measured)
- API p95 under 500 ms for metadata operations under a documented test load.
- Simulation start acknowledgement under 1 s, excluding queue wait.
- Bounded scenario execution with a default 30 s wall-clock cap in Preview.
- No unbounded queue growth; apply per-project concurrency and queue limits.

Targets are engineering objectives, not measured results. They must be validated on the actual Preview environment before being reported as achieved.
