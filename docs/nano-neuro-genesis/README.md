# SINDA NANO-NEURO GENESIS — Web Preview

## Approved profile
- Platform: web.
- Agent model: adaptive child-agent creation, gated by a trusted host-side approval verifier.
- Algorithms: digital genome metadata with deterministic, bounded mutation and crossover.
- Sensors: synthetic virtual events only, bound to registered project agents.
- Capacity setting: maximum 10,000 agents per in-memory simulation.

## Architecture
- `agent-registry.js`: identity, project isolation, capability allowlists, parent lineage, depth/fan-out/capacity quotas, and a fail-closed approval-verifier interface.
- `genome.js`: versioned JSON traits, deterministic seed-based mutation and crossover; no executable genome.
- `swarm.js`: bounded task delegation to allow-listed actions with project/agent-indexed quotas, project-scoped task IDs and mandatory project-scoped snapshots; no shell, network, wallet, or arbitrary tool execution.
- `neural-sensors.js`: synthetic event input accepted only for registered agents within the same project.
- `fusion.js`: resolves source agents from the trusted registry, then applies same-project capability intersection and explicit allowlisting.
- `simulator.js`: creates up to 10,000 in-memory virtual agents when the host injects a trusted approval verifier.
- `web/nano-neuro-preview.html`: static UI with a restrictive no-network CSP; CSS and JavaScript are local assets.

## Security boundaries
No DNA, biological material, wet-lab workflow, implant, medical/neural device, hardware bridge, actuator, physical sensor, external control loop, or real-world replication is implemented. “Genome” means versioned digital configuration only; “neural sensors” means synthetic software events only.

`AgentRegistry` has no permissive default for child creation. The host must inject a synchronous `verifySpawnApproval(context)` callback which verifies an authenticated approver, the project, parent, requested child identity and capabilities, and consumes a one-time approval record. The callback itself is a trusted server dependency: never construct it from request payloads or expose a client-controlled `() => true` implementation. The preview load harness uses a synthetic fixture verifier solely inside CI tests; it is not an identity provider or production approval service.

Sensor events require an agent ID present in the registry and an exact project match. Fusion does not accept caller-provided agent objects; it resolves distinct agent IDs from the registry. Capabilities are allow-listed, children cannot exceed parent capabilities, and population, fan-out, depth, task, genome and sensor quotas are bounded. No `eval`, dynamic code loading, or execution of genome contents is used.

The HTML page declares `default-src 'none'`, local-only script/style sources, and `connect-src 'none'`. The hosting server must additionally send response headers such as `Content-Security-Policy: frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, a restrictive `Permissions-Policy`, and `Referrer-Policy: no-referrer`. A meta CSP cannot replace all HTTP response headers.

## Staged load validation
The CI load smoke test exercises stages of 100, 1,000, 5,000 and 10,000 virtual agents. For each stage it measures:
- registry population construction time,
- synthetic sensor event ingestion time,
- task delegation time,
- observed JavaScript heap delta and process RSS.

It asserts correct population, sensor-event and task counts. It intentionally does not impose brittle machine-specific performance thresholds. Timings and memory figures are observations from the GitHub-hosted CI runner, not service-level objectives, browser measurements, concurrent-client benchmarks, or a guarantee that a deployed service can sustain 10,000 live workers.

## Preview limitations and remaining gates
This is a domain/service and static-UI preview, not an authenticated production service. Authentication, tenant authorization at an HTTP boundary, durable storage, distributed coordination, rate limiting at an API gateway, observability, deployment headers, browser/device coverage, independent third-party penetration testing, and representative concurrent load testing remain future gates.

## Verification
Run `npm ci` then `npm run check`. The suite includes security regression cases, static UI policy checks and staged in-memory load scenarios.
