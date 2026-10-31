# SINDA NANO-NEURO GENESIS — Web Preview

## Approved profile
- Platform: web.
- Agent model: adaptive child-agent creation, gated by explicit project-scoped approval.
- Algorithms: digital genome metadata with deterministic, bounded mutation and crossover.
- Sensors: synthetic virtual events only.
- Capacity: maximum 10,000 agents per simulation.

## Architecture
- `agent-registry.js`: identity, project isolation, capability allowlists, parent lineage, depth/fan-out/capacity quotas.
- `genome.js`: versioned JSON traits, deterministic seed-based mutation and crossover; no executable genome.
- `swarm.js`: bounded task delegation to allow-listed actions; no shell, network, wallet, or arbitrary tool execution.
- `neural-sensors.js`: synthetic event input with type/range/rate limits.
- `fusion.js`: same-project capability intersection plus explicit allowlist (deny by default).
- `simulator.js`: creates up to 10,000 in-memory virtual agents for tests and preview.

## Security boundaries
No DNA, biological material, wet-lab workflow, implant, medical/neural device, hardware bridge, actuator, physical sensor, external control loop, or real-world replication is implemented. “Genome” means versioned digital configuration only; “neural sensors” means synthetic software events only.

Child creation requires an explicit approval record with approver and matching project ID. Child capabilities cannot exceed the parent's capabilities. Agent count, child fan-out, depth, genome trait ranges, sensor event volume, task volume and action types are bounded. No `eval`, dynamic code loading, or execution of genome contents is used.

## Preview limitations
The 10,000-agent test verifies bounded in-memory object creation in the GitHub CI runner; it is not a production capacity benchmark, browser load test, distributed swarm, persistent registry, or service-level guarantee. Authentication, tenant enforcement at an HTTP boundary, durable storage, observability, and independent penetration/load testing remain future gates.

## Verification
Run `npm ci` then `npm run check`. The suite includes project isolation, approval gates, quota enforcement, deterministic genome operations, synthetic sensor validation, task authorization, fusion policy and a 10,000-agent in-memory simulation test.
